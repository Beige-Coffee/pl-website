import { useRef, useState, type ReactNode, type CSSProperties } from "react";

// ────────────────────────────────────────────────────────────────────────────
// SlotSubCell
//
// Shared sub-cell component used across slot-rendering diagrams (slice-in-
// packet, payload-shrink, padding-strategy). Each sub-cell represents one
// of the three logical fields per BOLT 4 spec:
//
//   [bigsize length] [TLV payload] [32-byte HMAC pointing to next hop]
//
// On hover, the cell gets an inset gold highlight and a fixed-position
// popover appears above (or below if no room) explaining what that section
// is. Popover styling matches the locked onion-routing visual format spec.
// ────────────────────────────────────────────────────────────────────────────

export type SlotSection = "len" | "tlv" | "hmac";

const TOOLTIP_CONTENT: Record<SlotSection, { title: string; body: string }> = {
  len: {
    title: "Bigsize length prefix",
    body: "BigSize-encoded length of this hop's TLV payload. Tells the forwarder where the TLV records end and the next-hop HMAC begins. Typically 1 byte for normal-sized payloads.",
  },
  tlv: {
    title: "TLV payload",
    body: "Type-Length-Value records carrying this hop's routing instructions: amt_to_forward, outgoing_cltv_value, and short_channel_id (or payment_data for the destination).",
  },
  hmac: {
    title: "Next-hop HMAC",
    body: "32-byte HMAC-SHA256 tag bound to the next layer of the onion. When this hop forwards, it extracts this tag and writes it into the outer HMAC field of the new packet — so the next hop can verify their own layer before peeling.",
  },
};

const TIP_WIDTH = 280;

interface SlotSubCellProps {
  section: SlotSection;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  // Inline-style overrides used when this cell is *not* hovered, applied via
  // the wrapper element's style. Hover state adds an inset gold highlight.
  baseBackground?: string;
  baseBorderLeft?: string;
  baseBorderRight?: string;
}

export function SlotSubCell({
  section,
  children,
  style,
  className,
}: SlotSubCellProps) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: true });
  const ref = useRef<HTMLDivElement>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const desiredX = r.left + r.width / 2 - TIP_WIDTH / 2;
    const x = Math.max(
      margin,
      Math.min(window.innerWidth - TIP_WIDTH - margin, desiredX),
    );
    const aboveY = r.top - 12;
    const fitsAbove = aboveY > 140;
    const y = fitsAbove ? aboveY : r.bottom + 12;
    setPos({ x, y, above: fitsAbove });
    setHovered(true);
  }

  const content = TOOLTIP_CONTENT[section];

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setHovered(false)}
        className={className}
        style={{
          ...style,
          cursor: "help",
          transition: "box-shadow 180ms ease-out, filter 180ms ease-out",
          ...(hovered && {
            boxShadow: "inset 0 0 0 2px #b8860b",
            filter: "brightness(1.06)",
          }),
        }}
      >
        {children}
      </div>
      {hovered && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.above ? undefined : pos.y,
            bottom: pos.above ? window.innerHeight - pos.y : undefined,
            width: TIP_WIDTH,
            zIndex: 50,
            padding: "10px 12px",
            background: "#0f172a",
            color: "#fffdf5",
            fontSize: 11.5,
            lineHeight: 1.5,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            pointerEvents: "none",
            border: "1.5px solid #b8860b",
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#b8860b",
              marginBottom: 5,
            }}
          >
            {content.title}
          </div>
          <div>{content.body}</div>
        </div>
      )}
    </>
  );
}

export default SlotSubCell;
