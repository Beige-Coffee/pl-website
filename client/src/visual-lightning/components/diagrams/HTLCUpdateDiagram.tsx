import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "State 1" },
  { label: "add HTLC" },
  { label: "Alice: commit" },
  { label: "Bob: revoke" },
  { label: "Bob: commit" },
  { label: "Alice: revoke" },
];

const ALICE_CLR = "#2563eb";
const BOB_CLR = "#ea580c";
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const RED = "#dc2626";
const GREEN = "#16a34a";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "alice-old-tx": {
    title: "Alice's State 1 TX",
    description:
      "Alice holds this commitment TX with Bob's signature. Two outputs: to_local (Alice, delayed) and to_remote (Bob, immediate). No HTLC outputs.",
  },
  "bob-old-tx": {
    title: "Bob's State 1 TX",
    description:
      "Bob holds this commitment TX with Alice's signature. Two outputs: to_local (Bob, delayed) and to_remote (Alice, immediate). No HTLC outputs.",
  },
  "alice-new-tx": {
    title: "Alice's State 2 TX (with HTLC)",
    description:
      "Alice's new commitment TX with three outputs: to_remote (Bob), offered HTLC (405,000 sats), and to_local (Alice, delayed). Uses new per-commitment keys (A2).",
  },
  "bob-new-tx": {
    title: "Bob's State 2 TX (with HTLC)",
    description:
      "Bob's new commitment TX with three outputs: to_local (Bob, delayed), received HTLC (405,000 sats), and to_remote (Alice). Uses new per-commitment keys (B2).",
  },
  "msg-add-htlc": {
    title: "update_add_htlc (Alice \u2192 Bob)",
    description:
      "Alice proposes a new HTLC. Fields:\n\u2022 channel_id: AliceBob1\n\u2022 id: 0\n\u2022 amount_msat: 405,000,000\n\u2022 payment_hash: H\n\u2022 cltv_expiry: 200\n\u2022 onion_routing_packet: encrypted route\n\nBob stages this HTLC but does NOT forward it yet. The old state is still valid.",
  },
  "msg-commit-1": {
    title: "commitment_signed (Alice \u2192 Bob)",
    description:
      "Alice sends her funding signature for Bob's new commitment TX (with HTLC). Also includes htlc_signatures for the HTLC output. Bob now has a signed new TX but hasn't revoked his old one yet.",
  },
  "msg-revoke-1": {
    title: "revoke_and_ack (Bob \u2192 Alice)",
    description:
      "Bob reveals his State 1 per_commitment_secret, allowing Alice to derive the revocation key for Bob's old TX. Also sends next_per_commitment_point.\n\nBob's old state is now revoked. It's now safe for Bob to forward the HTLC to Dianne.",
  },
  "msg-commit-2": {
    title: "commitment_signed (Bob \u2192 Alice)",
    description:
      "Bob sends his funding signature for Alice's new commitment TX (with HTLC). Also includes htlc_signatures. Alice now has a signed new TX but hasn't revoked her old one.",
  },
  "msg-revoke-2": {
    title: "revoke_and_ack (Alice \u2192 Bob)",
    description:
      "Alice reveals her State 1 per_commitment_secret, allowing Bob to derive the revocation key for Alice's old TX. Also sends next_per_commitment_point.\n\nBoth old states are now revoked. The HTLC is irrevocably committed.",
  },
  "htlc-offered": {
    title: "Offered HTLC (on Alice's TX)",
    description:
      "Alice is offering this HTLC. Three spending paths:\n\u2022 Revocation: penalty if old state broadcast\n\u2022 Success: Bob reveals preimage R\n\u2022 Timeout: After block 200, Alice reclaims\n\nwitnessScript:\n  OP_IF\n    <revocation_pubkey>\n  OP_ELSE OP_IF\n    <payment_hash> OP_EQUAL\n    <remote_htlcpubkey> OP_CHECKSIG\n  OP_ELSE\n    <cltv_expiry> OP_CLTV OP_DROP\n    <local_htlcpubkey> OP_CHECKSIG\n  OP_ENDIF OP_ENDIF",
  },
  "htlc-received": {
    title: "Received HTLC (on Bob's TX)",
    description:
      "Bob is receiving this HTLC. Three spending paths:\n\u2022 Revocation: penalty if old state broadcast\n\u2022 Success: Bob reveals preimage R (after delay)\n\u2022 Timeout: After block 200, Alice reclaims\n\nwitnessScript:\n  OP_IF\n    <revocation_pubkey>\n  OP_ELSE OP_IF\n    <payment_hash> OP_EQUAL\n    <to_self_delay> OP_CSV\n    <local_htlcpubkey> OP_CHECKSIG\n  OP_ELSE\n    <cltv_expiry> OP_CLTV OP_DROP\n    <remote_htlcpubkey> OP_CHECKSIG\n  OP_ENDIF OP_ENDIF",
  },
};

// ── Protocol messages ──
const MESSAGES = [
  {
    id: "msg-add-htlc",
    label: "update_add_htlc",
    detail: "channel_id, amount: 405k, payment_hash: H, cltv: 200",
    fromAlice: true,
    color: ALICE_CLR,
  },
  {
    id: "msg-commit-1",
    label: "commitment_signed",
    detail: "Alice\u2019s funding sig + htlc_signatures for Bob\u2019s new TX",
    fromAlice: true,
    color: ALICE_CLR,
  },
  {
    id: "msg-revoke-1",
    label: "revoke_and_ack",
    detail: "per_commitment_secret (State 1) + next_per_commitment_point",
    fromAlice: false,
    color: BOB_CLR,
  },
  {
    id: "msg-commit-2",
    label: "commitment_signed",
    detail: "Bob\u2019s funding sig + htlc_signatures for Alice\u2019s new TX",
    fromAlice: false,
    color: BOB_CLR,
  },
  {
    id: "msg-revoke-2",
    label: "revoke_and_ack",
    detail: "per_commitment_secret (State 1) + next_per_commitment_point",
    fromAlice: true,
    color: ALICE_CLR,
  },
];

// ── Message fields (shown in expanded card for current message) ──
const MSG_FIELDS: { label: string; value: string }[][] = [
  [ // update_add_htlc (Alice → Bob)
    { label: "channel_id", value: "AliceBob1" },
    { label: "amount_msat", value: "405,000,000" },
    { label: "payment_hash", value: "H" },
    { label: "cltv_expiry", value: "200" },
  ],
  [ // commitment_signed (Alice → Bob)
    { label: "channel_id", value: "AliceBob1" },
    { label: "signature", value: "alice_funding_sig" },
    { label: "htlc_signatures", value: "[htlc_sig_1]" },
  ],
  [ // revoke_and_ack (Bob → Alice)
    { label: "channel_id", value: "AliceBob1" },
    { label: "per_commitment_secret", value: "bob_secret_1" },
    { label: "next_per_commitment_point", value: "bob_point_3" },
  ],
  [ // commitment_signed (Bob → Alice)
    { label: "channel_id", value: "AliceBob1" },
    { label: "signature", value: "bob_funding_sig" },
    { label: "htlc_signatures", value: "[htlc_sig_1]" },
  ],
  [ // revoke_and_ack (Alice → Bob)
    { label: "channel_id", value: "AliceBob1" },
    { label: "per_commitment_secret", value: "alice_secret_1" },
    { label: "next_per_commitment_point", value: "alice_point_3" },
  ],
];

// Card states per step [0..5]
type CardState = "active" | "revoked" | "proposed" | "signed" | "current";

const ALICE_OLD: CardState[] = ["active", "active", "active", "active", "active", "revoked"];
const BOB_OLD: CardState[] = ["active", "active", "active", "revoked", "revoked", "revoked"];

// Step titles
const TITLES = [
  "Channel State 1",
  "Alice proposes an HTLC",
  "Alice commits to the new state",
  "Bob revokes his old state",
  "Bob commits to Alice\u2019s new state",
  "Update complete \u2014 HTLC irrevocably committed",
];

const CAPTIONS: [string, string][] = [
  ["Each party holds the other\u2019s signature on their commitment TX", "No HTLC outputs yet"],
  ["Alice sends update_add_htlc \u2014 Bob stages the HTLC", "Bob must NOT forward until the HTLC is irrevocably committed"],
  ["Alice sends her signature for Bob\u2019s new TX (with HTLC)", "Bob now has a signed new TX, but hasn\u2019t revoked his old one"],
  ["Bob reveals his State 1 per-commitment secret", "Bob can now safely forward the HTLC to Dianne"],
  ["Bob sends his signature for Alice\u2019s new TX (with HTLC)", "Alice now has a signed new TX, but hasn\u2019t revoked hers yet"],
  ["Both old states revoked \u2014 cheating means losing everything", "The HTLC is now safely enforceable on-chain"],
];

const CAPTION_L2_COLORS = [GOLD, BOB_CLR, ALICE_CLR, GREEN, BOB_CLR, GOLD];

export function HTLCUpdateDiagram() {
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

  // ── Layout ──
  const W = 576;
  const simpleCardH = 62;
  const htlcCardH = 82;
  const cardW = 192;
  const aliceCardX = 8;
  const bobCardX = W - 8 - cardW;
  const aliceColX = aliceCardX + cardW / 2;
  const bobColX = bobCardX + cardW / 2;
  const arrowLeft = aliceCardX + cardW + 6;
  const arrowRight = bobCardX - 6;
  const arrowMid = (arrowLeft + arrowRight) / 2;

  const titleY = 50;
  const oldCardsY = 68;
  const firstMsgY = oldCardsY + simpleCardH + 32;

  const numMsgs = Math.min(step, 5);

  // Field card dimensions
  const fRowH = 15;
  const fHeaderH = 22;
  const fCardW = 228;
  const collapsedMsgSpacing = 28;

  // Compute message Y positions dynamically (current msg gets expanded card height)
  const msgYPositions: number[] = [];
  for (let i = 0; i < numMsgs; i++) {
    if (i === 0) {
      msgYPositions.push(firstMsgY);
    } else {
      msgYPositions.push(msgYPositions[i - 1] + collapsedMsgSpacing);
    }
  }

  // Compute current msg card height (varies by field count)
  const currentMsgFields = numMsgs > 0 ? MSG_FIELDS[numMsgs - 1] : [];
  const fCardH = fHeaderH + currentMsgFields.length * fRowH + 6;

  const newCardsY = numMsgs > 0
    ? msgYPositions[numMsgs - 1] + 6 + fCardH + 14
    : 0;
  const captionY = step === 0
    ? oldCardsY + simpleCardH + 34
    : newCardsY + htlcCardH + 18;

  const H = step === 0 ? 250 : captionY + 58;

  // ── Simple TX card (State 1, no HTLC) ──
  const renderSimpleCard = (
    id: string, x: number, y: number,
    owner: string, ownerAmt: string, otherName: string, otherAmt: string,
    state: CardState,
  ) => {
    const isRevoked = state === "revoked";
    const borderColor = isRevoked ? "#fca5a5" : BORDER;
    const bgFill = isRevoked ? "#fef2f2" : "white";
    const dashArray = isRevoked ? "4 2" : undefined;
    const opacity = isRevoked ? 0.55 : 1;
    const ownerShort = owner.replace("'s TX", "");

    // BOLT 3: sort outputs by value ascending (lower balance first)
    const ownerVal = parseFloat(ownerAmt);
    const otherVal = parseFloat(otherAmt);
    const ownerFirst = ownerVal <= otherVal;

    const row1Name = ownerFirst ? ownerShort : otherName;
    const row1Amt = ownerFirst ? ownerAmt : otherAmt;
    const row1Color = ownerFirst ? GOLD : TEXT_MUTED;
    const row2Name = ownerFirst ? otherName : ownerShort;
    const row2Amt = ownerFirst ? otherAmt : ownerAmt;
    const row2Color = ownerFirst ? TEXT_MUTED : GOLD;

    return (
      <g {...hoverProps(id)} style={{ opacity }}>
        <rect
          x={x} y={y} width={cardW} height={simpleCardH} rx={8}
          fill={hovered === id ? "rgba(184,134,11,0.06)" : bgFill}
          stroke={hovered === id ? GOLD : borderColor}
          strokeWidth="1.8" strokeDasharray={dashArray}
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        <text x={x + 10} y={y + 18} fontSize="11" fontWeight="600" fill={TEXT_DARK} style={noPtr}>
          {owner}
        </text>
        {isRevoked && (
          <text x={x + cardW - 10} y={y + 18} fontSize="9" fontWeight="700" fill={RED} textAnchor="end" style={noPtr}>
            REVOKED
          </text>
        )}
        {state === "active" && (
          <text x={x + cardW - 10} y={y + 18} fontSize="10" fontWeight="600" fill={GOLD} textAnchor="end" style={noPtr}>
            &#10003;
          </text>
        )}
        <text x={x + 10} y={y + 36} fontSize="10" fill={TEXT_MUTED} style={noPtr}>{row1Name}:</text>
        <text x={x + 66} y={y + 36} fontSize="10" fontWeight="600" fontFamily={mono} fill={row1Color} style={noPtr}>{row1Amt} BTC</text>
        <text x={x + 10} y={y + 51} fontSize="10" fill={TEXT_MUTED} style={noPtr}>{row2Name}:</text>
        <text x={x + 66} y={y + 51} fontSize="10" fontWeight="600" fontFamily={mono} fill={row2Color} style={noPtr}>{row2Amt} BTC</text>
        {isRevoked && (
          <g style={noPtr}>
            <line x1={x + 4} y1={y + 4} x2={x + cardW - 4} y2={y + simpleCardH - 4} stroke={RED} strokeWidth="2" strokeOpacity="0.45" />
            <line x1={x + cardW - 4} y1={y + 4} x2={x + 4} y2={y + simpleCardH - 4} stroke={RED} strokeWidth="2" strokeOpacity="0.45" />
          </g>
        )}
      </g>
    );
  };

  // ── HTLC TX card (State 2, with HTLC) ──
  const renderHTLCCard = (
    id: string, x: number, y: number,
    owner: string, ownerAmt: string, otherName: string, otherAmt: string,
    htlcRegion: string,
    state: CardState,
  ) => {
    const isProposed = state === "proposed";
    const isSigned = state === "signed";
    const isCurrent = state === "current" || state === "active";
    const borderColor = isProposed ? `${GOLD}88` : isSigned ? GOLD : GOLD;
    const bgFill = isProposed ? "#fffcf2" : isSigned ? GOLD_BG : GOLD_BG;
    const dashArray = isProposed ? "4 2" : undefined;
    const ownerShort = owner.replace("'s TX", "");

    const badge = isProposed ? "PROPOSED" : isSigned ? "SIGNED" : isCurrent ? "\u2713" : "";
    const badgeColor = isProposed ? TEXT_MUTED : isSigned ? GOLD : GOLD;

    // BOLT 3: sort outputs by value ascending (lower balance first)
    // HTLC value (0.405) is placed between the two balance rows based on its value
    const ownerVal = parseFloat(ownerAmt);
    const otherVal = parseFloat(otherAmt);
    const ownerFirst = ownerVal <= otherVal;

    const row1Name = ownerFirst ? ownerShort : otherName;
    const row1Amt = ownerFirst ? ownerAmt : otherAmt;
    const row1Color = ownerFirst ? GOLD : TEXT_MUTED;
    const row3Name = ownerFirst ? otherName : ownerShort;
    const row3Amt = ownerFirst ? otherAmt : ownerAmt;
    const row3Color = ownerFirst ? TEXT_MUTED : GOLD;

    return (
      <g>
        {/* Card background */}
        <g {...hoverProps(id)}>
          <rect
            x={x} y={y} width={cardW} height={htlcCardH} rx={8}
            fill={hovered === id ? "rgba(184,134,11,0.06)" : bgFill}
            stroke={hovered === id ? GOLD : borderColor}
            strokeWidth="1.8" strokeDasharray={dashArray}
            style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
        </g>
        {/* Title + badge */}
        <text x={x + 10} y={y + 18} fontSize="11" fontWeight="600" fill={TEXT_DARK} style={noPtr}>
          {owner}
        </text>
        <text x={x + cardW - 10} y={y + 18} fontSize={badge.length > 1 ? "8" : "10"} fontWeight={badge.length > 1 ? "700" : "600"} fill={badgeColor} textAnchor="end" style={noPtr}>
          {badge}
        </text>
        {/* Row 1: lower balance */}
        <text x={x + 10} y={y + 36} fontSize="10" fill={TEXT_MUTED} style={noPtr}>{row1Name}:</text>
        <text x={x + 66} y={y + 36} fontSize="10" fontWeight="600" fontFamily={mono} fill={row1Color} style={noPtr}>{row1Amt} BTC</text>
        {/* HTLC row (hoverable) */}
        <g {...hoverProps(htlcRegion)}>
          <rect
            x={x + 6} y={y + 43} width={cardW - 12} height={17} rx={4}
            fill={hovered === htlcRegion ? "rgba(184,134,11,0.12)" : "rgba(184,134,11,0.06)"}
            stroke={hovered === htlcRegion ? GOLD : `${GOLD}44`}
            strokeWidth="0.8"
            style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
          />
          <text x={x + 12} y={y + 55} fontSize="9" fontWeight="600" fill={GOLD} style={noPtr}>HTLC:</text>
          <text x={x + 50} y={y + 55} fontSize="9" fontWeight="600" fontFamily={mono} fill={GOLD} style={noPtr}>0.405 BTC</text>
          <text x={x + cardW - 14} y={y + 55} fontSize="7" fill={GREEN} fontWeight="600" textAnchor="end" style={noPtr}>hover for script</text>
        </g>
        {/* Row 3: higher balance */}
        <text x={x + 10} y={y + 74} fontSize="10" fill={TEXT_MUTED} style={noPtr}>{row3Name}:</text>
        <text x={x + 66} y={y + 74} fontSize="10" fontWeight="600" fontFamily={mono} fill={row3Color} style={noPtr}>{row3Amt} BTC</text>
      </g>
    );
  };

  // ── Message arrow renderer ──
  const renderMsg = (
    msg: typeof MESSAGES[number],
    index: number,
    y: number,
    isCurrent: boolean,
  ) => {
    const fromX = msg.fromAlice ? arrowLeft : arrowRight;
    const toX = msg.fromAlice ? arrowRight : arrowLeft;
    const dir = toX > fromX ? 1 : -1;
    const alpha = isCurrent ? 1 : 0.3;
    const pillW = 156;
    const pillH = 18;

    const fields = MSG_FIELDS[index];
    const thisFCardH = fHeaderH + fields.length * fRowH + 6;
    const fCardX = arrowMid - fCardW / 2;
    const fCardTopY = y + 6;

    return (
      <g key={msg.id} {...hoverProps(msg.id)} style={{ opacity: alpha, transition: "opacity 0.3s ease" }}>
        {/* Arrow line */}
        <line
          x1={fromX} y1={y} x2={toX - dir * 9} y2={y}
          stroke={msg.color} strokeWidth={hovered === msg.id ? 3 : 2.2}
          style={{ transition: "stroke-width 0.15s ease" }}
        />
        {/* Arrowhead */}
        <polygon
          points={`${toX - dir * 9},${y - 4.5} ${toX - dir * 9},${y + 4.5} ${toX},${y}`}
          fill={msg.color}
        />
        {/* Label pill (collapsed messages only) */}
        {!isCurrent && (
          <>
            <rect
              x={arrowMid - pillW / 2} y={y - pillH - 2}
              width={pillW} height={pillH} rx={5}
              fill="white" stroke={`${msg.color}44`}
              strokeWidth={0.75}
              style={noPtr}
            />
            <text
              x={arrowMid} y={y - pillH / 2 + 2}
              fontSize="10" fontWeight="600" fontFamily={mono}
              fill={msg.color} textAnchor="middle" style={noPtr}
            >
              {msg.label}
            </text>
          </>
        )}
        {/* Expanded field card (current message only) */}
        {isCurrent && (
          <g style={noPtr}>
            {/* Card background */}
            <rect x={fCardX} y={fCardTopY} width={fCardW} height={thisFCardH} rx={6}
              fill="white" stroke={BORDER} strokeWidth="1" />
            {/* Header bar */}
            <rect x={fCardX} y={fCardTopY} width={fCardW} height={fHeaderH}
              rx={6} fill={`${msg.color}08`} />
            <rect x={fCardX} y={fCardTopY + fHeaderH - 6} width={fCardW} height={6}
              fill={`${msg.color}08`} />
            <line x1={fCardX + 4} y1={fCardTopY + fHeaderH}
              x2={fCardX + fCardW - 4} y2={fCardTopY + fHeaderH}
              stroke={BORDER} strokeWidth="0.5" />
            <text x={fCardX + 8} y={fCardTopY + 15} fontSize="9.5" fontWeight="700"
              fontFamily={mono} fill={msg.color}>
              {msg.label}
            </text>
            {/* Field rows */}
            {fields.map((f, fi) => {
              const fy = fCardTopY + fHeaderH + 4 + fi * fRowH;
              return (
                <g key={f.label}>
                  <text x={fCardX + 8} y={fy + 11} fontSize="8.5" fill={TEXT_MUTED} fontFamily={mono}>
                    {f.label}:
                  </text>
                  <text x={fCardX + fCardW - 8} y={fy + 11} fontSize="8.5" fontWeight="600"
                    fill={TEXT_DARK} fontFamily={mono} textAnchor="end">
                    {f.value}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </g>
    );
  };

  // ── Determine new card states ──
  const bobNewState: CardState | null =
    step >= 1 ? (step <= 1 ? "proposed" : step === 2 ? "signed" : "current") : null;
  const aliceNewState: CardState | null =
    step >= 3 ? (step === 3 ? "proposed" : step === 4 ? "signed" : "current") : null;

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none" style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="vl-card-3d-inner" style={{ overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto", fontFamily: "system-ui, -apple-system, sans-serif" }}
        >
          {/* Dashed timeline lines */}
          <line x1={aliceColX} y1={34} x2={aliceColX} y2={H - 10} stroke={BORDER} strokeWidth="1.2" strokeDasharray="4 3" style={noPtr} />
          <line x1={bobColX} y1={34} x2={bobColX} y2={H - 10} stroke={BORDER} strokeWidth="1.2" strokeDasharray="4 3" style={noPtr} />

          {/* Column headers */}
          <text x={aliceColX} y={24} fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>Alice</text>
          <text x={bobColX} y={24} fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>Bob</text>

          {/* Step title */}
          <text x={W / 2} y={titleY} fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
            {TITLES[step]}
          </text>

          {/* Old TX cards */}
          {renderSimpleCard("alice-old-tx", aliceCardX, oldCardsY, "Alice's TX", "0.7", "Bob", "0.3", ALICE_OLD[step])}
          {renderSimpleCard("bob-old-tx", bobCardX, oldCardsY, "Bob's TX", "0.3", "Alice", "0.7", BOB_OLD[step])}

          {/* Protocol messages (cumulative, building downward) */}
          {MESSAGES.slice(0, numMsgs).map((msg, i) =>
            renderMsg(msg, i, msgYPositions[i], i === numMsgs - 1),
          )}

          {/* New TX cards (with HTLC) */}
          {bobNewState && (
            renderHTLCCard("bob-new-tx", bobCardX, newCardsY, "Bob's TX", "0.3", "Alice", "0.295", "htlc-received", bobNewState)
          )}
          {aliceNewState && (
            renderHTLCCard("alice-new-tx", aliceCardX, newCardsY, "Alice's TX", "0.295", "Bob", "0.3", "htlc-offered", aliceNewState)
          )}

          {/* Caption */}
          <text x={W / 2} y={captionY} fontSize="11" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
            {CAPTIONS[step][0]}
          </text>
          <text x={W / 2} y={captionY + 16} fontSize="11" fill={CAPTION_L2_COLORS[step]} fontWeight="600" textAnchor="middle" style={noPtr}>
            {CAPTIONS[step][1]}
          </text>
        </svg>

        <VLStepAnimation steps={STEPS} currentStep={step} onStepChange={setStep} />

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
