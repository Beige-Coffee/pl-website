import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnionPeelingDiagramProps {
  className?: string;
  /** If true, show step-through buttons; if false, show all at once. */
  interactive?: boolean;
}

interface PacketSegment {
  label: string;
  /** Short label for narrow segments on mobile */
  shortLabel?: string;
  /** Tailwind color classes for the segment background */
  bgClass: string;
  /** Width as percentage of the total bar */
  widthPct: number;
  /** If true, show an encrypted pattern overlay */
  encrypted?: boolean;
  /** If true, show a striped/hatched pattern (for filler/zeros) */
  filler?: boolean;
  /** Which node "owns" this segment (for perspective filtering) */
  owner?: NodeName;
}

interface PeelStep {
  /** Step title */
  label: string;
  /** Longer description under the bar */
  description: string;
  /** Which hop this step belongs to (undefined for initial/final) */
  node?: NodeName;
  /** Color classes for the step header */
  textClass?: string;
  dotClass?: string;
  borderClass?: string;
  bgClass?: string;
  /** Segments that make up the packet bar at this step */
  segments: PacketSegment[];
  /** Total byte count label shown at the right of the bar */
  totalBytes: string;
  /** If true, show an HMAC verification indicator */
  hmacCheck?: boolean;
}

// ---------------------------------------------------------------------------
// Step definitions (Bob peeling one layer)
// ---------------------------------------------------------------------------

const STEPS: PeelStep[] = [
  // Step 1: Receive the packet
  {
    label: "Step 1: Receive Onion Packet",
    description:
      "Bob receives the 1,366-byte onion packet from Alice and parses it into four fields.",
    node: "bob",
    textClass: "text-green-700 dark:text-green-300",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    totalBytes: "1,366 bytes",
    segments: [
      {
        label: "Ver",
        bgClass: "bg-gray-500 dark:bg-gray-400",
        widthPct: 2,
      },
      {
        label: "Ephemeral Key",
        shortLabel: "Key",
        bgClass: "bg-blue-500",
        widthPct: 5,
      },
      {
        label: "Encrypted routing info",
        shortLabel: "Routing info",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 83,
        encrypted: true,
      },
      {
        label: "HMAC",
        bgClass: "bg-orange-500",
        widthPct: 10,
      },
    ],
  },

  // Step 2: Verify HMAC
  {
    label: "Step 2: Verify HMAC",
    description:
      "Bob derives mu_key from the shared secret, computes HMAC-SHA256(mu_key, routing_info || assoc_data), and checks it matches the packet's HMAC.",
    node: "bob",
    textClass: "text-green-700 dark:text-green-300",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    totalBytes: "1,366 bytes",
    hmacCheck: true,
    segments: [
      {
        label: "Ver",
        bgClass: "bg-gray-500 dark:bg-gray-400",
        widthPct: 2,
      },
      {
        label: "Ephemeral Key",
        shortLabel: "Key",
        bgClass: "bg-blue-500",
        widthPct: 5,
      },
      {
        label: "Encrypted routing info",
        shortLabel: "Routing info",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 83,
        encrypted: true,
      },
      {
        label: "HMAC verified",
        shortLabel: "HMAC",
        bgClass: "bg-emerald-500",
        widthPct: 10,
      },
    ],
  },

  // Step 3: Decrypt routing info
  {
    label: "Step 3: Decrypt Routing Info",
    description:
      "Bob XOR-decrypts the 1,300 bytes with the rho cipher stream. His plaintext payload is now visible at the front, with downstream layers still encrypted.",
    node: "bob",
    textClass: "text-green-700 dark:text-green-300",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    totalBytes: "1,300 bytes",
    segments: [
      {
        label: "Bob's payload",
        shortLabel: "Payload",
        bgClass: "bg-green-500",
        widthPct: 6,
        owner: "bob",
      },
      {
        label: "Next HMAC",
        shortLabel: "HMAC",
        bgClass: "bg-orange-400 dark:bg-orange-500",
        widthPct: 4,
      },
      {
        label: "Carol's layer (encrypted)",
        shortLabel: "Carol",
        bgClass: "bg-amber-400/60 dark:bg-amber-500/40",
        widthPct: 14,
        encrypted: true,
        owner: "carol",
      },
      {
        label: "Dave's layer (encrypted)",
        shortLabel: "Dave",
        bgClass: "bg-purple-400/60 dark:bg-purple-500/40",
        widthPct: 12,
        encrypted: true,
        owner: "dave",
      },
      {
        label: "Encrypted padding",
        shortLabel: "Padding",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 64,
        encrypted: true,
      },
    ],
  },

  // Step 4: Extract payload
  {
    label: "Step 4: Extract Payload",
    description:
      "Bob reads his TLV payload (amt_to_forward, outgoing_cltv, short_channel_id) from the front, plus the next 32-byte HMAC for Carol.",
    node: "bob",
    textClass: "text-green-700 dark:text-green-300",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    totalBytes: "1,300 bytes",
    segments: [
      {
        label: "Bob's payload (extracted)",
        shortLabel: "Payload",
        bgClass: "bg-green-500 border-2 border-green-300 border-dashed",
        widthPct: 6,
        owner: "bob",
      },
      {
        label: "Next HMAC (extracted)",
        shortLabel: "HMAC",
        bgClass: "bg-orange-500 border-2 border-orange-300 border-dashed",
        widthPct: 4,
      },
      {
        label: "Carol's layer (encrypted)",
        shortLabel: "Carol",
        bgClass: "bg-amber-400/60 dark:bg-amber-500/40",
        widthPct: 14,
        encrypted: true,
        owner: "carol",
      },
      {
        label: "Dave's layer (encrypted)",
        shortLabel: "Dave",
        bgClass: "bg-purple-400/60 dark:bg-purple-500/40",
        widthPct: 12,
        encrypted: true,
        owner: "dave",
      },
      {
        label: "Encrypted padding",
        shortLabel: "Padding",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 64,
        encrypted: true,
      },
    ],
  },

  // Step 5: Left-shift and pad
  {
    label: "Step 5: Left-Shift and Pad",
    description:
      "Bob removes his payload + HMAC from the front, shifts remaining data left, and pads the right with zeros. The routing info stays exactly 1,300 bytes.",
    node: "bob",
    textClass: "text-green-700 dark:text-green-300",
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    totalBytes: "1,300 bytes",
    segments: [
      {
        label: "Carol's layer (encrypted)",
        shortLabel: "Carol",
        bgClass: "bg-amber-400/60 dark:bg-amber-500/40",
        widthPct: 16,
        encrypted: true,
        owner: "carol",
      },
      {
        label: "Dave's layer (encrypted)",
        shortLabel: "Dave",
        bgClass: "bg-purple-400/60 dark:bg-purple-500/40",
        widthPct: 14,
        encrypted: true,
        owner: "dave",
      },
      {
        label: "Encrypted padding",
        shortLabel: "Padding",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 58,
        encrypted: true,
      },
      {
        label: "Zero padding",
        shortLabel: "Zeros",
        bgClass: "bg-gray-300 dark:bg-gray-600",
        widthPct: 12,
        filler: true,
      },
    ],
  },

  // Step 6: Forward to Carol
  {
    label: "Step 6: Forward to Carol",
    description:
      "Assemble the next packet: version + blinded ephemeral key + shifted routing info + next HMAC = 1,366 bytes. Carol sees the same fixed-size packet.",
    node: "carol",
    textClass: "text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-500/40",
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
    totalBytes: "1,366 bytes",
    segments: [
      {
        label: "Ver",
        bgClass: "bg-gray-500 dark:bg-gray-400",
        widthPct: 2,
      },
      {
        label: "Blinded Key",
        shortLabel: "Key",
        bgClass: "bg-blue-500",
        widthPct: 5,
      },
      {
        label: "Carol's layer",
        shortLabel: "Carol",
        bgClass: "bg-amber-500/80",
        widthPct: 12,
        owner: "carol",
      },
      {
        label: "Dave's layer",
        shortLabel: "Dave",
        bgClass: "bg-purple-500/60",
        widthPct: 10,
        encrypted: true,
        owner: "dave",
      },
      {
        label: "Encrypted padding",
        shortLabel: "Pad",
        bgClass: "bg-gray-400 dark:bg-gray-500",
        widthPct: 55,
        encrypted: true,
      },
      {
        label: "Zero padding",
        shortLabel: "Zeros",
        bgClass: "bg-gray-300 dark:bg-gray-600",
        widthPct: 6,
        filler: true,
      },
      {
        label: "Next HMAC",
        shortLabel: "HMAC",
        bgClass: "bg-orange-500",
        widthPct: 10,
      },
    ],
  },
];

const MAX_STEP = STEPS.length; // 6

// ---------------------------------------------------------------------------
// Perspective helpers
// ---------------------------------------------------------------------------

/** Determine whether a step should be visible/obscured based on the current perspective. */
function getStepVisibility(
  _stepIndex: number,
  step: PeelStep,
  isOmniscient: boolean,
  currentNode: NodeName | null,
): { visible: boolean; obscured: boolean; highlighted: boolean } {
  if (isOmniscient) {
    return { visible: true, obscured: false, highlighted: false };
  }
  if (!currentNode) {
    return { visible: true, obscured: true, highlighted: false };
  }

  // Alice can see everything (she constructed the onion and knows all keys)
  if (currentNode === "alice") {
    return { visible: true, obscured: false, highlighted: false };
  }

  // Bob can see everything (it's his processing)
  if (currentNode === "bob") {
    return { visible: true, obscured: false, highlighted: step.node === "bob" };
  }

  // Carol can only see step 6 (the forwarded packet she receives) clearly
  if (currentNode === "carol") {
    if (step.node === "carol") {
      return { visible: true, obscured: false, highlighted: true };
    }
    return { visible: true, obscured: true, highlighted: false };
  }

  // Dave can't see any of Bob's processing
  if (currentNode === "dave") {
    return { visible: true, obscured: true, highlighted: false };
  }

  return { visible: true, obscured: true, highlighted: false };
}

/** Determine whether a segment should be obscured based on perspective. */
function isSegmentObscured(
  segment: PacketSegment,
  isOmniscient: boolean,
  currentNode: NodeName | null,
  stepNode?: NodeName,
): boolean {
  if (isOmniscient) return false;
  if (!currentNode) return true;
  if (currentNode === "alice") return false;
  if (currentNode === "bob") return false;

  // If we're on this node's step, show all segments
  if (stepNode === currentNode) return false;

  // Otherwise, only the segment owned by this node is not obscured
  if (segment.owner === currentNode) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Encrypted pattern overlay (diagonal stripes) */
function EncryptedOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)",
      }}
    />
  );
}

/** Filler pattern overlay (horizontal stripes) */
function FillerOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-40 pointer-events-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)",
      }}
    />
  );
}

/** HMAC verification badge */
function HmacCheckBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-sans font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
      <Check className="h-3 w-3" />
      HMAC verified
    </span>
  );
}

/** A single segment in the horizontal packet bar. */
function SegmentBar({
  segment,
  obscured,
}: {
  segment: PacketSegment;
  obscured: boolean;
}) {
  // Minimum width threshold for showing text
  const showFullLabel = segment.widthPct >= 12;
  const showShortLabel = segment.widthPct >= 5;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden transition-all duration-300",
        "border-r border-foreground/10 last:border-r-0",
        "h-10 sm:h-12",
        obscured ? "opacity-20" : "opacity-100",
        segment.bgClass,
      )}
      style={{ width: `${segment.widthPct}%` }}
      title={obscured ? "???" : segment.label}
    >
      {/* Pattern overlays */}
      {segment.encrypted && !obscured && <EncryptedOverlay />}
      {segment.filler && !obscured && <FillerOverlay />}

      {/* Label */}
      <span
        className={cn(
          "relative z-10 font-sans text-[9px] sm:text-[10px] leading-tight text-center px-0.5",
          "text-white dark:text-white",
          "drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]",
          obscured && "invisible",
        )}
      >
        {showFullLabel
          ? segment.label
          : showShortLabel
            ? segment.shortLabel || segment.label
            : ""}
      </span>
    </div>
  );
}

/** The full horizontal bar representing the packet state at one step. */
function PacketBar({
  segments,
  obscured,
  isOmniscient,
  currentNode,
  stepNode,
}: {
  segments: PacketSegment[];
  obscured: boolean;
  isOmniscient: boolean;
  currentNode: NodeName | null;
  stepNode?: NodeName;
}) {
  return (
    <div className="w-full border-2 border-foreground/20 overflow-hidden flex">
      {segments.map((seg, i) => {
        const segObscured =
          obscured ||
          isSegmentObscured(seg, isOmniscient, currentNode, stepNode);
        return <SegmentBar key={i} segment={seg} obscured={segObscured} />;
      })}
    </div>
  );
}

/** Downward arrow between steps */
function StepConnector({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center py-2 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
      )}
    >
      <div className="flex flex-col items-center text-muted-foreground">
        <div className="w-px h-4 bg-current opacity-40" />
        <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
          <path d="M6 8L0 0h12z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

/** A single step row: label, packet bar, description. */
function StepRow({
  step,
  visible,
  obscured,
  highlighted,
  isOmniscient,
  currentNode,
}: {
  step: PeelStep;
  stepIndex: number;
  visible: boolean;
  obscured: boolean;
  highlighted: boolean;
  isOmniscient: boolean;
  currentNode: NodeName | null;
}) {
  return (
    <div
      className={cn(
        "border-2 px-3 sm:px-4 py-3 transition-all duration-200",
        step.bgClass || "bg-card",
        highlighted
          ? cn(step.borderClass || "border-foreground/20", "border-2")
          : "border-transparent",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none h-0 py-0 overflow-hidden",
      )}
    >
      {/* Step header */}
      <div className="flex items-center gap-2 mb-2">
        {step.dotClass && (
          <span
            className={cn(
              "inline-block h-3 w-3 shrink-0 border border-foreground/30",
              step.dotClass,
            )}
          />
        )}
        <span
          className={cn(
            "font-sans font-bold text-sm",
            step.textClass || "text-foreground",
          )}
        >
          {obscured && step.node ? "???" : step.label}
        </span>
        {step.hmacCheck && !obscured && (
          <HmacCheckBadge />
        )}
        <span className="ml-auto text-xs font-sans text-muted-foreground">
          {step.totalBytes}
        </span>
      </div>

      {/* Packet bar */}
      {obscured && step.node ? (
        // Show a single obscured block
        <div className="w-full border-2 border-foreground/10 overflow-hidden flex">
          <div
            className="relative flex items-center justify-center h-10 sm:h-12 w-full bg-gray-300/40 dark:bg-gray-600/40"
          >
            <span className="font-sans text-xs text-muted-foreground opacity-60">
              Encrypted ??? (hidden processing)
            </span>
          </div>
        </div>
      ) : (
        <PacketBar
          segments={step.segments}
          obscured={false}
          isOmniscient={isOmniscient}
          currentNode={currentNode}
          stepNode={step.node}
        />
      )}

      {/* Description */}
      <p
        className={cn(
          "mt-2 text-xs font-sans text-muted-foreground leading-relaxed",
          obscured && "opacity-40",
        )}
      >
        {obscured ? "This processing step is hidden from your perspective." : step.description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OnionPeelingDiagram({
  className,
  interactive = false,
}: OnionPeelingDiagramProps) {
  const { view } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  // Step state: 1..MAX_STEP (how many steps are visible)
  const [step, setStep] = useState(MAX_STEP);
  const visibleCount = interactive ? step : MAX_STEP;

  // Compute per-step visibility based on perspective
  const stepVisibility = useMemo(() => {
    return STEPS.map((s, i) =>
      getStepVisibility(i, s, isOmniscient, currentNode),
    );
  }, [isOmniscient, currentNode]);

  const stepLabels = [
    "Receive",
    "Verify HMAC",
    "Decrypt",
    "Extract",
    "Shift & pad",
    "Forward",
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

      {/* Step rows */}
      <div className="space-y-0">
        {STEPS.map((s, i) => {
          const isVisible = i < visibleCount;
          const vis = stepVisibility[i];

          return (
            <div key={i}>
              {/* Connector arrow between steps */}
              {i > 0 && <StepConnector visible={isVisible} />}

              <StepRow
                step={s}
                stepIndex={i}
                visible={isVisible}
                obscured={vis.obscured}
                highlighted={vis.highlighted}
                isOmniscient={isOmniscient}
                currentNode={currentNode}
              />
            </div>
          );
        })}
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
          Verify, decrypt, extract, shift: the packet stays 1,366 bytes at every hop
        </span>
      </div>
    </div>
  );
}
