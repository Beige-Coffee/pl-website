import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { ErrorBoomerangDiagram } from "./ErrorBoomerangDiagram";

/**
 * Section 7 interactive diagram: the error boomerang showing how an error
 * packet propagates backward through the route after Carol fails to forward
 * to Dave.
 *
 * Shows a horizontal layout with 4 nodes, forward arrows, then backward
 * error arrows with the error packet gaining ammag layers at each hop.
 * Alice unwraps all layers and identifies Carol as the failing hop.
 *
 * Embed in chapter markdown via the `<error-boomerang></error-boomerang>` tag.
 */
export function Section7Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <ErrorBoomerangDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the error propagation. Each backward hop adds an ammag
          layer. Only Alice can peel them all to identify the failing hop.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
