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
// Used in Chapter 3.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { id: "bob",   label: "Bob",   color: "#bfdbfe", stroke: "#2563eb" },
  { id: "carol", label: "Carol", color: "#bbf7d0", stroke: "#16a34a" },
  { id: "dave",  label: "Dave",  color: "#fecaca", stroke: "#dc2626" },
];

const STEP_DESCRIPTIONS = [
  "Alice's session key starts the chain. E₀ = session_key · G is the only ephemeral key she sends; it goes to Bob in the onion header.",
  "Bob receives E₀, computes ss₀ = ECDH(bob_privkey, E₀). Alice already knows ss₀ from session_key · bob_pubkey. Same value, two paths.",
  "Both sides compute b₀ = SHA256(E₀ ‖ ss₀) and use it to advance the chain: e₁ = e₀ · b₀, E₁ = E₀ · b₀.",
  "Carol receives E₁, computes ss₁ = ECDH(carol_privkey, E₁). Same SHA256 trick produces b₁, advancing to E₂ = E₁ · b₁.",
  "Dave receives E₂, computes ss₂ = ECDH(dave_privkey, E₂). No further hop, so the chain ends here.",
];

export function EcdhChainDiagram() {
  const [step, setStep] = useState(0);

  // Visibility per step:
  //   0: only E0 box, alice on the left
  //   1: + ss0 dropping down from E0 toward Bob
  //   2: + b0 connector + E1 box
  //   3: + ss1 toward Carol + b1 + E2
  //   4: + ss2 toward Dave (chain complete)
  const showSs0 = step >= 1;
  const showE1  = step >= 2;
  const showSs1 = step >= 3;
  const showE2  = step >= 3;
  const showSs2 = step >= 4;

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-ecdh-chain"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        The blinding chain (Alice's view)
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 720 280"
          className="w-full max-w-4xl mx-auto"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {/* Alice on the left */}
          <g>
            <circle cx={50} cy={100} r={26} fill="#fde68a" stroke="#b8860b" strokeWidth={2} />
            <text x={50} y={104} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">Alice</text>
            <text x={50} y={140} textAnchor="middle" fontSize={9} fill="#475569">
              session_key
            </text>
          </g>

          {/* E0 */}
          <KeyBox x={150} y={80} label="E₀" subtitle="= s · G" />

          {/* ss0 down to Bob */}
          {showSs0 && (
            <>
              <line x1={170} y1={120} x2={170} y2={205} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
              <SecretBubble x={170} y={205} label="ss₀" stroke={HOPS[0].stroke} />
              <text x={170} y={245} textAnchor="middle" fontSize={9} fill="#475569">→ Bob</text>
            </>
          )}

          {/* Blinding 0 connector */}
          {showE1 && (
            <BlindingArrow from={[200, 100]} to={[330, 100]} label="× b₀" />
          )}

          {/* E1 */}
          {showE1 && <KeyBox x={350} y={80} label="E₁" subtitle="= E₀ · b₀" />}

          {/* ss1 down to Carol */}
          {showSs1 && (
            <>
              <line x1={370} y1={120} x2={370} y2={205} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
              <SecretBubble x={370} y={205} label="ss₁" stroke={HOPS[1].stroke} />
              <text x={370} y={245} textAnchor="middle" fontSize={9} fill="#475569">→ Carol</text>
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
              <line x1={570} y1={120} x2={570} y2={205} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
              <SecretBubble x={570} y={205} label="ss₂" stroke={HOPS[2].stroke} />
              <text x={570} y={245} textAnchor="middle" fontSize={9} fill="#475569">→ Dave</text>
            </>
          )}

          {/* Bottom hops row */}
          {HOPS.map((h, i) => {
            const x = 170 + i * 200;
            return (
              <g key={h.id}>
                <circle cx={x} cy={260} r={14} fill={h.color} stroke={h.stroke} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Step controls */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:gap-4">
        <div className="flex gap-1.5">
          {STEP_DESCRIPTIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                step >= i
                  ? "bg-primary text-foreground border-border"
                  : "bg-card text-foreground/50 border-border hover:bg-secondary"
              }`}
              data-testid={`onion-ecdh-step-${i}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1">
          {STEP_DESCRIPTIONS[step]}
        </div>
      </div>
    </div>
  );
}

function KeyBox({ x, y, label, subtitle }: { x: number; y: number; label: string; subtitle: string }) {
  return (
    <g>
      <rect x={x - 30} y={y} width={60} height={40} rx={4} fill="#fffdf5" stroke="#b8860b" strokeWidth={2} />
      <text x={x} y={y + 18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">{label}</text>
      <text
        x={x}
        y={y + 32}
        textAnchor="middle"
        fontSize={9}
        fill="#475569"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        {subtitle}
      </text>
    </g>
  );
}

function SecretBubble({ x, y, label, stroke }: { x: number; y: number; label: string; stroke: string }) {
  return (
    <g>
      <rect x={x - 20} y={y - 12} width={40} height={24} rx={12} fill="#fef3c7" stroke={stroke} strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">{label}</text>
    </g>
  );
}

function BlindingArrow({ from, to, label }: { from: [number, number]; to: [number, number]; label: string }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const midX = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - 6} y2={y2} stroke="#475569" strokeWidth={1.5} />
      <path d={`M${x2 - 6},${y2 - 4} L${x2},${y2} L${x2 - 6},${y2 + 4}`} fill="none" stroke="#475569" strokeWidth={1.5} />
      <text x={midX} y={y1 - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">{label}</text>
    </g>
  );
}

export default EcdhChainDiagram;
