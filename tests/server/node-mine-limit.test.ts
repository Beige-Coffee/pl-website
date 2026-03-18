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

  it("mine 10 uses generateblock and succeeds", async () => {
    // mine 10 => 1 getrawmempool + 10 generateblock + 1 getblockcount = 12 calls
    manager._rpcCall = vi.fn()
      .mockResolvedValueOnce([]) // getrawmempool (empty)
    for (let i = 0; i < 10; i++) {
      manager._rpcCall.mockResolvedValueOnce({ hash: "0".repeat(64) }); // generateblock
    }
    manager._rpcCall.mockResolvedValueOnce(140); // getblockcount

    const result = await manager.exec("test-user", "mine 10");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 10 blocks");
    // 1 getrawmempool + 10 generateblock + 1 getblockcount
    expect(manager._rpcCall).toHaveBeenCalledTimes(12);
  });

  it("mine 11 returns the friendly error", async () => {
    const result = await manager.exec("test-user", "mine 11");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("limited to 10 blocks at a time");
    expect(result.error).toContain("mine 10");
  });

  it("mine 1000 returns the friendly error", async () => {
    const result = await manager.exec("test-user", "mine 1000");
    expect(result.error).toContain("limited to 10 blocks at a time");
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
      .mockResolvedValueOnce([])                          // getrawmempool
      .mockResolvedValueOnce({ hash: "0".repeat(64) })    // generateblock
      .mockResolvedValueOnce(101);                         // getblockcount

    const result = await manager.exec("test-user", "mine 1");
    expect(result.error).toBeUndefined();
    expect(result.result).toContain("Mined 1 block.");
  });

  it("help text mentions the 10-block limit", async () => {
    const result = await manager.exec("test-user", "help");
    expect(result.result).toContain("max 10");
  });
});
