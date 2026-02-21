export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
  };
  rewardSats: number;
}

export const CODE_EXERCISES: Record<string, CodeExerciseData> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 1  -  Generate secp256k1 Keypair
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-generate-keypair": {
    id: "exercise-generate-keypair",
    title: "Exercise 1: Generate a secp256k1 Keypair",
    description:
      "Implement secp256k1 keypair generation  -  the foundation of all Diffie-Hellman operations in Lightning's Noise Protocol. Lightning uses secp256k1 (the same curve as Bitcoin) rather than Curve25519. Return a 32-byte private key and a 33-byte compressed public key.",
    starterCode: `from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

def generate_keypair():
    """
    Generate a random secp256k1 keypair.

    Lightning nodes use secp256k1 keys for identity and encryption.
    The public key is serialized in SEC1 compressed format (33 bytes):
      - 1-byte prefix (0x02 for even y, 0x03 for odd y)
      - 32-byte x-coordinate

    Returns:
        tuple: (private_key_bytes, public_key_bytes)
               private_key_bytes: 32-byte 'bytes' object
               public_key_bytes:  33-byte compressed SEC1 'bytes' object
    """
    # TODO: Generate a new secp256k1 private key using ec.generate_private_key()
    # TODO: Derive the public key from the private key
    # TODO: Serialize private key to 32-byte big-endian bytes
    # TODO: Serialize public key to 33-byte compressed SEC1 format
    # TODO: Return them as a tuple
    pass
`,
    testCode: `
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

def test_returns_tuple():
    result = generate_keypair()
    assert isinstance(result, tuple), "generate_keypair() must return a tuple"
    assert len(result) == 2, "Tuple must have exactly 2 elements (private, public)"

def test_key_lengths():
    priv, pub = generate_keypair()
    assert isinstance(priv, bytes), f"Private key must be bytes, got {type(priv).__name__}"
    assert isinstance(pub, bytes), f"Public key must be bytes, got {type(pub).__name__}"
    assert len(priv) == 32, f"Private key must be 32 bytes, got {len(priv)}"
    assert len(pub) == 33, f"Public key must be 33 bytes (compressed SEC1), got {len(pub)}"

def test_compressed_prefix():
    _, pub = generate_keypair()
    assert pub[0] in (0x02, 0x03), f"Compressed pubkey must start with 0x02 or 0x03, got 0x{pub[0]:02x}"

def test_public_derives_from_private():
    priv, pub = generate_keypair()
    priv_int = int.from_bytes(priv, 'big')
    reconstructed = ec.derive_private_key(priv_int, ec.SECP256K1())
    expected_pub = reconstructed.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    assert pub == expected_pub, "Public key must be derived from the private key"

def test_randomness():
    priv1, pub1 = generate_keypair()
    priv2, pub2 = generate_keypair()
    assert priv1 != priv2, "Two calls should produce different private keys"
    assert pub1 != pub2, "Two calls should produce different public keys"
`,
    hints: {
      conceptual:
        "<p>Lightning uses <strong>secp256k1</strong>  -  the same elliptic curve as Bitcoin  -  for node identity keys and the Noise handshake. A keypair consists of a 32-byte private key (a random scalar) and a 33-byte compressed public key (SEC1 format: a 02/03 prefix byte plus the 32-byte x-coordinate). The <code>cryptography</code> library provides <code>ec.generate_private_key(ec.SECP256K1())</code> to create a new key.</p>",
      steps:
        '<ol><li>Call <code>ec.generate_private_key(ec.SECP256K1())</code> to create a new private key object.</li><li>Get the public key via <code>private_key.public_key()</code>.</li><li>Serialize the private key: <code>private_key.private_numbers().private_value.to_bytes(32, "big")</code>.</li><li>Serialize the public key to compressed format: <code>public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)</code>.</li><li>Return them as a tuple <code>(priv_bytes, pub_bytes)</code>.</li></ol>',
      code: `from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

def generate_keypair():
    private_key = ec.generate_private_key(ec.SECP256K1())
    public_key = private_key.public_key()
    priv_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
    pub_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return (priv_bytes, pub_bytes)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 2  -  ECDH Key Exchange
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-ecdh": {
    id: "exercise-ecdh",
    title: "Exercise 2: Perform ECDH Key Exchange",
    description:
      "Implement the secp256k1 ECDH exchange as defined in BOLT 8. Given your 32-byte private key and a remote party's 33-byte compressed public key, compute the 32-byte shared secret. BOLT 8 defines ECDH as: compute the shared point, then return its SHA-256 hash. This is the core operation behind every handshake token (ee, es, se, ss).",
    starterCode: `from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib

def ecdh(local_private_key_bytes, remote_public_key_bytes):
    """
    Perform secp256k1 ECDH key exchange (BOLT 8 variant).

    BOLT 8 defines ECDH(k, rk) as: perform an EC Diffie-Hellman using
    secp256k1 private key k and public key rk, then return the SHA-256
    hash of the raw shared secret.

    Args:
        local_private_key_bytes:  32-byte private key (bytes)
        remote_public_key_bytes:  33-byte compressed public key (bytes)

    Returns:
        bytes: 32-byte shared secret (SHA-256 hashed)
    """
    # TODO: Reconstruct the private key from raw bytes using ec.derive_private_key()
    # TODO: Reconstruct the remote public key from compressed bytes
    # TODO: Perform the ECDH exchange
    # TODO: Return SHA-256 of the raw shared secret
    pass
`,
    testCode: `
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def test_output_length():
    priv1, _ = _gen_key()
    _, pub2 = _gen_key()
    secret = ecdh(priv1, pub2)
    assert isinstance(secret, bytes), f"Must return bytes, got {type(secret).__name__}"
    assert len(secret) == 32, f"Shared secret must be 32 bytes, got {len(secret)}"

def test_commutativity():
    priv1, pub1 = _gen_key()
    priv2, pub2 = _gen_key()
    secret_ab = ecdh(priv1, pub2)
    secret_ba = ecdh(priv2, pub1)
    assert secret_ab == secret_ba, "ECDH must be commutative: DH(a,B) == DH(b,A)"

def test_determinism():
    priv1, _ = _gen_key()
    _, pub2 = _gen_key()
    s1 = ecdh(priv1, pub2)
    s2 = ecdh(priv1, pub2)
    assert s1 == s2, "Same inputs must produce same shared secret"

def test_different_keys_different_secrets():
    priv1, _ = _gen_key()
    _, pub2 = _gen_key()
    _, pub3 = _gen_key()
    s12 = ecdh(priv1, pub2)
    s13 = ecdh(priv1, pub3)
    assert s12 != s13, "Different remote keys must produce different secrets"

def test_is_hashed():
    priv1, _ = _gen_key()
    _, pub2 = _gen_key()
    secret = ecdh(priv1, pub2)
    # The raw ECDH exchange produces a value; BOLT 8 requires SHA-256 hashing
    priv_int = int.from_bytes(priv1, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub2)
    raw = sk.exchange(ec.ECDH(), pk)
    assert secret == hashlib.sha256(raw).digest(), "ECDH must return SHA-256 of raw shared secret"
`,
    hints: {
      conceptual:
        "<p>ECDH lets two parties compute a shared secret from their key pairs without transmitting private keys. BOLT 8 uses <strong>secp256k1</strong> (not Curve25519) and defines the ECDH output as the SHA-256 hash of the raw shared secret. Reconstruct the private key with <code>ec.derive_private_key()</code>, the public key with <code>EllipticCurvePublicKey.from_encoded_point()</code>, then call <code>.exchange(ec.ECDH(), ...)</code> and hash the result.</p>",
      steps:
        '<ol><li>Convert private key bytes to integer: <code>int.from_bytes(local_private_key_bytes, "big")</code></li><li>Reconstruct private key: <code>ec.derive_private_key(priv_int, ec.SECP256K1())</code></li><li>Reconstruct remote public key: <code>ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), remote_public_key_bytes)</code></li><li>Perform ECDH: <code>shared_key = private_key.exchange(ec.ECDH(), remote_public_key)</code></li><li>Return <code>hashlib.sha256(shared_key).digest()</code></li></ol>',
      code: `def ecdh(local_private_key_bytes, remote_public_key_bytes):
    priv_int = int.from_bytes(local_private_key_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    remote_public_key = ec.EllipticCurvePublicKey.from_encoded_point(
        ec.SECP256K1(), remote_public_key_bytes)
    shared_key = private_key.exchange(ec.ECDH(), remote_public_key)
    return hashlib.sha256(shared_key).digest()`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 3  -  HKDF Key Derivation
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-hkdf": {
    id: "exercise-hkdf",
    title: "Exercise 3: Implement HKDF (Key Derivation)",
    description:
      "Implement the Noise Protocol's variant of HKDF-SHA256. Given a salt (chaining key) and input key material, produce two 32-byte derived keys. Use only the hmac and hashlib modules  -  no high-level HKDF wrappers.",
    starterCode: `import hmac
import hashlib

def hkdf_two_keys(salt, input_key_material):
    """
    Noise Protocol's HKDF: extract-then-expand producing 2 x 32-byte keys.

    The Noise variant uses HMAC-SHA256 with NO info parameter:
      Extract:  temp_key = HMAC-SHA256(salt, input_key_material)
      Expand 1: output1  = HMAC-SHA256(temp_key, 0x01)
      Expand 2: output2  = HMAC-SHA256(temp_key, output1 || 0x02)

    Args:
        salt: bytes - the chaining key (ck)
        input_key_material: bytes - typically an ECDH shared secret

    Returns:
        tuple: (key1, key2) - two 32-byte derived keys
    """
    # TODO: Extract phase  -  derive temp_key using HMAC-SHA256
    # TODO: Expand phase  -  derive output1 from temp_key and byte 0x01
    # TODO: Expand phase  -  derive output2 from temp_key, output1, and byte 0x02
    # TODO: Return (output1, output2)
    pass
`,
    testCode: `
import hmac
import hashlib

def _ref_hkdf(salt, ikm):
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def test_returns_tuple_of_two():
    result = hkdf_two_keys(b'\\x00' * 32, b'\\x00' * 32)
    assert isinstance(result, tuple), "Must return a tuple"
    assert len(result) == 2, "Must return exactly 2 keys"

def test_output_lengths():
    k1, k2 = hkdf_two_keys(b'\\x00' * 32, b'\\x00' * 32)
    assert len(k1) == 32, f"Key 1 must be 32 bytes, got {len(k1)}"
    assert len(k2) == 32, f"Key 2 must be 32 bytes, got {len(k2)}"

def test_known_vector():
    salt = bytes(32)  # all zeros
    ikm = bytes(range(32))  # 0x00..0x1f
    expected = _ref_hkdf(salt, ikm)
    got = hkdf_two_keys(salt, ikm)
    assert got[0] == expected[0], f"Key 1 mismatch. Expected {expected[0].hex()}, got {got[0].hex()}"
    assert got[1] == expected[1], f"Key 2 mismatch. Expected {expected[1].hex()}, got {got[1].hex()}"

def test_determinism():
    salt = b'noise_chaining_key______________'
    ikm = b'shared_secret___________________'
    r1 = hkdf_two_keys(salt, ikm)
    r2 = hkdf_two_keys(salt, ikm)
    assert r1 == r2, "Same inputs must produce same outputs"

def test_different_inputs():
    salt = bytes(32)
    k1a, k2a = hkdf_two_keys(salt, b'\\x01' * 32)
    k1b, k2b = hkdf_two_keys(salt, b'\\x02' * 32)
    assert k1a != k1b, "Different IKM must produce different key 1"
    assert k2a != k2b, "Different IKM must produce different key 2"
`,
    hints: {
      conceptual:
        "<p>HKDF is a two-phase key derivation function. The <strong>extract</strong> phase uses HMAC to remove any bias from the input material. The <strong>expand</strong> phase stretches the result into multiple independent keys. The Noise Protocol uses a simplified variant with no <code>info</code> parameter  -  it uses counter bytes (<code>0x01</code>, <code>0x02</code>) instead.</p>",
      steps:
        "<ol><li>Extract: Compute <code>temp_key = HMAC-SHA256(key=salt, msg=input_key_material)</code></li><li>Expand output 1: Compute <code>output1 = HMAC-SHA256(key=temp_key, msg=b'\\x01')</code></li><li>Expand output 2: Compute <code>output2 = HMAC-SHA256(key=temp_key, msg=output1 + b'\\x02')</code></li><li>Return <code>(output1, output2)</code></li></ol>",
      code: `import hmac, hashlib

def hkdf_two_keys(salt, input_key_material):
    # Extract
    temp_key = hmac.new(salt, input_key_material, hashlib.sha256).digest()
    # Expand
    output1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    output2 = hmac.new(temp_key, output1 + b'\\x02', hashlib.sha256).digest()
    return (output1, output2)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 4  -  Initialize Symmetric State
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-init-state": {
    id: "exercise-init-state",
    title: "Exercise 4: Initialize the Handshake State",
    description:
      "Initialize the SymmetricState for the Noise XK handshake. Compute the initial handshake hash (h) and chaining key (ck) from the protocol name, then mix in the prologue and the responder's static public key.",
    starterCode: `import hashlib

def initialize_symmetric_state(responder_static_pubkey):
    """
    Initialize the Noise XK handshake state.

    Steps:
      1. protocol_name = "Noise_XK_secp256k1_ChaChaPoly_SHA256"
      2. Since len(protocol_name) > 32: h = SHA256(protocol_name)
      3. ck = h
      4. Mix in prologue: h = SHA256(h || b"lightning")
      5. Mix in responder's static public key: h = SHA256(h || rs_pub)

    Args:
        responder_static_pubkey: bytes (33 bytes)  -  the responder's compressed
                                 secp256k1 public key

    Returns:
        tuple: (h, ck)
            h   -  32-byte handshake hash after mixing prologue and rs
            ck  -  32-byte chaining key (unchanged after step 3)
    """
    # TODO: Set protocol_name string
    # TODO: Compute h = SHA256(protocol_name) since it's > 32 bytes
    # TODO: Set ck = h
    # TODO: MixHash the prologue: h = SHA256(h || b"lightning")
    # TODO: MixHash the responder's static public key: h = SHA256(h || rs_pub)
    # TODO: Return (h, ck)
    pass
`,
    testCode: `
import hashlib
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def test_returns_tuple():
    _, rs_pub = _gen_key()
    result = initialize_symmetric_state(rs_pub)
    assert isinstance(result, tuple), "Must return a tuple"
    assert len(result) == 2, "Must return (h, ck)"

def test_output_lengths():
    _, rs_pub = _gen_key()
    h, ck = initialize_symmetric_state(rs_pub)
    assert len(h) == 32, f"h must be 32 bytes, got {len(h)}"
    assert len(ck) == 32, f"ck must be 32 bytes, got {len(ck)}"

def test_ck_is_initial_hash():
    _, rs_pub = _gen_key()
    h, ck = initialize_symmetric_state(rs_pub)
    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    expected_ck = hashlib.sha256(protocol_name).digest()
    assert ck == expected_ck, f"ck should be SHA256(protocol_name). Expected {expected_ck.hex()}, got {ck.hex()}"

def test_h_with_known_key():
    _, rs_pub = _gen_key()
    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h0 = hashlib.sha256(protocol_name).digest()
    h1 = hashlib.sha256(h0 + b"lightning").digest()
    h2 = hashlib.sha256(h1 + rs_pub).digest()
    h, ck = initialize_symmetric_state(rs_pub)
    assert h == h2, f"h mismatch after mixing prologue and rs_pub. Expected {h2.hex()}, got {h.hex()}"

def test_different_keys_different_h():
    _, pub1 = _gen_key()
    _, pub2 = _gen_key()
    h1, _ = initialize_symmetric_state(pub1)
    h2, _ = initialize_symmetric_state(pub2)
    assert h1 != h2, "Different responder keys must produce different h"
`,
    hints: {
      conceptual:
        '<p>The handshake state initialization binds the protocol identity and the known keys into the cryptographic state before any messages are exchanged. The protocol name becomes the starting hash, then the prologue (<code>b"lightning"</code>) and the responder\'s 33-byte compressed secp256k1 static public key are mixed in using SHA256 chaining: <code>h = SHA256(h || data)</code>. This is the <code>MixHash</code> operation.</p>',
      steps:
        '<ol><li>Set <code>protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"</code></li><li>Compute <code>h = hashlib.sha256(protocol_name).digest()</code> (since the name is longer than 32 bytes)</li><li>Set <code>ck = h</code> (chaining key starts as a copy of h)</li><li>MixHash the prologue: <code>h = hashlib.sha256(h + b"lightning").digest()</code></li><li>MixHash the responder\'s key: <code>h = hashlib.sha256(h + responder_static_pubkey).digest()</code></li><li>Return <code>(h, ck)</code></li></ol>',
      code: `def initialize_symmetric_state(responder_static_pubkey):
    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h  # chaining key starts as copy of h
    # MixHash prologue
    h = hashlib.sha256(h + b"lightning").digest()
    # MixHash responder's static public key
    h = hashlib.sha256(h + responder_static_pubkey).digest()
    return (h, ck)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 5  -  Act 1: Initiator
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-act1-initiator": {
    id: "exercise-act1-initiator",
    title: "Exercise 5: Act 1  -  Initiator Side",
    description:
      "Implement Act 1 of the XK handshake from Alice's (initiator) perspective. Mix the ephemeral public key into h, perform ECDH with the responder's static key (the 'es' token), derive a temporary key via HKDF, encrypt an empty payload, and produce the 50-byte Act 1 message.",
    starterCode: `import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def hkdf_two_keys(salt, ikm):
    """HKDF helper  -  you implemented this in Exercise 3."""
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def ecdh(priv_bytes, pub_bytes):
    """ECDH helper  -  you implemented this in Exercise 2."""
    priv_int = int.from_bytes(priv_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    shared_key = private_key.exchange(ec.ECDH(), public_key)
    return hashlib.sha256(shared_key).digest()

def act_one_initiator(h, ck, e_priv, e_pub, rs_pub):
    """
    Construct Act 1 message (initiator -> responder).

    Handshake pattern for Act 1 (XK): -> e, es

    Steps:
      1. MixHash(e_pub):   h = SHA256(h || e_pub)
      2. ECDH(e, rs):      ss = ECDH(e_priv, rs_pub)
      3. MixKey(ss):        ck, temp_k = HKDF(ck, ss)
      4. Encrypt:           c = ChaCha20Poly1305(temp_k, nonce=0, ad=h, pt=b"")
      5. MixHash(c):        h = SHA256(h || c)
      6. Message:           0x00 || e_pub || c

    Args:
        h:      32-byte handshake hash
        ck:     32-byte chaining key
        e_priv: 32-byte ephemeral private key (secp256k1)
        e_pub:  33-byte ephemeral public key (compressed secp256k1)
        rs_pub: 33-byte responder's static public key (compressed secp256k1)

    Returns:
        tuple: (message, h, ck)
            message  -  50 bytes: version(1) + e_pub(33) + tag(16)
    """
    # TODO: Step 1  -  MixHash the ephemeral public key
    # TODO: Step 2  -  Perform ECDH between ephemeral and responder's static key
    # TODO: Step 3  -  MixKey: derive new ck and temp_k using HKDF
    # TODO: Step 4  -  Encrypt empty payload with ChaCha20Poly1305
    #                 nonce = (0).to_bytes(12, 'little'), ad = h, plaintext = b""
    # TODO: Step 5  -  MixHash the ciphertext
    # TODO: Step 6  -  Assemble message: version byte (0x00) + e_pub + ciphertext
    # TODO: Return (message, h, ck)
    pass
`,
    testCode: `
import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def _ref_ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    raw = sk.exchange(ec.ECDH(), pk)
    return hashlib.sha256(raw).digest()

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _setup_act1():
    rs_priv, rs_pub = _gen_key()
    e_priv, e_pub = _gen_key()

    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h
    h = hashlib.sha256(h + b"lightning").digest()
    h = hashlib.sha256(h + rs_pub).digest()

    return h, ck, e_priv, e_pub, rs_pub, rs_priv

def test_returns_correct_types():
    h, ck, e_priv, e_pub, rs_pub, _ = _setup_act1()
    result = act_one_initiator(h, ck, e_priv, e_pub, rs_pub)
    assert isinstance(result, tuple), "Must return a tuple"
    assert len(result) == 3, "Must return (message, h, ck)"
    msg, new_h, new_ck = result
    assert isinstance(msg, bytes), "Message must be bytes"
    assert isinstance(new_h, bytes), "h must be bytes"
    assert isinstance(new_ck, bytes), "ck must be bytes"

def test_message_length():
    h, ck, e_priv, e_pub, rs_pub, _ = _setup_act1()
    msg, _, _ = act_one_initiator(h, ck, e_priv, e_pub, rs_pub)
    # BOLT 8 Act 1: version(1) + e_pub(33) + tag(16) = 50 bytes
    assert len(msg) == 50, f"Act 1 message must be 50 bytes, got {len(msg)}"

def test_starts_with_version_byte():
    h, ck, e_priv, e_pub, rs_pub, _ = _setup_act1()
    msg, _, _ = act_one_initiator(h, ck, e_priv, e_pub, rs_pub)
    assert msg[0:1] == b'\\x00', f"First byte must be version 0x00, got {msg[0:1].hex()}"

def test_contains_ephemeral_pubkey():
    h, ck, e_priv, e_pub, rs_pub, _ = _setup_act1()
    msg, _, _ = act_one_initiator(h, ck, e_priv, e_pub, rs_pub)
    assert msg[1:34] == e_pub, "Bytes 1-34 must be the 33-byte compressed ephemeral public key"

def test_verifiable_by_responder():
    h, ck, e_priv, e_pub, rs_pub, rs_priv = _setup_act1()
    msg, new_h, new_ck = act_one_initiator(h, ck, e_priv, e_pub, rs_pub)
    # Responder side verification
    re_pub = msg[1:34]
    c = msg[34:]
    # Responder recomputes h
    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    rh = hashlib.sha256(protocol_name).digest()
    rck = rh
    rh = hashlib.sha256(rh + b"lightning").digest()
    rh = hashlib.sha256(rh + rs_pub).digest()
    # MixHash(re_pub)
    rh = hashlib.sha256(rh + re_pub).digest()
    # ECDH(s, re)
    ss = _ref_ecdh(rs_priv, re_pub)
    rck, temp_k = _ref_hkdf(rck, ss)
    # Decrypt
    cipher = ChaCha20Poly1305(temp_k)
    nonce = (0).to_bytes(12, 'little')
    try:
        pt = cipher.decrypt(nonce, c, rh)
    except Exception as ex:
        assert False, f"Responder failed to decrypt Act 1 tag: {ex}"
    assert pt == b"", "Decrypted payload must be empty"
`,
    hints: {
      conceptual:
        "<p>Act 1 is the initiator's opening message. The <code>e</code> token means 'send your 33-byte compressed ephemeral public key' and <code>es</code> means 'perform ECDH between your ephemeral key and the responder's static key.' After the ECDH, you derive a temporary encryption key via HKDF and use it to encrypt (authenticate) an empty payload with ChaCha20-Poly1305. The 16-byte tag proves you know the responder's identity.</p>",
      steps:
        '<ol><li><strong>MixHash(e_pub)</strong>: <code>h = SHA256(h + e_pub)</code> (e_pub is 33 bytes)</li><li><strong>ECDH(e, rs)</strong>: <code>ss = ecdh(e_priv, rs_pub)</code></li><li><strong>MixKey</strong>: <code>ck, temp_k = hkdf_two_keys(ck, ss)</code></li><li><strong>Encrypt</strong>: Create <code>ChaCha20Poly1305(temp_k)</code>, encrypt with <code>nonce = (0).to_bytes(12, "little")</code>, <code>aad = h</code>, <code>plaintext = b""</code></li><li><strong>MixHash(c)</strong>: <code>h = SHA256(h + ciphertext)</code></li><li>Assemble: <code>b"\\x00" + e_pub + ciphertext</code> (1 + 33 + 16 = 50 bytes)</li></ol>',
      code: `def act_one_initiator(h, ck, e_priv, e_pub, rs_pub):
    # 1. MixHash ephemeral (33-byte compressed secp256k1 key)
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
    # 6. Assemble: version(1) + e_pub(33) + tag(16) = 50 bytes
    return (b'\\x00' + e_pub + c, h, ck)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 6  -  Act 1: Responder
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-act1-responder": {
    id: "exercise-act1-responder",
    title: "Exercise 6: Act 1  -  Responder Side",
    description:
      "Implement the responder's processing of Act 1. Parse the message, extract the initiator's ephemeral public key, perform the ECDH (using your static private key), derive the temporary key, and verify the authentication tag.",
    starterCode: `import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def hkdf_two_keys(salt, ikm):
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    shared_key = private_key.exchange(ec.ECDH(), public_key)
    return hashlib.sha256(shared_key).digest()

def act_one_responder(h, ck, s_priv, message):
    """
    Process Act 1 message (responder side).

    Steps:
      1. Parse: version(1) || re_pub(33) || c(16)
      2. Check version == 0x00
      3. MixHash(re_pub):   h = SHA256(h || re_pub)
      4. ECDH(s, re):       ss = ECDH(s_priv, re_pub)
      5. MixKey(ss):         ck, temp_k = HKDF(ck, ss)
      6. Decrypt & verify:   plaintext = Decrypt(temp_k, nonce=0, ad=h, ct=c)
      7. MixHash(c):         h = SHA256(h || c)

    Args:
        h:       32-byte handshake hash
        ck:      32-byte chaining key
        s_priv:  32-byte responder's static private key
        message: the 50-byte Act 1 message

    Returns:
        tuple: (re_pub, h, ck)
            re_pub  -  33-byte initiator's ephemeral public key (compressed)
            h       -  updated handshake hash
            ck      -  updated chaining key

    Raises:
        ValueError if version is wrong or tag verification fails.
    """
    # TODO: Parse the message: version(1) + re_pub(33) + c(16) = 50 bytes
    # TODO: Check version byte
    # TODO: MixHash(re_pub)
    # TODO: ECDH(s_priv, re_pub)
    # TODO: MixKey with HKDF
    # TODO: Decrypt and verify the tag
    # TODO: MixHash(c)
    # TODO: Return (re_pub, h, ck)
    pass
`,
    testCode: `
import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def _ref_ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    raw = sk.exchange(ec.ECDH(), pk)
    return hashlib.sha256(raw).digest()

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _make_act1():
    rs_priv, rs_pub = _gen_key()
    e_priv, e_pub = _gen_key()

    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h
    h = hashlib.sha256(h + b"lightning").digest()
    h = hashlib.sha256(h + rs_pub).digest()

    h_for_resp = h
    ck_for_resp = ck

    # Initiator builds Act 1
    h = hashlib.sha256(h + e_pub).digest()
    ss = _ref_ecdh(e_priv, rs_pub)
    ck, temp_k = _ref_hkdf(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    nonce = (0).to_bytes(12, 'little')
    c = cipher.encrypt(nonce, b"", h)
    h = hashlib.sha256(h + c).digest()
    msg = b'\\x00' + e_pub + c

    return msg, h_for_resp, ck_for_resp, rs_priv, e_pub, h, ck

def test_returns_correct_types():
    msg, h, ck, rs_priv, _, _, _ = _make_act1()
    result = act_one_responder(h, ck, rs_priv, msg)
    assert isinstance(result, tuple), "Must return a tuple"
    assert len(result) == 3, "Must return (re_pub, h, ck)"

def test_extracts_ephemeral_key():
    msg, h, ck, rs_priv, e_pub, _, _ = _make_act1()
    re_pub, _, _ = act_one_responder(h, ck, rs_priv, msg)
    assert re_pub == e_pub, "Must extract the correct 33-byte ephemeral public key"

def test_state_matches_initiator():
    msg, h, ck, rs_priv, _, init_h, init_ck = _make_act1()
    _, resp_h, resp_ck = act_one_responder(h, ck, rs_priv, msg)
    assert resp_h == init_h, f"Responder h must match initiator h after Act 1"
    assert resp_ck == init_ck, f"Responder ck must match initiator ck after Act 1"

def test_rejects_tampered_message():
    msg, h, ck, rs_priv, _, _, _ = _make_act1()
    tampered = msg[:-1] + bytes([(msg[-1] + 1) % 256])
    try:
        act_one_responder(h, ck, rs_priv, tampered)
        assert False, "Should have raised an error for tampered message"
    except (ValueError, Exception):
        pass

def test_rejects_wrong_version():
    msg, h, ck, rs_priv, _, _, _ = _make_act1()
    bad_msg = b'\\x01' + msg[1:]
    try:
        act_one_responder(h, ck, rs_priv, bad_msg)
        assert False, "Should have raised ValueError for wrong version"
    except (ValueError, Exception):
        pass
`,
    hints: {
      conceptual:
        "<p>The responder mirrors the initiator's operations. Since both sides perform the same MixHash and MixKey steps on the same data, they arrive at the same cryptographic state. The responder uses their static <em>private</em> key (instead of the initiator's ephemeral) for the ECDH  -  this works because ECDH is commutative: <code>DH(e, S) == DH(s, E)</code>.</p>",
      steps:
        '<ol><li>Parse: <code>version = message[0:1]</code>, <code>re_pub = message[1:34]</code>, <code>c = message[34:]</code> (33-byte compressed key)</li><li>Verify <code>version == b"\\x00"</code>, raise <code>ValueError</code> if not</li><li>MixHash: <code>h = SHA256(h + re_pub)</code></li><li>ECDH: <code>ss = ecdh(s_priv, re_pub)</code></li><li>MixKey: <code>ck, temp_k = hkdf_two_keys(ck, ss)</code></li><li>Decrypt: <code>ChaCha20Poly1305(temp_k).decrypt(nonce=0, data=c, aad=h)</code>  -  raises on bad tag</li><li>MixHash: <code>h = SHA256(h + c)</code></li><li>Return <code>(re_pub, h, ck)</code></li></ol>',
      code: `def act_one_responder(h, ck, s_priv, message):
    version = message[0:1]
    if version != b'\\x00':
        raise ValueError("Bad version")
    re_pub = message[1:34]  # 33-byte compressed secp256k1 key
    c = message[34:]
    h = hashlib.sha256(h + re_pub).digest()
    ss = ecdh(s_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    nonce = (0).to_bytes(12, 'little')
    cipher.decrypt(nonce, c, h)  # verify tag
    h = hashlib.sha256(h + c).digest()
    return (re_pub, h, ck)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 7  -  Act 2: Responder
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-act2-responder": {
    id: "exercise-act2-responder",
    title: "Exercise 7: Act 2  -  Responder Side",
    description:
      "Implement Act 2 from the responder's perspective. Generate and send the responder's ephemeral public key, perform the 'ee' ECDH (ephemeral-ephemeral), derive a new temporary key, and encrypt an empty payload. This introduces forward secrecy.",
    starterCode: `import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def hkdf_two_keys(salt, ikm):
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    shared_key = private_key.exchange(ec.ECDH(), public_key)
    return hashlib.sha256(shared_key).digest()

def act_two_responder(h, ck, e_priv, e_pub, re_pub):
    """
    Construct Act 2 message (responder -> initiator).

    Handshake pattern for Act 2 (XK): <- e, ee

    Steps:
      1. MixHash(e_pub):   h = SHA256(h || e_pub)
      2. ECDH(e, re):      ss = ECDH(e_priv, re_pub)  [ee DH]
      3. MixKey(ss):        ck, temp_k = HKDF(ck, ss)
      4. Encrypt:           c = ChaCha20Poly1305(temp_k, nonce=0, ad=h, pt=b"")
      5. MixHash(c):        h = SHA256(h || c)
      6. Message:           0x00 || e_pub || c

    Args:
        h:      32-byte handshake hash (after Act 1)
        ck:     32-byte chaining key (after Act 1)
        e_priv: 32-byte responder's ephemeral private key
        e_pub:  33-byte responder's ephemeral public key (compressed secp256k1)
        re_pub: 33-byte initiator's ephemeral public key (from Act 1)

    Returns:
        tuple: (message, h, ck)
            message  -  50 bytes: version(1) + e_pub(33) + tag(16)
    """
    # TODO: This follows the exact same structure as Act 1!
    # TODO: The only difference is which keys are used for ECDH.
    # TODO: Here it's ECDH(responder_ephemeral, initiator_ephemeral)  -  the 'ee' DH.
    pass
`,
    testCode: `
import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def _ref_ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    raw = sk.exchange(ec.ECDH(), pk)
    return hashlib.sha256(raw).digest()

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _setup_act2():
    rs_priv, rs_pub = _gen_key()
    ie_priv, ie_pub = _gen_key()
    re_priv, re_pub = _gen_key()

    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h
    h = hashlib.sha256(h + b"lightning").digest()
    h = hashlib.sha256(h + rs_pub).digest()

    # Simulate Act 1
    h = hashlib.sha256(h + ie_pub).digest()
    ss = _ref_ecdh(ie_priv, rs_pub)
    ck, temp_k = _ref_hkdf(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    c = cipher.encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c).digest()

    return h, ck, re_priv, re_pub, ie_pub, ie_priv

def test_message_format():
    h, ck, e_priv, e_pub, re_pub, _ = _setup_act2()
    msg, _, _ = act_two_responder(h, ck, e_priv, e_pub, re_pub)
    assert msg[0:1] == b'\\x00', "Must start with version 0x00"
    assert msg[1:34] == e_pub, "Bytes 1-34 must be responder's 33-byte ephemeral public key"
    assert len(msg) == 50, f"Message must be 50 bytes, got {len(msg)}"

def test_verifiable_by_initiator():
    h, ck, e_priv, e_pub, ie_pub, ie_priv = _setup_act2()
    msg, resp_h, resp_ck = act_two_responder(h, ck, e_priv, e_pub, ie_pub)

    # Initiator verifies
    re_pub = msg[1:34]
    c = msg[34:]
    init_h = hashlib.sha256(h + re_pub).digest()
    ss = _ref_ecdh(ie_priv, re_pub)
    init_ck, temp_k = _ref_hkdf(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    try:
        cipher.decrypt((0).to_bytes(12, 'little'), c, init_h)
    except Exception as ex:
        assert False, f"Initiator failed to verify Act 2: {ex}"
    init_h = hashlib.sha256(init_h + c).digest()
    assert init_h == resp_h, "Initiator and responder h must match after Act 2"
    assert init_ck == resp_ck, "Initiator and responder ck must match after Act 2"
`,
    hints: {
      conceptual:
        "<p>Act 2 has the same structure as Act 1  -  the only difference is which keys are used for ECDH. Instead of <code>es</code> (ephemeral→static), Act 2 performs <code>ee</code> (ephemeral→ephemeral). This is what provides <strong>forward secrecy</strong>: even if static keys are compromised later, the ephemeral-ephemeral DH secret cannot be recovered.</p>",
      steps:
        '<ol><li><strong>MixHash(e_pub)</strong>: <code>h = SHA256(h + e_pub)</code></li><li><strong>ECDH(e, re)</strong>: <code>ss = ecdh(e_priv, re_pub)</code>  -  note this is ephemeral-ephemeral!</li><li><strong>MixKey</strong>: <code>ck, temp_k = hkdf_two_keys(ck, ss)</code></li><li><strong>Encrypt</strong>: <code>ChaCha20Poly1305(temp_k).encrypt(nonce=0, plaintext=b"", aad=h)</code></li><li><strong>MixHash(c)</strong>: <code>h = SHA256(h + c)</code></li><li>Assemble: <code>b"\\x00" + e_pub + c</code></li></ol>',
      code: `def act_two_responder(h, ck, e_priv, e_pub, re_pub):
    # 1. MixHash ephemeral (33-byte compressed secp256k1)
    h = hashlib.sha256(h + e_pub).digest()
    # 2. ee DH
    ss = ecdh(e_priv, re_pub)
    # 3. MixKey
    ck, temp_k = hkdf_two_keys(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    c = cipher.encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c).digest()
    # version(1) + e_pub(33) + tag(16) = 50 bytes
    return (b'\\x00' + e_pub + c, h, ck)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 8  -  Act 2: Initiator
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-act2-initiator": {
    id: "exercise-act2-initiator",
    title: "Exercise 8: Act 2  -  Initiator Side",
    description:
      "Implement the initiator's processing of Act 2. Parse the responder's message, extract their ephemeral public key, perform the 'ee' ECDH, derive the temporary key, and verify the tag.",
    starterCode: `import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def hkdf_two_keys(salt, ikm):
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    shared_key = private_key.exchange(ec.ECDH(), public_key)
    return hashlib.sha256(shared_key).digest()

def act_two_initiator(h, ck, e_priv, message):
    """
    Process Act 2 message (initiator side).

    Steps:
      1. Parse: version(1) || re_pub(33) || c(16)
      2. Check version == 0x00
      3. MixHash(re_pub):   h = SHA256(h || re_pub)
      4. ECDH(e, re):       ss = ECDH(e_priv, re_pub)  [ee DH]
      5. MixKey(ss):         ck, temp_k = HKDF(ck, ss)
      6. Decrypt & verify:   Decrypt(temp_k, nonce=0, ad=h, ct=c)
      7. MixHash(c):         h = SHA256(h || c)

    Args:
        h:       32-byte handshake hash (after Act 1)
        ck:      32-byte chaining key (after Act 1)
        e_priv:  32-byte initiator's ephemeral private key
        message: 50-byte Act 2 message

    Returns:
        tuple: (re_pub, h, ck)
            re_pub  -  33-byte responder's ephemeral public key

    Raises:
        ValueError if version is wrong or tag fails.
    """
    # TODO: This mirrors Act 1 responder, but uses ephemeral key for ECDH
    pass
`,
    testCode: `
import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def _ref_ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    raw = sk.exchange(ec.ECDH(), pk)
    return hashlib.sha256(raw).digest()

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _setup_full_act2():
    rs_priv, rs_pub = _gen_key()
    ie_priv, ie_pub = _gen_key()
    re_priv, re_pub = _gen_key()

    protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
    h = hashlib.sha256(protocol_name).digest()
    ck = h
    h = hashlib.sha256(h + b"lightning").digest()
    h = hashlib.sha256(h + rs_pub).digest()

    # Act 1
    h = hashlib.sha256(h + ie_pub).digest()
    ss = _ref_ecdh(ie_priv, rs_pub)
    ck, temp_k = _ref_hkdf(ck, ss)
    c1 = ChaCha20Poly1305(temp_k).encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c1).digest()

    h_after_act1 = h
    ck_after_act1 = ck

    # Act 2 (responder builds)
    h = hashlib.sha256(h + re_pub).digest()
    ss = _ref_ecdh(re_priv, ie_pub)
    ck, temp_k = _ref_hkdf(ck, ss)
    c2 = ChaCha20Poly1305(temp_k).encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c2).digest()

    msg = b'\\x00' + re_pub + c2
    return msg, h_after_act1, ck_after_act1, ie_priv, re_pub, h, ck

def test_returns_correct_types():
    msg, h, ck, ie_priv, _, _, _ = _setup_full_act2()
    result = act_two_initiator(h, ck, ie_priv, msg)
    assert isinstance(result, tuple) and len(result) == 3, "Must return (re_pub, h, ck)"

def test_extracts_responder_ephemeral():
    msg, h, ck, ie_priv, re_pub, _, _ = _setup_full_act2()
    got_re_pub, _, _ = act_two_initiator(h, ck, ie_priv, msg)
    assert got_re_pub == re_pub, "Must extract correct 33-byte responder ephemeral public key"

def test_state_matches_responder():
    msg, h, ck, ie_priv, _, resp_h, resp_ck = _setup_full_act2()
    _, init_h, init_ck = act_two_initiator(h, ck, ie_priv, msg)
    assert init_h == resp_h, "Initiator h must match responder h after Act 2"
    assert init_ck == resp_ck, "Initiator ck must match responder ck after Act 2"

def test_rejects_tampered():
    msg, h, ck, ie_priv, _, _, _ = _setup_full_act2()
    tampered = msg[:-1] + bytes([(msg[-1] + 1) % 256])
    try:
        act_two_initiator(h, ck, ie_priv, tampered)
        assert False, "Should reject tampered message"
    except (ValueError, Exception):
        pass
`,
    hints: {
      conceptual:
        "<p>This is the mirror of Exercise 6 (Act 1 responder). The structure is identical  -  parse, MixHash, ECDH, MixKey, decrypt  -  but here you use the initiator's <em>ephemeral</em> private key for the ECDH instead of a static key. This is the <code>ee</code> DH that provides forward secrecy.</p>",
      steps:
        '<ol><li>Parse: <code>version = message[0:1]</code>, <code>re_pub = message[1:34]</code>, <code>c = message[34:]</code> (33-byte compressed key)</li><li>Verify version is <code>b"\\x00"</code></li><li>MixHash: <code>h = SHA256(h + re_pub)</code></li><li>ECDH: <code>ss = ecdh(e_priv, re_pub)</code></li><li>MixKey: <code>ck, temp_k = hkdf_two_keys(ck, ss)</code></li><li>Decrypt: <code>ChaCha20Poly1305(temp_k).decrypt(nonce=0, data=c, aad=h)</code></li><li>MixHash: <code>h = SHA256(h + c)</code></li></ol>',
      code: `def act_two_initiator(h, ck, e_priv, message):
    version = message[0:1]
    if version != b'\\x00':
        raise ValueError("Bad version")
    re_pub = message[1:34]  # 33-byte compressed secp256k1 key
    c = message[34:]
    h = hashlib.sha256(h + re_pub).digest()
    ss = ecdh(e_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    ChaCha20Poly1305(temp_k).decrypt((0).to_bytes(12, 'little'), c, h)
    h = hashlib.sha256(h + c).digest()
    return (re_pub, h, ck)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 9  -  Act 3: Initiator
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-act3-initiator": {
    id: "exercise-act3-initiator",
    title: "Exercise 9: Act 3  -  Identity Reveal & Key Split",
    description:
      "Implement Act 3 (BOLT 8), where the initiator reveals their identity by encrypting their static public key with temp_k2 at nonce=1 (since nonce=0 was used in Act 2). Then perform the final 'se' ECDH and derive the transport encryption keys via Split().",
    starterCode: `import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def hkdf_two_keys(salt, ikm):
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

def ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    private_key = ec.derive_private_key(priv_int, ec.SECP256K1())
    public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    shared_key = private_key.exchange(ec.ECDH(), public_key)
    return hashlib.sha256(shared_key).digest()

def act_three_initiator(h, ck, temp_k2, s_priv, s_pub, re_pub):
    """
    Construct Act 3 message and derive transport keys (BOLT 8).

    Handshake pattern for Act 3 (XK): -> s, se

    After Act 2, the CipherState holds temp_k2 with its nonce at 1
    (nonce=0 was used in Act 2's empty payload encryption).

    Steps:
      1. Encrypt static key:  c1 = encrypt(temp_k2, nonce=1, ad=h, pt=s_pub)
      2. MixHash(c1):         h = SHA256(h || c1)
      3. ECDH(s, re):         ss = ecdh(s_priv, re_pub)  [se DH]
      4. MixKey(ss):           ck, temp_k3 = HKDF(ck, ss)
      5. Encrypt auth tag:    c2 = encrypt(temp_k3, nonce=0, ad=h, pt=b"")
      6. MixHash(c2):         h = SHA256(h || c2)
      7. Split:               send_key, recv_key = HKDF(ck, b"")

    Args:
        h:        32-byte handshake hash (after Act 2)
        ck:       32-byte chaining key (after Act 2)
        temp_k2:  32-byte encryption key from Act 2's MixKey
        s_priv:   32-byte initiator's static private key
        s_pub:    33-byte initiator's static public key (compressed secp256k1)
        re_pub:   33-byte responder's ephemeral public key (compressed secp256k1)

    Returns:
        tuple: (message, send_key, recv_key)
            message   -  66 bytes: version(1) + encrypted_s_pub(33+16=49) + auth_tag(16)
            send_key  -  32-byte key for initiator -> responder messages
            recv_key  -  32-byte key for responder -> initiator messages
    """
    # TODO: Encrypt static public key using temp_k2 with nonce=1
    #       (nonce=0 was consumed in Act 2)
    #       c1 = ChaCha20Poly1305(temp_k2, nonce=1, ad=h, pt=s_pub)
    # TODO: MixHash(c1): h = SHA256(h || c1)
    # TODO: ECDH(s, re): ss = ecdh(s_priv, re_pub)  [se token]
    # TODO: MixKey: ck, temp_k3 = HKDF(ck, ss)
    # TODO: c2 = ChaCha20Poly1305(temp_k3, nonce=0, ad=h, pt=b"")
    # TODO: MixHash(c2): h = SHA256(h || c2)
    # TODO: Split: send_key, recv_key = HKDF(ck, b"")
    # TODO: Return (b"\\x00" + c1 + c2, send_key, recv_key)
    pass
`,
    testCode: `
import hashlib
import hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def _ref_ecdh(priv_bytes, pub_bytes):
    priv_int = int.from_bytes(priv_bytes, 'big')
    sk = ec.derive_private_key(priv_int, ec.SECP256K1())
    pk = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_bytes)
    raw = sk.exchange(ec.ECDH(), pk)
    return hashlib.sha256(raw).digest()

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _setup_act3():
    is_priv, is_pub = _gen_key()
    rs_priv, rs_pub = _gen_key()
    ie_priv, ie_pub = _gen_key()
    re_priv, re_pub = _gen_key()

    # Init
    h = hashlib.sha256(b"Noise_XK_secp256k1_ChaChaPoly_SHA256").digest()
    ck = h
    h = hashlib.sha256(h + b"lightning").digest()
    h = hashlib.sha256(h + rs_pub).digest()

    # Act 1
    h = hashlib.sha256(h + ie_pub).digest()
    ss = _ref_ecdh(ie_priv, rs_pub)
    ck, tk1 = _ref_hkdf(ck, ss)
    c1 = ChaCha20Poly1305(tk1).encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c1).digest()

    # Act 2
    h = hashlib.sha256(h + re_pub).digest()
    ss = _ref_ecdh(re_priv, ie_pub)
    ck, tk2 = _ref_hkdf(ck, ss)
    c2 = ChaCha20Poly1305(tk2).encrypt((0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c2).digest()

    # tk2 is the temp_k2 needed for Act 3 (nonce=0 was used above)
    return h, ck, tk2, is_priv, is_pub, re_pub, re_priv, rs_priv

def test_returns_correct_types():
    h, ck, tk2, s_priv, s_pub, re_pub, _, _ = _setup_act3()
    result = act_three_initiator(h, ck, tk2, s_priv, s_pub, re_pub)
    assert isinstance(result, tuple), "Must return a tuple"
    assert len(result) == 3, "Must return (message, send_key, recv_key)"
    msg, sk, rk = result
    assert isinstance(msg, bytes), "Message must be bytes"
    assert isinstance(sk, bytes), "send_key must be bytes"
    assert isinstance(rk, bytes), "recv_key must be bytes"

def test_message_length():
    h, ck, tk2, s_priv, s_pub, re_pub, _, _ = _setup_act3()
    msg, _, _ = act_three_initiator(h, ck, tk2, s_priv, s_pub, re_pub)
    # BOLT 8: version(1) + encrypted_s_pub(33+16=49) + auth_tag(16) = 66 bytes
    assert len(msg) == 66, f"Act 3 message must be 66 bytes, got {len(msg)}"

def test_transport_keys_length():
    h, ck, tk2, s_priv, s_pub, re_pub, _, _ = _setup_act3()
    _, sk, rk = act_three_initiator(h, ck, tk2, s_priv, s_pub, re_pub)
    assert len(sk) == 32, f"send_key must be 32 bytes, got {len(sk)}"
    assert len(rk) == 32, f"recv_key must be 32 bytes, got {len(rk)}"

def test_transport_keys_are_different():
    h, ck, tk2, s_priv, s_pub, re_pub, _, _ = _setup_act3()
    _, sk, rk = act_three_initiator(h, ck, tk2, s_priv, s_pub, re_pub)
    assert sk != rk, "send_key and recv_key must be different"

def test_responder_can_decrypt_static_key():
    h, ck, tk2, s_priv, s_pub, re_pub, re_priv, rs_priv = _setup_act3()
    msg, init_sk, init_rk = act_three_initiator(h, ck, tk2, s_priv, s_pub, re_pub)

    # Responder uses same temp_k2 with nonce=1 to decrypt c1
    c1 = msg[1:50]  # 33-byte encrypted pubkey + 16-byte tag = 49 bytes
    c2 = msg[50:]   # 16-byte auth tag
    cipher = ChaCha20Poly1305(tk2)
    try:
        decrypted_s_pub = cipher.decrypt((1).to_bytes(12, 'little'), c1, h)
    except Exception as ex:
        assert False, f"Responder failed to decrypt initiator's static key: {ex}"
    assert decrypted_s_pub == s_pub, "Decrypted static key must match initiator's 33-byte compressed pubkey"
`,
    hints: {
      conceptual:
        "<p>Act 3 is the most complex message. The initiator encrypts their 33-byte static public key using <code>temp_k2</code> (from Act 2) at <strong>nonce=1</strong> (because nonce=0 was already used in Act 2). Then the <code>se</code> ECDH provides final mutual authentication, and <code>Split()</code> derives the transport keys. Since the static key is encrypted with keys from prior ECDH operations, an eavesdropper cannot learn the initiator's identity.</p>",
      steps:
        '<ol><li>Encrypt static public key with temp_k2 at nonce=1: <code>c1 = ChaCha20Poly1305(temp_k2).encrypt(nonce=1, plaintext=s_pub, aad=h)</code></li><li>MixHash: <code>h = SHA256(h + c1)</code></li><li>ECDH(s, re): <code>ss = ecdh(s_priv, re_pub)</code></li><li>MixKey: <code>ck, temp_k3 = hkdf_two_keys(ck, ss)</code></li><li>Encrypt auth tag with temp_k3 at nonce=0: <code>c2 = ChaCha20Poly1305(temp_k3).encrypt(nonce=0, plaintext=b"", aad=h)</code></li><li>MixHash: <code>h = SHA256(h + c2)</code></li><li>Split: <code>send_key, recv_key = hkdf_two_keys(ck, b"")</code></li><li>Return <code>(b"\\x00" + c1 + c2, send_key, recv_key)</code></li></ol>',
      code: `def act_three_initiator(h, ck, temp_k2, s_priv, s_pub, re_pub):
    # Encrypt static key with temp_k2 at nonce=1
    # (nonce=0 was used in Act 2's empty payload encryption)
    c1 = ChaCha20Poly1305(temp_k2).encrypt(
        (1).to_bytes(12, 'little'), s_pub, h)
    h = hashlib.sha256(h + c1).digest()
    # se ECDH
    ss = ecdh(s_priv, re_pub)
    ck, temp_k3 = hkdf_two_keys(ck, ss)
    # Auth tag with temp_k3 at nonce=0
    c2 = ChaCha20Poly1305(temp_k3).encrypt(
        (0).to_bytes(12, 'little'), b"", h)
    h = hashlib.sha256(h + c2).digest()
    # Split into transport keys
    send_key, recv_key = hkdf_two_keys(ck, b"")
    # version(1) + c1(49) + c2(16) = 66 bytes
    return (b'\\x00' + c1 + c2, send_key, recv_key)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 10  -  Encrypt Transport Messages
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-encrypt": {
    id: "exercise-encrypt",
    title: "Exercise 10: Encrypt Transport Messages",
    description:
      "Implement the Lightning transport encryption format. Each message is framed as an encrypted 2-byte length prefix followed by an encrypted body. Both use ChaCha20-Poly1305 with incrementing nonces.",
    starterCode: `import struct
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def encrypt_message(key, nonce, plaintext):
    """
    Encrypt a Lightning transport message.

    Format:
      encrypted_length (18 bytes) = ChaCha(key, nonce, ad=b"", pt=2-byte-big-endian-length)
      encrypted_body (len+16 bytes) = ChaCha(key, nonce+1, ad=b"", pt=plaintext)

    Args:
        key:       32-byte encryption key
        nonce:     integer nonce (will be encoded as 12-byte little-endian)
        plaintext: bytes to encrypt

    Returns:
        tuple: (ciphertext_bytes, next_nonce)
            ciphertext_bytes  -  encrypted_length + encrypted_body
            next_nonce        -  nonce + 2 (two nonces consumed)
    """
    # TODO: Encode the length of plaintext as 2-byte big-endian
    # TODO: Encrypt the length bytes with ChaCha20Poly1305 using nonce
    # TODO: Encrypt the plaintext body with ChaCha20Poly1305 using nonce+1
    # TODO: Return (encrypted_length + encrypted_body, nonce + 2)
    pass
`,
    testCode: `
import struct
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
import os

def test_encrypt_returns_correct_types():
    key = os.urandom(32)
    result = encrypt_message(key, 0, b"hello")
    assert isinstance(result, tuple), "Must return a tuple"
    ct, next_nonce = result
    assert isinstance(ct, bytes), "Ciphertext must be bytes"
    assert isinstance(next_nonce, int), "next_nonce must be int"

def test_encrypt_output_length():
    key = os.urandom(32)
    msg = b"hello world"
    ct, _ = encrypt_message(key, 0, msg)
    expected_len = 18 + len(msg) + 16  # encrypted_length + encrypted_body
    assert len(ct) == expected_len, f"Expected {expected_len} bytes, got {len(ct)}"

def test_nonce_increment():
    key = os.urandom(32)
    _, n1 = encrypt_message(key, 0, b"first")
    assert n1 == 2, f"After one encrypt, nonce should be 2, got {n1}"
    _, n2 = encrypt_message(key, n1, b"second")
    assert n2 == 4, f"After two encrypts, nonce should be 4, got {n2}"

def test_encrypt_different_keys_produce_different_ciphertext():
    key1 = os.urandom(32)
    key2 = os.urandom(32)
    msg = b"same message"
    ct1, _ = encrypt_message(key1, 0, msg)
    ct2, _ = encrypt_message(key2, 0, msg)
    assert ct1 != ct2, "Different keys must produce different ciphertext"

def test_encrypt_empty_message():
    key = os.urandom(32)
    ct, n = encrypt_message(key, 0, b"")
    assert len(ct) == 18 + 16, f"Empty message should produce 34 bytes, got {len(ct)}"
    assert n == 2, f"Nonce should be 2 after encrypting, got {n}"
`,
    hints: {
      conceptual:
        "<p>Lightning frames each message with a 2-byte encrypted length prefix, followed by the encrypted message body. This prevents an observer from learning message sizes. Each encryption consumes one nonce, so a single message uses two nonces: one for the length, one for the body. Nonces are encoded as 12-byte little-endian integers.</p>",
      steps:
        '<ol><li>Encode plaintext length as 2-byte big-endian: <code>struct.pack(">H", len(plaintext))</code></li><li>Encrypt length: <code>enc_len = ChaCha20Poly1305(key).encrypt(nonce.to_bytes(12, "little"), length_bytes, b"")</code></li><li>Encrypt body: <code>enc_body = ChaCha20Poly1305(key).encrypt((nonce+1).to_bytes(12, "little"), plaintext, b"")</code></li><li>Return <code>(enc_len + enc_body, nonce + 2)</code></li></ol>',
      code: `def encrypt_message(key, nonce, plaintext):
    length_bytes = struct.pack(">H", len(plaintext))
    cipher = ChaCha20Poly1305(key)
    enc_len = cipher.encrypt(nonce.to_bytes(12, 'little'), length_bytes, b"")
    enc_body = cipher.encrypt((nonce + 1).to_bytes(12, 'little'), plaintext, b"")
    return (enc_len + enc_body, nonce + 2)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 11  -  Decrypt Transport Messages
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-decrypt": {
    id: "exercise-decrypt",
    title: "Exercise 11: Decrypt Transport Messages",
    description:
      "Implement the Lightning transport decryption format. Given an encrypted message (18-byte encrypted length prefix + encrypted body), decrypt and return the original plaintext. Use ChaCha20-Poly1305 with incrementing nonces  -  mirroring the encryption process.",
    starterCode: `import struct
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def decrypt_message(key, nonce, ciphertext):
    """
    Decrypt a Lightning transport message.

    The ciphertext format:
      encrypted_length (18 bytes) = ChaCha(key, nonce, ad=b"", ct=2-byte-big-endian-length + 16-byte MAC)
      encrypted_body (variable)   = ChaCha(key, nonce+1, ad=b"", ct=message + 16-byte MAC)

    Args:
        key:        32-byte decryption key
        nonce:      integer nonce (will be encoded as 12-byte little-endian)
        ciphertext: encrypted_length(18) + encrypted_body(variable)

    Returns:
        tuple: (plaintext, next_nonce)
            plaintext   -  the original message bytes
            next_nonce  -  nonce + 2 (two nonces consumed)
    """
    # TODO: Split ciphertext into encrypted_length (first 18 bytes) and encrypted_body
    # TODO: Decrypt the length field using nonce
    # TODO: Parse the 2-byte big-endian length
    # TODO: Decrypt the body using nonce+1
    # TODO: Return (plaintext, nonce + 2)
    pass
`,
    testCode: `
import struct
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
import os

# Helper: encrypt so we can test decryption
def _encrypt(key, nonce, plaintext):
    length_bytes = struct.pack(">H", len(plaintext))
    cipher = ChaCha20Poly1305(key)
    enc_len = cipher.encrypt(nonce.to_bytes(12, 'little'), length_bytes, b"")
    enc_body = cipher.encrypt((nonce + 1).to_bytes(12, 'little'), plaintext, b"")
    return (enc_len + enc_body, nonce + 2)

def test_decrypt_returns_correct_types():
    key = os.urandom(32)
    ct, _ = _encrypt(key, 0, b"hello")
    result = decrypt_message(key, 0, ct)
    assert isinstance(result, tuple), "Must return a tuple"
    pt, next_nonce = result
    assert isinstance(pt, bytes), "Plaintext must be bytes"
    assert isinstance(next_nonce, int), "next_nonce must be int"

def test_decrypt_simple_message():
    key = os.urandom(32)
    original = b"hello world"
    ct, _ = _encrypt(key, 0, original)
    pt, n = decrypt_message(key, 0, ct)
    assert pt == original, f"Expected {original!r}, got {pt!r}"
    assert n == 2, f"Expected nonce 2, got {n}"

def test_decrypt_nonce_tracking():
    key = os.urandom(32)
    ct1, enc_n = _encrypt(key, 0, b"first")
    ct2, _ = _encrypt(key, enc_n, b"second")
    _, dec_n = decrypt_message(key, 0, ct1)
    assert dec_n == 2, f"After first decrypt, nonce should be 2, got {dec_n}"
    pt2, dec_n2 = decrypt_message(key, dec_n, ct2)
    assert pt2 == b"second", f"Second message failed: got {pt2!r}"
    assert dec_n2 == 4, f"After second decrypt, nonce should be 4, got {dec_n2}"

def test_decrypt_multiple_messages():
    key = os.urandom(32)
    messages = [b"msg1", b"hello world", b"x" * 1000, b""]
    nonce = 0
    encrypted = []
    for msg in messages:
        ct, nonce = _encrypt(key, nonce, msg)
        encrypted.append(ct)
    dec_nonce = 0
    for i, ct in enumerate(encrypted):
        pt, dec_nonce = decrypt_message(key, dec_nonce, ct)
        assert pt == messages[i], f"Message {i} roundtrip failed"

def test_tamper_detection():
    key = os.urandom(32)
    ct, _ = _encrypt(key, 0, b"secret")
    tampered = ct[:-1] + bytes([(ct[-1] + 1) % 256])
    try:
        decrypt_message(key, 0, tampered)
        assert False, "Should detect tampered ciphertext"
    except Exception:
        pass

def test_wrong_key_fails():
    key1 = os.urandom(32)
    key2 = os.urandom(32)
    ct, _ = _encrypt(key1, 0, b"secret")
    try:
        decrypt_message(key2, 0, ct)
        assert False, "Should fail with wrong key"
    except Exception:
        pass
`,
    hints: {
      conceptual:
        "<p>Decryption mirrors encryption. The first 18 bytes contain the encrypted length prefix (2 bytes + 16-byte MAC). Decrypt it to learn the message length. Then decrypt the remaining body bytes using the next nonce. Each decryption consumes two nonces, matching what encryption produced.</p>",
      steps:
        '<ol><li>Split: <code>enc_len = ciphertext[:18]</code> and <code>enc_body = ciphertext[18:]</code></li><li>Decrypt length: <code>length_bytes = ChaCha20Poly1305(key).decrypt(nonce.to_bytes(12, "little"), enc_len, b"")</code></li><li>Parse: <code>msg_len = struct.unpack(">H", length_bytes)[0]</code></li><li>Decrypt body: <code>plaintext = ChaCha20Poly1305(key).decrypt((nonce+1).to_bytes(12, "little"), enc_body, b"")</code></li><li>Return <code>(plaintext, nonce + 2)</code></li></ol>',
      code: `def decrypt_message(key, nonce, ciphertext):
    cipher = ChaCha20Poly1305(key)
    enc_len = ciphertext[:18]
    length_bytes = cipher.decrypt(nonce.to_bytes(12, 'little'), enc_len, b"")
    msg_len = struct.unpack(">H", length_bytes)[0]
    enc_body = ciphertext[18:]
    plaintext = cipher.decrypt((nonce + 1).to_bytes(12, 'little'), enc_body, b"")
    return (plaintext, nonce + 2)`,
    },
    rewardSats: 21,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 12  -  Key Rotation
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-key-rotation": {
    id: "exercise-key-rotation",
    title: "Exercise 12: Key Rotation",
    description:
      "Implement Lightning's key rotation scheme. After every 1000 messages (500 encrypt calls, since each uses 2 nonces), the sending key must be rotated by deriving a new key from the old one using HKDF. Implement a CipherState class that tracks the nonce, automatically rotates the key at the threshold, and encrypts/decrypts transport messages.",
    starterCode: `import struct
import hmac
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

ROTATION_THRESHOLD = 1000  # rotate after nonce reaches 1000

def hkdf_two_keys(salt, ikm):
    """HKDF helper  -  you implemented this in Exercise 3."""
    temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
    out1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
    out2 = hmac.new(temp_key, out1 + b'\\x02', hashlib.sha256).digest()
    return (out1, out2)

class CipherState:
    """
    Manages encryption key and nonce for one direction of transport.

    Key rotation rule (BOLT 8):
      When the nonce reaches 1000, rotate the key:
        1. new_ck, new_key = HKDF(chaining_key, key)
        2. Update chaining_key = new_ck
        3. Update key = new_key
        4. Reset nonce to 0

    Attributes:
        key:          32-byte ChaCha20-Poly1305 encryption key
        chaining_key: 32-byte chaining key used for rotation
        nonce:        integer nonce counter
    """

    def __init__(self, key, chaining_key):
        """
        Initialize the CipherState.

        Args:
            key:          32-byte encryption key (from Split)
            chaining_key: 32-byte chaining key (from Split)
        """
        # TODO: Store the key, chaining_key, and initialize nonce to 0
        pass

    def _maybe_rotate(self):
        """
        Check if the nonce has reached the rotation threshold.
        If so, derive new key and chaining_key via HKDF, reset nonce to 0.
        """
        # TODO: If nonce >= ROTATION_THRESHOLD:
        #   new_ck, new_key = hkdf_two_keys(self.chaining_key, self.key)
        #   self.chaining_key = new_ck
        #   self.key = new_key
        #   self.nonce = 0
        pass

    def encrypt_message(self, plaintext):
        """
        Encrypt a transport message (length-prefix + body) and advance nonce.
        Automatically rotates key if nonce threshold is reached.

        Args:
            plaintext: bytes to encrypt

        Returns:
            bytes: encrypted_length(18) + encrypted_body(len+16)
        """
        # TODO: Check for rotation before encrypting
        # TODO: Encrypt length prefix with current nonce
        # TODO: Encrypt body with nonce + 1
        # TODO: Advance nonce by 2
        # TODO: Return encrypted_length + encrypted_body
        pass

    def decrypt_message(self, ciphertext):
        """
        Decrypt a transport message and advance nonce.
        Automatically rotates key if nonce threshold is reached.

        Args:
            ciphertext: encrypted_length(18) + encrypted_body(variable)

        Returns:
            bytes: decrypted plaintext
        """
        # TODO: Check for rotation before decrypting
        # TODO: Decrypt length prefix with current nonce
        # TODO: Decrypt body with nonce + 1
        # TODO: Advance nonce by 2
        # TODO: Return plaintext
        pass
`,
    testCode: `
import struct
import hmac
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

ROTATION_THRESHOLD = 1000

def _ref_hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return (o1, o2)

def test_init_stores_state():
    key = os.urandom(32)
    ck = os.urandom(32)
    cs = CipherState(key, ck)
    assert cs.key == key, "key must be stored"
    assert cs.chaining_key == ck, "chaining_key must be stored"
    assert cs.nonce == 0, f"nonce must start at 0, got {cs.nonce}"

def test_basic_roundtrip():
    key = os.urandom(32)
    ck = os.urandom(32)
    sender = CipherState(key, ck)
    receiver = CipherState(key, ck)
    msg = b"hello lightning"
    ct = sender.encrypt_message(msg)
    pt = receiver.decrypt_message(ct)
    assert pt == msg, f"Roundtrip failed: expected {msg!r}, got {pt!r}"

def test_nonce_advances():
    key = os.urandom(32)
    ck = os.urandom(32)
    cs = CipherState(key, ck)
    cs.encrypt_message(b"msg1")
    assert cs.nonce == 2, f"After 1 message, nonce should be 2, got {cs.nonce}"
    cs.encrypt_message(b"msg2")
    assert cs.nonce == 4, f"After 2 messages, nonce should be 4, got {cs.nonce}"

def test_multiple_messages_roundtrip():
    key = os.urandom(32)
    ck = os.urandom(32)
    sender = CipherState(key, ck)
    receiver = CipherState(key, ck)
    messages = [b"first", b"second", b"third", b"x" * 500]
    for msg in messages:
        ct = sender.encrypt_message(msg)
        pt = receiver.decrypt_message(ct)
        assert pt == msg, f"Roundtrip failed for {msg[:20]!r}"

def test_key_rotation_occurs():
    key = os.urandom(32)
    ck = os.urandom(32)
    cs = CipherState(key, ck)
    original_key = cs.key
    # Send 500 messages (each uses 2 nonces -> nonce reaches 1000)
    for i in range(500):
        cs.encrypt_message(b"m")
    # After 500 messages nonce would be 1000, rotation should have happened
    assert cs.key != original_key, "Key must have rotated after 500 messages (nonce reached 1000)"
    assert cs.nonce < ROTATION_THRESHOLD, f"Nonce must have reset after rotation, got {cs.nonce}"

def test_rotation_keys_match():
    key = os.urandom(32)
    ck = os.urandom(32)
    sender = CipherState(key, ck)
    receiver = CipherState(key, ck)
    # Send 501 messages  -  crosses rotation boundary
    for i in range(501):
        ct = sender.encrypt_message(f"message {i}".encode())
        pt = receiver.decrypt_message(ct)
        assert pt == f"message {i}".encode(), f"Roundtrip failed at message {i}"

def test_tamper_after_rotation():
    key = os.urandom(32)
    ck = os.urandom(32)
    sender = CipherState(key, ck)
    receiver = CipherState(key, ck)
    # Cross the rotation boundary
    for i in range(500):
        ct = sender.encrypt_message(b"x")
        receiver.decrypt_message(ct)
    # Now both have rotated  -  tamper with next message
    ct = sender.encrypt_message(b"secret")
    tampered = ct[:-1] + bytes([(ct[-1] + 1) % 256])
    try:
        receiver.decrypt_message(tampered)
        assert False, "Should detect tampered ciphertext after key rotation"
    except Exception:
        pass
`,
    hints: {
      conceptual:
        "<p>Key rotation prevents a single key from being used for too many encryptions, which could weaken security. In BOLT 8, every 1000 nonces the encryption key is rotated by running HKDF on the current chaining key and encryption key. This produces a new chaining key and a new encryption key. The nonce resets to 0. Both sides rotate independently but in sync since they process the same number of messages.</p>",
      steps:
        '<ol><li><code>__init__</code>: Store <code>self.key = key</code>, <code>self.chaining_key = chaining_key</code>, <code>self.nonce = 0</code></li><li><code>_maybe_rotate</code>: If <code>self.nonce >= 1000</code>, call <code>hkdf_two_keys(self.chaining_key, self.key)</code> to get <code>(new_ck, new_key)</code>, then update both and reset nonce to 0</li><li><code>encrypt_message</code>: Call <code>_maybe_rotate()</code>, encode length as 2-byte big-endian, encrypt length with nonce, encrypt body with nonce+1, advance nonce by 2, return concatenated ciphertext</li><li><code>decrypt_message</code>: Call <code>_maybe_rotate()</code>, split first 18 bytes, decrypt length, decrypt body, advance nonce by 2, return plaintext</li></ol>',
      code: `class CipherState:
    def __init__(self, key, chaining_key):
        self.key = key
        self.chaining_key = chaining_key
        self.nonce = 0

    def _maybe_rotate(self):
        if self.nonce >= ROTATION_THRESHOLD:
            new_ck, new_key = hkdf_two_keys(self.chaining_key, self.key)
            self.chaining_key = new_ck
            self.key = new_key
            self.nonce = 0

    def encrypt_message(self, plaintext):
        self._maybe_rotate()
        length_bytes = struct.pack(">H", len(plaintext))
        cipher = ChaCha20Poly1305(self.key)
        enc_len = cipher.encrypt(
            self.nonce.to_bytes(12, 'little'), length_bytes, b"")
        enc_body = cipher.encrypt(
            (self.nonce + 1).to_bytes(12, 'little'), plaintext, b"")
        self.nonce += 2
        return enc_len + enc_body

    def decrypt_message(self, ciphertext):
        self._maybe_rotate()
        cipher = ChaCha20Poly1305(self.key)
        enc_len = ciphertext[:18]
        length_bytes = cipher.decrypt(
            self.nonce.to_bytes(12, 'little'), enc_len, b"")
        enc_body = ciphertext[18:]
        plaintext = cipher.decrypt(
            (self.nonce + 1).to_bytes(12, 'little'), enc_body, b"")
        self.nonce += 2
        return plaintext`,
    },
    rewardSats: 21,
  },
};
