import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  txid: {
    title: "Funding TXID",
    description:
      "This transaction ID will be referenced by all future commitment transactions in this channel.",
  },
  version: {
    title: "Transaction Version",
    description:
      "Version 2 enables OP_CHECKSEQUENCEVERIFY (CSV), which is essential for Lightning's relative timelocks.",
  },
  locktime: {
    title: "Locktime (nLockTime)",
    description:
      "Set to 0 for the funding transaction. In later commitment transactions, this field will encode part of the obscured commitment number.",
  },
  "input-0": {
    title: "Funding Input",
    description:
      "Alice contributes her funds to the channel. In practice, both parties can contribute inputs.",
  },
  sequence: {
    title: "Input Sequence (nSequence)",
    description:
      "0xFFFFFFFF disables both RBF and relative timelock. In commitment transactions, this field will encode the other half of the obscured commitment number.",
  },
  "output-0": {
    title: "Channel Funding Output",
    description:
      "A P2WSH output that locks 5,000,000 sats (0.05 BTC) into a 2-of-2 multisig. Neither party can spend alone.",
  },
  "witness-0": {
    title: "Witness",
    description:
      "The witness data will contain both Alice's and Bob's signatures when the funding transaction is broadcast.",
  },
  "witness-script": {
    title: "Witness Script (Redeem Script)",
    description:
      "The actual spending conditions: 2-of-2 multisig requiring both Alice and Bob's signatures. This script is hashed and hidden in the output until spending time.",
  },
  sha256: {
    title: "SHA256 Hash",
    description:
      "The witness script is hashed with SHA256 to produce a 32-byte script hash. This hash goes into the P2WSH output on-chain, keeping the full script private until spending time.",
  },
};

function formatSequence(seq: number): string {
  return "0x" + seq.toString(16).toUpperCase().padStart(8, "0");
}

export function FundingChannelDiagram() {
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

  const regionFill = (region: string) =>
    hovered === region ? "rgba(184, 134, 11, 0.08)" : "#fefdfb";

  const regionStroke = (region: string) =>
    hovered === region ? "#b8860b" : "#e8dcc8";

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  // === TX layout (matches TransactionDiagram structure) ===
  const cardX = 10;
  const cardW = 320;
  const cardY = 10;
  const pad = 10;
  const headerH = 28;
  const metaY = cardY + headerH + 4;
  const metaRowH = 24;
  const inputsY = metaY + metaRowH * 2 + 8;
  const inputBoxH = 72;
  const inputRowH = inputBoxH + 6;
  const inputsSectionH = 24 + inputRowH;
  const outputsY = inputsY + inputsSectionH + 8;
  const outputBoxH = 40;
  const outputRowH = outputBoxH + 6;
  const outputsSectionH = 24 + outputRowH;
  const witnessY = outputsY + outputsSectionH + 8;
  const witnessSectionH = 48;
  const cardH = witnessY + witnessSectionH - cardY + 8;

  // === Right-side witness script flow ===
  const rsX = cardX + cardW + 30;
  const rsW = 210;
  const viewW = rsX + rsW + 14;
  const viewH = cardH + 24;

  // Output scriptPubKey Y position (for the connecting arrow)
  const outputScriptY = outputsY + 24 + 30;

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none">
      <div className="vl-card-3d-inner" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "auto",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* ====== LEFT: FUNDING TRANSACTION ====== */}
          <rect
            x={cardX} y={cardY} width={cardW} height={cardH}
            rx="8" fill="white" stroke="#e8dcc8" strokeWidth="1.5"
          />

          {/* TXID header */}
          <g
            onMouseEnter={(e) => handleHover("txid", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX} y={cardY} width={cardW} height={headerH} rx="8"
              fill={hovered === "txid" ? "rgba(184, 134, 11, 0.08)" : "transparent"}
              stroke={hovered === "txid" ? "#b8860b" : "transparent"} strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease" }}
            />
            <rect x={cardX} y={cardY + 20} width={cardW} height={8} fill={hovered === "txid" ? "rgba(184, 134, 11, 0.08)" : "transparent"} style={{ pointerEvents: "none" }} />
            <text x={cardX + 12} y={cardY + 18} fontSize="11" fontWeight="700" fill="#2a1f0d" style={{ pointerEvents: "none" }}>
              TXID:
            </text>
            <text x={cardX + 46} y={cardY + 18} fontSize="10" fill="#6b5d4f" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
              AliceBobFunding1
            </text>
          </g>

          {/* Version */}
          <g
            onMouseEnter={(e) => handleHover("version", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX + pad} y={metaY} width={cardW - pad * 2} height={metaRowH}
              rx="5" fill={regionFill("version")} stroke={regionStroke("version")} strokeWidth="1"
              style={{ transition: "fill 0.15s ease" }}
            />
            <text x={cardX + pad + 8} y={metaY + 16} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>version:</text>
            <text x={cardX + pad + 60} y={metaY + 16} fontSize="10" fontWeight="700" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>2</text>
          </g>

          {/* Locktime */}
          <g
            onMouseEnter={(e) => handleHover("locktime", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX + pad} y={metaY + metaRowH + 3} width={cardW - pad * 2} height={metaRowH}
              rx="5" fill={regionFill("locktime")} stroke={regionStroke("locktime")} strokeWidth="1"
              style={{ transition: "fill 0.15s ease" }}
            />
            <text x={cardX + pad + 8} y={metaY + metaRowH + 19} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>locktime:</text>
            <text x={cardX + pad + 68} y={metaY + metaRowH + 19} fontSize="10" fontWeight="700" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>0</text>
          </g>

          {/* Inputs section */}
          <rect x={cardX + pad} y={inputsY} width={cardW - pad * 2} height={inputsSectionH} rx="5" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1" />
          <text x={cardX + pad + 8} y={inputsY + 16} fontSize="10" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em">Inputs</text>
          <line x1={cardX + pad + 8} y1={inputsY + 20} x2={cardX + cardW - pad - 8} y2={inputsY + 20} stroke="#e8dcc8" strokeWidth="0.5" />

          {/* Input 0 */}
          {(() => {
            const rowY = inputsY + 26;
            const boxX = cardX + pad + 18;
            const boxW = cardW - pad * 2 - 22;
            return (
              <g>
                <text x={cardX + pad + 6} y={rowY + 14} fontSize="10" fill="#6b5d4f">0:</text>
                <g
                  onMouseEnter={(e) => handleHover("input-0", e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={boxX} y={rowY} width={boxW} height={inputBoxH} rx="4"
                    fill={hovered === "input-0" ? "rgba(184, 134, 11, 0.04)" : "white"}
                    stroke={hovered === "input-0" ? "#b8860b" : "#e8dcc8"} strokeWidth="1"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text x={boxX + 6} y={rowY + 14} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>txid:</text>
                  <text x={boxX + boxW - 6} y={rowY + 14} fontSize="10" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>AliceTx1</text>
                  <text x={boxX + 6} y={rowY + 28} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>index:</text>
                  <text x={boxX + boxW - 6} y={rowY + 28} fontSize="10" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>0</text>
                  <text x={boxX + 6} y={rowY + 42} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>scriptSig:</text>
                  <text x={boxX + boxW - 6} y={rowY + 42} fontSize="9" fill="#6b5d4f" fontStyle="italic" textAnchor="end" style={{ pointerEvents: "none" }}>(empty for SegWit)</text>
                </g>
                <g
                  onMouseEnter={(e) => handleHover("sequence", e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect x={boxX} y={rowY + 48} width={boxW} height={inputBoxH - 48} rx="0" fill="transparent" />
                  <text x={boxX + 6} y={rowY + 62} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>sequence:</text>
                  <text x={boxX + boxW - 6} y={rowY + 62} fontSize="10" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                    {formatSequence(0xffffffff)}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* Outputs section */}
          <rect x={cardX + pad} y={outputsY} width={cardW - pad * 2} height={outputsSectionH} rx="5" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1" />
          <text x={cardX + pad + 8} y={outputsY + 16} fontSize="10" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em">Outputs</text>
          <line x1={cardX + pad + 8} y1={outputsY + 20} x2={cardX + cardW - pad - 8} y2={outputsY + 20} stroke="#e8dcc8" strokeWidth="0.5" />

          {/* Output 0 */}
          {(() => {
            const rowY = outputsY + 24;
            const boxX = cardX + pad + 18;
            const boxW = cardW - pad * 2 - 22;
            return (
              <g
                onMouseEnter={(e) => handleHover("output-0", e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <text x={cardX + pad + 6} y={rowY + 14} fontSize="10" fill="#6b5d4f">0:</text>
                <rect
                  x={boxX} y={rowY} width={boxW} height={outputBoxH} rx="4"
                  fill={hovered === "output-0" ? "rgba(184, 134, 11, 0.04)" : "white"}
                  stroke={hovered === "output-0" ? "#b8860b" : "#e8dcc8"} strokeWidth="1"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={boxX + 6} y={rowY + 14} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>value:</text>
                <text x={boxX + boxW - 6} y={rowY + 14} fontSize="10" fontWeight="600" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>5,000,000</text>
                <text x={boxX + 6} y={rowY + 30} fontSize="9" fill="#6b5d4f" style={{ pointerEvents: "none" }}>scriptPubKey:</text>
                <text x={boxX + boxW - 6} y={rowY + 30} fontSize="9" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>OP_0 &lt;script_hash&gt;</text>
              </g>
            );
          })()}

          {/* Witness section */}
          <rect x={cardX + pad} y={witnessY} width={cardW - pad * 2} height={witnessSectionH} rx="5" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1" />
          <text x={cardX + pad + 8} y={witnessY + 16} fontSize="10" fontWeight="700" fill="#2a1f0d" letterSpacing="0.03em">Witness</text>
          <line x1={cardX + pad + 8} y1={witnessY + 20} x2={cardX + cardW - pad - 8} y2={witnessY + 20} stroke="#e8dcc8" strokeWidth="0.5" />
          <g
            onMouseEnter={(e) => handleHover("witness-0", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX + pad + 4} y={witnessY + 24} width={cardW - pad * 2 - 8} height={20} rx="4"
              fill={hovered === "witness-0" ? "rgba(184, 134, 11, 0.04)" : "transparent"}
              stroke={hovered === "witness-0" ? "#b8860b" : "transparent"} strokeWidth="1"
              style={{ transition: "fill 0.15s ease" }}
            />
            <text x={cardX + pad + 12} y={witnessY + 38} fontSize="9" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
              (added when signed)
            </text>
          </g>

          {/* ====== RIGHT: WITNESS SCRIPT HASHING FLOW ====== */}
          <defs>
            <marker id="vl-fc-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6b5d4f" />
            </marker>
          </defs>

          {/* Witness Script box */}
          <g
            onMouseEnter={(e) => handleHover("witness-script", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={rsX} y={cardY + 10} width={rsW} height={120} rx="8"
              fill={hovered === "witness-script" ? "rgba(184, 134, 11, 0.08)" : "white"}
              stroke={hovered === "witness-script" ? "#b8860b" : "#e8dcc8"} strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease" }}
            />
            <text x={rsX + 12} y={cardY + 30} fontSize="11" fontWeight="700" fill="#2a1f0d" style={{ pointerEvents: "none" }}>
              Witness Script
            </text>
            <line x1={rsX + 12} y1={cardY + 36} x2={rsX + rsW - 12} y2={cardY + 36} stroke="#e8dcc8" strokeWidth="0.5" style={{ pointerEvents: "none" }} />
            <text x={rsX + 18} y={cardY + 54} fontSize="10" fontFamily="'JetBrains Mono', monospace" fill="#b8860b" fontWeight="700" style={{ pointerEvents: "none" }}>2</text>
            <text x={rsX + 18} y={cardY + 70} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="#b8860b" style={{ pointerEvents: "none" }}>&lt;alice_funding_pubkey&gt;</text>
            <text x={rsX + 18} y={cardY + 86} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="#b8860b" style={{ pointerEvents: "none" }}>&lt;bob_funding_pubkey&gt;</text>
            <text x={rsX + 18} y={cardY + 102} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="#b8860b" style={{ pointerEvents: "none" }}>2 OP_CHECKMULTISIG</text>
          </g>

          {/* Arrow: Witness Script → SHA256 */}
          <line
            x1={rsX + rsW / 2} y1={cardY + 130}
            x2={rsX + rsW / 2} y2={cardY + 155}
            stroke="#6b5d4f" strokeWidth="1.5" markerEnd="url(#vl-fc-arrow)"
          />

          {/* SHA256 diamond */}
          <g
            onMouseEnter={(e) => handleHover("sha256", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <polygon
              points={`${rsX + rsW / 2},${cardY + 160} ${rsX + rsW / 2 + 38},${cardY + 185} ${rsX + rsW / 2},${cardY + 210} ${rsX + rsW / 2 - 38},${cardY + 185}`}
              fill={hovered === "sha256" ? "rgba(184, 134, 11, 0.08)" : "white"}
              stroke={hovered === "sha256" ? "#b8860b" : "#e8dcc8"}
              strokeWidth={hovered === "sha256" ? 2 : 1.5}
              style={{ transition: "fill 0.15s ease" }}
            />
            <text
              x={rsX + rsW / 2} y={cardY + 189} fontSize="10" fontWeight="700" fill="#2a1f0d"
              textAnchor="middle" style={{ pointerEvents: "none" }}
            >
              SHA256
            </text>
          </g>

          {/* Arrow: SHA256 → points left back to the output's script_hash */}
          <path
            d={`M ${rsX + rsW / 2} ${cardY + 210} L ${rsX + rsW / 2} ${outputScriptY} L ${cardX + cardW + 2} ${outputScriptY}`}
            fill="none" stroke="#b8860b" strokeWidth="1.5" strokeDasharray="5 3"
            markerEnd="url(#vl-fc-arrow)"
          />
          <text
            x={rsX + rsW / 2 + 6} y={outputScriptY - 6}
            fontSize="8" fill="#b8860b" fontStyle="italic" style={{ pointerEvents: "none" }}
          >
            hash goes here
          </text>
        </svg>

        {/* Tooltip */}
        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 120), 480)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
