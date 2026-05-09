import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// ErrorUnwrapDiagram (rebuilt 2026-05-08)
//
// Walks Alice through the trial-decrypt loop on the wrapped error onion.
// Each step shows: which hop's keys she's trying, what the peeled bytes
// look like, whether the um HMAC verified, and what she does next.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "bob" | "charlie";

const HOP_FILL: Record<HopId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
};
const HOP_STROKE: Record<HopId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
};
const HOP_LABEL: Record<HopId, string> = {
  bob: "Bob",
  charlie: "Charlie",
};

const TOTAL_BEATS = 4;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice has just received 292 bytes of opaque encrypted data on the return HTLC. She doesn't know which hop failed; she has to find out by trial-decrypting layer by layer.",
  1: "Iteration i=0. Try Bob's keys first (the outermost layer). XOR with ammag_bob, then check HMAC(um_bob, peeled[32:]) against peeled[:32]. The HMAC doesn't match — Bob isn't the failing hop. Continue.",
  2: "Iteration i=1. Try Charlie's keys. XOR with ammag_charlie, then check HMAC(um_charlie, peeled[32:]) against peeled[:32]. ✓ The HMAC verifies. Charlie is the failing hop.",
  3: "Parse the failure message. The first 2 bytes of payload are a u16 BE giving failure_len. The next failure_len bytes are the failure message itself (e.g., temporary_channel_failure with a channel_update appended). Alice can now retry on a different route or surface the failure to her wallet.",
};

export function ErrorUnwrapDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2300);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_BEATS - 1) setStep(0);
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
      data-testid="onion-error-unwrap"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Alice peels the error
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
            <LayerStack step={step} />

            {step >= 1 && (
              <div className="mt-4 flex flex-col gap-2">
                <Iteration
                  hop="bob"
                  active={step === 1}
                  attempted={step >= 1}
                  result={step >= 2 ? "fail" : step === 1 ? "checking" : "idle"}
                  index={0}
                />
                <Iteration
                  hop="charlie"
                  active={step === 2 || step === 3}
                  attempted={step >= 2}
                  result={step >= 2 ? "match" : "idle"}
                  index={1}
                />
              </div>
            )}

            {step === 3 && (
              <div
                className="mt-4 border-[1.5px] p-3"
                style={{
                  background: "#fef3c7",
                  borderColor: "#b8860b",
                }}
              >
                <div
                  className="text-sm font-bold mb-1"
                  style={{ color: "#0f172a", letterSpacing: "0.02em" }}
                >
                  Decoded
                </div>
                <div
                  className="text-[12px]"
                  style={{
                    fontFamily: MONO,
                    color: "#0f172a",
                    letterSpacing: "0.02em",
                  }}
                >
                  failing_hop_index = 1 (Charlie)
                  <br />
                  failure_code = 0x1007 (temporary_channel_failure)
                  <br />
                  failure_data = channel_update bytes
                </div>
              </div>
            )}
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
                : step >= TOTAL_BEATS - 1
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
              {Array.from({ length: TOTAL_BEATS }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "rgba(15,23,42,0.4)",
                    color: step === i ? "#fff" : "#0f172a",
                  }}
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

function LayerStack({ step }: { step: number }) {
  const bobPeeled = step >= 1;
  const charliePeeled = step >= 2;
  return (
    <div
      className="border-[1.5px] p-3"
      style={{
        background: "#fffdf5",
        borderColor: "rgba(15,23,42,0.25)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-2"
        style={{ color: "#475569" }}
      >
        Wrapped error onion
      </div>
      <div className="flex flex-col gap-1.5">
        <Layer
          label="Bob's ammag wrap (outermost)"
          fill={HOP_FILL.bob}
          stroke={HOP_STROKE.bob}
          peeled={bobPeeled}
        />
        <Layer
          label="Charlie's ammag wrap (innermost) → contains hmac + payload"
          fill={HOP_FILL.charlie}
          stroke={HOP_STROKE.charlie}
          peeled={charliePeeled}
        />
      </div>
    </div>
  );
}

function Layer({
  label,
  fill,
  stroke,
  peeled,
}: {
  label: string;
  fill: string;
  stroke: string;
  peeled: boolean;
}) {
  return (
    <div
      className="border-[1.5px] px-3 py-2 transition-all"
      style={{
        background: peeled ? "#fffdf5" : fill,
        borderColor: peeled ? "rgba(15,23,42,0.25)" : stroke,
        borderStyle: peeled ? "dashed" : "solid",
        color: "#0f172a",
        fontSize: 12,
        fontWeight: peeled ? 400 : 600,
        letterSpacing: "0.02em",
        textDecoration: peeled ? "line-through" : "none",
        opacity: peeled ? 0.55 : 1,
      }}
    >
      {label}
    </div>
  );
}

function Iteration({
  hop,
  active,
  attempted,
  result,
  index,
}: {
  hop: HopId;
  active: boolean;
  attempted: boolean;
  result: "idle" | "checking" | "fail" | "match";
  index: number;
}) {
  if (!attempted) return null;
  return (
    <div
      className="border-[1.5px] px-3 py-2 transition-all"
      style={{
        background: result === "match" ? "#e8f5d6" : "#fffdf5",
        borderColor:
          result === "match"
            ? "#5a7a2f"
            : result === "fail"
              ? "rgba(15,23,42,0.3)"
              : HOP_STROKE[hop],
        outline: active ? `2.5px solid #b8860b` : "none",
        outlineOffset: -3,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ color: "#0f172a", fontSize: 13 }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: MONO, fontWeight: 700 }}>
            i={index}: try {HOP_LABEL[hop]}'s keys
          </span>
        </div>
        <div
          className="text-[11px] px-2 py-0.5 border-[1.5px]"
          style={{
            fontFamily: MONO,
            background: result === "match" ? "#5a7a2f" : "#fde7e7",
            borderColor: result === "match" ? "#5a7a2f" : "#a13a3a",
            color: result === "match" ? "#fff" : "#a13a3a",
            letterSpacing: "0.02em",
          }}
        >
          {result === "match" ? "✓ HMAC matches" : "✗ HMAC fails"}
        </div>
      </div>
      <div
        className="mt-1 text-[11px]"
        style={{ color: "#475569", fontFamily: MONO, letterSpacing: "0.02em" }}
      >
        XOR with ammag_{hop} → check HMAC(um_{hop}, peeled[32:]) ?= peeled[:32]
      </div>
    </div>
  );
}

export default ErrorUnwrapDiagram;
