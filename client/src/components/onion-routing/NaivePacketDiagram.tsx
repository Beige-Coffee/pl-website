import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NaivePacketDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface PayloadBlock {
  label: string;
  sublabel: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

const BLOCKS: PayloadBlock[] = [
  {
    label: "encrypt(bob_payload, \u03C1_bob)",
    sublabel: "Bob's encrypted payload",
    bgClass: "bg-blue-500/15 dark:bg-blue-500/20",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
  },
  {
    label: "encrypt(carol_payload, \u03C1_carol)",
    sublabel: "Carol's encrypted payload",
    bgClass: "bg-emerald-500/15 dark:bg-emerald-500/20",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    label: "encrypt(dave_payload, \u03C1_dave)",
    sublabel: "Dave's encrypted payload",
    bgClass: "bg-purple-500/15 dark:bg-purple-500/20",
    borderClass: "border-purple-500/40",
    textClass: "text-purple-700 dark:text-purple-300",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NaivePacketDiagram({ className }: NaivePacketDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          Naive Packet Construction
        </span>
      </div>

      {/* Diagram */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-0">
        {/* Label */}
        <div className="flex-shrink-0 sm:mr-3">
          <span className="font-sans text-sm font-semibold text-foreground">
            naive_packet =
          </span>
        </div>

        {/* Concatenated blocks */}
        <div className="flex flex-col sm:flex-row flex-1 w-full gap-0">
          {BLOCKS.map((block, i) => (
            <div key={i} className="flex items-stretch flex-1">
              <div
                className={cn(
                  "flex-1 border px-3 py-3 flex flex-col items-center justify-center text-center",
                  block.bgClass,
                  block.borderClass,
                  // Remove inner borders on desktop for concatenated look
                  i > 0 && "sm:border-l-0",
                )}
              >
                <span className={cn("font-sans text-xs font-bold", block.textClass)}>
                  {block.label}
                </span>
                <span className="font-sans text-[10px] text-muted-foreground mt-1">
                  {block.sublabel}
                </span>
              </div>

              {/* Plus sign between blocks */}
              {i < BLOCKS.length - 1 && (
                <div className="hidden sm:flex items-center px-0">
                  <span className="font-sans text-sm font-bold text-muted-foreground">
                    +
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Note */}
      <p className="font-sans text-xs text-muted-foreground text-center italic mt-3">
        Each payload is encrypted independently and concatenated. No layering, no padding, no authentication.
      </p>
    </div>
  );
}
