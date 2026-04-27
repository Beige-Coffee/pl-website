import fs from "fs/promises";
import path from "path";
import * as secp256k1 from "@noble/secp256k1";
import {
  fetchAdminNodeMetrics,
  getNodeLoadTestHeaders,
  provisionLaunchTestLearners,
  resetAdminNodeMetrics,
  type ProvisionedLearner,
} from "./admin-api.ts";

export interface TimedOperation {
  ok: boolean;
  ms: number;
  error?: string;
  status?: number;
}

export interface UserNodeRun {
  email: string;
  userId: string;
  login: TimedOperation;
  provision: TimedOperation;
  rpc: Record<string, TimedOperation>;
  fundingChain: TimedOperation;
  success: boolean;
  errors: string[];
}

export interface StageSummary {
  count: number;
  failureRate: number;
  statusCounts: Record<string, number>;
  timeoutCount: number;
  operations: Record<string, {
    samples: number;
    successCount: number;
    failureCount: number;
    p50Ms: number;
    p95Ms: number;
    maxMs: number;
  }>;
}

class HttpError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export const LOAD_TEST_ALICE_PUBKEY = Buffer.from(
  secp256k1.getPublicKey(Buffer.from("1".repeat(64), "hex"), true)
).toString("hex");

export const LOAD_TEST_BOB_PUBKEY = Buffer.from(
  secp256k1.getPublicKey(Buffer.from("2".repeat(64), "hex"), true)
).toString("hex");

const FUNDING_AMOUNT_BTC = 0.05;
const REQUEST_TIMEOUT_MS = 180_000;

const SNAPSHOT_WIF = "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA";
const SNAPSHOT_ADDRESS = "bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080";
const SNAPSHOT_SCRIPTPUBKEY = "0014751e76e8199196d454941c45d1b3a323f1433bd6";
const SNAPSHOT_DESCRIPTOR = "wpkh(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)";

interface ScantxoutsetUtxo {
  txid: string;
  vout: number;
  amount: number;
  coinbase: boolean;
  scriptPubKey: string;
  height: number;
}

function normalizeBaseUrl(baseURL?: string): string {
  return (baseURL || process.env.PL_PROD_BASE_URL || "https://programminglightning.com").replace(/\/$/, "");
}

export async function writeJsonReport(filename: string, report: unknown) {
  const outputDir = path.resolve(process.cwd(), "test-results", "lightning-course");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, filename), JSON.stringify(report, null, 2), "utf8");
}

export async function provisionLearnerBank(baseURL: string | undefined, count: number, prefix: string) {
  return provisionLaunchTestLearners(baseURL, count, prefix);
}

export async function resetNodeMetrics(baseURL?: string) {
  await resetAdminNodeMetrics(baseURL);
}

export async function fetchNodeMetrics(baseURL?: string) {
  return fetchAdminNodeMetrics(baseURL);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; op: TimedOperation }> {
  const startedAt = Date.now();
  try {
    const value = await fn();
    return {
      value,
      op: {
        ok: true,
        ms: Date.now() - startedAt,
      },
    };
  } catch (err: any) {
    return {
      op: {
        ok: false,
        ms: Date.now() - startedAt,
        error: err?.message || "Unknown error",
        status: typeof err?.status === "number" ? err.status : undefined,
      },
    };
  }
}

async function loginLearner(baseURL: string, learner: ProvisionedLearner): Promise<{ token: string }> {
  const response = await fetch(`${baseURL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: learner.email,
      password: learner.password,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.sessionToken) {
    throw new HttpError(body.error || `Login failed: HTTP ${response.status}`, response.status);
  }
  return { token: body.sessionToken as string };
}

async function nodeProvision(baseURL: string, token: string): Promise<void> {
  const response = await fetch(`${baseURL}/api/node/status?provision=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNodeLoadTestHeaders(),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new HttpError(body.error || `Node provision failed: HTTP ${response.status}`, response.status);
  }
}

async function nodeRpc<T>(baseURL: string, token: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(`${baseURL}/api/node/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...getNodeLoadTestHeaders(),
    },
    body: JSON.stringify({ method, params }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new HttpError(body.error || `${method} failed: HTTP ${response.status}`, response.status);
  }
  return body.result as T;
}

export async function authenticateProvisionedLearner(baseURL: string, learner: ProvisionedLearner): Promise<string> {
  const { token } = await loginLearner(baseURL, learner);
  return token;
}

export async function provisionLearnerNode(baseURL: string, token: string): Promise<void> {
  await nodeProvision(baseURL, token);
}

export async function fetchLearnerNodeStatus(baseURL: string, token: string): Promise<{ running: boolean }> {
  const response = await fetch(`${baseURL}/api/node/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getNodeLoadTestHeaders(),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(body.error || `Node status failed: HTTP ${response.status}`);
  }
  return body as { running: boolean };
}

export async function callLearnerNodeRpc<T>(baseURL: string, token: string, method: string, params: unknown[]): Promise<T> {
  return nodeRpc<T>(baseURL, token, method, params);
}

const COINBASE_MATURITY = 100;

function selectFundingUtxo(unspent: ScantxoutsetUtxo[], currentHeight: number): ScantxoutsetUtxo | null {
  const mature = unspent.filter((utxo) =>
    typeof utxo.txid === "string" &&
    Number.isInteger(utxo.vout) &&
    typeof utxo.amount === "number" &&
    (!utxo.coinbase || (currentHeight - utxo.height) >= COINBASE_MATURITY)
  );
  // Prefer exact 0.05 BTC UTXO (pre-split in snapshot) for clean 1-in/1-out tx
  const exact = mature.find((utxo) => utxo.amount === FUNDING_AMOUNT_BTC);
  if (exact) return exact;
  // Fallback for older snapshots: smallest UTXO that covers amount + legacy fee
  const LEGACY_FEE = 0.0000025;
  return [...mature]
    .filter((utxo) => utxo.amount >= FUNDING_AMOUNT_BTC + LEGACY_FEE)
    .sort((a, b) => a.amount - b.amount)[0] ?? null;
}

export async function runNodeScenario(baseURL: string, learner: ProvisionedLearner): Promise<UserNodeRun> {
  const run: UserNodeRun = {
    email: learner.email,
    userId: learner.userId,
    login: { ok: false, ms: 0 },
    provision: { ok: false, ms: 0 },
    rpc: {},
    fundingChain: { ok: false, ms: 0 },
    success: false,
    errors: [],
  };

  const loginResult = await timed(() => loginLearner(baseURL, learner));
  run.login = loginResult.op;
  if (!loginResult.value) {
    run.errors.push(run.login.error || "login failed");
    return run;
  }

  const token = loginResult.value.token;
  const provisionResult = await timed(() => nodeProvision(baseURL, token));
  run.provision = provisionResult.op;
  if (!provisionResult.op.ok) {
    run.errors.push(run.provision.error || "node provision failed");
    return run;
  }

  const fundingStartedAt = Date.now();
  const rpcResults: Record<string, TimedOperation> = {};

  const recordRpc = async <T>(method: string, params: unknown[]) => {
    const result = await timed(() => nodeRpc<T>(baseURL, token, method, params));
    rpcResults[method] = result.op;
    if (!result.value) {
      throw new Error(result.op.error || `${method} failed`);
    }
    return result.value;
  };

  try {
    await recordRpc("getblockchaininfo", []);
    const currentHeight = await recordRpc<number>("getblockcount", []);
    const multisig = await recordRpc<{ address: string }>("createmultisig", [2, [LOAD_TEST_ALICE_PUBKEY, LOAD_TEST_BOB_PUBKEY], "bech32"]);
    const scanResult = await recordRpc<{ unspents: ScantxoutsetUtxo[] }>("scantxoutset", ["start", [{ desc: SNAPSHOT_DESCRIPTOR, range: 1000 }]]);
    const utxo = selectFundingUtxo(scanResult.unspents, currentHeight);
    if (!utxo) {
      throw new Error("No spendable UTXO available for funding test");
    }

    const isExactUtxo = utxo.amount === FUNDING_AMOUNT_BTC;
    let outputs: Record<string, number>[];
    if (isExactUtxo) {
      outputs = [{ [multisig.address]: FUNDING_AMOUNT_BTC }];
    } else {
      const LEGACY_FEE = 0.0000025;
      const changeAmount = Number((utxo.amount - FUNDING_AMOUNT_BTC - LEGACY_FEE).toFixed(8));
      if (changeAmount <= 0) {
        throw new Error("Selected UTXO is too small to complete the funding chain");
      }
      outputs = [{ [multisig.address]: FUNDING_AMOUNT_BTC }, { [SNAPSHOT_ADDRESS]: changeAmount }];
    }

    const createResult = await recordRpc<string>("createrawtransaction", [[{ txid: utxo.txid, vout: utxo.vout }], outputs]);
    const prevout = { txid: utxo.txid, vout: utxo.vout, scriptPubKey: SNAPSHOT_SCRIPTPUBKEY, amount: utxo.amount };
    const signed = await recordRpc<{ complete: boolean; hex: string }>("signrawtransactionwithkey", [createResult, [SNAPSHOT_WIF], [prevout]]);
    if (!signed.complete) {
      throw new Error("Transaction signing incomplete");
    }
    await recordRpc("decoderawtransaction", [signed.hex]);
    run.fundingChain = { ok: true, ms: Date.now() - fundingStartedAt };
  } catch (err: any) {
    run.fundingChain = {
      ok: false,
      ms: Date.now() - fundingStartedAt,
      error: err?.message || "Funding chain failed",
    };
    run.errors.push(run.fundingChain.error || "Funding chain failed");
  }

  run.rpc = rpcResults;
  run.success = run.login.ok && run.provision.ok && run.fundingChain.ok;
  return run;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

export function summarizeStage(runs: UserNodeRun[]): StageSummary {
  const operationSamples = new Map<string, TimedOperation[]>();
  const statusCounts: Record<string, number> = {};
  let timeoutCount = 0;

  const pushOp = (name: string, op: TimedOperation | undefined) => {
    if (!op) return;
    const list = operationSamples.get(name) || [];
    list.push(op);
    operationSamples.set(name, list);
  };

  for (const run of runs) {
    pushOp("login", run.login);
    pushOp("provision", run.provision);
    pushOp("fundingChain", run.fundingChain);
    for (const [method, op] of Object.entries(run.rpc)) {
      pushOp(method, op);
    }
  }

  for (const ops of operationSamples.values()) {
    for (const op of ops) {
      if (typeof op.status === "number") {
        const key = String(op.status);
        statusCounts[key] = (statusCounts[key] || 0) + 1;
      }
      if (op.error && /timed out|timeout|aborted/i.test(op.error)) {
        timeoutCount += 1;
      }
    }
  }

  const operations: StageSummary["operations"] = {};
  for (const [name, ops] of operationSamples.entries()) {
    const latencies = ops.map((op) => op.ms);
    operations[name] = {
      samples: ops.length,
      successCount: ops.filter((op) => op.ok).length,
      failureCount: ops.filter((op) => !op.ok).length,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      maxMs: latencies.length ? Math.max(...latencies) : 0,
    };
  }

  return {
    count: runs.length,
    failureRate: runs.length ? runs.filter((run) => !run.success).length / runs.length : 0,
    statusCounts,
    timeoutCount,
    operations,
  };
}
