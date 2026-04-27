import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorUnwrapDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface UnwrapRow {
  hop: string;
  hopIndex: number;
  ammagKey: string;
  umKey: string;
  hmacResult: "miss" | "match" | "skipped";
  extractedCode?: string;
  color: {
    bg: string;
    border: string;
    text: string;
  };
}

const ROWS: UnwrapRow[] = [
  {
    hop: "Bob",
    hopIndex: 0,
    ammagKey: "ammag_bob",
    umKey: "um_bob",
    hmacResult: "miss",
    color: {
      bg: "bg-blue-500/10 dark:bg-blue-500/15",
      border: "border-blue-500/40",
      text: "text-blue-700 dark:text-blue-300",
    },
  },
  {
    hop: "Carol",
    hopIndex: 1,
    ammagKey: "ammag_carol",
    umKey: "um_carol",
    hmacResult: "match",
    extractedCode: "0x1007",
    color: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      border: "border-emerald-500/40",
      text: "text-emerald-700 dark:text-emerald-300",
    },
  },
  {
    hop: "Dave",
    hopIndex: 2,
    ammagKey: "ammag_dave",
    umKey: "um_dave",
    hmacResult: "skipped",
    color: {
      bg: "bg-muted/20",
      border: "border-foreground/10",
      text: "text-muted-foreground/50",
    },
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HopRow({ row }: { row: UnwrapRow }) {
  const isSkipped = row.hmacResult === "skipped";
  const isMatch = row.hmacResult === "match";

  return (
    <div
      className={cn(
        "border px-3 py-3 sm:px-4",
        row.color.border,
        isSkipped ? "opacity-40" : row.color.bg,
      )}
    >
      {/* Hop label */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 border border-foreground/30 font-sans text-xs font-bold",
            isSkipped ? "bg-muted/30" : "bg-foreground/10",
          )}
        >
          {row.hopIndex}
        </span>
        <span className={cn("font-sans text-sm font-bold", row.color.text)}>
          {row.hop}
        </span>
        {isSkipped && (
          <span className="font-sans text-[10px] text-muted-foreground italic ml-1">
            (not reached)
          </span>
        )}
      </div>

      {isSkipped ? (
        <div className="ml-7 font-sans text-xs text-muted-foreground italic">
          Alice already found the error source. This hop is skipped.
        </div>
      ) : (
        /* Processing pipeline */
        <div className="ml-7 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
          {/* XOR step */}
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[10px] text-muted-foreground">XOR with</span>
            <span className={cn(
              "font-sans text-[10px] font-bold px-1.5 py-0.5 border",
              row.color.bg,
              row.color.border,
              row.color.text,
            )}>
              {row.ammagKey}
            </span>
          </div>

          {/* Arrow */}
          <span className="hidden sm:inline font-sans text-muted-foreground/50 mx-2">\u2192</span>

          {/* HMAC check */}
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[10px] text-muted-foreground">check</span>
            <span className={cn(
              "font-sans text-[10px] font-bold px-1.5 py-0.5 border",
              row.color.bg,
              row.color.border,
              row.color.text,
            )}>
              {row.umKey}
            </span>
            <span className="font-sans text-[10px] text-muted-foreground">HMAC</span>
          </div>

          {/* Arrow */}
          <span className="hidden sm:inline font-sans text-muted-foreground/50 mx-2">\u2192</span>

          {/* Result */}
          {isMatch ? (
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">\u2714</span>
              <span className="font-sans text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Match!
              </span>
              <span className="font-sans text-[10px] text-muted-foreground">\u2192</span>
              <span className="font-sans text-xs font-bold px-1.5 py-0.5 border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                {row.extractedCode}
              </span>
              <span className="font-sans text-[10px] text-muted-foreground">
                (temporary_channel_failure)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-red-600 dark:text-red-400 text-sm">\u2718</span>
              <span className="font-sans text-xs font-semibold text-red-600 dark:text-red-400">
                No match
              </span>
              <span className="font-sans text-[10px] text-muted-foreground">
                \u2192 try next hop
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ErrorUnwrapDiagram({ className }: ErrorUnwrapDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          Alice Unwraps the Error Packet
        </span>
        <span className="block font-sans text-xs text-muted-foreground mt-0.5">
          Iterate through hops in forward order, removing one obfuscation layer at a time
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-2 max-w-2xl mx-auto">
        {ROWS.map((row) => (
          <HopRow key={row.hop} row={row} />
        ))}
      </div>

      {/* Note */}
      <p className="font-sans text-xs text-muted-foreground text-center italic mt-4">
        Each XOR removes one layer of obfuscation. When the HMAC matches, Alice has found the failing hop.
      </p>
    </div>
  );
}
