import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes, createHash } from "crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bech32 } from "bech32";
import QRCode from "qrcode";

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

export async function registerRoutes(app: Express): Promise<Server> {

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

      console.log("LNURL callback params:", { k1, sig: sig.substring(0, 20) + "...", key, sigLen: sig.length, keyLen: key.length });
      console.log("k1Bytes length:", k1Bytes.length, "sigBytes length:", sigBytes.length, "keyBytes length:", keyBytes.length);

      let isValid = false;
      try {
        const compactSig = derToCompact(sigBytes);
        console.log("Compact sig length:", compactSig.length);

        isValid = secp256k1.verify(compactSig, k1Bytes, keyBytes);
        console.log("Verify attempt 1 (compact, default):", isValid);

        if (!isValid) {
          const sigObj = secp256k1.Signature.fromBytes(compactSig);
          console.log("Has high S:", sigObj.hasHighS());
          if (sigObj.hasHighS()) {
            const normalized = sigObj.normalizeS().toBytes();
            isValid = secp256k1.verify(normalized, k1Bytes, keyBytes);
            console.log("Verify attempt 2 (normalized):", isValid);
          }
        }
      } catch (verifyErr) {
        console.error("Signature verification error:", verifyErr);
        isValid = false;
      }

      if (!isValid) {
        return res.json({ status: "ERROR", reason: "Invalid signature" });
      }

      const sessionToken = randomBytes(32).toString("hex");
      await storage.completeChallenge(k1, key, sessionToken);

      let user = await storage.getUserByPubkey(key);
      if (!user) {
        user = await storage.createUser({ pubkey: key });
      }

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
      });
    } catch (err) {
      console.error("Status check error:", err);
      return res.json({ authenticated: false });
    }
  });

  app.get("/api/lnauth/verify", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.json({ authenticated: false });
    }

    try {
      const [challenge] = await (await import("./storage")).db
        .select()
        .from((await import("@shared/schema")).lnAuthChallenges)
        .where(
          (await import("drizzle-orm")).eq(
            (await import("@shared/schema")).lnAuthChallenges.sessionToken,
            token
          )
        );

      if (!challenge || !challenge.pubkey) {
        return res.json({ authenticated: false });
      }

      const user = await storage.getUserByPubkey(challenge.pubkey);
      return res.json({
        authenticated: true,
        pubkey: challenge.pubkey,
        userId: user?.id,
        displayName: user?.displayName,
      });
    } catch {
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

function derToCompact(der: Uint8Array): Uint8Array {
  let pos = 0;
  if (der[pos++] !== 0x30) throw new Error("Not a DER sequence");
  pos++;
  if (der[pos++] !== 0x02) throw new Error("Expected integer tag for r");
  const rLen = der[pos++];
  let r = der.slice(pos, pos + rLen);
  pos += rLen;
  if (der[pos++] !== 0x02) throw new Error("Expected integer tag for s");
  const sLen = der[pos++];
  let s = der.slice(pos, pos + sLen);

  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);

  const compact = new Uint8Array(64);
  compact.set(r, 32 - r.length);
  compact.set(s, 64 - s.length);
  return compact;
}
