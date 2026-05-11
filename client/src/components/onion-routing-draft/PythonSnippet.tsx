import { useRef, useState, type ReactNode } from "react";
import { lookupSignature, type SignatureInfo } from "../../lib/signature-hints";
import { SNIPPET_VAR_DOCS, type VarDoc } from "./snippetVarDocs";

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

    // numbers
    m = rest.match(/^\d+(?:\.\d+)?/);
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

function renderPython(code: string): ReactNode {
  const tokens = tokenizePython(code);
  return tokens.map((t, i) => {
    const color = t.type === "default" ? COLOR.default : COLOR[t.type];
    const style: React.CSSProperties = { color };
    if (t.type === "comment") style.fontStyle = "italic";
    const hover = lookupHover(t);
    if (hover) {
      return (
        <HoverToken key={i} style={style} hover={hover}>
          {t.text}
        </HoverToken>
      );
    }
    return (
      <span key={i} style={style}>
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
  style,
  hover,
}: {
  children: ReactNode;
  style: React.CSSProperties;
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
        ref={triggerRef}
        onMouseEnter={() => {
          updatePos();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        style={{
          ...style,
          borderBottom: "1px dotted currentColor",
          cursor: "help",
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

export function PythonSnippet({ id }: { id: string }) {
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
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-3"
        style={{
          fontFamily: MONO,
          fontSize: 16,
          lineHeight: 1.55,
          color: COLOR.default,
          letterSpacing: "0.005em",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: MONO,
            fontSize: 16,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {renderPython(snippet.python)}
        </pre>
      </div>
    </div>
  );
}

export default PythonSnippet;
