import { useState, type ReactNode } from "react";
import { HatchOverlay, LAYER_COLORS, type ForwarderId } from "./encryptionHatch";
import { KeyDerivationCard } from "./KeyDerivationCard";
import { StepCaption } from "./StepCaption";

// ────────────────────────────────────────────────────────────────────────────
// ForwarderPeelDiagram (rebuilt 2026-05-10 for BOLT 4 accuracy)
//
// 7-step walkthrough of what a forwarder (Bob) actually does when peeling
// an onion. Per BOLT 4 spec: the decryption AND the trailing-byte generation
// happen in a SINGLE XOR pass over an extended buffer, not in two separate
// operations. The earlier "decrypt → fill gap with zeros → XOR zeros against
// keystream extension → splice" sequence was pedagogically clearer but
// technically inaccurate; this version mirrors what BOLT 4 / LDK actually do.
//
// Steps:
//   1. Bob receives the 1,366-byte packet from Alice.
//   2. Bob derives his per-hop keys (rho_B, mu_B) via ECDH on E_AB.
//   3. Bob verifies the outer HMAC (green ✓ badge at Bob's node).
//   4. Bob extends `hop_payloads` with 1,300 zero bytes (1,300 →
//      2 × ROUTING_INFO_SIZE = 2,600) and generates a matching 2,600-byte
//      `rho_B` keystream via chacha20(rho_B, 2600). The visual below zooms
//      in on the meaningful first 1,360 bytes (Bob's 60-byte hop payload +
//      the 1,300 that become Charlie's view); the trailing 1,240 bytes are
//      discarded after the slice.
//   5. Bob XORs the extended buffer with the keystream in a single pass.
//      The XOR simultaneously: (a) decrypts Bob's hop payload (first 60
//      bytes → plaintext), (b) peels one encryption layer off the rest of
//      the buffer, and (c) produces 60 new bytes at the back of the buffer
//      from `zeros ⊕ rho_B[1,300..1,359]`.
//   6. Bob slices off his hop payload from the front (60 bytes); the
//      decrypted callout shows the LEN / TLV / HMAC contents. The remaining
//      1,300 bytes ARE Charlie's hop_payloads: shifted slot region + 2-layer
//      padding + the 60 new trailing bytes from the XOR.
//   7. Bob swaps the envelope (E_AB → E_AC, bob_hmac → charlie_hmac) and
//      ships to Charlie. Charlie receives, verifies his HMAC, and the
//      chain continues (green ✓ at Charlie's node).
//
// Non-focused regions of the main packet fade to DIM_OPACITY (0.18,
// matching PeelPrimerDiagram) so the reader's eye lands on the part of
// the packet that's relevant to the current step. Transitions on opacity
// are 400ms ease-out, also matching PeelPrimer.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const FOCUS_GOLD = "#b8860b";
const SUCCESS_GREEN = "#5a7a2f";
const NEUTRAL_TEXT = "#475569";
const INK = "#0f172a";
const ZERO_FILL = "#f1f5f9";
const ZERO_STROKE = "#94a3b8";
const DIM_OPACITY = 0.18;
const DIM_TRANSITION = "opacity 400ms ease-out, box-shadow 400ms ease-out";

const HOP_LIGHT: Record<ForwarderId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};

const ROUTING_INFO_SIZE = 1300;
const BOB_PAYLOAD = 60;
const CHARLIE_PAYLOAD = 80;
const DAVE_PAYLOAD = 100;
const BOB_KEYSTREAM_LEN = ROUTING_INFO_SIZE + BOB_PAYLOAD; // 1,360

const REGULAR_PCT = 78;
const EXTENSION_PCT = 22;

// ── Step definitions ─────────────────────────────────────────────────────

interface StepDef {
  step: number;
  title: string;
  caption: string;
}

const STEPS: StepDef[] = [
  {
    step: 1,
    title: "Bob receives the packet",
    caption:
      "Alice sends the 1,366-byte onion to Bob. Right now the hop_payloads field is fully wrapped: Bob's hop payload has 1 encryption layer, Charlie's has 2, Dave's has 3, and the padding has 3.",
  },
  {
    step: 2,
    title: "Bob derives his per-hop keys",
    caption:
      "First, Bob computes `ss_AB = ECDH(node_priv_B, E_AB)` from the ephemeral pubkey in the header. From that shared secret he derives `rho_B = HMAC('rho', ss_AB)` and `mu_B = HMAC('mu', ss_AB)`. He'll reach for `mu_B` next to verify, then `rho_B` for the single XOR pass.",
  },
  {
    step: 3,
    title: "Bob verifies the outer HMAC",
    caption:
      "Now Bob recomputes `HMAC-SHA256(mu_B, hop_payloads ‖ associated_data)` and checks it against the HMAC field. Do they match? Yes! So Bob knows the packet is authentic and untouched.",
  },
  {
    step: 4,
    title: "Bob extends the buffer and generates a matching keystream",
    caption:
      "Next, Bob tacks 1,300 zero bytes onto `hop_payloads`, growing it from 1,300 to `2 × ROUTING_INFO_SIZE = 2,600` bytes. He also generates a matching 2,600-byte `rho_B` keystream from `chacha20(rho_B, 2600)`, ready to XOR against the extended buffer. (The diagram above zooms in on the first 1,360 bytes that matter: Bob's 60-byte hop payload plus the 1,300 that become Charlie's view. The other 1,240 get thrown away after the slice.)",
  },
  {
    step: 5,
    title: "Bob XORs the extended buffer with the keystream (one pass)",
    caption:
      "Now watch what that single XOR pass does all at once. It runs over the whole 2,600-byte buffer (we're zoomed in on the first 1,360 here, the part Bob lifts for Charlie) and in one go it (a) decrypts Bob's hop payload at the front (60 bytes → plaintext), (b) peels one encryption layer off the downstream payloads and padding, and (c) generates the 60 new padding bytes at the back of Charlie's view (from `zeros ⊕ rho_B[1,300..1,359]`). Pretty slick, right?",
  },
  {
    step: 6,
    title: "Bob slices off his hop payload; the rest is Charlie's hop_payloads",
    caption:
      "Then Bob chops off the first 60 bytes of the XOR result (his plaintext hop payload, including `charlie_hmac` lifted from the TLV). What's left is exactly 1,300 bytes: Charlie's hop payload up front, then Dave's, then the encrypted padding, and the last 60 are the new filler bytes the XOR made. Those 60 are *exactly* what Alice's filler precomputed.",
  },
  {
    step: 7,
    title: "Bob swaps the envelope and ships to Charlie",
    caption:
      "Finally, Bob swaps the ephemeral pubkey (`E_AB → E_AC`, derived by blinding) and the outer HMAC (`bob_hmac → charlie_hmac`, pulled from his decrypted TLV). The 1,366-byte packet heads to Charlie, who recomputes his HMAC over what arrived. It matches the field Bob just set, so Charlie accepts and the chain keeps going.",
  },
];

const TOTAL_STEPS = STEPS.length;

// ── Focus per step (which packet regions are bright vs dimmed) ───────────

interface StepFocus {
  header: number; // opacity
  payload: number;
  hmac: number;
}

function focusFor(step: number): StepFocus {
  switch (step) {
    case 1:
      return { header: 1, payload: 1, hmac: 1 };
    case 2:
      return { header: 1, payload: DIM_OPACITY, hmac: DIM_OPACITY };
    case 3:
      return { header: DIM_OPACITY, payload: DIM_OPACITY, hmac: 1 };
    case 4:
    case 5:
    case 6:
      return { header: DIM_OPACITY, payload: 1, hmac: DIM_OPACITY };
    case 7:
      return { header: 1, payload: DIM_OPACITY, hmac: 1 };
    default:
      return { header: 1, payload: 1, hmac: 1 };
  }
}

// ── Hop track ────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";
const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};
const HOP_FILL_COLOR: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE_COLOR: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};
const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];

interface HopTrackState {
  packetAt: "alice-to-bob" | "bob" | "bob-to-charlie";
  hmacVerifiedAtBob: boolean;
  hmacVerifiedAtCharlie: boolean;
}

function hopTrackStateFor(step: number): HopTrackState {
  if (step === 1)
    return {
      packetAt: "alice-to-bob",
      hmacVerifiedAtBob: false,
      hmacVerifiedAtCharlie: false,
    };
  if (step <= 2)
    return {
      packetAt: "bob",
      hmacVerifiedAtBob: false,
      hmacVerifiedAtCharlie: false,
    };
  if (step <= 6)
    return {
      packetAt: "bob",
      hmacVerifiedAtBob: true,
      hmacVerifiedAtCharlie: false,
    };
  // step 7
  return {
    packetAt: "bob-to-charlie",
    hmacVerifiedAtBob: true,
    hmacVerifiedAtCharlie: true,
  };
}

function HopTrack({ state }: { state: HopTrackState }) {
  const packetPct =
    state.packetAt === "alice-to-bob"
      ? (NODE_X_PCT.alice + NODE_X_PCT.bob) / 2
      : state.packetAt === "bob"
        ? NODE_X_PCT.bob
        : (NODE_X_PCT.bob + NODE_X_PCT.charlie) / 2;

  return (
    <div className="relative mb-3" style={{ height: 86 }}>
      <div
        className="absolute"
        style={{
          top: 22,
          left: "12%",
          width: "76%",
          borderTop: "1.5px dashed #475569",
        }}
      />

      {state.packetAt !== "bob" && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: 18,
            left:
              state.packetAt === "alice-to-bob"
                ? `calc(${NODE_X_PCT.alice}% + 26px)`
                : `calc(${NODE_X_PCT.bob}% + 26px)`,
            width:
              state.packetAt === "alice-to-bob"
                ? `calc(${NODE_X_PCT.bob - NODE_X_PCT.alice}% - 52px)`
                : `calc(${NODE_X_PCT.charlie - NODE_X_PCT.bob}% - 52px)`,
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
      )}

      <div
        className="absolute pointer-events-none"
        style={{
          top: 6,
          left: `${packetPct}%`,
          transform: "translateX(-50%)",
          transition: "left 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      >
        <MiniPacket
          envelopeColor={
            state.packetAt === "bob-to-charlie"
              ? HOP_STROKE_COLOR.charlie
              : HOP_STROKE_COLOR.bob
          }
        />
      </div>

      {HOPS.map((id) => {
        const isHolder = id === "bob" && state.packetAt === "bob";
        const verified =
          (id === "bob" &&
            state.hmacVerifiedAtBob &&
            state.packetAt === "bob") ||
          (id === "charlie" && state.hmacVerifiedAtCharlie);
        const size = 44;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: 18,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
              zIndex: verified ? 6 : 1,
            }}
          >
            <div className="flex flex-col items-center">
              <div className="relative">
                <div
                  className="rounded-full flex items-center justify-center transition-all"
                  style={{
                    width: size,
                    height: size,
                    background: HOP_FILL_COLOR[id],
                    border: `2px solid ${HOP_STROKE_COLOR[id]}`,
                    borderWidth: isHolder ? 3 : 2,
                    boxShadow: isHolder
                      ? `0 0 0 4px rgba(184,134,11,0.30)`
                      : "none",
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ fontSize: size * 0.42, color: INK }}
                  >
                    {HOP_LABEL[id].charAt(0)}
                  </span>
                </div>
                {verified && (
                  <div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      background: SUCCESS_GREEN,
                      color: "#fffdf5",
                      fontWeight: 900,
                      fontSize: 13,
                      lineHeight: 1,
                      border: "1.5px solid #fffdf5",
                      boxShadow: "0 2px 6px rgba(90,122,47,0.4)",
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{ color: INK }}
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

function MiniPacket({ envelopeColor }: { envelopeColor: string }) {
  return (
    <div
      className="border-[1.5px] flex"
      style={{
        width: 86,
        height: 18,
        background: "#fffdf5",
        borderColor: INK,
        overflow: "hidden",
        boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
      }}
    >
      <div
        style={{
          flexBasis: 12,
          flexShrink: 0,
          background: `${envelopeColor}24`,
          borderRight: "1.5px solid #0f172a",
          transition: "background 600ms ease-out",
        }}
      />
      <div className="relative" style={{ flex: 1, overflow: "hidden" }}>
        <HatchOverlay
          hops={["bob", "charlie", "dave"]}
          zIndex={0}
          stripeOpacity={0.18}
        />
      </div>
      <div
        style={{
          flexBasis: 10,
          flexShrink: 0,
          background: `${envelopeColor}24`,
          borderLeft: "1.5px solid #0f172a",
          transition: "background 600ms ease-out",
        }}
      />
    </div>
  );
}

// ── Main packet state per step ───────────────────────────────────────────

interface PacketState {
  ephemeralPubkey: "E_AB" | "E_AC";
  segmentLabel: string;
  slots: Array<{
    hop: ForwarderId;
    layers: ForwarderId[];
    decrypted: boolean;
  }>;
  paddingLayers: ForwarderId[];
  trailing: "none" | "placeholder" | "encrypted";
  outerHmac: "bob_hmac" | "charlie_hmac";
}

function packetStateFor(step: number): PacketState {
  // Steps 1–3: packet just arrived from Alice. Fully wrapped, no extension yet.
  if (step <= 3) {
    return {
      ephemeralPubkey: "E_AB",
      segmentLabel:
        step === 1
          ? "ONION_PACKET (Alice → Bob)"
          : "ONION_PACKET (at Bob)",
      slots: [
        { hop: "bob", layers: ["bob"], decrypted: false },
        { hop: "charlie", layers: ["bob", "charlie"], decrypted: false },
        { hop: "dave", layers: ["bob", "charlie", "dave"], decrypted: false },
      ],
      paddingLayers: ["bob", "charlie", "dave"],
      trailing: "none",
      outerHmac: "bob_hmac",
    };
  }

  // Step 4: Bob extends hop_payloads with 60 zero bytes. The buffer-
  // extension and keystream live entirely in the SidePanel; the main
  // packet still shows the canonical 1,300-byte hop_payloads (no trailing
  // region) so the reader's mental model of "fixed-size hop_payloads"
  // doesn't wobble.
  if (step === 4) {
    return {
      ephemeralPubkey: "E_AB",
      segmentLabel: "ONION_PACKET (at Bob)",
      slots: [
        { hop: "bob", layers: ["bob"], decrypted: false },
        { hop: "charlie", layers: ["bob", "charlie"], decrypted: false },
        { hop: "dave", layers: ["bob", "charlie", "dave"], decrypted: false },
      ],
      paddingLayers: ["bob", "charlie", "dave"],
      trailing: "none",
      outerHmac: "bob_hmac",
    };
  }

  // Step 5: single XOR has executed. Bob's slot is plaintext, downstream
  // and padding each lost one encryption layer. The new 60 trailing bytes
  // live in the SidePanel's result row, not in the main packet - they
  // join the main packet at step 6 when the slice happens.
  if (step === 5) {
    return {
      ephemeralPubkey: "E_AB",
      segmentLabel: "ONION_PACKET (at Bob, after XOR)",
      slots: [
        { hop: "bob", layers: [], decrypted: true },
        { hop: "charlie", layers: ["charlie"], decrypted: false },
        { hop: "dave", layers: ["charlie", "dave"], decrypted: false },
      ],
      paddingLayers: ["charlie", "dave"],
      trailing: "none",
      outerHmac: "bob_hmac",
    };
  }

  // Step 6: Bob's slot has been sliced off. The remaining 1,300 bytes
  // (Charlie's hop_payloads) is the shifted view. The 60 new SPLICED
  // bytes appear at the back - this is where the result row's trailing
  // bytes "land" in the canonical packet view.
  if (step === 6) {
    return {
      ephemeralPubkey: "E_AB",
      segmentLabel: "ONION_PACKET (at Bob, ready to forward)",
      slots: [
        { hop: "charlie", layers: ["charlie"], decrypted: false },
        { hop: "dave", layers: ["charlie", "dave"], decrypted: false },
      ],
      paddingLayers: ["charlie", "dave"],
      trailing: "encrypted",
      outerHmac: "bob_hmac",
    };
  }

  // Step 7: envelope swap, ship to Charlie.
  return {
    ephemeralPubkey: "E_AC",
    segmentLabel: "ONION_PACKET (Bob → Charlie)",
    slots: [
      { hop: "charlie", layers: ["charlie"], decrypted: false },
      { hop: "dave", layers: ["charlie", "dave"], decrypted: false },
    ],
    paddingLayers: ["charlie", "dave"],
    trailing: "encrypted",
    outerHmac: "charlie_hmac",
  };
}

// ── Main component ───────────────────────────────────────────────────────

export function ForwarderPeelDiagram() {
  const [step, setStep] = useState(1);

  const reset = () => {
    setStep(1);
  };

  const def = STEPS[step - 1];
  const hopState = hopTrackStateFor(step);
  const packetState = packetStateFor(step);
  const focus = focusFor(step);
  // The whole diagram is "what Bob does," so Bob's blue accents steps 1-6.
  // On step 7 the packet moves to Charlie (envelope + HMAC turn teal), so the
  // accent follows it to Charlie.
  const stepAccent =
    step === 7 ? HOP_STROKE_COLOR.charlie : HOP_STROKE_COLOR.bob;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="forwarder-peel-diagram"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          What Bob does when he peels
        </span>
      </div>

      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 680, maxWidth: 860 }}>
            <HopTrack state={hopState} />
            <MainPacket state={packetState} step={step} focus={focus} />
            <KeyDerivationCallout step={step} />
            <SidePanel step={step} />
            <DecryptedSlotCallout step={step} />
            <StepCaption
              label={`Step ${def.step} of ${TOTAL_STEPS}`}
              title={def.title}
              caption={def.caption}
              accentColor={stepAccent}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step <= 1}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:bg-card"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={step >= TOTAL_STEPS}
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
            <div className="ml-1 flex gap-1 flex-wrap">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setStep(n);
                    }}
                    className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                    style={{
                      background: step === n ? "#b8860b" : "#fffdf5",
                      borderColor:
                        step === n ? "#b8860b" : "rgba(15,23,42,0.4)",
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

// ── Key derivation callout (step 2) ──────────────────────────────────────
//
// Mini KDF-pipeline visualization showing only the two keys Bob uses while
// peeling: rho_B (stream cipher, gold) and mu_B (packet HMAC, blue). Reuses
// the shared KeyDerivationCard component so this visual stays consistent
// with the wrap-direction iteration cards in WrapTraceDiagram.

const RHO_COLOR = "#b8860b";
const MU_COLOR = "#3b6aa0";

function KeyDerivationCallout({ step }: { step: number }) {
  if (step !== 2) return null;
  return (
    <KeyDerivationCard
      title="Bob derives two keys from ss_AB"
      source={{
        name: "ss_AB",
        subtitle: "ECDH shared secret",
        accent: HOP_STROKE_COLOR.bob,
      }}
      upstream={{
        inputA: {
          name: "bob_privkey",
          subtitle: "Bob's static node privkey",
        },
        inputB: {
          name: "E_AB",
          subtitle: "ephemeral from packet header",
        },
        formulaOverride: "SHA256(bob_privkey · E_AB)",
      }}
      rows={[
        {
          formula: "HMAC('mu', ss_AB)",
          keyName: "mu_B",
          bytes: "32 bytes",
          useTitle: "Packet HMAC key",
          useSubtitle: "used next, in step 3",
          color: MU_COLOR,
        },
        {
          formula: "HMAC('rho', ss_AB)",
          keyName: "rho_B",
          bytes: "32 bytes",
          useTitle: "Stream cipher key",
          useSubtitle: "used in step 5 (XOR pass)",
          color: RHO_COLOR,
        },
      ]}
    />
  );
}

// ── Connector arrow ──────────────────────────────────────────────────────

// Vertical line with an upward arrowhead at the top. Used to visually
// connect a sub-element (callout, side panel) up to the corresponding
// region of the main packet above. targetXPct is the horizontal position
// (% from left of the parent) where the arrow lives - match it to the
// x-coordinate of the target region in the main packet. The arrow fills
// the full height of its parent container, so callers control vertical
// reach by sizing the container.
function ConnectorArrow({
  targetXPct,
  color,
  label,
}: {
  targetXPct: number;
  color: string;
  label?: string;
}) {
  return (
    <>
      <div
        className="absolute"
        style={{
          top: 12,
          left: `${targetXPct}%`,
          height: label ? "calc(100% - 26px)" : "calc(100% - 12px)",
          width: 0,
          borderLeft: `2px solid ${color}`,
        }}
      />
      <div
        className="absolute"
        style={{
          top: 0,
          left: `calc(${targetXPct}% - 7px)`,
          width: 14,
          height: 14,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <polygon points="7,0 0,14 14,14" fill={color} />
        </svg>
      </div>
      {label && (
        <div
          className="absolute"
          style={{
            bottom: 0,
            left: `${targetXPct}%`,
            transform: "translateX(-50%)",
            fontSize: 9,
            fontFamily: MONO,
            color,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}

// L-shaped splice arrow from the right edge of Row 3 (the "60 encrypted
// bytes" rectangle in the side panel) up to the SPLICED region (trailing
// position) of the packet above. Path: horizontal right from Row 3 →
// 90° bend → vertical up to SPLICED → arrowhead at the top.
//
// X coordinates (as viewBox units, scaled to wrapper width):
//   - 694 = 69.4% - Row 3's right edge (320px row centered in side panel)
//   - 840 = 84%   - SPLICED region center in packet
//
// Y coordinates (in a viewBox 1000×400, where SVG top is -30 above this
// wrapper, so y=0 is just above the packet's bottom edge):
//   - y=14  → SPLICED region top (just inside the packet)
//   - y=380 → Row 3 vertical center inside the side panel
function SpliceArrowZone({
  step,
}: {
  step: number;
}) {
  if (step !== 8) return null;
  return (
    <div
      className="mx-auto pointer-events-none relative"
      style={{ maxWidth: 860, height: 4, marginTop: 4 }}
    >
      <svg
        width="100%"
        height="400"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          top: -30,
          left: 0,
          overflow: "visible",
        }}
      >
        {/* L-path: right from Row 3 to SPLICED X, then up to SPLICED Y. */}
        <path
          d="M 694 380 L 840 380 L 840 14"
          fill="none"
          stroke={FOCUS_GOLD}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Arrowhead pointing up at the SPLICED region. Fixed-size SVG with
          HTML positioning so the head stays crisp regardless of stage
          width. */}
      <div
        className="absolute"
        style={{
          top: -34,
          left: "calc(84% - 7px)",
          width: 14,
          height: 12,
        }}
      >
        <svg width="14" height="12" viewBox="0 0 14 12">
          <polygon points="7,0 0,12 14,12" fill={FOCUS_GOLD} />
        </svg>
      </div>
      {/* "Splice into trailing position" label, positioned to the right
          of the side panel content, alongside the vertical leg of the L. */}
      <div
        className="absolute"
        style={{
          top: 64,
          left: "84%",
          transform: "translateX(8px)",
          fontSize: 9,
          fontFamily: MONO,
          color: FOCUS_GOLD,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        write into trailing
      </div>
    </div>
  );
}

// ── Decrypted-slot callout (step 4) ──────────────────────────────────────

function DecryptedSlotCallout({ step }: { step: number }) {
  // Bob's slot becomes plaintext on the XOR pass (step 5). The callout sits
  // below SidePanel's XOR-result row so the reader sees the operation that
  // produced the plaintext, then the plaintext content right beneath it.
  if (step !== 5) return null;
  return (
    <div
      className="mx-auto"
      style={{ maxWidth: 860, marginTop: -22 }}
    >
      {/* Arrow points up to Bob's slot in the SidePanel's result row above.
          The result bar spans SidePanel's width (px-4 padding inside the
          860px column). Bob's slot is the first ~12.5% of the result bar.
          Roughly: 16px of SidePanel padding / 860 ≈ 1.9%, then Bob's slot
          center sits ~6.25% into the bar (half of bobW ≈ 12.5%), so the
          arrow tip lands near 8% from the left of this 860-wide container. */}
      <div className="relative" style={{ height: 48 }}>
        <ConnectorArrow targetXPct={8} color={HOP_STROKE_COLOR.bob} />
      </div>

      <div
        className="border-[1.5px] mx-auto"
        style={{
          borderColor: HOP_STROKE_COLOR.bob,
          background: "#fffdf5",
          maxWidth: 640,
        }}
      >
        <div
          className="px-3 py-1.5"
          style={{
            background: `${HOP_STROKE_COLOR.bob}18`,
            borderBottom: `1.5px solid ${HOP_STROKE_COLOR.bob}40`,
          }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{
              fontFamily: MONO,
              color: HOP_STROKE_COLOR.bob,
              fontWeight: 700,
            }}
          >
            Bob's hop payload (now plaintext)
          </span>
        </div>
        <div className="flex p-2 gap-1">
          <DecryptedSubCell
            title="LEN"
            width={64}
            value="0x1B"
            subValue="27 B TLV"
          />
          <DecryptedSubCell
            title="ROUTING"
            flex
            value="forward to Charlie"
            subValue="ch_id: 0x123abc · amt: 100,000 msat · cltv: 720"
          />
          <DecryptedSubCell
            title="HMAC"
            width={140}
            value="charlie_hmac"
            subValue="32 bytes"
            accentColor={HOP_STROKE_COLOR.charlie}
          />
        </div>
      </div>
    </div>
  );
}

function DecryptedSubCell({
  title,
  width,
  flex,
  value,
  subValue,
  accentColor,
}: {
  title: string;
  width?: number;
  flex?: boolean;
  value: string;
  subValue: string;
  accentColor?: string;
}) {
  return (
    <div
      className="border-[1.5px] px-2 py-1.5 flex flex-col items-center justify-center text-center"
      style={{
        ...(flex ? { flex: 1 } : { width, flexShrink: 0 }),
        background: HOP_LIGHT.bob,
        borderColor: `${HOP_STROKE_COLOR.bob}80`,
        minWidth: 0,
      }}
    >
      <span
        className="text-[9px] uppercase tracking-[0.06em] mb-0.5"
        style={{
          fontFamily: MONO,
          color: NEUTRAL_TEXT,
          fontWeight: 700,
        }}
      >
        {title}
      </span>
      <span
        className="text-[11px] font-bold"
        style={{
          fontFamily: MONO,
          color: accentColor ?? INK,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {value}
      </span>
      <span
        className="text-[9px] mt-0.5 opacity-75"
        style={{
          fontFamily: MONO,
          color: NEUTRAL_TEXT,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {subValue}
      </span>
    </div>
  );
}

// ── Main packet card ─────────────────────────────────────────────────────

function MainPacket({
  state,
  step,
  focus,
}: {
  state: PacketState;
  step: number;
  focus: StepFocus;
}) {
  const envelopeColor =
    state.ephemeralPubkey === "E_AC"
      ? HOP_STROKE_COLOR.charlie
      : HOP_STROKE_COLOR.bob;

  return (
    <div
      className="mx-auto border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: INK,
        overflow: "visible",
        transition: "border-color 600ms ease-out",
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
            flexShrink: 0,
          }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.1em] font-bold whitespace-nowrap overflow-hidden"
          style={{ textOverflow: "ellipsis" }}
        >
          {state.segmentLabel}
        </span>
      </div>

      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{
            background: "#fffdf5",
            borderColor: INK,
            minHeight: 110,
          }}
        >
          <PacketHeader
            ephemeralPubkey={state.ephemeralPubkey}
            envelopeColor={envelopeColor}
            opacity={focus.header}
            highlight={step === 2 || step === 7}
          />
          <PayloadArea
            state={state}
            step={step}
            opacity={focus.payload}
          />
          <PacketHmac
            outerHmac={state.outerHmac}
            envelopeColor={envelopeColor}
            opacity={focus.hmac}
            highlight={step === 3 || step === 7}
          />
        </div>
      </div>
    </div>
  );
}

function PacketHeader({
  ephemeralPubkey,
  envelopeColor,
  opacity,
  highlight,
}: {
  ephemeralPubkey: "E_AB" | "E_AC";
  envelopeColor: string;
  opacity: number;
  highlight: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center border-r-[1.5px] relative"
      style={{
        flexBasis: 130,
        flexShrink: 0,
        borderColor: INK,
        color: INK,
        padding: "8px 6px",
        background: `${envelopeColor}24`,
        opacity,
        transition: DIM_TRANSITION + ", background 600ms ease-out",
        boxShadow: highlight ? `inset 0 0 0 2px ${FOCUS_GOLD}` : "none",
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
        style={{ fontFamily: MONO, color: INK }}
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
        key={ephemeralPubkey}
        className="font-bold leading-tight mt-0.5"
        style={{
          fontFamily: MONO,
          color: envelopeColor,
          fontSize: 16,
          transition: "color 600ms ease-out",
        }}
      >
        {ephemeralPubkey === "E_AB" ? (
          <>
            E<span style={{ fontSize: 9, verticalAlign: "sub" }}>AB</span>
          </>
        ) : (
          <>
            E<span style={{ fontSize: 9, verticalAlign: "sub" }}>AC</span>
          </>
        )}
      </span>
    </div>
  );
}

function PacketHmac({
  outerHmac,
  envelopeColor,
  opacity,
  highlight,
}: {
  outerHmac: "bob_hmac" | "charlie_hmac";
  envelopeColor: string;
  opacity: number;
  highlight: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        flexBasis: 88,
        flexShrink: 0,
        color: INK,
        padding: "8px 4px",
        background: `${envelopeColor}24`,
        opacity,
        transition: DIM_TRANSITION + ", background 600ms ease-out",
        boxShadow: highlight ? `inset 0 0 0 2px ${FOCUS_GOLD}` : "none",
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight"
        style={{ fontFamily: MONO }}
      >
        HMAC
      </span>
      <span
        key={outerHmac}
        className="text-[9px] font-bold leading-tight mt-1"
        style={{
          fontFamily: MONO,
          color: envelopeColor,
          transition: "color 600ms ease-out",
        }}
      >
        {outerHmac}
      </span>
      <span
        className="text-[8.5px] font-normal opacity-60 leading-tight mt-0.5"
        style={{ fontFamily: MONO }}
      >
        32 B
      </span>
    </div>
  );
}

// ── PayloadArea: the hop_payloads field, evolving across steps ───────────

function PayloadArea({
  state,
  step,
  opacity,
}: {
  state: PacketState;
  step: number;
  opacity: number;
}) {
  const showTrailing = state.trailing !== "none";
  const slotRegionPct = state.slots.length === 3 ? 50 : 37.5;
  const trailingPct = showTrailing ? 12.5 : 0;
  const paddingPct = 100 - slotRegionPct - trailingPct;

  const totalSlotBytes = state.slots.reduce(
    (s, slot) => s + payloadSize(slot.hop),
    0,
  );

  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        padding: "8px 8px",
        minWidth: 0,
        borderRight: "1.5px solid #0f172a",
        position: "relative",
        opacity,
        transition: DIM_TRANSITION,
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
      <div
        className="relative border-[1.5px] flex"
        style={{
          background: "#fffdf5",
          borderColor: INK,
          height: 64,
          overflow: "hidden",
        }}
      >
        <div
          className="flex"
          style={{
            width: `${slotRegionPct}%`,
            transition: "width 700ms cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        >
          {state.slots.map((slot, i) => (
            <SlotCell
              key={slot.hop}
              hop={slot.hop}
              widthPct={(payloadSize(slot.hop) / totalSlotBytes) * 100}
              layers={slot.layers}
              decrypted={slot.decrypted}
              isLastInSlots={i === state.slots.length - 1}
            />
          ))}
        </div>

        <div
          className="relative flex items-center justify-center"
          style={{
            width: `${paddingPct}%`,
            background: "#fffdf5",
            transition: "width 700ms cubic-bezier(0.4, 0.0, 0.2, 1)",
            borderLeft: `1px dashed ${HOP_STROKE_COLOR[state.paddingLayers[state.paddingLayers.length - 1] ?? "bob"]}80`,
          }}
        >
          <HatchOverlay
            hops={state.paddingLayers}
            zIndex={1}
            stripeOpacity={0.1}
          />
          <span
            className="relative"
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: NEUTRAL_TEXT,
              background: "rgba(255,253,245,0.85)",
              padding: "0 4px",
              zIndex: 2,
            }}
          >
            padding
          </span>
        </div>

        {state.trailing !== "none" && (
          <TrailingGap
            kind={state.trailing}
            widthPct={trailingPct}
            spliceLanding={step === 6}
          />
        )}
      </div>
    </div>
  );
}

function payloadSize(hop: ForwarderId): number {
  if (hop === "bob") return BOB_PAYLOAD;
  if (hop === "charlie") return CHARLIE_PAYLOAD;
  return DAVE_PAYLOAD;
}

function SlotCell({
  hop,
  widthPct,
  layers,
  decrypted,
  isLastInSlots,
}: {
  hop: ForwarderId;
  widthPct: number;
  layers: ForwarderId[];
  decrypted: boolean;
  isLastInSlots: boolean;
}) {
  const hopColor = HOP_STROKE_COLOR[hop];
  const hopFill = HOP_LIGHT[hop];
  return (
    <div
      className="relative flex"
      style={{
        width: `${widthPct}%`,
        borderRight: isLastInSlots
          ? `1.5px solid ${hopColor}`
          : `1.5px solid ${hopColor}`,
        minWidth: 0,
      }}
    >
      <div
        className="relative flex flex-col items-center justify-center text-center"
        style={{
          width: "100%",
          background: hopFill,
          padding: "4px 4px",
        }}
      >
        {layers.length > 0 && (
          <HatchOverlay hops={layers} zIndex={1} stripeOpacity={0.12} />
        )}
        <span
          className="relative"
          style={{
            fontSize: 9,
            fontFamily: MONO,
            fontWeight: 700,
            color: hopColor,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            zIndex: 2,
            background: "rgba(255,253,245,0.85)",
            padding: "0 3px",
          }}
        >
          {HOP_LABEL[hop]}
        </span>
        {decrypted && (
          <span
            className="relative"
            style={{
              fontSize: 8,
              fontFamily: MONO,
              color: SUCCESS_GREEN,
              fontWeight: 700,
              marginTop: 3,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              zIndex: 2,
            }}
          >
            decrypted ↓
          </span>
        )}
      </div>
    </div>
  );
}

function TrailingGap({
  kind,
  widthPct,
  spliceLanding,
}: {
  kind: "placeholder" | "encrypted";
  widthPct: number;
  spliceLanding: boolean;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{
        width: `${widthPct}%`,
        background: kind === "placeholder" ? ZERO_FILL : "#fffdf5",
        borderLeft: `1.5px solid ${kind === "placeholder" ? ZERO_STROKE : INK}`,
        transition: "all 700ms ease-out",
        boxShadow: spliceLanding
          ? `inset 0 0 0 2.5px ${FOCUS_GOLD}, 0 0 0 3px rgba(184,134,11,0.22)`
          : "none",
      }}
    >
      {kind === "encrypted" && (
        <HatchOverlay hops={["bob"]} zIndex={1} stripeOpacity={0.5} />
      )}
      <span
        className="relative"
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 700,
          color: kind === "placeholder" ? NEUTRAL_TEXT : HOP_STROKE_COLOR.bob,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          zIndex: 2,
          background: "rgba(255,253,245,0.85)",
          padding: "0 3px",
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {kind === "placeholder" ? "placeholder" : "written"}
      </span>
      {kind === "placeholder" && (
        <span
          className="relative"
          style={{
            fontFamily: MONO,
            fontSize: 8,
            color: NEUTRAL_TEXT,
            opacity: 0.7,
            marginTop: 1,
            zIndex: 2,
          }}
        >
          0x00…
        </span>
      )}
    </div>
  );
}

// ── Side panel (steps 4–5: the unified XOR pass) ────────────────────────

function SidePanel({ step }: { step: number }) {
  // Visible for the preparation (step 4) and the unified XOR (step 5).
  // The side panel makes the "single XOR pass over an extended buffer"
  // visible as a three-row equation: extended buffer ⊕ keystream = result.
  // Step 6 (slice + Charlie's view) and step 7 (envelope swap) don't need
  // a side panel; the main packet card carries the visual.
  if (step !== 4 && step !== 5) return null;

  return (
    <div
      className="mt-4 border-[1.5px] px-4 py-3"
      style={{
        borderColor: "rgba(15,23,42,0.3)",
        background: "#fffdf5",
        minHeight: 220,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-2"
        style={{
          fontFamily: MONO,
          color: HOP_STROKE_COLOR.bob,
          fontWeight: 700,
        }}
      >
        {step === 4
          ? "Bob's preparation: extended buffer + keystream"
          : "Bob's single XOR pass (first 1,360 of 2,600 bytes)"}
      </div>

      <UnifiedXorPanel step={step} />
    </div>
  );
}

// Three-row visualization of the unified XOR:
//   extended buffer (1,360 B) ⊕ rho_B keystream (1,360 B) = result (1,360 B)
//
// At step 4 only the first two rows render (XOR hasn't happened yet).
// At step 5 the result row appears, showing Bob's slot decrypted at the
// front and the new 60 trailing bytes at the back from `zeros ⊕ rho_B
// keystream extension`.
function UnifiedXorPanel({ step }: { step: number }) {
  const showResult = step === 5;
  return (
    <div className="flex flex-col items-stretch gap-1.5 mt-1">
      <ExtendedBufferRow
        label="extended buffer, first 1,360 of 2,600 B (hop_payloads + zero pad)"
        layout="pre-xor"
        dim={showResult}
      />
      <BigSym>⊕</BigSym>
      <ExtendedBufferRow
        label="Bob's rho_B keystream, first 1,360 of 2,600 bytes"
        layout="keystream"
        dim={showResult}
      />
      {showResult && (
        <>
          <BigSym>=</BigSym>
          <ExtendedBufferRow
            label="result · Bob's hop payload is plaintext, last 60 B are new"
            layout="post-xor"
            emphasize
            spotlightEnds
          />
          <div
            className="text-[10.5px] text-center mt-2 px-3 leading-snug"
            style={{ fontFamily: SANS, color: INK }}
          >
            So in a single pass, Bob's hop payload{" "}
            <strong style={{ color: SUCCESS_GREEN }}>decrypts at the front</strong>{" "}
            while{" "}
            <strong style={{ color: FOCUS_GOLD }}>60 brand-new encrypted padding bytes</strong>{" "}
            appear at the back.
          </div>
        </>
      )}
    </div>
  );
}

// A single 1,360-byte buffer bar that renders in one of three modes:
//   • "pre-xor"   - Bob's slot (1 layer encrypted), Charlie's (2), Dave's (3),
//                    padding (3 layers), trailing 60 zeros.
//   • "keystream" - solid Bob hatch across the entire bar.
//   • "post-xor"  - Bob's slot decrypted (plaintext, no hatch), Charlie (1
//                    layer), Dave (2), padding (2), trailing 60 with Bob hatch
//                    (the new bytes from `0 ⊕ rho_B[1300..1359]`).
function ExtendedBufferRow({
  label,
  layout,
  emphasize = false,
  dim = false,
  spotlightEnds = false,
}: {
  label: string;
  layout: "pre-xor" | "keystream" | "post-xor";
  emphasize?: boolean;
  dim?: boolean;
  spotlightEnds?: boolean;
}) {
  const midOp = spotlightEnds ? 0.22 : 1;
  // Proportions match the main packet card's PayloadArea when it has 3
  // slots + trailing extension: slot region 50%, padding 37.5%, trailing
  // 12.5%. Slot widths within the slot region follow the byte ratios
  // (60:80:100 = 25%:33%:42% of slot region = 12.5%:16.7%:20.8% of bar).
  const SLOT_PCT = 50;
  const PADDING_PCT = 37.5;
  const TRAILING_PCT = 12.5;
  const bobW = SLOT_PCT * (BOB_PAYLOAD / (BOB_PAYLOAD + CHARLIE_PAYLOAD + DAVE_PAYLOAD));
  const charlieW = SLOT_PCT * (CHARLIE_PAYLOAD / (BOB_PAYLOAD + CHARLIE_PAYLOAD + DAVE_PAYLOAD));
  const daveW = SLOT_PCT - bobW - charlieW;

  return (
    <div style={{ opacity: dim ? 0.4 : 1, transition: "opacity 300ms ease-out" }}>
      <div
        className="text-[9px] uppercase tracking-[0.06em] mb-1"
        style={{
          fontFamily: MONO,
          color: emphasize ? FOCUS_GOLD : NEUTRAL_TEXT,
          fontWeight: emphasize ? 700 : 500,
        }}
      >
        {label}
      </div>
      <div
        className="border-[1.5px] flex relative overflow-hidden"
        style={{
          borderColor: emphasize ? FOCUS_GOLD : INK,
          background: "#fffdf5",
          height: 30,
          boxShadow: emphasize
            ? `0 0 0 2px ${FOCUS_GOLD}, 0 0 0 5px rgba(184,134,11,0.22)`
            : "none",
        }}
      >
        {layout === "keystream" ? (
          // Whole bar is the keystream - Bob hatch across all 1,360 bytes.
          <div className="relative" style={{ width: "100%" }}>
            <HatchOverlay hops={["bob"]} zIndex={1} />
          </div>
        ) : (
          <>
            {/* Bob's slot */}
            <BarSegment
              widthPct={bobW}
              hop="bob"
              layers={
                layout === "pre-xor" ? ["bob"] : []
              }
              labelText={layout === "post-xor" ? "BOB · plain" : "BOB"}
              decrypted={layout === "post-xor"}
              emphasize={spotlightEnds}
            />
            {/* Charlie's slot */}
            <BarSegment
              widthPct={charlieW}
              hop="charlie"
              layers={
                layout === "pre-xor" ? ["bob", "charlie"] : ["charlie"]
              }
              labelText="C"
              opacity={midOp}
            />
            {/* Dave's slot */}
            <BarSegment
              widthPct={daveW}
              hop="dave"
              layers={
                layout === "pre-xor"
                  ? ["bob", "charlie", "dave"]
                  : ["charlie", "dave"]
              }
              labelText="D"
              opacity={midOp}
            />
            {/* Padding */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width: `${PADDING_PCT}%`,
                background: "#fffdf5",
                borderLeft: `1px dashed ${HOP_STROKE_COLOR.dave}60`,
                opacity: midOp,
                transition: "opacity 300ms ease-out",
              }}
            >
              <HatchOverlay
                hops={
                  layout === "pre-xor"
                    ? ["bob", "charlie", "dave"]
                    : ["charlie", "dave"]
                }
                zIndex={1}
                stripeOpacity={0.1}
              />
              <span
                className="relative text-[8px] uppercase tracking-[0.05em]"
                style={{
                  fontFamily: MONO,
                  color: NEUTRAL_TEXT,
                  background: "rgba(255,253,245,0.85)",
                  padding: "0 3px",
                  zIndex: 2,
                }}
              >
                padding
              </span>
            </div>
            {/* Trailing 60 bytes */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width: `${TRAILING_PCT}%`,
                background:
                  layout === "pre-xor" ? ZERO_FILL : "#fffdf5",
                borderLeft: `1.5px solid ${
                  layout === "pre-xor" ? ZERO_STROKE : INK
                }`,
                boxShadow: spotlightEnds ? `inset 0 0 0 2px ${FOCUS_GOLD}` : undefined,
                zIndex: spotlightEnds ? 3 : undefined,
              }}
            >
              {layout === "post-xor" && (
                <HatchOverlay hops={["bob"]} zIndex={1} stripeOpacity={0.5} />
              )}
              <span
                className="relative text-[8px] uppercase tracking-[0.04em]"
                style={{
                  fontFamily: MONO,
                  fontWeight: 700,
                  color:
                    layout === "pre-xor"
                      ? NEUTRAL_TEXT
                      : HOP_STROKE_COLOR.bob,
                  background: "rgba(255,253,245,0.85)",
                  padding: "0 3px",
                  zIndex: 2,
                }}
              >
                {layout === "pre-xor" ? "60 zeros" : "60 new"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BarSegment({
  widthPct,
  hop,
  layers,
  labelText,
  decrypted = false,
  opacity = 1,
  emphasize = false,
}: {
  widthPct: number;
  hop: ForwarderId;
  layers: ForwarderId[];
  labelText: string;
  decrypted?: boolean;
  opacity?: number;
  emphasize?: boolean;
}) {
  const ring = decrypted ? SUCCESS_GREEN : HOP_STROKE_COLOR[hop];
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${widthPct}%`,
        background: HOP_LIGHT[hop],
        borderRight: `1.5px solid ${HOP_STROKE_COLOR[hop]}80`,
        opacity,
        boxShadow: emphasize ? `inset 0 0 0 2px ${ring}` : undefined,
        zIndex: emphasize ? 3 : undefined,
        transition: "opacity 300ms ease-out",
      }}
    >
      {layers.length > 0 && (
        <HatchOverlay hops={layers} zIndex={1} stripeOpacity={0.14} />
      )}
      <span
        className="relative text-[8px] uppercase tracking-[0.04em]"
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          color: decrypted ? SUCCESS_GREEN : HOP_STROKE_COLOR[hop],
          background: "rgba(255,253,245,0.85)",
          padding: "0 3px",
          zIndex: 2,
        }}
      >
        {labelText}
      </span>
    </div>
  );
}

function KeystreamRow({ showSlice }: { showSlice: boolean }) {
  const sliceWidthPct = EXTENSION_PCT;
  const sliceLeftPct = 100 - sliceWidthPct;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] uppercase tracking-[0.06em]"
          style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
        >
          Bob's rho keystream
        </span>
        <span
          className="text-[10px]"
          style={{ fontFamily: MONO, color: NEUTRAL_TEXT }}
        >
          first {BOB_KEYSTREAM_LEN.toLocaleString()} of 2,600 bytes
        </span>
      </div>
      <div className="relative" style={{ height: 32 }}>
        <div
          className="absolute top-0 left-0 right-0 border-[1.5px]"
          style={{
            height: 32,
            borderColor: INK,
            background: "#fffdf5",
            overflow: "hidden",
          }}
        >
          <HatchOverlay hops={["bob"]} zIndex={0} />
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${REGULAR_PCT}%`,
              borderLeft: `1.5px dashed ${INK}`,
            }}
          />
        </div>
        {showSlice && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: -3,
              left: `${sliceLeftPct}%`,
              width: `${sliceWidthPct}%`,
              height: 38,
              border: `2.5px solid ${HOP_STROKE_COLOR.bob}`,
              boxShadow: `0 0 0 3px rgba(59,106,160,0.22)`,
            }}
          />
        )}
      </div>
      <div className="relative mt-1" style={{ height: 14 }}>
        <span
          className="absolute"
          style={{
            left: 0,
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          0
        </span>
        <span
          className="absolute"
          style={{
            left: `${REGULAR_PCT}%`,
            transform: "translateX(-50%)",
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          1,300
        </span>
        <span
          className="absolute"
          style={{
            right: 0,
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          1,300 + 60 = 1,360
        </span>
      </div>
    </div>
  );
}

// L-shaped connector line from the keystream slice down to Row 1's right
// edge (the keystream-operand row of the XOR equation). No arrowhead -
// it's a connection indicator, not a directional arrow. Path goes:
// vertical down from slice center (~89% X) → 90° bend → horizontal left
// to Row 1's right edge (~69.4% X).
//
// `dimmed` fades the line in step 8, where the gold splice arrow becomes
// the primary directional cue and the blue line is just background context.
function SliceToRowConnector({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div
      className="relative pointer-events-none"
      style={{ height: 28, marginTop: 4 }}
    >
      <svg
        width="100%"
        height="80"
        viewBox="0 0 1000 80"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "visible",
        }}
      >
        {/* L-path: down at slice center X, then left to Row 1's right
            edge. vector-effect keeps the stroke crisp regardless of how
            the SVG scales. */}
        <path
          d="M 890 4 L 890 56 L 694 56"
          fill="none"
          stroke={HOP_STROKE_COLOR.bob}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={dimmed ? 0.32 : 1}
        />
      </svg>
    </div>
  );
}

function XorEquation({ handoff }: { handoff: boolean }) {
  const rowWidth = 320;
  return (
    <div className="flex flex-col items-center gap-1.5 mt-2 relative">
      {/* Keystream slice goes first so the connector arrow from the
          keystream bar above lands directly on this row. XOR is commutative,
          so the operand order doesn't change the math. */}
      <EqRow
        title="Bob's keystream slice (last 60 bytes)"
        widthPx={rowWidth}
        renderBytes={() => (
          <ByteBox tinted="bob-hatched" label="60 bytes" />
        )}
        emphasisColor={HOP_STROKE_COLOR.bob}
      />
      <BigSym>⊕</BigSym>
      <EqRow
        title="60 placeholder zeros"
        widthPx={rowWidth}
        renderBytes={() => (
          <ByteBox tinted="zero" label="60 placeholder bytes" />
        )}
      />
      <BigSym>=</BigSym>
      <EqRow
        title={
          handoff
            ? "60 encrypted bytes · written into the packet"
            : "60 encrypted bytes"
        }
        widthPx={rowWidth}
        renderBytes={() => (
          <ByteBox tinted="bob-hatched" label="60 bytes" />
        )}
        emphasisColor={FOCUS_GOLD}
        handoff={handoff}
      />
    </div>
  );
}

function EqRow({
  title,
  widthPx,
  renderBytes,
  emphasisColor,
  handoff = false,
}: {
  title: string;
  widthPx: number;
  renderBytes: () => ReactNode;
  emphasisColor?: string;
  handoff?: boolean;
}) {
  const haloAlpha = emphasisColor === FOCUS_GOLD ? 0.22 : 0.18;
  return (
    <div style={{ width: widthPx }}>
      <div
        className="text-[9px] uppercase tracking-[0.06em] mb-1 text-center"
        style={{
          fontFamily: MONO,
          color: emphasisColor ?? NEUTRAL_TEXT,
          fontWeight: emphasisColor ? 700 : 500,
        }}
      >
        {title}
      </div>
      <div
        className="flex"
        style={{
          height: 32,
          boxShadow: emphasisColor
            ? `0 0 0 2px ${emphasisColor}, 0 0 0 5px ${rgba(emphasisColor, haloAlpha)}`
            : "none",
          transform: handoff ? "translateY(-4px)" : "translateY(0)",
          transition: "transform 600ms ease-out",
        }}
      >
        {renderBytes()}
      </div>
    </div>
  );
}

function rgba(hex: string, alpha: number): string {
  // Convert a #rrggbb hex to rgba(...) with the given alpha. Falls back to
  // semi-transparent black if the input doesn't look right.
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ByteBox({
  tinted,
  label,
}: {
  tinted: "zero" | "bob-hatched";
  label: string;
}) {
  return (
    <div
      className="relative flex items-center justify-center w-full border-[1.5px]"
      style={{
        background: tinted === "zero" ? ZERO_FILL : "#fffdf5",
        borderColor: tinted === "zero" ? ZERO_STROKE : INK,
        overflow: "hidden",
      }}
    >
      {tinted === "bob-hatched" && (
        <HatchOverlay hops={["bob"]} zIndex={1} />
      )}
      <span
        className="relative"
        style={{
          fontSize: 10,
          fontFamily: MONO,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: tinted === "zero" ? NEUTRAL_TEXT : INK,
          background:
            tinted === "bob-hatched" ? "rgba(255,253,245,0.85)" : "transparent",
          padding: tinted === "bob-hatched" ? "0 4px" : 0,
          zIndex: 2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function BigSym({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: INK,
        fontFamily: MONO,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

export default ForwarderPeelDiagram;
