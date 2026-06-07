// ────────────────────────────────────────────────────────────────────────────
// ValidationFlowDiagram (rebuilt 2026-06-03)
//
// Animated, click-through "Forwarder Validation Loop" from Bob's view. Where
// PeelTraceDiagram (ch 9) traces the byte-mechanics of the peel, this visual
// foregrounds the DECISION layer that wraps around it: the ordering of the
// gates, the incoming-HTLC context, the forward-vs-destination branch, the
// fee/CLTV policy checks, and the three-way `process` outcome.
//
// Beats:
//   1. RECEIVE   — update_add_htlc arrives: incoming HTLC + 1,366-byte onion
//   2. GATE 1    — structural check: 1,366 bytes? version 0x00?
//   3. GATE 2    — verify HMAC(mu_B, hop_payloads ‖ AD) BEFORE decrypting
//   4. PEEL      — only now: XOR with rho_B to expose the hop payload (compact)
//   5. PARSE     — read the TLV: amt_to_forward, outgoing_cltv, short_channel_id
//   6. BRANCH    — forwarder (scid) vs destination (payment_data)
//   7. CHECK     — fees + timelocks against the incoming HTLC
//   8. OUTCOME   — ForwardInstruction / FinalDelivery / Rejection (each holds ss)
//
// Reuses the shared trace primitives exported from WrapTraceDiagram plus
// KeyDerivationCard / KeyHoverIcon (key-disclosure pattern), HatchOverlay,
// MathLine, and renderCaption. Locked onion-routing visual format spec.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { renderCaption } from "./captionMarkup";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";
import {
  KeyDerivationCard,
  KeyHoverIcon,
  type KeyDerivationRow,
} from "./KeyDerivationCard";
import { MathLine } from "./mathTokens";
import { MorphBox, CrossfadeSwap } from "./morph";
import {
  MONO,
  SANS,
  FOCUS_GOLD,
  INK,
  NEUTRAL_TEXT,
  HOP_STROKE,
  FULL_PACKET_BYTES,
  STEP_MS,
  IterationBanner,
  BufferRegion,
  BufferHeader,
  CompactBar,
  SymbolRow,
  ADBar,
  HoverTooltip,
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
    title: "An `update_add_htlc` arrives with the onion",
    caption:
      "Bob's upstream peer sends an `update_add_htlc`: an incoming HTLC plus 1,366 bytes of onion. The HTLC carries the `payment_hash` (this is the `associated_data`), the incoming amount, and the incoming `cltv_expiry`. Bob hasn't trusted a single byte yet — earning that trust is the whole job of this chapter.",
  },
  {
    step: 2,
    iterLabel: "Bob validates",
    subLabel: "GATE 1 · STRUCTURE",
    title: "Cheapest check first: 1,366 bytes? version `0x00`?",
    caption:
      "Before any crypto, the structural gate. Is the packet exactly 1,366 bytes, and is the version byte `0x00`? If either is wrong, Bob rejects immediately with `invalid_onion_version`. Cheap, defensive checks go first so malformed packets cost almost nothing.",
  },
  {
    step: 3,
    iterLabel: "Bob validates",
    subLabel: "GATE 2 · INTEGRITY",
    title: "Verify `HMAC(mu_B, hop_payloads ‖ associated_data)` — before decrypting",
    caption:
      "The integrity gate, and it runs *before* any decryption. Bob recomputes `HMAC(mu_B, hop_payloads ‖ associated_data)` over the still-encrypted bytes and compares it to the packet's `outer_hmac`. A match means the bytes are authentic and bound to this exact HTLC. A mismatch means tampering or a re-attached onion, so Bob rejects with `invalid_onion_hmac` and never lets those bytes reach his parser.",
  },
  {
    step: 4,
    iterLabel: "Bob validates",
    subLabel: "PEEL",
    title: "Only now: XOR with `rho_B` to expose the hop payload",
    caption:
      "Integrity confirmed, so Bob can finally decrypt. He XORs the buffer with his `rho_B` keystream to strip his layer, exposing his hop payload at the front. This is the chapter-9 peel (the 2,600-byte extend-and-XOR); we keep it compact here to stay on the decisions around it.",
  },
  {
    step: 5,
    iterLabel: "Bob validates",
    subLabel: "PARSE",
    title: "Read the TLV: `amt_to_forward`, `outgoing_cltv_value`, `short_channel_id`",
    caption:
      "Bob's hop payload is plaintext now. A provided helper, `parse_tlv_records`, walks the bigsize-prefixed TLV records and hands back `amt_to_forward`, `outgoing_cltv_value`, and `short_channel_id`. The 32 bytes right after the TLVs are `charlie_hmac` — the tag Bob will carry onto the packet he forwards.",
  },
  {
    step: 6,
    iterLabel: "Bob validates",
    subLabel: "BRANCH",
    title: "Forwarder or destination? The present TLV fields decide",
    caption:
      "Which role is Bob playing? `short_channel_id` present means Bob is a *forwarder* and should send the onion onward. `payment_data` present with no `short_channel_id` means Bob is the *destination*. Both present, or neither, is malformed and Bob rejects it.",
  },
  {
    step: 7,
    iterLabel: "Bob validates",
    subLabel: "CHECK",
    title: "Sanity-check fees and timelocks against the incoming HTLC",
    caption:
      "Bob is forwarding, so he holds the TLV's numbers up against the incoming HTLC. Does the incoming amount cover `amt_to_forward` plus his fee? Does the incoming `cltv_expiry` clear `outgoing_cltv_value` by at least his published delta? Is the outgoing CLTV still in the future? These are the very fees and timelocks Alice solved backward in chapter 2.",
  },
  {
    step: 8,
    iterLabel: "Bob decides",
    subLabel: "OUTCOME",
    title: "`process` returns Forward, Settle, or Reject",
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
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
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
            <IterationBanner beat={beat} />
            <BeatBody step={step} />
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
          <div
            className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl"
            style={{ color: INK }}
          >
            {renderCaption(beat.caption)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Beat body ───────────────────────────────────────────────────────────────
//
// Two morph mechanisms, per onion-routing-visual-standards §14:
//
//   • The hop_payloads bar recurs across beats 3→4→5 (encrypted blob → stripped
//     → zoomed). PayloadArcView renders ONE persistent MorphBox for those three
//     beats (stable key="hop-payloads-bar"), so the box reconciles and morphs
//     its height/border across the step change while its inner representation
//     crossfades. The supporting equation around the bar crossfades too.
//   • Every other beat (1, 2, 6, 7, 8) is genuinely different content, so the
//     panel area crossfades through CrossfadeSwap keyed on `step` rather than
//     hard-cutting. The HtlcCard (beats 1 + 7) keeps a stable key so it
//     reconciles on any direct 1↔7 jump.
//
// The persistent arc and the crossfade panels are mutually exclusive: only one
// is mounted at a time, so the 2→3 and 5→6 boundaries are honest crossfades
// between genuinely-different representations.

function BeatBody({ step }: { step: number }) {
  const inPayloadArc = step >= 3 && step <= 5;
  if (inPayloadArc) return <PayloadArcView step={step} />;

  // Beats 1 and 7 both lead with the incoming HTLC card. Render it as ONE
  // persistent keyed element OUTSIDE the per-step crossfade, so a direct 1↔7
  // jump morphs the same card (full ↔ compact) instead of cross-cutting two
  // copies. The rest of each beat crossfades around it.
  const showHtlcCard = step === 1 || step === 7;

  return (
    <div className="mt-2">
      {showHtlcCard && (
        <MorphBox key="htlc-card" layout className="mb-4">
          <HtlcCard compact={step === 7} />
        </MorphBox>
      )}
      <CrossfadeSwap swapKey={step}>
        <NonArcBeat step={step} />
      </CrossfadeSwap>
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

// Content above the persistent bar. Each beat frames the bar's headline state:
//   3: the key card whose mu_B drives the integrity check
//   4: the XOR equation (before, keystream, equals) that produces the stripped bar
//   5: a header introducing the zoomed payload
function ArcLeadIn({ step }: { step: number }) {
  if (step === 3) return <KeyDerivationCard {...keyDerivationProps(true)} />;

  if (step === 4) {
    return (
      <div>
        <KeyHoverBadge />
        <CompactBar
          label="hop_payloads · before XOR (encrypted)"
          regions={encryptedBlob1300()}
          accentColor={NEUTRAL_TEXT}
        />
        <SymbolRow char="⊕" />
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <MathLine text="chacha20(rho_B, 2600)" color={KEY_RHO_COLOR} fontSize={11} />
          <span
            className="text-[10px] uppercase tracking-[0.06em]"
            style={{ color: KEY_RHO_COLOR, fontFamily: MONO, fontWeight: 700 }}
          >
            keystream (ch 9)
          </span>
        </div>
        <SymbolRow char="=" />
      </div>
    );
  }

  // Beat 5: no lead-in; the persistent bar's own label carries the framing.
  return null;
}

// Content below the persistent bar (what each beat does next).
function ArcTail({ step }: { step: number }) {
  if (step === 3) {
    return (
      <div>
        <SymbolRow char="‖" />
        <ADBar />
        <SymbolRow char="↓" />
        <div
          className="text-center mb-1"
          style={{
            boxShadow: `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`,
            padding: "10px 14px",
            background: "#fffdf5",
          }}
        >
          <MathLine
            text="HMAC(mu_B, hop_payloads ‖ associated_data)"
            color={KEY_MU_COLOR}
            fontSize={14}
          />
        </div>
        <SymbolRow char="≟" />
        <div className="text-center">
          <MathLine text="outer_hmac" color={NEUTRAL_TEXT} fontSize={13} />
        </div>
        <GateBadge
          pass
          passLabel="match — bytes authentic, bound to this HTLC"
          failCode="invalid_onion_hmac"
        />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div
        className="text-center mt-2 text-[11px] italic"
        style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}
      >
        Bob's 60-byte hop payload is now plaintext at the front; the rest stays
        encrypted for Charlie. (Full byte-mechanics in chapter 9.)
      </div>
    );
  }

  // Beat 5: byte axis + parse → TLV chips.
  return (
    <div>
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte 59</span>
      </div>
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

function GateBadge({
  pass,
  passLabel,
  failCode,
}: {
  pass: boolean;
  passLabel: string;
  failCode: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 mt-3">
      <div
        className="inline-flex items-center gap-2 border-[1.5px] px-3 py-1.5"
        style={{
          background: pass ? "#e7f6ee" : "#fde7e7",
          borderColor: pass ? VERIFY_GREEN : ERROR_RED,
          color: pass ? VERIFY_GREEN : ERROR_RED,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>{pass ? "✓" : "✗"}</span>
        <span
          className="text-xs font-bold uppercase tracking-[0.05em]"
          style={{ fontFamily: MONO }}
        >
          {passLabel}
        </span>
      </div>
      <div
        className="text-[11px]"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        on failure → <span style={{ color: ERROR_RED }}>{failCode}</span>
      </div>
    </div>
  );
}

// Incoming HTLC card — the context the validation gates check against.
function HtlcCard({ compact }: { compact?: boolean }) {
  return (
    <div
      className="border-[1.5px] overflow-hidden"
      style={{ borderColor: HOP_STROKE.bob, background: "#fffdf5" }}
    >
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          background: `${HOP_STROKE.bob}18`,
          borderBottom: `1.5px solid ${HOP_STROKE.bob}40`,
        }}
      >
        <span style={{ fontSize: 13 }}>↘</span>
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: HOP_STROKE.bob }}
        >
          inbound HTLC (from upstream peer)
        </span>
      </div>
      <div
        className={`grid ${compact ? "grid-cols-3" : "grid-cols-3"} gap-px`}
        style={{ background: "rgba(15,23,42,0.08)" }}
      >
        <HtlcField label="payment_hash" value={PAYMENT_HASH} note="= associated_data" />
        <HtlcField label="amount" value={`${fmt(AMOUNT_IN_MSAT)} msat`} />
        <HtlcField label="cltv_expiry" value={`${fmt(CLTV_IN)}`} note="block height" />
      </div>
    </div>
  );
}

function HtlcField({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center px-2 py-2" style={{ background: "#fffdf5" }}>
      <span
        className="text-[9px] uppercase tracking-[0.06em] font-bold"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        {label}
      </span>
      <span
        className="font-bold mt-0.5"
        style={{ fontFamily: MONO, fontSize: 12, color: INK }}
      >
        {value}
      </span>
      {note && (
        <span
          className="text-[8.5px] mt-0.5 italic"
          style={{ fontFamily: SANS, color: ASSOC_DATA_COLOR }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

// ── Beat 1: Receive ───────────────────────────────────────────────────────

function ReceiveView() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center" style={{ color: NEUTRAL_TEXT, fontSize: 18 }}>
        +
      </div>
      <div>
        <BufferHeader
          leftLabel="onion_routing_packet"
          rightLabel={
            <HoverTooltip
              content={
                <span>
                  Fixed 1,366-byte Sphinx wire format. Same size at every hop, so
                  an observer can't tell where Bob sits in the route.
                </span>
              }
            >
              {fmt(FULL_PACKET_BYTES)} bytes
            </HoverTooltip>
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
            1,366 encrypted bytes — Bob can't read any of it yet
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Beat 2: Structure gate ────────────────────────────────────────────────

function StructureGateView() {
  return (
    <div className="mt-2">
      <BufferHeader
        leftLabel="parse the four fixed-size fields"
        rightLabel={`${fmt(FULL_PACKET_BYTES)} bytes total`}
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{ background: "#fffdf5", borderColor: INK, height: 84 }}
      >
        <StructField basis={120} label="version" value="0x00" note="1 B" check />
        <StructField basis={150} label="ephemeral pubkey" value="E_AB" note="33 B" accent={HOP_STROKE.bob} />
        <StructFieldGrow label="hop_payloads" value="encrypted" note="1,300 B" />
        <StructField basis={120} label="outer_hmac" value="hmac" note="32 B" />
      </div>
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte {fmt(FULL_PACKET_BYTES - 1)}</span>
      </div>
      <GateBadge
        pass
        passLabel="1,366 bytes · version 0x00"
        failCode="invalid_onion_version"
      />
    </div>
  );
}

function StructField({
  basis,
  label,
  value,
  note,
  accent,
  check,
}: {
  basis: number;
  label: string;
  value: string;
  note: string;
  accent?: string;
  check?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center border-r-[1.5px] last:border-r-0 relative"
      style={{
        flexBasis: basis,
        flexShrink: 0,
        borderColor: INK,
        padding: "6px 6px",
        background: accent ? `${accent}14` : "#fffdf5",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.06em] font-bold"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        {label}
      </span>
      <span
        className="font-bold mt-0.5"
        style={{ fontFamily: MONO, fontSize: 13, color: accent ?? INK }}
      >
        {value}
      </span>
      <span className="text-[9px] mt-0.5 italic" style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}>
        {note}
      </span>
      {check && (
        <span
          className="absolute top-1 right-1 text-[11px] font-bold"
          style={{ color: VERIFY_GREEN }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

function StructFieldGrow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{ minWidth: 0, padding: "6px 6px" }}
    >
      <HatchOverlay hops={OPAQUE_HATCH} zIndex={1} stripeOpacity={0.14} />
      <span
        className="text-[9px] uppercase tracking-[0.06em] font-bold relative"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT, zIndex: 2 }}
      >
        {label}
      </span>
      <span
        className="font-bold mt-0.5 relative"
        style={{ fontFamily: MONO, fontSize: 12, color: INK, zIndex: 2, background: "rgba(255,253,245,0.85)", padding: "0 4px" }}
      >
        {value}
      </span>
      <span className="text-[9px] mt-0.5 italic relative" style={{ fontFamily: SANS, color: NEUTRAL_TEXT, zIndex: 2 }}>
        {note}
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

function BranchView() {
  return (
    <div className="my-2">
      <div className="text-center mb-3">
        <MathLine
          text="short_channel_id present?"
          color={INK}
          fontSize={14}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BranchCard
          active
          title="FORWARDER"
          condition="short_channel_id present"
          accent={HOP_STROKE.bob}
          lines={[
            "Bob is an intermediate hop.",
            "Send the rebuilt onion onward",
            `to channel ${SCID}.`,
          ]}
        />
        <BranchCard
          title="DESTINATION"
          condition="payment_data present, no short_channel_id"
          accent={HOP_STROKE.dave}
          lines={[
            "Bob would be the final hop.",
            "Check payment_secret + total,",
            "then claim the HTLC.",
          ]}
        />
      </div>
      <div
        className="text-center mt-3 text-[11px] italic"
        style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}
      >
        Both fields present, or neither, is malformed → reject. Here Bob has a
        `short_channel_id`, so he takes the forwarder path.
      </div>
    </div>
  );
}

function BranchCard({
  active,
  title,
  condition,
  accent,
  lines,
}: {
  active?: boolean;
  title: string;
  condition: string;
  accent: string;
  lines: string[];
}) {
  return (
    <div
      className="border-[1.5px] overflow-hidden"
      style={{
        borderColor: active ? FOCUS_GOLD : "rgba(15,23,42,0.3)",
        background: active ? "#fffdf5" : "#fbfbf8",
        boxShadow: active ? `0 0 0 2px rgba(184,134,11,0.2)` : "none",
        opacity: active ? 1 : 0.7,
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
          {title}
        </span>
        {active && (
          <span className="text-[11px] font-bold" style={{ color: FOCUS_GOLD }}>
            ◄ Bob
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <div
          className="text-[10px] mb-1.5 inline-block px-1.5 py-0.5"
          style={{ fontFamily: MONO, color: accent, background: `${accent}12` }}
        >
          if {condition}
        </div>
        {lines.map((l, i) => (
          <div
            key={i}
            className="text-xs leading-snug"
            style={{ color: INK, fontFamily: SANS }}
          >
            {l}
          </div>
        ))}
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
      <div
        className="flex items-center px-2 text-[9.5px] text-right"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT, maxWidth: 120 }}
      >
        else → <span style={{ color: ERROR_RED, marginLeft: 4 }}>{failCode}</span>
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
        style={{ color: ASSOC_DATA_COLOR, fontFamily: SANS }}
      >
        Every outcome carries `ss` — the error path always needs the shared
        secret, whether to wrap an error here or relay one from downstream.
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
          {fields.map((f) => (
            <span
              key={f}
              className="text-[10px] px-1.5 py-0.5 border"
              style={{
                fontFamily: MONO,
                color: f === "ss" ? ASSOC_DATA_COLOR : INK,
                borderColor: f === "ss" ? ASSOC_DATA_COLOR : "rgba(15,23,42,0.2)",
                background: f === "ss" ? `${ASSOC_DATA_COLOR}10` : "#fff",
              }}
            >
              {f}
            </span>
          ))}
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
      useSubtitle: "peels the layer (next step)",
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

function KeyHoverBadge() {
  return (
    <div className="flex justify-end mb-1">
      <KeyHoverIcon {...keyDerivationProps(false)} />
    </div>
  );
}

export default ValidationFlowDiagram;
