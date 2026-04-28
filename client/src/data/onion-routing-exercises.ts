// ─── Onion Routing Exercise Definitions ──────────────────────────────────────
//
// Each exercise has starter code, test code, hints, and metadata.
// Exercises are keyed by ID and referenced from tutorial markdown via
// <code-intro exercises="..."> tags.
//
// Exercises are added chapter-by-chapter. The 10 planned exercises:
//
// crypto/keys.py
//   - exercise-derive-keys                     [Ch 4]
//
// sphinx/builder.py
//   - exercise-derive-shared-secrets           [Ch 3]
//   - exercise-generate-filler                 [Ch 6]
//   - exercise-wrap-hop                        [Ch 7]
//   - exercise-build-packet                    [Ch 7]
//
// sphinx/forwarder.py
//   - exercise-peel-layer                      [Ch 8]
//   - exercise-process-onion                   [Ch 9]
//
// sphinx/errors.py
//   - exercise-build-error-onion               [Ch 10]
//   - exercise-decrypt-error-onion             [Ch 10]
//
// (Chapter 11–12 capstones are integrations, not new exercises.)

export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
  };
  rewardSats: number;
  group: string;
  groupOrder: number;
}

export const ONION_ROUTING_EXERCISES: Record<string, CodeExerciseData> = {
  // Exercises are added as chapters ship.
};
