import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { RouteNetworkDiagram } from "./RouteNetworkDiagram";

/**
 * Section 1 interactive diagram: the canonical 4-node payment route
 * (Alice -> Bob -> Carol -> Dave) with an omniscient/node-local toggle.
 *
 * Embed this component in the chapter markdown via the
 * `<route-diagram></route-diagram>` custom tag.
 */
export function Section1Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <RouteNetworkDiagram showAmounts={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Toggle between "All" and individual nodes to see what each hop can observe.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
