import { useEffect, useRef, useState } from "react";
import { SlotSubCell } from "./SlotSubCell";

// ────────────────────────────────────────────────────────────────────────────
// FiveKeysJobsDiagram (rebuilt 2026-05-08)
//
// Stepped walkthrough of the five BOLT-4 derived keys (pad, rho, mu, ammag,
// um). Each step focuses one key card (others fade to DIM_OPACITY) AND
// lights up the corresponding region of the packet thumbnail with the
// matching hatch or HMAC tint. Mirrors PeelPrimer's locked focus/dim
// discipline so the visual reads as a sibling to the wrap, peel, and
// operations diagrams.
//
// Step order follows the operations lifecycle (setup → forward → return),
// not the BOLT 4 reference order, so students can mentally connect each key
// to the operation step they just saw in the operations-lifecycle visual.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type KeyName = "pad" | "rho" | "mu" | "ammag" | "um";
type PacketMode = "forward" | "return";
type FocalRegion = "payload" | "hmac";
type Direction = "FORWARD" | "BACKWARD" | "SENDER ONLY";
type GroupLabel = "SETUP" | "FORWARD" | "RETURN";
// Slot mode controls what the payload area renders inside the thumbnail:
//   "none"    — empty buffer with random byte fill (only at the pad step,
//               before any slots have been written)
//   "forward" — three per-hop slots (Bob/Charlie/Dave) plus padding region
//   "fail"    — single FAIL slot mirroring BOLT 4 error_packet plus padding
type SlotMode = "none" | "forward" | "fail";

interface KeyStep {
  name: KeyName;
  color: string;
  direction: Direction;
  role: string;
  oneLiner: string;
  packetMode: PacketMode;
  focalRegion: FocalRegion;
  // What the payload area should look like at this step. The encryption
  // hatch persists through MAC steps (rho's hatch stays for mu's step;
  // ammag's hatch stays for um's step), so the hatch fields are decoupled
  // from which key is "currently active".
  slotMode: SlotMode;
  hatchAngle: number | null;
  hatchColor: string | null;
  caption: string;
  groupLabel: GroupLabel;
}

const STEPS: KeyStep[] = [
  {
    name: "pad",
    color: "#7b4b8a",
    direction: "SENDER ONLY",
    role: "Buffer init",
    oneLiner:
      "Pre-fills the 1300-byte payload buffer with random-looking bytes before any onion layer is applied.",
    packetMode: "forward",
    focalRegion: "payload",
    slotMode: "none",
    hatchAngle: null,
    hatchColor: null,
    caption:
      "`pad` is the only key derived from Alice's session key directly (no per-hop ECDH). Alice uses it once at construction time to fill the empty payload buffer with random-looking bytes, so the unused tail of the packet doesn't leak path length.",
    groupLabel: "SETUP",
  },
  {
    name: "rho",
    color: "#b8860b",
    direction: "FORWARD",
    role: "Stream cipher (fwd)",
    oneLiner:
      "ChaCha20 keystream that XORs the payload area as each hop wraps or peels its layer.",
    packetMode: "forward",
    focalRegion: "payload",
    slotMode: "forward",
    hatchAngle: 90,
    hatchColor: "#b8860b",
    caption:
      "`rho` is the workhorse of forward encryption. Each hop has its own `rho_i` derived from `ss_i`, used both by Alice (to wrap that hop's layer onto the buffer) and by the hop itself (to peel that layer back off).",
    groupLabel: "FORWARD",
  },
  {
    name: "mu",
    color: "#3b6aa0",
    direction: "FORWARD",
    role: "HMAC (fwd)",
    oneLiner:
      "Authenticates the forward packet's contents. Forwarders verify before doing anything else.",
    packetMode: "forward",
    focalRegion: "hmac",
    // mu fires AFTER rho, so the rho-colored hatch persists across this
    // step. The visual focus shifts to the HMAC region while the payload
    // stays encrypted.
    slotMode: "forward",
    hatchAngle: 90,
    hatchColor: "#b8860b",
    caption:
      "`mu` keys the forward authentication tag. Alice computes one `HMAC-SHA256(mu_i, hop_payloads)` per hop and bakes the chain into the onion. Each forwarder recomputes and verifies *first*, before any decryption.",
    groupLabel: "FORWARD",
  },
  {
    name: "ammag",
    color: "#5a7a2f",
    direction: "BACKWARD",
    role: "Stream cipher (errors)",
    oneLiner:
      "ChaCha20 keystream for encrypting and decrypting error onions on the return path.",
    packetMode: "return",
    focalRegion: "payload",
    slotMode: "fail",
    hatchAngle: 135,
    hatchColor: "#5a7a2f",
    caption:
      "`ammag` is `rho`'s mirror image for the return direction. The failing hop encrypts the error packet with `ammag_i`, and each hop on the way back adds another layer so only Alice can read the final reason.",
    groupLabel: "RETURN",
  },
  {
    name: "um",
    color: "#2d7a7a",
    direction: "BACKWARD",
    role: "HMAC (errors)",
    oneLiner: "Authenticates encrypted error packets on the return path.",
    packetMode: "return",
    focalRegion: "hmac",
    // Like mu, um fires after the encryption step, so ammag's hatch
    // persists.
    slotMode: "fail",
    hatchAngle: 135,
    hatchColor: "#5a7a2f",
    caption:
      "`um` keys the return authentication tag. The failing hop signs the error packet with `um_i` so Alice can verify on receipt that the error genuinely came from a hop on her route, not a fake injected by an outsider.",
    groupLabel: "RETURN",
  },
];

// Forward-mode per-hop visual constants matching PeelPrimer / WrapPrimer so
// the slot rendering across the chapter's visuals stays unified.
type ForwarderId = "bob" | "charlie" | "dave";
const FWD_HOP_FILL: Record<ForwarderId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const FWD_HOP_STROKE: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const FWD_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};
const FWD_NEXT_HOP_LABEL: Record<ForwarderId, string> = {
  bob: "→Charlie",
  charlie: "→Dave",
  dave: "0x00…",
};
const FWD_NEXT_HOP_COLOR: Record<ForwarderId, string> = {
  bob: FWD_HOP_STROKE.charlie,
  charlie: FWD_HOP_STROKE.dave,
  dave: "#475569",
};
const FWD_SLOT_BIGSIZE: Record<ForwarderId, string> = {
  bob: "0x40",
  charlie: "0x40",
  dave: "0x63",
};
const FWD_SLOT_BYTES: Record<ForwarderId, number> = {
  bob: 65,
  charlie: 65,
  dave: 100,
};
// Slot widths sum to ~78%, leaving ~22% for the padding region.
const FWD_SLOT_WIDTH_PCT: Record<ForwarderId, number> = {
  bob: 25,
  charlie: 25,
  dave: 28,
};

const TOTAL_STEPS = STEPS.length;
const STEP_MS = 2400;

const DIM_OPACITY = 0.18;
const DIM_TRANSITION =
  "opacity 400ms ease-out, box-shadow 400ms ease-out, background 400ms ease-out";
const FOCUS_RING_INSET =
  "inset 0 0 0 2px rgba(184,134,11,0.55), inset 0 0 18px rgba(184,134,11,0.35)";
const FOCUS_RING =
  "0 0 0 2px rgba(184,134,11,0.55), 0 0 18px rgba(184,134,11,0.40)";

const ERROR_COLOR = "#a13a3a";

// Render a caption string with backtick-quoted segments styled as inline
// code chips. Matches PeelPrimer's renderCaptionWithCode.
function renderCaptionWithCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
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
    return <span key={i}>{part}</span>;
  });
}

function directionStyles(dir: Direction): {
  bg: string;
  fg: string;
  border: string;
} {
  if (dir === "FORWARD")
    return { bg: "#0f172a", fg: "#fffdf5", border: "#0f172a" };
  if (dir === "BACKWARD")
    return { bg: "#fffdf5", fg: "#0f172a", border: "#0f172a" };
  return { bg: "#b8860b", fg: "#fffdf5", border: "#b8860b" };
}

export function FiveKeysJobsDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_STEPS - 1) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  const current = STEPS[step];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="five-keys-jobs-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Five keys, five jobs
          </span>
        </div>
      </div>

      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 540 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 720, maxWidth: 880 }}>
            <PacketThumbnail current={current} />
            <KeyCardRow
              currentIdx={step}
              setStep={setStep}
              setPlaying={setPlaying}
            />
            <StepActionPanel current={current} step={step} />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={playing ? pause : play}
            className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            data-testid="five-keys-jobs-play"
          >
            {playing
              ? "❚❚ Pause"
              : step >= TOTAL_STEPS - 1
                ? "↻ Replay"
                : "▶ Play"}
          </button>
          <button
            onClick={reset}
            className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            data-testid="five-keys-jobs-reset"
          >
            Reset
          </button>
          <StepButtonsGrouped
            step={step}
            setStep={setStep}
            setPlaying={setPlaying}
          />
        </div>
      </div>
    </div>
  );
}

// ── Packet thumbnail ───────────────────────────────────────────────────────

function PacketThumbnail({ current }: { current: KeyStep }) {
  const isReturn = current.packetMode === "return";
  const borderColor = isReturn ? ERROR_COLOR : "#0f172a";

  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-1.5 text-center"
        style={{
          color: isReturn ? ERROR_COLOR : "#475569",
          fontFamily: MONO,
          transition: "color 400ms ease-out",
        }}
      >
        {isReturn ? "Return error packet" : "Forward onion packet"}
      </div>
      <div
        className="border-[1.5px] flex"
        style={{
          background: "#fffdf5",
          borderColor,
          minHeight: 190,
          transition: "border-color 400ms ease-out",
        }}
      >
        {!isReturn && <PacketHeaderRegion />}
        <PacketPayloadRegion current={current} />
        <PacketHmacRegion current={current} />
      </div>
    </div>
  );
}

function PacketHeaderRegion() {
  // Header is never the focus in this visual (no key directly drives it),
  // so it's always rendered dim to keep the eye on payload/HMAC.
  return (
    <div
      className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
      style={{
        flexBasis: "16%",
        borderColor: "#0f172a",
        padding: "10px 6px",
        background: "#f1f5f9",
        opacity: DIM_OPACITY,
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
        className="text-[8.5px] uppercase tracking-[0.05em] opacity-70"
        style={{ fontFamily: MONO }}
      >
        version
      </span>
      <span
        className="text-[10px] font-bold mt-0.5"
        style={{ fontFamily: MONO, color: "#0f172a" }}
      >
        0x00
      </span>
      <span
        className="text-[8.5px] uppercase tracking-[0.05em] opacity-70 mt-1.5"
        style={{ fontFamily: MONO }}
      >
        ephemeral pubkey
      </span>
      <span
        className="text-[12px] font-bold mt-0.5"
        style={{ fontFamily: MONO, color: "#3b6aa0" }}
      >
        E_AB
      </span>
    </div>
  );
}

function PacketPayloadRegion({ current }: { current: KeyStep }) {
  const isFocal = current.focalRegion === "payload";
  const isReturn = current.packetMode === "return";
  return (
    <div
      className="relative flex flex-col"
      style={{
        flex: 1,
        padding: "10px 8px",
        borderRight: `1.5px solid ${isReturn ? ERROR_COLOR : "#0f172a"}`,
        background: isFocal ? `${current.color}1F` : "transparent",
        opacity: isFocal ? 1 : DIM_OPACITY,
        boxShadow: isFocal ? FOCUS_RING_INSET : "none",
        minWidth: 0,
        transition: DIM_TRANSITION,
      }}
    >
      <div className="text-center mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{
            fontFamily: MONO,
            color: isReturn ? ERROR_COLOR : "#0f172a",
          }}
        >
          {isReturn ? "ERROR PAYLOAD · 256 BYTES" : "PAYLOAD AREA · 1,300 BYTES"}
        </span>
      </div>
      <div
        className="relative flex-1"
        style={{
          background: "#fffdf5",
          border: `1.5px dashed ${isFocal ? "#b8860b" : isReturn ? ERROR_COLOR + "80" : "rgba(15,23,42,0.3)"}`,
          minHeight: 130,
          overflow: "hidden",
          transition: "border-color 400ms ease-out",
        }}
      >
        {current.slotMode === "none" && <RandomByteFill color={current.color} />}
        {current.slotMode === "forward" && <ForwardSlots current={current} />}
        {current.slotMode === "fail" && <FailSlot current={current} />}
      </div>
    </div>
  );
}

function PacketHmacRegion({ current }: { current: KeyStep }) {
  const isFocal = current.focalRegion === "hmac";
  const isReturn = current.packetMode === "return";
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        flexBasis: "14%",
        padding: "10px 4px",
        background: isFocal
          ? `${current.color}1F`
          : `${isReturn ? ERROR_COLOR : "#3b6aa0"}14`,
        opacity: isFocal ? 1 : DIM_OPACITY,
        boxShadow: isFocal ? FOCUS_RING_INSET : "none",
        transition: DIM_TRANSITION,
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ fontFamily: MONO, color: "#0f172a" }}
      >
        HMAC
      </span>
      <span
        className="text-[8.5px] uppercase tracking-[0.05em] opacity-70 mt-1"
        style={{ fontFamily: MONO }}
      >
        32-byte tag
      </span>
      <span
        className="text-[10px] font-bold mt-1.5"
        style={{ fontFamily: MONO, color: current.color }}
      >
        {isFocal ? `${current.name}_i` : "—"}
      </span>
    </div>
  );
}

// ── Slot rendering helpers ─────────────────────────────────────────────────

// Forward mode: three per-hop slots (Bob/Charlie/Dave) followed by a padding
// region. Each slot shows LEN bigsize + hop name TLV + HMAC subcell pointing
// at the next hop, matching the locked WrapPrimer/PeelPrimer slot format.
// Encryption hatch overlay sweeps over every region when hatchColor is set.
function ForwardSlots({ current }: { current: KeyStep }) {
  let cursor = 0;
  const lefts: Record<ForwarderId, number> = { bob: 0, charlie: 0, dave: 0 };
  for (const hop of ["bob", "charlie", "dave"] as ForwarderId[]) {
    lefts[hop] = cursor;
    cursor += FWD_SLOT_WIDTH_PCT[hop];
  }
  const paddingLeft = cursor;
  const hatchAngle = current.hatchAngle;
  const hatchColor = current.hatchColor;

  return (
    <>
      {(["bob", "charlie", "dave"] as ForwarderId[]).map((hop) => (
        <ForwardSlotRegion
          key={hop}
          hop={hop}
          leftPct={lefts[hop]}
          widthPct={FWD_SLOT_WIDTH_PCT[hop]}
        />
      ))}
      <PaddingRegion leftPct={paddingLeft} bytes={1005} />
      {hatchAngle !== null && hatchColor !== null && (
        <HatchLayer angle={hatchAngle} color={hatchColor} />
      )}
    </>
  );
}

function ForwardSlotRegion({
  hop,
  leftPct,
  widthPct,
}: {
  hop: ForwarderId;
  leftPct: number;
  widthPct: number;
}) {
  const stroke = FWD_HOP_STROKE[hop];
  const fill = FWD_HOP_FILL[hop];
  const nextColor = FWD_NEXT_HOP_COLOR[hop];

  return (
    <div
      className="absolute flex"
      style={{
        top: 14,
        bottom: 14,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        background: fill,
        border: `1.5px solid ${stroke}`,
        zIndex: 3,
        overflow: "hidden",
      }}
    >
      <SlotSubCell
        section="len"
        className="flex items-center justify-center"
        style={{
          width: 30,
          flexShrink: 0,
          background: fill,
          borderRight: `1px dashed ${stroke}80`,
          padding: "0 2px",
          overflow: "hidden",
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{
            background: "#fffdf5",
            border: `1px solid ${stroke}55`,
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
              color: stroke,
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.01em",
              lineHeight: 1,
            }}
          >
            {FWD_SLOT_BIGSIZE[hop]}
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
            border: `1px solid ${stroke}55`,
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
              color: stroke,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            {FWD_HOP_LABEL[hop]}
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
            {FWD_SLOT_BYTES[hop]} bytes
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
          borderLeft: `1px dashed ${stroke}80`,
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
            {FWD_NEXT_HOP_LABEL[hop]}
          </div>
        </div>
      </SlotSubCell>
    </div>
  );
}

// Fail-mode (return error packet) layout: a single FAIL slot mirroring BOLT
// 4 error_packet structure (LEN bigsize + FAIL TLV, no HMAC subcell since
// the error packet's HMAC is the outer region) followed by a padding region.
function FailSlot({ current }: { current: KeyStep }) {
  const hatchAngle = current.hatchAngle;
  const hatchColor = current.hatchColor;
  return (
    <>
      <div
        className="absolute flex"
        style={{
          top: 14,
          bottom: 14,
          left: 0,
          width: "40%",
          background: "#fde0e0",
          border: `1.5px solid ${ERROR_COLOR}`,
          zIndex: 3,
          overflow: "hidden",
        }}
      >
        <SlotSubCell
          section="len"
          className="flex items-center justify-center"
          style={{
            width: 30,
            flexShrink: 0,
            background: "#fde0e0",
            borderRight: `1px dashed ${ERROR_COLOR}80`,
            padding: "0 2px",
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              background: "#fffdf5",
              border: `1px solid ${ERROR_COLOR}55`,
              padding: "2px 3px",
              position: "relative",
              zIndex: 6,
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
                color: ERROR_COLOR,
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
              0x02
            </div>
          </div>
        </SlotSubCell>
        <SlotSubCell
          section="tlv"
          className="flex-1 relative flex items-center justify-center"
          style={{
            background: "#fde0e0",
            minWidth: 0,
            padding: "0 4px",
            overflow: "hidden",
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              background: "#fffdf5",
              border: `1px solid ${ERROR_COLOR}55`,
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
                color: ERROR_COLOR,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              FAIL
            </div>
            <div
              className="font-bold whitespace-nowrap mt-0.5"
              style={{
                color: ERROR_COLOR,
                fontFamily: MONO,
                fontSize: 8,
                letterSpacing: "0.01em",
                lineHeight: 1.15,
              }}
            >
              temporary_channel_failure
            </div>
            <div
              className="whitespace-nowrap mt-0.5"
              style={{
                color: "#475569",
                fontFamily: MONO,
                fontSize: 8,
                lineHeight: 1,
              }}
            >
              0x1007
            </div>
          </div>
        </SlotSubCell>
      </div>
      <PaddingRegion leftPct={40} bytes={192} extraOffsetPx={14} />
      {hatchAngle !== null && hatchColor !== null && (
        <HatchLayer angle={hatchAngle} color={hatchColor} />
      )}
    </>
  );
}

// Padding region: gray fill, byte count label. Used by both forward and
// fail slot layouts. extraOffsetPx leaves a small visible gap between the
// last slot and the padding region (matters more for the fail layout where
// the slot is wider).
function PaddingRegion({
  leftPct,
  bytes,
  extraOffsetPx = 0,
}: {
  leftPct: number;
  bytes: number;
  extraOffsetPx?: number;
}) {
  return (
    <div
      className="absolute"
      style={{
        top: 14,
        bottom: 14,
        left: `calc(${leftPct}% + ${extraOffsetPx}px)`,
        right: 0,
        background: "#e2e8f0",
        border: "1px dashed rgba(15,23,42,0.18)",
        zIndex: 2,
        overflow: "hidden",
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
        <div style={{ fontSize: 9 }}>~{bytes.toLocaleString()} bytes</div>
      </div>
    </div>
  );
}

// Encryption layer overlay: a colored wash + diagonal stripe pattern that
// sweeps over every region in the buffer. Matches PeelPrimer's HatchOverlay
// visually so the chapter's encryption-hatch vocabulary is unified.
function HatchLayer({ angle, color }: { angle: number; color: string }) {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: color,
          opacity: 0.08,
          zIndex: 4,
          transition: "opacity 600ms ease-out",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(${angle}deg, ${color} 0px, ${color} 2.5px, transparent 2.5px, transparent 11px)`,
          opacity: 0.6,
          zIndex: 4,
          transition: "opacity 600ms ease-out",
        }}
      />
    </>
  );
}

// Static random-byte pattern used for the `pad` step: a flat grid of
// pseudo-random hex bytes so the buffer reads as "filled with noise".
function RandomByteFill({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-wrap content-start"
      style={{ padding: "10px 8px", gap: 4 }}
    >
      {Array.from({ length: 96 }).map((_, i) => (
        <span
          key={i}
          className="text-[9px] leading-none"
          style={{
            fontFamily: MONO,
            color,
            opacity: 0.55,
          }}
        >
          {((i * 37 + 9) % 256).toString(16).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}

// ── Key card row (the scoreboard) ─────────────────────────────────────────

function KeyCardRow({
  currentIdx,
  setStep,
  setPlaying,
}: {
  currentIdx: number;
  setStep: (n: number) => void;
  setPlaying: (b: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {STEPS.map((k, i) => {
        const isActive = i === currentIdx;
        const dirStyle = directionStyles(k.direction);
        return (
          <button
            key={k.name}
            onClick={() => {
              setPlaying(false);
              setStep(i);
            }}
            className="border-[1.5px] flex flex-col gap-1.5 p-2.5 text-left"
            style={{
              borderColor: isActive ? "#b8860b" : `${k.color}80`,
              background: "#fffdf5",
              boxShadow: isActive ? FOCUS_RING : "none",
              opacity: isActive ? 1 : DIM_OPACITY,
              transition: DIM_TRANSITION,
              cursor: "pointer",
            }}
            data-testid={`five-keys-jobs-card-${k.name}`}
          >
            {/* Color block */}
            <div
              style={{
                width: 22,
                height: 22,
                background: k.color,
                border: "1.5px solid #0f172a",
              }}
              aria-hidden
            />

            {/* Key name */}
            <div
              style={{
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: k.color,
                lineHeight: 1.1,
              }}
            >
              {k.name}
            </div>

            {/* Direction tag */}
            <div>
              <span
                className="inline-block px-1.5 py-0.5 border-[1.5px] text-[9px] font-bold tracking-[0.06em] uppercase"
                style={{
                  background: dirStyle.bg,
                  color: dirStyle.fg,
                  borderColor: dirStyle.border,
                }}
              >
                {k.direction}
              </span>
            </div>

            {/* Primary role */}
            <div
              className="text-[11px] font-bold uppercase tracking-[0.04em]"
              style={{ color: "#0f172a" }}
            >
              {k.role}
            </div>

            {/* One-liner */}
            <div
              className="leading-snug"
              style={{ fontSize: 11, color: "#0f172a" }}
            >
              {k.oneLiner}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Step action panel ──────────────────────────────────────────────────────

function StepActionPanel({ current, step }: { current: KeyStep; step: number }) {
  return (
    <div
      className="border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: "rgba(15,23,42,0.25)",
        borderLeft: `3px solid ${current.color}`,
        transition: "border-color 400ms ease-out",
      }}
    >
      <div
        className="px-3 py-1.5 border-b-[1.5px] flex items-center gap-3 flex-wrap"
        style={{
          borderColor: "rgba(15,23,42,0.15)",
          background: `${current.color}14`,
          transition: "background 400ms ease-out",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: "#475569" }}
        >
          Step {step + 1} of {TOTAL_STEPS}
        </span>
        <span
          className="text-sm font-bold flex-1"
          style={{
            color: current.color,
            transition: "color 400ms ease-out",
          }}
        >
          <span style={{ fontFamily: MONO }}>{current.name}</span>
          <span style={{ color: "#475569", margin: "0 6px" }}>·</span>
          <span>{current.role}</span>
        </span>
      </div>
      <div
        className="px-3 py-2.5"
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "#0f172a",
          minHeight: 60,
        }}
      >
        {renderCaptionWithCode(current.caption)}
      </div>
    </div>
  );
}

// ── Step buttons grouped under SETUP / FORWARD / RETURN ────────────────────

function StepButtonsGrouped({
  step,
  setStep,
  setPlaying,
}: {
  step: number;
  setStep: (n: number) => void;
  setPlaying: (b: boolean) => void;
}) {
  const groups: Array<{
    label: GroupLabel;
    color: string;
    fill: string;
    steps: number[];
  }> = [
    { label: "SETUP", color: "#7b4b8a", fill: "#ede1f3", steps: [0] },
    { label: "FORWARD", color: "#b8860b", fill: "#fef3c7", steps: [1, 2] },
    { label: "RETURN", color: ERROR_COLOR, fill: "#fde0e0", steps: [3, 4] },
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
                  fontFamily: MONO,
                  cursor: "pointer",
                }}
                aria-label={`Step ${i + 1}`}
                data-testid={`five-keys-jobs-step-${i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FiveKeysJobsDiagram;
