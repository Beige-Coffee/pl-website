import { useEffect, useRef, useState } from "react";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// NaivePacketDiagram (DRAFT)
//
// "Second attempt" visualization for the Shared Secrets per Hop chapter.
// Frames the cost of fresh-keypair-per-hop the way Elle Mouton does:
//   - Alice has to persist N private keys per payment.
//   - The packet has to carry N ephemeral pubkeys (one per hop).
// Both costs scale with route length, and blinding will collapse both to one
// in the next section.
//
// Animation rhythm matches PlaintextMessageTear and NodeKeyAttemptDiagram:
// six steps total (setup → highlight at Bob → mark processed → highlight at
// Charlie → mark processed → highlight at Dave). Slots stay in the packet
// after processing (they go neutral gray) so the visual never suggests the
// packet shrinks. The point is structural: it always carries N pubkeys.
//
// Alice's keypair burden is conveyed by a small hover chip pinned beneath
// her hop circle. Hovering it pops a panel showing all three keypairs she's
// persisting for this payment.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

const INK = "#0f172a";
const SLATE = "#475569";

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

// Decrypted-slot palette (neutral gray, deliberately not Alice's gold).
const PROCESSED = { stroke: "#94a3b8", fill: "#f1f5f9", accent: "#475569" };

const SLOTS = [
  {
    forHop: "bob" as const,
    color: HOP_COLORS.bob,
    pubkey: "0x03 9b f1 4c ... 8a",
    pubLabel: "E_Bob",
    privLabel: "e_Bob",
    ciphertext: "c4 9a f7 8b ... 81",
  },
  {
    forHop: "charlie" as const,
    color: HOP_COLORS.charlie,
    pubkey: "0x02 7e 1c 22 ... 5d",
    pubLabel: "E_Charlie",
    privLabel: "e_Charlie",
    ciphertext: "7e 1b 24 a3 ... 5a",
  },
  {
    forHop: "dave" as const,
    color: HOP_COLORS.dave,
    pubkey: "0x03 5f 88 a0 ... 12",
    pubLabel: "E_Dave",
    privLabel: "e_Dave",
    ciphertext: "9f 4c 03 d7 ... 03",
  },
];

const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice generates a fresh ephemeral keypair for every hop and packs all three pubkeys into the packet, alongside their encrypted slices. Hover the chip under Alice to see the three keypairs she has to keep around.",
  1: "Bob receives the packet. He uses his own private key against E_Bob from his slot to derive ss_AB and decrypts his slice. The other two slots (Charlie's and Dave's) are still in the packet and are still pubkeys he doesn't need.",
  2: "Bob's slot is now processed. He forwards the packet on to Charlie. Notice the packet still carries E_Charlie and E_Dave: the structure didn't shrink, the cost didn't go away.",
  3: "Charlie does the same with his slot: ECDH against E_Charlie produces ss_AC, and Charlie decrypts his slice.",
  4: "Charlie's slot is processed. The packet keeps moving with E_Dave still in it.",
  5: "Dave finishes the route. ECDH against E_Dave produces ss_AD and he decrypts his slice. The math worked, but every packet carried three pubkeys, and Alice had to manage three keypairs the whole time.",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

function highlightedAt(step: number, hop: "bob" | "charlie" | "dave"): boolean {
  if (hop === "bob" && step === 1) return true;
  if (hop === "charlie" && step === 3) return true;
  if (hop === "dave" && step === 5) return true;
  return false;
}

function isProcessed(forHop: "bob" | "charlie" | "dave", step: number): boolean {
  if (forHop === "bob") return step >= 1;
  if (forHop === "charlie") return step >= 3;
  return step >= 5;
}

function ecdhFor(step: number): {
  privLabel: string;
  privColor: { stroke: string; fill: string };
  pubLabel: string;
  pubColor: { stroke: string; fill: string };
  ssLabel: string;
} | null {
  if (step === 1 || step === 2) {
    return {
      privLabel: "bob_priv",
      privColor: HOP_COLORS.bob,
      pubLabel: "E_Bob",
      pubColor: HOP_COLORS.bob,
      ssLabel: "ss_AB",
    };
  }
  if (step === 3 || step === 4) {
    return {
      privLabel: "charlie_priv",
      privColor: HOP_COLORS.charlie,
      pubLabel: "E_Charlie",
      pubColor: HOP_COLORS.charlie,
      ssLabel: "ss_AC",
    };
  }
  if (step === 5) {
    return {
      privLabel: "dave_priv",
      privColor: HOP_COLORS.dave,
      pubLabel: "E_Dave",
      pubColor: HOP_COLORS.dave,
      ssLabel: "ss_AD",
    };
  }
  return null;
}

function LockTile({ tint }: { tint: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="3" y="2" width="1" height="3" fill={tint} />
      <rect x="8" y="2" width="1" height="3" fill={tint} />
      <rect x="4" y="1" width="4" height="1" fill={tint} />
      <rect x="2" y="5" width="8" height="6" fill={tint} />
      <rect x="5" y="7" width="2" height="2" fill="#fffdf5" />
    </svg>
  );
}

// Hover chip pinned under Alice's circle. Hovering it pops a list of the
// three keypairs she has to persist for the payment.
function AliceKeysChip() {
  const [open, setOpen] = useState(false);
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative", display: "inline-block", cursor: "help" }}
    >
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 border-[1.5px]"
        style={{
          background: "#fffdf5",
          borderColor: HOP_COLORS.alice.stroke,
          color: INK,
          fontSize: 10,
          letterSpacing: "0.04em",
        }}
      >
        <LockTile tint={HOP_COLORS.alice.stroke} />
        <span style={{ fontWeight: 700 }}>3 keypairs persisted</span>
      </div>
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: 220,
          }}
        >
          <div
            className="border-[1.5px] p-2 space-y-1"
            style={{
              background: "#fffdf5",
              borderColor: INK,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              boxShadow: "0 8px 30px rgba(0,0,0,0.20)",
            }}
          >
            <div
              className="text-[9px] uppercase tracking-wider mb-1"
              style={{
                color: SLATE,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              Alice persists per payment
            </div>
            {SLOTS.map((s) => (
              <div
                key={s.forHop}
                className="flex items-center gap-1.5 px-2 py-1 border-[1.5px]"
                style={{ borderColor: s.color.stroke, background: s.color.fill }}
              >
                <LockTile tint={s.color.stroke} />
                <span
                  className="text-[10px]"
                  style={{ color: INK, fontWeight: 700, fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
                >
                  (<Tok token={s.privLabel} />, <Tok token={s.pubLabel} />)
                </span>
              </div>
            ))}
            <div
              className="text-[9px] leading-snug pt-1 mt-1 border-t-[1.5px]"
              style={{
                color: SLATE,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                borderColor: "#e5e7eb",
              }}
            >
              Errors come back encrypted with these shared secrets, so she
              can't discard them mid-payment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NaivePacketDiagram() {
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
    }, 2200);
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

  // Subtle drift along the route, same treatment as NodeKeyAttemptDiagram.
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
      data-testid="naive-packet-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Second attempt: one ephemeral key per hop
          </span>
        </div>
      </div>

      <div
        className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 600 }}
      >
        {/* Hop track */}
        <div className="relative mb-10" style={{ height: 110 }}>
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
                    color: INK,
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
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold tracking-[0.05em]"
                  style={{ color: INK }}
                >
                  {label}
                </div>
                {/* Hover chip under Alice's label */}
                {id === "alice" && (
                  <div className="mt-1.5">
                    <AliceKeysChip />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Centered content area: packet + (conditional) ECDH calc panel.
            Drifts left/right with the active hop. */}
        <div
          className="flex flex-row flex-wrap items-start justify-center gap-6"
          style={{
            transform: `translateX(${contentShift}px)`,
            transition: "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{ width: 350 }}>
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

              {/* Ephemeral pubkey list (header). Three entries, one per hop,
                  color-coded. Highlights when its hop is the active forwarder.
                  Goes gray when its hop has finished processing. */}
              <div
                className="border-[1.5px] px-2 py-1.5 mb-2"
                style={{ borderColor: INK, background: "#fffdf5" }}
              >
                <div
                  className="text-[9px] uppercase tracking-wider mb-1.5 flex items-center gap-1"
                  style={{ color: SLATE }}
                >
                  <span>ephemeral_pubkeys</span>
                  <span className="ml-auto opacity-70 normal-case tracking-normal">
                    3 entries
                  </span>
                </div>
                <div className="space-y-1">
                  {SLOTS.map((s) => {
                    const processed = isProcessed(s.forHop, step);
                    const isActiveEntry = highlightedAt(step, s.forHop);
                    const borderColor = isActiveEntry
                      ? "#b8860b"
                      : processed
                        ? PROCESSED.stroke
                        : s.color.stroke;
                    const background = isActiveEntry
                      ? "#fef3c7"
                      : processed
                        ? PROCESSED.fill
                        : s.color.fill;
                    const labelColor = isActiveEntry
                      ? "#b8860b"
                      : processed
                        ? PROCESSED.accent
                        : s.color.stroke;
                    return (
                      <div
                        key={s.forHop}
                        className="border-[1.5px] px-1.5 py-1 flex items-center gap-1.5"
                        style={{
                          borderColor,
                          background,
                          transition:
                            "background 400ms ease-in-out, border-color 400ms ease-in-out",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold"
                          style={{
                            color: labelColor,
                            minWidth: 70,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          }}
                        >
                          <Tok token={s.pubLabel} color={labelColor} />:
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: INK, fontWeight: 700 }}
                        >
                          {s.pubkey}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Encrypted slices: one per hop, paired with the pubkey list
                  by index. Goes gray on processing; never removed. */}
              <div className="space-y-1.5">
                {SLOTS.map((s) => {
                  const processed = isProcessed(s.forHop, step);
                  const isActiveSlot = highlightedAt(step, s.forHop);
                  const borderColor = isActiveSlot
                    ? "#b8860b"
                    : processed
                      ? PROCESSED.stroke
                      : s.color.stroke;
                  const background = isActiveSlot
                    ? "#fef3c7"
                    : processed
                      ? PROCESSED.fill
                      : s.color.fill;
                  const labelColor = isActiveSlot
                    ? "#b8860b"
                    : processed
                      ? PROCESSED.accent
                      : s.color.stroke;
                  return (
                    <div
                      key={s.forHop}
                      className="border-[1.5px] px-2 py-1.5"
                      style={{
                        borderColor,
                        background,
                        transition:
                          "background 400ms ease-in-out, border-color 400ms ease-in-out",
                      }}
                    >
                      <div
                        className="text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1"
                        style={{ color: labelColor }}
                      >
                        <span>slot for {s.forHop}</span>
                        <span className="ml-auto opacity-80 normal-case tracking-normal">
                          {processed ? "✓ decrypted" : "encrypted"}
                        </span>
                      </div>
                      <div
                        className="text-[10px] leading-tight"
                        style={{
                          color: INK,
                          letterSpacing: "0.04em",
                          opacity: processed ? 0.95 : 0.7,
                        }}
                      >
                        {processed ? "(plaintext payload)" : s.ciphertext}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ECDH calculation panel beside the packet at active forwarder
              steps. Each hop runs ECDH with its OWN ephemeral pubkey from
              the packet (not Alice's pubkey, unlike the first attempt). */}
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
                      color: INK,
                    }}
                  >
                    {ecdh.privLabel}
                  </span>
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: INK }}
                  >
                    ·
                  </span>
                  <span
                    className="border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: ecdh.pubColor.fill,
                      borderColor: ecdh.pubColor.stroke,
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <Tok token={ecdh.pubLabel} />
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: SLATE }}
                  >
                    (from this hop's slot)
                  </span>
                </div>

                <div
                  className="text-[10px] mb-2"
                  style={{
                    color: SLATE,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                >
                  = SHA256(curve_point)
                </div>

                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span style={{ color: INK, fontWeight: 700 }}>→</span>
                  <span
                    className="border-[1.5px] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: "#fef3c7",
                      borderColor: "#b8860b",
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <Tok token={ecdh.ssLabel} />
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: SLATE }}
                  >
                    used to decrypt slice
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom callout: both costs scale with route length */}
        <div
          className="mt-6 mx-auto border-[1.5px] border-dashed px-4 py-3 flex items-start gap-2"
          style={{
            borderColor: "#a13a3a",
            background: "#fff5f5",
            maxWidth: 660,
          }}
        >
          <span style={{ color: "#a13a3a", fontWeight: 700 }}>⚠</span>
          <div className="text-[12px] leading-relaxed" style={{ color: INK }}>
            <span className="font-bold">Both costs scale with route length.</span>{" "}
            For an N-hop route, Alice persists N private keys and the packet
            carries N ephemeral pubkeys. The next section shows how a single
            session key reduces both to{" "}
            <span className="font-bold">one</span>.
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="naive-packet-diagram-play"
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
                    borderColor: step === i ? "#b8860b" : INK,
                    color: step === i ? "#fffdf5" : INK,
                  }}
                  data-testid={`naive-packet-step-${i}`}
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

export default NaivePacketDiagram;
