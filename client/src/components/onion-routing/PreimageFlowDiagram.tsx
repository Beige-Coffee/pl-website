import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreimageFlowDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 720;
const SVG_HEIGHT = 200;
const NODE_RADIUS = 24;
const NODE_Y = 55;
const NODE_SPACING = 170;
const START_X = 80;
const FONT = "system-ui, -apple-system, sans-serif";

// Node data
const NODES = [
  { label: "Alice", fill: "#3b82f6", stroke: "#2563eb", fee: null as string | null },
  { label: "Bob", fill: "#22c55e", stroke: "#16a34a", fee: "keeps 6,000 msat" },
  { label: "Carol", fill: "#f59e0b", stroke: "#d97706", fee: "keeps 3,000 msat" },
  { label: "Dave", fill: "#a855f7", stroke: "#9333ea", fee: "reveals preimage" },
];

function nodeX(index: number): number {
  return START_X + index * NODE_SPACING;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PreimageFlowDiagram({
  className,
}: PreimageFlowDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxWidth: SVG_WIDTH, height: "auto" }}
        role="img"
        aria-label="Preimage flows backward from Dave to Alice, with each hop collecting fees"
      >
        {/* Direction label */}
        <text
          x={SVG_WIDTH / 2}
          y={16}
          textAnchor="middle"
          fill="#22c55e"
          fontSize={11}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.8}
        >
          &#x2190; update_fulfill_htlc (preimage flows backward) &#x2190;
        </text>

        {/* Backward arrows (right to left) with message labels */}
        {[2, 1, 0].map((toIdx) => {
          const fromIdx = toIdx + 1;
          const x1 = nodeX(fromIdx) - NODE_RADIUS - 6;
          const x2 = nodeX(toIdx) + NODE_RADIUS + 10;
          const midX = (nodeX(fromIdx) + nodeX(toIdx)) / 2;
          return (
            <g key={toIdx}>
              {/* Arrow line */}
              <line
                x1={x1}
                y1={NODE_Y}
                x2={x2}
                y2={NODE_Y}
                stroke="#22c55e"
                strokeWidth={2.5}
                opacity={0.6}
              />
              {/* Arrowhead pointing left */}
              <polygon
                points={`${x2 - 2},${NODE_Y} ${x2 + 6},${NODE_Y - 4} ${x2 + 6},${NODE_Y + 4}`}
                fill="#22c55e"
                opacity={0.7}
              />
              {/* Message label */}
              <text
                x={midX}
                y={NODE_Y - NODE_RADIUS - 8}
                textAnchor="middle"
                fill="#22c55e"
                fontSize={9}
                fontWeight={600}
                fontFamily={FONT}
                opacity={0.7}
              >
                preimage
              </text>
            </g>
          );
        })}

        {/* Node circles */}
        {NODES.map((node, i) => {
          const x = nodeX(i);
          return (
            <g key={node.label}>
              <circle
                cx={x}
                cy={NODE_Y}
                r={NODE_RADIUS}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={2.5}
              />
              <text
                x={x}
                y={NODE_Y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={11}
                fontWeight={700}
                fontFamily={FONT}
              >
                {node.label}
              </text>

              {/* Fee / role annotation below */}
              {node.fee && (
                <text
                  x={x}
                  y={NODE_Y + NODE_RADIUS + 16}
                  textAnchor="middle"
                  fill={i === 3 ? "#a855f7" : "#22c55e"}
                  fontSize={9}
                  fontWeight={600}
                  fontFamily={FONT}
                  opacity={0.8}
                >
                  {node.fee}
                </text>
              )}
              {i === 0 && (
                <text
                  x={x}
                  y={NODE_Y + NODE_RADIUS + 16}
                  textAnchor="middle"
                  fill="#3b82f6"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily={FONT}
                  opacity={0.8}
                >
                  paid 50,009,000 msat
                </text>
              )}
            </g>
          );
        })}

        {/* Amount received annotations */}
        <text
          x={nodeX(0)}
          y={NODE_Y + NODE_RADIUS + 30}
          textAnchor="middle"
          fill="currentColor"
          fontSize={8}
          fontFamily={FONT}
          opacity={0.4}
        >
          (has preimage as receipt)
        </text>
      </svg>
      <p className="text-sm text-muted-foreground text-center italic mt-2 font-sans">
        The preimage travels backward from Dave to Alice. Each hop collects its fee along the way.
      </p>
    </div>
  );
}
