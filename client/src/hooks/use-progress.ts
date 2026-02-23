import { useState, useEffect, useCallback, useRef } from "react";

const DEBOUNCE_MS = 1500;
const PROGRESS_CACHE_KEY = "pl-progress-cache";

export function useProgress(sessionToken: string | null) {
  const [serverProgress, setServerProgress] = useState<Record<string, string> | null>(() => {
    if (!sessionToken) return null;
    try {
      const raw = localStorage.getItem(PROGRESS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });
  const [loaded, setLoaded] = useState(false);
  const pendingSaves = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!sessionToken) {
      setServerProgress(null);
      try { localStorage.removeItem(PROGRESS_CACHE_KEY); } catch {}
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/progress", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const progress = data.progress || {};
          setServerProgress(progress);
          try { localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(progress)); } catch {}
        }
      } catch {}
      if (!cancelled) setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [sessionToken]);

  const saveProgress = useCallback(
    (key: string, value: string, immediate?: boolean) => {
      if (!sessionToken) return;

      // Optimistic local update so getProgress reflects the new value immediately
      setServerProgress(prev => {
        const next = prev ? { ...prev, [key]: value } : { [key]: value };
        try { localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });

      const existing = pendingSaves.current.get(key);
      if (existing) clearTimeout(existing);

      const doSave = async () => {
        pendingSaves.current.delete(key);
        try {
          await fetch("/api/progress", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ key, value }),
          });
        } catch {}
      };

      if (immediate) {
        doSave();
      } else {
        const timeout = setTimeout(doSave, DEBOUNCE_MS);
        pendingSaves.current.set(key, timeout);
      }
    },
    [sessionToken]
  );

  const getProgress = useCallback(
    (key: string): string | null => {
      if (!serverProgress) return null;
      return serverProgress[key] ?? null;
    },
    [serverProgress]
  );

  return { loaded, getProgress, saveProgress, serverProgress };
}
