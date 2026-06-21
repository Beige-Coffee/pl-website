import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HoverTip, Tok as TokBase, Code as CodeBase, Op as OpBase, Fn as FnBase } from "./mathTokens";
import { StepCaption } from "./StepCaption";

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
const CREAM_CARD = "#fffdf5";
const GOLD = "#b8860b";
const GOLD_FILL = "#fef3c7";

type HopKey = "bob" | "charlie" | "dave";

// Per-hop colors, matching the canonical character palette.
const HOP_COLORS: Record<HopKey, { stroke: string; fill: string; soft: string }> = {
  bob: { stroke: "#3b6aa0", fill: "#dbeafe", soft: "#eff6ff" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8", soft: "#ecfdf5" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3", soft: "#faf5ff" },
};

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
    "Multiplication, used three ways here. Scalar times G gives a public point (e_AB · G). Scalar times a node's public point gives a shared secret via ECDH (e_AB · B). Scalar times scalar gives the next private scalar (bf_AB · e_AB).",
  "‖":
    "Concatenation. Joins the bytes of E with the bytes of ss to feed into SHA256.",
};

// Local wrappers that pre-fill the diagram's TOKEN_INFO catalog.
// (Shared math primitives live in mathTokens.tsx.)
function Tok({ token, color }: { token: string; color?: string }) {
  return <TokBase token={token} color={color} info={TOKEN_INFO[token]} />;
}
function Code({ token, color }: { token: string; color?: string }) {
  return <CodeBase token={token} color={color} info={TOKEN_INFO[token]} />;
}
function Op({ op }: { op: string }) {
  return <OpBase op={op} info={TOKEN_INFO[op]} />;
}
function Fn({ name, children }: { name: string; children: ReactNode }) {
  return <FnBase name={name} info={TOKEN_INFO[name]}>{children}</FnBase>;
}

// ── Cell formulas ───────────────────────────────────────────────────────────

interface CellSpec {
  formula: ReactNode;
  caption: ReactNode;
}

const ROW_LABELS = [
  "Compute ephemeral private key",
  "Compute ephemeral public key",
  "Compute shared secret",
  "Compute blinding factor",
];

const ROW_TOOLTIPS = [
  "Each hop's ephemeral private scalar. For Bob it IS the session key directly (Alice's randomly generated 32-byte scalar). For Charlie and Dave, it's the previous hop's scalar multiplied by the previous hop's blinding factor.",
  "Multiply the ephemeral private key by G to get the ephemeral public key. Only Bob's E_AB ever travels in the packet; Charlie's and Dave's are computed on the fly.",
  "Perform ECDH between Alice's ephemeral private key and the hop's published node pubkey, then hash. Both Alice and the hop arrive at the same shared secret.",
  "Hash the ephemeral pubkey with the shared secret. The next hop uses this to derive its own ephemeral private key. Dave doesn't compute one (no successor).",
];

function buildCells(): Array<Array<CellSpec | null>> {
  const bob: CellSpec[] = [
    {
      formula: (
        <div className="flex flex-col items-center" style={{ gap: 4 }}>
          <span>
            <Tok token="e_AB" /> <Op op="=" /> <Tok token="sessionkey" />
          </span>
          <span
            style={{
              fontSize: 10,
              fontStyle: "italic",
              color: SLATE,
              letterSpacing: "0.02em",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              opacity: 0.85,
            }}
          >
            Alice's freshly generated random scalar k
          </span>
        </div>
      ),
      caption: (
        <>
          First, Alice rolls a random 32-byte <Code token="sessionkey" />. This
          is the seed the whole chain grows from. For Bob, the ephemeral private
          key just *is* the session key. Every later hop blinds its way to one.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AB" /> <Op op="=" /> <Tok token="e_AB" /> <Op op="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          Now, multiply <Code token="e_AB" /> by the curve generator{" "}
          <Code token="G" /> to get Bob's ephemeral public key{" "}
          <Code token="E_AB" />. Here's the neat part: this is the *only*
          ephemeral pubkey that ever rides along in the packet.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AB" /> <Op op="=" />{" "}
          <Fn name="SHA256">
            <Tok token="e_AB" /> <Op op="·" /> <Tok token="B" />
          </Fn>
        </>
      ),
      caption: (
        <>
          Next, ECDH between <Code token="e_AB" /> and Bob's node pubkey{" "}
          <Code token="B" />. Only Alice and Bob can land on this shared secret{" "}
          <Code token="ss_AB" />, and that's exactly what we want.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="bf_AB" /> <Op op="=" />{" "}
          <Fn name="SHA256">
            <Tok token="E_AB" /> <Op op="‖" /> <Tok token="ss_AB" />
          </Fn>
        </>
      ),
      caption: (
        <>
          Then, hash <Code token="E_AB" /> with <Code token="ss_AB" /> to get a
          blinding factor <Code token="bf_AB" />. Charlie will need this to spin
          up his own session-key-equivalent.
        </>
      ),
    },
  ];
  const charlie: CellSpec[] = [
    {
      formula: (
        <>
          <Tok token="e_AC" /> <Op op="=" /> <Tok token="bf_AB" />{" "}
          <Op op="·" /> <Tok token="e_AB" />
        </>
      ),
      caption: (
        <>
          Now, multiply <Code token="bf_AB" /> by <Code token="e_AB" /> and you
          get Charlie's session-key-equivalent <Code token="e_AC" />. The blue
          arrows show where each value came from in Bob's column.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AC" /> <Op op="=" /> <Tok token="e_AC" /> <Op op="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          Same move as before: multiply <Code token="e_AC" /> by{" "}
          <Code token="G" /> to get Charlie's ephemeral public key{" "}
          <Code token="E_AC" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AC" /> <Op op="=" />{" "}
          <Fn name="SHA256">
            <Tok token="e_AC" /> <Op op="·" /> <Tok token="C" />
          </Fn>
        </>
      ),
      caption: (
        <>
          Then, ECDH between <Code token="e_AC" /> and Charlie's node pubkey{" "}
          <Code token="C" /> hands us the shared secret <Code token="ss_AC" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="bf_AC" /> <Op op="=" />{" "}
          <Fn name="SHA256">
            <Tok token="E_AC" /> <Op op="‖" /> <Tok token="ss_AC" />
          </Fn>
        </>
      ),
      caption: (
        <>
          Finally, hash <Code token="E_AC" /> with <Code token="ss_AC" /> for a
          blinding factor <Code token="bf_AC" /> that seeds Dave's column.
        </>
      ),
    },
  ];
  const dave: Array<CellSpec | null> = [
    {
      formula: (
        <>
          <Tok token="e_AD" /> <Op op="=" /> <Tok token="bf_AC" />{" "}
          <Op op="·" /> <Tok token="e_AC" />
        </>
      ),
      caption: (
        <>
          Same blinding step, one hop down: multiply <Code token="bf_AC" /> by{" "}
          <Code token="e_AC" /> for Dave's session-key-equivalent{" "}
          <Code token="e_AD" />. The teal arrows trace it back to Charlie.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="E_AD" /> <Op op="=" /> <Tok token="e_AD" /> <Op op="·" />{" "}
          <Tok token="G" />
        </>
      ),
      caption: (
        <>
          And once more, multiply <Code token="e_AD" /> by <Code token="G" /> to
          get Dave's ephemeral public key <Code token="E_AD" />.
        </>
      ),
    },
    {
      formula: (
        <>
          <Tok token="ss_AD" /> <Op op="=" />{" "}
          <Fn name="SHA256">
            <Tok token="e_AD" /> <Op op="·" /> <Tok token="D" />
          </Fn>
        </>
      ),
      caption: (
        <>
          Last one: ECDH between <Code token="e_AD" /> and Dave's node pubkey{" "}
          <Code token="D" /> gives <Code token="ss_AD" />. Dave's the
          destination, so the chain stops here. No blinding factor needed.
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
  dave: "Dave, the final hop (the destination). His column starts from Charlie's blinding factor and skips step 4 (no successor).",
};

const INTRO_CAPTION: ReactNode = (
  <>
    Hit Next to walk Bob's column. Each hop's chain leans on the one before it,
    so we'll reveal cells in dependency order: Bob first, then Charlie, then
    Dave. Hover any token in the formulas or captions and we'll explain it.
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
  cellRef,
}: {
  cell: CellSpec | null;
  hopKey: HopKey;
  visible: boolean;
  pulse: boolean;
  isLatest: boolean;
  cellRef?: (el: HTMLDivElement | null) => void;
}) {
  const c = HOP_COLORS[hopKey];
  if (!cell) {
    // Dave's "no successor" placeholder for row 4. Same height + dashed
    // outline so the 3-column grid stays visually aligned with rows 1-3.
    return (
      <div
        ref={cellRef}
        className="border-[1.5px] border-dashed flex items-center justify-center"
        style={{
          background: CREAM_CARD,
          borderColor: SLATE,
          opacity: visible ? 0.7 : 0,
          transition: "opacity 350ms ease-out",
          minHeight: 48,
          padding: "8px 10px",
        }}
      >
        <span
          className="text-[10.5px] italic text-center"
          style={{ color: SLATE, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          (final hop, no successor)
        </span>
      </div>
    );
  }
  return (
    <div
      ref={cellRef}
      className="px-3 flex items-center justify-center"
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
        minHeight: 48,
        textAlign: "center",
        fontSize: 14.5,
        letterSpacing: "0.01em",
      }}
    >
      {cell.formula}
    </div>
  );
}

type CellRect = { x: number; y: number; w: number; h: number };

interface ArrowSpec {
  key: string;
  src: string;                  // source cell key, e.g. "0-0"
  dest: string;                 // destination cell key (used for gutter geometry)
  destToken: string;            // specific token within the dest cell to land on
  gutter: "bob-charlie" | "charlie-dave"; // which column gutter to route through
  color: string;
  showAt: number;               // subStep at which the arrow draws in
  dashed?: boolean;             // render as dashed stroke for visual differentiation
  gutterOffsetX?: number;       // shift the gutter X so paired arrows run parallel
  topYOffset?: number;          // shift the routing band Y so paired horizontals don't overlap
}

type CellRectMap = Record<string, CellRect>;

const ARROWS: ArrowSpec[] = [
  // SHORT: Bob row 1 (e_AB) → Charlie row 1's e_AB token. Dashed + offset
  // so it doesn't overlap the long arrow's vertical run up the gutter.
  {
    key: "e_AB-to-charlie",
    src: "0-0", dest: "0-1",
    destToken: "e_AB",
    gutter: "bob-charlie",
    color: "#3b6aa0",
    showAt: 5,
    dashed: true,
    gutterOffsetX: 10,
    topYOffset: -10,
  },
  // LONG: Bob row 4 (bf_AB) → Charlie row 1's bf_AB token. Solid baseline path.
  {
    key: "bf_AB-to-charlie",
    src: "3-0", dest: "0-1",
    destToken: "bf_AB",
    gutter: "bob-charlie",
    color: "#3b6aa0",
    showAt: 5,
  },
  // SHORT: Charlie row 1 (e_AC) → Dave row 1's e_AC token. Dashed + offset.
  {
    key: "e_AC-to-dave",
    src: "0-1", dest: "0-2",
    destToken: "e_AC",
    gutter: "charlie-dave",
    color: "#2d7a7a",
    showAt: 9,
    dashed: true,
    gutterOffsetX: 10,
    topYOffset: -10,
  },
  // LONG: Charlie row 4 (bf_AC) → Dave row 1's bf_AC token. Solid baseline path.
  {
    key: "bf_AC-to-dave",
    src: "3-1", dest: "0-2",
    destToken: "bf_AC",
    gutter: "charlie-dave",
    color: "#2d7a7a",
    showAt: 9,
  },
];

function arrowPath(
  src: CellRect,
  destToken: CellRect,
  gutterX: number,
  topY: number,
): string {
  // Path: source-cell right edge → into the column gutter → straight up past
  // the top of row 1 → horizontally over to above the target token → straight
  // down onto the target token from above. Stays entirely outside cell
  // bodies; the arrowhead lands on the token's top edge.
  const sx = src.x + src.w;                          // exit right edge of source
  const sy = src.y + src.h / 2;                      // vertical center of source
  const tokCenterX = destToken.x + destToken.w / 2;  // land at token's horizontal center
  const tokTopY = destToken.y - 3;                   // arrowhead 3px above token top
  const r = 6;                                       // corner radius
  return [
    `M ${sx} ${sy}`,
    `L ${gutterX - r} ${sy}`,
    `Q ${gutterX} ${sy} ${gutterX} ${sy - r}`,         // corner: turn up
    `L ${gutterX} ${topY + r}`,                        // vertical up the gutter past row 1
    `Q ${gutterX} ${topY} ${gutterX + r} ${topY}`,     // corner: turn right at the band
    `L ${tokCenterX - r} ${topY}`,                     // horizontal across to above the token
    `Q ${tokCenterX} ${topY} ${tokCenterX} ${topY + r}`, // corner: turn down
    `L ${tokCenterX} ${tokTopY}`,                      // straight down onto the token
  ].join(" ");
}

export function BlindingFactorDiagram() {
  const [subStep, setSubStep] = useState(0);
  const [pulseCellIdx, setPulseCellIdx] = useState<number | null>(null);
  const [cellRects, setCellRects] = useState<CellRectMap>({});
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const measure = useCallback(() => {
    const container = gridRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const next: CellRectMap = {};
    Object.entries(cellRefs.current).forEach(([key, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      next[key] = {
        x: r.left - cRect.left,
        y: r.top - cRect.top,
        w: r.width,
        h: r.height,
      };
    });
    // Also locate specific cross-hop target tokens within their dest cells
    // so arrows can land on the actual variable, not just the cell wall.
    ARROWS.forEach((a) => {
      const destCell = cellRefs.current[a.dest];
      if (!destCell) return;
      const tokSpan = destCell.querySelector(
        `[data-math-token="${a.destToken}"]`,
      ) as HTMLElement | null;
      if (!tokSpan) return;
      const r = tokSpan.getBoundingClientRect();
      next[`tok-${a.key}`] = {
        x: r.left - cRect.left,
        y: r.top - cRect.top,
        w: r.width,
        h: r.height,
      };
    });
    setCellRects(next);
    setContainerSize({ w: cRect.width, h: cRect.height });
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Re-measure when subStep changes (cells fade in / change opacity, which
  // can shift hit-test rects on some browsers).
  useEffect(() => {
    measure();
  }, [subStep, measure]);

  useEffect(() => {
    if (pulseCellIdx === null) return;
    const t = setTimeout(() => setPulseCellIdx(null), 800);
    return () => clearTimeout(t);
  }, [pulseCellIdx]);

  function goToStep(idx: number) {
    setSubStep(idx);
    if (idx === 5) setPulseCellIdx(4);
    else if (idx === 9) setPulseCellIdx(8);
    else setPulseCellIdx(null);
  }

  function setMilestone(idx: number) {
    goToStep(idx);
  }

  function back() {
    if (subStep <= 0) return;
    goToStep(subStep - 1);
  }
  function next() {
    if (subStep >= TOTAL_SUB_STEPS) return;
    goToStep(subStep + 1);
  }
  function reset() {
    goToStep(0);
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

  // Active hop drives the StepCaption accent: Bob (1-4), Charlie (5-8),
  // Dave (9-11). The intro (step 0) uses gold.
  const activeHop: HopKey | null =
    subStep === 0 ? null : subStep <= 4 ? "bob" : subStep <= 8 ? "charlie" : "dave";
  const captionAccent = activeHop ? HOP_COLORS[activeHop].stroke : GOLD;
  const captionLabel =
    subStep === 0 ? "GET STARTED" : `STEP ${subStep} OF ${TOTAL_SUB_STEPS}`;
  const captionTitle =
    activeHop === "bob"
      ? "Bob's column"
      : activeHop === "charlie"
        ? "Charlie's column"
        : activeHop === "dave"
          ? "Dave's column"
          : "The ephemeral key chain";

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

      <div className="px-4 py-5 bg-[#fefdfb] dark:bg-[#0b1220]">
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

        <div ref={gridRef} style={{ position: "relative" }}>
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
                    const isPlaceholder = rowCells[colIdx] === null;
                    const visible = isPlaceholder ? subStep >= 9 : subStep >= idx;
                    const isLatest = !isPlaceholder && subStep === idx;
                    const pulse = pulseCellIdx === idx;
                    const cellKey = `${rowIdx}-${colIdx}`;
                    return (
                      <CellTile
                        key={hop}
                        cell={rowCells[colIdx]}
                        hopKey={hop}
                        visible={visible}
                        pulse={pulse}
                        isLatest={isLatest}
                        cellRef={(el) => { cellRefs.current[cellKey] = el; }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Cross-hop dependency arrows. Routed through the column gutters
              so they don't cross any cell content. Each arrow draws in via
              stroke-dashoffset when its triggering subStep activates. */}
          {containerSize.w > 0 && (
            <svg
              width={containerSize.w}
              height={containerSize.h}
              viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <defs>
                {ARROWS.map((a) => (
                  <marker
                    key={`mk-${a.key}`}
                    id={`arrowhead-${a.key}`}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill={a.color} />
                  </marker>
                ))}
              </defs>
              {ARROWS.map((a) => {
                const src = cellRects[a.src];
                const destCell = cellRects[a.dest];
                const destTok = cellRects[`tok-${a.key}`];
                if (!src || !destCell || !destTok) return null;
                // Gutter X = midpoint of the column gutter we're routing
                // through. Use any row's cell rects as the X reference
                // (column geometry doesn't change row to row).
                const charlieRect = cellRects["0-1"] ?? cellRects["3-1"];
                if (!charlieRect) return null;
                const charlieLeft = charlieRect.x;
                const charlieRight = charlieRect.x + charlieRect.w;
                const bobCol = cellRects["0-0"];
                const daveCol = cellRects["0-2"];
                const bobRight = bobCol ? bobCol.x + bobCol.w : src.x + src.w;
                const daveLeft = daveCol ? daveCol.x : destCell.x;
                const baseGutterX =
                  a.gutter === "bob-charlie"
                    ? (bobRight + charlieLeft) / 2
                    : (charlieRight + daveLeft) / 2;
                // Routing band: 16px above the top of row 1. Sits in the row
                // 1 label area but above the row 1 cell bodies, so arrows
                // never cross any cell content.
                const row1Top = (cellRects["0-0"] ?? cellRects["0-1"])?.y ?? 0;
                const baseTopY = Math.max(8, row1Top - 16);
                const gutterX = baseGutterX + (a.gutterOffsetX ?? 0);
                const topY = baseTopY + (a.topYOffset ?? 0);
                const reached = subStep >= a.showAt;
                const path = arrowPath(src, destTok, gutterX, topY);
                return (
                  <path
                    key={a.key}
                    d={path}
                    stroke={a.color}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#arrowhead-${a.key})`}
                    style={{
                      // Dashed arrows use a fixed pattern; solid arrows use
                      // the dashoffset trick to "draw in".
                      strokeDasharray: a.dashed ? "5 4" : 1000,
                      strokeDashoffset: a.dashed ? 0 : reached ? 0 : 1000,
                      opacity: reached
                        ? subStep === a.showAt
                          ? 0.95
                          : 0.4
                        : 0,
                      transition: a.dashed
                        ? "opacity 500ms ease-out"
                        : "stroke-dashoffset 700ms ease-out, opacity 500ms ease-out",
                    }}
                  />
                );
              })}
            </svg>
          )}
        </div>

        <StepCaption
          label={captionLabel}
          title={captionTitle}
          caption={caption}
          accentColor={captionAccent}
        />
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        {/* Controls row (caption now lives in the StepCaption block above) */}
        <div className="flex gap-1.5 items-center flex-wrap">
          <button
              onClick={back}
              disabled={subStep <= 0}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
              data-testid="blinding-factor-diagram-back"
            >
              ← Back
            </button>
            <button
              onClick={next}
              disabled={subStep >= TOTAL_SUB_STEPS}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
              data-testid="blinding-factor-diagram-next"
            >
              Next →
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
                    className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
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
        </div>
      </div>
  );
}

export default BlindingFactorDiagram;
