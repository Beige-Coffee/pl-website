import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinalPacketDiagramProps {
  className?: string;
}

interface PacketField {
  label: string;
  bytes: number;
  /** Display width percentage (logarithmic scale for visual clarity) */
  widthPct: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FIELDS: PacketField[] = [
  {
    label: "Version",
    bytes: 1,
    widthPct: "4%",
    bgClass: "bg-zinc-400 dark:bg-zinc-500",
    borderClass: "border-zinc-400/40",
    textClass: "text-zinc-600 dark:text-zinc-300",
  },
  {
    label: "Ephemeral Key",
    bytes: 33,
    widthPct: "12%",
    bgClass: "bg-blue-500 dark:bg-blue-600",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
  },
  {
    label: "Routing Info",
    bytes: 1300,
    widthPct: "72%",
    bgClass: "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  {
    label: "HMAC",
    bytes: 32,
    widthPct: "12%",
    bgClass: "bg-orange-500 dark:bg-orange-600",
    borderClass: "border-orange-500/40",
    textClass: "text-orange-700 dark:text-orange-300",
  },
];

const PEELING_HOPS = [
  { label: "Bob peels", dotClass: "bg-green-500", textClass: "text-green-700 dark:text-green-300" },
  { label: "Carol peels", dotClass: "bg-amber-500", textClass: "text-amber-700 dark:text-amber-300" },
  { label: "Dave receives", dotClass: "bg-purple-500", textClass: "text-purple-700 dark:text-purple-300" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FinalPacketDiagram({ className }: FinalPacketDiagramProps) {
  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* Title + total size */}
      <div className="flex items-center justify-between">
        <h4 className="font-sans font-bold text-sm">Onion Packet</h4>
        <span className="font-sans text-xs text-muted-foreground">1,366 bytes total</span>
      </div>

      {/* Horizontal bar with proportional segments */}
      <div className="flex w-full gap-0.5 overflow-hidden rounded-sm">
        {FIELDS.map((field) => (
          <div
            key={field.label}
            className={cn(
              "relative h-10 flex items-center justify-center overflow-hidden",
              "border border-foreground/10",
            )}
            style={{ width: field.widthPct }}
          >
            <div className={cn("absolute inset-0", field.bgClass)} />
            <span className="relative z-10 font-sans text-[10px] font-bold text-white drop-shadow-sm truncate px-1">
              {field.label}
            </span>
          </div>
        ))}
      </div>

      {/* Byte count labels under each field */}
      <div className="flex w-full gap-0.5">
        {FIELDS.map((field) => (
          <div
            key={field.label}
            className="text-center"
            style={{ width: field.widthPct }}
          >
            <span className={cn("font-sans text-[10px] font-semibold", field.textClass)}>
              {field.bytes.toLocaleString()}B
            </span>
          </div>
        ))}
      </div>

      {/* Byte offset scale */}
      <div className="flex w-full justify-between text-[10px] font-sans text-muted-foreground px-0.5">
        <span>0</span>
        <span>1</span>
        <span>34</span>
        <span className="flex-1 text-center">1,334</span>
        <span>1,366</span>
      </div>

      {/* Peeling process */}
      <div className="mt-4 pt-3 border-t border-foreground/10">
        <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Each hop peels one layer:
        </p>
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {PEELING_HOPS.map((hop, i) => (
            <div key={hop.label} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg
                  width="16" height="12"
                  viewBox="0 0 16 12"
                  className="text-muted-foreground/50 shrink-0"
                >
                  <path d="M2 6h10M10 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              )}
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 shrink-0 border border-foreground/30",
                  hop.dotClass,
                )}
              />
              <span className={cn("font-sans text-xs font-semibold", hop.textClass)}>
                {hop.label}
              </span>
            </div>
          ))}
        </div>
        <p className="font-sans text-[10px] text-muted-foreground text-center mt-2">
          Every forwarded packet is exactly 1,366 bytes. No node can determine its position.
        </p>
      </div>
    </div>
  );
}
