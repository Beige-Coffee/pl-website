import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";
import { VLStepAnimation } from "../VLStepAnimation";

const STEPS = [
  { label: "State 1" },
  { label: "Alice: commit" },
  { label: "Bob: revoke" },
  { label: "Bob: commit" },
  { label: "Alice: revoke" },
];

// ── Party colors (matching RevocationDiagram) ──
const ALICE_CLR = "#2563eb";
const BOB_CLR = "#ea580c";

// ── Course palette ──
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const RED = "#dc2626";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  "alice-old-tx": {
    title: "Alice's State 1 TX",
    description:
      "Alice holds this commitment TX with Bob's signature. She can broadcast unilaterally. Her to_local output has a delay + revocation path.",
  },
  "bob-old-tx": {
    title: "Bob's State 1 TX",
    description:
      "Bob holds this commitment TX with Alice's signature. He can broadcast unilaterally. His to_local output has a delay + revocation path.",
  },
  "msg-commit-1": {
    title: "commitment_signed (Alice \u2192 Bob)",
    description:
      "Alice sends her funding signature for Bob's new commitment TX. Contains: channel_id, signature. In a full implementation, also includes htlc_signatures for any pending HTLCs.",
  },
  "msg-revoke-1": {
    title: "revoke_and_ack (Bob \u2192 Alice)",
    description:
      "Bob reveals his State 1 per_commitment_secret, allowing Alice to derive the revocation private key for Bob's old TX. Also sends next_per_commitment_point for future states.",
  },
  "msg-commit-2": {
    title: "commitment_signed (Bob \u2192 Alice)",
    description:
      "Bob sends his funding signature for Alice's new commitment TX. Contains: channel_id, signature. In a full implementation, also includes htlc_signatures.",
  },
  "msg-revoke-2": {
    title: "revoke_and_ack (Alice \u2192 Bob)",
    description:
      "Alice reveals her State 1 per_commitment_secret, allowing Bob to derive the revocation private key for Alice's old TX. Also sends next_per_commitment_point.",
  },
  "alice-new-tx": {
    title: "Alice's State 2 TX",
    description:
      "Alice's new commitment TX (Alice: 0.6, Bob: 0.4). Now signed by Bob via commitment_signed.",
  },
  "bob-new-tx": {
    title: "Bob's State 2 TX",
    description:
      "Bob's new commitment TX (Bob: 0.4, Alice: 0.6). Now signed by Alice via commitment_signed.",
  },
};

// ── Protocol messages definition ──
const MESSAGES = [
  {
    id: "msg-commit-1",
    label: "commitment_signed",
    detail: "Alice\u2019s funding signature for Bob\u2019s new TX",
    fromAlice: true,
    color: ALICE_CLR,
  },
  {
    id: "msg-revoke-1",
    label: "revoke_and_ack",
    detail: "per_commitment_secret + next_per_commitment_point",
    fromAlice: false,
    color: BOB_CLR,
  },
  {
    id: "msg-commit-2",
    label: "commitment_signed",
    detail: "Bob\u2019s funding signature for Alice\u2019s new TX",
    fromAlice: false,
    color: BOB_CLR,
  },
  {
    id: "msg-revoke-2",
    label: "revoke_and_ack",
    detail: "per_commitment_secret + next_per_commitment_point",
    fromAlice: true,
    color: ALICE_CLR,
  },
];

// ── Message fields (shown in expanded card for current message) ──
const MSG_FIELDS: { label: string; value: string }[][] = [
  [ // commitment_signed (Alice → Bob)
    { label: "channel_id", value: "AliceBob1" },
    { label: "signature", value: "alice_funding_sig" },
    { label: "num_htlcs", value: "0" },
  ],
  [ // revoke_and_ack (Bob → Alice)
    { label: "channel_id", value: "AliceBob1" },
    { label: "per_commitment_secret", value: "bob_secret_1" },
    { label: "next_per_commitment_point", value: "bob_point_3" },
  ],
  [ // commitment_signed (Bob → Alice)
    { label: "channel_id", value: "AliceBob1" },
    { label: "signature", value: "bob_funding_sig" },
    { label: "num_htlcs", value: "0" },
  ],
  [ // revoke_and_ack (Alice → Bob)
    { label: "channel_id", value: "AliceBob1" },
    { label: "per_commitment_secret", value: "alice_secret_1" },
    { label: "next_per_commitment_point", value: "alice_point_3" },
  ],
];

// ── Card states per step ──
const ALICE_OLD: ("active" | "revoked")[] = [
  "active", "active", "active", "active", "revoked",
];
const BOB_OLD: ("active" | "revoked")[] = [
  "active", "active", "revoked", "revoked", "revoked",
];

// ── Step titles ──
const TITLES = [
  "Channel State 1",
  "Alice wants to pay Bob 0.1 BTC",
  "Bob revokes his old state",
  "Bob sends his signature to Alice",
  "Update complete \u2014 State 2 active",
];

// ── Step captions [line1, line2] ──
const CAPTIONS: [string, string][] = [
  [
    "Each party holds the other\u2019s signature on their commitment TX",
    "Either can go on-chain at any time",
  ],
  [
    "Alice sends her signature on Bob\u2019s new commitment TX",
    "Bob now has a signed new TX, but hasn\u2019t revoked his old one yet",
  ],
  [
    "Bob reveals his State 1 per-commitment secret",
    "Alice can now derive the revocation key for Bob\u2019s old TX",
  ],
  [
    "Bob sends his signature on Alice\u2019s new commitment TX",
    "Alice now has a signed new TX, but hasn\u2019t revoked her old one yet",
  ],
  [
    "Both parties have revoked their old states",
    "If either broadcasts State 1, the other claims everything",
  ],
];

// ── Caption line 2 colors per step ──
const CAPTION_L2_COLORS = [GOLD, ALICE_CLR, BOB_CLR, BOB_CLR, GOLD];

export function StateUpdateDiagram() {
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

  // ── Layout constants (scaled up ~1.25x for readability) ──
  const W = 576;
  const cardW = 192;
  const cardH = 62;
  const aliceCardX = 8;
  const bobCardX = W - 8 - cardW; // 376

  // Column centers (for dashed timeline lines)
  const aliceColX = aliceCardX + cardW / 2; // 104
  const bobColX = bobCardX + cardW / 2; // 472

  // Arrow endpoints (between the card edges)
  const arrowLeft = aliceCardX + cardW + 6; // 206
  const arrowRight = bobCardX - 6; // 370
  const arrowMid = (arrowLeft + arrowRight) / 2; // 288

  // Y positions
  const titleY = 50;
  const oldCardsY = 68;
  const firstMsgY = oldCardsY + cardH + 32; // 162

  // How many messages visible
  const numMsgs = Math.min(step, 4);

  // Field card dimensions (all messages have 3 fields)
  const fRowH = 15;
  const fHeaderH = 22;
  const fCardH = fHeaderH + 3 * fRowH + 6; // 73
  const fCardW = 228;
  const collapsedMsgSpacing = 28;

  // Compute message Y positions dynamically
  const msgYPositions: number[] = [];
  for (let i = 0; i < numMsgs; i++) {
    if (i === 0) {
      msgYPositions.push(firstMsgY);
    } else {
      msgYPositions.push(msgYPositions[i - 1] + collapsedMsgSpacing);
    }
  }

  // New cards: below the last message's expanded card
  const newCardsY = numMsgs > 0
    ? msgYPositions[numMsgs - 1] + 6 + fCardH + 14
    : 0;

  // Caption
  const captionY = step === 0
    ? oldCardsY + cardH + 34
    : newCardsY + cardH + 18;

  // Total SVG height
  const H = step === 0 ? 250 : captionY + 58;

  // ── TX card renderer ──
  const renderTxCard = (
    id: string,
    x: number,
    y: number,
    owner: string,
    ownerAmt: string,
    otherName: string,
    otherAmt: string,
    state: "active" | "revoked" | "new",
  ) => {
    const isRevoked = state === "revoked";
    const isNew = state === "new";
    const borderColor = isRevoked ? "#fca5a5" : isNew ? GOLD : BORDER;
    const bgFill = isRevoked ? "#fef2f2" : isNew ? GOLD_BG : "white";
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
          x={x} y={y} width={cardW} height={cardH} rx={8}
          fill={hovered === id ? "rgba(184, 134, 11, 0.06)" : bgFill}
          stroke={hovered === id ? GOLD : borderColor}
          strokeWidth="1.8"
          strokeDasharray={dashArray}
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        {/* Card title */}
        <text x={x + 10} y={y + 18} fontSize="11" fontWeight="600" fill={TEXT_DARK} style={noPtr}>
          {owner}
        </text>
        {/* State badge */}
        {isRevoked && (
          <text x={x + cardW - 10} y={y + 18} fontSize="9" fontWeight="700" fill={RED} textAnchor="end" style={noPtr}>
            REVOKED
          </text>
        )}
        {isNew && (
          <text x={x + cardW - 10} y={y + 18} fontSize="9" fontWeight="700" fill={GOLD} textAnchor="end" style={noPtr}>
            NEW
          </text>
        )}
        {state === "active" && (
          <text x={x + cardW - 10} y={y + 18} fontSize="10" fontWeight="600" fill={GOLD} textAnchor="end" style={noPtr}>
            &#10003;
          </text>
        )}
        {/* Balances (sorted: lower value first per BOLT 3) */}
        <text x={x + 10} y={y + 36} fontSize="10" fill={TEXT_MUTED} style={noPtr}>
          {row1Name}:
        </text>
        <text x={x + 66} y={y + 36} fontSize="10" fontWeight="600" fontFamily={mono} fill={row1Color} style={noPtr}>
          {row1Amt} BTC
        </text>
        <text x={x + 10} y={y + 51} fontSize="10" fill={TEXT_MUTED} style={noPtr}>
          {row2Name}:
        </text>
        <text x={x + 66} y={y + 51} fontSize="10" fontWeight="600" fontFamily={mono} fill={row2Color} style={noPtr}>
          {row2Amt} BTC
        </text>
        {/* X cross for revoked */}
        {isRevoked && (
          <g style={noPtr}>
            <line
              x1={x + 4} y1={y + 4}
              x2={x + cardW - 4} y2={y + cardH - 4}
              stroke={RED} strokeWidth="2" strokeOpacity="0.45"
            />
            <line
              x1={x + cardW - 4} y1={y + 4}
              x2={x + 4} y2={y + cardH - 4}
              stroke={RED} strokeWidth="2" strokeOpacity="0.45"
            />
          </g>
        )}
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
    const pillW = 150;
    const pillH = 18;

    const fields = MSG_FIELDS[index];
    const fCardX = arrowMid - fCardW / 2;
    const fCardTopY = y + 6;

    return (
      <g key={msg.id} {...hoverProps(msg.id)} style={{ opacity: alpha, transition: "opacity 0.3s ease" }}>
        {/* Arrow line */}
        <line
          x1={fromX} y1={y} x2={toX - dir * 9} y2={y}
          stroke={msg.color}
          strokeWidth={hovered === msg.id ? 3 : 2.2}
          style={{ transition: "stroke-width 0.15s ease" }}
        />
        {/* Arrowhead */}
        <polygon
          points={`${toX - dir * 9},${y - 4.5} ${toX - dir * 9},${y + 4.5} ${toX},${y}`}
          fill={msg.color}
        />
        {/* Label pill (collapsed messages only — card header shows name for expanded) */}
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
            <rect x={fCardX} y={fCardTopY} width={fCardW} height={fCardH} rx={6}
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
          {/* ── Dashed timeline lines (behind everything) ── */}
          <line
            x1={aliceColX} y1={34} x2={aliceColX} y2={H - 10}
            stroke={BORDER} strokeWidth="1.2" strokeDasharray="4 3" style={noPtr}
          />
          <line
            x1={bobColX} y1={34} x2={bobColX} y2={H - 10}
            stroke={BORDER} strokeWidth="1.2" strokeDasharray="4 3" style={noPtr}
          />

          {/* ── Column headers ── */}
          <text x={aliceColX} y={24} fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
            Alice
          </text>
          <text x={bobColX} y={24} fontSize="15" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
            Bob
          </text>

          {/* ── Step title ── */}
          <text x={W / 2} y={titleY} fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle" style={noPtr}>
            {TITLES[step]}
          </text>

          {/* ── Old TX cards (state changes per step) ── */}
          {renderTxCard("alice-old-tx", aliceCardX, oldCardsY, "Alice's TX", "0.7", "Bob", "0.3", ALICE_OLD[step])}
          {renderTxCard("bob-old-tx", bobCardX, oldCardsY, "Bob's TX", "0.3", "Alice", "0.7", BOB_OLD[step])}

          {/* ── Protocol messages (cumulative, building downward) ── */}
          {MESSAGES.slice(0, numMsgs).map((msg, i) =>
            renderMsg(msg, i, msgYPositions[i], i === numMsgs - 1)
          )}

          {/* ── New TX cards ── */}
          {/* Steps 1-2: only Bob's new TX (Alice hasn't received Bob's sig yet) */}
          {step >= 1 && step < 3 &&
            renderTxCard("bob-new-tx", bobCardX, newCardsY, "Bob's TX", "0.4", "Alice", "0.6", "new")
          }
          {/* Steps 3-4: both new TXs (step 4: both become "active") */}
          {step >= 3 && (
            <g>
              {renderTxCard(
                "alice-new-tx", aliceCardX, newCardsY,
                "Alice's TX", "0.6", "Bob", "0.4",
                step === 4 ? "active" : "new",
              )}
              {renderTxCard(
                "bob-new-tx", bobCardX, newCardsY,
                "Bob's TX", "0.4", "Alice", "0.6",
                step === 4 ? "active" : "new",
              )}
            </g>
          )}

          {/* ── Caption ── */}
          <text x={W / 2} y={captionY} fontSize="11" fill={TEXT_MUTED} textAnchor="middle" style={noPtr}>
            {CAPTIONS[step][0]}
          </text>
          <text
            x={W / 2} y={captionY + 16}
            fontSize="11"
            fill={CAPTION_L2_COLORS[step]}
            fontWeight="600"
            textAnchor="middle"
            style={noPtr}
          >
            {CAPTIONS[step][1]}
          </text>

          {/* ── Simplified caveat (step 0 only) ── */}
          {step === 0 && (
            <text
              x={W / 2} y={captionY + 42}
              fontSize="9" fill={TEXT_MUTED} textAnchor="middle" fontStyle="italic" style={noPtr}
            >
              Simplified view — HTLC outputs and signatures covered later
            </text>
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
