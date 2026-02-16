import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import secp256k1 from "secp256k1";
import { bech32 } from "bech32";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { emailAuthSchema } from "@shared/schema";
import { existsSync } from "fs";

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
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
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
    });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await storage.deleteSession(token);
    }
    res.json({ ok: true });
  });

  const QUIZ_ANSWER_KEY = [3, 0, 0, 2, 1, 0, 3, 0, 3, 1];
  const QUIZ_PASS_THRESHOLD = 0.9;
  const REWARD_AMOUNT_SATS = parseInt(process.env.REWARD_AMOUNT_SATS || "21", 10);
  const REWARD_AMOUNT_MSATS = REWARD_AMOUNT_SATS * 1000;
  const WITHDRAWAL_TTL_MS = 5 * 60 * 1000;

  app.post("/api/quiz/claim", async (req: Request, res: Response) => {
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

      await storage.markWithdrawalClaimed(k1, pr);

      res.json({ status: "OK" });

      (async () => {
        try {
          if (withdrawal.userId) {
            const freshUser = await storage.getUser(withdrawal.userId);
            if (freshUser?.rewardClaimed) {
              await storage.markWithdrawalFailed(k1, "Reward already claimed by user");
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
            if (withdrawal.userId) {
              await storage.setRewardClaimed(withdrawal.userId);
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
      });
    } catch (err) {
      console.error("Status check error:", err);
      return res.json({ authenticated: false });
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
