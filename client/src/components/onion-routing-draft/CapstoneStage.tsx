import { type CSSProperties } from "react";
import { HatchOverlay, singleHatchBackground, LAYER_COLORS, type ForwarderId } from "./encryptionHatch";
import { SlotSubCell } from "./SlotSubCell";
import type { HopId } from "../../lib/onion-capstone-trace";
import type { BufferSegment, Scene, StageState } from "../../lib/onion-capstone-scenes";

// ────────────────────────────────────────────────────────────────────────────
// CapstoneStage - the capstone lab's visual stage.
//
// Renders one Scene (from onion-capstone-scenes.ts) in the chapter 7-10
// diagram grammar: the 1,300-byte buffer bar with hop-payload subcells
// (LEN | TLV | HMAC via SlotSubCell), encryption hatches at the locked angles
// (HatchOverlay), keystream bars, the 1,366-byte packet strip, the blinding
// chain, the policy card, and the delivery beat. The route strip on top
// doubles as navigation: each hop's function chips jump the debugger.
//
// Theme-aware: every color reads from a palette keyed on `dark` (driven by the
// app theme, not OS preference), so the stage matches the page and reads cleanly
// inside the fullscreen overlay in both light and dark mode.
// ────────────────────────────────────────────────────────────────────────────

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = '"JetBrains Mono", "Fira Code", monospace';

// Light hop colors are the canonical palette (exported for the scrubber etc.).
export const HOP_FILL: Record<HopId, string> = { alice: "#fef3c7", bob: "#dbeafe", charlie: "#ccece8", dave: "#ede1f3" };
export const HOP_STROKE: Record<HopId, string> = { alice: "#b8860b", bob: "#3b6aa0", charlie: "#2d7a7a", dave: "#7b4b8a" };
const HOP_LABEL: Record<HopId, string> = { alice: "Alice", bob: "Bob", charlie: "Charlie", dave: "Dave" };
const ROUTE: HopId[] = ["alice", "bob", "charlie", "dave"];

// ── theme palette ────────────────────────────────────────────────────────────
export interface StagePalette {
  text: string; muted: string; cardBg: string; line: string; softBorder: string;
  soft: string; padBg: string; padDot: string; fillerBg: string;
  litBg: string; litText: string; litSub: string; litBorder: string; gold: string;
  good: string; bad: string; wire: string; trackOff: string; onAccent: string;
  hopStroke: Record<HopId, string>; hopFill: Record<HopId, string>;
}
const LIGHT_PAL: StagePalette = {
  text: "#0f172a", muted: "#475569", cardBg: "#fffdf5", line: "#0f172a", softBorder: "#cbd5e1",
  soft: "#eef1f5", padBg: "#f1efe8", padDot: "#b4b2a9", fillerBg: "#fdf6e3",
  litBg: "#fef3c7", litText: "#0f172a", litSub: "#7a5a08", litBorder: "#b8860b", gold: "#b8860b",
  good: "#2d7a7a", bad: "#a13a3a", wire: "#475569", trackOff: "#cbd5e1", onAccent: "#ffffff",
  hopStroke: HOP_STROKE, hopFill: HOP_FILL,
};
const DARK_PAL: StagePalette = {
  text: "#e2e8f0", muted: "#94a3b8", cardBg: "#0f1b30", line: "#33425c", softBorder: "#33425c",
  soft: "#16233b", padBg: "#15213a", padDot: "#3a4a63", fillerBg: "#2a2614",
  litBg: "#3a2f12", litText: "#f5e6c0", litSub: "#d4b878", litBorder: "#d4a017", gold: "#e0b53a",
  good: "#3fb6a8", bad: "#e06b6b", wire: "#64748b", trackOff: "#3a4a63", onAccent: "#0b1220",
  hopStroke: { alice: "#e0b53a", bob: "#6ea8e0", charlie: "#56c0b6", dave: "#b594d6" },
  hopFill: { alice: "#2a2410", bob: "#14253c", charlie: "#103029", dave: "#221833" },
};
export const palette = (dark: boolean): StagePalette => (dark ? DARK_PAL : LIGHT_PAL);

// Hop-payload subcell facts: byte count, BigSize LEN prefix (size-33), and the
// HMAC target ("for <NextHop>"; the destination's HMAC is "none").
const HOP_BYTES: Record<ForwarderId, number> = { bob: 59, charlie: 59, dave: 83 };
const HOP_LEN_HEX: Record<ForwarderId, string> = { bob: "0x1A", charlie: "0x1A", dave: "0x32" };
const HOP_HMAC_TARGET: Record<ForwarderId, string> = { bob: "for Charlie", charlie: "for Dave", dave: "none" };
const NODE_X_PCT: Record<HopId, number> = { alice: 12, bob: 38, charlie: 62, dave: 88 };

export interface StageChip {
  hop: HopId;
  fn: string;
  short: string;
  target?: number;
  active: boolean;
}

// ── route strip with merged function chips ──────────────────────────────────

function RouteStrip({ stage, chips, onJump, dark }: { stage: StageState; chips: StageChip[]; onJump: (target: number) => void; dark: boolean }) {
  const P = palette(dark);
  const at = stage.transitTo ?? stage.packetAt;
  const activeIdx = ROUTE.indexOf(at);
  return (
    <div style={{ position: "relative", height: 96 }}>
      <div style={{ position: "absolute", top: 17, left: `${NODE_X_PCT.alice}%`, right: `${100 - NODE_X_PCT.dave}%`, borderTop: `1.5px dashed ${P.wire}`, zIndex: 0 }} />
      {/* packet glyph slides along the dashed wire as the scene moves it */}
      <div
        style={{
          position: "absolute", top: 10, left: `${NODE_X_PCT[at]}%`, transform: "translateX(-50%)",
          width: 15, height: 15, background: P.litBg, border: `2px solid ${P.litBorder}`, borderRadius: 3,
          zIndex: 1, transition: "left 600ms ease",
        }}
        aria-hidden
      />
      {ROUTE.map((hop) => {
        const active = hop === at;
        const reached = ROUTE.indexOf(hop) <= activeIdx;
        const hopChips = chips.filter((c) => c.hop === hop);
        return (
          <div key={hop} style={{ position: "absolute", left: `${NODE_X_PCT[hop]}%`, top: 0, transform: "translateX(-50%)", width: "24%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, zIndex: 2 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: reached ? P.hopFill[hop] : P.soft, border: `${active ? 3 : 2}px solid ${reached ? P.hopStroke[hop] : P.softBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 13, color: reached ? P.hopStroke[hop] : P.muted, boxShadow: active ? `0 0 0 4px ${P.hopStroke[hop]}22` : "none", transition: "all 0.3s" }}>{HOP_LABEL[hop][0]}</div>
            <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? P.hopStroke[hop] : P.muted }}>{HOP_LABEL[hop]}</span>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 3 }}>
              {hopChips.map((c) => (
                <button
                  key={c.fn}
                  disabled={c.target === undefined}
                  onClick={() => c.target !== undefined && onJump(c.target)}
                  title={c.target === undefined ? "" : `Jump to ${c.fn}()`}
                  style={{
                    fontFamily: MONO, fontSize: 9.5, padding: "1.5px 5px", borderRadius: 3,
                    cursor: c.target === undefined ? "default" : "pointer",
                    color: c.active ? P.onAccent : P.text,
                    background: c.active ? P.hopStroke[hop] : P.cardBg,
                    border: `1px solid ${c.active ? P.hopStroke[hop] : P.hopStroke[hop] + "55"}`,
                    opacity: c.target === undefined ? 0.45 : 1,
                  }}
                >{c.short}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── buffer bar (chapter 7/8/9 grammar) ──────────────────────────────────────

const segBase = (P: StagePalette): Record<BufferSegment["kind"], CSSProperties> => ({
  payload: {},
  pad: { background: P.padBg, backgroundImage: `radial-gradient(${P.padDot} 0.8px, transparent 0.8px)`, backgroundSize: "7px 7px" },
  filler: { background: P.fillerBg },
  ext: { background: "transparent" },
});

function SegmentBody({ seg, dark }: { seg: BufferSegment; dark: boolean }) {
  const P = palette(dark);
  const showSubcells = seg.kind === "payload" && seg.hop && (seg.plaintext || seg.emphasis);
  if (showSubcells) {
    const hop = seg.hop as ForwarderId;
    const c = P.hopStroke[hop];
    const lenHex = HOP_LEN_HEX[hop];
    const payloadLabel = `${HOP_LABEL[hop]} · ${HOP_BYTES[hop]} B`;
    const hmacLabel = HOP_HMAC_TARGET[hop];
    return (
      <div style={{ display: "flex", height: "100%", position: "relative", zIndex: 2 }}>
        <SlotSubCell section="len" style={{ flex: "0 0 22%", borderRight: `1px dashed ${c}88`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 8.5, color: c }}>{lenHex}</SlotSubCell>
        <SlotSubCell section="tlv" style={{ flex: 1, borderRight: `1px dashed ${c}88`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 8.5, color: c, overflow: "hidden" }}>{payloadLabel}</SlotSubCell>
        <SlotSubCell section="hmac" style={{ flex: "0 0 30%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 8.5, color: c, overflow: "hidden" }}>{hmacLabel}</SlotSubCell>
      </div>
    );
  }
  const label = seg.kind === "payload" && seg.hop ? HOP_LABEL[seg.hop] : seg.kind === "pad" ? "pad noise" : seg.kind === "filler" ? "filler" : seg.byteLabel;
  const color = seg.kind === "payload" && seg.hop ? P.hopStroke[seg.hop] : P.muted;
  return (
    <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9.5, color, whiteSpace: "nowrap", overflow: "hidden" }}>
      {label}
    </div>
  );
}

function BufferBar({ segments, dark }: { segments: BufferSegment[]; dark: boolean }) {
  const P = palette(dark);
  const base = segBase(P);
  return (
    <div>
      <div style={{ display: "flex", height: 46, border: `1.5px solid ${P.line}`, overflow: "hidden", background: P.cardBg }}>
        {segments.map((seg, i) => (
          <div
            key={seg.key}
            style={{
              flexGrow: seg.widthPct, flexBasis: 0, position: "relative", minWidth: 0,
              borderRight: i < segments.length - 1 ? `1.5px solid ${P.line}` : "none",
              background: seg.kind === "payload" && seg.hop ? P.hopFill[seg.hop] : undefined,
              outline: seg.emphasis ? `2px solid ${P.gold}` : "none",
              outlineOffset: -2,
              transition: "flex-grow 500ms ease",
              ...base[seg.kind],
              ...(seg.kind === "ext" ? { borderLeft: `1.5px dashed ${P.wire}`, marginLeft: -1.5 } : {}),
            }}
          >
            <SegmentBody seg={seg} dark={dark} />
            {seg.layers.length > 0 && <HatchOverlay hops={seg.layers} zIndex={3} stripeOpacity={0.45} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 2 }}>
        {segments.map((seg) => (
          <div key={seg.key} style={{ flexGrow: seg.widthPct, flexBasis: 0, minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 8.5, color: P.muted, whiteSpace: "nowrap", overflow: "hidden", transition: "flex-grow 500ms ease" }}>
            {seg.byteLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeystreamBar({ ks, dark }: { ks: NonNullable<StageState["keystream"]>; dark: boolean }) {
  const P = palette(dark);
  const color = ks.hop ? (dark ? P.hopStroke[ks.hop] : LAYER_COLORS[ks.hop]) : P.gold;
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ marginBottom: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color }}>{ks.label} · {ks.bytes.toLocaleString("en-US")} B{ks.note ? ` (${ks.note})` : ""}</span>
      </div>
      <div style={{ height: 10, border: `1px solid ${color}`, borderRadius: 2, backgroundImage: ks.hop ? singleHatchBackground(ks.hop) : undefined, backgroundColor: ks.hop ? undefined : P.litBg, opacity: 0.85 }} />
      {/* the operation between the keystream (above) and the buffer (below) is a
          bytewise XOR; show the operator itself rather than ambiguous arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 1, color }} title="bytewise XOR onto the buffer below">
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: "14px" }}>⊕</span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em" }}>XOR</span>
      </div>
    </div>
  );
}

// ── packet strip (1,366-byte wire view) ─────────────────────────────────────

function PacketStrip({ stage, dark }: { stage: StageState; dark: boolean }) {
  const P = palette(dark);
  const fields: Array<{ key: "version" | "ephemeral" | "hop_payloads" | "hmac"; label: string; flex: number }> = [
    { key: "version", label: "v0", flex: 0.7 },
    { key: "ephemeral", label: `${stage.ephemeralLabel ?? "ephemeral"} · 33 B`, flex: 2.4 },
    { key: "hop_payloads", label: "hop_payloads · 1,300 B", flex: 7 },
    { key: "hmac", label: `${stage.outerHmacLabel ?? "hmac"} · 32 B`, flex: 2.4 },
  ];
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: P.muted, marginBottom: 3 }}>1,366-byte packet</div>
      <div style={{ display: "flex", gap: 3 }}>
        {fields.map((f) => {
          const lit = stage.byteField === "all" || stage.byteField === f.key;
          return (
            <div key={f.key} style={{ flex: f.flex, textAlign: "center", fontFamily: MONO, fontSize: 10, padding: "12px 3px", color: lit ? P.litText : P.muted, background: lit ? P.litBg : P.soft, border: `1.5px solid ${lit ? P.litBorder : P.softBorder}`, borderRadius: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.3s" }}>
              {f.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── chain view (chapter 4 grammar, compact) ─────────────────────────────────

function ChainView({ chain, dark }: { chain: NonNullable<StageState["chain"]>; dark: boolean }) {
  const P = palette(dark);
  const E: Record<ForwarderId, string> = { bob: "E_AB", charlie: "E_AC", dave: "E_AD" };
  const SS: Record<ForwarderId, string> = { bob: "ss_AB", charlie: "ss_AC", dave: "ss_AD" };
  return (
    <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 8, padding: "10px 0" }}>
      {chain.map((c, i) => {
        const stroke = c.state === "todo" ? P.softBorder : P.hopStroke[c.hop];
        return (
          <div key={c.hop} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ border: `${c.state === "active" ? 2.5 : 1.5}px ${c.state === "todo" ? "dashed" : "solid"} ${stroke}`, background: c.state === "todo" ? "transparent" : P.hopFill[c.hop], borderRadius: 5, padding: "8px 12px", minWidth: 116, textAlign: "center", boxShadow: c.state === "active" ? `0 0 0 4px ${stroke}22` : "none", transition: "all 0.3s" }}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: c.state === "todo" ? P.muted : stroke }}>{HOP_LABEL[c.hop]}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: c.state === "todo" ? P.muted : P.text, marginTop: 2 }}>{E[c.hop]} → {SS[c.hop]}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: c.state === "done" ? P.good : P.muted, marginTop: 2 }}>{c.state === "done" ? "✓ derived" : c.state === "active" ? "ECDH…" : "waiting"}</div>
            </div>
            {i < chain.length - 1 && <span style={{ fontFamily: MONO, fontSize: 10, color: P.muted }}>· bf →</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── policy + deliver views (chapter 10 / chapter 2 grammar) ─────────────────

function PolicyCard({ p, dark }: { p: NonNullable<StageState["policy"]>; dark: boolean }) {
  const P = palette(dark);
  const stroke = P.hopStroke[p.hop];
  const fmt = (n: number) => n.toLocaleString("en-US");
  const feeMargin = p.incomingAmt - p.amt;
  const cltvGap = p.incomingCltv - p.cltv;
  const row: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, fontFamily: MONO, fontSize: 11.5, color: P.text, padding: "5px 0" };
  return (
    <div style={{ border: `1.5px solid ${stroke}`, background: P.hopFill[p.hop] + "55", borderRadius: 5, padding: "10px 14px", maxWidth: 560, margin: "8px auto" }}>
      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: stroke, marginBottom: 4 }}>
        {HOP_LABEL[p.hop]}'s forwarding checks
      </div>
      <div style={row}>
        <span style={{ color: P.muted, width: 36 }}>fee</span>
        <span>{fmt(p.incomingAmt)} − {fmt(p.amt)} = {fmt(feeMargin)} ≥ {fmt(p.requiredFee)} sats</span>
        <span style={{ color: P.good, marginLeft: "auto", fontWeight: 700 }}>✓</span>
      </div>
      <div style={{ ...row, borderTop: `1px solid ${stroke}33` }}>
        <span style={{ color: P.muted, width: 36 }}>cltv</span>
        <span>{fmt(p.incomingCltv)} − {fmt(p.cltv)} = {cltvGap} ≥ {p.delta} blocks</span>
        <span style={{ color: P.good, marginLeft: "auto", fontWeight: 700 }}>✓</span>
      </div>
    </div>
  );
}

function DeliverView({ amt, dark }: { amt: number; dark: boolean }) {
  const P = palette(dark);
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, border: `2px solid ${P.litBorder}`, background: P.litBg, borderRadius: 6, padding: "12px 22px" }}>
        <span style={{ fontSize: 20, color: P.good, fontWeight: 700 }}>✓</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: P.litText }}>Payment delivered</div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: P.litSub }}>{amt.toLocaleString("en-US")} sats received by Dave</div>
        </div>
      </div>
    </div>
  );
}

// ── HMAC chip ────────────────────────────────────────────────────────────────

function HmacChip({ chip, dark }: { chip: NonNullable<StageState["hmac"]>; dark: boolean }) {
  const P = palette(dark);
  const color = chip.state === "fail" ? P.bad : chip.state === "ok" ? P.good : P.gold;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color, border: `1.5px solid ${color}`, borderRadius: 3, padding: "2px 8px", background: P.cardBg }}>
        {chip.state === "ok" ? "✓ " : chip.state === "fail" ? "✗ " : "⏳ "}{chip.label}
      </span>
    </div>
  );
}

// ── stage ────────────────────────────────────────────────────────────────────

export interface CapstoneStageProps {
  scene: Scene;
  sceneIdx: number;
  sceneCount: number;
  chips: StageChip[];
  onJump: (target: number) => void;
  dark?: boolean;
}

export function CapstoneStage({ scene, sceneIdx, sceneCount, chips, onJump, dark = false }: CapstoneStageProps) {
  const P = palette(dark);
  const st = scene.stage;
  return (
    <div data-testid="capstone-stage">
      <RouteStrip stage={st} chips={chips} onJump={onJump} dark={dark} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "6px 0 6px" }}>
        <span style={{ fontFamily: SANS, fontSize: 11, color: P.muted }}>
          Scene {sceneIdx + 1} of {sceneCount} · <span style={{ fontWeight: 700, color: P.text }}>{scene.title}</span>
        </span>
        {st.bufferLabel && <span style={{ fontFamily: MONO, fontSize: 9.5, color: P.muted }}>{st.bufferLabel}</span>}
      </div>
      <div style={{ minHeight: 122, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {st.view === "chain" && st.chain && <ChainView chain={st.chain} dark={dark} />}
        {st.view === "buffer" && (
          <div>
            {st.keystream && <KeystreamBar ks={st.keystream} dark={dark} />}
            {st.segments && <BufferBar segments={st.segments} dark={dark} />}
            {st.hmac && <HmacChip chip={st.hmac} dark={dark} />}
          </div>
        )}
        {st.view === "packet" && (
          <div style={{ paddingTop: 8 }}>
            <PacketStrip stage={st} dark={dark} />
            {st.hmac && <HmacChip chip={st.hmac} dark={dark} />}
          </div>
        )}
        {st.view === "policy" && st.policy && <PolicyCard p={st.policy} dark={dark} />}
        {st.view === "deliver" && <DeliverView amt={st.deliverAmt ?? 0} dark={dark} />}
      </div>
      <p style={{ fontFamily: SANS, fontSize: 12, fontStyle: "italic", color: P.muted, margin: "8px 0 0", minHeight: 30 }}>
        {scene.caption}
      </p>
    </div>
  );
}

export default CapstoneStage;
