import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { CANONICAL_TRACE, NODES, SESSION_KEY_PUBLIC } from "@/data/onion-routing-constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentTraceLabProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Node metadata -- colors matching PerspectiveToggle
// ---------------------------------------------------------------------------

interface NodeMeta {
  name: NodeName;
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  ringClass: string;
}

const NODE_LIST: NodeMeta[] = [
  {
    name: "alice",
    label: "Alice",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700 dark:text-blue-300",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    ringClass: "ring-blue-500",
  },
  {
    name: "bob",
    label: "Bob",
    dotClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-500/10 dark:bg-green-500/15",
    borderClass: "border-green-500/40",
    ringClass: "ring-green-500",
  },
  {
    name: "carol",
    label: "Carol",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/40",
    ringClass: "ring-amber-500",
  },
  {
    name: "dave",
    label: "Dave",
    dotClass: "bg-purple-500",
    textClass: "text-purple-700 dark:text-purple-300",
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/40",
    ringClass: "ring-purple-500",
  },
];

const NODE_META: Record<NodeName, NodeMeta> = Object.fromEntries(
  NODE_LIST.map((n) => [n.name, n]),
) as Record<NodeName, NodeMeta>;

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepPhase = "build" | "forward" | "peel" | "fulfill" | "complete";

interface NodeState {
  /** Label lines shown in the state panel */
  lines: { label: string; value: string }[];
}

interface TraceStep {
  title: string;
  narrative: string;
  phase: StepPhase;
  /** Which node is "active" (highlighted) this step */
  activeNode: NodeName;
  /** Arrow: [from, to] -- omit for no arrow (e.g. build/complete steps) */
  arrow?: [NodeName, NodeName];
  /** Which nodes are done (show checkmark) */
  processedNodes: NodeName[];
  /** Per-node state visible this step. Keyed by node name. */
  nodeState: Partial<Record<NodeName, NodeState>>;
}

// Truncate a hex string for display
function hexTrunc(hex: string, len = 8): string {
  return hex.slice(0, len) + "...";
}

const TRACE_STEPS: TraceStep[] = [
  // Step 1: Alice creates onion
  {
    title: "Alice creates the onion packet",
    narrative:
      "Alice has the route (Bob, Carol, Dave) and constructs a 1,366-byte Sphinx packet. She generates a fresh session key, computes shared secrets with each hop, derives per-hop keys, encodes TLV payloads, generates filler, and wraps layers from the inside out.",
    phase: "build",
    activeNode: "alice",
    processedNodes: [],
    nodeState: {
      alice: {
        lines: [
          { label: "Session key (pub)", value: hexTrunc(SESSION_KEY_PUBLIC) },
          { label: "Packet size", value: "1,366 bytes" },
          { label: "Route", value: "Bob -> Carol -> Dave" },
          {
            label: "Total amount",
            value:
              (CANONICAL_TRACE.aliceSendAmountMsat / 1000).toLocaleString() +
              " sats",
          },
          { label: "Payment hash", value: hexTrunc(CANONICAL_TRACE.paymentHash) },
        ],
      },
    },
  },
  // Step 2: Alice -> Bob
  {
    title: "Alice sends update_add_htlc to Bob",
    narrative:
      "Alice sends the onion packet inside an update_add_htlc message to Bob, along with the payment hash, amount (50,009 sats), and CLTV expiry (700,088). They complete the commitment dance to lock in the HTLC.",
    phase: "forward",
    activeNode: "alice",
    arrow: ["alice", "bob"],
    processedNodes: [],
    nodeState: {
      alice: {
        lines: [
          { label: "Sends", value: "update_add_htlc + onion" },
          {
            label: "Amount",
            value:
              (CANONICAL_TRACE.aliceSendAmountMsat / 1000).toLocaleString() +
              " sats",
          },
          {
            label: "CLTV expiry",
            value: CANONICAL_TRACE.aliceSendCltvExpiry.toLocaleString(),
          },
        ],
      },
      bob: {
        lines: [
          { label: "Receives", value: "1,366-byte onion packet" },
          { label: "Payment hash", value: hexTrunc(CANONICAL_TRACE.paymentHash) },
        ],
      },
    },
  },
  // Step 3: Bob peels
  {
    title: "Bob peels his layer",
    narrative:
      "Bob uses his private key and the ephemeral key to compute a shared secret. He verifies the HMAC, decrypts with ChaCha20 (rho key), and extracts his TLV payload: forward 50,003,000 msat to Carol via channel 700000x2x0 with outgoing CLTV 700,048.",
    phase: "peel",
    activeNode: "bob",
    processedNodes: [],
    nodeState: {
      bob: {
        lines: [
          { label: "Ephemeral key", value: hexTrunc(SESSION_KEY_PUBLIC) },
          { label: "Action", value: "Forward to Carol" },
          {
            label: "amt_to_forward",
            value:
              CANONICAL_TRACE.route[0].amtToForwardMsat.toLocaleString() +
              " msat",
          },
          {
            label: "outgoing_cltv",
            value: CANONICAL_TRACE.route[0].outgoingCltvValue.toLocaleString(),
          },
          { label: "short_channel_id", value: CANONICAL_TRACE.route[0].shortChannelId },
          { label: "Fee earned", value: "6,000 msat (6 sats)" },
        ],
      },
      alice: {
        lines: [{ label: "Status", value: "Waiting for fulfill or error" }],
      },
    },
  },
  // Step 4: Bob -> Carol
  {
    title: "Bob forwards to Carol",
    narrative:
      "Bob blinds the ephemeral key (multiplying by the blinding factor derived from his shared secret) and assembles a new 1,366-byte packet for Carol. He sends update_add_htlc with amount 50,003,000 msat and CLTV 700,048.",
    phase: "forward",
    activeNode: "bob",
    arrow: ["bob", "carol"],
    processedNodes: ["bob"],
    nodeState: {
      bob: {
        lines: [
          { label: "Sends", value: "update_add_htlc + blinded onion" },
          {
            label: "Amount",
            value:
              CANONICAL_TRACE.route[0].amtToForwardMsat.toLocaleString() +
              " msat",
          },
          { label: "Ephemeral key", value: "Blinded (new point)" },
        ],
      },
      carol: {
        lines: [
          { label: "Receives", value: "1,366-byte onion packet" },
          { label: "Payment hash", value: hexTrunc(CANONICAL_TRACE.paymentHash) },
        ],
      },
    },
  },
  // Step 5: Carol peels
  {
    title: "Carol peels her layer",
    narrative:
      "Carol computes her shared secret from the blinded ephemeral key. She verifies the HMAC, decrypts, and extracts her payload: forward 50,000,000 msat to Dave via channel 700000x3x0 with outgoing CLTV 700,018.",
    phase: "peel",
    activeNode: "carol",
    processedNodes: ["bob"],
    nodeState: {
      carol: {
        lines: [
          { label: "Ephemeral key", value: "Blinded once (from Bob)" },
          { label: "Action", value: "Forward to Dave" },
          {
            label: "amt_to_forward",
            value:
              CANONICAL_TRACE.route[1].amtToForwardMsat.toLocaleString() +
              " msat",
          },
          {
            label: "outgoing_cltv",
            value: CANONICAL_TRACE.route[1].outgoingCltvValue.toLocaleString(),
          },
          { label: "short_channel_id", value: CANONICAL_TRACE.route[1].shortChannelId },
          { label: "Fee earned", value: "3,000 msat (3 sats)" },
        ],
      },
      bob: {
        lines: [{ label: "Status", value: "Waiting for fulfill or error" }],
      },
    },
  },
  // Step 6: Carol -> Dave
  {
    title: "Carol forwards to Dave",
    narrative:
      "Carol blinds the ephemeral key again and assembles the packet for Dave. She sends update_add_htlc with amount 50,000,000 msat and CLTV 700,018.",
    phase: "forward",
    activeNode: "carol",
    arrow: ["carol", "dave"],
    processedNodes: ["bob", "carol"],
    nodeState: {
      carol: {
        lines: [
          { label: "Sends", value: "update_add_htlc + blinded onion" },
          {
            label: "Amount",
            value:
              CANONICAL_TRACE.route[1].amtToForwardMsat.toLocaleString() +
              " msat",
          },
          { label: "Ephemeral key", value: "Blinded twice (new point)" },
        ],
      },
      dave: {
        lines: [
          { label: "Receives", value: "1,366-byte onion packet" },
          { label: "Payment hash", value: hexTrunc(CANONICAL_TRACE.paymentHash) },
        ],
      },
    },
  },
  // Step 7: Dave peels (final hop)
  {
    title: "Dave peels: final hop!",
    narrative:
      "Dave computes his shared secret and peels the last layer. He finds the zero HMAC (32 bytes of zeros), signaling he is the final recipient. His payload contains 50,000,000 msat and CLTV 700,018. He verifies the payment hash against his stored preimage.",
    phase: "peel",
    activeNode: "dave",
    processedNodes: ["bob", "carol"],
    nodeState: {
      dave: {
        lines: [
          { label: "Ephemeral key", value: "Blinded twice (from Carol)" },
          { label: "Next HMAC", value: "0x0000...0000 (zero = final hop)" },
          {
            label: "Amount",
            value:
              CANONICAL_TRACE.route[2].amtToForwardMsat.toLocaleString() +
              " msat",
          },
          {
            label: "CLTV",
            value: CANONICAL_TRACE.route[2].outgoingCltvValue.toLocaleString(),
          },
          { label: "Payment hash match", value: "Yes" },
          { label: "Preimage", value: "Known (secret)" },
        ],
      },
    },
  },
  // Step 8: Fulfill backward
  {
    title: "Preimage propagates backward",
    narrative:
      "Dave reveals the preimage to Carol via update_fulfill_htlc. Carol reveals it to Bob. Bob reveals it to Alice. At each hop, the commitment dance settles the HTLC and the forwarding fee is earned.",
    phase: "fulfill",
    activeNode: "dave",
    arrow: ["dave", "alice"],
    processedNodes: ["bob", "carol", "dave"],
    nodeState: {
      dave: {
        lines: [
          { label: "Sends", value: "update_fulfill_htlc" },
          {
            label: "Preimage",
            value: hexTrunc(CANONICAL_TRACE.paymentPreimage, 16),
          },
        ],
      },
      carol: {
        lines: [
          { label: "Receives preimage", value: "Forwards to Bob" },
          { label: "Fee collected", value: "3,000 msat" },
        ],
      },
      bob: {
        lines: [
          { label: "Receives preimage", value: "Forwards to Alice" },
          { label: "Fee collected", value: "6,000 msat" },
        ],
      },
      alice: {
        lines: [{ label: "Receives preimage", value: "Payment complete!" }],
      },
    },
  },
  // Step 9: Complete
  {
    title: "Payment complete",
    narrative:
      "Alice has the preimage, cryptographic proof that Dave received the funds. 50,000 sats delivered. Total fees: 9 sats (6 to Bob, 3 to Carol). No single intermediate node learned both the sender and receiver.",
    phase: "complete",
    activeNode: "alice",
    processedNodes: ["alice", "bob", "carol", "dave"],
    nodeState: {
      alice: {
        lines: [
          { label: "Paid", value: "50,009 sats total" },
          { label: "Preimage", value: "Verified" },
          { label: "Proof of payment", value: "Yes" },
        ],
      },
      bob: {
        lines: [
          { label: "Fee earned", value: "6 sats" },
          {
            label: "Knows sender?",
            value: "Knows Alice (prev hop) only",
          },
        ],
      },
      carol: {
        lines: [
          { label: "Fee earned", value: "3 sats" },
          {
            label: "Knows destination?",
            value: "Knows Dave (next hop) only",
          },
        ],
      },
      dave: {
        lines: [
          { label: "Received", value: "50,000 sats" },
          { label: "Knows sender?", value: "No (only knows Carol)" },
        ],
      },
    },
  },
];

const MAX_STEP = TRACE_STEPS.length;

const STEP_LABELS = TRACE_STEPS.map((s) => s.title);

// ---------------------------------------------------------------------------
// Phase styles
// ---------------------------------------------------------------------------

function phaseStyle(phase: StepPhase): {
  borderClass: string;
  bgClass: string;
  labelClass: string;
  label: string;
} {
  switch (phase) {
    case "build":
      return {
        borderClass: "border-blue-500/30",
        bgClass: "bg-blue-500/5 dark:bg-blue-500/10",
        labelClass: "text-blue-600 dark:text-blue-400",
        label: "BUILD",
      };
    case "forward":
      return {
        borderClass: "border-blue-500/30",
        bgClass: "bg-blue-500/5 dark:bg-blue-500/10",
        labelClass: "text-blue-600 dark:text-blue-400",
        label: "FORWARD",
      };
    case "peel":
      return {
        borderClass: "border-amber-500/30",
        bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
        labelClass: "text-amber-600 dark:text-amber-400",
        label: "PEEL",
      };
    case "fulfill":
      return {
        borderClass: "border-emerald-500/30",
        bgClass: "bg-emerald-500/5 dark:bg-emerald-500/10",
        labelClass: "text-emerald-600 dark:text-emerald-400",
        label: "FULFILL",
      };
    case "complete":
      return {
        borderClass: "border-purple-500/30",
        bgClass: "bg-purple-500/5 dark:bg-purple-500/10",
        labelClass: "text-purple-600 dark:text-purple-400",
        label: "COMPLETE",
      };
  }
}

// ---------------------------------------------------------------------------
// Perspective helpers
// ---------------------------------------------------------------------------

function isStateVisibleToNode(
  stateNodeName: NodeName,
  observerNode: NodeName,
  canSee: (observer: string, target: string) => boolean,
): boolean {
  if (stateNodeName === observerNode) return true;
  return canSee(observerNode, stateNodeName);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Horizontal node diagram with circles, arrows, and checkmarks */
function NetworkVisualization({
  step,
  isOmniscient,
  currentNode,
}: {
  step: TraceStep;
  isOmniscient: boolean;
  currentNode: NodeName | null;
}) {
  const nodeCount = NODE_LIST.length;
  const nodeSpacing = 100 / (nodeCount + 1);

  return (
    <div className="relative w-full" style={{ height: "80px" }}>
      {/* Connection lines between adjacent nodes */}
      {NODE_LIST.slice(0, -1).map((node, i) => {
        const x1 = nodeSpacing * (i + 1);
        const x2 = nodeSpacing * (i + 2);
        return (
          <div
            key={`line-${node.name}`}
            className="absolute top-[28px] h-px bg-foreground/15"
            style={{
              left: `${x1 + 2}%`,
              right: `${100 - x2 + 2}%`,
            }}
          />
        );
      })}

      {/* Nodes */}
      {NODE_LIST.map((node, i) => {
        const xPct = nodeSpacing * (i + 1);
        const isActive = step.activeNode === node.name;
        const isProcessed = step.processedNodes.includes(node.name);

        // Determine if this node should be dimmed in node-local view
        const dimmed =
          !isOmniscient && currentNode !== null && currentNode !== node.name;

        return (
          <div
            key={node.name}
            className="absolute flex flex-col items-center"
            style={{
              left: `${xPct}%`,
              transform: "translateX(-50%)",
              top: 0,
            }}
          >
            {/* Node circle */}
            <div
              className={cn(
                "relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 border-2 transition-all duration-300",
                isActive
                  ? cn(node.dotClass, "border-foreground", "ring-2", node.ringClass, "ring-offset-2 ring-offset-background")
                  : isProcessed
                    ? cn(node.bgClass, node.borderClass)
                    : cn("bg-muted/30 border-foreground/20"),
                dimmed && "opacity-25",
              )}
            >
              {isProcessed && !isActive ? (
                <span className="text-base sm:text-lg">&#10003;</span>
              ) : (
                <span
                  className={cn(
                    "font-sans font-bold text-xs sm:text-sm",
                    isActive ? "text-white dark:text-black" : node.textClass,
                  )}
                >
                  {node.label[0]}
                </span>
              )}
            </div>

            {/* Node label */}
            <span
              className={cn(
                "mt-1 font-sans text-[10px] sm:text-xs transition-opacity duration-200",
                isActive
                  ? cn("font-bold", node.textClass)
                  : "text-muted-foreground",
                dimmed && "opacity-25",
              )}
            >
              {node.label}
            </span>
          </div>
        );
      })}

      {/* Arrow overlay */}
      {step.arrow && (
        <ArrowOverlay
          from={step.arrow[0]}
          to={step.arrow[1]}
          nodeSpacing={nodeSpacing}
          phase={step.phase}
        />
      )}
    </div>
  );
}

/** Animated arrow between two nodes */
function ArrowOverlay({
  from,
  to,
  nodeSpacing,
  phase,
}: {
  from: NodeName;
  to: NodeName;
  nodeSpacing: number;
  phase: StepPhase;
}) {
  const fromIdx = NODE_LIST.findIndex((n) => n.name === from);
  const toIdx = NODE_LIST.findIndex((n) => n.name === to);

  const fromX = nodeSpacing * (fromIdx + 1);
  const toX = nodeSpacing * (toIdx + 1);

  const leftX = Math.min(fromX, toX);
  const rightX = Math.max(fromX, toX);
  const goingRight = toX > fromX;

  const arrowColor =
    phase === "fulfill"
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-blue-500 dark:text-blue-400";

  return (
    <div
      className="absolute"
      style={{
        left: `${leftX + 3}%`,
        right: `${100 - rightX + 3}%`,
        top: "18px",
      }}
    >
      <div className="relative w-full flex items-center">
        <div
          className={cn("w-full h-[2px]", arrowColor)}
          style={{ backgroundColor: "currentColor" }}
        />
        <svg
          width="10"
          height="12"
          viewBox="0 0 10 12"
          className={cn("absolute shrink-0", arrowColor)}
          style={{
            [goingRight ? "right" : "left"]: "-5px",
            transform: goingRight ? "rotate(0deg)" : "rotate(180deg)",
          }}
        >
          <path d="M0 0L10 6L0 12Z" fill="currentColor" />
        </svg>
      </div>
      <div className="flex justify-center mt-0.5">
        <span
          className={cn(
            "font-sans text-[9px] sm:text-[10px] font-semibold whitespace-nowrap",
            arrowColor,
          )}
        >
          {phase === "fulfill" ? "update_fulfill_htlc" : "update_add_htlc"}
        </span>
      </div>
    </div>
  );
}

/** Node state panel showing what the active node knows */
function NodeStatePanel({
  step,
  isOmniscient,
  currentNode,
  canSee,
}: {
  step: TraceStep;
  isOmniscient: boolean;
  currentNode: NodeName | null;
  canSee: (observer: string, target: string) => boolean;
}) {
  // Determine which node states to show
  const entries = Object.entries(step.nodeState) as [NodeName, NodeState][];

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([nodeName, state]) => {
        const meta = NODE_META[nodeName];
        if (!meta) return null;

        // In node-local mode, obscure states for non-visible nodes
        const obscured =
          !isOmniscient &&
          currentNode !== null &&
          !isStateVisibleToNode(nodeName, currentNode, canSee);

        return (
          <div
            key={nodeName}
            className={cn(
              "border-2 px-3 py-2 transition-all duration-200",
              meta.bgClass,
              meta.borderClass,
              obscured && "opacity-30",
            )}
          >
            {/* Node header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 shrink-0 border border-foreground/30",
                  meta.dotClass,
                )}
              />
              <span
                className={cn("font-sans font-bold text-xs", meta.textClass)}
              >
                {meta.label}
              </span>
            </div>

            {/* State lines */}
            <div className="space-y-0.5">
              {state.lines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 font-sans text-[10px] sm:text-xs"
                >
                  <span className="text-muted-foreground shrink-0 uppercase tracking-wider">
                    {line.label}:
                  </span>
                  <span
                    className={cn(
                      "font-semibold break-all",
                      obscured && "opacity-40",
                    )}
                  >
                    {obscured ? "???" : line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PaymentTraceLab({ className }: PaymentTraceLabProps) {
  const { view, canSee } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  const [step, setStep] = useState(1);
  const currentStep = TRACE_STEPS[step - 1];
  const ps = phaseStyle(currentStep.phase);

  return (
    <div className={cn("w-full", className)}>
      {/* Step-through controls */}
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

        {/* Dot stepper */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
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

      {/* Step title + phase badge */}
      <div
        className={cn(
          "border-l-4 px-4 py-3 mb-4 transition-all duration-200",
          ps.borderClass,
          ps.bgClass,
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "font-sans text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 border",
              ps.labelClass,
              ps.borderClass,
            )}
          >
            {ps.label}
          </span>
          <span className="font-sans text-xs sm:text-sm font-bold text-foreground">
            Step {step}: {currentStep.title}
          </span>
        </div>
        <p className="font-sans text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
          {currentStep.narrative}
        </p>
      </div>

      {/* Network visualization */}
      <div className="mb-4 px-2">
        <NetworkVisualization
          step={currentStep}
          isOmniscient={isOmniscient}
          currentNode={currentNode}
        />
      </div>

      {/* Node state panel */}
      <div className="px-1">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="font-sans text-[10px] sm:text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Node State
          </span>
          {!isOmniscient && currentNode && (
            <span className={cn("font-sans text-[10px] sm:text-xs", NODE_META[currentNode].textClass)}>
              (viewing as {NODE_META[currentNode].label})
            </span>
          )}
        </div>
        <NodeStatePanel
          step={currentStep}
          isOmniscient={isOmniscient}
          currentNode={currentNode}
          canSee={canSee}
        />
      </div>

      {/* Keyboard hint */}
      <p className="mt-4 text-center font-sans text-[10px] text-muted-foreground/60">
        Use the arrow buttons or click the dots to navigate steps
      </p>
    </div>
  );
}
