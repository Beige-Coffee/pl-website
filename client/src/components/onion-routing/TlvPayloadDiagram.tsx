/**
 * TlvPayloadDiagram -- a div-based horizontal byte-level breakdown of
 * TLV hop payloads. Shows two payloads side by side:
 *   1. Intermediate Hop (Bob) -- has short_channel_id (type 6)
 *   2. Final Hop (Dave) -- has payment_data (type 8) instead
 *
 * Each segment is color-coded with type number, field name, and example value.
 *
 * Embed via the `<tlv-payload></tlv-payload>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface TlvPayloadDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Segment definitions
// ---------------------------------------------------------------------------

interface TlvSegment {
  /** Color classes: bg + border + text */
  bgClass: string;
  borderClass: string;
  textClass: string;
  /** Type label e.g. "Length Prefix" or "Type 2" */
  typeLabel: string;
  /** Field name e.g. "amt_to_forward" */
  fieldName: string;
  /** Example value shown below */
  exampleValue: string;
  /** Relative width weight (for flex) */
  flex: number;
}

const BOB_SEGMENTS: TlvSegment[] = [
  {
    bgClass: "bg-zinc-500/10 dark:bg-zinc-400/10",
    borderClass: "border-zinc-400/40",
    textClass: "text-zinc-600 dark:text-zinc-300",
    typeLabel: "Length",
    fieldName: "payload_length",
    exampleValue: "18 bytes",
    flex: 1,
  },
  {
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
    typeLabel: "Type 2",
    fieldName: "amt_to_forward",
    exampleValue: "50,003,000 msat",
    flex: 2,
  },
  {
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    typeLabel: "Type 4",
    fieldName: "outgoing_cltv_value",
    exampleValue: "700,048",
    flex: 1.5,
  },
  {
    bgClass: "bg-orange-500/10 dark:bg-orange-500/15",
    borderClass: "border-orange-500/40",
    textClass: "text-orange-700 dark:text-orange-300",
    typeLabel: "Type 6",
    fieldName: "short_channel_id",
    exampleValue: "700000x2x0",
    flex: 2,
  },
];

const DAVE_SEGMENTS: TlvSegment[] = [
  {
    bgClass: "bg-zinc-500/10 dark:bg-zinc-400/10",
    borderClass: "border-zinc-400/40",
    textClass: "text-zinc-600 dark:text-zinc-300",
    typeLabel: "Length",
    fieldName: "payload_length",
    exampleValue: "43 bytes",
    flex: 1,
  },
  {
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
    typeLabel: "Type 2",
    fieldName: "amt_to_forward",
    exampleValue: "50,000,000 msat",
    flex: 2,
  },
  {
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    typeLabel: "Type 4",
    fieldName: "outgoing_cltv_value",
    exampleValue: "700,018",
    flex: 1.5,
  },
  {
    bgClass: "bg-purple-500/10 dark:bg-purple-500/15",
    borderClass: "border-purple-500/40",
    textClass: "text-purple-700 dark:text-purple-300",
    typeLabel: "Type 8",
    fieldName: "payment_data",
    exampleValue: "secret + 50,000 sats",
    flex: 2.5,
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SegmentBar({ segment }: { segment: TlvSegment }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border-2 px-2 py-2.5 min-w-0",
        segment.bgClass,
        segment.borderClass,
      )}
      style={{ flex: segment.flex }}
    >
      <span
        className={cn(
          "text-[10px] font-sans font-bold uppercase tracking-wider leading-tight",
          segment.textClass,
        )}
      >
        {segment.typeLabel}
      </span>
      <span
        className={cn(
          "text-xs font-sans font-semibold leading-tight mt-0.5",
          segment.textClass,
        )}
      >
        {segment.fieldName}
      </span>
      <span className="text-[10px] font-sans text-muted-foreground mt-1 leading-tight text-center">
        {segment.exampleValue}
      </span>
    </div>
  );
}

function PayloadRow({
  label,
  sublabel,
  segments,
  accentClass,
}: {
  label: string;
  sublabel: string;
  segments: TlvSegment[];
  accentClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-3 w-3 shrink-0 border border-foreground/30",
            accentClass,
          )}
        />
        <span className="font-sans font-bold text-sm">{label}</span>
        <span className="text-xs text-muted-foreground font-sans">
          ({sublabel})
        </span>
      </div>
      <div className="flex gap-0.5">
        {segments.map((seg, i) => (
          <SegmentBar key={i} segment={seg} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TlvPayloadDiagram({ className }: TlvPayloadDiagramProps) {
  return (
    <div className={cn("my-8 space-y-6", className)}>
      <PayloadRow
        label="Intermediate Hop (Bob)"
        sublabel="forwards payment"
        segments={BOB_SEGMENTS}
        accentClass="bg-green-500"
      />

      <PayloadRow
        label="Final Hop (Dave)"
        sublabel="receives payment"
        segments={DAVE_SEGMENTS}
        accentClass="bg-purple-500"
      />

      {/* Legend / callout */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6 px-1">
        <div className="flex items-start gap-2">
          <div className="mt-1 h-3 w-3 shrink-0 border-2 border-orange-500/40 bg-orange-500/10" />
          <p className="text-xs font-sans text-muted-foreground">
            <span className="font-semibold text-orange-700 dark:text-orange-300">Type 6</span>{" "}
            is only present for intermediate hops (tells the node which channel to forward on).
          </p>
        </div>
        <div className="flex items-start gap-2">
          <div className="mt-1 h-3 w-3 shrink-0 border-2 border-purple-500/40 bg-purple-500/10" />
          <p className="text-xs font-sans text-muted-foreground">
            <span className="font-semibold text-purple-700 dark:text-purple-300">Type 8</span>{" "}
            is only present for the final hop (contains payment_secret + total_msat to verify the invoice).
          </p>
        </div>
      </div>
    </div>
  );
}
