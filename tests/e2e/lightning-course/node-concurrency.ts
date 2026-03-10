import {
  fetchNodeMetrics,
  provisionLearnerBank,
  resetNodeMetrics,
  runNodeScenario,
  summarizeStage,
  writeJsonReport,
  type UserNodeRun,
} from "./load-utils.ts";

interface StageReport {
  stage: number;
  prefix: string;
  startedAt: string;
  completedAt: string;
  users: UserNodeRun[];
  summary: ReturnType<typeof summarizeStage>;
  gateFailures: string[];
}

async function main() {
  const baseURL = process.env.PL_PROD_BASE_URL || "https://programminglightning.com";
  const basePrefix = process.env.PL_LAUNCH_TEST_PREFIX || "loadtest";
  if (!process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN) {
    throw new Error("Set PL_NODE_LOAD_TEST_BYPASS_TOKEN before running the production concurrency harness.");
  }
  const stages = (process.env.PL_LOAD_TEST_STAGES || "5,10,20")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
  const stopOnDirtyStage = process.env.PL_STOP_ON_DIRTY_STAGE !== "0";

  const report = {
    baseURL,
    startedAt: new Date().toISOString(),
    stages: [] as StageReport[],
    nodeMetricsBefore: await fetchNodeMetrics(baseURL),
    nodeMetricsAfter: null as Awaited<ReturnType<typeof fetchNodeMetrics>> | null,
  };

  await resetNodeMetrics(baseURL);
  let failedGate = false;

  for (const stage of stages) {
    const prefix = `${basePrefix}-${stage}`;
    const { learners } = await provisionLearnerBank(baseURL, stage, prefix);
    const startedAt = new Date().toISOString();
    const users = await Promise.all(learners.map((learner) => runNodeScenario(baseURL, learner)));
    const summary = summarizeStage(users);
    const gateFailures: string[] = [];
    const provisionP95 = summary.operations.provision?.p95Ms || 0;
    const listUnspentP95 = summary.operations.listunspent?.p95Ms || 0;
    const fundingP95 = summary.operations.fundingChain?.p95Ms || 0;

    if (summary.failureRate > 0.02) gateFailures.push(`failureRate=${summary.failureRate}`);
    if (summary.timeoutCount > 0) gateFailures.push(`timeoutCount=${summary.timeoutCount}`);
    if (provisionP95 > 30_000) gateFailures.push(`provisionP95=${provisionP95}`);
    if (listUnspentP95 > 20_000) gateFailures.push(`listunspentP95=${listUnspentP95}`);
    if (fundingP95 > 45_000) gateFailures.push(`fundingChainP95=${fundingP95}`);

    report.stages.push({
      stage,
      prefix,
      startedAt,
      completedAt: new Date().toISOString(),
      users,
      summary,
      gateFailures,
    });

    if (gateFailures.length > 0) {
      failedGate = true;
    }

    if (stopOnDirtyStage && gateFailures.length > 0) {
      break;
    }
  }

  report.nodeMetricsAfter = await fetchNodeMetrics(baseURL);
  await writeJsonReport("node-concurrency-report.json", report);
  console.log(JSON.stringify(report, null, 2));
  if (failedGate) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
