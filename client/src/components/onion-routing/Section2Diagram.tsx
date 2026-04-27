import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { BackwardCalcDiagram } from "./BackwardCalcDiagram";

/**
 * Section 2 interactive diagram: the backward fee/CLTV waterfall
 * (Dave -> Carol -> Bob -> Alice) with perspective toggle and
 * step-through controls.
 *
 * Embed this component in the chapter markdown via the
 * `<backward-calc></backward-calc>` custom tag.
 */
export function Section2Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <BackwardCalcDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the backward calculation to see how fees and timelocks
          build up from Dave to Alice.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
