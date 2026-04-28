import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// ErrorUnwrapDiagram
//
// Walks Alice through the trial-decrypt loop: she XORs with ammag_i, checks
// the HMAC under um_i, and either accepts (failing hop found) or continues.
// Used in Chapter 10.
// ────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "Alice receives the wrapped error",
    desc: "288 bytes of opaque encrypted bytes. Without the right keys, this looks indistinguishable from random noise.",
    keysTried: [],
  },
  {
    title: "Iteration i=0 — try Bob's ammag and um",
    desc: "XOR with Bob's ammag keystream, then check HMAC(um_bob, peeled[32:]) == peeled[:32]. The HMAC doesn't verify, because Bob isn't the failing hop. Continue.",
    keysTried: ["bob"],
  },
  {
    title: "Iteration i=1 — try Carol's ammag and um",
    desc: "XOR again with Carol's ammag. Now check HMAC(um_carol, peeled[32:]) == peeled[:32]. The HMAC verifies! Carol is the failing hop. Parse peeled[32:] as the failure message.",
    keysTried: ["bob", "carol"],
  },
];

const HOP_COLORS: Record<string, { fill: string; stroke: string }> = {
  bob:   { fill: "#bfdbfe", stroke: "#2563eb" },
  carol: { fill: "#bbf7d0", stroke: "#16a34a" },
};

export function ErrorUnwrapDiagram() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-error-unwrap"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Alice peels the error onion (trial decrypt)
      </div>

      {/* Stack of layers */}
      <div className="space-y-1.5 mb-4">
        {["bob", "carol"].map((hop) => {
          const colors = HOP_COLORS[hop];
          const tried = s.keysTried.includes(hop);
          return (
            <div
              key={hop}
              className="border-2 px-3 py-2 text-sm transition-opacity"
              style={{
                background: tried ? "#fef3c7" : colors.fill,
                borderColor: colors.stroke,
                opacity: tried ? 0.65 : 1,
                textDecoration: tried ? "line-through" : "none",
              }}
            >
              {hop === "bob" ? "Bob's ammag wrap (outermost)" : "Carol's ammag wrap (innermost) → contains the actual HMAC + failure message"}
            </div>
          );
        })}
      </div>

      <div className="text-sm font-semibold mb-1">{s.title}</div>
      <div className="text-sm leading-relaxed mb-3">{s.desc}</div>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
              step >= i
                ? "bg-primary text-foreground border-border"
                : "bg-card text-foreground/50 border-border hover:bg-secondary"
            }`}
            data-testid={`onion-error-unwrap-step-${i}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ErrorUnwrapDiagram;
