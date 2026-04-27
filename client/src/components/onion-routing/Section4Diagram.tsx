import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { OnionWrappingDiagram } from "./OnionWrappingDiagram";

/**
 * Section 4 interactive diagram: the onion wrapping animation showing
 * how Alice constructs the Sphinx packet layer by layer, from the
 * innermost hop (Dave) to the outermost hop (Bob).
 *
 * Embed this component in the chapter markdown via the
 * `<onion-wrapping></onion-wrapping>` custom tag.
 */
export function Section4Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <OnionWrappingDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the onion wrapping process to see how Alice builds the packet from Dave (innermost) to Bob (outermost).
        </p>
      </div>
    </PerspectiveProvider>
  );
}
