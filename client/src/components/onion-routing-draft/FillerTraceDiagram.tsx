import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// FillerTraceDiagram (rebuilt 2026-05-08)
//
// Step-by-step trace of the BOLT 4 filler algorithm. Two intermediate
// forwarders (Bob, Charlie). Each step grows the filler and shows which
// hop's keystream contributed to which positions.
//
// Step beats:
//   0: empty filler
//   1: append bob_size zeros (light cells)
//   2: XOR with last bob_size bytes of Bob's extended rho keystream (Bob blue)
//   3: prepend charlie_size zeros (light cells stacked on left)
//   4: XOR with last (bob+charlie) bytes of Charlie's extended rho keystream
//      (Charlie's keystream layered over both halves)
//   5: final filler, Charlie on top of Bob (left), Charlie on top of zeros (right)
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

const BOB_FILL = "#dbeafe";
const BOB_STROKE = "#3b6aa0";
const CHARLIE_FILL = "#ccece8";
const CHARLIE_STROKE = "#2d7a7a";
const ZERO_FILL = "#f1f5f9";
const ZERO_STROKE = "#94a3b8";

const BOB_SIZE = 8; // illustrative, not real bytes
const CHARLIE_SIZE = 6;

type CellState = {
  bob?: boolean; // Bob's keystream applied at this position
  charlie?: boolean; // Charlie's keystream applied at this position
};

const STEP_CAPTIONS: Record<number, string> = {
  0: "We start with an empty filler. We're going to grow it one hop at a time, building up the cumulative XOR pattern that Alice will splice into the packet during construction.",
  1: "Bob's hop, part 1. Append bob_size zero bytes. These represent the new positions that Bob's shift will introduce at the trailing end of Charlie's view of the packet.",
  2: "Bob's hop, part 2. XOR with the last bob_size bytes of Bob's extended rho keystream (1300 + bob_size total). The empty cells are now filled with Bob's keystream pattern.",
  3: "Charlie's hop, part 1. Prepend charlie_size zero bytes to the front of the filler. The new cells are zeros; the existing Bob cells are unchanged for the moment.",
  4: "Charlie's hop, part 2. XOR with the last (bob_size + charlie_size) bytes of Charlie's extended rho keystream. Now Charlie's keystream is applied across both halves: alone on the left, on top of Bob's on the right.",
  5: "Final filler. Total length = bob_size + charlie_size. When Alice splices this into the packet's trailing positions during construction, every forwarder's rho XOR during peeling cancels exactly the layer that hop contributed, leaving the bytes the next hop's HMAC was computed over.",
};

const TOTAL_BEATS = 6;

function buildCells(step: number): CellState[] {
  // Total length grows: 0 → bob_size → bob_size → bob+charlie → bob+charlie → bob+charlie
  switch (step) {
    case 0:
      return [];
    case 1:
      // bob_size empty cells
      return Array.from({ length: BOB_SIZE }, () => ({}));
    case 2:
      // bob_size cells with Bob's keystream
      return Array.from({ length: BOB_SIZE }, () => ({ bob: true }));
    case 3:
      // charlie_size empty cells prepended, then bob cells
      return [
        ...Array.from({ length: CHARLIE_SIZE }, () => ({})),
        ...Array.from({ length: BOB_SIZE }, () => ({ bob: true })),
      ];
    case 4:
    case 5:
      // charlie_size cells with Charlie's, then bob_size cells with Bob+Charlie
      return [
        ...Array.from({ length: CHARLIE_SIZE }, () => ({ charlie: true })),
        ...Array.from({ length: BOB_SIZE }, () => ({
          bob: true,
          charlie: true,
        })),
      ];
    default:
      return [];
  }
}

export function FillerTraceDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2100);
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

  const cells = buildCells(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-filler-trace"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Filler construction
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 600 }}>
            {/* Hop axis labels */}
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "#475569" }}
              >
                ← prepended (Charlie's side) | appended (Bob's side) →
              </div>
              <div
                className="text-[11px]"
                style={{ color: "#475569", fontFamily: MONO }}
              >
                length = {cells.length}
              </div>
            </div>

            {/* Filler bytes */}
            <div
              className="border-[1.5px] p-3 mb-4"
              style={{
                background: "#fffdf5",
                borderColor: "rgba(15,23,42,0.25)",
                minHeight: 78,
              }}
            >
              {cells.length === 0 ? (
                <div
                  className="text-sm italic flex items-center justify-center"
                  style={{ color: "#475569", height: 50 }}
                >
                  empty filler
                </div>
              ) : (
                <div className="flex gap-1 items-center">
                  {cells.map((cell, i) => {
                    let bg = ZERO_FILL;
                    let border = ZERO_STROKE;
                    let label = "0";
                    if (cell.bob && cell.charlie) {
                      bg = `linear-gradient(135deg, ${BOB_FILL} 50%, ${CHARLIE_FILL} 50%)`;
                      border = CHARLIE_STROKE;
                      label = "B+C";
                    } else if (cell.bob) {
                      bg = BOB_FILL;
                      border = BOB_STROKE;
                      label = "B";
                    } else if (cell.charlie) {
                      bg = CHARLIE_FILL;
                      border = CHARLIE_STROKE;
                      label = "C";
                    }
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center transition-all"
                        style={{
                          width: 32,
                          height: 32,
                          background: bg,
                          border: `1.5px solid ${border}`,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: MONO,
                          color: "#0f172a",
                          letterSpacing: "0.02em",
                        }}
                        title={
                          cell.bob && cell.charlie
                            ? "Bob's keystream + Charlie's keystream"
                            : cell.bob
                              ? "Bob's keystream"
                              : cell.charlie
                                ? "Charlie's keystream"
                                : "zero"
                        }
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[11px]">
              <LegendSwatch
                fill={ZERO_FILL}
                stroke={ZERO_STROKE}
                label="zero (placeholder)"
              />
              <LegendSwatch
                fill={BOB_FILL}
                stroke={BOB_STROKE}
                label="Bob's rho keystream"
              />
              <LegendSwatch
                fill={CHARLIE_FILL}
                stroke={CHARLIE_STROKE}
                label="Charlie's rho keystream"
              />
              <LegendSwatch
                fill={`linear-gradient(135deg, ${BOB_FILL} 50%, ${CHARLIE_FILL} 50%)`}
                stroke={CHARLIE_STROKE}
                label="Bob's keystream XORed with Charlie's"
              />
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

function LegendSwatch({
  fill,
  stroke,
  label,
}: {
  fill: string;
  stroke: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 14,
          height: 14,
          background: fill,
          border: `1.5px solid ${stroke}`,
        }}
      />
      <span style={{ color: "#475569", letterSpacing: "0.02em" }}>{label}</span>
    </div>
  );
}

export default FillerTraceDiagram;
