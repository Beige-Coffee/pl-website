/**
 * Onion Capstone orchestrator.
 *
 * Connects the student's saved exercise code (localStorage) to the trace engine:
 *   1. Preflight - run all 9 live (draft) exercise suites; the capstone unlocks
 *      only if every one passes.
 *   2. Assemble the student's `sphinx/builder.py` and `sphinx/forwarder.py`
 *      from their saved code (the same assembly the per-exercise runner uses).
 *   3. Run the fixed-route step-through trace (see onion-capstone-trace.ts).
 *
 * Everything runs client-side in the existing Pyodide worker; no server.
 * Mirrors the Noise orchestrator's preflight pattern.
 */
import { ONION_ROUTING_EXERCISES_DRAFT as EX } from "../data/onion-routing-exercises-draft";
import { getOnionRoutingDraftExerciseGroupContext as getCtx } from "./onion-routing-exercise-groups-draft";
import { buildExerciseTestCode } from "./exercise-code-assembly";
import { runPythonTests, type TestResult } from "./pyodide-runner";
import { runCapstoneTrace, type CapstoneTraceResult } from "./onion-capstone-trace";

/** Reads a student's saved code for an exercise. Defaults to localStorage. */
export type SavedGetter = (exerciseId: string) => string | null;

const defaultGetSaved: SavedGetter = (id) => {
  try {
    return localStorage.getItem(`pl-exercise-${id}`);
  } catch {
    return null;
  }
};

/** The 9 live (draft) exercises, in dependency order. */
export const ONION_CAPSTONE_EXERCISE_IDS = [
  "exercise-derive-keys-draft",
  "exercise-derive-shared-secrets-draft",
  "exercise-generate-filler-draft",
  "exercise-wrap-hop-draft",
  "exercise-build-packet-draft",
  "exercise-peel-layer-draft",
  "exercise-verify-hmac-draft",
  "exercise-check-forward-draft",
  "exercise-decrypt-error-onion-draft",
] as const;

const BUILD_ID = "exercise-build-packet-draft";
const CHECK_FORWARD_ID = "exercise-check-forward-draft";

/** Leading-space count of a block's first non-empty line (its base indent). */
function baseIndent(s: string): number | null {
  for (const ln of s.split("\n")) {
    if (ln.trim() === "") continue;
    return ln.length - ln.trimStart().length;
  }
  return null;
}

/**
 * Align a saved solution's base indentation to its starter's, so stale or
 * oddly-indented saved code can't desync the assembled file. Some builder
 * methods were once authored as column-0 standalone functions; a student who
 * solved them back then still has column-0 code in localStorage. Without this,
 * the assembled class would carry a top-level `def` where a method belongs,
 * which both reads as broken in the code pane and breaks the trace harness's
 * `OnionPacketBuilder.<method>` attachment. No-op when the indents already
 * match, which is the overwhelmingly common case.
 */
function reindentToStarter(saved: string, starter: string): string {
  const want = baseIndent(starter);
  const have = baseIndent(saved);
  if (want === null || have === null || want === have) return saved;
  const lines = saved.split("\n");
  if (want > have) {
    const pad = " ".repeat(want - have);
    return lines.map((ln) => (ln.trim() === "" ? ln : pad + ln)).join("\n");
  }
  // want < have: only safe to dedent if every non-empty line has the room.
  const cut = have - want;
  const fits = lines.every(
    (ln) => ln.trim() === "" || ln.length - ln.trimStart().length >= cut,
  );
  return fits ? lines.map((ln) => (ln.trim() === "" ? ln : ln.slice(cut))).join("\n") : saved;
}

function codeFor(id: string, getSaved: SavedGetter): string {
  const saved = getSaved(id);
  if (saved == null) return EX[id]?.starterCode ?? "";
  return reindentToStarter(saved, EX[id]?.starterCode ?? "");
}

/**
 * Assemble one exercise's full runnable code exactly as the per-exercise runner
 * does: setupCode + deps + preamble + prior-in-group + the exercise's own code.
 * Used for preflight (paired with the exercise's testCode).
 */
function assembleForExercise(id: string, getSaved: SavedGetter): string {
  const ctx = getCtx(id);
  if (!ctx) return codeFor(id, getSaved);
  return buildExerciseTestCode({
    setupCode: ctx.setupCode,
    classMethodDeps: ctx.classMethodExercises.map((e) => codeFor(e.id, getSaved)),
    standaloneDeps: ctx.crossGroupExercises.map((e) => codeFor(e.id, getSaved)),
    preamble: ctx.preamble,
    priorInGroupDeps: ctx.priorInGroupExercises.map((e) => codeFor(e.id, getSaved)),
    currentCode: codeFor(id, getSaved),
  });
}

export interface PreflightExerciseResult {
  id: string;
  title: string;
  passed: boolean;
  failures: string[];
}

export interface PreflightResult {
  ok: boolean;
  results: PreflightExerciseResult[];
}

/**
 * Run all 9 exercise suites against the student's saved code. The capstone is
 * unlocked only when every suite passes.
 */
export async function runOnionCapstonePreflight(
  getSaved: SavedGetter = defaultGetSaved,
  onProgress?: (id: string, passed: boolean) => void,
): Promise<PreflightResult> {
  const results: PreflightExerciseResult[] = [];
  for (const id of ONION_CAPSTONE_EXERCISE_IDS) {
    const ex = EX[id];
    if (!ex) continue;
    let tests: TestResult[] = [];
    try {
      tests = await runPythonTests(assembleForExercise(id, getSaved), ex.testCode);
    } catch (e) {
      tests = [{ name: "execution", passed: false, message: e instanceof Error ? e.message : String(e) }];
    }
    const failures = tests.filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    const passed = tests.length > 0 && failures.length === 0;
    onProgress?.(id, passed);
    results.push({ id, title: ex.title, passed, failures });
  }
  return { ok: results.every((r) => r.passed), results };
}

/**
 * Assemble the student's full class file (preamble + their methods) for one
 * group's last exercise. setupCode is intentionally omitted - the trace engine
 * supplies the shared scaffolding, so each file is just the student's code.
 */
function assembleStudentFile(lastExerciseId: string, getSaved: SavedGetter): string {
  const ctx = getCtx(lastExerciseId);
  return buildExerciseTestCode({
    preamble: ctx?.preamble,
    // cross-group deps (e.g. build's derive_keys from ch6) must ride along as
    // module-level code, same as the per-exercise test assembly does.
    standaloneDeps: (ctx?.crossGroupExercises ?? []).map((e) => codeFor(e.id, getSaved)),
    priorInGroupDeps: (ctx?.priorInGroupExercises ?? []).map((e) => codeFor(e.id, getSaved)),
    currentCode: codeFor(lastExerciseId, getSaved),
  });
}

export const assembleBuilderFile = (getSaved: SavedGetter = defaultGetSaved) =>
  assembleStudentFile(BUILD_ID, getSaved);
export const assembleForwarderFile = (getSaved: SavedGetter = defaultGetSaved) =>
  assembleStudentFile(CHECK_FORWARD_ID, getSaved);

// ── Demo mode ────────────────────────────────────────────────────────────────
// Renders the lab without completed exercises by running the reference solutions
// through the engine. For chapter preview / review only (not the real capstone).
// hints.code is stored in editable-range format (class methods pre-indented,
// standalone functions at column 0), so it drops in as saved code directly.

function solutionCode(id: string): string {
  let c = EX[id]?.hints?.code ?? "";
  c = c.replace(/^<strong>Solution:<\/strong><br><pre><code>/, "").replace(/<\/code><\/pre>$/, "");
  c = c
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return c.replace(/\s+$/, "");
}

/** SavedGetter returning the reference solutions in editable-range format. */
export const demoGetSaved: SavedGetter = (id) => {
  // derive_keys' editable region includes the provided KeyMaterial dataclass,
  // but hints.code is only the function body. build's cross-group drop-in needs
  // both, so reconstruct the full editable region (starter's KeyMaterial + the
  // solution). Real students are unaffected - their saved code already has it.
  if (id === "exercise-derive-keys-draft") {
    const starter = EX[id]?.starterCode ?? "";
    return starter.replace(/\n[ \t]*def derive_keys[\s\S]*$/, "\n") + solutionCode(id);
  }
  switch (id) {
    case "exercise-derive-shared-secrets-draft":
    case "exercise-generate-filler-draft":
    case "exercise-wrap-hop-draft":
    case "exercise-build-packet-draft":
    case "exercise-peel-layer-draft":
    case "exercise-verify-hmac-draft":
    case "exercise-check-forward-draft":
      return solutionCode(id);
    default:
      return null;
  }
};

/** Run the trace against the reference solutions (preview/review; skips preflight). */
export async function runOnionCapstoneDemo(): Promise<CapstoneTraceResult> {
  return runCapstoneTrace(assembleBuilderFile(demoGetSaved), assembleForwarderFile(demoGetSaved));
}

export interface OnionCapstoneRunResult {
  preflight: PreflightResult;
  trace?: CapstoneTraceResult;
}

/**
 * Full capstone run: preflight, then (if all suites pass) the fixed-route
 * step-through trace built from the student's own code.
 */
export async function runOnionCapstone(
  getSaved: SavedGetter = defaultGetSaved,
  onProgress?: (id: string, passed: boolean) => void,
): Promise<OnionCapstoneRunResult> {
  const preflight = await runOnionCapstonePreflight(getSaved, onProgress);
  if (!preflight.ok) return { preflight };
  const trace = await runCapstoneTrace(
    assembleBuilderFile(getSaved),
    assembleForwarderFile(getSaved),
  );
  return { preflight, trace };
}
