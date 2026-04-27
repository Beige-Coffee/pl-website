import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailureCodesDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Flag definitions
// ---------------------------------------------------------------------------

interface Flag {
  name: string;
  hex: string;
  bit: number;
  color: string;
  textColor: string;
  bgClass: string;
  borderClass: string;
}

const FLAGS: Flag[] = [
  {
    name: "BADONION",
    hex: "0x8000",
    bit: 15,
    color: "#ef4444",
    textColor: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/10 dark:bg-red-500/15",
    borderClass: "border-red-500/40",
  },
  {
    name: "PERM",
    hex: "0x4000",
    bit: 14,
    color: "#f59e0b",
    textColor: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/40",
  },
  {
    name: "NODE",
    hex: "0x2000",
    bit: 13,
    color: "#3b82f6",
    textColor: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
  },
  {
    name: "UPDATE",
    hex: "0x1000",
    bit: 12,
    color: "#22c55e",
    textColor: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10 dark:bg-green-500/15",
    borderClass: "border-green-500/40",
  },
];

// ---------------------------------------------------------------------------
// Example error codes
// ---------------------------------------------------------------------------

interface ExampleCode {
  hex: string;
  name: string;
  flags: string[]; // which flag names are set
  baseCode: number;
  description: string;
}

const EXAMPLES: ExampleCode[] = [
  {
    hex: "0x1007",
    name: "temporary_channel_failure",
    flags: ["UPDATE"],
    baseCode: 7,
    description: "Not enough outbound liquidity; includes channel_update",
  },
  {
    hex: "0x400A",
    name: "unknown_next_peer",
    flags: ["PERM"],
    baseCode: 10,
    description: "No channel to the specified next hop",
  },
  {
    hex: "0x100C",
    name: "fee_insufficient",
    flags: ["UPDATE"],
    baseCode: 12,
    description: "Forwarding fee is lower than node's current policy",
  },
  {
    hex: "0x8002",
    name: "invalid_onion_hmac",
    flags: ["BADONION"],
    baseCode: 2,
    description: "HMAC verification failed; onion is corrupted",
  },
];

// ---------------------------------------------------------------------------
// Bit layout component
// ---------------------------------------------------------------------------

function BitLayout() {
  // Show a 16-bit layout with flag regions colored
  const bits = Array.from({ length: 16 }, (_, i) => 15 - i);

  function getFlagForBit(bit: number): Flag | null {
    return FLAGS.find((f) => f.bit === bit) ?? null;
  }

  return (
    <div className="flex justify-center mb-6">
      <div>
        {/* Bit numbers */}
        <div className="flex">
          {bits.map((bit) => (
            <div
              key={bit}
              className="w-6 sm:w-7 text-center text-[9px] sm:text-[10px] font-sans text-muted-foreground"
            >
              {bit}
            </div>
          ))}
        </div>

        {/* Bit cells */}
        <div className="flex border border-foreground/20">
          {bits.map((bit) => {
            const flag = getFlagForBit(bit);
            return (
              <div
                key={bit}
                className={cn(
                  "w-6 sm:w-7 h-7 sm:h-8 border-r border-foreground/10 flex items-center justify-center text-[9px] sm:text-[10px] font-mono font-bold",
                  flag
                    ? `${flag.bgClass} ${flag.textColor}`
                    : "text-muted-foreground/40",
                )}
              >
                {flag ? "1" : "0"}
              </div>
            );
          })}
        </div>

        {/* Region labels */}
        <div className="flex mt-1">
          {/* Flags region: bits 15-12 (first 4 cells) */}
          <div className="flex-shrink-0" style={{ width: `calc(4 * (1.5rem + 0px))` }}>
            <div className="text-center text-[9px] sm:text-[10px] font-sans font-bold text-muted-foreground">
              <span className="sm:inline hidden">Flags (bits 15-12)</span>
              <span className="sm:hidden">Flags</span>
            </div>
          </div>
          {/* Code region: bits 11-0 (remaining 12 cells) */}
          <div className="flex-1">
            <div className="text-center text-[9px] sm:text-[10px] font-sans font-bold text-muted-foreground">
              <span className="sm:inline hidden">Base code (bits 11-0)</span>
              <span className="sm:hidden">Code</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FailureCodesDiagram({
  className,
}: FailureCodesDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          BOLT 4 Error Code Structure
        </span>
        <span className="block font-sans text-xs text-muted-foreground mt-0.5">
          16-bit failure code = flag bits + base error number
        </span>
      </div>

      {/* Bit layout */}
      <BitLayout />

      {/* Flag badges */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {FLAGS.map((flag) => (
          <div
            key={flag.name}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 border font-sans text-xs font-bold",
              flag.bgClass,
              flag.borderClass,
              flag.textColor,
            )}
          >
            <span
              className="inline-block w-2.5 h-2.5 border"
              style={{
                backgroundColor: flag.color + "33",
                borderColor: flag.color + "66",
              }}
            />
            {flag.name}
            <span className="font-mono text-[10px] opacity-60">
              {flag.hex}
            </span>
          </div>
        ))}
      </div>

      {/* Example error codes */}
      <div className="space-y-2 max-w-lg mx-auto">
        <div className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider text-center mb-2">
          Common Error Codes
        </div>
        {EXAMPLES.map((ex) => (
          <div
            key={ex.hex}
            className="border border-foreground/10 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
          >
            {/* Code */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-sm font-bold text-foreground">
                {ex.hex}
              </span>
              {/* Flag badges */}
              <div className="flex gap-1">
                {ex.flags.map((flagName) => {
                  const flag = FLAGS.find((f) => f.name === flagName);
                  if (!flag) return null;
                  return (
                    <span
                      key={flagName}
                      className={cn(
                        "text-[9px] font-bold px-1 py-0.5 border",
                        flag.bgClass,
                        flag.borderClass,
                        flag.textColor,
                      )}
                    >
                      {flag.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Name and description */}
            <div className="flex-1 min-w-0">
              <span className="font-mono text-xs font-semibold text-foreground">
                {ex.name}
              </span>
              <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">
                {ex.description}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center italic mt-4 font-sans">
        Flags tell Alice what action to take: retry, avoid a node, or update routing info.
      </p>
    </div>
  );
}
