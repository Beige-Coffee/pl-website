/**
 * LayerCakeDiagram -- The 4-layer Lightning network stack, showing how
 * Application, Routing (BOLT 4), Transport (BOLT 8), and Network layers
 * relate to each other. Replaces the ASCII art in 9.3-bolt8-bridge.md.
 *
 * Embed via `<layer-cake></layer-cake>` custom tag.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayerCakeDiagramProps {
  className?: string;
}

interface Layer {
  name: string;
  protocol: string;
  description: string;
  scope?: string;
  /** Tailwind color classes */
  border: string;
  bg: string;
  accent: string;
  scopeColor: string;
}

// ---------------------------------------------------------------------------
// Layer definitions (top to bottom)
// ---------------------------------------------------------------------------

const LAYERS: Layer[] = [
  {
    name: "Application",
    protocol: "",
    description: "HTLC messages, channel state updates",
    border: "border-purple-500/40 dark:border-purple-400/30",
    bg: "bg-purple-500/8 dark:bg-purple-500/10",
    accent: "text-purple-600 dark:text-purple-400",
    scopeColor: "text-purple-500/50 dark:text-purple-400/40",
  },
  {
    name: "Routing",
    protocol: "Sphinx onion (BOLT 4)",
    description: "End-to-end encryption",
    scope: "Full route",
    border: "border-amber-500/40 dark:border-amber-400/30",
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    accent: "text-amber-600 dark:text-amber-400",
    scopeColor: "text-amber-500/50 dark:text-amber-400/40",
  },
  {
    name: "Transport",
    protocol: "Noise Protocol (BOLT 8)",
    description: "Point-to-point encryption",
    scope: "Single link",
    border: "border-blue-500/40 dark:border-blue-400/30",
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    accent: "text-blue-600 dark:text-blue-400",
    scopeColor: "text-blue-500/50 dark:text-blue-400/40",
  },
  {
    name: "Network",
    protocol: "TCP/IP",
    description: "",
    border: "border-gray-400/40 dark:border-gray-500/30",
    bg: "bg-gray-500/5 dark:bg-gray-500/8",
    accent: "text-gray-600 dark:text-gray-400",
    scopeColor: "text-gray-500/50 dark:text-gray-400/40",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LayerCakeDiagram({ className }: LayerCakeDiagramProps) {
  return (
    <div className={cn("w-full my-8 flex justify-center", className)}>
      <div className="w-full max-w-lg">
        <div className="space-y-0">
          {LAYERS.map((layer, i) => (
            <div
              key={layer.name}
              className={cn(
                "border-2 px-4 py-3 font-sans flex items-start justify-between gap-3",
                layer.border,
                layer.bg,
                // Remove top border on all but the first to avoid double borders
                i > 0 && "-mt-[2px]",
              )}
            >
              {/* Left side: layer name + description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={cn("text-sm font-bold", layer.accent)}>
                    {layer.name}
                  </span>
                  {layer.protocol && (
                    <span className={cn("text-xs", layer.scopeColor)}>
                      {layer.protocol}
                    </span>
                  )}
                </div>
                {layer.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {layer.description}
                  </div>
                )}
              </div>

              {/* Right side: scope annotation */}
              {layer.scope && (
                <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                  <div
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 border",
                      layer.border,
                      layer.scopeColor,
                    )}
                  >
                    {layer.scope}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center italic mt-4 font-sans">
          Each layer has a distinct job and scope. Noise encrypts between two peers;
          Sphinx encrypts across the full route.
        </p>
      </div>
    </div>
  );
}
