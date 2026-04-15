/**
 * BurstSendControl — Inline form to trigger rapid message sending
 * for demonstrating key rotation at nonce 1000.
 *
 * Auto-calculates the number of messages needed to reach the next
 * rotation boundary. Each message uses 2 nonces, so 500 messages = 1 rotation.
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';
const ROTATION_THRESHOLD = 1000;

interface BurstSendControlProps {
  currentSendNonce: number;
  isReady: boolean;
  isBurstRunning: boolean;
  burstProgress: { phase: "send" | "drain"; sent: number; total: number; sendNonce: number } | null;
  onBurst: (count: number) => void;
  theme: "light" | "dark";
}

export default function BurstSendControl({
  currentSendNonce,
  isReady,
  isBurstRunning,
  burstProgress,
  onBurst,
  theme,
}: BurstSendControlProps) {
  const isDark = theme === "dark";

  // Calculate messages needed to reach next rotation
  const messagesToRotation = useMemo(() => {
    const noncesRemaining = ROTATION_THRESHOLD - (currentSendNonce % ROTATION_THRESHOLD);
    // Each message uses 2 nonces
    return Math.ceil(noncesRemaining / 2);
  }, [currentSendNonce]);

  const [count, setCount] = useState<string>("");
  const effectiveCount = count ? parseInt(count, 10) : messagesToRotation;
  const isValid = effectiveCount > 0 && effectiveCount <= 2000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady || isBurstRunning || !isValid) return;
    onBurst(effectiveCount);
  };

  // Progress display during burst
  if (isBurstRunning && burstProgress) {
    const pct = Math.round((burstProgress.sent / burstProgress.total) * 100);
    const label = burstProgress.phase === "send"
      ? `${burstProgress.sent}/${burstProgress.total} sent`
      : "Processing responses...";

    return (
      <div className="flex items-center gap-2">
        <Zap className={cn("w-3 h-3 shrink-0 animate-pulse", isDark ? "text-[#FFD700]" : "text-[#b8860b]")} />
        <div className="flex-1 min-w-0">
          <div className={cn("h-4 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-black/10")}>
            <motion.div
              className={cn("h-full rounded-full", isDark ? "bg-[#FFD700]/50" : "bg-[#b8860b]/40")}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            />
          </div>
        </div>
        <span className={cn("text-xs tabular-nums shrink-0", isDark ? "text-white/90" : "text-black/80")} style={{ fontFamily: MONO }}>
          {label} (nonce: {burstProgress.sendNonce})
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Zap className={cn("w-3.5 h-3.5 shrink-0", isDark ? "text-white/80" : "text-[#b8860b]")} />
      <span className={cn("text-xs uppercase tracking-wider shrink-0 font-semibold", isDark ? "text-white/90" : "text-[#2a1f0d]")}>
        Burst:
      </span>
      <span className={cn("text-xs shrink-0", isDark ? "text-white/90" : "text-[#2a1f0d]")}>
        Send
      </span>
      <input
        type="number"
        min={1}
        max={2000}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        placeholder={String(messagesToRotation)}
        disabled={!isReady || isBurstRunning}
        className={cn(
          "w-16 text-center text-sm py-0.5 rounded border outline-none tabular-nums",
          isDark
            ? "bg-white/5 border-white/30 text-white placeholder:text-white/50"
            : "bg-black/5 border-black/30 text-[#2a1f0d] placeholder:text-black/40",
          (!isReady || isBurstRunning) && "opacity-40 cursor-not-allowed"
        )}
        style={{ fontFamily: MONO }}
      />
      <span className={cn("text-xs shrink-0", isDark ? "text-white/90" : "text-[#2a1f0d]")}>
        pings
      </span>
      <button
        type="submit"
        disabled={!isReady || isBurstRunning || !isValid}
        className={cn(
          "px-2.5 py-1 text-xs font-bold uppercase tracking-wider border-[1.5px] transition-colors shrink-0",
          isReady && !isBurstRunning && isValid
            ? isDark
              ? "border-[#FFD700]/40 text-[#FFD700]/80 hover:border-[#FFD700]/70 hover:text-[#FFD700]"
              : "border-[#b8860b]/40 text-[#b8860b]/80 hover:border-[#b8860b]/70 hover:text-[#b8860b]"
            : isDark
              ? "border-white/10 text-white/25 cursor-not-allowed"
              : "border-black/20 text-black/40 cursor-not-allowed"
        )}
        style={{ borderRadius: 999 }}
      >
        GO
      </button>
      <span className={cn("text-xs italic shrink-0 hidden sm:inline", isDark ? "text-white/70" : "text-[#6b5d4f]")}>
        {messagesToRotation} to next send key rotation
      </span>
    </form>
  );
}
