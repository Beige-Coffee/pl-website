// ────────────────────────────────────────────────────────────────────────────
// KeyDerivationCard
//
// Shared visual for "this source secret derives these keys via HMAC."
// Used by ForwarderPeelDiagram, WrapTraceDiagram, PeelTraceDiagram,
// ValidationFlowDiagram, the error pair (ErrorBoomerang / ErrorUnwrap), and
// OperationsLifecycle. One component, many callsites — the look stays
// consistent course-wide.
//
// Layout (vertical pipeline, reads top-to-bottom as the actual derivation):
//
//      ┌ header bar (accent-tinted) ──────────────────────────────┐
//
//          [ e_AD ]          [ dave_pubkey ]      ← two input chips
//              \                  /
//               ── ECDH (SHA256) ──               ← op label on the join
//                       │
//                       ▼
//                  [  ss_AD  ]  shared secret     ← the source chip
//                   /         \
//            HMAC('rho')   HMAC('mu')             ← op label on each fork
//                ▼             ▼
//            [ rho_D ]     [ mu_D ]               ← key chips
//            stream cipher  packet HMAC           ← role, small, under each key
//
// The convergence (two inputs → one secret) and the fork (one secret → 1-2
// keys) are the lesson, so both branchings are drawn explicitly with light
// SVG connector lines. When there is no `upstream`, the inputs row + converge
// are skipped and the pipeline simply starts at the source chip and forks
// down. Active rows pick up a gold ring + tinted key-chip background.
// ────────────────────────────────────────────────────────────────────────────

import { useRef, useState, type ReactNode } from "react";
import { MathLine } from "./mathTokens";

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const INK = "#0f172a";
const NEUTRAL_TEXT = "#475569";
const FOCUS_GOLD = "#b8860b";
const CREAM = "#fffdf5";

export interface KeyDerivationRow {
  /** The HMAC formula, e.g. `HMAC('rho', ss_AB)`. */
  formula: string;
  /** The output key name, e.g. `rho_B`. */
  keyName: string;
  /** The key's byte count (rendered next to the name), e.g. `32 bytes`. */
  bytes: string;
  /** Short role description, e.g. `Stream cipher key`. */
  useTitle: string;
  /** Optional secondary line under the role, e.g. `used in step 5 (XOR pass)`. */
  useSubtitle?: string;
  /** Accent color for this row (formula label + key chip border + text). */
  color: string;
  /** Highlight this row as the currently-active key (gold ring on the chip). */
  active?: boolean;
}

export interface EcdhUpstream {
  /** First ECDH input (typically a scalar / private key). */
  inputA: { name: string; subtitle: string };
  /** Second ECDH input (typically a curve point / public key). */
  inputB: { name: string; subtitle: string };
  /** Optional override for the formula label. Defaults to
   * `SHA256(<inputA> · <inputB>)`. */
  formulaOverride?: string;
}

export interface KeyDerivationCardProps {
  /** Header bar title, e.g. `Bob derives two keys from ss_AB`. */
  title: string;
  /** The source secret. */
  source: {
    name: string;
    subtitle: string;
    accent: string; // border + accent color for the source box and header bar
  };
  /** 1–2 derivation rows. */
  rows: KeyDerivationRow[];
  /** When provided, renders an ECDH convergence above the source chip
   * showing how the source secret itself is derived (e.g. for Bob's peel:
   * `bob_privkey · E_AB` → `ss_AB`). */
  upstream?: EcdhUpstream;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// A short vertical down-arrow drawn in SVG so it reads as a real arrowhead.
function DownArrow({ color, height = 16 }: { color: string; height?: number }) {
  return (
    <svg
      width={14}
      height={height}
      viewBox={`0 0 14 ${height}`}
      style={{ display: "block" }}
      aria-hidden
    >
      <line x1={7} y1={0} x2={7} y2={height - 6} stroke={color} strokeWidth={1.5} />
      <polygon
        points={`7,${height} 3,${height - 7} 11,${height - 7}`}
        fill={color}
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function KeyDerivationCard({
  title,
  source,
  rows,
  upstream,
}: KeyDerivationCardProps) {
  return (
    <div
      className="my-4 mx-auto border-[1.5px] overflow-hidden"
      style={{
        borderColor: source.accent,
        background: CREAM,
        maxWidth: 460,
        fontFamily: SANS,
      }}
    >
      {/* Header bar — accent-tinted (correct for the sub-card, §7). */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          background: `${source.accent}18`,
          borderBottom: `1.5px solid ${source.accent}40`,
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: source.accent }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: source.accent }}
        >
          {title}
        </span>
      </div>

      {/* Vertical pipeline. */}
      <div className="px-4 pt-3 pb-4 flex flex-col items-center">
        {upstream && (
          <Converge upstream={upstream} accent={source.accent} />
        )}

        <SourceChip source={source} />

        <Fork rows={rows} sourceAccent={source.accent} />
      </div>
    </div>
  );
}

// ── Inputs row + convergence (only when `upstream` is set) ───────────────────
//
// Two input chips side by side. Light SVG lines drop from each chip's bottom
// edge and meet at a center point; the ECDH operation rides that join, and a
// short down-arrow carries the merged result into the source chip below.

function Converge({
  upstream,
  accent,
}: {
  upstream: EcdhUpstream;
  accent: string;
}) {
  const formula =
    upstream.formulaOverride ??
    `SHA256(${upstream.inputA.name} · ${upstream.inputB.name})`;

  // The connector SVG spans the full pipeline width; the two lines start under
  // each chip (~25% / ~75%) and converge to the center (50%).
  const CONNECT_W = 300;
  const CONNECT_H = 26;
  const leftX = CONNECT_W * 0.25;
  const rightX = CONNECT_W * 0.75;
  const midX = CONNECT_W / 2;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Two input chips. */}
      <div className="flex items-stretch justify-center gap-3 w-full">
        <InputChip
          name={upstream.inputA.name}
          subtitle={upstream.inputA.subtitle}
          accent={accent}
        />
        <InputChip
          name={upstream.inputB.name}
          subtitle={upstream.inputB.subtitle}
          accent={accent}
        />
      </div>

      {/* Converging connector lines. */}
      <svg
        width="100%"
        viewBox={`0 0 ${CONNECT_W} ${CONNECT_H}`}
        preserveAspectRatio="none"
        height={CONNECT_H}
        style={{ display: "block", maxWidth: CONNECT_W }}
        aria-hidden
      >
        <line
          x1={leftX}
          y1={0}
          x2={midX}
          y2={CONNECT_H}
          stroke={accent}
          strokeWidth={1.5}
          opacity={0.8}
        />
        <line
          x1={rightX}
          y1={0}
          x2={midX}
          y2={CONNECT_H}
          stroke={accent}
          strokeWidth={1.5}
          opacity={0.8}
        />
      </svg>

      {/* ECDH operation label, riding the join. */}
      <div className="flex items-center gap-1.5" style={{ marginTop: 1 }}>
        <span
          className="text-[10px] uppercase tracking-[0.06em] font-bold"
          style={{ fontFamily: SANS, color: accent }}
        >
          ECDH
        </span>
        <MathLine
          text={formula}
          color={NEUTRAL_TEXT}
          weight={600}
          fontSize={11}
        />
      </div>

      {/* Down-arrow into the source chip. */}
      <DownArrow color={accent} height={16} />
    </div>
  );
}

function InputChip({
  name,
  subtitle,
  accent,
}: {
  name: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div
      className="px-3 py-1.5 rounded-md flex flex-col items-center justify-center text-center"
      style={{
        border: `1.5px solid ${accent}`,
        background: CREAM,
        opacity: 0.92,
        minWidth: 110,
        maxWidth: 150,
      }}
    >
      <MathLine text={name} color={INK} weight={700} fontSize={13} />
      <span
        className="text-[9px] leading-tight mt-0.5"
        style={{ fontFamily: SANS, color: NEUTRAL_TEXT, fontStyle: "italic" }}
      >
        {subtitle}
      </span>
    </div>
  );
}

// ── Source chip (the shared secret) ─────────────────────────────────────────

function SourceChip({
  source,
}: {
  source: KeyDerivationCardProps["source"];
}) {
  return (
    <div
      className="px-4 py-2 rounded-md flex flex-col items-center justify-center text-center"
      style={{
        border: `1.5px solid ${source.accent}`,
        background: CREAM,
        minWidth: 140,
      }}
    >
      <MathLine text={source.name} color={INK} weight={700} fontSize={16} />
      <span
        className="text-[10px] leading-tight mt-0.5"
        style={{ fontFamily: SANS, color: NEUTRAL_TEXT, fontStyle: "italic" }}
      >
        {source.subtitle}
      </span>
    </div>
  );
}

// ── Fork (source → 1-2 key chips) ────────────────────────────────────────────
//
// Light SVG lines fan from the source chip's bottom-center out to each key
// column. The HMAC formula rides each fork (as the arrow's label, not a box);
// a short down-arrow drops into the key chip.

function Fork({
  rows,
  sourceAccent,
}: {
  rows: KeyDerivationRow[];
  sourceAccent: string;
}) {
  const count = rows.length;

  // Connector SVG: lines start at the source's bottom-center (top-middle of
  // this SVG) and fan out to each column's center.
  const CONNECT_W = 300;
  const CONNECT_H = 24;
  const midX = CONNECT_W / 2;
  // Column centers: one → centered; two → ~25% / ~75%.
  const colX = (i: number): number =>
    count === 1 ? midX : i === 0 ? CONNECT_W * 0.25 : CONNECT_W * 0.75;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Fork connector lines. */}
      <svg
        width="100%"
        viewBox={`0 0 ${CONNECT_W} ${CONNECT_H}`}
        preserveAspectRatio="none"
        height={CONNECT_H}
        style={{ display: "block", maxWidth: CONNECT_W }}
        aria-hidden
      >
        {rows.map((row, i) => (
          <line
            key={row.keyName}
            x1={midX}
            y1={0}
            x2={colX(i)}
            y2={CONNECT_H}
            stroke={row.color}
            strokeWidth={1.5}
            opacity={row.active === false ? 0.4 : 0.8}
          />
        ))}
      </svg>

      {/* One column per key: formula label, down-arrow, key chip, role. */}
      <div
        className={
          count === 1
            ? "flex justify-center w-full"
            : "grid w-full"
        }
        style={
          count === 1
            ? undefined
            : { gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }
        }
      >
        {rows.map((row) => (
          <ForkColumn key={row.keyName} row={row} />
        ))}
      </div>
    </div>
  );
}

function ForkColumn({ row }: { row: KeyDerivationRow }) {
  const dim = row.active === false;
  const chipFill = row.active
    ? hexToRgba(row.color, 0.22)
    : hexToRgba(row.color, 0.1);

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ opacity: dim ? 0.55 : 1, maxWidth: 200, marginInline: "auto" }}
    >
      {/* HMAC formula — the operation label on the fork arrow. */}
      <MathLine
        text={row.formula}
        color={row.color}
        weight={700}
        fontSize={11}
      />

      <DownArrow color={row.color} height={14} />

      {/* Key chip (gold ring + tinted fill when active). */}
      <div
        className="px-3 py-1.5 rounded-md flex items-baseline justify-center gap-1.5"
        style={{
          border: `${row.active ? 2 : 1.5}px solid ${
            row.active ? FOCUS_GOLD : row.color
          }`,
          background: chipFill,
          boxShadow: row.active
            ? `0 0 0 3px ${hexToRgba(FOCUS_GOLD, 0.22)}`
            : "none",
          minWidth: 96,
        }}
      >
        <MathLine text={row.keyName} color={row.color} weight={700} fontSize={16} />
        <span
          className="text-[9px]"
          style={{
            fontFamily: MONO,
            color: row.color,
            opacity: 0.75,
            fontStyle: "italic",
          }}
        >
          {row.bytes}
        </span>
      </div>

      {/* Role, small, under the key. */}
      <span
        className="text-[10px] leading-tight font-bold mt-1"
        style={{ fontFamily: SANS, color: INK }}
      >
        {row.useTitle}
      </span>
      {row.useSubtitle && (
        <span
          className="text-[9px] leading-tight"
          style={{ fontFamily: SANS, color: NEUTRAL_TEXT, fontStyle: "italic" }}
        >
          {row.useSubtitle}
        </span>
      )}
    </div>
  );
}

// ── KeyHoverIcon: compact reminder of the derivation ──────────────────────
//
// Course-wide progressive-disclosure pattern: show the full KeyDerivationCard
// once on the beat where the derivation is introduced (so the student grounds
// where the keys come from), then on subsequent beats — where the same keys
// are simply *used* — render this small icon instead. Hovering the icon
// expands the full card as a popover.
//
// Visual: a small gold-bordered key glyph + "keys" label. Hover produces a
// viewport-clamped popover showing the same card content the caller would
// have rendered inline. Click also pins/unpins the popover so touch devices
// have a way in (no hover on mobile).
//
// Place this icon top-right of the operation view it belongs to, so the
// reader's eye lands there *after* reading the operation.

export function KeyHoverIcon(props: KeyDerivationCardProps & { className?: string }) {
  const [shown, setShown] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The pipeline card is narrower than the old SVG card; size the popover to
  // match its max width plus a little breathing room.
  const POPOVER_W = 480;

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    // Try to right-align the popover with the trigger; clamp into viewport.
    let left = r.right - POPOVER_W;
    if (left < margin) left = margin;
    if (left + POPOVER_W > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_W - margin;
    }
    // Prefer below the icon if there's room; else above.
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < 280;
    const top = above ? r.top - 8 : r.bottom + 8;
    setPos({ left, top, above });
  }

  const visible = shown || pinned;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => {
          updatePos();
          setShown(true);
        }}
        onMouseLeave={() => setShown(false)}
        onFocus={() => {
          updatePos();
          setShown(true);
        }}
        onBlur={() => setShown(false)}
        onClick={() => {
          if (!pinned) updatePos();
          setPinned((p) => !p);
        }}
        aria-label="View key derivation"
        aria-expanded={visible}
        className={props.className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          border: `1.5px solid ${FOCUS_GOLD}`,
          background: pinned ? "#fef3c7" : CREAM,
          color: FOCUS_GOLD,
          cursor: "help",
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          boxShadow: pinned
            ? `0 0 0 3px rgba(184,134,11,0.18)`
            : "none",
        }}
      >
        <KeyGlyph />
        <span>keys</span>
      </button>
      {visible && (
        <div
          role="dialog"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.above ? undefined : pos.top,
            bottom: pos.above ? window.innerHeight - pos.top : undefined,
            width: Math.min(POPOVER_W, window.innerWidth - 16),
            zIndex: 50,
            pointerEvents: pinned ? "auto" : "none",
            // Drop shadow makes the popover read as floating above the page.
            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))",
          }}
        >
          <KeyDerivationCard {...props} />
        </div>
      )}
    </>
  );
}

// Inline SVG key glyph — single color, sized to match adjacent text.
function KeyGlyph(): ReactNode {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={8} cy={15} r={4} />
      <path d="M10.85 12.15L20 3" />
      <path d="M15.5 7.5L18 10" />
    </svg>
  );
}

export default KeyDerivationCard;
