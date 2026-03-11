import { chromium, expect } from "@playwright/test";
import { provisionLaunchTestLearners } from "./admin-api.ts";
import { enableCodeMode, fetchServerState } from "./helpers.ts";
import { LIGHTNING_EXERCISES } from "../../../client/src/data/lightning-exercises.ts";
import { getExerciseGroupContext } from "../../../client/src/lib/exercise-groups.ts";
import { loginUser, navigateToChapter } from "../helpers.ts";

// Runs one or more production Lightning coding exercises against a fresh provisioned learner.
const baseURL = process.env.PL_PROD_BASE_URL || "https://programminglightning.com";
const defaultPrefix = process.env.PL_SMOKE_PREFIX || process.env.PL_DEBUG_PREFIX || "prod-exercise-smoke";

function getSeedExerciseIds(exerciseId: string): string[] {
  const ctx = getExerciseGroupContext(exerciseId);
  if (!ctx) return [exerciseId];

  const ids = [
    ...ctx.classMethodExercises.map((entry) => entry.id),
    ...ctx.crossGroupExercises.map((entry) => entry.id),
    ...ctx.priorInGroupExercises.map((entry) => entry.id),
    exerciseId,
  ];

  return [...new Set(ids)];
}

interface ExerciseTarget {
  chapterId: string;
  exerciseId: string;
}

function getTargets(): ExerciseTarget[] {
  const sequence = process.env.PL_EXERCISE_SEQUENCE || process.env.PL_DEBUG_SEQUENCE;
  if (!sequence) {
    return [{
      chapterId: process.env.PL_EXERCISE_CHAPTER_ID || process.env.PL_DEBUG_CHAPTER_ID || "channel-keys",
      exerciseId: process.env.PL_EXERCISE_ID || process.env.PL_DEBUG_EXERCISE_ID || "ln-exercise-channel-key-manager",
    }];
  }

  return sequence
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [chapterId, exerciseId] = entry.split(":");
      if (!chapterId || !exerciseId) {
        throw new Error(`Invalid PL_EXERCISE_SEQUENCE entry: ${entry}`);
      }
      return { chapterId, exerciseId };
    });
}

async function seedExercises(page: Parameters<typeof fetchServerState>[0], exerciseId: string) {
  const seedExerciseIds = getSeedExerciseIds(exerciseId);
  const seeds = seedExerciseIds.map((id) => {
    const entry = LIGHTNING_EXERCISES[id];
    if (!entry) {
      throw new Error(`Unknown dependency exercise: ${id}`);
    }
    return {
      exerciseId: id,
      code: entry.hints.code,
    };
  });

  console.log("Seeding exercises:", seedExerciseIds.join(", "));

  await page.evaluate(async ({ seeds }) => {
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token");
    for (const seed of seeds) {
      localStorage.setItem(`pl-exercise-${seed.exerciseId}`, seed.code);
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: `exercise-${seed.exerciseId}`, value: seed.code }),
      });
      if (!response.ok) {
        throw new Error(`Failed to seed exercise progress for ${seed.exerciseId}: ${response.status}`);
      }
    }
  }, { seeds });
}

async function main() {
  const targets = getTargets();
  const prefix = defaultPrefix;

  const { learners } = await provisionLaunchTestLearners(baseURL, 1, prefix);
  const learner = learners[0];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  await enableCodeMode(context);
  const page = await context.newPage();

  try {
    await page.goto("/lightning-tutorial");
    await loginUser(page, learner.email, learner.password);

    for (const target of targets) {
      await runExercise(page, target.chapterId, target.exerciseId);
    }
  } finally {
    await browser.close();
  }
}

async function runExercise(page: Parameters<typeof fetchServerState>[0], chapterId: string, exerciseId: string) {
  console.log(`\n=== ${chapterId} :: ${exerciseId} ===`);
  await navigateToChapter(page, chapterId);

  const exercise = LIGHTNING_EXERCISES[exerciseId];
  if (!exercise) {
    throw new Error(`Unknown exercise: ${exerciseId}`);
  }

  const beforeState = await fetchServerState(page);
  console.log("Checkpoint present before seed:", beforeState.checkpoints.some((cp) => cp.checkpointId === exerciseId));

  await seedExercises(page, exerciseId);

  await page.goto(page.url());
  const header = page.locator("button").filter({ has: page.getByText(exercise.title, { exact: true }) }).first();
  await expect(header).toBeVisible({ timeout: 20_000 });
  await header.click();

  const card = header.locator("..");
  const runButton = card.locator('button:has-text("RUN TESTS")').first();
  await expect(runButton).toBeVisible({ timeout: 20_000 });

  const seededState = await fetchServerState(page);
  console.log("Checkpoint present after seed/reload:", seededState.checkpoints.some((cp) => cp.checkpointId === exerciseId));
  console.log("Before click:", await runButton.textContent());
  await runButton.click();
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.waitForTimeout(2500);
    const state = await fetchServerState(page);
    if (state.checkpoints.some((cp) => cp.checkpointId === exerciseId)) {
      break;
    }
  }
  console.log("After click:", await runButton.textContent());
  console.log("Card text after click:");
  console.log(await card.innerText());

  const serverState = await fetchServerState(page);
  const completed = serverState.checkpoints.some((cp) => cp.checkpointId === exerciseId);
  console.log("Server checkpoint present:", completed);
  if (!completed) {
    throw new Error(`Exercise ${exerciseId} did not complete`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
