import { ChannelUpdateCard } from "./ChannelUpdateCard";
import { Tooltip } from "./Tooltip";

// ────────────────────────────────────────────────────────────────────────────
// ComputedRouteDiagram (DRAFT)
//
// Renders a fully-computed Lightning route as a single static figure. Layout
// (top to bottom):
//
//   1. Black header bar with route title + italic subtitle (e.g. total fees).
//   2. Cream stage:
//      a. Wallet icon on the far left with the sender's outgoing amount, then
//         circular nodes for sender → forwarders → receiver, connected by
//         dashed slate lines.
//      b. A `channel_update` card hovers above each forwarder.
//      c. Between each pair of nodes, two stacked amber-tinted boxes show
//         the precomputed HTLC Amount and HTLC Timeout for that segment.
//      d. Below the route, two rows of dashed cream calculation cards:
//         "Fees" (one per forwarder) and "HTLC Timeout" (one per segment).
//
// All numbers are precomputed by the consumer; this component is purely
// presentational. Visual format follows the locked spec: bg-card outer
// container with 1.5px foreground border, black header bar with gold dot,
// cream stage, JetBrains Mono on numeric values, sans-serif body.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const AMBER_FILL = "#fef3c7";
const AMBER = "#b8860b";

export interface RouteHop {
  id: string;
  name: string;
  role: "sender" | "forwarder" | "receiver";
  color?: { stroke: string; fill: string };
}

export interface RouteChannelUpdate {
  atForwarderIndex: number; // index into the forwarder list (0-based)
  baseFee: number;
  feePpm: number;
  cltvDelta: number;
}

export interface RouteFeeCalculation {
  forwarderName: string;
  baseFee: number;
  feePpm: number;
  amount: number;
  calculation: string;
  total: number;
}

export interface RouteTimeoutCalculation {
  label: string;
  calculation: string;
  total: number;
}

export interface RouteInvoice {
  amount: number;
  minFinalCltvDelta: number;
  paymentHash: string;
}

export interface ComputedRouteDiagramProps {
  title: string;
  subtitle?: string;
  invoice?: RouteInvoice;
  hops: RouteHop[];
  channelUpdates: RouteChannelUpdate[];
  htlcAmounts: number[];
  htlcTimeouts: number[];
  feeCalculations: RouteFeeCalculation[];
  timeoutCalculations: RouteTimeoutCalculation[];
  /**
   * When true, the component skips its outer container's black header bar.
   * Used by RouteComparisonDiagram, which provides its own wrapper header.
   */
  headerless?: boolean;
}

function truncateProductLabel(s: string, max = 28): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function ComputedRouteDiagram({
  title,
  subtitle,
  invoice,
  hops,
  channelUpdates,
  htlcAmounts,
  htlcTimeouts,
  feeCalculations,
  timeoutCalculations,
  headerless,
}: ComputedRouteDiagramProps) {
  const NODE_DIAMETER = 60;
  const SEGMENT_WIDTH = 220; // horizontal distance between adjacent node centers
  const LEFT_GUTTER = 40;    // small gutter on the left now that wallet is gone
  const STAGE_PAD_X = 16;

  const segmentCount = hops.length - 1;
  const stageInnerWidth =
    LEFT_GUTTER + segmentCount * SEGMENT_WIDTH + NODE_DIAMETER + 40;
  const minStageWidth = stageInnerWidth + STAGE_PAD_X * 2;

  // X centers (within the inner stage row) for each node.
  const nodeX = (i: number) =>
    LEFT_GUTTER + i * SEGMENT_WIDTH + NODE_DIAMETER / 2;

  const forwarderIndices = hops
    .map((h, i) => ({ h, i }))
    .filter((x) => x.h.role === "forwarder")
    .map((x) => x.i);

  return (
    <div
      className={
        headerless
          ? "border-foreground/40 bg-card overflow-hidden"
          : "my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      }
      data-testid="computed-route-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header (hidden when wrapped in RouteComparisonDiagram) */}
      {!headerless && (
        <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
            <span className="text-sm font-bold tracking-[0.08em] uppercase">
              {title}
            </span>
          </div>
        </div>
      )}

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
          style={{ minWidth: minStageWidth }}
        >
          {/* Paper-invoice card pinned to the top-left of the stage. The card
              sits above the route stage in normal flow so it doesn't overlap
              the channel_update cards above the forwarders. */}
          {invoice && (
            <div className="mb-4">
              <div
                className="border-[1.5px]"
                style={{
                  width: 220,
                  borderColor: INK,
                  background: "#fffdf5",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {/* Gold strip with INVOICE label */}
                <div
                  className="px-2 py-1"
                  style={{
                    background: AMBER,
                    color: "#fffdf5",
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    Invoice
                  </span>
                </div>
                {/* Perforated divider */}
                <div
                  style={{
                    borderBottom: "1.5px dashed #475569",
                    height: 0,
                  }}
                />
                {/* Body */}
                <div
                  className="px-3 py-2 leading-snug"
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: 11,
                    color: INK,
                  }}
                >
                  <Tooltip label="The good or service this invoice covers. Free-form description set by the merchant.">
                    <div className="mb-0.5">
                      <span style={{ color: SLATE }}>Product: </span>
                      <span className="font-bold">
                        {truncateProductLabel("Double-Espresso w/ Raw Milk")}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip label="The amount the receiver expects to be paid, in satoshis.">
                    <div className="mb-0.5">
                      <span style={{ color: SLATE }}>Amount: </span>
                      <span className="font-bold tabular-nums">
                        {invoice.amount.toLocaleString("en-US")} sats
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip label="The minimum number of blocks the receiver requires their incoming HTLC to remain valid for after the current block height. Sets the timelock floor for the final hop.">
                    <div className="mb-0.5">
                      <span style={{ color: SLATE }}>min_final_cltv_expiry_delta: </span>
                      <span className="font-bold tabular-nums">
                        {invoice.minFinalCltvDelta}
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip label="The SHA256 hash of the preimage. Every HTLC along the route is locked to this hash; whoever produces the matching preimage claims the funds.">
                    <div>
                      <span style={{ color: SLATE }}>payment_hash: </span>
                      <span className="font-bold">{invoice.paymentHash}</span>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}

          {/* Route stage: positioning is absolute within an inner div sized by
              minStageWidth so layout is deterministic across viewport widths. */}
          <div
            className="relative mx-auto"
            style={{ width: stageInnerWidth, height: 280 }}
          >
            {/* Backbone dashed connectors between adjacent nodes */}
            {Array.from({ length: segmentCount }).map((_, i) => {
              const startX = nodeX(i) + NODE_DIAMETER / 2;
              const endX = nodeX(i + 1) - NODE_DIAMETER / 2;
              return (
                <div
                  key={`backbone-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: 130,
                    left: startX,
                    width: endX - startX,
                    borderTop: "1.5px dashed #475569",
                  }}
                />
              );
            })}

            {/* Channel update cards above each forwarder */}
            {channelUpdates.map((cu) => {
              const hopIdx = forwarderIndices[cu.atForwarderIndex];
              if (hopIdx === undefined) return null;
              const x = nodeX(hopIdx);
              const hop = hops[hopIdx];
              return (
                <div
                  key={`cu-${cu.atForwarderIndex}`}
                  className="absolute"
                  style={{
                    top: 0,
                    left: x - 80,
                  }}
                >
                  <ChannelUpdateCard
                    baseFee={cu.baseFee}
                    feePpm={cu.feePpm}
                    cltvDelta={cu.cltvDelta}
                    hopColor={hop.color}
                  />
                </div>
              );
            })}

            {/* Connector lines from each channel-update card down to its forwarder */}
            {channelUpdates.map((cu) => {
              const hopIdx = forwarderIndices[cu.atForwarderIndex];
              if (hopIdx === undefined) return null;
              const x = nodeX(hopIdx);
              return (
                <div
                  key={`cu-line-${cu.atForwarderIndex}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: 92,
                    left: x - 1,
                    width: 0,
                    height: 18,
                    borderLeft: "1.5px dashed #475569",
                  }}
                />
              );
            })}

            {/* Per-segment HTLC Amount + HTLC Timeout boxes between adjacent nodes */}
            {Array.from({ length: segmentCount }).map((_, i) => {
              const startX = nodeX(i);
              const endX = nodeX(i + 1);
              const centerX = (startX + endX) / 2;
              const amount = htlcAmounts[i];
              const timeout = htlcTimeouts[i];
              return (
                <div
                  key={`htlc-box-${i}`}
                  className="absolute flex flex-col items-stretch gap-1"
                  style={{
                    top: 150,
                    left: centerX - 75,
                    width: 150,
                  }}
                >
                  <div
                    className="border-[1.5px] px-2 py-1.5"
                    style={{
                      borderColor: AMBER,
                      background: AMBER_FILL,
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <div
                      className="text-[10px] tracking-[0.05em] uppercase opacity-70"
                      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                    >
                      HTLC Amount
                    </div>
                    <div className="text-[14px] font-bold tabular-nums">
                      {amount?.toLocaleString("en-US") ?? "—"}
                    </div>
                  </div>
                  <div
                    className="border-[1.5px] px-2 py-1.5"
                    style={{
                      borderColor: AMBER,
                      background: AMBER_FILL,
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <div
                      className="text-[10px] tracking-[0.05em] uppercase opacity-70"
                      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                    >
                      HTLC Timeout
                    </div>
                    <div className="text-[14px] font-bold tabular-nums">
                      {timeout ?? "—"}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Node circles (sender, forwarders, receiver) */}
            {hops.map((hop, i) => {
              const x = nodeX(i);
              const stroke = hop.color?.stroke ?? INK;
              const fill = hop.color?.fill ?? "#fffdf5";
              const role =
                hop.role === "sender"
                  ? "Sender"
                  : hop.role === "receiver"
                    ? "Receiver"
                    : "Forwarder";
              return (
                <div
                  key={hop.id}
                  className="absolute flex flex-col items-center"
                  style={{
                    top: 100,
                    left: x - NODE_DIAMETER / 2,
                    width: NODE_DIAMETER,
                  }}
                >
                  <div
                    className="rounded-full border-[2px] flex items-center justify-center"
                    style={{
                      width: NODE_DIAMETER,
                      height: NODE_DIAMETER,
                      background: fill,
                      borderColor: stroke,
                      color: INK,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    <span className="text-base font-bold">{hop.name[0]}</span>
                  </div>
                  <div
                    className="mt-1 text-[10px] font-bold tracking-[0.05em]"
                    style={{ color: INK }}
                  >
                    {hop.name}
                  </div>
                  <div
                    className="text-[8px] tracking-[0.05em] uppercase"
                    style={{ color: SLATE }}
                  >
                    {role}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calculation rows: Fees (per forwarder) and HTLC Timeout (per segment) */}
          <div className="mt-4 flex flex-col gap-3">
            {feeCalculations.length > 0 && (
              <CalcRow label="Fees">
                {feeCalculations.map((fc, i) => (
                  <FeeCalcCard key={`fc-${i}`} fc={fc} />
                ))}
              </CalcRow>
            )}
            {timeoutCalculations.length > 0 && (
              <CalcRow label="HTLC Timeout">
                {timeoutCalculations.map((tc, i) => (
                  <TimeoutCalcCard key={`tc-${i}`} tc={tc} />
                ))}
              </CalcRow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch md:gap-3">
      <div
        className="md:w-28 shrink-0 mb-2 md:mb-0 flex md:items-start"
        style={{ color: INK }}
      >
        <span
          className="text-[12px] font-bold tracking-[0.08em] uppercase"
          style={{ color: SLATE }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 flex-1">{children}</div>
    </div>
  );
}

function FeeCalcCard({ fc }: { fc: RouteFeeCalculation }) {
  return (
    <div
      className="px-3 py-2 flex-1 min-w-[420px]"
      style={{
        border: `1.5px dashed ${SLATE}`,
        background: "#fffdf5",
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <div
        className="text-[12px] font-bold tracking-[0.06em] uppercase mb-1.5 pb-1 border-b-[1px] border-foreground/15"
        style={{
          color: INK,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Calculate {fc.forwarderName}'s Fees
      </div>
      <div className="text-[12px] leading-relaxed space-y-0.5">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span style={{ color: SLATE, minWidth: 70, display: "inline-block" }}>
            Base Fee
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="font-bold tabular-nums">{fc.baseFee}</span>
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span style={{ color: SLATE, minWidth: 70, display: "inline-block" }}>
            Fee Rate
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="tabular-nums">
            ({fc.feePpm.toLocaleString("en-US")} / 1,000,000) ×{" "}
            {fc.amount.toLocaleString("en-US")}
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="font-bold tabular-nums">
            {(fc.total - fc.baseFee).toLocaleString("en-US")}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap pt-1 mt-1 border-t-[1px] border-foreground/15">
          <span
            style={{ color: INK, fontWeight: 700, minWidth: 70, display: "inline-block" }}
          >
            Total
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="font-bold tabular-nums">
            {fc.total.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimeoutCalcCard({ tc }: { tc: RouteTimeoutCalculation }) {
  return (
    <div
      className="px-3 py-2 flex-1 min-w-[240px]"
      style={{
        border: `1.5px dashed ${SLATE}`,
        background: "#fffdf5",
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <div
        className="text-[12px] font-bold tracking-[0.06em] uppercase mb-1"
        style={{
          color: INK,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {tc.label}
      </div>
      <div className="text-[12px] leading-snug">
        <div>
          <span style={{ color: SLATE }}>=</span>{" "}
          <span className="font-bold tabular-nums">{tc.calculation}</span>
        </div>
        <div>
          <span style={{ color: SLATE }}>=</span>{" "}
          <span className="font-bold tabular-nums">{tc.total}</span>
        </div>
      </div>
    </div>
  );
}

export default ComputedRouteDiagram;
