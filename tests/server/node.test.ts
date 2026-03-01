import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestApp, resetMockStorage, createAuthenticatedUser, authHeader, uniqueIp } from "../helpers";
import { nodeManager } from "../../server/bitcoin-node";

describe("Node routes", () => {
  let agent: any;

  beforeEach(async () => {
    resetMockStorage();
    agent = await createTestApp();
    vi.mocked(nodeManager.getStatus).mockReturnValue({ running: false } as any);
    vi.mocked(nodeManager.exec).mockResolvedValue({ result: "mock-result" });
    vi.mocked(nodeManager.rpc).mockResolvedValue("mock-rpc-result" as any);
    vi.mocked(nodeManager.getOrCreate).mockResolvedValue({} as any);
  });

  describe("GET /api/node/status", () => {
    it("returns running: false when no node", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .get("/api/node/status")
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.running).toBe(false);
    });

    it("provisions node when provision=true", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .get("/api/node/status?provision=true")
        .set(authHeader(sessionToken));

      expect(res.status).toBe(200);
      expect(res.body.running).toBe(true);
      expect(nodeManager.getOrCreate).toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await agent.get("/api/node/status");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/node/exec", () => {
    it("executes command successfully", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/exec")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({ command: "getblockcount" });

      expect(res.status).toBe(200);
      expect(nodeManager.exec).toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await agent
        .post("/api/node/exec")
        .send({ command: "getblockcount" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for missing command", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/exec")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 for too-long command", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/exec")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({ command: "x".repeat(2001) });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/node/rpc", () => {
    it("calls RPC method successfully", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/rpc")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({ method: "getblockcount", params: [] });

      expect(res.status).toBe(200);
      expect(nodeManager.rpc).toHaveBeenCalled();
    });

    it("returns 401 when unauthenticated", async () => {
      const res = await agent
        .post("/api/node/rpc")
        .send({ method: "getblockcount" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for non-array params", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/rpc")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({ method: "getblock", params: "not-array" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing method", async () => {
      const { sessionToken } = await createAuthenticatedUser(agent);
      const res = await agent
        .post("/api/node/rpc")
        .set("x-forwarded-for", uniqueIp())
        .set(authHeader(sessionToken))
        .send({ params: [] });

      expect(res.status).toBe(400);
    });
  });
});
