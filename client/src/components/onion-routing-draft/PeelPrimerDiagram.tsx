import { useEffect, useRef, useState } from "react";
import { SlotSubCell } from "./SlotSubCell";
import { MathLine, Tok } from "./mathTokens";
import { StepCaption } from "./StepCaption";
import { HatchOverlay } from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// PeelPrimerDiagram (privacy-accurate two-packet rebuild 2026-05-08)
//
// Two-packet view:
//   • TOP   , the INCOMING packet this hop received from the previous hop
//   • BOTTOM, the OUTGOING packet this hop CONSTRUCTS for the next hop
//              (read substep only; replaced with a destination panel for Dave)
//
// Privacy model: from each hop's perspective, only the hop payload they can read
// shows internal structure. The rest of the buffer (other hops' hop payloads,
// padding, filler) is rendered as a single gray block, no section
// dividers, no internal labels, because that's what an honest forwarder
// actually sees: encrypted bytes they can't decode. Same for the outgoing
// packet: the current hop is just bundling encrypted bytes for the next
// hop, so its payload is also gray.
//
// HMAC arrow: during the read substep, an SVG curve points from the
// visible hop payload's HMAC sub-cell (where the next-hop HMAC was sitting) down
// to the new outer HMAC tag on the outgoing packet, making the transfer
// visible.
//
// Substep flow:
//   verify   highlight outer HMAC on incoming; rest dimmed
//   decrypt  the payload area transitions from "gray" to "visible-hop payload +
//            gray", this is the moment the front hop payload becomes readable
//   read     outgoing packet appears below; HMAC arrow + transfer chips
//            spell out where each new field came from
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
const NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "for Charlie",
  charlie: "for Dave",
  dave: "none",
};
const NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: HOP_STROKE.charlie,
  charlie: HOP_STROKE.dave,
  dave: "#475569",
};
const SLOT_BYTES: Record<ForwarderId, number> = {
  bob: 60,
  charlie: 80,
  dave: 100,
};
// bigsize LEN encodes the TLV payload length only: the hop-payload total
// minus the 1-byte prefix and the trailing 32-byte HMAC.
const SLOT_BIGSIZE_HEX: Record<ForwarderId, string> = {
  bob: "0x1B", // 60-byte hop payload → 27
  charlie: "0x2F", // 80-byte hop payload → 47
  dave: "0x43", // 100-byte hop payload → 67
};

const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

const PEEL_ORDER: ForwarderId[] = ["bob", "charlie", "dave"];

type SubStep = "verify" | "decrypt" | "read";
const SUB_STEPS: SubStep[] = ["verify", "decrypt", "read"];

const SUB_STEP_LABEL: Record<SubStep, string> = {
  verify: "Verifying HMAC",
  decrypt: "Decrypting (XOR)",
  read: "Reading & forwarding",
};

interface PeelState {
  verified: Set<ForwarderId>;
  decrypted: Set<ForwarderId>;
  processed: Set<ForwarderId>;
  currentHop: ForwarderId | null;
  currentSubStep: SubStep | null;
}

function peelStateAtStep(step: number): PeelState {
  const verified = new Set<ForwarderId>();
  const decrypted = new Set<ForwarderId>();
  const processed = new Set<ForwarderId>();
  let currentHop: ForwarderId | null = null;
  let currentSubStep: SubStep | null = null;

  if (step === 0) {
    return { verified, decrypted, processed, currentHop, currentSubStep };
  }

  const idx = step - 1;
  const iteration = Math.floor(idx / 3);
  const sub = idx % 3;

  for (let it = 0; it <= iteration; it++) {
    const hop = PEEL_ORDER[it];
    const subLimit = it < iteration ? 3 : sub + 1;
    if (subLimit >= 1) verified.add(hop);
    if (subLimit >= 2) decrypted.add(hop);
    if (subLimit >= 3) processed.add(hop);
  }

  currentHop = PEEL_ORDER[iteration];
  currentSubStep = SUB_STEPS[sub];

  return { verified, decrypted, processed, currentHop, currentSubStep };
}

const TOTAL_BEATS = 10;
const TOTAL_BUFFER_BYTES = 1300;

const SLOT_WIDTH_PCT: Record<ForwarderId, number> = {
  bob: 28,
  charlie: 29,
  dave: 31,
};

// Dimming
const DIM_OPACITY = 0.18;
const DIM_TRANSITION = "opacity 400ms ease-out, box-shadow 400ms ease-out";
const FOCUS_RING =
  "0 0 0 2px rgba(184,134,11,0.55), 0 0 18px rgba(184,134,11,0.40)";
const FOCUS_RING_INSET =
  "inset 0 0 0 2px rgba(184,134,11,0.55), inset 0 0 18px rgba(184,134,11,0.35)";

// ── Packet config ──────────────────────────────────────────────────────────

interface SlotInBuffer {
  hop: ForwarderId;
  // Encryption layers still on this hop payload at this step. Empty list
  // means the hop payload has been decrypted and is now plaintext.
  layers: ForwarderId[];
  // True when the current viewer can read this hop payload (i.e., they
  // just decrypted it). Drives whether the slot renders with a full
  // SlotCell label or just a colored hatched block.
  visible: boolean;
}

// Wrap layers on slot S = all hops with peel index <= S's peel index.
// (PEEL_ORDER is [bob, charlie, dave]; in wrap order [dave, charlie, bob],
// each iteration encrypts the whole buffer, so deeper hops have more
// layers.) Subtract whatever's already been decrypted to get remaining.
function layersOnSlot(
  hop: ForwarderId,
  decrypted: Set<ForwarderId>,
): ForwarderId[] {
  const peelIdx = PEEL_ORDER.indexOf(hop);
  const wrapLayers = PEEL_ORDER.slice(0, peelIdx + 1);
  return wrapLayers.filter((h) => !decrypted.has(h));
}

// Padding has the same wrap-applied layers as the deepest slot (Dave),
// since it's been there since INIT.
function layersOnPadding(decrypted: Set<ForwarderId>): ForwarderId[] {
  return PEEL_ORDER.filter((h) => !decrypted.has(h));
}

interface PacketConfig {
  position: "incoming" | "outgoing";
  title: string;
  ephemeralLabel: string;
  ephemeralColor: string;
  ephemeralAnnotation?: string;
  // Slots in the buffer, front-to-back. Each carries its current
  // encryption layer count and whether the viewer can read it.
  slots: SlotInBuffer[];
  paddingBytes: number;
  paddingLayers: ForwarderId[];
  outerHmac:
    | { kind: "hop"; hop: ForwarderId; annotation?: string }
    | { kind: "zero" };
  // Per-step highlights / dimming
  highlightOuter: boolean;
  highlightPayload: boolean;
  showDecryptIndicator: boolean;
  decryptIndicatorHop: ForwarderId | null;
  highlightVisibleSlot: boolean;
  highlightZeroHmac: boolean;
  // Whether the visible hop payload's HMAC sub-cell is the source of an arrow,
  // and whether the outer HMAC is the target. Lets the SVG overlay find
  // them by data attribute.
  markHmacSource: boolean;
  markHmacTarget: boolean;
  // For outgoing packets only.
  isAssembling: boolean;
}

function buildIncomingPacket(state: PeelState): PacketConfig {
  const hop = state.currentHop ?? "bob";
  const sub = state.currentSubStep;

  let ephemeralLabel: string;
  let ephemeralColor: string;
  let title: string;
  let outerHmacHop: ForwarderId;
  if (hop === "bob") {
    ephemeralLabel = "E_AB";
    ephemeralColor = HOP_STROKE.bob;
    title = "Bob's incoming · received from Alice";
    outerHmacHop = "bob";
  } else if (hop === "charlie") {
    ephemeralLabel = "E_AC";
    ephemeralColor = HOP_STROKE.charlie;
    title = "Charlie's incoming · received from Bob";
    outerHmacHop = "charlie";
  } else {
    ephemeralLabel = "E_AD";
    ephemeralColor = HOP_STROKE.dave;
    title = "Dave's incoming · received from Charlie";
    outerHmacHop = "dave";
  }

  // Slots in this hop's incoming buffer = those not yet processed by an
  // earlier hop. (Dave's incoming has only Dave's; Charlie's has Charlie +
  // Dave; Bob's has all three.)
  const earlierProcessed = new Set<ForwarderId>(
    PEEL_ORDER.slice(0, PEEL_ORDER.indexOf(hop)),
  );
  const slotHops = PEEL_ORDER.filter((h) => !earlierProcessed.has(h));
  const canSee = state.decrypted.has(hop);
  const slots: SlotInBuffer[] = slotHops.map((h) => ({
    hop: h,
    layers: layersOnSlot(h, state.decrypted),
    visible: h === hop && canSee,
  }));
  const paddingBytes =
    TOTAL_BUFFER_BYTES - slotHops.reduce((sum, h) => sum + SLOT_BYTES[h], 0);

  return {
    position: "incoming",
    title,
    ephemeralLabel,
    ephemeralColor,
    slots,
    paddingBytes,
    paddingLayers: layersOnPadding(state.decrypted),
    outerHmac: { kind: "hop", hop: outerHmacHop },
    highlightOuter: sub === "verify",
    highlightPayload: sub === "decrypt",
    showDecryptIndicator: sub === "decrypt",
    decryptIndicatorHop: sub === "decrypt" ? hop : null,
    highlightVisibleSlot: sub === "read" && hop !== "dave",
    highlightZeroHmac: sub === "read" && hop === "dave",
    markHmacSource: sub === "read" && hop !== "dave",
    markHmacTarget: false,
    isAssembling: false,
  };
}

function buildOutgoingPacket(state: PeelState): PacketConfig | null {
  if (state.currentSubStep !== "read") return null;
  const hop = state.currentHop;
  if (hop === null || hop === "dave") return null;

  const nextHop = hop === "bob" ? "charlie" : "dave";
  const ephemeralLabel = nextHop === "charlie" ? "E_AC" : "E_AD";
  const ephemeralColor = HOP_STROKE[nextHop];
  const ephemeralAnnotation =
    nextHop === "charlie" ? "E_AC = bf_AB · E_AB" : "E_AD = bf_AC · E_AC";

  // Outgoing slots = those still in the buffer after the current hop's
  // hop payload has been removed (state.processed already includes the
  // current hop at the read substep).
  const slotHops = PEEL_ORDER.filter((h) => !state.processed.has(h));
  const slots: SlotInBuffer[] = slotHops.map((h) => ({
    hop: h,
    layers: layersOnSlot(h, state.decrypted),
    visible: false, // current hop can't see inside any of the outgoing slots
  }));
  const paddingBytes =
    TOTAL_BUFFER_BYTES - slotHops.reduce((sum, h) => sum + SLOT_BYTES[h], 0);

  return {
    position: "outgoing",
    title: `Outgoing · forwarded to ${HOP_LABEL[nextHop]}`,
    ephemeralLabel,
    ephemeralColor,
    ephemeralAnnotation,
    slots,
    paddingBytes,
    paddingLayers: layersOnPadding(state.decrypted),
    outerHmac: {
      kind: "hop",
      hop: nextHop,
      annotation: `extracted from ${HOP_LABEL[hop]}'s hop payload`,
    },
    highlightOuter: false,
    highlightPayload: false,
    showDecryptIndicator: false,
    decryptIndicatorHop: null,
    highlightVisibleSlot: false,
    highlightZeroHmac: false,
    markHmacSource: false,
    markHmacTarget: true,
    isAssembling: true,
  };
}

function isDestinationStep(state: PeelState): boolean {
  return state.currentHop === "dave" && state.currentSubStep === "read";
}

function currentOuterHmac(state: PeelState): ForwarderId | "zero" {
  if (state.processed.has("charlie")) return "dave";
  if (state.processed.has("bob")) return "charlie";
  return "bob";
}

function chainStatus(
  state: PeelState,
): Record<ForwarderId | "zero", "current" | "remaining" | "consumed"> {
  const status: Record<ForwarderId | "zero", "current" | "remaining" | "consumed"> = {
    bob: "remaining",
    charlie: "remaining",
    dave: "remaining",
    zero: "remaining",
  };
  if (state.processed.has("bob")) status.bob = "consumed";
  if (state.processed.has("charlie")) status.charlie = "consumed";
  if (state.processed.has("dave")) status.dave = "consumed";
  const outer = currentOuterHmac(state);
  status[outer] = "current";
  return status;
}

function captionForStep(step: number): string {
  if (step === 0) {
    return "Alice hands Bob a 1,366-byte onion. To Bob, that whole 1,300-byte payload area is just encrypted bytes he can't read yet (the gray block). The one thing he can point to is the packet's outer HMAC tag, `bob_hmac`.";
  }
  const state = peelStateAtStep(step);
  const hop = state.currentHop!;
  const sub = state.currentSubStep!;
  const hopName = HOP_LABEL[hop];

  if (sub === "verify") {
    return `First, ${hopName} recomputes \`HMAC-SHA256\` over the incoming \`hop_payloads\` with a key derived from his shared secret with Alice, then checks it against the outer HMAC tag in the packet. No match? The packet gets dropped. Match? Then ${hopName} can go ahead and decrypt.`;
  }
  if (sub === "decrypt") {
    return `Now, ${hopName} XORs the whole 1,300-byte \`hop_payloads\` buffer, byte-by-byte, against a 1,300-byte \`chacha20\` keystream from his shared secret with Alice. Watch the front: ${hopName}'s own hop payload turns into readable plaintext. Everything else stays encrypted noise to him.`;
  }
  if (hop === "dave") {
    return "Finally, Dave reads his hop payload. The HMAC field at the end is `0x00…` (32 zero bytes), which is the universal \"you're the destination\" signal. So Dave checks the payment hash and claims the funds. Nothing to forward, the onion stops here.";
  }
  const nextHop = hop === "bob" ? "Charlie" : "Dave";
  const incomingE = hop === "bob" ? "E_AB" : "E_AC";
  const outgoingE = nextHop === "Charlie" ? "E_AC" : "E_AD";
  const nextHopLower = nextHop.toLowerCase();
  return `Now ${hopName} reads his hop payload and builds a fresh 1,366-byte packet for ${nextHop}. The new header carries \`${outgoingE}\`, which he derives from the incoming \`${incomingE}\` with his blinding factor. Where does the new outer HMAC come from? It's \`${nextHopLower}_hmac\`, the value that was tucked inside ${hopName}'s hop payload, now promoted to the outer tag (the arrow shows the hand-off). The payload is just the still-encrypted bytes that came after ${hopName}'s hop payload, with fresh filler tacked on the back to hold the buffer at 1,300 bytes.`;
}

// ── Main component ──────────────────────────────────────────────────────────

export function PeelPrimerDiagram() {
  const [step, setStep] = useState(0);

  const reset = () => {
    setStep(0);
  };

  const state = peelStateAtStep(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="peel-primer"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Peeling the onion, hop by hop
          </span>
        </div>
      </div>

      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 360 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 740, maxWidth: 880 }}>
            <HopTrack state={state} />
            <div style={{ marginTop: 12 }} />
            <PacketStack state={state} step={step} />
            <HmacChainIndicator state={state} />
            {(() => {
              const hop = state.currentHop;
              const sub = state.currentSubStep;
              const accent = hop ? HOP_STROKE[hop] : "#475569";
              let label: string;
              let title: string;
              if (hop && sub) {
                const iter = PEEL_ORDER.indexOf(hop) + 1;
                const subIdx = SUB_STEPS.indexOf(sub) + 1;
                label = `Iteration ${iter}: ${HOP_LABEL[hop]} · Sub-step ${subIdx}/3`;
                title = SUB_STEP_LABEL[sub];
              } else {
                label = "Initial state · packet arrives at Bob";
                title = "Bob receives the onion";
              }
              return (
                <StepCaption
                  label={label}
                  title={title}
                  caption={renderCaptionWithCode(captionForStep(step))}
                  accentColor={accent}
                />
              );
            })()}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step <= 0}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-card"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(TOTAL_BEATS - 1, s + 1))}
              disabled={step >= TOTAL_BEATS - 1}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-card"
            >
              Next →
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <StepButtonsGrouped step={step} setStep={setStep} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes peel-fade-in {
          0% { transform: translateY(-4px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes packet-assemble {
          0% { transform: translateY(-8px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes arrow-draw {
          0% { stroke-dashoffset: 600; opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Hop track ───────────────────────────────────────────────────────────────

function HopTrack({ state }: { state: PeelState }) {
  // Where the onion currently sits along the route. At INIT the packet
  // has just arrived from Alice → Bob, so we land it on Bob. As later
  // iterations begin, the onion's `left` percentage updates and CSS
  // transitions animate the slide between hops.
  const onionHop: HopId = state.currentHop ?? "bob";

  return (
    <div className="relative mx-auto mb-3" style={{ height: 96, maxWidth: 720 }}>
      {[0, 1, 2].map((i) => {
        const a = HOPS[i];
        const b = HOPS[i + 1];
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              top: 22,
              left: `calc(${NODE_X_PCT[a]}% + 28px)`,
              width: `calc(${NODE_X_PCT[b] - NODE_X_PCT[a]}% - 56px)`,
              borderTop: "1.5px dashed #475569",
            }}
          />
        );
      })}

      {/* Traveling onion = miniature onion packet (HEADER | PAYLOAD | HMAC).
          Slides between hop columns when iterations advance. */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 62,
          left: `${NODE_X_PCT[onionHop]}%`,
          transform: "translateX(-50%)",
          transition: "left 850ms cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 5,
        }}
        aria-label={`Onion packet currently at ${HOP_LABEL[onionHop]}`}
      >
        <MiniOnionPacket hopColor={HOP_STROKE[onionHop]} />
      </div>

      {HOPS.map((id) => {
        const isCurrent = state.currentHop === id;
        const isCompleted =
          id !== "alice" && state.processed.has(id as ForwarderId);
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
                  width: 44,
                  height: 44,
                  background: HOP_FILL[id],
                  border: `2px solid ${HOP_STROKE[id]}`,
                  boxShadow: isCurrent
                    ? `0 0 0 4px rgba(184,134,11,0.30)`
                    : "none",
                  opacity: isCompleted || isCurrent ? 1 : 0.5,
                }}
              >
                <span
                  className="font-bold"
                  style={{ fontSize: 18, color: "#0f172a" }}
                >
                  {HOP_LABEL[id].charAt(0)}
                </span>
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{
                  color: "#0f172a",
                  opacity: isCompleted || isCurrent ? 1 : 0.5,
                }}
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

// ── Mini onion packet (the chip that rides the hop track) ─────────────────

// Tiny three-section bar matching the visual language of the full packet:
// dark gray HEADER on the left, hatched encrypted PAYLOAD in the middle,
// hop-colored HMAC tag on the right. Rendered with the same 1.5px black
// outline as the locked spec so it reads as "a packet" at a glance.
function MiniOnionPacket({ hopColor }: { hopColor: string }) {
  return (
    <div
      style={{
        width: 84,
        height: 22,
        display: "flex",
        background: "#fffdf5",
        border: "1.5px solid #0f172a",
        boxShadow: "0 2px 8px rgba(0,0,0,0.16)",
        transition: "border-color 400ms ease-out",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          width: 16,
          background: "#f1f5f9",
          borderRight: "1.5px solid #0f172a",
        }}
      />
      {/* PAYLOAD with diagonal stripe pattern */}
      <div
        style={{
          flex: 1,
          background: `${hopColor}1A`,
          backgroundImage: `repeating-linear-gradient(135deg, ${hopColor}99 0, ${hopColor}99 1px, transparent 1px, transparent 5px)`,
          transition: "background 600ms ease-out, background-image 600ms ease-out",
        }}
      />
      {/* HMAC */}
      <div
        style={{
          width: 14,
          background: `${hopColor}55`,
          borderLeft: "1.5px solid #0f172a",
          transition: "background 600ms ease-out",
        }}
      />
    </div>
  );
}

// ── Packet stack ────────────────────────────────────────────────────────────

function PacketStack({ state, step }: { state: PeelState; step: number }) {
  const incoming = buildIncomingPacket(state);
  const outgoing = buildOutgoingPacket(state);
  const destination = isDestinationStep(state);

  const containerRef = useRef<HTMLDivElement>(null);
  const [arrowPath, setArrowPath] = useState<string | null>(null);

  // Recompute the SVG arrow whenever the layout changes.
  useEffect(() => {
    if (!outgoing || !containerRef.current) {
      setArrowPath(null);
      return;
    }
    const compute = () => {
      const cont = containerRef.current;
      if (!cont) return;
      const source = cont.querySelector(
        '[data-hmac-source="true"]',
      ) as HTMLElement | null;
      const target = cont.querySelector(
        '[data-hmac-target="true"]',
      ) as HTMLElement | null;
      if (!source || !target) {
        setArrowPath(null);
        return;
      }
      const cb = cont.getBoundingClientRect();
      const sb = source.getBoundingClientRect();
      const tb = target.getBoundingClientRect();
      // Source: bottom-center of the hop payload's HMAC sub-cell
      const sx = sb.left + sb.width / 2 - cb.left;
      const sy = sb.bottom - cb.top;
      // Target: top-center of the outer HMAC cell
      const tx = tb.left + tb.width / 2 - cb.left;
      const ty = tb.top - cb.top;
      // Curved S-shape
      const midY = sy + (ty - sy) * 0.5;
      setArrowPath(
        `M ${sx} ${sy} C ${sx} ${midY} ${tx} ${midY} ${tx} ${ty}`,
      );
    };
    compute();
    // Recompute on resize too
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [step, outgoing]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <PacketView config={incoming} extraMarginBottom={outgoing ? 56 : 0} />
      {outgoing && <PacketView config={outgoing} />}
      {destination && <DestinationPanel />}

      {/* HMAC transfer arrow (SVG overlay) */}
      {arrowPath && (
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <defs>
            <marker
              id="hmac-arrow-head"
              markerWidth="10"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 10 4, 0 8" fill="#b8860b" />
            </marker>
          </defs>
          <path
            d={arrowPath}
            stroke="#b8860b"
            strokeWidth="2.25"
            fill="none"
            markerEnd="url(#hmac-arrow-head)"
            strokeDasharray="600"
            style={{
              animation: "arrow-draw 700ms ease-out forwards",
            }}
          />
        </svg>
      )}
    </div>
  );
}

// ── Single packet view ─────────────────────────────────────────────────────

function PacketView({
  config,
  extraMarginBottom = 0,
}: {
  config: PacketConfig;
  extraMarginBottom?: number;
}) {
  return (
    <div
      className="border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
        marginBottom: 12 + extraMarginBottom,
        animation: config.isAssembling
          ? "packet-assemble 450ms ease-out"
          : undefined,
      }}
    >
      <div
        className="bg-black text-white px-3 py-1.5 flex items-center gap-2"
        style={{ fontFamily: MONO }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: config.isAssembling ? "#10b981" : "#b8860b",
            display: "inline-block",
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          {config.title}
        </span>
        {config.isAssembling && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "#10b981",
              letterSpacing: "0.04em",
            }}
          >
            ASSEMBLING…
          </span>
        )}
      </div>

      <div className="p-3">
        <div
          className="flex"
          style={{
            background: "#fffdf5",
            border: "1.5px solid #0f172a",
          }}
        >
          <PacketHeader config={config} />

          <div
            className="relative"
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRight: "1.5px solid #0f172a",
              minWidth: 0,
              boxShadow: config.highlightPayload ? FOCUS_RING_INSET : "none",
              opacity: !config.highlightPayload && !config.highlightVisibleSlot && !config.highlightZeroHmac && config.highlightOuter
                ? DIM_OPACITY
                : 1,
              transition: DIM_TRANSITION,
            }}
          >
            <div className="text-center mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  fontFamily: MONO,
                  color: "#0f172a",
                  opacity: config.highlightOuter ? DIM_OPACITY : 1,
                  transition: DIM_TRANSITION,
                }}
              >
                PAYLOAD AREA · 1,300 BYTES
              </span>
            </div>
            <PayloadArea config={config} />
          </div>

          <PacketOuterHmacCell config={config} />
        </div>
      </div>
    </div>
  );
}

function PacketHeader({ config }: { config: PacketConfig }) {
  // Header is dim unless... actually nothing dims down to "focal header"
  // currently. So always dim slightly during interactions on payload/HMAC.
  const dim =
    config.highlightOuter ||
    config.highlightPayload ||
    config.highlightVisibleSlot ||
    config.highlightZeroHmac;
  return (
    <div
      className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
      style={{
        flexBasis: "16%",
        borderColor: "#0f172a",
        padding: "10px 6px",
        background: "#f1f5f9",
        opacity: dim ? DIM_OPACITY : 1,
        transition: DIM_TRANSITION,
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ fontFamily: MONO, color: "#0f172a" }}
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
        className="text-[9px] uppercase tracking-[0.05em] opacity-70"
        style={{ fontFamily: MONO }}
      >
        version
      </span>
      <span
        className="text-[11px] font-bold mt-0.5"
        style={{ fontFamily: MONO, color: "#0f172a" }}
      >
        0x00
      </span>
      <span
        className="text-[9px] uppercase tracking-[0.05em] opacity-70 mt-1.5"
        style={{ fontFamily: MONO }}
      >
        ephemeral pubkey
      </span>
      <span
        className="font-bold mt-0.5"
        style={{
          fontFamily: MONO,
          fontSize: 16,
          color: config.ephemeralColor,
        }}
      >
        <Tok token={config.ephemeralLabel} color={config.ephemeralColor} />
      </span>
      {config.ephemeralAnnotation && (
        <span
          className="mt-1"
          style={{
            fontFamily: MONO,
            fontSize: 8.5,
            color: "#475569",
            letterSpacing: "0.02em",
            fontStyle: "italic",
            lineHeight: 1.2,
          }}
        >
          {config.ephemeralAnnotation}
        </span>
      )}
    </div>
  );
}

function PacketOuterHmacCell({ config }: { config: PacketConfig }) {
  const outer = config.outerHmac;
  const color = outer.kind === "zero" ? "#475569" : HOP_STROKE[outer.hop];
  const label = outer.kind === "zero" ? "0x00…" : `${outer.hop}_hmac`;
  const flag =
    outer.kind === "zero"
      ? "(zeros)"
      : `for ${HOP_LABEL[outer.hop as ForwarderId]}`;
  const annotation = outer.kind === "hop" ? outer.annotation : undefined;
  const isFocus = config.highlightOuter || config.markHmacTarget;
  const isDimmed =
    !isFocus &&
    (config.highlightPayload ||
      config.highlightVisibleSlot ||
      config.highlightZeroHmac);
  return (
    <div
      data-hmac-target={config.markHmacTarget ? "true" : undefined}
      className="flex flex-col items-center justify-center text-center"
      style={{
        flexBasis: "14%",
        padding: "10px 4px",
        background: `${color}20`,
        boxShadow: isFocus ? FOCUS_RING_INSET : "none",
        opacity: isDimmed ? DIM_OPACITY : 1,
        transition: DIM_TRANSITION,
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.06em]"
        style={{ fontFamily: MONO, color: "#0f172a" }}
      >
        HMAC
      </span>
      <span
        className="text-[10px] font-bold mt-1"
        style={{ fontFamily: MONO, color }}
      >
        {flag}
      </span>
      <span
        className="text-[8.5px] opacity-60 mt-0.5"
        style={{ fontFamily: MONO, color: "#475569" }}
      >
        {label}
      </span>
      {annotation && (
        <span
          style={{
            marginTop: 3,
            fontFamily: MONO,
            fontSize: 8,
            color: "#475569",
            fontStyle: "italic",
            letterSpacing: "0.02em",
            lineHeight: 1.2,
          }}
        >
          {annotation}
        </span>
      )}
    </div>
  );
}

// ── Payload area: per-region rendering with layered colored hatches ────────

function PayloadArea({ config }: { config: PacketConfig }) {
  // Compute slot positions left-to-right.
  let cursor = 0;
  const slotLeft: Record<string, number> = {};
  for (const s of config.slots) {
    slotLeft[s.hop] = cursor;
    cursor += SLOT_WIDTH_PCT[s.hop];
  }
  const paddingLeft = cursor;
  const frontHop = config.slots.length > 0 ? config.slots[0].hop : null;

  return (
    <>
      {/* On the DECRYPT sub-step the keystream operand renders explicitly (the
          XOR rule: never just a "⊕ keystream" pill while hatch disappears).
          The buffer below is the live result; this hop's layer comes off as
          the XOR lands. */}
      {config.showDecryptIndicator && config.decryptIndicatorHop && (
        <KeystreamXorRow hop={config.decryptIndicatorHop} />
      )}

      <div
        className="relative"
        style={{
          background: "#fffdf5",
          height: 130,
          border: "1.5px dashed rgba(15,23,42,0.3)",
          marginBottom: 4,
        }}
      >
        {config.slots.map((slot) => {
          const isFront = slot.hop === frontHop;
          const ringed =
            (config.highlightVisibleSlot || config.highlightZeroHmac) && isFront;
          const highlightHmac = config.highlightZeroHmac && isFront;
          const markSource = config.markHmacSource && isFront && slot.visible;
          return (
            <SlotRegion
              key={slot.hop}
              hop={slot.hop}
              leftPct={slotLeft[slot.hop]}
              widthPct={SLOT_WIDTH_PCT[slot.hop]}
              layers={slot.layers}
              visible={slot.visible}
              ringed={ringed}
              highlightHmacSubcell={highlightHmac}
              markHmacSource={markSource}
            />
          );
        })}

        <PaddingRegion
          leftPct={paddingLeft}
          bytes={config.paddingBytes}
          layers={config.paddingLayers}
        />
      </div>
    </>
  );
}

function SlotRegion({
  hop,
  leftPct,
  widthPct,
  layers,
  visible,
  ringed,
  highlightHmacSubcell,
  markHmacSource,
}: {
  hop: ForwarderId;
  leftPct: number;
  widthPct: number;
  layers: ForwarderId[];
  visible: boolean;
  ringed: boolean;
  highlightHmacSubcell: boolean;
  markHmacSource: boolean;
}) {
  const stroke = HOP_STROKE[hop];
  const fill = HOP_FILL[hop];
  return (
    <div
      className="absolute"
      style={{
        top: 14,
        bottom: 14,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        background: fill,
        border: `1.5px solid ${stroke}`,
        boxShadow: ringed ? FOCUS_RING : "none",
        transition: "left 500ms ease-out, box-shadow 400ms ease-out",
        zIndex: 3,
        overflow: "hidden",
      }}
    >
      {visible && (
        <SlotCell
          hop={hop}
          highlightHmacSubcell={highlightHmacSubcell}
          markHmacSource={markHmacSource}
        />
      )}
      <HatchOverlay hops={layers} />
    </div>
  );
}

// Padding region: gray fill, byte count label, layered colored hatches
// matching whichever hops' encryption is still on these bytes.
function PaddingRegion({
  leftPct,
  bytes,
  layers,
}: {
  leftPct: number;
  bytes: number;
  layers: ForwarderId[];
}) {
  return (
    <div
      className="absolute"
      style={{
        top: 14,
        bottom: 14,
        left: `${leftPct}%`,
        right: 8,
        background: "#e2e8f0",
        border: "1px dashed rgba(15,23,42,0.18)",
        transition: "left 500ms ease-out",
        zIndex: 2,
        overflow: "hidden",
      }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
        style={{
          fontFamily: MONO,
          color: "#475569",
          letterSpacing: "0.04em",
          padding: "0 6px",
          zIndex: 1,
          gap: 2,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700 }}>padding</div>
        <div style={{ fontSize: 9 }}>{bytes.toLocaleString()} bytes</div>
      </div>
      <HatchOverlay hops={layers} />
    </div>
  );
}

// The keystream operand for a DECRYPT sub-step: a full hatched bar in the
// peeling hop's angle, with the chacha20 call as its label, XORed into the
// live buffer below it. Same grammar as the wrap/peel trace XOR stacks.
function KeystreamXorRow({ hop }: { hop: ForwarderId }) {
  const color = HOP_STROKE[hop];
  return (
    <div className="mb-1" style={{ animation: "peel-fade-in 350ms ease-out" }}>
      <div
        className="text-[10px] uppercase tracking-[0.06em] mb-1 text-center"
        style={{ fontFamily: MONO, color, fontWeight: 700 }}
      >
        keystream · front 1,300 B (full peel is 2,600, see ch 7)
      </div>
      <div
        className="border-[1.5px] relative overflow-hidden flex items-center justify-center"
        style={{ borderColor: color, height: 36, background: "#fffdf5" }}
      >
        <HatchOverlay hops={[hop]} />
        <span
          className="relative"
          style={{ zIndex: 2, background: "#fffdf5", padding: "1px 8px" }}
        >
          <MathLine text={`chacha20(rho_${hop}, 2600)[:1300]`} color={color} fontSize={11.5} />
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1 mb-0.5">
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
          ⊕
        </span>
        <span
          className="uppercase tracking-[0.06em]"
          style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#475569" }}
        >
          xored over the whole buffer ↓
        </span>
      </div>
    </div>
  );
}

// ── Destination panel (Dave's read step) ────────────────────────────────────

function DestinationPanel() {
  return (
    <div
      className="border-[1.5px] mb-3 px-4 py-3 text-center"
      style={{
        background: "#f0f7ff",
        borderColor: HOP_STROKE.dave,
        animation: "packet-assemble 450ms ease-out",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.1em] font-bold mb-1.5"
        style={{ fontFamily: MONO, color: HOP_STROKE.dave }}
      >
        Dave is the destination · no outgoing packet
      </div>
      <div
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12.5,
          color: "#0f172a",
          lineHeight: 1.5,
          maxWidth: 680,
          marginInline: "auto",
        }}
      >
        Dave reads the hop payload at the front of his decrypted payload. Its HMAC field is{" "}
        <code style={{ fontFamily: MONO }}>0x00…</code>{" "}
        (32 zero bytes), the universal "you're the destination" signal. So Dave checks that the payment hash is the one he was expecting and claims the funds. There's no next-hop HMAC to pull out and no packet to forward.
      </div>
    </div>
  );
}

// ── Hop payload cell ───────────────────────────────────────────────────────────────

function SlotCell({
  hop,
  highlightHmacSubcell,
  markHmacSource,
}: {
  hop: ForwarderId;
  highlightHmacSubcell?: boolean;
  markHmacSource?: boolean;
}) {
  const color = HOP_STROKE[hop];
  const fill = HOP_FILL[hop];
  const nextColor = NEXT_HOP_COLOR[hop];

  return (
    <div className="flex h-full" style={{ position: "relative" }}>
      <SlotSubCell
        section="len"
        className="flex items-center justify-center"
        style={{
          width: 30,
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
              color: "#475569",
              fontFamily: MONO,
              fontSize: 7.5,
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
              fontSize: 9,
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
              fontSize: 8.5,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            {HOP_LABEL[hop]}
          </div>
          <div
            className="whitespace-nowrap mt-0.5"
            style={{
              color: "#475569",
              fontFamily: MONO,
              fontSize: 8.5,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            {SLOT_BYTES[hop]} B
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
          boxShadow: highlightHmacSubcell ? FOCUS_RING_INSET : "none",
          transition: DIM_TRANSITION,
        }}
      >
        <div
          data-hmac-source={markHmacSource ? "true" : undefined}
          className="flex flex-col items-center"
          style={{
            background: "#fffdf5",
            border: highlightHmacSubcell || markHmacSource
              ? `1.5px solid #b8860b`
              : `1px solid ${nextColor}40`,
            padding: "2px 3px",
            position: "relative",
            zIndex: 6,
            minWidth: 0,
            transition: "border 400ms ease-out",
            boxShadow: markHmacSource
              ? "0 0 0 2px rgba(184,134,11,0.40)"
              : "none",
          }}
        >
          <div
            className="uppercase"
            style={{
              color: "#475569",
              fontFamily: MONO,
              fontSize: 7.5,
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
              fontSize: 8.5,
              letterSpacing: "0.01em",
              lineHeight: 1,
            }}
          >
            {NEXT_HOP_LABEL[hop]}
          </div>
        </div>
      </SlotSubCell>
    </div>
  );
}

// ── HMAC chain indicator ────────────────────────────────────────────────────

function HmacChainIndicator({ state }: { state: PeelState }) {
  const status = chainStatus(state);
  const sub = state.currentSubStep;
  // The chain is focal during INIT (introducing the chain) and verify
  // substeps (when the current outer is being checked). Otherwise it's
  // dimmed, it's contextual, not the action.
  const chainFocal = sub === null || sub === "verify";
  const pills: Array<{
    id: ForwarderId | "zero";
    label: string;
    color: string;
  }> = [
    { id: "bob", label: "bob_hmac", color: HOP_STROKE.bob },
    { id: "charlie", label: "charlie_hmac", color: HOP_STROKE.charlie },
    { id: "dave", label: "dave_hmac", color: HOP_STROKE.dave },
    { id: "zero", label: "0x00…", color: "#475569" },
  ];
  return (
    <div
      className="mb-4"
      style={{
        opacity: chainFocal ? 1 : DIM_OPACITY,
        transition: DIM_TRANSITION,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-2 text-center"
        style={{ color: "#475569", fontFamily: MONO }}
      >
        Per-hop HMACs (consumed outer → inner as each hop processes)
      </div>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {pills.map((p, i) => {
          const s = status[p.id];
          const isCurrent = s === "current";
          const isConsumed = s === "consumed";
          const pillFocal = chainFocal && isCurrent;
          const bg = isCurrent
            ? `${p.color}40`
            : isConsumed
              ? "#f1f5f9"
              : `${p.color}18`;
          const border = isCurrent
            ? p.color
            : isConsumed
              ? "rgba(15,23,42,0.15)"
              : `${p.color}80`;
          const color = isConsumed ? "#94a3b8" : p.color;
          const pillOpacity = chainFocal && !isCurrent ? 0.45 : 1;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div
                className="px-2 py-0.5 border-[1.5px]"
                style={{
                  background: bg,
                  borderColor: border,
                  color,
                  fontWeight: 700,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.02em",
                  textDecoration: isConsumed ? "line-through" : "none",
                  boxShadow: pillFocal ? FOCUS_RING : "none",
                  opacity: pillOpacity,
                  transition: "all 500ms ease-out",
                }}
              >
                {p.label}
              </div>
              {i < pills.length - 1 && (
                <span style={{ color: "#cbd5e1", fontSize: 12 }}>→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Render a caption string with backtick-quoted segments styled as inline
// code (monospace, light background, subtle border). Caption sources use
// `\`identifier\`` for code spans, e.g., `\`hop_payloads\``.
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

// ── Step buttons grouped under hop headers ─────────────────────────────────

interface StepButtonsGroupedProps {
  step: number;
  setStep: (n: number) => void;
}

function StepButtonsGrouped({
  step,
  setStep,
}: StepButtonsGroupedProps) {
  const groups: Array<{
    label: string;
    color: string;
    fill: string;
    steps: number[];
  }> = [
    { label: "INIT", color: "#475569", fill: "#f1f5f9", steps: [0] },
    {
      label: "BOB",
      color: HOP_STROKE.bob,
      fill: HOP_FILL.bob,
      steps: [1, 2, 3],
    },
    {
      label: "CHARLIE",
      color: HOP_STROKE.charlie,
      fill: HOP_FILL.charlie,
      steps: [4, 5, 6],
    },
    {
      label: "DAVE",
      color: HOP_STROKE.dave,
      fill: HOP_FILL.dave,
      steps: [7, 8, 9],
    },
  ];
  return (
    <div className="ml-1 flex gap-2 flex-wrap items-end">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col items-stretch gap-0.5">
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
                  borderColor: step === i ? "#b8860b" : g.color + "80",
                  color: step === i ? "#fff" : "#0f172a",
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PeelPrimerDiagram;
