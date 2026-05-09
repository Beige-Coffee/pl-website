import { useEffect, useRef, useState } from "react";
import { SlotSubCell } from "./SlotSubCell";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// PeelPrimerDiagram (built 2026-05-08)
//
// Mirror image of WrapPrimerDiagram. Same hop track, same buffer layout,
// same step controls, same visual language. The semantics are inverted:
// hatches *disappear* layer-by-layer as each hop XORs the buffer; slots
// get removed from the front instead of stacked; the HMAC chain consumes
// the outer pill at each iteration instead of building up to it.
//
// For each hop in ROUTE order (Bob → Charlie → Dave):
//   1. VERIFY:  outer_hmac == HMAC(mu_hop, hop_payloads)?
//   2. DECRYPT: hop_payloads ^= chacha20(rho_hop, 0, 1300). The hop's own
//               encryption layer is removed from every region in the buffer.
//   3. READ:    parse the slot at the FRONT of the buffer; extract its TLV
//               and next_hmac. Forward (shift left + filler at back), or
//               claim payment (Dave only — slot's hmac is 0x00…).
//
// In the visual:
//   • Step 0 (INIT): the full encrypted onion arrives at Bob — Bob's slot
//     has 1 hatch (rho_bob), Charlie's has 2 (rho_bob over rho_charlie),
//     Dave's has 3, padding has 3.
//   • Each DECRYPT removes one hatch layer from every region. Whichever
//     slot is currently at the front becomes plaintext.
//   • READ + forward shifts that front slot off the buffer; the next slot
//     slides into position 0. (Filler dynamics on the back of the buffer
//     are not depicted; we just label the trailing region "padding" since
//     ch.5 doesn't introduce filler yet.)
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
  bob: "→Charlie",
  charlie: "→Dave",
  dave: "0x00…",
};
const NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: HOP_STROKE.charlie,
  charlie: HOP_STROKE.dave,
  dave: "#475569",
};
const SLOT_BYTES: Record<ForwarderId, number> = {
  bob: 65,
  charlie: 65,
  dave: 100,
};
const SLOT_BIGSIZE_HEX: Record<ForwarderId, string> = {
  bob: "0x40",
  charlie: "0x40",
  dave: "0x63",
};
// Same hatch angles as wrap so each hop's encryption looks identical
// across the two diagrams.
const LAYER_ANGLES: Record<ForwarderId, number> = {
  bob: 135,
  charlie: 45,
  dave: 0,
};

const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];
const NODE_X_PCT: Record<HopId, number> = {
  alice: 14,
  bob: 38,
  charlie: 62,
  dave: 86,
};

// Peel order: forwarder by forwarder, in route order.
const PEEL_ORDER: ForwarderId[] = ["bob", "charlie", "dave"];

type SubStep = "verify" | "decrypt" | "read";
const SUB_STEPS: SubStep[] = ["verify", "decrypt", "read"];

const SUB_STEP_LABEL: Record<SubStep, string> = {
  verify: "Verifying HMAC",
  decrypt: "Decrypting (XOR)",
  read: "Reading slot",
};
const SUB_STEP_COLOR: Record<SubStep, string> = {
  verify: "#5a7a2f",
  decrypt: "#b8860b",
  read: "#3b6aa0",
};

interface PeelState {
  // Hops that have completed each sub-step.
  verified: Set<ForwarderId>;
  decrypted: Set<ForwarderId>;
  processed: Set<ForwarderId>;
  // Hop whose iteration is currently running (or null at INIT).
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

  const idx = step - 1; // 0..8
  const iteration = Math.floor(idx / 3); // 0=Bob, 1=Charlie, 2=Dave
  const sub = idx % 3; // 0=verify, 1=decrypt, 2=read

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
const STEP_MS = 2000;

// What's the current "outer" hmac at this step? At INIT it's bob_hmac
// (the packet header's HMAC). After Bob's READ substep, Charlie's hmac is
// the new outer (it was extracted from Bob's slot). And so on.
function currentOuterHmac(state: PeelState): ForwarderId | "zero" {
  if (state.processed.has("charlie")) return "dave";
  if (state.processed.has("bob")) return "charlie";
  return "bob";
}

// Whose HMAC pills along the chain are still in play (haven't been
// "consumed" by a forwarder yet)?
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
    return "Bob receives the 1,300-byte onion from Alice. The whole buffer is encrypted: Bob's slot has 1 layer of encryption, Charlie's has 2, Dave's and the padding have 3. The packet's outer HMAC is bob_hmac.";
  }
  const state = peelStateAtStep(step);
  const hop = state.currentHop!;
  const sub = state.currentSubStep!;
  const hopName = HOP_LABEL[hop];
  const slotSize = SLOT_BYTES[hop];
  const innerHop = (() => {
    if (hop === "bob") return "charlie";
    if (hop === "charlie") return "dave";
    return null;
  })() as ForwarderId | null;

  if (sub === "verify") {
    return `Verify the outer HMAC: does it match HMAC over the encrypted buffer using a key derived from ${hopName}'s shared secret? If yes, the packet is authentic and ${hopName} can proceed. If no, the packet is dropped.`;
  }
  if (sub === "decrypt") {
    return `XOR the entire 1,300-byte buffer with an encryption keystream derived from ${hopName}'s shared secret. ${hopName}'s encryption layer comes off every region in the buffer. ${hopName}'s slot is now in plaintext; every later slot has one fewer encryption layer than before.`;
  }
  // read
  if (hop === "dave") {
    return `${hopName} reads his slot. The slot's HMAC field is 32 zero bytes — the universal signal "you're the destination". ${hopName} verifies the payment hash matches what he was expecting and claims the funds.`;
  }
  return `${hopName} reads his slot: amt_to_forward, outgoing_cltv, short_channel_id, and ${innerHop}_hmac. ${hopName} shifts the buffer left by ${slotSize} bytes (his slot drops off the front), then forwards the resulting 1,300-byte packet to ${HOP_LABEL[innerHop!]} with ${innerHop}_hmac as the new outer HMAC.`;
}

// ── Main component ──────────────────────────────────────────────────────────

export function PeelPrimerDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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

  const state = peelStateAtStep(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="peel-primer"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Peeling the onion, hop by hop
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 660 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 740, maxWidth: 880 }}>
            {/* Hop track */}
            <HopTrack state={state} />

            <div style={{ marginTop: 12 }} />

            {/* Onion packet visualization */}
            <DetailedPacket state={state} step={step} />

            {/* HMAC chain (consumed left to right as hops process) */}
            <HmacChainIndicator state={state} />

            {/* Step action panel — explains what's happening */}
            <StepActionPanel step={step} />
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
            <StepButtonsGrouped step={step} setStep={setStep} setPlaying={setPlaying} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hop track (matches wrap-primer's style) ────────────────────────────────

function HopTrack({ state }: { state: PeelState }) {
  return (
    <div className="relative mx-auto mb-3" style={{ height: 80, maxWidth: 720 }}>
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
              borderTop: "1.5px dashed #94a3b8",
            }}
          />
        );
      })}

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
                  width: 48,
                  height: 48,
                  background: HOP_FILL[id],
                  border: `2px solid ${HOP_STROKE[id]}`,
                  boxShadow: isCurrent
                    ? `0 0 0 4px rgba(184,134,11,0.30)`
                    : "none",
                  opacity: isCompleted || isCurrent ? 1 : 0.85,
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
                style={{ color: "#0f172a" }}
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

// ── Detailed onion packet ───────────────────────────────────────────────────

function DetailedPacket({ state, step }: { state: PeelState; step: number }) {
  const titleText =
    step === 0
      ? "onion_routing_packet (received from Alice)"
      : state.processed.has("dave")
        ? "onion_routing_packet (peeled to destination)"
        : "onion_routing_packet (mid-peel)";

  return (
    <div
      className="border-[1.5px] mb-4"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
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
            background: "#b8860b",
            display: "inline-block",
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          {titleText}
        </span>
      </div>

      <div className="p-3">
        <div
          className="flex"
          style={{
            background: "#fffdf5",
            border: "1.5px solid #0f172a",
          }}
        >
          {/* HEADER */}
          <div
            className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
            style={{
              flexBasis: "15%",
              borderColor: "#0f172a",
              padding: "10px 6px",
              background: "#f1f5f9",
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
                color: HOP_STROKE.bob,
              }}
            >
              <Tok token="E_AB" color={HOP_STROKE.bob} />
            </span>
          </div>

          {/* PAYLOAD AREA */}
          <div
            className="relative"
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRight: "1.5px solid #0f172a",
              minWidth: 0,
            }}
          >
            <div className="text-center mb-2">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ fontFamily: MONO, color: "#0f172a" }}
              >
                PAYLOAD AREA · 1,300 BYTES
              </span>
            </div>
            <PayloadAreaLinear state={state} step={step} />
          </div>

          {/* OUTER HMAC — always present in peel (the packet ARRIVES with
              an outer HMAC). Its label changes as forwarders extract the
              next outer HMAC from the slot they decrypt. */}
          <OuterHmacCell state={state} />
        </div>
      </div>
    </div>
  );
}

function OuterHmacCell({ state }: { state: PeelState }) {
  const outer = currentOuterHmac(state);
  const color = outer === "zero" ? "#475569" : HOP_STROKE[outer];
  const label = outer === "zero" ? "0x00…" : `${outer}_hmac`;
  const flag = outer === "zero" ? "(zeros)" : `→ ${HOP_LABEL[outer as ForwarderId]}`;
  const isVerifying =
    state.currentSubStep === "verify" && state.currentHop !== null;

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        flexBasis: "13%",
        padding: "10px 4px",
        background: `${color}20`,
        boxShadow: isVerifying
          ? `0 0 0 2px ${color}AA inset, 0 0 12px ${color}55 inset`
          : "none",
        transition: "box-shadow 400ms ease-out, background 400ms ease-out",
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
    </div>
  );
}

// ── Linear byte-accurate payload area (peel semantics) ──────────────────────

const SLOT_WIDTH_PCT: Record<ForwarderId, number> = {
  bob: 22,
  charlie: 22,
  dave: 26,
};
const TOTAL_BUFFER_BYTES = 1300;

// What encryption layers are still on a slot (or the padding) at this peel
// step? Wrap applied layers in the build order [dave, charlie, bob], so
// each region's full layer set is its slot's wrap layers minus whichever
// hops have already DECRYPTED their layer.
function peelLayers(
  region: ForwarderId | "padding",
  state: PeelState,
): ForwarderId[] {
  // Wrap-applied layers, in the order they were applied (oldest first).
  let wrapLayers: ForwarderId[];
  if (region === "bob") wrapLayers = ["bob"];
  else if (region === "charlie") wrapLayers = ["charlie", "bob"];
  else wrapLayers = ["dave", "charlie", "bob"]; // dave + padding
  return wrapLayers.filter((hop) => !state.decrypted.has(hop));
}

function PayloadAreaLinear({
  state,
  step: _step,
}: {
  state: PeelState;
  step: number;
}) {
  // Slots still in the buffer = those not yet processed (read+shifted).
  // Order is the route order, with the front-most slot being the next to
  // process. (When Bob has shifted, Charlie is at the front; etc.)
  const slotOrder: ForwarderId[] = PEEL_ORDER.filter(
    (hop) => !state.processed.has(hop),
  );

  // Compute left-edge percentage for each remaining slot.
  let cursor = 0;
  const slotLeft: Record<string, number> = {};
  for (const hop of slotOrder) {
    slotLeft[hop] = cursor;
    cursor += SLOT_WIDTH_PCT[hop];
  }
  const paddingLeft = cursor;

  // Padding bytes = 1300 minus the bytes still occupied by remaining slots.
  const paddingBytes =
    TOTAL_BUFFER_BYTES -
    slotOrder.reduce((sum, hop) => sum + SLOT_BYTES[hop], 0);

  const isDecrypting =
    state.currentSubStep === "decrypt" && state.currentHop !== null;

  return (
    <div
      className="relative"
      style={{
        background: "#fffdf5",
        height: 130,
        border: "1.5px dashed rgba(15,23,42,0.3)",
        marginBottom: 4,
      }}
    >
      {slotOrder.map((hop) => {
        const just =
          state.currentSubStep === "read" && state.currentHop === hop;
        return (
          <SlotRegion
            key={hop}
            hop={hop}
            leftPct={slotLeft[hop]}
            widthPct={SLOT_WIDTH_PCT[hop]}
            layers={peelLayers(hop, state)}
            justRead={just}
          />
        );
      })}

      <PaddingRegion
        leftPct={paddingLeft}
        bytes={paddingBytes}
        layers={peelLayers("padding", state)}
      />

      {/* Decrypt-step marker: a small "⊕ rho_hop" badge floats above the
          buffer when an XOR is in progress, mimicking the user's reference
          image where the keystream is shown explicitly. */}
      {isDecrypting && state.currentHop && (
        <DecryptIndicator hop={state.currentHop} />
      )}
    </div>
  );
}

function SlotRegion({
  hop,
  leftPct,
  widthPct,
  layers,
  justRead,
}: {
  hop: ForwarderId;
  leftPct: number;
  widthPct: number;
  layers: ForwarderId[];
  justRead: boolean;
}) {
  const stroke = HOP_STROKE[hop];
  return (
    <div
      className="absolute"
      style={{
        top: 14,
        bottom: 14,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        boxShadow: justRead
          ? `0 0 0 2px ${stroke}AA, 0 0 14px ${stroke}66`
          : "none",
        transition: "left 500ms ease-out, box-shadow 500ms ease-out",
        zIndex: 3,
      }}
    >
      <SlotCell hop={hop} />
      <HatchOverlay hops={layers} />
    </div>
  );
}

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
        background: "rgba(0,0,0,0.04)",
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
          fontStyle: "italic",
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

function HatchOverlay({ hops }: { hops: ForwarderId[] }) {
  const perLayer = 0.13;
  return (
    <>
      {hops.map((hop) => (
        <div
          key={hop}
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${HOP_STROKE[hop]} 0px, ${HOP_STROKE[hop]} 1.5px, transparent 1.5px, transparent 14px)`,
            opacity: perLayer,
            transition: "opacity 800ms ease-out",
            zIndex: 4,
          }}
        />
      ))}
    </>
  );
}

// Floats above the payload area during the DECRYPT substep. Shows what
// keystream is being XOR'd, with a sweeping arrow effect that visually
// echoes the user's reference image (the buffer XOR'd against rho).
function DecryptIndicator({ hop }: { hop: ForwarderId }) {
  const stroke = HOP_STROKE[hop];
  return (
    <div
      className="absolute"
      style={{
        top: -16,
        right: 10,
        zIndex: 8,
        animation: "peel-fade-in 350ms ease-out",
      }}
    >
      <div
        className="px-2 py-0.5"
        style={{
          background: "#fffdf5",
          border: `1.5px solid ${stroke}`,
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: 700,
          color: stroke,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        ⊕ rho_{hop} keystream
      </div>
      <style>{`
        @keyframes peel-fade-in {
          0% { transform: translateY(-4px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SlotCell({ hop }: { hop: ForwarderId }) {
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
            padding: "2px 6px",
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
              fontSize: 11,
              letterSpacing: "0.05em",
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
            {SLOT_BYTES[hop]} bytes
          </div>
        </div>
      </SlotSubCell>

      <SlotSubCell
        section="hmac"
        className="flex items-center justify-center"
        style={{
          width: 54,
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

// ── HMAC chain indicator (peel: consume from outer to inner) ───────────────

function HmacChainIndicator({ state }: { state: PeelState }) {
  const status = chainStatus(state);
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
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-2 text-center"
        style={{ color: "#475569", fontFamily: MONO }}
      >
        HMAC chain (consumed outer → inner as each hop processes)
      </div>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {pills.map((p, i) => {
          const s = status[p.id];
          const isCurrent = s === "current";
          const isConsumed = s === "consumed";
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
                  boxShadow: isCurrent
                    ? `0 0 0 2px ${p.color}55`
                    : "none",
                  transition: "all 500ms ease-out",
                }}
              >
                {p.label}
              </div>
              {i < pills.length - 1 && (
                <span
                  style={{
                    color: "#cbd5e1",
                    fontSize: 12,
                  }}
                >
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step action panel (prose explanation) ──────────────────────────────────

function StepActionPanel({ step }: { step: number }) {
  const state = peelStateAtStep(step);
  const hop = state.currentHop;
  const sub = state.currentSubStep;
  const accent = hop ? HOP_STROKE[hop] : "#475569";

  let headerText: string;
  if (hop && sub) {
    const iter = PEEL_ORDER.indexOf(hop) + 1;
    const subIdx = SUB_STEPS.indexOf(sub) + 1;
    headerText = `Iteration ${iter}: ${HOP_LABEL[hop]} · Sub-step ${subIdx}/3 · ${SUB_STEP_LABEL[sub]}`;
  } else {
    headerText = "Initial state · packet arrives at Bob";
  }

  return (
    <div
      className="border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "rgba(15,23,42,0.25)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div
        className="px-3 py-1.5 border-b-[1.5px]"
        style={{
          borderColor: "rgba(15,23,42,0.15)",
          background: hop ? HOP_FILL[hop] : "#f1f5f9",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: "#0f172a" }}
        >
          {headerText}
        </span>
      </div>
      <div
        className="px-3 py-2.5"
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "#0f172a",
        }}
      >
        {captionForStep(step)}
      </div>
    </div>
  );
}

// ── Step buttons grouped under hop headers (route order) ───────────────────

interface StepButtonsGroupedProps {
  step: number;
  setStep: (n: number) => void;
  setPlaying: (b: boolean) => void;
}

function StepButtonsGrouped({
  step,
  setStep,
  setPlaying,
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
                  setPlaying(false);
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
