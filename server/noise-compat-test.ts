/**
 * BOLT 8 Transport Test Vectors - TypeScript Implementation
 *
 * Proves that @noble/secp256k1 + @noble/hashes + Node crypto produce
 * byte-identical outputs to the Python ecdsa + cryptography + hashlib stack
 * for all BOLT 8 cryptographic operations.
 *
 * Run: npx tsx server/noise-compat-test.ts
 */

import { getSharedSecret, getPublicKey } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import crypto from "node:crypto";

// ─── Helpers ────────────────────────────────────────────────────────────────

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function fromHex(h: string): Uint8Array {
  // Strip 0x prefix if present
  if (h.startsWith("0x")) h = h.slice(2);
  return Uint8Array.from(Buffer.from(h, "hex"));
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

function assertEqual(a: Uint8Array, b: Uint8Array, label: string): void {
  assert(
    hex(a) === hex(b),
    `${label}\n  expected: ${hex(b)}\n  got:      ${hex(a)}`
  );
}

// ─── BOLT 8 Primitives ─────────────────────────────────────────────────────

/**
 * BOLT 8 ECDH: multiply privkey * pubkey, compress result, SHA256 hash.
 */
function bolt8ECDH(privKey: Uint8Array, pubKey: Uint8Array): Uint8Array {
  // getSharedSecret with isCompressed=true returns 33-byte compressed point
  const sharedPoint = getSharedSecret(privKey, pubKey, true);
  return sha256(sharedPoint);
}

/**
 * Noise Protocol HKDF: extract-then-expand, 2 x 32-byte outputs.
 *   Extract:  prk = HMAC-SHA256(salt, ikm)
 *   Expand 1: out1 = HMAC-SHA256(prk, 0x01)
 *   Expand 2: out2 = HMAC-SHA256(prk, out1 || 0x02)
 */
function hkdfTwoKeys(
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
function chachaEncrypt(
  key: Uint8Array,
  nonce: number,
  ad: Uint8Array,
  plaintext: Uint8Array
): Uint8Array {
  const nonceBytes = Buffer.alloc(12);
  nonceBytes.writeUInt32LE(nonce, 4); // 4 zero bytes then LE counter

  const cipher = crypto.createCipheriv(
    "chacha20-poly1305",
    key,
    nonceBytes,
    { authTagLength: 16 } as any
  );
  cipher.setAAD(ad);
  const encrypted = cipher.update(plaintext);
  cipher.final();
  const tag = cipher.getAuthTag();

  // Return ciphertext + tag (AEAD standard)
  const result = new Uint8Array(encrypted.length + tag.length);
  result.set(encrypted);
  result.set(tag, encrypted.length);
  return result;
}

/**
 * ChaCha20-Poly1305 decrypt using BOLT 8 nonce format.
 */
function chachaDecrypt(
  key: Uint8Array,
  nonce: number,
  ad: Uint8Array,
  ciphertextWithTag: Uint8Array
): Uint8Array {
  const nonceBytes = Buffer.alloc(12);
  nonceBytes.writeUInt32LE(nonce, 4);

  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);
  const tag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);

  const decipher = crypto.createDecipheriv(
    "chacha20-poly1305",
    key,
    nonceBytes,
    { authTagLength: 16 } as any
  );
  decipher.setAAD(ad);
  decipher.setAuthTag(tag);
  const decrypted = decipher.update(ciphertext);
  decipher.final();
  return Uint8Array.from(decrypted);
}

// ─── BOLT 8 Test Vectors (Appendix A) ──────────────────────────────────────

// Initiator static key
const ls_priv = fromHex(
  "1111111111111111111111111111111111111111111111111111111111111111"
);
const ls_pub = getPublicKey(ls_priv, true);

// Responder static key
const rs_priv = fromHex(
  "2121212121212121212121212121212121212121212121212121212121212121"
);
const rs_pub = getPublicKey(rs_priv, true);

// Initiator ephemeral key
const ie_priv = fromHex(
  "1212121212121212121212121212121212121212121212121212121212121212"
);
const ie_pub = getPublicKey(ie_priv, true);

// Responder ephemeral key
const re_priv = fromHex(
  "2222222222222222222222222222222222222222222222222222222222222222"
);
const re_pub = getPublicKey(re_priv, true);

// ─── Test Suite ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

console.log("=== BOLT 8 Transport Test Vectors (TypeScript) ===\n");

// ─── 1. Public Key Derivation ───────────────────────────────────────────────

console.log("--- Public Key Derivation ---");

test("Initiator static pubkey matches BOLT 8 vector", () => {
  assertEqual(
    ls_pub,
    fromHex(
      "034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa"
    ),
    "ls.pub"
  );
});

test("Responder static pubkey matches BOLT 8 vector", () => {
  assertEqual(
    rs_pub,
    fromHex(
      "028d7500dd4c12685d1f568b4c2b5048e8534b873319f3a8daa612b469132ec7f7"
    ),
    "rs.pub"
  );
});

test("Initiator ephemeral pubkey matches BOLT 8 vector", () => {
  assertEqual(
    ie_pub,
    fromHex(
      "036360e856310ce5d294e8be33fc807077dc56ac80d95d9cd4ddbd21325eff73f7"
    ),
    "ie.pub"
  );
});

test("Responder ephemeral pubkey matches BOLT 8 vector", () => {
  assertEqual(
    re_pub,
    fromHex(
      "02466d7fcae563e5cb09a0d1870bb580344804617879a14949cf22285f1bae3f27"
    ),
    "re.pub"
  );
});

// ─── 2. ECDH Shared Secrets ────────────────────────────────────────────────

console.log("\n--- ECDH Shared Secrets ---");

test("ECDH(ie, rs) == es shared secret", () => {
  const ss = bolt8ECDH(ie_priv, rs_pub);
  assertEqual(
    ss,
    fromHex(
      "1e2fb3c8fe8fb9f262f649f64d26ecf0f2c0a805a767cf02dc2d77a6ef1fdcc3"
    ),
    "ss(es)"
  );
});

test("ECDH commutativity: ECDH(ie, rs) == ECDH(rs, ie)", () => {
  const ss1 = bolt8ECDH(ie_priv, rs_pub);
  const ss2 = bolt8ECDH(rs_priv, ie_pub);
  assertEqual(ss1, ss2, "ECDH commutativity (es)");
});

test("ECDH(ie, re) == ee shared secret", () => {
  const ss = bolt8ECDH(ie_priv, re_pub);
  assertEqual(
    ss,
    fromHex(
      "c06363d6cc549bcb7913dbb9ac1c33fc1158680c89e972000ecd06b36c472e47"
    ),
    "ss(ee)"
  );
});

test("ECDH(ls, re) == se shared secret", () => {
  const ss = bolt8ECDH(ls_priv, re_pub);
  assertEqual(
    ss,
    fromHex(
      "b36b6d195982c5be874d6d542dc268234379e1ae4ff1709402135b7de5cf0766"
    ),
    "ss(se)"
  );
});

// ─── 3. Full Handshake ──────────────────────────────────────────────────────

console.log("\n--- Full Handshake (Act 1 / Act 2 / Act 3) ---");

// Protocol name: "Noise_XK_secp256k1_ChaChaPoly_SHA256"
const protocolName = new TextEncoder().encode(
  "Noise_XK_secp256k1_ChaChaPoly_SHA256"
);
// Exactly 36 bytes, so h = SHA-256(protocolName), ck = h
let ck = sha256(protocolName);
let h = Uint8Array.from(ck);

// Mix prologue ("lightning")
const prologue = new TextEncoder().encode("lightning");
h = sha256(Uint8Array.from([...h, ...prologue]));

// Mix rs_pub into h (initiator knows responder's static key)
h = sha256(Uint8Array.from([...h, ...rs_pub]));

// ─── Act 1: Initiator -> Responder ──────────────────────────────────────────

console.log("\n  -- Act 1 --");

// MixHash(ie_pub)
h = sha256(Uint8Array.from([...h, ...ie_pub]));

test("Act 1: h after MixHash(ie_pub) matches BOLT 8 vector", () => {
  assertEqual(
    h,
    fromHex(
      "9e0e7de8bb75554f21db034633de04be41a2b8a18da7a319a03c803bf02b396c"
    ),
    "h after MixHash(ie_pub)"
  );
});

// ECDH(ie, rs) -> es
const ss_es = bolt8ECDH(ie_priv, rs_pub);

// MixKey(ss_es)
let temp_k1: Uint8Array;
[ck, temp_k1] = hkdfTwoKeys(ck, ss_es);

test("Act 1: ck matches BOLT 8 vector", () => {
  assertEqual(
    ck,
    fromHex(
      "b61ec1191326fa240decc9564369dbb3ae2b34341d1e11ad64ed89f89180582f"
    ),
    "ck after Act 1 MixKey"
  );
});

test("Act 1: temp_k1 matches BOLT 8 vector", () => {
  assertEqual(
    temp_k1,
    fromHex(
      "e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"
    ),
    "temp_k1"
  );
});

// Encrypt empty payload: c = encrypt(temp_k1, nonce=0, ad=h, pt="")
const c_act1 = chachaEncrypt(temp_k1, 0, h, new Uint8Array(0));

test("Act 1: encrypted tag matches BOLT 8 vector", () => {
  assertEqual(
    c_act1,
    fromHex("0df6086551151f58b8afe6c195782c6a"),
    "c(Act 1)"
  );
});

// MixHash(c)
h = sha256(Uint8Array.from([...h, ...c_act1]));

test("Act 1: h after MixHash matches BOLT 8 vector", () => {
  assertEqual(
    h,
    fromHex(
      "9d1ffbb639e7e20021d9259491dc7b160aab270fb1339ef135053f6f2cebe9ce"
    ),
    "h after Act 1"
  );
});

// Full Act 1 message: version(0x00) + ie_pub(33) + c(16) = 50 bytes
const act1_msg = Uint8Array.from([0x00, ...ie_pub, ...c_act1]);

test("Act 1: full message matches BOLT 8 vector (50 bytes)", () => {
  assertEqual(
    act1_msg,
    fromHex(
      "00036360e856310ce5d294e8be33fc807077dc56ac80d95d9cd4ddbd21325eff73f70df6086551151f58b8afe6c195782c6a"
    ),
    "Act 1 message"
  );
  assert(act1_msg.length === 50, `Act 1 must be 50 bytes, got ${act1_msg.length}`);
});

// ─── Act 2: Responder -> Initiator ──────────────────────────────────────────

console.log("\n  -- Act 2 --");

// Responder side: re-derive state from Act 1
// (We continue from initiator state after receiving Act 2)

// MixHash(re_pub)
h = sha256(Uint8Array.from([...h, ...re_pub]));

test("Act 2: h after MixHash(re_pub) matches BOLT 8 vector", () => {
  assertEqual(
    h,
    fromHex(
      "38122f669819f906000621a14071802f93f2ef97df100097bcac3ae76c6dc0bf"
    ),
    "h after MixHash(re_pub)"
  );
});

// ECDH(ie, re) -> ee
const ss_ee = bolt8ECDH(ie_priv, re_pub);

test("Act 2: ee shared secret matches BOLT 8 vector", () => {
  assertEqual(
    ss_ee,
    fromHex(
      "c06363d6cc549bcb7913dbb9ac1c33fc1158680c89e972000ecd06b36c472e47"
    ),
    "ss(ee)"
  );
});

// MixKey(ss_ee)
let temp_k2: Uint8Array;
[ck, temp_k2] = hkdfTwoKeys(ck, ss_ee);

test("Act 2: ck matches BOLT 8 vector", () => {
  assertEqual(
    ck,
    fromHex(
      "e89d31033a1b6bf68c07d22e08ea4d7884646c4b60a9528598ccb4ee2c8f56ba"
    ),
    "ck after Act 2 MixKey"
  );
});

test("Act 2: temp_k2 matches BOLT 8 vector", () => {
  assertEqual(
    temp_k2,
    fromHex(
      "908b166535c01a935cf1e130a5fe895ab4e6f3ef8855d87e9b7581c4ab663ddc"
    ),
    "temp_k2"
  );
});

// Encrypt empty payload: c = encrypt(temp_k2, nonce=0, ad=h, pt="")
const c_act2 = chachaEncrypt(temp_k2, 0, h, new Uint8Array(0));

// MixHash(c)
h = sha256(Uint8Array.from([...h, ...c_act2]));

test("Act 2: h after MixHash matches BOLT 8 vector", () => {
  assertEqual(
    h,
    fromHex(
      "90578e247e98674e661013da3c5c1ca6a8c8f48c90b485c0dfa1494e23d56d72"
    ),
    "h after Act 2"
  );
});

// Full Act 2 message: version(0x00) + re_pub(33) + c(16) = 50 bytes
const act2_msg = Uint8Array.from([0x00, ...re_pub, ...c_act2]);

test("Act 2: full message matches BOLT 8 vector (50 bytes)", () => {
  assertEqual(
    act2_msg,
    fromHex(
      "0002466d7fcae563e5cb09a0d1870bb580344804617879a14949cf22285f1bae3f276e2470b93aac583c9ef6eafca3f730ae"
    ),
    "Act 2 message"
  );
  assert(act2_msg.length === 50, `Act 2 must be 50 bytes, got ${act2_msg.length}`);
});

// ─── Act 3: Initiator -> Responder ──────────────────────────────────────────

console.log("\n  -- Act 3 --");

// Encrypt initiator's static pubkey: c1 = encrypt(temp_k2, nonce=1, ad=h, pt=ls_pub)
const c1_act3 = chachaEncrypt(temp_k2, 1, h, ls_pub);

test("Act 3: encrypted static key matches BOLT 8 vector", () => {
  assertEqual(
    c1_act3,
    fromHex(
      "b9e3a702e93e3a9948c2ed6e5fd7590a6e1c3a0344cfc9d5b57357049aa22355361aa02e55a8fc28fef5bd6d71ad0c3822"
    ),
    "c1(Act 3)"
  );
});

// MixHash(c1)
h = sha256(Uint8Array.from([...h, ...c1_act3]));

test("Act 3: h after MixHash(c1) matches BOLT 8 vector", () => {
  assertEqual(
    h,
    fromHex(
      "5dcb5ea9b4ccc755e0e3456af3990641276e1d5dc9afd82f974d90a47c918660"
    ),
    "h after Act 3 MixHash(c1)"
  );
});

// ECDH(ls, re) -> se
const ss_se = bolt8ECDH(ls_priv, re_pub);

test("Act 3: se shared secret matches BOLT 8 vector", () => {
  assertEqual(
    ss_se,
    fromHex(
      "b36b6d195982c5be874d6d542dc268234379e1ae4ff1709402135b7de5cf0766"
    ),
    "ss(se)"
  );
});

// MixKey(ss_se)
let temp_k3: Uint8Array;
[ck, temp_k3] = hkdfTwoKeys(ck, ss_se);

test("Act 3: ck matches BOLT 8 vector", () => {
  assertEqual(
    ck,
    fromHex(
      "919219dbb2920afa8db80f9a51787a840bcf111ed8d588caf9ab4be716e42b01"
    ),
    "ck after Act 3 MixKey"
  );
});

test("Act 3: temp_k3 matches BOLT 8 vector", () => {
  assertEqual(
    temp_k3,
    fromHex(
      "981a46c820fb7a241bc8184ba4bb1f01bcdfafb00dde80098cb8c38db9141520"
    ),
    "temp_k3"
  );
});

// Encrypt empty payload (auth tag): t = encrypt(temp_k3, nonce=0, ad=h, pt="")
const t_act3 = chachaEncrypt(temp_k3, 0, h, new Uint8Array(0));

test("Act 3: auth tag matches BOLT 8 vector", () => {
  assertEqual(
    t_act3,
    fromHex("8dc68b1c466263b47fdf31e560e139ba"),
    "t(Act 3)"
  );
});

// Full Act 3 message: version(0x00) + c1(49) + t(16) = 66 bytes
const act3_msg = Uint8Array.from([0x00, ...c1_act3, ...t_act3]);

test("Act 3: full message matches BOLT 8 vector (66 bytes)", () => {
  assertEqual(
    act3_msg,
    fromHex(
      "00b9e3a702e93e3a9948c2ed6e5fd7590a6e1c3a0344cfc9d5b57357049aa22355361aa02e55a8fc28fef5bd6d71ad0c38228dc68b1c466263b47fdf31e560e139ba"
    ),
    "Act 3 message"
  );
  assert(act3_msg.length === 66, `Act 3 must be 66 bytes, got ${act3_msg.length}`);
});

// ─── 4. Transport Keys (Split) ─────────────────────────────────────────────

console.log("\n--- Transport Keys (Split) ---");

const [sk, rk] = hkdfTwoKeys(ck, new Uint8Array(0));

test("Send key (sk) matches BOLT 8 vector", () => {
  assertEqual(
    sk,
    fromHex(
      "969ab31b4d288cedf6218839b27a3e2140827047f2c0f01bf5c04435d43511a9"
    ),
    "sk"
  );
});

test("Receive key (rk) matches BOLT 8 vector", () => {
  assertEqual(
    rk,
    fromHex(
      "bb9020b8965f4df047e07f955f3c4b88418984aadc5cdb35096b9ea8fa5c3442"
    ),
    "rk"
  );
});

// ─── 5. Message Encryption Test Vectors ─────────────────────────────────────

console.log("\n--- Message Encryption (Transport Phase) ---");

// Encrypt 1002 "hello" messages and check specific outputs
const hello = new TextEncoder().encode("hello");
let sendCk = Uint8Array.from(ck); // chaining key for key rotation
let sendKey = Uint8Array.from(sk);
let sn = 0; // send nonce

function encryptMessage(
  plaintext: Uint8Array
): Uint8Array {
  // Encrypt length prefix (2 bytes, big-endian)
  const lenBytes = new Uint8Array(2);
  lenBytes[0] = (plaintext.length >> 8) & 0xff;
  lenBytes[1] = plaintext.length & 0xff;

  const encLen = chachaEncrypt(sendKey, sn, new Uint8Array(0), lenBytes);
  sn++;

  // Encrypt body
  const encBody = chachaEncrypt(sendKey, sn, new Uint8Array(0), plaintext);
  sn++;

  // Key rotation at nonce 1000
  if (sn >= 1000) {
    [sendCk, sendKey] = hkdfTwoKeys(sendCk, sendKey);
    sn = 0;
  }

  // Return encLen + encBody
  const result = new Uint8Array(encLen.length + encBody.length);
  result.set(encLen);
  result.set(encBody, encLen.length);
  return result;
}

// Expected outputs at specific message indices
const expectedOutputs: { [key: number]: string } = {
  0: "cf2b30ddf0cf3f80e7c35a6e6730b59fe802473180f396d88a8fb0db8cbcf25d2f214cf9ea1d95",
  1: "72887022101f0b6753e0c7de21657d35a4cb2a1f5cde2650528bbc8f837d0f0d7ad833b1a256a1",
  500: "178cb9d7387190fa34db9c2d50027d21793c9bc2d40b1e14dcf30ebeeeb220f48364f7a4c68bf8",
  501: "1b186c57d44eb6de4c057c49940d79bb838a145cb528d6e8fd26dbe50a60ca2c104b56b60e45bd",
  1000: "4a2f3cc3b5e78ddb83dcb426d9863d9d9a723b0337c89dd0b005d89f8d3c05c52b76b29b740f09",
  1001: "2ecd8c8a5629d0d02ab457a0fdd0f7b90a192cd46be5ecb6ca570bfc5e268338b1a16cf4ef2d36",
};

// Key rotation expected values
const expectedRotation1Ck =
  "cc2c6e467efc8067720c2d09c139d1f77731893aad1defa14f9bf3c48d3f1d31";
const expectedRotation1Key =
  "3fbdc101abd1132ca3a0ae34a669d8d9ba69a587e0bb4ddd59524541cf4813d8";
const expectedRotation2Ck =
  "728366ed68565dc17cf6dd97330a859a6a56e87e2beef3bd828a4c4a54d8df06";
const expectedRotation2Key =
  "9e0477f9850dca41e42db0e4d154e3a098e5a000d995e421849fcd5df27882bd";

for (let i = 0; i < 1002; i++) {
  const ct = encryptMessage(hello);

  if (i in expectedOutputs) {
    test(`Message ${i}: ciphertext matches BOLT 8 vector`, () => {
      assertEqual(ct, fromHex(expectedOutputs[i]), `message ${i}`);
    });
  }

  // Check rotation values
  if (i === 499) {
    // After message 499, nonce reaches 1000 and rotation happens
    test("Key rotation 1: ck matches BOLT 8 vector", () => {
      assertEqual(sendCk, fromHex(expectedRotation1Ck), "rotation 1 ck");
    });
    test("Key rotation 1: key matches BOLT 8 vector", () => {
      assertEqual(sendKey, fromHex(expectedRotation1Key), "rotation 1 key");
    });
  }

  if (i === 999) {
    test("Key rotation 2: ck matches BOLT 8 vector", () => {
      assertEqual(sendCk, fromHex(expectedRotation2Ck), "rotation 2 ck");
    });
    test("Key rotation 2: key matches BOLT 8 vector", () => {
      assertEqual(sendKey, fromHex(expectedRotation2Key), "rotation 2 key");
    });
  }
}

// ─── 6. HKDF Standalone Test ────────────────────────────────────────────────

console.log("\n--- HKDF Standalone Tests ---");

test("HKDF with BOLT 8 Act 1 values", () => {
  const [k1, k2] = hkdfTwoKeys(
    // Initial ck (SHA256 of protocol name)
    sha256(protocolName),
    // es shared secret
    fromHex(
      "1e2fb3c8fe8fb9f262f649f64d26ecf0f2c0a805a767cf02dc2d77a6ef1fdcc3"
    )
  );
  assertEqual(
    k1,
    fromHex(
      "b61ec1191326fa240decc9564369dbb3ae2b34341d1e11ad64ed89f89180582f"
    ),
    "HKDF output1"
  );
  assertEqual(
    k2,
    fromHex(
      "e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"
    ),
    "HKDF output2"
  );
});

// ─── 7. ChaCha20-Poly1305 Round-trip ────────────────────────────────────────

console.log("\n--- ChaCha20-Poly1305 Round-trip ---");

test("Encrypt then decrypt produces original plaintext", () => {
  const key = fromHex(
    "e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"
  );
  const pt = new TextEncoder().encode("test message");
  const ad = fromHex(
    "9d1ffbb639e7e20021d9259491dc7b160aab270fb1339ef135053f6f2cebe9ce"
  );
  const ct = chachaEncrypt(key, 0, ad, pt);
  const recovered = chachaDecrypt(key, 0, ad, ct);
  assertEqual(recovered, pt, "round-trip plaintext");
});

test("Encrypt empty payload with known key produces known tag", () => {
  // Using Act 1 values: encrypt(temp_k1, 0, h, "")
  const key = fromHex(
    "e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"
  );
  // h at this point is after MixHash(ie_pub)
  // We need to reconstruct h at that point
  let h_init = sha256(protocolName);
  const prologueBytes = new TextEncoder().encode("lightning");
  h_init = sha256(Uint8Array.from([...h_init, ...prologueBytes]));
  h_init = sha256(Uint8Array.from([...h_init, ...rs_pub]));
  h_init = sha256(Uint8Array.from([...h_init, ...ie_pub]));

  const tag = chachaEncrypt(key, 0, h_init, new Uint8Array(0));
  assertEqual(
    tag,
    fromHex("0df6086551151f58b8afe6c195782c6a"),
    "Act 1 tag from known values"
  );
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(
    "All BOLT 8 test vectors verified. TypeScript crypto primitives are correct.\n"
  );
  process.exit(0);
}
