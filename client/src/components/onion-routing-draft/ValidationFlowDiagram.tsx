// ────────────────────────────────────────────────────────────────────────────
// ValidationFlowDiagram (refined 2026-06-07: context on the beats that use it)
//
// Animated, click-through "Forwarder Validation Loop" from Bob's view. Where
// PeelTraceDiagram (ch 9) traces the byte-mechanics of the peel, this visual
// foregrounds the DECISION layer that wraps around it: the ordering of the
// gates, the incoming-HTLC context, the forward-vs-destination branch, the
// fee/CLTV policy checks, and the three-way `process` outcome.
//
// Design rule (this refinement): ONE focal element per beat, and the incoming
// HTLC context appears ONLY on the beats that reason about it: inside the
// step-1 `update_add_htlc` envelope, beside the integrity HMAC as the
// `associated_data` (beat 3), and beside the policy checks as the incoming
// amount + cltv (beat 7). There is no persistent context strip. Everything
// else secondary (full packet anatomy, failure codes, key provenance) lives
// behind a hover; default state shows only the green success verdict.
//
// Beats:
//   1. RECEIVE   : update_add_htlc carries the onion, zoom to the sealed packet
//   2. GATE 1    : structural checklist (1,366 B? version 0x00?) -> STRUCTURE OK
//   3. GATE 2    : verify HMAC(mu_B, hop_payloads ‖ AD) BEFORE decrypting
//   4. PEEL      : only now, XOR with rho_B to expose the hop payload (compact)
//   5. PARSE     : the payload's TLV region fans out into the parsed fields
//   6. BRANCH    : forwarder (scid) vs destination (payment_data)
//   7. CHECK     : fees + timelocks against the incoming amount + cltv
//   8. OUTCOME   : ForwardInstruction / FinalDelivery / Rejection
//
// Reuses the shared trace primitives exported from WrapTraceDiagram plus
// KeyDerivationCard / KeyHoverIcon (key-disclosure pattern), HatchOverlay,
// MathLine, the viewport-clamped Tooltip, and StepCaption for the per-beat
// explanation block below the visual (§1.5). Locked onion-routing visual
// format spec.
// ────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from "react";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";
import { KeyHoverIcon, type KeyDerivationRow } from "./KeyDerivationCard";
import { MathLine } from "./mathTokens";
import { MorphBox } from "./morph";
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
      "Bob's upstream peer sends him an `update_add_htlc`. The channel message carries the incoming HTLC fields (the amount, the `cltv_expiry`, and the `payment_hash`, which is the `associated_data`) and, tucked inside it, the 1,366-byte onion. Zoom into that onion and what do you get? Just encrypted bytes. Bob can't read a single one of them yet, and earning the right to act on them is the whole job of this chapter.",
  },
  {
    step: 2,
    iterLabel: "Bob validates",
    subLabel: "GATE 1 · STRUCTURE",
    title: "Structure OK",
    caption:
      "First, the easy stuff. Is the packet exactly 1,366 bytes? Is the version byte `0x00`? If either answer is no, Bob rejects right away, no decryption needed. Why bother running crypto on a packet that isn't even *shaped* right? Hover *rejects?* for the failure code, or *see fields* to open up the full packet anatomy from chapter 7.",
  },
  {
    step: 3,
    iterLabel: "Bob validates",
    subLabel: "GATE 2 · INTEGRITY",
    title: "Bytes are authentic",
    caption:
      "Now, the integrity gate, and notice it runs *before* any decryption. Bob recomputes `HMAC(mu_B, hop_payloads ‖ associated_data)` over the still-encrypted bytes and checks it against the packet's `outer_hmac`. A match? The bytes are authentic and bound to this exact HTLC (the `payment_hash` beside the HMAC is that `associated_data`). A mismatch means tampering or a re-attached onion, so Bob rejects and never lets those bytes near his parser. He derived `mu_B` back in chapter 9, so hover *keys* for the reminder.",
  },
  {
    step: 4,
    iterLabel: "Bob validates",
    subLabel: "PEEL",
    title: "Layer decrypted",
    caption:
      "Integrity's confirmed, so now Bob can finally decrypt. He XORs the buffer with his `rho_B` keystream and his layer slides off, leaving his hop payload as plaintext at the front. This is the chapter-9 peel. The full version stretches the buffer to 2,600 bytes first, and what you see here is the front 1,300 bytes of that same XOR. Hover *keys* for where `rho_B` comes from.",
  },
  {
    step: 5,
    iterLabel: "Bob validates",
    subLabel: "PARSE",
    title: "Fields parsed",
    caption:
      "Bob's hop payload is plaintext now, so let's read his instructions. Here's that same 60-byte payload as raw data: the `1b` length prefix (bigsize for 27), the 27 bytes of TLV records, then the 32 HMAC bytes (we won't spell those out). Every record is just a type, a length, then that many bytes of value. Hover anything to decode it. The three routing records hand Bob his orders (`amt_to_forward`, `outgoing_cltv_value`, `short_channel_id`), and the trailing HMAC is `charlie_hmac`, the tag Bob carries onto the packet he forwards. (That dim record up front? Type 1 is `padding`. Hover it!)",
  },
  {
    step: 6,
    iterLabel: "Bob validates",
    subLabel: "BRANCH",
    title: "Bob is a forwarder",
    caption:
      "So, which role is Bob playing? A `short_channel_id` present means Bob is a *forwarder* and should send the onion onward, and that's his path here. A `payment_data` present with no `short_channel_id` would make Bob the *destination* instead. Hover the branch question to see why both, or neither, gets rejected as malformed.",
  },
  {
    step: 7,
    iterLabel: "Bob validates",
    subLabel: "CHECK",
    title: "Fees & timelocks OK",
    caption:
      "Bob's forwarding, so he holds the TLV's numbers up against the incoming HTLC (its amount and `cltv_expiry` sit beside the checks). Does the incoming amount cover `amt_to_forward` plus his fee? Does the incoming `cltv_expiry` clear `outgoing_cltv_value` by at least his published delta? And is the outgoing CLTV still in the future? These are the same fees and timelocks Alice worked out backward in chapter 2. Hover *rejects?* on a row for its failure code.",
  },
  {
    step: 8,
    iterLabel: "Bob decides",
    subLabel: "OUTCOME",
    title: "Forward it",
    caption:
      "Finally, every peel ends one of exactly three ways. Bob has a `short_channel_id` and every check passed, so his outcome is forward: ship the rebuilt packet out on channel `118x2x1` with the amount and timelock his TLVs ordered. Had `payment_data` been there instead, Bob would be the destination and would deliver (settle by revealing the preimage). And if anything had failed along the way? Reject: build an error onion and send it back upstream. We'll get to that in chapter 11.",
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

  const atFirst = step <= 1;
  const atLast = step >= TOTAL_BEATS;
  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(TOTAL_BEATS, s + 1));
  const reset = () => setStep(1);

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
        style={{ minHeight: 340 }}
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
              onClick={back}
              disabled={atFirst}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              ← Back
            </button>
            <button
              onClick={next}
              disabled={atLast}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              Next →
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
// There is no persistent context backdrop anymore: the incoming-HTLC context
// shows up ONLY on the beats that reason about it (inside the step-1 envelope,
// the integrity beat's associated_data chip, and the check beat's amount + cltv
// chip). Each beat shows exactly one focal element plus whatever context that
// specific beat needs.
//
// Morph mechanism, per onion-routing-visual-standards §14:
//   • The hop_payloads bar recurs across beats 3→4→5 (encrypted blob → stripped
//     → zoomed). PayloadArcView renders ONE persistent MorphBox for those three
//     beats (stable key="hop-payloads-bar"), so the box reconciles and morphs
//     its height/border across the step change while its inner representation
//     swaps. That continuity is the §14 morph this visual must keep.
//   • Every other beat (1, 2, 6, 7, 8) is genuinely different content shown ONE
//     AT A TIME via a plain conditional render keyed on `step`. We deliberately
//     do NOT wrap these in AnimatePresence: their subtrees contain portaled
//     Tooltips, and a popLayout/exit overlap left the step-1 `update_add_htlc`
//     envelope pinned past beat 1 (and mode="wait" then blocked the next beat
//     from mounting). A clean mount/unmount is correct and unambiguous: React
//     removes the outgoing beat immediately, so the envelope is gone the instant
//     we leave beat 1. The incoming beat fades itself in via FadeIn (a simple
//     mount-time opacity tween that has no exit phase, so it can't get stuck).
//
// The arc view and the non-arc panel are mutually exclusive (different component
// types by position), so the 2→3 and 5→6 boundaries cut between genuinely
// different representations.

function BeatBody({ step }: { step: number }) {
  const inPayloadArc = step >= 3 && step <= 5;

  return (
    <div className="mt-2">
      {inPayloadArc ? (
        <PayloadArcView step={step} />
      ) : (
        <FadeIn swapKey={step}>
          <NonArcBeat step={step} />
        </FadeIn>
      )}
    </div>
  );
}

// Mount-time fade for a non-arc beat. Re-keying on `swapKey` remounts the inner
// MorphBox so it replays its 0→1 opacity tween on each new beat. There is no
// exit phase (no AnimatePresence), so it cannot leave a stuck/lingering node.
// The previous beat is already unmounted by the plain conditional above.
function FadeIn({ swapKey, children }: { swapKey: string | number; children: React.ReactNode }) {
  return (
    <MorphBox
      key={swapKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
    >
      {children}
    </MorphBox>
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

// ── HTLC context chip (beats 1, 3, 7 only) ───────────────────────────────────
//
// A single small key=value pill carrying one incoming-HTLC field, used inline by
// the beats that reason about that field: the step-1 envelope (all three), the
// integrity beat (`payment_hash` = associated_data), and the check beat (amount
// + cltv). It is intentionally quiet (small MONO text, a thin Bob-blue frame),
// so it reads as context, not as the focal element. An optional `note` italicizes
// a short gloss after the value (used for "= associated_data").

function HtlcChip({
  label,
  value,
  note,
  accent = HOP_STROKE.bob,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
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
      <span style={{ color: INK, fontWeight: 700 }}>{value}</span>
      {note && (
        <span
          className="text-[9px] italic"
          style={{ fontFamily: SANS, color: ASSOC_DATA_COLOR }}
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
// while the framing above and below the bar fades in per beat via FadeIn. We use
// FadeIn (mount-time opacity, no exit phase) rather than a crossfade because the
// beat-3 tail contains a portaled Tooltip whose popLayout exit got stuck and
// pinned the beat-3 HMAC/verdict onto beat 4. A clean remount can't linger.

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
      {/* Lead-in above the bar, fades in per beat. */}
      <FadeIn swapKey={`arc-lead-${step}`}>
        <ArcLeadIn step={step} />
      </FadeIn>

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

      {/* Trailing content below the bar, fades in per beat. */}
      <FadeIn swapKey={`arc-tail-${step}`}>
        <ArcTail step={step} />
      </FadeIn>
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
        <KeyHoverIcon {...keyDerivationProps(true)} activeLabel="mu_B" />
      </div>
    );
  }

  if (step === 4) {
    // Peel: the full three-bar XOR (canonical §15 grammar, same as the
    // chapter-9 peel and the error-onion wraps). The persistent bar below is
    // the RESULT (it morphs from encrypted to stripped), so this lead-in
    // carries the BEFORE bar ⊕ the rho_B keystream bar =. The keystream is
    // honestly labeled as the front 1,300 B of the 2,600-byte ch-9 stream.
    return (
      <div>
        <div className="flex justify-end mb-1">
          <KeyHoverIcon {...keyDerivationProps(false)} activeLabel="rho_B" />
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.06em] mb-1"
          style={{ color: NEUTRAL_TEXT, fontFamily: MONO, fontWeight: 500 }}
        >
          hop_payloads · 1,300 B (as received · still encrypted)
        </div>
        <div
          className="border-[1.5px] flex relative overflow-hidden"
          style={{
            background: "#fffdf5",
            borderColor: NEUTRAL_TEXT,
            height: 42,
          }}
        >
          {encryptedBlob1300().map((r) => (
            <BufferRegion key={r.key} region={r} dimNonFocus={false} />
          ))}
        </div>

        <div
          className="text-center my-1"
          style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1 }}
        >
          ⊕
        </div>

        <div
          className="text-[10px] uppercase tracking-[0.06em] mb-1 text-center"
          style={{ color: KEY_RHO_COLOR, fontFamily: MONO, fontWeight: 700 }}
        >
          keystream · front 1,300 B of Bob's 2,600 (ch 9)
        </div>
        <div
          className="border-[1.5px] relative overflow-hidden flex items-center justify-center"
          style={{
            borderColor: KEY_RHO_COLOR,
            height: 42,
            background: "#fffdf5",
          }}
        >
          <HatchOverlay hops={["bob"]} zIndex={0} stripeOpacity={0.5} />
          <span
            className="relative"
            style={{ zIndex: 2, background: "#fffdf5", padding: "1px 8px" }}
          >
            <MathLine
              text="chacha20(rho_B, 2600)[:1300]"
              color={KEY_RHO_COLOR}
              fontSize={12}
            />
          </span>
        </div>

        <div
          className="text-center mt-1"
          style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1 }}
        >
          =
        </div>
      </div>
    );
  }

  // Beat 5: no lead-in; the persistent bar's own label carries the framing.
  return null;
}

// Content below the persistent bar (what each beat does next).
function ArcTail({ step }: { step: number }) {
  // Beat 3 (integrity): the HMAC compare distilled to one line + a verdict
  // stamp. The associated_data operand is shown concretely as the incoming
  // HTLC's payment_hash chip right under the formula. This is the only beat
  // (besides 1 and 7) that surfaces HTLC context, because the HMAC literally
  // binds that payment_hash into the tag.
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
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <MathLine text="associated_data" color={ASSOC_DATA_COLOR} fontSize={11} />
          <span style={{ color: NEUTRAL_TEXT, fontSize: 12 }}>=</span>
          <HtlcChip
            label="payment_hash"
            value={PAYMENT_HASH}
            accent={ASSOC_DATA_COLOR}
          />
        </div>
        <VerdictStamp
          label="AUTHENTIC"
          sub="bytes match, bound to this HTLC"
          failCode="invalid_onion_hmac"
        />
      </div>
    );
  }

  // Beat 4 (peel): the XOR stack lives in the lead-in above the persistent
  // bar (the bar itself is the result); nothing below.
  if (step === 4) {
    return null;
  }

  // Beat 5: the TLV region shown as the actual bytes, record by record. Each
  // record is a hoverable span (type byte gold, length byte slate, value bytes
  // ink) that decodes itself in a tooltip. The encodings are byte-exact BOLT 1
  // TLV, and the four records (a type-1 padding record + the three routing
  // records) sum to exactly the 27 bytes the bar's LEN cell (0x1B) promises.
  return <ParseHexView />;
}

// One TLV record in the hex strip: byte pairs with the type byte emphasized,
// underlined in the record's color, name beneath, full decode on hover.
interface TlvHexRecord {
  name: string;
  bytes: string[]; // [type, length, ...value]
  color: string;
  dim?: boolean;
  tip: ReactNode;
}

const TLV_HEX_RECORDS: TlvHexRecord[] = [
  {
    name: "padding",
    bytes: ["01", "06", "00", "00", "00", "00", "00", "00"],
    color: NEUTRAL_TEXT,
    dim: true,
    tip: (
      <span>
        <b>type 1 · padding</b> · length 6, six zero bytes. An odd (so,
        optional) record a sender may include to pad its TLV stream. Alice uses
        it here to round Bob's hop payload to 60 bytes; Bob just skips it.
      </span>
    ),
  },
  {
    name: "amt_to_forward",
    bytes: ["02", "03", "0f", "42", "40"],
    color: INK,
    tip: (
      <span>
        <b>type 2 · amt_to_forward</b> · a tu64, minimally encoded in 3 bytes.
        <span style={{ fontFamily: MONO }}> 0x0f4240</span> = 1,000,000 msat,
        the amount Bob must forward to Charlie.
      </span>
    ),
  },
  {
    name: "outgoing_cltv_value",
    bytes: ["04", "02", "03", "20"],
    color: INK,
    tip: (
      <span>
        <b>type 4 · outgoing_cltv_value</b> · a tu32, minimally encoded in 2
        bytes.
        <span style={{ fontFamily: MONO }}> 0x0320</span> = 800, the timelock
        Bob must set on his outgoing HTLC.
      </span>
    ),
  },
  {
    name: "short_channel_id",
    bytes: ["06", "08", "00", "00", "76", "00", "00", "02", "00", "01"],
    color: HOP_STROKE.charlie,
    tip: (
      <span>
        <b>type 6 · short_channel_id</b> · always 8 bytes: block ‖ tx index ‖
        output. <span style={{ fontFamily: MONO }}>0x000076</span> = block 118,
        <span style={{ fontFamily: MONO }}> 0x000002</span> = tx 2,
        <span style={{ fontFamily: MONO }}> 0x0001</span> = output 1, so
        118x2x1: the channel Bob forwards out on.
      </span>
    ),
  },
];

// The whole 60-byte hop payload rendered as data, aligned under the zoomed
// bar above: the LEN byte, the 27 TLV bytes in four hoverable records, then
// the 32 HMAC bytes elided (their value commits to everything beneath this
// layer, so spelling them out would be fiction).
function ParseHexView() {
  return (
    <div className="mt-1">
      {/* A pointer tying the strip to the bar above it. */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <span style={{ color: NEUTRAL_TEXT, fontSize: 13, fontWeight: 700 }}>↑</span>
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ fontFamily: MONO, color: NEUTRAL_TEXT, fontWeight: 700 }}
        >
          the same 60 bytes, as data
        </span>
      </div>

      {/* The extended rectangle: LEN | TLV records | HMAC, zone separators
          echoing the bar above. Hover anything to decode it. */}
      <div
        className="border-[1.5px] flex items-stretch mt-2"
        style={{ borderColor: INK, background: "#fffdf5" }}
      >
        {/* LEN byte */}
        <Tooltip
          width={250}
          label={
            <span>
              <b>bigsize length prefix</b> ·{" "}
              <span style={{ fontFamily: MONO }}>0x1b</span> = 27: how many
              bytes of TLV records follow.
            </span>
          }
        >
          <div
            className="flex flex-col items-center justify-center px-2.5 py-2 h-full"
            style={{
              cursor: "help",
              borderRight: `1px dashed ${FOCUS_GOLD}80`,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 800,
                color: FOCUS_GOLD,
              }}
            >
              1b
            </span>
            <span
              className="text-[9px] font-bold mt-1"
              style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
            >
              len
            </span>
          </div>
        </Tooltip>

        {/* TLV records */}
        <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-3 flex-1 px-3 py-2">
          {TLV_HEX_RECORDS.map((rec) => (
            <Tooltip key={rec.name} width={290} label={rec.tip}>
              <div
                className="flex flex-col items-center"
                style={{ cursor: "help", opacity: rec.dim ? 0.55 : 1 }}
              >
                <div
                  className="flex"
                  style={{
                    gap: 5,
                    borderBottom: `2px ${rec.dim ? "dotted" : "solid"} ${rec.color}`,
                    paddingBottom: 4,
                  }}
                >
                  {rec.bytes.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        fontFamily: MONO,
                        fontSize: 11.5,
                        fontWeight: i === 0 ? 800 : i === 1 ? 700 : 600,
                        color:
                          i === 0 ? FOCUS_GOLD : i === 1 ? NEUTRAL_TEXT : INK,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
                <span
                  className="text-[9px] font-bold mt-1"
                  style={{ fontFamily: MONO, color: rec.color }}
                >
                  {rec.name}
                </span>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* HMAC, elided: 32 bytes we deliberately do not spell out. */}
        <Tooltip
          width={280}
          label={
            <span>
              <b>charlie_hmac</b> · the 32-byte tag for the layer beneath
              Bob's. Its value commits to everything inside, so we don't spell
              it out. Bob copies it into the outer HMAC field of the packet he
              forwards.
            </span>
          }
        >
          <div
            className="flex flex-col items-center justify-center px-2.5 py-2 h-full"
            style={{
              cursor: "help",
              borderLeft: `1px dashed ${HOP_STROKE.charlie}80`,
              opacity: 0.75,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 700,
                color: HOP_STROKE.charlie,
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              ⋯ 32 B ⋯
            </span>
            <span
              className="text-[9px] font-bold mt-1"
              style={{ fontFamily: MONO, color: HOP_STROKE.charlie }}
            >
              charlie_hmac
            </span>
          </div>
        </Tooltip>
      </div>

      {/* Legend for the byte roles inside each record. */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[9px]" style={{ fontFamily: MONO }}>
        <span style={{ color: FOCUS_GOLD, fontWeight: 800 }}>type</span>
        <span style={{ color: NEUTRAL_TEXT }}>·</span>
        <span style={{ color: NEUTRAL_TEXT, fontWeight: 700 }}>length</span>
        <span style={{ color: NEUTRAL_TEXT }}>·</span>
        <span style={{ color: INK, fontWeight: 600 }}>value</span>
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
// The chapter's opening framing (a step-1 intro, gone from step 2 on): the
// `update_add_htlc` channel message arrives carrying the incoming HTLC fields
// AND, nested inside it, the onion. An arrow zooms that nested onion out to its
// full 1,366-byte self, and it's all encrypted, so Bob can't read any of it
// yet. From here the message envelope is dropped; the onion is the working
// surface for every later beat.

function ReceiveView() {
  return (
    <div className="mt-1">
      <UpdateAddHtlcEnvelope />

      {/* Zoom connector: the nested onion blows up to its full size below. */}
      <div className="flex flex-col items-center" style={{ margin: "2px 0" }}>
        <span
          style={{ color: FOCUS_GOLD, fontSize: 20, fontWeight: 700, lineHeight: 1 }}
        >
          ↓
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.08em]"
          style={{ fontFamily: MONO, color: NEUTRAL_TEXT, fontWeight: 700 }}
        >
          zoom into the onion
        </span>
      </div>

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
        style={{ background: "#fffdf5", borderColor: FOCUS_GOLD, height: 78 }}
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
            textAlign: "center",
          }}
        >
          1,366 encrypted bytes. Bob can't read any of it yet.
        </span>
      </div>
    </div>
  );
}

// The channel message that delivers the HTLC. A small bordered card: a labeled
// header, the inbound HTLC fields as quiet HtlcChips, and a nested mini onion
// (a hatched bar reading "onion · 1,366 B"). The nesting is the point: the
// onion rides inside the message, and the zoom below pulls it out to full size.
function UpdateAddHtlcEnvelope() {
  const accent = HOP_STROKE.bob;
  return (
    <div
      className="border-[1.5px] overflow-hidden mx-auto"
      style={{ borderColor: accent, background: "#fffdf5", maxWidth: 560 }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: `${accent}18`, borderBottom: `1.5px solid ${accent}40` }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.06em] font-bold"
          style={{ fontFamily: MONO, color: accent }}
        >
          update_add_htlc
        </span>
        <span
          className="text-[9px] uppercase tracking-[0.06em]"
          style={{ fontFamily: SANS, color: NEUTRAL_TEXT, fontStyle: "italic" }}
        >
          channel message from upstream peer
        </span>
      </div>
      <div className="px-3 py-2.5">
        {/* Inbound HTLC fields. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <HtlcChip label="amount_msat" value={`${fmt(AMOUNT_IN_MSAT)}`} />
          <HtlcChip label="cltv_expiry" value={`${fmt(CLTV_IN)}`} />
          <HtlcChip
            label="payment_hash"
            value={PAYMENT_HASH}
            note="= associated_data"
          />
        </div>

        {/* The nested onion: a mini hatched bar held inside the message. */}
        <div
          className="mt-2.5 border-[1.5px] flex items-center gap-2 relative overflow-hidden"
          style={{ borderColor: FOCUS_GOLD, background: "#fffdf5", padding: "5px 8px" }}
        >
          <HatchOverlay hops={OPAQUE_HATCH} zIndex={1} stripeOpacity={0.16} />
          <span
            className="text-[9px] uppercase tracking-[0.06em] shrink-0"
            style={{
              fontFamily: MONO,
              color: FOCUS_GOLD,
              fontWeight: 700,
              background: "rgba(255,253,245,0.9)",
              padding: "0 4px",
              zIndex: 2,
              position: "relative",
            }}
          >
            onion_routing_packet
          </span>
          <span
            className="text-[10px] ml-auto shrink-0"
            style={{
              fontFamily: MONO,
              color: INK,
              fontWeight: 700,
              background: "rgba(255,253,245,0.9)",
              padding: "0 4px",
              zIndex: 2,
              position: "relative",
            }}
          >
            onion · {fmt(FULL_PACKET_BYTES)} B
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
          structure check
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

// "See fields" affordance: reveals the four fixed-size fields (the ch-7 packet
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

// ── Beat 6: Forward vs destination branch ─────────────────────────────────
//
// A clean either/or hanging off one question: `short_channel_id` present? YES
// lights the FORWARDER arm (Bob's path); NO is the DESTINATION arm, shown as a
// single dim line. The malformed both/neither rule lives on a hover. Fewer
// boxes than before: the redundant inner "scid present" pill is gone (the YES
// branch already says it).

function BranchView() {
  const accent = HOP_STROKE.bob;
  return (
    <div className="mt-1 mx-auto" style={{ maxWidth: 460 }}>
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

      {/* YES → forwarder, lit (Bob's path). */}
      <div
        className="border-[1.5px] overflow-hidden flex items-stretch"
        style={{
          borderColor: FOCUS_GOLD,
          background: "#fffdf5",
          boxShadow: `0 0 0 2px rgba(184,134,11,0.2)`,
        }}
      >
        <div
          className="flex items-center justify-center px-2.5 shrink-0"
          style={{ background: `${accent}18`, color: accent, borderRight: `1.5px solid ${accent}40` }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ fontFamily: MONO }}>
            yes
          </span>
        </div>
        <div className="flex-1 px-3 py-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
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
          <div className="text-xs leading-snug mt-1" style={{ color: INK, fontFamily: SANS }}>
            Bob is an intermediate hop. Send the rebuilt onion onward to channel{" "}
            <span style={{ fontFamily: MONO }}>{SCID}</span>.
          </div>
        </div>
      </div>

      {/* NO → destination, the dim alternative on one line. */}
      <div
        className="border-[1.5px] overflow-hidden flex items-center mt-2"
        style={{ borderColor: "rgba(15,23,42,0.25)", background: "#fbfbf8", opacity: 0.78 }}
      >
        <div
          className="flex items-center justify-center px-2.5 self-stretch shrink-0"
          style={{ background: "rgba(15,23,42,0.05)", color: NEUTRAL_TEXT, borderRight: "1.5px solid rgba(15,23,42,0.15)" }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ fontFamily: MONO }}>
            no
          </span>
        </div>
        <div className="flex-1 px-3 py-1.5 min-w-0 text-[11px]" style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}>
          <span className="font-bold uppercase tracking-[0.06em]" style={{ fontFamily: MONO, color: HOP_STROKE.dave }}>
            DESTINATION
          </span>
          <span className="italic">
            {" "}carries <span style={{ fontFamily: MONO, fontStyle: "normal" }}>payment_data</span> instead. Not Bob's case here.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Beat 7: Fee + CLTV checks ─────────────────────────────────────────────

function CheckView() {
  return (
    <div className="space-y-3 mt-1">
      {/* The incoming HTLC values the three checks are measured against (the
          only HTLC context on this beat). */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[9px] uppercase tracking-[0.08em] shrink-0"
          style={{ fontFamily: MONO, color: HOP_STROKE.bob, fontWeight: 700 }}
        >
          checked against the incoming HTLC
        </span>
        <HtlcChip label="amount_msat" value={`${fmt(AMOUNT_IN_MSAT)}`} />
        <HtlcChip label="cltv_expiry" value={`${fmt(CLTV_IN)}`} />
      </div>
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
      <div className="flex-1 px-3 py-1.5 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-bold" style={{ color: INK, fontFamily: SANS }}>
            {label}
          </span>
          <span className="shrink-0">
            <MathLine text={formula} color={pass ? VERIFY_GREEN : ERROR_RED} fontSize={12} />
          </span>
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
    <div className="my-2 mx-auto" style={{ maxWidth: 600 }}>
      <div
        className="text-center text-[10px] uppercase tracking-[0.08em] font-bold mb-2.5"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        every peel ends one of three ways
      </div>
      <OutcomeRow active tag="forward" accent={HOP_STROKE.bob} note="Bob's case">
        send the rebuilt packet out on <Mono>{SCID}</Mono>, carrying{" "}
        <Mono>{fmt(AMT_FORWARD_MSAT)} msat</Mono> with CLTV{" "}
        <Mono>{fmt(OUTGOING_CLTV)}</Mono>
      </OutcomeRow>
      <OutcomeRow tag="deliver" accent={HOP_STROKE.dave}>
        no <Mono>short_channel_id</Mono>, but <Mono>payment_data</Mono>: Bob
        would be the destination, and claims with the preimage
      </OutcomeRow>
      <OutcomeRow tag="reject" accent={ERROR_RED}>
        any check failed: build an error onion from <Mono>ss</Mono> and send it
        back (chapter 11)
      </OutcomeRow>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: MONO, fontWeight: 600 }}>{children}</span>;
}

// One outcome as a single readable row: a colored tag, then a plain sentence
// with the concrete values inline. Bob's row carries the gold active bar.
function OutcomeRow({
  tag,
  accent,
  active,
  note,
  children,
}: {
  tag: string;
  accent: string;
  active?: boolean;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-baseline gap-3 px-3 py-2"
      style={{
        borderLeft: `3px solid ${active ? FOCUS_GOLD : "transparent"}`,
        background: active ? "rgba(184,134,11,0.07)" : "transparent",
        opacity: active ? 1 : 0.72,
      }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.06em] font-bold shrink-0"
        style={{ fontFamily: MONO, color: accent, width: 70 }}
      >
        {active ? "✓ " : ""}
        {tag}
      </span>
      <span
        className="text-[11.5px] leading-relaxed"
        style={{ fontFamily: SANS, color: INK }}
      >
        {children}
        {note && (
          <span
            className="text-[9px] font-bold uppercase ml-2"
            style={{ fontFamily: MONO, color: FOCUS_GOLD }}
          >
            · {note}
          </span>
        )}
      </span>
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
