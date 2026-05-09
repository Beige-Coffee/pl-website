// ─── Onion Routing Exercise Definitions ──────────────────────────────────────
//
// Each exercise has starter code, test code, hints, and metadata.
// Exercises are keyed by ID and referenced from tutorial markdown via
// <code-intro exercises="..."> tags.
//
// Exercises are added chapter-by-chapter. The 10 planned exercises:
//
// crypto/keys.py
//   - exercise-derive-keys-draft                     [Ch 4]
//
// sphinx/builder.py
//   - exercise-derive-shared-secrets-draft           [Ch 3]
//   - exercise-generate-filler-draft                 [Ch 6]
//   - exercise-wrap-hop-draft                        [Ch 7]
//   - exercise-build-packet-draft                    [Ch 7]
//
// sphinx/forwarder.py
//   - exercise-peel-layer-draft                      [Ch 8]
//   - exercise-process-onion-draft                   [Ch 9]
//
// sphinx/errors.py
//   - exercise-build-error-onion-draft               [Ch 10]
//   - exercise-decrypt-error-onion-draft             [Ch 10]
//
// (Chapter 11–12 capstones are integrations, not new exercises.)

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
  group: string;
  groupOrder: number;
}

export const ONION_ROUTING_EXERCISES_DRAFT: Record<string, CodeExerciseData> = {

  "exercise-derive-keys-draft": {
    id: "exercise-derive-keys-draft",
    title: "Derive the Per-Hop Keys",
    description:
      "Implement <code>derive_keys(shared_secret) -> KeyMaterial</code>. Given a 32-byte shared secret, return the five named keys (<code>rho</code>, <code>mu</code>, <code>um</code>, <code>pad</code>, <code>ammag</code>) defined by BOLT 4. " +
      "Each key is computed as <code>HMAC-SHA256(key=ASCII label, msg=shared_secret)</code> and is exactly 32 bytes long. The <code>KeyMaterial</code> dataclass is provided as a small named container.",
    starterCode: `import hmac, hashlib
from dataclasses import dataclass

@dataclass
class KeyMaterial:
    rho: bytes
    mu: bytes
    um: bytes
    pad: bytes
    ammag: bytes

def derive_keys(shared_secret: bytes) -> KeyMaterial:
    """
    Expand a 32-byte shared secret into the five named keys per BOLT 4.

    Each key is HMAC-SHA256(key=name_bytes, msg=shared_secret), where name_bytes
    is the ASCII bytes of the label (e.g. b"rho").

    Returns a KeyMaterial with all five keys filled in.
    """
    # TODO: implement
    pass
`,
    testCode: `import hmac, hashlib

# Test vector: a deterministic 32-byte shared secret.
SS = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

def reference(name, ss):
    return hmac.new(name, ss, hashlib.sha256).digest()

def test_returns_keymaterial():
    out = derive_keys(SS)
    assert isinstance(out, KeyMaterial), "Expected a KeyMaterial dataclass"

def test_all_keys_are_32_bytes():
    out = derive_keys(SS)
    for name in ("rho", "mu", "um", "pad", "ammag"):
        k = getattr(out, name)
        assert isinstance(k, (bytes, bytearray)), f"{name} must be bytes"
        assert len(k) == 32, f"{name} must be exactly 32 bytes, got {len(k)}"

def test_keys_match_reference():
    out = derive_keys(SS)
    assert out.rho == reference(b"rho", SS), "rho doesn't match HMAC-SHA256(b'rho', ss)"
    assert out.mu == reference(b"mu", SS), "mu doesn't match HMAC-SHA256(b'mu', ss)"
    assert out.um == reference(b"um", SS), "um doesn't match HMAC-SHA256(b'um', ss)"
    assert out.pad == reference(b"pad", SS), "pad doesn't match HMAC-SHA256(b'pad', ss)"
    assert out.ammag == reference(b"ammag", SS), "ammag doesn't match HMAC-SHA256(b'ammag', ss)"

def test_keys_are_distinct():
    """Domain separation: every key should be different from every other key."""
    out = derive_keys(SS)
    keys = [out.rho, out.mu, out.um, out.pad, out.ammag]
    seen = set()
    for k in keys:
        assert k not in seen, "Two derived keys collided; check that you're using the right label for each"
        seen.add(k)

def test_different_secrets_produce_different_keys():
    """Sanity: a different shared secret should produce different output."""
    other_ss = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
    a = derive_keys(SS)
    b = derive_keys(other_ss)
    assert a.rho != b.rho
    assert a.mu  != b.mu
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> map one 32-byte shared secret to five 32-byte keys, each tagged with a different ASCII label." +
        "<br><br><strong>Why HMAC:</strong> HMAC-SHA256 acts as a pseudorandom function: changing either input (key OR message) gives an output that looks statistically uncorrelated with the original. So HMAC(b'rho', ss) and HMAC(b'mu', ss) are independent-looking even though they share the same ss." +
        "<br><br><strong>Argument order matters:</strong> the BOLT 4 construction puts the label as the HMAC key and the shared secret as the message. <code>hmac.new(key, msg, digestmod)</code> takes them in that order.",
      steps:
        "<strong>Imports already done:</strong> hmac, hashlib, and the KeyMaterial dataclass are in scope." +
        "<br><br>For each of the five labels (rho, mu, um, pad, ammag):" +
        "<br>1. Encode the label to bytes: <code>b\"rho\"</code> etc." +
        "<br>2. Compute <code>hmac.new(label_bytes, shared_secret, hashlib.sha256).digest()</code>." +
        "<br><br>Pack the five 32-byte values into a KeyMaterial(rho=..., mu=..., ...) and return it.",
      code:
        `def derive_keys(shared_secret):
    def k(name):
        return hmac.new(name, shared_secret, hashlib.sha256).digest()
    return KeyMaterial(
        rho=k(b"rho"),
        mu=k(b"mu"),
        um=k(b"um"),
        pad=k(b"pad"),
        ammag=k(b"ammag"),
    )`,
    },
    rewardSats: 30,
    group: "crypto/keys",
    groupOrder: 1,
  },

  "exercise-build-error-onion-draft": {
    id: "exercise-build-error-onion-draft",
    title: "Build the Error Onion (Failing Hop)",
    description:
      "Implement <code>build_error_onion</code>. Given a failure message and the failing hop's <code>um</code> + <code>ammag</code> keys, produce the 292-byte BOLT 4 error packet. " +
      "Per BOLT 4 'Failure Messages', the unencrypted payload is " +
      "<code>[u16:failure_len][failure_len:failure_message][u16:pad_len][pad_len:zeros]</code> " +
      "where <code>failure_len + pad_len == 256</code>. The 32-byte HMAC over this 260-byte payload prepends, then the whole 292-byte packet is XORed with the <code>ammag</code> keystream.",
    starterCode: `import hmac, hashlib

# BOLT 4 error packet layout:
#   [32 bytes: hmac]
#   [u16 BE:  failure_len]
#   [failure_len bytes: failure_message]
#   [u16 BE:  pad_len]
#   [pad_len bytes: zeros]
# with failure_len + pad_len == 256, so the encrypted region is always 260 bytes.
# Total packet size = 32 (hmac) + 260 (payload) = 292 bytes.
ERROR_PACKET_SIZE = 292

def build_error_onion(failure_message, um_key, ammag_key):
    """
    Build the failing hop's encrypted error packet (BOLT 4 'Failure Messages').

    Args:
      failure_message: bytes, must be <= 256 bytes
      um_key:          32-byte 'um' key for this hop
      ammag_key:       32-byte 'ammag' key for this hop

    Returns:
      292 bytes: (hmac || payload) XOR chacha20_keystream(ammag, 292)

    Algorithm (BOLT 4):
      1. failure_len = len(failure_message); pad_len = 256 - failure_len.
      2. payload = u16_be(failure_len) || failure_message || u16_be(pad_len) || zeros(pad_len).
         (Length is exactly 2 + failure_len + 2 + pad_len = 260 bytes.)
      3. error_hmac = HMAC-SHA256(um_key, payload).
      4. error_packet = error_hmac (32 bytes) || payload (260 bytes), 292 bytes total.
      5. wrapped = error_packet XOR chacha20_keystream(ammag_key, 292).

    Helpers in scope: chacha20_keystream, xor_bytes.
    """
    # TODO: implement
    pass
`,
    testCode: `import hmac, hashlib

UM = bytes.fromhex("aa" * 32)
AMMAG = bytes.fromhex("bb" * 32)

def reference(msg, um, ammag):
    failure_len = len(msg)
    pad_len = 256 - failure_len
    payload = failure_len.to_bytes(2, 'big') + msg + pad_len.to_bytes(2, 'big') + b"\\x00" * pad_len
    assert len(payload) == 260
    h = hmac.new(um, payload, hashlib.sha256).digest()
    pkt = h + payload
    stream = chacha20_keystream(ammag, 292)
    return xor_bytes(pkt, stream)

def test_returns_292_bytes():
    out = build_error_onion(b"temporary_channel_failure", UM, AMMAG)
    assert isinstance(out, (bytes, bytearray))
    assert len(out) == 292, f"Expected 292 bytes, got {len(out)}"

def test_matches_reference():
    msg = b"temporary_channel_failure"
    out = build_error_onion(msg, UM, AMMAG)
    expected = reference(msg, UM, AMMAG)
    assert out == expected, "Wrapped error doesn't match BOLT 4 reference"

def test_round_trip_decrypts_to_length_prefixed_payload():
    """Decrypting with ammag must reveal [u16:failure_len][msg][u16:pad_len][zeros] structure."""
    msg = b"channel_disabled"
    wrapped = build_error_onion(msg, UM, AMMAG)
    stream = chacha20_keystream(AMMAG, 292)
    decrypted = xor_bytes(wrapped, stream)
    failure_len = int.from_bytes(decrypted[32:34], 'big')
    assert failure_len == len(msg), f"failure_len must equal {len(msg)}, got {failure_len}"
    assert decrypted[34:34 + failure_len] == msg, "failure_message must follow failure_len"
    pad_len = int.from_bytes(decrypted[34 + failure_len:36 + failure_len], 'big')
    assert pad_len == 256 - failure_len, f"pad_len must be 256 - failure_len, got {pad_len}"
    assert decrypted[36 + failure_len:36 + failure_len + pad_len] == b"\\x00" * pad_len, "padding must be zeros"
    # HMAC must verify over the 260-byte payload
    expected_hmac = hmac.new(UM, decrypted[32:], hashlib.sha256).digest()
    assert decrypted[:32] == expected_hmac, "HMAC must verify over the full length-prefixed payload"

def test_short_message_padded_to_constant_size():
    """All errors are 292 bytes regardless of failure_message length."""
    out_short = build_error_onion(b"x", UM, AMMAG)
    out_long = build_error_onion(b"y" * 200, UM, AMMAG)
    assert len(out_short) == 292
    assert len(out_long) == 292

def test_known_failure_codes():
    """BOLT 4 failure codes (sender uses these to identify the failure type)."""
    # 0x1007 = temporary_channel_failure (encoded with channel_update; here just the code)
    out = build_error_onion(bytes.fromhex("1007"), UM, AMMAG)
    assert len(out) == 292
    # 0x400F = incorrect_or_unknown_payment_details (followed by amount + height in real usage)
    out = build_error_onion(bytes.fromhex("400f"), UM, AMMAG)
    assert len(out) == 292
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> build the BOLT 4-format encrypted error packet from the failing hop's perspective." +
        "<br><br><strong>Why fixed 292 bytes:</strong> all error onions are the same size regardless of failure code, so observers can't infer the failure type from packet length." +
        "<br><br><strong>Why length-prefixed:</strong> BOLT 4 encodes the failure message with an explicit u16 length, then a u16 pad length, then padding. This unambiguously delimits the message even when it contains zero bytes (some failure codes carry binary data like channel_update bytes, which can have zero bytes anywhere). 'Strip trailing zeros' would corrupt those.",
      steps:
        "<strong>1. Compute lengths:</strong> <code>failure_len = len(failure_message)</code>; <code>pad_len = 256 - failure_len</code>." +
        "<br><strong>2. Build the 260-byte payload:</strong>" +
        "<br>&nbsp;&nbsp;&nbsp;<code>payload = failure_len.to_bytes(2, 'big') + failure_message + pad_len.to_bytes(2, 'big') + b'\\x00' * pad_len</code>." +
        "<br><strong>3. HMAC the payload:</strong> <code>tag = hmac.new(um_key, payload, hashlib.sha256).digest()</code>." +
        "<br><strong>4. Concatenate:</strong> <code>packet = tag + payload</code> (32 + 260 = 292 bytes)." +
        "<br><strong>5. Encrypt:</strong> <code>stream = chacha20_keystream(ammag_key, 292)</code>; return <code>xor_bytes(packet, stream)</code>.",
      code:
        `def build_error_onion(failure_message, um_key, ammag_key):
    failure_len = len(failure_message)
    pad_len = 256 - failure_len
    payload = (
        failure_len.to_bytes(2, "big") + failure_message +
        pad_len.to_bytes(2, "big") + b"\\x00" * pad_len
    )
    tag = hmac.new(um_key, payload, hashlib.sha256).digest()
    packet = tag + payload
    stream = chacha20_keystream(ammag_key, 292)
    return xor_bytes(packet, stream)`,
    },
    rewardSats: 50,
    group: "sphinx/errors",
    groupOrder: 1,
  },

  "exercise-decrypt-error-onion-draft": {
    id: "exercise-decrypt-error-onion-draft",
    title: "Decrypt the Error Onion (Sender Side)",
    description:
      "Implement <code>decrypt_error_onion</code>. Given the wrapped 292-byte error packet and a chain of <code>(um, ammag)</code> per-hop keys in route order, peel layers one at a time, identify which hop generated the error, and parse the BOLT 4 length-prefixed payload to recover the <code>failure_message</code>.",
    starterCode: `import hmac, hashlib

def decrypt_error_onion(wrapped_error, hop_keys):
    """
    Args:
      wrapped_error: 292-byte error blob received on the return HTLC
      hop_keys:      list of (um, ammag) tuples per hop, in route order
                     hop_keys[0] is the first forwarder, last is the destination

    Returns:
      (failing_hop_index, failure_message) if a layer's HMAC verifies
      (None, None) if no layer matched (the error was tampered with)

    Algorithm (BOLT 4):
      For each i in range(len(hop_keys)):
        wrapped = wrapped XOR chacha20_keystream(ammag_i, 292)
        if HMAC-SHA256(um_i, wrapped[32:]) == wrapped[:32]:
            payload    = wrapped[32:]                          # 260 bytes
            failure_len = int.from_bytes(payload[0:2], 'big')
            failure_msg = payload[2:2 + failure_len]
            return (i, failure_msg)
      return (None, None)
    """
    # TODO: implement
    pass
`,
    testCode: `import hmac, hashlib

def reference_build(msg, um, ammag):
    failure_len = len(msg)
    pad_len = 256 - failure_len
    payload = failure_len.to_bytes(2, 'big') + msg + pad_len.to_bytes(2, 'big') + b"\\x00" * pad_len
    pkt = hmac.new(um, payload, hashlib.sha256).digest() + payload
    return xor_bytes(pkt, chacha20_keystream(ammag, 292))

UM_BOB    = bytes.fromhex("01" * 32)
AMMAG_BOB = bytes.fromhex("02" * 32)
UM_CAROL    = bytes.fromhex("03" * 32)
AMMAG_CAROL = bytes.fromhex("04" * 32)
UM_DAVE    = bytes.fromhex("05" * 32)
AMMAG_DAVE = bytes.fromhex("06" * 32)

HOP_KEYS = [(UM_BOB, AMMAG_BOB), (UM_CAROL, AMMAG_CAROL), (UM_DAVE, AMMAG_DAVE)]

def wrap_through_route(originating_hop_index, msg):
    """Simulate the failing hop building the error, then upstream forwarders wrapping it."""
    um, ammag = HOP_KEYS[originating_hop_index]
    wrapped = reference_build(msg, um, ammag)
    for i in range(originating_hop_index - 1, -1, -1):
        _, ammag_up = HOP_KEYS[i]
        wrapped = xor_bytes(wrapped, chacha20_keystream(ammag_up, 292))
    return wrapped

def test_carol_failure_identified():
    msg = b"temporary_channel_failure"
    wrapped = wrap_through_route(originating_hop_index=1, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 1, f"Expected failing hop index 1 (Carol), got {idx}"
    assert recovered == msg, f"Recovered message must equal '{msg.decode()}', got {recovered!r}"

def test_bob_failure_identified():
    msg = b"fee_insufficient"
    wrapped = wrap_through_route(originating_hop_index=0, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 0, f"Expected failing hop index 0 (Bob), got {idx}"
    assert recovered == msg

def test_dave_failure_identified():
    msg = b"incorrect_or_unknown_payment_details"
    wrapped = wrap_through_route(originating_hop_index=2, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 2, f"Expected failing hop index 2 (Dave), got {idx}"
    assert recovered == msg

def test_failure_with_internal_zero_bytes():
    """BOLT 4 length-prefixed format must correctly recover messages containing zero bytes
    (e.g., binary failure data with channel_update bytes). 'Strip trailing zeros' would corrupt this."""
    msg = bytes.fromhex("1007") + b"\\x00\\x00binary\\x00\\x00data"
    wrapped = wrap_through_route(originating_hop_index=0, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 0
    assert recovered == msg, "Length prefix must preserve internal zero bytes"

def test_tampered_returns_none():
    """Random bytes of the right length but no valid HMAC anywhere."""
    wrapped = bytes(292)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx is None and recovered is None
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> Alice's view of the return path. She has all the (um, ammag) keys; she just doesn't know which layer the failing hop wrapped with. Solution: try each layer in order until one's HMAC verifies, then parse the length prefix to recover the message." +
        "<br><br><strong>Order:</strong> peel from outermost to innermost, which is hop 0, hop 1, hop 2 (the first forwarder is the outermost wrapper because their wrap was applied most recently during the return trip)." +
        "<br><br><strong>Why parse the u16 length:</strong> failure messages can contain zero bytes (e.g., binary <code>channel_update</code> data attached to <code>temporary_channel_failure</code>). Stripping trailing zeros would corrupt those messages. The explicit u16 failure_len at the front of the decrypted payload tells us the exact byte boundary.",
      steps:
        "<strong>For each i in range(len(hop_keys)):</strong>" +
        "<br>1. <code>um, ammag = hop_keys[i]</code>." +
        "<br>2. <code>wrapped = xor_bytes(wrapped, chacha20_keystream(ammag, 292))</code> (peel this layer)." +
        "<br>3. <code>tag, payload = wrapped[:32], wrapped[32:]</code>." +
        "<br>4. <code>expected = hmac.new(um, payload, hashlib.sha256).digest()</code>." +
        "<br>5. If <code>tag == expected</code>: this is the failing hop. Parse the length:" +
        "<br>&nbsp;&nbsp;&nbsp;<code>failure_len = int.from_bytes(payload[0:2], 'big')</code>" +
        "<br>&nbsp;&nbsp;&nbsp;<code>failure_msg = payload[2:2 + failure_len]</code>" +
        "<br>&nbsp;&nbsp;&nbsp;<code>return (i, failure_msg)</code>." +
        "<br><br>If the loop ends with no match, return <code>(None, None)</code>.",
      code:
        `def decrypt_error_onion(wrapped_error, hop_keys):
    wrapped = wrapped_error
    for i, (um, ammag) in enumerate(hop_keys):
        wrapped = xor_bytes(wrapped, chacha20_keystream(ammag, 292))
        tag = wrapped[:32]
        payload = wrapped[32:]
        if hmac.new(um, payload, hashlib.sha256).digest() == tag:
            failure_len = int.from_bytes(payload[0:2], "big")
            return i, payload[2:2 + failure_len]
    return None, None`,
    },
    rewardSats: 75,
    group: "sphinx/errors",
    groupOrder: 2,
  },

  "exercise-verify-hmac-draft": {
    id: "exercise-verify-hmac-draft",
    title: "Verify the HMAC",
    description:
      "Implement <code>verify_hmac(packet, mu, associated_data) -> bool</code>. Given a 1366-byte BOLT 4 onion packet, this hop's <code>mu</code> key (32 bytes), and the 32-byte <code>associated_data</code> (payment_hash), recompute <code>HMAC-SHA256(mu, hop_payloads || associated_data)</code> and compare it against the packet's last 32 bytes (the HMAC field). " +
      "Return <code>True</code> if the comparison succeeds, <code>False</code> otherwise. Use <code>hmac.compare_digest</code> for a constant-time compare to avoid leaking timing information about which byte didn't match.",
    starterCode: `import hmac, hashlib

def verify_hmac(packet, mu, associated_data):
    """
    Verify the integrity tag on an inbound BOLT 4 onion packet.

    Args:
      packet:           1366-byte BOLT 4 onion packet
                        (1 version + 33 E_i + 1300 hop_payloads + 32 hmac)
      mu:               this hop's 32-byte mu key (HMAC-SHA256(b"mu", ss_i))
      associated_data:  32-byte payment_hash bound into the HMAC by the sender

    Returns: True if the HMAC verifies, False otherwise.

    Steps:
      1. Length check: packet must be exactly 1366 bytes. Return False if not.
      2. Slice the hop_payloads field: packet[34:1334] (1300 bytes).
      3. Slice the inbound HMAC: packet[1334:1366] (32 bytes).
      4. Compute expected = HMAC-SHA256(mu, hop_payloads || associated_data).
      5. Return hmac.compare_digest(expected, inbound_hmac).
    """
    # TODO: implement
    pass
`,
    testCode: `# Build a packet with a known mu and associated_data so we know the
# expected HMAC. Then test the function on the well-formed packet AND
# a tampered version.

MU = bytes.fromhex("0202020202020202020202020202020202020202020202020202020202020202")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
HOP_PAYLOADS = bytes(range(1, 1301))  # 1,300 arbitrary bytes
EPHEMERAL_PUBKEY = bytes(range(33))   # 33 arbitrary bytes

# Compute the HMAC the way Alice would have during construction.
expected_hmac = hmac.new(MU, HOP_PAYLOADS + PAYMENT_HASH, hashlib.sha256).digest()
GOOD_PACKET = b"\\x00" + EPHEMERAL_PUBKEY + HOP_PAYLOADS + expected_hmac
assert len(GOOD_PACKET) == 1366

def test_well_formed_packet_verifies():
    assert verify_hmac(GOOD_PACKET, MU, PAYMENT_HASH) is True

def test_tampered_hop_payloads_fails():
    # Flip a byte in the hop_payloads field.
    tampered = bytearray(GOOD_PACKET)
    tampered[100] ^= 0x01
    assert verify_hmac(bytes(tampered), MU, PAYMENT_HASH) is False

def test_tampered_hmac_fails():
    # Flip a byte in the HMAC field.
    tampered = bytearray(GOOD_PACKET)
    tampered[-1] ^= 0x01
    assert verify_hmac(bytes(tampered), MU, PAYMENT_HASH) is False

def test_wrong_associated_data_fails():
    wrong_hash = bytes(32)
    assert verify_hmac(GOOD_PACKET, MU, wrong_hash) is False

def test_wrong_mu_fails():
    wrong_mu = bytes(32)
    assert verify_hmac(GOOD_PACKET, wrong_mu, PAYMENT_HASH) is False

def test_short_packet_returns_false():
    short = GOOD_PACKET[:1000]
    assert verify_hmac(short, MU, PAYMENT_HASH) is False
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> recompute the HMAC tag the sender baked into the packet and compare it against the inbound HMAC field." +
        "<br><br><strong>Why this is the first thing the forwarder does:</strong> if the HMAC doesn't verify, we don't trust any of the bytes in the packet. We don't decrypt, we don't parse the TLV, we don't run any of our parser code on adversarial input. Encrypt-then-MAC means we authenticate the encrypted ciphertext as it appears on the wire, before anything else." +
        "<br><br><strong>Why associated_data is part of the HMAC:</strong> the payment_hash binds the onion to a specific HTLC. An attacker can't lift this onion off one HTLC and re-attach it to another, since the HMAC won't verify with a different payment_hash.",
      steps:
        "<strong>1. Length check:</strong> if <code>len(packet) != 1366</code>, return <code>False</code>." +
        "<br><strong>2. Slice the fields:</strong>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>hop_payloads = packet[34:1334]</code>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>inbound_hmac = packet[1334:1366]</code>" +
        "<br><strong>3. Compute expected HMAC:</strong>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>expected = hmac.new(mu, hop_payloads + associated_data, hashlib.sha256).digest()</code>" +
        "<br><strong>4. Constant-time compare:</strong> <code>return hmac.compare_digest(expected, inbound_hmac)</code>.",
      code:
        `import hmac, hashlib

def verify_hmac(packet, mu, associated_data):
    if len(packet) != 1366:
        return False
    hop_payloads = packet[34:1334]
    inbound_hmac = packet[1334:1366]
    expected = hmac.new(mu, hop_payloads + associated_data, hashlib.sha256).digest()
    return hmac.compare_digest(expected, inbound_hmac)
`,
    },
    rewardSats: 100,
    group: "forwarder",
    groupOrder: 2,
  },

  "exercise-process-onion-draft": {
    id: "exercise-process-onion-draft",
    title: "Process an Inbound Onion",
    description:
      "Implement <code>OnionForwarder.process</code>. Verify length/version, verify the HMAC over <code>(hop_payloads || associated_data)</code>, peel the layer, parse the TLV, and return a <code>ForwardInstruction</code> (forwarder), <code>FinalDelivery</code> (destination), or <code>Rejection</code> (anything wrong). " +
      "Use the <code>ProcessResult</code> dataclasses provided. Skip economic fee/CLTV validation; return <code>ForwardInstruction</code> or <code>FinalDelivery</code> once the payload structure parses correctly.",
    starterCode: `from dataclasses import dataclass

@dataclass
class ForwardInstruction:
    next_packet: bytes
    short_channel_id: bytes
    amt_to_forward_msat: int
    outgoing_cltv_value: int
    shared_secret: bytes  # for the error path

@dataclass
class FinalDelivery:
    amt_msat: int
    outgoing_cltv_value: int
    payment_data: bytes  # raw type-8 value; caller validates against invoice
    shared_secret: bytes

@dataclass
class Rejection:
    code: str
    shared_secret: bytes  # may be b"" if rejection happened before ECDH

class OnionForwarder:
    def process(self, packet, node_privkey, associated_data):
        """
        Process an inbound onion packet.

        Args:
          packet:           1366-byte BOLT 4 onion packet
          node_privkey:     this hop's 32-byte node private key
          associated_data:  32-byte payment_hash bound into the HMAC by the sender

        Steps:
          1. Length and version check.
          2. ECDH + HMAC verification over (hop_payloads || associated_data).
          3. Peel the layer (delegate to self.peel_layer).
          4. Parse the TLV payload bytes.
          5. Branch: forwarding (has type 6) vs final delivery (has type 8).

        Returns: ForwardInstruction | FinalDelivery | Rejection
        """
        # TODO: implement
        pass


def parse_tlv_records(payload_bytes):
    """
    Parse a bigsize-prefixed TLV payload into a {type: value_bytes} dict.

    The first bigsize prefix is the total TLV length; after that, each record
    is bigsize_type || bigsize_length || value_bytes.
    """
    total_len, header_len = parse_bigsize(payload_bytes, 0)
    records = {}
    pos = header_len
    end = header_len + total_len
    while pos < end:
        t, t_len = parse_bigsize(payload_bytes, pos)
        pos += t_len
        l, l_len = parse_bigsize(payload_bytes, pos)
        pos += l_len
        records[t] = bytes(payload_bytes[pos:pos + l])
        pos += l
    return records
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

# Reuse helpers from sphinx/builder.py exercises (in scope at runtime).
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CAROL_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CAROL_PUB = privkey_to_pubkey(CAROL_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)

# Build well-formed bigsize-prefixed TLVs.
def build_intermediate_tlv(amt_msat, cltv, scid):
    inner = (
        encode_bigsize(2) + encode_bigsize(3) + amt_msat.to_bytes(3, 'big') +
        encode_bigsize(4) + encode_bigsize(2) + cltv.to_bytes(2, 'big') +
        encode_bigsize(6) + encode_bigsize(8) + scid
    )
    return encode_bigsize(len(inner)) + inner

def build_final_tlv(amt_msat, cltv, payment_data):
    inner = (
        encode_bigsize(2) + encode_bigsize(3) + amt_msat.to_bytes(3, 'big') +
        encode_bigsize(4) + encode_bigsize(2) + cltv.to_bytes(2, 'big') +
        encode_bigsize(8) + encode_bigsize(len(payment_data)) + payment_data
    )
    return encode_bigsize(len(inner)) + inner

BOB_SCID   = bytes.fromhex("0102030405060708")
CAROL_SCID = bytes.fromhex("1112131415161718")
PAYMENT_DATA = bytes.fromhex("aa" * 32 + "0000000000989680")  # 32 secret + 8 total_msat

PAYLOADS = [
    build_intermediate_tlv(10_003_000, 260, BOB_SCID),
    build_intermediate_tlv(10_002_000, 220, CAROL_SCID),
    build_final_tlv(10_000_000, 140, PAYMENT_DATA),
]

def chain(session_key, hop_pubkeys):
    ek_list, ss_list = [], []
    e = session_key
    for pub in hop_pubkeys:
        E = privkey_to_pubkey(e)
        ss = ecdh(e, pub)
        b = hashlib.sha256(E + ss).digest()
        ek_list.append(E); ss_list.append(ss)
        e = scalar_mul(e, b)
    return ek_list, ss_list

def reference_build(session_key, hop_pubkeys, payloads, ad):
    """BOLT 4 build: pad-key noise initial buffer, filler-after-innermost-wrap,
    HMAC over (buffer || associated_data)."""
    ek_list, ss_list = chain(session_key, hop_pubkeys)
    rhos = [hmac.new(b"rho", ss, hashlib.sha256).digest() for ss in ss_list]
    mus  = [hmac.new(b"mu", ss, hashlib.sha256).digest() for ss in ss_list]
    pad_key = hmac.new(b"pad", session_key, hashlib.sha256).digest()

    sizes = [len(p) + 32 for p in payloads[:-1]]
    # Filler computation
    filler = b""
    for i in range(len(rhos) - 1):
        filler = filler + b"\\x00" * sizes[i]
        stream = chacha20_keystream(rhos[i], ROUTING_INFO_SIZE + sizes[i])
        filler = xor_bytes(filler, stream[ROUTING_INFO_SIZE + sizes[i] - len(filler):])

    buf = bytearray(chacha20_keystream(pad_key, ROUTING_INFO_SIZE))
    nhmac = b"\\x00" * 32
    n = len(payloads)
    for i in range(n - 1, -1, -1):
        slot = len(payloads[i]) + 32
        shifted = bytearray(slot) + buf[:-slot]
        shifted[:len(payloads[i])] = payloads[i]
        shifted[len(payloads[i]):len(payloads[i]) + 32] = nhmac
        stream = chacha20_keystream(rhos[i], ROUTING_INFO_SIZE)
        buf = bytearray(xor_bytes(bytes(shifted), stream))
        if i == n - 1:
            buf[ROUTING_INFO_SIZE - len(filler):ROUTING_INFO_SIZE] = filler
        nhmac = hmac.new(mus[i], bytes(buf) + ad, hashlib.sha256).digest()
    return b"\\x00" + ek_list[0] + bytes(buf) + nhmac

PACKET = reference_build(SESSION_KEY, [BOB_PUB, CAROL_PUB, DAVE_PUB], PAYLOADS, PAYMENT_HASH)

def test_forwarding_path_returns_forward_instruction():
    f = OnionForwarder()
    out = f.process(PACKET, BOB_PRIV, PAYMENT_HASH)
    assert isinstance(out, ForwardInstruction), f"Expected ForwardInstruction, got {type(out).__name__}"
    assert out.short_channel_id == BOB_SCID
    assert out.amt_to_forward_msat == 10_003_000
    assert out.outgoing_cltv_value == 260
    assert isinstance(out.shared_secret, (bytes, bytearray)) and len(out.shared_secret) == 32
    assert isinstance(out.next_packet, (bytes, bytearray)) and len(out.next_packet) == 1366

def test_destination_returns_final_delivery():
    """Peel through Bob and Carol; Dave should see FinalDelivery."""
    f = OnionForwarder()
    bob_out = f.process(PACKET, BOB_PRIV, PAYMENT_HASH)
    assert isinstance(bob_out, ForwardInstruction)
    carol_out = f.process(bob_out.next_packet, CAROL_PRIV, PAYMENT_HASH)
    assert isinstance(carol_out, ForwardInstruction)
    dave_out = f.process(carol_out.next_packet, DAVE_PRIV, PAYMENT_HASH)
    assert isinstance(dave_out, FinalDelivery), f"Dave should get FinalDelivery, got {type(dave_out).__name__}"
    assert dave_out.amt_msat == 10_000_000
    assert dave_out.outgoing_cltv_value == 140
    assert dave_out.payment_data == PAYMENT_DATA

def test_wrong_associated_data_returns_rejection():
    """Passing the wrong payment_hash must produce an HMAC mismatch (this is what
    binds the onion to a specific HTLC)."""
    f = OnionForwarder()
    bad_hash = bytes.fromhex("99" * 32)
    out = f.process(PACKET, BOB_PRIV, bad_hash)
    assert isinstance(out, Rejection), "Wrong associated_data must yield Rejection (invalid HMAC)"

def test_tampered_hmac_returns_rejection():
    f = OnionForwarder()
    tampered = bytearray(PACKET)
    tampered[1334] ^= 0xff  # flip a byte in the HMAC field
    out = f.process(bytes(tampered), BOB_PRIV, PAYMENT_HASH)
    assert isinstance(out, Rejection), f"Tampered HMAC should yield Rejection, got {type(out).__name__}"
    assert "hmac" in out.code.lower() or "invalid" in out.code.lower()

def test_wrong_version_returns_rejection():
    f = OnionForwarder()
    bad = b"\\x01" + PACKET[1:]
    out = f.process(bad, BOB_PRIV, PAYMENT_HASH)
    assert isinstance(out, Rejection)

def test_wrong_length_returns_rejection():
    f = OnionForwarder()
    out = f.process(PACKET[:-1], BOB_PRIV, PAYMENT_HASH)
    assert isinstance(out, Rejection)
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> tie peel + validation + parsing into a single function that returns one of three result types." +
        "<br><br><strong>Order matters:</strong> verify before decrypt. Length and version come first; HMAC verification comes before any peel work; peel before parse; parse before branch." +
        "<br><br><strong>HMAC includes associated_data:</strong> BOLT 4 requires the HMAC be computed over <code>hop_payloads || associated_data</code> where associated_data is the 32-byte payment_hash. This binds the onion to a specific HTLC. If a forwarder receives an onion attached to a different payment_hash, the HMAC mismatches and the onion is rejected." +
        "<br><br><strong>Branch on TLV contents:</strong> presence of type 6 (short_channel_id) means forwarder. Presence of type 8 (payment_data) without type 6 means destination. Anything else (both, neither) is malformed.",
      steps:
        "<strong>1. Reject if len != 1366 or packet[0] != 0:</strong> return <code>Rejection('invalid_onion_version', b'')</code>." +
        "<br><strong>2. Compute ss + mu:</strong> <code>ss = ecdh(node_privkey, packet[1:34])</code>; <code>mu = hmac.new(b'mu', ss, hashlib.sha256).digest()</code>." +
        "<br><strong>3. HMAC check (with associated_data):</strong> <code>expected = hmac.new(mu, packet[34:1334] + associated_data, hashlib.sha256).digest()</code>. If <code>expected != packet[1334:1366]</code>, return <code>Rejection('invalid_onion_hmac', ss)</code>." +
        "<br><strong>4. Peel:</strong> call <code>self.peel_layer(packet, node_privkey)</code>; unpack <code>(next_packet, payload_bytes, _)</code>." +
        "<br><strong>5. Parse:</strong> <code>records = parse_tlv_records(payload_bytes)</code>." +
        "<br><strong>6. Decode amt_to_forward + outgoing_cltv:</strong> <code>amt = int.from_bytes(records[2], 'big')</code> and similarly for type 4." +
        "<br><strong>7. Branch:</strong> if 6 in records, return ForwardInstruction; elif 8 in records, return FinalDelivery; else return Rejection('invalid_onion_payload', ss).",
      code:
        `def process(self, packet, node_privkey, associated_data):
    if len(packet) != 1366 or packet[0] != 0:
        return Rejection('invalid_onion_version', b'')
    E = packet[1:34]
    ss = ecdh(node_privkey, E)
    mu = hmac.new(b"mu", ss, hashlib.sha256).digest()
    expected = hmac.new(mu, packet[34:1334] + associated_data,
                        hashlib.sha256).digest()
    if expected != packet[1334:1366]:
        return Rejection('invalid_onion_hmac', ss)
    next_packet, payload_bytes, _ = self.peel_layer(packet, node_privkey)
    try:
        records = parse_tlv_records(payload_bytes)
        amt = int.from_bytes(records[2], 'big')
        cltv = int.from_bytes(records[4], 'big')
    except Exception:
        return Rejection('invalid_onion_payload', ss)
    if 6 in records:
        return ForwardInstruction(next_packet, records[6], amt, cltv, ss)
    if 8 in records:
        return FinalDelivery(amt, cltv, records[8], ss)
    return Rejection('invalid_onion_payload', ss)`,
    },
    rewardSats: 100,
    group: "sphinx/forwarder",
    groupOrder: 2,
  },

  "exercise-peel-layer-draft": {
    id: "exercise-peel-layer-draft",
    title: "Peel a Single Layer",
    description:
      "Implement <code>OnionForwarder.peel_layer</code>. Given a 1366-byte BOLT 4 onion packet and the forwarder's 32-byte node private key, return <code>(next_packet, payload_bytes, shared_secret)</code>. " +
      "Hop payloads in this exercise are prefixed with a bigsize length, so the slot size is <code>parse_bigsize(...)[0] + bigsize_header_size + 32</code> (HMAC). " +
      "Skip HMAC validation in this exercise; chapter 9 layers it on. Focus on the ECDH, the keystream-extended XOR, slot extraction, and ephemeral pubkey advancement.",
    starterCode: `class OnionForwarder:
    def peel_layer(self, packet, node_privkey):
        """
        Args:
          packet:        1366-byte BOLT 4 onion packet
                         (1 version + 33 E_i + 1300 hop_payloads + 32 hmac)
          node_privkey:  this forwarder's 32-byte node private key

        Returns: (next_packet, payload_bytes, shared_secret)
          next_packet:    1366-byte packet to forward to the next hop
          payload_bytes:  the bigsize-length-prefixed TLV payload bytes for THIS hop
                          (caller will parse it further)
          shared_secret:  32-byte ss_i this hop derived; useful for the error path

        Algorithm:
          1. Parse the inbound packet: version, E_i, hop_payloads, inbound_hmac.
          2. ss_i = ecdh(node_privkey, E_i)
          3. rho = HMAC-SHA256(b"rho", ss_i)
          4. Allocate a 2 * 1300 = 2600-byte working buffer:
             work = hop_payloads + b"\\x00" * 1300
          5. XOR work with chacha20_keystream(rho, 2600)
          6. Parse work[0:] as bigsize-prefixed payload: read bigsize, the payload
             is bigsize bytes after that, slot_size = bigsize_header_len + length + 32
          7. payload_bytes = work[0 : bigsize_header_len + length]
          8. next_hmac = work[slot_size - 32 : slot_size]
          9. next_hop_payloads = work[slot_size : slot_size + 1300]
          10. b_i = SHA256(E_i || ss_i)
          11. E_next = point_mul_pubkey(E_i, b_i)
          12. Return: (b"\\x00" + E_next + next_hop_payloads + next_hmac,
                       payload_bytes, ss_i)
        """
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

# Build a fixed test packet using a BOLT 4-spec reference encoder so we can verify peeling.
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CAROL_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CAROL_PUB = privkey_to_pubkey(CAROL_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CAROL_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CAROL_PRIV, DAVE_PRIV]

# Bigsize-prefixed TLV payloads (variable length so the test exercises the
# filler-after-innermost-wrap logic).
RAW_TLVS = [
    bytes.fromhex("0203989a900401b40608000000012345678920"),
    bytes.fromhex("0203989a900401b40608000000012345678921"),
    bytes.fromhex("0203989a90040181"),
]
PAYLOADS = [encode_bigsize(len(t)) + t for t in RAW_TLVS]

def chain(session_key, hop_pubkeys):
    ek_list, ss_list = [], []
    e = session_key
    for pub in hop_pubkeys:
        E = privkey_to_pubkey(e)
        ss = ecdh(e, pub)
        b = hashlib.sha256(E + ss).digest()
        ek_list.append(E)
        ss_list.append(ss)
        e = scalar_mul(e, b)
    return ek_list, ss_list

def reference_build(session_key, hop_pubkeys, payloads, ad):
    """BOLT 4 build: pad-key noise initial buffer, filler-after-innermost-wrap,
    HMAC over (buffer || associated_data)."""
    ek_list, ss_list = chain(session_key, hop_pubkeys)
    rhos = [hmac.new(b"rho", ss, hashlib.sha256).digest() for ss in ss_list]
    mus  = [hmac.new(b"mu", ss, hashlib.sha256).digest() for ss in ss_list]
    pad_key = hmac.new(b"pad", session_key, hashlib.sha256).digest()
    sizes = [len(p) + 32 for p in payloads[:-1]]

    # Filler
    filler = b""
    for i in range(len(rhos) - 1):
        filler = filler + b"\\x00" * sizes[i]
        stream = chacha20_keystream(rhos[i], ROUTING_INFO_SIZE + sizes[i])
        chunk = stream[ROUTING_INFO_SIZE + sizes[i] - len(filler):]
        filler = xor_bytes(filler, chunk)

    buf = bytearray(chacha20_keystream(pad_key, ROUTING_INFO_SIZE))
    nhmac = b"\\x00" * 32
    n = len(payloads)
    for i in range(n - 1, -1, -1):
        slot = len(payloads[i]) + 32
        shifted = bytearray(slot) + buf[:-slot]
        shifted[:len(payloads[i])] = payloads[i]
        shifted[len(payloads[i]):len(payloads[i]) + 32] = nhmac
        stream = chacha20_keystream(rhos[i], ROUTING_INFO_SIZE)
        buf = bytearray(xor_bytes(bytes(shifted), stream))
        if i == n - 1:
            buf[ROUTING_INFO_SIZE - len(filler):ROUTING_INFO_SIZE] = filler
        nhmac = hmac.new(mus[i], bytes(buf) + ad, hashlib.sha256).digest()

    return b"\\x00" + ek_list[0] + bytes(buf) + nhmac, ek_list, ss_list

PACKET, EK_LIST, SS_LIST = reference_build(SESSION_KEY, HOP_PUBKEYS, PAYLOADS, PAYMENT_HASH)

def test_returns_tuple_of_three():
    f = OnionForwarder()
    out = f.peel_layer(PACKET, BOB_PRIV)
    assert isinstance(out, tuple) and len(out) == 3, "Expected (next_packet, payload, ss)"

def test_recovers_bob_shared_secret():
    f = OnionForwarder()
    _, _, ss = f.peel_layer(PACKET, BOB_PRIV)
    assert ss == SS_LIST[0], "Bob's recovered shared secret must match the chain"

def test_extracts_bob_payload():
    f = OnionForwarder()
    _, payload, _ = f.peel_layer(PACKET, BOB_PRIV)
    assert payload == PAYLOADS[0], "Extracted payload must equal Bob's original bigsize-prefixed TLV"

def test_next_packet_size():
    f = OnionForwarder()
    next_packet, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    assert len(next_packet) == 1366, "Outgoing packet must be exactly 1366 bytes"

def test_next_ephemeral_advances():
    f = OnionForwarder()
    next_packet, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    assert next_packet[1:34] == EK_LIST[1], "Outgoing E must equal E_1 from the chain"

def test_carol_can_peel_next():
    """End-to-end: Bob's output is a valid input for Carol's peel."""
    f = OnionForwarder()
    bob_out, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    next_out, carol_payload, carol_ss = f.peel_layer(bob_out, CAROL_PRIV)
    assert carol_ss == SS_LIST[1], "Carol's recovered ss must match the chain"
    assert carol_payload == PAYLOADS[1], "Carol's payload must round-trip through the peel"

def test_dave_can_peel_after_carol():
    """Full route: peel through Bob, Carol, then Dave. Confirms the BOLT 4 build
    correctly accounts for Dave's slot size during filler placement."""
    f = OnionForwarder()
    bob_out, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    carol_out, _, _ = f.peel_layer(bob_out, CAROL_PRIV)
    _, dave_payload, dave_ss = f.peel_layer(carol_out, DAVE_PRIV)
    assert dave_ss == SS_LIST[2], "Dave's recovered ss must match the chain"
    assert dave_payload == PAYLOADS[2], "Dave's payload must round-trip through the peel"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> reverse the wrap_hop operation. Take a packet, derive the keys this hop needs, decrypt the buffer with an extended keystream, lift this hop's slot, and produce the packet to forward." +
        "<br><br><strong>Why the extended keystream:</strong> when this hop strips its slot off the front and shifts the inner contents forward, the trailing positions must contain the extension of this hop's rho<sub>i</sub> keystream. That's exactly what was XORed into the corresponding filler bytes during construction. By generating 2x the routing info size, we cover both the decrypted hop_payloads AND the keystream-extension that fills the gap.",
      steps:
        "<strong>1. Parse the packet:</strong>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>version = packet[0]</code>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>E_i = packet[1:34]</code>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>hop_payloads = packet[34:1334]</code>" +
        "<br>&nbsp;&nbsp;&nbsp;&nbsp;<code>inbound_hmac = packet[1334:1366]</code>" +
        "<br><strong>2. Derive keys:</strong> ss<sub>i</sub> = ecdh(node_privkey, <i>E</i><sub>i</sub>); rho<sub>i</sub> = HMAC(b\"rho\", ss<sub>i</sub>)." +
        "<br><strong>3. Working buffer:</strong> <code>work = hop_payloads + b\"\\x00\" * 1300</code>." +
        "<br><strong>4. XOR with extended keystream:</strong> <code>stream = chacha20_keystream(rho, 2600); work = xor_bytes(work, stream)</code>." +
        "<br><strong>5. Parse the bigsize length:</strong> <code>length, header_len = parse_bigsize(work, 0)</code>. The TLV bytes occupy <code>work[0:header_len + length]</code>. The slot size is <code>header_len + length + 32</code>." +
        "<br><strong>6. Extract:</strong> <code>payload = work[0:header_len + length]</code>; <code>next_hmac = work[slot_size - 32:slot_size]</code>." +
        "<br><strong>7. Next hop_payloads:</strong> <code>work[slot_size : slot_size + 1300]</code>." +
        "<br><strong>8. Advance ephemeral:</strong> <code>b = SHA256(E_i + ss)</code>; <code>E_next = point_mul_pubkey(E_i, b)</code>." +
        "<br><strong>9. Assemble outgoing:</strong> <code>b\"\\x00\" + E_next + next_hop_payloads + next_hmac</code>.",
      code:
        `def peel_layer(self, packet, node_privkey):
    E_i = packet[1:34]
    hop_payloads = packet[34:1334]
    ss = ecdh(node_privkey, E_i)
    rho = hmac.new(b"rho", ss, hashlib.sha256).digest()
    work = hop_payloads + b"\\x00" * ROUTING_INFO_SIZE
    stream = chacha20_keystream(rho, 2 * ROUTING_INFO_SIZE)
    work = xor_bytes(work, stream)
    length, header_len = parse_bigsize(work, 0)
    payload = work[0:header_len + length]
    slot = header_len + length + 32
    next_hmac = work[slot - 32:slot]
    next_hop_payloads = work[slot:slot + ROUTING_INFO_SIZE]
    b = hashlib.sha256(E_i + ss).digest()
    E_next = point_mul_pubkey(E_i, b)
    next_packet = b"\\x00" + E_next + next_hop_payloads + next_hmac
    return next_packet, payload, ss`,
    },
    rewardSats: 100,
    group: "sphinx/forwarder",
    groupOrder: 1,
  },

  "exercise-wrap-hop-draft": {
    id: "exercise-wrap-hop-draft",
    title: "Wrap a Single Layer",
    description:
      "Implement <code>OnionPacketBuilder.wrap_hop</code>. Given the current 1300-byte buffer, this hop's TLV payload, the next-hop HMAC, this hop's <code>rho</code>/<code>mu</code> keys, and the payment's <code>associated_data</code> (32-byte payment_hash), produce the new buffer (after shift + write + XOR) and the HMAC computed over <code>(new_buffer || associated_data)</code> per BOLT 4.",
    starterCode: `class OnionPacketBuilder:
    def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data):
        """
        Args:
          buffer:           current 1300-byte hop_payloads buffer (bytes)
          payload:          this hop's TLV payload (bytes, variable length)
          next_hmac:        32-byte HMAC pointing to the inner layer
                            (all zeros for the destination hop)
          rho:              this hop's 32-byte rho key
          mu:               this hop's 32-byte mu key
          associated_data:  32-byte payment_hash for HTLC payments
                            (BOLT 4 binds the onion to the payment via this field)

        Returns: (new_buffer, this_hop_hmac)
          new_buffer:     the rewritten + encrypted 1300-byte buffer
          this_hop_hmac:  HMAC-SHA256(mu, new_buffer || associated_data), 32 bytes

        Algorithm (BOLT 4):
          slot_size = len(payload) + 32
          1. Right-shift buffer by slot_size: drop the last slot_size bytes,
             prepend slot_size bytes of space (any value; we overwrite next)
          2. Write payload at offset 0, then next_hmac at offset len(payload)
          3. XOR the entire 1300-byte buffer with chacha20_keystream(rho, 1300)
          4. Compute hmac.new(mu, new_buffer + associated_data, hashlib.sha256).digest()
        """
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

def reference_wrap_hop(buffer, payload, next_hmac, rho, mu, ad):
    slot_size = len(payload) + 32
    shifted = bytearray(slot_size) + bytearray(buffer[:-slot_size])
    shifted[:len(payload)] = payload
    shifted[len(payload):len(payload) + 32] = next_hmac
    stream = chacha20_keystream(rho, ROUTING_INFO_SIZE)
    encrypted = xor_bytes(bytes(shifted), stream)
    tag = hmac.new(mu, encrypted + ad, hashlib.sha256).digest()
    return encrypted, tag

# Test vector
INIT_BUFFER = bytes(ROUTING_INFO_SIZE)
PAYLOAD = bytes.fromhex("0203989a900401b40608000000012345678920" + "00" * 32 + "ffaa")
NEXT_HMAC = bytes.fromhex("11" * 32)
RHO = bytes.fromhex("aa" * 32)
MU = bytes.fromhex("bb" * 32)
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

def test_returns_buffer_and_hmac():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    assert isinstance(out, tuple) and len(out) == 2, "Expected a (buffer, hmac) tuple"
    new_buf, tag = out
    assert isinstance(new_buf, (bytes, bytearray)) and len(new_buf) == ROUTING_INFO_SIZE
    assert isinstance(tag, (bytes, bytearray)) and len(tag) == 32

def test_matches_reference():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    new_buf, tag = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    ref_buf, ref_tag = reference_wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    assert new_buf == ref_buf, "Buffer doesn't match reference"
    assert tag == ref_tag, "HMAC doesn't match reference"

def test_associated_data_changes_hmac_only():
    """Different payment_hash must produce a different HMAC but the same buffer."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out_a = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    other_hash = bytes.fromhex("99" * 32)
    out_b = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, other_hash)
    assert out_a[0] == out_b[0], "Different associated_data must NOT change the buffer"
    assert out_a[1] != out_b[1], "Different associated_data must change the HMAC (binds onion to payment)"

def test_different_mu_changes_hmac_only():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out_a = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    out_b = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, bytes.fromhex("cc" * 32), PAYMENT_HASH)
    assert out_a[0] == out_b[0], "Different mu should not affect the buffer"
    assert out_a[1] != out_b[1], "Different mu must produce a different HMAC"

def test_payload_at_front_after_decrypt():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    new_buf, _ = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    stream = chacha20_keystream(RHO, ROUTING_INFO_SIZE)
    plaintext = xor_bytes(new_buf, stream)
    assert plaintext[:len(PAYLOAD)] == PAYLOAD, "Decrypting must reveal the payload at offset 0"
    assert plaintext[len(PAYLOAD):len(PAYLOAD) + 32] == NEXT_HMAC, "next_hmac must follow the payload"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> perform one iteration of the build loop. Take the current buffer, the new hop's data, the inner-layer HMAC, and produce a buffer that has this hop's data at the front (encrypted with rho) plus the HMAC over (new_buffer || associated_data) for use by the layer above." +
        "<br><br><strong>Slot size:</strong> the bytes consumed by this hop = len(payload) + 32 (HMAC). The 'shift right' makes room for those bytes at the front by pushing existing contents back." +
        "<br><br><strong>Why associated_data:</strong> BOLT 4 binds the onion to a specific HTLC by including the 32-byte payment_hash in every hop's HMAC. A forwarder receiving the onion attached to a different payment_hash gets a HMAC mismatch and rejects the packet. This is what stops an attacker from re-attaching a captured onion to a different payment.",
      steps:
        "<strong>1. Compute slot_size = len(payload) + 32.</strong>" +
        "<br><strong>2. Shift right:</strong> the new buffer should be <code>bytearray(slot_size) + bytearray(buffer[:-slot_size])</code>. (You'll overwrite the leading slot_size bytes immediately.)" +
        "<br><strong>3. Write the payload</strong> at offset 0: <code>new_buffer[:len(payload)] = payload</code>." +
        "<br><strong>4. Write next_hmac</strong> right after: <code>new_buffer[len(payload):len(payload)+32] = next_hmac</code>." +
        "<br><strong>5. Encrypt</strong> the whole 1300-byte buffer: XOR with <code>chacha20_keystream(rho, 1300)</code>." +
        "<br><strong>6. HMAC</strong> the encrypted buffer concatenated with associated_data: <code>hmac.new(mu, encrypted + associated_data, hashlib.sha256).digest()</code>." +
        "<br><strong>7. Return</strong> <code>(encrypted_buffer, hmac_tag)</code>.",
      code:
        `def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data):
    slot_size = len(payload) + 32
    shifted = bytearray(slot_size) + bytearray(buffer[:-slot_size])
    shifted[:len(payload)] = payload
    shifted[len(payload):len(payload) + 32] = next_hmac
    stream = chacha20_keystream(rho, ROUTING_INFO_SIZE)
    encrypted = xor_bytes(bytes(shifted), stream)
    tag = hmac.new(mu, encrypted + associated_data, hashlib.sha256).digest()
    return encrypted, tag`,
    },
    rewardSats: 75,
    group: "sphinx/builder",
    groupOrder: 3,
  },

  "exercise-build-packet-draft": {
    id: "exercise-build-packet-draft",
    title: "Build the Full Onion Packet",
    description:
      "Implement <code>OnionPacketBuilder.build</code>. Given the route data already on <code>self</code> (<code>session_key</code>, <code>hop_pubkeys</code>), the per-hop bigsize-prefixed payloads, and the payment's 32-byte <code>associated_data</code> (payment_hash), produce the final 1366-byte BOLT 4 onion packet. " +
      "The build orchestrates <code>derive_shared_secrets</code>, per-hop key derivation, filler generation, and <code>wrap_hop</code> with three BOLT 4-mandated details: a pad-key-derived noise initial buffer (not zeros), filler placement AFTER the innermost (destination) wrap (not before), and HMAC over <code>(buffer || associated_data)</code> at every hop.",
    starterCode: `class OnionPacketBuilder:
    def build(self, payloads, associated_data):
        """
        Build a complete 1366-byte BOLT 4 onion packet.

        Args:
          payloads:         list of bigsize-prefixed TLV hop payloads, in route order.
                            Each entry is bigsize_len(N) || N_bytes_of_TLV.
                            payloads[0] is for the first hop, payloads[-1] is the destination.
          associated_data:  32-byte payment_hash. Bound into every hop's HMAC.

        Returns:
          bytes of length 1366: version (1) || ephemeral_pubkey (33) ||
                                hop_payloads (1300) || hmac (32)

        Algorithm (BOLT 4 'Packet Construction'):
          1. self.derive_shared_secrets() to fill in shared_secrets + ephemeral_pubkeys.
          2. Derive rho_i, mu_i per hop. Derive pad_key = HMAC("pad", session_key).
          3. Compute filler from rho keys for hops 0..N-2 and slot sizes
             slot_i = len(payloads[i]) + 32.
          4. Initialize buffer = ChaCha20-keystream(pad_key, 1300), NOT zeros.
             This pseudorandom noise hides "no padding was applied" from observers.
          5. next_hmac = b"\\x00" * 32.
          6. For i in reverse order (destination first, first forwarder last):
             a. buffer, next_hmac = self.wrap_hop(
                    buffer, payloads[i], next_hmac, rho_i, mu_i, associated_data
                )
             b. If this was the innermost wrap (i == len-1), OVERWRITE the
                trailing bytes of buffer with filler:
                    buffer[1300 - len(filler):1300] = filler
                Then RECOMPUTE next_hmac over the corrected buffer:
                    next_hmac = HMAC(mu_i, buffer || associated_data)
          7. Assemble: b"\\x00" + self.ephemeral_pubkeys[0] + buffer + next_hmac.

        Why filler is overwritten AFTER the innermost wrap: if you pre-place filler
        in the initial buffer (at offset 1300 - len(filler)) and let the destination's
        right-shift propagate it, the destination's slot_size drops the LAST slot_dave
        bytes off the back. When slot_dave differs from forwarder slot sizes,
        you lose part of the filler. Overwriting the filler region directly AFTER
        the wrap places filler bytes exactly where each forwarder expects them.
        """
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

# Reuse test vectors from the shared-secrets exercise
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CAROL_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CAROL_PUB = privkey_to_pubkey(CAROL_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CAROL_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CAROL_PRIV, DAVE_PRIV]

# Bigsize-prefixed TLV payloads. Variable-length destination (different slot size from forwarders) so
# the test exercises the filler-after-innermost-wrap fix.
RAW_TLVS = [
    bytes.fromhex("0203989a900401b40608000000012345678920"),  # 19 bytes
    bytes.fromhex("0203989a900401b40608000000012345678921"),  # 19 bytes
    bytes.fromhex("0203989a90040181" + "aa" * 32),            # 40 bytes (larger destination payload)
]
PAYLOADS = [encode_bigsize(len(t)) + t for t in RAW_TLVS]

def test_returns_1366_bytes():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert isinstance(packet, (bytes, bytearray))
    assert len(packet) == 1366, f"Expected 1366 bytes, got {len(packet)}"

def test_version_byte():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert packet[0] == 0x00, "Version byte must be 0x00"

def test_ephemeral_pubkey_field():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert packet[1:34] == b.ephemeral_pubkeys[0], "Bytes 1..34 must be E_0"

def test_hmac_validates_with_assoc_data():
    """Bob's verification: HMAC-SHA256(bob_mu, hop_payloads || associated_data) must match packet.hmac."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    bob_ss = b.shared_secrets[0]
    bob_mu = hmac.new(b"mu", bob_ss, hashlib.sha256).digest()
    hop_payloads = packet[34:1334]
    expected_hmac = hmac.new(bob_mu, hop_payloads + PAYMENT_HASH, hashlib.sha256).digest()
    actual_hmac = packet[1334:1366]
    assert expected_hmac == actual_hmac, "Packet HMAC must verify with Bob's mu over (hop_payloads || associated_data)"

def test_hmac_fails_without_assoc_data():
    """Sanity: HMAC over hop_payloads alone (without associated_data) must NOT match."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    bob_ss = b.shared_secrets[0]
    bob_mu = hmac.new(b"mu", bob_ss, hashlib.sha256).digest()
    hop_payloads = packet[34:1334]
    bare_hmac = hmac.new(bob_mu, hop_payloads, hashlib.sha256).digest()
    assert bare_hmac != packet[1334:1366], "BOLT 4 mandates HMAC over hop_payloads || associated_data"

def test_initial_buffer_is_pad_noise_not_zeros():
    """Sanity: the buffer is initialized with pad-key keystream, not zeros.
    A buffer of all zeros (before wraps) would lead to detectable trailing patterns."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet1 = b.build(PAYLOADS, PAYMENT_HASH)
    # A different session_key should yield a different packet (ephemeral_pubkey AND buffer state)
    other_key = bytes.fromhex("5151515151515151515151515151515151515151515151515151515151515151")
    b2 = OnionPacketBuilder(other_key, HOP_PUBKEYS)
    packet2 = b2.build(PAYLOADS, PAYMENT_HASH)
    assert packet1 != packet2

def test_end_to_end_peel_through_route():
    """Definitive correctness check: build a packet, peel it through every hop with HMAC validation.
    Validates initial buffer, filler placement, wrap order, and assoc_data threading all at once."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    packet = b.build(PAYLOADS, PAYMENT_HASH)

    # Peel hop by hop, validating HMAC at each step
    current = packet
    for i, hop_priv in enumerate(HOP_PRIVKEYS):
        assert len(current) == 1366, f"Hop {i}: packet length must be 1366"
        assert current[0] == 0x00, f"Hop {i}: version byte must be 0x00"
        E = current[1:34]
        hop_payloads = current[34:1334]
        inbound_hmac = current[1334:1366]
        ss = ecdh(hop_priv, E)
        mu = hmac.new(b"mu", ss, hashlib.sha256).digest()
        expected_hmac = hmac.new(mu, hop_payloads + PAYMENT_HASH, hashlib.sha256).digest()
        assert expected_hmac == inbound_hmac, f"Hop {i}: HMAC must validate with assoc_data"
        # Peel: extract payload + advance ephemeral
        rho = hmac.new(b"rho", ss, hashlib.sha256).digest()
        work = bytearray(hop_payloads + b"\\x00" * ROUTING_INFO_SIZE)
        stream = chacha20_keystream(rho, 2 * ROUTING_INFO_SIZE)
        work = bytes(a ^ b for a, b in zip(work, stream))
        length, hl = parse_bigsize(work, 0)
        payload = work[:hl + length]
        assert payload == PAYLOADS[i], f"Hop {i}: extracted payload must match original"
        slot = hl + length + 32
        next_hmac = work[slot - 32:slot]
        next_hop_payloads = work[slot:slot + ROUTING_INFO_SIZE]
        bf = hashlib.sha256(E + ss).digest()
        E_next = point_mul_pubkey(E, bf)
        current = b"\\x00" + E_next + next_hop_payloads + next_hmac
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> orchestrate the full construction by stitching together everything from chapters 3-7, with three BOLT 4-mandated details that aren't obvious from the wrap_hop primitive alone." +
        "<br><br><strong>Detail 1 (pad-key noise):</strong> initialize the buffer with ChaCha20 keystream derived from <code>pad_key = HMAC(\"pad\", session_key)</code>. This makes the unused trailing bytes look like random noise, not zeros. A receiver who sees zeros at the end of their decrypted hop_payloads can infer that no padding was applied (i.e., a short route)." +
        "<br><br><strong>Detail 2 (filler post-innermost-wrap):</strong> after wrap_hop returns the buffer for the destination, OVERWRITE the trailing <code>len(filler)</code> bytes with the filler value, then RECOMPUTE the HMAC over the corrected buffer. Pre-placing filler in the initial buffer doesn't work for variable-length payloads, because the destination's right-shift drops bytes off the end and can lose filler content." +
        "<br><br><strong>Detail 3 (associated_data in HMAC):</strong> the <code>associated_data</code> argument (32-byte payment_hash) is concatenated with the buffer for every HMAC. This binds the onion to the specific HTLC, preventing replay across payments.",
      steps:
        "<strong>1. Shared secrets:</strong> call <code>self.derive_shared_secrets()</code> first." +
        "<br><strong>2. Per-hop keys:</strong> for each hop's shared secret, derive rho<sub>i</sub> and mu<sub>i</sub> using HMAC-SHA256 with the b\"rho\" and b\"mu\" labels." +
        "<br><strong>3. pad_key:</strong> <code>pad_key = hmac.new(b\"pad\", self.session_key, hashlib.sha256).digest()</code>." +
        "<br><strong>4. Filler:</strong> use rho<sub>i</sub> keys for hops 0..<i>N</i>-2 and their slot sizes. Don't include the final hop." +
        "<br><strong>5. Initial buffer:</strong> <code>buffer = bytearray(chacha20_keystream(pad_key, 1300))</code>." +
        "<br><strong>6. Reverse loop:</strong> <code>for i in range(len(payloads) - 1, -1, -1):</code> call <code>wrap_hop(buffer, payloads[i], next_hmac, rho_i, mu_i, associated_data)</code>." +
        "<br><strong>7. On the FIRST iteration only</strong> (<i>i</i> == len-1, the innermost / destination wrap): overwrite the buffer's trailing filler region and recompute the HMAC:" +
        "<br>&nbsp;&nbsp;&nbsp;<code>buffer = buffer[:1300 - len(filler)] + filler</code>" +
        "<br>&nbsp;&nbsp;&nbsp;<code>next_hmac = hmac.new(mu_i, buffer + associated_data, hashlib.sha256).digest()</code>" +
        "<br><strong>8. Final packet:</strong> <code>b'\\x00' + self.ephemeral_pubkeys[0] + buffer + next_hmac</code>.",
      code:
        `def build(self, payloads, associated_data):
    self.derive_shared_secrets()
    rho_keys = [hmac.new(b"rho", ss, hashlib.sha256).digest()
                for ss in self.shared_secrets]
    mu_keys = [hmac.new(b"mu", ss, hashlib.sha256).digest()
               for ss in self.shared_secrets]
    pad_key = hmac.new(b"pad", self.session_key, hashlib.sha256).digest()

    sizes = [len(p) + 32 for p in payloads[:-1]]
    filler = self.generate_filler(rho_keys[:-1], sizes)

    buffer = bytearray(chacha20_keystream(pad_key, ROUTING_INFO_SIZE))
    next_hmac = b"\\x00" * 32
    n = len(payloads)
    for i in range(n - 1, -1, -1):
        buffer, next_hmac = self.wrap_hop(
            buffer, payloads[i], next_hmac,
            rho_keys[i], mu_keys[i], associated_data,
        )
        if i == n - 1:
            buffer = bytes(buffer[:ROUTING_INFO_SIZE - len(filler)]) + filler
            next_hmac = hmac.new(mu_keys[i], buffer + associated_data,
                                 hashlib.sha256).digest()

    return b"\\x00" + self.ephemeral_pubkeys[0] + bytes(buffer) + next_hmac`,
    },
    rewardSats: 100,
    group: "sphinx/builder",
    groupOrder: 4,
  },

  "exercise-generate-filler-draft": {
    id: "exercise-generate-filler-draft",
    title: "Generate the Filler",
    description:
      "Implement <code>OnionPacketBuilder.generate_filler</code>. Given the <code>rho</code> keys and per-hop payload sizes for hops <code>0..N-2</code> (every hop except the final one), produce the filler bytes that will appear at the trailing positions of each hop's <code>hop_payloads</code> view after peeling. " +
      "The filler grows by one hop's payload size on each iteration: prepend that many zero bytes, then XOR the running filler with the trailing portion of that hop's <code>rho</code> keystream (extended to <code>ROUTING_INFO_SIZE + cumulative_size</code>). " +
      "Reference: BOLT 4 'Filler Generation'. Helpers in scope: <code>chacha20_keystream</code>, <code>xor_bytes</code>.",
    starterCode: `class OnionPacketBuilder:
    def generate_filler(self, rho_keys, payload_sizes):
        """
        Args:
          rho_keys:       list of 32-byte rho keys for hops 0..N-2.
                          The final hop's rho is NOT included; it doesn't shift,
                          so it doesn't contribute filler.
          payload_sizes:  list of per-hop slot sizes in bytes for the same hops.
                          slot_size = len(TLV payload) + 32 (HMAC).

        Returns:
          bytes of length sum(payload_sizes). Will be placed at the end of the
          1300-byte hop_payloads field during construction.

        Algorithm (BOLT 4):
          filler = empty
          for i in 0..len(rho_keys)-1:
              # extend filler with this hop's slot at the END
              filler = filler + (payload_sizes[i] zero bytes)
              # generate this hop's keystream extended past 1300 bytes
              stream = chacha20_keystream(rho_keys[i], ROUTING_INFO_SIZE + payload_sizes[i])
              # XOR the trailing len(filler) bytes onto filler
              filler ^= stream[ROUTING_INFO_SIZE + payload_sizes[i] - len(filler):]
          return filler
        """
        # TODO: implement
        pass
`,
    testCode: `def reference_generate_filler(rho_keys, payload_sizes):
    """Reference per BOLT 4 'Filler Generation'."""
    filler = b""
    for i in range(len(rho_keys)):
        filler = filler + b"\\x00" * payload_sizes[i]
        stream = chacha20_keystream(rho_keys[i], ROUTING_INFO_SIZE + payload_sizes[i])
        chunk = stream[ROUTING_INFO_SIZE + payload_sizes[i] - len(filler):]
        filler = xor_bytes(filler, chunk)
    return filler

# Test vectors
RHO_BOB   = bytes.fromhex("01" * 32)
RHO_CAROL = bytes.fromhex("02" * 32)
RHO_DAVE  = bytes.fromhex("03" * 32)

def test_two_hop_filler_size():
    """For a 3-hop route (Bob, Carol, Dave), filler covers Bob and Carol's slots."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CAROL], [65, 65])
    assert isinstance(out, (bytes, bytearray))
    assert len(out) == 130, f"Expected 130 bytes (65 + 65), got {len(out)}"

def test_two_hop_matches_reference():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CAROL], [65, 65])
    expected = reference_generate_filler([RHO_BOB, RHO_CAROL], [65, 65])
    assert out == expected, "Filler bytes don't match the BOLT 4 reference"

def test_one_hop_filler_size():
    """For a 2-hop route (Bob, Dave), filler covers only Bob."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB], [80])
    assert len(out) == 80

def test_three_hop_filler_size():
    """For a 4-hop route (Bob, Carol, X, Dave), filler covers three intermediate hops."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CAROL, RHO_DAVE], [60, 70, 50])
    assert len(out) == 60 + 70 + 50

def test_three_hop_matches_reference():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    sizes = [60, 70, 50]
    keys = [RHO_BOB, RHO_CAROL, RHO_DAVE]
    out = b.generate_filler(keys, sizes)
    expected = reference_generate_filler(keys, sizes)
    assert out == expected

def test_empty_rho_keys_returns_empty():
    """A single-hop route (just the destination) has no filler."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([], [])
    assert out == b"", "No intermediate hops means no filler"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> compute the bytes that will appear at the end of the hop_payloads field after each forwarder peels its layer." +
        "<br><br><strong>Why this works:</strong> Alice can't compute filler in isolation; it has to account for what each rho<sub>i</sub> XOR will do during peeling. By simulating the hops one by one (in order from first forwarder to last forwarder), Alice builds up the cumulative effect of all those XORs in the trailing positions." +
        "<br><br><strong>Loop invariant:</strong> after iteration <i>i</i>, <code>filler</code> contains exactly what the last <code>sum(payload_sizes[:i+1])</code> bytes of hop <i>i</i>'s view of the packet would look like, given that earlier hops' rho XORs have already been applied (virtually).",
      steps:
        "<strong>For each hop <i>i</i> in 0..len(rho_keys)-1:</strong>" +
        "<br>1. Extend filler at the END with <code>payload_sizes[i]</code> zero bytes." +
        "<br>2. Generate this hop's rho<sub>i</sub> keystream of length <code>ROUTING_INFO_SIZE + payload_sizes[i]</code> using <code>chacha20_keystream</code>." +
        "<br>3. Take the trailing <code>len(filler)</code> bytes of that keystream and XOR them into <code>filler</code> using <code>xor_bytes</code>." +
        "<br><br><strong>Return:</strong> the accumulated filler bytes. Total length = <code>sum(payload_sizes)</code>.",
      code:
        `def generate_filler(self, rho_keys, payload_sizes):
    filler = b""
    for i in range(len(rho_keys)):
        filler = filler + b"\\x00" * payload_sizes[i]
        stream_len = ROUTING_INFO_SIZE + payload_sizes[i]
        stream = chacha20_keystream(rho_keys[i], stream_len)
        chunk = stream[stream_len - len(filler):]
        filler = xor_bytes(filler, chunk)
    return filler`,
    },
    rewardSats: 75,
    group: "sphinx/builder",
    groupOrder: 2,
  },

  "exercise-derive-shared-secrets-draft": {
    id: "exercise-derive-shared-secrets-draft",
    title: "Derive the Shared-Secret Chain",
    description:
      "Implement <code>OnionPacketBuilder.derive_shared_secrets</code>. Given Alice's <code>session_key</code> (32 bytes) and the route's hop pubkeys (33-byte compressed each), produce the chain of <code>(ephemeral_pubkey, shared_secret)</code> pairs. " +
      "For hop 0, the ephemeral private key is just <code>session_key</code>; for each subsequent hop, multiply the previous ephemeral private key by the previous hop's blinding factor (mod the curve order). " +
      "Use the provided helpers: <code>privkey_to_pubkey</code>, <code>ecdh</code>, <code>point_mul_pubkey</code>, <code>scalar_mul</code>.",
    starterCode: `import hashlib

class OnionPacketBuilder:
    def __init__(self, session_key: bytes, hop_pubkeys: list[bytes]):
        """
        Args:
          session_key:  32 bytes. Alice's per-payment ephemeral private key.
          hop_pubkeys:  list of 33-byte compressed node public keys, in route order.
                        Index 0 is the first forwarder, last index is the receiver.
        """
        self.session_key = session_key
        self.hop_pubkeys = hop_pubkeys
        self.shared_secrets = []        # filled in below: 32-byte ss per hop
        self.ephemeral_pubkeys = []     # filled in below: 33-byte E_i per hop

    def derive_shared_secrets(self):
        """
        Walk the blinding chain and populate self.shared_secrets and
        self.ephemeral_pubkeys. Each entry corresponds to one hop, in route order.

        For hop i:
          - e_i is the ephemeral private key (32 bytes scalar).
          - E_i = e_i * G          (the ephemeral pubkey, 33 bytes compressed)
          - ss_i = ECDH(e_i, hop_pubkey_i)
          - b_i  = SHA256(E_i || ss_i)
          - e_{i+1} = e_i * b_i (mod n)

        Helpers available in scope:
          privkey_to_pubkey(privkey: bytes) -> bytes        # 32 -> 33
          ecdh(privkey: bytes, pubkey: bytes) -> bytes       # 32, 33 -> 32
          point_mul_pubkey(pubkey: bytes, scalar: bytes) -> bytes   # 33, 32 -> 33
          scalar_mul(a: bytes, b: bytes) -> bytes            # 32, 32 -> 32 mod n
        """
        # TODO: implement
        pass
`,
    testCode: `import hashlib

# Reference values for a fixed test vector.
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CAROL_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CAROL_PUB = privkey_to_pubkey(CAROL_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CAROL_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CAROL_PRIV, DAVE_PRIV]

def reference_chain(session_key, hop_pubkeys):
    """Reference implementation used to cross-check the student's output."""
    ss_list = []
    ek_list = []
    e = session_key
    for pub in hop_pubkeys:
        E = privkey_to_pubkey(e)
        ss = ecdh(e, pub)
        b = hashlib.sha256(E + ss).digest()
        ss_list.append(ss)
        ek_list.append(E)
        e = scalar_mul(e, b)
    return ss_list, ek_list

def test_returns_three_pairs():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    assert len(b.shared_secrets) == 3, "Expected 3 shared secrets, one per hop"
    assert len(b.ephemeral_pubkeys) == 3, "Expected 3 ephemeral pubkeys"
    for ss in b.shared_secrets:
        assert isinstance(ss, (bytes, bytearray)) and len(ss) == 32
    for ek in b.ephemeral_pubkeys:
        assert isinstance(ek, (bytes, bytearray)) and len(ek) == 33
        assert ek[0] in (2, 3), "Compressed pubkey must start with 0x02 or 0x03"

def test_first_ephemeral_is_session_pubkey():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    expected_E0 = privkey_to_pubkey(SESSION_KEY)
    assert b.ephemeral_pubkeys[0] == expected_E0, "E_0 must equal session_key * G"

def test_matches_reference_chain():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    ref_ss, ref_ek = reference_chain(SESSION_KEY, HOP_PUBKEYS)
    assert b.shared_secrets == ref_ss, "Shared secret chain doesn't match reference"
    assert b.ephemeral_pubkeys == ref_ek, "Ephemeral pubkey chain doesn't match reference"

def test_hops_can_recover_same_shared_secrets():
    """Each hop derives the same ss using its own privkey + the ephemeral pubkey."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    for i, hop_priv in enumerate(HOP_PRIVKEYS):
        hop_view_ss = ecdh(hop_priv, b.ephemeral_pubkeys[i])
        assert hop_view_ss == b.shared_secrets[i], (
            f"Hop {i}: forwarder's ECDH(hop_priv, E_i) must match Alice's ss_i"
        )
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> turn one session key into a deterministic sequence of (ephemeral_pubkey, shared_secret) pairs, one per hop." +
        "<br><br><strong>Why a chain:</strong> we want a single ephemeral key (<i>E</i><sub>0</sub>) in the packet, not one per hop. Each forwarder computes the next ephemeral key on its own from public information. The chain advances by multiplying the current ephemeral private key by a 'blinding factor' derived from the current ephemeral pubkey and shared secret." +
        "<br><br><strong>Key invariant:</strong> after the loop, both Alice and the <i>i</i>-th hop must derive the same ss<sub>i</sub>. Alice does it as ecdh(<i>e</i><sub>i</sub>, hop_pubkey<sub>i</sub>); the hop does it as ecdh(hop_privkey, <i>E</i><sub>i</sub>). The math works because both sides compute the same point on the curve.",
      steps:
        "<strong>Initial state:</strong> <i>e</i> = session_key. This is the ephemeral private key for hop 0." +
        "<br><br><strong>For each hop <i>i</i>:</strong>" +
        "<br>1. Compute the ephemeral pubkey <i>E</i><sub>i</sub> with <code>privkey_to_pubkey(e)</code>. Append it to <code>self.ephemeral_pubkeys</code>." +
        "<br>2. Compute the shared secret ss<sub>i</sub> with <code>ecdh(e, hop_pubkey_i)</code>. Append it to <code>self.shared_secrets</code>." +
        "<br>3. Compute the blinding factor <i>b</i><sub>i</sub> = SHA256(<i>E</i><sub>i</sub> ‖ ss<sub>i</sub>). Use <code>hashlib.sha256(...).digest()</code> to get 32 bytes." +
        "<br>4. Advance <i>e</i>: <code>e = scalar_mul(e, b_i)</code>." +
        "<br><br><strong>Done:</strong> after looping over every hop in <code>self.hop_pubkeys</code>, the two lists are populated and the function returns.",
      code:
        `def derive_shared_secrets(self):
    e = self.session_key
    for hop_pubkey in self.hop_pubkeys:
        E = privkey_to_pubkey(e)
        ss = ecdh(e, hop_pubkey)
        b = hashlib.sha256(E + ss).digest()
        self.ephemeral_pubkeys.append(E)
        self.shared_secrets.append(ss)
        e = scalar_mul(e, b)`,
    },
    rewardSats: 50,
    group: "sphinx/builder",
    groupOrder: 1,
  },

};
