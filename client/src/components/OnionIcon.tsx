// ────────────────────────────────────────────────────────────────────────────
// OnionIcon
//
// Pixel-art onion in inline SVG. Designed to read clearly at small sizes and
// match the chunky 8-bit retro aesthetic of the homepage. White background
// tile with crisp block pixels for the onion drawing.
//
// Grid: 17 cols × 17 rows. Each cell is rendered as a 6-unit SVG rect with
// shape-rendering: crispEdges, so it stays sharp at any rendered size.
// Symmetric design: every row is mirror-balanced around the central column.
// ────────────────────────────────────────────────────────────────────────────

const PALETTE: Record<string, string> = {
  ".": "#ffffff", // white background
  B: "#1a1a1a",   // dark outline
  M: "#e8b04d",   // main onion body (warm gold)
  L: "#fff3b0",   // cream highlight (top-of-bulb shine)
  G: "#7aa83b",   // sprout green
  r: "#6b3f1a",   // root brown
};

// 17 chars × 17 rows, strictly symmetric.
const PIXELS = [
  ".................",
  "........G........",
  ".......GGG.......",
  "........G........",
  ".......BBB.......",
  "......BMMMB......",
  ".....BMMLLMB.....",
  "....BMMLLLLMB....",
  "...BMMLLLLLLMB...",
  "..BMMMLLLLLMMMB..",
  "..BMMMMLLLMMMMB..",
  "...BMMMMMMMMMB...",
  "....BMMMMMMMB....",
  "....BMMMMMMMB....",
  ".....BMMMMMB.....",
  "......BMMMB......",
  "........r........",
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
      aria-label="Onion"
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
