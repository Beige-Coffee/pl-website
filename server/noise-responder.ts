/**
 * BOLT 8 Noise XK Responder
 *
 * Implements the responder side of the Noise_XK_secp256k1_ChaChaPoly_SHA256
 * handshake protocol used by the Lightning Network (BOLT 8).
 *
 * The XK pattern means:
 *   X = Initiator's static key is transmitted (encrypted) during handshake
 *   K = Responder's static key is known to the initiator before handshake
 */

import crypto from "node:crypto";
import { getPublicKey } from "@noble/secp256k1";
import {
  bolt8ECDH,
  hkdfTwoKeys,
  chachaEncrypt,
  chachaDecrypt,
  isValidPublicKey,
  concat,
  hex,
  sha256,
} from "./noise-crypto";

// ─── Error Classes ──────────────────────────────────────────────────────────

export class NoiseHandshakeError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
    this.name = "NoiseHandshakeError";
  }
}

// ─── Handshake State ────────────────────────────────────────────────────────

type HandshakeState = "initialized" | "act1_done" | "act2_done" | "complete";

// ─── Cipher State (for transport phase) ─────────────────────────────────────

class CipherState {
  private key: Uint8Array;
  private nonce: number = 0;
  private ck: Uint8Array;

  constructor(key: Uint8Array, ck: Uint8Array) {
    this.key = Uint8Array.from(key);
    this.ck = Uint8Array.from(ck);
  }

  encrypt(plaintext: Uint8Array): Uint8Array {
    const ct = chachaEncrypt(
      this.key,
      this.nonce,
      new Uint8Array(0),
      plaintext
    );
    this.nonce++;
    this.maybeRotate();
    return ct;
  }

  decrypt(ciphertextWithTag: Uint8Array): Uint8Array {
    const pt = chachaDecrypt(
      this.key,
      this.nonce,
      new Uint8Array(0),
      ciphertextWithTag
    );
    this.nonce++;
    this.maybeRotate();
    return pt;
  }

  private maybeRotate(): void {
    if (this.nonce >= 1000) {
      const [newCk, newKey] = hkdfTwoKeys(this.ck, this.key);
      this.ck = newCk;
      this.key = newKey;
      this.nonce = 0;
    }
  }
}

// ─── NoiseResponder ─────────────────────────────────────────────────────────

export class NoiseResponder {
  // Responder's static keypair
  private readonly staticPrivkey: Uint8Array;
  private readonly staticPubkey: Uint8Array;

  // Handshake state
  private h!: Uint8Array;
  private ck!: Uint8Array;
  private state: HandshakeState = "initialized";

  // Ephemeral keys (generated in Act 2)
  private ephemeralPrivkey!: Uint8Array;
  private ephemeralPubkey!: Uint8Array;

  // Initiator's ephemeral pubkey (received in Act 1)
  private initiatorEphemeralPubkey!: Uint8Array;

  // Temp keys for handshake
  private tempK2!: Uint8Array;

  // Initiator's static pubkey (decrypted from Act 3)
  private _initiatorStaticPubkey!: Uint8Array;

  // Transport cipher states
  private sendCipher!: CipherState;
  private recvCipher!: CipherState;

  // Transport keys (exposed for testing)
  private _sendKey!: Uint8Array;
  private _recvKey!: Uint8Array;

  constructor(
    staticPrivkey: Uint8Array,
    ephemeralPrivkey?: Uint8Array
  ) {
    this.staticPrivkey = Uint8Array.from(staticPrivkey);
    this.staticPubkey = getPublicKey(this.staticPrivkey, true);

    // Allow injecting ephemeral key for test vector reproducibility
    if (ephemeralPrivkey) {
      this.ephemeralPrivkey = Uint8Array.from(ephemeralPrivkey);
      this.ephemeralPubkey = getPublicKey(this.ephemeralPrivkey, true);
    }

    this.initState();
  }

  /**
   * Initialize the Noise handshake state.
   *
   * h = SHA256("Noise_XK_secp256k1_ChaChaPoly_SHA256")
   * ck = h
   * h = SHA256(h || "lightning")        -- mix prologue
   * h = SHA256(h || responder_static_pubkey)  -- responder key is Known
   */
  private initState(): void {
    const protocolName = new TextEncoder().encode(
      "Noise_XK_secp256k1_ChaChaPoly_SHA256"
    );
    this.ck = sha256(protocolName);
    this.h = Uint8Array.from(this.ck);

    // Mix prologue ("lightning")
    const prologue = new TextEncoder().encode("lightning");
    this.h = sha256(concat(this.h, prologue));

    // Mix responder's static pubkey (it's Known to both sides)
    this.h = sha256(concat(this.h, this.staticPubkey));
  }

  // ─── Act 1: Process 50 bytes from initiator ─────────────────────────────

  /**
   * Process Act 1 message from the initiator (50 bytes).
   *
   * Format: version(1) || initiator_ephemeral_pubkey(33) || tag(16)
   *
   * @throws NoiseHandshakeError with appropriate error code
   */
  processAct1(act1Message: Uint8Array): void {
    if (this.state !== "initialized") {
      throw new NoiseHandshakeError(
        "Act 1: unexpected state",
        4001
      );
    }

    if (act1Message.length !== 50) {
      throw new NoiseHandshakeError(
        "Act 1: message must be 50 bytes",
        4001
      );
    }

    // Parse
    const version = act1Message[0];
    const iePub = act1Message.slice(1, 34);
    const tag = act1Message.slice(34, 50);

    // Validate version
    if (version !== 0x00) {
      throw new NoiseHandshakeError(
        "Act 1: invalid version byte",
        4001
      );
    }

    // Validate ephemeral pubkey
    if (!isValidPublicKey(iePub)) {
      throw new NoiseHandshakeError(
        "Act 1: invalid ephemeral public key (not on curve)",
        4002
      );
    }

    this.initiatorEphemeralPubkey = iePub;

    // MixHash(initiator_ephemeral_pubkey)
    this.h = sha256(concat(this.h, iePub));

    // es = ECDH(responder_static_privkey, initiator_ephemeral_pubkey)
    const es = bolt8ECDH(this.staticPrivkey, iePub);

    // MixKey(es): [ck, temp_k1] = HKDF(ck, es)
    let tempK1: Uint8Array;
    [this.ck, tempK1] = hkdfTwoKeys(this.ck, es);

    // Decrypt tag: verify MAC over empty payload
    try {
      chachaDecrypt(tempK1, 0, this.h, tag);
    } catch {
      throw new NoiseHandshakeError(
        "Act 1: MAC verification failed",
        4003
      );
    }

    // MixHash(tag) -- mix the ciphertext (16-byte tag)
    this.h = sha256(concat(this.h, tag));

    this.state = "act1_done";
  }

  // ─── Act 2: Generate 50 bytes for initiator ──────────────────────────────

  /**
   * Generate Act 2 message for the initiator (50 bytes).
   *
   * Format: version(1) || responder_ephemeral_pubkey(33) || tag(16)
   */
  generateAct2(): Uint8Array {
    if (this.state !== "act1_done") {
      throw new NoiseHandshakeError(
        "Act 2: must process Act 1 first",
        4001
      );
    }

    // Generate ephemeral keypair if not injected (test vectors)
    if (!this.ephemeralPrivkey) {
      this.ephemeralPrivkey = crypto.randomBytes(32);
      this.ephemeralPubkey = getPublicKey(this.ephemeralPrivkey, true);
    }

    // MixHash(responder_ephemeral_pubkey)
    this.h = sha256(concat(this.h, this.ephemeralPubkey));

    // ee = ECDH(responder_ephemeral_privkey, initiator_ephemeral_pubkey)
    const ee = bolt8ECDH(
      this.ephemeralPrivkey,
      this.initiatorEphemeralPubkey
    );

    // MixKey(ee): [ck, temp_k2] = HKDF(ck, ee)
    [this.ck, this.tempK2] = hkdfTwoKeys(this.ck, ee);

    // Encrypt empty payload
    const tag = chachaEncrypt(
      this.tempK2,
      0,
      this.h,
      new Uint8Array(0)
    );

    // MixHash(tag)
    this.h = sha256(concat(this.h, tag));

    this.state = "act2_done";

    // Return: 0x00 || responder_ephemeral_pubkey || tag
    return concat(
      Uint8Array.from([0x00]),
      this.ephemeralPubkey,
      tag
    );
  }

  // ─── Act 3: Process 66 bytes from initiator ─────────────────────────────

  /**
   * Process Act 3 message from the initiator (66 bytes).
   *
   * Format: version(1) || encrypted_static_and_tag(49) || final_tag(16)
   *
   * After this, the handshake is complete and transport keys are derived.
   */
  processAct3(act3Message: Uint8Array): void {
    if (this.state !== "act2_done") {
      throw new NoiseHandshakeError(
        "Act 3: must generate Act 2 first",
        4004
      );
    }

    if (act3Message.length !== 66) {
      throw new NoiseHandshakeError(
        "Act 3: message must be 66 bytes",
        4004
      );
    }

    // Parse
    const version = act3Message[0];
    const encryptedStaticAndTag = act3Message.slice(1, 50);
    const finalTag = act3Message.slice(50, 66);

    // Validate version
    if (version !== 0x00) {
      throw new NoiseHandshakeError(
        "Act 3: invalid version byte",
        4004
      );
    }

    // Decrypt initiator's static pubkey
    // Uses temp_k2 with nonce=1 (nonce=0 was used for Act 2's empty payload)
    let initiatorStaticPub: Uint8Array;
    try {
      initiatorStaticPub = chachaDecrypt(
        this.tempK2,
        1,
        this.h,
        encryptedStaticAndTag
      );
    } catch {
      throw new NoiseHandshakeError(
        "Act 3: failed to decrypt initiator static key",
        4005
      );
    }

    // Validate decrypted pubkey
    if (!isValidPublicKey(initiatorStaticPub)) {
      throw new NoiseHandshakeError(
        "Act 3: failed to decrypt initiator static key",
        4005
      );
    }

    this._initiatorStaticPubkey = initiatorStaticPub;

    // MixHash(encrypted_static_and_tag) -- the ciphertext, 49 bytes
    this.h = sha256(concat(this.h, encryptedStaticAndTag));

    // se = ECDH(responder_ephemeral_privkey, initiator_static_pubkey)
    const se = bolt8ECDH(this.ephemeralPrivkey, initiatorStaticPub);

    // MixKey(se): [ck, temp_k3] = HKDF(ck, se)
    let tempK3: Uint8Array;
    [this.ck, tempK3] = hkdfTwoKeys(this.ck, se);

    // Decrypt final tag: verify MAC over empty payload
    try {
      chachaDecrypt(tempK3, 0, this.h, finalTag);
    } catch {
      throw new NoiseHandshakeError(
        "Act 3: MAC verification failed",
        4006
      );
    }

    // MixHash(final_tag)
    this.h = sha256(concat(this.h, finalTag));

    // Derive transport keys: Split()
    // [sk, rk] = HKDF(ck, "")
    // Per BOLT 8: sk encrypts initiator→responder, rk encrypts responder→initiator
    // For RESPONDER: recv with sk (first output), send with rk (second output)
    const [sk, rk] = hkdfTwoKeys(this.ck, new Uint8Array(0));
    this._sendKey = Uint8Array.from(rk);
    this._recvKey = Uint8Array.from(sk);

    // Create cipher states for transport
    this.sendCipher = new CipherState(rk, this.ck);
    this.recvCipher = new CipherState(sk, this.ck);

    this.state = "complete";
  }

  // ─── Transport Phase ──────────────────────────────────────────────────────

  /**
   * Encrypt a message for transport.
   *
   * BOLT 8 message format:
   *   encrypted_length(18) = encrypt(2-byte BE length, nonce N) + 16-byte tag
   *   encrypted_body(len+16) = encrypt(body, nonce N+1) + 16-byte tag
   */
  encryptMessage(plaintext: string): Uint8Array {
    if (this.state !== "complete") {
      throw new Error("Handshake not complete");
    }

    const body = new TextEncoder().encode(plaintext);

    // Encrypt 2-byte big-endian length prefix
    const lenBytes = new Uint8Array(2);
    lenBytes[0] = (body.length >> 8) & 0xff;
    lenBytes[1] = body.length & 0xff;
    const encLen = this.sendCipher.encrypt(lenBytes);

    // Encrypt body
    const encBody = this.sendCipher.encrypt(body);

    return concat(encLen, encBody);
  }

  /**
   * Decrypt a transport message.
   *
   * Expects: encrypted_length(18) || encrypted_body(len+16)
   */
  decryptMessage(ciphertext: Uint8Array): string {
    if (this.state !== "complete") {
      throw new Error("Handshake not complete");
    }

    if (ciphertext.length < 18) {
      throw new Error("Message too short");
    }

    // Decrypt length prefix (2 bytes + 16-byte tag = 18 bytes)
    const encLen = ciphertext.slice(0, 18);
    const lenBytes = this.recvCipher.decrypt(encLen);

    const bodyLen = (lenBytes[0] << 8) | lenBytes[1];
    const expectedTotal = 18 + bodyLen + 16;

    if (ciphertext.length < expectedTotal) {
      throw new Error(
        `Message truncated: expected ${expectedTotal} bytes, got ${ciphertext.length}`
      );
    }

    // Decrypt body
    const encBody = ciphertext.slice(18, expectedTotal);
    const body = this.recvCipher.decrypt(encBody);

    return new TextDecoder().decode(body);
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  get sendKey(): Uint8Array {
    if (this.state !== "complete") {
      throw new Error("Handshake not complete");
    }
    return this._sendKey;
  }

  get recvKey(): Uint8Array {
    if (this.state !== "complete") {
      throw new Error("Handshake not complete");
    }
    return this._recvKey;
  }

  get initiatorStaticPubkey(): Uint8Array {
    if (this.state !== "complete") {
      throw new Error("Handshake not complete");
    }
    return this._initiatorStaticPubkey;
  }

  get handshakeComplete(): boolean {
    return this.state === "complete";
  }
}
