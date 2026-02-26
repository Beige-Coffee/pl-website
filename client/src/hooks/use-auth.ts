import { useState, useEffect, useCallback } from "react";

export interface CheckpointClaim {
  checkpointId: string;
  amountSats: number;
  paidAt: string;
}

interface AuthState {
  authenticated: boolean;
  userId: string | null;
  pubkey: string | null;
  email: string | null;
  displayName: string | null;
  rewardClaimed: boolean;
  lightningAddress: string | null;
  emailVerified: boolean;
  completedCheckpoints: CheckpointClaim[];
  sessionToken: string | null;
  loading: boolean;
}

const STORAGE_KEY = "pl-session-token";
const AUTH_CACHE_KEY = "pl-auth-cache";

// Server data is authoritative — with exercise IDs registered server-side,
// all completions are persisted and returned by /api/checkpoint/status
function mergeCheckpoints(server: CheckpointClaim[], _cached: CheckpointClaim[]): CheckpointClaim[] {
  return server;
}

function loadCache(): Partial<AuthState> | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveCache(state: AuthState) {
  try {
    // Cache everything except loading and sessionToken (token has its own key)
    const { loading: _, sessionToken: __, ...rest } = state;
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(rest));
  } catch {}
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const cached = token ? loadCache() : null;
    if (token && cached) {
      return {
        authenticated: cached.authenticated ?? false,
        userId: cached.userId ?? null,
        pubkey: cached.pubkey ?? null,
        email: cached.email ?? null,
        displayName: cached.displayName ?? null,
        rewardClaimed: cached.rewardClaimed ?? false,
        lightningAddress: cached.lightningAddress ?? null,
        emailVerified: cached.emailVerified ?? false,
        completedCheckpoints: cached.completedCheckpoints ?? [],
        sessionToken: token,
        loading: true,
      };
    }
    return {
      authenticated: false,
      userId: null,
      pubkey: null,
      email: null,
      displayName: null,
      rewardClaimed: false,
      lightningAddress: null,
      emailVerified: false,
      completedCheckpoints: [],
      sessionToken: token,
      loading: true,
    };
  });

  // Cache auth state whenever it changes (after loading completes)
  useEffect(() => {
    if (auth.sessionToken && !auth.loading) {
      saveCache(auth);
    }
  }, [auth]);

  const fetchAuthState = useCallback((token: string) => {
    return Promise.all([
      fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/checkpoint/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(err => { console.warn("Checkpoint status fetch failed:", err); return { completed: [] }; }),
    ])
      .then(([data, cpData]) => {
        if (data.authenticated) {
          const serverCheckpoints: CheckpointClaim[] = cpData.completed || [];
          setAuth((prev) => ({
            authenticated: true,
            userId: data.userId,
            pubkey: data.pubkey || null,
            email: data.email || null,
            displayName: data.displayName || null,
            rewardClaimed: data.rewardClaimed || false,
            lightningAddress: data.lightningAddress || null,
            emailVerified: data.emailVerified || !!data.pubkey,
            completedCheckpoints: mergeCheckpoints(serverCheckpoints, prev.completedCheckpoints),
            sessionToken: token,
            loading: false,
          }));
        } else {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(AUTH_CACHE_KEY);
          setAuth({
            authenticated: false,
            userId: null,
            pubkey: null,
            email: null,
            displayName: null,
            rewardClaimed: false,
            lightningAddress: null,
            emailVerified: false,
            completedCheckpoints: [],
            sessionToken: null,
            loading: false,
          });
        }
      })
      .catch(() => {
        setAuth((a) => ({ ...a, loading: false }));
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setAuth((a) => ({ ...a, loading: false }));
      return;
    }
    fetchAuthState(token);
  }, [fetchAuthState]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const token = localStorage.getItem(STORAGE_KEY);
        if (token) fetchAuthState(token);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchAuthState]);

  const loginWithToken = useCallback((token: string, data: Partial<AuthState>) => {
    localStorage.setItem(STORAGE_KEY, token);
    fetch("/api/checkpoint/status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .catch(err => { console.warn("Checkpoint status fetch failed:", err); return { completed: [] }; })
      .then((cpData) => {
        setAuth({
          authenticated: true,
          userId: data.userId || null,
          pubkey: data.pubkey || null,
          email: data.email || null,
          displayName: data.displayName || null,
          rewardClaimed: data.rewardClaimed || false,
          lightningAddress: data.lightningAddress || null,
          emailVerified: data.emailVerified || !!data.pubkey,
          completedCheckpoints: cpData.completed || [],
          sessionToken: token,
          loading: false,
        });
      });
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUTH_CACHE_KEY);
    setAuth({
      authenticated: false,
      userId: null,
      pubkey: null,
      email: null,
      displayName: null,
      rewardClaimed: false,
      lightningAddress: null,
      emailVerified: false,
      completedCheckpoints: [],
      sessionToken: null,
      loading: false,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;
    try {
      const [data, cpData] = await Promise.all([
        fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch("/api/checkpoint/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(err => { console.warn("Checkpoint status fetch failed:", err); return { completed: [] }; }),
      ]);
      if (data.authenticated) {
        const serverCheckpoints: CheckpointClaim[] = cpData.completed || [];
        setAuth((prev) => ({
          authenticated: true,
          userId: data.userId,
          pubkey: data.pubkey || null,
          email: data.email || null,
          displayName: data.displayName || null,
          rewardClaimed: data.rewardClaimed || false,
          lightningAddress: data.lightningAddress || null,
          emailVerified: data.emailVerified || !!data.pubkey,
          completedCheckpoints: mergeCheckpoints(serverCheckpoints, prev.completedCheckpoints),
          sessionToken: token,
          loading: false,
        }));
      }
    } catch {}
  }, []);

  const markRewardClaimed = useCallback(() => {
    setAuth((a) => ({ ...a, rewardClaimed: true }));
  }, []);

  const markCheckpointCompleted = useCallback((checkpointId: string, amountSats?: number) => {
    setAuth((a) => {
      const existing = a.completedCheckpoints.find(c => c.checkpointId === checkpointId);
      if (existing) {
        // Update amountSats/paidAt if a reward was just claimed
        if (amountSats && amountSats > 0 && existing.amountSats === 0) {
          return {
            ...a,
            completedCheckpoints: a.completedCheckpoints.map(c =>
              c.checkpointId === checkpointId
                ? { ...c, amountSats, paidAt: new Date().toISOString() }
                : c
            ),
          };
        }
        return a;
      }
      return {
        ...a,
        completedCheckpoints: [...a.completedCheckpoints, { checkpointId, amountSats: amountSats || 0, paidAt: new Date().toISOString() }],
      };
    });
  }, []);

  const setLightningAddress = useCallback(async (address: string | null) => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) return;
    const res = await fetch("/api/user/lightning-address", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lightningAddress: address }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to save lightning address");
    }
    setAuth((a) => ({ ...a, lightningAddress: address }));
  }, []);

  return { ...auth, loginWithToken, logout, refreshAuth, markRewardClaimed, markCheckpointCompleted, setLightningAddress };
}
