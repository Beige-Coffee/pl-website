import type { LearnerCredentials } from "./helpers.ts";

export interface ProvisionedLearner extends LearnerCredentials {
  userId: string;
  displayName: string;
  created: boolean;
}

export interface AdminNodeMetricsResponse {
  nodeMetrics: {
    activeNodes: number;
    maxConcurrent: number;
    idleTimeoutMs: number;
    limiterBypassCount: number;
    startupFailures: number;
    walletReadyFailures: number;
    cleanup: {
      idleStops: number;
      staleDirsRemoved: number;
    };
    provision: {
      count: number;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      totalMs: number;
      maxMs: number;
      lastMs: number;
      avgMs: number;
    };
    rpc: Record<string, {
      count: number;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      totalMs: number;
      maxMs: number;
      lastMs: number;
      avgMs: number;
    }>;
  };
  launchControls: {
    nodeLimiterBypassEnabled: boolean;
  };
}

function getAdminPassword(): string {
  const password = process.env.PL_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Set PL_ADMIN_PASSWORD to use launch-testing admin tooling.");
  }
  return password;
}

function normalizeBaseUrl(baseURL?: string): string {
  return (baseURL || process.env.PL_PROD_BASE_URL || "https://programminglightning.com").replace(/\/$/, "");
}

export function getNodeLoadTestHeaders(): Record<string, string> {
  const token = process.env.PL_NODE_LOAD_TEST_BYPASS_TOKEN;
  return token ? { "x-pl-load-test-token": token } : {};
}

async function adminJson<T>(
  baseURL: string | undefined,
  path: string,
  init: RequestInit & { method?: string },
): Promise<T> {
  const target = `${normalizeBaseUrl(baseURL)}${path}`;
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(getNodeLoadTestHeaders())) {
    headers.set(key, value);
  }
  const response = await fetch(target, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return body as T;
}

export async function provisionLaunchTestLearners(
  baseURL: string | undefined,
  count: number,
  prefix = process.env.PL_LAUNCH_TEST_PREFIX || "launch"
): Promise<{ prefix: string; learners: ProvisionedLearner[] }> {
  const password = getAdminPassword();
  return adminJson<{ prefix: string; learners: ProvisionedLearner[] }>(
    baseURL,
    "/api/admin/test-learners/provision",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, count, prefix }),
    }
  );
}

export async function fetchAdminNodeMetrics(baseURL?: string): Promise<AdminNodeMetricsResponse> {
  const password = getAdminPassword();
  const params = new URLSearchParams({ password });
  return adminJson<AdminNodeMetricsResponse>(
    baseURL,
    `/api/admin/node-metrics?${params.toString()}`,
    {
      method: "GET",
    }
  );
}

export async function resetAdminNodeMetrics(baseURL?: string): Promise<void> {
  const password = getAdminPassword();
  await adminJson<{ success: true }>(
    baseURL,
    "/api/admin/node-metrics/reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }
  );
}
