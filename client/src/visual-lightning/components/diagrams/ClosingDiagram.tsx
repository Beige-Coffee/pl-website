import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

// ── Course palette ──
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const GREEN = "#16a34a";
const ORANGE = "#ea580c";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "coop-card": {
    title: "Cooperative Closing TX",
    description:
      "Both parties agree on the final balances and co-sign a simple closing transaction. No delays, no revocation paths, no penalties. Just a clean final settlement.",
  },
  "coop-input": {
    title: "Funding Input",
    description:
      "Spends the 2-of-2 multisig funding output. Both Alice and Bob provide signatures to authorize this spend.",
  },
  "coop-alice-out": {
    title: "Alice's Output (Immediate)",
    description:
      "Alice's agreed-upon share of the channel balance. Spendable immediately once the closing TX is confirmed. Simple P2WPKH output, no scripts or delays.",
  },
  "coop-bob-out": {
    title: "Bob's Output (Immediate)",
    description:
      "Bob's agreed-upon share of the channel balance. Spendable immediately once the closing TX is confirmed. Simple P2WPKH output, no scripts or delays.",
  },
  "coop-witness": {
    title: "Witness (Cooperative)",
    description:
      "Both Alice and Bob sign the closing transaction together. The witness satisfies the 2-of-2 multisig funding script.",
  },
  "force-card": {
    title: "Force Close (Commitment TX)",
    description:
      "The latest commitment TX broadcast unilaterally by one party. Uses the full commitment structure with delayed to_local, immediate to_remote, and revocation paths.",
  },
  "force-input": {
    title: "Funding Input",
    description:
      "Spends the same 2-of-2 multisig funding output. The broadcaster already holds the counterparty's pre-signed signature.",
  },
  "force-local": {
    title: "to_local (Alice, Delayed)",
    description:
      "The broadcaster's balance. Subject to to_self_delay (~144 blocks, about 1 day). During this delay, the counterparty can check if this is an old, revoked state and claim everything via the revocation key.",
  },
  "force-remote": {
    title: "to_remote (Bob, Immediate)",
    description:
      "The counterparty's balance. Spendable immediately, no delay. Since the counterparty didn't choose to broadcast, they face no penalty risk.",
  },
  "force-witness": {
    title: "Witness (Force Close)",
    description:
      "Contains the counterparty's pre-provided signature plus the broadcaster's own signature. Together they satisfy the 2-of-2 multisig.",
  },
  "force-script": {
    title: "to_local Script",
    description:
      "The revocable script with two paths: the delayed path (broadcaster waits to_self_delay blocks) or the revocation path (counterparty claims immediately with revocation key if this is an old state).",
  },
};

export function ClosingDiagram() {
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

  const hoverProps = useCallback(
    (region: string) => ({
      onMouseEnter: (e: React.MouseEvent) => handleHover(region, e),
      onMouseMove: handleMouseMove,
      onMouseLeave: () => setHovered(null),
      style: { cursor: "pointer" as const },
    }),
    [handleHover, handleMouseMove],
  );

  const noPtr = { pointerEvents: "none" as const };
  const mono = "'JetBrains Mono', monospace";
  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  const W = 576;
  const cardW = 252;
  const cardGap = 20;
  const leftX = (W - cardW * 2 - cardGap) / 2;
  const rightX = leftX + cardW + cardGap;
  const pad = 8;
  const innerW = cardW - pad * 2;

  // Card Y positions
  const cardsY = 62;

  // ── Section heights ──
  const titleH = 28;
  const inpSecH = 42;    // Inputs section (header + 1 input row)
  const outSecH_coop = 78; // Outputs section (header + 2 output rows)
  const outSecH_force = 78;
  const witSecH = 38;    // Witness section
  const scrSecH = 78;    // Script section (force close only)

  const coopCardH = titleH + inpSecH + 6 + outSecH_coop + 6 + witSecH + pad;
  const forceCardH = titleH + inpSecH + 6 + outSecH_force + 6 + scrSecH + 6 + witSecH + pad;

  // Comparison Y
  const compY = cardsY + Math.max(coopCardH, forceCardH) + 16;
  const compH = 70;
  const H = compY + compH + 8;

  // Fill/stroke helpers
  const fill = (region: string) =>
    hovered === region ? "rgba(184,134,11,0.06)" : "#fefdfb";
  const stk = (region: string) =>
    hovered === region ? GOLD : BORDER;

  // ── Render output row ──
  function outRow(
    x: number, y: number, w: number,
    label: string, value: string, tag: string,
    tagColor: string, bgFill: string, borderColor: string,
    dashed: boolean, region: string,
  ) {
    return (
      <g {...hoverProps(region)}>
        <rect
          x={x} y={y} width={w} height={24} rx="3"
          fill={hovered === region ? `${borderColor}14` : bgFill}
          stroke={borderColor} strokeWidth="0.75"
          strokeDasharray={dashed ? "4 2" : undefined}
          style={{ transition: "fill 0.15s ease" }}
        />
        <text x={x + 6} y={y + 15} fontSize="8" fill={TEXT_MUTED} style={noPtr}>{label}</text>
        <text x={x + w - 6} y={y + 15} fontSize="8" fontWeight="600" fill={tagColor} textAnchor="end" fontFamily={mono} style={noPtr}>{value}</text>
        <text x={x + w / 2} y={y + 15} fontSize="6.5" fill={tagColor} textAnchor="middle" fontWeight="600" style={noPtr}>{tag}</text>
      </g>
    );
  }

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
          {/* Title */}
          <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
            Closing a Lightning Channel
          </text>
          <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
            Two ways to settle: cooperate or go it alone
          </text>

          {/* Section labels */}
          <rect x={leftX + cardW / 2 - 58} y={46} width={116} height={16} rx="8" fill="rgba(22,163,74,0.06)" stroke={GREEN} strokeWidth="0.6" />
          <text x={leftX + cardW / 2} y={57} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle">Cooperative Close</text>

          <rect x={rightX + cardW / 2 - 42} y={46} width={84} height={16} rx="8" fill="rgba(234,88,12,0.06)" stroke={ORANGE} strokeWidth="0.6" />
          <text x={rightX + cardW / 2} y={57} fontSize="8" fontWeight="700" fill={ORANGE} textAnchor="middle">Force Close</text>

          {/* VS divider */}
          <line x1={W / 2} y1={46} x2={W / 2} y2={compY - 6} stroke={BORDER} strokeWidth="0.8" strokeDasharray="4 3" />
          <circle cx={W / 2} cy={cardsY + coopCardH / 2} r="11" fill="white" stroke={BORDER} strokeWidth="0.8" />
          <text x={W / 2} y={cardsY + coopCardH / 2 + 4} fontSize="8" fontWeight="700" fill={TEXT_MUTED} textAnchor="middle">vs</text>

          {/* ═══ LEFT: Cooperative Close TX ═══ */}
          {(() => {
            const x = leftX;
            const y = cardsY;
            const bx = x + pad;
            const bw = innerW;
            const ibx = bx + 14;
            const ibw = bw - 18;
            let secY = y + titleH;

            return (
              <g>
                {/* Card background */}
                <g {...hoverProps("coop-card")}>
                  <rect
                    x={x} y={y} width={cardW} height={coopCardH} rx="8"
                    fill={hovered === "coop-card" ? "rgba(22,163,74,0.02)" : "white"}
                    stroke={hovered === "coop-card" ? GREEN : BORDER} strokeWidth="1.5"
                    style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                  />
                </g>

                {/* Header */}
                <text x={x + pad + 4} y={y + 18} fontSize="9.5" fontWeight="700" fill={TEXT_DARK} style={noPtr}>
                  Closing TX
                </text>
                <rect x={x + cardW - 90} y={y + 6} width={80} height={14} rx="3" fill="rgba(22,163,74,0.06)" stroke={GREEN} strokeWidth="0.4" style={noPtr} />
                <text x={x + cardW - 50} y={y + 16} fontSize="6" fontWeight="700" fill={GREEN} textAnchor="middle" style={noPtr}>MUTUAL AGREEMENT</text>
                <line x1={bx} y1={y + titleH - 4} x2={bx + bw} y2={y + titleH - 4} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

                {/* Inputs section */}
                <rect x={bx} y={secY} width={bw} height={inpSecH} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Inputs</text>
                <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                <text x={bx + 8} y={secY + 30} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>0:</text>
                <g {...hoverProps("coop-input")}>
                  <rect
                    x={ibx} y={secY + 20} width={ibw} height={18} rx="3"
                    fill={fill("coop-input")} stroke={stk("coop-input")} strokeWidth="0.5"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text x={ibx + 4} y={secY + 33} fontSize="7.5" fill={GOLD} fontWeight="600" style={noPtr}>Funding Output (2-of-2)</text>
                </g>

                {/* Outputs section */}
                {(() => {
                  secY += inpSecH + 6;
                  const oY = secY + 22;
                  return (
                    <>
                      <rect x={bx} y={secY} width={bw} height={outSecH_coop} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                      <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Outputs</text>
                      <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                      <text x={bx + 8} y={oY + 13} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>0:</text>
                      {outRow(ibx, oY, ibw, "Alice", "70,000,000", "immediate", GREEN, "white", GREEN, false, "coop-alice-out")}
                      <text x={bx + 8} y={oY + 40} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>1:</text>
                      {outRow(ibx, oY + 27, ibw, "Bob", "30,000,000", "immediate", GREEN, "white", GREEN, false, "coop-bob-out")}
                    </>
                  );
                })()}

                {/* Witness section */}
                {(() => {
                  secY += outSecH_coop + 6;
                  return (
                    <>
                      <rect x={bx} y={secY} width={bw} height={witSecH} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                      <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Witness</text>
                      <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                      <g {...hoverProps("coop-witness")}>
                        <rect
                          x={bx + 4} y={secY + 20} width={bw - 8} height={14} rx="3"
                          fill={hovered === "coop-witness" ? "rgba(184,134,11,0.06)" : "transparent"}
                          stroke={hovered === "coop-witness" ? GOLD : "transparent"} strokeWidth="0.5"
                          style={{ transition: "fill 0.15s ease" }}
                        />
                        <text x={bx + 10} y={secY + 31} fontSize="7.5" fill={GOLD} fontFamily={mono} style={noPtr}>
                          {"<alice_sig> <bob_sig>"}
                        </text>
                      </g>
                    </>
                  );
                })()}
              </g>
            );
          })()}

          {/* ═══ RIGHT: Force Close (Commitment TX) ═══ */}
          {(() => {
            const x = rightX;
            const y = cardsY;
            const bx = x + pad;
            const bw = innerW;
            const ibx = bx + 14;
            const ibw = bw - 18;
            let secY = y + titleH;

            // Script lines
            const scriptLines = [
              { text: "OP_IF", dim: true },
              { text: "  <revocation_pubkey>", highlight: true },
              { text: "OP_ELSE", dim: true },
              { text: "  <to_self_delay> OP_CSV", dim: false },
              { text: "  <local_delayed_pubkey>", dim: false },
              { text: "OP_ENDIF", dim: true },
              { text: "OP_CHECKSIG", dim: true },
            ];

            return (
              <g>
                {/* Card background */}
                <g {...hoverProps("force-card")}>
                  <rect
                    x={x} y={y} width={cardW} height={forceCardH} rx="8"
                    fill={hovered === "force-card" ? "rgba(234,88,12,0.02)" : "white"}
                    stroke={hovered === "force-card" ? ORANGE : BORDER} strokeWidth="1.5"
                    style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                  />
                </g>

                {/* Header */}
                <text x={x + pad + 4} y={y + 18} fontSize="9.5" fontWeight="700" fill={TEXT_DARK} style={noPtr}>
                  Commitment TX
                </text>
                <rect x={x + cardW - 72} y={y + 6} width={62} height={14} rx="3" fill="rgba(234,88,12,0.06)" stroke={ORANGE} strokeWidth="0.4" style={noPtr} />
                <text x={x + cardW - 41} y={y + 16} fontSize="6" fontWeight="700" fill={ORANGE} textAnchor="middle" style={noPtr}>UNILATERAL</text>
                <line x1={bx} y1={y + titleH - 4} x2={bx + bw} y2={y + titleH - 4} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

                {/* Inputs section */}
                <rect x={bx} y={secY} width={bw} height={inpSecH} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Inputs</text>
                <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                <text x={bx + 8} y={secY + 30} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>0:</text>
                <g {...hoverProps("force-input")}>
                  <rect
                    x={ibx} y={secY + 20} width={ibw} height={18} rx="3"
                    fill={fill("force-input")} stroke={stk("force-input")} strokeWidth="0.5"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text x={ibx + 4} y={secY + 33} fontSize="7.5" fill={GOLD} fontWeight="600" style={noPtr}>Funding Output (2-of-2)</text>
                </g>

                {/* Outputs section */}
                {(() => {
                  secY += inpSecH + 6;
                  const oY = secY + 22;
                  return (
                    <>
                      <rect x={bx} y={secY} width={bw} height={outSecH_force} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                      <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Outputs</text>
                      <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                      <text x={bx + 8} y={oY + 13} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>0:</text>
                      {outRow(ibx, oY, ibw, "to_local (Alice)", "70,000,000", "144 blocks", GOLD, GOLD_BG, GOLD, true, "force-local")}
                      <text x={bx + 8} y={oY + 40} fontSize="7.5" fill={TEXT_MUTED} style={noPtr}>1:</text>
                      {outRow(ibx, oY + 27, ibw, "to_remote (Bob)", "30,000,000", "immediate", GREEN, "white", BORDER, false, "force-remote")}
                    </>
                  );
                })()}

                {/* to_local Script section */}
                {(() => {
                  secY += outSecH_force + 6;
                  return (
                    <>
                      <g {...hoverProps("force-script")}>
                        <rect
                          x={bx} y={secY} width={bw} height={scrSecH} rx="4"
                          fill={hovered === "force-script" ? "rgba(184,134,11,0.06)" : "#f7f2ea"}
                          stroke={hovered === "force-script" ? GOLD : "#e0d5c4"} strokeWidth="0.5"
                          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                        />
                        <text x={bx + 6} y={secY + 12} fontSize="7.5" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>
                          to_local witnessScript
                        </text>
                        <line x1={bx + 6} y1={secY + 16} x2={bx + bw - 6} y2={secY + 16} stroke="#e0d5c4" strokeWidth="0.3" style={noPtr} />
                        {scriptLines.map((line, i) => (
                          <text
                            key={i}
                            x={bx + 10} y={secY + 26 + i * 8}
                            fontSize="7" fontFamily={mono}
                            fill={line.highlight ? ORANGE : line.dim ? "#9a8b78" : TEXT_MUTED}
                            fontWeight={line.highlight ? "700" : "400"}
                            style={noPtr}
                          >
                            {line.text}
                          </text>
                        ))}
                      </g>
                    </>
                  );
                })()}

                {/* Witness section */}
                {(() => {
                  secY += scrSecH + 6;
                  return (
                    <>
                      <rect x={bx} y={secY} width={bw} height={witSecH} rx="4" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
                      <text x={bx + 6} y={secY + 13} fontSize="8" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Witness</text>
                      <line x1={bx + 6} y1={secY + 17} x2={bx + bw - 6} y2={secY + 17} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
                      <g {...hoverProps("force-witness")}>
                        <rect
                          x={bx + 4} y={secY + 20} width={bw - 8} height={14} rx="3"
                          fill={hovered === "force-witness" ? "rgba(184,134,11,0.06)" : "transparent"}
                          stroke={hovered === "force-witness" ? GOLD : "transparent"} strokeWidth="0.5"
                          style={{ transition: "fill 0.15s ease" }}
                        />
                        <text x={bx + 10} y={secY + 31} fontSize="7.5" fill={GOLD} fontFamily={mono} style={noPtr}>
                          {"<alice_sig> <bob_sig>"}
                        </text>
                      </g>
                    </>
                  );
                })()}
              </g>
            );
          })()}

          {/* ── Comparison Table ── */}
          <rect
            x={20} y={compY} width={W - 40} height={compH} rx="6"
            fill={GOLD_BG} stroke={GOLD} strokeWidth="0.6"
          />
          {(() => {
            const col1 = 90;
            const col2 = W / 2 - 30;
            const col3 = W - 100;
            const rY = compY + 14;
            const r2Y = rY + 16;
            const r3Y = r2Y + 16;
            const r4Y = r3Y + 16;
            return (
              <g style={noPtr}>
                <text x={col2} y={rY} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle">Cooperative</text>
                <text x={col3} y={rY} fontSize="8" fontWeight="700" fill={ORANGE} textAnchor="middle">Force Close</text>
                <line x1={30} y1={rY + 5} x2={W - 50} y2={rY + 5} stroke={`${GOLD}40`} strokeWidth="0.5" />

                <text x={col1} y={r2Y} fontSize="8" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Fees</text>
                <text x={col2} y={r2Y} fontSize="8" fill={TEXT_MUTED} textAnchor="middle">Low (simple TX)</text>
                <text x={col3} y={r2Y} fontSize="8" fill={TEXT_MUTED} textAnchor="middle">Higher (complex TX)</text>

                <text x={col1} y={r3Y} fontSize="8" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Speed</text>
                <text x={col2} y={r3Y} fontSize="8" fill={GREEN} fontWeight="600" textAnchor="middle">Immediate</text>
                <text x={col3} y={r3Y} fontSize="8" fill={ORANGE} fontWeight="600" textAnchor="middle">~1 day delay</text>

                <text x={col1} y={r4Y} fontSize="8" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Requires</text>
                <text x={col2} y={r4Y} fontSize="8" fill={TEXT_MUTED} textAnchor="middle">Both parties</text>
                <text x={col3} y={r4Y} fontSize="8" fill={TEXT_MUTED} textAnchor="middle">Only one party</text>
              </g>
            );
          })()}
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
