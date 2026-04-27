/**
 * NetworkTopologyDiagram -- a static SVG showing a small Lightning Network
 * graph with 6 nodes and multiple channels. The chosen payment path
 * (Alice -> Bob -> Carol -> Dave) is highlighted in bold, while other
 * channels appear faded/dashed.
 *
 * Below the graph, gossip message badges illustrate how nodes learn about
 * the network topology.
 *
 * Embed via the `<network-topology></network-topology>` custom tag.
 */

export interface NetworkTopologyDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Node definitions
// ---------------------------------------------------------------------------

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  fill: string;
  stroke: string;
  /** Whether this node is on the chosen route */
  onRoute: boolean;
}

const NODES: NodeDef[] = [
  { id: "alice", label: "Alice",  x: 80,  y: 120, fill: "#3b82f6", stroke: "#2563eb", onRoute: true },
  { id: "bob",   label: "Bob",    x: 280, y: 60,  fill: "#22c55e", stroke: "#16a34a", onRoute: true },
  { id: "carol", label: "Carol",  x: 480, y: 60,  fill: "#f59e0b", stroke: "#d97706", onRoute: true },
  { id: "dave",  label: "Dave",   x: 680, y: 120, fill: "#a855f7", stroke: "#9333ea", onRoute: true },
  { id: "eve",   label: "Eve",    x: 280, y: 220, fill: "#6b7280", stroke: "#4b5563", onRoute: false },
  { id: "frank", label: "Frank",  x: 480, y: 220, fill: "#6b7280", stroke: "#4b5563", onRoute: false },
];

const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Edge definitions
// ---------------------------------------------------------------------------

interface EdgeDef {
  from: string;
  to: string;
  /** Whether this edge is on the chosen route */
  onRoute: boolean;
}

const EDGES: EdgeDef[] = [
  // Route edges
  { from: "alice", to: "bob",   onRoute: true },
  { from: "bob",   to: "carol", onRoute: true },
  { from: "carol", to: "dave",  onRoute: true },
  // Non-route edges
  { from: "alice", to: "eve",   onRoute: false },
  { from: "bob",   to: "eve",   onRoute: false },
  { from: "carol", to: "frank", onRoute: false },
  { from: "eve",   to: "frank", onRoute: false },
  { from: "frank", to: "dave",  onRoute: false },
];

const NODE_RADIUS = 26;
const SVG_WIDTH = 760;
const SVG_HEIGHT = 340;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NetworkEdge({ edge }: { edge: EdgeDef }) {
  const a = NODE_MAP[edge.from];
  const b = NODE_MAP[edge.to];

  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={edge.onRoute ? "#3b82f6" : "currentColor"}
      strokeWidth={edge.onRoute ? 3 : 1.5}
      strokeOpacity={edge.onRoute ? 0.7 : 0.2}
      strokeDasharray={edge.onRoute ? undefined : "6 4"}
    />
  );
}

function NetworkNode({ node }: { node: NodeDef }) {
  const r = node.onRoute ? NODE_RADIUS : NODE_RADIUS - 4;

  return (
    <g>
      {/* Outer glow for route nodes */}
      {node.onRoute && (
        <circle
          cx={node.x}
          cy={node.y}
          r={r + 5}
          fill="none"
          stroke={node.fill}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.35}
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={node.fill}
        stroke={node.stroke}
        strokeWidth={2}
        opacity={node.onRoute ? 1 : 0.5}
      />
      <text
        x={node.x}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={node.onRoute ? 12 : 11}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {node.label}
      </text>
    </g>
  );
}

/** Arrow overlay showing the payment direction along the route */
function RouteArrow({
  from,
  to,
}: {
  from: NodeDef;
  to: NodeDef;
}) {
  // Offset start/end to sit outside the node circles
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / dist;
  const uy = dy / dist;

  const startX = from.x + ux * (NODE_RADIUS + 8);
  const startY = from.y + uy * (NODE_RADIUS + 8);
  const endX = to.x - ux * (NODE_RADIUS + 8);
  const endY = to.y - uy * (NODE_RADIUS + 8);

  const arrowSize = 8;
  // Arrowhead points
  const ax1 = endX - ux * arrowSize - uy * (arrowSize / 2);
  const ay1 = endY - uy * arrowSize + ux * (arrowSize / 2);
  const ax2 = endX - ux * arrowSize + uy * (arrowSize / 2);
  const ay2 = endY - uy * arrowSize - ux * (arrowSize / 2);

  return (
    <g>
      <line
        x1={startX}
        y1={startY}
        x2={endX - ux * arrowSize}
        y2={endY - uy * arrowSize}
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeOpacity={0.8}
      />
      <polygon
        points={`${endX},${endY} ${ax1},${ay1} ${ax2},${ay2}`}
        fill="#3b82f6"
        fillOpacity={0.8}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Gossip badges
// ---------------------------------------------------------------------------

function GossipBadges() {
  return (
    <g>
      {/* Divider line */}
      <line
        x1={60}
        y1={270}
        x2={700}
        y2={270}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />

      {/* Label */}
      <text
        x={SVG_WIDTH / 2}
        y={295}
        textAnchor="middle"
        fill="currentColor"
        fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={0.5}
      >
        Gossip messages propagate through the network:
      </text>

      {/* channel_announcement badge */}
      <rect
        x={170}
        y={306}
        width={175}
        height={26}
        rx={4}
        fill="#3b82f6"
        fillOpacity={0.12}
        stroke="#3b82f6"
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />
      <text
        x={257}
        y={323}
        textAnchor="middle"
        fill="#3b82f6"
        fontSize={11}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        channel_announcement
      </text>

      {/* channel_update badge */}
      <rect
        x={415}
        y={306}
        width={175}
        height={26}
        rx={4}
        fill="#22c55e"
        fillOpacity={0.12}
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />
      <text
        x={502}
        y={323}
        textAnchor="middle"
        fill="#22c55e"
        fontSize={11}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        channel_update
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NetworkTopologyDiagram({ className }: NetworkTopologyDiagramProps) {
  const routeEdges = EDGES.filter((e) => e.onRoute);

  return (
    <div className={`my-8 ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxWidth: SVG_WIDTH, height: "auto" }}
        role="img"
        aria-label="Lightning Network topology with 6 nodes. The payment path Alice, Bob, Carol, Dave is highlighted."
      >
        {/* Non-route edges (behind everything) */}
        {EDGES.filter((e) => !e.onRoute).map((edge) => (
          <NetworkEdge key={`${edge.from}-${edge.to}`} edge={edge} />
        ))}

        {/* Route edges (solid, on top of dashed) */}
        {EDGES.filter((e) => e.onRoute).map((edge) => (
          <NetworkEdge key={`${edge.from}-${edge.to}`} edge={edge} />
        ))}

        {/* Route direction arrows */}
        {routeEdges.map((edge) => (
          <RouteArrow
            key={`arrow-${edge.from}-${edge.to}`}
            from={NODE_MAP[edge.from]}
            to={NODE_MAP[edge.to]}
          />
        ))}

        {/* Nodes (render on top of edges) */}
        {NODES.map((node) => (
          <NetworkNode key={node.id} node={node} />
        ))}

        {/* Gossip badges */}
        <GossipBadges />
      </svg>

      <p className="text-sm text-muted-foreground text-center italic mt-2 font-sans">
        Alice discovers the network topology through gossip messages and selects the path
        Alice &rarr; Bob &rarr; Carol &rarr; Dave.
      </p>
    </div>
  );
}
