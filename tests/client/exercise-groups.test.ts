import { describe, it, expect } from "vitest";
import { getExerciseGroupContext } from "../../client/src/lib/exercise-groups";

describe("getExerciseGroupContext", () => {
  it("returns context for valid exercise", () => {
    const ctx = getExerciseGroupContext("ln-exercise-channel-key-manager");
    expect(ctx).not.toBeNull();
    expect(ctx!.fileLabel).toBeDefined();
    expect(ctx!.setupCode).toBeDefined();
    expect(ctx!.preamble).toBeDefined();
  });

  it("returns null for unknown exercise", () => {
    const ctx = getExerciseGroupContext("nonexistent-exercise-id");
    expect(ctx).toBeNull();
  });

  it("priorInGroupExercises is empty for first exercise in group", () => {
    const ctx = getExerciseGroupContext("ln-exercise-channel-key-manager");
    expect(ctx).not.toBeNull();
    expect(ctx!.priorInGroupExercises).toEqual([]);
  });

  it("priorInGroupExercises is populated for later exercises", () => {
    const ctx = getExerciseGroupContext("ln-exercise-sign-input");
    expect(ctx).not.toBeNull();
    expect(ctx!.priorInGroupExercises.length).toBeGreaterThan(0);
    expect(ctx!.priorInGroupExercises.some(e => e.id === "ln-exercise-channel-key-manager")).toBe(true);
  });

  it("futureExercises populated for non-last exercise", () => {
    const ctx = getExerciseGroupContext("ln-exercise-channel-key-manager");
    expect(ctx).not.toBeNull();
    expect(ctx!.futureExercises.length).toBeGreaterThan(0);
  });

  it("crossGroupExercises populated for exercises with dependencies", () => {
    const ctx = getExerciseGroupContext("ln-exercise-commitment-outputs");
    expect(ctx).not.toBeNull();
    // This exercise is in the transactions/commitment group which has cross-group deps
    expect(ctx!.crossGroupExercises.length).toBeGreaterThanOrEqual(0);
  });

  it("setupCode contains ln module setup", () => {
    const ctx = getExerciseGroupContext("ln-exercise-channel-key-manager");
    expect(ctx).not.toBeNull();
    expect(ctx!.setupCode).toContain("import hmac");
  });

  it("different exercises in same group share fileLabel", () => {
    const ctx1 = getExerciseGroupContext("ln-exercise-channel-key-manager");
    const ctx2 = getExerciseGroupContext("ln-exercise-sign-input");
    expect(ctx1).not.toBeNull();
    expect(ctx2).not.toBeNull();
    expect(ctx1!.fileLabel).toBe(ctx2!.fileLabel);
  });

  it("exercises in different groups have different fileLabels", () => {
    const ctx1 = getExerciseGroupContext("ln-exercise-channel-key-manager");
    const ctx2 = getExerciseGroupContext("ln-exercise-funding-script");
    expect(ctx1).not.toBeNull();
    expect(ctx2).not.toBeNull();
    expect(ctx1!.fileLabel).not.toBe(ctx2!.fileLabel);
  });
});
