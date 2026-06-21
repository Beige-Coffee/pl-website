import { useLayoutEffect, useRef, useState } from "react";
import { StepCaption } from "./StepCaption";
import { Tooltip } from "./Tooltip";

// ────────────────────────────────────────────────────────────────────────────
// PlaintextMessageTear (DRAFT)
//
// Animated NAIVE-routing visualization. The payment message rectangle
// physically translates from Alice → Bob → Charlie → Dave. At each hop the
// destination hop's slice highlights, is read, and then is *removed from the
// payload* before the message moves on, so the packet visibly shrinks as it
// travels. This is a deliberately NAIVE teaching model, NOT real Sphinx. Real
// BOLT 4 Sphinx does the opposite: a forwarding hop peels its own per-hop
// payload off, then re-pads the packet with filler so the total length stays a
// constant 1,300 bytes and never shrinks (bolt04.md:976-977). The constant
// size is what keeps the route length hidden. The privacy leak in this naive
// design is that each hop sees every downstream slice while it's still in the
// stack (Bob learns the whole route from himself onward, including that Dave is
// the destination).
//
// Visual style follows the Noise capstone:
//   - Black section-header bar with white pixel-letter-spaced uppercase title.
//   - The packet header itself is BLACK with WHITE text ("PAYMENT_INSTRUCTIONS").
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents on the
//     active slice and active node.
//   - Body sans-serif; protocol values in JetBrains Mono.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

// Canonical hop palette, must stay aligned with HtlcPropagationDiagram and
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
      { key: "final_cltv", value: "block 180" },
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
  0: "So, Alice's payment message carries a stack of per-hop slices, all in plaintext. She'll hand the whole stack to Bob, and each forwarder will peel off its own slice before passing the rest along. Let's watch what happens...",
  1: "Now the message lands at Bob. He reads the front slice: forward 10,002 sat to Charlie at CLTV 220. But notice Charlie's and Dave's slices are still sitting in plaintext underneath, so Bob *already* sees the final amount, the payment hash, and that Dave is where this is headed.",
  2: "Bob peels his slice off and forwards just Charlie's and Dave's slices onward. The slice is off the wire now, but the damage is done. Bob saw every downstream field while the message passed through him.",
  3: "Next, Charlie reads his slice: forward 10,000 sat to Dave at CLTV 180. And just like Bob, he can read Dave's slice underneath, so the final amount and payment hash are sitting right there for him too.",
  4: "Charlie peels his slice off and sends Dave's slice on alone. Each forwarder took its own slice before passing the rest along.",
  5: "Finally, Dave reads the last slice and accepts the HTLC. Payment delivered! But here's the catch: every hop saw every downstream slice on the way through, so Bob learned the whole route. That's the privacy problem we'll spend this course fixing.",
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
// still in the stack, i.e. up to and including the hop that peels it off.
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

// Per-hop tooltip text for a node's green "✓" badge. We invert the same
// seenByAt() bookkeeping to ask, for a given hop, which slices it actually read
// while the message passed through. This matters because each forwarder peels
// its own slice off (isRemoved), so a hop never reads slices that were already
// removed before it processed the message. Bob is the only hop who genuinely
// saw the entire stack; Charlie reads after Bob's slice is already gone, so he
// never saw Bob's slice.
function seenPayloadDescription(hop: HopId, step: number): string {
  if (hop === "alice") {
    // Alice assembled every slice herself.
    return "Alice assembled the entire payload herself, so she knows every slice and the whole route.";
  }
  // Which downstream slices did this hop read while it was on the wire?
  const sawOwn = seenByAt(
    hop as "bob" | "charlie" | "dave",
    step,
  ).includes(hop);
  const sliceForHops: Array<"bob" | "charlie" | "dave"> = ["bob", "charlie", "dave"];
  const seenSlices = sliceForHops.filter((forHop) =>
    seenByAt(forHop, step).includes(hop),
  );
  const others = seenSlices.filter((forHop) => forHop !== hop);
  const ownLabel = sawOwn ? `his own slice` : "";
  const otherLabels = others.map((h) => `${h[0].toUpperCase()}${h.slice(1)}'s`);

  // Bob processed the message while all three slices were still in the stack,
  // so he saw the entire payload. Charlie/Dave read only what remained.
  if (hop === "bob") {
    return "Bob saw the entire payload (his own slice plus Charlie's and Dave's) while the message passed through, so he learned the final amount, the payment hash, and that Dave is the destination.";
  }
  if (otherLabels.length === 0) {
    return `${hop[0].toUpperCase()}${hop.slice(1)} read only his own slice; the earlier hops' slices were already peeled off before the message reached him.`;
  }
  const parts = [ownLabel, ...otherLabels].filter(Boolean);
  const joined =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} plus ${parts[parts.length - 1]}`
      : parts[0];
  const cap = `${hop[0].toUpperCase()}${hop.slice(1)}`;
  return `${cap} saw the rest of the payload (${joined}), not the slices that earlier hops had already peeled off.`;
}

// Layout: the 4 nodes sit horizontally. The message anchors to the active hop.
// Inset enough that the centered ~290px message doesn't overflow either edge
// of the stage at the leftmost (Alice) or rightmost (Dave) positions, with a
// little extra buffer so the message doesn't sit flush against the stage edge.
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

export function PlaintextMessageTear() {
  const [step, setStep] = useState(0);

  function back() { setStep((s) => Math.max(0, s - 1)); }
  function next() { setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); }
  function reset() { setStep(0); }

  const active = activeHopAt(step);

  // The 290px message card slides under the active node. We compute its `left`
  // as a plain pixel number against the measured stage width, on purpose: the
  // 1.2s `left` transition only animates reliably between plain `px` values.
  // CSS `calc()`/`%`/`min()`/`max()` left values freeze at the start frame in
  // Chrome (interpolation between non-plain-length values is flaky), which left
  // the card stuck off-position. Measuring lets us both center exactly under the
  // node (matching the node's own `pct%` positioning inside the padded content
  // box) and clamp so the card never clips off the stage at Alice or Dave.
  const MSG_W = 290;
  const EDGE = 16; // matches the stage's `px-4` horizontal padding
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  let messageLeft = EDGE; // pre-measure fallback (Alice's resting spot)
  if (stageW > 0) {
    const contentW = stageW - 2 * EDGE; // node `%` is relative to this inner box
    const nodeCenter = EDGE + (NODE_X_PCT[active] / 100) * contentW;
    const ideal = nodeCenter - MSG_W / 2;
    messageLeft = Math.max(EDGE, Math.min(stageW - MSG_W - EDGE, ideal));
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-message-tear"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header, Noise capstone style */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            A naive payment message
          </span>
        </div>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6" style={{ minHeight: 440 }}>
        {/* Hop track */}
        <div className="relative" style={{ height: 88 }}>
          {/* Backbone dashes, HTML divs aligned to the vertical center of the
              circular nodes (which are 64px tall, so center sits at y=32). The
              segments start/end 32px out from each node's center to clear the
              circle's radius, plus a small visual buffer. */}
          {[0, 1, 2].map((i) => {
            const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  top: 31,
                  left: `calc(${startPct}% + 34px)`,
                  width: `calc(${endPct - startPct}% - 68px)`,
                  borderTop: "1.5px dashed #475569",
                }}
              />
            );
          })}

          {/* Circular hop nodes, match the canonical hop palette used in
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
                    width: 64,
                    height: 64,
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
                    <Tooltip
                      label={
                        <div>
                          {seenPayloadDescription(id, step)}
                        </div>
                      }
                    >
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#5a7a2f] text-white text-[10px] font-bold flex items-center justify-center border-[1.5px] border-[#fffdf5]"
                      >
                        ✓
                      </span>
                    </Tooltip>
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

        {/* The traveling message. Centered under the active node
            (`messageLeftPct% - 145px`, half the 290px width), but clamped so
            the card never spills off the stage at the leftmost (Alice) or
            rightmost (Dave) positions, where centering alone would clip it. */}
        <div
          className="absolute"
          style={{
            top: 112,
            left: messageLeft,
            width: MSG_W,
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
              sub-field here yet, that's a Sphinx concept and we haven't
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
                    transition: "max-height 700ms ease-in-out, opacity 700ms ease-in-out, padding 700ms ease-in-out, border-width 700ms ease-in-out, margin 700ms ease-in-out, border-color 450ms ease-in-out, background-color 450ms ease-in-out",
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

        {/* Spacer reserving the absolutely-positioned message's vertical
            footprint so the StepCaption below flows clear of it. */}
        <div aria-hidden style={{ height: 300 }} />

        <StepCaption
          label={`Step ${step + 1} of ${TOTAL_STEPS}`}
          caption={STEP_CAPTIONS[step]}
          accentColor={HOP_COLORS[active].stroke}
        />
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex gap-1.5 items-center flex-wrap shrink-0">
          <button
            onClick={back}
            disabled={step <= 0}
            className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            data-testid="onion-message-tear-back"
          >
            ← Back
          </button>
          <button
            onClick={next}
            disabled={step >= TOTAL_STEPS - 1}
            className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            data-testid="onion-message-tear-next"
          >
            Next →
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
                onClick={() => setStep(i)}
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
      </div>
    </div>
  );
}

export default PlaintextMessageTear;
