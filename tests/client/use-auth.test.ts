// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../../client/src/hooks/use-auth";

describe("useAuth", () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Mock fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("starts in loading state", () => {
    // Need a token so the hook enters the async fetch path;
    // without a token the effect synchronously sets loading=false
    // before renderHook returns (act flushes synchronous state updates).
    localStorage.setItem("pl-session-token", "test-token");
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
  });

  it("sets loading false when no token", async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.authenticated).toBe(false);
  });

  it("fetches /api/auth/verify on mount when token exists", async () => {
    localStorage.setItem("pl-session-token", "test-token");

    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : (url as Request).url || url.toString();
      if (urlStr.includes("/api/auth/verify")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            userId: "user-1",
            email: "test@test.com",
            displayName: "Test",
            rewardClaimed: false,
            lightningAddress: null,
            emailVerified: true,
          }),
        } as Response);
      }
      if (urlStr.includes("/api/checkpoint/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ completed: [] }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.authenticated).toBe(true);
    expect(result.current.email).toBe("test@test.com");
  });

  it("hydrates from localStorage cache", () => {
    localStorage.setItem("pl-session-token", "cached-token");
    localStorage.setItem("pl-auth-cache", JSON.stringify({
      authenticated: true,
      userId: "cached-user",
      email: "cached@test.com",
      displayName: "Cached",
      completedCheckpoints: [],
    }));

    const { result } = renderHook(() => useAuth());

    // Should immediately show cached data while loading
    expect(result.current.authenticated).toBe(true);
    expect(result.current.email).toBe("cached@test.com");
    expect(result.current.loading).toBe(true);
  });

  it("loginWithToken stores session", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ completed: [] }),
    } as Response);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.loginWithToken("new-token", {
        userId: "new-user",
        email: "new@test.com",
        displayName: "New",
      });
    });

    await waitFor(() => {
      expect(result.current.authenticated).toBe(true);
    });

    expect(localStorage.getItem("pl-session-token")).toBe("new-token");
  });

  it("logout clears state", async () => {
    localStorage.setItem("pl-session-token", "old-token");

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    } as Response);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(localStorage.getItem("pl-session-token")).toBeNull();
    expect(localStorage.getItem("pl-auth-cache")).toBeNull();
  });

  it("markCheckpointCompleted adds to list", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    } as Response);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.markCheckpointCompleted("test-checkpoint", 21);
    });

    expect(result.current.completedCheckpoints).toHaveLength(1);
    expect(result.current.completedCheckpoints[0].checkpointId).toBe("test-checkpoint");
    expect(result.current.completedCheckpoints[0].amountSats).toBe(21);
  });

  it("markCheckpointCompleted doesn't duplicate", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    } as Response);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.markCheckpointCompleted("test-cp");
    });
    act(() => {
      result.current.markCheckpointCompleted("test-cp");
    });

    expect(result.current.completedCheckpoints).toHaveLength(1);
  });
});
