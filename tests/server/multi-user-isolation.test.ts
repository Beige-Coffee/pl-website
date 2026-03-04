import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestApp,
  resetMockStorage,
  createAuthenticatedUser,
  authHeader,
  uniqueIp,
} from "../helpers";

describe("Multi-user isolation", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  describe("Registration", () => {
    it("two users register independently with unique emails", async () => {
      const ip1 = uniqueIp();
      const ip2 = uniqueIp();

      const res1 = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip1)
        .send({ email: "user1@test.com", password: "password123" });

      const res2 = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip2)
        .send({ email: "user2@test.com", password: "password456" });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.userId).not.toBe(res2.body.userId);
      expect(res1.body.sessionToken).not.toBe(res2.body.sessionToken);
    });

    it("concurrent registrations do not conflict", async () => {
      const results = await Promise.all(
        [1, 2, 3].map((i) =>
          agent
            .post("/api/auth/register")
            .set("x-forwarded-for", uniqueIp())
            .send({ email: `concurrent-${i}@test.com`, password: "password123" })
        )
      );

      results.forEach((res: any) => {
        expect(res.status).toBe(200);
        expect(res.body.authenticated).toBe(true);
      });

      // All user IDs should be distinct
      const ids = results.map((r: any) => r.body.userId);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe("Exercise progress isolation", () => {
    it("user A's progress is not visible to user B", async () => {
      const userA = await createAuthenticatedUser(agent);
      const userB = await createAuthenticatedUser(agent);

      // User A saves exercise progress
      await agent
        .post("/api/progress")
        .set(authHeader(userA.sessionToken))
        .send({ key: "exercise-1", value: "completed" });

      // User A sees their progress
      const resA = await agent
        .get("/api/progress")
        .set(authHeader(userA.sessionToken));
      expect(resA.status).toBe(200);
      expect(resA.body.progress["exercise-1"]).toBe("completed");

      // User B sees empty progress
      const resB = await agent
        .get("/api/progress")
        .set(authHeader(userB.sessionToken));
      expect(resB.status).toBe(200);
      expect(resB.body.progress["exercise-1"]).toBeUndefined();
    });
  });

  describe("Checkpoint completion isolation", () => {
    it("user A's checkpoint completion is not visible to user B", async () => {
      const userA = await createAuthenticatedUser(agent);
      const userB = await createAuthenticatedUser(agent);

      // User A completes a checkpoint (answer index 1 = correct for "pubkey-compression")
      const completeRes = await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(userA.sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.correct).toBe(true);

      // User A sees checkpoint as completed
      const statusA = await agent
        .get("/api/checkpoint/status")
        .set(authHeader(userA.sessionToken));
      expect(statusA.body.completed.some((c: any) => c.checkpointId === "pubkey-compression")).toBe(true);

      // User B sees no completed checkpoints
      const statusB = await agent
        .get("/api/checkpoint/status")
        .set(authHeader(userB.sessionToken));
      expect(statusB.body.completed.some((c: any) => c.checkpointId === "pubkey-compression")).toBe(false);
    });
  });

  describe("Session isolation", () => {
    it("user A's session token cannot access user B's data", async () => {
      const userA = await createAuthenticatedUser(agent);
      const userB = await createAuthenticatedUser(agent);

      // User B saves progress
      await agent
        .post("/api/progress")
        .set(authHeader(userB.sessionToken))
        .send({ key: "my-exercise", value: "done" });

      // User A's token returns A's progress (empty), not B's
      const resA = await agent
        .get("/api/progress")
        .set(authHeader(userA.sessionToken));
      expect(resA.body.progress["my-exercise"]).toBeUndefined();

      // Verify auth returns correct user identity
      const verifyA = await agent
        .get("/api/auth/verify")
        .set(authHeader(userA.sessionToken));
      const verifyB = await agent
        .get("/api/auth/verify")
        .set(authHeader(userB.sessionToken));
      expect(verifyA.body.userId).toBe(userA.userId);
      expect(verifyB.body.userId).toBe(userB.userId);
      expect(verifyA.body.userId).not.toBe(verifyB.body.userId);
    });
  });

  describe("Logout", () => {
    it("logout invalidates session token", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);

      // Logout
      const logoutRes = await agent
        .post("/api/auth/logout")
        .set(authHeader(sessionToken));
      expect(logoutRes.status).toBe(200);

      // Subsequent requests with the token fail auth
      const verifyRes = await agent
        .get("/api/auth/verify")
        .set(authHeader(sessionToken));
      expect(verifyRes.body.authenticated).toBe(false);

      // Progress endpoint should return 401
      const progressRes = await agent
        .get("/api/progress")
        .set(authHeader(sessionToken));
      expect(progressRes.status).toBe(401);
    });
  });

  describe("Login restores access", () => {
    it("logging back in restores saved progress", async () => {
      const ip = uniqueIp();
      const email = "persist@test.com";
      const password = "password123";

      // Register and save progress
      const regRes = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip)
        .send({ email, password });
      const { sessionToken: token1 } = regRes.body;

      await agent
        .post("/api/progress")
        .set(authHeader(token1))
        .send({ key: "exercise-5", value: "solved" });

      // Logout
      await agent.post("/api/auth/logout").set(authHeader(token1));

      // Login again (new session token)
      const loginRes = await agent
        .post("/api/auth/login")
        .set("x-forwarded-for", ip)
        .send({ email, password });
      expect(loginRes.status).toBe(200);
      const { sessionToken: token2 } = loginRes.body;

      // Progress is still there
      const progressRes = await agent
        .get("/api/progress")
        .set(authHeader(token2));
      expect(progressRes.body.progress["exercise-5"]).toBe("solved");
    });
  });

  describe("Checkpoint claim isolation", () => {
    it("user A's checkpoint claim does not affect user B", async () => {
      const userA = await createAuthenticatedUser(agent, { emailVerified: true });
      const userB = await createAuthenticatedUser(agent, { emailVerified: true });

      // User A completes checkpoint
      await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(userA.sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      // User B tries to complete the same checkpoint
      const resBComplete = await agent
        .post("/api/checkpoint/complete")
        .set(authHeader(userB.sessionToken))
        .send({ checkpointId: "pubkey-compression", answer: 1 });
      expect(resBComplete.status).toBe(200);
      expect(resBComplete.body.correct).toBe(true);

      // Both users have independent completions
      const statusA = await agent
        .get("/api/checkpoint/status")
        .set(authHeader(userA.sessionToken));
      const statusB = await agent
        .get("/api/checkpoint/status")
        .set(authHeader(userB.sessionToken));

      expect(statusA.body.completed.length).toBe(1);
      expect(statusB.body.completed.length).toBe(1);
    });
  });

  describe("Progress overwrite isolation", () => {
    it("user A overwriting progress does not affect user B's progress", async () => {
      const userA = await createAuthenticatedUser(agent);
      const userB = await createAuthenticatedUser(agent);

      // Both users save progress for the same key
      await agent
        .post("/api/progress")
        .set(authHeader(userA.sessionToken))
        .send({ key: "exercise-1", value: "alpha-solution" });

      await agent
        .post("/api/progress")
        .set(authHeader(userB.sessionToken))
        .send({ key: "exercise-1", value: "beta-solution" });

      // User A overwrites their value
      await agent
        .post("/api/progress")
        .set(authHeader(userA.sessionToken))
        .send({ key: "exercise-1", value: "alpha-v2" });

      // User B's value is unchanged
      const resB = await agent
        .get("/api/progress")
        .set(authHeader(userB.sessionToken));
      expect(resB.body.progress["exercise-1"]).toBe("beta-solution");

      // User A has the updated value
      const resA = await agent
        .get("/api/progress")
        .set(authHeader(userA.sessionToken));
      expect(resA.body.progress["exercise-1"]).toBe("alpha-v2");
    });
  });
});
