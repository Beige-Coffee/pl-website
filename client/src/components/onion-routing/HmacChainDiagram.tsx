import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// HmacChainDiagram
//
// Three-step interactive walkthrough of the reverse-order wrap loop, showing
// how each iteration writes a hop's payload + next_hmac to the buffer, XORs
// with rho, and produces the HMAC that becomes next_hmac for the layer above.
// Used in Chapter 7.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { id: "dave", label: "Dave", color: "#fecaca", stroke: "#dc2626" },
  { id: "carol", label: "Carol", color: "#bbf7d0", stroke: "#16a34a" },
  { id: "bob", label: "Bob", color: "#bfdbfe", stroke: "#2563eb" },
];

export function HmacChainDiagram() {
  const [step, setStep] = useState(0);

  // step 0 = Dave done, 1 = Carol done, 2 = Bob done

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-hmac-chain"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Building the HMAC chain — innermost first
      </div>

      {/* Three stacked panels, one per hop */}
      <div className="space-y-2">
        {HOPS.map((h, i) => {
          const reached = step >= i;
          return (
            <Layer
              key={h.id}
              hop={h}
              isCurrent={step === i}
              isCompleted={reached}
              prevHmacFrom={i === 0 ? null : HOPS[i - 1]}
            />
          );
        })}
      </div>

      {/* Step controls */}
      <div className="mt-4 flex flex-col md:flex-row md:items-start md:gap-4">
        <div className="flex gap-1.5">
          {HOPS.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                step >= i
                  ? "bg-primary text-foreground border-border"
                  : "bg-card text-foreground/50 border-border hover:bg-secondary"
              }`}
              data-testid={`onion-hmac-step-${h.id}`}
            >
              {i + 1}. {h.label}
            </button>
          ))}
        </div>
        <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
          {STEP_CAPTIONS[step]}
        </div>
      </div>
    </div>
  );
}

const STEP_CAPTIONS = [
  "Iteration 1 — Dave (innermost). Shift the buffer right by Dave's payload size. Write Dave's TLV payload + 32 zero bytes (no inner hop, so no next_hmac to point to). XOR with Dave's rho. Compute dave_hmac with Dave's mu. Save dave_hmac as next_hmac for Carol's iteration.",
  "Iteration 2 — Carol. Shift right by Carol's payload size. Write Carol's TLV payload, then append dave_hmac (32 bytes). XOR with Carol's rho. Compute carol_hmac. Save it as next_hmac for Bob.",
  "Iteration 3 — Bob (outermost). Shift right by Bob's payload size. Write Bob's TLV payload, append carol_hmac. XOR with Bob's rho. Compute bob_hmac. This is what goes in the packet's hmac field; Bob will verify it before decrypting.",
];

function Layer({
  hop,
  isCurrent,
  isCompleted,
  prevHmacFrom,
}: {
  hop: { id: string; label: string; color: string; stroke: string };
  isCurrent: boolean;
  isCompleted: boolean;
  prevHmacFrom: { id: string; label: string; color: string; stroke: string } | null;
}) {
  return (
    <div
      className="border-2 p-3 transition-all"
      style={{
        background: isCompleted ? hop.color : "#f8fafc",
        borderColor: isCompleted ? hop.stroke : "#cbd5e1",
        opacity: isCompleted ? 1 : 0.45,
        outline: isCurrent ? `3px solid ${hop.stroke}` : "none",
        outlineOffset: -3,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">{hop.label}'s layer</div>
        {isCompleted && (
          <div
            className="text-xs px-2 py-0.5 border-2 font-mono"
            style={{ borderColor: hop.stroke, background: "#fffdf5", color: "#0f172a" }}
          >
            {hop.id}_hmac → outer
          </div>
        )}
      </div>

      <div className="flex gap-1 items-center text-xs flex-wrap">
        <Cell label={`${hop.label} payload`} color={hop.color} stroke={hop.stroke} />
        <Cell
          label={prevHmacFrom ? `${prevHmacFrom.label.toLowerCase()}_hmac` : "32 zeros"}
          color={prevHmacFrom?.color ?? "#e2e8f0"}
          stroke={prevHmacFrom?.stroke ?? "#94a3b8"}
        />
        {isCompleted && <span className="opacity-60 text-xs">+ encrypted inner buffer</span>}
        {isCompleted && (
          <>
            <span className="mx-1 opacity-50">→ XOR rho_{hop.id} → HMAC mu_{hop.id} →</span>
            <Cell label={`${hop.id}_hmac`} color="#fef3c7" stroke="#b8860b" />
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  color,
  stroke,
}: {
  label: string;
  color: string;
  stroke: string;
}) {
  return (
    <div
      className="px-2 py-1 border-2 text-xs font-mono"
      style={{ background: color, borderColor: stroke, color: "#0f172a" }}
    >
      {label}
    </div>
  );
}

export default HmacChainDiagram;
