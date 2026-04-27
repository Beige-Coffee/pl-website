import { PerspectiveProvider } from "./PerspectiveContext";
import { PerspectiveToggle } from "./PerspectiveToggle";
import { PaymentTraceLab } from "./PaymentTraceLab";

/**
 * Section 8 interactive diagram: the Payment Trace Lab showing a complete
 * payment lifecycle step-by-step with a scrubbable timeline.
 *
 * Wraps PaymentTraceLab with PerspectiveProvider and PerspectiveToggle
 * so the user can view the trace from any node's perspective.
 *
 * Embed in chapter markdown via the `<trace-lab></trace-lab>` tag.
 */
export function Section8Diagram() {
  return (
    <PerspectiveProvider>
      <div className="my-8 space-y-4">
        <div className="flex justify-center">
          <PerspectiveToggle />
        </div>
        <PaymentTraceLab />
        <p className="text-sm text-muted-foreground text-center italic">
          Step through the complete payment lifecycle. Toggle perspectives to see
          what each node knows (or doesn't know) at every step.
        </p>
      </div>
    </PerspectiveProvider>
  );
}
