/**
 * KeysendDiagram -- Side-by-side comparison of invoice-based payment
 * vs. keysend (spontaneous) payment, showing who generates the preimage.
 *
 * Embed via `<keysend-diagram></keysend-diagram>` custom tag.
 */

const FONT = "system-ui, -apple-system, sans-serif";

const COLORS = {
  alice: { fill: "#3b82f6", stroke: "#2563eb" },
  dave: { fill: "#a855f7", stroke: "#9333ea" },
  arrow: "#94a3b8",
  accent: "#f59e0b",
  preimage: "#22c55e",
  hash: "#f97316",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function NodeCircle({
  cx,
  cy,
  label,
  color,
}: {
  cx: number;
  cy: number;
  label: string;
  color: { fill: string; stroke: string };
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={20} fill={color.fill} stroke={color.stroke} strokeWidth={2} />
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

function HorizArrow({
  x1,
  y,
  x2,
  color,
  label,
  labelBelow,
  dashed = false,
}: {
  x1: number;
  y: number;
  x2: number;
  color: string;
  label?: string;
  labelBelow?: string;
  dashed?: boolean;
}) {
  const dir = x2 > x1 ? 1 : -1;
  const headLen = 7;

  return (
    <g>
      <line
        x1={x1}
        y1={y}
        x2={x2 - dir * headLen}
        y2={y}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "5 3" : undefined}
      />
      <polygon
        points={`${x2},${y} ${x2 - dir * headLen},${y - 4} ${x2 - dir * headLen},${y + 4}`}
        fill={color}
      />
      {label && (
        <text
          x={(x1 + x2) / 2}
          y={y - 8}
          textAnchor="middle"
          fill={color}
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.8}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
      {labelBelow && (
        <text
          x={(x1 + x2) / 2}
          y={y + 14}
          textAnchor="middle"
          fill={color}
          fontSize={8}
          fontFamily={FONT}
          opacity={0.55}
          style={{ pointerEvents: "none" }}
        >
          {labelBelow}
        </text>
      )}
    </g>
  );
}

function StepLabel({
  x,
  y,
  step,
  text,
  color = "currentColor",
}: {
  x: number;
  y: number;
  step: number;
  text: string;
  color?: string;
}) {
  return (
    <g>
      <circle cx={x - 6} cy={y - 3} r={7} fill={color} opacity={0.15} />
      <text
        x={x - 6}
        y={y - 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={8}
        fontWeight={700}
        fontFamily={FONT}
        style={{ pointerEvents: "none" }}
      >
        {step}
      </text>
      <text
        x={x + 6}
        y={y - 2}
        textAnchor="start"
        dominantBaseline="central"
        fill="currentColor"
        fontSize={9}
        fontFamily={FONT}
        opacity={0.65}
        style={{ pointerEvents: "none" }}
      >
        {text}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KeysendDiagram() {
  const W = 720;
  const H = 260;
  const halfW = W / 2;

  // Left panel (Invoice-based)
  const lAliceX = 60;
  const lDaveX = 290;
  const lNodeY = 80;

  // Right panel (Keysend)
  const rAliceX = halfW + 40;
  const rDaveX = halfW + 270;
  const rNodeY = 80;

  return (
    <div className="my-8 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, height: "auto" }}
        role="img"
        aria-label="Invoice-based payment vs. keysend comparison"
      >
        {/* Divider */}
        <line
          x1={halfW}
          y1={16}
          x2={halfW}
          y2={H - 10}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.12}
        />

        {/* --- LEFT: Invoice-Based --- */}
        <text
          x={halfW / 2}
          y={24}
          textAnchor="middle"
          fill="currentColor"
          fontSize={13}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.7}
        >
          Invoice-Based
        </text>
        <text
          x={halfW / 2}
          y={40}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily={FONT}
          opacity={0.4}
        >
          Dave generates preimage
        </text>

        {/* Step 1: Dave creates preimage */}
        <StepLabel x={lDaveX - 40} y={lNodeY - 30} step={1} text="Dave picks preimage" color={COLORS.dave.fill} />

        {/* Preimage badge near Dave */}
        <rect x={lDaveX - 32} y={lNodeY + 26} width={64} height={16} rx={3} fill={COLORS.preimage} fillOpacity={0.15} stroke={COLORS.preimage} strokeWidth={1} strokeOpacity={0.4} />
        <text x={lDaveX} y={lNodeY + 35} textAnchor="middle" dominantBaseline="central" fill={COLORS.preimage} fontSize={8} fontWeight={600} fontFamily={FONT} style={{ pointerEvents: "none" }}>
          preimage
        </text>

        {/* Step 2: Dave sends invoice (arrow left) */}
        <HorizArrow x1={lDaveX - 24} y={lNodeY + 58} x2={lAliceX + 24} color={COLORS.hash} label="Invoice (payment_hash)" dashed />
        <StepLabel x={lAliceX + 26} y={lNodeY + 48} step={2} text="Alice receives invoice" color={COLORS.alice.fill} />

        {/* Step 3: Alice pays (arrow right) */}
        <HorizArrow x1={lAliceX + 24} y={lNodeY + 82} x2={lDaveX - 24} color={COLORS.alice.fill} label="Payment (HTLC)" />
        <StepLabel x={lAliceX + 26} y={lNodeY + 72} step={3} text="Alice sends payment" color={COLORS.alice.fill} />

        {/* Step 4: Preimage flows back */}
        <HorizArrow x1={lDaveX - 24} y={lNodeY + 106} x2={lAliceX + 24} color={COLORS.preimage} label="Preimage (proof of payment)" dashed />
        <StepLabel x={lDaveX - 40} y={lNodeY + 96} step={4} text="Dave reveals preimage" color={COLORS.dave.fill} />

        {/* Nodes */}
        <NodeCircle cx={lAliceX} cy={lNodeY} label="Alice" color={COLORS.alice} />
        <NodeCircle cx={lDaveX} cy={lNodeY} label="Dave" color={COLORS.dave} />

        {/* --- RIGHT: Keysend --- */}
        <text
          x={halfW + (W - halfW) / 2}
          y={24}
          textAnchor="middle"
          fill="currentColor"
          fontSize={13}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.7}
        >
          Keysend
        </text>
        <text
          x={halfW + (W - halfW) / 2}
          y={40}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily={FONT}
          opacity={0.4}
        >
          Alice generates preimage
        </text>

        {/* Step 1: Alice creates preimage */}
        <StepLabel x={rAliceX - 10} y={rNodeY - 30} step={1} text="Alice picks preimage" color={COLORS.alice.fill} />

        {/* Preimage badge near Alice */}
        <rect x={rAliceX - 32} y={rNodeY + 26} width={64} height={16} rx={3} fill={COLORS.preimage} fillOpacity={0.15} stroke={COLORS.preimage} strokeWidth={1} strokeOpacity={0.4} />
        <text x={rAliceX} y={rNodeY + 35} textAnchor="middle" dominantBaseline="central" fill={COLORS.preimage} fontSize={8} fontWeight={600} fontFamily={FONT} style={{ pointerEvents: "none" }}>
          preimage
        </text>

        {/* Step 2: Alice sends payment with preimage in TLV */}
        <HorizArrow x1={rAliceX + 24} y={rNodeY + 58} x2={rDaveX - 24} color={COLORS.alice.fill} label="Payment + preimage in TLV" />
        <StepLabel x={rAliceX + 26} y={rNodeY + 48} step={2} text="Alice sends payment" color={COLORS.alice.fill} />

        {/* TLV badge */}
        <rect
          x={(rAliceX + rDaveX) / 2 - 40}
          y={rNodeY + 66}
          width={80}
          height={16}
          rx={3}
          fill={COLORS.accent}
          fillOpacity={0.15}
          stroke={COLORS.accent}
          strokeWidth={1}
          strokeOpacity={0.4}
        />
        <text
          x={(rAliceX + rDaveX) / 2}
          y={rNodeY + 75}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.accent}
          fontSize={7.5}
          fontWeight={600}
          fontFamily={FONT}
          style={{ pointerEvents: "none" }}
        >
          TLV 5482373484
        </text>

        {/* Step 3: Dave extracts preimage */}
        <StepLabel x={rDaveX - 40} y={rNodeY + 96} step={3} text="Dave extracts preimage from onion" color={COLORS.dave.fill} />

        {/* Preimage badge near Dave */}
        <rect x={rDaveX - 32} y={rNodeY + 108} width={64} height={16} rx={3} fill={COLORS.preimage} fillOpacity={0.15} stroke={COLORS.preimage} strokeWidth={1} strokeOpacity={0.4} />
        <text x={rDaveX} y={rNodeY + 117} textAnchor="middle" dominantBaseline="central" fill={COLORS.preimage} fontSize={8} fontWeight={600} fontFamily={FONT} style={{ pointerEvents: "none" }}>
          preimage
        </text>

        {/* Step 4: Dave claims payment */}
        <StepLabel x={rDaveX - 40} y={rNodeY + 134} step={4} text="Dave claims payment" color={COLORS.dave.fill} />

        {/* Nodes */}
        <NodeCircle cx={rAliceX} cy={rNodeY} label="Alice" color={COLORS.alice} />
        <NodeCircle cx={rDaveX} cy={rNodeY} label="Dave" color={COLORS.dave} />

        {/* No invoice label */}
        <text
          x={(rAliceX + rDaveX) / 2}
          y={rNodeY - 6}
          textAnchor="middle"
          fill={COLORS.hash}
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        >
          No invoice needed
        </text>
      </svg>

      <p className="text-sm text-muted-foreground text-center italic mt-2">
        The key difference: in invoice-based payments, Dave generates the preimage. In keysend,
        Alice generates it and embeds it in the onion payload.
      </p>
    </div>
  );
}
