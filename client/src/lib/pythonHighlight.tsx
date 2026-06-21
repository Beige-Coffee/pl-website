import type { CSSProperties, ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Shared Python syntax highlighter.
//
// A tiny hand-rolled tokenizer + two color palettes (light / dark). Used by the
// course's Python snippet cards (PythonSnippet.tsx) and the onion-routing hint
// renderer (OnionHintContent.tsx) so inline code in hints reads like real code
// instead of flat grey pills.
//
// Light palette matches the CodeExercise light theme (GitHub-light); dark
// palette matches the dark editor (GitHub-dark) so colors stay legible on the
// hint panel's dark background.
// ────────────────────────────────────────────────────────────────────────────

export const LIGHT_COLOR = {
  keyword: "#d73a49",
  operator: "#d73a49",
  function: "#6f42c1",
  builtin: "#6f42c1",
  string: "#032f62",
  number: "#005cc5",
  comment: "#6a737d",
  default: "#0f172a",
} as const;

export const DARK_COLOR = {
  keyword: "#ff7b72",
  operator: "#ff7b72",
  function: "#d2a8ff",
  builtin: "#79c0ff",
  string: "#a5d6ff",
  number: "#79c0ff",
  comment: "#8b949e",
  default: "#e6edf3",
} as const;

type ColorKey = keyof typeof LIGHT_COLOR;

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

export type Tok = { type: ColorKey; text: string };

export function tokenizePython(code: string): Tok[] {
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
      let type: ColorKey = "default";
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

/** Render Python source as colored spans (colors only, no hover affordance).
 *
 * Token color is applied via a ref with `!important` rather than the style prop.
 * The course wraps tutorial prose in ".noise-md-dark", whose layered
 * "span { color: ... !important }" rule would otherwise repaint every token
 * grey in dark mode. Inline declarations are resolved before cascade layers, so
 * an inline !important wins; React strips !important from style objects, hence
 * the ref + setProperty. */
export function highlightPython(code: string, dark = false): ReactNode {
  const palette = dark ? DARK_COLOR : LIGHT_COLOR;
  return tokenizePython(code).map((t, i) => {
    const color = palette[t.type];
    const style: CSSProperties | undefined =
      t.type === "comment" ? { fontStyle: "italic" } : undefined;
    return (
      <span
        key={i}
        ref={(el) => {
          if (el) el.style.setProperty("color", color, "important");
        }}
        style={style}
      >
        {t.text}
      </span>
    );
  });
}
