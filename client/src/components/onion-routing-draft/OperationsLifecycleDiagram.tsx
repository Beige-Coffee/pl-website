import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";

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
//   4. Bob encrypts a return error after a downstream failure.
//   5. Alice authenticates the return error.
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

const LAYER_ANGLES: Record<ForwarderId, number> = {
  dave: 0,
  charlie: 45,
  bob: 135,
};

const LAYER_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};

// Per-spec slot internals: each hop's slot ends with a 32-byte HMAC pointing
// to the *next* hop's view of hop_payloads.
const NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "→ Charlie",
  charlie: "→ Dave",
  dave: "0x00…",
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

// Comprehensive hover-tooltip showing the active key's full derivation chain
// from start to finish: session_key → ephemeral key → shared secret → key
// (for per-hop keys), or session_key → key (for pad). Rendered via portal
// so it isn't clipped by the diagram's overflow-x-auto wrapper.
function KeyDerivationTooltip({
  keyName,
  keyToken,
  keyColor,
  pos,
}: {
  keyName: string;
  keyToken: string;
  keyColor: string;
  pos: { top: number; left: number };
}) {
  const isSession = keyName === "pad";
  const sessionColor = "#7b4b8a";
  const sharedColor = "#b8860b";

  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        background: "#fffdf5",
        border: `1.5px solid ${keyColor}`,
        padding: "10px 12px",
        boxShadow: "0 6px 22px rgba(15,23,42,0.22)",
        zIndex: 100,
        pointerEvents: "none",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        width: 360,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.08em] font-bold mb-2 text-center"
        style={{ color: "#475569" }}
      >
        How {keyName} is derived
      </div>

      {isSession ? (
        // ── pad: session_key → pad (no ECDH) ──
        <div className="flex flex-col items-stretch gap-1">
          <DerivStepBox
            color={sessionColor}
            note="random 32-byte secret per payment"
          >
            session_key
          </DerivStepBox>
          <DerivArrow color={keyColor} label='HMAC with "pad" label' />
          <DerivStepBox color={keyColor} highlight>
            <Tok token="pad" color={keyColor} />
            {" = HMAC(\"pad\", session_key)"}
          </DerivStepBox>
        </div>
      ) : (
        // ── per-hop keys: session_key → e_AB → ss_AB → key_AB ──
        <div className="flex flex-col items-stretch gap-1">
          <DerivStepBox
            color={sessionColor}
            note="random 32-byte secret per payment"
          >
            session_key
          </DerivStepBox>
          <DerivArrow
            color={keyColor}
            label="Alice picks it as the first ephemeral key"
          />
          <DerivStepBox color={sharedColor}>
            <Tok token="e_AB" color="#0f172a" />
            {" = session_key"}
          </DerivStepBox>
          <DerivArrow
            color={keyColor}
            label="ECDH with Bob's node pubkey"
          />
          <DerivStepBox color={sharedColor}>
            <Tok token="ss_AB" color="#0f172a" />
            {" = SHA256("}
            <Tok token="e_AB" color="#0f172a" />
            {" · "}
            <Tok token="B" color="#0f172a" />
            {")"}
          </DerivStepBox>
          <DerivArrow
            color={keyColor}
            label={`HMAC with "${keyName}" label`}
          />
          <DerivStepBox color={keyColor} highlight>
            <Tok token={keyToken} color={keyColor} />
            {' = HMAC("'}
            {keyName}
            {'", '}
            <Tok token="ss_AB" color={keyColor} />
            {")"}
          </DerivStepBox>
        </div>
      )}
    </div>
  );
}

function DerivStepBox({
  children,
  color,
  note,
  highlight,
}: {
  children: React.ReactNode;
  color: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="border-[1.5px] px-2.5 py-1.5"
      style={{
        borderColor: color,
        background: highlight ? hexToRgba(color, 0.18) : hexToRgba(color, 0.07),
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "center",
        lineHeight: 1.35,
      }}
    >
      <div>{children}</div>
      {note && (
        <div
          style={{
            fontSize: 9,
            fontStyle: "italic",
            color: "#475569",
            fontWeight: 400,
            marginTop: 2,
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

function DerivArrow({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center" style={{ padding: "1px 0" }}>
      <div
        style={{
          fontSize: 9,
          fontStyle: "italic",
          color: "#475569",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 0.8,
          color,
          fontWeight: 700,
        }}
      >
        ↓
      </div>
    </div>
  );
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
  caption: string;
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
      "Alice fills the empty packet's payload area with random-looking bytes before doing anything else. Without this, unused space at the back of the packet would tell observers how short the route really is.",
    activeHop: "alice",
    focus: "payload",
    keyName: "pad",
    keyToken: "pad",
    keyColor: "#7b4b8a",
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
      "Alice scrambles the entire payload with a stream cipher, layering one round of encryption per hop in the route. The bytes are now ciphertext that only the right hops can unscramble.",
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
      "Alice computes a 32-byte authentication tag over the payload using mu and attaches it to the back of the packet. Each forwarder will recompute and verify this tag on receipt, before any decryption, so any tampering en route gets rejected immediately.",
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
    errorLayerVisible: true,
    hasTag: false,
    verified: false,
    failureNote: true,
    forwardArrow: false,
    returnArrow: false,
    badgeColor: ACCENT_COLOR,
    badgeLabel: "Encrypt the return error",
    caption:
      "Bob can't forward the payment (say his channel to Charlie is temporarily out of liquidity). He writes a small error message with the BOLT 4 failure code temporary_channel_failure (0x1007) and encrypts it with a different stream cipher.",
    activeHop: "bob",
    focus: "payload",
    keyName: "ammag",
    keyToken: "ammag_AB",
    keyColor: "#5a7a2f",
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
    badgeLabel: "Authenticate the return error",
    caption:
      "Bob computes a 32-byte authentication tag over the error packet using um and attaches it to the back. The error packet is now sealed and ready to ship back to Alice.",
    activeHop: "bob",
    focus: "hmac",
    keyName: "um",
    keyToken: "um_AB",
    keyColor: "#2d7a7a",
  },
];

const DIM_OPACITY = 0.32;

const TOTAL_STEPS = STEPS.length;
const STEP_MS = 2800;
// Step 4 has a multi-stage animation (mini-onion ships, exclamation pops up,
// error packet fades in). Give it more time before auto-advancing.
const STEP_4_MS = 4200;
// Step 5 also has a chained animation: HMAC pulls in, then the error packet
// flies back from Bob to Alice along the wire.
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
  alice: 14,
  bob: 48,
  charlie: 75,
  dave: 90,
};

const HOP_SIZE: Record<HopId, number> = {
  alice: 60,
  bob: 60,
  charlie: 38,
  dave: 38,
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
  // small enough to ride the hop track wire. Plays after the HMAC has been
  // attached at Bob, so the visual reads as "Bob seals the error and ships
  // it home."
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
        className="border-[1.5px] flex"
        style={{
          width: 100,
          height: 26,
          background: "#fffdf5",
          borderColor: ERROR_COLOR,
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(161,58,58,0.25)",
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
              backgroundImage: `repeating-linear-gradient(135deg, ${ERROR_COLOR}90 0px, ${ERROR_COLOR}90 3px, transparent 3px, transparent 8px)`,
            }}
          />
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            flexBasis: "20%",
            background: `${ERROR_COLOR}1F`,
            borderLeft: `1.5px solid ${ERROR_COLOR}`,
          }}
        />
      </div>
    </div>
  );
}

function MiniOnionFlyer() {
  // Mini packet: HEADER strip + payload area with stacked hatches + HMAC
  // strip. Reads as "the encrypted onion packet" at a glance. Animated via
  // the `onion-flyer` keyframe defined in the parent component.
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
        className="border-[1.5px] flex"
        style={{
          width: 100,
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
            background: `${LAYER_COLORS.bob}24`,
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
                backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${LAYER_COLORS[hop]}A0 0px, ${LAYER_COLORS[hop]}A0 3px, transparent 3px, transparent 8px)`,
              }}
            />
          ))}
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            flexBasis: "14%",
            background: `${LAYER_COLORS.bob}24`,
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
              borderTop: "1.5px dashed #94a3b8",
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
            top: 12,
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

function ForwardPacketContainer({
  state,
  accentColor,
  step,
}: {
  state: StepState;
  accentColor: string;
  step: number;
}) {
  const headerLabel =
    state.position === "alice"
      ? "(at Alice, preparing)"
      : "(Alice → Bob)";

  return (
    <div
      className="border-[1.5px]"
      style={{ background: "#fffdf5", borderColor: "#0f172a" }}
    >
      {/* Black header */}
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
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          onion_routing_packet {headerLabel}
        </span>
      </div>

      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{ background: "#fffdf5", borderColor: "#0f172a" }}
        >
          {/* HEADER region */}
          <div
            className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
            style={{
              flexBasis: "16%",
              borderColor: "#0f172a",
              color: "#0f172a",
              padding: "8px 6px",
              minWidth: 0,
              background:
                state.focus === "header"
                  ? `${accentColor}1F`
                  : `${LAYER_COLORS.bob}24`,
              opacity: state.focus === "header" ? 1 : DIM_OPACITY,
              filter: state.focus === "header" ? "none" : "saturate(0.7)",
              boxShadow:
                state.focus === "header"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition:
                "opacity 500ms ease-out, filter 500ms ease-out, background 500ms ease-out, box-shadow 500ms ease-out",
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
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
                marginBottom: 7,
              }}
            />
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
            <span
              className="text-[10px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-2"
              style={{ fontFamily: MONO }}
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
          </div>

          {/* PAYLOAD AREA */}
          <div
            className="flex flex-col border-r-[1.5px]"
            style={{
              flex: 1,
              borderColor: "#0f172a",
              padding: "8px 8px",
              minWidth: 0,
              background:
                state.focus === "payload" ? `${accentColor}1F` : "transparent",
              opacity: state.focus === "payload" ? 1 : DIM_OPACITY,
              filter: state.focus === "payload" ? "none" : "saturate(0.7)",
              boxShadow:
                state.focus === "payload"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition:
                "opacity 500ms ease-out, filter 500ms ease-out, background 500ms ease-out, box-shadow 500ms ease-out",
            }}
          >
            <div className="text-center mb-1.5">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontFamily: MONO, color: "#0f172a" }}
              >
                PAYLOAD AREA
              </span>
            </div>
            <div
              className="relative border-[1.5px]"
              style={{
                background: "#fffdf5",
                borderColor: state.focus === "payload" ? accentColor : "#0f172a",
                height: 96,
                overflow: "hidden",
                transition: "border-color 500ms ease-out",
              }}
            >
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
                  transition:
                    step === 0 ? undefined : "opacity 700ms ease-out",
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
                        {/* len sub-cell */}
                        <SlotSubCell
                          section="len"
                          style={{
                            width: 22,
                            flexShrink: 0,
                            background: fill,
                            borderRight: `1px dashed ${c}90`,
                            fontSize: 8,
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
                          className="flex-1 flex flex-col items-center justify-center"
                          style={{
                            background: fill,
                            minWidth: 0,
                          }}
                        >
                          <div
                            className="text-[9px] font-bold uppercase tracking-[0.05em]"
                            style={{ color: c, fontFamily: MONO }}
                          >
                            {label}'s payload
                          </div>
                          <div
                            className="text-[8px] mt-0.5 opacity-70"
                            style={{ color: "#475569", fontFamily: MONO }}
                          >
                            TLV
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
                  slot to the end, Dave's covers only Dave's slot region. At
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
                return (
                  <div
                    key={`hatch-${hop}-${step}`}
                    className="absolute"
                    style={{
                      top: 0,
                      bottom: 0,
                      left: `${leftPct}%`,
                      right: 0,
                      backgroundImage: `repeating-linear-gradient(${angle}deg, ${c}A0 0px, ${c}A0 4px, transparent 4px, transparent 10px)`,
                      opacity: state.forwardLayersVisible ? 1 : 0,
                      animation:
                        step === 1 && state.forwardLayersVisible
                          ? `encryption-sweep ${stepDurationMs(step)}ms ease-out forwards`
                          : undefined,
                      transition:
                        step === 1 ? undefined : "opacity 700ms ease-out",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* HMAC region. Hidden until the tag is attached; then animates
              in by expanding from 0 width and fading up from opacity 0. */}
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              flexBasis: state.hasTag ? "16%" : "0%",
              color: "#0f172a",
              padding: state.hasTag ? "8px 4px" : "0",
              minWidth: 0,
              overflow: "hidden",
              background: !state.hasTag
                ? "transparent"
                : state.focus === "hmac"
                ? `${accentColor}1F`
                : `${LAYER_COLORS.bob}14`,
              opacity: !state.hasTag
                ? 0
                : state.focus === "hmac"
                ? 1
                : DIM_OPACITY,
              filter: state.focus === "hmac" ? "none" : "saturate(0.7)",
              boxShadow:
                state.focus === "hmac"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition:
                "flex-basis 600ms ease-out, padding 600ms ease-out, background 600ms ease-out, opacity 500ms ease-out, filter 500ms ease-out, box-shadow 500ms ease-out",
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.06em] leading-tight"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              HMAC
            </span>
            <span
              className="text-[8px] font-normal opacity-60 leading-tight mt-0.5"
              style={{ fontFamily: MONO, whiteSpace: "nowrap" }}
            >
              32-byte tag
            </span>
            <div
              className="mt-2 text-[11px] font-bold leading-tight"
              style={{
                fontFamily: MONO,
                color: LAYER_COLORS.bob,
                whiteSpace: "nowrap",
              }}
            >
              0x4f c2…7a
            </div>
            <div
              className="mt-1 leading-none"
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#16a34a",
                opacity: state.verified ? 1 : 0,
                transform: state.verified ? "scale(1)" : "scale(0.5)",
                transition:
                  "opacity 400ms ease-out, transform 400ms ease-out",
              }}
            >
              ✓
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorPacketContainer({
  state,
  accentColor,
}: {
  state: StepState;
  accentColor: string;
}) {
  const headerLabel =
    state.position === "bob" ? "(at Bob, preparing)" : "(Bob → Alice)";

  return (
    <div
      className="border-[1.5px]"
      style={{ background: "#fffdf5", borderColor: ERROR_COLOR }}
    >
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          background: ERROR_COLOR,
          color: "#fffdf5",
          fontFamily: MONO,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "#fffdf5",
            display: "inline-block",
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          error_packet {headerLabel}
        </span>
      </div>

      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{ background: "#fffdf5", borderColor: ERROR_COLOR }}
        >
          {/* PAYLOAD AREA */}
          <div
            className="flex flex-col"
            style={{
              flex: 1,
              color: "#0f172a",
              padding: "8px 8px",
              minWidth: 0,
              borderRight: `1.5px solid ${ERROR_COLOR}`,
              background:
                state.focus === "payload" ? `${accentColor}1F` : "transparent",
              opacity: state.focus === "payload" ? 1 : DIM_OPACITY,
              filter: state.focus === "payload" ? "none" : "saturate(0.7)",
              boxShadow:
                state.focus === "payload"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition:
                "opacity 500ms ease-out, filter 500ms ease-out, background 500ms ease-out, box-shadow 500ms ease-out",
            }}
          >
            <div className="text-center mb-1.5">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontFamily: MONO, color: ERROR_COLOR }}
              >
                ERROR PAYLOAD
              </span>
            </div>
            <div
              className="relative border-[1.5px]"
              style={{
                background: "#fde0e0",
                borderColor: ERROR_COLOR,
                height: 80,
                overflow: "hidden",
              }}
            >
              {/* Bytes */}
              <div
                className="absolute inset-0 flex flex-wrap content-start"
                style={{
                  padding: "8px 6px",
                  gap: 3,
                  opacity: state.bytesVisible ? 1 : 0,
                  transition: "opacity 700ms ease-out",
                }}
              >
                {Array.from({ length: 36 }).map((_, i) => (
                  <span
                    key={i}
                    className="text-[8px] leading-none"
                    style={{
                      fontFamily: MONO,
                      color: ERROR_COLOR,
                      opacity: 0.55,
                    }}
                  >
                    {((i * 41 + 7) % 256).toString(16).padStart(2, "0")}
                  </span>
                ))}
              </div>

              {/* Single encryption layer */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(135deg, ${ERROR_COLOR}90 0px, ${ERROR_COLOR}90 4px, transparent 4px, transparent 10px)`,
                  opacity: state.errorLayerVisible ? 1 : 0,
                  transition: "opacity 700ms ease-out",
                }}
              />
            </div>
            {state.failureNote && (
              <div
                className="text-[10px] mt-2 font-bold"
                style={{ color: ERROR_COLOR, fontFamily: MONO }}
              >
                ⚠ temporary_channel_failure (0x1007)
              </div>
            )}
          </div>

          {/* HMAC region. Hidden until the tag is attached. */}
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              flexBasis: state.hasTag ? "18%" : "0%",
              color: "#0f172a",
              padding: state.hasTag ? "8px 4px" : "0",
              minWidth: 0,
              overflow: "hidden",
              background: !state.hasTag
                ? "transparent"
                : state.focus === "hmac"
                ? `${accentColor}1F`
                : `${ERROR_COLOR}14`,
              opacity: !state.hasTag
                ? 0
                : state.focus === "hmac"
                ? 1
                : DIM_OPACITY,
              filter: state.focus === "hmac" ? "none" : "saturate(0.7)",
              boxShadow:
                state.focus === "hmac"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition:
                "flex-basis 600ms ease-out, padding 600ms ease-out, background 600ms ease-out, opacity 500ms ease-out, filter 500ms ease-out, box-shadow 500ms ease-out",
            }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-[0.06em] leading-tight"
              style={{ fontFamily: MONO, color: ERROR_COLOR }}
            >
              HMAC
            </span>
            <span
              className="text-[8px] font-normal opacity-60 leading-tight mt-0.5"
              style={{ fontFamily: MONO }}
            >
              32-byte tag
            </span>
            <div
              className="mt-2 text-[11px] font-bold leading-tight"
              style={{
                fontFamily: MONO,
                color: ERROR_COLOR,
                whiteSpace: "nowrap",
              }}
            >
              0x9b a3…4d
            </div>
            <div
              className="mt-1 leading-none"
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#16a34a",
                opacity: state.verified ? 1 : 0,
                transform: state.verified ? "scale(1)" : "scale(0.5)",
                transition:
                  "opacity 400ms ease-out, transform 400ms ease-out",
              }}
            >
              ✓
            </div>
          </div>
        </div>
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
  const [playing, setPlaying] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<
    { top: number; left: number } | null
  >(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

  function showKeyTooltip() {
    if (chipRef.current) {
      const rect = chipRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }
  function hideKeyTooltip() {
    setTooltipPos(null);
  }

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
    }, stepDurationMs(step));
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
          - error-packet-reveal: error packet fades in (~2.8s) once the
            failure marker has settled */}
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
        @keyframes error-packet-reveal {
          0%, 65% { opacity: 0; transform: translateY(8px); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(0); }
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
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 540 }}
      >
        <div className="overflow-x-auto" style={{ paddingTop: 6 }}>
          <div
            className="mx-auto"
            style={{ minWidth: 720, maxWidth: 800 }}
          >
            <HopTrack state={current} step={step} />

            {/* Operation badge + caption */}
            <div className="flex flex-col items-center text-center mb-4">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 border-[1.5px]"
                style={{
                  borderColor: accentColor,
                  background: `${accentColor}14`,
                  transition:
                    "border-color 500ms ease-out, background 500ms ease-out",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: accentColor,
                    transition: "background 500ms ease-out",
                  }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.08em] font-bold"
                  style={{ color: "#475569", fontFamily: MONO }}
                >
                  Step {step + 1}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color: accentColor,
                    transition: "color 500ms ease-out",
                  }}
                >
                  {current.badgeLabel}
                </span>
                {showKeys && (
                  <span
                    ref={chipRef}
                    className="text-sm font-bold"
                    style={{
                      color: current.keyColor,
                      fontFamily: MONO,
                      borderLeft: `1.5px solid ${current.keyColor}40`,
                      paddingLeft: 8,
                      marginLeft: 2,
                      transition: "color 500ms ease-out",
                      position: "relative",
                      cursor: "help",
                      borderBottom: `1px dotted ${current.keyColor}80`,
                    }}
                    key={`key-${current.keyName}`}
                    onMouseEnter={showKeyTooltip}
                    onMouseLeave={hideKeyTooltip}
                    data-testid="operations-lifecycle-key-chip"
                  >
                    <Tok token={current.keyToken} color={current.keyColor} />
                  </span>
                )}
              </div>
              <div
                className="mt-3 text-sm leading-relaxed italic px-4 mx-auto"
                style={{
                  color: "#475569",
                  maxWidth: 640,
                  minHeight: 60,
                }}
              >
                {current.caption}
              </div>
            </div>

            {/* Packet visual: forward or error depending on step. At step 4
                (the moment Bob crafts the error), the error packet fades in
                AFTER the mini-onion has flown over and the exclamation badge
                has settled at Bob's corner. */}
            {current.packetType === "forward" ? (
              <ForwardPacketContainer
                state={current}
                accentColor={accentColor}
                step={step}
              />
            ) : step === 3 ? (
              <div
                key={`error-reveal-${step}`}
                style={{
                  animation: `error-packet-reveal ${STEP_4_MS}ms ease-out forwards`,
                  opacity: 0,
                }}
              >
                <ErrorPacketContainer
                  state={current}
                  accentColor={accentColor}
                />
              </div>
            ) : (
              <ErrorPacketContainer state={current} accentColor={accentColor} />
            )}
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
                data-testid="operations-lifecycle-pause"
              >
                ❚❚ Pause
              </button>
            ) : (
              <button
                onClick={play}
                className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                data-testid="operations-lifecycle-play"
              >
                ▶ Play
              </button>
            )}
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              data-testid="operations-lifecycle-reset"
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
                data-testid={`operations-lifecycle-step-${i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hover tooltip for the key chip — portal-mounted so it isn't clipped
          by the diagram's overflow-x-auto wrapper. */}
      {tooltipPos &&
        showKeys &&
        typeof document !== "undefined" &&
        createPortal(
          <KeyDerivationTooltip
            keyName={current.keyName}
            keyToken={current.keyToken}
            keyColor={current.keyColor}
            pos={tooltipPos}
          />,
          document.body,
        )}
    </div>
  );
}

export default OperationsLifecycleDiagram;
