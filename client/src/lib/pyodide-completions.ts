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
};

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

    return null;
  };
}
