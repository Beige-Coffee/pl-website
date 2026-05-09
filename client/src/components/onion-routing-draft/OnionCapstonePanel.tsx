import { useState, useRef, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────────
// OnionCapstonePanel (rebuilt 2026-05-08)
//
// Visual capstone for chapters 12 and 13. Drives a deterministic scripted
// run through a 3-hop Sphinx delivery. Two modes:
//   - "success" → preimage settles back through the route
//   - "failure" → error onion is wrapped back through the route, then Alice
//     trial-decrypts to find the failing hop
//
// Future iteration will wire this to the student's Pyodide-compiled
// OnionPacketBuilder via the CodeExercise infrastructure so the visualization
// runs against real student code.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopId = "alice" | "bob" | "charlie" | "dave";

const HOP_FILL: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};

const HOP_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

export interface OnionCapstonePanelProps {
  mode: "success" | "failure";
  failingHop?: number;
}

const FORWARDERS: HopId[] = ["bob", "charlie", "dave"];

type EventKind =
  | "received"
  | "shared_secret"
  | "payload"
  | "forwarded"
  | "delivered"
  | "failed"
  | "wrapping_error"
  | "alice_received"
  | "trial_decrypt"
  | "decoded";

interface HopEvent {
  hopId: HopId;
  hopIdx: number; // 0..2 for forwarders, -1 for Alice events
  kind: EventKind;
  text: string;
  durationMs: number;
}

function buildScript(
  mode: "success" | "failure",
  failingHop: number,
): HopEvent[] {
  const events: HopEvent[] = [];

  for (let i = 0; i < FORWARDERS.length; i++) {
    const hopId = FORWARDERS[i];
    const isFailingHop = mode === "failure" && i === failingHop;
    const isPastFailure = mode === "failure" && i > failingHop;
    if (isPastFailure) break;

    events.push({
      hopId,
      hopIdx: i,
      kind: "received",
      text: `${HOP_LABEL[hopId]} received 1,366-byte packet (E_${i} = 0x028a3f...)`,
      durationMs: 700,
    });
    events.push({
      hopId,
      hopIdx: i,
      kind: "shared_secret",
      text: `${HOP_LABEL[hopId]} computed ss_${i} = ECDH(${hopId}_priv, E_${i})`,
      durationMs: 600,
    });

    if (isFailingHop) {
      events.push({
        hopId,
        hopIdx: i,
        kind: "payload",
        text: `${HOP_LABEL[hopId]} parsed TLV: amt=${(10_002 - i).toLocaleString()} sat, cltv=block ${260 - i * 40}`,
        durationMs: 800,
      });
      events.push({
        hopId,
        hopIdx: i,
        kind: "failed",
        text: `${HOP_LABEL[hopId]} fails: temporary_channel_failure. Building error onion with um_${hopId} + ammag_${hopId}.`,
        durationMs: 1100,
      });
    } else if (i === FORWARDERS.length - 1 && mode === "success") {
      events.push({
        hopId,
        hopIdx: i,
        kind: "payload",
        text: `${HOP_LABEL[hopId]} parsed TLV: amt=10,000 sat, cltv=block 140, payment_data matches invoice`,
        durationMs: 800,
      });
      events.push({
        hopId,
        hopIdx: i,
        kind: "delivered",
        text: `${HOP_LABEL[hopId]} reveals preimage: 0xa3f1e9c4... HTLC settles backward through the route.`,
        durationMs: 1000,
      });
    } else {
      const next = FORWARDERS[i + 1];
      events.push({
        hopId,
        hopIdx: i,
        kind: "payload",
        text: `${HOP_LABEL[hopId]} parsed TLV: amt=${(10_003 - i).toLocaleString()} sat, cltv=block ${260 - i * 40}, scid=0x010203...`,
        durationMs: 700,
      });
      events.push({
        hopId,
        hopIdx: i,
        kind: "forwarded",
        text: `${HOP_LABEL[hopId]} forwards 1,366-byte packet to ${HOP_LABEL[next]} (E_${i + 1} = 0x02b1c4...)`,
        durationMs: 700,
      });
    }
  }

  // Failure return path
  if (mode === "failure") {
    for (let i = failingHop - 1; i >= 0; i--) {
      const hopId = FORWARDERS[i];
      events.push({
        hopId,
        hopIdx: i,
        kind: "wrapping_error",
        text: `${HOP_LABEL[hopId]} wraps the error with ammag_${hopId} and forwards back upstream.`,
        durationMs: 600,
      });
    }
    events.push({
      hopId: "alice",
      hopIdx: -1,
      kind: "alice_received",
      text: `Alice received the wrapped error. Running decrypt_error_onion...`,
      durationMs: 700,
    });
    for (let i = 0; i <= failingHop; i++) {
      const hopId = FORWARDERS[i];
      const matched = i === failingHop;
      events.push({
        hopId,
        hopIdx: i,
        kind: matched ? "decoded" : "trial_decrypt",
        text: matched
          ? `i=${i}: HMAC(um_${hopId}, peeled[32:]) verifies! Failing hop = ${HOP_LABEL[hopId]}, code = temporary_channel_failure.`
          : `i=${i}: peel ammag_${hopId}, check HMAC(um_${hopId}). Doesn't match, continue.`,
        durationMs: 700,
      });
    }
  }

  return events;
}

const KIND_BADGE: Record<EventKind, { color: string; label: string }> = {
  received: { color: "#3b6aa0", label: "received" },
  shared_secret: { color: "#475569", label: "shared_secret" },
  payload: { color: "#475569", label: "payload" },
  forwarded: { color: "#5a7a2f", label: "forwarded" },
  delivered: { color: "#5a7a2f", label: "delivered" },
  failed: { color: "#a13a3a", label: "failed" },
  wrapping_error: { color: "#a13a3a", label: "wrap_error" },
  alice_received: { color: "#b8860b", label: "alice_received" },
  trial_decrypt: { color: "#475569", label: "trial_decrypt" },
  decoded: { color: "#5a7a2f", label: "decoded" },
};

export function OnionCapstonePanel({
  mode,
  failingHop = 1,
}: OnionCapstonePanelProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [eventLog, setEventLog] = useState<HopEvent[]>([]);
  const cancelRef = useRef(false);

  useEffect(
    () => () => {
      cancelRef.current = true;
    },
    [],
  );

  async function start() {
    cancelRef.current = false;
    setRunning(true);
    setCompleted(false);
    setEventLog([]);
    const script = buildScript(mode, failingHop);
    for (const ev of script) {
      if (cancelRef.current) return;
      setEventLog((prev) => [...prev, ev]);
      await new Promise((r) => setTimeout(r, ev.durationMs));
    }
    setRunning(false);
    setCompleted(true);
  }

  function reset() {
    cancelRef.current = true;
    setRunning(false);
    setCompleted(false);
    setEventLog([]);
  }

  const hopReached = (hopIdx: number) =>
    eventLog.some((e) => e.hopIdx === hopIdx);
  const hopFailed = (hopIdx: number) =>
    eventLog.some((e) => e.hopIdx === hopIdx && e.kind === "failed");

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid={`onion-capstone-${mode}`}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Capstone ·{" "}
            {mode === "success" ? "successful payment" : "failure path"}
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 480 }}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 720 }}>
            {/* Node row */}
            <div className="relative" style={{ height: 100, marginBottom: 18 }}>
              {/* Backbone */}
              <div
                className="absolute"
                style={{
                  top: 30,
                  left: "12%",
                  width: "76%",
                  borderTop: "1.5px dashed #475569",
                }}
              />

              {/* Alice (always lit) */}
              <NodeBadge id="alice" reached failed={false} />

              {/* Forwarders */}
              {FORWARDERS.map((hopId, i) => (
                <NodeBadge
                  key={hopId}
                  id={hopId}
                  reached={hopReached(i)}
                  failed={hopFailed(i)}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex gap-2 mb-3">
              {!running && !completed && (
                <button
                  onClick={start}
                  className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                  data-testid={`onion-capstone-${mode}-start`}
                >
                  ▶ Send payment
                </button>
              )}
              {(running || completed) && (
                <button
                  onClick={reset}
                  className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Event log */}
            <div
              className="border-[1.5px] p-3 overflow-y-auto"
              style={{
                background: "#fffdf5",
                borderColor: "rgba(15,23,42,0.25)",
                minHeight: 180,
                maxHeight: 280,
                fontFamily: MONO,
                fontSize: 12,
              }}
              data-testid={`onion-capstone-${mode}-log`}
            >
              {eventLog.length === 0 && (
                <div
                  className="italic"
                  style={{ color: "#475569", letterSpacing: "0.02em" }}
                >
                  Click "Send payment" to start. Events will stream below as
                  each hop processes the packet.
                </div>
              )}
              <div className="flex flex-col gap-1">
                {eventLog.map((ev, i) => {
                  const badge = KIND_BADGE[ev.kind];
                  return (
                    <div
                      key={i}
                      className="flex gap-2 items-baseline"
                      style={{ color: "#0f172a" }}
                    >
                      <span
                        className="px-1.5 py-0.5 border-[1.5px] shrink-0 text-[10px] tracking-[0.04em]"
                        style={{
                          color: badge.color,
                          borderColor: badge.color,
                          background: "#fffdf5",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {badge.label}
                      </span>
                      <span style={{ letterSpacing: "0.02em" }}>{ev.text}</span>
                    </div>
                  );
                })}
                {running && (
                  <div
                    className="italic"
                    style={{ color: "#475569", letterSpacing: "0.02em" }}
                  >
                    ...
                  </div>
                )}
              </div>
            </div>

            {/* Result */}
            {completed && (
              <div
                className="mt-3 border-[1.5px] p-3"
                style={{
                  background: mode === "success" ? "#e8f5d6" : "#fde7e7",
                  borderColor: mode === "success" ? "#5a7a2f" : "#a13a3a",
                }}
              >
                <div
                  className="font-bold text-sm"
                  style={{
                    color: "#0f172a",
                    letterSpacing: "0.02em",
                  }}
                >
                  {mode === "success"
                    ? "✓ Payment delivered. Preimage matches the invoice."
                    : `✗ Payment failed at ${HOP_LABEL[FORWARDERS[failingHop]]}. Error decoded: temporary_channel_failure.`}
                </div>
                <div
                  className="text-[11px] mt-1"
                  style={{ color: "#475569", letterSpacing: "0.02em" }}
                >
                  Visual preview. Full Pyodide integration with your code is on
                  the roadmap; for now, this animation reflects what a
                  correctly-implemented run looks like end-to-end.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeBadge({
  id,
  reached,
  failed,
}: {
  id: HopId;
  reached: boolean;
  failed: boolean;
}) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${HOP_X_PCT[id]}%`,
        top: 0,
        transform: "translateX(-50%)",
      }}
    >
      <div
        className="w-20 h-12 flex items-center justify-center"
        style={{
          background: reached ? HOP_FILL[id] : "#fffdf5",
          border: `1.5px solid ${
            failed
              ? "#a13a3a"
              : reached
                ? HOP_STROKE[id]
                : "rgba(15,23,42,0.3)"
          }`,
          borderWidth: failed ? "2.5px" : "1.5px",
          color: "#0f172a",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.05em",
          opacity: reached ? 1 : 0.55,
        }}
      >
        {HOP_LABEL[id].toUpperCase()}
      </div>
      {failed && (
        <div
          className="text-[10px] mt-1 font-bold tracking-[0.06em]"
          style={{ color: "#a13a3a", fontFamily: MONO }}
        >
          FAILED
        </div>
      )}
    </div>
  );
}

export default OnionCapstonePanel;
