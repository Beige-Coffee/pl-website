import { spawn, execSync, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from "fs";
import { createServer } from "net";
import { join } from "path";
import { randomInt } from "crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

type UserId = number | string;

interface NodeInstance {
  userId: UserId;
  process: ChildProcess;
  rpcPort: number;
  dataDir: string;
  lastActivity: number;
  ready: boolean;
}

interface RpcResponse {
  result?: unknown;
  error?: { code: number; message: string } | null;
  id: string;
}

interface MetricBucket {
  count: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

interface MetricSummary extends MetricBucket {
  avgMs: number;
}

export interface NodeMetricsSnapshot {
  activeNodes: number;
  maxConcurrent: number;
  idleTimeoutMs: number;
  limiterBypassCount: number;
  startupFailures: number;
  cleanup: {
    idleStops: number;
    staleDirsRemoved: number;
  };
  provision: MetricSummary;
  rpc: Record<string, MetricSummary>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BASE_DIR = join(process.cwd(), ".local");
const BIN_DIR = join(BASE_DIR, "bin");
const NODES_DIR = join(BASE_DIR, "nodes");
const SNAPSHOT_DIR = join(process.cwd(), "docker", "lightning-regtest", "bitcoin-snapshot");

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CONCURRENT = 100;
const CLEANUP_INTERVAL_MS = 60 * 1000; // check every minute
const DATA_DIR_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const RPC_USER = "pl";
const RPC_PASS = "pldevpass";
const MIN_PORT = 18500;
const MAX_PORT = 18999;
const DEFAULT_RPC_TIMEOUT_MS = 30_000;
const RPC_TIMEOUT_OVERRIDES_MS: Record<string, number> = {
  scantxoutset: 120_000,
  generateblock: 30_000,
};

const BLOCKED_COMMANDS = new Set([
  "stop",           // would kill the node process
]);

function createMetricBucket(): MetricBucket {
  return {
    count: 0,
    successCount: 0,
    failureCount: 0,
    timeoutCount: 0,
    totalMs: 0,
    maxMs: 0,
    lastMs: 0,
  };
}

function summarizeMetric(bucket: MetricBucket): MetricSummary {
  return {
    ...bucket,
    avgMs: bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0,
  };
}

// ─── NodeManager Singleton ──────────────────────────────────────────────────

class NodeManager {
  private instances = new Map<UserId, NodeInstance>();
  private usedPorts = new Set<number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private bitcoindPath: string | null = null;
  private binaryReady = false;
  private binaryPromise: Promise<void> | null = null;
  private metrics = {
    provision: createMetricBucket(),
    rpc: new Map<string, MetricBucket>(),
    cleanup: {
      idleStops: 0,
      staleDirsRemoved: 0,
    },
    limiterBypassCount: 0,
    startupFailures: 0,
  };

  private recordMetric(bucket: MetricBucket, durationMs: number, success: boolean, timedOut: boolean) {
    bucket.count += 1;
    bucket.totalMs += durationMs;
    bucket.lastMs = durationMs;
    bucket.maxMs = Math.max(bucket.maxMs, durationMs);
    if (success) {
      bucket.successCount += 1;
      return;
    }
    bucket.failureCount += 1;
    if (timedOut) {
      bucket.timeoutCount += 1;
    }
  }

  private recordRpcMetric(method: string, durationMs: number, success: boolean, timedOut: boolean) {
    const bucket = this.metrics.rpc.get(method) ?? createMetricBucket();
    this.recordMetric(bucket, durationMs, success, timedOut);
    this.metrics.rpc.set(method, bucket);
  }

  noteLimiterBypass(): void {
    this.metrics.limiterBypassCount += 1;
  }

  resetMetrics(): void {
    this.metrics = {
      provision: createMetricBucket(),
      rpc: new Map<string, MetricBucket>(),
      cleanup: {
        idleStops: 0,
        staleDirsRemoved: 0,
      },
      limiterBypassCount: 0,
      startupFailures: 0,
    };
  }

  getMetrics(): NodeMetricsSnapshot {
    const rpc: Record<string, MetricSummary> = {};
    for (const [method, bucket] of Array.from(this.metrics.rpc.entries())) {
      rpc[method] = summarizeMetric(bucket);
    }
    return {
      activeNodes: this.instances.size,
      maxConcurrent: MAX_CONCURRENT,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      limiterBypassCount: this.metrics.limiterBypassCount,
      startupFailures: this.metrics.startupFailures,
      cleanup: { ...this.metrics.cleanup },
      provision: summarizeMetric(this.metrics.provision),
      rpc,
    };
  }

  async ensureBitcoindBinary(): Promise<void> {
    if (this.binaryReady && this.bitcoindPath) return;
    if (this.binaryPromise) return this.binaryPromise;

    this.binaryPromise = this._downloadBinary();
    return this.binaryPromise;
  }

  private async _downloadBinary(): Promise<void> {
    mkdirSync(BIN_DIR, { recursive: true });

    // Check if already present
    const localBitcoind = join(BIN_DIR, "bitcoind");
    if (existsSync(localBitcoind)) {
      this.bitcoindPath = localBitcoind;
      this.binaryReady = true;
      console.log("[node] bitcoind binary found at", localBitcoind);
      return;
    }

    // Check system PATH
    try {
      const systemPath = execSync("which bitcoind", { encoding: "utf8" }).trim();
      if (systemPath && existsSync(systemPath)) {
        this.bitcoindPath = systemPath;
        this.binaryReady = true;
        console.log("[node] Using system bitcoind at", systemPath);
        return;
      }
    } catch {}

    // Download Bitcoin Core
    const platform = process.platform;
    const arch = process.arch;
    let archiveName: string;
    let dirName: string;

    const version = "27.0";
    if (platform === "linux" && arch === "x64") {
      archiveName = `bitcoin-${version}-x86_64-linux-gnu.tar.gz`;
      dirName = `bitcoin-${version}`;
    } else if (platform === "darwin" && arch === "arm64") {
      archiveName = `bitcoin-${version}-arm64-apple-darwin.tar.gz`;
      dirName = `bitcoin-${version}`;
    } else if (platform === "darwin" && arch === "x64") {
      archiveName = `bitcoin-${version}-x86_64-apple-darwin.tar.gz`;
      dirName = `bitcoin-${version}`;
    } else {
      throw new Error(`Unsupported platform: ${platform}/${arch}`);
    }

    const url = `https://bitcoincore.org/bin/bitcoin-core-${version}/${archiveName}`;
    console.log("[node] Downloading Bitcoin Core from", url);

    try {
      const tmpArchive = join(BASE_DIR, archiveName);
      execSync(`curl -sL "${url}" -o "${tmpArchive}"`, { timeout: 300_000 });
      execSync(`tar xzf "${tmpArchive}" -C "${BASE_DIR}"`, { timeout: 60_000 });

      const extractedBin = join(BASE_DIR, dirName, "bin", "bitcoind");
      if (!existsSync(extractedBin)) {
        throw new Error(`bitcoind not found at expected path: ${extractedBin}`);
      }

      execSync(`cp "${extractedBin}" "${localBitcoind}"`);
      execSync(`chmod +x "${localBitcoind}"`);

      // macOS requires ad-hoc signing for copied binaries
      if (process.platform === "darwin") {
        try { execSync(`codesign --sign - --force "${localBitcoind}"`); } catch {}
      }

      // Cleanup archive and extracted dir
      try { rmSync(tmpArchive); } catch {}
      try { rmSync(join(BASE_DIR, dirName), { recursive: true }); } catch {}

      this.bitcoindPath = localBitcoind;
      this.binaryReady = true;
      console.log("[node] Bitcoin Core installed at", localBitcoind);
    } catch (err: any) {
      console.error("[node] Failed to download bitcoind:", err.message);
      throw new Error("Bitcoin node unavailable - please try again later");
    }
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.unref();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
  }

  private async allocatePort(): Promise<number> {
    for (let attempt = 0; attempt < 500; attempt++) {
      const port = MIN_PORT + randomInt(MAX_PORT - MIN_PORT);
      if (this.usedPorts.has(port)) continue;
      if (!(await this.isPortAvailable(port))) continue;
      this.usedPorts.add(port);
      return port;
    }
    throw new Error("No available ports");
  }

  async getOrCreate(userId: UserId): Promise<NodeInstance> {
    const existing = this.instances.get(userId);
    if (existing?.ready) {
      // Detect dead/crashed process (e.g., OOM-killed or SIGKILL'd by host)
      if (existing.process.exitCode !== null || existing.process.killed) {
        console.log("[node] Detected dead process for user", userId, "- reprovisioning");
        this.usedPorts.delete(existing.rpcPort);
        this.instances.delete(userId);
        // Fall through to provision a new node
      } else {
        existing.lastActivity = Date.now();
        return existing;
      }
    }
    if (existing && !existing.ready) {
      throw new Error("Node is still starting, try again in a few seconds");
    }

    if (this.instances.size >= MAX_CONCURRENT) {
      throw new Error("Server busy, try again in a few minutes");
    }

    await this.ensureBitcoindBinary();

    const dataDir = join(NODES_DIR, `user-${userId}`);
    const regtestDir = join(dataDir, "regtest");
    const isExisting = existsSync(join(regtestDir, "blocks"));

    if (!isExisting) {
      mkdirSync(regtestDir, { recursive: true });
      if (existsSync(SNAPSHOT_DIR)) {
        cpSync(SNAPSHOT_DIR, regtestDir, { recursive: true });
        console.log("[node] Copied snapshot for user", userId);
      }
    }

    const rpcPort = await this.allocatePort();
    const p2pPort = await this.allocatePort();
    const provisionStartedAt = Date.now();

    const args = [
      `-datadir=${dataDir}`,
      "-regtest",
      "-server",
      `-rpcport=${rpcPort}`,
      `-port=${p2pPort}`,
      `-rpcuser=${RPC_USER}`,
      `-rpcpassword=${RPC_PASS}`,
      "-rpcallowip=127.0.0.1",
      "-rpcbind=127.0.0.1",
      "-dbcache=100",
      "-maxmempool=5",
      "-maxconnections=0",
      "-disablewallet",
      "-minrelaytxfee=0",
      "-persistmempool=0",
    ];

    console.log("[node] Starting bitcoind for user", userId, "on RPC port", rpcPort);

    const proc = spawn("sh", ["-c", `ulimit -n 4096 2>/dev/null; exec "${this.bitcoindPath}" ${args.map(a => `'${a}'`).join(" ")}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const instance: NodeInstance = {
      userId,
      process: proc,
      rpcPort,
      dataDir,
      lastActivity: Date.now(),
      ready: false,
    };

    this.instances.set(userId, instance);

    proc.on("exit", (code) => {
      console.log("[node] bitcoind exited for user", userId, "code", code);
      this.usedPorts.delete(rpcPort);
      this.usedPorts.delete(p2pPort);
      const current = this.instances.get(userId);
      if (current?.process === proc) {
        this.instances.delete(userId);
      }
    });

    let stderrBuf = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > 4096) stderrBuf = stderrBuf.slice(-2048);
    });

    try {
      await this._waitForRpc(instance);
      await this._ensureOutOfIBD(instance);
      instance.ready = true;
      this.recordMetric(this.metrics.provision, Date.now() - provisionStartedAt, true, false);
      return instance;
    } catch (err: any) {
      const message = err?.message || "Unknown node startup error";
      this.metrics.startupFailures += 1;
      this.recordMetric(
        this.metrics.provision,
        Date.now() - provisionStartedAt,
        false,
        /timed out|timeout/i.test(message)
      );
      await this.stop(userId);
      throw err;
    }
  }

  private async _waitForRpc(instance: NodeInstance, maxWaitMs = 30_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        await this._rpcCallWithTimeout(instance.rpcPort, "getblockchaininfo", [], 2_000);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw new Error("bitcoind failed to start within timeout");
  }

  private async _ensureOutOfIBD(instance: NodeInstance): Promise<void> {
    try {
      const info = (await this._rpcCall(instance.rpcPort, "getblockchaininfo", [])) as any;
      if (!info?.initialblockdownload) return;

      console.log("[node] Node in IBD mode — mining block with mocktime to exit...");

      const now = Math.floor(Date.now() / 1000);
      await this._rpcCall(instance.rpcPort, "setmocktime", [now]);

      const THROWAWAY_ADDR = "bcrt1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdku202";
      await this._rpcCall(instance.rpcPort, "generateblock", [THROWAWAY_ADDR, []]);

      await this._rpcCall(instance.rpcPort, "setmocktime", [0]);

      const info2 = (await this._rpcCall(instance.rpcPort, "getblockchaininfo", [])) as any;
      console.log("[node] After mining: IBD =", info2?.initialblockdownload, "height =", info2?.blocks);
    } catch (err: any) {
      console.log("[node] IBD exit attempt failed:", err.message);
    }
  }

  private async _rpcCall(
    port: number,
    method: string,
    params: unknown[],
    recordMetric = true,
    timeoutOverrideMs?: number
  ): Promise<unknown> {
    const startedAt = Date.now();
    const body = JSON.stringify({
      jsonrpc: "1.0",
      id: "plrpc",
      method,
      params,
    });

    const timeoutMs = timeoutOverrideMs ?? RPC_TIMEOUT_OVERRIDES_MS[method] ?? DEFAULT_RPC_TIMEOUT_MS;
    let res: Response;
    try {
      res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + Buffer.from(`${RPC_USER}:${RPC_PASS}`).toString("base64"),
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      if (recordMetric) {
        this.recordRpcMetric(method, Date.now() - startedAt, false, true);
      }
      if (err?.name === "TimeoutError" || err?.message?.includes("aborted due to timeout")) {
        throw new Error(`${method} timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      throw err;
    }

    const data = (await res.json()) as RpcResponse;
    if (data.error) {
      if (recordMetric) {
        this.recordRpcMetric(method, Date.now() - startedAt, false, false);
      }
      throw new Error(data.error.message);
    }
    if (recordMetric) {
      this.recordRpcMetric(method, Date.now() - startedAt, true, false);
    }
    return data.result;
  }

  private async _rpcCallWithTimeout(port: number, method: string, params: unknown[], timeoutMs: number): Promise<unknown> {
    return this._rpcCall(port, method, params, false, timeoutMs);
  }

  /**
   * getrawtransaction with fallback for when txindex is disabled.
   * Tries the direct RPC first (works for mempool txs). If it fails because
   * the tx is confirmed and txindex is off, searches recent blocks using
   * the blockhash parameter which works without txindex.
   */
  private async _getrawtransactionWithFallback(port: number, params: unknown[]): Promise<unknown> {
    try {
      return await this._rpcCall(port, "getrawtransaction", params);
    } catch (err: any) {
      if (!/No such mempool transaction|txindex/i.test(err.message)) {
        throw err;
      }
    }

    // Fallback: search recent blocks for the confirmed transaction
    const txid = params[0] as string;
    const verbose = params.length > 1 ? params[1] : false;
    const height = (await this._rpcCall(port, "getblockcount", [], false)) as number;
    const searchDepth = Math.min(50, height);

    for (let i = 0; i < searchDepth; i++) {
      const blockHash = (await this._rpcCall(port, "getblockhash", [height - i], false)) as string;
      try {
        return await this._rpcCall(port, "getrawtransaction", [txid, verbose, blockHash], false);
      } catch {
        continue;
      }
    }

    throw new Error(`Transaction ${txid} not found in mempool or last ${searchDepth} blocks`);
  }

  async rpc(userId: UserId, method: string, params: unknown[]): Promise<unknown> {
    if (BLOCKED_COMMANDS.has(method)) {
      throw new Error(`Command '${method}' is not available in this environment.`);
    }
    const instance = await this.getOrCreate(userId);
    instance.lastActivity = Date.now();
    if (method === "getrawtransaction") {
      return this._getrawtransactionWithFallback(instance.rpcPort, params);
    }
    return this._rpcCall(instance.rpcPort, method, params);
  }

  async exec(userId: UserId, rawCommand: string): Promise<{ result?: unknown; error?: string }> {
    let instance: NodeInstance;
    try {
      instance = await this.getOrCreate(userId);
    } catch (err: any) {
      return { error: err.message };
    }
    instance.lastActivity = Date.now();

    const result = await this._execCommand(instance, rawCommand);

    // If the command failed with a connection error (not a timeout), the node
    // process is likely dead. Stop it so the next call triggers a fresh re-provision.
    // Timeouts are NOT treated as fatal — the node may still be alive and processing
    // (e.g., generatetoaddress mining blocks slowly). Killing it mid-write can corrupt data.
    if (result.error && /ECONNREFUSED|ECONNRESET|socket hang up/i.test(result.error)) {
      console.log("[node] Node appears dead for user", userId, "- stopping for re-provision on next call");
      await this.stop(userId);
    }

    return result;
  }

  private async _execCommand(instance: NodeInstance, rawCommand: string): Promise<{ result?: unknown; error?: string }> {
    const trimmed = rawCommand.trim();
    if (!trimmed) return { error: "Empty command" };

    // Parse command and args
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")/g) || [];
    if (!parts || parts.length === 0) return { error: "Empty command" };
    const cmd = parts[0]!.toLowerCase();
    const args = parts.slice(1).map((a) => a.replace(/^"|"$/g, ""));

    // Handle special "mine" command
    if (cmd === "mine") {
      return this._handleMine(instance, args);
    }

    // Handle "clear" - client-side only
    if (cmd === "clear") {
      return { result: "__CLEAR__" };
    }

    // Handle "help" with no args — show common commands, note that most bitcoin-cli commands work
    if (cmd === "help" && args.length === 0) {
      return {
        result: [
          "Most bitcoin-cli commands are supported. Here are some common ones:",
          "",
          "  getblockchaininfo          - Get blockchain status",
          "  getblockcount              - Get current block height",
          "  getblockhash <height>      - Get block hash by height",
          "  getblock <hash> [verbose]  - Get block data",
          "  getrawtransaction <txid> true  - Get transaction details + confirmations",
          "  decoderawtransaction <hex> - Decode a raw transaction",
          "  decodescript <hex>         - Decode a script",
          "  sendrawtransaction <hex>   - Broadcast a raw transaction",
          "  createrawtransaction       - Create a raw transaction",
          "  testmempoolaccept <hex>    - Test if a transaction would be accepted",
          "  scantxoutset \"start\" [...]  - Scan UTXO set by descriptor",
          "  gettxout <txid> <n>        - Get UTXO info",
          "  getmempoolinfo             - Get mempool info",
          "  validateaddress <addr>     - Validate a Bitcoin address",
          "  help <command>             - Get help for a specific command",
          "",
          "  mine <n>                   - Mine n blocks (max 20 per command)",
          "  clear                      - Clear terminal",
          "",
          "  Note: Wallet is disabled for performance. Use scantxoutset to find UTXOs",
          "  and signrawtransactionwithkey to sign transactions with a known private key.",
        ].join("\n"),
      };
    }

    if (BLOCKED_COMMANDS.has(cmd)) {
      return { error: `Command '${cmd}' is not available in this environment.` };
    }

    // testmempoolaccept expects [["rawtx"]] — wrap the hex arg in an array
    if (cmd === "testmempoolaccept" && args.length >= 1) {
      try {
        const result = await this._rpcCall(instance.rpcPort, cmd, [[args[0]]]);
        return { result };
      } catch (err: any) {
        return { error: err.message };
      }
    }

    // Convert numeric-looking args
    const rpcArgs = args.map((a) => {
      if (/^\d+$/.test(a)) return parseInt(a, 10);
      if (a === "true") return true;
      if (a === "false") return false;
      return a;
    });

    // getrawtransaction fallback: search recent blocks when txindex is disabled
    if (cmd === "getrawtransaction") {
      try {
        const result = await this._getrawtransactionWithFallback(instance.rpcPort, rpcArgs);
        return { result };
      } catch (err: any) {
        return { error: err.message };
      }
    }

    try {
      const result = await this._rpcCall(instance.rpcPort, cmd, rpcArgs);
      return { result };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  private async _handleMine(instance: NodeInstance, args: string[]): Promise<{ result?: unknown; error?: string }> {
    const MAX_MINE_BLOCKS = 20;
    const numBlocks = parseInt(args[0] || "1", 10);
    if (isNaN(numBlocks) || numBlocks < 1) {
      return { error: "Usage: mine <number> (1-20)" };
    }
    if (numBlocks > MAX_MINE_BLOCKS) {
      return { error: `Mining is limited to ${MAX_MINE_BLOCKS} blocks at a time. Run 'mine ${MAX_MINE_BLOCKS}' multiple times if you need more.` };
    }

    try {
      const address = "bcrt1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdku202";
      const mempool = (await this._rpcCall(instance.rpcPort, "getrawmempool", [])) as string[];
      await this._rpcCall(instance.rpcPort, "generateblock", [address, mempool || []]);

      for (let i = 1; i < numBlocks; i++) {
        await this._rpcCall(instance.rpcPort, "generateblock", [address, []]);
      }

      const blockCount = await this._rpcCall(instance.rpcPort, "getblockcount", []);
      return {
        result: `Mined ${numBlocks} block${numBlocks > 1 ? "s" : ""}. Current height: ${blockCount}`,
      };
    } catch (err: any) {
      // If timed out, the node is likely still processing (not dead).
      // Poll getblockcount to report partial progress so the student knows
      // blocks were mined even though the command appeared to fail.
      if (/timed out/i.test(err.message)) {
        try {
          const blockCount = await this._rpcCallWithTimeout(instance.rpcPort, "getblockcount", [], 10_000);
          return { error: `Mining was slow but the node is still working. Current height: ${blockCount}. Try 'getblockcount' in a moment, then run 'mine' again for remaining blocks.` };
        } catch {
          return { error: `Mining timed out. The node may still be processing blocks. Wait a moment and try 'getblockcount' to check progress.` };
        }
      }
      return { error: `Failed to mine: ${err.message}` };
    }
  }

  async stop(userId: UserId): Promise<void> {
    const instance = this.instances.get(userId);
    if (!instance) return;

    try {
      instance.process.kill("SIGTERM");
    } catch {}

    // Wait briefly for graceful shutdown
    await new Promise((r) => setTimeout(r, 1000));

    if (instance.process.exitCode === null) {
      try {
        instance.process.kill("SIGKILL");
      } catch {}
    }

    this.instances.delete(userId);
  }

  async restart(userId: UserId): Promise<void> {
    await this.stop(userId);
    await this.getOrCreate(userId);
  }

  getStatus(userId: UserId): { running: boolean; blockHeight?: number } {
    const instance = this.instances.get(userId);
    if (!instance?.ready) return { running: false };
    // Check if the underlying process is actually alive
    if (instance.process.exitCode !== null || instance.process.killed) {
      return { running: false };
    }
    return { running: true };
  }

  startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this._cleanupIdle();
      this._cleanupOldData();
    }, CLEANUP_INTERVAL_MS);
  }

  private _cleanupIdle(): void {
    const now = Date.now();
    this.instances.forEach((instance, userId) => {
      if (now - instance.lastActivity > IDLE_TIMEOUT_MS) {
        console.log("[node] Stopping idle node for user", userId);
        this.metrics.cleanup.idleStops += 1;
        this.stop(userId);
      }
    });
  }

  private _cleanupOldData(): void {
    if (!existsSync(NODES_DIR)) return;
    try {
      const now = Date.now();
      for (const dir of readdirSync(NODES_DIR)) {
        const fullPath = join(NODES_DIR, dir);
        const stats = statSync(fullPath);
        if (now - stats.mtimeMs > DATA_DIR_MAX_AGE_MS) {
          // Don't remove if node is running
          const userIdMatch = dir.match(/^user-(\d+)$/);
          if (userIdMatch && !this.instances.has(parseInt(userIdMatch[1]!, 10))) {
            console.log("[node] Removing stale data dir:", dir);
            rmSync(fullPath, { recursive: true });
            this.metrics.cleanup.staleDirsRemoved += 1;
          }
        }
      }
    } catch (err: any) {
      console.error("[node] Cleanup error:", err.message);
    }
  }

  async stopAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    const userIds: UserId[] = [];
    this.instances.forEach((_, uid) => userIds.push(uid));
    await Promise.all(userIds.map((uid) => this.stop(uid)));
  }

  get concurrentCount(): number {
    return this.instances.size;
  }
}

export const nodeManager = new NodeManager();
