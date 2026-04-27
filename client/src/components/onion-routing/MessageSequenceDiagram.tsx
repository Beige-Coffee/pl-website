import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessageSequenceDiagramProps {
  className?: string;
  /** If true, show step-through buttons; if false, show all at once. */
  interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Node metadata -- colors matching PerspectiveToggle
// ---------------------------------------------------------------------------

interface LifelineNode {
  name: NodeName;
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

const LIFELINES: LifelineNode[] = [
  {
    name: "alice",
    label: "Alice",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700 dark:text-blue-300",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
  },
  {
    name: "bob",
    label: "Bob",
    dotClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-500/10 dark:bg-green-500/15",
    borderClass: "border-green-500/40",
  },
  {
    name: "carol",
    label: "Carol",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/40",
  },
  {
    name: "dave",
    label: "Dave",
    dotClass: "bg-purple-500",
    textClass: "text-purple-700 dark:text-purple-300",
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/40",
  },
];

// Map node name to column index (0-3)
const NODE_COL: Record<NodeName, number> = {
  alice: 0,
  bob: 1,
  carol: 2,
  dave: 3,
};

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type MessagePhase = "forward" | "fulfill";

interface StepGroup {
  /** Step title shown above the arrow */
  title: string;
  /** Longer description shown below */
  description: string;
  /** The primary message arrow */
  from: NodeName;
  to: NodeName;
  /** The primary message name */
  primaryMessage: string;
  /** Phase: forward (adding HTLC) or fulfill (preimage propagation) */
  phase: MessagePhase;
  /** Which nodes are involved (for perspective filtering) */
  involvedNodes: NodeName[];
  /** Whether this is a "special" step (like Dave receiving payment) */
  isSpecial?: boolean;
}

const STEPS: StepGroup[] = [
  {
    title: "Alice \u2192 Bob: Add HTLC",
    description:
      "Alice sends update_add_htlc with the onion packet, then both sides run the commitment dance to lock in the new HTLC.",
    from: "alice",
    to: "bob",
    primaryMessage: "update_add_htlc",
    phase: "forward",
    involvedNodes: ["alice", "bob"],
  },
  {
    title: "Bob \u2192 Carol: Forward HTLC",
    description:
      "Bob peels his onion layer, discovers Carol is the next hop, and forwards the HTLC with the inner onion. Commitment dance follows.",
    from: "bob",
    to: "carol",
    primaryMessage: "update_add_htlc",
    phase: "forward",
    involvedNodes: ["bob", "carol"],
  },
  {
    title: "Carol \u2192 Dave: Forward HTLC",
    description:
      "Carol peels her layer, finds Dave is the next hop, and forwards. Commitment dance locks it in.",
    from: "carol",
    to: "dave",
    primaryMessage: "update_add_htlc",
    phase: "forward",
    involvedNodes: ["carol", "dave"],
  },
  {
    title: "Dave: Payment received!",
    description:
      "Dave peels the final onion layer, finds the all-zero HMAC (final hop indicator), and extracts the preimage from the payment hash.",
    from: "dave",
    to: "dave",
    primaryMessage: "preimage revealed",
    phase: "fulfill",
    involvedNodes: ["dave"],
    isSpecial: true,
  },
  {
    title: "Dave \u2192 Carol: Fulfill",
    description:
      "Dave sends update_fulfill_htlc with the preimage. Commitment dance removes the HTLC and credits Carol.",
    from: "dave",
    to: "carol",
    primaryMessage: "update_fulfill_htlc",
    phase: "fulfill",
    involvedNodes: ["dave", "carol"],
  },
  {
    title: "Carol \u2192 Bob: Fulfill",
    description:
      "Carol forwards the preimage backward. Commitment dance settles the HTLC between Carol and Bob.",
    from: "carol",
    to: "bob",
    primaryMessage: "update_fulfill_htlc",
    phase: "fulfill",
    involvedNodes: ["carol", "bob"],
  },
  {
    title: "Bob \u2192 Alice: Fulfill",
    description:
      "Bob forwards the preimage to Alice. Final commitment dance settles the payment. Alice has paid, Dave has been paid!",
    from: "bob",
    to: "alice",
    primaryMessage: "update_fulfill_htlc",
    phase: "fulfill",
    involvedNodes: ["bob", "alice"],
  },
];

const MAX_STEP = STEPS.length; // 7

// ---------------------------------------------------------------------------
// Step labels for the dot stepper
// ---------------------------------------------------------------------------

const STEP_LABELS = [
  "Add HTLC: A\u2192B",
  "Forward: B\u2192C",
  "Forward: C\u2192D",
  "Dave receives",
  "Fulfill: D\u2192C",
  "Fulfill: C\u2192B",
  "Fulfill: B\u2192A",
];

// ---------------------------------------------------------------------------
// Perspective helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a step is relevant to the current perspective.
 * Returns { visible, dimmed } where dimmed means the step shows but at low opacity.
 */
function getStepRelevance(
  step: StepGroup,
  isOmniscient: boolean,
  currentNode: NodeName | null,
): { visible: boolean; dimmed: boolean } {
  if (isOmniscient) {
    return { visible: true, dimmed: false };
  }
  if (!currentNode) {
    return { visible: true, dimmed: true };
  }
  // A step is relevant if the current node is involved
  const involved = step.involvedNodes.includes(currentNode);
  return { visible: true, dimmed: !involved };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Lifeline header with colored dot and label */
function LifelineHeader({
  node,
  highlighted,
}: {
  node: LifelineNode;
  highlighted: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-1 py-2 transition-all duration-200",
        highlighted ? "opacity-100" : "opacity-70",
      )}
    >
      <span
        className={cn(
          "inline-block h-3 w-3 shrink-0 border border-foreground/30",
          node.dotClass,
        )}
      />
      <span
        className={cn(
          "font-sans font-bold text-xs sm:text-sm",
          node.textClass,
        )}
      >
        {node.label}
      </span>
    </div>
  );
}

/** Horizontal message arrow between two lifeline columns */
function MessageArrow({
  step,
  visible,
  dimmed,
  colCount,
}: {
  step: StepGroup;
  visible: boolean;
  dimmed: boolean;
  colCount: number;
}) {
  if (!visible) return null;

  const isForward = step.phase === "forward";
  const isSpecial = step.isSpecial;

  // Arrow color based on message type
  const arrowColorClass = isSpecial
    ? "text-purple-500"
    : isForward
      ? "text-blue-500 dark:text-blue-400"
      : "text-emerald-500 dark:text-emerald-400";

  const commitDanceColor = isForward
    ? "text-blue-400/60 dark:text-blue-500/40"
    : "text-emerald-400/60 dark:text-emerald-500/40";

  const fromCol = NODE_COL[step.from];
  const toCol = NODE_COL[step.to];

  // For the "special" Dave step, render a centered indicator
  if (isSpecial) {
    const leftPct = ((fromCol + 0.5) / colCount) * 100;
    return (
      <div
        className={cn(
          "relative w-full transition-all duration-300",
          dimmed ? "opacity-20" : "opacity-100",
        )}
        style={{ height: "56px" }}
      >
        {/* Special indicator at Dave's column */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{
            left: `${leftPct}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className="text-lg">&#x1F511;</span>
          <span
            className={cn(
              "font-sans text-[9px] sm:text-[10px] whitespace-nowrap",
              arrowColorClass,
            )}
          >
            {step.primaryMessage}
          </span>
        </div>
      </div>
    );
  }

  // Calculate horizontal positions for the arrow
  const leftCol = Math.min(fromCol, toCol);
  const rightCol = Math.max(fromCol, toCol);
  const goingRight = toCol > fromCol;

  const leftPct = ((leftCol + 0.5) / colCount) * 100;
  const rightPct = ((rightCol + 0.5) / colCount) * 100;

  return (
    <div
      className={cn(
        "relative w-full transition-all duration-300",
        dimmed ? "opacity-20" : "opacity-100",
      )}
      style={{ height: "56px" }}
    >
      {/* Primary message arrow */}
      <div
        className="absolute"
        style={{
          left: `${leftPct}%`,
          right: `${100 - rightPct}%`,
          top: "12px",
        }}
      >
        {/* Arrow line */}
        <div className="relative w-full flex items-center">
          <div
            className={cn("w-full h-[2px]", arrowColorClass)}
            style={{ backgroundColor: "currentColor" }}
          />
          {/* Arrowhead */}
          <svg
            width="8"
            height="10"
            viewBox="0 0 8 10"
            className={cn("absolute shrink-0", arrowColorClass)}
            style={{
              [goingRight ? "right" : "left"]: "-4px",
              transform: goingRight ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <path d="M0 0L8 5L0 10Z" fill="currentColor" />
          </svg>
        </div>
        {/* Primary message label */}
        <div className="flex justify-center mt-0.5">
          <span
            className={cn(
              "font-sans text-[9px] sm:text-[10px] font-semibold whitespace-nowrap",
              arrowColorClass,
            )}
          >
            {step.primaryMessage}
          </span>
        </div>
      </div>

      {/* Commitment dance compact indicator */}
      <div
        className="absolute flex justify-center"
        style={{
          left: `${leftPct}%`,
          right: `${100 - rightPct}%`,
          top: "36px",
        }}
      >
        <span
          className={cn(
            "font-sans text-[8px] sm:text-[9px] whitespace-nowrap",
            commitDanceColor,
          )}
        >
          &#x27F3; commitment dance (4 msgs)
        </span>
      </div>
    </div>
  );
}

/** A single step row in the ladder diagram */
function StepRow({
  step,
  stepIndex,
  visible,
  dimmed,
}: {
  step: StepGroup;
  stepIndex: number;
  visible: boolean;
  dimmed: boolean;
}) {
  const isForward = step.phase === "forward";
  const phaseBgClass = step.isSpecial
    ? "bg-purple-500/5 dark:bg-purple-500/10"
    : isForward
      ? "bg-blue-500/3 dark:bg-blue-500/5"
      : "bg-emerald-500/3 dark:bg-emerald-500/5";

  return (
    <div
      className={cn(
        "transition-all duration-300",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden",
      )}
    >
      {/* Step label + description */}
      <div
        className={cn(
          "border-l-2 px-3 py-2 mb-1",
          phaseBgClass,
          step.isSpecial
            ? "border-purple-500/40"
            : isForward
              ? "border-blue-500/30"
              : "border-emerald-500/30",
          dimmed ? "opacity-20" : "opacity-100",
          "transition-opacity duration-300",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs sm:text-sm font-bold text-foreground">
            {stepIndex + 1}. {step.title}
          </span>
        </div>
        <p className="font-sans text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Arrow area with lifeline grid */}
      <MessageArrow
        step={step}
        visible={visible}
        dimmed={dimmed}
        colCount={LIFELINES.length}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MessageSequenceDiagram({
  className,
  interactive = false,
}: MessageSequenceDiagramProps) {
  const { view } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  // Step state: 1..MAX_STEP (how many steps are visible)
  const [step, setStep] = useState(interactive ? 1 : MAX_STEP);
  const visibleCount = interactive ? step : MAX_STEP;

  // Compute per-step relevance based on perspective
  const stepRelevance = useMemo(() => {
    return STEPS.map((s) => getStepRelevance(s, isOmniscient, currentNode));
  }, [isOmniscient, currentNode]);

  // Determine which lifeline headers are highlighted
  const lifelineHighlighted = useMemo(() => {
    if (isOmniscient) return LIFELINES.map(() => true);
    if (!currentNode) return LIFELINES.map(() => false);
    return LIFELINES.map((l) => l.name === currentNode);
  }, [isOmniscient, currentNode]);

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
            visibleCount <= 3
              ? "text-blue-500 dark:text-blue-400"
              : "text-muted-foreground/40",
          )}
        >
          Forward path &#x2192;
        </span>
        <span
          className={cn(
            "font-sans text-[10px] sm:text-xs uppercase tracking-wider font-bold",
            visibleCount >= 5
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-muted-foreground/40",
          )}
        >
          &#x2190; Fulfill path
        </span>
      </div>

      {/* Lifeline headers */}
      <div className="grid grid-cols-4 gap-0 mb-1 border-b-2 border-foreground/10">
        {LIFELINES.map((node, i) => (
          <LifelineHeader
            key={node.name}
            node={node}
            highlighted={lifelineHighlighted[i]}
          />
        ))}
      </div>

      {/* Vertical lifelines + step rows */}
      <div className="relative">
        {/* Vertical lifeline lines (drawn behind the step rows) */}
        <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
          {LIFELINES.map((node, i) => (
            <div key={node.name} className="flex justify-center">
              <div
                className={cn(
                  "w-px h-full transition-opacity duration-200",
                  lifelineHighlighted[i]
                    ? "opacity-30"
                    : "opacity-10",
                )}
                style={{ backgroundColor: "currentColor" }}
              />
            </div>
          ))}
        </div>

        {/* Step rows */}
        <div className="relative z-10 space-y-1">
          {STEPS.map((s, i) => {
            const isVisible = i < visibleCount;
            const relevance = stepRelevance[i];

            return (
              <StepRow
                key={i}
                step={s}
                stepIndex={i}
                visible={isVisible}
                dimmed={relevance.dimmed}
              />
            );
          })}
        </div>
      </div>

      {/* Summary line */}
      <div
        className={cn(
          "mt-4 text-center font-sans text-sm transition-all duration-200",
          visibleCount >= MAX_STEP
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2",
        )}
      >
        <span className="text-muted-foreground">
          30 messages total: 5 per hop &times; 3 hops &times; 2 directions (add + fulfill)
        </span>
      </div>
    </div>
  );
}
