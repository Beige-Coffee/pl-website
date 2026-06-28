import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Step-to-step morph helpers (onion-routing-visual-standards §14)
//
// The rule: a component morphs between steps ONLY if it is the SAME React
// element across the step change (React reconciles it → its box can transition).
// These helpers standardize that. They do NOT make a remounting element morph -
// you must render the consecutive steps from one step-switching component and
// give the shared element a stable `key`. Reference: WrapMorphView in
// WrapTraceDiagram.
// ────────────────────────────────────────────────────────────────────────────

/** Canonical morph timing. ~450ms easeInOut - distinct from the auto-play beat
 *  duration (§10). */
export const MORPH_MS = 450;
export const MORPH_TRANSITION = { duration: MORPH_MS / 1000, ease: "easeInOut" } as const;

/**
 * A persistent element that animates its own box (height / width / opacity /
 * border, via the `animate` prop) between step states. Render it from a single
 * step-switching component with a stable `key` so it reconciles across steps.
 *
 *   <MorphBox key="bar"
 *     initial={{ height: H0 }} animate={{ height: isStep4 ? 42 : 78 }}
 *     className="…" style={{…}}>
 *     {children}
 *   </MorphBox>
 *
 * Prefer `animate` for size (clean property tweens); reach for `layout` only for
 * pure position changes (it scale-distorts on large size changes).
 */
export function MorphBox(props: HTMLMotionProps<"div">) {
  const { transition, children, ...rest } = props;
  return (
    <motion.div transition={transition ?? MORPH_TRANSITION} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Crossfade the inner CONTENT when its representation changes between steps
 * (e.g. a full LEN/TLV/HMAC hop payload ↔ a compact block). Pass a `swapKey`
 * that changes when the content should swap; the old fades out as the new fades
 * in. Use it INSIDE a MorphBox (or any persistent container) so the box morphs
 * while the contents crossfade. Idiom reference: EncryptedSliceReveal.
 */
export function CrossfadeSwap({
  swapKey,
  children,
  className,
  style,
  durationMs = 280,
}: {
  swapKey: string | number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  durationMs?: number;
}) {
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={swapKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: durationMs / 1000, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
