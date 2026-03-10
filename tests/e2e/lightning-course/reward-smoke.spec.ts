import { test, expect } from "@playwright/test";
import {
  assertQuizRewardClaimed,
  authenticateLearner,
  enableCodeMode,
  ensureLightningAddress,
  fetchServerState,
  getProductionLearnerCredentials,
  getRewardLightningAddress,
  logoutAndLogin,
  persistRunReport,
  recordServerSnapshot,
  type CourseRunReport,
  type LearnerCredentials,
} from "./helpers.ts";
import { provisionLaunchTestLearners } from "./admin-api.ts";
import { navigateToChapter } from "../helpers.ts";

test.describe("Lightning reward smoke", () => {
  test.setTimeout(10 * 60 * 1000);

  test("claims the Lightning quiz reward and preserves it across re-login", async ({ page, baseURL }, testInfo) => {
    test.skip(
      testInfo.project.name !== "production-course" || process.env.PL_REWARD_SMOKE !== "1",
      "Set PL_REWARD_SMOKE=1 to run the dedicated production reward smoke."
    );

    let credentials: LearnerCredentials | null = getProductionLearnerCredentials();
    if (process.env.PL_ADMIN_PASSWORD && process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN) {
      const { learners } = await provisionLaunchTestLearners(baseURL, 1, process.env.PL_LAUNCH_REWARD_PREFIX || "reward-smoke");
      credentials = learners[0];
    }

    test.skip(!credentials, "Provide PL_ADMIN_PASSWORD and PL_NODE_LOAD_TEST_BYPASS_TOKEN, or production learner credentials.");

    const rewardLightningAddress = getRewardLightningAddress();
    const report: CourseRunReport = {
      project: testInfo.project.name,
      environment: "production",
      baseURL: baseURL || "",
      startedAt: new Date().toISOString(),
      learnerEmail: credentials!.email,
      claimRewards: true,
      chapters: [],
      serverSnapshots: [],
      findings: [],
    };

    await enableCodeMode(page.context());
    await authenticateLearner(page, "production", credentials!);

    const initialState = await fetchServerState(page);
    expect(initialState.auth.authenticated).toBe(true);
    expect(initialState.auth.emailVerified).toBe(true);
    expect(initialState.auth.rewardClaimed).toBe(false);

    await ensureLightningAddress(page, rewardLightningAddress);
    await recordServerSnapshot(page, report, "pre-quiz");

    await navigateToChapter(page, "quiz");
    for (let questionIndex = 0; questionIndex < 10; questionIndex++) {
      const answers = [1, 1, 1, 1, 1, 1, 2, 1, 2, 2];
      await page.getByTestId(`button-quiz-option-${questionIndex}-${answers[questionIndex]}`).click();
    }

    await page.getByTestId("button-quiz-submit").click();
    await expect(page.getByTestId("container-quiz-result")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("button-claim-reward").click();
    await assertQuizRewardClaimed(page);
    await recordServerSnapshot(page, report, "post-claim");

    await logoutAndLogin(page, credentials!);
    const reloginState = await fetchServerState(page);
    expect(reloginState.auth.rewardClaimed).toBe(true);
    expect(reloginState.auth.lightningAddress).toBe(rewardLightningAddress);
    await recordServerSnapshot(page, report, "post-relogin");

    await persistRunReport(testInfo, report);
  });
});
