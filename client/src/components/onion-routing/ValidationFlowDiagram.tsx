import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationFlowDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Validation steps
// ---------------------------------------------------------------------------

interface ValidationStep {
  label: string;
  detail: string;
  /** Calculation shown in monospace */
  calc?: string;
  pass?: boolean;
}

const STEPS: ValidationStep[] = [
  {
    label: "Receive HTLC from Alice",
    detail: "50,009,000 msat, CLTV 700,088",
  },
  {
    label: "Peel onion layer",
    detail: "Extract payload: forward 50,003,000 msat, CLTV 700,048",
  },
  {
    label: "Fee sufficient?",
    detail: "50,009,000 - 50,003,000 = 6,000 msat",
    calc: "6,000 >= 6,000 (min fee)",
    pass: true,
  },
  {
    label: "CLTV delta OK?",
    detail: "700,088 - 700,048 = 40 blocks",
    calc: "40 >= 40 (required delta)",
    pass: true,
  },
  {
    label: "Forward to Carol",
    detail: "50,003,000 msat, CLTV 700,048, via 700000x2x0",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ValidationFlowDiagram({
  className,
}: ValidationFlowDiagramProps) {
  return (
    <div className={cn("w-full my-8 flex justify-center", className)}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-4">
          <span className="font-sans text-sm font-bold text-green-700 dark:text-green-300">
            Bob's Validation Flow
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {STEPS.map((step, i) => (
            <div key={i}>
              {/* Connector arrow */}
              {i > 0 && (
                <div className="flex justify-center py-1">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <div className="w-px h-3 bg-current opacity-30" />
                    <svg
                      width="10"
                      height="6"
                      viewBox="0 0 10 6"
                      className="opacity-30"
                    >
                      <path d="M5 6L0 0h10z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Step box */}
              <div
                className={cn(
                  "border-2 px-4 py-3 font-sans",
                  i === 0
                    ? "bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/30"
                    : i === 1
                      ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30"
                      : i === STEPS.length - 1
                        ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/30"
                        : step.pass
                          ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/30"
                          : "border-border bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2">
                  {/* Step number or check */}
                  <div className="flex-shrink-0 mt-0.5">
                    {step.pass ? (
                      <span className="inline-flex items-center justify-center h-5 w-5 bg-green-500/20 border border-green-500/40 text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center h-5 w-5 border border-foreground/20 text-foreground/50 text-xs font-bold">
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{step.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {step.detail}
                    </div>
                    {step.calc && (
                      <div className="text-xs font-mono mt-1 text-green-600 dark:text-green-400 font-semibold">
                        {step.calc} &#10003;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center italic mt-4 font-sans">
          Bob validates fee and timelock margins before forwarding the HTLC.
        </p>
      </div>
    </div>
  );
}
