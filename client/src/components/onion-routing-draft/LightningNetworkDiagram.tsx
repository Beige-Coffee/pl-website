import { useMemo, useRef, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// LightningNetworkDiagram (DRAFT)
//
// Drag-to-pan + buttoned zoom view of a synthetic Lightning Network.
// Visual style matches the Noise capstone:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb).
//   - Dark borders.
//   - Gold accent (#b8860b) on highlighted route.
// ────────────────────────────────────────────────────────────────────────────

const VIEW_W = 1600;
const VIEW_H = 900;

interface NodeDef {
  id: string;
  label?: string;
  x: number;
  y: number;
  highlighted?: boolean;
  highlightOrder?: number;
}

const ROUTE: NodeDef[] = [
  { id: "alice",   label: "Alice",   x: 220, y: 460, highlighted: true, highlightOrder: 1 },
  { id: "bob",     label: "Bob",     x: 600, y: 380, highlighted: true, highlightOrder: 2 },
  { id: "charlie", label: "Charlie", x: 1000, y: 460, highlighted: true, highlightOrder: 3 },
  { id: "dave",    label: "Dave",    x: 1380, y: 380, highlighted: true, highlightOrder: 4 },
];

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
    const tooClose = ROUTE.some((r) => Math.hypot(r.x - x, r.y - y) < 120);
    if (tooClose) continue;
    const collide = nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 70);
    if (collide) continue;
    nodes.push({ id: `bg-${nodes.length}`, x, y });
  }
  return nodes;
}

interface Edge { a: string; b: string; highlighted?: boolean }

function makeEdges(allNodes: NodeDef[], rng: () => number): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    edges.push({ a: ROUTE[i].id, b: ROUTE[i + 1].id, highlighted: true });
  }
  const all = allNodes.filter((n) => n.id.startsWith("bg-") || n.highlighted);
  for (const n of all) {
    const ranked = all
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

const VIEWPORT_W = 880;
const VIEWPORT_H = 480;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

export function LightningNetworkDiagram() {
  const { nodes, edges } = useMemo(() => {
    const bg = makeBackgroundNodes(55);
    const all = [...bg, ...ROUTE];
    const e = makeEdges(all, mulberry32(13));
    return { nodes: all, edges: e };
  }, []);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Initial framing: zoom in enough that the highlighted Alice→Dave route fills
  // the viewport, and pan so the route is roughly centered. Computed once
  // from the route extent rather than hard-coded so it stays consistent if
  // ROUTE positions change.
  const ROUTE_X_MIN = Math.min(...ROUTE.map((r) => r.x)) - 80;
  const ROUTE_X_MAX = Math.max(...ROUTE.map((r) => r.x)) + 80;
  const ROUTE_Y_MIN = Math.min(...ROUTE.map((r) => r.y)) - 140;
  const ROUTE_Y_MAX = Math.max(...ROUTE.map((r) => r.y)) + 140;
  const ROUTE_WIDTH = ROUTE_X_MAX - ROUTE_X_MIN;
  const ROUTE_HEIGHT = ROUTE_Y_MAX - ROUTE_Y_MIN;
  // Pick the zoom that lets the route fill the viewport while staying within
  // [MIN_ZOOM, MAX_ZOOM]. Cap at 1.4 so the user can still zoom out a bit.
  const fitZoom = Math.min(VIEW_W / ROUTE_WIDTH, VIEW_H / ROUTE_HEIGHT);
  const INITIAL_ZOOM = Math.max(MIN_ZOOM, Math.min(1.4, fitZoom));
  const INITIAL_PAN = {
    x: Math.max(0, (ROUTE_X_MIN + ROUTE_X_MAX) / 2 - VIEW_W / INITIAL_ZOOM / 2),
    y: Math.max(0, (ROUTE_Y_MIN + ROUTE_Y_MAX) / 2 - VIEW_H / INITIAL_ZOOM / 2),
  };

  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [pan, setPan] = useState(INITIAL_PAN);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0,
  });
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current.active) return;
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    setPan({
      x: dragRef.current.startPanX - dx,
      y: dragRef.current.startPanY - dy,
    });
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current.active = false;
    setDragging(false);
  }

  const vbW = VIEW_W / zoom;
  const vbH = VIEW_H / zoom;
  // Clamp pan so we can't push the whole graph off-screen
  const maxPanX = Math.max(0, VIEW_W - vbW);
  const maxPanY = Math.max(0, VIEW_H - vbH);
  const clampedPanX = Math.max(0, Math.min(pan.x, maxPanX));
  const clampedPanY = Math.max(0, Math.min(pan.y, maxPanY));

  function zoomIn() { setZoom((z) => Math.min(MAX_ZOOM, z * 1.2)); }
  function zoomOut() { setZoom((z) => Math.max(MIN_ZOOM, z / 1.2)); }
  function reset() { setZoom(INITIAL_ZOOM); setPan(INITIAL_PAN); }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-lightning-network"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header, Noise capstone style */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Lightning Network, One Path Among Many
          </span>
        </div>
      </div>

      {/* Viewport with overlay zoom controls */}
      <div className="relative bg-[#fefdfb] dark:bg-[#0b1220]">
        <svg
          viewBox={`${clampedPanX} ${clampedPanY} ${vbW} ${vbH}`}
          width={VIEWPORT_W}
          height={VIEWPORT_H}
          className="block w-full"
          style={{
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
                strokeOpacity={e.highlighted ? 1 : 0.45}
              />
            );
          })}

          {/* Background nodes */}
          {nodes.filter((n) => !n.highlighted).map((n) => (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={6}
              fill="#cbd5e1"
              stroke="#475569"
              strokeWidth={1.2}
              opacity={0.55}
            />
          ))}

          {/* Highlighted route, canonical hop palette so the cast renders
              identically to ForwarderPolicyMap and the chapter 2 route
              diagrams. Each node carries its own color (Alice gold, Bob
              indigo, Charlie teal, Dave violet) and shows the first letter
              centered with the full name below. */}
          {nodes
            .filter((n) => n.highlighted)
            .sort((a, b) => (a.highlightOrder ?? 0) - (b.highlightOrder ?? 0))
            .map((n) => {
              const palette =
                n.id === "alice"
                  ? { stroke: "#b8860b", fill: "#fef3c7" }
                  : n.id === "bob"
                    ? { stroke: "#3b6aa0", fill: "#dbeafe" }
                    : n.id === "charlie"
                      ? { stroke: "#2d7a7a", fill: "#ccece8" }
                      : n.id === "dave"
                        ? { stroke: "#7b4b8a", fill: "#ede1f3" }
                        : { stroke: "#b8860b", fill: "#fef3c7" };
              return (
                <g key={n.id}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={32}
                    fill={palette.fill}
                    stroke={palette.stroke}
                    strokeWidth={3}
                  />
                  <text
                    x={n.x}
                    y={n.y + 6}
                    textAnchor="middle"
                    fontSize={20}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {(n.label ?? "")[0]}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 50}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {n.label}
                  </text>
                  {n.highlightOrder && (
                    <g>
                      <circle cx={n.x + 26} cy={n.y - 26} r={10} fill="#b8860b" />
                      <text
                        x={n.x + 26}
                        y={n.y - 22}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill="#fffdf5"
                      >
                        {n.highlightOrder}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <ZoomBtn onClick={zoomIn} aria-label="Zoom in">+</ZoomBtn>
          <ZoomBtn onClick={zoomOut} aria-label="Zoom out">−</ZoomBtn>
          <ZoomBtn onClick={reset} aria-label="Reset view" small>⤾</ZoomBtn>
        </div>
      </div>

      <div className="px-4 py-2 border-t-[1.5px] border-foreground/30 text-xs opacity-70 bg-card">
        Highlighted: <span className="font-semibold">Alice → Bob → Charlie → Dave</span>. Faded dots are other Lightning nodes; the lines between them are channels. Real Lightning has thousands of nodes and tens of thousands of channels.
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick, small, ...rest }: { children: React.ReactNode; onClick: () => void; small?: boolean; [k: string]: any }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center bg-black text-white border-[1.5px] border-black hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors text-base font-bold leading-none shadow"
      style={{ fontSize: small ? 14 : 18 }}
      {...rest}
    >
      {children}
    </button>
  );
}

export default LightningNetworkDiagram;
