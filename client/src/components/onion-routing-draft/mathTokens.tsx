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
            background: INK,
            color: "#fffdf5",
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
