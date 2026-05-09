import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// NetworkTopologyDiagram (rebuilt 2026-05-08)
//
// Linear 4-node topology (Alice → Bob → Charlie → Dave). Click any node to
// see what that node knows after the payment completes. Used in chapter 14
// (Beyond Sphinx) as the survey reference.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type NodeId = "alice" | "bob" | "charlie" | "dave";

const HOP_FILL: Record<NodeId, string> = {
  alice: "#fef3c7",
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
};
const HOP_STROKE: Record<NodeId, string> = {
  alice: "#b8860b",
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};
const NODE_X_PCT: Record<NodeId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

const NODES: Array<{
  id: NodeId;
  label: string;
  role: string;
  knows: string[];
}> = [
  {
    id: "alice",
    label: "Alice",
    role: "Sender",
    knows: [
      "The full route: Bob → Charlie → Dave",
      "How much each hop forwards and what fee it takes",
      "The CLTV (timelock) at every hop",
      "The payment hash and amount being delivered",
    ],
  },
  {
    id: "bob",
    label: "Bob",
    role: "Forwarder",
    knows: [
      "The previous hop on the wire (Alice in this payment)",
      "The next hop is Charlie",
      "The amount to forward to Charlie and the outgoing CLTV",
      "Nothing about hops beyond Charlie",
    ],
  },
  {
    id: "charlie",
    label: "Charlie",
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
    role: "Receiver",
    knows: [
      "The previous hop on the wire (Charlie)",
      "The payment is for him: amount, payment hash, and final CLTV",
      "Whatever invoice metadata Alice chose to include",
      "Nothing about who paid him, unless Alice voluntarily reveals it",
    ],
  },
];

export function NetworkTopologyDiagram() {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const node = NODES.find((n) => n.id === selected) ?? null;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-network-topology"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            A Lightning payment route
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-8"
        style={{ minHeight: 220 }}
      >
        <div className="overflow-x-auto">
          <div className="relative" style={{ minWidth: 600, minHeight: 130 }}>
            {/* Backbone */}
            <div
              className="absolute"
              style={{
                top: 30,
                left: "12%",
                width: "76%",
                borderTop: "1.5px dashed #475569",
              }}
            />

            {/* Direction marker */}
            <div
              className="absolute text-[10px] tracking-[0.04em]"
              style={{
                left: "50%",
                top: 18,
                transform: "translateX(-50%)",
                color: "#475569",
                fontFamily: MONO,
                letterSpacing: "0.04em",
              }}
            >
              →
            </div>

            {/* Nodes */}
            {NODES.map((n) => {
              const isSelected = selected === n.id;
              return (
                <div
                  key={n.id}
                  className="absolute flex flex-col items-center cursor-pointer"
                  style={{
                    left: `${NODE_X_PCT[n.id]}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                  }}
                  onClick={() => setSelected(isSelected ? null : n.id)}
                  data-testid={`onion-network-node-${n.id}`}
                >
                  <div
                    className="w-20 h-12 flex items-center justify-center border-[1.5px]"
                    style={{
                      background: isSelected ? "#fef3c7" : HOP_FILL[n.id],
                      borderColor: isSelected ? "#b8860b" : HOP_STROKE[n.id],
                      borderWidth: isSelected ? "2.5px" : "1.5px",
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {n.label.toUpperCase()}
                  </div>
                  <div
                    className="text-[10px] mt-1 tracking-[0.04em]"
                    style={{ color: "#475569", fontFamily: MONO }}
                  >
                    {n.role.toLowerCase()}
                  </div>
                </div>
              );
            })}

            {/* Hint */}
            {!selected && (
              <div
                className="absolute text-[11px] italic"
                style={{
                  left: "50%",
                  top: 100,
                  transform: "translateX(-50%)",
                  color: "#475569",
                }}
              >
                Click any node to see what they know after the payment.
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {node && (
          <div
            className="mt-5 border-[1.5px] p-3"
            style={{
              background: HOP_FILL[node.id],
              borderColor: HOP_STROKE[node.id],
            }}
            data-testid="onion-network-knows-panel"
          >
            <div
              className="font-bold text-sm mb-1.5"
              style={{ color: "#0f172a", letterSpacing: "0.02em" }}
            >
              What {node.label} ({node.role.toLowerCase()}) knows
            </div>
            <ul
              className="space-y-1 text-sm leading-relaxed"
              style={{ color: "#0f172a" }}
            >
              {node.knows.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    style={{
                      color: HOP_STROKE[node.id],
                      fontFamily: MONO,
                      fontWeight: 700,
                    }}
                  >
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default NetworkTopologyDiagram;
