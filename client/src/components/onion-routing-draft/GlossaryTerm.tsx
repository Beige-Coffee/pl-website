// ────────────────────────────────────────────────────────────────────────────
// GlossaryTerm
//
// Wraps an already-rendered inline term (a `<code>` pill, an <m> math token, or
// a plain word) with a subtle "definable" affordance + a hover/tap popover that
// shows the glossary definition. Used by the tutorial page's code / <m> / <g>
// handlers: they pass the raw token as `term` and the rendered element as
// `children`. If the token is not a glossary term, the children render untouched.
//
// The popover is portaled to document.body (always in front, never clipped) and
// viewport-clamped. Hover opens it; click pins it (so touch + reading the
// definition both work). Style matches the course tooltip standard (cream, ink
// border, soft shadow).
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  resolveGlossary,
  GLOSSARY_CATEGORY_COLOR,
  type GlossaryEntry,
} from "./glossary";
import { renderCaption } from "./captionMarkup";
import { MathLine } from "./mathTokens";

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const INK = "#0f172a";
const SLATE = "#475569";
const POP_W = 320;

export function GlossaryTerm({
  term,
  children,
  wash,
}: {
  term: string;
  children: ReactNode;
  /** Gold-tint the wrapper itself. Used for children with no pill of their
   * own (math tokens, plain prose words); code pills tint at the pill. */
  wash?: boolean;
}) {
  const hit = resolveGlossary(term);
  const [shown, setShown] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, above: false });
  const ref = useRef<HTMLSpanElement>(null);

  // Not a glossary term: render the original element untouched.
  if (!hit) return <>{children}</>;
  const { entry } = hit;

  function place() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let left = r.left + r.width / 2 - POP_W / 2;
    left = Math.max(margin, Math.min(window.innerWidth - POP_W - margin, left));
    const above = window.innerHeight - r.bottom < 220;
    const top = above ? r.top - 6 : r.bottom + 6;
    setPos({ left, top, above });
  }

  const visible = shown || pinned;
  const popRef = useRef<HTMLDivElement>(null);

  // The popover is position: fixed, so it can't track its anchor once the
  // page moves. Dismiss it on any scroll, on pointer-down outside the term
  // and the popover, and on Escape, so a pinned definition never lingers
  // detached from the text it belongs to.
  useEffect(() => {
    if (!visible) return;
    const close = () => {
      setPinned(false);
      setShown(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onScroll = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="button"
        aria-label={`Definition of ${term}`}
        onMouseEnter={() => {
          place();
          setShown(true);
        }}
        onMouseLeave={() => setShown(false)}
        onFocus={() => {
          place();
          setShown(true);
        }}
        onBlur={() => setShown(false)}
        onClick={() => {
          if (!pinned) place();
          setPinned((p) => !p);
        }}
        style={{
          // Gold dotted underline = "this opens a definition" (full gold when
          // pinned, softer gold at rest). Pairs with the gold pill/wash tint.
          borderBottom: `1px dotted ${pinned ? "#b8860b" : "#b8860bb3"}`,
          cursor: "help",
          // Keep the dotted line a hair below the text / code pill.
          paddingBottom: 1,
          ...(wash
            ? {
                background: "rgba(184,134,11,0.11)",
                borderRadius: 3,
                padding: "0 3px 1px",
              }
            : null),
        }}
      >
        {children}
      </span>
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.above ? undefined : pos.top,
              bottom: pos.above ? window.innerHeight - pos.top : undefined,
              width: POP_W,
              zIndex: 9999,
              background: "#fffdf5",
              border: `1.5px solid ${INK}`,
              boxShadow: "0 8px 30px rgba(0,0,0,0.22)",
              padding: "11px 13px",
              fontFamily: SANS,
              pointerEvents: pinned ? "auto" : "none",
            }}
          >
            <GlossaryBody term={term} entry={entry} />
          </div>,
          document.body,
        )}
    </>
  );
}

function TermHeader({ term, entry }: { term: string; entry: GlossaryEntry }) {
  if (entry.render === "math") {
    return <MathLine text={term} color={INK} fontSize={15} />;
  }
  if (entry.render === "code") {
    return (
      <span
        style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK }}
      >
        {term}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{term}</span>
  );
}

function GlossaryBody({ term, entry }: { term: string; entry: GlossaryEntry }) {
  const color = GLOSSARY_CATEGORY_COLOR[entry.category];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <TermHeader term={term} entry={entry} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color,
            background: `${color}14`,
            border: `1px solid ${color}40`,
            borderRadius: 3,
            padding: "1px 5px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {entry.category}
        </span>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: INK }}>
        {renderCaption(entry.definition)}
      </div>

      {entry.formula && (
        <div
          style={{
            marginTop: 7,
            paddingTop: 6,
            borderTop: `1px solid rgba(15,23,42,0.1)`,
          }}
        >
          <MathLine text={entry.formula} color={SLATE} fontSize={11.5} />
        </div>
      )}

      {/* Python def line, verbatim mono (NOT math-tokenized): the "your
          function" entries show their signature exactly as the editor does. */}
      {entry.signature && (
        <div
          style={{
            marginTop: 7,
            padding: "5px 7px",
            background: "rgba(15,23,42,0.04)",
            border: "1px solid rgba(15,23,42,0.10)",
            borderRadius: 3,
            fontFamily: MONO,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: INK,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {entry.signature}
        </div>
      )}

      {entry.chapter && (
        <div
          style={{
            marginTop: 7,
            fontSize: 9.5,
            color: SLATE,
            fontStyle: "italic",
          }}
        >
          {entry.category === "your function"
            ? `You build this in chapter ${entry.chapter}`
            : `Introduced in chapter ${entry.chapter}`}
        </div>
      )}
    </div>
  );
}

export default GlossaryTerm;
