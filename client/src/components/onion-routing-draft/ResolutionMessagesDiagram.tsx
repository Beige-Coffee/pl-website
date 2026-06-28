import type { ReactNode } from "react";
import { MONO, SANS, INK, NEUTRAL_TEXT, FOCUS_GOLD } from "./WrapTraceDiagram";
import { HatchOverlay } from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// ResolutionMessagesDiagram  (tag: <resolution-messages>)
//
// Static reference for chapter 11's "How a failure travels back" section. Shows
// the three ways an HTLC resolves between two channel peers, and where the error
// onion actually lives: the `reason` field of update_fail_htlc, the mirror of how
// the forward onion rode in update_add_htlc.
// ────────────────────────────────────────────────────────────────────────────

const SUCCESS = "#1f7a4a";
const FAIL = "#a13a3a";
const NEUTRAL = "#475569";

// The course wraps content in .noise-md-dark, whose layered
// "span/strong/em { color: ... !important }" repaints our colored text grey in
// dark mode (invisible on the cream cards). Re-assert each element's own inline
// color with !important (inline wins over a layered !important) so the diagram
// keeps its palette in both themes. See reference-noise-md-important-cascade.
function forceInlineColors(root: HTMLDivElement | null) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const c = el.style.color;
    if (c) el.style.setProperty("color", c, "important");
  });
}

function Field({
  label,
  value,
  accent,
  strong = false,
}: {
  label: string;
  value: string;
  accent: string;
  strong?: boolean;
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 whitespace-nowrap border-[1.5px]"
      style={{
        fontFamily: MONO,
        fontSize: 11,
        padding: "2px 7px",
        borderColor: `${accent}66`,
        background: `${accent}0c`,
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.04em]"
        style={{ color: accent, fontWeight: 700 }}
      >
        {label}
      </span>
      <span style={{ color: INK, fontWeight: strong ? 700 : 600 }}>{value}</span>
    </span>
  );
}

function MsgCard({
  name,
  outcome,
  accent,
  children,
  footnote,
}: {
  name: string;
  outcome: string;
  accent: string;
  children: ReactNode;
  footnote: ReactNode;
}) {
  return (
    <div
      className="border-[1.5px] overflow-hidden flex flex-col"
      style={{ borderColor: accent, background: "#fffdf5", flex: "1 1 0", minWidth: 210 }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between gap-2"
        style={{ background: `${accent}18`, borderBottom: `1.5px solid ${accent}40` }}
      >
        <span className="text-[11px] font-bold" style={{ fontFamily: MONO, color: accent }}>
          {name}
        </span>
        <span
          className="text-[8.5px] uppercase tracking-[0.06em] font-bold shrink-0"
          style={{ fontFamily: SANS, color: accent }}
        >
          {outcome}
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2 flex-1">
        {children}
        <div
          className="text-[11px] mt-auto pt-1"
          style={{ fontFamily: SANS, color: NEUTRAL_TEXT, lineHeight: 1.4 }}
        >
          {footnote}
        </div>
      </div>
    </div>
  );
}

export function ResolutionMessagesDiagram() {
  return (
    <div
      ref={forceInlineColors}
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-resolution-messages"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">How an HTLC resolves</span>
      </div>

      <div className="bg-[#fefdfb] px-4 py-6 overflow-x-auto">
        <div style={{ minWidth: 680 }}>
          <div className="flex gap-3 items-stretch">
            <MsgCard
              name="update_fulfill_htlc"
              outcome="success"
              accent={SUCCESS}
              footnote={
                <>
                  The{" "}
                  <span style={{ fontFamily: MONO, color: INK }}>preimage</span> settles the payment.
                </>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                <Field label="channel_id" value="AliceBob1" accent={SUCCESS} />
                <Field label="id" value="0" accent={SUCCESS} />
                <Field label="payment_preimage" value="0x9c2f…" accent={SUCCESS} strong />
              </div>
            </MsgCard>

            <MsgCard
              name="update_fail_htlc"
              outcome="failure"
              accent={FAIL}
              footnote={<>Handed to the upstream peer, hop by hop, back toward Alice.</>}
            >
              <div className="flex flex-wrap gap-1.5">
                <Field label="channel_id" value="AliceBob1" accent={FAIL} />
                <Field label="id" value="0" accent={FAIL} />
              </div>
              <div
                className="border-[1.5px] relative overflow-hidden mt-0.5"
                style={{ borderColor: FOCUS_GOLD, background: "#fffdf5", padding: "5px 8px" }}
              >
                <HatchOverlay hops={["dave"]} zIndex={1} stripeOpacity={0.16} />
                <div className="flex items-center justify-between relative gap-2" style={{ zIndex: 2 }}>
                  <span
                    className="text-[9px] uppercase tracking-[0.06em] shrink-0"
                    style={{
                      fontFamily: MONO,
                      color: FOCUS_GOLD,
                      fontWeight: 700,
                      background: "rgba(255,253,245,0.9)",
                      padding: "0 4px",
                    }}
                  >
                    reason
                  </span>
                  <span
                    className="text-[10px] shrink-0"
                    style={{
                      fontFamily: MONO,
                      color: INK,
                      fontWeight: 700,
                      background: "rgba(255,253,245,0.9)",
                      padding: "0 4px",
                    }}
                  >
                    the error onion
                  </span>
                </div>
              </div>
            </MsgCard>

            <MsgCard
              name="update_fail_malformed_htlc"
              outcome="unreadable onion"
              accent={NEUTRAL}
              footnote={
                <>
                  For an onion a hop couldn't decrypt. Its upstream neighbor turns this into a normal{" "}
                  <span style={{ fontFamily: MONO, color: INK }}>update_fail_htlc</span>.
                </>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                <Field label="channel_id" value="AliceBob1" accent={NEUTRAL} />
                <Field label="id" value="0" accent={NEUTRAL} />
                <Field label="failure_code" value="BADONION" accent={NEUTRAL} strong />
                <Field label="sha256_of_onion" value="0x4e1a…" accent={NEUTRAL} />
              </div>
            </MsgCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResolutionMessagesDiagram;
