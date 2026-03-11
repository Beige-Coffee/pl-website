import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { runPythonCode, preloadWorker, type CodeRunResult } from "../lib/pyodide-runner";
import { signatureHints } from "../lib/signature-hint-extension";
import { cleanErrorMessage } from "../lib/error-cleanup";
import { usePanelState } from "../hooks/use-panel-state";
import { useIsMobile } from "../hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";

// ─── Light Mode Syntax Highlighting ──────────────────────────────────────────

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#d73a49" },
  { tag: tags.controlKeyword, color: "#d73a49" },
  { tag: tags.definitionKeyword, color: "#d73a49" },
  { tag: tags.operatorKeyword, color: "#d73a49" },
  { tag: tags.standard(tags.variableName), color: "#6f42c1" },
  { tag: tags.function(tags.variableName), color: "#6f42c1" },
  { tag: tags.function(tags.definition(tags.variableName)), color: "#6f42c1" },
  { tag: tags.string, color: "#032f62" },
  { tag: tags.comment, color: "#6a737d", fontStyle: "italic" },
  { tag: tags.number, color: "#005cc5" },
  { tag: tags.bool, color: "#005cc5" },
  { tag: tags.self, color: "#d73a49" },
  { tag: tags.operator, color: "#d73a49" },
  { tag: tags.className, color: "#6f42c1" },
  { tag: tags.propertyName, color: "#005cc5" },
  { tag: tags.special(tags.string), color: "#032f62" },
]);

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
  const isMobile = useIsMobile();
  const panel = usePanelState();

  // State
  const [isOpen, setIsOpenRaw] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OPEN) === "1";
    } catch {
      return false;
    }
  });

  // Wrap setIsOpen to sync with panel context
  const setIsOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsOpenRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next && !prev) {
        // Opening — read current width from state
        // (we'll call openPanel after state updates via effect)
      } else if (!next && prev) {
        panel.closePanel("scratchpad");
      }
      return next;
    });
  }, [panel]);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [pyLoading, setPyLoading] = useState(false);

  // Panel width (horizontal resize)
  const [panelWidth, setPanelWidth] = useState(() => {
    if (panel.panelWidth > 0) return panel.panelWidth;
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

  // Sync local width from shared panel width when this panel becomes active
  useEffect(() => {
    if (isOpen && panel.activePanel === "scratchpad" && panel.panelWidth > 0) {
      setPanelWidth(panel.panelWidth);
    }
  }, [isOpen, panel.activePanel]);

  // Sync with panel context when open or width changes
  useEffect(() => {
    if (isOpen) {
      panel.openPanel("scratchpad", panelWidth);
    }
  }, [isOpen, panelWidth]);

  // Close if another panel takes over
  useEffect(() => {
    if (isOpen && panel.activePanel !== null && panel.activePanel !== "scratchpad") {
      setIsOpenRaw(false);
    }
  }, [isOpen, panel.activePanel]);

  // Pre-warm Pyodide
  useEffect(() => {
    if (isOpen) preloadWorker();
  }, [isOpen]);

  // Listen for "send to scratchpad" events from exercises
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) {
        if (viewRef.current) {
          viewRef.current.dispatch({
            changes: { from: 0, to: viewRef.current.state.doc.length, insert: code },
          });
          try { localStorage.setItem(STORAGE_KEY_CODE, code); } catch {}
        } else {
          pendingCodeRef.current = code;
          try { localStorage.setItem(STORAGE_KEY_CODE, code); } catch {}
        }
      }
      if (!isOpen) {
        window.dispatchEvent(new CustomEvent("scratchpad-open"));
        setIsOpen(true);
      }
    };
    window.addEventListener("scratchpad-send-code", handler);
    return () => window.removeEventListener("scratchpad-send-code", handler);
  }, [isOpen]);

  // ── Horizontal drag (panel width) ──────────────────────────────────────

  const handleWidthDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingWidth.current = true;
    panel.startDragging();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingWidth.current) return;
      const delta = startX - ev.clientX; // dragging left = wider
      const maxW = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.min(maxW, Math.max(MIN_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
      panel.resizePanel(newWidth);
    };

    const onUp = () => {
      isDraggingWidth.current = false;
      panel.stopDragging();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth, panel]);

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
      signatureHints(),
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
      ...(dark ? [oneDark] : [syntaxHighlighting(lightHighlightStyle)]),
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
        setError(cleanErrorMessage(result.error, 0));
      }
    } catch (err: any) {
      setError(cleanErrorMessage(err.message || "Unknown error", 0));
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
  const terminalBg = dark ? "bg-[#060a14]" : "bg-[#1a1a2e]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const dragHandleColor = dark ? "bg-[#2a3552] hover:bg-[#FFD700]/40" : "bg-[#d4c9a8] hover:bg-[#b8860b]/30";

  // Listen for open event from Tools menu (and "send to scratchpad" opens)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("scratchpad-open", handler);
    return () => window.removeEventListener("scratchpad-open", handler);
  }, []);

  if (!isOpen) {
    return null;
  }

  // ── Shared content ─────────────────────────────────────────────────────

  const panelContent = (
    <>
      {/* Description */}
      <div className={`px-3 py-2 border-b ${panelBorder} shrink-0`} style={sansFont}>
        <div className={`text-[15px] leading-snug ${textMuted}`}>
          Sandbox for experimenting with Python. Click <span className={`font-pixel text-[11px] ${goldText}`}>SEND TO SANDBOX</span> in any exercise to load sample inputs here.
        </div>
      </div>

      {/* Editor area */}
      <div
        className="min-h-0 overflow-hidden"
        style={{ flex: isMobile ? "1 0 0" : `${splitRatio} 0 0` }}
      >
        <div ref={editorRef} className="h-full overflow-auto" />
      </div>

      {/* Vertical drag handle (desktop only) */}
      {!isMobile && (
        <div
          onMouseDown={handleSplitDragStart}
          className={`shrink-0 h-[5px] cursor-row-resize transition-colors ${dragHandleColor}`}
          title="Drag to resize editor/output"
        />
      )}

      {/* Action buttons */}
      <div className={`flex items-center gap-2 px-3 py-1.5 shrink-0`}>
        <button
          onClick={handleRun}
          disabled={running}
          className={`font-pixel text-[10px] border-2 px-4 ${isMobile ? "py-3 min-h-[44px]" : "py-1.5"} transition-all ${
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
          className={`font-pixel text-[10px] border-2 px-4 ${isMobile ? "py-3 min-h-[44px]" : "py-1.5"} transition-all cursor-pointer
            ${dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-[#d4c9a8] bg-[#f0e8d8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"
            }`}
        >
          CLEAR
        </button>

        {!isMobile && (
          <div className={`ml-auto font-pixel text-[9px] ${textMuted}`}>
            Ctrl+Enter
          </div>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        className={`min-h-0 overflow-auto px-3 py-2 border-t ${panelBorder} ${terminalBg} text-sm leading-relaxed`}
        style={{ flex: isMobile ? "1 0 0" : `${1 - splitRatio} 0 0`, ...sansFont }}
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
    </>
  );

  // ── Mobile: Drawer ─────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
        <DrawerContent className={`max-h-[85dvh] flex flex-col ${panelBg}`} data-testid="drawer-scratchpad">
          <DrawerTitle className={`font-pixel text-xs ${goldText} px-4 pt-2`}>SCRATCHPAD</DrawerTitle>
          {panelContent}
        </DrawerContent>
      </Drawer>
    );
  }

  // ── Desktop: Fixed side panel ──────────────────────────────────────────

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
      <div className={`flex items-center justify-between px-4 py-2.5 border-b-2 ${panelBorder} ${dark ? "bg-[#0f1930]" : "bg-[#f0e8d8]"} shrink-0`}>
        <div className={`font-pixel text-xs ${goldText}`}>SCRATCHPAD</div>
        <button
          onClick={() => setIsOpen(false)}
          className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer
            ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]" : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"}`}
        >
          CLOSE
        </button>
      </div>

      {panelContent}
    </div>
  );
}
