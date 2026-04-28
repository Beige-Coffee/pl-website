// ────────────────────────────────────────────────────────────────────────────
// ShrinkingVsFixedDiagram
//
// Two horizontal traces of the same 4-hop route. The top trace shows a packet
// that shrinks at each hop (variable-size onion → leaks position). The bottom
// trace shows the Sphinx fixed-size packet that stays 1,366 bytes throughout.
// Used in Chapter 5.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = ["Alice", "Bob", "Carol", "Dave"];

const HOP_COLORS = [
  { fill: "#fde68a", stroke: "#b8860b" },
  { fill: "#bfdbfe", stroke: "#2563eb" },
  { fill: "#bbf7d0", stroke: "#16a34a" },
  { fill: "#fecaca", stroke: "#dc2626" },
];

// The shrinking trace: width represents bytes in the packet at each segment.
// The fixed trace: every segment is the same width.
const SHRINKING_BYTES = [2000, 1500, 1000, 500];
const FIXED_BYTES = [1366, 1366, 1366, 1366];

const MAX_BAR_WIDTH = 130;
const MAX_BYTES = 2000;

export function ShrinkingVsFixedDiagram() {
  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-shrinking-vs-fixed"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Same route, two packet sizing strategies
      </div>

      <div className="space-y-6">
        {/* Variable-size (leaky) */}
        <Trace
          title="Variable-size: every forwarder can guess its position"
          subtitle="Bob sees a fat packet. The last forwarder sees a thin one. Position is leaked."
          bytesPerSegment={SHRINKING_BYTES}
          accentColor="#dc2626"
          dimWhenSmall={true}
        />

        {/* Fixed-size (Sphinx) */}
        <Trace
          title="Sphinx fixed-size: every hop sees the same 1,366 bytes"
          subtitle="Same total length at every hop. Position can't be inferred from byte count."
          bytesPerSegment={FIXED_BYTES}
          accentColor="#16a34a"
          dimWhenSmall={false}
        />
      </div>
    </div>
  );
}

function Trace({
  title,
  subtitle,
  bytesPerSegment,
  accentColor,
  dimWhenSmall,
}: {
  title: string;
  subtitle: string;
  bytesPerSegment: number[];
  accentColor: string;
  dimWhenSmall: boolean;
}) {
  return (
    <div>
      <div className="font-semibold text-sm mb-1" style={{ color: accentColor }}>
        {title}
      </div>
      <div className="text-xs opacity-70 mb-3">{subtitle}</div>

      <div className="flex items-center gap-2">
        {HOPS.map((hop, i) => {
          const colors = HOP_COLORS[i];
          const isLastHop = i === HOPS.length - 1;
          const segmentBytes = bytesPerSegment[i];
          const widthPx = (segmentBytes / MAX_BYTES) * MAX_BAR_WIDTH;
          const opacity = dimWhenSmall ? 0.5 + 0.5 * (segmentBytes / MAX_BYTES) : 1;

          return (
            <div key={hop} className="flex items-center gap-2 shrink-0">
              {/* Node circle */}
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-semibold"
                  style={{ background: colors.fill, borderColor: colors.stroke }}
                >
                  {hop}
                </div>
              </div>
              {/* Outbound packet bar (skip from last hop) */}
              {!isLastHop && (
                <div className="flex flex-col items-center">
                  <div
                    className="h-5 border-2"
                    style={{
                      width: widthPx,
                      background: accentColor,
                      borderColor: accentColor,
                      opacity,
                    }}
                    title={`${segmentBytes} bytes`}
                  />
                  <div className="text-[10px] mt-1 font-mono text-foreground/70">
                    {segmentBytes.toLocaleString()} B
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ShrinkingVsFixedDiagram;
