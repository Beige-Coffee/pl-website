import { useState, useEffect, useCallback, useRef } from "react";

const DEBOUNCE_MS = 1500;

export function useProgress(sessionToken: string | null) {
  const [serverProgress, setServerProgress] = useState<Record<string, string> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pendingSaves = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!sessionToken) {
      setServerProgress(null);
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
          setServerProgress(data.progress || {});
        }
      } catch {}
      if (!cancelled) setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [sessionToken]);

  const saveProgress = useCallback(
    (key: string, value: string) => {
      if (!sessionToken) return;

      const existing = pendingSaves.current.get(key);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(async () => {
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
      }, DEBOUNCE_MS);

      pendingSaves.current.set(key, timeout);
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
