import { useEffect, useRef, useState } from "react";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";
import {
  LAYER_ANGLES as SHARED_LAYER_ANGLES,
  LAYER_COLORS as SHARED_LAYER_COLORS,
} from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// SliceInPacketDiagram (DRAFT)
//
// Animated chapter-5 visual showing how the HTLC + onion progresses through
// the route, hop by hop. Reinforces:
//   - The onion sits inside an HTLC (`update_add_htlc`) as one field.
//   - As the HTLC forwards, scalar fields (amount_msat, cltv_expiry) change
//     according to the decrypted slice's instructions.
//   - Slices animate through three states: encrypted → decrypted → removed.
//
// Six steps:
//   0: HTLC Alice→Bob; all 3 slices encrypted.
//   1: Bob decrypts his slice.
//   2: Bob builds new HTLC for Charlie; Bob's slice removed; new amount/cltv.
//   3: Charlie decrypts his slice.
//   4: Charlie builds new HTLC for Dave; Charlie's slice removed.
//   5: Dave decrypts the final slice; HTLC stays Charlie→Dave.
//
// Visual style follows the locked onion-routing format spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream stage (#fefdfb), 1.5px ink borders.
//   - Body sans-serif; protocol/hex values in JetBrains Mono.
//   - Per-hop colors match the canonical palette.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie" | "dave";
type ForwarderId = "bob" | "charlie" | "dave";

const HOP_LABELS: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

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

const HOP_KEY_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};

const SECRET_TOKEN: Record<ForwarderId, string> = {
  bob: "ss_AB",
  charlie: "ss_AC",
  dave: "ss_AD",
};

// Per-spec hop payload internals: each hop's hop payload ends with a 32-byte HMAC pointing
// to the *next* hop's view of hop_payloads. Bob's hop payload carries the HMAC for
// Charlie; Charlie's hop payload carries the HMAC for Dave; Dave's hop payload ends in
// 32 zero bytes (no next hop).
const NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "→ Charlie",
  charlie: "→ Dave",
  dave: "0x00…",
};
const NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: "#2d7a7a", // charlie's stroke
  charlie: "#7b4b8a", // dave's stroke
  dave: "#475569",
};

const EPH_PUBKEY_TOKEN: Record<ForwarderId, string> = {
  bob: "E_AB",
  charlie: "E_AC",
  dave: "E_AD",
};

// Column percentages for hop circles + secret tiles, matching the layout in
// SlicesRecapDiagram so the visuals read as a coherent pair.
const NODE_X_PCT: Record<HopId, number> = {
  alice: 14,
  bob: 38,
  charlie: 62,
  dave: 86,
};

interface HtlcState {
  from: HopId;
  to: HopId;
  amount: string;
  cltv: string;
}

const HTLC_BY_STEP: Record<number, HtlcState> = {
  0: { from: "alice", to: "bob", amount: "10,002,000", cltv: "220" },
  1: { from: "alice", to: "bob", amount: "10,002,000", cltv: "220" },
  2: { from: "bob", to: "charlie", amount: "10,001,000", cltv: "180" },
  3: { from: "bob", to: "charlie", amount: "10,001,000", cltv: "180" },
  4: { from: "charlie", to: "dave", amount: "10,000,000", cltv: "140" },
  5: { from: "charlie", to: "dave", amount: "10,000,000", cltv: "140" },
};

// Visibility of each encryption layer as the onion is processed:
//   - Bob's outer layer is present until Bob decrypts at step 1.
//   - Charlie's middle layer is present until Charlie decrypts at step 3.
//   - Dave's innermost layer is present until Dave decrypts at step 5.
//
// At step 0, all three layers cover the entire payload (Sphinx applies each
// hop's keystream over the full 1300 bytes, stacking layers on top of one
// another). One layer comes off at a time.
function isLayerActive(forHop: ForwarderId, step: number): boolean {
  if (forHop === "bob") return step <= 0;
  if (forHop === "charlie") return step <= 2;
  return step <= 4; // dave
}

// Slice plaintext is visible in the payload area only on the step where its
// hop just decrypted. After that step, the hop "extracts" the slice and
// forwards the rest of the buffer.
function getCurrentSliceForHop(step: number): ForwarderId | null {
  if (step === 1) return "bob";
  if (step === 3) return "charlie";
  if (step === 5) return "dave";
  return null;
}

// The "outermost" shared secret is the one that derives the layer currently
// being processed (or about to be processed). The header carries the
// ephemeral pubkey that lets the receiving hop derive this secret.
function getOutermostSecret(step: number): ForwarderId {
  if (step <= 1) return "bob";
  if (step <= 3) return "charlie";
  return "dave";
}

function isLitSecret(forHop: ForwarderId, step: number): boolean {
  return getOutermostSecret(step) === forHop;
}

function SecretTile({
  color,
  token,
  size = "sm",
  lit,
}: {
  color: string;
  token: string;
  size?: "sm" | "md";
  lit?: boolean;
}) {
  const px = size === "sm" ? 22 : 30;
  const fontSize = size === "sm" ? 11 : 14;
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        transition: "transform 400ms ease-out, filter 400ms ease-out",
        transform: lit ? "scale(1.18)" : "scale(1)",
        filter: lit ? `drop-shadow(0 0 5px ${color})` : "none",
      }}
    >
      <svg width={px} height={px} viewBox="0 0 14 14" aria-hidden>
        <rect x="1" y="3" width="6" height="6" fill={color} />
        <rect x="2" y="4" width="4" height="4" fill="#fffdf5" />
        <rect x="3" y="5" width="2" height="2" fill={color} />
        <rect x="7" y="6" width="6" height="2" fill={color} />
        <rect x="11" y="8" width="2" height="2" fill={color} />
        <rect x="9" y="8" width="2" height="2" fill={color} />
      </svg>
      <span
        className="font-bold"
        style={{
          fontSize,
          color,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}
      >
        <Tok token={token} color={color} />
      </span>
    </div>
  );
}

interface SliceContent {
  forHop: ForwarderId;
  label: string;
  plain: { label: string; value: string }[];
}

const SLICES: SliceContent[] = [
  {
    forHop: "bob",
    label: "Slice for Bob",
    plain: [
      { label: "next_hop", value: "Charlie" },
      { label: "amt_to_forward", value: "10,001,000" },
      { label: "outgoing_cltv", value: "180" },
    ],
  },
  {
    forHop: "charlie",
    label: "Slice for Charlie",
    plain: [
      { label: "next_hop", value: "Dave" },
      { label: "amt_to_forward", value: "10,000,000" },
      { label: "outgoing_cltv", value: "140" },
    ],
  },
  {
    forHop: "dave",
    label: "Slice for Dave",
    plain: [
      { label: "final_amount", value: "10,000,000" },
      { label: "final_cltv", value: "140" },
    ],
  },
];

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice ships the onion packet to Bob. The whole payload is wrapped in three layers of encryption: Bob's outermost, then Charlie's, then Dave's. All three layers cover the entire payload.",
  1: "Bob runs his shared secret. His outer layer comes off the entire payload. His slice (next_hop, amt, cltv) is now readable at the front; Charlie's and Dave's layers still cover the rest.",
  2: "Bob extracts his slice and forwards what's left. Charlie's layer is now the outermost.",
  3: "Charlie runs his shared secret. His layer peels off. His slice is readable; Dave's layer still covers the rest.",
  4: "Charlie extracts his slice and forwards what's left. Dave's layer is now the outermost.",
  5: "Dave runs his shared secret. The final layer comes off, revealing the destination details. He's the receiver.",
};

const TOTAL_STEPS = 6;
const STEP_MS = 2400;

// Encryption layer angles are pinned to the shared spec so this visual
// stays in lockstep with WrapPrimer/PeelPrimer.
const LAYER_ANGLES = SHARED_LAYER_ANGLES;

const LAYER_ORDER: ForwarderId[] = ["dave", "charlie", "bob"];

function LayeredPayloadArea({ step }: { step: number }) {
  const currentSliceFor = getCurrentSliceForHop(step);
  const currentSlice =
    currentSliceFor !== null
      ? SLICES.find((s) => s.forHop === currentSliceFor)
      : null;

  return (
    <div
      className="relative border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
        height: 96,
        overflow: "hidden",
      }}
    >
      {/* Three encryption layers, each progressively offset from the left
          so the nested wrapping is visible: Bob's hatch covers the entire
          payload area, Charlie's hatch covers from Charlie's hop payload to the
          end, Dave's hatch covers only Dave's hop payload region. */}
      {LAYER_ORDER.map((hop) => {
        const color = SHARED_LAYER_COLORS[hop];
        const angle = LAYER_ANGLES[hop];
        const visible = isLayerActive(hop, step);
        // Bob's hop payload occupies bytes 0-33%, Charlie 33-66%, Dave 66-100%.
        // Each layer's hatch starts at its hop payload's left edge.
        const leftPct = hop === "bob" ? 0 : hop === "charlie" ? 33.33 : 66.67;
        return (
          <div
            key={hop}
            className="absolute"
            style={{
              top: 0,
              bottom: 0,
              left: `${leftPct}%`,
              right: 0,
              opacity: visible ? 1 : 0,
              transition: "opacity 700ms ease-out",
            }}
            data-testid={`payload-layer-${hop}`}
          >
            <div
              className="absolute inset-0"
              style={{ background: color, opacity: 0.08 }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${angle}deg, ${color} 0px, ${color} 2.5px, transparent 2.5px, transparent 11px)`,
                opacity: 0.6,
              }}
            />
          </div>
        );
      })}

      {/* Decrypted slice with per-spec hop payload internals: [len | TLV | HMAC].
          Animates in via width + opacity when a hop peels. */}
      <div
        className="absolute top-0 bottom-0 left-0 flex"
        style={{
          width: currentSlice ? "44%" : 0,
          opacity: currentSlice ? 1 : 0,
          background: "#fffdf5",
          borderRight: currentSlice
            ? `1.5px solid ${HOP_KEY_COLORS[currentSlice.forHop]}`
            : "none",
          overflow: "hidden",
          transition: "width 700ms ease-out, opacity 500ms ease-out",
          zIndex: 10,
        }}
      >
        {currentSlice && (() => {
          const color = HOP_KEY_COLORS[currentSlice.forHop];
          const nextLabel = NEXT_HOP_LABEL[currentSlice.forHop];
          const nextColor = NEXT_HOP_COLOR[currentSlice.forHop];
          return (
            <>
              {/* len sub-cell */}
              <SlotSubCell
                section="len"
                style={{
                  width: 26,
                  flexShrink: 0,
                  background: "#fffdf5",
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

              {/* TLV payload sub-cell */}
              <SlotSubCell
                section="tlv"
                className="flex-1 flex flex-col"
                style={{ padding: "5px 7px", minWidth: 0 }}
              >
                <div
                  className="text-[9px] uppercase tracking-[0.06em] font-bold mb-0.5"
                  style={{ color, fontFamily: MONO }}
                >
                  {HOP_LABELS[currentSlice.forHop]}'s TLV
                </div>
                <div
                  className="text-[9px] leading-snug"
                  style={{ fontFamily: MONO, color: "#0f172a" }}
                >
                  {currentSlice.plain.map((p) => (
                    <div key={p.label}>
                      <span style={{ color: "#475569" }}>{p.label}:</span>{" "}
                      <span style={{ fontWeight: 700 }}>{p.value}</span>
                    </div>
                  ))}
                </div>
              </SlotSubCell>

              {/* HMAC sub-cell, next-hop HMAC */}
              <SlotSubCell
                section="hmac"
                style={{
                  width: 50,
                  flexShrink: 0,
                  background: `${nextColor}24`,
                  borderLeft: `1px dashed ${color}90`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px 2px",
                }}
              >
                <div
                  className="text-[8px] uppercase tracking-[0.05em]"
                  style={{ color: "#475569", fontFamily: MONO }}
                >
                  HMAC
                </div>
                <div
                  className="text-[9px] font-bold text-center leading-tight mt-0.5"
                  style={{
                    color: nextColor,
                    fontFamily: MONO,
                    letterSpacing: "0.02em",
                  }}
                >
                  {nextLabel}
                </div>
              </SlotSubCell>
            </>
          );
        })()}
      </div>
    </div>
  );
}

function HopCircle({
  hop,
  size = 48,
  emphasized,
}: {
  hop: HopId;
  size?: number;
  emphasized?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: HOP_FILL[hop],
          border: `2px solid ${HOP_STROKE[hop]}`,
          boxShadow: emphasized
            ? `0 0 0 4px rgba(184,134,11,0.30)`
            : "none",
          transition: "box-shadow 400ms ease-out",
        }}
      >
        <span
          className="font-bold"
          style={{
            fontSize: size * 0.4,
            color: "#0f172a",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {HOP_LABELS[hop].charAt(0)}
        </span>
      </div>
      <div
        className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
        style={{ color: "#0f172a" }}
      >
        {HOP_LABELS[hop]}
      </div>
    </div>
  );
}

// Which hop currently holds the packet at each step. The packet starts at
// Bob (step 0, just received from Alice), peels at step 1, slides to Charlie
// at step 2, peels at step 3, slides to Dave at step 4, peels at step 5.
function packetHolderAtStep(step: number): ForwarderId {
  if (step <= 1) return "bob";
  if (step <= 3) return "charlie";
  return "dave";
}

// Mini onion packet that sits on the wire below the hop circles and slides
// between holders as the step advances. Same visual language as the
// MiniOnionFlyer in OperationsLifecycleDiagram: HEADER | PAYLOAD (with
// stacked encryption-layer hatches) | HMAC, 1.5px black border, drop shadow.
// The encryption-layer count shrinks as hops peel.
function TravelingPacket({ step }: { step: number }) {
  const holder = packetHolderAtStep(step);
  // Layers visible on the traveling badge (outermost first):
  //   step 0-1: Bob, Charlie, Dave (3 layers)
  //   step 2-3: Charlie, Dave (Bob's layer was peeled at step 1)
  //   step 4-5: Dave (Charlie's layer was peeled at step 3)
  const layers: ForwarderId[] = (() => {
    if (step <= 1) return ["bob", "charlie", "dave"];
    if (step <= 3) return ["charlie", "dave"];
    return ["dave"];
  })();
  // Outermost layer drives the HEADER/HMAC tint.
  const outerKey = layers[0];
  const tintColor = HOP_KEY_COLORS[outerKey];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 78,
        left: `${NODE_X_PCT[holder]}%`,
        transform: "translateX(-50%)",
        transition: "left 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        zIndex: 5,
      }}
      data-testid="slice-in-packet-traveling"
    >
      <div
        className="border-[1.5px] flex"
        style={{
          width: 110,
          height: 26,
          background: "#fffdf5",
          borderColor: "#0f172a",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
        }}
      >
        {/* Mini HEADER */}
        <div
          style={{
            flexBasis: "14%",
            background: `${tintColor}24`,
            borderRight: "1.5px solid #0f172a",
            transition: "background 600ms ease-out",
          }}
        />
        {/* Mini PAYLOAD with stacked encryption-layer hatches */}
        <div
          className="relative"
          style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
        >
          {layers.map((hop) => (
            <div
              key={hop}
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${SHARED_LAYER_COLORS[hop]} 0px, ${SHARED_LAYER_COLORS[hop]} 2.5px, transparent 2.5px, transparent 11px)`,
                transition: "opacity 500ms ease-out",
              }}
            />
          ))}
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            flexBasis: "14%",
            background: `${tintColor}24`,
            borderLeft: "1.5px solid #0f172a",
            transition: "background 600ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

function HopTrack({ htlc, step }: { htlc: HtlcState; step: number }) {
  const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];
  return (
    <div
      className="relative mx-auto mb-2"
      style={{ height: 120, maxWidth: 700 }}
    >
      {/* Connectors. The active link (current sender → receiver) becomes a
          solid gold arrow at the same position; other links stay dashed. */}
      {[0, 1, 2].map((i) => {
        const a = HOPS[i];
        const b = HOPS[i + 1];
        const isActive = htlc.from === a && htlc.to === b;
        if (isActive) {
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                top: 18,
                left: `calc(${NODE_X_PCT[a]}% + 28px)`,
                width: `calc(${NODE_X_PCT[b] - NODE_X_PCT[a]}% - 56px)`,
              }}
            >
              <svg
                width="100%"
                height="10"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
              >
                <line
                  x1="0"
                  y1="5"
                  x2="92"
                  y2="5"
                  stroke="#b8860b"
                  strokeWidth="1.5"
                />
                <polygon points="100,5 90,1 90,9" fill="#b8860b" />
              </svg>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              top: 22,
              left: `calc(${NODE_X_PCT[a]}% + 28px)`,
              width: `calc(${NODE_X_PCT[b] - NODE_X_PCT[a]}% - 56px)`,
              borderTop: "1.5px dashed #94a3b8",
            }}
          />
        );
      })}

      {/* The traveling packet badge: slides between holders as steps advance. */}
      <TravelingPacket step={step} />

      {/* Hop circles, absolutely positioned at NODE_X_PCT for alignment with
          the secret tiles row below. */}
      {HOPS.map((h) => (
        <div
          key={h}
          className="absolute z-10"
          style={{
            top: 0,
            left: `${NODE_X_PCT[h]}%`,
            transform: "translateX(-50%)",
          }}
        >
          <HopCircle hop={h} emphasized={h === htlc.from} />
        </div>
      ))}
    </div>
  );
}

function SecretTilesRow({ step }: { step: number }) {
  return (
    <div
      className="relative mx-auto mb-4"
      style={{ height: 100, maxWidth: 700 }}
    >
      {/* Alice's stack of three: she holds every shared secret */}
      <div
        className="absolute flex flex-col items-start gap-1.5"
        style={{
          top: 0,
          left: `${NODE_X_PCT.alice}%`,
          transform: "translateX(-50%)",
          width: 110,
        }}
      >
        <SecretTile
          color={HOP_KEY_COLORS.bob}
          token={SECRET_TOKEN.bob}
          lit={isLitSecret("bob", step)}
        />
        <SecretTile
          color={HOP_KEY_COLORS.charlie}
          token={SECRET_TOKEN.charlie}
          lit={isLitSecret("charlie", step)}
        />
        <SecretTile
          color={HOP_KEY_COLORS.dave}
          token={SECRET_TOKEN.dave}
          lit={isLitSecret("dave", step)}
        />
      </div>

      {/* Each forwarder holds one matching secret */}
      {(["bob", "charlie", "dave"] as ForwarderId[]).map((h) => (
        <div
          key={h}
          className="absolute"
          style={{
            top: 4,
            left: `${NODE_X_PCT[h]}%`,
            transform: "translateX(-50%)",
          }}
        >
          <SecretTile
            color={HOP_KEY_COLORS[h]}
            token={SECRET_TOKEN[h]}
            lit={isLitSecret(h, step)}
          />
        </div>
      ))}
    </div>
  );
}

function OnionContainer({ htlc, step }: { htlc: HtlcState; step: number }) {
  return (
    <div
      className="border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
      }}
    >
      {/* Black header showing where the onion currently sits */}
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
          }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.1em] font-bold"
          key={`${htlc.from}-${htlc.to}`}
        >
          onion_routing_packet ({HOP_LABELS[htlc.from]} → {HOP_LABELS[htlc.to]})
        </span>
      </div>

      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{
            background: "#fffdf5",
            borderColor: "#0f172a",
          }}
        >
          {/* HEADER region. Highlighted with the color of the current
              outermost shared secret that the receiving hop will derive
              from the ephemeral pubkey. */}
          {(() => {
            const outerSecret = getOutermostSecret(step);
            const color = HOP_KEY_COLORS[outerSecret];
            return (
              <div
                className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
                style={{
                  flexBasis: "16%",
                  borderColor: "#0f172a",
                  color: "#0f172a",
                  padding: "8px 6px",
                  minWidth: 0,
                  background: `${color}24`,
                  transition: "background 600ms ease-out",
                }}
              >
                {/* Section label */}
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
                  style={{ fontFamily: MONO }}
                >
                  HEADER
                </span>

                {/* Subtle divider */}
                <div
                  style={{
                    width: "60%",
                    height: 1,
                    background: "#0f172a30",
                    marginTop: 5,
                    marginBottom: 7,
                  }}
                />

                {/* Version field */}
                <span
                  className="text-[10px] uppercase tracking-[0.05em] opacity-70 leading-tight"
                  style={{ fontFamily: MONO }}
                >
                  version
                </span>
                <span
                  className="text-[12px] font-bold leading-tight mt-0.5"
                  style={{ fontFamily: MONO, color: "#0f172a" }}
                >
                  0x00
                </span>

                {/* Ephemeral pubkey field */}
                <span
                  className="text-[10px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-2"
                  style={{ fontFamily: MONO }}
                >
                  ephemeral pubkey
                </span>
                <span
                  key={outerSecret}
                  className="font-bold leading-tight mt-0.5"
                  style={{
                    fontFamily: MONO,
                    color,
                    fontSize: 18,
                    transition: "color 600ms ease-out",
                  }}
                >
                  <Tok token={EPH_PUBKEY_TOKEN[outerSecret]} color={color} />
                </span>
              </div>
            );
          })()}

          {/* PAYLOAD AREA region with the slice cells */}
          <div
            className="flex flex-col border-r-[1.5px]"
            style={{
              flex: 1,
              borderColor: "#0f172a",
              color: "#0f172a",
              padding: "8px 8px",
              minWidth: 0,
            }}
          >
            <div className="text-center mb-1.5">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontFamily: MONO }}
              >
                PAYLOAD AREA
              </div>
            </div>
            <LayeredPayloadArea step={step} />
          </div>

          {/* HMAC region. Tinted with the same outermost-secret color as
              HEADER, since the HMAC is also recomputed per hop with that
              hop's mu key. */}
          {(() => {
            const outerSecret = getOutermostSecret(step);
            const color = HOP_KEY_COLORS[outerSecret];
            return (
              <div
                className="flex flex-col items-center justify-center text-center border-l-[1.5px]"
                style={{
                  flexBasis: "12%",
                  color: "#0f172a",
                  padding: "8px 4px",
                  minWidth: 0,
                  borderColor: "#0f172a",
                  background: `${color}24`,
                  transition: "background 600ms ease-out",
                }}
              >
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.06em] leading-tight"
                  style={{ fontFamily: MONO }}
                >
                  HMAC
                </span>
                <span
                  className="text-[10px] font-bold leading-tight mt-0.5"
                  style={{ fontFamily: MONO, color }}
                >
                  → {HOP_LABELS[outerSecret]}
                </span>
                <span
                  className="text-[9px] font-normal opacity-60 leading-tight mt-0.5"
                  style={{ fontFamily: MONO }}
                >
                  32 B
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export function SliceInPacketDiagram() {
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
    }, STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  function play() {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  }
  function pause() {
    setPlaying(false);
  }
  function reset() {
    setPlaying(false);
    setStep(0);
  }

  const htlc = HTLC_BY_STEP[step];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="slice-in-packet"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            The onion packet, hop by hop
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 540 }}
      >
        <div className="overflow-x-auto" style={{ paddingTop: 6 }}>
          <div className="mx-auto" style={{ minWidth: 600, maxWidth: 760 }}>
            <HopTrack htlc={htlc} step={step} />
            <SecretTilesRow step={step} />

            {/* Caption */}
            <div
              className="text-center text-[12px] mb-4 italic px-4 leading-relaxed"
              style={{ color: "#475569", minHeight: 48 }}
            >
              {STEP_CAPTIONS[step]}
            </div>

            <OnionContainer htlc={htlc} step={step} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            {playing ? (
              <button
                onClick={pause}
                className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                data-testid="slice-in-packet-pause"
              >
                ❚❚ Pause
              </button>
            ) : (
              <button
                onClick={play}
                className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                data-testid="slice-in-packet-play"
              >
                ▶ Play
              </button>
            )}
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              data-testid="slice-in-packet-reset"
            >
              Reset
            </button>
          </div>
          <div className="flex gap-1 items-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
                className="border-[1.5px] text-[11px] font-bold transition-colors"
                style={{
                  width: 26,
                  height: 26,
                  borderColor: i === step ? "#b8860b" : "#0f172a",
                  background: i === step ? "#b8860b" : "transparent",
                  color: i === step ? "#fffdf5" : "#0f172a",
                  fontFamily: MONO,
                  cursor: "pointer",
                }}
                aria-label={`Step ${i + 1}`}
                data-testid={`slice-in-packet-step-${i}`}
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

export default SliceInPacketDiagram;
