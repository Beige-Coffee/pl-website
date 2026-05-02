import { useMemo, useRef, useState } from "react";
import { ChannelUpdateCard } from "./ChannelUpdateCard";

// ────────────────────────────────────────────────────────────────────────────
// ForwarderPolicyMap (DRAFT)
//
// Draggable, zoomable map of a synthetic Lightning Network. Same overall
// rendering pattern as LightningNetworkDiagram, but with three new behaviors:
//   1. Hover any node to see a floating popover of that node's channel_update
//      records (one per outgoing channel).
//   2. Three canonical routes are highlighted in their hop colors:
//        Route A — gold   — Alice → Hazel → Dave
//        Route B — teal   — Alice → Frank → Greg → Dave
//        Route C — orange — Alice → Bob → Charlie → Dave
//   3. Ambient gossip animation: every few seconds a random background node
//      "broadcasts" a channel_announcement or channel_update, the relevant
//      edge flashes gold, and a small gossip card pops up next to the node.
//
// Visual style follows the locked onion-routing visual format spec:
// black header bar, cream stage, 1.5px borders, JetBrains Mono on protocol
// values, sans-serif elsewhere.
// ────────────────────────────────────────────────────────────────────────────

const VIEW_W = 1600;
const VIEW_H = 900;

const VIEWPORT_W = 880;
const VIEWPORT_H = 520;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

const INK = "#0f172a";
const SLATE = "#475569";

// ── Canonical hop palette (must match RouteComparisonDiagram / CltvSafetyLab) ─
interface HopColor { stroke: string; fill: string }
const HOP_COLORS: Record<string, HopColor> = {
  alice:   { stroke: "#b8860b", fill: "#fef3c7" },
  bob:     { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave:    { stroke: "#7b4b8a", fill: "#ede1f3" },
  eve:     { stroke: "#5a7a2f", fill: "#eaf2db" },
  frank:   { stroke: "#a13a3a", fill: "#fde0e0" },
  greg:    { stroke: "#c4711a", fill: "#fed7aa" },
  hazel:   { stroke: "#a06080", fill: "#f5d6e3" },
};
const BG_COLOR: HopColor = { stroke: "#94a3b8", fill: "#f1f5f9" };

// Route highlight edge colors
const ROUTE_A_COLOR = "#b8860b"; // gold
const ROUTE_B_COLOR = "#2d7a7a"; // teal
const ROUTE_C_COLOR = "#a32d6b"; // magenta-rose (distinct from gold)

// ── Data ──────────────────────────────────────────────────────────────────

interface NamedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  named: true;
}
interface BgNode {
  id: string;
  x: number;
  y: number;
  named: false;
}
type AnyNode = NamedNode | BgNode;

const NAMED_NODES: NamedNode[] = [
  { id: "alice",   label: "Alice",   x: 200,  y: 460, named: true },
  { id: "hazel",   label: "Hazel",   x: 800,  y: 150, named: true },
  { id: "bob",     label: "Bob",     x: 600,  y: 320, named: true },
  { id: "charlie", label: "Charlie", x: 1000, y: 380, named: true },
  { id: "frank",   label: "Frank",   x: 600,  y: 660, named: true },
  { id: "greg",    label: "Greg",    x: 1000, y: 620, named: true },
  { id: "dave",    label: "Dave",    x: 1400, y: 460, named: true },
];

// Highlighted route edges (drawn first, beneath nodes).
const ROUTE_EDGES: { a: string; b: string; color: string; route: "A" | "B" | "C" }[] = [
  // Route A: Alice → Hazel → Dave
  { a: "alice", b: "hazel",   color: ROUTE_A_COLOR, route: "A" },
  { a: "hazel", b: "dave",    color: ROUTE_A_COLOR, route: "A" },
  // Route B: Alice → Frank → Greg → Dave
  { a: "alice", b: "frank",   color: ROUTE_B_COLOR, route: "B" },
  { a: "frank", b: "greg",    color: ROUTE_B_COLOR, route: "B" },
  { a: "greg",  b: "dave",    color: ROUTE_B_COLOR, route: "B" },
  // Route C: Alice → Bob → Charlie → Dave (the chapter-1 path)
  { a: "alice",   b: "bob",     color: ROUTE_C_COLOR, route: "C" },
  { a: "bob",     b: "charlie", color: ROUTE_C_COLOR, route: "C" },
  { a: "charlie", b: "dave",    color: ROUTE_C_COLOR, route: "C" },
];

// Channel updates from a → b (one entry per outgoing direction we care about).
// These exact values must align with the route comparison below the map.
interface ChannelUpdate {
  from: string;
  to: string;
  baseFee: number;
  feePpm: number;
  cltvDelta: number;
}

const NAMED_CHANNEL_UPDATES: ChannelUpdate[] = [
  // Hazel → Dave  (Route A's direct forwarder — punitive CLTV makes this
  // route fail Alice's max_total_cltv_expiry_delta ceiling)
  { from: "hazel",   to: "dave",    baseFee: 100, feePpm: 3000, cltvDelta: 1000 },
  // Bob → Charlie → Dave  (Route C, the chapter-1 path)
  { from: "bob",     to: "charlie", baseFee: 15,  feePpm: 2000, cltvDelta: 20 },
  { from: "charlie", to: "dave",    baseFee: 10,  feePpm: 1000, cltvDelta: 15 },
  // Frank → Greg → Dave  (Route B)
  { from: "frank",   to: "greg",    baseFee: 200, feePpm: 2000, cltvDelta: 22 },
  { from: "greg",    to: "dave",    baseFee: 200, feePpm: 2000, cltvDelta: 20 },
  // Alice's outgoing channels (she's the sender, doesn't forward — but she has
  // channels with each of her first-hop neighbors).
  { from: "alice",   to: "hazel",   baseFee: 0,   feePpm: 0,    cltvDelta: 40 },
  { from: "alice",   to: "bob",     baseFee: 0,   feePpm: 0,    cltvDelta: 40 },
  { from: "alice",   to: "frank",   baseFee: 0,   feePpm: 0,    cltvDelta: 40 },
];

// ── Seeded RNG (mulberry32, same as LightningNetworkDiagram) ───────────────
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

// Avoid placing background nodes on top of named nodes or on the highlighted
// route edges (the path strokes shouldn't read as cluttered).
function pointTooCloseToRouteEdge(x: number, y: number, allNodes: AnyNode[]): boolean {
  for (const e of ROUTE_EDGES) {
    const a = allNodes.find((n) => n.id === e.a);
    const b = allNodes.find((n) => n.id === e.b);
    if (!a || !b) continue;
    // Distance from point (x,y) to line segment (a)→(b)
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    if (Math.hypot(x - px, y - py) < 50) return true;
  }
  return false;
}

function makeBackgroundNodes(count: number): BgNode[] {
  const rng = mulberry32(11);
  const nodes: BgNode[] = [];
  let attempts = 0;
  const PADDING = 60;
  while (nodes.length < count && attempts < count * 30) {
    attempts++;
    const x = PADDING + rng() * (VIEW_W - 2 * PADDING);
    const y = PADDING + rng() * (VIEW_H - 2 * PADDING);
    // Don't sit too close to a named node (or its label)
    const tooCloseToNamed = NAMED_NODES.some(
      (n) => Math.hypot(n.x - x, n.y - y) < 95,
    );
    if (tooCloseToNamed) continue;
    // Don't sit too close to the dedicated gossip node either
    if (Math.hypot(GOSSIP_NODE_POS.x - x, GOSSIP_NODE_POS.y - y) < 95) continue;
    // Don't sit on top of a highlighted route edge
    if (pointTooCloseToRouteEdge(x, y, NAMED_NODES)) continue;
    // Don't crowd other background nodes
    const collide = nodes.some((m) => Math.hypot(m.x - x, m.y - y) < 80);
    if (collide) continue;
    nodes.push({ id: `bg-${nodes.length}`, x, y, named: false });
  }
  return nodes;
}

// Build the background edge network: each background node connects to its 1–3
// nearest neighbors (other bg + named). This gives the map the "real graph"
// density without crisscrossing the highlighted routes too aggressively.
interface BgEdge { a: string; b: string }
function makeBackgroundEdges(allNodes: AnyNode[], rng: () => number): BgEdge[] {
  const edges: BgEdge[] = [];
  const seen = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // Helper so we don't double up with the route edges.
  for (const e of ROUTE_EDGES) seen.add(key(e.a, e.b));

  for (const n of allNodes) {
    if (n.id === "alice" || n.id === "dave") continue; // keep endpoints clean
    const ranked = allNodes
      .filter((m) => m.id !== n.id)
      .map((m) => ({ m, d: Math.hypot(m.x - n.x, m.y - n.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 1 + Math.floor(rng() * 3)); // 1–3 edges
    for (const { m } of ranked) {
      const k = key(n.id, m.id);
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ a: n.id, b: m.id });
    }
  }
  return edges;
}

// Build a deterministic policy for each background outgoing channel.
function makeBgChannelUpdates(bgEdges: BgEdge[], allNodes: AnyNode[]): ChannelUpdate[] {
  const rng = mulberry32(29);
  const out: ChannelUpdate[] = [];
  // For background nodes, generate one direction per edge it participates in.
  for (const e of bgEdges) {
    // Skip pure named-named edges (those are already covered by NAMED_CHANNEL_UPDATES).
    const aNamed = NAMED_NODES.some((n) => n.id === e.a);
    const bNamed = NAMED_NODES.some((n) => n.id === e.b);
    if (aNamed && bNamed) continue;
    // If one side is a background node, that bg node advertises a channel_update
    // for its outgoing direction toward the other side.
    const bgSides: string[] = [];
    if (!aNamed) bgSides.push(e.a);
    if (!bNamed) bgSides.push(e.b);
    for (const fromId of bgSides) {
      const toId = fromId === e.a ? e.b : e.a;
      const baseFee = 1 + Math.floor(rng() * 500);
      const feePpm = Math.round((100 + rng() * 4900) / 100) * 100;
      const cltvDelta = 10 + Math.floor(rng() * 135);
      out.push({ from: fromId, to: toId, baseFee, feePpm, cltvDelta });
    }
  }
  // Sanity reference to silence unused-var warnings if allNodes parameter ever
  // gets dropped.
  void allNodes;
  return out;
}

// ── Hover popover ─────────────────────────────────────────────────────────

interface HoverState {
  nodeId: string;
  // Anchor coordinates (viewport-relative, "fixed" position)
  x: number;
  y: number;
}

const POPOVER_WIDTH = 260;

// ── Single channel_announcement (the "newcomer" gossip ambience) ──────────
//
// One specific bg node in the upper-right blinks its connection to Hazel and
// shows a small pulsing icon. Hovering the icon reveals the full announcement
// fields. This replaces the more elaborate ticker system that turned out to
// be too busy.

const GOSSIP_NODE_POS = { x: 1100, y: 220 };
const GOSSIP_PARTNER_ID = "hazel";

const GOSSIP_ANNOUNCEMENT = {
  scid: "744023x1182x0",
  node1Hex: "02a3f6...e3a1",
  node2Hex: "03c08b...92be",
  capacity: 5_000_000,
};

const GOSSIP_GOLD = "#b8860b";

export function ForwarderPolicyMap() {
  const { allNodes, namedById, bgEdges, allChannelUpdates } = useMemo(() => {
    const bg = makeBackgroundNodes(22);
    const all: AnyNode[] = [...NAMED_NODES, ...bg];
    const bgE = makeBackgroundEdges(all, mulberry32(17));
    const bgUpdates = makeBgChannelUpdates(bgE, all);
    const updates = [...NAMED_CHANNEL_UPDATES, ...bgUpdates];
    const named = new Map(NAMED_NODES.map((n) => [n.id, n]));
    return { allNodes: all, namedById: named, bgEdges: bgE, allChannelUpdates: updates };
  }, []);

  const nodeById = useMemo(
    () => new Map(allNodes.map((n) => [n.id, n])),
    [allNodes],
  );

  // Index outgoing channel_updates per node id for popover lookup.
  const outgoingByNode = useMemo(() => {
    const m = new Map<string, ChannelUpdate[]>();
    for (const u of allChannelUpdates) {
      const list = m.get(u.from) ?? [];
      list.push(u);
      m.set(u.from, list);
    }
    return m;
  }, [allChannelUpdates]);

  // Index every node's channel partners (undirected). A node may have channels
  // with counterparties even when it doesn't publish channel_updates of its
  // own — e.g. Dave is a receiver, has channels with Bob/Eve/Greg, but doesn't
  // forward, so the channels are advertised by the other side. The popover
  // uses this to explain the asymmetry instead of just saying "no channels."
  const partnersByNode = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)!.add(b);
      m.get(b)!.add(a);
    };
    for (const e of ROUTE_EDGES) add(e.a, e.b);
    for (const e of bgEdges) add(e.a, e.b);
    return m;
  }, [bgEdges]);

  // ── Initial framing: fit the named-cast extent comfortably into the viewport.
  const NAMED_X = NAMED_NODES.map((n) => n.x);
  const NAMED_Y = NAMED_NODES.map((n) => n.y);
  const ROUTE_X_MIN = Math.min(...NAMED_X) - 100;
  const ROUTE_X_MAX = Math.max(...NAMED_X) + 100;
  const ROUTE_Y_MIN = Math.min(...NAMED_Y) - 160;
  const ROUTE_Y_MAX = Math.max(...NAMED_Y) + 160;
  const ROUTE_WIDTH = ROUTE_X_MAX - ROUTE_X_MIN;
  const ROUTE_HEIGHT = ROUTE_Y_MAX - ROUTE_Y_MIN;
  const fitZoom = Math.min(VIEW_W / ROUTE_WIDTH, VIEW_H / ROUTE_HEIGHT);
  const INITIAL_ZOOM = Math.max(MIN_ZOOM, Math.min(1.2, fitZoom));
  const INITIAL_PAN = {
    x: Math.max(0, (ROUTE_X_MIN + ROUTE_X_MAX) / 2 - VIEW_W / INITIAL_ZOOM / 2),
    y: Math.max(0, (ROUTE_Y_MIN + ROUTE_Y_MAX) / 2 - VIEW_H / INITIAL_ZOOM / 2),
  };

  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [pan, setPan] = useState(INITIAL_PAN);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover state for the channel_announcement icon (separate from node hover)
  const [announcementHover, setAnnouncementHover] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const announcementGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function openAnnouncement(e: React.MouseEvent) {
    if (announcementGraceRef.current) {
      clearTimeout(announcementGraceRef.current);
      announcementGraceRef.current = null;
    }
    const padding = 12;
    const cardW = 280;
    const cardHEstimate = 180;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + cardW > window.innerWidth - padding) {
      x = Math.max(padding, e.clientX - cardW - 16);
    }
    if (y + cardHEstimate > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - cardHEstimate - padding);
    }
    setAnnouncementHover({ x, y });
  }
  function closeAnnouncement() {
    if (announcementGraceRef.current) clearTimeout(announcementGraceRef.current);
    announcementGraceRef.current = setTimeout(() => {
      setAnnouncementHover(null);
      announcementGraceRef.current = null;
    }, 120);
  }
  function cancelAnnouncementClose() {
    if (announcementGraceRef.current) {
      clearTimeout(announcementGraceRef.current);
      announcementGraceRef.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
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
    if (Math.abs(dx) + Math.abs(dy) > 2) dragRef.current.moved = true;
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
  const maxPanX = Math.max(0, VIEW_W - vbW);
  const maxPanY = Math.max(0, VIEW_H - vbH);
  const clampedPanX = Math.max(0, Math.min(pan.x, maxPanX));
  const clampedPanY = Math.max(0, Math.min(pan.y, maxPanY));

  function zoomIn() { setZoom((z) => Math.min(MAX_ZOOM, z * 1.2)); }
  function zoomOut() { setZoom((z) => Math.max(MIN_ZOOM, z / 1.2)); }
  function reset() { setZoom(INITIAL_ZOOM); setPan(INITIAL_PAN); }

  function openHover(nodeId: string, e: React.MouseEvent) {
    if (dragRef.current.moved) return; // dragging suppresses hover
    if (hoverGraceRef.current) {
      clearTimeout(hoverGraceRef.current);
      hoverGraceRef.current = null;
    }
    const padding = 12;
    const popoverHeightEstimate = 360;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + POPOVER_WIDTH > window.innerWidth - padding) {
      x = Math.max(padding, e.clientX - POPOVER_WIDTH - 16);
    }
    if (y + popoverHeightEstimate > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - popoverHeightEstimate - padding);
    }
    setHover({ nodeId, x, y });
  }
  function closeHover() {
    if (hoverGraceRef.current) clearTimeout(hoverGraceRef.current);
    hoverGraceRef.current = setTimeout(() => {
      setHover(null);
      hoverGraceRef.current = null;
    }, 120);
  }
  function cancelClose() {
    if (hoverGraceRef.current) {
      clearTimeout(hoverGraceRef.current);
      hoverGraceRef.current = null;
    }
  }

  const hoverNode = hover ? nodeById.get(hover.nodeId) : null;
  const hoverNamed = hoverNode && hoverNode.named ? hoverNode : null;
  const hoverColor: HopColor = hoverNamed
    ? HOP_COLORS[hoverNamed.id] ?? BG_COLOR
    : BG_COLOR;
  const hoverUpdates = hover ? outgoingByNode.get(hover.nodeId) ?? [] : [];
  const hoverPartnerNames = hover
    ? Array.from(partnersByNode.get(hover.nodeId) ?? [])
        .map((id) => namedById.get(id)?.label)
        .filter((label): label is string => Boolean(label))
        .sort()
    : [];

  function nameFor(id: string): string {
    const n = namedById.get(id);
    if (n) return n.label;
    return id; // bg node id, e.g. "bg-3"
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-forwarder-policy-map"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            The Forwarder Graph
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220]"
        style={{ minHeight: VIEWPORT_H }}
      >
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
          {/* 1. Background edges (drawn first, faintest) */}
          {bgEdges.map((e, i) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            return (
              <line
                key={`bg-e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeOpacity={0.85}
              />
            );
          })}

          {/* 2. Highlighted route edges (drawn over background edges) */}
          {ROUTE_EDGES.map((e, i) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            return (
              <line
                key={`route-e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.color}
                strokeWidth={3}
                strokeOpacity={1}
              />
            );
          })}

          {/* 2c. Pulsing gossip edge — newcomer node ↔ Hazel.
              Uses SMIL <animate> so the blink is pure SVG, no extra state. */}
          {(() => {
            const partner = nodeById.get(GOSSIP_PARTNER_ID);
            if (!partner) return null;
            return (
              <line
                x1={GOSSIP_NODE_POS.x}
                y1={GOSSIP_NODE_POS.y}
                x2={partner.x}
                y2={partner.y}
                stroke={GOSSIP_GOLD}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                strokeOpacity={0.85}
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.25;0.95;0.25"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </line>
            );
          })()}

          {/* 2d. The newcomer gossip node itself (drawn just before bg nodes
              so the others can still overlap nicely). */}
          <g>
            <circle
              cx={GOSSIP_NODE_POS.x}
              cy={GOSSIP_NODE_POS.y}
              r={18}
              fill={BG_COLOR.fill}
              stroke={BG_COLOR.stroke}
              strokeWidth={1.5}
            />
            {/* Soft pulsing halo */}
            <circle
              cx={GOSSIP_NODE_POS.x}
              cy={GOSSIP_NODE_POS.y}
              r={18}
              fill="none"
              stroke={GOSSIP_GOLD}
              strokeWidth={2}
              opacity={0.6}
            >
              <animate
                attributeName="r"
                values="18;30;18"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.55;0;0.55"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>

          {/* 3. Background nodes */}
          {allNodes
            .filter((n): n is BgNode => !n.named)
            .map((n) => (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => openHover(n.id, e)}
                onMouseLeave={closeHover}
                onMouseMove={(e) => {
                  if (hover && hover.nodeId === n.id) {
                    // Re-anchor the popover to follow gentle hover movement.
                    openHover(n.id, e);
                  }
                }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={18}
                  fill={BG_COLOR.fill}
                  stroke={BG_COLOR.stroke}
                  strokeWidth={1.5}
                />
              </g>
            ))}

          {/* 4. Named cast nodes (drawn last so labels read clearly) */}
          {NAMED_NODES.map((n) => {
            const c = HOP_COLORS[n.id] ?? BG_COLOR;
            return (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => openHover(n.id, e)}
                onMouseLeave={closeHover}
                onMouseMove={(e) => {
                  if (hover && hover.nodeId === n.id) openHover(n.id, e);
                }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={32}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={3}
                />
                <text
                  x={n.x}
                  y={n.y + 5}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill={INK}
                  style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                >
                  {n.label.charAt(0)}
                </text>
                <text
                  x={n.x}
                  y={n.y + 52}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill={INK}
                  style={{
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    letterSpacing: "0.05em",
                  }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}

          {/* 5. channel_announcement pill — anchored directly above the
              newcomer gossip node so the connector points at the node it's
              labeling, not at the edge midpoint. */}
          {(() => {
            const partner = nodeById.get(GOSSIP_PARTNER_ID);
            if (!partner) return null;
            const PILL_W = 340;
            const PILL_H = 56;
            // Gap between the top of the gossip node circle and the bottom
            // of the pill. Lifts the pill into the clean upper area.
            const PILL_LIFT = 90;
            const NODE_R = 18;
            const pillCenterX = GOSSIP_NODE_POS.x;
            const pillBottomY = GOSSIP_NODE_POS.y - NODE_R - PILL_LIFT;
            return (
              <>
                {/* Thin connector from pill bottom down to gossip node top */}
                <line
                  x1={pillCenterX}
                  y1={pillBottomY}
                  x2={GOSSIP_NODE_POS.x}
                  y2={GOSSIP_NODE_POS.y - NODE_R}
                  stroke={INK}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <foreignObject
                  x={pillCenterX - PILL_W / 2}
                  y={pillBottomY - PILL_H}
                  width={PILL_W}
                  height={PILL_H + 4}
                >
                <div
                  style={{
                    width: PILL_W,
                    height: PILL_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    color: INK,
                    border: `1.5px solid ${INK}`,
                    borderRadius: 999,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    cursor: "help",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                    animation: "channelAnnouncementPulse 1.6s ease-in-out infinite",
                  }}
                  onMouseEnter={(e) => openAnnouncement(e)}
                  onMouseMove={(e) => {
                    if (announcementHover) openAnnouncement(e);
                  }}
                  onMouseLeave={closeAnnouncement}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span>channel_announcement</span>
                </div>
                <style>{`
                  @keyframes channelAnnouncementPulse {
                    0%, 100% {
                      box-shadow: 0 4px 12px rgba(0,0,0,0.18),
                                  0 0 0 0 rgba(184,134,11,0.55);
                    }
                    50% {
                      box-shadow: 0 4px 12px rgba(0,0,0,0.18),
                                  0 0 0 8px rgba(184,134,11,0.0);
                    }
                  }
                `}</style>
                </foreignObject>
              </>
            );
          })()}
        </svg>

        {/* Top-left legend strip */}
        <div
          className="absolute top-3 left-3 flex flex-col gap-1 px-2 py-1.5 border-[1.5px]"
          style={{
            background: "rgba(255,253,245,0.92)",
            borderColor: INK,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color: INK,
          }}
        >
          <LegendRow color={ROUTE_A_COLOR} label="Route A · via Hazel (gold)" />
          <LegendRow color={ROUTE_B_COLOR} label="Route B · via Frank+Greg (teal)" />
          <LegendRow color={ROUTE_C_COLOR} label="Route C · via Bob+Charlie (magenta)" />
        </div>

        {/* Top-right zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <ZoomBtn onClick={zoomIn} aria-label="Zoom in">+</ZoomBtn>
          <ZoomBtn onClick={zoomOut} aria-label="Zoom out">−</ZoomBtn>
          <ZoomBtn onClick={reset} aria-label="Reset view" small>⤾</ZoomBtn>
        </div>

      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t-[1.5px] border-foreground/30 text-xs opacity-70 bg-card">
        Each named node publishes a <span className="font-semibold">channel_update</span> per outgoing channel. Hover any node to see what it's advertising. The pulsing badge in the upper-right is a fresh <span className="font-semibold">channel_announcement</span> entering the gossip layer — hover it for details.
      </div>

      {/* channel_announcement detail tooltip */}
      {announcementHover && (() => {
        const partner = namedById.get(GOSSIP_PARTNER_ID);
        const partnerName = partner?.label ?? GOSSIP_PARTNER_ID;
        return (
          <div
            className="fixed z-50"
            style={{
              left: announcementHover.x,
              top: announcementHover.y,
              width: 340,
            }}
            onMouseEnter={cancelAnnouncementClose}
            onMouseLeave={closeAnnouncement}
          >
            <div
              className="border-[1.5px]"
              style={{
                borderColor: INK,
                background: "#ffffff",
                boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              <div
                className="px-3 py-2.5 border-b-[1.5px] flex items-center"
                style={{
                  borderColor: INK,
                  background: "#ffffff",
                  color: INK,
                }}
              >
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  channel_announcement
                </span>
              </div>
              <div
                className="px-3 py-3"
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                <Row k="short_channel_id" v={GOSSIP_ANNOUNCEMENT.scid} />
                <Row
                  k="node_id_1"
                  v={`${GOSSIP_ANNOUNCEMENT.node1Hex} (newcomer)`}
                />
                <Row
                  k="node_id_2"
                  v={`${GOSSIP_ANNOUNCEMENT.node2Hex} (${partnerName})`}
                />
                <Row
                  k="capacity"
                  v={`${GOSSIP_ANNOUNCEMENT.capacity.toLocaleString()} sat`}
                />
              </div>
              <div
                className="px-3 py-2 border-t-[1.5px]"
                style={{
                  borderColor: `${INK}30`,
                  color: SLATE,
                  background: "#fafafa",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                A new node just opened a channel with {partnerName}. Once a few
                blocks confirm, it'll start propagating <code style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>channel_update</code>s to advertise its policy.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating hover popover (position: fixed, viewport-clamped) */}
      {hover && (
        <div
          className="fixed z-50"
          style={{
            left: hover.x,
            top: hover.y,
            width: POPOVER_WIDTH,
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={closeHover}
        >
          <div
            className="border-[1.5px]"
            style={{
              borderColor: INK,
              background: "#fffdf5",
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {/* Header strip — colored by hop palette */}
            <div
              className="px-2 py-1.5 border-b-[1.5px] flex items-center gap-1.5"
              style={{
                borderColor: INK,
                background: hoverColor.fill,
              }}
            >
              <div
                className="w-1.5 h-1.5"
                style={{ background: hoverColor.stroke }}
              />
              <span
                className="text-[11px] font-bold tracking-[0.05em] uppercase"
                style={{ color: INK }}
              >
                {hoverNamed ? hoverNamed.label : "Routing Node"}
              </span>
              <span
                className="text-[10px] ml-auto"
                style={{
                  color: SLATE,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                channels:
              </span>
            </div>

            {/* One ChannelUpdateCard per outgoing channel */}
            <div className="p-2 flex flex-col gap-2 max-h-[420px] overflow-y-auto">
              {hoverUpdates.length === 0 ? (
                <div
                  className="text-[11px] px-1 py-2 leading-relaxed space-y-1.5"
                  style={{ color: SLATE }}
                >
                  <p className="italic">
                    No outgoing <code className="not-italic" style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>channel_update</code>s published.
                  </p>
                  {hoverPartnerNames.length > 0 ? (
                    <p>
                      This node has channels with{" "}
                      <strong style={{ color: INK }}>
                        {hoverPartnerNames.join(", ")}
                      </strong>
                      . Each channel's forwarding policy is published by the
                      counterparty, not by this node, since this node doesn't
                      forward through them. Hover any of those nodes to see
                      their policies.
                    </p>
                  ) : (
                    <p>
                      This node hasn't advertised any forwarding policies on
                      the gossip network.
                    </p>
                  )}
                </div>
              ) : (
                hoverUpdates.map((u, i) => (
                  <div key={`${u.from}-${u.to}-${i}`}>
                    <div
                      className="text-[10px] font-bold tracking-[0.05em] uppercase pb-0.5"
                      style={{
                        color: SLATE,
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      }}
                    >
                      → {nameFor(u.to)}
                    </div>
                    <ChannelUpdateCard
                      baseFee={u.baseFee}
                      feePpm={u.feePpm}
                      cltvDelta={u.cltvDelta}
                      hopColor={hoverNamed ? hoverColor : undefined}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
      <span style={{ color: SLATE, fontWeight: 600 }}>{k}:</span>
      <span style={{ color: INK, overflow: "hidden", textOverflow: "ellipsis" }}>
        {v}
      </span>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 14,
          height: 3,
          background: color,
        }}
      />
      <span className="text-[10px] tracking-[0.05em]">{label}</span>
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

export default ForwarderPolicyMap;
