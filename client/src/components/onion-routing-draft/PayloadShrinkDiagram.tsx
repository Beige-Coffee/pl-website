import { useEffect, useState } from "react";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";
import { HatchOverlay, LAYER_ANGLES, LAYER_COLORS } from "./encryptionHatch";
import { renderCaption } from "./captionMarkup";

// ────────────────────────────────────────────────────────────────────────────
// PayloadShrinkDiagram (rebuilt 2026-05-08)
//
// Companion to slice-in-packet that demonstrates what happens to the onion
// WITHOUT filler. Reuses the same OnionContainer framing (HEADER | PAYLOAD
// AREA | HMAC) with a black "ONION_ROUTING_PACKET (X → Y)" label, but the
// PAYLOAD AREA's width shrinks at each hop because each forwarder peels its
// hop payload off the front and forwards a smaller buffer.
//
// 4 beats:
//   0: Alice has the full 3-hop payload packet (about to leave Alice)
//   1: Bob has peeled his hop payload, packet is now 2 hop payloads
//   2: Charlie has peeled, packet is 1 hop payload
//   3: Dave has consumed his hop payload, packet empty
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie" | "dave";
type ForwarderId = "bob" | "charlie" | "dave";

const HOP_FILL: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};
const HOP_KEY_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const EPH_PUBKEY_TOKEN: Record<ForwarderId, string> = {
  bob: "E_AB",
  charlie: "E_AC",
  dave: "E_AD",
};

const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

interface State {
  holder: HopId;
  // Hop payloads in order from front to back of the payload area.
  hopPayloads: ForwarderId[];
  bytes: number;
  // Where the packet just came FROM (or null at step 0).
  fromHop: HopId | null;
  // The hop that received it.
  toHop: HopId;
  // The "outermost" key whose ephemeral pubkey sits in the header right now.
  outerKey: ForwarderId;
}

const STATE_BY_STEP: State[] = [
  {
    holder: "alice",
    hopPayloads: ["bob", "charlie", "dave"],
    bytes: 1366,
    fromHop: null,
    toHop: "alice",
    outerKey: "bob",
  },
  {
    holder: "bob",
    hopPayloads: ["charlie", "dave"],
    bytes: 936,
    fromHop: "alice",
    toHop: "bob",
    outerKey: "charlie",
  },
  {
    holder: "charlie",
    hopPayloads: ["dave"],
    bytes: 506,
    fromHop: "bob",
    toHop: "charlie",
    outerKey: "dave",
  },
  {
    // Dave is the destination. His hop payload is still present when the packet
    // arrives (it carries his payment_data). The packet is ~506 bytes,
    // not empty.
    holder: "dave",
    hopPayloads: ["dave"],
    bytes: 506,
    fromHop: "charlie",
    toHop: "dave",
    outerKey: "dave",
  },
];

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice prepares the packet: a 1,366-byte onion holding three encrypted hop payloads (one for Bob, one for Charlie, one for Dave) inside the 1,300-byte hop_payloads field, plus a fixed 66-byte version + ephemeral pubkey + HMAC envelope. Click play to watch the packet travel.",
  1: "Bob received the packet and decrypted his hop payload off the front. He forwards what's left to Charlie: about 936 bytes. The packet has visibly shrunk.",
  2: "Charlie does the same: peels his hop payload, forwards what's left. The packet is down to ~506 bytes, just Dave's hop payload remaining inside the envelope.",
  3: "Dave receives ~506 bytes. Inside is his own hop payload, which carries the payment_data and final amount. He decrypts it and claims the HTLC. Notice that anyone watching the wire could read the byte count at every hop and tell exactly where each forwarder sits in the route.",
};

const TOTAL_BEATS = 4;

export function PayloadShrinkDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2400);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_BEATS - 1) setStep(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  const state = STATE_BY_STEP[step];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-payload-shrink"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Without filler: packet shrinks at every hop
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 460 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 600, maxWidth: 760 }}>
            {/* Hop track */}
            <HopTrack state={state} />

            {/* Caption */}
            <div
              className="text-center text-[12px] mb-4 italic px-4 leading-relaxed"
              style={{ color: "#475569", minHeight: 40 }}
            >
              {renderCaption(STEP_CAPTIONS[step])}
            </div>

            {/* The shrinking onion packet */}
            <ShrinkingOnionContainer state={state} />

            {/* Byte/hop payload annotation */}
            <div className="text-center mt-4">
              <div
                className="inline-flex items-center gap-3 border-[1.5px] px-3 py-1.5"
                style={{
                  background: "#fffdf5",
                  borderColor: "rgba(15,23,42,0.3)",
                  fontFamily: MONO,
                  fontSize: 12,
                  letterSpacing: "0.02em",
                }}
              >
                <span style={{ color: "#475569" }}>byte count on wire:</span>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                  ~{state.bytes.toLocaleString()} B
                </span>
                <span
                  style={{
                    color: "#475569",
                    paddingLeft: 8,
                    borderLeft: "1.5px solid rgba(15,23,42,0.2)",
                  }}
                >
                  hop payloads remaining:
                </span>
                <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
                  {state.hopPayloads.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            >
              {playing
                ? "❚❚ Pause"
                : step >= TOTAL_BEATS - 1
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_BEATS }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "rgba(15,23,42,0.4)",
                    color: step === i ? "#fff" : "#0f172a",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {renderCaption(STEP_CAPTIONS[step])}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini onion packet that slides on the wire below the hop circles. Same
// visual language as MiniOnionFlyer in OperationsLifecycleDiagram and the
// TravelingPacket in slice-in-packet, with the addition that the packet's
// total width SHRINKS as hop payloads are peeled (the no-filler educational point).
function TravelingPacket({ state }: { state: State }) {
  // Width shrinks per step. Step 0 = full (110px), step 3 = remnant (28px).
  const fullBytes = STATE_BY_STEP[0].bytes;
  const widthPx =
    state.hopPayloads.length === 0
      ? 28
      : 28 + (state.bytes / fullBytes) * (110 - 28);

  // Outermost-key tint: at step 0 it's Bob, then Charlie, then Dave.
  const outerKey = state.outerKey;
  const tintColor = HOP_KEY_COLORS[outerKey];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 64,
        left: `${NODE_X_PCT[state.holder]}%`,
        transform: "translateX(-50%)",
        transition:
          "left 800ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 500ms ease-out",
        zIndex: 5,
      }}
    >
      <div
        className="border-[1.5px] flex"
        style={{
          width: widthPx,
          height: 24,
          background: "#fffdf5",
          borderColor: "#0f172a",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
          transition: "width 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      >
        {/* Mini HEADER */}
        <div
          style={{
            flexBasis: 16,
            flexShrink: 0,
            background: `${tintColor}24`,
            borderRight: "1.5px solid #0f172a",
            transition: "background 600ms ease-out",
          }}
        />
        {/* Mini PAYLOAD with stacked hatches per remaining hop payload */}
        <div
          className="relative"
          style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
        >
          {state.hopPayloads.length === 0 ? null : (
            state.hopPayloads.map((hop) => (
              <div
                key={hop}
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${LAYER_COLORS[hop]} 0px, ${LAYER_COLORS[hop]} 2.5px, transparent 2.5px, transparent 11px)`,
                }}
              />
            ))
          )}
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            flexBasis: 14,
            flexShrink: 0,
            background: `${tintColor}24`,
            borderLeft: "1.5px solid #0f172a",
            transition: "background 600ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

function HopTrack({ state }: { state: State }) {
  return (
    <div className="relative mb-4" style={{ height: 100 }}>
      {/* Backbone, aligned with the vertical middle of 48px circular nodes */}
      <div
        className="absolute"
        style={{
          top: 22,
          left: "12%",
          width: "76%",
          borderTop: "1.5px dashed #475569",
        }}
      />

      {/* Active arrow segment from previous hop to current holder. */}
      {state.fromHop && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: 18,
            left: `calc(${NODE_X_PCT[state.fromHop]}% + 28px)`,
            width: `calc(${NODE_X_PCT[state.holder] - NODE_X_PCT[state.fromHop]}% - 56px)`,
          }}
        >
          <svg
            width="100%"
            height="10"
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
          >
            <line x1="0" y1="5" x2="92" y2="5" stroke="#b8860b" strokeWidth="1.5" />
            <polygon points="100,5 90,1 90,9" fill="#b8860b" />
          </svg>
        </div>
      )}

      {/* Nodes, circular badges matching slice-in-packet's HopCircle */}
      {HOPS.map((id) => {
        const isHolder = id === state.holder;
        const size = 48;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: 0,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex flex-col items-center">
              <div
                className="rounded-full flex items-center justify-center transition-all"
                style={{
                  width: size,
                  height: size,
                  background: HOP_FILL[id],
                  border: `2px solid ${HOP_STROKE[id]}`,
                  boxShadow: isHolder
                    ? `0 0 0 4px rgba(184,134,11,0.30)`
                    : "none",
                }}
              >
                <span
                  className="font-bold"
                  style={{
                    fontSize: size * 0.4,
                    color: "#0f172a",
                  }}
                >
                  {HOP_LABEL[id].charAt(0)}
                </span>
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{ color: "#0f172a" }}
              >
                {HOP_LABEL[id]}
              </div>
            </div>
          </div>
        );
      })}

      {/* Traveling mini onion packet, slides between holders and shrinks. */}
      <TravelingPacket state={state} />
    </div>
  );
}

function ShrinkingOnionContainer({ state }: { state: State }) {
  // Compute proportional packet width so the packet visibly shrinks step
  // by step. Step 0 = full width; subsequent steps proportional to remaining
  // payload bytes vs step-0 bytes.
  const fullBytes = STATE_BY_STEP[0].bytes;
  // Reserve a minimum width so HEADER + HMAC are still readable when the
  // packet is "empty" at the destination.
  const FULL_WIDTH_PCT = 100;
  const MIN_WIDTH_PCT = 28;
  const widthPct =
    state.hopPayloads.length === 0
      ? MIN_WIDTH_PCT
      : MIN_WIDTH_PCT +
        (state.bytes / fullBytes) * (FULL_WIDTH_PCT - MIN_WIDTH_PCT);

  // Header label, "ONION_ROUTING_PACKET (X → Y)" reflecting the segment
  // the packet has just traversed. At step 0, the packet hasn't moved yet,
  // so we show "AT ALICE" instead.
  const segmentLabel = state.fromHop
    ? `${HOP_LABEL[state.fromHop]} → ${HOP_LABEL[state.holder]}`
    : `at ${HOP_LABEL[state.holder]}`;

  const outerColor = HOP_KEY_COLORS[state.outerKey];

  return (
    <div
      className="mx-auto border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
        width: `${widthPct}%`,
        transition: "width 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        overflow: "hidden",
      }}
    >
      {/* Black header showing the route segment */}
      <div
        className="bg-black text-white px-3 py-1.5 flex items-center gap-2"
        style={{ fontFamily: MONO }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "#b8860b",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.1em] font-bold whitespace-nowrap overflow-hidden"
          style={{ textOverflow: "ellipsis" }}
        >
          onion_routing_packet ({segmentLabel})
        </span>
      </div>

      {/* HEADER | PAYLOAD AREA | HMAC body */}
      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{
            background: "#fffdf5",
            borderColor: "#0f172a",
            minHeight: 110,
          }}
        >
          {/* HEADER region */}
          <div
            className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
            style={{
              flexBasis: 110,
              flexShrink: 0,
              borderColor: "#0f172a",
              color: "#0f172a",
              padding: "8px 6px",
              background: `${outerColor}24`,
              transition: "background 600ms ease-out",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight"
              style={{ fontFamily: MONO }}
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
              style={{ fontFamily: MONO }}
            >
              version
            </span>
            <span
              className="text-[11px] font-bold leading-tight mt-0.5"
              style={{ fontFamily: MONO, color: "#0f172a" }}
            >
              0x00
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1.5"
              style={{ fontFamily: MONO }}
            >
              ephemeral pubkey
            </span>
            <span
              key={state.outerKey}
              className="font-bold leading-tight mt-0.5"
              style={{
                fontFamily: MONO,
                color: outerColor,
                fontSize: 16,
                transition: "color 600ms ease-out",
              }}
            >
              <Tok token={EPH_PUBKEY_TOKEN[state.outerKey]} color={outerColor} />
            </span>
          </div>

          {/* PAYLOAD AREA */}
          <div
            className="flex flex-col"
            style={{
              flex: 1,
              padding: "8px 8px",
              minWidth: 0,
              borderRight: "1.5px solid #0f172a",
            }}
          >
            <div className="text-center mb-1.5">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontFamily: MONO }}
              >
                PAYLOAD AREA
              </div>
            </div>
            <ShrinkingPayloadInner state={state} />
          </div>

          {/* HMAC region */}
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              flexBasis: 70,
              flexShrink: 0,
              color: "#0f172a",
              padding: "8px 4px",
              background: `${outerColor}24`,
              transition: "background 600ms ease-out",
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight"
              style={{ fontFamily: MONO }}
            >
              HMAC
            </span>
            <span
              className="text-[10px] font-bold leading-tight mt-0.5"
              style={{ fontFamily: MONO, color: outerColor }}
            >
              → {HOP_LABEL[state.outerKey]}
            </span>
            <span
              className="text-[8.5px] font-normal opacity-60 leading-tight mt-0.5"
              style={{ fontFamily: MONO }}
            >
              32 B
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Per-spec hop payload internals: each hop payload is [bigsize length | TLV payload |
// 32-byte HMAC pointing to the next hop].
const NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "→ Charlie",
  charlie: "→ Dave",
  dave: "0x00…",
};
const NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: HOP_STROKE.charlie,
  charlie: HOP_STROKE.dave,
  dave: "#475569",
};

// Layered encryption hatches showing nested wrapping. Per BOLT 4 wrap order
// (innermost-first: Dave → Charlie → Bob), each slot accumulates wraps from
// the outermost hop down to its own depth:
//
//   Bob's slot     = 1 layer  (Bob's wrap only, outermost)
//   Charlie's slot = 2 layers (Bob + Charlie)
//   Dave's slot    = 3 layers (Bob + Charlie + Dave, deepest)
//
// Each slot gets its own confined overlay (no extending to the right edge),
// so the layer counts don't compound across slots. stripeOpacity is 0.10
// (vs. the spec's 0.6 default); at 1/2/3 layers that gives ~10/19/27%
// cumulative hatch visibility, keeping slot labels crisp.
function LayeredHatches({ hopPayloads }: { hopPayloads: ForwarderId[] }) {
  if (hopPayloads.length === 0) return null;
  const slotWidthPct = 100 / hopPayloads.length;
  return (
    <>
      {hopPayloads.map((hop, i) => {
        const leftPct = i * slotWidthPct;
        // Slot i has wraps from the outermost hop (index 0) down to itself.
        const layersHere = hopPayloads.slice(0, i + 1);
        return (
          <div
            key={`hatch-${hop}`}
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              left: `${leftPct}%`,
              width: `${slotWidthPct}%`,
              zIndex: 5,
            }}
          >
            <HatchOverlay hops={layersHere} zIndex={0} stripeOpacity={0.1} />
          </div>
        );
      })}
    </>
  );
}

function ShrinkingPayloadInner({ state }: { state: State }) {
  return (
    <div
      className="relative border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
        height: 64,
        overflow: "hidden",
      }}
    >
      {state.hopPayloads.length === 0 ? (
        <div
          className="absolute inset-0 flex items-center justify-center italic"
          style={{
            color: "#475569",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.02em",
          }}
        >
          consumed
        </div>
      ) : (
        <>
          <div className="flex h-full" style={{ position: "relative", zIndex: 1 }}>
            {state.hopPayloads.map((forwarder, i) => {
              const color = HOP_STROKE[forwarder];
              const fill = HOP_FILL[forwarder];
              const isLast = i === state.hopPayloads.length - 1;
              const nextColor = NEXT_HOP_COLOR[forwarder];
              return (
                <div
                  key={forwarder}
                  className="flex-1 flex"
                  style={{
                    borderRight: isLast ? "none" : `1.5px solid ${color}`,
                    minWidth: 0,
                    transition: "all 500ms ease-out",
                  }}
                >
                  {/* len sub-cell */}
                  <SlotSubCell
                    section="len"
                    style={{
                      width: 26,
                      flexShrink: 0,
                      background: fill,
                      borderRight: `1px dashed ${color}90`,
                      fontSize: 9,
                      fontFamily: MONO,
                      color: "#475569",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    len
                  </SlotSubCell>

                  {/* TLV payload sub-cell, no per-hop payload hatch; the layered
                      hatches above show the nested encryption wrapping. */}
                  <SlotSubCell
                    section="tlv"
                    className="flex-1 relative flex flex-col items-center justify-center"
                    style={{
                      background: fill,
                      minWidth: 0,
                    }}
                  >
                    <div
                      className="relative text-[10px] font-bold uppercase tracking-[0.05em]"
                      style={{ color, fontFamily: MONO }}
                    >
                      {HOP_LABEL[forwarder]}'s payload
                    </div>
                    <div
                      className="relative text-[9px] mt-0.5 opacity-70"
                      style={{ color: "#475569", fontFamily: MONO }}
                    >
                      TLV
                    </div>
                  </SlotSubCell>

                  {/* HMAC sub-cell: tinted with the slot owner's fill (matching
                      LEN + TLV) so the slot reads as one unit; the next-hop
                      pointer color lives in the inner text. */}
                  <SlotSubCell
                    section="hmac"
                    style={{
                      width: 50,
                      flexShrink: 0,
                      background: fill,
                      borderLeft: `1px dashed ${color}90`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      className="text-[8px] uppercase tracking-[0.05em]"
                      style={{ color: "#475569", fontFamily: MONO }}
                    >
                      HMAC
                    </div>
                    <div
                      className="text-[9px] font-bold"
                      style={{
                        color: nextColor,
                        fontFamily: MONO,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {NEXT_HOP_LABEL[forwarder]}
                    </div>
                  </SlotSubCell>
                </div>
              );
            })}
          </div>
          {/* Layered encryption hatches showing the nested wrapping */}
          <LayeredHatches hopPayloads={state.hopPayloads} />
        </>
      )}
    </div>
  );
}

export default PayloadShrinkDiagram;
