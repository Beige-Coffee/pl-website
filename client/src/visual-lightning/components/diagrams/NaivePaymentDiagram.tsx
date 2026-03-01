import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "funding-utxo": {
    title: "Funding UTXO",
    description:
      "Alice locked 1 BTC into a funding output on-chain. She signs off-chain transactions referencing this UTXO to pay Bob.",
  },
  "off-chain": {
    title: "Off-Chain Transactions",
    description:
      "Alice signs transactions sending portions of the funding UTXO to Bob. These are valid Bitcoin transactions, but they haven't been broadcast to the network yet.",
  },
  "double-spend": {
    title: "Double-Spend Attack",
    description:
      "Alice broadcasts a conflicting transaction on-chain that spends the same funding UTXO back to herself. Since it gets mined first, Bob's off-chain TX becomes permanently invalid.",
  },
  alice: {
    title: "Alice (Attacker)",
    description:
      "Alice exploits the fact that off-chain transactions have no enforcement. She can always spend the on-chain UTXO out from under Bob.",
  },
  bob: {
    title: "Bob (Victim)",
    description:
      "Bob holds a valid signed transaction, but he can't spend it because Alice already spent the input on-chain. His TX is worthless.",
  },
};

/**
 * Animated diagram showing the naive payment channel failure.
 *
 * Animation loop (10s):
 *  0-4s: Three off-chain TXs slide from Alice to Bob (0.1, 0.2, 0.3 BTC)
 *  4-6s: Pause, all seems fine
 *  6-8s: Alice's double-spend TX drops to the blockchain, gets confirmed
 *  8-10s: Bob's off-chain TXs flash red / cross out, then reset
 */
export function NaivePaymentDiagram() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleHover = useCallback((region: string, e: React.MouseEvent) => {
    setHovered(region);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (hovered && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [hovered],
  );

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  const W = 480;
  const H = 360;
  const aliceX = 70;
  const bobX = W - 70;
  const laneY = 100;
  const chainY = 300;

  const txs = [
    { id: 1, amount: "0.1 BTC", delay: 0 },
    { id: 2, amount: "0.2 BTC", delay: 1.2 },
    { id: 3, amount: "0.3 BTC", delay: 2.4 },
  ];

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none">
      <div className="vl-card-3d-inner" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "auto",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <style>{`
            /* Off-chain TX slides from Alice to Bob */
            @keyframes vl-naive-slide {
              0%   { transform: translateX(0); opacity: 0; }
              3%   { opacity: 1; }
              30%  { transform: translateX(${bobX - aliceX - 72}px); opacity: 1; }
              55%  { transform: translateX(${bobX - aliceX - 72}px); opacity: 1; }
              /* Turn red when double-spend hits */
              70%  { transform: translateX(${bobX - aliceX - 72}px); opacity: 1; }
              75%  { transform: translateX(${bobX - aliceX - 72}px); opacity: 0.6; }
              85%  { transform: translateX(${bobX - aliceX - 72}px); opacity: 0; }
              100% { transform: translateX(${bobX - aliceX - 72}px); opacity: 0; }
            }

            /* Red X appears over Bob's accumulated TXs */
            @keyframes vl-naive-invalidate {
              0%, 68%  { opacity: 0; transform: scale(0.5); }
              75%      { opacity: 1; transform: scale(1); }
              90%      { opacity: 1; transform: scale(1); }
              100%     { opacity: 0; transform: scale(0.5); }
            }

            /* Alice's double-spend TX drops to blockchain */
            @keyframes vl-naive-doublespend {
              0%, 55%  { transform: translate(0, 0); opacity: 0; }
              60%      { transform: translate(0, 0); opacity: 1; }
              75%      { transform: translate(${(W / 2) - aliceX - 36}px, ${chainY - laneY + 16}px); opacity: 1; }
              90%      { transform: translate(${(W / 2) - aliceX - 36}px, ${chainY - laneY + 16}px); opacity: 1; }
              100%     { transform: translate(${(W / 2) - aliceX - 36}px, ${chainY - laneY + 16}px); opacity: 0; }
            }

            /* Blockchain glow when double-spend lands */
            @keyframes vl-naive-chain-glow {
              0%, 70%  { filter: none; }
              78%      { filter: drop-shadow(0 0 8px rgba(220, 38, 38, 0.4)); }
              90%      { filter: drop-shadow(0 0 8px rgba(220, 38, 38, 0.4)); }
              100%     { filter: none; }
            }

            .vl-naive-tx {
              opacity: 0;
              animation-duration: 10s;
              animation-iteration-count: infinite;
              animation-timing-function: ease-in-out;
              animation-fill-mode: both;
            }

            .vl-naive-x-mark {
              opacity: 0;
              animation: vl-naive-invalidate 10s ease-in-out infinite;
            }

            .vl-naive-doublespend-tx {
              opacity: 0;
              animation: vl-naive-doublespend 10s ease-in-out infinite;
            }

            .vl-naive-chain {
              animation: vl-naive-chain-glow 10s ease-in-out infinite;
            }

            @keyframes vl-naive-dash-flow {
              to { stroke-dashoffset: -16; }
            }
            .vl-naive-flow-line {
              animation: vl-naive-dash-flow 1s linear infinite;
            }
          `}</style>

          {/* Title */}
          <text x={W / 2} y="24" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
            The Naive Payment Channel
          </text>
          <text x={W / 2} y="40" fontSize="10" fill="#6b5d4f" textAnchor="middle">
            What goes wrong without enforcement
          </text>

          {/* Off-chain label */}
          <text x={W / 2} y={laneY - 30} fontSize="10" fill="#b8860b" textAnchor="middle" fontWeight="600" letterSpacing="0.06em">
            OFF-CHAIN
          </text>
          <line x1={W / 2 - 50} y1={laneY - 24} x2={W / 2 + 50} y2={laneY - 24} stroke="#f0d899" strokeWidth="1" />

          {/* Alice */}
          <g
            onMouseEnter={(e) => handleHover("alice", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={aliceX} cy={laneY} r="28" fill="#fdf8e8" stroke="#e8dcc8" strokeWidth="1.5" />
            <text x={aliceX} y={laneY - 4} fontSize="18" textAnchor="middle" style={{ pointerEvents: "none" }}>
              A
            </text>
            <text x={aliceX} y={laneY + 12} fontSize="8" fill="#6b5d4f" textAnchor="middle" fontWeight="600" style={{ pointerEvents: "none" }}>
              Alice
            </text>
          </g>

          {/* Bob */}
          <g
            onMouseEnter={(e) => handleHover("bob", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <circle cx={bobX} cy={laneY} r="28" fill="#fdf8e8" stroke="#e8dcc8" strokeWidth="1.5" />
            <text x={bobX} y={laneY - 4} fontSize="18" textAnchor="middle" style={{ pointerEvents: "none" }}>
              B
            </text>
            <text x={bobX} y={laneY + 12} fontSize="8" fill="#6b5d4f" textAnchor="middle" fontWeight="600" style={{ pointerEvents: "none" }}>
              Bob
            </text>
          </g>

          {/* Dashed flow line */}
          <line
            className="vl-naive-flow-line"
            x1={aliceX + 32} y1={laneY} x2={bobX - 32} y2={laneY}
            stroke="#e8dcc8" strokeWidth="1.5" strokeDasharray="6 4"
          />

          {/* Animated off-chain TXs */}
          <g
            onMouseEnter={(e) => handleHover("off-chain", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            {txs.map((tx) => (
              <g
                key={tx.id}
                className="vl-naive-tx"
                style={{
                  animationName: "vl-naive-slide",
                  animationDelay: `${tx.delay}s`,
                }}
              >
                <rect
                  x={aliceX + 20} y={laneY - 14}
                  width={72} height={28} rx="6"
                  fill="white" stroke="#e8dcc8" strokeWidth="1.5"
                />
                <text
                  x={aliceX + 56} y={laneY + 2}
                  fontSize="9" fontWeight="600" fill="#2a1f0d"
                  textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {tx.amount}
                </text>
              </g>
            ))}
          </g>

          {/* Red X marks over Bob's area when TXs get invalidated */}
          <g className="vl-naive-x-mark">
            <line
              x1={bobX - 50} y1={laneY - 24} x2={bobX + 10} y2={laneY + 24}
              stroke="#dc2626" strokeWidth="3" strokeLinecap="round"
            />
            <line
              x1={bobX + 10} y1={laneY - 24} x2={bobX - 50} y2={laneY + 24}
              stroke="#dc2626" strokeWidth="3" strokeLinecap="round"
            />
            <text
              x={bobX - 20} y={laneY + 44}
              fontSize="10" fontWeight="700" fill="#dc2626" textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              INVALID
            </text>
          </g>

          {/* Alice's double-spend TX */}
          <g
            className="vl-naive-doublespend-tx"
            onMouseEnter={(e) => handleHover("double-spend", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={aliceX + 20} y={laneY - 14}
              width={72} height={28} rx="6"
              fill="#dc2626" stroke="#991b1b" strokeWidth="1.5"
            />
            <text
              x={aliceX + 56} y={laneY - 2}
              fontSize="8" fontWeight="600" fill="white"
              textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              1.0 BTC
            </text>
            <text
              x={aliceX + 56} y={laneY + 10}
              fontSize="7" fill="rgba(255,255,255,0.8)"
              textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              TO ALICE
            </text>
          </g>

          {/* Arrow from double-spend to chain */}
          <defs>
            <marker id="vl-naive-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#dc2626" />
            </marker>
          </defs>
          <line
            x1={W / 2} y1={laneY + 50}
            x2={W / 2} y2={chainY - 6}
            stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 3"
            markerEnd="url(#vl-naive-arrow)"
            opacity="0.4"
          />
          <text x={W / 2 + 8} y={(laneY + 50 + chainY) / 2} fontSize="9" fill="#dc2626" fontStyle="italic">
            on-chain
          </text>

          {/* Blockchain bar */}
          <g className="vl-naive-chain">
            <rect
              x={40} y={chainY} width={W - 80} height={36} rx="8"
              fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1.5"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const bx = 52 + i * 62;
              return (
                <rect
                  key={i} x={bx} y={chainY + 6} width={50} height={24} rx="4"
                  fill={i < 5 ? "#f0d899" : "#fdf8e8"} stroke="#e8dcc8" strokeWidth="0.5"
                />
              );
            })}
            <text
              x={W / 2} y={chainY + 22} fontSize="9" fill="#6b5d4f" textAnchor="middle"
              fontWeight="600" letterSpacing="0.04em" style={{ pointerEvents: "none" }}
            >
              B L O C K C H A I N
            </text>
          </g>

          {/* Funding UTXO box */}
          <g
            onMouseEnter={(e) => handleHover("funding-utxo", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={W / 2 - 44} y={laneY + 40}
              width={88} height={28} rx="6"
              fill={hovered === "funding-utxo" ? "rgba(184, 134, 11, 0.08)" : "#fdf8e8"}
              stroke={hovered === "funding-utxo" ? "#b8860b" : "#e8dcc8"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={W / 2} y={laneY + 58}
              fontSize="9" fontWeight="600" fill="#b8860b" textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              style={{ pointerEvents: "none" }}
            >
              1.0 BTC UTXO
            </text>
          </g>
        </svg>

        {/* Tooltip */}
        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 120), 400)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
