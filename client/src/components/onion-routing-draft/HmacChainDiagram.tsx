import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// HmacChainDiagram (rebuilt 2026-05-08)
//
// Reverse-order wrap loop. Three layers stack from innermost (Dave, top)
// outward (Bob, bottom). Each step lights up one layer, showing the hop payload
// being written, the rho XOR happening, and the HMAC being computed and
// passed up to the next iteration.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "bob" | "charlie" | "dave";

const HOP_FILL: Record<HopId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE: Record<HopId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const HOP_LABEL: Record<HopId, string> = {
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

// Iteration order: Dave (innermost), then Charlie, then Bob (outermost).
const ITERATION_ORDER: HopId[] = ["dave", "charlie", "bob"];

const STEP_CAPTIONS: Record<number, string> = {
  0: "Iteration 1, Dave (innermost). Shift the buffer right by Dave's hop payload size. Write Dave's TLV payload + 32 zero bytes (no inner hop, so no HMAC to point to). XOR with Dave's rho keystream. Apply the filler overlay over the trailing positions. Compute dave_hmac with Dave's mu. Save it as next_hmac for Charlie's iteration.",
  1: "Iteration 2, Charlie. Shift right by Charlie's hop payload size. Write Charlie's TLV payload, then append dave_hmac (which we computed last iteration). XOR with Charlie's rho. Compute charlie_hmac with Charlie's mu. Save it as next_hmac for Bob.",
  2: "Iteration 3, Bob (outermost). Shift right by Bob's hop payload size. Write Bob's TLV payload, then append charlie_hmac. XOR with Bob's rho. Compute bob_hmac with Bob's mu. This is the value that goes in the packet's hmac field; Bob will verify it before decrypting anything.",
};

export function HmacChainDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= ITERATION_ORDER.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2300);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= ITERATION_ORDER.length - 1) setStep(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-hmac-chain"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Per-hop HMACs, innermost first
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 380 }}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 540 }}>
            <div className="space-y-2">
              {ITERATION_ORDER.map((hop, i) => {
                const reached = step >= i;
                const isCurrent = step === i;
                const prev = i === 0 ? null : ITERATION_ORDER[i - 1];
                return (
                  <Layer
                    key={hop}
                    hop={hop}
                    isCurrent={isCurrent}
                    isCompleted={reached}
                    prevHmacFrom={prev}
                  />
                );
              })}
            </div>

            <div
              className="mt-4 text-[11px] tracking-[0.04em]"
              style={{ color: "#475569", letterSpacing: "0.02em" }}
            >
              Each layer's HMAC commits to the layers underneath. That's why we
              build inside-out: the outer HMAC depends on the inner contents
              already being present.
            </div>
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            >
              {playing
                ? "❚❚ Pause"
                : step >= ITERATION_ORDER.length - 1
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
              {ITERATION_ORDER.map((hop, i) => (
                <button
                  key={hop}
                  onClick={() => setStep(i)}
                  className="px-2 h-7 border-[1.5px] text-xs font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "rgba(15,23,42,0.4)",
                    color: step === i ? "#fff" : "#0f172a",
                  }}
                >
                  {i + 1}. {HOP_LABEL[hop]}
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

function Layer({
  hop,
  isCurrent,
  isCompleted,
  prevHmacFrom,
}: {
  hop: HopId;
  isCurrent: boolean;
  isCompleted: boolean;
  prevHmacFrom: HopId | null;
}) {
  const fill = HOP_FILL[hop];
  const stroke = HOP_STROKE[hop];
  return (
    <div
      className="border-[1.5px] p-3 transition-all"
      style={{
        background: isCompleted ? fill : "#fffdf5",
        borderColor: isCompleted ? stroke : "rgba(15,23,42,0.25)",
        opacity: isCompleted ? 1 : 0.55,
        outline: isCurrent ? `2.5px solid #b8860b` : "none",
        outlineOffset: -3,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="font-bold text-sm"
            style={{ color: "#0f172a", letterSpacing: "0.02em" }}
          >
            {HOP_LABEL[hop]}'s wrap
          </span>
          {!prevHmacFrom && (
            <span
              className="text-[10px] uppercase tracking-[0.06em]"
              style={{ color: "#475569" }}
            >
              innermost
            </span>
          )}
        </div>
        {isCompleted && (
          <div
            className="text-[10px] px-2 py-0.5 border-[1.5px]"
            style={{
              borderColor: stroke,
              background: "#fffdf5",
              color: "#0f172a",
              fontFamily: MONO,
              letterSpacing: "0.02em",
            }}
          >
            {hop}_hmac → next iteration
          </div>
        )}
      </div>

      <div className="flex gap-1 items-center text-xs flex-wrap">
        <Cell label={`${HOP_LABEL[hop]} TLV`} fill={fill} stroke={stroke} />
        <Cell
          label={
            prevHmacFrom
              ? `${prevHmacFrom}_hmac (32B)`
              : "32B zeros"
          }
          fill={prevHmacFrom ? HOP_FILL[prevHmacFrom] : "#f1f5f9"}
          stroke={prevHmacFrom ? HOP_STROKE[prevHmacFrom] : "#94a3b8"}
        />
        {isCompleted && (
          <>
            <span
              className="mx-1 text-[10px]"
              style={{ color: "#475569", fontFamily: MONO }}
            >
              + inner buffer → XOR rho_{hop} → HMAC mu_{hop} →
            </span>
            <Cell label={`${hop}_hmac`} fill="#fef3c7" stroke="#b8860b" />
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  fill,
  stroke,
}: {
  label: string;
  fill: string;
  stroke: string;
}) {
  return (
    <div
      className="px-2 py-1 border-[1.5px] text-[11px]"
      style={{
        background: fill,
        borderColor: stroke,
        color: "#0f172a",
        fontFamily: MONO,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </div>
  );
}

export default HmacChainDiagram;
