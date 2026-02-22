// ─── Exercise Groups ─────────────────────────────────────────────────────────
//
// Groups exercises into logical Python "files". Each group has:
//   - A preamble: shared imports + utility functions (not student exercises)
//   - An ordered list of exercise IDs within the group
//   - Cross-group dependencies: exercise IDs from OTHER groups needed at runtime
//
// When a student opens an exercise, they see:
//   - A collapsible "prior code" panel showing the preamble + all prior
//     exercises they've solved (or solution fallbacks)
//   - The current exercise stub in the editable editor
//
// At test-run time, the full code is:
//   [preamble] + [cross-group deps] + [prior in-group code] + [student code] + [test code]

export interface ExerciseGroup {
  id: string;
  label: string; // display filename, e.g. "keys/derivation.py"
  preamble: string; // imports + utility functions shown above the student's code
  exerciseIds: string[]; // ordered exercise IDs within this group
  crossGroupDependencies: string[]; // exercise IDs from OTHER groups needed at runtime
}

// ─── Preambles ───────────────────────────────────────────────────────────────

const KEYS_DERIVATION_PREAMBLE = `import hmac
import hashlib
import struct
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

KEY_FAMILIES = {
    'funding': 0,
    'revocation_base': 1,
    'htlc_base': 2,
    'payment_base': 3,
    'delayed_payment_base': 4,
    'per_commitment': 5,
}`;

const SCRIPTS_FUNDING_PREAMBLE = ``;

const TRANSACTIONS_FUNDING_PREAMBLE = `import hashlib
import struct
from ecdsa import SECP256k1, SigningKey
from ecdsa.util import sigencode_der`;

const KEYS_COMMITMENT_PREAMBLE = `import hashlib
from ecdsa import SECP256k1, SigningKey
from ecdsa.ellipticcurve import Point

CURVE = SECP256k1.curve
G = SECP256k1.generator
ORDER = SECP256k1.order

def decompress_pubkey(compressed: bytes) -> Point:
    prefix = compressed[0]
    x = int.from_bytes(compressed[1:], 'big')
    p = CURVE.p()
    y_sq = (pow(x, 3, p) + CURVE.a() * x + CURVE.b()) % p
    y = pow(y_sq, (p + 1) // 4, p)
    if (y % 2 == 0) != (prefix == 0x02):
        y = p - y
    return Point(CURVE, x, y)

def compress_point(point: Point) -> bytes:
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')`;

const KEYS_CHANNEL_KEYS_PREAMBLE = `import hashlib
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')`;

const SCRIPTS_COMMITMENT_PREAMBLE = `import hashlib

def hash160(data: bytes) -> bytes:
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()`;

const SCRIPTS_HTLC_PREAMBLE = `import hashlib

def hash160(data: bytes) -> bytes:
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()`;

// Includes all utility functions needed by cross-group deps from keys/commitment
// and scripts/commitment (whose simplified solutions won't carry their group preambles)
const TRANSACTIONS_COMMITMENT_PREAMBLE = `import hashlib
import struct
from ecdsa import SECP256k1, SigningKey
from ecdsa.ellipticcurve import Point

CURVE = SECP256k1.curve
G = SECP256k1.generator
ORDER = SECP256k1.order

def hash160(data: bytes) -> bytes:
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()

def privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def decompress_pubkey(compressed: bytes) -> Point:
    prefix = compressed[0]
    x = int.from_bytes(compressed[1:], 'big')
    p = CURVE.p()
    y_sq = (pow(x, 3, p) + CURVE.a() * x + CURVE.b()) % p
    y = pow(y_sq, (p + 1) // 4, p)
    if (y % 2 == 0) != (prefix == 0x02):
        y = p - y
    return Point(CURVE, x, y)

def compress_point(point: Point) -> bytes:
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')`;

// hash160 needed by offered/received HTLC cross-deps whose simplified solutions
// won't carry the scripts/htlc group preamble
const TRANSACTIONS_HTLC_PREAMBLE = `import hashlib
import struct

def hash160(data: bytes) -> bytes:
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()`;

// ─── Group Definitions ───────────────────────────────────────────────────────

export const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  "keys/derivation": {
    id: "keys/derivation",
    label: "keys/derivation.py",
    preamble: KEYS_DERIVATION_PREAMBLE,
    exerciseIds: [
      "ln-exercise-keys-manager",
      "ln-exercise-derive-key",
      "ln-exercise-channel-keys",
    ],
    crossGroupDependencies: [],
  },

  "scripts/funding": {
    id: "scripts/funding",
    label: "scripts/funding.py",
    preamble: SCRIPTS_FUNDING_PREAMBLE,
    exerciseIds: ["ln-exercise-funding-script"],
    crossGroupDependencies: [],
  },

  "transactions/funding": {
    id: "transactions/funding",
    label: "transactions/funding.py",
    preamble: TRANSACTIONS_FUNDING_PREAMBLE,
    exerciseIds: ["ln-exercise-funding-tx", "ln-exercise-sign-input"],
    crossGroupDependencies: ["ln-exercise-funding-script"],
  },

  "keys/commitment": {
    id: "keys/commitment",
    label: "keys/commitment.py",
    preamble: KEYS_COMMITMENT_PREAMBLE,
    exerciseIds: [
      "ln-exercise-revocation-pubkey",
      "ln-exercise-revocation-privkey",
      "ln-exercise-derive-pubkey",
      "ln-exercise-derive-privkey",
    ],
    crossGroupDependencies: [],
  },

  "keys/channel_keys": {
    id: "keys/channel_keys",
    label: "keys/channel_keys.py",
    preamble: KEYS_CHANNEL_KEYS_PREAMBLE,
    exerciseIds: [
      "ln-exercise-commitment-secret",
      "ln-exercise-per-commitment-point",
    ],
    crossGroupDependencies: [],
  },

  "scripts/commitment": {
    id: "scripts/commitment",
    label: "scripts/commitment.py",
    preamble: SCRIPTS_COMMITMENT_PREAMBLE,
    exerciseIds: [
      "ln-exercise-to-remote-script",
      "ln-exercise-to-local-script",
    ],
    crossGroupDependencies: [],
  },

  "scripts/htlc": {
    id: "scripts/htlc",
    label: "scripts/htlc.py",
    preamble: SCRIPTS_HTLC_PREAMBLE,
    exerciseIds: [
      "ln-exercise-offered-htlc-script",
      "ln-exercise-received-htlc-script",
    ],
    crossGroupDependencies: [],
  },

  "transactions/commitment": {
    id: "transactions/commitment",
    label: "transactions/commitment.py",
    preamble: TRANSACTIONS_COMMITMENT_PREAMBLE,
    exerciseIds: [
      "ln-exercise-obscure-factor",
      "ln-exercise-obscured-commitment",
      "ln-exercise-commitment-outputs",
      "ln-exercise-commitment-tx",
      "ln-exercise-finalize-commitment",
    ],
    crossGroupDependencies: [
      "ln-exercise-funding-script",
      "ln-exercise-sign-input",
      "ln-exercise-to-remote-script",
      "ln-exercise-to-local-script",
      "ln-exercise-commitment-secret",
      "ln-exercise-per-commitment-point",
      "ln-exercise-revocation-pubkey",
      "ln-exercise-derive-pubkey",
    ],
  },

  "transactions/htlc": {
    id: "transactions/htlc",
    label: "transactions/htlc.py",
    preamble: TRANSACTIONS_HTLC_PREAMBLE,
    exerciseIds: [
      "ln-exercise-htlc-timeout-tx",
      "ln-exercise-htlc-success-tx",
      "ln-exercise-finalize-htlc-timeout",
      "ln-exercise-finalize-htlc-success",
    ],
    crossGroupDependencies: [
      "ln-exercise-sign-input",
      "ln-exercise-to-local-script",
      "ln-exercise-offered-htlc-script",
      "ln-exercise-received-htlc-script",
    ],
  },
};

// ─── Lookup Map ──────────────────────────────────────────────────────────────

// Maps exerciseId → { group, orderIndex }
const EXERCISE_INDEX: Record<string, { groupId: string; orderIndex: number }> =
  {};

for (const group of Object.values(EXERCISE_GROUPS)) {
  group.exerciseIds.forEach((id, i) => {
    EXERCISE_INDEX[id] = { groupId: group.id, orderIndex: i };
  });
}

// ─── Context Assembly ────────────────────────────────────────────────────────

/**
 * Returns the group context for a given exercise ID.
 *
 * `priorExercises` contains (in order):
 *   1. Cross-group dependency exercise IDs
 *   2. Prior in-group exercise IDs (those that come before this exercise)
 *
 * The caller should populate `solutionCode` from LIGHTNING_EXERCISES[id].hints.code
 * to serve as a fallback when the student hasn't yet solved the exercise.
 */
export function getExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  priorExercises: Array<{ id: string }>;
} | null {
  const entry = EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  const crossGroupDeps = group.crossGroupDependencies.map((id) => ({ id }));
  const priorInGroup = group.exerciseIds
    .slice(0, entry.orderIndex)
    .map((id) => ({ id }));

  return {
    fileLabel: group.label,
    preamble: group.preamble,
    priorExercises: [...crossGroupDeps, ...priorInGroup],
  };
}
