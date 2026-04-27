import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests validate the mine command parsing, flush-after-mine behavior,
 * and help text inside NodeManager.exec() WITHOUT requiring a real bitcoind
 * process. We import the real class (not the global mock) and stub only the
 * parts that need a running node.
 */

// We need to bypass the global mock from setup.ts, so we use vi.importActual
const { NodeManager } = await (async () => {
  const mod = await vi.importActual<typeof import("../../server/bitcoin-node")>("../../server/bitcoin-node");
  return { NodeManager: (mod.nodeManager as any).constructor };
})();

describe("mine command limits", () => {
  let manager: any;
  const TEST_USER = "test-user-123";

  function createMockInstance() {
    return {
      userId: TEST_USER,
      rpcPort: 18500,
      p2pPort: 18501,
      dataDir: "/tmp/test-node",
      lastActivity: Date.now(),
      ready: true,
      process: { exitCode: null, killed: false },
    };
  }

  beforeEach(() => {
    manager = new NodeManager();
    const mockInstance = createMockInstance();
    // Stub getOrCreate so exec() doesn't try to start a real bitcoind
    manager.getOrCreate = vi.fn().mockResolvedValue(mockInstance);
    // Put the instance in the map so instance-scoped guards work
    manager.instances = new Map([[TEST_USER, mockInstance]]);
  });

  it("mine 10 flushes data via stop() and reports success", async () => {
    manager._rpcCall = vi.fn()
      .mockResolvedValueOnce([]) // getrawmempool (empty)
    for (let i = 0; i < 10; i++) {
      manager._rpcCall.mockResolvedValueOnce({ hash: "0".repeat(64) }); // generateblock
    }
    manager._rpcCall.mockResolvedValueOnce(140); // getblockcount
    manager._rpcCall.mockResolvedValueOnce(null); // RPC "stop" (flush)

    manager._waitForExit = vi.fn().mockResolvedValue(true);

    const result = await manager.exec(TEST_USER, "mine 10");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 10 blocks");
    expect(result.result).toContain("Current height: 140");
    expect(result.result).not.toContain("warning");

    // Verify stop (flush) was called — last RPC call should be "stop"
    const calls = manager._rpcCall.mock.calls;
    expect(calls[calls.length - 1][1]).toBe("stop");
  });

  it("mine reports warning when flush is not graceful", async () => {
    manager._rpcCall = vi.fn()
      .mockResolvedValueOnce([]) // getrawmempool
      .mockResolvedValueOnce({ hash: "0".repeat(64) }) // generateblock
      .mockResolvedValueOnce(101) // getblockcount
      .mockRejectedValueOnce(new Error("RPC stop timed out")); // stop fails

    // SIGTERM path — process doesn't exit gracefully
    manager._waitForExit = vi.fn().mockResolvedValue(false);

    const result = await manager.exec(TEST_USER, "mine 1");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 1 block");
    expect(result.result).toContain("warning");
    expect(result.result).toContain("not shut down cleanly");
  });

  it("stale instance cleanup does not clobber a newer instance", () => {
    const oldInstance = createMockInstance();
    const newInstance = createMockInstance();

    // Simulate: old instance was replaced by new instance in the map
    manager.instances = new Map([[TEST_USER, newInstance]]);

    // Old instance's _releaseInstance should NOT remove the new instance
    manager._releaseInstance(oldInstance);

    // New instance should still be in the map
    expect(manager.instances.get(TEST_USER)).toBe(newInstance);
    // But old instance's ports should still be freed
    expect(manager.usedPorts.has(oldInstance.rpcPort)).toBe(false);
    expect(manager.usedPorts.has(oldInstance.p2pPort)).toBe(false);
  });

  it("mine 11 returns the friendly error", async () => {
    const result = await manager.exec(TEST_USER, "mine 11");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("limited to 10 blocks at a time");
    expect(result.error).toContain("mine 10");
  });

  it("mine 1000 returns the friendly error", async () => {
    const result = await manager.exec(TEST_USER, "mine 1000");
    expect(result.error).toContain("limited to 10 blocks at a time");
  });

  it("mine 0 returns usage error", async () => {
    const result = await manager.exec(TEST_USER, "mine 0");
    expect(result.error).toContain("Usage: mine");
  });

  it("mine -5 returns usage error", async () => {
    const result = await manager.exec(TEST_USER, "mine -5");
    expect(result.error).toContain("Usage: mine");
  });

  it("mine abc returns usage error", async () => {
    const result = await manager.exec(TEST_USER, "mine abc");
    expect(result.error).toContain("Usage: mine");
  });

  it("help text mentions the 10-block limit", async () => {
    const result = await manager.exec(TEST_USER, "help");
    expect(result.result).toContain("max 10");
  });
});
