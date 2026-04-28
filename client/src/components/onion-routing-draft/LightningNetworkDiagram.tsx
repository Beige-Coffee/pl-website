import { useMemo } from "react";

// ────────────────────────────────────────────────────────────────────────────
// LightningNetworkDiagram (DRAFT)
//
// Pannable view of a synthetic Lightning Network. ~55 background nodes plus
// the four highlighted route nodes (Alice → Bob → Charlie → Dave) sitting
// inside the same graph. Visual style follows the Noise capstone: neutral
// background, dark borders, sans-serif body, monochrome chrome with gold
// accents on highlighted elements.
// ────────────────────────────────────────────────────────────────────────────

const VIEW_W = 1600;
const VIEW_H = 900;

interface NodeDef {
  id: string;
  label?: string;
  x: number;
  y: number;
  highlighted?: boolean;
  highlightOrder?: number; // 1, 2, 3, 4 for Alice, Bob, Charlie, Dave
}

// Highlighted route — placed across the visible viewport (centered band).
const ROUTE: NodeDef[] = [
  { id: "alice",   label: "Alice",   x: 220, y: 460, highlighted: true, highlightOrder: 1 },
  { id: "bob",     label: "Bob",     x: 600, y: 380, highlighted: true, highlightOrder: 2 },
  { id: "charlie", label: "Charlie", x: 1000, y: 460, highlighted: true, highlightOrder: 3 },
  { id: "dave",    label: "Dave",    x: 1380, y: 380, highlighted: true, highlightOrder: 4 },
];

// Deterministic pseudo-random helper so background nodes render the same way
// every time without bringing in a seedable PRNG library.
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBackgroundNodes(count: number): NodeDef[] {
  const rng = mulberry32(7);
  const nodes: NodeDef[] = [];
  let attempts = 0;
  while (nodes.length < count && attempts < count * 10) {
    attempts++;
    const x = 60 + rng() * (VIEW_W - 120);
    const y = 60 + rng() * (VIEW_H - 120);
    // keep some distance from highlighted route so labels don't overlap
    const tooClose = ROUTE.some((r) => Math.hypot(r.x - x, r.y - y) < 120);
    if (tooClose) continue;
    // also keep some distance from other background nodes
    const collide = nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 70);
    if (collide) continue;
    nodes.push({ id: `bg-${nodes.length}`, x, y });
  }
  return nodes;
}

interface Edge {
  a: string;
  b: string;
  highlighted?: boolean;
}

function makeEdges(allNodes: NodeDef[], rng: () => number): Edge[] {
  const edges: Edge[] = [];
  // Highlight the route edges first.
  for (let i = 0; i < ROUTE.length - 1; i++) {
    edges.push({ a: ROUTE[i].id, b: ROUTE[i + 1].id, highlighted: true });
  }
  // Connect each background node to its 2-3 nearest neighbors.
  const bg = allNodes.filter((n) => n.id.startsWith("bg-") || n.highlighted);
  for (const n of bg) {
    const ranked = bg
      .filter((m) => m !== n)
      .map((m) => ({ m, d: Math.hypot(m.x - n.x, m.y - n.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2 + Math.floor(rng() * 2));
    for (const { m } of ranked) {
      const exists = edges.some(
        (e) => (e.a === n.id && e.b === m.id) || (e.a === m.id && e.b === n.id),
      );
      if (!exists) edges.push({ a: n.id, b: m.id });
    }
  }
  return edges;
}

export function LightningNetworkDiagram() {
  const { nodes, edges } = useMemo(() => {
    const bg = makeBackgroundNodes(55);
    const all = [...bg, ...ROUTE];
    const e = makeEdges(all, mulberry32(13));
    return { nodes: all, edges: e };
  }, []);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div
      className="my-8 border-2 border-foreground/30 bg-card"
      data-testid="onion-lightning-network"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="px-4 py-2 border-b-2 border-foreground/20 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider opacity-70 font-pixel">
          Lightning Network — one path among many
        </div>
        <div className="text-xs opacity-60 italic">scroll to explore</div>
      </div>

      {/* Pannable viewport */}
      <div
        className="overflow-auto bg-[#fafaf7] dark:bg-[#0b1220]"
        style={{ maxHeight: 460 }}
      >
        <svg
          width={VIEW_W}
          height={VIEW_H}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ display: "block" }}
        >
          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            return (
              <line
                key={`e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.highlighted ? "#b8860b" : "#94a3b8"}
                strokeWidth={e.highlighted ? 3 : 1}
                strokeOpacity={e.highlighted ? 1 : 0.4}
              />
            );
          })}

          {/* Background nodes */}
          {nodes
            .filter((n) => !n.highlighted)
            .map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={6}
                  fill="#cbd5e1"
                  stroke="#475569"
                  strokeWidth={1.2}
                  opacity={0.55}
                />
              </g>
            ))}

          {/* Highlighted route nodes (drawn last so they sit on top) */}
          {nodes
            .filter((n) => n.highlighted)
            .sort((a, b) => (a.highlightOrder ?? 0) - (b.highlightOrder ?? 0))
            .map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={28}
                  fill="#fffdf5"
                  stroke="#b8860b"
                  strokeWidth={3}
                />
                <text
                  x={n.x}
                  y={n.y + 5}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fill="#0f172a"
                >
                  {n.label}
                </text>
                {n.highlightOrder && (
                  <g>
                    <circle cx={n.x + 22} cy={n.y - 22} r={9} fill="#b8860b" />
                    <text
                      x={n.x + 22}
                      y={n.y - 18}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill="#fffdf5"
                    >
                      {n.highlightOrder}
                    </text>
                  </g>
                )}
              </g>
            ))}
        </svg>
      </div>

      <div className="px-4 py-2 border-t-2 border-foreground/20 text-xs opacity-70">
        Highlighted: <span className="font-semibold">Alice → Bob → Charlie → Dave</span>. Faded dots are other Lightning nodes; dashed lines are the channels between them. Real Lightning has thousands of nodes and tens of thousands of channels.
      </div>
    </div>
  );
}

export default LightningNetworkDiagram;
