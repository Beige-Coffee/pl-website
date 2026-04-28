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
const BUILDER_SETUP = ``;
const FORWARDER_SETUP = ``;
const ERRORS_SETUP = ``;

// ─── Visible Preambles (shown in editor, read-only) ────────────────────────

const KEYS_PREAMBLE = `import hashlib, hmac, struct
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes`;

const BUILDER_PREAMBLE = `# derive_keys() comes from crypto/keys.py
from ecdsa import SigningKey, VerifyingKey, SECP256k1
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20
import hashlib, hmac, struct

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
    exerciseIds: [],
    crossGroupDependencies: [],
  },

  "sphinx/builder": {
    id: "sphinx/builder",
    label: "sphinx/builder.py",
    setupCode: BUILDER_SETUP,
    preamble: BUILDER_PREAMBLE,
    exerciseIds: [],
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
