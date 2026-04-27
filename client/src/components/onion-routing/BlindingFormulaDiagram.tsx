/**
 * BlindingFormulaDiagram -- shows the session key blinding chain as a
 * visual flow: current key -> blinding factor -> next key.
 *
 * Replaces the code blocks in 3.2-session-key-blinding.md:
 *   blinding_factor = SHA256(ephemeral_pubkey || shared_secret)
 *   next_session_private_key = current_session_private_key * blinding_factor  (mod n)
 *   next_session_public_key  = current_session_public_key  * blinding_factor
 *
 * Embed via `<blinding-formula></blinding-formula>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface BlindingFormulaDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DownArrow() {
  return (
    <div className="flex flex-col items-center py-1.5 text-muted-foreground">
      <div className="w-px h-3 bg-current opacity-40" />
      <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
        <path d="M6 8L0 0h12z" fill="currentColor" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BlindingFormulaDiagram({ className }: BlindingFormulaDiagramProps) {
  return (
    <div className={cn("my-6 space-y-0", className)}>
      {/* Step 1: Blinding factor derivation */}
      <div className="border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-amber-500" />
          <span className="font-sans font-bold text-sm text-amber-700 dark:text-amber-300">
            Derive blinding factor
          </span>
        </div>
        <p className="font-sans text-sm pl-5">
          <span className="font-semibold text-amber-700 dark:text-amber-300">blinding_factor</span>
          {" = SHA256("}
          <span className="font-semibold text-blue-700 dark:text-blue-300">ephemeral_pubkey</span>
          {" || "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">shared_secret</span>
          {")"}
        </p>
        <p className="pl-5 mt-1 font-sans text-xs text-muted-foreground">
          Concatenate the current ephemeral public key with the shared secret, then hash
        </p>
      </div>

      <DownArrow />

      {/* Step 2: Twist the session key */}
      <div className="border-2 border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-blue-500" />
          <span className="font-sans font-bold text-sm text-blue-700 dark:text-blue-300">
            Twist the session key
          </span>
        </div>
        <div className="pl-5 space-y-1.5">
          <p className="font-sans text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">next_session_private_key</span>
            {" = current_session_private_key \u00d7 "}
            <span className="font-semibold text-amber-700 dark:text-amber-300">blinding_factor</span>
            <span className="text-muted-foreground text-xs ml-1">(mod n)</span>
          </p>
          <p className="font-sans text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">next_session_public_key</span>
            {" = current_session_public_key \u00d7 "}
            <span className="font-semibold text-amber-700 dark:text-amber-300">blinding_factor</span>
          </p>
        </div>
        <p className="pl-5 mt-2 font-sans text-xs text-muted-foreground">
          Where <span className="font-semibold">n</span> is the order of the secp256k1 curve
        </p>
      </div>

      <DownArrow />

      {/* Result */}
      <div className="border-2 border-foreground/20 bg-foreground/5 px-4 py-3 text-center">
        <p className="font-sans text-sm text-muted-foreground">
          Each hop sees a <span className="font-semibold text-foreground">different ephemeral key</span>,
          but they all trace back to the same original session key
        </p>
      </div>
    </div>
  );
}
