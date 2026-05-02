import { useState, useEffect, useRef } from "react";
import { Tooltip } from "./Tooltip";

// ────────────────────────────────────────────────────────────────────────────
// EncryptedSliceReveal (DRAFT)
//
// Sibling visual to PlaintextMessageTear. Same path, same data, same flow,
// but each per-hop slice is now encrypted with that hop's own key. The visual
// teaches the core onion-routing intuition without yet introducing layered
// Sphinx: a forwarder can *see* the encrypted ciphertext for downstream hops
// but can't read it, because they don't have the corresponding key. Their own
// slice unlocks; everything else stays opaque.
//
// This is intentionally a stepping-stone, not the real Sphinx layout. We'll
// promote to layered onion + filler in chapter 7.
//
// Visual style follows the Noise capstone, matching PlaintextMessageTear:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents on active.
//   - Each forwarder is assigned a key color used for their slice's stripe
//     overlay AND for a small colored "key" tile next to their node badge.
//   - When a slice decrypts, the stripe overlay fades and ciphertext crosses
//     over to the real plaintext fields.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";
type ForwarderId = "bob" | "charlie" | "dave";

interface Slice {
  forHop: ForwarderId;
  fields: Array<{ key: string; value: string }>;
  cipher: string[];
}

const HOP_KEY_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",      // indigo blue
  charlie: "#2d7a7a",  // teal
  dave: "#7b4b8a",     // violet
};


// Canonical hop palette — must stay aligned with HtlcPropagationDiagram,
// ForwarderPolicyMap, and PlaintextMessageTear.
const HOP_COLORS: Record<HopId, { stroke: string; fill: string }> = {
  alice:   { stroke: "#b8860b", fill: "#fef3c7" },
  bob:     { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave:    { stroke: "#7b4b8a", fill: "#ede1f3" },
};

const SLICES: Slice[] = [
  {
    forHop: "bob",
    fields: [
      { key: "next_hop", value: "Charlie" },
      { key: "amt_to_forward", value: "10,002 sat" },
      { key: "outgoing_cltv", value: "block 220" },
    ],
    cipher: [
      "7a 3c b1 d4 e5 f8 9a 01 22 cb",
      "4d 8e 3f 2a 7b 9c 1d e4 88 a0",
      "c5 b2 a8 3f 1e 9d 7c 44 ff 21",
    ],
  },
  {
    forHop: "charlie",
    fields: [
      { key: "next_hop", value: "Dave" },
      { key: "amt_to_forward", value: "10,000 sat" },
      { key: "outgoing_cltv", value: "block 180" },
    ],
    cipher: [
      "9f 14 5d 6c 8a 27 e3 b0 41 7d",
      "33 ae c8 12 6b 90 4f a5 db 18",
      "5e 2c 71 99 d4 0b 8c 3a 67 ef",
    ],
  },
  {
    forHop: "dave",
    fields: [
      { key: "final_amt", value: "10,000 sat" },
      { key: "final_cltv", value: "block 140" },
      { key: "payment_hash", value: "0xa3f1...e9c4" },
    ],
    cipher: [
      "b6 41 0e 7c 2d 88 5a fb 09 c3",
      "27 d9 96 1f 4a 73 ec 5b 80 12",
      "8f 03 a4 6e bc 11 d7 25 f9 4b",
    ],
  },
];

// Step semantics:
// 0: at Alice, every slice encrypted in its hop's key color
// 1: at Bob, Bob's slice decrypts (stripes lift, ciphertext → plaintext)
// 2: Bob's slice removed; Charlie's + Dave's stay encrypted on the wire
// 3: at Charlie, Charlie's slice decrypts; Dave's stays encrypted
// 4: Charlie's slice removed; only Dave's encrypted slice remains
// 5: at Dave, Dave's slice decrypts
const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice now encrypts each per-hop slice with that hop's own key. The slices are still in the message, but they're locked. Without the right key, every slice looks like noise.",
  1: "The message arrives at Bob. He runs his key against the stack and only his slice unlocks. Charlie's and Dave's slices are right there too, but Bob can't read them — different keys, different locks.",
  2: "Bob peels his slice off and forwards Charlie's and Dave's encrypted slices onward. Bob never learned anything about Dave or the final amount, because those slices stayed sealed while passing through him.",
  3: "Charlie runs his key. His slice unlocks; Dave's stays encrypted. Charlie still can't see who the destination is or what they'll receive.",
  4: "Charlie peels his slice off and forwards Dave's encrypted slice on alone. Each forwarder consumed only what their own key opened.",
  5: "Dave decrypts the final slice with his key and accepts the HTLC. Privacy preserved: Bob never saw past himself, Charlie never saw past himself, and only Dave learned the final details.",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

function isDecrypted(forHop: ForwarderId, step: number): boolean {
  if (forHop === "bob") return step >= 1;
  if (forHop === "charlie") return step >= 3;
  return step >= 5;
}

function isRemoved(forHop: ForwarderId, step: number): boolean {
  if (forHop === "bob") return step >= 2;
  if (forHop === "charlie") return step >= 4;
  return false;
}

function isUnlockingNow(forHop: ForwarderId, step: number): boolean {
  if (forHop === "bob" && step === 1) return true;
  if (forHop === "charlie" && step === 3) return true;
  if (forHop === "dave" && step === 5) return true;
  return false;
}

const NODE_X_PCT: Record<HopId, number> = {
  alice: 20,
  bob: 40,
  charlie: 60,
  dave: 80,
};

// Pixel-art key glyph rendered in the hop's key color. Sized large enough to
// read clearly beneath the node circle.
function KeyTile({ color, lit }: { color: string; lit: boolean }) {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 14 14"
      style={{
        transition: "transform 400ms ease-out, filter 400ms ease-out",
        transform: lit ? "scale(1.25)" : "scale(1)",
        filter: lit ? `drop-shadow(0 0 4px ${color})` : "none",
      }}
      aria-hidden
    >
      {/* circular bow */}
      <rect x="1" y="3" width="6" height="6" fill={color} />
      <rect x="2" y="4" width="4" height="4" fill="#fffdf5" />
      <rect x="3" y="5" width="2" height="2" fill={color} />
      {/* shaft */}
      <rect x="7" y="6" width="6" height="2" fill={color} />
      {/* teeth */}
      <rect x="11" y="8" width="2" height="2" fill={color} />
      <rect x="9" y="8" width="2" height="2" fill={color} />
    </svg>
  );
}

export function EncryptedSliceReveal() {
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
    }, 1900);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, step]);

  function play() {
    if (step >= TOTAL_STEPS - 1) setStep(0);
    setPlaying(true);
  }
  function pause() { setPlaying(false); }
  function reset() { setPlaying(false); setStep(0); }

  const active = activeHopAt(step);
  const messageLeftPct = NODE_X_PCT[active];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="encrypted-slice-reveal"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            One key per hop
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6" style={{ minHeight: 520 }}>
        {/* Hop track */}
        <div className="relative" style={{ height: 144 }}>
          {[0, 1, 2].map((i) => {
            const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
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
            const label = id === "alice" ? "Alice" : id === "bob" ? "Bob" : id === "charlie" ? "Charlie" : "Dave";
            const keyColor = id === "alice" ? null : HOP_KEY_COLORS[id as ForwarderId];
            const lit = id !== "alice" && isUnlockingNow(id as ForwarderId, step);
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
                  className="rounded-full flex items-center justify-center transition-all duration-500"
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
                </div>
                <div
                  className="mt-1 text-[11px] font-semibold tracking-[0.05em]"
                  style={{ color: "#0f172a" }}
                >
                  {label}
                </div>
                {keyColor && (
                  <Tooltip
                    label={
                      <>
                        <div className="font-bold mb-0.5" style={{ color: "#0f172a" }}>
                          {label}'s public key
                        </div>
                        <div>
                          The node-identity public key Alice used to encrypt
                          this hop's slice. {label} uses the matching private
                          key to decrypt.
                        </div>
                      </>
                    }
                  >
                    <div className="mt-2 flex items-center gap-1">
                      <KeyTile color={keyColor} lit={lit} />
                    </div>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>

        {/* The traveling message */}
        <div
          className="absolute"
          style={{
            top: 168,
            left: `calc(${messageLeftPct}% - 145px)`,
            width: 290,
            transition: "left 1.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
          }}
        >
          {/* Black header strip */}
          <div
            className="bg-black text-white px-3 py-1.5 border-[1.5px] border-black flex items-center gap-2"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            <div className="w-1.5 h-1.5 bg-[#b8860b]" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase">
              PAYMENT_INSTRUCTIONS
            </span>
          </div>

          {/* Envelope body */}
          <div
            className="bg-[#fffdf5] border-[1.5px] border-t-0 border-black p-2"
            style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
          >
            <div className="text-[10px] leading-tight px-1 mb-2">
              <span className="opacity-60">payment_hash:</span>{" "}
              <span className="font-bold">0xa3f1...e9c4</span>
            </div>

            <div className="space-y-1.5">
              {SLICES.map((s) => {
                const decrypted = isDecrypted(s.forHop, step);
                const removed = isRemoved(s.forHop, step);
                const unlockingNow = isUnlockingNow(s.forHop, step);
                const color = HOP_KEY_COLORS[s.forHop];
                return (
                  <div
                    key={s.forHop}
                    className="border-[1.5px] px-2 py-1.5 relative overflow-hidden"
                    style={{
                      borderColor: unlockingNow ? "#b8860b" : color,
                      background: unlockingNow ? "#fef3c7" : "#fffdf5",
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      transition: "max-height 700ms ease-in-out, opacity 700ms ease-in-out, padding 700ms ease-in-out, border-width 700ms ease-in-out, margin 700ms ease-in-out, border-color 500ms ease-in-out, background 500ms ease-in-out",
                      maxHeight: removed ? 0 : 240,
                      opacity: removed ? 0 : 1,
                      paddingTop: removed ? 0 : undefined,
                      paddingBottom: removed ? 0 : undefined,
                      marginTop: removed ? 0 : undefined,
                      marginBottom: removed ? 0 : undefined,
                      borderWidth: removed ? 0 : undefined,
                    }}
                  >
                    {/* Slice header — show the recipient's public-key icon
                        next to their name so it's unambiguous which key opens
                        this slice. */}
                    <div className="text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5 relative z-20">
                      <span className="opacity-60">slice for {s.forHop}</span>
                      <Tooltip
                        label={
                          <>
                            <div className="font-bold mb-0.5" style={{ color: "#0f172a" }}>
                              {s.forHop.charAt(0).toUpperCase() + s.forHop.slice(1)}'s public key
                            </div>
                            <div>
                              Alice encrypted this slice to {s.forHop}'s
                              node-identity public key. Only {s.forHop} can
                              decrypt it, using the matching private key.
                            </div>
                          </>
                        }
                      >
                        <span className="ml-auto inline-flex items-center" style={{ height: 18 }}>
                          <span style={{ display: "inline-block", height: 18 }}>
                            <svg width="22" height="22" viewBox="0 0 14 14" aria-hidden>
                              <rect x="1" y="3" width="6" height="6" fill={color} />
                              <rect x="2" y="4" width="4" height="4" fill="#fffdf5" />
                              <rect x="3" y="5" width="2" height="2" fill={color} />
                              <rect x="7" y="6" width="6" height="2" fill={color} />
                              <rect x="11" y="8" width="2" height="2" fill={color} />
                              <rect x="9" y="8" width="2" height="2" fill={color} />
                            </svg>
                          </span>
                        </span>
                      </Tooltip>
                    </div>

                    {/* Body: ciphertext (encrypted) and plaintext (decrypted)
                        cross-fade. Plaintext determines the height; ciphertext
                        layers on top until decrypted. */}
                    <div className="relative">
                      <div
                        className="text-[10px] leading-tight space-y-0.5"
                        style={{
                          opacity: decrypted ? 1 : 0,
                          transition: "opacity 600ms ease-in-out 200ms",
                        }}
                      >
                        {s.fields.map((f) => (
                          <div key={f.key}>
                            <span className="opacity-60">{f.key}:</span>{" "}
                            <span className="font-bold">{f.value}</span>
                          </div>
                        ))}
                      </div>
                      <div
                        className="absolute inset-0 text-[10px] leading-tight space-y-0.5 pointer-events-none"
                        style={{
                          opacity: decrypted ? 0 : 1,
                          color: color,
                          transition: "opacity 500ms ease-in-out",
                        }}
                      >
                        {s.cipher.map((line, i) => (
                          <div key={i} className="font-bold tracking-wide">
                            {line}
                          </div>
                        ))}
                      </div>
                      {/* Diagonal stripe overlay in the hop's key color */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          opacity: decrypted ? 0 : 0.55,
                          backgroundImage: `repeating-linear-gradient(135deg, ${color} 0px, ${color} 3px, transparent 3px, transparent 7px)`,
                          transition: "opacity 600ms ease-in-out",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="encrypted-slice-reveal-play"
            >
              {playing ? "❚❚ Pause" : step >= TOTAL_STEPS - 1 ? "↻ Replay" : "▶ Play"}
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
                  onClick={() => { setPlaying(false); setStep(i); }}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`encrypted-slice-reveal-step-${i}`}
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

export default EncryptedSliceReveal;
