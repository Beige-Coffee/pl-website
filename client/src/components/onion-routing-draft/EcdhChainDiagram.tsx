import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// EcdhChainDiagram
//
// Visualizes the Sphinx blinding chain: one session key generates a sequence
// of ephemeral pubkeys (E0 → E1 → E2) connected by blinding factors. Each
// ephemeral key produces a shared secret with its hop's node pubkey. Both
// Alice (forward, with private session key) and the forwarders (in-place,
// with their own node privkey) reach the same shared secrets.
//
// Visual format follows the locked onion-routing spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - Step controls footer with reset + numbered step buttons.
//   - Hop colors match the canonical onion palette (Bob/Charlie/Dave).
//
// Used in Chapter 3.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { id: "bob",     label: "Bob",     stroke: "#3b6aa0", fill: "rgba(59,106,160,0.15)" },
  { id: "charlie", label: "Charlie", stroke: "#2d7a7a", fill: "rgba(45,122,122,0.15)" },
  { id: "dave",    label: "Dave",    stroke: "#7b4b8a", fill: "rgba(123,75,138,0.15)" },
];

const TOTAL_STEPS = 5;

const STEP_DESCRIPTIONS: Record<number, string> = {
  0: "Alice's session key starts the chain. E₀ = session_key · G is the only ephemeral key she sends; it goes to Bob in the onion header.",
  1: "Bob receives E₀, computes ss₀ = ECDH(bob_privkey, E₀). Alice already knows ss₀ from session_key · bob_pubkey. Same value, two paths.",
  2: "Both sides compute b₀ = SHA256(E₀ ‖ ss₀) and use it to advance the chain: e₁ = e₀ · b₀, E₁ = E₀ · b₀.",
  3: "Charlie receives E₁, computes ss₁ = ECDH(charlie_privkey, E₁). Same SHA256 trick produces b₁, advancing to E₂ = E₁ · b₁.",
  4: "Dave receives E₂, computes ss₂ = ECDH(dave_privkey, E₂). No further hop, so the chain ends here.",
};

export function EcdhChainDiagram() {
  const [step, setStep] = useState(0);

  // Visibility per step:
  //   0: only E0 box, alice on the left
  //   1: + ss0 dropping down from E0 toward Bob
  //   2: + b0 connector + E1 box
  //   3: + ss1 toward Charlie + b1 + E2
  //   4: + ss2 toward Dave (chain complete)
  const showSs0 = step >= 1;
  const showE1  = step >= 2;
  const showSs1 = step >= 3;
  const showE2  = step >= 3;
  const showSs2 = step >= 4;

  function reset() {
    setStep(0);
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-ecdh-chain"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            The blinding chain
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 380 }}
      >
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 720 320"
            className="w-full max-w-4xl mx-auto"
            style={{ minWidth: 600 }}
          >
            {/* Alice on the left */}
            <g>
              <rect
                x={20}
                y={74}
                width={60}
                height={48}
                fill="#fffdf5"
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              <text
                x={50}
                y={103}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="#0f172a"
                style={{ letterSpacing: "0.05em" }}
              >
                ALICE
              </text>
              <text
                x={50}
                y={142}
                textAnchor="middle"
                fontSize={10}
                fill="#475569"
                style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
              >
                session_key
              </text>
            </g>

            {/* Backbone dashes from Alice to E0 */}
            <line
              x1={80}
              y1={98}
              x2={120}
              y2={98}
              stroke="#475569"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />

            {/* E0 */}
            <KeyBox x={150} y={80} label="E₀" subtitle="= s · G" />

            {/* ss0 down to Bob */}
            {showSs0 && (
              <>
                <line
                  x1={170}
                  y1={120}
                  x2={170}
                  y2={225}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <SecretBubble x={170} y={225} label="ss₀" stroke={HOPS[0].stroke} fill={HOPS[0].fill} />
                <text
                  x={170}
                  y={262}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#0f172a"
                  style={{ letterSpacing: "0.05em" }}
                >
                  → BOB
                </text>
              </>
            )}

            {/* Blinding 0 connector */}
            {showE1 && (
              <BlindingArrow from={[200, 100]} to={[330, 100]} label="× b₀" />
            )}

            {/* E1 */}
            {showE1 && <KeyBox x={350} y={80} label="E₁" subtitle="= E₀ · b₀" />}

            {/* ss1 down to Charlie */}
            {showSs1 && (
              <>
                <line
                  x1={370}
                  y1={120}
                  x2={370}
                  y2={225}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <SecretBubble x={370} y={225} label="ss₁" stroke={HOPS[1].stroke} fill={HOPS[1].fill} />
                <text
                  x={370}
                  y={262}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#0f172a"
                  style={{ letterSpacing: "0.05em" }}
                >
                  → CHARLIE
                </text>
              </>
            )}

            {/* Blinding 1 connector */}
            {showE2 && (
              <BlindingArrow from={[400, 100]} to={[530, 100]} label="× b₁" />
            )}

            {/* E2 */}
            {showE2 && <KeyBox x={550} y={80} label="E₂" subtitle="= E₁ · b₁" />}

            {/* ss2 down to Dave */}
            {showSs2 && (
              <>
                <line
                  x1={570}
                  y1={120}
                  x2={570}
                  y2={225}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <SecretBubble x={570} y={225} label="ss₂" stroke={HOPS[2].stroke} fill={HOPS[2].fill} />
                <text
                  x={570}
                  y={262}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#0f172a"
                  style={{ letterSpacing: "0.05em" }}
                >
                  → DAVE
                </text>
              </>
            )}

            {/* Bottom hop nodes */}
            {HOPS.map((h, i) => {
              const x = 170 + i * 200;
              return (
                <g key={h.id}>
                  <rect
                    x={x - 22}
                    y={285}
                    width={44}
                    height={20}
                    fill={h.fill}
                    stroke={h.stroke}
                    strokeWidth={1.5}
                  />
                  <text
                    x={x}
                    y={299}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#0f172a"
                    style={{ letterSpacing: "0.05em" }}
                  >
                    {h.label.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
              data-testid="onion-ecdh-chain-reset"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`onion-ecdh-step-${i}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_DESCRIPTIONS[step]}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyBox({ x, y, label, subtitle }: { x: number; y: number; label: string; subtitle: string }) {
  return (
    <g>
      <rect
        x={x - 30}
        y={y}
        width={60}
        height={40}
        fill="#fffdf5"
        stroke="#b8860b"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#0f172a"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 32}
        textAnchor="middle"
        fontSize={9}
        fill="#475569"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        {subtitle}
      </text>
    </g>
  );
}

function SecretBubble({
  x,
  y,
  label,
  stroke,
  fill,
}: {
  x: number;
  y: number;
  label: string;
  stroke: string;
  fill: string;
}) {
  return (
    <g>
      <rect
        x={x - 22}
        y={y - 13}
        width={44}
        height={26}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#0f172a"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        {label}
      </text>
    </g>
  );
}

function BlindingArrow({ from, to, label }: { from: [number, number]; to: [number, number]; label: string }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const midX = (x1 + x2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2 - 6}
        y2={y2}
        stroke="#475569"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <path
        d={`M${x2 - 6},${y2 - 4} L${x2},${y2} L${x2 - 6},${y2 + 4}`}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <text
        x={midX}
        y={y1 - 8}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#0f172a"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        {label}
      </text>
    </g>
  );
}

export default EcdhChainDiagram;
