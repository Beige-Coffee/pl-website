// ─── Onion Routing Exercise Groups ──────────────────────────────────────────
//
// Groups exercises into logical Python "files". Each group has:
//   - setupCode: Hidden Python executed by Pyodide but NOT shown in editor.
//   - preamble:  Visible in editor (read-only) — clean imports + class declarations
//   - An ordered list of exercise IDs within the group
//   - Cross-group dependencies: exercise IDs from OTHER groups needed at runtime
//
// Groups:
//   1. routing/utils.py        — Fee/CLTV calculation, TLV payload encoding
//   2. sphinx/builder.py       — SphinxPacketBuilder class (shared secrets, keys, packet construction)
//   3. sphinx/processor.py     — SphinxPacketProcessor class (peel, validate, end-to-end)
//   4. sphinx/capstone.py      — End-to-end payment trace exercise

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
// Will eventually register an importable `onion` module with helper functions.
// For now, empty strings — populated as exercises are built.

const ROUTING_SETUP = `
# No hidden setup needed for routing/utils — exercises are standalone
`;

const SPHINX_BUILDER_SETUP = `
from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac
import struct

# ─── Helper: bigsize encoding (BOLT variable-length integers) ─────────────
def encode_bigsize(value):
    if value < 0xfd:
        return struct.pack('B', value)
    elif value <= 0xffff:
        return b'\\xfd' + struct.pack('>H', value)
    elif value <= 0xffffffff:
        return b'\\xfe' + struct.pack('>I', value)
    else:
        return b'\\xff' + struct.pack('>Q', value)

# ─── Helper: truncated uint64 (minimal big-endian) ───────────────────────
def encode_tu64(value):
    if value == 0:
        return b''
    return value.to_bytes(8, 'big').lstrip(b'\\x00')

# ─── Helper: XOR two byte sequences ─────────────────────────────────────
def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

# ─── Helper: Generate pseudo-random cipher stream (ChaCha20, zero nonce) ─
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20

def generate_cipher_stream(key, length):
    """Generate a pseudo-random byte stream using ChaCha20 with zero nonce."""
    nonce = b"\\x00" * 16  # ChaCha20 in cryptography lib uses 16-byte nonce
    cipher = Cipher(ChaCha20(key, nonce), mode=None)
    encryptor = cipher.encryptor()
    return encryptor.update(b"\\x00" * length)
`;

const SPHINX_PROCESSOR_SETUP = `
from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac
import struct

# ─── Helper: bigsize encoding (BOLT variable-length integers) ─────────────
def encode_bigsize(value):
    if value < 0xfd:
        return struct.pack('B', value)
    elif value <= 0xffff:
        return b'\\xfd' + struct.pack('>H', value)
    elif value <= 0xffffffff:
        return b'\\xfe' + struct.pack('>I', value)
    else:
        return b'\\xff' + struct.pack('>Q', value)

# ─── Helper: truncated uint64 (minimal big-endian) ───────────────────────
def encode_tu64(value):
    if value == 0:
        return b''
    return value.to_bytes(8, 'big').lstrip(b'\\x00')

# ─── Helper: XOR two byte sequences ─────────────────────────────────────
def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

# ─── Helper: Generate pseudo-random cipher stream (ChaCha20, zero nonce) ─
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20

def generate_cipher_stream(key, length):
    """Generate a pseudo-random byte stream using ChaCha20 with zero nonce."""
    nonce = b"\\x00" * 16  # ChaCha20 in cryptography lib uses 16-byte nonce
    cipher = Cipher(ChaCha20(key, nonce), mode=None)
    encryptor = cipher.encryptor()
    return encryptor.update(b"\\x00" * length)

# ─── SphinxPacketBuilder (complete implementation from previous exercises) ─
class SphinxPacketBuilder:
    def __init__(self, session_key_hex: str, route_pubkeys_hex: list):
        self.session_key = bytes.fromhex(session_key_hex)
        self.route_pubkeys = [bytes.fromhex(pk) for pk in route_pubkeys_hex]
        self.num_hops = len(route_pubkeys_hex)

    @staticmethod
    def compute_shared_secret(private_key_bytes, public_key_bytes):
        sk = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
        vk = VerifyingKey.from_string(public_key_bytes, curve=SECP256k1)
        ecdh_point = vk.pubkey.point * sk.privkey.secret_multiplier
        x_bytes = ecdh_point.x().to_bytes(32, 'big')
        return hashlib.sha256(x_bytes).digest()

    def derive_hop_keys(self, shared_secret):
        key_types = [b"rho", b"mu", b"um", b"pad", b"ammag"]
        keys = {}
        for kt in key_types:
            keys[kt.decode()] = hmac.new(kt, shared_secret, hashlib.sha256).digest()
        return keys

    def compute_blinding_factor(self, ephemeral_pubkey, shared_secret):
        bf_hash = hashlib.sha256(ephemeral_pubkey + shared_secret).digest()
        return int.from_bytes(bf_hash, 'big')

    def compute_ephemeral_keys_and_secrets(self):
        ephemeral_pubkeys = []
        shared_secrets = []
        hop_keys = []
        current_sk = SigningKey.from_string(self.session_key, curve=SECP256k1)
        for i in range(self.num_hops):
            eph_pubkey = current_sk.get_verifying_key().to_string("compressed")
            ephemeral_pubkeys.append(eph_pubkey)
            current_privkey_bytes = current_sk.to_string()
            ss = self.compute_shared_secret(current_privkey_bytes, self.route_pubkeys[i])
            shared_secrets.append(ss)
            hop_keys.append(self.derive_hop_keys(ss))
            if i < self.num_hops - 1:
                bf = self.compute_blinding_factor(eph_pubkey, ss)
                current_int = current_sk.privkey.secret_multiplier
                next_int = (current_int * bf) % SECP256k1.order
                current_sk = SigningKey.from_secret_exponent(next_int, curve=SECP256k1)
        self.ephemeral_pubkeys = ephemeral_pubkeys
        self.shared_secrets = shared_secrets
        self.hop_keys = hop_keys
        return (ephemeral_pubkeys, shared_secrets)

    def build_hop_payloads(self, hops_data):
        payloads = []
        for hop in hops_data:
            tlv_records = b''
            amt_bytes = encode_tu64(hop['amt_to_forward_msat'])
            tlv_records += encode_bigsize(2) + encode_bigsize(len(amt_bytes)) + amt_bytes
            cltv_bytes = encode_tu64(hop['outgoing_cltv_value'])
            tlv_records += encode_bigsize(4) + encode_bigsize(len(cltv_bytes)) + cltv_bytes
            scid = hop.get('short_channel_id', '')
            if scid:
                parts = scid.split('x')
                block, txindex, output = int(parts[0]), int(parts[1]), int(parts[2])
                scid_int = (block << 40) | (txindex << 16) | output
                scid_bytes = scid_int.to_bytes(8, 'big')
                tlv_records += encode_bigsize(6) + encode_bigsize(8) + scid_bytes
            payloads.append(encode_bigsize(len(tlv_records)) + tlv_records)
        return payloads

    def generate_filler(self, hop_payloads):
        filler = bytearray()
        for i in range(self.num_hops - 1):
            shift_size = len(hop_payloads[i]) + 32
            stream = generate_cipher_stream(self.hop_keys[i]['rho'], 1300)
            filler.extend(b'\\x00' * shift_size)
            filler_start = 1300 - len(filler)
            for j in range(len(filler)):
                filler[j] ^= stream[filler_start + j]
        return bytes(filler)

    def wrap_layer(self, payload_buffer, hop_payload, current_hmac,
                   rho_key, mu_key, assoc_data, filler=b"", is_innermost=False):
        shift_size = len(hop_payload) + 32
        payload_buffer = bytearray(hop_payload) + bytearray(current_hmac) + payload_buffer[:1300 - shift_size]
        stream = generate_cipher_stream(rho_key, 1300)
        payload_buffer = bytearray(xor_bytes(bytes(payload_buffer), stream))
        if is_innermost and filler:
            payload_buffer[1300 - len(filler):] = filler
        new_hmac = hmac.new(mu_key, bytes(payload_buffer) + assoc_data, hashlib.sha256).digest()
        return payload_buffer, new_hmac

    def construct_packet(self, hops_data, assoc_data):
        self.compute_ephemeral_keys_and_secrets()
        hop_payloads = self.build_hop_payloads(hops_data)
        filler = self.generate_filler(hop_payloads)
        payload_buffer = bytearray(1300)
        current_hmac = bytes(32)
        for i in range(self.num_hops - 1, -1, -1):
            is_innermost = (i == self.num_hops - 1)
            payload_buffer, current_hmac = self.wrap_layer(
                payload_buffer, hop_payloads[i], current_hmac,
                self.hop_keys[i]['rho'], self.hop_keys[i]['mu'], assoc_data,
                filler=filler if is_innermost else b"",
                is_innermost=is_innermost,
            )
        version = b"\\x00"
        return version + self.ephemeral_pubkeys[0] + bytes(payload_buffer) + current_hmac
`;

const CAPSTONE_SETUP = `
from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac
import struct

# ─── Helper: bigsize encoding (BOLT variable-length integers) ─────────────
def encode_bigsize(value):
    if value < 0xfd:
        return struct.pack('B', value)
    elif value <= 0xffff:
        return b'\\xfd' + struct.pack('>H', value)
    elif value <= 0xffffffff:
        return b'\\xfe' + struct.pack('>I', value)
    else:
        return b'\\xff' + struct.pack('>Q', value)

# ─── Helper: truncated uint64 (minimal big-endian) ───────────────────────
def encode_tu64(value):
    if value == 0:
        return b''
    return value.to_bytes(8, 'big').lstrip(b'\\x00')

# ─── Helper: XOR two byte sequences ─────────────────────────────────────
def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))

# ─── Helper: Generate pseudo-random cipher stream (ChaCha20, zero nonce) ─
from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import ChaCha20

def generate_cipher_stream(key, length):
    """Generate a pseudo-random byte stream using ChaCha20 with zero nonce."""
    nonce = b"\\x00" * 16  # ChaCha20 in cryptography lib uses 16-byte nonce
    cipher = Cipher(ChaCha20(key, nonce), mode=None)
    encryptor = cipher.encryptor()
    return encryptor.update(b"\\x00" * length)

# ─── SphinxPacketBuilder (complete implementation) ────────────────────────
class SphinxPacketBuilder:
    def __init__(self, session_key_hex: str, route_pubkeys_hex: list):
        self.session_key = bytes.fromhex(session_key_hex)
        self.route_pubkeys = [bytes.fromhex(pk) for pk in route_pubkeys_hex]
        self.num_hops = len(route_pubkeys_hex)

    @staticmethod
    def compute_shared_secret(private_key_bytes, public_key_bytes):
        sk = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
        vk = VerifyingKey.from_string(public_key_bytes, curve=SECP256k1)
        ecdh_point = vk.pubkey.point * sk.privkey.secret_multiplier
        x_bytes = ecdh_point.x().to_bytes(32, 'big')
        return hashlib.sha256(x_bytes).digest()

    def derive_hop_keys(self, shared_secret):
        key_types = [b"rho", b"mu", b"um", b"pad", b"ammag"]
        keys = {}
        for kt in key_types:
            keys[kt.decode()] = hmac.new(kt, shared_secret, hashlib.sha256).digest()
        return keys

    def compute_blinding_factor(self, ephemeral_pubkey, shared_secret):
        bf_hash = hashlib.sha256(ephemeral_pubkey + shared_secret).digest()
        return int.from_bytes(bf_hash, 'big')

    def compute_ephemeral_keys_and_secrets(self):
        ephemeral_pubkeys = []
        shared_secrets = []
        hop_keys = []
        current_sk = SigningKey.from_string(self.session_key, curve=SECP256k1)
        for i in range(self.num_hops):
            eph_pubkey = current_sk.get_verifying_key().to_string("compressed")
            ephemeral_pubkeys.append(eph_pubkey)
            current_privkey_bytes = current_sk.to_string()
            ss = self.compute_shared_secret(current_privkey_bytes, self.route_pubkeys[i])
            shared_secrets.append(ss)
            hop_keys.append(self.derive_hop_keys(ss))
            if i < self.num_hops - 1:
                bf = self.compute_blinding_factor(eph_pubkey, ss)
                current_int = current_sk.privkey.secret_multiplier
                next_int = (current_int * bf) % SECP256k1.order
                current_sk = SigningKey.from_secret_exponent(next_int, curve=SECP256k1)
        self.ephemeral_pubkeys = ephemeral_pubkeys
        self.shared_secrets = shared_secrets
        self.hop_keys = hop_keys
        return (ephemeral_pubkeys, shared_secrets)

    def build_hop_payloads(self, hops_data):
        payloads = []
        for hop in hops_data:
            tlv_records = b''
            amt_bytes = encode_tu64(hop['amt_to_forward_msat'])
            tlv_records += encode_bigsize(2) + encode_bigsize(len(amt_bytes)) + amt_bytes
            cltv_bytes = encode_tu64(hop['outgoing_cltv_value'])
            tlv_records += encode_bigsize(4) + encode_bigsize(len(cltv_bytes)) + cltv_bytes
            scid = hop.get('short_channel_id', '')
            if scid:
                parts = scid.split('x')
                block, txindex, output = int(parts[0]), int(parts[1]), int(parts[2])
                scid_int = (block << 40) | (txindex << 16) | output
                scid_bytes = scid_int.to_bytes(8, 'big')
                tlv_records += encode_bigsize(6) + encode_bigsize(8) + scid_bytes
            payloads.append(encode_bigsize(len(tlv_records)) + tlv_records)
        return payloads

    def generate_filler(self, hop_payloads):
        filler = bytearray()
        for i in range(self.num_hops - 1):
            shift_size = len(hop_payloads[i]) + 32
            stream = generate_cipher_stream(self.hop_keys[i]['rho'], 1300)
            filler.extend(b'\\x00' * shift_size)
            filler_start = 1300 - len(filler)
            for j in range(len(filler)):
                filler[j] ^= stream[filler_start + j]
        return bytes(filler)

    def wrap_layer(self, payload_buffer, hop_payload, current_hmac,
                   rho_key, mu_key, assoc_data, filler=b"", is_innermost=False):
        shift_size = len(hop_payload) + 32
        payload_buffer = bytearray(hop_payload) + bytearray(current_hmac) + payload_buffer[:1300 - shift_size]
        stream = generate_cipher_stream(rho_key, 1300)
        payload_buffer = bytearray(xor_bytes(bytes(payload_buffer), stream))
        if is_innermost and filler:
            payload_buffer[1300 - len(filler):] = filler
        new_hmac = hmac.new(mu_key, bytes(payload_buffer) + assoc_data, hashlib.sha256).digest()
        return payload_buffer, new_hmac

    def construct_packet(self, hops_data, assoc_data):
        self.compute_ephemeral_keys_and_secrets()
        hop_payloads = self.build_hop_payloads(hops_data)
        filler = self.generate_filler(hop_payloads)
        payload_buffer = bytearray(1300)
        current_hmac = bytes(32)
        for i in range(self.num_hops - 1, -1, -1):
            is_innermost = (i == self.num_hops - 1)
            payload_buffer, current_hmac = self.wrap_layer(
                payload_buffer, hop_payloads[i], current_hmac,
                self.hop_keys[i]['rho'], self.hop_keys[i]['mu'], assoc_data,
                filler=filler if is_innermost else b"",
                is_innermost=is_innermost,
            )
        version = b"\\x00"
        return version + self.ephemeral_pubkeys[0] + bytes(payload_buffer) + current_hmac

# ─── SphinxPacketProcessor (complete implementation) ──────────────────────
class SphinxPacketProcessor:
    def __init__(self, private_key_hex: str):
        self.private_key = bytes.fromhex(private_key_hex)

    def peel_layer(self, packet, assoc_data):
        version = packet[0:1]
        eph_pubkey = packet[1:34]
        routing_info = packet[34:1334]
        packet_hmac = packet[1334:1366]

        sk = SigningKey.from_string(self.private_key, curve=SECP256k1)
        vk = VerifyingKey.from_string(eph_pubkey, curve=SECP256k1)
        ecdh_point = vk.pubkey.point * sk.privkey.secret_multiplier
        x_bytes = ecdh_point.x().to_bytes(32, 'big')
        shared_secret = hashlib.sha256(x_bytes).digest()

        key_types = [b"rho", b"mu", b"um", b"pad", b"ammag"]
        keys = {}
        for kt in key_types:
            keys[kt.decode()] = hmac.new(kt, shared_secret, hashlib.sha256).digest()

        expected_hmac = hmac.new(keys['mu'], routing_info + assoc_data, hashlib.sha256).digest()
        if expected_hmac != packet_hmac:
            raise ValueError("HMAC verification failed")

        stream = generate_cipher_stream(keys['rho'], 1300)
        decrypted = xor_bytes(routing_info, stream)

        payload_length = decrypted[0]
        hop_payload = decrypted[0:1 + payload_length]
        next_hmac = decrypted[1 + payload_length:1 + payload_length + 32]

        payload_end = 1 + payload_length + 32
        next_routing = decrypted[payload_end:] + b"\\x00" * payload_end

        is_final = next_hmac == bytes(32)

        if is_final:
            return {
                'hop_payload': hop_payload,
                'next_packet': None,
                'is_final': True,
            }

        bf_hash = hashlib.sha256(eph_pubkey + shared_secret).digest()
        bf_int = int.from_bytes(bf_hash, 'big')
        eph_vk = VerifyingKey.from_string(eph_pubkey, curve=SECP256k1)
        next_point = eph_vk.pubkey.point * bf_int
        x = next_point.x()
        y = next_point.y()
        prefix = b"\\x02" if y % 2 == 0 else b"\\x03"
        next_eph = prefix + x.to_bytes(32, 'big')

        next_packet = b"\\x00" + next_eph + next_routing + next_hmac
        return {
            'hop_payload': hop_payload,
            'next_packet': next_packet,
            'is_final': False,
        }

    def construct_error(self, shared_secret, failure_code, failure_data=b""):
        um_key = hmac.new(b"um", shared_secret, hashlib.sha256).digest()
        ammag_key = hmac.new(b"ammag", shared_secret, hashlib.sha256).digest()
        error_msg = (failure_code.to_bytes(2, 'big') +
                     len(failure_data).to_bytes(2, 'big') +
                     failure_data)
        padded = error_msg + b"\\x00" * (256 - len(error_msg))
        error_hmac = hmac.new(um_key, padded, hashlib.sha256).digest()
        packet = error_hmac + padded
        stream = generate_cipher_stream(ammag_key, 288)
        return xor_bytes(packet, stream)

    def wrap_error(self, shared_secret, error_packet):
        ammag_key = hmac.new(b"ammag", shared_secret, hashlib.sha256).digest()
        stream = generate_cipher_stream(ammag_key, 288)
        return xor_bytes(error_packet, stream)
`;

// ─── Visible Preambles (shown in editor, read-only) ────────────────────────
//
// Will contain imports for hashlib, hmac, struct, ecdsa, cryptography, etc.

const ROUTING_PREAMBLE = `import struct
`;

const SPHINX_BUILDER_PREAMBLE = `from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac
import struct

# Available helpers (provided):
#   encode_bigsize(value) -> bytes        # BOLT bigsize encoding
#   encode_tu64(value) -> bytes           # Truncated uint64 encoding
#   xor_bytes(a, b) -> bytes              # XOR two byte sequences
#   generate_cipher_stream(key, length) -> bytes  # ChaCha20 pseudo-random stream
`;

const SPHINX_PROCESSOR_PREAMBLE = `from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac

# SphinxPacketBuilder is available (from previous exercises)
# Helpers available: generate_cipher_stream, xor_bytes, encode_bigsize, encode_tu64
`;

const CAPSTONE_PREAMBLE = `from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib
import hmac

# Both SphinxPacketBuilder and SphinxPacketProcessor are available (from previous exercises).
# Helpers available: generate_cipher_stream, xor_bytes, encode_bigsize, encode_tu64
`;

// ─── Group Definitions ──────────────────────────────────────────────────────

export const ONION_ROUTING_EXERCISE_GROUPS: Record<string, OnionRoutingExerciseGroup> = {
  "routing/utils": {
    id: "routing/utils",
    label: "routing/utils.py",
    setupCode: ROUTING_SETUP,
    preamble: ROUTING_PREAMBLE,
    exerciseIds: [
      "exercise-fee-cltv-calculation",
      "exercise-build-tlv-payload",
    ],
    crossGroupDependencies: [],
  },

  "sphinx/builder": {
    id: "sphinx/builder",
    label: "sphinx/builder.py",
    setupCode: SPHINX_BUILDER_SETUP,
    preamble: SPHINX_BUILDER_PREAMBLE,
    exerciseIds: [
      "exercise-sphinx-init-shared-secrets",
      "exercise-derive-hop-keys",
      "exercise-ephemeral-key-chain",
      "exercise-build-hop-payload",
      "exercise-generate-filler",
      "exercise-wrap-construct-packet",
    ],
    crossGroupDependencies: [],
  },

  "sphinx/processor": {
    id: "sphinx/processor",
    label: "sphinx/processor.py",
    setupCode: SPHINX_PROCESSOR_SETUP,
    preamble: SPHINX_PROCESSOR_PREAMBLE,
    exerciseIds: [
      "exercise-peel-layer",
      "exercise-validate-forward",
      "exercise-end-to-end-verify",
      "exercise-construct-error",
      "exercise-unwrap-error",
    ],
    crossGroupDependencies: [
      "exercise-sphinx-init-shared-secrets",
      "exercise-derive-hop-keys",
      "exercise-ephemeral-key-chain",
      "exercise-build-hop-payload",
      "exercise-generate-filler",
      "exercise-wrap-construct-packet",
    ],
  },

  "sphinx/capstone": {
    id: "sphinx/capstone",
    label: "sphinx/capstone.py",
    setupCode: CAPSTONE_SETUP,
    preamble: CAPSTONE_PREAMBLE,
    exerciseIds: [
      "exercise-payment-trace",
    ],
    crossGroupDependencies: [
      // sphinx/builder exercises
      "exercise-sphinx-init-shared-secrets",
      "exercise-derive-hop-keys",
      "exercise-ephemeral-key-chain",
      "exercise-build-hop-payload",
      "exercise-generate-filler",
      "exercise-wrap-construct-packet",
      // sphinx/processor exercises
      "exercise-peel-layer",
      "exercise-validate-forward",
      "exercise-end-to-end-verify",
      "exercise-construct-error",
      "exercise-unwrap-error",
    ],
  },
};

// ─── Lookup Map ─────────────────────────────────────────────────────────────

const ONION_ROUTING_EXERCISE_INDEX: Record<string, { groupId: string; orderIndex: number }> = {};

for (const group of Object.values(ONION_ROUTING_EXERCISE_GROUPS)) {
  group.exerciseIds.forEach((id, i) => {
    ONION_ROUTING_EXERCISE_INDEX[id] = { groupId: group.id, orderIndex: i };
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
  const entry = ONION_ROUTING_EXERCISE_INDEX[exerciseId];
  if (!entry) return null;

  const group = ONION_ROUTING_EXERCISE_GROUPS[entry.groupId];
  if (!group) return null;

  // Onion routing currently has no class method deps — all cross-group deps are standalone
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
