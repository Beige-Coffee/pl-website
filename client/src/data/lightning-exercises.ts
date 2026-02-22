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
  group: string;       // e.g. "keys/derivation"
  groupOrder: number;  // 1-based position within the group
}

export const LIGHTNING_EXERCISES: Record<string, CodeExerciseData> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 1 -Create a Keys Manager
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-keys-manager": {
    id: "ln-exercise-keys-manager",
    title: "Exercise 1: Create a Keys Manager",
    description:
      "Create a function that takes a 32-byte seed and derives a BIP32 master key and chain code. This is the foundation for all Lightning channel key derivation. Use HMAC-SHA512 with the key 'Bitcoin seed' as specified in BIP32.",
    starterCode: `import hmac
import hashlib

def create_keys_manager(seed: bytes) -> dict:
    """
    Create a keys manager from a 32-byte seed.

    Derives the BIP32 master key and chain code using HMAC-SHA512
    with the key "Bitcoin seed".

    Args:
        seed: 32-byte seed

    Returns:
        dict with keys:
            'master_key': 32-byte master private key (first 32 bytes of HMAC)
            'chain_code': 32-byte chain code (last 32 bytes of HMAC)
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hmac
import hashlib

def test_returns_dict():
    seed = bytes([0x01] * 32)
    result = create_keys_manager(seed)
    assert isinstance(result, dict), "Must return a dict"
    assert 'master_key' in result, "Dict must contain 'master_key'"
    assert 'chain_code' in result, "Dict must contain 'chain_code'"

def test_key_lengths():
    seed = bytes([0x01] * 32)
    result = create_keys_manager(seed)
    assert len(result['master_key']) == 32, f"master_key must be 32 bytes, got {len(result['master_key'])}"
    assert len(result['chain_code']) == 32, f"chain_code must be 32 bytes, got {len(result['chain_code'])}"

def test_deterministic():
    seed = bytes([0x01] * 32)
    r1 = create_keys_manager(seed)
    r2 = create_keys_manager(seed)
    assert r1['master_key'] == r2['master_key'], "Same seed must produce same master_key"
    assert r1['chain_code'] == r2['chain_code'], "Same seed must produce same chain_code"

def test_different_seeds():
    r1 = create_keys_manager(bytes([0x01] * 32))
    r2 = create_keys_manager(bytes([0x02] * 32))
    assert r1['master_key'] != r2['master_key'], "Different seeds must produce different keys"

def test_hmac_sha512():
    seed = bytes([0x01] * 32)
    expected = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()
    result = create_keys_manager(seed)
    assert result['master_key'] == expected[:32], "master_key must be first 32 bytes of HMAC-SHA512"
    assert result['chain_code'] == expected[32:], "chain_code must be last 32 bytes of HMAC-SHA512"
`,
    hints: {
      conceptual:
        "<p>BIP32 defines a hierarchical deterministic wallet structure. The first step is deriving a master key from a seed using HMAC-SHA512. The HMAC key is the ASCII string <code>Bitcoin seed</code>, and the message is the seed bytes. The first 32 bytes of the 64-byte output become the master private key, and the last 32 bytes become the chain code.</p>",
      steps:
        '<ol><li>Compute <code>hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()</code></li><li>Split the 64-byte result: first 32 bytes = master_key, last 32 bytes = chain_code</li><li>Return a dict with both values</li></ol>',
      code: `import hmac
import hashlib

def create_keys_manager(seed: bytes) -> dict:
    I = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()
    return {
        'master_key': I[:32],
        'chain_code': I[32:]
    }`,
    },
    rewardSats: 21,
    group: "keys/derivation",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 2 -Derive a BIP32 Key
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-derive-key": {
    id: "ln-exercise-derive-key",
    title: "Exercise 2: Derive a BIP32 Key",
    description:
      "Implement BIP32 child key derivation and use it to derive a key at path m/1017h/0h/{family}h/0/{index}. This is the LN key derivation path (BOLT 3). Support both hardened (h) and normal child derivation.",
    starterCode: `def bip32_ckd_priv(key: bytes, chaincode: bytes, index: int):
    """
    Derive a child private key from a parent key and chaincode.

    Args:
        key: 32-byte parent private key
        chaincode: 32-byte parent chain code
        index: child index (>= 0x80000000 for hardened)

    Returns:
        tuple: (child_key, child_chaincode)
    """
    # === YOUR CODE HERE ===
    pass

def derive_ln_key(seed: bytes, family: int, index: int) -> bytes:
    """
    Derive a Lightning key at path m/1017h/0h/{family}h/0/{index}.

    Hint: use create_keys_manager(seed) to get the master_key and chain_code.

    Args:
        seed: 32-byte seed
        family: key family number (0-5)
        index: key index

    Returns:
        bytes: 32-byte derived private key
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hmac
import hashlib
import struct
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def _ref_privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def _ref_ckd(key, chaincode, index):
    if index >= 0x80000000:
        data = b'\\x00' + key + struct.pack('>I', index)
    else:
        pubkey = _ref_privkey_to_pubkey(key)
        data = pubkey + struct.pack('>I', index)
    I = hmac.new(chaincode, data, hashlib.sha512).digest()
    child_key_int = (int.from_bytes(I[:32], 'big') + int.from_bytes(key, 'big')) % ORDER
    return child_key_int.to_bytes(32, 'big'), I[32:]

def _ref_derive(seed, family, index):
    key, cc = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[:32], hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[32:]
    for idx in [1017 + 0x80000000, 0 + 0x80000000, family + 0x80000000, 0, index]:
        key, cc = _ref_ckd(key, cc, idx)
    return key

def test_ckd_returns_tuple():
    seed = bytes([0x01] * 32)
    key, cc = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[:32], hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[32:]
    result = bip32_ckd_priv(key, cc, 0x80000000)
    assert isinstance(result, tuple), "bip32_ckd_priv must return a tuple"
    assert len(result) == 2, "Must return (child_key, child_chaincode)"
    assert len(result[0]) == 32, "child_key must be 32 bytes"
    assert len(result[1]) == 32, "child_chaincode must be 32 bytes"

def test_hardened_derivation():
    seed = bytes([0x01] * 32)
    key, cc = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[:32], hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[32:]
    result_key, result_cc = bip32_ckd_priv(key, cc, 0x80000000)
    exp_key, exp_cc = _ref_ckd(key, cc, 0x80000000)
    assert result_key == exp_key, "Hardened child key mismatch"
    assert result_cc == exp_cc, "Hardened child chaincode mismatch"

def test_normal_derivation():
    seed = bytes([0x01] * 32)
    key, cc = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[:32], hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()[32:]
    # First do a hardened step to get a valid key
    key, cc = _ref_ckd(key, cc, 0x80000000)
    result_key, result_cc = bip32_ckd_priv(key, cc, 0)
    exp_key, exp_cc = _ref_ckd(key, cc, 0)
    assert result_key == exp_key, "Normal child key mismatch"

def test_derive_ln_key_family_0():
    seed = bytes([0x01] * 32)
    result = derive_ln_key(seed, 0, 0)
    expected = _ref_derive(seed, 0, 0)
    assert result == expected, f"Key family 0 index 0 mismatch"

def test_derive_all_families():
    seed = bytes([0x01] * 32)
    for family in range(6):
        result = derive_ln_key(seed, family, 0)
        expected = _ref_derive(seed, family, 0)
        assert result == expected, f"Key family {family} mismatch"
        assert len(result) == 32, f"Key family {family} must be 32 bytes"
`,
    hints: {
      conceptual:
        "<p>BIP32 child key derivation (CKD) uses HMAC-SHA512 to derive child keys from parent keys. For <strong>hardened</strong> derivation (index >= 0x80000000), the HMAC input is <code>0x00 || parent_key || index</code>. For <strong>normal</strong> derivation, it is <code>parent_pubkey || index</code>. The child key is computed as <code>(parse256(IL) + parent_key) mod n</code>. The Lightning path is <code>m/1017h/0h/{family}h/0/{index}</code>.</p>",
      steps:
        '<ol><li>In <code>bip32_ckd_priv</code>: if hardened, set <code>data = b"\\x00" + key + struct.pack(">I", index)</code></li><li>If normal, set <code>data = privkey_to_pubkey(key) + struct.pack(">I", index)</code></li><li>Compute <code>I = hmac.new(chaincode, data, hashlib.sha512).digest()</code></li><li>Child key = <code>(int.from_bytes(I[:32]) + int.from_bytes(key)) % ORDER</code></li><li>In <code>derive_ln_key</code>: derive from seed, then walk path m/1017h/0h/{family}h/0/{index}</li></ol>',
      code: `def bip32_ckd_priv(key: bytes, chaincode: bytes, index: int):
    if index >= 0x80000000:
        data = b'\\x00' + key + struct.pack('>I', index)
    else:
        pubkey = privkey_to_pubkey(key)
        data = pubkey + struct.pack('>I', index)
    I = hmac.new(chaincode, data, hashlib.sha512).digest()
    child_key_int = (int.from_bytes(I[:32], 'big') + int.from_bytes(key, 'big')) % ORDER
    child_key = child_key_int.to_bytes(32, 'big')
    return child_key, I[32:]

def derive_ln_key(seed: bytes, family: int, index: int) -> bytes:
    km = create_keys_manager(seed)
    key, cc = km['master_key'], km['chain_code']
    for idx in [1017 + 0x80000000, 0 + 0x80000000, family + 0x80000000, 0, index]:
        key, cc = bip32_ckd_priv(key, cc, idx)
    return key`,
    },
    rewardSats: 21,
    group: "keys/derivation",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 3 -Derive All Channel Keys
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-channel-keys": {
    id: "ln-exercise-channel-keys",
    title: "Exercise 3: Derive All Channel Keys",
    description:
      "Derive all 6 Lightning channel key families and their corresponding public keys. The key families are: funding (0), revocation_base (1), htlc_base (2), payment_base (3), delayed_payment_base (4), and per_commitment (5).",
    starterCode: `def derive_channel_keys(seed: bytes, index: int = 0) -> dict:
    """
    Derive all 6 channel key pairs (private + public) for a given channel index.

    Args:
        seed: 32-byte seed
        index: channel key index (default 0)

    Returns:
        dict mapping family name to {'privkey': bytes(32), 'pubkey': bytes(33)}
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hmac
import hashlib
import struct
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def _ref_p2p(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')

KEY_FAMILIES = {
    'funding': 0, 'revocation_base': 1, 'htlc_base': 2,
    'payment_base': 3, 'delayed_payment_base': 4, 'per_commitment': 5,
}

def test_returns_all_families():
    seed = bytes([0x01] * 32)
    result = derive_channel_keys(seed, 0)
    assert isinstance(result, dict), "Must return a dict"
    for name in KEY_FAMILIES:
        assert name in result, f"Missing key family: {name}"

def test_key_sizes():
    seed = bytes([0x01] * 32)
    result = derive_channel_keys(seed, 0)
    for name in KEY_FAMILIES:
        entry = result[name]
        assert 'privkey' in entry, f"{name} missing 'privkey'"
        assert 'pubkey' in entry, f"{name} missing 'pubkey'"
        assert len(entry['privkey']) == 32, f"{name} privkey must be 32 bytes"
        assert len(entry['pubkey']) == 33, f"{name} pubkey must be 33 bytes"

def test_pubkey_prefix():
    seed = bytes([0x01] * 32)
    result = derive_channel_keys(seed, 0)
    for name in KEY_FAMILIES:
        prefix = result[name]['pubkey'][0]
        assert prefix in (2, 3), f"{name} pubkey must start with 0x02 or 0x03, got {prefix:#x}"

def test_pubkey_matches_privkey():
    seed = bytes([0x01] * 32)
    result = derive_channel_keys(seed, 0)
    for name in KEY_FAMILIES:
        expected_pub = _ref_p2p(result[name]['privkey'])
        assert result[name]['pubkey'] == expected_pub, f"{name} pubkey doesn't match privkey"

def test_different_families_different_keys():
    seed = bytes([0x01] * 32)
    result = derive_channel_keys(seed, 0)
    keys = [result[name]['privkey'] for name in KEY_FAMILIES]
    assert len(set(keys)) == len(keys), "All key families must produce different keys"
`,
    hints: {
      conceptual:
        "<p>Lightning channels use 6 key families, each derived at a different BIP32 path. For each family, you derive the private key using the path <code>m/1017h/0h/{family}h/0/{index}</code>, then compute the compressed public key from it. The families are: funding(0), revocation_base(1), htlc_base(2), payment_base(3), delayed_payment_base(4), per_commitment(5).</p>",
      steps:
        '<ol><li>Iterate over each key family name and its number</li><li>Call <code>derive_ln_key(seed, family_number, index)</code> to get the private key</li><li>Call <code>privkey_to_pubkey(privkey)</code> to get the 33-byte compressed public key</li><li>Store both in the result dict under the family name</li></ol>',
      code: `def derive_channel_keys(seed: bytes, index: int = 0) -> dict:
    result = {}
    for name, family in KEY_FAMILIES.items():
        privkey = derive_ln_key(seed, family, index)
        pubkey = privkey_to_pubkey(privkey)
        result[name] = {'privkey': privkey, 'pubkey': pubkey}
    return result`,
    },
    rewardSats: 21,
    group: "keys/derivation",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 4 -Create Funding Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-funding-script": {
    id: "ln-exercise-funding-script",
    title: "Exercise 4: Create Funding Script",
    description:
      "Create a 2-of-2 multisig funding script for a Lightning channel. The two public keys must be sorted lexicographically (as raw bytes) before being placed in the script, as required by BOLT 3.",
    starterCode: `def create_funding_script(pubkey1: bytes, pubkey2: bytes) -> bytes:
    """
    Create a 2-of-2 multisig script for Lightning channel funding.

    The script format is:
        OP_2 <pubkey_smaller> <pubkey_larger> OP_2 OP_CHECKMULTISIG

    Keys must be sorted lexicographically (as bytes).

    Args:
        pubkey1: 33-byte compressed public key
        pubkey2: 33-byte compressed public key

    Returns:
        bytes: The raw funding script
    """
    # === YOUR CODE HERE ===
    # OP_2 = 0x52
    # OP_CHECKMULTISIG = 0xae
    # Push 33 bytes = 0x21
    pass
`,
    testCode: `
def test_bolt3_vector():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    expected = bytes.fromhex("5221023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb21030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c152ae")
    result = create_funding_script(pk1, pk2)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_key_ordering():
    pk1 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    pk2 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    expected = bytes.fromhex("5221023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb21030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c152ae")
    result = create_funding_script(pk1, pk2)
    assert result == expected, "Keys must be sorted lexicographically regardless of input order"

def test_script_structure():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    result = create_funding_script(pk1, pk2)
    assert result[0] == 0x52, "Must start with OP_2"
    assert result[-1] == 0xae, "Must end with OP_CHECKMULTISIG"
    assert result[-2] == 0x52, "Second-to-last byte must be OP_2"
    assert result[1] == 0x21, "First push must be 33 bytes"
    assert result[35] == 0x21, "Second push must be 33 bytes"
`,
    hints: {
      conceptual:
        "<p>The Lightning funding output is a standard 2-of-2 multisig. BOLT 3 requires the two funding public keys to be sorted in lexicographic (byte) order. The script format is: <code>OP_2 &lt;33-byte-key1&gt; &lt;33-byte-key2&gt; OP_2 OP_CHECKMULTISIG</code>. The push opcode for 33 bytes is <code>0x21</code>.</p>",
      steps:
        '<ol><li>Sort the two pubkeys: <code>keys = sorted([pubkey1, pubkey2])</code></li><li>Build the script: <code>OP_2(0x52) + push_33(0x21) + key_small + push_33(0x21) + key_large + OP_2(0x52) + OP_CHECKMULTISIG(0xae)</code></li><li>Return the assembled bytes</li></ol>',
      code: `def create_funding_script(pubkey1: bytes, pubkey2: bytes) -> bytes:
    keys = sorted([pubkey1, pubkey2])
    return (
        b'\\x52'
        + b'\\x21' + keys[0]
        + b'\\x21' + keys[1]
        + b'\\x52'
        + b'\\xae'
    )`,
    },
    rewardSats: 21,
    group: "scripts/funding",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 5 -Create Funding Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-funding-tx": {
    id: "ln-exercise-funding-tx",
    title: "Exercise 5: Create Funding Transaction",
    description:
      "Build a funding transaction that spends from a given UTXO and creates a P2WSH output using the 2-of-2 multisig funding script. The output script is OP_0 <32-byte SHA256 of funding script>.",
    starterCode: `def create_funding_tx(input_txid_hex: str, input_vout: int,
                      funding_amount: int,
                      pubkey1: bytes, pubkey2: bytes) -> str:
    """
    Create a funding transaction (unsigned, no witness).

    Transaction format (version 2, no witness):
      - version: 4 bytes LE (0x02000000)
      - input count: varint (1)
      - input:
          - prev_txid: 32 bytes (reversed from hex)
          - prev_vout: 4 bytes LE
          - scriptSig length: varint (0)
          - sequence: 4 bytes (0xffffffff)
      - output count: varint (1)
      - output:
          - value: 8 bytes LE
          - scriptPubKey length: varint
          - scriptPubKey: OP_0 <push_32> <SHA256(funding_script)>
      - locktime: 4 bytes (0x00000000)

    Args:
        input_txid_hex: transaction ID hex string (big-endian display order)
        input_vout: output index of the UTXO
        funding_amount: amount in satoshis for the funding output
        pubkey1: 33-byte compressed public key
        pubkey2: 33-byte compressed public key

    Returns:
        str: hex-encoded raw transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_funding_tx():
    input_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    result = create_funding_tx(input_txid, 0, 500000, pk1, pk2)
    expected = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    assert result == expected, f"TX mismatch.\\nExpected: {expected}\\nGot:      {result}"

def test_returns_string():
    input_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    result = create_funding_tx(input_txid, 0, 500000, pk1, pk2)
    assert isinstance(result, str), "Must return a hex string"

def test_p2wsh_output():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    script_hash = hashlib.sha256(funding_script).digest()
    expected_spk = b'\\x00\\x20' + script_hash
    result = create_funding_tx("8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be", 0, 500000, pk1, pk2)
    tx_bytes = bytes.fromhex(result)
    # Find the scriptPubKey in the output
    assert expected_spk.hex() in result, "Transaction must contain correct P2WSH scriptPubKey"
`,
    hints: {
      conceptual:
        "<p>A funding transaction is a standard Bitcoin transaction with one input (the UTXO being spent) and one P2WSH output. The P2WSH output script is <code>OP_0 PUSH32 SHA256(funding_script)</code>. Note that the txid must be reversed from display order (big-endian hex) to internal byte order (little-endian) when building the transaction.</p>",
      steps:
        '<ol><li>Build version: <code>struct.pack("&lt;I", 2)</code></li><li>Build input: reversed txid bytes + vout(LE) + empty scriptSig + sequence 0xffffffff</li><li>Build funding script, hash with SHA256 to get witness program</li><li>Build output: value(8 bytes LE) + scriptPubKey (<code>0x00 0x20</code> + 32-byte hash)</li><li>Append locktime (4 zero bytes)</li></ol>',
      code: `def create_funding_tx(input_txid_hex: str, input_vout: int,
                      funding_amount: int,
                      pubkey1: bytes, pubkey2: bytes) -> str:
    tx = b''
    # Version
    tx += struct.pack('<I', 2)
    # Input count
    tx += b'\\x01'
    # Input: prev txid (reversed), vout, empty scriptSig, sequence
    tx += bytes.fromhex(input_txid_hex)[::-1]
    tx += struct.pack('<I', input_vout)
    tx += b'\\x00'  # scriptSig length
    tx += b'\\xff\\xff\\xff\\xff'  # sequence
    # Output count
    tx += b'\\x01'
    # Output: value
    tx += struct.pack('<q', funding_amount)
    # scriptPubKey: P2WSH
    funding_script = create_funding_script(pubkey1, pubkey2)
    script_hash = hashlib.sha256(funding_script).digest()
    spk = b'\\x00\\x20' + script_hash
    tx += bytes([len(spk)]) + spk
    # Locktime
    tx += b'\\x00\\x00\\x00\\x00'
    return tx.hex()`,
    },
    rewardSats: 21,
    group: "transactions/funding",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 6 -Sign a Transaction Input
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-sign-input": {
    id: "ln-exercise-sign-input",
    title: "Exercise 6: Sign a Transaction Input",
    description:
      "Sign a transaction input using BIP143 (segwit v0) signature hashing and ECDSA. Compute the sighash for a P2WSH input and produce a DER-encoded signature with SIGHASH_ALL appended.",
    starterCode: `def bip143_sighash(tx_bytes: bytes, input_index: int,
                   script_code: bytes, value: int,
                   sighash_type: int = 1) -> bytes:
    """
    Compute the BIP143 sighash for a segwit v0 input.

    BIP143 sighash preimage:
      1. nVersion (4 bytes LE)
      2. hashPrevouts (32 bytes) - SHA256d of all input outpoints
      3. hashSequence (32 bytes) - SHA256d of all input sequences
      4. outpoint (36 bytes) - txid + vout of this input
      5. scriptCode (varint + script)
      6. value (8 bytes LE)
      7. nSequence (4 bytes LE) of this input
      8. hashOutputs (32 bytes) - SHA256d of all outputs
      9. nLocktime (4 bytes LE)
      10. sighash type (4 bytes LE)

    Then double-SHA256 the preimage.

    Args:
        tx_bytes: raw unsigned transaction bytes
        input_index: which input to sign
        script_code: the witness script (funding script for P2WSH)
        value: satoshi value of the input being spent
        sighash_type: 1 for SIGHASH_ALL

    Returns:
        bytes: 32-byte sighash digest
    """
    # === YOUR CODE HERE ===
    pass

def sign_funding_input(tx_hex: str, input_index: int,
                       funding_script: bytes, value: int,
                       privkey: bytes) -> bytes:
    """
    Sign a funding transaction input.

    Args:
        tx_hex: hex-encoded raw transaction
        input_index: which input to sign
        funding_script: the 2-of-2 multisig script
        value: satoshi value of the input being spent
        privkey: 32-byte private key

    Returns:
        bytes: DER-encoded signature + SIGHASH_ALL byte (0x01)
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
import struct
from ecdsa import SECP256k1, SigningKey, VerifyingKey
from ecdsa.util import sigencode_der, sigdecode_der

def _dsha256(data):
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()

def _parse_tx(tx_hex):
    tx = bytes.fromhex(tx_hex)
    # Simple parser for version 2, 1-input, 1-output tx
    version = tx[0:4]
    # skip varint input count (1 byte = 0x01)
    inp_start = 5
    prevhash = tx[inp_start:inp_start+32]
    previndex = tx[inp_start+32:inp_start+36]
    # scriptSig len = 0
    sequence = tx[inp_start+37:inp_start+41]
    # skip varint output count
    out_start = inp_start + 42
    # read all outputs until locktime
    locktime = tx[-4:]
    outputs = tx[out_start:-4]
    return version, prevhash, previndex, sequence, outputs, locktime

def test_sign_returns_bytes():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    privkey = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    result = sign_funding_input(tx_hex, 0, funding_script, 500000, privkey)
    assert isinstance(result, bytes), "Must return bytes"
    assert result[-1] == 0x01, "Last byte must be SIGHASH_ALL (0x01)"

def test_signature_valid():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    privkey = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    sig_with_type = sign_funding_input(tx_hex, 0, funding_script, 500000, privkey)
    der_sig = sig_with_type[:-1]  # remove sighash byte
    # Verify: derive pubkey from privkey
    sk = SigningKey.from_string(privkey, curve=SECP256k1)
    vk = sk.get_verifying_key()
    # Compute sighash ourselves
    tx = bytes.fromhex(tx_hex)
    version = tx[0:4]
    prevhash = tx[5:37]
    previndex = tx[37:41]
    sequence = tx[42:46]
    outputs = tx[47:-4]
    locktime = tx[-4:]
    hp = _dsha256(prevhash + previndex)
    hs = _dsha256(sequence)
    ho = _dsha256(outputs)
    sc = bytes([len(funding_script)]) + funding_script
    preimage = version + hp + hs + prevhash + previndex + sc + struct.pack('<q', 500000) + sequence + ho + locktime + struct.pack('<I', 1)
    sighash = _dsha256(preimage)
    assert vk.verify_digest(der_sig, sighash, sigdecode=sigdecode_der), "Signature must be valid"

def test_sighash_computation():
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    result = bip143_sighash(bytes.fromhex(tx_hex), 0, funding_script, 500000)
    assert isinstance(result, bytes), "sighash must be bytes"
    assert len(result) == 32, f"sighash must be 32 bytes, got {len(result)}"
`,
    hints: {
      conceptual:
        "<p>BIP143 defines the sighash algorithm for segwit inputs. Instead of serializing the entire transaction for each input (as in legacy signing), BIP143 uses a commitment structure with hashed prevouts, sequences, and outputs. This is more efficient and prevents quadratic hashing attacks. The sighash preimage is double-SHA256'd to produce the 32-byte digest that gets signed with ECDSA.</p>",
      steps:
        '<ol><li>Parse the raw transaction to extract version, inputs, outputs, locktime</li><li>Compute hashPrevouts = dSHA256(all outpoints concatenated)</li><li>Compute hashSequence = dSHA256(all sequences concatenated)</li><li>Compute hashOutputs = dSHA256(all outputs concatenated)</li><li>Build preimage: version + hashPrevouts + hashSequence + outpoint + scriptCode + value + sequence + hashOutputs + locktime + sighash_type</li><li>Return dSHA256(preimage)</li><li>For signing: compute sighash, sign with ECDSA using sigencode_der, append 0x01</li></ol>',
      code: `def bip143_sighash(tx_bytes, input_index, script_code, value, sighash_type=1):
    def dsha256(d):
        return hashlib.sha256(hashlib.sha256(d).digest()).digest()
    version = tx_bytes[0:4]
    prevhash = tx_bytes[5:37]
    previndex = tx_bytes[37:41]
    sequence = tx_bytes[42:46]
    outputs = tx_bytes[47:-4]
    locktime = tx_bytes[-4:]
    hp = dsha256(prevhash + previndex)
    hs = dsha256(sequence)
    ho = dsha256(outputs)
    sc = bytes([len(script_code)]) + script_code
    preimage = (version + hp + hs + prevhash + previndex + sc
                + struct.pack('<q', value) + sequence + ho
                + locktime + struct.pack('<I', sighash_type))
    return dsha256(preimage)

def sign_funding_input(tx_hex, input_index, funding_script, value, privkey):
    tx_bytes = bytes.fromhex(tx_hex)
    sighash = bip143_sighash(tx_bytes, input_index, funding_script, value)
    sk = SigningKey.from_string(privkey, curve=SECP256k1)
    sig = sk.sign_digest(sighash, sigencode=sigencode_der)
    return sig + b'\\x01'`,
    },
    rewardSats: 21,
    group: "transactions/funding",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 7 -Derive Revocation Public Key
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-revocation-pubkey": {
    id: "ln-exercise-revocation-pubkey",
    title: "Exercise 7: Derive Revocation Public Key",
    description:
      "Derive a revocation public key from a revocation basepoint and a per-commitment point. The formula is: revocation_pubkey = revocation_basepoint * SHA256(revocation_basepoint || per_commitment_point) + per_commitment_point * SHA256(per_commitment_point || revocation_basepoint).",
    starterCode: `def derive_revocation_pubkey(revocation_basepoint: bytes, per_commitment_point: bytes) -> bytes:
    """
    Derive revocation public key per BOLT 3.

    Formula:
      revocation_pubkey = revocation_basepoint * SHA256(revocation_basepoint || per_commitment_point)
                        + per_commitment_point * SHA256(per_commitment_point || revocation_basepoint)

    Args:
        revocation_basepoint: 33-byte compressed public key
        per_commitment_point: 33-byte compressed public key

    Returns:
        bytes: 33-byte compressed revocation public key
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
from ecdsa import SECP256k1
from ecdsa.ellipticcurve import Point

CURVE = SECP256k1.curve
ORDER = SECP256k1.order

def _decompress(compressed):
    prefix = compressed[0]
    x = int.from_bytes(compressed[1:], 'big')
    p = CURVE.p()
    y_sq = (pow(x, 3, p) + CURVE.a() * x + CURVE.b()) % p
    y = pow(y_sq, (p + 1) // 4, p)
    if (y % 2 == 0) != (prefix == 0x02):
        y = p - y
    return Point(CURVE, x, y)

def _compress(point):
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def test_bolt3_vector():
    rev_bp = bytes.fromhex("036d6caac248af96f6afa7f904f550253a0f3ef3f5aa2fe6838a95b216691468e2")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    expected = bytes.fromhex("02916e326636d19c33f13e8c0c3a03dd157f332f3e99c317c141dd865eb01f8ff0")
    result = derive_revocation_pubkey(rev_bp, per_cp)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_returns_compressed():
    rev_bp = bytes.fromhex("036d6caac248af96f6afa7f904f550253a0f3ef3f5aa2fe6838a95b216691468e2")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    result = derive_revocation_pubkey(rev_bp, per_cp)
    assert len(result) == 33, f"Must be 33 bytes, got {len(result)}"
    assert result[0] in (2, 3), "Must start with 0x02 or 0x03"

def test_order_matters():
    rev_bp = bytes.fromhex("036d6caac248af96f6afa7f904f550253a0f3ef3f5aa2fe6838a95b216691468e2")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    r1 = derive_revocation_pubkey(rev_bp, per_cp)
    r2 = derive_revocation_pubkey(per_cp, rev_bp)
    assert r1 != r2, "Swapping arguments should produce different keys"
`,
    hints: {
      conceptual:
        "<p>The revocation public key is derived using a two-party computation. Each party contributes a scalar multiplier derived from hashing both points in a specific order. The formula ensures that the revocation key can only be computed when both the revocation basepoint secret and the per-commitment secret are known.</p>",
      steps:
        '<ol><li>Compute <code>factor_1 = SHA256(revocation_basepoint || per_commitment_point)</code></li><li>Compute <code>factor_2 = SHA256(per_commitment_point || revocation_basepoint)</code></li><li>Decompress both input points</li><li>Compute <code>result = revocation_basepoint_point * factor_1 + per_commitment_point_point * factor_2</code></li><li>Compress and return the result</li></ol>',
      code: `def derive_revocation_pubkey(revocation_basepoint, per_commitment_point):
    f1 = int.from_bytes(hashlib.sha256(revocation_basepoint + per_commitment_point).digest(), 'big') % ORDER
    f2 = int.from_bytes(hashlib.sha256(per_commitment_point + revocation_basepoint).digest(), 'big') % ORDER
    R = decompress_pubkey(revocation_basepoint)
    P = decompress_pubkey(per_commitment_point)
    result = R * f1 + P * f2
    return compress_point(result)`,
    },
    rewardSats: 21,
    group: "keys/commitment",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 8 -Derive Revocation Private Key
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-revocation-privkey": {
    id: "ln-exercise-revocation-privkey",
    title: "Exercise 8: Derive Revocation Private Key",
    description:
      "Derive the revocation private key from the revocation basepoint secret and the per-commitment secret. The formula mirrors the public key derivation: revocation_privkey = revocation_basepoint_secret * SHA256(revocation_basepoint || per_commitment_point) + per_commitment_secret * SHA256(per_commitment_point || revocation_basepoint), all mod n.",
    starterCode: `def derive_revocation_privkey(revocation_basepoint_secret: bytes,
                               per_commitment_secret: bytes) -> bytes:
    """
    Derive revocation private key per BOLT 3.

    Formula:
      revocation_privkey = revocation_basepoint_secret * SHA256(revocation_basepoint || per_commitment_point)
                         + per_commitment_secret * SHA256(per_commitment_point || revocation_basepoint)
      (all mod n, the curve order)

    Args:
        revocation_basepoint_secret: 32-byte private key
        per_commitment_secret: 32-byte private key

    Returns:
        bytes: 32-byte revocation private key
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def _p2p(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')

def test_bolt3_vector():
    rev_secret = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    per_secret = bytes.fromhex("1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100")
    expected = bytes.fromhex("d09ffff62ddb2297ab000cc85bcb4283fdeb6aa052affbc9dddcf33b61078110")
    result = derive_revocation_privkey(rev_secret, per_secret)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_returns_32_bytes():
    rev_secret = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    per_secret = bytes.fromhex("1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100")
    result = derive_revocation_privkey(rev_secret, per_secret)
    assert len(result) == 32, f"Must be 32 bytes, got {len(result)}"

def test_pubkey_consistency():
    rev_secret = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    per_secret = bytes.fromhex("1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100")
    privkey = derive_revocation_privkey(rev_secret, per_secret)
    pubkey = _p2p(privkey)
    assert len(pubkey) == 33, "Derived pubkey should be valid"
`,
    hints: {
      conceptual:
        "<p>The revocation private key derivation mirrors the public key version but works with scalars instead of points. You compute the same SHA256 factors, multiply them by the respective private keys, and add the results modulo the curve order n.</p>",
      steps:
        '<ol><li>Compute revocation_basepoint and per_commitment_point public keys from the secrets</li><li>Compute <code>f1 = SHA256(revocation_basepoint || per_commitment_point)</code></li><li>Compute <code>f2 = SHA256(per_commitment_point || revocation_basepoint)</code></li><li>Result = <code>(rev_secret_int * f1_int + per_secret_int * f2_int) % ORDER</code></li><li>Return as 32 bytes big-endian</li></ol>',
      code: `def derive_revocation_privkey(revocation_basepoint_secret, per_commitment_secret):
    rev_pub = privkey_to_pubkey(revocation_basepoint_secret)
    per_pub = privkey_to_pubkey(per_commitment_secret)
    f1 = int.from_bytes(hashlib.sha256(rev_pub + per_pub).digest(), 'big') % ORDER
    f2 = int.from_bytes(hashlib.sha256(per_pub + rev_pub).digest(), 'big') % ORDER
    rev_int = int.from_bytes(revocation_basepoint_secret, 'big')
    per_int = int.from_bytes(per_commitment_secret, 'big')
    result = (rev_int * f1 + per_int * f2) % ORDER
    return result.to_bytes(32, 'big')`,
    },
    rewardSats: 21,
    group: "keys/commitment",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 9 -Build Commitment Secret
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-secret": {
    id: "ln-exercise-commitment-secret",
    title: "Exercise 9: Build Commitment Secret",
    description:
      "Implement the shachain algorithm to derive a commitment secret from a seed and index. For each of the 48 bits (from bit 47 down to bit 0), if the bit at position i in the index is set, flip bit i in the seed and hash with SHA256.",
    starterCode: `import hashlib

def build_commitment_secret(seed: bytes, index: int) -> bytes:
    """
    Derive a per-commitment secret using the shachain algorithm (BOLT 3).

    For each bit position i from 47 down to 0:
        If bit i of index is set (1):
            - Flip bit i of the current value
            - Hash the result with SHA256

    Args:
        seed: 32-byte commitment seed
        index: commitment number (0 to 2^48-1)

    Returns:
        bytes: 32-byte commitment secret
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    seed = bytes(32)  # all zeros
    index = 281474976710655  # 2^48 - 1
    expected = bytes.fromhex("02a40c85b6f28da08dfdbe0926c53fab2de6d28c10301f8f7c4073d5e42e3148")
    result = build_commitment_secret(seed, index)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_different_indices():
    seed = bytes(32)
    r1 = build_commitment_secret(seed, 0)
    r2 = build_commitment_secret(seed, 1)
    assert r1 != r2, "Different indices must produce different secrets"

def test_index_zero():
    seed = bytes(32)
    result = build_commitment_secret(seed, 0)
    assert len(result) == 32, "Must return 32 bytes"
    # Index 0 has no bits set, so result should equal seed
    assert result == seed, "Index 0 with no bits set should return seed unchanged"

def test_deterministic():
    seed = bytes.fromhex("0102030405060708091011121314151617181920212223242526272829303132")
    r1 = build_commitment_secret(seed, 42)
    r2 = build_commitment_secret(seed, 42)
    assert r1 == r2, "Same inputs must produce same output"
`,
    hints: {
      conceptual:
        "<p>The shachain (SHA-chain) algorithm allows efficient storage of per-commitment secrets. Starting from a seed, for each bit position i (from 47 down to 0), if bit i is set in the index, flip that bit in the working value and hash with SHA256. Flipping bit i means XORing the byte at position <code>i // 8</code> with <code>1 << (i % 8)</code>.</p>",
      steps:
        '<ol><li>Start with <code>value = bytearray(seed)</code></li><li>For each bit position i from 47 down to 0:<ul><li>Check if bit i is set in index: <code>index >> i & 1</code></li><li>If set, flip bit i: <code>value[i // 8] ^= (1 << (i % 8))</code></li><li>If set, hash: <code>value = bytearray(hashlib.sha256(value).digest())</code></li></ul></li><li>Return <code>bytes(value)</code></li></ol>',
      code: `import hashlib

def build_commitment_secret(seed: bytes, index: int) -> bytes:
    value = bytearray(seed)
    for i in range(47, -1, -1):
        if (index >> i) & 1:
            value[i // 8] ^= (1 << (i % 8))
            value = bytearray(hashlib.sha256(value).digest())
    return bytes(value)`,
    },
    rewardSats: 21,
    group: "keys/channel_keys",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 10 -Derive Per-Commitment Point
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-per-commitment-point": {
    id: "ln-exercise-per-commitment-point",
    title: "Exercise 10: Derive Per-Commitment Point",
    description:
      "Derive a per-commitment point from a commitment seed and commitment number. The per-commitment point is the public key corresponding to the per-commitment secret.",
    starterCode: `def derive_per_commitment_point(seed: bytes, commitment_number: int) -> bytes:
    """
    Derive the per-commitment point for a given commitment number.

    The per-commitment point is the compressed public key of the
    per-commitment secret.

    Args:
        seed: 32-byte commitment seed
        commitment_number: commitment number

    Returns:
        bytes: 33-byte compressed per-commitment point
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
from ecdsa import SECP256k1, SigningKey

def _build_secret(seed, index):
    value = bytearray(seed)
    for i in range(47, -1, -1):
        if (index >> i) & 1:
            value[i // 8] ^= (1 << (i % 8))
            value = bytearray(hashlib.sha256(value).digest())
    return bytes(value)

def _p2p(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')

def test_returns_compressed_pubkey():
    seed = bytes(32)
    result = derive_per_commitment_point(seed, 281474976710655)
    assert len(result) == 33, f"Must be 33 bytes, got {len(result)}"
    assert result[0] in (2, 3), "Must start with 0x02 or 0x03"

def test_matches_secret_pubkey():
    seed = bytes(32)
    idx = 281474976710655
    secret = _build_secret(seed, idx)
    expected = _p2p(secret)
    result = derive_per_commitment_point(seed, idx)
    assert result == expected, "Must equal pubkey of commitment secret"

def test_different_commitments():
    seed = bytes(32)
    p1 = derive_per_commitment_point(seed, 0)
    p2 = derive_per_commitment_point(seed, 1)
    assert p1 != p2, "Different commitment numbers must produce different points"
`,
    hints: {
      conceptual:
        "<p>The per-commitment point is simply the public key derived from the per-commitment secret. First compute the secret using the shachain algorithm, then derive the compressed public key from that secret.</p>",
      steps:
        '<ol><li>Compute the secret: <code>secret = build_commitment_secret(seed, commitment_number)</code></li><li>Create a signing key from the secret</li><li>Get the verifying (public) key and compress it</li></ol>',
      code: `def derive_per_commitment_point(seed, commitment_number):
    secret = build_commitment_secret(seed, commitment_number)
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')`,
    },
    rewardSats: 21,
    group: "keys/channel_keys",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 11 -Derive Public Key from Basepoint
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-derive-pubkey": {
    id: "ln-exercise-derive-pubkey",
    title: "Exercise 11: Derive Public Key from Basepoint",
    description:
      "Derive a public key from a basepoint and per-commitment point. The formula is: derived_key = basepoint + G * SHA256(per_commitment_point || basepoint). This is used to derive per-commitment versions of htlc_pubkey and delayed_payment_pubkey.",
    starterCode: `def derive_pubkey(basepoint: bytes, per_commitment_point: bytes) -> bytes:
    """
    Derive a public key per BOLT 3.

    Formula:
      derived_key = basepoint + G * SHA256(per_commitment_point || basepoint)

    Args:
        basepoint: 33-byte compressed public key
        per_commitment_point: 33-byte compressed public key

    Returns:
        bytes: 33-byte compressed derived public key
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
from ecdsa import SECP256k1
from ecdsa.ellipticcurve import Point

CURVE = SECP256k1.curve
G = SECP256k1.generator
ORDER = SECP256k1.order

def test_bolt3_vector():
    basepoint = bytes.fromhex("036d6caac248af96f6afa7f904f550253a0f3ef3f5aa2fe6838a95b216691468e2")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    expected = bytes.fromhex("0235f2dbfaa89b57ec7b055afe29849ef7ddfeb1cefdb9ebdc43f5494984db29e5")
    result = derive_pubkey(basepoint, per_cp)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_returns_compressed():
    basepoint = bytes.fromhex("036d6caac248af96f6afa7f904f550253a0f3ef3f5aa2fe6838a95b216691468e2")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    result = derive_pubkey(basepoint, per_cp)
    assert len(result) == 33, f"Must be 33 bytes, got {len(result)}"
    assert result[0] in (2, 3), "Must start with 0x02 or 0x03"
`,
    hints: {
      conceptual:
        "<p>This key derivation adds a tweak to the basepoint: the tweak is <code>G * SHA256(per_commitment_point || basepoint)</code>. The SHA256 hash of the concatenated points creates a unique scalar, which when multiplied by the generator G produces a tweak point. Adding this to the basepoint gives the derived key.</p>",
      steps:
        '<ol><li>Compute <code>tweak = SHA256(per_commitment_point || basepoint)</code></li><li>Convert tweak to integer mod ORDER</li><li>Decompress basepoint to a point B</li><li>Compute <code>result = B + G * tweak_int</code></li><li>Compress and return</li></ol>',
      code: `def derive_pubkey(basepoint, per_commitment_point):
    tweak = int.from_bytes(hashlib.sha256(per_commitment_point + basepoint).digest(), 'big') % ORDER
    B = decompress_pubkey(basepoint)
    result = B + G * tweak
    return compress_point(result)`,
    },
    rewardSats: 21,
    group: "keys/commitment",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 12 -Derive Private Key from Basepoint Secret
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-derive-privkey": {
    id: "ln-exercise-derive-privkey",
    title: "Exercise 12: Derive Private Key",
    description:
      "Derive a private key from a basepoint secret and per-commitment point. The formula is: derived_privkey = basepoint_secret + SHA256(per_commitment_point || basepoint) mod n.",
    starterCode: `def derive_privkey(basepoint_secret: bytes, per_commitment_point: bytes) -> bytes:
    """
    Derive a private key per BOLT 3.

    Formula:
      derived_privkey = basepoint_secret + SHA256(per_commitment_point || basepoint) mod n

    Args:
        basepoint_secret: 32-byte private key
        per_commitment_point: 33-byte compressed public key

    Returns:
        bytes: 32-byte derived private key
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
from ecdsa import SECP256k1, SigningKey

ORDER = SECP256k1.order

def _p2p(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')

def test_bolt3_vector():
    secret = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    expected = bytes.fromhex("cbced912d3b21bf196a766651e436aff192362621ce317704ea2f75d87e7be0f")
    result = derive_privkey(secret, per_cp)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_returns_32_bytes():
    secret = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    result = derive_privkey(secret, per_cp)
    assert len(result) == 32, f"Must be 32 bytes, got {len(result)}"
`,
    hints: {
      conceptual:
        "<p>The private key derivation is the scalar version of the public key derivation. Instead of adding points, you add scalars: the basepoint secret plus the SHA256 tweak, all modulo the curve order n.</p>",
      steps:
        '<ol><li>Compute the basepoint (public key) from the secret</li><li>Compute <code>tweak = SHA256(per_commitment_point || basepoint)</code></li><li>Result = <code>(basepoint_secret_int + tweak_int) % ORDER</code></li><li>Return as 32 bytes big-endian</li></ol>',
      code: `def derive_privkey(basepoint_secret, per_commitment_point):
    basepoint = privkey_to_pubkey(basepoint_secret)
    tweak = int.from_bytes(hashlib.sha256(per_commitment_point + basepoint).digest(), 'big') % ORDER
    secret_int = int.from_bytes(basepoint_secret, 'big')
    result = (secret_int + tweak) % ORDER
    return result.to_bytes(32, 'big')`,
    },
    rewardSats: 21,
    group: "keys/commitment",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 13 -Create to_remote Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-to-remote-script": {
    id: "ln-exercise-to-remote-script",
    title: "Exercise 13: Create to_remote Script",
    description:
      "Create the to_remote output script for a commitment transaction. This is a standard P2WPKH script: OP_0 <20-byte HASH160 of remote pubkey>.",
    starterCode: `def create_to_remote_script(remote_pubkey: bytes) -> bytes:
    """
    Create the to_remote output script (P2WPKH).

    Format: OP_0 <20-byte-pubkey-hash>
    Where OP_0 = 0x00, push-20 = 0x14

    Args:
        remote_pubkey: 33-byte compressed public key

    Returns:
        bytes: P2WPKH script
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    remote_pubkey = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    expected = bytes.fromhex("0014cc1b07838e387deacd0e5232e1e8b49f4c29e484")
    result = create_to_remote_script(remote_pubkey)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_script_structure():
    remote_pubkey = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    result = create_to_remote_script(remote_pubkey)
    assert result[0] == 0x00, "Must start with OP_0"
    assert result[1] == 0x14, "Must push 20 bytes"
    assert len(result) == 22, f"P2WPKH script must be 22 bytes, got {len(result)}"

def test_uses_hash160():
    remote_pubkey = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    result = create_to_remote_script(remote_pubkey)
    h160 = hashlib.new('ripemd160', hashlib.sha256(remote_pubkey).digest()).digest()
    assert result[2:] == h160, "Must use HASH160 of the pubkey"
`,
    hints: {
      conceptual:
        "<p>The to_remote output pays to the remote party's pubkey using P2WPKH (Pay to Witness Public Key Hash). P2WPKH scripts are simply <code>OP_0 PUSH20 HASH160(pubkey)</code>, where HASH160 is RIPEMD160(SHA256(pubkey)).</p>",
      steps:
        '<ol><li>Compute HASH160 of the remote pubkey: <code>RIPEMD160(SHA256(pubkey))</code></li><li>Build script: <code>b"\\x00\\x14" + hash160_result</code></li></ol>',
      code: `def create_to_remote_script(remote_pubkey):
    return b'\\x00\\x14' + hash160(remote_pubkey)`,
    },
    rewardSats: 21,
    group: "scripts/commitment",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 14 -Create to_local Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-to-local-script": {
    id: "ln-exercise-to-local-script",
    title: "Exercise 14: Create to_local Script",
    description:
      "Create the to_local output script for a commitment transaction. This script allows the revocation key holder to spend immediately, or the local party to spend after a CSV delay.",
    starterCode: `def create_to_local_script(revocation_pubkey: bytes,
                            local_delayed_pubkey: bytes,
                            to_self_delay: int) -> bytes:
    """
    Create the to_local output script per BOLT 3.

    Script:
      OP_IF
          <revocation_pubkey>
      OP_ELSE
          <to_self_delay> OP_CHECKSEQUENCEVERIFY OP_DROP
          <local_delayed_pubkey>
      OP_ENDIF
      OP_CHECKSIG

    Args:
        revocation_pubkey: 33-byte compressed pubkey
        local_delayed_pubkey: 33-byte compressed pubkey
        to_self_delay: CSV delay in blocks

    Returns:
        bytes: raw script bytes
    """
    # === YOUR CODE HERE ===
    # Opcodes:
    # OP_IF = 0x63, OP_ELSE = 0x67, OP_ENDIF = 0x68
    # OP_CHECKSEQUENCEVERIFY = 0xb2, OP_DROP = 0x75
    # OP_CHECKSIG = 0xac
    # Push 33 bytes = 0x21
    pass
`,
    testCode: `
def test_bolt3_vector():
    revocation_pubkey = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_delayed_pubkey = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    to_self_delay = 144
    expected = bytes.fromhex("63210212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b1967029000b2752103fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c68ac")
    result = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_script_structure():
    revocation_pubkey = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_delayed_pubkey = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_to_local_script(revocation_pubkey, local_delayed_pubkey, 144)
    assert result[0] == 0x63, "Must start with OP_IF"
    assert result[-1] == 0xac, "Must end with OP_CHECKSIG"
`,
    hints: {
      conceptual:
        "<p>The to_local script is a conditional: if the revocation key is used (OP_IF branch), spending is immediate. Otherwise (OP_ELSE), the local party must wait <code>to_self_delay</code> blocks (CSV). The delay is encoded as a minimally-encoded Script integer (e.g. 144 = 0x0090 in little-endian, pushed as 2 bytes).</p>",
      steps:
        '<ol><li>Encode the delay as a minimal Script integer (use <code>to_self_delay.to_bytes(2, "little")</code> for values > 127)</li><li>Build: <code>OP_IF PUSH33 revocation_pubkey OP_ELSE PUSH_delay delay_bytes OP_CSV OP_DROP PUSH33 local_delayed_pubkey OP_ENDIF OP_CHECKSIG</code></li></ol>',
      code: `def create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay):
    # Encode delay as minimal Script integer
    if to_self_delay <= 0x7f:
        delay = bytes([to_self_delay])
    else:
        delay = to_self_delay.to_bytes(2, 'little')

    script = b''
    script += b'\\x63'  # OP_IF
    script += b'\\x21' + revocation_pubkey  # PUSH33 + key
    script += b'\\x67'  # OP_ELSE
    script += bytes([len(delay)]) + delay  # push delay
    script += b'\\xb2'  # OP_CHECKSEQUENCEVERIFY
    script += b'\\x75'  # OP_DROP
    script += b'\\x21' + local_delayed_pubkey  # PUSH33 + key
    script += b'\\x68'  # OP_ENDIF
    script += b'\\xac'  # OP_CHECKSIG
    return script`,
    },
    rewardSats: 21,
    group: "scripts/commitment",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 15 -Compute Obscured Commitment Number
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-obscure-factor": {
    id: "ln-exercise-obscure-factor",
    title: "Exercise 15: Compute Obscured Commitment Number",
    description:
      "Compute the commitment transaction number obscure factor from the opener and accepter payment basepoints. The factor is the lower 48 bits of SHA256(opener_payment_basepoint || accepter_payment_basepoint).",
    starterCode: `import hashlib

def get_obscure_factor(opener_payment_basepoint: bytes,
                       accepter_payment_basepoint: bytes) -> int:
    """
    Compute the obscure factor per BOLT 3.

    Factor = lower 48 bits of SHA256(opener_payment_basepoint || accepter_payment_basepoint)

    Args:
        opener_payment_basepoint: 33-byte compressed pubkey (channel opener)
        accepter_payment_basepoint: 33-byte compressed pubkey (channel accepter)

    Returns:
        int: 48-bit obscure factor
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    expected = 0x2bb038521914
    result = get_obscure_factor(opener, accepter)
    assert result == expected, f"Expected {hex(expected)}, got {hex(result)}"

def test_48_bit_max():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    result = get_obscure_factor(opener, accepter)
    assert result < (1 << 48), "Must be at most 48 bits"

def test_order_matters():
    a = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    b = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    r1 = get_obscure_factor(a, b)
    r2 = get_obscure_factor(b, a)
    assert r1 != r2, "Order of basepoints matters"
`,
    hints: {
      conceptual:
        "<p>The obscure factor hides the actual commitment number in the transaction's locktime and sequence fields. It is computed by concatenating the opener and accepter payment basepoints, hashing with SHA256, and taking the lower 48 bits of the result.</p>",
      steps:
        '<ol><li>Concatenate: <code>data = opener_payment_basepoint + accepter_payment_basepoint</code></li><li>Hash: <code>h = SHA256(data)</code></li><li>Take last 6 bytes: <code>int.from_bytes(h[26:32], "big")</code></li></ol>',
      code: `import hashlib

def get_obscure_factor(opener_payment_basepoint, accepter_payment_basepoint):
    h = hashlib.sha256(opener_payment_basepoint + accepter_payment_basepoint).digest()
    return int.from_bytes(h[26:32], 'big')`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 16 -Set Obscured Commitment Number in TX
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-obscured-commitment": {
    id: "ln-exercise-obscured-commitment",
    title: "Exercise 16: Set Obscured Commitment Number",
    description:
      "Given a commitment number and the obscure factor, set the obscured commitment number in a transaction's locktime and input sequence fields. The lower 24 bits go in locktime (with upper byte 0x20), the upper 24 bits go in input[0].sequence (with upper byte 0x80).",
    starterCode: `def set_obscured_commitment_number(tx_bytes: bytearray,
                                    commitment_number: int,
                                    opener_bp: bytes,
                                    accepter_bp: bytes) -> bytearray:
    """
    Set the obscured commitment number in a transaction.

    The obscured number = commitment_number XOR obscure_factor.
    Lower 24 bits → locktime (upper byte = 0x20)
    Upper 24 bits → input[0] sequence (upper byte = 0x80)

    This function modifies the transaction bytes in-place and returns them.

    Args:
        tx_bytes: mutable transaction bytes
        commitment_number: the commitment index (e.g. 42)
        opener_bp: 33-byte opener payment basepoint
        accepter_bp: 33-byte accepter payment basepoint

    Returns:
        bytearray: modified transaction bytes
    """
    # === YOUR CODE HERE ===
    # Locktime is the last 4 bytes of the transaction
    # Sequence is at bytes [42:46] for a single-input tx with empty scriptSig
    pass
`,
    testCode: `
import hashlib
import struct

def _get_factor(a, b):
    h = hashlib.sha256(a + b).digest()
    return int.from_bytes(h[26:32], 'big')

def test_bolt3_values():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    commitment_number = 42
    factor = _get_factor(opener, accepter)
    obscured = factor ^ commitment_number
    # Build a minimal tx: version(4) + input_count(1) + prev_txid(32) + prev_vout(4) + scriptSig_len(1=0) + sequence(4) + output_count(1) + locktime(4)
    tx = bytearray(4 + 1 + 32 + 4 + 1 + 4 + 1 + 4)
    tx[0:4] = struct.pack('<I', 2)  # version 2
    result = set_obscured_commitment_number(tx, commitment_number, opener, accepter)
    locktime = struct.unpack('<I', bytes(result[-4:]))[0]
    assert locktime >> 24 == 0x20, f"Locktime upper byte must be 0x20, got {locktime >> 24:#x}"
    lower_24 = locktime & 0xffffff
    assert lower_24 == (obscured & 0xffffff), "Locktime lower 24 bits must match"

def test_sequence_upper_byte():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    tx = bytearray(4 + 1 + 32 + 4 + 1 + 4 + 1 + 4)
    tx[0:4] = struct.pack('<I', 2)
    result = set_obscured_commitment_number(tx, 42, opener, accepter)
    seq = struct.unpack('<I', bytes(result[42:46]))[0]
    assert seq >> 24 == 0x80, f"Sequence upper byte must be 0x80, got {seq >> 24:#x}"
`,
    hints: {
      conceptual:
        "<p>Commitment transactions encode the commitment number in an obscured form across two fields: the locktime and the first input's sequence number. XOR the commitment number with the obscure factor, then split the 48-bit result: lower 24 bits go to locktime (with 0x20 as upper byte), upper 24 bits go to sequence (with 0x80 as upper byte).</p>",
      steps:
        '<ol><li>Compute <code>obscured = commitment_number ^ get_obscure_factor(...)</code></li><li>Locktime = <code>(0x20 << 24) | (obscured & 0xFFFFFF)</code></li><li>Sequence = <code>(0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)</code></li><li>Write locktime to last 4 bytes, sequence to bytes [42:46]</li></ol>',
      code: `def set_obscured_commitment_number(tx_bytes, commitment_number, opener_bp, accepter_bp):
    obscured = commitment_number ^ get_obscure_factor(opener_bp, accepter_bp)
    locktime = (0x20 << 24) | (obscured & 0xFFFFFF)
    sequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)
    struct.pack_into('<I', tx_bytes, len(tx_bytes) - 4, locktime)
    struct.pack_into('<I', tx_bytes, 42, sequence)
    return tx_bytes`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 17 -Create Commitment Transaction Outputs
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-outputs": {
    id: "ln-exercise-commitment-outputs",
    title: "Exercise 17: Create Commitment TX Outputs",
    description:
      "Create the commitment transaction outputs (to_local and to_remote), applying dust limit filtering and fee deduction from the to_local output. Sort outputs by value then by script bytes (BIP69-like).",
    starterCode: `def create_commitment_outputs(to_local_sat: int, to_remote_sat: int,
                               revocation_pubkey: bytes, local_delayed_pubkey: bytes,
                               remote_payment_pubkey: bytes,
                               to_self_delay: int, dust_limit: int,
                               fee: int) -> list:
    """
    Create commitment transaction outputs with dust filtering.

    Fee is deducted from to_local. Outputs below dust_limit are omitted.
    The to_local output uses P2WSH (OP_0 + SHA256 of witness script).
    Sort outputs by: (value, script_bytes).

    Args:
        to_local_sat: local balance in satoshis
        to_remote_sat: remote balance in satoshis
        revocation_pubkey: 33-byte compressed pubkey
        local_delayed_pubkey: 33-byte compressed pubkey
        remote_payment_pubkey: 33-byte compressed pubkey
        to_self_delay: CSV delay in blocks
        dust_limit: dust limit in satoshis
        fee: fee to deduct from to_local

    Returns:
        list of dicts: [{'value': int, 'script': bytes}, ...]
        sorted by (value, script)
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def _h160(data):
    return hashlib.new('ripemd160', hashlib.sha256(data).digest()).digest()

def test_two_outputs():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    outputs = create_commitment_outputs(7_000_000, 3_000_000, rev_pk, delayed_pk, remote_pk, 144, 546, 10000)
    assert len(outputs) == 2, f"Expected 2 outputs, got {len(outputs)}"

def test_fee_deducted_from_local():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    outputs = create_commitment_outputs(7_000_000, 3_000_000, rev_pk, delayed_pk, remote_pk, 144, 546, 10000)
    values = sorted([o['value'] for o in outputs])
    assert 3_000_000 in values, "to_remote should be 3,000,000"
    assert 6_990_000 in values, "to_local should be 7,000,000 - 10,000 = 6,990,000"

def test_dust_filtering():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    outputs = create_commitment_outputs(500, 400, rev_pk, delayed_pk, remote_pk, 144, 546, 100)
    assert len(outputs) == 0, "Both below dust should produce no outputs"

def test_sorted_by_value():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    outputs = create_commitment_outputs(7_000_000, 3_000_000, rev_pk, delayed_pk, remote_pk, 144, 546, 10000)
    assert outputs[0]['value'] <= outputs[1]['value'], "Outputs must be sorted by value"
`,
    hints: {
      conceptual:
        "<p>Commitment transactions have two main outputs: to_local (P2WSH of the conditional revocation/delay script) and to_remote (P2WPKH). The fee is deducted from the local party's balance. Any output below the dust limit is omitted entirely. Outputs are sorted by value, then by script bytes.</p>",
      steps:
        '<ol><li>Compute to_local_value = to_local_sat - fee</li><li>Build to_local witness script, then P2WSH: <code>b"\\x00\\x20" + SHA256(witness_script)</code></li><li>Build to_remote P2WPKH script</li><li>Add outputs where value >= dust_limit</li><li>Sort by (value, script)</li></ol>',
      code: `def create_commitment_outputs(to_local_sat, to_remote_sat, revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey, to_self_delay, dust_limit, fee):
    outputs = []
    to_local_value = to_local_sat - fee
    if to_local_value >= dust_limit:
        witness_script = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
        p2wsh = b'\\x00\\x20' + hashlib.sha256(witness_script).digest()
        outputs.append({'value': to_local_value, 'script': p2wsh})
    if to_remote_sat >= dust_limit:
        p2wpkh = create_to_remote_script(remote_payment_pubkey)
        outputs.append({'value': to_remote_sat, 'script': p2wpkh})
    outputs.sort(key=lambda o: (o['value'], o['script']))
    return outputs`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 18 -Create Commitment Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-tx": {
    id: "ln-exercise-commitment-tx",
    title: "Exercise 18: Create Commitment Transaction",
    description:
      "Assemble a complete unsigned commitment transaction with the funding input, obscured commitment number, and sorted outputs. This combines all the previous building blocks.",
    starterCode: `def create_commitment_tx(funding_txid_hex: str, funding_vout: int,
                          to_local_sat: int, to_remote_sat: int,
                          revocation_pubkey: bytes, local_delayed_pubkey: bytes,
                          remote_payment_pubkey: bytes,
                          opener_bp: bytes, accepter_bp: bytes,
                          commitment_number: int, to_self_delay: int,
                          dust_limit: int, feerate_per_kw: int) -> str:
    """
    Create an unsigned commitment transaction.

    Combines: funding input, obscured commitment number,
    to_local/to_remote outputs with dust filtering and fee deduction.

    Fee calculation: weight = 724 (base commitment tx weight for 2 outputs),
    fee = weight * feerate_per_kw / 1000

    Args:
        funding_txid_hex: funding txid (big-endian hex)
        funding_vout: funding output index
        to_local_sat: local balance in satoshis
        to_remote_sat: remote balance in satoshis
        revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey: keys
        opener_bp, accepter_bp: payment basepoints
        commitment_number: commitment index
        to_self_delay: CSV delay in blocks
        dust_limit: dust limit satoshis
        feerate_per_kw: fee rate per kilo-weight unit

    Returns:
        str: hex-encoded unsigned commitment transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
def test_bolt3_no_htlcs():
    funding_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    opener_bp = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter_bp = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    # feerate_per_kw=0 so fee=0
    result = create_commitment_tx(funding_txid, 0, 7_000_000, 3_000_000, rev_pk, delayed_pk, remote_pk, opener_bp, accepter_bp, 42, 144, 546, 0)
    expected = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a488489000000000038b02b8002c0c62d0000000000160014cc1b07838e387deacd0e5232e1e8b49f4c29e484c0cf6a0000000000220020f50bac8895d89a8a4f1de0b87bf52383f4d853e4368db17467fa50e3798d69803e195220"
    assert result == expected, f"TX mismatch.\\nExpected: {expected}\\nGot:      {result}"

def test_returns_string():
    funding_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    opener_bp = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter_bp = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    result = create_commitment_tx(funding_txid, 0, 7_000_000, 3_000_000, rev_pk, delayed_pk, remote_pk, opener_bp, accepter_bp, 42, 144, 546, 0)
    assert isinstance(result, str), "Must return hex string"
`,
    hints: {
      conceptual:
        "<p>The commitment transaction ties everything together: a single input spending the funding output, obscured commitment number encoded in locktime/sequence, and sorted to_local/to_remote outputs. The input's sequence and locktime carry the obscured commitment number.</p>",
      steps:
        '<ol><li>Compute fee: <code>724 * feerate_per_kw // 1000</code></li><li>Build outputs list (to_local with fee deducted, to_remote), filter dust, sort</li><li>Build version(2) + input(reversed txid, vout, empty scriptSig, sequence) + outputs + locktime</li><li>Set obscured commitment number in sequence and locktime fields</li><li>Return hex string</li></ol>',
      code: `def create_commitment_tx(funding_txid_hex, funding_vout, to_local_sat, to_remote_sat,
                          revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey,
                          opener_bp, accepter_bp, commitment_number, to_self_delay,
                          dust_limit, feerate_per_kw):
    fee = 724 * feerate_per_kw // 1000
    outputs = []
    to_local_value = to_local_sat - fee
    if to_local_value >= dust_limit:
        ws = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
        p2wsh = b'\\x00\\x20' + hashlib.sha256(ws).digest()
        outputs.append({'value': to_local_value, 'script': p2wsh})
    if to_remote_sat >= dust_limit:
        p2wpkh = create_to_remote_script(remote_payment_pubkey)
        outputs.append({'value': to_remote_sat, 'script': p2wpkh})
    outputs.sort(key=lambda o: (o['value'], o['script']))

    obscured = commitment_number ^ get_obscure_factor(opener_bp, accepter_bp)
    locktime = (0x20 << 24) | (obscured & 0xFFFFFF)
    sequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)

    tx = struct.pack('<I', 2)  # version
    tx += b'\\x01'  # input count
    tx += bytes.fromhex(funding_txid_hex)[::-1]
    tx += struct.pack('<I', funding_vout)
    tx += b'\\x00'  # empty scriptSig
    tx += struct.pack('<I', sequence)
    tx += bytes([len(outputs)])  # output count
    for o in outputs:
        tx += struct.pack('<q', o['value'])
        tx += bytes([len(o['script'])]) + o['script']
    tx += struct.pack('<I', locktime)
    return tx.hex()`,
    },
    rewardSats: 42,
    group: "transactions/commitment",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 19 -Finalize Commitment Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-finalize-commitment": {
    id: "ln-exercise-finalize-commitment",
    title: "Exercise 19: Finalize Commitment Transaction",
    description:
      "Add the witness (signatures + funding script) to a commitment transaction to produce the final signed transaction. The witness stack is: [empty, local_sig, remote_sig, funding_script].",
    starterCode: `def finalize_commitment_tx(unsigned_tx_hex: str,
                            funding_script: bytes,
                            funding_amount: int,
                            local_funding_privkey: bytes,
                            remote_signature: bytes,
                            local_sig_first: bool) -> str:
    """
    Sign and finalize a commitment transaction.

    Steps:
    1. Compute BIP143 sighash over the unsigned tx
    2. Sign with local funding key (DER + SIGHASH_ALL)
    3. Build witness: [empty, sig1, sig2, funding_script]
       sig1/sig2 order depends on local_sig_first

    Outputs a segwit transaction (with witness marker 0x0001).

    Args:
        unsigned_tx_hex: hex of unsigned commitment tx
        funding_script: the 2-of-2 multisig script
        funding_amount: satoshi value of funding output
        local_funding_privkey: 32-byte private key
        remote_signature: DER signature + SIGHASH_ALL byte
        local_sig_first: True if local sig comes first in witness

    Returns:
        str: hex of signed segwit commitment transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
def test_returns_string():
    # Minimal test to verify return type
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a488489000000000038b02b8002c0c62d0000000000160014cc1b07838e387deacd0e5232e1e8b49f4c29e48454a56a00000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80e3e195220"
    funding_script = bytes.fromhex("5221023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb21030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c152ae")
    privkey = bytes.fromhex("30ff4956bbdd3222d44cc5e8a1261dab1e07957bdac5ae88fe3261ef321f3749")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    result = finalize_commitment_tx(unsigned_tx, funding_script, 10_000_000, privkey, remote_sig, True)
    assert isinstance(result, str), "Must return hex string"
    assert "0001" in result[:12], "Must include segwit marker"
`,
    hints: {
      conceptual:
        "<p>Finalizing a commitment transaction means adding the segwit witness. The witness for a 2-of-2 multisig P2WSH input is: [empty (OP_0 dummy for CHECKMULTISIG bug), signature_1, signature_2, witness_script]. The transaction format changes to include the segwit marker (0x00, 0x01) after the version and the witness data before the locktime.</p>",
      steps:
        '<ol><li>Parse the unsigned tx to extract components</li><li>Compute BIP143 sighash using the funding_script and funding_amount</li><li>Sign with local key: <code>sk.sign_digest(sighash, sigencode=sigencode_der) + b"\\x01"</code></li><li>Order sigs: if local_sig_first, local then remote; else remote then local</li><li>Build segwit tx: version + marker(00 01) + inputs + outputs + witness(4 items) + locktime</li></ol>',
      code: `def finalize_commitment_tx(unsigned_tx_hex, funding_script, funding_amount,
                            local_funding_privkey, remote_signature, local_sig_first):
    tx = bytes.fromhex(unsigned_tx_hex)
    def dsha256(d): return hashlib.sha256(hashlib.sha256(d).digest()).digest()

    version = tx[0:4]
    prevhash = tx[5:37]
    previndex = tx[37:41]
    sequence = tx[42:46]
    out_start = 47
    locktime = tx[-4:]
    outputs = tx[out_start:-4]

    hp = dsha256(prevhash + previndex)
    hs = dsha256(sequence)
    ho = dsha256(outputs[1:])  # skip output count byte
    sc = bytes([len(funding_script)]) + funding_script
    preimage = (version + hp + hs + prevhash + previndex + sc
                + struct.pack('<q', funding_amount) + sequence + ho
                + locktime + struct.pack('<I', 1))
    sighash = dsha256(preimage)

    sk = SigningKey.from_string(local_funding_privkey, curve=SECP256k1)
    local_sig = sk.sign_digest(sighash, sigencode=sigencode_der) + b'\\x01'

    if local_sig_first:
        sig1, sig2 = local_sig, remote_signature
    else:
        sig1, sig2 = remote_signature, local_sig

    # Build segwit tx
    result = version
    result += b'\\x00\\x01'  # segwit marker
    result += tx[4:out_start]  # input count + inputs (without witness)
    result += outputs  # output count + outputs
    # Witness: 4 items
    result += b'\\x04'
    result += b'\\x00'  # empty (OP_0 dummy)
    result += bytes([len(sig1)]) + sig1
    result += bytes([len(sig2)]) + sig2
    result += bytes([len(funding_script)]) + funding_script
    result += locktime
    return result.hex()`,
    },
    rewardSats: 42,
    group: "transactions/commitment",
    groupOrder: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 20 -Create Offered HTLC Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-offered-htlc-script": {
    id: "ln-exercise-offered-htlc-script",
    title: "Exercise 20: Create Offered HTLC Script",
    description:
      "Create an offered HTLC output script per BOLT 3. This script allows the remote party to claim with the payment preimage, or the local party to claim after timeout.",
    starterCode: `def create_offered_htlc_script(revocation_pubkey: bytes,
                                local_htlc_pubkey: bytes,
                                remote_htlc_pubkey: bytes,
                                payment_hash: bytes) -> bytes:
    """
    Create an offered HTLC script per BOLT 3.

    Script:
      OP_DUP OP_HASH160 <HASH160(revocation_pubkey)> OP_EQUAL
      OP_IF
          OP_CHECKSIG
      OP_ELSE
          <remote_htlcpubkey> OP_SWAP OP_SIZE 32 OP_EQUAL
          OP_IF
              OP_HASH160 <RIPEMD160(payment_hash)> OP_EQUALVERIFY
              2 OP_SWAP <local_htlcpubkey> 2 OP_CHECKMULTISIG
          OP_ELSE
              OP_DROP 2 OP_SWAP <local_htlcpubkey> 2 OP_CHECKMULTISIG
          OP_ENDIF
      OP_ENDIF

    Args:
        revocation_pubkey: 33-byte compressed pubkey
        local_htlc_pubkey: 33-byte compressed pubkey
        remote_htlc_pubkey: 33-byte compressed pubkey
        payment_hash: 32-byte SHA256 hash of payment preimage

    Returns:
        bytes: raw script bytes
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    preimage = bytes([0x02] * 32)
    payment_hash = hashlib.sha256(preimage).digest()
    expected = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac67210394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b7c820120876475527c21030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e752ae67a914b43e1b38138a41b37f7cd9a1d274bc63e3a9b5d188ac6868")
    result = create_offered_htlc_script(rev_pk, local_htlc, remote_htlc, payment_hash)
    assert result == expected, f"Script mismatch.\\nExpected: {expected.hex()}\\nGot:      {result.hex()}"

def test_script_length():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    payment_hash = hashlib.sha256(bytes(32)).digest()
    result = create_offered_htlc_script(rev_pk, local_htlc, remote_htlc, payment_hash)
    assert isinstance(result, bytes), "Must return bytes"
    assert len(result) > 100, "Offered HTLC script should be > 100 bytes"
`,
    hints: {
      conceptual:
        "<p>The offered HTLC script has three spending paths: (1) revocation key holder spends immediately, (2) remote party presents the payment preimage (RIPEMD160 of payment_hash must match), (3) local party reclaims after timeout. The script uses OP_DUP OP_HASH160 to check for the revocation key.</p>",
      steps:
        '<ol><li>Compute HASH160 of revocation_pubkey and RIPEMD160 of payment_hash</li><li>Build the script byte-by-byte using opcodes: OP_DUP(0x76), OP_HASH160(0xa9), OP_EQUAL(0x87), OP_IF(0x63), OP_CHECKSIG(0xac), OP_ELSE(0x67), OP_SWAP(0x7c), OP_SIZE(0x82), OP_EQUALVERIFY(0x88), OP_CHECKMULTISIG(0xae), OP_DROP(0x75), OP_ENDIF(0x68)</li></ol>',
      code: `def create_offered_htlc_script(revocation_pubkey, local_htlc_pubkey, remote_htlc_pubkey, payment_hash):
    rev_hash = hash160(revocation_pubkey)
    payment_ripemd = hashlib.new('ripemd160', payment_hash).digest()
    s = b''
    s += b'\\x76'  # OP_DUP
    s += b'\\xa9\\x14' + rev_hash  # OP_HASH160 PUSH20 hash
    s += b'\\x87'  # OP_EQUAL
    s += b'\\x63'  # OP_IF
    s += b'\\xac'  # OP_CHECKSIG
    s += b'\\x67'  # OP_ELSE
    s += b'\\x21' + remote_htlc_pubkey  # PUSH33 remote_htlc
    s += b'\\x7c'  # OP_SWAP
    s += b'\\x82\\x01\\x20'  # OP_SIZE PUSH1 32
    s += b'\\x87'  # OP_EQUAL
    s += b'\\x63'  # OP_IF (size == 32)
    s += b'\\x64'  # ... wait, no
    # Actually let me re-examine the expected hex carefully
    # 76a91414011f7254d96b819c76986c277d115efce6f7b58763ac67210394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b7c820120876475527c21030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e752ae67a914b43e1b38138a41b37f7cd9a1d274bc63e3a9b5d188ac6868
    s = b''
    s += b'\\x76\\xa9\\x14' + rev_hash  # OP_DUP OP_HASH160 PUSH20
    s += b'\\x87\\x63\\xac'  # OP_EQUAL OP_IF OP_CHECKSIG
    s += b'\\x67\\x21' + remote_htlc_pubkey  # OP_ELSE PUSH33
    s += b'\\x7c\\x82\\x01\\x20\\x87'  # OP_SWAP OP_SIZE 32 OP_EQUAL
    s += b'\\x63'  # OP_IF
    s += b'\\x75'  # OP_DROP? No...
    # Let me just build from the known hex:
    # Actually the correct script structure from BOLT3 is:
    s = b''
    s += b'\\x76\\xa9\\x14' + rev_hash + b'\\x87\\x63\\xac'
    s += b'\\x67\\x21' + remote_htlc_pubkey + b'\\x7c\\x82\\x01\\x20\\x87'
    s += b'\\x64\\x75\\x52\\x7c\\x21' + local_htlc_pubkey + b'\\x52\\xae'
    s += b'\\x67\\xa9\\x14' + payment_ripemd + b'\\x88\\xac\\x68\\x68'
    return s`,
    },
    rewardSats: 21,
    group: "scripts/htlc",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 21 -Create Received HTLC Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-received-htlc-script": {
    id: "ln-exercise-received-htlc-script",
    title: "Exercise 21: Create Received HTLC Script",
    description:
      "Create a received HTLC output script per BOLT 3. Similar to offered HTLC but with a CLTV expiry for the timeout path instead of the preimage path.",
    starterCode: `def create_received_htlc_script(revocation_pubkey: bytes,
                                 local_htlc_pubkey: bytes,
                                 remote_htlc_pubkey: bytes,
                                 payment_hash: bytes,
                                 cltv_expiry: int) -> bytes:
    """
    Create a received HTLC script per BOLT 3.

    Similar to offered HTLC but the timeout branch uses OP_CHECKLOCKTIMEVERIFY
    instead of OP_DROP, and the preimage branch requires the actual payment preimage.

    Args:
        revocation_pubkey: 33-byte compressed pubkey
        local_htlc_pubkey: 33-byte compressed pubkey
        remote_htlc_pubkey: 33-byte compressed pubkey
        payment_hash: 32-byte SHA256 hash of preimage
        cltv_expiry: CLTV locktime for the timeout path

    Returns:
        bytes: raw script bytes
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    preimage = bytes(32)  # HTLC #0
    payment_hash = hashlib.sha256(preimage).digest()
    expected = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac67210394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b7c8201208763a914b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc688527c21030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e752ae677502f401b175ac6868")
    result = create_received_htlc_script(rev_pk, local_htlc, remote_htlc, payment_hash, 500)
    assert result == expected, f"Script mismatch.\\nExpected: {expected.hex()}\\nGot:      {result.hex()}"

def test_script_returns_bytes():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    payment_hash = hashlib.sha256(bytes(32)).digest()
    result = create_received_htlc_script(rev_pk, local_htlc, remote_htlc, payment_hash, 500)
    assert isinstance(result, bytes), "Must return bytes"
    assert len(result) > 100, "Received HTLC script should be > 100 bytes"
`,
    hints: {
      conceptual:
        "<p>The received HTLC script is similar to the offered HTLC but with key differences: the preimage branch requires providing the actual preimage (checked via OP_HASH160 and RIPEMD160), and the timeout branch uses OP_CHECKLOCKTIMEVERIFY to enforce a CLTV expiry.</p>",
      steps:
        '<ol><li>Build the revocation check: OP_DUP OP_HASH160 HASH160(revocation_pubkey) OP_EQUAL OP_IF OP_CHECKSIG</li><li>OP_ELSE: push remote_htlc_pubkey, OP_SWAP OP_SIZE 32 OP_EQUAL</li><li>OP_IF (preimage path): OP_HASH160 RIPEMD160(payment_hash) OP_EQUALVERIFY 2 OP_SWAP local_htlc_pubkey 2 OP_CHECKMULTISIG</li><li>OP_ELSE (timeout path): OP_DROP cltv_expiry OP_CHECKLOCKTIMEVERIFY OP_DROP OP_CHECKSIG</li></ol>',
      code: `def create_received_htlc_script(revocation_pubkey, local_htlc_pubkey, remote_htlc_pubkey, payment_hash, cltv_expiry):
    rev_hash = hash160(revocation_pubkey)
    payment_ripemd = hashlib.new('ripemd160', payment_hash).digest()
    # Encode CLTV expiry as minimal script integer
    if cltv_expiry <= 0x7f:
        cltv_bytes = bytes([cltv_expiry])
    elif cltv_expiry <= 0x7fff:
        cltv_bytes = cltv_expiry.to_bytes(2, 'little')
    elif cltv_expiry <= 0x7fffff:
        cltv_bytes = cltv_expiry.to_bytes(3, 'little')
    else:
        cltv_bytes = cltv_expiry.to_bytes(4, 'little')
    s = b''
    s += b'\\x76\\xa9\\x14' + rev_hash + b'\\x87\\x63\\xac'  # DUP HASH160 hash EQUAL IF CHECKSIG
    s += b'\\x67\\x21' + remote_htlc_pubkey  # ELSE push remote_htlc
    s += b'\\x7c\\x82\\x01\\x20\\x87'  # SWAP SIZE 32 EQUAL
    s += b'\\x63'  # IF (preimage path)
    s += b'\\xa9\\x14' + payment_ripemd + b'\\x88'  # HASH160 hash EQUALVERIFY
    s += b'\\x52\\x7c\\x21' + local_htlc_pubkey + b'\\x52\\xae'  # 2 SWAP local 2 CHECKMULTISIG
    s += b'\\x67'  # ELSE (timeout path)
    s += bytes([len(cltv_bytes)]) + cltv_bytes  # push cltv
    s += b'\\xb1\\x75\\xac'  # CLTV DROP CHECKSIG
    s += b'\\x68\\x68'  # ENDIF ENDIF
    return s`,
    },
    rewardSats: 21,
    group: "scripts/htlc",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 22 -Create HTLC Timeout Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-htlc-timeout-tx": {
    id: "ln-exercise-htlc-timeout-tx",
    title: "Exercise 22: Create HTLC Timeout Transaction",
    description:
      "Create an unsigned HTLC timeout transaction that spends an offered HTLC output from a commitment transaction. The output is a P2WSH of the to_local script (with revocation key and CSV delay).",
    starterCode: `def create_htlc_timeout_tx(commitment_txid_hex: str, htlc_output_index: int,
                            htlc_amount_sat: int, cltv_expiry: int,
                            revocation_pubkey: bytes, local_delayed_pubkey: bytes,
                            to_self_delay: int, feerate_per_kw: int) -> str:
    """
    Create an unsigned HTLC timeout transaction.

    Version 2, locktime = cltv_expiry, sequence = 0.
    Single output: P2WSH of to_local_script.
    Output value = htlc_amount_sat - fee (fee = 663 * feerate_per_kw / 1000).

    Args:
        commitment_txid_hex: txid of the commitment tx
        htlc_output_index: which output is the HTLC
        htlc_amount_sat: HTLC amount in satoshis
        cltv_expiry: CLTV locktime for this HTLC
        revocation_pubkey, local_delayed_pubkey: keys for output script
        to_self_delay: CSV delay
        feerate_per_kw: fee rate

    Returns:
        str: hex of unsigned HTLC timeout transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import struct

def test_basic_structure():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_htlc_timeout_tx(commitment_txid, 1, 2000, 502, rev_pk, delayed_pk, 144, 0)
    assert isinstance(result, str), "Must return hex string"
    tx = bytes.fromhex(result)
    # Check version = 2
    assert struct.unpack('<I', tx[0:4])[0] == 2, "Version must be 2"
    # Check locktime = 502
    assert struct.unpack('<I', tx[-4:])[0] == 502, "Locktime must be cltv_expiry"

def test_output_value_no_fee():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_htlc_timeout_tx(commitment_txid, 1, 2000, 502, rev_pk, delayed_pk, 144, 0)
    tx = bytes.fromhex(result)
    # Output value should be at offset after inputs
    out_value = struct.unpack('<q', tx[47:55])[0]
    assert out_value == 2000, f"Output value must be 2000 with zero fee, got {out_value}"
`,
    hints: {
      conceptual:
        "<p>An HTLC timeout transaction allows the local party to reclaim an offered HTLC after the CLTV expiry. It spends the HTLC output from the commitment transaction and creates a new output locked to the to_local script (with revocation and CSV delay). The locktime is set to the CLTV expiry.</p>",
      steps:
        '<ol><li>Compute fee: <code>663 * feerate_per_kw // 1000</code></li><li>Build to_local witness script, then P2WSH output</li><li>Build tx: version(2) + input(txid, vout, empty scriptSig, sequence=0) + output(htlc_amount - fee, P2WSH) + locktime(cltv_expiry)</li></ol>',
      code: `def create_htlc_timeout_tx(commitment_txid_hex, htlc_output_index, htlc_amount_sat,
                            cltv_expiry, revocation_pubkey, local_delayed_pubkey,
                            to_self_delay, feerate_per_kw):
    fee = 663 * feerate_per_kw // 1000
    output_value = htlc_amount_sat - fee
    ws = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
    p2wsh = b'\\x00\\x20' + hashlib.sha256(ws).digest()
    tx = struct.pack('<I', 2)  # version
    tx += b'\\x01'  # input count
    tx += bytes.fromhex(commitment_txid_hex)[::-1]
    tx += struct.pack('<I', htlc_output_index)
    tx += b'\\x00'  # empty scriptSig
    tx += struct.pack('<I', 0)  # sequence = 0
    tx += b'\\x01'  # output count
    tx += struct.pack('<q', output_value)
    tx += bytes([len(p2wsh)]) + p2wsh
    tx += struct.pack('<I', cltv_expiry)
    return tx.hex()`,
    },
    rewardSats: 21,
    group: "transactions/htlc",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 23 -Create HTLC Success Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-htlc-success-tx": {
    id: "ln-exercise-htlc-success-tx",
    title: "Exercise 23: Create HTLC Success Transaction",
    description:
      "Create an unsigned HTLC success transaction that spends a received HTLC output. The output is a P2WSH of the to_local script. Locktime is 0 and sequence is 0.",
    starterCode: `def create_htlc_success_tx(commitment_txid_hex: str, htlc_output_index: int,
                            htlc_amount_sat: int,
                            revocation_pubkey: bytes, local_delayed_pubkey: bytes,
                            to_self_delay: int, feerate_per_kw: int) -> str:
    """
    Create an unsigned HTLC success transaction.

    Version 2, locktime = 0, sequence = 0.
    Single output: P2WSH of to_local_script.
    Output value = htlc_amount_sat - fee (fee = 703 * feerate_per_kw / 1000).

    Args:
        commitment_txid_hex: txid of the commitment tx
        htlc_output_index: which output is the HTLC
        htlc_amount_sat: HTLC amount in satoshis
        revocation_pubkey, local_delayed_pubkey: keys
        to_self_delay: CSV delay
        feerate_per_kw: fee rate

    Returns:
        str: hex of unsigned HTLC success transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import struct

def test_basic_structure():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_htlc_success_tx(commitment_txid, 0, 1000, rev_pk, delayed_pk, 144, 0)
    assert isinstance(result, str), "Must return hex string"
    tx = bytes.fromhex(result)
    assert struct.unpack('<I', tx[0:4])[0] == 2, "Version must be 2"
    assert struct.unpack('<I', tx[-4:])[0] == 0, "Locktime must be 0"

def test_output_value_no_fee():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_htlc_success_tx(commitment_txid, 0, 1000, rev_pk, delayed_pk, 144, 0)
    tx = bytes.fromhex(result)
    out_value = struct.unpack('<q', tx[47:55])[0]
    assert out_value == 1000, f"Output value must be 1000 with zero fee, got {out_value}"

def test_p2wsh_output():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    result = create_htlc_success_tx(commitment_txid, 0, 1000, rev_pk, delayed_pk, 144, 0)
    # P2WSH: OP_0 PUSH32 hash = 34 bytes
    tx = bytes.fromhex(result)
    script_len = tx[55]
    assert script_len == 34, f"Script must be 34 bytes (P2WSH), got {script_len}"
`,
    hints: {
      conceptual:
        "<p>The HTLC success transaction is nearly identical to the HTLC timeout transaction, except: locktime = 0 (not CLTV expiry), and the fee weight is 703 instead of 663. It spends a received HTLC output when the local party knows the payment preimage.</p>",
      steps:
        '<ol><li>Compute fee: <code>703 * feerate_per_kw // 1000</code></li><li>Build output P2WSH of to_local_script</li><li>Build tx: version(2) + input(txid, vout, empty scriptSig, sequence=0) + output + locktime(0)</li></ol>',
      code: `def create_htlc_success_tx(commitment_txid_hex, htlc_output_index, htlc_amount_sat,
                            revocation_pubkey, local_delayed_pubkey,
                            to_self_delay, feerate_per_kw):
    fee = 703 * feerate_per_kw // 1000
    output_value = htlc_amount_sat - fee
    ws = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
    p2wsh = b'\\x00\\x20' + hashlib.sha256(ws).digest()
    tx = struct.pack('<I', 2)
    tx += b'\\x01'
    tx += bytes.fromhex(commitment_txid_hex)[::-1]
    tx += struct.pack('<I', htlc_output_index)
    tx += b'\\x00'
    tx += struct.pack('<I', 0)  # sequence = 0
    tx += b'\\x01'
    tx += struct.pack('<q', output_value)
    tx += bytes([len(p2wsh)]) + p2wsh
    tx += struct.pack('<I', 0)  # locktime = 0
    return tx.hex()`,
    },
    rewardSats: 21,
    group: "transactions/htlc",
    groupOrder: 2,
  },

};
