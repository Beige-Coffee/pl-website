import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PlaintextMessageTear (DRAFT)
//
// Animated naive-routing visualization. The payment message rectangle
// physically translates from Alice → Bob → Charlie → Dave. At each hop the
// destination hop's slice highlights, is read, and then is *removed from the
// payload* before the message moves on. This matches BOLT 4 Sphinx behavior:
// a forwarding hop peels its own per-hop payload off and only the rest gets
// passed on. The privacy leak in this naive design is that each hop sees every
// downstream slice while it's still in the stack (Bob learns the whole route
// from himself onward, including that Dave is the destination).
//
// Visual style follows the Noise capstone:
//   - Black section-header bar with white pixel-letter-spaced uppercase title.
//   - The packet header itself is BLACK with WHITE text ("PAYMENT_INSTRUCTIONS").
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents on the
//     active slice and active node.
//   - Body sans-serif; protocol values in JetBrains Mono.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

// Canonical hop palette — must stay aligned with HtlcPropagationDiagram and
// ForwarderPolicyMap so the same characters carry the same colors across the
// course.
const HOP_COLORS: Record<HopId, { stroke: string; fill: string }> = {
  alice:   { stroke: "#b8860b", fill: "#fef3c7" },
  bob:     { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave:    { stroke: "#7b4b8a", fill: "#ede1f3" },
};

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
// 0: message at Alice, full stack visible (slices for Bob, Charlie, Dave)
// 1: message arrives at Bob, Bob's slice highlights (Bob is reading it)
// 2: Bob peels his slice off; only Charlie+Dave slices remain on the wire
// 3: message arrives at Charlie, Charlie's slice highlights
// 4: Charlie peels his slice off; only Dave's slice remains
// 5: message arrives at Dave, Dave's slice highlights (final hop reads it)
const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice's payment message carries a stack of per-hop slices in plaintext. She'll hand the whole stack to Bob, and each hop will peel off its own slice before forwarding the rest.",
  1: "The message arrives at Bob. He reads the front slice: forward 10,002 sat to Charlie at CLTV 220. The slices for Charlie and Dave are still in plaintext beneath it, so Bob already learns the final amount, the payment hash, and that Dave is the destination.",
  2: "Bob peels his slice off the stack and forwards only Charlie's and Dave's slices onward. The slice is gone from the wire, but Bob already saw every downstream field while it was passing through him.",
  3: "Charlie reads his slice: forward 10,000 sat to Dave at CLTV 180. Like Bob, he can also see Dave's slice beneath, so the final amount and payment hash are visible to him too.",
  4: "Charlie peels his slice off and forwards Dave's slice on alone. Each forwarder consumed its own slice before passing the rest along.",
  5: "Dave reads the final slice and accepts the HTLC. Payment delivered. But every hop saw every downstream slice while it was passing through, so Bob learned the entire route. That's the privacy issue we have to solve.",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

function highlightedAt(step: number, hop: "bob" | "charlie" | "dave"): boolean {
  if (hop === "bob" && step === 1) return true;
  if (hop === "charlie" && step === 3) return true;
  if (hop === "dave" && step === 5) return true;
  return false;
}

// In real BOLT 4 / Sphinx, a forwarder peels its own per-hop payload off the
// onion before forwarding. We mirror that here: Bob's slice leaves the stack
// after step 1, Charlie's after step 3. Dave's slice is the final payload.
function isRemoved(forHop: "bob" | "charlie" | "dave", step: number): boolean {
  if (forHop === "bob") return step >= 2;
  if (forHop === "charlie") return step >= 4;
  return false;
}

// Which hops have actually read this slice while it was on the wire.
// A slice is read by every hop that processed the message while the slice was
// still in the stack — i.e. up to and including the hop that peels it off.
function seenByAt(forHop: "bob" | "charlie" | "dave", step: number): string[] {
  const out: string[] = [];
  if (forHop === "bob") {
    if (step >= 1) out.push("bob");
  } else if (forHop === "charlie") {
    if (step >= 1) out.push("bob");
    if (step >= 3) out.push("charlie");
  } else {
    if (step >= 1) out.push("bob");
    if (step >= 3) out.push("charlie");
    if (step >= 5) out.push("dave");
  }
  return out;
}

// Layout: the 4 nodes sit horizontally. The message anchors to the active hop.
// Inset enough that the centered ~290px message doesn't overflow either edge
// of the stage at the leftmost (Alice) or rightmost (Dave) positions, with a
// little extra buffer so the message doesn't sit flush against the stage edge.
const NODE_X_PCT: Record<HopId, number> = {
  alice: 20,
  bob: 40,
  charlie: 60,
  dave: 80,
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
            A naive payment message
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6" style={{ minHeight: 440 }}>
        {/* Hop track */}
        <div className="relative" style={{ height: 88 }}>
          {/* Backbone dashes — HTML divs aligned to the vertical center of the
              circular nodes (which are 60px tall, so center sits at y=30). The
              segments start/end 30px out from each node's center to clear the
              circle's radius, plus a small visual buffer. */}
          {[0, 1, 2].map((i) => {
            const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  top: 29,
                  left: `calc(${startPct}% + 32px)`,
                  width: `calc(${endPct - startPct}% - 64px)`,
                  borderTop: "1.5px dashed #475569",
                }}
              />
            );
          })}

          {/* Circular hop nodes — match the canonical hop palette used in
              HtlcPropagationDiagram and ForwarderPolicyMap. */}
          {(["alice", "bob", "charlie", "dave"] as HopId[]).map((id) => {
            const isActive = active === id;
            const seen =
              (id === "alice" && step >= 1) ||
              (id === "bob" && step >= 2) ||
              (id === "charlie" && step >= 4);
            const label = id === "alice" ? "Alice" : id === "bob" ? "Bob" : id === "charlie" ? "Charlie" : "Dave";
            const hop = HOP_COLORS[id];
            return (
              <div
                key={id}
                className="absolute z-10 flex flex-col items-center"
                style={{
                  top: 0,
                  left: `${NODE_X_PCT[id]}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center transition-all duration-500 relative"
                  style={{
                    width: 60,
                    height: 60,
                    background: hop.fill,
                    color: "#0f172a",
                    border: `${isActive ? 3 : 2}px solid ${hop.stroke}`,
                    boxShadow: isActive
                      ? `0 0 0 4px rgba(184,134,11,0.30)`
                      : undefined,
                  }}
                >
                  <span
                    className="font-bold"
                    style={{
                      fontSize: 22,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {label.charAt(0)}
                  </span>
                  {seen && !isActive && (
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#5a7a2f] text-white text-[10px] font-bold flex items-center justify-center border-[1.5px] border-[#fffdf5]"
                      title="Already saw the entire payload"
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold tracking-[0.05em]"
                  style={{ color: "#0f172a" }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* The traveling message */}
        <div
          className="absolute"
          style={{
            top: 112,
            left: `calc(${messageLeftPct}% - 145px)`,
            width: 290,
            transition: "left 1.2s cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        >
          {/* Black header strip (PAYMENT_INSTRUCTIONS) */}
          <div
            className="bg-black text-white px-3 py-1.5 border-[1.5px] border-black flex items-center gap-2"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            <div className="w-1.5 h-1.5 bg-[#b8860b]" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
              PAYMENT_INSTRUCTIONS
            </span>
          </div>

          {/* Envelope body. We don't introduce the onion_routing_packet
              sub-field here yet — that's a Sphinx concept and we haven't
              motivated it. payment_hash sits at the envelope level (BOLT 2)
              and stays the same across hops, so it doubles as a small
              reminder that there's a real envelope around the slice stack. */}
          <div
            className="bg-[#fffdf5] border-[1.5px] border-t-0 border-black p-2"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            {/* Envelope-level field (constant across all hops). */}
            <div className="text-[10px] leading-tight px-1 mb-2">
              <span className="opacity-60">payment_hash:</span>{" "}
              <span className="font-bold">0xa3f1...e9c4</span>
            </div>

            {/* Slice stack. Each forwarder peels its own slice off before
                forwarding (matches BOLT 4 Sphinx behavior). The privacy leak
                this visual is making honest is that every hop still sees every
                *downstream* slice while the message is passing through. */}
            <div className="space-y-1.5">
            {SLICES.map((s) => {
              const isActive = highlightedAt(step, s.forHop);
              const removed = isRemoved(s.forHop, step);
              const seenBy = seenByAt(s.forHop, step);
              return (
                <div
                  key={s.forHop}
                  className="border-[1.5px] px-2 py-1.5 relative overflow-hidden"
                  style={{
                    borderColor: isActive ? "#b8860b" : "#475569",
                    background: isActive ? "#fef3c7" : "#fffdf5",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    transition: "max-height 700ms ease-in-out, opacity 700ms ease-in-out, padding 700ms ease-in-out, border-width 700ms ease-in-out, margin 700ms ease-in-out",
                    maxHeight: removed ? 0 : 240,
                    opacity: removed ? 0 : 1,
                    paddingTop: removed ? 0 : undefined,
                    paddingBottom: removed ? 0 : undefined,
                    marginTop: removed ? 0 : undefined,
                    marginBottom: removed ? 0 : undefined,
                    borderWidth: removed ? 0 : undefined,
                  }}
                >
                  <div className="text-[9px] uppercase tracking-wider opacity-60 mb-0.5 flex items-center gap-1.5">
                    <span>slice for {s.forHop}</span>
                    {seenBy.length > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[#5a7a2f] normal-case tracking-normal">
                        ✓ seen by {seenBy.join(", ")}
                      </span>
                    )}
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
