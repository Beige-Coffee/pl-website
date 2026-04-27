import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyDerivationTreeDiagramProps {
  className?: string;
}

interface DerivedKey {
  name: string;
  role: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DERIVED_KEYS: DerivedKey[] = [
  {
    name: "rho",
    role: "encrypt payload",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  {
    name: "mu",
    role: "HMAC forward",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  {
    name: "um",
    role: "HMAC error",
    bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
    borderClass: "border-amber-500/40",
    textClass: "text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  {
    name: "pad",
    role: "pad filler",
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/40",
    textClass: "text-purple-700 dark:text-purple-300",
    dotClass: "bg-purple-500",
  },
  {
    name: "ammag",
    role: "encrypt error",
    bgClass: "bg-rose-500/10 dark:bg-rose-500/15",
    borderClass: "border-rose-500/40",
    textClass: "text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KeyDerivationTreeDiagram({ className }: KeyDerivationTreeDiagramProps) {
  return (
    <div className={cn("w-full space-y-0", className)}>
      {/* Shared Secret box */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 border-2 border-foreground/30 bg-foreground/5 px-4 py-2">
          <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-foreground/60" />
          <span className="font-sans font-bold text-sm">Shared Secret</span>
          <span className="font-sans text-xs text-muted-foreground">(32 bytes)</span>
        </div>
      </div>

      {/* Downward arrow */}
      <div className="flex flex-col items-center py-2 text-muted-foreground">
        <div className="w-px h-4 bg-current opacity-40" />
        <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
          <path d="M6 8L0 0h12z" fill="currentColor" />
        </svg>
      </div>

      {/* HMAC-SHA256 box */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 border-2 border-foreground/20 bg-muted/50 px-3 py-1.5">
          <span className="font-sans font-bold text-xs text-muted-foreground uppercase tracking-wider">
            HMAC-SHA256
          </span>
          <span className="font-sans text-[10px] text-muted-foreground">
            (key = key name, msg = secret)
          </span>
        </div>
      </div>

      {/* Fan-out lines: a single SVG connecting to each key */}
      <div className="flex justify-center py-2">
        <svg
          viewBox="0 0 500 40"
          className="w-full max-w-lg h-10 text-muted-foreground"
          preserveAspectRatio="xMidYMid meet"
          style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          {/* Center stem */}
          <line
            x1="250" y1="0" x2="250" y2="12"
            stroke="currentColor" strokeWidth="1.5" opacity="0.4"
          />
          {/* Horizontal bar */}
          <line
            x1="50" y1="12" x2="450" y2="12"
            stroke="currentColor" strokeWidth="1.5" opacity="0.4"
          />
          {/* Downward lines to each key */}
          {[50, 150, 250, 350, 450].map((x) => (
            <g key={x}>
              <line
                x1={x} y1="12" x2={x} y2="32"
                stroke="currentColor" strokeWidth="1.5" opacity="0.4"
              />
              <polygon
                points={`${x} 40, ${x - 5} 32, ${x + 5} 32`}
                fill="currentColor" opacity="0.4"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Derived keys row */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {DERIVED_KEYS.map((key) => (
          <div
            key={key.name}
            className={cn(
              "border-2 px-1.5 sm:px-3 py-2 text-center",
              key.bgClass,
              key.borderClass,
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <span
                className={cn(
                  "inline-block h-2 w-2 shrink-0 border border-foreground/30",
                  key.dotClass,
                )}
              />
              <span className={cn("font-sans font-bold text-xs sm:text-sm", key.textClass)}>
                {key.name}
              </span>
            </div>
            <p className="font-sans text-[10px] sm:text-xs text-muted-foreground leading-tight">
              {key.role}
            </p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 text-center">
        <p className="font-sans text-xs text-muted-foreground">
          5 keys per hop, 15 keys total for a 3-hop route
        </p>
      </div>
    </div>
  );
}
