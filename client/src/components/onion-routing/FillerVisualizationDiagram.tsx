import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FillerVisualizationDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_WIDTH = 1300;
const HOP_SHIFT = 97; // ~65 byte payload + 32 byte HMAC

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A labeled step in the filler process */
function StepRow({
  stepNumber,
  title,
  children,
}: {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-5 w-5 border border-foreground/30 bg-foreground/10 font-sans text-xs font-bold">
          {stepNumber}
        </span>
        <span className="font-sans text-xs font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** A horizontal bar representing the 1300-byte buffer */
function BufferBar({
  segments,
  overflowBytes,
  overflowLabel,
}: {
  segments: {
    label: string;
    widthPct: number;
    bgClass: string;
    textClass: string;
  }[];
  overflowBytes?: number;
  overflowLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Main 1300-byte buffer */}
      <div className="flex-1 flex h-8 border border-foreground/20 overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn(
              "h-full flex items-center justify-center overflow-hidden",
              seg.bgClass,
              i < segments.length - 1 && "border-r border-foreground/10",
            )}
            style={{ width: `${seg.widthPct}%` }}
          >
            <span className={cn("font-sans text-[9px] sm:text-[10px] font-semibold truncate px-0.5", seg.textClass)}>
              {seg.label}
            </span>
          </div>
        ))}
      </div>

      {/* Overflow indicator */}
      {overflowBytes != null && overflowBytes > 0 && (
        <div className="flex items-center gap-0.5 shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" className="text-red-500/60">
            <path d="M4 8h8M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <div className="flex items-center h-8 px-1.5 border border-dashed border-red-500/40 bg-red-500/10">
            <span className="font-sans text-[9px] sm:text-[10px] text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
              {overflowLabel || `${overflowBytes}B lost`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FillerVisualizationDiagram({ className }: FillerVisualizationDiagramProps) {
  const shiftPct = (HOP_SHIFT / TOTAL_WIDTH) * 100;

  return (
    <div className={cn("w-full space-y-5", className)}>
      {/* Step 1: Carol's layer wrapping shifts data right */}
      <StepRow stepNumber={1} title="Wrap Carol's layer: shift right, bytes fall off">
        <BufferBar
          segments={[
            {
              label: "Carol's payload + HMAC",
              widthPct: shiftPct,
              bgClass: "bg-amber-500/30 dark:bg-amber-500/25",
              textClass: "text-amber-700 dark:text-amber-300",
            },
            {
              label: "Dave's encrypted data (shifted right)",
              widthPct: 100 - shiftPct * 2,
              bgClass: "bg-purple-500/20 dark:bg-purple-500/15",
              textClass: "text-purple-700 dark:text-purple-300",
            },
            {
              label: "",
              widthPct: shiftPct,
              bgClass: "bg-muted/40",
              textClass: "text-muted-foreground",
            },
          ]}
          overflowBytes={HOP_SHIFT}
          overflowLabel={`~${HOP_SHIFT}B lost`}
        />
        <p className="font-sans text-[10px] text-muted-foreground ml-7">
          Dave's data shifts right to make room for Carol's payload. Trailing bytes are pushed past 1,300.
        </p>
      </StepRow>

      {/* Step 2: Bob's layer wrapping shifts more */}
      <StepRow stepNumber={2} title="Wrap Bob's layer: shift right again, more bytes fall off">
        <BufferBar
          segments={[
            {
              label: "Bob's payload + HMAC",
              widthPct: shiftPct,
              bgClass: "bg-green-500/30 dark:bg-green-500/25",
              textClass: "text-green-700 dark:text-green-300",
            },
            {
              label: "Carol + Dave (shifted)",
              widthPct: 100 - shiftPct * 3,
              bgClass: "bg-amber-500/15 dark:bg-amber-500/10",
              textClass: "text-amber-700 dark:text-amber-300",
            },
            {
              label: "",
              widthPct: shiftPct * 2,
              bgClass: "bg-muted/40",
              textClass: "text-muted-foreground",
            },
          ]}
          overflowBytes={HOP_SHIFT * 2}
          overflowLabel={`~${HOP_SHIFT * 2}B total lost`}
        />
        <p className="font-sans text-[10px] text-muted-foreground ml-7">
          Each layer shift loses more trailing bytes. Without correction, Dave's decryption will fail.
        </p>
      </StepRow>

      {/* Step 3: Filler compensates */}
      <StepRow stepNumber={3} title="The filler: pre-compute the lost bytes">
        <BufferBar
          segments={[
            {
              label: "Onion payload (encrypted layers)",
              widthPct: 100 - shiftPct * 2,
              bgClass: "bg-foreground/10",
              textClass: "text-foreground/70",
            },
            {
              label: "Filler bytes inserted here",
              widthPct: shiftPct * 2,
              bgClass: "bg-cyan-500/30 dark:bg-cyan-500/25",
              textClass: "text-cyan-700 dark:text-cyan-300",
            },
          ]}
        />

        {/* Arrow pointing to the filler region */}
        <div className="flex items-start gap-2 ml-7">
          <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400">
            <path d="M4 8h8M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          <p className="font-sans text-[10px] text-muted-foreground">
            Alice pre-computes filler by simulating each hop's encryption (XOR with rho stream).
            The filler replaces the trailing bytes after wrapping the innermost layer, so that
            when Dave decrypts, the trailing positions contain valid data and the HMAC passes.
          </p>
        </div>
      </StepRow>
    </div>
  );
}
