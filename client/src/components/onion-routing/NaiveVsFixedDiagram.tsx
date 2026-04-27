import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NaiveVsFixedDiagramProps {
  className?: string;
}

interface HopBar {
  label: string;
  bytes: number;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAIVE_HOPS: HopBar[] = [
  { label: "Alice sends", bytes: 300 },
  { label: "Bob forwards", bytes: 200 },
  { label: "Carol forwards", bytes: 100 },
];

const FIXED_HOPS: HopBar[] = [
  { label: "Alice sends", bytes: 1366 },
  { label: "Bob forwards", bytes: 1366 },
  { label: "Carol forwards", bytes: 1366 },
];

const MAX_BYTES = 1366;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PacketBar({
  hop,
  maxBytes,
  variant,
}: {
  hop: HopBar;
  maxBytes: number;
  variant: "naive" | "fixed";
}) {
  const widthPct = (hop.bytes / maxBytes) * 100;
  const isNaive = variant === "naive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground">{hop.label}</span>
        <span className={cn(
          "font-sans text-xs font-semibold",
          isNaive ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
        )}>
          {hop.bytes.toLocaleString()}B
        </span>
      </div>
      <div className="w-full h-6 bg-muted/30 border border-foreground/10">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isNaive
              ? "bg-red-500/60 dark:bg-red-500/50"
              : "bg-emerald-500/60 dark:bg-emerald-500/50",
          )}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NaiveVsFixedDiagram({ className }: NaiveVsFixedDiagramProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {/* Left: Naive Approach */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-red-500" />
            <h4 className="font-sans font-bold text-sm text-red-700 dark:text-red-300">
              Naive Approach
            </h4>
          </div>

          <div className="space-y-2">
            {NAIVE_HOPS.map((hop, i) => (
              <PacketBar key={i} hop={hop} maxBytes={MAX_BYTES} variant="naive" />
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-foreground/10">
            <span className="text-red-600 dark:text-red-400 text-sm">&#10008;</span>
            <span className="font-sans text-xs text-red-600 dark:text-red-400 font-semibold">
              Position revealed!
            </span>
            <span className="font-sans text-[10px] text-muted-foreground">
              Packet shrinks at each hop
            </span>
          </div>
        </div>

        {/* Right: Onion Routing */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-emerald-500" />
            <h4 className="font-sans font-bold text-sm text-emerald-700 dark:text-emerald-300">
              Onion Routing
            </h4>
          </div>

          <div className="space-y-2">
            {FIXED_HOPS.map((hop, i) => (
              <PacketBar key={i} hop={hop} maxBytes={MAX_BYTES} variant="fixed" />
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-foreground/10">
            <span className="text-emerald-600 dark:text-emerald-400 text-sm">&#10004;</span>
            <span className="font-sans text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Fixed size!
            </span>
            <span className="font-sans text-[10px] text-muted-foreground">
              Every hop sees 1,366 bytes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
