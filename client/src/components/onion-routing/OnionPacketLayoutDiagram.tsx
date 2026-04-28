import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// OnionPacketLayoutDiagram
//
// Visualizes the 1,366-byte Sphinx packet structure: 1-byte version, 33-byte
// ephemeral pubkey, 1,300-byte hop payloads area, and 32-byte HMAC. Each
// segment is clickable for a detail card.
// Used in Chapter 5.
// ────────────────────────────────────────────────────────────────────────────

const SEGMENTS = [
  {
    name: "version",
    bytes: 1,
    color: "#fde68a",
    stroke: "#b8860b",
    detail:
      "A single byte that identifies the onion format. BOLT 4 currently defines version 0x00. Forwarders that don't recognize the version reject the packet.",
  },
  {
    name: "ephemeral_pubkey",
    bytes: 33,
    color: "#bfdbfe",
    stroke: "#2563eb",
    detail:
      "The current hop's E_i from the blinding chain (Chapter 3). This is the only ephemeral key in the packet; the next hop's E_{i+1} is derived from this value plus the shared secret the next hop computes.",
  },
  {
    name: "hop_payloads",
    bytes: 1300,
    color: "#bbf7d0",
    stroke: "#16a34a",
    detail:
      "The encrypted onion body. Holds every hop's TLV instructions, plus per-hop HMACs pointing to the next layer, plus filler that pads everything out. Always exactly 1,300 bytes regardless of hop count.",
  },
  {
    name: "hmac",
    bytes: 32,
    color: "#fecaca",
    stroke: "#dc2626",
    detail:
      "An HMAC-SHA256 tag computed over the hop_payloads field with the next hop's mu key during construction. Forwarders verify this first; if it fails, the packet is rejected before any decryption is attempted.",
  },
];

const TOTAL = SEGMENTS.reduce((sum, s) => sum + s.bytes, 0); // 1366

export function OnionPacketLayoutDiagram() {
  const [active, setActive] = useState<number | null>(2); // start with hop_payloads selected, since it's the most interesting
  const focused = active !== null ? SEGMENTS[active] : null;

  // Compute proportional widths but with a minimum so 1-byte version is visible.
  const MIN_PCT = 3;
  const widths = SEGMENTS.map((s) => Math.max((s.bytes / TOTAL) * 100, MIN_PCT));
  const widthSum = widths.reduce((a, b) => a + b, 0);
  const normalizedWidths = widths.map((w) => (w / widthSum) * 100);

  return (
    <div
      className="my-6 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-packet-layout"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Sphinx packet layout — 1,366 bytes total
      </div>

      {/* Segment bar */}
      <div
        className="flex w-full h-16 border-2 border-foreground/30 mb-2"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        {SEGMENTS.map((s, i) => {
          const isActive = active === i;
          return (
            <button
              key={s.name}
              onClick={() => setActive(isActive ? null : i)}
              className="relative flex flex-col items-center justify-center text-xs font-semibold transition-opacity cursor-pointer border-r-2 last:border-r-0"
              style={{
                width: `${normalizedWidths[i]}%`,
                background: s.color,
                borderColor: s.stroke,
                color: "#0f172a",
                opacity: active === null || isActive ? 1 : 0.45,
                outline: isActive ? `3px solid ${s.stroke}` : "none",
                outlineOffset: -3,
              }}
              data-testid={`onion-packet-segment-${s.name}`}
            >
              <span className="leading-tight">{s.name}</span>
              <span className="text-[10px] font-normal opacity-80">{s.bytes}B</span>
            </button>
          );
        })}
      </div>

      {/* Byte ruler */}
      <div className="flex w-full text-[9px] font-mono text-foreground/60">
        {SEGMENTS.map((s, i) => {
          const cumStart = SEGMENTS.slice(0, i).reduce((sum, x) => sum + x.bytes, 0);
          return (
            <div
              key={s.name}
              style={{ width: `${normalizedWidths[i]}%` }}
              className="text-left pl-1"
            >
              byte {cumStart}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {focused ? (
        <div
          className="mt-4 border-2 p-3"
          style={{ background: focused.color, borderColor: focused.stroke }}
        >
          <div className="font-semibold mb-1">
            {focused.name}{" "}
            <span className="opacity-70 text-xs font-normal">
              ({focused.bytes} byte{focused.bytes === 1 ? "" : "s"})
            </span>
          </div>
          <div className="text-sm leading-relaxed">{focused.detail}</div>
        </div>
      ) : (
        <div className="mt-4 text-sm opacity-60 italic text-center">
          Click any segment to see what it contains.
        </div>
      )}
    </div>
  );
}

export default OnionPacketLayoutDiagram;
