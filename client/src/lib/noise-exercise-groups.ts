// ─── Noise Exercise Groups ──────────────────────────────────────────────────
//
// Groups the 13 Noise tutorial exercises into 3 logical Python "files":
//   1. crypto/primitives.py        — keypair generation, ECDH, HKDF
//   2. noise/handshake.py          — handshake init + 3 acts (7 exercises)
//   3. noise/transport.py          — encrypt, decrypt, key rotation
//
// Cross-group dependencies carry the student's solutions forward:
//   - handshake.py uses ecdh() and hkdf_two_keys() from primitives.py
//   - transport.py uses hkdf_two_keys() from primitives.py

export interface NoiseExerciseGroup {
  id: string;
  label: string;
  setupCode: string;
  preamble: string;
  exerciseIds: string[];
  crossGroupDependencies: string[];
}

// ─── Hidden Setup Code ──────────────────────────────────────────────────────
//
// Imports needed by cross-group dependencies at runtime.
// When the student's ecdh() from primitives.py runs inside handshake.py,
// it needs SigningKey/SECP256k1 in scope. These imports ensure that.

const BOLT8_NONCE_HELPER = `
def bolt8_nonce(counter):
    """Encode a nonce for BOLT 8 ChaCha20-Poly1305 (4 zero bytes + 8-byte LE counter)."""
    return b'\\x00' * 4 + counter.to_bytes(8, 'little')`;

const HANDSHAKE_SETUP = `from ecdsa import SigningKey, VerifyingKey, SECP256k1
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib, hmac
${BOLT8_NONCE_HELPER}`;

const TRANSPORT_SETUP = `import hmac, hashlib
${BOLT8_NONCE_HELPER}`;

// ─── Visible Preambles (shown in editor, read-only) ────────────────────────

const PRIMITIVES_PREAMBLE = `from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from ecdsa import SigningKey, VerifyingKey, SECP256k1
import hashlib, hmac

def bolt8_nonce(counter):
    """
    Encode a nonce for BOLT 8's ChaCha20-Poly1305.

    BOLT 8 requires a 12-byte nonce: 4 zero bytes of padding followed
    by an 8-byte little-endian counter.

    Args:
        counter: int - the nonce counter value (e.g. 0, 1, 2, ...)

    Returns:
        bytes: 12-byte nonce for ChaCha20-Poly1305
    """
    return b'\\x00' * 4 + counter.to_bytes(8, 'little')`;

const HANDSHAKE_PREAMBLE = `# ecdh(), hkdf_two_keys(), and bolt8_nonce() are defined in crypto/primitives.py
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305`;

const TRANSPORT_PREAMBLE = `# hkdf_two_keys() and bolt8_nonce() are defined in crypto/primitives.py
import struct, hmac, hashlib
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

ROTATION_THRESHOLD = 1000

class CipherState:`;

// ─── Group Definitions ──────────────────────────────────────────────────────

export const NOISE_EXERCISE_GROUPS: Record<string, NoiseExerciseGroup> = {
  "crypto/primitives": {
    id: "crypto/primitives",
    label: "crypto/primitives.py",
    setupCode: "",
    preamble: PRIMITIVES_PREAMBLE,
    exerciseIds: [
      "exercise-generate-keypair",
      "exercise-ecdh",
      "exercise-hkdf",
    ],
    crossGroupDependencies: [],
  },

  "noise/handshake": {
    id: "noise/handshake",
    label: "noise/handshake.py",
    setupCode: HANDSHAKE_SETUP,
    preamble: HANDSHAKE_PREAMBLE,
    exerciseIds: [
      "exercise-init-state",
      "exercise-act1-initiator",
      "exercise-act1-responder",
      "exercise-act2-responder",
      "exercise-act2-initiator",
      "exercise-act3-initiator",
      "exercise-act3-responder",
    ],
    crossGroupDependencies: [
      "exercise-ecdh",
      "exercise-hkdf",
    ],
  },

  "noise/transport": {
    id: "noise/transport",
    label: "noise/transport.py",
    setupCode: TRANSPORT_SETUP,
    preamble: TRANSPORT_PREAMBLE,
    exerciseIds: [
      "exercise-encrypt",
      "exercise-decrypt",
      "exercise-key-rotation",
    ],
    crossGroupDependencies: [
      "exercise-hkdf",
    ],
  },

};

// ─── Lookup Map ─────────────────────────────────────────────────────────────

const NOISE_EXERCISE_INDEX: Record<string, { groupId: string; orderIndex: number }> = {};

for (const group of Object.values(NOISE_EXERCISE_GROUPS)) {
  group.exerciseIds.forEach((id, i) => {
    NOISE_EXERCISE_INDEX[id] = { groupId: group.id, orderIndex: i };
  });
}

// ─── Context Assembly ───────────────────────────────────────────────────────

export function getNoiseExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  setupCode: string;
  crossGroupExercises: Array<{ id: string }>;
  classMethodExercises: Array<{ id: string }>;
  priorInGroupExercises: Array<{ id: string }>;
  futureExercises: Array<{ id: string }>;
} | null {
  const entry = NOISE_EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = NOISE_EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  // Noise has no class method deps — all cross-group deps are standalone functions
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
