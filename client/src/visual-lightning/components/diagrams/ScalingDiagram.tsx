/**
 * Animated block-filling diagram for Section 2 (The Scaling Problem).
 *
 * Shows transactions queuing up, filling into a block (limited space),
 * the block getting mined, shrinking, and becoming a new confirmed block on the chain.
 * Pending TXs keep waiting.
 *
 * Animation loop (10s):
 *  0-3s:   TXs slide from the queue into block slots (one by one)
 *  3-5s:   "BLOCK FULL" appears, block starts mining glow
 *  5-7s:   Block shrinks and flies to the top of the confirmed chain
 *  7-8.5s: Existing chain blocks shift down, new block settles at top
 *  8.5-10s: Empty block fades back in, TXs reset to queue
 *
 * Pure CSS animation — no JS timers.
 */
export function ScalingDiagram() {
  const W = 480;
  const H = 380;

  // Queue area (left)
  const queueX = 30;
  const queueW = 90;

  // Current block (center)
  const blockX = 170;
  const blockW = 120;
  const blockY = 80;
  const blockH = 200;

  // Chain area (right)
  const chainX = 340;
  const chainBlockW = 90;
  const chainBlockH = 50;
  const chainGap = 10;
  const chainTopY = blockY;

  // TX dimensions
  const txW = 80;
  const txH = 24;

  // Slot positions inside the block (where TXs land)
  const slotPadX = 10;
  const slotH = 36;
  const slotGap = 6;
  const slotStartY = blockY + 12;

  // Queued TXs (they wait on the left)
  const queuedTxs = [
    { id: 1, label: "tx1", y: 90 },
    { id: 2, label: "tx2", y: 120 },
    { id: 3, label: "tx3", y: 150 },
    { id: 4, label: "tx4", y: 180 },
    { id: 5, label: "tx5", y: 210 },
    { id: 6, label: "tx6", y: 240 },
    { id: 7, label: "tx7", y: 270 },
  ];

  // Only tx1-tx4 make it into the block; tx5-tx7 stay waiting
  const fitCount = 4;

  // Calculate the target position for each fitting TX inside the block
  const slotTargets = Array.from({ length: fitCount }, (_, i) => ({
    x: blockX + slotPadX,
    y: slotStartY + i * (slotH + slotGap),
  }));

  // Chain block positions (static ones — 823003, 823002, 823001)
  // These shift down when the new block arrives
  const staticChainBlocks = [
    { label: "Block 823003", baseY: chainTopY },
    { label: "Block 823002", baseY: chainTopY + (chainBlockH + chainGap) },
    { label: "Block 823001", baseY: chainTopY + 2 * (chainBlockH + chainGap) },
  ];

  // New confirmed block target: top of chain
  const newBlockTargetX = chainX + 10;
  const newBlockTargetY = chainTopY;

  // The center block needs to translate to the chain position and shrink
  const blockCenterX = blockX + blockW / 2;
  const blockCenterY = blockY + blockH / 2;
  const newBlockCenterX = newBlockTargetX + chainBlockW / 2;
  const newBlockCenterY = newBlockTargetY + chainBlockH / 2;
  const translateFlyX = newBlockCenterX - blockCenterX;
  const translateFlyY = newBlockCenterY - blockCenterY;
  const scaleX = chainBlockW / blockW;
  const scaleY = chainBlockH / blockH;

  // Chain shift amount when new block arrives
  const chainShift = chainBlockH + chainGap;

  return (
    <div className="vl-card-3d relative select-none" style={{ maxWidth: 680, margin: "0 auto" }}>
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
            /* ===== TX ANIMATIONS ===== */
            /* Each TX slides from queue to its slot inside the block, then fades when block mines */
            ${Array.from({ length: fitCount }, (_, i) => {
              const tx = queuedTxs[i];
              const slot = slotTargets[i];
              const dx = slot.x - queueX;
              const dy = slot.y - tx.y;
              const entryPct = 5 + i * 7; // staggered entry: 5%, 12%, 19%, 26%
              const settledPct = entryPct + 10;
              return `
            @keyframes vl-scale-fill-${i} {
              0%         { transform: translate(0px, 0px); opacity: 1; }
              ${entryPct}%   { transform: translate(0px, 0px); opacity: 1; }
              ${settledPct}% { transform: translate(${dx}px, ${dy}px); opacity: 1; }
              50%        { transform: translate(${dx}px, ${dy}px); opacity: 1; }
              /* Fade out as block mines and flies away */
              58%        { transform: translate(${dx}px, ${dy}px); opacity: 0; }
              /* Reset to queue while hidden */
              78%        { transform: translate(0px, 0px); opacity: 0; }
              88%        { transform: translate(0px, 0px); opacity: 1; }
              100%       { transform: translate(0px, 0px); opacity: 1; }
            }
            .vl-scale-tx-fit-${i} {
              animation: vl-scale-fill-${i} 10s ease-in-out infinite;
            }`;
            }).join("\n")}

            /* Waiting TXs (don't fit) — pulse red when block is full */
            @keyframes vl-scale-wait {
              0%, 30%  { fill: white; stroke: #e8dcc8; }
              40%      { fill: #fef2f2; stroke: #fca5a5; }
              55%      { fill: #fef2f2; stroke: #fca5a5; }
              65%      { fill: white; stroke: #e8dcc8; }
              100%     { fill: white; stroke: #e8dcc8; }
            }

            /* ===== BLOCK SLOT FILL ===== */
            /* Slots glow golden as TXs land in them */
            ${Array.from({ length: fitCount }, (_, i) => {
              const fillPct = 15 + i * 7; // matches when TX arrives
              return `
            @keyframes vl-scale-slot-${i} {
              0%, ${fillPct - 2}% { fill: #fefdfb; stroke: #f0d899; opacity: 0.4; }
              ${fillPct}%         { fill: #f0d899; stroke: #d4a038; opacity: 0.85; }
              50%                 { fill: #f0d899; stroke: #d4a038; opacity: 0.85; }
              58%                 { fill: #f0d899; stroke: #d4a038; opacity: 0; }
              78%                 { fill: #fefdfb; stroke: #f0d899; opacity: 0; }
              85%                 { fill: #fefdfb; stroke: #f0d899; opacity: 0.4; }
              100%                { fill: #fefdfb; stroke: #f0d899; opacity: 0.4; }
            }
            .vl-scale-slot-${i} {
              animation: vl-scale-slot-${i} 10s ease-in-out infinite;
            }`;
            }).join("\n")}

            /* ===== BLOCK OUTLINE ANIMATION ===== */
            /* Block outline: normal -> gold glow -> shrink & fly to chain -> reset */
            @keyframes vl-scale-block {
              0%       { stroke: #e8dcc8; fill: rgba(255,255,255,0.6); opacity: 1;
                         transform: translate(0px, 0px) scale(1); filter: none; }
              35%      { stroke: #d4a038; fill: rgba(253,248,232,0.6); opacity: 1;
                         transform: translate(0px, 0px) scale(1); filter: none; }
              /* Mining glow */
              45%      { stroke: #b8860b; fill: rgba(240,216,153,0.4); opacity: 1;
                         transform: translate(0px, 0px) scale(1);
                         filter: drop-shadow(0 0 8px rgba(184,134,11,0.5)); }
              50%      { stroke: #b8860b; fill: rgba(240,216,153,0.6); opacity: 1;
                         transform: translate(0px, 0px) scale(1);
                         filter: drop-shadow(0 0 12px rgba(184,134,11,0.6)); }
              /* Shrink and fly to chain */
              55%      { stroke: #b8860b; fill: #f0d899; opacity: 1;
                         transform: translate(0px, 0px) scale(1);
                         filter: drop-shadow(0 0 6px rgba(184,134,11,0.3)); }
              68%      { stroke: #d4a038; fill: #f0d899; opacity: 1;
                         transform: translate(${translateFlyX}px, ${translateFlyY}px) scale(${scaleX}, ${scaleY});
                         filter: none; }
              /* Hold at chain position briefly */
              74%      { stroke: #d4a038; fill: #f0d899; opacity: 1;
                         transform: translate(${translateFlyX}px, ${translateFlyY}px) scale(${scaleX}, ${scaleY});
                         filter: none; }
              /* Fade out (static block takes over) */
              78%      { stroke: #d4a038; fill: #f0d899; opacity: 0;
                         transform: translate(${translateFlyX}px, ${translateFlyY}px) scale(${scaleX}, ${scaleY});
                         filter: none; }
              /* Reset to center position while hidden */
              82%      { stroke: #e8dcc8; fill: rgba(255,255,255,0.6); opacity: 0;
                         transform: translate(0px, 0px) scale(1); filter: none; }
              88%      { stroke: #e8dcc8; fill: rgba(255,255,255,0.6); opacity: 1;
                         transform: translate(0px, 0px) scale(1); filter: none; }
              100%     { stroke: #e8dcc8; fill: rgba(255,255,255,0.6); opacity: 1;
                         transform: translate(0px, 0px) scale(1); filter: none; }
            }

            /* ===== BLOCK LABEL (above block) ===== */
            @keyframes vl-scale-block-label {
              0%       { opacity: 1; }
              52%      { opacity: 1; }
              58%      { opacity: 0; }
              82%      { opacity: 0; }
              88%      { opacity: 1; }
              100%     { opacity: 1; }
            }

            /* ===== CAPACITY LABEL (~4 MB) ===== */
            @keyframes vl-scale-capacity-label {
              0%       { opacity: 1; }
              52%      { opacity: 1; }
              58%      { opacity: 0; }
              82%      { opacity: 0; }
              88%      { opacity: 1; }
              100%     { opacity: 1; }
            }

            /* ===== CHAIN BLOCKS SHIFT DOWN ===== */
            @keyframes vl-scale-chain-shift {
              0%, 65%   { transform: translateY(0px); }
              74%       { transform: translateY(${chainShift}px); }
              100%      { transform: translateY(${chainShift}px); }
            }

            /* ===== NEW CONFIRMED BLOCK (static version at chain top) ===== */
            @keyframes vl-scale-confirmed-static {
              0%, 74%   { opacity: 0; }
              78%       { opacity: 1; }
              100%      { opacity: 1; }
            }

            /* ===== CHAIN LINK from new block ===== */
            @keyframes vl-scale-chain-link-new {
              0%, 74%   { opacity: 0; }
              78%       { opacity: 1; }
              100%      { opacity: 1; }
            }

            /* "FULL" label */
            @keyframes vl-scale-full {
              0%, 32%  { opacity: 0; }
              38%      { opacity: 1; }
              52%      { opacity: 1; }
              58%      { opacity: 0; }
              100%     { opacity: 0; }
            }

            /* Mining label */
            @keyframes vl-scale-mining {
              0%, 40%  { opacity: 0; }
              45%      { opacity: 1; }
              52%      { opacity: 1; }
              58%      { opacity: 0; }
              100%     { opacity: 0; }
            }

            /* Dashed arrows fade during block fly */
            @keyframes vl-scale-arrow-fade {
              0%       { opacity: 1; }
              52%      { opacity: 1; }
              58%      { opacity: 0; }
              82%      { opacity: 0; }
              88%      { opacity: 1; }
              100%     { opacity: 1; }
            }

            .vl-scale-tx-wait rect {
              animation: vl-scale-wait 10s ease-in-out infinite;
            }
            .vl-scale-block-rect {
              animation: vl-scale-block 10s ease-in-out infinite;
              transform-origin: ${blockCenterX}px ${blockCenterY}px;
            }
            .vl-scale-block-label {
              animation: vl-scale-block-label 10s ease-in-out infinite;
            }
            .vl-scale-capacity-label {
              animation: vl-scale-capacity-label 10s ease-in-out infinite;
            }
            .vl-scale-mining-label {
              animation: vl-scale-mining 10s ease-in-out infinite;
            }
            .vl-scale-full-label {
              animation: vl-scale-full 10s ease-in-out infinite;
            }
            .vl-scale-chain-shift {
              animation: vl-scale-chain-shift 10s ease-in-out infinite;
            }
            .vl-scale-confirmed-static {
              animation: vl-scale-confirmed-static 10s ease-in-out infinite;
            }
            .vl-scale-chain-link-new {
              animation: vl-scale-chain-link-new 10s ease-in-out infinite;
            }
            .vl-scale-arrow-fade {
              animation: vl-scale-arrow-fade 10s ease-in-out infinite;
            }
          `}</style>

          {/* Title */}
          <text x={W / 2} y="24" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
            The Scaling Problem
          </text>
          <text x={W / 2} y="40" fontSize="10" fill="#6b5d4f" textAnchor="middle">
            Blocks have limited space — transactions must wait
          </text>

          {/* ===== QUEUE LABEL ===== */}
          <text x={queueX + queueW / 2} y={blockY - 6} fontSize="9" fill="#6b5d4f" textAnchor="middle" fontWeight="600" letterSpacing="0.04em">
            PENDING
          </text>

          {/* ===== QUEUED TXS ===== */}
          {queuedTxs.map((tx, i) => {
            const fits = i < fitCount;
            return (
              <g
                key={tx.id}
                className={fits ? `vl-scale-tx-fit-${i}` : "vl-scale-tx-wait"}
              >
                <rect
                  x={queueX} y={tx.y}
                  width={txW} height={txH} rx="4"
                  fill="white" stroke="#e8dcc8" strokeWidth="1"
                />
                <text
                  x={queueX + txW / 2} y={tx.y + 16}
                  fontSize="9" fontWeight="600" fill="#2a1f0d" textAnchor="middle"
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {tx.label}
                </text>
              </g>
            );
          })}

          {/* "Still waiting..." label for remaining TXs */}
          <text x={queueX + txW / 2} y={queuedTxs[queuedTxs.length - 1].y + 42} fontSize="8" fill="#dc2626" textAnchor="middle" fontStyle="italic">
            still waiting...
          </text>

          {/* ===== CURRENT BLOCK ===== */}
          {/* Block outline — this is the element that shrinks and flies */}
          <rect
            className="vl-scale-block-rect"
            x={blockX} y={blockY}
            width={blockW} height={blockH} rx="8"
            fill="rgba(255,255,255,0.6)" stroke="#e8dcc8" strokeWidth="2"
          />

          {/* Block header */}
          <text className="vl-scale-block-label" x={blockX + blockW / 2} y={blockY - 6} fontSize="9" fill="#2a1f0d" textAnchor="middle" fontWeight="700" letterSpacing="0.04em">
            BLOCK
          </text>

          {/* Block capacity slot indicators (4 slots) — these fill as TXs arrive */}
          {slotTargets.map((slot, i) => (
            <rect
              key={i}
              className={`vl-scale-slot-${i}`}
              x={slot.x} y={slot.y}
              width={blockW - 2 * slotPadX} height={slotH} rx="5"
              fill="#fefdfb" stroke="#f0d899" strokeWidth="0.5"
              opacity="0.4"
            />
          ))}

          {/* Capacity label */}
          <text className="vl-scale-capacity-label" x={blockX + blockW / 2} y={blockY + blockH - 8} fontSize="8" fill="#6b5d4f" textAnchor="middle" fontWeight="600">
            ~4 MB limit
          </text>

          {/* "FULL" label */}
          <text
            className="vl-scale-full-label"
            x={blockX + blockW / 2} y={blockY + blockH + 18}
            fontSize="10" fontWeight="700" fill="#dc2626" textAnchor="middle"
          >
            BLOCK FULL
          </text>

          {/* Mining label */}
          <g className="vl-scale-mining-label">
            <text
              x={blockX + blockW / 2} y={blockY + blockH + 36}
              fontSize="9" fontWeight="600" fill="#b8860b" textAnchor="middle"
            >
              Mining...
            </text>
          </g>

          {/* ===== MINED CHAIN (right) ===== */}
          <text x={chainX + chainBlockW / 2 + 10} y={blockY - 6} fontSize="9" fill="#6b5d4f" textAnchor="middle" fontWeight="600" letterSpacing="0.04em">
            CONFIRMED
          </text>

          {/* Static confirmed block that appears at chain top after the animated block arrives */}
          <g className="vl-scale-confirmed-static">
            <rect
              x={chainX + 10} y={chainTopY}
              width={chainBlockW} height={chainBlockH} rx="6"
              fill="#f0d899" stroke="#d4a038" strokeWidth="1.5"
            />
            <text
              x={chainX + 10 + chainBlockW / 2} y={chainTopY + chainBlockH / 2 + 4}
              fontSize="9" fontWeight="600" fill="#8a6508" textAnchor="middle"
              style={{ pointerEvents: "none" }}
            >
              Block 823004
            </text>
          </g>

          {/* Chain link from new block to next */}
          <line
            className="vl-scale-chain-link-new"
            x1={chainX + 10 + chainBlockW / 2} y1={chainTopY + chainBlockH}
            x2={chainX + 10 + chainBlockW / 2} y2={chainTopY + chainBlockH + chainGap}
            stroke="#d4a038" strokeWidth="1.5"
          />

          {/* Previously mined blocks (shift down when new block arrives) */}
          <g className="vl-scale-chain-shift">
            {staticChainBlocks.map((block, i) => (
              <g key={i}>
                <rect
                  x={chainX + 10} y={block.baseY}
                  width={chainBlockW} height={chainBlockH} rx="6"
                  fill="#f0d899" stroke="#d4a038" strokeWidth="1"
                />
                <text
                  x={chainX + 10 + chainBlockW / 2} y={block.baseY + chainBlockH / 2 + 4}
                  fontSize="9" fontWeight="600" fill="#8a6508" textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {block.label}
                </text>
                {/* Chain link between blocks */}
                {i < staticChainBlocks.length - 1 && (
                  <line
                    x1={chainX + 10 + chainBlockW / 2} y1={block.baseY + chainBlockH}
                    x2={chainX + 10 + chainBlockW / 2} y2={block.baseY + chainBlockH + chainGap}
                    stroke="#d4a038" strokeWidth="1.5"
                  />
                )}
              </g>
            ))}
          </g>

          {/* ===== ANNOTATIONS ===== */}
          {/* Arrow from queue to block */}
          <defs>
            <marker id="vl-scale-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6b5d4f" />
            </marker>
          </defs>
          <line
            className="vl-scale-arrow-fade"
            x1={queueX + txW + 6} y1={blockY + blockH / 2}
            x2={blockX - 6} y2={blockY + blockH / 2}
            stroke="#6b5d4f" strokeWidth="1.5" strokeDasharray="4 3"
            markerEnd="url(#vl-scale-arrow)"
          />

          {/* Arrow from block to chain */}
          <line
            className="vl-scale-arrow-fade"
            x1={blockX + blockW + 6} y1={blockY + blockH / 2}
            x2={chainX + 4} y2={blockY + blockH / 2}
            stroke="#b8860b" strokeWidth="1.5" strokeDasharray="4 3"
            markerEnd="url(#vl-scale-arrow)"
          />

          {/* Throughput label at bottom */}
          <text x={W / 2} y={H - 16} fontSize="10" fill="#6b5d4f" textAnchor="middle" fontWeight="600">
            Average throughput: ~7 transactions per second
          </text>
        </svg>
      </div>
    </div>
  );
}
