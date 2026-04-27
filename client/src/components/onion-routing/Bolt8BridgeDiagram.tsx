/**
 * Bolt8BridgeDiagram -- Cross-section diagram showing the two encryption
 * layers in Lightning: BOLT 8 (Noise, transport) wrapping BOLT 4 (Sphinx,
 * routing). Visualizes a message traveling between two nodes with both
 * layers annotated.
 *
 * Embed via `<bolt8-bridge-diagram></bolt8-bridge-diagram>` custom tag.
 */

const FONT = "system-ui, -apple-system, sans-serif";

const COLORS = {
  bolt8: { fill: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.35)" },
  bolt4: { fill: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)" },
  message: { fill: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.4)" },
  node: { fill: "#6b7280", stroke: "#4b5563" },
  alice: { fill: "#3b82f6", stroke: "#2563eb" },
  bob: { fill: "#22c55e", stroke: "#16a34a" },
  wire: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Bolt8BridgeDiagram() {
  const W = 640;
  const H = 340;

  // Onion cross-section (left-center area)
  const crossCX = W / 2;
  const crossCY = 130;

  // Layer dimensions (concentric rounded rects)
  const outerW = 420;
  const outerH = 140;
  const midW = 300;
  const midH = 96;
  const innerW = 170;
  const innerH = 50;

  // Node positions
  const aliceX = 80;
  const bobX = W - 80;
  const nodeY = 290;
  const nodeR = 20;

  return (
    <div className="my-8 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, height: "auto" }}
        role="img"
        aria-label="BOLT 8 and BOLT 4: the two encryption layers in Lightning"
      >
        {/* --- Concentric layer cross-section --- */}

        {/* Outer layer: BOLT 8 (Noise) */}
        <rect
          x={crossCX - outerW / 2}
          y={crossCY - outerH / 2}
          width={outerW}
          height={outerH}
          rx={12}
          fill={COLORS.bolt8.bg}
          stroke={COLORS.bolt8.fill}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
        {/* Outer label - top left */}
        <text
          x={crossCX - outerW / 2 + 14}
          y={crossCY - outerH / 2 + 18}
          textAnchor="start"
          fill={COLORS.bolt8.fill}
          fontSize={11}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          BOLT 8 - Transport Encryption
        </text>
        <text
          x={crossCX - outerW / 2 + 14}
          y={crossCY - outerH / 2 + 32}
          textAnchor="start"
          fill={COLORS.bolt8.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          Noise Protocol (ChaCha20-Poly1305)
        </text>
        {/* Right side label */}
        <text
          x={crossCX + outerW / 2 - 14}
          y={crossCY - outerH / 2 + 18}
          textAnchor="end"
          fill={COLORS.bolt8.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.45}
          style={{ pointerEvents: "none" }}
        >
          Point-to-point
        </text>

        {/* Middle layer: BOLT 4 (Sphinx) */}
        <rect
          x={crossCX - midW / 2}
          y={crossCY - midH / 2 + 10}
          width={midW}
          height={midH}
          rx={8}
          fill={COLORS.bolt4.bg}
          stroke={COLORS.bolt4.fill}
          strokeWidth={2}
          strokeOpacity={0.5}
        />
        {/* Middle label */}
        <text
          x={crossCX - midW / 2 + 12}
          y={crossCY - midH / 2 + 24}
          textAnchor="start"
          fill={COLORS.bolt4.fill}
          fontSize={11}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.85}
          style={{ pointerEvents: "none" }}
        >
          BOLT 4 - Routing Encryption
        </text>
        <text
          x={crossCX - midW / 2 + 12}
          y={crossCY - midH / 2 + 38}
          textAnchor="start"
          fill={COLORS.bolt4.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          Sphinx Onion (1,366-byte packet)
        </text>
        {/* Right side label */}
        <text
          x={crossCX + midW / 2 - 12}
          y={crossCY - midH / 2 + 24}
          textAnchor="end"
          fill={COLORS.bolt4.fill}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.45}
          style={{ pointerEvents: "none" }}
        >
          End-to-end
        </text>

        {/* Inner core: HTLC message */}
        <rect
          x={crossCX - innerW / 2}
          y={crossCY - innerH / 2 + 18}
          width={innerW}
          height={innerH}
          rx={5}
          fill={COLORS.message.bg}
          stroke={COLORS.message.fill}
          strokeWidth={1.5}
          strokeOpacity={0.6}
        />
        <text
          x={crossCX}
          y={crossCY + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.message.fill}
          fontSize={10}
          fontWeight={700}
          fontFamily={FONT}
          opacity={0.8}
          style={{ pointerEvents: "none" }}
        >
          Hop Payload
        </text>
        <text
          x={crossCX}
          y={crossCY + 26}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.message.fill}
          fontSize={8}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          (amt, CLTV, next_hop)
        </text>

        {/* --- Bottom section: Alice <-> Bob with wire --- */}

        {/* Wire between nodes */}
        <line
          x1={aliceX + nodeR + 6}
          y1={nodeY}
          x2={bobX - nodeR - 6}
          y2={nodeY}
          stroke={COLORS.wire}
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={0.4}
        />

        {/* "Encrypted TCP" label on wire */}
        <text
          x={W / 2}
          y={nodeY - 10}
          textAnchor="middle"
          fill={COLORS.wire}
          fontSize={9}
          fontFamily={FONT}
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        >
          Encrypted TCP Connection
        </text>

        {/* Packet icon traveling on the wire */}
        <rect
          x={W / 2 - 30}
          y={nodeY - 7}
          width={60}
          height={14}
          rx={3}
          fill={COLORS.bolt8.fill}
          fillOpacity={0.15}
          stroke={COLORS.bolt8.fill}
          strokeWidth={1}
          strokeOpacity={0.4}
        />
        <rect
          x={W / 2 - 20}
          y={nodeY - 5}
          width={40}
          height={10}
          rx={2}
          fill={COLORS.bolt4.fill}
          fillOpacity={0.2}
          stroke={COLORS.bolt4.fill}
          strokeWidth={0.8}
          strokeOpacity={0.4}
        />

        {/* Nodes */}
        <g>
          <circle
            cx={aliceX}
            cy={nodeY}
            r={nodeR}
            fill={COLORS.alice.fill}
            stroke={COLORS.alice.stroke}
            strokeWidth={2}
          />
          <text
            x={aliceX}
            y={nodeY + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={10}
            fontWeight={700}
            fontFamily={FONT}
            style={{ pointerEvents: "none" }}
          >
            Alice
          </text>
          <text
            x={aliceX}
            y={nodeY + nodeR + 14}
            textAnchor="middle"
            fill="currentColor"
            fontSize={9}
            fontFamily={FONT}
            opacity={0.4}
            style={{ pointerEvents: "none" }}
          >
            Sender
          </text>
        </g>

        <g>
          <circle
            cx={bobX}
            cy={nodeY}
            r={nodeR}
            fill={COLORS.bob.fill}
            stroke={COLORS.bob.stroke}
            strokeWidth={2}
          />
          <text
            x={bobX}
            y={nodeY + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={10}
            fontWeight={700}
            fontFamily={FONT}
            style={{ pointerEvents: "none" }}
          >
            Bob
          </text>
          <text
            x={bobX}
            y={nodeY + nodeR + 14}
            textAnchor="middle"
            fill="currentColor"
            fontSize={9}
            fontFamily={FONT}
            opacity={0.4}
            style={{ pointerEvents: "none" }}
          >
            Next Hop
          </text>
        </g>

        {/* Connecting line from cross-section to wire */}
        <line
          x1={W / 2}
          y1={crossCY + outerH / 2 + 2}
          x2={W / 2}
          y2={nodeY - 20}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.12}
        />
      </svg>

      {/* Course bridge callout */}
      <div className="mt-3 border-l-2 border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/5 px-3 py-2">
        <p className="font-sans text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <span className="font-bold text-blue-500 dark:text-blue-400">Course 1</span> (Noise Protocol) built the outer layer: BOLT 8 transport encryption.{" "}
          <span className="font-bold text-amber-500 dark:text-amber-400">This course</span> (Onion Routing) built the inner layer: BOLT 4 Sphinx routing encryption.
        </p>
      </div>
    </div>
  );
}
