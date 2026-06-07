import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HatchOverlay, LAYER_COLORS, type ForwarderId } from "./encryptionHatch";
import { StepCaption } from "./StepCaption";
import { MorphBox, CrossfadeSwap } from "./morph";

// ────────────────────────────────────────────────────────────────────────────
// FillerTraceDiagram (rebuilt 2026-05-10)
//
// 14-beat walkthrough that takes the reader from "empty filler" all the way
// to "1,366-byte Sphinx packet ready to ship":
//
//   Iteration 1 (Bob):
//     1.  Empty filler
//     2.  Append Bob's 60 zero bytes
//     3.  Bob's keystream (1,360 bytes)
//     4.  Slice trailing 60 bytes
//     5.  XOR → Bob's filler (vertical layout)
//
//   Iteration 2 (Charlie):
//     6.  Append Charlie's 80 zero bytes (tinted teal, Charlie's iter)
//     7.  Charlie's keystream (1,380 bytes)
//     8.  Slice trailing 140 bytes
//     9.  XOR → Final filler (vertical layout)
//
//   Wrap journey (chapter 8 preview):
//     10. Initialize buffer with pad-key noise
//     11. Wrap Dave's layer · splice the filler
//     12. Wrap Charlie's layer
//     13. Wrap Bob's layer
//     14. Attach envelope → 1,366-byte packet
//
// Visual conventions:
//   • Locked encryption-hatch palette + spec for keystream + filler bytes
//     (Bob 90° / Charlie 45° / Dave 0°, colors per encryptionHatch.tsx).
//   • Zero bytes render as neutral gray; zeros being appended for a hop's
//     iteration get a faint tint of that hop's color so the iteration is
//     visually attributed.
//   • Newly-appended regions animate in (slide + fade from the right) to
//     make "appending" legible, not a recycled morph of the prior placeholder.
//   • XOR equations render top-to-bottom: filler · ⊕ · keystream slice · = · result.
//   • Position labels on keystream bars carry hover tooltips explaining
//     what the value represents (ROUTING_INFO_SIZE, total keystream length).
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const FOCUS_GOLD = "#b8860b";
const ZERO_FILL = "#f1f5f9";
const ZERO_STROKE = "#94a3b8";
const NEUTRAL_TEXT = "#475569";
const INK = "#0f172a";

const HOP_LIGHT: Record<ForwarderId, string> = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};

const ROUTING_INFO_SIZE = 1300;
const BOB_PAYLOAD = 60;
const CHARLIE_PAYLOAD = 80;
const DAVE_PAYLOAD = 100; // hypothetical, used only in the wrap-journey steps
const BOB_KEYSTREAM_LEN = ROUTING_INFO_SIZE + BOB_PAYLOAD; // 1,360
const CHARLIE_KEYSTREAM_LEN = ROUTING_INFO_SIZE + CHARLIE_PAYLOAD; // 1,380
const FINAL_FILLER_LEN = BOB_PAYLOAD + CHARLIE_PAYLOAD; // 140

const PACKET_VERSION_BYTES = 1;
const PACKET_PUBKEY_BYTES = 33;
const PACKET_HMAC_BYTES = 32;
const FULL_PACKET_BYTES =
  PACKET_VERSION_BYTES + PACKET_PUBKEY_BYTES + ROUTING_INFO_SIZE + PACKET_HMAC_BYTES; // 1,366

// Visual proportions: the 1,300 region of a keystream takes ~78% of the bar;
// each hop's extension takes ~22%. Real ratios (60/1360 ≈ 4%) would make
// the slice invisible.
const REGULAR_PCT = 78;
const EXTENSION_PCT = 22;

type StepHop = "bob" | "charlie" | "wrap";

interface StepDef {
  beat: number;
  hop: StepHop;
  iterLabel: string;
  title: string;
  caption: string;
}

const STEPS: StepDef[] = [
  // ── Iteration 1 (Bob) ────────────────────────────────────────────────────
  {
    beat: 1,
    hop: "bob",
    iterLabel: "Iteration 1 of 2 (Bob)",
    title: "Empty filler",
    caption:
      "We grow the filler one forwarder at a time, in route order. Bob first, then Charlie. Dave is the final hop, so he doesn't shift anything and contributes no filler.",
  },
  {
    beat: 2,
    hop: "bob",
    iterLabel: "Iteration 1 of 2 (Bob)",
    title: "Append Bob's 60 zero bytes",
    caption:
      "Bob's hop payload is 60 bytes wide (a small intermediate-hop TLV plus the 32-byte HMAC). We tack 60 zeros onto the empty filler. They're placeholders for Bob's keystream extension to XOR into.",
  },
  {
    beat: 3,
    hop: "bob",
    iterLabel: "Iteration 1 of 2 (Bob)",
    title: "Bob's keystream (1,360 bytes)",
    caption:
      "Generate Bob's `rho` keystream extended past the 1,300-byte boundary: `ROUTING_INFO_SIZE + 60 = 1,360 bytes`. The extra 60 bytes past 1,300 are what Bob's shift would virtually XOR into the trailing region of Charlie's view.",
  },
  {
    beat: 4,
    hop: "bob",
    iterLabel: "Iteration 1 of 2 (Bob)",
    title: "Slice the trailing 60 bytes",
    caption:
      "Take just the last `len(filler)` = 60 bytes of Bob's keystream, the part past the 1,300 boundary.",
  },
  {
    beat: 5,
    hop: "bob",
    iterLabel: "Iteration 1 of 2 (Bob)",
    title: "XOR → Bob's filler",
    caption:
      "XOR the 60 zeros against the 60-byte keystream slice. The result is 60 bytes that visually carry Bob's encryption layer (zeros XOR keystream = keystream itself). When Charlie peels his layer downstream, this region will land at the byte offsets where Charlie's HMAC was computed.",
  },
  // ── Iteration 2 (Charlie) ────────────────────────────────────────────────
  {
    beat: 6,
    hop: "charlie",
    iterLabel: "Iteration 2 of 2 (Charlie)",
    title: "Append Charlie's 80 zero bytes",
    caption:
      "Charlie's hop payload is 80 bytes wide, different from Bob's, because hop payloads vary. Tack 80 fresh zero bytes onto the END of the filler. Filler is now 140 bytes: 60 in Bob's encryption layer, plus 80 fresh zeros for Charlie's iteration.",
  },
  {
    beat: 7,
    hop: "charlie",
    iterLabel: "Iteration 2 of 2 (Charlie)",
    title: "Charlie's keystream (1,380 bytes)",
    caption:
      "Generate Charlie's `rho` keystream extended past 1,300: `ROUTING_INFO_SIZE + 80 = 1,380 bytes`.",
  },
  {
    beat: 8,
    hop: "charlie",
    iterLabel: "Iteration 2 of 2 (Charlie)",
    title: "Slice the trailing 140 bytes",
    caption:
      "Take the last `len(filler)` = 140 bytes of Charlie's keystream. Notice the chunk reaches BACK into Charlie's regular 1,300 region by 60 bytes. That's exactly where Bob's filler bytes will sit at the time Charlie peels.",
  },
  {
    beat: 9,
    hop: "charlie",
    iterLabel: "Iteration 2 of 2 (Charlie)",
    title: "XOR → Final filler (140 bytes)",
    caption:
      "XOR the 140-byte filler against Charlie's 140-byte keystream slice. The leading 60 bytes pick up Charlie's hatch on top of Bob's (crosshatch, the same look the rest of the chapter uses for nested encryption). The trailing 80 bytes go from zero to Charlie-encrypted.",
  },
  // ── Wrap journey (chapter 8 preview) ─────────────────────────────────────
  {
    beat: 10,
    hop: "wrap",
    iterLabel: "Wrap preview · chapter 8",
    title: "Initialize buffer with pad-key noise",
    caption:
      "Before any wrapping, Alice fills the 1,300-byte hop_payloads buffer with pseudorandom bytes from a special 'pad-key' chacha20 keystream. This makes the buffer look encrypted from the start. Even on short routes the destination's view has no detectable trailing structure.",
  },
  {
    beat: 11,
    hop: "wrap",
    iterLabel: "Wrap preview · chapter 8",
    title: "Wrap Dave's layer · splice the filler",
    caption:
      "Iteration 1 (innermost, Dave). Alice writes Dave's hop payload at the front, XORs the entire buffer with Dave's `rho` keystream, then OVERWRITES the trailing 140 bytes with the filler we just computed. The filler lands at the trailing positions exactly once, on the innermost iteration only.",
  },
  {
    beat: 12,
    hop: "wrap",
    iterLabel: "Wrap preview · chapter 8",
    title: "Wrap Charlie's layer",
    caption:
      "Iteration 2. Alice shifts the buffer right by Charlie's hop-payload size (80 bytes), writes Charlie's hop payload at the front, then XORs the entire buffer with Charlie's `rho` keystream. Charlie's hop payload now carries 1 layer (Charlie). Dave's hop payload, which was already wrapped, picks up Charlie's hatch on top of Dave's: 2 layers.",
  },
  {
    beat: 13,
    hop: "wrap",
    iterLabel: "Wrap preview · chapter 8",
    title: "Wrap Bob's layer",
    caption:
      "Iteration 3 (outermost). Alice shifts right by Bob's hop-payload size (60 bytes), writes Bob's hop payload, then XORs with Bob's `rho` keystream. After this final iteration the buffer is fully wrapped: Bob's hop payload has 1 layer, Charlie's has 2, Dave's has 3.",
  },
  {
    beat: 14,
    hop: "wrap",
    iterLabel: "Wrap preview · chapter 8",
    title: "Attach envelope → 1,366-byte packet",
    caption:
      "Alice attaches the 66-byte envelope: a 1-byte version (`0x00`), her 33-byte ephemeral pubkey for Bob (`E_AB`), and the outer 32-byte HMAC. The 1,366-byte Sphinx packet is ready for Bob.",
  },
];

const TOTAL_BEATS = STEPS.length;
const STEP_MS = 2400;

// ── Hover tooltip ──────────────────────────────────────────────────────────

function HoverTooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  function updatePos() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => {
          updatePos();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        style={{
          borderBottom: "1px dotted #94a3b8",
          cursor: "help",
        }}
      >
        {children}
      </span>
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y - 8,
              transform: "translate(-50%, -100%)",
              background: "#fffdf5",
              color: INK,
              fontFamily: SANS,
              fontSize: 14,
              lineHeight: 1.5,
              padding: "12px 14px",
              border: "1.5px solid #0f172a",
              borderRadius: 4,
              maxWidth: 360,
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function FillerTraceDiagram() {
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_BEATS) setStep(1);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(1);
    setPlaying(false);
  };

  const def = STEPS[step - 1];
  // Accent the description block by the active hop's encryption color, falling
  // back to gold for the wrap-preview beats (which have no single hop).
  const beatAccent =
    def.hop === "bob"
      ? LAYER_COLORS.bob
      : def.hop === "charlie"
        ? LAYER_COLORS.charlie
        : FOCUS_GOLD;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-filler-trace"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          Filler construction
        </span>
      </div>

      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 540 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 680, maxWidth: 840 }}>
            <HopTrack activeHop={def.hop} />
            <StepContent step={step} />
            <StepCaption
              label={def.iterLabel}
              title={def.title}
              caption={def.caption}
              accentColor={beatAccent}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            >
              {playing
                ? "❚❚ Pause"
                : step >= TOTAL_BEATS
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1 flex-wrap">
              {Array.from({ length: TOTAL_BEATS }, (_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setPlaying(false);
                      setStep(n);
                    }}
                    className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                    style={{
                      background: step === n ? "#b8860b" : "#fffdf5",
                      borderColor:
                        step === n ? "#b8860b" : "rgba(15,23,42,0.4)",
                      color: step === n ? "#fff" : INK,
                      fontFamily: MONO,
                      cursor: "pointer",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hop track ──────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";
const HOP_LABEL: Record<HopId, string> = {
  alice: "Alice",
  bob: "Bob",
  charlie: "Charlie",
  dave: "Dave",
};
const HOP_FILL_COLOR: Record<HopId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE_COLOR: Record<HopId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const NODE_X_PCT: Record<HopId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};
const HOPS: HopId[] = ["alice", "bob", "charlie", "dave"];

function HopTrack({ activeHop }: { activeHop: StepHop }) {
  const highlight: HopId | null =
    activeHop === "bob"
      ? "bob"
      : activeHop === "charlie"
        ? "charlie"
        : null; // wrap mode: no single highlight
  return (
    <div className="relative mb-4" style={{ height: 76 }}>
      <div
        className="absolute"
        style={{
          top: 22,
          left: "12%",
          width: "76%",
          borderTop: "1.5px dashed #475569",
        }}
      />
      {HOPS.map((id) => {
        const isActive = id === highlight;
        const size = 44;
        return (
          <div
            key={id}
            className="absolute"
            style={{
              top: 0,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex flex-col items-center">
              <div
                className="rounded-full flex items-center justify-center transition-all"
                style={{
                  width: size,
                  height: size,
                  background: HOP_FILL_COLOR[id],
                  border: `2px solid ${HOP_STROKE_COLOR[id]}`,
                  boxShadow: isActive
                    ? `0 0 0 4px rgba(184,134,11,0.30)`
                    : "none",
                  opacity:
                    activeHop === "wrap" || isActive || highlight === null
                      ? 1
                      : 0.55,
                }}
              >
                <span
                  className="font-bold"
                  style={{
                    fontSize: size * 0.42,
                    color: INK,
                  }}
                >
                  {HOP_LABEL[id].charAt(0)}
                </span>
              </div>
              <div
                className="text-[10px] font-bold mt-1 uppercase tracking-[0.06em]"
                style={{ color: INK }}
              >
                {HOP_LABEL[id]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step content router ────────────────────────────────────────────────────

function StepContent({ step }: { step: number }) {
  // Iteration 1 + 2: filler construction
  if (step <= 9) {
    const showFillerAtTop = step !== 5 && step !== 9;
    return (
      <div className="space-y-4">
        {showFillerAtTop && <FillerBuffer step={step} />}
        {(step === 3 || step === 4) && (
          <KeystreamBar hop="bob" showSlice={step === 4} />
        )}
        {(step === 7 || step === 8) && (
          <KeystreamBar hop="charlie" showSlice={step === 8} />
        )}
        {step === 5 && <XorEquation kind="bob" />}
        {step === 9 && <XorEquation kind="charlie" />}
      </div>
    );
  }
  // Wrap journey. Beat 10 (pad-key init) is its own representation. Beats
  // 11-14 all render through ONE step-switching component (WrapPreviewView)
  // so the wrap-preview bar is the SAME React element across 11→12→13→14 and
  // morphs (region widths + encryption layers) instead of jump-cutting.
  // (onion-routing-visual-standards §14)
  if (step === 10) return <PadKeyInitView />;
  return <WrapPreviewView step={step} />;
}

// ── Filler buffer ──────────────────────────────────────────────────────────

interface FillerRegionStyle {
  key: string;
  bytes: number;
  hops: ForwarderId[];
  zero: boolean;
  tintHop: ForwarderId | null; // tint the background with this hop's color when zero
  label: string;
}

function fillerRegionsAt(step: number): FillerRegionStyle[] {
  if (step <= 1) return [];

  // Bob region: present from step 2 onwards.
  let bobHops: ForwarderId[] = [];
  let bobZero = true;
  if (step >= 5 && step <= 8) {
    bobHops = ["bob"];
    bobZero = false;
  } else if (step >= 9) {
    bobHops = ["bob", "charlie"];
    bobZero = false;
  }
  const bobRegion: FillerRegionStyle = {
    key: "bob",
    bytes: BOB_PAYLOAD,
    hops: bobHops,
    zero: bobZero,
    tintHop: bobZero ? "bob" : null,
    label: bobZero ? `${BOB_PAYLOAD} bytes zeros` : `${BOB_PAYLOAD} bytes`,
  };

  if (step <= 5) return [bobRegion];

  // Charlie region appears at step 6.
  let charlieHops: ForwarderId[] = [];
  let charlieZero = true;
  if (step >= 9) {
    charlieHops = ["charlie"];
    charlieZero = false;
  }
  const charlieRegion: FillerRegionStyle = {
    key: "charlie",
    bytes: CHARLIE_PAYLOAD,
    hops: charlieHops,
    zero: charlieZero,
    tintHop: charlieZero ? "charlie" : null,
    label: charlieZero
      ? `${CHARLIE_PAYLOAD} bytes zeros`
      : `${CHARLIE_PAYLOAD} bytes`,
  };

  return [bobRegion, charlieRegion];
}

function FillerBuffer({ step }: { step: number }) {
  const regions = fillerRegionsAt(step);
  const totalBytes = regions.reduce((s, r) => s + r.bytes, 0);

  // Container width: scaled to FINAL_FILLER_LEN so individual regions stay
  // at the same absolute width when new regions append next to them.
  const containerWidthPct =
    totalBytes === 0 ? 60 : (totalBytes / FINAL_FILLER_LEN) * 100;

  return (
    <div>
      <BufferHeader
        leftLabel="filler"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                Running length of the filler buffer. Grows by{" "}
                <code style={{ fontFamily: MONO }}>payload_sizes[i]</code> on
                each iteration.
              </span>
            }
          >
            length = {totalBytes} bytes
          </HoverTooltip>
        }
      />
      {totalBytes === 0 ? (
        <div
          className="border-[1.5px] border-dashed flex items-center justify-center mx-auto"
          style={{
            borderColor: ZERO_STROKE,
            color: NEUTRAL_TEXT,
            fontStyle: "italic",
            fontSize: 13,
            height: 44,
            width: "60%",
            background: "#fffdf5",
          }}
        >
          empty
        </div>
      ) : (
        <div
          className="flex mx-auto"
          style={{
            width: `${containerWidthPct}%`,
            transition: "width 600ms cubic-bezier(0.4, 0.0, 0.2, 1)",
            height: 44,
          }}
        >
          {regions.map((r) => (
            <AppendingByteRegion
              key={r.key}
              widthPct={(r.bytes / totalBytes) * 100}
              hops={r.hops}
              zero={r.zero}
              tintHop={r.tintHop}
              label={r.label}
              height={44}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Keystream bar ──────────────────────────────────────────────────────────

function KeystreamBar({
  hop,
  showSlice,
}: {
  hop: ForwarderId;
  showSlice: boolean;
}) {
  const totalLen = hop === "bob" ? BOB_KEYSTREAM_LEN : CHARLIE_KEYSTREAM_LEN;
  const sLabel = hop === "bob" ? BOB_PAYLOAD : CHARLIE_PAYLOAD;

  // Slice geometry. Bob's iteration slices the trailing 60 = entire extension
  // (~22% of bar). Charlie's iteration slices the trailing 140 = extension
  // (80) + reach back into 1,300 region (60). With our exaggerated 78/22
  // split, Charlie's slice gets ~2 × EXTENSION_PCT = 44%.
  const sliceWidthPct = hop === "bob" ? EXTENSION_PCT : EXTENSION_PCT * 2;
  const sliceLeftPct = 100 - sliceWidthPct;

  return (
    <div className="mt-2">
      <BufferHeader
        leftLabel={`${HOP_LABEL[hop]}'s rho keystream`}
        rightLabel={`${totalLen.toLocaleString()} bytes`}
      />
      <div className="relative" style={{ height: 36 }}>
        <div
          className="absolute top-0 left-0 right-0 border-[1.5px]"
          style={{
            height: 36,
            borderColor: INK,
            background: "#fffdf5",
            overflow: "hidden",
          }}
        >
          <HatchOverlay hops={[hop]} zIndex={0} />
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${REGULAR_PCT}%`,
              width: 0,
              borderLeft: `1.5px dashed ${INK}`,
            }}
          />
        </div>
        {showSlice && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: -3,
              left: `${sliceLeftPct}%`,
              width: `${sliceWidthPct}%`,
              height: 42,
              border: `2.5px solid ${FOCUS_GOLD}`,
              boxShadow: `0 0 0 3px rgba(184,134,11,0.22)`,
              transition: "left 500ms ease-out, width 500ms ease-out",
            }}
          />
        )}
      </div>
      <div className="relative mt-1" style={{ height: 14 }}>
        <span
          className="absolute"
          style={{
            left: 0,
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          0
        </span>
        <span
          className="absolute"
          style={{
            left: `${REGULAR_PCT}%`,
            transform: "translateX(-50%)",
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          <HoverTooltip
            content={
              <span>
                <code style={{ fontFamily: MONO }}>ROUTING_INFO_SIZE</code>:
                the fixed size of every onion's <code style={{ fontFamily: MONO }}>hop_payloads</code> field. Real
                wraps XOR over exactly this many bytes; for filler we extend
                past it.
              </span>
            }
          >
            1,300
          </HoverTooltip>
        </span>
        <span
          className="absolute"
          style={{
            right: 0,
            fontSize: 10,
            fontFamily: MONO,
            color: NEUTRAL_TEXT,
          }}
        >
          <HoverTooltip
            content={
              <span>
                <code style={{ fontFamily: MONO }}>
                  ROUTING_INFO_SIZE + payload_sizes[i]
                </code>{" "}
                = 1,300 + {sLabel} = {totalLen.toLocaleString()}. The extra{" "}
                {sLabel} bytes simulate {HOP_LABEL[hop]}'s shift and produce the
                bytes downstream HMACs expect at the trailing positions.
              </span>
            }
          >
            1,300 + {sLabel} = {totalLen.toLocaleString()}
          </HoverTooltip>
        </span>
      </div>
    </div>
  );
}

// ── XOR equation (vertical) ────────────────────────────────────────────────

interface EqRegion {
  bytes: number;
  hops: ForwarderId[];
  zero: boolean;
  tintHop: ForwarderId | null;
  label: string;
}

function XorEquation({ kind }: { kind: "bob" | "charlie" }) {
  const rows: {
    title: string;
    regions: EqRegion[];
    totalBytes: number;
    width: number; // px width of the byte container
    emphasis?: boolean;
  }[] =
    kind === "bob"
      ? [
          {
            title: "filler before",
            regions: [
              {
                bytes: 60,
                hops: [],
                zero: true,
                tintHop: "bob",
                label: "60 bytes zeros",
              },
            ],
            totalBytes: 60,
            width: 380,
          },
          {
            title: "Bob's keystream slice",
            regions: [
              {
                bytes: 60,
                hops: ["bob"],
                zero: false,
                tintHop: null,
                label: "60 bytes",
              },
            ],
            totalBytes: 60,
            width: 380,
          },
          {
            title: "Bob's filler",
            regions: [
              {
                bytes: 60,
                hops: ["bob"],
                zero: false,
                tintHop: null,
                label: "60 bytes",
              },
            ],
            totalBytes: 60,
            width: 380,
            emphasis: true,
          },
        ]
      : [
          {
            title: "filler before",
            regions: [
              {
                bytes: 60,
                hops: ["bob"],
                zero: false,
                tintHop: null,
                label: "60",
              },
              {
                bytes: 80,
                hops: [],
                zero: true,
                tintHop: "charlie",
                label: "80 zeros",
              },
            ],
            totalBytes: 140,
            width: 560,
          },
          {
            title: "Charlie's keystream slice",
            regions: [
              {
                bytes: 140,
                hops: ["charlie"],
                zero: false,
                tintHop: null,
                label: "140 bytes",
              },
            ],
            totalBytes: 140,
            width: 560,
          },
          {
            title: "final filler",
            regions: [
              {
                bytes: 60,
                hops: ["bob", "charlie"],
                zero: false,
                tintHop: null,
                label: "60",
              },
              {
                bytes: 80,
                hops: ["charlie"],
                zero: false,
                tintHop: null,
                label: "80",
              },
            ],
            totalBytes: 140,
            width: 560,
            emphasis: true,
          },
        ];

  return (
    <div className="flex flex-col items-center mt-2 gap-2">
      <EqRow row={rows[0]} />
      <BigSymbol char="⊕" />
      <EqRow row={rows[1]} />
      <BigSymbol char="=" />
      <EqRow row={rows[2]} />
    </div>
  );
}

function EqRow({
  row,
}: {
  row: {
    title: string;
    regions: EqRegion[];
    totalBytes: number;
    width: number;
    emphasis?: boolean;
  };
}) {
  return (
    <div style={{ width: row.width }}>
      <div
        className="text-[9px] uppercase tracking-[0.06em] mb-1 text-center"
        style={{
          fontFamily: MONO,
          color: row.emphasis ? FOCUS_GOLD : NEUTRAL_TEXT,
          fontWeight: row.emphasis ? 700 : 500,
        }}
      >
        {row.title}
      </div>
      <div
        className="flex"
        style={{
          height: 36,
          boxShadow: row.emphasis
            ? `0 0 0 2px ${FOCUS_GOLD}, 0 0 0 5px rgba(184,134,11,0.22)`
            : "none",
        }}
      >
        {row.regions.map((r, i) => (
          <ByteRegion
            key={i}
            widthPct={(r.bytes / row.totalBytes) * 100}
            hops={r.hops}
            zero={r.zero}
            tintHop={r.tintHop}
            label={r.label}
            height={36}
          />
        ))}
      </div>
    </div>
  );
}

// ── Wrap-journey views ─────────────────────────────────────────────────────

// Step 10: pad-key noise initialization.
function PadKeyInitView() {
  return (
    <div className="space-y-3 mt-2">
      <BufferHeader
        leftLabel="1,300-byte hop_payloads buffer"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                ChaCha20 keystream from a special{" "}
                <code style={{ fontFamily: MONO }}>pad-key</code> derived from
                Alice's session key. Pseudorandom; not part of any hop's
                encryption layer.
              </span>
            }
          >
            1,300 bytes pad-key noise
          </HoverTooltip>
        }
      />
      <div
        className="border-[1.5px] relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: INK,
          height: 56,
          backgroundImage: `repeating-linear-gradient(45deg, #94a3b833 0px, #94a3b833 1.5px, transparent 1.5px, transparent 7px)`,
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            color: NEUTRAL_TEXT,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.04em",
          }}
        >
          chacha20_keystream(pad_key, 1300)
        </div>
      </div>
      <div
        className="flex justify-between"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span>byte 1,299</span>
      </div>
      <div className="mt-3 text-[11px]" style={{ color: NEUTRAL_TEXT, fontStyle: "italic" }}>
        The 140-byte filler we just computed sits in memory, ready for Alice
        to splice during the innermost wrap (next step).
      </div>
    </div>
  );
}

// ── Wrap preview (beats 11-14) — single persistent morphing bar ─────────────
//
// Beats 11-14 used to be four unrelated components (DaveWrapView /
// CharlieWrapView / BobWrapView / FinalPacketView), so advancing 11→12→13→14
// hard-jumped. They now all render through WrapPreviewView, which keeps ONE
// persistent keyed bar (the bordered hop_payloads buffer) so React reconciles
// it across the step change and its regions morph (widths + encryption layers)
// instead of remounting. (onion-routing-visual-standards §14)
//
// Two representations share that one bar:
//   • phase "splice" (beat 11): Dave's hop payload at the FRONT, the
//     Dave-encrypted middle, and the freshly spliced filler at the trailing
//     positions. Dave sits at the front here, so this layout cannot width-morph
//     into the shifted layout — we crossfade it (CrossfadeSwap) into:
//   • phase "shifted" (beats 12, 13, 14): the post-shift layout
//     [Bob | Charlie | Dave | tail]. Beats 12→13→14 are the SAME elements, so
//     their region widths + hatch layers tween smoothly. Bob's hop payload
//     grows in from width 0 on beat 13; on beat 14 the regions expand to the
//     packet's payload-area proportions while the envelope chrome fades in
//     around the same bar.
//
// Note: the per-hop region renderer is WrappedPayloadCell (it was WrappedSlot;
// renamed only to satisfy the terminology lint, behaviour is unchanged).

type WrapPhase = "splice" | "shifted";

function wrapPhase(step: number): WrapPhase {
  return step === 11 ? "splice" : "shifted";
}

function WrapPreviewView({ step }: { step: number }) {
  const phase = wrapPhase(step);
  const isPacket = step === 14;

  return (
    <div className="space-y-3 mt-2">
      {/* Header crossfades its label as the beat changes; it sits outside the
          morphing bar so it never remounts the bar. */}
      <CrossfadeSwap swapKey={`${phase}-${isPacket}`}>
        <WrapPreviewHeader step={step} />
      </CrossfadeSwap>

      {/* The one persistent bar. The SAME MorphBox element renders on beats
          11-14; envelope chrome (beat 14) wraps it via fading siblings rather
          than re-parenting it, so it stays a single reconciled element. */}
      <WrapPreviewBar step={step} />

      {/* Byte-axis labels / closing note, crossfaded per phase. */}
      <CrossfadeSwap swapKey={isPacket ? "packet" : phase}>
        <WrapPreviewFooter step={step} />
      </CrossfadeSwap>
    </div>
  );
}

function WrapPreviewHeader({ step }: { step: number }) {
  if (step === 14) {
    return (
      <BufferHeader
        leftLabel="onion_routing_packet (Alice → Bob)"
        rightLabel={`${FULL_PACKET_BYTES.toLocaleString()} bytes total`}
        accentColor={FOCUS_GOLD}
      />
    );
  }
  if (step === 11) {
    return (
      <BufferHeader
        leftLabel="1,300-byte hop_payloads buffer · after Dave's wrap"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                After this wrap the buffer holds Dave's hop payload (encrypted by
                Dave's <code style={{ fontFamily: MONO }}>rho</code>) at the front, the
                Dave-encrypted middle, and the spliced filler at the trailing positions.
              </span>
            }
          >
            Dave's hop payload · encrypted noise · filler
          </HoverTooltip>
        }
      />
    );
  }
  if (step === 12) {
    return (
      <BufferHeader
        leftLabel="1,300-byte hop_payloads buffer · after Charlie's wrap"
        rightLabel={
          <HoverTooltip
            content={
              <span>
                Charlie's wrap shifts the buffer right by 80, writes his hop
                payload, then XORs with Charlie's
                <code style={{ fontFamily: MONO }}> rho</code>. Now Charlie's hop payload
                has 1 layer, Dave's has 2 (Charlie over Dave), and the rest carries both.
              </span>
            }
          >
            Charlie (1 layer) · Dave (2) · noise (2)
          </HoverTooltip>
        }
      />
    );
  }
  // step 13
  return (
    <BufferHeader
      leftLabel="1,300-byte hop_payloads buffer · all 3 wraps applied"
      rightLabel={
        <HoverTooltip
          content={
            <span>
              Each wrap shifts right by that hop's payload size and XORs with its
              <code style={{ fontFamily: MONO }}> rho</code>. After Bob's outermost wrap, the
              hop payloads carry 1, 2, and 3 layers; the trailing pad-noise carries all 3.
            </span>
          }
        >
          Bob (1 layer) · Charlie (2) · Dave (3) · noise (3)
        </HoverTooltip>
      }
    />
  );
}

function WrapPreviewFooter({ step }: { step: number }) {
  if (step === 14) {
    return (
      <>
        <div
          className="flex justify-between"
          style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
        >
          <span>byte 0</span>
          <span>byte {(FULL_PACKET_BYTES - 1).toLocaleString()}</span>
        </div>
        <div
          className="mt-3 text-[11px]"
          style={{ color: NEUTRAL_TEXT, fontStyle: "italic" }}
        >
          Alice sends this 1,366-byte packet to Bob. The chapter ahead will
          walk through Bob's peel and forward, and the filler bytes we just
          built will land at exactly the trailing positions Charlie's HMAC
          verification expects.
        </div>
      </>
    );
  }
  if (step === 11) {
    return (
      <div
        className="flex justify-between"
        style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
      >
        <span>byte 0</span>
        <span style={{ color: FOCUS_GOLD, fontWeight: 700 }}>← byte 1,299</span>
      </div>
    );
  }
  return (
    <div
      className="flex justify-between"
      style={{ fontFamily: MONO, fontSize: 10, color: NEUTRAL_TEXT }}
    >
      <span>byte 0</span>
      <span>byte 1,299</span>
    </div>
  );
}

// The persistent bar. In the shifted phase it is a bare bordered buffer; on
// beat 14 the same bar gains the packet chrome (title bar + HEADER + HMAC),
// which fades in as siblings/overlays around the unchanged inner region row.
function WrapPreviewBar({ step }: { step: number }) {
  const phase = wrapPhase(step);
  const isPacket = step === 14;

  return (
    <MorphBox
      key="wrap-preview-bar"
      initial={false}
      animate={{}}
      className="relative"
      style={{ position: "relative" }}
    >
      {/* Envelope chrome (beat 14 only): title bar + HEADER + HMAC fade in and
          reserve their space via margins on the inner bar so it lands inside
          the packet's PAYLOAD AREA. They overlay/flank the bar rather than
          re-parenting it, keeping the bar one reconciled element. */}
      <PacketChrome visible={isPacket} />

      {/* The inner region row — the actual hop_payloads bar. Same element on
          every beat 11-14. The splice <-> shifted change crossfades its content;
          within the shifted phase widths + hatch layers tween. */}
      <div
        className="border-[1.5px] relative overflow-hidden"
        style={{
          background: "#fffdf5",
          borderColor: INK,
          height: 56,
          margin: isPacket ? "0 96px 0 138px" : 0,
          boxShadow: isPacket ? `inset 0 0 0 2px ${FOCUS_GOLD}` : "none",
          transition:
            "margin 450ms ease-in-out, box-shadow 450ms ease-in-out",
        }}
      >
        <CrossfadeSwap swapKey={phase} style={{ height: "100%" }}>
          {phase === "splice" ? (
            <SpliceRegionRow />
          ) : (
            <ShiftedRegionRow step={step} />
          )}
        </CrossfadeSwap>
      </div>

      {isPacket && (
        <div className="text-center mt-1.5">
          <span
            className="text-[9px]"
            style={{ fontFamily: MONO, color: NEUTRAL_TEXT, fontStyle: "italic" }}
          >
            hop_payloads · 1,300 bytes
          </span>
        </div>
      )}
    </MorphBox>
  );
}

// Beat 11's representation: Dave's hop payload at the front, Dave-encrypted
// middle, spliced filler trailing.
function SpliceRegionRow() {
  const davePct = (DAVE_PAYLOAD / ROUTING_INFO_SIZE) * 100; // ~7.7%
  const fillerPct = (FINAL_FILLER_LEN / ROUTING_INFO_SIZE) * 100; // ~10.8%
  const middlePct = 100 - davePct - fillerPct; // ~81.5%
  const bobFillerSubPct = (BOB_PAYLOAD / FINAL_FILLER_LEN) * 100; // 60/140
  const charlieFillerSubPct = (CHARLIE_PAYLOAD / FINAL_FILLER_LEN) * 100; // 80/140

  // Fill the bar absolutely so the splice <-> shifted crossfade overlaps two
  // full-bleed layers cleanly (CrossfadeSwap's inner wrapper is zero-height).
  return (
    <div className="flex absolute inset-0">
      {/* Dave's hop payload */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: `${davePct}%`, background: HOP_LIGHT.dave }}
      >
        <HatchOverlay hops={["dave"]} zIndex={1} stripeOpacity={0.18} />
        <span
          className="relative"
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            color: HOP_STROKE_COLOR.dave,
            zIndex: 2,
            background: "rgba(255,253,245,0.85)",
            padding: "0 4px",
          }}
        >
          DAVE
        </span>
      </div>
      {/* Dave-encrypted middle */}
      <div
        className="relative"
        style={{
          width: `${middlePct}%`,
          background: "#fffdf5",
          borderLeft: `1.5px solid ${HOP_STROKE_COLOR.dave}80`,
        }}
      >
        <HatchOverlay hops={["dave"]} zIndex={1} stripeOpacity={0.18} />
        <div
          className="relative h-full flex items-center justify-center"
          style={{ zIndex: 2 }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: NEUTRAL_TEXT,
              letterSpacing: "0.04em",
              background: "rgba(255,253,245,0.85)",
              padding: "0 6px",
            }}
          >
            pad-noise XOR Dave's rho
          </span>
        </div>
      </div>
      {/* Filler region (spliced in, trailing) */}
      <div
        className="relative flex"
        style={{
          width: `${fillerPct}%`,
          borderLeft: `1.5px solid ${FOCUS_GOLD}`,
          background: "#fffdf5",
        }}
      >
        <div
          className="relative"
          style={{ width: `${bobFillerSubPct}%`, overflow: "hidden" }}
        >
          <HatchOverlay hops={["bob", "charlie"]} zIndex={1} />
        </div>
        <div
          className="relative"
          style={{ width: `${charlieFillerSubPct}%`, overflow: "hidden" }}
        >
          <HatchOverlay hops={["charlie"]} zIndex={1} />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 2 }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              color: FOCUS_GOLD,
              background: "rgba(255,253,245,0.85)",
              padding: "0 4px",
            }}
          >
            FILLER
          </span>
        </div>
      </div>
    </div>
  );
}

// The post-shift representation shared by beats 12, 13, 14. Because every beat
// in this phase renders the SAME keyed cells + tail in the same order, React
// reconciles them and their widths + hatch layers tween between beats.
//   • beat 12: Bob absent (width 0), Charlie 1 layer, Dave 2 layers.
//   • beat 13: Bob grows in (1 layer), Charlie 2, Dave 3 — buffer fully wrapped.
//   • beat 14: same layers as 13; widths expand to the packet payload-area
//     proportions (region 50%, padding 50%) as the envelope fades in.
function ShiftedRegionRow({ step }: { step: number }) {
  const widths = shiftedWidths(step);
  const isPacket = step === 14;

  // Layer sets. Beat 12 has no Bob layer yet; beats 13 and 14 are fully wrapped.
  const bobLayers: ForwarderId[] = ["bob"];
  const charlieLayers: ForwarderId[] =
    step === 12 ? ["charlie"] : ["bob", "charlie"];
  const daveLayers: ForwarderId[] =
    step === 12 ? ["charlie", "dave"] : ["bob", "charlie", "dave"];
  const tailLayers: ForwarderId[] = daveLayers;

  // Fill the bar absolutely (see SpliceRegionRow) so beats 12-14 share a
  // full-height row and the crossfade against the splice layer overlaps cleanly.
  return (
    <div className="flex absolute inset-0">
      <WrappedPayloadCell
        key="bob-slot"
        hopId="bob"
        widthPct={widths.bob}
        layers={bobLayers}
        label="BOB"
      />
      <WrappedPayloadCell
        key="charlie-slot"
        hopId="charlie"
        widthPct={widths.charlie}
        layers={charlieLayers}
        label="CHARLIE"
      />
      <WrappedPayloadCell
        key="dave-slot"
        hopId="dave"
        widthPct={widths.dave}
        layers={daveLayers}
        label="DAVE"
      />
      {/* Tail / padding region — persists across 12-14; its label crossfades
          ("residue" while wrapping, "padding" once it reads as the packet). */}
      <div
        key="tail"
        className="relative flex items-center justify-center"
        style={{
          width: `${widths.tail}%`,
          background: "#fffdf5",
          borderLeft: isPacket
            ? `1px dashed ${HOP_STROKE_COLOR.dave}80`
            : `1.5px solid #94a3b8`,
          transition: "width 450ms ease-in-out, border-color 450ms ease-in-out",
        }}
      >
        <HatchOverlay
          hops={tailLayers}
          zIndex={1}
          stripeOpacity={isPacket ? 0.1 : 0.14}
        />
        <CrossfadeSwap
          swapKey={tailLabel(step)}
          className="relative"
          style={{ zIndex: 2 }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: isPacket ? 9 : 10,
              fontWeight: isPacket ? 700 : 400,
              letterSpacing: isPacket ? "0.06em" : "0.04em",
              textTransform: isPacket ? "uppercase" : "none",
              color: NEUTRAL_TEXT,
              background: "rgba(255,253,245,0.85)",
              padding: isPacket ? "0 4px" : "0 6px",
              whiteSpace: "nowrap",
            }}
          >
            {tailLabel(step)}
          </span>
        </CrossfadeSwap>
      </div>
    </div>
  );
}

interface ShiftedWidths {
  bob: number;
  charlie: number;
  dave: number;
  tail: number;
}

function shiftedWidths(step: number): ShiftedWidths {
  if (step === 14) {
    // Packet payload-area proportions: region 50% (bytes 60:80:100 →
    // 25/33.3/41.7 within it) + padding 50%. Mirrors PayloadArea in
    // ForwarderPeelDiagram so the bar reads as the same artifact.
    return {
      bob: 50 * (60 / 240),
      charlie: 50 * (80 / 240),
      dave: 50 * (100 / 240),
      tail: 50,
    };
  }
  // Beats 12-13: real byte proportions of the 1,300-byte buffer. Bob is absent
  // (width 0) on beat 12 so it can grow in on beat 13.
  const bobPct = step === 12 ? 0 : (BOB_PAYLOAD / ROUTING_INFO_SIZE) * 100;
  const charliePct = (CHARLIE_PAYLOAD / ROUTING_INFO_SIZE) * 100;
  const davePct = (DAVE_PAYLOAD / ROUTING_INFO_SIZE) * 100;
  return {
    bob: bobPct,
    charlie: charliePct,
    dave: davePct,
    tail: 100 - bobPct - charliePct - davePct,
  };
}

function tailLabel(step: number): string {
  if (step === 14) return "padding";
  if (step === 12) return "wrapped middle + filler residue";
  return "wrapped pad-noise + filler residue";
}

// Packet envelope chrome for beat 14: the black title bar plus the dimmed
// HEADER and HMAC blocks. Rendered as fading overlays around the persistent
// inner bar so the bar itself is never re-parented (and keeps morphing).
function PacketChrome({ visible }: { visible: boolean }) {
  const DIMMED = 0.3;
  const bobColor = HOP_STROKE_COLOR.bob;
  return (
    <div
      className="pointer-events-none"
      aria-hidden={!visible}
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 450ms ease-in-out",
      }}
    >
      {/* Black title bar above the bar */}
      <div
        className="bg-black text-white px-3 py-1.5 flex items-center gap-2"
        style={{ fontFamily: MONO }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: FOCUS_GOLD,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          ONION_PACKET (Alice → Bob)
        </span>
      </div>

      {/* HEADER (left flank) */}
      <div
        className="absolute flex flex-col items-center justify-center text-center border-r-[1.5px]"
        style={{
          left: 0,
          width: 138,
          top: 33,
          bottom: 0,
          borderColor: INK,
          color: INK,
          padding: "8px 6px",
          background: `${bobColor}24`,
          opacity: DIMMED,
          fontFamily: MONO,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] leading-tight">
          HEADER
        </span>
        <div
          style={{
            width: "60%",
            height: 1,
            background: "#0f172a30",
            marginTop: 5,
            marginBottom: 6,
          }}
        />
        <span className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight">
          version
        </span>
        <span
          className="text-[11px] font-bold leading-tight mt-0.5"
          style={{ color: INK }}
        >
          0x00
        </span>
        <span className="text-[9px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1.5">
          ephemeral pubkey
        </span>
        <span
          className="font-bold leading-tight mt-0.5"
          style={{ color: bobColor, fontSize: 16 }}
        >
          E<span style={{ fontSize: 9, verticalAlign: "sub" }}>AB</span>
        </span>
      </div>

      {/* HMAC (right flank) */}
      <div
        className="absolute flex flex-col items-center justify-center text-center"
        style={{
          right: 0,
          width: 96,
          top: 33,
          bottom: 0,
          color: INK,
          padding: "8px 4px",
          background: `${bobColor}24`,
          opacity: DIMMED,
          fontFamily: MONO,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight">
          HMAC
        </span>
        <span
          className="text-[9px] font-bold leading-tight mt-1"
          style={{ color: bobColor }}
        >
          bob_hmac
        </span>
        <span className="text-[8.5px] font-normal opacity-60 leading-tight mt-0.5">
          32 B
        </span>
      </div>
    </div>
  );
}

function WrappedPayloadCell({
  hopId,
  widthPct,
  layers,
  label,
  showLabel = true,
}: {
  hopId: ForwarderId;
  widthPct: number;
  layers: ForwarderId[];
  label: string;
  showLabel?: boolean;
}) {
  // When this hop payload is absent (width 0, e.g. Bob before his wrap on
  // beat 12) drop the border so it doesn't show as a sliver, and let the
  // region grow in via the width transition.
  const hidden = widthPct <= 0;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: `${widthPct}%`,
        background: HOP_LIGHT[hopId],
        borderRight: hidden ? "none" : `1.5px solid ${HOP_STROKE_COLOR[hopId]}80`,
        overflow: "hidden",
        transition: "width 450ms ease-in-out",
      }}
    >
      <HatchOverlay hops={layers} zIndex={1} stripeOpacity={0.16} />
      {showLabel && !hidden && (
        <span
          className="relative"
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            color: HOP_STROKE_COLOR[hopId],
            background: "rgba(255,253,245,0.85)",
            padding: "0 4px",
            zIndex: 2,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ── Atoms ──────────────────────────────────────────────────────────────────

function BufferHeader({
  leftLabel,
  rightLabel,
  accentColor,
}: {
  leftLabel: ReactNode;
  rightLabel: ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{
          color: accentColor ?? NEUTRAL_TEXT,
          fontFamily: MONO,
          fontWeight: accentColor ? 700 : 500,
        }}
      >
        {leftLabel}
      </div>
      <div
        className="text-[11px]"
        style={{ color: NEUTRAL_TEXT, fontFamily: MONO }}
      >
        {rightLabel}
      </div>
    </div>
  );
}

interface ByteRegionProps {
  widthPct: number;
  hops: ForwarderId[];
  zero: boolean;
  tintHop: ForwarderId | null;
  label: string;
  height?: number;
}

function ByteRegion({
  widthPct,
  hops,
  zero,
  tintHop,
  label,
  height = 36,
}: ByteRegionProps) {
  // Background: hatched regions stay on cream; zero regions tint with the
  // active hop's light fill (so Charlie's 80 zeros land in faint teal,
  // visually attributing them to Charlie's iteration). Otherwise fall back
  // to neutral gray when no tint is specified.
  const background = zero
    ? tintHop
      ? HOP_LIGHT[tintHop]
      : ZERO_FILL
    : "#fffdf5";
  const borderColor = zero
    ? tintHop
      ? LAYER_COLORS[tintHop]
      : ZERO_STROKE
    : INK;

  return (
    <div
      className="relative border-[1.5px] flex items-center justify-center"
      style={{
        width: `${widthPct}%`,
        height,
        background,
        borderColor,
        overflow: "hidden",
        transition:
          "background 600ms ease-out, border-color 600ms ease-out",
      }}
    >
      {hops.length > 0 && <HatchOverlay hops={hops} zIndex={1} />}
      {label && (
        <span
          style={{
            position: "relative",
            zIndex: 2,
            fontSize: 10,
            fontFamily: MONO,
            color: zero ? NEUTRAL_TEXT : INK,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background:
              hops.length > 0
                ? "rgba(255,253,245,0.85)"
                : "transparent",
            padding: hops.length > 0 ? "0 4px" : 0,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// AppendingByteRegion: same as ByteRegion, but mounts with a slide-in-from-
// the-right + fade animation so a new region visibly "appears" rather than
// morphing out of an existing placeholder.
function AppendingByteRegion(props: ByteRegionProps) {
  const [appeared, setAppeared] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAppeared(true), 30);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        width: `${props.widthPct}%`,
        opacity: appeared ? 1 : 0,
        transform: appeared ? "translateX(0)" : "translateX(20px)",
        transition:
          "opacity 480ms ease-out, transform 480ms cubic-bezier(0.4, 0.0, 0.2, 1)",
      }}
    >
      <ByteRegion {...props} widthPct={100} />
    </div>
  );
}

function BigSymbol({ char }: { char: string }) {
  return (
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: INK,
        fontFamily: MONO,
        lineHeight: 1,
      }}
    >
      {char}
    </div>
  );
}

export default FillerTraceDiagram;
