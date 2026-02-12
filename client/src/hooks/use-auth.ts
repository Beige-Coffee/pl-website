import { useState, useEffect, useCallback } from "react";

interface AuthState {
  authenticated: boolean;
  userId: string | null;
  pubkey: string | null;
  email: string | null;
  displayName: string | null;
  rewardClaimed: boolean;
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
    sessionToken: null,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setAuth((a) => ({ ...a, loading: false }));
      return;
    }

    fetch("/api/auth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setAuth({
            authenticated: true,
            userId: data.userId,
            pubkey: data.pubkey || null,
            email: data.email || null,
            displayName: data.displayName || null,
            rewardClaimed: data.rewardClaimed || false,
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
    setAuth({
      authenticated: true,
      userId: data.userId || null,
      pubkey: data.pubkey || null,
      email: data.email || null,
      displayName: data.displayName || null,
      rewardClaimed: data.rewardClaimed || false,
      sessionToken: token,
      loading: false,
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
      sessionToken: null,
      loading: false,
    });
  }, []);

  const markRewardClaimed = useCallback(() => {
    setAuth((a) => ({ ...a, rewardClaimed: true }));
  }, []);

  return { ...auth, loginWithToken, logout, markRewardClaimed };
}
