import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage } from "../helpers";

describe("Tracking routes", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  describe("POST /api/track/pageview", () => {
    it("creates a pageview event", async () => {
      const res = await agent
        .post("/api/track/pageview")
        .send({ page: "/lightning-tutorial", sessionId: "session-123" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.sessionId).toBe("session-123");
    });

    it("returns 400 for missing page", async () => {
      const res = await agent
        .post("/api/track/pageview")
        .send({ sessionId: "session-123" });

      expect(res.status).toBe(400);
    });

    it("includes referrer if provided", async () => {
      const res = await agent
        .post("/api/track/pageview")
        .send({ page: "/tutorial", referrer: "https://google.com", sessionId: "sess-1" });

      expect(res.status).toBe(200);
      const event = await getMockStorage().getPageEventById(res.body.id);
      expect(event?.referrer).toBe("https://google.com");
    });
  });

  describe("POST /api/track/pageview/:id/duration", () => {
    it("updates pageview duration", async () => {
      const createRes = await agent
        .post("/api/track/pageview")
        .send({ page: "/test", sessionId: "sess-1" });

      const id = createRes.body.id;

      const res = await agent
        .post(`/api/track/pageview/${id}/duration`)
        .send({ duration: 120, sessionId: "sess-1" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const event = await getMockStorage().getPageEventById(id);
      expect(event?.duration).toBe(120);
    });

    it("returns 403 for wrong sessionId", async () => {
      const createRes = await agent
        .post("/api/track/pageview")
        .send({ page: "/test", sessionId: "sess-1" });

      const id = createRes.body.id;

      const res = await agent
        .post(`/api/track/pageview/${id}/duration`)
        .send({ duration: 120, sessionId: "wrong-session" });

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid duration", async () => {
      const res = await agent
        .post("/api/track/pageview/1/duration")
        .send({ duration: -5, sessionId: "sess-1" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing sessionId", async () => {
      const res = await agent
        .post("/api/track/pageview/1/duration")
        .send({ duration: 60 });

      expect(res.status).toBe(400);
    });
  });
});
