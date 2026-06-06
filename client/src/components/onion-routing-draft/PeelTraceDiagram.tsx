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
// Reuses primitives exported from WrapTraceDiagram (HopTrack, IterationBanner,
// BufferRegion, SlotCell, BufferHeader, SymbolRow, ADBar, KeystreamBar,
// CompactBar, HoverTooltip) plus KeyDerivationCard for the key panels.
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
  IterationBanner,
  BufferRegion,
  BufferHeader,
  SymbolRow,
  ADBar,
  HoverTooltip,
  // types
  type Beat,
  type Region,
} from "./WrapTraceDiagram";

const KEY_RHO_COLOR = "#b8860b";
const KEY_MU_COLOR = "#3b6aa0";
const ASSOC_DATA_COLOR = "#5a7a2f";
const VERIFY_GREEN = "#1f7a4a";

const TOTAL_BEATS = 10;

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
      "Bob recomputes `HMAC(mu_B, hop_payloads ‖ payment_hash)` and compares it byte-for-byte with the outer HMAC tag from the packet. If they don't match, Bob refuses to forward — either someone tampered with `hop_payloads` or the onion was reattached to a different HTLC. If they match, the integrity check passes and Bob can decrypt.",
  },
  {
    step: 5,
    iterLabel: "Bob peels",
    subLabel: "EXTEND",
    title: "Extend the buffer to 2,600 bytes",
    caption:
      "Bob appends 1,300 zero bytes to the end of `hop_payloads`. This temporary buffer (encrypted half + zero tail) is exactly twice the wire size. The extension is what lets Bob's XOR generate the matching `filler` bytes for Charlie's view — the same bytes Alice precomputed at wrap time.",
    focus: "trailing",
  } as Beat,
  {
    step: 6,
    iterLabel: "Bob peels",
    subLabel: "XOR",
    title: "XOR the 2,600-byte buffer with `rho_B`'s keystream",
    caption:
      "Bob runs `chacha20(rho_B, 2600)` and XORs it over the whole buffer. The first 1,300 bytes have Bob's layer stripped — Bob's hop payload is now plaintext at the front. The last 1,300 bytes become the keystream itself (`0 ⊕ rho_B[1300:2600]`), which mathematically equals the trailing bytes Alice baked into Charlie's view at wrap time.",
  },
  {
    step: 7,
    iterLabel: "Bob peels",
    subLabel: "READ",
    title: "Read Bob's hop payload at the front",
    caption:
      "The leading bytes are now plaintext. Bob reads the bigsize length prefix (`0x3C` = 60 bytes total), parses the TLV records (`amt_to_forward`, `outgoing_cltv_value`, `short_channel_id`), then reads the 32 bytes immediately after the TLVs. Those 32 bytes are `charlie_hmac` — the HMAC tag that will go in the outer HMAC field of Bob's outgoing packet.",
    focus: "front",
  } as Beat,
  {
    step: 8,
    iterLabel: "Bob peels",
    subLabel: "LIFT",
    title: "Lift bytes 60..1,360 as Charlie's `hop_payloads`",
    caption:
      "Bob slices the next 1,300 bytes (starting right after his own hop payload) out of the extended buffer. This is Charlie's `hop_payloads` — same fixed size as what Bob received, with Charlie's encrypted hop payload at the front, then Dave's, then padding, then the 60-byte filler-shaped tail that Alice precomputed.",
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

function strippedRegions1300(focusBob = false): Region[] {
  return [
    {
      key: "bob-hop-payload",
      widthPct: DISPLAY_BOB_PCT,
      kind: "slot",
      hop: "bob",
      layers: [],
      isFocus: focusBob,
    },
    {
      key: "opaque-rest",
      widthPct: 100 - DISPLAY_BOB_PCT,
      kind: "padding-enc",
      layers: OPAQUE_HATCH,
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
        style={{ minHeight: 460 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 700, maxWidth: 840 }}>
            {/* No HopTrack: Bob's view doesn't include knowledge of who's
                upstream or downstream in the route. */}
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

// ── Beat body switch ──────────────────────────────────────────────────────

function BeatBody({ step }: { step: number }) {
  if (step === 1) return <ReceiveView />;
  if (step === 2) return <EnvelopeView mode="incoming" />;
  // Full key-derivation card on the DERIVE beat (first introduction).
  if (step === 3) return <KeyDerivationPanel step={step} />;
  // On subsequent beats that USE the derived keys, show only the compact
  // KeyHoverIcon — top-right of the operation. Hover/click expands the
  // full card. See onion-routing-key-disclosure-pattern memory.
  if (step === 4)
    return (
      <>
        <KeyHoverBadge step={step} />
        <HmacVerifyView />
      </>
    );
  if (step === 5) return <ExtendedBufferView phase="zeros" />;
  if (step === 6)
    return (
      <>
        <KeyHoverBadge step={step} />
        <PeelXorView />
      </>
    );
  if (step === 7) return <ReadFrontView />;
  if (step === 8) return <LiftSliceView />;
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
          <HoverTooltip
            content={
              <span>
                Fixed 1,366-byte Sphinx wire format. Same size at every hop.
              </span>
            }
          >
            {FULL_PACKET_BYTES.toLocaleString()} bytes
          </HoverTooltip>
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
          <HoverTooltip
            content={
              <span>
                The fixed 1,366-byte Sphinx wire format. Same size at every
                hop, so an observer can't infer route length from the wire.
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
      <div
        className="flex justify-between mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte {(FULL_PACKET_BYTES - 1).toLocaleString()}</span>
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

// ── Beat 4: HMAC verify view ─────────────────────────────────────────────

function HmacVerifyView() {
  const regions = receiveRegions1300();
  return (
    <div className="my-2">
      <CompactBufferBar
        label="hop_payloads · 1,300 B"
        regions={regions}
        accentColor={NEUTRAL_TEXT}
      />

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
    </div>
  );
}

// ── Beat 5: Extended buffer (zeros tail) ─────────────────────────────────

function ExtendedBufferView({ phase }: { phase: "zeros" | "keystream" }) {
  const isKeystream = phase === "keystream";
  return (
    <div className="my-3">
      <BufferHeader
        leftLabel={
          isKeystream
            ? "extended buffer · 2,600 B (Bob's layer stripped, tail = filler match)"
            : "extended buffer · 2,600 B (incoming half + 1,300 zero bytes)"
        }
        rightLabel={
          <HoverTooltip
            content={
              <span>
                The extension is what lets Bob's keystream produce the matching
                `filler` bytes Alice baked into Charlie's view. Bob keeps the
                extended buffer in scratch memory; it never leaves his node.
              </span>
            }
          >
            2× wire size
          </HoverTooltip>
        }
        accentColor={FOCUS_GOLD}
      />
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: FOCUS_GOLD,
          boxShadow: `0 0 0 2px rgba(184,134,11,0.20)`,
          height: 46,
        }}
      >
        {isKeystream
          ? extendedRegionsAfterXor().map((r) => (
              <BufferRegion key={r.key} region={r} dimNonFocus={false} />
            ))
          : extendedRegionsZeroTail().map((r) => (
              <BufferRegion key={r.key} region={r} dimNonFocus={true} />
            ))}

        {/* Midpoint divider line at 50% */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: "50%",
            width: 0,
            borderLeft: `1.5px dashed ${FOCUS_GOLD}`,
            opacity: 0.6,
          }}
        />
      </div>
      <div
        className="flex mt-1"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span style={{ flex: 1 }}>byte 0</span>
        <span>byte 1,300</span>
        <span style={{ flex: 1, textAlign: "right" }}>byte 2,599</span>
      </div>
      <div
        className="flex mt-1"
        style={{ fontFamily: MONO, fontSize: 9.5, color: NEUTRAL_TEXT }}
      >
        <span style={{ flex: 1, textAlign: "center" }}>
          ← incoming hop_payloads (still encrypted) →
        </span>
        <span style={{ flex: 1, textAlign: "center" }}>
          {isKeystream
            ? "← keystream extension (filler match) →"
            : "← 1,300 zero bytes (fresh extension) →"}
        </span>
      </div>
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

// ── Beat 6: 2,600-byte XOR view ──────────────────────────────────────────

function PeelXorView() {
  return (
    <div className="my-2">
      <CompactExtendedBar
        label="extended buffer · before XOR (from step 5)"
        regions={extendedRegionsZeroTail()}
        accentColor={NEUTRAL_TEXT}
      />
      <SymbolRow char="⊕" />
      <ExtendedKeystreamBar />
      <SymbolRow char="=" />
      <CompactExtendedBar
        label="extended buffer · after XOR (Bob layer stripped; tail = filler match) → step 7"
        regions={extendedRegionsAfterXor()}
        accentColor={HOP_STROKE.bob}
        emphasis
      />
    </div>
  );
}

function ExtendedKeystreamBar() {
  const stroke = HOP_STROKE.bob;
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <MathLine text="chacha20(rho_B, 2600)" color={stroke} fontSize={11} />
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
        <HatchOverlay hops={["bob"]} zIndex={1} stripeOpacity={0.5} />
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
            <MathLine text="rho_B" color={stroke} fontSize={11} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: stroke,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {" · 2,600 bytes (extended)"}
            </span>
          </span>
        </div>
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: "50%",
            width: 0,
            borderLeft: `1.5px dashed ${stroke}`,
            opacity: 0.5,
          }}
        />
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
  const regions = strippedRegions1300(true);
  return (
    <div className="my-2">
      <CompactBufferBar
        label="hop_payloads · after XOR (Bob layer stripped)"
        regions={regions}
        accentColor={HOP_STROKE.bob}
        emphasis
      />
      <FrontSlotZoom />
    </div>
  );
}

function FrontSlotZoom() {
  // Zoomed-in view of Bob's 60-byte hop payload as 3 subcells:
  // bigsize LEN (1 B) | TLV records (27 B) | charlie_hmac (32 B)
  return (
    <div className="mt-3">
      <BufferHeader
        leftLabel="bob's hop payload · 60 bytes (now plaintext)"
        rightLabel="zoomed view"
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
          sublabel="32 bytes (goes in outer HMAC field of outgoing packet)"
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

function LiftSliceView() {
  return (
    <div className="my-2">
      <CompactExtendedBar
        label="extended buffer · 2,600 B (from step 6)"
        regions={extendedRegionsAfterXor(true)}
        accentColor={NEUTRAL_TEXT}
        dimNonFocus
      />

      <SliceArrowRow />

      <CompactBufferBar
        label="next hop_payloads · 1,300 B (slice [60 : 1,360])"
        regions={outgoingRegions1300()}
        accentColor={FOCUS_GOLD}
        emphasis
      />
    </div>
  );
}

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

        <div className="px-3 py-4 flex items-center justify-around flex-wrap gap-3">
          {/* E_AB box */}
          <KeyChip
            label="E_AB"
            sublabel="33 B · pubkey Alice put on the wire"
            accent={HOP_STROKE.bob}
          />

          <FormulaChip
            text="bf_AB = SHA256(E_AB ‖ ss_AB)"
            sublabel="blinding factor · 32 B scalar"
            accent={FOCUS_GOLD}
          />

          <ArrowGlyph />

          <FormulaChip
            text="E_AC = bf_AB · E_AB"
            sublabel="EC scalar multiplication"
            accent={HOP_STROKE.charlie}
          />

          <ArrowGlyph />

          <KeyChip
            label="E_AC"
            sublabel={`33 B · what Charlie sees on the wire`}
            accent={HOP_STROKE.charlie}
            emphasis
          />
        </div>
      </div>
    </div>
  );
}

function KeyChip({
  label,
  sublabel,
  accent,
  emphasis,
}: {
  label: string;
  sublabel: string;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="border-[1.5px] flex flex-col items-center"
      style={{
        background: emphasis ? "#fef3c7" : "#fffdf5",
        borderColor: emphasis ? FOCUS_GOLD : accent,
        boxShadow: emphasis ? `0 0 0 3px rgba(184,134,11,0.18)` : "none",
        padding: "8px 16px",
        minWidth: 110,
      }}
    >
      <MathLine text={label} color={accent} fontSize={16} />
      <span
        className="text-[9.5px] mt-1 italic"
        style={{
          fontFamily: SANS,
          color: NEUTRAL_TEXT,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {sublabel}
      </span>
    </div>
  );
}

function FormulaChip({
  text,
  sublabel,
  accent,
}: {
  text: string;
  sublabel: string;
  accent: string;
}) {
  return (
    <div
      className="border-[1.5px] flex flex-col items-center"
      style={{
        background: "#fffdf5",
        borderColor: accent,
        padding: "6px 12px",
        minWidth: 180,
      }}
    >
      <MathLine text={text} color={accent} fontSize={12} />
      <span
        className="text-[9.5px] mt-0.5 italic"
        style={{
          fontFamily: SANS,
          color: NEUTRAL_TEXT,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {sublabel}
      </span>
    </div>
  );
}

function ArrowGlyph() {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 22,
        color: NEUTRAL_TEXT,
        lineHeight: 1,
      }}
    >
      →
    </span>
  );
}

export default PeelTraceDiagram;
