import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "The HTLCs" },
  { label: "Success Path" },
  { label: "Timeout Path" },
];

const ALICE_CLR = "#2563eb";
const BOB_CLR = "#ea580c";
const DIANNE_CLR = "#7c3aed";
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const GREEN = "#16a34a";

// SVG & node layout
const W = 680;
const nodeR = 28;
const aliceX = 94;
const bobX = W / 2;
const dianneX = W - 94;
const nodeY = 116;

// TX card layout
const cardW = 300;
const cardGap = 20;
const lCx = (W - cardW * 2 - cardGap) / 2;
const rCx = lCx + cardW + cardGap;
const pad = 10;
const inW = cardW - pad * 2;

// Card internal Y offsets (from card top)
const tBarH = 38;
const outLblH = 18;
const rowH = 24;
const htlcH = 66;
const cardH = tBarH + outLblH + rowH * 2 + htlcH + 8;
const locY = tBarH + outLblH;
const remY = locY + rowH;
const htlcTop = remY + rowH;
const htlcIfY = htlcTop + 24;
const htlcElY = htlcTop + 46;

const cardsY = nodeY + nodeR + 50;
const cardsEnd = cardsY + cardH;

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "ab-htlc": {
    title: "Alice's Commitment TX",
    description:
      "Alice's commitment TX for the Alice-Bob channel now has three outputs: to_local (Alice's remaining balance, delayed), to_remote (Bob's balance, immediate), and an HTLC output locking 405,000 sats. The HTLC has two spending paths: Bob reveals R to claim, or block 200 passes and Alice reclaims.",
  },
  "bd-htlc": {
    title: "Bob's Commitment TX",
    description:
      "Bob's commitment TX for the Bob-Dianne channel also has three outputs: to_local (Bob's remaining balance, delayed), to_remote (Dianne's balance, immediate), and an HTLC output locking 400,000 sats. The shorter timeout (block 180 vs 200) ensures Bob can learn R from Dianne and still claim from Alice in time.",
  },
  "timeout-delta": {
    title: "Decreasing Timeouts",
    description:
      "Bob's timeout with Dianne (block 180) is shorter than Alice's with Bob (block 200). This 20-block gap ensures Bob has time to learn R from Dianne and reveal it to Alice before her timeout expires.",
  },
  "payment-hash": {
    title: "Payment Hash (H)",
    description:
      "Dianne generates a random preimage R, computes H = SHA256(R), and sends H to Alice in an invoice. Only Dianne knows R. Alice uses H to construct the HTLC chain.",
  },
  "preimage-bd": {
    title: "Dianne Reveals R to Bob",
    description:
      "Dianne reveals the preimage R to claim 400,000 sats from Bob. SHA256(R) = H, satisfying the hash lock. Bob now knows R.",
  },
  "preimage-ab": {
    title: "Bob Reveals R to Alice",
    description:
      "Bob reveals R to Alice to claim 405,000 sats. He learned R from Dianne. Alice now has R as a cryptographic receipt proving the payment was delivered.",
  },
  success: {
    title: "Success: All HTLCs Settle",
    description:
      "The preimage R flows backward along the route. Each hop settles atomically. Alice paid 405,000, Bob earned 5,000 in fees, Dianne received 400,000.",
  },
  timeout: {
    title: "Timeout: All HTLCs Expire",
    description:
      "If Dianne never reveals R, Bob's HTLC expires first (block 180), then Alice's (block 200). All funds return to their senders. The payment fails safely.",
  },
};

interface TxCfg {
  title: string;
  subtitle: string;
  localOwner: string;
  localVal: string;
  remoteOwner: string;
  remoteVal: string;
  htlcAmt: string;
  htlcTo: string;
  htlcFrom: string;
  htlcTimeout: string;
}

const AB_CFG: TxCfg = {
  title: "Alice's Commitment TX",
  subtitle: "Alice \u2192 Bob channel",
  localOwner: "Alice",
  localVal: "295,000",
  remoteOwner: "Bob",
  remoteVal: "300,000",
  htlcAmt: "405,000",
  htlcTo: "Bob",
  htlcFrom: "Alice",
  htlcTimeout: "200",
};

const BD_CFG: TxCfg = {
  title: "Bob's Commitment TX",
  subtitle: "Bob \u2192 Dianne channel",
  localOwner: "Bob",
  localVal: "400,000",
  remoteOwner: "Dianne",
  remoteVal: "200,000",
  htlcAmt: "400,000",
  htlcTo: "Dianne",
  htlcFrom: "Bob",
  htlcTimeout: "180",
};

export function HTLCDiagram() {
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [animKey, setAnimKey] = useState(0);
  const replay = useCallback(() => setAnimKey((k) => k + 1), []);

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
  const H = step === 0 ? 436 : step === 1 ? 460 : 454;

  function renderNodes(opts?: { fadeDianne?: boolean }) {
    return (
      <>
        <circle cx={aliceX} cy={nodeY} r={nodeR} fill="rgba(37,99,235,0.08)" stroke={ALICE_CLR} strokeWidth="2.5" />
        <text x={aliceX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>A</text>
        <text x={aliceX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>Alice</text>

        <circle cx={bobX} cy={nodeY} r={nodeR} fill="rgba(234,88,12,0.08)" stroke={BOB_CLR} strokeWidth="2.5" />
        <text x={bobX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={BOB_CLR} textAnchor="middle" style={noPtr}>B</text>
        <text x={bobX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={BOB_CLR} textAnchor="middle" style={noPtr}>Bob</text>

        <g style={{ opacity: opts?.fadeDianne ? 0.4 : 1 }}>
          <circle cx={dianneX} cy={nodeY} r={nodeR} fill="rgba(124,58,237,0.08)" stroke={DIANNE_CLR} strokeWidth="2.5" />
          <text x={dianneX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>D</text>
          <text x={dianneX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>Dianne</text>
        </g>

        <rect x={aliceX + nodeR + 6} y={nodeY + nodeR + 8} width={bobX - aliceX - nodeR * 2 - 12} height={5} rx="2.5"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
        <rect x={bobX + nodeR + 6} y={nodeY + nodeR + 8} width={dianneX - bobX - nodeR * 2 - 12} height={5} rx="2.5"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
      </>
    );
  }

  function renderTxCard(x: number, y: number, c: TxCfg, region: string, opacity = 1) {
    const isH = hovered === region;
    const bx = x + pad;
    return (
      <g {...hoverProps(region)} style={{ opacity }}>
        <rect x={x} y={y} width={cardW} height={cardH} rx="8"
          fill={isH ? "rgba(184,134,11,0.04)" : "white"}
          stroke={isH ? GOLD : BORDER} strokeWidth="1.5"
          style={{ transition: "fill .15s ease, stroke .15s ease" }} />

        {/* Title */}
        <text x={x + 12} y={y + 17} fontSize="11.5" fontWeight="700" fill={TEXT_DARK} style={noPtr}>{c.title}</text>
        <text x={x + 12} y={y + 31} fontSize="9" fill={TEXT_MUTED} style={noPtr}>{c.subtitle}</text>
        <line x1={x + 8} y1={y + tBarH} x2={x + cardW - 8} y2={y + tBarH} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

        {/* Outputs header */}
        <text x={bx} y={y + tBarH + 14} fontSize="10" fontWeight="700" fill={TEXT_DARK} letterSpacing="0.03em" style={noPtr}>Outputs</text>

        {/* BOLT 3: outputs sorted by lowest value first */}
        {(() => {
          const localNum = parseInt(c.localVal.replace(/,/g, ""), 10);
          const remoteNum = parseInt(c.remoteVal.replace(/,/g, ""), 10);
          const localFirst = localNum <= remoteNum;
          const row0Y = locY;  // first output row Y
          const row1Y = remY;  // second output row Y

          const localRow = (rY: number, idx: number) => (
            <g key="local">
              <rect x={bx} y={y + rY} width={inW} height={rowH - 2} rx="4"
                fill={GOLD_BG} stroke={GOLD} strokeWidth="0.5" strokeDasharray="4 2" style={noPtr} />
              <text x={bx + 8} y={y + rY + 15} fontSize="9" fill={TEXT_MUTED} style={noPtr}>{idx}: to_local</text>
              <text x={bx + 78} y={y + rY + 15} fontSize="9" fontWeight="600" fill={GOLD} style={noPtr}>{c.localOwner} (DELAYED)</text>
              <text x={bx + inW - 6} y={y + rY + 15} fontSize="9" fontWeight="700" fill={GOLD} fontFamily={mono} textAnchor="end" style={noPtr}>{c.localVal}</text>
            </g>
          );

          const remoteRow = (rY: number, idx: number) => (
            <g key="remote">
              <rect x={bx} y={y + rY} width={inW} height={rowH - 2} rx="4"
                fill="white" stroke={BORDER} strokeWidth="0.5" style={noPtr} />
              <text x={bx + 8} y={y + rY + 15} fontSize="9" fill={TEXT_MUTED} style={noPtr}>{idx}: to_remote</text>
              <text x={bx + 78} y={y + rY + 15} fontSize="9" fontWeight="600" fill={GREEN} style={noPtr}>{c.remoteOwner} (IMMEDIATE)</text>
              <text x={bx + inW - 6} y={y + rY + 15} fontSize="9" fontWeight="700" fill={GOLD} fontFamily={mono} textAnchor="end" style={noPtr}>{c.remoteVal}</text>
            </g>
          );

          return localFirst ? (
            <>{localRow(row0Y, 0)}{remoteRow(row1Y, 1)}</>
          ) : (
            <>{remoteRow(row0Y, 0)}{localRow(row1Y, 1)}</>
          );
        })()}

        {/* 2: HTLC Output */}
        <rect x={bx} y={y + htlcTop} width={inW} height={htlcH} rx="5"
          fill="rgba(184,134,11,0.03)" stroke={GOLD} strokeWidth="0.8" style={noPtr} />
        <text x={bx + 8} y={y + htlcTop + 16} fontSize="9" fontWeight="700" fill={TEXT_DARK} style={noPtr}>2: HTLC Output</text>
        <text x={bx + inW - 6} y={y + htlcTop + 16} fontSize="10" fontWeight="700" fill={GOLD} fontFamily={mono} textAnchor="end" style={noPtr}>{c.htlcAmt} sats</text>
        <line x1={bx + 6} y1={y + htlcTop + 22} x2={bx + inW - 6} y2={y + htlcTop + 22} stroke={BORDER} strokeWidth="0.4" style={noPtr} />

        {/* IF condition */}
        <rect x={bx + 6} y={y + htlcIfY} width={inW - 12} height={18} rx="4"
          fill="rgba(22,163,74,0.04)" stroke={GREEN} strokeWidth="0.5" style={noPtr} />
        <text x={bx + 14} y={y + htlcIfY + 13} fontSize="9" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
        <text x={bx + 30} y={y + htlcIfY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>{c.htlcTo} reveals R where SHA256(R) = H</text>

        {/* ELSE condition */}
        <rect x={bx + 6} y={y + htlcElY} width={inW - 12} height={18} rx="4"
          fill="rgba(184,134,11,0.04)" stroke={GOLD} strokeWidth="0.5" style={noPtr} />
        <text x={bx + 14} y={y + htlcElY + 13} fontSize="9" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE</text>
        <text x={bx + 46} y={y + htlcElY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>{"block > "}{c.htlcTimeout}, {c.htlcFrom} reclaims</text>
      </g>
    );
  }

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none" style={{ maxWidth: 780, margin: "0 auto" }}>
      <div className="vl-card-3d-inner" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto", fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          <style>{`
            @keyframes htlc-fade-in {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes htlc-draw-line {
              from { stroke-dashoffset: 400; }
              to   { stroke-dashoffset: 0; }
            }
            .htlc-draw { stroke-dasharray: 400; stroke-dashoffset: 400; }
            .ha0 { opacity:0; animation: htlc-fade-in .5s ease-out .4s forwards }
            .ha1 { opacity:0; animation: htlc-fade-in .5s ease-out 1.0s forwards }
            .ha2 { opacity:0; animation: htlc-fade-in .5s ease-out 1.7s forwards }
            .ha3 { opacity:0; animation: htlc-fade-in .5s ease-out 2.3s forwards }
            .ha4 { opacity:0; animation: htlc-fade-in .5s ease-out 3.0s forwards }
            .hd0 { animation: htlc-draw-line .6s ease-out 1.0s forwards }
            .hb0 { opacity:0; animation: htlc-fade-in .4s ease-out .3s forwards }
            .hb1 { opacity:0; animation: htlc-fade-in .4s ease-out 1.2s forwards }
            .hb2 { opacity:0; animation: htlc-fade-in .4s ease-out 2.2s forwards }
            .hb3 { opacity:0; animation: htlc-fade-in .4s ease-out 3.0s forwards }
            .hb4 { opacity:0; animation: htlc-fade-in .4s ease-out 3.8s forwards }
            .hbd1 { animation: htlc-draw-line .5s ease-out .3s forwards }
            .hbd2 { animation: htlc-draw-line .5s ease-out 2.2s forwards }
            .hc0 { opacity:0; animation: htlc-fade-in .4s ease-out .3s forwards }
            .hc1 { opacity:0; animation: htlc-fade-in .4s ease-out 1.1s forwards }
            .hc2 { opacity:0; animation: htlc-fade-in .4s ease-out 1.9s forwards }
          `}</style>

          <defs>
            <marker id="htlc-arr-purple" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={DIANNE_CLR} />
            </marker>
            <marker id="htlc-arr-green" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={GREEN} />
            </marker>
          </defs>

          {/* ═══════ STEP 0: The HTLC Contracts ═══════ */}
          {step === 0 && (
            <g key={`s0-${animKey}`}>
              <text x={W / 2} y="22" fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Hash Time-Locked Contracts
              </text>
              <text x={W / 2} y="40" fontSize="12" fill={TEXT_MUTED} textAnchor="middle">
                HTLCs are separate outputs on commitment transactions
              </text>

              {renderNodes()}

              {/* Dianne's secret */}
              <g className="ha0">
                <rect x={dianneX - 42} y={nodeY + nodeR + 16} width={84} height={20} rx="5"
                  fill="rgba(124,58,237,0.06)" stroke={DIANNE_CLR} strokeWidth="0.6" />
                <text x={dianneX} y={nodeY + nodeR + 30} fontSize="9" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" fontFamily={mono} style={noPtr}>
                  R = secret
                </text>
              </g>

              {/* Hash arrow Dianne → Alice */}
              <g className="ha1" {...hoverProps("payment-hash")}>
                {(() => {
                  const arrowY = nodeY - nodeR - 30;
                  return (
                    <>
                      <line
                        x1={dianneX - nodeR - 4} y1={arrowY}
                        x2={aliceX + nodeR + 10} y2={arrowY}
                        stroke={DIANNE_CLR} strokeWidth="1.5" strokeDasharray="5 3"
                        markerEnd="url(#htlc-arr-purple)"
                        className="htlc-draw hd0"
                      />
                      <rect
                        x={W / 2 - 64} y={arrowY - 13} width={128} height={20} rx="5"
                        fill={hovered === "payment-hash" ? "rgba(124,58,237,0.1)" : "white"}
                        stroke="rgba(124,58,237,0.4)" strokeWidth="0.6"
                        style={{ transition: "fill 0.15s ease" }}
                      />
                      <text x={W / 2} y={arrowY + 1} fontSize="10" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" fontFamily={mono} style={noPtr}>
                        H = SHA256(R)
                      </text>
                    </>
                  );
                })()}
              </g>

              {/* Left TX card */}
              <g className="ha2">
                {renderTxCard(lCx, cardsY, AB_CFG, "ab-htlc")}
              </g>

              {/* Right TX card */}
              <g className="ha3">
                {renderTxCard(rCx, cardsY, BD_CFG, "bd-htlc")}
              </g>

              {/* Timeout delta */}
              <g className="ha4" {...hoverProps("timeout-delta")}>
                <rect
                  x={W / 2 - 90} y={cardsEnd + 12} width={180} height={34} rx="7"
                  fill={hovered === "timeout-delta" ? "rgba(184,134,11,0.1)" : GOLD_BG}
                  stroke={GOLD} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsEnd + 28} fontSize="10" fontWeight="600" fill={GOLD} textAnchor="middle" style={noPtr}>
                  Timeout: 200 → 180
                </text>
                <text x={W / 2} y={cardsEnd + 40} fontSize="9" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  shorter downstream = safe for Bob
                </text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 1: Success Path ═══════ */}
          {step === 1 && (
            <g key={`s1-${animKey}`}>
              <text x={W / 2} y="22" fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Success: Preimage Settles Both HTLCs
              </text>
              <text x={W / 2} y="40" fontSize="12" fill={TEXT_MUTED} textAnchor="middle">
                Dianne reveals R to Bob, then Bob reveals R to Alice
              </text>

              {renderNodes()}

              {/* Faded TX cards */}
              {renderTxCard(lCx, cardsY, AB_CFG, "ab-htlc", 0.25)}
              {renderTxCard(rCx, cardsY, BD_CFG, "bd-htlc", 0.25)}

              {/* Phase 1: Dianne → Bob update_fulfill_htlc */}
              <g className="hb0" {...hoverProps("preimage-bd")}>
                <line
                  x1={dianneX - nodeR - 4} y1={nodeY + 16}
                  x2={bobX + nodeR + 10} y2={nodeY + 16}
                  stroke={GREEN} strokeWidth="2.5"
                  markerEnd="url(#htlc-arr-green)"
                  className="htlc-draw hbd1"
                />
                {(() => {
                  const cx = (bobX + dianneX) / 2;
                  const cw = 168, ch = 46, cy = nodeY + 22;
                  return (
                    <g style={noPtr}>
                      <rect x={cx - cw / 2} y={cy} width={cw} height={ch} rx={5}
                        fill="white" stroke={BORDER} strokeWidth="1" />
                      <rect x={cx - cw / 2} y={cy} width={cw} height={18} rx={5} fill={`${GREEN}08`} />
                      <rect x={cx - cw / 2} y={cy + 12} width={cw} height={6} fill={`${GREEN}08`} />
                      <line x1={cx - cw / 2 + 3} y1={cy + 18} x2={cx + cw / 2 - 3} y2={cy + 18} stroke={BORDER} strokeWidth="0.5" />
                      <text x={cx - cw / 2 + 6} y={cy + 13} fontSize="8.5" fontWeight="700" fontFamily={mono} fill={GREEN}>update_fulfill_htlc</text>
                      <text x={cx - cw / 2 + 6} y={cy + 31} fontSize="8" fill={TEXT_MUTED} fontFamily={mono}>channel_id:</text>
                      <text x={cx + cw / 2 - 6} y={cy + 31} fontSize="8" fontWeight="600" fill={TEXT_DARK} fontFamily={mono} textAnchor="end">BobDianne1</text>
                      <text x={cx - cw / 2 + 6} y={cy + 43} fontSize="8" fill={TEXT_MUTED} fontFamily={mono}>payment_preimage:</text>
                      <text x={cx + cw / 2 - 6} y={cy + 43} fontSize="8" fontWeight="700" fill={GREEN} fontFamily={mono} textAnchor="end">R</text>
                    </g>
                  );
                })()}
              </g>

              {/* Phase 2: Right card HTLC IF highlights */}
              <g className="hb1">
                <rect x={rCx + pad + 6} y={cardsY + htlcIfY} width={inW - 12} height={18} rx="4"
                  fill="rgba(22,163,74,0.18)" stroke={GREEN} strokeWidth="1.2" />
                <text x={rCx + pad + 14} y={cardsY + htlcIfY + 13} fontSize="9" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
                <text x={rCx + pad + 30} y={cardsY + htlcIfY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>Dianne reveals R ✓</text>
                <text x={dianneX + nodeR + 6} y={nodeY + 6} fontSize="15" fill={GREEN} style={noPtr}>✓</text>
              </g>

              {/* Phase 3: Bob → Alice update_fulfill_htlc */}
              <g className="hb2" {...hoverProps("preimage-ab")}>
                <line
                  x1={bobX - nodeR - 4} y1={nodeY + 16}
                  x2={aliceX + nodeR + 10} y2={nodeY + 16}
                  stroke={GREEN} strokeWidth="2.5"
                  markerEnd="url(#htlc-arr-green)"
                  className="htlc-draw hbd2"
                />
                {(() => {
                  const cx = (aliceX + bobX) / 2;
                  const cw = 168, ch = 46, cy = nodeY + 22;
                  return (
                    <g style={noPtr}>
                      <rect x={cx - cw / 2} y={cy} width={cw} height={ch} rx={5}
                        fill="white" stroke={BORDER} strokeWidth="1" />
                      <rect x={cx - cw / 2} y={cy} width={cw} height={18} rx={5} fill={`${GREEN}08`} />
                      <rect x={cx - cw / 2} y={cy + 12} width={cw} height={6} fill={`${GREEN}08`} />
                      <line x1={cx - cw / 2 + 3} y1={cy + 18} x2={cx + cw / 2 - 3} y2={cy + 18} stroke={BORDER} strokeWidth="0.5" />
                      <text x={cx - cw / 2 + 6} y={cy + 13} fontSize="8.5" fontWeight="700" fontFamily={mono} fill={GREEN}>update_fulfill_htlc</text>
                      <text x={cx - cw / 2 + 6} y={cy + 31} fontSize="8" fill={TEXT_MUTED} fontFamily={mono}>channel_id:</text>
                      <text x={cx + cw / 2 - 6} y={cy + 31} fontSize="8" fontWeight="600" fill={TEXT_DARK} fontFamily={mono} textAnchor="end">AliceBob1</text>
                      <text x={cx - cw / 2 + 6} y={cy + 43} fontSize="8" fill={TEXT_MUTED} fontFamily={mono}>payment_preimage:</text>
                      <text x={cx + cw / 2 - 6} y={cy + 43} fontSize="8" fontWeight="700" fill={GREEN} fontFamily={mono} textAnchor="end">R</text>
                    </g>
                  );
                })()}
              </g>

              {/* Phase 4: Left card HTLC IF highlights */}
              <g className="hb3">
                <rect x={lCx + pad + 6} y={cardsY + htlcIfY} width={inW - 12} height={18} rx="4"
                  fill="rgba(22,163,74,0.18)" stroke={GREEN} strokeWidth="1.2" />
                <text x={lCx + pad + 14} y={cardsY + htlcIfY + 13} fontSize="9" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
                <text x={lCx + pad + 30} y={cardsY + htlcIfY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>Bob reveals R ✓</text>
                <text x={bobX + nodeR + 6} y={nodeY + 6} fontSize="15" fill={GREEN} style={noPtr}>✓</text>
                <text x={aliceX + nodeR + 6} y={nodeY + 6} fontSize="15" fill={GREEN} style={noPtr}>✓</text>
              </g>

              {/* Phase 5: Summary */}
              <g className="hb4" {...hoverProps("success")}>
                <rect
                  x={W / 2 - 220} y={cardsEnd + 14} width={440} height={52} rx="7"
                  fill={hovered === "success" ? "rgba(184,134,11,0.08)" : GOLD_BG}
                  stroke="#d4a038" strokeWidth="0.5"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsEnd + 36} fontSize="11" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                  Both HTLC IF branches triggered. Payment complete.
                </text>
                <text x={W / 2 - 140} y={cardsEnd + 56} fontSize="10" fill={ALICE_CLR} fontWeight="600" style={noPtr}>Alice paid 405k</text>
                <text x={W / 2} y={cardsEnd + 56} fontSize="10" fill={BOB_CLR} fontWeight="600" textAnchor="middle" style={noPtr}>Bob earned 5k fee</text>
                <text x={W / 2 + 140} y={cardsEnd + 56} fontSize="10" fill={DIANNE_CLR} fontWeight="600" textAnchor="end" style={noPtr}>Dianne got 400k</text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 2: Timeout Path ═══════ */}
          {step === 2 && (
            <g key={`s2-${animKey}`}>
              <text x={W / 2} y="22" fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Timeout: All HTLCs Expire Safely
              </text>
              <text x={W / 2} y="40" fontSize="12" fill={TEXT_MUTED} textAnchor="middle">
                No preimage revealed. Funds return to senders.
              </text>

              {renderNodes({ fadeDianne: true })}

              {/* Faded TX cards */}
              {renderTxCard(lCx, cardsY, AB_CFG, "ab-htlc", 0.3)}
              {renderTxCard(rCx, cardsY, BD_CFG, "bd-htlc", 0.3)}

              {/* Phase 1: Right card HTLC ELSE highlights */}
              <g className="hc0">
                <rect x={rCx + pad + 6} y={cardsY + htlcElY} width={inW - 12} height={18} rx="4"
                  fill="rgba(184,134,11,0.18)" stroke={GOLD} strokeWidth="1.2" />
                <text x={rCx + pad + 14} y={cardsY + htlcElY + 13} fontSize="9" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE</text>
                <text x={rCx + pad + 46} y={cardsY + htlcElY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>{"block > 180 \u23F0 Bob reclaims"}</text>
              </g>

              {/* Phase 2: Left card HTLC ELSE highlights */}
              <g className="hc1">
                <rect x={lCx + pad + 6} y={cardsY + htlcElY} width={inW - 12} height={18} rx="4"
                  fill="rgba(184,134,11,0.18)" stroke={GOLD} strokeWidth="1.2" />
                <text x={lCx + pad + 14} y={cardsY + htlcElY + 13} fontSize="9" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE</text>
                <text x={lCx + pad + 46} y={cardsY + htlcElY + 13} fontSize="8.5" fill={TEXT_DARK} style={noPtr}>{"block > 200 \u23F0 Alice reclaims"}</text>
              </g>

              {/* Phase 3: Summary */}
              <g className="hc2" {...hoverProps("timeout")}>
                <rect
                  x={W / 2 - 220} y={cardsEnd + 14} width={440} height={46} rx="7"
                  fill={hovered === "timeout" ? "rgba(184,134,11,0.1)" : GOLD_BG}
                  stroke={GOLD} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsEnd + 34} fontSize="11" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                  Both HTLC ELSE branches triggered. Payment safely failed.
                </text>
                <text x={W / 2} y={cardsEnd + 50} fontSize="10" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  Downstream expires first (180), then upstream (200)
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Replay button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0 0" }}>
          <button
            onClick={replay}
            title="Replay animation"
            style={{
              width: 26, height: 26, borderRadius: "50%",
              border: `1.5px solid ${BORDER}`, background: "white",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: TEXT_MUTED,
              transition: "all 0.2s ease", padding: 0, flexShrink: 0,
            }}
            aria-label="Replay animation"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>
        <VLStepAnimation steps={STEPS} currentStep={step} onStepChange={setStep} />

        {hovered && tooltip && (
          <VLTooltip
            title={tooltip.title}
            description={tooltip.description}
            x={Math.min(Math.max(tooltipPos.x, 120), 560)}
            y={tooltipPos.y}
          />
        )}
      </div>
    </div>
  );
}
