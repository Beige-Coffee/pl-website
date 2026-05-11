import { useEffect, useState } from "react";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";
import { HatchOverlay, LAYER_ANGLES, LAYER_COLORS } from "./encryptionHatch";
import { renderCaption } from "./captionMarkup";

// ────────────────────────────────────────────────────────────────────────────
// PaddingStrategyDiagram (built 2026-05-08)
//
// Tabbed comparison of three padding strategies for the trailing region of
// the Sphinx packet after a hop peels its hop payload:
//
//   1. Pad with zeros    → Charlie's HMAC fails (rejected)
//   2. Pad with random   → Charlie's HMAC fails (rejected)
//   3. Alice precomputes filler → Charlie's HMAC verifies (success)
//
// Visual is intentionally near-identical to PayloadShrinkDiagram so the
// reader can compare them side-by-side: same hop track with circular nodes,
// same mini onion packet on the wire, same detailed packet card. The
// difference is the trailing-region rendering and the HMAC pass/fail badge
// at the receiving hop.
//
// 4 beats per strategy. Tab-switch resets to step 0.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie" | "dave";
type ForwarderId = "bob" | "charlie" | "dave";
type Strategy = "zeros" | "random" | "filler";

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

const SUCCESS_GREEN = "#5a7a2f";
const ERROR_RED = "#a13a3a";

// ── State per step ──────────────────────────────────────────────────────────

interface StepState {
  holder: HopId;
  fromHop: HopId | null;
  // Hop payloads still present in the payload area, front to back.
  hopPayloads: ForwarderId[];
  // What's at the trailing region after a peel:
  //   - "ciphertext": legitimate encrypted bytes (Alice's original construction)
  //   - "zeros":      0x00 padding from Bob
  //   - "random":     random-looking padding from Bob
  //   - "filler":     extended-keystream bytes (the real fix)
  trailingKind: "ciphertext" | "zeros" | "random" | "filler";
  // Whether to show an HMAC result badge at the holder, and what verdict.
  hmacResult?: "pass" | "fail";
  outerKey: ForwarderId;
  bytes: number;
}

interface StrategyDef {
  id: Strategy;
  label: string;
  color: string;
  steps: StepState[];
  captions: string[];
  outcome: "fail" | "success";
  outcomeText: string;
}

const STRATEGIES: StrategyDef[] = [
  // ── Tab 1: zeros ─────────────────────────────────────────────────────────
  {
    id: "zeros",
    label: "1. Pad with zeros",
    color: ERROR_RED,
    outcome: "fail",
    outcomeText:
      "Charlie's HMAC verification fails. The packet is rejected before any decryption happens.",
    steps: [
      {
        holder: "alice",
        fromHop: null,
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "ciphertext",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "ciphertext",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "zeros",
        outerKey: "charlie",
        bytes: 1300,
      },
      {
        holder: "charlie",
        fromHop: "bob",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "zeros",
        outerKey: "charlie",
        hmacResult: "fail",
        bytes: 1300,
      },
    ],
    captions: [
      "Alice has just constructed the packet. Three encrypted hop payloads concatenated into the 1,300-byte payload area, plus a 32-byte HMAC Alice computed for Bob, plus a header. Total: 1,366 bytes.",
      "Bob has received the packet. He's about to peel his hop payload off the front and figure out what to ship to Charlie.",
      "Bob peels his hop payload off, shifts the remaining content forward, and fills the last 60 bytes of the packet (the gap from his shift, 60 bytes because that matches his hop-payload size) with zeros. The packet is still 1,366 bytes total. He forwards it to Charlie.",
      "Charlie computes HMAC-SHA256(mu_charlie, hop_payloads) and compares against the HMAC field. It doesn't match, Alice baked her HMAC over a specific sequence of bytes, and zeros aren't part of that sequence. Charlie rejects the packet with `invalid_onion_hmac`.",
    ],
  },
  // ── Tab 2: random ────────────────────────────────────────────────────────
  {
    id: "random",
    label: "2. Pad with random bytes",
    color: ERROR_RED,
    outcome: "fail",
    outcomeText:
      "Same problem: random ≠ the specific bytes Alice baked Charlie's HMAC over. Charlie rejects.",
    steps: [
      {
        holder: "alice",
        fromHop: null,
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "ciphertext",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "ciphertext",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "random",
        outerKey: "charlie",
        bytes: 1300,
      },
      {
        holder: "charlie",
        fromHop: "bob",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "random",
        outerKey: "charlie",
        hmacResult: "fail",
        bytes: 1300,
      },
    ],
    captions: [
      "Alice has just constructed the packet. Same starting state as before.",
      "Bob has received the packet. He's about to peel his hop payload.",
      "Bob peels his hop payload, shifts forward, and this time fills the last 60 bytes of the packet (same gap as before) with random-looking bytes. Looks like ciphertext, no obvious zero-pattern. He forwards.",
      "Charlie's HMAC verification still fails. The HMAC Alice baked in is a deterministic function of the *specific* bytes that Alice's `rho` cascade produced. Random bytes don't match that. Charlie rejects with `invalid_onion_hmac`.",
    ],
  },
  // ── Tab 3: filler ────────────────────────────────────────────────────────
  {
    id: "filler",
    label: "3. Alice precomputes filler",
    color: SUCCESS_GREEN,
    outcome: "success",
    outcomeText:
      "Charlie's HMAC verifies. The packet flows through the route exactly as Alice intended.",
    steps: [
      {
        holder: "alice",
        fromHop: null,
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "filler",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["bob", "charlie", "dave"],
        trailingKind: "filler",
        outerKey: "bob",
        bytes: 1300,
      },
      {
        holder: "bob",
        fromHop: "alice",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "filler",
        outerKey: "charlie",
        bytes: 1300,
      },
      {
        holder: "charlie",
        fromHop: "bob",
        hopPayloads: ["charlie", "dave"],
        trailingKind: "filler",
        outerKey: "charlie",
        hmacResult: "pass",
        bytes: 1300,
      },
    ],
    captions: [
      "Alice has just constructed the packet (same construction as in the other strategies). The trailing region is highlighted to show where the filler sits: bytes Alice precomputed so that every downstream HMAC verifies as forwarders peel.",
      "Bob has received the 1,366-byte packet.",
      "Bob peels his hop payload and shifts forward. Crucially, his `rho` keystream extends past 1,300 bytes during the shift, producing exactly the bytes that match what Charlie's HMAC was computed over. The trailing region is filler XORed with Bob's keystream extension.",
      "Charlie computes HMAC-SHA256(mu_charlie, hop_payloads) and it matches the HMAC field. ✓ Verification passes. Charlie peels his layer and forwards to Dave. The chain works.",
    ],
  },
];

const TOTAL_BEATS = 4;

export function PaddingStrategyDiagram() {
  const [strategy, setStrategy] = useState<Strategy>("zeros");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset to step 0 when the strategy tab changes.
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [strategy]);

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

  const strategyDef = STRATEGIES.find((s) => s.id === strategy)!;
  const state = strategyDef.steps[step];
  const caption = strategyDef.captions[step];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="padding-strategy"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Padding strategies, which one works?
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b-[1.5px]"
        style={{ borderColor: "rgba(15,23,42,0.3)", background: "#fffdf5" }}
      >
        {STRATEGIES.map((s) => {
          const active = s.id === strategy;
          return (
            <button
              key={s.id}
              onClick={() => setStrategy(s.id)}
              className="flex-1 px-4 py-2.5 transition-all text-left"
              style={{
                background: active ? "#fef3c7" : "transparent",
                borderRight: "1.5px solid rgba(15,23,42,0.2)",
                borderBottom: active
                  ? `2.5px solid ${s.color}`
                  : "2.5px solid transparent",
                marginBottom: -1.5,
                color: "#0f172a",
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.02em",
                cursor: "pointer",
              }}
              data-testid={`padding-strategy-tab-${s.id}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 480 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 600, maxWidth: 760 }}>
            {/* Hop track */}
            <HopTrack state={state} />

            {/* Caption */}
            <div
              className="text-center text-[12px] mb-4 italic px-4 leading-relaxed"
              style={{ color: "#475569", minHeight: 56 }}
            >
              {renderCaption(caption)}
            </div>

            {/* Detailed onion packet */}
            <DetailedOnionPacket state={state} />

            {/* Outcome banner removed: the corner badge on Charlie's node
                carries the pass/fail signal, and the step caption already
                explains the verdict in prose. */}
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
            {renderCaption(caption)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hop track + traveling packet ────────────────────────────────────────────

function HopTrack({ state }: { state: StepState }) {
  return (
    <div className="relative mb-4" style={{ height: 120 }}>
      {/* Backbone */}
      <div
        className="absolute"
        style={{
          top: 22,
          left: "12%",
          width: "76%",
          borderTop: "1.5px dashed #475569",
        }}
      />

      {/* Active arrow when packet is in transit */}
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

      {/* Nodes, circular badges */}
      {HOPS.map((id) => {
        const isHolder = id === state.holder;
        const showHmacBadge =
          state.hmacResult !== undefined && id === state.holder;
        const size = 48;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: 0,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
              zIndex: showHmacBadge ? 6 : 1,
            }}
          >
            <div className="flex flex-col items-center">
              <div className="relative">
                <div
                  className="rounded-full flex items-center justify-center transition-all"
                  style={{
                    width: size,
                    height: size,
                    background: HOP_FILL[id],
                    border: `2px solid ${
                      state.hmacResult === "fail" && isHolder
                        ? ERROR_RED
                        : state.hmacResult === "pass" && isHolder
                          ? SUCCESS_GREEN
                          : HOP_STROKE[id]
                    }`,
                    borderWidth: isHolder ? 3 : 2,
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
                {/* Corner badge: red ! for failed HMAC, green ✓ for passed.
                    Mirrors the failure-exclamation style used by Bob's node
                    in OperationsLifecycleDiagram so the visual language is
                    consistent across chapters. */}
                {showHmacBadge && (
                  <div
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      background:
                        state.hmacResult === "pass" ? SUCCESS_GREEN : ERROR_RED,
                      color: "#fffdf5",
                      fontWeight: 900,
                      fontSize: state.hmacResult === "pass" ? 13 : 14,
                      lineHeight: 1,
                      border: "1.5px solid #fffdf5",
                      boxShadow:
                        state.hmacResult === "pass"
                          ? "0 2px 6px rgba(90,122,47,0.4)"
                          : "0 2px 6px rgba(161,58,58,0.4)",
                    }}
                    data-testid={`padding-strategy-hmac-${state.hmacResult}`}
                  >
                    {state.hmacResult === "pass" ? "✓" : "!"}
                  </div>
                )}
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

      {/* Traveling mini onion packet */}
      <TravelingPacket state={state} />
    </div>
  );
}

function TravelingPacket({ state }: { state: StepState }) {
  const outerKey = state.outerKey;
  const tintColor = HOP_KEY_COLORS[outerKey];

  // Trailing color for the mini packet's right portion.
  const trailingFill: string = (() => {
    if (state.trailingKind === "zeros") return "#94a3b8";
    if (state.trailingKind === "random") return "#cbd5e1";
    return "#fef3c7"; // ciphertext or filler, gold-ish
  })();

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: 78,
        left: `${NODE_X_PCT[state.holder]}%`,
        transform: "translateX(-50%)",
        transition: "left 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        zIndex: 5,
      }}
    >
      <div
        className="border-[1.5px] flex"
        style={{
          width: 110,
          height: 24,
          background: "#fffdf5",
          borderColor: "#0f172a",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
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
        {/* Mini PAYLOAD: layer hatches for "real" content + trailing region */}
        <div
          className="relative"
          style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
        >
          {state.hopPayloads.map((hop) => (
            <div
              key={hop}
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${LAYER_COLORS[hop]} 0px, ${LAYER_COLORS[hop]} 2.5px, transparent 2.5px, transparent 11px)`,
              }}
            />
          ))}
          {/* Trailing region overlay (after a peel) */}
          {state.trailingKind !== "ciphertext" && (
            <div
              className="absolute"
              style={{
                top: 0,
                bottom: 0,
                right: 0,
                width: "22%",
                background: trailingFill,
                borderLeft: "1.5px solid #0f172a",
                opacity: state.trailingKind === "filler" ? 0 : 1,
              }}
            />
          )}
        </div>
        {/* Mini HMAC */}
        <div
          style={{
            flexBasis: 14,
            flexShrink: 0,
            background: `${tintColor}24`,
            borderLeft: "1.5px solid #0f172a",
          }}
        />
      </div>
    </div>
  );
}

// ── Detailed onion packet ───────────────────────────────────────────────────

function DetailedOnionPacket({ state }: { state: StepState }) {
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
        width: "100%",
        overflow: "hidden",
      }}
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
          {/* HEADER */}
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
            <PayloadInner state={state} />
          </div>

          {/* HMAC */}
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
  bob: HOP_KEY_COLORS.charlie,
  charlie: HOP_KEY_COLORS.dave,
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
// Each slot gets its own confined overlay (no extending across other slots),
// so the layer counts don't compound. stripeOpacity is 0.10; at 1/2/3
// layers that gives ~10/19/27% cumulative hatch visibility.
function LayeredHatches({
  hopPayloads,
  trailingPortionPct,
}: {
  hopPayloads: ForwarderId[];
  trailingPortionPct: number;
}) {
  if (hopPayloads.length === 0) return null;
  const slotRegionPct = 100 - trailingPortionPct;
  const slotWidthPct = slotRegionPct / hopPayloads.length;
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

function PayloadInner({ state }: { state: StepState }) {
  const hopPayloads = state.hopPayloads;
  // Always show a trailing padding region. Alice's hop_payloads field is
  // 1,300 bytes; the ~240 bytes of slots only cover a fraction of it, with
  // the remaining ~1,060 bytes carrying encrypted padding (filler, in the
  // success case; pad-key noise wrapped through all 3 layers, technically,
  // in the others). The rendering content varies by trailingKind.
  const trailingPortionPct = 22;

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
      {/* Hop payloads region */}
      <div
        className="absolute top-0 bottom-0 left-0 flex"
        style={{
          width: `${100 - trailingPortionPct}%`,
          transition: "width 600ms ease-out",
          zIndex: 1,
        }}
      >
        {hopPayloads.map((forwarder, i) => {
          const color = HOP_KEY_COLORS[forwarder];
          const fill = HOP_FILL[forwarder];
          // Always have a border between the rightmost slot and the trailing
          // region — the trailing region is always rendered now.
          const isLast = false;
          const nextColor = NEXT_HOP_COLOR[forwarder];
          return (
            <div
              key={forwarder}
              className="flex-1 flex"
              style={{
                borderRight: isLast ? "none" : `1.5px solid ${color}`,
                minWidth: 0,
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

              {/* TLV payload sub-cell, no per-hop payload hatch; layered hatches
                  above show the nested encryption wrapping. */}
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

      {/* Trailing padding region. Always rendered so the reader sees Alice's
          hop_payloads field has more than just the slot region. Content
          varies by trailingKind:
            • ciphertext → layered hatches + "padding" label (Alice's view,
              before any peel; bytes are encrypted padding from her wrap)
            • zeros     → flat gray + "0x00..." (Bob replaced with zeros)
            • random    → flat gray + random hex (Bob replaced with random)
            • filler    → gold/charlie crosshatch + "FILLER" (highlight that
              the bytes are exactly the precomputed filler) */}
      <div
        className="absolute top-0 bottom-0 right-0 flex flex-col items-center justify-center"
        style={{
          width: `${trailingPortionPct}%`,
          background:
            state.trailingKind === "zeros"
              ? "#e2e8f0"
              : state.trailingKind === "random"
                ? "#cbd5e1"
                : state.trailingKind === "filler"
                  ? "#fef3c7"
                  : "#fffdf5",
          borderLeft: "1.5px solid #0f172a",
          transition: "all 600ms ease-out",
          overflow: "hidden",
        }}
      >
        {/* Ciphertext (Alice's pre-peel padding): layered hatches mirror
            the deepest slot's wrap state so the visual reads as "this is
            also part of the encrypted hop_payloads field." */}
        {state.trailingKind === "ciphertext" && (
          <>
            <HatchOverlay
              hops={hopPayloads}
              zIndex={1}
              stripeOpacity={0.1}
            />
            <span
              className="relative"
              style={{
                fontSize: 9,
                fontFamily: MONO,
                color: "#475569",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background: "rgba(255,253,245,0.85)",
                padding: "0 4px",
                zIndex: 2,
              }}
            >
              padding
            </span>
          </>
        )}
        {state.trailingKind === "zeros" && (
          <div
            className="text-[9px] font-bold leading-tight tracking-[0.04em]"
            style={{ fontFamily: MONO, color: "#475569" }}
          >
            0x00
            <br />
            0x00
            <br />
            0x00
          </div>
        )}
        {state.trailingKind === "random" && (
          <div
            className="text-[9px] font-bold leading-tight tracking-[0.04em]"
            style={{ fontFamily: MONO, color: "#475569" }}
          >
            4f a3
            <br />
            c7 19
            <br />
            82 5e
          </div>
        )}
        {state.trailingKind === "filler" && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, #b8860bA0 0px, #b8860bA0 3px, transparent 3px, transparent 8px), repeating-linear-gradient(45deg, ${HOP_KEY_COLORS.charlie}A0 0px, ${HOP_KEY_COLORS.charlie}A0 3px, transparent 3px, transparent 8px)`,
                opacity: 0.5,
              }}
            />
            <div
              className="relative text-[10px] font-bold tracking-[0.05em]"
              style={{ color: "#0f172a" }}
            >
              FILLER
            </div>
          </>
        )}
      </div>

      {/* Layered encryption hatches showing nested wrapping. */}
      <LayeredHatches hopPayloads={hopPayloads} trailingPortionPct={trailingPortionPct} />
    </div>
  );
}

export default PaddingStrategyDiagram;
