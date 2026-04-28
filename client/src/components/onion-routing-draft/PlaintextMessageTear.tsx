import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PlaintextMessageTear (DRAFT)
//
// Animated naive-routing visualization. The update_add_htlc message rectangle
// physically translates from Alice → Bob → Charlie → Dave; at each hop the
// destination hop's slice highlights and is "consumed", and the message
// shrinks before continuing.
//
// Visual style follows the Noise capstone:
//   - Black section-header bar with white pixel-letter-spaced uppercase title.
//   - The packet header itself is BLACK with WHITE text ("UPDATE_ADD_HTLC").
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents on the
//     active slice and active node.
//   - Body sans-serif; protocol values in JetBrains Mono.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

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

// Step semantics (auto-advancing animation):
// 0: message at Alice, full payload visible
// 1: message arrives at Bob, Bob's slice highlights
// 2: Bob's slice consumed (faded out)
// 3: message arrives at Charlie, Charlie's slice highlights
// 4: Charlie's slice consumed
// 5: message arrives at Dave, Dave's slice highlights
const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice's update_add_htlc carries every hop's instructions in plaintext, in order. She's about to hand it to Bob.",
  1: "The message arrives at Bob. He reads his slice off the front: forward 10,002 sat to Charlie, outgoing CLTV block 220.",
  2: "Bob has read what he needs. Notice he's also seen everything else inside the message. The packet shrinks and continues to Charlie.",
  3: "Charlie reads his slice: forward 10,000 sat to Dave, outgoing CLTV block 180. He also saw the final destination's instructions.",
  4: "Charlie's slice falls away. The remaining message moves on to Dave.",
  5: "Dave reads the final slice and accepts the HTLC. Payment delivered, but every hop along the way saw the entire route.",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

function tornAt(step: number, hop: "bob" | "charlie" | "dave"): boolean {
  if (hop === "bob") return step >= 2;
  if (hop === "charlie") return step >= 4;
  return false; // Dave is never "torn" — he reads it last
}

function highlightedAt(step: number, hop: "bob" | "charlie" | "dave"): boolean {
  if (hop === "bob" && step === 1) return true;
  if (hop === "charlie" && step === 3) return true;
  if (hop === "dave" && step === 5) return true;
  return false;
}

// Layout: the 4 nodes sit horizontally. The message anchors to the active hop.
// Inset enough that the centered ~290px message doesn't overflow either edge
// of the stage at the leftmost (Alice) or rightmost (Dave) positions.
const NODE_X_PCT: Record<HopId, number> = {
  alice: 17,
  bob: 39,
  charlie: 61,
  dave: 83,
};

export function PlaintextMessageTear() {
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
    }, 1700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  function play() {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  }
  function pause() { setPlaying(false); }
  function reset() { setPlaying(false); setStep(0); }

  const active = activeHopAt(step);
  const messageLeftPct = NODE_X_PCT[active];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-message-tear"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header — Noise capstone style */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            A naive update_add_htlc
          </span>
        </div>
        <span className="text-xs italic opacity-70 hidden sm:inline">watch what each hop sees</span>
      </div>

      {/* Stage */}
      <div className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6" style={{ minHeight: 420 }}>
        {/* Hop track */}
        <div className="relative" style={{ height: 60 }}>
          {/* Backbone arrows between nodes (rendered first so badges sit on top) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            {[0, 1, 2].map((i) => {
              const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
              const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
              return (
                <line
                  key={i}
                  x1={`${startPct}%`}
                  y1={24}
                  x2={`${endPct}%`}
                  y2={24}
                  stroke="#475569"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              );
            })}
          </svg>

          {/* Badges absolutely positioned at NODE_X_PCT centers */}
          {(["alice", "bob", "charlie", "dave"] as HopId[]).map((id) => {
            const isActive = active === id;
            const past =
              (id === "alice" && step >= 1) ||
              (id === "bob" && step >= 3) ||
              (id === "charlie" && step >= 5);
            const label = id === "alice" ? "Alice" : id === "bob" ? "Bob" : id === "charlie" ? "Charlie" : "Dave";
            return (
              <div
                key={id}
                className="absolute z-10"
                style={{
                  top: 0,
                  left: `${NODE_X_PCT[id]}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="w-20 h-12 flex items-center justify-center border-[1.5px] transition-all duration-500 bg-card"
                  style={{
                    background: isActive ? "#b8860b" : "#fffdf5",
                    color: isActive ? "#fffdf5" : "#0f172a",
                    borderColor: isActive ? "#b8860b" : "#0f172a",
                    opacity: past && !isActive ? 0.4 : 1,
                  }}
                >
                  <span className="text-sm font-bold tracking-[0.05em] uppercase">
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* The traveling message */}
        <div
          className="absolute"
          style={{
            top: 84,
            left: `calc(${messageLeftPct}% - 145px)`,
            width: 290,
            transition: "left 1.2s cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        >
          {/* Black header strip (UPDATE_ADD_HTLC) */}
          <div
            className="bg-black text-white px-3 py-1.5 border-[1.5px] border-black flex items-center gap-2"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            <div className="w-1.5 h-1.5 bg-[#b8860b]" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
              UPDATE_ADD_HTLC
            </span>
          </div>

          {/* Slice stack */}
          <div className="bg-[#fffdf5] border-[1.5px] border-t-0 border-black p-2 space-y-1.5">
            {SLICES.map((s) => {
              const isTorn = tornAt(step, s.forHop);
              const isActive = highlightedAt(step, s.forHop);
              return (
                <div
                  key={s.forHop}
                  className="border-[1.5px] px-2 py-1.5 transition-all duration-500"
                  style={{
                    borderColor: isActive ? "#b8860b" : "#475569",
                    background: isTorn
                      ? "transparent"
                      : isActive
                      ? "#fef3c7"
                      : "#fffdf5",
                    opacity: isTorn ? 0.15 : 1,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    transform: isTorn ? "translateX(-12px) scale(0.95)" : "translateX(0) scale(1)",
                  }}
                >
                  <div className="text-[9px] uppercase tracking-wider opacity-60 mb-0.5">
                    slice for {s.forHop}
                  </div>
                  <div className="text-[10px] leading-tight space-y-0.5">
                    {s.fields.map((f) => (
                      <div key={f.key}>
                        <span className="opacity-60">{f.key}:</span>{" "}
                        <span className="font-bold">{f.value}</span>
                      </div>
                    ))}
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
              data-testid="onion-message-tear-play"
            >
              {playing ? "❚❚ Pause" : step >= TOTAL_STEPS - 1 ? "↻ Replay" : "▶ Play"}
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
                  onClick={() => { setPlaying(false); setStep(i); }}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`onion-message-tear-step-${i}`}
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

export default PlaintextMessageTear;
