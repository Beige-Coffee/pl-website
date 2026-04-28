import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// TlvByteBreakdown
//
// Reusable byte-level breakdown for TLV records (and any short fixed-format
// bytes we want to show interactively). Each field declares its hex bytes,
// a label, an optional palette color, and a description; the grid hover
// reveals which bytes belong to which field.
//
// Used in Chapter 2 for Bob's hop payload. Will get reused in Chapter 5 for
// the Sphinx packet header (version + ephemeral key + HMAC) and elsewhere.
// ────────────────────────────────────────────────────────────────────────────

export interface TlvField {
  /** Display label, e.g. "type" or "amt_to_forward". */
  label: string;
  /** Hex bytes (each entry is exactly two characters; spaces ignored). */
  hex: string;
  /** Plain-language description shown when this field is highlighted. */
  description: string;
  /** Optional palette key. If omitted, sequential palette colors are used. */
  color?: keyof typeof PALETTE;
}

export interface TlvByteBreakdownProps {
  caption?: string;
  fields: TlvField[];
}

const PALETTE = {
  amber:  { bg: "#fde68a", border: "#b8860b", text: "#78350f" },
  blue:   { bg: "#bfdbfe", border: "#2563eb", text: "#1e3a8a" },
  green:  { bg: "#bbf7d0", border: "#16a34a", text: "#14532d" },
  rose:   { bg: "#fecaca", border: "#dc2626", text: "#7f1d1d" },
  violet: { bg: "#ddd6fe", border: "#7c3aed", text: "#4c1d95" },
} as const;

const PALETTE_KEYS: Array<keyof typeof PALETTE> = [
  "amber", "blue", "green", "rose", "violet",
];

function parseHex(hex: string): string[] {
  return hex
    .replace(/\s+/g, "")
    .match(/.{1,2}/g)
    ?.map((b) => b.toLowerCase()) ?? [];
}

export function TlvByteBreakdown({ caption, fields }: TlvByteBreakdownProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Flatten into byte cells with field index attached.
  const cells: Array<{ hex: string; fieldIdx: number; byteIdx: number }> = [];
  fields.forEach((f, fi) => {
    parseHex(f.hex).forEach((b, bi) =>
      cells.push({ hex: b, fieldIdx: fi, byteIdx: bi }),
    );
  });

  const fieldsWithColor = fields.map((f, i) => ({
    ...f,
    paletteKey: f.color ?? PALETTE_KEYS[i % PALETTE_KEYS.length],
  }));

  const activeIdx = hovered;

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-tlv-breakdown"
    >
      {caption && (
        <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
          {caption}
        </div>
      )}

      {/* Byte grid */}
      <div
        className="flex flex-wrap gap-1.5 mb-4"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace' }}
        onMouseLeave={() => setHovered(null)}
      >
        {cells.map((c, i) => {
          const palette = PALETTE[fieldsWithColor[c.fieldIdx].paletteKey];
          const isActiveField = activeIdx === c.fieldIdx;
          const dimmed = activeIdx !== null && !isActiveField;
          return (
            <div
              key={i}
              onMouseEnter={() => setHovered(c.fieldIdx)}
              className="w-9 h-9 flex items-center justify-center text-xs font-medium border-2 transition-opacity cursor-default"
              style={{
                background: palette.bg,
                borderColor: palette.border,
                color: palette.text,
                opacity: dimmed ? 0.35 : 1,
              }}
              title={`${fieldsWithColor[c.fieldIdx].label} byte ${c.byteIdx}: 0x${c.hex}`}
            >
              {c.hex}
            </div>
          );
        })}
      </div>

      {/* Field legend */}
      <div className="space-y-2">
        {fieldsWithColor.map((f, i) => {
          const palette = PALETTE[f.paletteKey];
          const byteCount = parseHex(f.hex).length;
          const dimmed = activeIdx !== null && activeIdx !== i;
          return (
            <div
              key={f.label + i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-start gap-3 transition-opacity cursor-default"
              style={{ opacity: dimmed ? 0.4 : 1 }}
            >
              <div
                className="w-4 h-4 mt-1 border-2 shrink-0"
                style={{ background: palette.bg, borderColor: palette.border }}
              />
              <div className="flex-1">
                <div className="font-semibold text-sm">
                  {f.label}{" "}
                  <span className="opacity-60 text-xs font-normal">
                    ({byteCount} byte{byteCount === 1 ? "" : "s"})
                  </span>
                </div>
                <div className="text-sm leading-relaxed opacity-80">
                  {f.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TlvByteBreakdown;
