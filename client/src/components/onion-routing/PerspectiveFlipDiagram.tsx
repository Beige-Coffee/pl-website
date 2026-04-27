import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerspectiveFlipDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 760;
const SVG_HEIGHT = 260;
const NODE_RADIUS = 22;
const FONT = "system-ui, -apple-system, sans-serif";

// Node colors
const COLORS = {
  alice: { fill: "#3b82f6", stroke: "#2563eb" },
  bob: { fill: "#22c55e", stroke: "#16a34a" },
  carol: { fill: "#f59e0b", stroke: "#d97706" },
  dave: { fill: "#a855f7", stroke: "#9333ea" },
  unknown: { fill: "#6b7280", stroke: "#4b5563" },
};

// ---------------------------------------------------------------------------
// Left side: Alice's view (Sender knows everything)
// ---------------------------------------------------------------------------

function SenderView() {
  const startX = 50;
  const nodeY = 80;
  const spacing = 80;
  const nodes = [
    { label: "Alice", color: COLORS.alice, amt: "50,009,000" },
    { label: "Bob", color: COLORS.bob, amt: "50,003,000" },
    { label: "Carol", color: COLORS.carol, amt: "50,000,000" },
    { label: "Dave", color: COLORS.dave, amt: "50,000,000" },
  ];

  return (
    <g>
      {/* Title */}
      <text
        x={startX + spacing * 1.5}
        y={24}
        textAnchor="middle"
        fill="currentColor"
        fontSize={13}
        fontWeight={700}
        fontFamily={FONT}
      >
        Sender's View (Alice)
      </text>
      <text
        x={startX + spacing * 1.5}
        y={40}
        textAnchor="middle"
        fill="currentColor"
        fontSize={10}
        fontFamily={FONT}
        opacity={0.5}
      >
        Knows the entire route
      </text>

      {/* Nodes and arrows */}
      {nodes.map((node, i) => {
        const x = startX + i * spacing;
        return (
          <g key={node.label}>
            {/* Node circle */}
            <circle
              cx={x}
              cy={nodeY}
              r={NODE_RADIUS}
              fill={node.color.fill}
              stroke={node.color.stroke}
              strokeWidth={2}
            />
            <text
              x={x}
              y={nodeY + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={10}
              fontWeight={700}
              fontFamily={FONT}
            >
              {node.label}
            </text>

            {/* Amount label below */}
            <text
              x={x}
              y={nodeY + NODE_RADIUS + 14}
              textAnchor="middle"
              fill="currentColor"
              fontSize={9}
              fontFamily={FONT}
              opacity={0.7}
            >
              {node.amt}
            </text>
            <text
              x={x}
              y={nodeY + NODE_RADIUS + 25}
              textAnchor="middle"
              fill="currentColor"
              fontSize={8}
              fontFamily={FONT}
              opacity={0.4}
            >
              msat
            </text>

            {/* Arrow to next node */}
            {i < nodes.length - 1 && (
              <>
                <line
                  x1={x + NODE_RADIUS + 4}
                  y1={nodeY}
                  x2={x + spacing - NODE_RADIUS - 8}
                  y2={nodeY}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  opacity={0.3}
                />
                <polygon
                  points={`${x + spacing - NODE_RADIUS - 4},${nodeY} ${x + spacing - NODE_RADIUS - 10},${nodeY - 3} ${x + spacing - NODE_RADIUS - 10},${nodeY + 3}`}
                  fill="currentColor"
                  opacity={0.3}
                />
              </>
            )}
          </g>
        );
      })}

      {/* Fee annotations between nodes */}
      <text
        x={startX + spacing * 0.5}
        y={nodeY - NODE_RADIUS - 10}
        textAnchor="middle"
        fill="#22c55e"
        fontSize={8}
        fontWeight={600}
        fontFamily={FONT}
      >
        fee: 6,000
      </text>
      <text
        x={startX + spacing * 1.5}
        y={nodeY - NODE_RADIUS - 10}
        textAnchor="middle"
        fill="#f59e0b"
        fontSize={8}
        fontWeight={600}
        fontFamily={FONT}
      >
        fee: 3,000
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Right side: Bob's view (only sees immediate neighbors)
// ---------------------------------------------------------------------------

function ReceiverView() {
  const offsetX = 410;
  const startX = offsetX + 50;
  const nodeY = 80;
  const spacing = 80;

  const nodes = [
    { label: "???", color: COLORS.unknown, amt: "???", dimmed: true },
    { label: "Bob", color: COLORS.bob, amt: "50,003,000", dimmed: false },
    { label: "???", color: COLORS.unknown, amt: "???", dimmed: true },
    { label: "???", color: COLORS.unknown, amt: "???", dimmed: true },
  ];

  return (
    <g>
      {/* Title */}
      <text
        x={startX + spacing * 1.5}
        y={24}
        textAnchor="middle"
        fill="currentColor"
        fontSize={13}
        fontWeight={700}
        fontFamily={FONT}
      >
        Forwarder's View (Bob)
      </text>
      <text
        x={startX + spacing * 1.5}
        y={40}
        textAnchor="middle"
        fill="currentColor"
        fontSize={10}
        fontFamily={FONT}
        opacity={0.5}
      >
        Only knows his own hop
      </text>

      {/* Nodes and arrows */}
      {nodes.map((node, i) => {
        const x = startX + i * spacing;
        const opacity = node.dimmed ? 0.25 : 1;
        return (
          <g key={i} style={{ opacity }}>
            {/* Node circle */}
            <circle
              cx={x}
              cy={nodeY}
              r={NODE_RADIUS}
              fill={node.color.fill}
              stroke={node.color.stroke}
              strokeWidth={2}
            />
            <text
              x={x}
              y={nodeY + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={node.dimmed ? 12 : 10}
              fontWeight={700}
              fontFamily={FONT}
            >
              {node.label}
            </text>

            {/* Amount label below */}
            <text
              x={x}
              y={nodeY + NODE_RADIUS + 14}
              textAnchor="middle"
              fill="currentColor"
              fontSize={9}
              fontFamily={FONT}
              opacity={node.dimmed ? 0.5 : 0.7}
            >
              {node.amt}
            </text>
            {!node.dimmed && (
              <text
                x={x}
                y={nodeY + NODE_RADIUS + 25}
                textAnchor="middle"
                fill="currentColor"
                fontSize={8}
                fontFamily={FONT}
                opacity={0.4}
              >
                msat
              </text>
            )}

            {/* Arrow to next node */}
            {i < nodes.length - 1 && (
              <>
                <line
                  x1={x + NODE_RADIUS + 4}
                  y1={nodeY}
                  x2={x + spacing - NODE_RADIUS - 8}
                  y2={nodeY}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  opacity={0.15}
                />
                <polygon
                  points={`${x + spacing - NODE_RADIUS - 4},${nodeY} ${x + spacing - NODE_RADIUS - 10},${nodeY - 3} ${x + spacing - NODE_RADIUS - 10},${nodeY + 3}`}
                  fill="currentColor"
                  opacity={0.15}
                />
              </>
            )}
          </g>
        );
      })}

      {/* Bob's known amounts */}
      <text
        x={startX + spacing * 0.5}
        y={nodeY - NODE_RADIUS - 10}
        textAnchor="middle"
        fill="#22c55e"
        fontSize={8}
        fontWeight={600}
        fontFamily={FONT}
      >
        in: 50,009,000
      </text>
      <text
        x={startX + spacing * 1.5}
        y={nodeY - NODE_RADIUS - 10}
        textAnchor="middle"
        fill="#22c55e"
        fontSize={8}
        fontWeight={600}
        fontFamily={FONT}
      >
        out: 50,003,000
      </text>
      <text
        x={startX + spacing * 2.5}
        y={nodeY - NODE_RADIUS - 10}
        textAnchor="middle"
        fill="currentColor"
        fontSize={8}
        fontFamily={FONT}
        opacity={0.2}
      >
        ???
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PerspectiveFlipDiagram({
  className,
}: PerspectiveFlipDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxWidth: SVG_WIDTH, height: "auto" }}
        role="img"
        aria-label="Perspective flip: sender sees entire route, forwarder sees only their own hop"
      >
        {/* Left panel: Sender's view */}
        <SenderView />

        {/* Divider */}
        <line
          x1={385}
          y1={12}
          x2={385}
          y2={SVG_HEIGHT - 30}
          stroke="currentColor"
          strokeWidth={2.5}
          opacity={0.15}
        />
        <text
          x={385}
          y={SVG_HEIGHT - 14}
          textAnchor="middle"
          fill="currentColor"
          fontSize={11}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.4}
        >
          PERSPECTIVE FLIP
        </text>

        {/* Right panel: Receiver's view */}
        <ReceiverView />
      </svg>
      <p className="text-sm text-muted-foreground text-center italic mt-2 font-sans">
        Alice knows the complete route. Bob only sees his incoming and outgoing amounts.
      </p>
    </div>
  );
}
