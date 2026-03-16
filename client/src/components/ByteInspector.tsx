import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type MessageType,
  type FieldDefinition,
  FIELD_COLORS,
  getFieldDefinitions,
  getFieldForByte,
  getLegendItems,
} from "@/lib/noise-packet-fields";

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ── Types ──

interface ByteInspectorProps {
  data: Uint8Array | undefined;
  messageType: MessageType;
  label: string;
  theme?: "light" | "dark";
  className?: string;
}

// ── Component ──

export default function ByteInspector({
  data,
  messageType,
  label,
  theme = "dark",
  className,
}: ByteInspectorProps) {
  const isDark = theme === "dark";
  const [hoveredByte, setHoveredByte] = useState<number | null>(null);

  const bytes = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Array.from(data);
  }, [data]);

  const fields = useMemo(() => {
    return getFieldDefinitions(messageType, bytes.length);
  }, [messageType, bytes.length]);

  const legendItems = useMemo(() => getLegendItems(messageType), [messageType]);

  const handleMouseEnter = useCallback((byteIndex: number) => {
    setHoveredByte(byteIndex);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredByte(null);
  }, []);

  const hasData = bytes.length > 0;

  return (
    <div className={cn("my-4", className)} style={{ fontFamily: SANS }}>
      {/* Label */}
      <div
        className={cn(
          "text-sm font-bold mb-2 tracking-[0.05em] uppercase",
          isDark ? "text-slate-300" : "text-[#6b5d4f]"
        )}
      >
        {label}
      </div>

      {/* Byte grid container */}
      <div
        className={cn(
          "border-[1.5px] p-3 transition-colors",
          isDark
            ? "border-[#2a3552] bg-[#0f1930]"
            : "border-black/20 bg-white"
        )}
      >
        <AnimatePresence mode="wait">
          {hasData ? (
            <motion.div
              key="byte-grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Byte grid: 16 per row on desktop, 8 on mobile */}
              <div className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5" style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
                {bytes.map((byte, idx) => {
                  const field = getFieldForByte(fields, idx);
                  const fieldType = field?.type ?? "version";
                  const colors = FIELD_COLORS[fieldType];
                  const mode = isDark ? colors.dark : colors.light;
                  const isHovered = hoveredByte === idx;

                  return (
                    <Tooltip key={idx} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "text-xs px-1 py-0.5 rounded-sm cursor-default transition-all duration-100 text-center leading-tight",
                            mode.bg,
                            mode.text,
                            isHovered && "ring-2 ring-offset-0",
                            isHovered && (isDark ? "ring-white/40 brightness-125" : "ring-black/20 brightness-95")
                          )}
                          onMouseEnter={() => handleMouseEnter(idx)}
                          onMouseLeave={handleMouseLeave}
                          onFocus={() => handleMouseEnter(idx)}
                          onBlur={handleMouseLeave}
                        >
                          {byte.toString(16).padStart(2, "0")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={cn(
                          "text-xs px-3 py-2 max-w-[220px]",
                          isDark
                            ? "bg-[#0b1220] border border-[#2a3552] text-slate-200"
                            : "bg-white border border-gray-300 text-gray-800"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-xs">
                            {field?.label ?? "Unknown"}
                          </div>
                          <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-500")}>
                            Byte {idx} of {bytes.length}
                          </div>
                          <div className={cn("text-xs", isDark ? "text-slate-400" : "text-gray-500")}>
                            0x{byte.toString(16).padStart(2, "0")} = {byte}
                          </div>
                          {field?.tooltip && (
                            <div className={cn(
                              "text-xs pt-1 border-t",
                              isDark ? "text-slate-500 border-[#2a3552]" : "text-gray-400 border-gray-200"
                            )}>
                              {field.tooltip}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Legend */}
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-2 border-t text-sm",
                  isDark ? "border-[#2a3552]" : "border-gray-200"
                )}
              >
                {legendItems.map((item) => {
                  const colors = FIELD_COLORS[item.type];
                  const mode = isDark ? colors.dark : colors.light;
                  return (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block w-2.5 h-2.5 rounded-sm",
                          mode.bg
                        )}
                      />
                      <span className={isDark ? "text-slate-400" : "text-[#6b5d4f]"}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "text-center py-8 text-sm italic",
                isDark ? "text-slate-600" : "text-gray-400"
              )}
            >
              Waiting for handshake data...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
