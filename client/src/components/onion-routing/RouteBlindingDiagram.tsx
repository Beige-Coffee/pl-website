/**
 * RouteBlindingDiagram -- Side-by-side comparison of a normal route
 * vs. a blinded route (where the receiver's portion is hidden).
 *
 * Embed via `<route-blinding-diagram></route-blinding-diagram>` custom tag.
 */

// ---------------------------------------------------------------------------
// Node color palette (matches other diagrams)
// ---------------------------------------------------------------------------

const COLORS = {
  alice: { fill: "#3b82f6", stroke: "#2563eb" },
  bob: { fill: "#22c55e", stroke: "#16a34a" },
  carol: { fill: "#f59e0b", stroke: "#d97706" },
  dave: { fill: "#a855f7", stroke: "#9333ea" },
  blinded: { fill: "#6b7280", stroke: "#4b5563" },
};

const FONT = "system-ui, -apple-system, sans-serif";

// ---------------------------------------------------------------------------
// Shared SVG helpers
// ---------------------------------------------------------------------------

function NodeCircle({
  cx,
  cy,
  label,
  color,
  r = 22,
  sublabel,
}: {
  cx: number;
  cy: number;
  label: string;
  color: { fill: string; stroke: string };
  r?: number;
  sublabel?: string;
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
      {sublabel && (
        <text
          x={cx}
          y={cy + r + 14}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  color = "#94a3b8",
  dashed = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  dashed?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 7;

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2 - ux * headLen}
        y2={y2 - uy * headLen}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "5 3" : undefined}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ux * headLen - uy * 4},${y2 - uy * headLen + ux * 4} ${x2 - ux * headLen + uy * 4},${y2 - uy * headLen - ux * 4}`}
        fill={color}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Lock icon (simple padlock in SVG)
// ---------------------------------------------------------------------------

function LockIcon({ cx, cy, size = 14 }: { cx: number; cy: number; size?: number }) {
  const s = size;
  const x = cx - s / 2;
  const y = cy - s / 2;
  return (
    <g opacity={0.7}>
      {/* Shackle */}
      <path
        d={`M${x + s * 0.3},${y + s * 0.45} V${y + s * 0.25} A${s * 0.2},${s * 0.2} 0 0 1 ${x + s * 0.7},${y + s * 0.25} V${y + s * 0.45}`}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Body */}
      <rect
        x={x + s * 0.2}
        y={y + s * 0.45}
        width={s * 0.6}
        height={s * 0.45}
        rx={1.5}
        fill="#f59e0b"
        opacity={0.8}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Star badge for introduction point
// ---------------------------------------------------------------------------

function StarBadge({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="#f59e0b" opacity={0.2} />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f59e0b"
        fontSize={11}
        fontFamily={FONT}
        style={{ pointerEvents: "none" }}
      >
        &#9733;
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RouteBlindingDiagram() {
  const W = 720;
  const H = 240;
  const halfW = W / 2;
  const nodeR = 22;
  const nodeY = 100;
  const startX = 50;
  const gapX = 80;

  // Normal route node positions (left half)
  const normalNodes = [
    { x: startX, label: "Alice", color: COLORS.alice },
    { x: startX + gapX, label: "Bob", color: COLORS.bob },
    { x: startX + gapX * 2, label: "Carol", color: COLORS.carol },
    { x: startX + gapX * 3, label: "Dave", color: COLORS.dave },
  ];

  // Blinded route node positions (right half)
  const blindedX = halfW + 30;
  const blindedNodes = [
    { x: blindedX, label: "Alice", color: COLORS.alice, sublabel: undefined as string | undefined },
    { x: blindedX + gapX, label: "Bob", color: COLORS.bob, sublabel: "Intro Point" },
    { x: blindedX + gapX * 2, label: "???", color: COLORS.blinded, sublabel: "0xa3f1..." },
    { x: blindedX + gapX * 3, label: "???", color: COLORS.blinded, sublabel: "0x7e2b..." },
  ];

  return (
    <div className="my-8 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, height: "auto" }}
        role="img"
        aria-label="Route blinding: normal route vs. blinded route comparison"
      >
        {/* Divider */}
        <line
          x1={halfW}
          y1={20}
          x2={halfW}
          y2={H - 20}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.12}
        />

        {/* --- LEFT: Normal Route --- */}
        <text
          x={halfW / 2}
          y={30}
          textAnchor="middle"
          fill="currentColor"
          fontSize={13}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.7}
        >
          Normal Route
        </text>
        <text
          x={halfW / 2}
          y={46}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily={FONT}
          opacity={0.4}
        >
          All node IDs visible to sender
        </text>

        {/* Normal route arrows */}
        {normalNodes.slice(0, -1).map((n, i) => (
          <Arrow
            key={`normal-arrow-${i}`}
            x1={n.x + nodeR + 4}
            y1={nodeY}
            x2={normalNodes[i + 1].x - nodeR - 4}
            y2={nodeY}
            color="#94a3b8"
          />
        ))}

        {/* Normal route nodes */}
        {normalNodes.map((n) => (
          <NodeCircle
            key={`normal-${n.label}`}
            cx={n.x}
            cy={nodeY}
            label={n.label}
            color={n.color}
            r={nodeR}
          />
        ))}

        {/* Node ID labels under normal route */}
        {normalNodes.map((n) => (
          <text
            key={`normal-id-${n.label}`}
            x={n.x}
            y={nodeY + nodeR + 14}
            textAnchor="middle"
            fill={n.color.fill}
            fontSize={9}
            fontFamily={FONT}
            opacity={0.6}
            style={{ pointerEvents: "none" }}
          >
            {n.label}'s ID
          </text>
        ))}

        {/* --- RIGHT: Blinded Route --- */}
        <text
          x={halfW + (W - halfW) / 2}
          y={30}
          textAnchor="middle"
          fill="currentColor"
          fontSize={13}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.7}
        >
          Blinded Route
        </text>
        <text
          x={halfW + (W - halfW) / 2}
          y={46}
          textAnchor="middle"
          fill="currentColor"
          fontSize={10}
          fontFamily={FONT}
          opacity={0.4}
        >
          Receiver's identity hidden from sender
        </text>

        {/* Blinded route arrows -- clear segment */}
        <Arrow
          x1={blindedNodes[0].x + nodeR + 4}
          y1={nodeY}
          x2={blindedNodes[1].x - nodeR - 4}
          y2={nodeY}
          color="#94a3b8"
        />

        {/* Blinded segment arrows (dashed) */}
        {blindedNodes.slice(1, -1).map((n, i) => (
          <Arrow
            key={`blinded-arrow-${i}`}
            x1={n.x + nodeR + 4}
            y1={nodeY}
            x2={blindedNodes[i + 2].x - nodeR - 4}
            y2={nodeY}
            color="#f59e0b"
            dashed
          />
        ))}

        {/* Blinded region background */}
        <rect
          x={blindedNodes[1].x + nodeR + 8}
          y={nodeY - 34}
          width={blindedNodes[3].x - blindedNodes[1].x - nodeR + 4}
          height={68}
          rx={6}
          fill="#f59e0b"
          fillOpacity={0.06}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeOpacity={0.2}
          strokeDasharray="4 3"
        />

        {/* Lock icon on blinded region */}
        <LockIcon
          cx={blindedNodes[1].x + nodeR + 20}
          cy={nodeY - 26}
          size={14}
        />
        <text
          x={blindedNodes[1].x + nodeR + 34}
          y={nodeY - 25}
          fill="#f59e0b"
          fontSize={9}
          fontWeight={600}
          fontFamily={FONT}
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        >
          Blinded
        </text>

        {/* Blinded route nodes */}
        {blindedNodes.map((n) => (
          <NodeCircle
            key={`blinded-${n.x}`}
            cx={n.x}
            cy={nodeY}
            label={n.label}
            color={n.color}
            r={nodeR}
            sublabel={n.sublabel}
          />
        ))}

        {/* Star badge on Bob (introduction point) */}
        <StarBadge
          cx={blindedNodes[1].x + nodeR + 2}
          cy={nodeY - nodeR - 2}
        />

        {/* Alice visible label */}
        <text
          x={blindedNodes[0].x}
          y={nodeY + nodeR + 14}
          textAnchor="middle"
          fill={COLORS.alice.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        >
          Alice's ID
        </text>

        {/* Bob visible label */}
        <text
          x={blindedNodes[1].x}
          y={nodeY + nodeR + 14}
          textAnchor="middle"
          fill={COLORS.bob.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.6}
          style={{ pointerEvents: "none" }}
        >
          Bob's ID
        </text>
      </svg>

      <p className="text-sm text-muted-foreground text-center italic mt-2">
        In a blinded route, Alice can see the path up to the introduction point (Bob),
        but the remaining hops appear as opaque blinded node IDs.
      </p>
    </div>
  );
}
