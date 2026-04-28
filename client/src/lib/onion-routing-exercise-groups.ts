// ─── Onion Routing Exercise Groups ──────────────────────────────────────────
//
// Groups the 10 onion-routing exercises into 4 logical Python "files":
//   1. crypto/keys.py         — derive_keys (KeyMaterial dataclass)
//   2. sphinx/builder.py      — OnionPacketBuilder class
//   3. sphinx/forwarder.py    — OnionForwarder class
//   4. sphinx/errors.py       — build_error_onion, decrypt_error_onion
//
// Cross-group dependencies forward the student's solutions:
//   - sphinx/builder.py uses derive_keys from crypto/keys.py
//   - sphinx/forwarder.py uses derive_keys from crypto/keys.py
//   - sphinx/errors.py uses derive_keys from crypto/keys.py
//
// Crypto primitives (HKDF, ChaCha20, ECDH) are imported, not re-derived;
// students completed these in the Noise course and we link back to those
// chapters when each primitive comes up.

export interface OnionRoutingExerciseGroup {
  id: string;
  label: string;
  setupCode: string;
  preamble: string;
  exerciseIds: string[];
  crossGroupDependencies: string[];
}

// ─── Hidden Setup Code ──────────────────────────────────────────────────────
//
// Each group's setup is filled in as exercises are added chapter-by-chapter.
// Empty strings are valid here.

const KEYS_SETUP = ``;

// SECP256K1 curve helpers used across builder/forwarder exercises.
// We provide ECDH and point-multiplication wrappers so students can focus on
// the Sphinx logic rather than re-deriving the elliptic curve plumbing.
const CURVE_HELPERS = `
from ecdsa import SigningKey, VerifyingKey, SECP256k1
from ecdsa.util import string_to_number, number_to_string
import hashlib

# ChaCha20 keystream helper. BOLT 4 uses ChaCha20 with a 96-bit (12-byte)
# all-zero nonce as a stream cipher to generate per-hop keystream bytes.
def chacha20_keystream(key, length):
    """Generate \`length\` bytes of ChaCha20 keystream (zero nonce) from a 32-byte key."""
    from cryptography.hazmat.primitives.ciphers import Cipher
    from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20
    nonce = b"\\x00" * 16  # cryptography lib expects 16-byte nonce input
    cipher = Cipher(ChaCha20(key, nonce), mode=None)
    enc = cipher.encryptor()
    return enc.update(b"\\x00" * length)

def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

CURVE_ORDER = SECP256k1.order
GENERATOR = SECP256k1.generator

def privkey_to_pubkey(privkey_bytes):
    """Compute the compressed (33-byte) public key for a 32-byte private key."""
    sk = SigningKey.from_string(privkey_bytes, curve=SECP256k1)
    return sk.verifying_key.to_string("compressed")

def ecdh(privkey_bytes, pubkey_bytes):
    """ECDH shared secret as SHA256(privkey * pubkey). Returns 32 bytes."""
    sk_n = string_to_number(privkey_bytes)
    vk = VerifyingKey.from_string(pubkey_bytes, curve=SECP256k1)
    shared_point = sk_n * vk.pubkey.point
    # secp256k1 compressed point: 02/03 prefix + 32-byte x-coord
    parity = b'\\x02' if shared_point.y() % 2 == 0 else b'\\x03'
    x_bytes = number_to_string(shared_point.x(), CURVE_ORDER)
    return hashlib.sha256(parity + x_bytes).digest()

def point_mul_pubkey(pubkey_bytes, scalar_bytes):
    """Compute pubkey * scalar (mod n) and return the compressed result."""
    vk = VerifyingKey.from_string(pubkey_bytes, curve=SECP256k1)
    s = string_to_number(scalar_bytes) % CURVE_ORDER
    new_point = s * vk.pubkey.point
    new_vk = VerifyingKey.from_public_point(new_point, curve=SECP256k1)
    return new_vk.to_string("compressed")

def scalar_mul(scalar_a_bytes, scalar_b_bytes):
    """Multiply two 32-byte scalars mod the curve order. Returns 32 bytes."""
    a = string_to_number(scalar_a_bytes)
    b = string_to_number(scalar_b_bytes)
    return number_to_string((a * b) % CURVE_ORDER, CURVE_ORDER)
`;

const BUILDER_SETUP = CURVE_HELPERS + `
class _OnionPacketBuilderBase:
    pass
`;
const FORWARDER_SETUP = CURVE_HELPERS;
const ERRORS_SETUP = ``;

// ─── Visible Preambles (shown in editor, read-only) ────────────────────────

const KEYS_PREAMBLE = `import hashlib, hmac, struct
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes`;

const BUILDER_PREAMBLE = `# Provided helpers (in scope at runtime):
#   privkey_to_pubkey, ecdh, point_mul_pubkey, scalar_mul
#   chacha20_keystream(key: bytes, length: int) -> bytes
#   xor_bytes(a: bytes, b: bytes) -> bytes
# Crypto reference: see Noise course /noise-tutorial/crypto-primitives
import hashlib

ROUTING_INFO_SIZE = 1300  # BOLT 4 hop_payloads field length

class OnionPacketBuilder:`;

const FORWARDER_PREAMBLE = `# derive_keys() comes from crypto/keys.py
from ecdsa import SigningKey, VerifyingKey, SECP256k1
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20
import hashlib, hmac, struct

class OnionForwarder:`;

const ERRORS_PREAMBLE = `# derive_keys() comes from crypto/keys.py
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20
import hashlib, hmac, struct`;

// ─── Group Definitions ──────────────────────────────────────────────────────
//
// exerciseIds are populated as each chapter ships. Empty arrays are valid.

export const ONION_ROUTING_EXERCISE_GROUPS: Record<string, OnionRoutingExerciseGroup> = {
  "crypto/keys": {
    id: "crypto/keys",
    label: "crypto/keys.py",
    setupCode: KEYS_SETUP,
    preamble: KEYS_PREAMBLE,
    exerciseIds: ["exercise-derive-keys"],
    crossGroupDependencies: [],
  },

  "sphinx/builder": {
    id: "sphinx/builder",
    label: "sphinx/builder.py",
    setupCode: BUILDER_SETUP,
    preamble: BUILDER_PREAMBLE,
    exerciseIds: ["exercise-derive-shared-secrets", "exercise-generate-filler"],
    crossGroupDependencies: [],
  },

  "sphinx/forwarder": {
    id: "sphinx/forwarder",
    label: "sphinx/forwarder.py",
    setupCode: FORWARDER_SETUP,
    preamble: FORWARDER_PREAMBLE,
    exerciseIds: [],
    crossGroupDependencies: [],
  },

  "sphinx/errors": {
    id: "sphinx/errors",
    label: "sphinx/errors.py",
    setupCode: ERRORS_SETUP,
    preamble: ERRORS_PREAMBLE,
    exerciseIds: [],
    crossGroupDependencies: [],
  },
};

// ─── Lookup Map ─────────────────────────────────────────────────────────────

const ONION_EXERCISE_INDEX: Record<string, { groupId: string; orderIndex: number }> = {};

for (const group of Object.values(ONION_ROUTING_EXERCISE_GROUPS)) {
  group.exerciseIds.forEach((id, i) => {
    ONION_EXERCISE_INDEX[id] = { groupId: group.id, orderIndex: i };
  });
}

// ─── Context Assembly ───────────────────────────────────────────────────────

export function getOnionRoutingExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  setupCode: string;
  crossGroupExercises: Array<{ id: string }>;
  classMethodExercises: Array<{ id: string }>;
  priorInGroupExercises: Array<{ id: string }>;
  futureExercises: Array<{ id: string }>;
} | null {
  const entry = ONION_EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = ONION_ROUTING_EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  const standaloneDeps = group.crossGroupDependencies.map(id => ({ id }));

  const priorInGroup = group.exerciseIds
    .slice(0, entry.orderIndex)
    .map(id => ({ id }));
  const futureInGroup = group.exerciseIds
    .slice(entry.orderIndex + 1)
    .map(id => ({ id }));

  return {
    fileLabel: group.label,
    preamble: group.preamble,
    setupCode: group.setupCode,
    crossGroupExercises: standaloneDeps,
    classMethodExercises: [],
    priorInGroupExercises: priorInGroup,
    futureExercises: futureInGroup,
  };
}
