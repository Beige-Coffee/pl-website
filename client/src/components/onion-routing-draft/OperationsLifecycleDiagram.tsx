import { useState } from "react";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";
import { MorphBox, CrossfadeSwap } from "./morph";
import { StepCaption } from "./StepCaption";
import { KeyHoverIcon, type KeyDerivationCardProps } from "./KeyDerivationCard";
import { LAYER_ANGLES, LAYER_COLORS, type ForwarderId } from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// OperationsLifecycleDiagram (DRAFT)
//
// Walks through the five cryptographic jobs the onion construction needs by
// staging them as an Alice → Bob roundtrip. Uses the same Sphinx packet
// visualization as SliceInPacketDiagram (HEADER | PAYLOAD AREA with stacked
// encryption layers | HMAC) so the depth and accuracy carry over. The 4-hop
// route Alice → Bob → Charlie → Dave is shown for context, with Alice and
// Bob sized larger because this story focuses on their interaction; Charlie
// and Dave are shown smaller to the side as part of the ongoing route.
//
// Five steps:
//   1. Alice initializes the empty buffer.
//   2. Alice encrypts the forward payload (and attaches the forward MAC).
//   3. Bob authenticates the forward packet on receipt.
//   4. Bob authenticates a return error after a downstream failure.
//   5. Bob encrypts the return error.
//
// Per the user's framing, the focus is on the *operations*. Keys (rho/mu/etc.)
// haven't been named yet at this point in the chapter. Operation badges are
// color-coded so that when the keys are introduced shortly after, students
// can mentally map colors to keys.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie" | "dave";

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

// LAYER_ANGLES / LAYER_COLORS are imported from the shared encryptionHatch
// module so the encryption hatches read as the *same* layers across all the
// chapter visuals.

// Per-spec hop payload internals: each hop's hop payload ends with a 32-byte HMAC pointing
// to the *next* hop's view of hop_payloads.
const NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "for Charlie",
  charlie: "for Dave",
  dave: "none",
};
// Per-hop payload size (bytes) shown on the payload cell. Canonical 60/80/100.
const HOP_PAYLOAD_BYTES: Record<ForwarderId, number> = {
  bob: 60,
  charlie: 80,
  dave: 100,
};
// BigSize LEN prefix shown in the len sub-cell. The length encoded is the
// TLV-payload size (payload total minus the 1-byte bigsize prefix and the
// 32-byte HMAC), so the canonical 60/80/100-byte hop payloads encode
// size-33 = 27/47/67 = 0x1B/0x2F/0x43.
const HOP_LEN_BIGSIZE: Record<ForwarderId, string> = {
  bob: "0x1B",
  charlie: "0x2F",
  dave: "0x43",
};
const NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: LAYER_COLORS.charlie,
  charlie: LAYER_COLORS.dave,
  dave: "#475569",
};

const ERROR_COLOR = "#a13a3a";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Render a caption string with backtick-quoted segments styled as inline
// code chips (monospace, light background, subtle border). Matches
// PeelPrimer's `renderCaptionWithCode` so captions across the chapter
// pick up the same code styling for protocol identifiers.
function renderCaptionWithCode(text: string) {
  const parts = text.split(/(`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={i}
          style={{
            fontFamily: MONO,
            background: "#f1f5f9",
            border: "1px solid rgba(15,23,42,0.14)",
            padding: "0px 5px",
            fontSize: "0.92em",
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Build the shared KeyHoverIcon's KeyDerivationCard props for the active
// step's key, so the key chip's hover affordance is the canonical
// equation-stack card (not a bespoke tooltip).
function keyRoleTitle(keyName: string): string {
  switch (keyName) {
    case "rho":
      return "Stream cipher key";
    case "mu":
      return "Integrity HMAC key";
    case "um":
      return "Error HMAC key";
    case "ammag":
      return "Error stream key";
    default:
      return "Per-hop key";
  }
}

function keyCardPropsFor(
  keyName: string,
  keyToken: string,
  keyColor: string,
): KeyDerivationCardProps {
  if (keyName === "pad") {
    return {
      title: "How pad is derived",
      source: {
        name: "session_key",
        subtitle: "random 32-byte secret per payment",
        accent: "#7b4b8a",
      },
      rows: [
        {
          formula: 'HMAC("pad", session_key)',
          keyName: keyToken,
          bytes: "32 bytes",
          useTitle: "Filler-init key",
          color: keyColor,
          active: true,
        },
      ],
    };
  }
  return {
    title: `How ${keyName} is derived`,
    source: {
      name: "ss_AB",
      subtitle: "Alice and Bob's ECDH shared secret",
      accent: "#b8860b",
    },
    upstream: {
      inputA: { name: "e_AB", subtitle: "Alice's session key" },
      inputB: { name: "B", subtitle: "Bob's node pubkey" },
      formulaOverride: "SHA256(e_AB · B)",
    },
    rows: [
      {
        formula: `HMAC("${keyName}", ss_AB)`,
        keyName: keyToken,
        bytes: "32 bytes",
        useTitle: keyRoleTitle(keyName),
        color: keyColor,
        active: true,
      },
    ],
  };
}

// Single accent color shared by all 5 operation badges and the focus-ring on
// whichever packet region is the focal point of each step. Neutral slate so
// it doesn't read as "warning" the way a red/orange would, and so it stays
// distinct from the four hop colors (gold/blue/teal/violet) and from
// ERROR_COLOR (red, used only for actual error packets).
const ACCENT_COLOR = "#475569";

interface StepState {
  position: HopId;
  packetType: "forward" | "error";
  bytesVisible: boolean;
  forwardLayersVisible: boolean;
  errorLayerVisible: boolean;
  hasTag: boolean;
  verified: boolean;
  failureNote: boolean;
  forwardArrow: boolean; // alice → bob
  returnArrow: boolean; // bob → alice
  badgeColor: string;
  badgeLabel: string;
  // Unkeyed caption: shown in the first instance (`<operations-lifecycle>`),
  // before any of the five named keys have been introduced. Stays key-free
  // so the visual focuses on the *operations* themselves.
  caption: string;
  // Keyed caption: shown in the second instance (`<operations-lifecycle-keyed>`),
  // after the five keys are derived. Explicitly names the per-hop key driving
  // each operation so students see operation→key mapping.
  keyedCaption: string;
  activeHop: HopId;
  // The packet region that's the focus of this step. Other regions render
  // at lower opacity so the eye is drawn to the operation in motion.
  focus: "header" | "payload" | "hmac";
  // The cryptographic key that handles this operation. Surfaced only when
  // the diagram is rendered with `showKeys={true}`.
  keyName: string;
  keyToken: string; // BOLT-4-style token for the per-hop key, e.g. "rho_AB"
  keyColor: string; // canonical 5-key palette color
}

const STEPS: StepState[] = [
  {
    position: "alice",
    packetType: "forward",
    bytesVisible: true,
    forwardLayersVisible: false,
    errorLayerVisible: false,
    hasTag: false,
    verified: false,
    failureNote: false,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Initialize the empty buffer",
    caption:
      "First, before anything else, Alice fills the empty payload area with random-looking bytes. Why bother? Because empty space at the back of the packet would quietly tell observers how short the route really is.",
    keyedCaption:
      "First, before anything else, Alice fills the empty payload area with random-looking bytes from `pad`. Why bother? Because empty space at the back of the packet would quietly tell observers how short the route really is.",
    activeHop: "alice",
    focus: "payload",
    keyName: "pad",
    keyToken: "pad",
    keyColor: "#5b6b8a",
  },
  {
    position: "alice",
    packetType: "forward",
    bytesVisible: true,
    forwardLayersVisible: true,
    errorLayerVisible: false,
    hasTag: false,
    verified: false,
    failureNote: false,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Encrypt the forward payload",
    caption:
      "Now Alice scrambles the whole payload with a stream cipher, adding one round of encryption for each hop on the route. The bytes are *ciphertext* now, and only the right hops can unscramble them.",
    keyedCaption:
      "Now Alice scrambles the whole payload with `rho`, a `ChaCha20` keystream, adding one round of encryption for each hop on the route. The bytes are *ciphertext* now, and only the right hops can unscramble them.",
    activeHop: "alice",
    focus: "payload",
    keyName: "rho",
    keyToken: "rho_AB",
    keyColor: "#b8860b",
  },
  {
    position: "alice",
    packetType: "forward",
    bytesVisible: true,
    forwardLayersVisible: true,
    errorLayerVisible: false,
    hasTag: true,
    verified: false,
    failureNote: false,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Authenticate the forward packet",
    caption:
      "Next, Alice computes a 32-byte authentication tag (`HMAC-SHA256`) over the payload and sticks it on the back of the packet. Every forwarder recomputes and checks this tag the moment it arrives, before decrypting anything, so tampering en route gets caught right away.",
    keyedCaption:
      "Next, Alice computes a 32-byte authentication tag over the payload with `mu` and sticks it on the back of the packet. Every forwarder recomputes and checks this tag the moment it arrives, before decrypting anything, so tampering en route gets caught right away.",
    activeHop: "alice",
    focus: "hmac",
    keyName: "mu",
    keyToken: "mu_AB",
    keyColor: "#3b6aa0",
  },
  {
    position: "bob",
    packetType: "error",
    bytesVisible: true,
    forwardLayersVisible: false,
    errorLayerVisible: false,
    hasTag: true,
    verified: false,
    failureNote: true,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Authenticate the return error",
    caption:
      "Ouch. Bob can't forward the payment (say his channel to Charlie is out of liquidity for the moment). So he writes a short error with the BOLT 4 failure code `temporary_channel_failure` (`0x1007`), then computes a 32-byte authentication tag (`HMAC-SHA256`) over the error packet and prepends it to the front (unlike the forward onion's trailing tag).",
    keyedCaption:
      "Ouch. Bob can't forward the payment (say his channel to Charlie is out of liquidity for the moment). So he writes a short error with the BOLT 4 failure code `temporary_channel_failure` (`0x1007`), then computes a 32-byte authentication tag over the error packet with `um` and prepends it to the front (unlike the forward onion's trailing tag).",
    activeHop: "bob",
    focus: "hmac",
    keyName: "um",
    keyToken: "um_AB",
    keyColor: "#2d7a7a",
  },
  {
    position: "bob",
    packetType: "error",
    bytesVisible: true,
    forwardLayersVisible: false,
    errorLayerVisible: true,
    hasTag: true,
    verified: false,
    failureNote: true,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Encrypt the return error",
    caption:
      "Finally, Bob encrypts the whole packet (tag included) with a different stream cipher. The error is sealed now, ready to ship back to Alice.",
    keyedCaption:
      "Finally, Bob encrypts the whole packet (tag included) with `ammag`. The error is sealed now, ready to ship back to Alice.",
    activeHop: "bob",
    focus: "payload",
    keyName: "ammag",
    keyToken: "ammag_AB",
    keyColor: "#5a7a2f",
  },
];

// Match PeelPrimer's locked focus/dim discipline: non-focal regions fade
// hard (0.18) and the focal region picks up a soft gold ring identical to
// the wrap/peel primers, so the three visuals teach with the same UI grammar.
const DIM_OPACITY = 0.18;
const DIM_TRANSITION =
  "opacity 400ms ease-out, box-shadow 400ms ease-out, background 400ms ease-out";
const FOCUS_RING_INSET =
  "inset 0 0 0 2px rgba(184,134,11,0.55), inset 0 0 18px rgba(184,134,11,0.35)";

const TOTAL_STEPS = STEPS.length;
const STEP_MS = 2400;
// Step 4 has a multi-stage animation (mini-onion ships, exclamation pops up,
// error packet fades in). Give it more time before auto-advancing.
const STEP_4_MS = 4200;
// Step 5 also has a chained animation: the encryption wash sweeps the buffer,
// then the error packet flies back from Bob to Alice along the wire.
const STEP_5_MS = 3800;
function stepDurationMs(step: number): number {
  if (step === 3) return STEP_4_MS;
  if (step === 4) return STEP_5_MS;
  return STEP_MS;
}

// Hop track positions: Alice and Bob are bigger and take more space; Charlie
// and Dave smaller, pushed to the right side so they read as "the rest of
// the route, but not the focus right now."
const HOP_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

const HOP_SIZE: Record<HopId, number> = {
  alice: 60,
  bob: 60,
  charlie: 60,
  dave: 60,
};

function HopCircle({
  hop,
  active,
  size,
  faded,
}: {
  hop: HopId;
  active: boolean;
  size: number;
  faded?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center"
      style={{ opacity: faded ? 0.6 : 1 }}
    >
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: HOP_FILL[hop],
          border: `${active ? 3 : 2}px solid ${HOP_STROKE[hop]}`,
          boxShadow: active ? "0 0 0 4px rgba(184,134,11,0.30)" : "none",
          transition: "box-shadow 400ms ease-out, border-width 200ms ease-out",
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
          {HOP_LABEL[hop].charAt(0)}
        </span>
      </div>
      <div
        className="font-bold mt-1 uppercase tracking-[0.06em]"
        style={{
          color: "#0f172a",
          fontSize: size > 50 ? 11 : 9,
        }}
      >
        {HOP_LABEL[hop]}
      </div>
    </div>
  );
}

function FailureExclamation({ step }: { step: number }) {
  // Only render once the packet has reached Bob (step 4 onward). At step 4
  // it animates: pops up at Bob's column above the wire, then slides up to
  // Bob's top-right corner. At step 5 it's static at the corner so the
  // failure marker persists while Alice handles the error.
  if (step < 3) return null;

  const isAnimating = step === 3;

  const badge = (
    <div
      className="rounded-full flex items-center justify-center"
      style={{
        width: 24,
        height: 24,
        background: ERROR_COLOR,
        color: "#fffdf5",
        fontWeight: 900,
        fontSize: 16,
        lineHeight: 1,
        boxShadow: "0 2px 6px rgba(161,58,58,0.4)",
        border: "1.5px solid #fffdf5",
      }}
    >
      !
    </div>
  );

  if (isAnimating) {
    return (
      <div
        key={`exclamation-anim-${step}`}
        className="absolute pointer-events-none"
        style={{
          top: 14,
          left: `${HOP_X_PCT.bob}%`,
          transform: "translateX(-12px) scale(0)",
          opacity: 0,
          animation: `failure-exclamation ${STEP_4_MS}ms ease-out forwards`,
          zIndex: 6,
        }}
      >
        {badge}
      </div>
    );
  }

  // Static badge at Bob's top-right corner for step 5+
  return (
    <div
      key="exclamation-static"
      className="absolute pointer-events-none"
      style={{
        top: 4,
        left: `${HOP_X_PCT.bob}%`,
        transform: "translateX(20px) scale(0.85)",
        zIndex: 6,
      }}
    >
      {badge}
    </div>
  );
}

function MiniErrorFlyer() {
  // Mini error packet that flies Bob → Alice during the back half of step 5.
  // Has the same shape as the error packet (PAYLOAD + HMAC, no HEADER) but
  // small enough to ride the hop track wire. Sized to match PeelPrimer's
  // MiniOnionPacket (84×22) so the chapter's traveling-packet vocabulary
  // stays consistent.
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 14,
        left: `${HOP_X_PCT.bob}%`,
        transform: "translateX(-50%)",
        animation: `error-flyer ${STEP_5_MS}ms ease-out forwards`,
        zIndex: 5,
        opacity: 0,
      }}
    >
      <div
        className="flex"
        style={{
          width: 84,
          height: 22,
          background: "#fffdf5",
          border: `1.5px solid ${ERROR_COLOR}`,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(161,58,58,0.25)",
        }}
      >
        {/* Mini ERROR PAYLOAD: red diagonal hatch */}
        <div
          className="relative"
          style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(135deg, ${ERROR_COLOR}99 0px, ${ERROR_COLOR}99 1px, transparent 1px, transparent 5px)`,
            }}
          />
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            width: 14,
            background: `${ERROR_COLOR}55`,
            borderLeft: `1.5px solid ${ERROR_COLOR}`,
          }}
        />
      </div>
    </div>
  );
}

function MiniOnionFlyer() {
  // Mini packet: HEADER strip + payload area with stacked hatches + HMAC
  // strip. Sized to match PeelPrimer's MiniOnionPacket (84×22) so the
  // traveling-packet vocabulary is identical across the chapter visuals.
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 14,
        left: `${HOP_X_PCT.alice}%`,
        transform: "translateX(-50%)",
        animation: "onion-flyer 1.4s ease-out forwards",
        zIndex: 5,
      }}
    >
      <div
        className="flex"
        style={{
          width: 84,
          height: 22,
          background: "#fffdf5",
          border: "1.5px solid #0f172a",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
        }}
      >
        {/* Mini HEADER */}
        <div
          style={{
            width: 16,
            background: "#f1f5f9",
            borderRight: "1.5px solid #0f172a",
          }}
        />
        {/* Mini PAYLOAD with three stacked encryption layers */}
        <div
          className="relative"
          style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
        >
          {(["dave", "charlie", "bob"] as ForwarderId[]).map((hop) => (
            <div
              key={hop}
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${LAYER_COLORS[hop]}A0 0px, ${LAYER_COLORS[hop]}A0 1.5px, transparent 1.5px, transparent 5px)`,
              }}
            />
          ))}
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            width: 14,
            background: `${LAYER_COLORS.bob}55`,
            borderLeft: "1.5px solid #0f172a",
          }}
        />
      </div>
    </div>
  );
}

function HopTrack({ state, step }: { state: StepState; step: number }) {
  return (
    <div
      className="relative mx-auto mb-3"
      style={{ height: 100, maxWidth: 720 }}
    >
      {/* Mini onion packet that flies from Alice → Bob when entering step 4
          (index 3). Keyed to the step so it remounts and replays the
          animation each time step 4 becomes active. */}
      {step === 3 && <MiniOnionFlyer key={`flyer-${step}`} />}
      {step === 4 && <MiniErrorFlyer key={`error-flyer-${step}`} />}
      <FailureExclamation step={step} />

      {/* Connectors. The active link (alice ↔ bob during forward/return)
          becomes a solid colored arrow at the same position; other links
          stay dashed. */}
      {(
        [
          ["alice", "bob"],
          ["bob", "charlie"],
          ["charlie", "dave"],
        ] as const
      ).map(([a, b]) => {
        const aSize = HOP_SIZE[a];
        const bSize = HOP_SIZE[b];
        const aOff = aSize / 2 + 4;
        const bOff = bSize / 2 + 4;
        const isAB = a === "alice" && b === "bob";
        const isFwd = isAB && state.forwardArrow;
        const isRet = isAB && state.returnArrow;

        if (isFwd || isRet) {
          const arrowColor = isRet ? ERROR_COLOR : "#b8860b";
          return (
            <div
              key={`${a}-${b}`}
              className="absolute pointer-events-none"
              style={{
                top: 24,
                left: `calc(${HOP_X_PCT[a]}% + ${aOff}px)`,
                width: `calc(${HOP_X_PCT[b] - HOP_X_PCT[a]}% - ${
                  aOff + bOff
                }px)`,
              }}
            >
              <svg
                width="100%"
                height="10"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
              >
                {isRet ? (
                  <>
                    <line
                      x1="8"
                      y1="5"
                      x2="100"
                      y2="5"
                      stroke={arrowColor}
                      strokeWidth="1.5"
                    />
                    <polygon points="0,5 10,1 10,9" fill={arrowColor} />
                  </>
                ) : (
                  <>
                    <line
                      x1="0"
                      y1="5"
                      x2="92"
                      y2="5"
                      stroke={arrowColor}
                      strokeWidth="1.5"
                    />
                    <polygon points="100,5 90,1 90,9" fill={arrowColor} />
                  </>
                )}
              </svg>
            </div>
          );
        }

        return (
          <div
            key={`${a}-${b}`}
            className="absolute pointer-events-none"
            style={{
              top: 28,
              left: `calc(${HOP_X_PCT[a]}% + ${aOff}px)`,
              width: `calc(${HOP_X_PCT[b] - HOP_X_PCT[a]}% - ${
                aOff + bOff
              }px)`,
              borderTop: "1.5px dashed #475569",
            }}
          />
        );
      })}

      {/* Hop circles. Alice and Bob big, Charlie and Dave smaller and pushed to the side. */}
      {(["alice", "bob"] as HopId[]).map((h) => (
        <div
          key={h}
          className="absolute z-10"
          style={{
            top: 0,
            left: `${HOP_X_PCT[h]}%`,
            transform: "translateX(-50%)",
          }}
        >
          <HopCircle
            hop={h}
            size={HOP_SIZE[h]}
            active={state.activeHop === h}
          />
        </div>
      ))}
      {(["charlie", "dave"] as HopId[]).map((h) => (
        <div
          key={h}
          className="absolute z-10"
          style={{
            top: 0,
            left: `${HOP_X_PCT[h]}%`,
            transform: "translateX(-50%)",
          }}
        >
          <HopCircle hop={h} size={HOP_SIZE[h]} active={false} faded />
        </div>
      ))}
    </div>
  );
}

// ── Forward-mode payload contents (bytes + plaintext flash + hatches) ───────
// Rendered inside the persistent PAYLOAD-AREA box's CrossfadeSwap. Filling
// layer (absolute inset-0) so all of its absolutely-positioned children
// resolve against this box.
function ForwardPayloadContents({
  state,
  step,
}: {
  state: StepState;
  step: number;
}) {
  return (
    <div className="absolute inset-0">
      {/* Random bytes layer. At step 0 (Init), animates in left-to-right
          via the bytes-fill keyframe to convey the buffer being filled
          with pad keystream. After step 0, just stays visible. */}
      <div
        key={`bytes-${step}`}
        className="absolute inset-0 flex flex-wrap content-start"
        style={{
          padding: "8px 6px",
          gap: 3,
          opacity: state.bytesVisible ? 1 : 0,
          animation:
            step === 0
              ? `bytes-fill ${stepDurationMs(step)}ms ease-out forwards`
              : undefined,
          transition: step === 0 ? undefined : "opacity 700ms ease-out",
        }}
      >
        {Array.from({ length: 50 }).map((_, i) => (
          <span
            key={i}
            className="text-[8px] leading-none"
            style={{
              fontFamily: MONO,
              color: "#0f172a",
              opacity: 0.55,
            }}
          >
            {((i * 37 + 9) % 256).toString(16).padStart(2, "0")}
          </span>
        ))}
      </div>

      {/* Plaintext payment instructions. Only renders at step 1
          (Encrypt forward). Flashes in early to show Alice inserting
          the per-hop slices into the buffer, then fades out as the
          encryption hatches sweep over. */}
      {step === 1 && (
        <div
          key={`plaintext-${step}`}
          className="absolute inset-0 flex items-center"
          style={{
            padding: "0 8px",
            gap: 6,
            pointerEvents: "none",
            opacity: 0,
            animation: `plaintext-flash ${stepDurationMs(step)}ms ease-out forwards`,
          }}
        >
          {(["bob", "charlie", "dave"] as ForwarderId[]).map((hop, i) => {
            const c = LAYER_COLORS[hop];
            const fill = HOP_FILL[hop];
            const nextColor = NEXT_HOP_COLOR[hop];
            const label =
              hop === "bob"
                ? "Bob"
                : hop === "charlie"
                ? "Charlie"
                : "Dave";
            const isLast = i === 2;
            return (
              <div
                key={hop}
                className="flex-1 flex border-[1.5px]"
                style={{
                  borderColor: c,
                  minWidth: 0,
                  height: "100%",
                }}
              >
                {/* len sub-cell: BigSize length prefix (size-33) */}
                <SlotSubCell
                  section="len"
                  style={{
                    width: 30,
                    flexShrink: 0,
                    background: fill,
                    borderRight: `1px dashed ${c}90`,
                    fontFamily: MONO,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 7,
                      color: "#475569",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    LEN
                  </div>
                  <div
                    style={{
                      fontSize: 8.5,
                      color: c,
                      fontWeight: 700,
                      marginTop: 1.5,
                      lineHeight: 1,
                    }}
                  >
                    {HOP_LEN_BIGSIZE[hop]}
                  </div>
                </SlotSubCell>

                {/* Payload sub-cell */}
                <SlotSubCell
                  section="tlv"
                  className="flex-1 flex flex-col items-center justify-center text-center"
                  style={{
                    background: fill,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="text-[9px] font-bold uppercase tracking-[0.05em]"
                    style={{ color: c, fontFamily: MONO }}
                  >
                    {label}
                  </div>
                  <div
                    className="text-[8px] mt-0.5 opacity-70"
                    style={{ color: "#475569", fontFamily: MONO }}
                  >
                    {HOP_PAYLOAD_BYTES[hop]} B
                  </div>
                </SlotSubCell>

                {/* HMAC sub-cell */}
                <SlotSubCell
                  section="hmac"
                  style={{
                    width: 42,
                    flexShrink: 0,
                    background: `${nextColor}24`,
                    borderLeft: `1px dashed ${c}90`,
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
                    className="text-[8px] font-bold leading-tight text-center"
                    style={{
                      color: nextColor,
                      fontFamily: MONO,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {NEXT_HOP_LABEL[hop]}
                  </div>
                </SlotSubCell>
              </div>
            );
          })}
        </div>
      )}

      {/* Three encryption layers, each progressively offset from the
          left so the nested wrapping is visible: Bob's hatch covers
          the entire payload area, Charlie's covers from Charlie's
          hop payload to the end, Dave's covers only Dave's hop payload region. At
          step 1 they sweep in via encryption-sweep keyframe;
          otherwise use the standard opacity transition. */}
      {(["dave", "charlie", "bob"] as ForwarderId[]).map((hop, _idx) => {
        const c = LAYER_COLORS[hop];
        const angle = LAYER_ANGLES[hop];
        // Order is dave, charlie, bob (innermost first). For the
        // offset, the position in the original Bob/Charlie/Dave
        // sequence is what matters: Bob = 0, Charlie = 33%,
        // Dave = 66%.
        const leftPct = hop === "bob" ? 0 : hop === "charlie" ? 33.33 : 66.67;
        const sweep =
          step === 1 && state.forwardLayersVisible
            ? `encryption-sweep ${stepDurationMs(step)}ms ease-out forwards`
            : undefined;
        const baseTransition = step === 1 ? undefined : "opacity 700ms ease-out";
        return (
          <div
            key={`hatch-${hop}-${step}`}
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              left: `${leftPct}%`,
              right: 0,
              opacity: state.forwardLayersVisible ? 1 : 0,
              animation: sweep,
              transition: baseTransition,
            }}
          >
            {/* Locked-spec encryption hatch: 8% solid wash + 60%
                stripes at 2.5px on an 11px period (matches
                WrapPrimer / PeelPrimer / shared HatchOverlay). */}
            <div
              className="absolute inset-0"
              style={{ background: c, opacity: 0.08 }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${angle}deg, ${c} 0px, ${c} 2.5px, transparent 2.5px, transparent 11px)`,
                opacity: 0.6,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Error-mode payload contents (FAIL record + padding + error hatch) ───────
// Error payload mirroring BOLT 4 error_packet: a FAIL record at the front
// (LEN bigsize + TLV with the failure code/name, no HMAC subcell since the
// error packet's HMAC is the outer region) followed by a padding region that
// fills the rest of the 256-byte buffer. Encryption hatch sweeps over
// everything when errorLayerVisible. Filling layer (absolute inset-0) so all
// of its absolutely-positioned children resolve against the PAYLOAD-AREA box.
function ErrorPayloadContents({ state }: { state: StepState }) {
  return (
    <div className="absolute inset-0">
      {/* FAIL record */}
      <div
        className="absolute flex"
        style={{
          top: 8,
          bottom: 8,
          left: 8,
          width: "40%",
          background: "#fde0e0",
          border: `1.5px solid ${ERROR_COLOR}`,
          overflow: "hidden",
          zIndex: 3,
        }}
      >
        <SlotSubCell
          section="len"
          className="flex flex-col items-center justify-center"
          style={{
            width: 46,
            flexShrink: 0,
            background: "#fde0e0",
            borderRight: `1px dashed ${ERROR_COLOR}80`,
            padding: "0 2px",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 7,
              color: "#475569",
              letterSpacing: "0.02em",
              fontWeight: 700,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          >
            failure_len (u16)
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              color: ERROR_COLOR,
              fontWeight: 700,
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            0x0084
          </div>
        </SlotSubCell>
        <SlotSubCell
          section="tlv"
          className="flex-1 flex flex-col items-center justify-center"
          style={{
            background: "#fde0e0",
            padding: "0 4px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              color: ERROR_COLOR,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            FAIL
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: ERROR_COLOR,
              fontWeight: 700,
              marginTop: 2,
              lineHeight: 1.15,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            temporary_channel_failure
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: "#475569",
              marginTop: 1.5,
              lineHeight: 1,
            }}
          >
            0x1007
          </div>
        </SlotSubCell>
      </div>

      {/* Padding region */}
      <div
        className="absolute"
        style={{
          top: 8,
          bottom: 8,
          left: "calc(40% + 14px)",
          right: 8,
          background: "#e2e8f0",
          border: "1px dashed rgba(15,23,42,0.18)",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            fontFamily: MONO,
            color: "#475569",
            gap: 2,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700 }}>padding</div>
          <div style={{ fontSize: 9 }}>~124 bytes</div>
        </div>
      </div>

      {/* Encryption layer (light wash + diagonal hatch) sweeps over
          the whole buffer when errorLayerVisible. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: ERROR_COLOR,
          opacity: state.errorLayerVisible ? 0.08 : 0,
          transition: "opacity 700ms ease-out",
          zIndex: 4,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${ERROR_COLOR} 0px, ${ERROR_COLOR} 2.5px, transparent 2.5px, transparent 11px)`,
          opacity: state.errorLayerVisible ? 0.6 : 0,
          transition: "opacity 700ms ease-out",
          zIndex: 4,
        }}
      />
    </div>
  );
}

// ── Unified packet container (forward + error in one element) ───────────────
//
// §14 morph: forward steps (0-2) and error steps (3-4) share the
// HEADER | PAYLOAD | HMAC grammar, so they render from THIS one
// step-switching component. Every region is a persistent keyed element that
// reconciles across the 3→4 step change instead of unmounting/remounting:
//   • outer card + title bar → MorphBox key="packet-card" (border/background
//     morph black→red; title text crossfades forward↔error)
//   • HEADER region → MorphBox key="header-region"; in error mode its width
//     collapses to 0 (flexBasis + padding animate) rather than unmounting
//   • PAYLOAD AREA box → MorphBox key="payload-box"; its inner contents swap
//     representation via CrossfadeSwap keyed on packetType (forward bytes/
//     hatches ↔ error FAIL-record/padding), inner box height morphs 96↔88
//   • HMAC region → MorphBox key="hmac-region"; grows from 0 width when
//     hasTag, color/value crossfade, verified ✓ preserved.
function PacketContainer({
  state,
  accentColor,
  step,
}: {
  state: StepState;
  accentColor: string;
  step: number;
}) {
  const isError = state.packetType === "error";

  // Frame colors: forward uses ink (#0f172a) + a black title bar; error uses
  // ERROR_COLOR throughout. These morph across the 3→4 transition.
  const frameColor = isError ? ERROR_COLOR : "#0f172a";
  const titleBarBg = isError ? ERROR_COLOR : "#000000";

  // Title-bar text per mode/position (matches the originals).
  const titleText = isError
    ? state.position === "bob"
      ? "error_packet (at Bob, preparing)"
      : "error_packet (Bob → Alice)"
    : state.position === "alice"
    ? "onion_routing_packet (at Alice, preparing)"
    : "onion_routing_packet (Alice → Bob)";

  // Inner PAYLOAD-AREA box height differs by mode; morph between them.
  const payloadBoxHeight = isError ? 88 : 96;
  // HMAC region target width differs slightly by mode (16% forward / 18%
  // error); collapses to 0 until the tag is attached.
  const hmacBasis = state.hasTag ? (isError ? "18%" : "16%") : "0%";
  const hmacColor = isError ? ERROR_COLOR : LAYER_COLORS.bob;
  const hmacValue = isError ? "0x9b a3…4d" : "0x4f c2…7a";
  const hmacDimBg = isError ? `${ERROR_COLOR}14` : `${LAYER_COLORS.bob}14`;

  return (
    <MorphBox
      key="packet-card"
      className="border-[1.5px]"
      initial={false}
      animate={{ borderColor: frameColor }}
      style={{ background: "#fffdf5" }}
    >
      {/* Title bar: background morphs black↔red; the dot and the label text
          crossfade between the forward and error representations. */}
      <MorphBox
        key="packet-titlebar"
        className="px-3 py-1.5 flex items-center gap-2"
        initial={false}
        animate={{ background: titleBarBg }}
        style={{ color: "#fffdf5", fontFamily: MONO }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: isError ? "#fffdf5" : "#b8860b",
            display: "inline-block",
            transition: "background 450ms ease-in-out",
          }}
        />
        <CrossfadeSwap
          swapKey={isError ? "title-error" : "title-forward"}
          className="text-[10px] uppercase tracking-[0.1em] font-bold"
        >
          {titleText}
        </CrossfadeSwap>
      </MorphBox>

      <div className="p-3">
        <MorphBox
          key="packet-row"
          className="border-[1.5px] flex"
          initial={false}
          animate={{ borderColor: frameColor }}
          style={{ background: "#fffdf5" }}
        >
          {/* HEADER region (persistent). Present in forward mode (16% basis);
              in error mode its width + padding collapse to 0 (the error
              packet has no HEADER), so it morphs away instead of unmounting. */}
          <MorphBox
            key="header-region"
            className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
            initial={false}
            animate={{
              flexBasis: isError ? "0%" : "16%",
              paddingLeft: isError ? 0 : 6,
              paddingRight: isError ? 0 : 6,
              paddingTop: isError ? 0 : 8,
              paddingBottom: isError ? 0 : 8,
              opacity: isError ? 0 : state.focus === "header" ? 1 : DIM_OPACITY,
            }}
            style={{
              borderColor: "#0f172a",
              borderRightWidth: isError ? 0 : undefined,
              color: "#0f172a",
              minWidth: 0,
              overflow: "hidden",
              background:
                state.focus === "header"
                  ? `${accentColor}1F`
                  : `${LAYER_COLORS.bob}24`,
              boxShadow:
                !isError && state.focus === "header" ? FOCUS_RING_INSET : "none",
              transition:
                DIM_TRANSITION + ", border-color 450ms ease-in-out",
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              HEADER
            </span>
            <div
              style={{
                width: "60%",
                height: 1,
                background: "#0f172a30",
                marginTop: 5,
                marginBottom: 7,
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.05em] opacity-70 leading-tight"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              version
            </span>
            <span
              className="text-[12px] font-bold leading-tight mt-0.5"
              style={{ fontFamily: MONO, color: "#0f172a" }}
            >
              0x00
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-2"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              ephemeral pubkey
            </span>
            <span
              className="font-bold leading-tight mt-0.5"
              style={{
                fontFamily: MONO,
                color: LAYER_COLORS.bob,
                fontSize: 18,
              }}
            >
              <Tok token="E_AB" color={LAYER_COLORS.bob} />
            </span>
          </MorphBox>

          {/* PAYLOAD AREA (persistent). The outer region morphs its focus
              background/ring; the inner bordered box morphs its height and
              border color; its CONTENTS crossfade between forward and error
              representations via CrossfadeSwap. */}
          <MorphBox
            key="payload-region"
            className="flex flex-col border-r-[1.5px]"
            initial={false}
            animate={{ borderColor: frameColor }}
            style={{
              flex: 1,
              padding: "8px 8px",
              minWidth: 0,
              background:
                state.focus === "payload" ? `${accentColor}1F` : "transparent",
              opacity: state.focus === "payload" ? 1 : DIM_OPACITY,
              boxShadow: state.focus === "payload" ? FOCUS_RING_INSET : "none",
              transition: DIM_TRANSITION + ", border-color 450ms ease-in-out",
            }}
          >
            <div className="text-center mb-1.5">
              <CrossfadeSwap
                swapKey={isError ? "label-error" : "label-forward"}
                className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight inline-block"
                style={{ display: "block" }}
              >
                <span style={{ fontFamily: MONO, color: isError ? ERROR_COLOR : "#0f172a" }}>
                  {isError ? "ERROR PAYLOAD" : "PAYLOAD AREA"}
                </span>
              </CrossfadeSwap>
            </div>
            <MorphBox
              key="payload-box"
              className="relative border-[1.5px]"
              initial={false}
              animate={{
                height: payloadBoxHeight,
                borderColor: isError
                  ? ERROR_COLOR
                  : state.focus === "payload"
                  ? "#b8860b"
                  : "#0f172a",
              }}
              style={{
                background: "#fffdf5",
                overflow: "hidden",
              }}
            >
              <CrossfadeSwap
                swapKey={isError ? "payload-error" : "payload-forward"}
                style={{ position: "absolute", inset: 0 }}
              >
                {isError ? (
                  <ErrorPayloadContents state={state} />
                ) : (
                  <ForwardPayloadContents state={state} step={step} />
                )}
              </CrossfadeSwap>
            </MorphBox>
          </MorphBox>

          {/* HMAC region (persistent), shared by both modes. Hidden until
              the tag is attached; then expands from 0 width and fades up.
              Tag color/value crossfade between forward and error. */}
          <MorphBox
            key="hmac-region"
            className="flex flex-col items-center justify-center text-center"
            initial={false}
            animate={{
              flexBasis: hmacBasis,
              paddingLeft: state.hasTag ? 4 : 0,
              paddingRight: state.hasTag ? 4 : 0,
              paddingTop: state.hasTag ? 8 : 0,
              paddingBottom: state.hasTag ? 8 : 0,
              opacity: !state.hasTag ? 0 : state.focus === "hmac" ? 1 : DIM_OPACITY,
            }}
            style={{
              color: "#0f172a",
              minWidth: 0,
              overflow: "hidden",
              background: !state.hasTag
                ? "transparent"
                : state.focus === "hmac"
                ? `${accentColor}1F`
                : hmacDimBg,
              boxShadow: state.focus === "hmac" ? FOCUS_RING_INSET : "none",
              transition: DIM_TRANSITION,
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.06em] leading-tight"
              style={{ fontFamily: MONO, whiteSpace: "nowrap", color: isError ? ERROR_COLOR : "#0f172a" }}
            >
              HMAC
            </span>
            <span
              className="text-[8px] font-normal opacity-60 leading-tight mt-0.5"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              32-byte tag
            </span>
            <CrossfadeSwap
              swapKey={hmacValue}
              className="mt-2 text-[11px] font-bold leading-tight"
              style={{ display: "block" }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  color: hmacColor,
                  whiteSpace: "nowrap",
                }}
              >
                {hmacValue}
              </span>
            </CrossfadeSwap>
            <div
              className="mt-1 leading-none"
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#16a34a",
                opacity: state.verified ? 1 : 0,
                transform: state.verified ? "scale(1)" : "scale(0.5)",
                transition: "opacity 400ms ease-out, transform 400ms ease-out",
              }}
            >
              ✓
            </div>
          </MorphBox>
        </MorphBox>
      </div>
    </MorphBox>
  );
}

// Short "what it does" label for each key, in STEP order. Connects each of the
// five operations to a distinct key without naming it yet (Key 1..5). Mirrors
// the bullet list above the visual in the chapter prose.
const KEY_ROLES = [
  "Padding",
  "Encrypt payload",
  "Authenticate payload",
  "Authenticate error",
  "Encrypt error",
];

// A strip of the five distinct keys, one per operation. The current step's key
// lights up (full color) while the others dim, so the reader can see which key
// is doing the work at each step. In the unkeyed instance the keys are numbered
// (Key 1..5); the keyed instance shows their real names.
function KeyStrip({ step, showKeys }: { step: number; showKeys: boolean }) {
  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-[0.08em] font-bold mb-1.5"
        style={{ color: "#475569", fontFamily: MONO }}
      >
        The five keys · one per operation
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => {
          const active = i === step;
          return (
            <div
              key={i}
              className="border-[1.5px] px-1.5 py-1.5 text-center"
              style={{
                borderColor: s.keyColor,
                background: active ? hexToRgba(s.keyColor, 0.16) : "#fffdf5",
                opacity: active ? 1 : 0.4,
                boxShadow: active
                  ? `0 2px 10px ${hexToRgba(s.keyColor, 0.3)}`
                  : "none",
                transition:
                  "opacity 300ms ease-out, background 300ms ease-out, box-shadow 300ms ease-out",
              }}
              data-testid={`op-key-${i}`}
            >
              <div
                className="text-[11px] font-bold leading-none"
                style={{ fontFamily: MONO, color: s.keyColor }}
              >
                {showKeys ? s.keyName : `Key ${i + 1}`}
              </div>
              <div
                className="text-[9px] leading-tight mt-1"
                style={{ color: "#0f172a" }}
              >
                {KEY_ROLES[i]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OperationsLifecycleDiagram({
  showKeys = false,
}: {
  showKeys?: boolean;
} = {}) {
  const [step, setStep] = useState(0);

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }
  function next() {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }
  function reset() {
    setStep(0);
  }

  const current = STEPS[step];
  const accentColor = showKeys ? current.keyColor : ACCENT_COLOR;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid={
        showKeys ? "operations-lifecycle-keyed" : "operations-lifecycle"
      }
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Keyframes for the step 4 multi-stage animation:
          - onion-flyer: mini onion packet flies Alice → Bob (~0-1.4s)
          - failure-exclamation: red ! pops up at Bob (~1.6s), then slides
            up to Bob's top-right corner as a persistent badge (~2.4s)
          The error packet itself no longer fades in via a keyframe; the
          persistent PacketContainer morphs forward to error in place (§14). */}
      <style>{`
        @keyframes onion-flyer {
          0% { left: ${HOP_X_PCT.alice}%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: ${HOP_X_PCT.bob}%; opacity: 0; }
        }
        /* Mini error packet flies Bob → Alice once Bob has finished sealing
           it (delayed start so the HMAC region pulls in first). */
        @keyframes error-flyer {
          0%, 28% { left: ${HOP_X_PCT.bob}%; opacity: 0; }
          38% { left: ${HOP_X_PCT.bob}%; opacity: 1; }
          82% { left: ${HOP_X_PCT.alice}%; opacity: 1; }
          100% { left: ${HOP_X_PCT.alice}%; opacity: 0; }
        }
        @keyframes failure-exclamation {
          0%, 35% {
            top: 14px;
            transform: translateX(-12px) scale(0);
            opacity: 0;
          }
          42% {
            top: 14px;
            transform: translateX(-12px) scale(1.4);
            opacity: 1;
          }
          48% {
            top: 14px;
            transform: translateX(-12px) scale(1);
            opacity: 1;
          }
          58% {
            top: 14px;
            transform: translateX(-12px) scale(1);
            opacity: 1;
          }
          70% {
            top: 4px;
            transform: translateX(20px) scale(0.85);
            opacity: 1;
          }
          100% {
            top: 4px;
            transform: translateX(20px) scale(0.85);
            opacity: 1;
          }
        }
        /* Step 1 (Init): empty buffer fills with random pad bytes left to right */
        @keyframes bytes-fill {
          0% { opacity: 0; clip-path: inset(0 100% 0 0); }
          15% { opacity: 1; }
          100% { opacity: 1; clip-path: inset(0 0 0 0); }
        }
        /* Step 2 (Encrypt): plaintext payment instructions flash in at the
           front of the buffer, then fade out as encryption is applied */
        @keyframes plaintext-flash {
          0% { opacity: 0; }
          15% { opacity: 1; }
          50% { opacity: 1; }
          80% { opacity: 0; }
          100% { opacity: 0; }
        }
        /* Step 2 (Encrypt): encryption hatches sweep in over the plaintext */
        @keyframes encryption-sweep {
          0%, 45% { opacity: 0; }
          80% { opacity: 1; }
          100% { opacity: 1; }
        }
      `}</style>
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            {showKeys
              ? "Five operations, five keys"
              : "Five operations across a roundtrip"}
          </span>
        </div>
      </div>

      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 340 }}
      >
        <div className="overflow-x-auto" style={{ paddingTop: 6 }}>
          <div
            className="mx-auto"
            style={{ minWidth: 720, maxWidth: 800 }}
          >
            <HopTrack state={current} step={step} />

            {/* The five keys, one per operation. Sits between the hop track and
                the packet so the reader connects "this step's operation" to a
                distinct key. The active step's key lights up; the rest dim. */}
            <KeyStrip step={step} showKeys={showKeys} />

            {/* Packet visual: ONE persistent step-switching container across
                all five steps (§14 morph). The forward→error transition (step
                3→4) morphs in place: the HEADER region collapses to 0 width,
                the frame/title morph black→red, and the PAYLOAD-AREA contents
                crossfade. No remount, so the shared HEADER | PAYLOAD | HMAC
                regions tween instead of jump-cutting. The mini-onion flyer and
                exclamation badge on the hop track above still play
                independently to pace the moment Bob crafts the error. */}
            <PacketContainer
              state={current}
              accentColor={accentColor}
              step={step}
            />

            {/* Per-step explanation (shared StepCaption, below the visual).
                The caption is routed through renderCaptionWithCode so
                backtick-quoted identifiers keep their inline-code styling, and
                the key chip (when showKeys) keeps its hover-tooltip handlers. */}
            <StepCaption
              label={`STEP ${step + 1} OF ${TOTAL_STEPS}`}
              title={current.badgeLabel}
              caption={renderCaptionWithCode(
                showKeys ? current.keyedCaption : current.caption,
              )}
              accentColor={accentColor}
              chip={
                showKeys ? (
                  <KeyHoverIcon
                    key={`key-${current.keyName}`}
                    {...keyCardPropsFor(
                      current.keyName,
                      current.keyToken,
                      current.keyColor,
                    )}
                    activeLabel={current.keyToken}
                  />
                ) : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={back}
              disabled={step === 0}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              style={{
                opacity: step === 0 ? 0.4 : 1,
                cursor: step === 0 ? "default" : "pointer",
              }}
              data-testid="operations-lifecycle-back"
            >
              ← Back
            </button>
            <button
              onClick={next}
              disabled={step === TOTAL_STEPS - 1}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              style={{
                opacity: step === TOTAL_STEPS - 1 ? 0.4 : 1,
                cursor: step === TOTAL_STEPS - 1 ? "default" : "pointer",
              }}
              data-testid="operations-lifecycle-next"
            >
              Next →
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              data-testid="operations-lifecycle-reset"
            >
              Reset
            </button>
          </div>
          {/* Grouped step buttons matching PeelPrimer's pattern: SETUP /
              FORWARD / RETURN. Header colors echo the hop-track arrows
              (slate for setup, gold for forward, red for return). */}
          <div className="ml-1 flex gap-2 flex-wrap items-end">
            {(
              [
                {
                  label: "SETUP",
                  color: "#475569",
                  fill: "#f1f5f9",
                  steps: [0],
                },
                {
                  label: "FORWARD",
                  color: "#b8860b",
                  fill: "#fef3c7",
                  steps: [1, 2],
                },
                {
                  label: "RETURN",
                  color: ERROR_COLOR,
                  fill: "#fde0e0",
                  steps: [3, 4],
                },
              ] as const
            ).map((g) => (
              <div
                key={g.label}
                className="flex flex-col items-stretch gap-0.5"
              >
                <div
                  className="text-center px-1.5 py-0.5 border-[1.5px]"
                  style={{
                    background: g.fill,
                    borderColor: g.color,
                    color: g.color,
                    fontFamily: MONO,
                    fontSize: 8.5,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {g.label}
                </div>
                <div className="flex gap-1">
                  {g.steps.map((i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setStep(i);
                      }}
                      className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                      style={{
                        background: step === i ? "#b8860b" : "#fffdf5",
                        borderColor:
                          step === i ? "#b8860b" : g.color + "80",
                        color: step === i ? "#fff" : "#0f172a",
                        fontFamily: MONO,
                        cursor: "pointer",
                      }}
                      aria-label={`Step ${i + 1}`}
                      data-testid={`operations-lifecycle-step-${i}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

export default OperationsLifecycleDiagram;
