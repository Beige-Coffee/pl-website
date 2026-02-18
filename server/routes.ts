import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import secp256k1 from "secp256k1";
import { bech32 } from "bech32";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { decode as decodeBolt11 } from "light-bolt11-decoder";
import { emailAuthSchema, insertPageEventSchema } from "@shared/schema";
import { existsSync } from "fs";

class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number, windowMs: number) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    setInterval(() => this.cleanup(), windowMs);
  }

  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxAttempts) return false;
    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.attempts) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) this.attempts.delete(key);
      else this.attempts.set(key, recent);
    }
  }
}

const authLimiter = new RateLimiter(10, 60_000);
const claimLimiter = new RateLimiter(5, 60_000);
const adminLimiter = new RateLimiter(5, 60_000);

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function startLexeSidecar() {
  const sidecarPath = ".local/bin/lexe-sidecar";
  if (!existsSync(sidecarPath)) {
    console.log("[lexe-sidecar] Binary not found, skipping");
    return;
  }
  if (!process.env.LEXE_CLIENT_CREDENTIALS) {
    console.log("[lexe-sidecar] No LEXE_CLIENT_CREDENTIALS set, skipping");
    return;
  }
  const child = spawn(sidecarPath, [], {
    stdio: "inherit",
    detached: false,
  });
  child.on("error", (err) => {
    console.error("[lexe-sidecar] Failed to start:", err.message);
  });
  child.on("exit", (code) => {
    console.log(`[lexe-sidecar] Exited with code ${code}`);
  });
  console.log("[lexe-sidecar] Started (pid=" + child.pid + ")");
}

function generateK1(): string {
  return randomBytes(32).toString("hex");
}

function encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, "utf8"));
  return bech32.encode("lnurl", words, 2000).toUpperCase();
}

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
  return `${proto}://${host}`;
}

async function getAuthUser(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  return storage.getUserBySessionToken(token);
}

export async function registerRoutes(app: Express): Promise<Server> {

  startLexeSidecar();

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!authLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const parsed = emailAuthSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email or password (min 6 chars)" });
      }
      const { email, password } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUserWithPassword(email, passwordHash, email.split("@")[0]);

      const session = await storage.createSession(user.id);
      res.json({
        authenticated: true,
        sessionToken: session.token,
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        rewardClaimed: user.rewardClaimed,
        lightningAddress: user.lightningAddress || null,
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!authLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const parsed = emailAuthSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const session = await storage.createSession(user.id);
      res.json({
        authenticated: true,
        sessionToken: session.token,
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        rewardClaimed: user.rewardClaimed,
        lightningAddress: user.lightningAddress || null,
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/verify", async (req: Request, res: Response) => {
    const user = await getAuthUser(req);
    if (!user) {
      return res.json({ authenticated: false });
    }
    res.json({
      authenticated: true,
      userId: user.id,
      pubkey: user.pubkey,
      email: user.email,
      displayName: user.displayName,
      rewardClaimed: user.rewardClaimed,
      lightningAddress: user.lightningAddress || null,
    });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await storage.deleteSession(token);
    }
    res.json({ ok: true });
  });

  // --- Lightning Address ---

  const LIGHTNING_ADDRESS_RE = /^[a-z0-9_.+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

  app.put("/api/user/lightning-address", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!claimLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { lightningAddress } = req.body;

      // Allow clearing the address
      if (lightningAddress === null || lightningAddress === "") {
        await storage.updateUserLightningAddress(user.id, null);
        return res.json({ ok: true, lightningAddress: null });
      }

      if (typeof lightningAddress !== "string" || !LIGHTNING_ADDRESS_RE.test(lightningAddress)) {
        return res.status(400).json({ error: "Invalid lightning address format. Use: user@wallet.com" });
      }

      if (lightningAddress.length > 256) {
        return res.status(400).json({ error: "Lightning address too long" });
      }

      const addr = lightningAddress.toLowerCase();
      await storage.updateUserLightningAddress(user.id, addr);
      res.json({ ok: true, lightningAddress: addr });
    } catch (err) {
      console.error("Lightning address update error:", err);
      res.status(500).json({ error: "Failed to update lightning address" });
    }
  });

  async function resolveLightningAddress(address: string): Promise<{ callback: string; minSendable: number; maxSendable: number } | null> {
    try {
      const [user, domain] = address.split("@");
      if (!user || !domain) return null;

      const url = `https://${domain}/.well-known/lnurlp/${user}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) return null;

      const data = await res.json() as any;
      if (data.tag !== "payRequest" || !data.callback) return null;

      return {
        callback: data.callback,
        minSendable: data.minSendable || 1000,
        maxSendable: data.maxSendable || 100000000,
      };
    } catch (err) {
      console.error("Lightning address resolution failed:", err);
      return null;
    }
  }

  async function autoPayLightningAddress(address: string, amountMsats: number): Promise<{ success: boolean; invoice?: string; paymentIndex?: string; error?: string }> {
    try {
      const resolved = await resolveLightningAddress(address);
      if (!resolved) return { success: false, error: "Could not resolve lightning address" };

      if (amountMsats < resolved.minSendable || amountMsats > resolved.maxSendable) {
        return { success: false, error: `Amount ${amountMsats} msats outside range [${resolved.minSendable}, ${resolved.maxSendable}]` };
      }

      // Request invoice from callback
      const separator = resolved.callback.includes("?") ? "&" : "?";
      const invoiceUrl = `${resolved.callback}${separator}amount=${amountMsats}`;
      const invoiceRes = await fetch(invoiceUrl, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });

      if (!invoiceRes.ok) return { success: false, error: `Invoice request failed: HTTP ${invoiceRes.status}` };

      const invoiceData = await invoiceRes.json() as any;
      if (!invoiceData.pr) return { success: false, error: "No invoice in response" };

      const invoice = invoiceData.pr;

      // Pay the invoice
      const payRes = await fetch("http://localhost:5393/v2/node/pay_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice }),
        signal: AbortSignal.timeout(30000),
      });

      if (payRes.ok) {
        const payData = await payRes.json() as { index: string };
        return { success: true, invoice, paymentIndex: payData.index };
      } else {
        const errData = await payRes.json().catch(() => ({ msg: "Unknown error" })) as { msg?: string };
        return { success: false, invoice, error: errData.msg || `Payment failed: HTTP ${payRes.status}` };
      }
    } catch (err: any) {
      console.error("Auto-pay lightning address error:", err);
      return { success: false, error: err.message || "Auto-pay failed" };
    }
  }

  const ALLOWED_ADMIN_IP = "108.236.117.225";

  const QUIZ_ANSWER_KEY = [3, 0, 0, 2, 1, 0, 3, 0, 3, 1];
  const QUIZ_PASS_THRESHOLD = 0.9;
  const REWARD_AMOUNT_SATS = parseInt(process.env.REWARD_AMOUNT_SATS || "21", 10);
  const REWARD_AMOUNT_MSATS = REWARD_AMOUNT_SATS * 1000;
  const WITHDRAWAL_TTL_MS = 5 * 60 * 1000;

  // Checkpoint questions — server-side answer key (index of correct option)
  const CHECKPOINT_ANSWER_KEY: Record<string, number> = {
    "pubkey-compression": 1,
    "hash-preimage": 2,
    "ecdh-security": 1,
    "hkdf-purpose": 1,
    "nonce-reuse": 2,
    "setup-wrong-key": 1,
    "act2-both-ephemeral": 3,
    "act3-nonce-one": 2,
    "message-length-limit": 0,
  };
  const CHECKPOINT_REWARD_SATS = parseInt(process.env.CHECKPOINT_REWARD_SATS || "5", 10);
  const CHECKPOINT_REWARD_MSATS = CHECKPOINT_REWARD_SATS * 1000;

  // Grouped checkpoint config: all questions must be correct for a single larger reward
  const CHECKPOINT_GROUPS: Record<string, { questionIds: string[]; rewardSats: number }> = {
    "crypto-review": {
      questionIds: ["pubkey-compression", "hash-preimage", "ecdh-security", "hkdf-purpose", "nonce-reuse"],
      rewardSats: 210,
    },
  };

  app.post("/api/quiz/claim", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!claimLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (user.rewardClaimed) {
        return res.status(400).json({ error: "Reward already claimed" });
      }

      const { answers } = req.body;
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ error: "Missing quiz answers" });
      }

      let correct = 0;
      for (let i = 0; i < QUIZ_ANSWER_KEY.length; i++) {
        if (answers[String(i)] === QUIZ_ANSWER_KEY[i]) {
          correct++;
        }
      }
      const score = correct / QUIZ_ANSWER_KEY.length;
      if (score < QUIZ_PASS_THRESHOLD) {
        return res.status(400).json({ error: `Score too low: ${Math.round(score * 100)}%. Need 90%+` });
      }

      await storage.cancelPendingWithdrawals(user.id);

      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          const nodeInfo = await nodeRes.json() as Record<string, string>;
          const sendable = parseInt(nodeInfo.lightning_sendable_balance || "0", 10);
          if (sendable < REWARD_AMOUNT_SATS) {
            return res.status(503).json({ error: "Reward pool temporarily empty. Please try again later." });
          }
        }
      } catch {
      }

      const k1 = generateK1();
      await storage.createWithdrawal(k1, user.id, String(REWARD_AMOUNT_MSATS));

      const withdrawUrl = `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`;
      const lnurl = encodeLnurl(withdrawUrl);

      res.json({ k1, lnurl, amountSats: REWARD_AMOUNT_SATS });
    } catch (err) {
      console.error("Quiz claim error:", err);
      res.status(500).json({ error: "Failed to generate reward" });
    }
  });

  // --- Checkpoint rewards ---

  app.post("/api/checkpoint/claim", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!claimLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { checkpointId, answer, method } = req.body;
      if (!checkpointId || typeof checkpointId !== "string" || typeof answer !== "number") {
        return res.status(400).json({ error: "Invalid request" });
      }

      const correctAnswer = CHECKPOINT_ANSWER_KEY[checkpointId];
      if (correctAnswer === undefined) {
        return res.status(400).json({ error: "Unknown checkpoint" });
      }

      if (answer !== correctAnswer) {
        return res.status(400).json({ error: "Incorrect answer", correct: false });
      }

      const paidWithdrawal = await storage.getPaidWithdrawalForCheckpoint(user.id, checkpointId);
      if (paidWithdrawal) {
        return res.status(400).json({ error: "Reward already claimed", alreadyCompleted: true });
      }

      await storage.cancelPendingWithdrawalsForCheckpoint(user.id, checkpointId);

      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          const nodeInfo = await nodeRes.json() as Record<string, string>;
          const sendable = parseInt(nodeInfo.lightning_sendable_balance || "0", 10);
          if (sendable < CHECKPOINT_REWARD_SATS) {
            return res.status(503).json({ error: "Reward pool temporarily empty. Please try again later." });
          }
        }
      } catch {}

      const k1 = generateK1();
      await storage.createWithdrawal(k1, user.id, String(CHECKPOINT_REWARD_MSATS), checkpointId);

      if (method !== "lnurl" && user.lightningAddress) {
        const result = await autoPayLightningAddress(user.lightningAddress, CHECKPOINT_REWARD_MSATS);
        if (result.success) {
          await storage.markWithdrawalClaimed(k1, result.invoice || "");
          await storage.markWithdrawalPaid(k1, result.paymentIndex || "auto-pay");
          await storage.markCheckpointCompleted(user.id, checkpointId);
          return res.json({ correct: true, autoPaid: true, amountSats: CHECKPOINT_REWARD_SATS });
        }
        console.warn(`Auto-pay failed for ${user.lightningAddress}: ${result.error}, falling back to QR`);
      }

      const withdrawUrl = `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`;
      const lnurl = encodeLnurl(withdrawUrl);

      res.json({ k1, lnurl, amountSats: CHECKPOINT_REWARD_SATS, correct: true });
    } catch (err) {
      console.error("Checkpoint claim error:", err);
      res.status(500).json({ error: "Failed to process checkpoint" });
    }
  });

  app.get("/api/checkpoint/status", async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.json({ completed: [] });
      }
      const completed = await storage.getCompletedCheckpoints(user.id);
      res.json({ completed });
    } catch (err) {
      console.error("Checkpoint status error:", err);
      res.json({ completed: [] });
    }
  });

  // --- Grouped checkpoint rewards ---

  app.post("/api/checkpoint-group/claim", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!claimLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { groupId, answers, method } = req.body;
      if (!groupId || typeof groupId !== "string" || !answers || typeof answers !== "object") {
        return res.status(400).json({ error: "Invalid request" });
      }

      const group = CHECKPOINT_GROUPS[groupId];
      if (!group) {
        return res.status(400).json({ error: "Unknown checkpoint group" });
      }

      const paidWithdrawal = await storage.getPaidWithdrawalForCheckpoint(user.id, groupId);
      if (paidWithdrawal) {
        return res.json({ alreadyCompleted: true });
      }

      for (const qid of group.questionIds) {
        const submitted = answers[qid];
        const correct = CHECKPOINT_ANSWER_KEY[qid];
        if (typeof submitted !== "number" || submitted !== correct) {
          return res.json({ correct: false, error: "Not all answers are correct" });
        }
      }

      await storage.cancelPendingWithdrawalsForCheckpoint(user.id, groupId);

      const rewardMsats = group.rewardSats * 1000;
      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          const nodeInfo = await nodeRes.json() as Record<string, string>;
          const sendable = parseInt(nodeInfo.lightning_sendable_balance || "0", 10);
          if (sendable < group.rewardSats) {
            return res.status(503).json({ error: "Reward pool temporarily empty. Please try again later." });
          }
        }
      } catch {}

      const k1 = generateK1();
      await storage.createWithdrawal(k1, user.id, String(rewardMsats), groupId);

      if (method !== "lnurl" && user.lightningAddress) {
        const result = await autoPayLightningAddress(user.lightningAddress, rewardMsats);
        if (result.success) {
          await storage.markWithdrawalClaimed(k1, result.invoice || "");
          await storage.markWithdrawalPaid(k1, result.paymentIndex || "auto-pay");
          await storage.markCheckpointCompleted(user.id, groupId);
          return res.json({ correct: true, autoPaid: true, amountSats: group.rewardSats });
        }
        console.warn(`Auto-pay failed for ${user.lightningAddress}: ${result.error}, falling back to QR`);
      }

      const withdrawUrl = `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`;
      const lnurl = encodeLnurl(withdrawUrl);

      res.json({ k1, lnurl, amountSats: group.rewardSats, correct: true });
    } catch (err) {
      console.error("Checkpoint group claim error:", err);
      res.status(500).json({ error: "Failed to process checkpoint group" });
    }
  });

  app.get("/api/lnurl/withdraw/:k1", async (req: Request, res: Response) => {
    try {
      const { k1 } = req.params;
      const withdrawal = await storage.getWithdrawalByK1(k1);

      if (!withdrawal) {
        return res.json({ status: "ERROR", reason: "Unknown withdrawal" });
      }

      const age = Date.now() - withdrawal.createdAt.getTime();
      if (age > WITHDRAWAL_TTL_MS) {
        await storage.markWithdrawalExpired(k1);
        return res.json({ status: "ERROR", reason: "Withdrawal expired" });
      }

      if (withdrawal.status !== "pending") {
        return res.json({ status: "ERROR", reason: "Withdrawal expired or already claimed" });
      }

      const callbackUrl = `${getBaseUrl(req)}/api/lnurl/callback`;
      res.json({
        tag: "withdrawRequest",
        callback: callbackUrl,
        k1,
        defaultDescription: "Lightning Quiz Reward - Programming Lightning",
        minWithdrawable: parseInt(withdrawal.amountMsats, 10),
        maxWithdrawable: parseInt(withdrawal.amountMsats, 10),
      });
    } catch (err) {
      console.error("LNURL withdraw error:", err);
      res.json({ status: "ERROR", reason: "Internal error" });
    }
  });

  app.get("/api/lnurl/callback", async (req: Request, res: Response) => {
    try {
      const { k1, pr } = req.query as Record<string, string>;

      if (!k1 || !pr) {
        return res.json({ status: "ERROR", reason: "Missing k1 or pr parameter" });
      }

      const withdrawal = await storage.getWithdrawalByK1(k1);
      if (!withdrawal) {
        return res.json({ status: "ERROR", reason: "Unknown withdrawal" });
      }

      const age = Date.now() - withdrawal.createdAt.getTime();
      if (age > WITHDRAWAL_TTL_MS) {
        await storage.markWithdrawalExpired(k1);
        return res.json({ status: "ERROR", reason: "Withdrawal expired" });
      }

      if (withdrawal.status !== "pending") {
        return res.json({ status: "ERROR", reason: "Withdrawal already claimed or processed" });
      }

      let invoiceMsats: string | null = null;
      try {
        const decoded = decodeBolt11(pr);
        const amountSection = decoded.sections.find((s: any) => s.name === "amount");
        if (amountSection && amountSection.value) {
          invoiceMsats = String(amountSection.value);
        }
      } catch (decodeErr) {
        console.error("Failed to decode bolt11:", decodeErr);
        return res.json({ status: "ERROR", reason: "Invalid invoice" });
      }

      if (!invoiceMsats || invoiceMsats !== withdrawal.amountMsats) {
        console.error(`Invoice amount mismatch: expected ${withdrawal.amountMsats} msats, got ${invoiceMsats} msats for k1 ${k1}`);
        await storage.markWithdrawalFailed(k1, `Amount mismatch: expected ${withdrawal.amountMsats}, got ${invoiceMsats}`);
        return res.json({ status: "ERROR", reason: "Invoice amount does not match withdrawal" });
      }

      await storage.markWithdrawalClaimed(k1, pr);

      res.json({ status: "OK" });

      (async () => {
        try {
          const isQuizReward = !withdrawal.checkpointId;
          if (isQuizReward && withdrawal.userId) {
            const freshUser = await storage.getUser(withdrawal.userId);
            if (freshUser?.rewardClaimed) {
              await storage.markWithdrawalFailed(k1, "Reward already claimed by user");
              return;
            }
          }
          if (withdrawal.checkpointId && withdrawal.userId) {
            const alreadyPaid = await storage.getPaidWithdrawalForCheckpoint(withdrawal.userId, withdrawal.checkpointId);
            if (alreadyPaid) {
              await storage.markWithdrawalFailed(k1, "Checkpoint reward already paid");
              return;
            }
          }
          const payRes = await fetch("http://localhost:5393/v2/node/pay_invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice: pr }),
            signal: AbortSignal.timeout(30000),
          });
          if (payRes.ok) {
            const payData = await payRes.json() as { index: string };
            await storage.markWithdrawalPaid(k1, payData.index);
            if (isQuizReward && withdrawal.userId) {
              await storage.setRewardClaimed(withdrawal.userId);
            }
            if (withdrawal.checkpointId && withdrawal.userId) {
              await storage.markCheckpointCompleted(withdrawal.userId, withdrawal.checkpointId);
            }
          } else {
            const errData = await payRes.json().catch(() => ({ msg: "Unknown error" })) as { msg?: string };
            await storage.markWithdrawalFailed(k1, errData.msg || `HTTP ${payRes.status}`);
          }
        } catch (err: any) {
          await storage.markWithdrawalFailed(k1, err.message || "Payment failed");
        }
      })();
    } catch (err) {
      console.error("LNURL callback error:", err);
      res.json({ status: "ERROR", reason: "Internal error" });
    }
  });

  app.get("/api/lnurl/status/:k1", async (req: Request, res: Response) => {
    try {
      const { k1 } = req.params;
      const withdrawal = await storage.getWithdrawalByK1(k1);

      if (!withdrawal) {
        return res.status(404).json({ status: "unknown" });
      }

      const age = Date.now() - withdrawal.createdAt.getTime();
      if (withdrawal.status === "pending" && age > WITHDRAWAL_TTL_MS) {
        await storage.markWithdrawalExpired(k1);
        return res.json({ status: "expired", amountSats: Math.floor(parseInt(withdrawal.amountMsats, 10) / 1000) });
      }

      res.json({
        status: withdrawal.status,
        amountSats: Math.floor(parseInt(withdrawal.amountMsats, 10) / 1000),
      });
    } catch (err) {
      console.error("Status check error:", err);
      res.status(500).json({ status: "error" });
    }
  });

  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (ip !== ALLOWED_ADMIN_IP) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.query.password as string;
    if (!adminPassword || providedPassword !== adminPassword) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      let nodeBalance: Record<string, unknown> = {};
      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          nodeBalance = await nodeRes.json() as Record<string, unknown>;
        }
      } catch {}

      const recentWithdrawals = await storage.getRecentWithdrawals(50);
      const paidWithdrawals = recentWithdrawals.filter((w) => w.status === "paid");
      const totalSatsPaid = paidWithdrawals.reduce(
        (sum, w) => sum + Math.floor(parseInt(w.amountMsats, 10) / 1000),
        0
      );
      const pendingCount = recentWithdrawals.filter((w) => w.status === "pending" || w.status === "claimed").length;

      res.json({
        nodeBalance,
        totalSatsPaid,
        pendingCount,
        recentWithdrawals: recentWithdrawals.slice(0, 20),
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/lnauth/challenge", async (req: Request, res: Response) => {
    try {
      const k1 = generateK1();
      await storage.createChallenge(k1);

      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/api/lnauth/callback?tag=login&k1=${k1}`;
      const encoded = encodeLnurl(callbackUrl);

      const qrDataUrl = await QRCode.toDataURL(`lightning:${encoded}`, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      res.json({
        k1,
        lnurl: encoded,
        qr: qrDataUrl,
        callbackUrl,
      });
    } catch (err) {
      console.error("Challenge generation error:", err);
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  });

  app.get("/api/lnauth/callback", async (req: Request, res: Response) => {
    try {
      const { tag, k1, sig, key } = req.query as Record<string, string>;

      if (tag !== "login" || !k1 || !sig || !key) {
        return res.json({ status: "ERROR", reason: "Missing parameters" });
      }

      const challenge = await storage.getChallenge(k1);
      if (!challenge) {
        return res.json({ status: "ERROR", reason: "Unknown or expired challenge" });
      }
      if (challenge.used) {
        return res.json({ status: "ERROR", reason: "Challenge already used" });
      }

      const k1Bytes = hexToBytes(k1);
      const sigBytes = hexToBytes(sig);
      const keyBytes = hexToBytes(key);

      let isValid = false;
      try {
        isValid = secp256k1.ecdsaVerify(
          secp256k1.signatureImport(Buffer.from(sigBytes)),
          Buffer.from(k1Bytes),
          Buffer.from(keyBytes)
        );
      } catch (verifyErr) {
        console.error("Signature verification error:", verifyErr);
        isValid = false;
      }

      if (!isValid) {
        return res.json({ status: "ERROR", reason: "Invalid signature" });
      }

      let user = await storage.getUserByPubkey(key);
      if (!user) {
        user = await storage.createUser({ pubkey: key });
      }

      const session = await storage.createSession(user.id);
      await storage.completeChallenge(k1, key, session.token);

      return res.json({ status: "OK" });
    } catch (err) {
      console.error("Callback error:", err);
      return res.json({ status: "ERROR", reason: "Internal error" });
    }
  });

  app.get("/api/lnauth/status", async (req: Request, res: Response) => {
    try {
      const { k1 } = req.query as Record<string, string>;
      if (!k1) {
        return res.json({ authenticated: false });
      }

      const challenge = await storage.getChallenge(k1);
      if (!challenge || !challenge.used || !challenge.pubkey || !challenge.sessionToken) {
        return res.json({ authenticated: false });
      }

      const user = await storage.getUserByPubkey(challenge.pubkey);

      return res.json({
        authenticated: true,
        sessionToken: challenge.sessionToken,
        pubkey: challenge.pubkey,
        userId: user?.id,
        displayName: user?.displayName,
        rewardClaimed: user?.rewardClaimed ?? false,
        lightningAddress: user?.lightningAddress || null,
      });
    } catch (err) {
      console.error("Status check error:", err);
      return res.json({ authenticated: false });
    }
  });

  app.post("/api/track/pageview", async (req: Request, res: Response) => {
    try {
      const { page, referrer, sessionId } = req.body;
      if (!page || typeof page !== "string") {
        return res.status(400).json({ error: "page is required" });
      }
      const user = await getAuthUser(req);
      const parsed = insertPageEventSchema.safeParse({
        page,
        referrer: typeof referrer === "string" ? referrer : null,
        sessionId: typeof sessionId === "string" ? sessionId : null,
        userId: user?.id || null,
        duration: null,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data" });
      }
      const event = await storage.createPageEvent(parsed.data);
      return res.json({ id: event.id, sessionId: parsed.data.sessionId });
    } catch (err) {
      console.error("Track pageview error:", err);
      return res.status(500).json({ error: "Failed to track pageview" });
    }
  });

  app.post("/api/track/pageview/:id/duration", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { duration, sessionId } = req.body;
      if (isNaN(id) || typeof duration !== "number" || duration < 0 || duration > 86400) {
        return res.status(400).json({ error: "Invalid id or duration" });
      }
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "sessionId required" });
      }
      const event = await storage.getPageEventById(id);
      if (!event || event.sessionId !== sessionId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.updatePageEventDuration(id, Math.round(duration));
      return res.json({ ok: true });
    } catch (err) {
      console.error("Update pageview error:", err);
      return res.status(500).json({ error: "Failed to update pageview" });
    }
  });

  app.get("/api/admin/analytics", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (ip !== ALLOWED_ADMIN_IP) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!adminLimiter.check(ip)) {
        return res.status(429).json({ error: "Too many attempts, try again later" });
      }
      const { password } = req.query as Record<string, string>;
      if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const [pageStats, totalViews, recentEvents] = await Promise.all([
        storage.getPageViewStats(),
        storage.getTotalPageViews(),
        storage.getRecentPageEvents(50),
      ]);
      return res.json({ totalViews, pageStats, recentEvents });
    } catch (err) {
      console.error("Admin analytics error:", err);
      return res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  app.get("/api/admin/check-ip", (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (ip !== ALLOWED_ADMIN_IP) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ allowed: true });
  });

  app.get("/api/admin/dashboard", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (ip !== ALLOWED_ADMIN_IP) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (!adminLimiter.check(ip)) {
        return res.status(429).json({ error: "Too many attempts, try again later" });
      }

      const { password } = req.query as Record<string, string>;
      const adminPw = process.env.ADMIN_PASSWORD;
      if (!adminPw || !password || password !== adminPw) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let recentWithdrawals: Awaited<ReturnType<typeof storage.getRecentWithdrawals>> = [];
      let users: Awaited<ReturnType<typeof storage.getAllUsers>> = [];
      let userCount = 0;
      let checkpointCompletions: Awaited<ReturnType<typeof storage.getAllCheckpointCompletions>> = [];
      let pageStats: Awaited<ReturnType<typeof storage.getPageViewStats>> = [];
      let totalViews = 0;
      let recentEvents: Awaited<ReturnType<typeof storage.getRecentPageEvents>> = [];

      try {
        [recentWithdrawals, users, userCount, checkpointCompletions, pageStats, totalViews, recentEvents] =
          await Promise.all([
            storage.getRecentWithdrawals(100),
            storage.getAllUsers(),
            storage.getUserCount(),
            storage.getAllCheckpointCompletions(),
            storage.getPageViewStats(),
            storage.getTotalPageViews(),
            storage.getRecentPageEvents(100),
          ]);
      } catch (dbErr) {
        console.error("Admin dashboard DB error (continuing with empty data):", dbErr);
      }

      let nodeBalance: Record<string, unknown> = {};
      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          nodeBalance = await nodeRes.json() as Record<string, unknown>;
        }
      } catch {}

      const paidWithdrawals = recentWithdrawals.filter((w) => w.status === "paid");
      const totalSatsPaid = paidWithdrawals.reduce(
        (sum, w) => sum + Math.floor(parseInt(w.amountMsats, 10) / 1000),
        0
      );
      const pendingCount = recentWithdrawals.filter((w) => w.status === "pending" || w.status === "claimed").length;

      return res.json({
        nodeBalance,
        totalSatsPaid,
        pendingCount,
        recentWithdrawals,
        users,
        userCount,
        checkpointCompletions,
        totalViews,
        pageStats,
        recentEvents,
      });
    } catch (err) {
      console.error("Admin dashboard error:", err);
      return res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  const donationLimiter = new RateLimiter(10, 60_000);

  app.post("/api/donate/create-invoice", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!donationLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests, please try again later" });
    }

    const { amount_sats } = req.body;
    if (!amount_sats || typeof amount_sats !== "number" || amount_sats < 1 || amount_sats > 1000000 || !Number.isInteger(amount_sats)) {
      return res.status(400).json({ error: "Invalid amount. Must be a whole number between 1 and 1,000,000 sats." });
    }

    try {
      const lexeRes = await fetch("http://localhost:5393/v2/node/create_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: String(amount_sats),
          description: `Programming Lightning Donation: ${amount_sats} sats`,
          expiration_secs: 600,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!lexeRes.ok) {
        const errText = await lexeRes.text();
        console.error("[donate] Lexe create_invoice failed:", lexeRes.status, errText);
        return res.status(502).json({ error: "Failed to create invoice. Please try again." });
      }

      const data = await lexeRes.json() as any;
      if (!data.invoice || !data.index) {
        console.error("[donate] Unexpected Lexe response:", JSON.stringify(data));
        return res.status(502).json({ error: "Invalid response from Lightning node" });
      }
      return res.json({
        invoice: data.invoice,
        payment_index: data.index,
        amount_sats,
        expires_at: data.expires_at || null,
      });
    } catch (err: any) {
      console.error("[donate] Error creating invoice:", err.message);
      return res.status(500).json({ error: "Failed to create invoice. Lightning node may be unavailable." });
    }
  });

  const checkPaymentLimiter = new RateLimiter(60, 60_000);

  app.get("/api/donate/check-payment", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkPaymentLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const { index } = req.query;
    if (!index || typeof index !== "string") {
      return res.status(400).json({ error: "Missing payment index" });
    }

    try {
      const lexeRes = await fetch(`http://localhost:5393/v2/node/payment?index=${encodeURIComponent(index)}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!lexeRes.ok) {
        return res.status(502).json({ error: "Failed to check payment status" });
      }

      const data = await lexeRes.json() as any;
      const rawStatus = (data.status || "").toLowerCase();
      const normalizedStatus = ["completed", "paid", "settled", "succeeded"].includes(rawStatus) ? "paid" : rawStatus;
      return res.json({
        status: normalizedStatus,
        amount_sat: data.amount,
        finalized_at: data.finalized_at,
      });
    } catch (err: any) {
      console.error("[donate] Error checking payment:", err.message);
      return res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
