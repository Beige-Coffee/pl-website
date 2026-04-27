import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorBoomerangDiagramProps {
  className?: string;
  /** If true, show step-through buttons; if false, show all at once. */
  interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Node metadata -- colors matching PerspectiveToggle
// ---------------------------------------------------------------------------

interface DiagramNode {
  name: NodeName;
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  fillColor: string;
  strokeColor: string;
}

const NODES: DiagramNode[] = [
  {
    name: "alice",
    label: "Alice",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700 dark:text-blue-300",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    fillColor: "#3b82f6",
    strokeColor: "#2563eb",
  },
  {
    name: "bob",
    label: "Bob",
    dotClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-500/10 dark:bg-green-500/15",
    borderClass: "border-green-500/40",
    fillColor: "#22c55e",
    strokeColor: "#16a34a",
  },
  {
    name: "carol",
    label: "Carol",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/40",
    fillColor: "#f59e0b",
    strokeColor: "#d97706",
  },
  {
    name: "dave",
    label: "Dave",
    dotClass: "bg-purple-500",
    textClass: "text-purple-700 dark:text-purple-300",
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/40",
    fillColor: "#a855f7",
    strokeColor: "#9333ea",
  },
];

const NODE_INDEX: Record<NodeName, number> = {
  alice: 0,
  bob: 1,
  carol: 2,
  dave: 3,
};

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 760;
const SVG_HEIGHT = 400;
const NODE_RADIUS = 28;
const NODE_Y = 60;
const NODE_SPACING = 190;
const START_X = 80;

function nodeX(index: number): number {
  return START_X + index * NODE_SPACING;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

interface Step {
  title: string;
  description: string;
  /** Which nodes are involved (for perspective filtering) */
  involvedNodes: NodeName[];
}

const STEPS: Step[] = [
  {
    title: "Forward path: Alice \u2192 Bob \u2192 Carol \u2192 \u2717 Dave",
    description:
      "Alice sends the onion forward. Bob peels his layer and forwards to Carol. Carol peels her layer and tries to forward to Dave, but fails (insufficient liquidity).",
    involvedNodes: ["alice", "bob", "carol", "dave"],
  },
  {
    title: "Carol constructs error packet",
    description:
      "Carol builds a 288-byte error packet: failure code (0x1007) padded to 256 bytes, HMAC'd with her um key, then XOR'd with her ammag cipher stream.",
    involvedNodes: ["carol"],
  },
  {
    title: "Carol \u2192 Bob: update_fail_htlc",
    description:
      "Carol sends the encrypted error back to Bob. Bob can't read the contents. He XOR-wraps it with his own ammag cipher stream, adding another layer of obfuscation.",
    involvedNodes: ["carol", "bob"],
  },
  {
    title: "Bob \u2192 Alice: forwarding the wrapped error",
    description:
      "Bob forwards the doubly-wrapped error to Alice via update_fail_htlc. The error now has two layers of ammag encryption.",
    involvedNodes: ["bob", "alice"],
  },
  {
    title: "Alice unwraps layer by layer",
    description:
      "Alice XORs with Bob's ammag (removes one layer), checks Bob's um HMAC: no match. XORs with Carol's ammag (removes second layer), checks Carol's um HMAC: match! Carol generated the error.",
    involvedNodes: ["alice"],
  },
  {
    title: "Result: Carol failed with temporary_channel_failure",
    description:
      "Alice identifies Carol as the failing hop and reads the failure code 0x1007 (temporary_channel_failure). She can retry with a different route avoiding the Carol\u2013Dave channel.",
    involvedNodes: ["alice"],
  },
];

const MAX_STEP = STEPS.length;

const STEP_LABELS = [
  "Forward",
  "Construct",
  "C\u2192B",
  "B\u2192A",
  "Unwrap",
  "Result",
];

// ---------------------------------------------------------------------------
// Error packet visual state per step
// ---------------------------------------------------------------------------

/** Describes how the error packet looks at a given step */
interface PacketState {
  /** Where the packet is positioned (node index, or between nodes) */
  x: number;
  /** Layers of encryption shown */
  layers: { color: string; label: string }[];
  /** Whether the packet is visible at all */
  visible: boolean;
  /** Label to show on the packet */
  caption: string;
}

function getPacketState(step: number): PacketState {
  const carolX = nodeX(NODE_INDEX.carol);
  const bobX = nodeX(NODE_INDEX.bob);
  const aliceX = nodeX(NODE_INDEX.alice);

  switch (step) {
    case 1:
      // Forward path -- no error packet yet
      return { x: carolX, layers: [], visible: false, caption: "" };
    case 2:
      // Carol constructs error
      return {
        x: carolX,
        layers: [{ color: "#f59e0b", label: "Carol's ammag" }],
        visible: true,
        caption: "288 bytes",
      };
    case 3:
      // Error at Bob, he wraps it
      return {
        x: bobX,
        layers: [
          { color: "#f59e0b", label: "Carol's ammag" },
          { color: "#22c55e", label: "Bob's ammag" },
        ],
        visible: true,
        caption: "288 bytes",
      };
    case 4:
      // Error at Alice, doubly wrapped
      return {
        x: aliceX,
        layers: [
          { color: "#f59e0b", label: "Carol's ammag" },
          { color: "#22c55e", label: "Bob's ammag" },
        ],
        visible: true,
        caption: "288 bytes",
      };
    case 5:
      // Alice unwrapping
      return {
        x: aliceX,
        layers: [],
        visible: true,
        caption: "decrypted",
      };
    case 6:
      // Result
      return {
        x: aliceX,
        layers: [],
        visible: true,
        caption: "0x1007",
      };
    default:
      return { x: carolX, layers: [], visible: false, caption: "" };
  }
}

// ---------------------------------------------------------------------------
// Perspective helpers
// ---------------------------------------------------------------------------

function getStepVisibility(
  step: Step,
  isOmniscient: boolean,
  currentNode: NodeName | null,
): { dimmed: boolean; obscurePacket: boolean } {
  if (isOmniscient) return { dimmed: false, obscurePacket: false };
  if (!currentNode) return { dimmed: true, obscurePacket: true };

  const involved = step.involvedNodes.includes(currentNode);
  // Bob and Carol can't read the error contents
  const obscurePacket = currentNode === "bob" || currentNode === "dave";
  return { dimmed: !involved, obscurePacket };
}

/** Whether a node should be dimmed at a given step */
function getNodeDimState(
  nodeName: NodeName,
  stepIndex: number,
  isOmniscient: boolean,
  currentNode: NodeName | null,
): { opacity: number; highlighted: boolean; dimmed: boolean } {
  // Dave is always dimmed (payment never reached him) except in step 1
  if (nodeName === "dave" && stepIndex > 1) {
    if (isOmniscient) return { opacity: 0.25, highlighted: false, dimmed: true };
    if (currentNode === "dave") return { opacity: 0.5, highlighted: true, dimmed: true };
    return { opacity: 0.15, highlighted: false, dimmed: true };
  }

  if (isOmniscient) return { opacity: 1, highlighted: false, dimmed: false };
  if (!currentNode) return { opacity: 0.15, highlighted: false, dimmed: true };

  const isSelf = nodeName === currentNode;
  if (isSelf) return { opacity: 1, highlighted: true, dimmed: false };

  // Neighbors can be seen
  const neighbors: Record<NodeName, NodeName[]> = {
    alice: ["bob"],
    bob: ["alice", "carol"],
    carol: ["bob", "dave"],
    dave: ["carol"],
  };
  if (neighbors[currentNode].includes(nodeName)) {
    return { opacity: 0.7, highlighted: false, dimmed: false };
  }
  return { opacity: 0.15, highlighted: false, dimmed: true };
}

// ---------------------------------------------------------------------------
// SVG sub-components
// ---------------------------------------------------------------------------

function NodeCircle({
  x,
  y,
  node,
  opacity,
  highlighted,
}: {
  x: number;
  y: number;
  node: DiagramNode;
  opacity: number;
  highlighted: boolean;
}) {
  const r = highlighted ? NODE_RADIUS + 3 : NODE_RADIUS;
  return (
    <g
      style={{
        opacity,
        transition: "opacity 300ms ease",
        filter: highlighted
          ? `drop-shadow(0 0 8px ${node.fillColor}66)`
          : "none",
      }}
    >
      {highlighted && (
        <circle
          cx={x}
          cy={y}
          r={r + 4}
          fill="none"
          stroke={node.fillColor}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={node.fillColor}
        stroke={node.strokeColor}
        strokeWidth={2.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={highlighted ? 14 : 12}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {node.label}
      </text>
    </g>
  );
}

/** Forward arrows (dashed blue, going right) */
function ForwardArrows({ opacity }: { opacity: number }) {
  const y = NODE_Y;
  const arrowY = y;

  return (
    <g style={{ opacity, transition: "opacity 300ms ease" }}>
      {/* Alice -> Bob */}
      <line
        x1={nodeX(0) + NODE_RADIUS + 6}
        y1={arrowY}
        x2={nodeX(1) - NODE_RADIUS - 6}
        y2={arrowY}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <polygon
        points={`${nodeX(1) - NODE_RADIUS - 6},${arrowY} ${nodeX(1) - NODE_RADIUS - 14},${arrowY - 4} ${nodeX(1) - NODE_RADIUS - 14},${arrowY + 4}`}
        fill="#3b82f6"
      />
      {/* Bob -> Carol */}
      <line
        x1={nodeX(1) + NODE_RADIUS + 6}
        y1={arrowY}
        x2={nodeX(2) - NODE_RADIUS - 6}
        y2={arrowY}
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      <polygon
        points={`${nodeX(2) - NODE_RADIUS - 6},${arrowY} ${nodeX(2) - NODE_RADIUS - 14},${arrowY - 4} ${nodeX(2) - NODE_RADIUS - 14},${arrowY + 4}`}
        fill="#3b82f6"
      />
      {/* Carol -> Dave (with X) */}
      <line
        x1={nodeX(2) + NODE_RADIUS + 6}
        y1={arrowY}
        x2={nodeX(3) - NODE_RADIUS - 20}
        y2={arrowY}
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      {/* X mark */}
      <text
        x={nodeX(3) - NODE_RADIUS - 12}
        y={arrowY + 5}
        fill="#ef4444"
        fontSize={18}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
      >
        &#x2717;
      </text>
    </g>
  );
}

/** Error arrow between two nodes (going left, in the lower row) */
function ErrorArrow({
  fromIndex,
  toIndex,
  opacity,
  label,
}: {
  fromIndex: number;
  toIndex: number;
  opacity: number;
  label: string;
}) {
  const y = NODE_Y + 70;
  const x1 = nodeX(fromIndex) - NODE_RADIUS - 6;
  const x2 = nodeX(toIndex) + NODE_RADIUS + 6;

  return (
    <g style={{ opacity, transition: "opacity 300ms ease" }}>
      <line
        x1={x1}
        y1={y}
        x2={x2 + 8}
        y2={y}
        stroke="#f97316"
        strokeWidth={2.5}
      />
      {/* Arrowhead pointing left */}
      <polygon
        points={`${x2},${y} ${x2 + 8},${y - 4} ${x2 + 8},${y + 4}`}
        fill="#f97316"
      />
      {/* Label below arrow */}
      <text
        x={(nodeX(fromIndex) + nodeX(toIndex)) / 2}
        y={y + 16}
        textAnchor="middle"
        fill="#f97316"
        fontSize={10}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

/** Visual error packet with concentric layer rings */
function ErrorPacket({
  x,
  y,
  layers,
  caption,
  visible,
  obscured,
}: {
  x: number;
  y: number;
  layers: { color: string; label: string }[];
  caption: string;
  visible: boolean;
  obscured: boolean;
}) {
  if (!visible) return null;

  const baseWidth = 60;
  const baseHeight = 30;
  const layerPad = 6;

  // If obscured, show a "???" overlay
  const totalLayers = layers.length;
  const outerWidth = baseWidth + totalLayers * layerPad * 2;
  const outerHeight = baseHeight + totalLayers * layerPad * 2;

  return (
    <g
      style={{
        transition: "transform 300ms ease, opacity 300ms ease",
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Layer rectangles from outermost to innermost */}
      {[...layers].reverse().map((layer, i) => {
        const layerIdx = totalLayers - 1 - i;
        const w = baseWidth + (layerIdx + 1) * layerPad * 2;
        const h = baseHeight + (layerIdx + 1) * layerPad * 2;
        return (
          <rect
            key={i}
            x={x - w / 2}
            y={y - h / 2}
            width={w}
            height={h}
            rx={4}
            fill={layer.color}
            fillOpacity={0.15}
            stroke={layer.color}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
        );
      })}

      {/* Inner core rectangle */}
      <rect
        x={x - baseWidth / 2}
        y={y - baseHeight / 2}
        width={baseWidth}
        height={baseHeight}
        rx={3}
        fill={obscured ? "#6b7280" : "#f97316"}
        fillOpacity={0.2}
        stroke={obscured ? "#6b7280" : "#f97316"}
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />

      {/* Content text */}
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={10}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
        opacity={0.8}
      >
        {obscured ? "???" : caption}
      </text>

      {/* Layer labels to the side */}
      {!obscured &&
        layers.map((layer, i) => (
          <text
            key={i}
            x={x + outerWidth / 2 + 6}
            y={y - (totalLayers - 1) * 5 + i * 12}
            textAnchor="start"
            dominantBaseline="central"
            fill={layer.color}
            fontSize={9}
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{ pointerEvents: "none" }}
            opacity={0.8}
          >
            {layer.label}
          </text>
        ))}
    </g>
  );
}

/** Unwrapping visualization at Alice */
function UnwrapVisual({
  x,
  y,
  visible,
  obscured,
}: {
  x: number;
  y: number;
  visible: boolean;
  obscured: boolean;
}) {
  if (!visible) return null;

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      {/* Magnifying glass icon */}
      <circle
        cx={x}
        cy={y}
        r={22}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="4 3"
        opacity={0.5}
      />
      <line
        x1={x + 16}
        y1={y + 16}
        x2={x + 28}
        y2={y + 28}
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.5}
      />

      {/* Result text inside the magnifying glass */}
      <text
        x={x}
        y={y - 5}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#3b82f6"
        fontSize={9}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {obscured ? "???" : "HMAC"}
      </text>
      <text
        x={x}
        y={y + 7}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#3b82f6"
        fontSize={9}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {obscured ? "" : "match!"}
      </text>
    </g>
  );
}

/** Final result badge */
function ResultBadge({
  x,
  y,
  visible,
  obscured,
}: {
  x: number;
  y: number;
  visible: boolean;
  obscured: boolean;
}) {
  if (!visible) return null;

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      <rect
        x={x - 80}
        y={y - 16}
        width={160}
        height={32}
        rx={4}
        fill={obscured ? "#6b7280" : "#3b82f6"}
        fillOpacity={0.15}
        stroke={obscured ? "#6b7280" : "#3b82f6"}
        strokeWidth={2}
        strokeOpacity={0.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={obscured ? "#6b7280" : "#3b82f6"}
        fontSize={11}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}
      >
        {obscured ? "??? failed" : "Carol: 0x1007"}
      </text>

      {/* Arrow pointing to Carol */}
      {!obscured && (
        <>
          <line
            x1={x + 80}
            y1={y}
            x2={nodeX(NODE_INDEX.carol) - NODE_RADIUS - 6}
            y2={y - 40}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.5}
          />
          <text
            x={(x + 80 + nodeX(NODE_INDEX.carol) - NODE_RADIUS - 6) / 2 + 15}
            y={y - 24}
            textAnchor="middle"
            fill="#f59e0b"
            fontSize={9}
            fontFamily="system-ui, -apple-system, sans-serif"
            style={{ pointerEvents: "none" }}
            opacity={0.7}
          >
            failing hop
          </text>
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ErrorBoomerangDiagram({
  className,
  interactive = false,
}: ErrorBoomerangDiagramProps) {
  const { view } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  const [step, setStep] = useState(interactive ? 1 : MAX_STEP);
  const visibleStep = interactive ? step : MAX_STEP;

  // Per-step relevance
  const stepVis = useMemo(() => {
    return STEPS.map((s) => getStepVisibility(s, isOmniscient, currentNode));
  }, [isOmniscient, currentNode]);

  // Per-node dimming
  const nodeStates = useMemo(() => {
    return NODES.map((n) =>
      getNodeDimState(n.name, visibleStep, isOmniscient, currentNode),
    );
  }, [visibleStep, isOmniscient, currentNode]);

  const currentStepVis = stepVis[visibleStep - 1];
  const packetState = getPacketState(visibleStep);

  // Compute what's visible at the current step
  const showForwardArrows = visibleStep >= 1;
  const showCarolToBob = visibleStep >= 3;
  const showBobToAlice = visibleStep >= 4;
  const showPacket = packetState.visible;
  const showUnwrap = visibleStep === 5;
  const showResult = visibleStep === 6;

  // Error arrow opacity based on perspective
  const errorArrowOpacity = currentStepVis.dimmed ? 0.15 : 1;
  const forwardOpacity =
    visibleStep === 1 ? (currentStepVis.dimmed ? 0.15 : 0.8) : 0.25;

  // Packet Y position (below the error arrows, separated for clarity)
  const packetY = NODE_Y + 150;

  return (
    <div className={cn("w-full", className)}>
      {/* Step-through controls */}
      {interactive && (
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step <= 1}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-sans border-2 transition-colors duration-150",
              step <= 1
                ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "border-foreground text-foreground hover:bg-muted cursor-pointer",
            )}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => setStep(i + 1)}
                className={cn(
                  "h-2.5 w-2.5 border transition-all duration-200 cursor-pointer",
                  i < step
                    ? "bg-foreground border-foreground"
                    : "bg-transparent border-foreground/30",
                )}
                aria-label={`Step ${i + 1}: ${label}`}
                title={label}
              />
            ))}
            <span className="ml-2 text-xs font-sans text-muted-foreground">
              {step}/{MAX_STEP}
            </span>
          </div>

          <button
            onClick={() => setStep((s) => Math.min(MAX_STEP, s + 1))}
            disabled={step >= MAX_STEP}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-sans border-2 transition-colors duration-150",
              step >= MAX_STEP
                ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "border-foreground text-foreground hover:bg-muted cursor-pointer",
            )}
            aria-label="Next step"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Phase labels */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span
          className={cn(
            "font-sans text-[10px] sm:text-xs uppercase tracking-wider font-bold",
            visibleStep <= 1
              ? "text-blue-500 dark:text-blue-400"
              : "text-muted-foreground/40",
          )}
        >
          Forward path &#x2192;
        </span>
        <span
          className={cn(
            "font-sans text-[10px] sm:text-xs uppercase tracking-wider font-bold",
            visibleStep >= 2
              ? "text-orange-500 dark:text-orange-400"
              : "text-muted-foreground/40",
          )}
        >
          &#x2190; Error path
        </span>
      </div>

      {/* SVG diagram */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full"
        style={{ maxWidth: SVG_WIDTH, height: "auto" }}
        role="img"
        aria-label="Error packet propagation: Carol fails, error bounces back to Alice"
      >
        {/* Forward arrows (always visible but fade after step 1) */}
        {showForwardArrows && <ForwardArrows opacity={forwardOpacity} />}

        {/* Error arrows (going left) */}
        {showCarolToBob && (
          <ErrorArrow
            fromIndex={NODE_INDEX.carol}
            toIndex={NODE_INDEX.bob}
            opacity={
              visibleStep === 3 ? errorArrowOpacity : errorArrowOpacity * 0.4
            }
            label="update_fail_htlc"
          />
        )}
        {showBobToAlice && (
          <ErrorArrow
            fromIndex={NODE_INDEX.bob}
            toIndex={NODE_INDEX.alice}
            opacity={
              visibleStep === 4 ? errorArrowOpacity : errorArrowOpacity * 0.4
            }
            label="update_fail_htlc"
          />
        )}

        {/* Error packet visualization */}
        {showPacket && visibleStep >= 2 && visibleStep <= 4 && (
          <ErrorPacket
            x={packetState.x}
            y={packetY}
            layers={packetState.layers}
            caption={packetState.caption}
            visible={packetState.visible}
            obscured={currentStepVis.obscurePacket}
          />
        )}

        {/* Unwrap visualization */}
        {showUnwrap && (
          <UnwrapVisual
            x={nodeX(NODE_INDEX.alice)}
            y={packetY}
            visible={true}
            obscured={currentStepVis.obscurePacket}
          />
        )}

        {/* Result badge */}
        {showResult && (
          <ResultBadge
            x={nodeX(NODE_INDEX.alice) + 40}
            y={packetY}
            visible={true}
            obscured={currentStepVis.obscurePacket}
          />
        )}

        {/* Node circles */}
        {NODES.map((node, i) => (
          <NodeCircle
            key={node.name}
            x={nodeX(i)}
            y={NODE_Y}
            node={node}
            opacity={nodeStates[i].opacity}
            highlighted={nodeStates[i].highlighted}
          />
        ))}

        {/* Node role labels */}
        {NODES.map((node, i) => (
          <text
            key={`role-${node.name}`}
            x={nodeX(i)}
            y={NODE_Y + NODE_RADIUS + 16}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize={10}
            fontFamily="system-ui, -apple-system, sans-serif"
            opacity={nodeStates[i].opacity * 0.5}
            style={{ pointerEvents: "none" }}
          >
            {node.name === "alice"
              ? "Sender"
              : node.name === "dave"
                ? "Receiver"
                : node.name === "bob"
                  ? "Hop 1"
                  : "Hop 2"}
          </text>
        ))}
      </svg>

      {/* Step description */}
      <div
        className={cn(
          "border-l-2 px-3 py-2 mt-2 transition-all duration-300",
          visibleStep <= 1
            ? "border-blue-500/30 bg-blue-500/3 dark:bg-blue-500/5"
            : visibleStep <= 4
              ? "border-orange-500/30 bg-orange-500/3 dark:bg-orange-500/5"
              : "border-blue-500/30 bg-blue-500/3 dark:bg-blue-500/5",
          currentStepVis.dimmed ? "opacity-20" : "opacity-100",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs sm:text-sm font-bold text-foreground">
            {visibleStep}. {STEPS[visibleStep - 1].title}
          </span>
        </div>
        <p className="font-sans text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">
          {STEPS[visibleStep - 1].description}
        </p>
      </div>

      {/* Summary line */}
      <div
        className={cn(
          "mt-4 text-center font-sans text-sm transition-all duration-200",
          visibleStep >= MAX_STEP
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2",
        )}
      >
        <span className="text-muted-foreground">
          Error propagation: same 288-byte packet, XOR-wrapped at each hop,
          HMAC-checked by Alice
        </span>
      </div>
    </div>
  );
}
