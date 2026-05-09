import { useState, type ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// MathPythonSnippet
//
// Algorithmic snippets that can be viewed in either mathematical notation or
// Python. Toggle in the header; both views render in the locked-spec card
// format (black header / gold dot / cream stage / 1.5px borders / mono).
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
// <math-python id="..."></math-python>.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type Mode = "math" | "python";

interface Snippet {
  math: ReactNode;
  python: string;
}

// ── Helpers for math content ────────────────────────────────────────────────

function V({ children }: { children: ReactNode }) {
  return <i style={{ fontStyle: "italic" }}>{children}</i>;
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <sub
      style={{
        fontSize: "0.78em",
        verticalAlign: "baseline",
        position: "relative",
        top: "0.3em",
        marginLeft: "1px",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </sub>
  );
}

function Sup({ children }: { children: ReactNode }) {
  return (
    <sup
      style={{
        fontSize: "0.78em",
        verticalAlign: "baseline",
        position: "relative",
        top: "-0.55em",
        marginLeft: "1px",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </sup>
  );
}

const sB = (
  <>
    <V>s</V>
    <Sub>B</Sub>
  </>
);
const sC = (
  <>
    <V>s</V>
    <Sub>C</Sub>
  </>
);

// ── Snippet registry ────────────────────────────────────────────────────────

const SNIPPETS: Record<string, Snippet> = {
  "filler-init": {
    math: (
      <>
        <V>f</V> := ε
      </>
    ),
    python: 'filler = b""',
  },

  "filler-append-bob": {
    math: (
      <>
        <V>f</V> := 0<Sup>{sB}</Sup>
      </>
    ),
    python: 'filler = b"\\x00" * s_B',
  },

  "filler-bob-xor": {
    math: (
      <>
        <span style={{ display: "block" }}>
          <V>K</V>
          <Sub>B</Sub> := ChaCha20(ρ
          <Sub>B</Sub>, 1300 + {sB})
        </span>
        <span style={{ display: "block", marginTop: 6 }}>
          <V>f</V> := <V>f</V> ⊕ <V>K</V>
          <Sub>B</Sub>[−|<V>f</V>|:]
        </span>
      </>
    ),
    python:
      "stream = chacha20_keystream(bob_rho, 1300 + s_B)\nfiller = xor_bytes(filler, stream[-len(filler):])",
  },

  "filler-prepend-charlie": {
    math: (
      <>
        <V>f</V> := 0<Sup>{sC}</Sup> ‖ <V>f</V>
      </>
    ),
    python: 'filler = b"\\x00" * s_C + filler',
  },

  "filler-charlie-xor": {
    math: (
      <>
        <span style={{ display: "block" }}>
          <V>K</V>
          <Sub>C</Sub> := ChaCha20(ρ
          <Sub>C</Sub>, 1300 + {sB} + {sC})
        </span>
        <span style={{ display: "block", marginTop: 6 }}>
          <V>f</V> := <V>f</V> ⊕ <V>K</V>
          <Sub>C</Sub>[−|<V>f</V>|:]
        </span>
      </>
    ),
    python:
      "stream = chacha20_keystream(charlie_rho, 1300 + s_B + s_C)\nfiller = xor_bytes(filler, stream[-len(filler):])",
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

function renderPython(code: string): ReactNode {
  const tokens = tokenizePython(code);
  return tokens.map((t, i) => {
    const color = t.type === "default" ? COLOR.default : COLOR[t.type];
    const style: React.CSSProperties = { color };
    if (t.type === "comment") style.fontStyle = "italic";
    return (
      <span key={i} style={style}>
        {t.text}
      </span>
    );
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export function MathPythonSnippet({ id }: { id: string }) {
  const [mode, setMode] = useState<Mode>("python");
  const snippet = SNIPPETS[id];
  if (!snippet) {
    return (
      <div
        className="my-6 border-[1.5px] border-red-500 bg-red-50 px-3 py-2 text-xs"
        style={{ fontFamily: MONO }}
      >
        MathPythonSnippet: unknown id "{id}"
      </div>
    );
  }

  return (
    <div
      className="my-6 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid={`math-python-${id}`}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header with toggle */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b] shrink-0" />
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase truncate">
            {mode === "math" ? "Notation" : "Python"}
          </span>
        </div>
        <div className="flex border-[1.5px] border-white/30 shrink-0">
          <button
            type="button"
            onClick={() => setMode("math")}
            className="px-2.5 py-0.5 transition-colors"
            style={{
              background: mode === "math" ? "#b8860b" : "transparent",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Math
          </button>
          <button
            type="button"
            onClick={() => setMode("python")}
            className="px-2.5 py-0.5 transition-colors"
            style={{
              background: mode === "python" ? "#b8860b" : "transparent",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Python
          </button>
        </div>
      </div>

      {/* Stage */}
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
        {mode === "math" ? (
          <div style={{ fontSize: 17 }}>{snippet.math}</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default MathPythonSnippet;
