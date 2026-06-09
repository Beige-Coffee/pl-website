import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  runOnionCapstone,
  runOnionCapstoneDemo,
  type PreflightResult,
  type SavedGetter,
} from "../../lib/onion-capstone-orchestrator";
import {
  CAPSTONE_FILES,
  type CapstoneTraceResult,
  type CapstoneTraceStep,
  type HopId,
  type SerializedValue,
} from "../../lib/onion-capstone-trace";
import { HatchOverlay, type ForwarderId } from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// OnionCapstoneLab — synced step-through capstone.
//
// One `frames` timeline drives the layered-onion hero, a syntax-highlighted
// code pane, and a Locals/Globals variables tree. Compact two-column layout
// (hero + phase chips | code + variables) fits a laptop without scrolling.
// Debugger-style controls: step into / over / out (via call depth). No autoplay.
// ────────────────────────────────────────────────────────────────────────────

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = '"JetBrains Mono", "Fira Code", monospace';
const INK = "#0f172a";
const SLATE = "#475569";
const EDITOR_BG = "#1e1e1e";
const PANEL_BG = "#252526";

const HOP_FILL: Record<HopId, string> = { alice: "#fef3c7", bob: "#dbeafe", charlie: "#ccece8", dave: "#ede1f3" };
const HOP_STROKE: Record<HopId, string> = { alice: "#b8860b", bob: "#3b6aa0", charlie: "#2d7a7a", dave: "#7b4b8a" };
const HOP_LABEL: Record<HopId, string> = { alice: "Alice", bob: "Bob", charlie: "Charlie", dave: "Dave" };
const ROUTE: HopId[] = ["alice", "bob", "charlie", "dave"];
const NODE_X_PCT: Record<HopId, number> = { alice: 12, bob: 38, charlie: 62, dave: 88 };
const WRAP_ORDER: ForwarderId[] = ["bob", "charlie", "dave"];
const RHO_LABEL: Record<ForwarderId, string> = { bob: "rho_B", charlie: "rho_C", dave: "rho_D" };

export interface OnionCapstoneLabProps {
  injectedTrace?: CapstoneTraceResult;
  getSaved?: SavedGetter;
  demo?: boolean;
}
type RunState = "idle" | "running" | "ready" | "blocked" | "error";

const fileLabel = (file: string) => file.replace(/^<student:/, "").replace(/>$/, "");
const presentLayers = (layers: number) => new Set(WRAP_ORDER.slice(WRAP_ORDER.length - layers));

// ── Python syntax highlighting ────────────────────────────────────────────────

const TOK = { comment: "#6a9955", string: "#ce9178", keyword: "#569cd6", ctrl: "#c586c0", func: "#dcdcaa", type: "#4ec9b0", self: "#9cdcfe", num: "#b5cea8", ident: "#d4d4d4" };
const KEYWORDS = new Set(["def", "class", "import", "from", "as", "None", "True", "False", "lambda", "global", "nonlocal"]);
const CTRL = new Set(["return", "if", "elif", "else", "for", "while", "in", "and", "or", "not", "is", "with", "try", "except", "finally", "raise", "yield", "break", "continue", "pass", "assert", "del"]);

function tokenize(line: string): Array<{ t: string; c: string }> {
  const out: Array<{ t: string; c: string }> = [];
  let i = 0;
  const push = (t: string, c: string) => { if (t) out.push({ t, c }); };
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#") { push(line.slice(i), TOK.comment); break; }
    if (ch === '"' || ch === "'") { let j = i + 1; while (j < line.length && line[j] !== ch) { if (line[j] === "\\") j++; j++; } push(line.slice(i, j + 1), TOK.string); i = j + 1; continue; }
    if (/\s/.test(ch)) { let j = i; while (j < line.length && /\s/.test(line[j])) j++; push(line.slice(i, j), TOK.ident); i = j; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      let c = TOK.ident;
      if (w === "self") c = TOK.self; else if (CTRL.has(w)) c = TOK.ctrl; else if (KEYWORDS.has(w)) c = TOK.keyword; else if (/^[A-Z]/.test(w)) c = TOK.type; else if (line[j] === "(") c = TOK.func;
      push(w, c); i = j; continue;
    }
    if (/[0-9]/.test(ch)) { let j = i; while (j < line.length && /[0-9xXa-fA-F_.]/.test(line[j])) j++; push(line.slice(i, j), TOK.num); i = j; continue; }
    let j = i; while (j < line.length && !/[\sA-Za-z0-9_#"']/.test(line[j])) j++; push(line.slice(i, j), TOK.ident); i = j; continue;
  }
  return out;
}

// ── frames ─────────────────────────────────────────────────────────────────

interface Frame {
  actor: HopId; beat: number; layers: number; depth: number;
  delivered?: boolean; reused?: boolean; note?: string;
  file?: string; line?: number; fn?: string;
  locals?: Record<string, SerializedValue>; globals?: Record<string, SerializedValue>; ret?: SerializedValue;
}
const PHASE_FNS: Record<HopId, string[]> = {
  alice: ["derive_shared_secrets", "generate_filler", "wrap_hop", "build"],
  bob: ["verify_hmac", "peel_layer", "check_forward"],
  charlie: ["verify_hmac", "peel_layer", "check_forward"],
  dave: ["verify_hmac", "peel_layer"],
};
const defLine = (src: string, fn: string) => { const i = src.split("\n").findIndex((l) => l.includes("def " + fn)); return i >= 0 ? i + 1 : 1; };
const stepFields = (s: CapstoneTraceStep): Partial<Frame> => ({ file: s.file, line: s.line, fn: s.fn, locals: s.locals, globals: s.globals, depth: s.depth ?? 0, ret: s.event === "return" ? s.ret : undefined });

function buildFrames(trace: CapstoneTraceResult): Frame[] {
  const frames: Frame[] = [];
  const alice = trace.steps.filter((s) => s.actor === "alice");
  const bob = trace.steps.filter((s) => s.actor === "bob");
  const fwd = trace.files[CAPSTONE_FILES.forwarder] ?? "";
  const L = (fn: string) => defLine(fwd, fn);

  alice.forEach((s, i) => frames.push({ actor: "alice", beat: 0, layers: Math.min(3, Math.round((3 * (i + 1)) / Math.max(1, alice.length))), ...stepFields(s) } as Frame));
  if (frames.length) frames[frames.length - 1].layers = 3;
  let peeled = false;
  bob.forEach((s) => { if (s.fn === "peel_layer") peeled = true; frames.push({ actor: "bob", beat: 1, layers: peeled ? 2 : 3, ...stepFields(s) } as Frame); });

  const reuse = (actor: HopId, beat: number, fn: string, layers: number, note: string, delivered?: boolean) =>
    frames.push({ actor, beat, layers, depth: 0, reused: true, delivered, file: CAPSTONE_FILES.forwarder, fn, line: L(fn), note });
  reuse("charlie", 2, "verify_hmac", 2, "Charlie verifies with the verify_hmac you wrote.");
  reuse("charlie", 2, "peel_layer", 1, "Charlie peels his layer with your peel_layer.");
  reuse("charlie", 2, "check_forward", 1, "Charlie checks fee + CLTV with your check_forward.");
  reuse("dave", 3, "verify_hmac", 1, "Dave verifies the final HMAC.");
  reuse("dave", 3, "peel_layer", 0, "Dave peels the last layer: a type-8 payment_data, no short_channel_id. Payment received.", true);
  return frames;
}

const ACTIVE_FIELD: Record<string, "version" | "ephemeral" | "hop_payloads" | "hmac" | "all"> = {
  derive_shared_secrets: "ephemeral", generate_filler: "hop_payloads", wrap_hop: "hop_payloads", build: "all", verify_hmac: "hmac", peel_layer: "hop_payloads", check_forward: "hop_payloads",
};

// ── value rendering ──────────────────────────────────────────────────────────

const shortHex = (hex: string, len: number) => { const c = hex.replace("…", ""); return len <= 8 || c.length <= 20 ? c : c.slice(0, 10) + "…" + c.slice(-8); };
function typeBadge(v: SerializedValue): string {
  if ("hex" in v) return `bytes[${v.len}]`;
  if ("fields" in v) return v.t;
  if ("items" in v && (v.t === "list" || v.t === "tuple")) return `${v.t}[${v.len}]`;
  if (v.t === "dict" && "items" in v) return `dict[${v.len}]`;
  return v.t;
}
function valueText(v: SerializedValue): string {
  if ("hex" in v) return shortHex(v.hex, v.len);
  if ("v" in v) return v.t === "str" ? `'${v.v}'` : v.t === "bool" ? (v.v ? "True" : "False") : String(v.v);
  if ("repr" in v) return v.repr;
  if ("fields" in v) return Object.keys(v.fields).join(", ");
  if ("items" in v) return v.t === "dict" ? "{…}" : "[…]";
  if ("n" in v) return `+${v.n} more`;
  return "";
}
function VarRow({ name, v }: { name: string; v: SerializedValue }) {
  const [open, setOpen] = useState(false);
  const expandable = "fields" in v || ("items" in v && (v.t === "list" || v.t === "tuple")) || ("hex" in v && v.len > 12);
  const badge = "hex" in v ? "#9cdcfe" : "fields" in v ? "#4ec9b0" : "items" in v ? "#dcaa7a" : "#b5cea8";
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ display: "flex", gap: 7, alignItems: "baseline", cursor: expandable ? "pointer" : "default", fontFamily: MONO, fontSize: 11.5 }} onClick={() => expandable && setOpen((o) => !o)}>
        <span style={{ color: expandable ? "#858585" : "transparent", width: 8, flexShrink: 0 }}>{expandable ? (open ? "▾" : "▸") : ""}</span>
        <span style={{ color: "#9cdcfe", flexShrink: 0 }}>{name}</span>
        <span style={{ color: badge, fontSize: 10, flexShrink: 0 }}>{typeBadge(v)}</span>
        <span style={{ color: "#d4d4d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valueText(v)}</span>
      </div>
      {open && "hex" in v && <div style={{ marginLeft: 15, color: "#ce9178", fontFamily: MONO, fontSize: 10.5, wordBreak: "break-all" }}>{v.hex}</div>}
      {open && "fields" in v && <div style={{ marginLeft: 15 }}>{Object.entries(v.fields).map(([k, val]) => <VarRow key={k} name={k} v={val} />)}</div>}
      {open && "items" in v && (v.t === "list" || v.t === "tuple") && <div style={{ marginLeft: 15 }}>{v.items.map((val, i) => <VarRow key={i} name={`[${i}]`} v={val} />)}</div>}
    </div>
  );
}
function Scope({ title, vars, defaultOpen }: { title: string; vars: Record<string, SerializedValue>; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(vars);
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", color: "#858585", fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "2px 0 4px" }}>
        {open ? "▾" : "▸"} {title} <span style={{ color: "#5a5a5a" }}>({entries.length})</span>
      </div>
      {open && (entries.length ? entries.map(([n, v]) => <VarRow key={n} name={n} v={v} />) : <div style={{ color: "#5a5a5a", fontFamily: MONO, fontSize: 11, marginLeft: 4 }}>—</div>)}
    </div>
  );
}

// ── code pane ────────────────────────────────────────────────────────────────

function CodePane({ source, line, fn, file, note, height }: { source: string; line?: number; fn?: string; file?: string; note?: string; height: number }) {
  const lines = useMemo(() => source.split("\n"), [source]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { const c = containerRef.current, a = activeRef.current; if (c && a) c.scrollTop = Math.max(0, a.offsetTop - c.clientHeight / 2 + a.clientHeight / 2); }, [line, source]);
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #333", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ background: "#323233", color: "#cccccc", fontFamily: MONO, fontSize: 11.5, padding: "5px 10px", borderBottom: "1px solid #333" }}>{file ? fileLabel(file) : "code"} <span style={{ color: "#858585" }}>▸ {fn ?? ""}()</span></div>
      <div ref={containerRef} style={{ position: "relative", background: EDITOR_BG, overflow: "auto", height }}>
        <pre style={{ margin: 0, fontFamily: MONO, fontSize: 12, lineHeight: "1.5" }}>
          {lines.map((text, i) => {
            const n = i + 1; const isActive = n === line;
            return (
              <div key={n} ref={isActive ? activeRef : undefined} style={{ display: "flex", background: isActive ? "#2a2d2e" : "transparent", borderLeft: isActive ? "2px solid #569cd6" : "2px solid transparent" }}>
                <span style={{ display: "inline-block", width: 32, textAlign: "right", paddingRight: 11, color: isActive ? "#c6c6c6" : "#6e7681", userSelect: "none", flexShrink: 0 }}>{n}</span>
                <span style={{ whiteSpace: "pre" }}>{tokenize(text).map((tk, k) => <span key={k} style={{ color: tk.c }}>{tk.t}</span>)}{text === "" ? " " : ""}</span>
              </div>
            );
          })}
        </pre>
      </div>
      {note && <div style={{ background: "#2d2d30", color: "#cccccc", fontFamily: SANS, fontSize: 11, padding: "5px 10px", borderTop: "1px solid #333" }}>↻ {note}</div>}
    </div>
  );
}

// ── hero visual ──────────────────────────────────────────────────────────────

function OnionGraphic({ layers, delivered }: { layers: number; delivered?: boolean }) {
  const present = presentLayers(layers);
  let node = (
    <div style={{ width: 38, height: 38, borderRadius: "50%", background: delivered ? "#fef3c7" : "#fffdf5", border: `2px solid ${delivered ? "#b8860b" : "#cbd5e1"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, color: "#b8860b", fontWeight: 700 }}>{delivered ? "paid" : "load"}</div>
  );
  [...WRAP_ORDER].reverse().forEach((hop) => {
    const on = present.has(hop); const inner = node;
    node = (
      <div style={{ position: "relative", padding: 11, borderRadius: "50%", overflow: "hidden", background: on ? HOP_FILL[hop] : "transparent", border: on ? `3px solid ${HOP_STROKE[hop]}` : "2px dashed #cbd5e1", transition: "all 0.35s ease" }}>
        {on && <HatchOverlay hops={[hop]} zIndex={1} stripeOpacity={0.2} washOpacity={0.1} />}
        <div style={{ position: "relative", zIndex: 2 }}>{inner}</div>
      </div>
    );
  });
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>{node}</div>;
}
function OnionLegend({ layers, delivered }: { layers: number; delivered?: boolean }) {
  const present = presentLayers(layers);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 150 }}>
      {WRAP_ORDER.map((hop) => {
        const on = present.has(hop);
        return (
          <div key={hop} style={{ display: "flex", alignItems: "center", gap: 7, opacity: on ? 1 : 0.5 }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: on ? HOP_FILL[hop] : "transparent", border: `2px solid ${HOP_STROKE[hop]}`, flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 11.5, color: INK, fontWeight: 600 }}>{HOP_LABEL[hop]}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: HOP_STROKE[hop] }}>{RHO_LABEL[hop]}</span>
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 10, color: SLATE }}>{on ? "wrapped" : "peeled"}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 1, borderTop: `1px solid ${SLATE}22`, paddingTop: 6 }}>
        <span style={{ width: 13, height: 13, borderRadius: 3, background: "#fef3c7", border: "2px solid #b8860b", flexShrink: 0 }} />
        <span style={{ fontFamily: SANS, fontSize: 11.5, color: INK, fontWeight: 600 }}>payload</span>
        <span style={{ marginLeft: "auto", fontFamily: SANS, fontSize: 10, color: delivered ? "#b8860b" : SLATE, fontWeight: delivered ? 700 : 400 }}>{delivered ? "delivered" : "sealed"}</span>
      </div>
    </div>
  );
}
const BYTE_FIELDS: Array<{ key: "version" | "ephemeral" | "hop_payloads" | "hmac"; label: string; flex: number }> = [
  { key: "version", label: "v", flex: 0.5 }, { key: "ephemeral", label: "ephemeral·33", flex: 2 }, { key: "hop_payloads", label: "hop_payloads·1300", flex: 8 }, { key: "hmac", label: "hmac·32", flex: 2 },
];
function ByteStrip({ active }: { active: "version" | "ephemeral" | "hop_payloads" | "hmac" | "all" }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {BYTE_FIELDS.map((f) => {
        const lit = active === "all" || active === f.key;
        return <div key={f.key} style={{ flex: f.flex, textAlign: "center", fontFamily: MONO, fontSize: 9, padding: "3px 2px", color: lit ? INK : SLATE, background: lit ? "#fef3c7" : "#eef1f5", border: `1px solid ${lit ? "#b8860b" : "#cbd5e1"}`, borderRadius: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.3s" }}>{f.label}</div>;
      })}
    </div>
  );
}
function RouteStrip({ actor }: { actor: HopId }) {
  const activeIdx = ROUTE.indexOf(actor);
  return (
    <div style={{ position: "relative", height: 54 }}>
      <div style={{ position: "absolute", top: 18, left: `${NODE_X_PCT.alice}%`, right: `${100 - NODE_X_PCT.dave}%`, borderTop: `1.5px dashed ${SLATE}`, zIndex: 0 }} />
      {ROUTE.map((hop) => {
        const active = hop === actor; const reached = ROUTE.indexOf(hop) <= activeIdx;
        return (
          <div key={hop} style={{ position: "absolute", left: `${NODE_X_PCT[hop]}%`, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, zIndex: 2 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: reached ? HOP_FILL[hop] : "#eef1f5", border: `${active ? 3 : 2}px solid ${reached ? HOP_STROKE[hop] : "#cbd5e1"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 14, color: reached ? HOP_STROKE[hop] : "#94a3b8", boxShadow: active ? `0 0 0 4px ${HOP_STROKE[hop]}22` : "none", transition: "all 0.3s" }}>{HOP_LABEL[hop][0]}</div>
            <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? HOP_STROKE[hop] : SLATE }}>{HOP_LABEL[hop]}</span>
          </div>
        );
      })}
    </div>
  );
}
function HeroVisual({ frame }: { frame: Frame }) {
  return (
    <div>
      <RouteStrip actor={frame.actor} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 4, flexWrap: "wrap" }}>
        <OnionGraphic layers={frame.layers} delivered={frame.delivered} />
        <OnionLegend layers={frame.layers} delivered={frame.delivered} />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: SLATE, marginBottom: 2 }}>1,366-byte packet</div>
        <ByteStrip active={frame.fn ? ACTIVE_FIELD[frame.fn] ?? "hop_payloads" : "all"} />
      </div>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function OnionCapstoneLab({ injectedTrace, getSaved, demo }: OnionCapstoneLabProps) {
  const [runState, setRunState] = useState<RunState>(injectedTrace ? "ready" : "idle");
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [trace, setTrace] = useState<CapstoneTraceResult | null>(injectedTrace ?? null);
  const [idx, setIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const frames = useMemo(() => (trace ? buildFrames(trace) : []), [trace]);
  const frame = frames[idx];

  const fnFrame = useMemo(() => {
    const m = new Map<string, number>();
    frames.forEach((f, i) => { if (f.fn) { const k = `${f.actor}:${f.fn}`; if (!m.has(k)) m.set(k, i); } });
    return m;
  }, [frames]);

  const run = useCallback(async () => {
    setRunState("running"); setProgress({}); setErrorMsg("");
    try {
      if (demo) { const t = await runOnionCapstoneDemo(); setTrace(t); setIdx(0); setRunState("ready"); return; }
      const result = await runOnionCapstone(getSaved, (id, passed) => setProgress((p) => ({ ...p, [id]: passed })));
      setPreflight(result.preflight);
      if (result.trace) { setTrace(result.trace); setIdx(0); setRunState("ready"); } else setRunState("blocked");
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); setRunState("error"); }
  }, [getSaved, demo]);

  // simple stepping: Back / Step / Step Out
  const stepBack = () => setIdx((i) => Math.max(0, i - 1));
  const stepFwd = () => setIdx((i) => Math.min(frames.length - 1, i + 1));
  // Step Out: land on the current function's return (next return at depth <= current).
  const stepOut = () => setIdx((i) => { const d = frames[i]?.depth ?? 0; for (let j = i + 1; j < frames.length; j++) if (frames[j].ret !== undefined && (frames[j].depth ?? 0) <= d) return j; return Math.min(frames.length - 1, i + 1); });

  return (
    <div className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden" data-testid="onion-capstone-lab" style={{ fontFamily: SANS }}>
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">Onion Capstone — Step Through Your Code</span>
      </div>

      <div className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-4">
        {runState === "idle" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: INK, fontSize: 14, maxWidth: 520, margin: "0 auto 16px" }}>Run a real payment through the onion you built. Your code plays every role: Alice builds the packet, then each forwarder peels and forwards it. Pick a function to watch it run, and see the onion peel.</p>
            <button onClick={run} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: "#fff", background: "#000", padding: "10px 20px", border: "none", cursor: "pointer" }}>Run the capstone</button>
          </div>
        )}
        {runState === "running" && (
          <div style={{ padding: "12px 0" }}>
            <p style={{ color: SLATE, fontFamily: MONO, fontSize: 12, marginBottom: 8 }}>Running your code…</p>
            {Object.entries(progress).map(([id, ok]) => <div key={id} style={{ fontFamily: MONO, fontSize: 12, color: ok ? "#2d7a7a" : "#a13a3a" }}>{ok ? "✓" : "✗"} {id.replace(/^exercise-/, "").replace(/-draft$/, "")}</div>)}
          </div>
        )}
        {runState === "blocked" && preflight && (
          <div style={{ padding: "6px 0" }}>
            <p style={{ color: "#a13a3a", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Finish these exercises first:</p>
            {preflight.results.filter((r) => !r.passed).map((r) => (<div key={r.id} style={{ marginBottom: 6 }}><div style={{ fontFamily: SANS, fontWeight: 600, color: INK, fontSize: 13 }}>{r.title}</div>{r.failures.slice(0, 2).map((f, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: SLATE }}>{f}</div>)}</div>))}
            <button onClick={run} style={{ fontFamily: SANS, fontSize: 12, marginTop: 6, padding: "6px 14px", border: `1.5px solid ${INK}`, background: "transparent", cursor: "pointer" }}>Re-check</button>
          </div>
        )}
        {runState === "error" && <p style={{ color: "#a13a3a", fontFamily: MONO, fontSize: 12 }}>Error: {errorMsg}</p>}

        {runState === "ready" && frame && (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 760 }}>
              {/* TOP: visuals (left) | variables (right). Row sizes to the visuals;
                  the variables panel is height-capped so it scrolls instead of growing. */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 52%", minWidth: 330 }}>
                  <HeroVisual frame={frame} />
                </div>
                <div style={{ flex: "1 1 48%", minWidth: 300, display: "flex", flexDirection: "column", border: "1px solid #333", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: "#323233", color: "#cccccc", fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderBottom: "1px solid #333" }}>Variables</div>
                  <div style={{ height: 192, background: PANEL_BG, overflow: "auto", padding: "7px 10px" }}>
                    {frame.reused ? <div style={{ color: "#858585", fontFamily: SANS, fontSize: 11.5 }}>Values were shown when this code first ran at Bob.</div> : (
                      <>
                        {frame.ret && <div style={{ marginBottom: 6, fontFamily: MONO, fontSize: 11.5 }}><span style={{ color: "#c586c0" }}>return </span><span style={{ color: "#d4d4d4" }}>{valueText(frame.ret)}</span></div>}
                        <Scope title="Locals" vars={frame.locals ?? {}} defaultOpen={true} />
                        <Scope title="Globals" vars={frame.globals ?? {}} defaultOpen={true} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* FUNCTION STRIP: compact, full width — which function runs at each hop */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {ROUTE.map((hop) => (
                  <div key={hop} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", background: HOP_FILL[hop], border: `1px solid ${HOP_STROKE[hop]}40`, borderRadius: 6 }}>
                    <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: HOP_STROKE[hop] }}>{HOP_LABEL[hop]}</span>
                    {PHASE_FNS[hop].map((fn) => {
                      const target = fnFrame.get(`${hop}:${fn}`);
                      const active = frame.actor === hop && frame.fn === fn;
                      const disabled = target === undefined;
                      return (
                        <button key={fn} disabled={disabled} onClick={() => target !== undefined && setIdx(target)} title={disabled ? "" : `Jump to ${fn}()`}
                          style={{ fontFamily: MONO, fontSize: 10, padding: "2px 6px", cursor: disabled ? "default" : "pointer", color: active ? "#fff" : disabled ? "#94a3b8" : INK, background: active ? HOP_STROKE[hop] : "#fffdf5", border: `1px solid ${active ? HOP_STROKE[hop] : HOP_STROKE[hop] + "55"}`, borderRadius: 3, opacity: disabled ? 0.45 : 1 }}>{fn}</button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* CODE: full width (the walkthrough is the star) */}
              <div style={{ marginTop: 12 }}>
                <CodePane source={frame.file ? (trace!.files[frame.file] ?? "") : ""} line={frame.line} fn={frame.fn} file={frame.file} note={frame.reused ? frame.note : undefined} height={214} />
              </div>

              {/* controls: Back / Step / Step Out */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={stepBack} style={ctrlBtn} title="Previous line">◀ Back</button>
                <button onClick={stepFwd} style={ctrlBtn} title="Step — next line (enters functions you call)">Step →</button>
                <button onClick={stepOut} style={ctrlBtn} title="Step Out — finish this function and stop at its return">Step Out ↑</button>
                <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "#b8860b" }} aria-label="Scrubber" />
                <span style={{ fontFamily: MONO, fontSize: 12, color: SLATE, whiteSpace: "nowrap" }}>{idx + 1} / {frames.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ctrlBtn: CSSProperties = { fontFamily: SANS, fontSize: 11.5, padding: "5px 10px", border: `1.5px solid ${INK}`, background: "#fffdf5", color: INK, cursor: "pointer", whiteSpace: "nowrap" };

export default OnionCapstoneLab;
