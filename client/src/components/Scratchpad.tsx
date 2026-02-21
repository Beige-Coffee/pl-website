import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { runPythonCode, preloadWorker, type CodeRunResult } from "../lib/pyodide-runner";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY_CODE = "pl-scratchpad-code";
const STORAGE_KEY_OPEN = "pl-scratchpad-open";
const STORAGE_KEY_WIDTH = "pl-scratchpad-width";
const STORAGE_KEY_SPLIT = "pl-scratchpad-split";

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 300;
const MAX_WIDTH_RATIO = 0.75; // max 75% of viewport
const DEFAULT_SPLIT = 0.6; // 60% editor, 40% terminal
const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.85;

const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;

const DEFAULT_CODE = `# Scratchpad - experiment freely here!
# Common libraries are available:
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import hashlib
import hmac
import struct

# Try it out - generate a secp256k1 keypair (same curve as Bitcoin/Lightning):
key = ec.generate_private_key(ec.SECP256K1())
pub = key.public_key().public_bytes(Encoding.X962, PublicFormat.CompressedPoint)
print("Public key:", pub.hex())
print("Length:", len(pub), "bytes (33-byte compressed SEC1)")
`;

// ─── Component ───────────────────────────────────────────────────────────────

interface ScratchpadProps {
  theme: "light" | "dark";
}

export default function Scratchpad({ theme }: ScratchpadProps) {
  const dark = theme === "dark";

  // State
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OPEN) === "1";
    } catch {
      return false;
    }
  });
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pyLoading, setPyLoading] = useState(false);

  // Panel width (horizontal resize)
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
      if (saved) return Math.max(MIN_WIDTH, parseInt(saved, 10));
    } catch {}
    return DEFAULT_WIDTH;
  });

  // Editor/terminal split ratio (vertical resize)
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SPLIT);
      if (saved) return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, parseFloat(saved)));
    } catch {}
    return DEFAULT_SPLIT;
  });

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<() => void>(() => {});
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingWidth = useRef(false);
  const isDraggingSplit = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);

  // Persist open/close
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, isOpen ? "1" : "0");
    } catch {}
  }, [isOpen]);

  // Persist width
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(panelWidth));
    } catch {}
  }, [panelWidth]);

  // Persist split
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SPLIT, String(splitRatio));
    } catch {}
  }, [splitRatio]);

  // Pre-warm Pyodide
  useEffect(() => {
    if (isOpen) preloadWorker();
  }, [isOpen]);

  // Listen for "send to scratchpad" events from exercises
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (!code) return;
      if (viewRef.current) {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: code },
        });
        try { localStorage.setItem(STORAGE_KEY_CODE, code); } catch {}
      } else {
        pendingCodeRef.current = code;
        try { localStorage.setItem(STORAGE_KEY_CODE, code); } catch {}
      }
      if (!isOpen) setIsOpen(true);
    };
    window.addEventListener("scratchpad-send-code", handler);
    return () => window.removeEventListener("scratchpad-send-code", handler);
  }, [isOpen]);

  // ── Horizontal drag (panel width) ──────────────────────────────────────

  const handleWidthDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingWidth.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingWidth.current) return;
      const delta = startX - ev.clientX; // dragging left = wider
      const maxW = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.min(maxW, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onUp = () => {
      isDraggingWidth.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  // ── Vertical drag (editor/terminal split) ──────────────────────────────

  const handleSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;
    const startY = e.clientY;
    const startRatio = splitRatio;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSplit.current || !panelRef.current) return;
      const panelRect = panelRef.current.getBoundingClientRect();
      // Content area = panel height minus header (~44px) minus button bar (~40px)
      const headerHeight = 44;
      const buttonBarHeight = 40;
      const contentHeight = panelRect.height - headerHeight - buttonBarHeight;
      if (contentHeight <= 0) return;
      const deltaY = ev.clientY - startY;
      const deltaRatio = deltaY / contentHeight;
      const newRatio = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, startRatio + deltaRatio));
      setSplitRatio(newRatio);
    };

    const onUp = () => {
      isDraggingSplit.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [splitRatio]);

  // ── CodeMirror setup ────────────────────────────────────────────────────

  useEffect(() => {
    if (!editorRef.current || !isOpen) return;

    // Don't remount if already mounted
    if (viewRef.current) {
      if (pendingCodeRef.current) {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: pendingCodeRef.current },
        });
        pendingCodeRef.current = null;
      }
      return;
    }

    let initialCode = DEFAULT_CODE;
    if (pendingCodeRef.current) {
      initialCode = pendingCodeRef.current;
      pendingCodeRef.current = null;
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_CODE);
        if (saved) initialCode = saved;
      } catch {}
    }

    const extensions = [
      basicSetup,
      python(),
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: "Ctrl-Enter",
          mac: "Cmd-Enter",
          run: () => { runRef.current(); return true; },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          try {
            localStorage.setItem(STORAGE_KEY_CODE, code);
          } catch {}
        }
      }),
      ...(dark ? [oneDark] : []),
      EditorView.theme({
        "&": {
          fontSize: "13px",
          border: "none",
          borderRadius: "0px",
          overflow: "hidden",
        },
        ".cm-scroller": { overflow: "auto" },
        ".cm-gutters": {
          backgroundColor: dark ? "#0a0f1a" : "#f5f0e8",
          borderRight: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
        },
      }),
    ];

    const state = EditorState.create({
      doc: initialCode,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isOpen, dark]);

  // Destroy editor when closing
  useEffect(() => {
    if (!isOpen && viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
  }, [isOpen]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, error]);

  // ── Run code ────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (running) return;
    const code = viewRef.current?.state.doc.toString() || "";
    if (!code.trim()) return;

    setRunning(true);
    setPyLoading(true);
    setOutput("");
    setError(null);

    try {
      const result: CodeRunResult = await runPythonCode(code);
      setOutput(result.output);
      if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setRunning(false);
      setPyLoading(false);
    }
  }, [running]);

  // Keep runRef in sync so the CodeMirror keymap closure always calls the latest handler
  runRef.current = handleRun;

  const handleClear = useCallback(() => {
    setOutput("");
    setError(null);
  }, []);

  // ── Theme colors ────────────────────────────────────────────────────────

  const panelBg = dark ? "bg-[#0b1220]" : "bg-[#faf6ef]";
  const panelBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const headerBg = dark ? "bg-[#0f1930]" : "bg-[#f0e8d8]";
  const terminalBg = dark ? "bg-[#060a14]" : "bg-[#1a1a2e]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const dragHandleColor = dark ? "bg-[#2a3552] hover:bg-[#FFD700]/40" : "bg-[#d4c9a8] hover:bg-[#b8860b]/30";

  // ── Toggle button (when closed) ─────────────────────────────────────────

  const [showToggleTooltip, setShowToggleTooltip] = useState(false);

  if (!isOpen) {
    return (
      <div className="fixed top-[78px] right-4 z-40 hidden lg:block">
        <button
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setShowToggleTooltip(true)}
          onMouseLeave={() => setShowToggleTooltip(false)}
          className={`flex items-center gap-2
            font-pixel text-[10px] px-3 py-2 border-2 transition-all cursor-pointer
            ${goldBorder} ${dark ? "bg-[#0f1930] text-[#FFD700] hover:bg-[#132043]" : "bg-[#f0e8d8] text-[#9a7200] hover:bg-[#e8dcc8]"}
            shadow-lg hover:shadow-xl active:scale-95`}
        >
          <span className="text-sm leading-none" style={{ fontFamily: "monospace" }}>{"{ }"}</span>
          <span>SCRATCHPAD</span>
        </button>
        {showToggleTooltip && (
          <div
            className={`absolute top-full right-0 mt-2 w-56 px-3 py-2.5 text-xs z-50 border ${
              dark
                ? "bg-[#0f1930] border-[#2a3552] text-slate-300"
                : "bg-white border-[#d4c9a8] text-black/70"
            } shadow-lg`}
            style={sansFont}
          >
            <div className={`font-pixel text-[10px] mb-1 ${goldText}`}>PYTHON SANDBOX</div>
            <div style={sansFont}>
              Experiment with Python code alongside the exercises. Use "Scratchpad" buttons in exercises to load sample inputs.
            </div>
            <div className={`absolute bottom-full right-4 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent ${
              dark ? "border-b-[#2a3552]" : "border-b-[#d4c9a8]"
            }`} />
          </div>
        )}
      </div>
    );
  }

  // ── Panel (when open) ───────────────────────────────────────────────────

  return (
    <div
      ref={panelRef}
      className={`fixed right-0 top-[68px] z-40 hidden lg:flex flex-col
        h-[calc(100vh-68px)] border-l-2 ${panelBorder} ${panelBg}
        shadow-2xl`}
      style={{ width: panelWidth }}
    >
      {/* Left edge drag handle for horizontal resize */}
      <div
        onMouseDown={handleWidthDragStart}
        className={`absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-50 transition-colors ${dragHandleColor}`}
        title="Drag to resize"
      />

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b-2 ${panelBorder} ${headerBg} shrink-0`}>
        <div className={`font-pixel text-xs ${goldText}`}>SCRATCHPAD</div>
        <button
          onClick={() => setIsOpen(false)}
          className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer
            ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]" : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"}`}
        >
          CLOSE
        </button>
      </div>

      {/* Description */}
      <div className={`px-3 py-2 border-b ${panelBorder} shrink-0`} style={sansFont}>
        <div className={`text-[11px] leading-snug ${textMuted}`}>
          Sandbox for experimenting with Python. Click <span className={`font-pixel text-[9px] ${goldText}`}>SCRATCHPAD</span> in any exercise to load sample inputs here.
        </div>
      </div>

      {/* Editor area (flex portion controlled by splitRatio) */}
      <div
        className="min-h-0 overflow-hidden"
        style={{ flex: `${splitRatio} 0 0` }}
      >
        <div ref={editorRef} className="h-full overflow-auto" />
      </div>

      {/* Vertical drag handle for editor/terminal split */}
      <div
        onMouseDown={handleSplitDragStart}
        className={`shrink-0 h-[5px] cursor-row-resize transition-colors ${dragHandleColor}`}
        title="Drag to resize editor/output"
      />

      {/* Action buttons */}
      <div className={`flex items-center gap-2 px-3 py-1.5 shrink-0`}>
        <button
          onClick={handleRun}
          disabled={running}
          className={`font-pixel text-[10px] border-2 px-4 py-1.5 transition-all ${
            running
              ? "opacity-50 cursor-not-allowed border-[#2a3552] bg-[#0f1930] text-slate-500"
              : `${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 cursor-pointer`
          }`}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {pyLoading ? "LOADING..." : "RUNNING..."}
            </span>
          ) : (
            "RUN"
          )}
        </button>

        <button
          onClick={handleClear}
          className={`font-pixel text-[10px] border-2 px-4 py-1.5 transition-all cursor-pointer
            ${dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-[#d4c9a8] bg-[#f0e8d8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"
            }`}
        >
          CLEAR
        </button>

        <div className={`ml-auto font-pixel text-[9px] ${textMuted}`}>
          Ctrl+Enter
        </div>
      </div>

      {/* Terminal output (remaining flex space) */}
      <div
        ref={outputRef}
        className={`min-h-0 overflow-auto px-3 py-2 border-t ${panelBorder} ${terminalBg} text-sm leading-relaxed`}
        style={{ flex: `${1 - splitRatio} 0 0`, ...sansFont }}
      >
        {!output && !error && !running && (
          <div className="text-slate-500 italic text-xs">
            Output will appear here...
          </div>
        )}
        {output && (
          <pre className="whitespace-pre-wrap m-0 text-slate-200" style={sansFont}>{output}</pre>
        )}
        {error && (
          <pre className="whitespace-pre-wrap m-0 text-red-400 mt-1" style={sansFont}>{error}</pre>
        )}
      </div>
    </div>
  );
}
