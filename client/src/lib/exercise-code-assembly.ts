export interface ExerciseTestCodeInput {
  setupCode?: string;
  classMethodDeps?: string[];
  standaloneDeps?: string[];
  preamble?: string;
  priorInGroupDeps?: string[];
  currentCode: string;
}

export function buildExerciseTestCode({
  setupCode,
  classMethodDeps = [],
  standaloneDeps = [],
  preamble,
  priorInGroupDeps = [],
  currentCode,
}: ExerciseTestCodeInput): string {
  return [
    setupCode,
    ...classMethodDeps,
    ...standaloneDeps,
    preamble,
    ...priorInGroupDeps,
    currentCode,
  ]
    .filter(Boolean)
    .join("\n\n");
}
