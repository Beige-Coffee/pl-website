import { usePerspective, type NodeName } from "./PerspectiveContext";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

// ---------------------------------------------------------------------------
// Node metadata -- colors and display labels
// ---------------------------------------------------------------------------

interface NodeMeta {
  label: string;
  /** Tailwind classes for the colored dot indicator */
  dotClass: string;
  /** Tailwind classes for the active/selected state background */
  activeBg: string;
  /** Tailwind classes for active text */
  activeText: string;
}

const NODE_META: Record<NodeName, NodeMeta> = {
  alice: {
    label: "Alice",
    dotClass: "bg-blue-500",
    activeBg: "bg-blue-500/15 border-blue-500/50",
    activeText: "text-blue-700 dark:text-blue-300",
  },
  bob: {
    label: "Bob",
    dotClass: "bg-green-500",
    activeBg: "bg-green-500/15 border-green-500/50",
    activeText: "text-green-700 dark:text-green-300",
  },
  charlie: {
    label: "Charlie",
    dotClass: "bg-amber-500",
    activeBg: "bg-amber-500/15 border-amber-500/50",
    activeText: "text-amber-700 dark:text-amber-300",
  },
  dave: {
    label: "Dave",
    dotClass: "bg-purple-500",
    activeBg: "bg-purple-500/15 border-purple-500/50",
    activeText: "text-purple-700 dark:text-purple-300",
  },
};

const ALL_NODES: NodeName[] = ["alice", "bob", "charlie", "dave"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PerspectiveToggleProps {
  className?: string;
  /**
   * Optionally limit which node buttons appear.
   * Values should be lowercase node names (e.g. "alice", "bob").
   * Defaults to all four nodes.
   */
  availableNodes?: string[];
  /** Compact variant for inline use -- smaller buttons, no labels on nodes. */
  compact?: boolean;
}

export function PerspectiveToggle({
  className,
  availableNodes,
  compact = false,
}: PerspectiveToggleProps) {
  const { view, setView } = usePerspective();

  const nodes: NodeName[] = availableNodes
    ? ALL_NODES.filter((n) => availableNodes.includes(n))
    : ALL_NODES;

  const isOmniscient = view.type === "omniscient";

  return (
    <div
      role="radiogroup"
      aria-label="Perspective view"
      className={cn(
        "inline-flex items-center gap-1 border-2 border-foreground p-1",
        "bg-card",
        compact ? "gap-0.5 p-0.5" : "gap-1 p-1",
        className,
      )}
    >
      {/* Omniscient "All" button */}
      <button
        role="radio"
        aria-checked={isOmniscient}
        aria-label="All nodes (omniscient view)"
        onClick={() => setView({ type: "omniscient" })}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-sans transition-all duration-150",
          "border-2 select-none",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          isOmniscient
            ? "border-foreground bg-primary text-primary-foreground pixel-shadow font-bold"
            : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Eye className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
        {!compact && <span>All</span>}
      </button>

      {/* Separator */}
      <div
        className={cn(
          "w-px self-stretch bg-foreground/20",
          compact ? "mx-0.5" : "mx-1",
        )}
      />

      {/* Node buttons */}
      {nodes.map((node) => {
        const meta = NODE_META[node];
        const isActive =
          view.type === "node-local" && view.node === node;

        return (
          <button
            key={node}
            role="radio"
            aria-checked={isActive}
            aria-label={`${meta.label}'s perspective`}
            onClick={() => setView({ type: "node-local", node })}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 font-sans transition-all duration-150",
              "border-2 select-none",
              compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
              isActive
                ? cn("font-bold pixel-shadow", meta.activeBg, meta.activeText, "border-foreground")
                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {/* Colored dot indicator */}
            <span
              className={cn(
                "inline-block shrink-0 border border-foreground/30",
                meta.dotClass,
                compact ? "h-2 w-2" : "h-2.5 w-2.5",
              )}
            />
            {!compact && <span>{meta.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
