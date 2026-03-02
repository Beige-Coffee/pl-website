import { useState, useRef, useCallback } from "react";
import { VLTooltip } from "../VLTooltip";

// ── Party / role colors ──
const ALICE_CLR = "#2563eb";
const CAROL_CLR = "#7c3aed";
const ROUTE_CLR = "#b8860b";
const NODE_GRAY = "#9a8b78";

// ── Course palette ──
const GOLD = "#b8860b";
const GOLD_BG = "#fdf8e8";
const BORDER = "#e8dcc8";
const TEXT_DARK = "#2a1f0d";
const TEXT_MUTED = "#6b5d4f";
const GREEN = "#16a34a";

const TOOLTIPS: Record<string, { title: string; description: string }> = {
  sender: {
    title: "Sender (Node A)",
    description:
      "Initiates the payment by finding a route and creating the first HTLC. Uses pathfinding to discover the cheapest route with enough capacity.",
  },
  recipient: {
    title: "Recipient (Node G)",
    description:
      "Generated the invoice with the payment hash. Reveals the preimage to claim the payment, triggering settlement backward along the route.",
  },
  "routing-node": {
    title: "Routing Node",
    description:
      "Forwards payments between channels and earns a small fee. The more channels and capacity a routing node has, the more useful it is to the network.",
  },
  "passive-node": {
    title: "Network Node",
    description:
      "A node connected to the network. Even if it's not on this particular route, it provides connectivity and liquidity for other payments.",
  },
  channel: {
    title: "Payment Channel",
    description:
      "A funding transaction locks sats between two nodes. Payments flow through channels instantly and off-chain, limited only by the channel's capacity.",
  },
  route: {
    title: "Payment Route",
    description:
      "The path from sender to recipient through intermediate nodes. The sender finds the best route based on fees, capacity, and reliability.",
  },
  "htlc-chain": {
    title: "HTLC Chain",
    description:
      "HTLCs are created forward along the route, each locked to the same payment hash. This ensures atomicity: all hops settle or none do.",
  },
  "preimage-flow": {
    title: "Preimage Settlement",
    description:
      "The preimage flows backward from recipient to sender. Each node uses it to claim the incoming HTLC, completing the payment.",
  },
};

// ── Node positions (organic layout) ──
interface NodeDef {
  id: string;
  x: number;
  y: number;
  color: string;
  role: "sender" | "recipient" | "routing" | "passive";
  tooltipRegion: string;
}

const NODES: NodeDef[] = [
  { id: "A", x: 56,  y: 140, color: ALICE_CLR, role: "sender",    tooltipRegion: "sender" },
  { id: "B", x: 130, y: 60,  color: NODE_GRAY,  role: "passive",   tooltipRegion: "passive-node" },
  { id: "C", x: 190, y: 150, color: ROUTE_CLR,  role: "routing",   tooltipRegion: "routing-node" },
  { id: "D", x: 160, y: 240, color: NODE_GRAY,  role: "passive",   tooltipRegion: "passive-node" },
  { id: "E", x: 370, y: 130, color: ROUTE_CLR,  role: "routing",   tooltipRegion: "routing-node" },
  { id: "F", x: 430, y: 60,  color: NODE_GRAY,  role: "passive",   tooltipRegion: "passive-node" },
  { id: "G", x: 520, y: 140, color: CAROL_CLR,  role: "recipient", tooltipRegion: "recipient" },
];

// ── Channels (edges) ──
const CHANNELS: [string, string][] = [
  ["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"],
  ["C", "E"], ["D", "E"], ["D", "F"], ["E", "F"],
  ["E", "G"], ["F", "G"],
];

// ── Route path ──
const ROUTE_PATH = ["A", "C", "E", "G"];

function getNode(id: string) {
  return NODES.find((n) => n.id === id)!;
}

export function NetworkDiagram() {
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
  const H = 340;
  const nodeR = 20;
  const DUR = "16s";

  // Check if a channel is on the route
  function isRouteEdge(a: string, b: string) {
    for (let i = 0; i < ROUTE_PATH.length - 1; i++) {
      if (
        (ROUTE_PATH[i] === a && ROUTE_PATH[i + 1] === b) ||
        (ROUTE_PATH[i] === b && ROUTE_PATH[i + 1] === a)
      ) return true;
    }
    return false;
  }

  // HTLC hop amounts
  const HTLC_AMOUNTS = ["0.1", "0.099", "0.098"];

  return (
    <div ref={containerRef} className="vl-card-3d relative select-none" style={{ maxWidth: 840, margin: "0 auto" }}>
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
            /* ── Route highlight ── */
            @keyframes net-route {
              0%, 18% { opacity: 0; }
              25% { opacity: 1; }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-route { animation: net-route ${DUR} ease-in-out infinite; }

            /* ── Sender/receiver pulse ── */
            @keyframes net-pulse-send {
              0%, 18% { r: ${nodeR}; stroke-width: 2; }
              25% { r: ${nodeR + 3}; stroke-width: 3; }
              81% { r: ${nodeR + 3}; stroke-width: 3; }
              88% { r: ${nodeR}; stroke-width: 2; }
              100% { r: ${nodeR}; stroke-width: 2; }
            }
            .net-pulse-send { animation: net-pulse-send ${DUR} ease-in-out infinite; }

            /* ── HTLC forward arrows (staggered) ── */
            @keyframes net-htlc-0 {
              0%, 31% { opacity: 0; }
              31.1% { opacity: 0; transform: translateX(-12px); }
              37% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-htlc-0 { animation: net-htlc-0 ${DUR} ease-out infinite; }
            @keyframes net-htlc-1 {
              0%, 40% { opacity: 0; }
              40.1% { opacity: 0; transform: translateX(-12px); }
              46% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-htlc-1 { animation: net-htlc-1 ${DUR} ease-out infinite; }
            @keyframes net-htlc-2 {
              0%, 49% { opacity: 0; }
              49.1% { opacity: 0; transform: translateX(-12px); }
              55% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-htlc-2 { animation: net-htlc-2 ${DUR} ease-out infinite; }

            /* ── Preimage backward arrows ── */
            @keyframes net-pre-0 {
              0%, 56% { opacity: 0; }
              56.1% { opacity: 0; transform: translateX(12px); }
              62% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-pre-0 { animation: net-pre-0 ${DUR} ease-out infinite; }
            @keyframes net-pre-1 {
              0%, 62% { opacity: 0; }
              62.1% { opacity: 0; transform: translateX(12px); }
              68% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-pre-1 { animation: net-pre-1 ${DUR} ease-out infinite; }
            @keyframes net-pre-2 {
              0%, 68% { opacity: 0; }
              68.1% { opacity: 0; transform: translateX(12px); }
              75% { opacity: 1; transform: translateX(0); }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-pre-2 { animation: net-pre-2 ${DUR} ease-out infinite; }

            /* ── Checkmarks ── */
            @keyframes net-check-g {
              0%, 56% { opacity: 0; }
              62% { opacity: 1; }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-check-g { animation: net-check-g ${DUR} ease-in-out infinite; }
            @keyframes net-check-e {
              0%, 62% { opacity: 0; }
              68% { opacity: 1; }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-check-e { animation: net-check-e ${DUR} ease-in-out infinite; }
            @keyframes net-check-c {
              0%, 68% { opacity: 0; }
              75% { opacity: 1; }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-check-c { animation: net-check-c ${DUR} ease-in-out infinite; }
            @keyframes net-check-a {
              0%, 75% { opacity: 0; }
              81% { opacity: 1; }
              81.1% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-check-a { animation: net-check-a ${DUR} ease-in-out infinite; }

            /* ── Fee labels ── */
            @keyframes net-fees {
              0%, 68% { opacity: 0; }
              75% { opacity: 1; }
              81% { opacity: 1; }
              88% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-fees { animation: net-fees ${DUR} ease-in-out infinite; }

            /* ── Summary ── */
            @keyframes net-summary {
              0%, 75% { opacity: 0; }
              81% { opacity: 1; }
              88% { opacity: 1; }
              94% { opacity: 0; }
              100% { opacity: 0; }
            }
            .net-summary { animation: net-summary ${DUR} ease-in-out infinite; }
          `}</style>

          <defs>
            <marker id="net-arr-gold" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={GOLD} />
            </marker>
            <marker id="net-arr-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={GREEN} />
            </marker>
          </defs>

          {/* Title */}
          <text x={W / 2} y="20" fontSize="13" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
            The Lightning Network
          </text>
          <text x={W / 2} y="35" fontSize="10" fill={TEXT_MUTED} textAnchor="middle">
            A mesh of payment channels connecting thousands of nodes
          </text>

          {/* ── Channel lines ── */}
          {CHANNELS.map(([a, b]) => {
            const na = getNode(a);
            const nb = getNode(b);
            const onRoute = isRouteEdge(a, b);
            return (
              <g key={`${a}-${b}`} {...hoverProps(onRoute ? "route" : "channel")}>
                <line
                  x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  stroke={hovered === "route" && onRoute ? GOLD : hovered === "channel" && !onRoute ? `${NODE_GRAY}80` : `${BORDER}`}
                  strokeWidth={onRoute ? 1.5 : 1}
                  style={{ transition: "stroke 0.15s ease" }}
                />
              </g>
            );
          })}

          {/* ── Route highlight (animated) ── */}
          {(() => {
            const routeEdges: [string, string][] = [];
            for (let i = 0; i < ROUTE_PATH.length - 1; i++) {
              routeEdges.push([ROUTE_PATH[i], ROUTE_PATH[i + 1]]);
            }
            return (
              <g className="net-route" style={noPtr}>
                {routeEdges.map(([a, b]) => {
                  const na = getNode(a);
                  const nb = getNode(b);
                  return (
                    <line
                      key={`route-${a}-${b}`}
                      x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                      stroke={GOLD} strokeWidth="3.5" strokeOpacity="0.4"
                    />
                  );
                })}
              </g>
            );
          })()}

          {/* ── Nodes ── */}
          {NODES.map((node) => {
            const isOnRoute = ROUTE_PATH.includes(node.id);
            const pulseClass = (node.role === "sender" || node.role === "recipient") ? "net-pulse-send" : "";
            return (
              <g key={node.id} {...hoverProps(node.tooltipRegion)}>
                {/* Solid white background to occlude channel lines */}
              <circle cx={node.x} cy={node.y} r={nodeR} fill="white" style={noPtr} />
              <circle
                  cx={node.x} cy={node.y} r={nodeR}
                  className={pulseClass}
                  fill={hovered === node.tooltipRegion ? `${node.color}20` : `${node.color}0a`}
                  stroke={node.color}
                  strokeWidth={isOnRoute ? 2.5 : 1.5}
                  style={{ transition: "fill 0.15s ease" }}
                />
                <text
                  x={node.x} y={node.y + 5}
                  fontSize="14" fontWeight="700" fill={node.color}
                  textAnchor="middle" style={noPtr}
                >
                  {node.id}
                </text>
                {/* Sender / Receiver labels */}
                {node.role === "sender" && (
                  <text x={node.x} y={node.y + nodeR + 16} fontSize="9" fontWeight="700" fill={node.color} textAnchor="middle" style={noPtr}>
                    Sender
                  </text>
                )}
                {node.role === "recipient" && (
                  <text x={node.x} y={node.y + nodeR + 16} fontSize="9" fontWeight="700" fill={node.color} textAnchor="middle" style={noPtr}>
                    Receiver
                  </text>
                )}
              </g>
            );
          })}

          {/* ── HTLC forward arrows ── */}
          {[0, 1, 2].map((i) => {
            const from = getNode(ROUTE_PATH[i]);
            const to = getNode(ROUTE_PATH[i + 1]);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;
            const sx = from.x + ux * (nodeR + 6);
            const sy = from.y + uy * (nodeR + 6);
            const ex = to.x - ux * (nodeR + 10);
            const ey = to.y - uy * (nodeR + 10);
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2 - 14;
            return (
              <g key={`htlc-${i}`} className={`net-htlc-${i}`} {...hoverProps("htlc-chain")}>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={GOLD} strokeWidth="2.5"
                  markerEnd="url(#net-arr-gold)"
                />
                <rect x={mx - 30} y={my - 8} width={60} height={16} rx="4" fill="white" stroke={`${GOLD}44`} strokeWidth="0.6" />
                <text x={mx} y={my + 4} fontSize="9" fontWeight="600" fill={GOLD} textAnchor="middle" fontFamily={mono} style={noPtr}>
                  {HTLC_AMOUNTS[i]}
                </text>
              </g>
            );
          })}

          {/* ── Preimage backward arrows ── */}
          {[0, 1, 2].map((i) => {
            const from = getNode(ROUTE_PATH[3 - i]);
            const to = getNode(ROUTE_PATH[2 - i]);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / len;
            const uy = dy / len;
            const sx = from.x + ux * (nodeR + 6);
            const sy = from.y + uy * (nodeR + 6);
            const ex = to.x - ux * (nodeR + 10);
            const ey = to.y - uy * (nodeR + 10);
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2 + 16;
            return (
              <g key={`pre-${i}`} className={`net-pre-${i}`} {...hoverProps("preimage-flow")}>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={GREEN} strokeWidth="2.5"
                  markerEnd="url(#net-arr-green)"
                />
                <rect x={mx - 34} y={my - 8} width={68} height={16} rx="4" fill="white" stroke={`${GREEN}66`} strokeWidth="0.6" />
                <text x={mx} y={my + 4} fontSize="9" fontWeight="600" fill={GREEN} textAnchor="middle" fontFamily={mono} style={noPtr}>
                  preimage
                </text>
              </g>
            );
          })}

          {/* ── Check marks ── */}
          <text className="net-check-g" x={getNode("G").x + nodeR + 4} y={getNode("G").y + 5} fontSize="15" fill={GREEN} style={noPtr}>&#10003;</text>
          <text className="net-check-e" x={getNode("E").x + nodeR + 4} y={getNode("E").y + 5} fontSize="15" fill={GREEN} style={noPtr}>&#10003;</text>
          <text className="net-check-c" x={getNode("C").x + nodeR + 4} y={getNode("C").y + 5} fontSize="15" fill={GREEN} style={noPtr}>&#10003;</text>
          <text className="net-check-a" x={getNode("A").x + nodeR + 4} y={getNode("A").y + 5} fontSize="15" fill={GREEN} style={noPtr}>&#10003;</text>

          {/* ── Fee labels ── */}
          <g className="net-fees" style={noPtr}>
            <rect x={getNode("C").x - 24} y={getNode("C").y + nodeR + 4} width={48} height={16} rx="4" fill={GOLD_BG} stroke={GOLD} strokeWidth="0.5" />
            <text x={getNode("C").x} y={getNode("C").y + nodeR + 16} fontSize="8.5" fontWeight="600" fill={GOLD} textAnchor="middle" fontFamily={mono}>+0.001</text>
            <rect x={getNode("E").x - 24} y={getNode("E").y + nodeR + 4} width={48} height={16} rx="4" fill={GOLD_BG} stroke={GOLD} strokeWidth="0.5" />
            <text x={getNode("E").x} y={getNode("E").y + nodeR + 16} fontSize="8.5" fontWeight="600" fill={GOLD} textAnchor="middle" fontFamily={mono}>+0.001</text>
          </g>

          {/* ── Summary ── */}
          <g className="net-summary" style={noPtr}>
            <rect x={W / 2 - 180} y={288} width={360} height={40} rx="8" fill={GOLD_BG} stroke={GOLD} strokeWidth="0.8" />
            <text x={W / 2} y={305} fontSize="10" fontWeight="700" fill={TEXT_DARK} textAnchor="middle">
              Payment settled across 3 hops
            </text>
            <text x={W / 2} y={320} fontSize="9" fill={TEXT_MUTED} textAnchor="middle">
              Instant, low-fee, trustless — backed by on-chain Bitcoin
            </text>
          </g>
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
