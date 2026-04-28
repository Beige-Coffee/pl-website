import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// NetworkTopologyDiagram
//
// A simple linear topology with four nodes (Alice → Bob → Carol → Dave) and
// per-node "what they know" overlays. Used in Chapter 1 to ground the privacy
// problem; reused in later chapters when we need to refer back to the canonical
// route.
//
// Tap a node to see what that node learns from the payment. The default view
// is "omniscient" (everyone visible).
// ────────────────────────────────────────────────────────────────────────────

type NodeId = "alice" | "bob" | "carol" | "dave";

const NODES: Array<{
  id: NodeId;
  label: string;
  x: number;
  role: string;
  knows: string[];
}> = [
  {
    id: "alice",
    label: "Alice",
    x: 60,
    role: "Sender",
    knows: [
      "The full route: Bob → Carol → Dave",
      "How much each hop forwards and what fee it takes",
      "The CLTV (timelock) at every hop",
      "The payment hash and amount being delivered",
    ],
  },
  {
    id: "bob",
    label: "Bob",
    x: 200,
    role: "Forwarder",
    knows: [
      "The previous hop on the wire (Alice in this payment)",
      "The next hop is Carol",
      "The amount to forward to Carol and the outgoing CLTV",
      "Nothing about hops beyond Carol",
    ],
  },
  {
    id: "carol",
    label: "Carol",
    x: 340,
    role: "Forwarder",
    knows: [
      "The previous hop on the wire (Bob)",
      "The next hop is Dave",
      "The amount to forward to Dave and the outgoing CLTV",
      "Nothing about who started the payment",
    ],
  },
  {
    id: "dave",
    label: "Dave",
    x: 480,
    role: "Receiver",
    knows: [
      "The previous hop on the wire (Carol)",
      "The payment is for him: amount, payment hash, and final CLTV",
      "Whatever invoice metadata Alice chose to include",
      "Nothing about who paid him, unless Alice voluntarily reveals it",
    ],
  },
];

const NODE_COLORS: Record<NodeId, { fill: string; stroke: string }> = {
  alice: { fill: "#fde68a", stroke: "#b8860b" },
  bob:   { fill: "#bfdbfe", stroke: "#2563eb" },
  carol: { fill: "#bbf7d0", stroke: "#16a34a" },
  dave:  { fill: "#fecaca", stroke: "#dc2626" },
};

export function NetworkTopologyDiagram() {
  const [selected, setSelected] = useState<NodeId | null>(null);

  const node = NODES.find((n) => n.id === selected) ?? null;

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-network-topology"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        A Lightning payment route
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 540 130"
          className="w-full max-w-3xl mx-auto"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {/* Channel edges */}
          {NODES.slice(0, -1).map((n, i) => {
            const next = NODES[i + 1];
            return (
              <line
                key={`edge-${n.id}`}
                x1={n.x + 28}
                y1={50}
                x2={next.x - 28}
                y2={50}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            );
          })}

          {/* Direction arrow on the middle */}
          <path
            d="M260,42 L272,50 L260,58"
            fill="none"
            stroke="#64748b"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Nodes */}
          {NODES.map((n) => {
            const colors = NODE_COLORS[n.id];
            const isSelected = selected === n.id;
            return (
              <g
                key={n.id}
                onClick={() => setSelected(isSelected ? null : n.id)}
                style={{ cursor: "pointer" }}
                data-testid={`onion-network-node-${n.id}`}
              >
                <circle
                  cx={n.x}
                  cy={50}
                  r={28}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isSelected ? 4 : 2}
                />
                <text
                  x={n.x}
                  y={54}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="#0f172a"
                >
                  {n.label}
                </text>
                <text
                  x={n.x}
                  y={98}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#475569"
                >
                  {n.role}
                </text>
              </g>
            );
          })}

          {/* "Click a node" hint when nothing selected */}
          {!selected && (
            <text
              x={270}
              y={120}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              fontStyle="italic"
            >
              Click any node to see what they know
            </text>
          )}
        </svg>
      </div>

      {node && (
        <div
          className="mt-4 border-2 border-border bg-background p-3 md:p-4"
          data-testid="onion-network-knows-panel"
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-4 border-2"
              style={{
                background: NODE_COLORS[node.id].fill,
                borderColor: NODE_COLORS[node.id].stroke,
              }}
            />
            <div className="font-semibold">
              What {node.label} ({node.role.toLowerCase()}) knows
            </div>
          </div>
          <ul className="list-disc pl-6 space-y-1 text-sm leading-relaxed">
            {node.knows.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NetworkTopologyDiagram;
