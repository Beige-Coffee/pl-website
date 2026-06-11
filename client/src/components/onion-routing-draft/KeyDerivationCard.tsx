// ────────────────────────────────────────────────────────────────────────────
// KeyDerivationCard
//
// Shared visual for "this source secret derives these keys via HMAC."
// Used by ForwarderPeelDiagram, WrapTraceDiagram, PeelTraceDiagram,
// ValidationFlowDiagram, the error pair (ErrorBoomerang / ErrorUnwrap), and
// OperationsLifecycle. One component, many callsites — the look stays
// consistent course-wide.
//
// Layout (2026-06-10 redesign, user directive): the derivation is shown as the
// math itself — a stack of left-aligned equations, one per derived value, each
// with a small annotation line beneath. No chip-and-arrow pipeline; the
// equation IS the diagram.
//
//      ┌ header bar (accent-tinted) ─────────────────────────┐
//
//        ss_AB = SHA256(bob_privkey · E_AB)
//        ECDH: Bob's static node privkey · ephemeral from header
//
//        mu_B = HMAC('mu', ss_AB)                 ← gold-rimmed
//        32 bytes · HMAC key · used in step 4       when active
//
//        rho_B = HMAC('rho', ss_AB)
//        32 bytes · stream cipher key · used in step 6
//
// With no `upstream`, the source renders as a "given" line (name + subtitle)
// above the key equations. Active rows pick up a gold left bar + tinted
// background; rows with active === false dim.
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

      {/* Equation stack: the math is the diagram. */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {upstream ? (
          <EquationRow
            equation={`${source.name} = ${
              upstream.formulaOverride ??
              `SHA256(${upstream.inputA.name} · ${upstream.inputB.name})`
            }`}
            color={source.accent}
            annotation={`ECDH: ${upstream.inputA.subtitle} · ${upstream.inputB.subtitle}`}
          />
        ) : (
          <div className="flex items-baseline gap-2">
            <span
              className="text-[9px] uppercase tracking-[0.06em] font-bold"
              style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
            >
              given
            </span>
            <MathLine
              text={source.name}
              color={source.accent}
              weight={700}
              fontSize={13.5}
            />
            <span
              className="text-[9.5px] italic"
              style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
            >
              {source.subtitle}
            </span>
          </div>
        )}

        {rows.map((row) => (
          <EquationRow
            key={row.keyName}
            equation={`${row.keyName} = ${row.formula}`}
            color={row.color}
            annotation={[row.bytes, row.useTitle, row.useSubtitle]
              .filter(Boolean)
              .join(" · ")}
            active={row.active}
          />
        ))}
      </div>
    </div>
  );
}

// One derived value: the equation as math, an annotation line beneath. Active
// rows pick up a gold left bar + tinted background; rows explicitly marked
// inactive (active === false) dim.
function EquationRow({
  equation,
  color,
  annotation,
  active,
}: {
  equation: string;
  color: string;
  annotation: string;
  active?: boolean;
}) {
  const dim = active === false;
  return (
    <div
      style={{
        borderLeft: active ? `3px solid ${FOCUS_GOLD}` : `3px solid transparent`,
        background: active ? hexToRgba(FOCUS_GOLD, 0.08) : "transparent",
        padding: "3px 8px",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <MathLine text={equation} color={color} weight={700} fontSize={13.5} />
      <div
        className="text-[9.5px] italic leading-tight mt-0.5"
        style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
      >
        {annotation}
      </div>
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

export function KeyHoverIcon(
  props: KeyDerivationCardProps & {
    className?: string;
    /** Optional name of the key doing this beat's work, shown inline on the
     * badge ("keys · rho_D") so the working key reads without hovering. */
    activeLabel?: string;
  },
) {
  const { activeLabel, ...cardProps } = props;
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
        {activeLabel && (
          <span style={{ textTransform: "none", letterSpacing: "0.01em" }}>
            · {activeLabel}
          </span>
        )}
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
          <KeyDerivationCard {...cardProps} />
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
