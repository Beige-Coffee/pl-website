import { useEffect, useRef, useState } from "react";
import { SlotSubCell } from "./SlotSubCell";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// WrapPrimerDiagram (byte-accurate rebuild 2026-05-08)
//
// Linear layout matching the actual BOLT 4 Sphinx construction:
//   INIT: hop_payloads = chacha20(pad_key, 0, 1300)   ← entire 1,300 bytes
//                                                      pseudo-random padding
//   For each hop in REVERSE (Dave → Charlie → Bob):
//     1. WRITE:  shift right by slot_size; tail bytes fall off; write
//                [bigsize len | TLV | prev_hmac] at the FRONT of the buffer.
//     2. ENCRYPT: XOR the entire 1,300-byte buffer with chacha20(rho_hop).
//     3. HMAC:   prev_hmac = HMAC(mu_hop, encrypted_buffer).
//
// In the visual:
//   • The padding starts as the FULL buffer (step 0). Each WRITE substep
//     replaces the front of the padding with a slot, so padding shrinks
//     100→200→300 bytes from the left over the three iterations.
//   • Slots stack at the FRONT in iteration order: Dave first, then Charlie
//     pushes Dave right, then Bob pushes both right. Final left-to-right
//     order matches on-the-wire byte order: Bob | Charlie | Dave | padding.
//   • Encryption applies to the WHOLE buffer each iteration, so each region
//     accumulates a hatch layer per encryption round it has lived through.
//     After step 9: Bob slot = 1 layer, Charlie = 2, Dave = 3, padding = 3.
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
const SECRET_TOKEN: Record<ForwarderId, string> = {
  bob: "ss_AB",
  charlie: "ss_AC",
  dave: "ss_AD",
};
const SLOT_BYTES: Record<ForwarderId, number> = {
  bob: 65,
  charlie: 65,
  dave: 100,
};
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

// Iteration order: Dave first (innermost), then Charlie, then Bob.
const BUILD_ORDER: ForwarderId[] = ["dave", "charlie", "bob"];
const NEXT_INNER: Record<ForwarderId, ForwarderId | null> = {
  bob: "charlie",
  charlie: "dave",
  dave: null,
};

type SubStep = "write" | "encrypt" | "hmac";
const SUB_STEPS: SubStep[] = ["write", "encrypt", "hmac"];

interface BuildState {
  slotsWritten: Set<ForwarderId>;
  encrypted: Set<ForwarderId>;
  hmacsComputed: Set<ForwarderId>;
  // Which hop iteration is currently in focus (or null at step 0).
  currentHop: ForwarderId | null;
  currentSubStep: SubStep | null;
}

function buildStateAtStep(step: number): BuildState {
  const slotsWritten = new Set<ForwarderId>();
  const encrypted = new Set<ForwarderId>();
  const hmacsComputed = new Set<ForwarderId>();
  let currentHop: ForwarderId | null = null;
  let currentSubStep: SubStep | null = null;

  if (step === 0) {
    return { slotsWritten, encrypted, hmacsComputed, currentHop, currentSubStep };
  }

  // Steps 1..9 = (iteration_idx, sub_step_idx) where step = iteration*3 + sub + 1
  const idx = step - 1; // 0..8
  const iteration = Math.floor(idx / 3); // 0=Dave, 1=Charlie, 2=Bob
  const sub = idx % 3; // 0=write, 1=encrypt, 2=hmac

  // Apply all completed iterations and sub-steps up to and including this one.
  for (let it = 0; it <= iteration; it++) {
    const hop = BUILD_ORDER[it];
    const subLimit = it < iteration ? 3 : sub + 1;
    if (subLimit >= 1) slotsWritten.add(hop);
    if (subLimit >= 2) encrypted.add(hop);
    if (subLimit >= 3) hmacsComputed.add(hop);
  }

  currentHop = BUILD_ORDER[iteration];
  currentSubStep = SUB_STEPS[sub];

  return { slotsWritten, encrypted, hmacsComputed, currentHop, currentSubStep };
}

const TOTAL_BEATS = 10;
const STEP_MS = 2000;

function captionForStep(step: number): string {
  if (step === 0) {
    return "Alice initializes the 1,300-byte hop_payloads buffer with pseudo-random bytes derived from her session key. The whole buffer is padding; nothing has been written yet.";
  }
  const state = buildStateAtStep(step);
  const hop = state.currentHop!;
  const sub = state.currentSubStep!;
  const hopName = HOP_LABEL[hop];
  const slotSize = SLOT_BYTES[hop];
  const innerHop = NEXT_INNER[hop];
  const hmacToWrite =
    innerHop === null
      ? "32 zero bytes"
      : `${innerHop}_hmac (computed last iteration)`;
  if (sub === "write") {
    return `Shift the buffer right by ${slotSize} bytes (the last ${slotSize} bytes of padding fall off the back). Write [bigsize length | ${hopName}'s TLV | ${hmacToWrite}] into the freshly-vacated front ${slotSize} bytes.`;
  }
  if (sub === "encrypt") {
    return `XOR the entire 1,300-byte buffer with an encryption keystream derived from ${hopName}'s shared secret. Every byte gets one more encryption layer — ${hopName}'s slot, every earlier slot, and the padding.`;
  }
  // hmac
  if (hop === "bob") {
    return `Compute bob_hmac over the encrypted buffer. bob_hmac becomes the OUTER HMAC of the packet — the final 32 bytes appended after hop_payloads. It's the value Bob will verify on receipt before peeling.`;
  }
  const nextHopName = HOP_LABEL[BUILD_ORDER[BUILD_ORDER.indexOf(hop) + 1]];
  return `Compute ${hop}_hmac over the encrypted buffer. ${hop}_hmac will be written into ${nextHopName}'s slot's HMAC field on the next iteration.`;
}

function actionsForStep(step: number): { hop: ForwarderId | null; actions: string[] } {
  if (step === 0) {
    return {
      hop: null,
      actions: [
        `▶ hop_payloads ← chacha20(pad_key, 0, 1300)  // 1,300 random bytes`,
        `▶ prev_hmac ← bytes(32)  // 32 zero bytes`,
      ],
    };
  }
  const state = buildStateAtStep(step);
  const hop = state.currentHop!;
  const sub = state.currentSubStep!;
  const innerHop = NEXT_INNER[hop];
  const hmacRef = innerHop === null ? "32 zero bytes" : `${innerHop}_hmac`;
  const slotSize = SLOT_BYTES[hop];
  const acts: string[] = [];
  if (sub === "write") {
    acts.push(`▶ Right-shift hop_payloads by ${slotSize} bytes (last ${slotSize} bytes drop off)`);
    acts.push(`▶ Write [bigsize len | ${HOP_LABEL[hop]}'s TLV | ${hmacRef}] into front ${slotSize} bytes`);
  } else if (sub === "encrypt") {
    acts.push(`✓ Right-shift hop_payloads by ${slotSize} bytes`);
    acts.push(`✓ Write [bigsize len | ${HOP_LABEL[hop]}'s TLV | ${hmacRef}] at front`);
    acts.push(`▶ hop_payloads ← hop_payloads XOR chacha20(rho_${hop}, 0, 1300)  // entire buffer`);
  } else {
    acts.push(`✓ Right-shift hop_payloads by ${slotSize} bytes`);
    acts.push(`✓ Write [bigsize len | ${HOP_LABEL[hop]}'s TLV | ${hmacRef}] at front`);
    acts.push(`✓ XOR with chacha20(rho_${hop}, 0, 1300)`);
    acts.push(`▶ ${hop}_hmac ← HMAC(mu_${hop}, hop_payloads)`);
    if (hop === "bob") {
      acts.push(`▶ packet ← 0x00 || E_AB || hop_payloads || bob_hmac`);
    }
  }
  return { hop, actions: acts };
}

const SUB_STEP_LABEL: Record<SubStep, string> = {
  write: "Writing slot",
  encrypt: "Applying encryption",
  hmac: "Computing HMAC",
};

const SUB_STEP_COLOR: Record<SubStep, string> = {
  write: "#3b6aa0",
  encrypt: "#b8860b",
  hmac: "#5a7a2f",
};

export function WrapPrimerDiagram() {
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

  const state = buildStateAtStep(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="wrap-primer"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Building the onion from the inside out
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

            {/* Detailed onion packet (Russian-doll layout) */}
            <DetailedPacket state={state} step={step} />

            {/* HMAC chain indicator */}
            <HmacChainIndicator state={state} />

            {/* Step action panel — explains what the current step is doing */}
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

// ── Hop track (matches slice-in-packet style) ──────────────────────────────

function HopTrack({ state }: { state: BuildState }) {
  return (
    <div className="relative mx-auto mb-3" style={{ height: 80, maxWidth: 720 }}>
      {/* Connectors between adjacent hops, matching slice-in-packet */}
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

      {/* Hop circles */}
      {HOPS.map((id) => {
        const isCurrent = state.currentHop === id;
        const isCompleted =
          id !== "alice" && state.hmacsComputed.has(id as ForwarderId);
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
                  style={{
                    fontSize: 18,
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
    </div>
  );
}

// ── Sub-step indicator ─────────────────────────────────────────────────────

function SubStepIndicator({
  state,
  step,
}: {
  state: BuildState;
  step: number;
}) {
  const hop = state.currentHop;
  const sub = state.currentSubStep;
  const iteration = hop ? BUILD_ORDER.indexOf(hop) + 1 : 0;

  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      {step === 0 ? (
        <div
          className="text-[11px] font-bold tracking-[0.06em] px-3 py-1 border-[1.5px]"
          style={{
            background: "#fffdf5",
            borderColor: "rgba(15,23,42,0.3)",
            color: "#475569",
            fontFamily: MONO,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Initial state
        </div>
      ) : (
        <>
          <div
            className="text-[11px] font-bold tracking-[0.06em] px-2.5 py-1 border-[1.5px]"
            style={{
              background: HOP_FILL[hop!],
              borderColor: HOP_STROKE[hop!],
              color: "#0f172a",
              fontFamily: MONO,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Iteration {iteration}: {HOP_LABEL[hop!]}
          </div>
          <span style={{ color: "#94a3b8" }}>·</span>
          <div
            className="text-[11px] font-bold tracking-[0.06em] px-2.5 py-1 border-[1.5px]"
            style={{
              background: `${SUB_STEP_COLOR[sub!]}24`,
              borderColor: SUB_STEP_COLOR[sub!],
              color: SUB_STEP_COLOR[sub!],
              fontFamily: MONO,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            sub-step {SUB_STEPS.indexOf(sub!) + 1}/3 · {SUB_STEP_LABEL[sub!]}
          </div>
        </>
      )}
    </div>
  );
}

// ── Detailed onion packet ───────────────────────────────────────────────────

function DetailedPacket({ state, step }: { state: BuildState; step: number }) {
  const bobHmacComputed = state.hmacsComputed.has("bob");
  // HEADER (version + E_AB) is computed up-front from the session key, so
  // it's present from step 0 onwards. OUTER HMAC is bob_hmac, which only
  // exists once Bob's HMAC iteration has run (step 9).
  const showHeader = true;
  const showOuterHmac = bobHmacComputed;

  const titleText = showOuterHmac
    ? "onion_routing_packet (assembled)"
    : step === 0
      ? "onion_routing_packet (initialized)"
      : "onion_routing_packet (under construction)";

  return (
    <div
      className="border-[1.5px] mb-4"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
      }}
    >
      {/* Black sub-header */}
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

      {/* HEADER | PAYLOAD AREA | OUTER HMAC. Sections appear conditionally
          so the user only sees what's actually been added. */}
      <div className="p-3">
        <div
          className="flex"
          style={{
            background: "#fffdf5",
            border: "1.5px solid #0f172a",
          }}
        >
          {/* HEADER (visible once iterations begin) */}
          {showHeader && (
            <div
              className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
              style={{
                flexBasis: "15%",
                borderColor: "#0f172a",
                padding: "10px 6px",
                background: showOuterHmac
                  ? `${HOP_STROKE.bob}20`
                  : "#f1f5f9",
                transition: "background 600ms ease-out",
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
          )}

          {/* PAYLOAD AREA. Russian-doll wraps. */}
          <div
            className="relative"
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRight: showOuterHmac ? "1.5px solid #0f172a" : "none",
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

          {/* OUTER HMAC (visible once bob_hmac has been computed) */}
          {showOuterHmac && (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{
                flexBasis: "13%",
                padding: "10px 4px",
                background: `${HOP_STROKE.bob}20`,
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
                style={{
                  fontFamily: MONO,
                  color: HOP_STROKE.bob,
                }}
              >
                → Bob
              </span>
              <span
                className="text-[8.5px] opacity-60 mt-0.5"
                style={{ fontFamily: MONO, color: "#475569" }}
              >
                bob_hmac
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Byte-accurate linear payload area ──────────────────────────────────────

// Visual slot widths (% of the 1,300-byte buffer). Real proportions would
// be tiny (65/1300 ≈ 5%), so we enlarge for readability and label exact
// bytes inline. Padding gets whatever remains.
const SLOT_WIDTH_PCT: Record<ForwarderId, number> = {
  bob: 27,
  charlie: 27,
  dave: 30,
};

// bigsize-encoded length of (TLV + HMAC). For slots < 253B that's the slot
// size minus the 1-byte bigsize prefix itself.
const SLOT_BIGSIZE_HEX: Record<ForwarderId, string> = {
  bob: "0x40", // 64
  charlie: "0x40", // 64
  dave: "0x63", // 99
};
const TOTAL_BUFFER_BYTES = 1300;

// Returns the encryption hops that have been XORed into the bytes belonging
// to `content` (a hop's slot, or "padding") at the given step.
//
// Each iteration's encryption applies to the WHOLE 1,300-byte buffer, so a
// region accumulates one hatch per encryption round it has lived through.
// • Padding has been there since step 0, so every completed encryption
//   round adds a layer.
// • A slot only exists from its own iteration's WRITE substep onward, so
//   only encryption rounds that ran AFTER (or at) its own iteration apply
//   to it. Concretely: hop H's slot picks up an encryption layer from each
//   completed encrypt-substep where the encrypting hop's iteration index ≥
//   H's iteration index in BUILD_ORDER.
function encryptionLayers(
  content: ForwarderId | "padding",
  state: BuildState,
): ForwarderId[] {
  const layers: ForwarderId[] = [];
  for (const hop of BUILD_ORDER) {
    if (!state.encrypted.has(hop)) continue;
    if (content === "padding") {
      layers.push(hop);
      continue;
    }
    const contentIter = BUILD_ORDER.indexOf(content);
    const encryptIter = BUILD_ORDER.indexOf(hop);
    if (contentIter <= encryptIter) layers.push(hop);
  }
  return layers;
}

function PayloadAreaLinear({
  state,
  step,
}: {
  state: BuildState;
  step: number;
}) {
  // Build the front-to-back region order. Most-recently-written slot is
  // at the FRONT of the buffer; iterate BUILD_ORDER in reverse and push
  // hops whose slot has been written. Padding is always last.
  const slotOrder: ForwarderId[] = [];
  for (let i = BUILD_ORDER.length - 1; i >= 0; i--) {
    const hop = BUILD_ORDER[i];
    if (state.slotsWritten.has(hop)) slotOrder.push(hop);
  }

  // Compute left-edge percentage for each slot and for padding.
  let cursor = 0;
  const slotLeft: Record<string, number> = {};
  for (const hop of slotOrder) {
    slotLeft[hop] = cursor;
    cursor += SLOT_WIDTH_PCT[hop];
  }
  const paddingLeft = cursor;

  // Padding byte count: 1300 - (sum of slot bytes written so far). Tracks
  // the actual buffer state — bytes that fell off the back during shifts
  // are no longer counted.
  const paddingBytes =
    TOTAL_BUFFER_BYTES -
    slotOrder.reduce((sum, hop) => sum + SLOT_BYTES[hop], 0);

  const isWriting =
    state.currentSubStep === "write" && state.currentHop !== null;

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
      {/* Slot regions */}
      {slotOrder.map((hop) => {
        const just = isWriting && state.currentHop === hop;
        return (
          <SlotRegion
            key={hop}
            hop={hop}
            leftPct={slotLeft[hop]}
            widthPct={SLOT_WIDTH_PCT[hop]}
            layers={encryptionLayers(hop, state)}
            justWritten={just}
          />
        );
      })}

      {/* Padding region */}
      <PaddingRegion
        leftPct={paddingLeft}
        bytes={paddingBytes}
        layers={encryptionLayers("padding", state)}
        isInit={step === 0}
      />
    </div>
  );
}

function SlotRegion({
  hop,
  leftPct,
  widthPct,
  layers,
  justWritten,
}: {
  hop: ForwarderId;
  leftPct: number;
  widthPct: number;
  layers: ForwarderId[];
  justWritten: boolean;
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
        boxShadow: justWritten
          ? `0 0 0 2px ${stroke}66, 0 0 12px ${stroke}55`
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
  isInit,
}: {
  leftPct: number;
  bytes: number;
  layers: ForwarderId[];
  isInit: boolean;
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
        <div style={{ fontSize: 9 }}>
          {isInit
            ? "1,300 bytes (pseudo-random init)"
            : `${bytes.toLocaleString()} bytes`}
        </div>
      </div>
      <HatchOverlay hops={layers} />
    </div>
  );
}

// One stripe pattern per encryption layer, semi-transparent so the slot
// label underneath stays readable. Different angles per hop create a
// crosshatch when stacked. Opacity scales down as more layers stack so
// the cumulative density stays under control (3 layers ≈ 0.30 effective).
function HatchOverlay({ hops }: { hops: ForwarderId[] }) {
  // Per-layer opacity: keep hatches subtle so labels stay legible. With
  // 1 layer alone, 0.13 reads as a clear single direction; with 3 stacked,
  // the crosshatch is visible without burying the text.
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

function SlotCell({ hop }: { hop: ForwarderId }) {
  const color = HOP_STROKE[hop];
  const fill = HOP_FILL[hop];
  const nextColor = NEXT_HOP_COLOR[hop];

  return (
    <div className="flex h-full" style={{ position: "relative" }}>
      {/* LEN — bigsize length prefix. Shown as the literal hex byte that
          encodes (slot_inner_size). For slots ≤252 bytes, that's a single
          byte equal to (slot_size - 1). */}
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

      {/* TLV — main label region. Solid label island sits above hatches via
          zIndex 6 so the hop name stays legible no matter how many
          encryption layers have stacked up. */}
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

      {/* HMAC — what the slot's HMAC field commits to: charlie_hmac inside
          Bob, dave_hmac inside Charlie, 32 zero bytes inside Dave. */}
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

// ── HMAC chain indicator ────────────────────────────────────────────────────

function HmacChainIndicator({ state }: { state: BuildState }) {
  const pills: Array<{
    label: string;
    color: string;
    ready: boolean;
  }> = [
    { label: "bob_hmac", color: HOP_STROKE.bob, ready: state.hmacsComputed.has("bob") },
    { label: "charlie_hmac", color: HOP_STROKE.charlie, ready: state.hmacsComputed.has("charlie") },
    { label: "dave_hmac", color: HOP_STROKE.dave, ready: state.hmacsComputed.has("dave") },
    { label: "0x00…", color: "#475569", ready: state.slotsWritten.has("dave") },
  ];
  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-[0.08em] mb-2 text-center"
        style={{ color: "#475569", fontFamily: MONO }}
      >
        HMAC chain (each commits to the layer beneath it)
      </div>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {pills.map((p, i) => (
          <div key={p.label} className="flex items-center gap-2">
            <div
              className="px-2 py-0.5 border-[1.5px]"
              style={{
                background: p.ready ? `${p.color}24` : "#fffdf5",
                borderColor: p.ready ? p.color : "rgba(15,23,42,0.25)",
                color: p.ready ? p.color : "#94a3b8",
                fontWeight: 700,
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.02em",
                transition: "all 500ms ease-out",
              }}
            >
              {p.label}
            </div>
            {i < pills.length - 1 && (
              <span
                style={{
                  color: p.ready ? "#0f172a" : "#cbd5e1",
                  fontSize: 12,
                  transition: "color 500ms ease-out",
                }}
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step action panel — prose explanation of the current step ──────────────

function StepActionPanel({ step }: { step: number }) {
  const state = buildStateAtStep(step);
  const hop = state.currentHop;
  const sub = state.currentSubStep;
  const accent = hop ? HOP_STROKE[hop] : "#475569";

  // Header text combines iteration + sub-step (the info that used to live in
  // the now-removed top SubStepIndicator).
  let headerText: string;
  if (hop && sub) {
    const iter = BUILD_ORDER.indexOf(hop) + 1;
    const subIdx = SUB_STEPS.indexOf(sub) + 1;
    headerText = `Iteration ${iter}: ${HOP_LABEL[hop]} · Sub-step ${subIdx}/3 · ${SUB_STEP_LABEL[sub]}`;
  } else {
    headerText = "Initial state";
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

// ── Step buttons grouped under iteration headers ───────────────────────────

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
  // Step ranges per group:
  //   INIT: step 0
  //   DAVE: steps 1, 2, 3
  //   CHARLIE: steps 4, 5, 6
  //   BOB: steps 7, 8, 9
  const groups: Array<{
    label: string;
    color: string;
    fill: string;
    steps: number[];
  }> = [
    { label: "INIT", color: "#475569", fill: "#f1f5f9", steps: [0] },
    {
      label: "DAVE",
      color: HOP_STROKE.dave,
      fill: HOP_FILL.dave,
      steps: [1, 2, 3],
    },
    {
      label: "CHARLIE",
      color: HOP_STROKE.charlie,
      fill: HOP_FILL.charlie,
      steps: [4, 5, 6],
    },
    {
      label: "BOB",
      color: HOP_STROKE.bob,
      fill: HOP_FILL.bob,
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

export default WrapPrimerDiagram;
