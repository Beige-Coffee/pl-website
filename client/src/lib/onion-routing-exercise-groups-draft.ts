// ─── Onion Routing Exercise Groups ──────────────────────────────────────────
//
// Groups the 10 onion-routing exercises into 4 logical Python "files":
//   1. crypto/keys.py         — derive_keys (KeyMaterial dataclass)
//   2. sphinx/builder.py      — OnionPacketBuilder class
//   3. sphinx/forwarder.py    — OnionForwarder class + check_forward
//   4. sphinx/errors.py       — decrypt_error_onion
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

def generate_cipher_stream(key, length):
    """Compatibility alias for older snippets; prefer chacha20_keystream."""
    return chacha20_keystream(key, length)

def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

def parse_bigsize(data, offset=0):
    """Parse a BOLT 1 bigsize integer from data[offset:]. Returns (value, bytes_consumed)."""
    first = data[offset]
    if first < 0xfd:
        return first, 1
    elif first == 0xfd:
        return int.from_bytes(data[offset+1:offset+3], 'big'), 3
    elif first == 0xfe:
        return int.from_bytes(data[offset+1:offset+5], 'big'), 5
    else:  # 0xff
        return int.from_bytes(data[offset+1:offset+9], 'big'), 9

def encode_bigsize(value):
    if value < 0xfd:
        return value.to_bytes(1, 'big')
    elif value <= 0xffff:
        return b"\\xfd" + value.to_bytes(2, 'big')
    elif value <= 0xffffffff:
        return b"\\xfe" + value.to_bytes(4, 'big')
    else:
        return b"\\xff" + value.to_bytes(8, 'big')

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
import hmac, hashlib

class _OnionPacketBuilderBase:
    """Hidden base providing one helper used by the build exercise.

    _derive_build_keys() does pure HMAC-label key derivation — the same
    pattern you wrote in the derive_keys exercise (chapter 6). It's packaged
    here so the build loop stays focused on the conceptual moves (pad-init,
    reverse loop, filler overlay, final assembly) instead of repeating
    boilerplate.
    """
    def _derive_build_keys(self, payloads):
        """Returns (rho_keys, mu_keys, pad_key, sizes) ready for the build loop.

        Calls self.derive_shared_secrets() first, then derives rho_i and mu_i
        for each hop from self.shared_secrets, derives pad_key from
        self.session_key, and computes the hop-payload sizes list for the filler.
        """
        self.derive_shared_secrets()
        rho_keys = [hmac.new(b"rho", ss, hashlib.sha256).digest()
                    for ss in self.shared_secrets]
        mu_keys = [hmac.new(b"mu", ss, hashlib.sha256).digest()
                   for ss in self.shared_secrets]
        pad_key = hmac.new(b"pad", self.session_key, hashlib.sha256).digest()
        sizes = [len(p) + 32 for p in payloads[:-1]]
        return rho_keys, mu_keys, pad_key, sizes
`;
// The forwarder group also needs the ForwardingPolicy container for the
// fee/CLTV check exercise. It mirrors the BOLT 7 channel_update fields a hop
// advertises to the network.
const FORWARDER_SETUP = CURVE_HELPERS + `
from dataclasses import dataclass

@dataclass
class ForwardingPolicy:
    """This hop's advertised BOLT 7 channel_update forwarding parameters."""
    fee_base_msat: int
    fee_proportional_millionths: int
    cltv_expiry_delta: int
`;
// Errors group needs the same helpers (chacha20, xor) from CURVE_HELPERS.
// We rely on CURVE_HELPERS being executed in the same Pyodide namespace; if
// it isn't, we re-include the helpers here.
const ERRORS_SETUP = CURVE_HELPERS;

// ─── Visible Preambles (shown in editor, read-only) ────────────────────────

const KEYS_PREAMBLE = `import hashlib, hmac, struct
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes`;

const BUILDER_PREAMBLE = `# Provided helpers (in scope at runtime):
#   privkey_to_pubkey, ecdh, point_mul_pubkey, scalar_mul
#   chacha20_keystream(key: bytes, length: int) -> bytes
#   xor_bytes(a: bytes, b: bytes) -> bytes
# Crypto reference: see Noise course /noise-tutorial/crypto-primitives
#
# OnionPacketBuilder inherits from _OnionPacketBuilderBase, which provides
# self._derive_build_keys(payloads) — a boilerplate helper used by the
# build exercise. The base class is hidden infrastructure; nothing else.
import hashlib

ROUTING_INFO_SIZE = 1300  # BOLT 4 hop_payloads field length

class OnionPacketBuilder(_OnionPacketBuilderBase):`;

const FORWARDER_PREAMBLE = `# Provided helpers (in scope at runtime):
#   privkey_to_pubkey, ecdh, point_mul_pubkey, scalar_mul
#   chacha20_keystream, xor_bytes
#   parse_bigsize, encode_bigsize
#   ForwardingPolicy(fee_base_msat, fee_proportional_millionths, cltv_expiry_delta)
import hashlib, hmac

ROUTING_INFO_SIZE = 1300

class OnionForwarder:`;

const ERRORS_PREAMBLE = `# Provided helpers (in scope at runtime):
#   chacha20_keystream(key, length) -> bytes
#   xor_bytes(a, b) -> bytes
import hashlib, hmac

# BOLT 4 error packet layout: hmac(32) || u16:failure_len || failure_msg ||
# u16:pad_len || pad zeros, with failure_len + pad_len == 256.
# Total = 32 + 2 + failure_len + 2 + pad_len = 32 + 260 = 292 bytes.
ERROR_PACKET_SIZE = 292`;

// ─── Group Definitions ──────────────────────────────────────────────────────
//
// exerciseIds are populated as each chapter ships. Empty arrays are valid.

export const ONION_ROUTING_DRAFT_EXERCISE_GROUPS: Record<string, OnionRoutingExerciseGroup> = {
  "crypto/keys": {
    id: "crypto/keys",
    label: "crypto/keys.py",
    setupCode: KEYS_SETUP,
    preamble: KEYS_PREAMBLE,
    exerciseIds: ["exercise-derive-keys-draft"],
    crossGroupDependencies: [],
  },

  "sphinx/builder": {
    id: "sphinx/builder",
    label: "sphinx/builder.py",
    setupCode: BUILDER_SETUP,
    preamble: BUILDER_PREAMBLE,
    exerciseIds: [
      "exercise-derive-shared-secrets-draft",
      "exercise-generate-filler-draft",
      "exercise-wrap-hop-draft",
      "exercise-build-packet-draft",
    ],
    crossGroupDependencies: [],
  },

  "sphinx/forwarder": {
    id: "sphinx/forwarder",
    label: "sphinx/forwarder.py",
    setupCode: FORWARDER_SETUP,
    preamble: FORWARDER_PREAMBLE,
    exerciseIds: ["exercise-peel-layer-draft", "exercise-verify-hmac-draft", "exercise-check-forward-draft"],
    crossGroupDependencies: [],
  },

  "sphinx/errors": {
    id: "sphinx/errors",
    label: "sphinx/errors.py",
    setupCode: ERRORS_SETUP,
    preamble: ERRORS_PREAMBLE,
    exerciseIds: ["exercise-decrypt-error-onion-draft"],
    crossGroupDependencies: [],
  },
};

// ─── Lookup Map ─────────────────────────────────────────────────────────────

const ONION_DRAFT_EXERCISE_INDEX: Record<string, { groupId: string; orderIndex: number }> = {};

for (const group of Object.values(ONION_ROUTING_DRAFT_EXERCISE_GROUPS)) {
  group.exerciseIds.forEach((id, i) => {
    ONION_DRAFT_EXERCISE_INDEX[id] = { groupId: group.id, orderIndex: i };
  });
}

// ─── Context Assembly ───────────────────────────────────────────────────────

export function getOnionRoutingDraftExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  setupCode: string;
  crossGroupExercises: Array<{ id: string }>;
  classMethodExercises: Array<{ id: string }>;
  priorInGroupExercises: Array<{ id: string }>;
  futureExercises: Array<{ id: string }>;
} | null {
  const entry = ONION_DRAFT_EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = ONION_ROUTING_DRAFT_EXERCISE_GROUPS[entry.groupId];
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
