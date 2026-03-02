import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "Fulfill" },
  { label: "Fail" },
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
const ORANGE = "#d97706";
const RED = "#dc2626";

const W = 680;
const nodeR = 28;
const aliceX = 94;
const bobX = W / 2;
const dianneX = W - 94;
const nodeY = 86;

const mono = "'JetBrains Mono', monospace";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "fulfill-bd": {
    title: "update_fulfill_htlc (Bob \u2190 Dianne)",
    description:
      "Dianne knows the preimage R and sends it to Bob. Fields: channel_id (BobDianne1), id (the HTLC index), and payment_preimage (the raw 32-byte preimage). Bob verifies SHA256(R) = H and removes the HTLC from the channel state.",
  },
  "fulfill-ab": {
    title: "update_fulfill_htlc (Alice \u2190 Bob)",
    description:
      "Bob now knows R (learned from Dianne) and forwards it to Alice. Alice verifies the preimage against the original payment hash. Both parties remove the HTLC and add the funds to the recipient\u2019s balance.",
  },
  "balance-before": {
    title: "Before: HTLC Active",
    description:
      "The Alice-Bob channel has three outputs on the commitment TX: Alice\u2019s balance (295,000 sats), an HTLC output (405,000 sats locked with the payment hash), and Bob\u2019s balance (300,000 sats).",
  },
  "balance-after": {
    title: "After: HTLC Settled",
    description:
      "The HTLC is removed. Its 405,000 sats are added to Bob\u2019s balance. The commitment TX now has just two outputs: Alice (295,000) and Bob (705,000). No on-chain transaction needed.",
  },
  "fail-bd": {
    title: "update_fail_htlc (Bob \u2190 Dianne)",
    description:
      "Dianne (or Bob) sends a failure back along the route. The reason field is onion-encrypted so only Alice (the original sender) can read the actual failure code. Intermediate nodes just pass it along.",
  },
  "fail-ab": {
    title: "update_fail_htlc (Alice \u2190 Bob)",
    description:
      "Bob forwards the encrypted failure reason to Alice. Alice decrypts each layer of the onion to learn which node failed and why. Both parties remove the HTLC and return funds to Alice.",
  },
  "malformed-bd": {
    title: "update_fail_malformed_htlc (Bob \u2190 Dianne)",
    description:
      "Used when the onion packet itself was corrupted or unparseable. Instead of an encrypted reason, it carries a failure_code and sha256_of_onion so the sender can identify the issue. This is a special case for BADONION errors.",
  },
  "malformed-ab": {
    title: "update_fail_malformed_htlc (Alice \u2190 Bob)",
    description:
      "Bob forwards the malformed-onion failure to Alice. The failure_code indicates what was wrong (invalid version, bad HMAC, or bad key). Alice can retry with a corrected onion packet.",
  },
  "failure-reasons": {
    title: "Failure Reason Categories",
    description:
      "BOLT 4 defines failure codes as bitmasks that combine categories:\n\u2022 BADONION (0x8000): the onion was corrupted\n\u2022 PERM (0x4000): permanent, don\u2019t retry this route\n\u2022 NODE (0x2000): the failing node itself has a problem\n\u2022 UPDATE (0x1000): includes a channel_update with new parameters\n\nExample: 0x4000 | 0x2000 | 10 = permanent node failure.",
  },
};

export function HTLCSettleDiagram() {
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
  const tooltip = hovered ? TOOLTIPS[hovered] : null;
  const H = step === 0 ? 466 : 556;

  // Message card renderer
  function renderMsgCard(
    x: number, y: number, w: number, h: number,
    title: string, titleColor: string,
    fields: Array<{ label: string; value: string; valueColor?: string }>,
    region: string,
  ) {
    const isH = hovered === region;
    return (
      <g {...hoverProps(region)}>
        <rect
          x={x} y={y} width={w} height={h} rx={6}
          fill={isH ? "rgba(184,134,11,0.04)" : "white"}
          stroke={isH ? GOLD : BORDER} strokeWidth={isH ? 1.5 : 1}
          style={{ transition: "fill .15s ease, stroke .15s ease" }}
        />
        {/* Header band */}
        <rect x={x} y={y} width={w} height={18} rx={6} fill={`${titleColor}0a`} style={noPtr} />
        <rect x={x} y={y + 12} width={w} height={6} fill={`${titleColor}0a`} style={noPtr} />
        <line x1={x + 4} y1={y + 18} x2={x + w - 4} y2={y + 18} stroke={BORDER} strokeWidth="0.5" style={noPtr} />
        <text x={x + 8} y={y + 13} fontSize="8.5" fontWeight="700" fontFamily={mono} fill={titleColor} style={noPtr}>
          {title}
        </text>
        {/* Fields */}
        {fields.map((f, i) => {
          const fy = y + 18 + 13 * (i + 1);
          return (
            <g key={i}>
              <text x={x + 8} y={fy} fontSize="8" fill={TEXT_MUTED} fontFamily={mono} style={noPtr}>
                {f.label}:
              </text>
              <text x={x + w - 8} y={fy} fontSize="8" fontWeight="600" fill={f.valueColor || TEXT_DARK} fontFamily={mono} textAnchor="end" style={noPtr}>
                {f.value}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  function renderNodes() {
    return (
      <>
        <circle cx={aliceX} cy={nodeY} r={nodeR} fill="rgba(37,99,235,0.08)" stroke={ALICE_CLR} strokeWidth="2.5" />
        <text x={aliceX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>A</text>
        <text x={aliceX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={ALICE_CLR} textAnchor="middle" style={noPtr}>Alice</text>

        <circle cx={bobX} cy={nodeY} r={nodeR} fill="rgba(234,88,12,0.08)" stroke={BOB_CLR} strokeWidth="2.5" />
        <text x={bobX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={BOB_CLR} textAnchor="middle" style={noPtr}>B</text>
        <text x={bobX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={BOB_CLR} textAnchor="middle" style={noPtr}>Bob</text>

        <circle cx={dianneX} cy={nodeY} r={nodeR} fill="rgba(124,58,237,0.08)" stroke={DIANNE_CLR} strokeWidth="2.5" />
        <text x={dianneX} y={nodeY + 6} fontSize="15" fontWeight="700" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>D</text>
        <text x={dianneX} y={nodeY - nodeR - 7} fontSize="11" fontWeight="600" fill={DIANNE_CLR} textAnchor="middle" style={noPtr}>Dianne</text>

        {/* Channel bars */}
        <rect x={aliceX + nodeR + 6} y={nodeY + nodeR + 8} width={bobX - aliceX - nodeR * 2 - 12} height={5} rx="2.5"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
        <rect x={bobX + nodeR + 6} y={nodeY + nodeR + 8} width={dianneX - bobX - nodeR * 2 - 12} height={5} rx="2.5"
          fill={`${GOLD}20`} stroke={GOLD} strokeWidth="0.5" />
      </>
    );
  }

  // Arrow flowing right-to-left
  function renderArrow(fromX: number, toX: number, y: number, color: string, cls: string) {
    return (
      <g className={cls}>
        <line
          x1={fromX - nodeR - 4} y1={y}
          x2={toX + nodeR + 10} y2={y}
          stroke={color} strokeWidth="2.5"
          markerEnd={`url(#settle-arr-${color.replace("#", "")})`}
        />
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
            @keyframes settle-fade {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes settle-draw {
              from { stroke-dashoffset: 400; }
              to   { stroke-dashoffset: 0; }
            }
            .sd { stroke-dasharray: 400; stroke-dashoffset: 400; }
            .sf0 { opacity:0; animation: settle-fade .5s ease-out .3s forwards }
            .sf1 { opacity:0; animation: settle-fade .5s ease-out .9s forwards }
            .sf2 { opacity:0; animation: settle-fade .5s ease-out 1.5s forwards }
            .sf3 { opacity:0; animation: settle-fade .5s ease-out 2.1s forwards }
            .sf4 { opacity:0; animation: settle-fade .5s ease-out 2.7s forwards }
            .sa0 { animation: settle-draw .5s ease-out .3s forwards }
            .sa1 { animation: settle-draw .5s ease-out 1.5s forwards }
          `}</style>

          <defs>
            <marker id={`settle-arr-${GREEN.replace("#", "")}`} markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={GREEN} />
            </marker>
            <marker id={`settle-arr-${ORANGE.replace("#", "")}`} markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={ORANGE} />
            </marker>
          </defs>

          {/* ═══════ STEP 0: Fulfilling HTLCs ═══════ */}
          {step === 0 && (
            <g key={`s0-${animKey}`}>
              <text x={W / 2} y="18" fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Fulfilling HTLCs Off-Chain
              </text>
              <text x={W / 2} y="34" fontSize="11.5" fill={TEXT_MUTED} textAnchor="middle">
                The preimage propagates backward, settling each HTLC without closing the channel
              </text>

              {renderNodes()}

              {/* Arrow Dianne → Bob */}
              <g className="sf0">
                {renderArrow(dianneX, bobX, nodeY + 16, GREEN, "sd sa0")}
              </g>

              {/* Message card: Dianne → Bob */}
              <g className="sf1">
                {renderMsgCard(
                  (bobX + dianneX) / 2 - 88, nodeY + nodeR + 28, 176, 64,
                  "update_fulfill_htlc", GREEN,
                  [
                    { label: "channel_id", value: "BobDianne1" },
                    { label: "id", value: "0" },
                    { label: "payment_preimage", value: "R", valueColor: GREEN },
                  ],
                  "fulfill-bd",
                )}
              </g>

              {/* Arrow Bob → Alice */}
              <g className="sf2">
                {renderArrow(bobX, aliceX, nodeY + 16, GREEN, "sd sa1")}
              </g>

              {/* Message card: Bob → Alice */}
              <g className="sf3">
                {renderMsgCard(
                  (aliceX + bobX) / 2 - 88, nodeY + nodeR + 28, 176, 64,
                  "update_fulfill_htlc", GREEN,
                  [
                    { label: "channel_id", value: "AliceBob1" },
                    { label: "id", value: "0" },
                    { label: "payment_preimage", value: "R", valueColor: GREEN },
                  ],
                  "fulfill-ab",
                )}
              </g>

              {/* Before / After balance comparison */}
              {(() => {
                const balY = nodeY + nodeR + 108;
                const boxW = 230;
                const gap = 30;
                const leftX = W / 2 - boxW - gap / 2;
                const rightX = W / 2 + gap / 2;
                const boxH = 76;

                return (
                  <g className="sf4">
                    {/* Arrow between boxes */}
                    <text x={W / 2} y={balY + boxH / 2 + 4} fontSize="18" fill={GREEN} textAnchor="middle" style={noPtr}>{"\u2192"}</text>

                    {/* Before box */}
                    <g {...hoverProps("balance-before")}>
                      <rect x={leftX} y={balY} width={boxW} height={boxH} rx={8}
                        fill={hovered === "balance-before" ? "rgba(184,134,11,0.06)" : "white"}
                        stroke={hovered === "balance-before" ? GOLD : BORDER} strokeWidth="1.2"
                        style={{ transition: "fill .15s ease, stroke .15s ease" }}
                      />
                      <text x={leftX + boxW / 2} y={balY + 16} fontSize="10" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>Before</text>
                      <line x1={leftX + 8} y1={balY + 22} x2={leftX + boxW - 8} y2={balY + 22} stroke={BORDER} strokeWidth="0.5" style={noPtr} />
                      <text x={leftX + 12} y={balY + 38} fontSize="9.5" fill={ALICE_CLR} fontWeight="600" style={noPtr}>Alice: 295,000</text>
                      <text x={leftX + boxW - 12} y={balY + 38} fontSize="9.5" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>sats</text>
                      <rect x={leftX + 8} y={balY + 44} width={boxW - 16} height={16} rx={4}
                        fill={`${GOLD}08`} stroke={`${GOLD}40`} strokeWidth="0.5" style={noPtr} />
                      <text x={leftX + 14} y={balY + 56} fontSize="9.5" fill={GOLD} fontWeight="700" style={noPtr}>HTLC: 405,000</text>
                      <text x={leftX + boxW - 14} y={balY + 56} fontSize="8" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>{"\u2192"} Bob</text>
                      <text x={leftX + 12} y={balY + 72} fontSize="9.5" fill={BOB_CLR} fontWeight="600" style={noPtr}>Bob: 300,000</text>
                      <text x={leftX + boxW - 12} y={balY + 72} fontSize="9.5" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>sats</text>
                    </g>

                    {/* After box */}
                    <g {...hoverProps("balance-after")}>
                      <rect x={rightX} y={balY} width={boxW} height={boxH} rx={8}
                        fill={hovered === "balance-after" ? "rgba(22,163,74,0.06)" : "white"}
                        stroke={hovered === "balance-after" ? GREEN : BORDER} strokeWidth="1.2"
                        style={{ transition: "fill .15s ease, stroke .15s ease" }}
                      />
                      <text x={rightX + boxW / 2} y={balY + 16} fontSize="10" fontWeight="700" fill={GREEN} textAnchor="middle" style={noPtr}>After</text>
                      <line x1={rightX + 8} y1={balY + 22} x2={rightX + boxW - 8} y2={balY + 22} stroke={BORDER} strokeWidth="0.5" style={noPtr} />
                      <text x={rightX + 12} y={balY + 38} fontSize="9.5" fill={ALICE_CLR} fontWeight="600" style={noPtr}>Alice: 295,000</text>
                      <text x={rightX + boxW - 12} y={balY + 38} fontSize="9.5" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>sats</text>
                      <text x={rightX + 12} y={balY + 56} fontSize="9.5" fill={BOB_CLR} fontWeight="700" style={noPtr}>Bob: 705,000</text>
                      <text x={rightX + boxW - 12} y={balY + 56} fontSize="9.5" fill={TEXT_MUTED} textAnchor="end" style={noPtr}>sats</text>
                      <text x={rightX + boxW / 2} y={balY + 72} fontSize="9" fill={GREEN} fontWeight="600" textAnchor="middle" fontFamily={mono} style={noPtr}>(HTLC removed)</text>
                    </g>

                    {/* Caption */}
                    <text x={W / 2} y={balY + boxH + 24} fontSize="11" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                      Both parties update balances off-chain. The channel stays open.
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* ═══════ STEP 1: Failing HTLCs ═══════ */}
          {step === 1 && (
            <g key={`s1-${animKey}`}>
              <text x={W / 2} y="18" fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
                Failing HTLCs
              </text>
              <text x={W / 2} y="34" fontSize="11.5" fill={TEXT_MUTED} textAnchor="middle">
                Failures propagate backward with encrypted reasons only the sender can read
              </text>

              {renderNodes()}

              {/* === Row 1: update_fail_htlc === */}
              {(() => {
                const rowY = nodeY + nodeR + 24;
                const cardW = 176;
                const cardH = 52;
                return (
                  <g className="sf0">
                    {/* Label */}
                    <text x={W / 2} y={rowY - 4} fontSize="10" fontWeight="700" fill={ORANGE} textAnchor="middle" fontFamily={mono} style={noPtr}>
                      update_fail_htlc
                    </text>

                    {/* Arrows */}
                    {renderArrow(dianneX, bobX, nodeY + 14, ORANGE, "sd sa0")}
                    {renderArrow(bobX, aliceX, nodeY + 14, ORANGE, "sd sa1")}

                    {/* Card: Dianne → Bob */}
                    {renderMsgCard(
                      (bobX + dianneX) / 2 - cardW / 2, rowY, cardW, cardH,
                      "update_fail_htlc", ORANGE,
                      [
                        { label: "channel_id", value: "BobDianne1" },
                        { label: "id", value: "0" },
                        { label: "reason", value: "[encrypted]", valueColor: ORANGE },
                      ],
                      "fail-bd",
                    )}

                    {/* Card: Bob → Alice */}
                    {renderMsgCard(
                      (aliceX + bobX) / 2 - cardW / 2, rowY, cardW, cardH,
                      "update_fail_htlc", ORANGE,
                      [
                        { label: "channel_id", value: "AliceBob1" },
                        { label: "id", value: "0" },
                        { label: "reason", value: "[encrypted]", valueColor: ORANGE },
                      ],
                      "fail-ab",
                    )}
                  </g>
                );
              })()}

              {/* === Row 2: update_fail_malformed_htlc === */}
              {(() => {
                const rowY = nodeY + nodeR + 100;
                const cardW = 192;
                const cardH = 52;
                return (
                  <g className="sf1">
                    {/* Label */}
                    <text x={W / 2} y={rowY - 4} fontSize="10" fontWeight="700" fill={RED} textAnchor="middle" fontFamily={mono} style={noPtr}>
                      update_fail_malformed_htlc
                    </text>

                    {/* Card: Dianne → Bob */}
                    {renderMsgCard(
                      (bobX + dianneX) / 2 - cardW / 2, rowY, cardW, cardH,
                      "update_fail_malformed_htlc", RED,
                      [
                        { label: "channel_id", value: "BobDianne1" },
                        { label: "id", value: "0" },
                        { label: "failure_code", value: "BADONION", valueColor: RED },
                      ],
                      "malformed-bd",
                    )}

                    {/* Card: Bob → Alice */}
                    {renderMsgCard(
                      (aliceX + bobX) / 2 - cardW / 2, rowY, cardW, cardH,
                      "update_fail_malformed_htlc", RED,
                      [
                        { label: "channel_id", value: "AliceBob1" },
                        { label: "id", value: "0" },
                        { label: "failure_code", value: "BADONION", valueColor: RED },
                      ],
                      "malformed-ab",
                    )}
                  </g>
                );
              })()}

              {/* === Failure Reasons Panel === */}
              {(() => {
                const panelY = nodeY + nodeR + 172;
                const panelW = 480;
                const panelX = (W - panelW) / 2;
                const panelH = 132;
                const isH = hovered === "failure-reasons";
                const rowH = 22;
                const headerH = 28;
                const categories: Array<{ code: string; name: string; desc: string; color: string }> = [
                  { code: "0x8000", name: "BADONION", desc: "Invalid onion version, HMAC, or key", color: RED },
                  { code: "0x4000", name: "PERM", desc: "Permanent failure (don\u2019t retry this route)", color: ORANGE },
                  { code: "0x2000", name: "NODE", desc: "Node-level failure (temporary or permanent)", color: GOLD },
                  { code: "0x1000", name: "UPDATE", desc: "Insufficient fee, HTLC too small, incorrect CLTV", color: TEXT_MUTED },
                ];

                return (
                  <g className="sf2" {...hoverProps("failure-reasons")}>
                    <rect
                      x={panelX} y={panelY} width={panelW} height={panelH} rx={8}
                      fill={isH ? "rgba(184,134,11,0.04)" : "white"}
                      stroke={isH ? GOLD : BORDER} strokeWidth="1.2"
                      style={{ transition: "fill .15s ease, stroke .15s ease" }}
                    />
                    {/* Header */}
                    <text x={panelX + panelW / 2} y={panelY + 18} fontSize="11" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
                      Failure Reason Categories (BOLT 4)
                    </text>
                    <line x1={panelX + 10} y1={panelY + headerH} x2={panelX + panelW - 10} y2={panelY + headerH} stroke={BORDER} strokeWidth="0.5" style={noPtr} />

                    {/* Column headers */}
                    <text x={panelX + 18} y={panelY + headerH + 16} fontSize="8.5" fontWeight="700" fill={TEXT_MUTED} style={noPtr}>Code</text>
                    <text x={panelX + 88} y={panelY + headerH + 16} fontSize="8.5" fontWeight="700" fill={TEXT_MUTED} style={noPtr}>Category</text>
                    <text x={panelX + 192} y={panelY + headerH + 16} fontSize="8.5" fontWeight="700" fill={TEXT_MUTED} style={noPtr}>Description</text>

                    {/* Rows */}
                    {categories.map((cat, i) => {
                      const ry = panelY + headerH + 18 + rowH * (i + 1);
                      return (
                        <g key={cat.name}>
                          {i % 2 === 0 && (
                            <rect x={panelX + 4} y={ry - 14} width={panelW - 8} height={rowH} rx={3} fill="rgba(184,134,11,0.03)" style={noPtr} />
                          )}
                          <text x={panelX + 18} y={ry} fontSize="9.5" fontWeight="600" fontFamily={mono} fill={TEXT_DARK} style={noPtr}>{cat.code}</text>
                          <text x={panelX + 88} y={ry} fontSize="9.5" fontWeight="700" fill={cat.color} style={noPtr}>{cat.name}</text>
                          <text x={panelX + 192} y={ry} fontSize="9.5" fill={TEXT_MUTED} style={noPtr}>{cat.desc}</text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* Caption */}
              <text x={W / 2} y={H - 30} fontSize="11" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
                Failure reasons are onion-encrypted. Only the original sender (Alice) can read them.
              </text>
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
