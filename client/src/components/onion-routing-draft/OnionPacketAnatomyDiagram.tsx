import { useRef, useState, type ReactNode } from "react";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// OnionPacketAnatomyDiagram
//
// Static, plaintext visualization of the three sections of a Sphinx onion
// packet for ch.5 ("anatomy of an onion packet"). Encryption is not shown
// here on purpose, this is the *anatomy*, not the wire view. The reader
// gets to see what's actually inside each section, and every region is
// hoverable for a longer explanation popover.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

const HOP_FILL = {
  bob: "#dbeafe",
  charlie: "#ccece8",
  dave: "#ede1f3",
} as const;
const HOP_STROKE = {
  bob: "#3b6aa0",
  charlie: "#2d7a7a",
  dave: "#7b4b8a",
} as const;
const HEADER_FILL = "#f1f5f9";
const HEADER_STROKE = "#475569";

type HopId = "bob" | "charlie" | "dave";

interface Tip {
  title: string;
  body: string;
}

const HEADER_TIP: Tip = {
  title: "HEADER (34 bytes)",
  body: "Two fields: a 1-byte version (0x00 for the current Sphinx format) and the 33-byte ephemeral public key for the current hop. The ephemeral pubkey is what each forwarder combines with their own node private key (via ECDH) to derive their shared secret with Alice. Without the header, no shared secret can be derived and the forwarder can't decrypt anything.",
};

const PAYLOAD_TIP: Tip = {
  title: "PAYLOAD AREA (1,300 bytes)",
  body: "Fixed-size buffer carrying one TLV hop payload per hop in the route, plus pseudo-random padding to fill the rest. Always 1,300 bytes regardless of how many hops the packet will visit, which hides the route length from anyone who sees the packet on the wire (including the forwarders themselves).",
};

const HMAC_TIP: Tip = {
  title: "HMAC TAG (32 bytes)",
  body: "Outer authentication tag covering the payload area. The receiving hop computes their own tag using a key derived from their shared secret with Alice, and checks it matches this one before decrypting anything. If it doesn't match, the packet is dropped immediately. The way each hop's HMAC commits to the inner layer is what makes onion routing safe under malicious intermediate hops.",
};

const SLOT_TIPS: Record<HopId, Tip> = {
  bob: {
    title: "Bob's hop payload (65 bytes)",
    body: "First forwarder's TLV record. Carries amt_to_forward, outgoing_cltv_value, and short_channel_id so Bob knows which channel to forward over and how much to send. The hop payload ends with a 32-byte HMAC field holding charlie_hmac. Bob extracts this when he forwards and uses it as the new outer HMAC of the packet he sends to Charlie.",
  },
  charlie: {
    title: "Charlie's hop payload (65 bytes)",
    body: "Second forwarder's TLV record. Same shape as Bob's: amt_to_forward, outgoing_cltv_value, short_channel_id. The hop payload's HMAC field carries dave_hmac, which Charlie extracts when he forwards to Dave and elevates to the outer tag of the new packet.",
  },
  dave: {
    title: "Dave's hop payload (100 bytes)",
    body: "Destination's TLV record. Carries amt_to_forward, outgoing_cltv_value, and payment_data (the payment_secret and total_msat that Alice committed to in the invoice). The hop payload's HMAC field is 32 zero bytes, the universal \"you're the destination\" signal that tells Dave to claim the payment instead of forwarding. Larger than the relay hop payloads because payment_data takes more bytes.",
  },
};

const PADDING_TIP: Tip = {
  title: "Padding",
  body: "Pseudo-random bytes filling the rest of the buffer to bring the total payload area to exactly 1,300 bytes. Initialized by Alice via a deterministic stream cipher seeded by the session key. Without this padding, packets earlier in the route would be longer than packets later in the route, and an observer could count hop payloads to figure out where in the route they're looking.",
};

const TIP_WIDTH = 320;

// ── Hover tooltip wrapper ───────────────────────────────────────────────────

function HoverTip({
  tip,
  children,
  className,
  style,
}: {
  tip: Tip;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
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
    const fitsAbove = aboveY > 160;
    const y = fitsAbove ? aboveY : r.bottom + 12;
    setPos({ x, y, above: fitsAbove });
    setHovered(true);
  }

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
            boxShadow: "inset 0 0 0 2px #b8860b, 0 0 12px rgba(184,134,11,0.25)",
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
            border: "1.5px solid #b8860b",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#fef3c7",
              fontSize: 10,
              marginBottom: 4,
            }}
          >
            {tip.title}
          </div>
          <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
            {tip.body}
          </div>
        </div>
      )}
    </>
  );
}

// ── Hop payload block (with internal LEN | TLV | HMAC structure) ──────────────────

function SlotBlock({
  hop,
  widthPct,
}: {
  hop: HopId;
  widthPct: number;
}) {
  const fill = HOP_FILL[hop];
  const stroke = HOP_STROKE[hop];
  const isDave = hop === "dave";
  const nextLabel = isDave
    ? "0x00…"
    : hop === "bob"
      ? "→Charlie"
      : "→Dave";
  const nextColor = isDave
    ? "#475569"
    : hop === "bob"
      ? HOP_STROKE.charlie
      : HOP_STROKE.dave;
  const slotBytes = isDave ? 100 : 65;
  const lenHex = isDave ? "0x63" : "0x40";
  const hopName = hop[0].toUpperCase() + hop.slice(1);

  return (
    <HoverTip
      tip={SLOT_TIPS[hop]}
      style={{
        width: `${widthPct}%`,
        flexShrink: 0,
      }}
    >
      <div
        className="flex"
        style={{
          height: 110,
          background: fill,
          border: `1.5px solid ${stroke}`,
        }}
      >
        {/* LEN */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: 28,
            flexShrink: 0,
            borderRight: `1px dashed ${stroke}80`,
            padding: "0 2px",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            LEN
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              color: stroke,
              marginTop: 4,
            }}
          >
            {lenHex}
          </div>
        </div>

        {/* TLV (payload) */}
        <div
          className="flex-1 flex flex-col items-center justify-center text-center"
          style={{ minWidth: 0, padding: "0 4px", overflow: "hidden" }}
        >
          <div
            className="whitespace-nowrap"
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              fontWeight: 700,
              color: stroke,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {hopName}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              fontStyle: "italic",
              color: "#475569",
              marginTop: 4,
              lineHeight: 1,
              letterSpacing: "0.04em",
            }}
          >
            payload
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: "#475569",
              marginTop: 5,
              lineHeight: 1,
            }}
          >
            {slotBytes} bytes
          </div>
        </div>

        {/* HMAC */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: 50,
            flexShrink: 0,
            borderLeft: `1px dashed ${stroke}80`,
            padding: "0 2px",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 8,
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            HMAC
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              color: nextColor,
              marginTop: 4,
              whiteSpace: "nowrap",
            }}
          >
            {nextLabel}
          </div>
        </div>
      </div>
    </HoverTip>
  );
}

// ── Padding block ──────────────────────────────────────────────────────────

function PaddingBlock({ widthPct }: { widthPct: number }) {
  return (
    <HoverTip
      tip={PADDING_TIP}
      style={{ width: `${widthPct}%`, flexShrink: 0 }}
    >
      <div
        style={{
          height: 110,
          background: "#e2e8f0",
          border: "1.5px solid #94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          padding: "0 4px",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          padding
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            color: "#64748b",
            marginTop: 6,
            lineHeight: 1,
          }}
        >
          1,070 bytes
        </div>
      </div>
    </HoverTip>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function OnionPacketAnatomyDiagram() {
  // Hop payload widths inside payload area (% of payload, not total). Sized to
  // give each hop payload real breathing room, the hop payload-internal LEN | name |
  // HMAC layout matches the wrap/peel diagrams. Padding takes whatever
  // remains, deliberately thin so the hop payloads are the visual focus.
  const SLOT_WIDTH = {
    bob: 28,
    charlie: 28,
    dave: 30,
  };
  const padWidth = 100 - SLOT_WIDTH.bob - SLOT_WIDTH.charlie - SLOT_WIDTH.dave;

  return (
    <div
      className="my-6 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-packet-anatomy"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          onion_routing_packet · anatomy
        </span>
      </div>

      {/* Stage */}
      <div className="bg-[#fefdfb] px-4 py-5">
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 720, maxWidth: 880 }}>
            <div
              className="flex"
              style={{
                background: "#fffdf5",
                border: "1.5px solid #0f172a",
                minHeight: 160,
              }}
            >
              {/* HEADER */}
              <HoverTip
                tip={HEADER_TIP}
                style={{
                  flexBasis: "16%",
                  flexShrink: 0,
                  borderRight: "1.5px solid #0f172a",
                  background: HEADER_FILL,
                }}
              >
                <div
                  className="flex flex-col items-center justify-center text-center"
                  style={{
                    height: "100%",
                    padding: "12px 8px",
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ fontFamily: MONO, color: "#0f172a" }}
                  >
                    HEADER
                  </span>
                  <div
                    style={{
                      width: "60%",
                      height: 1,
                      background: "#0f172a30",
                      marginTop: 6,
                      marginBottom: 6,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: "#475569",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      opacity: 0.8,
                    }}
                  >
                    version
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0f172a",
                      marginTop: 1,
                    }}
                  >
                    0x00
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: "#475569",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      opacity: 0.8,
                      marginTop: 8,
                    }}
                  >
                    ephemeral pubkey
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 16,
                      fontWeight: 700,
                      color: HOP_STROKE.bob,
                      marginTop: 2,
                    }}
                  >
                    <Tok token="E_AB" color={HOP_STROKE.bob} />
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 8.5,
                      color: "#94a3b8",
                      fontStyle: "italic",
                      marginTop: 4,
                    }}
                  >
                    34 bytes
                  </span>
                </div>
              </HoverTip>

              {/* PAYLOAD AREA */}
              <div
                className="relative"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRight: "1.5px solid #0f172a",
                  minWidth: 0,
                }}
              >
                <HoverTip
                  tip={PAYLOAD_TIP}
                  style={{
                    display: "inline-block",
                    margin: "0 auto 6px auto",
                    padding: "1px 8px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#0f172a",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    PAYLOAD AREA · 1,300 BYTES
                  </span>
                </HoverTip>
                <div
                  className="flex"
                  style={{
                    gap: 0,
                  }}
                >
                  <SlotBlock hop="bob" widthPct={SLOT_WIDTH.bob} />
                  <SlotBlock hop="charlie" widthPct={SLOT_WIDTH.charlie} />
                  <SlotBlock hop="dave" widthPct={SLOT_WIDTH.dave} />
                  <PaddingBlock widthPct={padWidth} />
                </div>
              </div>

              {/* HMAC TAG */}
              <HoverTip
                tip={HMAC_TIP}
                style={{
                  flexBasis: "13%",
                  flexShrink: 0,
                  background: `${HOP_STROKE.bob}20`,
                }}
              >
                <div
                  className="flex flex-col items-center justify-center text-center"
                  style={{
                    height: "100%",
                    padding: "12px 6px",
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ fontFamily: MONO, color: "#0f172a" }}
                  >
                    HMAC
                  </span>
                  <div
                    style={{
                      width: "60%",
                      height: 1,
                      background: "#0f172a30",
                      marginTop: 6,
                      marginBottom: 6,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 700,
                      color: HOP_STROKE.bob,
                    }}
                  >
                    → Bob
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: "#475569",
                      marginTop: 4,
                    }}
                  >
                    bob_hmac
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 8.5,
                      color: "#94a3b8",
                      fontStyle: "italic",
                      marginTop: 4,
                    }}
                  >
                    32 bytes
                  </span>
                </div>
              </HoverTip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnionPacketAnatomyDiagram;
