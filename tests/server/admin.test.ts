import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage } from "../helpers";
import { nodeManager } from "../../server/bitcoin-node";

describe("Admin routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
    process.env.PL_NODE_LOAD_TEST_BYPASS_ENABLED = "1";
    process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN = "test-load-token";
    agent = await createTestApp();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("localhost:5393")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ lightning_sendable_balance: "100000" }),
        });
      }
      return originalFetch(url);
    }) as any;
  });

  afterEach(() => {
    delete process.env.PL_NODE_LOAD_TEST_BYPASS_ENABLED;
    delete process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN;
    globalThis.fetch = originalFetch;
  });

  describe("GET /api/admin/check-ip", () => {
    it("allows localhost", async () => {
      const res = await agent.get("/api/admin/check-ip");

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
    });

    it("blocks non-allowed IP", async () => {
      const res = await agent
        .get("/api/admin/check-ip")
        .set("x-forwarded-for", "99.99.99.99");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/admin/dashboard", () => {
    it("returns dashboard with correct password", async () => {
      const res = await agent
        .get("/api/admin/dashboard")
        .query({ password: "test-admin-pass" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalSatsPaid");
      expect(res.body).toHaveProperty("pendingCount");
      expect(res.body).toHaveProperty("users");
      expect(res.body).toHaveProperty("userCount");
      expect(res.body).toHaveProperty("nodeMetrics");
      expect(res.body).toHaveProperty("launchControls");
    });

    it("returns 401 for wrong password", async () => {
      const res = await agent
        .get("/api/admin/dashboard")
        .query({ password: "wrong-password" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-allowed IP", async () => {
      const res = await agent
        .get("/api/admin/dashboard")
        .set("x-forwarded-for", "99.99.99.99")
        .query({ password: "test-admin-pass" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/admin/stats", () => {
    it("returns stats with correct password", async () => {
      const res = await agent
        .get("/api/admin/stats")
        .query({ password: "test-admin-pass" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalSatsPaid");
      expect(res.body).toHaveProperty("pendingCount");
    });

    it("returns 401 for wrong password", async () => {
      const res = await agent
        .get("/api/admin/stats")
        .query({ password: "wrong" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/admin/donation-spam", () => {
    it("marks donation as spam", async () => {
      const mockStore = getMockStorage();
      const donation = await mockStore.createDonation("idx-spam", 100, "SpamBot", "Buy crypto now!");

      const res = await agent
        .post("/api/admin/donation-spam")
        .send({ password: "test-admin-pass", donation_id: donation.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = mockStore.donations.get(donation.id);
      expect(updated?.donorName).toBe("Anon");
    });

    it("returns 401 for wrong password", async () => {
      const res = await agent
        .post("/api/admin/donation-spam")
        .send({ password: "wrong", donation_id: "some-id" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-allowed IP", async () => {
      const res = await agent
        .post("/api/admin/donation-spam")
        .set("x-forwarded-for", "99.99.99.99")
        .send({ password: "test-admin-pass", donation_id: "some-id" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/admin/reset-checkpoints", () => {
    it("fully resets learner launch state when checkpointId is omitted", async () => {
      const mockStore = getMockStorage();
      const user = await mockStore.createUserWithPassword("reset@test.com", "hash", "reset");
      await mockStore.setUserEmailVerified(user.id, true);
      await mockStore.setRewardClaimed(user.id);
      await mockStore.updateUserLightningAddress(user.id, "alice@example.com");
      await mockStore.markCheckpointCompleted(user.id, "channel-fairness");
      await mockStore.setUserProgress(user.id, "chapter-read:intro", "1");
      const withdrawal = await mockStore.createWithdrawal("k1-reset", user.id, "21000", "channel-fairness");
      await mockStore.markWithdrawalPaid(withdrawal.k1, "payment-index");

      const res = await agent
        .post("/api/admin/reset-checkpoints")
        .send({ password: "test-admin-pass", userId: user.id });

      expect(res.status).toBe(200);
      expect(await mockStore.getCompletedCheckpoints(user.id)).toEqual([]);
      expect(await mockStore.getUserProgress(user.id)).toEqual({});
      expect(await mockStore.getWithdrawalsByUserId(user.id)).toEqual([]);
      expect(mockStore.users.get(user.id)?.rewardClaimed).toBe(false);
      expect(mockStore.users.get(user.id)?.lightningAddress).toBeNull();
    });

    it("removes the checkpoint reward record when resetting one checkpoint", async () => {
      const mockStore = getMockStorage();
      const user = await mockStore.createUserWithPassword("single@test.com", "hash", "single");
      await mockStore.markCheckpointCompleted(user.id, "channel-fairness");
      const withdrawal = await mockStore.createWithdrawal("k1-single", user.id, "21000", "channel-fairness");
      await mockStore.markWithdrawalPaid(withdrawal.k1, "payment-index");

      const res = await agent
        .post("/api/admin/reset-checkpoints")
        .send({ password: "test-admin-pass", userId: user.id, checkpointId: "channel-fairness" });

      expect(res.status).toBe(200);
      expect(await mockStore.hasCompletedCheckpoint(user.id, "channel-fairness")).toBe(false);
      expect(await mockStore.getPaidWithdrawalForCheckpoint(user.id, "channel-fairness")).toBeUndefined();
    });
  });

  describe("Launch testing controls", () => {
    it("provisions verified learner accounts", async () => {
      const res = await agent
        .post("/api/admin/test-learners/provision")
        .set("x-pl-load-test-token", "test-load-token")
        .send({ password: "test-admin-pass", prefix: "launch", count: 2 });

      expect(res.status).toBe(200);
      expect(res.body.prefix).toBe("launch");
      expect(res.body.learners).toHaveLength(2);
      expect(res.body.learners[0].email).toBe("launch-01@pl-launch.test");

      const mockStore = getMockStorage();
      const learner = await mockStore.getUserByEmail("launch-01@pl-launch.test");
      expect(learner?.emailVerified).toBe(true);
    });

    it("returns node metrics and resets them", async () => {
      const metricsRes = await agent
        .get("/api/admin/node-metrics")
        .set("x-pl-load-test-token", "test-load-token")
        .query({ password: "test-admin-pass" });

      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body).toHaveProperty("nodeMetrics");
      expect(metricsRes.body).toHaveProperty("launchControls");

      const resetRes = await agent
        .post("/api/admin/node-metrics/reset")
        .set("x-pl-load-test-token", "test-load-token")
        .send({ password: "test-admin-pass" });

      expect(resetRes.status).toBe(200);
      expect(nodeManager.resetMetrics).toHaveBeenCalled();
    });
  });
});
