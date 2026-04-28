// ─── Onion Routing Exercise Definitions ──────────────────────────────────────
//
// Each exercise has starter code, test code, hints, and metadata.
// Exercises are keyed by ID and referenced from tutorial markdown via
// <code-intro exercises="..."> tags.
//
// Exercises are added chapter-by-chapter. The 10 planned exercises:
//
// crypto/keys.py
//   - exercise-derive-keys                     [Ch 4]
//
// sphinx/builder.py
//   - exercise-derive-shared-secrets           [Ch 3]
//   - exercise-generate-filler                 [Ch 6]
//   - exercise-wrap-hop                        [Ch 7]
//   - exercise-build-packet                    [Ch 7]
//
// sphinx/forwarder.py
//   - exercise-peel-layer                      [Ch 8]
//   - exercise-process-onion                   [Ch 9]
//
// sphinx/errors.py
//   - exercise-build-error-onion               [Ch 10]
//   - exercise-decrypt-error-onion             [Ch 10]
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

export const ONION_ROUTING_EXERCISES: Record<string, CodeExerciseData> = {

  "exercise-derive-keys": {
    id: "exercise-derive-keys",
    title: "Derive the Per-Hop Keys",
    description:
      "Implement derive_keys(shared_secret) -> KeyMaterial. Given a 32-byte shared secret, return the five named keys (rho, mu, um, pad, ammag) defined by BOLT 4. " +
      "Each key is computed as HMAC-SHA256(name=ASCII label, msg=shared_secret) and is exactly 32 bytes long. The KeyMaterial dataclass is provided as a small named container.",
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
        `<strong>Solution:</strong><br><pre><code>def derive_keys(shared_secret):
    def k(name):
        return hmac.new(name, shared_secret, hashlib.sha256).digest()
    return KeyMaterial(
        rho=k(b"rho"),
        mu=k(b"mu"),
        um=k(b"um"),
        pad=k(b"pad"),
        ammag=k(b"ammag"),
    )
</code></pre>`,
    },
    rewardSats: 30,
    group: "crypto/keys",
    groupOrder: 1,
  },

  "exercise-derive-shared-secrets": {
    id: "exercise-derive-shared-secrets",
    title: "Derive the Shared-Secret Chain",
    description:
      "Implement OnionPacketBuilder.derive_shared_secrets. Given Alice's session_key (32 bytes) and the route's hop pubkeys (33-byte compressed each), produce the chain of (ephemeral_pubkey, shared_secret) pairs. " +
      "For hop 0, the ephemeral private key is just session_key; for each subsequent hop, multiply the previous ephemeral private key by the previous hop's blinding factor (mod the curve order). " +
      "Use the provided helpers: privkey_to_pubkey, ecdh, point_mul_pubkey, scalar_mul.",
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
        "<br><br><strong>Why a chain:</strong> we want a single ephemeral key (E₀) in the packet, not one per hop. Each forwarder computes the next ephemeral key on its own from public information. The chain advances by multiplying the current ephemeral private key by a 'blinding factor' derived from the current ephemeral pubkey and shared secret." +
        "<br><br><strong>Key invariant:</strong> after the loop, both Alice and the i-th hop must derive the same ss_i. Alice does it as ecdh(e_i, hop_pubkey_i); the hop does it as ecdh(hop_privkey, E_i). The math works because both sides compute the same point on the curve.",
      steps:
        "<strong>Initial state:</strong> e = session_key. This is the ephemeral private key for hop 0." +
        "<br><br><strong>For each hop i:</strong>" +
        "<br>1. Compute the ephemeral pubkey E_i with <code>privkey_to_pubkey(e)</code>. Append it to <code>self.ephemeral_pubkeys</code>." +
        "<br>2. Compute the shared secret ss_i with <code>ecdh(e, hop_pubkey_i)</code>. Append it to <code>self.shared_secrets</code>." +
        "<br>3. Compute the blinding factor b_i = SHA256(E_i || ss_i). Use <code>hashlib.sha256(...).digest()</code> to get 32 bytes." +
        "<br>4. Advance e: <code>e = scalar_mul(e, b_i)</code>." +
        "<br><br><strong>Done:</strong> after looping over every hop in <code>self.hop_pubkeys</code>, the two lists are populated and the function returns.",
      code:
        `<strong>Solution:</strong><br><pre><code>def derive_shared_secrets(self):
    e = self.session_key
    for hop_pubkey in self.hop_pubkeys:
        E = privkey_to_pubkey(e)
        ss = ecdh(e, hop_pubkey)
        b = hashlib.sha256(E + ss).digest()
        self.ephemeral_pubkeys.append(E)
        self.shared_secrets.append(ss)
        e = scalar_mul(e, b)
</code></pre>`,
    },
    rewardSats: 50,
    group: "sphinx/builder",
    groupOrder: 1,
  },

};
