/**
 * TlvByteBreakdownDiagram -- shows the byte-level structure of Bob's TLV
 * hop payload. Each TLV field is rendered as a row of color-coded hex byte
 * boxes (type=blue, length=green, value=amber) with annotation labels.
 *
 * Also includes a "payload format" footer showing the length-prefixed
 * structure as colored blocks.
 *
 * Embed via the `<tlv-byte-breakdown></tlv-byte-breakdown>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface TlvByteBreakdownDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface TlvFieldRow {
  /** Row heading, e.g. "Type 2 (amt_to_forward)" */
  heading: string;
  /** Type byte(s) in hex, e.g. "02" */
  typeHex: string;
  /** Type annotation, e.g. "type: 2" */
  typeLabel: string;
  /** Length byte(s) in hex, e.g. "04" */
  lengthHex: string;
  /** Length annotation, e.g. "length: 4 bytes" */
  lengthLabel: string;
  /** Value bytes in hex (may include brackets for placeholders) */
  valueHex: string;
  /** Value annotation, e.g. "50,003,000 msat ..." */
  valueLabel: string;
}

const BOB_TLV_FIELDS: TlvFieldRow[] = [
  {
    heading: "Type 2 (amt_to_forward)",
    typeHex: "02",
    typeLabel: "type: 2",
    lengthHex: "04",
    lengthLabel: "length: 4 bytes",
    valueHex: "02 FA C5 E8",
    valueLabel: "50,003,000 msat (4 bytes, big-endian)",
  },
  {
    heading: "Type 4 (outgoing_cltv)",
    typeHex: "04",
    typeLabel: "type: 4",
    lengthHex: "03",
    lengthLabel: "length: 3 bytes",
    valueHex: "0A B0 10",
    valueLabel: "700,048 (3 bytes, truncated)",
  },
  {
    heading: "Type 6 (short_channel_id)",
    typeHex: "06",
    typeLabel: "type: 6",
    lengthHex: "08",
    lengthLabel: "length: 8 bytes",
    valueHex: "00 0A AE 60 00 02 00 00",
    valueLabel: "Channel 700000x2x0",
  },
];

// ---------------------------------------------------------------------------
// Hex byte box
// ---------------------------------------------------------------------------

function HexByte({
  value,
  colorClasses,
}: {
  value: string;
  colorClasses: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "h-8 min-w-[2rem] px-1.5 border text-xs font-sans font-semibold tracking-wider",
        colorClasses,
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segment: a group of hex bytes with an annotation label below
// ---------------------------------------------------------------------------

function ByteSegment({
  hexString,
  label,
  colorClasses,
}: {
  hexString: string;
  label: string;
  colorClasses: string;
}) {
  const bytes = hexString.split(" ");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        {bytes.map((b, i) => (
          <HexByte key={i} value={b} colorClasses={colorClasses} />
        ))}
      </div>
      <span className="text-[10px] font-sans text-muted-foreground leading-tight text-center whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color palettes for segments
// ---------------------------------------------------------------------------

const TYPE_COLORS =
  "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300";
const LENGTH_COLORS =
  "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
const VALUE_COLORS =
  "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300";

// ---------------------------------------------------------------------------
// Single TLV row
// ---------------------------------------------------------------------------

function TlvRow({ field }: { field: TlvFieldRow }) {
  return (
    <div className="space-y-2">
      <span className="font-sans font-bold text-sm">{field.heading}</span>
      <div className="flex flex-wrap items-start gap-3">
        <ByteSegment
          hexString={field.typeHex}
          label={field.typeLabel}
          colorClasses={TYPE_COLORS}
        />
        <ByteSegment
          hexString={field.lengthHex}
          label={field.lengthLabel}
          colorClasses={LENGTH_COLORS}
        />
        <ByteSegment
          hexString={field.valueHex}
          label={field.valueLabel}
          colorClasses={VALUE_COLORS}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payload format footer -- colored blocks showing structure
// ---------------------------------------------------------------------------

function PayloadFormatFooter() {
  const blocks: { label: string; colorClasses: string }[] = [
    {
      label: "payload_length",
      colorClasses:
        "bg-zinc-500/10 dark:bg-zinc-400/10 border-zinc-400/40 text-zinc-600 dark:text-zinc-300",
    },
    { label: "TLV field 1", colorClasses: TYPE_COLORS },
    { label: "TLV field 2", colorClasses: LENGTH_COLORS },
    { label: "TLV field 3", colorClasses: VALUE_COLORS },
    {
      label: "...",
      colorClasses:
        "bg-zinc-500/10 dark:bg-zinc-400/10 border-zinc-400/40 text-zinc-600 dark:text-zinc-300",
    },
  ];

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <span className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Payload format
      </span>
      <div className="flex flex-wrap gap-0.5">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center border px-3 py-1.5",
              "text-[11px] font-sans font-semibold whitespace-nowrap",
              block.colorClasses,
            )}
          >
            {block.label}
          </div>
        ))}
      </div>
      <p className="text-[11px] font-sans text-muted-foreground leading-snug">
        The <span className="font-semibold">payload_length</span> prefix (a bigsize value) tells the onion-processing
        code how many bytes to read. The TLV fields are concatenated directly after it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  const items = [
    { label: "Type", colorClasses: TYPE_COLORS },
    { label: "Length", colorClasses: LENGTH_COLORS },
    { label: "Value", colorClasses: VALUE_COLORS },
  ];

  return (
    <div className="flex gap-4 px-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className={cn("h-3 w-3 shrink-0 border", item.colorClasses)}
          />
          <span className="text-xs font-sans text-muted-foreground font-medium">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TlvByteBreakdownDiagram({
  className,
}: TlvByteBreakdownDiagramProps) {
  return (
    <div className={cn("my-8 space-y-5", className)}>
      <Legend />

      {BOB_TLV_FIELDS.map((field, i) => (
        <TlvRow key={i} field={field} />
      ))}

      <PayloadFormatFooter />
    </div>
  );
}
