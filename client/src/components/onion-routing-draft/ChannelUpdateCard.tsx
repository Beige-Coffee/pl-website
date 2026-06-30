// ────────────────────────────────────────────────────────────────────────────
// ChannelUpdateCard (DRAFT)
//
// Renders a small `channel_update` message box from BOLT 7. Visual: a 200px
// wide cream rectangle with a 1.5px ink border, a JetBrains Mono title strip,
// and three labeled rows for base_fee / fee_per_millionth / cltv_expiry_delta.
// Designed to hover above each forwarding segment in ComputedRouteDiagram, so
// students see "this hop publishes these three numbers, here is how the math
// uses them" in one glance.
//
// Purely presentational: no state, no animation. Optional `hopColor` accent
// recolors the title strip so the card visually ties to the forwarder it
// belongs to (matches the canonical hop palette in CltvSafetyLab).
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";

export interface ChannelUpdateCardProps {
  baseFee: number;
  feePpm: number;
  cltvDelta: number;
  hopColor?: { stroke: string; fill: string };
}

export function ChannelUpdateCard({
  baseFee,
  feePpm,
  cltvDelta,
  hopColor,
}: ChannelUpdateCardProps) {
  const stripStroke = hopColor?.stroke ?? INK;
  const stripFill = hopColor?.fill ?? "#fffdf5";
  return (
    <div
      className="border-[1.5px]"
      style={{
        width: 200,
        borderColor: INK,
        background: "#fffdf5",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
      data-testid="channel-update-card"
    >
      <div
        className="px-2 py-1 border-b-[1.5px] flex items-center gap-1.5"
        style={{
          borderColor: INK,
          background: stripFill,
        }}
      >
        <div
          className="w-1.5 h-1.5"
          style={{ background: stripStroke }}
        />
        <span
          className="text-[11px] font-bold tracking-[0.05em]"
          style={{
            color: INK,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          channel_update
        </span>
      </div>
      <div
        className="px-2 py-1.5 text-[12px] leading-snug"
        style={{
          color: INK,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}
      >
        <Row label="Base Fee" value={`${baseFee.toLocaleString("en-US")} sats`} />
        <Row label="Fee Per Millionth" value={feePpm.toLocaleString("en-US")} />
        <Row label="CLTV Delta" value={String(cltvDelta)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span
        className="text-[10px] tracking-[0.05em] uppercase"
        style={{
          color: SLATE,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

export default ChannelUpdateCard;
