import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// KdfPipelineDiagram
//
// Shows one 32-byte shared secret expanding into 5 named keys via
// HMAC-SHA256(name, shared_secret). Click a key chip to see what it's used
// for. Used in Chapter 4.
//
// Visual style follows the locked onion-routing format spec:
//   - Outer container with 1.5px border, sans-serif inline font.
//   - Black header bar with white pixel-letter-spaced uppercase title and
//     gold dot indicator.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - Canonical 5-key palette matches FiveKeysJobsDiagram.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

const KEYS: Array<{
  name: string;
  color: string;
  use: string;
  detail: string;
}> = [
  {
    name: "rho",
    color: "#b8860b",
    use: "Stream cipher key (forward)",
    detail:
      "Generates a 1300-byte ChaCha20 keystream that XORs onto the hop payload area when wrapping/peeling each layer of the onion. This is the key that actually encrypts hop instructions.",
  },
  {
    name: "mu",
    color: "#3b6aa0",
    use: "Packet HMAC key (forward)",
    detail:
      "Authenticates the next layer's contents with a 32-byte HMAC tag. The forwarder verifies this HMAC first when it receives a packet; if it fails, the packet is rejected before any decryption happens.",
  },
  {
    name: "um",
    color: "#2d7a7a",
    use: "Error HMAC key (return)",
    detail:
      "When this hop fails a payment, it builds an error packet authenticated with um. Alice verifies these HMACs on the return path to identify which hop failed and decode the failure code.",
  },
  {
    name: "pad",
    color: "#7b4b8a",
    use: "Filler seed (sender-only)",
    detail:
      "Used only by Alice during the very first wrapping step to seed deterministic filler bytes. The forwarders never compute pad. We'll see why filler exists in Chapter 6.",
  },
  {
    name: "ammag",
    color: "#5a7a2f",
    use: "Stream cipher key (return)",
    detail:
      "ChaCha20 keystream key for error packets. Each hop wraps the error in another layer of ammag-encrypted bytes on the way back to Alice, who peels them off in order.",
  },
];

// Convert a hex color like "#b8860b" to "rgba(r,g,b,a)".
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function KdfPipelineDiagram() {
  const [active, setActive] = useState<number | null>(null);
  const focused = active !== null ? KEYS[active] : null;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-kdf-pipeline"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Five keys from one secret
          </span>
        </div>
      </div>

      {/* Cream stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 720 280"
            className="w-full max-w-4xl mx-auto"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {/* Shared secret box on left */}
            <g>
              <rect
                x={20}
                y={110}
                width={150}
                height={60}
                rx={2}
                fill="#fffdf5"
                stroke="#b8860b"
                strokeWidth={1.5}
              />
              <text
                x={95}
                y={138}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="#0f172a"
              >
                shared_secret
              </text>
              <text
                x={95}
                y={156}
                textAnchor="middle"
                fontSize={9}
                fill="#475569"
                style={{ fontFamily: MONO }}
              >
                ssᵢ (32 bytes)
              </text>
            </g>

            {/* Lines + boxes for each derived key */}
            {KEYS.map((k, i) => {
              const targetY = 30 + i * 50;
              const isActive = active === i;
              const dimmed = active !== null && !isActive;
              const opacity = dimmed ? 0.3 : 1;
              const fillTint = hexToRgba(k.color, 0.15);

              return (
                <g key={k.name} style={{ opacity }}>
                  {/* Connector line */}
                  <path
                    d={`M170,140 C260,140 280,${targetY + 18} 360,${targetY + 18}`}
                    fill="none"
                    stroke={k.color}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {/* HMAC label */}
                  <text
                    x={250}
                    y={targetY + 12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#475569"
                    style={{ fontFamily: MONO }}
                  >
                    HMAC("{k.name}", ssᵢ)
                  </text>
                  {/* Key box */}
                  <rect
                    x={360}
                    y={targetY}
                    width={120}
                    height={36}
                    rx={2}
                    fill={fillTint}
                    stroke={k.color}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    onClick={() => setActive(isActive ? null : i)}
                    style={{ cursor: "pointer" }}
                    data-testid={`onion-kdf-key-${k.name}`}
                  />
                  <text
                    x={420}
                    y={targetY + 16}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill={k.color}
                    style={{ pointerEvents: "none", fontFamily: MONO }}
                  >
                    {k.name}
                  </text>
                  <text
                    x={420}
                    y={targetY + 30}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#475569"
                    style={{ pointerEvents: "none", fontFamily: MONO }}
                  >
                    32 bytes
                  </text>
                  {/* Use label to the right */}
                  <text
                    x={500}
                    y={targetY + 22}
                    fontSize={11}
                    fill="#0f172a"
                  >
                    {k.use}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail panel / hint */}
        <div className="mt-4 text-sm leading-relaxed">
          {focused ? (
            <div
              className="border-[1.5px] p-3 relative"
              style={{
                background: "#fffdf5",
                borderColor: "#0f172a",
                borderLeft: `4px solid ${focused.color}`,
              }}
            >
              <span
                className="font-bold"
                style={{ fontFamily: MONO, color: focused.color }}
              >
                {focused.name}
              </span>{" "}
              <span className="opacity-70 text-xs uppercase tracking-[0.08em]">
                {focused.use}
              </span>
              <div className="mt-2" style={{ color: "#0f172a" }}>
                {focused.detail}
              </div>
            </div>
          ) : (
            <div
              className="opacity-60 italic text-center text-xs"
              style={{ color: "#475569" }}
            >
              Click a key chip to see what it's used for.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KdfPipelineDiagram;
