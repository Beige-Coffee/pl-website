import { useRef, useState, type ReactNode } from "react";
import { lookupSignature, type SignatureInfo } from "../../lib/signature-hints";
import { SNIPPET_VAR_DOCS, type VarDoc } from "./snippetVarDocs";
// DARK_COLOR is the dark-mode palette; the local COLOR below is the light variant.
// (tokenizePython is duplicated here for now; the shared version lives in
// lib/pythonHighlight.tsx and is what OnionHintContent uses.)
import { DARK_COLOR } from "../../lib/pythonHighlight";

// ────────────────────────────────────────────────────────────────────────────
// PythonSnippet
//
// Algorithmic snippets rendered as styled Python cards. Locked-spec format:
// black header / gold dot / "PYTHON" label / cream stage / 1.5px borders /
// JetBrains Mono.
//
// Python view is syntax-highlighted with the same color palette as the
// CodeExercise light theme:
//   keywords/operators: #d73a49 (red)
//   functions/built-ins: #6f42c1 (purple)
//   strings:           #032f62 (deep blue)
//   numbers:           #005cc5 (blue)
//   default ink:       #0f172a
//
// Snippets are keyed by id; the markdown references them via
// <python-snippet id="..."></python-snippet>.
//
// Per the user-locked Python Snippet Rule (2026-05-08): every code snippet
// in the course must go through this component. Pseudocode and math
// notation should be translated to real Python before registering.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

interface Snippet {
  python: string;
}

// ── Snippet registry ────────────────────────────────────────────────────────

const SNIPPETS: Record<string, Snippet> = {
  "route-fee-formula": {
    python:
      "fee = base_fee + (amount_forwarded * fee_per_millionth) // 1_000_000",
  },

  "route-fee-example": {
    python:
      "# base_fee = 1_000, fee_per_millionth = 500, amount_forwarded = 2_000_000\nfee = 1_000 + (2_000_000 * 500) // 1_000_000   # = 1_000 + 1_000 = 2_000 sats",
  },

  "route-timeout-formula": {
    python:
      "# Timeouts are computed backwards, from the destination up.\n# Final hop: the receiver's HTLC must stay valid this long.\noutgoing_cltv = current_block + min_final_cltv_expiry_delta\n\n# Each forwarder upstream adds its own cushion on top:\nincoming_cltv = outgoing_cltv + forwarder_cltv_expiry_delta",
  },

  "route-timeout-example": {
    python:
      "# current_block = 150, min_final_cltv_expiry_delta = 18\nhazel_to_dave  = 150 + 18       # = 168, the floor Dave's invoice sets\nalice_to_hazel = 168 + 1000     # + Hazel's cltv_expiry_delta  -> 1168",
  },

  "filler-init": {
    python: 'filler = b""',
  },

  "filler-append-bob": {
    python: 'filler = filler + b"\\x00" * s_B',
  },

  "filler-bob-xor": {
    python:
      "stream = chacha20_keystream(bob_rho, 1300 + s_B)\nkeystream_overlay = stream[-len(filler):]\nfiller = xor_bytes(filler, keystream_overlay)",
  },

  "filler-append-charlie": {
    python: 'filler = filler + b"\\x00" * s_C',
  },

  "filler-charlie-xor": {
    python:
      "stream = chacha20_keystream(charlie_rho, 1300 + s_C)\nkeystream_overlay = stream[-len(filler):]\nfiller = xor_bytes(filler, keystream_overlay)",
  },

  "generate-key": {
    python:
      'def generate_key(name: str, secret: bytes) -> bytes:\n    return hmac.new(name.encode(), secret, hashlib.sha256).digest()',
  },

  // ── Chapter 8: wrap algorithm ────────────────────────────────────────────
  "wrap-pad-init": {
    python:
      'pad_key = hmac.new(b"pad", session_key, hashlib.sha256).digest()\nbuffer = bytearray(chacha20_keystream(pad_key, 1300))',
  },

  "wrap-shift": {
    python:
      '# Drop the last hop_size bytes off the right; prepend hop_size bytes of\n# placeholder space at the front. Total length stays at 1300.\nhop_size = len(payload) + 32\nbuffer = bytearray(hop_size) + bytearray(buffer[:-hop_size])',
  },

  "wrap-write": {
    python:
      '# Write the bigsize-prefixed TLV payload followed by the 32-byte next_hmac\n# into the freshly-vacated front.\nbuffer[:len(payload) + 32] = payload + next_hmac',
  },

  "wrap-xor": {
    python:
      '# Encrypt the entire 1,300-byte buffer with this hop\'s rho.\nstream = chacha20_keystream(rho, 1300)\nbuffer = xor_bytes(buffer, stream)',
  },

  "wrap-filler-overlay": {
    python:
      '# Innermost iteration only: overwrite the trailing len(filler) bytes\n# of the buffer with the precomputed filler from chapter 7.\nbuffer = buffer[:1300 - len(filler)] + filler',
  },

  "wrap-hmac": {
    python:
      '# HMAC over (encrypted buffer || associated_data). The 32-byte\n# associated_data is the payment_hash; it binds the onion to one HTLC.\nthis_hop_hmac = hmac.new(mu, buffer + associated_data, hashlib.sha256).digest()',
  },

  // ── Chapter 9: peel algorithm ────────────────────────────────────────────
  "peel-parse": {
    python:
      '# Split the 1,366-byte packet into its four fields.\nversion = packet[0:1]\nephemeral_pubkey = packet[1:34]      # E_AB · 33 bytes\nhop_payloads = packet[34:1334]       # 1,300 bytes (still encrypted)\nouter_hmac = packet[1334:1366]       # 32 bytes',
  },

  "peel-derive-keys": {
    python:
      '# Bob performs ECDH between his node privkey and E_AB to recover ss_AB,\n# then derives the two keys he needs for this hop.\nshared_secret = ecdh(node_privkey, ephemeral_pubkey)\nmu_B = generate_key("mu", shared_secret)\nrho_B = generate_key("rho", shared_secret)',
  },

  "peel-verify-hmac": {
    python:
      '# Recompute the HMAC tag and compare against the received outer HMAC.\nexpected = hmac.new(\n    mu_B, hop_payloads + associated_data, hashlib.sha256\n).digest()\nif not hmac.compare_digest(expected, outer_hmac):\n    return "invalid_onion_hmac"  # fail the HTLC with this code\nreturn None  # integrity OK',
  },

  "peel-extend-xor": {
    python:
      '# Extend hop_payloads with 1,300 zero bytes, then XOR the whole\n# 2,600-byte buffer with rho_B\'s keystream.\nextended = bytearray(hop_payloads) + bytearray(1300)\nstream = chacha20_keystream(rho_B, 2600)\nextended = xor_bytes(extended, stream)',
  },

  "peel-read-payload": {
    python:
      '# Parse the bigsize length prefix, then keep the whole hop payload\n# (prefix + TLV records), then the 32-byte next_hmac that follows it.\n# parse_bigsize returns (value, bytes_consumed).\npayload_len, header_len = parse_bigsize(extended, 0)\nthis_hop_payload = extended[0:header_len + payload_len]\nhop_size = header_len + payload_len + 32  # prefix + TLVs + next_hmac\nnext_hmac = bytes(extended[hop_size - 32:hop_size])',
  },

  "peel-lift-next": {
    python:
      "# The next 1,300 bytes after Bob's hop payload become Charlie's\n# hop_payloads field, the same fixed wire size as what Bob received.\nnext_hop_payloads = bytes(extended[hop_size:hop_size + 1300])",
  },

  "peel-advance-ephemeral": {
    python:
      '# Blind Alice\'s ephemeral pubkey forward so Charlie sees a fresh\n# E_AC on the wire. The blinding factor is deterministic, so Charlie\n# can recompute the same ss_AC from his node privkey + E_AC.\nblinding = hashlib.sha256(ephemeral_pubkey + shared_secret).digest()\nnext_ephemeral = point_mul_pubkey(ephemeral_pubkey, blinding)',
  },

  "peel-assemble": {
    python:
      '# Bob ships the 1,366-byte packet to Charlie. The next_hmac Bob read\n# from his own hop payload becomes the outer HMAC tag of the outgoing\n# packet.\nnext_packet = b"\\x00" + next_ephemeral + next_hop_payloads + next_hmac',
  },

  // ── Chapter 11: the error onion ──
  "error-package": {
    python:
      '# Package the failure so its size can\'t leak which failure it is:\n# failure_len || failure_message || pad_len || zero padding.\n# Per BOLT 4, failure_len + pad_len must reach at least 256.\npad_len = 256 - len(failure_message)\npayload = (\n    len(failure_message).to_bytes(2, "big") + failure_message\n    + pad_len.to_bytes(2, "big") + bytes(pad_len)\n)  # 2 + failure_len + 2 + pad_len = 260 bytes here',
  },
  "error-hmac": {
    python:
      "# Authenticate the payload with um, then prepend the tag.\n# Tag + payload is the full error packet: 32 + 260 = 292 bytes.\nerror_hmac = hmac.new(um_charlie, payload, hashlib.sha256).digest()\npacket = error_hmac + payload",
  },
  "error-wrap": {
    python:
      "# Encrypt in place: XOR the whole packet with the ammag keystream.\n# Same fixed size in, same fixed size out.\nstream = chacha20_keystream(ammag_charlie, len(packet))\nwrapped = xor_bytes(packet, stream)",
  },
  "error-rewrap": {
    python:
      "# Bob's entire job: one more ammag layer over however many bytes\n# arrived, then pass it along. He never reads a thing.\nwrapped = xor_bytes(wrapped, chacha20_keystream(ammag_bob, len(wrapped)))",
  },
  "error-trial-peel": {
    python:
      "# One trial iteration: peel hop i's ammag layer (the XOR accumulates\n# across iterations), then ask whether hop i's um key authenticates it.\nwrapped = xor_bytes(wrapped, chacha20_keystream(ammag_i, len(wrapped)))\ntag = wrapped[:32]\npayload = wrapped[32:]\nfound = hmac.new(um_i, payload, hashlib.sha256).digest() == tag",
  },
  "error-parse": {
    python:
      '# The HMAC verified, so the payload is plaintext. Read the length\n# prefix, then slice exactly that many bytes. Never scan for zeros:\n# the padding is zeros, and the message itself may contain them too.\nfailure_len = int.from_bytes(payload[0:2], "big")\nfailure_message = payload[2:2 + failure_len]',
  },

  // ── Chapter 10: the policy check ──
  "check-fee-cltv": {
    python:
      '# The fee math, straight from Bob\'s channel_update. Note the floor\n# division: same convention as chapter 2\'s fee calculator.\nrequired_fee = (\n    policy.fee_base_msat\n    + (amt_to_forward * policy.fee_proportional_millionths) // 1_000_000\n)\nif incoming_amount_msat - amt_to_forward < required_fee:\n    return "fee_insufficient"\nif incoming_cltv_expiry - outgoing_cltv_value < policy.cltv_expiry_delta:\n    return "incorrect_cltv_expiry"',
  },
};

// ── Python syntax highlighting ──────────────────────────────────────────────

const COLOR = {
  keyword: "#d73a49",
  operator: "#d73a49",
  function: "#6f42c1",
  builtin: "#6f42c1",
  string: "#032f62",
  number: "#005cc5",
  comment: "#6a737d",
  default: "#0f172a",
} as const;

const KEYWORDS = new Set([
  "if", "else", "elif", "for", "while", "def", "class", "return",
  "from", "import", "as", "in", "is", "and", "or", "not", "lambda",
  "None", "True", "False", "self", "yield", "with", "try", "except",
  "finally", "raise", "pass", "break", "continue", "global", "nonlocal",
]);

const BUILTINS = new Set([
  "len", "range", "int", "str", "bytes", "bytearray", "list", "dict",
  "set", "tuple", "print", "open", "type", "isinstance", "hex", "ord",
  "chr", "abs", "min", "max", "sum", "sorted", "reversed", "enumerate",
  "zip", "map", "filter", "any", "all",
]);

type Tok = { type: keyof typeof COLOR | "default"; text: string };

function tokenizePython(code: string): Tok[] {
  const out: Tok[] = [];
  let pos = 0;
  while (pos < code.length) {
    const rest = code.slice(pos);

    // whitespace passthrough
    let m = rest.match(/^\s+/);
    if (m) {
      out.push({ type: "default", text: m[0] });
      pos += m[0].length;
      continue;
    }

    // comments (# to end-of-line)
    m = rest.match(/^#[^\n]*/);
    if (m) {
      out.push({ type: "comment", text: m[0] });
      pos += m[0].length;
      continue;
    }

    // bytes / regular strings (handle b"...", "...", '...', f"...")
    m = rest.match(/^[bBfFrRuU]?"(?:[^"\\]|\\.)*"/);
    if (m) {
      out.push({ type: "string", text: m[0] });
      pos += m[0].length;
      continue;
    }
    m = rest.match(/^[bBfFrRuU]?'(?:[^'\\]|\\.)*'/);
    if (m) {
      out.push({ type: "string", text: m[0] });
      pos += m[0].length;
      continue;
    }

    // numbers (incl. underscores and hex)
    m = rest.match(/^0[xX][0-9a-fA-F_]+|^\d[\d_]*(?:\.\d+)?/);
    if (m) {
      out.push({ type: "number", text: m[0] });
      pos += m[0].length;
      continue;
    }

    // identifiers
    m = rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (m) {
      const name = m[0];
      const after = rest.slice(name.length);
      const isCall = after.startsWith("(");
      let type: keyof typeof COLOR | "default" = "default";
      if (KEYWORDS.has(name)) type = "keyword";
      else if (BUILTINS.has(name)) type = "builtin";
      else if (isCall) type = "function";
      out.push({ type, text: name });
      pos += name.length;
      continue;
    }

    // operators (multi-char first)
    m = rest.match(/^(==|!=|<=|>=|<<|>>|\*\*|\/\/|->|:=|[+\-*/%=<>!&|^~])/);
    if (m) {
      out.push({ type: "operator", text: m[0] });
      pos += m[0].length;
      continue;
    }

    // anything else (brackets, punctuation): default ink
    out.push({ type: "default", text: rest[0] });
    pos += 1;
  }
  return out;
}

// Lookup hover content for a token. Functions are looked up by name in
// signature-hints.ts; identifiers and numeric literals are looked up in
// snippetVarDocs.ts. Returns null if the token has no docs.
function lookupHover(t: Tok): SignatureInfo | VarDoc | null {
  if (t.type === "function") {
    const sig = lookupSignature(t.text);
    if (sig) return sig;
  }
  if (t.type === "default" || t.type === "number") {
    const doc = SNIPPET_VAR_DOCS[t.text];
    if (doc) return doc;
  }
  return null;
}

function renderPython(code: string, dark: boolean): ReactNode {
  const palette = dark ? DARK_COLOR : COLOR;
  const tokens = tokenizePython(code);
  return tokens.map((t, i) => {
    const color = palette[t.type];
    // Color is set with !important (via ref) so it survives the layered
    // ".noise-md-dark span { color: ... !important }" rule in dark mode.
    const setColor = (el: HTMLElement | null) => {
      if (el) el.style.setProperty("color", color, "important");
    };
    const italic = t.type === "comment";
    const hover = lookupHover(t);
    if (hover) {
      return (
        <HoverToken key={i} color={color} italic={italic} hover={hover}>
          {t.text}
        </HoverToken>
      );
    }
    return (
      <span key={i} ref={setColor} style={italic ? { fontStyle: "italic" } : undefined}>
        {t.text}
      </span>
    );
  });
}

// ── Hover-over token ───────────────────────────────────────────────────────

// Wraps a token (identifier, function call, constant) with a dotted-underline
// affordance and a fixed-position dark popup that appears on hover. Popup
// content comes from either signature-hints.ts (functions) or
// snippetVarDocs.ts (variables / constants).
function HoverToken({
  children,
  color,
  italic,
  hover,
}: {
  children: ReactNode;
  color: string;
  italic?: boolean;
  hover: SignatureInfo | VarDoc;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Functions have `params` (e.g., "(key, length)"); variables use
  // `signature` (e.g., "bytes (32 bytes)"). Read off the right field.
  const isFunction = "params" in hover;
  const headerLine = isFunction
    ? `${hover.name}${hover.params}`
    : hover.signature
      ? `${hover.name} · ${hover.signature}`
      : hover.name;
  const paramList =
    isFunction && hover.paramDetails && hover.paramDetails.length > 0
      ? hover.paramDetails
      : null;

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <>
      <span
        ref={(el) => {
          triggerRef.current = el;
          if (el) el.style.setProperty("color", color, "important");
        }}
        onMouseEnter={() => {
          updatePos();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        style={{
          borderBottom: "1px dotted currentColor",
          cursor: "help",
          ...(italic ? { fontStyle: "italic" } : {}),
        }}
      >
        {children}
      </span>
      {show && (
        <div
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y - 8,
            transform: "translate(-50%, -100%)",
            background: "#fffdf5",
            color: "#0f172a",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 14,
            lineHeight: 1.5,
            padding: "12px 14px",
            border: "1.5px solid #0f172a",
            borderRadius: 4,
            maxWidth: 360,
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            zIndex: 50,
            pointerEvents: "none",
            textAlign: "left",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              color: "#b8860b",
              marginBottom: 8,
            }}
          >
            {headerLine}
          </div>
          <div style={{ marginBottom: paramList ? 8 : 0 }}>
            {hover.description}
          </div>
          {paramList && (
            <div
              style={{
                fontSize: 12,
                color: "#475569",
                borderTop: "1px solid rgba(15,23,42,0.2)",
                paddingTop: 8,
                marginTop: 6,
              }}
            >
              {paramList.map((p, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : 4 }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      color: "#0f172a",
                      fontWeight: 700,
                    }}
                  >
                    {p.name}
                  </span>{" "}
                  · {p.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function PythonSnippet({ id, dark = false }: { id: string; dark?: boolean }) {
  const snippet = SNIPPETS[id];
  if (!snippet) {
    return (
      <div
        className="my-6 border-[1.5px] border-red-500 bg-red-50 px-3 py-2 text-xs"
        style={{ fontFamily: MONO }}
      >
        PythonSnippet: unknown id "{id}"
      </div>
    );
  }

  return (
    <div
      className="my-6 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid={`python-snippet-${id}`}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b] shrink-0" />
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
          Python
        </span>
      </div>

      <div
        className="relative px-4 py-3"
        style={{
          fontFamily: MONO,
          fontSize: 16,
          lineHeight: 1.55,
          // bg follows the app theme (the `dark` prop), matching the token
          // colors below; using Tailwind's dark: here keyed it to the OS, not
          // the in-app toggle, which desynced bg from tokens.
          background: dark ? "#0b1220" : "#fffdf5",
          color: (dark ? DARK_COLOR : COLOR).default,
          letterSpacing: "0.005em",
        }}
      >
        <pre
          ref={(el) => {
            // !important beats ".noise-md pre { font-family: inherit !important }"
            if (el) el.style.setProperty("font-family", MONO, "important");
          }}
          style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: 16,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {renderPython(snippet.python, dark)}
        </pre>
      </div>
    </div>
  );
}

export default PythonSnippet;
