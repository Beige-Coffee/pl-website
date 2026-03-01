import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage } from "../helpers";

describe("Admin routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
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
});
