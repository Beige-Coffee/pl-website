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
