import { useEffect, useState } from "react";
import { Tok } from "./mathTokens";
import { SlotSubCell } from "./SlotSubCell";
import { HatchOverlay, LAYER_ANGLES, LAYER_COLORS } from "./encryptionHatch";
import { StepCaption } from "./StepCaption";
import { MorphBox, MORPH_TRANSITION } from "./morph";

// ────────────────────────────────────────────────────────────────────────────
// PaddingStrategyDiagram (rebuilt 2026-06-06)
//
// Tabbed comparison of three ways to fill the back gap after a hop peels:
//   1. Pad with zeros           → Charlie's HMAC fails
//   2. Pad with random bytes    → Charlie's HMAC fails
//   3. Alice precomputes filler → Charlie's HMAC verifies
//
// Key model: after Bob peels his hop payload off the FRONT, the remaining
// payloads AND the original padding shift forward. That opens a 60-byte gap at
// the BACK, which Bob fills with new bytes (zeros / random / filler). So the
// trailing region is two distinct things post-peel:
//   • the original padding, shifted forward (unchanged ciphertext), and
//   • a NEW gap-fill block at the very back (the only part that differs by tab).
//
// At Charlie's check step the matching parts gray out, leaving the gap-fill +
// HMAC lit; hovering the HMAC opens a compare panel showing what Alice computed
// the HMAC over (filler) vs what arrived (zeros/random/filler), so the cause of
// the mismatch (or the match, for filler) is explicit.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const INK = "#0f172a";
const SLATE = "#475569";

type HopId = "alice" | "bob" | "charlie" | "dave";
type ForwarderId = "bob" | "charlie" | "dave";
type Strategy = "zeros" | "random" | "filler";
type GapFill = "zeros" | "random" | "filler";

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
const NODE_X_PCT: Record<HopId, number> = { alice: 12, bob: 38, charlie: 62, dave: 88 };

const SUCCESS_GREEN = "#5a7a2f";
const ERROR_RED = "#a13a3a";

const NEXT_HOP_LABEL: Record<ForwarderId, string> = { bob: "for Charlie", charlie: "for Dave", dave: "none" };
// Per-hop payload size (bytes) shown on the payload cell. Canonical 60/80/100.
const HOP_PAYLOAD_BYTES: Record<ForwarderId, number> = { bob: 60, charlie: 80, dave: 100 };
const NEXT_HOP_COLOR: Record<ForwarderId, string> = { bob: HOP_KEY_COLORS.charlie, charlie: HOP_KEY_COLORS.dave, dave: SLATE };

// ── State per step ──────────────────────────────────────────────────────────
interface StepState {
  holder: HopId;
  fromHop: HopId | null;
  hopPayloads: ForwarderId[]; // hop payloads still present, front to back
  gapFill: GapFill | null; // new bytes Bob added at the back (null = pre-peel)
  hmacResult?: "pass" | "fail"; // set only at the check step
  outerKey: ForwarderId;
}
interface StrategyDef {
  id: Strategy;
  label: string;
  color: string;
  steps: StepState[];
  captions: string[];
}

const pre = (holder: HopId, fromHop: HopId | null, outerKey: ForwarderId): StepState => ({
  holder, fromHop, hopPayloads: ["bob", "charlie", "dave"], gapFill: null, outerKey,
});

const STRATEGIES: StrategyDef[] = [
  {
    id: "zeros",
    label: "1. Pad with zeros",
    color: ERROR_RED,
    steps: [
      pre("alice", null, "bob"),
      pre("bob", "alice", "bob"),
      { holder: "bob", fromHop: "alice", hopPayloads: ["charlie", "dave"], gapFill: "zeros", outerKey: "charlie" },
      { holder: "charlie", fromHop: "bob", hopPayloads: ["charlie", "dave"], gapFill: "zeros", outerKey: "charlie", hmacResult: "fail" },
    ],
    captions: [
      "Alice has just built the packet: three encrypted hop payloads at the front, then encrypted padding filling the rest of the 1,300-byte field, plus the header and Bob's HMAC. Total: 1,366 bytes.",
      "Bob received the packet. He's about to peel his hop payload off the front.",
      "Bob peels his hop payload off the front, and everything else, the remaining payloads and the padding, shifts forward. That opens a 60-byte gap at the back (60 = the payload he removed). In this strategy he fills the gap with zeros to keep the packet at 1,366 bytes, then forwards to Charlie.",
      "Before doing anything, Charlie recomputes his HMAC over the bytes he received. Hover the HMAC tag: Alice computed it over the filler she'd precomputed for the back, but Bob's gap is zeros. They differ, so Charlie rejects with `invalid_onion_hmac`.",
    ],
  },
  {
    id: "random",
    label: "2. Pad with random bytes",
    color: ERROR_RED,
    steps: [
      pre("alice", null, "bob"),
      pre("bob", "alice", "bob"),
      { holder: "bob", fromHop: "alice", hopPayloads: ["charlie", "dave"], gapFill: "random", outerKey: "charlie" },
      { holder: "charlie", fromHop: "bob", hopPayloads: ["charlie", "dave"], gapFill: "random", outerKey: "charlie", hmacResult: "fail" },
    ],
    captions: [
      "Same starting packet as before: payloads up front, encrypted padding behind them, 1,366 bytes total.",
      "Bob received the packet, about to peel his hop payload off the front.",
      "Same shift forward, opening the same 60-byte back gap. This time Bob fills it with random-looking bytes. They look like ciphertext, no tell-tale zero pattern, and the packet is still 1,366 bytes.",
      "Charlie recomputes his HMAC over what he received. Hover the HMAC tag: Alice computed it over her precomputed filler, and random bytes aren't that filler. Mismatch, rejected with `invalid_onion_hmac`.",
    ],
  },
  {
    id: "filler",
    label: "3. Alice precomputes filler",
    color: SUCCESS_GREEN,
    steps: [
      pre("alice", null, "bob"),
      pre("bob", "alice", "bob"),
      { holder: "bob", fromHop: "alice", hopPayloads: ["charlie", "dave"], gapFill: "filler", outerKey: "charlie" },
      { holder: "charlie", fromHop: "bob", hopPayloads: ["charlie", "dave"], gapFill: "filler", outerKey: "charlie", hmacResult: "pass" },
    ],
    captions: [
      "Same starting packet. The difference is invisible here but crucial: the bytes at the very back are a block Alice precomputed, the filler, set up to survive each peel.",
      "Bob received the 1,366-byte packet, about to peel.",
      "Same shift, same 60-byte back gap. But here the bytes that land in the gap are exactly the filler Alice precomputed, which equals what Bob's own keystream produces during the peel. Still 1,366 bytes, forwarded to Charlie.",
      "Charlie recomputes his HMAC. Hover the HMAC tag: Alice computed it over this exact filler, and the gap holds that same filler. They match, the HMAC verifies, and Charlie forwards to Dave. This is the one fill that reproduces the bytes the HMAC already committed to.",
    ],
  },
];

const TOTAL_BEATS = 4;

export function PaddingStrategyDiagram() {
  const [strategy, setStrategy] = useState<Strategy>("zeros");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [comparing, setComparing] = useState(false);

  useEffect(() => { setStep(0); setPlaying(false); setComparing(false); }, [strategy]);
  useEffect(() => { setComparing(false); }, [step]);
  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStep((s) => s + 1), 2400);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => { if (step >= TOTAL_BEATS - 1) setStep(0); setPlaying(true); };
  const reset = () => { setStep(0); setPlaying(false); };

  const strategyDef = STRATEGIES.find((s) => s.id === strategy)!;
  const state = strategyDef.steps[step];
  const caption = strategyDef.captions[step];

  return (
    <div className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden" data-testid="padding-strategy" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">Padding strategies, which one works?</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b-[1.5px]" style={{ borderColor: "rgba(15,23,42,0.3)", background: "#fffdf5" }}>
        {STRATEGIES.map((s) => {
          const active = s.id === strategy;
          return (
            <button key={s.id} onClick={() => setStrategy(s.id)} className="flex-1 px-4 py-2.5 transition-all text-left"
              style={{ background: active ? "#fef3c7" : "transparent", borderRight: "1.5px solid rgba(15,23,42,0.2)",
                borderBottom: active ? `2.5px solid ${s.color}` : "2.5px solid transparent", marginBottom: -1.5,
                color: INK, fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: "0.02em", cursor: "pointer" }}
              data-testid={`padding-strategy-tab-${s.id}`}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6" style={{ minHeight: 340 }}>
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 620, maxWidth: 760 }}>
            <HopTrack state={state} />
            <DetailedOnionPacket state={state} comparing={comparing} setComparing={setComparing} />
            <StepCaption
              label={`Step ${step + 1} of ${TOTAL_BEATS}`}
              caption={caption}
              accentColor={HOP_STROKE[state.holder]}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button onClick={playing ? () => setPlaying(false) : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors">
              {playing ? "❚❚ Pause" : step >= TOTAL_BEATS - 1 ? "↻ Replay" : "▶ Play"}
            </button>
            <button onClick={reset} className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors">Reset</button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_BEATS }, (_, i) => (
                <button key={i} onClick={() => setStep(i)} className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                  style={{ background: step === i ? "#b8860b" : "#fffdf5", borderColor: step === i ? "#b8860b" : "rgba(15,23,42,0.4)", color: step === i ? "#fff" : INK }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hop track ─────────────────────────────────────────────────────────────
function HopTrack({ state }: { state: StepState }) {
  return (
    <div className="relative mb-4" style={{ height: 120 }}>
      <div className="absolute" style={{ top: 22, left: "12%", width: "76%", borderTop: "1.5px dashed #475569" }} />
      {state.fromHop && (
        <div className="absolute pointer-events-none" style={{ top: 18, left: `calc(${NODE_X_PCT[state.fromHop]}% + 28px)`, width: `calc(${NODE_X_PCT[state.holder] - NODE_X_PCT[state.fromHop]}% - 56px)` }}>
          <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none">
            <line x1="0" y1="5" x2="92" y2="5" stroke="#b8860b" strokeWidth="1.5" />
            <polygon points="100,5 90,1 90,9" fill="#b8860b" />
          </svg>
        </div>
      )}
      {HOPS.map((id) => {
        const isHolder = id === state.holder;
        const showBadge = state.hmacResult !== undefined && id === state.holder;
        const size = 48;
        return (
          <div key={id} className="absolute" style={{ top: 0, left: `${NODE_X_PCT[id]}%`, transform: "translateX(-50%)", zIndex: showBadge ? 6 : 1 }}>
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="rounded-full flex items-center justify-center transition-all"
                  style={{ width: size, height: size, background: HOP_FILL[id],
                    border: `${isHolder ? 3 : 2}px solid ${state.hmacResult === "fail" && isHolder ? ERROR_RED : state.hmacResult === "pass" && isHolder ? SUCCESS_GREEN : HOP_STROKE[id]}`,
                    boxShadow: isHolder ? `0 0 0 4px rgba(184,134,11,0.30)` : "none" }}>
                  <span className="font-bold" style={{ fontSize: size * 0.4, color: INK }}>{HOP_LABEL[id].charAt(0)}</span>
                </div>
                {showBadge && (
                  <div className="absolute rounded-full flex items-center justify-center"
                    style={{ top: -6, right: -6, width: 22, height: 22, background: state.hmacResult === "pass" ? SUCCESS_GREEN : ERROR_RED,
                      color: "#fffdf5", fontWeight: 900, fontSize: state.hmacResult === "pass" ? 13 : 14, lineHeight: 1, border: "1.5px solid #fffdf5",
                      boxShadow: state.hmacResult === "pass" ? "0 2px 6px rgba(90,122,47,0.4)" : "0 2px 6px rgba(161,58,58,0.4)" }}
                    data-testid={`padding-strategy-hmac-${state.hmacResult}`}>
                    {state.hmacResult === "pass" ? "✓" : "!"}
                  </div>
                )}
              </div>
              <div className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]" style={{ color: INK }}>{HOP_LABEL[id]}</div>
            </div>
          </div>
        );
      })}
      <TravelingPacket state={state} />
    </div>
  );
}

function TravelingPacket({ state }: { state: StepState }) {
  const tintColor = HOP_KEY_COLORS[state.outerKey];
  const gapColor = state.gapFill === "zeros" ? "#94a3b8" : state.gapFill === "random" ? "#cbd5e1" : state.gapFill === "filler" ? "#fef3c7" : null;
  return (
    <div className="absolute pointer-events-none" style={{ top: 78, left: `${NODE_X_PCT[state.holder]}%`, transform: "translateX(-50%)", transition: "left 800ms cubic-bezier(0.4,0,0.2,1)", zIndex: 5 }}>
      <div className="border-[1.5px] flex" style={{ width: 110, height: 24, background: "#fffdf5", borderColor: INK, overflow: "hidden", boxShadow: "0 2px 6px rgba(15,23,42,0.18)" }}>
        <div style={{ flexBasis: 16, flexShrink: 0, background: `${tintColor}24`, borderRight: "1.5px solid #0f172a", transition: "background 600ms ease-out" }} />
        <div className="relative" style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
          {state.hopPayloads.map((hop) => (
            <div key={hop} className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(${LAYER_ANGLES[hop]}deg, ${LAYER_COLORS[hop]} 0px, ${LAYER_COLORS[hop]} 2.5px, transparent 2.5px, transparent 11px)` }} />
          ))}
          {gapColor && <div className="absolute" style={{ top: 0, bottom: 0, right: 0, width: "20%", background: gapColor, borderLeft: "1.5px solid #0f172a" }} />}
        </div>
        <div style={{ flexBasis: 14, flexShrink: 0, background: `${tintColor}24`, borderLeft: "1.5px solid #0f172a" }} />
      </div>
    </div>
  );
}

// ── Detailed onion packet ───────────────────────────────────────────────────
function DetailedOnionPacket({ state, comparing, setComparing }: { state: StepState; comparing: boolean; setComparing: (v: boolean) => void }) {
  const atCheck = state.hmacResult !== undefined;
  const verdict = state.hmacResult;
  const outerColor = HOP_KEY_COLORS[state.outerKey];
  const verdictColor = verdict === "pass" ? SUCCESS_GREEN : ERROR_RED;
  const segmentLabel = state.fromHop ? `${HOP_LABEL[state.fromHop]} → ${HOP_LABEL[state.holder]}` : `at ${HOP_LABEL[state.holder]}`;

  return (
    <div className="mx-auto border-[1.5px]" style={{ background: "#fffdf5", borderColor: INK, width: "100%", overflow: "hidden" }}>
      <div className="bg-black text-white px-3 py-1.5 flex items-center gap-2" style={{ fontFamily: MONO }}>
        <span style={{ width: 8, height: 8, background: "#b8860b", display: "inline-block", flexShrink: 0 }} />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold whitespace-nowrap overflow-hidden" style={{ textOverflow: "ellipsis" }}>onion_routing_packet ({segmentLabel})</span>
      </div>

      <div className="p-3">
        <div className="border-[1.5px] flex" style={{ background: "#fffdf5", borderColor: INK, minHeight: 110 }}>
          {/* HEADER */}
          <div className="flex flex-col items-center justify-center text-center border-r-[1.5px]" style={{ flexBasis: 108, flexShrink: 0, borderColor: INK, color: INK, padding: "8px 6px", background: `${outerColor}24`, opacity: atCheck ? 0.35 : 1, transition: "all 300ms" }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight" style={{ fontFamily: MONO }}>HEADER</span>
            <div style={{ width: "60%", height: 1, background: "#0f172a30", marginTop: 5, marginBottom: 6 }} />
            <span className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight" style={{ fontFamily: MONO }}>version</span>
            <span className="text-[11px] font-bold leading-tight mt-0.5" style={{ fontFamily: MONO, color: INK }}>0x00</span>
            <span className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1.5" style={{ fontFamily: MONO }}>ephemeral pubkey</span>
            <span key={state.outerKey} className="font-bold leading-tight mt-0.5" style={{ fontFamily: MONO, color: outerColor, fontSize: 16 }}>
              <Tok token={EPH_PUBKEY_TOKEN[state.outerKey]} color={outerColor} />
            </span>
          </div>

          {/* PAYLOAD AREA */}
          <div className="flex flex-col" style={{ flex: 1, padding: "8px 8px", minWidth: 0, borderRight: "1.5px solid #0f172a" }}>
            <div className="text-center mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight" style={{ fontFamily: MONO }}>PAYLOAD AREA</span>
            </div>
            <PayloadInner state={state} focusMode={atCheck} />
          </div>

          {/* HMAC (hover target at the check step) */}
          <div
            className="flex flex-col items-center justify-center text-center"
            onMouseEnter={atCheck ? () => setComparing(true) : undefined}
            onMouseLeave={atCheck ? () => setComparing(false) : undefined}
            style={{ flexBasis: 74, flexShrink: 0, color: INK, padding: "8px 4px",
              background: atCheck ? `${verdictColor}1f` : `${outerColor}24`,
              boxShadow: atCheck ? `inset 0 0 0 2px ${verdictColor}` : undefined,
              cursor: atCheck ? "pointer" : "default", transition: "all 300ms" }}
            data-testid="padding-strategy-hmac-tag">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight" style={{ fontFamily: MONO }}>HMAC</span>
            <span className="text-[10px] font-bold leading-tight mt-0.5" style={{ fontFamily: MONO, color: atCheck ? verdictColor : outerColor }}>→ {HOP_LABEL[state.outerKey]}</span>
            <span className="text-[8.5px] font-normal opacity-60 leading-tight mt-0.5" style={{ fontFamily: MONO }}>32 B</span>
            {atCheck && (
              <span className="text-[7.5px] font-bold leading-tight mt-1.5 uppercase tracking-[0.03em] whitespace-pre-line" style={{ color: verdictColor, fontFamily: MONO }}>
                {comparing ? "see below ↓" : "hover to\ncompare"}
              </span>
            )}
          </div>
        </div>

        {/* Compare panel (hover the HMAC at the check step) */}
        {atCheck && comparing && <ComparePanel gapFill={state.gapFill!} pass={verdict === "pass"} />}
      </div>
    </div>
  );
}

// ── Payload inner: hop payloads | shifted padding | new gap-fill ─────────────
function PayloadInner({ state, focusMode }: { state: StepState; focusMode: boolean }) {
  const { hopPayloads, gapFill, hmacResult } = state;
  return (
    <div className="relative flex border-[1.5px]" style={{ height: 64, borderColor: INK, background: "#fffdf5", overflow: "hidden" }}>
      {hopPayloads.map((fwd, i) => (
        <HopPayloadCell key={fwd} forwarder={fwd} layers={hopPayloads.slice(0, i + 1)} dim={focusMode} />
      ))}
      <PaddingRegion layers={hopPayloads} grow={gapFill ? 2 : 3} dim={false} />
      {gapFill && <GapFillRegion kind={gapFill} verdict={hmacResult} focus={focusMode} />}
    </div>
  );
}

function HopPayloadCell({ forwarder, layers, dim }: { forwarder: ForwarderId; layers: ForwarderId[]; dim: boolean }) {
  const color = HOP_KEY_COLORS[forwarder];
  const fill = HOP_FILL[forwarder];
  return (
    <div className="relative flex" style={{ flexGrow: 2.4, flexBasis: 0, minWidth: 98, borderRight: `1.5px solid ${color}`, opacity: dim ? 0.3 : 1, transition: "opacity 300ms, flex-grow 450ms ease-in-out, flex-basis 450ms ease-in-out" }}>
      <SlotSubCell section="len" style={{ width: 24, flexShrink: 0, background: fill, borderRight: `1px dashed ${color}90`, fontSize: 8.5, fontFamily: MONO, color: SLATE, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700 }}>len</SlotSubCell>
      <SlotSubCell section="tlv" className="flex-1 relative flex flex-col items-center justify-center text-center" style={{ background: fill, minWidth: 0 }}>
        <div className="relative text-[9.5px] font-bold uppercase tracking-[0.04em]" style={{ color, fontFamily: MONO }}>{HOP_LABEL[forwarder]}</div>
        <div className="relative text-[8.5px] mt-0.5 opacity-70" style={{ color: SLATE, fontFamily: MONO }}>{HOP_PAYLOAD_BYTES[forwarder]} B</div>
      </SlotSubCell>
      <SlotSubCell section="hmac" style={{ width: 46, flexShrink: 0, background: fill, borderLeft: `1px dashed ${color}90`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="text-[7.5px] uppercase tracking-[0.04em]" style={{ color: SLATE, fontFamily: MONO }}>HMAC</div>
        <div className="text-[8.5px] font-bold" style={{ color: NEXT_HOP_COLOR[forwarder], fontFamily: MONO }}>{NEXT_HOP_LABEL[forwarder]}</div>
      </SlotSubCell>
      <div className="absolute inset-0 pointer-events-none"><HatchOverlay hops={layers} zIndex={0} stripeOpacity={0.1} /></div>
    </div>
  );
}

function PaddingRegion({ layers, grow, dim }: { layers: ForwarderId[]; grow: number; dim: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ flexGrow: grow, flexBasis: 0, minWidth: 58, opacity: dim ? 0.3 : 1, transition: "opacity 300ms, flex-grow 450ms ease-in-out", overflow: "hidden" }}>
      {layers.length > 0 && <HatchOverlay hops={layers} zIndex={0} stripeOpacity={0.1} />}
      <span className="relative" style={{ fontSize: 9, fontFamily: MONO, color: SLATE, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", background: "rgba(255,253,245,0.85)", padding: "0 4px" }}>padding</span>
    </div>
  );
}

function GapFillRegion({ kind, verdict, focus }: { kind: GapFill; verdict?: "pass" | "fail"; focus: boolean }) {
  const verdictColor = verdict === "pass" ? SUCCESS_GREEN : ERROR_RED;
  const outline = focus ? verdictColor : INK;
  return (
    // The gap-fill block appears at the peel step (it's the new bytes Bob added
    // at the back). Animate it open from width 0 instead of popping in, so the
    // peel reads as "the back opens up and gets filled". flexGrow + opacity are
    // owned by framer-motion; the focus-state border/background still ease via
    // the CSS transition below.
    <MorphBox className="relative flex flex-col items-center justify-center text-center"
      initial={{ flexGrow: 0, opacity: 0 }}
      animate={{ flexGrow: 1.5, opacity: 1 }}
      transition={MORPH_TRANSITION}
      style={{ flexBasis: 0, minWidth: 74, borderLeft: `1.5px ${focus ? "solid" : "dashed"} ${outline}`,
        boxShadow: focus ? `inset 0 0 0 1.5px ${outline}` : undefined,
        background: kind === "filler" ? "#fef3c7" : "#e7ebf0", transition: "border-color 300ms ease-in-out, box-shadow 300ms ease-in-out, background-color 300ms ease-in-out", overflow: "hidden", padding: "0 2px" }}>
      <div className="text-[7px] font-bold uppercase leading-tight" style={{ color: focus ? verdictColor : SLATE, fontFamily: MONO, letterSpacing: "0.03em" }}>
        Bob's fill · 60 B
      </div>
      {kind === "zeros" && <div style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE, fontWeight: 700, lineHeight: 1.25, marginTop: 2 }}>0x00<br />0x00</div>}
      {kind === "random" && <div style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE, fontWeight: 700, lineHeight: 1.25, marginTop: 2 }}>4f a3<br />c7 19</div>}
      {kind === "filler" && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(135deg, #b8860bA0 0px, #b8860bA0 3px, transparent 3px, transparent 8px), repeating-linear-gradient(45deg, ${HOP_KEY_COLORS.charlie}A0 0px, ${HOP_KEY_COLORS.charlie}A0 3px, transparent 3px, transparent 8px)`, opacity: 0.4 }} />
          <div className="relative" style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: INK, marginTop: 2 }}>FILLER</div>
        </>
      )}
    </MorphBox>
  );
}

// ── Compare panel (hover) ────────────────────────────────────────────────────
function ComparePanel({ gapFill, pass }: { gapFill: GapFill; pass: boolean }) {
  const col = pass ? SUCCESS_GREEN : ERROR_RED;
  return (
    <div className="mt-3 border-[1.5px] p-2.5" style={{ borderColor: col, background: pass ? "#f1f7ea" : "#fdebeb" }}>
      <div className="text-[10px] font-bold uppercase mb-2" style={{ color: INK, fontFamily: MONO, letterSpacing: "0.04em" }}>
        charlie_hmac: what Alice computed it over vs what arrived
      </div>
      <CompareRow label="Alice computed it over" lastKind="filler" differ={false} />
      <CompareRow label="Charlie's packet has" lastKind={gapFill} differ={!pass} />
      <div className="text-[10.5px] mt-2 font-bold leading-snug" style={{ color: col, fontFamily: MONO }}>
        {pass
          ? "✓ the last 60 bytes are the exact filler Alice committed to → HMAC verifies"
          : "✗ the last 60 bytes are not that filler → invalid_onion_hmac, packet dropped"}
      </div>
    </div>
  );
}

function CompareRow({ label, lastKind, differ }: { label: string; lastKind: GapFill; differ: boolean }) {
  const blocks = [
    { t: "Charlie", c: HOP_KEY_COLORS.charlie },
    { t: "Dave", c: HOP_KEY_COLORS.dave },
    { t: "padding", c: SLATE },
  ];
  const lastLabel = lastKind === "filler" ? "FILLER" : lastKind === "zeros" ? "0x00…" : "random";
  const lastBg = lastKind === "filler" ? "#fef3c7" : differ ? "#fbd5d5" : "#e7ebf0";
  const lastColor = differ ? ERROR_RED : lastKind === "filler" ? "#b8860b" : SLATE;
  const lastRing = differ ? ERROR_RED : lastKind === "filler" ? "#b8860b" : "transparent";
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[9px] shrink-0" style={{ color: SLATE, fontFamily: MONO, width: 132, textAlign: "right" }}>{label}:</span>
      <div className="flex" style={{ height: 18, border: `1px solid ${INK}` }}>
        {blocks.map((b) => (
          <div key={b.t} className="flex items-center justify-center" style={{ padding: "0 5px", background: `${b.c}22`, borderRight: `1px solid ${INK}55`, color: b.c, fontWeight: 700, fontFamily: MONO, fontSize: 7.5 }}>{b.t}</div>
        ))}
        <div className="flex items-center justify-center" style={{ padding: "0 6px", background: lastBg, color: lastColor, fontWeight: 700, fontFamily: MONO, fontSize: 7.5, boxShadow: `inset 0 0 0 1.5px ${lastRing}` }}>{lastLabel}</div>
      </div>
    </div>
  );
}

export default PaddingStrategyDiagram;
