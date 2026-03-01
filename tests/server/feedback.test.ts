import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, createAuthenticatedUser, authHeader, getMockStorage, uniqueIp } from "../helpers";

describe("Feedback routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
    originalFetch = globalThis.fetch;
    // Mock GitHub API for issue creation
    globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (typeof url === "string" && url.includes("api.github.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ html_url: "https://github.com/test/issues/1" }),
        });
      }
      return originalFetch(url, opts);
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("POST /api/feedback", () => {
    it("creates feedback without auth", async () => {
      const res = await agent
        .post("/api/feedback")
        .set("x-forwarded-for", uniqueIp())
        .send({
          category: "bug",
          message: "Something is broken",
          pageUrl: "/lightning-tutorial",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBeDefined();
    });

    it("creates feedback with auth and associates userId", async () => {
      const { sessionToken, userId } = await createAuthenticatedUser(agent);

      const res = await agent
        .post("/api/feedback")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({
          category: "suggestion",
          message: "Add more exercises",
          pageUrl: "/lightning-tutorial",
          chapterTitle: "Keys & Derivation",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const feedback = getMockStorage().feedbackRecords.get(res.body.id);
      expect(feedback?.userId).toBe(userId);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await agent
        .post("/api/feedback")
        .set("x-forwarded-for", uniqueIp())
        .send({ category: "bug" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid category", async () => {
      const res = await agent
        .post("/api/feedback")
        .set("x-forwarded-for", uniqueIp())
        .send({
          category: "invalid-category",
          message: "test",
          pageUrl: "/test",
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 for message too long", async () => {
      const res = await agent
        .post("/api/feedback")
        .set("x-forwarded-for", uniqueIp())
        .send({
          category: "bug",
          message: "x".repeat(5001),
          pageUrl: "/test",
        });

      expect(res.status).toBe(400);
    });

    it("accepts all valid categories", async () => {
      for (const category of ["bug", "confusing", "suggestion", "other"]) {
        const res = await agent
          .post("/api/feedback")
          .set("x-forwarded-for", uniqueIp())
          .send({
            category,
            message: `Test ${category}`,
            pageUrl: "/test",
          });

        expect(res.status).toBe(200);
      }
    });
  });
});
