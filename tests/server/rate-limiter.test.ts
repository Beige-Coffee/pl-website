import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp, resetMockStorage } from "../helpers";

describe("RateLimiter (tested via auth endpoints)", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
  });

  it("allows requests under the limit", async () => {
    // Auth limiter allows 10 per minute per IP
    const uniqueIp = `rate-test-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp)
        .send({ email: `ratelimit${i}@test.com`, password: "password123" });
      expect(res.status).toBe(200);
    }
  });

  it("blocks requests over the limit", async () => {
    const uniqueIp = `rate-block-${Date.now()}`;
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      const res = await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", uniqueIp)
        .send({ email: `rateblock${i}@test.com`, password: "password123" });
      statuses.push(res.status);
    }
    // First 10 should pass, rest should be 429
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
  });

  it("tracks different IPs independently", async () => {
    const ip1 = `ip1-${Date.now()}`;
    const ip2 = `ip2-${Date.now()}`;

    // Exhaust ip1's limit
    for (let i = 0; i < 11; i++) {
      await agent
        .post("/api/auth/register")
        .set("x-forwarded-for", ip1)
        .send({ email: `ip1user${i}@test.com`, password: "password123" });
    }

    // ip2 should still work
    const res = await agent
      .post("/api/auth/register")
      .set("x-forwarded-for", ip2)
      .send({ email: "ip2user@test.com", password: "password123" });
    expect(res.status).toBe(200);
  });
});
