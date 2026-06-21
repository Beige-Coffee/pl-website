import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Tok, MathLine } from "./mathTokens";
import { HatchOverlay } from "./encryptionHatch";
import { MorphBox } from "./morph";
import { StepCaption } from "./StepCaption";

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
// Charlie → mark processed → highlight at Dave). Slices stay in the packet
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
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

// Focus treatment. There is no per-item color coding and no special "active"
// accent color anymore. The active hop's packet items sit in the foreground at
// full strength (ink border, cream fill, a soft drop shadow); every other item
// recedes to a uniform muted gray at reduced opacity.
const FOCUS_BORDER = "#0f172a"; // ink, foreground
const FOCUS_BG = "#fffdf5"; // cream, foreground
const DIM_BORDER = "#cbd5e1"; // slate-300, receded
const DIM_BG = "#f8fafc"; // slate-50, receded
const FOCUS_SHADOW = "0 4px 14px rgba(15,23,42,0.18)";

const HOP_PAYLOADS = [
  {
    forHop: "bob" as const,
    color: HOP_COLORS.bob,
    pubkey: "0x03 9b f1 4c ... 8a",
    pubLabel: "E_Bob",
    privLabel: "e_Bob",
    ciphertext: "c4 9a f7 8b ... 81",
    // Plaintext revealed once this hop decrypts. Mirrors the slices in
    // EncryptedSliceReveal so the two visuals tell a consistent story.
    fields: [
      { key: "next_hop", value: "Charlie" },
      { key: "amt_to_forward", value: "10,002 sat" },
      { key: "outgoing_cltv", value: "block 220" },
    ],
  },
  {
    forHop: "charlie" as const,
    color: HOP_COLORS.charlie,
    pubkey: "0x02 7e 1c 22 ... 5d",
    pubLabel: "E_Charlie",
    privLabel: "e_Charlie",
    ciphertext: "7e 1b 24 a3 ... 5a",
    fields: [
      { key: "next_hop", value: "Dave" },
      { key: "amt_to_forward", value: "10,000 sat" },
      { key: "outgoing_cltv", value: "block 180" },
    ],
  },
  {
    forHop: "dave" as const,
    color: HOP_COLORS.dave,
    pubkey: "0x03 5f 88 a0 ... 12",
    pubLabel: "E_Dave",
    privLabel: "e_Dave",
    ciphertext: "9f 4c 03 d7 ... 03",
    fields: [
      { key: "final_amt", value: "10,000 sat" },
      { key: "final_cltv", value: "block 180" },
      { key: "payment_hash", value: "0xa3f1...e9c4" },
    ],
  },
];

const TOTAL_STEPS = 6;

const STEP_CAPTIONS: Record<number, string> = {
  0: "So this time, Alice makes a fresh ephemeral keypair for *every* hop, and packs all three pubkeys into the packet next to their encrypted slices. Hover the chip under Alice to see the three keypairs she's now stuck holding onto.",
  1: "Bob gets the packet. He runs his own private key against E_Bob from his slice to derive ss_AB, then decrypts his slice. Charlie's and Dave's slices are still riding along, and they're still pubkeys Bob has no use for.",
  2: "Bob's done with his slice, so he forwards the packet to Charlie. Notice it still carries E_Charlie and E_Dave. The packet didn't shrink, and that cost didn't go anywhere.",
  3: "Now Charlie does the same with his slice. ECDH between his node private key and E_Charlie gives him ss_AC, and he decrypts his slice.",
  4: "Charlie's slice is handled, and the packet keeps moving with E_Dave still tucked inside.",
  5: "Finally, Dave wraps up the route. ECDH between his node private key and E_Dave gives him ss_AD, and he decrypts his slice. The math all worked, but here's the catch: every packet hauled three pubkeys, and Alice had to babysit three keypairs the entire time.",
};

const STEP_TITLES: Record<number, string> = {
  0: "Alice packs one pubkey per hop",
  1: "Bob derives ss_AB and decrypts",
  2: "Bob forwards to Charlie",
  3: "Charlie derives ss_AC and decrypts",
  4: "Charlie forwards to Dave",
  5: "Dave derives ss_AD and decrypts",
};

const STEP_LABELS: Record<number, string> = {
  0: "Step 1 of 6 · Alice · Build",
  1: "Step 2 of 6 · Bob · Decrypt",
  2: "Step 3 of 6 · Bob · Forward",
  3: "Step 4 of 6 · Charlie · Decrypt",
  4: "Step 5 of 6 · Charlie · Forward",
  5: "Step 6 of 6 · Dave · Decrypt",
};

function activeHopAt(step: number): HopId {
  if (step === 0) return "alice";
  if (step <= 2) return "bob";
  if (step <= 4) return "charlie";
  return "dave";
}

// The active hop's items are in focus (foreground); every other item is dimmed.
// Step 0 is Alice's build beat, where nothing is dimmed: the whole freshly
// packed packet shows at full strength.
function focusFor(
  forHop: "bob" | "charlie" | "dave",
  step: number,
): { focused: boolean; dimmed: boolean } {
  const focused = activeHopAt(step) === forHop;
  const dimmed = step !== 0 && !focused;
  return { focused, dimmed };
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const POPOVER_W = 240;

  function show() {
    const el = chipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const halfW = POPOVER_W / 2;
    let x = rect.left + rect.width / 2;
    // Clamp horizontally so the centered popover never runs off-screen.
    if (x - halfW < 8) x = halfW + 8;
    if (x + halfW > window.innerWidth - 8) x = window.innerWidth - halfW - 8;
    const y = rect.bottom + 8;
    setPos({ x, y });
  }
  function hide() {
    setPos(null);
  }

  return (
    <div
      ref={chipRef}
      onMouseEnter={show}
      onMouseLeave={hide}
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
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="fixed z-[9999]"
          style={{
            top: pos.y,
            left: pos.x,
            transform: "translateX(-50%)",
            width: POPOVER_W,
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
            {HOP_PAYLOADS.map((s) => (
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
              can't toss them out mid-payment.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function NaivePacketDiagram() {
  const [step, setStep] = useState(0);

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }
  function next() {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }
  function reset() {
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

      {/* Stage wrapped in an overflow-x container so the packet + ECDH panel
          (and the per-hop drift) scroll horizontally on narrow viewports
          rather than colliding. */}
      <div className="overflow-x-auto">
      <div
        className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 770, minWidth: 760 }}
      >
        {/* Hop track */}
        <div className="relative mb-6" style={{ height: 110 }}>
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
                  top: 32,
                  left: `calc(${startPct}% + 34px)`,
                  width: `calc(${endPct - startPct}% - 68px)`,
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
                    width: 64,
                    height: 64,
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
                  <span
                    className="normal-case tracking-normal"
                    style={{ color: "#5a7a2f", fontWeight: 700 }}
                  >
                    · in the clear
                  </span>
                  <span className="ml-auto opacity-70 normal-case tracking-normal">
                    3 entries
                  </span>
                </div>
                <div className="space-y-1">
                  {HOP_PAYLOADS.map((s) => {
                    const { focused, dimmed } = focusFor(s.forHop, step);
                    return (
                      <div
                        key={s.forHop}
                        className="border-[1.5px] px-1.5 py-1 flex items-center gap-1.5"
                        style={{
                          borderColor: dimmed ? DIM_BORDER : FOCUS_BORDER,
                          background: dimmed ? DIM_BG : FOCUS_BG,
                          opacity: dimmed ? 0.5 : 1,
                          boxShadow: focused ? FOCUS_SHADOW : "none",
                          transition:
                            "background 400ms ease-in-out, border-color 400ms ease-in-out, opacity 400ms ease-in-out, box-shadow 400ms ease-in-out",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold"
                          style={{
                            color: INK,
                            minWidth: 70,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                          }}
                        >
                          <Tok token={s.pubLabel} color={INK} />:
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
                {HOP_PAYLOADS.map((s) => {
                  const processed = isProcessed(s.forHop, step);
                  const { focused, dimmed } = focusFor(s.forHop, step);
                  // Mini-labels and the lock glyph stay a uniform slate; the
                  // container opacity is what dims them when this hop is not in
                  // focus.
                  const labelColor = SLATE;
                  return (
                    <div
                      key={s.forHop}
                      className="border-[1.5px] px-2 py-1.5 relative overflow-hidden"
                      style={{
                        borderColor: dimmed ? DIM_BORDER : FOCUS_BORDER,
                        background: dimmed ? DIM_BG : FOCUS_BG,
                        opacity: dimmed ? 0.5 : 1,
                        boxShadow: focused ? FOCUS_SHADOW : "none",
                        transition:
                          "background 400ms ease-in-out, border-color 400ms ease-in-out, opacity 400ms ease-in-out, box-shadow 400ms ease-in-out",
                      }}
                    >
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        initial={false}
                        animate={{ opacity: processed ? 0 : 1 }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        style={{ zIndex: 1 }}
                      >
                        <HatchOverlay
                          hops={[s.forHop]}
                          zIndex={1}
                          stripeOpacity={0.16}
                        />
                      </motion.div>
                      <div
                        className="text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1 relative"
                        style={{ color: labelColor, zIndex: 2 }}
                      >
                        <span
                          style={{
                            background: processed
                              ? "transparent"
                              : "rgba(255,253,245,0.85)",
                            padding: processed ? 0 : "0 3px",
                          }}
                        >
                          slice for {s.forHop}
                        </span>
                        <span
                          className="ml-auto normal-case tracking-normal flex items-center gap-1"
                          style={{
                            background: processed
                              ? "transparent"
                              : "rgba(255,253,245,0.85)",
                            padding: processed ? 0 : "0 3px",
                          }}
                        >
                          {!processed && <LockTile tint={labelColor} />}
                          {processed ? "✓ decrypted" : "encrypted"}
                        </span>
                      </div>
                      {processed ? (
                        <div
                          className="text-[10px] leading-tight space-y-0.5 relative"
                          style={{ color: INK, zIndex: 2 }}
                        >
                          {s.fields.map((f) => (
                            <div key={f.key}>
                              <span className="opacity-60">{f.key}:</span>{" "}
                              <span className="font-bold">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="text-[10px] leading-tight relative inline-block"
                          style={{
                            color: INK,
                            letterSpacing: "0.04em",
                            zIndex: 2,
                            background: "rgba(255,253,245,0.82)",
                            padding: "1px 4px",
                          }}
                        >
                          {s.ciphertext}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ECDH calculation panel beside the packet at active forwarder
              steps. Each hop performs ECDH with its OWN ephemeral pubkey from
              the packet (not Alice's pubkey, unlike the first attempt). It
              mounts/unmounts between Alice's setup beat and the forwarder beats,
              so it fades in/out (and crossfades between forwarders, keyed on the
              active hop) instead of popping. */}
          <AnimatePresence mode="wait">
            {isForwarder && ecdh && (
              <MorphBox
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ width: 280 }}
              >
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
                    (from this hop's slice)
                  </span>
                </div>

                <div className="text-[10px] mb-2" style={{ color: SLATE }}>
                  {"= "}
                  <MathLine
                    text="SHA256(curve_point)"
                    color={SLATE}
                    fontSize={10}
                    weight={500}
                  />
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
              </MorphBox>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 mx-auto" style={{ maxWidth: 660 }}>
          <StepCaption
            label={STEP_LABELS[step]}
            title={STEP_TITLES[step]}
            caption={STEP_CAPTIONS[step]}
            accentColor={HOP_COLORS[active].stroke}
          />
        </div>
      </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={back}
              disabled={step <= 0}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
              data-testid="naive-packet-diagram-back"
            >
              ← Back
            </button>
            <button
              onClick={next}
              disabled={step >= TOTAL_STEPS - 1}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card"
              data-testid="naive-packet-diagram-next"
            >
              Next →
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
        </div>
      </div>
    </div>
  );
}

export default NaivePacketDiagram;
