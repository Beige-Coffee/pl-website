// ─── Exercise Groups ─────────────────────────────────────────────────────────
//
// Groups exercises into logical Python "files". Each group has:
//   - setupCode: Hidden Python executed by Pyodide but NOT shown in editor.
//                Registers an importable `ln` module with all helper code.
//   - preamble:  Visible in editor (read-only) — clean imports + class declarations
//   - An ordered list of exercise IDs within the group
//   - Cross-group dependencies: exercise IDs from OTHER groups needed at runtime
//
// When a student opens an exercise, they see ONLY:
//   - The visible preamble (imports, class declarations)
//   - The current exercise stub
//
// At test-run time, the full code is:
//   [setupCode] + [preamble] + [cross-group deps] + [prior in-group code] + [student code] + [future stubs] + [test code]

export interface ExerciseGroup {
  id: string;
  label: string; // display filename, e.g. "keys/channel_key_manager.py"
  setupCode: string; // hidden — registers `ln` module, executed by Pyodide but not shown
  preamble: string; // visible in editor (read-only region) — imports + class declarations
  exerciseIds: string[]; // ordered exercise IDs within this group
  crossGroupDependencies: string[]; // exercise IDs from OTHER groups needed at runtime
}

// ─── Hidden Setup Code: The `ln` Virtual Module ─────────────────────────────
//
// All helper functions and classes are defined ONCE and registered as an
// importable `ln` module. Students import from it: `from ln import BIP32, ...`

const LN_MODULE_SETUP = `import hmac
import hashlib
import struct
import types as _types
import sys as _sys
from ecdsa import SECP256k1, SigningKey
from ecdsa.ellipticcurve import Point
from ecdsa.util import sigencode_der_canonize
from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint, lx, CTransaction, CTxWitness, CTxInWitness, CScriptWitness
from bitcoin.core.script import (
    CScript, SignatureHash, SIGHASH_ALL, SIGVERSION_WITNESS_V0,
    OP_0, OP_IF, OP_ELSE, OP_ENDIF, OP_CHECKSIG, OP_CHECKMULTISIG,
    OP_CHECKSEQUENCEVERIFY, OP_CHECKLOCKTIMEVERIFY, OP_DROP, OP_SWAP,
    OP_SIZE, OP_EQUAL, OP_EQUALVERIFY, OP_HASH160, OP_DUP, OP_2,
    OP_NOTIF
)

# ── EC math constants ──
CURVE = SECP256k1.curve
G = SECP256k1.generator
ORDER = SECP256k1.order

# ── Crypto utilities ──

def privkey_to_pubkey(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def hash160(data):
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()

def decompress_pubkey(compressed):
    prefix = compressed[0]
    x = int.from_bytes(compressed[1:], 'big')
    p = CURVE.p()
    y_sq = (pow(x, 3, p) + CURVE.a() * x + CURVE.b()) % p
    y = pow(y_sq, (p + 1) // 4, p)
    if (y % 2 == 0) != (prefix == 0x02):
        y = p - y
    return Point(CURVE, x, y)

def compress_point(point):
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

# ── BIP32 HD Wallet (with fallback when bip32 library is unavailable) ──

try:
    from bip32 import BIP32 as _BIP32_LIB
    _HAS_BIP32 = True
except ImportError:
    _HAS_BIP32 = False

def _manual_ckd_priv(key, chaincode, index):
    if index >= 0x80000000:
        data = b'\\x00' + key + index.to_bytes(4, 'big')
    else:
        pubkey = privkey_to_pubkey(key)
        data = pubkey + index.to_bytes(4, 'big')
    I = hmac.new(chaincode, data, hashlib.sha512).digest()
    child_key_int = (int.from_bytes(I[:32], 'big') + int.from_bytes(key, 'big')) % ORDER
    return child_key_int.to_bytes(32, 'big'), I[32:]

class BIP32:
    def __init__(self, seed):
        self._seed = seed
        if _HAS_BIP32:
            self._lib = _BIP32_LIB.from_seed(seed)
        else:
            self._lib = None
            I = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()
            self._master_key = I[:32]
            self._chain_code = I[32:]

    @classmethod
    def from_seed(cls, seed):
        return cls(seed)

    def get_privkey_from_path(self, path):
        if self._lib:
            return self._lib.get_privkey_from_path(path)
        parts = path.strip().split("/")
        key, cc = self._master_key, self._chain_code
        for part in parts:
            if part == "m":
                continue
            hardened = part.endswith("h") or part.endswith("'") or part.endswith("H")
            idx = int(part.rstrip("hH'"))
            if hardened:
                idx += 0x80000000
            key, cc = _manual_ckd_priv(key, cc, idx)
        return key

    def get_pubkey_from_path(self, path):
        if self._lib:
            return self._lib.get_pubkey_from_path(path)
        return privkey_to_pubkey(self.get_privkey_from_path(path))

# ── CommitmentKeys data container ──

class CommitmentKeys:
    def __init__(self, per_commitment_point, revocation_key,
                 local_delayed_payment_key, local_htlc_key, remote_htlc_key):
        self.per_commitment_point = per_commitment_point
        self.revocation_key = revocation_key
        self.local_delayed_payment_key = local_delayed_payment_key
        self.local_htlc_key = local_htlc_key
        self.remote_htlc_key = remote_htlc_key

# ── Register as importable 'ln' module ──

_ln = _types.ModuleType('ln')
_ln.__dict__.update({
    'privkey_to_pubkey': privkey_to_pubkey,
    'hash160': hash160,
    'decompress_pubkey': decompress_pubkey,
    'compress_point': compress_point,
    'BIP32': BIP32,
    'CommitmentKeys': CommitmentKeys,
    'CURVE': CURVE,
    'G': G,
    'ORDER': ORDER,
})
_sys.modules['ln'] = _ln
`;

// ─── Display Code for ln.py (shown in file browser) ─────────────────────────

export const LN_MODULE_DISPLAY_CODE = `"""
ln.py — Helper functions and classes for Programming Lightning exercises.
These are available in all exercises via: from ln import ...
"""

import hashlib
import hmac
from ecdsa import SECP256k1, SigningKey
from ecdsa.ellipticcurve import Point

# ── EC math constants ──

CURVE = SECP256k1.curve
G = SECP256k1.generator
ORDER = SECP256k1.order

# ── Crypto utilities ──

def privkey_to_pubkey(secret: bytes) -> bytes:
    """Convert a 32-byte private key to a 33-byte compressed public key."""
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def hash160(data: bytes) -> bytes:
    """Compute RIPEMD160(SHA256(data)) — used for Bitcoin address hashing."""
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()

def decompress_pubkey(compressed: bytes) -> Point:
    """Decompress a 33-byte compressed public key to an EC Point."""
    prefix = compressed[0]
    x = int.from_bytes(compressed[1:], 'big')
    p = CURVE.p()
    y_sq = (pow(x, 3, p) + CURVE.a() * x + CURVE.b()) % p
    y = pow(y_sq, (p + 1) // 4, p)
    if (y % 2 == 0) != (prefix == 0x02):
        y = p - y
    return Point(CURVE, x, y)

def compress_point(point: Point) -> bytes:
    """Compress an EC Point to a 33-byte compressed public key."""
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

# ── BIP32 HD Wallet ──

class BIP32:
    """BIP32 hierarchical deterministic wallet for key derivation."""

    def __init__(self, seed: bytes):
        self._seed = seed
        # ... (uses bip32 library or manual HMAC-SHA512 fallback)

    @classmethod
    def from_seed(cls, seed: bytes) -> 'BIP32':
        """Create an HD wallet from a 32-byte seed."""
        return cls(seed)

    def get_privkey_from_path(self, path: str) -> bytes:
        """Derive a 32-byte private key at the given BIP32 path.
        Path uses 'h' for hardened derivation, e.g. 'm/1017h/0h/0h/0/0'."""
        ...

    def get_pubkey_from_path(self, path: str) -> bytes:
        """Derive a 33-byte compressed public key at the given path."""
        ...

# ── CommitmentKeys data container ──

class CommitmentKeys:
    """Holds the 5 per-commitment public keys for a given channel state.
    These keys have been tweaked by the per-commitment point."""

    def __init__(self, per_commitment_point: bytes, revocation_key: bytes,
                 local_delayed_payment_key: bytes, local_htlc_key: bytes,
                 remote_htlc_key: bytes):
        self.per_commitment_point = per_commitment_point
        self.revocation_key = revocation_key
        self.local_delayed_payment_key = local_delayed_payment_key
        self.local_htlc_key = local_htlc_key
        self.remote_htlc_key = remote_htlc_key
`;

// ─── Per-Group Setup Code ───────────────────────────────────────────────────
//
// Consuming groups that use the student's ChannelKeyManager need the class
// declaration in their setupCode so the cross-group dep methods land inside it.

const CKM_CLASS_DECLARATION = `\nclass ChannelKeyManager:`;

const KEYS_CKM_SETUP = LN_MODULE_SETUP;
const KEYS_COMMITMENT_SETUP = LN_MODULE_SETUP;
const SCRIPTS_FUNDING_SETUP = LN_MODULE_SETUP;
const TRANSACTIONS_FUNDING_SETUP = LN_MODULE_SETUP;
const SCRIPTS_COMMITMENT_SETUP = LN_MODULE_SETUP;
const SCRIPTS_HTLC_SETUP = LN_MODULE_SETUP;
const TRANSACTIONS_COMMITMENT_SETUP = LN_MODULE_SETUP + CKM_CLASS_DECLARATION;
const TRANSACTIONS_HTLC_SETUP = LN_MODULE_SETUP + CKM_CLASS_DECLARATION;

// ─── Per-Group Visible Preambles (shown in editor, read-only) ───────────────

const KEYS_CKM_PREAMBLE = `from ln import BIP32, privkey_to_pubkey, CommitmentKeys

class ChannelKeyManager:`;

const KEYS_COMMITMENT_PREAMBLE = `from ln import decompress_pubkey, compress_point, CURVE, G, ORDER, privkey_to_pubkey`;

const SCRIPTS_FUNDING_PREAMBLE = `from bitcoin.core.script import CScript, OP_2, OP_CHECKMULTISIG`;

const TRANSACTIONS_FUNDING_PREAMBLE = `from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint, lx
from bitcoin.core.script import CScript, OP_0
import hashlib, struct`;

const SCRIPTS_COMMITMENT_PREAMBLE = `from bitcoin.core.script import CScript, OP_0, OP_IF, OP_ELSE, OP_ENDIF, OP_CHECKSIG, OP_CHECKSEQUENCEVERIFY, OP_DROP
from ln import hash160`;

const SCRIPTS_HTLC_PREAMBLE = `from bitcoin.core.script import (
    CScript, OP_DUP, OP_HASH160, OP_EQUAL, OP_EQUALVERIFY,
    OP_IF, OP_ELSE, OP_ENDIF, OP_CHECKSIG, OP_CHECKMULTISIG,
    OP_SWAP, OP_SIZE, OP_DROP, OP_CHECKLOCKTIMEVERIFY, OP_2, OP_NOTIF
)
from ln import hash160, CommitmentKeys`;

const TRANSACTIONS_COMMITMENT_PREAMBLE = `from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint, lx, CTransaction, CTxWitness, CTxInWitness, CScriptWitness
from bitcoin.core.script import CScript, OP_0, OP_IF, OP_ELSE, OP_ENDIF, OP_CHECKSIG, OP_CHECKSEQUENCEVERIFY, OP_DROP, SignatureHash, SIGHASH_ALL, SIGVERSION_WITNESS_V0
from ln import hash160, CommitmentKeys
import hashlib, struct`;

const TRANSACTIONS_HTLC_PREAMBLE = `from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint, lx, CTransaction, CTxWitness, CTxInWitness, CScriptWitness
from bitcoin.core.script import (
    CScript, OP_0, OP_IF, OP_ELSE, OP_ENDIF, OP_CHECKSIG, OP_CHECKMULTISIG,
    OP_CHECKSEQUENCEVERIFY, OP_DROP, OP_DUP, OP_HASH160, OP_EQUAL, OP_EQUALVERIFY,
    OP_SWAP, OP_SIZE, OP_CHECKLOCKTIMEVERIFY,
    SignatureHash, SIGHASH_ALL, SIGVERSION_WITNESS_V0
)
from ln import hash160, CommitmentKeys
import hashlib`;

// ─── Group Definitions ───────────────────────────────────────────────────────

export const EXERCISE_GROUPS: Record<string, ExerciseGroup> = {
  "keys/channel_key_manager": {
    id: "keys/channel_key_manager",
    label: "keys/channel_key_manager.py",
    setupCode: KEYS_CKM_SETUP,
    preamble: KEYS_CKM_PREAMBLE,
    exerciseIds: [
      "ln-exercise-channel-key-manager",    // __init__
      "ln-exercise-sign-input",             // sign_input
      "ln-exercise-commitment-secret",      // build_commitment_secret
      "ln-exercise-per-commitment-point",   // derive_per_commitment_point
      "ln-exercise-get-commitment-keys",    // get_commitment_keys (NEW)
    ],
    crossGroupDependencies: [
      "ln-exercise-revocation-pubkey",  // derive_revocation_pubkey (needed by get_commitment_keys)
      "ln-exercise-derive-pubkey",      // derive_pubkey (needed by get_commitment_keys)
    ],
  },

  "scripts/funding": {
    id: "scripts/funding",
    label: "scripts/funding.py",
    setupCode: SCRIPTS_FUNDING_SETUP,
    preamble: SCRIPTS_FUNDING_PREAMBLE,
    exerciseIds: ["ln-exercise-funding-script"],
    crossGroupDependencies: [],
  },

  "transactions/funding": {
    id: "transactions/funding",
    label: "transactions/funding.py",
    setupCode: TRANSACTIONS_FUNDING_SETUP,
    preamble: TRANSACTIONS_FUNDING_PREAMBLE,
    exerciseIds: ["ln-exercise-funding-tx"],
    crossGroupDependencies: ["ln-exercise-funding-script"],
  },

  "keys/commitment": {
    id: "keys/commitment",
    label: "keys/commitment.py",
    setupCode: KEYS_COMMITMENT_SETUP,
    preamble: KEYS_COMMITMENT_PREAMBLE,
    exerciseIds: [
      "ln-exercise-revocation-pubkey",
      "ln-exercise-revocation-privkey",
      "ln-exercise-derive-pubkey",
      "ln-exercise-derive-privkey",
    ],
    crossGroupDependencies: [],
  },

  "scripts/commitment": {
    id: "scripts/commitment",
    label: "scripts/commitment.py",
    setupCode: SCRIPTS_COMMITMENT_SETUP,
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
    setupCode: SCRIPTS_HTLC_SETUP,
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
    setupCode: TRANSACTIONS_COMMITMENT_SETUP,
    preamble: TRANSACTIONS_COMMITMENT_PREAMBLE,
    exerciseIds: [
      "ln-exercise-obscure-factor",
      "ln-exercise-obscured-commitment",
      "ln-exercise-commitment-outputs",
      "ln-exercise-commitment-tx",
      "ln-exercise-finalize-commitment",
      "ln-exercise-htlc-outputs",
    ],
    crossGroupDependencies: [
      // ChannelKeyManager class methods (student's version, all 5)
      // These are 4-space indented and land inside the `class ChannelKeyManager:` from setupCode
      "ln-exercise-channel-key-manager",
      "ln-exercise-sign-input",
      "ln-exercise-commitment-secret",
      "ln-exercise-per-commitment-point",
      "ln-exercise-get-commitment-keys",
      // Key derivation functions (standalone, needed by get_commitment_keys inside CKM)
      "ln-exercise-revocation-pubkey",
      "ln-exercise-derive-pubkey",
      // Script functions (standalone)
      "ln-exercise-funding-script",
      "ln-exercise-to-remote-script",
      "ln-exercise-to-local-script",
      // HTLC script functions (needed by create_htlc_outputs)
      "ln-exercise-offered-htlc-script",
      "ln-exercise-received-htlc-script",
    ],
  },

  "transactions/htlc": {
    id: "transactions/htlc",
    label: "transactions/htlc.py",
    setupCode: TRANSACTIONS_HTLC_SETUP,
    preamble: TRANSACTIONS_HTLC_PREAMBLE,
    exerciseIds: [
      "ln-exercise-htlc-timeout-tx",
      "ln-exercise-htlc-success-tx",
      "ln-exercise-finalize-htlc-timeout",
      "ln-exercise-finalize-htlc-success",
    ],
    crossGroupDependencies: [
      // ChannelKeyManager class methods (student's version, all 5)
      "ln-exercise-channel-key-manager",
      "ln-exercise-sign-input",
      "ln-exercise-commitment-secret",
      "ln-exercise-per-commitment-point",
      "ln-exercise-get-commitment-keys",
      // Key derivation functions (standalone)
      "ln-exercise-revocation-pubkey",
      "ln-exercise-derive-pubkey",
      "ln-exercise-derive-privkey",
      // Script functions (standalone)
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
 * The caller populates `solutionCode` and `starterCode` from LIGHTNING_EXERCISES.
 */
export function getExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  setupCode: string;
  priorExercises: Array<{ id: string }>;
  futureExercises: Array<{ id: string }>;
} | null {
  const entry = EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  const crossGroupDeps = group.crossGroupDependencies.map((id) => ({ id }));
  const priorInGroup = group.exerciseIds
    .slice(0, entry.orderIndex)
    .map((id) => ({ id }));
  const futureInGroup = group.exerciseIds
    .slice(entry.orderIndex + 1)
    .map((id) => ({ id }));

  return {
    fileLabel: group.label,
    preamble: group.preamble,
    setupCode: group.setupCode,
    priorExercises: [...crossGroupDeps, ...priorInGroup],
    futureExercises: futureInGroup,
  };
}
