import { useEffect, useRef, useState } from "react";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// PerHopKeyMatrixDiagram (DRAFT)
//
// A 3×4 grid of 12 per-hop keys (rho, mu, um, ammag for Bob, Charlie, Dave),
// plus a single session-level pad cell sitting outside the matrix. The
// educational point: every hop has its own complete set of forward+backward
// keys derived from that hop's distinct shared secret. pad is the odd one
// out: it's per-session, derived from Alice's session key, not from any
// per-hop secret.
//
// Three hops × four per-hop keys + one session-level pad = 13 distinct
// 32-byte keys per payment. (Five if you count attribution data's ammagext;
// see the chapter aside.)
//
// Visual style follows the locked onion-routing format (HtlcPropagationDiagram,
// EncryptedSliceReveal): black header bar, cream stage, ink borders, inline
// hex values in JetBrains Mono, hover popover anchored above/right of cell
// with viewport clamping.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "bob" | "charlie" | "dave";
type PerHopKeyName = "rho" | "mu" | "um" | "ammag";

const HOPS: HopId[] = ["bob", "charlie", "dave"];
const KEY_NAMES: PerHopKeyName[] = ["rho", "mu", "um", "ammag"];

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
const KEY_COLORS: Record<PerHopKeyName | "pad", string> = {
  rho: "#b8860b",
  mu: "#3b6aa0",
  um: "#2d7a7a",
  ammag: "#5a7a2f",
  pad: "#7b4b8a",
};

const KEY_PURPOSE: Record<PerHopKeyName, string> = {
  rho: "encrypts the hop payload area with ChaCha20",
  mu: "authenticates the next layer with HMAC-SHA256",
  um: "authenticates this hop's error packet on the return trip",
  ammag: "encrypts return-path error packets with ChaCha20",
};

// Distinct deterministic-looking hex stubs per (hop, key) pair so the visual
// reads as truly distinct keys. First two bytes vary per hop, last two
// bytes vary per key. (These are display-only, no real crypto here.)
const HEX_STUBS: Record<HopId, Record<PerHopKeyName, string>> = {
  bob: {
    rho:   "0x8f a3 ... 12",
    mu:    "0x8f a3 ... 4d",
    um:    "0x8f a3 ... 7b",
    ammag: "0x8f a3 ... 09",
  },
  charlie: {
    rho:   "0x21 e7 ... 5a",
    mu:    "0x21 e7 ... 92",
    um:    "0x21 e7 ... bc",
    ammag: "0x21 e7 ... e3",
  },
  dave: {
    rho:   "0x4c 1d ... 88",
    mu:    "0x4c 1d ... 33",
    um:    "0x4c 1d ... af",
    ammag: "0x4c 1d ... d5",
  },
};

const PAD_HEX = "0x9d 02 ... 4e";

interface PerHopHover {
  kind: "perhop";
  hop: HopId;
  keyName: PerHopKeyName;
  x: number;
  y: number;
}

interface PadHover {
  kind: "pad";
  x: number;
  y: number;
}

type HoverState = PerHopHover | PadHover;

const TOOLTIP_W = 280;
const TOOLTIP_H = 130;

export function PerHopKeyMatrixDiagram() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  function cellKey(hop: HopId, keyName: PerHopKeyName) {
    return `${hop}:${keyName}`;
  }

  function clampHoverPosition(rect: DOMRect): { x: number; y: number } {
    const padding = 12;
    let x = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    let y = rect.top - TOOLTIP_H - 10;

    if (y < padding) {
      x = rect.right + 10;
      y = rect.top + rect.height / 2 - TOOLTIP_H / 2;
    }
    if (x + TOOLTIP_W > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - TOOLTIP_W - padding);
    }
    if (x < padding) x = padding;
    if (y + TOOLTIP_H > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - TOOLTIP_H - padding);
    }
    if (y < padding) y = padding;

    return { x, y };
  }

  function openPerHopHover(hop: HopId, keyName: PerHopKeyName, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { x, y } = clampHoverPosition(rect);
    setHover({ kind: "perhop", hop, keyName, x, y });
  }

  function openPadHover(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { x, y } = clampHoverPosition(rect);
    setHover({ kind: "pad", x, y });
  }

  function closeHover() {
    setHover(null);
  }

  // Escape closes hover (defensive; primary close is mouseout).
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
            Per-hop keys + one session-level key
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
          style={{ minHeight: 400, minWidth: 560 }}
        >
          {/* Top: per-hop matrix */}
          <div
            className="mx-auto"
            style={{
              display: "grid",
              gridTemplateColumns: "100px repeat(4, 1fr)",
              columnGap: 10,
              rowGap: 10,
              maxWidth: 640,
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

            {/* Rows: row label + 4 cells */}
            {HOPS.map((hop) => (
              <Row
                key={hop}
                hop={hop}
                hoveredCell={
                  hover && hover.kind === "perhop"
                    ? cellKey(hover.hop, hover.keyName)
                    : null
                }
                onCellEnter={openPerHopHover}
                onCellLeave={closeHover}
                cellKey={cellKey}
                cellRefs={cellRefs}
              />
            ))}
          </div>

          {/* Caption for the matrix */}
          <div
            className="mt-4 mx-auto text-center text-xs leading-relaxed italic"
            style={{ maxWidth: 600, color: "#475569" }}
          >
            12 per-hop keys (4 jobs × 3 hops). Each row's keys derive from that
            hop's unique shared secret <Tok token="ss_i" />.
          </div>

          {/* Divider */}
          <div
            className="mx-auto mt-6 mb-4"
            style={{
              maxWidth: 600,
              height: 1,
              background: "#cbd5e1",
            }}
          />

          {/* Bottom: session-level pad cell */}
          <div className="mx-auto" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div
                className="text-xs font-bold tracking-[0.08em] uppercase text-right"
                style={{ color: "#0f172a", maxWidth: 180 }}
              >
                Session-level
                <div
                  className="text-[10px] font-normal italic mt-0.5"
                  style={{ color: "#475569", textTransform: "none", letterSpacing: 0 }}
                >
                  derived once from Alice's session key, not per hop
                </div>
              </div>

              <div
                ref={(el) => {
                  if (el) cellRefs.current.set("session:pad", el);
                  else cellRefs.current.delete("session:pad");
                }}
                onMouseEnter={openPadHover}
                onMouseLeave={closeHover}
                className="border-[1.5px] flex flex-col items-center justify-between"
                style={{
                  width: 90,
                  height: 64,
                  background: "#fffdf5",
                  borderColor:
                    hover && hover.kind === "pad" ? "#b8860b" : "#0f172a",
                  transform:
                    hover && hover.kind === "pad" ? "scale(1.05)" : "scale(1)",
                  transition:
                    "transform 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out",
                  boxShadow:
                    hover && hover.kind === "pad"
                      ? "0 4px 12px rgba(184,134,11,0.3)"
                      : "none",
                  cursor: "default",
                  padding: "8px 6px",
                }}
                data-testid="per-hop-key-matrix-pad"
              >
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: KEY_COLORS.pad,
                    }}
                  />
                  <div
                    className="text-[11px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: KEY_COLORS.pad, fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
                  >
                    pad
                  </div>
                </div>
                <div
                  className="text-[9px] font-bold leading-tight text-center"
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    color: "#0f172a",
                  }}
                >
                  {PAD_HEX}
                </div>
              </div>
            </div>
          </div>

          {/* Closing caption */}
          <div
            className="mt-6 mx-auto text-center text-sm leading-relaxed"
            style={{ maxWidth: 640, color: "#0f172a" }}
          >
            13 distinct 32-byte keys per payment. None reused across payments,
            none derivable by any party who isn't supposed to know them.
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
          {hover.kind === "perhop" ? (
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
                = HMAC-SHA256(&quot;{hover.keyName}&quot;,{" "}
                <Tok
                  token={`ss_${HOP_INDEX[hover.hop]}`}
                  color={KEY_COLORS[hover.keyName]}
                />
                )
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
          ) : (
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
                Session-level pad key
              </div>
              <div
                className="text-[11px] mb-1"
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  color: KEY_COLORS.pad,
                }}
              >
                = HMAC-SHA256(&quot;pad&quot;, session_key)
              </div>
              <div
                className="text-[11px] leading-snug mb-1"
                style={{ color: "#475569" }}
              >
                <span className="font-bold" style={{ color: "#0f172a" }}>
                  purpose:
                </span>{" "}
                seeds the 1,300-byte routing buffer with random-looking bytes
                before any layer is applied.
              </div>
              <div
                className="text-[10px] italic"
                style={{ color: "#475569" }}
              >
                Sender-only. Never transmitted, never seen by forwarders.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  hop: HopId;
  hoveredCell: string | null;
  onCellEnter: (hop: HopId, keyName: PerHopKeyName, e: React.MouseEvent) => void;
  onCellLeave: () => void;
  cellKey: (hop: HopId, keyName: PerHopKeyName) => string;
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
              width: 80,
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
