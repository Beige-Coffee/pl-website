import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  to_local: {
    title: "to_local Output",
    description:
      "The broadcaster's own balance output. Contains an IF/ELSE script with two spending conditions.",
  },
  op_if: {
    title: "OP_IF",
    description:
      "OP_IF begins the conditional branch. If the top stack element is truthy (non-zero), execute the IF branch (revocation path).",
  },
  revocation_pubkey: {
    title: "revocation_pubkey",
    description:
      "The revocation public key, derived from both parties' key material. Only the counterparty can construct the corresponding private key (after receiving the per-commitment secret).",
  },
  op_checksig_rev: {
    title: "OP_CHECKSIG (Revocation)",
    description:
      "Verifies the signature against the revocation pubkey. If valid, the counterparty claims the funds immediately.",
  },
  op_else: {
    title: "OP_ELSE",
    description:
      "OP_ELSE begins the alternative branch. If the IF condition was not met, execute this branch (delayed path).",
  },
  local_delayed_pubkey: {
    title: "local_delayed_pubkey",
    description:
      "The broadcaster's delayed payment key, derived from their delayed_payment_basepoint and the per-commitment point.",
  },
  to_self_delay: {
    title: "to_self_delay",
    description:
      "A relative timelock value (e.g., 144 blocks, roughly 1 day). The broadcaster must wait this many blocks after confirmation before spending.",
  },
  op_csv: {
    title: "OP_CHECKSEQUENCEVERIFY",
    description:
      "OP_CHECKSEQUENCEVERIFY enforces the relative timelock. It checks that enough blocks have passed since the transaction was confirmed. If not, the script fails.",
  },
  op_checksig_delayed: {
    title: "OP_CHECKSIG (Delayed)",
    description:
      "Verifies the signature against the local delayed pubkey. Combined with the CSV check, this ensures the broadcaster waits the required delay.",
  },
  to_remote: {
    title: "to_remote Output",
    description:
      "The counterparty's balance. A simple P2WPKH-style output with no delay and no revocation path.",
  },
  remote_pubkey: {
    title: "remote_pubkey",
    description:
      "The counterparty's payment key. They can spend immediately since they didn't choose to broadcast.",
  },
};

export function CommitmentScriptDiagram() {
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
  const H = 490;
  const cx = W / 2;

  // to_local top
  const localY = 16;
  // Branch split
  const splitY = 56;
  // Left branch (revocation): x center
  const leftBranchX = 150;
  // Right branch (delayed): x center
  const rightBranchX = 420;

  // to_remote section
  const remoteY = 350;
  const remoteCx = cx;

  // Helper: opcode box
  const opcodeBox = (
    id: string,
    x: number,
    y: number,
    label: string,
    color: string,
    bgColor: string,
    w = 140,
  ) => {
    const isH = hovered === id;
    return (
      <g key={id} {...hoverProps(id)}>
        <rect
          x={x - w / 2} y={y} width={w} height={24} rx={5}
          fill={isH ? bgColor : "white"}
          stroke={isH ? color : "#e8dcc8"}
          strokeWidth={isH ? 2 : 1.5}
          style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
        />
        <text
          x={x} y={y + 15} fontSize="8.5" fontWeight="600"
          fontFamily={mono} fill={color}
          textAnchor="middle" style={noPtr}
        >
          {label}
        </text>
      </g>
    );
  };

  // Helper: arrow between two y positions at given x
  const arrow = (x: number, y1: number, y2: number, color = "#e8dcc8") => (
    <g style={noPtr}>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="1.5" />
      <polygon
        points={`${x - 3},${y2 - 4} ${x + 3},${y2 - 4} ${x},${y2 + 1}`}
        fill={color}
      />
    </g>
  );

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
          {/* ══════ TO_LOCAL SECTION ══════ */}

          {/* to_local output box */}
          <g {...hoverProps("to_local")}>
            <rect
              x={cx - 80} y={localY} width={160} height={28} rx={8}
              fill={hovered === "to_local" ? "rgba(184, 134, 11, 0.08)" : "#fdf8e8"}
              stroke={hovered === "to_local" ? "#b8860b" : "#d4a038"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={cx} y={localY + 18} fontSize="11" fontWeight="700"
              fill="#b8860b" textAnchor="middle" style={noPtr}
            >
              to_local
            </text>
          </g>

          {/* Branch lines from to_local down to IF/ELSE */}
          <line
            x1={cx} y1={localY + 28} x2={cx} y2={splitY}
            stroke="#e8dcc8" strokeWidth="1.5" style={noPtr}
          />
          <line
            x1={cx} y1={splitY} x2={leftBranchX} y2={splitY + 20}
            stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.6" style={noPtr}
          />
          <line
            x1={cx} y1={splitY} x2={rightBranchX} y2={splitY + 20}
            stroke="#b8860b" strokeWidth="1.5" strokeOpacity="0.6" style={noPtr}
          />

          {/* ── LEFT BRANCH: Revocation Path ── */}
          <text
            x={leftBranchX} y={splitY + 10} fontSize="8" fontWeight="700"
            fill="#dc2626" textAnchor="middle" letterSpacing="0.05em" style={noPtr}
          >
            REVOCATION PATH
          </text>

          {/* OP_IF */}
          {opcodeBox("op_if", leftBranchX, splitY + 20, "OP_IF", "#dc2626", "rgba(220, 38, 38, 0.06)")}

          {arrow(leftBranchX, splitY + 44, splitY + 54)}

          {/* revocation_pubkey */}
          {opcodeBox(
            "revocation_pubkey", leftBranchX, splitY + 54,
            "<revocation_pubkey>", "#7c3aed", "rgba(139, 92, 246, 0.06)", 160,
          )}

          {arrow(leftBranchX, splitY + 78, splitY + 88)}

          {/* OP_CHECKSIG */}
          {opcodeBox(
            "op_checksig_rev", leftBranchX, splitY + 88,
            "OP_CHECKSIG", "#dc2626", "rgba(220, 38, 38, 0.06)",
          )}

          {arrow(leftBranchX, splitY + 112, splitY + 122)}

          {/* Result label */}
          <rect
            x={leftBranchX - 90} y={splitY + 122} width={180} height={32} rx={6}
            fill="#fef2f2" stroke="#fca5a5" strokeWidth="1" style={noPtr}
          />
          <text
            x={leftBranchX} y={splitY + 136} fontSize="8" fontWeight="600"
            fill="#dc2626" textAnchor="middle" style={noPtr}
          >
            Counterparty spends
          </text>
          <text
            x={leftBranchX} y={splitY + 148} fontSize="8" fontWeight="600"
            fill="#dc2626" textAnchor="middle" style={noPtr}
          >
            immediately
          </text>

          {/* ── RIGHT BRANCH: Delayed Path ── */}
          <text
            x={rightBranchX} y={splitY + 10} fontSize="8" fontWeight="700"
            fill="#b8860b" textAnchor="middle" letterSpacing="0.05em" style={noPtr}
          >
            DELAYED PATH
          </text>

          {/* OP_ELSE */}
          {opcodeBox("op_else", rightBranchX, splitY + 20, "OP_ELSE", "#b8860b", "rgba(184, 134, 11, 0.06)")}

          {arrow(rightBranchX, splitY + 44, splitY + 54)}

          {/* local_delayed_pubkey */}
          {opcodeBox(
            "local_delayed_pubkey", rightBranchX, splitY + 54,
            "<local_delayed_pubkey>", "#b8860b", "rgba(184, 134, 11, 0.06)", 170,
          )}

          {arrow(rightBranchX, splitY + 78, splitY + 88)}

          {/* to_self_delay */}
          {opcodeBox(
            "to_self_delay", rightBranchX, splitY + 88,
            "<to_self_delay> (144 blocks)", "#b8860b", "rgba(184, 134, 11, 0.06)", 180,
          )}

          {arrow(rightBranchX, splitY + 112, splitY + 122)}

          {/* OP_CHECKSEQUENCEVERIFY */}
          {opcodeBox(
            "op_csv", rightBranchX, splitY + 122,
            "OP_CHECKSEQUENCEVERIFY", "#b8860b", "rgba(184, 134, 11, 0.06)", 180,
          )}

          {arrow(rightBranchX, splitY + 146, splitY + 156)}

          {/* OP_CHECKSIG */}
          {opcodeBox(
            "op_checksig_delayed", rightBranchX, splitY + 156,
            "OP_CHECKSIG", "#b8860b", "rgba(184, 134, 11, 0.06)",
          )}

          {arrow(rightBranchX, splitY + 180, splitY + 190)}

          {/* Result label */}
          <rect
            x={rightBranchX - 90} y={splitY + 190} width={180} height={32} rx={6}
            fill="#fdf8e8" stroke="#e5bd5e" strokeWidth="1" style={noPtr}
          />
          <text
            x={rightBranchX} y={splitY + 204} fontSize="8" fontWeight="600"
            fill="#b8860b" textAnchor="middle" style={noPtr}
          >
            Broadcaster spends
          </text>
          <text
            x={rightBranchX} y={splitY + 216} fontSize="8" fontWeight="600"
            fill="#b8860b" textAnchor="middle" style={noPtr}
          >
            after N blocks
          </text>

          {/* ══════ SEPARATOR ══════ */}
          <line
            x1={40} y1={remoteY - 16} x2={W - 40} y2={remoteY - 16}
            stroke="#e8dcc8" strokeWidth="0.5" strokeDasharray="4 3" style={noPtr}
          />

          {/* ══════ TO_REMOTE SECTION ══════ */}

          {/* to_remote output box */}
          <g {...hoverProps("to_remote")}>
            <rect
              x={remoteCx - 80} y={remoteY} width={160} height={28} rx={8}
              fill={hovered === "to_remote" ? "rgba(22, 163, 74, 0.06)" : "white"}
              stroke={hovered === "to_remote" ? "#16a34a" : "#86efac"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s ease, stroke 0.15s ease" }}
            />
            <text
              x={remoteCx} y={remoteY + 18} fontSize="11" fontWeight="700"
              fill="#16a34a" textAnchor="middle" style={noPtr}
            >
              to_remote
            </text>
          </g>

          {arrow(remoteCx, remoteY + 28, remoteY + 40)}

          {/* remote_pubkey */}
          {opcodeBox(
            "remote_pubkey", remoteCx, remoteY + 40,
            "<remote_pubkey>", "#16a34a", "rgba(22, 163, 74, 0.06)", 150,
          )}

          {arrow(remoteCx, remoteY + 64, remoteY + 74)}

          {/* OP_CHECKSIG */}
          <rect
            x={remoteCx - 70} y={remoteY + 74} width={140} height={24} rx={5}
            fill="white" stroke="#86efac" strokeWidth="1.5" style={noPtr}
          />
          <text
            x={remoteCx} y={remoteY + 89} fontSize="8.5" fontWeight="600"
            fontFamily={mono} fill="#16a34a"
            textAnchor="middle" style={noPtr}
          >
            OP_CHECKSIG
          </text>

          {arrow(remoteCx, remoteY + 98, remoteY + 108)}

          {/* Result label */}
          <rect
            x={remoteCx - 90} y={remoteY + 108} width={180} height={24} rx={6}
            fill="rgba(22, 163, 74, 0.06)" stroke="#86efac" strokeWidth="1" style={noPtr}
          />
          <text
            x={remoteCx} y={remoteY + 124} fontSize="8" fontWeight="600"
            fill="#16a34a" textAnchor="middle" style={noPtr}
          >
            Counterparty spends immediately
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
