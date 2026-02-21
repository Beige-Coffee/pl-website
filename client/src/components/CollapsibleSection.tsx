import { useState, useEffect, useId } from "react";

// ─── Completion circle indicator ─────────────────────────────────────────────

export function CompletionCircle({ completed, dark }: { completed: boolean; dark: boolean }) {
  if (completed) {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
        <circle cx="16" cy="16" r="14" fill={dark ? "#FFD700" : "#b8860b"} stroke={dark ? "#FFD700" : "#b8860b"} strokeWidth="2" />
        <path d="M10 16.5L13.5 20L22 11.5" stroke={dark ? "#0b1220" : "#fff"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <circle cx="16" cy="16" r="14" fill="none" stroke={dark ? "#4a5568" : "#a0a0a0"} strokeWidth="2" />
    </svg>
  );
}

// ─── Chevron icon ────────────────────────────────────────────────────────────

function Chevron({ open, dark }: { open: boolean; dark: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none" stroke={dark ? "#94a3b8" : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}

// ─── Collapsible wrapper for individual items ────────────────────────────────
// Renders a clickable header with chevron + completion circle + title.
// Children (CodeExercise, CheckpointQuestion, etc.) are rendered inside
// with their own border/margin stripped via the `collapsible-content` class.

interface CollapsibleItemProps {
  title: string;
  completed: boolean;
  theme: "light" | "dark";
  defaultOpen?: boolean;
  storageKey?: string;
  children: React.ReactNode;
  label?: string; // e.g. "EXERCISE" or "CHECKPOINT"
  subtitle?: string;
  subtitleLabel?: string;
}

export function CollapsibleItem({
  title,
  completed,
  theme,
  defaultOpen,
  storageKey,
  children,
  label,
  subtitle,
  subtitleLabel,
}: CollapsibleItemProps) {
  const dark = theme === "dark";
  const scopeId = useId().replace(/:/g, "");

  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) return saved === "1";
      } catch {}
    }
    return defaultOpen ?? false;
  });

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, isOpen ? "1" : "0");
      } catch {}
    }
  }, [isOpen, storageKey]);

  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const textColor = dark ? "text-slate-100" : "text-black";
  const greenText = dark ? "text-green-400" : "text-green-700";

  return (
    <div className={`my-4 border-2 ${completed ? goldBorder : cardBorder} ${cardBg} overflow-hidden`}>
      {/* Strip inner component borders/margins so they sit flush inside the collapsible */}
      <style>{`
        #cc-${scopeId} > div { margin: 0 !important; border: none !important; }
      `}</style>

      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors text-left
          ${dark ? "hover:bg-[#132043]" : "hover:bg-black/[0.02]"}`}
      >
        <Chevron open={isOpen} dark={dark} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {label && (
              <span className={`font-pixel text-[10px] ${completed ? greenText : goldText}`}>
                {completed ? `${label} COMPLETED` : label}
              </span>
            )}
          </div>
          <div className={`text-[15px] md:text-[17px] font-semibold ${textColor} truncate`}>
            {title}
          </div>
          {subtitleLabel && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`font-pixel text-[10px] ${goldText}`}>{subtitleLabel}</span>
            </div>
          )}
          {subtitle && (
            <div className={`text-[13px] md:text-[14px] mt-0.5 ${dark ? "text-slate-400" : "text-black/60"}`}
              style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              {subtitle}
            </div>
          )}
        </div>
        <CompletionCircle completed={completed} dark={dark} />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div id={`cc-${scopeId}`} className={`border-t-2 ${cardBorder}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Parent collapsible for grouping multiple items ──────────────────────────

interface CollapsibleGroupProps {
  heading: string;
  description?: string;
  completedCount: number;
  totalCount: number;
  theme: "light" | "dark";
  defaultOpen?: boolean;
  storageKey?: string;
  children: React.ReactNode;
}

export function CollapsibleGroup({
  heading,
  description,
  completedCount,
  totalCount,
  theme,
  defaultOpen,
  storageKey,
  children,
}: CollapsibleGroupProps) {
  const dark = theme === "dark";
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null) return saved === "1";
      } catch {}
    }
    return defaultOpen ?? false;
  });

  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, isOpen ? "1" : "0");
      } catch {}
    }
  }, [isOpen, storageKey]);

  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const cardBg = dark ? "bg-[#0b1220]" : "bg-card";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const greenText = dark ? "text-green-400" : "text-green-700";

  return (
    <div className={`my-8 border-2 ${allCompleted ? goldBorder : cardBorder} ${cardBg} overflow-hidden`}>
      {/* Group header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors text-left
          ${dark ? "hover:bg-[#0f1930]" : "hover:bg-black/[0.02]"}`}
      >
        <Chevron open={isOpen} dark={dark} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-0.5">
            <span className={`font-pixel text-xs ${allCompleted ? greenText : goldText}`}>
              {completedCount}/{totalCount} COMPLETED
            </span>
          </div>
          <div className={`text-lg md:text-xl font-bold ${textColor}`}>
            {heading}
          </div>
          {description && (
            <div className={`text-sm ${textMuted} mt-1 leading-relaxed`}
              style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              {description}
            </div>
          )}
        </div>
        <CompletionCircle completed={allCompleted} dark={dark} />
      </button>

      {/* Collapsible children (nested CollapsibleItems) */}
      {isOpen && (
        <div className={`px-3 pb-2 border-t ${cardBorder}`}>
          {children}
        </div>
      )}
    </div>
  );
}
