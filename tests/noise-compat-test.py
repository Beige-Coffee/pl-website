"""
BOLT 8 Transport Test Vectors - Python Implementation

Proves that the Python ecdsa + cryptography + hashlib/hmac stack produces
byte-identical outputs to the TypeScript @noble/* stack for all BOLT 8
cryptographic operations.

Run: python tests/noise-compat-test.py

Uses the same libraries students use in the Noise Protocol tutorial exercises
(executed via Pyodide in the browser):
  - ecdsa (pure Python) for ECDH
  - cryptography for ChaCha20-Poly1305
  - hashlib and hmac for SHA256 and HKDF
"""

import hashlib
import hmac as hmac_mod
import sys
from ecdsa import SigningKey, VerifyingKey, SECP256k1
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305


# ─── Helpers ────────────────────────────────────────────────────────────────

def from_hex(h: str) -> bytes:
    """Convert hex string (with or without 0x prefix) to bytes."""
    if h.startswith("0x"):
        h = h[2:]
    return bytes.fromhex(h)


# ─── BOLT 8 Primitives ─────────────────────────────────────────────────────

def bolt8_ecdh(priv_bytes: bytes, pub_bytes: bytes) -> bytes:
    """
    BOLT 8 ECDH: scalar multiply, compress result, SHA256 hash.
    Identical to the student's exercise-ecdh implementation.
    """
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\x02' if pt.y() % 2 == 0 else b'\x03'
    compressed = prefix + pt.x().to_bytes(32, 'big')
    return hashlib.sha256(compressed).digest()


def hkdf_two_keys(salt: bytes, ikm: bytes) -> tuple:
    """
    Noise Protocol HKDF: extract-then-expand, 2 x 32-byte outputs.
    Identical to the student's exercise-hkdf implementation.
    """
    temp_key = hmac_mod.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac_mod.new(temp_key, b'\x01', hashlib.sha256).digest()
    out2 = hmac_mod.new(temp_key, out1 + b'\x02', hashlib.sha256).digest()
    return (out1, out2)


def chacha_encrypt(key: bytes, nonce: int, ad: bytes, plaintext: bytes) -> bytes:
    """
    ChaCha20-Poly1305 encrypt with BOLT 8 nonce format:
    12-byte nonce = 4 zero bytes + 8-byte little-endian counter.
    Returns ciphertext + 16-byte tag (as the cryptography library does by default).
    """
    nonce_bytes = b'\x00' * 4 + nonce.to_bytes(8, 'little')
    cipher = ChaCha20Poly1305(key)
    return cipher.encrypt(nonce_bytes, plaintext, ad)


def chacha_decrypt(key: bytes, nonce: int, ad: bytes, ct_with_tag: bytes) -> bytes:
    """
    ChaCha20-Poly1305 decrypt with BOLT 8 nonce format.
    """
    nonce_bytes = b'\x00' * 4 + nonce.to_bytes(8, 'little')
    cipher = ChaCha20Poly1305(key)
    return cipher.decrypt(nonce_bytes, ct_with_tag, ad)


def get_public_key(priv_bytes: bytes) -> bytes:
    """Derive compressed public key from 32-byte private key."""
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\x02' if pt.y() % 2 == 0 else b'\x03'
    return prefix + pt.x().to_bytes(32, 'big')


# ─── BOLT 8 Test Vectors (Appendix A) ──────────────────────────────────────

# Initiator static key
ls_priv = from_hex("1111111111111111111111111111111111111111111111111111111111111111")
ls_pub = get_public_key(ls_priv)

# Responder static key
rs_priv = from_hex("2121212121212121212121212121212121212121212121212121212121212121")
rs_pub = get_public_key(rs_priv)

# Initiator ephemeral key
ie_priv = from_hex("1212121212121212121212121212121212121212121212121212121212121212")
ie_pub = get_public_key(ie_priv)

# Responder ephemeral key
re_priv = from_hex("2222222222222222222222222222222222222222222222222222222222222222")
re_pub = get_public_key(re_priv)


# ─── Test Suite ─────────────────────────────────────────────────────────────

passed = 0
failed = 0


def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  PASS: {name}")
        passed += 1
    except Exception as e:
        print(f"  FAIL: {name}")
        print(f"        {e}")
        failed += 1


def assert_eq(a: bytes, b: bytes, label: str):
    if a != b:
        raise AssertionError(
            f"{label}\n  expected: {b.hex()}\n  got:      {a.hex()}"
        )


class AssertionError(Exception):
    pass


print("=== BOLT 8 Transport Test Vectors (Python) ===\n")

# ─── 1. Public Key Derivation ───────────────────────────────────────────────

print("--- Public Key Derivation ---")

test("Initiator static pubkey matches BOLT 8 vector", lambda: assert_eq(
    ls_pub,
    from_hex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa"),
    "ls.pub"
))

test("Responder static pubkey matches BOLT 8 vector", lambda: assert_eq(
    rs_pub,
    from_hex("028d7500dd4c12685d1f568b4c2b5048e8534b873319f3a8daa612b469132ec7f7"),
    "rs.pub"
))

test("Initiator ephemeral pubkey matches BOLT 8 vector", lambda: assert_eq(
    ie_pub,
    from_hex("036360e856310ce5d294e8be33fc807077dc56ac80d95d9cd4ddbd21325eff73f7"),
    "ie.pub"
))

test("Responder ephemeral pubkey matches BOLT 8 vector", lambda: assert_eq(
    re_pub,
    from_hex("02466d7fcae563e5cb09a0d1870bb580344804617879a14949cf22285f1bae3f27"),
    "re.pub"
))

# ─── 2. ECDH Shared Secrets ────────────────────────────────────────────────

print("\n--- ECDH Shared Secrets ---")

test("ECDH(ie, rs) == es shared secret", lambda: assert_eq(
    bolt8_ecdh(ie_priv, rs_pub),
    from_hex("1e2fb3c8fe8fb9f262f649f64d26ecf0f2c0a805a767cf02dc2d77a6ef1fdcc3"),
    "ss(es)"
))

def test_ecdh_commutativity():
    ss1 = bolt8_ecdh(ie_priv, rs_pub)
    ss2 = bolt8_ecdh(rs_priv, ie_pub)
    assert_eq(ss1, ss2, "ECDH commutativity (es)")

test("ECDH commutativity: ECDH(ie, rs) == ECDH(rs, ie)", test_ecdh_commutativity)

test("ECDH(ie, re) == ee shared secret", lambda: assert_eq(
    bolt8_ecdh(ie_priv, re_pub),
    from_hex("c06363d6cc549bcb7913dbb9ac1c33fc1158680c89e972000ecd06b36c472e47"),
    "ss(ee)"
))

test("ECDH(ls, re) == se shared secret", lambda: assert_eq(
    bolt8_ecdh(ls_priv, re_pub),
    from_hex("b36b6d195982c5be874d6d542dc268234379e1ae4ff1709402135b7de5cf0766"),
    "ss(se)"
))

# ─── 3. Full Handshake ──────────────────────────────────────────────────────

print("\n--- Full Handshake (Act 1 / Act 2 / Act 3) ---")

# Protocol name: "Noise_XK_secp256k1_ChaChaPoly_SHA256"
protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
# Exactly 36 bytes, so h = SHA-256(protocolName), ck = h
ck = hashlib.sha256(protocol_name).digest()
h = ck

# Mix prologue ("lightning")
prologue = b"lightning"
h = hashlib.sha256(h + prologue).digest()

# Mix rs_pub into h (initiator knows responder's static key)
h = hashlib.sha256(h + rs_pub).digest()

# ─── Act 1: Initiator -> Responder ──────────────────────────────────────────

print("\n  -- Act 1 --")

# MixHash(ie_pub)
h = hashlib.sha256(h + ie_pub).digest()

test("Act 1: h after MixHash(ie_pub) matches BOLT 8 vector", lambda: assert_eq(
    h,
    from_hex("9e0e7de8bb75554f21db034633de04be41a2b8a18da7a319a03c803bf02b396c"),
    "h after MixHash(ie_pub)"
))

# ECDH(ie, rs) -> es
ss_es = bolt8_ecdh(ie_priv, rs_pub)

# MixKey(ss_es)
ck, temp_k1 = hkdf_two_keys(ck, ss_es)

test("Act 1: ck matches BOLT 8 vector", lambda: assert_eq(
    ck,
    from_hex("b61ec1191326fa240decc9564369dbb3ae2b34341d1e11ad64ed89f89180582f"),
    "ck after Act 1 MixKey"
))

test("Act 1: temp_k1 matches BOLT 8 vector", lambda: assert_eq(
    temp_k1,
    from_hex("e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"),
    "temp_k1"
))

# Encrypt empty payload: c = encrypt(temp_k1, nonce=0, ad=h, pt="")
c_act1 = chacha_encrypt(temp_k1, 0, h, b"")

test("Act 1: encrypted tag matches BOLT 8 vector", lambda: assert_eq(
    c_act1,
    from_hex("0df6086551151f58b8afe6c195782c6a"),
    "c(Act 1)"
))

# MixHash(c)
h = hashlib.sha256(h + c_act1).digest()

test("Act 1: h after MixHash matches BOLT 8 vector", lambda: assert_eq(
    h,
    from_hex("9d1ffbb639e7e20021d9259491dc7b160aab270fb1339ef135053f6f2cebe9ce"),
    "h after Act 1"
))

# Full Act 1 message: version(0x00) + ie_pub(33) + c(16) = 50 bytes
act1_msg = b'\x00' + ie_pub + c_act1

def test_act1_full():
    assert_eq(
        act1_msg,
        from_hex("00036360e856310ce5d294e8be33fc807077dc56ac80d95d9cd4ddbd21325eff73f70df6086551151f58b8afe6c195782c6a"),
        "Act 1 message"
    )
    assert len(act1_msg) == 50, f"Act 1 must be 50 bytes, got {len(act1_msg)}"

test("Act 1: full message matches BOLT 8 vector (50 bytes)", test_act1_full)

# ─── Act 2: Responder -> Initiator ──────────────────────────────────────────

print("\n  -- Act 2 --")

# MixHash(re_pub)
h = hashlib.sha256(h + re_pub).digest()

test("Act 2: h after MixHash(re_pub) matches BOLT 8 vector", lambda: assert_eq(
    h,
    from_hex("38122f669819f906000621a14071802f93f2ef97df100097bcac3ae76c6dc0bf"),
    "h after MixHash(re_pub)"
))

# ECDH(ie, re) -> ee
ss_ee = bolt8_ecdh(ie_priv, re_pub)

test("Act 2: ee shared secret matches BOLT 8 vector", lambda: assert_eq(
    ss_ee,
    from_hex("c06363d6cc549bcb7913dbb9ac1c33fc1158680c89e972000ecd06b36c472e47"),
    "ss(ee)"
))

# MixKey(ss_ee)
ck, temp_k2 = hkdf_two_keys(ck, ss_ee)

test("Act 2: ck matches BOLT 8 vector", lambda: assert_eq(
    ck,
    from_hex("e89d31033a1b6bf68c07d22e08ea4d7884646c4b60a9528598ccb4ee2c8f56ba"),
    "ck after Act 2 MixKey"
))

test("Act 2: temp_k2 matches BOLT 8 vector", lambda: assert_eq(
    temp_k2,
    from_hex("908b166535c01a935cf1e130a5fe895ab4e6f3ef8855d87e9b7581c4ab663ddc"),
    "temp_k2"
))

# Encrypt empty payload: c = encrypt(temp_k2, nonce=0, ad=h, pt="")
c_act2 = chacha_encrypt(temp_k2, 0, h, b"")

# MixHash(c)
h = hashlib.sha256(h + c_act2).digest()

test("Act 2: h after MixHash matches BOLT 8 vector", lambda: assert_eq(
    h,
    from_hex("90578e247e98674e661013da3c5c1ca6a8c8f48c90b485c0dfa1494e23d56d72"),
    "h after Act 2"
))

# Full Act 2 message: version(0x00) + re_pub(33) + c(16) = 50 bytes
act2_msg = b'\x00' + re_pub + c_act2

def test_act2_full():
    assert_eq(
        act2_msg,
        from_hex("0002466d7fcae563e5cb09a0d1870bb580344804617879a14949cf22285f1bae3f276e2470b93aac583c9ef6eafca3f730ae"),
        "Act 2 message"
    )
    assert len(act2_msg) == 50, f"Act 2 must be 50 bytes, got {len(act2_msg)}"

test("Act 2: full message matches BOLT 8 vector (50 bytes)", test_act2_full)

# ─── Act 3: Initiator -> Responder ──────────────────────────────────────────

print("\n  -- Act 3 --")

# Encrypt initiator's static pubkey: c1 = encrypt(temp_k2, nonce=1, ad=h, pt=ls_pub)
c1_act3 = chacha_encrypt(temp_k2, 1, h, ls_pub)

test("Act 3: encrypted static key matches BOLT 8 vector", lambda: assert_eq(
    c1_act3,
    from_hex("b9e3a702e93e3a9948c2ed6e5fd7590a6e1c3a0344cfc9d5b57357049aa22355361aa02e55a8fc28fef5bd6d71ad0c3822"),
    "c1(Act 3)"
))

# MixHash(c1)
h = hashlib.sha256(h + c1_act3).digest()

test("Act 3: h after MixHash(c1) matches BOLT 8 vector", lambda: assert_eq(
    h,
    from_hex("5dcb5ea9b4ccc755e0e3456af3990641276e1d5dc9afd82f974d90a47c918660"),
    "h after Act 3 MixHash(c1)"
))

# ECDH(ls, re) -> se
ss_se = bolt8_ecdh(ls_priv, re_pub)

test("Act 3: se shared secret matches BOLT 8 vector", lambda: assert_eq(
    ss_se,
    from_hex("b36b6d195982c5be874d6d542dc268234379e1ae4ff1709402135b7de5cf0766"),
    "ss(se)"
))

# MixKey(ss_se)
ck, temp_k3 = hkdf_two_keys(ck, ss_se)

test("Act 3: ck matches BOLT 8 vector", lambda: assert_eq(
    ck,
    from_hex("919219dbb2920afa8db80f9a51787a840bcf111ed8d588caf9ab4be716e42b01"),
    "ck after Act 3 MixKey"
))

test("Act 3: temp_k3 matches BOLT 8 vector", lambda: assert_eq(
    temp_k3,
    from_hex("981a46c820fb7a241bc8184ba4bb1f01bcdfafb00dde80098cb8c38db9141520"),
    "temp_k3"
))

# Encrypt empty payload (auth tag): t = encrypt(temp_k3, nonce=0, ad=h, pt="")
t_act3 = chacha_encrypt(temp_k3, 0, h, b"")

test("Act 3: auth tag matches BOLT 8 vector", lambda: assert_eq(
    t_act3,
    from_hex("8dc68b1c466263b47fdf31e560e139ba"),
    "t(Act 3)"
))

# Full Act 3 message: version(0x00) + c1(49) + t(16) = 66 bytes
act3_msg = b'\x00' + c1_act3 + t_act3

def test_act3_full():
    assert_eq(
        act3_msg,
        from_hex("00b9e3a702e93e3a9948c2ed6e5fd7590a6e1c3a0344cfc9d5b57357049aa22355361aa02e55a8fc28fef5bd6d71ad0c38228dc68b1c466263b47fdf31e560e139ba"),
        "Act 3 message"
    )
    assert len(act3_msg) == 66, f"Act 3 must be 66 bytes, got {len(act3_msg)}"

test("Act 3: full message matches BOLT 8 vector (66 bytes)", test_act3_full)

# ─── 4. Transport Keys (Split) ─────────────────────────────────────────────

print("\n--- Transport Keys (Split) ---")

sk, rk = hkdf_two_keys(ck, b"")

test("Send key (sk) matches BOLT 8 vector", lambda: assert_eq(
    sk,
    from_hex("969ab31b4d288cedf6218839b27a3e2140827047f2c0f01bf5c04435d43511a9"),
    "sk"
))

test("Receive key (rk) matches BOLT 8 vector", lambda: assert_eq(
    rk,
    from_hex("bb9020b8965f4df047e07f955f3c4b88418984aadc5cdb35096b9ea8fa5c3442"),
    "rk"
))

# ─── 5. Message Encryption Test Vectors ─────────────────────────────────────

print("\n--- Message Encryption (Transport Phase) ---")

hello = b"hello"
send_ck = ck  # chaining key for key rotation
send_key = sk
sn = 0  # send nonce


def encrypt_message(plaintext: bytes) -> bytes:
    global send_ck, send_key, sn

    # Encrypt length prefix (2 bytes, big-endian)
    length_bytes = len(plaintext).to_bytes(2, 'big')
    enc_len = chacha_encrypt(send_key, sn, b"", length_bytes)
    sn += 1

    # Encrypt body
    enc_body = chacha_encrypt(send_key, sn, b"", plaintext)
    sn += 1

    # Key rotation at nonce 1000
    if sn >= 1000:
        send_ck, send_key = hkdf_two_keys(send_ck, send_key)
        sn = 0

    return enc_len + enc_body


# Expected outputs at specific message indices
expected_outputs = {
    0: "cf2b30ddf0cf3f80e7c35a6e6730b59fe802473180f396d88a8fb0db8cbcf25d2f214cf9ea1d95",
    1: "72887022101f0b6753e0c7de21657d35a4cb2a1f5cde2650528bbc8f837d0f0d7ad833b1a256a1",
    500: "178cb9d7387190fa34db9c2d50027d21793c9bc2d40b1e14dcf30ebeeeb220f48364f7a4c68bf8",
    501: "1b186c57d44eb6de4c057c49940d79bb838a145cb528d6e8fd26dbe50a60ca2c104b56b60e45bd",
    1000: "4a2f3cc3b5e78ddb83dcb426d9863d9d9a723b0337c89dd0b005d89f8d3c05c52b76b29b740f09",
    1001: "2ecd8c8a5629d0d02ab457a0fdd0f7b90a192cd46be5ecb6ca570bfc5e268338b1a16cf4ef2d36",
}

expected_rotation1_ck = "cc2c6e467efc8067720c2d09c139d1f77731893aad1defa14f9bf3c48d3f1d31"
expected_rotation1_key = "3fbdc101abd1132ca3a0ae34a669d8d9ba69a587e0bb4ddd59524541cf4813d8"
expected_rotation2_ck = "728366ed68565dc17cf6dd97330a859a6a56e87e2beef3bd828a4c4a54d8df06"
expected_rotation2_key = "9e0477f9850dca41e42db0e4d154e3a098e5a000d995e421849fcd5df27882bd"

for i in range(1002):
    ct = encrypt_message(hello)

    if i in expected_outputs:
        expected = from_hex(expected_outputs[i])
        # Capture i in closure
        def make_test(idx, actual, exp):
            return lambda: assert_eq(actual, exp, f"message {idx}")
        test(f"Message {i}: ciphertext matches BOLT 8 vector", make_test(i, ct, expected))

    if i == 499:
        def make_rotation_test_1():
            ck_copy = send_ck
            key_copy = send_key
            def t1():
                assert_eq(ck_copy, from_hex(expected_rotation1_ck), "rotation 1 ck")
            def t2():
                assert_eq(key_copy, from_hex(expected_rotation1_key), "rotation 1 key")
            return t1, t2
        t1, t2 = make_rotation_test_1()
        test("Key rotation 1: ck matches BOLT 8 vector", t1)
        test("Key rotation 1: key matches BOLT 8 vector", t2)

    if i == 999:
        def make_rotation_test_2():
            ck_copy = send_ck
            key_copy = send_key
            def t1():
                assert_eq(ck_copy, from_hex(expected_rotation2_ck), "rotation 2 ck")
            def t2():
                assert_eq(key_copy, from_hex(expected_rotation2_key), "rotation 2 key")
            return t1, t2
        t1, t2 = make_rotation_test_2()
        test("Key rotation 2: ck matches BOLT 8 vector", t1)
        test("Key rotation 2: key matches BOLT 8 vector", t2)

# ─── 6. HKDF Standalone Test ────────────────────────────────────────────────

print("\n--- HKDF Standalone Tests ---")

def test_hkdf_act1():
    initial_ck = hashlib.sha256(protocol_name).digest()
    ss = from_hex("1e2fb3c8fe8fb9f262f649f64d26ecf0f2c0a805a767cf02dc2d77a6ef1fdcc3")
    k1, k2 = hkdf_two_keys(initial_ck, ss)
    assert_eq(
        k1,
        from_hex("b61ec1191326fa240decc9564369dbb3ae2b34341d1e11ad64ed89f89180582f"),
        "HKDF output1"
    )
    assert_eq(
        k2,
        from_hex("e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f"),
        "HKDF output2"
    )

test("HKDF with BOLT 8 Act 1 values", test_hkdf_act1)

# ─── 7. ChaCha20-Poly1305 Round-trip ────────────────────────────────────────

print("\n--- ChaCha20-Poly1305 Round-trip ---")

def test_chacha_roundtrip():
    key = from_hex("e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f")
    pt = b"test message"
    ad = from_hex("9d1ffbb639e7e20021d9259491dc7b160aab270fb1339ef135053f6f2cebe9ce")
    ct = chacha_encrypt(key, 0, ad, pt)
    recovered = chacha_decrypt(key, 0, ad, ct)
    assert_eq(recovered, pt, "round-trip plaintext")

test("Encrypt then decrypt produces original plaintext", test_chacha_roundtrip)

def test_chacha_known_tag():
    key = from_hex("e68f69b7f096d7917245f5e5cf8ae1595febe4d4644333c99f9c4a1282031c9f")
    h_init = hashlib.sha256(protocol_name).digest()
    h_init = hashlib.sha256(h_init + b"lightning").digest()
    h_init = hashlib.sha256(h_init + rs_pub).digest()
    h_init = hashlib.sha256(h_init + ie_pub).digest()
    tag = chacha_encrypt(key, 0, h_init, b"")
    assert_eq(tag, from_hex("0df6086551151f58b8afe6c195782c6a"), "Act 1 tag from known values")

test("Encrypt empty payload with known key produces known tag", test_chacha_known_tag)

# ─── Summary ────────────────────────────────────────────────────────────────

print(f"\n{'=' * 50}")
print(f"Results: {passed} passed, {failed} failed")
print(f"{'=' * 50}\n")

if failed > 0:
    print("SOME TESTS FAILED. See above for details.\n")
    sys.exit(1)
else:
    print("All BOLT 8 test vectors verified. Python crypto primitives are correct.\n")
    sys.exit(0)
