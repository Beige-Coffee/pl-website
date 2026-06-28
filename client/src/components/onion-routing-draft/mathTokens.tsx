// Shared math typography for onion-routing diagrams.
//
// Renders expressions like "e_AB", "ss_AC", "bf_AD" with proper math
// typography: italic single-letter base + true HTML subscripts. Multi-letter
// bases (ss, bf) and function names (SHA256, HMAC) stay upright per math
// convention. Operators (·, ‖, ⊕, =) get explicit horizontal spacing.
//
// Per-token hover tooltips are preserved (HoverTip) so the whole
// math-token apparatus can replace the previous mono-only renderer
// without losing pedagogical functionality.

import { useRef, useState, type ReactNode } from "react";

const INK = "#0f172a";
const MONO = '"JetBrains Mono", "Fira Code", monospace';
const TIP_WIDTH = 260;

// ── HoverTip with viewport-clamped fixed positioning ───────────────────────

export function HoverTip({ children, info }: { children: ReactNode; info: string }) {
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: true });
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const desiredX = r.left + r.width / 2 - TIP_WIDTH / 2;
    const x = Math.max(
      margin,
      Math.min(window.innerWidth - TIP_WIDTH - margin, desiredX)
    );
    const aboveY = r.top - 10;
    const fitsAbove = aboveY > 100;
    const y = fitsAbove ? aboveY : r.bottom + 10;
    setPos({ x, y, above: fitsAbove });
    setShown(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setShown(false)}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      {shown && (
        <span
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.above ? undefined : pos.y,
            bottom: pos.above ? window.innerHeight - pos.y : undefined,
            width: TIP_WIDTH,
            zIndex: 50,
            padding: "8px 10px",
            background: "#fffdf5",
            color: INK,
            border: "1.5px solid #0f172a",
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontWeight: 400,
            letterSpacing: "0.01em",
            whiteSpace: "normal",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          {info}
        </span>
      )}
    </span>
  );
}

// ── Math rendering primitives ───────────────────────────────────────────────

function splitToken(token: string): { base: string; sub: string | null } {
  const idx = token.indexOf("_");
  if (idx === -1) return { base: token, sub: null };
  let sub = token.slice(idx + 1);
  // Allow LaTeX-style braces around multi-character subscripts:
  //   "E_{i+1}" → sub "i+1" (not "{i+1}")
  if (sub.startsWith("{") && sub.endsWith("}")) {
    sub = sub.slice(1, -1);
  }
  return { base: token.slice(0, idx), sub };
}

function shouldItalicize(base: string): boolean {
  // Single-letter math vars italic; multi-letter (ss, bf, rho, mu) and
  // function names (SHA256, HMAC, ECDH) upright.
  return base.length === 1 && /^[a-zA-Z]$/.test(base);
}

function shouldItalicizeSub(sub: string): boolean {
  // Italicize single-letter subscript indices (i, j, k, n) per math
  // convention. Uppercase labels (AB, AC, AD) stay upright because they're
  // identifying labels, not variables.
  return sub.length === 1 && /^[a-z]$/.test(sub);
}

export function renderMath(token: string): ReactNode {
  const { base, sub } = splitToken(token);
  const italicBase = shouldItalicize(base);
  const italicSub = sub !== null && shouldItalicizeSub(sub);
  return (
    <>
      <span style={{ fontStyle: italicBase ? "italic" : "normal" }}>{base}</span>
      {sub !== null && (
        <sub
          style={{
            fontSize: "0.8em",
            verticalAlign: "baseline",
            position: "relative",
            top: "0.3em",
            marginLeft: "1px",
            letterSpacing: "0.05em",
            fontStyle: italicSub ? "italic" : "normal",
          }}
        >
          {sub}
        </sub>
      )}
    </>
  );
}

// ── Math-base allowlist ────────────────────────────────────────────────────
//
// Disambiguates math tokens (`mu_B`, `ss_AB`, `bf_AB`, `E_AC`) from
// identifiers that happen to contain underscores (`hop_payloads`,
// `associated_data`, `payment_hash`). Math tokens get LaTeX-style typography
// (italic single-letter base, subscripted suffix). Identifiers render
// as-is.
//
// We deliberately keep the SPELLED-OUT NAMES (mu, rho, etc.) instead of
// substituting Greek glyphs (μ, ρ), the names are how the curriculum
// introduces these keys, so showing the symbol before the symbol is
// taught risks confusing newer readers.

// Multi-letter math bases that stay upright (per math convention) but are
// still treated as "math tokens" for subscript parsing. Add new conventions
// here, not in scattered ad-hoc checks.
// "mu", "rho" = Greek-named BOLT 4 keys (forward direction)
// "um", "ammag" = BOLT 4 keys (return direction)
// "ss"  = shared secret
// "bf"  = blinding factor
// Other Greek names (alpha, beta, sigma, theta, lambda, omega, phi, psi,
// chi, eta, pi, tau, kappa, gamma, delta, xi, iota, zeta, nu) are also
// allowed in case future course material uses them.
const MATH_MULTI_BASES = new Set([
  "mu", "rho", "um", "ammag",
  "ss", "bf",
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
  "iota", "kappa", "lambda", "nu", "xi", "omicron", "pi", "sigma", "tau",
  "upsilon", "phi", "chi", "psi", "omega",
]);

function isMathBase(base: string): boolean {
  if (base.length === 1 && /^[a-zA-Z]$/.test(base)) return true;
  if (MATH_MULTI_BASES.has(base)) return true;
  return false;
}

function renderBase(base: string): { glyph: string; italic: boolean } {
  // Single Latin letter → italic (math convention for variables).
  if (base.length === 1 && /^[a-zA-Z]$/.test(base)) {
    return { glyph: base, italic: true };
  }
  // Multi-letter math base (mu, rho, ss, etc.) → upright, name as-is.
  return { glyph: base, italic: false };
}

// ── MathLine: parse and render an inline math expression ───────────────────
//
// Takes a formula string like:
//   "HMAC(mu_B, hop_payloads ‖ associated_data)"
//   "bf_AB = SHA256(E_AB ‖ ss_AB)"
//   "chacha20(rho_B, 2600)"
//
// Tokenizes into function calls, math tokens (with Greek substitution and
// subscript rendering), snake_case identifiers (rendered as-is), operators
// (with spacing), string literals, numbers, and punctuation. Each kind
// gets the appropriate typography.

type LineTok =
  | { kind: "fn"; name: string }       // function name, followed by '('
  | { kind: "math"; base: string; sub: string | null } // mu_B, E_AB, b
  | { kind: "ident"; text: string }    // hop_payloads, session_key
  | { kind: "string"; text: string }   // 'mu', "pad" (kept with quotes)
  | { kind: "number"; text: string }   // 1300, 2,600
  | { kind: "op"; text: string }       // ‖ ⊕ = + · → ←
  | { kind: "punct"; text: string }    // ( ) , [ ]
  | { kind: "space"; text: string }    // whitespace runs
  | { kind: "raw"; text: string };     // anything else, passed through

const OPS = new Set(["‖", "⊕", "=", "+", "·", "→", "←", "↓", "↑", "?", "!"]);
const PUNCT = new Set(["(", ")", "[", "]", "{", "}", ",", ":", ";"]);

function tokenizeMathLine(text: string): LineTok[] {
  const out: LineTok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];

    // whitespace
    if (/\s/.test(c)) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      out.push({ kind: "space", text: text.slice(i, j) });
      i = j;
      continue;
    }

    // string literal: '...' or "..."
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      while (j < text.length && text[j] !== quote) j++;
      const end = j < text.length ? j + 1 : j;
      out.push({ kind: "string", text: text.slice(i, end) });
      i = end;
      continue;
    }

    // number (allows commas: "2,600")
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < text.length && /[0-9,]/.test(text[j])) j++;
      // strip trailing comma if it looks like punctuation
      let end = j;
      while (end > i + 1 && text[end - 1] === ",") end--;
      out.push({ kind: "number", text: text.slice(i, end) });
      i = end;
      continue;
    }

    // identifier-or-math token: letters, optionally with _suffix segments
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_]/.test(text[j])) j++;
      const word = text.slice(i, j);
      i = j;
      // Function call: token immediately followed by '('
      if (text[i] === "(") {
        out.push({ kind: "fn", name: word });
        continue;
      }
      // Math token: base[_sub] where base is in the allowlist
      const usIdx = word.indexOf("_");
      if (usIdx === -1) {
        if (isMathBase(word)) {
          out.push({ kind: "math", base: word, sub: null });
        } else {
          out.push({ kind: "ident", text: word });
        }
      } else {
        const base = word.slice(0, usIdx);
        const sub = word.slice(usIdx + 1);
        if (isMathBase(base)) {
          out.push({ kind: "math", base, sub });
        } else {
          // snake_case identifier - keep intact
          out.push({ kind: "ident", text: word });
        }
      }
      continue;
    }

    // operator
    if (OPS.has(c)) {
      out.push({ kind: "op", text: c });
      i++;
      continue;
    }

    // punctuation
    if (PUNCT.has(c)) {
      out.push({ kind: "punct", text: c });
      i++;
      continue;
    }

    // anything else (e.g., a literal · without surrounding spaces) - raw
    out.push({ kind: "raw", text: c });
    i++;
  }
  return out;
}

function shouldItalicizeSubChar(sub: string): boolean {
  // Italicize single-letter lowercase indices (i, j, k, n) per convention.
  return sub.length === 1 && /^[a-z]$/.test(sub);
}

export function MathLine({
  text,
  color,
  weight = 700,
  fontSize,
  className,
  inline,
}: {
  text: string;
  color?: string;
  weight?: number;
  fontSize?: number | string;
  className?: string;
  /**
   * When true, MathLine inherits font-family, color, weight, and size from
   * its parent - only the math typography (subscripts, italic single-letter
   * bases, operator spacing) is applied. Use for math inside headings and
   * inside backtick-styled code pills where the parent already provides
   * font styling. Defaults to false (headline-style formula in MONO).
   */
  inline?: boolean;
}) {
  const tokens = tokenizeMathLine(text);
  const ink = color ?? INK;

  return (
    <span
      className={className}
      style={
        inline
          ? { whiteSpace: "normal" }
          : {
              fontFamily: MONO,
              color: ink,
              fontWeight: weight,
              fontSize,
              whiteSpace: "nowrap",
            }
      }
    >
      {tokens.map((t, idx) => {
        switch (t.kind) {
          case "fn":
            return (
              <span key={idx} style={{ fontWeight: weight }}>
                {t.name}
              </span>
            );
          case "math": {
            const { glyph, italic } = renderBase(t.base);
            const subItalic = t.sub !== null && shouldItalicizeSubChar(t.sub);
            return (
              <span key={idx}>
                <span style={{ fontStyle: italic ? "italic" : "normal" }}>
                  {glyph}
                </span>
                {t.sub !== null && (
                  <sub
                    style={{
                      fontSize: "0.78em",
                      verticalAlign: "baseline",
                      position: "relative",
                      top: "0.3em",
                      marginLeft: "1px",
                      letterSpacing: "0.04em",
                      fontStyle: subItalic ? "italic" : "normal",
                    }}
                  >
                    {t.sub}
                  </sub>
                )}
              </span>
            );
          }
          case "ident":
            return <span key={idx}>{t.text}</span>;
          case "string":
            // Render quoted strings with slightly muted color to read as
            // string literals.
            return (
              <span key={idx} style={{ opacity: 0.85 }}>
                {t.text}
              </span>
            );
          case "number":
            return <span key={idx}>{t.text}</span>;
          case "op": {
            // Give operators horizontal breathing room.
            const margin = t.text === "=" ? "0 7px" : "0 5px";
            return (
              <span key={idx} style={{ margin }}>
                {t.text}
              </span>
            );
          }
          case "punct":
            return <span key={idx}>{t.text}</span>;
          case "space":
            return <span key={idx}>{t.text}</span>;
          case "raw":
            return <span key={idx}>{t.text}</span>;
        }
      })}
    </span>
  );
}

// ── MathLineSvg: same parse, rendered via <tspan> for SVG <text> nodes ────
//
// SVG can't host <span> or <sub>. We emit a flat list of <tspan> children
// with italic/baseline-shift attributes to approximate the HTML rendering.
// Pass these inside an SVG <text> element: <text>{mathLineToSvgTspans(...)}
// </text>.

export function mathLineToSvgTspans(text: string): ReactNode[] {
  const tokens = tokenizeMathLine(text);
  const nodes: ReactNode[] = [];
  tokens.forEach((t, idx) => {
    switch (t.kind) {
      case "fn":
        nodes.push(<tspan key={idx}>{t.name}</tspan>);
        break;
      case "math": {
        const { glyph, italic } = renderBase(t.base);
        const subItalic = t.sub !== null && shouldItalicizeSubChar(t.sub);
        nodes.push(
          <tspan key={`${idx}-b`} fontStyle={italic ? "italic" : "normal"}>
            {glyph}
          </tspan>
        );
        if (t.sub !== null) {
          nodes.push(
            <tspan
              key={`${idx}-s`}
              fontSize="0.7em"
              dy="0.35em"
              fontStyle={subItalic ? "italic" : "normal"}
            >
              {t.sub}
            </tspan>
          );
          // Reset baseline for the next glyph.
          nodes.push(
            <tspan key={`${idx}-r`} dy="-0.35em">
              {""}
            </tspan>
          );
        }
        break;
      }
      case "ident":
      case "number":
      case "punct":
      case "space":
      case "raw":
        nodes.push(<tspan key={idx}>{t.text}</tspan>);
        break;
      case "string":
        nodes.push(
          <tspan key={idx} opacity="0.85">
            {t.text}
          </tspan>
        );
        break;
      case "op": {
        const pad = t.text === "=" ? " " : " ";
        nodes.push(
          <tspan key={idx}>{pad}{t.text}{pad}</tspan>
        );
        break;
      }
    }
  });
  return nodes;
}

// ── Token (mono + math typography + optional hoverable) ────────────────────

export function Tok({
  token,
  color,
  info,
  weight = 700,
  size,
  dataToken,
}: {
  token: string;
  color?: string;
  info?: string;
  weight?: number;
  size?: number | string;
  // When set, emits data-math-token="..." on the rendered span so external
  // code (e.g., diagrams that want to anchor arrows to specific tokens)
  // can locate it via querySelector. Defaults to the token name.
  dataToken?: string | null;
}) {
  const styled = (
    <span
      data-math-token={dataToken === null ? undefined : (dataToken ?? token)}
      style={{
        fontFamily: MONO,
        color: color ?? INK,
        fontWeight: weight,
        fontSize: size,
      }}
    >
      {renderMath(token)}
    </span>
  );
  if (!info) return styled;
  return <HoverTip info={info}>{styled}</HoverTip>;
}

// Code-styled inline token for use inside captions/prose. Math typography
// + subtle background pill.
export function Code({
  token,
  color,
  info,
}: {
  token: string;
  color?: string;
  info?: string;
}) {
  const styled = (
    <span
      style={{
        fontFamily: MONO,
        color: color ?? INK,
        fontWeight: 700,
        background: "rgba(15,23,42,0.06)",
        padding: "1px 5px",
        fontSize: "0.92em",
      }}
    >
      {renderMath(token)}
    </span>
  );
  if (!info) return styled;
  return <HoverTip info={info}>{styled}</HoverTip>;
}

// Operator with explicit math spacing.
export function Op({
  op,
  info,
  color,
}: {
  op: string;
  info?: string;
  color?: string;
}) {
  const margin = op === "=" ? "0 7px" : "0 5px";
  const styled = (
    <span
      style={{
        fontFamily: MONO,
        margin,
        fontWeight: 700,
        color: color ?? INK,
      }}
    >
      {op}
    </span>
  );
  if (!info) return styled;
  return <HoverTip info={info}>{styled}</HoverTip>;
}

// Function call: name(...) with the name attached tightly to its parens.
export function Fn({
  name,
  info,
  color,
  children,
}: {
  name: string;
  info?: string;
  color?: string;
  children: ReactNode;
}) {
  const fnSpan = (
    <span
      style={{
        fontFamily: MONO,
        fontWeight: 700,
        color: color ?? INK,
      }}
    >
      {name}
    </span>
  );
  return (
    <>
      {info ? <HoverTip info={info}>{fnSpan}</HoverTip> : fnSpan}
      <span style={{ fontFamily: MONO, fontWeight: 700, color: color ?? INK }}>(</span>
      {children}
      <span style={{ fontFamily: MONO, fontWeight: 700, color: color ?? INK }}>)</span>
    </>
  );
}
