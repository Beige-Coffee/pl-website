import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FillerAlgorithmDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Step {
  number: number;
  title: string;
  description: string;
  fillerWidth: number; // percentage of max width to show
  fillerLabel: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badge: string;
  };
  showXor: boolean;
}

const STEPS: Step[] = [
  {
    number: 0,
    title: "Initialize",
    description: "Start with an empty filler",
    fillerWidth: 0,
    fillerLabel: "empty",
    color: {
      bg: "bg-muted/30",
      border: "border-foreground/15",
      text: "text-muted-foreground",
      badge: "bg-muted/50",
    },
    showXor: false,
  },
  {
    number: 1,
    title: "Hop 1 (Bob)",
    description: "shift_size = len(bob_payload) + 32",
    fillerWidth: 33,
    fillerLabel: "97 bytes",
    color: {
      bg: "bg-blue-500/10 dark:bg-blue-500/15",
      border: "border-blue-500/40",
      text: "text-blue-700 dark:text-blue-300",
      badge: "bg-blue-500/20",
    },
    showXor: true,
  },
  {
    number: 2,
    title: "Hop 2 (Carol)",
    description: "shift_size = len(carol_payload) + 32",
    fillerWidth: 66,
    fillerLabel: "194 bytes",
    color: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      border: "border-emerald-500/40",
      text: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-500/20",
    },
    showXor: true,
  },
  {
    number: 3,
    title: "Filler ready",
    description: "Skip Dave (innermost hop). Filler complete.",
    fillerWidth: 66,
    fillerLabel: "final filler",
    color: {
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/40",
      text: "text-amber-700 dark:text-amber-300",
      badge: "bg-amber-500/20",
    },
    showXor: false,
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepRow({ step }: { step: Step }) {
  const isInit = step.number === 0;
  const isFinal = step.number === 3;

  return (
    <div className="space-y-2">
      {/* Step header */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 border border-foreground/30 font-sans text-xs font-bold",
            isFinal ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-foreground/10",
          )}
        >
          {step.number}
        </span>
        <span className={cn("font-sans text-xs font-semibold", step.color.text)}>
          {step.title}
        </span>
        <span className="font-sans text-[10px] text-muted-foreground">
          {step.description}
        </span>
      </div>

      {/* Filler bar */}
      <div className="ml-7">
        {isInit ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 border border-dashed border-foreground/20 flex items-center justify-center">
              <span className="font-sans text-[10px] text-muted-foreground italic">
                empty
              </span>
            </div>
            <span className="font-sans text-[10px] text-muted-foreground">
              filler = b""
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Growing filler block */}
            <div
              className={cn(
                "h-8 border flex items-center justify-center transition-all duration-300",
                step.color.bg,
                step.color.border,
              )}
              style={{ width: `${Math.max(step.fillerWidth, 15)}%` }}
            >
              <span className={cn("font-sans text-[10px] font-bold", step.color.text)}>
                {step.fillerLabel}
              </span>
            </div>

            {/* XOR arrow */}
            {step.showXor && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-sans text-xs text-muted-foreground">\u2190</span>
                <span className={cn(
                  "font-sans text-[10px] font-bold px-1.5 py-0.5 border",
                  step.color.bg,
                  step.color.border,
                  step.color.text,
                )}>
                  XOR(\u03C1 stream)
                </span>
              </div>
            )}

            {/* Checkmark for final */}
            {isFinal && (
              <span className="text-amber-600 dark:text-amber-400 text-sm">\u2714</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FillerAlgorithmDiagram({ className }: FillerAlgorithmDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          Filler Generation Algorithm
        </span>
        <span className="block font-sans text-xs text-muted-foreground mt-0.5">
          For each intermediate hop, extend and XOR-encrypt the filler
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-4 max-w-xl mx-auto">
        {STEPS.map((step, i) => (
          <div key={step.number}>
            <StepRow step={step} />
            {/* Connecting arrow between steps */}
            {i < STEPS.length - 1 && (
              <div className="ml-9 mt-2">
                <span className="font-sans text-muted-foreground/50 text-xs">\u2193</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="font-sans text-xs text-muted-foreground text-center italic mt-4">
        The filler grows by shift_size bytes at each hop, then gets XOR'd with that hop's cipher stream.
      </p>
    </div>
  );
}
