import { useEffect, useRef, useState } from "react";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// NodeKeyAttemptDiagram (DRAFT)
//
// "First attempt" visualization for the Shared Secrets per Hop chapter.
// Continues the chapter-3 visual thread (PlaintextMessageTear / EncryptedSliceReveal):
// hop row at the top, the packet panel and an ECDH calc panel below.
//
// What the visual demonstrates:
//   - Alice reuses her published node-identity public key as the public key
//     in the onion packet.
//   - At each forwarder, an ECDH calculation panel shows the forwarder's
//     private key combining with that pubkey to derive ss_<hop>.
//   - The same panel calls out that the pubkey matches Alice's node_announcement
//     in gossip, so every forwarder also learns the sender.
//   - After ECDH, the forwarder decrypts and peels its own slice, then the
//     message moves to the next hop.
//
// Six-step rhythm: setup → highlight at Bob → peel → highlight at Charlie →
// peel → highlight at Dave.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

const HOP_COLORS: Record<HopId, { stroke: string; fill: string }> = {
  alice: { stroke: "#b8860b", fill: "#fef3c7" },
  bob: { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3" },
};

const NODE_X_PCT: Record<HopId, number> = {
  alice: 20,
  bob: 40,
  charlie: 60,
  dave: 80,
};

// Decrypted-slice palette (gray, deliberately neutral so it doesn't borrow
// Alice's gold).
const DECRYPTED = { stroke: "#94a3b8", fill: "#f1f5f9", accent: "#475569" };

const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice constructs an onion using her published node-identity public key as the sender pubkey. The pubkey rides at the top of the packet in plaintext, because every forwarder needs it to derive a shared secret with her.",
  1: "The packet arrives at Bob. He combines his own private key with Alice's public key to derive ss_AB, then uses ss_AB to decrypt his slice. Notice: the same pubkey lookup also tells him the sender is Alice.",
  2: "Bob peels his slice off the packet and forwards the rest to Charlie. The pubkey field stays intact, so the next hop sees the same Alice key.",
  3: "Charlie does the same: ECDH against Alice's public key produces ss_AC. He decrypts his slice and learns Alice is the sender for free.",
  4: "Charlie peels his slice off and forwards what remains to Dave.",
  5: "Dave performs ECDH to derive ss_AD and decrypts his slice. The math worked at every hop, but every forwarder along the way deanonymized Alice from the pubkey field that's there for cryptographic reasons.",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

// A slice is removed once its hop has peeled (the step AFTER decryption).
function isRemoved(forHop: "bob" | "charlie" | "dave", step: number): boolean {
  if (forHop === "bob") return step >= 2;
  if (forHop === "charlie") return step >= 4;
  return false;
}

// Whether a slice is decrypted. Latched on once its hop runs ECDH.
function isDecrypted(forHop: "bob" | "charlie" | "dave", step: number): boolean {
  if (forHop === "bob") return step >= 1;
  if (forHop === "charlie") return step >= 3;
  return step >= 5;
}

const SLICES = [
  {
    forHop: "bob" as const,
    label: "slice for bob",
    color: HOP_COLORS.bob,
    ciphertext: "c4 9a f7 8b 12 ee 6a 3e 81 d2 ...",
  },
  {
    forHop: "charlie" as const,
    label: "slice for charlie",
    color: HOP_COLORS.charlie,
    ciphertext: "7e 1b 24 a3 fc 50 b2 4d 2c 5a ...",
  },
  {
    forHop: "dave" as const,
    label: "slice for dave",
    color: HOP_COLORS.dave,
    ciphertext: "9f 4c 03 d7 a8 11 e6 60 8b 03 ...",
  },
];

function ecdhFor(step: number): {
  privLabel: string;
  privColor: { stroke: string; fill: string };
  ssLabel: string;
} | null {
  if (step === 1 || step === 2) {
    return {
      privLabel: "bob_priv",
      privColor: HOP_COLORS.bob,
      ssLabel: "ss_AB",
    };
  }
  if (step === 3 || step === 4) {
    return {
      privLabel: "charlie_priv",
      privColor: HOP_COLORS.charlie,
      ssLabel: "ss_AC",
    };
  }
  if (step === 5) {
    return {
      privLabel: "dave_priv",
      privColor: HOP_COLORS.dave,
      ssLabel: "ss_AD",
    };
  }
  return null;
}

export function NodeKeyAttemptDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(() => {
      setStep((s) => {
        if (s + 1 >= TOTAL_STEPS) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 2400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  function play() {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  }
  function pause() {
    setPlaying(false);
  }
  function reset() {
    setPlaying(false);
    setStep(0);
  }

  const active = activeHopAt(step);
  const isForwarder = active !== "alice";
  const ecdh = ecdhFor(step);

  // Subtle horizontal drift so the packet visibly tracks the active hop
  // without producing the dead-space the per-hop anchoring did. Values are in
  // pixels and tuned so the content stays well within the stage at every step.
  const HOP_SHIFT: Record<HopId, number> = {
    alice: -90,
    bob: -30,
    charlie: 30,
    dave: 90,
  };
  const contentShift = HOP_SHIFT[active];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="node-key-attempt-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            First attempt: Alice reuses her node key
          </span>
        </div>
      </div>

      <div
        className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 540 }}
      >
        {/* Hop track */}
        <div className="relative mb-6" style={{ height: 88 }}>
          {[0, 1, 2].map((i) => {
            const startPct =
              NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct =
              NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  top: 29,
                  left: `calc(${startPct}% + 32px)`,
                  width: `calc(${endPct - startPct}% - 64px)`,
                  borderTop: "1.5px dashed #475569",
                }}
              />
            );
          })}

          {(["alice", "bob", "charlie", "dave"] as HopId[]).map((id) => {
            const isActive = active === id;
            const label =
              id === "alice"
                ? "Alice"
                : id === "bob"
                  ? "Bob"
                  : id === "charlie"
                    ? "Charlie"
                    : "Dave";
            const hop = HOP_COLORS[id];
            const learnedSender =
              (id === "bob" && step >= 1) ||
              (id === "charlie" && step >= 3) ||
              (id === "dave" && step >= 5);
            return (
              <div
                key={id}
                className="absolute z-10 flex flex-col items-center"
                style={{
                  top: 0,
                  left: `${NODE_X_PCT[id]}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center transition-all duration-500 relative"
                  style={{
                    width: 60,
                    height: 60,
                    background: hop.fill,
                    color: "#0f172a",
                    border: `${isActive ? 3 : 2}px solid ${hop.stroke}`,
                    boxShadow: isActive
                      ? `0 0 0 4px rgba(184,134,11,0.30)`
                      : undefined,
                  }}
                >
                  <span
                    className="font-bold"
                    style={{
                      fontSize: 22,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {label.charAt(0)}
                  </span>
                  {learnedSender && !isActive && (
                    <span
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#a13a3a] text-white text-[11px] font-bold flex items-center justify-center border-[1.5px] border-[#fffdf5]"
                      title="Identified Alice as the sender"
                    >
                      !
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold tracking-[0.05em]"
                  style={{ color: "#0f172a" }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Centered content area: packet + (conditional) ECDH calc panel,
            side by side. Drifts left/right with the active hop just enough to
            convey motion along the route, but always fully visible. */}
        <div
          className="flex flex-row flex-wrap items-start justify-center gap-6"
          style={{
            transform: `translateX(${contentShift}px)`,
            transition: "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Packet panel */}
          <div style={{ width: 330 }}>
            <div
              className="bg-black text-white px-3 py-1.5 border-[1.5px] border-black flex items-center gap-2"
              style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
            >
              <div className="w-1.5 h-1.5 bg-[#b8860b]" />
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
                ONION_PACKET
              </span>
            </div>

            <div
              className="bg-[#fffdf5] border-[1.5px] border-t-0 border-black p-2"
              style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
            >
              <div className="text-[10px] leading-tight px-1 mb-2">
                <span className="opacity-60">payment_hash:</span>{" "}
                <span className="font-bold">0xa3f1...e9c4</span>
              </div>

              {/* Sender public key field. Alice's static node pubkey. */}
              <div
                className="border-[1.5px] px-2 py-1.5 mb-2"
                style={{
                  borderColor: HOP_COLORS.alice.stroke,
                  background: HOP_COLORS.alice.fill,
                }}
              >
                <div
                  className="text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1"
                  style={{ color: HOP_COLORS.alice.stroke }}
                >
                  <span>sender_pubkey</span>
                  <span
                    className="ml-auto inline-block px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
                    style={{
                      background: HOP_COLORS.alice.stroke,
                      color: "#fffdf5",
                    }}
                  >
                    ALICE'S PUBLIC KEY
                  </span>
                </div>
                <div
                  className="text-[10px] font-bold leading-tight"
                  style={{ color: "#0f172a" }}
                >
                  0x02 4a c1 9f 33 b8 ... 7e 0d
                </div>
              </div>

              {/* Slices: peel out as their hop processes. Decrypted slices
                  go neutral gray, not gold. */}
              <div className="space-y-1.5">
                {SLICES.map((s) => {
                  const removed = isRemoved(s.forHop, step);
                  const decrypted = isDecrypted(s.forHop, step);
                  const borderColor = decrypted
                    ? DECRYPTED.stroke
                    : s.color.stroke;
                  const background = decrypted
                    ? DECRYPTED.fill
                    : s.color.fill;
                  const labelColor = decrypted
                    ? DECRYPTED.accent
                    : s.color.stroke;
                  return (
                    <div
                      key={s.forHop}
                      className="border-[1.5px] px-2 py-1.5 relative overflow-hidden"
                      style={{
                        borderColor,
                        background,
                        transition:
                          "max-height 700ms ease-in-out, opacity 700ms ease-in-out, padding 700ms ease-in-out, border-width 700ms ease-in-out, margin 700ms ease-in-out, background 400ms ease-in-out, border-color 400ms ease-in-out",
                        maxHeight: removed ? 0 : 240,
                        opacity: removed ? 0 : 1,
                        paddingTop: removed ? 0 : undefined,
                        paddingBottom: removed ? 0 : undefined,
                        marginTop: removed ? 0 : undefined,
                        marginBottom: removed ? 0 : undefined,
                        borderWidth: removed ? 0 : undefined,
                      }}
                    >
                      <div
                        className="text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1"
                        style={{ color: labelColor }}
                      >
                        <span>{s.label}</span>
                        <span className="ml-auto opacity-80 normal-case tracking-normal">
                          {decrypted ? "✓ decrypted" : "encrypted"}
                        </span>
                      </div>
                      <div
                        className="text-[10px] leading-tight tracking-tight"
                        style={{
                          color: "#0f172a",
                          letterSpacing: "0.04em",
                          opacity: decrypted ? 0.95 : 0.7,
                        }}
                      >
                        {decrypted ? "(plaintext payload)" : s.ciphertext}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ECDH calculation panel. Appears beside the packet at active
              forwarder steps. */}
          {isForwarder && ecdh && (
            <div style={{ width: 280 }}>
              <div
                className="bg-black text-white px-3 py-1.5 border-[1.5px] border-black flex items-center gap-2"
                style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
              >
                <div className="w-1.5 h-1.5 bg-[#b8860b]" />
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
                  {active === "bob"
                    ? "Bob's calculation"
                    : active === "charlie"
                      ? "Charlie's calculation"
                      : "Dave's calculation"}
                </span>
              </div>

              <div
                className="bg-[#fffdf5] border-[1.5px] border-t-0 border-black p-3"
                style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                {/* Inputs row */}
                <div
                  className="flex items-center gap-1.5 mb-2 flex-wrap"
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                >
                  <span
                    className="border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: ecdh.privColor.fill,
                      borderColor: ecdh.privColor.stroke,
                      color: "#0f172a",
                    }}
                  >
                    {ecdh.privLabel}
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: "#0f172a" }}
                  >
                    ·
                  </span>
                  <span
                    className="border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: HOP_COLORS.alice.fill,
                      borderColor: HOP_COLORS.alice.stroke,
                      color: "#0f172a",
                    }}
                  >
                    alice_pub
                  </span>
                </div>

                {/* SHA256 row */}
                <div
                  className="text-[10px] mb-2"
                  style={{
                    color: "#475569",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                >
                  = SHA256(curve_point)
                </div>

                {/* Output row */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span style={{ color: "#0f172a", fontWeight: 700 }}>→</span>
                  <span
                    className="border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: "#fef3c7",
                      borderColor: "#b8860b",
                      color: "#0f172a",
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <Tok token={ecdh.ssLabel} />
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "#475569" }}
                  >
                    used to decrypt slice
                  </span>
                </div>

                {/* Gossip-lookup leak callout */}
                <div
                  className="border-[1.5px] border-dashed px-2 py-1.5 mt-2 flex items-start gap-1.5"
                  style={{ borderColor: "#a13a3a", background: "#fff5f5" }}
                >
                  <span style={{ color: "#a13a3a", fontWeight: 700 }}>⚠</span>
                  <div
                    className="text-[10px] leading-snug"
                    style={{ color: "#0f172a" }}
                  >
                    <span style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                      alice_pub
                    </span>{" "}
                    matches gossip{" "}
                    <span style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                      node_announcement
                    </span>{" "}
                    → sender ={" "}
                    <span
                      style={{
                        color: HOP_COLORS.alice.stroke,
                        fontWeight: 700,
                      }}
                    >
                      Alice
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="node-key-attempt-play"
            >
              {playing
                ? "❚❚ Pause"
                : step >= TOTAL_STEPS - 1
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlaying(false);
                    setStep(i);
                  }}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background:
                      step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`node-key-attempt-step-${i}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_CAPTIONS[step]}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeKeyAttemptDiagram;
