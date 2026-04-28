import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// KdfPipelineDiagram
//
// Shows one 32-byte shared secret expanding into 5 named keys via
// HMAC-SHA256(name, shared_secret). Click a key chip to see what it's used
// for. Used in Chapter 4.
// ────────────────────────────────────────────────────────────────────────────

const KEYS: Array<{
  name: string;
  color: string;
  stroke: string;
  use: string;
  detail: string;
}> = [
  {
    name: "rho",
    color: "#bfdbfe",
    stroke: "#2563eb",
    use: "Stream cipher key (forward)",
    detail:
      "Generates a 1300-byte ChaCha20 keystream that XORs onto the hop payload area when wrapping/peeling each layer of the onion. This is the key that actually encrypts hop instructions.",
  },
  {
    name: "mu",
    color: "#bbf7d0",
    stroke: "#16a34a",
    use: "Packet HMAC key (forward)",
    detail:
      "Authenticates the next layer's contents with a 32-byte HMAC tag. The forwarder verifies this HMAC first when it receives a packet; if it fails, the packet is rejected before any decryption happens.",
  },
  {
    name: "um",
    color: "#fde68a",
    stroke: "#b8860b",
    use: "Error HMAC key (return)",
    detail:
      "When this hop fails a payment, it builds an error packet authenticated with um. Alice verifies these HMACs on the return path to identify which hop failed and decode the failure code.",
  },
  {
    name: "pad",
    color: "#ddd6fe",
    stroke: "#7c3aed",
    use: "Filler seed (sender-only)",
    detail:
      "Used only by Alice during the very first wrapping step to seed deterministic filler bytes. The forwarders never compute pad. We'll see why filler exists in Chapter 6.",
  },
  {
    name: "ammag",
    color: "#fecaca",
    stroke: "#dc2626",
    use: "Stream cipher key (return)",
    detail:
      "ChaCha20 keystream key for error packets. Each hop wraps the error in another layer of ammag-encrypted bytes on the way back to Alice, who peels them off in order.",
  },
];

export function KdfPipelineDiagram() {
  const [active, setActive] = useState<number | null>(null);
  const focused = active !== null ? KEYS[active] : null;

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-kdf-pipeline"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        One shared secret expands into five named keys
      </div>

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
              rx={4}
              fill="#fffdf5"
              stroke="#b8860b"
              strokeWidth={2.5}
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
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
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

            return (
              <g key={k.name} style={{ opacity }}>
                {/* Connector line */}
                <path
                  d={`M170,140 C260,140 280,${targetY + 18} 360,${targetY + 18}`}
                  fill="none"
                  stroke={k.stroke}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {/* HMAC label */}
                <text
                  x={250}
                  y={targetY + 12}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#475569"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  HMAC("{k.name}", ssᵢ)
                </text>
                {/* Key box */}
                <rect
                  x={360}
                  y={targetY}
                  width={120}
                  height={36}
                  rx={4}
                  fill={k.color}
                  stroke={k.stroke}
                  strokeWidth={isActive ? 3 : 2}
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
                  fill="#0f172a"
                  style={{ pointerEvents: "none" }}
                >
                  {k.name}
                </text>
                <text
                  x={420}
                  y={targetY + 30}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#475569"
                  style={{ pointerEvents: "none" }}
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

      <div className="mt-4 text-sm leading-relaxed">
        {focused ? (
          <div
            className="border-2 p-3"
            style={{ background: focused.color, borderColor: focused.stroke }}
          >
            <span className="font-semibold">{focused.name}</span>{" "}
            <span className="opacity-70 text-xs uppercase tracking-wider font-pixel">
              {focused.use}
            </span>
            <div className="mt-2">{focused.detail}</div>
          </div>
        ) : (
          <div className="opacity-60 italic text-center">
            Click any key to see how it's used in the protocol.
          </div>
        )}
      </div>
    </div>
  );
}

export default KdfPipelineDiagram;
