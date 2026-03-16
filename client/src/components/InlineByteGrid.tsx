/**
 * InlineByteGrid — Byte-level breakdown with persistent detail bar.
 *
 * Renders inside the handshake visualizer card for the selected act.
 * Click any byte to pin its info in the detail bar below the grid.
 * Replaces the old hover-tooltip pattern for better readability.
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  type MessageType,
  type FieldType,
  FIELD_COLORS,
  getFieldDefinitions,
  getFieldForByte,
  getLegendItems,
} from "@/lib/noise-packet-fields";

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';

interface InlineByteGridProps {
  bytes: Uint8Array;
  messageType: MessageType;
  theme: "light" | "dark";
  /** For handshake acts (optional) */
  act?: 1 | 2 | 3;
  /** Override label — replaces "Act N" for transport messages */
  label?: string;
}

export default function InlineByteGrid({
  bytes,
  messageType,
  theme,
  act,
  label,
}: InlineByteGridProps) {
  const isDark = theme === "dark";
  const [selectedByte, setSelectedByte] = useState<number | null>(null);

  const byteArray = useMemo(() => Array.from(bytes), [bytes]);

  const fields = useMemo(
    () => getFieldDefinitions(messageType, bytes.length),
    [messageType, bytes.length]
  );

  const legendItems = useMemo(() => getLegendItems(messageType), [messageType]);

  const selectedField = useMemo(
    () => (selectedByte !== null ? getFieldForByte(fields, selectedByte) : null),
    [fields, selectedByte]
  );

  const handleByteClick = useCallback((idx: number) => {
    setSelectedByte((prev) => (prev === idx ? null : idx));
  }, []);

  const defaultLabel = act
    ? `Act ${act} (${bytes.length} bytes) ${act === 2 ? "\u2190 received" : "\u2192 sent"}`
    : `${bytes.length} bytes`;
  const displayLabel = label ?? defaultLabel;

  return (
    <div
      className={cn(
        "border-t pt-3 pb-2 px-1 sm:px-2",
        isDark ? "border-white/10" : "border-black/10"
      )}
      style={{ fontFamily: SANS }}
    >
      {/* Label */}
      <div
        className={cn(
          "text-xs font-bold uppercase tracking-[0.06em] mb-2",
          isDark ? "text-slate-400" : "text-[#6b5d4f]"
        )}
      >
        {displayLabel}
      </div>

      {/* Byte grid: 16 per row desktop, 8 mobile */}
      <div
        className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5"
        style={{ fontFamily: MONO }}
      >
        {byteArray.map((byte, idx) => {
          const field = getFieldForByte(fields, idx);
          const fieldType = field?.type ?? ("version" as FieldType);
          const colors = FIELD_COLORS[fieldType];
          const mode = isDark ? colors.dark : colors.light;
          const isSelected = selectedByte === idx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleByteClick(idx)}
              className={cn(
                "text-[10px] sm:text-xs px-0.5 py-0.5 rounded-sm cursor-pointer transition-all duration-100 text-center leading-tight",
                mode.bg,
                mode.text,
                isSelected && "ring-2 ring-[#b8860b] ring-offset-0 brightness-110",
                !isSelected && "hover:ring-1 hover:ring-offset-0",
                !isSelected && (isDark ? "hover:ring-white/30" : "hover:ring-black/20")
              )}
            >
              {byte.toString(16).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs",
          isDark ? "text-slate-500" : "text-[#9a8b78]"
        )}
      >
        {legendItems.map((item) => {
          const colors = FIELD_COLORS[item.type];
          const mode = isDark ? colors.dark : colors.light;
          return (
            <div key={item.type} className="flex items-center gap-1.5">
              <span className={cn("inline-block w-2 h-2 rounded-sm", mode.bg)} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Persistent detail bar */}
      <div
        className={cn(
          "mt-2 rounded-sm text-sm transition-all",
          isDark ? "bg-[#0a0e1a] border border-white/10" : "bg-[#faf8f5] border border-black/10",
          selectedByte !== null ? "p-2.5 sm:p-3" : "p-2 sm:p-2.5"
        )}
      >
        {selectedByte !== null && selectedField ? (
          <div className="space-y-1">
            {/* Top row: field name + byte position + hex value */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              <span
                className={cn(
                  "font-bold text-sm",
                  isDark
                    ? FIELD_COLORS[selectedField.type].dark.text
                    : FIELD_COLORS[selectedField.type].light.text
                )}
              >
                {selectedField.label}
              </span>
              <span
                className={cn("text-xs", isDark ? "text-slate-500" : "text-[#9a8b78]")}
              >
                byte {selectedByte} of {bytes.length}
              </span>
              <span
                className={cn("text-xs", isDark ? "text-slate-400" : "text-[#6b5d4f]")}
                style={{ fontFamily: MONO }}
              >
                0x{byteArray[selectedByte].toString(16).padStart(2, "0")} ={" "}
                {byteArray[selectedByte]}
              </span>
            </div>

            {/* Description */}
            {selectedField.tooltip && (
              <div className={cn("text-xs leading-relaxed", isDark ? "text-slate-400" : "text-[#6b5d4f]")}>
                {selectedField.tooltip}
              </div>
            )}

            {/* Chapter link */}
            {selectedField.chapterRef && (
              <a
                href={`/noise-tutorial/${selectedField.chapterRef}`}
                className={cn(
                  "inline-block text-xs underline underline-offset-2",
                  isDark ? "text-[#FFD700]/60 hover:text-[#FFD700]" : "text-[#b8860b]/60 hover:text-[#b8860b]"
                )}
              >
                Review: Ch. {selectedField.chapterRef.replace(/-/g, " ")}
              </a>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "text-xs italic",
              isDark ? "text-slate-600" : "text-[#9a8b78]"
            )}
          >
            Click any byte to inspect it
          </div>
        )}
      </div>
    </div>
  );
}
