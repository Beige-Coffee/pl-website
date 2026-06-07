// ────────────────────────────────────────────────────────────────────────────
// ValidationFlowDiagram (rebuilt 2026-06-07 — one-focal-element-per-beat pass)
//
// Animated, click-through "Forwarder Validation Loop" from Bob's view. Where
// PeelTraceDiagram (ch 9) traces the byte-mechanics of the peel, this visual
// foregrounds the DECISION layer that wraps around it: the ordering of the
// gates, the incoming-HTLC context, the forward-vs-destination branch, the
// fee/CLTV policy checks, and the three-way `process` outcome.
//
// Design rule (this rebuild): ONE focal element per beat. The incoming HTLC is
// a thin persistent context strip pinned at the top of every beat; everything
// secondary (full packet anatomy, key-derivation provenance, failure codes)
// lives behind a hover. Default state shows only the green success verdict.
//
// Beats:
//   1. RECEIVE   — the sealed 1,366-byte packet (HTLC carried by the strip)
//   2. GATE 1    — structural checklist (1,366 B? version 0x00?) → STRUCTURE OK
//   3. GATE 2    — verify HMAC(mu_B, hop_payloads ‖ AD) BEFORE decrypting
//   4. PEEL      — only now: XOR with rho_B to expose the hop payload (compact)
//   5. PARSE     — read the TLV: amt_to_forward, outgoing_cltv, short_channel_id
//   6. BRANCH    — forwarder (scid) vs destination (payment_data)
//   7. CHECK     — fees + timelocks against the incoming HTLC (strip highlights)
//   8. OUTCOME   — ForwardInstruction / FinalDelivery / Rejection (each holds ss)
//
// Reuses the shared trace primitives exported from WrapTraceDiagram plus
// KeyDerivationCard / KeyHoverIcon (key-disclosure pattern), HatchOverlay,
// MathLine, the viewport-clamped Tooltip, and StepCaption for the per-beat
// explanation block below the visual (§1.5). Locked onion-routing visual
// format spec.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";
import { KeyHoverIcon, type KeyDerivationRow } from "./KeyDerivationCard";
import { MathLine } from "./mathTokens";
import { MorphBox, CrossfadeSwap } from "./morph";
import { Tooltip } from "./Tooltip";
import { StepCaption } from "./StepCaption";
import {
  MONO,
  SANS,
  FOCUS_GOLD,
  INK,
  NEUTRAL_TEXT,
  HOP_STROKE,
  FULL_PACKET_BYTES,
  STEP_MS,
  BufferRegion,
  BufferHeader,
  SlotCell,
  type Beat,
  type Region,
} from "./WrapTraceDiagram";

const KEY_RHO_COLOR = "#b8860b";
const KEY_MU_COLOR = "#3b6aa0";
const VERIFY_GREEN = "#1f7a4a";
const ERROR_RED = "#a13a3a";
const ASSOC_DATA_COLOR = "#5a7a2f";

const TOTAL_BEATS = 8;

// This is a decision-flow visual, not a byte trace, so its beats run a touch
// faster than the byte-trace ceiling (STEP_MS = 2400 in WrapTraceDiagram). See
// onion-routing-visual-standards §10.
const BEAT_MS = Math.min(STEP_MS, 1900);

// Example values for Bob's incoming HTLC and his parsed TLV. Chosen so every
// policy check passes with a visible cushion (see CHECK beat).
const PAYMENT_HASH = "0x7af3…c29b";
const AMOUNT_IN_MSAT = 1_001_500; // incoming HTLC amount
const AMT_FORWARD_MSAT = 1_000_000; // TLV amt_to_forward
const FEE_MARGIN_MSAT = AMOUNT_IN_MSAT - AMT_FORWARD_MSAT; // 1,500 (Bob keeps this)
const FEE_REQUIRED_MSAT = 1_000; // Bob's published fee for this amount
const CLTV_IN = 842; // incoming HTLC cltv_expiry
const OUTGOING_CLTV = 800; // TLV outgoing_cltv_value
const CLTV_DELTA = 40; // Bob's published cltv_expiry_delta
const CLTV_MARGIN = CLTV_IN - OUTGOING_CLTV; // 42
const CURRENT_BLOCK = 765;
const SCID = "118x2x1"; // Bob → Charlie channel

const fmt = (n: number) => n.toLocaleString();

// ── Beat definitions ──────────────────────────────────────────────────────

const BEATS: Beat[] = [
  {
    step: 1,
    iterLabel: "HTLC arrives",
    subLabel: "RECEIVE",
    title: "Nothing trusted yet",
    caption:
      "Bob's upstream peer sends an `update_add_htlc`: an incoming HTLC plus 1,366 bytes of onion. The HTLC up top carries the `payment_hash` (this is the `associated_data`), the incoming amount, and the incoming `cltv_expiry`. Bob hasn't trusted a single byte of the onion yet. Earning that trust is the whole job of this chapter.",
  },
  {
    step: 2,
    iterLabel: "Bob validates",
    subLabel: "GATE 1 · STRUCTURE",
    title: "Structure OK",
    caption:
      "Before any crypto, the cheapest gate. Is the packet exactly 1,366 bytes, and is the version byte `0x00`? If either is wrong, Bob rejects immediately. Cheap, defensive checks go first so malformed packets cost almost nothing. Hover *rejects?* for the failure code, or *see fields* to expand the full packet anatomy from chapter 7.",
  },
  {
    step: 3,
    iterLabel: "Bob validates",
    subLabel: "GATE 2 · INTEGRITY",
    title: "Bytes are authentic",
    caption:
      "The integrity gate, and it runs *before* any decryption. Bob recomputes `HMAC(mu_B, hop_payloads ‖ associated_data)` over the still-encrypted bytes and compares it to the packet's `outer_hmac`. A match means the bytes are authentic and bound to this exact HTLC (that `payment_hash` highlighted in the strip is the `associated_data`). A mismatch means tampering or a re-attached onion, so Bob rejects and never lets those bytes reach his parser. The `mu_B` key was derived back in chapter 9; hover *keys* for the reminder.",
  },
  {
    step: 4,
    iterLabel: "Bob validates",
    subLabel: "PEEL",
    title: "Layer decrypted",
    caption:
      "Integrity confirmed, so Bob can finally decrypt. He XORs the buffer with his `rho_B` keystream to strip his layer, exposing his hop payload at the front. This is the chapter-9 peel (the 2,600-byte extend-and-XOR); we keep it to a single annotation here to stay on the decisions around it. Hover *keys* for where `rho_B` comes from.",
  },
  {
    step: 5,
    iterLabel: "Bob validates",
    subLabel: "PARSE",
    title: "Fields parsed",
    caption:
      "Bob's hop payload is plaintext now. A provided helper, `parse_tlv_records`, walks the bigsize-prefixed TLV records and hands back `amt_to_forward`, `outgoing_cltv_value`, and `short_channel_id`. The 32 bytes right after the TLVs are `charlie_hmac`, the tag Bob will carry onto the packet he forwards.",
  },
  {
    step: 6,
    iterLabel: "Bob validates",
    subLabel: "BRANCH",
    title: "Bob is a forwarder",
    caption:
      "Which role is Bob playing? `short_channel_id` present means Bob is a *forwarder* and should send the onion onward, which is Bob's path here. `payment_data` present with no `short_channel_id` would make Bob the *destination*. Hover the branch question to see why both present, or neither, is rejected as malformed.",
  },
  {
    step: 7,
    iterLabel: "Bob validates",
    subLabel: "CHECK",
    title: "Fees & timelocks OK",
    caption:
      "Bob is forwarding, so he holds the TLV's numbers up against the incoming HTLC (its amount and `cltv_expiry` are highlighted in the strip). Does the incoming amount cover `amt_to_forward` plus his fee? Does the incoming `cltv_expiry` clear `outgoing_cltv_value` by at least his published delta? Is the outgoing CLTV still in the future? These are the very fees and timelocks Alice solved backward in chapter 2. Hover *rejects?* on a row for its failure code.",
  },
  {
    step: 8,
    iterLabel: "Bob decides",
    subLabel: "OUTCOME",
    title: "Forward it",
    caption:
      "Everything checks out, so `process` returns one of three outcomes. `ForwardInstruction` (Bob's case here): ship `next_packet` to the `short_channel_id`. `FinalDelivery`: Bob is the destination, so settle by revealing the preimage. `Rejection`: something failed, so build an error onion with `um` (chapter 11). Every outcome carries `ss`, because the error path always needs it.",
  },
];

// ── Region helpers (Bob's view: hop_payloads is opaque until peeled) ───────

const OPAQUE_HATCH: ForwarderId[] = ["dave"]; // neutral 0° stripe = "still encrypted"

function encryptedBlob1300(focus = false): Region[] {
  return [
    {
      key: "encrypted-blob",
      widthPct: 100,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
      isFocus: focus,
    },
  ];
}

function strippedRegions1300(): Region[] {
  return [
    {
      key: "bob-hop-payload",
      widthPct: 26,
      kind: "slot",
      hop: "bob",
      layers: [],
      isFocus: true,
    },
    {
      key: "opaque-rest",
      widthPct: 74,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
    },
  ];
}

// ── Main component ────────────────────────────────────────────────────────

export function ValidationFlowDiagram() {
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), BEAT_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_BEATS) setStep(1);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(1);
    setPlaying(false);
  };

  const beat = BEATS[step - 1];
  // Bob's-view decision loop: the framing beat (RECEIVE, nothing trusted yet)
  // stays gold; every beat where Bob acts on the packet takes his blue accent.
  const beatAccent = step === 1 ? FOCUS_GOLD : HOP_STROKE.bob;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-validation-flow"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          The forwarder validation loop (Bob's view)
        </span>
      </div>

      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 500 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 700, maxWidth: 860 }}>
            <BeatBody step={step} />

            <StepCaption
              label={`${beat.iterLabel} · ${beat.subLabel}`}
              title={beat.title}
              caption={beat.caption}
              accentColor={beatAccent}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            >
              {playing ? "❚❚ Pause" : step >= TOTAL_BEATS ? "↻ Replay" : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1 flex-wrap">
              {Array.from({ length: TOTAL_BEATS }, (_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setPlaying(false);
                      setStep(n);
                    }}
                    className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                    style={{
                      background: step === n ? "#b8860b" : "#fffdf5",
                      borderColor: step === n ? "#b8860b" : "rgba(15,23,42,0.4)",
                      color: step === n ? "#fff" : INK,
                      fontFamily: MONO,
                      cursor: "pointer",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Beat body ───────────────────────────────────────────────────────────────
//
// Scaffolding that is present on EVERY beat (the persistent HTLC strip) renders
// OUTSIDE the per-beat conditional so it never remounts — it just retints which
// segment it highlights as the step changes. Below it sits exactly one focal
// element per beat.
//
// Morph mechanism, per onion-routing-visual-standards §14:
//   • The hop_payloads bar recurs across beats 3→4→5 (encrypted blob → stripped
//     → zoomed). PayloadArcView renders ONE persistent MorphBox for those three
//     beats (stable key="hop-payloads-bar"), so the box reconciles and morphs
//     its height/border across the step change while its inner representation
//     swaps. The supporting framing around the bar crossfades.
//   • Every other beat (1, 2, 6, 7, 8) is genuinely different content, so the
//     focal area crossfades through CrossfadeSwap keyed on `step` rather than
//     hard-cutting.
//
// The arc view and the crossfade panel are mutually exclusive (different
// component types by position), so the 2→3 and 5→6 boundaries are honest
// crossfades between genuinely-different representations. The HTLC strip above
// them is the only thing that carries across all eight.

function BeatBody({ step }: { step: number }) {
  const inPayloadArc = step >= 3 && step <= 5;

  return (
    <div className="mt-2">
      {/* Persistent context backdrop — same element on all 8 beats. */}
      <HtlcStrip key="htlc-strip" step={step} />

      {inPayloadArc ? (
        <PayloadArcView step={step} />
      ) : (
        <CrossfadeSwap swapKey={step}>
          <NonArcBeat step={step} />
        </CrossfadeSwap>
      )}
    </div>
  );
}

function NonArcBeat({ step }: { step: number }) {
  if (step === 1) return <ReceiveView />;
  if (step === 2) return <StructureGateView />;
  if (step === 6) return <BranchView />;
  if (step === 7) return <CheckView />;
  if (step === 8) return <OutcomeView />;
  return null;
}

// ── Persistent HTLC context strip (present on ALL 8 beats) ────────────────────
//
// A thin one-line bar pinned at the top of the stage. It is the reference
// backdrop the validation gates check against, NOT a focal card, so it stays
// visually quiet (small text, one line, a thin border). Two segments light up
// contextually: the payment_hash (= associated_data) on the integrity beat, and
// the amount + cltv on the fee/timelock beat. Reuses the same HTLC constants the
// old HtlcCard did.

type HtlcSegmentKey = "payment_hash" | "amount" | "cltv";

function HtlcStrip({ step }: { step: number }) {
  // Which segments are highlighted on this beat.
  const highlight: Partial<Record<HtlcSegmentKey, boolean>> =
    step === 3
      ? { payment_hash: true }
      : step === 7
        ? { amount: true, cltv: true }
        : {};

  return (
    <div
      className="mb-4 flex items-center gap-1 overflow-x-auto border-[1.5px]"
      style={{
        borderColor: `${HOP_STROKE.bob}66`,
        background: `${HOP_STROKE.bob}0c`,
        padding: "5px 8px",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.08em] font-bold shrink-0"
        style={{ fontFamily: MONO, color: HOP_STROKE.bob }}
      >
        ↘ inbound HTLC
      </span>
      <StripDot />
      <HtlcSegment
        label="amount"
        value={`${fmt(AMOUNT_IN_MSAT)} msat`}
        active={highlight.amount}
      />
      <StripDot />
      <HtlcSegment label="cltv" value={`${fmt(CLTV_IN)}`} active={highlight.cltv} />
      <StripDot />
      <HtlcSegment
        label="payment_hash"
        value={PAYMENT_HASH}
        note="= associated_data"
        active={highlight.payment_hash}
      />
    </div>
  );
}

function StripDot() {
  return (
    <span
      className="shrink-0"
      style={{ color: `${HOP_STROKE.bob}80`, fontSize: 11, padding: "0 1px" }}
    >
      ·
    </span>
  );
}

function HtlcSegment({
  label,
  value,
  note,
  active,
}: {
  label: string;
  value: string;
  note?: string;
  active?: boolean;
}) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 shrink-0 whitespace-nowrap"
      style={{
        fontFamily: MONO,
        fontSize: 11,
        padding: active ? "1px 6px" : "1px 0",
        background: active ? "#fef3c7" : "transparent",
        borderRadius: active ? 2 : 0,
        boxShadow: active ? `inset 0 0 0 1.5px ${FOCUS_GOLD}` : "none",
        transition: "background 300ms ease-out, box-shadow 300ms ease-out",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.04em]"
        style={{ color: active ? FOCUS_GOLD : NEUTRAL_TEXT, fontWeight: 700 }}
      >
        {label}
      </span>
      <span style={{ color: INK, fontWeight: 700 }}>{value}</span>
      {note && (
        <span
          className="text-[9px] italic"
          style={{ fontFamily: SANS, color: active ? FOCUS_GOLD : ASSOC_DATA_COLOR }}
        >
          {note}
        </span>
      )}
    </span>
  );
}

// ── Beats 3-5: the persistent hop_payloads bar ───────────────────────────────
//
// The bar's headline state per beat:
//   3 (VERIFY): fully-encrypted 1,300-byte blob (the HMAC input)
//   4 (PEEL):   Bob's layer stripped (the XOR result; the equation that
//               produced it crossfades in above)
//   5 (PARSE):  zoomed into Bob's 60-byte hop payload (LEN | TLV | HMAC)
//
// All three render THIS component, so the MorphBox is the same React element
// across the step change and animates its own box (height + border). Its region
// children swap directly (same direct-children pattern as WrapMorphView's bar),
// while the framing above and below the bar crossfades via CrossfadeSwap.

function PayloadArcView({ step }: { step: number }) {
  const isVerify = step === 3;
  const isPeel = step === 4;
  const isParse = step === 5;

  // The persistent bar grows when we zoom into the 60-byte payload at beat 5.
  const barHeight = isParse ? 72 : 46;
  const barBorder = isParse ? FOCUS_GOLD : isPeel ? HOP_STROKE.bob : NEUTRAL_TEXT;
  const barShadow = isParse
    ? `0 0 0 2px rgba(184,134,11,0.22)`
    : isPeel
      ? `0 0 0 2px rgba(184,134,11,0.18)`
      : "none";

  // Caption directly above the persistent bar (its label changes per beat).
  const barLabel = isVerify
    ? "hop_payloads · 1,300 B (still encrypted)"
    : isPeel
      ? "hop_payloads · after XOR (Bob's layer stripped)"
      : "bob's hop payload · 60 bytes (now plaintext)";

  return (
    <div className="mt-2">
      {/* Lead-in above the bar, crossfades per beat. */}
      <CrossfadeSwap swapKey={`arc-lead-${step}`}>
        <ArcLeadIn step={step} />
      </CrossfadeSwap>

      {/* Persistent label for the bar. */}
      <div
        className="text-[10px] uppercase tracking-[0.06em] mb-1 mt-1"
        style={{
          color: isParse ? FOCUS_GOLD : isPeel ? HOP_STROKE.bob : NEUTRAL_TEXT,
          fontFamily: MONO,
          fontWeight: isVerify ? 500 : 700,
        }}
      >
        {isParse ? (
          <div className="flex items-center justify-between">
            <span>{barLabel}</span>
            <span style={{ fontWeight: 500 }}>zoomed view</span>
          </div>
        ) : (
          barLabel
        )}
      </div>

      {/* THE persistent bar: same element in beats 3, 4, 5; the box (height +
          border) morphs while its region children swap. Same direct-children
          pattern as WrapMorphView's persistent bar. */}
      <MorphBox
        key="hop-payloads-bar"
        initial={{ height: barHeight, borderColor: barBorder }}
        animate={{ height: barHeight, borderColor: barBorder }}
        className="border-[1.5px] flex relative overflow-hidden"
        style={{ background: "#fffdf5", boxShadow: barShadow }}
      >
        {isParse ? (
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <SlotCell hop="bob" />
          </div>
        ) : (
          (isPeel ? strippedRegions1300() : encryptedBlob1300()).map((r) => (
            <BufferRegion key={r.key} region={r} dimNonFocus={false} />
          ))
        )}
      </MorphBox>

      {/* Trailing content below the bar, crossfades per beat. */}
      <CrossfadeSwap swapKey={`arc-tail-${step}`}>
        <ArcTail step={step} />
      </CrossfadeSwap>
    </div>
  );
}

// Content above the persistent bar. Each beat sets up the bar's headline state.
// Per §7 (key disclosure), beats 3 + 4 only USE keys derived back in chapter 9,
// so they show the compact KeyHoverIcon badge (top-right of the operation), not
// the full KeyDerivationCard.
function ArcLeadIn({ step }: { step: number }) {
  if (step === 3) {
    // Integrity: the mu_B key drives this HMAC. Badge top-right, mu_B active.
    return (
      <div className="flex justify-end">
        <KeyHoverIcon {...keyDerivationProps(true)} />
      </div>
    );
  }

  if (step === 4) {
    // Peel: the rho_B key drives the XOR. Badge top-right, rho_B active.
    return (
      <div className="flex justify-end">
        <KeyHoverIcon {...keyDerivationProps(false)} />
      </div>
    );
  }

  // Beat 5: no lead-in; the persistent bar's own label carries the framing.
  return null;
}

// Content below the persistent bar (what each beat does next).
function ArcTail({ step }: { step: number }) {
  // Beat 3 (integrity): the HMAC compare distilled to one line + a verdict
  // stamp. associated_data is folded into the persistent HTLC strip above (its
  // payment_hash segment is highlighted on this beat), so there's no separate
  // AD bar or `‖` row to stack here.
  if (step === 3) {
    return (
      <div className="mt-3">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <MathLine
            text="HMAC(mu_B, hop_payloads ‖ associated_data)"
            color={KEY_MU_COLOR}
            fontSize={14}
          />
          <span style={{ color: NEUTRAL_TEXT, fontSize: 18, fontWeight: 700 }}>≟</span>
          <MathLine text="outer_hmac" color={NEUTRAL_TEXT} fontSize={13} />
        </div>
        <VerdictStamp
          label="AUTHENTIC"
          sub="bytes match, bound to this HTLC"
          failCode="invalid_onion_hmac"
        />
      </div>
    );
  }

  // Beat 4 (peel): a single compact annotation on the morph. The byte-level XOR
  // mechanics live in chapter 9.
  if (step === 4) {
    return (
      <div className="mt-2 flex items-center justify-center gap-2">
        <span style={{ fontSize: 15, color: KEY_RHO_COLOR, fontWeight: 700 }}>⊕</span>
        <MathLine text="rho_B" color={KEY_RHO_COLOR} fontSize={12} />
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ color: KEY_RHO_COLOR, fontFamily: MONO, fontWeight: 700 }}
        >
          keystream (ch 9)
        </span>
      </div>
    );
  }

  // Beat 5: parse → TLV chips. (Byte axis dropped to keep the parse beat clean.)
  return (
    <div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <MathLine text="parse_tlv_records(payload)" color={INK} fontSize={12} />
        <span style={{ color: NEUTRAL_TEXT }}>→</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <FieldChip type="2" name="amt_to_forward" value={`${fmt(AMT_FORWARD_MSAT)} msat`} />
        <FieldChip type="4" name="outgoing_cltv_value" value={`${fmt(OUTGOING_CLTV)}`} />
        <FieldChip type="6" name="short_channel_id" value={SCID} accent={HOP_STROKE.charlie} />
      </div>
    </div>
  );
}

// ── Shared mini-pieces ────────────────────────────────────────────────────

// A small, quiet "rejects?" affordance. By default the beat shows only the green
// success verdict; hovering this reveals the failure code that fires on the
// no-path, via the shared viewport-clamped Tooltip. Used by VerdictStamp (gates)
// and CheckRow (policy checks).
function RejectsHover({ failCode }: { failCode: string }) {
  return (
    <Tooltip
      width={240}
      label={
        <span>
          If this check fails, Bob rejects with{" "}
          <span style={{ fontFamily: MONO, color: ERROR_RED, fontWeight: 700 }}>
            {failCode}
          </span>
          .
        </span>
      }
    >
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.06em]"
        style={{
          fontFamily: MONO,
          color: NEUTRAL_TEXT,
          borderBottom: `1px dotted ${NEUTRAL_TEXT}`,
          cursor: "help",
          fontWeight: 700,
        }}
      >
        <span style={{ color: ERROR_RED }}>✗</span> rejects?
      </span>
    </Tooltip>
  );
}

// Green success stamp for a passed gate. The failure code is tucked into a
// RejectsHover beside it (default state shows only the verdict).
function VerdictStamp({
  label,
  sub,
  failCode,
}: {
  label: string;
  sub: string;
  failCode: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 mt-3">
      <div
        className="inline-flex items-center gap-2 border-[1.5px] px-3 py-1.5"
        style={{
          background: "#e7f6ee",
          borderColor: VERIFY_GREEN,
          color: VERIFY_GREEN,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>✓</span>
        <span
          className="text-xs font-bold uppercase tracking-[0.05em]"
          style={{ fontFamily: MONO }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span
          className="text-[10.5px] italic"
          style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
        >
          {sub}
        </span>
        <RejectsHover failCode={failCode} />
      </div>
    </div>
  );
}

// ── Beat 1: Receive ───────────────────────────────────────────────────────
//
// Focal: the single sealed 1,366-byte packet. The incoming HTLC is carried by
// the persistent strip above, so there's no separate HTLC card and no "+" glyph
// joining them here.

function ReceiveView() {
  return (
    <div className="space-y-4 mt-1">
      <div>
        <BufferHeader
          leftLabel="onion_routing_packet"
          rightLabel={
            <Tooltip
              width={280}
              label={
                <span>
                  Fixed 1,366-byte Sphinx wire format. Same size at every hop, so
                  an observer can't tell where Bob sits in the route.
                </span>
              }
            >
              <span style={{ borderBottom: "1px dotted #94a3b8", cursor: "help" }}>
                {fmt(FULL_PACKET_BYTES)} bytes
              </span>
            </Tooltip>
          }
          accentColor={FOCUS_GOLD}
        />
        <div
          className="border-[1.5px] flex items-center justify-center relative overflow-hidden"
          style={{ background: "#fffdf5", borderColor: FOCUS_GOLD, height: 84 }}
        >
          <HatchOverlay hops={OPAQUE_HATCH} zIndex={1} stripeOpacity={0.16} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              color: INK,
              background: "rgba(255,253,245,0.92)",
              padding: "6px 14px",
              letterSpacing: "0.04em",
              fontWeight: 700,
              zIndex: 2,
              position: "relative",
            }}
          >
            1,366 encrypted bytes. Bob can't read any of it yet
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Beat 2: Structure gate ────────────────────────────────────────────────
//
// Focal: a compact 2-item checklist → a green STRUCTURE OK stamp. The full
// four-field packet anatomy (a chapter-7 re-teach) is tucked behind a "see
// fields" hover, and the failure code lives in the stamp's "rejects?" hover.

function StructureGateView() {
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: FOCUS_GOLD }}
        >
          two cheap checks, before any crypto
        </span>
        <SeeFieldsHover />
      </div>
      <div className="mx-auto" style={{ maxWidth: 360 }}>
        <ChecklistRow
          label="length"
          value={`${fmt(FULL_PACKET_BYTES)} B`}
          detail="exactly 1,366 bytes"
        />
        <ChecklistRow
          label="version"
          value="0x00"
          detail="known onion version"
        />
      </div>
      <VerdictStamp
        label="STRUCTURE OK"
        sub="shape is well-formed"
        failCode="invalid_onion_version"
      />
    </div>
  );
}

function ChecklistRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="flex items-center gap-2 border-[1.5px] px-3 py-1.5 mb-1.5"
      style={{ borderColor: VERIFY_GREEN, background: "#fffdf5" }}
    >
      <span
        className="shrink-0"
        style={{ color: VERIFY_GREEN, fontSize: 14, fontWeight: 700 }}
      >
        ☑
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.06em] font-bold"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT, minWidth: 56 }}
      >
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: INK }}>
        = {value}
      </span>
      <span
        className="text-[10px] italic ml-auto"
        style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
      >
        {detail}
      </span>
    </div>
  );
}

// "See fields" affordance — reveals the four fixed-size fields (the ch-7 packet
// anatomy) on hover, so the structural beat itself stays a 2-line checklist.
function SeeFieldsHover() {
  return (
    <Tooltip
      width={320}
      label={
        <div>
          <div
            className="text-[9px] uppercase tracking-[0.06em] mb-1.5 font-bold"
            style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
          >
            the 1,366 bytes, four fixed-size fields
          </div>
          <AnatomyLine name="version" bytes="1 B" value="0x00" />
          <AnatomyLine
            name="ephemeral pubkey"
            bytes="33 B"
            value="E_AB"
            accent={HOP_STROKE.bob}
          />
          <AnatomyLine name="hop_payloads" bytes="1,300 B" value="encrypted" />
          <AnatomyLine name="outer_hmac" bytes="32 B" value="hmac" />
        </div>
      }
    >
      <span
        className="text-[10px] uppercase tracking-[0.06em]"
        style={{
          fontFamily: MONO,
          color: NEUTRAL_TEXT,
          borderBottom: `1px dotted ${NEUTRAL_TEXT}`,
          cursor: "help",
          fontWeight: 700,
        }}
      >
        see fields
      </span>
    </Tooltip>
  );
}

function AnatomyLine({
  name,
  bytes,
  value,
  accent,
}: {
  name: string;
  bytes: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5" style={{ fontFamily: MONO }}>
      <span
        className="text-[10px] font-bold"
        style={{ color: accent ?? INK, minWidth: 110 }}
      >
        {name}
      </span>
      <span className="text-[10px]" style={{ color: NEUTRAL_TEXT }}>
        {bytes}
      </span>
      <span className="text-[10px] ml-auto" style={{ color: accent ?? INK }}>
        {value}
      </span>
    </div>
  );
}

// ── Beats 3-5 TLV chips (used by the PayloadArcView parse tail) ────────────

function FieldChip({
  type,
  name,
  value,
  accent,
}: {
  type: string;
  name: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="border-[1.5px] flex flex-col items-center text-center px-2 py-2"
      style={{ borderColor: accent ?? INK, background: "#fffdf5" }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.05em] font-bold"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        type {type}
      </span>
      <span
        className="font-bold mt-0.5"
        style={{ fontFamily: MONO, fontSize: 11, color: accent ?? INK }}
      >
        {name}
      </span>
      <span className="text-[11px] mt-0.5" style={{ fontFamily: MONO, color: INK }}>
        {value}
      </span>
    </div>
  );
}

// ── Beat 6: Forward vs destination branch ─────────────────────────────────
//
// Focal: the fork resolved, with only the FORWARDER card lit. The destination
// arm shrinks to a single quiet line, and the malformed-case rule moves to a
// hover on the branch question.

function BranchView() {
  return (
    <div className="my-2 mt-1">
      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        <MathLine text="short_channel_id present?" color={INK} fontSize={14} />
        <Tooltip
          width={260}
          label={
            <span>
              Exactly one of{" "}
              <span style={{ fontFamily: MONO }}>short_channel_id</span> or{" "}
              <span style={{ fontFamily: MONO }}>payment_data</span> must be
              present. Both, or neither, is malformed and Bob rejects it.
            </span>
          }
        >
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{
              fontFamily: MONO,
              color: NEUTRAL_TEXT,
              borderBottom: `1px dotted ${NEUTRAL_TEXT}`,
              cursor: "help",
              fontWeight: 700,
            }}
          >
            both or neither?
          </span>
        </Tooltip>
      </div>

      {/* The lit forwarder arm — Bob's path. */}
      <ForwarderArm />

      {/* The other arm, reduced to one quiet line. */}
      <div
        className="text-center mt-3 text-[11px] italic"
        style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}
      >
        Not Bob's case:{" "}
        <span style={{ fontFamily: MONO, fontStyle: "normal" }}>
          payment_data
        </span>{" "}
        present with no{" "}
        <span style={{ fontFamily: MONO, fontStyle: "normal" }}>
          short_channel_id
        </span>{" "}
        would make him the destination.
      </div>
    </div>
  );
}

function ForwarderArm() {
  const accent = HOP_STROKE.bob;
  return (
    <div
      className="border-[1.5px] overflow-hidden mx-auto"
      style={{
        borderColor: FOCUS_GOLD,
        background: "#fffdf5",
        boxShadow: `0 0 0 2px rgba(184,134,11,0.2)`,
        maxWidth: 420,
      }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: `${accent}18`, borderBottom: `1.5px solid ${accent}40` }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: accent }}
        >
          FORWARDER
        </span>
        <span className="text-[11px] font-bold" style={{ color: FOCUS_GOLD }}>
          ◄ Bob
        </span>
      </div>
      <div className="px-3 py-2">
        <div
          className="text-[10px] mb-1.5 inline-block px-1.5 py-0.5"
          style={{ fontFamily: MONO, color: accent, background: `${accent}12` }}
        >
          short_channel_id present
        </div>
        <div className="text-xs leading-snug" style={{ color: INK, fontFamily: SANS }}>
          Bob is an intermediate hop. Send the rebuilt onion onward to channel{" "}
          <span style={{ fontFamily: MONO }}>{SCID}</span>.
        </div>
      </div>
    </div>
  );
}

// ── Beat 7: Fee + CLTV checks ─────────────────────────────────────────────

function CheckView() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <CheckRow
          pass
          label="Incoming amount covers forward + fee"
          formula={`${fmt(AMOUNT_IN_MSAT)} ≥ ${fmt(AMT_FORWARD_MSAT)} + ${fmt(FEE_REQUIRED_MSAT)}`}
          note={`Bob keeps ${fmt(FEE_MARGIN_MSAT)} msat (≥ his ${fmt(FEE_REQUIRED_MSAT)} fee)`}
          failCode="fee_insufficient"
        />
        <CheckRow
          pass
          label="Incoming CLTV clears outgoing by ≥ delta"
          formula={`${fmt(CLTV_IN)} − ${fmt(OUTGOING_CLTV)} = ${CLTV_MARGIN} ≥ ${CLTV_DELTA}`}
          note="enough cushion to claim on-chain if downstream stalls (ch 2)"
          failCode="incorrect_cltv_expiry"
        />
        <CheckRow
          pass
          label="Outgoing CLTV is still in the future"
          formula={`${fmt(OUTGOING_CLTV)} > ${fmt(CURRENT_BLOCK)} (current block)`}
          note="downstream hops need time to settle"
          failCode="expiry_too_soon"
        />
      </div>
    </div>
  );
}

// Each policy check is three parts: the green check mark, the label + formula +
// note, and a quiet "rejects?" hover carrying the failure code. Moving the code
// to hover keeps the row from wrapping and shows only the passing verdict.
function CheckRow({
  pass,
  label,
  formula,
  note,
  failCode,
}: {
  pass: boolean;
  label: string;
  formula: string;
  note: string;
  failCode: string;
}) {
  return (
    <div
      className="border-[1.5px] flex items-stretch overflow-hidden"
      style={{ borderColor: pass ? VERIFY_GREEN : ERROR_RED, background: "#fffdf5" }}
    >
      <div
        className="flex items-center justify-center px-3"
        style={{ background: pass ? "#e7f6ee" : "#fde7e7", color: pass ? VERIFY_GREEN : ERROR_RED, fontSize: 16, fontWeight: 700 }}
      >
        {pass ? "✓" : "✗"}
      </div>
      <div className="flex-1 px-3 py-2 min-w-0">
        <div className="text-xs font-bold" style={{ color: INK, fontFamily: SANS }}>
          {label}
        </div>
        <div className="mt-0.5">
          <MathLine text={formula} color={pass ? VERIFY_GREEN : ERROR_RED} fontSize={12} />
        </div>
        <div className="text-[10.5px] mt-0.5 italic" style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}>
          {note}
        </div>
      </div>
      <div className="flex items-center px-3 shrink-0">
        <RejectsHover failCode={failCode} />
      </div>
    </div>
  );
}

// ── Beat 8: Outcome trichotomy ────────────────────────────────────────────

function OutcomeView() {
  return (
    <div className="my-2">
      <div className="text-center mb-3">
        <MathLine text="process(packet, htlc, node_privkey)" color={INK} fontSize={13} />
        <span style={{ color: NEUTRAL_TEXT, margin: "0 8px" }}>returns one of</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <OutcomeCard
          active
          title="ForwardInstruction"
          accent={HOP_STROKE.bob}
          tag="Bob's case"
          fields={["next_packet", `scid = ${SCID}`, `amt = ${fmt(AMT_FORWARD_MSAT)}`, `cltv = ${fmt(OUTGOING_CLTV)}`, "ss"]}
          foot="Send next_packet to the channel."
        />
        <OutcomeCard
          title="FinalDelivery"
          accent={HOP_STROKE.dave}
          fields={["amt_to_forward", "outgoing_cltv", "payment_data", "ss"]}
          foot="Destination: settle by revealing the preimage."
        />
        <OutcomeCard
          title="Rejection"
          accent={ERROR_RED}
          fields={["failure_code", "ss"]}
          foot="Build an error onion with um (chapter 11)."
        />
      </div>
      <div
        className="text-center mt-3 text-[11px] italic"
        style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}
      >
        Every outcome carries the shared secret{" "}
        <span style={{ fontFamily: MONO, fontStyle: "normal", color: ASSOC_DATA_COLOR }}>
          ss
        </span>{" "}
        (hover it for why).
      </div>
    </div>
  );
}

function OutcomeCard({
  active,
  title,
  accent,
  tag,
  fields,
  foot,
}: {
  active?: boolean;
  title: string;
  accent: string;
  tag?: string;
  fields: string[];
  foot: string;
}) {
  return (
    <div
      className="border-[1.5px] overflow-hidden flex flex-col"
      style={{
        borderColor: active ? FOCUS_GOLD : "rgba(15,23,42,0.3)",
        background: active ? "#fffdf5" : "#fbfbf8",
        boxShadow: active ? `0 0 0 2px rgba(184,134,11,0.2)` : "none",
        opacity: active ? 1 : 0.78,
      }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: `${accent}18`, borderBottom: `1.5px solid ${accent}40` }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.04em] font-bold"
          style={{ fontFamily: MONO, color: accent }}
        >
          {title}
        </span>
        {tag && (
          <span className="text-[9px] font-bold uppercase" style={{ color: FOCUS_GOLD }}>
            {tag}
          </span>
        )}
      </div>
      <div className="px-3 py-2 flex-1">
        <div className="flex flex-wrap gap-1">
          {fields.map((f) =>
            f === "ss" ? (
              <Tooltip
                key={f}
                width={250}
                label={
                  <span>
                    The shared secret. The error path always needs it, whether to
                    wrap a fresh error here or relay one from downstream (chapter
                    11).
                  </span>
                }
              >
                <span
                  className="text-[10px] px-1.5 py-0.5 border"
                  style={{
                    fontFamily: MONO,
                    color: ASSOC_DATA_COLOR,
                    borderColor: ASSOC_DATA_COLOR,
                    background: `${ASSOC_DATA_COLOR}10`,
                    borderBottom: `1px dotted ${ASSOC_DATA_COLOR}`,
                    cursor: "help",
                  }}
                >
                  {f}
                </span>
              </Tooltip>
            ) : (
              <span
                key={f}
                className="text-[10px] px-1.5 py-0.5 border"
                style={{
                  fontFamily: MONO,
                  color: INK,
                  borderColor: "rgba(15,23,42,0.2)",
                  background: "#fff",
                }}
              >
                {f}
              </span>
            )
          )}
        </div>
      </div>
      <div
        className="px-3 py-1.5 text-[10.5px] italic"
        style={{ color: NEUTRAL_TEXT, fontFamily: SANS, borderTop: "1px solid rgba(15,23,42,0.1)" }}
      >
        {foot}
      </div>
    </div>
  );
}

// ── Key derivation props (mu_B + rho_B from ss_AB) ────────────────────────

function keyDerivationProps(muActive: boolean) {
  const rows: KeyDerivationRow[] = [
    {
      formula: "HMAC('mu', ss_AB)",
      keyName: "mu_B",
      bytes: "32 bytes",
      useTitle: "HMAC key",
      useSubtitle: "verifies the integrity gate",
      color: KEY_MU_COLOR,
      active: muActive,
    },
    {
      formula: "HMAC('rho', ss_AB)",
      keyName: "rho_B",
      bytes: "32 bytes",
      useTitle: "Stream cipher key",
      useSubtitle: "peels the layer (the XOR)",
      color: KEY_RHO_COLOR,
      active: !muActive,
    },
  ];

  return {
    title: "Bob derives his keys from ss_AB",
    source: {
      name: "ss_AB",
      subtitle: "32-byte shared secret",
      accent: HOP_STROKE.bob,
    },
    rows,
    upstream: {
      inputA: { name: "bob_privkey", subtitle: "Bob's static node privkey" },
      inputB: { name: "E_AB", subtitle: "ephemeral from packet header" },
      formulaOverride: "SHA256(bob_privkey · E_AB)",
    },
  };
}

export default ValidationFlowDiagram;
