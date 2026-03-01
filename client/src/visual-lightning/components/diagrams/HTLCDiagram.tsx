import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "The HTLCs" },
  { label: "Success Path" },
  { label: "Timeout Path" },
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

// ── Layout constants ──
const W = 576;
const nodeR = 24;
const aliceX = 80;
const bobX = W / 2;
const dianneX = W - 80;
const nodeY = 108;
const cardsY = nodeY + nodeR + 48; // 180
const htlcW = 250;
const htlcH = 118;

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "ab-htlc": {
    title: "Alice → Bob HTLC",
    description:
      "Alice locks 405,000 sats in an HTLC with Bob. IF Bob reveals preimage R where SHA256(R) = H, he claims the funds. ELSE IF block 200 passes, Alice reclaims. The extra 5,000 sats over Dianne's price covers Bob's routing fee.",
  },
  "bd-htlc": {
    title: "Bob → Dianne HTLC",
    description:
      "Bob locks 400,000 sats in an HTLC with Dianne using the same hash H. IF Dianne reveals R, she claims the funds. ELSE IF block 180 passes, Bob reclaims. The shorter timeout (180 vs 200) ensures Bob can learn R and still claim from Alice in time.",
  },
  "hash-lock": {
    title: "Hash Lock (IF branch)",
    description:
      "The recipient can claim the funds by providing the preimage R such that SHA256(R) equals the payment hash H. This cryptographic proof shows they know the secret.",
  },
  "time-lock": {
    title: "Time Lock (ELSE branch)",
    description:
      "If the recipient doesn't reveal the preimage before the timeout block, the sender reclaims the funds. This ensures funds are never permanently locked.",
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

export function HTLCDiagram() {
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Animation replay key (bump to remount & replay CSS animations) ──
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

  const H = step === 0 ? 355 : step === 1 ? 395 : 385;

  // ── Render three party nodes ──
  function renderNodes(opts?: { fadeDianne?: boolean }) {
    return (
      <>
        <circle cx={aliceX} cy={nodeY} r={nodeR} fill="rgba(37,99,235,0.08)" stroke={ALICE_CLR} strokeWidth="2" />
        <text x={aliceX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>A</text>
        <text x={aliceX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>Alice</text>

        <circle cx={bobX} cy={nodeY} r={nodeR} fill="rgba(234,88,12,0.08)" stroke={BOB_CLR} strokeWidth="2" />
        <text x={bobX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={BOB_CLR} textAnchor="middle" style={noPtr}>B</text>
        <text x={bobX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={BOB_CLR} textAnchor="middle" style={noPtr}>Bob</text>

        <g style={{ opacity: opts?.fadeDianne ? 0.4 : 1 }}>
          <circle cx={dianneX} cy={nodeY} r={nodeR} fill="rgba(124,58,237,0.08)" stroke={DIANNE_CLR} strokeWidth="2" />
          <text x={dianneX} y={nodeY + 5} fontSize="13" fontWeight="700" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>D</text>
          <text x={dianneX} y={nodeY - nodeR - 6} fontSize="9" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>Dianne</text>
        </g>

        {/* Channel bars */}
        <rect x={aliceX + nodeR + 6} y={nodeY + nodeR + 6} width={bobX - aliceX - nodeR * 2 - 12} height={4} rx="2"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
        <rect x={bobX + nodeR + 6} y={nodeY + nodeR + 6} width={dianneX - bobX - nodeR * 2 - 12} height={4} rx="2"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
      </>
    );
  }

  // ── HTLC contract card ──
  function renderHTLCCard(
    x: number, y: number,
    from: string, to: string, amount: string, timeout: string,
    region: string, opacity = 1,
  ) {
    const isH = hovered === region;
    const ifY = y + 32;
    const elseY = ifY + 42;
    return (
      <g {...hoverProps(region)} style={{ opacity }}>
        <rect
          x={x} y={y} width={htlcW} height={htlcH} rx="6"
          fill={isH ? "rgba(184,134,11,0.04)" : "white"}
          stroke={isH ? GOLD : BORDER} strokeWidth="1.2"
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        <text x={x + 10} y={y + 17} fontSize="9.5" fontWeight="700" fill={TEXT_DARK} style={noPtr}>
          HTLC: {from} → {to}
        </text>
        <rect x={x + htlcW - 100} y={y + 4} width={90} height={18} rx="3" fill={GOLD_BG} stroke={GOLD} strokeWidth="0.5" style={noPtr} />
        <text x={x + htlcW - 55} y={y + 16} fontSize="8.5" fontWeight="700" fill={GOLD} textAnchor="middle" fontFamily={mono} style={noPtr}>
          {amount} sats
        </text>
        <line x1={x + 6} y1={y + 26} x2={x + htlcW - 6} y2={y + 26} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

        <rect x={x + 6} y={ifY} width={htlcW - 12} height={36} rx="4"
          fill="rgba(22,163,74,0.04)" stroke={GREEN} strokeWidth="0.5" style={noPtr} />
        <text x={x + 14} y={ifY + 14} fontSize="8.5" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
        <text x={x + 36} y={ifY + 14} fontSize="8" fill={TEXT_DARK} style={noPtr}>
          {to} reveals preimage R where SHA256(R) = H
        </text>
        <text x={x + 14} y={ifY + 29} fontSize="8.5" fontWeight="600" fill={GREEN} style={noPtr}>
          → {from} pays {to} {amount} sats
        </text>

        <rect x={x + 6} y={elseY} width={htlcW - 12} height={30} rx="4"
          fill="rgba(184,134,11,0.04)" stroke={GOLD} strokeWidth="0.5" style={noPtr} />
        <text x={x + 14} y={elseY + 13} fontSize="8.5" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE IF</text>
        <text x={x + 72} y={elseY + 13} fontSize="8" fill={TEXT_DARK} style={noPtr}>
          {"block > "}{timeout}
        </text>
        <text x={x + 14} y={elseY + 25} fontSize="8" fontWeight="600" fill={GOLD} style={noPtr}>
          → Offer expires, {from} reclaims
        </text>
      </g>
    );
  }

  const abCardX = 20;
  const bdCardX = W - 20 - htlcW;

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
            @keyframes htlc-fade-in {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes htlc-draw-line {
              from { stroke-dashoffset: 400; }
              to   { stroke-dashoffset: 0; }
            }
            .htlc-draw { stroke-dasharray: 400; stroke-dashoffset: 400; }

            /* Step 0: sequential setup */
            .ha0 { opacity:0; animation: htlc-fade-in .5s ease-out .4s forwards }
            .ha1 { opacity:0; animation: htlc-fade-in .5s ease-out 1.0s forwards }
            .ha2 { opacity:0; animation: htlc-fade-in .5s ease-out 1.7s forwards }
            .ha3 { opacity:0; animation: htlc-fade-in .5s ease-out 2.3s forwards }
            .ha4 { opacity:0; animation: htlc-fade-in .5s ease-out 3.0s forwards }
            .hd0 { animation: htlc-draw-line .6s ease-out 1.0s forwards }

            /* Step 1: backward settlement */
            .hb0 { opacity:0; animation: htlc-fade-in .4s ease-out .3s forwards }
            .hb1 { opacity:0; animation: htlc-fade-in .4s ease-out 1.2s forwards }
            .hb2 { opacity:0; animation: htlc-fade-in .4s ease-out 2.2s forwards }
            .hb3 { opacity:0; animation: htlc-fade-in .4s ease-out 3.0s forwards }
            .hb4 { opacity:0; animation: htlc-fade-in .4s ease-out 3.8s forwards }
            .hbd1 { animation: htlc-draw-line .5s ease-out .3s forwards }
            .hbd2 { animation: htlc-draw-line .5s ease-out 2.2s forwards }

            /* Step 2: timeout expire */
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
              {/* Title */}
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Hash Time-Locked Contracts
              </text>
              <text x={W / 2} y="36" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                Conditional payments with two guaranteed outcomes each
              </text>

              {/* Nodes (immediate) */}
              {renderNodes()}

              {/* Phase 1: Dianne has R */}
              <g className="ha0">
                <rect x={dianneX - 36} y={nodeY + nodeR + 14} width={72} height={16} rx="4"
                  fill="rgba(124,58,237,0.06)" stroke={DIANNE_CLR} strokeWidth="0.6" />
                <text x={dianneX} y={nodeY + nodeR + 25} fontSize="7.5" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" fontFamily={mono} style={noPtr}>
                  R = secret
                </text>
              </g>

              {/* Phase 2: Hash arrow Dianne → Alice (above nodes, below title) */}
              <g className="ha1" {...hoverProps("payment-hash")}>
                <line
                  x1={dianneX - nodeR - 4} y1={nodeY - nodeR - 18}
                  x2={aliceX + nodeR + 10} y2={nodeY - nodeR - 18}
                  stroke={DIANNE_CLR} strokeWidth="1.2" strokeDasharray="5 3"
                  markerEnd="url(#htlc-arr-purple)"
                  className="htlc-draw hd0"
                />
                <rect
                  x={W / 2 - 54} y={nodeY - nodeR - 30} width={108} height={16} rx="4"
                  fill={hovered === "payment-hash" ? "rgba(124,58,237,0.1)" : "white"}
                  stroke="rgba(124,58,237,0.4)" strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={nodeY - nodeR - 19} fontSize="8" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" fontFamily={mono} style={noPtr}>
                  H = SHA256(R)
                </text>
              </g>

              {/* Phase 3: Alice-Bob HTLC card */}
              <g className="ha2">
                {renderHTLCCard(abCardX, cardsY, "Alice", "Bob", "405,000", "200", "ab-htlc")}
              </g>

              {/* Phase 4: Bob-Dianne HTLC card */}
              <g className="ha3">
                {renderHTLCCard(bdCardX, cardsY, "Bob", "Dianne", "400,000", "180", "bd-htlc")}
              </g>

              {/* Phase 5: Timeout delta */}
              <g className="ha4" {...hoverProps("timeout-delta")}>
                <rect
                  x={W / 2 - 76} y={cardsY + htlcH + 12} width={152} height={28} rx="6"
                  fill={hovered === "timeout-delta" ? "rgba(184,134,11,0.1)" : GOLD_BG}
                  stroke={GOLD} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsY + htlcH + 26} fontSize="8" fontWeight="600" fill={GOLD} textAnchor="middle" style={noPtr}>
                  Timeout: 200 → 180
                </text>
                <text x={W / 2} y={cardsY + htlcH + 36} fontSize="7" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  shorter downstream = safe for Bob
                </text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 1: Success Path ═══════ */}
          {step === 1 && (
            <g key={`s1-${animKey}`}>
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Success: Preimage Settles Both HTLCs
              </text>
              <text x={W / 2} y="36" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                Dianne reveals R to Bob, then Bob reveals R to Alice
              </text>

              {renderNodes()}

              {/* Faded HTLC cards (static) */}
              {renderHTLCCard(abCardX, cardsY, "Alice", "Bob", "405,000", "200", "ab-htlc", 0.25)}
              {renderHTLCCard(bdCardX, cardsY, "Bob", "Dianne", "400,000", "180", "bd-htlc", 0.25)}

              {/* Phase 1: Dianne → Bob preimage arrow */}
              <g className="hb0" {...hoverProps("preimage-bd")}>
                <line
                  x1={dianneX - nodeR - 4} y1={nodeY + 14}
                  x2={bobX + nodeR + 10} y2={nodeY + 14}
                  stroke={GREEN} strokeWidth="2"
                  markerEnd="url(#htlc-arr-green)"
                  className="htlc-draw hbd1"
                />
                <rect x={(bobX + dianneX) / 2 - 14} y={nodeY + 4} width={28} height={14} rx="3"
                  fill={hovered === "preimage-bd" ? "rgba(22,163,74,0.12)" : "white"}
                  stroke={GREEN} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={(bobX + dianneX) / 2} y={nodeY + 14} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle" fontFamily={mono} style={noPtr}>R</text>
              </g>

              {/* Phase 2: Right IF block highlights + Dianne checkmark */}
              <g className="hb1">
                <rect x={bdCardX + 6} y={cardsY + 32} width={htlcW - 12} height={36} rx="4"
                  fill="rgba(22,163,74,0.14)" stroke={GREEN} strokeWidth="1.2" />
                <text x={bdCardX + 14} y={cardsY + 46} fontSize="8.5" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
                <text x={bdCardX + 36} y={cardsY + 46} fontSize="8" fill={TEXT_DARK} style={noPtr}>Dianne reveals R ✓</text>
                <text x={bdCardX + 14} y={cardsY + 61} fontSize="8.5" fontWeight="600" fill={GREEN} style={noPtr}>→ Bob pays Dianne 400,000 sats</text>
                <text x={dianneX + nodeR + 4} y={nodeY + 5} fontSize="13" fill={GREEN} style={noPtr}>✓</text>
              </g>

              {/* Phase 3: Bob → Alice preimage arrow */}
              <g className="hb2" {...hoverProps("preimage-ab")}>
                <line
                  x1={bobX - nodeR - 4} y1={nodeY + 14}
                  x2={aliceX + nodeR + 10} y2={nodeY + 14}
                  stroke={GREEN} strokeWidth="2"
                  markerEnd="url(#htlc-arr-green)"
                  className="htlc-draw hbd2"
                />
                <rect x={(aliceX + bobX) / 2 - 14} y={nodeY + 4} width={28} height={14} rx="3"
                  fill={hovered === "preimage-ab" ? "rgba(22,163,74,0.12)" : "white"}
                  stroke={GREEN} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={(aliceX + bobX) / 2} y={nodeY + 14} fontSize="8" fontWeight="700" fill={GREEN} textAnchor="middle" fontFamily={mono} style={noPtr}>R</text>
              </g>

              {/* Phase 4: Left IF block highlights + checkmarks */}
              <g className="hb3">
                <rect x={abCardX + 6} y={cardsY + 32} width={htlcW - 12} height={36} rx="4"
                  fill="rgba(22,163,74,0.14)" stroke={GREEN} strokeWidth="1.2" />
                <text x={abCardX + 14} y={cardsY + 46} fontSize="8.5" fontWeight="700" fill={GREEN} fontFamily={mono} style={noPtr}>IF</text>
                <text x={abCardX + 36} y={cardsY + 46} fontSize="8" fill={TEXT_DARK} style={noPtr}>Bob reveals R ✓</text>
                <text x={abCardX + 14} y={cardsY + 61} fontSize="8.5" fontWeight="600" fill={GREEN} style={noPtr}>→ Alice pays Bob 405,000 sats</text>
                <text x={bobX + nodeR + 4} y={nodeY + 5} fontSize="13" fill={GREEN} style={noPtr}>✓</text>
                <text x={aliceX + nodeR + 4} y={nodeY + 5} fontSize="13" fill={GREEN} style={noPtr}>✓</text>
              </g>

              {/* Phase 5: Summary */}
              <g className="hb4" {...hoverProps("success")}>
                <rect
                  x={W / 2 - 200} y={cardsY + htlcH + 16} width={400} height={46} rx="6"
                  fill={hovered === "success" ? "rgba(184,134,11,0.08)" : GOLD_BG}
                  stroke="#d4a038" strokeWidth="0.5"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsY + htlcH + 35} fontSize="9.5" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                  Both IF branches triggered. Payment complete.
                </text>
                <text x={W / 2 - 130} y={cardsY + htlcH + 52} fontSize="8" fill={ALICE_CLR} fontWeight="600" style={noPtr}>Alice paid 405k</text>
                <text x={W / 2} y={cardsY + htlcH + 52} fontSize="8" fill={BOB_CLR} fontWeight="600" textAnchor="middle" style={noPtr}>Bob earned 5k fee</text>
                <text x={W / 2 + 130} y={cardsY + htlcH + 52} fontSize="8" fill={DIANNE_CLR} fontWeight="600" textAnchor="end" style={noPtr}>Dianne got 400k</text>
              </g>
            </g>
          )}

          {/* ═══════ STEP 2: Timeout Path ═══════ */}
          {step === 2 && (
            <g key={`s2-${animKey}`}>
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Timeout: All HTLCs Expire Safely
              </text>
              <text x={W / 2} y="36" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
                No preimage revealed. Funds return to senders.
              </text>

              {renderNodes({ fadeDianne: true })}

              {/* Faded HTLC cards */}
              {renderHTLCCard(abCardX, cardsY, "Alice", "Bob", "405,000", "200", "ab-htlc", 0.3)}
              {renderHTLCCard(bdCardX, cardsY, "Bob", "Dianne", "400,000", "180", "bd-htlc", 0.3)}

              {/* Phase 1: Bob-Dianne ELSE highlighted (expires first) */}
              <g className="hc0">
                <rect x={bdCardX + 6} y={cardsY + 74} width={htlcW - 12} height={30} rx="4"
                  fill="rgba(184,134,11,0.15)" stroke={GOLD} strokeWidth="1.2" />
                <text x={bdCardX + 14} y={cardsY + 87} fontSize="8.5" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE IF</text>
                <text x={bdCardX + 72} y={cardsY + 87} fontSize="8" fill={TEXT_DARK} style={noPtr}>{"block > 180 ⏰"}</text>
                <text x={bdCardX + 14} y={cardsY + 99} fontSize="8" fontWeight="600" fill={GOLD} style={noPtr}>→ Bob reclaims 400,000 sats</text>
              </g>

              {/* Phase 2: Alice-Bob ELSE highlighted (expires second) */}
              <g className="hc1">
                <rect x={abCardX + 6} y={cardsY + 74} width={htlcW - 12} height={30} rx="4"
                  fill="rgba(184,134,11,0.15)" stroke={GOLD} strokeWidth="1.2" />
                <text x={abCardX + 14} y={cardsY + 87} fontSize="8.5" fontWeight="700" fill={GOLD} fontFamily={mono} style={noPtr}>ELSE IF</text>
                <text x={abCardX + 72} y={cardsY + 87} fontSize="8" fill={TEXT_DARK} style={noPtr}>{"block > 200 ⏰"}</text>
                <text x={abCardX + 14} y={cardsY + 99} fontSize="8" fontWeight="600" fill={GOLD} style={noPtr}>→ Alice reclaims 405,000 sats</text>
              </g>

              {/* Phase 3: Result summary */}
              <g className="hc2" {...hoverProps("timeout")}>
                <rect
                  x={W / 2 - 200} y={cardsY + htlcH + 16} width={400} height={40} rx="6"
                  fill={hovered === "timeout" ? "rgba(184,134,11,0.1)" : GOLD_BG}
                  stroke={GOLD} strokeWidth="0.6"
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text x={W / 2} y={cardsY + htlcH + 33} fontSize="9.5" fill={TEXT_DARK} textAnchor="middle" fontWeight="600" style={noPtr}>
                  Both ELSE branches triggered. Payment safely failed.
                </text>
                <text x={W / 2} y={cardsY + htlcH + 48} fontSize="8" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                  Downstream HTLC expires first (180), then upstream (200)
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Replay + Step controller */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0 0" }}>
          <button
            onClick={replay}
            title="Replay animation"
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: `1.5px solid ${BORDER}`,
              background: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: TEXT_MUTED,
              transition: "all 0.2s ease",
              padding: 0,
              flexShrink: 0,
            }}
            aria-label="Replay animation"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>
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
