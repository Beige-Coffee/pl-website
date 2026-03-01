import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  funding: {
    title: "Funding Output",
    description:
      "1.0 BTC locked in a 2-of-2 multisig. Both Alice and Bob must sign any transaction that spends this output. All commitment transactions reference this same output as their input.",
  },
  state1: {
    title: "State 1 — Commitment TX #1",
    description:
      "The first balance split: Alice 0.8 BTC, Bob 0.2 BTC. This is a valid Bitcoin transaction signed by both parties. Even after newer states are created, this TX remains valid because its input (the funding output) is still unspent.",
  },
  state2: {
    title: "State 2 — Commitment TX #2",
    description:
      "Updated balance: Alice 0.5 BTC, Bob 0.5 BTC. Both parties signed this new state, but they didn't destroy State 1. The old transaction is still a perfectly valid Bitcoin transaction.",
  },
  state3: {
    title: "State 3 — Commitment TX #3 (Current)",
    description:
      "Latest balance: Alice 0.3 BTC, Bob 0.7 BTC. This is the honest current state. But nothing on the Bitcoin blockchain marks this as 'current' or the others as 'old'.",
  },
  cheat: {
    title: "The Cheat",
    description:
      "Alice broadcasts State 1 (where she had 0.8 BTC) instead of State 3 (where she has 0.3 BTC). Miners don't know which state is 'current'. They just see a valid transaction with valid signatures spending an unspent output.",
  },
  result: {
    title: "Result: Bob Gets Robbed",
    description:
      "Alice steals 0.5 BTC. She receives 0.8 BTC (should get 0.3). Bob receives 0.2 BTC (should get 0.7). Without a penalty mechanism, Bob has no recourse.",
  },
};

/**
 * Animated cheating diagram for Section 5 (The Cheating Problem).
 *
 * Shows a funding TX at top, with three commitment TXs branching off below.
 * Each commitment TX spends the same funding output but with different balances.
 * Alice grabs State 1 and broadcasts it — CHEATED.
 *
 * 12s CSS animation loop.
 */
export function CheatingDiagram() {
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
  const noPtr = { pointerEvents: "none" as const };
  const mono = "'JetBrains Mono', monospace";

  const W = 480;
  const H = 460;

  // Funding TX
  const fundW = 200;
  const fundH = 44;
  const fundX = (W - fundW) / 2;
  const fundY = 52;

  // Commitment TX cards
  const cardW = 136;
  const cardH = 106;
  const cardGap = 14;
  const totalCardsW = cardW * 3 + cardGap * 2;
  const cardsStartX = (W - totalCardsW) / 2;
  const cardsY = 152;

  const states = [
    { num: 1, id: "state1", alice: "0.8", bob: "0.2", x: cardsStartX },
    { num: 2, id: "state2", alice: "0.5", bob: "0.5", x: cardsStartX + cardW + cardGap },
    { num: 3, id: "state3", alice: "0.3", bob: "0.7", x: cardsStartX + 2 * (cardW + cardGap) },
  ];

  // Result
  const resultY = 330;

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
            /* State 1 card — appears first */
            @keyframes vl-cheat-card-1 {
              0%, 8%   { opacity: 0; transform: translateY(10px); }
              14%      { opacity: 1; transform: translateY(0); }
              90%      { opacity: 1; }
              96%      { opacity: 0; }
              100%     { opacity: 0; }
            }
            /* State 2 card — appears second */
            @keyframes vl-cheat-card-2 {
              0%, 20%  { opacity: 0; transform: translateY(10px); }
              26%      { opacity: 1; transform: translateY(0); }
              90%      { opacity: 1; }
              96%      { opacity: 0; }
              100%     { opacity: 0; }
            }
            /* State 3 card — appears third */
            @keyframes vl-cheat-card-3 {
              0%, 32%  { opacity: 0; transform: translateY(10px); }
              38%      { opacity: 1; transform: translateY(0); }
              90%      { opacity: 1; }
              96%      { opacity: 0; }
              100%     { opacity: 0; }
            }

            /* State 1 card gets red highlight */
            @keyframes vl-cheat-grab {
              0%, 55% {
                stroke: #e8dcc8;
                filter: none;
              }
              62% {
                stroke: #dc2626;
                filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.5));
              }
              85% {
                stroke: #dc2626;
                filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.5));
              }
              92% {
                stroke: #e8dcc8;
                filter: none;
              }
              100% {
                stroke: #e8dcc8;
                filter: none;
              }
            }

            /* State 1 header turns red */
            @keyframes vl-cheat-header-red {
              0%, 55% { fill: #2a1f0d; }
              62%     { fill: #dc2626; }
              85%     { fill: #dc2626; }
              92%     { fill: #2a1f0d; }
              100%    { fill: #2a1f0d; }
            }

            /* "CURRENT" badge on State 3 */
            @keyframes vl-cheat-current {
              0%, 36% { opacity: 0; }
              42%     { opacity: 1; }
              90%     { opacity: 1; }
              96%     { opacity: 0; }
              100%    { opacity: 0; }
            }

            /* "All still valid!" label */
            @keyframes vl-cheat-valid {
              0%, 44% { opacity: 0; }
              50%     { opacity: 1; }
              58%     { opacity: 1; }
              62%     { opacity: 0; }
              100%    { opacity: 0; }
            }

            /* Broadcast arrow from State 1 */
            @keyframes vl-cheat-arrow {
              0%, 60% { opacity: 0; }
              66%     { opacity: 1; }
              85%     { opacity: 1; }
              92%     { opacity: 0; }
              100%    { opacity: 0; }
            }

            /* Result box */
            @keyframes vl-cheat-result {
              0%, 64% { opacity: 0; transform: scale(0.95); }
              70%     { opacity: 1; transform: scale(1); }
              85%     { opacity: 1; transform: scale(1); }
              92%     { opacity: 0; transform: scale(0.95); }
              100%    { opacity: 0; transform: scale(0.95); }
            }

            /* CHEATED stamp */
            @keyframes vl-cheat-stamp {
              0%, 68% { opacity: 0; transform: scale(2) rotate(-12deg); }
              74%     { opacity: 0.8; transform: scale(1) rotate(-12deg); }
              85%     { opacity: 0.8; transform: scale(1) rotate(-12deg); }
              92%     { opacity: 0; transform: scale(1) rotate(-12deg); }
              100%    { opacity: 0; transform: scale(2) rotate(-12deg); }
            }

            .vl-cheat-card-1 {
              animation: vl-cheat-card-1 12s ease-out infinite;
            }
            .vl-cheat-card-2 {
              animation: vl-cheat-card-2 12s ease-out infinite;
            }
            .vl-cheat-card-3 {
              animation: vl-cheat-card-3 12s ease-out infinite;
            }
            .vl-cheat-grab-rect {
              animation: vl-cheat-grab 12s ease-in-out infinite;
            }
            .vl-cheat-grab-header {
              animation: vl-cheat-header-red 12s ease-in-out infinite;
            }
            .vl-cheat-current-badge {
              animation: vl-cheat-current 12s ease-in-out infinite;
            }
            .vl-cheat-valid-label {
              animation: vl-cheat-valid 12s ease-in-out infinite;
            }
            .vl-cheat-broadcast-arrow {
              animation: vl-cheat-arrow 12s ease-in-out infinite;
            }
            .vl-cheat-result-box {
              animation: vl-cheat-result 12s ease-in-out infinite;
            }
            .vl-cheat-stamp {
              animation: vl-cheat-stamp 12s ease-in-out infinite;
            }
          `}</style>

          {/* Title */}
          <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
            The Cheating Problem
          </text>
          <text x={W / 2} y="35" fontSize="10" fill="#6b5d4f" textAnchor="middle">
            Old transactions are still valid — Alice can broadcast any of them
          </text>

          {/* ===== Funding TX ===== */}
          <g
            onMouseEnter={(e) => handleHover("funding", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={fundX} y={fundY} width={fundW} height={fundH} rx="8"
              fill={hovered === "funding" ? "rgba(184,134,11,0.08)" : "white"}
              stroke={hovered === "funding" ? "#b8860b" : "#e8dcc8"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text x={W / 2} y={fundY + 17} fontSize="10" fontWeight="700" fill="#2a1f0d" textAnchor="middle" style={noPtr}>
              Funding TX
            </text>
            <text x={W / 2} y={fundY + 32} fontSize="9" fill="#b8860b" textAnchor="middle" fontFamily={mono} style={noPtr}>
              1.0 BTC · 2-of-2 multisig
            </text>
          </g>

          {/* ===== Arrows from funding to each card ===== */}
          <defs>
            <marker id="vl-cheat-arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill="#6b5d4f" />
            </marker>
            <marker id="vl-cheat-arr-red" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill="#dc2626" />
            </marker>
          </defs>

          {/* "same input" label */}
          <text x={W / 2} y={fundY + fundH + 14} fontSize="8" fill="#6b5d4f" textAnchor="middle" fontStyle="italic">
            all spend the same output
          </text>

          {states.map((s) => (
            <line
              key={`arrow-${s.num}`}
              x1={W / 2}
              y1={fundY + fundH + 18}
              x2={s.x + cardW / 2}
              y2={cardsY - 2}
              stroke="#6b5d4f"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              markerEnd="url(#vl-cheat-arr)"
            />
          ))}

          {/* ===== Commitment TX cards ===== */}
          {states.map((s, i) => {
            const cx = s.x;
            const cy = cardsY;
            const isState1 = i === 0;
            const isState3 = i === 2;

            return (
              <g
                key={s.id}
                className={`vl-cheat-card-${i + 1}`}
                onMouseEnter={(e) => handleHover(s.id, e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Card background */}
                <rect
                  className={isState1 ? "vl-cheat-grab-rect" : undefined}
                  x={cx} y={cy} width={cardW} height={cardH} rx="6"
                  fill="white"
                  stroke={isState3 ? "#b8860b" : "#e8dcc8"}
                  strokeWidth={isState3 ? "2" : "1.5"}
                  style={{ cursor: "pointer" }}
                />

                {/* Header */}
                <text
                  className={isState1 ? "vl-cheat-grab-header" : undefined}
                  x={cx + 8} y={cy + 15}
                  fontSize="9" fontWeight="700" fill="#2a1f0d"
                  style={noPtr}
                >
                  State {s.num}
                </text>

                {/* Divider */}
                <line x1={cx + 6} y1={cy + 20} x2={cx + cardW - 6} y2={cy + 20} stroke="#e8dcc8" strokeWidth="0.5" />

                {/* Input section */}
                <text x={cx + 8} y={cy + 33} fontSize="7.5" fill="#6b5d4f" fontWeight="600" letterSpacing="0.03em" style={noPtr}>
                  INPUT
                </text>
                <text x={cx + 8} y={cy + 45} fontSize="8" fill="#2a1f0d" fontFamily={mono} style={noPtr}>
                  funding:0
                </text>

                {/* Divider */}
                <line x1={cx + 6} y1={cy + 50} x2={cx + cardW - 6} y2={cy + 50} stroke="#e8dcc8" strokeWidth="0.5" />

                {/* Outputs section */}
                <text x={cx + 8} y={cy + 63} fontSize="7.5" fill="#6b5d4f" fontWeight="600" letterSpacing="0.03em" style={noPtr}>
                  OUTPUTS
                </text>
                <text x={cx + 8} y={cy + 77} fontSize="9" fill="#6b5d4f" style={noPtr}>Alice:</text>
                <text x={cx + cardW - 8} y={cy + 77} fontSize="9" fontWeight="700" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>
                  {s.alice} BTC
                </text>
                <text x={cx + 8} y={cy + 92} fontSize="9" fill="#6b5d4f" style={noPtr}>Bob:</text>
                <text x={cx + cardW - 8} y={cy + 92} fontSize="9" fontWeight="700" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>
                  {s.bob} BTC
                </text>

                {/* "CURRENT" badge on State 3 */}
                {isState3 && (
                  <g className="vl-cheat-current-badge">
                    <rect
                      x={cx + cardW - 60} y={cy + 3}
                      width={52} height={16} rx="3"
                      fill="#b8860b"
                    />
                    <text
                      x={cx + cardW - 34} y={cy + 14}
                      fontSize="7" fontWeight="700" fill="white" textAnchor="middle"
                      style={noPtr}
                    >
                      CURRENT
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* "All still valid!" label */}
          <text
            className="vl-cheat-valid-label"
            x={W / 2} y={cardsY + cardH + 20}
            fontSize="10" fontWeight="700" fill="#dc2626" textAnchor="middle"
          >
            All three are still valid Bitcoin transactions!
          </text>

          {/* ===== Broadcast arrow from State 1 ===== */}
          <g
            className="vl-cheat-broadcast-arrow"
            onMouseEnter={(e) => handleHover("cheat", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <path
              d={`M ${states[0].x + cardW / 2} ${cardsY + cardH + 4} L ${states[0].x + cardW / 2} ${resultY - 8}`}
              fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="6 3"
              markerEnd="url(#vl-cheat-arr-red)"
            />
            <text
              x={states[0].x + cardW / 2 + 10} y={cardsY + cardH + 36}
              fontSize="9" fontWeight="700" fill="#dc2626"
              style={noPtr}
            >
              BROADCAST!
            </text>
          </g>

          {/* ===== Result box ===== */}
          <g
            className="vl-cheat-result-box"
            onMouseEnter={(e) => handleHover("result", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={30} y={resultY}
              width={W - 60} height={56} rx="8"
              fill="#fef2f2" stroke="#dc2626" strokeWidth="1.5"
            />
            <text x={46} y={resultY + 18} fontSize="10" fontWeight="700" fill="#dc2626" style={noPtr}>
              Alice broadcasts State 1 instead of State 3
            </text>
            <text x={46} y={resultY + 34} fontSize="9" fill="#991b1b" style={noPtr}>
              Alice gets 0.8 BTC (should get 0.3) · Bob gets 0.2 BTC (should get 0.7)
            </text>
            <text x={46} y={resultY + 48} fontSize="9" fontWeight="600" fill="#dc2626" style={noPtr}>
              Bob loses 0.5 BTC — and can't do anything about it
            </text>
          </g>

          {/* ===== CHEATED stamp ===== */}
          <text
            className="vl-cheat-stamp"
            x={W / 2 + 60} y={resultY - 10}
            fontSize="28" fontWeight="900" fill="rgba(220, 38, 38, 0.25)"
            textAnchor="middle"
            style={noPtr}
          >
            CHEATED
          </text>

          {/* Bottom note */}
          <text x={W / 2} y={H - 18} fontSize="9" fill="#6b5d4f" textAnchor="middle" fontStyle="italic">
            We need a way to punish Alice for broadcasting old states
          </text>
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
