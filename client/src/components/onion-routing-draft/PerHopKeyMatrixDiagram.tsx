import { useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PerHopKeyMatrixDiagram (DRAFT)
//
// A 3x5 grid of 15 keys: 3 hops (Bob, Charlie, Dave) × 5 keys per hop
// (rho, mu, um, pad, ammag). The educational point: every hop has its own
// complete set of five keys, all derived from that hop's distinct shared
// secret. Bob's rho is not Charlie's rho is not Dave's rho.
//
// Three hops × five keys = 15 distinct 32-byte keys per payment.
//
// Visual style follows the locked onion-routing format (HtlcPropagationDiagram,
// EncryptedSliceReveal): black header bar, cream stage, ink borders, inline
// hex values in JetBrains Mono, hover popover anchored above/right of cell
// with viewport clamping. No click-to-pin (this is a quick reference grid).
// ────────────────────────────────────────────────────────────────────────────

type HopId = "bob" | "charlie" | "dave";
type KeyName = "rho" | "mu" | "um" | "pad" | "ammag";

const HOPS: HopId[] = ["bob", "charlie", "dave"];
const KEY_NAMES: KeyName[] = ["rho", "mu", "um", "pad", "ammag"];

const HOP_LABELS: Record<HopId, string> = {
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

const HOP_INDEX: Record<HopId, number> = {
  bob: 1,
  charlie: 2,
  dave: 3,
};

// Locked key colors (match FiveKeysJobsDiagram / locked spec).
const KEY_COLORS: Record<KeyName, string> = {
  rho: "#b8860b",
  mu: "#3b6aa0",
  um: "#2d7a7a",
  pad: "#7b4b8a",
  ammag: "#5a7a2f",
};

const KEY_PURPOSE: Record<KeyName, string> = {
  rho: "encrypts the hop payload area with ChaCha20",
  mu: "authenticates the next layer with HMAC-SHA256",
  um: "authenticates this hop's error packet on the return trip",
  pad: "seeds deterministic filler bytes (sender-only)",
  ammag: "encrypts return-path error packets with ChaCha20",
};

// Distinct deterministic-looking hex stubs per (hop, key) pair so the visual
// reads as 15 truly distinct keys. First two bytes vary per hop, last two
// bytes vary per key. (These are display-only — no real crypto here.)
const HEX_STUBS: Record<HopId, Record<KeyName, string>> = {
  bob: {
    rho:   "0x8f a3 ... 12",
    mu:    "0x8f a3 ... 4d",
    um:    "0x8f a3 ... 7b",
    pad:   "0x8f a3 ... c1",
    ammag: "0x8f a3 ... 09",
  },
  charlie: {
    rho:   "0x21 e7 ... 5a",
    mu:    "0x21 e7 ... 92",
    um:    "0x21 e7 ... bc",
    pad:   "0x21 e7 ... 06",
    ammag: "0x21 e7 ... e3",
  },
  dave: {
    rho:   "0x4c 1d ... 88",
    mu:    "0x4c 1d ... 33",
    um:    "0x4c 1d ... af",
    pad:   "0x4c 1d ... 70",
    ammag: "0x4c 1d ... d5",
  },
};

interface HoverState {
  hop: HopId;
  keyName: KeyName;
  x: number;
  y: number;
}

const TOOLTIP_W = 280;
const TOOLTIP_H = 130;

export function PerHopKeyMatrixDiagram() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function cellKey(hop: HopId, keyName: KeyName) {
    return `${hop}:${keyName}`;
  }

  function openHover(hop: HopId, keyName: KeyName, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const padding = 12;
    // Default: anchor above the cell, horizontally centered on it.
    let x = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    let y = rect.top - TOOLTIP_H - 10;

    // If above would clip the top, anchor to the right instead.
    if (y < padding) {
      x = rect.right + 10;
      y = rect.top + rect.height / 2 - TOOLTIP_H / 2;
    }
    // Horizontal viewport clamping.
    if (x + TOOLTIP_W > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - TOOLTIP_W - padding);
    }
    if (x < padding) x = padding;
    // Vertical clamping (in case the right-side fallback ran off the bottom).
    if (y + TOOLTIP_H > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - TOOLTIP_H - padding);
    }
    if (y < padding) y = padding;

    setHover({ hop, keyName, x, y });
  }

  function closeHover() {
    setHover(null);
  }

  // Escape closes hover (defensive — primary close is mouseout).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="per-hop-key-matrix"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Fifteen Keys Per Payment
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
          style={{ minHeight: 360, minWidth: 560 }}
        >
          {/* Grid: 1 row label column + 5 key columns */}
          <div
            className="mx-auto"
            style={{
              display: "grid",
              gridTemplateColumns: "100px repeat(5, 1fr)",
              columnGap: 10,
              rowGap: 10,
              maxWidth: 720,
            }}
          >
            {/* Top-left empty corner */}
            <div />

            {/* Column headers */}
            {KEY_NAMES.map((k) => (
              <div
                key={`col-${k}`}
                className="flex items-center justify-center pb-1"
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                <span
                  className="text-xs font-bold tracking-[0.08em] uppercase"
                  style={{ color: KEY_COLORS[k] }}
                >
                  {k}
                </span>
              </div>
            ))}

            {/* Rows: row label + 5 cells */}
            {HOPS.map((hop) => (
              <Row
                key={hop}
                hop={hop}
                hoveredCell={
                  hover ? cellKey(hover.hop, hover.keyName) : null
                }
                onCellEnter={openHover}
                onCellLeave={closeHover}
                cellKey={cellKey}
                cellRefs={cellRefs}
              />
            ))}
          </div>

          {/* Caption */}
          <div
            className="mt-6 mx-auto text-center text-sm leading-relaxed"
            style={{ maxWidth: 640, color: "#0f172a" }}
          >
            Every cell is a distinct 32-byte key. None are reused across
            payments. None are derivable by any party who isn't supposed to
            know them.
          </div>
        </div>
      </div>

      {/* Floating tooltip */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: hover.x,
            top: hover.y,
            width: TOOLTIP_W,
          }}
        >
          <div
            className="border-[1.5px] p-3"
            style={{
              borderColor: "#0f172a",
              background: "#fffdf5",
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            <div
              className="text-xs font-bold tracking-[0.05em] uppercase mb-1"
              style={{ color: "#0f172a" }}
            >
              {HOP_LABELS[hover.hop]}'s {hover.keyName} key
            </div>
            <div
              className="text-[11px] mb-1"
              style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                color: KEY_COLORS[hover.keyName],
              }}
            >
              = HMAC-SHA256("{hover.keyName}", ss_{HOP_INDEX[hover.hop]})
            </div>
            <div
              className="text-[11px] leading-snug mb-1"
              style={{ color: "#475569" }}
            >
              <span className="font-bold" style={{ color: "#0f172a" }}>
                purpose:
              </span>{" "}
              {KEY_PURPOSE[hover.keyName]}
            </div>
            <div
              className="text-[10px] italic"
              style={{ color: "#475569" }}
            >
              32 bytes, never transmitted, never reused.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  hop: HopId;
  hoveredCell: string | null;
  onCellEnter: (hop: HopId, keyName: KeyName, e: React.MouseEvent) => void;
  onCellLeave: () => void;
  cellKey: (hop: HopId, keyName: KeyName) => string;
  cellRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function Row({
  hop,
  hoveredCell,
  onCellEnter,
  onCellLeave,
  cellKey,
  cellRefs,
}: RowProps) {
  return (
    <>
      {/* Row label */}
      <div
        className="flex items-center justify-end pr-2"
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span
          className="text-sm font-bold tracking-[0.08em] uppercase"
          style={{ color: "#0f172a" }}
        >
          {HOP_LABELS[hop]}
        </span>
      </div>
      {KEY_NAMES.map((k) => {
        const isHovered = hoveredCell === cellKey(hop, k);
        const color = KEY_COLORS[k];
        return (
          <div
            key={`${hop}-${k}`}
            ref={(el) => {
              if (el) cellRefs.current.set(cellKey(hop, k), el);
              else cellRefs.current.delete(cellKey(hop, k));
            }}
            onMouseEnter={(e) => onCellEnter(hop, k, e)}
            onMouseLeave={() => onCellLeave()}
            className="border-[1.5px] flex flex-col items-center justify-between"
            style={{
              width: 70,
              height: 56,
              background: "#fffdf5",
              borderColor: isHovered ? "#b8860b" : "#0f172a",
              transform: isHovered ? "scale(1.05)" : "scale(1)",
              transition:
                "transform 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out",
              boxShadow: isHovered
                ? "0 4px 12px rgba(184,134,11,0.3)"
                : "none",
              cursor: "default",
              padding: "6px 4px",
              margin: "0 auto",
            }}
          >
            {/* Color square */}
            <div
              style={{
                width: 12,
                height: 12,
                background: color,
              }}
            />
            {/* Hex stub */}
            <div
              className="text-[9px] font-bold leading-tight text-center"
              style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                color: "#0f172a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {HEX_STUBS[hop][k]}
            </div>
          </div>
        );
      })}
    </>
  );
}

export default PerHopKeyMatrixDiagram;
