import { app } from "../server/app";
import { registerRoutes } from "../server/routes";
import supertest from "supertest";
import { storage } from "../server/storage";
import type { MockStorage } from "./mocks/storage";

let testServer: ReturnType<typeof supertest> | null = null;
let serverPromise: Promise<ReturnType<typeof supertest>> | null = null;

/**
 * Creates (or reuses) a supertest agent wrapping the Express app with routes registered.
 * Routes are registered once and reused across tests in the same file.
 */
export async function createTestApp() {
  if (testServer) return testServer;
  if (serverPromise) return serverPromise;

  serverPromise = (async () => {
    const httpServer = await registerRoutes(app);
    testServer = supertest(httpServer);
    return testServer;
  })();

  return serverPromise;
}

/**
 * Get the mock storage instance for direct inspection/manipulation.
 */
export function getMockStorage(): MockStorage {
  return storage as unknown as MockStorage;
}

/**
 * Resets the mock storage - clears all data between tests.
 */
export function resetMockStorage() {
  getMockStorage().reset();
}

/**
 * Counter for generating unique IPs to avoid rate limiter collisions.
 * The rate limiter is a singleton that persists across tests.
 */
let ipCounter = 0;

/**
 * Returns a unique IP address for each call, ensuring rate limiters
 * don't interfere across tests.
 */
export function uniqueIp(): string {
  ipCounter++;
  const a = (ipCounter >> 16) & 255;
  const b = (ipCounter >> 8) & 255;
  const c = ipCounter & 255;
  return `10.${a}.${b}.${c}`;
}

/**
 * Registers a test user and returns their session token and user ID.
 * Uses a unique IP to avoid rate limiter interference.
 */
export async function createAuthenticatedUser(
  agent: ReturnType<typeof supertest>,
  options?: { email?: string; password?: string; emailVerified?: boolean }
) {
  const email = options?.email || `test-${Date.now()}-${ipCounter}@example.com`;
  const password = options?.password || "testpassword123";
  const ip = uniqueIp();

  const res = await agent
    .post("/api/auth/register")
    .set("x-forwarded-for", ip)
    .send({ email, password });

  const { sessionToken, userId } = res.body;

  // Optionally verify email (needed for reward claims)
  if (options?.emailVerified) {
    const mockStore = getMockStorage();
    const user = mockStore.users.get(userId);
    if (user) {
      mockStore.users.set(userId, { ...user, emailVerified: true });
    }
  }

  return { sessionToken, userId, email, ip };
}

/**
 * Makes an authenticated request with the given session token.
 */
export function authHeader(sessionToken: string) {
  return { Authorization: `Bearer ${sessionToken}` };
}
