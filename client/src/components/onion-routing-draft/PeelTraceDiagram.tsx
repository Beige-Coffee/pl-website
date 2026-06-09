// ────────────────────────────────────────────────────────────────────────────
// PeelTraceDiagram
//
// Mirrors WrapTraceDiagram in voice and structure, but inverts the operation:
// Bob receives a 1,366-byte packet, derives his keys, verifies the outer
// HMAC, extends the buffer to 2,600 bytes, XORs with rho_B to strip his
// layer, reads his hop payload, lifts the next 1,300 bytes as Charlie's
// hop_payloads, advances the ephemeral pubkey, and ships to Charlie.
//
// Beats:
//   1.  Receive  — packet arrives at Bob (HopTrack animation)
//   2.  Parse    — envelope split into version | E_AB | hop_payloads | hmac
//   3.  Derive   — ss_AB → mu_B + rho_B (KeyDerivationCard)
//   4.  Verify   — HMAC(mu_B, hop_payloads ‖ AD) ?= received outer HMAC
//   5.  Extend   — append 1,300 zero bytes (buffer becomes 2,600 B)
//   6.  XOR      — chacha20(rho_B, 2,600) strips Bob's layer + reveals filler
//   7.  Read     — Bob's hop payload at the front: bigsize | TLV | next_hmac
//   8.  Lift     — slice bytes 60..1,360 as Charlie's hop_payloads
//   9.  Advance  — bf_AB = SHA256(E_AB ‖ ss_AB); E_AC = bf_AB · E_AB
//   10. Ship     — assemble + send 1,366-byte packet to Charlie
//
// Reuses primitives exported from WrapTraceDiagram (BufferRegion, SlotCell,
// BufferHeader, SymbolRow) plus the shared viewport-clamped Tooltip,
// KeyDerivationCard for the key panels, and StepCaption for the per-beat
// explanation block rendered below the visual (§1.5).
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from "react";
import { Tooltip } from "./Tooltip";
import { renderCaption } from "./captionMarkup";
import { StepCaption } from "./StepCaption";
import { MorphBox, CrossfadeSwap } from "./morph";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";
import {
  KeyDerivationCard,
  KeyHoverIcon,
  type KeyDerivationRow,
} from "./KeyDerivationCard";
import { MathLine } from "./mathTokens";
import {
  // constants
  MONO,
  SANS,
  FOCUS_GOLD,
  INK,
  NEUTRAL_TEXT,
  HOP_LIGHT,
  HOP_STROKE,
  HOP_LABEL,
  ROUTING_INFO_SIZE,
  BOB_SLOT,
  CHARLIE_SLOT,
  DAVE_SLOT,
  PACKET_PUBKEY_BYTES,
  PACKET_HMAC_BYTES,
  FULL_PACKET_BYTES,
  DISPLAY_BOB_PCT,
  DISPLAY_CHARLIE_PCT,
  DISPLAY_DAVE_PCT,
  STEP_MS,
  // components
  BufferRegion,
  BufferHeader,
  SymbolRow,
  // types
  type Beat,
  type Region,
} from "./WrapTraceDiagram";

const KEY_RHO_COLOR = "#b8860b";
const KEY_MU_COLOR = "#3b6aa0";
const ASSOC_DATA_COLOR = "#5a7a2f";
const VERIFY_GREEN = "#1f7a4a";

const TOTAL_BEATS = 10;

// Wraps the shared viewport-clamped Tooltip (Tooltip.tsx, §8) and keeps the
// dotted-underline / help-cursor affordance the old WrapTrace HoverTooltip
// carried, so the byte-count triggers still read as hoverable.
function TipText({
  label,
  width,
  children,
}: {
  label: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} width={width}>
      <span style={{ borderBottom: "1px dotted #94a3b8", cursor: "help" }}>
        {children}
      </span>
    </Tooltip>
  );
}

// Bob's view: display widths for the 2,600-byte extended buffer.
// Bob's hop payload is exaggerated for readability; the rest of the
// incoming 1,300-byte half is one opaque encrypted blob. The right half
// is the keystream extension.
const BOB_HOP_PCT_2600 = 11;
const OPAQUE_REST_PCT_2600 = 50 - BOB_HOP_PCT_2600; // 39
const KEYSTREAM_EXT_PCT_2600 = 50;

// ── Beat definitions ──────────────────────────────────────────────────────

const BEATS: Beat[] = [
  {
    step: 1,
    iterLabel: "Bob receives",
    subLabel: "RECEIVE",
    title: "Bob receives the 1,366-byte packet",
    caption:
      "Alice's outermost packet lands at Bob. Same fixed size (1,366 bytes) as every other hop will see, so an observer can't tell where Bob is in the route. The bytes are still onion-encrypted; Bob has to peel one layer to read his own instructions.",
  },
  {
    step: 2,
    iterLabel: "Bob receives",
    subLabel: "PARSE",
    title: "Parse: version || `E_AB` || `hop_payloads` || `outer_hmac`",
    caption:
      "Bob splits the wire bytes into four fields: a 1-byte version (0x00), Alice's 33-byte ephemeral pubkey `E_AB`, the 1,300-byte `hop_payloads` blob (still encrypted), and the 32-byte outer HMAC tag. The HMAC was computed by Alice over `hop_payloads ‖ payment_hash` using Bob's `mu_B` key.",
    focus: "envelope",
  } as Beat,
  {
    step: 3,
    iterLabel: "Bob peels",
    subLabel: "DERIVE",
    title: "Derive `mu_B` and `rho_B` from `ss_AB`",
    caption:
      "Bob performs ECDH between his node privkey and `E_AB` to get the same `ss_AB` Alice computed. From `ss_AB`, two HMACs produce the keys Bob needs: `mu_B = HMAC('mu', ss_AB)` for verifying the HMAC tag, and `rho_B = HMAC('rho', ss_AB)` for the 2,600-byte XOR keystream.",
  },
  {
    step: 4,
    iterLabel: "Bob peels",
    subLabel: "VERIFY",
    title: "Verify `HMAC(mu_B, hop_payloads ‖ associated_data)`",
    caption:
      "Bob recomputes `HMAC(mu_B, hop_payloads ‖ payment_hash)` and compares it byte-for-byte with the outer HMAC tag from the packet. If they don't match, Bob refuses to forward. Either someone tampered with `hop_payloads` or the onion was reattached to a different HTLC. If they match, the integrity check passes and Bob can decrypt.",
  },
  {
    step: 5,
    iterLabel: "Bob peels",
    subLabel: "EXTEND",
    title: "Extend the buffer to 2,600 bytes",
    caption:
      "Bob appends 1,300 zero bytes to the end of `hop_payloads`. This temporary buffer (encrypted half + zero tail) is exactly twice the wire size. The extension is what lets Bob's XOR generate the matching `filler` bytes for Charlie's view, the same bytes Alice precomputed at wrap time.",
    focus: "trailing",
  } as Beat,
  {
    step: 6,
    iterLabel: "Bob peels",
    subLabel: "XOR",
    title: "XOR the 2,600-byte buffer with `rho_B`'s keystream",
    caption:
      "Bob runs `chacha20(rho_B, 2600)` and XORs it over the whole buffer. The first 1,300 bytes have Bob's layer stripped. Bob's hop payload is now plaintext at the front. The last 1,300 bytes become the keystream itself (`0 ⊕ rho_B[1300:2600]`), which mathematically equals the trailing bytes Alice baked into Charlie's view at wrap time.",
  },
  {
    step: 7,
    iterLabel: "Bob peels",
    subLabel: "READ",
    title: "Read Bob's hop payload at the front",
    caption:
      "The leading bytes are now plaintext. Bob reads the bigsize length prefix (`0x3C` = 60 bytes total), parses the TLV records (`amt_to_forward`, `outgoing_cltv_value`, `short_channel_id`), then reads the 32 bytes immediately after the TLVs. Those 32 bytes are `charlie_hmac`, the HMAC tag that will go in the outer HMAC field of Bob's outgoing packet.",
    focus: "front",
  } as Beat,
  {
    step: 8,
    iterLabel: "Bob peels",
    subLabel: "LIFT",
    title: "Lift bytes 60..1,360 as Charlie's `hop_payloads`",
    caption:
      "Bob slices the next 1,300 bytes (starting right after his own hop payload) out of the extended buffer. This is Charlie's `hop_payloads` (same fixed size as what Bob received), with Charlie's encrypted hop payload at the front, then Dave's, then padding, then the 60-byte filler-shaped tail that Alice precomputed.",
    focus: "trailing",
  } as Beat,
  {
    step: 9,
    iterLabel: "Bob peels",
    subLabel: "ADVANCE",
    title: "Advance the ephemeral: `E_AC = bf_AB · E_AB`",
    caption:
      "Bob computes the blinding factor `bf_AB = SHA256(E_AB ‖ ss_AB)`, then multiplies Alice's ephemeral pubkey by it to produce `E_AC`. Charlie will combine `E_AC` with his own node privkey to ECDH the same `ss_AC` Alice used. The blinding makes each hop's published ephemeral pubkey look unrelated to the others' on the wire.",
  },
  {
    step: 10,
    iterLabel: "Ship to Charlie",
    subLabel: "ASSEMBLE",
    title: "Assemble the 1,366-byte packet and ship it",
    caption:
      "Bob assembles the outgoing packet: `0x00 || E_AC || charlie_hop_payloads || charlie_hmac`. Same fixed wire format Bob received, with the ephemeral pubkey advanced and the HMAC tag pulled from Bob's own hop payload. Bob hands the packet to Charlie over the BOLT 8 noise transport.",
    focus: "envelope",
  } as Beat,
];

// ── Region model (Bob's view) ─────────────────────────────────────────────
//
// Bob's view treats hop_payloads as an opaque encrypted blob. He doesn't
// know who's downstream or what those bytes mean — they're just "encrypted
// bytes I can't read." After XOR, only Bob's own 60-byte hop payload
// becomes plaintext; the rest stays opaque to him.
//
// We use kind="padding-enc" with a single neutral hatch ("dave" layer
// because its 0° angle reads as a generic horizontal stripe) for all
// opaque-blob regions. That gives a uniform "still encrypted" look without
// implying anything about route structure beyond Bob.

const OPAQUE_HATCH: ForwarderId[] = ["dave"];

function receiveRegions1300(focus = false): Region[] {
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

// Regions for the 2,600-byte extended view. Left 50% is the incoming
// buffer (Bob's hop payload + opaque rest); right 50% is the extension
// (zeros at beat 5, keystream output at beat 6+). We exaggerate Bob's
// hop payload width so the LEN/TLV/HMAC subcells stay readable.

function extendedRegionsAfterXor(focusSlice = false): Region[] {
  return [
    {
      key: "bob-hop-payload",
      widthPct: BOB_HOP_PCT_2600,
      kind: "slot",
      hop: "bob",
      layers: [],
    },
    {
      key: "opaque-rest",
      widthPct: OPAQUE_REST_PCT_2600,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
      isFocus: focusSlice,
    },
    {
      key: "keystream-ext",
      widthPct: KEYSTREAM_EXT_PCT_2600,
      kind: "filler",
      fillerOwners: ["bob"],
      layers: ["bob"],
      isFocus: focusSlice,
    },
  ];
}

// ── Main component ────────────────────────────────────────────────────────

export function PeelTraceDiagram() {
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
      data-testid="onion-peel-trace"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          Peeling a layer (Bob's view)
        </span>
      </div>

      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 700, maxWidth: 840 }}>
            {/* No HopTrack: Bob's view doesn't include knowledge of who's
                upstream or downstream in the route. */}
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

// ── Beat body switch ──────────────────────────────────────────────────────

function BeatBody({ step }: { step: number }) {
  if (step === 1) return <ReceiveView />;
  // Beats 2 (PARSE) and 4 (VERIFY) share the 1,300-byte hop_payloads bar.
  // Both render from ParseVerifyMorphView so that bar is the SAME React
  // element across the step change (reconciled by key) and morphs its own
  // height / border instead of jump-cutting. Beat 3 (DERIVE, the full
  // key-derivation card) sits between them as a genuinely distinct view.
  // See onion-routing-visual-standards §14 and WrapMorphView.
  if (step === 2) return <ParseVerifyMorphView step={step} />;
  // Full key-derivation card on the DERIVE beat (first introduction).
  if (step === 3) return <KeyDerivationPanel step={step} />;
  // On subsequent beats that USE the derived keys, show only the compact
  // KeyHoverIcon — top-right of the operation. Hover/click expands the
  // full card. See onion-routing-key-disclosure-pattern memory.
  if (step === 4)
    return (
      <>
        <KeyHoverBadge step={step} />
        <ParseVerifyMorphView step={step} />
      </>
    );
  // Beats 5 (EXTEND), 6 (XOR), and 8 (LIFT) share the 2,600-byte extended
  // buffer. Its role changes (standalone bar → XOR-equation operand → slice
  // source) and its tail content changes (zeros → keystream), so all three
  // render from ExtendedMorphView with ONE persistent keyed MorphBox; the
  // inner content crossfades while the box morphs. Beat 7 (READ) is a
  // distinct front-zoom view that sits between 6 and 8. See §14.
  if (step === 5) return <ExtendedMorphView step={step} />;
  if (step === 6)
    return (
      <>
        <KeyHoverBadge step={step} />
        <ExtendedMorphView step={step} />
      </>
    );
  if (step === 7) return <ReadFrontView />;
  if (step === 8) return <ExtendedMorphView step={step} />;
  if (step === 9) return <EphemeralAdvanceView />;
  if (step === 10) return <EnvelopeView mode="outgoing" />;
  return null;
}

// ── Beat 1: Receive (single solid bar, byte count only) ─────────────────

function ReceiveView() {
  return (
    <div className="mt-2">
      <BufferHeader
        leftLabel="onion_routing_packet"
        rightLabel={
          <TipText label="Fixed 1,366-byte Sphinx wire format. Same size at every hop.">
            {FULL_PACKET_BYTES.toLocaleString()} bytes
          </TipText>
        }
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex items-center justify-center relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: FOCUS_GOLD,
          boxShadow: `inset 0 0 0 2.5px ${FOCUS_GOLD}, inset 0 0 0 5px rgba(184,134,11,0.22)`,
          height: 96,
        }}
      >
        <HatchOverlay hops={OPAQUE_HATCH} zIndex={1} stripeOpacity={0.16} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 14,
            color: INK,
            background: "rgba(255,253,245,0.92)",
            padding: "6px 14px",
            letterSpacing: "0.04em",
            fontWeight: 700,
            zIndex: 2,
            position: "relative",
          }}
        >
          1,366 bytes on the wire
        </span>
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

// ── Beat 2 & 10: Envelope view (incoming or outgoing) ─────────────────────

function EnvelopeView({ mode }: { mode: "incoming" | "outgoing" }) {
  const isOutgoing = mode === "outgoing";
  const title = isOutgoing ? "outgoing packet" : "incoming packet";
  const ephemeralLabel = isOutgoing ? "E_AC" : "E_AB";
  const hmacLabel = isOutgoing ? "charlie_hmac" : "outer_hmac";
  const regions = isOutgoing ? outgoingRegions1300() : receiveRegions1300();
  return (
    <div className="mt-2">
      <PacketCard
        title={title}
        ephemeralLabel={ephemeralLabel}
        hmacLabel={hmacLabel}
        hopPayloadsRegions={regions}
        accent={HOP_STROKE.bob}
        showGoldInset
      />
    </div>
  );
}

function outgoingRegions1300(): Region[] {
  // From Bob's view, the outgoing hop_payloads is opaque — he doesn't see
  // the structure he just sliced out, just a 1,300-byte encrypted blob
  // that Charlie will peel next.
  return [
    {
      key: "outgoing-blob",
      widthPct: 100,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
    },
  ];
}

// ── Packet card: a stylized envelope with 4 fields ───────────────────────

function PacketCard({
  title,
  ephemeralLabel,
  hmacLabel,
  hopPayloadsRegions,
  accent,
  showGoldInset,
  sublabel,
}: {
  title: string;
  ephemeralLabel: string;
  hmacLabel: string;
  hopPayloadsRegions: Region[];
  accent: string;
  showGoldInset?: boolean;
  sublabel?: string;
}) {
  return (
    <div>
      <BufferHeader
        leftLabel={title}
        rightLabel={
          <TipText label="The fixed 1,366-byte Sphinx wire format. Same size at every hop, so an observer can't infer route length from the wire.">
            {FULL_PACKET_BYTES.toLocaleString()} bytes total
          </TipText>
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
            flexBasis: 130,
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 6px",
            background: `${accent}1a`,
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
              color: accent,
              fontSize: 15,
            }}
          >
            {ephemeralLabel}
          </span>
        </div>

        {/* PAYLOAD AREA */}
        <div
          className="flex relative"
          style={{
            flex: 1,
            minWidth: 0,
            boxShadow: showGoldInset ? `inset 0 0 0 2px ${FOCUS_GOLD}` : "none",
          }}
        >
          {hopPayloadsRegions.map((r) => (
            <BufferRegion key={r.key} region={r} dimNonFocus={false} />
          ))}
        </div>

        {/* OUTER HMAC */}
        <div
          className="flex flex-col items-center justify-center text-center border-l-[1.5px]"
          style={{
            flexBasis: 96,
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 4px",
            background: `${accent}1a`,
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
            style={{ fontFamily: MONO, color: accent }}
          >
            {hmacLabel}
          </span>
          <span
            className="text-[9px] font-normal opacity-60 leading-tight mt-0.5"
            style={{ fontFamily: MONO, color: INK }}
          >
            32 B
          </span>
        </div>
      </div>
      {sublabel && (
        <div
          className="text-center mt-2 text-[11px] italic"
          style={{ color: NEUTRAL_TEXT, fontFamily: SANS }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Beats 2 & 4: Parse ⟷ Verify morph (shared 1,300-byte bar) ─────────────
//
// Both beats render THIS one component, so the 1,300-byte hop_payloads bar is
// the *same* React element across the step change (reconciled by key="payload-
// bar") and animates its own height / border instead of crossfading two
// separate views. Beat 2 (PARSE) frames the bar inside the envelope (HEADER +
// payload + HMAC); beat 4 (VERIFY) collapses the HEADER/HMAC flanks, compacts
// the bar, and slides the HMAC-comparison scaffolding in beneath it. The bar's
// content is identical in both beats (one opaque encrypted blob), so the
// regions render directly (no CrossfadeSwap needed here). Mirrors WrapMorphView
// in WrapTraceDiagram; see onion-routing-visual-standards §14.

const PARSE_ACCENT = HOP_STROKE.bob;

function ParseVerifyMorphView({ step }: { step: number }) {
  const isVerify = step === 4;
  const regions = receiveRegions1300();

  return (
    <div className="mt-2">
      {/* Label block (swaps per beat). */}
      <div key="label">
        {isVerify ? (
          <div
            className="text-[10px] uppercase tracking-[0.06em] mb-1"
            style={{ color: NEUTRAL_TEXT, fontFamily: MONO, fontWeight: 500 }}
          >
            hop_payloads · 1,300 B
          </div>
        ) : (
          <BufferHeader
            leftLabel="incoming packet"
            rightLabel={
              <TipText label="The fixed 1,366-byte Sphinx wire format. Same size at every hop, so an observer can't infer route length from the wire.">
                {FULL_PACKET_BYTES.toLocaleString()} bytes total
              </TipText>
            }
            accentColor={FOCUS_GOLD}
          />
        )}
      </div>

      {/* The envelope row. The INK border lives here so it reads as the
          envelope frame on beat 2 (wrapping HEADER + payload + HMAC) and as
          the compact bar's own border on beat 4 (flanks collapsed away). */}
      <div
        key="row"
        className="border-[1.5px] flex items-stretch relative overflow-hidden"
        style={{ background: "#fffdf5", borderColor: INK }}
      >
        {/* HEADER flank (collapses on beat 4 — width AND height, so the row
            hugs the compact bar instead of stretching to the flank's full
            height and reading as a box-inside-a-box). */}
        <MorphBox
          key="header-flank"
          initial={{ flexBasis: 130, opacity: 1, height: 96 }}
          animate={{
            flexBasis: isVerify ? 0 : 130,
            opacity: isVerify ? 0 : 1,
            height: isVerify ? 0 : 96,
          }}
          className="flex flex-col items-center justify-center text-center border-r-[1.5px] relative"
          style={{
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 6px",
            background: `${PARSE_ACCENT}1a`,
            overflow: "hidden",
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight"
            style={{ fontFamily: MONO, color: INK, whiteSpace: "nowrap" }}
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
            style={{ fontFamily: MONO, color: INK, whiteSpace: "nowrap" }}
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
            style={{ fontFamily: MONO, color: INK, whiteSpace: "nowrap" }}
          >
            ephemeral pubkey
          </span>
          <span
            className="font-bold leading-tight mt-0.5"
            style={{ fontFamily: MONO, color: PARSE_ACCENT, fontSize: 15 }}
          >
            E_AB
          </span>
        </MorphBox>

        {/* The persistent 1,300-byte hop_payloads bar. Same element on both
            beats; height + gold inset morph. */}
        <MorphBox
          key="payload-bar"
          initial={{ height: 96 }}
          animate={{
            height: isVerify ? 42 : 96,
            boxShadow: isVerify ? "none" : `inset 0 0 0 2px ${FOCUS_GOLD}`,
          }}
          className="flex relative"
          style={{ flex: 1, minWidth: 0 }}
        >
          {regions.map((r) => (
            <BufferRegion key={r.key} region={r} dimNonFocus={false} />
          ))}
        </MorphBox>

        {/* OUTER HMAC flank (collapses on beat 4 — width AND height, same as
            the HEADER flank, so the row hugs the 42px bar). */}
        <MorphBox
          key="hmac-flank"
          initial={{ flexBasis: 96, opacity: 1, height: 96 }}
          animate={{
            flexBasis: isVerify ? 0 : 96,
            opacity: isVerify ? 0 : 1,
            height: isVerify ? 0 : 96,
          }}
          className="flex flex-col items-center justify-center text-center border-l-[1.5px]"
          style={{
            flexShrink: 0,
            borderColor: INK,
            padding: "8px 4px",
            background: `${PARSE_ACCENT}1a`,
            overflow: "hidden",
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
            style={{ fontFamily: MONO, color: PARSE_ACCENT, whiteSpace: "nowrap" }}
          >
            outer_hmac
          </span>
          <span
            className="text-[9px] font-normal opacity-60 leading-tight mt-0.5"
            style={{ fontFamily: MONO, color: INK }}
          >
            32 B
          </span>
        </MorphBox>
      </div>

      {/* Bottom block (swaps per beat): byte axis (parse) vs the HMAC
          comparison (verify). The verify block matches ValidationFlowDiagram's
          integrity beat and WrapTrace's HMAC beats: ONE focal compare line
          (recomputed HMAC ≟ outer_hmac) then a small green verdict, with
          associated_data folded into a hover instead of a separate AD box. */}
      <div key="extra">
        {isVerify ? (
          <MorphBox
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="mt-3"
          >
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <MathLine
                text="HMAC(mu_B, hop_payloads ‖ associated_data)"
                color={KEY_MU_COLOR}
                fontSize={14}
              />
              <span
                style={{ color: NEUTRAL_TEXT, fontSize: 18, fontWeight: 700 }}
              >
                ≟
              </span>
              <MathLine text="outer_hmac" color={NEUTRAL_TEXT} fontSize={13} />
            </div>

            {/* associated_data lives behind a hover (folded out of the stacked
                AD box). */}
            <div className="flex justify-center mt-1.5">
              <Tooltip
                width={260}
                label={renderCaption(
                  "`associated_data` = the 32-byte `payment_hash`; it binds the onion to one HTLC.",
                )}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.06em]"
                  style={{
                    fontFamily: MONO,
                    color: ASSOC_DATA_COLOR,
                    borderBottom: `1px dotted ${ASSOC_DATA_COLOR}`,
                    cursor: "help",
                    fontWeight: 700,
                  }}
                >
                  what is associated_data?
                </span>
              </Tooltip>
            </div>

            {/* Happy-path verdict: the recomputed tag matches. */}
            <div className="flex justify-center mt-2.5">
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
                  AUTHENTIC
                </span>
              </div>
            </div>
          </MorphBox>
        ) : null}
      </div>
    </div>
  );
}

// ── Beat 3: Key derivation panel ─────────────────────────────────────────

// Shared per-step key-derivation props. Beat 3 (DERIVE) renders the full
// KeyDerivationCard so the student sees the source's origin once; beats 4
// (VERIFY) and 6 (XOR) render a compact KeyHoverIcon — the full content is
// only one hover away. See onion-routing-key-disclosure-pattern memory for
// the rationale.
function keyDerivationProps(step: number) {
  const muActive = step === 3 || step === 4;
  const rhoActive = step === 3 || step === 6;

  const rows: KeyDerivationRow[] = [
    {
      formula: "HMAC('mu', ss_AB)",
      keyName: "mu_B",
      bytes: "32 bytes",
      useTitle: "HMAC key",
      useSubtitle: muActive ? "used in step 4 (verify)" : "used in step 4",
      color: KEY_MU_COLOR,
      active: muActive,
    },
    {
      formula: "HMAC('rho', ss_AB)",
      keyName: "rho_B",
      bytes: "32 bytes",
      useTitle: "Stream cipher key",
      useSubtitle: rhoActive ? "used in step 6 (XOR)" : "used in step 6",
      color: KEY_RHO_COLOR,
      active: rhoActive,
    },
  ];

  return {
    title: "Bob derives two keys from ss_AB",
    source: {
      name: "ss_AB",
      subtitle: "32-byte shared secret",
      accent: HOP_STROKE.bob,
    },
    rows,
    upstream: {
      inputA: {
        name: "bob_privkey",
        subtitle: "Bob's static node privkey",
      },
      inputB: {
        name: "E_AB",
        subtitle: "ephemeral from packet header",
      },
      formulaOverride: "SHA256(bob_privkey · E_AB)",
    },
  };
}

function KeyDerivationPanel({ step }: { step: number }) {
  return <KeyDerivationCard {...keyDerivationProps(step)} />;
}

// Compact reminder of the same keys for beats where derivation was already
// established. Renders top-right of the operation view.
function KeyHoverBadge({ step }: { step: number }) {
  return (
    <div className="flex justify-end mb-1">
      <KeyHoverIcon {...keyDerivationProps(step)} />
    </div>
  );
}

function extendedRegionsZeroTail(focusZeros = true): Region[] {
  return [
    // Incoming 1,300 bytes from Bob's view: one opaque encrypted blob.
    {
      key: "incoming-opaque",
      widthPct: 50,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
    },
    // Appended 1,300 zero bytes (fresh extension).
    {
      key: "zeros",
      widthPct: 50,
      kind: "padding-init",
      layers: [],
      isFocus: focusZeros,
    },
  ];
}

// ── Beats 5, 6 & 8: extended-buffer morph (shared 2,600-byte bar) ─────────
//
// Beats 5 (EXTEND), 6 (XOR), and 8 (LIFT) all render THIS one component, so
// the 2,600-byte extended buffer is the *same* React element across the step
// change (reconciled by key="ext-bar") and morphs its own height / border
// instead of jump-cutting between three separate views. The bar's ROLE
// changes per beat (standalone bar at 5, then "before XOR" operand at the top
// of the XOR equation at 6, then slice source at 8) and its tail content
// changes from zeros (5, 6) to the keystream/after-XOR bytes (8), so the inner
// content is wrapped in a CrossfadeSwap that crossfades on the zeros-to-
// keystream boundary
// while the box morphs. Beat 7 (READ, a front-zoom of Bob's 60-byte hop
// payload) is a genuinely distinct view that sits between 6 and 8. Mirrors
// WrapMorphView; see onion-routing-visual-standards §14.

function ExtendedMorphView({ step }: { step: number }) {
  const isXor = step === 6;
  const isLift = step === 8;

  // The persistent bar's content: zeros tail on beats 5 & 6, keystream/after
  // tail on beat 8. swapKey drives the CrossfadeSwap at that boundary.
  const phase = isLift ? "keystream" : "zeros";
  const barRegions = isLift
    ? extendedRegionsAfterXor(true)
    : extendedRegionsZeroTail();
  // Beat 5 dims the still-encrypted incoming half (focus is the zero tail);
  // beat 8 dims everything outside the slice; beat 6's "before" bar dims
  // nothing. Opacity transitions smoothly across same-phase steps (5 → 6).
  const dimNonFocus = step === 5 || isLift;

  // Box chrome morphs: beat 5 is the gold standalone bar; beats 6 & 8 are the
  // compact INK-bordered operand/source bars.
  const barHeight = step === 5 ? 46 : 42;
  const barBorder = step === 5 ? FOCUS_GOLD : INK;
  const barShadow = step === 5 ? "0 0 0 2px rgba(184,134,11,0.20)" : "none";

  return (
    <div className="my-2">
      {/* Label block (swaps per beat). */}
      <div key="label">
        {step === 5 ? (
          <BufferHeader
            leftLabel="extended buffer · 2,600 B"
            rightLabel={
              <TipText
                width={320}
                label="The extension is what lets Bob's keystream produce the matching filler bytes Alice baked into Charlie's view. Bob keeps the extended buffer in scratch memory; it never leaves his node."
              >
                2× wire size
              </TipText>
            }
            accentColor={FOCUS_GOLD}
          />
        ) : (
          <div
            className="text-[10px] uppercase tracking-[0.06em] mb-1"
            style={{ color: NEUTRAL_TEXT, fontFamily: MONO, fontWeight: 500 }}
          >
            {isXor
              ? "extended buffer · before XOR"
              : "extended buffer · 2,600 B"}
          </div>
        )}
      </div>

      {/* The single persistent 2,600-byte bar. Border / shadow animate via
          Framer; the height transitions via CSS on the inner content (it drags
          the box, which is overflow-hidden). The inner region row crossfades
          when the tail content swaps zeros ↔ keystream. */}
      <MorphBox
        key="ext-bar"
        initial={{ borderColor: barBorder }}
        animate={{ borderColor: barBorder, boxShadow: barShadow }}
        className="border-[1.5px] flex relative overflow-hidden"
        style={{ background: "#fffdf5" }}
      >
        <CrossfadeSwap swapKey={phase} className="block" style={{ width: "100%" }}>
          <div
            className="flex"
            style={{
              width: "100%",
              height: barHeight,
              transition: "height 450ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {barRegions.map((r) => (
              <BufferRegion key={r.key} region={r} dimNonFocus={dimNonFocus} />
            ))}
          </div>
        </CrossfadeSwap>

        {/* Midpoint divider at byte 1,300 (persists across all three beats). */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: "50%",
            width: 0,
            borderLeft: `1.5px dashed ${step === 5 ? FOCUS_GOLD : NEUTRAL_TEXT}`,
            opacity: step === 5 ? 0.6 : 0.4,
            zIndex: 3,
          }}
        />
      </MorphBox>

      {/* Bottom block (swaps per beat): byte axis + sublabels (extend), the
          rest of the XOR equation (XOR), or the slice bracket + result bar
          (lift). The non-standalone blocks slide in beneath the bar. */}
      <div key="extra">
        {step === 5 && (
          <div
            className="flex mt-1"
            style={{ fontFamily: MONO, fontSize: 9.5, color: NEUTRAL_TEXT }}
          >
            <span style={{ flex: 1, textAlign: "center" }}>
              incoming · still encrypted
            </span>
            <span style={{ flex: 1, textAlign: "center" }}>
              1,300 zero bytes
            </span>
          </div>
        )}

        {isXor && (
          <MorphBox
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
          >
            <SymbolRow char="⊕" />
            <KeystreamBar />
            <SymbolRow char="=" />
            <CompactExtendedBar
              label="Bob's layer stripped · his hop payload now plaintext at front"
              regions={extendedRegionsAfterXor()}
              accentColor={HOP_STROKE.bob}
              emphasis
            />
          </MorphBox>
        )}

        {isLift && (
          <MorphBox
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
          >
            <SliceArrowRow />
            <CompactBufferBar
              label="next hop_payloads · 1,300 B (slice [60 : 1,360])"
              regions={outgoingRegions1300()}
              accentColor={FOCUS_GOLD}
              emphasis
            />
          </MorphBox>
        )}
      </div>
    </div>
  );
}

// The XOR keystream operand, rendered as a full hatched bar so the peel reads
// as the canonical three-bar XOR (before ⊕ keystream = after), matching
// FillerTraceDiagram. Standards §15.
function KeystreamBar() {
  return (
    <div className="my-1">
      <div
        className="text-[10px] uppercase tracking-[0.06em] mb-1 text-center"
        style={{ color: HOP_STROKE.bob, fontFamily: MONO, fontWeight: 500 }}
      >
        keystream · 2,600 B
      </div>
      <div
        className="border-[1.5px] relative overflow-hidden flex items-center justify-center"
        style={{ background: "#fffdf5", borderColor: HOP_STROKE.bob, height: 42 }}
      >
        <HatchOverlay hops={["bob"]} zIndex={0} stripeOpacity={0.5} />
        <span
          className="relative"
          style={{ zIndex: 2, background: "#fffdf5", padding: "1px 8px" }}
        >
          <MathLine text="chacha20(rho_B, 2600)" color={HOP_STROKE.bob} fontSize={12} />
        </span>
      </div>
    </div>
  );
}

function CompactExtendedBar({
  label,
  regions,
  accentColor,
  emphasis,
  dimNonFocus = false,
}: {
  label: string;
  regions: Region[];
  accentColor: string;
  emphasis?: boolean;
  dimNonFocus?: boolean;
}) {
  return (
    <div>
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
          boxShadow: emphasis ? `0 0 0 2px rgba(184,134,11,0.18)` : "none",
        }}
      >
        {regions.map((r) => (
          <BufferRegion key={r.key} region={r} dimNonFocus={dimNonFocus} />
        ))}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: "50%",
            width: 0,
            borderLeft: `1.5px dashed ${accentColor}`,
            opacity: 0.4,
          }}
        />
      </div>
    </div>
  );
}

// Same as CompactExtendedBar but only the 1,300-byte buffer (no midpoint divider).
function CompactBufferBar({
  label,
  regions,
  accentColor,
  emphasis,
  dimNonFocus = false,
}: {
  label: string;
  regions: Region[];
  accentColor: string;
  emphasis?: boolean;
  dimNonFocus?: boolean;
}) {
  return (
    <div>
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
          boxShadow: emphasis ? `0 0 0 2px rgba(184,134,11,0.18)` : "none",
        }}
      >
        {regions.map((r) => (
          <BufferRegion key={r.key} region={r} dimNonFocus={dimNonFocus} />
        ))}
      </div>
    </div>
  );
}

// ── Beat 7: Read Bob's hop payload at the front ──────────────────────────

function ReadFrontView() {
  // Beat 6 already showed the whole buffer with Bob's layer stripped, so we
  // skip a redundant stripped bar here and go straight to the 60-byte zoom.
  return (
    <div className="my-2">
      <FrontSlotZoom />
    </div>
  );
}

function FrontSlotZoom() {
  // Zoomed-in view of Bob's 60-byte hop payload as 3 subcells:
  // bigsize LEN (1 B) | TLV records (27 B) | charlie_hmac (32 B)
  return (
    <div className="mt-2">
      <BufferHeader
        leftLabel="Bob's hop payload, now plaintext"
        rightLabel="60 bytes"
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: FOCUS_GOLD,
          boxShadow: `0 0 0 2px rgba(184,134,11,0.25)`,
          height: 70,
        }}
      >
        <SubCell
          flexBasis="60px"
          label="LEN"
          value="0x3C"
          sublabel="bigsize · 60"
          accent={HOP_STROKE.bob}
        />
        <SubCell
          flexGrow={1}
          label="TLV records"
          value="amt | cltv | scid"
          sublabel="27 bytes"
          accent={HOP_STROKE.bob}
        />
        <SubCell
          flexBasis="200px"
          label="next_hmac"
          value="charlie_hmac"
          sublabel="32 B → outer HMAC"
          accent={FOCUS_GOLD}
          emphasis
        />
      </div>
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte 59</span>
      </div>
    </div>
  );
}

function SubCell({
  flexBasis,
  flexGrow,
  label,
  value,
  sublabel,
  accent,
  emphasis,
}: {
  flexBasis?: string;
  flexGrow?: number;
  label: string;
  value: string;
  sublabel: string;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center border-r-[1.5px] last:border-r-0 relative"
      style={{
        flexBasis,
        flexGrow,
        flexShrink: 0,
        borderColor: INK,
        padding: "6px 8px",
        background: emphasis ? `${accent}22` : `${accent}10`,
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.06em] leading-tight"
        style={{ fontFamily: MONO, color: INK, opacity: 0.7 }}
      >
        {label}
      </span>
      <span
        className="font-bold leading-tight mt-0.5"
        style={{ fontFamily: MONO, fontSize: 12, color: accent }}
      >
        {value}
      </span>
      <span
        className="text-[9px] mt-0.5 leading-tight italic"
        style={{ fontFamily: SANS, color: NEUTRAL_TEXT }}
      >
        {sublabel}
      </span>
    </div>
  );
}

// ── Beat 8: Lift slice (bytes 60..1,360) as Charlie's hop_payloads ───────
// The 2,600-byte slice-source bar is the persistent MorphBox in
// ExtendedMorphView (shared with beats 5 & 6); the slice bracket + result bar
// below are this beat's own scaffolding.

function SliceArrowRow() {
  // Bracket above the bytes-60-to-1360 slice (= 1,300 bytes = 50% width
  // in the 2,600-byte view), starting just after Bob's own hop payload.
  return (
    <div
      className="relative my-2"
      style={{ height: 28, fontFamily: MONO }}
    >
      <div
        className="absolute"
        style={{
          left: `${BOB_HOP_PCT_2600}%`,
          width: `50%`,
          top: 0,
          height: 8,
          borderLeft: `1.5px solid ${FOCUS_GOLD}`,
          borderRight: `1.5px solid ${FOCUS_GOLD}`,
          borderTop: `1.5px solid ${FOCUS_GOLD}`,
        }}
      />
      <div
        className="absolute text-[10px] font-bold uppercase tracking-[0.06em]"
        style={{
          left: `${BOB_HOP_PCT_2600 + 25}%`,
          transform: "translateX(-50%)",
          top: 10,
          color: FOCUS_GOLD,
          background: "#fffdf5",
          padding: "0 6px",
        }}
      >
        slice 1,300 B ↓
      </div>
    </div>
  );
}

// ── Beat 9: Ephemeral pubkey advance ─────────────────────────────────────

// This beat is a genuine new derivation, so a card is correct (§7). But it's a
// two-stage EC pipeline — E_AB → bf_AB (blinding factor) → E_AC (point × scalar)
// — not the "shared secret → HMAC → keys" shape the shared KeyDerivationCard
// models. Its `upstream` panel also hardcodes "shared secret" / "ECDH" labels
// that would misdescribe this step. So we keep a hand-rolled card, but match
// KeyDerivationCard's chrome (accent-tinted header, round accent dot, MONO key
// chips) and keep the labels terse.
function EphemeralAdvanceView() {
  return (
    <div className="my-2">
      <div
        className="my-4 mx-auto border-[1.5px] overflow-hidden"
        style={{
          borderColor: HOP_STROKE.bob,
          background: "#fffdf5",
          maxWidth: 720,
          fontFamily: SANS,
        }}
      >
        <div
          className="px-3 py-1.5 flex items-center gap-2"
          style={{
            background: `${HOP_STROKE.bob}18`,
            borderBottom: `1.5px solid ${HOP_STROKE.bob}40`,
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: HOP_STROKE.bob }}
          />
          <span
            className="text-[10px] uppercase tracking-[0.08em] font-bold"
            style={{ fontFamily: MONO, color: HOP_STROKE.bob }}
          >
            Bob advances the ephemeral pubkey for Charlie
          </span>
        </div>

        {/* Pipeline: E_AB → (blinding factor) → E_AC. The through-line is "the
            ephemeral Bob received, blinded by bf_AB, becomes the one he hands
            forward to Charlie." Endpoint chips carry that role; the formulas
            ride the arrows. Chips match KeyDerivationCard's key chips. */}
        <div className="px-4 py-5 flex items-center justify-center flex-wrap gap-x-3 gap-y-4">
          <PipelineChip
            name="E_AB"
            note="33 B point"
            role="what Bob received"
            accent={HOP_STROKE.bob}
          />
          <PipelineArrow formula="SHA256(E_AB ‖ ss_AB)" accent={FOCUS_GOLD} />
          <PipelineChip
            name="bf_AB"
            note="32 B scalar"
            role="blinding factor"
            accent={FOCUS_GOLD}
          />
          <PipelineArrow formula="× E_AB" accent={HOP_STROKE.charlie} />
          <PipelineChip
            name="E_AC"
            note="33 B point"
            role="for Charlie · what he ECDHs against"
            accent={HOP_STROKE.charlie}
            emphasis
          />
        </div>
      </div>
    </div>
  );
}

// A MONO key chip mirroring KeyDerivationCard's chip styling: accent-tinted
// fill, accent border, the name in MathLine, a terse byte note beneath, and an
// optional role line (e.g. "what Bob received" / "for Charlie") so the
// endpoints of the pipeline read as the keys Bob got vs. hands forward.
function PipelineChip({
  name,
  note,
  role,
  accent,
  emphasis,
}: {
  name: string;
  note: string;
  role?: string;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="border-[1.5px] flex flex-col items-center"
      style={{
        background: emphasis ? "#fef3c7" : `${accent}1f`,
        borderColor: emphasis ? FOCUS_GOLD : accent,
        boxShadow: emphasis ? `0 0 0 3px rgba(184,134,11,0.18)` : "none",
        padding: "8px 18px",
        minWidth: 104,
      }}
    >
      <MathLine text={name} color={accent} fontSize={16} />
      <span
        className="text-[9px] mt-1 uppercase tracking-[0.04em]"
        style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
      >
        {note}
      </span>
      {role && (
        <span
          className="text-[9px] mt-0.5 italic leading-tight text-center"
          style={{ fontFamily: SANS, color: accent, fontWeight: 600 }}
        >
          {role}
        </span>
      )}
    </div>
  );
}

// An arrow carrying the transform that produces the next chip. The formula sits
// above the arrow shaft so it reads as the operation, not a separate box.
function PipelineArrow({
  formula,
  accent,
}: {
  formula: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 150 }}>
      <MathLine text={formula} color={accent} fontSize={11} />
      <span
        className="mt-0.5"
        style={{ fontFamily: MONO, fontSize: 18, color: accent, lineHeight: 1 }}
      >
        →
      </span>
    </div>
  );
}

export default PeelTraceDiagram;
