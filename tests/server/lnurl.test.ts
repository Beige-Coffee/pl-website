import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage, createAuthenticatedUser, authHeader } from "../helpers";

describe("LNURL routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("localhost:5393")) {
        if (url.includes("node_info")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ lightning_sendable_balance: "1000000" }),
          });
        }
        if (url.includes("pay_invoice")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ index: "pay-idx" }),
          });
        }
      }
      return originalFetch(url);
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("GET /api/lnurl/withdraw/:k1", () => {
    it("returns valid LNURL withdraw JSON", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent, { emailVerified: true });
      await mockStore.createWithdrawal("test-k1-withdraw", userId, "21000");

      const res = await agent.get("/api/lnurl/withdraw/test-k1-withdraw");

      expect(res.status).toBe(200);
      expect(res.body.tag).toBe("withdrawRequest");
      expect(res.body.k1).toBe("test-k1-withdraw");
      expect(res.body.minWithdrawable).toBe(21000);
      expect(res.body.maxWithdrawable).toBe(21000);
      expect(res.body.callback).toContain("/api/lnurl/callback");
    });

    it("returns error for unknown k1", async () => {
      const res = await agent.get("/api/lnurl/withdraw/nonexistent-k1");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ERROR");
      expect(res.body.reason).toContain("Unknown");
    });

    it("returns error for expired withdrawal", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent);
      const w = await mockStore.createWithdrawal("expired-k1", userId, "21000");
      // Manually set createdAt to 6 minutes ago
      const old = new Date(Date.now() - 6 * 60 * 1000);
      mockStore.withdrawals.set("expired-k1", { ...w, createdAt: old });

      const res = await agent.get("/api/lnurl/withdraw/expired-k1");

      expect(res.body.status).toBe("ERROR");
      expect(res.body.reason).toContain("expired");
    });

    it("returns error for already claimed withdrawal", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent);
      await mockStore.createWithdrawal("claimed-k1", userId, "21000");
      await mockStore.markWithdrawalClaimed("claimed-k1", "lnbc...");

      const res = await agent.get("/api/lnurl/withdraw/claimed-k1");

      expect(res.body.status).toBe("ERROR");
    });
  });

  describe("GET /api/lnurl/status/:k1", () => {
    it("returns pending status", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent);
      await mockStore.createWithdrawal("status-k1", userId, "21000");

      const res = await agent.get("/api/lnurl/status/status-k1");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pending");
      expect(res.body.amountSats).toBe(21);
    });

    it("returns paid status", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent);
      await mockStore.createWithdrawal("paid-k1", userId, "21000");
      await mockStore.markWithdrawalClaimed("paid-k1", "lnbc...");
      await mockStore.markWithdrawalPaid("paid-k1", "pay-idx");

      const res = await agent.get("/api/lnurl/status/paid-k1");

      expect(res.body.status).toBe("paid");
    });

    it("returns 404 for unknown k1", async () => {
      const res = await agent.get("/api/lnurl/status/unknown-k1");

      expect(res.status).toBe(404);
    });

    it("expires stale pending withdrawal", async () => {
      const mockStore = getMockStorage();
      const { userId } = await createAuthenticatedUser(agent);
      const w = await mockStore.createWithdrawal("stale-k1", userId, "21000");
      const old = new Date(Date.now() - 6 * 60 * 1000);
      mockStore.withdrawals.set("stale-k1", { ...w, createdAt: old });

      const res = await agent.get("/api/lnurl/status/stale-k1");

      expect(res.body.status).toBe("expired");
    });
  });
});
