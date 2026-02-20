# Noise Protocol Coding Exercises — Overview

This document covers all 10 exercises, their solutions, what each teaches, and how they build toward a complete Noise XK handshake implementation.

---

## Course Flow

The exercises follow the structure of the Noise XK handshake used in the Lightning Network. Students start with the cryptographic primitives (keypairs, ECDH, HKDF), then build the handshake state machine (init, Act 1, Act 2, Act 3), and finish with transport-layer encryption. Each exercise reuses functions from earlier ones, reinforcing that the entire protocol is composed from a small set of operations.

```
Primitives           Handshake                      Transport
─────────────        ───────────────────────         ─────────
Ex 1: Keypair  ──►   Ex 4: Init State
Ex 2: ECDH     ──►   Ex 5: Act 1 (initiator)  ──►
Ex 3: HKDF     ──►   Ex 6: Act 1 (responder)  ──►   Ex 10: Encrypt/Decrypt
                      Ex 7: Act 2 (responder)  ──►
                      Ex 8: Act 2 (initiator)  ──►
                      Ex 9: Act 3 (identity + split)
```

---

## Chapter: Crypto Review (1.4)

### Exercise 1: Generate an X25519 Keypair

**What it teaches:** How public-key cryptography works at the byte level. Students learn that a private key is just 32 random bytes, a public key is deterministically derived from it, and the `cryptography` library handles the elliptic curve math.

**How it fits:** Every Noise handshake message involves ephemeral and/or static keypairs. This is the most fundamental building block.

**Solution:**
```python
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

def generate_keypair():
    private_key = X25519PrivateKey.generate()
    public_key = private_key.public_key()
    priv_bytes = private_key.private_bytes_raw()
    pub_bytes = public_key.public_bytes_raw()
    return (priv_bytes, pub_bytes)
```

---

### Exercise 2: Perform ECDH Key Exchange

**What it teaches:** The core insight of Diffie-Hellman — two parties can compute the same shared secret from each other's public keys without ever transmitting private keys. Students also learn that ECDH is **commutative**: `DH(a, B) == DH(b, A)`. This commutativity is what makes the handshake work — the initiator and responder can arrive at the same secret from opposite sides.

**How it fits:** Every Noise handshake token (`ee`, `es`, `se`, `ss`) is an ECDH operation. This function is called in every Act.

**Solution:**
```python
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey

def ecdh(local_private_key_bytes, remote_public_key_bytes):
    private_key = X25519PrivateKey.from_private_bytes(local_private_key_bytes)
    remote_public_key = X25519PublicKey.from_public_bytes(remote_public_key_bytes)
    shared_secret = private_key.exchange(remote_public_key)
    return shared_secret
```

---

### Exercise 3: Implement HKDF (Key Derivation)

**What it teaches:** Why you can't use a raw ECDH shared secret directly as an encryption key, and how HKDF extracts entropy then expands it into multiple independent keys. Students implement Noise's simplified HKDF variant (no `info` parameter, counter bytes instead) using only `hmac` and `hashlib` — no high-level wrappers.

**How it fits:** HKDF is called after every ECDH (`MixKey`) and at the end of the handshake (`Split`). It's the mechanism that ratchets the chaining key forward and produces temporary encryption keys.

**Solution:**
```python
import hmac, hashlib

def hkdf_two_keys(salt, input_key_material):
    # Extract
    temp_key = hmac.new(salt, input_key_material, hashlib.sha256).digest()
    # Expand
    output1 = hmac.new(temp_key, b'\x01', hashlib.sha256).digest()
    output2 = hmac.new(temp_key, output1 + b'\x02', hashlib.sha256).digest()
    return (output1, output2)
```

---

## Chapter: Noise Setup (1.6)

### Exercise 4: Initialize the Handshake State

**What it teaches:** How the Noise handshake binds the protocol identity (name), the application context (prologue), and pre-shared knowledge (responder's static key) into the cryptographic state *before any messages are exchanged*. Students learn `MixHash` — the operation `h = SHA256(h || data)` — and why the chaining key (`ck`) starts as a copy of `h` but diverges once `MixKey` is called.

**How it fits:** This is step zero of the XK handshake. The "XK" pattern means the initiator knows the responder's static key in advance (`K`) but the responder doesn't know the initiator's (`X`). Mixing the responder's public key into `h` at init time is what makes this an "XK" pattern rather than "XX" or "IK".

**Solution:**
```python
import hashlib

def initialize_symmetric_state(responder_static_pubkey):
    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h
    # MixHash prologue
    h = hashlib.sha256(h + b"lightning").digest()
    # MixHash responder's static public key
    h = hashlib.sha256(h + responder_static_pubkey).digest()
    return (h, ck)
```

---

## Chapter: Noise Act 1 (1.7)

### Exercise 5: Act 1 — Initiator Side

**What it teaches:** How to construct a Noise handshake message. Students implement the pattern `-> e, es`: send your ephemeral public key, then ECDH it with the responder's static key. They learn the full message-building pipeline: MixHash → ECDH → MixKey (HKDF) → Encrypt → MixHash → Assemble. The encrypted empty payload's authentication tag proves the initiator knows the responder's identity.

**How it fits:** Act 1 is the opening message of the handshake. The `es` token (ephemeral-static ECDH) means only someone who knows the responder's static key can produce a valid Act 1 — this is implicit authentication of the responder.

**Solution:**
```python
def act_one_initiator(h, ck, e_priv, e_pub, rs_pub):
    # 1. MixHash ephemeral
    h = hashlib.sha256(h + e_pub).digest()
    # 2. ECDH(e, rs)
    ss = ecdh(e_priv, rs_pub)
    # 3. MixKey
    ck, temp_k = hkdf_two_keys(ck, ss)
    # 4. Encrypt empty payload
    cipher = ChaCha20Poly1305(temp_k)
    nonce = (0).to_bytes(12, 'little')
    c = cipher.encrypt(nonce, b"", h)
    # 5. MixHash ciphertext
    h = hashlib.sha256(h + c).digest()
    # 6. Assemble
    return (b'\x00' + e_pub + c, h, ck)
```

---

### Exercise 6: Act 1 — Responder Side

**What it teaches:** That the responder mirrors the initiator's operations exactly. Both sides run MixHash and MixKey on the same data in the same order, so they arrive at identical cryptographic state. Students also learn message parsing and tag verification — if decryption fails, the message was forged or corrupted.

**How it fits:** The responder validates that the initiator actually knows their static public key. If the `es` ECDH doesn't match (because the initiator used the wrong key), the tag verification fails and the handshake is rejected.

**Solution:**
```python
def act_one_responder(h, ck, s_priv, message):
    version = message[0:1]
    if version != b'\x00':
        raise ValueError("Bad version")
    re_pub = message[1:33]
    c = message[33:]
    h = hashlib.sha256(h + re_pub).digest()
    ss = ecdh(s_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    nonce = (0).to_bytes(12, 'little')
    cipher.decrypt(nonce, c, h)  # verify tag
    h = hashlib.sha256(h + c).digest()
    return (re_pub, h, ck)
```

---

## Chapter: Noise Act 2 (1.8)

### Exercise 7: Act 2 — Responder Side

**What it teaches:** That Act 2 has the *exact same structure* as Act 1 — the only difference is which keys feed into ECDH. Here it's `ee` (ephemeral-ephemeral) instead of `es` (ephemeral-static). This is what provides **forward secrecy**: even if static keys are later compromised, the ephemeral-ephemeral shared secret can never be reconstructed.

**How it fits:** After Act 2, both sides have mixed in two ECDH secrets (`es` + `ee`). The pattern is building up layers of security — static-key authentication from Act 1, forward secrecy from Act 2.

**Solution:**
```python
def act_two_responder(h, ck, e_priv, e_pub, re_pub):
    h = hashlib.sha256(h + e_pub).digest()
    ss = ecdh(e_priv, re_pub)  # ee DH
    ck, temp_k = hkdf_two_keys(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    c = cipher.encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c).digest()
    return (b'\x00' + e_pub + c, h, ck)
```

---

### Exercise 8: Act 2 — Initiator Side

**What it teaches:** Reinforces the mirror pattern — the initiator parses and verifies Act 2 the same way the responder parsed Act 1. By this point students should recognize the common structure: parse → MixHash → ECDH → MixKey → Decrypt → MixHash. The only thing that changes between exercises is *which key pair* feeds the ECDH.

**How it fits:** After processing Act 2, the initiator and responder have identical `(h, ck)` state. They're ready for Act 3.

**Solution:**
```python
def act_two_initiator(h, ck, e_priv, message):
    version = message[0:1]
    if version != b'\x00':
        raise ValueError("Bad version")
    re_pub = message[1:33]
    c = message[33:]
    h = hashlib.sha256(h + re_pub).digest()
    ss = ecdh(e_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    ChaCha20Poly1305(temp_k).decrypt((0).to_bytes(12, 'little'), c, h)
    h = hashlib.sha256(h + c).digest()
    return (re_pub, h, ck)
```

---

## Chapter: Noise Act 3 (1.9)

### Exercise 9: Act 3 — Identity Reveal & Key Split

**What it teaches:** The most complex message in the handshake. Students learn three new concepts: (1) **encrypting the static public key** — the initiator's identity is hidden from eavesdroppers because it's encrypted under keys derived from prior ECDH secrets; (2) the final `se` ECDH (static-ephemeral) which adds mutual authentication; (3) the **Split** operation that derives the two directional transport keys from the final chaining key.

**How it fits:** This is the "X" in "XK" — the initiator reveals their identity only after the channel is already encrypted and authenticated. After Act 3, the handshake is complete and both sides hold `send_key` and `recv_key` for transport.

**Solution:**
```python
def act_three_initiator(h, ck, s_priv, s_pub, re_pub):
    # Derive temp_k for encrypting static key
    ck, temp_k = hkdf_two_keys(ck, b"")
    c1 = ChaCha20Poly1305(temp_k).encrypt(
        (0).to_bytes(12, 'little'), s_pub, h)
    h = hashlib.sha256(h + c1).digest()
    # se ECDH
    ss = ecdh(s_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    c2 = ChaCha20Poly1305(temp_k).encrypt(
        (0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c2).digest()
    # Split into transport keys
    send_key, recv_key = hkdf_two_keys(ck, b"")
    return (b'\x00' + c1 + c2, send_key, recv_key)
```

---

## Chapter: Sending Messages (1.10)

### Exercise 10: Encrypt & Decrypt Transport Messages

**What it teaches:** How Lightning frames post-handshake messages. Students learn the length-prefix encryption scheme: a 2-byte big-endian length is encrypted first (hiding message sizes from observers), then the body is encrypted separately. Each operation consumes one nonce, so a single message uses two nonces. This is also the first exercise where students implement both encrypt *and* decrypt.

**How it fits:** This is what happens after the handshake is complete. The `send_key` and `recv_key` from Exercise 9's `Split` are used here. Students can now see the full pipeline: generate keys → handshake → transport.

**Solution:**
```python
import struct
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def encrypt_message(key, nonce, plaintext):
    length_bytes = struct.pack(">H", len(plaintext))
    cipher = ChaCha20Poly1305(key)
    enc_len = cipher.encrypt(nonce.to_bytes(12, 'little'), length_bytes, b"")
    enc_body = cipher.encrypt((nonce + 1).to_bytes(12, 'little'), plaintext, b"")
    return (enc_len + enc_body, nonce + 2)

def decrypt_message(key, nonce, ciphertext):
    cipher = ChaCha20Poly1305(key)
    enc_len = ciphertext[:18]
    length_bytes = cipher.decrypt(nonce.to_bytes(12, 'little'), enc_len, b"")
    msg_len = struct.unpack(">H", length_bytes)[0]
    enc_body = ciphertext[18:]
    plaintext = cipher.decrypt((nonce + 1).to_bytes(12, 'little'), enc_body, b"")
    return (plaintext, nonce + 2)
```

---

## Summary Table

| # | Exercise | Pattern Token | Key Concept | Chapter |
|---|----------|--------------|-------------|---------|
| 1 | Generate Keypair | — | X25519 key generation, raw byte serialization | 1.4 |
| 2 | ECDH Exchange | — | Shared secret computation, commutativity | 1.4 |
| 3 | HKDF | — | Extract-expand key derivation, Noise's HMAC variant | 1.4 |
| 4 | Init State | — | Protocol binding, MixHash, chaining key | 1.6 |
| 5 | Act 1 Initiator | `-> e, es` | Message construction, ephemeral-static ECDH | 1.7 |
| 6 | Act 1 Responder | `-> e, es` | Message parsing, tag verification, mirror symmetry | 1.7 |
| 7 | Act 2 Responder | `<- e, ee` | Forward secrecy via ephemeral-ephemeral ECDH | 1.8 |
| 8 | Act 2 Initiator | `<- e, ee` | Pattern recognition (same structure, different keys) | 1.8 |
| 9 | Act 3 Initiator | `-> s, se` | Identity hiding, static-ephemeral ECDH, Split | 1.9 |
| 10 | Transport | — | Length-prefix framing, nonce management, full roundtrip | 1.10 |
