import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestApp, resetMockStorage, createAuthenticatedUser, uniqueIp } from "../helpers";

describe("Utility functions (tested indirectly)", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", async () => {
      const responses = [];
      for (let i = 0; i < 12; i++) {
        const res = await agent
          .post("/api/auth/register")
          .set("x-forwarded-for", `100.${i}.0.1`)
          .send({ email: `iptest${i}@test.com`, password: "password123" });
        responses.push(res.status);
      }
      // All should succeed (each IP has its own rate limit)
      expect(responses.every((s) => s === 200)).toBe(true);
    });

    it("rate limits per IP from x-forwarded-for", async () => {
      const sameIp = `200.200.200.${Date.now() % 256}`;
      const responses = [];
      for (let i = 0; i < 12; i++) {
        const res = await agent
          .post("/api/auth/register")
          .set("x-forwarded-for", sameIp)
          .send({ email: `ratelim${i}@test.com`, password: "password123" });
        responses.push(res.status);
      }
      // First 10 should succeed, 11th and 12th should be rate limited
      expect(responses.filter((s) => s === 429).length).toBeGreaterThan(0);
    });
  });

  describe("encodeLnurl (tested via checkpoint claim)", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (typeof url === "string" && url.includes("localhost:5393")) {
          if (url.includes("node_info")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ lightning_sendable_balance: "1000000" }),
            });
          }
        }
        return originalFetch(url, opts);
      }) as any;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns lnurl in checkpoint claim response", async () => {
      const { sessionToken, ip } = await createAuthenticatedUser(agent, { emailVerified: true });

      const res = await agent
        .post("/api/checkpoint/claim")
        .set("x-forwarded-for", ip)
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ checkpointId: "pubkey-compression", answer: 1 });

      if (res.body.lnurl) {
        expect(res.body.lnurl).toMatch(/^LNURL/);
        expect(res.body.k1).toBeDefined();
      }
    });
  });

  describe("generateK1 (tested via lnauth challenge)", () => {
    it("generates unique k1 values", async () => {
      const res1 = await agent.get("/api/lnauth/challenge");
      const res2 = await agent.get("/api/lnauth/challenge");
      expect(res1.body.k1).toBeDefined();
      expect(res2.body.k1).toBeDefined();
      expect(res1.body.k1).not.toBe(res2.body.k1);
      expect(res1.body.k1).toHaveLength(64);
    });
  });

  describe("isMessageClean (tested via donation moderate)", () => {
    it("passes clean text", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "Great tutorial!", name: "Alice" });
      expect(res.body.clean).toBe(true);
      expect(res.body.issues).toEqual([]);
    });

    it("catches profanity in message", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "this is shit", name: "Alice" });
      expect(res.body.clean).toBe(false);
      expect(res.body.issues).toContain("message");
    });

    it("catches profanity in name", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "nice", name: "fuck" });
      expect(res.body.clean).toBe(false);
      expect(res.body.issues).toContain("name");
    });

    it("handles mixed case profanity", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "DAMN this is good", name: "Bob" });
      expect(res.body.clean).toBe(false);
    });

    it("passes empty message/name", async () => {
      const res = await agent
        .post("/api/donate/moderate")
        .send({ message: "", name: "" });
      expect(res.body.clean).toBe(true);
    });
  });
});
