/**
 * ServerProbe — "Is the server real?" discovery component.
 *
 * Opens a raw WebSocket to the Noise handshake endpoint, sends plaintext
 * "hello", and shows the server's rejection. Proves the server exists
 * and requires Noise Protocol authentication.
 *
 * Appears above the HandshakeVisualizer in the Live Connection Lab.
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CapturedPacket } from "@/components/WireInspector";

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';

// ── Types ──

interface ServerProbeProps {
  theme: "light" | "dark";
  onPacketCaptured: (packet: Omit<CapturedPacket, "id">) => void;
}

type ProbeStep = "idle" | "connecting" | "connected" | "sending" | "rejected" | "error";

// ── Component ──

export default function ServerProbe({ theme, onPacketCaptured }: ServerProbeProps) {
  const isDark = theme === "dark";
  const wsRef = useRef<WebSocket | null>(null);
  const stepRef = useRef<ProbeStep>("idle");
  const [step, setStep] = useState<ProbeStep>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const [closeReason, setCloseReason] = useState<string | null>(null);
  const probeStartRef = useRef<number>(0);

  const runProbe = useCallback(async () => {
    // Prevent re-running while in progress
    if (step !== "idle" && step !== "rejected" && step !== "error") return;

    const updateStep = (s: ProbeStep) => { stepRef.current = s; setStep(s); };
    updateStep("connecting");
    setErrorMsg(null);
    setCloseCode(null);
    setCloseReason(null);
    probeStartRef.current = performance.now();

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/noise-handshake`;

    try {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        updateStep("connected");

        // Brief pause so the student can see "connected" before we send
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            updateStep("sending");

            const plaintext = new TextEncoder().encode("hello");

            // Capture the outgoing plaintext packet
            onPacketCaptured({
              timestamp: new Date(),
              direction: "sent",
              phase: "probe",
              rawBytes: plaintext,
              label: 'Plaintext: "hello"',
              decryptedText: "hello",
            });

            ws.send(plaintext);
          }
        }, 1200);
      };

      ws.onclose = (event) => {
        const code = event.code;
        const reason = event.reason || `code ${code}`;

        setCloseCode(code);
        setCloseReason(reason);
        updateStep("rejected");

        // Capture the server's close frame
        onPacketCaptured({
          timestamp: new Date(),
          direction: "received",
          phase: "probe",
          rawBytes: new Uint8Array(0),
          label: `Close: ${code}`,
          closeCode: code,
          closeReason: reason,
        });

        wsRef.current = null;
      };

      ws.onerror = () => {
        // onerror fires before onclose; if we haven't connected yet, show error
        if (stepRef.current === "connecting") {
          updateStep("error");
          setErrorMsg("Could not reach the server. Check your connection and try again.");
          wsRef.current = null;
        }
      };
    } catch (err) {
      updateStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  }, [step, onPacketCaptured]);

  // ── Theme colors (bitcoin.design sketch style) ──
  const colors = isDark
    ? {
        cardBg: "bg-[#0f1930]",
        cardBorder: "border-[#2a3552]",
        headerBg: "bg-white/10",
        headerText: "text-white",
        text: "text-slate-200",
        textMuted: "text-slate-400",
        textDim: "text-slate-600",
        green: "text-[#8cb369]",
        greenBg: "bg-[#5a7a2f]/10",
        greenBorder: "border-[#5a7a2f]/30",
        red: "text-[#c97a5a]",
        redBg: "bg-[#a0522d]/10",
        redBorder: "border-[#a0522d]/30",
        yellowBg: "bg-yellow-500/5",
        yellowBorder: "border-[#b8860b]/30",
        yellow: "text-yellow-400",
        codeBg: "bg-black",
        codeBorder: "border-[#333]",
      }
    : {
        cardBg: "bg-white",
        cardBorder: "border-black",
        headerBg: "bg-black",
        headerText: "text-white",
        text: "text-[#2a1f0d]",
        textMuted: "text-[#6b5d4f]",
        textDim: "text-[#9a8b78]",
        green: "text-[#5a7a2f]",
        greenBg: "bg-[#5a7a2f]/8",
        greenBorder: "border-[#5a7a2f]/25",
        red: "text-[#a0522d]",
        redBg: "bg-[#a0522d]/8",
        redBorder: "border-[#a0522d]/25",
        yellowBg: "bg-[#b8860b]/5",
        yellowBorder: "border-[#b8860b]/20",
        yellow: "text-[#b8860b]",
        codeBg: "bg-black",
        codeBorder: "border-black",
      };

  const isComplete = step === "rejected";
  const canProbe = step === "idle" || step === "rejected" || step === "error";

  return (
    <div
      className={cn(
        "border-[1.5px] overflow-hidden transition-opacity",
        colors.cardBorder,
        colors.cardBg,
        isComplete && "opacity-90"
      )}
      style={{ fontFamily: SANS }}
    >
      {/* Inverted header */}
      <div
        className={cn(
          "px-4 py-2 flex items-center gap-2",
          colors.headerBg
        )}
      >
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            isComplete
              ? "bg-[#8cb369]"
              : step === "connecting" || step === "connected" || step === "sending"
                ? "bg-amber-400 animate-pulse"
                : step === "error"
                  ? "bg-[#c97a5a]"
                  : "bg-white/40"
          )}
        />
        <span className={cn("text-sm font-bold tracking-[0.08em] uppercase", colors.headerText)}>
          Server Probe
        </span>
        {isComplete && (
          <span className={cn("text-xs ml-auto", isDark ? "text-[#8cb369]" : "text-white/60")}>
            complete
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 sm:p-6 space-y-4">
        {/* Intro text (idle state) */}
        {step === "idle" && (
          <div className={cn("text-sm leading-relaxed", colors.text)}>
            Before we attempt the Noise handshake, let's verify the server is real.
            We'll open a raw WebSocket connection and try sending a plaintext message.
          </div>
        )}

        {/* Step indicators */}
        <div className="space-y-3">
          {/* Step 1: Connection */}
          <AnimatePresence>
            {step !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "shrink-0 w-5 text-center text-sm",
                    step === "connecting"
                      ? "text-amber-400 animate-pulse"
                      : step === "error"
                        ? colors.red
                        : colors.green
                  )}>
                    {step === "connecting" ? "\u25CB" : step === "error" ? "\u2717" : "\u2713"}
                  </span>
                  <span className={cn("text-sm", colors.text)}>
                    {step === "connecting"
                      ? "Opening WebSocket connection..."
                      : step === "error"
                        ? "Connection failed"
                        : "WebSocket connected to /ws/noise-handshake"
                    }
                  </span>
                </div>

                {/* Connection detail */}
                {step !== "connecting" && step !== "error" && (
                  <div
                    className={cn(
                      "ml-7 px-3 py-2 rounded border text-sm",
                      colors.greenBg,
                      colors.greenBorder
                    )}
                  >
                    <span className={colors.green}>Server is live</span>
                    <span className={colors.textDim}> — TCP + WebSocket upgrade succeeded</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 2: Plaintext send */}
          <AnimatePresence>
            {(step === "sending" || step === "rejected") && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: step === "sending" ? 0.3 : 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "shrink-0 w-5 text-center text-sm",
                    step === "sending" ? "text-amber-400 animate-pulse" : colors.yellow
                  )}>
                    {step === "sending" ? "\u25CB" : "\u2192"}
                  </span>
                  <span className={cn("text-sm", colors.text)}>
                    {step === "sending"
                      ? 'Sending plaintext "hello"...'
                      : 'Sent plaintext "hello" (5 bytes)'
                    }
                  </span>
                </div>

                {/* Show the raw bytes */}
                <div
                  className={cn(
                    "ml-7 rounded border overflow-hidden",
                    colors.codeBorder
                  )}
                >
                  <div className={cn("px-3 py-2", colors.codeBg)}>
                    <div className="flex items-center gap-3" style={{ fontFamily: MONO }}>
                      <span className="text-xs text-yellow-400/80">ASCII</span>
                      <span className="text-sm text-yellow-300 tracking-wider">
                        h e l l o
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1" style={{ fontFamily: MONO }}>
                      <span className="text-xs text-slate-500">HEX</span>
                      <span className="text-xs text-slate-400 tracking-wider">
                        68 65 6c 6c 6f
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 3: Rejection */}
          <AnimatePresence>
            {step === "rejected" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn("shrink-0 w-5 text-center text-sm", colors.red)}>
                    {"\u2717"}
                  </span>
                  <span className={cn("text-sm font-medium", colors.red)}>
                    Server rejected the connection
                  </span>
                </div>

                {/* Rejection details */}
                <div
                  className={cn(
                    "ml-7 px-3 py-3 rounded border text-sm space-y-2",
                    colors.redBg,
                    colors.redBorder
                  )}
                >
                  <div>
                    <span className={cn("font-bold", colors.red)}>Close code: </span>
                    <span className={colors.text} style={{ fontFamily: MONO }}>
                      {closeCode}
                    </span>
                  </div>
                  {closeReason && (
                    <div>
                      <span className={cn("font-bold", colors.red)}>Reason: </span>
                      <span className={colors.text} style={{ fontFamily: MONO }}>
                        {closeReason}
                      </span>
                    </div>
                  )}
                </div>

                {/* Educational explanation */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className={cn(
                    "ml-7 px-3 py-3 rounded border text-sm leading-relaxed",
                    colors.yellowBg,
                    colors.yellowBorder
                  )}
                >
                  <span className={cn("font-bold", colors.text)}>What happened? </span>
                  <span className={colors.textMuted}>
                    The server expected a 50-byte Noise Protocol Act 1 message
                    (1-byte version + 33-byte ephemeral public key + 16-byte MAC).
                    We sent 5 bytes of ASCII text. The server can't parse it, so it closes the connection.
                  </span>
                  <div className={cn("mt-2 pt-2 border-t", isDark ? "border-yellow-500/20" : "border-yellow-300")}>
                    <span className={cn("font-bold", colors.text)}>This proves two things: </span>
                    <span className={colors.textMuted}>
                      the server is real and listening, and it only speaks Noise Protocol.
                      Your handshake code is the only way in.
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          <AnimatePresence>
            {step === "error" && errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "ml-7 px-3 py-2 rounded border text-sm",
                  colors.redBg,
                  colors.redBorder,
                  colors.red
                )}
              >
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action button */}
        <div className="flex justify-center pt-2">
          <button
            onClick={runProbe}
            disabled={!canProbe}
            className={cn(
              "px-5 py-2.5 text-sm font-bold uppercase tracking-[0.05em] border-[1.5px] transition-all",
              canProbe
                ? isComplete
                  ? isDark
                    ? "border-slate-600 text-slate-400 hover:bg-slate-700/50"
                    : "border-[#9a8b78] text-[#9a8b78] hover:bg-black/5"
                  : isDark
                    ? "border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700]/10"
                    : "border-black bg-white text-black hover:bg-black hover:text-white"
                : "opacity-50 cursor-not-allowed border-[#9a8b78] text-[#9a8b78]"
            )}
          >
            {step === "idle"
              ? "Probe Server"
              : step === "connecting" || step === "connected" || step === "sending"
                ? "Probing..."
                : isComplete
                  ? "Probe Again"
                  : "Retry Probe"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
