import { useState } from "react";
import { useReadableInDark } from "./useReadableInDark";
import {
  ComputedRouteDiagram,
  type ComputedRouteDiagramProps,
} from "./ComputedRouteDiagram";
import { RouteCalcExercise } from "./RouteCalcExercise";

// ────────────────────────────────────────────────────────────────────────────
// RouteComparisonDiagram (DRAFT)
//
// Tabbed wrapper around the route diagrams. One outer container with the
// locked visual format (black header bar with gold dot, cream stage). Below
// the header, a tab strip lets students flip between the three routes:
//
//   Tab A → ComputedRouteDiagram (Route A · direct via Bob)
//   Tab B → ComputedRouteDiagram (Route B · via Frank and Greg)
//   Tab C → RouteCalcExercise (fillable Route C, the chapter-1 path)
//
// The inner diagrams are rendered with `headerless={true}` so the outer
// wrapper provides the only black header bar in the visual.
// ────────────────────────────────────────────────────────────────────────────

const HOP_PALETTE = {
  alice:   { stroke: "#b8860b", fill: "#fef3c7" },
  bob:     { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave:    { stroke: "#7b4b8a", fill: "#ede1f3" },
  frank:   { stroke: "#a13a3a", fill: "#fde0e0" },
  greg:    { stroke: "#c4711a", fill: "#fed7aa" },
  hazel:   { stroke: "#a06080", fill: "#f5d6e3" },
} as const;

const ROUTE_A: ComputedRouteDiagramProps = {
  title: "Route A · direct via Hazel",
  subtitle: "900 sat fee (the cheapest of the three), but a 1,018-block CLTV delta exceeds Alice's 200-block ceiling",
  invoice: { amount: 400_000, minFinalCltvDelta: 18, paymentHash: "566..c62" },
  hops: [
    { id: "alice", name: "Alice", role: "sender",    color: HOP_PALETTE.alice },
    { id: "hazel", name: "Hazel", role: "forwarder", color: HOP_PALETTE.hazel },
    { id: "dave",  name: "Dave",  role: "receiver",  color: HOP_PALETTE.dave  },
  ],
  channelUpdates: [
    { atForwarderIndex: 0, baseFee: 100, feePpm: 2000, cltvDelta: 1000 },
  ],
  htlcAmounts:  [400_900, 400_000],
  htlcTimeouts: [1168, 168],
  feeCalculations: [
    {
      forwarderName: "Hazel",
      baseFee: 100,
      feePpm: 2000,
      amount: 400_000,
      calculation: "(2,000 / 1,000,000) × 400,000 = 800",
      total: 900,
    },
  ],
  timeoutCalculations: [
    { label: "HTLC Timeout (Alice → Hazel)", calculation: "150 + 18 + 1000", total: 1168 },
    { label: "HTLC Timeout (Hazel → Dave)",  calculation: "150 + 18",        total: 168 },
  ],
  walkthrough: {
    verdict:
      "So Route A is the cheapest, just 900 sats. But look at that timeout: Hazel's cushion is a whopping 1,000 blocks, so Alice's HTLC would be locked up for over a thousand blocks. That blows right past her max_total_cltv_expiry_delta of 200. Cheapest fee, but Alice simply can't use it.",
  },
};

const ROUTE_B: ComputedRouteDiagramProps = {
  title: "Route B · via Frank and Greg",
  subtitle: "2,002 sat total fee · 2 forwarders",
  invoice: { amount: 400_000, minFinalCltvDelta: 18, paymentHash: "566..c62" },
  hops: [
    { id: "alice", name: "Alice", role: "sender",    color: HOP_PALETTE.alice },
    { id: "frank", name: "Frank", role: "forwarder", color: HOP_PALETTE.frank },
    { id: "greg",  name: "Greg",  role: "forwarder", color: HOP_PALETTE.greg  },
    { id: "dave",  name: "Dave",  role: "receiver",  color: HOP_PALETTE.dave  },
  ],
  channelUpdates: [
    { atForwarderIndex: 0, baseFee: 200, feePpm: 2000, cltvDelta: 22 },
    { atForwarderIndex: 1, baseFee: 200, feePpm: 2000, cltvDelta: 20 },
  ],
  htlcAmounts:  [402_002, 401_000, 400_000],
  htlcTimeouts: [210, 188, 168],
  feeCalculations: [
    {
      forwarderName: "Frank",
      baseFee: 200,
      feePpm: 2000,
      amount: 401_000,
      calculation: "(2,000 / 1,000,000) × 401,000 = 802",
      total: 1_002,
    },
    {
      forwarderName: "Greg",
      baseFee: 200,
      feePpm: 2000,
      amount: 400_000,
      calculation: "(2,000 / 1,000,000) × 400,000 = 800",
      total: 1_000,
    },
  ],
  timeoutCalculations: [
    { label: "HTLC Timeout (Alice → Frank)", calculation: "150 + 18 + 20 + 22", total: 210 },
    { label: "HTLC Timeout (Frank → Greg)",  calculation: "150 + 18 + 20",      total: 188 },
    { label: "HTLC Timeout (Greg → Dave)",   calculation: "150 + 18",           total: 168 },
  ],
  walkthrough: {
    verdict:
      "Route B costs more, 2,002 sats across two forwarders. But every cltv_expiry_delta here is small, so the total timeout stays comfortably under Alice's 200-block ceiling. Not the cheapest, but the one Alice can actually route through.",
  },
};

type Tab = "a" | "b" | "c";

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 px-3 py-2 text-xs uppercase font-bold border-r-[1.5px] last:border-r-0 transition-colors"
      style={{
        letterSpacing: "0.06em",
        borderRightColor: "rgba(15,23,42,0.2)",
        borderBottom: active ? "3px solid #b8860b" : "3px solid transparent",
        background: active ? "#fef3c7" : "#fffdf5",
        color: "#0f172a",
        cursor: active ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(254,243,199,0.5)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "#fffdf5";
        }
      }}
    >
      {label}
    </button>
  );
}

export function RouteComparisonDiagram() {
  const [tab, setTab] = useState<Tab>("a");

  const rootRef = useReadableInDark();
  return (
    <div
      ref={rootRef}
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="route-comparison-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header bar */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Route Comparison
          </span>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex border-b-[1.5px] border-foreground/30 bg-card">
        <TabButton
          label="Route A · via Hazel"
          active={tab === "a"}
          onClick={() => setTab("a")}
        />
        <TabButton
          label="Route B · via Frank and Greg"
          active={tab === "b"}
          onClick={() => setTab("b")}
        />
        <TabButton
          label="Route C · the chapter 1 path"
          active={tab === "c"}
          onClick={() => setTab("c")}
        />
      </div>

      {/* Content area */}
      <div>
        {tab === "a" && <ComputedRouteDiagram {...ROUTE_A} headerless />}
        {tab === "b" && <ComputedRouteDiagram {...ROUTE_B} headerless />}
        {tab === "c" && <RouteCalcExercise headerless />}
      </div>
    </div>
  );
}

export default RouteComparisonDiagram;
