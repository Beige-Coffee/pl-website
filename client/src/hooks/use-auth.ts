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

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
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
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setAuth((a) => ({ ...a, loading: false }));
      return;
    }

    Promise.all([
      fetch("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/checkpoint/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ completed: [] })),
    ])
      .then(([data, cpData]) => {
        if (data.authenticated) {
          setAuth({
            authenticated: true,
            userId: data.userId,
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
        } else {
          localStorage.removeItem(STORAGE_KEY);
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

  const loginWithToken = useCallback((token: string, data: Partial<AuthState>) => {
    localStorage.setItem(STORAGE_KEY, token);
    fetch("/api/checkpoint/status", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .catch(() => ({ completed: [] }))
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

  const markRewardClaimed = useCallback(() => {
    setAuth((a) => ({ ...a, rewardClaimed: true }));
  }, []);

  const markCheckpointCompleted = useCallback((checkpointId: string, amountSats?: number) => {
    setAuth((a) => ({
      ...a,
      completedCheckpoints: a.completedCheckpoints.some(c => c.checkpointId === checkpointId)
        ? a.completedCheckpoints
        : [...a.completedCheckpoints, { checkpointId, amountSats: amountSats || 0, paidAt: new Date().toISOString() }],
    }));
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

  return { ...auth, loginWithToken, logout, markRewardClaimed, markCheckpointCompleted, setLightningAddress };
}
