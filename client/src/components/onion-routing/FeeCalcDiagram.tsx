/**
 * FeeCalcDiagram -- visually renders the fee formula and step-by-step fee
 * calculations for the Alice -> Bob -> Carol -> Dave route.
 *
 * Replaces the markdown code blocks in 2.1-fees-and-timelocks.md that showed:
 *   1. The BOLT 7 fee formula
 *   2. Dave receives 50,000,000 msat
 *   3. Carol's fee calculation
 *   4. Bob's fee calculation
 *
 * Embed via `<fee-calc></fee-calc>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface FeeCalcDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface FeeStep {
  node: string;
  role: string;
  dotClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  resultLabel: string;
  resultValue: string;
  formulaLines?: string[];
}

const FEE_STEPS: FeeStep[] = [
  {
    node: "Dave",
    role: "Final recipient",
    dotClass: "bg-purple-500",
    bgClass: "bg-purple-500/5 dark:bg-purple-500/10",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-700 dark:text-purple-300",
    resultLabel: "Dave receives",
    resultValue: "50,000,000 msat",
  },
  {
    node: "Carol",
    role: "Forwards to Dave",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-300",
    resultLabel: "Bob sends Carol",
    resultValue: "50,003,000 msat",
    formulaLines: [
      "carol_fee = 500 + floor(50,000,000 \u00d7 50 / 1,000,000)",
      "= 500 + 2,500 = 3,000 msat",
    ],
  },
  {
    node: "Bob",
    role: "Forwards to Carol",
    dotClass: "bg-green-500",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    borderClass: "border-green-500/30",
    textClass: "text-green-700 dark:text-green-300",
    resultLabel: "Alice sends Bob",
    resultValue: "50,009,000 msat",
    formulaLines: [
      "bob_fee = 1,000 + floor(50,003,000 \u00d7 100 / 1,000,000)",
      "= 1,000 + 5,000 = 6,000 msat",
    ],
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

export function FeeCalcDiagram({ className }: FeeCalcDiagramProps) {
  return (
    <div className={cn("my-6 space-y-0", className)}>
      {/* Formula header */}
      <div className="border-2 border-foreground/20 bg-foreground/5 px-4 py-3">
        <p className="font-sans text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
          BOLT 7 Fee Formula
        </p>
        <p className="font-sans text-sm">
          <span className="font-semibold">fee</span>
          {" = fee_base_msat + floor(amount_forwarded \u00d7 fee_proportional_millionths / 1,000,000)"}
        </p>
      </div>

      {/* Steps */}
      {FEE_STEPS.map((step, i) => (
        <div key={step.node}>
          <DownArrow />
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

            {/* Formula lines (if any) */}
            {step.formulaLines && (
              <div className="mb-2 pl-5 space-y-0.5">
                {step.formulaLines.map((line, j) => (
                  <p key={j} className="font-sans text-sm text-foreground/80">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Result */}
            <div className="pl-5 flex items-center gap-2">
              <span className="font-sans text-xs text-muted-foreground uppercase tracking-wider">
                {step.resultLabel}:
              </span>
              <span className={cn("font-sans font-bold text-sm", step.textClass)}>
                {step.resultValue}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
