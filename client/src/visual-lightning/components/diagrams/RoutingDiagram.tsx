import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "Invoice" },
  { label: "HTLC Chain" },
  { label: "Settlement" },
  { label: "Result" },
];

// ── Party colors ──
const ALICE_CLR = "#2563eb";
const BOB_CLR = "#ea580c";
const DIANNE_CLR = "#7c3aed";

// ── Course palette ──
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const GREEN = "#16a34a";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "alice-node": {
    title: "Alice (Sender)",
    description:
      "Alice wants to pay Dianne 400,000 sats. She doesn't share a channel with Dianne, but she has one with Bob. She creates an HTLC with Bob for 405,000 sats (400,000 + 5,000 routing fee).",
  },
  "bob-node": {
    title: "Bob (Routing Node)",
    description:
      "Bob forwards the payment. He receives 405,000 sats from Alice and pays 400,000 sats to Dianne, keeping 5,000 sats as his routing fee. He uses the same payment hash H for both HTLCs.",
  },
  "dianne-node": {
    title: "Dianne (Recipient)",
    description:
      "Dianne generated the invoice with payment hash H = SHA256(R). Only she knows the preimage R. By revealing R to claim her HTLC, she triggers settlement along the entire route.",
  },
  "ab-htlc": {
    title: "Alice → Bob HTLC",
    description:
      "Alice locks 405,000 sats with Bob. IF Bob reveals R before block 200, he claims the funds. The extra 5,000 sats over Dianne's price covers Bob's routing fee.",
  },
  "bd-htlc": {
    title: "Bob → Dianne HTLC",
    description:
      "Bob locks 400,000 sats with Dianne using the same hash H. The timeout (block 180) is shorter than Alice's (block 200), ensuring Bob has time to claim from Alice after learning R from Dianne.",
  },
  "timeout-delta": {
    title: "Timeout Delta",
    description:
      "Bob's timeout with Dianne (block 180) is shorter than Alice's with Bob (block 200). This 20-block gap ensures Bob can learn R from Dianne and still have time to reveal it to Alice before her timeout expires.",
  },
  "routing-fee": {
    title: "Routing Fee",
    description:
      "Bob earns 5,000 sats (405,000 - 400,000) for forwarding the payment. This incentivizes nodes to provide liquidity and maintain reliable channels.",
  },
  invoice: {
    title: "Lightning Invoice",
    description:
      "Dianne generates a random preimage R, computes H = SHA256(R), and creates an invoice containing H and her routing info. She sends this to Alice.",
  },
  "preimage-flow": {
    title: "Preimage Settlement",
    description:
      "The preimage R flows backward: Dianne reveals it to Bob (claiming 400k), then Bob reveals it to Alice (claiming 405k). Each node proves delivery by presenting R.",
  },
};

export function RoutingDiagram() {
  const [step, setStep] = useState(0);
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
  const nodeR = 24;
  const aliceX = 80;
  const bobX = W / 2;
  const dianneX = W - 80;
  const nodeY = 70;

  // HTLC card dimensions
  const htlcCardW = 250;
  const htlcCardH = 108;

  const H = step === 0 ? 260 : step === 1 ? 380 : step === 2 ? 360 : 300;

  // ── Render three nodes ──
  function renderNodes(opts?: { fadeBob?: boolean }) {
    return (
      <>
        <g {...hoverProps("alice-node")}>
          <circle
            cx={aliceX} cy={nodeY} r={nodeR}
            fill={hovered === "alice-node" ? "rgba(37,99,235,0.14)" : "rgba(37,99,235,0.06)"}
            stroke={ALICE_CLR} strokeWidth="2"
            style={{ transition: "fill 0.15s ease" }}
          />
          <text x={aliceX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>A</text>
          <text x={aliceX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>Alice</text>
        </g>

        <g {...hoverProps("bob-node")} style={{ opacity: opts?.fadeBob ? 0.5 : 1 }}>
          <circle
            cx={bobX} cy={nodeY} r={nodeR}
            fill={hovered === "bob-node" ? "rgba(234,88,12,0.14)" : "rgba(234,88,12,0.06)"}
            stroke={BOB_CLR} strokeWidth="2"
            style={{ transition: "fill 0.15s ease" }}
          />
          <text x={bobX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={BOB_CLR} textAnchor="middle" style={noPtr}>B</text>
          <text x={bobX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={BOB_CLR} textAnchor="middle" style={noPtr}>Bob</text>
        </g>

        <g {...hoverProps("dianne-node")}>
          <circle
            cx={dianneX} cy={nodeY} r={nodeR}
            fill={hovered === "dianne-node" ? "rgba(124,58,237,0.14)" : "rgba(124,58,237,0.06)"}
            stroke={DIANNE_CLR} strokeWidth="2"
            style={{ transition: "fill 0.15s ease" }}
          />
          <text x={dianneX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>D</text>
          <text x={dianneX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>Dianne</text>
        </g>

        {/* Channel bars */}
        <rect
          x={aliceX + nodeR + 6} y={nodeY + nodeR + 4}
          width={bobX - aliceX - nodeR * 2 - 12} height={4} rx="2"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5"
        />
        <rect
          x={bobX + nodeR + 6} y={nodeY + nodeR + 4}
          width={dianneX - bobX - nodeR * 2 - 12} height={4} rx="2"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5"
        />
      </>
    );
  }

  // ── Render compact HTLC contract card ──
  function renderHTLCCard(
    x: number, y: number,
    from: string, to: string, amount: string, timeout: string,
    region: string, fromClr: string, toClr: string,
  ) {
    const isH = hovered === region;
    const ifY = y + 30;
    const elseY = ifY + 38;
    return (
      <g {...hoverProps(region)}>
        {/* Card */}
        <rect
          x={x} y={y} width={htlcCardW} height={htlcCardH} rx="6"
          fill={isH ? "rgba(184,134,11,0.04)" : "white"}
          stroke={isH ? GOLD : BORDER} strokeWidth="1.2"
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        {/* Header */}
        <text x={x + 10} y={y + 17} fontSize="9" fontWeight="700" fill={TEXT_DARK} style={noPtr}>
          HTLC: {from} → {to}
        </text>
        <rect x={x + htlcCardW - 92} y={y + 4} width={82} height={16} rx="3" fill={GOLD_BG} stroke={GOLD} strokeWidth="0.5" style={noPtr} />
        <text x={x + htlcCardW - 51} y={y + 15} fontSize="8" fontWeight="700" fill={GOLD} textAnchor="middle" fontFamily={mono} style={noPtr}>
          {amount} sats
        </text>
        <line x1={x + 6} y1={y + 24} x2={x + htlcCardW - 6} y2={y + 24} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

        {/* IF block */}
        <rect x={x + 6} y={ifY} width={htlcCardW - 12} height={32} rx="4"
          fill="rgba(22,163,74,0.04)" stroke={GREEN} strokeWidth="0.5" style={noPtr} />
        <text x={x + 14} y={ifY + 13} fontSize="8" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
        <text x={x + 34} y={ifY + 13} fontSize="7.5" fill={TEXT_DARK} style={noPtr}>
          {to} reveals preimage R
        </text>
        <text x={x + 14} y={ifY + 26} fontSize="8" fontWeight="600" fill={GREEN} style={noPtr}>
          → {from} pays {to} {amount} sats
        </text>

        {/* ELSE block */}
        <rect x={x + 6} y={elseY} width={htlcCardW - 12} height={26} rx="4"
          fill="rgba(184,134,11,0.04)" stroke={GOLD} strokeWidth="0.5" style={noPtr} />
        <text x={x + 14} y={elseY + 12} fontSize="8" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE IF</text>
        <text x={x + 66} y={elseY + 12} fontSize="7.5" fill={TEXT_DARK} style={noPtr}>
          {"block > "}{timeout}
        </text>
        <text x={x + 14} y={elseY + 23} fontSize="7.5" fontWeight="600" fill={GOLD} style={noPtr}>
          → Offer expires, {from} reclaims
        </text>
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
          <style>{`
            @keyframes rt-enter {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .rt-enter { animation: rt-enter 0.4s ease-out both; }
          `}</style>

          <defs>
            <marker id="rt-arr-muted" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={TEXT_MUTED} />
            </marker>
            <marker id="rt-arr-green" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={GREEN} />
            </marker>
            <marker id="rt-arr-gold" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={GOLD} />
            </marker>
          </defs>

          {/* ═══════ STEP 0: Invoice ═══════ */}
          {step === 0 && (
            <g className="rt-enter">
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Step 1: Dianne Creates an Invoice
              </text>
              <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                The payment starts with a hash and a route
              </text>

              {renderNodes()}

              {/* Dianne's preimage */}
              <rect x={dianneX - 36} y={nodeY + nodeR + 16} width={72} height={18} rx="4"
                fill="rgba(124,58,237,0.06)" stroke={DIANNE_CLR} strokeWidth="0.6" />
              <text x={dianneX} y={nodeY + nodeR + 29} fontSize="7.5" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" fontFamily={mono} style={noPtr}>
                R = secret
              </text>

              {/* Invoice card */}
              <g {...hoverProps("invoice")} className="rt-enter" style={{ animationDelay: "0.2s" }}>
                <rect
                  x={W / 2 - 90} y={nodeY + nodeR + 30} width={180} height={60} rx="6"
                  fill={hovered === "invoice" ? "rgba(124,58,237,0.08)" : "white"}
                  stroke={DIANNE_CLR} strokeWidth="1"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={nodeY + nodeR + 46} fontSize="9" fontWeight="700" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>
                  Invoice
                </text>
                <text x={W / 2 - 76} y={nodeY + nodeR + 60} fontSize="8" fill={TEXT_MUTED} style={noPtr}>Price:</text>
                <text x={W / 2 + 76} y={nodeY + nodeR + 60} fontSize="8" fontWeight="600" fill={TEXT_DARK} textAnchor="end" fontFamily={mono} style={noPtr}>400,000 sats</text>
                <text x={W / 2 - 76} y={nodeY + nodeR + 74} fontSize="8" fill={TEXT_MUTED} style={noPtr}>Hash:</text>
                <text x={W / 2 + 76} y={nodeY + nodeR + 74} fontSize="8" fontWeight="600" fill={DIANNE_CLR} textAnchor="end" fontFamily={mono} style={noPtr}>H = SHA256(R)</text>
              </g>

              {/* Arrow from invoice to Alice */}
              <g className="rt-enter" style={{ animationDelay: "0.4s" }}>
                <line
                  x1={W / 2 - 90} y1={nodeY + nodeR + 50}
                  x2={aliceX + nodeR + 8} y2={nodeY + nodeR + 50}
                  stroke={TEXT_MUTED} strokeWidth="1" strokeDasharray="4 2"
                  markerEnd="url(#rt-arr-muted)" style={noPtr}
                />
                <text x={aliceX + nodeR + 16} y={nodeY + nodeR + 47} fontSize="7" fill={TEXT_MUTED} style={noPtr}>
                  sent to Alice
                </text>
              </g>

              {/* Caption */}
              <rect x={W / 2 - 188} y={224} width={376} height={26} rx="6" fill={GOLD_BG} stroke="#d4a038" strokeWidth="0.5" />
              <text x={W / 2} y={241} fontSize="9" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                Dianne knows R. Alice knows H. Bob knows nothing (yet).
              </text>
            </g>
          )}

          {/* ═══════ STEP 1: HTLC Chain ═══════ */}
          {step === 1 && (
            <g className="rt-enter">
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Step 2: HTLC Chain Forward
              </text>
              <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                Alice chains HTLCs along the route, each locked to the same hash H
              </text>

              {renderNodes()}

              {/* Forward arrows */}
              <g style={noPtr}>
                <line x1={aliceX + nodeR + 4} y1={nodeY + 12} x2={bobX - nodeR - 8} y2={nodeY + 12}
                  stroke={GOLD} strokeWidth="1.5" markerEnd="url(#rt-arr-gold)" />
                <line x1={bobX + nodeR + 4} y1={nodeY + 12} x2={dianneX - nodeR - 8} y2={nodeY + 12}
                  stroke={GOLD} strokeWidth="1.5" markerEnd="url(#rt-arr-gold)" />
              </g>

              {/* Alice → Bob HTLC card */}
              <g className="rt-enter" style={{ animationDelay: "0.2s" }}>
                {renderHTLCCard(
                  20, nodeY + nodeR + 24,
                  "Alice", "Bob", "405,000", "200",
                  "ab-htlc", ALICE_CLR, BOB_CLR,
                )}
              </g>

              {/* Bob → Dianne HTLC card */}
              <g className="rt-enter" style={{ animationDelay: "0.4s" }}>
                {renderHTLCCard(
                  W - 20 - htlcCardW, nodeY + nodeR + 24,
                  "Bob", "Dianne", "400,000", "180",
                  "bd-htlc", BOB_CLR, DIANNE_CLR,
                )}
              </g>

              {/* Timeout delta annotation */}
              <g {...hoverProps("timeout-delta")} className="rt-enter" style={{ animationDelay: "0.6s" }}>
                <rect
                  x={W / 2 - 70} y={nodeY + nodeR + htlcCardH + 36} width={140} height={28} rx="6"
                  fill={hovered === "timeout-delta" ? "rgba(184,134,11,0.1)" : GOLD_BG}
                  stroke={GOLD} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={nodeY + nodeR + htlcCardH + 50} fontSize="8" fontWeight="600" fill={GOLD} textAnchor="middle" style={noPtr}>
                  Timeout: 200 → 180
                </text>
                <text x={W / 2} y={nodeY + nodeR + htlcCardH + 60} fontSize="7" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  shorter downstream = safe for Bob
                </text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 2: Settlement ═══════ */}
          {step === 2 && (
            <g className="rt-enter">
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Step 3: Preimage Settles Backward
              </text>
              <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                Dianne reveals R to Bob, Bob reveals R to Alice
              </text>

              {renderNodes()}

              {/* Backward arrows (green, preimage flow) */}
              <g {...hoverProps("preimage-flow")}>
                {/* Dianne → Bob */}
                <line
                  x1={dianneX - nodeR - 4} y1={nodeY + 14}
                  x2={bobX + nodeR + 10} y2={nodeY + 14}
                  stroke={hovered === "preimage-flow" ? GREEN : "rgba(22,163,74,0.7)"}
                  strokeWidth="2" markerEnd="url(#rt-arr-green)"
                  style={{ transition: "stroke 0.15s ease" }}
                />
                <rect x={(bobX + dianneX) / 2 - 14} y={nodeY + 2} width={28} height={14} rx="3"
                  fill="white" stroke={GREEN} strokeWidth="0.6" />
                <text x={(bobX + dianneX) / 2} y={nodeY + 12} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle" fontFamily={mono} style={noPtr}>R</text>

                {/* Bob → Alice */}
                <line
                  x1={bobX - nodeR - 4} y1={nodeY + 14}
                  x2={aliceX + nodeR + 10} y2={nodeY + 14}
                  stroke={hovered === "preimage-flow" ? GREEN : "rgba(22,163,74,0.7)"}
                  strokeWidth="2" markerEnd="url(#rt-arr-green)"
                  style={{ transition: "stroke 0.15s ease" }}
                />
                <rect x={(aliceX + bobX) / 2 - 14} y={nodeY + 2} width={28} height={14} rx="3"
                  fill="white" stroke={GREEN} strokeWidth="0.6" />
                <text x={(aliceX + bobX) / 2} y={nodeY + 12} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle" fontFamily={mono} style={noPtr}>R</text>
              </g>

              {/* Settlement results */}
              <g className="rt-enter" style={{ animationDelay: "0.3s" }}>
                {/* Dianne claims */}
                <rect x={dianneX - 50} y={nodeY + nodeR + 18} width={100} height={26} rx="5"
                  fill="rgba(22,163,74,0.06)" stroke={GREEN} strokeWidth="0.8" />
                <text x={dianneX} y={nodeY + nodeR + 28} fontSize="7.5" fontWeight="600" fill={GREEN} textAnchor="middle" style={noPtr}>claims 400,000</text>
                <text x={dianneX} y={nodeY + nodeR + 39} fontSize="7" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>reveals R to Bob</text>

                {/* Bob claims */}
                <rect x={bobX - 50} y={nodeY + nodeR + 18} width={100} height={26} rx="5"
                  fill="rgba(22,163,74,0.06)" stroke={GREEN} strokeWidth="0.8" />
                <text x={bobX} y={nodeY + nodeR + 28} fontSize="7.5" fontWeight="600" fill={GREEN} textAnchor="middle" style={noPtr}>claims 405,000</text>
                <text x={bobX} y={nodeY + nodeR + 39} fontSize="7" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>reveals R to Alice</text>

                {/* Alice: payment sent */}
                <rect x={aliceX - 44} y={nodeY + nodeR + 18} width={88} height={26} rx="5"
                  fill="rgba(37,99,235,0.06)" stroke={ALICE_CLR} strokeWidth="0.8" />
                <text x={aliceX} y={nodeY + nodeR + 28} fontSize="7.5" fontWeight="600" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>paid 405,000</text>
                <text x={aliceX} y={nodeY + nodeR + 39} fontSize="7" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>learns R (receipt)</text>
              </g>

              {/* Check marks */}
              <g className="rt-enter" style={{ animationDelay: "0.5s" }}>
                <text x={dianneX + nodeR + 6} y={nodeY + 4} fontSize="14" fill={GREEN} style={noPtr}>✓</text>
                <text x={bobX + nodeR + 6} y={nodeY + 4} fontSize="14" fill={GREEN} style={noPtr}>✓</text>
                <text x={aliceX + nodeR + 6} y={nodeY + 4} fontSize="14" fill={GREEN} style={noPtr}>✓</text>
              </g>

              {/* Caption */}
              <g className="rt-enter" style={{ animationDelay: "0.6s" }}>
                <rect x={W / 2 - 210} y={nodeY + nodeR + 52} width={420} height={44} rx="6" fill={GOLD_BG} stroke="#d4a038" strokeWidth="0.5" />
                <text x={W / 2} y={nodeY + nodeR + 68} fontSize="9" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                  Same preimage R settles every hop in the chain.
                </text>
                <text x={W / 2} y={nodeY + nodeR + 82} fontSize="8.5" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  Bob can only claim from Alice by revealing R, which he could only learn from Dianne.
                </text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 3: Result ═══════ */}
          {step === 3 && (
            <g className="rt-enter">
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Payment Complete
              </text>
              <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                Atomic settlement across the route
              </text>

              {renderNodes()}

              {/* Summary card */}
              <g className="rt-enter" style={{ animationDelay: "0.2s" }}>
                <rect
                  x={W / 2 - 210} y={nodeY + nodeR + 20}
                  width={420} height={80} rx="8"
                  fill={GOLD_BG} stroke={GOLD} strokeWidth="0.8"
                />
                <text x={W / 2} y={nodeY + nodeR + 40} fontSize="10" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
                  Final Balances
                </text>
                <line x1={W / 2 - 190} y1={nodeY + nodeR + 46} x2={W / 2 + 190} y2={nodeY + nodeR + 46} stroke={`${GOLD}40`} strokeWidth="0.5" />

                {/* Alice */}
                <text x={W / 2 - 140} y={nodeY + nodeR + 64} fontSize="9" fontWeight="600" fill={ALICE_CLR} style={noPtr}>
                  Alice
                </text>
                <text x={W / 2 - 140} y={nodeY + nodeR + 78} fontSize="8" fill={TEXT_MUTED} style={noPtr}>
                  Paid 405,000 sats
                </text>

                {/* Bob */}
                <g {...hoverProps("routing-fee")}>
                  <text x={W / 2} y={nodeY + nodeR + 64} fontSize="9" fontWeight="600" fill={BOB_CLR} textAnchor="middle" style={noPtr}>
                    Bob (Router)
                  </text>
                  <text x={W / 2} y={nodeY + nodeR + 78} fontSize="8" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                    Earned 5,000 sats fee
                  </text>
                </g>

                {/* Dianne */}
                <text x={W / 2 + 140} y={nodeY + nodeR + 64} fontSize="9" fontWeight="600" fill={DIANNE_CLR} textAnchor="end" style={noPtr}>
                  Dianne
                </text>
                <text x={W / 2 + 140} y={nodeY + nodeR + 78} fontSize="8" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>
                  Received 400,000 sats
                </text>
              </g>

              {/* Atomicity note */}
              <g className="rt-enter" style={{ animationDelay: "0.4s" }}>
                <rect x={W / 2 - 170} y={nodeY + nodeR + 108} width={340} height={26} rx="6"
                  fill="rgba(22,163,74,0.04)" stroke={GREEN} strokeWidth="0.6" />
                <text x={W / 2} y={nodeY + nodeR + 125} fontSize="9" fill={GREEN} textAnchor="middle" fontWeight="600" style={noPtr}>
                  All HTLCs settled atomically. No funds at risk.
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Step controller */}
        <VLStepAnimation
          steps={STEPS}
          currentStep={step}
          onStepChange={setStep}
        />

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
