// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProgress } from "../../client/src/hooks/use-progress";

describe("useProgress", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {} }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns null serverProgress without session token", async () => {
    const { result } = renderHook(() => useProgress(null));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.serverProgress).toBeNull();
  });

  it("fetches progress from server on mount", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: { "ex-1": "code here" } }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(fetch).toHaveBeenCalledWith("/api/progress", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
    }));
  });

  it("getProgress returns saved value", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: { "key-1": "value-1" } }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.getProgress("key-1")).toBe("value-1");
  });

  it("getProgress returns null for unknown key", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {} }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.getProgress("unknown")).toBeNull();
  });

  it("saveProgress debounces by default (1.5s)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {} }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // Switch to fake timers AFTER initial load (so waitFor could work above)
    vi.useFakeTimers();
    const fetchCallsBefore = vi.mocked(fetch).mock.calls.length;

    act(() => {
      result.current.saveProgress("key-1", "val-1");
      result.current.saveProgress("key-1", "val-2");
      result.current.saveProgress("key-1", "val-3");
    });

    // Before debounce fires, no new POST calls
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCallsBefore);

    // After 1.5 seconds, should fire exactly one
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    const postCalls = vi.mocked(fetch).mock.calls.filter(
      ([url, opts]) => typeof url === "string" && url.includes("/api/progress") && (opts as any)?.method === "POST"
    );
    expect(postCalls.length).toBe(1);
  });

  it("immediate flag bypasses debounce", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {} }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.saveProgress("key-1", "immediate-val", true);
    });

    // Should have posted immediately (not waiting for debounce)
    const postCalls = vi.mocked(fetch).mock.calls.filter(
      ([url, opts]) => typeof url === "string" && url.includes("/api/progress") && (opts as any)?.method === "POST"
    );
    expect(postCalls.length).toBe(1);
  });

  it("caches in localStorage", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: { "cached-key": "cached-val" } }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const cached = localStorage.getItem("pl-progress-cache");
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached!);
    expect(parsed["cached-key"]).toBe("cached-val");
  });

  it("saveProgress updates getProgress immediately", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ progress: {} }),
    } as Response);

    const { result } = renderHook(() => useProgress("token-123"));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.saveProgress("new-key", "new-val");
    });

    // Should be immediately available via getProgress (from ref), not waiting for debounce
    expect(result.current.getProgress("new-key")).toBe("new-val");
  });
});
