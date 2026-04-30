// ────────────────────────────────────────────────────────────────────────────
// OnionIcon
//
// Pixel-art onion in inline SVG. Matches the chunky 8-bit retro aesthetic the
// site uses elsewhere (font-pixel headers, pixel-shadow utility, etc.). Used
// on the homepage to identify the Onion Routing course alongside the lightning
// bolt for Intro to Payment Channels and the XK logo for Noise.
//
// The onion is drawn on a 16×18 logical pixel grid; each cell is rendered as a
// crisp 4-unit SVG rect. Rendering scales perfectly at any size with
// shape-rendering: crispEdges. Uses the gold palette already shared with the
// Noise capstone (#b8860b) plus a green sprout that matches the success-state
// green (#5a7a2f).
// ────────────────────────────────────────────────────────────────────────────

const PALETTE: Record<string, string> = {
  ".": "transparent",
  G: "#6b8e23",   // sprout green
  D: "#5a7a2f",   // sprout shadow
  o: "#7c5e10",   // outline / deep shadow on the bulb
  m: "#daa520",   // mid gold (main bulb body)
  h: "#f1c40f",   // brighter gold (mid highlight band)
  l: "#fff3b0",   // bright cream highlight
  r: "#5b3a1a",   // root brown
};

// 16 cols × 18 rows. Each row is a 16-char string mapping to PALETTE.
// Designed to read as "onion" at thumbnail sizes: pointed sprout on top,
// bulbous bowl-shaped bulb, narrow root tassel at bottom. Highlight runs
// vertically along the upper-left to suggest a light source.
const PIXELS = [
  "......GD........",
  "......GG........",
  ".....GGGG.......",
  "......GD........",
  "......oo........",
  ".....oommo......",
  "....oommmmo.....",
  "...oommmlmmo....",
  "..oommmllllmmo..",
  ".oommmllllllmmo.",
  ".ommmlllllllmmo.",
  ".ommmlllllllhmo.",
  ".ommmllllllhhmo.",
  ".ommmmllllhmmoo.",
  "..ommmmmmmmoo...",
  "...oommmmmmoo...",
  ".....oommmoo....",
  ".......rro......",
];

const CELL = 4;
const COLS = 16;
const ROWS = 18;
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
      {PIXELS.map((row, y) =>
        row.split("").map((ch, x) => {
          const fill = PALETTE[ch] ?? "transparent";
          if (fill === "transparent") return null;
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
