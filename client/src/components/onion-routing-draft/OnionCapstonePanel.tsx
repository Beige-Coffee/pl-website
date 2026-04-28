import { useState, useRef, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────────
// OnionCapstonePanel
//
// Visual capstone for chapters 11 and 12. This is a UI-driven simulation that
// walks through the per-hop peel events of a 3-hop onion delivery, in either
// "success" mode (preimage at the end) or "failure" mode (error onion at the
// failing hop, then unwrap).
//
// Note: this version drives a deterministic scripted run. A future iteration
// will wire it to the student's Pyodide-compiled OnionPacketBuilder via the
// CodeExercise infrastructure so the visualization runs against real student
// code. Until then, the panel demonstrates what a successful run looks like
// and gives students a target to validate their own solutions against.
// ────────────────────────────────────────────────────────────────────────────

export interface OnionCapstonePanelProps {
  mode: "success" | "failure";
  /** For "failure" mode, which hop fails (default: 1 = Carol). */
  failingHop?: number;
}

const HOPS = [
  { id: "bob",   label: "Bob",   color: "#bfdbfe", stroke: "#2563eb", scid: "0102030405060708" },
  { id: "carol", label: "Carol", color: "#bbf7d0", stroke: "#16a34a", scid: "1112131415161718" },
  { id: "dave",  label: "Dave",  color: "#fecaca", stroke: "#dc2626", scid: null },
];

type HopEventKind = "received" | "shared_secret" | "payload" | "forwarded" | "delivered" | "failed" | "wrapping_error";

interface HopEvent {
  hopIdx: number;
  kind: HopEventKind;
  text: string;
  durationMs: number;
}

function buildScript(mode: "success" | "failure", failingHop: number): HopEvent[] {
  const events: HopEvent[] = [];

  for (let i = 0; i < HOPS.length; i++) {
    const isFailingHop = mode === "failure" && i === failingHop;
    const isPastFailure = mode === "failure" && i > failingHop;
    if (isPastFailure) break;

    events.push({ hopIdx: i, kind: "received", text: `${HOPS[i].label} received 1,366-byte packet (E_${i} = 0x028a3f...)`, durationMs: 700 });
    events.push({ hopIdx: i, kind: "shared_secret", text: `${HOPS[i].label} computed ss_${i} = ECDH(${HOPS[i].id}_priv, E_${i})`, durationMs: 600 });
    if (isFailingHop) {
      events.push({ hopIdx: i, kind: "payload", text: `${HOPS[i].label} parsed TLV: amt=${(10_002 - i).toLocaleString()} sat, cltv=block ${260 - i * 40}`, durationMs: 800 });
      events.push({ hopIdx: i, kind: "failed", text: `${HOPS[i].label} fails: temporary_channel_failure. Building error onion with um_${HOPS[i].id} + ammag_${HOPS[i].id}.`, durationMs: 1100 });
    } else if (i === HOPS.length - 1 && mode === "success") {
      events.push({ hopIdx: i, kind: "payload", text: `${HOPS[i].label} parsed TLV: amt=10,000 sat, cltv=block 140, payment_data matches invoice`, durationMs: 800 });
      events.push({ hopIdx: i, kind: "delivered", text: `${HOPS[i].label} reveals preimage: 0xa3f1e9c4... HTLC settles backward through Carol → Bob → Alice.`, durationMs: 1000 });
    } else {
      events.push({ hopIdx: i, kind: "payload", text: `${HOPS[i].label} parsed TLV: amt=${(10_003 - i).toLocaleString()} sat, cltv=block ${260 - i * 40}, scid=0x${HOPS[i].scid}`, durationMs: 700 });
      events.push({ hopIdx: i, kind: "forwarded", text: `${HOPS[i].label} forwards 1,366-byte packet to ${HOPS[i + 1].label} (E_${i + 1} = 0x02b1c4...)`, durationMs: 700 });
    }
  }

  // For failure mode, add the unwrap phase events.
  if (mode === "failure") {
    for (let i = failingHop - 1; i >= 0; i--) {
      events.push({
        hopIdx: i,
        kind: "wrapping_error",
        text: `${HOPS[i].label} wraps the error with ammag_${HOPS[i].id} and forwards back upstream.`,
        durationMs: 600,
      });
    }
    events.push({
      hopIdx: 0,
      kind: "received",
      text: `Alice received the wrapped error. Running decrypt_error_onion...`,
      durationMs: 700,
    });
    for (let i = 0; i <= failingHop; i++) {
      const matched = i === failingHop;
      events.push({
        hopIdx: i,
        kind: matched ? "delivered" : "received",
        text: matched
          ? `i=${i}: HMAC(um_${HOPS[i].id}, peeled[32:]) verifies! Failing hop = ${HOPS[i].label}, code = temporary_channel_failure.`
          : `i=${i}: peel ammag_${HOPS[i].id}, check HMAC(um_${HOPS[i].id}). Doesn't match, continue.`,
        durationMs: 700,
      });
    }
  }

  return events;
}

export function OnionCapstonePanel({ mode, failingHop = 1 }: OnionCapstonePanelProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [eventLog, setEventLog] = useState<HopEvent[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => () => { cancelRef.current = true; }, []);

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

  const isFailureMode = mode === "failure";

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid={`onion-capstone-${mode}`}
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Capstone — {mode === "success" ? "successful payment" : "failure path"}
      </div>

      {/* Hop row */}
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 720 140"
          className="w-full max-w-4xl mx-auto"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {/* Alice */}
          <circle cx={50} cy={70} r={26} fill="#fde68a" stroke="#b8860b" strokeWidth={2} />
          <text x={50} y={74} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">Alice</text>

          {/* 3 hops */}
          {HOPS.map((h, i) => {
            const x = 200 + i * 170;
            const reachedThisHop = eventLog.some((e) => e.hopIdx === i);
            const failedHere = isFailureMode && eventLog.some((e) => e.hopIdx === i && e.kind === "failed");
            return (
              <g key={h.id}>
                {/* edge from prev */}
                <line x1={i === 0 ? 78 : 200 + (i - 1) * 170 + 28} y1={70} x2={x - 28} y2={70} stroke={reachedThisHop ? h.stroke : "#cbd5e1"} strokeWidth={2} strokeDasharray={reachedThisHop ? "" : "4 3"} />
                <circle
                  cx={x}
                  cy={70}
                  r={26}
                  fill={reachedThisHop ? h.color : "#f1f5f9"}
                  stroke={failedHere ? "#dc2626" : reachedThisHop ? h.stroke : "#94a3b8"}
                  strokeWidth={failedHere ? 4 : reachedThisHop ? 2 : 1.5}
                  opacity={reachedThisHop ? 1 : 0.5}
                />
                <text x={x} y={74} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
                  {h.label}
                </text>
                {failedHere && (
                  <text x={x} y={108} textAnchor="middle" fontSize={10} fontWeight={600} fill="#dc2626">
                    FAILED
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        {!running && !completed && (
          <button
            onClick={start}
            className="px-4 py-2 border-2 border-border bg-primary text-foreground font-pixel text-xs hover:bg-primary/80"
            data-testid={`onion-capstone-${mode}-start`}
          >
            ▶ Send payment
          </button>
        )}
        {(running || completed) && (
          <button
            onClick={reset}
            className="px-4 py-2 border-2 border-border bg-secondary text-foreground font-pixel text-xs hover:bg-card"
          >
            Reset
          </button>
        )}
      </div>

      {/* Event log */}
      <div
        className="bg-background border-2 border-border p-3 min-h-[180px] max-h-[300px] overflow-y-auto text-xs font-mono space-y-1"
        data-testid={`onion-capstone-${mode}-log`}
      >
        {eventLog.length === 0 && (
          <div className="opacity-50 italic">
            Click "Send payment" to start. Events will stream below as each hop processes the packet.
          </div>
        )}
        {eventLog.map((ev, i) => (
          <div key={i} className="flex gap-2">
            <span className="opacity-50 shrink-0">[{ev.kind}]</span>
            <span>{ev.text}</span>
          </div>
        ))}
        {running && <div className="opacity-50 italic">...</div>}
      </div>

      {/* Result */}
      {completed && (
        <div
          className={`mt-4 p-3 border-2 ${
            mode === "success"
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
          }`}
        >
          <div className="font-semibold">
            {mode === "success"
              ? "✓ Payment delivered. Preimage matches the invoice."
              : "✗ Payment failed at " + HOPS[failingHop].label + ". Error decoded: temporary_channel_failure."}
          </div>
          <div className="text-xs opacity-70 mt-1">
            (Visual preview. Full Pyodide integration with your code is on the roadmap; for now, this animation reflects what a correctly-implemented run looks like end-to-end.)
          </div>
        </div>
      )}
    </div>
  );
}

export default OnionCapstonePanel;
