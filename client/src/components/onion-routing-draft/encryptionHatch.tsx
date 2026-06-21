// ────────────────────────────────────────────────────────────────────────────
// Encryption hatch - shared module
//
// Canonical source for the onion-encryption hatch styling. Locked spec:
//   bob:     90°  (vertical stripes), color #3b6aa0
//   charlie: 45°  (diagonal up),      color #2d7a7a
//   dave:    0°   (horizontal stripes), color #7b4b8a
//
// Each hatch layer renders two stacked overlays:
//   1. Solid wash at 8% opacity (background tint of the hop color)
//   2. Stripes at 60% opacity, 2.5px wide on an 11px period
//
// When multiple hops' layers stack (e.g., Dave's slot still wraps Bob +
// Charlie + Dave's encryption), the angles differ enough that the layers
// crosshatch visibly - that's the visual signature of "this region is
// inside several layers of encryption".
//
// Per the locked Encryption Hatch Spec (2026-05-09), every visual that
// shows onion encryption uses this component. Don't redefine LAYER_ANGLES
// locally; don't write `repeating-linear-gradient` inline for encryption.
// ────────────────────────────────────────────────────────────────────────────

export type ForwarderId = "bob" | "charlie" | "dave";

export const LAYER_ANGLES: Record<ForwarderId, number> = {
  bob: 90,
  charlie: 45,
  dave: 0,
};

export const LAYER_COLORS: Record<ForwarderId, string> = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
};

const SOLID_WASH_OPACITY = 0.08;
const STRIPE_OPACITY = 0.6;
const STRIPE_WIDTH_PX = 2.5;
const STRIPE_GAP_PX = 11;

interface HatchOverlayProps {
  /** Hops whose encryption is currently on this region, outermost-first. */
  hops: ForwarderId[];
  /** Z-index for the overlay layers (defaults to 4 to sit above slot/padding regions). */
  zIndex?: number;
  /** Stripe opacity override (rare; defaults to 0.6). */
  stripeOpacity?: number;
  /** Solid-wash opacity override (rare; defaults to 0.08). */
  washOpacity?: number;
}

/**
 * Render the locked-spec encryption hatch overlay for a list of hops. Each
 * hop contributes two absolutely-positioned divs (solid wash + stripes) on
 * top of whatever the parent is. Use inside a `position: relative` parent
 * (like a slot region or padding region).
 */
export function HatchOverlay({
  hops,
  zIndex = 4,
  stripeOpacity = STRIPE_OPACITY,
  washOpacity = SOLID_WASH_OPACITY,
}: HatchOverlayProps) {
  return (
    <>
      {hops.map((hop) => {
        const stroke = LAYER_COLORS[hop];
        const angle = LAYER_ANGLES[hop];
        return (
          <div
            key={hop}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: stroke,
                opacity: washOpacity,
                transition: "opacity 600ms ease-out",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(${angle}deg, ${stroke} 0px, ${stroke} ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_GAP_PX}px)`,
                opacity: stripeOpacity,
                transition: "opacity 600ms ease-out",
              }}
            />
          </div>
        );
      })}
    </>
  );
}

/**
 * Build the `backgroundImage` string for a single-hop hatch (used when a
 * visual wants to apply the stripe pattern to a custom container without
 * the wash + transitions, e.g., mini onion icons). Prefer `HatchOverlay`
 * for full layered rendering.
 */
export function singleHatchBackground(hop: ForwarderId): string {
  const stroke = LAYER_COLORS[hop];
  const angle = LAYER_ANGLES[hop];
  return `repeating-linear-gradient(${angle}deg, ${stroke} 0px, ${stroke} ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_GAP_PX}px)`;
}
