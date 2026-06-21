// ────────────────────────────────────────────────────────────────────────────
// errorOnionShared -- shared toolkit for the two Chapter 11 error-onion visuals
//
// ErrorBoomerangDiagram (the failing hop wraps an error that travels BACKWARD
// to the sender) and ErrorUnwrapDiagram (the sender trial-decrypts that error
// in route order) are mirror images of one operation, so they share their
// scaffolding here instead of drifting as copy-paste twins.
//
// Everything is built on the canonical primitives (HatchOverlay, SlotSubCell,
// renderCaption, MathLine) and follows the onion-routing visual standards:
//   - node track at 12/38/62/88, round circles, ONE dashed #475569 backbone,
//     explicit positive zIndex on every node container (§3)
//   - encryption shown only via HatchOverlay, Charlie 45° / Bob 90° (§5)
//   - the error packet rendered as LEN/TLV/HMAC-style subcells (§6)
//   - footer chrome with correct chip states + MONO chips (§1)
//
// The crypto invariant this module is built to teach: the error packet is a
// FIXED 292 bytes. Each return hop XOR-re-obfuscates the SAME buffer in place,
// so the card footprint NEVER changes -- only the crosshatch density grows.
// The numbers come straight from 11.0-error-onion.md: 32-byte HMAC + 260-byte
// payload = 292 B total; the failure is Charlie's `temporary_channel_failure`.
// ────────────────────────────────────────────────────────────────────────────

import { type ReactNode } from "react";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";
import { SlotSubCell } from "./SlotSubCell";
import { renderCaption } from "./captionMarkup";
import { StepCaption } from "./StepCaption";
import { MathLine } from "./mathTokens";

// ── Shared constants ───────────────────────────────────────────────────────

export const MONO = '"JetBrains Mono", "Fira Code", monospace';
export const SANS = "ui-sans-serif, system-ui, sans-serif";

export const INK = "#0f172a";
export const NEUTRAL_TEXT = "#475569";
export const FOCUS_GOLD = "#b8860b";
export const GOLD_FILL = "#fef3c7";
export const SUCCESS_GREEN = "#5a7a2f";
export const ERROR_RED = "#a13a3a";
export const CREAM = "#fffdf5";
export const PAD_FILL = "#e2e8f0";
export const PAD_STROKE = "#94a3b8";

// The four characters on the route. `ammag` is a return-direction key, so the
// hatch angles reuse the locked forward-direction map (Bob 90° / Charlie 45°)
// via HatchOverlay -- the ForwarderId type only spans bob/charlie/dave, which
// is exactly the set of hops that ever wrap an error.
export type HopId = "alice" | "bob" | "charlie" | "dave";

export const HOP_FILL: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
export const HOP_STROKE: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
export const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

export const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

export const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];

// Canonical error-packet byte budget (11.0-error-onion.md).
export const HMAC_BYTES = 32;
export const PAYLOAD_BYTES = 260;
export const PACKET_BYTES = HMAC_BYTES + PAYLOAD_BYTES; // 292

// The failing hop is Charlie in this chapter's running example.
export const FAILING_HOP: HopId = "charlie";

// ── ErrorRouteTrack: the Alice→Bob→Charlie→Dave orientation strip ───────────
//
// Dense-tier circles (~44px) because a packet card sits below. ONE dashed
// backbone behind the row; every circle container carries an explicit
// positive zIndex so the backbone never composites through it (§3). The
// active hop gets a 3px border + gold ring; the failing hop wears a red ✗
// badge; dimmed hops drop to ~40% opacity for route continuity (Dave is
// off the failure path but shown so the reader keeps the full topology).

const TRACK_CIRCLE = 44;

export interface RouteTrackProps {
  /** Hop currently in focus (3px border + gold ring). */
  activeHop?: HopId | null;
  /** Hop that failed the payment (persistent red ✗ badge). */
  failingHop?: HopId | null;
  /** Hops drawn at ~40% opacity (off the failure path, shown for continuity). */
  dimmed?: HopId[];
  /** Per-hop verdict badge from Alice's trial-decrypt: ✓ match / ✗ no-match. */
  verdicts?: Partial<Record<HopId, "match" | "fail">>;
  /** Extra height below the circles (room for labels). Defaults to 86. */
  height?: number;
  /** Optional traveling mini-packet under the holder's circle. It slides
   * between hops on step changes (left transition), so the packet's journey
   * along the route is something you watch, not infer. Pass height >= 112
   * to make room for it. */
  packet?: { holder: HopId; layers: ForwarderId[]; visible: boolean };
}

export function ErrorRouteTrack({
  activeHop = null,
  failingHop = null,
  dimmed = [],
  verdicts = {},
  height = 86,
  packet,
}: RouteTrackProps) {
  const dimSet = new Set(dimmed);
  // Circles sit at top: CIRCLE_TOP with height TRACK_CIRCLE, so their vertical
  // center is CIRCLE_TOP + TRACK_CIRCLE / 2. The single dashed backbone MUST
  // run through that center line (§3), so it is pinned there (not above it).
  const CIRCLE_TOP = 18;
  const centerY = CIRCLE_TOP + TRACK_CIRCLE / 2;
  return (
    <div className="relative" style={{ height }}>
      {/* ONE dashed backbone behind the whole row, on the circle CENTER line.
          Spans Alice's center (12%) to Dave's center (88%); the circles carry
          explicit positive zIndex below so the line never paints through them. */}
      <div
        className="absolute"
        style={{
          top: centerY,
          left: `${NODE_X_PCT.alice}%`,
          width: `${NODE_X_PCT.dave - NODE_X_PCT.alice}%`,
          borderTop: "1.5px dashed #475569",
          zIndex: 1,
        }}
      />

      {/* The traveling packet: a mini 292-byte glyph parked under whoever
          holds it, sliding hop to hop as the step changes. Its crosshatch
          mirrors the applied ammag layers, so you can watch the same fixed
          footprint gain (or lose) layers while it moves. */}
      {packet && (
        <div
          className="absolute"
          style={{
            top: CIRCLE_TOP + TRACK_CIRCLE + 26,
            left: `${NODE_X_PCT[packet.holder]}%`,
            transform: "translateX(-50%)",
            transition:
              "left 800ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
            opacity: packet.visible ? 1 : 0,
            zIndex: 3,
          }}
        >
          <div
            className="relative overflow-hidden flex items-center justify-center"
            style={{
              width: 66,
              height: 22,
              border: `1.5px solid ${INK}`,
              background: CREAM,
            }}
          >
            {packet.layers.length > 0 && (
              <HatchOverlay hops={packet.layers} zIndex={1} stripeOpacity={0.35} />
            )}
            <span
              className="relative"
              style={{
                zIndex: 2,
                fontFamily: MONO,
                fontSize: 8.5,
                fontWeight: 700,
                color: INK,
                background: "rgba(255,253,245,0.85)",
                padding: "0 3px",
              }}
            >
              292 B
            </span>
          </div>
        </div>
      )}

      {HOPS.map((id) => {
        const isActive = id === activeHop;
        const isDim = dimSet.has(id);
        const verdict = verdicts[id];
        const showFail = id === failingHop;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: CIRCLE_TOP,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
              // Explicit positive zIndex: keeps the circle above the dashed
              // backbone even though dimmed/active states add opacity/shadow
              // (which would otherwise create a stacking context the backbone
              // could paint through). §3 -- the backbone-through-circles bug.
              zIndex: isActive ? 4 : 2,
              opacity: isDim ? 0.4 : 1,
              transition: "opacity 400ms ease-out",
            }}
          >
            <div className="flex flex-col items-center">
              <div className="relative">
                <div
                  className="rounded-full flex items-center justify-center transition-all"
                  style={{
                    width: TRACK_CIRCLE,
                    height: TRACK_CIRCLE,
                    background: HOP_FILL[id],
                    border: `2px solid ${HOP_STROKE[id]}`,
                    borderWidth: isActive ? 3 : 2,
                    boxShadow: isActive
                      ? `0 0 0 4px rgba(184,134,11,0.30)`
                      : "none",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{
                      fontSize: TRACK_CIRCLE * 0.42,
                      color: INK,
                      fontFamily: SANS,
                    }}
                  >
                    {HOP_LABEL[id].charAt(0)}
                  </span>
                </div>

                {/* Failing-hop ✗ badge (persistent across beats). */}
                {showFail && (
                  <div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      background: ERROR_RED,
                      color: CREAM,
                      fontWeight: 900,
                      fontSize: 13,
                      lineHeight: 1,
                      border: "1.5px solid #fffdf5",
                      boxShadow: "0 2px 6px rgba(161,58,58,0.4)",
                      fontFamily: SANS,
                    }}
                  >
                    ✗
                  </div>
                )}

                {/* Trial-decrypt verdict badge (Alice's peel). */}
                {verdict && (
                  <div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      background:
                        verdict === "match" ? SUCCESS_GREEN : ERROR_RED,
                      color: CREAM,
                      fontWeight: 900,
                      fontSize: 13,
                      lineHeight: 1,
                      border: "1.5px solid #fffdf5",
                      boxShadow:
                        verdict === "match"
                          ? "0 2px 6px rgba(90,122,47,0.4)"
                          : "0 2px 6px rgba(161,58,58,0.4)",
                      fontFamily: SANS,
                    }}
                  >
                    {verdict === "match" ? "✓" : "✗"}
                  </div>
                )}
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{ color: INK, fontFamily: SANS }}
              >
                {HOP_LABEL[id]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ReturnPathRail: persistent leftward "RETURN PATH" indicator ─────────────
//
// The error travels BACKWARD, so a small left-pointing cue rides above the
// track on EVERY beat (not just the ones with a hop-to-hop arrow). Rendered in
// INK (slate/black), NOT green: for the two Chapter 11 error visuals the owner
// deliberately overrides the §2 "green = return-path" accent because the green
// dashed rail read as cluttered. The cue is a compact pill (short solid wedge +
// label), not a long skinny full-width arrow. Both diagrams render this so the
// backward direction reads instantly and the pair stays matched.

export function ReturnPathRail() {
  return (
    <div className="flex items-center" aria-hidden style={{ height: 22 }}>
      <div
        className="inline-flex items-center gap-1.5"
        style={{
          padding: "2px 9px 2px 7px",
          border: `1.5px solid ${INK}`,
          background: CREAM,
        }}
      >
        {/* Short solid left-pointing wedge -- a tasteful direction cue, not a
            long thin arrow. */}
        <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden>
          <polygon points="0,4.5 7,0.5 7,8.5" fill={INK} />
          <rect x="6" y="3.5" width="8" height="2" fill={INK} />
        </svg>
        <span
          className="uppercase shrink-0"
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            color: INK,
            letterSpacing: "0.12em",
          }}
        >
          return path
        </span>
      </div>
    </div>
  );
}

// ── ErrorPacketCard: the fixed-footprint 292-byte error packet ──────────────
//
// Renders the real BOLT 4 error-packet structure ONCE:
//   HMAC (32) │ LEN u16 │ failure message │ pad zeros        = 292 B
// using SlotSubCell so the hover labels match the locked spec. The HMAC cell's
// accent is the FAILING hop's color (Charlie), NOT red -- red is the fail
// semantic only.
//
// `appliedLayers` lists the ammag layers currently XORed onto the packet
// (outermost-first by convention, e.g. ["bob","charlie"] once both have
// wrapped). HatchOverlay paints them over the SAME card, so layers crosshatch
// in place. The card width/height are constant on every beat -- only the
// crosshatch density changes. That fixed footprint IS the lesson (the error
// packet is a fixed size; obfuscation accumulates in place).

const PACKET_W = 460;
const PACKET_BODY_H = 62;
const HMAC_CELL_W = 96;

export interface ErrorPacketCardProps {
  /** ammag layers currently applied (outermost-first), e.g. ["bob","charlie"]. */
  appliedLayers: ForwarderId[];
  /** Color the HMAC cell with the failing hop's stroke. Defaults to Charlie. */
  failingHop?: HopId;
  /** Optional caption shown under the card (routed through renderCaption). */
  footnote?: string;
  /** Optional badge rendered top-right of the card (e.g. a KeyHoverIcon). */
  cornerBadge?: ReactNode;
  /** Dim the card slightly (used before the packet is "real"). */
  dim?: boolean;
}

export function ErrorPacketCard({
  appliedLayers,
  failingHop = FAILING_HOP,
  footnote,
  cornerBadge,
  dim = false,
}: ErrorPacketCardProps) {
  const hmacColor = HOP_STROKE[failingHop];
  // Stripe opacity ~0.16 so the field labels stay legible on top of the
  // full buffer (§5: buffer-context readability).
  return (
    <div
      className="relative mx-auto"
      style={{
        width: PACKET_W,
        opacity: dim ? 0.55 : 1,
        transition: "opacity 400ms ease-out",
      }}
    >
      {cornerBadge && (
        <div
          className="absolute"
          style={{ top: -10, right: -8, zIndex: 8 }}
        >
          {cornerBadge}
        </div>
      )}

      <div
        className="border-[1.5px]"
        style={{ background: CREAM, borderColor: INK, overflow: "hidden" }}
      >
        {/* Card header bar: constant "292 B" label on every beat. */}
        <div
          className="flex items-center justify-between px-2 py-1"
          style={{
            background: `${hmacColor}14`,
            borderBottom: `1.5px solid ${INK}`,
          }}
        >
          <span
            className="uppercase tracking-[0.08em]"
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              color: hmacColor,
            }}
          >
            error packet
          </span>
          <span
            className="uppercase tracking-[0.06em]"
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              color: NEUTRAL_TEXT,
            }}
          >
            292 B · fixed
          </span>
        </div>

        {/* Packet body -- fixed height, fixed widths. Extracted so the XOR
            stack can render the same fields as compact before/after bars. */}
        <ErrorPacketBody
          appliedLayers={appliedLayers}
          failingHop={failingHop}
        />

        {/* Byte ruler: HMAC(32) || payload(260). Constant on every beat. */}
        <div
          className="flex"
          style={{ borderTop: `1px solid ${INK}20` }}
        >
          <div
            className="text-center py-0.5"
            style={{
              width: HMAC_CELL_W,
              flexShrink: 0,
              fontFamily: MONO,
              fontSize: 8,
              color: NEUTRAL_TEXT,
              borderRight: `1px solid ${INK}14`,
            }}
          >
            32
          </div>
          <div
            className="text-center py-0.5 flex-1"
            style={{
              fontFamily: MONO,
              fontSize: 8,
              color: NEUTRAL_TEXT,
            }}
          >
            260 (payload)
          </div>
        </div>
      </div>

      {footnote && (
        <div
          className="text-center mt-1.5"
          style={{
            fontFamily: SANS,
            fontSize: 10.5,
            color: NEUTRAL_TEXT,
            lineHeight: 1.4,
          }}
        >
          {renderCaption(footnote)}
        </div>
      )}
    </div>
  );
}

// The packet's field row (HMAC │ LEN │ failure msg │ pad) plus the
// accumulating HatchOverlay, as one reusable element. The single relative
// container hosts the field cells AND the hatch so every applied ammag layer
// crosshatches the SAME footprint.
export function ErrorPacketBody({
  appliedLayers,
  failingHop = FAILING_HOP,
  height = PACKET_BODY_H,
}: {
  appliedLayers: ForwarderId[];
  failingHop?: HopId;
  height?: number;
}) {
  const hmacColor = HOP_STROKE[failingHop];
  return (
    <div className="relative flex" style={{ height, background: CREAM }}>
      {/* HMAC (32) -- accent = failing hop, never red. */}
      <SlotSubCell
        section="hmac"
        className="relative flex items-center justify-center"
        style={{
          width: HMAC_CELL_W,
          flexShrink: 0,
          background: HOP_FILL[failingHop],
          borderRight: `1.5px solid ${hmacColor}`,
          overflow: "hidden",
        }}
      >
        <LabelIsland borderColor={hmacColor} zIndex={6}>
          <FieldKicker>HMAC</FieldKicker>
          <FieldValue color={hmacColor}>32 B</FieldValue>
          <FieldSub>um_{failingHop.charAt(0)}</FieldSub>
        </LabelIsland>
      </SlotSubCell>

      {/* Payload (260) -- LEN u16 │ failure message │ pad. One TLV-style
          region; the inner three islands sum to the 260-byte payload. */}
      <div
        className="relative flex flex-1"
        style={{ minWidth: 0, background: HOP_FILL[failingHop] }}
      >
        {/* LEN (u16) */}
        <SlotSubCell
          section="len"
          className="relative flex items-center justify-center"
          style={{
            width: 64,
            flexShrink: 0,
            borderRight: `1px dashed ${hmacColor}80`,
            overflow: "hidden",
          }}
        >
          <LabelIsland borderColor={hmacColor} zIndex={6}>
            <FieldKicker>LEN</FieldKicker>
            <FieldValue color={hmacColor}>u16</FieldValue>
          </LabelIsland>
        </SlotSubCell>

        {/* failure message */}
        <SlotSubCell
          section="tlv"
          className="relative flex flex-1 items-center justify-center"
          style={{ minWidth: 0, overflow: "hidden" }}
        >
          <LabelIsland borderColor={hmacColor} zIndex={6}>
            <FieldValue color={hmacColor}>failure msg</FieldValue>
            <FieldSub>temporary_channel_failure</FieldSub>
          </LabelIsland>
        </SlotSubCell>

        {/* pad to fixed length */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 70,
            flexShrink: 0,
            borderLeft: `1px dashed ${PAD_STROKE}`,
            overflow: "hidden",
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              background: CREAM,
              border: `1px solid ${PAD_STROKE}`,
              padding: "2px 4px",
              position: "relative",
              zIndex: 6,
            }}
          >
            <FieldKicker>PAD</FieldKicker>
            <FieldSub>0x00…</FieldSub>
          </div>
        </div>
      </div>

      {/* Accumulating encryption. Each ammag layer crosshatches the whole
          292-byte footprint; deeper hops add another angle. The footprint
          never changes -- only the density grows. */}
      {appliedLayers.length > 0 && (
        <HatchOverlay hops={appliedLayers} zIndex={4} stripeOpacity={0.16} />
      )}
    </div>
  );
}

// ── ErrorXorStack: the canonical three-bar XOR for a wrap or peel beat ──────
//
// Mirrors the forward-direction grammar (PeelTraceDiagram beat 6, standards
// §15): the packet BEFORE, ⊕ the hop's ammag keystream (a full hatched bar),
// = the packet AFTER, gold-emphasized. Same 292-byte footprint on every bar;
// only the crosshatch changes. This is what makes "encryption is an in-place
// XOR" explicit instead of implied.

export function ErrorXorStack({
  wrapHop,
  beforeLayers,
  afterLayers,
  beforeLabel,
  afterLabel,
  cornerBadge,
}: {
  /** The hop whose ammag keystream this beat applies (wrap or peel). */
  wrapHop: "bob" | "charlie";
  beforeLayers: ForwarderId[];
  afterLayers: ForwarderId[];
  beforeLabel: string;
  afterLabel: string;
  /** Optional badge rendered top-right of the stack (e.g. a KeyHoverIcon). */
  cornerBadge?: ReactNode;
}) {
  const accent = HOP_STROKE[wrapHop];
  const sub = wrapHop === "bob" ? "B" : "C";
  return (
    <div className="relative mx-auto" style={{ width: PACKET_W }}>
      {cornerBadge && (
        <div className="absolute" style={{ top: -10, right: -8, zIndex: 8 }}>
          {cornerBadge}
        </div>
      )}

      <XorBarLabel color={NEUTRAL_TEXT}>{beforeLabel}</XorBarLabel>
      <div
        className="border-[1.5px]"
        style={{ borderColor: INK, overflow: "hidden" }}
      >
        <ErrorPacketBody appliedLayers={beforeLayers} height={50} />
      </div>

      <XorOpRow>⊕</XorOpRow>

      <XorBarLabel color={accent} center>
        keystream · 292 B
      </XorBarLabel>
      <div
        className="border-[1.5px] relative overflow-hidden flex items-center justify-center"
        style={{ borderColor: accent, height: 42, background: CREAM }}
      >
        <HatchOverlay hops={[wrapHop]} zIndex={0} stripeOpacity={0.5} />
        <span
          className="relative"
          style={{ zIndex: 2, background: CREAM, padding: "1px 8px" }}
        >
          <MathLine
            text={`chacha20(ammag_${sub}, 292)`}
            color={accent}
            fontSize={12}
          />
        </span>
      </div>

      <XorOpRow>=</XorOpRow>

      <XorBarLabel color={FOCUS_GOLD}>{afterLabel}</XorBarLabel>
      <div
        className="border-[1.5px]"
        style={{
          borderColor: FOCUS_GOLD,
          boxShadow: "0 0 0 2px rgba(184,134,11,0.18)",
          overflow: "hidden",
        }}
      >
        <ErrorPacketBody appliedLayers={afterLayers} height={50} />
      </div>
    </div>
  );
}

function XorBarLabel({
  children,
  color,
  center,
}: {
  children: ReactNode;
  color: string;
  center?: boolean;
}) {
  return (
    <div
      className={`text-[10px] uppercase tracking-[0.06em] mb-1 ${center ? "text-center" : ""}`}
      style={{ color, fontFamily: MONO, fontWeight: 700 }}
    >
      {children}
    </div>
  );
}

function XorOpRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-center my-1"
      style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1 }}
    >
      {children}
    </div>
  );
}

// A solid cream "label island" that floats above the hatch so field text
// stays legible over the crosshatch (§6).
function LabelIsland({
  children,
  borderColor,
  zIndex,
}: {
  children: ReactNode;
  borderColor: string;
  zIndex: number;
}) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        background: CREAM,
        border: `1px solid ${borderColor}55`,
        padding: "2px 5px",
        position: "relative",
        zIndex,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      {children}
    </div>
  );
}

function FieldKicker({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function FieldValue({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <div
      className="font-bold whitespace-nowrap mt-0.5"
      style={{
        color,
        fontFamily: MONO,
        fontSize: 9.5,
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function FieldSub({ children }: { children: ReactNode }) {
  return (
    <div
      className="whitespace-nowrap mt-0.5"
      style={{
        color: NEUTRAL_TEXT,
        fontFamily: MONO,
        fontSize: 7,
        letterSpacing: "0.02em",
        lineHeight: 1,
        fontStyle: "italic",
        maxWidth: 120,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {children}
    </div>
  );
}

// ── ErrorChrome: outer container + header + footer (shared by both) ─────────
//
// The two diagrams differ only in their stage content, title, testid, and
// captions. Everything else -- the §1 chrome, footer chip states (active gold,
// past #fef3c7, future #fffdf5, MONO chips), Play/Pause/Reset -- lives here so
// it can never drift between the twins.

export interface ErrorChromeProps {
  testId: string;
  title: string;
  totalBeats: number;
  step: number;
  /** Prose explanation for the current beat, rendered in the StepCaption block. */
  caption: string;
  /** MONO step/iteration label for the StepCaption header (e.g. "CHARLIE WRAPS"). */
  stepLabel: ReactNode;
  /** Optional bold accent-colored title for the StepCaption header. */
  stepTitle?: ReactNode;
  /** Active step's accent color (active hop / return-path green). Drives the block. */
  accentColor: string;
  /** Optional color-matched chip shown at the right of the StepCaption header. */
  chip?: ReactNode;
  onReset: () => void;
  onStep: (i: number) => void;
  /** Inner minWidth for the horizontally-scrolling stage. */
  stageMinWidth: number;
  children: ReactNode;
  /** Stage minHeight. */
  stageMinHeight?: number;
}

export function ErrorChrome({
  testId,
  title,
  totalBeats,
  step,
  caption,
  stepLabel,
  stepTitle,
  accentColor,
  chip,
  onReset,
  onStep,
  stageMinWidth,
  children,
  stageMinHeight = 360,
}: ErrorChromeProps) {
  const atFirst = step <= 0;
  const atEnd = step >= totalBeats - 1;
  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid={testId}
      style={{ fontFamily: SANS }}
    >
      {/* Header -- black bar, round gold dot, uppercase title, no subtitle. */}
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          {title}
        </span>
      </div>

      {/* Stage -- cream / dark, horizontally scrollable. */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: stageMinHeight }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: stageMinWidth }}>
            {children}

            {/* Per-beat explanation: ONE StepCaption block below the visual
                content, color-matched to the active step (§1.5). */}
            <StepCaption
              label={stepLabel}
              title={stepTitle}
              caption={caption}
              accentColor={accentColor}
              chip={chip}
            />
          </div>
        </div>
      </div>

      {/* Footer -- controls + numbered chips only (no caption; §1.5). */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={() => onStep(Math.max(0, step - 1))}
              disabled={atFirst}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              ← Back
            </button>
            <button
              onClick={() => onStep(Math.min(totalBeats - 1, step + 1))}
              disabled={atEnd}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              Next →
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1 flex-wrap">
              {Array.from({ length: totalBeats }, (_, i) => {
                const isActive = step === i;
                const isPast = i < step;
                return (
                  <button
                    key={i}
                    onClick={() => onStep(i)}
                    className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                    style={{
                      background: isActive
                        ? FOCUS_GOLD
                        : isPast
                          ? "#fef3c7"
                          : "#fffdf5",
                      borderColor: isActive
                        ? FOCUS_GOLD
                        : "rgba(15,23,42,0.4)",
                      color: isActive ? "#fff" : INK,
                      fontFamily: MONO,
                      cursor: "pointer",
                    }}
                  >
                    {i + 1}
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
