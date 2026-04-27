// ─── Onion Routing Exercise Definitions ──────────────────────────────────────
//
// Each exercise has starter code, test code, hints, and metadata.
// Exercises are keyed by ID and referenced from tutorial markdown via
// <code-intro exerciseId="..."> tags.
//
// Planned exercises:
// Section 2 (standalone):
//   - exercise-fee-cltv-calculation
//   - exercise-build-tlv-payload
// Section 3 (SphinxPacketBuilder):
//   - exercise-sphinx-init-shared-secrets
//   - exercise-derive-hop-keys
//   - exercise-ephemeral-key-chain
// Section 4 (SphinxPacketBuilder continued):
//   - exercise-build-hop-payload
//   - exercise-generate-filler
//   - exercise-wrap-construct-packet
// Section 5 (SphinxPacketProcessor):
//   - exercise-peel-layer
//   - exercise-validate-forward
//   - exercise-end-to-end-verify
// Section 7 (SphinxPacketProcessor continued):
//   - exercise-construct-error
//   - exercise-unwrap-error
// Section 8 (Capstone):
//   - exercise-payment-trace

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
  group: string;       // e.g. "routing" or "sphinx-builder"
  groupOrder: number;  // 1-based position within the group
}

export const ONION_ROUTING_EXERCISES: Record<string, CodeExerciseData> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 1 — Fee & CLTV Backward Calculation
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-fee-cltv-calculation": {
    id: "exercise-fee-cltv-calculation",
    title: "Exercise 1: Calculate Route Fees and Timelocks",
    description:
      "Implement a function that calculates the per-hop forwarding amounts and CLTV values for a 3-hop payment route, working backward from the final destination. " +
      "In Lightning, the sender (Alice) must pre-compute exactly how much each intermediate node forwards and what CLTV expiry to set, because these values are sealed inside the encrypted onion packet. " +
      "The calculation starts at the final recipient and works backward: each hop's fee depends on the amount it forwards, and each hop's CLTV depends on the downstream hop's requirements.",
    starterCode: `def calculate_route(
    payment_amount_msat: int,
    min_final_cltv_expiry_delta: int,
    current_block_height: int,
    hops: list[dict]
) -> list[dict]:
    """
    Calculate per-hop forwarding amounts and CLTV values, working backward.

    Args:
        payment_amount_msat: Amount the final hop receives (millisatoshis)
        min_final_cltv_expiry_delta: Minimum CLTV delta for the final hop
        current_block_height: Current blockchain height
        hops: List of dicts from FIRST hop to LAST hop, each with:
            - 'fee_base_msat': Base fee in millisatoshis
            - 'fee_proportional_millionths': Proportional fee rate
            - 'cltv_expiry_delta': CLTV delta this hop requires
            - 'short_channel_id': Channel to forward on

    Returns:
        List of dicts (same order as hops), each with:
            - 'amt_to_forward_msat': Amount this hop forwards to the next hop
            - 'outgoing_cltv_value': CLTV value for the outgoing HTLC
            - 'short_channel_id': Channel to forward on (empty string for final hop)
            - 'fee_msat': Fee this hop earns (0 for final hop)
    """
    # TODO: Implement backward fee and CLTV calculation
    pass
`,
    testCode: `
# Test with the canonical trace: Alice -> Bob -> Carol -> Dave
hops = [
    {  # Bob's policy
        'fee_base_msat': 1000,
        'fee_proportional_millionths': 100,
        'cltv_expiry_delta': 40,
        'short_channel_id': '700000x1x0'
    },
    {  # Carol's policy
        'fee_base_msat': 500,
        'fee_proportional_millionths': 50,
        'cltv_expiry_delta': 30,
        'short_channel_id': '700000x2x0'
    },
    {  # Dave (final hop — no forwarding policy)
        'fee_base_msat': 0,
        'fee_proportional_millionths': 0,
        'cltv_expiry_delta': 0,
        'short_channel_id': ''
    }
]

result = calculate_route(
    payment_amount_msat=50_000_000,
    min_final_cltv_expiry_delta=18,
    current_block_height=700_000,
    hops=hops
)

assert len(result) == 3, f"Expected 3 hop results, got {len(result)}"

# Dave (final hop): receives the payment amount, CLTV = height + min_final_delta
assert result[2]['amt_to_forward_msat'] == 50_000_000, \\
    f"Dave should receive 50,000,000 msat, got {result[2]['amt_to_forward_msat']}"
assert result[2]['outgoing_cltv_value'] == 700_018, \\
    f"Dave's CLTV should be 700,018, got {result[2]['outgoing_cltv_value']}"
assert result[2]['fee_msat'] == 0, \\
    f"Dave (final hop) should have 0 fee, got {result[2]['fee_msat']}"

# Carol: forwards payment_amount to Dave, earns fee for doing so
carol_fee = 500 + (50_000_000 * 50 // 1_000_000)  # = 3,000
assert result[1]['amt_to_forward_msat'] == 50_000_000, \\
    f"Carol forwards 50,000,000 msat to Dave, got {result[1]['amt_to_forward_msat']}"
assert result[1]['outgoing_cltv_value'] == 700_018, \\
    f"Carol's outgoing CLTV should be 700,018, got {result[1]['outgoing_cltv_value']}"
assert result[1]['fee_msat'] == carol_fee, \\
    f"Carol's fee should be {carol_fee}, got {result[1]['fee_msat']}"

# Bob: forwards (payment_amount + carol_fee) to Carol, earns fee for doing so
bob_forward = 50_000_000 + carol_fee  # = 50,003,000
bob_fee = 1000 + (bob_forward * 100 // 1_000_000)  # = 6,000
assert result[0]['amt_to_forward_msat'] == bob_forward, \\
    f"Bob forwards {bob_forward} msat to Carol, got {result[0]['amt_to_forward_msat']}"
assert result[0]['outgoing_cltv_value'] == 700_048, \\
    f"Bob's outgoing CLTV should be 700,048, got {result[0]['outgoing_cltv_value']}"
assert result[0]['fee_msat'] == bob_fee, \\
    f"Bob's fee should be {bob_fee}, got {result[0]['fee_msat']}"

# Verify short_channel_ids
assert result[0]['short_channel_id'] == '700000x1x0', \\
    f"Bob's channel should be '700000x1x0', got {result[0]['short_channel_id']}"
assert result[1]['short_channel_id'] == '700000x2x0', \\
    f"Carol's channel should be '700000x2x0', got {result[1]['short_channel_id']}"
assert result[2]['short_channel_id'] == '', \\
    f"Dave's channel should be empty, got {result[2]['short_channel_id']}"

# Verify total: Alice sends bob_forward + bob_fee = 50,009,000 msat
total_sent = bob_forward + bob_fee
assert total_sent == 50_009_000, f"Total Alice sends should be 50,009,000, got {total_sent}"

print("All tests passed! Route calculation is correct.")
print(f"  Alice sends:   {total_sent:>12,} msat (CLTV 700,088)")
print(f"  Bob forwards:  {bob_forward:>12,} msat (CLTV 700,048) [fee: {bob_fee:,} msat]")
print(f"  Carol forwards:{50_000_000:>12,} msat (CLTV 700,018) [fee: {carol_fee:,} msat]")
print(f"  Dave receives: {50_000_000:>12,} msat (CLTV 700,018)")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Calculate the forwarding amount and CLTV for each hop, working backward from the final destination.<br><br>' +
        '<strong>Key insight</strong>: Each hop\'s fee depends on the amount it forwards. The final hop receives the payment amount with no fee, so we start there and work backward.<br><br>' +
        '<strong>Fee formula</strong>: <code>fee = fee_base_msat + floor(amount_forwarded * fee_proportional_millionths / 1,000,000)</code><br><br>' +
        '<strong>CLTV formula</strong>: Each intermediate hop adds the <em>next</em> hop\'s <code>cltv_expiry_delta</code> on top of the downstream CLTV value. ' +
        'The final hop\'s CLTV is simply <code>current_block_height + min_final_cltv_expiry_delta</code>.',
      steps:
        '<strong>Step 1</strong>: Start with the last hop (final destination). Its <code>amt_to_forward_msat</code> is the <code>payment_amount_msat</code>. ' +
        'Its <code>outgoing_cltv_value</code> is <code>current_block_height + min_final_cltv_expiry_delta</code>. Its fee is 0.<br><br>' +
        '<strong>Step 2</strong>: Work backward through each remaining hop (from second-to-last to first). For hop at index <code>i</code>:<br>' +
        '- <code>amt_to_forward_msat</code> = the next hop\'s <code>amt_to_forward_msat</code> + the next hop\'s <code>fee_msat</code><br>' +
        '- <code>fee_msat</code> = <code>hops[i].fee_base_msat + floor(amt_to_forward * hops[i].fee_proportional_millionths / 1,000,000)</code><br>' +
        '- <code>outgoing_cltv_value</code> = the next hop\'s <code>outgoing_cltv_value</code> + <code>hops[i+1].cltv_expiry_delta</code><br><br>' +
        '<strong>Why amt includes next hop\'s fee</strong>: Hop <code>i</code> must forward enough to cover what the next hop forwards <em>plus</em> the next hop\'s fee. ' +
        'The fee hop <code>i</code> earns is then computed on this total forwarded amount.',
      code: `def calculate_route(payment_amount_msat, min_final_cltv_expiry_delta, current_block_height, hops):
    n = len(hops)
    result = [None] * n

    # Final hop: receives the payment, no fee
    result[n - 1] = {
        'amt_to_forward_msat': payment_amount_msat,
        'outgoing_cltv_value': current_block_height + min_final_cltv_expiry_delta,
        'short_channel_id': '',
        'fee_msat': 0,
    }

    # Work backward from second-to-last hop
    for i in range(n - 2, -1, -1):
        next_result = result[i + 1]
        # This hop must forward enough to cover the next hop's forward + fee
        amt_to_forward = next_result['amt_to_forward_msat'] + next_result['fee_msat']
        # Fee this hop earns, based on the amount it forwards
        fee = hops[i]['fee_base_msat'] + (amt_to_forward * hops[i]['fee_proportional_millionths'] // 1_000_000)
        # Outgoing CLTV: next hop's CLTV + the next hop's required delta
        outgoing_cltv = next_result['outgoing_cltv_value'] + hops[i + 1]['cltv_expiry_delta']

        result[i] = {
            'amt_to_forward_msat': amt_to_forward,
            'outgoing_cltv_value': outgoing_cltv,
            'short_channel_id': hops[i]['short_channel_id'],
            'fee_msat': fee,
        }

    return result`,
    },
    rewardSats: 21,
    group: "routing/utils",
    groupOrder: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 2 — Build TLV Hop Payload
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-build-tlv-payload": {
    id: "exercise-build-tlv-payload",
    title: "Exercise 2: Build a TLV Hop Payload",
    description:
      "Implement three functions that encode routing data into the binary TLV (Type-Length-Value) format used in BOLT 4 onion packets. " +
      "Each hop in an onion route receives a TLV-encoded payload telling it how much to forward, what CLTV to set, and (for intermediate hops) which channel to use. " +
      "You will implement <code>encode_bigsize</code> (BOLT variable-length integers), <code>encode_tu64</code> (truncated uint64), and <code>build_hop_payload</code> (the complete TLV payload).",
    starterCode: `import struct

def encode_bigsize(value: int) -> bytes:
    """Encode an integer as a BOLT bigsize value.

    Values < 0xfd (253):      1 byte
    Values <= 0xffff:          0xfd prefix + 2 bytes big-endian
    Values <= 0xffffffff:      0xfe prefix + 4 bytes big-endian
    Values > 0xffffffff:       0xff prefix + 8 bytes big-endian
    """
    # TODO: Implement bigsize encoding
    pass

def encode_tu64(value: int) -> bytes:
    """Encode an integer as a truncated uint64 (minimal big-endian, no leading zeros).

    The value 0 encodes as an empty byte string (zero length).
    """
    # TODO: Implement truncated uint64 encoding
    pass

def build_hop_payload(
    amt_to_forward_msat: int,
    outgoing_cltv_value: int,
    short_channel_id: str = ""
) -> bytes:
    """
    Build a TLV-encoded hop payload for an intermediate or final hop.

    TLV fields to include (in order):
      - Type 2: amt_to_forward (truncated uint64)
      - Type 4: outgoing_cltv_value (truncated uint64)
      - Type 6: short_channel_id (8 bytes) -- only for intermediate hops

    Each TLV record is: encode_bigsize(type) + encode_bigsize(length) + value
    The full payload is: encode_bigsize(total_tlv_length) + all_tlv_records

    Args:
        amt_to_forward_msat: Amount to forward in millisatoshis
        outgoing_cltv_value: Outgoing CLTV expiry value
        short_channel_id: Channel ID string like "700000x2x0" (empty for final hop)

    Returns:
        The complete encoded hop payload (length prefix + TLV records)
    """
    # TODO: Build the TLV payload
    pass
`,
    testCode: `
# ── Test bigsize encoding ──
assert encode_bigsize(0) == b'\\x00', f"bigsize(0) failed: {encode_bigsize(0).hex()}"
assert encode_bigsize(252) == b'\\xfc', f"bigsize(252) failed: {encode_bigsize(252).hex()}"
assert encode_bigsize(253) == b'\\xfd\\x00\\xfd', f"bigsize(253) failed: {encode_bigsize(253).hex()}"
assert encode_bigsize(65535) == b'\\xfd\\xff\\xff', f"bigsize(65535) failed: {encode_bigsize(65535).hex()}"
assert encode_bigsize(65536) == b'\\xfe\\x00\\x01\\x00\\x00', f"bigsize(65536) failed: {encode_bigsize(65536).hex()}"

# ── Test truncated uint64 ──
assert encode_tu64(0) == b'', f"tu64(0) should be empty, got {encode_tu64(0).hex()}"
assert encode_tu64(1) == b'\\x01', f"tu64(1) failed: {encode_tu64(1).hex()}"
assert encode_tu64(256) == b'\\x01\\x00', f"tu64(256) failed: {encode_tu64(256).hex()}"
assert encode_tu64(50_000_000) == b'\\x02\\xfa\\xf0\\x80', f"tu64(50000000) failed: {encode_tu64(50_000_000).hex()}"

# ── Test intermediate hop payload (Bob's hop data) ──
payload_bob = build_hop_payload(
    amt_to_forward_msat=50_003_000,
    outgoing_cltv_value=700_048,
    short_channel_id="700000x2x0"
)
assert len(payload_bob) > 0, "Payload should not be empty"

# Parse: first byte is bigsize length prefix (payload < 253 bytes so 1-byte prefix)
length = payload_bob[0]
tlv_data = payload_bob[1:1 + length]
assert len(tlv_data) == length, f"TLV data length mismatch: expected {length}, got {len(tlv_data)}"

# Parse individual TLV records from Bob's payload
pos = 0
bob_fields = {}
while pos < len(tlv_data):
    t = tlv_data[pos]; pos += 1
    l = tlv_data[pos]; pos += 1
    v = tlv_data[pos:pos + l]; pos += l
    bob_fields[t] = v

assert 2 in bob_fields, "Missing type 2 (amt_to_forward)"
assert 4 in bob_fields, "Missing type 4 (outgoing_cltv_value)"
assert 6 in bob_fields, "Missing type 6 (short_channel_id) for intermediate hop"

# Verify type 2: amt_to_forward = 50,003,000
amt_bytes = bob_fields[2]
amt_val = int.from_bytes(amt_bytes, 'big')
assert amt_val == 50_003_000, f"amt_to_forward should be 50,003,000, got {amt_val}"

# Verify type 4: outgoing_cltv = 700,048
cltv_bytes = bob_fields[4]
cltv_val = int.from_bytes(cltv_bytes, 'big')
assert cltv_val == 700_048, f"outgoing_cltv should be 700,048, got {cltv_val}"

# Verify type 6: short_channel_id = 700000x2x0
scid_expected = ((700_000 << 40) | (2 << 16) | 0).to_bytes(8, 'big')
assert bob_fields[6] == scid_expected, f"short_channel_id mismatch: expected {scid_expected.hex()}, got {bob_fields[6].hex()}"

# ── Test final hop payload (Dave) — no short_channel_id ──
payload_dave = build_hop_payload(
    amt_to_forward_msat=50_000_000,
    outgoing_cltv_value=700_018,
    short_channel_id=""
)
assert len(payload_dave) > 0, "Final hop payload should not be empty"

dave_length = payload_dave[0]
dave_tlv = payload_dave[1:1 + dave_length]
pos = 0
dave_fields = {}
while pos < len(dave_tlv):
    t = dave_tlv[pos]; pos += 1
    l = dave_tlv[pos]; pos += 1
    v = dave_tlv[pos:pos + l]; pos += l
    dave_fields[t] = v

assert 6 not in dave_fields, "Final hop should NOT contain type 6 (short_channel_id)"
assert 2 in dave_fields, "Final hop should contain type 2 (amt_to_forward)"
assert 4 in dave_fields, "Final hop should contain type 4 (outgoing_cltv_value)"

# Verify Dave's values
dave_amt = int.from_bytes(dave_fields[2], 'big')
assert dave_amt == 50_000_000, f"Dave's amt_to_forward should be 50,000,000, got {dave_amt}"
dave_cltv = int.from_bytes(dave_fields[4], 'big')
assert dave_cltv == 700_018, f"Dave's outgoing_cltv should be 700,018, got {dave_cltv}"

print("All TLV encoding tests passed!")
print(f"  Bob's payload:  {payload_bob.hex()} ({len(payload_bob)} bytes)")
print(f"  Dave's payload: {payload_dave.hex()} ({len(payload_dave)} bytes)")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Encode routing data into a binary TLV (Type-Length-Value) format that each hop can parse from its onion payload.<br><br>' +
        '<strong>bigsize</strong>: A variable-length integer encoding used throughout the Lightning spec. Small values (< 253) use 1 byte. ' +
        'Larger values use a prefix byte (<code>0xfd</code>, <code>0xfe</code>, or <code>0xff</code>) followed by 2, 4, or 8 bytes in big-endian order.<br><br>' +
        '<strong>Truncated uint64</strong>: The minimal big-endian representation with leading zero bytes removed. The value 0 encodes as an empty byte string (zero length).<br><br>' +
        '<strong>TLV record</strong>: Each record is <code>bigsize(type) + bigsize(length) + value_bytes</code>.<br>' +
        '<strong>Payload</strong>: <code>bigsize(total_TLV_length) + all_TLV_records_concatenated</code>.',
      steps:
        '<strong>encode_bigsize</strong>: Check the value range and encode accordingly:<br>' +
        '- If value < 253: pack as a single byte with <code>struct.pack("B", value)</code><br>' +
        '- If value <= 0xffff: <code>b\'\\xfd\' + struct.pack(\'>H\', value)</code><br>' +
        '- If value <= 0xffffffff: <code>b\'\\xfe\' + struct.pack(\'>I\', value)</code><br>' +
        '- Otherwise: <code>b\'\\xff\' + struct.pack(\'>Q\', value)</code><br><br>' +
        '<strong>encode_tu64</strong>: Convert to big-endian 8 bytes with <code>value.to_bytes(8, \'big\')</code>, then strip leading zero bytes with <code>.lstrip(b\'\\x00\')</code>. ' +
        'Handle the special case: if value is 0, return <code>b\'\'</code> (empty bytes).<br><br>' +
        '<strong>build_hop_payload</strong>:<br>' +
        '1. Build each TLV record: <code>encode_bigsize(type) + encode_bigsize(len(value)) + value</code><br>' +
        '2. Type 2 value = <code>encode_tu64(amt_to_forward_msat)</code><br>' +
        '3. Type 4 value = <code>encode_tu64(outgoing_cltv_value)</code><br>' +
        '4. Type 6 (only if <code>short_channel_id</code> is not empty): parse the "BxTxO" string, encode as 8 bytes using <code>(block << 40) | (tx << 16) | output</code><br>' +
        '5. Concatenate all records, then prepend <code>encode_bigsize(total_length)</code>.',
      code: `import struct

def encode_bigsize(value):
    if value < 0xfd:
        return struct.pack('B', value)
    elif value <= 0xffff:
        return b'\\xfd' + struct.pack('>H', value)
    elif value <= 0xffffffff:
        return b'\\xfe' + struct.pack('>I', value)
    else:
        return b'\\xff' + struct.pack('>Q', value)

def encode_tu64(value):
    if value == 0:
        return b''
    return value.to_bytes(8, 'big').lstrip(b'\\x00')

def build_hop_payload(amt_to_forward_msat, outgoing_cltv_value, short_channel_id=""):
    tlv_records = b''

    # Type 2: amt_to_forward
    amt_bytes = encode_tu64(amt_to_forward_msat)
    tlv_records += encode_bigsize(2) + encode_bigsize(len(amt_bytes)) + amt_bytes

    # Type 4: outgoing_cltv_value
    cltv_bytes = encode_tu64(outgoing_cltv_value)
    tlv_records += encode_bigsize(4) + encode_bigsize(len(cltv_bytes)) + cltv_bytes

    # Type 6: short_channel_id (intermediate hops only)
    if short_channel_id:
        parts = short_channel_id.split('x')
        block, txindex, output = int(parts[0]), int(parts[1]), int(parts[2])
        scid_int = (block << 40) | (txindex << 16) | output
        scid_bytes = scid_int.to_bytes(8, 'big')
        tlv_records += encode_bigsize(6) + encode_bigsize(8) + scid_bytes

    # Prepend total length
    return encode_bigsize(len(tlv_records)) + tlv_records`,
    },
    rewardSats: 21,
    group: "routing/utils",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 3 — Compute ECDH Shared Secret
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-sphinx-init-shared-secrets": {
    id: "exercise-sphinx-init-shared-secrets",
    title: "Exercise 3: Compute Shared Secrets",
    description:
      "Begin building the <code>SphinxPacketBuilder</code> class by implementing ECDH shared secret computation. " +
      "Given a private key and a public key, perform elliptic curve Diffie-Hellman to produce a 32-byte shared secret. " +
      "This is the foundation of Sphinx's layered encryption: Alice computes a shared secret with each hop so she can derive encryption keys.",
    starterCode: `class SphinxPacketBuilder:
    def __init__(self, session_key_hex: str, route_pubkeys_hex: list[str]):
        """
        Initialize the Sphinx packet builder.

        Args:
            session_key_hex: 32-byte hex private key (Alice's ephemeral session key)
            route_pubkeys_hex: List of 33-byte compressed public keys (one per hop)
        """
        self.session_key = bytes.fromhex(session_key_hex)
        self.route_pubkeys = [bytes.fromhex(pk) for pk in route_pubkeys_hex]
        self.num_hops = len(route_pubkeys_hex)

    @staticmethod
    def compute_shared_secret(private_key_bytes: bytes, public_key_bytes: bytes) -> bytes:
        """
        Compute an ECDH shared secret between a private key and a public key.

        Steps:
        1. Create a SigningKey from the private key bytes
        2. Create a VerifyingKey from the public key bytes (compressed format)
        3. Multiply: ecdh_point = public_key_point * private_key_scalar
        4. Hash the x-coordinate: SHA256(x as 32 bytes big-endian)

        Args:
            private_key_bytes: 32-byte private key
            public_key_bytes: 33-byte compressed public key

        Returns:
            32-byte shared secret
        """
        # TODO: Implement ECDH shared secret computation
        pass
`,
    testCode: `
from ecdsa import SECP256k1, SigningKey, VerifyingKey
import hashlib

# Use the canonical node identities
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]

builder = SphinxPacketBuilder(session_key_hex, route)

# Test 1: compute_shared_secret returns 32 bytes
ss_bob = builder.compute_shared_secret(builder.session_key, builder.route_pubkeys[0])
assert isinstance(ss_bob, bytes), f"Expected bytes, got {type(ss_bob)}"
assert len(ss_bob) == 32, f"Expected 32 bytes, got {len(ss_bob)}"

# Test 2: Verify ECDH correctness — Bob should derive the same shared secret
# using his private key and Alice's session public key
bob_privkey_hex = "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"
session_pubkey_hex = "02b53fafe4de8761038ee61ef641dd76cb390c495a0bf87fa684adc7e0e96c4348"

bob_ss = SphinxPacketBuilder.compute_shared_secret(
    bytes.fromhex(bob_privkey_hex),
    bytes.fromhex(session_pubkey_hex)
)
assert ss_bob == bob_ss, (
    f"ECDH mismatch! Alice's shared secret with Bob should equal Bob's shared secret with Alice.\\n"
    f"  Alice computed: {ss_bob.hex()[:32]}...\\n"
    f"  Bob computed:   {bob_ss.hex()[:32]}..."
)

# Test 3: Different hops produce different shared secrets
ss_carol = builder.compute_shared_secret(builder.session_key, builder.route_pubkeys[1])
ss_dave = builder.compute_shared_secret(builder.session_key, builder.route_pubkeys[2])
assert ss_bob != ss_carol, "Bob and Carol should have different shared secrets"
assert ss_carol != ss_dave, "Carol and Dave should have different shared secrets"
assert ss_bob != ss_dave, "Bob and Dave should have different shared secrets"

# Test 4: Deterministic — same inputs produce same output
ss_bob_again = builder.compute_shared_secret(builder.session_key, builder.route_pubkeys[0])
assert ss_bob == ss_bob_again, "Shared secret computation should be deterministic"

print("All shared secret tests passed!")
print(f"  Alice-Bob shared secret:   {ss_bob.hex()[:32]}...")
print(f"  Alice-Carol shared secret: {ss_carol.hex()[:32]}...")
print(f"  Alice-Dave shared secret:  {ss_dave.hex()[:32]}...")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Perform ECDH between a private key and a public key to produce a 32-byte shared secret.<br><br>' +
        '<strong>ECDH</strong>: Multiply the other party\'s public key point by your private key scalar. This gives a shared point on the curve that only the two parties can compute.<br><br>' +
        '<strong>Key insight</strong>: The shared secret is <code>SHA256(ecdh_point.x)</code>, where <code>x</code> is the x-coordinate of the resulting curve point, encoded as 32 bytes big-endian.',
      steps:
        '<strong>Step 1</strong>: Create a <code>SigningKey</code> from the private key bytes using <code>SigningKey.from_string(private_key_bytes, curve=SECP256k1)</code>.<br><br>' +
        '<strong>Step 2</strong>: Create a <code>VerifyingKey</code> from the compressed public key bytes using <code>VerifyingKey.from_string(public_key_bytes, curve=SECP256k1)</code>.<br><br>' +
        '<strong>Step 3</strong>: Perform the ECDH multiplication. Access the curve point via <code>vk.pubkey.point</code> and the scalar via <code>sk.privkey.secret_multiplier</code>. Multiply: <code>ecdh_point = vk.pubkey.point * sk.privkey.secret_multiplier</code>.<br><br>' +
        '<strong>Step 4</strong>: Extract the x-coordinate with <code>ecdh_point.x()</code>, convert to 32 bytes big-endian, and hash with SHA256.',
      code: `class SphinxPacketBuilder:
    def __init__(self, session_key_hex: str, route_pubkeys_hex: list[str]):
        self.session_key = bytes.fromhex(session_key_hex)
        self.route_pubkeys = [bytes.fromhex(pk) for pk in route_pubkeys_hex]
        self.num_hops = len(route_pubkeys_hex)

    @staticmethod
    def compute_shared_secret(private_key_bytes: bytes, public_key_bytes: bytes) -> bytes:
        sk = SigningKey.from_string(private_key_bytes, curve=SECP256k1)
        vk = VerifyingKey.from_string(public_key_bytes, curve=SECP256k1)
        # ECDH: multiply their public key by our private scalar
        ecdh_point = vk.pubkey.point * sk.privkey.secret_multiplier
        # Hash the x-coordinate to get the shared secret
        x_bytes = ecdh_point.x().to_bytes(32, 'big')
        return hashlib.sha256(x_bytes).digest()`,
    },
    rewardSats: 21,
    group: "sphinx/builder",
    groupOrder: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 4 — Derive Per-Hop Keys
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-derive-hop-keys": {
    id: "exercise-derive-hop-keys",
    title: "Exercise 4: Derive Per-Hop Keys",
    description:
      "Add key derivation to the <code>SphinxPacketBuilder</code>. From each shared secret, derive 5 purpose-specific keys " +
      "using HMAC-SHA256. Each key is bound to a specific role: <code>rho</code> (encryption stream), <code>mu</code> (outgoing HMAC), " +
      "<code>um</code> (error HMAC), <code>pad</code> (filler generation), and <code>ammag</code> (error encryption).",
    starterCode: `def derive_hop_keys(self, shared_secret: bytes) -> dict:
    """
    Derive the 5 per-hop routing keys from a shared secret.

    Each key is computed as:
        key = HMAC-SHA256(key=key_type_bytes, msg=shared_secret)

    The 5 key types are:
        - b"rho"   -> encryption stream key
        - b"mu"    -> outgoing HMAC key
        - b"um"    -> error HMAC key (\"mu\" backward)
        - b"pad"   -> filler generation key
        - b"ammag" -> error encryption key (\"gamma\" backward)

    Args:
        shared_secret: 32-byte shared secret from ECDH

    Returns:
        Dict with keys 'rho', 'mu', 'um', 'pad', 'ammag',
        each mapping to a 32-byte key
    """
    # TODO: Implement HMAC-SHA256 key derivation for each key type
    pass
`,
    testCode: `
import hashlib
import hmac

# Use the canonical values
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"

route = [bob_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

# First compute a shared secret to derive keys from
ss = builder.compute_shared_secret(builder.session_key, builder.route_pubkeys[0])

# Now derive keys
keys = builder.derive_hop_keys(ss)

# Test 1: All 5 keys are present
expected_names = ['rho', 'mu', 'um', 'pad', 'ammag']
for name in expected_names:
    assert name in keys, f"Missing key: '{name}'"

# Test 2: Each key is 32 bytes
for name in expected_names:
    assert isinstance(keys[name], bytes), f"Key '{name}' should be bytes, got {type(keys[name])}"
    assert len(keys[name]) == 32, f"Key '{name}' should be 32 bytes, got {len(keys[name])}"

# Test 3: All keys are unique (domain separation)
key_values = [keys[name].hex() for name in expected_names]
assert len(set(key_values)) == 5, "All 5 keys should be unique (domain separation)"

# Test 4: Verify against known HMAC computation
expected_rho = hmac.new(b"rho", ss, hashlib.sha256).digest()
assert keys['rho'] == expected_rho, (
    f"rho key mismatch!\\n"
    f"  Expected: {expected_rho.hex()[:32]}...\\n"
    f"  Got:      {keys['rho'].hex()[:32]}..."
)

expected_mu = hmac.new(b"mu", ss, hashlib.sha256).digest()
assert keys['mu'] == expected_mu, f"mu key mismatch"

expected_um = hmac.new(b"um", ss, hashlib.sha256).digest()
assert keys['um'] == expected_um, f"um key mismatch"

expected_pad = hmac.new(b"pad", ss, hashlib.sha256).digest()
assert keys['pad'] == expected_pad, f"pad key mismatch"

expected_ammag = hmac.new(b"ammag", ss, hashlib.sha256).digest()
assert keys['ammag'] == expected_ammag, f"ammag key mismatch"

# Test 5: Different shared secrets produce different keys
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
ss_carol = builder.compute_shared_secret(builder.session_key, bytes.fromhex(carol_pubkey_hex))
keys_carol = builder.derive_hop_keys(ss_carol)
assert keys['rho'] != keys_carol['rho'], "Different shared secrets should produce different rho keys"

print("All key derivation tests passed!")
for name in expected_names:
    print(f"  {name:>5}: {keys[name].hex()[:32]}...")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Derive 5 purpose-specific keys from a shared secret using HMAC-SHA256.<br><br>' +
        '<strong>Key derivation formula</strong>: <code>key = HMAC-SHA256(key=key_type_bytes, msg=shared_secret)</code><br><br>' +
        '<strong>Why HMAC?</strong>: HMAC is a standard construction for deriving keys from secrets. The key type string acts as a "domain separator" that ensures each derived key is cryptographically independent, even though they all come from the same shared secret.',
      steps:
        '<strong>Step 1</strong>: Import <code>hmac</code> and <code>hashlib</code> (already available in the preamble).<br><br>' +
        '<strong>Step 2</strong>: Define the 5 key type strings as bytes: <code>b"rho"</code>, <code>b"mu"</code>, <code>b"um"</code>, <code>b"pad"</code>, <code>b"ammag"</code>.<br><br>' +
        '<strong>Step 3</strong>: For each key type, compute <code>hmac.new(key_type_bytes, shared_secret, hashlib.sha256).digest()</code>.<br><br>' +
        '<strong>Step 4</strong>: Return a dictionary mapping each key name (as a string) to its 32-byte derived value.',
      code: `def derive_hop_keys(self, shared_secret: bytes) -> dict:
    key_types = [b"rho", b"mu", b"um", b"pad", b"ammag"]
    keys = {}
    for kt in key_types:
        keys[kt.decode()] = hmac.new(kt, shared_secret, hashlib.sha256).digest()
    return keys`,
    },
    rewardSats: 21,
    group: "sphinx/builder",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 5 — Ephemeral Key Chain (Session Key Blinding)
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-ephemeral-key-chain": {
    id: "exercise-ephemeral-key-chain",
    title: "Exercise 5: Derive the Ephemeral Key Chain",
    description:
      "Implement session key blinding in the <code>SphinxPacketBuilder</code>. Starting from the original session key, " +
      "compute the shared secret with each hop, then blind the session key before moving to the next hop. " +
      "This produces a chain of ephemeral public keys and shared secrets, one per hop, all derived from a single session key.",
    starterCode: `def compute_blinding_factor(self, ephemeral_pubkey: bytes, shared_secret: bytes) -> int:
    """
    Compute the blinding factor for session key re-randomization.

    blinding_factor = SHA256(ephemeral_pubkey || shared_secret)

    Args:
        ephemeral_pubkey: 33-byte compressed public key (current ephemeral key)
        shared_secret: 32-byte shared secret with the current hop

    Returns:
        The blinding factor as an integer (for scalar multiplication)
    """
    # TODO: Implement blinding factor computation
    pass

def compute_ephemeral_keys_and_secrets(self) -> tuple[list[bytes], list[bytes]]:
    """
    Compute the full chain of ephemeral public keys and shared secrets.

    Starting from the session key, for each hop:
    1. Get the current ephemeral public key (compressed, 33 bytes)
    2. Compute shared secret: ECDH(current_session_privkey, hop_pubkey)
    3. Compute blinding factor from ephemeral pubkey and shared secret
    4. Derive next session private key: current_privkey * blinding_factor (mod n)

    Store results on the instance:
        self.ephemeral_pubkeys: list of 33-byte compressed public keys
        self.shared_secrets: list of 32-byte shared secrets
        self.hop_keys: list of dicts from derive_hop_keys()

    Returns:
        (ephemeral_pubkeys, shared_secrets)
    """
    # TODO: Implement the full ephemeral key chain
    pass
`,
    testCode: `
from ecdsa import SECP256k1, SigningKey, VerifyingKey
from ecdsa.ellipticcurve import INFINITY
import hashlib

# Use the canonical values
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

eph_pubkeys, shared_secrets = builder.compute_ephemeral_keys_and_secrets()

# Test 1: Correct number of results
assert len(eph_pubkeys) == 3, f"Expected 3 ephemeral pubkeys, got {len(eph_pubkeys)}"
assert len(shared_secrets) == 3, f"Expected 3 shared secrets, got {len(shared_secrets)}"

# Test 2: First ephemeral pubkey is the original session public key
session_sk = SigningKey.from_string(bytes.fromhex(session_key_hex), curve=SECP256k1)
expected_first_pubkey = session_sk.get_verifying_key().to_string("compressed")
assert eph_pubkeys[0] == expected_first_pubkey, (
    f"First ephemeral pubkey should be the session public key\\n"
    f"  Expected: {expected_first_pubkey.hex()[:32]}...\\n"
    f"  Got:      {eph_pubkeys[0].hex()[:32]}..."
)

# Test 3: All ephemeral pubkeys are 33 bytes (compressed) and unique
assert all(len(pk) == 33 for pk in eph_pubkeys), "All ephemeral pubkeys should be 33 bytes"
assert len(set(pk.hex() for pk in eph_pubkeys)) == 3, "All ephemeral pubkeys should be unique"

# Test 4: All shared secrets are 32 bytes and unique
assert all(len(ss) == 32 for ss in shared_secrets), "All shared secrets should be 32 bytes"
assert len(set(ss.hex() for ss in shared_secrets)) == 3, "All shared secrets should be unique"

# Test 5: Bob can derive the same shared secret using his private key
bob_privkey_hex = "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"
bob_ss = SphinxPacketBuilder.compute_shared_secret(
    bytes.fromhex(bob_privkey_hex), eph_pubkeys[0]
)
assert shared_secrets[0] == bob_ss, (
    f"Bob's shared secret should match Alice's!\\n"
    f"  Alice: {shared_secrets[0].hex()[:32]}...\\n"
    f"  Bob:   {bob_ss.hex()[:32]}..."
)

# Test 6: Bob can compute the next ephemeral pubkey for Carol
bf_bob = hashlib.sha256(eph_pubkeys[0] + shared_secrets[0]).digest()
bf_bob_int = int.from_bytes(bf_bob, 'big')
bob_eph_vk = VerifyingKey.from_string(eph_pubkeys[0], curve=SECP256k1)
next_point = bob_eph_vk.pubkey.point * bf_bob_int
# Compress the point
x = next_point.x()
y = next_point.y()
prefix = b'\\x02' if y % 2 == 0 else b'\\x03'
bob_computed_carol_eph = prefix + x.to_bytes(32, 'big')
assert eph_pubkeys[1] == bob_computed_carol_eph, (
    f"Bob should be able to derive Carol's ephemeral pubkey\\n"
    f"  Expected: {eph_pubkeys[1].hex()[:32]}...\\n"
    f"  Got:      {bob_computed_carol_eph.hex()[:32]}..."
)

# Test 7: Carol can derive the same shared secret using her private key
carol_privkey_hex = "caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50"
carol_ss = SphinxPacketBuilder.compute_shared_secret(
    bytes.fromhex(carol_privkey_hex), eph_pubkeys[1]
)
assert shared_secrets[1] == carol_ss, (
    f"Carol's shared secret should match Alice's!\\n"
    f"  Alice: {shared_secrets[1].hex()[:32]}...\\n"
    f"  Carol: {carol_ss.hex()[:32]}..."
)

# Test 8: Instance attributes are populated
assert builder.shared_secrets == shared_secrets, "shared_secrets should be stored on instance"
assert builder.ephemeral_pubkeys == eph_pubkeys, "ephemeral_pubkeys should be stored on instance"
assert len(builder.hop_keys) == 3, "hop_keys should be derived for all 3 hops"
assert all('rho' in hk and 'mu' in hk for hk in builder.hop_keys), "Each hop_keys entry should contain rho and mu"

print("All ephemeral key chain tests passed!")
for i, name in enumerate(["Bob", "Carol", "Dave"]):
    print(f"  {name}:")
    print(f"    ephemeral pubkey: {eph_pubkeys[i].hex()[:32]}...")
    print(f"    shared secret:    {shared_secrets[i].hex()[:32]}...")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Build the chain of ephemeral keys and shared secrets that Alice needs for onion packet construction.<br><br>' +
        '<strong>Blinding factor</strong>: <code>SHA256(ephemeral_pubkey || shared_secret)</code>, interpreted as an integer for scalar multiplication.<br><br>' +
        '<strong>Key chain</strong>: At each hop, the session private key is multiplied by the blinding factor (mod curve order), producing a new private key for the next hop. The corresponding public key is what the next hop sees in the onion header.<br><br>' +
        '<strong>Why it works</strong>: Each hop can compute the blinding factor (they know the ephemeral pubkey and can derive the shared secret), so they can advance the public key without knowing the private key.',
      steps:
        '<strong>compute_blinding_factor</strong>:<br>' +
        '1. Concatenate <code>ephemeral_pubkey + shared_secret</code><br>' +
        '2. Hash with SHA256: <code>hashlib.sha256(concatenated).digest()</code><br>' +
        '3. Convert to integer: <code>int.from_bytes(hash_bytes, \'big\')</code><br><br>' +
        '<strong>compute_ephemeral_keys_and_secrets</strong>:<br>' +
        '1. Start with the original session private key as a <code>SigningKey</code><br>' +
        '2. For each hop, get the compressed ephemeral public key via <code>sk.get_verifying_key().to_string("compressed")</code><br>' +
        '3. Compute the shared secret with <code>compute_shared_secret(current_privkey_bytes, hop_pubkey)</code><br>' +
        '4. Derive hop keys with <code>derive_hop_keys(shared_secret)</code><br>' +
        '5. Compute the blinding factor and derive the next private key: <code>next_privkey_int = (current_privkey_int * blinding_factor) % SECP256k1.order</code><br>' +
        '6. Create a new <code>SigningKey</code> from the blinded integer for the next iteration',
      code: `def compute_blinding_factor(self, ephemeral_pubkey: bytes, shared_secret: bytes) -> int:
    bf_hash = hashlib.sha256(ephemeral_pubkey + shared_secret).digest()
    return int.from_bytes(bf_hash, 'big')

def compute_ephemeral_keys_and_secrets(self):
    ephemeral_pubkeys = []
    shared_secrets = []
    hop_keys = []

    current_sk = SigningKey.from_string(self.session_key, curve=SECP256k1)

    for i in range(self.num_hops):
        # Get current ephemeral public key (compressed)
        eph_pubkey = current_sk.get_verifying_key().to_string("compressed")
        ephemeral_pubkeys.append(eph_pubkey)

        # Compute shared secret with this hop
        current_privkey_bytes = current_sk.to_string()
        ss = self.compute_shared_secret(current_privkey_bytes, self.route_pubkeys[i])
        shared_secrets.append(ss)

        # Derive per-hop keys
        hop_keys.append(self.derive_hop_keys(ss))

        # Compute blinding factor and derive next session key
        if i < self.num_hops - 1:
            bf = self.compute_blinding_factor(eph_pubkey, ss)
            current_int = current_sk.privkey.secret_multiplier
            next_int = (current_int * bf) % SECP256k1.order
            current_sk = SigningKey.from_secret_exponent(next_int, curve=SECP256k1)

    self.ephemeral_pubkeys = ephemeral_pubkeys
    self.shared_secrets = shared_secrets
    self.hop_keys = hop_keys
    return (ephemeral_pubkeys, shared_secrets)`,
    },
    rewardSats: 21,
    group: "sphinx/builder",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 6 — Build Hop Payloads
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-build-hop-payload": {
    id: "exercise-build-hop-payload",
    title: "Exercise 6: Build Hop Payloads",
    description:
      "Add a <code>build_hop_payloads</code> method to <code>SphinxPacketBuilder</code> that takes a list of hop data dictionaries " +
      "and returns a list of TLV-encoded hop payloads (one per hop). Each payload uses the same encoding format from Exercise 2: " +
      "a bigsize length prefix followed by TLV records for amt_to_forward (type 2), outgoing_cltv_value (type 4), and short_channel_id (type 6, intermediate hops only). " +
      "The helper functions <code>encode_bigsize</code> and <code>encode_tu64</code> are available in the provided code.",
    starterCode: `def build_hop_payloads(self, hops_data: list[dict]) -> list[bytes]:
    """
    Build TLV-encoded payloads for each hop in the route.

    Each hop dict contains:
        - 'amt_to_forward_msat': Amount to forward (int)
        - 'outgoing_cltv_value': Outgoing CLTV expiry (int)
        - 'short_channel_id': Channel ID string like "700000x2x0"
                              (empty string for the final hop)

    Each payload is encoded as:
        bigsize(total_TLV_length) + TLV_records

    TLV records (in order):
        - Type 2: amt_to_forward (truncated uint64)
        - Type 4: outgoing_cltv_value (truncated uint64)
        - Type 6: short_channel_id (8 bytes, intermediate hops only)

    Args:
        hops_data: List of dicts, one per hop (first to last)

    Returns:
        List of encoded payload bytes (one per hop)
    """
    # TODO: Implement hop payload construction
    pass
`,
    testCode: `
# Canonical hop data: Alice -> Bob -> Carol -> Dave
hops_data = [
    {  # Bob (intermediate)
        'amt_to_forward_msat': 50_003_000,
        'outgoing_cltv_value': 700_048,
        'short_channel_id': '700000x2x0',
    },
    {  # Carol (intermediate)
        'amt_to_forward_msat': 50_000_000,
        'outgoing_cltv_value': 700_018,
        'short_channel_id': '700000x3x0',
    },
    {  # Dave (final hop)
        'amt_to_forward_msat': 50_000_000,
        'outgoing_cltv_value': 700_018,
        'short_channel_id': '',
    },
]

session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

payloads = builder.build_hop_payloads(hops_data)

# Test 1: Correct number of payloads
assert len(payloads) == 3, f"Expected 3 payloads, got {len(payloads)}"

# Test 2: Each payload is non-empty bytes
for i, p in enumerate(payloads):
    assert isinstance(p, bytes), f"Payload {i} should be bytes, got {type(p)}"
    assert len(p) > 0, f"Payload {i} should not be empty"

# Test 3: Parse Bob's payload (intermediate hop with short_channel_id)
bob_payload = payloads[0]
length = bob_payload[0]
tlv_data = bob_payload[1:1 + length]
assert len(tlv_data) == length, f"Bob TLV length mismatch: header says {length}, got {len(tlv_data)}"

pos = 0
bob_fields = {}
while pos < len(tlv_data):
    t = tlv_data[pos]; pos += 1
    l = tlv_data[pos]; pos += 1
    v = tlv_data[pos:pos + l]; pos += l
    bob_fields[t] = v

assert 2 in bob_fields, "Bob payload missing type 2 (amt_to_forward)"
assert 4 in bob_fields, "Bob payload missing type 4 (outgoing_cltv_value)"
assert 6 in bob_fields, "Bob payload missing type 6 (short_channel_id)"

bob_amt = int.from_bytes(bob_fields[2], 'big')
assert bob_amt == 50_003_000, f"Bob amt_to_forward should be 50,003,000, got {bob_amt}"

bob_cltv = int.from_bytes(bob_fields[4], 'big')
assert bob_cltv == 700_048, f"Bob outgoing_cltv should be 700,048, got {bob_cltv}"

scid_expected = ((700_000 << 40) | (2 << 16) | 0).to_bytes(8, 'big')
assert bob_fields[6] == scid_expected, f"Bob short_channel_id mismatch"

# Test 4: Parse Dave's payload (final hop, no short_channel_id)
dave_payload = payloads[2]
dave_length = dave_payload[0]
dave_tlv = dave_payload[1:1 + dave_length]

pos = 0
dave_fields = {}
while pos < len(dave_tlv):
    t = dave_tlv[pos]; pos += 1
    l = dave_tlv[pos]; pos += 1
    v = dave_tlv[pos:pos + l]; pos += l
    dave_fields[t] = v

assert 6 not in dave_fields, "Dave (final hop) should NOT have type 6 (short_channel_id)"
assert 2 in dave_fields, "Dave payload missing type 2"
assert 4 in dave_fields, "Dave payload missing type 4"

dave_amt = int.from_bytes(dave_fields[2], 'big')
assert dave_amt == 50_000_000, f"Dave amt should be 50,000,000, got {dave_amt}"

# Test 5: Intermediate payloads are larger than final hop (type 6 adds ~10 bytes)
assert len(payloads[0]) > len(payloads[2]), (
    f"Intermediate hop payload should be larger than final hop: "
    f"Bob={len(payloads[0])}, Dave={len(payloads[2])}"
)

print("All hop payload tests passed!")
for i, name in enumerate(["Bob", "Carol", "Dave"]):
    print(f"  {name}: {payloads[i].hex()} ({len(payloads[i])} bytes)")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Build a TLV-encoded payload for each hop, using the same encoding pattern from Exercise 2.<br><br>' +
        '<strong>Key insight</strong>: This is the same TLV format you already implemented. The difference is that now it\'s a method on SphinxPacketBuilder ' +
        'that processes all hops at once.<br><br>' +
        '<strong>Encoding pattern per hop</strong>: <code>bigsize(total_TLV_length) + TLV_records</code>, where each TLV record is ' +
        '<code>encode_bigsize(type) + encode_bigsize(value_length) + value_bytes</code>.',
      steps:
        '<strong>Step 1</strong>: Iterate over <code>hops_data</code>. For each hop, build the TLV records:<br>' +
        '- Type 2: <code>encode_bigsize(2) + encode_bigsize(len(amt_bytes)) + amt_bytes</code> where <code>amt_bytes = encode_tu64(amt_to_forward_msat)</code><br>' +
        '- Type 4: <code>encode_bigsize(4) + encode_bigsize(len(cltv_bytes)) + cltv_bytes</code> where <code>cltv_bytes = encode_tu64(outgoing_cltv_value)</code><br>' +
        '- Type 6 (if <code>short_channel_id</code> is not empty): Parse the "BxTxO" string, encode as 8 bytes using <code>(block << 40) | (tx << 16) | output</code><br><br>' +
        '<strong>Step 2</strong>: Concatenate all TLV records for this hop, then prepend <code>encode_bigsize(total_length)</code>.<br><br>' +
        '<strong>Step 3</strong>: Return the list of all encoded payloads.',
      code: `def build_hop_payloads(self, hops_data):
    payloads = []
    for hop in hops_data:
        tlv_records = b''
        # Type 2: amt_to_forward
        amt_bytes = encode_tu64(hop['amt_to_forward_msat'])
        tlv_records += encode_bigsize(2) + encode_bigsize(len(amt_bytes)) + amt_bytes
        # Type 4: outgoing_cltv_value
        cltv_bytes = encode_tu64(hop['outgoing_cltv_value'])
        tlv_records += encode_bigsize(4) + encode_bigsize(len(cltv_bytes)) + cltv_bytes
        # Type 6: short_channel_id (intermediate hops only)
        scid = hop.get('short_channel_id', '')
        if scid:
            parts = scid.split('x')
            block, txindex, output = int(parts[0]), int(parts[1]), int(parts[2])
            scid_int = (block << 40) | (txindex << 16) | output
            scid_bytes = scid_int.to_bytes(8, 'big')
            tlv_records += encode_bigsize(6) + encode_bigsize(8) + scid_bytes
        payloads.append(encode_bigsize(len(tlv_records)) + tlv_records)
    return payloads`,
    },
    rewardSats: 21,
    group: "sphinx/builder",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 7 — Generate the Filler
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-generate-filler": {
    id: "exercise-generate-filler",
    title: "Exercise 7: Generate the Filler",
    description:
      "Implement the <code>generate_filler</code> method on <code>SphinxPacketBuilder</code>. The filler compensates for bytes that are " +
      "lost when the payload buffer is shifted right during onion construction. It is computed by iterating through each hop " +
      "except the last, generating a cipher stream from the hop's rho key, and XOR-encrypting a growing block of filler bytes. " +
      "The helper function <code>generate_cipher_stream(key, length)</code> is available in the provided code.",
    starterCode: `def generate_filler(self, hop_payloads: list[bytes]) -> bytes:
    """
    Generate filler bytes for the onion packet construction.

    The filler compensates for data lost during rightward shifts.
    For each hop EXCEPT the last (innermost), the filler grows by
    the hop's "shift size" (len(payload) + 32 for the HMAC).

    Algorithm:
        filler = empty bytearray
        for each hop i from 0 to num_hops - 2:
            shift_size = len(hop_payloads[i]) + 32
            stream = generate_cipher_stream(rho_key[i], 1300)
            extend filler by shift_size zero bytes
            filler_start = 1300 - len(filler)
            XOR filler with stream[filler_start : filler_start + len(filler)]

    Args:
        hop_payloads: List of encoded hop payloads (one per hop)

    Returns:
        The filler bytes
    """
    # TODO: Implement filler generation
    pass
`,
    testCode: `
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

# Must compute keys first
builder.compute_ephemeral_keys_and_secrets()

# Build hop payloads
hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]
hop_payloads = builder.build_hop_payloads(hops_data)

# Generate filler
filler = builder.generate_filler(hop_payloads)

# Test 1: Filler is bytes
assert isinstance(filler, (bytes, bytearray)), f"Filler should be bytes, got {type(filler)}"

# Test 2: Filler length = sum of (payload_size + 32) for all hops EXCEPT the last
expected_len = sum(len(p) + 32 for p in hop_payloads[:-1])
assert len(filler) == expected_len, (
    f"Filler length should be {expected_len}, got {len(filler)}.\\n"
    f"  Hop payload sizes: {[len(p) for p in hop_payloads]}\\n"
    f"  Shift sizes (payload + 32 HMAC): {[len(p) + 32 for p in hop_payloads[:-1]]}"
)

# Test 3: Filler is not all zeros (it should be XOR'd with cipher streams)
assert filler != bytes(len(filler)), "Filler should not be all zeros after XOR with cipher streams"

# Test 4: Filler is deterministic
filler2 = builder.generate_filler(hop_payloads)
assert bytes(filler) == bytes(filler2), "Filler generation should be deterministic"

# Test 5: Verify filler computation step by step
# Manually compute expected filler using the same algorithm
manual_filler = bytearray()
for i in range(builder.num_hops - 1):
    shift_size = len(hop_payloads[i]) + 32
    stream = generate_cipher_stream(builder.hop_keys[i]['rho'], 1300)
    manual_filler.extend(b'\\x00' * shift_size)
    filler_start = 1300 - len(manual_filler)
    for j in range(len(manual_filler)):
        manual_filler[j] ^= stream[filler_start + j]

assert bytes(filler) == bytes(manual_filler), (
    f"Filler does not match expected computation.\\n"
    f"  Expected: {bytes(manual_filler).hex()[:64]}...\\n"
    f"  Got:      {bytes(filler).hex()[:64]}..."
)

print("All filler generation tests passed!")
print(f"  Filler length: {len(filler)} bytes")
print(f"  Filler (first 32 bytes): {bytes(filler)[:32].hex()}")
print(f"  Hop payload sizes: {[len(p) for p in hop_payloads]}")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Generate filler bytes that compensate for data lost during the rightward shifts in onion construction.<br><br>' +
        '<strong>Key insight</strong>: The filler simulates the XOR encryption that intermediate hops will apply. It grows with each hop (except the last), ' +
        'and each growth step is XOR\'d with the corresponding rho cipher stream at the position where the filler sits in the 1,300-byte buffer.<br><br>' +
        '<strong>Shift size</strong>: For each hop, the payload buffer shifts right by <code>len(payload) + 32</code> bytes (payload size + HMAC).',
      steps:
        '<strong>Step 1</strong>: Initialize an empty <code>bytearray</code> for the filler.<br><br>' +
        '<strong>Step 2</strong>: Loop from hop 0 to <code>num_hops - 2</code> (skip the last hop).<br><br>' +
        '<strong>Step 3</strong>: For each hop, compute <code>shift_size = len(hop_payloads[i]) + 32</code>.<br><br>' +
        '<strong>Step 4</strong>: Generate the cipher stream: <code>generate_cipher_stream(self.hop_keys[i][\'rho\'], 1300)</code>.<br><br>' +
        '<strong>Step 5</strong>: Extend the filler with <code>shift_size</code> zero bytes: <code>filler.extend(b\'\\x00\' * shift_size)</code>.<br><br>' +
        '<strong>Step 6</strong>: Compute the stream offset: <code>filler_start = 1300 - len(filler)</code>.<br><br>' +
        '<strong>Step 7</strong>: XOR each byte of the filler with the corresponding stream byte: ' +
        '<code>filler[j] ^= stream[filler_start + j]</code> for <code>j</code> in <code>range(len(filler))</code>.',
      code: `def generate_filler(self, hop_payloads):
    filler = bytearray()
    for i in range(self.num_hops - 1):
        shift_size = len(hop_payloads[i]) + 32
        stream = generate_cipher_stream(self.hop_keys[i]['rho'], 1300)
        filler.extend(b'\\x00' * shift_size)
        filler_start = 1300 - len(filler)
        for j in range(len(filler)):
            filler[j] ^= stream[filler_start + j]
    return bytes(filler)`,
    },
    rewardSats: 21,
    group: "sphinx/builder",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 8 — Construct the Onion Packet
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-wrap-construct-packet": {
    id: "exercise-wrap-construct-packet",
    title: "Exercise 8: Construct the Onion Packet",
    description:
      "Implement two methods on <code>SphinxPacketBuilder</code>: <code>wrap_layer</code> (wraps a single layer of the onion) and " +
      "<code>construct_packet</code> (orchestrates the full packet construction). This is the most complex exercise in the course. " +
      "The wrap_layer method shifts the payload right, inserts the hop data and HMAC, XOR-encrypts with the rho stream, " +
      "and computes a new HMAC. The construct_packet method builds all payloads, generates the filler, wraps layers from " +
      "innermost to outermost, and assembles the final 1,366-byte packet. " +
      "The helpers <code>generate_cipher_stream</code> and <code>xor_bytes</code> are available in the provided code.",
    starterCode: `def wrap_layer(
    self,
    payload_buffer: bytearray,
    hop_payload: bytes,
    current_hmac: bytes,
    rho_key: bytes,
    mu_key: bytes,
    assoc_data: bytes,
    filler: bytes = b"",
    is_innermost: bool = False,
) -> tuple[bytearray, bytes]:
    """
    Wrap a single layer of the onion.

    Steps:
    1. Shift payload_buffer right by (len(hop_payload) + 32) bytes
    2. Insert hop_payload + current_hmac at the front
    3. XOR the entire 1300-byte buffer with the rho cipher stream
    4. If this is the innermost hop, apply filler to trailing bytes
    5. Compute new HMAC = HMAC-SHA256(mu_key, buffer || assoc_data)

    Args:
        payload_buffer: The current 1300-byte payload buffer (modified in place)
        hop_payload: This hop's TLV-encoded payload
        current_hmac: 32-byte HMAC from the previous iteration
        rho_key: This hop's rho key (for cipher stream)
        mu_key: This hop's mu key (for HMAC)
        assoc_data: Associated data (payment hash) for HMAC
        filler: Pre-computed filler bytes (only used for innermost hop)
        is_innermost: True if this is the innermost (first) iteration

    Returns:
        (updated_payload_buffer, new_hmac)
    """
    # TODO: Implement single-layer wrapping
    pass

def construct_packet(self, hops_data: list[dict], assoc_data: bytes) -> bytes:
    """
    Construct the complete 1366-byte onion packet.

    Steps:
    1. Compute ephemeral keys and shared secrets (if not already done)
    2. Build hop payloads from hops_data
    3. Generate filler bytes
    4. Initialize 1300-byte zero buffer and 32-byte zero HMAC
    5. Wrap layers from innermost (last hop) to outermost (first hop)
    6. Assemble: version (0x00) + ephemeral_pubkeys[0] + payload + hmac

    Args:
        hops_data: List of dicts with amt_to_forward_msat,
                   outgoing_cltv_value, short_channel_id
        assoc_data: Associated data (payment hash) for HMAC binding

    Returns:
        The complete 1366-byte onion packet
    """
    # TODO: Implement full packet construction
    pass
`,
    testCode: `
import hashlib

session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

# Canonical hop data
hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]

# Use a canonical payment hash
payment_hash = hashlib.sha256(b"test_payment_preimage").digest()

packet = builder.construct_packet(hops_data, payment_hash)

# Test 1: Packet is exactly 1366 bytes
assert isinstance(packet, bytes), f"Packet should be bytes, got {type(packet)}"
assert len(packet) == 1366, f"Packet should be 1366 bytes, got {len(packet)}"

# Test 2: Version byte is 0x00
assert packet[0] == 0x00, f"Version byte should be 0x00, got {packet[0]:#04x}"

# Test 3: Ephemeral public key is the session public key
session_sk = SigningKey.from_string(bytes.fromhex(session_key_hex), curve=SECP256k1)
expected_pubkey = session_sk.get_verifying_key().to_string("compressed")
packet_pubkey = packet[1:34]
assert packet_pubkey == expected_pubkey, (
    f"Ephemeral pubkey mismatch!\\n"
    f"  Expected: {expected_pubkey.hex()[:32]}...\\n"
    f"  Got:      {packet_pubkey.hex()[:32]}..."
)

# Test 4: HMAC is 32 non-zero bytes
packet_hmac = packet[1334:1366]
assert len(packet_hmac) == 32, f"HMAC should be 32 bytes, got {len(packet_hmac)}"
assert packet_hmac != bytes(32), "Outermost HMAC should not be all zeros"

# Test 5: Verify the HMAC — Bob's mu key should authenticate the payload
builder.compute_ephemeral_keys_and_secrets()
mu_bob = builder.hop_keys[0]['mu']
payload_section = packet[34:1334]
expected_hmac = hmac.new(mu_bob, payload_section + payment_hash, hashlib.sha256).digest()
assert packet_hmac == expected_hmac, (
    f"HMAC verification failed! The outermost HMAC doesn't match.\\n"
    f"  Expected: {expected_hmac.hex()[:32]}...\\n"
    f"  Got:      {packet_hmac.hex()[:32]}..."
)

# Test 6: Decrypt Bob's layer and verify his payload is readable
rho_bob = builder.hop_keys[0]['rho']
stream = generate_cipher_stream(rho_bob, 1300)
decrypted = xor_bytes(payload_section, stream)

# Bob's TLV payload should start at position 0
# Parse the bigsize length prefix
first_byte = decrypted[0]
assert first_byte < 253, f"Payload length prefix should be < 253, got {first_byte}"

tlv_data = decrypted[1:1 + first_byte]
pos = 0
bob_fields = {}
while pos < len(tlv_data):
    t = tlv_data[pos]; pos += 1
    l = tlv_data[pos]; pos += 1
    v = tlv_data[pos:pos + l]; pos += l
    bob_fields[t] = v

assert 2 in bob_fields, "Decrypted payload missing type 2 (amt_to_forward)"
bob_amt = int.from_bytes(bob_fields[2], 'big')
assert bob_amt == 50_003_000, f"Bob's amt_to_forward should be 50,003,000, got {bob_amt}"

# Test 7: Deterministic — same inputs produce same packet
packet2 = builder.construct_packet(hops_data, payment_hash)
assert packet == packet2, "Packet construction should be deterministic"

print("All onion packet construction tests passed!")
print(f"  Packet size:  {len(packet)} bytes")
print(f"  Version:      {packet[0]:#04x}")
print(f"  Eph. pubkey:  {packet_pubkey.hex()[:32]}...")
print(f"  HMAC:         {packet_hmac.hex()[:32]}...")
print(f"  Bob's amt:    {bob_amt:,} msat (decrypted from layer 1)")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Wrap the onion layer by layer (innermost to outermost) and assemble the 1,366-byte packet.<br><br>' +
        '<strong>wrap_layer</strong>: Each call processes one hop. It shifts the buffer right, inserts data at the front, XOR-encrypts, ' +
        'optionally applies filler, and computes a new HMAC.<br><br>' +
        '<strong>construct_packet</strong>: Orchestrates everything. Builds payloads, generates filler, wraps layers in reverse order, ' +
        'then assembles version + ephemeral pubkey + payload + HMAC.<br><br>' +
        '<strong>Key detail</strong>: The HMAC at each step is computed over <code>encrypted_payload + assoc_data</code> (the payment hash).',
      steps:
        '<strong>wrap_layer steps</strong>:<br>' +
        '1. Compute <code>shift_size = len(hop_payload) + 32</code><br>' +
        '2. Build the shifted buffer: <code>bytearray(hop_payload) + bytearray(current_hmac) + payload_buffer[:1300 - shift_size]</code><br>' +
        '3. Generate cipher stream: <code>generate_cipher_stream(rho_key, 1300)</code><br>' +
        '4. XOR the entire buffer: <code>xor_bytes(bytes(payload_buffer), stream)</code><br>' +
        '5. If <code>is_innermost</code>: overwrite trailing bytes with filler: <code>payload_buffer[1300 - len(filler):] = filler</code><br>' +
        '6. Compute HMAC: <code>hmac.new(mu_key, bytes(payload_buffer) + assoc_data, hashlib.sha256).digest()</code><br><br>' +
        '<strong>construct_packet steps</strong>:<br>' +
        '1. Call <code>self.compute_ephemeral_keys_and_secrets()</code><br>' +
        '2. Build payloads: <code>self.build_hop_payloads(hops_data)</code><br>' +
        '3. Generate filler: <code>self.generate_filler(hop_payloads)</code><br>' +
        '4. Initialize: <code>payload = bytearray(1300)</code>, <code>current_hmac = bytes(32)</code><br>' +
        '5. Loop from <code>num_hops - 1</code> down to <code>0</code>, calling <code>wrap_layer</code> each time<br>' +
        '6. Assemble: <code>b"\\x00" + self.ephemeral_pubkeys[0] + bytes(payload) + current_hmac</code>',
      code: `def wrap_layer(self, payload_buffer, hop_payload, current_hmac,
               rho_key, mu_key, assoc_data, filler=b"", is_innermost=False):
    shift_size = len(hop_payload) + 32
    # Step 1-2: Shift right and insert payload + HMAC at front
    payload_buffer = bytearray(hop_payload) + bytearray(current_hmac) + payload_buffer[:1300 - shift_size]

    # Step 3: XOR encrypt
    stream = generate_cipher_stream(rho_key, 1300)
    payload_buffer = bytearray(xor_bytes(bytes(payload_buffer), stream))

    # Step 4: Apply filler for innermost hop
    if is_innermost and filler:
        payload_buffer[1300 - len(filler):] = filler

    # Step 5: Compute HMAC
    new_hmac = hmac.new(mu_key, bytes(payload_buffer) + assoc_data, hashlib.sha256).digest()
    return payload_buffer, new_hmac

def construct_packet(self, hops_data, assoc_data):
    # 1. Compute keys
    self.compute_ephemeral_keys_and_secrets()

    # 2. Build hop payloads
    hop_payloads = self.build_hop_payloads(hops_data)

    # 3. Generate filler
    filler = self.generate_filler(hop_payloads)

    # 4. Initialize
    payload_buffer = bytearray(1300)
    current_hmac = bytes(32)  # zero HMAC = final hop

    # 5. Wrap layers (innermost to outermost)
    for i in range(self.num_hops - 1, -1, -1):
        is_innermost = (i == self.num_hops - 1)
        payload_buffer, current_hmac = self.wrap_layer(
            payload_buffer,
            hop_payloads[i],
            current_hmac,
            self.hop_keys[i]['rho'],
            self.hop_keys[i]['mu'],
            assoc_data,
            filler=filler if is_innermost else b"",
            is_innermost=is_innermost,
        )

    # 6. Assemble the final packet
    version = b"\\x00"
    return version + self.ephemeral_pubkeys[0] + bytes(payload_buffer) + current_hmac`,
    },
    rewardSats: 42,
    group: "sphinx/builder",
    groupOrder: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 9 — Peel an Onion Layer
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-peel-layer": {
    id: "exercise-peel-layer",
    title: "Exercise 9: Peel an Onion Layer",
    description:
      "Build the <code>SphinxPacketProcessor</code> class, the receiver-side counterpart to <code>SphinxPacketBuilder</code>. " +
      "Implement the <code>peel_layer</code> method that takes a 1,366-byte onion packet and associated data, " +
      "verifies the HMAC, decrypts the routing info, extracts the hop payload, re-blinds the ephemeral key, and " +
      "assembles the next-hop packet. This is the mirror of the wrapping algorithm from Exercise 8.",
    starterCode: `class SphinxPacketProcessor:
    def __init__(self, private_key_hex: str):
        """Initialize with this node's private key."""
        self.private_key = bytes.fromhex(private_key_hex)

    def peel_layer(self, packet: bytes, assoc_data: bytes) -> dict:
        """
        Process an incoming onion packet by peeling one layer.

        Steps:
        1. Parse: version (1), ephemeral_pubkey (33), routing_info (1300), hmac (32)
        2. Compute shared secret: ECDH(self.private_key, ephemeral_pubkey)
        3. Derive hop keys (rho, mu, um, pad, ammag)
        4. Verify HMAC: HMAC-SHA256(mu, routing_info || assoc_data) == packet's HMAC
           Raise ValueError if mismatch.
        5. Decrypt: XOR routing_info with generate_cipher_stream(rho, 1300)
        6. Parse decrypted: read bigsize length, read payload, read next 32 bytes (next_hmac)
        7. Left-shift: remove processed bytes, pad right with zeros to 1300
        8. Check if final: next_hmac == all zeros
        9. Re-blind ephemeral key: blinding_factor = SHA256(eph_pubkey || shared_secret),
           next_eph = eph_point * blinding_factor
        10. Assemble next packet: version + next_eph + shifted_routing + next_hmac

        Args:
            packet: 1366-byte onion packet
            assoc_data: Associated data (payment hash)

        Returns dict with:
            'hop_payload': bytes - the TLV-encoded payload for this hop
                           (including the bigsize length prefix)
            'next_packet': bytes - 1366-byte packet to forward (None if final)
            'is_final': bool - True if next HMAC is all zeros

        Raises ValueError if HMAC verification fails.
        """
        # TODO: Implement onion layer peeling
        pass
`,
    testCode: `
import hashlib

# ─── Build a test packet using the canonical trace ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]

payment_hash = bytes.fromhex("27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8")
packet = builder.construct_packet(hops_data, payment_hash)

# ─── Bob peels his layer ───
bob_privkey_hex = "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"
bob_processor = SphinxPacketProcessor(bob_privkey_hex)
bob_result = bob_processor.peel_layer(packet, payment_hash)

# Test 1: Result has the expected keys
assert 'hop_payload' in bob_result, "Result should have 'hop_payload'"
assert 'next_packet' in bob_result, "Result should have 'next_packet'"
assert 'is_final' in bob_result, "Result should have 'is_final'"

# Test 2: Bob is NOT the final hop
assert bob_result['is_final'] == False, "Bob should not be the final hop"

# Test 3: Bob's payload contains correct forwarding instructions
bob_payload = bob_result['hop_payload']
assert isinstance(bob_payload, bytes), f"hop_payload should be bytes, got {type(bob_payload)}"
# Parse the TLV: length prefix + records
length = bob_payload[0]
tlv_data = bob_payload[1:1 + length]
pos = 0
bob_fields = {}
while pos < len(tlv_data):
    t = tlv_data[pos]; pos += 1
    l = tlv_data[pos]; pos += 1
    v = tlv_data[pos:pos + l]; pos += l
    bob_fields[t] = v

assert 2 in bob_fields, "Bob's payload should contain type 2 (amt_to_forward)"
bob_amt = int.from_bytes(bob_fields[2], 'big')
assert bob_amt == 50_003_000, f"Bob's amt_to_forward should be 50,003,000, got {bob_amt}"

assert 4 in bob_fields, "Bob's payload should contain type 4 (outgoing_cltv_value)"
bob_cltv = int.from_bytes(bob_fields[4], 'big')
assert bob_cltv == 700_048, f"Bob's outgoing_cltv should be 700,048, got {bob_cltv}"

assert 6 in bob_fields, "Bob's payload should contain type 6 (short_channel_id)"
scid_expected = ((700_000 << 40) | (2 << 16) | 0).to_bytes(8, 'big')
assert bob_fields[6] == scid_expected, f"Bob's short_channel_id should be 700000x2x0"

# Test 4: Next packet is 1366 bytes
next_packet = bob_result['next_packet']
assert isinstance(next_packet, bytes), f"next_packet should be bytes, got {type(next_packet)}"
assert len(next_packet) == 1366, f"next_packet should be 1366 bytes, got {len(next_packet)}"

# Test 5: Next packet version is 0x00
assert next_packet[0] == 0x00, f"next_packet version should be 0x00, got {next_packet[0]:#04x}"

# Test 6: HMAC verification rejects tampered packets
import copy
tampered = bytearray(packet)
tampered[500] ^= 0xff  # flip a bit
try:
    bob_processor.peel_layer(bytes(tampered), payment_hash)
    assert False, "Should have raised ValueError for tampered packet"
except ValueError:
    pass  # Expected

# Test 7: Carol can peel the next packet
carol_privkey_hex = "caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50"
carol_processor = SphinxPacketProcessor(carol_privkey_hex)
carol_result = carol_processor.peel_layer(next_packet, payment_hash)

assert carol_result['is_final'] == False, "Carol should not be the final hop"

carol_payload = carol_result['hop_payload']
carol_length = carol_payload[0]
carol_tlv = carol_payload[1:1 + carol_length]
pos = 0
carol_fields = {}
while pos < len(carol_tlv):
    t = carol_tlv[pos]; pos += 1
    l = carol_tlv[pos]; pos += 1
    v = carol_tlv[pos:pos + l]; pos += l
    carol_fields[t] = v

carol_amt = int.from_bytes(carol_fields[2], 'big')
assert carol_amt == 50_000_000, f"Carol's amt_to_forward should be 50,000,000, got {carol_amt}"

# Test 8: Dave is the final hop
dave_privkey_hex = "684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e"
dave_processor = SphinxPacketProcessor(dave_privkey_hex)
dave_result = dave_processor.peel_layer(carol_result['next_packet'], payment_hash)

assert dave_result['is_final'] == True, "Dave should be the final hop"
assert dave_result['next_packet'] is None, "Final hop should have next_packet = None"

print("All peel_layer tests passed!")
print(f"  Bob:   amt={bob_amt:,} msat, cltv={bob_cltv}, is_final={bob_result['is_final']}")
print(f"  Carol: amt={carol_amt:,} msat, is_final={carol_result['is_final']}")
print(f"  Dave:  is_final={dave_result['is_final']}")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Build a processor that peels one layer of a Sphinx onion packet, extracting the forwarding instructions and preparing the next-hop packet.<br><br>' +
        '<strong>Key insight</strong>: Peeling is the mirror of wrapping. The same shared secret, keys, and cipher stream that Alice used to encrypt are used by Bob to decrypt. ' +
        'The ECDH is symmetric: <code>Alice_session_key * Bob_pubkey == Bob_privkey * Alice_session_pubkey</code>.<br><br>' +
        '<strong>Critical detail</strong>: Verify the HMAC <em>before</em> decrypting. If the HMAC fails, raise a ValueError immediately.',
      steps:
        '<strong>Step 1: Parse</strong>: <code>version = packet[0]</code>, <code>eph_pubkey = packet[1:34]</code>, <code>routing_info = packet[34:1334]</code>, <code>packet_hmac = packet[1334:1366]</code>.<br><br>' +
        '<strong>Step 2: Shared secret</strong>: Use <code>SphinxPacketBuilder.compute_shared_secret(self.private_key, eph_pubkey)</code>.<br><br>' +
        '<strong>Step 3: Derive keys</strong>: Create a temporary builder instance or call derive_hop_keys directly. The key derivation is: <code>hmac.new(key_type_bytes, shared_secret, sha256).digest()</code> for each of rho, mu, um, pad, ammag.<br><br>' +
        '<strong>Step 4: Verify HMAC</strong>: <code>expected = hmac.new(mu_key, routing_info + assoc_data, sha256).digest()</code>. If <code>expected != packet_hmac</code>, raise <code>ValueError("HMAC verification failed")</code>.<br><br>' +
        '<strong>Step 5: Decrypt</strong>: <code>decrypted = xor_bytes(routing_info, generate_cipher_stream(rho_key, 1300))</code>.<br><br>' +
        '<strong>Step 6: Parse payload</strong>: Read the bigsize length from <code>decrypted[0]</code>, extract the TLV payload bytes, then read the next 32 bytes as next_hmac.<br><br>' +
        '<strong>Step 7: Left-shift</strong>: <code>payload_end = 1 + length + 32</code> (bigsize prefix + TLV + HMAC). <code>next_routing = decrypted[payload_end:] + b"\\x00" * payload_end</code>.<br><br>' +
        '<strong>Step 8: Re-blind</strong>: <code>bf = SHA256(eph_pubkey + shared_secret)</code>, then multiply the ephemeral point by the blinding factor integer. Compress the result.',
      code: `class SphinxPacketProcessor:
    def __init__(self, private_key_hex: str):
        self.private_key = bytes.fromhex(private_key_hex)

    def peel_layer(self, packet: bytes, assoc_data: bytes) -> dict:
        # Step 1: Parse
        version = packet[0]
        eph_pubkey = packet[1:34]
        routing_info = packet[34:1334]
        packet_hmac = packet[1334:1366]

        # Step 2: Shared secret
        shared_secret = SphinxPacketBuilder.compute_shared_secret(self.private_key, eph_pubkey)

        # Step 3: Derive keys
        key_types = [b"rho", b"mu", b"um", b"pad", b"ammag"]
        keys = {}
        for kt in key_types:
            keys[kt.decode()] = hmac.new(kt, shared_secret, hashlib.sha256).digest()

        # Step 4: Verify HMAC
        expected_hmac = hmac.new(keys['mu'], routing_info + assoc_data, hashlib.sha256).digest()
        if expected_hmac != packet_hmac:
            raise ValueError("HMAC verification failed")

        # Step 5: Decrypt
        stream = generate_cipher_stream(keys['rho'], 1300)
        decrypted = xor_bytes(routing_info, stream)

        # Step 6: Parse payload
        payload_length = decrypted[0]
        hop_payload = decrypted[0:1 + payload_length]  # include length prefix
        next_hmac = decrypted[1 + payload_length:1 + payload_length + 32]

        # Step 7: Left-shift and pad
        payload_end = 1 + payload_length + 32
        next_routing = decrypted[payload_end:] + b"\\x00" * payload_end

        # Step 8: Check if final
        is_final = next_hmac == bytes(32)

        if is_final:
            return {
                'hop_payload': hop_payload,
                'next_packet': None,
                'is_final': True,
            }

        # Step 9: Re-blind ephemeral key
        bf_hash = hashlib.sha256(eph_pubkey + shared_secret).digest()
        bf_int = int.from_bytes(bf_hash, 'big')
        eph_vk = VerifyingKey.from_string(eph_pubkey, curve=SECP256k1)
        next_point = eph_vk.pubkey.point * bf_int
        x = next_point.x()
        y = next_point.y()
        prefix = b"\\x02" if y % 2 == 0 else b"\\x03"
        next_eph = prefix + x.to_bytes(32, 'big')

        # Step 10: Assemble
        next_packet = b"\\x00" + next_eph + next_routing + next_hmac
        return {
            'hop_payload': hop_payload,
            'next_packet': next_packet,
            'is_final': False,
        }`,
    },
    rewardSats: 42,
    group: "sphinx/processor",
    groupOrder: 0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 10 — Validate a Forward
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-validate-forward": {
    id: "exercise-validate-forward",
    title: "Exercise 10: Validate a Forward",
    description:
      "Add a <code>validate_forward</code> method to <code>SphinxPacketProcessor</code> that checks whether an incoming HTLC " +
      "meets the node's fee and timelock requirements before forwarding. The method parses the TLV payload to extract " +
      "<code>amt_to_forward</code> and <code>outgoing_cltv_value</code>, then validates fee sufficiency, timelock safety, " +
      "and CLTV expiry.",
    starterCode: `def validate_forward(self, incoming_amount_msat: int, incoming_cltv: int,
                     hop_payload: bytes, fee_policy: dict, current_height: int) -> dict:
    """
    Validate whether this forward meets fee and timelock requirements.

    Args:
        incoming_amount_msat: Amount on incoming HTLC (what the previous hop is paying us)
        incoming_cltv: CLTV on incoming HTLC
        hop_payload: TLV-encoded payload (with bigsize length prefix) from peel_layer
        fee_policy: dict with 'fee_base_msat', 'fee_proportional_millionths', 'cltv_expiry_delta'
        current_height: Current block height

    Validation checks:
        1. Fee: incoming_amount >= amt_to_forward + expected_fee
        2. Timelock: incoming_cltv >= outgoing_cltv + cltv_expiry_delta
        3. Expiry: outgoing_cltv > current_height

    Returns dict:
        'valid': bool
        'reason': str (empty if valid, explanation if invalid)
        'amt_to_forward': int (parsed from payload)
        'outgoing_cltv': int (parsed from payload)
    """
    # TODO: Parse the TLV payload and validate the forward
    pass
`,
    testCode: `
# ─── Build a test packet and peel Bob's layer ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]

payment_hash = bytes.fromhex("27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8")
packet = builder.construct_packet(hops_data, payment_hash)

bob_privkey_hex = "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"
bob_processor = SphinxPacketProcessor(bob_privkey_hex)
bob_result = bob_processor.peel_layer(packet, payment_hash)

# Bob's fee policy
bob_policy = {
    'fee_base_msat': 1000,
    'fee_proportional_millionths': 100,
    'cltv_expiry_delta': 40,
}

# ─── Test 1: Valid forward (canonical trace) ───
result = bob_processor.validate_forward(
    incoming_amount_msat=50_009_000,
    incoming_cltv=700_088,
    hop_payload=bob_result['hop_payload'],
    fee_policy=bob_policy,
    current_height=700_000,
)

assert result['valid'] == True, f"Should be valid, got reason: {result['reason']}"
assert result['amt_to_forward'] == 50_003_000, f"amt_to_forward should be 50,003,000, got {result['amt_to_forward']}"
assert result['outgoing_cltv'] == 700_048, f"outgoing_cltv should be 700,048, got {result['outgoing_cltv']}"

# ─── Test 2: Insufficient fee ───
result_low_fee = bob_processor.validate_forward(
    incoming_amount_msat=50_003_100,  # only 100 msat above forward amount (need 6,000)
    incoming_cltv=700_088,
    hop_payload=bob_result['hop_payload'],
    fee_policy=bob_policy,
    current_height=700_000,
)

assert result_low_fee['valid'] == False, "Should be invalid: insufficient fee"
assert 'fee' in result_low_fee['reason'].lower(), f"Reason should mention fee: {result_low_fee['reason']}"

# ─── Test 3: Insufficient CLTV margin ───
result_low_cltv = bob_processor.validate_forward(
    incoming_amount_msat=50_009_000,
    incoming_cltv=700_050,  # only 2 blocks margin (need 40)
    hop_payload=bob_result['hop_payload'],
    fee_policy=bob_policy,
    current_height=700_000,
)

assert result_low_cltv['valid'] == False, "Should be invalid: insufficient CLTV margin"
assert 'cltv' in result_low_cltv['reason'].lower() or 'timelock' in result_low_cltv['reason'].lower(), \\
    f"Reason should mention CLTV/timelock: {result_low_cltv['reason']}"

# ─── Test 4: Expired CLTV ───
result_expired = bob_processor.validate_forward(
    incoming_amount_msat=50_009_000,
    incoming_cltv=700_088,
    hop_payload=bob_result['hop_payload'],
    fee_policy=bob_policy,
    current_height=700_050,  # block height past outgoing CLTV
)

assert result_expired['valid'] == False, "Should be invalid: expired CLTV"
assert 'expir' in result_expired['reason'].lower() or 'height' in result_expired['reason'].lower(), \\
    f"Reason should mention expiry: {result_expired['reason']}"

# ─── Test 5: Exact minimum fee passes ───
# Expected fee = 1000 + floor(50,003,000 * 100 / 1,000,000) = 1000 + 5000 = 6000
exact_min = 50_003_000 + 6_000
result_exact = bob_processor.validate_forward(
    incoming_amount_msat=exact_min,
    incoming_cltv=700_088,
    hop_payload=bob_result['hop_payload'],
    fee_policy=bob_policy,
    current_height=700_000,
)
assert result_exact['valid'] == True, f"Exact minimum fee should pass, got: {result_exact['reason']}"

print("All validate_forward tests passed!")
print(f"  Valid forward: amt={result['amt_to_forward']:,}, cltv={result['outgoing_cltv']}")
print(f"  Low fee rejected: {result_low_fee['reason']}")
print(f"  Low CLTV rejected: {result_low_cltv['reason']}")
print(f"  Expired CLTV rejected: {result_expired['reason']}")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Parse the TLV payload from <code>peel_layer</code> and validate that the incoming HTLC meets fee and timelock requirements.<br><br>' +
        '<strong>Fee formula</strong>: <code>expected_fee = fee_base_msat + floor(amt_to_forward * fee_proportional_millionths / 1,000,000)</code><br><br>' +
        '<strong>Three checks</strong>: (1) Incoming amount covers forwarded amount + fee, (2) incoming CLTV provides enough margin over outgoing CLTV, (3) outgoing CLTV hasn\'t expired.',
      steps:
        '<strong>Step 1: Parse the TLV</strong>: Read the bigsize length from <code>hop_payload[0]</code>. Extract TLV records by iterating: type (1 byte), length (1 byte), value (<code>length</code> bytes).<br><br>' +
        '<strong>Step 2: Extract values</strong>: Type 2 = <code>amt_to_forward</code> (decode with <code>int.from_bytes(v, \'big\')</code>). Type 4 = <code>outgoing_cltv</code>.<br><br>' +
        '<strong>Step 3: Check fee</strong>: <code>expected_fee = fee_base_msat + (amt_to_forward * fee_proportional_millionths // 1_000_000)</code>. If <code>incoming_amount_msat < amt_to_forward + expected_fee</code>, return invalid.<br><br>' +
        '<strong>Step 4: Check CLTV margin</strong>: If <code>incoming_cltv < outgoing_cltv + cltv_expiry_delta</code>, return invalid.<br><br>' +
        '<strong>Step 5: Check expiry</strong>: If <code>outgoing_cltv <= current_height</code>, return invalid.',
      code: `def validate_forward(self, incoming_amount_msat, incoming_cltv,
                     hop_payload, fee_policy, current_height):
    # Parse TLV payload
    length = hop_payload[0]
    tlv_data = hop_payload[1:1 + length]
    pos = 0
    fields = {}
    while pos < len(tlv_data):
        t = tlv_data[pos]; pos += 1
        l = tlv_data[pos]; pos += 1
        v = tlv_data[pos:pos + l]; pos += l
        fields[t] = v

    amt_to_forward = int.from_bytes(fields[2], 'big')
    outgoing_cltv = int.from_bytes(fields[4], 'big')

    # Check 1: Fee sufficiency
    expected_fee = fee_policy['fee_base_msat'] + \\
        (amt_to_forward * fee_policy['fee_proportional_millionths'] // 1_000_000)
    if incoming_amount_msat < amt_to_forward + expected_fee:
        return {
            'valid': False,
            'reason': f'Insufficient fee: need {amt_to_forward + expected_fee}, got {incoming_amount_msat}',
            'amt_to_forward': amt_to_forward,
            'outgoing_cltv': outgoing_cltv,
        }

    # Check 2: Timelock safety
    if incoming_cltv < outgoing_cltv + fee_policy['cltv_expiry_delta']:
        return {
            'valid': False,
            'reason': f'Insufficient CLTV margin: need {outgoing_cltv + fee_policy["cltv_expiry_delta"]}, got {incoming_cltv}',
            'amt_to_forward': amt_to_forward,
            'outgoing_cltv': outgoing_cltv,
        }

    # Check 3: Not expired
    if outgoing_cltv <= current_height:
        return {
            'valid': False,
            'reason': f'Outgoing CLTV expired: {outgoing_cltv} <= current height {current_height}',
            'amt_to_forward': amt_to_forward,
            'outgoing_cltv': outgoing_cltv,
        }

    return {
        'valid': True,
        'reason': '',
        'amt_to_forward': amt_to_forward,
        'outgoing_cltv': outgoing_cltv,
    }`,
    },
    rewardSats: 21,
    group: "sphinx/processor",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 11 — End-to-End Verification
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-end-to-end-verify": {
    id: "exercise-end-to-end-verify",
    title: "Exercise 11: End-to-End Verification",
    description:
      "Write a standalone function that builds an onion packet with <code>SphinxPacketBuilder</code>, peels it at each hop " +
      "with <code>SphinxPacketProcessor</code>, and verifies that every hop sees the correct forwarding instructions. " +
      "This connects both sides of the Sphinx protocol and validates the full payment trace end to end.",
    starterCode: `def verify_onion_route(builder: SphinxPacketBuilder,
                       processors: list,
                       hops_data: list[dict],
                       assoc_data: bytes,
                       node_names: list[str]) -> list[dict]:
    """
    Build an onion packet and peel it at each hop, verifying consistency.

    Args:
        builder: SphinxPacketBuilder (initialized with session key and route)
        processors: List of SphinxPacketProcessor (one per hop, in route order)
        hops_data: List of hop data dicts (same format as construct_packet)
        assoc_data: Payment hash bytes
        node_names: List of node name strings for reporting (e.g. ["Bob", "Carol", "Dave"])

    Returns list of dicts, one per hop:
        'node': str name
        'payload_valid': bool (True if parsed payload matches expected hops_data)
        'is_final': bool
        'amt_to_forward': int
        'outgoing_cltv': int
    """
    # TODO: Build packet, peel at each hop, verify each payload matches
    pass
`,
    testCode: `
import hashlib

# ─── Set up builder and processors for the canonical trace ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)

processors = [
    SphinxPacketProcessor("46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"),  # Bob
    SphinxPacketProcessor("caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50"),  # Carol
    SphinxPacketProcessor("684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e"),  # Dave
]

hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]

payment_hash = bytes.fromhex("27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8")
node_names = ["Bob", "Carol", "Dave"]

results = verify_onion_route(builder, processors, hops_data, payment_hash, node_names)

# Test 1: Correct number of results
assert len(results) == 3, f"Expected 3 results, got {len(results)}"

# Test 2: All payloads are valid
for i, r in enumerate(results):
    assert r['payload_valid'] == True, f"{r['node']} payload should be valid"

# Test 3: Correct amounts
assert results[0]['amt_to_forward'] == 50_003_000, f"Bob: expected 50,003,000, got {results[0]['amt_to_forward']}"
assert results[1]['amt_to_forward'] == 50_000_000, f"Carol: expected 50,000,000, got {results[1]['amt_to_forward']}"
assert results[2]['amt_to_forward'] == 50_000_000, f"Dave: expected 50,000,000, got {results[2]['amt_to_forward']}"

# Test 4: Correct CLTVs
assert results[0]['outgoing_cltv'] == 700_048, f"Bob: expected cltv 700,048, got {results[0]['outgoing_cltv']}"
assert results[1]['outgoing_cltv'] == 700_018, f"Carol: expected cltv 700,018, got {results[1]['outgoing_cltv']}"
assert results[2]['outgoing_cltv'] == 700_018, f"Dave: expected cltv 700,018, got {results[2]['outgoing_cltv']}"

# Test 5: Only Dave is final
assert results[0]['is_final'] == False, "Bob should not be final"
assert results[1]['is_final'] == False, "Carol should not be final"
assert results[2]['is_final'] == True, "Dave should be final"

# Test 6: Node names are correct
assert results[0]['node'] == "Bob", f"First hop should be Bob, got {results[0]['node']}"
assert results[1]['node'] == "Carol", f"Second hop should be Carol, got {results[1]['node']}"
assert results[2]['node'] == "Dave", f"Third hop should be Dave, got {results[2]['node']}"

print("End-to-end verification passed!")
for r in results:
    final_str = " (FINAL HOP)" if r['is_final'] else ""
    print(f"  {r['node']}: amt={r['amt_to_forward']:>12,} msat, cltv={r['outgoing_cltv']}{final_str}")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Connect the builder and processor into a full end-to-end pipeline. Build the packet once, peel it at each hop, and verify every payload matches the original input.<br><br>' +
        '<strong>Key insight</strong>: The builder and processor use the same cryptographic primitives (ECDH, HMAC, ChaCha20). If both are implemented correctly, the decrypted payload at each hop will exactly match what Alice originally encoded.<br><br>' +
        '<strong>Verification</strong>: At each hop, parse the TLV payload and compare <code>amt_to_forward</code> and <code>outgoing_cltv</code> with the expected values from <code>hops_data</code>.',
      steps:
        '<strong>Step 1</strong>: Build the packet: <code>packet = builder.construct_packet(hops_data, assoc_data)</code>.<br><br>' +
        '<strong>Step 2</strong>: Initialize an empty results list and set <code>current_packet = packet</code>.<br><br>' +
        '<strong>Step 3</strong>: For each hop (processor, hops_data entry, node name):<br>' +
        '- Call <code>processor.peel_layer(current_packet, assoc_data)</code><br>' +
        '- Parse the returned <code>hop_payload</code>: read bigsize length, extract TLV records, decode type 2 (amt) and type 4 (cltv)<br>' +
        '- Compare with expected values from <code>hops_data[i]</code><br>' +
        '- Set <code>current_packet = result[\'next_packet\']</code> for the next iteration<br><br>' +
        '<strong>Step 4</strong>: Return the list of result dicts with node, payload_valid, is_final, amt_to_forward, outgoing_cltv.',
      code: `def verify_onion_route(builder, processors, hops_data, assoc_data, node_names):
    # Build the packet
    packet = builder.construct_packet(hops_data, assoc_data)
    results = []
    current_packet = packet

    for i, (processor, hop_data, name) in enumerate(zip(processors, hops_data, node_names)):
        # Peel this hop's layer
        peel_result = processor.peel_layer(current_packet, assoc_data)

        # Parse the TLV payload
        payload = peel_result['hop_payload']
        length = payload[0]
        tlv_data = payload[1:1 + length]
        pos = 0
        fields = {}
        while pos < len(tlv_data):
            t = tlv_data[pos]; pos += 1
            l = tlv_data[pos]; pos += 1
            v = tlv_data[pos:pos + l]; pos += l
            fields[t] = v

        amt = int.from_bytes(fields[2], 'big')
        cltv = int.from_bytes(fields[4], 'big')

        # Verify against expected
        payload_valid = (amt == hop_data['amt_to_forward_msat'] and
                        cltv == hop_data['outgoing_cltv_value'])

        results.append({
            'node': name,
            'payload_valid': payload_valid,
            'is_final': peel_result['is_final'],
            'amt_to_forward': amt,
            'outgoing_cltv': cltv,
        })

        # Advance to next packet
        current_packet = peel_result['next_packet']

    return results`,
    },
    rewardSats: 42,
    group: "sphinx/processor",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 12 — Construct an Error Packet
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-construct-error": {
    id: "exercise-construct-error",
    title: "Exercise 12: Construct an Error Packet",
    description:
      "Add <code>construct_error</code> and <code>wrap_error</code> methods to <code>SphinxPacketProcessor</code>. " +
      "The <code>construct_error</code> method builds an encrypted 288-byte error packet at the failing hop " +
      "(failure code + padding + HMAC + obfuscation), and <code>wrap_error</code> adds another layer of " +
      "obfuscation at each intermediate hop as the error travels backward.",
    starterCode: `def construct_error(self, shared_secret: bytes, failure_code: int,
                     failure_data: bytes = b"") -> bytes:
    """
    Construct an encrypted error packet at the failing hop.

    Steps:
    1. Build error message: failure_code (2 bytes big-endian) +
       len(failure_data) (2 bytes big-endian) + failure_data
    2. Pad to 256 bytes with zeros
    3. Derive um_key and ammag_key from the shared secret
    4. Compute HMAC: hmac_sha256(um_key, padded_error) -> 32 bytes
    5. Prepend HMAC: hmac (32) + padded_error (256) = 288 bytes
    6. Obfuscate: XOR with generate_cipher_stream(ammag_key, 288)

    Args:
        shared_secret: 32-byte shared secret for this hop
        failure_code: 2-byte failure code (e.g. 0x1007)
        failure_data: Optional additional failure data

    Returns: 288-byte encrypted error packet
    """
    # TODO: Implement error packet construction
    pass

def wrap_error(self, shared_secret: bytes, error_packet: bytes) -> bytes:
    """
    Add another layer of obfuscation at an intermediate hop.

    Args:
        shared_secret: 32-byte shared secret for this hop
        error_packet: 288-byte error packet from downstream

    Returns: 288-byte re-obfuscated error packet
    """
    # TODO: Implement intermediate hop error wrapping
    pass
`,
    testCode: `
import hashlib

# ─── Set up canonical trace ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)
builder.compute_ephemeral_keys_and_secrets()

# Get shared secrets and hop keys for each hop
bob_ss = builder.shared_secrets[0]
carol_ss = builder.shared_secrets[1]
dave_ss = builder.shared_secrets[2]

# ─── Test 1: Carol constructs an error (temporary_channel_failure) ───
carol_processor = SphinxPacketProcessor("caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50")
error_packet = carol_processor.construct_error(carol_ss, 0x1007)

assert isinstance(error_packet, bytes), f"Error packet should be bytes, got {type(error_packet)}"
assert len(error_packet) == 288, f"Error packet should be 288 bytes, got {len(error_packet)}"

# ─── Test 2: Construct error with failure data ───
extra_data = b"\\x00" * 20  # 20 bytes of failure data
error_with_data = carol_processor.construct_error(carol_ss, 0x100C, extra_data)
assert len(error_with_data) == 288, f"Error packet with data should be 288 bytes, got {len(error_with_data)}"

# ─── Test 3: Bob wraps the error ───
bob_processor = SphinxPacketProcessor("46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605")
wrapped = bob_processor.wrap_error(bob_ss, error_packet)

assert isinstance(wrapped, bytes), f"Wrapped error should be bytes, got {type(wrapped)}"
assert len(wrapped) == 288, f"Wrapped error should be 288 bytes, got {len(wrapped)}"
assert wrapped != error_packet, "Wrapped error should differ from original"

# ─── Test 4: Verify Alice can unwrap to find Carol's error ───
# Remove Bob's layer
bob_ammag = hmac.new(b"ammag", bob_ss, hashlib.sha256).digest()
step1 = xor_bytes(wrapped, generate_cipher_stream(bob_ammag, 288))

# Check Bob's HMAC (should NOT match since Bob didn't generate this error)
bob_um = hmac.new(b"um", bob_ss, hashlib.sha256).digest()
bob_hmac_check = hmac.new(bob_um, step1[32:], hashlib.sha256).digest()
assert bob_hmac_check != step1[:32], "Bob's HMAC should not match (he didn't generate the error)"

# Remove Carol's layer
carol_ammag = hmac.new(b"ammag", carol_ss, hashlib.sha256).digest()
step2 = xor_bytes(step1, generate_cipher_stream(carol_ammag, 288))

# Check Carol's HMAC (should match since Carol generated this error)
carol_um = hmac.new(b"um", carol_ss, hashlib.sha256).digest()
carol_hmac_check = hmac.new(carol_um, step2[32:], hashlib.sha256).digest()
assert carol_hmac_check == step2[:32], "Carol's HMAC should match (she generated the error)"

# Extract failure code
failure_code = int.from_bytes(step2[32:34], 'big')
assert failure_code == 0x1007, f"Failure code should be 0x1007, got {failure_code:#06x}"

# ─── Test 5: Error from Dave (final hop) ───
dave_processor = SphinxPacketProcessor("684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e")
dave_error = dave_processor.construct_error(dave_ss, 0x400A)  # unknown_next_peer
assert len(dave_error) == 288, "Dave's error should be 288 bytes"

# Wrap through Carol, then Bob
carol_wrapped = carol_processor.wrap_error(carol_ss, dave_error)
bob_wrapped = bob_processor.wrap_error(bob_ss, carol_wrapped)

# Alice unwraps: remove Bob's layer
s1 = xor_bytes(bob_wrapped, generate_cipher_stream(bob_ammag, 288))
h1 = hmac.new(bob_um, s1[32:], hashlib.sha256).digest()
assert h1 != s1[:32], "Bob should not match (Dave generated the error)"

# Remove Carol's layer
s2 = xor_bytes(s1, generate_cipher_stream(carol_ammag, 288))
h2 = hmac.new(carol_um, s2[32:], hashlib.sha256).digest()
assert h2 != s2[:32], "Carol should not match (Dave generated the error)"

# Remove Dave's layer
dave_ammag = hmac.new(b"ammag", dave_ss, hashlib.sha256).digest()
s3 = xor_bytes(s2, generate_cipher_stream(dave_ammag, 288))
dave_um = hmac.new(b"um", dave_ss, hashlib.sha256).digest()
h3 = hmac.new(dave_um, s3[32:], hashlib.sha256).digest()
assert h3 == s3[:32], "Dave should match (he generated the error)"

dave_code = int.from_bytes(s3[32:34], 'big')
assert dave_code == 0x400A, f"Dave's failure code should be 0x400A, got {dave_code:#06x}"

print("All construct_error / wrap_error tests passed!")
print(f"  Carol's error: code=0x{0x1007:04x} (temporary_channel_failure)")
print(f"  Dave's error:  code=0x{0x400A:04x} (unknown_next_peer)")
print(f"  Error packet size: {len(error_packet)} bytes")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Build an encrypted error packet at the failing hop and add obfuscation layers at intermediate hops.<br><br>' +
        '<strong>Key insight</strong>: Error packets use two keys from the shared secret: <code>um</code> for HMAC authentication and <code>ammag</code> for XOR obfuscation. These are the "backward" counterparts to <code>mu</code> and <code>rho</code>.<br><br>' +
        '<strong>Fixed size</strong>: The error message is always padded to 256 bytes, and the final packet is always 288 bytes (32-byte HMAC + 256-byte payload). This prevents the error type from leaking through packet size.',
      steps:
        '<strong>Step 1: Derive keys</strong>: <code>um_key = hmac.new(b"um", shared_secret, sha256).digest()</code> and <code>ammag_key = hmac.new(b"ammag", shared_secret, sha256).digest()</code>.<br><br>' +
        '<strong>Step 2: Build error message</strong>: <code>failure_code.to_bytes(2, "big") + len(failure_data).to_bytes(2, "big") + failure_data</code>.<br><br>' +
        '<strong>Step 3: Pad</strong>: Use <code>error_msg.ljust(256, b"\\x00")</code> or manual padding to reach exactly 256 bytes.<br><br>' +
        '<strong>Step 4: HMAC</strong>: <code>error_hmac = hmac.new(um_key, padded, sha256).digest()</code>.<br><br>' +
        '<strong>Step 5: Combine</strong>: <code>packet = error_hmac + padded</code> (288 bytes).<br><br>' +
        '<strong>Step 6: Obfuscate</strong>: <code>xor_bytes(packet, generate_cipher_stream(ammag_key, 288))</code>.<br><br>' +
        '<strong>wrap_error</strong>: Just derive the <code>ammag_key</code> and XOR the 288-byte packet with the cipher stream. No HMAC needed for intermediate hops.',
      code: `def construct_error(self, shared_secret, failure_code, failure_data=b""):
    # Derive keys
    um_key = hmac.new(b"um", shared_secret, hashlib.sha256).digest()
    ammag_key = hmac.new(b"ammag", shared_secret, hashlib.sha256).digest()

    # Build error message
    error_msg = (failure_code.to_bytes(2, 'big') +
                 len(failure_data).to_bytes(2, 'big') +
                 failure_data)

    # Pad to 256 bytes
    padded = error_msg + b"\\x00" * (256 - len(error_msg))

    # Compute HMAC
    error_hmac = hmac.new(um_key, padded, hashlib.sha256).digest()

    # Combine: HMAC (32) + padded error (256) = 288 bytes
    packet = error_hmac + padded

    # Obfuscate with ammag stream
    stream = generate_cipher_stream(ammag_key, 288)
    return xor_bytes(packet, stream)

def wrap_error(self, shared_secret, error_packet):
    # Derive ammag key
    ammag_key = hmac.new(b"ammag", shared_secret, hashlib.sha256).digest()

    # XOR with ammag stream
    stream = generate_cipher_stream(ammag_key, 288)
    return xor_bytes(error_packet, stream)`,
    },
    rewardSats: 42,
    group: "sphinx/processor",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 13 — Unwrap an Error Packet
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-unwrap-error": {
    id: "exercise-unwrap-error",
    title: "Exercise 13: Unwrap an Error Packet",
    description:
      "Implement a standalone <code>unwrap_error</code> function that iteratively de-obfuscates an error packet " +
      "using the shared secrets from packet construction. At each hop, it removes one layer of XOR obfuscation " +
      "and checks the HMAC to determine if that hop generated the error. When the HMAC matches, the function " +
      "extracts the failure code and failure data.",
    starterCode: `def unwrap_error(error_packet: bytes, shared_secrets: list,
                  node_names: list[str]) -> dict:
    """
    Unwrap an error packet by iteratively de-obfuscating at each hop.

    For each hop (forward order: Bob, Carol, Dave):
    1. Derive ammag_key from shared_secrets[i]
    2. XOR error_packet with generate_cipher_stream(ammag_key, 288)
    3. Derive um_key from shared_secrets[i]
    4. Split: claimed_hmac = error_packet[0:32], payload = error_packet[32:288]
    5. Compute expected_hmac = HMAC-SHA256(um_key, payload)
    6. If match: extract failure_code (2 bytes) and failure_data

    Args:
        error_packet: 288-byte encrypted error packet
        shared_secrets: List of 32-byte shared secrets (one per hop, forward order)
        node_names: List of node name strings (e.g. ["Bob", "Carol", "Dave"])

    Returns dict:
        'hop_index': int (0-based index of the failing hop)
        'node': str (name of the failing node)
        'failure_code': int (2-byte failure code)
        'failure_data': bytes (optional failure data, may be empty)
    """
    # TODO: Implement error unwrapping
    pass
`,
    testCode: `
import hashlib

# ─── Set up canonical trace and compute shared secrets ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"
bob_pubkey_hex = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey_hex = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey_hex = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

route = [bob_pubkey_hex, carol_pubkey_hex, dave_pubkey_hex]
builder = SphinxPacketBuilder(session_key_hex, route)
builder.compute_ephemeral_keys_and_secrets()

shared_secrets = builder.shared_secrets
node_names = ["Bob", "Carol", "Dave"]

# ─── Test 1: Carol generates error, Bob wraps, Alice unwraps ───
carol_processor = SphinxPacketProcessor("caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50")
carol_error = carol_processor.construct_error(shared_secrets[1], 0x1007)  # temporary_channel_failure

bob_processor = SphinxPacketProcessor("46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605")
wrapped = bob_processor.wrap_error(shared_secrets[0], carol_error)

result = unwrap_error(wrapped, shared_secrets, node_names)

assert result['hop_index'] == 1, f"Should identify hop 1 (Carol), got {result['hop_index']}"
assert result['node'] == "Carol", f"Should identify Carol, got {result['node']}"
assert result['failure_code'] == 0x1007, f"Failure code should be 0x1007, got {result['failure_code']:#06x}"
assert result['failure_data'] == b"", f"Failure data should be empty, got {result['failure_data']}"

# ─── Test 2: Bob generates error, Alice unwraps directly ───
bob_error = bob_processor.construct_error(shared_secrets[0], 0x100C)  # fee_insufficient
result2 = unwrap_error(bob_error, shared_secrets, node_names)

assert result2['hop_index'] == 0, f"Should identify hop 0 (Bob), got {result2['hop_index']}"
assert result2['node'] == "Bob", f"Should identify Bob, got {result2['node']}"
assert result2['failure_code'] == 0x100C, f"Failure code should be 0x100C, got {result2['failure_code']:#06x}"

# ─── Test 3: Dave generates error, wraps through Carol and Bob ───
dave_processor = SphinxPacketProcessor("684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e")
dave_error = dave_processor.construct_error(shared_secrets[2], 0x400A)  # unknown_next_peer

carol_wrapped = carol_processor.wrap_error(shared_secrets[1], dave_error)
bob_wrapped = bob_processor.wrap_error(shared_secrets[0], carol_wrapped)

result3 = unwrap_error(bob_wrapped, shared_secrets, node_names)

assert result3['hop_index'] == 2, f"Should identify hop 2 (Dave), got {result3['hop_index']}"
assert result3['node'] == "Dave", f"Should identify Dave, got {result3['node']}"
assert result3['failure_code'] == 0x400A, f"Failure code should be 0x400A, got {result3['failure_code']:#06x}"

# ─── Test 4: Error with failure data ───
extra_data = b"\\x01\\x02\\x03\\x04\\x05"
carol_error_data = carol_processor.construct_error(shared_secrets[1], 0x100D, extra_data)
bob_wrapped_data = bob_processor.wrap_error(shared_secrets[0], carol_error_data)

result4 = unwrap_error(bob_wrapped_data, shared_secrets, node_names)

assert result4['hop_index'] == 1, f"Should identify Carol, got hop {result4['hop_index']}"
assert result4['failure_code'] == 0x100D, f"Failure code should be 0x100D, got {result4['failure_code']:#06x}"
assert result4['failure_data'] == extra_data, f"Failure data should match, got {result4['failure_data'].hex()}"

# ─── Test 5: BADONION error from Bob ───
bob_onion_error = bob_processor.construct_error(shared_secrets[0], 0x8002)  # invalid_onion_hmac
result5 = unwrap_error(bob_onion_error, shared_secrets, node_names)

assert result5['failure_code'] == 0x8002, f"Should be 0x8002, got {result5['failure_code']:#06x}"
assert result5['failure_code'] & 0x8000 != 0, "BADONION flag should be set"

print("All unwrap_error tests passed!")
print(f"  Test 1: Carol error -> code=0x{result['failure_code']:04x} ({result['node']})")
print(f"  Test 2: Bob error   -> code=0x{result2['failure_code']:04x} ({result2['node']})")
print(f"  Test 3: Dave error  -> code=0x{result3['failure_code']:04x} ({result3['node']})")
print(f"  Test 4: With data   -> code=0x{result4['failure_code']:04x}, data={result4['failure_data'].hex()}")
print(f"  Test 5: BADONION    -> code=0x{result5['failure_code']:04x} (flag={result5['failure_code'] & 0x8000:#06x})")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Iterate through each hop\'s shared secret, removing one obfuscation layer at a time, and check the HMAC to find which hop generated the error.<br><br>' +
        '<strong>Key insight</strong>: Each hop added a layer of XOR obfuscation using its <code>ammag</code> key. Alice removes layers in forward order (Bob first, then Carol, then Dave). When the right number of layers have been removed, the HMAC computed with that hop\'s <code>um</code> key will match the first 32 bytes of the packet.<br><br>' +
        '<strong>Error format</strong>: After all layers are removed, the packet is: HMAC (32 bytes) + failure_code (2 bytes) + data_len (2 bytes) + failure_data + zero padding.',
      steps:
        '<strong>Step 1</strong>: Start with the received error_packet (288 bytes).<br><br>' +
        '<strong>Step 2</strong>: For each hop <code>i</code> in range(len(shared_secrets)):<br>' +
        '- Derive <code>ammag_key = hmac.new(b"ammag", shared_secrets[i], sha256).digest()</code><br>' +
        '- XOR: <code>error_packet = xor_bytes(error_packet, generate_cipher_stream(ammag_key, 288))</code><br>' +
        '- Derive <code>um_key = hmac.new(b"um", shared_secrets[i], sha256).digest()</code><br>' +
        '- Split: <code>claimed_hmac = error_packet[:32]</code>, <code>payload = error_packet[32:]</code><br>' +
        '- Compute: <code>expected = hmac.new(um_key, payload, sha256).digest()</code><br>' +
        '- If <code>claimed_hmac == expected</code>: this hop generated the error. Extract the failure_code and failure_data.<br><br>' +
        '<strong>Step 3: Extract</strong>: <code>failure_code = int.from_bytes(payload[0:2], "big")</code>, <code>data_len = int.from_bytes(payload[2:4], "big")</code>, <code>failure_data = payload[4:4+data_len]</code>.',
      code: `def unwrap_error(error_packet, shared_secrets, node_names):
    packet = bytearray(error_packet)

    for i in range(len(shared_secrets)):
        # Remove one layer of obfuscation
        ammag_key = hmac.new(b"ammag", shared_secrets[i], hashlib.sha256).digest()
        packet = bytearray(xor_bytes(bytes(packet), generate_cipher_stream(ammag_key, 288)))

        # Check HMAC
        um_key = hmac.new(b"um", shared_secrets[i], hashlib.sha256).digest()
        claimed_hmac = bytes(packet[:32])
        payload = bytes(packet[32:])
        expected_hmac = hmac.new(um_key, payload, hashlib.sha256).digest()

        if claimed_hmac == expected_hmac:
            # This hop generated the error
            failure_code = int.from_bytes(payload[0:2], 'big')
            data_len = int.from_bytes(payload[2:4], 'big')
            failure_data = payload[4:4 + data_len]
            return {
                'hop_index': i,
                'node': node_names[i],
                'failure_code': failure_code,
                'failure_data': failure_data,
            }

    # No hop matched (malformed error)
    return {
        'hop_index': -1,
        'node': 'unknown',
        'failure_code': 0,
        'failure_data': b'',
    }`,
    },
    rewardSats: 42,
    group: "sphinx/processor",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 14 — Complete Payment Trace (Capstone)
  // ═══════════════════════════════════════════════════════════════════════════
  "exercise-payment-trace": {
    id: "exercise-payment-trace",
    title: "Exercise 14: Complete Payment Trace (Capstone)",
    description:
      "Write a <code>trace_payment</code> function that orchestrates the full onion routing lifecycle: " +
      "build an onion packet using <code>SphinxPacketBuilder</code>, peel it at each hop using " +
      "<code>SphinxPacketProcessor</code>, parse each hop's TLV payload, and return a structured " +
      "summary of the trace. This capstone exercise ties together every concept from the course.",
    starterCode: `def trace_payment(
    session_key_hex: str,
    route_pubkeys: list[str],
    route_privkeys: list[str],
    hops_data: list[dict],
    payment_hash: bytes,
) -> dict:
    """
    Trace a complete payment through the onion routing lifecycle.

    Args:
        session_key_hex: Alice's session key (hex string)
        route_pubkeys: Public keys for each hop [bob, carol, dave] (hex strings)
        route_privkeys: Private keys for each hop (hex strings, for peeling)
        hops_data: Per-hop forwarding data (list of dicts with
                   'amt_to_forward_msat', 'outgoing_cltv_value', 'short_channel_id')
        payment_hash: 32-byte payment hash (used as associated data)

    Returns dict:
        'packet_size': int (total onion packet size in bytes)
        'hops': list of dicts, one per hop:
            'node': str (hop index label: "hop_0", "hop_1", ...)
            'payload_valid': bool
            'amt_to_forward': int
            'outgoing_cltv': int
            'is_final': bool
        'success': bool (True if all hops process correctly and final hop is reached)
    """
    # TODO: Implement the complete payment trace
    pass
`,
    testCode: `
import hashlib

# ─── Canonical trace: Alice -> Bob -> Carol -> Dave ───
session_key_hex = "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6"

bob_pubkey = "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f"
carol_pubkey = "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a"
dave_pubkey = "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738"

bob_privkey = "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605"
carol_privkey = "caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50"
dave_privkey = "684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e"

route_pubkeys = [bob_pubkey, carol_pubkey, dave_pubkey]
route_privkeys = [bob_privkey, carol_privkey, dave_privkey]

hops_data = [
    {'amt_to_forward_msat': 50_003_000, 'outgoing_cltv_value': 700_048, 'short_channel_id': '700000x2x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': '700000x3x0'},
    {'amt_to_forward_msat': 50_000_000, 'outgoing_cltv_value': 700_018, 'short_channel_id': ''},
]

payment_hash = bytes.fromhex("27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8")

result = trace_payment(session_key_hex, route_pubkeys, route_privkeys, hops_data, payment_hash)

# ─── Test 1: Result has required keys ───
assert 'packet_size' in result, "Result must have 'packet_size'"
assert 'hops' in result, "Result must have 'hops'"
assert 'success' in result, "Result must have 'success'"

# ─── Test 2: Packet size is 1366 bytes ───
assert result['packet_size'] == 1366, \\
    f"Onion packet should be 1366 bytes, got {result['packet_size']}"

# ─── Test 3: Correct number of hops ───
assert len(result['hops']) == 3, f"Expected 3 hops, got {len(result['hops'])}"

# ─── Test 4: Bob's payload (hop 0) ───
bob_hop = result['hops'][0]
assert bob_hop['amt_to_forward'] == 50_003_000, \\
    f"Bob should forward 50,003,000 msat, got {bob_hop['amt_to_forward']}"
assert bob_hop['outgoing_cltv'] == 700_048, \\
    f"Bob's outgoing CLTV should be 700,048, got {bob_hop['outgoing_cltv']}"
assert bob_hop['is_final'] == False, "Bob should not be the final hop"
assert bob_hop['payload_valid'] == True, f"Bob's payload should be valid"

# ─── Test 5: Carol's payload (hop 1) ───
carol_hop = result['hops'][1]
assert carol_hop['amt_to_forward'] == 50_000_000, \\
    f"Carol should forward 50,000,000 msat, got {carol_hop['amt_to_forward']}"
assert carol_hop['outgoing_cltv'] == 700_018, \\
    f"Carol's outgoing CLTV should be 700,018, got {carol_hop['outgoing_cltv']}"
assert carol_hop['is_final'] == False, "Carol should not be the final hop"
assert carol_hop['payload_valid'] == True, f"Carol's payload should be valid"

# ─── Test 6: Dave's payload (hop 2, final) ───
dave_hop = result['hops'][2]
assert dave_hop['amt_to_forward'] == 50_000_000, \\
    f"Dave should receive 50,000,000 msat, got {dave_hop['amt_to_forward']}"
assert dave_hop['outgoing_cltv'] == 700_018, \\
    f"Dave's CLTV should be 700,018, got {dave_hop['outgoing_cltv']}"
assert dave_hop['is_final'] == True, "Dave should be the final hop"
assert dave_hop['payload_valid'] == True, f"Dave's payload should be valid"

# ─── Test 7: Overall success ───
assert result['success'] == True, "Payment trace should succeed"

# ─── Test 8: All payloads valid ───
for i, hop in enumerate(result['hops']):
    assert hop['payload_valid'] == True, f"Hop {i} payload should be valid"

# ─── Test 9: Only the last hop is final ───
for i, hop in enumerate(result['hops'][:-1]):
    assert hop['is_final'] == False, f"Hop {i} should not be final"
assert result['hops'][-1]['is_final'] == True, "Last hop should be final"

print("All payment trace tests passed!")
print(f"  Packet size: {result['packet_size']} bytes")
for i, hop in enumerate(result['hops']):
    node_name = ["Bob", "Carol", "Dave"][i]
    final_str = " (FINAL)" if hop['is_final'] else ""
    print(f"  {node_name}: amt={hop['amt_to_forward']:>12,} msat, cltv={hop['outgoing_cltv']}{final_str}")
print(f"  Success: {result['success']}")
`,
    hints: {
      conceptual:
        '<strong>Goal</strong>: Orchestrate the complete onion routing lifecycle in a single function: build the packet, peel it at each hop, parse payloads, and verify the trace.<br><br>' +
        '<strong>Key insight</strong>: You already know how to do every individual step. This exercise is about connecting them in the right order. The builder creates the packet, then each processor peels one layer and passes the next packet forward.<br><br>' +
        '<strong>Components you\'ll use</strong>:<br>' +
        '- <code>SphinxPacketBuilder(session_key_hex, route_pubkeys)</code> to build the onion<br>' +
        '- <code>SphinxPacketProcessor(privkey_hex)</code> at each hop to peel<br>' +
        '- TLV parsing to extract <code>amt_to_forward</code> and <code>outgoing_cltv</code> from each hop\'s payload',
      steps:
        '<strong>Step 1: Build the packet</strong><br>' +
        '- Create a <code>SphinxPacketBuilder</code> with <code>session_key_hex</code> and <code>route_pubkeys</code><br>' +
        '- Call <code>builder.construct_packet(hops_data, payment_hash)</code> to get the 1,366-byte onion packet<br><br>' +
        '<strong>Step 2: Record the packet size</strong><br>' +
        '- Store <code>len(packet)</code> for the result<br><br>' +
        '<strong>Step 3: Peel at each hop</strong><br>' +
        '- Set <code>current_packet = packet</code><br>' +
        '- For each hop index <code>i</code>: create <code>SphinxPacketProcessor(route_privkeys[i])</code> and call <code>peel_layer(current_packet, payment_hash)</code><br><br>' +
        '<strong>Step 4: Parse each payload</strong><br>' +
        '- From the returned <code>hop_payload</code>: read the bigsize length byte at position 0, extract TLV records from position 1 onward<br>' +
        '- Parse TLV records in a loop: type (1 byte), length (1 byte), value<br>' +
        '- Type 2 = amt_to_forward, Type 4 = outgoing_cltv (both decoded with <code>int.from_bytes(v, "big")</code>)<br><br>' +
        '<strong>Step 5: Verify and collect</strong><br>' +
        '- Compare parsed amt and cltv with <code>hops_data[i]</code> to set <code>payload_valid</code><br>' +
        '- Set <code>current_packet = peel_result["next_packet"]</code> for the next iteration<br><br>' +
        '<strong>Step 6: Return</strong><br>' +
        '- <code>success</code> is True if all payloads are valid and the last hop is final',
      code: `def trace_payment(session_key_hex, route_pubkeys, route_privkeys, hops_data, payment_hash):
    # Step 1: Build the onion packet
    builder = SphinxPacketBuilder(session_key_hex, route_pubkeys)
    packet = builder.construct_packet(hops_data, payment_hash)

    # Step 2: Record packet size
    packet_size = len(packet)

    # Step 3-5: Peel at each hop
    hops = []
    current_packet = packet
    all_valid = True

    for i in range(len(route_privkeys)):
        processor = SphinxPacketProcessor(route_privkeys[i])
        peel_result = processor.peel_layer(current_packet, payment_hash)

        # Parse the TLV payload
        payload = peel_result['hop_payload']
        length = payload[0]
        tlv_data = payload[1:1 + length]
        pos = 0
        fields = {}
        while pos < len(tlv_data):
            t = tlv_data[pos]; pos += 1
            l = tlv_data[pos]; pos += 1
            v = tlv_data[pos:pos + l]; pos += l
            fields[t] = v

        amt = int.from_bytes(fields[2], 'big')
        cltv = int.from_bytes(fields[4], 'big')

        # Verify against expected
        payload_valid = (amt == hops_data[i]['amt_to_forward_msat'] and
                        cltv == hops_data[i]['outgoing_cltv_value'])
        if not payload_valid:
            all_valid = False

        hops.append({
            'node': f'hop_{i}',
            'payload_valid': payload_valid,
            'amt_to_forward': amt,
            'outgoing_cltv': cltv,
            'is_final': peel_result['is_final'],
        })

        # Advance to next packet
        current_packet = peel_result['next_packet']

    # Step 6: Return summary
    return {
        'packet_size': packet_size,
        'hops': hops,
        'success': all_valid and hops[-1]['is_final'],
    }`,
    },
    rewardSats: 42,
    group: "sphinx/capstone",
    groupOrder: 0,
  },
};
