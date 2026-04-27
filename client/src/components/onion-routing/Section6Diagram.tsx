import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { MessageSequenceDiagram } from "./MessageSequenceDiagram";

/**
 * Section 6 interactive diagram: the BOLT 2 message sequence for HTLC
 * forwarding and fulfillment across Alice -> Bob -> Carol -> Dave.
 *
 * Shows a ladder/sequence diagram with step-through controls. Each step
 * represents a logical phase: the primary message (update_add_htlc or
 * update_fulfill_htlc) plus the 4-message commitment dance.
 *
 * Embed in chapter markdown via the `<message-sequence></message-sequence>` tag.
 */
export function Section6Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <MessageSequenceDiagram interactive={true} />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the HTLC forwarding sequence. Each step shows the primary
          message plus a compact commitment dance (4 messages).
        </p>
      </div>
    </PerspectiveProvider>
  );
}
