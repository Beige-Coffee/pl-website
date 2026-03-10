import { describe, expect, it } from "vitest";
import { LIGHTNING_EXERCISES } from "../../client/src/data/lightning-exercises.ts";
import { getExerciseGroupContext } from "../../client/src/lib/exercise-groups.ts";
import { buildExerciseTestCode } from "../../client/src/lib/exercise-code-assembly.ts";

describe("exercise test code assembly", () => {
  it("does not let future commitment exercises overwrite the current create_commitment_tx", () => {
    const exerciseId = "ln-exercise-commitment-tx";
    const ctx = getExerciseGroupContext(exerciseId);

    expect(ctx).not.toBeNull();
    expect(ctx?.futureExercises.some((exercise) => exercise.id === "ln-exercise-commitment-tx-htlc")).toBe(true);

    const assembled = buildExerciseTestCode({
      setupCode: ctx!.setupCode,
      classMethodDeps: ctx!.classMethodExercises.map((exercise) => LIGHTNING_EXERCISES[exercise.id]?.starterCode ?? ""),
      standaloneDeps: ctx!.crossGroupExercises.map((exercise) => LIGHTNING_EXERCISES[exercise.id]?.starterCode ?? ""),
      preamble: ctx!.preamble,
      priorInGroupDeps: ctx!.priorInGroupExercises.map((exercise) => LIGHTNING_EXERCISES[exercise.id]?.starterCode ?? ""),
      currentCode: LIGHTNING_EXERCISES[exerciseId].hints.code,
    });

    expect(assembled.match(/def create_commitment_tx\(/g)?.length ?? 0).toBe(1);
    expect(assembled).toContain("weight = 724");
    expect(assembled).not.toContain("Create an unsigned commitment transaction WITH HTLC support.");
    expect(assembled).not.toContain("num_htlcs = 0");
  });
});
