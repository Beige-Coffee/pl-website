import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PlaintextMessageTear (DRAFT)
//
// Naive-routing animation: Alice sends a single update_add_htlc carrying every
// hop's instructions in plaintext. Bob reads (and tears off) his slice, then
// forwards the rest to Charlie, who tears off his, and so on. The visualization
// makes it concrete that every byte is plaintext and Bob can see information
// meant for every downstream hop.
//
// Style: matches the Noise capstone palette — neutral background, dark borders,
// monochrome chrome, gold accents on the active slice. Sans-serif body text;
// JetBrains Mono for the protocol-message values.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { id: "bob", label: "Bob" },
  { id: "charlie", label: "Charlie" },
  { id: "dave", label: "Dave" },
];

interface Slice {
  forHop: "bob" | "charlie" | "dave";
  fields: Array<{ key: string; value: string }>;
}

const SLICES: Slice[] = [
  {
    forHop: "bob",
    fields: [
      { key: "next_hop", value: "Charlie" },
      { key: "amt_to_forward", value: "10,002 sat" },
      { key: "outgoing_cltv", value: "block 220" },
    ],
  },
  {
    forHop: "charlie",
    fields: [
      { key: "next_hop", value: "Dave" },
      { key: "amt_to_forward", value: "10,000 sat" },
      { key: "outgoing_cltv", value: "block 180" },
    ],
  },
  {
    forHop: "dave",
    fields: [
      { key: "final_amt", value: "10,000 sat" },
      { key: "final_cltv", value: "block 140" },
      { key: "payment_hash", value: "0xa3f1...e9c4" },
    ],
  },
];

// Step semantics:
// 0: Alice has the full message, nothing torn yet
// 1: Bob is reading his slice (active highlight)
// 2: Bob's slice is torn off; remainder is en route to Charlie
// 3: Charlie reads his slice
// 4: Charlie's slice is torn off; remainder en route to Dave
// 5: Dave reads his slice (the only one left)
const STEP_CAPTIONS = [
  "Alice's `update_add_htlc` packs every hop's instructions in plaintext, in order. She hands it to Bob.",
  "Bob reads his slice off the front: forward 10,002 sat to Charlie, outgoing CLTV block 220.",
  "Bob tears off his slice and forwards what's left to Charlie. Note: Bob has *seen* every downstream slice along the way.",
  "Charlie reads his slice: forward 10,000 sat to Dave, outgoing CLTV block 180.",
  "Charlie tears off his slice and forwards what's left to Dave.",
  "Dave reads the final slice and accepts the HTLC. Payment delivered.",
];

function activeHopAtStep(step: number): "alice" | "bob" | "charlie" | "dave" {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

function torn(step: number): Record<"bob" | "charlie" | "dave", boolean> {
  return {
    bob: step >= 2,
    charlie: step >= 4,
    dave: step >= 6, // never torn in our timeline
  };
}

function highlighted(step: number, hop: "bob" | "charlie" | "dave"): boolean {
  if (hop === "bob" && step === 1) return true;
  if (hop === "charlie" && step === 3) return true;
  if (hop === "dave" && step === 5) return true;
  return false;
}

export function PlaintextMessageTear() {
  const [step, setStep] = useState(0);
  const tornState = torn(step);
  const active = activeHopAtStep(step);

  return (
    <div
      className="my-8 border-2 border-foreground/30 bg-card"
      data-testid="onion-message-tear"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="px-4 py-2 border-b-2 border-foreground/20">
        <div className="text-xs uppercase tracking-wider opacity-70 font-pixel">
          A naive `update_add_htlc` — the issue with plaintext routing
        </div>
      </div>

      {/* Hop track */}
      <div className="p-4 md:p-6 bg-[#fafaf7] dark:bg-[#0b1220]">
        <div className="flex items-center gap-3 md:gap-6 mb-4">
          <NodeBadge label="Alice" active={active === "alice"} />
          <Arrow />
          {HOPS.map((h, i) => (
            <div key={h.id} className="flex items-center gap-3 md:gap-6">
              <NodeBadge
                label={h.label}
                active={active === h.id}
                done={tornState[h.id as keyof typeof tornState]}
              />
              {i < HOPS.length - 1 && <Arrow />}
            </div>
          ))}
        </div>

        {/* The message */}
        <div
          className="bg-background border-2 border-foreground/40 p-3"
          style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        >
          <div className="text-[11px] opacity-60 mb-2 uppercase tracking-wider">
            update_add_htlc payload (plaintext)
          </div>
          <div className="space-y-1.5">
            {SLICES.map((s) => {
              const isTorn = tornState[s.forHop];
              const isActive = highlighted(step, s.forHop);
              return (
                <div
                  key={s.forHop}
                  className="border-2 px-3 py-2 transition-all"
                  style={{
                    borderColor: isActive ? "#b8860b" : "#94a3b8",
                    background: isTorn
                      ? "transparent"
                      : isActive
                      ? "#fef3c7"
                      : "#fffdf5",
                    opacity: isTorn ? 0.18 : 1,
                    textDecoration: isTorn ? "line-through" : "none",
                    transform: isActive ? "translateX(4px)" : "translateX(0)",
                  }}
                >
                  <div className="text-[10px] opacity-60 mb-1 uppercase tracking-wide">
                    slice for {SLICES.find((x) => x.forHop === s.forHop)!.forHop}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {s.fields.map((f) => (
                      <div key={f.key}>
                        <span className="opacity-60">{f.key}:</span>{" "}
                        <span className="font-semibold">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-2 border-foreground/20">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 flex-wrap">
            {STEP_CAPTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                  step >= i
                    ? "bg-primary text-foreground border-border"
                    : "bg-card text-foreground/50 border-border hover:bg-secondary"
                }`}
                data-testid={`onion-message-tear-step-${i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_CAPTIONS[step]}
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeBadge({
  label,
  active,
  done,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className="border-2 px-3 py-2 text-sm font-semibold transition-all shrink-0"
      style={{
        background: active ? "#fef3c7" : done ? "#f1f5f9" : "#fffdf5",
        borderColor: active ? "#b8860b" : "#475569",
        color: "#0f172a",
        opacity: done && !active ? 0.55 : 1,
      }}
    >
      {label}
    </div>
  );
}

function Arrow() {
  return (
    <svg width={28} height={20} className="shrink-0">
      <path
        d="M2,10 L24,10 M18,4 L24,10 L18,16"
        fill="none"
        stroke="#475569"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default PlaintextMessageTear;
