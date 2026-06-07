import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MORPH_TRANSITION } from "./morph";

// ────────────────────────────────────────────────────────────────────────────
// ErrorBoomerangDiagram (rebuilt 2026-05-08)
//
// Animated trace of an error wrapping its way back from Charlie (failing
// hop) → Bob → Alice. Each beat shows the additional ammag layer that's
// XORed on top, with the wrapped error rendered as a stack of layered
// strips colored by which hop's keystream applied.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie";

const HOP_FILL: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
};
const HOP_STROKE: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
};
const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
};

const HOPS: HopId[] = ["alice", "bob", "charlie"];
const NODE_X_PCT: Record<HopId, number> = {
  alice: 14,
  bob: 50,
  charlie: 86,
};

const TOTAL_BEATS = 5;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Charlie has decided to fail this payment with `temporary_channel_failure`. He needs to send the failure code back to Alice without leaking any information to Bob along the way.",
  1: "Charlie builds the unencrypted error packet: a 32-byte HMAC tag (computed with his um key over the failure payload) followed by the 260-byte length-prefixed payload. 292 bytes total.",
  2: "Charlie XORs the 292-byte packet with his ammag keystream and sends the result back upstream to Bob. Bob can't read it; he doesn't have Charlie's ammag.",
  3: "Bob doesn't try to decode the bytes he received. He just XORs them with his own ammag keystream, adding another encryption layer, and sends the result upstream to Alice.",
  4: "Alice receives 292 bytes that have been XORed with Bob's ammag and Charlie's ammag, in that order from outside in. She'll peel them in chapter 11's algorithm: Bob's layer first, then Charlie's, until she finds the layer whose um HMAC verifies.",
};

export function ErrorBoomerangDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2200);
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

  // Derived state: where is the packet right now, and what layers are on it?
  // step 0: idle (Charlie is failing, no packet yet)
  // step 1: at Charlie, plaintext (32B HMAC + 260B payload)
  // step 2: at Charlie, after XOR with ammag_charlie (sending to Bob)
  // step 3: at Bob, after XOR with ammag_bob (sending to Alice)
  // step 4: at Alice
  const packetLocationPct =
    step === 0 || step === 1 || step === 2
      ? NODE_X_PCT.charlie
      : step === 3
        ? NODE_X_PCT.bob
        : NODE_X_PCT.alice;

  const arrowFromTo: { from: HopId; to: HopId } | null =
    step === 2
      ? { from: "charlie", to: "bob" }
      : step === 3
        ? { from: "bob", to: "alice" }
        : null;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-error-boomerang"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Error onion wraps backward
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-8"
        style={{ minHeight: 360 }}
      >
        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: 600, minHeight: 280 }}>
            {/* Backbone */}
            <div
              className="absolute"
              style={{
                top: 30,
                left: "14%",
                width: "72%",
                borderTop: "1.5px dashed #475569",
              }}
            />

            {/* Failure burst at Charlie (step 0+) */}
            {step >= 0 && (
              <div
                className="absolute text-[11px] tracking-[0.04em]"
                style={{
                  left: `${NODE_X_PCT.charlie}%`,
                  top: -8,
                  transform: "translateX(-50%)",
                  color: "#a13a3a",
                  fontFamily: MONO,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                ✗ FAIL
              </div>
            )}

            {/* Nodes */}
            {HOPS.map((id) => (
              <div
                key={id}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${NODE_X_PCT[id]}%`,
                  top: 16,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="w-20 h-12 flex items-center justify-center border-[1.5px]"
                  style={{
                    background: HOP_FILL[id],
                    borderColor: HOP_STROKE[id],
                    color: "#0f172a",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  }}
                >
                  {HOP_LABEL[id].toUpperCase()}
                </div>
              </div>
            ))}

            {/* Arrow showing direction of error flow */}
            {arrowFromTo && (
              <svg
                className="absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: 80,
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <marker
                    id="arrow-back"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="10"
                    markerHeight="10"
                    orient="auto"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#a13a3a" />
                  </marker>
                </defs>
                <path
                  d={`M ${getXPx(NODE_X_PCT[arrowFromTo.from], 600) - 36},36 L ${getXPx(NODE_X_PCT[arrowFromTo.to], 600) + 36},36`}
                  stroke="#a13a3a"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#arrow-back)"
                  style={{ transition: "all 600ms ease-in-out" }}
                />
              </svg>
            )}

            {/* The packet visualization. Mounted from step 0 as a persistent
                element so it morphs (travel + contents fade-in) instead of
                popping in at step 1. At step 0 it sits idle at Charlie with no
                visible packet yet. */}
            <div
              className="absolute flex flex-col items-center transition-all"
              style={{
                left: `${packetLocationPct}%`,
                top: 90,
                transform: "translateX(-50%)",
                transitionDuration: "700ms",
                transitionTimingFunction: "ease-in-out",
                opacity: step >= 1 ? 1 : 0,
                pointerEvents: step >= 1 ? "auto" : "none",
              }}
            >
              <PacketStack step={step} />
              <div
                className="text-[10px] mt-1.5 tracking-[0.04em] transition-opacity duration-500"
                style={{
                  color: "#475569",
                  fontFamily: MONO,
                  opacity: step >= 1 ? 1 : 0,
                }}
              >
                292 B total
              </div>
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

function PacketStack({ step }: { step: number }) {
  // Visualize the stacked layers on the error packet:
  // step 1: just plaintext (white core)
  // step 2: plaintext + Charlie's ammag layer (charlie color)
  // step 3, 4: + Bob's ammag layer (bob color outermost)
  const hasCharlie = step >= 2;
  const hasBob = step >= 3;
  return (
    <div
      className="relative"
      style={{
        width: 160,
        minHeight: 60,
      }}
    >
      {/* Outermost: Bob's ammag (only after Bob wraps). Each ammag layer grows
          in (opacity + scaleY from the top) so it visibly wraps on rather than
          popping. */}
      <AnimatePresence initial={false}>
        {hasBob && (
          <motion.div
            key="ammag-bob"
            className="border-[1.5px] flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0, scaleY: 0.55, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.55, y: -4 }}
            transition={MORPH_TRANSITION}
            style={{
              transformOrigin: "top center",
              background: HOP_FILL.bob,
              borderColor: HOP_STROKE.bob,
              padding: "5px 6px",
              color: "#0f172a",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              fontFamily: MONO,
            }}
          >
            ⊕ ammag_bob
          </motion.div>
        )}
      </AnimatePresence>
      {/* Charlie's ammag layer */}
      <AnimatePresence initial={false}>
        {hasCharlie && (
          <motion.div
            key="ammag-charlie"
            className="border-[1.5px] flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0, scaleY: 0.55, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.55, y: -4 }}
            transition={MORPH_TRANSITION}
            style={{
              transformOrigin: "top center",
              background: HOP_FILL.charlie,
              borderColor: HOP_STROKE.charlie,
              padding: "5px 6px",
              color: "#0f172a",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              fontFamily: MONO,
              margin: "1.5px 6px",
            }}
          >
            ⊕ ammag_charlie
          </motion.div>
        )}
      </AnimatePresence>
      {/* Inner: hmac + payload */}
      <div
        className="border-[1.5px] flex items-center justify-center"
        style={{
          background: "#fffdf5",
          borderColor: "#a13a3a",
          padding: "5px 6px",
          color: "#0f172a",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.02em",
          fontFamily: MONO,
          margin: hasCharlie ? "1.5px 14px" : 0,
        }}
      >
        hmac (32) || payload (260)
      </div>
    </div>
  );
}

function getXPx(pct: number, viewportPx: number): number {
  return (pct / 100) * viewportPx;
}

export default ErrorBoomerangDiagram;
