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

  // Mirror of serverProgress kept in a ref so saveProgress can update it
  // without triggering a React re-render on every keystroke. Components that
  // need the latest value (like CodeExercise's hydration effect) read from
  // getProgress, which checks the ref first.
  const progressRef = useRef<Record<string, string> | null>(serverProgress);

  // Keep ref in sync when state changes (initial load, server fetch)
  useEffect(() => {
    progressRef.current = serverProgress;
  }, [serverProgress]);

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

      // Update ref (no re-render) + localStorage so the value is available
      // immediately via getProgress without triggering a page-wide re-render.
      const next = progressRef.current ? { ...progressRef.current, [key]: value } : { [key]: value };
      progressRef.current = next;
      try { localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(next)); } catch {}

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
      // Check ref first (has latest saves), fall back to state
      const source = progressRef.current ?? serverProgress;
      if (!source) return null;
      return source[key] ?? null;
    },
    [serverProgress]
  );

  return { loaded, getProgress, saveProgress, serverProgress };
}
