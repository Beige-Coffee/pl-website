import { describe, expect, it } from "vitest";
import { LIGHTNING_EXERCISES } from "../../client/src/data/lightning-exercises";

describe("Lightning protocol contracts", () => {
  it("build_commitment_secret is taught as a shachain-index primitive", () => {
    const exercise = LIGHTNING_EXERCISES["ln-exercise-commitment-secret"];
    expect(exercise.description).toContain("per_commitment_index");
    expect(exercise.starterCode).toContain("def build_commitment_secret(self, per_commitment_index");
    expect(exercise.hints?.code).toContain("per_commitment_index");
  });

  it("derive_per_commitment_point converts commitment numbers to descending indices", () => {
    const exercise = LIGHTNING_EXERCISES["ln-exercise-per-commitment-point"];
    expect(exercise.description).toContain("ascending <code>commitment_number</code>");
    expect(exercise.testCode).toContain("MAX_INDEX = (1 << 48) - 1");
    expect(exercise.hints?.code).toContain("per_commitment_index = MAX_INDEX - commitment_number");
  });

  it("commitment HTLC exercise trims dust HTLCs before counting fee weight", () => {
    const exercise = LIGHTNING_EXERCISES["ln-exercise-commitment-tx-htlc"];
    expect(exercise.description).toContain("trim any dust HTLCs");
    expect(exercise.testCode).toContain("Dust offered HTLC should be trimmed");
    expect(exercise.testCode).toContain("Dust received HTLC should be trimmed");
    expect(exercise.testCode).toContain("Fee should count only untrimmed HTLCs");
    expect(exercise.hints?.code).toContain("663 * feerate_per_kw // 1000");
    expect(exercise.hints?.code).toContain("703 * feerate_per_kw // 1000");
  });
});
