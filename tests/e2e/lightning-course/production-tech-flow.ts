import { chromium, expect, type Page } from "@playwright/test";
import { provisionLaunchTestLearners } from "./admin-api.ts";
import {
  enableCodeMode,
  fetchServerState,
  runTrackedGenerator,
  useBitcoinNode,
} from "./helpers.ts";
import { TX_GENERATORS } from "../../../client/src/data/tx-generators.ts";
import {
  loginUser,
  navigateToChapter,
  nodeExec,
  openNodeTerminal,
} from "../helpers.ts";

// Verifies the production Lightning generator + Bitcoin Node flow against a fresh provisioned learner.
const baseURL = process.env.PL_PROD_BASE_URL || "https://programminglightning.com";
const defaultPrefix = process.env.PL_SMOKE_PREFIX || process.env.PL_DEBUG_PREFIX || "prod-tech-flow";

const SIMPLE_HTLC_PARENT_TX =
  "02000000000101a7a015aebdeba2205db63d17c7975ec0e7df930ca28e00fbfeadd1f0266bee080000000000ffffffff01082e0600000000002200208d3ae22e8fb32079a95497ee254f215500ecb1276ab3f46376b9fba4c4b788dd02473044022018f471487aa1fe83d1b9cc646c504de1a914480422c6dd0573684d9d6a2a0f1c0220757feb4134b18caf87fa8947f942a4a5cedffe86e3fa4679eaeedd63fa9dd3750121029141a3333093051ea2ea71445f651d413dd4a75369c887a46bf9f0f036e6ef5600000000";
const SIMPLE_HTLC_CLAIM_TX =
  "020000000001015a69f41bdf1ec310c6aef64902236a56f8810f0336fb5762a96df363eca664200000000000ffffffff01082e0600000000002200208d3ae22e8fb32079a95497ee254f215500ecb1276ab3f46376b9fba4c4b788dd0448304502210083759ddf9f02594cf191f052db565fe2e8fc141044ad9177b16a903c448ae98c022078266e29026228d01d0130a466014b91c5e058b75a4058b7f99cb533d2ab7935011450726f6772616d6d696e674c696768746e696e6701016563a9148e0290d1ea6eca43cbcb422dca5b6e0ce847696d882103cfa114ffa28b97884a028322665093af66bb19b0cf91c81eae46e6bb7fff799aac6702c800b1752102744c609aeee71a07136482b71244a6217b3368431603e1e3994d0c2d226403afac6800000000";
const SIMPLE_HTLC_SCRIPT_HEX =
  "63a9148e0290d1ea6eca43cbcb422dca5b6e0ce847696d882103cfa114ffa28b97884a028322665093af66bb19b0cf91c81eae46e6bb7fff799aac6702c800b1752102744c609aeee71a07136482b71244a6217b3368431603e1e3994d0c2d226403afac68";

async function markCheckpointComplete(page: Page, checkpointId: string) {
  await page.evaluate(async ({ checkpointId }) => {
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token");
    const response = await fetch("/api/checkpoint/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ checkpointId, answer: 0 }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Failed to complete ${checkpointId}: ${response.status} ${body}`);
    }
  }, { checkpointId });
}

async function markManyCheckpoints(page: Page, checkpointIds: string[]) {
  for (const checkpointId of checkpointIds) {
    await markCheckpointComplete(page, checkpointId);
  }
}

async function getNotebookValue(page: Page, key: string): Promise<string> {
  return page.evaluate((storageKey) => localStorage.getItem(`pl-txnotebook-${storageKey}`) || "", key);
}

function getNodePanel(page: Page) {
  return page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
}

async function runNodeCommandExpectText(page: Page, command: string, expected: string, timeout = 20_000) {
  await openNodeTerminal(page);
  const input = page.locator('input[placeholder="type a command..."]').first();
  await expect
    .poll(async () => input.isEnabled(), { timeout: 120_000, intervals: [250, 500, 1000, 2000, 5000] })
    .toBe(true);
  const panel = getNodePanel(page);
  const before = await panel.innerText();
  await nodeExec(page, command);
  try {
    await expect
      .poll(async () => {
        const text = await panel.innerText();
        if (text === before) return false;
        return text.includes(expected);
      }, { timeout, intervals: [500, 1000, 2000] })
      .toBe(true);
  } catch (error) {
    const text = await panel.innerText();
    console.error(`Node command failed: ${command}`);
    console.error("Terminal tail:");
    console.error(text.slice(-4000));
    throw error;
  }
}

async function runNodeCommandExpectRegex(page: Page, command: string, regex: RegExp, timeout = 20_000) {
  await openNodeTerminal(page);
  const input = page.locator('input[placeholder="type a command..."]').first();
  await expect
    .poll(async () => input.isEnabled(), { timeout: 120_000, intervals: [250, 500, 1000, 2000, 5000] })
    .toBe(true);
  const panel = getNodePanel(page);
  const before = await panel.innerText();
  await nodeExec(page, command);
  try {
    await expect
      .poll(async () => {
        const text = await panel.innerText();
        if (text === before) return false;
        const delta = text.slice(before.length);
        return regex.test(delta) || regex.test(text);
      }, { timeout, intervals: [500, 1000, 2000] })
      .toBe(true);
  } catch (error) {
    const text = await panel.innerText();
    console.error(`Node command failed: ${command}`);
    console.error("Terminal tail:");
    console.error(text.slice(-4000));
    throw error;
  }
}

async function runUtilityGenerator(
  page: Page,
  chapterId: string,
  generatorId: "gen-sha256" | "gen-ripemd-sha" | "gen-to-hex",
  inputValue: string,
  expectedText: string
) {
  const generator = TX_GENERATORS[generatorId];
  await navigateToChapter(page, chapterId);
  const header = page.locator("text=" + generator.title).first();
  const card = header.locator("..").locator("..");
  await expect(card).toBeVisible({ timeout: 20_000 });
  const input = card.locator("input").first();
  await input.fill(inputValue);
  await card.locator("button").filter({ hasText: generator.buttonLabel }).first().click();
  await expect(card).toContainText(expectedText, { timeout: 20_000 });
  console.log(`PASS utility ${generatorId}`);
}

async function runTrackedGeneratorInChapter(
  page: Page,
  chapterId: string,
  generatorId: "gen-funding" | "gen-commitment" | "gen-htlc-commitment" | "gen-htlc-timeout",
  requiredExerciseIds: string[] = []
) {
  if (requiredExerciseIds.length > 0) {
    await markManyCheckpoints(page, requiredExerciseIds);
  }
  await navigateToChapter(page, chapterId);
  if (requiredExerciseIds.length > 0) {
    await page.goto(page.url());
    await navigateToChapter(page, chapterId);
  }
  if (generatorId === "gen-funding") {
    await useBitcoinNode(page);
  }
  await expect(page.getByText(TX_GENERATORS[generatorId].title, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await runTrackedGenerator(page, generatorId);
  console.log(`PASS generator ${generatorId}`);
}

async function main() {
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

    // Funding generator + node decode
    await runTrackedGeneratorInChapter(page, "funding-transaction", "gen-funding");
    const fundingTxid = await getNotebookValue(page, "funding-txid");
    const fundingHex = await getNotebookValue(page, "funding-txhex");
    console.log("Funding txid:", fundingTxid);
    await runNodeCommandExpectText(page, `decoderawtransaction ${fundingHex}`, "witness_v0_scripthash");

    // Commitment generator + node decode
    await runTrackedGeneratorInChapter(page, "get-commitment-tx", "gen-commitment");
    const commitmentHex = await getNotebookValue(page, "commitment-refund-txhex");
    await runNodeCommandExpectText(page, `decoderawtransaction ${commitmentHex}`, "witness_v0_keyhash");

    // Open channel Bitcoin Node flow
    await navigateToChapter(page, "open-channel");
    await runNodeCommandExpectText(page, `sendrawtransaction ${fundingHex}`, fundingTxid, 30_000);
    await runNodeCommandExpectText(page, `gettransaction ${fundingTxid}`, "\"confirmations\": 0", 30_000);
    await runNodeCommandExpectRegex(page, "mine 6", /[0-9a-f]{64}/i, 30_000);
    await runNodeCommandExpectText(page, `gettransaction ${fundingTxid}`, "\"confirmations\": 6", 30_000);

    // Simple HTLC walkthrough
    await navigateToChapter(page, "simple-htlc");
    await runNodeCommandExpectText(page, `decoderawtransaction ${SIMPLE_HTLC_PARENT_TX}`, "0.00405");
    await runUtilityGenerator(page, "simple-htlc", "gen-sha256", SIMPLE_HTLC_SCRIPT_HEX, "8d3ae22e8fb32079a95497ee254f215500ecb1276ab3f46376b9fba4c4b788dd");
    await runUtilityGenerator(page, "simple-htlc", "gen-ripemd-sha", "ProgrammingLightning", "8e0290d1ea6eca43cbcb422dca5b6e0ce847696d");
    await runNodeCommandExpectText(page, `decoderawtransaction ${SIMPLE_HTLC_CLAIM_TX}`, "50726f6772616d6d696e674c696768746e696e67");
    await runUtilityGenerator(page, "simple-htlc", "gen-to-hex", "ProgrammingLightning", "50726f6772616d6d696e674c696768746e696e67");
    await runNodeCommandExpectRegex(page, `sendrawtransaction ${SIMPLE_HTLC_CLAIM_TX}`, /[0-9a-f]{64}/i, 30_000);

    // HTLC commitment generator + node decode
    await runTrackedGeneratorInChapter(
      page,
      "get-htlc-commitment",
      "gen-htlc-commitment",
      [
        "ln-exercise-commitment-tx",
        "ln-exercise-htlc-outputs",
        "ln-exercise-finalize-commitment",
      ],
    );
    const htlcCommitmentTxid = await getNotebookValue(page, "commitment-htlc-txid");
    const htlcCommitmentHex = await getNotebookValue(page, "commitment-htlc-txhex");
    await runNodeCommandExpectText(page, `decoderawtransaction ${htlcCommitmentHex}`, "0.00405");

    // HTLC timeout generator + node decode
    await runTrackedGeneratorInChapter(
      page,
      "get-htlc-timeout",
      "gen-htlc-timeout",
      [
        "ln-exercise-htlc-timeout-tx",
        "ln-exercise-finalize-htlc-timeout",
      ],
    );
    const htlcTimeoutTxid = await getNotebookValue(page, "htlc-timeout-txid");
    const htlcTimeoutHex = await getNotebookValue(page, "htlc-timeout-txhex");
    await runNodeCommandExpectText(page, `decoderawtransaction ${htlcTimeoutHex}`, "\"locktime\": 200");

    // Closing flow
    await navigateToChapter(page, "closing-channels");
    await runNodeCommandExpectText(page, `gettxout ${fundingTxid} 0`, "\"value\":");
    await runNodeCommandExpectText(page, `sendrawtransaction ${htlcCommitmentHex}`, htlcCommitmentTxid, 30_000);
    await runNodeCommandExpectRegex(page, "mine 1", /[0-9a-f]{64}/i, 30_000);
    await runNodeCommandExpectText(page, `sendrawtransaction ${htlcTimeoutHex}`, "non-final", 30_000);
    await runNodeCommandExpectRegex(page, "mine 50", /[0-9a-f]{64}/i, 30_000);
    await runNodeCommandExpectText(page, `sendrawtransaction ${htlcTimeoutHex}`, htlcTimeoutTxid, 30_000);

    const state = await fetchServerState(page);
    console.log("Completed checkpoints:", state.checkpoints.map((cp) => cp.checkpointId).sort().join(", "));
    console.log("PASS tech flow");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
