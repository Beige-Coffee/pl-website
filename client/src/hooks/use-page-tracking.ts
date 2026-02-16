import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function getSessionId(): string {
  let sid = sessionStorage.getItem("pl-tracking-sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("pl-tracking-sid", sid);
  }
  return sid;
}

function sendDuration(eventId: number, duration: number) {
  if (duration <= 0) return;
  const blob = new Blob(
    [JSON.stringify({ duration, sessionId: getSessionId() })],
    { type: "application/json" }
  );
  navigator.sendBeacon(
    `/api/track/pageview/${eventId}/duration`,
    blob
  );
}

export function usePageTracking() {
  const [location] = useLocation();
  const eventIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastPageRef = useRef<string>("");

  useEffect(() => {
    if (location === lastPageRef.current) return;

    if (eventIdRef.current !== null) {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      sendDuration(eventIdRef.current, duration);
    }

    lastPageRef.current = location;
    startTimeRef.current = Date.now();
    eventIdRef.current = null;

    const sessionToken = localStorage.getItem("pl-session-token");
    fetch("/api/track/pageview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        page: location,
        referrer: document.referrer || null,
        sessionId: getSessionId(),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) eventIdRef.current = data.id;
      })
      .catch(() => {});

    return () => {};
  }, [location]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventIdRef.current !== null) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        sendDuration(eventIdRef.current, duration);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}
