/**
 * KeyDerivationFormulaDiagram -- shows the HMAC-SHA256 key derivation
 * as a visual flow: shared_secret -> HMAC-SHA256 -> derived key.
 *
 * Replaces the code block in 3.1-key-derivation.md:
 *   key = HMAC-SHA256(key=key_type_string, msg=shared_secret)
 *
 * Embed via `<key-derivation-formula></key-derivation-formula>` custom tag.
 */

import { cn } from "@/lib/utils";

export interface KeyDerivationFormulaDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RightArrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground shrink-0">
      {/* Horizontal on sm+, vertical on mobile */}
      <svg
        width="24"
        height="12"
        viewBox="0 0 24 12"
        className="hidden sm:block opacity-40"
      >
        <line x1="0" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="24,6 16,1 16,11" fill="currentColor" />
      </svg>
      <svg
        width="12"
        height="24"
        viewBox="0 0 12 24"
        className="sm:hidden opacity-40"
      >
        <line x1="6" y1="0" x2="6" y2="18" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="6,24 1,16 11,16" fill="currentColor" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KeyDerivationFormulaDiagram({ className }: KeyDerivationFormulaDiagramProps) {
  return (
    <div className={cn("my-6", className)}>
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center">
        {/* Input: shared_secret */}
        <div className="border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-2.5 text-center">
          <p className="font-sans text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
            msg
          </p>
          <p className="font-sans font-bold text-sm text-amber-700 dark:text-amber-300">
            shared_secret
          </p>
        </div>

        <RightArrow />

        {/* HMAC-SHA256 box */}
        <div className="border-2 border-foreground/20 bg-foreground/5 px-4 py-2.5 text-center relative">
          <p className="font-sans font-bold text-sm">
            HMAC-SHA256
          </p>
          <p className="font-sans text-xs text-muted-foreground mt-0.5">
            key = <span className="font-semibold text-blue-700 dark:text-blue-300">key_type_string</span>
          </p>
          <p className="font-sans text-[10px] text-muted-foreground mt-0.5">
            (b"rho", b"mu", b"um", b"pad", b"ammag")
          </p>
        </div>

        <RightArrow />

        {/* Output: derived key */}
        <div className="border-2 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2.5 text-center">
          <p className="font-sans text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
            output
          </p>
          <p className="font-sans font-bold text-sm text-emerald-700 dark:text-emerald-300">
            derived key
          </p>
          <p className="font-sans text-xs text-muted-foreground">(32 bytes)</p>
        </div>
      </div>
    </div>
  );
}
