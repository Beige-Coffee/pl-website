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
  // EXERCISE 1 - ChannelKeyManager.__init__
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-channel-key-manager": {
    id: "ln-exercise-channel-key-manager",
    title: "Exercise 1: ChannelKeyManager.__init__",
    description:
      "Implement the <code>ChannelKeyManager</code> constructor. Create a <code>BIP32</code> wallet from the seed, then derive all 6 channel secrets at paths <code>m/1017h/0h/{family}h/0/{channel_index}</code> and compute 5 public basepoints (all except <code>commitment_seed</code>). Store each value as a <code>self.*</code> instance attribute using the exact names listed in the docstring.",
    starterCode: `    def __init__(self, seed: bytes, channel_index: int = 0):
        """
        Derive all 6 channel secrets and their public basepoints from a seed.

        Create a BIP32 wallet from the seed, then derive each key family
        at path m/1017h/0h/{family}h/0/{channel_index}.

        For each secret (except commitment_seed), compute the public key
        using privkey_to_pubkey(). You MUST use these exact attribute names:

        Family 0 - self.funding_key, self.funding_pubkey
        Family 1 - self.revocation_basepoint_secret, self.revocation_basepoint
        Family 2 - self.htlc_basepoint_secret, self.htlc_basepoint
        Family 3 - self.payment_basepoint_secret, self.payment_basepoint
        Family 4 - self.delayed_payment_basepoint_secret, self.delayed_payment_basepoint
        Family 5 - self.commitment_seed (no pubkey)
        """
        # === YOUR CODE HERE ===
        pass
`,
    testCode: `
def _ref_p2p(secret):
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    pt = vk.pubkey.point
    prefix = b'\\x02' if pt.y() % 2 == 0 else b'\\x03'
    return prefix + pt.x().to_bytes(32, 'big')

def test_creates_all_fields():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    for attr in ['funding_key', 'funding_pubkey', 'revocation_basepoint_secret',
                 'revocation_basepoint', 'htlc_basepoint_secret', 'htlc_basepoint',
                 'payment_basepoint_secret', 'payment_basepoint',
                 'delayed_payment_basepoint_secret', 'delayed_payment_basepoint',
                 'commitment_seed']:
        assert hasattr(km, attr), f"Missing {attr}"

def test_key_sizes():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    assert len(km.funding_key) == 32, "funding_key must be 32 bytes"
    assert len(km.funding_pubkey) == 33, "funding_pubkey must be 33 bytes"
    assert len(km.commitment_seed) == 32, "commitment_seed must be 32 bytes"

def test_pubkey_matches_privkey():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    assert km.funding_pubkey == _ref_p2p(km.funding_key), "funding_pubkey must match funding_key"
    assert km.revocation_basepoint == _ref_p2p(km.revocation_basepoint_secret), "revocation_basepoint mismatch"
    assert km.htlc_basepoint == _ref_p2p(km.htlc_basepoint_secret), "htlc_basepoint mismatch"

def test_different_families_different_keys():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    keys = [km.funding_key, km.revocation_basepoint_secret, km.htlc_basepoint_secret,
            km.payment_basepoint_secret, km.delayed_payment_basepoint_secret, km.commitment_seed]
    assert len(set(keys)) == 6, "All key families must produce different keys"

def test_different_channel_index():
    seed = bytes([0x01] * 32)
    km0 = ChannelKeyManager(seed, 0)
    km1 = ChannelKeyManager(seed, 1)
    assert km0.funding_key != km1.funding_key, "Different channel indices must produce different keys"
`,
    hints: {
      conceptual:
        "<p>Your goal is to initialize a key manager that derives all 6 Lightning channel key families from a single seed using hierarchical deterministic key derivation. Use the <code>BIP32</code> class (specifically <code>BIP32.from_seed()</code> and <code>get_privkey_from_path()</code>) to derive private keys at the BOLT 3 path <code>m/1017h/0h/{family}h/0/{channel_index}</code>, where family ranges from 0 to 5. For families 0-4, also compute the compressed public key using <code>privkey_to_pubkey()</code>. Family 5 (commitment_seed) has no public key.</p>",
      steps:
        '<ol><li>Create a <code>BIP32</code> HD wallet from the <code>seed</code> parameter using its <code>from_seed()</code> class method</li><li>For each key family (0 through 5), derive the private key using <code>get_privkey_from_path()</code> with the path format shown in the docstring. Use an f-string to interpolate the family number and <code>channel_index</code> parameter</li><li>Store each derived key as a <code>self.*</code> attribute matching the exact names in the docstring (e.g., family 0 becomes <code>self.funding_key</code>)</li><li>For families 0-4, compute the corresponding public key with <code>privkey_to_pubkey()</code> and store it (e.g., <code>self.funding_pubkey</code>)</li><li>Family 5 is special: store it as <code>self.commitment_seed</code> with no public key computation</li></ol>',
      code: `    def __init__(self, seed, channel_index=0):
        bip32 = BIP32.from_seed(seed)
        self.funding_key = bip32.get_privkey_from_path(f"m/1017h/0h/0h/0/{channel_index}")
        self.funding_pubkey = privkey_to_pubkey(self.funding_key)
        self.revocation_basepoint_secret = bip32.get_privkey_from_path(f"m/1017h/0h/1h/0/{channel_index}")
        self.revocation_basepoint = privkey_to_pubkey(self.revocation_basepoint_secret)
        self.htlc_basepoint_secret = bip32.get_privkey_from_path(f"m/1017h/0h/2h/0/{channel_index}")
        self.htlc_basepoint = privkey_to_pubkey(self.htlc_basepoint_secret)
        self.payment_basepoint_secret = bip32.get_privkey_from_path(f"m/1017h/0h/3h/0/{channel_index}")
        self.payment_basepoint = privkey_to_pubkey(self.payment_basepoint_secret)
        self.delayed_payment_basepoint_secret = bip32.get_privkey_from_path(f"m/1017h/0h/4h/0/{channel_index}")
        self.delayed_payment_basepoint = privkey_to_pubkey(self.delayed_payment_basepoint_secret)
        self.commitment_seed = bip32.get_privkey_from_path(f"m/1017h/0h/5h/0/{channel_index}")`,
    },
    rewardSats: 21,
    group: "keys/channel_key_manager",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 3 -Create Funding Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-funding-script": {
    id: "ln-exercise-funding-script",
    title: "Exercise 3: Create Funding Script",
    description:
      "Create a 2-of-2 multisig funding script for a Lightning channel. The two public keys must be sorted lexicographically (as raw bytes) before being placed in the script, as required by BOLT 3. The script format is: <code>OP_2 &lt;key1&gt; &lt;key2&gt; OP_2 OP_CHECKMULTISIG</code>.",
    starterCode: `def create_funding_script(pubkey1: bytes, pubkey2: bytes) -> CScript:
    """
    Create a 2-of-2 multisig script for Lightning channel funding.

    The script format is:
        OP_2 <pubkey_smaller> <pubkey_larger> OP_2 OP_CHECKMULTISIG

    Keys must be sorted lexicographically (as bytes).

    Use CScript to build the script with named opcodes:
        CScript([OP_2, key1, key2, OP_2, OP_CHECKMULTISIG])

    Args:
        pubkey1: 33-byte compressed public key
        pubkey2: 33-byte compressed public key

    Returns:
        CScript: The funding script
    """
    # === YOUR CODE HERE ===
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
        "<p>Your goal is to produce a 2-of-2 multisig Bitcoin script that locks the Lightning channel funding output. BOLT 3 requires the two public keys to be sorted lexicographically (by raw byte value) before placement. Use Python's <code>sorted()</code> to order the keys, then build the script with <code>CScript</code>, which accepts a list of opcodes (<code>OP_2</code>, <code>OP_CHECKMULTISIG</code>) and byte strings (the keys). CScript handles push-data encoding automatically.</p>",
      steps:
        '<ol><li>Sort the two pubkey parameters into lexicographic (byte) order. Python compares <code>bytes</code> objects lexicographically by default, so <code>sorted()</code> works directly on a list of the two keys</li><li>Construct a <code>CScript</code> by passing a list with the 2-of-2 multisig structure: the threshold opcode, both sorted keys, the threshold opcode again, and the checkmultisig opcode</li><li>Return the resulting CScript object</li></ol>',
      code: `def create_funding_script(pubkey1, pubkey2):
    keys = sorted([pubkey1, pubkey2])
    return CScript([OP_2, keys[0], keys[1], OP_2, OP_CHECKMULTISIG])`,
    },
    rewardSats: 21,
    group: "scripts/funding",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 4 -Create Funding Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-funding-tx": {
    id: "ln-exercise-funding-tx",
    title: "Exercise 4: Create Funding Transaction",
    description:
      "Build a funding transaction that spends from a given UTXO and creates a P2WSH output using the 2-of-2 multisig funding script. The output script is <code>OP_0 &lt;SHA256(funding_script)&gt;</code>.",
    starterCode: `def create_funding_tx(input_txid_hex: str, input_vout: int,
                      funding_amount: int,
                      pubkey1: bytes, pubkey2: bytes) -> str:
    """
    Create a funding transaction (unsigned, no witness).

    Uses CMutableTransaction to build a version 2 transaction with:
    - One input spending the given UTXO (sequence 0xffffffff)
    - One P2WSH output: CScript([OP_0, SHA256(funding_script)])
    - nVersion = 2 (required for BIP 68 relative timelocks)

    Use these python-bitcoinlib types:
    - CTxIn(COutPoint(lx(txid_hex), vout)) for the input
    - CTxOut(amount, script) for the output
    - CMutableTransaction([inputs], [outputs]) for the transaction

    lx() converts a hex string to bytes in internal (little-endian) order.

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
    tx_bytes = bytes.fromhex(result)
    import struct
    version = struct.unpack_from("<I", tx_bytes, 0)[0]
    assert version == 2, f"Transaction version must be 2, got {version}"
    reversed_txid = bytes.fromhex(input_txid)[::-1]
    assert reversed_txid.hex() in result, "Input must reference the correct txid"
    amount_bytes = struct.pack("<q", 500000)
    assert amount_bytes.hex() in result, f"Output must contain 500000 sats"
    locktime = struct.unpack_from("<I", tx_bytes, len(tx_bytes) - 4)[0]
    assert locktime == 0, f"Locktime must be 0, got {locktime}"

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
        "<p>Your goal is to build a Bitcoin transaction with one input (the given UTXO) and one P2WSH output that locks funds into the 2-of-2 multisig. A P2WSH scriptPubKey is <code>OP_0</code> followed by the SHA256 hash of the witness script. Use <code>create_funding_script()</code> to get the witness script, <code>hashlib.sha256</code> to hash it, and python-bitcoinlib's transaction types (<code>CMutableTransaction</code>, <code>CTxIn</code>, <code>CTxOut</code>, <code>COutPoint</code>) to assemble the transaction. The <code>lx()</code> helper converts a hex txid string to little-endian byte order. Set the transaction version to 2.</p>",
      steps:
        '<ol><li>Call <code>create_funding_script()</code> with both pubkeys to get the multisig witness script, then compute its SHA256 hash using <code>hashlib.sha256</code></li><li>Build a P2WSH scriptPubKey using <code>CScript</code> with <code>OP_0</code> and the 32-byte script hash</li><li>Create a transaction input using <code>CTxIn</code>. It takes a <code>COutPoint</code>, which wraps the txid (converted from hex to internal byte order with <code>lx()</code>) and the output index</li><li>Create a transaction output using <code>CTxOut</code>, which takes the satoshi amount and the P2WSH scriptPubKey</li><li>Assemble a <code>CMutableTransaction</code> with the input list and output list, and set <code>nVersion = 2</code></li><li>Serialize the transaction and return the hex string</li></ol>',
      code: `def create_funding_tx(input_txid_hex, input_vout, funding_amount, pubkey1, pubkey2):
    funding_script = create_funding_script(pubkey1, pubkey2)
    script_hash = hashlib.sha256(bytes(funding_script)).digest()
    p2wsh_script = CScript([OP_0, script_hash])

    txin = CTxIn(COutPoint(lx(input_txid_hex), input_vout))
    txout = CTxOut(funding_amount, p2wsh_script)
    tx = CMutableTransaction([txin], [txout])
    tx.nVersion = 2
    return tx.serialize().hex()`,
    },
    rewardSats: 21,
    group: "transactions/funding",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 4 - ChannelKeyManager.sign_input
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-sign-input": {
    id: "ln-exercise-sign-input",
    title: "Exercise 4: Sign a Transaction Input",
    description:
      "Implement <code>ChannelKeyManager.sign_input()</code> to sign a transaction input using BIP143 (segwit v0) signature hashing. Use <code>SignatureHash()</code> to compute the sighash, then sign with ECDSA and append <code>SIGHASH_ALL</code>. This method will be reused for commitment transactions and HTLC transactions.",
    starterCode: `    def sign_input(self, tx_bytes: bytes, input_index: int,
                   script: bytes, amount: int,
                   secret_key: bytes) -> bytes:
        """
        Sign a transaction input (BIP143 segwit v0).

        Steps:
        1. Deserialize tx_bytes into a CTransaction
        2. Compute sighash using SignatureHash() with SIGVERSION_WITNESS_V0
        3. Sign with ECDSA using the secret_key (DER encoding)
        4. Append SIGHASH_ALL byte (0x01)

        Use sigencode_der_canonize for canonical (low-S) signatures.

        Args:
            tx_bytes: raw transaction bytes
            input_index: which input to sign
            script: the witness script (e.g. funding script)
            amount: satoshi value of the input being spent
            secret_key: 32-byte private key to sign with

        Returns:
            bytes: DER-encoded signature + SIGHASH_ALL byte
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

def test_sign_returns_bytes():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    privkey = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    result = km.sign_input(bytes.fromhex(tx_hex), 0, CScript(funding_script), 500000, privkey)
    assert isinstance(result, bytes), "Must return bytes"
    assert result[-1] == 0x01, "Last byte must be SIGHASH_ALL (0x01)"

def test_signature_valid():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    privkey = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    sig_with_type = km.sign_input(bytes.fromhex(tx_hex), 0, CScript(funding_script), 500000, privkey)
    der_sig = sig_with_type[:-1]
    sk = SigningKey.from_string(privkey, curve=SECP256k1)
    vk = sk.get_verifying_key()
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

def test_sign_with_funding_key():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    pk1 = bytes.fromhex("023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb")
    pk2 = bytes.fromhex("030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c1")
    funding_script = b'\\x52' + b'\\x21' + min(pk1, pk2) + b'\\x21' + max(pk1, pk2) + b'\\x52' + b'\\xae'
    tx_hex = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a4884890000000000ffffffff0120a1070000000000220020313220af947477a37bcbbf3bb5def854df44e93f8aaad1831ea13a7db215406a00000000"
    result = km.sign_input(bytes.fromhex(tx_hex), 0, CScript(funding_script), 500000, km.funding_key)
    assert isinstance(result, bytes), "Must return bytes when signing with km.funding_key"
    assert len(result) > 64, "DER signature should be > 64 bytes"
`,
    hints: {
      conceptual:
        "<p>Your goal is to produce a BIP143 segwit v0 signature for a transaction input. First deserialize the raw transaction bytes with <code>CTransaction.deserialize()</code>. Then use python-bitcoinlib's <code>SignatureHash()</code> to compute the sighash digest, passing <code>SIGHASH_ALL</code>, the input amount, and <code>SIGVERSION_WITNESS_V0</code>. Sign the digest with the <code>ecdsa</code> library's <code>SigningKey</code> class using <code>sigencode_der_canonize</code> for canonical low-S DER encoding. Finally, append the <code>SIGHASH_ALL</code> byte to the signature.</p>",
      steps:
        '<ol><li>Deserialize the raw transaction bytes into a <code>CTransaction</code> object using its <code>deserialize()</code> class method</li><li>Compute the sighash digest using <code>SignatureHash()</code>. This function needs the witness script, the deserialized transaction, the input index, the hash type (<code>SIGHASH_ALL</code>), the input amount, and the sigversion (<code>SIGVERSION_WITNESS_V0</code>)</li><li>Create a <code>SigningKey</code> from the 32-byte <code>secret_key</code> using the <code>from_string()</code> class method with <code>SECP256k1</code> as the curve</li><li>Sign the sighash digest using <code>sign_digest()</code> on the signing key, passing <code>sigencode_der_canonize</code> as the encoding function to ensure canonical (low-S) signatures</li><li>Append the <code>SIGHASH_ALL</code> byte to the DER signature using <code>bytes([SIGHASH_ALL])</code> and return the combined result. Note: <code>bytes([value])</code> creates a single byte with that value, while <code>bytes(value)</code> creates that many zero bytes</li></ol>',
      code: `    def sign_input(self, tx_bytes, input_index, script, amount, secret_key):
        tx = CTransaction.deserialize(tx_bytes)
        sighash = SignatureHash(script, tx, input_index, SIGHASH_ALL,
                                amount=amount, sigversion=SIGVERSION_WITNESS_V0)
        sk = SigningKey.from_string(secret_key, curve=SECP256k1)
        sig = sk.sign_digest(sighash, sigencode=sigencode_der_canonize)
        return sig + bytes([SIGHASH_ALL])`,
    },
    rewardSats: 21,
    group: "keys/channel_key_manager",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 6 -Derive Revocation Public Key
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-revocation-pubkey": {
    id: "ln-exercise-revocation-pubkey",
    title: "Exercise 6: Derive Revocation Public Key",
    description:
      "Derive a revocation public key from a revocation basepoint and a per-commitment point. The formula is: <code>revocation_pubkey = revocation_basepoint * SHA256(revocation_basepoint || per_commitment_point) + per_commitment_point * SHA256(per_commitment_point || revocation_basepoint)</code>.",
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
        "<p>Your goal is to derive a revocation public key using the BOLT 3 formula, which combines two elliptic curve points with SHA256-derived scalar factors. The formula is: <code>R * SHA256(R || P) + P * SHA256(P || R)</code>, where R is the revocation basepoint and P is the per-commitment point. You will need <code>hashlib.sha256</code> for hashing, <code>decompress_pubkey()</code> to convert 33-byte compressed keys to elliptic curve <code>Point</code> objects, elliptic curve scalar multiplication (<code>*</code>) and point addition (<code>+</code>), and <code>compress_point()</code> to convert the result back. The hash results must be reduced modulo the curve order (<code>ORDER</code>).</p>",
      steps:
        '<ol><li>Compute the first scalar factor by SHA256-hashing the revocation basepoint concatenated with the per-commitment point, then converting the digest to an integer (big-endian) modulo <code>ORDER</code></li><li>Compute the second scalar factor the same way but with the concatenation order reversed: per-commitment point first, then revocation basepoint</li><li>Decompress both input public keys into elliptic curve <code>Point</code> objects using <code>decompress_pubkey()</code></li><li>Multiply each point by its corresponding factor, then add the two resulting points together using standard elliptic curve arithmetic</li><li>Compress the resulting point back to 33 bytes with <code>compress_point()</code> and return it</li></ol>',
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
  // EXERCISE 7 -Derive Revocation Private Key
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-revocation-privkey": {
    id: "ln-exercise-revocation-privkey",
    title: "Exercise 7: Derive Revocation Private Key",
    description:
      "Derive the revocation private key from the revocation basepoint secret and the per-commitment secret. The formula mirrors the public key derivation: <code>revocation_privkey = revocation_basepoint_secret * SHA256(revocation_basepoint || per_commitment_point) + per_commitment_secret * SHA256(per_commitment_point || revocation_basepoint)</code>, all mod n.",
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
        "<p>Your goal is to derive the revocation private key, which is the scalar (private key) counterpart to the revocation public key. The formula mirrors the public key version but uses scalar multiplication and addition instead of point operations: <code>rev_secret * SHA256(rev_pub || per_pub) + per_secret * SHA256(per_pub || rev_pub)</code>, all modulo the curve order. Since the inputs are private keys (not public keys), you must first compute the corresponding public keys using <code>privkey_to_pubkey()</code> to use in the SHA256 hashes. Use <code>int.from_bytes()</code> for integer conversion and <code>ORDER</code> for the modular arithmetic.</p>",
      steps:
        '<ol><li>Compute the public key for each private key input using <code>privkey_to_pubkey()</code>, since the SHA256 factors use the public key representations</li><li>Compute the two SHA256 factors using the same concatenation order as the public key version: first hash the revocation public key concatenated with the per-commitment public key, then hash the reverse. Convert each digest to a big-endian integer modulo <code>ORDER</code></li><li>Convert both private key inputs to integers (big-endian)</li><li>Multiply each private key integer by its corresponding factor, add the products, and take the result modulo <code>ORDER</code></li><li>Convert the resulting integer back to 32 bytes (big-endian) and return it</li></ol>',
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
  // EXERCISE 7 - ChannelKeyManager.build_commitment_secret
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-secret": {
    id: "ln-exercise-commitment-secret",
    title: "Exercise 7: Build Commitment Secret",
    description:
      "Implement <code>ChannelKeyManager.build_commitment_secret()</code> using the shachain algorithm. For each of the 48 bits (from bit 47 down to bit 0), if the bit at position <code>i</code> in the commitment number is set, flip bit <code>i</code> in <code>self.commitment_seed</code> and hash with SHA256.",
    starterCode: `    def build_commitment_secret(self, commitment_number: int) -> bytes:
        """
        Derive a per-commitment secret using the shachain algorithm (BOLT 3).

        Uses self.commitment_seed as the starting seed.

        For each bit position i from 47 down to 0:
            If bit i of commitment_number is set (1):
                - Flip bit i of the current value
                - Hash the result with SHA256

        Args:
            commitment_number: commitment index (0 to 2^48-1)

        Returns:
            bytes: 32-byte commitment secret
        """
        # === YOUR CODE HERE ===
        pass
`,
    testCode: `
import hashlib

def test_bolt3_vector():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    # Override commitment_seed with all-zeros for BOLT3 test vector
    km.commitment_seed = bytes(32)
    index = 281474976710655  # 2^48 - 1
    expected = bytes.fromhex("02a40c85b6f28da08dfdbe0926c53fab2de6d28c10301f8f7c4073d5e42e3148")
    result = km.build_commitment_secret(index)
    assert result == expected, f"Expected {expected.hex()}, got {result.hex()}"

def test_different_indices():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    r1 = km.build_commitment_secret(0)
    r2 = km.build_commitment_secret(1)
    assert r1 != r2, "Different indices must produce different secrets"

def test_index_zero():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    km.commitment_seed = bytes(32)
    result = km.build_commitment_secret(0)
    assert len(result) == 32, "Must return 32 bytes"
    assert result == bytes(32), "Index 0 with no bits set should return seed unchanged"

def test_deterministic():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    r1 = km.build_commitment_secret(42)
    r2 = km.build_commitment_secret(42)
    assert r1 == r2, "Same inputs must produce same output"
`,
    hints: {
      conceptual:
        "<p>Your goal is to implement the shachain algorithm (BOLT 3), which derives per-commitment secrets from <code>self.commitment_seed</code>. The algorithm iterates through 48 bit positions (47 down to 0). For each position where the corresponding bit in the commitment number is set, it flips that bit in the working seed value and then hashes the result with <code>hashlib.sha256</code>. Use a <code>bytearray</code> for the mutable working copy. Bit manipulation uses integer division and modulo to map bit position <code>i</code> to a byte index and bit within that byte.</p>",
      steps:
        '<ol><li>Make a mutable copy of <code>self.commitment_seed</code> as a <code>bytearray</code></li><li>Loop through bit positions from 47 down to 0 (inclusive). For each position <code>i</code>, check whether that bit is set in the commitment number using a right-shift and bitwise AND</li><li>If the bit is set, flip bit <code>i</code> in the seed. The byte index is <code>i // 8</code> and the bit within that byte is <code>i % 8</code>. XOR the byte with a mask that has only that bit set</li><li>Immediately after flipping, hash the entire seed with SHA256 and replace the seed with the new digest (as a <code>bytearray</code> so you can continue mutating it)</li><li>After processing all 48 bits, convert the result to immutable <code>bytes</code> and return it</li></ol>',
      code: `    def build_commitment_secret(self, commitment_number):
        seed = bytearray(self.commitment_seed)
        for i in range(47, -1, -1):
            byte_index = i // 8
            bit_index = i % 8
            if (commitment_number >> i) & 1:
                seed[byte_index] ^= (1 << bit_index)
                seed = bytearray(hashlib.sha256(bytes(seed)).digest())
        return bytes(seed)`,
    },
    rewardSats: 21,
    group: "keys/channel_key_manager",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 8 - ChannelKeyManager.derive_per_commitment_point
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-per-commitment-point": {
    id: "ln-exercise-per-commitment-point",
    title: "Exercise 8: Derive Per-Commitment Point",
    description:
      "Implement <code>ChannelKeyManager.derive_per_commitment_point()</code>. The per-commitment point is the compressed public key corresponding to the per-commitment secret. Use <code>self.build_commitment_secret()</code> to get the secret, then convert it to a public key.",
    starterCode: `    def derive_per_commitment_point(self, commitment_number: int) -> bytes:
        """
        Derive the per-commitment point for a given commitment number.

        The per-commitment point is the compressed public key of the
        per-commitment secret derived from self.build_commitment_secret().

        Args:
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

def _build_secret_ref(seed, index):
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
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    result = km.derive_per_commitment_point(281474976710655)
    assert len(result) == 33, f"Must be 33 bytes, got {len(result)}"
    assert result[0] in (2, 3), "Must start with 0x02 or 0x03"

def test_matches_secret_pubkey():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    idx = 281474976710655
    secret = _build_secret_ref(km.commitment_seed, idx)
    expected = _p2p(secret)
    result = km.derive_per_commitment_point(idx)
    assert result == expected, "Must equal pubkey of commitment secret"

def test_different_commitments():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    p1 = km.derive_per_commitment_point(0)
    p2 = km.derive_per_commitment_point(1)
    assert p1 != p2, "Different commitment numbers must produce different points"
`,
    hints: {
      conceptual:
        "<p>Your goal is to derive the per-commitment point (a public key) for a given commitment number. This is a two-step process: first, use <code>self.build_commitment_secret()</code> to get the 32-byte per-commitment secret, then convert that secret to a compressed public key using <code>privkey_to_pubkey()</code>. The per-commitment point is used extensively in key derivation for commitment transactions.</p>",
      steps:
        '<ol><li>Call <code>self.build_commitment_secret()</code> with the commitment number to get the 32-byte per-commitment secret</li><li>Convert the secret to a 33-byte compressed public key using <code>privkey_to_pubkey()</code> and return the result</li></ol>',
      code: `    def derive_per_commitment_point(self, commitment_number):
        secret = self.build_commitment_secret(commitment_number)
        return privkey_to_pubkey(secret)`,
    },
    rewardSats: 21,
    group: "keys/channel_key_manager",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 9b - Get Commitment Keys
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-get-commitment-keys": {
    id: "ln-exercise-get-commitment-keys",
    title: "Get Commitment Keys",
    description:
      "Derive all per-commitment keys for a given commitment number, assembling them into a CommitmentKeys object.",
    starterCode: `    def get_commitment_keys(self, commitment_number, remote_revocation_basepoint, remote_htlc_basepoint):
        """
        Derive all 5 per-commitment keys needed for a commitment transaction.

        Args:
            commitment_number: The commitment state number
            remote_revocation_basepoint: The remote party's revocation basepoint (33-byte pubkey)
            remote_htlc_basepoint: The remote party's HTLC basepoint (33-byte pubkey)

        Steps:
        1. Derive the per-commitment point from commitment_number using self.derive_per_commitment_point()
        2. Derive revocation_key using derive_revocation_pubkey(remote_revocation_basepoint, per_commitment_point)
        3. Derive local_delayed_payment_key using derive_pubkey(self.delayed_payment_basepoint, per_commitment_point)
        4. Derive local_htlc_key using derive_pubkey(self.htlc_basepoint, per_commitment_point)
        5. Derive remote_htlc_key using derive_pubkey(remote_htlc_basepoint, per_commitment_point)

        Returns:
            CommitmentKeys object with all 5 derived keys
        """
        # === YOUR CODE HERE ===
        pass`,
    testCode: `
def test_get_commitment_keys():
    seed = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    km = ChannelKeyManager(seed, channel_index=0)

    # Use a known remote party's basepoints
    remote_seed = bytes.fromhex("1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100")
    remote_km = ChannelKeyManager(remote_seed, channel_index=0)

    commitment_number = 0
    keys = km.get_commitment_keys(
        commitment_number,
        remote_km.revocation_basepoint,
        remote_km.htlc_basepoint
    )

    # Verify it returns a CommitmentKeys object
    assert isinstance(keys, CommitmentKeys), "Must return a CommitmentKeys object"

    # Verify per_commitment_point matches
    expected_pcp = km.derive_per_commitment_point(commitment_number)
    assert keys.per_commitment_point == expected_pcp, "per_commitment_point doesn't match"

    # Verify revocation key
    expected_rev = derive_revocation_pubkey(remote_km.revocation_basepoint, expected_pcp)
    assert keys.revocation_key == expected_rev, "revocation_key doesn't match"

    # Verify local delayed payment key
    expected_ldp = derive_pubkey(km.delayed_payment_basepoint, expected_pcp)
    assert keys.local_delayed_payment_key == expected_ldp, "local_delayed_payment_key doesn't match"

    # Verify local HTLC key
    expected_lhtlc = derive_pubkey(km.htlc_basepoint, expected_pcp)
    assert keys.local_htlc_key == expected_lhtlc, "local_htlc_key doesn't match"

    # Verify remote HTLC key
    expected_rhtlc = derive_pubkey(remote_km.htlc_basepoint, expected_pcp)
    assert keys.remote_htlc_key == expected_rhtlc, "remote_htlc_key doesn't match"

    # Test with different commitment number
    keys2 = km.get_commitment_keys(42, remote_km.revocation_basepoint, remote_km.htlc_basepoint)
    assert keys2.per_commitment_point != keys.per_commitment_point, "Different commitment numbers should produce different keys"
    assert isinstance(keys2, CommitmentKeys), "Must return a CommitmentKeys object"

    print("All tests passed!")

test_get_commitment_keys()`,
    hints: {
      conceptual:
        "<p>Your goal is to derive all 5 per-commitment keys needed for a commitment transaction and package them in a <code>CommitmentKeys</code> object. Start by deriving the per-commitment point with <code>self.derive_per_commitment_point()</code>. Then use <code>derive_revocation_pubkey()</code> for the revocation key (which takes the remote party's revocation basepoint) and <code>derive_pubkey()</code> for the other three keys (local delayed payment, local HTLC, remote HTLC), each combining a basepoint with the per-commitment point. The local basepoints come from <code>self</code>, while the remote basepoints come from the function parameters.</p>",
      steps:
        '<ol><li>Derive the per-commitment point for the given commitment number using the method you built earlier</li><li>Derive the revocation key using <code>derive_revocation_pubkey()</code> with the remote revocation basepoint and the per-commitment point</li><li>Derive the local delayed payment key using <code>derive_pubkey()</code> with <code>self.delayed_payment_basepoint</code> and the per-commitment point</li><li>Derive the local HTLC key using <code>derive_pubkey()</code> with <code>self.htlc_basepoint</code> and the per-commitment point</li><li>Derive the remote HTLC key using <code>derive_pubkey()</code> with the remote HTLC basepoint parameter and the per-commitment point</li><li>Return a <code>CommitmentKeys</code> object initialized with all 5 derived keys plus the per-commitment point</li></ol>',
      code: `    def get_commitment_keys(self, commitment_number, remote_revocation_basepoint, remote_htlc_basepoint):
        per_commitment_point = self.derive_per_commitment_point(commitment_number)
        revocation_key = derive_revocation_pubkey(remote_revocation_basepoint, per_commitment_point)
        local_delayed_payment_key = derive_pubkey(self.delayed_payment_basepoint, per_commitment_point)
        local_htlc_key = derive_pubkey(self.htlc_basepoint, per_commitment_point)
        remote_htlc_key = derive_pubkey(remote_htlc_basepoint, per_commitment_point)
        return CommitmentKeys(per_commitment_point, revocation_key,
                              local_delayed_payment_key, local_htlc_key, remote_htlc_key)`,
    },
    rewardSats: 21,
    group: "keys/channel_key_manager",
    groupOrder: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 10 -Derive Public Key from Basepoint
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-derive-pubkey": {
    id: "ln-exercise-derive-pubkey",
    title: "Exercise 10: Derive Public Key from Basepoint",
    description:
      "Derive a public key from a basepoint and per-commitment point. The formula is: <code>derived_key = basepoint + G * SHA256(per_commitment_point || basepoint)</code>. This is used to derive per-commitment versions of <code>htlc_pubkey</code> and <code>delayed_payment_pubkey</code>.",
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
        "<p>Your goal is to derive a per-commitment public key by tweaking a basepoint. The formula is: <code>basepoint + G * SHA256(per_commitment_point || basepoint)</code>. You hash the two compressed public keys concatenated together with <code>hashlib.sha256</code>, convert the digest to an integer modulo <code>ORDER</code>, multiply the generator point <code>G</code> by that scalar, then add the result to the decompressed basepoint. Use <code>decompress_pubkey()</code> and <code>compress_point()</code> for point format conversions. Note the concatenation order: per-commitment point comes first.</p>",
      steps:
        '<ol><li>Compute the tweak scalar by SHA256-hashing the per-commitment point concatenated with the basepoint (in that order). Convert the digest to a big-endian integer and reduce modulo <code>ORDER</code></li><li>Decompress the basepoint into an elliptic curve <code>Point</code> object using <code>decompress_pubkey()</code></li><li>Compute the tweak point by multiplying the generator <code>G</code> by the tweak integer, then add this to the decompressed basepoint using elliptic curve point addition</li><li>Compress the resulting point with <code>compress_point()</code> and return the 33-byte result</li></ol>',
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
  // EXERCISE 11 -Derive Private Key from Basepoint Secret
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-derive-privkey": {
    id: "ln-exercise-derive-privkey",
    title: "Exercise 11: Derive Private Key",
    description:
      "Derive a private key from a basepoint secret and per-commitment point. The formula is: <code>derived_privkey = basepoint_secret + SHA256(per_commitment_point || basepoint) mod n</code>.",
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
        "<p>Your goal is to derive a per-commitment private key, which is the scalar counterpart of <code>derive_pubkey()</code>. The formula adds the basepoint secret to a SHA256-derived tweak, all modulo the curve order: <code>basepoint_secret + SHA256(per_commitment_point || basepoint) mod n</code>. Note that the SHA256 input uses the public key of the basepoint (not the secret itself), so you must first compute the public key using <code>privkey_to_pubkey()</code>. Use <code>int.from_bytes()</code> for integer conversion and <code>ORDER</code> for modular arithmetic.</p>",
      steps:
        '<ol><li>Compute the basepoint (public key) from <code>basepoint_secret</code> using <code>privkey_to_pubkey()</code>, since the SHA256 hash operates on public keys</li><li>Compute the tweak by SHA256-hashing the per-commitment point concatenated with the basepoint (same order as the public key version). Convert the digest to a big-endian integer modulo <code>ORDER</code></li><li>Convert the basepoint secret to an integer (big-endian), add the tweak integer, and reduce modulo <code>ORDER</code></li><li>Convert the result back to 32 bytes (big-endian) and return it</li></ol>',
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
  // EXERCISE 12 -Create to_remote Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-to-remote-script": {
    id: "ln-exercise-to-remote-script",
    title: "Exercise 12: Create to_remote Script",
    description:
      "Create the <code>to_remote</code> output script for a commitment transaction. This is a standard P2WPKH script: <code>OP_0 &lt;HASH160(remote_pubkey)&gt;</code>.",
    starterCode: `def create_to_remote_script(remote_pubkey: bytes) -> CScript:
    """
    Create the to_remote output script (P2WPKH).

    Format: OP_0 <20-byte HASH160 of pubkey>

    Use CScript with OP_0 and the hash160 of the pubkey:
        CScript([OP_0, hash160(pubkey)])

    Args:
        remote_pubkey: 33-byte compressed public key

    Returns:
        CScript: P2WPKH script
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
    h160 = hash160(remote_pubkey)
    assert result[2:] == h160, "Must use HASH160 of the pubkey"
`,
    hints: {
      conceptual:
        "<p>Your goal is to create a P2WPKH (Pay to Witness Public Key Hash) script for the to_remote commitment output. P2WPKH is a standard segwit output format: <code>OP_0</code> followed by the 20-byte HASH160 of the public key, where HASH160 means RIPEMD160(SHA256(data)). Use the provided <code>hash160()</code> helper to compute the hash and <code>CScript</code> with <code>OP_0</code> to build the script.</p>",
      steps:
        '<ol><li>Compute the HASH160 (RIPEMD160 of SHA256) of the remote public key using the <code>hash160()</code> helper function</li><li>Construct a <code>CScript</code> with <code>OP_0</code> and the 20-byte hash, which produces a standard P2WPKH scriptPubKey</li><li>Return the CScript</li></ol>',
      code: `def create_to_remote_script(remote_pubkey):
    return CScript([OP_0, hash160(remote_pubkey)])`,
    },
    rewardSats: 21,
    group: "scripts/commitment",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 13 -Create to_local Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-to-local-script": {
    id: "ln-exercise-to-local-script",
    title: "Exercise 13: Create to_local Script",
    description:
      "Create the <code>to_local</code> output script for a commitment transaction. This script allows the revocation key holder to spend immediately, or the local party to spend after a <code>OP_CHECKSEQUENCEVERIFY</code> delay.",
    starterCode: `def create_to_local_script(revocation_pubkey: bytes,
                            local_delayed_pubkey: bytes,
                            to_self_delay: int) -> CScript:
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

    Use CScript with named opcodes. CScript handles integer encoding
    (minimal script numbers) and push-data lengths automatically.

    Args:
        revocation_pubkey: 33-byte compressed pubkey
        local_delayed_pubkey: 33-byte compressed pubkey
        to_self_delay: CSV delay in blocks

    Returns:
        CScript: the to_local script
    """
    # === YOUR CODE HERE ===
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
        "<p>Your goal is to create the to_local conditional script that has two spending paths. The OP_IF branch allows the revocation key holder to spend immediately (for penalty enforcement). The OP_ELSE branch lets the local party spend after a <code>OP_CHECKSEQUENCEVERIFY</code> (CSV) delay. The script ends with <code>OP_CHECKSIG</code>. Build it with <code>CScript</code>, which accepts a list of opcodes, public keys, and integers. CScript automatically handles minimal integer encoding for the delay value.</p>",
      steps:
        '<ol><li>Study the script structure in the docstring. It has an OP_IF/OP_ELSE/OP_ENDIF conditional with two branches, ending in OP_CHECKSIG</li><li>Construct a <code>CScript</code> by passing a list that follows the script template exactly: the IF branch contains the revocation pubkey, the ELSE branch has the delay value followed by CSV verification opcodes and then the local delayed pubkey</li><li>Pass the <code>to_self_delay</code> integer directly in the list. CScript will encode it as a minimal script number automatically</li><li>Return the CScript</li></ol>',
      code: `def create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay):
    return CScript([
        OP_IF,
            revocation_pubkey,
        OP_ELSE,
            to_self_delay, OP_CHECKSEQUENCEVERIFY, OP_DROP,
            local_delayed_pubkey,
        OP_ENDIF,
        OP_CHECKSIG
    ])`,
    },
    rewardSats: 21,
    group: "scripts/commitment",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 14 -Compute Obscured Commitment Number
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-obscure-factor": {
    id: "ln-exercise-obscure-factor",
    title: "Exercise 14: Compute Obscured Commitment Number",
    description:
      "Compute the commitment transaction number obscure factor from the opener and accepter payment basepoints. The factor is the lower 48 bits of <code>SHA256(opener_payment_basepoint || accepter_payment_basepoint)</code>.",
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
        "<p>Your goal is to compute a 48-bit obscure factor that hides the commitment number in on-chain transactions. Concatenate the opener and accepter payment basepoints (in that order), hash with <code>hashlib.sha256</code>, and extract the lower 48 bits of the result. The lower 48 bits correspond to the last 6 bytes of the 32-byte SHA256 digest. Convert those bytes to an integer using <code>int.from_bytes()</code>.</p>",
      steps:
        '<ol><li>Concatenate the two payment basepoints in order: opener first, then accepter</li><li>Hash the concatenated bytes with <code>hashlib.sha256</code></li><li>Extract the lower 48 bits by slicing the last 6 bytes of the 32-byte digest and converting them to an integer with <code>int.from_bytes()</code> in big-endian order</li></ol>',
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
  // EXERCISE 15 -Set Obscured Commitment Number in TX
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-obscured-commitment": {
    id: "ln-exercise-obscured-commitment",
    title: "Exercise 15: Set Obscured Commitment Number",
    description:
      "Given a commitment number and the obscure factor, set the obscured commitment number in a transaction's <code>nLockTime</code> and <code>nSequence</code> fields. The lower 24 bits go in <code>nLockTime</code> (with upper byte <code>0x20</code>), the upper 24 bits go in <code>vin[0].nSequence</code> (with upper byte <code>0x80</code>).",
    starterCode: `def set_obscured_commitment_number(tx_hex: str,
                                    commitment_number: int,
                                    opener_bp: bytes,
                                    accepter_bp: bytes) -> str:
    """
    Set the obscured commitment number in a transaction.

    The obscured number = commitment_number XOR obscure_factor.
    Lower 24 bits → nLockTime (upper byte = 0x20)
    Upper 24 bits → input[0].nSequence (upper byte = 0x80)

    Steps:
    1. Deserialize the tx hex into a CMutableTransaction
    2. Compute obscured = commitment_number ^ get_obscure_factor(...)
    3. Set tx.nLockTime = (0x20 << 24) | (obscured & 0xFFFFFF)
    4. Set tx.vin[0].nSequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)
    5. Re-serialize and return hex

    Args:
        tx_hex: hex-encoded transaction
        commitment_number: the commitment index (e.g. 42)
        opener_bp: 33-byte opener payment basepoint
        accepter_bp: 33-byte accepter payment basepoint

    Returns:
        str: hex-encoded modified transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib
import struct
from bitcoin.core import CMutableTransaction, CTxIn, CTxOut, COutPoint

def _get_factor(a, b):
    h = hashlib.sha256(a + b).digest()
    return int.from_bytes(h[26:32], 'big')

def test_bolt3_values():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    commitment_number = 42
    factor = _get_factor(opener, accepter)
    obscured = factor ^ commitment_number
    # Build a minimal tx with one input
    txin = CTxIn(COutPoint())
    tx = CMutableTransaction([txin], [])
    tx_hex = tx.serialize().hex()
    result_hex = set_obscured_commitment_number(tx_hex, commitment_number, opener, accepter)
    result_bytes = bytes.fromhex(result_hex)
    locktime = struct.unpack('<I', result_bytes[-4:])[0]
    assert locktime >> 24 == 0x20, f"Locktime upper byte must be 0x20, got {locktime >> 24:#x}"
    lower_24 = locktime & 0xffffff
    assert lower_24 == (obscured & 0xffffff), "Locktime lower 24 bits must match"

def test_sequence_upper_byte():
    opener = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    factor = _get_factor(opener, accepter)
    obscured = factor ^ 42
    txin = CTxIn(COutPoint())
    tx = CMutableTransaction([txin], [])
    tx_hex = tx.serialize().hex()
    result_hex = set_obscured_commitment_number(tx_hex, 42, opener, accepter)
    from bitcoin.core import CTransaction
    result_tx = CTransaction.deserialize(bytes.fromhex(result_hex))
    seq = result_tx.vin[0].nSequence
    assert seq >> 24 == 0x80, f"Sequence upper byte must be 0x80, got {seq >> 24:#x}"
`,
    hints: {
      conceptual:
        "<p>Your goal is to encode an obscured commitment number into a transaction's <code>nLockTime</code> and first input's <code>nSequence</code> fields. XOR the commitment number with the obscure factor (from <code>get_obscure_factor()</code>) to produce a 48-bit obscured value. The lower 24 bits go into <code>nLockTime</code> with <code>0x20</code> as the upper byte. The upper 24 bits go into <code>nSequence</code> with <code>0x80</code> as the upper byte. Use <code>CMutableTransaction.deserialize()</code> to get a mutable transaction you can modify, then set the fields directly and re-serialize.</p>",
      steps:
        '<ol><li>Deserialize the hex transaction into a <code>CMutableTransaction</code> by first converting hex to bytes, then calling its <code>deserialize()</code> class method</li><li>Compute the obscured value by XORing the commitment number with the obscure factor from <code>get_obscure_factor()</code></li><li>Set <code>nLockTime</code>: combine <code>0x20</code> as the upper byte with the lower 24 bits of the obscured value using bitwise OR and a left shift. Mask the lower 24 bits with <code>0xFFFFFF</code></li><li>Set the first input <code>nSequence</code>: combine <code>0x80</code> as the upper byte with the upper 24 bits of the obscured value. Right-shift by 24 to get the upper bits, then mask with <code>0xFFFFFF</code></li><li>Serialize the modified transaction and return the hex string</li></ol>',
      code: `def set_obscured_commitment_number(tx_hex, commitment_number, opener_bp, accepter_bp):
    tx = CMutableTransaction.deserialize(bytes.fromhex(tx_hex))
    obscured = commitment_number ^ get_obscure_factor(opener_bp, accepter_bp)
    tx.nLockTime = (0x20 << 24) | (obscured & 0xFFFFFF)
    tx.vin[0].nSequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)
    return tx.serialize().hex()`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 16 -Create Commitment Transaction Outputs
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-outputs": {
    id: "ln-exercise-commitment-outputs",
    title: "Exercise 15: Create Commitment TX Outputs",
    description:
      "Create the commitment transaction outputs (<code>to_local</code> and <code>to_remote</code>) using keys from a <code>CommitmentKeys</code> object. Apply dust limit filtering and fee deduction from the <code>to_local</code> output. Sort outputs by value then by script bytes (BIP69-like).",
    starterCode: `def create_commitment_outputs(to_local_sat: int, to_remote_sat: int,
                               commitment_keys,
                               remote_payment_pubkey: bytes,
                               to_self_delay: int, dust_limit: int,
                               fee: int) -> list:
    """
    Create commitment transaction outputs with dust filtering.

    Fee is deducted from to_local. Outputs below dust_limit are omitted.
    The to_local output uses P2WSH: CScript([OP_0, SHA256(witness_script)])
    The to_remote output uses P2WPKH: create_to_remote_script()
    Sort outputs by: (value, script_bytes).

    Use commitment_keys.revocation_key and
    commitment_keys.local_delayed_payment_key for the to_local script.

    Args:
        to_local_sat: local balance in satoshis
        to_remote_sat: remote balance in satoshis
        commitment_keys: CommitmentKeys object with derived keys
        remote_payment_pubkey: 33-byte compressed pubkey
        to_self_delay: CSV delay in blocks
        dust_limit: dust limit in satoshis
        fee: fee to deduct from to_local

    Returns:
        list of CTxOut: sorted by (value, script bytes)
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib

def _h160(data):
    return hash160(data)

def test_two_outputs():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    outputs = create_commitment_outputs(7_000_000, 3_000_000, ck, remote_pk, 144, 546, 10000)
    assert len(outputs) == 2, f"Expected 2 outputs, got {len(outputs)}"

def test_fee_deducted_from_local():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    outputs = create_commitment_outputs(7_000_000, 3_000_000, ck, remote_pk, 144, 546, 10000)
    values = sorted([o.nValue for o in outputs])
    assert 3_000_000 in values, "to_remote should be 3,000,000"
    assert 6_990_000 in values, "to_local should be 7,000,000 - 10,000 = 6,990,000"

def test_dust_filtering():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    outputs = create_commitment_outputs(500, 400, ck, remote_pk, 144, 546, 100)
    assert len(outputs) == 0, "Both below dust should produce no outputs"

def test_sorted_by_value():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    outputs = create_commitment_outputs(7_000_000, 3_000_000, ck, remote_pk, 144, 546, 10000)
    assert outputs[0].nValue <= outputs[1].nValue, "Outputs must be sorted by value"
`,
    hints: {
      conceptual:
        "<p>Your goal is to create the two main commitment transaction outputs: a to_local output (P2WSH wrapping the conditional revocation/delay script) and a to_remote output (P2WPKH). Deduct the fee from the local balance. Omit any output whose value falls below the dust limit. Sort remaining outputs by (value, raw script bytes). Use <code>create_to_local_script()</code> with keys from the <code>commitment_keys</code> object for the witness script, <code>hashlib.sha256</code> to hash it for the P2WSH wrapper, and <code>create_to_remote_script()</code> for the remote output. Create <code>CTxOut</code> objects for each non-dust output.</p>",
      steps:
        '<ol><li>Compute the to_local value by subtracting the fee from <code>to_local_sat</code></li><li>Build the to_local witness script using <code>create_to_local_script()</code> with the revocation key and local delayed payment key from the <code>commitment_keys</code> object, plus the <code>to_self_delay</code></li><li>Wrap the witness script as a P2WSH scriptPubKey: use <code>CScript</code> with <code>OP_0</code> and the SHA256 hash of the witness script bytes</li><li>Build the to_remote scriptPubKey using <code>create_to_remote_script()</code> with the remote payment pubkey</li><li>For each output, check if the value meets the dust limit. Only create <code>CTxOut</code> objects for outputs above the threshold</li><li>Sort the resulting outputs by a tuple of (value, script bytes) to ensure deterministic ordering</li></ol>',
      code: `def create_commitment_outputs(to_local_sat, to_remote_sat, commitment_keys, remote_payment_pubkey, to_self_delay, dust_limit, fee):
    outputs = []
    to_local_value = to_local_sat - fee
    if to_local_value >= dust_limit:
        witness_script = create_to_local_script(commitment_keys.revocation_key, commitment_keys.local_delayed_payment_key, to_self_delay)
        p2wsh = CScript([OP_0, hashlib.sha256(bytes(witness_script)).digest()])
        outputs.append(CTxOut(to_local_value, p2wsh))
    if to_remote_sat >= dust_limit:
        p2wpkh = create_to_remote_script(remote_payment_pubkey)
        outputs.append(CTxOut(to_remote_sat, p2wpkh))
    outputs.sort(key=lambda o: (o.nValue, bytes(o.scriptPubKey)))
    return outputs`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 17 - Create Commitment Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-commitment-tx": {
    id: "ln-exercise-commitment-tx",
    title: "Exercise 16: Create Commitment Transaction",
    description:
      "Assemble a complete unsigned commitment transaction with the funding input, obscured commitment number, and sorted outputs (including any HTLCs). Uses a <code>CommitmentKeys</code> object for derived keys. Fee calculation accounts for HTLC weight: <code>weight = 724 + 172 * num_htlcs</code>.",
    starterCode: `def create_commitment_tx(funding_txid_hex: str, funding_vout: int,
                          to_local_sat: int, to_remote_sat: int,
                          commitment_keys,
                          remote_payment_pubkey: bytes,
                          opener_bp: bytes, accepter_bp: bytes,
                          commitment_number: int, to_self_delay: int,
                          dust_limit: int, feerate_per_kw: int,
                          offered_htlcs=None, received_htlcs=None) -> str:
    """
    Create an unsigned commitment transaction.

    Combines: funding input, obscured commitment number,
    to_local/to_remote outputs with dust filtering, fee deduction,
    and any HTLC outputs.

    Fee calculation: weight = 724 + 172 * num_htlcs,
    fee = weight * feerate_per_kw // 1000

    Steps:
    1. Count HTLCs and compute fee (accounting for HTLC weight)
    2. Create channel outputs with create_commitment_outputs()
    3. Create HTLC outputs with create_htlc_outputs()
    4. Wrap channel outputs as [{"output": o, "cltv_expiry": 0}, ...]
    5. Combine and sort all outputs by (nValue, scriptPubKey bytes, cltv_expiry)
    6. Extract the CTxOut list from the sorted dicts
    7. Build CMutableTransaction with obscured commitment number
    8. Return serialized hex

    Args:
        funding_txid_hex: funding txid (big-endian hex)
        funding_vout: funding output index
        to_local_sat, to_remote_sat: balances in satoshis
        commitment_keys: CommitmentKeys object with derived keys
        remote_payment_pubkey: 33-byte compressed pubkey
        opener_bp, accepter_bp: payment basepoints
        commitment_number: commitment index
        to_self_delay: CSV delay
        dust_limit: dust limit satoshis
        feerate_per_kw: fee rate per kilo-weight unit
        offered_htlcs: list of offered HTLC dicts (optional)
        received_htlcs: list of received HTLC dicts (optional)

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
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_commitment_tx(funding_txid, 0, 7_000_000, 3_000_000, ck, remote_pk, opener_bp, accepter_bp, 42, 144, 546, 0)
    expected = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a488489000000000038b02b8002c0c62d0000000000160014cc1b07838e387deacd0e5232e1e8b49f4c29e484c0cf6a0000000000220020f50bac8895d89a8a4f1de0b87bf52383f4d853e4368db17467fa50e3798d69803e195220"
    assert result == expected, f"TX mismatch.\\nExpected: {expected}\\nGot:      {result}"

def test_returns_string():
    funding_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    opener_bp = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter_bp = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_commitment_tx(funding_txid, 0, 7_000_000, 3_000_000, ck, remote_pk, opener_bp, accepter_bp, 42, 144, 546, 0)
    assert isinstance(result, str), "Must return hex string"

def test_with_htlc():
    import hashlib as _hl
    funding_txid = "8984484a580b825b9972d7adb15050b3ab624ccd731946b3eeddb92f4e7ef6be"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    remote_pk = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    opener_bp = bytes.fromhex("034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa")
    accepter_bp = bytes.fromhex("032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, local_htlc, remote_htlc)
    preimage = bytes([0x02] * 32)
    payment_hash = _hl.sha256(preimage).digest()
    offered = [{"amount_sat": 405000, "payment_hash": payment_hash, "cltv_expiry": 500}]
    result = create_commitment_tx(funding_txid, 0, 7_000_000, 3_000_000, ck, remote_pk, opener_bp, accepter_bp, 42, 144, 546, 0, offered_htlcs=offered)
    tx_bytes = bytes.fromhex(result)
    # With 1 HTLC and feerate=0, should have 3 outputs: to_remote, htlc, to_local
    # Count outputs from the serialized tx (version=4, marker+flag=0, vin count, vin, vout count...)
    from bitcoin.core import CTransaction
    tx = CTransaction.deserialize(tx_bytes)
    assert len(tx.vout) == 3, f"Expected 3 outputs with 1 HTLC, got {len(tx.vout)}"
`,
    hints: {
      conceptual:
        "<p>Your goal is to assemble a complete unsigned commitment transaction. This combines everything: a funding input, obscured commitment number in nLockTime/nSequence, channel outputs (to_local and to_remote), and HTLC outputs. The fee formula accounts for HTLC weight: <code>weight = 724 + 172 * num_htlcs</code>, and <code>fee = weight * feerate_per_kw // 1000</code>. Use <code>create_commitment_outputs()</code> and <code>create_htlc_outputs()</code> to build the outputs, then merge and sort them. All outputs get wrapped in dicts with <code>cltv_expiry</code> so they can be sorted by (value, script, cltv_expiry) per the BOLT 3 output ordering rule.</p>",
      steps:
        '<ol><li>Count total HTLCs from both offered and received lists (handling <code>None</code> with <code>or []</code>), then compute the fee using the weight formula</li><li>Create channel outputs using <code>create_commitment_outputs()</code>, passing all relevant parameters including the computed fee</li><li>Create HTLC outputs using <code>create_htlc_outputs()</code> with the commitment keys and HTLC lists</li><li>Wrap channel outputs in dicts with <code>cltv_expiry: 0</code> to match the HTLC output dict format, then combine both lists</li><li>Sort all output dicts by a tuple of (output value, script bytes, cltv_expiry), then extract just the <code>CTxOut</code> objects from the sorted list</li><li>Compute the obscured commitment number and split it into nLockTime and nSequence values (same logic as <code>set_obscured_commitment_number</code>). Build a <code>CTxIn</code> with the funding UTXO and the computed nSequence, then construct and serialize the <code>CMutableTransaction</code></li></ol>',
      code: `def create_commitment_tx(funding_txid_hex, funding_vout, to_local_sat, to_remote_sat,
                          commitment_keys, remote_payment_pubkey,
                          opener_bp, accepter_bp, commitment_number, to_self_delay,
                          dust_limit, feerate_per_kw,
                          offered_htlcs=None, received_htlcs=None):
    num_htlcs = len(offered_htlcs or []) + len(received_htlcs or [])
    weight = 724 + 172 * num_htlcs
    fee = weight * feerate_per_kw // 1000
    channel_outputs = create_commitment_outputs(to_local_sat, to_remote_sat, commitment_keys,
                                                remote_payment_pubkey, to_self_delay, dust_limit, fee)
    htlc_outputs = create_htlc_outputs(commitment_keys, offered_htlcs or [], received_htlcs or [])

    all_outputs = [{"output": o, "cltv_expiry": 0} for o in channel_outputs]
    all_outputs.extend(htlc_outputs)
    all_outputs.sort(key=lambda d: (d["output"].nValue, bytes(d["output"].scriptPubKey), d["cltv_expiry"]))
    outputs = [d["output"] for d in all_outputs]

    obscured = commitment_number ^ get_obscure_factor(opener_bp, accepter_bp)
    locktime = (0x20 << 24) | (obscured & 0xFFFFFF)
    sequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)

    txin = CTxIn(COutPoint(lx(funding_txid_hex), funding_vout), nSequence=sequence)
    tx = CMutableTransaction([txin], outputs, nLockTime=locktime)
    return tx.serialize().hex()`,
    },
    rewardSats: 42,
    group: "transactions/commitment",
    groupOrder: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 18 -Finalize Commitment Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-finalize-commitment": {
    id: "ln-exercise-finalize-commitment",
    title: "Exercise 17: Finalize Commitment Transaction",
    description:
      "Sign and finalize a commitment transaction using the <code>ChannelKeyManager</code>. Call <code>km.sign_input()</code> with <code>km.funding_key</code> to produce the local signature, then build the witness: <code>[empty, sig1, sig2, funding_script]</code>.",
    starterCode: `def finalize_commitment_tx(km, unsigned_tx_hex: str,
                            funding_script: bytes,
                            funding_amount: int,
                            remote_signature: bytes,
                            local_sig_first: bool) -> str:
    """
    Sign and finalize a commitment transaction.

    Steps:
    1. Get tx_bytes from the unsigned tx hex
    2. Sign with km.sign_input() using km.funding_key
    3. Build witness using CScriptWitness, CTxInWitness, CTxWitness:
       items = [b'', sig1, sig2, funding_script]
       sig1/sig2 order depends on local_sig_first
    4. Deserialize into mutable tx, attach the witness, serialize

    Args:
        km: ChannelKeyManager with funding_key
        unsigned_tx_hex: hex of unsigned commitment tx
        funding_script: the 2-of-2 multisig script
        funding_amount: satoshi value of funding output
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
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a488489000000000038b02b8002c0c62d0000000000160014cc1b07838e387deacd0e5232e1e8b49f4c29e48454a56a00000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80e3e195220"
    funding_script = bytes.fromhex("5221023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb21030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c152ae")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    result = finalize_commitment_tx(km, unsigned_tx, funding_script, 10_000_000, remote_sig, True)
    assert isinstance(result, str), "Must return hex string"
    assert "0001" in result[:12], "Must include segwit marker"

def test_uses_km_sign_input():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a488489000000000038b02b8002c0c62d0000000000160014cc1b07838e387deacd0e5232e1e8b49f4c29e48454a56a00000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80e3e195220"
    funding_script = bytes.fromhex("5221023da092f6980e58d2c037173180e9a465476026ee50f96695963e8efe436f54eb21030e9f7b623d2ccc7c9bd44d66d5ce21ce504c0acf6385a132cec6d3c39fa711c152ae")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    result = finalize_commitment_tx(km, unsigned_tx, funding_script, 10_000_000, remote_sig, True)
    signed = bytes.fromhex(result)
    # Should have witness data
    assert len(signed) > len(bytes.fromhex(unsigned_tx)), "Signed tx must be larger than unsigned"
`,
    hints: {
      conceptual:
        "<p>Your goal is to sign and add a segwit witness to the commitment transaction. Use <code>km.sign_input()</code> with <code>km.funding_key</code> to produce the local signature. The witness for a 2-of-2 multisig P2WSH is: [empty bytes (OP_0 dummy for the CHECKMULTISIG off-by-one bug), sig1, sig2, witness_script]. The signature order depends on <code>local_sig_first</code>. Use python-bitcoinlib's witness types (<code>CScriptWitness</code>, <code>CTxInWitness</code>, <code>CTxWitness</code>) to construct the witness, then attach it to a mutable copy of the transaction.</p>",
      steps:
        '<ol><li>Convert the unsigned tx hex to bytes, then sign input 0 using <code>km.sign_input()</code> with the funding script (wrapped in <code>CScript</code>), the funding amount, and <code>km.funding_key</code></li><li>Order the two signatures based on the <code>local_sig_first</code> flag: if true, local signature goes first; otherwise remote signature goes first</li><li>Deserialize the transaction bytes into a <code>CTransaction</code> object</li><li>Construct the witness stack: a <code>CScriptWitness</code> with four items: empty bytes, the two ordered signatures, and the funding script</li><li>Wrap it in <code>CTxInWitness</code> and then <code>CTxWitness</code></li><li>Create a mutable transaction from the deserialized one (using <code>CMutableTransaction.from_tx()</code>), attach the witness to the <code>.wit</code> property, then serialize and return the hex</li></ol>',
      code: `def finalize_commitment_tx(km, unsigned_tx_hex, funding_script, funding_amount,
                            remote_signature, local_sig_first):
    tx_bytes = bytes.fromhex(unsigned_tx_hex)
    local_sig = km.sign_input(tx_bytes, 0, CScript(funding_script), funding_amount, km.funding_key)

    if local_sig_first:
        sig1, sig2 = local_sig, remote_signature
    else:
        sig1, sig2 = remote_signature, local_sig

    tx = CTransaction.deserialize(tx_bytes)
    witness = CScriptWitness([b'', sig1, sig2, funding_script])
    in_witness = CTxInWitness(witness)
    tx_witness = CTxWitness([in_witness])

    mtx = CMutableTransaction.from_tx(tx)
    mtx.wit = tx_witness
    return mtx.serialize().hex()`,
    },
    rewardSats: 42,
    group: "transactions/commitment",
    groupOrder: 5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 18 - Create HTLC Outputs
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-htlc-outputs": {
    id: "ln-exercise-htlc-outputs",
    title: "Exercise 18: Create HTLC Outputs",
    description:
      "Create HTLC output metadata for commitment transactions. For each offered HTLC, wrap in an offered HTLC script (P2WSH). For each received HTLC, wrap in a received HTLC script (P2WSH). Returns a list of dicts with <code>\"output\"</code> (CTxOut) and <code>\"cltv_expiry\"</code> (int) keys.",
    starterCode: `def create_htlc_outputs(commitment_keys, offered_htlcs: list, received_htlcs: list) -> list:
    """
    Create HTLC output metadata for commitment transactions.

    Each HTLC in offered_htlcs/received_htlcs is a dict:
      {"amount_sat": int, "payment_hash": bytes, "cltv_expiry": int}

    Returns list of dicts:
      [{"output": CTxOut, "cltv_expiry": int}, ...]

    For offered HTLCs: call create_offered_htlc_script(commitment_keys, htlc["payment_hash"])
    For received HTLCs: call create_received_htlc_script(commitment_keys, htlc["payment_hash"], htlc["cltv_expiry"])
    Wrap each script as P2WSH: CScript([OP_0, hashlib.sha256(bytes(script)).digest()])
    Create CTxOut with htlc["amount_sat"] and the P2WSH script.

    Args:
        commitment_keys: CommitmentKeys object with derived keys
        offered_htlcs: list of offered HTLC dicts
        received_htlcs: list of received HTLC dicts

    Returns:
        list of dicts: [{"output": CTxOut, "cltv_expiry": int}, ...]
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
import hashlib as _hl

def test_correct_count():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    preimage1 = bytes([0x02] * 32)
    preimage2 = bytes(32)
    offered = [{"amount_sat": 405000, "payment_hash": _hl.sha256(preimage1).digest(), "cltv_expiry": 500}]
    received = [{"amount_sat": 300000, "payment_hash": _hl.sha256(preimage2).digest(), "cltv_expiry": 600}]
    result = create_htlc_outputs(ck, offered, received)
    assert len(result) == 2, f"Expected 2 outputs (1 offered + 1 received), got {len(result)}"

def test_output_dict_keys():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    offered = [{"amount_sat": 405000, "payment_hash": _hl.sha256(bytes([0x02] * 32)).digest(), "cltv_expiry": 500}]
    result = create_htlc_outputs(ck, offered, [])
    assert "output" in result[0], "Each dict must have 'output' key"
    assert "cltv_expiry" in result[0], "Each dict must have 'cltv_expiry' key"
    assert isinstance(result[0]["cltv_expiry"], int), "cltv_expiry must be int"

def test_p2wsh_wrapping():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    offered = [{"amount_sat": 405000, "payment_hash": _hl.sha256(bytes([0x02] * 32)).digest(), "cltv_expiry": 500}]
    result = create_htlc_outputs(ck, offered, [])
    spk = bytes(result[0]["output"].scriptPubKey)
    assert spk[0] == 0x00, "P2WSH must start with OP_0"
    assert len(spk) == 34, f"P2WSH scriptPubKey must be 34 bytes (OP_0 + push32 + 32-byte hash), got {len(spk)}"

def test_values_match():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    offered = [{"amount_sat": 405000, "payment_hash": _hl.sha256(bytes([0x02] * 32)).digest(), "cltv_expiry": 500}]
    received = [{"amount_sat": 300000, "payment_hash": _hl.sha256(bytes(32)).digest(), "cltv_expiry": 600}]
    result = create_htlc_outputs(ck, offered, received)
    values = sorted([d["output"].nValue for d in result])
    assert values == [300000, 405000], f"Output values should match input amounts, got {values}"
`,
    hints: {
      conceptual:
        "<p>Your goal is to create P2WSH outputs for each HTLC and return them as dicts with <code>\"output\"</code> (CTxOut) and <code>\"cltv_expiry\"</code> (int) keys. For offered HTLCs, generate the witness script with <code>create_offered_htlc_script()</code> using the commitment keys and payment hash. For received HTLCs, use <code>create_received_htlc_script()</code> which also takes a cltv_expiry. Each witness script gets wrapped as P2WSH (using <code>CScript</code> with <code>OP_0</code> and the SHA256 of the witness script). Each HTLC dict has <code>amount_sat</code>, <code>payment_hash</code>, and <code>cltv_expiry</code> fields.</p>",
      steps:
        '<ol><li>Initialize an empty list for the results</li><li>Loop through each offered HTLC dict: call <code>create_offered_htlc_script()</code> with the commitment keys and the HTLC payment hash to get the witness script. Hash the witness script with SHA256 and wrap it in a P2WSH scriptPubKey. Create a <code>CTxOut</code> with the HTLC amount and the P2WSH script. Append a dict with the output and its cltv_expiry</li><li>Loop through each received HTLC dict: same pattern but use <code>create_received_htlc_script()</code>, which also takes the cltv_expiry from the HTLC dict as a parameter</li><li>Return the list of dicts</li></ol>',
      code: `def create_htlc_outputs(commitment_keys, offered_htlcs, received_htlcs):
    outputs = []
    for htlc in offered_htlcs:
        script = create_offered_htlc_script(commitment_keys, htlc["payment_hash"])
        p2wsh = CScript([OP_0, hashlib.sha256(bytes(script)).digest()])
        outputs.append({"output": CTxOut(htlc["amount_sat"], p2wsh), "cltv_expiry": htlc["cltv_expiry"]})
    for htlc in received_htlcs:
        script = create_received_htlc_script(commitment_keys, htlc["payment_hash"], htlc["cltv_expiry"])
        p2wsh = CScript([OP_0, hashlib.sha256(bytes(script)).digest()])
        outputs.append({"output": CTxOut(htlc["amount_sat"], p2wsh), "cltv_expiry": htlc["cltv_expiry"]})
    return outputs`,
    },
    rewardSats: 21,
    group: "transactions/commitment",
    groupOrder: 6,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 19 -Create Offered HTLC Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-offered-htlc-script": {
    id: "ln-exercise-offered-htlc-script",
    title: "Exercise 18: Create Offered HTLC Script",
    description:
      "Create an offered HTLC output script per BOLT 3 using keys from a <code>CommitmentKeys</code> object. Use <code>commitment_keys.revocation_key</code>, <code>commitment_keys.local_htlc_key</code>, and <code>commitment_keys.remote_htlc_key</code>.",
    starterCode: `def create_offered_htlc_script(commitment_keys,
                                payment_hash: bytes) -> CScript:
    """
    Create an offered HTLC script per BOLT 3.

    Script:
      OP_DUP OP_HASH160 <HASH160(revocation_key)> OP_EQUAL
      OP_IF
          OP_CHECKSIG
      OP_ELSE
          <remote_htlc_key> OP_SWAP OP_SIZE 32 OP_EQUAL
          OP_IF
              OP_HASH160 <RIPEMD160(payment_hash)> OP_EQUALVERIFY
              2 OP_SWAP <local_htlc_key> 2 OP_CHECKMULTISIG
          OP_ELSE
              OP_DROP 2 OP_SWAP <local_htlc_key> 2 OP_CHECKMULTISIG
          OP_ENDIF
      OP_ENDIF

    Use CScript with named opcodes. Extract keys from commitment_keys:
    - commitment_keys.revocation_key
    - commitment_keys.local_htlc_key
    - commitment_keys.remote_htlc_key

    Args:
        commitment_keys: CommitmentKeys object with derived keys
        payment_hash: 32-byte SHA256 hash of payment preimage

    Returns:
        CScript: the offered HTLC script
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
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    preimage = bytes([0x02] * 32)
    payment_hash = hashlib.sha256(preimage).digest()
    expected = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac67210394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b7c820120876475527c21030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e752ae67a914b43e1b38138a41b37f7cd9a1d274bc63e3a9b5d188ac6868")
    result = create_offered_htlc_script(ck, payment_hash)
    assert result == expected, f"Script mismatch.\\nExpected: {expected.hex()}\\nGot:      {result.hex()}"

def test_script_length():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    payment_hash = hashlib.sha256(bytes(32)).digest()
    result = create_offered_htlc_script(ck, payment_hash)
    assert isinstance(result, bytes), "Must return bytes"
    assert len(result) > 100, "Offered HTLC script should be > 100 bytes"
`,
    hints: {
      conceptual:
        "<p>Your goal is to create the offered HTLC witness script per BOLT 3, which has three spending paths. The revocation path uses <code>OP_DUP OP_HASH160</code> to check for the HASH160 of the revocation key. The success path verifies the payment preimage using <code>OP_HASH160</code> with the RIPEMD160 of the payment hash, then uses 2-of-2 CHECKMULTISIG with the local and remote HTLC keys. The timeout path also uses CHECKMULTISIG but without a preimage check. Use <code>hash160()</code> for the revocation key hash and <code>_ripemd160()</code> for the payment hash. Extract keys from <code>commitment_keys.revocation_key</code>, <code>commitment_keys.local_htlc_key</code>, and <code>commitment_keys.remote_htlc_key</code>.</p>",
      steps:
        '<ol><li>Compute the HASH160 of the revocation key using <code>hash160()</code>, and the RIPEMD160 of the payment hash using <code>_ripemd160()</code>. These are the hash values embedded in the script</li><li>Study the script template in the docstring carefully. The outer structure checks if the spending key matches the revocation key hash (via DUP/HASH160/EQUAL). If yes, CHECKSIG. If no, enter the ELSE branch</li><li>In the ELSE branch, the script uses OP_SIZE to check whether the witness element is 32 bytes (a preimage) or 0 bytes (empty). The 32-byte path is for claiming with the preimage, the 0-byte path is for timeout</li><li>Build the entire script as a single <code>CScript</code> list, placing each opcode, key, and hash value from the docstring template in order. Use the named opcodes and key values from the commitment_keys object</li></ol>',
      code: `def create_offered_htlc_script(commitment_keys, payment_hash):
    rev_hash = hash160(commitment_keys.revocation_key)
    payment_ripemd = _ripemd160(payment_hash)
    return CScript([
        OP_DUP, OP_HASH160, rev_hash, OP_EQUAL,
        OP_IF,
            OP_CHECKSIG,
        OP_ELSE,
            commitment_keys.remote_htlc_key, OP_SWAP, OP_SIZE, 32, OP_EQUAL,
            OP_IF,
                OP_HASH160, payment_ripemd, OP_EQUALVERIFY,
                2, OP_SWAP, commitment_keys.local_htlc_key, 2, OP_CHECKMULTISIG,
            OP_ELSE,
                OP_DROP, 2, OP_SWAP, commitment_keys.local_htlc_key, 2, OP_CHECKMULTISIG,
            OP_ENDIF,
        OP_ENDIF,
    ])`,
    },
    rewardSats: 21,
    group: "scripts/htlc",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 20 -Create Received HTLC Script
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-received-htlc-script": {
    id: "ln-exercise-received-htlc-script",
    title: "Exercise 19: Create Received HTLC Script",
    description:
      "Create a received HTLC output script per BOLT 3 using keys from a <code>CommitmentKeys</code> object. Similar to offered HTLC but with an <code>OP_CHECKLOCKTIMEVERIFY</code> expiry for the timeout path.",
    starterCode: `def create_received_htlc_script(commitment_keys,
                                 payment_hash: bytes,
                                 cltv_expiry: int) -> CScript:
    """
    Create a received HTLC script per BOLT 3.

    Similar to offered HTLC but the timeout branch uses
    OP_CHECKLOCKTIMEVERIFY instead of OP_DROP for the timeout
    case, and the preimage path verifies the payment hash.

    Script:
      OP_DUP OP_HASH160 <HASH160(revocation_key)> OP_EQUAL
      OP_IF
          OP_CHECKSIG
      OP_ELSE
          <remote_htlc_key> OP_SWAP OP_SIZE 32 OP_EQUAL
          OP_IF
              OP_HASH160 <RIPEMD160(payment_hash)> OP_EQUALVERIFY
              2 OP_SWAP <local_htlc_key> 2 OP_CHECKMULTISIG
          OP_ELSE
              OP_DROP <cltv_expiry> OP_CHECKLOCKTIMEVERIFY OP_DROP
              OP_CHECKSIG
          OP_ENDIF
      OP_ENDIF

    Use commitment_keys.revocation_key, commitment_keys.local_htlc_key,
    and commitment_keys.remote_htlc_key.

    Args:
        commitment_keys: CommitmentKeys object with derived keys
        payment_hash: 32-byte SHA256 hash of preimage
        cltv_expiry: CLTV locktime for the timeout path

    Returns:
        CScript: the received HTLC script
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
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    preimage = bytes(32)  # HTLC #0
    payment_hash = hashlib.sha256(preimage).digest()
    expected = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac67210394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b7c8201208763a914b8bcb07f6344b42ab04250c86a6e8b75d3fdbbc688527c21030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e752ae677502f401b175ac6868")
    result = create_received_htlc_script(ck, payment_hash, 500)
    assert result == expected, f"Script mismatch.\\nExpected: {expected.hex()}\\nGot:      {result.hex()}"

def test_script_returns_bytes():
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    local_htlc = bytes.fromhex("030d417a46946384f88d5f3337267c5e579765875dc4daca813e21734b140639e7")
    remote_htlc = bytes.fromhex("0394854aa6eab5b2a8122cc726e9dded053a2184d88256816826d6231c068d4a5b")
    ck = CommitmentKeys(bytes(33), rev_pk, bytes(33), local_htlc, remote_htlc)
    payment_hash = hashlib.sha256(bytes(32)).digest()
    result = create_received_htlc_script(ck, payment_hash, 500)
    assert isinstance(result, bytes), "Must return bytes"
    assert len(result) > 100, "Received HTLC script should be > 100 bytes"
`,
    hints: {
      conceptual:
        "<p>Your goal is to create the received HTLC witness script per BOLT 3. It is structurally similar to the offered HTLC script but differs in the timeout path: instead of <code>OP_DROP</code> followed by CHECKMULTISIG, the timeout path uses <code>OP_CHECKLOCKTIMEVERIFY</code> to enforce the CLTV expiry, followed by <code>OP_DROP</code> and <code>OP_CHECKSIG</code> (single signature, not multisig). The success path (preimage) still uses 2-of-2 CHECKMULTISIG. Use the same <code>hash160()</code> and <code>_ripemd160()</code> helpers and extract keys from the <code>commitment_keys</code> object.</p>",
      steps:
        '<ol><li>Compute the HASH160 of the revocation key and the RIPEMD160 of the payment hash, same as the offered HTLC script</li><li>Compare the script template in the docstring against the offered HTLC version. The outer structure (revocation check) and the success path (preimage + CHECKMULTISIG) are identical</li><li>The key difference is in the OP_ELSE timeout branch: instead of <code>OP_DROP ... CHECKMULTISIG</code>, this version has <code>OP_DROP &lt;cltv_expiry&gt; OP_CHECKLOCKTIMEVERIFY OP_DROP OP_CHECKSIG</code>. Pass the <code>cltv_expiry</code> integer directly in the CScript list</li><li>Build the entire script as a single <code>CScript</code> list following the docstring template exactly</li></ol>',
      code: `def create_received_htlc_script(commitment_keys, payment_hash, cltv_expiry):
    rev_hash = hash160(commitment_keys.revocation_key)
    payment_ripemd = _ripemd160(payment_hash)
    return CScript([
        OP_DUP, OP_HASH160, rev_hash, OP_EQUAL,
        OP_IF,
            OP_CHECKSIG,
        OP_ELSE,
            commitment_keys.remote_htlc_key, OP_SWAP, OP_SIZE, 32, OP_EQUAL,
            OP_IF,
                OP_HASH160, payment_ripemd, OP_EQUALVERIFY,
                2, OP_SWAP, commitment_keys.local_htlc_key, 2, OP_CHECKMULTISIG,
            OP_ELSE,
                OP_DROP, cltv_expiry, OP_CHECKLOCKTIMEVERIFY, OP_DROP,
                OP_CHECKSIG,
            OP_ENDIF,
        OP_ENDIF,
    ])`,
    },
    rewardSats: 21,
    group: "scripts/htlc",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 21 -Create HTLC Timeout Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-htlc-timeout-tx": {
    id: "ln-exercise-htlc-timeout-tx",
    title: "Exercise 20: Create HTLC Timeout Transaction",
    description:
      "Create an unsigned HTLC timeout transaction that spends an offered HTLC output from a commitment transaction. The output is a P2WSH of the <code>to_local</code> script, using keys from <code>CommitmentKeys</code>.",
    starterCode: `def create_htlc_timeout_tx(commitment_txid_hex: str, htlc_output_index: int,
                            htlc_amount_sat: int, cltv_expiry: int,
                            commitment_keys,
                            to_self_delay: int, feerate_per_kw: int) -> str:
    """
    Create an unsigned HTLC timeout transaction.

    Version 2, nLockTime = cltv_expiry, input sequence = 0.
    Single output: P2WSH of to_local_script.
    Output value = htlc_amount_sat - fee (fee = 663 * feerate_per_kw / 1000).

    Use commitment_keys.revocation_key and
    commitment_keys.local_delayed_payment_key for the to_local script.

    Args:
        commitment_txid_hex: txid of the commitment tx
        htlc_output_index: which output is the HTLC
        htlc_amount_sat: HTLC amount in satoshis
        cltv_expiry: CLTV locktime for this HTLC
        commitment_keys: CommitmentKeys object with derived keys
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
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_htlc_timeout_tx(commitment_txid, 1, 2000, 502, ck, 144, 0)
    assert isinstance(result, str), "Must return hex string"
    tx = bytes.fromhex(result)
    assert struct.unpack('<I', tx[0:4])[0] == 2, "Version must be 2"
    assert struct.unpack('<I', tx[-4:])[0] == 502, "Locktime must be cltv_expiry"

def test_output_value_no_fee():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_htlc_timeout_tx(commitment_txid, 1, 2000, 502, ck, 144, 0)
    tx = bytes.fromhex(result)
    out_value = struct.unpack('<q', tx[47:55])[0]
    assert out_value == 2000, f"Output value must be 2000 with zero fee, got {out_value}"
`,
    hints: {
      conceptual:
        "<p>Your goal is to build an unsigned HTLC timeout transaction. This transaction spends an offered HTLC output from the commitment transaction, and its single output is a P2WSH of the to_local script (allowing revocation or delayed spending). The fee uses a fixed weight of 663: <code>fee = 663 * feerate_per_kw // 1000</code>. Set <code>nLockTime</code> to the <code>cltv_expiry</code> and input <code>nSequence</code> to 0. Use <code>create_to_local_script()</code> with keys from <code>commitment_keys</code> to build the output witness script.</p>",
      steps:
        '<ol><li>Compute the fee using the weight constant 663 and the provided feerate. Subtract the fee from the HTLC amount to get the output value</li><li>Build the to_local witness script using <code>create_to_local_script()</code> with the revocation key and local delayed payment key from the <code>commitment_keys</code> object, plus the <code>to_self_delay</code></li><li>Wrap the witness script as a P2WSH scriptPubKey by hashing it with SHA256 and constructing a CScript with <code>OP_0</code> and the hash</li><li>Create a transaction input that references the HTLC output on the commitment transaction. Use <code>lx()</code> to convert the txid, and set <code>nSequence</code> to 0</li><li>Create the output with the computed value and P2WSH script</li><li>Build a <code>CMutableTransaction</code> with version 2 and <code>nLockTime</code> set to the <code>cltv_expiry</code>, then serialize and return hex</li></ol>',
      code: `def create_htlc_timeout_tx(commitment_txid_hex, htlc_output_index, htlc_amount_sat,
                            cltv_expiry, commitment_keys,
                            to_self_delay, feerate_per_kw):
    fee = 663 * feerate_per_kw // 1000
    output_value = htlc_amount_sat - fee
    ws = create_to_local_script(commitment_keys.revocation_key, commitment_keys.local_delayed_payment_key, to_self_delay)
    p2wsh = CScript([OP_0, hashlib.sha256(bytes(ws)).digest()])

    txin = CTxIn(COutPoint(lx(commitment_txid_hex), htlc_output_index), nSequence=0)
    txout = CTxOut(output_value, p2wsh)
    tx = CMutableTransaction([txin], [txout], nLockTime=cltv_expiry)
    return tx.serialize().hex()`,
    },
    rewardSats: 21,
    group: "transactions/htlc",
    groupOrder: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 22 -Create HTLC Success Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-htlc-success-tx": {
    id: "ln-exercise-htlc-success-tx",
    title: "Exercise 21: Create HTLC Success Transaction",
    description:
      "Create an unsigned HTLC success transaction that spends a received HTLC output. The output is a P2WSH of the <code>to_local</code> script, using keys from <code>CommitmentKeys</code>. <code>nLockTime</code> is 0 and <code>nSequence</code> is 0.",
    starterCode: `def create_htlc_success_tx(commitment_txid_hex: str, htlc_output_index: int,
                            htlc_amount_sat: int,
                            commitment_keys,
                            to_self_delay: int, feerate_per_kw: int) -> str:
    """
    Create an unsigned HTLC success transaction.

    Version 2, nLockTime = 0, input sequence = 0.
    Single output: P2WSH of to_local_script.
    Output value = htlc_amount_sat - fee (fee = 703 * feerate_per_kw / 1000).

    Use commitment_keys.revocation_key and
    commitment_keys.local_delayed_payment_key for the to_local script.

    Args:
        commitment_txid_hex: txid of the commitment tx
        htlc_output_index: which output is the HTLC
        htlc_amount_sat: HTLC amount in satoshis
        commitment_keys: CommitmentKeys object with derived keys
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
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_htlc_success_tx(commitment_txid, 0, 1000, ck, 144, 0)
    assert isinstance(result, str), "Must return hex string"
    tx = bytes.fromhex(result)
    assert struct.unpack('<I', tx[0:4])[0] == 2, "Version must be 2"
    assert struct.unpack('<I', tx[-4:])[0] == 0, "Locktime must be 0"

def test_output_value_no_fee():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_htlc_success_tx(commitment_txid, 0, 1000, ck, 144, 0)
    tx = bytes.fromhex(result)
    out_value = struct.unpack('<q', tx[47:55])[0]
    assert out_value == 1000, f"Output value must be 1000 with zero fee, got {out_value}"

def test_p2wsh_output():
    commitment_txid = "2b887d4c1c59cd605144a1e2f971d168437db453f841f2fefb2c164f28ff84ab"
    rev_pk = bytes.fromhex("0212a140cd0c6539d07cd08dfe09984dec3251ea808b892efeac3ede9402bf2b19")
    delayed_pk = bytes.fromhex("03fd5960528dc152014952efdb702a88f71e3c1653b2314431701ec77e57fde83c")
    ck = CommitmentKeys(bytes(33), rev_pk, delayed_pk, bytes(33), bytes(33))
    result = create_htlc_success_tx(commitment_txid, 0, 1000, ck, 144, 0)
    tx = bytes.fromhex(result)
    script_len = tx[55]
    assert script_len == 34, f"Script must be 34 bytes (P2WSH), got {script_len}"
`,
    hints: {
      conceptual:
        "<p>Your goal is to build an unsigned HTLC success transaction. This is nearly identical to the HTLC timeout transaction with two differences: <code>nLockTime</code> is 0 (since success is not time-locked) and the fee weight constant is 703 instead of 663. It spends a received HTLC output and creates a P2WSH output locked to the to_local script. Use the same <code>create_to_local_script()</code> and P2WSH wrapping pattern as the timeout transaction, with keys from <code>commitment_keys</code>.</p>",
      steps:
        '<ol><li>Compute the fee using weight constant 703 and the provided feerate. Subtract from the HTLC amount to get the output value</li><li>Build the to_local witness script with <code>create_to_local_script()</code> using the revocation key and local delayed payment key from <code>commitment_keys</code>, plus the <code>to_self_delay</code></li><li>Wrap as P2WSH: hash the witness script with SHA256 and build a CScript with <code>OP_0</code> and the hash</li><li>Create a transaction input referencing the HTLC output from the commitment transaction, with <code>nSequence</code> set to 0</li><li>Create the output with the computed value and the P2WSH script</li><li>Build a <code>CMutableTransaction</code> with the input and output. The <code>nLockTime</code> is 0 (default). Serialize and return hex</li></ol>',
      code: `def create_htlc_success_tx(commitment_txid_hex, htlc_output_index, htlc_amount_sat,
                            commitment_keys,
                            to_self_delay, feerate_per_kw):
    fee = 703 * feerate_per_kw // 1000
    output_value = htlc_amount_sat - fee
    ws = create_to_local_script(commitment_keys.revocation_key, commitment_keys.local_delayed_payment_key, to_self_delay)
    p2wsh = CScript([OP_0, hashlib.sha256(bytes(ws)).digest()])

    txin = CTxIn(COutPoint(lx(commitment_txid_hex), htlc_output_index), nSequence=0)
    txout = CTxOut(output_value, p2wsh)
    tx = CMutableTransaction([txin], [txout])
    return tx.serialize().hex()`,
    },
    rewardSats: 21,
    group: "transactions/htlc",
    groupOrder: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 23 - Finalize HTLC Timeout Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-finalize-htlc-timeout": {
    id: "ln-exercise-finalize-htlc-timeout",
    title: "Exercise 22: Finalize HTLC Timeout Transaction",
    description:
      "Sign and finalize an HTLC timeout transaction using <code>ChannelKeyManager</code>. Derive the local HTLC private key with <code>derive_privkey(km.htlc_basepoint_secret, commitment_keys.per_commitment_point)</code>, then sign with <code>km.sign_input()</code>. Witness: <code>[empty, remote_sig, local_sig, empty, htlc_script]</code>.",
    starterCode: `def finalize_htlc_timeout(km, commitment_keys,
                          unsigned_tx_hex: str,
                          htlc_script: bytes,
                          htlc_amount: int,
                          remote_htlc_signature: bytes) -> str:
    """
    Sign and finalize an HTLC timeout transaction.

    Steps:
    1. Derive local HTLC private key:
       derive_privkey(km.htlc_basepoint_secret,
                      commitment_keys.per_commitment_point)
    2. Sign with km.sign_input() using the derived key
    3. Build witness: [empty, remote_sig, local_sig, empty, htlc_script]
       - First empty: OP_0 dummy for CHECKMULTISIG bug
       - Second empty: selects the timeout path
    4. Attach witness using CScriptWitness/CTxInWitness/CTxWitness

    Args:
        km: ChannelKeyManager
        commitment_keys: CommitmentKeys with per_commitment_point
        unsigned_tx_hex: hex of unsigned HTLC timeout tx
        htlc_script: the offered HTLC witness script
        htlc_amount: satoshi value of the HTLC output
        remote_htlc_signature: counterparty's DER sig + SIGHASH_ALL

    Returns:
        str: hex of signed segwit HTLC timeout transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
def test_returns_string():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    ck = CommitmentKeys(per_cp, bytes(33), bytes(33), bytes(33), bytes(33))
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a48848901000000000000000001d0070000000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80ef6010000"
    htlc_script = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac6702c800b175210214ccb63e0b1bcf27ca2c6c73e16f3d6a036a33a2b81e62ba5d78f66b4a19fc2fac68")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    result = finalize_htlc_timeout(km, ck, unsigned_tx, htlc_script, 2000, remote_sig)
    assert isinstance(result, str), "Must return hex string"
    signed = bytes.fromhex(result)
    assert signed[4:6] == b'\\x00\\x01', "Must include segwit marker (0x00, 0x01)"

def test_witness_items():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    ck = CommitmentKeys(per_cp, bytes(33), bytes(33), bytes(33), bytes(33))
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a48848901000000000000000001d0070000000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80ef6010000"
    htlc_script = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac6702c800b175210214ccb63e0b1bcf27ca2c6c73e16f3d6a036a33a2b81e62ba5d78f66b4a19fc2fac68")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    result = finalize_htlc_timeout(km, ck, unsigned_tx, htlc_script, 2000, remote_sig)
    signed = bytes.fromhex(result)
    assert b'\\x05' in signed, "Witness must have 5 items"
`,
    hints: {
      conceptual:
        "<p>Your goal is to sign and finalize an HTLC timeout transaction. You need the per-commitment HTLC private key, which is derived using <code>derive_privkey()</code> with <code>km.htlc_basepoint_secret</code> and <code>commitment_keys.per_commitment_point</code>. Sign with <code>km.sign_input()</code> using that derived key. The witness has 5 items: [empty (CHECKMULTISIG dummy), remote_sig, local_sig, empty (selects timeout path since it's 0 bytes), htlc_script]. Use <code>CScriptWitness</code>, <code>CTxInWitness</code>, and <code>CTxWitness</code> to construct and attach the witness.</p>",
      steps:
        '<ol><li>Derive the per-commitment HTLC private key using <code>derive_privkey()</code> with <code>km.htlc_basepoint_secret</code> and the per-commitment point from the commitment keys object</li><li>Convert the unsigned tx hex to bytes, then sign input 0 using <code>km.sign_input()</code> with the HTLC script (wrapped in <code>CScript</code>), the HTLC amount, and the derived HTLC private key</li><li>Deserialize the transaction bytes into a <code>CTransaction</code></li><li>Build the witness with 5 items: empty bytes (CHECKMULTISIG bug workaround), the remote HTLC signature, the local signature you just computed, empty bytes (this 0-length element selects the timeout path in the script), and the HTLC script</li><li>Wrap in <code>CTxInWitness</code> and <code>CTxWitness</code>, create a mutable transaction copy, attach the witness, serialize and return hex</li></ol>',
      code: `def finalize_htlc_timeout(km, commitment_keys, unsigned_tx_hex, htlc_script,
                          htlc_amount, remote_htlc_signature):
    local_htlc_privkey = derive_privkey(km.htlc_basepoint_secret,
                                         commitment_keys.per_commitment_point)
    tx_bytes = bytes.fromhex(unsigned_tx_hex)
    local_sig = km.sign_input(tx_bytes, 0, CScript(htlc_script), htlc_amount,
                               local_htlc_privkey)

    tx = CTransaction.deserialize(tx_bytes)
    witness = CScriptWitness([b'', remote_htlc_signature, local_sig, b'', htlc_script])
    in_witness = CTxInWitness(witness)
    tx_witness = CTxWitness([in_witness])

    mtx = CMutableTransaction.from_tx(tx)
    mtx.wit = tx_witness
    return mtx.serialize().hex()`,
    },
    rewardSats: 42,
    group: "transactions/htlc",
    groupOrder: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXERCISE 24 - Finalize HTLC Success Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  "ln-exercise-finalize-htlc-success": {
    id: "ln-exercise-finalize-htlc-success",
    title: "Exercise 23: Finalize HTLC Success Transaction",
    description:
      "Sign and finalize an HTLC success transaction using <code>ChannelKeyManager</code>. Same signing pattern as the HTLC timeout exercise, but the witness includes the <code>payment_preimage</code> instead of an empty element: <code>[empty, remote_sig, local_sig, preimage, htlc_script]</code>.",
    starterCode: `def finalize_htlc_success(km, commitment_keys,
                          unsigned_tx_hex: str,
                          htlc_script: bytes,
                          htlc_amount: int,
                          remote_htlc_signature: bytes,
                          payment_preimage: bytes) -> str:
    """
    Sign and finalize an HTLC success transaction.

    Steps:
    1. Derive local HTLC private key:
       derive_privkey(km.htlc_basepoint_secret,
                      commitment_keys.per_commitment_point)
    2. Sign with km.sign_input() using the derived key
    3. Build witness: [empty, remote_sig, local_sig, preimage, htlc_script]
       - empty: OP_0 dummy for CHECKMULTISIG bug
       - preimage: 32-byte payment preimage (selects success path)
    4. Attach witness using CScriptWitness/CTxInWitness/CTxWitness

    Args:
        km: ChannelKeyManager
        commitment_keys: CommitmentKeys with per_commitment_point
        unsigned_tx_hex: hex of unsigned HTLC success tx
        htlc_script: the received HTLC witness script
        htlc_amount: satoshi value of the HTLC output
        remote_htlc_signature: counterparty's DER sig + SIGHASH_ALL
        payment_preimage: 32-byte preimage that hashes to payment_hash

    Returns:
        str: hex of signed segwit HTLC success transaction
    """
    # === YOUR CODE HERE ===
    pass
`,
    testCode: `
def test_returns_string():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    ck = CommitmentKeys(per_cp, bytes(33), bytes(33), bytes(33), bytes(33))
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a48848901000000000000000001d0070000000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80e00000000"
    htlc_script = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac6702c800b175210214ccb63e0b1bcf27ca2c6c73e16f3d6a036a33a2b81e62ba5d78f66b4a19fc2fac68")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    preimage = bytes(32)
    result = finalize_htlc_success(km, ck, unsigned_tx, htlc_script, 2000, remote_sig, preimage)
    assert isinstance(result, str), "Must return hex string"
    signed = bytes.fromhex(result)
    assert signed[4:6] == b'\\x00\\x01', "Must include segwit marker"

def test_witness_contains_preimage():
    seed = bytes([0x01] * 32)
    km = ChannelKeyManager(seed)
    per_cp = bytes.fromhex("025f7117a78150fe2ef97db7cfc83bd57b2e2c0d0dd25eaf467a4a1c2a45ce1486")
    ck = CommitmentKeys(per_cp, bytes(33), bytes(33), bytes(33), bytes(33))
    unsigned_tx = "0200000001bef67e4e2fb9ddeeb3461973cd4c62abb35050b1add772995b820b584a48848901000000000000000001d0070000000000002200204adb4e2f00643db396dd120d4e7dc17625f5f2c11a40d857accc862d6b7dd80e00000000"
    htlc_script = bytes.fromhex("76a91414011f7254d96b819c76986c277d115efce6f7b58763ac6702c800b175210214ccb63e0b1bcf27ca2c6c73e16f3d6a036a33a2b81e62ba5d78f66b4a19fc2fac68")
    remote_sig = bytes.fromhex("3045022100c3127b33dcc741dd6b05b1e63cbd1a9a7d816f37af9b6756fa2376b056f032370220408b96279808fe57eb7e463710804cdf4f108388bc5cf722d8c848d2c7f9f3b001")
    preimage = bytes.fromhex("0102030405060708091011121314151617181920212223242526272829303132")
    result = finalize_htlc_success(km, ck, unsigned_tx, htlc_script, 2000, remote_sig, preimage)
    signed = bytes.fromhex(result)
    assert b'\\x05' in signed, "Witness must have 5 items"
    assert preimage in signed, "Witness must contain the payment preimage"
`,
    hints: {
      conceptual:
        "<p>Your goal is to sign and finalize an HTLC success transaction. The process is identical to the HTLC timeout finalization except for one witness element: instead of empty bytes for the path selector, you provide the 32-byte <code>payment_preimage</code>. Because the preimage is exactly 32 bytes, the OP_SIZE check in the HTLC script evaluates to true, directing execution to the success (preimage) path. Use the same key derivation (<code>derive_privkey()</code>) and signing (<code>km.sign_input()</code>) pattern as the timeout version.</p>",
      steps:
        '<ol><li>Derive the per-commitment HTLC private key using <code>derive_privkey()</code> with <code>km.htlc_basepoint_secret</code> and the per-commitment point from the commitment keys</li><li>Convert the unsigned tx hex to bytes, then sign input 0 using <code>km.sign_input()</code> with the HTLC script (wrapped in <code>CScript</code>), the HTLC amount, and the derived key</li><li>Deserialize the transaction bytes into a <code>CTransaction</code></li><li>Build the witness with 5 items: empty bytes (CHECKMULTISIG dummy), remote HTLC signature, local signature, the <code>payment_preimage</code> (this 32-byte element selects the success path), and the HTLC script</li><li>Wrap in <code>CTxInWitness</code> and <code>CTxWitness</code>, create a mutable transaction copy, attach the witness, serialize and return hex</li></ol>',
      code: `def finalize_htlc_success(km, commitment_keys, unsigned_tx_hex, htlc_script,
                          htlc_amount, remote_htlc_signature, payment_preimage):
    local_htlc_privkey = derive_privkey(km.htlc_basepoint_secret,
                                         commitment_keys.per_commitment_point)
    tx_bytes = bytes.fromhex(unsigned_tx_hex)
    local_sig = km.sign_input(tx_bytes, 0, CScript(htlc_script), htlc_amount,
                               local_htlc_privkey)

    tx = CTransaction.deserialize(tx_bytes)
    witness = CScriptWitness([b'', remote_htlc_signature, local_sig, payment_preimage, htlc_script])
    in_witness = CTxInWitness(witness)
    tx_witness = CTxWitness([in_witness])

    mtx = CMutableTransaction.from_tx(tx)
    mtx.wit = tx_witness
    return mtx.serialize().hex()`,
    },
    rewardSats: 42,
    group: "transactions/htlc",
    groupOrder: 4,
  },

};
