import { useEffect, useRef, useState, type ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// BlindingFactorDiagram (DRAFT)
//
// Walks the Sphinx ephemeral key chain hop by hop, in dependency order. Cells
// reveal Bob row 1 → 2 → 3 → 4, then Charlie 1 → 2 → 3 → 4, then Dave 1 →
// 2 → 3. Cross-hop dependencies render in the source hop's color.
//
// Every token in every formula and every caption is hoverable. Hovering
// pops a viewport-clamped tooltip explaining what the token represents
// (e.g., e_AB, sessionkey, G, B, SHA256, ‖). Step labels are also
// hoverable. Captions use code styling for token references.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const CREAM_STAGE = "#fefdfb";
const CREAM_CARD = "#fffdf5";
const GOLD = "#b8860b";
const GOLD_FILL = "#fef3c7";
const MONO = '"JetBrains Mono", "Fira Code", monospace';

type HopKey = "bob" | "charlie" | "dave";

const HOP_COLORS: Record<HopKey, { stroke: string; fill: string; soft: string }> = {
  bob: { stroke: "#3b6aa0", fill: "#dbeafe", soft: "#eff6ff" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8", soft: "#ecfdf5" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3", soft: "#faf5ff" },
};

// ── HoverTip with viewport-clamped fixed positioning ───────────────────────

const TIP_WIDTH = 260;

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
    const fitsAbove = aboveY > 100;
    const y = fitsAbove ? aboveY : r.bottom + 10;
    setPos({ x, y, above: fitsAbove });
    setShown(true);
  }

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setShown(false)}
      style={{ position: "relative", display: "inline-block" }}
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
            background: INK,
            color: "#fffdf5",
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

// ── Token catalog ───────────────────────────────────────────────────────────

const TOKEN_INFO: Record<string, string> = {
  sessionkey:
    "Alice's 32-byte random session key. Generated fresh per payment. The starting seed for the entire ephemeral key chain.",
  e_AB:
    "Alice's ephemeral private key for the Bob hop. For the first hop, this equals the session key directly.",
  E_AB:
    "Bob's ephemeral public key, derived as e_AB · G. This is the only ephemeral pubkey that ever travels in the packet header.",
  ss_AB:
    "Shared secret between Alice and Bob. Both sides derive the same 32-byte value via ECDH.",
  bf_AB:
    "Bob's blinding factor. Charlie will use this to derive his own session-key-equivalent.",
  B: "Bob's published Lightning node public key, known from gossip.",
  e_AC:
    "Alice's ephemeral private key for the Charlie hop. Derived as bf_AB · e_AB.",
  E_AC: "Charlie's ephemeral public key, derived as e_AC · G.",
  ss_AC: "Shared secret between Alice and Charlie. Same ECDH trick as Bob's.",
  bf_AC:
    "Charlie's blinding factor. Dave will use this to derive his own session-key-equivalent.",
  C: "Charlie's published Lightning node public key, known from gossip.",
  e_AD:
    "Alice's ephemeral private key for the Dave hop. Derived as bf_AC · e_AC.",
  E_AD: "Dave's ephemeral public key, derived as e_AD · G.",
  ss_AD:
    "Shared secret between Alice and Dave. The chain ends here since there is no successor hop.",
  D: "Dave's published Lightning node public key, known from gossip.",
  G: "The elliptic curve generator point. A fixed, public point on secp256k1 known to everyone.",
  SHA256:
    "Cryptographic hash function. Takes input bytes and produces a 32-byte deterministic output. Anyone with the same inputs gets the same output.",
  "·":
    "Scalar multiplication on the elliptic curve. Multiplying a private number by G produces a public point.",
  "‖":
    "Concatenation. Joins the bytes of E with the bytes of ss to feed into SHA256.",
};

// ── Token (mono + hoverable) ────────────────────────────────────────────────

function Tok({
  token,
  color,
  display,
}: {
  token: string;
  color?: string;
  display?: string;
}) {
  const info = TOKEN_INFO[token];
  const text = display ?? token;
  const styled = (
    <span
      style={{
        fontFamily: MONO,
        color: color ?? INK,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
  if (!info) return styled;
  return <HoverTip info={info}>{styled}</HoverTip>;
}

// Code-styled inline token for use inside captions. Same as Tok visually
// but slightly smaller font to read inline in prose.
function Code({
  token,
  color,
}: {
  token: string;
  color?: string;
}) {
  const info = TOKEN_INFO[token];
  const styled = (
    <span
      style={{
        fontFamily: MONO,
        color: color ?? INK,
        fontWeight: 700,
        background: "rgba(15,23,42,0.06)",
        padding: "1px 5px",
        fontSize: "0.92em",
      }}
    >
      {token}
    </span>
  );
  if (!info) return styled;
  return <HoverTip info={info}>{styled}</HoverTip>;
}

// ── Cell formulas ───────────────────────────────────────────────────────────

interface CellSpec {
  formula: ReactNode;
  caption: ReactNode;
}

const ROW_LABELS = [
  "Generate session key",
  "Compute ephemeral public key",
  "Compute shared secret",
  "Compute blinding factor",
];

const ROW_TOOLTIPS = [
  "Each hop's session-key-equivalent. For Bob it's the random session key directly. For Charlie and Dave, it's derived from the previous hop's blinding factor.",
  "Multiply the session-key-equivalent by G to get the ephemeral public key. Only Bob's E_AB ever travels in the packet; Charlie's and Dave's are computed on the fly.",
  "Run ECDH between Alice's ephemeral private key and the hop's published node pubkey, then hash. Both Alice and the hop arrive at the same shared secret.",
  "Hash the ephemeral pubkey with the shared secret. The next hop uses this to derive its own session-key-equivalent. Dave doesn't compute one (no successor).",
];

function buildCells(): Array<Array<CellSpec | null>> {
  const BOB = HOP_COLORS.bob.stroke;
  const CHARLIE = HOP_COLORS.charlie.stroke;
  const bob: CellSpec[] = [
    {
      formula: (
        <>
          <Tok token="e_AB" /> = <Tok token="sessionkey" />
        </>
      ),
      caption: (
        <>
          Bob: Alice generates a random 32-byte <Code token="sessionkey" />.
          This is the seed that the rest of the chain unfolds from.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AB" /> = <Tok token="e_AB" /> <Tok token="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          Bob: multiply <Code token="e_AB" /> by the curve generator{" "}
          <Code token="G" /> to get Bob's ephemeral public key{" "}
          <Code token="E_AB" />. This is the only ephemeral pubkey that ever
          travels in the packet.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AB" /> = <Tok token="SHA256" />(<Tok token="e_AB" />{" "}
          <Tok token="·" /> <Tok token="B" />)
        </>
      ),
      caption: (
        <>
          Bob: ECDH between <Code token="e_AB" /> and Bob's node pubkey{" "}
          <Code token="B" />. Only Alice and Bob can derive this shared secret{" "}
          <Code token="ss_AB" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="bf_AB" /> = <Tok token="SHA256" />(<Tok token="E_AB" />{" "}
          <Tok token="‖" /> <Tok token="ss_AB" />)
        </>
      ),
      caption: (
        <>
          Bob: hash <Code token="E_AB" /> with <Code token="ss_AB" /> to
          produce a blinding factor <Code token="bf_AB" />. Charlie will need
          this to derive his own session-key-equivalent.
        </>
      ),
    },
  ];
  const charlie: CellSpec[] = [
    {
      formula: (
        <>
          <Tok token="e_AC" /> = <Tok token="bf_AB" color={BOB} />{" "}
          <Tok token="·" /> <Tok token="e_AB" color={BOB} />
        </>
      ),
      caption: (
        <>
          Charlie: multiply <Code token="bf_AB" color={BOB} /> by{" "}
          <Code token="e_AB" color={BOB} /> to derive Charlie's
          session-key-equivalent <Code token="e_AC" />. The blue tokens are
          values that came from Bob's column.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AC" /> = <Tok token="e_AC" /> <Tok token="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          Charlie: multiply <Code token="e_AC" /> by <Code token="G" /> to get
          Charlie's ephemeral public key <Code token="E_AC" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AC" /> = <Tok token="SHA256" />(<Tok token="e_AC" />{" "}
          <Tok token="·" /> <Tok token="C" />)
        </>
      ),
      caption: (
        <>
          Charlie: ECDH between <Code token="e_AC" /> and Charlie's node pubkey{" "}
          <Code token="C" /> produces the shared secret <Code token="ss_AC" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="bf_AC" /> = <Tok token="SHA256" />(<Tok token="E_AC" />{" "}
          <Tok token="‖" /> <Tok token="ss_AC" />)
        </>
      ),
      caption: (
        <>
          Charlie: hash <Code token="E_AC" /> with <Code token="ss_AC" /> to
          produce a blinding factor <Code token="bf_AC" /> for Dave's column.
        </>
      ),
    },
  ];
  const dave: Array<CellSpec | null> = [
    {
      formula: (
        <>
          <Tok token="e_AD" /> = <Tok token="bf_AC" color={CHARLIE} />{" "}
          <Tok token="·" /> <Tok token="e_AC" color={CHARLIE} />
        </>
      ),
      caption: (
        <>
          Dave: multiply <Code token="bf_AC" color={CHARLIE} /> by{" "}
          <Code token="e_AC" color={CHARLIE} /> to derive Dave's
          session-key-equivalent <Code token="e_AD" />. Teal tokens came from
          Charlie's column.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AD" /> = <Tok token="e_AD" /> <Tok token="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          Dave: multiply <Code token="e_AD" /> by <Code token="G" /> to get
          Dave's ephemeral public key <Code token="E_AD" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AD" /> = <Tok token="SHA256" />(<Tok token="e_AD" />{" "}
          <Tok token="·" /> <Tok token="D" />)
        </>
      ),
      caption: (
        <>
          Dave: ECDH between <Code token="e_AD" /> and Dave's node pubkey{" "}
          <Code token="D" /> produces <Code token="ss_AD" />. The chain ends
          here, no blinding factor needed.
        </>
      ),
    },
    null,
  ];
  return [0, 1, 2, 3].map((r) => [bob[r], charlie[r], dave[r]]);
}

const CELLS = buildCells();

const TOTAL_SUB_STEPS = 11;

function cellIndex(row: number, col: number): number {
  if (col === 0) return row + 1;
  if (col === 1) return 4 + row + 1;
  if (col === 2) return 8 + row + 1;
  return 0;
}

const MILESTONES = [
  { idx: 0, label: "Reset" },
  { idx: 4, label: "Bob" },
  { idx: 8, label: "Charlie" },
  { idx: 11, label: "Dave" },
];

const HOP_INFO: Record<HopKey, string> = {
  bob: "Bob, the first forwarder on Alice's route. The session key directly seeds his column.",
  charlie:
    "Charlie, the second forwarder. His column starts from Bob's blinding factor, not the session key.",
  dave: "Dave, the final hop (the receiver). His column starts from Charlie's blinding factor and skips step 4 (no successor).",
};

const INTRO_CAPTION: ReactNode = (
  <>
    Click step 1 to walk Bob's column. Each hop's chain depends on the previous
    hop finishing first, so cells reveal in dependency order: Bob fully, then
    Charlie, then Dave. Hover any token in the formulas or captions for an
    explanation.
  </>
);

function HopHeader({
  name,
  hopKey,
  reached,
}: {
  name: string;
  hopKey: HopKey;
  reached: boolean;
}) {
  const c = HOP_COLORS[hopKey];
  return (
    <div className="flex flex-col items-center gap-1">
      <HoverTip info={HOP_INFO[hopKey]}>
        <div
          className="rounded-full flex items-center justify-center transition-all duration-500"
          style={{
            width: 42,
            height: 42,
            background: c.fill,
            border: `2px solid ${c.stroke}`,
            color: INK,
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            boxShadow: reached ? `0 0 0 3px ${c.soft}` : "none",
          }}
        >
          {name.charAt(0)}
        </div>
      </HoverTip>
      <div
        className="text-[11px] font-bold tracking-[0.05em]"
        style={{ color: c.stroke }}
      >
        {name}
      </div>
    </div>
  );
}

function CellTile({
  cell,
  hopKey,
  visible,
  pulse,
  isLatest,
}: {
  cell: CellSpec | null;
  hopKey: HopKey;
  visible: boolean;
  pulse: boolean;
  isLatest: boolean;
}) {
  const c = HOP_COLORS[hopKey];
  if (!cell) {
    return (
      <div
        className="border-[1.5px] border-dashed flex items-center justify-center"
        style={{
          background: CREAM_CARD,
          borderColor: SLATE,
          opacity: visible ? 0.6 : 0,
          transition: "opacity 350ms ease-out",
          minHeight: 44,
          padding: "8px 10px",
        }}
      >
        <span
          className="text-[10px] italic text-center"
          style={{ color: SLATE }}
        >
          (final hop, no successor)
        </span>
      </div>
    );
  }
  return (
    <div
      className="px-2.5 py-2 flex items-center justify-center"
      style={{
        background: visible ? c.fill : c.soft,
        border: `1.5px solid ${isLatest ? GOLD : c.stroke}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        boxShadow: pulse
          ? `0 0 0 4px rgba(184, 134, 11, 0.32)`
          : isLatest
            ? `0 0 0 2px rgba(184, 134, 11, 0.18)`
            : "0 0 0 0 transparent",
        transition:
          "opacity 400ms ease-out, transform 400ms ease-out, border-color 350ms ease-out, box-shadow 500ms ease-out, background 350ms ease-out",
        minHeight: 44,
        textAlign: "center",
      }}
    >
      {cell.formula}
    </div>
  );
}

export function BlindingFactorDiagram() {
  const [subStep, setSubStep] = useState(0);
  const [targetSubStep, setTargetSubStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pulseCellIdx, setPulseCellIdx] = useState<number | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (subStep >= targetSubStep) return;
    stepTimerRef.current = setTimeout(() => {
      setSubStep((s) => {
        const next = s + 1;
        if (next === 5) setPulseCellIdx(4);
        else if (next === 9) setPulseCellIdx(8);
        else setPulseCellIdx(null);
        return next;
      });
    }, 650);
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [subStep, targetSubStep]);

  useEffect(() => {
    if (pulseCellIdx === null) return;
    const t = setTimeout(() => setPulseCellIdx(null), 800);
    return () => clearTimeout(t);
  }, [pulseCellIdx]);

  // When playing, auto-advance the target all the way through.
  useEffect(() => {
    if (!playing) return;
    if (subStep >= TOTAL_SUB_STEPS) {
      setPlaying(false);
      return;
    }
    if (targetSubStep < TOTAL_SUB_STEPS) {
      setTargetSubStep(TOTAL_SUB_STEPS);
    }
  }, [playing, subStep, targetSubStep]);

  function setMilestone(idx: number) {
    setPlaying(false);
    if (idx < subStep) {
      setSubStep(idx);
      setTargetSubStep(idx);
      setPulseCellIdx(null);
      return;
    }
    setTargetSubStep(idx);
  }

  function play() {
    if (subStep >= TOTAL_SUB_STEPS) {
      setSubStep(0);
      setTargetSubStep(0);
    }
    setPlaying(true);
  }
  function pause() {
    setPlaying(false);
  }
  function reset() {
    setPlaying(false);
    setSubStep(0);
    setTargetSubStep(0);
    setPulseCellIdx(null);
  }


  let caption: ReactNode = INTRO_CAPTION;
  if (subStep > 0) {
    let found: CellSpec | null = null;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if (cellIndex(r, c) === subStep) {
          found = CELLS[r][c];
          break;
        }
      }
      if (found) break;
    }
    if (found) caption = found.caption;
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="blinding-factor-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Building the ephemeral key chain
          </span>
        </div>
      </div>

      <div className="px-4 py-5" style={{ background: CREAM_STAGE }}>
        {/* Hop circles */}
        <div
          className="grid items-center mb-4"
          style={{ gridTemplateColumns: "1fr 1fr 1fr", columnGap: 12 }}
        >
          <div className="flex justify-center">
            <HopHeader name="Bob" hopKey="bob" reached={subStep >= 1} />
          </div>
          <div className="flex justify-center">
            <HopHeader name="Charlie" hopKey="charlie" reached={subStep >= 5} />
          </div>
          <div className="flex justify-center">
            <HopHeader name="Dave" hopKey="dave" reached={subStep >= 9} />
          </div>
        </div>

        {CELLS.map((rowCells, rowIdx) => {
          const stepNum = rowIdx + 1;
          const rowReached =
            subStep >= cellIndex(rowIdx, 0) ||
            subStep >= cellIndex(rowIdx, 1) ||
            subStep >= cellIndex(rowIdx, 2);
          return (
            <div key={rowIdx} className="mb-3">
              <div
                className="flex items-center gap-2 mb-1.5"
                style={{
                  opacity: rowReached ? 1 : 0.45,
                  transition: "opacity 350ms ease-out",
                }}
              >
                <div
                  className="inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.06em]"
                  style={{
                    width: 20,
                    height: 20,
                    background: rowReached ? GOLD : CREAM_CARD,
                    color: rowReached ? "#fffdf5" : INK,
                    border: `1.5px solid ${rowReached ? GOLD : INK}`,
                    flexShrink: 0,
                  }}
                >
                  {stepNum}
                </div>
                <HoverTip info={ROW_TOOLTIPS[rowIdx]}>
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.05em]"
                    style={{
                      color: rowReached ? GOLD : SLATE,
                    }}
                  >
                    {ROW_LABELS[rowIdx]}
                  </span>
                </HoverTip>
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 1fr 1fr",
                  columnGap: 12,
                }}
              >
                {(["bob", "charlie", "dave"] as HopKey[]).map((hop, colIdx) => {
                  const idx = cellIndex(rowIdx, colIdx);
                  const visible = subStep >= idx;
                  const isLatest = subStep === idx;
                  const pulse = pulseCellIdx === idx;
                  return (
                    <CellTile
                      key={hop}
                      cell={rowCells[colIdx]}
                      hopKey={hop}
                      visible={visible}
                      pulse={pulse}
                      isLatest={isLatest}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col gap-3">
          {/* Controls row */}
          <div className="flex gap-1.5 items-center flex-wrap">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="blinding-factor-diagram-play"
            >
              {playing
                ? "❚❚ Pause"
                : subStep >= TOTAL_SUB_STEPS
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            {/* 11 sub-step buttons, grouped visually by hop with a small gap
                between groups (Bob 1-4, Charlie 5-8, Dave 9-11). */}
            <div className="ml-1 flex items-center gap-1 flex-wrap">
              {Array.from({ length: TOTAL_SUB_STEPS }).map((_, i) => {
                const targetIdx = i + 1;
                const reached = subStep >= targetIdx;
                const current = subStep === targetIdx;
                const groupBreak = targetIdx === 5 || targetIdx === 9;
                return (
                  <button
                    key={i}
                    onClick={() => setMilestone(targetIdx)}
                    className="w-6 h-6 border-[1.5px] text-[10px] font-bold transition-colors"
                    style={{
                      background: current ? GOLD : reached ? GOLD_FILL : CREAM_CARD,
                      borderColor: current ? GOLD : INK,
                      color: current ? "#fffdf5" : INK,
                      marginLeft: groupBreak ? 8 : undefined,
                    }}
                    data-testid={`blinding-factor-step-${targetIdx}`}
                  >
                    {targetIdx}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Caption row, full width below the controls */}
          <div className="text-sm leading-relaxed">{caption}</div>
        </div>
      </div>
    </div>
  );
}

export default BlindingFactorDiagram;
