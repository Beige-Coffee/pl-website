/**
 * EcdhFormulaDiagram -- shows the two parallel ECDH computations that
 * Alice and Bob each perform to arrive at the same shared secret.
 *
 * Replaces the code blocks in 3.0-shared-secrets.md:
 *   shared_secret_bob = SHA256( session_private_key * Bob_public_key )
 *   shared_secret_bob = SHA256( bob_private_key * session_public_key )
 *
 * Rendered as two side-by-side cards: Alice's computation on the left,
 * Bob's on the right, with color-coded private/public key parts and an
 * equals sign in the middle.
 *
 * Embed via `<ecdh-formula></ecdh-formula>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface EcdhFormulaDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EcdhFormulaDiagram({ className }: EcdhFormulaDiagramProps) {
  return (
    <div className={cn("my-6", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-2 items-stretch">
        {/* Alice's computation */}
        <div className="border-2 border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-blue-500" />
            <span className="font-sans font-bold text-sm text-blue-700 dark:text-blue-300">
              Alice computes
            </span>
          </div>
          <div className="space-y-1">
            <p className="font-sans text-sm">
              shared_secret =
            </p>
            <p className="font-sans text-sm pl-3">
              SHA256(
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                session_private_key
              </span>
              {" * "}
              <span className="font-semibold text-green-700 dark:text-green-300">
                Bob_public_key
              </span>
              )
            </p>
          </div>
          <p className="mt-2 font-sans text-xs text-muted-foreground">
            Alice uses her <span className="text-blue-700 dark:text-blue-300 font-semibold">private</span> session key
            and Bob's <span className="text-green-700 dark:text-green-300 font-semibold">public</span> key
          </p>
        </div>

        {/* Equals sign (centered vertically) */}
        <div className="hidden sm:flex items-center justify-center px-2">
          <span className="font-sans font-bold text-lg text-muted-foreground">=</span>
        </div>
        <div className="flex sm:hidden items-center justify-center">
          <span className="font-sans font-bold text-sm text-muted-foreground">
            same result
          </span>
        </div>

        {/* Bob's computation */}
        <div className="border-2 border-green-500/30 bg-green-500/5 dark:bg-green-500/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-green-500" />
            <span className="font-sans font-bold text-sm text-green-700 dark:text-green-300">
              Bob computes
            </span>
          </div>
          <div className="space-y-1">
            <p className="font-sans text-sm">
              shared_secret =
            </p>
            <p className="font-sans text-sm pl-3">
              SHA256(
              <span className="font-semibold text-green-700 dark:text-green-300">
                bob_private_key
              </span>
              {" * "}
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                session_public_key
              </span>
              )
            </p>
          </div>
          <p className="mt-2 font-sans text-xs text-muted-foreground">
            Bob uses his <span className="text-green-700 dark:text-green-300 font-semibold">private</span> key
            and Alice's <span className="text-blue-700 dark:text-blue-300 font-semibold">public</span> session key
          </p>
        </div>
      </div>

      {/* Caption */}
      <p className="mt-2 text-center font-sans text-xs text-muted-foreground italic">
        Both produce the same shared secret because a * B = a * (b * G) = b * (a * G) = b * A
      </p>
    </div>
  );
}
