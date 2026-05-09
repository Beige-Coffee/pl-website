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
//
// Visual format follows the locked onion-routing spec: black header bar with
// gold dot + uppercase title, cream stage body, ink/slate borders at 1.5px,
// canonical palette values for the byte-cell colorways.
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

// Canonical onion-routing palette. Border + accent colors come straight from
// the locked spec (gold #b8860b, blue #3b6aa0, green #5a7a2f, violet #7b4b8a).
// Backgrounds use soft tints that read well against the cream stage; text uses
// ink-darkness (#0f172a) for legibility on every cell.
const PALETTE = {
  amber:  { bg: "#fef3c7", border: "#b8860b", text: "#0f172a" },
  blue:   { bg: "#dbeafe", border: "#3b6aa0", text: "#0f172a" },
  green:  { bg: "#dcfce7", border: "#5a7a2f", text: "#0f172a" },
  rose:   { bg: "#ede1f3", border: "#7b4b8a", text: "#0f172a" },
  violet: { bg: "#ede1f3", border: "#7b4b8a", text: "#0f172a" },
} as const;

const PALETTE_KEYS: Array<keyof typeof PALETTE> = [
  "amber", "blue", "green", "rose", "violet",
];

const MONO_FONT = '"JetBrains Mono", "Fira Code", monospace';

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
  const headerTitle = caption ?? "Byte breakdown";
  const activeField = activeIdx !== null ? fieldsWithColor[activeIdx] : null;
  const activePalette = activeField ? PALETTE[activeField.paletteKey] : null;
  const activeByteCount = activeField ? parseHex(activeField.hex).length : 0;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-tlv-breakdown"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header, locked onion-routing format */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            {headerTitle}
          </span>
        </div>
      </div>

      {/* Cream stage */}
      <div className="bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6">
        {/* Byte grid */}
        <div
          className="flex flex-wrap gap-1.5 mb-4"
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
                className="w-9 h-9 flex items-center justify-center text-xs font-medium border-[1.5px] transition-opacity cursor-default"
                style={{
                  background: palette.bg,
                  borderColor: palette.border,
                  color: palette.text,
                  opacity: dimmed ? 0.35 : 1,
                  fontFamily: MONO_FONT,
                }}
                title={`${fieldsWithColor[c.fieldIdx].label} byte ${c.byteIdx}: 0x${c.hex}`}
              >
                {c.hex}
              </div>
            );
          })}
        </div>

        {/* Active-field description card. Left rail accent uses the field's
            border color so the link from grid → description is unambiguous. */}
        {activeField && activePalette && (
          <div
            className="border-[1.5px] mb-4 flex items-stretch overflow-hidden"
            style={{
              borderColor: "#0f172a",
              background: "#fffdf5",
            }}
          >
            <div
              className="shrink-0"
              style={{ width: 4, background: activePalette.border }}
            />
            <div className="px-3 py-2 flex-1">
              <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>
                {activeField.label}{" "}
                <span className="opacity-60 text-xs font-normal">
                  ({activeByteCount} byte{activeByteCount === 1 ? "" : "s"})
                </span>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "#0f172a" }}>
                {activeField.description}
              </div>
            </div>
          </div>
        )}

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
                  className="w-4 h-4 mt-1 border-[1.5px] shrink-0"
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
    </div>
  );
}

export default TlvByteBreakdown;
