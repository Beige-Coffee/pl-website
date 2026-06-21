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
// ────────────────────────────────────────────────────────────────────────────

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = '"JetBrains Mono", "Fira Code", monospace';
const INK = "#0f172a";
const SLATE = "#475569";

export const HOP_FILL: Record<HopId, string> = { alice: "#fef3c7", bob: "#dbeafe", charlie: "#ccece8", dave: "#ede1f3" };
export const HOP_STROKE: Record<HopId, string> = { alice: "#b8860b", bob: "#3b6aa0", charlie: "#2d7a7a", dave: "#7b4b8a" };
const HOP_LABEL: Record<HopId, string> = { alice: "Alice", bob: "Bob", charlie: "Charlie", dave: "Dave" };
const ROUTE: HopId[] = ["alice", "bob", "charlie", "dave"];
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

function RouteStrip({ stage, chips, onJump }: { stage: StageState; chips: StageChip[]; onJump: (target: number) => void }) {
  const at = stage.transitTo ?? stage.packetAt;
  const activeIdx = ROUTE.indexOf(at);
  return (
    <div style={{ position: "relative", height: 96 }}>
      <div style={{ position: "absolute", top: 17, left: `${NODE_X_PCT.alice}%`, right: `${100 - NODE_X_PCT.dave}%`, borderTop: `1.5px dashed ${SLATE}`, zIndex: 0 }} />
      {/* packet glyph slides along the dashed wire as the scene moves it */}
      <div
        style={{
          position: "absolute", top: 10, left: `${NODE_X_PCT[at]}%`, transform: "translateX(-50%)",
          width: 15, height: 15, background: "#fef3c7", border: "2px solid #b8860b", borderRadius: 3,
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
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: reached ? HOP_FILL[hop] : "#eef1f5", border: `${active ? 3 : 2}px solid ${reached ? HOP_STROKE[hop] : "#cbd5e1"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 13, color: reached ? HOP_STROKE[hop] : "#94a3b8", boxShadow: active ? `0 0 0 4px ${HOP_STROKE[hop]}22` : "none", transition: "all 0.3s" }}>{HOP_LABEL[hop][0]}</div>
            <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? HOP_STROKE[hop] : SLATE }}>{HOP_LABEL[hop]}</span>
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
                    color: c.active ? "#fff" : INK,
                    background: c.active ? HOP_STROKE[hop] : "#fffdf5",
                    border: `1px solid ${c.active ? HOP_STROKE[hop] : HOP_STROKE[hop] + "55"}`,
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

const SEG_BASE: Record<BufferSegment["kind"], CSSProperties> = {
  payload: {},
  pad: { background: "#f1efe8", backgroundImage: "radial-gradient(#b4b2a9 0.8px, transparent 0.8px)", backgroundSize: "7px 7px" },
  filler: { background: "#fdf6e3" },
  ext: { background: "transparent" },
};

function SegmentBody({ seg }: { seg: BufferSegment }) {
  const showSubcells = seg.kind === "payload" && seg.hop && (seg.plaintext || seg.emphasis);
  if (showSubcells) {
    const hop = seg.hop as ForwarderId;
    const c = HOP_STROKE[hop];
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
  const color = seg.kind === "payload" && seg.hop ? HOP_STROKE[seg.hop] : "#888780";
  return (
    <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9.5, color, whiteSpace: "nowrap", overflow: "hidden" }}>
      {label}
    </div>
  );
}

function BufferBar({ segments }: { segments: BufferSegment[] }) {
  return (
    <div>
      <div style={{ display: "flex", height: 46, border: `1.5px solid ${INK}`, overflow: "hidden", background: "#fffdf5" }}>
        {segments.map((seg, i) => (
          <div
            key={seg.key}
            style={{
              flexGrow: seg.widthPct, flexBasis: 0, position: "relative", minWidth: 0,
              borderRight: i < segments.length - 1 ? `1.5px solid ${INK}` : "none",
              background: seg.kind === "payload" && seg.hop ? HOP_FILL[seg.hop] : undefined,
              outline: seg.emphasis ? "2px solid #b8860b" : "none",
              outlineOffset: -2,
              transition: "flex-grow 500ms ease",
              ...SEG_BASE[seg.kind],
              ...(seg.kind === "ext" ? { borderLeft: `1.5px dashed ${SLATE}`, marginLeft: -1.5 } : {}),
            }}
          >
            <SegmentBody seg={seg} />
            {seg.layers.length > 0 && <HatchOverlay hops={seg.layers} zIndex={3} stripeOpacity={0.45} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 2 }}>
        {segments.map((seg) => (
          <div key={seg.key} style={{ flexGrow: seg.widthPct, flexBasis: 0, minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 8.5, color: SLATE, whiteSpace: "nowrap", overflow: "hidden", transition: "flex-grow 500ms ease" }}>
            {seg.byteLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeystreamBar({ ks }: { ks: NonNullable<StageState["keystream"]> }) {
  const color = ks.hop ? LAYER_COLORS[ks.hop] : "#b8860b";
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color }}>{ks.label} · {ks.bytes.toLocaleString("en-US")} B{ks.note ? ` (${ks.note})` : ""}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color }}>⊕ XOR</span>
      </div>
      <div style={{ height: 10, border: `1px solid ${color}`, borderRadius: 2, backgroundImage: ks.hop ? singleHatchBackground(ks.hop) : undefined, backgroundColor: ks.hop ? undefined : "#fef3c7", opacity: 0.85 }} />
      <div style={{ textAlign: "center", fontSize: 9, color, lineHeight: "10px", marginTop: 1 }}>↓&nbsp;&nbsp;↓&nbsp;&nbsp;↓</div>
    </div>
  );
}

// ── packet strip (1,366-byte wire view) ─────────────────────────────────────

function PacketStrip({ stage }: { stage: StageState }) {
  const fields: Array<{ key: "version" | "ephemeral" | "hop_payloads" | "hmac"; label: string; flex: number }> = [
    { key: "version", label: "v0", flex: 0.7 },
    { key: "ephemeral", label: `${stage.ephemeralLabel ?? "ephemeral"} · 33 B`, flex: 2.4 },
    { key: "hop_payloads", label: "hop_payloads · 1,300 B", flex: 7 },
    { key: "hmac", label: `${stage.outerHmacLabel ?? "hmac"} · 32 B`, flex: 2.4 },
  ];
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: SLATE, marginBottom: 3 }}>1,366-byte packet</div>
      <div style={{ display: "flex", gap: 3 }}>
        {fields.map((f) => {
          const lit = stage.byteField === "all" || stage.byteField === f.key;
          return (
            <div key={f.key} style={{ flex: f.flex, textAlign: "center", fontFamily: MONO, fontSize: 10, padding: "12px 3px", color: lit ? INK : SLATE, background: lit ? "#fef3c7" : "#eef1f5", border: `1.5px solid ${lit ? "#b8860b" : "#cbd5e1"}`, borderRadius: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.3s" }}>
              {f.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── chain view (chapter 4 grammar, compact) ─────────────────────────────────

function ChainView({ chain }: { chain: NonNullable<StageState["chain"]> }) {
  const E: Record<ForwarderId, string> = { bob: "E_AB", charlie: "E_AC", dave: "E_AD" };
  const SS: Record<ForwarderId, string> = { bob: "ss_AB", charlie: "ss_AC", dave: "ss_AD" };
  return (
    <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 8, padding: "10px 0" }}>
      {chain.map((c, i) => {
        const stroke = c.state === "todo" ? "#cbd5e1" : HOP_STROKE[c.hop];
        return (
          <div key={c.hop} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ border: `${c.state === "active" ? 2.5 : 1.5}px ${c.state === "todo" ? "dashed" : "solid"} ${stroke}`, background: c.state === "todo" ? "transparent" : HOP_FILL[c.hop], borderRadius: 5, padding: "8px 12px", minWidth: 116, textAlign: "center", boxShadow: c.state === "active" ? `0 0 0 4px ${stroke}22` : "none", transition: "all 0.3s" }}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: c.state === "todo" ? "#94a3b8" : stroke }}>{HOP_LABEL[c.hop]}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: c.state === "todo" ? "#94a3b8" : INK, marginTop: 2 }}>{E[c.hop]} → {SS[c.hop]}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: c.state === "done" ? "#2d7a7a" : SLATE, marginTop: 2 }}>{c.state === "done" ? "✓ derived" : c.state === "active" ? "ECDH…" : "waiting"}</div>
            </div>
            {i < chain.length - 1 && <span style={{ fontFamily: MONO, fontSize: 10, color: SLATE }}>· bf →</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── policy + deliver views (chapter 10 / chapter 2 grammar) ─────────────────

function PolicyCard({ p }: { p: NonNullable<StageState["policy"]> }) {
  const stroke = HOP_STROKE[p.hop];
  const fmt = (n: number) => n.toLocaleString("en-US");
  const feeMargin = p.incomingAmt - p.amt;
  const cltvGap = p.incomingCltv - p.cltv;
  const row: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, fontFamily: MONO, fontSize: 11.5, color: INK, padding: "5px 0" };
  return (
    <div style={{ border: `1.5px solid ${stroke}`, background: HOP_FILL[p.hop] + "55", borderRadius: 5, padding: "10px 14px", maxWidth: 560, margin: "8px auto" }}>
      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: stroke, marginBottom: 4 }}>
        {HOP_LABEL[p.hop]}'s forwarding checks
      </div>
      <div style={row}>
        <span style={{ color: SLATE, width: 36 }}>fee</span>
        <span>{fmt(p.incomingAmt)} − {fmt(p.amt)} = {fmt(feeMargin)} ≥ {fmt(p.requiredFee)} sats</span>
        <span style={{ color: "#2d7a7a", marginLeft: "auto", fontWeight: 700 }}>✓</span>
      </div>
      <div style={{ ...row, borderTop: `1px solid ${stroke}33` }}>
        <span style={{ color: SLATE, width: 36 }}>cltv</span>
        <span>{fmt(p.incomingCltv)} − {fmt(p.cltv)} = {cltvGap} ≥ {p.delta} blocks</span>
        <span style={{ color: "#2d7a7a", marginLeft: "auto", fontWeight: 700 }}>✓</span>
      </div>
    </div>
  );
}

function DeliverView({ amt }: { amt: number }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, border: "2px solid #b8860b", background: "#fef3c7", borderRadius: 6, padding: "12px 22px" }}>
        <span style={{ fontSize: 20, color: "#2d7a7a", fontWeight: 700 }}>✓</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: INK }}>Payment delivered</div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: "#7a5a08" }}>{amt.toLocaleString("en-US")} sats received by Dave</div>
        </div>
      </div>
    </div>
  );
}

// ── HMAC chip ────────────────────────────────────────────────────────────────

function HmacChip({ chip }: { chip: NonNullable<StageState["hmac"]> }) {
  const color = chip.state === "fail" ? "#a13a3a" : chip.state === "ok" ? "#2d7a7a" : "#b8860b";
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color, border: `1.5px solid ${color}`, borderRadius: 3, padding: "2px 8px", background: "#fffdf5" }}>
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
}

export function CapstoneStage({ scene, sceneIdx, sceneCount, chips, onJump }: CapstoneStageProps) {
  const st = scene.stage;
  return (
    <div data-testid="capstone-stage">
      <RouteStrip stage={st} chips={chips} onJump={onJump} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "6px 0 6px" }}>
        <span style={{ fontFamily: SANS, fontSize: 11, color: SLATE }}>
          Scene {sceneIdx + 1} of {sceneCount} · <span style={{ fontWeight: 700, color: INK }}>{scene.title}</span>
        </span>
        {st.bufferLabel && <span style={{ fontFamily: MONO, fontSize: 9.5, color: SLATE }}>{st.bufferLabel}</span>}
      </div>
      <div style={{ minHeight: 122 }}>
        {st.view === "chain" && st.chain && <ChainView chain={st.chain} />}
        {st.view === "buffer" && (
          <div>
            {st.keystream && <KeystreamBar ks={st.keystream} />}
            {st.segments && <BufferBar segments={st.segments} />}
            {st.hmac && <HmacChip chip={st.hmac} />}
          </div>
        )}
        {st.view === "packet" && (
          <div style={{ paddingTop: 8 }}>
            <PacketStrip stage={st} />
            {st.hmac && <HmacChip chip={st.hmac} />}
          </div>
        )}
        {st.view === "policy" && st.policy && <PolicyCard p={st.policy} />}
        {st.view === "deliver" && <DeliverView amt={st.deliverAmt ?? 0} />}
      </div>
      <p style={{ fontFamily: SANS, fontSize: 12, fontStyle: "italic", color: "#55554f", margin: "8px 0 0", minHeight: 30 }}>
        {scene.caption}
      </p>
    </div>
  );
}

export default CapstoneStage;
