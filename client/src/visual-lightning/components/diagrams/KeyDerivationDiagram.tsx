import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  seed: {
    title: "Seed",
    description:
      "A single 256-bit seed from which all channel keys are derived. Back up the seed, recover everything.",
  },
  master: {
    title: "Master Key",
    description:
      "The BIP32 master key derived from the seed using HMAC-SHA512.",
  },
  funding_basepoint: {
    title: "funding_basepoint",
    description:
      "Used to derive the funding pubkey for the 2-of-2 multisig. Each channel gets its own funding key.",
  },
  revocation_basepoint: {
    title: "revocation_basepoint",
    description:
      "Combined with the counterparty's per-commitment point to create revocation pubkeys. This is how the penalty mechanism gets its keys.",
  },
  payment_basepoint: {
    title: "payment_basepoint",
    description:
      "Derives the key used for to_remote outputs (the counterparty's immediately spendable balance).",
  },
  delayed_payment_basepoint: {
    title: "delayed_payment_basepoint",
    description:
      "Derives the key for to_local delayed outputs (the broadcaster's own balance, subject to CSV delay).",
  },
  htlc_basepoint: {
    title: "htlc_basepoint",
    description:
      "Derives keys used in HTLC outputs for conditional payments across the network.",
  },
  per_commitment: {
    title: "Per-Commitment Point",
    description:
      "A unique point generated for each channel state. Combined with basepoints to create state-specific keys, enabling per-state revocation.",
  },
  tweak: {
    title: "Tweaked Key Derivation",
    description:
      "Basepoint + per_commitment_point produces a tweaked key unique to this state. Different state = different tweaked key = different revocation key.",
  },
};

export function KeyDerivationDiagram() {
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
  const H = 420;
  const cx = W / 2;

  // Node positions
  const seedY = 28;
  const masterY = 72;
  const branchY = 148;
  const keyY = 188;

  // 5 key families evenly spaced
  const keys = [
    { id: "funding_basepoint", label: "funding", x: 58 },
    { id: "revocation_basepoint", label: "revocation", x: 168 },
    { id: "payment_basepoint", label: "payment", x: 288 },
    { id: "delayed_payment_basepoint", label: "delayed_payment", x: 408 },
    { id: "htlc_basepoint", label: "htlc", x: 518 },
  ];

  // Per-commitment section
  const pcY = 280;
  const tweakY = 360;

  const isHovered = (id: string) => hovered === id;
  const nodeFill = (id: string) => isHovered(id) ? "rgba(184, 134, 11, 0.08)" : "white";
  const nodeStroke = (id: string) => isHovered(id) ? "#b8860b" : "#e8dcc8";

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
          {/* ── Seed node ── */}
          <g {...hoverProps("seed")}>
            <rect
              x={cx - 50} y={seedY} width={100} height={28} rx={14}
              fill={nodeFill("seed")} stroke={nodeStroke("seed")} strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={cx} y={seedY + 18} fontSize="11" fontWeight="700"
              fill="#2a1f0d" textAnchor="middle" style={noPtr}
            >
              Seed
            </text>
          </g>

          {/* Arrow: Seed → Master */}
          <line
            x1={cx} y1={seedY + 28} x2={cx} y2={masterY}
            stroke="#e8dcc8" strokeWidth="1.5" style={noPtr}
          />
          <polygon
            points={`${cx - 4},${masterY - 4} ${cx + 4},${masterY - 4} ${cx},${masterY + 2}`}
            fill="#e8dcc8" style={noPtr}
          />
          <text
            x={cx + 8} y={(seedY + 28 + masterY) / 2 + 3}
            fontSize="7" fill="#6b5d4f" style={noPtr}
          >
            HMAC-SHA512
          </text>

          {/* ── Master Key node ── */}
          <g {...hoverProps("master")}>
            <rect
              x={cx - 60} y={masterY} width={120} height={28} rx={14}
              fill={nodeFill("master")} stroke={nodeStroke("master")} strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={cx} y={masterY + 18} fontSize="11" fontWeight="700"
              fill="#2a1f0d" textAnchor="middle" style={noPtr}
            >
              Master Key
            </text>
          </g>

          {/* ── Derivation label ── */}
          <text
            x={cx} y={masterY + 50} fontSize="9" fontWeight="700"
            fill="#2a1f0d" textAnchor="middle" letterSpacing="0.03em" style={noPtr}
          >
            KEY FAMILIES
          </text>

          {/* ── Branch lines from master to each key family ── */}
          {keys.map((k) => {
            const isKHovered = isHovered(k.id);
            return (
              <line
                key={`branch-${k.id}`}
                x1={cx} y1={masterY + 28}
                x2={k.x} y2={keyY}
                stroke={isKHovered ? "#b8860b" : "#e8dcc8"}
                strokeWidth={isKHovered ? 2 : 1}
                style={{ transition: "stroke 0.15s ease, stroke-width 0.15s ease", ...noPtr }}
              />
            );
          })}

          {/* ── Key family nodes ── */}
          {keys.map((k) => {
            const isRevocation = k.id === "revocation_basepoint";
            const pillW = k.id === "delayed_payment_basepoint" ? 110 : 90;
            const baseColor = isRevocation ? "#7c3aed" : "#b8860b";
            const hoverFill = isRevocation
              ? "rgba(139, 92, 246, 0.08)"
              : "rgba(184, 134, 11, 0.08)";

            return (
              <g key={k.id} {...hoverProps(k.id)}>
                <rect
                  x={k.x - pillW / 2} y={keyY} width={pillW} height={26} rx={6}
                  fill={isHovered(k.id) ? hoverFill : "white"}
                  stroke={isHovered(k.id) ? baseColor : "#e8dcc8"}
                  strokeWidth="1.5"
                  style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
                />
                <text
                  x={k.x} y={keyY + 16} fontSize="7.5" fontWeight="600"
                  fontFamily={mono} fill={baseColor}
                  textAnchor="middle" style={noPtr}
                >
                  {k.label}
                </text>
                <text
                  x={k.x} y={keyY + 40} fontSize="6.5" fill="#6b5d4f"
                  textAnchor="middle" style={noPtr}
                >
                  _basepoint
                </text>
              </g>
            );
          })}

          {/* ── Separator line ── */}
          <line
            x1={40} y1={pcY - 22} x2={W - 40} y2={pcY - 22}
            stroke="#e8dcc8" strokeWidth="0.5" strokeDasharray="4 3" style={noPtr}
          />

          {/* ── Per-Commitment Section ── */}
          <text
            x={cx} y={pcY} fontSize="9" fontWeight="700"
            fill="#2a1f0d" textAnchor="middle" letterSpacing="0.03em" style={noPtr}
          >
            PER-COMMITMENT DERIVATION
          </text>

          {/* Per-commitment point node */}
          <g {...hoverProps("per_commitment")}>
            <rect
              x={cx - 100} y={pcY + 12} width={200} height={28} rx={14}
              fill={isHovered("per_commitment") ? "rgba(139, 92, 246, 0.08)" : "white"}
              stroke={isHovered("per_commitment") ? "#7c3aed" : "#c4b5fd"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={cx} y={pcY + 30} fontSize="9" fontWeight="600"
              fontFamily={mono} fill="#7c3aed"
              textAnchor="middle" style={noPtr}
            >
              per_commitment_point(n)
            </text>
          </g>

          {/* Tweak formula */}
          <g {...hoverProps("tweak")}>
            {/* Plus sign between basepoint and per-commitment */}
            <text
              x={cx - 80} y={tweakY - 4} fontSize="9" fill="#6b5d4f"
              textAnchor="middle" style={noPtr}
            >
              basepoint
            </text>
            <text
              x={cx} y={tweakY - 4} fontSize="14" fontWeight="700"
              fill="#b8860b" textAnchor="middle" style={noPtr}
            >
              +
            </text>
            <text
              x={cx + 90} y={tweakY - 4} fontSize="9" fill="#7c3aed"
              textAnchor="middle" style={noPtr}
            >
              per_commitment
            </text>

            {/* Arrow down to result */}
            <line
              x1={cx} y1={tweakY + 4} x2={cx} y2={tweakY + 22}
              stroke={isHovered("tweak") ? "#b8860b" : "#e8dcc8"} strokeWidth="1.5"
              style={{ transition: "stroke 0.15s ease", ...noPtr }}
            />
            <polygon
              points={`${cx - 4},${tweakY + 18} ${cx + 4},${tweakY + 18} ${cx},${tweakY + 24}`}
              fill={isHovered("tweak") ? "#b8860b" : "#e8dcc8"}
              style={{ transition: "fill 0.15s ease", ...noPtr }}
            />

            {/* Tweaked key result */}
            <rect
              x={cx - 80} y={tweakY + 24} width={160} height={28} rx={6}
              fill={isHovered("tweak") ? "rgba(184, 134, 11, 0.08)" : "#fdf8e8"}
              stroke={isHovered("tweak") ? "#b8860b" : "#e8dcc8"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={cx} y={tweakY + 42} fontSize="9" fontWeight="600"
              fontFamily={mono} fill="#b8860b"
              textAnchor="middle" style={noPtr}
            >
              tweaked_key(n)
            </text>
          </g>

          {/* Annotation: unique per state */}
          <text
            x={cx} y={tweakY + 66} fontSize="8" fill="#6b5d4f"
            textAnchor="middle" style={noPtr}
          >
            Unique for each channel state
          </text>
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
