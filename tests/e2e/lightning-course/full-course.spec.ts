import { test, expect } from "@playwright/test";
import {
  assertQuizRewardClaimed,
  assertServerStateContains,
  authenticateLearner,
  completeChapter,
  CourseRunReport,
  createLocalLearnerCredentials,
  enableCodeMode,
  ensureLightningAddress,
  fetchServerState,
  getProductionLearnerCredentials,
  getRewardLightningAddress,
  LearnerCredentials,
  loginFreshContext,
  logoutAndLogin,
  persistRunReport,
  recordServerSnapshot,
} from "./helpers.ts";
import { provisionLaunchTestLearners } from "./admin-api.ts";
import { buildLightningCourseManifest } from "./manifest.ts";

test.describe("Lightning course automation", () => {
  test.setTimeout(30 * 60 * 1000);

  test("completes the Lightning course like a learner", async ({ page, browser, baseURL }, testInfo) => {
    const environment = testInfo.project.name.includes("production") ? "production" : "local";
    const claimRewards = environment === "production" && process.env.PL_CLAIM_REWARDS === "1";
    const productionCredentials = environment === "production" ? getProductionLearnerCredentials() : null;
    const canProvisionProductionLearner = environment === "production" && !!process.env.PL_ADMIN_PASSWORD;

    test.skip(
      environment === "production" && !productionCredentials && !canProvisionProductionLearner,
      "Set PL_ADMIN_PASSWORD or provide PL_PROD_LEARNER_EMAIL and PL_PROD_LEARNER_PASSWORD to run the production course flow."
    );

    let credentials: LearnerCredentials = productionCredentials || createLocalLearnerCredentials();
    if (environment === "production" && canProvisionProductionLearner) {
      const prefix = claimRewards
        ? (process.env.PL_LAUNCH_REWARD_PREFIX || "reward-smoke")
        : (process.env.PL_LAUNCH_TEST_PREFIX || "course-regression");
      const { learners } = await provisionLaunchTestLearners(baseURL, 1, prefix);
      credentials = learners[0];
    }
    const rewardLightningAddress = getRewardLightningAddress();
    const manifest = buildLightningCourseManifest();

    const report: CourseRunReport = {
      project: testInfo.project.name,
      environment,
      baseURL: baseURL || "",
      startedAt: new Date().toISOString(),
      learnerEmail: credentials.email,
      claimRewards,
      chapters: [],
      serverSnapshots: [],
      findings: [],
    };

    await enableCodeMode(page.context());
    await authenticateLearner(page, environment, credentials);

    const initialState = await fetchServerState(page);
    expect(initialState.auth.authenticated).toBe(true);
    expect(initialState.checkpoints, "Launch-regression learner should start clean").toHaveLength(0);
    expect(Object.keys(initialState.progress), "Launch-regression learner should start without saved progress").toHaveLength(0);
    if (environment === "production") {
      expect(initialState.auth.emailVerified).toBe(true);
      expect(initialState.auth.rewardClaimed).toBe(false);
      if (claimRewards) {
        await ensureLightningAddress(page, rewardLightningAddress);
      }
    }

    await recordServerSnapshot(page, report, "post-auth");

    const expectedCheckpointIds = new Set<string>(initialState.checkpoints.map((cp) => cp.checkpointId));
    const expectedProgressKeys = new Set<string>(Object.keys(initialState.progress));
    const midpoint = Math.floor(manifest.length / 2) - 1;

    for (let index = 0; index < manifest.length; index++) {
      const chapter = manifest[index];
      const chapterReport = await completeChapter(
        page,
        chapter,
        claimRewards,
        expectedCheckpointIds,
        expectedProgressKeys
      );
      report.chapters.push(chapterReport);

      for (const checkpointId of chapterReport.completedCheckpointIds) {
        expectedCheckpointIds.add(checkpointId);
      }
      for (const progressKey of chapterReport.completedProgressKeys) {
        expectedProgressKeys.add(progressKey);
      }

      await assertServerStateContains(page, expectedCheckpointIds, expectedProgressKeys);

      if (index === midpoint) {
        await recordServerSnapshot(page, report, `midpoint-before-logout:${chapter.id}`);
        await logoutAndLogin(page, credentials);
        if (claimRewards) {
          const state = await fetchServerState(page);
          expect(state.auth.lightningAddress).toBe(rewardLightningAddress);
        }
        await assertServerStateContains(page, expectedCheckpointIds, expectedProgressKeys);
        await recordServerSnapshot(page, report, `midpoint-after-login:${chapter.id}`);
      }
    }

    if (claimRewards) {
      await assertQuizRewardClaimed(page);
    }

    await recordServerSnapshot(page, report, "final-main-context");

    const { context: freshContext, page: freshPage } = await loginFreshContext(
      browser,
      environment,
      credentials
    );

    try {
      await assertServerStateContains(freshPage, expectedCheckpointIds, expectedProgressKeys);
      const freshState = await fetchServerState(freshPage);
      expect(freshState.auth.authenticated).toBe(true);
      if (claimRewards) {
        expect(freshState.auth.emailVerified).toBe(true);
        expect(freshState.auth.lightningAddress).toBe(rewardLightningAddress);
        expect(freshState.auth.rewardClaimed).toBe(true);
      }
      await recordServerSnapshot(freshPage, report, "fresh-context");
    } finally {
      await freshContext.close();
    }

    await persistRunReport(testInfo, report);
  });
});
