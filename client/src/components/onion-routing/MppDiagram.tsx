/**
 * MppDiagram -- Multi-part payment diagram showing a payment split into
 * two parts across different routes, converging at the receiver.
 *
 * Embed via `<mpp-diagram></mpp-diagram>` custom tag.
 */

const FONT = "system-ui, -apple-system, sans-serif";

const COLORS = {
  alice: { fill: "#3b82f6", stroke: "#2563eb" },
  bob: { fill: "#22c55e", stroke: "#16a34a" },
  carol: { fill: "#f59e0b", stroke: "#d97706" },
  dave: { fill: "#a855f7", stroke: "#9333ea" },
  route1: "#3b82f6",
  route2: "#f59e0b",
  secret: "#22c55e",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function NodeCircle({
  cx,
  cy,
  label,
  color,
  r = 22,
}: {
  cx: number;
  cy: number;
  label: string;
  color: { fill: string; stroke: string };
  r?: number;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={11}
        fontWeight={700}
        fontFamily={FONT}
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

function CurvedArrow({
  x1,
  y1,
  x2,
  y2,
  curveY,
  color,
  label,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curveY: number;
  color: string;
  label?: string;
}) {
  const midX = (x1 + x2) / 2;
  const ctrlY = curveY;
  const headLen = 7;

  // Approximate tangent at the end for arrowhead
  const t = 0.95;
  const tx = 2 * (1 - t) * (midX - x1) + 2 * t * (x2 - midX);
  const ty = 2 * (1 - t) * (ctrlY - y1) + 2 * t * (y2 - ctrlY);
  const tLen = Math.sqrt(tx * tx + ty * ty);
  const ux = tx / tLen;
  const uy = ty / tLen;

  return (
    <g>
      <path
        d={`M${x1},${y1} Q${midX},${ctrlY} ${x2 - ux * headLen},${y2 - uy * headLen}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ux * headLen - uy * 4},${y2 - uy * headLen + ux * 4} ${x2 - ux * headLen + uy * 4},${y2 - uy * headLen - ux * 4}`}
        fill={color}
      />
      {label && (
        <text
          x={midX}
          y={ctrlY + (ctrlY < (y1 + y2) / 2 ? -8 : 14)}
          textAnchor="middle"
          fill={color}
          fontSize={10}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MppDiagram() {
  const W = 620;
  const H = 300;

  // Node positions
  const aliceX = 80;
  const aliceY = 140;
  const bobX = 260;
  const bobY = 70;
  const carolX = 260;
  const carolY = 210;
  const daveX = 440;
  const daveY = 140;
  const nodeR = 22;

  return (
    <div className="my-8 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, height: "auto" }}
        role="img"
        aria-label="Multi-part payment: 100,000 sats split across two routes"
      >
        {/* Total amount label at Alice */}
        <rect
          x={aliceX - 42}
          y={aliceY - 52}
          width={84}
          height={18}
          rx={3}
          fill={COLORS.alice.fill}
          fillOpacity={0.12}
          stroke={COLORS.alice.fill}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
        <text
          x={aliceX}
          y={aliceY - 42}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.alice.fill}
          fontSize={10}
          fontWeight={700}
          fontFamily={FONT}
          style={{ pointerEvents: "none" }}
        >
          100,000 sats
        </text>

        {/* Route A: Alice -> Bob -> Dave (upper path) */}
        <CurvedArrow
          x1={aliceX + nodeR + 4}
          y1={aliceY - 8}
          x2={bobX - nodeR - 4}
          y2={bobY}
          curveY={bobY - 10}
          color={COLORS.route1}
        />
        <CurvedArrow
          x1={bobX + nodeR + 4}
          y1={bobY}
          x2={daveX - nodeR - 4}
          y2={daveY - 8}
          curveY={bobY - 10}
          color={COLORS.route1}
        />

        {/* Route A label */}
        <text
          x={(aliceX + bobX) / 2}
          y={bobY - 28}
          textAnchor="middle"
          fill={COLORS.route1}
          fontSize={10}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          Part 1: 60,000 sats
        </text>
        <text
          x={(aliceX + bobX) / 2}
          y={bobY - 16}
          textAnchor="middle"
          fill={COLORS.route1}
          fontSize={8}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          Route A
        </text>

        {/* Route B: Alice -> Carol -> Dave (lower path) */}
        <CurvedArrow
          x1={aliceX + nodeR + 4}
          y1={aliceY + 8}
          x2={carolX - nodeR - 4}
          y2={carolY}
          curveY={carolY + 10}
          color={COLORS.route2}
        />
        <CurvedArrow
          x1={carolX + nodeR + 4}
          y1={carolY}
          x2={daveX - nodeR - 4}
          y2={daveY + 8}
          curveY={carolY + 10}
          color={COLORS.route2}
        />

        {/* Route B label */}
        <text
          x={(aliceX + carolX) / 2}
          y={carolY + 30}
          textAnchor="middle"
          fill={COLORS.route2}
          fontSize={10}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          Part 2: 40,000 sats
        </text>
        <text
          x={(aliceX + carolX) / 2}
          y={carolY + 42}
          textAnchor="middle"
          fill={COLORS.route2}
          fontSize={8}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          Route B
        </text>

        {/* Dave collecting indicator */}
        <circle
          cx={daveX}
          cy={daveY}
          r={nodeR + 6}
          fill="none"
          stroke={COLORS.dave.fill}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.35}
        />

        {/* "Waits for both parts" label */}
        <text
          x={daveX + nodeR + 14}
          y={daveY - 12}
          textAnchor="start"
          fill={COLORS.dave.fill}
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.65}
          style={{ pointerEvents: "none" }}
        >
          Waits for
        </text>
        <text
          x={daveX + nodeR + 14}
          y={daveY + 1}
          textAnchor="start"
          fill={COLORS.dave.fill}
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.65}
          style={{ pointerEvents: "none" }}
        >
          both parts
        </text>

        {/* payment_secret badge */}
        <rect
          x={daveX - 48}
          y={daveY + 38}
          width={96}
          height={18}
          rx={3}
          fill={COLORS.secret}
          fillOpacity={0.12}
          stroke={COLORS.secret}
          strokeWidth={1}
          strokeOpacity={0.35}
        />
        <text
          x={daveX}
          y={daveY + 48}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.secret}
          fontSize={8.5}
          fontWeight={600}
          fontFamily={FONT}
          style={{ pointerEvents: "none" }}
        >
          payment_secret
        </text>

        {/* Key icon next to payment_secret */}
        <text
          x={daveX - 56}
          y={daveY + 48}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.secret}
          fontSize={11}
          fontFamily={FONT}
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        >
          &#x1F511;
        </text>

        {/* Nodes (drawn last so they appear on top) */}
        <NodeCircle cx={aliceX} cy={aliceY} label="Alice" color={COLORS.alice} r={nodeR} />
        <NodeCircle cx={bobX} cy={bobY} label="Bob" color={COLORS.bob} r={nodeR} />
        <NodeCircle cx={carolX} cy={carolY} label="Carol" color={COLORS.carol} r={nodeR} />
        <NodeCircle cx={daveX} cy={daveY} label="Dave" color={COLORS.dave} r={nodeR} />

        {/* Node role labels */}
        <text x={aliceX} y={aliceY + nodeR + 14} textAnchor="middle" fill="currentColor" fontSize={9} fontFamily={FONT} opacity={0.4} style={{ pointerEvents: "none" }}>Sender</text>
        <text x={daveX} y={daveY + nodeR + 28} textAnchor="middle" fill="currentColor" fontSize={9} fontFamily={FONT} opacity={0.4} style={{ pointerEvents: "none" }}>Receiver</text>
      </svg>

      <p className="text-sm text-muted-foreground text-center italic mt-2">
        Alice splits 100,000 sats across two routes. Dave waits until both parts arrive before
        revealing the preimage. The payment_secret ties the parts together.
      </p>
    </div>
  );
}
