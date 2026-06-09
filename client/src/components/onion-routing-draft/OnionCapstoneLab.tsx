import { type CSSProperties, useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  runOnionCapstone,
  runOnionCapstoneDemo,
  type PreflightResult,
  type SavedGetter,
} from "../../lib/onion-capstone-orchestrator";
import { type CapstoneTraceResult, type HopId, type SerializedValue } from "../../lib/onion-capstone-trace";
import { buildSceneTimeline, type Scene, type SceneFrame } from "../../lib/onion-capstone-scenes";
import { CapstoneStage, type StageChip } from "./CapstoneStage";

// ────────────────────────────────────────────────────────────────────────────
// OnionCapstoneLab — synced step-through capstone.
//
// Layout (locked 2026-06-08): full-width visual stage on top (CapstoneStage,
// chapter 7-10 diagram grammar, scenes driven by the trace's semantic events),
// a debugger toolbar, then one tall row: code pane (~62%) and variables
// (~38%) at equal height. The route strip on the stage carries each hop's
// function chips (click to jump). No autoplay; Back / Step / Step Out plus
// scene skip and a scene-tick scrubber.
// ────────────────────────────────────────────────────────────────────────────

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = '"JetBrains Mono", "Fira Code", monospace';
const INK = "#0f172a";
const SLATE = "#475569";
const EDITOR_BG = "#1e1e1e";
const PANEL_BG = "#252526";

export interface OnionCapstoneLabProps {
  injectedTrace?: CapstoneTraceResult;
  getSaved?: SavedGetter;
  demo?: boolean;
}
type RunState = "idle" | "running" | "ready" | "blocked" | "error";

const fileLabel = (file: string) => file.replace(/^<student:/, "").replace(/>$/, "");

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

// ── chips (route-strip function navigation) ──────────────────────────────────

const CHIP_DEFS: Array<{ hop: HopId; fn: string; short: string }> = [
  { hop: "alice", fn: "derive_shared_secrets", short: "secrets" },
  { hop: "alice", fn: "generate_filler", short: "filler" },
  { hop: "alice", fn: "wrap_hop", short: "wrap_hop" },
  { hop: "alice", fn: "build", short: "build" },
  { hop: "bob", fn: "verify_hmac", short: "verify" },
  { hop: "bob", fn: "peel_layer", short: "peel" },
  { hop: "bob", fn: "check_forward", short: "forward" },
  { hop: "charlie", fn: "verify_hmac", short: "verify" },
  { hop: "charlie", fn: "peel_layer", short: "peel" },
  { hop: "charlie", fn: "check_forward", short: "forward" },
  { hop: "dave", fn: "verify_hmac", short: "verify" },
  { hop: "dave", fn: "peel_layer", short: "peel" },
];

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
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #333", borderRadius: 4, overflow: "hidden", height: "100%" }}>
      <div style={{ background: "#323233", color: "#cccccc", fontFamily: MONO, fontSize: 11.5, padding: "5px 10px", borderBottom: "1px solid #333", flexShrink: 0 }}>{file ? fileLabel(file) : "code"} <span style={{ color: "#858585" }}>▸ {fn ?? ""}()</span></div>
      <div ref={containerRef} style={{ position: "relative", background: EDITOR_BG, overflow: "auto", height }}>
        <pre style={{ margin: 0, fontFamily: MONO, fontSize: 12, lineHeight: "1.5", paddingBottom: note ? 30 : 0 }}>
          {lines.map((text, i) => {
            const n = i + 1; const isActive = n === line;
            return (
              <div key={n} ref={isActive ? activeRef : undefined} style={{ display: "flex", background: isActive ? "#2a2d2e" : "transparent", borderLeft: isActive ? "2px solid #b8860b" : "2px solid transparent" }}>
                <span style={{ display: "inline-block", width: 34, textAlign: "right", paddingRight: 11, color: isActive ? "#c6c6c6" : "#6e7681", userSelect: "none", flexShrink: 0 }}>{n}</span>
                <span style={{ whiteSpace: "pre" }}>{tokenize(text).map((tk, k) => <span key={k} style={{ color: tk.c }}>{tk.t}</span>)}{text === "" ? " " : ""}</span>
              </div>
            );
          })}
        </pre>
        {note && <div style={{ position: "sticky", bottom: 0, background: "#2d2d30", color: "#cccccc", fontFamily: SANS, fontSize: 11, padding: "5px 10px", borderTop: "1px solid #333" }}>↻ {note}</div>}
      </div>
    </div>
  );
}

// ── variables panel (scene-pinned + full tree) ───────────────────────────────

function VariablesPanel({ scene, frame, height }: { scene: Scene; frame: SceneFrame; height: number }) {
  const pinnedLocals = useMemo(() => {
    const locals = frame.locals ?? {};
    return scene.pinLocals.filter((n) => n in locals).slice(0, 6).map((n) => [n, locals[n]] as const);
  }, [scene, frame]);
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid #333", borderRadius: 4, overflow: "hidden", height: "100%" }}>
      <div style={{ background: "#323233", color: "#cccccc", fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "5px 10px", borderBottom: "1px solid #333", flexShrink: 0 }}>Variables</div>
      <div style={{ height, background: PANEL_BG, overflow: "auto", padding: "7px 10px" }}>
        {(scene.pinned.length > 0 || pinnedLocals.length > 0) && (
          <div style={{ marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid #3a3a3c" }}>
            <div style={{ color: "#b8860b", fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>This step</div>
            {scene.pinned.map((p) => (
              <div key={p.name} style={{ display: "flex", gap: 7, alignItems: "baseline", fontFamily: MONO, fontSize: 11.5, marginBottom: 2 }}>
                <span style={{ color: "#dcaa7a", flexShrink: 0 }}>{p.name}</span>
                <span style={{ color: "#d4d4d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.value}</span>
              </div>
            ))}
            {pinnedLocals.map(([n, v]) => <VarRow key={n} name={n} v={v} />)}
          </div>
        )}
        {frame.synthetic ? (
          <div style={{ color: "#858585", fontFamily: SANS, fontSize: 11.5 }}>{frame.note ?? "This call reuses code you already stepped through; its values were shown on the first run."}</div>
        ) : (
          <>
            {frame.ret && <div style={{ marginBottom: 6, fontFamily: MONO, fontSize: 11.5 }}><span style={{ color: "#c586c0" }}>return </span><span style={{ color: "#d4d4d4" }}>{valueText(frame.ret)}</span></div>}
            <Scope title="Locals" vars={frame.locals ?? {}} defaultOpen={true} />
            <Scope title="Globals" vars={frame.globals ?? {}} defaultOpen={true} />
          </>
        )}
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

  const timeline = useMemo(() => (trace ? buildSceneTimeline(trace) : null), [trace]);
  const frames = timeline?.frames ?? [];
  const scenes = timeline?.scenes ?? [];
  const frame = frames[idx];
  const sceneIdx = timeline ? timeline.sceneOfFrame[idx] ?? 0 : 0;
  const scene = scenes[sceneIdx];

  const fnFrame = useMemo(() => {
    const m = new Map<string, number>();
    frames.forEach((f, i) => { if (f.fn) { const k = `${f.actor}:${f.fn}`; if (!m.has(k)) m.set(k, i); } });
    return m;
  }, [frames]);

  const chips: StageChip[] = useMemo(() =>
    CHIP_DEFS.map((c) => ({
      ...c,
      target: fnFrame.get(`${c.hop}:${c.fn}`),
      active: !!frame && frame.actor === c.hop && frame.fn === c.fn,
    })), [fnFrame, frame]);

  const run = useCallback(async () => {
    setRunState("running"); setProgress({}); setErrorMsg("");
    try {
      if (demo) { const t = await runOnionCapstoneDemo(); setTrace(t); setIdx(0); setRunState("ready"); return; }
      const result = await runOnionCapstone(getSaved, (id, passed) => setProgress((p) => ({ ...p, [id]: passed })));
      setPreflight(result.preflight);
      if (result.trace) { setTrace(result.trace); setIdx(0); setRunState("ready"); } else setRunState("blocked");
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : String(e)); setRunState("error"); }
  }, [getSaved, demo]);

  // stepping: Back / Step / Step Out / scene skip
  const stepBack = () => setIdx((i) => Math.max(0, i - 1));
  const stepFwd = () => setIdx((i) => Math.min(frames.length - 1, i + 1));
  const stepOut = () => setIdx((i) => { const d = frames[i]?.depth ?? 0; for (let j = i + 1; j < frames.length; j++) if (frames[j].ret !== undefined && (frames[j].depth ?? 0) <= d) return j; return Math.min(frames.length - 1, i + 1); });
  const sceneBack = () => setIdx(() => scenes[Math.max(0, sceneIdx - 1)]?.start ?? 0);
  const sceneFwd = () => setIdx(() => scenes[Math.min(scenes.length - 1, sceneIdx + 1)]?.start ?? 0);

  return (
    <div className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden" data-testid="onion-capstone-lab" style={{ fontFamily: SANS }}>
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">Onion Capstone — Step Through Your Code</span>
      </div>

      <div className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-4">
        {runState === "idle" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p style={{ color: INK, fontSize: 14, maxWidth: 520, margin: "0 auto 16px" }}>Run a real payment through the onion you built. Your code plays every role: Alice builds the packet, then each forwarder peels and forwards it. Pick a function to watch it run, and see the onion change exactly when your code changes it.</p>
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

        {runState === "ready" && frame && scene && (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 760 }}>
              {/* STAGE: full-width chapter-grammar visual, scenes synced to the code */}
              <CapstoneStage scene={scene} sceneIdx={sceneIdx} sceneCount={scenes.length} chips={chips} onJump={setIdx} />

              {/* TOOLBAR: stepping + scene-tick scrubber */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 12px", flexWrap: "wrap" }}>
                <button onClick={stepBack} style={ctrlBtn} title="Previous line">◀ Back</button>
                <button onClick={stepFwd} style={ctrlBtn} title="Step — next line (enters functions you call)">Step →</button>
                <button onClick={stepOut} style={ctrlBtn} title="Step Out — finish this function and stop at its return">Step Out ↑</button>
                <span style={{ width: 1, alignSelf: "stretch", background: "#cbd5e1" }} />
                <button onClick={sceneBack} style={ctrlBtn} title="Previous scene">⏮ Scene</button>
                <button onClick={sceneFwd} style={ctrlBtn} title="Next scene">Scene ⏭</button>
                <div style={{ flex: 1, minWidth: 140, position: "relative", paddingTop: 7 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6 }} aria-hidden>
                    {scenes.map((s) => (
                      <span key={s.key} style={{ position: "absolute", left: `${(s.start / Math.max(1, frames.length - 1)) * 100}%`, width: 1.5, height: 6, background: "#b3b1a6" }} />
                    ))}
                  </div>
                  <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={idx} onChange={(e) => setIdx(Number(e.target.value))} style={{ width: "100%", accentColor: "#b8860b", display: "block" }} aria-label="Scrubber" />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 12, color: SLATE, whiteSpace: "nowrap" }}>{idx + 1} / {frames.length}</span>
              </div>

              {/* DEBUGGER ROW: tall code (left) + variables (right) */}
              <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                <div style={{ flex: "1 1 62%", minWidth: 420 }}>
                  <CodePane source={frame.file ? (trace!.files[frame.file] ?? "") : ""} line={frame.line} fn={frame.fn} file={frame.file} note={frame.synthetic ? frame.note : undefined} height={430} />
                </div>
                <div style={{ flex: "1 1 38%", minWidth: 260 }}>
                  <VariablesPanel scene={scene} frame={frame} height={430} />
                </div>
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
