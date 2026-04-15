/**
 * WebSocket integration for the BOLT 8 Noise handshake.
 *
 * Manages WebSocket connections at /ws/noise-handshake, performing the
 * three-act Noise XK handshake and then entering encrypted transport mode.
 */

import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "node:crypto";
import { getPublicKey, signAsync } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { NoiseResponder, NoiseHandshakeError } from "./noise-responder";
import { hex } from "./noise-crypto";
import { log } from "./app";

// ─── Rate Limiter ───────────────────────────────────────────────────────────

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
    for (const [key, timestamps] of Array.from(this.attempts.entries())) {
      const recent = timestamps.filter((t: number) => now - t < this.windowMs);
      if (recent.length === 0) this.attempts.delete(key);
      else this.attempts.set(key, recent);
    }
  }
}

const wsLimiter = new RateLimiter(10, 60_000);

// ─── Server Private Key ────────────────────────────────────────────────────

let serverPrivkey: Uint8Array;

function getServerPrivkey(): Uint8Array {
  if (serverPrivkey) return serverPrivkey;

  const envKey = process.env.NOISE_SERVER_PRIVKEY;
  if (envKey) {
    serverPrivkey = Uint8Array.from(Buffer.from(envKey, "hex"));
    log(
      `[noise] Using server private key from NOISE_SERVER_PRIVKEY env var`,
      "noise"
    );
  } else {
    // Generate a deterministic dev key from a fixed seed so it stays
    // consistent across restarts during local development
    serverPrivkey = crypto.createHash("sha256")
      .update("programming-lightning-noise-dev-key")
      .digest();
    const pubkey = getPublicKey(serverPrivkey, true);
    log(
      `[noise] No NOISE_SERVER_PRIVKEY set. Using development key. Pubkey: ${hex(pubkey)}`,
      "noise"
    );
  }

  return serverPrivkey;
}

export function getServerPubkey(): Uint8Array {
  return getPublicKey(getServerPrivkey(), true);
}

// ─── Completion Token ──────────────────────────────────────────────────────

async function generateCompletionToken(
  studentPubkey: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  const message = studentPubkey + timestamp;
  const messageHash = sha256(new TextEncoder().encode(message));

  // Sign with server's static privkey (use prehash: false since we already hashed)
  const signature = await signAsync(messageHash, getServerPrivkey(), {
    prehash: false,
  });

  return JSON.stringify({
    studentPubkey,
    timestamp,
    signature: hex(signature),
  });
}

// ─── Client IP extraction ──────────────────────────────────────────────────

function getClientIp(req: IncomingMessage): string {
  // Check x-forwarded-for first (behind reverse proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

// ─── WebSocket Setup ────────────────────────────────────────────────────────

export function setupNoiseWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname !== "/ws/noise-handshake") {
      // Not our endpoint; let other upgrade handlers have it or destroy
      socket.destroy();
      return;
    }

    const ip = getClientIp(req);
    if (!wsLimiter.check(ip)) {
      log(`[noise] Rate limited: ${ip}`, "noise");
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const ip = getClientIp(req);
    log(`[noise] New WebSocket connection from ${ip}`, "noise");

    const responder = new NoiseResponder(getServerPrivkey());
    let handshakeComplete = false;
    let handshakeStep: "awaiting_act1" | "awaiting_act3" | "transport" =
      "awaiting_act1";
    let firstMessageSent = false;

    // 30-second handshake timeout
    const handshakeTimeout = setTimeout(() => {
      if (!handshakeComplete) {
        log(`[noise] Handshake timeout for ${ip}`, "noise");
        ws.close(4007, "Handshake timeout");
      }
    }, 30_000);

    ws.on("message", async (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        // Convert to Uint8Array
        let bytes: Uint8Array;
        if (data instanceof Buffer) {
          bytes = Uint8Array.from(data);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (Array.isArray(data)) {
          bytes = Uint8Array.from(Buffer.concat(data));
        } else {
          ws.close(4001, "Invalid message format");
          return;
        }

        if (handshakeStep === "awaiting_act1") {
          // ─── Process Act 1, generate and send Act 2 ─────────────

          try {
            responder.processAct1(bytes);
          } catch (err) {
            if (err instanceof NoiseHandshakeError) {
              ws.close(err.code, err.message);
            } else {
              ws.close(4001, "Act 1: processing failed");
            }
            return;
          }

          let act2: Uint8Array;
          try {
            act2 = responder.generateAct2();
          } catch (err) {
            ws.close(4001, "Act 2: generation failed");
            return;
          }

          ws.send(act2);
          handshakeStep = "awaiting_act3";
        } else if (handshakeStep === "awaiting_act3") {
          // ─── Process Act 3 ──────────────────────────────────────

          try {
            responder.processAct3(bytes);
          } catch (err) {
            if (err instanceof NoiseHandshakeError) {
              ws.close(err.code, err.message);
            } else {
              ws.close(4004, "Act 3: processing failed");
            }
            return;
          }

          handshakeComplete = true;
          clearTimeout(handshakeTimeout);
          handshakeStep = "transport";

          const studentPubkeyHex = hex(
            responder.initiatorStaticPubkey
          );
          log(
            `[noise] Handshake complete with student ${studentPubkeyHex.slice(0, 16)}...`,
            "noise"
          );

          // Send encrypted congratulations
          const congrats = responder.encryptMessage(
            "Handshake complete! You have established an encrypted channel using BOLT 8 Noise XK."
          );
          ws.send(congrats);
        } else {
          // ─── Transport mode ─────────────────────────────────────

          let plaintext: string;
          try {
            plaintext = responder.decryptMessage(bytes);
          } catch {
            ws.close(4008, "Transport: decryption failed");
            return;
          }

          // Generate and send completion token on first message
          if (!firstMessageSent) {
            firstMessageSent = true;
            const studentPubkeyHex = hex(
              responder.initiatorStaticPubkey
            );
            log(
              `[noise] First transport message from ${studentPubkeyHex.slice(0, 16)}...: "${plaintext}"`,
              "noise"
            );

            try {
              const token = await generateCompletionToken(
                studentPubkeyHex
              );
              const tokenMsg = responder.encryptMessage(
                `__completion_token__:${token}`
              );
              ws.send(tokenMsg);
            } catch (err) {
              log(
                `[noise] Failed to generate completion token: ${err}`,
                "noise"
              );
            }
          }

          // Generate response — real Lightning BOLT message types
          let response: string;
          const trimmed = plaintext.trim().toLowerCase();

          if (trimmed === "init") {
            // BOLT 1, type 16: Feature negotiation (first message after handshake)
            response = JSON.stringify({
              type: 16,
              message: "init",
              globalfeatures: "0x",
              // BOLT 9 feature bits (optional/odd variants):
              //   bit 1  = option_data_loss_protect
              //   bit 15 = option_static_remotekey
              //   bit 23 = option_anchors_zero_fee_htlc_tx
              // 0x808002 = (1<<1) | (1<<15) | (1<<23)
              features: "0x808002",
              features_supported: [
                "option_data_loss_protect (1)",
                "option_static_remotekey (15)",
                "option_anchors_zero_fee_htlc_tx (23)",
              ],
              tlv: { networks: ["mainnet (43497fd7f826)"] },
            }, null, 2);
          } else if (trimmed === "ping") {
            // BOLT 1, type 18/19: Keepalive — verifies bidirectional encryption
            response = JSON.stringify({
              type: 19,
              message: "pong",
              byteslen: 4,
            }, null, 2);
          } else if (trimmed === "node_announcement" || trimmed === "node_ann") {
            // BOLT 7, type 257: Gossip broadcast — no reply (fire-and-forget)
            log("Received node_announcement gossip (no reply)");
            return;
          } else if (trimmed === "channel_announcement" || trimmed === "channel_ann") {
            // BOLT 7, type 256: Gossip broadcast — no reply (fire-and-forget)
            log("Received channel_announcement gossip (no reply)");
            return;
          } else if (trimmed === "channel_update") {
            // BOLT 7, type 258: Gossip broadcast — no reply (fire-and-forget)
            log("Received channel_update gossip (no reply)");
            return;
          } else if (trimmed === "open_channel") {
            // BOLT 2, type 33: Accept channel parameters
            response = JSON.stringify({
              type: 33,
              message: "accept_channel",
              dust_limit_satoshis: 546,
              max_htlc_value_in_flight_msat: 100000000,
              channel_reserve_satoshis: 1000,
              minimum_depth: 3,
              to_self_delay: 144,
              max_accepted_htlcs: 30,
              funding_pubkey: hex(getServerPubkey()).slice(0, 32) + "...",
              note: "Ready to open channel. Send funding_created when your transaction is prepared.",
            }, null, 2);
          } else if (trimmed === "error") {
            // BOLT 1, type 17: Error / graceful close
            response = JSON.stringify({
              type: 17,
              message: "error",
              channel_id: "0".repeat(64),
              data: "Goodbye! Connection closing gracefully.",
            }, null, 2);
          } else {
            response = "echo: " + plaintext;
          }

          const encrypted = responder.encryptMessage(response);
          ws.send(encrypted);
        }
      } catch (err) {
        log(
          `[noise] Unexpected error: ${err instanceof Error ? err.message : err}`,
          "noise"
        );
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(
            1011,
            "Internal error"
          );
        }
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      clearTimeout(handshakeTimeout);
      log(
        `[noise] Connection closed: code=${code} reason="${reason.toString()}"`,
        "noise"
      );
    });

    ws.on("error", (err: Error) => {
      clearTimeout(handshakeTimeout);
      log(`[noise] WebSocket error: ${err.message}`, "noise");
    });
  });

  log("[noise] WebSocket server ready at /ws/noise-handshake", "noise");
}
