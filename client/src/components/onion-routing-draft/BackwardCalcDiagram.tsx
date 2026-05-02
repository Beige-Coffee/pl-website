import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// BackwardCalcDiagram
//
// Visualizes the worked example from Chapter 2. Four nodes in a row (Alice →
// Bob → Charlie → Dave) with amount + CLTV labels on each transition, and a
// step indicator that walks the user through the backward computation.
//
// Visual format follows the locked onion-routing course spec:
//   - Black header bar with gold dot + uppercase title.
//   - Cream stage body (#fefdfb) wrapping the SVG.
//   - Footer with numbered step buttons matching PlaintextMessageTear.
//   - Body sans-serif; no font-pixel/font-mono Tailwind classes.
// ────────────────────────────────────────────────────────────────────────────

const NODES = [
  { id: "alice", label: "Alice", role: "Sender", x: 60 },
  { id: "bob", label: "Bob", role: "Forwarder", x: 230 },
  { id: "charlie", label: "Charlie", role: "Forwarder", x: 400 },
  { id: "dave", label: "Dave", role: "Receiver", x: 570 },
];

// Canonical onion-routing palette — must match EncryptedSliceReveal,
// HtlcPropagationDiagram, EcdhChainDiagram, FiveKeysJobsDiagram, TlvByteBreakdown.
//   Alice (sender)     = gold   #b8860b
//   Bob (forwarder 1)  = indigo #3b6aa0
//   Charlie (fwd 2)    = teal   #2d7a7a
//   Dave (receiver)    = violet #7b4b8a
const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  alice:   { fill: "#fef3c7", stroke: "#b8860b" },
  bob:     { fill: "#dbeafe", stroke: "#3b6aa0" },
  charlie: { fill: "#ccece8", stroke: "#2d7a7a" },
  dave:    { fill: "#ede1f3", stroke: "#7b4b8a" },
};

// Each "edge" is the HTLC flowing into the next hop's inbound.
// Indexed by step order: step 1 = Dave (the only fixed point), step 2 = Charlie's
// inbound, step 3 = Bob's inbound, step 4 = Alice's send.
const STEPS: Array<{
  step: number;
  // index into NODES of the node receiving this HTLC
  receiverIdx: number;
  amountSat: number;
  cltvBlock: number;
  caption: string;
}> = [
  {
    step: 1,
    receiverIdx: 3,
    amountSat: 10_000,
    cltvBlock: 140,
    caption:
      "Dave's amount and CLTV are fixed by the invoice. Everything else is computed from here.",
  },
  {
    step: 2,
    receiverIdx: 2,
    amountSat: 10_002,
    cltvBlock: 180,
    caption:
      "Charlie forwards 10,000 to Dave and keeps his 2-sat fee. His CLTV is Dave's plus his 40-block delta.",
  },
  {
    step: 3,
    receiverIdx: 1,
    amountSat: 10_003,
    cltvBlock: 260,
    caption:
      "Bob forwards 10,002 to Charlie and keeps his 1-sat fee. His CLTV is Charlie's plus his 80-block delta.",
  },
  {
    step: 4,
    receiverIdx: 0,
    amountSat: 10_003,
    cltvBlock: 260,
    caption:
      "Alice initiates: 10,003 sats with CLTV 260. She'll wrap each hop's instructions inside the onion next.",
  },
];

function formatSat(n: number) {
  return n.toLocaleString("en-US") + " sats";
}

export function BackwardCalcDiagram() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const visible = STEPS.filter((s) => s.step <= activeStep);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="backward-calc"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Working Backward From Dave
          </span>
        </div>
      </div>

      {/* Cream stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 360 }}
      >
        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 630 200"
            className="w-full max-w-4xl mx-auto"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {/* Backbone line */}
            {NODES.slice(0, -1).map((n, i) => {
              const next = NODES[i + 1];
              return (
                <line
                  key={`edge-${n.id}`}
                  x1={n.x + 28}
                  y1={70}
                  x2={next.x - 28}
                  y2={70}
                  stroke="#475569"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              );
            })}

            {/* Nodes */}
            {NODES.map((n) => {
              const colors = NODE_COLORS[n.id];
              return (
                <g key={n.id}>
                  <circle
                    cx={n.x}
                    cy={70}
                    r={28}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                  />
                  <text
                    x={n.x}
                    y={74}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x}
                    y={114}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#475569"
                  >
                    {n.role}
                  </text>
                </g>
              );
            })}

            {/* HTLC labels — appear as steps unlock */}
            {visible.map((s) => {
              const node = NODES[s.receiverIdx];
              return (
                <g key={`htlc-${s.step}`}>
                  {/* number bubble above the recipient */}
                  <circle
                    cx={node.x}
                    cy={28}
                    r={11}
                    fill="#fef3c7"
                    stroke="#b8860b"
                    strokeWidth={1.5}
                  />
                  <text
                    x={node.x}
                    y={32}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {s.step}
                  </text>
                  {/* amount + cltv card */}
                  <g>
                    <rect
                      x={node.x - 60}
                      y={130}
                      width={120}
                      height={48}
                      rx={4}
                      fill="#fffdf5"
                      stroke={NODE_COLORS[node.id].stroke}
                      strokeWidth={1.5}
                    />
                    <text
                      x={node.x}
                      y={148}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill="#0f172a"
                      style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
                    >
                      {formatSat(s.amountSat)}
                    </text>
                    <text
                      x={node.x}
                      y={166}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#475569"
                      style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
                    >
                      CLTV: block {s.cltvBlock}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Backward-flow arrow underneath, showing computation direction */}
            {activeStep < 4 && (
              <g>
                <text
                  x={315}
                  y={195}
                  textAnchor="middle"
                  fontSize={10}
                  fontStyle="italic"
                  fill="#475569"
                >
                  Computation direction
                </text>
                <path
                  d="M340,189 L355,189 L350,184 M355,189 L350,194"
                  fill="none"
                  stroke="#475569"
                  strokeWidth={1.5}
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer with step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            {STEPS.map((s) => {
              const isActive = activeStep === s.step;
              const isPast = activeStep > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setActiveStep(s.step)}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: isActive ? "#b8860b" : isPast ? "#fef3c7" : "#fffdf5",
                    borderColor: isActive ? "#b8860b" : "#0f172a",
                    color: isActive ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`backward-calc-step-${s.step}`}
                >
                  {s.step}
                </button>
              );
            })}
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEPS[activeStep - 1].caption}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackwardCalcDiagram;
