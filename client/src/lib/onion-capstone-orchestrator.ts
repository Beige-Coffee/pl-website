/**
 * Onion Capstone orchestrator.
 *
 * Connects the student's saved exercise code (localStorage) to the trace engine:
 *   1. Preflight — run all 9 live (draft) exercise suites; the capstone unlocks
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

function codeFor(id: string, getSaved: SavedGetter): string {
  return getSaved(id) ?? EX[id]?.starterCode ?? "";
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
 * group's last exercise. setupCode is intentionally omitted — the trace engine
 * supplies the shared scaffolding, so each file is just the student's code.
 */
function assembleStudentFile(lastExerciseId: string, getSaved: SavedGetter): string {
  const ctx = getCtx(lastExerciseId);
  return buildExerciseTestCode({
    preamble: ctx?.preamble,
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
