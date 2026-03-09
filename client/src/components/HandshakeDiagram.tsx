import { useState, useRef, useCallback } from "react";

interface HandshakeDiagramProps {
  theme: "light" | "dark";
  act?: "1" | "2" | "3";
}

type HoverTarget =
  | "arrow-act1"
  | "arrow-act2"
  | "arrow-act3"
  | "badge-alice-e"
  | "badge-alice-s"
  | "badge-bob-e"
  | "badge-bob-s"
  | "key-known"
  | null;

const TOOLTIPS: Record<Exclude<HoverTarget, null>, { title: string; body: string }> = {
  "arrow-act1": {
    title: "Act 1: es",
    body: "Alice sends her ephemeral public key to Bob and computes ECDH(alice_ephemeral, bob_static). This proves Alice knows Bob's identity.",
  },
  "arrow-act2": {
    title: "Act 2: ee",
    body: "Bob sends his ephemeral public key to Alice and computes ECDH(bob_ephemeral, alice_ephemeral). This establishes forward secrecy.",
  },
  "arrow-act3": {
    title: "Act 3: se",
    body: "Alice sends her encrypted static public key and computes ECDH(alice_static, bob_ephemeral). This authenticates Alice's identity.",
  },
  "badge-alice-e": {
    title: "Alice's Ephemeral Key",
    body: "A fresh key pair generated for this session only. Destroyed after the handshake completes.",
  },
  "badge-alice-s": {
    title: "Alice's Static Key",
    body: "Alice's Lightning node identity. Transmitted encrypted in Act 3 (the 'X' in XK).",
  },
  "badge-bob-e": {
    title: "Bob's Ephemeral Key",
    body: "A fresh key pair generated for this session only. Destroyed after the handshake completes.",
  },
  "badge-bob-s": {
    title: "Bob's Static Key",
    body: "Bob's Lightning node identity. Known by Alice before the handshake (the 'K' in XK).",
  },
  "key-known": {
    title: "Pre-shared Knowledge",
    body: "Alice knows Bob's static public key before the handshake begins. This is typical in Lightning, where you specify the node pubkey to connect to.",
  },
};

// Step definitions for full mode
const STEPS = [
  { label: "Overview", description: "The XK handshake: 3 acts, 3 ECDH operations" },
  { label: "Act 1: es", description: "Alice proves she knows Bob's public key" },
  { label: "Act 2: ee", description: "Both contribute fresh randomness (forward secrecy)" },
  { label: "Act 3: se", description: "Alice reveals her identity (encrypted)" },
  { label: "Complete", description: "Transport keys ready for encrypted messaging" },
];

export default function HandshakeDiagram({ theme, act }: HandshakeDiagramProps) {
  const [step, setStep] = useState(0);
  const [hovered, setHovered] = useState<HoverTarget>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const gold = isDark ? "#FFD700" : "#b8860b";
  const bg = isDark ? "#0b1220" : "#fdf9f2";
  const cardBg = isDark ? "#0f1930" : "#ffffff";
  const borderColor = isDark ? "#2a3552" : "#d4c9a8";
  const textColor = isDark ? "#e2e8f0" : "#1a1a1a";
  const mutedText = isDark ? "#94a3b8" : "#666666";
  const aliceColor = isDark ? "#3b82f6" : "#2563eb";
  const bobColor = isDark ? "#f97316" : "#ea580c";

  const handleHover = useCallback(
    (target: HoverTarget, e: React.MouseEvent<SVGElement>) => {
      setHovered(target);
      if (target && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      if (hovered && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [hovered],
  );

  const tooltip = hovered ? TOOLTIPS[hovered] : null;

  // ── Reminder (compact) mode ──
  if (act) {
    const actNum = parseInt(act);
    return (
      <div ref={containerRef} className="relative my-4 select-none" style={{ maxWidth: 640 }}>
        <svg
          viewBox="0 0 600 150"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "auto", fontFamily: "system-ui, sans-serif" }}
        >
          <rect x="0" y="0" width="600" height="150" rx="8" fill={bg} stroke={borderColor} strokeWidth="1.5" />

          {/* Alice */}
          <circle cx="60" cy="50" r="22" fill={aliceColor} opacity="0.15" stroke={aliceColor} strokeWidth="1.5" />
          <text x="60" y="55" textAnchor="middle" fontSize="11" fontWeight="700" fill={aliceColor}>Alice</text>

          {/* Bob */}
          <circle cx="540" cy="50" r="22" fill={bobColor} opacity="0.15" stroke={bobColor} strokeWidth="1.5" />
          <text x="540" y="55" textAnchor="middle" fontSize="11" fontWeight="700" fill={bobColor}>Bob</text>

          {/* Arrow definitions */}
          <defs>
            <marker id="hd-arr-r" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={mutedText} />
            </marker>
            <marker id="hd-arr-l" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
              <polygon points="8 0, 0 3, 8 6" fill={mutedText} />
            </marker>
            <marker id="hd-arr-r-gold" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={gold} />
            </marker>
            <marker id="hd-arr-l-gold" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
              <polygon points="8 0, 0 3, 8 6" fill={gold} />
            </marker>
          </defs>

          {/* Act 1 arrow (Alice -> Bob) */}
          {renderCompactArrow(1, 90, 50, 200, actNum, gold, mutedText, textColor, "hd-arr-r", "hd-arr-r-gold", handleHover, handleMouseMove, setHovered)}
          {/* Act 2 arrow (Bob -> Alice) */}
          {renderCompactArrow(2, 220, 80, 200, actNum, gold, mutedText, textColor, "hd-arr-l", "hd-arr-l-gold", handleHover, handleMouseMove, setHovered)}
          {/* Act 3 arrow (Alice -> Bob) */}
          {renderCompactArrow(3, 350, 110, 200, actNum, gold, mutedText, textColor, "hd-arr-r", "hd-arr-r-gold", handleHover, handleMouseMove, setHovered)}

          {/* "You are here" label */}
          <text x="300" y="142" textAnchor="middle" fontSize="11" fontWeight="600" fill={gold}>
            You are here: Act {act}
          </text>
        </svg>

        {tooltip && <DiagramTooltip tooltip={tooltip} pos={tooltipPos} isDark={isDark} gold={gold} />}
      </div>
    );
  }

  // ── Full (interactive step-through) mode ──
  const isStepActive = (actNum: number) => step === actNum;
  const isStepComplete = (actNum: number) => step > actNum;
  const isOverview = step === 0;
  const isComplete = step === 4;

  return (
    <div ref={containerRef} className="relative my-6 select-none" style={{ maxWidth: 700 }}>
      <svg
        viewBox="0 0 600 380"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", fontFamily: "system-ui, sans-serif" }}
      >
        <rect x="0" y="0" width="600" height="380" rx="8" fill={bg} stroke={borderColor} strokeWidth="1.5" />

        {/* Arrow markers */}
        <defs>
          <marker id="hd-full-arr-r" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={mutedText} />
          </marker>
          <marker id="hd-full-arr-l" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill={mutedText} />
          </marker>
          <marker id="hd-full-arr-r-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={gold} />
          </marker>
          <marker id="hd-full-arr-l-active" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill={gold} />
          </marker>
        </defs>

        {/* Alice column */}
        <circle cx="120" cy="40" r="26" fill={aliceColor} opacity="0.15" stroke={aliceColor} strokeWidth="1.5" />
        <text x="120" y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill={aliceColor}>Alice</text>
        <text x="120" y="60" textAnchor="middle" fontSize="9" fill={mutedText}>(initiator)</text>

        {/* Bob column */}
        <circle cx="480" cy="40" r="26" fill={bobColor} opacity="0.15" stroke={bobColor} strokeWidth="1.5" />
        <text x="480" y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill={bobColor}>Bob</text>
        <text x="480" y="60" textAnchor="middle" fontSize="9" fill={mutedText}>(responder)</text>

        {/* Dashed timelines */}
        <line x1="120" y1="70" x2="120" y2="310" stroke={isDark ? "#1e293b" : "#d4c9a8"} strokeWidth="1.5" strokeDasharray="4 4" />
        <line x1="480" y1="70" x2="480" y2="310" stroke={isDark ? "#1e293b" : "#d4c9a8"} strokeWidth="1.5" strokeDasharray="4 4" />

        {/* "Known" dashed curve (Alice knows Bob's pubkey) */}
        {(isOverview || step === 1) && (
          <g
            onMouseEnter={(e) => handleHover("key-known", e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <path
              d="M 145 38 C 260 -20, 360 -20, 455 38"
              fill="none"
              stroke={gold}
              strokeWidth="1.5"
              strokeDasharray="5 3"
              opacity={isOverview ? 0.6 : 0.8}
            />
            <text x="300" y="8" textAnchor="middle" fontSize="9" fill={gold} opacity={isOverview ? 0.6 : 0.9}>
              Alice knows Bob&apos;s pubkey (K)
            </text>
          </g>
        )}

        {/* Act 1 arrow: Alice -> Bob, y=100 */}
        {renderFullArrow({
          actNum: 1, y: 105, label: "Act 1: es", ecdh: "ECDH(e, s)",
          direction: "right", isActive: isStepActive(1), isComplete: isStepComplete(1),
          isOverview, isAllComplete: isComplete,
          gold, mutedText, textColor, cardBg, borderColor, isDark,
          aliceKey: "e", bobKey: "s", aliceColor, bobColor,
          handleHover, handleMouseMove, setHovered,
        })}

        {/* Act 2 arrow: Bob -> Alice, y=170 */}
        {renderFullArrow({
          actNum: 2, y: 175, label: "Act 2: ee", ecdh: "ECDH(e, e)",
          direction: "left", isActive: isStepActive(2), isComplete: isStepComplete(2),
          isOverview, isAllComplete: isComplete,
          gold, mutedText, textColor, cardBg, borderColor, isDark,
          aliceKey: "e", bobKey: "e", aliceColor, bobColor,
          handleHover, handleMouseMove, setHovered,
        })}

        {/* Act 3 arrow: Alice -> Bob, y=240 */}
        {renderFullArrow({
          actNum: 3, y: 245, label: "Act 3: se", ecdh: "ECDH(s, e)",
          direction: "right", isActive: isStepActive(3), isComplete: isStepComplete(3),
          isOverview, isAllComplete: isComplete,
          gold, mutedText, textColor, cardBg, borderColor, isDark,
          aliceKey: "s", bobKey: "e", aliceColor, bobColor,
          handleHover, handleMouseMove, setHovered,
        })}

        {/* Detail card (below arrows) */}
        {step >= 1 && step <= 3 && (
          <g>
            <rect
              x="160" y="290" width="280" height="50" rx="6"
              fill={cardBg} stroke={gold} strokeWidth="1.5"
            />
            <text x="300" y="310" textAnchor="middle" fontSize="11" fontWeight="600" fill={gold}>
              {STEPS[step].label}
            </text>
            <text x="300" y="328" textAnchor="middle" fontSize="10" fill={mutedText}>
              {STEPS[step].description}
            </text>
          </g>
        )}

        {/* Complete state */}
        {isComplete && (
          <g>
            <rect
              x="160" y="290" width="280" height="50" rx="6"
              fill={cardBg} stroke={isDark ? "#22c55e" : "#16a34a"} strokeWidth="1.5"
            />
            <text x="282" y="312" textAnchor="middle" fontSize="13" fill={isDark ? "#22c55e" : "#16a34a"}>
              {"🔒"}
            </text>
            <text x="318" y="312" textAnchor="middle" fontSize="12" fontWeight="700" fill={isDark ? "#22c55e" : "#16a34a"}>
              Transport Keys Ready
            </text>
            <text x="300" y="330" textAnchor="middle" fontSize="10" fill={mutedText}>
              Encrypted messaging can begin
            </text>
          </g>
        )}

        {/* Overview description */}
        {isOverview && (
          <g>
            <rect
              x="160" y="290" width="280" height="50" rx="6"
              fill={cardBg} stroke={borderColor} strokeWidth="1.5"
            />
            <text x="300" y="310" textAnchor="middle" fontSize="11" fontWeight="600" fill={textColor}>
              XK Handshake Pattern
            </text>
            <text x="300" y="328" textAnchor="middle" fontSize="10" fill={mutedText}>
              Step through to explore each act
            </text>
          </g>
        )}

        {/* Step counter */}
        <text x="300" y="370" textAnchor="middle" fontSize="10" fill={mutedText}>
          {step + 1} / {STEPS.length}
        </text>
      </svg>

      {/* Stepper controls */}
      <div
        className="flex items-center justify-center gap-4 mt-3"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: `1.5px solid ${step === 0 ? (isDark ? "#1e293b" : "#e5e5e5") : gold}`,
            backgroundColor: isDark ? "#0f1930" : "#fff",
            color: step === 0 ? mutedText : gold,
            cursor: step === 0 ? "default" : "pointer",
            opacity: step === 0 ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          Back
        </button>

        {/* Step dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: `1.5px solid ${i === step ? gold : (isDark ? "#2a3552" : "#d4c9a8")}`,
                backgroundColor: i === step ? gold : "transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                padding: 0,
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
          disabled={step === STEPS.length - 1}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: `1.5px solid ${step === STEPS.length - 1 ? (isDark ? "#1e293b" : "#e5e5e5") : gold}`,
            backgroundColor: step === STEPS.length - 1 ? (isDark ? "#0f1930" : "#fff") : gold,
            color: step === STEPS.length - 1 ? mutedText : (isDark ? "#0b1220" : "#fff"),
            cursor: step === STEPS.length - 1 ? "default" : "pointer",
            opacity: step === STEPS.length - 1 ? 0.5 : 1,
            transition: "all 0.15s ease",
          }}
        >
          Next
        </button>
      </div>

      {tooltip && <DiagramTooltip tooltip={tooltip} pos={tooltipPos} isDark={isDark} gold={gold} />}
    </div>
  );
}

// ── Tooltip component ──
function DiagramTooltip({
  tooltip,
  pos,
  isDark,
  gold,
}: {
  tooltip: { title: string; body: string };
  pos: { x: number; y: number };
  isDark: boolean;
  gold: string;
}) {
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: Math.min(Math.max(pos.x, 120), 580),
        top: pos.y - 16,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        style={{
          border: `2px solid ${gold}`,
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: isDark ? "#0f1930" : "#fff",
          boxShadow: isDark
            ? "3px 3px 0 rgba(255, 215, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.5)"
            : "3px 3px 0 rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.12)",
          minWidth: 220,
          maxWidth: 320,
        }}
      >
        <div
          style={{
            backgroundColor: isDark ? "#0b1220" : "#f5f0e8",
            borderBottom: `1px solid ${isDark ? "#2a3552" : "#d4c9a8"}`,
            padding: "8px 14px",
          }}
        >
          <span style={{ color: gold, fontSize: 11, letterSpacing: 1, fontFamily: "'Press Start 2P', monospace" }}>
            {tooltip.title}
          </span>
        </div>
        <div style={{ padding: "10px 14px", fontSize: 13, lineHeight: 1.5, color: isDark ? "#e2e8f0" : "#333" }}>
          {tooltip.body}
        </div>
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          margin: "0 auto",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `8px solid ${gold}`,
        }}
      />
    </div>
  );
}

// ── Compact arrow for reminder mode ──
function renderCompactArrow(
  actNum: number,
  x: number,
  y: number,
  width: number,
  highlightAct: number,
  gold: string,
  mutedText: string,
  textColor: string,
  markerDefault: string,
  markerGold: string,
  handleHover: (target: HoverTarget, e: React.MouseEvent<SVGElement>) => void,
  handleMouseMove: (e: React.MouseEvent<SVGElement>) => void,
  setHovered: (target: HoverTarget) => void,
) {
  const isCurrent = actNum === highlightAct;
  const isCompleted = actNum < highlightAct;
  const isFuture = actNum > highlightAct;
  const opacity = isFuture ? 0.3 : 1;
  const color = isCurrent ? gold : mutedText;
  const strokeW = isCurrent ? 2.5 : 1.5;
  const marker = isCurrent ? markerGold : markerDefault;
  const isLeft = actNum === 2;
  const labels = ["Act 1: es", "Act 2: ee", "Act 3: se"];
  const label = labels[actNum - 1];
  const hoverTarget = `arrow-act${actNum}` as HoverTarget;

  return (
    <g
      opacity={opacity}
      style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
      onMouseEnter={(e) => handleHover(hoverTarget, e)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      <line
        x1={isLeft ? x + width : x}
        y1={y}
        x2={isLeft ? x : x + width}
        y2={y}
        stroke={color}
        strokeWidth={strokeW}
        markerEnd={`url(#${marker})`}
        style={{ transition: "stroke 0.15s ease" }}
      />
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fontSize="10"
        fontWeight={isCurrent ? "700" : "500"}
        fill={isCurrent ? gold : textColor}
      >
        {label}
      </text>
      {isCompleted && (
        <text x={x + width / 2 + 42} y={y - 5} textAnchor="middle" fontSize="12" fill="#22c55e">
          {"✓"}
        </text>
      )}
    </g>
  );
}

// ── Full arrow for step-through mode ──
function renderFullArrow({
  actNum, y, label, ecdh, direction,
  isActive, isComplete, isOverview, isAllComplete,
  gold, mutedText, textColor, cardBg, borderColor, isDark,
  aliceKey, bobKey, aliceColor, bobColor,
  handleHover, handleMouseMove, setHovered,
}: {
  actNum: number; y: number; label: string; ecdh: string; direction: "left" | "right";
  isActive: boolean; isComplete: boolean; isOverview: boolean; isAllComplete: boolean;
  gold: string; mutedText: string; textColor: string; cardBg: string; borderColor: string; isDark: boolean;
  aliceKey: "e" | "s"; bobKey: "e" | "s"; aliceColor: string; bobColor: string;
  handleHover: (target: HoverTarget, e: React.MouseEvent<SVGElement>) => void;
  handleMouseMove: (e: React.MouseEvent<SVGElement>) => void;
  setHovered: (target: HoverTarget) => void;
}) {
  const arrowX1 = direction === "right" ? 145 : 455;
  const arrowX2 = direction === "right" ? 455 : 145;
  const color = isActive ? gold : (isComplete || isAllComplete ? (isDark ? "#22c55e" : "#16a34a") : mutedText);
  const strokeW = isActive ? 2.5 : 1.5;
  const opacity = (!isActive && !isComplete && !isOverview && !isAllComplete) ? 0.25 : 1;
  const markerR = isActive ? "hd-full-arr-r-active" : "hd-full-arr-r";
  const markerL = isActive ? "hd-full-arr-l-active" : "hd-full-arr-l";
  const marker = direction === "right" ? markerR : markerL;
  const hoverTarget = `arrow-act${actNum}` as HoverTarget;

  const aliceBadgeTarget = `badge-alice-${aliceKey}` as HoverTarget;
  const bobBadgeTarget = `badge-bob-${bobKey}` as HoverTarget;

  return (
    <g opacity={opacity} style={{ transition: "opacity 0.2s ease" }}>
      {/* Arrow line */}
      <g
        style={{ cursor: "pointer" }}
        onMouseEnter={(e) => handleHover(hoverTarget, e)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Invisible wider hit area */}
        <line x1={arrowX1} y1={y} x2={arrowX2} y2={y} stroke="transparent" strokeWidth="16" />
        <line
          x1={arrowX1} y1={y} x2={arrowX2} y2={y}
          stroke={color} strokeWidth={strokeW}
          markerEnd={`url(#${marker})`}
          style={{ transition: "stroke 0.15s ease" }}
        />
      </g>

      {/* Label above arrow */}
      <text
        x="300" y={y - 10}
        textAnchor="middle"
        fontSize="11"
        fontWeight={isActive ? "700" : "500"}
        fill={isActive ? gold : textColor}
        style={{ transition: "fill 0.15s ease" }}
      >
        {label}
      </text>

      {/* ECDH notation below arrow */}
      {isActive && (
        <text x="300" y={y + 16} textAnchor="middle" fontSize="10" fontFamily="monospace" fill={gold} opacity="0.8">
          {ecdh}
        </text>
      )}

      {/* Checkmark for completed acts */}
      {isComplete && !isAllComplete && (
        <text x="310" y={y + 16} textAnchor="middle" fontSize="11" fill={isDark ? "#22c55e" : "#16a34a"}>
          {"✓ complete"}
        </text>
      )}

      {/* Key badges on Alice side */}
      {isActive && (
        <g
          style={{ cursor: "pointer" }}
          onMouseEnter={(e) => handleHover(aliceBadgeTarget, e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <rect
            x="93" y={y - 12} width="24" height="18" rx="4"
            fill={cardBg} stroke={aliceColor} strokeWidth="1.5"
          />
          <text x="105" y={y + 1} textAnchor="middle" fontSize="10" fontWeight="700" fill={aliceColor}>
            {aliceKey}
          </text>
        </g>
      )}

      {/* Key badges on Bob side */}
      {isActive && (
        <g
          style={{ cursor: "pointer" }}
          onMouseEnter={(e) => handleHover(bobBadgeTarget, e)}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <rect
            x="483" y={y - 12} width="24" height="18" rx="4"
            fill={cardBg} stroke={bobColor} strokeWidth="1.5"
          />
          <text x="495" y={y + 1} textAnchor="middle" fontSize="10" fontWeight="700" fill={bobColor}>
            {bobKey}
          </text>
        </g>
      )}
    </g>
  );
}
