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
import { emailAuthSchema, insertPageEventSchema, type Feedback } from "@shared/schema";
import { existsSync } from "fs";
import { sendVerificationEmail } from "./email";
import { nodeManager } from "./bitcoin-node";

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
const feedbackLimiter = new RateLimiter(5, 600_000);

function getClientIp(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "";
  if (!ip) return "unknown";
  return ip.replace(/^::ffff:/, "");
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
  const user = await storage.getUserBySessionToken(token);
  if (user) {
    if (!user.lastActiveAt || Date.now() - new Date(user.lastActiveAt).getTime() > 5 * 60_000) {
      storage.updateLastActive(user.id).catch(() => {});
    }
  }
  return user;
}

function verificationResultPage(success: boolean, message: string): string {
  const color = success ? "#b8860b" : "#dc2626";
  const icon = success ? "&#10003;" : "&#10007;";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<title>${success ? "Email Verified" : "Verification Failed"}</title>
<style>body{margin:0;background:#f5f0e1;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.box{background:#fffdf5;border:4px solid #b8860b;padding:48px;max-width:480px;text-align:center;}
.icon{font-size:48px;color:${color};margin-bottom:16px;}
h1{font-family:'Press Start 2P',monospace;font-size:14px;color:${color};margin:0 0 20px;}
p{font-size:18px;color:#1a1a1a;line-height:1.6;margin:0 0 24px;}
a{display:inline-block;background:#FFD700;color:#000;font-family:'Press Start 2P',monospace;font-size:11px;padding:14px 28px;text-decoration:none;border:2px solid #b8860b;}
a:hover{opacity:0.9;}</style></head>
<body>${success ? '<script>try{localStorage.removeItem("pl-auth-cache")}catch(e){}</script>' : ''}
<div class="box"><div class="icon">${icon}</div>
<h1>${success ? "VERIFIED" : "ERROR"}</h1>
<p>${message}</p>
<a href="/">BACK TO HOME</a></div></body></html>`;
}

// Checkpoint questions — server-side answer key (index of correct option)
// Exported for content integrity tests
export const CHECKPOINT_ANSWER_KEY: Record<string, number> = {
  "pubkey-compression": 1,
  "hash-preimage": 2,
  "ecdh-security": 1,
  "hkdf-purpose": 0,
  "nonce-reuse": 2,
  "setup-wrong-key": 1,
  "act2-both-ephemeral": 3,
  "act3-nonce-one": 2,
  "message-length-limit": 0,
  // Coding exercise IDs — answer 0 means "all tests passed"
  "exercise-generate-keypair": 0,
  "exercise-ecdh": 0,
  "exercise-hkdf": 0,
  "exercise-init-state": 0,
  "exercise-act1-initiator": 0,
  "exercise-act1-responder": 0,
  "exercise-act2-responder": 0,
  "exercise-act2-initiator": 0,
  "exercise-act3-initiator": 0,
  "exercise-encrypt": 0,
  "exercise-decrypt": 0,
  "exercise-key-rotation": 0,
  // Lightning tutorial drag-drop exercise (client validates matches, always sends 0)
  "course-tools-match": 0,
  // Lightning tutorial checkpoint questions
  "channel-fairness": 0,
  "payment-channels-scaling": 2,
  "asymmetric-commits": 1,
  "funding-multisig": 1,
  "pubkey-sorting": 0,
  "bip32-derivation": 3,
  "revocation-purpose": 3,
  "revocation-key-construction": 2,
  "revocation-secret-exchange": 1,
  "commitment-secret-algorithm": 0,
  "csv-purpose": 2,
  "obscured-commitment": 0,
  "htlc-dust": 3,
  "htlc-timeout-vs-success": 2,
  "htlc-preimage-purpose": 1,
  "htlc-atomicity": 0,
  "offered-vs-received": 1,
  "witness-structure": 3,
  "fee-deduction": 1,
  "static-remotekey": 3,
  // Checkpoint group IDs (answer 0 = all questions correct)
  "crypto-review": 0,
  // Exercise IDs (answer 0 = tests passed)
  "ln-exercise-channel-key-manager": 0,
  "ln-exercise-funding-script": 0,
  "ln-exercise-funding-tx": 0,
  "ln-exercise-sign-input": 0,
  "ln-exercise-revocation-pubkey": 0,
  "ln-exercise-revocation-privkey": 0,
  "ln-exercise-commitment-secret": 0,
  "ln-exercise-per-commitment-point": 0,
  "ln-exercise-derive-pubkey": 0,
  "ln-exercise-derive-privkey": 0,
  "ln-exercise-to-remote-script": 0,
  "ln-exercise-to-local-script": 0,
  "ln-exercise-obscure-factor": 0,
  "ln-exercise-obscured-commitment": 0,
  "ln-exercise-commitment-outputs": 0,
  "ln-exercise-sort-outputs": 0,
  "ln-exercise-commitment-tx": 0,
  "ln-exercise-get-commitment-keys": 0,
  "ln-exercise-finalize-commitment": 0,
  "ln-exercise-htlc-outputs": 0,
  "ln-exercise-commitment-tx-htlc": 0,
  "ln-exercise-offered-htlc-script": 0,
  "ln-exercise-received-htlc-script": 0,
  "ln-exercise-htlc-timeout-tx": 0,
  "ln-exercise-htlc-success-tx": 0,
  "ln-exercise-finalize-htlc-timeout": 0,
  "ln-exercise-finalize-htlc-success": 0,
  // TX Generator IDs (answer 0 = successful generation)
  "gen-funding": 0,
  "gen-commitment": 0,
  "gen-htlc-commitment": 0,
  "gen-htlc-timeout": 0,
};

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
        return res.status(409).json({ error: "Email already registered. Please log in instead." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUserWithPassword(email, passwordHash, email.split("@")[0]);

      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, verificationExpiry);

      const baseUrl = getBaseUrl(req);
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

      try {
        await sendVerificationEmail(email, verificationUrl);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
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
        emailVerified: false,
        needsVerification: true,
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
        emailVerified: user.emailVerified,
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
      emailVerified: user.emailVerified,
    });
  });

  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).send(verificationResultPage(false, "Invalid verification link."));
    }
    try {
      const user = await storage.verifyEmail(token);
      if (!user) {
        return res.status(400).send(verificationResultPage(false, "This verification link is invalid, expired, or has already been used. If you've already verified your email, you're all set!"));
      }
      return res.send(verificationResultPage(true, "Your email has been verified! You can now claim sat rewards."));
    } catch (err) {
      console.error("Email verification error:", err);
      return res.status(500).send(verificationResultPage(false, "Something went wrong. Please try again."));
    }
  });

  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!authLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (user.emailVerified) {
        return res.json({ ok: true, alreadyVerified: true });
      }
      if (!user.email) {
        return res.status(400).json({ error: "No email on account" });
      }

      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.setVerificationToken(user.id, verificationToken, verificationExpiry);

      const baseUrl = getBaseUrl(req);
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(user.email, verificationUrl);

      res.json({ ok: true });
    } catch (err) {
      console.error("Resend verification error:", err);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
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

  const ALLOWED_ADMIN_IPS = ["108.236.117.225", "23.93.117.198"];
  const LOCALHOST_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];

  function isAdminIp(ip: string): boolean {
    return ALLOWED_ADMIN_IPS.includes(ip) || LOCALHOST_IPS.includes(ip);
  }

  function hasAdminPassword(password: string | undefined): boolean {
    const adminPw = process.env.ADMIN_PASSWORD;
    return !!adminPw && !!password && password === adminPw;
  }

  function hasLaunchTestToken(req: Request): boolean {
    const enabled = process.env.PL_NODE_LOAD_TEST_BYPASS_ENABLED === "1";
    const configuredToken = process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN || "";
    if (!enabled || !configuredToken) return false;
    const providedToken = req.headers["x-pl-load-test-token"];
    return typeof providedToken === "string" && providedToken === configuredToken;
  }

  function canBypassNodeLimiter(req: Request): boolean {
    return hasLaunchTestToken(req);
  }

  function sanitizeLaunchPrefix(raw: unknown): string {
    const fallback = "launch";
    if (typeof raw !== "string") return fallback;
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return sanitized.slice(0, 24) || fallback;
  }

  function buildLaunchTestCredentials(prefix: string, count: number) {
    return Array.from({ length: count }, (_, index) => {
      const label = String(index + 1).padStart(2, "0");
      return {
        label,
        email: `${prefix}-${label}@pl-launch.test`,
        password: `Launch-${prefix}-${label}-Pass!`,
        displayName: `${prefix}-${label}`,
      };
    });
  }

  const QUIZ_ANSWER_KEYS: Record<string, number[]> = {
    noise: [3, 0, 2, 2, 1, 0, 3, 0, 3, 1],
    lightning: [0, 3, 2, 0, 1, 3, 0, 2, 1, 3],
  };
  const QUIZ_PASS_THRESHOLD = 0.9;
  const REWARD_AMOUNT_SATS = parseInt(process.env.REWARD_AMOUNT_SATS || "21", 10);
  const REWARD_AMOUNT_MSATS = REWARD_AMOUNT_SATS * 1000;
  const WITHDRAWAL_TTL_MS = 5 * 60 * 1000;

  const CHECKPOINT_REWARD_SATS = parseInt(process.env.CHECKPOINT_REWARD_SATS || "21", 10);
  const CHECKPOINT_REWARD_MSATS = CHECKPOINT_REWARD_SATS * 1000;

  // Grouped checkpoint config: all questions must be correct for a single larger reward
  const CHECKPOINT_GROUPS: Record<string, { questionIds: string[]; rewardSats: number }> = {
    "crypto-review": {
      questionIds: ["pubkey-compression", "hash-preimage", "ecdh-security", "hkdf-purpose", "nonce-reuse"],
      rewardSats: 21,
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

      const isVerified = user.pubkey || user.emailVerified;
      if (!isVerified) {
        return res.status(403).json({ error: "Please verify your email before claiming rewards. Check your inbox for the verification link." });
      }

      if (user.rewardClaimed) {
        return res.status(400).json({ error: "Reward already claimed" });
      }

      const { answers, quizId } = req.body;
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ error: "Missing quiz answers" });
      }

      const answerKey = QUIZ_ANSWER_KEYS[quizId || "noise"] || QUIZ_ANSWER_KEYS["noise"];

      let correct = 0;
      for (let i = 0; i < answerKey.length; i++) {
        if (answers[String(i)] === answerKey[i]) {
          correct++;
        }
      }
      const score = correct / answerKey.length;
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

      if (user.lightningAddress) {
        const result = await autoPayLightningAddress(user.lightningAddress, REWARD_AMOUNT_MSATS);
        if (result.success) {
          await storage.markWithdrawalClaimed(k1, result.invoice || "");
          await storage.markWithdrawalPaid(k1, result.paymentIndex || "auto-pay");
          await storage.setRewardClaimed(user.id);
          return res.json({ k1, autoPaid: true, amountSats: REWARD_AMOUNT_SATS });
        }
        console.warn(`Quiz auto-pay failed for ${user.lightningAddress}: ${result.error}, falling back to QR`);
      }

      const withdrawUrl = `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`;
      const lnurl = encodeLnurl(withdrawUrl);

      res.json({ k1, lnurl, amountSats: REWARD_AMOUNT_SATS });
    } catch (err) {
      console.error("Quiz claim error:", err);
      res.status(500).json({ error: "Failed to generate reward" });
    }
  });

  // --- Checkpoint completions (save on correct answer, no withdrawal) ---

  app.post("/api/checkpoint/complete", async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { checkpointId, answer } = req.body;
      if (!checkpointId || typeof checkpointId !== "string" || typeof answer !== "number") {
        return res.status(400).json({ error: "Invalid request" });
      }

      const correctAnswer = CHECKPOINT_ANSWER_KEY[checkpointId];
      if (correctAnswer === undefined) {
        return res.status(400).json({ error: "Unknown checkpoint" });
      }

      if (answer !== correctAnswer) {
        return res.json({ correct: false });
      }

      await storage.markCheckpointCompleted(user.id, checkpointId);
      return res.json({ correct: true });
    } catch (err) {
      console.error("Checkpoint complete error:", err);
      res.status(500).json({ error: "Failed to save completion" });
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

      const isVerified = user.pubkey || user.emailVerified;
      if (!isVerified) {
        return res.status(403).json({ error: "Please verify your email before claiming rewards. Check your inbox for the verification link." });
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

      // Exercises get the full reward amount; regular checkpoints get the smaller amount
      const isExercise = checkpointId.startsWith("exercise-") || checkpointId.startsWith("ln-exercise-") || checkpointId.startsWith("gen-");
      const rewardSats = isExercise ? REWARD_AMOUNT_SATS : CHECKPOINT_REWARD_SATS;
      const rewardMsats = rewardSats * 1000;

      try {
        const nodeRes = await fetch("http://localhost:5393/v2/node/node_info", {
          signal: AbortSignal.timeout(20000),
        });
        if (nodeRes.ok) {
          const nodeInfo = await nodeRes.json() as Record<string, string>;
          const sendable = parseInt(nodeInfo.lightning_sendable_balance || "0", 10);
          if (sendable < rewardSats) {
            return res.status(503).json({ error: "Reward pool temporarily empty. Please try again later." });
          }
        }
      } catch {}

      const k1 = generateK1();
      await storage.createWithdrawal(k1, user.id, String(rewardMsats), checkpointId);

      if (method !== "lnurl" && user.lightningAddress) {
        const result = await autoPayLightningAddress(user.lightningAddress, rewardMsats);
        if (result.success) {
          await storage.markWithdrawalClaimed(k1, result.invoice || "");
          await storage.markWithdrawalPaid(k1, result.paymentIndex || "auto-pay");
          await storage.markCheckpointCompleted(user.id, checkpointId);
          return res.json({ correct: true, autoPaid: true, amountSats: rewardSats });
        }
        console.warn(`Auto-pay failed for ${user.lightningAddress}: ${result.error}, falling back to QR`);
      }

      const withdrawUrl = `${getBaseUrl(req)}/api/lnurl/withdraw/${k1}`;
      const lnurl = encodeLnurl(withdrawUrl);

      res.json({ k1, lnurl, amountSats: rewardSats, correct: true });
    } catch (err) {
      console.error("Checkpoint claim error:", err);
      res.status(500).json({ error: "Failed to process checkpoint" });
    }
  });

  app.get("/api/checkpoint/status", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
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

  // --- User progress (sync quiz/code across devices) ---

  app.get("/api/progress", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      const progress = await storage.getUserProgress(user.id);
      res.json({ progress });
    } catch (err) {
      console.error("Get progress error:", err);
      res.status(500).json({ error: "Failed to get progress" });
    }
  });

  app.post("/api/progress", async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      const { key, value } = req.body;
      if (!key || typeof key !== "string" || typeof value !== "string") {
        return res.status(400).json({ error: "Invalid key/value" });
      }
      if (value.length > 50000) {
        return res.status(400).json({ error: "Value too large" });
      }
      await storage.setUserProgress(user.id, key, value);
      res.json({ ok: true });
    } catch (err) {
      console.error("Set progress error:", err);
      res.status(500).json({ error: "Failed to save progress" });
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

      const isVerified = user.pubkey || user.emailVerified;
      if (!isVerified) {
        return res.status(403).json({ error: "Please verify your email before claiming rewards. Check your inbox for the verification link." });
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
    if (!isAdminIp(ip)) {
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
      if (!isAdminIp(ip)) {
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
    console.log("[admin] check-ip detected:", ip, "| allowed:", isAdminIp(ip));
    if (!isAdminIp(ip)) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ allowed: true });
  });

  app.get("/api/admin/dashboard", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!isAdminIp(ip)) {
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
      let recentDonations: Awaited<ReturnType<typeof storage.getRecentDonations>> = [];
      let recentFeedback: Awaited<ReturnType<typeof storage.getRecentFeedback>> = [];

      try {
        [recentWithdrawals, users, userCount, checkpointCompletions, pageStats, totalViews, recentEvents, recentDonations, recentFeedback] =
          await Promise.all([
            storage.getRecentWithdrawals(100),
            storage.getAllUsers(),
            storage.getUserCount(),
            storage.getAllCheckpointCompletions(),
            storage.getPageViewStats(),
            storage.getTotalPageViews(),
            storage.getRecentPageEvents(100),
            storage.getRecentDonations(100),
            storage.getRecentFeedback(100),
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

      // Compute user segments server-side
      const now = Date.now();
      const DAY = 86_400_000;
      const userCheckpointIds: Record<string, Set<string>> = {};
      const userLatestCheckpoint: Record<string, number> = {};
      for (const c of checkpointCompletions) {
        if (!userCheckpointIds[c.userId]) userCheckpointIds[c.userId] = new Set();
        userCheckpointIds[c.userId].add(c.checkpointId);
        const t = new Date(c.createdAt).getTime();
        if (!userLatestCheckpoint[c.userId] || t > userLatestCheckpoint[c.userId]) {
          userLatestCheckpoint[c.userId] = t;
        }
      }
      const userPageActivity: Record<string, boolean> = {};
      for (const e of recentEvents) {
        if (e.userId) userPageActivity[e.userId] = true;
      }
      // Total checkpoint count across all tutorials for "completed" check
      const ALL_CHECKPOINT_COUNT = 49; // lightning tutorial total
      const userSegments: Record<string, string> = {};
      for (const u of users) {
        const cpSet = userCheckpointIds[u.id];
        const cpCount = cpSet?.size ?? 0;
        const lastActive = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
        const createdAt = u.createdAt ? new Date(u.createdAt).getTime() : 0;
        const daysSinceActive = lastActive ? (now - lastActive) / DAY : Infinity;
        const latestCp = userLatestCheckpoint[u.id] ?? 0;
        const daysSinceCheckpoint = latestCp ? (now - latestCp) / DAY : Infinity;
        const accountAgeDays = createdAt ? (now - createdAt) / DAY : Infinity;

        if (cpCount >= ALL_CHECKPOINT_COUNT) {
          userSegments[u.id] = "completed";
        } else if (accountAgeDays < 7 && cpCount <= 2) {
          userSegments[u.id] = "new";
        } else if (daysSinceActive <= 7 && daysSinceCheckpoint <= 14) {
          userSegments[u.id] = "on-track";
        } else if (daysSinceActive <= 7 && daysSinceCheckpoint > 14) {
          userSegments[u.id] = "struggling";
        } else if (cpCount > 0 && daysSinceActive > 7 && daysSinceActive <= 30) {
          userSegments[u.id] = "stalled";
        } else if (cpCount > 0 && daysSinceActive > 30) {
          userSegments[u.id] = "churned";
        } else if (userPageActivity[u.id] && cpCount === 0) {
          userSegments[u.id] = "browsing";
        } else {
          userSegments[u.id] = "browsing";
        }
      }

      return res.json({
        nodeBalance,
        nodeMetrics: nodeManager.getMetrics(),
        launchControls: {
          nodeLimiterBypassEnabled: process.env.PL_NODE_LOAD_TEST_BYPASS_ENABLED === "1",
        },
        totalSatsPaid,
        pendingCount,
        recentWithdrawals,
        users,
        userCount,
        checkpointCompletions,
        totalViews,
        pageStats,
        recentEvents,
        recentDonations,
        recentFeedback,
        userSegments,
      });
    } catch (err) {
      console.error("Admin dashboard error:", err);
      return res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  app.post("/api/admin/donation-spam", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!isAdminIp(ip)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { password, donation_id } = req.body;
    const adminPw = process.env.ADMIN_PASSWORD;
    if (!adminPw || !password || password !== adminPw) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!donation_id || typeof donation_id !== "string") {
      return res.status(400).json({ error: "Missing donation_id" });
    }
    try {
      await storage.markDonationSpam(donation_id);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] Error marking donation as spam:", err.message);
      return res.status(500).json({ error: "Failed to update donation" });
    }
  });

  app.post("/api/admin/reset-checkpoints", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!isAdminIp(ip)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    const { password, userId, checkpointId } = req.body;
    if (!hasAdminPassword(password)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
    try {
      if (checkpointId && typeof checkpointId === "string") {
        await storage.deleteCheckpointCompletion(userId, checkpointId);
        await storage.deleteWithdrawalsForCheckpoint(userId, checkpointId);
      } else {
        await storage.resetUserLaunchState(userId);
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] Error resetting checkpoints:", err.message);
      return res.status(500).json({ error: "Failed to reset checkpoints" });
    }
  });

  app.post("/api/admin/delete-user", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!isAdminIp(ip)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    const { password, userId } = req.body;
    if (!hasAdminPassword(password)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing userId" });
    }
    try {
      await storage.deleteUser(userId);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] Error deleting user:", err.message);
      return res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/admin/node-metrics", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!hasLaunchTestToken(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    const { password } = req.query as Record<string, string>;
    if (!hasAdminPassword(password)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({
      nodeMetrics: nodeManager.getMetrics(),
      launchControls: {
        nodeLimiterBypassEnabled: process.env.PL_NODE_LOAD_TEST_BYPASS_ENABLED === "1",
      },
    });
  });

  app.post("/api/admin/node-metrics/reset", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!hasLaunchTestToken(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }
    const { password } = req.body;
    if (!hasAdminPassword(password)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    nodeManager.resetMetrics();
    return res.json({ success: true });
  });

  app.post("/api/admin/test-learners/provision", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!hasLaunchTestToken(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!adminLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many attempts, try again later" });
    }

    const { password, count, prefix } = req.body;
    if (!hasAdminPassword(password)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const learnerCount = typeof count === "number" && Number.isInteger(count) ? count : 5;
    if (learnerCount < 1 || learnerCount > 50) {
      return res.status(400).json({ error: "count must be an integer between 1 and 50" });
    }

    const launchPrefix = sanitizeLaunchPrefix(prefix);
    const credentials = buildLaunchTestCredentials(launchPrefix, learnerCount);

    try {
      const learners = await Promise.all(credentials.map(async (entry) => {
        const passwordHash = await bcrypt.hash(entry.password, 10);
        const existing = await storage.getUserByEmail(entry.email);
        if (existing) {
          await storage.updateUserPassword(existing.id, passwordHash, entry.displayName);
          await storage.setUserEmailVerified(existing.id, true);
          await storage.resetUserLaunchState(existing.id);
          return {
            userId: existing.id,
            email: entry.email,
            password: entry.password,
            displayName: entry.displayName,
            created: false,
          };
        }

        const user = await storage.createUserWithPassword(entry.email, passwordHash, entry.displayName);
        await storage.setUserEmailVerified(user.id, true);
        await storage.resetUserLaunchState(user.id);
        return {
          userId: user.id,
          email: entry.email,
          password: entry.password,
          displayName: entry.displayName,
          created: true,
        };
      }));

      return res.json({
        prefix: launchPrefix,
        count: learnerCount,
        learners,
      });
    } catch (err: any) {
      console.error("[admin] Error provisioning test learners:", err.message);
      return res.status(500).json({ error: "Failed to provision test learners" });
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

  // --- Donation message moderation (simple keyword filter) ---
  const BLOCKED_PATTERNS = [
    /\bf+u+c+k+/i, /\bs+h+i+t+/i, /\ba+s+s+h+o+l+e/i, /\bb+i+t+c+h/i,
    /\bd+a+m+n/i, /\bc+u+n+t/i, /\bn+i+g+g/i, /\bf+a+g+/i, /\br+e+t+a+r+d/i,
    /\bk+i+l+l\s*(your|ur|u)self/i, /\bdie\b/i, /\bkys\b/i,
    /\bwh+o+r+e/i, /\bs+l+u+t/i, /\bp+e+n+i+s/i, /\bv+a+g+i+n+a/i,
    /\bd+i+c+k\b/i, /\bc+o+c+k\b/i, /\btits\b/i, /\bboobs\b/i,
    /\bporn/i, /\bsex\b/i, /\bnazi/i, /\bhitler/i,
    /\bscam/i, /\brug\s*pull/i,
  ];

  function isMessageClean(text: string): boolean {
    if (!text) return true;
    return !BLOCKED_PATTERNS.some(pattern => pattern.test(text));
  }

  app.post("/api/donate/moderate", async (req: Request, res: Response) => {
    const { message, name } = req.body;
    const issues: string[] = [];
    if (name && !isMessageClean(name)) issues.push("name");
    if (message && !isMessageClean(message)) issues.push("message");
    return res.json({ clean: issues.length === 0, issues });
  });

  // --- Save completed donation with optional name/message ---
  const saveDonationLimiter = new RateLimiter(10, 60_000);

  app.post("/api/donate/complete", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!saveDonationLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const { payment_index, amount_sats, donor_name, message } = req.body;

    if (!payment_index || typeof payment_index !== "string") {
      return res.status(400).json({ error: "Missing payment index" });
    }
    if (!amount_sats || typeof amount_sats !== "number" || amount_sats < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const cleanName = (donor_name || "").trim().slice(0, 50) || "Anon";
    const cleanMessage = (message || "").trim().slice(0, 280) || null;

    // Verify content is clean
    if (!isMessageClean(cleanName) || (cleanMessage && !isMessageClean(cleanMessage))) {
      return res.status(400).json({ error: "Message contains inappropriate content" });
    }

    // Verify payment is actually paid before saving
    try {
      const lexeRes = await fetch(`http://localhost:5393/v2/node/payment?index=${encodeURIComponent(payment_index)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (lexeRes.ok) {
        const data = await lexeRes.json() as any;
        console.log("[donate/complete] Lexe payment response:", JSON.stringify(data));
        // Check status in multiple possible locations
        const rawStatus = (data.status || data.payment?.status || data.state || "").toString().toLowerCase();
        if (!["completed", "paid", "settled", "succeeded", "complete"].includes(rawStatus)) {
          console.log("[donate/complete] Payment not confirmed. rawStatus:", rawStatus);
          return res.status(400).json({ error: "Payment not yet confirmed", debug_status: rawStatus });
        }
      } else {
        const errText = await lexeRes.text().catch(() => "");
        console.error("[donate/complete] Lexe returned non-OK:", lexeRes.status, errText);
        return res.status(502).json({ error: "Could not verify payment" });
      }
    } catch (verifyErr: any) {
      console.error("[donate/complete] Verification error:", verifyErr.message);
      return res.status(502).json({ error: "Could not verify payment" });
    }

    try {
      const donation = await storage.createDonation(payment_index, amount_sats, cleanName, cleanMessage);
      return res.json({ success: true, donation });
    } catch (err: any) {
      // Duplicate payment_index means already saved — that's fine
      if (err.code === "23505") {
        return res.json({ success: true, already_saved: true });
      }
      console.error("[donate] Error saving donation:", err.message);
      return res.status(500).json({ error: "Failed to save donation" });
    }
  });

  // --- Get donation wall ---
  app.get("/api/donate/wall", async (_req: Request, res: Response) => {
    try {
      const donations = await storage.getRecentDonations(100);
      return res.json({ donations });
    } catch (err: any) {
      console.error("[donate] Error fetching donation wall:", err.message);
      return res.status(500).json({ error: "Failed to load donations" });
    }
  });

  // --- Bitcoin Node Terminal ---

  const nodeLimiter = new RateLimiter(30, 10_000);

  app.get("/api/node/status", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const bypass = canBypassNodeLimiter(req);
    if (!bypass && !nodeLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    if (bypass) {
      nodeManager.noteLimiterBypass();
    }
    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const provision = req.query.provision === "true";
      if (provision) {
        try {
          await nodeManager.getOrCreate(user.id);
          return res.json({ running: true });
        } catch (err: any) {
          const status = err.message?.includes("busy") ? 503 : 500;
          return res.status(status).json({ error: err.message });
        }
      }

      const status = nodeManager.getStatus(user.id);
      return res.json(status);
    } catch (err: any) {
      console.error("[node] Status error:", err.message);
      return res.status(500).json({ error: "Failed to get node status" });
    }
  });

  app.post("/api/node/exec", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const bypass = canBypassNodeLimiter(req);
    if (!bypass && !nodeLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    if (bypass) {
      nodeManager.noteLimiterBypass();
    }

    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { command } = req.body;
      if (!command || typeof command !== "string" || command.length > 2000) {
        return res.status(400).json({ error: "Invalid command" });
      }

      const result = await nodeManager.exec(user.id, command);
      return res.json(result);
    } catch (err: any) {
      const status = err.message?.includes("busy") ? 503 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  app.post("/api/node/rpc", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const bypass = canBypassNodeLimiter(req);
    if (!bypass && !nodeLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }
    if (bypass) {
      nodeManager.noteLimiterBypass();
    }

    try {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { method, params } = req.body;
      if (!method || typeof method !== "string") {
        return res.status(400).json({ error: "Invalid method" });
      }
      if (params !== undefined && !Array.isArray(params)) {
        return res.status(400).json({ error: "params must be an array" });
      }

      const result = await nodeManager.rpc(user.id, method, params || []);
      return res.json({ result });
    } catch (err: any) {
      const status = err.message?.includes("busy") ? 503 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // Start node cleanup and pre-download binary
  nodeManager.startCleanup();
  nodeManager.ensureBitcoindBinary().catch((err) => {
    console.log("[node] Binary pre-download deferred:", err.message);
  });

  // ── Feedback ────────────────────────────────────────────────────────────

  async function createGithubIssue(record: Feedback) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_FEEDBACK_REPO || "Beige-Coffee/pl-website";
    if (!token) {
      console.log("[feedback] No GITHUB_TOKEN set, skipping issue creation");
      return;
    }

    const [owner, repoName] = repo.split("/");

    const categoryLabels: Record<string, string> = {
      bug: "bug", confusing: "content", suggestion: "enhancement", other: "feedback",
    };
    const categoryTitles: Record<string, string> = {
      bug: "Bug Report", confusing: "Confusing Content", suggestion: "Suggestion", other: "Feedback",
    };

    const title = `[${categoryTitles[record.category] || "Feedback"}] ${record.message.slice(0, 80)}${record.message.length > 80 ? "..." : ""}`;

    const body = [
      `### Category\n${record.category}`,
      `### Message\n${record.message}`,
      `### Context`,
      `- **Page:** ${record.pageUrl}`,
      `- **Chapter:** ${record.chapterTitle || "N/A"}`,
      `- **Exercise:** ${record.exerciseId || "N/A"}`,
      `- **User Agent:** ${record.userAgent || "N/A"}`,
      `- **User ID:** ${record.userId || "Anonymous"}`,
      `- **Feedback ID:** ${record.id}`,
    ].join("\n");

    const labels = ["feedback"];
    const catLabel = categoryLabels[record.category];
    if (catLabel) labels.push(catLabel);

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ title, body, labels }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json() as { html_url: string };
        await storage.setFeedbackGithubUrl(record.id, data.html_url);
        console.log(`[feedback] GitHub issue created: ${data.html_url}`);
      } else {
        console.error(`[feedback] GitHub API error ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      console.error("[feedback] GitHub request failed:", err);
    }
  }

  app.post("/api/feedback", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!feedbackLimiter.check(ip)) {
      return res.status(429).json({ error: "Too many feedback submissions. Try again in a few minutes." });
    }

    try {
      const { category, message, pageUrl, chapterTitle, exerciseId, userAgent } = req.body;

      if (!category || !message || !pageUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      if (typeof category !== "string" || typeof message !== "string" || typeof pageUrl !== "string") {
        return res.status(400).json({ error: "Invalid field types" });
      }

      const validCategories = ["bug", "confusing", "suggestion", "other"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      if (message.length > 5000) {
        return res.status(400).json({ error: "Message too long (max 5000 chars)" });
      }

      const user = await getAuthUser(req);

      const record = await storage.createFeedback({
        userId: user?.id ?? null,
        category,
        message,
        pageUrl,
        chapterTitle: typeof chapterTitle === "string" ? chapterTitle.slice(0, 200) : null,
        exerciseId: typeof exerciseId === "string" ? exerciseId.slice(0, 100) : null,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
      });

      createGithubIssue(record).catch((err) => {
        console.error("[feedback] GitHub issue creation failed:", err);
      });

      res.json({ success: true, id: record.id });
    } catch (err) {
      console.error("Feedback submission error:", err);
      res.status(500).json({ error: "Failed to submit feedback" });
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
