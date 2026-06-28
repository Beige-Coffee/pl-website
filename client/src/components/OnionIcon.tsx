// ────────────────────────────────────────────────────────────────────────────
// OnionIcon
//
// Layered-routing mark in inline SVG: concentric diamonds evoking the nested
// encryption layers of an onion-routed payment. Designed to read clearly at
// small sizes and match the chunky 8-bit retro aesthetic of the homepage.
// White background tile with crisp block pixels.
//
// Grid: 17 cols × 17 rows. Each cell is rendered as a 6-unit SVG rect with
// shape-rendering: crispEdges, so it stays sharp at any rendered size.
// Fully symmetric on both axes: a gold outer ring, a darker-gold middle ring,
// a black inner ring, and a green core.
// ────────────────────────────────────────────────────────────────────────────

const PALETTE: Record<string, string> = {
  ".": "#ffffff", // white background
  M: "#e8b04d",   // gold (outer ring)
  D: "#c8893a",   // darker gold (middle ring)
  B: "#1a1a1a",   // black (inner ring)
  G: "#7aa83b",   // green core
};

// 17 chars × 17 rows. Concentric diamonds, symmetric on both axes.
const PIXELS = [
  "........M........",
  ".......M.M.......",
  "......M...M......",
  ".....M..D..M.....",
  "....M..D.D..M....",
  "...M..D...D..M...",
  "..M..D..B..D..M..",
  ".M..D..B.B..D..M.",
  "M..D..B.G.B..D..M",
  ".M..D..B.B..D..M.",
  "..M..D..B..D..M..",
  "...M..D...D..M...",
  "....M..D.D..M....",
  ".....M..D..M.....",
  "......M...M......",
  ".......M.M.......",
  "........M........",
];

const CELL = 6;
const COLS = 17;
const ROWS = 17;
const VB_W = COLS * CELL;
const VB_H = ROWS * CELL;

interface OnionIconProps {
  className?: string;
  size?: number | string;
}

export function OnionIcon({ className, size }: OnionIconProps) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={className}
      width={size}
      height={size}
      style={{ shapeRendering: "crispEdges", imageRendering: "pixelated" }}
      aria-label="Onion routing layers"
      role="img"
    >
      {/* White background tile */}
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#ffffff" />

      {/* Draw colored pixels on top */}
      {PIXELS.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = PALETTE[ch];
          if (!fill || fill === "#ffffff") return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}

export default OnionIcon;
