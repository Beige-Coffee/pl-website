// ────────────────────────────────────────────────────────────────────────────
// Snippet variable docs
//
// Hover-over metadata for variables and constants used in Python snippets.
// Used by PythonSnippet.tsx to render dotted-underline hoverable tokens with
// dark popups explaining what each name represents in the context of the
// onion-routing course.
//
// Function-level docs live in client/src/lib/signature-hints.ts (already
// used by the exercise UI for parameter tooltips). This file is variable-
// and constant-focused; it doesn't duplicate the function entries.
// ────────────────────────────────────────────────────────────────────────────

export interface VarDoc {
  /** The identifier as it appears in the snippet (or constant value as a string). */
  name: string;
  /** Short label rendered at the top of the popup (often a type or one-line summary). */
  signature?: string;
  /** Body text describing the variable's role and value. Plain text; rendered as-is. */
  description: string;
}

export const SNIPPET_VAR_DOCS: Record<string, VarDoc> = {
  // ── Chapter 7: filler-algorithm running variables ─────────────────────
  filler: {
    name: "filler",
    signature: "bytes",
    description:
      "The accumulating filler buffer Alice builds up across iterations. Starts as b\"\" (empty), grows by one hop's payload size on each iteration, and ends at s_B + s_C bytes (140 in our running example) once both forwarder iterations have run.",
  },
  s_B: {
    name: "s_B",
    signature: "int",
    description:
      "Bob's hop-payload size in bytes (about 60 in the running example). The size of the bytes Bob removes from the front of the buffer and the size of the new bytes he produces at the back.",
  },
  s_C: {
    name: "s_C",
    signature: "int",
    description:
      "Charlie's hop-payload size in bytes (about 80 in the running example). Same role as s_B but for Charlie's iteration.",
  },
  bob_rho: {
    name: "bob_rho",
    signature: "bytes (32 bytes)",
    description:
      "Bob's `rho` key. Derived as HMAC('rho', ss_AB) where ss_AB is the ECDH shared secret between Alice and Bob. Used as the ChaCha20 cipher key when Bob's keystream is generated.",
  },
  charlie_rho: {
    name: "charlie_rho",
    signature: "bytes (32 bytes)",
    description:
      "Charlie's `rho` key. Derived as HMAC('rho', ss_AC) where ss_AC is the ECDH shared secret between Alice and Charlie. Same role as bob_rho but for Charlie's iteration.",
  },
  stream: {
    name: "stream",
    signature: "bytes",
    description:
      "Local variable holding the ChaCha20 keystream output for the current iteration. Length is 1,300 + the iteration's hop-payload size (1,360 for Bob, 1,380 for Charlie).",
  },
  keystream_overlay: {
    name: "keystream_overlay",
    signature: "bytes",
    description:
      "The trailing portion of `stream` that gets XORed into the filler. Its length equals len(filler): s_B bytes on Bob's iteration (the keystream's extension past 1,300), and s_B + s_C bytes on Charlie's iteration (the extension plus s_B bytes reaching back into Charlie's regular 1,300 region — exactly where Bob's filler bytes will already be sitting when Charlie peels).",
  },

  // ── Constants that appear bare in snippets ────────────────────────────
  "1300": {
    name: "1,300",
    signature: "ROUTING_INFO_SIZE",
    description:
      "Per BOLT 4, every onion's hop_payloads field is exactly 1,300 bytes. This constant is the boundary between the 'regular' keystream region (positions 0..1,299) and the 'extension' Bob computes for filler purposes (positions 1,300+).",
  },
};
