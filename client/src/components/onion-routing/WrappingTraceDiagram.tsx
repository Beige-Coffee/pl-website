/**
 * WrappingTraceDiagram -- interactive tabbed view showing the 3 iterations
 * of Alice's onion wrapping algorithm: Dave (innermost), Carol, Bob (outermost).
 *
 * Each tab shows the step-by-step operations with visual buffer bars,
 * color-coded by hop. Replaces the 3 pseudocode blocks in
 * 4.2-wrapping-layer-by-layer.md.
 *
 * Embed via `<wrapping-trace></wrapping-trace>` custom tag.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface WrappingTraceDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface WrapStep {
  icon: string;
  operation: string;
  detail: string;
  /** Visual segments for the buffer bar */
  bufferSegments: { label: string; widthPct: number; colorClass: string }[];
  /** Key or parameter shown as a small badge */
  keyBadge?: string;
}

interface Iteration {
  hop: string;
  subtitle: string;
  tabLabel: string;
  color: {
    bg: string;
    border: string;
    text: string;
    dot: string;
    activeBg: string;
    hoverBg: string;
    bufferFill: string;
    bufferFillDark: string;
  };
  steps: WrapStep[];
}

const ITERATIONS: Iteration[] = [
  {
    hop: "Dave",
    subtitle: "innermost",
    tabLabel: "Dave",
    color: {
      bg: "bg-purple-500/5 dark:bg-purple-500/10",
      border: "border-purple-500/30",
      text: "text-purple-700 dark:text-purple-300",
      dot: "bg-purple-500",
      activeBg: "bg-purple-500/15 dark:bg-purple-500/20",
      hoverBg: "hover:bg-purple-500/10",
      bufferFill: "bg-purple-500/25",
      bufferFillDark: "bg-purple-500/40",
    },
    steps: [
      {
        icon: "1",
        operation: "Shift right",
        detail: "Move existing buffer right by len(dave_payload) + 32 = 45 bytes. Opens space at front.",
        bufferSegments: [
          { label: "new space", widthPct: 4, colorClass: "bg-purple-400/30 dark:bg-purple-400/40" },
          { label: "zeros (shifted)", widthPct: 96, colorClass: "bg-foreground/5 dark:bg-foreground/10" },
        ],
        keyBadge: "shift = 45 bytes",
      },
      {
        icon: "2",
        operation: "Insert payload + HMAC",
        detail: "Write dave_payload (13 bytes) and current_hmac (32 bytes, all zeros) into the front.",
        bufferSegments: [
          { label: "payload", widthPct: 1, colorClass: "bg-purple-500/40 dark:bg-purple-500/50" },
          { label: "HMAC (zeros)", widthPct: 3, colorClass: "bg-purple-300/30 dark:bg-purple-400/30" },
          { label: "zeros", widthPct: 96, colorClass: "bg-foreground/5 dark:bg-foreground/10" },
        ],
      },
      {
        icon: "3",
        operation: "Encrypt",
        detail: "XOR entire 1,300-byte buffer with pseudo-random stream from rho key.",
        bufferSegments: [
          { label: "encrypted", widthPct: 100, colorClass: "bg-purple-500/20 dark:bg-purple-500/30" },
        ],
        keyBadge: "rho_dave",
      },
      {
        icon: "4",
        operation: "Apply filler",
        detail: "Overwrite trailing bytes with pre-computed filler. Corrects lost bytes from the shift.",
        bufferSegments: [
          { label: "encrypted", widthPct: 85, colorClass: "bg-purple-500/20 dark:bg-purple-500/30" },
          { label: "filler", widthPct: 15, colorClass: "bg-amber-500/30 dark:bg-amber-500/40" },
        ],
        keyBadge: "innermost only",
      },
      {
        icon: "5",
        operation: "Compute HMAC",
        detail: "HMAC-SHA256(mu_dave, encrypted_payload || payment_hash). Authenticates this state.",
        bufferSegments: [
          { label: "authenticated buffer", widthPct: 100, colorClass: "bg-purple-500/25 dark:bg-purple-500/35" },
        ],
        keyBadge: "mu_dave",
      },
    ],
  },
  {
    hop: "Carol",
    subtitle: "middle",
    tabLabel: "Carol",
    color: {
      bg: "bg-emerald-500/5 dark:bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      activeBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      hoverBg: "hover:bg-emerald-500/10",
      bufferFill: "bg-emerald-500/25",
      bufferFillDark: "bg-emerald-500/40",
    },
    steps: [
      {
        icon: "1",
        operation: "Shift right",
        detail: "Move buffer right by len(carol_payload) + 32 bytes. Dave's encrypted layer shifts further in.",
        bufferSegments: [
          { label: "new space", widthPct: 4, colorClass: "bg-emerald-400/30 dark:bg-emerald-400/40" },
          { label: "Dave's encrypted layer", widthPct: 96, colorClass: "bg-purple-500/15 dark:bg-purple-500/20" },
        ],
        keyBadge: "shift = payload + 32",
      },
      {
        icon: "2",
        operation: "Insert payload + HMAC",
        detail: "Write carol_payload and Dave's HMAC into the front. This HMAC lets Carol verify the inner packet.",
        bufferSegments: [
          { label: "payload", widthPct: 1, colorClass: "bg-emerald-500/40 dark:bg-emerald-500/50" },
          { label: "Dave's HMAC", widthPct: 3, colorClass: "bg-emerald-300/30 dark:bg-emerald-400/30" },
          { label: "Dave's layer", widthPct: 96, colorClass: "bg-purple-500/15 dark:bg-purple-500/20" },
        ],
      },
      {
        icon: "3",
        operation: "Encrypt",
        detail: "XOR entire buffer with rho stream. This wraps Dave's layer inside Carol's encryption.",
        bufferSegments: [
          { label: "Carol's layer (wraps Dave)", widthPct: 100, colorClass: "bg-emerald-500/20 dark:bg-emerald-500/30" },
        ],
        keyBadge: "rho_carol",
      },
      {
        icon: "4",
        operation: "Compute HMAC",
        detail: "HMAC-SHA256(mu_carol, encrypted_payload || payment_hash). Authenticates Carol's view.",
        bufferSegments: [
          { label: "authenticated buffer", widthPct: 100, colorClass: "bg-emerald-500/25 dark:bg-emerald-500/35" },
        ],
        keyBadge: "mu_carol",
      },
    ],
  },
  {
    hop: "Bob",
    subtitle: "outermost",
    tabLabel: "Bob",
    color: {
      bg: "bg-blue-500/5 dark:bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
      activeBg: "bg-blue-500/15 dark:bg-blue-500/20",
      hoverBg: "hover:bg-blue-500/10",
      bufferFill: "bg-blue-500/25",
      bufferFillDark: "bg-blue-500/40",
    },
    steps: [
      {
        icon: "1",
        operation: "Shift right",
        detail: "Move buffer right by len(bob_payload) + 32 bytes. Carol's and Dave's layers shift further in.",
        bufferSegments: [
          { label: "new space", widthPct: 4, colorClass: "bg-blue-400/30 dark:bg-blue-400/40" },
          { label: "Carol + Dave layers", widthPct: 96, colorClass: "bg-emerald-500/15 dark:bg-emerald-500/20" },
        ],
        keyBadge: "shift = payload + 32",
      },
      {
        icon: "2",
        operation: "Insert payload + HMAC",
        detail: "Write bob_payload and Carol's HMAC into the front. This HMAC lets Bob verify the outer packet.",
        bufferSegments: [
          { label: "payload", widthPct: 1, colorClass: "bg-blue-500/40 dark:bg-blue-500/50" },
          { label: "Carol's HMAC", widthPct: 3, colorClass: "bg-blue-300/30 dark:bg-blue-400/30" },
          { label: "inner layers", widthPct: 96, colorClass: "bg-emerald-500/15 dark:bg-emerald-500/20" },
        ],
      },
      {
        icon: "3",
        operation: "Encrypt",
        detail: "XOR entire buffer with rho stream. This wraps all inner layers inside Bob's encryption.",
        bufferSegments: [
          { label: "Bob's layer (wraps Carol + Dave)", widthPct: 100, colorClass: "bg-blue-500/20 dark:bg-blue-500/30" },
        ],
        keyBadge: "rho_bob",
      },
      {
        icon: "4",
        operation: "Compute HMAC",
        detail: "HMAC-SHA256(mu_bob, encrypted_payload || payment_hash). This becomes the outermost HMAC in the packet header.",
        bufferSegments: [
          { label: "final authenticated buffer", widthPct: 100, colorClass: "bg-blue-500/25 dark:bg-blue-500/35" },
        ],
        keyBadge: "mu_bob",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepCard({
  step,
  stepIndex,
  iteration,
}: {
  step: WrapStep;
  stepIndex: number;
  iteration: Iteration;
}) {
  return (
    <div className={cn("border px-3 py-2.5", iteration.color.bg, iteration.color.border)}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 border border-foreground/20 font-sans text-xs font-bold",
            iteration.color.activeBg,
            iteration.color.text,
          )}
        >
          {step.icon}
        </span>
        <span className={cn("font-sans text-sm font-bold", iteration.color.text)}>
          {step.operation}
        </span>
        {step.keyBadge && (
          <span
            className={cn(
              "font-sans text-[10px] px-1.5 py-0.5 border",
              iteration.color.border,
              iteration.color.text,
              iteration.color.activeBg,
            )}
          >
            {step.keyBadge}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="font-sans text-xs text-muted-foreground mb-2 pl-7">
        {step.detail}
      </p>

      {/* Buffer bar */}
      <div className="pl-7">
        <div className="flex h-6 w-full border border-foreground/15 overflow-hidden">
          {step.bufferSegments.map((seg, j) => (
            <div
              key={j}
              className={cn(
                "flex items-center justify-center overflow-hidden",
                seg.colorClass,
                j > 0 && "border-l border-foreground/10",
              )}
              style={{ width: `${seg.widthPct}%` }}
            >
              <span className="font-sans text-[9px] text-foreground/60 truncate px-1">
                {seg.widthPct >= 10 ? seg.label : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-0.5">
          <span className="font-sans text-[9px] text-muted-foreground">
            1,300 bytes
          </span>
        </div>
      </div>
    </div>
  );
}

function DownArrow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center py-0.5 text-muted-foreground", className)}>
      <div className="w-px h-2 bg-current opacity-30" />
      <svg width="8" height="5" viewBox="0 0 8 5" className="opacity-30">
        <path d="M4 5L0 0h8z" fill="currentColor" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WrappingTraceDiagram({ className }: WrappingTraceDiagramProps) {
  const [activeTab, setActiveTab] = useState(0);
  const iteration = ITERATIONS[activeTab];

  return (
    <div className={cn("w-full my-8", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          Wrapping Trace: Layer by Layer
        </span>
        <span className="block font-sans text-xs text-muted-foreground mt-0.5">
          Click each tab to see how Alice wraps the onion from innermost to outermost
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-4 max-w-lg mx-auto">
        {ITERATIONS.map((iter, i) => (
          <button
            key={iter.hop}
            onClick={() => setActiveTab(i)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-sans text-sm font-semibold border-2 transition-colors",
              i === activeTab
                ? cn(iter.color.activeBg, iter.color.border, iter.color.text)
                : cn(
                    "border-foreground/15 text-muted-foreground bg-transparent",
                    iter.color.hoverBg,
                  ),
              i === 0 && "",
              i === ITERATIONS.length - 1 && "",
            )}
          >
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 shrink-0 border border-foreground/20",
                i === activeTab ? iter.color.dot : "bg-foreground/20",
              )}
            />
            <span>
              {iter.tabLabel}
            </span>
            <span className="font-sans text-[10px] font-normal text-muted-foreground hidden sm:inline">
              ({iter.subtitle})
            </span>
          </button>
        ))}
      </div>

      {/* Steps for active tab */}
      <div className="max-w-lg mx-auto space-y-0">
        {iteration.steps.map((step, i) => (
          <div key={`${activeTab}-${i}`}>
            {i > 0 && <DownArrow />}
            <StepCard step={step} stepIndex={i} iteration={iteration} />
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="font-sans text-xs text-muted-foreground text-center italic mt-4 max-w-lg mx-auto">
        {activeTab === 0
          ? "After this step, the buffer contains Dave's encrypted layer. The trailing bytes have been corrected by the filler."
          : activeTab === 1
            ? "Now the buffer contains Carol's layer wrapping Dave's layer. The HMAC authenticates the entire state from Carol's perspective."
            : "The buffer now contains all three layers of encryption, and the HMAC authenticates the outermost state."}
      </p>
    </div>
  );
}
