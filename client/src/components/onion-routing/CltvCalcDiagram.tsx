/**
 * CltvCalcDiagram -- visually renders the step-by-step CLTV timelock
 * calculations for the Alice -> Bob -> Carol -> Dave route.
 *
 * Replaces the markdown code blocks in 2.1-fees-and-timelocks.md that showed:
 *   1. Dave's CLTV: 700,000 + 18 = 700,018
 *   2. Carol's incoming CLTV: 700,018 + 30 = 700,048
 *   3. Bob's incoming CLTV: 700,048 + 40 = 700,088
 *
 * Embed via `<cltv-calc></cltv-calc>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface CltvCalcDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface CltvStep {
  node: string;
  role: string;
  dotClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  formula: string;
  result: string;
  note: string;
}

const CLTV_STEPS: CltvStep[] = [
  {
    node: "Dave",
    role: "Final recipient",
    dotClass: "bg-purple-500",
    bgClass: "bg-purple-500/5 dark:bg-purple-500/10",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-700 dark:text-purple-300",
    formula: "700,000 + 18",
    result: "700,018",
    note: "block height + min_final_cltv_expiry_delta",
  },
  {
    node: "Carol",
    role: "Incoming CLTV",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-300",
    formula: "700,018 + 30",
    result: "700,048",
    note: "Dave's CLTV + Carol's cltv_expiry_delta",
  },
  {
    node: "Bob",
    role: "Incoming CLTV",
    dotClass: "bg-green-500",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    borderClass: "border-green-500/30",
    textClass: "text-green-700 dark:text-green-300",
    formula: "700,048 + 40",
    result: "700,088",
    note: "Carol's CLTV + Bob's cltv_expiry_delta",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DownArrow() {
  return (
    <div className="flex flex-col items-center py-1.5 text-muted-foreground">
      <div className="w-px h-3 bg-current opacity-40" />
      <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
        <path d="M6 8L0 0h12z" fill="currentColor" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CltvCalcDiagram({ className }: CltvCalcDiagramProps) {
  return (
    <div className={cn("my-6 space-y-0", className)}>
      {CLTV_STEPS.map((step, i) => (
        <div key={step.node}>
          {i > 0 && <DownArrow />}
          <div className={cn("border-2 px-4 py-3", step.bgClass, step.borderClass)}>
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "inline-block h-3 w-3 shrink-0 border border-foreground/30",
                  step.dotClass,
                )}
              />
              <span className={cn("font-sans font-bold text-sm", step.textClass)}>
                Step {i + 1}: {step.node}
              </span>
              <span className="font-sans text-xs text-muted-foreground">
                ({step.role})
              </span>
            </div>

            {/* Calculation */}
            <div className="pl-5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="font-sans text-sm text-foreground/80">
                {step.formula}
              </span>
              <span className="font-sans text-sm text-muted-foreground">=</span>
              <span className={cn("font-sans font-bold text-sm", step.textClass)}>
                {step.result}
              </span>
            </div>

            {/* Note */}
            <p className="pl-5 mt-1 font-sans text-xs text-muted-foreground">
              {step.note}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
