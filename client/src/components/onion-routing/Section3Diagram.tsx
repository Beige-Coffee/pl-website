import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { KeyDerivationPipelineDiagram } from "./KeyDerivationPipelineDiagram";

/**
 * Section 3 interactive diagram: the Sphinx ECDH + key derivation pipeline
 * (session key -> shared secrets -> per-hop keys) with perspective toggle
 * and step-through controls.
 *
 * Embed this component in the chapter markdown via the
 * `<key-pipeline></key-pipeline>` custom tag.
 */
export function Section3Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <KeyDerivationPipelineDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the Sphinx key derivation pipeline to see how Alice derives shared secrets and per-hop keys.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
