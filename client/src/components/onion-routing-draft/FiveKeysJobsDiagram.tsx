import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// FiveKeysJobsDiagram (DRAFT)
//
// Static "scoreboard" visual laying out the five BOLT-4 derived keys (rho,
// mu, um, pad, ammag). Each card shows the key's signature color, name,
// direction (forward / backward / sender-only), primary role, and a one-line
// description of when it fires.
//
// This is a reference diagram, not an animation. Hovering a card scales it
// up slightly with a gold drop shadow and dims the other cards.
//
// Visual style follows the Noise capstone / onion routing format spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - Body sans-serif; key names in JetBrains Mono.
// ────────────────────────────────────────────────────────────────────────────

type KeyName = "rho" | "mu" | "um" | "pad" | "ammag";
type Direction = "FORWARD" | "BACKWARD" | "SENDER ONLY";

interface KeySpec {
  name: KeyName;
  color: string;
  direction: Direction;
  role: string;
  oneLiner: string;
}

const KEYS: KeySpec[] = [
  {
    name: "rho",
    color: "#b8860b",
    direction: "FORWARD",
    role: "Stream cipher (fwd)",
    oneLiner:
      "ChaCha20 keystream that XORs the hop payload area when wrapping or peeling each layer.",
  },
  {
    name: "mu",
    color: "#3b6aa0",
    direction: "FORWARD",
    role: "HMAC (fwd)",
    oneLiner:
      "Authenticates each layer's contents. Forwarders verify before doing anything else.",
  },
  {
    name: "um",
    color: "#2d7a7a",
    direction: "BACKWARD",
    role: "HMAC (errors)",
    oneLiner: "Authenticates encrypted error packets on the return path.",
  },
  {
    name: "pad",
    color: "#7b4b8a",
    direction: "SENDER ONLY",
    role: "Filler seed",
    oneLiner:
      "Seeds the deterministic 1300-byte filler used during initial packet construction.",
  },
  {
    name: "ammag",
    color: "#5a7a2f",
    direction: "BACKWARD",
    role: "Stream cipher (errors)",
    oneLiner:
      "ChaCha20 keystream for encrypting and decrypting error onions on the return path.",
  },
];

// Tag color per direction. Forward = ink; backward = slate; sender-only = gold.
function directionStyles(dir: Direction): { bg: string; fg: string; border: string } {
  if (dir === "FORWARD") return { bg: "#0f172a", fg: "#fffdf5", border: "#0f172a" };
  if (dir === "BACKWARD") return { bg: "#fffdf5", fg: "#0f172a", border: "#0f172a" };
  return { bg: "#b8860b", fg: "#fffdf5", border: "#b8860b" };
}

export function FiveKeysJobsDiagram() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="five-keys-jobs-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Five keys, five jobs
          </span>
        </div>
      </div>

      {/* Stage. Wrapped in overflow-x-auto so the row scrolls on narrow
          viewports rather than collapsing — the side-by-side comparison is
          the educational point. */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] dark:bg-[#0b1220]"
          style={{ minHeight: 440, minWidth: 880 }}
        >
          <div className="grid grid-cols-5 gap-2 p-3">
            {KEYS.map((k, idx) => {
              const isHovered = hoveredIdx === idx;
              const isOtherHovered = hoveredIdx !== null && hoveredIdx !== idx;
              const dirStyle = directionStyles(k.direction);
              return (
                <div
                  key={k.name}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="border-[1.5px] flex flex-col gap-2 p-3"
                  style={{
                    borderColor: isHovered ? "#b8860b" : "#0f172a",
                    background: "#fffdf5",
                    transition:
                      "transform 250ms ease-out, box-shadow 250ms ease-out, opacity 250ms ease-out, border-color 250ms ease-out",
                    transform: isHovered ? "scale(1.04)" : "scale(1)",
                    boxShadow: isHovered
                      ? "0 4px 16px rgba(184,134,11,0.25)"
                      : "none",
                    opacity: isOtherHovered ? 0.65 : 1,
                  }}
                  data-testid={`five-keys-jobs-card-${k.name}`}
                >
                  {/* Color block */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      background: k.color,
                      border: "1.5px solid #0f172a",
                    }}
                    aria-hidden
                  />

                  {/* Key name */}
                  <div
                    style={{
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: k.color,
                      lineHeight: 1.1,
                    }}
                  >
                    {k.name}
                  </div>

                  {/* Direction tag */}
                  <div>
                    <span
                      className="inline-block px-2 py-0.5 border-[1.5px] text-[10px] font-bold tracking-[0.08em] uppercase"
                      style={{
                        background: dirStyle.bg,
                        color: dirStyle.fg,
                        borderColor: dirStyle.border,
                      }}
                    >
                      {k.direction}
                    </span>
                  </div>

                  {/* Primary role */}
                  <div
                    className="text-xs font-bold uppercase tracking-[0.05em]"
                    style={{ color: "#0f172a" }}
                  >
                    {k.role}
                  </div>

                  {/* One-liner */}
                  <div
                    className="leading-snug"
                    style={{
                      fontSize: isHovered ? 13 : 12,
                      color: "#0f172a",
                      transition: "font-size 250ms ease-out",
                    }}
                  >
                    {k.oneLiner}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FiveKeysJobsDiagram;
