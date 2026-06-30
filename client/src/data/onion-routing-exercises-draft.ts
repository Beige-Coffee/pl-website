// ─── Onion Routing Exercise Definitions ──────────────────────────────────────
//
// Each exercise has starter code, test code, hints, and metadata.
// Exercises are keyed by ID and referenced from tutorial markdown via
// <code-intro exercises="..."> tags.
//
// Exercises are added chapter-by-chapter. The 9 live exercises:
//
// crypto/keys.py
//   - exercise-derive-keys-draft                     [Ch 6]
//
// sphinx/builder.py
//   - exercise-derive-shared-secrets-draft           [Ch 4]
//   - exercise-generate-filler-draft                 [Ch 7]
//   - exercise-wrap-hop-draft                        [Ch 8]
//   - exercise-build-packet-draft                    [Ch 8]
//
// sphinx/forwarder.py
//   - exercise-peel-layer-draft                      [Ch 9]
//   - exercise-verify-hmac-draft                     [Ch 10]
//   - exercise-check-forward-draft                   [Ch 10]
//
// sphinx/errors.py
//   - exercise-decrypt-error-onion-draft             [Ch 11]
//
// (Chapter 11–12 capstones are integrations, not new exercises.)

export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  /**
   * Sent to the Scratchpad sandbox when the student clicks "Send to Sandbox".
   * Should be EXPLORATORY code that demonstrates the relevant building blocks
   * with print statements, NOT the exercise's starter code. The student is
   * meant to modify and re-run it to internalize the concepts before solving.
   */
  sampleCode?: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
  };
  rewardSats: number;
  group: string;
  groupOrder: number;
}

const BOLT4_ONION_VECTOR_TEST_FIXTURES = `
# Official BOLT 4 variable-length hop_payload test vector:
# https://github.com/lightning/bolts/blob/master/bolt04/onion-test.json
# The route's session key, hop private keys, and per-hop shared secrets are
# the published spec values, so these tests are a direct interoperability
# check against what LND / Core Lightning / LDK all build and parse.
BOLT4_SESSION_KEY = bytes.fromhex("41" * 32)
BOLT4_ASSOC_DATA = bytes.fromhex("42" * 32)
BOLT4_HOP_PRIVKEYS = [bytes([0x41 + _i]) * 32 for _i in range(5)]
BOLT4_HOP_PUBKEYS = [
    bytes.fromhex("02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619"),
    bytes.fromhex("0324653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c"),
    bytes.fromhex("027f31ebc5462c1fdce1b737ecff52d37d75dea43ce11c74d25aa297165faa2007"),
    bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991"),
    bytes.fromhex("02edabbd16b41c8371b92ef2f04c1185b4f03b6dcd52ba9b78d9d7c89c8f221145"),
]
# Published in BOLT 4's "Returning Errors" test vector (same route).
BOLT4_SHARED_SECRETS = [
    bytes.fromhex("53eb63ea8a3fec3b3cd433b85cd62a4b145e1dda09391b348c4e1cd36a03ea66"),
    bytes.fromhex("a6519e98832a0b179f62123b3567c106db99ee37bef036e783263602f3488fae"),
    bytes.fromhex("3a6b412548762f0dbccce5c7ae7bb8147d1caf9b5471c34120b30bc9c04891cc"),
    bytes.fromhex("21e13c2d7cfe7e18836df50872466117a295783ab8aab0e7ecc8c725503ad02d"),
    bytes.fromhex("b5756b9b542727dbafc6765a49488b023a725d631af688fc031217e90770c328"),
]
BOLT4_PAYLOADS = [
    bytes.fromhex("1202023a98040205dc06080000000000000001"),
    bytes.fromhex("52020236b00402057806080000000000000002fd02013c0102030405060708090a0b0c0d0e0f0102030405060708090a0b0c0d0e0f0102030405060708090a0b0c0d0e0f0102030405060708090a0b0c0d0e0f"),
    bytes.fromhex("12020230d4040204e206080000000000000003"),
    bytes.fromhex("1202022710040203e806080000000000000004"),
    bytes.fromhex("fd011002022710040203e8082224a33562c54507a9334e79f0dc4f17d407e6d7c61f0e2f3d0d38599502f617042710fd012de02a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a"),
]
BOLT4_EXPECTED_ONION = bytes.fromhex("0002eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619f7f3416a5aa36dc7eeb3ec6d421e9615471ab870a33ac07fa5d5a51df0a8823aabe3fea3f90d387529d4f72837f9e687230371ccd8d263072206dbed0234f6505e21e282abd8c0e4f5b9ff8042800bbab065036eadd0149b37f27dde664725a49866e052e809d2b0198ab9610faa656bbf4ec516763a59f8f42c171b179166ba38958d4f51b39b3e98706e2d14a2dafd6a5df808093abfca5aeaaca16eded5db7d21fb0294dd1a163edf0fb445d5c8d7d688d6dd9c541762bf5a5123bf9939d957fe648416e88f1b0928bfa034982b22548e1a4d922690eecf546275afb233acf4323974680779f1a964cfe687456035cc0fba8a5428430b390f0057b6d1fe9a8875bfa89693eeb838ce59f09d207a503ee6f6299c92d6361bc335fcbf9b5cd44747aadce2ce6069cfdc3d671daef9f8ae590cf93d957c9e873e9a1bc62d9640dc8fc39c14902d49a1c80239b6c5b7fd91d05878cbf5ffc7db2569f47c43d6c0d27c438abff276e87364deb8858a37e5a62c446af95d8b786eaf0b5fcf78d98b41496794f8dcaac4eef34b2acfb94c7e8c32a9e9866a8fa0b6f2a06f00a1ccde569f97eec05c803ba7500acc96691d8898d73d8e6a47b8f43c3d5de74458d20eda61474c426359677001fbd75a74d7d5db6cb4feb83122f133206203e4e2d293f838bf8c8b3a29acb321315100b87e80e0edb272ee80fda944e3fb6084ed4d7f7c7d21c69d9da43d31a90b70693f9b0cc3eac74c11ab8ff655905688916cfa4ef0bd04135f2e50b7c689a21d04e8e981e74c6058188b9b1f9dfc3eec6838e9ffbcf22ce738d8a177c19318dffef090cee67e12de1a3e2a39f61247547ba5257489cbc11d7d91ed34617fcc42f7a9da2e3cf31a94a210a1018143173913c38f60e62b24bf0d7518f38b5bab3e6a1f8aeb35e31d6442c8abb5178efc892d2e787d79c6ad9e2fc271792983fa9955ac4d1d84a36c024071bc6e431b625519d556af38185601f70e29035ea6a09c8b676c9d88cf7e05e0f17098b584c4168735940263f940033a220f40be4c85344128b14beb9e75696db37014107801a59b13e89cd9d2258c169d523be6d31552c44c82ff4bb18ec9f099f3bf0e5b1bb2ba9a87d7e26f98d294927b600b5529c47e04d98956677cbcee8fa2b60f49776d8b8c367465b7c626da53700684fb6c918ead0eab8360e4f60edd25b4f43816a75ecf70f909301825b512469f8389d79402311d8aecb7b3ef8599e79485a4388d87744d899f7c47ee644361e17040a7958c8911be6f463ab6a9b2afacd688ec55ef517b38f1339efc54487232798bb25522ff4572ff68567fe830f92f7b8113efce3e98c3fffbaedce4fd8b50e41da97c0c08e423a72689cc68e68f752a5e3a9003e64e35c957ca2e1c48bb6f64b05f56b70b575ad2f278d57850a7ad568c24a4d32a3d74b29f03dc125488bc7c637da582357f40b0a52d16b3b40bb2c2315d03360bc24209e20972c200566bcf3bbe5c5b0aedd83132a8a4d5b4242ba370b6d67d9b67eb01052d132c7866b9cb502e44796d9d356e4e3cb47cc527322cd24976fe7c9257a2864151a38e568ef7a79f10d6ef27cc04ce382347a2488b1f404fdbf407fe1ca1c9d0d5649e34800e25e18951c98cae9f43555eef65fee1ea8f15828807366c3b612cd5753bf9fb8fced08855f742cddd6f765f74254f03186683d646e6f09ac2805586c7cf11998357cafc5df3f285329366f475130c928b2dceba4aa383758e7a9d20705c4bb9db619e2992f608a1ba65db254bb389468741d0502e2588aeb54390ac600c19af5c8e61383fc1bebe0029e4474051e4ef908828db9cca13277ef65db3fd47ccc2179126aaefb627719f421e20")
`;

export const ONION_ROUTING_EXERCISES_DRAFT: Record<string, CodeExerciseData> = {

  "exercise-derive-keys-draft": {
    id: "exercise-derive-keys-draft",
    title: "Derive the Per-Hop Keys",
    description:
      "Implement <code>derive_keys(shared_secret) -> KeyMaterial</code>. Given a 32-byte secret, return the named keys (<code>rho</code>, <code>mu</code>, <code>um</code>, <code>pad</code>, <code>ammag</code>) defined by BOLT 4's key-generation function. " +
      "Each key is computed as <code>HMAC-SHA256(key=ASCII label, msg=secret)</code> and is exactly 32 bytes long. In packet construction, <code>rho</code>, <code>mu</code>, <code>um</code>, and <code>ammag</code> are derived from each hop's shared secret, while <code>pad</code> is derived from Alice's session key. The <code>KeyMaterial</code> dataclass is included at the top of the starter code as a small named container.",
    sampleCode: `# Key-derivation sandbox - watch one secret fan out into five keys.
#
# Every BOLT 4 key is just HMAC-SHA256(key=ASCII label, msg=shared_secret).
# Same secret, different label => statistically unrelated 32-byte keys.
# Try swapping the secret or adding your own label and re-running.

import hmac, hashlib

# A deterministic 32-byte secret to expand. In a real route this would be the
# ECDH shared secret a hop derives.
ss = bytes.fromhex("42" * 32)

labels = ["rho", "mu", "um", "pad", "ammag"]
for label in labels:
    key = hmac.new(label.encode(), ss, hashlib.sha256).digest()
    print(f"{label:>6} -> {key.hex()}  ({len(key)} bytes)")

# Argument order is NOT symmetric. Watch what swapping key/msg does:
right = hmac.new(b"rho", ss, hashlib.sha256).digest()
wrong = hmac.new(ss, b"rho", hashlib.sha256).digest()
print(f"\\nlabel-as-key (correct): {right.hex()}")
print(f"secret-as-key (WRONG):  {wrong.hex()}")
print(f"same result? {right == wrong}")
`,
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
    Expand a 32-byte secret into the five named BOLT 4 keys
    (rho, mu, um, pad, ammag) using the chapter's key-generation function.

    Note: rho/mu/um/ammag are derived from per-hop shared secrets. The pad key
    uses the same KDF, but packet construction calls it with Alice's session key.

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

def test_keys_match_official_bolt4_vector():
    """Interoperability: BOLT 4's "Returning Errors" trace publishes the um and
    ammag keys derived from the last hop's shared secret on its official 5-hop
    route. Pinning these exact bytes catches a swapped-argument KDF that would
    still pass the recipe-restatement check above (HMAC is not symmetric in its
    key vs. message, so order matters)."""
    BOLT4_SS = bytes.fromhex("b5756b9b542727dbafc6765a49488b023a725d631af688fc031217e90770c328")
    out = derive_keys(BOLT4_SS)
    assert out.um == bytes.fromhex(
        "4da7f2923edce6c2d85987d1d9fa6d88023e6c3a9c3d20f07d3b10b61a78d646"
    ), "um key must match the official BOLT 4 vector: HMAC-SHA256(key=b'um', msg=ss)"
    assert out.ammag == bytes.fromhex(
        "2f36bb8822e1f0d04c27b7d8bb7d7dd586e032a3218b8d414afbba6f169a4d68"
    ), "ammag key must match the official BOLT 4 vector: HMAC-SHA256(key=b'ammag', msg=ss)"

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
    assert a.rho != b.rho, "Different secrets must give different rho keys (the secret is the HMAC message)"
    assert a.mu  != b.mu, "Different secrets must give different mu keys"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> map one 32-byte secret to five 32-byte keys, each tagged with a different ASCII label." +
        "<br><br><strong>Why HMAC:</strong> HMAC-SHA256 acts as a pseudorandom function: changing either input (key OR message) gives an output that looks statistically uncorrelated with the original. So HMAC(b'rho', ss) and HMAC(b'mu', ss) are independent-looking even though they share the same ss." +
        "<br><br><strong>Where pad fits:</strong> <code>rho</code>, <code>mu</code>, <code>um</code>, and <code>ammag</code> are per-hop keys derived from each hop's shared secret. <code>pad</code> uses the same key-generation function, but the packet builder calls it with Alice's session key to initialize the empty buffer. BOLT 4 also defines an optional attribution-data key, <code>ammagext</code>; this tutorial scopes that extension out." +
        "<br><br><strong>Argument order matters:</strong> the BOLT 4 construction puts the label as the HMAC key and the shared secret as the message. <code>hmac.new(key, msg, digestmod)</code> takes them in that order." +
        "<br><br><strong>What you return (<code>KeyMaterial</code>):</strong> it's a Python <code>@dataclass</code>, which is just a lightweight named record. It's already defined for you in the starter code with five <code>bytes</code> fields, so you don't define it yourself; you only construct one. You build a dataclass by calling it like a function and passing each field by name:" +
        "<br><code>KeyMaterial(rho=..., mu=..., um=..., pad=..., ammag=...)</code>",
      steps:
        "<strong>Imports already done:</strong> hmac, hashlib, and the KeyMaterial dataclass are in scope." +
        "<br><br><strong>For each of the five labels (rho, mu, um, pad, ammag):</strong>" +
        "<br>1. Encode the label to bytes (<code>b\"rho\"</code> and so on)." +
        "<br>2. Compute the HMAC of the shared secret under that label:" +
        "<br><code>hmac.new(label_bytes, shared_secret, hashlib.sha256).digest()</code>" +
        "<br><br><strong>Return a <code>KeyMaterial</code>.</strong> It's a <code>@dataclass</code> (already defined in the starter code), so you construct one by calling it like a function with one keyword argument per field, then return it:" +
        "<br><code>return KeyMaterial(rho=..., mu=..., um=..., pad=..., ammag=...)</code>" +
        "<br>Fill each <code>...</code> with its matching <code>hmac.new(...).digest()</code> from step 2.",
      code:
        `def derive_keys(shared_secret):
    return KeyMaterial(
        rho=hmac.new(b"rho", shared_secret, hashlib.sha256).digest(),
        mu=hmac.new(b"mu", shared_secret, hashlib.sha256).digest(),
        um=hmac.new(b"um", shared_secret, hashlib.sha256).digest(),
        pad=hmac.new(b"pad", shared_secret, hashlib.sha256).digest(),
        ammag=hmac.new(b"ammag", shared_secret, hashlib.sha256).digest(),
    )`,
    },
    rewardSats: 30,
    group: "crypto/keys",
    groupOrder: 1,
  },

  "exercise-decrypt-error-onion-draft": {
    id: "exercise-decrypt-error-onion-draft",
    title: "Decrypt the Error Onion (Sender Side)",
    description:
      "Implement <code>decrypt_error_onion</code>. Given the wrapped error packet and a chain of <code>(um, ammag)</code> per-hop keys in route order, peel layers one at a time, identify which hop generated the error, and parse the BOLT 4 length-prefixed payload to recover the <code>failure_message</code>. " +
      "One important detail: error packets are not all the same size. The sender pads <code>failuremsg + pad</code> to a fixed total so the packet size can't leak which error occurred. The spec minimum is 256 bytes (a 292-byte packet, which this chapter's example uses), but bigger failure messages get padded to a bigger total.",
    sampleCode: `# Error-onion sandbox - build one layer, then peel it back off.
#
# The failing hop builds: hmac(32) || u16 failure_len || failure_msg ||
# u16 pad_len || pad. It then encrypts (XOR) with ammag keystream. Each hop
# on the return path re-encrypts with its own ammag; the sender peels them in
# reverse. Here we do a single hop so you can watch the bytes line up.
#
# Helpers in scope: chacha20_keystream, xor_bytes, generate_key.

um = generate_key("um", bytes.fromhex("33" * 32))      # MAC key for this hop
ammag = generate_key("ammag", bytes.fromhex("33" * 32)) # obfuscation key

failure_msg = b"temporary_channel_failure"
total = 256                                              # spec minimum payload
pad_len = total - len(failure_msg)

# Assemble payload WITHOUT the hmac, mac it, then prepend the tag.
body = len(failure_msg).to_bytes(2, "big") + failure_msg + pad_len.to_bytes(2, "big") + b"\\x00" * pad_len
tag = hmac.new(um, body, hashlib.sha256).digest()
packet = tag + body
print(f"plaintext packet: {len(packet)} bytes (32 hmac + {len(body)} body)")

# Encrypt the whole packet by XOR with the ammag keystream.
stream = chacha20_keystream(ammag, len(packet))
wrapped = xor_bytes(packet, stream)
print(f"wrapped (on-wire): {wrapped[:16].hex()}...")

# Sender peels: same keystream XORs back to plaintext, then the HMAC verifies.
peeled = xor_bytes(wrapped, stream)
recovered_len = int.from_bytes(peeled[32:34], "big")
recovered = peeled[34:34 + recovered_len]
expected = hmac.new(um, peeled[32:], hashlib.sha256).digest()
print(f"hmac verifies? {hmac.compare_digest(expected, peeled[:32])}")
print(f"recovered message: {recovered.decode()}")
`,
    starterCode: `import hmac, hashlib

def decrypt_error_onion(wrapped_error, hop_keys):
    """
    Args:
      wrapped_error: the error blob received on the return HTLC. 292 bytes in
                     this chapter's worked example, but real packets can be
                     larger; the structure is the same either way, so read the
                     lengths from the bytes instead of assuming a size
      hop_keys:      list of (um, ammag) tuples per hop, in route order
                     hop_keys[0] is the first forwarder, last is the destination

    Returns:
      (failing_hop_index, failure_message) once a layer's HMAC verifies and
        its length fields are well-formed
      (None, None) if no layer's HMAC verifies (tampered en route), or the
        one that does is malformed

    Unwrapped packet layout (chapter 11's "what the failing hop builds"):
      error_hmac (32) || failure_len (2) || failure_message || pad_len (2) || pad

    A verified HMAC pins down the failing hop (only it has that um key), but it
    doesn't prove the bytes are well-formed. If the two length fields don't
    exactly tile the payload, that hop sent a malformed error and there's
    nothing to recover, so return (None, None).

    Helpers in scope: chacha20_keystream(key, length), xor_bytes(a, b).
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

def reference_wrap_raw(payload, um, ammag):
    """Build a wrapped packet with a caller-supplied 260-byte payload."""
    assert len(payload) == 260
    pkt = hmac.new(um, payload, hashlib.sha256).digest() + payload
    return xor_bytes(pkt, chacha20_keystream(ammag, 292))

UM_BOB    = bytes.fromhex("01" * 32)
AMMAG_BOB = bytes.fromhex("02" * 32)
UM_CHARLIE    = bytes.fromhex("03" * 32)
AMMAG_CHARLIE = bytes.fromhex("04" * 32)
UM_DAVE    = bytes.fromhex("05" * 32)
AMMAG_DAVE = bytes.fromhex("06" * 32)

HOP_KEYS = [(UM_BOB, AMMAG_BOB), (UM_CHARLIE, AMMAG_CHARLIE), (UM_DAVE, AMMAG_DAVE)]

def wrap_through_route(originating_hop_index, msg):
    """Simulate the failing hop building the error, then upstream forwarders wrapping it."""
    um, ammag = HOP_KEYS[originating_hop_index]
    wrapped = reference_build(msg, um, ammag)
    for i in range(originating_hop_index - 1, -1, -1):
        _, ammag_up = HOP_KEYS[i]
        wrapped = xor_bytes(wrapped, chacha20_keystream(ammag_up, 292))
    return wrapped

def test_charlie_failure_identified():
    msg = b"temporary_channel_failure"
    wrapped = wrap_through_route(originating_hop_index=1, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 1, f"Expected failing hop index 1 (Charlie), got {idx}"
    assert recovered == msg, f"Recovered message must equal '{msg.decode()}', got {recovered!r}"

def test_bob_failure_identified():
    msg = b"fee_insufficient"
    wrapped = wrap_through_route(originating_hop_index=0, msg=msg)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx == 0, f"Expected failing hop index 0 (Bob), got {idx}"
    assert recovered == msg, f"Recovered message must equal '{msg.decode()}', got {recovered!r}"

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
    assert idx is None and recovered is None, "No layer's um HMAC verifies on tampered bytes; the loop must finish and return (None, None)"

def test_malformed_length_prefix_returns_none():
    """A valid HMAC is not enough; the length-prefixed payload must be parseable."""
    payload = (300).to_bytes(2, 'big') + b"\\x00" * 258
    wrapped = reference_wrap_raw(payload, UM_BOB, AMMAG_BOB)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx is None and recovered is None, "failure_len = 300 reaches past the end of this 260-byte payload; reject the malformed layer and keep peeling (expected (None, None))"

def test_malformed_padding_length_returns_none():
    msg = b"badpad"
    payload = len(msg).to_bytes(2, 'big') + msg + (1).to_bytes(2, 'big') + b"\\x00" * (260 - 2 - len(msg) - 2)
    wrapped = reference_wrap_raw(payload, UM_BOB, AMMAG_BOB)
    idx, recovered = decrypt_error_onion(wrapped, HOP_KEYS)
    assert idx is None and recovered is None, "2 + failure_len + 2 + pad_len must exactly equal len(payload); reject inconsistent lengths and keep peeling (expected (None, None))"
${BOLT4_ONION_VECTOR_TEST_FIXTURES}
# The spec's "Returning Errors" worked example: the destination (hop 4) of the
# official 5-hop test route fails with incorrect_or_unknown_payment_details
# (carrying a 300-byte TLV), pads failuremsg + pad to 1,024 bytes, and every
# hop re-wraps with its ammag on the way back. This is the exact 1,060-byte
# blob the origin receives. This 1,060-byte packet IS the current BOLT 4
# "Returning Errors" test vector; the 292-byte packet our chapter example uses
# is just the 256-byte-minimum illustration, not a published spec vector.
BOLT4_ERROR_PACKET = bytes.fromhex(
    "2dd2f49c1f5af0fcad371d96e8cddbdcd5096dc309c1d4e110f955926506b3c03b44c192896f45610741c85ed4074212537e0c11"
    "8d472ff3a559ae244acd9d783c65977765c5d4e00b723d00f12475aafaafff7b31c1be5a589e6e25f8da2959107206dd42bbcb43"
    "438129ce6cce2b6b4ae63edc76b876136ca5ea6cd1c6a04ca86eca143d15e53ccdc9e23953e49dc2f87bb11e5238cd6536e57387"
    "225b8fff3bf5f3e686fd08458ffe0211b87d64770db9353500af9b122828a006da754cf979738b4374e146ea79dd93656170b89c"
    "98c5f2299d6e9c0410c826c721950c780486cd6d5b7130380d7eaff994a8503a8fef3270ce94889fe996da66ed121741987010f7"
    "85494415ca991b2e8b39ef2df6bde98efd2aec7d251b2772485194c8368451ad49c2354f9d30d95367bde316fec6cbdddc7dc0d2"
    "5e99d3075e13d3de0822669861dafcd29de74eac48b64411987285491f98d78584d0c2a163b7221ea796f9e8671b2bb91e38ef5e"
    "18aaf32c6c02f2fb690358872a1ed28166172631a82c2568d23238017188ebbd48944a147f6cdb3690d5f88e51371cb70adf1fa0"
    "2afe4ed8b581afc8bcc5104922843a55d52acde09bc9d2b71a663e178788280f3c3eae127d21b0b95777976b3eb17be40a702c24"
    "4d0e5f833ff49dae6403ff44b131e66df8b88e33ab0a58e379f2c34bf5113c66b9ea8241fc7aa2b1fa53cf4ed3cdd91d407730c6"
    "6fb039ef3a36d4050dde37d34e80bcfe02a48a6b14ae28227b1627b5ad07608a7763a531f2ffc96dff850e8c583461831b19feff"
    "c783bc1beab6301f647e9617d14c92c4b1d63f5147ccda56a35df8ca4806b8884c4aa3c3cc6a174fdc2232404822569c01aba686"
    "c1df5eecc059ba97e9688c8b16b70f0d24eacfdba15db1c71f72af1b2af85bd168f0b0800483f115eeccd9b02adf03bdd4a88eab"
    "03e43ce342877af2b61f9d3d85497cd1c6b96674f3d4f07f635bb26add1e36835e321d70263b1c04234e222124dad30ffb9f2a13"
    "8e3ef453442df1af7e566890aedee568093aa922dd62db188aa8361c55503f8e2c2e6ba93de744b55c15260f15ec8e69bb01048c"
    "a1fa7bbbd26975bde80930a5b95054688a0ea73af0353cc84b997626a987cc06a517e18f91e02908829d4f4efc011b9867bd9bfe"
    "04c5f94e4b9261d30cc39982eb7b250f12aee2a4cce0484ff34eebba89bc6e35bd48d3968e4ca2d77527212017e202141900152f"
    "2fd8af0ac3aa456aae13276a13b9b9492a9a636e18244654b3245f07b20eb76b8e1cea8c55e5427f08a63a16b0a633af67c8e48e"
    "f8e53519041c9138176eb14b8782c6c2ee76146b8490b97978ee73cd0104e12f483be5a4af414404618e9f6633c55dda6f22252c"
    "b793d3d16fae4f0e1431434e7acc8fa2c009d4f6e345ade172313d558a4e61b4377e31b8ed4e28f7cd13a7fe3f72a409bc3bdabf"
    "e0ba47a6d861e21f64d2fac706dab18b3e546df4")
BOLT4_FAILURE_MESSAGE = bytes.fromhex(
    "400f0000000000000064000c3500fd84d1fd012c8080808080808080808080808080808080808080808080808080808080808080"
    "80808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080"
    "80808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080"
    "80808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080"
    "80808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080"
    "80808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080808080"
    "8080808080808080")

def test_official_bolt4_error_vector():
    """Interoperability: a real, larger-than-292-byte error packet straight
    from the spec. Hardcoding 292 anywhere will fail this test; use
    len(wrapped) so your decryptor handles what real nodes actually send."""
    hop_keys = [(hmac.new(b"um", ss, hashlib.sha256).digest(),
                 hmac.new(b"ammag", ss, hashlib.sha256).digest())
                for ss in BOLT4_SHARED_SECRETS]
    idx, msg = decrypt_error_onion(BOLT4_ERROR_PACKET, hop_keys)
    assert idx == 4, f"Expected failing hop index 4 (the destination), got {idx}. If you got None: this packet is 1,060 bytes, so every keystream must use len(wrapped), not a hardcoded 292"
    assert msg == BOLT4_FAILURE_MESSAGE, "Recovered failure message must match the official BOLT 4 test vector"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> Alice's view of the return path. She has all the (um, ammag) keys; she just doesn't know which layer the failing hop wrapped with. Solution: try each layer in order until one's HMAC verifies, then parse the length prefix to recover the message." +
        "<br><br><strong>Order:</strong> peel from outermost to innermost, which is hop 0, hop 1, hop 2 (the first forwarder is the outermost wrapper because their wrap was applied most recently during the return trip)." +
        "<br><br><strong>Why parse the u16 length:</strong> failure messages can contain zero bytes (e.g., binary <code>channel_update</code> data attached to <code>temporary_channel_failure</code>). Stripping trailing zeros would corrupt those messages. The explicit u16 failure_len at the front of the decrypted payload tells us the exact byte boundary." +
        "<br><br><strong>Why <code>len(wrapped_error)</code> instead of a constant:</strong> the sender pads <code>failuremsg + pad</code> to a fixed total so the size can't leak which error occurred, but that total is not always 256. Our worked example uses the 256-byte minimum (a 292-byte packet); the official BOLT 4 test vector pads a bigger message to 1,024 (a 1,060-byte packet), and that current spec vector is hardcoded in our test fixture for interop. The structure is self-describing, so a decryptor that reads the lengths from the packet handles every size a real node might send." +
        "<br><br><strong>Why validate after the HMAC matches:</strong> the HMAC proves which hop authored the bytes, not that the bytes are well-formed. A verified HMAC has already pinned the failing hop (only it has the <code>um</code> key), so if the two length fields don't exactly tile the payload (<code>2 + failure_len + 2 + pad_len == len(payload)</code>), that hop sent a malformed error and there's nothing left to recover: return <code>(None, None)</code>.",
      steps:
        "<strong>Set up the working buffer.</strong> Start it at the received error packet; the loop below peels each layer off it in place, reassigning <code>wrapped</code> every pass:" +
        "<br><code>wrapped = wrapped_error</code>" +
        "<br><br><strong>For each hop, taking its index <code>i</code> and keys <code>(um, ammag)</code> via <code>enumerate(hop_keys)</code>:</strong>" +
        "<br><strong>1. Peel this layer.</strong> XOR the whole buffer with this hop's keystream (it covers the whole packet, whatever its size):" +
        "<br><code>wrapped = xor_bytes(wrapped, chacha20_keystream(ammag, len(wrapped)))</code>" +
        "<br><strong>2. Split off the 32-byte tag and the payload:</strong>" +
        "<br><code>tag = wrapped[:32]\npayload = wrapped[32:]</code>" +
        "<br><strong>3. Check this hop's HMAC.</strong> Compare <code>hmac.new(um, payload, hashlib.sha256).digest()</code> to <code>tag</code>. If they differ, this is the wrong hop, so <code>continue</code> to peel the next layer. If they match, this IS the failing hop (only it has the <code>um</code> key), so parse and validate the length-prefixed payload:" +
        "<br><code>failure_len = int.from_bytes(payload[0:2], 'big')</code>" +
        "<br>If <code>2 + failure_len + 2 > len(payload)</code>, the length overshoots the packet, so the error is malformed and unrecoverable: <code>return None, None</code>." +
        "<br><code>pad_start = 2 + failure_len\npad_len = int.from_bytes(payload[pad_start:pad_start + 2], 'big')</code>" +
        "<br>If <code>2 + failure_len + 2 + pad_len != len(payload)</code>, the two length fields don't tile the payload, so it's malformed too: <code>return None, None</code>." +
        "<br>Otherwise, return the hop index with the recovered message:" +
        "<br><code>return i, payload[2:2 + failure_len]</code>" +
        "<br><br><strong>If the loop ends with no match:</strong>" +
        "<br><code>return None, None</code>",
      code:
        `def decrypt_error_onion(wrapped_error, hop_keys):
    wrapped = wrapped_error
    for i, (um, ammag) in enumerate(hop_keys):
        wrapped = xor_bytes(wrapped, chacha20_keystream(ammag, len(wrapped)))
        tag = wrapped[:32]
        payload = wrapped[32:]
        expected = hmac.new(um, payload, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, tag):
            continue  # wrong hop, peel the next layer
        # The HMAC verified, so this IS the failing hop. Now parse it strictly.
        failure_len = int.from_bytes(payload[0:2], "big")
        if 2 + failure_len + 2 > len(payload):
            return None, None  # length overshoots the packet: malformed
        pad_start = 2 + failure_len
        pad_len = int.from_bytes(payload[pad_start:pad_start + 2], "big")
        if 2 + failure_len + 2 + pad_len != len(payload):
            return None, None  # lengths don't tile: malformed
        return i, payload[2:2 + failure_len]
    return None, None`,
    },
    rewardSats: 100,
    group: "sphinx/errors",
    groupOrder: 1,
  },

  "exercise-verify-hmac-draft": {
    id: "exercise-verify-hmac-draft",
    title: "Verify the HMAC",
    description:
      "Implement <code>verify_hmac(packet, mu, associated_data) -> str | None</code>. Given a 1366-byte BOLT 4 onion packet, this hop's <code>mu</code> key (32 bytes), and the 32-byte <code>associated_data</code> (<code>payment_hash</code>), recompute <code>HMAC-SHA256(mu, hop_payloads || associated_data)</code> and compare it against the packet's last 32 bytes (the HMAC field). " +
      "Return <code>None</code> when the HMAC verifies, or the BOLT 4 failure-code string <code>\"invalid_onion_hmac\"</code> when it does not (a packet that is not exactly 1366 bytes also fails). Use <code>hmac.compare_digest</code> for a constant-time compare to avoid leaking timing information about which byte didn't match.",
    sampleCode: `# HMAC-verify sandbox - forge a packet, then tamper with it.
#
# A 1366-byte onion is: version(1) || E_i(33) || hop_payloads(1300) || hmac(32).
# The tag is HMAC-SHA256(mu, hop_payloads || associated_data). Flip ANY byte of
# hop_payloads (or use the wrong mu / payment_hash) and the recomputed tag
# stops matching. Helpers in scope: generate_key (the mu KDF).

mu = generate_key("mu", bytes.fromhex("02" * 32))      # this hop's mu key
payment_hash = bytes.fromhex("42" * 32)                 # associated_data
hop_payloads = bytes((i % 256) for i in range(1300))    # 1,300 arbitrary bytes

# Build a well-formed packet the way Alice would have.
tag = hmac.new(mu, hop_payloads + payment_hash, hashlib.sha256).digest()
packet = b"\\x00" + bytes(range(33)) + hop_payloads + tag
print(f"packet length: {len(packet)} bytes (want 1366)")

def check(p):
    recomputed = hmac.new(mu, p[34:1334] + payment_hash, hashlib.sha256).digest()
    return hmac.compare_digest(recomputed, p[1334:1366])

print(f"untouched packet verifies? {check(packet)}")

# Tamper: flip one byte deep inside hop_payloads.
bad = bytearray(packet)
bad[100] ^= 0x01
print(f"one flipped byte verifies? {check(bytes(bad))}")
`,
    starterCode: `import hmac, hashlib

def verify_hmac(packet, mu, associated_data):
    """
    Verify the integrity tag on an inbound BOLT 4 onion packet.

    Args:
      packet:           1366-byte BOLT 4 onion packet
                        (1 version + 33 E_i + 1300 hop_payloads + 32 hmac)
      mu:               this hop's 32-byte mu key (HMAC-SHA256(b"mu", ss_i))
      associated_data:  32-byte payment_hash bound into the HMAC by the sender

    Returns: None if the HMAC verifies, otherwise the BOLT 4 failure code
    "invalid_onion_hmac". A packet that is not exactly 1366 bytes never verifies.

    Use hmac.compare_digest for the comparison (constant-time, no timing leak).
    """
    # TODO: implement
    pass
`,
    testCode: `# Build a packet with a known mu and associated_data so we know the
# expected HMAC. Then test the function on the well-formed packet AND
# a tampered version.

MU = bytes.fromhex("0202020202020202020202020202020202020202020202020202020202020202")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
HOP_PAYLOADS = bytes((i % 256) for i in range(1, 1301))  # 1,300 arbitrary bytes
EPHEMERAL_PUBKEY = bytes(range(33))   # 33 arbitrary bytes

# Compute the HMAC the way Alice would have during construction.
expected_hmac = hmac.new(MU, HOP_PAYLOADS + PAYMENT_HASH, hashlib.sha256).digest()
GOOD_PACKET = b"\\x00" + EPHEMERAL_PUBKEY + HOP_PAYLOADS + expected_hmac
assert len(GOOD_PACKET) == 1366

def test_well_formed_packet_verifies():
    assert verify_hmac(GOOD_PACKET, MU, PAYMENT_HASH) is None, "A well-formed packet must verify (return None); check the slices (hop_payloads = packet[34:1334], hmac = packet[1334:1366]) and that associated_data is appended to the message"

def test_tampered_hop_payloads_fails():
    # Flip a byte in the hop_payloads field.
    tampered = bytearray(GOOD_PACKET)
    tampered[100] ^= 0x01
    assert verify_hmac(bytes(tampered), MU, PAYMENT_HASH) == "invalid_onion_hmac", "A flipped byte inside hop_payloads must break the HMAC (the tag commits to every byte)"

def test_tampered_hmac_fails():
    # Flip a byte in the HMAC field.
    tampered = bytearray(GOOD_PACKET)
    tampered[-1] ^= 0x01
    assert verify_hmac(bytes(tampered), MU, PAYMENT_HASH) == "invalid_onion_hmac", "A modified HMAC field must fail the comparison"

def test_wrong_associated_data_fails():
    wrong_hash = bytes(32)
    assert verify_hmac(GOOD_PACKET, MU, wrong_hash) == "invalid_onion_hmac", "A different associated_data must fail: the payment_hash is part of the HMAC'd message, binding the onion to one HTLC"

def test_wrong_mu_fails():
    wrong_mu = bytes(32)
    assert verify_hmac(GOOD_PACKET, wrong_mu, PAYMENT_HASH) == "invalid_onion_hmac", "A different mu key must fail; only the right per-hop key verifies"

def test_short_packet_fails():
    short = GOOD_PACKET[:1000]
    assert verify_hmac(short, MU, PAYMENT_HASH) == "invalid_onion_hmac", "A packet that is not exactly 1366 bytes must fail with invalid_onion_hmac (do the length check first)"

def test_long_packet_fails():
    long_packet = GOOD_PACKET + b"\\x00"
    assert verify_hmac(long_packet, MU, PAYMENT_HASH) == "invalid_onion_hmac", "A packet that is not exactly 1366 bytes must fail with invalid_onion_hmac (do the length check first)"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> recompute the HMAC tag the sender baked into the packet and compare it against the inbound HMAC field." +
        "<br><br><strong>Why this is the first thing the forwarder does:</strong> if the HMAC doesn't verify, we don't trust any of the bytes in the packet. We don't decrypt, we don't parse the TLV, we don't run any of our parser code on adversarial input. Encrypt-then-MAC means we authenticate the encrypted ciphertext as it appears on the wire, before anything else." +
        "<br><br><strong>Why associated_data is part of the HMAC:</strong> the <code>payment_hash</code> binds the onion to a specific HTLC. An attacker can't lift this onion off one HTLC and re-attach it to another, since the HMAC won't verify with a different <code>payment_hash</code>.",
      steps:
        "<strong>1. Length check.</strong> If <code>len(packet) != 1366</code>, return <code>\"invalid_onion_hmac\"</code>." +
        "<br><strong>2. Slice the fields:</strong>" +
        "<br><code>hop_payloads = packet[34:1334]\ninbound_hmac = packet[1334:1366]</code>" +
        "<br><strong>3. Compute the expected HMAC:</strong>" +
        "<br><code>expected = hmac.new(mu, hop_payloads + associated_data, hashlib.sha256).digest()</code>" +
        "<br><strong>4. Constant-time compare:</strong>" +
        "<br><code>return None if hmac.compare_digest(expected, inbound_hmac) else \"invalid_onion_hmac\"</code>",
      code:
        `import hmac, hashlib

def verify_hmac(packet, mu, associated_data):
    if len(packet) != 1366:
        return "invalid_onion_hmac"
    hop_payloads = packet[34:1334]
    inbound_hmac = packet[1334:1366]
    expected = hmac.new(mu, hop_payloads + associated_data, hashlib.sha256).digest()
    return None if hmac.compare_digest(expected, inbound_hmac) else "invalid_onion_hmac"
`,
    },
    rewardSats: 40,
    group: "sphinx/forwarder",
    groupOrder: 2,
  },

  "exercise-check-forward-draft": {
    id: "exercise-check-forward-draft",
    title: "Check the Forwarding Policy",
    description:
      "Implement <code>check_forward(incoming_amount_msat, incoming_cltv_expiry, amt_to_forward, outgoing_cltv_value, policy) -> str | None</code>. Once the HMAC verifies and the layer is peeled, the forwarder reads the requested <code>amt_to_forward</code> and <code>outgoing_cltv_value</code> from the hop payload and must decide whether forwarding is actually safe. " +
      "To do this, the forwarder must ensure the incoming HTLC has enough margin to (a) cover the fee it advertised and (b) keep enough timelock cushion to claim the downstream HTLC before its own upstream HTLC expires. " +
      "The <code>policy</code> argument is the provided <code>ForwardingPolicy</code> dataclass carrying this hop's BOLT 7 <code>channel_update</code> fields (<code>fee_base_msat</code>, <code>fee_proportional_millionths</code>, <code>cltv_expiry_delta</code>). To complete this exercise, you must return a BOLT 4 failure-code string when a check fails, or <code>None</code> when it is safe to forward.",
    sampleCode: `# Forwarding-policy sandbox - play with the fee and CLTV margins.
#
# The forwarder keeps (incoming - amt_to_forward) as its fee, and keeps
# (incoming_cltv - outgoing_cltv) blocks of timelock cushion. Both margins must
# cover what this hop advertised. ForwardingPolicy is in scope at runtime.

policy = ForwardingPolicy(
    fee_base_msat=1000,                 # 1 sat flat
    fee_proportional_millionths=1000,   # 0.1% (1000 ppm)
    cltv_expiry_delta=40,               # 40-block cushion
)

amt_to_forward = 10_000_000     # msat the payload asks us to send onward
incoming_amount = 10_011_000    # msat we were offered on the incoming HTLC
incoming_cltv = 700_050         # incoming HTLC expiry height
outgoing_cltv = 700_000         # requested outgoing HTLC expiry height

# Fee math: base + proportional, integer division as BOLT 7 specifies.
required_fee = policy.fee_base_msat + (amt_to_forward * policy.fee_proportional_millionths) // 1_000_000
offered_fee = incoming_amount - amt_to_forward
print(f"required fee: {required_fee} msat,  offered fee: {offered_fee} msat")
print(f"fee ok? {offered_fee >= required_fee}")

# Timelock math: the gap between the two HTLCs must cover cltv_expiry_delta.
cushion = incoming_cltv - outgoing_cltv
print(f"\\ncushion: {cushion} blocks,  required delta: {policy.cltv_expiry_delta}")
print(f"cltv ok? {cushion >= policy.cltv_expiry_delta}")
`,
    starterCode: `# ForwardingPolicy is provided (in scope at runtime). It carries this hop's
# advertised BOLT 7 channel_update fields:
#     ForwardingPolicy(fee_base_msat, fee_proportional_millionths, cltv_expiry_delta)
#
# amt_to_forward and outgoing_cltv_value are already parsed out of the peeled
# hop payload (the type-2 and type-4 TLV records). Treat them as given; TLV
# parsing is not part of this exercise.

def check_forward(incoming_amount_msat, incoming_cltv_expiry,
                  amt_to_forward, outgoing_cltv_value, policy):
    """
    Decide whether this hop can safely forward the HTLC.

    Args:
      incoming_amount_msat:  msat offered to this hop on the incoming HTLC
      incoming_cltv_expiry:  absolute block height the incoming HTLC expires at
      amt_to_forward:        msat the hop payload asks this hop to send downstream
      outgoing_cltv_value:   absolute block height requested for the outgoing HTLC
      policy:                ForwardingPolicy(fee_base_msat,
                             fee_proportional_millionths, cltv_expiry_delta)

    Returns:
      None when it is safe to forward, otherwise the BOLT 4 failure code:
        "fee_insufficient"       the incoming amount doesn't cover
                                 amt_to_forward plus this hop's advertised fee
        "incorrect_cltv_expiry"  the timelock cushion between the two HTLCs
                                 is smaller than the advertised cltv_expiry_delta

    Run the fee check first: when both would fail, return "fee_insufficient".
    """
    # TODO: implement
    pass
`,
    testCode: `# Realistic policy: 1 sat (1000 msat) base fee, 0.1% proportional (1000 ppm),
# 40-block CLTV delta. These are the BOLT 7 channel_update fields this hop
# advertises to the rest of the network.
POLICY = ForwardingPolicy(
    fee_base_msat=1000,
    fee_proportional_millionths=1000,
    cltv_expiry_delta=40,
)

# Forwarding 10,000,000 msat at 1000 ppm => 10,000 msat proportional,
# + 1000 msat base = 11,000 msat required fee.
AMT_TO_FORWARD = 10_000_000
REQUIRED_FEE = 1000 + (AMT_TO_FORWARD * 1000) // 1_000_000  # == 11_000

# Outgoing CLTV chosen well clear of any min-final cushion.
OUTGOING_CLTV = 700_000

def test_exact_fee_is_accepted():
    """incoming - amt_to_forward == required_fee is the boundary: still safe."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE  # exactly covers the fee
    result = check_forward(incoming, OUTGOING_CLTV + 40, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result is None, f"Exact fee must be accepted, got {result!r}"

def test_one_msat_short_on_fee_fails():
    """One msat below the required fee must fail with the BOLT 4 code."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE - 1
    result = check_forward(incoming, OUTGOING_CLTV + 40, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result == "fee_insufficient", f"Expected 'fee_insufficient', got {result!r}"

def test_generous_fee_is_accepted():
    """More than enough fee is obviously fine."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE + 5_000
    result = check_forward(incoming, OUTGOING_CLTV + 40, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result is None, f"Generous fee must be accepted, got {result!r}"

def test_exact_cltv_delta_is_accepted():
    """incoming_cltv - outgoing_cltv == cltv_expiry_delta is the boundary: still safe."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE + 5_000  # fee comfortably covered
    incoming_cltv = OUTGOING_CLTV + 40  # exactly the delta
    result = check_forward(incoming, incoming_cltv, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result is None, f"Exact CLTV delta must be accepted, got {result!r}"

def test_one_block_short_on_cltv_fails():
    """One block below the required delta must fail with the BOLT 4 code."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE + 5_000
    incoming_cltv = OUTGOING_CLTV + 39  # one short of the 40-block delta
    result = check_forward(incoming, incoming_cltv, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result == "incorrect_cltv_expiry", f"Expected 'incorrect_cltv_expiry', got {result!r}"

def test_clean_all_pass():
    """A comfortably-funded, comfortably-timed HTLC forwards cleanly."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE + 50_000   # well over the fee
    incoming_cltv = OUTGOING_CLTV + 144                 # ~1 day of extra cushion
    result = check_forward(incoming, incoming_cltv, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result is None, f"A clean HTLC must forward (None), got {result!r}"

def test_fee_checked_before_cltv():
    """When both checks would fail, return the fee failure first (the
    docstring specifies the fee check runs first)."""
    incoming = AMT_TO_FORWARD + REQUIRED_FEE - 1        # fee too low
    incoming_cltv = OUTGOING_CLTV + 39                  # AND cltv too tight
    result = check_forward(incoming, incoming_cltv, AMT_TO_FORWARD, OUTGOING_CLTV, POLICY)
    assert result == "fee_insufficient", f"Fee must be checked before CLTV, got {result!r}"

def test_proportional_only_policy():
    """A zero base-fee, purely proportional policy must use floor division, not
    rounding. The amount and ppm here are chosen so the exact product is
    9,999,998,000 / 1,000,000 = 9999.998: floor gives 9999, while round() or
    ceil() would give 10000. An implementation that rounds up would wrongly
    reject the exactly-covered case below."""
    policy = ForwardingPolicy(fee_base_msat=0, fee_proportional_millionths=2000, cltv_expiry_delta=10)
    amt = 4_999_999
    required = 0 + (amt * 2000) // 1_000_000  # 4_999_999 * 2000 // 1_000_000 == 9999
    assert required == 9999, "floor division of the proportional fee must be 9999"
    # Exactly covered -> safe (floor=9999; a round/ceil impl would demand 10000 and fail here).
    ok = check_forward(amt + required, OUTGOING_CLTV + 10, amt, OUTGOING_CLTV, policy)
    assert ok is None, f"Exact proportional fee must be accepted, got {ok!r}"
    # One msat short -> fail.
    bad = check_forward(amt + required - 1, OUTGOING_CLTV + 10, amt, OUTGOING_CLTV, policy)
    assert bad == "fee_insufficient", f"Expected 'fee_insufficient', got {bad!r}"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> given everything already parsed out of the onion, decide if forwarding is safe by re-checking the two promises this hop made to the network." +
        "<br><br><strong>You're re-checking the sender's arithmetic.</strong> When Alice built the route back in chapter 2 she budgeted a fee and a timelock cushion for every hop, so the amounts arriving here should already leave this forwarder whole. It doesn't take that on faith, though: it recomputes both margins from its own advertised policy and forwards only if they hold." +
        "<br><br><strong>Fee = what the hop keeps.</strong> The forwarder receives <code>incoming_amount_msat</code> and is asked to send <code>amt_to_forward</code> downstream. The difference is its fee. That difference has to be at least the fee it advertised in its <code>channel_update</code>, or it loses money relaying the payment." +
        "<br><br><strong>CLTV delta = claim-before-you-pay cushion.</strong> The forwarder pays the downstream HTLC first, then claims the upstream one. It needs <code>cltv_expiry_delta</code> blocks between the two expiries so a downstream delay can never leave it having paid out without time left to get paid back." +
        "<br><br><strong>Why these exact strings:</strong> <code>fee_insufficient</code> and <code>incorrect_cltv_expiry</code> are real BOLT 4 failure codes. Returning them verbatim is what lets a real Lightning sender understand why the hop refused and re-route.",
      steps:
        "<strong>1. Required fee (BOLT 7 formula):</strong>" +
        "<br><code>required_fee = policy.fee_base_msat + (amt_to_forward * policy.fee_proportional_millionths) // 1_000_000</code>" +
        "<br>Use integer floor division (<code>//</code>) exactly as written; that is what the spec mandates." +
        "<br><strong>2. Fee check:</strong> fail if the inbound amount minus what you forward cannot cover the required fee:" +
        "<br><code>if incoming_amount_msat - amt_to_forward < required_fee:\n    return \"fee_insufficient\"</code>" +
        "<br><strong>3. CLTV check:</strong> fail if the timelock delta is below the policy minimum:" +
        "<br><code>if incoming_cltv_expiry - outgoing_cltv_value < policy.cltv_expiry_delta:\n    return \"incorrect_cltv_expiry\"</code>" +
        "<br><strong>4. Otherwise:</strong> return <code>None</code> (safe to forward)." +
        "<br><br>Check the fee first, then the CLTV, matching the order the docstring specifies.",
      code:
        `def check_forward(incoming_amount_msat, incoming_cltv_expiry,
                  amt_to_forward, outgoing_cltv_value, policy):
    required_fee = (
        policy.fee_base_msat
        + (amt_to_forward * policy.fee_proportional_millionths) // 1_000_000
    )
    if incoming_amount_msat - amt_to_forward < required_fee:
        return "fee_insufficient"
    if incoming_cltv_expiry - outgoing_cltv_value < policy.cltv_expiry_delta:
        return "incorrect_cltv_expiry"
    return None`,
    },
    rewardSats: 75,
    group: "sphinx/forwarder",
    groupOrder: 3,
  },

  "exercise-peel-layer-draft": {
    id: "exercise-peel-layer-draft",
    title: "Peel a Single Layer",
    description:
      "Implement <code>OnionForwarder.peel_layer</code>. Given a 1366-byte BOLT 4 onion packet and the forwarder's 32-byte node private key, return <code>(next_packet, payload_bytes, shared_secret)</code>. " +
      "Hop payloads are bigsize-length-prefixed (as in BOLT 4); use <code>parse_bigsize</code> to read the length. " +
      "HMAC validation is skipped here (it is covered in chapter 10). This function covers the ECDH, the keystream-extended XOR, hop payload extraction, and ephemeral pubkey advancement.",
    sampleCode: `# Peel sandbox - run the building blocks of one hop in isolation.
#
# Peeling is: ECDH to recover ss -> derive rho -> XOR-decrypt the 1300-byte
# buffer (extended so the next hop's HMAC shifts into view) -> read this hop's
# bigsize-prefixed payload off the front. Helpers in scope: ecdh, generate_key,
# chacha20_keystream, xor_bytes, parse_bigsize, privkey_to_pubkey.

ROUTING_INFO_SIZE = 1300

# Alice's ephemeral key for hop 0, and Bob's node key.
session_key = bytes.fromhex("41" * 32)
bob_priv = bytes.fromhex("42" * 32)

E_0 = privkey_to_pubkey(session_key)          # the E_i carried in the packet
ss_alice = ecdh(session_key, privkey_to_pubkey(bob_priv))
ss_bob = ecdh(bob_priv, E_0)                  # Bob recovers the SAME secret
print(f"shared secrets agree? {ss_alice == ss_bob}")

rho = generate_key("rho", ss_bob)
print(f"rho key: {rho.hex()[:16]}...")

# Bob extends the buffer by 1300 zero bytes before XOR so the inner layer's
# bytes shift into the readable window (this is how filler lines up).
buffer = bytes(ROUTING_INFO_SIZE)             # stand-in encrypted buffer
stream = chacha20_keystream(rho, ROUTING_INFO_SIZE * 2)
padded = xor_bytes(buffer + bytes(ROUTING_INFO_SIZE), stream)
print(f"decrypted+padded buffer: {len(padded)} bytes")

# A bigsize length prefix tells the forwarder how long THIS hop's payload is.
example = encode_bigsize(19) + b"\\x00" * 19
length, header = parse_bigsize(example, 0)
print(f"bigsize says payload is {length} bytes, prefix took {header} byte(s)")
`,
    starterCode: `    def peel_layer(self, packet, node_privkey):
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

        Follow chapter 9's walkthrough, steps 1-8. Step 3 (HMAC verification)
        is chapter 10's exercise, so skip it here; the inbound hmac field
        goes unused.

        Helpers in scope: ecdh, chacha20_keystream, xor_bytes,
        parse_bigsize(buf, offset) -> (length, header_len), point_mul_pubkey.
        """
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

# Build a fixed test packet using a BOLT 4-spec reference encoder so we can verify peeling.
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CHARLIE_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CHARLIE_PUB = privkey_to_pubkey(CHARLIE_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CHARLIE_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CHARLIE_PRIV, DAVE_PRIV]

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
        hop_size = len(payloads[i]) + 32
        shifted = bytearray(hop_size) + buf[:-hop_size]
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

def test_charlie_can_peel_next():
    """End-to-end: Bob's output is a valid input for Charlie's peel."""
    f = OnionForwarder()
    bob_out, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    next_out, charlie_payload, charlie_ss = f.peel_layer(bob_out, CHARLIE_PRIV)
    assert charlie_ss == SS_LIST[1], "Charlie's recovered ss must match the chain"
    assert charlie_payload == PAYLOADS[1], "Charlie's payload must round-trip through the peel"

def test_dave_can_peel_after_charlie():
    """Full route: peel through Bob, Charlie, then Dave. Confirms the BOLT 4 build
    correctly accounts for Dave's hop-payload size during filler placement."""
    f = OnionForwarder()
    bob_out, _, _ = f.peel_layer(PACKET, BOB_PRIV)
    charlie_out, _, _ = f.peel_layer(bob_out, CHARLIE_PRIV)
    _, dave_payload, dave_ss = f.peel_layer(charlie_out, DAVE_PRIV)
    assert dave_ss == SS_LIST[2], "Dave's recovered ss must match the chain"
    assert dave_payload == PAYLOADS[2], "Dave's payload must round-trip through the peel"
${BOLT4_ONION_VECTOR_TEST_FIXTURES}
def test_peels_the_official_bolt4_onion():
    """Interoperability: onion-test.json's packet is the canonical onion that
    LND, Core Lightning, and LDK all build byte-for-byte. Your peel_layer must
    walk it through all five official hops, recovering each published shared
    secret and hop payload, and surface the all-zero HMAC at the destination."""
    f = OnionForwarder()
    cur = BOLT4_EXPECTED_ONION
    for i in range(5):
        cur, payload, ss = f.peel_layer(cur, BOLT4_HOP_PRIVKEYS[i])
        assert ss == BOLT4_SHARED_SECRETS[i], f"Hop {i}: recovered shared secret must match the official vector"
        assert payload == BOLT4_PAYLOADS[i], f"Hop {i}: recovered hop payload must match the official vector"
    assert cur[1334:1366] == b"\\x00" * 32, "After the final hop, the forwarded HMAC field must be all zeros (the destination signal)"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> <code>peel_layer</code> is the inverse of <code>wrap_hop</code>. Take a 1366-byte packet, recover the key this hop shares with Alice, decrypt the routing region, read this hop's own hop payload off the front, and produce a fresh 1366-byte packet for the next hop, never changing its size. It returns <code>(next_packet, payload_bytes, shared_secret)</code>; the shared secret is handed back because the error path (chapter 11) needs it later." +
        "<br><br><strong>Deriving this hop's key:</strong> the packet's leading 33 bytes are Alice's ephemeral pubkey for this hop. Compute <code>ecdh</code> between this node's private key and that ephemeral key (then SHA256) to recover the same shared secret Alice used, and derive <code>rho</code> from it, the key that decrypts the routing region. Authenticating with <code>mu</code> is covered in chapter 10, so <code>peel_layer</code> skips it." +
        "<br><br><strong>Why the extended keystream:</strong> when this hop strips its hop payload off the front and shifts the inner contents forward, the trailing positions must contain the extension of this hop's rho<sub>i</sub> keystream. That's exactly what was XORed into the corresponding filler bytes during construction. Generating 2x the routing info size covers both the decrypted <code>hop_payloads</code> AND the keystream-extension that fills the gap." +
        "<br><br><strong>What to read, and what to forward:</strong> after decrypting, the front holds this hop's hop payload (a bigsize length prefix, the TLV, then a 32-byte HMAC that authenticates the next hop's view). Lift the payload, take the next hop's 1,300-byte <code>hop_payloads</code>, and reassemble: version, the next ephemeral key, the next <code>hop_payloads</code>, and the next HMAC. An all-zero next HMAC means this hop is the destination." +
        "<br><br><strong>Advancing the ephemeral key:</strong> each hop sees a different ephemeral key (Alice blinds it per hop so the packet can't be correlated). Compute the next one by blinding the current key with <code>SHA256(E_i || ss_i)</code>, so the downstream hop's ECDH lands on its own shared secret.",
      steps:
        "<em>Step numbers match chapter 9's walkthrough. Step 3 (HMAC verification) is chapter 10's exercise, so it's skipped here.</em>" +
        "<br><br><strong>1. Parse the packet:</strong>" +
        "<br><code>E_i = packet[1:34]\nhop_payloads = packet[34:1334]</code>" +
        "<br><strong>2. Derive keys:</strong> ss<sub>i</sub> = ecdh(node_privkey, <i>E</i><sub>i</sub>); rho<sub>i</sub> = HMAC(b\"rho\", ss<sub>i</sub>)." +
        "<br><strong>4. Extend, then decrypt:</strong>" +
        "<br><code>padded = hop_payloads + b\"\\x00\" * 1300\nwork = xor_bytes(padded, chacha20_keystream(rho, 2600))</code>" +
        "<br><strong>5. Read the payload at the front:</strong>" +
        "<br><code>length, header_len = parse_bigsize(padded, 0)\npayload = padded[0:header_len + length]\nhop_size = header_len + length + 32  # prefix + TLVs + 32-byte HMAC\nnext_hmac = padded[hop_size - 32:hop_size]</code>" +
        "<br><strong>6. Lift the next 1,300 bytes:</strong>" +
        "<br><code>next_hop_payloads = padded[hop_size : hop_size + 1300]</code>" +
        "<br><strong>7. Advance the ephemeral key:</strong>" +
        "<br><code>b = SHA256(E_i + ss)\nE_next = point_mul_pubkey(E_i, b)</code>" +
        "<br><strong>8. Assemble the outgoing packet:</strong>" +
        "<br><code>b\"\\x00\" + E_next + next_hop_payloads + next_hmac</code>",
      code:
        `    def peel_layer(self, packet, node_privkey):
        # Step 1. Parse the four packet fields.
        E_i = packet[1:34]
        hop_payloads = packet[34:1334]

        # Step 2. Derive rho_B from the ECDH shared secret with the sender.
        # (Step 3, HMAC verification, lands in chapter 10's exercise.)
        ss = ecdh(node_privkey, E_i)
        rho = hmac.new(b"rho", ss, hashlib.sha256).digest()

        # Step 4. Extend the buffer to 2x routing size, then XOR with the keystream.
        padded = hop_payloads + b"\\x00" * ROUTING_INFO_SIZE
        stream = chacha20_keystream(rho, 2 * ROUTING_INFO_SIZE)
        padded = xor_bytes(padded, stream)

        # Step 5. Read this hop's payload at the front:
        #   bigsize_LEN || TLV records (length bytes) || next_hmac (32 bytes).
        length, header_len = parse_bigsize(padded, 0)
        payload = padded[0:header_len + length]
        hop_size = header_len + length + 32
        next_hmac = padded[hop_size - 32:hop_size]

        # Step 6. Lift the next 1,300 bytes as the outgoing hop_payloads.
        next_hop_payloads = padded[hop_size:hop_size + ROUTING_INFO_SIZE]

        # Step 7. Advance the ephemeral pubkey via the blinding factor.
        b = hashlib.sha256(E_i + ss).digest()
        E_next = point_mul_pubkey(E_i, b)

        # Step 8. Assemble the outgoing packet: version || E_next || hop_payloads || hmac.
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
      "Implement <code>OnionPacketBuilder.wrap_hop</code>. Given the current 1300-byte buffer, this hop's bigsize-prefixed payload, the next-hop HMAC, this hop's <code>rho</code>/<code>mu</code> keys, and the payment's <code>associated_data</code> (32-byte <code>payment_hash</code>), produce the new buffer (after shift + write + XOR) and the HMAC computed over <code>(new_buffer || associated_data)</code> per BOLT 4.",
    sampleCode: `# Wrap-a-layer sandbox - one iteration of the build loop, on a tiny buffer.
#
# Each wrap: prepend this hop's payload + next_hmac to the front, drop the last
# hop_size bytes to stay fixed-size, XOR the whole thing with the rho keystream,
# then MAC the result. We use a small ROUTING_INFO_SIZE here so you can read the bytes.
# Helpers in scope: chacha20_keystream, xor_bytes, generate_key.

ROUTING_INFO_SIZE = 32   # tiny on purpose; the real field is 1300

ss = bytes.fromhex("42" * 32)
rho = generate_key("rho", ss)
mu = generate_key("mu", ss)
assoc = bytes.fromhex("11" * 32)

buffer = bytes(ROUTING_INFO_SIZE)              # start: pad noise (zeros here)
payload = b"BOB"                               # this hop's bytes (toy)
next_hmac = b"\\x00" * 32                       # all-zero for the destination

# Step 1: prepend this hop's bytes (payload + next_hmac), drop the tail.
chunk = payload + next_hmac
new_buffer = (chunk + buffer)[:ROUTING_INFO_SIZE]
print(f"after write: {new_buffer.hex()}")

# Step 2: XOR-encrypt the whole buffer with the rho keystream.
encrypted = xor_bytes(new_buffer, chacha20_keystream(rho, ROUTING_INFO_SIZE))
print(f"after XOR:   {encrypted.hex()}")

# Step 4: this hop's HMAC commits to (new_buffer || associated_data).
this_hmac = hmac.new(mu, encrypted + assoc, hashlib.sha256).digest()
print(f"this hop's hmac: {this_hmac.hex()[:16]}...")
`,
    starterCode: `    def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data, filler=None):
        """
        Args:
          buffer:           current 1300-byte hop_payloads buffer (bytes)
          payload:          this hop's bigsize-prefixed TLV records,
                            as bigsize_LEN || TLV_bytes (variable length)
          next_hmac:        32-byte HMAC pointing to the inner layer
                            (all zeros for the destination hop)
          rho:              this hop's 32-byte rho key
          mu:               this hop's 32-byte mu key
          associated_data:  32-byte payment_hash for HTLC payments
                            (BOLT 4 binds the onion to the payment via this field)
          filler:           precomputed filler bytes, or None. Only the innermost
                            (destination) hop gets a filler; build passes None for
                            every forwarder. When given, overlay it onto the buffer
                            tail BEFORE computing the HMAC so the single HMAC covers it.

        Returns: (new_buffer, this_hop_hmac)
          new_buffer:     the rewritten + encrypted 1300-byte buffer
          this_hop_hmac:  the 32-byte tag the layer above will commit to

        The moves are chapter 8's steps 1-4 for one iteration. Step 3 (the filler
        overlay) runs only when filler is not None.

        Helpers in scope: chacha20_keystream(key, length), xor_bytes(a, b).
        """
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

def reference_wrap_hop(buffer, payload, next_hmac, rho, mu, ad, filler=None):
    hop_size = len(payload) + 32
    new_buffer = payload + next_hmac + buffer[:-hop_size]
    stream = chacha20_keystream(rho, ROUTING_INFO_SIZE)
    encrypted = bytearray(xor_bytes(bytes(new_buffer), stream))
    if filler is not None:
        encrypted[ROUTING_INFO_SIZE - len(filler):] = filler
    tag = hmac.new(mu, bytes(encrypted) + ad, hashlib.sha256).digest()
    return bytes(encrypted), tag

# Test vector. Use nonzero bytes so the tests catch implementations that forget
# to preserve the shifted inner buffer.
INIT_BUFFER = bytes((i * 37 + 11) % 256 for i in range(ROUTING_INFO_SIZE))
# Arbitrary opaque bytes; wrap_hop never parses the payload it is given.
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
    # Frozen anchor: pin the exact output for these fixed inputs so a bug shared
    # by both this function and reference_wrap_hop above can't slip through.
    EXPECTED_BUFFER_SHA256 = "d39f90dd163bae1b55db12ec67aa00fb5081871ebee50d9750d59ed5ce52d0e5"
    EXPECTED_TAG_HEX = "d0c6c69969d1dd0a0ca955e105b2acb6506da05d318291aaa6edd0116f3e54b8"
    assert hashlib.sha256(new_buf).hexdigest() == EXPECTED_BUFFER_SHA256, "Encrypted buffer must match the frozen wrap_hop anchor for these inputs"
    assert tag.hex() == EXPECTED_TAG_HEX, "HMAC tag must match the frozen wrap_hop anchor for these inputs"

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

def test_shift_preserves_existing_inner_buffer():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    new_buf, _ = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    plaintext = xor_bytes(new_buf, chacha20_keystream(RHO, ROUTING_INFO_SIZE))
    hop_size = len(PAYLOAD) + 32
    assert plaintext[hop_size:] == INIT_BUFFER[:-hop_size], "Bytes after this hop's hop payload must be the shifted previous buffer"

def test_filler_overlay_runs_before_hmac():
    """Innermost hop: a filler= argument must overwrite the buffer tail, and the
    HMAC must be computed AFTER that overlay (so it covers the filler bytes)."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    filler = bytes((i * 7 + 3) % 256 for i in range(140))
    new_buf, tag = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH, filler=filler)
    assert new_buf[ROUTING_INFO_SIZE - len(filler):] == filler, "filler must overwrite the trailing len(filler) bytes"
    ref_buf, ref_tag = reference_wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH, filler=filler)
    assert new_buf == ref_buf and tag == ref_tag, "filler path must match the reference"
    _, no_filler_tag = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    assert tag != no_filler_tag, "HMAC must be computed after the overlay, so it differs from the no-filler tag"

def test_no_filler_default_unchanged():
    """Forwarder hops pass no filler; default must behave exactly as before."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    with_default = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH)
    explicit_none = b.wrap_hop(INIT_BUFFER, PAYLOAD, NEXT_HMAC, RHO, MU, PAYMENT_HASH, filler=None)
    assert with_default == explicit_none, "filler=None must match the no-argument call"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> perform one iteration of the build loop. Take the current buffer, the new hop's data, the inner-layer HMAC, and produce a buffer that has this hop's data at the front (encrypted with rho) plus the HMAC over (new_buffer || associated_data) for use by the layer above." +
        "<br><br><strong>Hop-payload size:</strong> the bytes consumed by this hop = len(payload) + 32 (HMAC). The 'shift right' makes room for those bytes at the front by pushing existing contents back." +
        "<br><br><strong>Why associated_data:</strong> BOLT 4 binds the onion to a specific HTLC by including the 32-byte <code>payment_hash</code> in every hop's HMAC. A forwarder receiving the onion attached to a different <code>payment_hash</code> gets a HMAC mismatch and rejects the packet. This is what stops an attacker from re-attaching a captured onion to a different payment." +
        "<br><br><strong>The filler (innermost hop only):</strong> the destination's call passes a <code>filler</code> argument; forwarders pass <code>None</code>. When present, overwrite the trailing <code>len(filler)</code> bytes of the encrypted buffer with it BEFORE computing the HMAC, so the one HMAC commits to it. That's the full BOLT 4 sequence for an iteration: prepend the new front, XOR, overlay filler, then a single HMAC. (There is no second HMAC; the filler goes in before the only one.)",
      steps:
        "<strong>1. Compute the hop size.</strong>" +
        "<br><code>hop_size = len(payload) + 32</code>" +
        "<br><strong>2. Prepend this hop's data, drop the tail.</strong> Build the new front (<code>payload + next_hmac</code>) and keep all but the last <code>hop_size</code> bytes of the old buffer, in a single line:" +
        "<br><code>new_buffer = payload + next_hmac + buffer[:-hop_size]</code>" +
        "<br><strong>3. Encrypt</strong> the whole buffer by XOR-ing with this hop's keystream (keep it a <code>bytearray</code> so step 4 can patch it):" +
        "<br><code>stream = chacha20_keystream(rho, ROUTING_INFO_SIZE)\nencrypted = bytearray(xor_bytes(bytes(new_buffer), stream))</code>" +
        "<br><strong>4. Overlay the filler (innermost hop only).</strong> If <code>filler is not None</code>, overwrite the tail BEFORE the HMAC so the single HMAC covers it:" +
        "<br><code>encrypted[ROUTING_INFO_SIZE - len(filler):] = filler</code>" +
        "<br><strong>5. HMAC</strong> the (possibly filler-patched) buffer with <code>associated_data</code> appended:" +
        "<br><code>tag = hmac.new(mu, bytes(encrypted) + associated_data, hashlib.sha256).digest()</code>" +
        "<br><strong>6. Return</strong> the encrypted buffer and its tag:" +
        "<br><code>return bytes(encrypted), tag</code>",
      code:
        `    def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data, filler=None):
        hop_size = len(payload) + 32
        new_buffer = payload + next_hmac + buffer[:-hop_size]
        stream = chacha20_keystream(rho, ROUTING_INFO_SIZE)
        encrypted = bytearray(xor_bytes(bytes(new_buffer), stream))
        if filler is not None:                       # innermost hop only
            encrypted[ROUTING_INFO_SIZE - len(filler):] = filler
        tag = hmac.new(mu, bytes(encrypted) + associated_data, hashlib.sha256).digest()
        return bytes(encrypted), tag`,
    },
    rewardSats: 75,
    group: "sphinx/builder",
    groupOrder: 3,
  },

  "exercise-build-packet-draft": {
    id: "exercise-build-packet-draft",
    title: "Build the Full Onion Packet",
    description:
      "Implement <code>OnionPacketBuilder.build</code>. The setup, the per-hop keys, the filler, and the pad-noise buffer, is provided for you in the starter, re-using the <code>derive_keys</code> (chapter 6) and <code>generate_filler</code> (chapter 7) functions you already wrote and were tested on. " +
      "Your job is the integration that's new this chapter: wrap the hops inside-out with <code>wrap_hop</code> (threading <code>next_hmac</code>, laying the filler in once), then assemble the final 1366-byte BOLT 4 packet (version || ephemeral_pubkey || hop_payloads || hmac).",
    sampleCode: `# Build-loop sandbox - watch the inside-out wrap order and the shape of the
# finished packet, without the full 1300-byte machinery.
#
# build() does four things: (1) derive per-hop rho/mu, (2) seed the buffer with
# pad-key NOISE (not zeros), (3) wrap destination-first so each layer's HMAC can
# cover the one beneath it, (4) assemble version || E_0 || buffer || hmac.
# Helpers in scope: generate_key, chacha20_keystream.

ROUTING_INFO_SIZE = 1300
route = ["Bob", "Charlie", "Dave"]            # Dave is the destination

# Per-hop keys come from each hop's shared secret (faked here as a label hash).
shared_secrets = [generate_key("ss", h.encode()) for h in route]
rho_keys = [generate_key("rho", ss) for ss in shared_secrets]
print("per-hop rho keys:")
for name, k in zip(route, rho_keys):
    print(f"  {name:>8}: {k.hex()[:16]}...")

# The buffer starts as pad-key keystream so the unused tail can't reveal a
# short route. The pad key comes from the SESSION key, not a hop secret.
session_key = bytes.fromhex("41" * 32)
pad_key = generate_key("pad", session_key)
buffer = chacha20_keystream(pad_key, ROUTING_INFO_SIZE)
print(f"\\npad-noise buffer: {len(buffer)} bytes, first 8 = {buffer[:8].hex()}")

# Wrap order is reversed(route): destination first, first hop last (outermost).
print("\\nwrap order (inside-out):")
for name in reversed(route):
    print(f"  wrap {name}")

# Final packet shape: 1 + 33 + 1300 + 32 = 1366 bytes.
print(f"\\nfinal packet size = 1 + 33 + {ROUTING_INFO_SIZE} + 32 = {1 + 33 + ROUTING_INFO_SIZE + 32}")
`,
    starterCode: `    def build(self, payloads, associated_data):
        """
        Assemble the final 1366-byte BOLT 4 onion packet:
          version(1) || ephemeral_pubkey(33) || hop_payloads(1300) || hmac(32)

        The setup below just re-uses functions you already wrote (and were tested
        on): derive_keys (ch6) and generate_filler (ch7). Read it, then write the
        two new pieces: the inside-out wrap loop and the final assembly. That loop
        is onion routing's core construction, we wrap destination-first so each
        layer's HMAC can commit to the one beneath it.

        In scope: self.wrap_hop (chapter 8), self.ephemeral_pubkeys.
        """
        # --- Provided: re-application of earlier chapters (nothing new here) ---
        # ch6 derive_keys, per hop, off the secrets already on self:
        keys = [derive_keys(ss) for ss in self.shared_secrets]

        # ch7 generate_filler, for the FORWARDERS only (slice off the destination,
        # which doesn't shift). A hop occupies len(payload) + 32 bytes:
        filler = self.generate_filler(
            [k.rho for k in keys[:-1]],
            [len(p) + 32 for p in payloads[:-1]],
        )

        # Seed the 1300-byte buffer with pad-key NOISE (not zeros) so a short route
        # can't be detected from the trailing bytes. The pad key is off the SESSION
        # key, not a hop secret:
        pad_key = derive_keys(self.session_key).pad
        buffer = bytearray(chacha20_keystream(pad_key, ROUTING_INFO_SIZE))

        # Pair each payload with its hop's rho/mu so the loop reads cleanly:
        hops = [(p, k.rho, k.mu) for p, k in zip(payloads, keys)]

        # ---------------- Your job starts here ----------------
        # Build the onion inside-out (chapter 8's "Wrap, step by step"). hops is
        # in route order (first forwarder ... destination), so the destination is
        # the last entry.
        #   1. Wrap the destination first, the only hop that gets the filler.
        #      Nothing sits beneath it, so its incoming next_hmac is all zeros.
        #   2. Wrap the remaining hops outward, no filler, threading each
        #      wrap_hop's returned hmac in as the next call's next_hmac.
        #   3. Assemble and return the packet in the docstring's layout:
        #      version || first ephemeral pubkey || buffer || final hmac.
        # wrap_hop returns (new_buffer, this_hop_hmac).
        # TODO: implement
        pass
`,
    testCode: `import hmac, hashlib

ROUTING_INFO_SIZE = 1300

# Reuse test vectors from the shared-secrets exercise
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CHARLIE_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")
PAYMENT_HASH = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CHARLIE_PUB = privkey_to_pubkey(CHARLIE_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CHARLIE_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CHARLIE_PRIV, DAVE_PRIV]

# Bigsize-prefixed TLV payloads. Variable-length destination (different hop-payload size from forwarders) so
# the test exercises the filler-after-innermost-wrap fix.
RAW_TLVS = [
    bytes.fromhex("0203989a900401b40608000000012345678920"),  # 19 bytes
    bytes.fromhex("0203989a900401b40608000000012345678921"),  # 19 bytes
    bytes.fromhex("0203989a90040181" + "aa" * 32),            # 40 bytes (larger destination payload)
]
PAYLOADS = [encode_bigsize(len(t)) + t for t in RAW_TLVS]

${BOLT4_ONION_VECTOR_TEST_FIXTURES}
def test_returns_1366_bytes():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert isinstance(packet, (bytes, bytearray))
    assert len(packet) == 1366, f"Expected 1366 bytes, got {len(packet)}"

def test_version_byte():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert packet[0] == 0x00, "Version byte must be 0x00"

def test_ephemeral_pubkey_field():
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    assert packet[1:34] == b.ephemeral_pubkeys[0], "Bytes 1..34 must be E_0"

def test_hmac_validates_with_assoc_data():
    """Bob's verification: HMAC-SHA256(bob_mu, hop_payloads || associated_data) must match packet.hmac."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
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
    b.derive_shared_secrets()
    packet = b.build(PAYLOADS, PAYMENT_HASH)
    bob_ss = b.shared_secrets[0]
    bob_mu = hmac.new(b"mu", bob_ss, hashlib.sha256).digest()
    hop_payloads = packet[34:1334]
    bare_hmac = hmac.new(bob_mu, hop_payloads, hashlib.sha256).digest()
    assert bare_hmac != packet[1334:1366], "BOLT 4 mandates HMAC over hop_payloads || associated_data"

def test_initial_buffer_is_pad_noise_not_zeros():
    """Sanity: the buffer is initialized with pad-key keystream, not zeros.
    A buffer of all zeros (before wraps) would lead to detectable trailing patterns."""
    class SpyBuilder(OnionPacketBuilder):
        def __init__(self, session_key, hop_pubkeys):
            super().__init__(session_key, hop_pubkeys)
            self.first_buffer_seen = None

        def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data, filler=None):
            if self.first_buffer_seen is None:
                self.first_buffer_seen = bytes(buffer)
            return super().wrap_hop(buffer, payload, next_hmac, rho, mu, associated_data, filler=filler)

    b = SpyBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    b.build(PAYLOADS, PAYMENT_HASH)
    assert b.first_buffer_seen is not None, "build must call self.wrap_hop for each hop (this test instruments it)"
    pad_key = hmac.new(b"pad", SESSION_KEY, hashlib.sha256).digest()
    assert b.first_buffer_seen == chacha20_keystream(pad_key, ROUTING_INFO_SIZE), "Initial buffer must be pad-key ChaCha20 keystream, not zeros"

def test_matches_official_bolt4_onion_vector():
    b = OnionPacketBuilder(SESSION_KEY, BOLT4_HOP_PUBKEYS)
    b.derive_shared_secrets()
    packet = bytes(b.build(BOLT4_PAYLOADS, PAYMENT_HASH))
    if packet != BOLT4_EXPECTED_ONION:
        n = min(len(packet), len(BOLT4_EXPECTED_ONION))
        i = next((j for j in range(n) if packet[j] != BOLT4_EXPECTED_ONION[j]), n)
        region = ("version byte" if i < 1 else
                  "ephemeral pubkey (bytes 1-33)" if i < 34 else
                  "hop_payloads (bytes 34-1333); filler or wrap order are the usual suspects" if i < 1334 else
                  "outer hmac (bytes 1334-1365); check associated_data threading")
        assert False, f"Packet diverges from the official BOLT 4 vector at byte {i}, inside the {region}"

def test_end_to_end_peel_through_route():
    """Definitive correctness check: build a packet, peel it through every hop with HMAC validation.
    Validates initial buffer, filler placement, wrap order, and assoc_data threading all at once."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
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
        padded = bytearray(hop_payloads + b"\\x00" * ROUTING_INFO_SIZE)
        stream = chacha20_keystream(rho, 2 * ROUTING_INFO_SIZE)
        padded = bytes(a ^ b for a, b in zip(padded, stream))
        length, hl = parse_bigsize(padded, 0)
        payload = padded[:hl + length]
        assert payload == PAYLOADS[i], f"Hop {i}: extracted payload must match original"
        hop_size = hl + length + 32
        next_hmac = padded[hop_size - 32:hop_size]
        next_hop_payloads = padded[hop_size:hop_size + ROUTING_INFO_SIZE]
        bf = hashlib.sha256(E + ss).digest()
        E_next = point_mul_pubkey(E, bf)
        current = b"\\x00" + E_next + next_hop_payloads + next_hmac
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> the setup (per-hop keys via your ch6 <code>derive_keys</code>, the filler via your ch7 <code>generate_filler</code>, and the pad-noise buffer) is already written for you in the starter. Your job is the integration that's new here: wrapping the hops inside-out and assembling the packet." +
        "<br><br><strong>The destination is special.</strong> It's the innermost wrap AND the only hop that gets the filler, so wrap it on its own first. Its incoming <code>next_hmac</code> is 32 zero bytes (no inner layer beneath it), and you pass <code>filler=filler</code> so <code>wrap_hop</code> lays the filler in. (That overlay can only happen here, between the destination's XOR and its HMAC.)" +
        "<br><br><strong>Then the forwarders, outward.</strong> Loop the remaining hops with <code>reversed(hops[:-1])</code> (Charlie, then Bob), passing NO filler. Each <code>wrap_hop</code> returns <code>(new_buffer, this_hop_hmac)</code>; thread <code>this_hop_hmac</code> forward as the next <code>next_hmac</code>. The order is destination-first because each hop's HMAC commits to the layer beneath it, which must already exist." +
        "<br><br><strong>Assemble:</strong> the finished buffer is the 1300-byte hop_payloads field. Wrap the envelope: <code>b\"\\x00\"</code> (version) + <code>self.ephemeral_pubkeys[0]</code> (33-byte E_0) + the buffer + the final <code>next_hmac</code> (the outer HMAC). That is 1 + 33 + 1300 + 32 = 1366 bytes.",
      steps:
        "The setup (<code>keys</code>, <code>filler</code>, the pad-noise <code>buffer</code>, and the <code>hops</code> list) is already in the starter, so you write the wraps and the assembly." +
        "<br><strong>1. Wrap the destination, with the filler.</strong> It's the innermost hop (<code>hops[-1]</code>); its incoming HMAC is all-zero, and it's the only wrap that gets the filler:" +
        "<br><code>payload, rho, mu = hops[-1]\nbuffer, next_hmac = self.wrap_hop(\n    buffer, payload, b\"\\x00\" * 32, rho, mu, associated_data, filler=filler,\n)</code>" +
        "<br><strong>2. Wrap the forwarders, outward, with no filler.</strong> Walk <code>reversed(hops[:-1])</code> (Charlie, then Bob), threading next_hmac through each call:" +
        "<br><code>for payload, rho, mu in reversed(hops[:-1]):\n    buffer, next_hmac = self.wrap_hop(\n        buffer, payload, next_hmac, rho, mu, associated_data,\n    )</code>" +
        "<br><strong>3. Assemble</strong> version || E_0 || hop_payloads || hmac:" +
        "<br><code>return b\"\\x00\" + self.ephemeral_pubkeys[0] + bytes(buffer) + next_hmac</code>",
      code:
        `    def build(self, payloads, associated_data):
        # --- Provided in the starter (re-uses your earlier functions) ---
        keys = [derive_keys(ss) for ss in self.shared_secrets]
        filler = self.generate_filler(
            [k.rho for k in keys[:-1]],
            [len(p) + 32 for p in payloads[:-1]],
        )
        pad_key = derive_keys(self.session_key).pad
        buffer = bytearray(chacha20_keystream(pad_key, ROUTING_INFO_SIZE))
        hops = [(p, k.rho, k.mu) for p, k in zip(payloads, keys)]

        # --- What you write ---
        # The destination is the innermost wrap and the only hop with the filler:
        payload, rho, mu = hops[-1]
        buffer, next_hmac = self.wrap_hop(
            buffer, payload, b"\\x00" * 32, rho, mu, associated_data, filler=filler,
        )

        # The forwarders, outward (Charlie, then Bob), with no filler:
        for payload, rho, mu in reversed(hops[:-1]):
            buffer, next_hmac = self.wrap_hop(
                buffer, payload, next_hmac, rho, mu, associated_data,
            )

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
      "This is chapter 7's filler algorithm as a single function. " +
      "Helpers in scope: <code>chacha20_keystream</code>, <code>xor_bytes</code>.",
    sampleCode: `# Filler construction sandbox - explore the BOLT 4 algorithm
#
# Filler is built one iteration at a time. Each iteration:
#   1. Append \`size\` zero bytes (this hop's hop-payload size) to the filler
#   2. XOR the trailing len(filler) bytes of an extended rho keystream
#      (length ROUTING_INFO_SIZE + size) into filler
#
# Try changing the rho_keys, sizes, or number of hops and re-running.

import hashlib

# Simplified keystream stand-in for the sandbox. In the real exercise,
# chacha20_keystream() is provided as a helper.
def chacha20_keystream(key: bytes, length: int) -> bytes:
    out = b""
    counter = 0
    while len(out) < length:
        out += hashlib.sha256(key + counter.to_bytes(8, "big")).digest()
        counter += 1
    return out[:length]

def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))

ROUTING_INFO_SIZE = 1300

# 2-forwarder route (Bob, Charlie). Tiny hop-payload sizes so the output is
# readable byte-by-byte.
rho_keys = [b"BOB" + b"\\x00" * 29, b"CHARLIE" + b"\\x00" * 25]
sizes    = [8, 6]

filler = b""
print(f"start: filler length = {len(filler)}\\n")

for i, (rho, size) in enumerate(zip(rho_keys, sizes)):
    # Step 1: append this hop's payload-size zero bytes
    filler = filler + b"\\x00" * size
    print(f"iteration {i+1}: appended {size} zeros, filler length = {len(filler)}")

    # Step 2: XOR with the trailing len(filler) bytes of the extended keystream
    stream = chacha20_keystream(rho, ROUTING_INFO_SIZE + size)
    chunk_offset = ROUTING_INFO_SIZE + size - len(filler)
    chunk = stream[chunk_offset:]
    print(f"   chunk offset = {chunk_offset}, chunk length = {len(chunk)}")

    filler = xor_bytes(filler, chunk)
    print(f"   filler after XOR = {filler.hex()}\\n")

print(f"final filler ({len(filler)} bytes): {filler.hex()}")
`,
    starterCode: `    def generate_filler(self, rho_keys, payload_sizes):
        """
        Args:
          rho_keys:       list of 32-byte rho keys for hops 0..N-2.
                          The final hop's rho is NOT included; it doesn't shift,
                          so it doesn't contribute filler.
          payload_sizes:  list of per-hop payload sizes in bytes for the same hops.
                          size = len(payload) + 32 (HMAC), where payload is the
                          bigsize-prefixed TLV bytes, so the LEN prefix counts too.

        Returns:
          bytes of length sum(payload_sizes). Will be placed at the end of the
          1300-byte hop_payloads field during construction.

        The algorithm is chapter 7's "The filler algorithm" section, one
        iteration per forwarder.

        Helpers in scope: chacha20_keystream(key, length), xor_bytes(a, b).
        """
        # TODO: implement
        pass
`,
    testCode: `# Frozen expected filler bytes for the fixed test vectors below. These were
# computed once from the BOLT 4 'Filler Generation' algorithm and pasted here
# so the tests pin a concrete value the student's code must reproduce, rather
# than re-running the same algorithm in-test (which would pass any code that
# matched a reference written the same wrong way).
EXPECTED_TWO_HOP_FILLER = bytes.fromhex(
    "aef669a9212bdaa64d12ed55a931699fdc37b2d54b475b49c9232493a33d83b8"
    "c27af27fcb49ffe8cd968084b928ec5d56dcf0a885ef723b506322e3ece68121"
    "1a2b35527ba67e16faf9508dc25fdbac88de7ba37bf028e3a8a91c9b48e1b560"
    "4c93e03c155f9c8a0993446e1ec4c1d54d9fdeeff4217b94e1a4c0d66cda501e"
    "c993")
EXPECTED_THREE_HOP_FILLER = bytes.fromhex(
    "71a2ef6775e71886ec2c223c52299554abc5c73583f5f105edae630df6e2b7ce"
    "6a95079790786065da31cd3d73ca1d0518311d953372ad1726817204a57580a4"
    "7bd55de6e86be8a13a805e8a0bbb258b823c7ca3fc03e13eb260daeba6aec597"
    "a07df0d284112a26e67a48709f2c49c289a5d5c7d1d2c304993987dfadfe8cb6"
    "d46de33e6e0169116cc6d859b1163839399ae3a0d74523d5497aaab2448d3924"
    "d919556c7e1bf56e041d7f93652a11dd8c2e3b73")

# Test vectors
RHO_BOB   = bytes.fromhex("01" * 32)
RHO_CHARLIE = bytes.fromhex("02" * 32)
RHO_X     = bytes.fromhex("03" * 32)

def test_two_hop_filler_size():
    """For a 3-hop route (Bob, Charlie, Dave), filler covers Bob and Charlie's hop payloads."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CHARLIE], [65, 65])
    assert isinstance(out, (bytes, bytearray))
    assert len(out) == 130, f"Expected 130 bytes (65 + 65), got {len(out)}"

def test_two_hop_matches_reference():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CHARLIE], [65, 65])
    assert out == EXPECTED_TWO_HOP_FILLER, "Filler bytes don't match the BOLT 4 reference"

def test_one_hop_filler_size():
    """For a 2-hop route (Bob, Dave), filler covers only Bob."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB], [80])
    assert len(out) == 80, f"Filler length must equal the one forwarder's hop-payload size (80), got {len(out)}"

def test_three_hop_filler_size():
    """For a 4-hop route (Bob, Charlie, X, Dave), filler covers three intermediate hops."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([RHO_BOB, RHO_CHARLIE, RHO_X], [60, 70, 50])
    assert len(out) == 60 + 70 + 50, f"Filler length must equal the sum of the forwarder hop-payload sizes (180), got {len(out)}"

def test_three_hop_matches_reference():
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    sizes = [60, 70, 50]
    keys = [RHO_BOB, RHO_CHARLIE, RHO_X]
    out = b.generate_filler(keys, sizes)
    assert out == EXPECTED_THREE_HOP_FILLER, "Filler bytes don't match the BOLT 4 reference for three forwarders; check that each iteration XORs the TRAILING len(filler) bytes of the extended keystream"

def test_empty_rho_keys_returns_empty():
    """A single-hop route (just the destination) has no filler."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    out = b.generate_filler([], [])
    assert out == b"", "No intermediate hops means no filler"
${BOLT4_ONION_VECTOR_TEST_FIXTURES}
import hmac, hashlib

# The filler the official BOLT 4 route produces: the bytes the destination
# recovers in its trailing hop_payload positions after peeling. The packet's
# HMACs commit to it, so matching this value means your filler is
# interoperable with every Lightning implementation.
BOLT4_FILLER = bytes.fromhex(
    "51c30cc8f20da0153ca3839b850bcbc8fefc7fd84802f3e78cb35a660e747b57aa5b0de555cbcf1e6f044a718cc34219b965"
    "97f3684eee7a0232e1754f638006cb15a14788217abdf1bdd67910dc1ca74a05dcce8b5ad841b0f939fca8935f6a3ff660e0"
    "efb409f1a24ce4aa16fc7dc074cd84422c10cc4dd4fc150dd6d1e4f50b36ce10fef29248dd0cec85c72eb3e4b2f4a7c03b5c"
    "9e0c9dd12976553ede3d0e295f842187b33ff743e6d685075e98e1bcab8a46bff0102ca8b2098ae91798d370b01ca7076d3d"
    "626952a03663fe8dc700d1358263b73ba30e36731a0b72092f8d5bc8cd346762e93b2bf203d00264e4bc136fc142de8f7b69"
    "154deb05854ea88e2d7506222c95ba1aab06")

def test_matches_official_bolt4_filler():
    """Interoperability: the filler for BOLT 4's official 5-hop test route,
    derived from the published shared secrets and hop payload sizes."""
    b = OnionPacketBuilder.__new__(OnionPacketBuilder)
    rho_keys = [hmac.new(b"rho", ss, hashlib.sha256).digest() for ss in BOLT4_SHARED_SECRETS[:-1]]
    sizes = [len(p) + 32 for p in BOLT4_PAYLOADS[:-1]]
    out = b.generate_filler(rho_keys, sizes)
    assert len(out) == sum(sizes), f"Official-route filler must be {sum(sizes)} bytes, got {len(out)}"
    assert out == BOLT4_FILLER, "Filler must match the official BOLT 4 route (check the trailing-slice offset: stream[stream_len - len(filler):])"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> compute the bytes that will appear at the end of the hop_payloads field after each forwarder peels its layer." +
        "<br><br><strong>Why this works:</strong> Alice can't compute filler in isolation; it has to account for what each rho<sub>i</sub> XOR will do during peeling. By simulating the hops one by one (in order from first forwarder to last forwarder), Alice builds up the cumulative effect of all those XORs in the trailing positions." +
        "<br><br><strong>Loop invariant:</strong> after iteration <i>i</i>, <code>filler</code> contains exactly what the last <code>sum(payload_sizes[:i+1])</code> bytes of hop <i>i</i>'s view of the packet would look like, given that earlier hops' rho XORs have already been applied (virtually).",
      steps:
        "<strong>1. Start with an empty filler</strong> (you'll grow it one hop at a time):" +
        "<br><code>filler = b\"\"</code>" +
        "<br><br><strong>2. For each hop <i>i</i> in 0..len(rho_keys)-1:</strong>" +
        "<br>a. Extend filler at the END with <code>payload_sizes[i]</code> zero bytes." +
        "<br>b. Generate this hop's rho<sub>i</sub> keystream of length <code>ROUTING_INFO_SIZE + payload_sizes[i]</code> using <code>chacha20_keystream</code>." +
        "<br>c. Take the trailing <code>len(filler)</code> bytes of that keystream and XOR them into <code>filler</code> using <code>xor_bytes</code>." +
        "<br><br><strong>3. Return</strong> the accumulated filler bytes. Total length = <code>sum(payload_sizes)</code>.",
      code:
        `    def generate_filler(self, rho_keys, payload_sizes):
        filler = b""
        for i in range(len(rho_keys)):
            filler = filler + b"\\x00" * payload_sizes[i]
            stream_len = ROUTING_INFO_SIZE + payload_sizes[i]
            stream = chacha20_keystream(rho_keys[i], stream_len)
            chunk = stream[stream_len - len(filler):]
            filler = xor_bytes(filler, chunk)
        return filler`,
    },
    rewardSats: 100,
    group: "sphinx/builder",
    groupOrder: 2,
  },

  "exercise-derive-shared-secrets-draft": {
    id: "exercise-derive-shared-secrets-draft",
    title: "Derive the Shared-Secret Chain",
    description:
      "Implement <code>OnionPacketBuilder.derive_shared_secrets</code>. Given Alice's <code>session_key</code> (32 bytes) and the route's hop pubkeys (33-byte compressed each), build the session secrets and ephemeral public keys for every hop in the route, appending each to <code>self.ephemeral_pubkeys</code> and <code>self.shared_secrets</code>. " +
      "The provided helpers are <code>privkey_to_pubkey</code>, <code>ecdh</code>, and <code>scalar_mul</code>. " +
      "If you want to easily re-visit the Ephemeral Key Chain diagram, click the REFERENCE button below.",
    sampleCode: `# Blinding-chain sandbox - walk the shared-secret chain by hand for 3 hops.
#
# One session key, advanced at each hop by a blinding factor b = SHA256(E || ss).
# The magic: Alice computes ss with the ephemeral PRIVATE key, while each hop
# recomputes the SAME ss from its node private key + the ephemeral PUBLIC key.
# Helpers in scope: privkey_to_pubkey, ecdh, scalar_mul.

import hashlib

session_key = bytes.fromhex("41" * 32)
hop_privkeys = [bytes.fromhex(b * 64) for b in ("42", "43", "44")]  # Bob, Charlie, Dave
hop_pubkeys = [privkey_to_pubkey(p) for p in hop_privkeys]

e = session_key                       # the ephemeral private key, advanced each hop
for i, hop_pub in enumerate(hop_pubkeys):
    E = privkey_to_pubkey(e)          # E_i carried (only E_0 ends up in the packet)
    ss = ecdh(e, hop_pub)            # Alice's view of the shared secret
    hop_view = ecdh(hop_privkeys[i], E)  # the hop's view of the SAME secret
    print(f"hop {i}: ss = {ss.hex()[:16]}...  agree? {ss == hop_view}")

    # Advance: blinding factor folds E_i and ss_i into the next ephemeral key.
    b = hashlib.sha256(E + ss).digest()
    e = scalar_mul(e, b)
    print(f"        blinding factor b = {b.hex()[:16]}...")
`,
    starterCode: `    def __init__(self, session_key: bytes, hop_pubkeys: list[bytes]):
        """
        Args:
          session_key:  32 bytes. Alice's per-payment ephemeral private key.
          hop_pubkeys:  list of 33-byte compressed node public keys, in route order.
                        Index 0 is the first forwarder, last index is the destination.
        """
        self.session_key = session_key
        self.hop_pubkeys = hop_pubkeys
        self.shared_secrets = []        # filled in below: 32-byte ss per hop
        self.ephemeral_pubkeys = []     # filled in below: 33-byte E_i per hop

    def derive_shared_secrets(self):
        """
        Walk the blinding chain and append to self.shared_secrets and
        self.ephemeral_pubkeys (both created empty in __init__). Each entry
        corresponds to one hop, in route order.

        The chain is chapter 4's third attempt (one session key, advanced by
        a blinding factor at each hop), one entry per hop.

        Helpers available in scope:
          privkey_to_pubkey(privkey: bytes) -> bytes        # 32 -> 33
          ecdh(privkey: bytes, pubkey: bytes) -> bytes       # 32, 33 -> 32
          scalar_mul(a: bytes, b: bytes) -> bytes            # 32, 32 -> 32 mod n
        """
        # TODO: implement
        pass
`,
    testCode: `import hashlib

# Reference values for a fixed test vector.
SESSION_KEY = bytes.fromhex("4141414141414141414141414141414141414141414141414141414141414141")
BOB_PRIV   = bytes.fromhex("4242424242424242424242424242424242424242424242424242424242424242")
CHARLIE_PRIV = bytes.fromhex("4343434343434343434343434343434343434343434343434343434343434343")
DAVE_PRIV  = bytes.fromhex("4444444444444444444444444444444444444444444444444444444444444444")

BOB_PUB   = privkey_to_pubkey(BOB_PRIV)
CHARLIE_PUB = privkey_to_pubkey(CHARLIE_PRIV)
DAVE_PUB  = privkey_to_pubkey(DAVE_PRIV)
HOP_PUBKEYS = [BOB_PUB, CHARLIE_PUB, DAVE_PUB]
HOP_PRIVKEYS = [BOB_PRIV, CHARLIE_PRIV, DAVE_PRIV]

# Frozen expected chain for the (SESSION_KEY, HOP_PUBKEYS) test vector above.
# These were computed once from the blinding-chain algorithm and pasted here so
# the test pins concrete bytes the student's code must reproduce, rather than
# re-deriving the chain in-test (which would pass any code matching a reference
# written the same wrong way).
EXPECTED_SHARED_SECRETS = [
    bytes.fromhex("04be53badd90d3c264965fe1f1857a06c0ab5e2f3092eeb36ebc12815a8e6fb4"),
    bytes.fromhex("45dea8dfe6164f6042376a55c535fe84a48c0b04edd986af5278c6b13ef19756"),
    bytes.fromhex("129e59695369b891e123a993b739242cf652c497b93e592f590783a0a576df7b"),
]
EXPECTED_EPHEMERAL_PUBKEYS = [
    bytes.fromhex("02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619"),
    bytes.fromhex("03b4cd0c5b3fc8d8ebaa75fa95fd3c9014fe66d311efe569fe27ee44c2443926c7"),
    bytes.fromhex("0234f3455d01f828d2ecd685826384201db459663d62b44b845aec9d612032d28f"),
]

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
    assert b.shared_secrets == EXPECTED_SHARED_SECRETS, "Shared secret chain doesn't match reference"
    assert b.ephemeral_pubkeys == EXPECTED_EPHEMERAL_PUBKEYS, "Ephemeral pubkey chain doesn't match reference"

def test_hops_can_recover_same_shared_secrets():
    """Each hop derives the same ss using its own privkey + the ephemeral pubkey."""
    b = OnionPacketBuilder(SESSION_KEY, HOP_PUBKEYS)
    b.derive_shared_secrets()
    for i, hop_priv in enumerate(HOP_PRIVKEYS):
        hop_view_ss = ecdh(hop_priv, b.ephemeral_pubkeys[i])
        assert hop_view_ss == b.shared_secrets[i], (
            f"Hop {i}: forwarder's ECDH(hop_priv, E_i) must match Alice's ss_i"
        )

${BOLT4_ONION_VECTOR_TEST_FIXTURES}
def test_matches_official_bolt4_vector():
    """Interoperability: BOLT 4 publishes the shared secrets for its official
    5-hop test route. Your chain must reproduce them exactly; every Lightning
    implementation (LND, Core Lightning, LDK) derives these same values."""
    b = OnionPacketBuilder(BOLT4_SESSION_KEY, BOLT4_HOP_PUBKEYS)
    b.derive_shared_secrets()
    assert b.shared_secrets == BOLT4_SHARED_SECRETS, "Shared secrets must match the official BOLT 4 test vector (check the blinding factor: SHA256(E_i || ss_i), then e = e * b mod n)"
`,
    hints: {
      conceptual:
        "<strong>Goal:</strong> turn one session key into two parallel lists, <code>self.ephemeral_pubkeys</code> and <code>self.shared_secrets</code>, populated with one entry each per hop in route order. The method mutates those instance lists and returns <code>None</code>." +
        "<br><br><strong>Why a chain:</strong> we want a single ephemeral key (<i>E</i><sub>0</sub>) in the packet, not one per hop. Each forwarder computes the next ephemeral key on its own from public information. The chain advances by multiplying the current ephemeral private key by a 'blinding factor' derived from the current ephemeral pubkey and shared secret." +
        "<br><br><strong>Key invariant:</strong> after the loop, both Alice and the <i>i</i>-th hop must derive the same ss<sub>i</sub>. Alice does it as ecdh(<i>e</i><sub>i</sub>, hop_pubkey<sub>i</sub>); the hop does it as ecdh(hop_privkey, <i>E</i><sub>i</sub>). The math works because both sides compute the same point on the curve.",
      steps:
        "<strong>Initial state:</strong> <i>e</i> = session_key, the ephemeral private key for hop 0. Both <code>self.shared_secrets</code> and <code>self.ephemeral_pubkeys</code> are already created empty in <code>__init__</code>, so you only need to append to them." +
        "<br><br><strong>For each hop <i>i</i>:</strong>" +
        "<br>1. Compute the ephemeral pubkey <i>E</i><sub>i</sub> with <code>privkey_to_pubkey(e)</code>. Append it to <code>self.ephemeral_pubkeys</code>." +
        "<br>2. Compute the shared secret ss<sub>i</sub> with <code>ecdh(e, hop_pubkey_i)</code>. Append it to <code>self.shared_secrets</code>." +
        "<br>3. Compute the blinding factor <i>b</i><sub>i</sub> = SHA256(<i>E</i><sub>i</sub> ‖ ss<sub>i</sub>). Use <code>hashlib.sha256(...).digest()</code> to get 32 bytes." +
        "<br>4. Advance <i>e</i>:" +
        "<br><code>e = scalar_mul(e, b_i)</code>" +
        "<br><br><strong>Done:</strong> after looping over every hop in <code>self.hop_pubkeys</code>, the two lists are populated and the function returns.",
      code:
        `    def __init__(self, session_key, hop_pubkeys):
        self.session_key = session_key
        self.hop_pubkeys = hop_pubkeys
        self.shared_secrets = []
        self.ephemeral_pubkeys = []

    def derive_shared_secrets(self):
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
