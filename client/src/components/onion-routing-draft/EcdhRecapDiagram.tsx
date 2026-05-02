import { useState, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────────
// EcdhRecapDiagram (DRAFT)
//
// A bilateral ECDH refresher. Two parties (Alice, Bob) each hold a keypair.
// Each computes the same shared point from the other's public key plus their
// own private key — because scalar multiplication on the curve commutes:
//   a · B = a · (b · G) = ab · G = b · (a · G) = b · A
// SHA256(shared_point) becomes the 32-byte shared secret.
//
// One-shot mount animation:
//   - Key cards fade in at 0 ms
//   - Computation blocks fade in at 600 ms
//   - Center "SHARED POINT" pill scales in at 1100 ms with a brief gold pulse
// "Replay" button below the stage re-runs the animation by toggling a key.
//
// Visual style follows the locked onion-routing format: black header bar,
// cream body, 1.5px ink borders, gold (#b8860b) ONLY for the shared-point
// pill so the eye is drawn there. Columns stay neutral cream/ink.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const CREAM_STAGE = "#fefdfb";
const CREAM_CARD = "#fffdf5";
const GOLD = "#b8860b";
const MONO = '"JetBrains Mono", "Fira Code", monospace';

// Tiny pixel-art lock glyph in gold, used next to "private key" labels.
function LockTile() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {/* shackle */}
      <rect x="3" y="2" width="1" height="3" fill={GOLD} />
      <rect x="8" y="2" width="1" height="3" fill={GOLD} />
      <rect x="4" y="1" width="4" height="1" fill={GOLD} />
      {/* body */}
      <rect x="2" y="5" width="8" height="6" fill={GOLD} />
      <rect x="5" y="7" width="2" height="2" fill={CREAM_CARD} />
    </svg>
  );
}

interface PartyColumnProps {
  name: string;
  privVar: string;
  pubVar: string;
  ownPriv: string;
  otherPub: string;
  arrowDirection: "right" | "left";
  arrowLabel: string;
  visibleKeys: boolean;
  visibleCompute: boolean;
}

function PartyColumn({
  name,
  privVar,
  pubVar,
  ownPriv,
  otherPub,
  arrowDirection,
  arrowLabel,
  visibleKeys,
  visibleCompute,
}: PartyColumnProps) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ width: 220 }}>
      {/* Party badge */}
      <div
        className="px-4 py-1.5 border-[1.5px]"
        style={{
          background: CREAM_CARD,
          borderColor: INK,
          color: INK,
        }}
      >
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          {name}
        </span>
      </div>

      {/* Key card */}
      <div
        className="w-full border-[1.5px] px-3 py-2"
        style={{
          background: CREAM_CARD,
          borderColor: INK,
          opacity: visibleKeys ? 1 : 0,
          transform: visibleKeys ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 300ms ease-out, transform 300ms ease-out",
          fontFamily: MONO,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <LockTile />
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {name.toLowerCase()}'s private
          </span>
        </div>
        <div className="text-[12px] font-bold mb-2" style={{ color: INK }}>
          {privVar}
        </div>
        <div
          className="text-[9px] uppercase tracking-wider mb-1"
          style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {name.toLowerCase()}'s public
        </div>
        <div className="text-[12px] font-bold" style={{ color: INK }}>
          {pubVar}
        </div>
      </div>

      {/* Arrow toward / from center */}
      <div
        className="flex items-center gap-1.5 text-[10px]"
        style={{
          color: SLATE,
          opacity: visibleKeys ? 1 : 0,
          transition: "opacity 300ms ease-out 100ms",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {arrowDirection === "right" ? (
          <>
            <span>{arrowLabel}</span>
            <span style={{ color: INK, fontWeight: 700 }}>→</span>
          </>
        ) : (
          <>
            <span style={{ color: INK, fontWeight: 700 }}>←</span>
            <span>{arrowLabel}</span>
          </>
        )}
      </div>

      {/* Computation block */}
      <div
        className="w-full border-[1.5px] px-3 py-2"
        style={{
          background: CREAM_CARD,
          borderColor: INK,
          opacity: visibleCompute ? 1 : 0,
          transform: visibleCompute ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 300ms ease-out, transform 300ms ease-out",
          fontFamily: MONO,
        }}
      >
        <div
          className="text-[9px] uppercase tracking-wider mb-1"
          style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          compute
        </div>
        <div className="text-[12px] leading-relaxed" style={{ color: INK }}>
          <div className="font-bold">{ownPriv} · {otherPub}</div>
          <div style={{ color: SLATE }}>= {ownPriv} · ({otherPub === "B" ? "b" : "a"} · G)</div>
          <div className="font-bold">= ab · G</div>
        </div>
        <div
          className="mt-1.5 text-[10px] flex items-center gap-1"
          style={{ color: INK, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          <span style={{ fontWeight: 700 }}>→</span>
          <span className="italic">shared_point</span>
        </div>
      </div>
    </div>
  );
}

export function EcdhRecapDiagram() {
  // Toggling animKey re-runs the mount animation (Replay button).
  const [animKey, setAnimKey] = useState(0);
  const [visibleKeys, setVisibleKeys] = useState(false);
  const [visibleCompute, setVisibleCompute] = useState(false);
  const [visiblePill, setVisiblePill] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setVisibleKeys(false);
    setVisibleCompute(false);
    setVisiblePill(false);
    setPulse(false);

    const t1 = setTimeout(() => setVisibleKeys(true), 50);
    const t2 = setTimeout(() => setVisibleCompute(true), 650);
    const t3 = setTimeout(() => {
      setVisiblePill(true);
      setPulse(true);
    }, 1150);
    const t4 = setTimeout(() => setPulse(false), 1550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [animKey]);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="ecdh-recap-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            ECDH in one picture
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative overflow-x-auto px-4 py-6"
        style={{
          background: CREAM_STAGE,
          minHeight: 360,
        }}
      >
        <div
          className="relative flex items-stretch justify-center gap-4"
          style={{ minWidth: 720 }}
        >
          {/* Alice */}
          <PartyColumn
            name="Alice"
            privVar="a"
            pubVar="A = a · G"
            ownPriv="a"
            otherPub="B"
            arrowDirection="right"
            arrowLabel="Bob's public key"
            visibleKeys={visibleKeys}
            visibleCompute={visibleCompute}
          />

          {/* Center pill + arrows */}
          <div
            className="flex flex-col items-center justify-center"
            style={{ width: 220 }}
          >
            {/* Inbound arrows from each side, hinting that both columns
                point at the center pill. */}
            <div
              className="flex items-center justify-between w-full px-1 mb-2"
              style={{
                opacity: visibleCompute ? 1 : 0,
                transition: "opacity 400ms ease-out 200ms",
                color: SLATE,
              }}
            >
              <span style={{ fontWeight: 700, color: INK }}>→</span>
              <span
                className="text-[9px] uppercase tracking-wider"
                style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                meet here
              </span>
              <span style={{ fontWeight: 700, color: INK }}>←</span>
            </div>

            {/* Shared-point pill — the only gold element in the stage */}
            <div
              className="px-4 py-2 border-[1.5px]"
              style={{
                background: GOLD,
                borderColor: GOLD,
                color: "#ffffff",
                opacity: visiblePill ? 1 : 0,
                transform: visiblePill
                  ? pulse
                    ? "scale(1.08)"
                    : "scale(1)"
                  : "scale(0.6)",
                transition:
                  "opacity 200ms ease-out, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: pulse
                  ? `0 0 0 6px rgba(184, 134, 11, 0.25)`
                  : "0 0 0 0 rgba(184, 134, 11, 0)",
              }}
            >
              <div className="text-[10px] tracking-[0.1em] uppercase font-bold opacity-80">
                shared point
              </div>
              <div
                className="text-[14px] font-bold mt-0.5"
                style={{ fontFamily: MONO }}
              >
                ab · G
              </div>
            </div>

            {/* SHA256 caption beneath the pill */}
            <div
              className="mt-3 text-center"
              style={{
                opacity: visiblePill ? 1 : 0,
                transition: "opacity 400ms ease-out 200ms",
              }}
            >
              <div
                className="text-[10px] leading-snug"
                style={{ color: SLATE, fontFamily: MONO }}
              >
                SHA256(shared_point)
              </div>
              <div
                className="text-[10px] leading-snug mt-0.5"
                style={{ color: INK }}
              >
                <span style={{ fontWeight: 700 }}>→</span>{" "}
                <span className="italic">32-byte shared secret</span>
              </div>
            </div>
          </div>

          {/* Bob */}
          <PartyColumn
            name="Bob"
            privVar="b"
            pubVar="B = b · G"
            ownPriv="b"
            otherPub="A"
            arrowDirection="left"
            arrowLabel="Alice's public key"
            visibleKeys={visibleKeys}
            visibleCompute={visibleCompute}
          />
        </div>
      </div>

      {/* Replay control */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div
            className="text-xs leading-relaxed flex-1 max-w-2xl"
            style={{ color: INK }}
          >
            Both sides land on the <span className="font-bold">same point</span>{" "}
            because scalar multiplication commutes:{" "}
            <span style={{ fontFamily: MONO }}>a · B = b · A = ab · G</span>.
            Hash that point and you have a shared key neither party had to send.
          </div>
          <button
            onClick={() => setAnimKey((k) => k + 1)}
            className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors shrink-0"
            data-testid="ecdh-recap-diagram-replay"
          >
            ↻ Replay
          </button>
        </div>
      </div>
    </div>
  );
}

export default EcdhRecapDiagram;
