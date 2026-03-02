import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "Channel State" },
  { label: "State Transition" },
];

// ── Party colors for tracking cryptographic material ──
const ALICE_CLR = "#2563eb";
const ALICE_BG = "rgba(37,99,235,0.06)";
const ALICE_MED = "rgba(37,99,235,0.15)";
const BOB_CLR = "#ea580c";
const BOB_BG = "rgba(234,88,12,0.06)";
const BOB_MED = "rgba(234,88,12,0.15)";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "revkey-a": {
    title: "Revocation Pubkey (Alice's TX)",
    description:
      "Constructed from Alice's per-commitment point and Bob's revocation basepoint. Neither party can derive the corresponding private key on their own. Only when Alice reveals her per-commitment secret can Bob compute it.",
  },
  "revkey-b": {
    title: "Revocation Pubkey (Bob's TX)",
    description:
      "Constructed from Bob's per-commitment point and Alice's revocation basepoint. Neither party can derive the corresponding private key on their own. Only when Bob reveals his per-commitment secret can Alice compute it.",
  },
  "local-a": {
    title: "Alice's to_local Output",
    description:
      "Alice's own balance on her commitment TX. Two spending paths: Alice can spend after to_self_delay blocks (delayed path), or Bob can spend immediately using the revocation key (penalty path).",
  },
  "local-b": {
    title: "Bob's to_local Output",
    description:
      "Bob's own balance on his commitment TX. Two spending paths: Bob can spend after to_self_delay blocks (delayed path), or Alice can spend immediately using the revocation key (penalty path).",
  },
  "secret-a": {
    title: "Alice Reveals Her Secret",
    description:
      "When advancing to State 2, Alice reveals her State 1 per-commitment secret to Bob. Combined with Bob's own revocation basepoint, Bob can now derive the revocation private key for Alice's old TX.",
  },
  "secret-b": {
    title: "Bob Reveals His Secret",
    description:
      "When advancing to State 2, Bob reveals his State 1 per-commitment secret to Alice. Combined with Alice's own revocation basepoint, Alice can now derive the revocation private key for Bob's old TX.",
  },
  "privkey-a": {
    title: "Revocation Private Key (Alice's TX)",
    description:
      "Bob can now compute this from: Alice's revealed secret + his own revocation basepoint. If Alice ever broadcasts her old State 1 TX, Bob uses this key to spend her to_local output immediately, claiming ALL funds.",
  },
  "privkey-b": {
    title: "Revocation Private Key (Bob's TX)",
    description:
      "Alice can now compute this from: Bob's revealed secret + her own revocation basepoint. If Bob ever broadcasts his old State 1 TX, Alice uses this key to spend his to_local output immediately, claiming ALL funds.",
  },
  "new-a": {
    title: "New Revocation Pubkey (State 2)",
    description:
      "Alice's State 2 commitment TX has a fresh revocation pubkey derived from a new per-commitment point. Neither party can derive the private key until they advance to State 3 and Alice reveals this secret.",
  },
  "new-b": {
    title: "New Revocation Pubkey (State 2)",
    description:
      "Bob's State 2 commitment TX has a fresh revocation pubkey derived from a new per-commitment point. Neither party can derive the private key until they advance to State 3 and Bob reveals this secret.",
  },
};

export function RevocationDiagram() {
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

  // ── Layout constants ──
  const W = 576;
  const cardW = 252;
  const cardGap = 20;
  const leftX = (W - cardW * 2 - cardGap) / 2;
  const rightX = leftX + cardW + cardGap;
  const pad = 8;
  const innerW = cardW - pad * 2;

  // ── Script definition ──
  const scriptLines: Array<{ text: string; indent: number; isRev?: boolean; dim?: boolean }> = [
    { text: "OP_IF", indent: 0, dim: true },
    { text: "<revocation_pubkey>", indent: 10, isRev: true },
    { text: "OP_ELSE", indent: 0, dim: true },
    { text: "<to_self_delay> OP_CSV OP_DROP", indent: 10 },
    { text: "<local_delayed_pubkey>", indent: 10 },
    { text: "OP_ENDIF", indent: 0, dim: true },
    { text: "OP_CHECKSIG", indent: 0, dim: true },
  ];
  const scrLineH = 11;
  const scrPadY = 5;
  const scrH = scriptLines.length * scrLineH + scrPadY * 2;

  // ── Output box dimensions (matching CommitmentPairDiagram) ──
  const outBoxH = 50;          // remote (simple) output box height
  const localBoxH = 38 + scrH + 22; // to_local box: value + witnessScript label + script + owner
  const outBoxIndent = 16;

  // ── Card height ──
  // header(22) + gap(4) + outputs container (label + divider + localBox + gap + remoteBox + pad) + bottom pad(8)
  const cardH = 258;

  // ── Helper: BTC string to formatted sats ──
  function btcToSats(btc: string): string {
    const sats = Math.round(parseFloat(btc) * 1e8);
    return sats.toLocaleString("en-US");
  }

  // ── Dynamic viewBox height ──
  const s0_cardsY = 58;
  const s0_captionY = s0_cardsY + cardH + 12;
  const H_s0 = s0_captionY + 38;

  const s1_oldCardsY = 62;
  const s1_oldEnd = s1_oldCardsY + cardH;
  const s1_arrowStartY = s1_oldEnd + 4;
  const s1_arrowEndY = s1_arrowStartY + 72;
  const s1_privkeyY = s1_arrowEndY + 2;
  const s1_newLabelY = s1_privkeyY + 44;
  const s1_newCardsY = s1_newLabelY + 14;
  const s1_newEnd = s1_newCardsY + cardH;
  const s1_captionY = s1_newEnd + 12;
  const H_s1 = s1_captionY + 38;

  const H = step === 0 ? H_s0 : H_s1;

  // ── Full TX card renderer ──
  function renderFullCard(opts: {
    side: "alice" | "bob";
    x: number;
    y: number;
    localAmt: string;
    remoteAmt: string;
    revoked?: boolean;
    stateLabel?: string;
  }) {
    const { side, x, y, localAmt, remoteAmt, revoked, stateLabel } = opts;
    const isAlice = side === "alice";
    const owner = isAlice ? "Alice" : "Bob";
    const cpty = isAlice ? "Bob" : "Alice";
    const clr = isAlice ? ALICE_CLR : BOB_CLR;
    const med = isAlice ? ALICE_MED : BOB_MED;
    const revRegion = isAlice ? "revkey-a" : "revkey-b";
    const localRegion = isAlice ? "local-a" : "local-b";
    const glowClass = isAlice ? "rev-glow-a" : "rev-glow-b";

    // BOLT 3: sort outputs by lowest value first
    const localVal = parseFloat(localAmt);
    const remoteVal = parseFloat(remoteAmt);
    const localFirst = localVal <= remoteVal;

    // Fixed header positions
    const divY = y + 22;
    const outY = y + 26;
    const outLabelBL = y + 38;
    const outDivY = y + 40;

    // Inner box dimensions
    const bx = x + pad;
    const bw = innerW;
    const ibx = bx + outBoxIndent;
    const ibw = bw - outBoxIndent - 4;

    // Dynamic row positions based on BOLT 3 ordering
    // to_local box is localBoxH (tall, includes script); to_remote box is outBoxH (short)
    let remoteBoxY: number, localBoxY: number;
    if (localFirst) {
      localBoxY = outDivY + 2;
      remoteBoxY = localBoxY + localBoxH + 6;
    } else {
      remoteBoxY = outDivY + 2;
      localBoxY = remoteBoxY + outBoxH + 6;
    }
    const outBottom = localFirst ? remoteBoxY + outBoxH + 4 : localBoxY + localBoxH + 4;

    const cardStroke = revoked ? "#fca5a5" : "#e8dcc8";
    const cardFill = revoked ? "#fef8f8" : "white";
    const dashArr = revoked ? "5 3" : undefined;

    // ── Render helpers ──
    const renderRemoteBox = (baseY: number, idx: number) => (
      <g key="remote">
        <text x={bx + 8} y={baseY + 14} fontSize="9" fill="#6b5d4f">{idx}:</text>
        <g>
          <rect
            x={ibx} y={baseY + 2} width={ibw} height={outBoxH - 4} rx="3"
            fill="white" stroke="#e8dcc8" strokeWidth="0.75"
          />
          <text x={ibx + 6} y={baseY + 16} fontSize="8" fill="#6b5d4f" style={noPtr}>value:</text>
          <text x={ibx + ibw - 6} y={baseY + 16} fontSize="8" fontWeight="600" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{btcToSats(remoteAmt)}</text>

          <text x={ibx + 6} y={baseY + 30} fontSize="8" fill="#6b5d4f" style={noPtr}>scriptPubKey:</text>
          <text x={ibx + ibw - 6} y={baseY + 30} fontSize="8" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{"OP_0 <pubkey_hash>"}</text>

          <text x={ibx + ibw / 2} y={baseY + 43} fontSize="7.5" fontWeight="600" fill="#16a34a" textAnchor="middle" style={noPtr}>
            {cpty} (IMMEDIATE)
          </text>
        </g>
      </g>
    );

    // Script Y positions within local box
    const scrBaseY = (baseY: number) => baseY + 34;

    const renderLocalBox = (baseY: number, idx: number) => (
      <g key="local" {...hoverProps(localRegion)}>
        <text x={bx + 8} y={baseY + 14} fontSize="9" fill="#6b5d4f" style={noPtr}>{idx}:</text>
        <rect
          x={ibx} y={baseY + 2} width={ibw} height={localBoxH - 4} rx="3"
          fill={hovered === localRegion ? "rgba(184,134,11,0.08)" : "#fdf8e8"}
          stroke={hovered === localRegion ? "#b8860b" : "#d4a038"}
          strokeWidth="0.75" strokeDasharray="4 2"
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        <text x={ibx + 6} y={baseY + 16} fontSize="8" fill="#6b5d4f" style={noPtr}>value:</text>
        <text x={ibx + ibw - 6} y={baseY + 16} fontSize="8" fontWeight="600" fill="#b8860b" fontFamily={mono} textAnchor="end" style={noPtr}>{btcToSats(localAmt)}</text>

        <text x={ibx + 6} y={baseY + 30} fontSize="8" fill="#6b5d4f" style={noPtr}>witnessScript:</text>

        {/* Script block embedded inside to_local box */}
        <rect
          x={ibx + 4} y={scrBaseY(baseY)} width={ibw - 8} height={scrH}
          rx="3" fill="#f7f2ea" stroke="#e0d5c4" strokeWidth="0.5"
        />
        {scriptLines.map((line, i) => {
          const baseline = scrBaseY(baseY) + scrPadY + i * scrLineH + 9;
          const textX = ibx + 12 + line.indent;

          if (line.isRev) {
            const hlY = baseline - 9;
            const isH = hovered === revRegion;

            if (revoked) {
              return (
                <g key={i} {...hoverProps(revRegion)}>
                  <rect
                    x={ibx + 6} y={hlY} width={ibw - 12} height={scrLineH}
                    rx="2"
                    fill={isH ? "rgba(22,163,74,0.2)" : "rgba(22,163,74,0.1)"}
                    stroke={isH ? "#16a34a" : "#86efac"} strokeWidth="0.5"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text
                    x={textX} y={baseline} fontSize="8" fontFamily={mono}
                    fontWeight="700" fill="#16a34a" style={noPtr}
                  >
                    {line.text}
                  </text>
                  <text
                    x={ibx + ibw - 10} y={baseline} fontSize="6.5"
                    fill="#16a34a" textAnchor="end" fontWeight="600" style={noPtr}
                  >
                    key derivable
                  </text>
                </g>
              );
            }

            return (
              <g key={i} {...hoverProps(revRegion)}>
                <rect
                  x={ibx + 6} y={hlY} width={ibw - 12} height={scrLineH}
                  rx="2" className={glowClass}
                  style={{
                    fill: isH ? med : undefined,
                    transition: "fill 0.15s ease",
                  }}
                />
                <text
                  x={textX} y={baseline} fontSize="8" fontFamily={mono}
                  fontWeight="700" fill={clr} style={noPtr}
                >
                  {line.text}
                </text>
              </g>
            );
          }

          return (
            <text
              key={i} x={textX} y={baseline} fontSize="8" fontFamily={mono}
              fill={line.dim ? "#9a8b78" : "#6b5d4f"} style={noPtr}
            >
              {line.text}
            </text>
          );
        })}

        <text x={ibx + ibw / 2} y={scrBaseY(baseY) + scrH + 14} fontSize="7.5" fontWeight="600" fill="#b8860b" textAnchor="middle" style={noPtr}>
          {owner} (DELAYED)
        </text>
      </g>
    );

    return (
      <g key={`${side}-${stateLabel || "s0"}`}>
        {/* Card */}
        <rect
          x={x} y={y} width={cardW} height={cardH} rx="8"
          fill={cardFill} stroke={cardStroke} strokeWidth="1.5"
          strokeDasharray={dashArr}
        />

        {/* Header */}
        {stateLabel ? (
          <>
            <text
              x={x + pad + 4} y={y + 16} fontSize="9.5" fontWeight="700"
              fill="#2a1f0d" style={noPtr}
            >
              {owner}&apos;s TX{stateLabel}
            </text>
            <text
              x={x + cardW - pad - 4} y={y + 16} fontSize="7.5" fontWeight="700"
              fill={revoked ? "#dc2626" : "#16a34a"} textAnchor="end" style={noPtr}
            >
              {revoked ? "REVOCABLE" : "CURRENT"}
            </text>
          </>
        ) : (
          <text
            x={x + cardW / 2} y={y + 16} fontSize="10" fontWeight="700"
            fill="#2a1f0d" textAnchor="middle" style={noPtr}
          >
            {owner}'s Commitment TX
          </text>
        )}

        <line x1={x + pad} y1={divY} x2={x + cardW - pad} y2={divY} stroke="#e8dcc8" strokeWidth="0.5" />

        {/* ── Outputs container ── */}
        <rect
          x={x + pad} y={outY} width={innerW} height={outBottom - outY}
          rx="4" fill="#fefdfb" stroke="#e8dcc8" strokeWidth="0.5"
        />
        <text
          x={x + pad + 6} y={outLabelBL} fontSize="9" fontWeight="700"
          fill="#2a1f0d" letterSpacing="0.03em" style={noPtr}
        >
          Outputs
        </text>
        <line x1={x + pad + 6} y1={outDivY} x2={x + cardW - pad - 6} y2={outDivY} stroke="#e8dcc8" strokeWidth="0.5" />

        {/* Render outputs in BOLT 3 order (lowest value first) */}
        {localFirst ? (
          <>{renderLocalBox(localBoxY, 0)}{renderRemoteBox(remoteBoxY, 1)}</>
        ) : (
          <>{renderRemoteBox(remoteBoxY, 0)}{renderLocalBox(localBoxY, 1)}</>
        )}
      </g>
    );
  }

  // ── Midpoints for arrows ──
  const leftMid = leftX + cardW / 2;
  const rightMid = rightX + cardW / 2;

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
          <defs>
            <marker id="vl-rev-arr-a" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={ALICE_CLR} />
            </marker>
            <marker id="vl-rev-arr-b" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={BOB_CLR} />
            </marker>
          </defs>

          <style>{`
            @keyframes rev-glow-a {
              0%, 100% { fill: ${ALICE_BG}; }
              50% { fill: ${ALICE_MED}; }
            }
            .rev-glow-a { animation: rev-glow-a 2.5s ease-in-out infinite; }
            @keyframes rev-glow-b {
              0%, 100% { fill: ${BOB_BG}; }
              50% { fill: ${BOB_MED}; }
            }
            .rev-glow-b { animation: rev-glow-b 2.5s ease-in-out infinite; }
            @keyframes rev-enter {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0px); }
            }
            .rev-enter { animation: rev-enter 0.4s ease-out both; }
            @keyframes rev-draw {
              from { stroke-dashoffset: 300; }
              to { stroke-dashoffset: 0; }
            }
            .rev-draw {
              stroke-dasharray: 300;
              stroke-dashoffset: 300;
              animation: rev-draw 1s ease-out both;
            }
          `}</style>

          {/* ═══════════ STEP 0: Channel State ═══════════ */}
          {step === 0 && (
            <g className="rev-enter">
              {/* Title */}
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
                Commitment Transactions: The to_local Script
              </text>
              <text x={W / 2} y="35" fontSize="10" fill="#6b5d4f" textAnchor="middle">
                Each party's own balance has a revocation spending path
              </text>

              {/* Party labels */}
              <text x={leftX + cardW / 2} y="50" fontSize="11" fontWeight="700" fill={ALICE_CLR} textAnchor="middle">Alice</text>
              <text x={rightX + cardW / 2} y="50" fontSize="11" fontWeight="700" fill={BOB_CLR} textAnchor="middle">Bob</text>

              {/* Full TX cards */}
              {renderFullCard({ side: "alice", x: leftX, y: s0_cardsY, localAmt: "0.7", remoteAmt: "0.3" })}
              {renderFullCard({ side: "bob", x: rightX, y: s0_cardsY, localAmt: "0.3", remoteAmt: "0.7" })}

              {/* Caption */}
              <rect
                x={W / 2 - 210} y={s0_captionY} width={420} height={32} rx="6"
                fill="#fdf8e8" stroke="#d4a038" strokeWidth="0.5"
              />
              <text x={W / 2} y={s0_captionY + 13} fontSize="9" fill="#6b5d4f" textAnchor="middle">
                The revocation pubkey is constructed so
              </text>
              <text x={W / 2} y={s0_captionY + 25} fontSize="9" fill="#2a1f0d" textAnchor="middle" fontWeight="600">
                neither party can derive the private key on their own
              </text>
            </g>
          )}

          {/* ═══════════ STEP 1: State Transition ═══════════ */}
          {step === 1 && (
            <g>
              {/* Title */}
              <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill="#2a1f0d" textAnchor="middle">
                Advancing the Channel: State 1 → State 2
              </text>
              <text x={W / 2} y="35" fontSize="10" fill="#6b5d4f" textAnchor="middle">
                Exchanging old secrets makes old states revocable
              </text>

              {/* ── Old State 1 cards ── */}
              <g className="rev-enter">
                <text x={leftX} y="52" fontSize="9" fontWeight="700" fill="#dc2626" letterSpacing="0.04em">
                  STATE 1 (OLD)
                </text>

                {renderFullCard({
                  side: "alice", x: leftX, y: s1_oldCardsY,
                  localAmt: "0.7", remoteAmt: "0.3",
                  revoked: true, stateLabel: " (State 1)",
                })}
                {renderFullCard({
                  side: "bob", x: rightX, y: s1_oldCardsY,
                  localAmt: "0.3", remoteAmt: "0.7",
                  revoked: true, stateLabel: " (State 1)",
                })}
              </g>

              {/* ── Secret exchange arrows (animated) ── */}
              <g className="rev-enter" style={{ animationDelay: "0.3s" }}>
                {/* Alice → Bob (Alice's color: blue) */}
                <g {...hoverProps("secret-a")}>
                  <path
                    d={`M ${leftMid} ${s1_arrowStartY} C ${leftMid} ${s1_arrowStartY + 36}, ${rightMid} ${s1_arrowStartY + 36}, ${rightMid} ${s1_arrowEndY}`}
                    fill="none"
                    stroke={hovered === "secret-a" ? ALICE_CLR : "rgba(37,99,235,0.5)"}
                    strokeWidth={hovered === "secret-a" ? 2.5 : 1.5}
                    markerEnd="url(#vl-rev-arr-a)"
                    className="rev-draw"
                    style={{ animationDelay: "0.5s", transition: "stroke 0.15s ease, stroke-width 0.15s ease" }}
                  />
                </g>

                {/* Bob → Alice (Bob's color: orange) */}
                <g {...hoverProps("secret-b")}>
                  <path
                    d={`M ${rightMid} ${s1_arrowStartY} C ${rightMid} ${s1_arrowStartY + 36}, ${leftMid} ${s1_arrowStartY + 36}, ${leftMid} ${s1_arrowEndY}`}
                    fill="none"
                    stroke={hovered === "secret-b" ? BOB_CLR : "rgba(234,88,12,0.5)"}
                    strokeWidth={hovered === "secret-b" ? 2.5 : 1.5}
                    markerEnd="url(#vl-rev-arr-b)"
                    className="rev-draw"
                    style={{ animationDelay: "0.7s", transition: "stroke 0.15s ease, stroke-width 0.15s ease" }}
                  />
                </g>

                {/* Labels at crossing center */}
                {(() => {
                  const labelY = s1_arrowStartY + 24;
                  return (
                    <>
                      <rect
                        x={W / 2 - 78} y={labelY} width={74} height={24} rx="4"
                        fill="white" stroke={ALICE_CLR} strokeWidth="0.75" opacity="0.9"
                      />
                      <text x={W / 2 - 41} y={labelY + 10} fontSize="7" fill={ALICE_CLR} textAnchor="middle" fontWeight="600">
                        Alice reveals
                      </text>
                      <text x={W / 2 - 41} y={labelY + 20} fontSize="7" fill={ALICE_CLR} textAnchor="middle" fontFamily={mono}>
                        secret_1
                      </text>

                      <rect
                        x={W / 2 + 4} y={labelY} width={74} height={24} rx="4"
                        fill="white" stroke={BOB_CLR} strokeWidth="0.75" opacity="0.9"
                      />
                      <text x={W / 2 + 41} y={labelY + 10} fontSize="7" fill={BOB_CLR} textAnchor="middle" fontWeight="600">
                        Bob reveals
                      </text>
                      <text x={W / 2 + 41} y={labelY + 20} fontSize="7" fill={BOB_CLR} textAnchor="middle" fontFamily={mono}>
                        secret_1
                      </text>
                    </>
                  );
                })()}
              </g>

              {/* ── Private key derivation results ── */}
              <g className="rev-enter" style={{ animationDelay: "0.8s" }}>
                {/* Bob derives PrivKeyA1 (Alice's color: blue, it came from Alice's secret) */}
                <g {...hoverProps("privkey-a")}>
                  <rect
                    x={rightX + pad} y={s1_privkeyY} width={innerW} height={22} rx="4"
                    fill={hovered === "privkey-a" ? ALICE_MED : ALICE_BG}
                    stroke={hovered === "privkey-a" ? ALICE_CLR : "rgba(37,99,235,0.3)"}
                    strokeWidth="1"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text
                    x={rightX + pad + 6} y={s1_privkeyY + 15} fontSize="7.5" fontWeight="700"
                    fill={ALICE_CLR} fontFamily={mono} style={noPtr}
                  >
                    Bob derives PrivKey_A1
                  </text>
                </g>

                {/* Alice derives PrivKeyB1 (Bob's color: orange, it came from Bob's secret) */}
                <g {...hoverProps("privkey-b")}>
                  <rect
                    x={leftX + pad} y={s1_privkeyY} width={innerW} height={22} rx="4"
                    fill={hovered === "privkey-b" ? BOB_MED : BOB_BG}
                    stroke={hovered === "privkey-b" ? BOB_CLR : "rgba(234,88,12,0.3)"}
                    strokeWidth="1"
                    style={{ transition: "fill 0.15s ease" }}
                  />
                  <text
                    x={leftX + pad + 6} y={s1_privkeyY + 15} fontSize="7.5" fontWeight="700"
                    fill={BOB_CLR} fontFamily={mono} style={noPtr}
                  >
                    Alice derives PrivKey_B1
                  </text>
                </g>
              </g>

              {/* ── New State 2 cards ── */}
              <g className="rev-enter" style={{ animationDelay: "1.0s" }}>
                <text x={leftX} y={s1_newLabelY} fontSize="9" fontWeight="700" fill="#2a1f0d" letterSpacing="0.04em">
                  STATE 2 (CURRENT)
                </text>

                {renderFullCard({
                  side: "alice", x: leftX, y: s1_newCardsY,
                  localAmt: "0.5", remoteAmt: "0.5",
                  stateLabel: " (State 2)",
                })}
                {renderFullCard({
                  side: "bob", x: rightX, y: s1_newCardsY,
                  localAmt: "0.5", remoteAmt: "0.5",
                  stateLabel: " (State 2)",
                })}
              </g>

              {/* Caption */}
              <g className="rev-enter" style={{ animationDelay: "1.2s" }}>
                <rect
                  x={W / 2 - 210} y={s1_captionY} width={420} height={32} rx="6"
                  fill="#fdf8e8" stroke="#d4a038" strokeWidth="0.5"
                />
                <text x={W / 2} y={s1_captionY + 13} fontSize="9" fill="#6b5d4f" textAnchor="middle">
                  Old states are now revocable. New state revocation keys remain
                </text>
                <text x={W / 2} y={s1_captionY + 25} fontSize="9" fill="#2a1f0d" textAnchor="middle" fontWeight="600">
                  safe until the next state advance
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
