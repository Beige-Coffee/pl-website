import { useRef, useState, type ReactNode } from "react";
import { HatchOverlay, LAYER_COLORS, type ForwarderId } from "./encryptionHatch";
import { SlotSubCell } from "./SlotSubCell";
import { renderCaption } from "./captionMarkup";
import { StepCaption } from "./StepCaption";
import { createPortal } from "react-dom";
import { MathLine } from "./mathTokens";
import { MorphBox } from "./morph";
import { Tooltip } from "./Tooltip";
import { KeyHoverIcon, type KeyDerivationCardProps, type KeyDerivationRow } from "./KeyDerivationCard";

// ────────────────────────────────────────────────────────────────────────────
// WrapTraceDiagram (chapter 8, "Wrapping Layer by Layer")
//
// 13-beat byte-accurate walkthrough of Alice's full Sphinx build. Pairs with
// ForwarderPeelDiagram as the structural inverse (peel = same operation in
// reverse), so the two visuals read as mirror images.
//
//   1.  Pad-key init                                         (no layers)
//   2.  Dave: shift right by 100 (drop last 100 of pad-noise)
//   3.  Dave: write slot (LEN | TLV | HMAC=0x00…)
//   4.  Dave: XOR entire 1,300 bytes with rho_D              (+Dave layer)
//   5.  Dave: filler overlay at trailing 140 bytes           (Bob+Charlie hatch)
//   6.  Dave: HMAC → dave_hmac (saved as next_hmac)
//   7.  Charlie: shift right by 80 + write slot               (Charlie slot bare)
//   8.  Charlie: XOR with rho_C                               (+Charlie everywhere)
//   9.  Charlie: HMAC → charlie_hmac
//   10. Bob: shift right by 60 + write slot                   (Bob slot bare)
//   11. Bob: XOR with rho_B                                   (+Bob everywhere)
//   12. Bob: HMAC → bob_hmac (this is the packet's hmac field)
//   13. Envelope attach → 1,366-byte onion ready for Bob
//
// Visual conventions:
//   • Locked encryption-hatch palette (Bob 90° / Charlie 45° / Dave 0°),
//     applied via shared HatchOverlay component.
//   • Slot format: LEN bigsize + TLV (hop name + byte count) + HMAC subcell,
//     using SlotSubCell so hover labels match the locked spec.
//   • Pad-noise renders as a faint gray diagonal stripe to read as "pre-
//     existing pseudo-random," visually distinct from the encryption hatches.
//   • Newly-touched region per beat gets a gold inset glow; dim everything
//     else to 0.55 (matching DIM_OPACITY conventions in ForwarderPeelDiagram).
//   • HMAC chain indicator below the buffer shows dave_hmac → charlie_hmac
//     → bob_hmac filling in as each iteration completes.
// ────────────────────────────────────────────────────────────────────────────

export const MONO = '"JetBrains Mono", "Fira Code", monospace';
export const SANS = "ui-sans-serif, system-ui, sans-serif";
export const FOCUS_GOLD = "#b8860b";
export const INK = "#0f172a";
export const NEUTRAL_TEXT = "#475569";
export const DIM_OPACITY = 0.55;

export const HOP_LIGHT: Record<ForwarderId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
export const HOP_STROKE: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
export const HOP_LABEL: Record<ForwarderId, string> = {
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};
const NEXT_LABEL: Record<ForwarderId, string> = {
  bob: "for Charlie",
  charlie: "for Dave",
  dave: "none",
};
const NEXT_COLOR: Record<ForwarderId, string> = {
  bob: HOP_STROKE.charlie,
  charlie: HOP_STROKE.dave,
  dave: "#475569",
};
const SLOT_BIGSIZE_HEX: Record<ForwarderId, string> = {
  // bigsize LEN = TLV payload bytes only (slot total minus 1-byte prefix and 32-byte HMAC)
  bob: "0x1B",     // 60-byte slot → 60 - 1 - 32 = 27
  charlie: "0x2F", // 80-byte slot → 47
  dave: "0x43",    // 100-byte slot → 67
};

export const ROUTING_INFO_SIZE = 1300;
export const BOB_SLOT = 60;
export const CHARLIE_SLOT = 80;
export const DAVE_SLOT = 100;
export const FILLER_LEN = BOB_SLOT + CHARLIE_SLOT; // 140

export const PACKET_VERSION_BYTES = 1;
export const PACKET_PUBKEY_BYTES = 33;
export const PACKET_HMAC_BYTES = 32;
export const FULL_PACKET_BYTES =
  PACKET_VERSION_BYTES + PACKET_PUBKEY_BYTES + ROUTING_INFO_SIZE + PACKET_HMAC_BYTES; // 1,366

// Display proportions: the slot regions are intentionally enlarged so the
// LEN | TLV | HMAC subcells are readable. Real byte ratios (240/1300 ≈ 18%
// of the buffer for all three slots combined) would make subcells overlap.
// We exaggerate the slot widths and shrink the padding region; the
// trailing byte label still says "byte 1,299" so the actual byte boundary
// is clear from context.
export const DISPLAY_BOB_PCT = 22;
export const DISPLAY_CHARLIE_PCT = 24;
export const DISPLAY_DAVE_PCT = 26;
export const DISPLAY_FILLER_PCT = 10;
// Padding region absorbs whatever remains: 100 - 22 - 24 - 26 - 10 = 18%.

const TOTAL_BEATS = 13;
export const STEP_MS = 2400;

// ── Beat definitions ──────────────────────────────────────────────────────

export type FocusKind = "buffer" | "front" | "trailing" | "envelope";

export interface Beat {
  step: number;
  iterLabel: string;
  subLabel: string;
  title: string;
  caption: string;
  focus?: FocusKind;
}

const BEATS: Beat[] = [
  {
    step: 1,
    iterLabel: "Pad-key init",
    subLabel: "INITIALIZE",
    title: "Fill the buffer with `pad_key` noise",
    caption:
      "First, before any wrapping, Alice fills the 1,300-byte `hop_payloads` buffer with `chacha20(pad_key, 1300)`, where `pad_key = HMAC('pad', session_key)`. Why start with noise? So the destination can't tell 'this packet was built for a short route' from what's left over.",
  },
  {
    step: 2,
    iterLabel: "Iteration 1 of 3 (Dave, innermost)",
    subLabel: "SHIFT",
    title: "Right-shift by 100 bytes",
    caption:
      "Now we make room for Dave. Drop the last 100 bytes off the right and prepend 100 empty placeholder bytes at the front. That's exactly the size of Dave's hop payload (bigsize + TLV + HMAC), and the total stays at 1,300.",
  },
  {
    step: 3,
    iterLabel: "Iteration 1 of 3 (Dave, innermost)",
    subLabel: "WRITE",
    title: "Write Dave's hop payload at the front",
    caption:
      "Now we write Dave's bigsize-prefixed TLV records (amt_to_forward, outgoing_cltv_value, payment_data), then a 32-byte all-zero HMAC. Those zeros are how Dave knows he's the *destination*. He's the final hop, so there's no inner layer for his HMAC to commit to.",
    focus: "front",
  } as Beat,
  {
    step: 4,
    iterLabel: "Iteration 1 of 3 (Dave, innermost)",
    subLabel: "ENCRYPT",
    title: "XOR with `rho_D` over the whole 1,300 bytes",
    caption:
      "Now we encrypt. Generate `chacha20(rho_D, 1300)` and XOR it onto the whole buffer. In a single pass, Dave's hop payload and the pad-noise tail both pick up Dave's encryption layer.",
  },
  {
    step: 5,
    iterLabel: "Iteration 1 of 3 (Dave, innermost)",
    subLabel: "FILLER OVERLAY",
    title: "Overwrite the trailing 140 bytes with filler",
    caption:
      "Here's the one step we only do on the innermost iteration. We overwrite the last 140 bytes (`len(filler)`) with the filler we built back in chapter 7. It already carries Bob's and Charlie's encryption layers, and these are the very bytes that, after each forwarder peels, land right where Charlie's and Dave's HMACs were computed over.",
    focus: "trailing",
  } as Beat,
  {
    step: 6,
    iterLabel: "Iteration 1 of 3 (Dave, innermost)",
    subLabel: "HMAC",
    title: "Compute `dave_hmac`",
    caption:
      "Now we tag it: `dave_hmac = HMAC(mu_D, buffer || associated_data)`. That `associated_data` (the 32-byte `payment_hash`) ties the onion to one specific HTLC. We hold onto `dave_hmac` as `next_hmac`, ready for Charlie's iteration.",
  },
  {
    step: 7,
    iterLabel: "Iteration 2 of 3 (Charlie)",
    subLabel: "SHIFT + WRITE",
    title: "Right-shift by 80 and write Charlie's hop payload",
    caption:
      "Same steps, one layer out. Drop the last 80 bytes off the right (the Charlie-only tail of the filler), prepend 80 bytes of placeholder, and write Charlie's TLV records plus `dave_hmac` (the value we just computed) into it. The Bob+Charlie portion of the filler stays put in the trailing 60 bytes.",
    focus: "front",
  } as Beat,
  {
    step: 8,
    iterLabel: "Iteration 2 of 3 (Charlie)",
    subLabel: "ENCRYPT",
    title: "XOR with `rho_C` over the whole 1,300 bytes",
    caption:
      "Now generate `chacha20(rho_C, 1300)` and XOR again. Charlie's hop payload gets its first encryption layer. Dave's, already wrapped in its own layer, picks up Charlie's on top, so it's at 2 layers now. The middle padding goes from 1 layer to 2.",
  },
  {
    step: 9,
    iterLabel: "Iteration 2 of 3 (Charlie)",
    subLabel: "HMAC",
    title: "Compute `charlie_hmac`",
    caption:
      "Then we tag again: `charlie_hmac = HMAC(mu_C, buffer || associated_data)`. We save it as `next_hmac` for Bob's iteration. Bob's hop payload doesn't exist yet, so this is exactly the value that'll end up sitting in Bob's HMAC field.",
  },
  {
    step: 10,
    iterLabel: "Iteration 3 of 3 (Bob, outermost)",
    subLabel: "SHIFT + WRITE",
    title: "Right-shift by 60 and write Bob's hop payload",
    caption:
      "Last hop, last time through. Drop the last 60 bytes off the right (the Bob+Charlie filler residue, which has done its job by now), prepend a 60-byte placeholder, and write Bob's TLV records plus `charlie_hmac` into it.",
    focus: "front",
  } as Beat,
  {
    step: 11,
    iterLabel: "Iteration 3 of 3 (Bob, outermost)",
    subLabel: "ENCRYPT",
    title: "XOR with `rho_B` over the whole 1,300 bytes",
    caption:
      "Now the final encryption layer. After this XOR, Bob's hop payload has 1 layer (Bob), Charlie's has 2 (Bob + Charlie), Dave's has 3 (Bob + Charlie + Dave), and the trailing padding has 3 too. There's the privacy property at work: on the wire, *every* region looks equally encrypted.",
  },
  {
    step: 12,
    iterLabel: "Iteration 3 of 3 (Bob, outermost)",
    subLabel: "HMAC",
    title: "Compute `bob_hmac`",
    caption:
      "One more tag: `bob_hmac = HMAC(mu_B, buffer || associated_data)`. This one's special, since it goes in the packet's outer `hmac` field. When the packet lands, Bob checks it first thing, before he decrypts anything.",
  },
  {
    step: 13,
    iterLabel: "Final packet",
    subLabel: "ASSEMBLE",
    title: "Attach the envelope → 1,366-byte Sphinx packet",
    caption:
      "Finally, we wrap the envelope around it. Prepend the 1-byte version (`0x00`) and the 33-byte ephemeral pubkey `E_AB`, then append the 32-byte `bob_hmac`. That's 1 + 33 + 1,300 + 32 = 1,366 bytes, ready to ship to Bob. Nice.",
    focus: "envelope",
  } as Beat,
];

// ── Region model ──────────────────────────────────────────────────────────

// Per beat, the buffer is a sequence of named regions left-to-right. Each
// region knows its display width (in our exaggerated proportions), its kind,
// which hop's slot it represents (if any), and which encryption hatches
// currently apply.

export type RegionKind =
  | "padding-init"
  | "padding-enc"
  | "slot"
  | "filler"
  | "empty";

export interface Region {
  key: string;
  widthPct: number;
  kind: RegionKind;
  hop?: ForwarderId;
  layers: ForwarderId[];
  fillerOwners?: ForwarderId[]; // hatch hops for filler regions
  isFocus?: boolean;
}

function regionsForBeat(step: number, focus?: FocusKind): Region[] {
  const padPct = DISPLAY_BOB_PCT + DISPLAY_CHARLIE_PCT + DISPLAY_DAVE_PCT + DISPLAY_FILLER_PCT;
  const fullPadPct = 100;

  // Beat 1 - pad-init: one big padding-init region.
  if (step === 1) {
    return [
      {
        key: "pad",
        widthPct: fullPadPct,
        kind: "padding-init",
        layers: [],
        isFocus: true,
      },
    ];
  }

  // Beat 2 - Dave shift: empty placeholder at front, padding behind.
  if (step === 2) {
    return [
      {
        key: "dave-empty",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "empty",
        hop: "dave",
        layers: [],
        isFocus: true,
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_DAVE_PCT,
        kind: "padding-init",
        layers: [],
      },
    ];
  }

  // Beat 3 - Dave write: slot at front (no encryption yet).
  if (step === 3) {
    return [
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: [],
        isFocus: true,
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_DAVE_PCT,
        kind: "padding-init",
        layers: [],
      },
    ];
  }

  // Beat 4 - Dave XOR: entire buffer picks up Dave's hatch.
  if (step === 4) {
    return [
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave"],
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_DAVE_PCT,
        kind: "padding-enc",
        layers: ["dave"],
      },
    ];
  }

  // Beat 5 - Dave filler overlay: trailing 140 bytes (display 14%) become
  // filler (Bob+Charlie hatch). Padding middle still wears Dave hatch.
  if (step === 5) {
    return [
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave"],
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_DAVE_PCT - DISPLAY_FILLER_PCT,
        kind: "padding-enc",
        layers: ["dave"],
      },
      {
        key: "filler",
        widthPct: DISPLAY_FILLER_PCT,
        kind: "filler",
        fillerOwners: ["bob", "charlie"],
        layers: ["bob", "charlie"],
        isFocus: true,
      },
    ];
  }

  // Beat 6 - Dave HMAC: same layout as beat 5; no buffer change. HMAC chip
  // surfaces separately.
  if (step === 6) {
    return regionsForBeat(5).map((r) => ({ ...r, isFocus: false }));
  }

  // Beat 7 - Charlie shift+write: prepend 80-byte slot, last 80 of buffer
  // (the Charlie-only tail of the filler = 80B of the 140B filler) drops off.
  // Layout becomes:
  //   Charlie-empty/slot | Dave slot (Dave hatch) | padding-enc (Dave) |
  //   filler-residue 60B (Bob+Charlie)
  if (step === 7) {
    // Filler region was 14% (140 bytes); after dropping 80, it should be
    // 14% * (60/140) = 6% of the bar.
    const fillerResiduePct = DISPLAY_FILLER_PCT * (60 / 140);
    return [
      {
        key: "charlie-slot",
        widthPct: DISPLAY_CHARLIE_PCT,
        kind: "slot",
        hop: "charlie",
        layers: [],
        isFocus: true,
      },
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave"],
      },
      {
        key: "pad",
        widthPct:
          fullPadPct -
          DISPLAY_CHARLIE_PCT -
          DISPLAY_DAVE_PCT -
          fillerResiduePct,
        kind: "padding-enc",
        layers: ["dave"],
      },
      {
        key: "filler-residue",
        widthPct: fillerResiduePct,
        kind: "filler",
        fillerOwners: ["bob", "charlie"],
        layers: ["bob", "charlie"],
      },
    ];
  }

  // Beat 8 - Charlie XOR: every region picks up Charlie's hatch.
  // The filler residue's Bob+Charlie already includes Charlie; we dedupe so
  // the hatch overlay doesn't draw Charlie twice.
  if (step === 8) {
    const fillerResiduePct = DISPLAY_FILLER_PCT * (60 / 140);
    return [
      {
        key: "charlie-slot",
        widthPct: DISPLAY_CHARLIE_PCT,
        kind: "slot",
        hop: "charlie",
        layers: ["charlie"],
      },
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave", "charlie"],
      },
      {
        key: "pad",
        widthPct:
          fullPadPct -
          DISPLAY_CHARLIE_PCT -
          DISPLAY_DAVE_PCT -
          fillerResiduePct,
        kind: "padding-enc",
        layers: ["dave", "charlie"],
      },
      {
        key: "filler-residue",
        widthPct: fillerResiduePct,
        kind: "filler",
        fillerOwners: ["bob", "charlie"],
        layers: ["bob", "charlie"],
      },
    ];
  }

  // Beat 9 - Charlie HMAC: same layout, HMAC chip surfaces.
  if (step === 9) {
    return regionsForBeat(8).map((r) => ({ ...r, isFocus: false }));
  }

  // Beat 10 - Bob shift+write: prepend 60-byte slot; the trailing 60B
  // filler residue drops off entirely.
  if (step === 10) {
    return [
      {
        key: "bob-slot",
        widthPct: DISPLAY_BOB_PCT,
        kind: "slot",
        hop: "bob",
        layers: [],
        isFocus: true,
      },
      {
        key: "charlie-slot",
        widthPct: DISPLAY_CHARLIE_PCT,
        kind: "slot",
        hop: "charlie",
        layers: ["charlie"],
      },
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave", "charlie"],
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_BOB_PCT - DISPLAY_CHARLIE_PCT - DISPLAY_DAVE_PCT,
        kind: "padding-enc",
        layers: ["dave", "charlie"],
      },
    ];
  }

  // Beat 11 - Bob XOR: every region picks up Bob's hatch.
  if (step === 11) {
    return [
      {
        key: "bob-slot",
        widthPct: DISPLAY_BOB_PCT,
        kind: "slot",
        hop: "bob",
        layers: ["bob"],
      },
      {
        key: "charlie-slot",
        widthPct: DISPLAY_CHARLIE_PCT,
        kind: "slot",
        hop: "charlie",
        layers: ["charlie", "bob"],
      },
      {
        key: "dave-slot",
        widthPct: DISPLAY_DAVE_PCT,
        kind: "slot",
        hop: "dave",
        layers: ["dave", "charlie", "bob"],
      },
      {
        key: "pad",
        widthPct: fullPadPct - DISPLAY_BOB_PCT - DISPLAY_CHARLIE_PCT - DISPLAY_DAVE_PCT,
        kind: "padding-enc",
        layers: ["dave", "charlie", "bob"],
      },
    ];
  }

  // Beats 12, 13 - same buffer layout as beat 11. Beat 12 surfaces bob_hmac,
  // beat 13 shows the assembled envelope.
  return regionsForBeat(11).map((r) => ({ ...r, isFocus: false }));
}

// ── Hover tooltip (matches FillerTraceDiagram convention) ─────────────────

const HOVER_TOOLTIP_WIDTH = 360;

export function HoverTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, flipped: false });
  const triggerRef = useRef<HTMLSpanElement>(null);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const halfW = HOVER_TOOLTIP_WIDTH / 2;
    let x = rect.left + rect.width / 2;
    if (x - halfW < margin) x = halfW + margin;
    if (x + halfW > window.innerWidth - margin)
      x = window.innerWidth - halfW - margin;
    // Flip below when there isn't ~100px of headroom above.
    const flipped = rect.top < 110;
    const y = flipped ? rect.bottom + 8 : rect.top - 8;
    setPos({ x, y, flipped });
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => {
          updatePos();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        style={{ borderBottom: "1px dotted #94a3b8", cursor: "help" }}
      >
        {children}
      </span>
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              transform: pos.flipped
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
              background: "#fffdf5",
              color: INK,
              fontFamily: SANS,
              fontSize: 14,
              lineHeight: 1.5,
              padding: "12px 14px",
              border: "1.5px solid #0f172a",
              borderRadius: 4,
              width: HOVER_TOOLTIP_WIDTH,
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function WrapTraceDiagram() {
  const [step, setStep] = useState(1);

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(TOTAL_BEATS, s + 1));
  const reset = () => setStep(1);

  const beat = BEATS[step - 1];
  const regions = regionsForBeat(step, beat.focus);
  const showEnvelope = step === 13;
  const beatAccent = beat.iterLabel.includes("Dave")
    ? HOP_STROKE.dave
    : beat.iterLabel.includes("Charlie")
      ? HOP_STROKE.charlie
      : beat.iterLabel.includes("Bob")
        ? HOP_STROKE.bob
        : FOCUS_GOLD;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-wrap-trace"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          Wrapping the onion, inside-out
        </span>
      </div>

      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 700, maxWidth: 840 }}>
            <HopTrack currentHop={beat.iterLabel} />

            {/* Standardized KEYS badge, top-right (operation rule). HMAC
                beats render their own labeled badge inside HmacView. */}
            {!showEnvelope && !isHmacStep(step) && <WrapKeysBadge step={step} />}

            {showEnvelope ? (
              <EnvelopeView />
            ) : step === 3 || step === 4 ? (
              <WrapMorphView step={step} />
            ) : isXorStep(step) ? (
              <XorView step={step} />
            ) : isHmacStep(step) ? (
              <HmacView step={step} />
            ) : (
              <Buffer
                regions={regions}
                focusKind={beat.focus}
                carryFrom={carryForwardLabel(step)}
              />
            )}

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
              disabled={step <= 1}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
              style={{
                opacity: step <= 1 ? 0.4 : 1,
                cursor: step <= 1 ? "not-allowed" : "pointer",
              }}
            >
              ← Back
            </button>
            <button
              onClick={next}
              disabled={step >= TOTAL_BEATS}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
              style={{
                opacity: step >= TOTAL_BEATS ? 0.4 : 1,
                cursor: step >= TOTAL_BEATS ? "not-allowed" : "pointer",
              }}
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
                    onClick={() => setStep(n)}
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

// ── Hop track ─────────────────────────────────────────────────────────────

export type HopId = "alice" | "bob" | "charlie" | "dave";
const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];
const HOP_FILL_COLOR: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: HOP_LIGHT.bob,
  charlie: HOP_LIGHT.charlie,
  dave: HOP_LIGHT.dave,
};
const HOP_STROKE_COLOR: Record<HopId, string> = {
  alice: "#b8860b",
  bob: HOP_STROKE.bob,
  charlie: HOP_STROKE.charlie,
  dave: HOP_STROKE.dave,
};
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};
const ALL_HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

export function HopTrack({
  currentHop,
  actor = "alice",
}: {
  currentHop: string;
  actor?: HopId;
}) {
  // Map iteration label to highlighted hop (if any).
  let highlight: ForwarderId | null = null;
  if (currentHop.includes("Dave")) highlight = "dave";
  else if (currentHop.includes("Charlie")) highlight = "charlie";
  else if (currentHop.includes("Bob")) highlight = "bob";

  return (
    <div className="relative mb-4" style={{ height: 72 }}>
      <div
        className="absolute"
        style={{
          top: 22,
          left: "12%",
          width: "76%",
          borderTop: "1.5px dashed #475569",
          zIndex: 0,
        }}
      />
      {HOPS.map((id) => {
        const isActor = id === actor;
        const isHighlight = id === highlight;
        const size = 44;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: 0,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
              zIndex: 1,
            }}
          >
            <div className="flex flex-col items-center">
              <div className="relative" style={{ width: size, height: size }}>
                {/* opaque underlay so the dashed backbone stays behind the node */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "#fefdfb" }}
                />
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: HOP_FILL_COLOR[id],
                    border: `2px solid ${HOP_STROKE_COLOR[id]}`,
                    boxShadow:
                      isActor || isHighlight
                        ? `0 0 0 4px rgba(184,134,11,0.30)`
                        : "none",
                    opacity: isActor || isHighlight ? 1 : 0.55,
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ fontSize: size * 0.42, color: INK }}
                  >
                    {ALL_HOP_LABEL[id].charAt(0)}
                  </span>
                </div>
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{ color: INK }}
              >
                {ALL_HOP_LABEL[id]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Buffer view ──────────────────────────────────────────────────────────

export function Buffer({
  regions,
  focusKind,
  carryFrom,
  compact = false,
}: {
  regions: Region[];
  focusKind?: FocusKind;
  /** Small "← carried from step N" tag rendered above the buffer header.
   * Signals visual continuity between beats - the gold-bordered buffer here
   * is the same running state shown in the prior beat. */
  carryFrom?: string;
  /** Render hop payloads as block+hatch (no byte cells) - used on HMAC beats. */
  compact?: boolean;
}) {
  return (
    <div className="mb-4">
      {carryFrom && (
        <div
          className="text-[9.5px] mb-1"
          style={{
            color: FOCUS_GOLD,
            fontFamily: MONO,
            letterSpacing: "0.04em",
            fontStyle: "italic",
          }}
        >
          ← {carryFrom}
        </div>
      )}
      <BufferHeader
        leftLabel="hop_payloads buffer"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                Every Sphinx packet has a fixed 1,300-byte{" "}
                <code style={{ fontFamily: MONO }}>hop_payloads</code> field.
                Wraps shift contents within this fixed boundary; bytes that fall
                off the right are lost.
              </span>
            }
          >
            1,300 bytes
          </HoverTooltip>
        }
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: FOCUS_GOLD,
          height: 78,
          boxShadow: `0 0 0 1.5px rgba(184,134,11,0.12)`,
        }}
      >
        {regions.map((r) => (
          <BufferRegion key={r.key} region={r} dimNonFocus={!!focusKind} compact={compact} />
        ))}
        {focusKind === "buffer" && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`,
            }}
          />
        )}
      </div>
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte 1,299</span>
      </div>
    </div>
  );
}

export function BufferRegion({
  region,
  dimNonFocus,
  compact = false,
}: {
  region: Region;
  dimNonFocus: boolean;
  compact?: boolean;
}) {
  const dim = dimNonFocus && !region.isFocus;
  const opacity = dim ? DIM_OPACITY : 1;

  if (region.kind === "padding-init") {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: `${region.widthPct}%`,
          background: "#fffdf5",
          opacity,
          transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
          backgroundImage:
            "repeating-linear-gradient(45deg, #94a3b833 0px, #94a3b833 1.5px, transparent 1.5px, transparent 7px)",
          boxShadow: region.isFocus
            ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`
            : undefined,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: NEUTRAL_TEXT,
            background: "rgba(255,253,245,0.85)",
            padding: "0 6px",
            letterSpacing: "0.04em",
            fontStyle: "italic",
          }}
        >
          pad-key noise
        </span>
      </div>
    );
  }

  if (region.kind === "padding-enc") {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: `${region.widthPct}%`,
          background: "#fffdf5",
          opacity,
          transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
          borderLeft: "1.5px dashed rgba(15,23,42,0.18)",
        }}
      >
        <HatchOverlay hops={region.layers} zIndex={1} stripeOpacity={0.16} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: NEUTRAL_TEXT,
            background: "rgba(255,253,245,0.85)",
            padding: "0 6px",
            letterSpacing: "0.04em",
            fontStyle: "italic",
            zIndex: 2,
            position: "relative",
          }}
        >
          padding · {region.layers.length} layer
          {region.layers.length === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  if (region.kind === "filler") {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: `${region.widthPct}%`,
          background: "#fffdf5",
          opacity,
          transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
          borderLeft: `1.5px solid ${FOCUS_GOLD}`,
          boxShadow: region.isFocus
            ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`
            : undefined,
        }}
      >
        <HatchOverlay hops={region.layers} zIndex={1} stripeOpacity={0.16} />
        {/* "what's filler?" affordance. The trailing filler explanation lives
            in a portaled, viewport-clamped Tooltip so step 5 (FILLER OVERLAY)
            can teach what these bytes are without crowding the buffer. */}
        <Tooltip
          width={320}
          label={
            <span>
              {renderCaption(
                "Remember the `filler` bytes Alice precomputed back in chapter 7? Here they are. After each forwarder XORs away its layer and shifts the buffer, these trailing bytes land *exactly* where every downstream HMAC was computed over, so each forwarder's integrity check still passes.",
              )}
            </span>
          }
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: FOCUS_GOLD,
              background: "rgba(255,253,245,0.9)",
              padding: "0 4px",
              letterSpacing: "0.06em",
              fontWeight: 700,
              textTransform: "uppercase",
              zIndex: 2,
              position: "relative",
              borderBottom: `1px dotted ${FOCUS_GOLD}`,
              cursor: "help",
            }}
          >
            filler ?
          </span>
        </Tooltip>
      </div>
    );
  }

  if (region.kind === "empty" && region.hop) {
    const stroke = HOP_STROKE[region.hop];
    return (
      <div
        className="relative flex items-center justify-center"
        style={{
          width: `${region.widthPct}%`,
          background: "#fffdf5",
          border: `1.5px dashed ${stroke}`,
          opacity,
          transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
          boxShadow: region.isFocus
            ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`
            : undefined,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: stroke,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {HOP_LABEL[region.hop]} payload
        </span>
      </div>
    );
  }

  if (region.kind === "slot" && region.hop) {
    // Compact mode (XOR / HMAC bars): a labeled block + hatch, no LEN/TLV/HMAC
    // byte cells. The byte breakdown is taught on the write-slot steps; on the
    // operation steps the point is the encryption layers (the hatch).
    if (compact) {
      const stroke = HOP_STROKE[region.hop];
      return (
        <div
          className="relative flex items-center justify-center"
          style={{
            width: `${region.widthPct}%`,
            background: HOP_LIGHT[region.hop],
            opacity,
            transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
            borderRight: `1.5px solid ${stroke}80`,
            boxShadow: region.isFocus
              ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`
              : undefined,
          }}
        >
          <HatchOverlay hops={region.layers} zIndex={1} stripeOpacity={0.16} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: stroke,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "rgba(255,253,245,0.85)",
              padding: "0 4px",
              zIndex: 2,
              position: "relative",
            }}
          >
            {HOP_LABEL[region.hop]}
          </span>
        </div>
      );
    }
    return (
      <div
        className="relative"
        style={{
          width: `${region.widthPct}%`,
          opacity,
          transition: "width 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
          boxShadow: region.isFocus
            ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`
            : undefined,
        }}
      >
        <SlotCell hop={region.hop} />
        <HatchOverlay hops={region.layers} zIndex={2} stripeOpacity={0.16} />
      </div>
    );
  }

  return null;
}

// Single hop's slot rendered with LEN | TLV | HMAC subcells. Mirrors
// WrapPrimerDiagram.SlotCell but with byte counts matched to this visual's
// 60/80/100-byte scheme.
export function SlotCell({ hop }: { hop: ForwarderId }) {
  const color = HOP_STROKE[hop];
  const fill = HOP_LIGHT[hop];
  const nextColor = NEXT_COLOR[hop];
  const slotSize =
    hop === "bob" ? BOB_SLOT : hop === "charlie" ? CHARLIE_SLOT : DAVE_SLOT;
  const tlvBytes = slotSize - 1 - 32; // bigsize byte + 32 HMAC

  return (
    // Owner-colored body so a freshly-written (or shifted) hop payload reads as
    // "this hop's payload" rather than a blank cell. The LEN/TLV/HMAC label
    // islands sit on cream on top; this fill + stroke is the owner-color frame
    // that surrounds them and shows through the gaps between sub-cells.
    <div
      className="flex h-full"
      style={{
        position: "relative",
        background: fill,
        border: `1.5px solid ${color}`,
      }}
    >
      <SlotSubCell
        section="len"
        className="flex items-center justify-center"
        style={{
          width: 32,
          flexShrink: 0,
          background: fill,
          borderRight: `1px dashed ${color}80`,
          padding: "0 2px",
          overflow: "hidden",
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            background: "#fffdf5",
            border: `1px solid ${color}55`,
            padding: "2px 3px",
            position: "relative",
            zIndex: 6,
            minWidth: 0,
          }}
        >
          <div
            className="uppercase"
            style={{
              color: NEUTRAL_TEXT,
              fontFamily: MONO,
              fontSize: 7,
              letterSpacing: "0.08em",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            LEN
          </div>
          <div
            className="font-bold whitespace-nowrap mt-0.5"
            style={{
              color,
              fontFamily: MONO,
              fontSize: 8.5,
              letterSpacing: "0.01em",
              lineHeight: 1,
            }}
          >
            {SLOT_BIGSIZE_HEX[hop]}
          </div>
        </div>
      </SlotSubCell>

      <SlotSubCell
        section="tlv"
        className="flex-1 relative flex items-center justify-center"
        style={{
          background: fill,
          minWidth: 0,
          padding: "0 4px",
          overflow: "hidden",
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            background: "#fffdf5",
            border: `1px solid ${color}55`,
            padding: "2px 3px",
            position: "relative",
            zIndex: 6,
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          <div
            className="font-bold uppercase whitespace-nowrap"
            style={{
              color,
              fontFamily: MONO,
              fontSize: 9.5,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            {HOP_LABEL[hop]}
          </div>
          <div
            className="whitespace-nowrap mt-0.5"
            style={{
              color: NEUTRAL_TEXT,
              fontFamily: MONO,
              fontSize: 7.5,
              letterSpacing: "0.02em",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            {slotSize} B
          </div>
        </div>
      </SlotSubCell>

      <SlotSubCell
        section="hmac"
        className="flex items-center justify-center"
        style={{
          width: 62,
          flexShrink: 0,
          background: fill,
          borderLeft: `1px dashed ${color}80`,
          padding: "0 2px",
          overflow: "hidden",
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            background: "#fffdf5",
            border: `1px solid ${nextColor}40`,
            padding: "2px 3px",
            position: "relative",
            zIndex: 6,
            minWidth: 0,
          }}
        >
          <div
            className="uppercase"
            style={{
              color: NEUTRAL_TEXT,
              fontFamily: MONO,
              fontSize: 7,
              letterSpacing: "0.08em",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            HMAC
          </div>
          <div
            className="font-bold whitespace-nowrap mt-0.5"
            style={{
              color: nextColor,
              fontFamily: MONO,
              fontSize: 8,
              letterSpacing: "0.01em",
              lineHeight: 1,
            }}
          >
            {NEXT_LABEL[hop]}
          </div>
        </div>
      </SlotSubCell>
    </div>
  );
}

// ── Per-hop key colors (used by the KeysAffordance hover popover below) ────
const KEY_RHO_COLOR = "#b8860b";  // gold (matches ForwarderPeelDiagram convention)
const KEY_MU_COLOR = "#3b6aa0";   // blue

// ── XOR operation view (beats 4, 8, 11) ─────────────────────────────────
//
// On XOR sub-steps, swap the single-buffer view for a 3-bar stack:
//
//   hop_payloads · BEFORE XOR     [regions with current hatch layers]
//                                       ⊕
//   chacha20(rho_i, 1300)         [uniform keystream bar with rho_i hatch]
//                                       =
//   hop_payloads · AFTER XOR      [regions with rho_i hatch added on top]
//
// Same regions as the "before" beat (step - 1) and the "after" beat (step),
// rendered in a compact ~42px tall bar. Drops the byte-axis labels since the
// X-axis is the same across all three rows.

// ── Keys affordance: the standardized KEYS badge (operation rule) ───────────
// Every beat's working keys are one hover away via the shared KeyHoverIcon,
// top-right of the stage; the badge names the key actively in use. The
// popover is the shared equation-stack KeyDerivationCard.

function keysPropsForStep(
  step: number,
): { card: KeyDerivationCardProps; activeLabel?: string } | null {
  if (step === 1) {
    return {
      card: {
        title: "Alice derives the buffer-init key",
        source: {
          name: "session_key",
          subtitle: "per-payment private key",
          accent: FOCUS_GOLD,
        },
        rows: [
          {
            formula: "HMAC('pad', session_key)",
            keyName: "pad_key",
            bytes: "32 bytes",
            useTitle: "Buffer-init key",
            useSubtitle: "fills the empty buffer with noise",
            color: FOCUS_GOLD,
            active: true,
          },
        ],
      },
      activeLabel: "pad_key",
    };
  }
  const hop: ForwarderId | null =
    step >= 2 && step <= 6
      ? "dave"
      : step >= 7 && step <= 9
        ? "charlie"
        : step >= 10 && step <= 12
          ? "bob"
          : null;
  if (!hop) return null; // step 13: envelope assembly uses only public bytes
  const initial = hop === "dave" ? "D" : hop === "charlie" ? "C" : "B";
  const ss = `ss_A${initial}`;
  const hopName = HOP_LABEL[hop];
  const rhoActive = step === 4 || step === 8 || step === 11;
  const muActive = step === 6 || step === 9 || step === 12;
  return {
    card: {
      title: `${hopName}'s iteration keys`,
      source: {
        name: ss,
        subtitle: "ECDH shared secret",
        accent: HOP_STROKE[hop],
      },
      rows: [
        {
          formula: `HMAC('rho', ${ss})`,
          keyName: `rho_${initial}`,
          bytes: "32 bytes",
          useTitle: "Stream cipher key",
          useSubtitle: "the XOR pass",
          color: KEY_RHO_COLOR,
          active: rhoActive,
        },
        {
          formula: `HMAC('mu', ${ss})`,
          keyName: `mu_${initial}`,
          bytes: "32 bytes",
          useTitle: "Packet HMAC key",
          useSubtitle: "tags the buffer",
          color: KEY_MU_COLOR,
          active: muActive,
        },
      ],
      upstream: {
        inputA: {
          name: `e_A${initial}`,
          subtitle: "Alice's ephemeral privkey",
        },
        inputB: {
          name: `${hop}_pubkey`,
          subtitle: `${hopName}'s node pubkey`,
        },
      },
    },
    activeLabel: rhoActive
      ? `rho_${initial}`
      : muActive
        ? `mu_${initial}`
        : undefined,
  };
}

function WrapKeysBadge({ step }: { step: number }) {
  const info = keysPropsForStep(step);
  if (!info) return null;
  return (
    <div className="flex justify-end mb-1">
      <KeyHoverIcon {...info.card} activeLabel={info.activeLabel} />
    </div>
  );
}

function isXorStep(step: number): boolean {
  return step === 4 || step === 8 || step === 11;
}

function isHmacStep(step: number): boolean {
  return step === 6 || step === 9 || step === 12;
}

// Small "← carries forward from step N" tag, shown above the running buffer
// on beats where the buffer state is inherited from the prior beat.
function carryForwardLabel(step: number): string | undefined {
  // Step 1 (pad-init) is the first state - nothing to carry from.
  // Step 13 (envelope) uses its own layout.
  // XOR steps label their own bars internally.
  if (step === 1 || step === 13 || isXorStep(step)) return undefined;
  return `running state · carried from step ${step - 1}`;
}

// ── Morph pilot (steps 3 & 4) ───────────────────────────────────────────────
// Both steps render THIS one component, so the bar is the *same* React element
// across the step change (reconciled by key) and animates its own height /
// opacity, rather than crossfading two separate components. Step 3 = the full
// write-state buffer; step 4 = that same bar, compacted + faded, with the rest
// of the XOR equation sliding in beneath it.
function WrapMorphView({ step }: { step: number }) {
  const isXor = step === 4;
  const beforeRegions = regionsForBeat(3, undefined).map((r) => ({ ...r, isFocus: false }));
  const afterRegions = regionsForBeat(4, undefined).map((r) => ({ ...r, isFocus: false }));

  return (
    <div>
      <div key="label">
        {isXor ? (
          <div
            className="text-[10px] uppercase tracking-[0.06em] mb-1"
            style={{ color: NEUTRAL_TEXT, fontFamily: MONO, fontWeight: 500 }}
          >
            hop_payloads · before Dave's XOR (from step 3)
          </div>
        ) : (
          <>
            <div
              className="text-[9.5px] mb-1"
              style={{ color: FOCUS_GOLD, fontFamily: MONO, letterSpacing: "0.04em", fontStyle: "italic" }}
            >
              ← running state · carried from step 2
            </div>
            <BufferHeader leftLabel="hop_payloads buffer" rightLabel="1,300 bytes" accentColor={FOCUS_GOLD} />
          </>
        )}
      </div>

      {/* The single persistent bar - same element in both steps, height animates. */}
      <MorphBox
        key="bar"
        initial={{ height: isXor ? 42 : 78, opacity: isXor ? 0.55 : 1, borderColor: isXor ? INK : FOCUS_GOLD }}
        animate={{ height: isXor ? 42 : 78, opacity: isXor ? 0.55 : 1, borderColor: isXor ? INK : FOCUS_GOLD }}
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          boxShadow: isXor ? "none" : `0 0 0 1.5px rgba(184,134,11,0.12)`,
        }}
      >
        {beforeRegions.map((r) => (
          <BufferRegion key={r.key} region={r} dimNonFocus={false} compact={isXor} />
        ))}
      </MorphBox>

      <div key="extra">
        {isXor ? (
          <MorphBox
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
          >
            <SymbolRow char="⊕" />
            <KeystreamBar hop="dave" initial="D" />
            <SymbolRow char="=" />
            <CompactBar
              label="hop_payloads · after XOR (+Dave's layer everywhere) → step 5"
              regions={afterRegions}
              accentColor={HOP_STROKE.dave}
              emphasis
              compact
            />
          </MorphBox>
        ) : (
          <div
            className="flex justify-between mt-1"
            style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
          >
            <span>byte 0</span>
            <span>byte 1,299</span>
          </div>
        )}
      </div>
    </div>
  );
}

function XorView({ step }: { step: number }) {
  const hop: ForwarderId =
    step === 4 ? "dave" : step === 8 ? "charlie" : "bob";
  const initial = hop === "dave" ? "D" : hop === "charlie" ? "C" : "B";
  const hopName = HOP_LABEL[hop];

  // "Before" = the buffer at the end of the prior beat (Dave: shift+write,
  // Charlie/Bob: shift+write). After = the current XOR beat's state.
  const beforeRegions = regionsForBeat(step - 1, undefined).map((r) => ({
    ...r,
    isFocus: false,
  }));
  const afterRegions = regionsForBeat(step, undefined).map((r) => ({
    ...r,
    isFocus: false,
  }));

  return (
    <div className="my-2">
      <CompactBar
        label={`hop_payloads · before ${hopName}'s XOR (from step ${step - 1})`}
        regions={beforeRegions}
        accentColor={NEUTRAL_TEXT}
        compact
        dim
      />
      <SymbolRow char="⊕" />
      <KeystreamBar hop={hop} initial={initial} />
      <SymbolRow char="=" />
      <CompactBar
        label={`hop_payloads · after XOR (+${hopName}'s layer everywhere) → step ${step + 1}`}
        regions={afterRegions}
        accentColor={HOP_STROKE[hop]}
        emphasis
        compact
      />
    </div>
  );
}

export function CompactBar({
  label,
  regions,
  accentColor,
  emphasis,
  compact = false,
  dim = false,
}: {
  label: string;
  regions: Region[];
  accentColor: string;
  emphasis?: boolean;
  compact?: boolean;
  dim?: boolean;
}) {
  return (
    <div style={{ opacity: dim ? 0.5 : 1, transition: "opacity 300ms ease-out" }}>
      <div
        className="text-[10px] uppercase tracking-[0.06em] mb-1"
        style={{
          color: accentColor,
          fontFamily: MONO,
          fontWeight: emphasis ? 700 : 500,
        }}
      >
        {label}
      </div>
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: emphasis ? FOCUS_GOLD : INK,
          height: 42,
          boxShadow: emphasis
            ? `0 0 0 2px rgba(184,134,11,0.18)`
            : "none",
        }}
      >
        {regions.map((r) => (
          <BufferRegion key={r.key} region={r} dimNonFocus={false} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function KeystreamBar({
  hop,
  initial,
}: {
  hop: ForwarderId;
  initial: string;
}) {
  const stroke = HOP_STROKE[hop];
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <MathLine
          text={`chacha20(rho_${initial}, 1300)`}
          color={stroke}
          fontSize={11}
        />
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ color: stroke, fontFamily: MONO, fontWeight: 700 }}
        >
          keystream
        </span>
      </div>
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: stroke,
          height: 42,
        }}
      >
        <HatchOverlay hops={[hop]} zIndex={1} stripeOpacity={0.5} />
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 2 }}
        >
          <span
            style={{
              background: "rgba(255,253,245,0.9)",
              padding: "0 8px",
            }}
          >
            <MathLine
              text={`rho_${initial}`}
              color={stroke}
              fontSize={11}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: stroke,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {" · 1,300 bytes"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SymbolRow({ char }: { char: string }) {
  return (
    <div
      className="flex justify-center items-center"
      style={{ height: 22, padding: "2px 0" }}
    >
      <span
        style={{
          fontSize: 18,
          color: INK,
          fontFamily: MONO,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {char}
      </span>
    </div>
  );
}

// ── HMAC operation view (beats 6, 9, 12) ─────────────────────────────────
//
// Distilled to ONE focal line, matching ValidationFlowDiagram's integrity
// beat. We keep the running buffer bar on top (context), then a single
// formula line, then the result chip:
//
//   [hop_payloads buffer · 1,300 bytes]   ← gold border (running state)
//        HMAC(mu_i, buffer ‖ AD) = hop_hmac
//   [hop_hmac · 32 B]                     ← gold-emphasized output chip
//
// The associated_data explanation (= payment_hash, binds the onion to one
// HTLC) moves into a hover on the `AD` token via the shared portaled
// Tooltip, so the beat reads as one operation instead of a 7-element stack.
// The key recedes to a compact KeyHoverIcon (mu_i active) top-right, per §7.

// KeyHoverIcon props for an HMAC beat: the hop's mu/rho pair from ss_Ai, with
// mu active (this beat computes the HMAC). Mirrors the shared card shape used
// across the course so the popover reads identically to other diagrams.
function hmacKeyProps(hop: ForwarderId): KeyDerivationCardProps {
  const initial = hop === "dave" ? "D" : hop === "charlie" ? "C" : "B";
  const ss = `ss_A${initial}`;
  const hopName = HOP_LABEL[hop];
  const rows: KeyDerivationRow[] = [
    {
      formula: `HMAC('mu', ${ss})`,
      keyName: `mu_${initial}`,
      bytes: "32 bytes",
      useTitle: "HMAC key",
      useSubtitle: "authenticates this iteration's buffer",
      color: KEY_MU_COLOR,
      active: true,
    },
    {
      formula: `HMAC('rho', ${ss})`,
      keyName: `rho_${initial}`,
      bytes: "32 bytes",
      useTitle: "Stream cipher key",
      useSubtitle: "encrypted the buffer (the XOR pass)",
      color: KEY_RHO_COLOR,
      active: false,
    },
  ];
  return {
    title: `${hopName}'s iteration keys`,
    source: {
      name: ss,
      subtitle: "ECDH shared secret",
      accent: HOP_STROKE[hop],
    },
    rows,
    upstream: {
      inputA: { name: `e_A${initial}`, subtitle: "Alice's ephemeral scalar" },
      inputB: { name: `${hop}_pubkey`, subtitle: `${hopName}'s static node pubkey` },
      formulaOverride: `SHA256(e_A${initial} · ${hop}_pubkey)`,
    },
  };
}

function HmacView({ step }: { step: number }) {
  const hop: ForwarderId =
    step === 6 ? "dave" : step === 9 ? "charlie" : "bob";
  const initial = hop === "dave" ? "D" : hop === "charlie" ? "C" : "B";
  const hmacName = `${hop}_hmac`;
  const isOuter = step === 12;

  // The buffer at an HMAC beat is the same regions as the prior beat
  // (HMAC doesn't change the buffer, just hashes it).
  const regions = regionsForBeat(step, undefined).map((r) => ({
    ...r,
    isFocus: false,
  }));

  return (
    <>
      {/* Compact key reminder, top-right of the operation (§7). */}
      <div className="flex justify-end mb-1">
        <KeyHoverIcon {...hmacKeyProps(hop)} activeLabel={`mu_${initial}`} />
      </div>

      <Buffer
        regions={regions}
        focusKind={undefined}
        carryFrom={carryForwardLabel(step)}
        compact
      />

      {/* ONE focal line: HMAC(mu_i, buffer ‖ AD) = hop_hmac. The AD token
          carries the associated_data explanation on hover. */}
      <div className="flex items-center justify-center gap-2.5 flex-wrap mt-3 mb-3">
        <MathLine
          text={`HMAC(mu_${initial}, buffer ‖`}
          color={HOP_STROKE[hop]}
          fontSize={13}
        />
        <Tooltip
          width={300}
          label={
            <span>
              {renderCaption(
                "So what's `AD`? It's the `associated_data`, the 32-byte `payment_hash`. Folding it into the HMAC ties this onion to one specific HTLC, so nobody can replay the packet against a different payment.",
              )}
            </span>
          }
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              color: "#5a7a2f",
              borderBottom: "1px dotted #5a7a2f",
              cursor: "help",
            }}
          >
            AD
          </span>
        </Tooltip>
        <MathLine text=")" color={HOP_STROKE[hop]} fontSize={13} />
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: NEUTRAL_TEXT }}>
          =
        </span>
        <MathLine text={hmacName} color={FOCUS_GOLD} fontSize={13} />
      </div>

      <HmacOutputChip hmacName={hmacName} hop={hop} isOuter={isOuter} />
    </>
  );
}

// Standalone associated_data input bar. No longer used by WrapTraceDiagram's
// HMAC beats (the AD explanation moved into the formula-line hover), but kept
// exported because PeelTraceDiagram renders it on its own HMAC-verify beat.
export function ADBar() {
  const adAccent = "#5a7a2f"; // muted green, distinct from any hop hatch
  return (
    <div className="mx-auto" style={{ maxWidth: 280 }}>
      <BufferHeader
        leftLabel="associated_data"
        rightLabel="32 B"
        accentColor={adAccent}
      />
      <div
        className="border-[1.5px] flex items-center justify-center"
        style={{
          background: `${adAccent}10`,
          borderColor: adAccent,
          height: 38,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: adAccent,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          payment_hash · binds onion to one HTLC
        </span>
      </div>
    </div>
  );
}

export function HmacOutputChip({
  hmacName,
  hop,
  isOuter,
}: {
  hmacName: string;
  hop: ForwarderId;
  isOuter: boolean;
}) {
  const accent = HOP_STROKE[hop];
  return (
    <div className="flex justify-center">
      <div
        className="border-[1.5px] flex flex-col items-center"
        style={{
          background: "#fef3c7",
          borderColor: FOCUS_GOLD,
          boxShadow: `0 0 0 3px rgba(184,134,11,0.18)`,
          padding: "8px 18px",
          minWidth: 180,
        }}
      >
        <span
          className="font-bold"
          style={{
            fontFamily: MONO,
            fontSize: 13,
            color: accent,
            letterSpacing: "0.02em",
            lineHeight: 1.1,
          }}
        >
          {hmacName}
        </span>
        <span
          className="text-[10px] mt-1"
          style={{
            fontFamily: SANS,
            color: NEUTRAL_TEXT,
            fontStyle: "italic",
            lineHeight: 1.1,
          }}
        >
          32 bytes
          {isOuter
            ? " · becomes the packet's outer HMAC tag"
            : ` · feeds next iteration's next_hmac`}
        </span>
      </div>
    </div>
  );
}

// ── Final envelope view (beat 13) ────────────────────────────────────────

function EnvelopeView() {
  return (
    <div className="mt-2">
      <BufferHeader
        leftLabel="onion_routing_packet (Alice → Bob)"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                The 1,366-byte Sphinx packet. Same fixed size at every hop, so
                an observer can't infer route length from the wire.
              </span>
            }
          >
            {FULL_PACKET_BYTES.toLocaleString()} bytes total
          </HoverTooltip>
        }
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: INK,
          height: 96,
        }}
      >
        {/* HEADER: version + ephemeral pubkey */}
        <div
          className="flex flex-col items-center justify-center text-center border-r-[1.5px] relative"
          style={{
            flexBasis: 112,
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 6px",
            background: `${HOP_STROKE.bob}1a`,
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight"
            style={{ fontFamily: MONO, color: INK }}
          >
            HEADER
          </span>
          <div
            style={{
              width: "60%",
              height: 1,
              background: "#0f172a30",
              marginTop: 5,
              marginBottom: 6,
            }}
          />
          <span
            className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight"
            style={{ fontFamily: MONO, color: INK }}
          >
            version
          </span>
          <span
            className="text-[11px] font-bold leading-tight mt-0.5"
            style={{ fontFamily: MONO, color: INK }}
          >
            0x00
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1.5"
            style={{ fontFamily: MONO, color: INK }}
          >
            ephemeral pubkey
          </span>
          <span
            className="font-bold leading-tight mt-0.5"
            style={{
              fontFamily: MONO,
              color: HOP_STROKE.bob,
              fontSize: 15,
            }}
          >
            E<span style={{ fontSize: 9, verticalAlign: "sub" }}>AB</span>
          </span>
        </div>

        {/* PAYLOAD AREA: render the final beat-11 buffer state */}
        <div
          className="flex relative"
          style={{
            flex: 1,
            minWidth: 0,
            boxShadow: `inset 0 0 0 2px ${FOCUS_GOLD}`,
          }}
        >
          {/* The envelope's side fields (header + outer hmac) eat ~230px of
              row width, so the hop payloads get wider display percentages
              here than in the full-width buffer rows; the padding (schematic
              anyway) absorbs the difference. Keeps LEN | TLV | HMAC readable. */}
          <BufferRegion
            region={{
              key: "bob-slot",
              widthPct: 28,
              kind: "slot",
              hop: "bob",
              layers: ["bob"],
            }}
            dimNonFocus={false}
          />
          <BufferRegion
            region={{
              key: "charlie-slot",
              widthPct: 29,
              kind: "slot",
              hop: "charlie",
              layers: ["charlie", "bob"],
            }}
            dimNonFocus={false}
          />
          <BufferRegion
            region={{
              key: "dave-slot",
              widthPct: 31,
              kind: "slot",
              hop: "dave",
              layers: ["dave", "charlie", "bob"],
            }}
            dimNonFocus={false}
          />
          <BufferRegion
            region={{
              key: "pad",
              widthPct: 12,
              kind: "padding-enc",
              layers: ["dave", "charlie", "bob"],
            }}
            dimNonFocus={false}
          />
        </div>

        {/* OUTER HMAC: bob_hmac */}
        <div
          className="flex flex-col items-center justify-center text-center border-l-[1.5px]"
          style={{
            flexBasis: 84,
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 4px",
            background: `${HOP_STROKE.bob}1a`,
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight"
            style={{ fontFamily: MONO, color: INK }}
          >
            HMAC
          </span>
          <span
            className="text-[10px] font-bold leading-tight mt-1"
            style={{ fontFamily: MONO, color: HOP_STROKE.bob }}
          >
            bob_hmac
          </span>
          <span
            className="text-[9px] font-normal opacity-60 leading-tight mt-0.5"
            style={{ fontFamily: MONO, color: INK }}
          >
            32 B
          </span>
        </div>
      </div>
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte {(FULL_PACKET_BYTES - 1).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── BufferHeader (small label strip above the buffer) ─────────────────────

export function BufferHeader({
  leftLabel,
  rightLabel,
  accentColor,
}: {
  leftLabel: ReactNode;
  rightLabel: ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{
          color: accentColor ?? NEUTRAL_TEXT,
          fontFamily: MONO,
          fontWeight: accentColor ? 700 : 500,
        }}
      >
        {leftLabel}
      </div>
      <div
        className="text-[11px]"
        style={{ color: NEUTRAL_TEXT, fontFamily: MONO }}
      >
        {rightLabel}
      </div>
    </div>
  );
}

export default WrapTraceDiagram;
