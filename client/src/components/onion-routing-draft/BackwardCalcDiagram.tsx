import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// BackwardCalcDiagram
//
// Visualizes the worked example from Chapter 2. Four nodes in a row (Alice →
// Bob → Carol → Dave) with amount + CLTV labels on each transition, and a
// step indicator that walks the user through the backward computation.
// ────────────────────────────────────────────────────────────────────────────

const NODES = [
  { id: "alice", label: "Alice", role: "Sender", x: 60 },
  { id: "bob", label: "Bob", role: "Forwarder", x: 230 },
  { id: "carol", label: "Carol", role: "Forwarder", x: 400 },
  { id: "dave", label: "Dave", role: "Receiver", x: 570 },
];

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  alice: { fill: "#fde68a", stroke: "#b8860b" },
  bob:   { fill: "#bfdbfe", stroke: "#2563eb" },
  carol: { fill: "#bbf7d0", stroke: "#16a34a" },
  dave:  { fill: "#fecaca", stroke: "#dc2626" },
};

// Each "edge" is the HTLC flowing into the next hop's inbound.
// Indexed by step order: step 1 = Dave (the only fixed point), step 2 = Carol's
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
      "Carol forwards 10,000 to Dave and keeps her 2-sat fee. Her CLTV is Dave's + her 40-block delta.",
  },
  {
    step: 3,
    receiverIdx: 1,
    amountSat: 10_003,
    cltvBlock: 260,
    caption:
      "Bob forwards 10,002 to Carol and keeps his 1-sat fee. His CLTV is Carol's + his 80-block delta.",
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
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-backward-calc"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Working backward from the destination
      </div>

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
                stroke="#cbd5e1"
                strokeWidth={2}
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
                  strokeWidth={2}
                />
                <text x={n.x} y={74} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f172a">
                  {n.label}
                </text>
                <text x={n.x} y={114} textAnchor="middle" fontSize={10} fill="#475569">
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
                <circle cx={node.x} cy={28} r={11} fill="#fef3c7" stroke="#b8860b" strokeWidth={2} />
                <text x={node.x} y={32} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f172a">
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
                  <text x={node.x} y={148} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
                    {formatSat(s.amountSat)}
                  </text>
                  <text x={node.x} y={166} textAnchor="middle" fontSize={10} fill="#475569">
                    CLTV: block {s.cltvBlock}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Backward-flow arrow underneath, showing computation direction */}
          {activeStep < 4 && (
            <g>
              <text x={315} y={195} textAnchor="middle" fontSize={10} fontStyle="italic" fill="#94a3b8">
                Computation direction
              </text>
              <path
                d="M340,189 L355,189 L350,184 M355,189 L350,194"
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Step controls */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:gap-4">
        <div className="flex gap-2">
          {STEPS.map((s) => (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                activeStep >= s.step
                  ? "bg-primary text-foreground border-border"
                  : "bg-card text-foreground/50 border-border hover:bg-secondary"
              }`}
              data-testid={`onion-backward-calc-step-${s.step}`}
            >
              {s.step}
            </button>
          ))}
        </div>
        <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1">
          {STEPS[activeStep - 1].caption}
        </div>
      </div>
    </div>
  );
}

export default BackwardCalcDiagram;
