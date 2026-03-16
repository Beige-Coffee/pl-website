/**
 * CipherStateInspector — Live display of the student's CipherState objects.
 *
 * Shows the send and receive cipher state (key, chaining key, nonce) with
 * a progress bar toward the key rotation threshold (nonce 1000). When a key
 * rotates, the card flashes gold and the key value transitions.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { type CipherStateSnapshot } from "@/lib/noise-orchestrator";
import { ChevronDown } from "lucide-react";

const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const ROTATION_THRESHOLD = 1000;

interface CipherStateInspectorProps {
  sendState: CipherStateSnapshot | null;
  recvState: CipherStateSnapshot | null;
  rotatedSide: "send" | "recv" | null;
  theme: "light" | "dark";
}

/** Truncate 64-char hex to first 8 + "..." + last 8 */
function truncHex(hex: string): string {
  if (hex.length <= 20) return hex;
  return hex.slice(0, 8) + "\u2026" + hex.slice(-8);
}

/** Nonce progress bar color: green at 0, amber near 1000 */
function progressColor(nonce: number, isDark: boolean): string {
  const ratio = Math.min(nonce / ROTATION_THRESHOLD, 1);
  if (ratio < 0.5) return isDark ? "bg-emerald-600/70" : "bg-emerald-500/60";
  if (ratio < 0.8) return isDark ? "bg-yellow-600/70" : "bg-yellow-500/60";
  return isDark ? "bg-amber-500/80" : "bg-amber-500/70";
}

function CipherCard({
  label,
  state,
  rotated,
  isDark,
}: {
  label: string;
  state: CipherStateSnapshot | null;
  rotated: boolean;
  isDark: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const prevKeyRef = useRef<string | null>(null);

  // Trigger flash animation on rotation
  useEffect(() => {
    if (rotated && state) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [rotated, state?.key]);

  // Track key for "old key" display during rotation
  useEffect(() => {
    if (state) prevKeyRef.current = state.key;
  }, [state?.key]);

  if (!state) {
    return (
      <div
        className={cn(
          "flex-1 rounded-md border p-3",
          isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"
        )}
      >
        <div className={cn("text-xs font-bold uppercase tracking-wider mb-2", isDark ? "text-slate-500" : "text-[#9a8b78]")}>
          {label}
        </div>
        <div className={cn("text-xs italic", isDark ? "text-slate-600" : "text-[#b0a090]")}>
          Waiting for handshake...
        </div>
      </div>
    );
  }

  const noncePct = Math.min((state.nonce / ROTATION_THRESHOLD) * 100, 100);

  return (
    <motion.div
      className={cn(
        "flex-1 rounded-md border p-3 transition-colors duration-300",
        flash
          ? "border-[#b8860b] shadow-[0_0_12px_rgba(255,215,0,0.3)]"
          : isDark
            ? "border-white/10 bg-white/[0.02]"
            : "border-black/10 bg-black/[0.02]"
      )}
      animate={flash ? { scale: [1, 1.01, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Card label */}
      <div className={cn("text-sm font-bold uppercase tracking-wider mb-3", isDark ? "text-slate-400" : "text-[#6b5d4f]")}>
        {label}
      </div>

      {/* Key */}
      <div className="flex items-baseline gap-2.5 mb-2">
        <span className={cn("text-xs uppercase tracking-wider w-7 shrink-0 font-semibold", isDark ? "text-[#FFD700]/60" : "text-[#b8860b]/70")}>
          key
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={state.key.slice(0, 16)}
            className={cn("text-sm", isDark ? "text-slate-300" : "text-[#4a3a2a]")}
            style={{ fontFamily: MONO }}
            initial={flash ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {truncHex(state.key)}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Chaining key */}
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className={cn("text-xs uppercase tracking-wider w-7 shrink-0 font-semibold", isDark ? "text-slate-600" : "text-[#b0a090]")}>
          ck
        </span>
        <span
          className={cn("text-sm", isDark ? "text-slate-500" : "text-[#8a7a6a]")}
          style={{ fontFamily: MONO }}
        >
          {truncHex(state.ck)}
        </span>
      </div>

      {/* Nonce + progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className={cn("text-xs uppercase tracking-wider font-semibold", isDark ? "text-slate-500" : "text-[#9a8b78]")}>
            nonce
          </span>
          <motion.span
            className={cn("text-lg font-bold tabular-nums", isDark ? "text-slate-200" : "text-[#4a3a2a]")}
            style={{ fontFamily: MONO }}
            key={state.nonce}
            animate={flash ? { scale: [1, 1.3, 1], color: ["#FFD700", "#FFD700", isDark ? "#e2e8f0" : "#4a3a2a"] } : {}}
            transition={{ duration: 0.6 }}
          >
            {state.nonce}
          </motion.span>
          <span className={cn("text-xs tabular-nums", isDark ? "text-slate-600" : "text-[#b0a090]")} style={{ fontFamily: MONO }}>
            / {ROTATION_THRESHOLD}
          </span>
        </div>

        {/* Progress bar */}
        <div className={cn("h-2 rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-black/5")}>
          <motion.div
            className={cn("h-full rounded-full", progressColor(state.nonce, isDark))}
            initial={false}
            animate={{ width: `${noncePct}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Rotation annotation */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className={cn("mt-2.5 pt-2 border-t text-[10px] leading-relaxed", isDark ? "border-white/10 text-[#FFD700]/70" : "border-black/10 text-[#b8860b]/80")}
              style={{ fontFamily: MONO }}
            >
              _maybe_rotate() fired!<br />
              hkdf_two_keys(ck, key) → new keys
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CipherStateInspector({
  sendState,
  recvState,
  rotatedSide,
  theme,
}: CipherStateInspectorProps) {
  const isDark = theme === "dark";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        "rounded-lg border overflow-hidden",
        isDark ? "border-white/10 bg-[#0a0e1a]" : "border-black/10 bg-white"
      )}
      style={{ fontFamily: SANS }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 transition-colors",
          isDark ? "bg-black/40 hover:bg-black/50" : "bg-[#f5f0e8] hover:bg-[#ede5d8]"
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", sendState ? "bg-green-500" : "bg-slate-500")} />
          <span className={cn("text-xs font-bold uppercase tracking-[0.08em]", isDark ? "text-white/80" : "text-[#4a3a2a]")}>
            Cipher State
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            collapsed && "-rotate-90",
            isDark ? "text-white/40" : "text-black/30"
          )}
        />
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 flex flex-col sm:flex-row gap-3">
              <CipherCard
                label="Your Send Key"
                state={sendState}
                rotated={rotatedSide === "send"}
                isDark={isDark}
              />
              <CipherCard
                label="Your Receive Key"
                state={recvState}
                rotated={rotatedSide === "recv"}
                isDark={isDark}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
