// ────────────────────────────────────────────────────────────────────────────
// KeyDerivationCard
//
// Shared visual for "this source secret derives these keys via HMAC."
// Used by ForwarderPeelDiagram (Bob derives mu_B + rho_B at peel time) and
// WrapTraceDiagram (Alice derives pad_key at init, and rho_i + mu_i per
// iteration during the wrap). One component, two callsites — the look stays
// consistent course-wide.
//
// Layout (SVG-based, mirroring the original ForwarderPeelDiagram pattern):
//   [source box] ──curved──▶ [formula box] ──arrow──▶ [key chip]
//                ╲────────▶ [formula box] ──arrow──▶ [key chip]
// One row for pad_key, two rows for per-hop keys. Active rows pick up a
// gold glow + tinted key-chip background; inactive rows hold their natural
// color but read as secondary.
// ────────────────────────────────────────────────────────────────────────────

import { useRef, useState, type ReactNode } from "react";
import { mathLineToSvgTspans } from "./mathTokens";

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const INK = "#0f172a";
const NEUTRAL_TEXT = "#475569";
const FOCUS_GOLD = "#b8860b";

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
  /** Accent color for this row (formula border, key chip border + text). */
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
  /** When provided, renders an ECDH derivation panel above the main rows
   * showing how the source secret itself is derived (e.g. for Bob's peel:
   * `bob_privkey · E_AB` → `ss_AB`). */
  upstream?: EcdhUpstream;
}

// ── Geometry ──────────────────────────────────────────────────────────────

const VIEW_W = 680;

const SRC_X = 20;
const SRC_W = 140;
const SRC_H = 66;

const FORMULA_X = 210;
const FORMULA_W = 200;
const FORMULA_H = 42;

const KEY_X = 450;
const KEY_W = 210;
const KEY_H = 60;

// Row centerlines. One row → centered; two rows → spaced 62px apart.
function rowCY(i: number, count: number): number {
  if (count === 1) return 50;
  return i === 0 ? 44 : 106;
}

function svgHeight(count: number): number {
  return count === 1 ? 100 : 150;
}

function srcCY(count: number): number {
  return count === 1 ? 50 : 75;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function KeyDerivationCard({
  title,
  source,
  rows,
  upstream,
}: KeyDerivationCardProps) {
  const count = rows.length;
  const height = svgHeight(count);

  return (
    <div
      className="my-4 mx-auto border-[1.5px] overflow-hidden"
      style={{
        borderColor: source.accent,
        background: "#fffdf5",
        maxWidth: 720,
        fontFamily: SANS,
      }}
    >
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

      {upstream && (
        <div
          className="px-3 pt-3"
          style={{
            borderBottom: `1px dashed ${source.accent}40`,
            paddingBottom: 10,
          }}
        >
          <UpstreamEcdh
            upstream={upstream}
            sourceName={source.name}
            accent={source.accent}
          />
        </div>
      )}

      <div className="px-3 py-3">
        <svg
          viewBox={`0 0 ${VIEW_W} ${height}`}
          className="w-full"
          style={{ fontFamily: SANS }}
        >
          {/* Source box */}
          <Source source={source} count={count} />

          {/* One connector + formula + arrow + chip per row */}
          {rows.map((row, i) => (
            <Row
              key={row.keyName}
              row={row}
              i={i}
              count={count}
              sourceAccent={source.accent}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Upstream ECDH panel (optional, sits above the main rows) ──────────────
//
// Renders a small "two inputs → ECDH → source" SVG. Used to show *how*
// the source secret got derived in the first place:
//   - Bob's peel:  bob_privkey · E_AB  → SHA256(·) → ss_AB
//   - Alice wrap:  e_AX · X_node_pubkey → SHA256(·) → ss_AX
// Same component handles both directions of ECDH because the math is
// symmetric.

const UPSTREAM_VIEW_W = 680;
const UPSTREAM_HEIGHT = 110;

const UP_IN_X = 20;
const UP_IN_W = 150;
const UP_IN_H = 36;

const UP_FORMULA_X = 230;
const UP_FORMULA_W = 220;
const UP_FORMULA_H = 46;

const UP_OUT_X = 500;
const UP_OUT_W = 160;
const UP_OUT_H = 50;

function UpstreamEcdh({
  upstream,
  sourceName,
  accent,
}: {
  upstream: EcdhUpstream;
  sourceName: string;
  accent: string;
}) {
  const cyA = 30;           // top input centerline
  const cyB = UPSTREAM_HEIGHT - 30; // bottom input centerline
  const cyFormula = UPSTREAM_HEIGHT / 2;
  const cyOut = UPSTREAM_HEIGHT / 2;
  const formula =
    upstream.formulaOverride ??
    `SHA256(${upstream.inputA.name} · ${upstream.inputB.name})`;

  return (
    <svg
      viewBox={`0 0 ${UPSTREAM_VIEW_W} ${UPSTREAM_HEIGHT}`}
      className="w-full"
      style={{ fontFamily: SANS }}
    >
      {/* Input A (top) */}
      <UpstreamInputBox
        x={UP_IN_X}
        cy={cyA}
        name={upstream.inputA.name}
        subtitle={upstream.inputA.subtitle}
        accent={accent}
      />
      {/* Input B (bottom) */}
      <UpstreamInputBox
        x={UP_IN_X}
        cy={cyB}
        name={upstream.inputB.name}
        subtitle={upstream.inputB.subtitle}
        accent={accent}
      />

      {/* Two curved connectors converging on the formula box */}
      <path
        d={`M${UP_IN_X + UP_IN_W},${cyA} C${UP_FORMULA_X - 30},${cyA} ${UP_FORMULA_X - 30},${cyFormula} ${UP_FORMULA_X},${cyFormula}`}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        opacity={0.85}
      />
      <path
        d={`M${UP_IN_X + UP_IN_W},${cyB} C${UP_FORMULA_X - 30},${cyB} ${UP_FORMULA_X - 30},${cyFormula} ${UP_FORMULA_X},${cyFormula}`}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        opacity={0.85}
      />

      {/* ECDH formula box */}
      <rect
        x={UP_FORMULA_X}
        y={cyFormula - UP_FORMULA_H / 2}
        width={UP_FORMULA_W}
        height={UP_FORMULA_H}
        rx={2}
        fill="#fffdf5"
        stroke={accent}
        strokeWidth={1.5}
      />
      <text
        x={UP_FORMULA_X + UP_FORMULA_W / 2}
        y={cyFormula - 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={accent}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(formula)}
      </text>
      <text
        x={UP_FORMULA_X + UP_FORMULA_W / 2}
        y={cyFormula + 14}
        textAnchor="middle"
        fontSize={10}
        fill={NEUTRAL_TEXT}
        style={{ fontStyle: "italic" }}
      >
        ECDH (commutative scalar mul)
      </text>

      {/* Arrow from formula → output */}
      <line
        x1={UP_FORMULA_X + UP_FORMULA_W}
        y1={cyOut}
        x2={UP_OUT_X - 10}
        y2={cyOut}
        stroke={accent}
        strokeWidth={1.5}
      />
      <polygon
        points={`${UP_OUT_X - 4},${cyOut} ${UP_OUT_X - 12},${cyOut - 4} ${UP_OUT_X - 12},${cyOut + 4}`}
        fill={accent}
      />

      {/* Output (source) box */}
      <rect
        x={UP_OUT_X}
        y={cyOut - UP_OUT_H / 2}
        width={UP_OUT_W}
        height={UP_OUT_H}
        rx={2}
        fill="#fffdf5"
        stroke={accent}
        strokeWidth={1.5}
      />
      <text
        x={UP_OUT_X + UP_OUT_W / 2}
        y={cyOut - 2}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill={INK}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(sourceName)}
      </text>
      <text
        x={UP_OUT_X + UP_OUT_W / 2}
        y={cyOut + 14}
        textAnchor="middle"
        fontSize={10}
        fill={NEUTRAL_TEXT}
        style={{ fontStyle: "italic" }}
      >
        32-byte shared secret
      </text>
    </svg>
  );
}

function UpstreamInputBox({
  x,
  cy,
  name,
  subtitle,
  accent,
}: {
  x: number;
  cy: number;
  name: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={cy - UP_IN_H / 2}
        width={UP_IN_W}
        height={UP_IN_H}
        rx={2}
        fill="#fffdf5"
        stroke={accent}
        strokeWidth={1.5}
        opacity={0.85}
      />
      <text
        x={x + UP_IN_W / 2}
        y={cy - 1}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={INK}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(name)}
      </text>
      <text
        x={x + UP_IN_W / 2}
        y={cy + 12}
        textAnchor="middle"
        fontSize={9}
        fill={NEUTRAL_TEXT}
        style={{ fontStyle: "italic" }}
      >
        {subtitle}
      </text>
    </g>
  );
}

function Source({
  source,
  count,
}: {
  source: KeyDerivationCardProps["source"];
  count: number;
}) {
  const cy = srcCY(count);
  return (
    <g>
      <rect
        x={SRC_X}
        y={cy - SRC_H / 2}
        width={SRC_W}
        height={SRC_H}
        rx={2}
        fill="#fffdf5"
        stroke={source.accent}
        strokeWidth={1.5}
      />
      <text
        x={SRC_X + SRC_W / 2}
        y={cy - 4}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill={INK}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(source.name)}
      </text>
      <text
        x={SRC_X + SRC_W / 2}
        y={cy + 14}
        textAnchor="middle"
        fontSize={10}
        fill={NEUTRAL_TEXT}
        style={{ fontStyle: "italic" }}
      >
        {source.subtitle}
      </text>
    </g>
  );
}

function Row({
  row,
  i,
  count,
  sourceAccent,
}: {
  row: KeyDerivationRow;
  i: number;
  count: number;
  sourceAccent: string;
}) {
  const cy = rowCY(i, count);
  const srcCy = srcCY(count);
  const cx1 = SRC_X + SRC_W + 22;
  const cx2 = FORMULA_X - 22;
  const arrowEnd = KEY_X - 4;
  const chipY = cy - KEY_H / 2;
  const chipFill = row.active ? hexToRgba(row.color, 0.22) : hexToRgba(row.color, 0.12);

  return (
    <g key={row.keyName} opacity={row.active === false ? 0.55 : 1}>
      {/* Connector from source → formula box (curved) */}
      <path
        d={`M${SRC_X + SRC_W},${srcCy} C${cx1},${srcCy} ${cx2},${cy} ${FORMULA_X},${cy}`}
        fill="none"
        stroke={row.color}
        strokeWidth={1.5}
        opacity={0.85}
      />

      {/* Formula box */}
      <rect
        x={FORMULA_X}
        y={cy - FORMULA_H / 2}
        width={FORMULA_W}
        height={FORMULA_H}
        rx={2}
        fill="#fffdf5"
        stroke={row.color}
        strokeWidth={1.5}
      />
      <text
        x={FORMULA_X + FORMULA_W / 2}
        y={cy + 5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill={row.color}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(row.formula)}
      </text>

      {/* Arrow from formula → chip */}
      <line
        x1={FORMULA_X + FORMULA_W}
        y1={cy}
        x2={arrowEnd - 6}
        y2={cy}
        stroke={row.color}
        strokeWidth={1.5}
      />
      <polygon
        points={`${arrowEnd},${cy} ${arrowEnd - 8},${cy - 4} ${arrowEnd - 8},${cy + 4}`}
        fill={row.color}
      />

      {/* Key chip */}
      <rect
        x={KEY_X}
        y={chipY}
        width={KEY_W}
        height={KEY_H}
        rx={3}
        fill={chipFill}
        stroke={row.active ? FOCUS_GOLD : row.color}
        strokeWidth={row.active ? 2 : 1.5}
      />
      {row.active && (
        <rect
          x={KEY_X - 3}
          y={chipY - 3}
          width={KEY_W + 6}
          height={KEY_H + 6}
          rx={5}
          fill="none"
          stroke={FOCUS_GOLD}
          strokeWidth={1}
          opacity={0.35}
        />
      )}
      <text
        x={KEY_X + 14}
        y={chipY + 25}
        fontSize={18}
        fontWeight={700}
        fill={row.color}
        style={{ fontFamily: MONO }}
      >
        {mathLineToSvgTspans(row.keyName)}
      </text>
      <text
        x={KEY_X + 14}
        y={chipY + 44}
        fontSize={10}
        fill={row.color}
        style={{
          fontFamily: MONO,
          fontStyle: "italic",
          opacity: 0.75,
        }}
      >
        {row.bytes}
      </text>
      <text
        x={KEY_X + KEY_W - 12}
        y={chipY + 25}
        textAnchor="end"
        fontSize={11}
        fontWeight={700}
        fill={INK}
      >
        {row.useTitle}
      </text>
      {row.useSubtitle && (
        <text
          x={KEY_X + KEY_W - 12}
          y={chipY + 44}
          textAnchor="end"
          fontSize={10}
          fill={NEUTRAL_TEXT}
          style={{ fontStyle: "italic" }}
        >
          {row.useSubtitle}
        </text>
      )}
    </g>
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
// Visual: a 22×22 gold-bordered key glyph in a tinted background. Hover
// produces a viewport-clamped popover showing the same card content the
// caller would have rendered inline. Click also pins/unpins the popover so
// touch devices have a way in (no hover on mobile).
//
// Place this icon top-right of the operation view it belongs to, so the
// reader's eye lands there *after* reading the operation.

export function KeyHoverIcon(props: KeyDerivationCardProps & { className?: string }) {
  const [shown, setShown] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const POPOVER_W = 720;

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
          background: pinned ? "#fef3c7" : "#fffdf5",
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
