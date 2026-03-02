import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  funding: {
    title: "Shared Funding Output",
    description:
      "Both commitment transactions spend this same 2-of-2 multisig output. Only one can ever be broadcast on-chain.",
  },
  "alice-txid": {
    title: "Alice's Commitment TXID",
    description:
      "Alice holds this transaction with Bob's signature pre-applied. She can broadcast it any time without Bob's cooperation.",
  },
  "bob-txid": {
    title: "Bob's Commitment TXID",
    description:
      "Bob holds this transaction with Alice's signature pre-applied. He can broadcast it any time without Alice's cooperation.",
  },
  "alice-version": {
    title: "Transaction Version",
    description:
      "Version 2 enables OP_CHECKSEQUENCEVERIFY (CSV), essential for the to_local delay that makes revocation possible.",
  },
  "bob-version": {
    title: "Transaction Version",
    description:
      "Version 2 enables OP_CHECKSEQUENCEVERIFY (CSV), essential for the to_local delay that makes revocation possible.",
  },
  "alice-locktime": {
    title: "Locktime",
    description:
      "In real commitment transactions, the locktime encodes part of the obscured commitment number, used to identify which state this represents.",
  },
  "bob-locktime": {
    title: "Locktime",
    description:
      "In real commitment transactions, the locktime encodes part of the obscured commitment number, used to identify which state this represents.",
  },
  "alice-input": {
    title: "Funding Input",
    description:
      "Spends the shared 2-of-2 multisig funding output. Both Alice's and Bob's commitment TXs reference the exact same outpoint.",
  },
  "bob-input": {
    title: "Funding Input",
    description:
      "Spends the shared 2-of-2 multisig funding output. Both Alice's and Bob's commitment TXs reference the exact same outpoint.",
  },
  "alice-sequence": {
    title: "Sequence (nSequence)",
    description:
      "In real commitment TXs, the upper bits encode the other half of the obscured commitment number. 0x80000000 sets the disable-timelock flag while still encoding state info.",
  },
  "bob-sequence": {
    title: "Sequence (nSequence)",
    description:
      "In real commitment TXs, the upper bits encode the other half of the obscured commitment number. 0x80000000 sets the disable-timelock flag while still encoding state info.",
  },
  "alice-local": {
    title: "to_local (Alice — Delayed)",
    description:
      "Alice's own balance. She must wait to_self_delay blocks (CSV) before spending. This delay gives Bob time to check if Alice broadcast an old, revoked state.",
  },
  "alice-remote": {
    title: "to_remote (Bob — Immediate)",
    description:
      "Bob's balance on Alice's commitment TX. Bob can claim this immediately, no delay. Since Alice chose to broadcast, Bob gets his funds right away.",
  },
  "bob-local": {
    title: "to_local (Bob — Delayed)",
    description:
      "Bob's own balance. He must wait to_self_delay blocks (CSV) before spending. This delay gives Alice time to check if Bob broadcast an old, revoked state.",
  },
  "bob-remote": {
    title: "to_remote (Alice — Immediate)",
    description:
      "Alice's balance on Bob's commitment TX. Alice can claim this immediately, no delay. Since Bob chose to broadcast, Alice gets her funds right away.",
  },
  "alice-witness": {
    title: "Witness (Alice's TX)",
    description:
      "Contains Bob's signature (pre-provided). Alice adds her own signature when she wants to broadcast. Together they satisfy the 2-of-2 multisig.",
  },
  "bob-witness": {
    title: "Witness (Bob's TX)",
    description:
      "Contains Alice's signature (pre-provided). Bob adds his own signature when he wants to broadcast. Together they satisfy the 2-of-2 multisig.",
  },
};

interface CardDef {
  prefix: string;
  x: number;
  label: string;
  subtitle: string;
  txid: string;
  localOwner: string;
  localValue: string;
  remoteOwner: string;
  remoteValue: string;
  witnessLabel: string;
}

export function CommitmentPairDiagram() {
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

  // Layout
  const W = 576;
  const cardW = 256;
  const cardGap = 20;
  const leftX = (W - cardW * 2 - cardGap) / 2;
  const rightX = leftX + cardW + cardGap;
  const pad = 8;
  const innerW = cardW - pad * 2;
  const mono = "'JetBrains Mono', monospace";

  // Card-relative Y offsets
  const titleH = 36;
  const verOff = titleH;
  const lockOff = verOff + 26;
  const inpOff = lockOff + 30;
  const inpHeadH = 20;
  const inpBoxH = 68;
  const inpSecH = inpHeadH + inpBoxH + 8;
  const outOff = inpOff + inpSecH;
  const outHeadH = 20;
  const outBoxH = 50;
  const outSecH = outHeadH + outBoxH + 6 + outBoxH + 8;
  const witOff = outOff + outSecH;
  const witHeadH = 20;
  const witRowH = 22;
  const cardH = witOff + witHeadH + witRowH + pad;

  // Global Y
  const fundY = 52;
  const fundH = 36;
  const cardsY = fundY + fundH + 30;
  const legendY = cardsY + cardH + 14;
  const H = legendY + 42;

  // Helpers
  const fill = (region: string) =>
    hovered === region ? "rgba(184, 134, 11, 0.08)" : "#fefdfb";
  const stroke = (region: string) =>
    hovered === region ? "#b8860b" : "#e8dcc8";
  const hoverProps = (region: string) => ({
    onMouseEnter: (e: React.MouseEvent) => handleHover(region, e),
    onMouseMove: handleMouseMove,
    onMouseLeave: () => setHovered(null),
    style: { cursor: "pointer" as const },
  });
  const noPtr = { pointerEvents: "none" as const };

  const cards: CardDef[] = [
    {
      prefix: "alice",
      x: leftX,
      label: "Alice's Commitment TX",
      subtitle: "(holds Bob's signature)",
      txid: "a1c0mm1t...",
      localOwner: "Alice",
      localValue: "70,000,000",
      remoteOwner: "Bob",
      remoteValue: "30,000,000",
      witnessLabel: "<alice_sig>  <bob_sig>",
    },
    {
      prefix: "bob",
      x: rightX,
      label: "Bob's Commitment TX",
      subtitle: "(holds Alice's signature)",
      txid: "b0bc0mm1t...",
      localOwner: "Bob",
      localValue: "30,000,000",
      remoteOwner: "Alice",
      remoteValue: "70,000,000",
      witnessLabel: "<alice_sig>  <bob_sig>",
    },
  ];

  function renderCard(c: CardDef) {
    const { prefix, x } = c;
    const y = cardsY;
    const bx = x + pad; // inner box X
    const bw = innerW;  // inner box width
    const ibx = bx + 16; // input/output box X (indented)
    const ibw = bw - 20; // input/output box width

    return (
      <g key={prefix}>
        {/* Card background */}
        <rect
          x={x} y={y} width={cardW} height={cardH} rx="8"
          fill="white" stroke="#e8dcc8" strokeWidth="1.5"
        />

        {/* ─── TXID header ─── */}
        <g {...hoverProps(`${prefix}-txid`)}>
          <rect
            x={x} y={y} width={cardW} height={titleH} rx="8"
            fill={hovered === `${prefix}-txid` ? "rgba(184,134,11,0.08)" : "transparent"}
            stroke={hovered === `${prefix}-txid` ? "#b8860b" : "transparent"}
            strokeWidth="1.5"
            style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <rect x={x} y={y + 28} width={cardW} height={8} fill={hovered === `${prefix}-txid` ? "rgba(184,134,11,0.08)" : "transparent"} style={noPtr} />
          <text x={x + cardW / 2} y={y + 16} fontSize="10" fontWeight="700" fill="#2a1f0d" textAnchor="middle" style={noPtr}>
            {c.label}
          </text>
          <text x={x + cardW / 2} y={y + 29} fontSize="8" fill="#6b5d4f" textAnchor="middle" style={noPtr}>
            {c.subtitle}
          </text>
        </g>

        {/* ─── version ─── */}
        <g {...hoverProps(`${prefix}-version`)}>
          <rect
            x={bx} y={y + verOff} width={bw} height={22} rx="4"
            fill={fill(`${prefix}-version`)} stroke={stroke(`${prefix}-version`)}
            strokeWidth="1" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={bx + 8} y={y + verOff + 15} fontSize="9" fill="#6b5d4f" style={noPtr}>version:</text>
          <text x={bx + bw - 8} y={y + verOff + 15} fontSize="9" fontWeight="700" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>2</text>
        </g>

        {/* ─── locktime ─── */}
        <g {...hoverProps(`${prefix}-locktime`)}>
          <rect
            x={bx} y={y + lockOff} width={bw} height={22} rx="4"
            fill={fill(`${prefix}-locktime`)} stroke={stroke(`${prefix}-locktime`)}
            strokeWidth="1" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={bx + 8} y={y + lockOff + 15} fontSize="9" fill="#6b5d4f" style={noPtr}>locktime:</text>
          <text x={bx + bw - 8} y={y + lockOff + 15} fontSize="9" fontWeight="700" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>0</text>
        </g>

        {/* ─── Inputs section ─── */}
        <rect x={bx} y={y + inpOff} width={bw} height={inpSecH - 4} rx="4" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="0.5" />
        <text x={bx + 8} y={y + inpOff + 14} fontSize="9" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em" style={noPtr}>Inputs</text>
        <line x1={bx + 8} y1={y + inpOff + 18} x2={bx + bw - 8} y2={y + inpOff + 18} stroke="#e8dcc8" strokeWidth="0.5" />

        {/* Input 0 index label */}
        <text x={bx + 8} y={y + inpOff + inpHeadH + 14} fontSize="9" fill="#6b5d4f">0:</text>

        {/* Input 0 box */}
        <g {...hoverProps(`${prefix}-input`)}>
          <rect
            x={ibx} y={y + inpOff + inpHeadH + 2} width={ibw} height={inpBoxH - 4} rx="3"
            fill={hovered === `${prefix}-input` ? "rgba(184,134,11,0.04)" : "white"}
            stroke={hovered === `${prefix}-input` ? "#b8860b" : "#e8dcc8"}
            strokeWidth="0.75" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={ibx + 6} y={y + inpOff + inpHeadH + 16} fontSize="8" fill="#6b5d4f" style={noPtr}>txid:</text>
          <text x={ibx + ibw - 6} y={y + inpOff + inpHeadH + 16} fontSize="8" fontWeight="600" fill="#2a1f0d" fontFamily={mono} textAnchor="end" style={noPtr}>AliceBobFunding1</text>

          <text x={ibx + 6} y={y + inpOff + inpHeadH + 30} fontSize="8" fill="#6b5d4f" style={noPtr}>index:</text>
          <text x={ibx + ibw - 6} y={y + inpOff + inpHeadH + 30} fontSize="8" fontWeight="600" fill="#2a1f0d" fontFamily={mono} textAnchor="end" style={noPtr}>0</text>

          <text x={ibx + 6} y={y + inpOff + inpHeadH + 44} fontSize="8" fill="#6b5d4f" style={noPtr}>scriptSig:</text>
          <text x={ibx + ibw - 6} y={y + inpOff + inpHeadH + 44} fontSize="8" fill="#6b5d4f" fontStyle="italic" textAnchor="end" style={noPtr}>(empty)</text>
        </g>

        {/* Sequence (separate hover region) */}
        <g {...hoverProps(`${prefix}-sequence`)}>
          <rect x={ibx} y={y + inpOff + inpHeadH + 50} width={ibw} height={14} rx="0" fill="transparent" />
          <text x={ibx + 6} y={y + inpOff + inpHeadH + 60} fontSize="8" fill="#6b5d4f" style={noPtr}>sequence:</text>
          <text x={ibx + ibw - 6} y={y + inpOff + inpHeadH + 60} fontSize="8" fontWeight="600" fill="#2a1f0d" fontFamily={mono} textAnchor="end" style={noPtr}>0x80000000</text>
        </g>

        {/* ─── Outputs section ─── */}
        {(() => {
          // BOLT 3: sort outputs by lowest value first
          const localNum = parseInt(c.localValue.replace(/,/g, ""), 10);
          const remoteNum = parseInt(c.remoteValue.replace(/,/g, ""), 10);
          const localFirst = localNum <= remoteNum;

          const out0Y = y + outOff + outHeadH;
          const out1Y = y + outOff + outHeadH + outBoxH + 6;

          const firstOutput = localFirst ? "local" : "remote";
          const secondOutput = localFirst ? "remote" : "local";

          const renderLocal = (baseY: number, idx: number) => (
            <g key="local">
              <text x={bx + 8} y={baseY + 14} fontSize="9" fill="#6b5d4f">{idx}:</text>
              <g {...hoverProps(`${prefix}-local`)}>
                <rect
                  x={ibx} y={baseY + 2} width={ibw} height={outBoxH - 4} rx="3"
                  fill={hovered === `${prefix}-local` ? "rgba(184,134,11,0.08)" : "#fdf8e8"}
                  stroke={hovered === `${prefix}-local` ? "#b8860b" : "#d4a038"}
                  strokeWidth="0.75" strokeDasharray="4 2"
                  style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                />
                <text x={ibx + 6} y={baseY + 16} fontSize="8" fill="#6b5d4f" style={noPtr}>value:</text>
                <text x={ibx + ibw - 6} y={baseY + 16} fontSize="8" fontWeight="600" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{c.localValue}</text>

                <text x={ibx + 6} y={baseY + 30} fontSize="8" fill="#6b5d4f" style={noPtr}>scriptPubKey:</text>
                <text x={ibx + ibw - 6} y={baseY + 30} fontSize="8" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{"OP_0 <script_hash>"}</text>

                <text x={ibx + ibw / 2 + 6} y={baseY + 43} fontSize="7.5" fontWeight="600" fill="#b8860b" textAnchor="middle" style={noPtr}>
                  {c.localOwner} (DELAYED)
                </text>
              </g>
            </g>
          );

          const renderRemote = (baseY: number, idx: number) => (
            <g key="remote">
              <text x={bx + 8} y={baseY + 14} fontSize="9" fill="#6b5d4f">{idx}:</text>
              <g {...hoverProps(`${prefix}-remote`)}>
                <rect
                  x={ibx} y={baseY + 2} width={ibw} height={outBoxH - 4} rx="3"
                  fill={hovered === `${prefix}-remote` ? "rgba(184,134,11,0.04)" : "white"}
                  stroke={hovered === `${prefix}-remote` ? "#b8860b" : "#e8dcc8"}
                  strokeWidth="0.75"
                  style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                />
                <text x={ibx + 6} y={baseY + 16} fontSize="8" fill="#6b5d4f" style={noPtr}>value:</text>
                <text x={ibx + ibw - 6} y={baseY + 16} fontSize="8" fontWeight="600" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{c.remoteValue}</text>

                <text x={ibx + 6} y={baseY + 30} fontSize="8" fill="#6b5d4f" style={noPtr}>scriptPubKey:</text>
                <text x={ibx + ibw - 6} y={baseY + 30} fontSize="8" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{"OP_0 <pubkey_hash>"}</text>

                <text x={ibx + ibw / 2 + 6} y={baseY + 43} fontSize="7.5" fontWeight="600" fill="#16a34a" textAnchor="middle" style={noPtr}>
                  {c.remoteOwner} (IMMEDIATE)
                </text>
              </g>
            </g>
          );

          return (
            <>
              <rect x={bx} y={y + outOff} width={bw} height={outSecH - 4} rx="4" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="0.5" />
              <text x={bx + 8} y={y + outOff + 14} fontSize="9" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em" style={noPtr}>Outputs</text>
              <line x1={bx + 8} y1={y + outOff + 18} x2={bx + bw - 8} y2={y + outOff + 18} stroke="#e8dcc8" strokeWidth="0.5" />
              {firstOutput === "local" ? renderLocal(out0Y, 0) : renderRemote(out0Y, 0)}
              {secondOutput === "local" ? renderLocal(out1Y, 1) : renderRemote(out1Y, 1)}
            </>
          );
        })()}

        {/* ─── Witness section ─── */}
        <rect x={bx} y={y + witOff} width={bw} height={witHeadH + witRowH} rx="4" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="0.5" />
        <text x={bx + 8} y={y + witOff + 14} fontSize="9" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em" style={noPtr}>Witness</text>
        <line x1={bx + 8} y1={y + witOff + 18} x2={bx + bw - 8} y2={y + witOff + 18} stroke="#e8dcc8" strokeWidth="0.5" />

        <g {...hoverProps(`${prefix}-witness`)}>
          <rect
            x={bx + 4} y={y + witOff + witHeadH}
            width={bw - 8} height={witRowH - 2} rx="3"
            fill={hovered === `${prefix}-witness` ? "rgba(184,134,11,0.04)" : "transparent"}
            stroke={hovered === `${prefix}-witness` ? "#b8860b" : "transparent"}
            strokeWidth="0.75" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={bx + 12} y={y + witOff + witHeadH + 14} fontSize="8" fill="#b8860b" fontFamily={mono} style={noPtr}>
            {c.witnessLabel}
          </text>
        </g>
      </g>
    );
  }

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none" style={{ maxWidth: 680, margin: "0 auto" }}>
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
          {/* Title */}
          <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
            Asymmetric Commitment Transactions
          </text>
          <text x={W / 2} y="35" fontSize="10" fill="#6b5d4f" textAnchor="middle">
            Each party holds their own version
          </text>

          {/* Funding output */}
          <g {...hoverProps("funding")}>
            <rect
              x={W / 2 - 80} y={fundY} width={160} height={fundH} rx="8"
              fill={hovered === "funding" ? "rgba(184,134,11,0.08)" : "white"}
              stroke={hovered === "funding" ? "#b8860b" : "#e8dcc8"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text x={W / 2} y={fundY + 15} fontSize="10" fontWeight="700" fill="#2a1f0d" textAnchor="middle" style={noPtr}>
              Funding Output
            </text>
            <text x={W / 2} y={fundY + 28} fontSize="9" fill="#b8860b" textAnchor="middle" fontFamily={mono} style={noPtr}>
              2-of-2 Multisig
            </text>
          </g>

          <defs>
            <marker id="vl-cp-arrow" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill="#b8860b" />
            </marker>
          </defs>

          {/* Render both TX cards */}
          {cards.map(renderCard)}

          {/* Arrows from funding output into left edge of each card's input box (drawn AFTER cards so they render on top) */}
          {(() => {
            // Target: vertical midpoint of input 0 box, arrow enters its left edge
            const inputBoxMidY = cardsY + inpOff + inpHeadH + 2 + (inpBoxH - 4) / 2;
            const leftElbowX = leftX - 10;
            const rightElbowX = rightX - 10;
            // ibx = leftX + pad + 16 (the actual input box left edge)
            const leftTargetX = leftX + pad + 16;
            const rightTargetX = rightX + pad + 16;
            return (
              <>
                {/* Vertical stub from funding box center down to the horizontal */}
                <line
                  x1={W / 2} y1={fundY + fundH}
                  x2={W / 2} y2={fundY + fundH + 4}
                  stroke="#b8860b" strokeWidth="1.5"
                />
                {/* Horizontal line from funding bottom to both vertical drops */}
                <line
                  x1={leftElbowX} y1={fundY + fundH + 4}
                  x2={rightElbowX} y2={fundY + fundH + 4}
                  stroke="#b8860b" strokeWidth="1.5"
                />
                {/* Left card: vertical down, 90° turn, horizontal right into input */}
                <polyline
                  points={`${leftElbowX},${fundY + fundH + 4} ${leftElbowX},${inputBoxMidY} ${leftTargetX},${inputBoxMidY}`}
                  fill="none" stroke="#b8860b" strokeWidth="1.5"
                  markerEnd="url(#vl-cp-arrow)"
                />
                {/* Right card: vertical down, 90° turn, horizontal right into input */}
                <polyline
                  points={`${rightElbowX},${fundY + fundH + 4} ${rightElbowX},${inputBoxMidY} ${rightTargetX},${inputBoxMidY}`}
                  fill="none" stroke="#b8860b" strokeWidth="1.5"
                  markerEnd="url(#vl-cp-arrow)"
                />
              </>
            );
          })()}

          {/* Legend */}
          <rect x={W / 2 - 170} y={legendY} width={340} height={34} rx="8" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="0.75" />
          <rect x={W / 2 - 152} y={legendY + 10} width={14} height={14} rx="3" fill="#fdf8e8" stroke="#d4a038" strokeWidth="1" strokeDasharray="3 1.5" />
          <text x={W / 2 - 132} y={legendY + 22} fontSize="11" fill="#6b5d4f">
            Delayed (your own)
          </text>
          <rect x={W / 2 + 20} y={legendY + 10} width={14} height={14} rx="3" fill="white" stroke="#e8dcc8" strokeWidth="1" />
          <text x={W / 2 + 40} y={legendY + 22} fontSize="11" fill="#6b5d4f">
            Immediate (counterparty)
          </text>
        </svg>

        {/* Tooltip */}
        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 120), 460)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
