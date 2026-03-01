import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, getMockStorage, uniqueIp } from "../helpers";

describe("Donation routes", () => {
  let agent: any;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("POST /api/donate/create-invoice", () => {
    it("creates an invoice for valid amount", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("create_invoice")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              invoice: "lnbc210n1test...",
              index: "test-index-123",
              expires_at: "2025-01-01T00:00:00Z",
            }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .post("/api/donate/create-invoice")
        .send({ amount_sats: 100 });

      expect(res.status).toBe(200);
      expect(res.body.invoice).toBeDefined();
      expect(res.body.payment_index).toBeDefined();
      expect(res.body.amount_sats).toBe(100);
    });

    it("rejects amount less than 1", async () => {
      const res = await agent
        .post("/api/donate/create-invoice")
        .send({ amount_sats: 0 });

      expect(res.status).toBe(400);
    });

    it("rejects amount greater than 1000000", async () => {
      const res = await agent
        .post("/api/donate/create-invoice")
        .send({ amount_sats: 1000001 });

      expect(res.status).toBe(400);
    });

    it("rejects non-integer amount", async () => {
      const res = await agent
        .post("/api/donate/create-invoice")
        .send({ amount_sats: 10.5 });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/donate/check-payment", () => {
    it("returns payment status", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("payment?index=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "pending", amount: 100 }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .get("/api/donate/check-payment")
        .query({ index: "test-index" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pending");
    });

    it("normalizes paid statuses", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("payment?index=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "completed" }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .get("/api/donate/check-payment")
        .query({ index: "test-index" });

      expect(res.body.status).toBe("paid");
    });

    it("returns 400 for missing index", async () => {
      const res = await agent.get("/api/donate/check-payment");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/donate/moderate", () => {
    it("passes clean text", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "Great tutorial!", name: "Satoshi" });

      expect(res.body.clean).toBe(true);
      expect(res.body.issues).toEqual([]);
    });

    it("catches profanity", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "this is shit", name: "Good Name" });

      expect(res.body.clean).toBe(false);
      expect(res.body.issues).toContain("message");
    });
  });

  describe("POST /api/donate/complete", () => {
    it("saves donation when payment is verified", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("payment?index=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "completed" }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .post("/api/donate/complete")
        .send({
          payment_index: "donation-idx-1",
          amount_sats: 1000,
          donor_name: "Alice",
          message: "Keep building!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("rejects when payment not confirmed", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("payment?index=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "pending" }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .post("/api/donate/complete")
        .send({
          payment_index: "donation-idx-2",
          amount_sats: 1000,
          donor_name: "Bob",
        });

      expect(res.status).toBe(400);
    });

    it("rejects profane content", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("payment?index=")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "completed" }),
          });
        }
        return originalFetch(url);
      }) as any;

      const res = await agent
        .post("/api/donate/complete")
        .send({
          payment_index: "donation-idx-3",
          amount_sats: 1000,
          donor_name: "fuck",
          message: "test",
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing payment_index", async () => {
      const res = await agent
        .post("/api/donate/complete")
        .send({ amount_sats: 100 });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/donate/wall", () => {
    it("returns donation list", async () => {
      const mockStore = getMockStorage();
      await mockStore.createDonation("idx-1", 1000, "Alice", "Hello!");
      await mockStore.createDonation("idx-2", 500, "Bob", null);

      const res = await agent.get("/api/donate/wall");

      expect(res.status).toBe(200);
      expect(res.body.donations).toBeInstanceOf(Array);
      expect(res.body.donations.length).toBe(2);
    });

    it("returns empty array when no donations", async () => {
      const res = await agent.get("/api/donate/wall");

      expect(res.status).toBe(200);
      expect(res.body.donations).toEqual([]);
    });
  });
});
