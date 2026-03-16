/**
 * WireInspector — Wireshark-style packet capture for the Live Connection Lab.
 *
 * Displays a chronological table of all packets that have crossed the wire:
 * probe (plaintext), handshake (Acts 1-3), and transport (encrypted messages).
 *
 * Click a row to expand a detail panel with field-level byte breakdown.
 * Hover over individual bytes in the detail panel for tooltips.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type FieldDefinition,
  FIELD_COLORS,
  getFieldDefinitions,
  getProbeFieldDefinitions,
  getFieldForByte,
  bytesToHex,
  bytesToTruncatedHex,
} from "@/lib/noise-packet-fields";

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';

// ── Exported types ──

export interface CapturedPacket {
  id: number;
  timestamp: Date;
  direction: "sent" | "received";
  phase: "probe" | "handshake" | "transport";
  rawBytes: Uint8Array;
  label: string;
  closeCode?: number;
  closeReason?: string;
  decryptedText?: string;
  /** For handshake packets: which act (1, 2, 3) */
  act?: 1 | 2 | 3;
}

interface WireInspectorProps {
  packets: CapturedPacket[];
  theme: "light" | "dark";
}

// ── Helpers ──

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getPhaseLabel(packet: CapturedPacket): string {
  if (packet.phase === "probe") return "Probe";
  if (packet.phase === "handshake" && packet.act) return `Act ${packet.act}`;
  if (packet.phase === "transport") return "Transport";
  return packet.phase;
}

function getInfoHex(packet: CapturedPacket): string {
  if (packet.rawBytes.length === 0) {
    return packet.closeCode ? `[Close: ${packet.closeCode}]` : "[empty]";
  }
  return bytesToTruncatedHex(packet.rawBytes, 12);
}

function getFieldsForPacket(packet: CapturedPacket): FieldDefinition[] {
  if (packet.phase === "probe" && packet.rawBytes.length > 0) {
    return getProbeFieldDefinitions(packet.rawBytes.length);
  }
  if (packet.phase === "handshake" && packet.act) {
    return getFieldDefinitions(`act${packet.act}` as "act1" | "act2" | "act3", packet.rawBytes.length);
  }
  if (packet.phase === "transport" && packet.rawBytes.length > 0) {
    return getFieldDefinitions("transport", packet.rawBytes.length);
  }
  return [];
}

function getEnrichedTooltip(packet: CapturedPacket): string {
  if (packet.phase === "probe") {
    if (packet.rawBytes.length > 0) {
      const ascii = new TextDecoder().decode(packet.rawBytes);
      return `Plaintext "${ascii}" (${packet.rawBytes.length} bytes). No encryption, no authentication. Anyone on the network can read this.`;
    }
    if (packet.closeCode) {
      return `Server closed connection: ${packet.closeReason}. Expected a 50-byte Noise Act 1 message, got ASCII text.`;
    }
  }
  if (packet.phase === "handshake" && packet.act) {
    const ecdhMap: Record<number, string> = {
      1: "ECDH: e \u00D7 s_server (your ephemeral \u00D7 server's static)",
      2: "ECDH: e \u00D7 e (both ephemeral keys, forward secrecy)",
      3: "ECDH: s \u00D7 e (your static \u00D7 server's ephemeral, proves identity)",
    };
    return `${packet.rawBytes.length} bytes. ${ecdhMap[packet.act]}`;
  }
  if (packet.phase === "transport") {
    const dec = packet.decryptedText ? `Decrypted: "${packet.decryptedText}"` : "Encrypted payload";
    return `${packet.rawBytes.length} bytes. ${dec}. Encrypted with ChaCha20-Poly1305.`;
  }
  return "";
}

// ── Component ──

export default function WireInspector({ packets, theme }: WireInspectorProps) {
  const isDark = theme === "dark";
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const tableEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to bottom when new packets arrive
  useEffect(() => {
    if (packets.length > prevCountRef.current) {
      tableEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCountRef.current = packets.length;
  }, [packets.length]);

  // Auto-select the latest packet
  useEffect(() => {
    if (packets.length > 0) {
      setSelectedId(packets[packets.length - 1].id);
    }
  }, [packets.length]);

  const selectedPacket = useMemo(
    () => packets.find((p) => p.id === selectedId) ?? null,
    [packets, selectedId]
  );

  const selectedFields = useMemo(
    () => (selectedPacket ? getFieldsForPacket(selectedPacket) : []),
    [selectedPacket]
  );

  const isCapturing = packets.length > 0 && packets[packets.length - 1].phase !== "probe";

  // ── Theme (bitcoin.design sketch style) ──
  const c = isDark
    ? {
        bg: "bg-[#0f1930]",
        border: "border-[#2a3552]",
        headerBg: "bg-white/10",
        headerText: "text-white",
        rowHover: "hover:bg-[#132043]",
        rowSelected: "bg-[#132043]",
        text: "text-slate-200",
        textMuted: "text-slate-400",
        textDim: "text-slate-600",
        divider: "border-[#1a2540]",
        green: "text-[#8cb369]",
        red: "text-[#c97a5a]",
        blue: "text-[#d4a574]",
        orange: "text-[#c9985f]",
        yellow: "text-[#e8dcc8]",
        purple: "text-[#a8c9b8]",
        probeBg: "bg-[#4a4030]/10",
        handshakeSentBg: "bg-[#5a3d20]/5",
        handshakeRecvBg: "bg-[#4a3318]/5",
        transportBg: "bg-[#5a7a2f]/5",
        closeBg: "bg-[#a0522d]/10",
        detailBg: "bg-[#0a0e1a]",
        detailBorder: "border-[#1a2540]",
        tooltipBg: "bg-[#0b1220]",
        tooltipBorder: "border-[#2a3552]",
        tooltipText: "text-slate-200",
        colBorder: "border-r border-r-white/[0.06]",
      }
    : {
        bg: "bg-white",
        border: "border-black",
        headerBg: "bg-black",
        headerText: "text-white",
        rowHover: "hover:bg-[#fefdfb]",
        rowSelected: "bg-[#fefdfb]",
        text: "text-[#2a1f0d]",
        textMuted: "text-[#6b5d4f]",
        textDim: "text-[#9a8b78]",
        divider: "border-black/10",
        green: "text-[#5a7a2f]",
        red: "text-[#a0522d]",
        blue: "text-[#6b4420]",
        orange: "text-[#5a3d1a]",
        yellow: "text-[#b8860b]",
        purple: "text-[#2d4a3a]",
        probeBg: "bg-transparent",
        handshakeSentBg: "bg-transparent",
        handshakeRecvBg: "bg-transparent",
        transportBg: "bg-transparent",
        closeBg: "bg-[#a0522d]/5",
        detailBg: "bg-[#fefdfb]",
        detailBorder: "border-black/10",
        tooltipBg: "bg-white",
        tooltipBorder: "border-black",
        tooltipText: "text-[#2a1f0d]",
        colBorder: "border-r border-r-black/[0.08]",
      };

  function getRowBg(packet: CapturedPacket): string {
    if (packet.closeCode) return c.closeBg;
    if (packet.phase === "probe") return c.probeBg;
    if (packet.phase === "handshake") return packet.direction === "sent" ? c.handshakeSentBg : c.handshakeRecvBg;
    return c.transportBg;
  }

  function getDirectionColor(packet: CapturedPacket): string {
    if (packet.closeCode) return c.red;
    if (packet.phase === "probe" && packet.rawBytes.length > 0) return c.yellow;
    if (packet.direction === "sent") return c.blue;
    return c.orange;
  }

  function getPhaseColor(packet: CapturedPacket): string {
    if (packet.phase === "probe") return c.yellow;
    if (packet.phase === "handshake") return c.purple;
    return c.green;
  }

  // Check if a new phase starts (to insert dividers)
  function isNewPhase(idx: number): boolean {
    if (idx === 0) return false;
    return packets[idx].phase !== packets[idx - 1].phase;
  }

  return (
    <div
      className={cn("border-[1.5px] overflow-hidden", c.border, c.bg)}
      style={{ fontFamily: SANS }}
    >
      {/* Inverted header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full px-4 py-2 flex items-center justify-between cursor-pointer transition-colors",
          c.headerBg,
          isDark ? "hover:bg-white/15" : "hover:bg-black/90"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            isCapturing ? "bg-[#c97a5a] animate-pulse" : packets.length > 0 ? "bg-[#8cb369]" : "bg-white/40"
          )} />
          <span className={cn("text-sm font-bold tracking-[0.08em] uppercase", c.headerText)}>
            Wire Inspector
          </span>
          {isCapturing && (
            <span className={cn("text-xs font-bold tracking-wider", isDark ? "text-[#c97a5a]" : "text-[#a0522d]")}>
              CAPTURING
            </span>
          )}
          <span className={cn("text-xs", isDark ? "text-slate-400" : "text-white/60")}>
            {packets.length} packet{packets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className={cn("text-xs transition-transform", isDark ? "text-slate-400" : "text-white/60", !expanded && "-rotate-90")}>
          {"\u25BC"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Column headers */}
            <div
              className={cn(
                "grid px-3 sm:px-4 py-1.5 border-b text-xs font-bold tracking-wider",
                c.border,
                c.textDim
              )}
              style={{
                fontFamily: MONO,
                gridTemplateColumns: "24px 64px 52px 52px 32px 72px 1fr",
                gap: "0 12px",
              }}
            >
              <span className={c.colBorder}>#</span>
              <span className={c.colBorder}>Time</span>
              <span className={c.colBorder}>Source</span>
              <span className={c.colBorder}>Dest</span>
              <span className={c.colBorder}>Len</span>
              <span className={c.colBorder}>Phase</span>
              <span>Info</span>
            </div>

            {/* Packet rows */}
            <div className="max-h-[240px] sm:max-h-[300px] overflow-y-auto">
              {packets.map((packet, idx) => (
                <div key={packet.id}>
                  {/* Phase divider */}
                  {isNewPhase(idx) && (
                    <div className={cn(
                      "px-4 py-1 text-center text-xs tracking-widest font-bold border-y",
                      c.divider,
                      c.textDim,
                      isDark ? "bg-[#0b1220]" : "bg-gray-50"
                    )}>
                      {"\u2500\u2500\u2500"} {packet.phase === "handshake" ? "noise handshake" : packet.phase} {"\u2500\u2500\u2500"}
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedId(packet.id === selectedId ? null : packet.id)}
                    className={cn(
                      "w-full grid px-3 sm:px-4 py-1.5 text-left transition-colors border-b",
                      c.divider,
                      c.rowHover,
                      packet.id === selectedId ? c.rowSelected : getRowBg(packet),
                      packet.id === selectedId && (isDark ? "border-l-2 border-l-blue-500" : "border-l-2 border-l-blue-500")
                    )}
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      gridTemplateColumns: "24px 64px 52px 52px 32px 72px 1fr",
                gap: "0 12px",
                    }}
                  >
                    <span className={cn(c.textDim, c.colBorder, "whitespace-nowrap")}>{packet.id}</span>
                    <span className={cn(c.textMuted, c.colBorder, "whitespace-nowrap")}>{formatTime(packet.timestamp)}</span>
                    <span className={cn(getDirectionColor(packet), c.colBorder, "whitespace-nowrap")}>
                      {packet.direction === "sent" ? "You" : "Server"}
                    </span>
                    <span className={cn(getDirectionColor(packet), c.colBorder, "whitespace-nowrap")}>
                      {packet.direction === "sent" ? "Server" : "You"}
                    </span>
                    <span className={cn(c.textMuted, c.colBorder, "whitespace-nowrap")}>{packet.rawBytes.length || "\u2014"}</span>
                    <span className={cn(getPhaseColor(packet), c.colBorder, "whitespace-nowrap")}>{getPhaseLabel(packet)}</span>
                    <span className={cn(c.text, "truncate")}>{getInfoHex(packet)}</span>
                  </button>
                </div>
              ))}
              <div ref={tableEndRef} />
            </div>

            {/* Detail panel for selected packet */}
            <AnimatePresence>
              {selectedPacket && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={cn("border-t border-dashed p-3 sm:p-4", c.divider, c.detailBg)}>
                    {/* Packet summary line */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn("text-sm font-bold tracking-wider", getPhaseColor(selectedPacket))}>
                        PACKET #{selectedPacket.id}
                      </span>
                      <span className={cn("text-sm", c.textDim)}>
                        {selectedPacket.label}
                      </span>
                      {selectedPacket.decryptedText && selectedPacket.phase === "transport" && (
                        <span className={cn("text-sm ml-auto", c.green)}>
                          Decrypted: "{selectedPacket.decryptedText}"
                        </span>
                      )}
                    </div>

                    {/* Enriched tooltip */}
                    <div className={cn("text-sm mb-3 leading-relaxed", c.textMuted)}>
                      {getEnrichedTooltip(selectedPacket)}
                    </div>

                    {/* Field breakdown */}
                    {selectedFields.length > 0 && selectedPacket.rawBytes.length > 0 && (
                      <div className="space-y-3">
                        {/* Field labels */}
                        <div className="space-y-1">
                          {selectedFields.map((field, i) => {
                            const fieldColors = FIELD_COLORS[field.type];
                            const mode = isDark ? fieldColors.dark : fieldColors.light;
                            const fieldBytes = selectedPacket.rawBytes.slice(field.startByte, field.endByte + 1);
                            return (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <span className={cn("inline-block w-2 h-2 rounded-sm mt-0.5 shrink-0", mode.bg)} />
                                <span className={cn("font-bold shrink-0 w-28", mode.text)}>
                                  {field.label}
                                </span>
                                <span className={cn("shrink-0", c.textDim)} style={{ fontFamily: MONO }}>
                                  ({field.endByte - field.startByte + 1} byte{field.endByte !== field.startByte ? "s" : ""})
                                </span>
                                <span className={c.textMuted} style={{ fontFamily: MONO }}>
                                  {bytesToTruncatedHex(fieldBytes, 10)}
                                </span>
                                {field.chapterRef && (
                                  <a
                                    href={`/noise-tutorial/${field.chapterRef}`}
                                    className={cn("shrink-0 underline underline-offset-2", isDark ? "text-[#FFD700]/60" : "text-[#b8860b]/60")}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Ch. {field.chapterRef.replace(/-/g, " ")}
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Byte grid with color coding */}
                        <div
                          className={cn("rounded border p-2", c.detailBorder)}
                        >
                          <div
                            className="grid gap-0.5"
                            style={{
                              fontFamily: MONO,
                              gridTemplateColumns: "repeat(auto-fill, minmax(22px, 1fr))",
                            }}
                          >
                            {Array.from(selectedPacket.rawBytes).map((byte, idx) => {
                              const field = getFieldForByte(selectedFields, idx);
                              const fieldType = field?.type ?? "version";
                              const colors = FIELD_COLORS[fieldType];
                              const mode = isDark ? colors.dark : colors.light;

                              return (
                                <Tooltip key={idx} delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        "text-[10px] px-0.5 py-0.5 rounded-sm text-center cursor-default transition-all",
                                        mode.bg,
                                        mode.text,
                                        "hover:ring-1 hover:ring-offset-0",
                                        isDark ? "hover:ring-white/30" : "hover:ring-black/20"
                                      )}
                                    >
                                      {byte.toString(16).padStart(2, "0")}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className={cn(
                                      "text-xs px-3 py-2 max-w-[220px]",
                                      c.tooltipBg,
                                      c.tooltipBorder,
                                      c.tooltipText,
                                      "border"
                                    )}
                                  >
                                    <div className="space-y-1">
                                      <div className="font-bold text-xs">
                                        {field?.label ?? "Unknown"}
                                      </div>
                                      <div className={cn("text-xs", c.textDim)}>
                                        Byte {idx} of {selectedPacket.rawBytes.length}
                                      </div>
                                      <div className={cn("text-xs", c.textDim)} style={{ fontFamily: MONO }}>
                                        0x{byte.toString(16).padStart(2, "0")} = {byte}
                                        {selectedPacket.phase === "probe" && (
                                          <> = '{String.fromCharCode(byte)}'</>
                                        )}
                                      </div>
                                      {field?.tooltip && (
                                        <div className={cn("text-xs pt-1 border-t", c.divider)}>
                                          {field.tooltip}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>

                        {/* Legend */}
                        <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm", c.textDim)}>
                          {selectedFields.map((field, i) => {
                            const fieldColors = FIELD_COLORS[field.type];
                            const mode = isDark ? fieldColors.dark : fieldColors.light;
                            return (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className={cn("inline-block w-2 h-2 rounded-sm", mode.bg)} />
                                <span>{field.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Special display for close frames */}
                    {selectedPacket.closeCode && (
                      <div className={cn("text-sm leading-relaxed mt-2", c.textMuted)} style={{ fontFamily: MONO }}>
                        <span className={c.red}>Close Frame</span>
                        {" \u2014 "}
                        Code: {selectedPacket.closeCode}
                        {selectedPacket.closeReason && `, Reason: "${selectedPacket.closeReason}"`}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
