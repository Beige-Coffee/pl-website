import { useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// SharedSecretSymmetryDiagram (DRAFT)
//
// Side-by-side comparison of how Alice (sender) and each forwarder (receiver)
// arrive at the same (E_i, ss_i) pairs from opposite sides of the ECDH
// equation. Alice walks the chain forward using her private session key plus
// each hop's published public key. Each forwarder walks it forward starting
// from whatever E_i arrived in its inbound onion plus its own private node
// key. Both sides land on the same ss_i, by the algebraic symmetry of ECDH.
//
// Visual format follows the locked onion-routing spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - Step controls footer with play/pause/reset + numbered step buttons.
// ────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice computes (E_i, ss_i) for every hop up front using her session key. Each forwarder will independently arrive at the same ss_i using its own private key plus the E_i it received. Same values, two angles.",
  1: "Both Alice and Bob arrive at ss_0, by different paths. Alice multiplies her session key by Bob's public key; Bob multiplies his private key by E_0 from the inbound packet. ECDH guarantees they match.",
  2: "Alice already pre-computed ss_1 by blinding her session key and multiplying by Charlie's public key. Charlie does the same with his private key plus E_1 from the inbound packet, and they meet on the same ss_1.",
  3: "Alice closes the loop with ss_2. Dave is the final hop, so there is no E_3 to forward, just the shared secret he uses to peel his payload.",
};

type HopKey = "bob" | "charlie" | "dave";

interface HopRow {
  id: HopKey;
  label: string;
  // Alice-side lines (her view)
  aliceLines: string[];
  // Forwarder-side lines (their view)
  forwarderLines: string[];
}

const HOPS: HopRow[] = [
  {
    id: "bob",
    label: "Hop 0 (Bob)",
    aliceLines: [
      "e₀ = session_key",
      "E₀ = e₀·G",
      "ss₀ = SHA256(e₀ · bob_pubkey)",
    ],
    forwarderLines: [
      "ss₀ = SHA256(bob_privkey · E₀)",
      "E₁ = E₀·b₀",
      "(forwards E₁)",
    ],
  },
  {
    id: "charlie",
    label: "Hop 1 (Charlie)",
    aliceLines: [
      "e₁ = e₀·b₀",
      "E₁ = E₀·b₀",
      "ss₁ = SHA256(e₁ · charlie_pubkey)",
    ],
    forwarderLines: [
      "ss₁ = SHA256(charlie_privkey · E₁)",
      "E₂ = E₁·b₁",
      "(forwards E₂)",
    ],
  },
  {
    id: "dave",
    label: "Hop 2 (Dave)",
    aliceLines: [
      "e₂ = e₁·b₁",
      "E₂ = E₁·b₁",
      "ss₂ = SHA256(e₂ · dave_pubkey)",
    ],
    forwarderLines: [
      "ss₂ = SHA256(dave_privkey · E₂)",
      "(final hop)",
      "—",
    ],
  },
];

// Step -> which hop row is highlighted on both sides. Step 0 highlights none.
function highlightedHopAt(step: number): HopKey | null {
  if (step === 1) return "bob";
  if (step === 2) return "charlie";
  if (step === 3) return "dave";
  return null;
}

const BEAT_DURATION_MS = 2200;

// ── Hop card subcomponent ──────────────────────────────────────────────────

interface HopCardProps {
  title: string;
  lines: string[];
  active: boolean;
  side: "left" | "right";
}

function HopCard({ title, lines, active, side }: HopCardProps) {
  return (
    <div
      className="border-[1.5px] px-3 py-2 transition-all duration-300"
      style={{
        borderColor: active ? "#b8860b" : "#0f172a",
        background: active ? "#fef3c7" : "#fffdf5",
        transform: active ? "scale(1.02)" : "scale(1)",
        boxShadow: active ? "0 0 0 2px rgba(184,134,11,0.15)" : "none",
        textAlign: side === "left" ? "left" : "right",
      }}
    >
      <div
        className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1.5"
        style={{ color: active ? "#b8860b" : "#475569" }}
      >
        {title}
      </div>
      <div
        className="text-[11px] leading-relaxed space-y-0.5"
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          color: "#0f172a",
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className="whitespace-nowrap overflow-hidden text-ellipsis">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function SharedSecretSymmetryDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(() => {
      setStep((s) => {
        if (s + 1 >= TOTAL_STEPS) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, BEAT_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  function play() {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  }
  function pause() {
    setPlaying(false);
  }
  function reset() {
    setPlaying(false);
    setStep(0);
  }

  const highlighted = highlightedHopAt(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="shared-secret-symmetry"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Alice's view vs the forwarder's view
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
          style={{ minHeight: 480, minWidth: 720 }}
        >
          {/* Two-column header pills */}
          <div
            className="grid items-center mb-4"
            style={{ gridTemplateColumns: "1fr 140px 1fr", gap: 0 }}
          >
            <div className="flex justify-center">
              <div
                className="px-3 py-1 border-[1.5px] text-[10px] font-bold tracking-[0.08em] uppercase"
                style={{
                  borderColor: "#0f172a",
                  background: "#fffdf5",
                  color: "#0f172a",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                Alice — sender side
              </div>
            </div>
            <div />
            <div className="flex justify-center">
              <div
                className="px-3 py-1 border-[1.5px] text-[10px] font-bold tracking-[0.08em] uppercase"
                style={{
                  borderColor: "#0f172a",
                  background: "#fffdf5",
                  color: "#0f172a",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                Forwarder — receiver side
              </div>
            </div>
          </div>

          {/* Hop rows. Each row is a 3-column grid: left card, connector, right
              card. The middle column hosts the dashed gold line and the
              "= same ss_i" pill. */}
          <div className="space-y-5">
            {HOPS.map((hop, idx) => {
              const isActive = highlighted === hop.id;
              const ssLabel = `ss_${idx}`;
              return (
                <div
                  key={hop.id}
                  className="grid items-center"
                  style={{ gridTemplateColumns: "1fr 140px 1fr", gap: 0 }}
                >
                  {/* Left: Alice's view */}
                  <div className="pr-3">
                    <HopCard
                      title={hop.label}
                      lines={hop.aliceLines}
                      active={isActive}
                      side="left"
                    />
                  </div>

                  {/* Connector column */}
                  <div className="relative h-full flex items-center justify-center">
                    {/* Horizontal dashed line */}
                    <div
                      className="absolute left-0 right-0 transition-all duration-500"
                      style={{
                        top: "50%",
                        borderTop: `1.5px dashed ${isActive ? "#b8860b" : "#94a3b8"}`,
                        opacity: isActive ? 1 : 0.55,
                      }}
                    />
                    {/* "= same ss_i" pill, anchored mid-line */}
                    <div
                      className="relative z-10 px-2 py-0.5 border-[1.5px] transition-all duration-300"
                      style={{
                        borderColor: isActive ? "#b8860b" : "#475569",
                        background: isActive ? "#b8860b" : "#fffdf5",
                        color: isActive ? "#fffdf5" : "#475569",
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                        boxShadow: isActive
                          ? "0 2px 8px rgba(184,134,11,0.35)"
                          : "none",
                      }}
                    >
                      = same {ssLabel}
                    </div>
                  </div>

                  {/* Right: Forwarder's view */}
                  <div className="pl-3">
                    <HopCard
                      title={hop.id === "bob" ? "Bob" : hop.id === "charlie" ? "Charlie" : "Dave"}
                      lines={hop.forwarderLines}
                      active={isActive}
                      side="right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="shared-secret-symmetry-play"
            >
              {playing
                ? "❚❚ Pause"
                : step >= TOTAL_STEPS - 1
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlaying(false);
                    setStep(i);
                  }}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background:
                      step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`shared-secret-symmetry-step-${i}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_CAPTIONS[step]}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SharedSecretSymmetryDiagram;
