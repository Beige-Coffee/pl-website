/**
 * SegmentedFieldBar — Proportional field breakdown displayed on act arrows.
 *
 * When an act completes, the thin arrow line transforms into this bar.
 * Each segment is color-coded and sized proportionally to its byte count.
 * Clicking the bar selects that act for the inline byte grid.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  type MessageType,
  FIELD_COLORS,
  getFieldDefinitions,
} from "@/lib/noise-packet-fields";

const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';

interface SegmentedFieldBarProps {
  actNumber: 1 | 2 | 3;
  bytes: Uint8Array;
  messageType: MessageType;
  isSelected: boolean;
  onClick: () => void;
  theme: "light" | "dark";
  direction: "ltr" | "rtl";
}

export default function SegmentedFieldBar({
  actNumber,
  bytes,
  messageType,
  isSelected,
  onClick,
  theme,
  direction,
}: SegmentedFieldBarProps) {
  const isDark = theme === "dark";

  const fields = useMemo(
    () => getFieldDefinitions(messageType, bytes.length),
    [messageType, bytes.length]
  );

  const segments = useMemo(() => {
    const total = bytes.length;
    return fields.map((field) => {
      const count = field.endByte - field.startByte + 1;
      const preview = Array.from(bytes.slice(field.startByte, Math.min(field.startByte + 4, field.endByte + 1)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hasMore = count > 4;
      return { field, count, flexGrow: count, preview: hasMore ? `${preview}...` : preview };
    });
  }, [fields, bytes]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-stretch rounded-sm overflow-hidden transition-all duration-200 cursor-pointer",
        "h-6 sm:h-7",
        isSelected
          ? "ring-2 ring-[#b8860b]/60 ring-offset-1"
          : "hover:ring-1 hover:ring-black/20",
        isSelected && isDark && "ring-offset-[#0f1930]"
      )}
      style={{ direction: direction === "rtl" ? "rtl" : "ltr" }}
    >
      {segments.map(({ field, count, flexGrow, preview }, i) => {
        const colors = FIELD_COLORS[field.type];
        const mode = isDark ? colors.dark : colors.light;

        return (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center overflow-hidden transition-colors",
              mode.bg,
              mode.text,
              i < segments.length - 1 && (isDark ? "border-r border-r-black/20" : "border-r border-r-white/60")
            )}
            style={{
              flex: `${flexGrow} 0 0`,
              minWidth: count < 3 ? "16px" : "28px",
              fontFamily: MONO,
              direction: "ltr", // always ltr for content even if bar is rtl
            }}
          >
            <span className="text-[9px] sm:text-[10px] truncate px-0.5 opacity-80">
              {preview}
            </span>
          </div>
        );
      })}
    </button>
  );
}
