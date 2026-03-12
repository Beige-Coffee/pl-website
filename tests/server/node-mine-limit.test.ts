import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests validate the mine command parsing and help text inside NodeManager.exec()
 * WITHOUT requiring a real bitcoind process. We import the real class (not the global mock)
 * and stub only the parts that need a running node.
 */

// We need to bypass the global mock from setup.ts, so we use vi.importActual
const { NodeManager } = await (async () => {
  // Inline dynamic import of the actual module (not the mocked one)
  const mod = await vi.importActual<typeof import("../../server/bitcoin-node")>("../../server/bitcoin-node");
  // NodeManager is the class on the module; nodeManager is the singleton.
  // The class is not exported directly, so we access it through the singleton's constructor.
  return { NodeManager: (mod.nodeManager as any).constructor };
})();

describe("mine command limits", () => {
  let manager: any;

  beforeEach(() => {
    manager = new NodeManager();
    // Stub getOrCreate so exec() doesn't try to start a real bitcoind
    manager.getOrCreate = vi.fn().mockResolvedValue({
      rpcPort: 18500,
      lastActivity: Date.now(),
      ready: true,
    });
  });

  it("mine 40 batches into smaller RPC calls and succeeds", async () => {
    // mine 40 with BATCH=5 => 1 getnewaddress + 8 generatetoaddress + 1 getblockcount = 10 calls
    manager._rpcCall = vi.fn().mockResolvedValue("mock");
    manager._rpcCall
      .mockResolvedValueOnce("bcrt1qmockaddress"); // getnewaddress
    // 8 batches of 5 blocks each
    for (let i = 0; i < 8; i++) {
      manager._rpcCall.mockResolvedValueOnce(Array(5).fill("0".repeat(64)));
    }
    manager._rpcCall.mockResolvedValueOnce(140); // getblockcount

    const result = await manager.exec("test-user", "mine 40");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 40 blocks");
    // 1 getnewaddress + 8 generatetoaddress batches + 1 getblockcount
    expect(manager._rpcCall).toHaveBeenCalledTimes(10);
  });

  it("mine 41 returns the friendly course-specific error", async () => {
    const result = await manager.exec("test-user", "mine 41");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("limited to 40 blocks at a time");
    expect(result.error).toContain("mine 40");
  });

  it("mine 1000 returns the friendly error", async () => {
    const result = await manager.exec("test-user", "mine 1000");
    expect(result.error).toContain("limited to 40 blocks at a time");
  });

  it("mine 0 returns usage error", async () => {
    const result = await manager.exec("test-user", "mine 0");
    expect(result.error).toContain("Usage: mine");
  });

  it("mine -5 returns usage error", async () => {
    const result = await manager.exec("test-user", "mine -5");
    expect(result.error).toContain("Usage: mine");
  });

  it("mine abc returns usage error", async () => {
    const result = await manager.exec("test-user", "mine abc");
    expect(result.error).toContain("Usage: mine");
  });

  it("mine 1 is allowed", async () => {
    manager._rpcCall = vi.fn()
      .mockResolvedValueOnce("bcrt1qmockaddress")
      .mockResolvedValueOnce(["0".repeat(64)])
      .mockResolvedValueOnce(101);

    const result = await manager.exec("test-user", "mine 1");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 1 block.");
  });

  it("help text mentions the 40-block limit", async () => {
    const result = await manager.exec("test-user", "help");
    expect(result.result).toContain("max 40");
  });
});
