import { useState, useEffect, useCallback, useRef } from "react";

interface AuthState {
  authenticated: boolean;
  pubkey: string | null;
  sessionToken: string | null;
  loading: boolean;
}

const STORAGE_KEY = "pl-lnauth-token";

export function useLnAuth() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    pubkey: null,
    sessionToken: null,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setAuth((a) => ({ ...a, loading: false }));
      return;
    }

    fetch("/api/lnauth/verify", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setAuth({
            authenticated: true,
            pubkey: data.pubkey,
            sessionToken: token,
            loading: false,
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setAuth({ authenticated: false, pubkey: null, sessionToken: null, loading: false });
        }
      })
      .catch(() => {
        setAuth((a) => ({ ...a, loading: false }));
      });
  }, []);

  const login = useCallback((token: string, pubkey: string) => {
    localStorage.setItem(STORAGE_KEY, token);
    setAuth({ authenticated: true, pubkey, sessionToken: token, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ authenticated: false, pubkey: null, sessionToken: null, loading: false });
  }, []);

  return { ...auth, login, logout };
}

interface ChallengeData {
  k1: string;
  lnurl: string;
  qr: string;
  callbackUrl: string;
}

export function useLnAuthChallenge() {
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lnauth/challenge");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChallenge(data);
    } catch (e: any) {
      setError(e.message || "Failed to generate challenge");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollStatus = useCallback(
    (k1: string, onSuccess: (token: string, pubkey: string) => void) => {
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/lnauth/status?k1=${k1}`);
          const data = await res.json();
          if (data.authenticated) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            onSuccess(data.sessionToken, data.pubkey);
          }
        } catch {
        }
      }, 2000);
    },
    []
  );

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { challenge, loading, error, generate, pollStatus, stopPolling };
}
