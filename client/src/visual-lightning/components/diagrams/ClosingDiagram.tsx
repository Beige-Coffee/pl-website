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
const MONO = "'JetBrains Mono', monospace";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "coop-input": {
    title: "Funding Input",
    description:
      "Spends the 2-of-2 multisig funding output. Both Alice and Bob provide signatures to authorize this spend.",
  },
  "coop-out-0": {
    title: "Bob's Output (P2WPKH)",
    description:
      "Bob's agreed-upon share. A standard P2WPKH, immediately spendable. Cooperative closes produce the simplest possible settlement.\n\nWitness Script:\n  <bob_sig>\n  <bob_pubkey>",
  },
  "coop-out-1": {
    title: "Alice's Output (P2WPKH)",
    description:
      "Alice's agreed-upon share of the channel balance. A standard P2WPKH output, spendable immediately once the closing TX is confirmed. No scripts, no delays.\n\nWitness Script:\n  <alice_sig>\n  <alice_pubkey>",
  },
  "coop-witness": {
    title: "Witness (Cooperative)",
    description:
      "Both Alice and Bob sign the closing transaction together. The witness provides two signatures that satisfy the 2-of-2 multisig redeem script on the funding output.",
  },
  "force-input": {
    title: "Funding Input",
    description:
      "Spends the same 2-of-2 multisig funding output. The broadcaster already holds the counterparty's pre-signed signature on this commitment TX.",
  },
  "force-out-0": {
    title: "to_remote — Bob's Output (P2WPKH)",
    description:
      "The counterparty's balance. A simple P2WPKH, spendable immediately. Since Bob didn't choose to broadcast, he faces no penalty risk.\n\nWitness Script:\n  <bob_sig>\n  <bob_pubkey>",
  },
  "force-out-1": {
    title: "to_local — Alice's Delayed Output (P2WSH)",
    description:
      "The broadcaster's balance, locked behind a revocable script. Alice must wait 144 blocks (~1 day) before she can spend. During this delay, Bob can check if this is a revoked state and claim everything.\n\nwitnessScript:\n  OP_IF\n    <revocation_pubkey>\n  OP_ELSE\n    144 OP_CSV\n    <local_delayed_pubkey>\n  OP_ENDIF\n  OP_CHECKSIG",
  },
  "force-witness": {
    title: "Witness (Force Close)",
    description:
      "Contains Bob's pre-provided signature plus Alice's own signature. Together they satisfy the 2-of-2 multisig on the funding output.",
  },
};

const noPtr = { pointerEvents: "none" as const };

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

  const regionFill = (region: string) =>
    hovered === region ? "rgba(184,134,11,0.04)" : "white";
  const regionStroke = (region: string) =>
    hovered === region ? GOLD : BORDER;

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  // ── Layout (scaled up) ──
  const W = 760;
  const cardW = 340;
  const gap = 28;
  const leftX = (W - cardW * 2 - gap) / 2;
  const rightX = leftX + cardW + gap;
  const pad = 10;
  const innerW = cardW - pad * 2;
  const boxIndent = 20;
  const boxLX = pad + boxIndent; // offset from card left
  const boxW = innerW - boxIndent - 2;

  // Card Y start — pushed down so pills don't overlap
  const cardsY = 78;

  // Section heights (scaled up)
  const titleH = 34;
  const inpSecH = 64;        // header + input box (txid + index)
  const outBoxH = 48;        // each output: value + scriptPubKey
  const outGap = 8;
  const outSecH = 26 + outBoxH + outGap + outBoxH + 8; // header + 2 outputs
  const witSecH = 48;        // header + signature line

  const cardH = titleH + inpSecH + 8 + outSecH + 8 + witSecH + 6;

  // Comparison table
  const compY = cardsY + cardH + 14;
  const compH = 100;
  const H = compY + compH + 10;

  // ── Render a field-style output box ──
  function outputBox(
    cx: number,     // card X
    y: number,      // box top
    idx: number,
    value: string,
    scriptPubKey: string,
    region: string,
    opts?: { dashed?: boolean; bgTint?: string; tagText?: string; tagColor?: string },
  ) {
    const bx = cx + boxLX;
    return (
      <g {...hoverProps(region)}>
        {/* index label */}
        <text x={cx + pad + 8} y={y + 18} fontSize="10" fill={TEXT_MUTED} style={noPtr}>
          {idx}:
        </text>
        <rect
          x={bx} y={y} width={boxW} height={outBoxH} rx="5"
          fill={hovered === region ? "rgba(184,134,11,0.04)" : (opts?.bgTint || "white")}
          stroke={hovered === region ? GOLD : BORDER}
          strokeWidth="1"
          strokeDasharray={opts?.dashed ? "5 3" : undefined}
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        {/* value row */}
        <text x={bx + 8} y={y + 18} fontSize="10" fill={TEXT_MUTED} style={noPtr}>
          value:
        </text>
        <text x={bx + boxW - 8} y={y + 18} fontSize="11" fontWeight="600" fill={GOLD} fontFamily={MONO} textAnchor="end" style={noPtr}>
          {value}
        </text>
        {/* optional tag (delayed / immediate) */}
        {opts?.tagText && (
          <>
            <rect
              x={bx + boxW / 2 - 30} y={y + 5} width={60} height={16} rx="4"
              fill={`${opts.tagColor || GOLD}10`} stroke={opts.tagColor || GOLD} strokeWidth="0.5"
              style={noPtr}
            />
            <text x={bx + boxW / 2} y={y + 16.5} fontSize="8" fontWeight="700" fill={opts.tagColor || GOLD} textAnchor="middle" style={noPtr}>
              {opts.tagText}
            </text>
          </>
        )}
        {/* scriptPubKey row */}
        <text x={bx + 8} y={y + 38} fontSize="10" fill={TEXT_MUTED} style={noPtr}>
          scriptPubKey:
        </text>
        <text x={bx + boxW - 8} y={y + 38} fontSize="9.5" fill={GOLD} fontFamily={MONO} textAnchor="end" style={noPtr}>
          {scriptPubKey}
        </text>
      </g>
    );
  }

  // ── Render a full TX card ──
  function txCard(
    cx: number,
    txName: string,
    badgeText: string,
    badgeColor: string,
    inputRegion: string,
    outputs: Array<{
      region: string;
      value: string;
      scriptPubKey: string;
      dashed?: boolean;
      bgTint?: string;
      tagText?: string;
      tagColor?: string;
    }>,
    witnessRegion: string,
    witnessText: string,
  ) {
    const y = cardsY;
    const bx = cx + pad;
    const ibx = cx + boxLX;

    let secY = y + titleH;

    return (
      <g>
        {/* Card background */}
        <rect
          x={cx} y={y} width={cardW} height={cardH} rx="10"
          fill="white" stroke={BORDER} strokeWidth="1.5"
        />

        {/* Header */}
        <text x={cx + pad + 6} y={y + 22} fontSize="12" fontWeight="700" fill={TEXT_DARK} style={noPtr}>
          {txName}
        </text>
        <rect
          x={cx + cardW - pad - badgeText.length * 5.5 - 16} y={y + 8}
          width={badgeText.length * 5.5 + 14} height={18} rx="4"
          fill={`${badgeColor}0F`} stroke={badgeColor} strokeWidth="0.5"
          style={noPtr}
        />
        <text
          x={cx + cardW - pad - 9}
          y={y + 20.5} fontSize="7" fontWeight="700" fill={badgeColor} textAnchor="end" style={noPtr}
        >
          {badgeText}
        </text>
        <line x1={bx} y1={y + titleH - 2} x2={bx + innerW} y2={y + titleH - 2} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

        {/* ── Inputs section ── */}
        <rect x={bx} y={secY} width={innerW} height={inpSecH} rx="5" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
        <text x={bx + 8} y={secY + 16} fontSize="10" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>
          Inputs
        </text>
        <line x1={bx + 8} y1={secY + 21} x2={bx + innerW - 8} y2={secY + 21} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
        <text x={bx + 10} y={secY + 38} fontSize="10" fill={TEXT_MUTED} style={noPtr}>0:</text>

        <g {...hoverProps(inputRegion)}>
          <rect
            x={ibx} y={secY + 26} width={boxW} height={34} rx="5"
            fill={regionFill(inputRegion)} stroke={regionStroke(inputRegion)}
            strokeWidth="1"
            style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={ibx + 8} y={secY + 42} fontSize="10" fill={TEXT_MUTED} style={noPtr}>txid:</text>
          <text x={ibx + boxW - 8} y={secY + 42} fontSize="10" fontWeight="600" fill={TEXT_DARK} fontFamily={MONO} textAnchor="end" style={noPtr}>
            AliceBobFund...1
          </text>
          <text x={ibx + 8} y={secY + 56} fontSize="10" fill={TEXT_MUTED} style={noPtr}>index:</text>
          <text x={ibx + boxW - 8} y={secY + 56} fontSize="10" fontWeight="600" fill={TEXT_DARK} fontFamily={MONO} textAnchor="end" style={noPtr}>
            0
          </text>
        </g>

        {/* ── Outputs section ── */}
        {(() => {
          secY += inpSecH + 8;
          return (
            <>
              <rect x={bx} y={secY} width={innerW} height={outSecH} rx="5" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
              <text x={bx + 8} y={secY + 16} fontSize="10" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>
                Outputs
              </text>
              <line x1={bx + 8} y1={secY + 21} x2={bx + innerW - 8} y2={secY + 21} stroke={BORDER} strokeWidth="0.3" style={noPtr} />

              {outputs.map((out, i) => {
                const oY = secY + 26 + i * (outBoxH + outGap);
                return outputBox(cx, oY, i, out.value, out.scriptPubKey, out.region, {
                  dashed: out.dashed,
                  bgTint: out.bgTint,
                  tagText: out.tagText,
                  tagColor: out.tagColor,
                });
              })}
            </>
          );
        })()}

        {/* ── Witness section ── */}
        {(() => {
          secY += outSecH + 8;
          return (
            <>
              <rect x={bx} y={secY} width={innerW} height={witSecH} rx="5" fill="#fefdfb" stroke={BORDER} strokeWidth="0.5" />
              <text x={bx + 8} y={secY + 16} fontSize="10" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>
                Witness
              </text>
              <line x1={bx + 8} y1={secY + 21} x2={bx + innerW - 8} y2={secY + 21} stroke={BORDER} strokeWidth="0.3" style={noPtr} />
              <g {...hoverProps(witnessRegion)}>
                <rect
                  x={bx + 6} y={secY + 25} width={innerW - 12} height={18} rx="4"
                  fill={hovered === witnessRegion ? "rgba(184,134,11,0.06)" : "transparent"}
                  stroke={hovered === witnessRegion ? GOLD : "transparent"} strokeWidth="0.5"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={bx + 14} y={secY + 38} fontSize="10" fill={GOLD} fontFamily={MONO} style={noPtr}>
                  {witnessText}
                </text>
              </g>
            </>
          );
        })()}
      </g>
    );
  }

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none" style={{ maxWidth: 800, margin: "0 auto" }}>
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
          <text x={W / 2} y="22" fontSize="16" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
            Closing a Lightning Channel
          </text>
          <text x={W / 2} y="40" fontSize="11" fill={TEXT_MUTED} textAnchor="middle">
            Two ways to settle: cooperate or go it alone
          </text>

          {/* Section label pills — positioned between title and cards */}
          <rect x={leftX + cardW / 2 - 64} y={52} width={128} height={18} rx="9" fill="rgba(22,163,74,0.06)" stroke={GREEN} strokeWidth="0.6" />
          <text x={leftX + cardW / 2} y={64.5} fontSize="9" fontWeight="700" fill={GREEN} textAnchor="middle">Cooperative Close</text>

          <rect x={rightX + cardW / 2 - 48} y={52} width={96} height={18} rx="9" fill="rgba(234,88,12,0.06)" stroke={ORANGE} strokeWidth="0.6" />
          <text x={rightX + cardW / 2} y={64.5} fontSize="9" fontWeight="700" fill={ORANGE} textAnchor="middle">Force Close</text>

          {/* VS divider */}
          <line x1={W / 2} y1={52} x2={W / 2} y2={compY - 8} stroke={BORDER} strokeWidth="0.8" strokeDasharray="4 3" />
          <circle cx={W / 2} cy={cardsY + cardH / 2} r="13" fill="white" stroke={BORDER} strokeWidth="0.8" />
          <text x={W / 2} y={cardsY + cardH / 2 + 4} fontSize="10" fontWeight="700" fill={TEXT_MUTED} textAnchor="middle">vs</text>

          {/* ═══ LEFT: Cooperative Close TX ═══ */}
          {txCard(
            leftX,
            "Closing TX",
            "MUTUAL AGREEMENT",
            GREEN,
            "coop-input",
            [
              {
                region: "coop-out-0",
                value: "30,000,000",
                scriptPubKey: "OP_0 <bob_pubkey_hash>",
                tagText: "immediate",
                tagColor: GREEN,
              },
              {
                region: "coop-out-1",
                value: "70,000,000",
                scriptPubKey: "OP_0 <alice_pubkey_hash>",
                tagText: "immediate",
                tagColor: GREEN,
              },
            ],
            "coop-witness",
            "<alice_sig> <bob_sig>",
          )}

          {/* ═══ RIGHT: Force Close (Commitment TX) ═══ */}
          {txCard(
            rightX,
            "Commitment TX",
            "UNILATERAL",
            ORANGE,
            "force-input",
            [
              {
                region: "force-out-0",
                value: "30,000,000",
                scriptPubKey: "OP_0 <bob_pubkey_hash>",
                tagText: "immediate",
                tagColor: GREEN,
              },
              {
                region: "force-out-1",
                value: "70,000,000",
                scriptPubKey: "OP_0 <script_hash>",
                dashed: true,
                bgTint: GOLD_BG,
                tagText: "144 blocks",
                tagColor: ORANGE,
              },
            ],
            "force-witness",
            "<alice_sig> <bob_sig>",
          )}

          {/* ── Comparison Table ── */}
          <rect
            x={leftX - 4} y={compY} width={cardW * 2 + gap + 8} height={compH} rx="10"
            fill={GOLD_BG} stroke={GOLD} strokeWidth="0.8"
          />
          {(() => {
            const tableL = leftX - 4;
            const tableW = cardW * 2 + gap + 8;
            const col1 = tableL + tableW * 0.14;
            const col2 = tableL + tableW * 0.46;
            const col3 = tableL + tableW * 0.82;
            const headY = compY + 22;
            const r2Y = headY + 24;
            const r3Y = r2Y + 22;
            const r4Y = r3Y + 22;
            return (
              <g style={noPtr}>
                <text x={col2} y={headY} fontSize="12" fontWeight="700" fill={GREEN} textAnchor="middle">Cooperative</text>
                <text x={col3} y={headY} fontSize="12" fontWeight="700" fill={ORANGE} textAnchor="middle">Force Close</text>
                <line x1={tableL + 12} y1={headY + 8} x2={tableL + tableW - 12} y2={headY + 8} stroke={`${GOLD}50`} strokeWidth="0.6" />

                <text x={col1} y={r2Y} fontSize="11" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Fees</text>
                <text x={col2} y={r2Y} fontSize="11" fill={TEXT_MUTED} textAnchor="middle">Low (simple TX)</text>
                <text x={col3} y={r2Y} fontSize="11" fill={TEXT_MUTED} textAnchor="middle">Higher (complex TX)</text>

                <text x={col1} y={r3Y} fontSize="11" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Speed</text>
                <text x={col2} y={r3Y} fontSize="11" fill={GREEN} fontWeight="600" textAnchor="middle">Immediate</text>
                <text x={col3} y={r3Y} fontSize="11" fill={ORANGE} fontWeight="600" textAnchor="middle">~1 day delay</text>

                <text x={col1} y={r4Y} fontSize="11" fontWeight="600" fill={TEXT_DARK} textAnchor="middle">Requires</text>
                <text x={col2} y={r4Y} fontSize="11" fill={TEXT_MUTED} textAnchor="middle">Both parties</text>
                <text x={col3} y={r4Y} fontSize="11" fill={TEXT_MUTED} textAnchor="middle">Only one party</text>
              </g>
            );
          })()}
        </svg>

        {/* Tooltip */}
        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 160), 600)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
