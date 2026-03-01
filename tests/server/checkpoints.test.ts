import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, createAuthenticatedUser, authHeader, getMockStorage, uniqueIp } from "../helpers";

describe("Checkpoint routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
    originalFetch = globalThis.fetch;
    // Mock Lexe node_info for claim routes
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
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
            json: () => Promise.resolve({ index: "test-payment-index" }),
          });
        }
      }
      return originalFetch(url, opts);
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("POST /api/checkpoint/complete", () => {
    it("returns correct: true for right answer", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
    });

    it("returns correct: false for wrong answer", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 0 });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(false);
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await agent
        .post("/api/checkpoint/complete")
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(401);
    });

    it("returns 400 for unknown checkpoint", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(sessionToken))
        .send({ checkpointId: "nonexistent-checkpoint", answer: 0 });

      expect(res.status).toBe(400);
    });

    it("marks completion in storage", async () => {
      const { sessionToken, userId } = await createAuthenticatedUser(agent);
      await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(sessionToken))
        .send({ checkpointId: "channel-fairness", answer: 1 });

      const completed = await getMockStorage().hasCompletedCheckpoint(userId, "channel-fairness");
      expect(completed).toBe(true);
    });

    it("does not mark completion for wrong answer", async () => {
      const { sessionToken, userId } = await createAuthenticatedUser(agent);
      await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(sessionToken))
        .send({ checkpointId: "channel-fairness", answer: 99 });

      const completed = await getMockStorage().hasCompletedCheckpoint(userId, "channel-fairness");
      expect(completed).toBe(false);
    });
  });

  describe("POST /api/checkpoint/claim", () => {
    it("creates withdrawal for correct answer with verified email", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });
      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.k1).toBeDefined();
      expect(res.body.lnurl).toBeDefined();
      expect(res.body.amountSats).toBeDefined();
    });

    it("returns 403 without verified email", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", uniqueIp())
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(401);
    });

    it("returns error for wrong answer", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });
      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 0 });

      expect(res.status).toBe(400);
      expect(res.body.correct).toBe(false);
    });

    it("returns alreadyCompleted if already paid", async () => {
      const { sessionToken, userId, ip } = await createAuthenticatedUser(agent, { emailVerified: true });

      const mockStore = getMockStorage();
      await mockStore.createWithdrawal("fake-k1", userId, "21000", "pubkey-compression");
      await mockStore.markWithdrawalClaimed("fake-k1", "fake-invoice");
      await mockStore.markWithdrawalPaid("fake-k1", "fake-index");

      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      expect(res.status).toBe(400);
      expect(res.body.alreadyCompleted).toBe(true);
    });
  });

  describe("GET /api/checkpoint/status", () => {
    it("returns completed checkpoints for authenticated user", async () => {
      const { sessionToken, userId } = await createAuthenticatedUser(agent);
      await getMockStorage().markCheckpointCompleted(userId, "pubkey-compression");

      const res = await agent
        .get("/api/checkpoint/status")
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.completed).toBeInstanceOf(Array);
      expect(res.body.completed.length).toBe(1);
      expect(res.body.completed[0].checkpointId).toBe("pubkey-compression");
    });

    it("returns empty array for unauthenticated user", async () => {
      const res = await agent.get("/api/checkpoint/status");

      expect(res.status).toBe(200);
      expect(res.body.completed).toEqual([]);
    });
  });

  describe("POST /api/checkpoint-group/claim", () => {
    it("validates all answers and creates withdrawal", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });
      const res = await agent
        .post("/api/checkpoint-group/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({
          groupId: "crypto-review",
          answers: {
            "pubkey-compression": 1,
            "hash-preimage": 2,
            "ecdh-security": 1,
            "hkdf-purpose": 0,
            "nonce-reuse": 2,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.k1).toBeDefined();
    });

    it("returns error when one answer is wrong", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });
      const res = await agent
        .post("/api/checkpoint-group/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({
          groupId: "crypto-review",
          answers: {
            "pubkey-compression": 1,
            "hash-preimage": 2,
            "ecdh-security": 1,
            "hkdf-purpose": 0,
            "nonce-reuse": 0, // wrong
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.correct).toBe(false);
    });

    it("returns error for unknown group", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });
      const res = await agent
        .post("/api/checkpoint-group/claim")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken))
        .send({ groupId: "nonexistent-group", answers: {} });

      expect(res.status).toBe(400);
    });
  });
});
