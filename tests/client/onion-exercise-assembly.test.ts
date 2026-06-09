import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// tests/setup.ts mocks "child_process" and "fs" for the server suites
// (bitcoind spawn, data dirs); this guard needs the real modules to write
// assembled programs to a temp dir and invoke python3 on them.
const { spawnSync } = await vi.importActual<typeof import("node:child_process")>(
  "node:child_process",
);
const { mkdtempSync, writeFileSync } = await vi.importActual<typeof import("node:fs")>(
  "node:fs",
);
const { tmpdir } = await vi.importActual<typeof import("node:os")>("node:os");
import { ONION_ROUTING_EXERCISES_DRAFT } from "../../client/src/data/onion-routing-exercises-draft";
import { getOnionRoutingDraftExerciseGroupContext } from "../../client/src/lib/onion-routing-exercise-groups-draft";
import { buildExerciseTestCode } from "../../client/src/lib/exercise-code-assembly";

// Layer-1 content-integrity guard for the onion course's exercise scaffolding.
//
// Every exercise's runnable program is concatenated from parts the student
// never sees together (hidden setup + visible provided code + prior in-group
// solutions + their editable code + testCode). A formatting mismatch between
// any two parts (e.g. a starter declaring its own class under a provided-code
// class header) produces a Python syntax error on the student's very first
// test run, mapped uselessly to "line 1" of their editor. This suite compiles
// every assembly shape so that failure mode can never ship again.
//
// Requires python3 on PATH; skips (with a visible reason) when absent.

const EXERCISE_IDS = [
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

const havePython = spawnSync("python3", ["--version"]).status === 0;
const workDir = havePython ? mkdtempSync(path.join(tmpdir(), "onion-assembly-")) : "";

/** hints.code, HTML-entity-decoded: the editable-range-format reference solution. */
function solutionCode(id: string): string {
  let c = ONION_ROUTING_EXERCISES_DRAFT[id]?.hints?.code ?? "";
  c = c
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return c.replace(/\s+$/, "");
}

/** Assemble one exercise exactly as the runner does (CodeExercise / preflight). */
function assemble(id: string, codeFor: (id: string) => string, withTests: boolean): string {
  const ex = ONION_ROUTING_EXERCISES_DRAFT[id];
  const ctx = getOnionRoutingDraftExerciseGroupContext(id);
  const program = buildExerciseTestCode({
    setupCode: ctx?.setupCode,
    standaloneDeps: (ctx?.crossGroupExercises ?? []).map((e) => codeFor(e.id)),
    preamble: ctx?.preamble,
    priorInGroupDeps: (ctx?.priorInGroupExercises ?? []).map((e) => codeFor(e.id)),
    currentCode: codeFor(id),
  });
  return withTests ? `${program}\n\n${ex.testCode}` : program;
}

function pyCompile(label: string, source: string): { ok: boolean; error: string } {
  const file = path.join(workDir, `${label}.py`);
  writeFileSync(file, source);
  const res = spawnSync("python3", ["-m", "py_compile", file], { encoding: "utf8" });
  return { ok: res.status === 0, error: (res.stderr || res.stdout || "").trim() };
}

describe.skipIf(!havePython)("onion exercise assembly compiles (Layer 1 guard)", () => {
  const asStarter = (id: string) => ONION_ROUTING_EXERCISES_DRAFT[id].starterCode;
  const asSolution = (id: string) =>
    solutionCode(id) || ONION_ROUTING_EXERCISES_DRAFT[id].starterCode;

  for (const id of EXERCISE_IDS) {
    it(`${id}: starter assembly (a student's first run) is valid Python`, () => {
      const { ok, error } = pyCompile(`${id}-starter`, assemble(id, asStarter, true));
      expect(ok, `starter assembly failed to compile:\n${error}`).toBe(true);
    });

    it(`${id}: solution assembly (hints.code pasted in) is valid Python`, () => {
      const { ok, error } = pyCompile(`${id}-solution`, assemble(id, asSolution, true));
      expect(ok, `solution assembly failed to compile:\n${error}`).toBe(true);
    });
  }
});

describe.skipIf(havePython)("onion exercise assembly compiles (Layer 1 guard)", () => {
  it.skip("skipped: python3 not found on PATH", () => {});
});
