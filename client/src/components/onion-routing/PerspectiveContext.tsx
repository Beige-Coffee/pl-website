import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeName = "alice" | "bob" | "carol" | "dave";

export type PerspectiveView =
  | { type: "omniscient" }
  | { type: "node-local"; node: NodeName };

export interface PerspectiveContextValue {
  view: PerspectiveView;
  setView: (view: PerspectiveView) => void;
  /** True when viewing the omniscient ("All") perspective. */
  isOmniscient: boolean;
  /** True when viewing a specific node's perspective. */
  isNodeLocal: (node: string) => boolean;
  /**
   * Route privacy model for Alice -> Bob -> Carol -> Dave.
   *
   * In omniscient mode: always returns true.
   * In node-local mode: returns true only if `target` is the current node
   * itself OR a direct neighbor in the canonical route.
   *
   * Neighbor map:
   *   Alice: sees Bob (next hop)
   *   Bob:   sees Alice (prev) and Carol (next)
   *   Carol: sees Bob (prev) and Dave (next)
   *   Dave:  sees Carol (prev)
   */
  canSee: (observer: string, target: string) => boolean;
}

// ---------------------------------------------------------------------------
// Route topology -- who can see whom
// ---------------------------------------------------------------------------

/** Canonical route: Alice -> Bob -> Carol -> Dave */
const ROUTE_NEIGHBORS: Record<NodeName, Set<NodeName>> = {
  alice: new Set<NodeName>(["alice", "bob"]),
  bob: new Set<NodeName>(["bob", "alice", "carol"]),
  carol: new Set<NodeName>(["carol", "bob", "dave"]),
  dave: new Set<NodeName>(["dave", "carol"]),
};

function isNodeName(value: string): value is NodeName {
  return value === "alice" || value === "bob" || value === "carol" || value === "dave";
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PerspectiveCtx = createContext<PerspectiveContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PerspectiveProviderProps {
  children: ReactNode;
  /** Optional initial view. Defaults to omniscient. */
  defaultView?: PerspectiveView;
}

export function PerspectiveProvider({
  children,
  defaultView,
}: PerspectiveProviderProps) {
  const [view, setView] = useState<PerspectiveView>(
    defaultView ?? { type: "omniscient" },
  );

  const isOmniscient = view.type === "omniscient";

  const isNodeLocal = useCallback(
    (node: string): boolean => {
      if (view.type !== "node-local") return false;
      return view.node === node;
    },
    [view],
  );

  const canSee = useCallback(
    (observer: string, target: string): boolean => {
      // Omniscient mode: everything is visible
      if (view.type === "omniscient") return true;

      // In node-local mode, use the currently-selected node as the observer
      // (the `observer` param lets callers provide context, but the active
      // perspective is what gates visibility).
      const currentNode = view.node;
      if (!isNodeName(currentNode)) return false;

      const normalizedTarget = target.toLowerCase();
      if (!isNodeName(normalizedTarget)) return false;

      return ROUTE_NEIGHBORS[currentNode].has(normalizedTarget);
    },
    [view],
  );

  const value = useMemo<PerspectiveContextValue>(
    () => ({ view, setView, isOmniscient, isNodeLocal, canSee }),
    [view, isOmniscient, isNodeLocal, canSee],
  );

  return (
    <PerspectiveCtx.Provider value={value}>
      {children}
    </PerspectiveCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePerspective(): PerspectiveContextValue {
  const ctx = useContext(PerspectiveCtx);
  if (!ctx) {
    throw new Error(
      "usePerspective must be used within a <PerspectiveProvider>",
    );
  }
  return ctx;
}
