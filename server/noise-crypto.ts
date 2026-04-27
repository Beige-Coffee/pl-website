/**
 * BOLT 8 Noise Protocol Cryptographic Primitives
 *
 * Extracted from noise-compat-test.ts for use by the Noise responder
 * and any future Noise-related server code.
 */

import { getSharedSecret, getPublicKey, Point } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import crypto from "node:crypto";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function fromHex(h: string): Uint8Array {
  if (h.startsWith("0x")) h = h.slice(2);
  return Uint8Array.from(Buffer.from(h, "hex"));
}

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ─── BOLT 8 Primitives ─────────────────────────────────────────────────────

/**
 * BOLT 8 ECDH: multiply privkey * pubkey, compress result, SHA256 hash.
 */
export function bolt8ECDH(
  privKey: Uint8Array,
  pubKey: Uint8Array
): Uint8Array {
  const sharedPoint = getSharedSecret(privKey, pubKey, true);
  return sha256(sharedPoint);
}

/**
 * Noise Protocol HKDF: extract-then-expand, 2 x 32-byte outputs.
 *   Extract:  prk = HMAC-SHA256(salt, ikm)
 *   Expand 1: out1 = HMAC-SHA256(prk, 0x01)
 *   Expand 2: out2 = HMAC-SHA256(prk, out1 || 0x02)
 */
export function hkdfTwoKeys(
  salt: Uint8Array,
  ikm: Uint8Array
): [Uint8Array, Uint8Array] {
  const prk = hmac(sha256, salt, ikm);
  const out1 = hmac(sha256, prk, Uint8Array.from([0x01]));
  const out2Msg = new Uint8Array(out1.length + 1);
  out2Msg.set(out1);
  out2Msg[out1.length] = 0x02;
  const out2 = hmac(sha256, prk, out2Msg);
  return [out1, out2];
}

/**
 * ChaCha20-Poly1305 encrypt using BOLT 8 nonce format:
 *   12-byte nonce = 4 zero bytes + 8-byte little-endian counter
 */
export function chachaEncrypt(
  key: Uint8Array,
  nonce: number,
  ad: Uint8Array,
  plaintext: Uint8Array
): Uint8Array {
  const nonceBytes = Buffer.alloc(12);
  nonceBytes.writeUInt32LE(nonce, 4);

  const cipher = crypto.createCipheriv(
    "chacha20-poly1305",
    key,
    nonceBytes,
    { authTagLength: 16 } as any
  );
  cipher.setAAD(ad, { plaintextLength: plaintext.length });
  const encrypted = cipher.update(plaintext);
  cipher.final();
  const tag = cipher.getAuthTag();

  const result = new Uint8Array(encrypted.length + tag.length);
  result.set(encrypted);
  result.set(tag, encrypted.length);
  return result;
}

/**
 * ChaCha20-Poly1305 decrypt using BOLT 8 nonce format.
 */
export function chachaDecrypt(
  key: Uint8Array,
  nonce: number,
  ad: Uint8Array,
  ciphertextWithTag: Uint8Array
): Uint8Array {
  const nonceBytes = Buffer.alloc(12);
  nonceBytes.writeUInt32LE(nonce, 4);

  const ciphertext = ciphertextWithTag.slice(
    0,
    ciphertextWithTag.length - 16
  );
  const tag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);

  const decipher = crypto.createDecipheriv(
    "chacha20-poly1305",
    key,
    nonceBytes,
    { authTagLength: 16 } as any
  );
  decipher.setAAD(ad, { plaintextLength: ciphertext.length });
  decipher.setAuthTag(tag);
  const decrypted = decipher.update(ciphertext);
  decipher.final();
  return Uint8Array.from(decrypted);
}

/**
 * Validate that a byte array is a valid compressed secp256k1 public key.
 * Returns true if valid, false otherwise.
 */
export function isValidPublicKey(pubkey: Uint8Array): boolean {
  try {
    if (pubkey.length !== 33) return false;
    if (pubkey[0] !== 0x02 && pubkey[0] !== 0x03) return false;
    // Point.fromBytes will throw if the point is not on the curve
    Point.fromBytes(pubkey);
    return true;
  } catch {
    return false;
  }
}

// Re-export useful functions from noble
export { getPublicKey, sha256 };
