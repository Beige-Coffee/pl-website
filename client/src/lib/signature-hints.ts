/**
 * Static signature registry for Python function parameter hints.
 *
 * Maps function names (as they appear in student code) to their signatures
 * and one-line descriptions. Used by the signature-hint CodeMirror extension
 * to show a popup when the student types `(` after a function name.
 */

export interface ParamDetail {
  name: string;        // Parameter name (e.g. "script")
  description: string; // What this parameter is
}

export interface SignatureInfo {
  name: string;              // Display name
  params: string;            // e.g. "(script, txTo, inIdx, hashtype)"
  description: string;       // One-line summary
  paramDetails?: ParamDetail[]; // Per-parameter descriptions
}

// ─── Static Registry ──────────────────────────────────────────────────────────

const SIGNATURES: Record<string, SignatureInfo> = {
  // ── python-bitcoinlib ─────────────────────────────────────────────────────
  CScript: {
    name: "CScript",
    params: "(iterable_or_bytes)",
    description: "Create a Bitcoin script from opcodes or raw bytes",
    paramDetails: [
      { name: "iterable_or_bytes", description: "List of opcodes/bytes, or raw script bytes" },
    ],
  },
  CTxIn: {
    name: "CTxIn",
    params: "(prevout, scriptSig, nSequence)",
    description: "Create a transaction input",
    paramDetails: [
      { name: "prevout", description: "COutPoint referencing the UTXO to spend" },
      { name: "scriptSig", description: "Unlocking script (empty for segwit)" },
      { name: "nSequence", description: "Sequence number (default 0xffffffff)" },
    ],
  },
  CTxOut: {
    name: "CTxOut",
    params: "(nValue, scriptPubKey)",
    description: "Create a transaction output with value in satoshis",
    paramDetails: [
      { name: "nValue", description: "Output value in satoshis" },
      { name: "scriptPubKey", description: "CScript locking script" },
    ],
  },
  COutPoint: {
    name: "COutPoint",
    params: "(hash, n)",
    description: "Reference to a specific output of a previous transaction",
    paramDetails: [
      { name: "hash", description: "32-byte txid (use lx() to convert hex)" },
      { name: "n", description: "Output index in the transaction" },
    ],
  },
  CMutableTransaction: {
    name: "CMutableTransaction",
    params: "(vin, vout, nLockTime, nVersion, witness)",
    description: "Create a mutable (modifiable) Bitcoin transaction",
    paramDetails: [
      { name: "vin", description: "List of CTxIn inputs" },
      { name: "vout", description: "List of CTxOut outputs" },
      { name: "nLockTime", description: "Lock time (default 0)" },
      { name: "nVersion", description: "Transaction version (default 2)" },
      { name: "witness", description: "CTxWitness (optional)" },
    ],
  },
  "CTransaction.deserialize": {
    name: "CTransaction.deserialize",
    params: "(f)",
    description: "Deserialize a transaction from raw bytes",
    paramDetails: [
      { name: "f", description: "Raw transaction bytes" },
    ],
  },
  "CMutableTransaction.from_tx": {
    name: "CMutableTransaction.from_tx",
    params: "(tx)",
    description: "Create a mutable transaction from an immutable one",
    paramDetails: [
      { name: "tx", description: "CTransaction to make mutable" },
    ],
  },
  SignatureHash: {
    name: "SignatureHash",
    params: "(script, txTo, inIdx, hashtype, amount, sigversion)",
    description: "Compute the signature hash for a transaction input",
    paramDetails: [
      { name: "script", description: "Witness script (e.g. funding script)" },
      { name: "txTo", description: "The transaction being signed" },
      { name: "inIdx", description: "Index of the input being signed" },
      { name: "hashtype", description: "SIGHASH flag (e.g. SIGHASH_ALL)" },
      { name: "amount", description: "Value in satoshis of the input being spent (required for segwit)" },
      { name: "sigversion", description: "SIGVERSION_WITNESS_V0 for segwit" },
    ],
  },
  lx: {
    name: "lx",
    params: "(hex_string)",
    description: "Convert a little-endian hex string to bytes",
    paramDetails: [
      { name: "hex_string", description: "Hex string in display (big-endian) order" },
    ],
  },
  CTxWitness: {
    name: "CTxWitness",
    params: "(vtxinwit)",
    description: "Create a transaction witness structure",
    paramDetails: [
      { name: "vtxinwit", description: "Tuple/list of CTxInWitness, one per input" },
    ],
  },
  CTxInWitness: {
    name: "CTxInWitness",
    params: "(scriptWitness)",
    description: "Create a witness for a single transaction input",
    paramDetails: [
      { name: "scriptWitness", description: "CScriptWitness containing the witness stack" },
    ],
  },
  CScriptWitness: {
    name: "CScriptWitness",
    params: "(stack)",
    description: "Create a script witness (witness stack items)",
    paramDetails: [
      { name: "stack", description: "Tuple/list of bytes items pushed onto witness stack" },
    ],
  },

  // ── ecdsa library ─────────────────────────────────────────────────────────
  "SigningKey.from_string": {
    name: "SigningKey.from_string",
    params: "(string, curve)",
    description: "Create a signing key from a raw 32-byte private key",
    paramDetails: [
      { name: "string", description: "32-byte raw private key" },
      { name: "curve", description: "Elliptic curve (e.g. SECP256k1)" },
    ],
  },
  ".sign_digest": {
    name: "sign_digest",
    params: "(digest, sigencode, hashfunc)",
    description: "Sign a pre-computed hash digest",
    paramDetails: [
      { name: "digest", description: "32-byte hash to sign" },
      { name: "sigencode", description: "Encoding function (e.g. sigencode_der_canonize)" },
      { name: "hashfunc", description: "Hash function override (optional)" },
    ],
  },
  sigencode_der_canonize: {
    name: "sigencode_der_canonize",
    params: "(r, s, order)",
    description: "DER-encode a signature with low-S canonicalization",
    paramDetails: [
      { name: "r", description: "Signature r component" },
      { name: "s", description: "Signature s component" },
      { name: "order", description: "Curve order" },
    ],
  },

  // ── ln module (project-specific) ──────────────────────────────────────────
  privkey_to_pubkey: {
    name: "privkey_to_pubkey",
    params: "(privkey_bytes)",
    description: "Derive compressed public key from a 32-byte private key",
    paramDetails: [
      { name: "privkey_bytes", description: "32-byte raw private key" },
    ],
  },
  hash160: {
    name: "hash160",
    params: "(data)",
    description: "RIPEMD160(SHA256(data))",
    paramDetails: [
      { name: "data", description: "Bytes to hash" },
    ],
  },
  pubkey_to_point: {
    name: "pubkey_to_point",
    params: "(compressed_pubkey)",
    description: "Convert a 33-byte compressed public key to an elliptic curve Point for math operations",
    paramDetails: [
      { name: "compressed_pubkey", description: "33-byte SEC1 compressed public key" },
    ],
  },
  point_to_pubkey: {
    name: "point_to_pubkey",
    params: "(point)",
    description: "Convert an elliptic curve Point back to a 33-byte compressed public key",
    paramDetails: [
      { name: "point", description: "ecdsa.VerifyingKey point (uncompressed)" },
    ],
  },
  "BIP32.from_seed": {
    name: "BIP32.from_seed",
    params: "(seed_bytes)",
    description: "Create a BIP32 HD key from a seed",
    paramDetails: [
      { name: "seed_bytes", description: "16-64 byte seed (often 32 bytes)" },
    ],
  },
  ".get_privkey_from_path": {
    name: "get_privkey_from_path",
    params: "(path)",
    description: "Derive a private key from an HD derivation path",
    paramDetails: [
      { name: "path", description: "BIP32 path string, e.g. \"m/0'/1\"" },
    ],
  },
  ".get_pubkey_from_path": {
    name: "get_pubkey_from_path",
    params: "(path)",
    description: "Derive a public key from an HD derivation path",
    paramDetails: [
      { name: "path", description: "BIP32 path string, e.g. \"m/0'/1\"" },
    ],
  },
  CommitmentKeys: {
    name: "CommitmentKeys",
    params: "(per_commitment_point, revocation_key, local_delayed_payment_key, local_htlc_key, remote_htlc_key)",
    description: "Data container for the 5 per-commitment keys in a commitment transaction",
    paramDetails: [
      { name: "per_commitment_point", description: "33-byte per-commitment point" },
      { name: "revocation_key", description: "33-byte revocation public key" },
      { name: "local_delayed_payment_key", description: "33-byte local delayed payment key" },
      { name: "local_htlc_key", description: "33-byte local HTLC key" },
      { name: "remote_htlc_key", description: "33-byte remote HTLC key" },
    ],
  },
  // ── ChannelKeyManager methods ────────────────────────────────────────────
  ".build_commitment_secret": {
    name: "build_commitment_secret",
    params: "(per_commitment_index)",
    description: "Derive a 32-byte per-commitment secret using BOLT's descending shachain index",
    paramDetails: [
      { name: "per_commitment_index", description: "Descending BOLT shachain index (int)" },
    ],
  },
  ".derive_per_commitment_point": {
    name: "derive_per_commitment_point",
    params: "(commitment_number)",
    description: "Derive the per-commitment point for a channel state by converting to the descending shachain index",
    paramDetails: [
      { name: "commitment_number", description: "Ascending channel state number (int)" },
    ],
  },
  ".get_commitment_keys": {
    name: "get_commitment_keys",
    params: "(commitment_number, remote_revocation_basepoint, remote_htlc_basepoint)",
    description: "Derive all 5 per-commitment keys and return a CommitmentKeys object",
    paramDetails: [
      { name: "commitment_number", description: "Channel state index (int)" },
      { name: "remote_revocation_basepoint", description: "Remote party's revocation basepoint (33 bytes)" },
      { name: "remote_htlc_basepoint", description: "Remote party's HTLC basepoint (33 bytes)" },
    ],
  },
  ".sign_input": {
    name: "sign_input",
    params: "(tx_bytes, input_index, script, amount, secret_key)",
    description: "Create a SegWit v0 signature for a transaction input",
    paramDetails: [
      { name: "tx_bytes", description: "Raw transaction bytes (deserialized internally)" },
      { name: "input_index", description: "Index of the input to sign" },
      { name: "script", description: "The witness script (raw bytes)" },
      { name: "amount", description: "Value of the output being spent (satoshis)" },
      { name: "secret_key", description: "32-byte private key" },
    ],
  },
  // ── Lightning exercise functions ─────────────────────────────────────────
  create_funding_script: {
    name: "create_funding_script",
    params: "(pubkey1, pubkey2)",
    description: "Create a 2-of-2 multisig funding script with lexicographically sorted pubkeys",
    paramDetails: [
      { name: "pubkey1", description: "33-byte compressed public key" },
      { name: "pubkey2", description: "33-byte compressed public key" },
    ],
  },
  create_funding_tx: {
    name: "create_funding_tx",
    params: "(input_txid, input_vout, funding_amount, pubkey1, pubkey2)",
    description: "Create a funding transaction spending a UTXO into a P2WSH 2-of-2 multisig",
    paramDetails: [
      { name: "input_txid", description: "32-byte txid in internal byte order" },
      { name: "input_vout", description: "Output index of the UTXO to spend" },
      { name: "funding_amount", description: "Channel funding amount in satoshis" },
      { name: "pubkey1", description: "33-byte compressed public key (opener)" },
      { name: "pubkey2", description: "33-byte compressed public key (acceptor)" },
    ],
  },
  derive_revocation_privkey: {
    name: "derive_revocation_privkey",
    params: "(revocation_basepoint_secret, per_commitment_secret, revocation_basepoint, per_commitment_point)",
    description: "Derive the revocation private key using BOLT 3 two-party scalar formula",
    paramDetails: [
      { name: "revocation_basepoint_secret", description: "32-byte revocation basepoint private key" },
      { name: "per_commitment_secret", description: "32-byte per-commitment secret" },
      { name: "revocation_basepoint", description: "33-byte revocation basepoint public key" },
      { name: "per_commitment_point", description: "33-byte per-commitment point" },
    ],
  },
  create_to_remote_script: {
    name: "create_to_remote_script",
    params: "(remote_pubkey)",
    description: "Create a P2WPKH script for the to_remote output",
    paramDetails: [
      { name: "remote_pubkey", description: "33-byte compressed remote payment key" },
    ],
  },
  create_to_local_script: {
    name: "create_to_local_script",
    params: "(revocation_pubkey, local_delayedpubkey, to_self_delay)",
    description: "Create a revocable script for the to_local output with CSV delay",
    paramDetails: [
      { name: "revocation_pubkey", description: "33-byte revocation public key" },
      { name: "local_delayedpubkey", description: "33-byte local delayed payment key" },
      { name: "to_self_delay", description: "CSV delay in blocks (e.g. 144)" },
    ],
  },
  get_obscure_factor: {
    name: "get_obscure_factor",
    params: "(opener_payment_basepoint, accepter_payment_basepoint)",
    description: "Compute the 6-byte obscuring factor for commitment numbers",
    paramDetails: [
      { name: "opener_payment_basepoint", description: "33-byte opener payment basepoint" },
      { name: "accepter_payment_basepoint", description: "33-byte accepter payment basepoint" },
    ],
  },
  set_obscured_commitment_number: {
    name: "set_obscured_commitment_number",
    params: "(tx, commitment_number, obscure_factor)",
    description: "Encode the obscured commitment number into locktime and sequence fields",
    paramDetails: [
      { name: "tx", description: "CMutableTransaction to modify in-place" },
      { name: "commitment_number", description: "Channel state number (int)" },
      { name: "obscure_factor", description: "6-byte obscuring factor" },
    ],
  },
  create_commitment_outputs: {
    name: "create_commitment_outputs",
    params: "(to_local_sat, to_remote_sat, commitment_keys, to_self_delay, dust_limit_sat)",
    description: "Create to_local and to_remote outputs, filtering dust",
    paramDetails: [
      { name: "to_local_sat", description: "Local balance in satoshis" },
      { name: "to_remote_sat", description: "Remote balance in satoshis" },
      { name: "commitment_keys", description: "CommitmentKeys with derived keys" },
      { name: "to_self_delay", description: "CSV delay in blocks" },
      { name: "dust_limit_sat", description: "Dust threshold in satoshis" },
    ],
  },
  sort_outputs: {
    name: "sort_outputs",
    params: "(outputs)",
    description: "Sort transaction outputs by value, then script, then cltv_expiry (BIP 69 + BOLT 3)",
    paramDetails: [
      { name: "outputs", description: "List of dicts with 'output', 'cltv_expiry' keys" },
    ],
  },
  create_commitment_tx: {
    name: "create_commitment_tx",
    params: "(funding_txid, funding_vout, to_local_sat, to_remote_sat, ...)",
    description: "Create an unsigned commitment transaction with channel and HTLC outputs",
    paramDetails: [
      { name: "funding_txid", description: "32-byte funding txid in internal byte order" },
      { name: "funding_vout", description: "Funding output index" },
      { name: "to_local_sat", description: "Local balance in satoshis" },
      { name: "to_remote_sat", description: "Remote balance in satoshis" },
    ],
  },
  finalize_commitment_tx: {
    name: "finalize_commitment_tx",
    params: "(km, unsigned_tx, funding_script, funding_amount, remote_signature, is_local_initiator)",
    description: "Add the 2-of-2 multisig witness to finalize a commitment transaction",
    paramDetails: [
      { name: "km", description: "ChannelKeyManager instance" },
      { name: "unsigned_tx", description: "Raw unsigned commitment tx bytes" },
      { name: "funding_script", description: "Funding script bytes (for sighash)" },
      { name: "funding_amount", description: "Funding output value in satoshis" },
      { name: "remote_signature", description: "Remote party's DER signature bytes" },
      { name: "is_local_initiator", description: "True if local party is channel opener" },
    ],
  },
  create_htlc_outputs: {
    name: "create_htlc_outputs",
    params: "(commitment_keys, offered_htlcs, received_htlcs)",
    description: "Create P2WSH outputs for offered and received HTLCs",
    paramDetails: [
      { name: "commitment_keys", description: "CommitmentKeys with HTLC keys" },
      { name: "offered_htlcs", description: "List of offered HTLC dicts with amount_msat, payment_hash, cltv_expiry" },
      { name: "received_htlcs", description: "List of received HTLC dicts with amount_msat, payment_hash, cltv_expiry" },
    ],
  },
  create_offered_htlc_script: {
    name: "create_offered_htlc_script",
    params: "(commitment_keys, payment_hash)",
    description: "Create the witness script for an offered HTLC output (BOLT 3)",
    paramDetails: [
      { name: "commitment_keys", description: "CommitmentKeys with revocation, local_htlc, remote_htlc keys" },
      { name: "payment_hash", description: "20-byte RIPEMD160(SHA256(preimage)) payment hash" },
    ],
  },
  create_received_htlc_script: {
    name: "create_received_htlc_script",
    params: "(commitment_keys, payment_hash, cltv_expiry)",
    description: "Create the witness script for a received HTLC output (BOLT 3)",
    paramDetails: [
      { name: "commitment_keys", description: "CommitmentKeys with revocation, local_htlc, remote_htlc keys" },
      { name: "payment_hash", description: "20-byte RIPEMD160(SHA256(preimage)) payment hash" },
      { name: "cltv_expiry", description: "Absolute block height for HTLC timeout" },
    ],
  },
  create_htlc_timeout_tx: {
    name: "create_htlc_timeout_tx",
    params: "(commitment_txid, htlc_output_index, htlc_amount_sat, cltv_expiry, commitment_keys, to_self_delay, feerate_per_kw)",
    description: "Create an unsigned HTLC-timeout second-stage transaction",
    paramDetails: [
      { name: "commitment_txid", description: "32-byte commitment txid in internal byte order" },
      { name: "htlc_output_index", description: "Index of the HTLC output in the commitment tx" },
      { name: "htlc_amount_sat", description: "HTLC value in satoshis" },
      { name: "cltv_expiry", description: "Locktime for the timeout (block height)" },
      { name: "commitment_keys", description: "CommitmentKeys for the output script" },
      { name: "to_self_delay", description: "CSV delay in blocks" },
      { name: "feerate_per_kw", description: "Fee rate in satoshis per kilo-weight unit" },
    ],
  },
  create_htlc_success_tx: {
    name: "create_htlc_success_tx",
    params: "(commitment_txid, htlc_output_index, htlc_amount_sat, commitment_keys, to_self_delay, feerate_per_kw)",
    description: "Create an unsigned HTLC-success second-stage transaction",
    paramDetails: [
      { name: "commitment_txid", description: "32-byte commitment txid in internal byte order" },
      { name: "htlc_output_index", description: "Index of the HTLC output in the commitment tx" },
      { name: "htlc_amount_sat", description: "HTLC value in satoshis" },
      { name: "commitment_keys", description: "CommitmentKeys for the output script" },
      { name: "to_self_delay", description: "CSV delay in blocks" },
      { name: "feerate_per_kw", description: "Fee rate in satoshis per kilo-weight unit" },
    ],
  },
  finalize_htlc_timeout: {
    name: "finalize_htlc_timeout",
    params: "(km, commitment_keys, unsigned_tx, htlc_script, htlc_amount, remote_htlc_signature)",
    description: "Add the witness to finalize an HTLC-timeout transaction",
    paramDetails: [
      { name: "km", description: "ChannelKeyManager instance" },
      { name: "commitment_keys", description: "CommitmentKeys for signing" },
      { name: "unsigned_tx", description: "Raw unsigned HTLC-timeout tx bytes" },
      { name: "htlc_script", description: "HTLC witness script bytes" },
      { name: "htlc_amount", description: "HTLC output value in satoshis" },
      { name: "remote_htlc_signature", description: "Remote party's HTLC signature bytes" },
    ],
  },
  finalize_htlc_success: {
    name: "finalize_htlc_success",
    params: "(km, commitment_keys, unsigned_tx, htlc_script, htlc_amount, remote_htlc_signature, payment_preimage)",
    description: "Add the witness to finalize an HTLC-success transaction",
    paramDetails: [
      { name: "km", description: "ChannelKeyManager instance" },
      { name: "commitment_keys", description: "CommitmentKeys for signing" },
      { name: "unsigned_tx", description: "Raw unsigned HTLC-success tx bytes" },
      { name: "htlc_script", description: "HTLC witness script bytes" },
      { name: "htlc_amount", description: "HTLC output value in satoshis" },
      { name: "remote_htlc_signature", description: "Remote party's HTLC signature bytes" },
      { name: "payment_preimage", description: "32-byte payment preimage" },
    ],
  },
  // ── Key derivation functions ─────────────────────────────────────────────
  derive_pubkey: {
    name: "derive_pubkey",
    params: "(basepoint, per_commitment_point)",
    description: "Derive a per-commitment public key from a basepoint (BOLT 3)",
    paramDetails: [
      { name: "basepoint", description: "33-byte compressed basepoint public key" },
      { name: "per_commitment_point", description: "33-byte compressed per-commitment point" },
    ],
  },
  derive_privkey: {
    name: "derive_privkey",
    params: "(basepoint_secret, per_commitment_point)",
    description: "Derive a per-commitment private key from a basepoint secret (BOLT 3)",
    paramDetails: [
      { name: "basepoint_secret", description: "32-byte basepoint private key" },
      { name: "per_commitment_point", description: "33-byte compressed per-commitment point" },
    ],
  },
  derive_revocation_pubkey: {
    name: "derive_revocation_pubkey",
    params: "(revocation_basepoint, per_commitment_point)",
    description: "Derive a revocation public key using the BOLT 3 two-party formula",
    paramDetails: [
      { name: "revocation_basepoint", description: "Remote party's revocation basepoint (33 bytes)" },
      { name: "per_commitment_point", description: "33-byte compressed per-commitment point" },
    ],
  },

  // ── cryptography library (Noise tutorial) ─────────────────────────────────
  "ec.generate_private_key": {
    name: "ec.generate_private_key",
    params: "(curve)",
    description: "Generate a random private key on the given elliptic curve",
    paramDetails: [
      { name: "curve", description: "Curve instance, e.g. ec.SECP256K1()" },
    ],
  },
  "ec.derive_private_key": {
    name: "ec.derive_private_key",
    params: "(private_value, curve)",
    description: "Create a private key from an integer value",
    paramDetails: [
      { name: "private_value", description: "Integer private key value" },
      { name: "curve", description: "Curve instance, e.g. ec.SECP256K1()" },
    ],
  },
  "ec.SECP256K1": {
    name: "ec.SECP256K1",
    params: "()",
    description: "The secp256k1 elliptic curve (used by Bitcoin)",
  },
  "ec.EllipticCurvePublicKey.from_encoded_point": {
    name: "EllipticCurvePublicKey.from_encoded_point",
    params: "(curve, data)",
    description: "Load a public key from SEC1 encoded point bytes",
    paramDetails: [
      { name: "curve", description: "Curve instance, e.g. ec.SECP256K1()" },
      { name: "data", description: "SEC1 encoded point (33 or 65 bytes)" },
    ],
  },
  ".exchange": {
    name: "exchange",
    params: "(algorithm, peer_public_key)",
    description: "Perform ECDH key exchange, returns shared secret bytes",
    paramDetails: [
      { name: "algorithm", description: "ec.ECDH() instance" },
      { name: "peer_public_key", description: "The other party's public key" },
    ],
  },
  ".public_bytes": {
    name: "public_bytes",
    params: "(encoding, format)",
    description: "Serialize a public key to bytes",
    paramDetails: [
      { name: "encoding", description: "Encoding.X962 for raw point" },
      { name: "format", description: "PublicFormat.CompressedPoint or UncompressedPoint" },
    ],
  },
  ".public_key": {
    name: "public_key",
    params: "()",
    description: "Get the public key from a private key",
  },

  // ── Standard library ──────────────────────────────────────────────────────
  "hashlib.sha256": {
    name: "hashlib.sha256",
    params: "(data=b'')",
    description: "Create a SHA-256 hash object",
    paramDetails: [
      { name: "data", description: "Initial bytes to hash (optional)" },
    ],
  },
  "hashlib.new": {
    name: "hashlib.new",
    params: "(name, data=b'')",
    description: "Create a new hash object by algorithm name",
    paramDetails: [
      { name: "name", description: "Algorithm name string, e.g. \"ripemd160\"" },
      { name: "data", description: "Initial bytes to hash (optional)" },
    ],
  },
  "hmac.new": {
    name: "hmac.new",
    params: "(key, msg, digestmod)",
    description: "Create a new HMAC object for message authentication",
    paramDetails: [
      { name: "key", description: "Secret key bytes" },
      { name: "msg", description: "Initial message bytes (optional)" },
      { name: "digestmod", description: "Hash algorithm, e.g. hashlib.sha256" },
    ],
  },
  "struct.pack": {
    name: "struct.pack",
    params: "(format, *values)",
    description: "Pack values into a bytes object according to format string",
    paramDetails: [
      { name: "format", description: "Format string (e.g. \">Q\" for big-endian uint64)" },
      { name: "*values", description: "Values to pack" },
    ],
  },
  "struct.unpack": {
    name: "struct.unpack",
    params: "(format, buffer)",
    description: "Unpack bytes according to format string, returns tuple",
    paramDetails: [
      { name: "format", description: "Format string (e.g. \">Q\" for big-endian uint64)" },
      { name: "buffer", description: "Bytes to unpack" },
    ],
  },
  "int.from_bytes": {
    name: "int.from_bytes",
    params: "(bytes, byteorder, *, signed=False)",
    description: "Create an integer from bytes",
    paramDetails: [
      { name: "bytes", description: "Bytes to convert" },
      { name: "byteorder", description: "\"big\" or \"little\" endian" },
      { name: "signed", description: "Treat as signed integer (default False)" },
    ],
  },
  ".to_bytes": {
    name: "to_bytes",
    params: "(length, byteorder, *, signed=False)",
    description: "Convert integer to bytes of given length",
    paramDetails: [
      { name: "length", description: "Number of bytes in the output" },
      { name: "byteorder", description: "\"big\" or \"little\" endian" },
      { name: "signed", description: "Use signed representation (default False)" },
    ],
  },
  ".hex": {
    name: "hex",
    params: "()",
    description: "Return the hexadecimal representation as a string",
  },
  ".digest": {
    name: "digest",
    params: "()",
    description: "Return the hash/HMAC digest as bytes",
  },
  ".hexdigest": {
    name: "hexdigest",
    params: "()",
    description: "Return the hash/HMAC digest as a hex string",
  },
  ".update": {
    name: "update",
    params: "(data)",
    description: "Update the hash/HMAC object with more data",
    paramDetails: [
      { name: "data", description: "Additional bytes to feed into the hash" },
    ],
  },
  "bytes.fromhex": {
    name: "bytes.fromhex",
    params: "(hex_string)",
    description: "Create bytes from a hexadecimal string",
    paramDetails: [
      { name: "hex_string", description: "Hex string (no 0x prefix)" },
    ],
  },
  len: {
    name: "len",
    params: "(obj)",
    description: "Return the number of items in a container",
  },
  range: {
    name: "range",
    params: "(stop) or (start, stop, step=1)",
    description: "Create an immutable sequence of numbers",
  },
  print: {
    name: "print",
    params: "(*objects, sep=' ', end='\\n')",
    description: "Print objects to stdout",
  },
  isinstance: {
    name: "isinstance",
    params: "(object, classinfo)",
    description: "Check if an object is an instance of a class",
  },
  enumerate: {
    name: "enumerate",
    params: "(iterable, start=0)",
    description: "Return an enumerate object yielding (index, item) pairs",
  },
};

// ─── Lookup Strategies ────────────────────────────────────────────────────────

// Pre-built index for method lookups (keys starting with ".")
const METHOD_INDEX = new Map<string, SignatureInfo>();
for (const [key, info] of Object.entries(SIGNATURES)) {
  if (key.startsWith(".")) {
    METHOD_INDEX.set(key, info);
  }
}

/**
 * Look up a function signature by name. Tries three strategies:
 * 1. Exact match: "SignatureHash" → hit
 * 2. Qualified match: "hashlib.sha256" → hit
 * 3. Method match: "sk.sign_digest" → look up ".sign_digest" → hit
 */
export function lookupSignature(name: string): SignatureInfo | null {
  // 1. Exact match
  if (SIGNATURES[name]) return SIGNATURES[name];

  // 2. Qualified match (the name itself might be "hashlib.sha256")
  // Already covered by exact match above

  // 3. Method match: extract the last ".method" part
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx >= 0) {
    const methodKey = name.slice(dotIdx); // e.g. ".sign_digest"
    const found = METHOD_INDEX.get(methodKey);
    if (found) return found;
  }

  return null;
}

// ─── Python Keywords (skip these) ─────────────────────────────────────────────

const PYTHON_KEYWORDS = new Set([
  "if", "elif", "else", "for", "while", "with", "try", "except", "finally",
  "def", "class", "return", "yield", "import", "from", "as", "pass", "break",
  "continue", "raise", "del", "assert", "lambda", "not", "and", "or", "in",
  "is", "global", "nonlocal", "async", "await",
]);

export function isPythonKeyword(word: string): boolean {
  return PYTHON_KEYWORDS.has(word);
}
