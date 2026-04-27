import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { CANONICAL_TRACE, CHANNELS } from "@/data/onion-routing-constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackwardCalcDiagramProps {
  className?: string;
  /** If true, show step-through buttons; if false, show all at once. */
  interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Node metadata -- colors matching PerspectiveToggle
// ---------------------------------------------------------------------------

interface WaterfallNode {
  name: NodeName;
  label: string;
  role: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  /** Amount in msat this node sends (or receives, for Dave). */
  amountMsat: number;
  /** CLTV expiry at this node. */
  cltvExpiry: number;
  /** Fee earned by this node in msat (0 for Dave and Alice). */
  feeMsat: number;
  /** Human-readable fee calculation formula (empty for Dave). */
  feeFormula: string;
  /** CLTV delta added at this node (0 for Dave). */
  cltvDelta: number;
}

// Build waterfall rows from constants (backward order: Dave at top, Alice at bottom)
const WATERFALL_NODES: WaterfallNode[] = [
  {
    name: "dave",
    label: "Dave",
    role: "Receiver",
    dotClass: "bg-purple-500",
    borderClass: "border-purple-500/40",
    bgClass: "bg-purple-500/5 dark:bg-purple-500/10",
    textClass: "text-purple-700 dark:text-purple-300",
    amountMsat: CANONICAL_TRACE.route[2].amtToForwardMsat,
    cltvExpiry: CANONICAL_TRACE.route[2].outgoingCltvValue,
    feeMsat: 0,
    feeFormula: "",
    cltvDelta: 0,
  },
  {
    name: "carol",
    label: "Carol",
    role: "Hop 2",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-500/40",
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
    textClass: "text-amber-700 dark:text-amber-300",
    amountMsat: CANONICAL_TRACE.route[1].amtToForwardMsat, // Carol forwards 50,000,000 to Dave
    cltvExpiry: CANONICAL_TRACE.route[1].outgoingCltvValue, // Carol's outgoing CLTV = 700,018
    feeMsat: 3_000,
    feeFormula: "500 + floor(50,000,000 \u00d7 50 / 1,000,000) = 3,000 msat",
    cltvDelta: CHANNELS[2].policy1to2.cltvExpiryDelta, // Carol's delta = 30
  },
  {
    name: "bob",
    label: "Bob",
    role: "Hop 1",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    textClass: "text-green-700 dark:text-green-300",
    amountMsat: CANONICAL_TRACE.route[0].amtToForwardMsat, // Bob forwards 50,003,000 to Carol
    cltvExpiry: CANONICAL_TRACE.route[0].outgoingCltvValue, // Bob's outgoing CLTV = 700,048
    feeMsat: 6_000,
    feeFormula: "1,000 + floor(50,003,000 \u00d7 100 / 1,000,000) = 6,000 msat",
    cltvDelta: CHANNELS[1].policy1to2.cltvExpiryDelta, // Bob's delta = 40
  },
  {
    name: "alice",
    label: "Alice",
    role: "Sender",
    dotClass: "bg-blue-500",
    borderClass: "border-blue-500/40",
    bgClass: "bg-blue-500/5 dark:bg-blue-500/10",
    textClass: "text-blue-700 dark:text-blue-300",
    amountMsat: CANONICAL_TRACE.aliceSendAmountMsat, // 50,009,000
    cltvExpiry: CANONICAL_TRACE.aliceSendCltvExpiry, // 700,088
    feeMsat: 0,
    feeFormula: "",
    cltvDelta: 0,
  },
];

const MAX_STEP = WATERFALL_NODES.length; // 4

function formatMsat(msat: number): string {
  return (msat / 1000).toLocaleString("en-US") + " sats";
}

function formatMsatRaw(msat: number): string {
  return msat.toLocaleString("en-US") + " msat";
}

function formatCltv(cltv: number): string {
  return cltv.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** The connector between two waterfall rows showing fee/delta additions. */
function FeeConnector({
  node,
  visible,
  obscured,
}: {
  node: WaterfallNode;
  visible: boolean;
  obscured: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 py-2 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
      )}
    >
      {/* Downward arrow */}
      <div className="flex flex-col items-center text-muted-foreground">
        <div className="w-px h-3 bg-current opacity-40" />
        <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
          <path d="M6 8L0 0h12z" fill="currentColor" />
        </svg>
      </div>

      {/* Fee + CLTV delta labels */}
      <div className="text-center space-y-0.5">
        {node.feeMsat > 0 && (
          <p className="text-xs font-sans text-muted-foreground">
            {obscured ? (
              <span className="opacity-40">+ ??? fee</span>
            ) : (
              <>
                <span className={cn("font-semibold", node.textClass)}>
                  {node.label}&apos;s fee:
                </span>{" "}
                <span className="opacity-80">{node.feeFormula}</span>
              </>
            )}
          </p>
        )}
        {node.cltvDelta > 0 && (
          <p className="text-xs font-sans text-muted-foreground">
            {obscured ? (
              <span className="opacity-40">+ ??? CLTV delta</span>
            ) : (
              <>
                <span className={cn("font-semibold", node.textClass)}>
                  {node.label}&apos;s CLTV delta:
                </span>{" "}
                <span className="opacity-80">+{node.cltvDelta} blocks</span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** A single waterfall row for one node. */
function WaterfallRow({
  node,
  visible,
  opacity,
  highlighted,
  obscured,
}: {
  node: WaterfallNode;
  visible: boolean;
  opacity: number;
  highlighted: boolean;
  obscured: boolean;
}) {
  return (
    <div
      className={cn(
        "border-2 px-4 py-3 transition-all duration-200",
        node.bgClass,
        highlighted ? cn(node.borderClass, "border-2") : "border-transparent",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none h-0 py-0 overflow-hidden",
      )}
      style={{
        opacity: visible ? opacity : 0,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Left: node identity */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-3 w-3 shrink-0 border border-foreground/30",
              node.dotClass,
            )}
          />
          <span className={cn("font-sans font-bold text-sm", node.textClass)}>
            {node.label}
          </span>
          <span className="text-xs text-muted-foreground font-sans">
            ({node.role})
          </span>
        </div>

        {/* Right: amounts */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-sans text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Amt:
            </span>
            <span className={cn("font-semibold", obscured && "opacity-40")}>
              {obscured ? "???" : formatMsat(node.amountMsat)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              CLTV:
            </span>
            <span className={cn("font-semibold", obscured && "opacity-40")}>
              {obscured ? "???" : formatCltv(node.cltvExpiry)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              Fee:
            </span>
            <span
              className={cn(
                "font-semibold",
                obscured && "opacity-40",
                node.feeMsat === 0 && !obscured && "text-muted-foreground",
              )}
            >
              {obscured
                ? "???"
                : node.feeMsat > 0
                  ? "+" + formatMsatRaw(node.feeMsat)
                  : node.name === "alice"
                    ? "Sender"
                    : "None"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BackwardCalcDiagram({
  className,
  interactive = false,
}: BackwardCalcDiagramProps) {
  const { view, canSee } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  // Step state: 1-4 (how many rows are visible)
  const [step, setStep] = useState(MAX_STEP);

  const visibleCount = interactive ? step : MAX_STEP;

  // Compute per-row visibility based on perspective
  const rowVisibility = useMemo(() => {
    return WATERFALL_NODES.map((node) => {
      if (isOmniscient) {
        return { opacity: 1, highlighted: false, obscured: false };
      }
      if (!currentNode) {
        return { opacity: 0.15, highlighted: false, obscured: true };
      }

      const isSelf = node.name === currentNode;
      const canObserve = canSee(currentNode, node.name);

      if (isSelf) {
        return { opacity: 1, highlighted: true, obscured: false };
      }
      if (canObserve) {
        return { opacity: 0.85, highlighted: false, obscured: false };
      }
      return { opacity: 0.15, highlighted: false, obscured: true };
    });
  }, [isOmniscient, currentNode, canSee]);

  // Step labels for the stepper
  const stepLabels = [
    "Dave (start)",
    "Carol's fee",
    "Bob's fee",
    "Alice (total)",
  ];

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
            {stepLabels.map((label, i) => (
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

      {/* Waterfall rows */}
      <div className="space-y-0">
        {WATERFALL_NODES.map((node, i) => {
          const isVisible = i < visibleCount;
          const vis = rowVisibility[i];

          return (
            <div key={node.name}>
              {/* Fee connector (between rows, not before the first) */}
              {i > 0 && (
                <FeeConnector
                  node={node}
                  visible={isVisible}
                  obscured={vis.obscured}
                />
              )}

              <WaterfallRow
                node={node}
                visible={isVisible}
                opacity={vis.opacity}
                highlighted={vis.highlighted}
                obscured={vis.obscured}
              />
            </div>
          );
        })}
      </div>

      {/* Total summary (visible when all steps shown) */}
      <div
        className={cn(
          "mt-4 text-center font-sans text-sm transition-all duration-200",
          visibleCount >= MAX_STEP
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2",
        )}
      >
        <span className="text-muted-foreground">Total fees: </span>
        <span className="font-bold">
          {isOmniscient || currentNode === "alice"
            ? formatMsatRaw(CANONICAL_TRACE.totalFeeMsat) +
              " (" +
              (CANONICAL_TRACE.totalFeeMsat / 1000).toLocaleString("en-US") +
              " sats)"
            : "???"}
        </span>
      </div>
    </div>
  );
}
