/**
 * Pyodide-powered autocomplete for CodeMirror.
 *
 * Provides a CodeMirror CompletionSource that queries live Pyodide
 * introspection (via `dir()`) when the student types `.` after an object.
 * Falls back to static completions for common modules while Pyodide loads.
 */

import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { execPythonSilent, getPythonCompletions, isWorkerCreated } from "./pyodide-runner";

// ─── Static fallback completions (available instantly, before Pyodide loads) ─

const STATIC_COMPLETIONS: Record<string, Completion[]> = {
  // ── Module-level completions ───────────────────────────────────────────
  hashlib: [
    { label: "sha256", type: "function" },
    { label: "sha512", type: "function" },
    { label: "sha1", type: "function" },
    { label: "md5", type: "function" },
    { label: "new", type: "function" },
    { label: "pbkdf2_hmac", type: "function" },
    { label: "algorithms_available", type: "property" },
    { label: "algorithms_guaranteed", type: "property" },
  ],
  hmac: [
    { label: "new", type: "function" },
    { label: "compare_digest", type: "function" },
    { label: "digest", type: "function" },
    { label: "HMAC", type: "function" },
  ],
  struct: [
    { label: "pack", type: "function" },
    { label: "unpack", type: "function" },
    { label: "calcsize", type: "function" },
    { label: "pack_into", type: "function" },
    { label: "unpack_from", type: "function" },
    { label: "Struct", type: "function" },
  ],
  BIP32: [
    { label: "from_seed", type: "function" },
    { label: "get_privkey_from_path", type: "function" },
    { label: "get_pubkey_from_path", type: "function" },
  ],
  SECP256k1: [
    { label: "order", type: "property" },
    { label: "generator", type: "property" },
    { label: "curve", type: "property" },
    { label: "baselen", type: "property" },
  ],
  CScript: [
    { label: "hex", type: "function" },
    { label: "is_valid", type: "function" },
    { label: "is_p2sh", type: "function" },
    { label: "is_witness_v0_keyhash", type: "function" },
    { label: "is_witness_v0_scripthash", type: "function" },
  ],
  ec: [
    { label: "generate_private_key", type: "function" },
    { label: "derive_private_key", type: "function" },
    { label: "SECP256K1", type: "function" },
    { label: "ECDH", type: "function" },
    { label: "EllipticCurvePublicKey", type: "class" },
  ],
  SigningKey: [
    { label: "from_string", type: "function" },
    { label: "from_pem", type: "function" },
    { label: "from_der", type: "function" },
  ],
  Encoding: [
    { label: "X962", type: "property" },
    { label: "PEM", type: "property" },
    { label: "DER", type: "property" },
    { label: "Raw", type: "property" },
  ],
  // commitment_keys parameter (CommitmentKeys instance used in exercises)
  commitment_keys: [
    { label: "per_commitment_point", type: "property", detail: "33-byte per-commitment point" },
    { label: "revocation_key", type: "property", detail: "33-byte revocation public key" },
    { label: "local_delayed_payment_key", type: "property", detail: "33-byte local delayed payment key" },
    { label: "local_htlc_key", type: "property", detail: "33-byte local HTLC key" },
    { label: "remote_htlc_key", type: "property", detail: "33-byte remote HTLC key" },
  ],
  PublicFormat: [
    { label: "CompressedPoint", type: "property" },
    { label: "UncompressedPoint", type: "property" },
    { label: "SubjectPublicKeyInfo", type: "property" },
  ],
};

// ── Instance-type completions ────────────────────────────────────────────
// These match when the user types `variable.` and we can infer the type
// from how the variable was assigned in the current document.

const INSTANCE_COMPLETIONS: Record<string, Completion[]> = {
  // ecdsa SigningKey instances
  SigningKey: [
    { label: "sign_digest", type: "function", detail: "Sign a hash digest" },
    { label: "sign", type: "function", detail: "Sign data" },
    { label: "sign_deterministic", type: "function", detail: "Deterministic sign" },
    { label: "get_verifying_key", type: "function", detail: "Get public key" },
    { label: "to_string", type: "function", detail: "Raw private key bytes" },
    { label: "to_pem", type: "function", detail: "PEM-encoded key" },
    { label: "privkey", type: "property" },
    { label: "curve", type: "property" },
  ],
  // BIP32 HD key instances
  BIP32: [
    { label: "get_privkey_from_path", type: "function", detail: "Derive privkey" },
    { label: "get_pubkey_from_path", type: "function", detail: "Derive pubkey" },
    { label: "get_xpriv", type: "function" },
    { label: "get_xpub", type: "function" },
  ],
  // Hash objects (hashlib.sha256(), etc.)
  hash: [
    { label: "digest", type: "function", detail: "Get hash as bytes" },
    { label: "hexdigest", type: "function", detail: "Get hash as hex string" },
    { label: "update", type: "function", detail: "Feed more data" },
    { label: "copy", type: "function" },
    { label: "digest_size", type: "property" },
    { label: "block_size", type: "property" },
    { label: "name", type: "property" },
  ],
  // HMAC objects
  hmac: [
    { label: "digest", type: "function", detail: "Get HMAC as bytes" },
    { label: "hexdigest", type: "function", detail: "Get HMAC as hex string" },
    { label: "update", type: "function", detail: "Feed more data" },
    { label: "copy", type: "function" },
  ],
  // cryptography ec private key
  ec_private_key: [
    { label: "public_key", type: "function", detail: "Get public key" },
    { label: "exchange", type: "function", detail: "ECDH key exchange" },
    { label: "sign", type: "function", detail: "Sign data" },
    { label: "private_numbers", type: "function" },
    { label: "private_bytes", type: "function" },
    { label: "curve", type: "property" },
    { label: "key_size", type: "property" },
  ],
  // cryptography ec public key
  ec_public_key: [
    { label: "public_bytes", type: "function", detail: "Serialize to bytes" },
    { label: "public_numbers", type: "function" },
    { label: "verify", type: "function" },
    { label: "curve", type: "property" },
    { label: "key_size", type: "property" },
  ],
  // CommitmentKeys (data container for per-commitment derived keys)
  CommitmentKeys: [
    { label: "per_commitment_point", type: "property", detail: "33-byte per-commitment point" },
    { label: "revocation_key", type: "property", detail: "33-byte revocation public key" },
    { label: "local_delayed_payment_key", type: "property", detail: "33-byte local delayed payment key" },
    { label: "local_htlc_key", type: "property", detail: "33-byte local HTLC key" },
    { label: "remote_htlc_key", type: "property", detail: "33-byte remote HTLC key" },
  ],
  // bytes
  bytes: [
    { label: "hex", type: "function", detail: "Convert to hex string" },
    { label: "decode", type: "function" },
    { label: "startswith", type: "function" },
    { label: "endswith", type: "function" },
    { label: "count", type: "function" },
    { label: "find", type: "function" },
    { label: "replace", type: "function" },
    { label: "split", type: "function" },
    { label: "strip", type: "function" },
    { label: "join", type: "function" },
  ],
  // int
  int: [
    { label: "to_bytes", type: "function", detail: "Convert to bytes" },
    { label: "from_bytes", type: "function", detail: "Create from bytes" },
    { label: "bit_length", type: "function" },
  ],
};

// Patterns that map constructor calls to instance types
const TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /SigningKey\.from_string\b/, type: "SigningKey" },
  { pattern: /SigningKey\.from_pem\b/, type: "SigningKey" },
  { pattern: /SigningKey\.from_der\b/, type: "SigningKey" },
  { pattern: /SigningKey\(/, type: "SigningKey" },
  { pattern: /CommitmentKeys\(/, type: "CommitmentKeys" },
  { pattern: /BIP32\.from_seed\b/, type: "BIP32" },
  { pattern: /hashlib\.sha256\b/, type: "hash" },
  { pattern: /hashlib\.sha512\b/, type: "hash" },
  { pattern: /hashlib\.sha1\b/, type: "hash" },
  { pattern: /hashlib\.new\b/, type: "hash" },
  { pattern: /hmac\.new\b/, type: "hmac" },
  { pattern: /hmac\.HMAC\b/, type: "hmac" },
  { pattern: /ec\.generate_private_key\b/, type: "ec_private_key" },
  { pattern: /ec\.derive_private_key\b/, type: "ec_private_key" },
  { pattern: /\.public_key\(\)/, type: "ec_public_key" },
  { pattern: /int\.from_bytes\b/, type: "int" },
  { pattern: /\.to_bytes\b/, type: "bytes" },
  { pattern: /\.digest\(\)/, type: "bytes" },
  { pattern: /\.hexdigest\(\)/, type: "bytes" },
  { pattern: /\.hex\(\)/, type: "bytes" },
  { pattern: /privkey_to_pubkey\b/, type: "bytes" },
  { pattern: /hash160\b/, type: "bytes" },
  { pattern: /b'/, type: "bytes" },
  { pattern: /b"/, type: "bytes" },
  { pattern: /bytes\.fromhex\b/, type: "bytes" },
  { pattern: /lx\(/, type: "bytes" },
];

/**
 * Try to infer the type of a variable by scanning the document for its
 * assignment (e.g., `key = SigningKey.from_string(...)` → SigningKey instance).
 */
function inferTypeFromDoc(varName: string, doc: string): string | null {
  // Look for `varName = <something>` pattern
  const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const assignRe = new RegExp(`${escapedVar}\\s*=\\s*(.+)`, "g");
  let lastMatch: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = assignRe.exec(doc)) !== null) {
    lastMatch = m[1];
  }
  if (!lastMatch) return null;

  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(lastMatch)) return type;
  }
  return null;
}

// ── "self." completions for class methods ────────────────────────────────────
// `self` doesn't exist in the Pyodide global namespace, so we provide
// instance-level completions statically keyed by class name.

const SELF_COMPLETIONS: Record<string, Completion[]> = {
  ChannelKeyManager: [
    // Instance attributes (set in __init__)
    { label: "funding_key", type: "property", detail: "Family 0 private key" },
    { label: "funding_pubkey", type: "property", detail: "Family 0 public key" },
    { label: "revocation_basepoint_secret", type: "property", detail: "Family 1 private key" },
    { label: "revocation_basepoint", type: "property", detail: "Family 1 public key" },
    { label: "htlc_basepoint_secret", type: "property", detail: "Family 2 private key" },
    { label: "htlc_basepoint", type: "property", detail: "Family 2 public key" },
    { label: "payment_basepoint_secret", type: "property", detail: "Family 3 private key" },
    { label: "payment_basepoint", type: "property", detail: "Family 3 public key" },
    { label: "delayed_payment_basepoint_secret", type: "property", detail: "Family 4 private key" },
    { label: "delayed_payment_basepoint", type: "property", detail: "Family 4 public key" },
    { label: "commitment_seed", type: "property", detail: "Family 5 seed (no pubkey)" },
    // Methods
    { label: "sign_input", type: "function", detail: "Sign a transaction input" },
    { label: "build_commitment_secret", type: "function", detail: "Derive per-commitment secret" },
    { label: "derive_per_commitment_point", type: "function", detail: "Derive per-commitment point" },
    { label: "get_commitment_keys", type: "function", detail: "Get all commitment keys for a state" },
  ],
};

/**
 * Detect the enclosing class from the document text by looking for
 * `class ClassName:` before the cursor position.
 */
function detectEnclosingClass(doc: string, cursorPos: number): string | null {
  const textBefore = doc.substring(0, cursorPos);
  // Find the last `class X:` or `class X(...):`
  const classRe = /class\s+(\w+)\s*[:(]/g;
  let lastClass: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(textBefore)) !== null) {
    lastClass = m[1];
  }
  return lastClass;
}

// ─── Cache + state ──────────────────────────────────────────────────────────

const cache = new Map<string, Completion[]>();
let contextPreloaded = false;

/**
 * Preload exercise context (preamble + prior exercise code) into the Pyodide
 * namespace so that `dir()` introspection works for autocomplete.
 */
export async function preloadCompletionContext(code: string): Promise<void> {
  if (!code || contextPreloaded) return;
  try {
    await execPythonSilent(code);
    contextPreloaded = true;
    console.log("[autocomplete] Preloaded context successfully");
  } catch (e) {
    console.warn("[autocomplete] Failed to preload context:", e);
    // Pyodide may not be ready yet — retry once after 5s
    setTimeout(async () => {
      if (contextPreloaded) return;
      try {
        await execPythonSilent(code);
        contextPreloaded = true;
        console.log("[autocomplete] Preloaded context on retry");
      } catch (e2) {
        console.warn("[autocomplete] Retry also failed:", e2);
      }
    }, 5000);
  }
}

/**
 * Clear the completion cache. Call after tests run so fresh introspection
 * picks up any new definitions from the student's code.
 */
export function invalidateCompletionCache(): void {
  cache.clear();
  contextPreloaded = false;
}

/**
 * Create a CodeMirror CompletionSource powered by Pyodide introspection.
 *
 * Registered via autocompletion({ override: [...] }) so it is guaranteed
 * to be called on every completion activation (typing or explicit).
 */
export function createPyodideCompletionSource() {
  return async function pyodideCompletionSource(
    context: CompletionContext
  ): Promise<CompletionResult | null> {
    // Only trigger after a dot: match `identifier.partial` or `module.sub.partial`
    const match = context.matchBefore(/[\w.]+\.\w*$/);
    if (!match) return null;

    // Split into object expression (before last dot) and partial (after last dot)
    const fullText = match.text;
    const lastDot = fullText.lastIndexOf(".");
    if (lastDot < 0) return null;

    const objExpr = fullText.substring(0, lastDot);
    const from = match.from + lastDot + 1;

    // Check cache first
    let completions = cache.get(objExpr);
    if (completions) {
      return { from, options: completions, validFor: /^\w*$/ };
    }

    // Handle "self." inside a class method: detect enclosing class and
    // return its instance attributes + methods from SELF_COMPLETIONS.
    if (objExpr === "self") {
      const docText = context.state.doc.toString();
      const cursorPos = context.pos;
      const className = detectEnclosingClass(docText, cursorPos);
      if (className && SELF_COMPLETIONS[className]) {
        completions = SELF_COMPLETIONS[className];
        cache.set("self", completions);
        return { from, options: completions, validFor: /^\w*$/ };
      }
      // Also try Pyodide: instantiate or dir() the class
      if (isWorkerCreated() && contextPreloaded && className) {
        try {
          const items = await getPythonCompletions(className);
          if (items.length > 0) {
            completions = items.map((item) => ({
              label: item.label,
              type: item.type === "function" ? "function" : "property",
            }));
            cache.set("self", completions);
            return { from, options: completions, validFor: /^\w*$/ };
          }
        } catch {
          // Fall through
        }
      }
    }

    // Try live Pyodide introspection if the worker is ready
    if (isWorkerCreated() && contextPreloaded) {
      try {
        const items = await getPythonCompletions(objExpr);
        if (items.length > 0) {
          completions = items.map((item) => ({
            label: item.label,
            type: item.type === "function" ? "function" : "property",
          }));
          cache.set(objExpr, completions);
          return { from, options: completions, validFor: /^\w*$/ };
        }
      } catch {
        // Fall through to static completions
      }
    }

    // Fall back to static completions (instant, no Pyodide needed)
    const staticItems = STATIC_COMPLETIONS[objExpr];
    if (staticItems) {
      return { from, options: staticItems, validFor: /^\w*$/ };
    }

    // Fall back to type inference: scan the document for how this variable
    // was assigned and offer instance methods for the inferred type.
    const docText = context.state.doc.toString();
    const inferredType = inferTypeFromDoc(objExpr, docText);
    if (inferredType) {
      const instanceItems = INSTANCE_COMPLETIONS[inferredType];
      if (instanceItems) {
        cache.set(objExpr, instanceItems);
        return { from, options: instanceItems, validFor: /^\w*$/ };
      }
    }

    return null;
  };
}

// ─── Word-level completion (identifiers from the document) ──────────────

const PYTHON_KEYWORDS: Completion[] = [
  "def", "class", "return", "if", "elif", "else", "for", "while", "break",
  "continue", "pass", "import", "from", "as", "try", "except", "finally",
  "raise", "with", "assert", "yield", "lambda", "not", "and", "or", "in",
  "is", "True", "False", "None",
].map(kw => ({ label: kw, type: "keyword" }));

const PYTHON_BUILTINS: Completion[] = [
  "print", "len", "range", "int", "str", "bytes", "bytearray", "list",
  "dict", "set", "tuple", "bool", "hex", "bin", "ord", "chr", "abs",
  "min", "max", "sum", "sorted", "reversed", "enumerate", "zip", "map",
  "filter", "isinstance", "hasattr", "getattr", "setattr", "type",
  "super", "property", "staticmethod", "classmethod",
].map(fn => ({ label: fn, type: "function", boost: -1 }));

/**
 * Create a CodeMirror CompletionSource that suggests identifiers already
 * present in the document (imports, variable names, function names, etc.)
 * plus Python keywords and builtins. Triggers after 2+ characters typed.
 */
export function createWordCompletionSource() {
  return function wordCompletionSource(
    context: CompletionContext
  ): CompletionResult | null {
    // Match a word being typed (at least 2 chars), but NOT after a dot
    const word = context.matchBefore(/(?<![.\w])\w{2,}$/);
    if (!word) return null;

    // Extract all unique identifiers from the document (3+ chars)
    const doc = context.state.doc.toString();
    const wordSet = new Set<string>();
    const idRe = /\b[a-zA-Z_]\w{2,}\b/g;
    let m: RegExpExecArray | null;
    while ((m = idRe.exec(doc)) !== null) {
      wordSet.add(m[0]);
    }

    // Build options from document words (excluding Python keywords which
    // we add separately with proper type tagging)
    const kwSet = new Set(PYTHON_KEYWORDS.map(k => k.label));
    const docOptions: Completion[] = [];
    for (const w of wordSet) {
      if (!kwSet.has(w)) {
        docOptions.push({ label: w, type: "variable", boost: -2 });
      }
    }

    const options = [...PYTHON_KEYWORDS, ...PYTHON_BUILTINS, ...docOptions];
    return { from: word.from, options, validFor: /^\w*$/ };
  };
}
