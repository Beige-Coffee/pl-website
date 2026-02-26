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
//   [setupCode] + [classMethodDeps] + [standaloneDeps] + [preamble] + [prior in-group code] + [student code] + [future stubs] + [test code]

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

def _ripemd160(data):
    try:
        return hashlib.new('ripemd160',usedforsecurity=False,data=data).digest()
    except (ValueError, TypeError):
        import struct as _st
        def _f(j,x,y,z):
            if j<16: return x^y^z
            if j<32: return (x&y)|(~x&z)
            if j<48: return (x|~y)^z
            if j<64: return (x&z)|(y&~z)
            return x^(y|~z)
        def _rl(n,s): return((n<<s)|(n>>(32-s)))&0xffffffff
        _K1=(0,0x5a827999,0x6ed9eba1,0x8f1bbcdc,0xa953fd4e)
        _K2=(0x50a28be6,0x5c4dd124,0x6d703ef3,0x7a6d76e9,0)
        _R1=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]
        _R2=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]
        _S1=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]
        _S2=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]
        msg=bytearray(data)
        l=len(msg)*8
        msg.append(0x80)
        while len(msg)%64!=56: msg.append(0)
        msg+=_st.pack('<Q',l)
        h0,h1,h2,h3,h4=0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0
        for i in range(0,len(msg),64):
            w=list(_st.unpack_from('<16I',msg,i))
            a1,b1,c1,d1,e1=h0,h1,h2,h3,h4
            a2,b2,c2,d2,e2=h0,h1,h2,h3,h4
            for j in range(80):
                rnd=j//16
                t=(_rl((a1+_f(j,b1,c1,d1)+w[_R1[j]]+_K1[rnd])&0xffffffff,_S1[j])+e1)&0xffffffff
                a1=e1;e1=d1;d1=_rl(c1,10);c1=b1;b1=t
                t=(_rl((a2+_f(79-j,b2,c2,d2)+w[_R2[j]]+_K2[rnd])&0xffffffff,_S2[j])+e2)&0xffffffff
                a2=e2;e2=d2;d2=_rl(c2,10);c2=b2;b2=t
            t=(h1+c1+d2)&0xffffffff
            h1=(h2+d1+e2)&0xffffffff
            h2=(h3+e1+a2)&0xffffffff
            h3=(h4+a1+b2)&0xffffffff
            h4=(h0+b1+c2)&0xffffffff
            h0=t
        return _st.pack('<5I',h0,h1,h2,h3,h4)

def hash160(data):
    return _ripemd160(hashlib.sha256(data).digest())

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

def _ripemd160(data: bytes) -> bytes:
    """RIPEMD-160 hash (used internally by hash160)."""
    return hashlib.new('ripemd160', data).digest()

def privkey_to_pubkey(secret: bytes) -> bytes:
    """Convert a 32-byte private key to a 33-byte compressed public key."""
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def hash160(data: bytes) -> bytes:
    """Compute RIPEMD160(SHA256(data)) — used for Bitcoin address hashing."""
    return _ripemd160(hashlib.sha256(data).digest())

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
from bitcoin.core import CTransaction
from bitcoin.core.script import CScript, SignatureHash, SIGHASH_ALL, SIGVERSION_WITNESS_V0
from ecdsa import SECP256k1, SigningKey
from ecdsa.util import sigencode_der_canonize

class ChannelKeyManager:`;

const KEYS_COMMITMENT_PREAMBLE = `from ln import decompress_pubkey, compress_point, CURVE, G, ORDER, privkey_to_pubkey`;

const SCRIPTS_FUNDING_PREAMBLE = `from bitcoin.core.script import CScript, OP_2, OP_CHECKMULTISIG`;

const TRANSACTIONS_FUNDING_PREAMBLE = `from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint, lx
from bitcoin.core.script import CScript, OP_0
import hashlib`;

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
 * Cross-group deps are split into two categories:
 *   - `crossGroupExercises`: standalone functions placed BEFORE the preamble
 *   - `classMethodExercises`: class methods placed AFTER setupCode's class declaration
 *     (only relevant for consuming groups whose setupCode includes `class ChannelKeyManager:`)
 *
 * `priorInGroupExercises`: exercises within the same group that come before this one
 *   (placed AFTER the preamble, inside the class body if applicable)
 */
export function getExerciseGroupContext(exerciseId: string): {
  fileLabel: string;
  preamble: string;
  setupCode: string;
  crossGroupExercises: Array<{ id: string }>;
  classMethodExercises: Array<{ id: string }>;
  priorInGroupExercises: Array<{ id: string }>;
  futureExercises: Array<{ id: string }>;
} | null {
  const entry = EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  // Split cross-group deps: if a dep belongs to the keys/channel_key_manager group,
  // it's a class method that goes after setupCode's `class ChannelKeyManager:`.
  // Otherwise it's a standalone function that goes before the preamble.
  const classMethodDeps: Array<{ id: string }> = [];
  const standaloneDeps: Array<{ id: string }> = [];

  for (const depId of group.crossGroupDependencies) {
    const depEntry = EXERCISE_INDEX[depId];
    if (depEntry && depEntry.groupId === "keys/channel_key_manager") {
      classMethodDeps.push({ id: depId });
    } else {
      standaloneDeps.push({ id: depId });
    }
  }

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
    crossGroupExercises: standaloneDeps,
    classMethodExercises: classMethodDeps,
    priorInGroupExercises: priorInGroup,
    futureExercises: futureInGroup,
  };
}
