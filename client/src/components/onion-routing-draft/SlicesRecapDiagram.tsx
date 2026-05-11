import { useEffect, useRef, useState } from "react";
import { Tok } from "./mathTokens";
import { LAYER_ANGLES } from "./encryptionHatch";

// ────────────────────────────────────────────────────────────────────────────
// SlicesRecapDiagram (DRAFT)
//
// Animated chapter-5 (key-derivation) recap of "encrypted slices per hop."
// Echoes EncryptedSliceReveal (chapter 3) but uses the chapter-4 BOLT 4
// shared-secret notation: Alice has all three secrets (ss_AB, ss_AC, ss_AD);
// each forwarder holds the matching one. As the message moves through the
// route, the active hop's shared-secret tile lights up, that hop's slice
// unlocks (hatch fades, plaintext appears), then peels off as the message
// forwards.
//
// Six steps, matching EncryptedSliceReveal's structure:
//   0: at Alice. All three slices encrypted. Message hasn't been sent yet.
//   1: at Bob. Bob's ss_AB unlocks his slice; Charlie's and Dave's stay opaque.
//   2: Bob's slice peeled off. Message moves toward Charlie.
//   3: at Charlie. ss_AC unlocks his slice; Dave's stays encrypted.
//   4: Charlie's slice peeled off. Message moves toward Dave.
//   5: at Dave. ss_AD unlocks the final slice. Dave is the destination.
//
// Visual style follows the locked onion-routing format spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), 1.5px ink borders, gold accents.
//   - Hop circles 60px, canonical palette (matches HtlcPropagationDiagram).
//   - Slices use the per-hop shared-secret color with diagonal hatch when
//     encrypted, solid soft fill when decrypted, opacity-0 when removed.
// ────────────────────────────────────────────────────────────────────────────

type ForwarderId = "bob" | "charlie" | "dave";
type HopId = "alice" | ForwarderId;

const HOP_KEY_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};

const HOP_FILL_COLORS: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};

const HOP_STROKE_COLORS: Record<HopId, string> = {
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

// Column percentages for hop circles + secret tiles. Spread evenly across
// the stage so the four hops read as a route.
const NODE_X_PCT: Record<HopId, number> = {
  alice: 14,
  bob: 38,
  charlie: 62,
  dave: 86,
};

// Separate set of percentages for the animated packet's center, pulled in
// from the extremes so the 320px packet stays fully within the 720-800px
// stage at every step (no clipping at alice or dave).
const PACKET_X_PCT: Record<HopId, number> = {
  alice: 23,
  bob: 41,
  charlie: 59,
  dave: 77,
};

const SECRET_TOKEN: Record<ForwarderId, string> = {
  bob: "ss_AB",
  charlie: "ss_AC",
  dave: "ss_AD",
};

interface SliceContent {
  forHop: ForwarderId;
  cipher: string[];
  plain: { label: string; value: string }[];
}

const SLICES: SliceContent[] = [
  {
    forHop: "bob",
    cipher: [
      "7a 3c b1 d4 e5 f8 9a 01 22 cb",
      "4d 8e 3f 2a 7b 9c 1d e4 88 a0",
    ],
    plain: [
      { label: "next_hop", value: "Charlie" },
      { label: "amt_to_forward", value: "10,001,000" },
      { label: "outgoing_cltv", value: "180" },
    ],
  },
  {
    forHop: "charlie",
    cipher: [
      "9f 14 5d 6c 8a 27 e3 b0 41 7d",
      "33 ae c8 12 6b 90 4f a5 db 18",
    ],
    plain: [
      { label: "next_hop", value: "Dave" },
      { label: "amt_to_forward", value: "10,000,000" },
      { label: "outgoing_cltv", value: "140" },
    ],
  },
  {
    forHop: "dave",
    cipher: [
      "b6 41 0e 7c 2d 88 5a fb 09 c3",
      "27 d9 96 1f 4a 73 ec 5b 80 12",
    ],
    plain: [
      { label: "final_amount", value: "10,000,000" },
      { label: "final_cltv", value: "140" },
    ],
  },
];

const TOTAL_STEPS = 6;
const STEP_MS = 2000;

const STEP_CAPTIONS: Record<number, string> = {
  0: "Alice has assembled the message: three slices, each encrypted with the shared secret she derived for that hop. She ships it to Bob.",
  1: "Bob runs ss_AB against his slice and it unlocks. He reads his routing instructions. Charlie's and Dave's slices stay opaque to him.",
  2: "Bob peels his slice off the message and forwards Charlie's and Dave's encrypted slices onward.",
  3: "Charlie runs ss_AC. His slice unlocks; Dave's stays encrypted.",
  4: "Charlie peels his slice off and forwards Dave's slice on alone.",
  5: "Dave runs ss_AD. The final slice carries the invoice amount and cltv. He's the destination.",
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

function isLitSecret(forHop: ForwarderId, step: number): boolean {
  if (forHop === "bob") return step === 1 || step === 2;
  if (forHop === "charlie") return step === 3 || step === 4;
  return step === 5;
}

function SecretTile({
  color,
  token,
  size = "md",
  lit,
}: {
  color: string;
  token: string;
  size?: "sm" | "md" | "lg";
  lit?: boolean;
}) {
  const px = size === "sm" ? 22 : size === "lg" ? 36 : 30;
  const fontSize = size === "sm" ? 11 : size === "lg" ? 16 : 14;
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        transition: "transform 400ms ease-out, filter 400ms ease-out",
        transform: lit ? "scale(1.2)" : "scale(1)",
        filter: lit ? `drop-shadow(0 0 5px ${color})` : "none",
      }}
    >
      <svg width={px} height={px} viewBox="0 0 14 14" aria-hidden>
        <rect x="1" y="3" width="6" height="6" fill={color} />
        <rect x="2" y="4" width="4" height="4" fill="#fffdf5" />
        <rect x="3" y="5" width="2" height="2" fill={color} />
        <rect x="7" y="6" width="6" height="2" fill={color} />
        <rect x="11" y="8" width="2" height="2" fill={color} />
        <rect x="9" y="8" width="2" height="2" fill={color} />
      </svg>
      <span
        className="font-bold"
        style={{
          fontSize,
          color,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}
      >
        <Tok token={token} color={color} />
      </span>
    </div>
  );
}

function HopCircle({
  hop,
  isActive,
}: {
  hop: HopId;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-full flex items-center justify-center transition-all duration-500"
        style={{
          width: 60,
          height: 60,
          background: HOP_FILL_COLORS[hop],
          border: `${isActive ? 3 : 2}px solid ${HOP_STROKE_COLORS[hop]}`,
          boxShadow: isActive ? `0 0 0 4px rgba(184,134,11,0.30)` : undefined,
        }}
      >
        <span
          className="font-bold"
          style={{
            fontSize: 22,
            color: "#0f172a",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {HOP_LABEL[hop].charAt(0)}
        </span>
      </div>
      <div
        className="text-xs font-bold mt-1.5 uppercase tracking-[0.06em]"
        style={{ color: "#0f172a" }}
      >
        {HOP_LABEL[hop]}
      </div>
    </div>
  );
}

function SliceBlock({
  slice,
  step,
}: {
  slice: SliceContent;
  step: number;
}) {
  const color = HOP_KEY_COLORS[slice.forHop];
  const decrypted = isDecrypted(slice.forHop, step);
  const removed = isRemoved(slice.forHop, step);
  const token = SECRET_TOKEN[slice.forHop];

  return (
    <div
      style={{
        maxHeight: removed ? 0 : 200,
        opacity: removed ? 0 : 1,
        marginTop: removed ? 0 : 0,
        marginBottom: removed ? 0 : 0,
        overflow: "hidden",
        transition:
          "max-height 600ms ease-out, opacity 500ms ease-out, margin 400ms ease-out",
      }}
    >
      <div
        className="border-[1.5px] p-2"
        style={{
          borderColor: color,
          background: decrypted ? `${color}24` : `${color}14`,
          backgroundImage: decrypted
            ? "none"
            : `repeating-linear-gradient(${LAYER_ANGLES[slice.forHop]}deg, ${color} 0px, ${color} 2.5px, transparent 2.5px, transparent 11px)`,
          transition:
            "background-image 600ms ease-out, background 500ms ease-out",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] uppercase tracking-[0.08em] font-bold"
            style={{
              color,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}
          >
            slice for {HOP_LABEL[slice.forHop]}
          </span>
          <SecretTile color={color} token={token} size="sm" />
        </div>
        {decrypted ? (
          <div
            className="text-[10px] leading-snug"
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color: "#0f172a",
            }}
          >
            {slice.plain.map((p) => (
              <div key={p.label}>
                <span style={{ color: "#475569" }}>{p.label}:</span>{" "}
                <span style={{ fontWeight: 700 }}>{p.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="text-[10px] leading-snug"
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              color,
              opacity: 0.85,
              textShadow: `0 0 1px ${color}55`,
            }}
          >
            {slice.cipher.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SlicesRecapDiagram() {
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
    }, STEP_MS);
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

  const activeHop = activeHopAt(step);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="slices-recap"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Where chapter 4 left us: encrypted slices per hop
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 580 }}
      >
        <div className="overflow-x-auto" style={{ paddingTop: 6 }}>
          <div className="relative mx-auto" style={{ minWidth: 720, maxWidth: 800 }}>
            {/* Hop track with dashed connectors */}
            <div className="relative" style={{ height: 96 }}>
              {[0, 1, 2].map((i) => {
                const hops: HopId[] = ["alice", "bob", "charlie", "dave"];
                const a = hops[i];
                const b = hops[i + 1];
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      top: 29,
                      left: `calc(${NODE_X_PCT[a]}% + 32px)`,
                      width: `calc(${NODE_X_PCT[b] - NODE_X_PCT[a]}% - 64px)`,
                      borderTop: "1.5px dashed #475569",
                    }}
                  />
                );
              })}

              {(["alice", "bob", "charlie", "dave"] as HopId[]).map((h) => (
                <div
                  key={h}
                  className="absolute z-10"
                  style={{
                    top: 0,
                    left: `${NODE_X_PCT[h]}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <HopCircle hop={h} isActive={h === activeHop} />
                </div>
              ))}
            </div>

            {/* Secret tiles row */}
            <div className="relative mb-6" style={{ height: 110 }}>
              {/* Alice's stack of three */}
              <div
                className="absolute flex flex-col items-start gap-1.5"
                style={{
                  top: 0,
                  left: `${NODE_X_PCT.alice}%`,
                  transform: "translateX(-50%)",
                  width: 130,
                }}
              >
                <SecretTile
                  color={HOP_KEY_COLORS.bob}
                  token={SECRET_TOKEN.bob}
                  lit={isLitSecret("bob", step)}
                />
                <SecretTile
                  color={HOP_KEY_COLORS.charlie}
                  token={SECRET_TOKEN.charlie}
                  lit={isLitSecret("charlie", step)}
                />
                <SecretTile
                  color={HOP_KEY_COLORS.dave}
                  token={SECRET_TOKEN.dave}
                  lit={isLitSecret("dave", step)}
                />
              </div>

              {/* Forwarder tiles, one per node */}
              {(["bob", "charlie", "dave"] as ForwarderId[]).map((h) => (
                <div
                  key={h}
                  className="absolute flex flex-col items-center"
                  style={{
                    top: 4,
                    left: `${NODE_X_PCT[h]}%`,
                    transform: "translateX(-50%)",
                    width: 130,
                  }}
                >
                  <SecretTile
                    color={HOP_KEY_COLORS[h]}
                    token={SECRET_TOKEN[h]}
                    lit={isLitSecret(h, step)}
                  />
                </div>
              ))}
            </div>

            {/* Animated packet that slides under the active hop */}
            <div className="relative" style={{ height: 320 }}>
              <div
                className="absolute"
                style={{
                  top: 0,
                  left: `${PACKET_X_PCT[activeHop]}%`,
                  transform: "translateX(-50%)",
                  width: 320,
                  transition: "left 800ms ease-out",
                }}
              >
                <div
                  className="border-[1.5px]"
                  style={{
                    background: "#fffdf5",
                    borderColor: "#0f172a",
                  }}
                >
                  {/* Packet header showing where the packet currently is */}
                  <div
                    className="bg-black text-white px-3 py-1.5 flex items-center gap-2"
                    style={{
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: "#b8860b",
                        display: "inline-block",
                      }}
                    />
                    <span
                      className="text-[10px] uppercase tracking-[0.1em] font-bold"
                      key={activeHop}
                    >
                      payment_instructions (at {HOP_LABEL[activeHop]})
                    </span>
                  </div>

                  <div className="p-3">
                    <div className="flex flex-col gap-2">
                      {SLICES.map((s) => (
                        <SliceBlock key={s.forHop} slice={s} step={step} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Caption */}
        <div
          className="mx-auto mt-4 text-center text-sm leading-relaxed italic px-4"
          style={{ maxWidth: 700, color: "#475569", minHeight: 48 }}
        >
          {STEP_CAPTIONS[step]}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            {playing ? (
              <button
                onClick={pause}
                className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                data-testid="slices-recap-pause"
              >
                ❚❚ Pause
              </button>
            ) : (
              <button
                onClick={play}
                className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
                data-testid="slices-recap-play"
              >
                ▶ Play
              </button>
            )}
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-black bg-transparent text-black font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:text-white hover:border-[#b8860b] transition-colors"
              data-testid="slices-recap-reset"
            >
              Reset
            </button>
          </div>
          <div className="flex gap-1 items-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPlaying(false);
                  setStep(i);
                }}
                className="border-[1.5px] text-[11px] font-bold transition-colors"
                style={{
                  width: 26,
                  height: 26,
                  borderColor: i === step ? "#b8860b" : "#0f172a",
                  background: i === step ? "#b8860b" : "transparent",
                  color: i === step ? "#fffdf5" : "#0f172a",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  cursor: "pointer",
                }}
                aria-label={`Step ${i + 1}`}
                data-testid={`slices-recap-step-${i}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SlicesRecapDiagram;
