import { test, expect } from "@playwright/test";
import {
  authenticateLearner,
  createLocalLearnerCredentials,
  enableCodeMode,
  fetchServerState,
  runTrackedGenerator,
} from "./helpers.ts";
import {
  decodeRawTransaction,
  getTransaction,
  mineBlocks,
  provisionNode,
  sendRawTransaction,
  testMempoolAccept,
} from "./node-api-helpers.ts";
import { navigateToChapter } from "../helpers.ts";

/**
 * Pre-deploy critical path: verifies that the transaction generators produce
 * valid Bitcoin transactions that Bitcoin Core accepts.
 *
 * This uses the real app backend + real per-user regtest node, but calls the
 * node API directly instead of through the terminal UI, so UI flakiness
 * cannot mask transaction-validity bugs.
 */

async function getNotebookValue(page: import("@playwright/test").Page, key: string): Promise<string> {
  return page.evaluate(
    (storageKey) => localStorage.getItem(`pl-txnotebook-${storageKey}`) || "",
    key
  );
}

async function markCheckpointComplete(page: import("@playwright/test").Page, checkpointId: string) {
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

async function markManyCheckpoints(page: import("@playwright/test").Page, ids: string[]) {
  for (const id of ids) {
    await markCheckpointComplete(page, id);
  }
}

test.describe("Lightning critical transaction flow", () => {
  test.setTimeout(10 * 60_000);

  test("generators produce valid transactions accepted by Bitcoin Core", async ({ page }, testInfo) => {
    const environment = testInfo.project.name.includes("production") ? "production" : "local";
    const credentials = createLocalLearnerCredentials();

    await enableCodeMode(page.context());
    await authenticateLearner(page, environment, credentials);

    // ── Provision the Bitcoin node via API ──
    await provisionNode(page);

    // ══════════════════════════════════════════════════════════════════════
    // 1. FUNDING TRANSACTION
    // ══════════════════════════════════════════════════════════════════════
    await navigateToChapter(page, "funding-transaction");
    await runTrackedGenerator(page, "gen-funding");

    const fundingTxid = await getNotebookValue(page, "funding-txid");
    const fundingHex = await getNotebookValue(page, "funding-txhex");
    expect(fundingTxid, "gen-funding should produce a txid").toBeTruthy();
    expect(fundingHex, "gen-funding should produce a raw tx hex").toBeTruthy();

    // Decode and verify structure
    const fundingDecoded = await decodeRawTransaction(page, fundingHex);
    expect(fundingDecoded.txid).toBe(fundingTxid);
    const hasP2WSH = fundingDecoded.vout.some(
      (out: any) => out.scriptPubKey?.type === "witness_v0_scripthash"
    );
    expect(hasP2WSH, "Funding tx should have a P2WSH output").toBe(true);

    // testmempoolaccept — the funding tx should be valid
    const fundingAcceptance = await testMempoolAccept(page, fundingHex);
    expect(fundingAcceptance.allowed, `Funding tx rejected: ${fundingAcceptance["reject-reason"]}`).toBe(true);

    // Broadcast and confirm funding
    const broadcastFundingTxid = await sendRawTransaction(page, fundingHex);
    expect(broadcastFundingTxid).toBe(fundingTxid);

    const unconfirmedTx = await getTransaction(page, fundingTxid);
    expect(unconfirmedTx.confirmations).toBe(0);

    await mineBlocks(page, 6);

    const confirmedTx = await getTransaction(page, fundingTxid);
    expect(confirmedTx.confirmations).toBeGreaterThanOrEqual(6);

    // ══════════════════════════════════════════════════════════════════════
    // 2. COMMITMENT (REFUND) TRANSACTION
    // ══════════════════════════════════════════════════════════════════════
    await navigateToChapter(page, "get-commitment-tx");
    await runTrackedGenerator(page, "gen-commitment");

    const commitmentHex = await getNotebookValue(page, "commitment-refund-txhex");
    expect(commitmentHex, "gen-commitment should produce a raw tx hex").toBeTruthy();

    const commitmentDecoded = await decodeRawTransaction(page, commitmentHex);
    const hasP2WPKH = commitmentDecoded.vout.some(
      (out: any) => out.scriptPubKey?.type === "witness_v0_keyhash"
    );
    expect(hasP2WPKH, "Commitment tx should have a P2WPKH output").toBe(true);

    // ══════════════════════════════════════════════════════════════════════
    // 3. HTLC COMMITMENT TRANSACTION
    // ══════════════════════════════════════════════════════════════════════
    // Mark prerequisite exercises as complete so the generator unlocks
    await markManyCheckpoints(page, [
      "ln-exercise-commitment-tx",
      "ln-exercise-htlc-outputs",
      "ln-exercise-finalize-commitment",
    ]);
    await navigateToChapter(page, "get-htlc-commitment");
    // Reload to pick up checkpoint changes
    await page.goto(page.url());
    await navigateToChapter(page, "get-htlc-commitment");
    await runTrackedGenerator(page, "gen-htlc-commitment");

    const htlcCommitmentTxid = await getNotebookValue(page, "commitment-htlc-txid");
    const htlcCommitmentHex = await getNotebookValue(page, "commitment-htlc-txhex");
    expect(htlcCommitmentTxid, "gen-htlc-commitment should produce a txid").toBeTruthy();
    expect(htlcCommitmentHex, "gen-htlc-commitment should produce a raw tx hex").toBeTruthy();

    const htlcCommitmentDecoded = await decodeRawTransaction(page, htlcCommitmentHex);
    expect(htlcCommitmentDecoded.txid).toBe(htlcCommitmentTxid);

    // testmempoolaccept — HTLC commitment spends the funding output
    const htlcAcceptance = await testMempoolAccept(page, htlcCommitmentHex);
    expect(
      htlcAcceptance.allowed,
      `HTLC commitment tx rejected: ${htlcAcceptance["reject-reason"]}`
    ).toBe(true);

    // Broadcast HTLC commitment
    const broadcastHtlcTxid = await sendRawTransaction(page, htlcCommitmentHex);
    expect(broadcastHtlcTxid).toBe(htlcCommitmentTxid);

    await mineBlocks(page, 1);

    // ══════════════════════════════════════════════════════════════════════
    // 4. HTLC TIMEOUT TRANSACTION
    // ══════════════════════════════════════════════════════════════════════
    await markManyCheckpoints(page, [
      "ln-exercise-htlc-timeout-tx",
      "ln-exercise-finalize-htlc-timeout",
    ]);
    await navigateToChapter(page, "get-htlc-timeout");
    await page.goto(page.url());
    await navigateToChapter(page, "get-htlc-timeout");
    await runTrackedGenerator(page, "gen-htlc-timeout");

    const htlcTimeoutTxid = await getNotebookValue(page, "htlc-timeout-txid");
    const htlcTimeoutHex = await getNotebookValue(page, "htlc-timeout-txhex");
    expect(htlcTimeoutTxid, "gen-htlc-timeout should produce a txid").toBeTruthy();
    expect(htlcTimeoutHex, "gen-htlc-timeout should produce a raw tx hex").toBeTruthy();

    const htlcTimeoutDecoded = await decodeRawTransaction(page, htlcTimeoutHex);
    expect(htlcTimeoutDecoded.txid).toBe(htlcTimeoutTxid);
    expect(htlcTimeoutDecoded.locktime, "HTLC timeout should have locktime 200").toBe(200);

    // Before maturity: should be rejected as non-final
    const earlyAcceptance = await testMempoolAccept(page, htlcTimeoutHex);
    expect(
      earlyAcceptance.allowed,
      "HTLC timeout should be rejected before maturity"
    ).toBe(false);
    expect(earlyAcceptance["reject-reason"]).toMatch(/non-final/);

    // Mine past the CLTV locktime (block 200).
    // The snapshot starts at ~101 blocks. After funding (mine 6) = ~108,
    // after HTLC commitment (mine 1) = ~109. Need ~95 more to reach 200+.
    // Mine in excess to be safe regardless of exact snapshot height.
    await mineBlocks(page, 100);

    // After maturity: should now be accepted
    const matureAcceptance = await testMempoolAccept(page, htlcTimeoutHex);
    expect(
      matureAcceptance.allowed,
      `HTLC timeout still rejected after maturity: ${matureAcceptance["reject-reason"]}`
    ).toBe(true);

    // Broadcast successfully
    const broadcastTimeoutTxid = await sendRawTransaction(page, htlcTimeoutHex);
    expect(broadcastTimeoutTxid).toBe(htlcTimeoutTxid);

    // ══════════════════════════════════════════════════════════════════════
    // Final state check
    // ══════════════════════════════════════════════════════════════════════
    const state = await fetchServerState(page);
    const completedIds = state.checkpoints.map((cp) => cp.checkpointId);
    expect(completedIds).toContain("gen-funding");
    expect(completedIds).toContain("gen-commitment");
    expect(completedIds).toContain("gen-htlc-commitment");
    expect(completedIds).toContain("gen-htlc-timeout");
  });
});
