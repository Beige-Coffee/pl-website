import { useState, useRef, useCallback } from "react";
import type { TxDiagramData } from "../../data/vl-diagram-data";
import { VLTooltip } from "../VLTooltip";

interface TransactionDiagramProps {
  data: TxDiagramData;
}

function formatSats(sats: number): string {
  return sats.toLocaleString();
}

function formatSequence(seq: number): string {
  return "0x" + seq.toString(16).toUpperCase().padStart(8, "0");
}

export function TransactionDiagram({ data }: TransactionDiagramProps) {
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

  const tooltip = hovered ? data.tooltips[hovered] : null;

  // Layout
  const cardX = 14;
  const cardW = 360;
  const cardY = 10;
  const pad = 10;
  const labelX = cardX + pad + 28; // left edge for field labels inside input/output boxes
  const valueX = cardX + pad + 100; // left edge for field values

  // Header
  const headerH = 30;

  // Version + locktime
  const metaY = cardY + headerH + 6;
  const metaRowH = 28;

  // Inputs
  const inputsY = metaY + metaRowH * 2 + 10;
  const inputBoxH = 72; // box with txid, index, scriptSig, sequence
  const inputRowH = inputBoxH + 8;
  const inputsSectionH = 28 + data.inputs.length * inputRowH;

  // Outputs
  const outputsY = inputsY + inputsSectionH + 10;
  const outputBoxH = 44;
  const outputRowH = outputBoxH + 8;
  const outputsSectionH = 28 + data.outputs.length * outputRowH;

  // Witness
  const witnessY = outputsY + outputsSectionH + 10;
  const witnessRowH = 28;
  const witnessSectionH = data.witness ? 28 + data.witness.length * witnessRowH : 0;

  const cardH = (data.witness ? witnessY + witnessSectionH : outputsY + outputsSectionH) - cardY + 10;
  const viewBoxW = cardX + cardW + 14;
  const viewBoxH = cardH + 24;

  return (
    <div ref={containerRef} className="vl-card-3d relative my-6 select-none" style={{ maxWidth: 680, margin: "0 auto", padding: "0 12%" }}>
      <div className="vl-card-3d-inner" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%",
            height: "auto",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Transaction card background */}
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
              stroke={hovered === "txid" ? "#b8860b" : "transparent"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <rect
              x={cardX} y={cardY + 22} width={cardW} height={8}
              fill={hovered === "txid" ? "rgba(184, 134, 11, 0.08)" : "transparent"}
              style={{ pointerEvents: "none" }}
            />
            <text x={cardX + 14} y={cardY + 20} fontSize="12" fontWeight="700" fill="#2a1f0d" style={{ pointerEvents: "none" }}>
              TXID:
            </text>
            <text x={cardX + 52} y={cardY + 20} fontSize="11" fill="#6b5d4f" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
              {data.txid}
            </text>
          </g>

          {/* === VERSION === */}
          <g
            onMouseEnter={(e) => handleHover("version", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX + pad} y={metaY} width={cardW - pad * 2} height={metaRowH}
              rx="6" fill={regionFill("version")} stroke={regionStroke("version")}
              strokeWidth="1.5" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text x={cardX + pad + 10} y={metaY + 18} fontSize="11" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
              version:
            </text>
            <text x={cardX + pad + 72} y={metaY + 18} fontSize="12" fontWeight="700" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
              {data.version}
            </text>
          </g>

          {/* === LOCKTIME === */}
          <g
            onMouseEnter={(e) => handleHover("locktime", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={cardX + pad} y={metaY + metaRowH + 4} width={cardW - pad * 2} height={metaRowH}
              rx="6" fill={regionFill("locktime")} stroke={regionStroke("locktime")}
              strokeWidth="1.5" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text x={cardX + pad + 10} y={metaY + metaRowH + 22} fontSize="11" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
              locktime:
            </text>
            <text x={cardX + pad + 78} y={metaY + metaRowH + 22} fontSize="12" fontWeight="700" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}>
              {data.locktime}
            </text>
          </g>

          {/* === INPUTS SECTION === */}
          <rect
            x={cardX + pad} y={inputsY} width={cardW - pad * 2} height={inputsSectionH}
            rx="6" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1"
          />
          <text
            x={cardX + pad + 10} y={inputsY + 18} fontSize="11" fontWeight="700" fill="#2a1f0d"
            letterSpacing="0.03em"
          >
            Inputs
          </text>
          <line
            x1={cardX + pad + 10} y1={inputsY + 24}
            x2={cardX + cardW - pad - 10} y2={inputsY + 24}
            stroke="#e8dcc8" strokeWidth="0.5"
          />

          {data.inputs.map((input, i) => {
            const rowY = inputsY + 30 + i * inputRowH;
            const boxX = cardX + pad + 22;
            const boxW = cardW - pad * 2 - 26;
            return (
              <g key={input.id}>
                {/* Index label */}
                <text
                  x={cardX + pad + 10} y={rowY + 16} fontSize="11" fill="#6b5d4f"
                >
                  {i}:
                </text>

                {/* Input field box */}
                <g
                  onMouseEnter={(e) => handleHover(input.id, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={boxX} y={rowY} width={boxW} height={inputBoxH}
                    rx="4" fill={hovered === input.id ? "rgba(184, 134, 11, 0.04)" : "white"}
                    stroke={hovered === input.id ? "#b8860b" : "#e8dcc8"}
                    strokeWidth="1" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                  />
                  {/* txid */}
                  <text x={boxX + 8} y={rowY + 16} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                    txid:
                  </text>
                  <text x={boxX + boxW - 8} y={rowY + 16} fontSize="11" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                    {input.prevTxid}
                  </text>
                  {/* index */}
                  <text x={boxX + 8} y={rowY + 32} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                    index:
                  </text>
                  <text x={boxX + boxW - 8} y={rowY + 32} fontSize="11" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                    {input.prevIndex}
                  </text>
                  {/* scriptSig */}
                  <text x={boxX + 8} y={rowY + 48} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                    scriptSig:
                  </text>
                  <text x={boxX + boxW - 8} y={rowY + 48} fontSize="10" fill="#6b5d4f" fontStyle="italic" textAnchor="end" style={{ pointerEvents: "none" }}>
                    (empty for SegWit)
                  </text>
                </g>
                <g
                  onMouseEnter={(e) => handleHover("sequence", e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={boxX} y={rowY + 50} width={boxW} height={inputBoxH - 50}
                    rx="0" fill="transparent"
                  />
                  <text x={boxX + 8} y={rowY + 64} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                    sequence:
                  </text>
                  <text x={boxX + boxW - 8} y={rowY + 64} fontSize="11" fontWeight="600" fill="#2a1f0d" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                    {formatSequence(input.sequence)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* === OUTPUTS SECTION === */}
          <rect
            x={cardX + pad} y={outputsY} width={cardW - pad * 2} height={outputsSectionH}
            rx="6" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1"
          />
          <text
            x={cardX + pad + 10} y={outputsY + 18} fontSize="11" fontWeight="700" fill="#2a1f0d"
            letterSpacing="0.03em"
          >
            Outputs
          </text>
          <line
            x1={cardX + pad + 10} y1={outputsY + 24}
            x2={cardX + cardW - pad - 10} y2={outputsY + 24}
            stroke="#e8dcc8" strokeWidth="0.5"
          />

          {data.outputs.map((output, i) => {
            const rowY = outputsY + 30 + i * outputRowH;
            const boxX = cardX + pad + 22;
            const boxW = cardW - pad * 2 - 26;
            return (
              <g
                key={output.id}
                onMouseEnter={(e) => handleHover(output.id, e)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Index label */}
                <text
                  x={cardX + pad + 10} y={rowY + 16} fontSize="11" fill="#6b5d4f"
                >
                  {i}:
                </text>

                {/* Output field box */}
                <rect
                  x={boxX} y={rowY} width={boxW} height={outputBoxH}
                  rx="4" fill={hovered === output.id ? "rgba(184, 134, 11, 0.04)" : "white"}
                  stroke={hovered === output.id ? "#b8860b" : "#e8dcc8"}
                  strokeWidth="1" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                />
                {/* value */}
                <text x={boxX + 8} y={rowY + 16} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                  value:
                </text>
                <text x={boxX + boxW - 8} y={rowY + 16} fontSize="11" fontWeight="600" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                  {formatSats(output.valueSats)}
                </text>
                {/* scriptPubKey */}
                <text x={boxX + 8} y={rowY + 34} fontSize="10" fill="#6b5d4f" style={{ pointerEvents: "none" }}>
                  scriptPubKey:
                </text>
                <text x={boxX + boxW - 8} y={rowY + 34} fontSize="10" fill="#b8860b" fontFamily="'JetBrains Mono', monospace" textAnchor="end" style={{ pointerEvents: "none" }}>
                  {output.scriptDisplay}
                </text>
              </g>
            );
          })}

          {/* === WITNESS SECTION === */}
          {data.witness && (
            <>
              <rect
                x={cardX + pad} y={witnessY} width={cardW - pad * 2} height={witnessSectionH}
                rx="6" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="1"
              />
              <text
                x={cardX + pad + 10} y={witnessY + 18} fontSize="11" fontWeight="700" fill="#2a1f0d"
                letterSpacing="0.03em"
              >
                Witness
              </text>
              <line
                x1={cardX + pad + 10} y1={witnessY + 24}
                x2={cardX + cardW - pad - 10} y2={witnessY + 24}
                stroke="#e8dcc8" strokeWidth="0.5"
              />

              {data.witness.map((w, i) => {
                const rowY = witnessY + 28 + i * witnessRowH;
                return (
                  <g
                    key={w.id}
                    onMouseEnter={(e) => handleHover(w.id, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={cardX + pad + 4} y={rowY}
                      width={cardW - pad * 2 - 8} height={witnessRowH - 4}
                      rx="4"
                      fill={hovered === w.id ? "rgba(184, 134, 11, 0.04)" : "transparent"}
                      stroke={hovered === w.id ? "#b8860b" : "transparent"}
                      strokeWidth="1" style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                    />
                    <text
                      x={cardX + pad + 14} y={rowY + 16} fontSize="10" fill="#b8860b"
                      fontFamily="'JetBrains Mono', monospace" style={{ pointerEvents: "none" }}
                    >
                      {w.elements.join("  ")}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>

        {/* Tooltip overlay */}
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
