import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp, resetMockStorage, createAuthenticatedUser, authHeader, getMockStorage, uniqueIp } from "../helpers";

describe("Auth routes", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  describe("POST /api/auth/register", () => {
    it("registers a new user successfully", async () => {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp())
        .send({ email: "new@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.sessionToken).toBeDefined();
      expect(res.body.userId).toBeDefined();
      expect(res.body.email).toBe("new@test.com");
      expect(res.body.emailVerified).toBe(false);
    });

    it("returns 409 for duplicate email", async () => {
      const ip = uniqueIp();
      await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip)
        .send({ email: "dupe@test.com", password: "password123" });

      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip)
        .send({ email: "dupe@test.com", password: "password456" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already registered");
    });

    it("returns 400 for missing email", async () => {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp())
        .send({ password: "password123" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing password", async () => {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp())
        .send({ email: "test@test.com" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for short password", async () => {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp())
        .send({ email: "test@test.com", password: "12345" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp())
        .send({ email: "not-an-email", password: "password123" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with correct credentials", async () => {
      const ip = uniqueIp();
      await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip)
        .send({ email: "login@test.com", password: "password123" });

      const res = await agent
        .post("/api/auth/login")
        .set("x-forwarded-for", ip)
        .send({ email: "login@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.sessionToken).toBeDefined();
    });

    it("returns 401 for wrong password", async () => {
      const ip = uniqueIp();
      await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip)
        .send({ email: "wrongpw@test.com", password: "password123" });

      const res = await agent
        .post("/api/auth/login")
        .set("x-forwarded-for", ip)
        .send({ email: "wrongpw@test.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
    });

    it("returns 401 for nonexistent email", async () => {
      const res = await agent
        .post("/api/auth/login")
        .set("x-forwarded-for", uniqueIp())
        .send({ email: "nobody@test.com", password: "password123" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/verify", () => {
    it("returns authenticated true with valid token", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);

      const res = await agent
        .get("/api/auth/verify")
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.userId).toBeDefined();
    });

    it("returns authenticated false with no token", async () => {
      const res = await agent.get("/api/auth/verify");

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("returns authenticated false with invalid token", async () => {
      const res = await agent
        .get("/api/auth/verify")
        .set(authHeader("invalid-token-here"));

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("deletes session and subsequent verify returns false", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);

      const logoutRes = await agent
        .post("/api/auth/logout")
        .set(authHeader(sessionToken));

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.ok).toBe(true);

      const verifyRes = await agent
        .get("/api/auth/verify")
        .set(authHeader(sessionToken));

      expect(verifyRes.body.authenticated).toBe(false);
    });
  });

  describe("GET /api/auth/verify-email", () => {
    it("verifies email with valid token", async () => {
      const { userId } = await createAuthenticatedUser(agent);
      const mockStore = getMockStorage();
      const user = mockStore.users.get(userId)!;
      const token = user.verificationToken!;

      const res = await agent.get(`/api/auth/verify-email?token=${token}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("VERIFIED");

      const updatedUser = mockStore.users.get(userId)!;
      expect(updatedUser.emailVerified).toBe(true);
    });

    it("returns error for invalid token", async () => {
      const res = await agent.get("/api/auth/verify-email?token=invalid-token");

      expect(res.status).toBe(400);
      expect(res.text).toContain("ERROR");
    });

    it("returns 400 for missing token", async () => {
      const res = await agent.get("/api/auth/verify-email");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("resends verification for authenticated user", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent);
      const { sendVerificationEmail } = await import("../../server/email");

      const res = await agent
        .post("/api/auth/resend-verification")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendVerificationEmail).toHaveBeenCalled();
    });

    it("returns 401 for unauthenticated user", async () => {
      const res = await agent
        .post("/api/auth/resend-verification")
        .set("x-forwarded-for", uniqueIp());

      expect(res.status).toBe(401);
    });

    it("returns alreadyVerified if email already verified", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });

      const res = await agent
        .post("/api/auth/resend-verification")
        .set("x-forwarded-for", ip)
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.alreadyVerified).toBe(true);
    });
  });
});
