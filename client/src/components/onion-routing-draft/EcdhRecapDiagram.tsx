import { useEffect, useRef, useState, type ReactNode } from "react";
import { StepCaption } from "./StepCaption";

// ────────────────────────────────────────────────────────────────────────────
// EcdhRecapDiagram (DRAFT)
//
// Single-visual ECDH refresher. Two modes (Abstract / Concrete) selectable
// via toggle. Three pedagogical steps reveal the protocol progressively:
//   1. Setup     each party has a keypair (private + public)
//   2. Exchange  public keys travel to the center, both visible
//   3. Compute   each party computes the shared point; gold pill appears
//
// No mount-time animation. Step buttons drive the reveal.
// All variables render in ink (no per-side color coding). Hover tooltips
// use position: fixed with viewport clamping so they never get cut off.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const CREAM_CARD = "#fffdf5";
const SHARED = "#b8860b";
const MONO = '"JetBrains Mono", "Fira Code", monospace';

type Mode = "abstract" | "concrete";

interface ModeValues {
  a: string;
  b: string;
  G: string;
  A: string;
  B: string;
  // Compact label for the public-key chip that flies to the center during the
  // exchange step. The full derivation (e.g. "A = 3 · 7 = 21") lives on the
  // party card; the chip only needs the key + its value so the two chips don't
  // collide when they meet in the middle.
  chipA: string;
  chipB: string;
  shared: string;
  sharedHash: string;
  sharedSecret: string;
}

const VALUES: Record<Mode, ModeValues> = {
  abstract: {
    a: "a",
    b: "b",
    G: "G",
    A: "A = a · G",
    B: "B = b · G",
    chipA: "A = a · G",
    chipB: "B = b · G",
    shared: "ab · G",
    sharedHash: "SHA256(ab · G)",
    sharedSecret: "32-byte shared secret",
  },
  concrete: {
    a: "3",
    b: "5",
    G: "7",
    A: "A = 3 · 7 = 21",
    B: "B = 5 · 7 = 35",
    chipA: "A = 21",
    chipB: "B = 35",
    shared: "105",
    sharedHash: "SHA256(105)",
    // Real SHA256 of the shared point 105, truncated for display.
    sharedSecret: "0x1253e937…0155e860",
  },
};

// ── Tooltip catalog ─────────────────────────────────────────────────────────

function tooltips(mode: Mode) {
  if (mode === "abstract") {
    return {
      a: "Alice's private key. A 256-bit random number she rolls locally and never shares.",
      A: "Alice's public key, which is just a · G. Safe to hand out, since recovering a from A means solving the discrete log problem (good luck!).",
      b: "Bob's private key. A 256-bit random number he rolls locally and never shares.",
      B: "Bob's public key, which is just b · G. Safe to hand out.",
      G: "The generator point. A fixed point on the elliptic curve that everyone knows.",
      shared:
        "The shared point. Both sides land on it without ever sending it. An eavesdropper sees A and B, but with no private key, can't fold them into ab · G.",
    };
  }
  return {
    a: "Alice's private number. In real ECDH this would be 256 bits of randomness, not 3.",
    A: "Alice's public key, 3 · 7 = 21. Safe to publish.",
    b: "Bob's private number. In real ECDH this would be 256 bits of randomness, not 5.",
    B: "Bob's public key, 5 · 7 = 35. Safe to publish.",
    G: "The generator. Everyone shares the same one. We're using 7 as a stand-in for the fixed, well-known point on a real curve.",
    shared:
      "The shared point. Both reach 105 because 3 · 5 = 5 · 3, and neither had to send it. Each one worked it out on its own.",
  };
}

// ── HoverTip with viewport-clamped fixed positioning ────────────────────────

const TIP_WIDTH = 240;

function HoverTip({ children, info }: { children: ReactNode; info: string }) {
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: true });
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const desiredX = r.left + r.width / 2 - TIP_WIDTH / 2;
    const x = Math.max(
      margin,
      Math.min(window.innerWidth - TIP_WIDTH - margin, desiredX)
    );
    const aboveY = r.top - 10;
    const fitsAbove = aboveY > 80;
    const y = fitsAbove ? aboveY : r.bottom + 10;
    setPos({ x, y, above: fitsAbove });
    setShown(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setShown(false)}
      style={{
        position: "relative",
        cursor: "help",
        display: "inline-block",
        borderBottom: `1px dotted ${SLATE}`,
      }}
    >
      {children}
      {shown && (
        <span
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.above ? undefined : pos.y,
            bottom: pos.above ? window.innerHeight - pos.y : undefined,
            width: TIP_WIDTH,
            zIndex: 50,
            padding: "8px 10px",
            background: "#fffdf5",
            color: INK,
            border: "1.5px solid #0f172a",
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontWeight: 400,
            letterSpacing: "0.01em",
            whiteSpace: "normal",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            pointerEvents: "none",
          }}
        >
          {info}
        </span>
      )}
    </span>
  );
}

// ── Inline value with hover ─────────────────────────────────────────────────

function V({ children, info }: { children: ReactNode; info: string }) {
  return (
    <HoverTip info={info}>
      <span style={{ color: INK, fontWeight: 700, fontFamily: MONO }}>{children}</span>
    </HoverTip>
  );
}

// ── Lock tile ───────────────────────────────────────────────────────────────

function LockTile() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="3" y="2" width="1" height="3" fill={SLATE} />
      <rect x="8" y="2" width="1" height="3" fill={SLATE} />
      <rect x="4" y="1" width="4" height="1" fill={SLATE} />
      <rect x="2" y="5" width="8" height="6" fill={SLATE} />
      <rect x="5" y="7" width="2" height="2" fill={CREAM_CARD} />
    </svg>
  );
}

// ── Mode toggle ─────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const Btn = ({ value, label }: { value: Mode; label: string }) => (
    <button
      onClick={() => onChange(value)}
      className="px-3 py-1 border-[1.5px] text-[10px] font-bold tracking-[0.06em] uppercase transition-colors"
      style={{
        background: mode === value ? INK : CREAM_CARD,
        color: mode === value ? "#fffdf5" : INK,
        borderColor: INK,
      }}
      data-testid={`ecdh-recap-mode-${value}`}
    >
      {label}
    </button>
  );
  return (
    <div className="border-b-[1.5px] border-foreground/20 px-4 py-2 flex items-center gap-2 flex-wrap">
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        Mode
      </span>
      <Btn value="abstract" label="Abstract" />
      <Btn value="concrete" label="Concrete (a=3, b=5, G=7)" />
    </div>
  );
}

// ── Party column ────────────────────────────────────────────────────────────

interface PartyColumnProps {
  name: string;
  privVar: ReactNode;
  pubVar: ReactNode;
  computeStep1: ReactNode;
  computeStep2: ReactNode;
  computeFinal: ReactNode;
  showCompute: boolean;
}

function PartyColumn({
  name,
  privVar,
  pubVar,
  computeStep1,
  computeStep2,
  computeFinal,
  showCompute,
}: PartyColumnProps) {
  return (
    <div className="flex flex-col items-center gap-3" style={{ width: 220 }}>
      <div
        className="px-4 py-1.5 border-[1.5px]"
        style={{ background: CREAM_CARD, borderColor: INK, color: INK }}
      >
        <span className="text-sm font-bold tracking-[0.08em] uppercase">{name}</span>
      </div>

      <div
        className="w-full border-[1.5px] px-3 py-2"
        style={{ background: CREAM_CARD, borderColor: INK, fontFamily: MONO }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <LockTile />
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {name.toLowerCase()}'s private
          </span>
        </div>
        <div className="text-[12px] mb-2">{privVar}</div>
        <div
          className="text-[9px] uppercase tracking-wider mb-1"
          style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {name.toLowerCase()}'s public
        </div>
        <div className="text-[12px]">{pubVar}</div>
      </div>

      <div
        className="w-full border-[1.5px] px-3 py-2"
        style={{
          background: CREAM_CARD,
          borderColor: showCompute ? INK : "transparent",
          fontFamily: MONO,
          minHeight: 110,
          opacity: showCompute ? 1 : 0.25,
          transition: "opacity 250ms ease-out, border-color 250ms ease-out",
        }}
      >
        <div
          className="text-[9px] uppercase tracking-wider mb-1"
          style={{
            color: SLATE,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          compute
        </div>
        {showCompute ? (
          <>
            <div className="text-[12px] leading-relaxed" style={{ color: INK }}>
              <div>{computeStep1}</div>
              <div style={{ color: SLATE }}>{computeStep2}</div>
              <div>= {computeFinal}</div>
            </div>
            <div
              className="mt-1.5 text-[10px] flex items-center gap-1"
              style={{ color: INK, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            >
              <span style={{ fontWeight: 700 }}>→</span>
              <span className="italic">shared_point</span>
            </div>
          </>
        ) : (
          <div
            className="text-[10px] italic"
            style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            (waiting on the other side's public key...)
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step controls (no Play, just numbered steps + Reset) ────────────────────

const TOTAL_STEPS = 3;

const STEP_CAPTIONS: Record<Mode, Record<number, string>> = {
  abstract: {
    0: "First, each party rolls a private key (a 256-bit random number) and derives a public key from it. The private key never leaves its owner. The public key, you can hand out freely.",
    1: "Now Alice and Bob trade public keys. Those two values in the center are all an eavesdropper gets to see. Without one of the private keys, that's just not enough to reach ab · G.",
    2: "Watch what happens as each public key flies into the other side's math. Alice mixes her private key with B, Bob mixes his with A, and they land on the *same* shared point because scalar multiplication commutes. Hash that point and you've got a 32-byte symmetric key.",
  },
  concrete: {
    0: "Here we plug in tiny stand-ins: Alice's private key is 3, Bob's is 5, and the generator G is 7. (Real keys are 256-bit random numbers, but small ones keep the arithmetic easy to follow.) Each public key is just the private key times G, so Alice publishes 3 · 7 = 21 and Bob publishes 5 · 7 = 35.",
    1: "Alice and Bob swap public keys, so 21 and 35 are the values that travel across the wire. Notice that neither private number, 3 or 5, ever leaves home.",
    2: "Now each side folds in its own private number. Alice computes 3 · 35 = 105, Bob computes 5 · 21 = 105, and they land on the *same* 105 because 3 · 5 = 5 · 3. Hash that shared number and both ends hold the identical 32-byte key. (With real 256-bit keys, someone who sees 21 and 35 still cannot work back to 3 or 5. That is the discrete log problem doing the heavy lifting.)",
  },
};

const STEP_TITLES: Record<number, string> = {
  0: "Generate keypairs",
  1: "Exchange public keys",
  2: "Compute the shared point",
};

const STEP_LABELS: Record<number, string> = {
  0: "Step 1 of 3 · Setup",
  1: "Step 2 of 3 · Exchange",
  2: "Step 3 of 3 · Compute",
};

// ── Main component ──────────────────────────────────────────────────────────

export function EcdhRecapDiagram() {
  const [mode, setMode] = useState<Mode>("abstract");
  const [step, setStep] = useState<number>(0);
  // arrived = chips have completed their step-3 flight to opposite compute boxes
  const [arrived, setArrived] = useState(false);

  // Reset to step 0 when mode changes.
  useEffect(() => {
    setStep(0);
  }, [mode]);

  // Manage the step-3 arrival timing.
  useEffect(() => {
    if (step >= 2) {
      setArrived(false);
      const t = setTimeout(() => setArrived(true), 750);
      return () => clearTimeout(t);
    }
    setArrived(false);
  }, [step]);

  const v = VALUES[mode];
  const t = tooltips(mode);

  const showExchange = step >= 1; // chips visible
  const flyingToCompute = step >= 2; // chips moving to opposite compute box
  // Compute boxes ignite once chips arrive
  const showCompute = step >= 2 && arrived;
  const showShared = step >= 2 && arrived;

  // Chip transforms across step transitions.
  // Distances are tuned for the 220 / 240 / 220 column layout.
  const aliceChipTransform =
    step === 0
      ? "translate(-180px, 0)"
      : step === 1
        ? "translate(0, 0)"
        : "translate(336px, 170px)";
  const bobChipTransform =
    step === 0
      ? "translate(180px, 0)"
      : step === 1
        ? "translate(0, 0)"
        : "translate(-336px, 170px)";

  // Opacity: fade out only AFTER arrival at the compute box.
  const aliceChipOpacity = step === 0 ? 0 : flyingToCompute && arrived ? 0 : 1;
  const bobChipOpacity = aliceChipOpacity;

  // Tokens.
  const aTok = <V info={t.a}>{v.a}</V>;
  const bTok = <V info={t.b}>{v.b}</V>;
  const ATok = <V info={t.A}>{v.A}</V>;
  const BTok = <V info={t.B}>{v.B}</V>;
  const GTok = <V info={t.G}>{v.G}</V>;
  const sharedInline = <V info={t.shared}>{v.shared}</V>;

  // Compute box contents.
  const aliceStep1 = (
    <>
      {aTok} <span style={{ color: INK }}>·</span> <V info={t.B}>B</V>
    </>
  );
  const aliceStep2 = (
    <>
      = {aTok} · ({bTok} · {GTok})
    </>
  );
  const bobStep1 = (
    <>
      {bTok} <span style={{ color: INK }}>·</span> <V info={t.A}>A</V>
    </>
  );
  const bobStep2 = (
    <>
      = {bTok} · ({aTok} · {GTok})
    </>
  );

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="ecdh-recap-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            ECDH key exchange
          </span>
        </div>
      </div>

      {/* Mode toggle */}
      <ModeToggle mode={mode} onChange={setMode} />

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative px-4 py-6 bg-[#fefdfb] dark:bg-[#0b1220]"
          style={{ minHeight: 380, minWidth: 760 }}
        >
          <div className="flex items-stretch justify-center gap-4">
            <PartyColumn
              name="Alice"
              privVar={aTok}
              pubVar={ATok}
              computeStep1={aliceStep1}
              computeStep2={aliceStep2}
              computeFinal={sharedInline}
              showCompute={showCompute}
            />

            {/* Center column */}
            <div
              className="flex flex-col items-center justify-start"
              style={{ width: 240, paddingTop: 56 }}
            >
              {/* Exchange lane:
                    Step 1: A and B chips slide from their cards into the center.
                    Step 2: chips continue to the OPPOSITE compute box (Alice's A
                            flies to Bob's box, Bob's B flies to Alice's). They
                            fade once they arrive, ignoring the compute box. */}
              <div
                className="relative w-full"
                style={{
                  minHeight: 44,
                  marginBottom: 16,
                }}
                aria-hidden
              >
                {/* Alice's public key chip */}
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    left: "50%",
                    marginLeft: -90,
                    background: CREAM_CARD,
                    border: `1.5px solid ${INK}`,
                    color: INK,
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 8px",
                    whiteSpace: "nowrap",
                    transform: aliceChipTransform,
                    opacity: aliceChipOpacity,
                    transition:
                      "transform 750ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease-out",
                    zIndex: 5,
                  }}
                >
                  {v.chipA}
                </div>
                {/* Bob's public key chip */}
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: "50%",
                    marginRight: -90,
                    background: CREAM_CARD,
                    border: `1.5px solid ${INK}`,
                    color: INK,
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 8px",
                    whiteSpace: "nowrap",
                    transform: bobChipTransform,
                    opacity: bobChipOpacity,
                    transition:
                      "transform 750ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease-out",
                    zIndex: 5,
                  }}
                >
                  {v.chipB}
                </div>
              </div>

              {/* Shared point pill: appears at step 2 */}
              <div
                className="px-4 py-2 border-[1.5px]"
                style={{
                  background: SHARED,
                  borderColor: SHARED,
                  color: "#ffffff",
                  opacity: showCompute ? 1 : 0,
                  transform: showCompute ? "scale(1)" : "scale(0.85)",
                  transition: "opacity 250ms ease-out, transform 250ms ease-out",
                  pointerEvents: showCompute ? "auto" : "none",
                }}
              >
                <div className="text-[10px] tracking-[0.1em] uppercase font-bold opacity-80">
                  shared point
                </div>
                <div className="text-[14px] font-bold mt-0.5" style={{ fontFamily: MONO }}>
                  <HoverTip info={t.shared}>
                    <span style={{ borderBottom: "1px dotted rgba(255,255,255,0.5)" }}>
                      {v.shared}
                    </span>
                  </HoverTip>
                </div>
              </div>

              {/* SHA256 caption beneath the pill */}
              <div
                className="mt-3 text-center"
                style={{
                  opacity: showCompute ? 1 : 0,
                  transition: "opacity 250ms ease-out 100ms",
                }}
              >
                <div
                  className="text-[10px] leading-snug"
                  style={{ color: SLATE, fontFamily: MONO }}
                >
                  {v.sharedHash}
                </div>
                {mode === "concrete" ? (
                  <>
                    <div
                      className="text-[10px] leading-snug mt-0.5"
                      style={{ color: INK, fontFamily: MONO }}
                    >
                      <span style={{ fontWeight: 700 }}>→</span> {v.sharedSecret}
                    </div>
                    <div
                      className="text-[9px] leading-snug mt-0.5 italic"
                      style={{
                        color: SLATE,
                        fontFamily: "ui-sans-serif, system-ui, sans-serif",
                      }}
                    >
                      32-byte shared secret
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] leading-snug mt-0.5" style={{ color: INK }}>
                    <span style={{ fontWeight: 700 }}>→</span>{" "}
                    <span className="italic">{v.sharedSecret}</span>
                  </div>
                )}
              </div>
            </div>

            <PartyColumn
              name="Bob"
              privVar={bTok}
              pubVar={BTok}
              computeStep1={bobStep1}
              computeStep2={bobStep2}
              computeFinal={sharedInline}
              showCompute={showCompute}
            />
          </div>

          <StepCaption
            label={STEP_LABELS[step]}
            title={STEP_TITLES[step]}
            caption={`${STEP_CAPTIONS[mode][step]} Hover any value above for a refresher.`}
            accentColor={SHARED}
          />
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={() => setStep(0)}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
              data-testid="ecdh-recap-reset"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background:
                      step === i ? SHARED : step > i ? "#fef3c7" : CREAM_CARD,
                    borderColor: step === i ? SHARED : INK,
                    color: step === i ? "#fffdf5" : INK,
                  }}
                  data-testid={`ecdh-recap-step-${i}`}
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

export default EcdhRecapDiagram;
