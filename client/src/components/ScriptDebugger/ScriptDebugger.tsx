import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { TIMEOUT_PATH, PREIMAGE_PATH } from "./script-data";
import type { StackItem, ScriptPath } from "./types";

// ─── Color mapping for stack item pills ─────────────────────────────────────

const STACK_COLORS: Record<StackItem["color"], { dark: string; light: string }> = {
  blue: {
    dark: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    light: "bg-blue-100 text-blue-800 border-blue-300",
  },
  green: {
    dark: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    light: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  gray: {
    dark: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    light: "bg-gray-100 text-gray-700 border-gray-300",
  },
  gold: {
    dark: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    light: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  purple: {
    dark: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    light: "bg-purple-100 text-purple-800 border-purple-300",
  },
  red: {
    dark: "bg-red-500/20 text-red-300 border-red-500/40",
    light: "bg-red-100 text-red-800 border-red-300",
  },
};

// ─── Script line syntax highlighting ─────────────────────────────────────────

function highlightScriptLine(
  line: string,
  dark: boolean,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match comments, OP_* opcodes, <...> placeholders, and numbers
  const regex = /(#[^\n]*)|(OP_\w+)|(<[^>]+>)|(\b\d+\b)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    // Push any text between the last match and this one
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`} className={dark ? "text-slate-400" : "text-gray-500"}>
          {line.slice(lastIndex, match.index)}
        </span>,
      );
    }

    const [text, comment, opcode, placeholder, number] = match;

    if (comment) {
      parts.push(
        <span key={`c-${match.index}`} className={`italic ${dark ? "text-slate-500" : "text-gray-400"}`}>
          {text}
        </span>,
      );
    } else if (opcode) {
      parts.push(
        <span
          key={`o-${match.index}`}
          className={`font-bold ${dark ? "text-yellow-300" : "text-yellow-700"}`}
        >
          {text}
        </span>,
      );
    } else if (placeholder) {
      parts.push(
        <span
          key={`p-${match.index}`}
          className={`italic ${dark ? "text-cyan-400" : "text-blue-600"}`}
        >
          {text}
        </span>,
      );
    } else if (number) {
      parts.push(
        <span key={`n-${match.index}`} className={dark ? "text-slate-300" : "text-gray-600"}>
          {text}
        </span>,
      );
    }

    lastIndex = match.index + text.length;
  }

  // Push any remaining text
  if (lastIndex < line.length) {
    parts.push(
      <span key={`t-${lastIndex}`} className={dark ? "text-slate-400" : "text-gray-500"}>
        {line.slice(lastIndex)}
      </span>,
    );
  }

  return <>{parts}</>;
}

// ─── Sub-components (all inline) ─────────────────────────────────────────────

function WitnessBar({
  data,
  consumedCount,
  dark,
}: {
  data: ScriptPath;
  consumedCount: number;
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        dark
          ? "border-[#2a3552] bg-[#0f1930]"
          : "border-[#d4c9a8] bg-white"
      }`}
    >
      <div className="font-pixel text-[10px] tracking-wider mb-1.5 uppercase" style={{ color: dark ? "#FFD700" : "#7a5600" }}>
        Witness
      </div>
      <div className="flex flex-wrap gap-1.5">
        {data.witnessItems.map((item, i) => {
          const consumed = i < consumedCount || consumedCount >= data.witnessItems.length;
          const colorClass = STACK_COLORS[item.color][dark ? "dark" : "light"];
          return (
            <span
              key={i}
              className={`inline-block rounded border px-2 py-0.5 text-xs font-sans transition-opacity duration-300 ${colorClass} ${
                consumed ? "opacity-30" : "opacity-100"
              }`}
            >
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScriptView({
  data,
  currentLine,
  skipLines,
  dark,
}: {
  data: ScriptPath;
  currentLine: number;
  skipLines: number[];
  dark: boolean;
}) {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const line = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const lineRect = line.getBoundingClientRect();

      // Scroll the active line into view if it's outside the visible area
      if (lineRect.top < containerRect.top || lineRect.bottom > containerRect.bottom) {
        line.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [currentLine]);

  return (
    <div
      className={`rounded-md border flex-1 min-w-0 ${
        dark
          ? "border-[#2a3552] bg-[#0a0f1a]"
          : "border-[#d4c9a8] bg-[#faf7f0]"
      }`}
    >
      <div
        className={`font-pixel text-[10px] tracking-wider uppercase px-3 py-1.5 border-b ${
          dark
            ? "border-[#2a3552] bg-[#0f1930]"
            : "border-[#d4c9a8] bg-white"
        }`}
        style={{ color: dark ? "#FFD700" : "#7a5600" }}
      >
        Script
      </div>
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-auto font-sans text-xs leading-6"
        style={{ maxHeight: 320 }}
      >
        {data.scriptLines.map((line, i) => {
          const isActive = i === currentLine;
          const isSkipped = skipLines.includes(i);
          return (
            <div
              key={i}
              ref={isActive ? activeLineRef : undefined}
              className={`px-3 transition-all duration-200 whitespace-pre ${
                isActive
                  ? dark
                    ? "bg-yellow-500/10 border-l-2 border-l-yellow-400"
                    : "bg-yellow-100/60 border-l-2 border-l-yellow-600"
                  : "border-l-2 border-l-transparent"
              } ${isSkipped ? "opacity-25" : ""}`}
            >
              <span className={`mr-2 inline-block w-5 text-right select-none ${dark ? "text-slate-600" : "text-gray-400"}`}>
                {i}
              </span>
              {highlightScriptLine(line, dark)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackView({
  items,
  dark,
}: {
  items: StackItem[];
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-md border flex-1 min-w-0 ${
        dark
          ? "border-[#2a3552] bg-[#0a0f1a]"
          : "border-[#d4c9a8] bg-[#faf7f0]"
      }`}
    >
      <div
        className={`font-pixel text-[10px] tracking-wider uppercase px-3 py-1.5 border-b ${
          dark
            ? "border-[#2a3552] bg-[#0f1930]"
            : "border-[#d4c9a8] bg-white"
        }`}
        style={{ color: dark ? "#FFD700" : "#7a5600" }}
      >
        Stack
      </div>
      <div className="p-3 overflow-y-auto" style={{ maxHeight: 320 }}>
        {items.length === 0 ? (
          <div className={`text-xs italic ${dark ? "text-slate-500" : "text-gray-400"}`}>
            (empty)
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item, i) => {
              const colorClass = STACK_COLORS[item.color][dark ? "dark" : "light"];
              return (
                <div
                  key={`${item.value}-${i}`}
                  className={`rounded border px-2.5 py-1 text-xs font-sans transition-all duration-300 ${colorClass}`}
                >
                  {i === 0 && (
                    <span
                      className={`text-[9px] font-sans font-bold uppercase mr-1.5 ${
                        dark ? "text-yellow-500/60" : "text-yellow-700/50"
                      }`}
                    >
                      TOP
                    </span>
                  )}
                  {item.value}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ExplanationPanel({
  opcode,
  action,
  dark,
}: {
  opcode: string;
  action: string;
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        dark
          ? "border-[#2a3552] bg-[#0f1930]"
          : "border-[#d4c9a8] bg-white"
      }`}
    >
      <span
        className={`font-sans text-xs font-bold mr-2 ${
          dark ? "text-yellow-300" : "text-yellow-700"
        }`}
      >
        {opcode}
      </span>
      <span className={`text-sm font-sans ${dark ? "text-slate-300" : "text-foreground"}`}>
        {action}
      </span>
    </div>
  );
}

function ControlBar({
  currentStep,
  totalSteps,
  playing,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onTogglePlay,
  dark,
  isMobile,
}: {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onTogglePlay: () => void;
  dark: boolean;
  isMobile: boolean;
}) {
  const gold = dark ? "#FFD700" : "#7a5600";
  const btnBase = `font-sans text-xs font-semibold px-2.5 py-1.5 rounded border transition-colors duration-150 ${
    dark
      ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#1a2744] active:bg-[#243358]"
      : "border-[#d4c9a8] bg-white hover:bg-[#f5f0e8] active:bg-[#ebe4d4]"
  }`;
  const disabledClass = "opacity-30 cursor-not-allowed";

  return (
    <div
      className={`flex items-center justify-between gap-2 flex-wrap ${
        isMobile ? "flex-col" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button
          className={`${btnBase} ${currentStep === 0 ? disabledClass : ""}`}
          onClick={onFirst}
          disabled={currentStep === 0}
          style={{ color: gold }}
          aria-label="First step"
        >
          |&lt;
        </button>
        <button
          className={`${btnBase} ${currentStep === 0 ? disabledClass : ""}`}
          onClick={onPrev}
          disabled={currentStep === 0}
          style={{ color: gold }}
          aria-label="Previous step"
        >
          &lt;
        </button>
        <button
          className={`${btnBase} ${currentStep >= totalSteps - 1 ? disabledClass : ""}`}
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          style={{ color: gold }}
          aria-label="Next step"
        >
          &gt;
        </button>
        <button
          className={`${btnBase} ${currentStep >= totalSteps - 1 ? disabledClass : ""}`}
          onClick={onLast}
          disabled={currentStep >= totalSteps - 1}
          style={{ color: gold }}
          aria-label="Last step"
        >
          &gt;|
        </button>
      </div>

      <button
        className={`${btnBase} min-w-[72px]`}
        onClick={onTogglePlay}
        style={{ color: gold }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "Pause" : "Play"}
      </button>

      <div
        className={`font-sans text-xs ${
          dark ? "text-slate-400" : "text-gray-500"
        }`}
      >
        Step {currentStep + 1} of {totalSteps}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ScriptDebugger({
  path,
  theme,
}: {
  path: "timeout" | "preimage";
  theme: "light" | "dark";
}) {
  const data: ScriptPath = path === "timeout" ? TIMEOUT_PATH : PREIMAGE_PATH;
  const isMobile = useIsMobile();
  const dark = theme === "dark";

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const step = data.steps[currentStep];
  const totalSteps = data.steps.length;

  // Reset when path changes
  useEffect(() => {
    setCurrentStep(0);
    setPlaying(false);
  }, [path]);

  // Auto-play timer
  useEffect(() => {
    if (!playing) return;
    if (currentStep >= totalSteps - 1) {
      setPlaying(false);
      return;
    }
    const timer = setInterval(() => {
      setCurrentStep((s) => {
        if (s >= totalSteps - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [playing, currentStep, totalSteps]);

  // Compute cumulative consumed witness items up to the current step
  const consumedWitness = data.steps
    .slice(0, currentStep + 1)
    .reduce((sum, s) => sum + s.consumed, 0);

  // Collect all skip lines from the current step
  const skipLines = step.skipLines ?? [];

  const handleFirst = useCallback(() => {
    setCurrentStep(0);
    setPlaying(false);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((s) => Math.min(totalSteps - 1, s + 1));
  }, [totalSteps]);

  const handleLast = useCallback(() => {
    setCurrentStep(totalSteps - 1);
    setPlaying(false);
  }, [totalSteps]);

  const handleTogglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return (
    <div
      className={`rounded-lg border my-6 overflow-hidden font-sans ${
        dark
          ? "border-[#2a3552] bg-[#0b1220]"
          : "border-[#d4c9a8] bg-[#fdf9f2]"
      }`}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full px-4 py-2.5 flex items-center justify-between cursor-pointer ${
          expanded ? "border-b" : ""
        } ${
          dark
            ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#1a2744]"
            : "border-[#d4c9a8] bg-white hover:bg-[#f5f0e8]"
        }`}
      >
        <h3
          className="font-pixel text-sm tracking-wide"
          style={{ color: dark ? "#FFD700" : "#7a5600" }}
        >
          Script Debugger: {data.name}
        </h3>
        <span
          className={`text-xs transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          style={{ color: dark ? "#FFD700" : "#7a5600" }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="p-3 flex flex-col gap-3">
          {/* Description */}
          <p className={`text-sm leading-relaxed ${dark ? "text-slate-300" : "text-gray-700"}`}>
            {data.description}
          </p>

          {/* Witness bar */}
          <WitnessBar data={data} consumedCount={consumedWitness} dark={dark} />

          {/* Script + Stack side by side (or stacked on mobile) */}
          <div className={`flex gap-3 ${isMobile ? "flex-col" : "flex-row"}`}>
            <ScriptView
              data={data}
              currentLine={step.scriptLine}
              skipLines={skipLines}
              dark={dark}
            />
            <StackView items={step.stackAfter} dark={dark} />
          </div>

          {/* Explanation */}
          <ExplanationPanel
            opcode={step.opcode}
            action={step.action}
            dark={dark}
          />

          {/* Controls */}
          <ControlBar
            currentStep={currentStep}
            totalSteps={totalSteps}
            playing={playing}
            onFirst={handleFirst}
            onPrev={handlePrev}
            onNext={handleNext}
            onLast={handleLast}
            onTogglePlay={handleTogglePlay}
            dark={dark}
            isMobile={isMobile}
          />
        </div>
      )}
    </div>
  );
}
