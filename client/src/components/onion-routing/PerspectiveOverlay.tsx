import { usePerspective } from "./PerspectiveContext";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerspectiveOverlayProps {
  /**
   * Which node(s) "own" this piece of information.
   * In node-local mode, the content is only fully visible when the current
   * node is in this list (or is a neighbor who can see it).
   *
   * Accepts a single node name or an array of node names.
   */
  visibleTo: string | string[];
  /**
   * How to obscure hidden content:
   * - "dim":  reduced opacity + grayscale + "???" overlay (default)
   * - "hide": display none
   */
  hiddenMode?: "dim" | "hide";
  children: ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerspectiveOverlay({
  visibleTo,
  hiddenMode = "dim",
  children,
  className,
}: PerspectiveOverlayProps) {
  const { view, canSee } = usePerspective();

  // Normalize visibleTo into an array
  const owners = Array.isArray(visibleTo) ? visibleTo : [visibleTo];

  // Determine visibility
  const isVisible = (() => {
    if (view.type === "omniscient") return true;

    // In node-local mode, the content is visible if the current node
    // can "see" ANY of the owners.
    const currentNode = view.node;
    return owners.some((owner) => canSee(currentNode, owner));
  })();

  // Hidden via display:none
  if (!isVisible && hiddenMode === "hide") {
    return null;
  }

  return (
    <div
      className={cn(
        "relative transition-all duration-200",
        !isVisible && hiddenMode === "dim" && "select-none",
        className,
      )}
      aria-hidden={!isVisible}
    >
      {/* Content layer */}
      <div
        className={cn(
          "transition-all duration-200",
          !isVisible && hiddenMode === "dim" && "opacity-[0.15] grayscale blur-[1px]",
        )}
      >
        {children}
      </div>

      {/* "???" overlay for dimmed content */}
      {!isVisible && hiddenMode === "dim" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-sans text-sm text-muted-foreground/60 tracking-widest select-none">
            ???
          </span>
        </div>
      )}
    </div>
  );
}
