import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { OnionPeelingDiagram } from "./OnionPeelingDiagram";

/**
 * Section 5 interactive diagram: the onion peeling animation showing
 * how Bob processes an incoming Sphinx packet, verifying the HMAC,
 * decrypting, extracting his payload, and forwarding to Carol.
 *
 * This is the mirror of Section4Diagram (wrapping). Embed this component
 * in the chapter markdown via the `<onion-peeling></onion-peeling>` custom tag.
 */
export function Section5Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <OnionPeelingDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the onion peeling process to see how Bob processes the packet and forwards it to Carol.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
