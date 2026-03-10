import { Browser, BrowserContext, expect, Locator, Page, TestInfo } from "@playwright/test";
import fs from "fs/promises";
import { MATCH_DATA } from "../../../client/src/components/DragDropExercise.tsx";
import { LIGHTNING_EXERCISES } from "../../../client/src/data/lightning-exercises.ts";
import { TX_GENERATORS } from "../../../client/src/data/tx-generators.ts";
import {
  CHECKPOINT_QUESTIONS,
  QUIZ_QUESTIONS,
} from "../../../client/src/pages/lightning-tutorial.tsx";
import {
  loginUser,
  logoutUser,
  navigateToChapter,
  nodeExec,
  openNodeTerminal,
  registerUser,
} from "../helpers.ts";
import {
  CourseChapterManifest,
  expectedCheckpointIdsForChapter,
  expectedProgressKeysForChapter,
} from "./manifest.ts";

export interface LearnerCredentials {
  email: string;
  password: string;
}

export interface ServerCheckpointState {
  checkpointId: string;
  amountSats: number;
  paidAt: string;
}

export interface ServerState {
  auth: {
    authenticated: boolean;
    userId?: string | null;
    emailVerified?: boolean;
    rewardClaimed?: boolean;
    lightningAddress?: string | null;
  };
  checkpoints: ServerCheckpointState[];
  progress: Record<string, string>;
  sessionToken: string | null;
}

export interface CourseChapterReport {
  id: string;
  title: string;
  visited: boolean;
  textLength: number;
  detailsExpanded: number;
  imagesLoaded: number;
  completedCheckpointIds: string[];
  completedProgressKeys: string[];
}

export interface CourseRunReport {
  project: string;
  environment: "local" | "production";
  baseURL: string;
  startedAt: string;
  completedAt?: string;
  learnerEmail: string;
  claimRewards: boolean;
  chapters: CourseChapterReport[];
  serverSnapshots: Array<{
    label: string;
    auth: ServerState["auth"];
    checkpointIds: string[];
    paidCheckpointIds: string[];
    progressKeys: string[];
  }>;
  findings: string[];
}

export async function enableCodeMode(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem("pl-ln-tutorial-mode", "code");
  });
}

export function createLocalLearnerCredentials(): LearnerCredentials {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `lightning-course-${suffix}@test.com`,
    password: `Course-${suffix}`,
  };
}

export function getProductionLearnerCredentials(): LearnerCredentials | null {
  const email = process.env.PL_PROD_LEARNER_EMAIL;
  const password = process.env.PL_PROD_LEARNER_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export function getRewardLightningAddress(): string {
  return process.env.PL_REWARD_LIGHTNING_ADDRESS || "therealaustin@primal.net";
}

export async function authenticateLearner(
  page: Page,
  environment: "local" | "production",
  credentials: LearnerCredentials
) {
  await page.goto("/lightning-tutorial");
  await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 20_000 });

  if (environment === "local") {
    await registerUser(page, credentials.email, credentials.password);
    return;
  }

  await loginUser(page, credentials.email, credentials.password);
}

export async function reauthenticateLearner(page: Page, credentials: LearnerCredentials) {
  await loginUser(page, credentials.email, credentials.password);
}

export async function ensureLightningAddress(page: Page, lightningAddress: string) {
  await page.getByTestId("button-profile").click();
  const dropdown = page.getByTestId("container-profile-dropdown");
  await expect(dropdown).toBeVisible({ timeout: 5_000 });

  if (await dropdown.getByText(lightningAddress).count()) {
    await page.keyboard.press("Escape");
    return;
  }

  if (await dropdown.getByTestId("button-edit-lightning-address").count()) {
    await dropdown.getByTestId("button-edit-lightning-address").click();
  } else {
    await dropdown.getByTestId("button-add-lightning-address").click();
  }

  await page.getByTestId("input-lightning-address").fill(lightningAddress);
  await page.getByTestId("button-save-lightning-address").click();
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.auth.lightningAddress;
    }, { timeout: 20_000, intervals: [500, 1000, 2000] })
    .toBe(lightningAddress);
  await page.keyboard.press("Escape");
}

export async function fetchServerState(page: Page): Promise<ServerState> {
  return page.evaluate(async () => {
    const token = localStorage.getItem("pl-session-token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const auth = await fetch("/api/auth/verify", { headers }).then((res) => res.json());
    const checkpoints = token
      ? await fetch("/api/checkpoint/status", { headers }).then((res) => res.json())
      : { completed: [] };
    const progress = token
      ? await fetch("/api/progress", { headers }).then((res) => res.ok ? res.json() : { progress: {} })
      : { progress: {} };

    return {
      auth,
      checkpoints: checkpoints.completed || [],
      progress: progress.progress || {},
      sessionToken: token,
    };
  });
}

export async function recordServerSnapshot(
  page: Page,
  report: CourseRunReport,
  label: string
) {
  const state = await fetchServerState(page);
  report.serverSnapshots.push({
    label,
    auth: state.auth,
    checkpointIds: state.checkpoints.map((cp) => cp.checkpointId).sort(),
    paidCheckpointIds: state.checkpoints
      .filter((cp) => cp.amountSats > 0)
      .map((cp) => cp.checkpointId)
      .sort(),
    progressKeys: Object.keys(state.progress).sort(),
  });
}

export async function assertServerStateContains(
  page: Page,
  expectedCheckpointIds: Iterable<string>,
  expectedProgressKeys: Iterable<string>
) {
  const checkpointIds = [...expectedCheckpointIds];
  const progressKeys = [...expectedProgressKeys];

  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      const completed = new Set(state.checkpoints.map((cp) => cp.checkpointId));
      const progress = new Set(Object.keys(state.progress));
      return checkpointIds.every((id) => completed.has(id)) &&
        progressKeys.every((key) => progress.has(key));
    }, { timeout: 20_000, intervals: [500, 1000, 2000] })
    .toBe(true);
}

export async function assertCheckpointRewardClaimed(page: Page, checkpointId: string) {
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.checkpoints.find((cp) => cp.checkpointId === checkpointId)?.amountSats || 0;
    }, { timeout: 30_000, intervals: [1000, 2000, 3000] })
    .toBeGreaterThan(0);
}

export async function assertChapterReadSaved(page: Page, chapterId: string) {
  const progressKey = `chapter-read:${chapterId}`;
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.progress[progressKey] || null;
    }, { timeout: 15_000, intervals: [500, 1000, 2000] })
    .toBe("1");
}

export async function assertQuizRewardClaimed(page: Page) {
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return !!state.auth.rewardClaimed;
    }, { timeout: 30_000, intervals: [1000, 2000, 3000] })
    .toBe(true);
}

export async function assertArticleRendered(page: Page, chapter: CourseChapterManifest) {
  const article = page.getByTestId("container-article");
  await expect(article).toBeVisible({ timeout: 15_000 });
  const text = await article.innerText();
  expect(text.length, `${chapter.id} should render meaningful article text`).toBeGreaterThan(40);
}

export async function assertChapterImagesLoaded(page: Page): Promise<number> {
  const article = page.getByTestId("container-article");
  const count = await article.locator("img").count();
  if (count === 0) return 0;

  await expect
    .poll(async () => {
      const imageStatuses = await article.locator("img").evaluateAll((elements) =>
        elements.map((element) => ({
          complete: (element as HTMLImageElement).complete,
          naturalWidth: (element as HTMLImageElement).naturalWidth,
        }))
      );
      return imageStatuses.every((status) => status.complete && status.naturalWidth > 0);
    }, {
      timeout: 20_000,
      intervals: [500, 1000, 2000],
    })
    .toBe(true);

  const statuses = await article.locator("img").evaluateAll((elements) =>
    elements.map((element) => ({
      src: (element as HTMLImageElement).src,
      complete: (element as HTMLImageElement).complete,
      naturalWidth: (element as HTMLImageElement).naturalWidth,
    }))
  );

  for (const status of statuses) {
    expect(status.complete, `Image did not finish loading: ${status.src}`).toBe(true);
    expect(status.naturalWidth, `Image did not render successfully: ${status.src}`).toBeGreaterThan(0);
  }

  return count;
}

export async function expandAllDetails(page: Page): Promise<number> {
  const article = page.getByTestId("container-article");
  const summaries = article.locator("summary");
  const count = await summaries.count();

  for (let index = 0; index < count; index++) {
    await summaries.nth(index).click();
  }

  return count;
}

function getCheckpointContainer(page: Page, checkpointIndex: number): Locator {
  return page.locator('button:has-text("CHECKPOINT")').nth(checkpointIndex).locator("..");
}

function getExerciseContainer(page: Page, exerciseIndex: number): Locator {
  return page.locator('button:has-text("EXERCISE")').nth(exerciseIndex).locator("..");
}

async function openCheckpointContainer(page: Page, checkpointIndex: number): Promise<Locator> {
  const header = page.locator('button:has-text("CHECKPOINT")').nth(checkpointIndex);
  await expect(header).toBeVisible({ timeout: 15_000 });
  await header.scrollIntoViewIfNeeded();
  await header.click();
  return getCheckpointContainer(page, checkpointIndex);
}

async function openExerciseContainer(page: Page, exerciseIndex: number): Promise<Locator> {
  const header = page.locator('button:has-text("EXERCISE")').nth(exerciseIndex);
  await expect(header).toBeVisible({ timeout: 15_000 });
  await header.scrollIntoViewIfNeeded();
  await header.click();
  return getExerciseContainer(page, exerciseIndex);
}

async function getInlineDragDropContainer(page: Page): Promise<Locator> {
  const label = page.getByText("MATCH THE TOOLS", { exact: true }).first();
  await expect(label).toBeVisible({ timeout: 15_000 });
  return label.locator("..");
}

async function clickButtonByContainedText(scope: Locator, text: string) {
  const button = scope.locator("button").filter({ hasText: text }).first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

async function seedExerciseCode(page: Page, exerciseId: string, code: string) {
  await page.evaluate(async ({ exerciseId, code }) => {
    localStorage.setItem(`pl-exercise-${exerciseId}`, code);
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token while seeding exercise code");
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key: `exercise-${exerciseId}`, value: code }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to save exercise progress for ${exerciseId}: ${response.status} ${body}`);
    }
  }, { exerciseId, code });
}

async function replaceScopedEditorContent(page: Page, scope: Locator, text: string) {
  const editor = scope.locator(".cm-content").first();
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(text, { delay: 2 });
}

async function waitForScopedRunButton(scope: Locator) {
  await scope.locator('button:has-text("RUN TESTS")').first().waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

async function invokeScopedReactClick(scope: Locator, text: string): Promise<boolean> {
  const button = scope.locator("button").filter({ hasText: text }).first();
  return button.evaluate(async (el) => {
    const reactPropsKey = Object.getOwnPropertyNames(el).find((name) => name.startsWith("__reactProps$"));
    if (!reactPropsKey) return false;
    const props = (el as Record<string, unknown>)[reactPropsKey] as { onClick?: (event: unknown) => unknown } | undefined;
    if (typeof props?.onClick !== "function") return false;
    props.onClick({
      preventDefault() {},
      stopPropagation() {},
      currentTarget: el,
      target: el,
      nativeEvent: new MouseEvent("click", { bubbles: true, cancelable: true }),
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    return true;
  }).catch(() => false);
}

async function triggerScopedRun(page: Page, scope: Locator) {
  const runButton = scope.locator('button:has-text("RUN TESTS")').first();
  const started = async () => {
    const runningButton = scope.locator('button:has-text("RUNNING..."), button:has-text("LOADING PYTHON..."), button:has-text("DOWNLOADING PYTHON...")').first();
    const passedBanner = scope.getByText("ALL TESTS PASSED!", { exact: true });
    return Promise.race([
      runningButton.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false),
      passedBanner.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false),
    ]);
  };

  await runButton.click();
  if (await started()) return;

  await runButton.focus();
  await page.keyboard.press("Enter");
  if (await started()) return;

  if (await invokeScopedReactClick(scope, "RUN TESTS")) {
    if (await started()) return;
  }

  throw new Error("Exercise run did not start after clicking RUN TESTS");
}

export async function completeDragDropExercise(
  page: Page,
  _checkpointIndex: number,
  claimRewards: boolean
) {
  const container = await getInlineDragDropContainer(page);
  for (const item of MATCH_DATA) {
    await clickButtonByContainedText(container, item.definition);
    await container.getByText(item.label, { exact: true }).click();
  }
  await clickButtonByContainedText(container, "CHECK ANSWERS");
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.checkpoints.some((cp) => cp.checkpointId === "course-tools-match");
    }, { timeout: 15_000, intervals: [500, 1000, 2000] })
    .toBe(true);
  if (claimRewards) {
    await assertCheckpointRewardClaimed(page, "course-tools-match");
  }
}

export async function completeSingleCheckpoint(
  page: Page,
  checkpointIndex: number,
  checkpointId: string,
  claimRewards: boolean
) {
  const container = await openCheckpointContainer(page, checkpointIndex);
  const checkpoint = CHECKPOINT_QUESTIONS[checkpointId];
  await clickButtonByContainedText(container, checkpoint.options[checkpoint.answer]);
  await clickButtonByContainedText(container, "SUBMIT ANSWER");
  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.checkpoints.some((cp) => cp.checkpointId === checkpointId);
    }, { timeout: 15_000, intervals: [500, 1000, 2000] })
    .toBe(true);
  if (claimRewards) {
    await assertCheckpointRewardClaimed(page, checkpointId);
  }
}

export async function completeCheckpointGroup(
  page: Page,
  checkpointIndex: number,
  groupId: string,
  questionIds: string[],
  claimRewards: boolean
) {
  const container = await openCheckpointContainer(page, checkpointIndex);
  for (const questionId of questionIds) {
    const question = CHECKPOINT_QUESTIONS[questionId];
    await clickButtonByContainedText(container, question.options[question.answer]);
  }
  await clickButtonByContainedText(container, "SUBMIT ANSWERS");

  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      const completed = new Set(state.checkpoints.map((cp) => cp.checkpointId));
      return [groupId, ...questionIds].every((id) => completed.has(id));
    }, { timeout: 15_000, intervals: [500, 1000, 2000] })
    .toBe(true);

  if (claimRewards) {
    await assertCheckpointRewardClaimed(page, groupId);
  }
}

export async function completeExercise(
  page: Page,
  exerciseIndex: number,
  exerciseId: string,
  claimRewards: boolean
) {
  const exercise = LIGHTNING_EXERCISES[exerciseId];
  await seedExerciseCode(page, exerciseId, exercise.hints.code);
  await page.goto(page.url());
  await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 20_000 });

  const container = await openExerciseContainer(page, exerciseIndex);
  await waitForScopedRunButton(container);
  await triggerScopedRun(page, container);
  await expect
    .poll(async () => {
      const body = await container.innerText();
      const passMatch = body.match(/(\d+)\/(\d+) passed/);
      if (passMatch && passMatch[1] === passMatch[2] && Number(passMatch[1]) > 0) {
        return "passed";
      }
      const state = await fetchServerState(page);
      if (state.checkpoints.some((cp) => cp.checkpointId === exerciseId)) {
        return "checkpoint";
      }
      return null;
    }, { timeout: 120_000, intervals: [1000, 2000, 5000] })
    .not.toBeNull();

  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.checkpoints.some((cp) => cp.checkpointId === exerciseId);
    }, { timeout: 15_000, intervals: [500, 1000, 2000] })
    .toBe(true);

  if (claimRewards) {
    await assertCheckpointRewardClaimed(page, exerciseId);
  }
}

export async function runTrackedGenerator(page: Page, generatorId: string): Promise<void> {
  const config = TX_GENERATORS[generatorId];
  const title = config.title;
  const card = page.locator(`text=${title}`).first().locator("..").locator("..");
  const action = card.locator(
    'button:has-text("Generate"), button:has-text("Get Transaction"), button:has-text("Calculate")'
  ).first();
  await action.scrollIntoViewIfNeeded();
  await action.click();

  if (config.notebookSaves?.length) {
    await expect
      .poll(async () =>
        page.evaluate((keys) => {
          return keys.every((key) => !!localStorage.getItem(`pl-txnotebook-${key}`));
        }, config.notebookSaves!.map((entry) => entry.key)),
      { timeout: 120_000, intervals: [1000, 2000, 5000] })
      .toBe(true);
  }

  await expect
    .poll(async () => {
      const state = await fetchServerState(page);
      return state.checkpoints.some((cp) => cp.checkpointId === generatorId);
    }, { timeout: 60_000, intervals: [1000, 2000, 5000] })
    .toBe(true);
}

export async function useBitcoinNode(page: Page) {
  await openNodeTerminal(page);
  await nodeExec(page, "getblockcount");
  const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
  await expect(terminalPanel).toContainText(/\d+/, { timeout: 15_000 });
}

export async function completeQuiz(page: Page, claimRewards: boolean) {
  for (let questionIndex = 0; questionIndex < QUIZ_QUESTIONS.length; questionIndex++) {
    const question = QUIZ_QUESTIONS[questionIndex];
    await page.getByTestId(`button-quiz-option-${questionIndex}-${question.answer}`).click();
  }

  await page.getByTestId("button-quiz-submit").click();
  await expect(page.getByTestId("container-quiz-result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("text-quiz-result-title")).toContainText("CONGRATULATIONS");

  if (claimRewards) {
    await expect(page.getByTestId("button-claim-reward")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("button-claim-reward").click();
    await assertQuizRewardClaimed(page);
  }
}

export async function completeChapter(
  page: Page,
  chapter: CourseChapterManifest,
  claimRewards: boolean,
  existingCheckpointIds: Set<string> = new Set(),
  existingProgressKeys: Set<string> = new Set()
): Promise<CourseChapterReport> {
  await navigateToChapter(page, chapter.id);
  await assertArticleRendered(page, chapter);

  const detailsExpanded = await expandAllDetails(page);
  const imagesLoaded = await assertChapterImagesLoaded(page);
  const articleText = await page.getByTestId("container-article").innerText();

  const completedCheckpointIds: string[] = [];
  const completedProgressKeys: string[] = [];
  let checkpointIndex = 0;
  let exerciseIndex = 0;
  let nodeUsed = false;

  for (const block of chapter.blocks) {
    if (block.type === "drag-drop") {
      if (!existingCheckpointIds.has(block.id)) {
        await completeDragDropExercise(page, checkpointIndex, claimRewards);
      }
      completedCheckpointIds.push(block.id);
      checkpointIndex += 1;
      continue;
    }
    if (block.type === "checkpoint") {
      if (!existingCheckpointIds.has(block.id)) {
        await completeSingleCheckpoint(page, checkpointIndex, block.id, claimRewards);
      }
      completedCheckpointIds.push(block.id);
      checkpointIndex += 1;
      continue;
    }
    if (block.type === "checkpoint-group") {
      const alreadyCompleted = [block.id, ...block.questionIds]
        .every((id) => existingCheckpointIds.has(id));
      if (!alreadyCompleted) {
        await completeCheckpointGroup(page, checkpointIndex, block.id, block.questionIds, claimRewards);
      }
      completedCheckpointIds.push(block.id, ...block.questionIds);
      checkpointIndex += 1;
      continue;
    }
    if (block.type === "exercises") {
      for (const exerciseId of block.exerciseIds) {
        if (!existingCheckpointIds.has(exerciseId)) {
          await completeExercise(page, exerciseIndex, exerciseId, claimRewards);
        }
        completedCheckpointIds.push(exerciseId);
        exerciseIndex += 1;
      }
      continue;
    }
    if (block.type === "generator") {
      if (!nodeUsed && block.id === "gen-funding" && !existingCheckpointIds.has(block.id)) {
        await useBitcoinNode(page);
        nodeUsed = true;
      }
      if (!existingCheckpointIds.has(block.id)) {
        await runTrackedGenerator(page, block.id);
        completedCheckpointIds.push(block.id);
      } else {
        completedCheckpointIds.push(block.id);
      }
    }
  }

  if (chapter.isReadOnly) {
    const progressKey = `chapter-read:${chapter.id}`;
    if (!existingProgressKeys.has(progressKey)) {
      const markReadButton = page.locator('button:has-text("MARK AS READ")').first();
      await markReadButton.scrollIntoViewIfNeeded();
      await markReadButton.click();
      await assertChapterReadSaved(page, chapter.id);
    }
    completedProgressKeys.push(`chapter-read:${chapter.id}`);
  }

  if (chapter.id === "quiz") {
    await completeQuiz(page, claimRewards);
  }

  return {
    id: chapter.id,
    title: chapter.title,
    visited: true,
    textLength: articleText.length,
    detailsExpanded,
    imagesLoaded,
    completedCheckpointIds,
    completedProgressKeys,
  };
}

export function collectExpectedCheckpointIds(chapters: CourseChapterManifest[], throughIndex?: number): Set<string> {
  const ids = new Set<string>();
  const limit = throughIndex === undefined ? chapters.length - 1 : throughIndex;
  for (let index = 0; index <= limit; index++) {
    for (const id of expectedCheckpointIdsForChapter(chapters[index])) {
      ids.add(id);
    }
  }
  return ids;
}

export function collectExpectedProgressKeys(chapters: CourseChapterManifest[], throughIndex?: number): Set<string> {
  const keys = new Set<string>();
  const limit = throughIndex === undefined ? chapters.length - 1 : throughIndex;
  for (let index = 0; index <= limit; index++) {
    for (const key of expectedProgressKeysForChapter(chapters[index])) {
      keys.add(key);
    }
  }
  return keys;
}

export async function persistRunReport(
  testInfo: TestInfo,
  report: CourseRunReport
) {
  report.completedAt = new Date().toISOString();
  const json = JSON.stringify(report, null, 2);
  const reportPath = testInfo.outputPath("lightning-course-report.json");
  await fs.writeFile(reportPath, json, "utf8");
  await testInfo.attach("lightning-course-report", {
    body: json,
    contentType: "application/json",
  });
}

export async function loginFreshContext(
  browser: Browser,
  environment: "local" | "production",
  credentials: LearnerCredentials
) {
  const context = await browser.newContext();
  await enableCodeMode(context);
  const page = await context.newPage();
  await authenticateLearner(page, environment, credentials);
  return { context, page };
}

export async function logoutAndLogin(page: Page, credentials: LearnerCredentials) {
  await logoutUser(page);
  await reauthenticateLearner(page, credentials);
}
