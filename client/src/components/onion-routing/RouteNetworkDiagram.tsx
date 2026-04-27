import { useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import {
  CANONICAL_TRACE,
  CHANNELS,
} from "@/data/onion-routing-constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteNetworkDiagramProps {
  className?: string;
  /** Show per-hop forwarding amounts. Default true. */
  showAmounts?: boolean;
  /** Show per-hop CLTV expiry values. Default false. */
  showCltv?: boolean;
  /** Smaller variant for inline or sidebar use. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Constants -- layout and color
// ---------------------------------------------------------------------------

const ROUTE_NODES: { name: NodeName; label: string; role: string }[] = [
  { name: "alice", label: "Alice", role: "Sender" },
  { name: "bob", label: "Bob", role: "Hop 1" },
  { name: "carol", label: "Carol", role: "Hop 2" },
  { name: "dave", label: "Dave", role: "Receiver" },
];

/** SVG fill/stroke colors per node. Index into ROUTE_NODES order. */
const NODE_COLORS: Record<
  NodeName,
  { fill: string; stroke: string; text: string; dimFill: string }
> = {
  alice: {
    fill: "#3b82f6",   // blue-500
    stroke: "#2563eb", // blue-600
    text: "#ffffff",
    dimFill: "#93c5fd", // blue-300
  },
  bob: {
    fill: "#22c55e",   // green-500
    stroke: "#16a34a", // green-600
    text: "#ffffff",
    dimFill: "#86efac", // green-300
  },
  carol: {
    fill: "#f59e0b",   // amber-500
    stroke: "#d97706", // amber-600
    text: "#ffffff",
    dimFill: "#fcd34d", // amber-300
  },
  dave: {
    fill: "#a855f7",   // purple-500
    stroke: "#9333ea", // purple-600
    text: "#ffffff",
    dimFill: "#d8b4fe", // purple-300
  },
};

/** Per-hop amounts in sats (derived from trace constants). */
const HOP_DATA: {
  channelId: string;
  amountSats: string;
  cltvExpiry: number;
}[] = [
  {
    // Alice -> Bob
    channelId: CHANNELS[0].shortChannelId,
    amountSats: formatSats(CANONICAL_TRACE.aliceSendAmountMsat),
    cltvExpiry: CANONICAL_TRACE.aliceSendCltvExpiry,
  },
  {
    // Bob -> Carol
    channelId: CHANNELS[1].shortChannelId,
    amountSats: formatSats(CANONICAL_TRACE.route[0].amtToForwardMsat),
    cltvExpiry: CANONICAL_TRACE.route[0].outgoingCltvValue,
  },
  {
    // Carol -> Dave
    channelId: CHANNELS[2].shortChannelId,
    amountSats: formatSats(CANONICAL_TRACE.route[1].amtToForwardMsat),
    cltvExpiry: CANONICAL_TRACE.route[1].outgoingCltvValue,
  },
];

function formatSats(msat: number): string {
  return (msat / 1000).toLocaleString("en-US") + " sats";
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Standard (non-compact) layout dimensions. */
const SVG_WIDTH = 760;
const SVG_HEIGHT = 200;
const NODE_RADIUS = 32;
const NODE_Y = 80;
const NODE_SPACING = 200; // horizontal distance between node centers
const START_X = 80; // leftmost node center

function nodeX(index: number): number {
  return START_X + index * NODE_SPACING;
}

// ---------------------------------------------------------------------------
// Sub-components (internal)
// ---------------------------------------------------------------------------

function NodeCircle({
  x,
  y,
  name,
  label,
  role,
  opacity,
  highlighted,
}: {
  x: number;
  y: number;
  name: NodeName;
  label: string;
  role: string;
  opacity: number;
  highlighted: boolean;
}) {
  const colors = NODE_COLORS[name];
  const r = highlighted ? NODE_RADIUS + 4 : NODE_RADIUS;

  return (
    <g
      style={{
        opacity,
        transition: "opacity 200ms ease, transform 200ms ease",
        filter: highlighted ? `drop-shadow(0 0 8px ${colors.fill}66)` : "none",
      }}
    >
      {/* Outer glow for highlighted node */}
      {highlighted && (
        <circle
          cx={x}
          cy={y}
          r={r + 4}
          fill="none"
          stroke={colors.fill}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}
      {/* Main circle */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={2.5}
      />
      {/* Node label */}
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={colors.text}
        fontSize={highlighted ? 15 : 13}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
      {/* Role label below */}
      <text
        x={x}
        y={y + r + 18}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={0.6}
        style={{ pointerEvents: "none" }}
      >
        {role}
      </text>
    </g>
  );
}

function ConnectionArrow({
  x1,
  x2,
  y,
  channelId,
  amountLabel,
  cltvLabel,
  showAmounts,
  showCltv,
  opacity,
  obscured,
}: {
  x1: number;
  x2: number;
  y: number;
  channelId: string;
  amountLabel: string;
  cltvLabel: string;
  showAmounts: boolean;
  showCltv: boolean;
  opacity: number;
  /** If true, show "???" instead of real values. */
  obscured: boolean;
}) {
  const startX = x1 + NODE_RADIUS + 8;
  const endX = x2 - NODE_RADIUS - 8;
  const midX = (startX + endX) / 2;
  const arrowSize = 6;

  return (
    <g
      style={{
        opacity,
        transition: "opacity 200ms ease",
      }}
    >
      {/* Line */}
      <line
        x1={startX}
        y1={y}
        x2={endX - arrowSize}
        y2={y}
        stroke="currentColor"
        strokeWidth={2}
        strokeOpacity={0.5}
      />
      {/* Arrowhead */}
      <polygon
        points={`${endX},${y} ${endX - arrowSize},${y - arrowSize / 2} ${endX - arrowSize},${y + arrowSize / 2}`}
        fill="currentColor"
        fillOpacity={0.5}
      />
      {/* Channel ID label (above line) */}
      <text
        x={midX}
        y={y - 12}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="currentColor"
        fontSize={9}
        fontFamily="system-ui, -apple-system, sans-serif"
        opacity={0.45}
        style={{ pointerEvents: "none" }}
      >
        {channelId}
      </text>
      {/* Amount label (below line) */}
      {showAmounts && (
        <text
          x={midX}
          y={y + 16}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="currentColor"
          fontSize={11}
          fontWeight={600}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={obscured ? 0.35 : 0.75}
          style={{ pointerEvents: "none" }}
        >
          {obscured ? "???" : amountLabel}
        </text>
      )}
      {/* CLTV label (below amount) */}
      {showCltv && (
        <text
          x={midX}
          y={y + (showAmounts ? 30 : 16)}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="currentColor"
          fontSize={10}
          fontFamily="system-ui, -apple-system, sans-serif"
          opacity={obscured ? 0.3 : 0.55}
          style={{ pointerEvents: "none" }}
        >
          {obscured ? "???" : cltvLabel}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RouteNetworkDiagram({
  className,
  showAmounts = true,
  showCltv = false,
  compact = false,
}: RouteNetworkDiagramProps) {
  const { view, canSee } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  // Pre-compute visibility for each node
  const nodeVisibility = useMemo(() => {
    return ROUTE_NODES.map((n) => {
      if (isOmniscient) {
        return { opacity: 1, highlighted: false };
      }
      // Node-local mode
      const isSelf = n.name === currentNode;
      const canObserve = currentNode
        ? canSee(currentNode, n.name)
        : false;

      if (isSelf) {
        return { opacity: 1, highlighted: true };
      }
      if (canObserve) {
        return { opacity: 0.85, highlighted: false };
      }
      // Not visible to this node
      return { opacity: 0.15, highlighted: false };
    });
  }, [isOmniscient, currentNode, canSee]);

  // Pre-compute visibility for each connection (edge between node i and i+1)
  const edgeVisibility = useMemo(() => {
    return HOP_DATA.map((_, i) => {
      if (isOmniscient) {
        return { opacity: 1, obscured: false };
      }
      const leftNode = ROUTE_NODES[i].name;
      const rightNode = ROUTE_NODES[i + 1].name;

      // Edge is visible if the current node can see BOTH endpoints
      const seesLeft = currentNode ? canSee(currentNode, leftNode) : false;
      const seesRight = currentNode ? canSee(currentNode, rightNode) : false;

      if (seesLeft && seesRight) {
        return { opacity: 0.85, obscured: false };
      }
      // Dimmed edge -- obscure the data
      return { opacity: 0.15, obscured: true };
    });
  }, [isOmniscient, currentNode, canSee]);

  const height = compact ? 160 : SVG_HEIGHT;
  const scale = compact ? 0.8 : 1;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${height}`}
      className={className}
      style={{
        width: "100%",
        maxWidth: compact ? 500 : SVG_WIDTH,
        height: "auto",
      }}
      role="img"
      aria-label="Lightning Network payment route: Alice to Bob to Carol to Dave"
    >
      <g transform={compact ? `scale(${scale}) translate(${(SVG_WIDTH * (1 - scale)) / (2 * scale)}, 0)` : undefined}>
        {/* Connections (render behind nodes) */}
        {HOP_DATA.map((hop, i) => (
          <ConnectionArrow
            key={hop.channelId}
            x1={nodeX(i)}
            x2={nodeX(i + 1)}
            y={NODE_Y}
            channelId={hop.channelId}
            amountLabel={hop.amountSats}
            cltvLabel={`CLTV ${hop.cltvExpiry.toLocaleString("en-US")}`}
            showAmounts={showAmounts}
            showCltv={showCltv}
            opacity={edgeVisibility[i].opacity}
            obscured={edgeVisibility[i].obscured}
          />
        ))}

        {/* Nodes */}
        {ROUTE_NODES.map((node, i) => (
          <NodeCircle
            key={node.name}
            x={nodeX(i)}
            y={NODE_Y}
            name={node.name}
            label={node.label}
            role={node.role}
            opacity={nodeVisibility[i].opacity}
            highlighted={nodeVisibility[i].highlighted}
          />
        ))}
      </g>
    </svg>
  );
}
