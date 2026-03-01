import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage } from "../helpers";

describe("LN Auth routes", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  describe("GET /api/lnauth/challenge", () => {
    it("generates challenge with k1, lnurl, and QR", async () => {
      const res = await agent.get("/api/lnauth/challenge");

      expect(res.status).toBe(200);
      expect(res.body.k1).toBeDefined();
      expect(res.body.k1).toHaveLength(64);
      expect(res.body.lnurl).toMatch(/^LNURL/);
      expect(res.body.qr).toContain("data:image/png");
      expect(res.body.callbackUrl).toContain("/api/lnauth/callback");
    });

    it("creates challenge in storage", async () => {
      const res = await agent.get("/api/lnauth/challenge");
      const challenge = await getMockStorage().getChallenge(res.body.k1);

      expect(challenge).toBeDefined();
      expect(challenge!.used).toBe(false);
    });
  });

  describe("GET /api/lnauth/callback", () => {
    it("returns error for missing parameters", async () => {
      const res = await agent
        .get("/api/lnauth/callback")
        .query({ tag: "login", k1: "test" });

      expect(res.body.status).toBe("ERROR");
      expect(res.body.reason).toContain("Missing");
    });

    it("returns error for unknown challenge", async () => {
      const res = await agent
        .get("/api/lnauth/callback")
        .query({ tag: "login", k1: "nonexistent", sig: "aabb", key: "ccdd" });

      expect(res.body.status).toBe("ERROR");
      expect(res.body.reason).toContain("Unknown");
    });

    it("returns error for already used challenge", async () => {
      const mockStore = getMockStorage();
      const challenge = await mockStore.createChallenge("used-k1");
      await mockStore.completeChallenge("used-k1", "pubkey", "token");

      const res = await agent
        .get("/api/lnauth/callback")
        .query({ tag: "login", k1: "used-k1", sig: "aabb", key: "ccdd" });

      expect(res.body.status).toBe("ERROR");
      expect(res.body.reason).toContain("already used");
    });
  });

  describe("GET /api/lnauth/status", () => {
    it("returns authenticated: false before auth", async () => {
      const challengeRes = await agent.get("/api/lnauth/challenge");
      const { k1 } = challengeRes.body;

      const res = await agent
        .get("/api/lnauth/status")
        .query({ k1 });

      expect(res.body.authenticated).toBe(false);
    });

    it("returns authenticated: true after challenge completed", async () => {
      const mockStore = getMockStorage();
      await mockStore.createChallenge("auth-k1");
      const user = await mockStore.createUser({ pubkey: "test-pubkey" });
      const session = await mockStore.createSession(user.id);
      await mockStore.completeChallenge("auth-k1", "test-pubkey", session.token);

      const res = await agent
        .get("/api/lnauth/status")
        .query({ k1: "auth-k1" });

      expect(res.body.authenticated).toBe(true);
      expect(res.body.sessionToken).toBe(session.token);
      expect(res.body.pubkey).toBe("test-pubkey");
    });

    it("returns authenticated: false for missing k1", async () => {
      const res = await agent.get("/api/lnauth/status");

      expect(res.body.authenticated).toBe(false);
    });
  });
});
