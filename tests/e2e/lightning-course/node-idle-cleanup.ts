import {
  authenticateProvisionedLearner,
  callLearnerNodeRpc,
  fetchLearnerNodeStatus,
  fetchNodeMetrics,
  provisionLearnerBank,
  provisionLearnerNode,
  resetNodeMetrics,
  writeJsonReport,
} from "./load-utils.ts";

interface IdleLearnerReport {
  email: string;
  userId: string;
  runningBeforeIdle: boolean;
  runningAfterIdle: boolean;
  reprovisioned: boolean;
  error?: string;
}

async function main() {
  const baseURL = process.env.PL_PROD_BASE_URL || "https://programminglightning.com";
  if (!process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN) {
    throw new Error("Set PL_NODE_LOAD_TEST_BYPASS_TOKEN before running the idle-cleanup harness.");
  }
  const count = Number.parseInt(process.env.PL_IDLE_TEST_COUNT || "5", 10);
  const prefix = process.env.PL_IDLE_TEST_PREFIX || "idle-cleanup";
  const startedAt = new Date().toISOString();

  await resetNodeMetrics(baseURL);
  const metricsBefore = await fetchNodeMetrics(baseURL);
  const idleTimeoutMs = metricsBefore.nodeMetrics.idleTimeoutMs || 600_000;
  const waitMs = idleTimeoutMs + 120_000;

  const { learners } = await provisionLearnerBank(baseURL, count, prefix);
  const reports: IdleLearnerReport[] = [];

  for (const learner of learners) {
    try {
      const token = await authenticateProvisionedLearner(baseURL, learner);
      await provisionLearnerNode(baseURL, token);
      await callLearnerNodeRpc(baseURL, token, "getblockchaininfo", []);
      const runningBeforeIdle = (await fetchLearnerNodeStatus(baseURL, token)).running;
      reports.push({
        email: learner.email,
        userId: learner.userId,
        runningBeforeIdle,
        runningAfterIdle: false,
        reprovisioned: false,
      });
    } catch (err: any) {
      reports.push({
        email: learner.email,
        userId: learner.userId,
        runningBeforeIdle: false,
        runningAfterIdle: false,
        reprovisioned: false,
        error: err?.message || "Failed to prepare learner node",
      });
    }
  }

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  for (const report of reports) {
    if (report.error) continue;
    try {
      const learner = learners.find((entry) => entry.userId === report.userId)!;
      const token = await authenticateProvisionedLearner(baseURL, learner);
      report.runningAfterIdle = (await fetchLearnerNodeStatus(baseURL, token)).running;
      await provisionLearnerNode(baseURL, token);
      await callLearnerNodeRpc(baseURL, token, "getblockchaininfo", []);
      report.reprovisioned = true;
    } catch (err: any) {
      report.error = err?.message || "Failed to reprovision learner after idle cleanup";
    }
  }

  const report = {
    baseURL,
    count,
    idleTimeoutMs,
    waitedMs: waitMs,
    startedAt,
    completedAt: new Date().toISOString(),
    nodeMetricsBefore: metricsBefore,
    nodeMetricsAfter: await fetchNodeMetrics(baseURL),
    learners: reports,
  };

  await writeJsonReport("node-idle-cleanup-report.json", report);
  console.log(JSON.stringify(report, null, 2));
  if (reports.some((entry) => entry.error || entry.runningAfterIdle || !entry.reprovisioned)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
