export interface CodeBlock {
  code: string;
  explanation: string;
}

export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  sampleCode: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
    codeBlocks?: CodeBlock[];
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
      "Implement secp256k1 keypair generation - the foundation of all Diffie-Hellman operations in Lightning's Noise Protocol. Lightning uses secp256k1 (the same curve as Bitcoin). Return a 32-byte private key and a 33-byte compressed public key.",
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
    sampleCode: `# Exercise 1 - Explore secp256k1 keypair generation
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

# Generate a keypair
private_key = ec.generate_private_key(ec.SECP256K1())
public_key = private_key.public_key()

# Serialize to raw bytes
priv_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
pub_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.CompressedPoint)

print("Private key (hex):", priv_bytes.hex())
print("Private key length:", len(priv_bytes), "bytes")
print()
print("Public key (hex):", pub_bytes.hex())
print("Public key length:", len(pub_bytes), "bytes")
print("Prefix byte:", hex(pub_bytes[0]), "(0x02=even y, 0x03=odd y)")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Generate a secp256k1 keypair and return the private key as 32 raw bytes and the public key in 33-byte compressed (SEC1) format.<br><br><strong>Key details:</strong> A compressed public key is 33 bytes: a <code>02</code> or <code>03</code> prefix byte indicating the y-coordinate parity, followed by the 32-byte x-coordinate. Lightning uses secp256k1, the same elliptic curve as Bitcoin.<br><br><strong>Tools you will need:</strong> <code>ec.generate_private_key()</code> to create a key on the <code>SECP256K1</code> curve, <code>.private_numbers().private_value</code> to extract the raw scalar, and <code>.public_bytes()</code> with <code>Encoding.X962</code> and <code>PublicFormat.CompressedPoint</code> for serialization.</p>",
      steps:
        '<ol><li>Generate a new private key on the <code>SECP256K1</code> curve using <code>ec.generate_private_key()</code></li><li>Derive the corresponding public key from the private key object</li><li>Serialize the private key by extracting the raw integer value via <code>.private_numbers().private_value</code> and converting it to 32 bytes in big-endian format</li><li>Serialize the public key to compressed SEC1 format using <code>.public_bytes()</code> with the appropriate encoding and format arguments</li><li>Return both as a tuple <code>(priv_bytes, pub_bytes)</code></li></ol>',
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
      "Implement the secp256k1 ECDH exchange as defined in BOLT 8. Given your 32-byte private key and a remote party's 33-byte compressed public key, compute the 32-byte shared secret. BOLT 8 defines ECDH as: compute the shared point, represent it in compressed format, then return its SHA-256 hash. This is the core operation behind every handshake token (ee, es, se, ss).",
    starterCode: `from ecdsa import SigningKey, VerifyingKey, SECP256k1
import hashlib

def ecdh(local_private_key_bytes, remote_public_key_bytes):
    """
    Perform secp256k1 ECDH key exchange (BOLT 8 variant).

    BOLT 8 defines ECDH(k, rk) as: perform an EC Diffie-Hellman using
    secp256k1 private key k and public key rk, then return the SHA-256
    hash of the compressed format of the resulting shared point.

    Steps:
      1. Perform scalar multiplication: shared_point = private_key * remote_public_key
      2. Compress the shared point (02/03 prefix + 32-byte x-coordinate)
      3. Return SHA-256 of the compressed point

    Args:
        local_private_key_bytes:  32-byte private key (bytes)
            e.g. b'\\x9a\\x1f...\\xc3' (32 random bytes)
        remote_public_key_bytes:  33-byte compressed public key (bytes)
            e.g. b'\\x02\\xab\\xcd...\\xef' (0x02 or 0x03 prefix + 32-byte x-coordinate)

    Returns:
        bytes: 32-byte shared secret (SHA-256 of compressed shared point)
    """
    # TODO: Load the private key using SigningKey.from_string()
    # TODO: Load the remote public key using VerifyingKey.from_string()
    # TODO: Multiply: shared_point = remote_pubkey_point * private_key_scalar
    # TODO: Compress the shared point (prefix byte + x-coordinate)
    # TODO: Return SHA-256 of the compressed point
    pass
`,
    testCode: `
from ecdsa import SigningKey, VerifyingKey, SECP256k1 as _SECP
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib as _hl

def _gen_key():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _ref_ecdh(priv_bytes, pub_bytes):
    sk = SigningKey.from_string(priv_bytes, curve=_SECP)
    vk = VerifyingKey.from_string(pub_bytes, curve=_SECP)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return _hl.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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

def test_bolt8_correctness():
    priv1, _ = _gen_key()
    _, pub2 = _gen_key()
    secret = ecdh(priv1, pub2)
    # BOLT 8: SHA-256 of the compressed format of the shared point
    expected = _ref_ecdh(priv1, pub2)
    assert secret == expected, "ECDH must return SHA-256 of compressed shared point (BOLT 8)"
`,
    sampleCode: `# Exercise 2 - Explore ECDH key exchange
from ecdsa import SigningKey, VerifyingKey, SECP256k1
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib

# Generate two keypairs (Alice and Bob)
alice_sk = ec.generate_private_key(ec.SECP256K1())
alice_priv = alice_sk.private_numbers().private_value.to_bytes(32, 'big')
alice_pub = alice_sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)

bob_sk = ec.generate_private_key(ec.SECP256K1())
bob_priv = bob_sk.private_numbers().private_value.to_bytes(32, 'big')
bob_pub = bob_sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)

print("Alice pub:", alice_pub.hex())
print("Bob pub:  ", bob_pub.hex())

# BOLT 8 ECDH: Alice uses her private key + Bob's public key
# Returns SHA-256 of the compressed shared point
def bolt8_ecdh(priv, pub):
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

bolt8_secret_ab = bolt8_ecdh(alice_priv, bob_pub)

# Bob computes the same thing with his private key + Alice's public key
bolt8_secret_ba = bolt8_ecdh(bob_priv, alice_pub)

print()
print("BOLT 8 shared secret (Alice):", bolt8_secret_ab.hex())
print("BOLT 8 shared secret (Bob):  ", bolt8_secret_ba.hex())
print("Match:", bolt8_secret_ab == bolt8_secret_ba)
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Perform a BOLT 8 ECDH key exchange: given a 32-byte private key and a 33-byte compressed public key, compute a 32-byte shared secret.<br><br><strong>Key details:</strong> BOLT 8 defines ECDH as: compute the shared point using elliptic curve Diffie-Hellman, represent it in <strong>compressed format</strong> (prefix byte + x-coordinate), then return the <strong>SHA-256 hash</strong>. You need three steps: scalar multiplication, point compression, and hashing.<br><br><strong>Tools you will need:</strong> <code>SigningKey.from_string()</code> and <code>VerifyingKey.from_string()</code> from <code>ecdsa</code> to load keys, point arithmetic via <code>vk.pubkey.point * sk.privkey.secret_multiplier</code>, and <code>hashlib.sha256()</code> for the final hash.</p>",
      steps:
        '<ol><li>Load the private key with <code>SigningKey.from_string(priv_bytes, curve=SECP256k1)</code></li><li>Load the remote public key with <code>VerifyingKey.from_string(pub_bytes, curve=SECP256k1)</code></li><li>Compute the shared point: <code>vk.pubkey.point * sk.privkey.secret_multiplier</code></li><li>Compress the point: prefix is <code>\\x02</code> if y is even, <code>\\x03</code> if odd, followed by the 32-byte x-coordinate</li><li>Return <code>hashlib.sha256(compressed_point).digest()</code></li></ol>',
      code: `def ecdh(local_private_key_bytes, remote_public_key_bytes):
    sk = SigningKey.from_string(local_private_key_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(remote_public_key_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()`,
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
    sampleCode: `# Exercise 3 - Explore HKDF key derivation
import hmac
import hashlib

# Sample inputs
salt = b"noise_chaining_key______________"  # 32 bytes (the chaining key)
ikm = b"shared_secret___________________"  # 32 bytes (e.g. from ECDH)

print("Salt (hex):", salt.hex())
print("IKM  (hex):", ikm.hex())

# Extract phase: compress input into a fixed-size key
temp_key = hmac.new(salt, ikm, hashlib.sha256).digest()
print()
print("temp_key:", temp_key.hex())

# Expand phase: derive two independent keys
output1 = hmac.new(temp_key, b'\\x01', hashlib.sha256).digest()
output2 = hmac.new(temp_key, output1 + b'\\x02', hashlib.sha256).digest()

print()
print("output1:", output1.hex())
print("output2:", output2.hex())
print("Both 32 bytes:", len(output1) == 32 and len(output2) == 32)
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Implement the Noise Protocol's HKDF variant: given a salt (chaining key) and input key material, derive two independent 32-byte keys.<br><br><strong>How it works:</strong> The <strong>extract</strong> phase compresses the input into a pseudorandom key using HMAC-SHA256. The <strong>expand</strong> phase derives two output keys by HMAC-ing counter bytes (<code>0x01</code> for key 1, then key 1 concatenated with <code>0x02</code> for key 2). Unlike standard HKDF, Noise uses no <code>info</code> parameter.<br><br><strong>Tools you will need:</strong> <code>hmac.new()</code> with <code>hashlib.sha256</code> for all three HMAC operations.</p>",
      steps:
        "<ol><li><strong>Extract:</strong> Derive a temporary key by calling <code>hmac.new()</code> with the salt as the HMAC key and the input key material as the message, using <code>hashlib.sha256</code></li><li><strong>Expand (key 1):</strong> Derive the first output by HMAC-ing the single byte <code>0x01</code> with the temporary key</li><li><strong>Expand (key 2):</strong> Derive the second output by HMAC-ing the first output concatenated with byte <code>0x02</code>, again using the temporary key</li><li>Return both outputs as a tuple</li></ol>",
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
    sampleCode: `# Exercise 4 - Explore handshake state initialization
import hashlib
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

# Generate a sample responder key (Bob's static key)
rs_sk = ec.generate_private_key(ec.SECP256K1())
rs_pub = rs_sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)

protocol_name = b"Noise_XK_secp256k1_ChaChaPoly_SHA256"
print("Protocol name:", protocol_name.decode())
print("Length:", len(protocol_name), "bytes (> 32, so we hash it)")

# Step 1-2: h = SHA256(protocol_name)
h = hashlib.sha256(protocol_name).digest()
print()
print("h0 = SHA256(protocol_name):", h.hex())

# Step 3: ck = h
ck = h
print("ck = h0:", ck.hex())

# Step 4: MixHash prologue
h = hashlib.sha256(h + b"lightning").digest()
print()
print("h1 = SHA256(h0 || 'lightning'):", h.hex())

# Step 5: MixHash responder's static public key
h = hashlib.sha256(h + rs_pub).digest()
print("h2 = SHA256(h1 || rs_pub):    ", h.hex())

print()
print("Final h:", h.hex())
print("Final ck:", ck.hex(), "(unchanged)")
`,
    hints: {
      conceptual:
        '<p><strong>Goal:</strong> Initialize the Noise XK handshake state by computing the initial handshake hash (<code>h</code>) and chaining key (<code>ck</code>) from the protocol name, then mixing in the prologue and responder\'s static public key.<br><br><strong>How it works:</strong> The <code>MixHash</code> operation chains data into the hash: <code>h = SHA256(h || data)</code>. First, the protocol name is hashed to create the initial <code>h</code> (since it exceeds 32 bytes). The chaining key starts as a copy of <code>h</code>. Then the prologue (<code>b"lightning"</code>) and the responder\'s 33-byte static public key are mixed in sequentially.<br><br><strong>Tools you will need:</strong> <code>hashlib.sha256()</code> for all hashing operations, and byte concatenation (<code>+</code>) to combine hash inputs.</p>',
      steps:
        '<ol><li>Define the protocol name as a byte string: <code>b"Noise_XK_secp256k1_ChaChaPoly_SHA256"</code></li><li>Hash the protocol name with <code>hashlib.sha256()</code> to produce the initial handshake hash <code>h</code></li><li>Set the chaining key <code>ck</code> to a copy of <code>h</code></li><li>MixHash the prologue by hashing <code>h</code> concatenated with <code>b"lightning"</code></li><li>MixHash the responder\'s static public key by hashing <code>h</code> concatenated with the key bytes</li><li>Return <code>(h, ck)</code></li></ol>',
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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    #                 nonce = b'\\x00' * 4 + (0).to_bytes(8, 'little'), ad = h, plaintext = b""
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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    nonce = b'\\x00' * 4 + (0).to_bytes(8, 'little')
    try:
        pt = cipher.decrypt(nonce, c, rh)
    except Exception as ex:
        assert False, f"Responder failed to decrypt Act 1 tag: {ex}"
    assert pt == b"", "Decrypted payload must be empty"
`,
    sampleCode: `# Exercise 5 - Explore Act 1 (Initiator side)
import hashlib, hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _gen():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _ecdh(priv, pub):
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

def _hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return o1, o2

# Setup: generate keys and initialize state
rs_priv, rs_pub = _gen()  # responder's static key
e_priv, e_pub = _gen()    # initiator's ephemeral key

h = hashlib.sha256(b"Noise_XK_secp256k1_ChaChaPoly_SHA256").digest()
ck = h
h = hashlib.sha256(h + b"lightning").digest()
h = hashlib.sha256(h + rs_pub).digest()

print("=== Act 1: -> e, es ===")
print("e_pub:", e_pub.hex())

# Step 1: MixHash(e_pub)
h = hashlib.sha256(h + e_pub).digest()
print("h after MixHash(e_pub):", h.hex()[:32] + "...")

# Step 2: ECDH(e, rs) - the 'es' token
ss = _ecdh(e_priv, rs_pub)
print("es shared secret:", ss.hex()[:32] + "...")

# Step 3: MixKey
ck, temp_k = _hkdf(ck, ss)

# Step 4: Encrypt empty payload
c = ChaCha20Poly1305(temp_k).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
print("Auth tag (16 bytes):", c.hex())

# Step 5: MixHash(c)
h = hashlib.sha256(h + c).digest()

# Step 6: Assemble message
msg = b'\\x00' + e_pub + c
print()
print("Act 1 message:", msg.hex())
print("Length:", len(msg), "bytes (1 + 33 + 16 = 50)")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Construct the 50-byte Act 1 message as the initiator. This message commits your ephemeral public key and proves you know the responder's static public key.<br><br><strong>How it works:</strong> The Noise <code>e, es</code> pattern means: (1) MixHash your ephemeral public key, (2) perform ECDH between your ephemeral key and the responder's static key, (3) derive a temporary key via HKDF, and (4) encrypt an empty payload to produce a 16-byte authentication tag. The final message is: version byte + ephemeral public key (33 bytes) + tag (16 bytes).<br><br><strong>Tools you will need:</strong> <code>hashlib.sha256()</code> for MixHash, <code>ecdh()</code> and <code>hkdf_two_keys()</code> from earlier exercises, and <code>ChaCha20Poly1305</code> for authenticated encryption with BOLT 8 nonce encoding (4 zero bytes + 8-byte little-endian counter).</p>",
      steps:
        '<ol><li><strong>MixHash</strong> the ephemeral public key into the handshake hash using <code>hashlib.sha256()</code></li><li><strong>ECDH</strong>: Compute the shared secret using <code>ecdh()</code> with your ephemeral private key and the responder\'s static public key</li><li><strong>MixKey</strong>: Derive a new chaining key and temporary encryption key using <code>hkdf_two_keys()</code></li><li><strong>Encrypt</strong>: Use <code>ChaCha20Poly1305</code> with the temporary key to encrypt an empty plaintext, passing the handshake hash as associated data and nonce 0 (BOLT 8 format: 4 zero bytes + 8-byte little-endian)</li><li><strong>MixHash</strong> the ciphertext (authentication tag) into the handshake hash</li><li>Assemble the 50-byte message: version byte (<code>0x00</code>) + ephemeral public key + authentication tag</li></ol>',
      code: `def act_one_initiator(h, ck, e_priv, e_pub, rs_pub):
    # 1. MixHash ephemeral (33-byte compressed secp256k1 key)
    h = hashlib.sha256(h + e_pub).digest()
    # 2. ECDH(e, rs)
    ss = ecdh(e_priv, rs_pub)
    # 3. MixKey
    ck, temp_k = hkdf_two_keys(ck, ss)
    # 4. Encrypt empty payload
    cipher = ChaCha20Poly1305(temp_k)
    nonce = b'\\x00' * 4 + (0).to_bytes(8, 'little')
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
    """ECDH helper  -  you implemented this in Exercise 2."""
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    nonce = b'\\x00' * 4 + (0).to_bytes(8, 'little')
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
    sampleCode: `# Exercise 6 - Explore Act 1 (Responder side)
# The responder mirrors the initiator's steps using their static private key.
# Try parsing and verifying a real Act 1 message!

import hashlib, hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _gen():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _ecdh(priv, pub):
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

def _hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return o1, o2

# Setup keys
rs_priv, rs_pub = _gen()
e_priv, e_pub = _gen()

# Initialize state
h = hashlib.sha256(b"Noise_XK_secp256k1_ChaChaPoly_SHA256").digest()
ck = h
h = hashlib.sha256(h + b"lightning").digest()
h = hashlib.sha256(h + rs_pub).digest()
h_saved, ck_saved = h, ck

# Build Act 1 (initiator)
h = hashlib.sha256(h + e_pub).digest()
ss = _ecdh(e_priv, rs_pub)
ck, temp_k = _hkdf(ck, ss)
c = ChaCha20Poly1305(temp_k).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + c).digest()
msg = b'\\x00' + e_pub + c

print("=== Act 1 Responder Processing ===")
print("Message:", msg.hex())

# Now process as responder
h_r, ck_r = h_saved, ck_saved
version = msg[0:1]
re_pub = msg[1:34]
tag = msg[34:]
print("Version:", version.hex())
print("Ephemeral key:", re_pub.hex())
print("Tag:", tag.hex())

h_r = hashlib.sha256(h_r + re_pub).digest()
ss_r = _ecdh(rs_priv, re_pub)  # s, re (commutativity!)
print()
print("ECDH(s, re) == ECDH(e, rs)?", ss_r == ss)

ck_r, temp_k_r = _hkdf(ck_r, ss_r)
ChaCha20Poly1305(temp_k_r).decrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), tag, h_r)
print("Tag verified successfully!")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Process the 50-byte Act 1 message as the responder. Parse the message, verify the version, mirror the initiator's handshake operations, and verify the authentication tag.<br><br><strong>Key details:</strong> The responder performs the same MixHash and MixKey steps on the same data as the initiator, arriving at identical cryptographic state. The ECDH uses the responder's static <em>private</em> key instead of the initiator's ephemeral, which works because ECDH is commutative: <code>DH(e, S) == DH(s, E)</code>. If the tag fails verification, the connection must be terminated.<br><br><strong>Tools you will need:</strong> Byte slicing to parse the message, <code>hashlib.sha256()</code> for MixHash, <code>ecdh()</code> and <code>hkdf_two_keys()</code>, and <code>ChaCha20Poly1305.decrypt()</code> to verify the tag.</p>",
      steps:
        '<ol><li>Parse the 50-byte message into three parts: version (1 byte), remote ephemeral public key (33 bytes), and authentication tag (remaining bytes)</li><li>Verify the version is <code>0x00</code>, raising a <code>ValueError</code> if it is not</li><li><strong>MixHash</strong> the remote ephemeral public key into the handshake hash</li><li><strong>ECDH</strong>: Compute the shared secret using <code>ecdh()</code> with your static private key and the remote ephemeral public key</li><li><strong>MixKey</strong>: Derive the chaining key and temporary key using <code>hkdf_two_keys()</code></li><li><strong>Decrypt</strong>: Verify the authentication tag using <code>ChaCha20Poly1305.decrypt()</code> with the temporary key, nonce 0, and the handshake hash as associated data. This raises an exception if the tag is invalid</li><li><strong>MixHash</strong> the ciphertext into the handshake hash</li><li>Return the remote ephemeral public key along with the updated <code>h</code> and <code>ck</code></li></ol>',
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
    nonce = b'\\x00' * 4 + (0).to_bytes(8, 'little')
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
    """ECDH helper  -  you implemented this in Exercise 2."""
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    c = cipher.encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
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
        cipher.decrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), c, init_h)
    except Exception as ex:
        assert False, f"Initiator failed to verify Act 2: {ex}"
    init_h = hashlib.sha256(init_h + c).digest()
    assert init_h == resp_h, "Initiator and responder h must match after Act 2"
    assert init_ck == resp_ck, "Initiator and responder ck must match after Act 2"
`,
    sampleCode: `# Exercise 7 - Explore Act 2 (Responder side)
# Act 2 has the same structure as Act 1, but uses ephemeral-ephemeral ECDH.

import hashlib, hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _gen():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _ecdh(priv, pub):
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

def _hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return o1, o2

# Full setup through Act 1
rs_priv, rs_pub = _gen()
ie_priv, ie_pub = _gen()
re_priv, re_pub = _gen()

h = hashlib.sha256(b"Noise_XK_secp256k1_ChaChaPoly_SHA256").digest()
ck = h
h = hashlib.sha256(h + b"lightning").digest()
h = hashlib.sha256(h + rs_pub).digest()

# Act 1 (already done)
h = hashlib.sha256(h + ie_pub).digest()
ck, tk1 = _hkdf(ck, _ecdh(ie_priv, rs_pub))
c1 = ChaCha20Poly1305(tk1).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + c1).digest()

print("=== Act 2: <- e, ee ===")
print("Responder ephemeral:", re_pub.hex())

# Act 2: MixHash, ee ECDH, MixKey, Encrypt
h = hashlib.sha256(h + re_pub).digest()
ss_ee = _ecdh(re_priv, ie_pub)
print("ee shared secret:", ss_ee.hex()[:32] + "...")
print("(This is ephemeral-ephemeral = forward secrecy!)")

ck, temp_k = _hkdf(ck, ss_ee)
c = ChaCha20Poly1305(temp_k).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + c).digest()

msg = b'\\x00' + re_pub + c
print()
print("Act 2 message:", msg.hex())
print("Length:", len(msg), "bytes")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Construct the 50-byte Act 2 message as the responder. This message commits your ephemeral public key and performs the <code>ee</code> ECDH.<br><br><strong>Key details:</strong> Act 2 has the same structure as Act 1, but uses <code>ee</code> (ephemeral-ephemeral) ECDH instead of <code>es</code> (ephemeral-static). This provides <strong>forward secrecy</strong>: even if static keys are compromised later, the ephemeral-ephemeral shared secret cannot be recovered because both ephemeral private keys are deleted after the handshake.<br><br><strong>Tools you will need:</strong> The same tools as Act 1: <code>hashlib.sha256()</code>, <code>ecdh()</code>, <code>hkdf_two_keys()</code>, and <code>ChaCha20Poly1305</code>.</p>",
      steps:
        '<ol><li><strong>MixHash</strong> your ephemeral public key into the handshake hash</li><li><strong>ECDH</strong>: Compute the <code>ee</code> shared secret using <code>ecdh()</code> with your ephemeral private key and the remote ephemeral public key</li><li><strong>MixKey</strong>: Derive a new chaining key and temporary key using <code>hkdf_two_keys()</code></li><li><strong>Encrypt</strong>: Create an authentication tag by encrypting an empty plaintext with <code>ChaCha20Poly1305</code>, using the temporary key, nonce 0, and the handshake hash as associated data</li><li><strong>MixHash</strong> the ciphertext into the handshake hash</li><li>Assemble the 50-byte message: version byte + ephemeral public key + authentication tag</li></ol>',
      code: `def act_two_responder(h, ck, e_priv, e_pub, re_pub):
    # 1. MixHash ephemeral (33-byte compressed secp256k1)
    h = hashlib.sha256(h + e_pub).digest()
    # 2. ee DH
    ss = ecdh(e_priv, re_pub)
    # 3. MixKey
    ck, temp_k = hkdf_two_keys(ck, ss)
    cipher = ChaCha20Poly1305(temp_k)
    c = cipher.encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
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
    """ECDH helper  -  you implemented this in Exercise 2."""
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    c1 = ChaCha20Poly1305(temp_k).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
    h = hashlib.sha256(h + c1).digest()

    h_after_act1 = h
    ck_after_act1 = ck

    # Act 2 (responder builds)
    h = hashlib.sha256(h + re_pub).digest()
    ss = _ref_ecdh(re_priv, ie_pub)
    ck, temp_k = _ref_hkdf(ck, ss)
    c2 = ChaCha20Poly1305(temp_k).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
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
    sampleCode: `# Exercise 8 - Explore Act 2 (Initiator side)
# This mirrors Exercise 6 but uses ephemeral keys for ECDH (ee).

print("=== Act 2 Initiator Processing ===")
print("Structure is identical to Act 1 responder processing:")
print("  1. Parse: version(1) || re_pub(33) || c(16)")
print("  2. Check version == 0x00")
print("  3. MixHash(re_pub)")
print("  4. ECDH(e_priv, re_pub) -- ee DH (forward secrecy!)")
print("  5. MixKey: ck, temp_k = HKDF(ck, ss)")
print("  6. Decrypt & verify tag")
print("  7. MixHash(c)")
print()
print("Key difference from Act 1 responder:")
print("  Act 1: ECDH(s_priv, re_pub) -- static x ephemeral")
print("  Act 2: ECDH(e_priv, re_pub) -- ephemeral x ephemeral")
print()
print("After Act 2, both sides share:")
print("  - Same h (handshake hash)")
print("  - Same ck (chaining key)")
print("  - Same temp_k (from ee ECDH)")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Process the 50-byte Act 2 message as the initiator. Parse the message, mirror the responder's operations, and verify the authentication tag.<br><br><strong>Key details:</strong> This mirrors Exercise 6 (Act 1 responder): parse, MixHash, ECDH, MixKey, decrypt. The difference is that here you use your <em>ephemeral</em> private key for the <code>ee</code> ECDH instead of a static key. This is the Diffie-Hellman operation that provides forward secrecy.<br><br><strong>Tools you will need:</strong> Byte slicing, <code>hashlib.sha256()</code>, <code>ecdh()</code>, <code>hkdf_two_keys()</code>, and <code>ChaCha20Poly1305.decrypt()</code>.</p>",
      steps:
        '<ol><li>Parse the 50-byte message into three parts: version (1 byte), remote ephemeral public key (33 bytes), and authentication tag (remaining bytes)</li><li>Verify the version is <code>0x00</code></li><li><strong>MixHash</strong> the remote ephemeral public key into the handshake hash</li><li><strong>ECDH</strong>: Compute the <code>ee</code> shared secret using <code>ecdh()</code> with your ephemeral private key and the remote ephemeral public key</li><li><strong>MixKey</strong>: Derive the chaining key and temporary key using <code>hkdf_two_keys()</code></li><li><strong>Decrypt</strong>: Verify the authentication tag using <code>ChaCha20Poly1305.decrypt()</code> with the temporary key, nonce 0, and the handshake hash as associated data</li><li><strong>MixHash</strong> the ciphertext into the handshake hash</li><li>Return the remote ephemeral public key along with the updated <code>h</code> and <code>ck</code></li></ol>',
      code: `def act_two_initiator(h, ck, e_priv, message):
    version = message[0:1]
    if version != b'\\x00':
        raise ValueError("Bad version")
    re_pub = message[1:34]  # 33-byte compressed secp256k1 key
    c = message[34:]
    h = hashlib.sha256(h + re_pub).digest()
    ss = ecdh(e_priv, re_pub)
    ck, temp_k = hkdf_two_keys(ck, ss)
    ChaCha20Poly1305(temp_k).decrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), c, h)
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
    """ECDH helper  -  you implemented this in Exercise 2."""
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv_bytes, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub_bytes, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

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
    c1 = ChaCha20Poly1305(tk1).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
    h = hashlib.sha256(h + c1).digest()

    # Act 2
    h = hashlib.sha256(h + re_pub).digest()
    ss = _ref_ecdh(re_priv, ie_pub)
    ck, tk2 = _ref_hkdf(ck, ss)
    c2 = ChaCha20Poly1305(tk2).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
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
        decrypted_s_pub = cipher.decrypt(b'\\x00' * 4 + (1).to_bytes(8, 'little'), c1, h)
    except Exception as ex:
        assert False, f"Responder failed to decrypt initiator's static key: {ex}"
    assert decrypted_s_pub == s_pub, "Decrypted static key must match initiator's 33-byte compressed pubkey"
`,
    sampleCode: `# Exercise 9 - Explore Act 3 (Identity reveal & key split)
import hashlib, hmac
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

def _gen():
    sk = ec.generate_private_key(ec.SECP256K1())
    priv = sk.private_numbers().private_value.to_bytes(32, 'big')
    pub = sk.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
    return priv, pub

def _ecdh(priv, pub):
    from ecdsa import SigningKey, VerifyingKey, SECP256k1
    import hashlib
    sk = SigningKey.from_string(priv, curve=SECP256k1)
    vk = VerifyingKey.from_string(pub, curve=SECP256k1)
    pt = vk.pubkey.point * sk.privkey.secret_multiplier
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return hashlib.sha256(prefix + pt.x().to_bytes(32, 'big')).digest()

def _hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return o1, o2

# Full handshake setup through Act 2
is_priv, is_pub = _gen()  # initiator's static
rs_priv, rs_pub = _gen()  # responder's static
ie_priv, ie_pub = _gen()  # initiator's ephemeral
re_priv, re_pub = _gen()  # responder's ephemeral

h = hashlib.sha256(b"Noise_XK_secp256k1_ChaChaPoly_SHA256").digest()
ck = h
h = hashlib.sha256(h + b"lightning").digest()
h = hashlib.sha256(h + rs_pub).digest()

# Act 1
h = hashlib.sha256(h + ie_pub).digest()
ck, tk1 = _hkdf(ck, _ecdh(ie_priv, rs_pub))
c1 = ChaCha20Poly1305(tk1).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + c1).digest()

# Act 2
h = hashlib.sha256(h + re_pub).digest()
ck, tk2 = _hkdf(ck, _ecdh(re_priv, ie_pub))
c2 = ChaCha20Poly1305(tk2).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + c2).digest()

print("=== Act 3: -> s, se ===")

# Step 1: Encrypt static key with temp_k2 at nonce=1
enc_s = ChaCha20Poly1305(tk2).encrypt(b'\\x00' * 4 + (1).to_bytes(8, 'little'), is_pub, h)
print("Encrypted static key:", enc_s.hex()[:32] + "...")
print("Length:", len(enc_s), "bytes (33 + 16 MAC)")

h = hashlib.sha256(h + enc_s).digest()

# Step 3: se ECDH
ss_se = _ecdh(is_priv, re_pub)
ck, tk3 = _hkdf(ck, ss_se)

# Step 5: Auth tag
auth = ChaCha20Poly1305(tk3).encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
h = hashlib.sha256(h + auth).digest()

# Step 7: Split -> transport keys!
send_key, recv_key = _hkdf(ck, b"")
print()
print("send_key:", send_key.hex())
print("recv_key:", recv_key.hex())
print()
print("Handshake complete! Ready for encrypted transport.")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Construct the 66-byte Act 3 message and derive the final transport encryption keys. This act encrypts your static public key, performs the <code>se</code> ECDH for mutual authentication, and splits the chaining key into send/receive keys.<br><br><strong>Key details:</strong> The static key is encrypted with <code>temp_k2</code> (from Act 2) at <strong>nonce=1</strong> (nonce=0 was consumed in Act 2). The <code>se</code> ECDH (static-ephemeral) provides mutual authentication. Finally, <code>Split()</code> derives transport keys by running HKDF on the chaining key with empty input. Since the static key is encrypted with keys derived from prior ECDH operations, eavesdroppers cannot learn the initiator's identity.<br><br><strong>Tools you will need:</strong> <code>ChaCha20Poly1305</code> for encryption (used twice: once at nonce=1, once at nonce=0), <code>ecdh()</code>, <code>hkdf_two_keys()</code>, and <code>hashlib.sha256()</code>.</p>",
      steps:
        '<ol><li><strong>Encrypt static key</strong>: Use <code>ChaCha20Poly1305</code> with <code>temp_k2</code> at nonce=1 to encrypt your static public key, passing the handshake hash as associated data. This produces 49 bytes (33 encrypted + 16 MAC)</li><li><strong>MixHash</strong> the ciphertext into the handshake hash</li><li><strong>ECDH</strong>: Compute the <code>se</code> shared secret using <code>ecdh()</code> with your static private key and the remote ephemeral public key</li><li><strong>MixKey</strong>: Derive a new chaining key and <code>temp_k3</code> using <code>hkdf_two_keys()</code></li><li><strong>Auth tag</strong>: Encrypt an empty plaintext with <code>ChaCha20Poly1305</code> using <code>temp_k3</code> at nonce=0 and the handshake hash as associated data</li><li><strong>MixHash</strong> the second ciphertext into the handshake hash</li><li><strong>Split</strong>: Derive the transport keys by calling <code>hkdf_two_keys()</code> with the chaining key and an empty byte string</li><li>Assemble the 66-byte message: version byte + encrypted static key (49 bytes) + auth tag (16 bytes). Return with the send and receive keys</li></ol>',
      code: `def act_three_initiator(h, ck, temp_k2, s_priv, s_pub, re_pub):
    # Encrypt static key with temp_k2 at nonce=1
    # (nonce=0 was used in Act 2's empty payload encryption)
    c1 = ChaCha20Poly1305(temp_k2).encrypt(
        b'\\x00' * 4 + (1).to_bytes(8, 'little'), s_pub, h)
    h = hashlib.sha256(h + c1).digest()
    # se ECDH
    ss = ecdh(s_priv, re_pub)
    ck, temp_k3 = hkdf_two_keys(ck, ss)
    # Auth tag with temp_k3 at nonce=0
    c2 = ChaCha20Poly1305(temp_k3).encrypt(
        b'\\x00' * 4 + (0).to_bytes(8, 'little'), b"", h)
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
        nonce:     integer nonce (encoded per BOLT 8: 4 zero bytes + 8-byte little-endian)
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
    sampleCode: `# Exercise 10 - Explore transport message encryption
import struct, os
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

key = os.urandom(32)
print("Transport key:", key.hex()[:32] + "...")

# Encrypt a message
plaintext = b"Hello Lightning!"
print("Plaintext:", plaintext)
print("Length:", len(plaintext), "bytes")

# Step 1: Encode length as 2-byte big-endian
length_bytes = struct.pack(">H", len(plaintext))
print()
print("Length prefix:", length_bytes.hex(), f"({len(plaintext)} in big-endian)")

# Step 2: Encrypt length with nonce=0
cipher = ChaCha20Poly1305(key)
nonce_0 = b'\\x00' * 4 + (0).to_bytes(8, 'little')
enc_len = cipher.encrypt(nonce_0, length_bytes, b"")
print("Encrypted length:", enc_len.hex(), f"({len(enc_len)} bytes = 2 + 16 MAC)")

# Step 3: Encrypt body with nonce=1
nonce_1 = b'\\x00' * 4 + (1).to_bytes(8, 'little')
enc_body = cipher.encrypt(nonce_1, plaintext, b"")
print("Encrypted body:", enc_body.hex()[:32] + "...")
print(f"({len(enc_body)} bytes = {len(plaintext)} + 16 MAC)")

# Full ciphertext
ct = enc_len + enc_body
print()
print("Full ciphertext:", len(ct), "bytes")
print("Next nonce: 2 (each message consumes 2 nonces)")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Encrypt a Lightning transport message by producing an encrypted length prefix followed by the encrypted message body.<br><br><strong>Key details:</strong> Lightning frames each message with a 2-byte big-endian length prefix, then the message body. Both parts are encrypted separately with ChaCha20-Poly1305, each consuming one nonce (so a single message uses two sequential nonces). This hides the message size from observers. Nonces are 12 bytes per BOLT 8: 4 zero bytes followed by an 8-byte little-endian counter. No associated data is used.<br><br><strong>Tools you will need:</strong> <code>struct.pack()</code> to encode the length as 2 bytes, <code>ChaCha20Poly1305</code> for encryption, and <code>int.to_bytes()</code> for nonce encoding.</p>",
      steps:
        '<ol><li>Encode the plaintext length as a 2-byte big-endian unsigned integer using <code>struct.pack()</code> with the <code>">H"</code> format</li><li>Encrypt the length bytes using <code>ChaCha20Poly1305</code> with the current nonce (BOLT 8 format: 4 zero bytes + 8-byte little-endian) and empty associated data</li><li>Encrypt the message body using the next nonce (<code>nonce + 1</code>) and empty associated data</li><li>Return the concatenated ciphertext and the next available nonce (advanced by 2)</li></ol>',
      code: `def encrypt_message(key, nonce, plaintext):
    length_bytes = struct.pack(">H", len(plaintext))
    cipher = ChaCha20Poly1305(key)
    enc_len = cipher.encrypt(b'\\x00' * 4 + nonce.to_bytes(8, 'little'), length_bytes, b"")
    enc_body = cipher.encrypt(b'\\x00' * 4 + (nonce + 1).to_bytes(8, 'little'), plaintext, b"")
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
        nonce:      integer nonce (encoded per BOLT 8: 4 zero bytes + 8-byte little-endian)
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
    enc_len = cipher.encrypt(b'\\x00' * 4 + nonce.to_bytes(8, 'little'), length_bytes, b"")
    enc_body = cipher.encrypt(b'\\x00' * 4 + (nonce + 1).to_bytes(8, 'little'), plaintext, b"")
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
    sampleCode: `# Exercise 11 - Explore transport message decryption
import struct, os
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

key = os.urandom(32)

# First encrypt a message (so we have something to decrypt)
plaintext = b"Decrypt me!"
cipher = ChaCha20Poly1305(key)
enc_len = cipher.encrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'),
    struct.pack(">H", len(plaintext)), b"")
enc_body = cipher.encrypt(b'\\x00' * 4 + (1).to_bytes(8, 'little'), plaintext, b"")
ciphertext = enc_len + enc_body

print("Ciphertext:", ciphertext.hex())
print("Total length:", len(ciphertext), "bytes")
print()

# Now decrypt step by step
print("=== Decryption ===")

# Step 1: Split into length (18 bytes) and body
ct_len = ciphertext[:18]
ct_body = ciphertext[18:]
print("Encrypted length:", ct_len.hex(), f"({len(ct_len)} bytes)")
print("Encrypted body:  ", ct_body.hex(), f"({len(ct_body)} bytes)")

# Step 2: Decrypt length with nonce=0
length_bytes = cipher.decrypt(b'\\x00' * 4 + (0).to_bytes(8, 'little'), ct_len, b"")
msg_len = struct.unpack(">H", length_bytes)[0]
print()
print("Decrypted length:", msg_len, "bytes")

# Step 3: Decrypt body with nonce=1
recovered = cipher.decrypt(b'\\x00' * 4 + (1).to_bytes(8, 'little'), ct_body, b"")
print("Decrypted body:", recovered)
print("Match:", recovered == plaintext)
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Decrypt a Lightning transport message by recovering the length prefix, then the message body.<br><br><strong>Key details:</strong> Decryption mirrors encryption. The ciphertext starts with 18 bytes: the encrypted 2-byte length prefix plus a 16-byte MAC. After decrypting the length, the remaining bytes contain the encrypted message body with its own MAC. Each decryption consumes two nonces, matching what encryption produced.<br><br><strong>Tools you will need:</strong> <code>ChaCha20Poly1305</code> for decryption, <code>struct.unpack()</code> to parse the recovered length, and byte slicing to split the ciphertext.</p>",
      steps:
        '<ol><li>Split the ciphertext: the first 18 bytes are the encrypted length (2 + 16-byte MAC), the rest is the encrypted body</li><li>Decrypt the length prefix using <code>ChaCha20Poly1305</code> with the current nonce and empty associated data</li><li>Parse the decrypted length bytes into an integer using <code>struct.unpack()</code> with the <code>">H"</code> format</li><li>Decrypt the message body using the next nonce (<code>nonce + 1</code>) and empty associated data</li><li>Return the plaintext and the next available nonce (advanced by 2)</li></ol>',
      code: `def decrypt_message(key, nonce, ciphertext):
    cipher = ChaCha20Poly1305(key)
    enc_len = ciphertext[:18]
    length_bytes = cipher.decrypt(b'\\x00' * 4 + nonce.to_bytes(8, 'little'), enc_len, b"")
    msg_len = struct.unpack(">H", length_bytes)[0]
    enc_body = ciphertext[18:]
    plaintext = cipher.decrypt(b'\\x00' * 4 + (nonce + 1).to_bytes(8, 'little'), enc_body, b"")
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
      "Implement Lightning's key rotation scheme. After every 1,000 encryptions (500 messages, since each message requires two encryption operations for the length prefix + body), the sending key must be rotated by deriving a new key from the old one using HKDF. Implement a CipherState class that tracks the nonce, automatically rotates the key at the threshold, and encrypts/decrypts transport messages.",
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
    sampleCode: `# Exercise 12 - Explore key rotation
import struct, hmac, hashlib, os
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

ROTATION_THRESHOLD = 1000

def _hkdf(salt, ikm):
    tk = hmac.new(salt, ikm, hashlib.sha256).digest()
    o1 = hmac.new(tk, b'\\x01', hashlib.sha256).digest()
    o2 = hmac.new(tk, o1 + b'\\x02', hashlib.sha256).digest()
    return o1, o2

key = os.urandom(32)
ck = os.urandom(32)
nonce = 0

print("=== Key Rotation Demo ===")
print("Initial key:", key.hex()[:16] + "...")
print("Rotation threshold:", ROTATION_THRESHOLD, "nonces")
print()

# Simulate sending 500 messages (each uses 2 nonces)
for i in range(500):
    # Encrypt (simulated)
    cipher = ChaCha20Poly1305(key)
    length_bytes = struct.pack(">H", 1)
    cipher.encrypt(b'\\x00' * 4 + nonce.to_bytes(8, 'little'), length_bytes, b"")
    cipher.encrypt(b'\\x00' * 4 + (nonce + 1).to_bytes(8, 'little'), b"x", b"")
    nonce += 2

    if nonce >= ROTATION_THRESHOLD:
        old_key = key
        ck, key = _hkdf(ck, key)
        nonce = 0
        print(f"Rotation at message {i + 1}!")
        print("  Old key:", old_key.hex()[:16] + "...")
        print("  New key:", key.hex()[:16] + "...")
        print("  Nonce reset to 0")

print()
print("After 500 messages, key was rotated once")
print("(500 messages x 2 nonces = 1000 = threshold)")
`,
    hints: {
      conceptual:
        "<p><strong>Goal:</strong> Build a <code>CipherState</code> class that wraps the encrypt/decrypt message functions with automatic key rotation every 1,000 encryptions.<br><br><strong>How it works:</strong> BOLT 8 rotates keys every 1,000 encryptions to limit the exposure of any single key. When the nonce reaches the rotation threshold, <code>hkdf_two_keys()</code> is called with the current chaining key and encryption key to derive fresh keys, and the nonce resets to 0. Both sides rotate independently but in sync since they process the same number of messages.<br><br><strong>Tools you will need:</strong> <code>hkdf_two_keys()</code> for key rotation, <code>struct.pack()</code> / <code>struct.unpack()</code> for length encoding, and <code>ChaCha20Poly1305</code> for encryption and decryption.</p>",
      steps:
        '<ol><li><strong><code>__init__</code></strong>: Store the encryption key, chaining key, and initialize the nonce to 0 as instance attributes</li><li><strong><code>_maybe_rotate</code></strong>: Check if the nonce has reached the rotation threshold (1000). If so, derive new keys using <code>hkdf_two_keys()</code> with the chaining key and current encryption key, update both, and reset the nonce to 0</li><li><strong><code>encrypt_message</code></strong>: Call <code>_maybe_rotate()</code> first, then follow the same encrypt-length-then-body pattern from Exercise 10, advancing the nonce by 2. Return the concatenated ciphertext (no need to return the nonce since it is managed internally)</li><li><strong><code>decrypt_message</code></strong>: Call <code>_maybe_rotate()</code> first, then follow the same decrypt-length-then-body pattern from Exercise 11, advancing the nonce by 2. Return just the plaintext</li></ol>',
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
            b'\\x00' * 4 + self.nonce.to_bytes(8, 'little'), length_bytes, b"")
        enc_body = cipher.encrypt(
            b'\\x00' * 4 + (self.nonce + 1).to_bytes(8, 'little'), plaintext, b"")
        self.nonce += 2
        return enc_len + enc_body

    def decrypt_message(self, ciphertext):
        self._maybe_rotate()
        cipher = ChaCha20Poly1305(self.key)
        enc_len = ciphertext[:18]
        length_bytes = cipher.decrypt(
            b'\\x00' * 4 + self.nonce.to_bytes(8, 'little'), enc_len, b"")
        enc_body = ciphertext[18:]
        plaintext = cipher.decrypt(
            b'\\x00' * 4 + (self.nonce + 1).to_bytes(8, 'little'), enc_body, b"")
        self.nonce += 2
        return plaintext`,
    },
    rewardSats: 21,
  },
};
