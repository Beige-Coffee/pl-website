import { Page, expect } from "@playwright/test";

/**
 * Authenticated wrappers around the app's Bitcoin Node API endpoints.
 * These call the real backend (which talks to the real per-user regtest node)
 * but bypass flaky terminal UI rendering for transaction-validity checks.
 */

interface RpcResult {
  result?: any;
  error?: string;
}

interface ExecResult {
  output?: string;
  error?: string;
}

/**
 * Provision the user's Bitcoin node if not already running.
 * Calls GET /api/node/status?provision=true.
 */
export async function provisionNode(page: Page): Promise<void> {
  const response = await page.evaluate(async () => {
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token for node provisioning");
    const res = await fetch("/api/node/status?provision=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Node provision failed: ${res.status} ${body}`);
    }
    return res.json();
  });
  if (!response.running) {
    throw new Error("Node provision returned running=false");
  }
}

/**
 * Call a Bitcoin Core RPC method via POST /api/node/rpc.
 */
export async function nodeRpc(page: Page, method: string, params: unknown[] = []): Promise<RpcResult> {
  return page.evaluate(async ({ method, params }) => {
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token for node RPC");
    const res = await fetch("/api/node/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ method, params }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { error: body.error || `RPC ${method} failed: ${res.status}` };
    }
    return body;
  }, { method, params });
}

/**
 * Execute a raw Bitcoin CLI command via POST /api/node/exec.
 */
export async function nodeExecApi(page: Page, command: string): Promise<ExecResult> {
  return page.evaluate(async (cmd) => {
    const token = localStorage.getItem("pl-session-token");
    if (!token) throw new Error("Missing session token for node exec");
    const res = await fetch("/api/node/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ command: cmd }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { error: body.error || `exec failed: ${res.status}` };
    }
    return body;
  }, command);
}

/**
 * Call testmempoolaccept with a raw transaction hex.
 * Returns the first entry from Bitcoin Core's result array.
 */
export async function testMempoolAccept(
  page: Page,
  txHex: string
): Promise<{ allowed: boolean; "reject-reason"?: string }> {
  const rpcResult = await nodeRpc(page, "testmempoolaccept", [[txHex]]);
  if (rpcResult.error) {
    throw new Error(`testmempoolaccept error: ${rpcResult.error}`);
  }
  const entries = rpcResult.result;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`testmempoolaccept returned unexpected result: ${JSON.stringify(rpcResult)}`);
  }
  return entries[0];
}

/**
 * Broadcast a raw transaction via sendrawtransaction.
 * Returns the txid on success, throws on error.
 */
export async function sendRawTransaction(page: Page, txHex: string): Promise<string> {
  const rpcResult = await nodeRpc(page, "sendrawtransaction", [txHex]);
  if (rpcResult.error) {
    throw new Error(`sendrawtransaction error: ${rpcResult.error}`);
  }
  return rpcResult.result as string;
}

/**
 * Mine N blocks via the "mine" exec command.
 * Uses batches of 25 to stay well under the 120s generatetoaddress timeout.
 * The snapshot starts at ~101 blocks, so typical test mining stays under 200 total.
 */
export async function mineBlocks(page: Page, count: number): Promise<string> {
  const BATCH_SIZE = 25;
  let lastOutput = "";
  let remaining = count;
  while (remaining > 0) {
    const batch = Math.min(remaining, BATCH_SIZE);
    const result = await nodeExecApi(page, `mine ${batch}`);
    if (result.error) {
      throw new Error(`mine ${batch} (${count - remaining + batch}/${count}) error: ${result.error}`);
    }
    lastOutput = result.output || "";
    remaining -= batch;
  }
  return lastOutput;
}

/**
 * Decode a raw transaction hex via decoderawtransaction RPC.
 */
export async function decodeRawTransaction(page: Page, txHex: string): Promise<any> {
  const rpcResult = await nodeRpc(page, "decoderawtransaction", [txHex]);
  if (rpcResult.error) {
    throw new Error(`decoderawtransaction error: ${rpcResult.error}`);
  }
  return rpcResult.result;
}

/**
 * Get a transaction by txid via gettransaction RPC.
 */
export async function getTransaction(page: Page, txid: string): Promise<any> {
  const rpcResult = await nodeRpc(page, "gettransaction", [txid]);
  if (rpcResult.error) {
    throw new Error(`gettransaction error: ${rpcResult.error}`);
  }
  return rpcResult.result;
}
