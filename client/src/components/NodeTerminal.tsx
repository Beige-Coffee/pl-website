import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePanelState } from "../hooks/use-panel-state";
import { useIsMobile } from "../hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY_OPEN = "pl-node-terminal-open";
const STORAGE_KEY_WIDTH = "pl-node-terminal-width";
const STORAGE_KEY_SPLIT = "pl-node-terminal-split";

const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 340;
const MAX_WIDTH_RATIO = 0.75;
const DEFAULT_SPLIT = 0.15; // 15% input, 85% output
const MIN_SPLIT = 0.08;
const MAX_SPLIT = 0.4;

const PROMPT = "bitcoin-cli> ";

// Commands available for tab completion, ordered by course relevance
const COMMANDS = [
  "sendrawtransaction",
  "decoderawtransaction",
  "getrawtransaction",
  "gettxout",
  "mine",
  "decodescript",
  "testmempoolaccept",
  "getblockcount",
  "getblockchaininfo",
  "getmempoolinfo",
  "gettransaction",
  "help",
  "clear",
];

const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;

// ─── JSON Syntax Highlight ──────────────────────────────────────────────────

function highlightJSON(text: string, dark: boolean): React.ReactNode[] {
  if (typeof text !== "string") return [String(text)];

  const parts: React.ReactNode[] = [];
  // Match JSON keys, strings, numbers, booleans, null
  const regex = /("(?:\\.|[^"\\])*")\s*:/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const keyColor = dark ? "#FFD700" : "#7a5a00";
  const stringColor = dark ? "#98c379" : "#2e7d32";
  const numberColor = dark ? "#56b6c2" : "#01579b";
  const boolColor = dark ? "#c678dd" : "#7b1fa2";

  // Simple approach: colorize the entire JSON string
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Color JSON keys
    const colored = line.replace(
      /("(?:\\.|[^"\\])*")\s*(:)|("(?:\\.|[^"\\])*")|(\b\d+\.?\d*\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g,
      (match, key, colon, str, num, bool, nul) => {
        if (key && colon) return `<span style="color:${keyColor}">${key}</span>${colon}`;
        if (str) return `<span style="color:${stringColor}">${str}</span>`;
        if (num) return `<span style="color:${numberColor}">${num}</span>`;
        if (bool) return `<span style="color:${boolColor}">${bool}</span>`;
        if (nul) return `<span style="color:${boolColor}">${nul}</span>`;
        return match;
      }
    );
    parts.push(
      <span key={i} dangerouslySetInnerHTML={{ __html: colored + (i < lines.length - 1 ? "\n" : "") }} />
    );
  }
  return parts;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NodeTerminalProps {
  theme: "light" | "dark";
  sessionToken: string | null;
  authenticated: boolean;
}

export default function NodeTerminal({ theme, sessionToken, authenticated }: NodeTerminalProps) {
  const dark = theme === "dark";
  const isMobile = useIsMobile();
  const panel = usePanelState();

  const [isOpenRaw, setIsOpenRaw] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_OPEN) === "1"; } catch { return false; }
  });

  // Wrap setter to sync with panel context
  const isOpen = isOpenRaw;
  const setIsOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsOpenRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (!next && prev) {
        panel.closePanel("node");
      }
      return next;
    });
  }, [panel]);
  const [lines, setLines] = useState<Array<{ type: "cmd" | "output" | "error" | "info"; text: string }>>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [nodeReady, setNodeReady] = useState(false);
  const [nodeUnresponsive, setNodeUnresponsive] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const hadNodeRef = useRef(false);

  const [panelWidth, setPanelWidth] = useState(() => {
    // Use shared panel width if available, fall back to per-panel saved width
    if (panel.panelWidth > 0) return panel.panelWidth;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
      if (saved) return Math.max(MIN_WIDTH, parseInt(saved, 10));
    } catch {}
    return DEFAULT_WIDTH;
  });

  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SPLIT);
      if (saved) return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, parseFloat(saved)));
    } catch {}
    return DEFAULT_SPLIT;
  });

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingWidth = useRef(false);
  const isDraggingSplit = useRef(false);

  // Track if node was ever ready (for restart vs first-provision UX)
  useEffect(() => {
    if (nodeReady) hadNodeRef.current = true;
  }, [nodeReady]);

  // Persist state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_OPEN, isOpen ? "1" : "0"); } catch {}
  }, [isOpen]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WIDTH, String(panelWidth)); } catch {}
  }, [panelWidth]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SPLIT, String(splitRatio)); } catch {}
  }, [splitRatio]);

  // Sync local width from shared panel width when this panel becomes active
  useEffect(() => {
    if (isOpen && panel.activePanel === "node" && panel.panelWidth > 0) {
      setPanelWidth(panel.panelWidth);
    }
  }, [isOpen, panel.activePanel]);

  // Sync with panel context when open or width changes
  useEffect(() => {
    if (isOpen) {
      panel.openPanel("node", panelWidth);
    }
  }, [isOpen, panelWidth]);

  // Close if another panel takes over
  useEffect(() => {
    if (isOpen && panel.activePanel !== null && panel.activePanel !== "node") {
      setIsOpenRaw(false);
    }
  }, [isOpen, panel.activePanel]);

  // Provision node on open
  useEffect(() => {
    if (!isOpen || !authenticated || !sessionToken || nodeReady) return;

    let cancelled = false;
    const isRestart = hadNodeRef.current;
    setProvisioning(true);
    if (isRestart) {
      setLines((prev) => [...prev, { type: "info", text: "Node restarting..." }]);
    } else {
      setLines([{ type: "info", text: "Starting your Bitcoin node..." }]);
    }

    fetch("/api/node/status?provision=true", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then(async (r) => {
        const contentType = r.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Node API not available. Make sure you're running 'npm run dev' (not dev:local).");
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.running) {
          setNodeReady(true);
          if (isRestart) {
            setLines((prev) => [...prev, { type: "info", text: "Node ready. Please try your command again." }]);
          } else {
            setLines([
              { type: "info", text: "Bitcoin node ready. Type 'help' for available commands." },
              { type: "info", text: "Tip: Press Tab to autocomplete command names." },
            ]);
          }
        } else if (data.error) {
          if (isRestart) {
            setLines((prev) => [...prev, { type: "error", text: data.error }]);
          } else {
            setLines([{ type: "error", text: data.error }]);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (isRestart) {
          setLines((prev) => [...prev, { type: "error", text: err.message }]);
        } else {
          setLines([{ type: "error", text: err.message }]);
        }
      })
      .finally(() => {
        if (!cancelled) setProvisioning(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, authenticated, sessionToken, nodeReady]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && nodeReady && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, nodeReady]);

  // ── Execute command ─────────────────────────────────────────────────────

  const executeCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || !sessionToken) return;

    setLines((prev) => [...prev, { type: "cmd", text: cmd }]);
    setHistory((prev) => [cmd, ...prev.slice(0, 99)]);
    setHistoryIdx(-1);
    setInput("");

    // Handle client-side clear
    if (cmd.trim().toLowerCase() === "clear") {
      setLines([]);
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/api/node/exec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ command: cmd }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setLines((prev) => [...prev, { type: "error", text: "Node API not available. Run 'npm run dev' (not dev:local)." }]);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setLines((prev) => [...prev, { type: "error", text: data.error || `HTTP ${res.status}` }]);
        return;
      }

      if (data.error) {
        // Detect timeout / unresponsive node — show restart guidance
        if (/timed out|timeout/i.test(data.error)) {
          setNodeUnresponsive(true);
          setLines((prev) => [...prev,
            { type: "error", text: data.error },
            { type: "info", text: "The node may be unresponsive. Click RESTART above to restart it." },
          ]);
        } else {
          setLines((prev) => [...prev, { type: "error", text: data.error }]);
        }
        // Auto-recover: if the error indicates the node process is dead,
        // reset nodeReady to trigger automatic re-provisioning.
        if (/ECONNREFUSED|ECONNRESET|socket hang up/i.test(data.error)) {
          setNodeReady(false);
          setNodeUnresponsive(false);
        }
      } else if (data.result === "__CLEAR__") {
        setLines([]);
      } else if (data.result !== undefined) {
        setNodeUnresponsive(false);
        const text = typeof data.result === "string"
          ? data.result
          : JSON.stringify(data.result, null, 2);
        setLines((prev) => [...prev, { type: "output", text }]);
      }
    } catch (err: any) {
      setLines((prev) => [...prev, { type: "error", text: "Network error: " + err.message }]);
    } finally {
      setRunning(false);
      // Re-focus input after command completes so user can keep typing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [sessionToken]);

  // ── Tab completion ─────────────────────────────────────────────────────

  const tabCycleRef = useRef<{ prefix: string; matches: string[]; index: number } | null>(null);

  // ── Key handling ────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const text = input.trimStart();
      // Only complete the command (first word) when there are no spaces yet
      if (!text.includes(" ")) {
        const prefix = text.toLowerCase();
        // If we're continuing a tab cycle with the same prefix, advance the index
        if (tabCycleRef.current && tabCycleRef.current.prefix === prefix && tabCycleRef.current.matches.length > 0) {
          const cycle = tabCycleRef.current;
          cycle.index = (cycle.index + 1) % cycle.matches.length;
          setInput(cycle.matches[cycle.index]);
        } else {
          // Start a new cycle
          const matches = COMMANDS.filter((c) => c.startsWith(prefix));
          if (matches.length > 0) {
            tabCycleRef.current = { prefix, matches, index: 0 };
            setInput(matches[0]);
          }
        }
      }
      return;
    }

    // Any non-tab key resets the tab cycle
    tabCycleRef.current = null;

    if (e.key === "Enter") {
      e.preventDefault();
      executeCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(historyIdx + 1, history.length - 1);
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }, [input, history, historyIdx, executeCommand]);

  // ── Horizontal drag ─────────────────────────────────────────────────────

  const handleWidthDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingWidth.current = true;
    panel.startDragging();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingWidth.current) return;
      const delta = startX - ev.clientX;
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

  // ── Vertical drag ───────────────────────────────────────────────────────

  const handleSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplit.current = true;
    const startY = e.clientY;
    const startRatio = splitRatio;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSplit.current || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const contentHeight = rect.height - 44;
      if (contentHeight <= 0) return;
      const deltaRatio = (ev.clientY - startY) / contentHeight;
      setSplitRatio(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, startRatio + deltaRatio)));
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

  // ── Theme colors ────────────────────────────────────────────────────────

  const panelBg = dark ? "bg-[#0a0f1a]" : "bg-[#faf6ee]";
  const panelBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const dragHandleColor = dark ? "bg-[#2a3552] hover:bg-[#FFD700]/40" : "bg-[#d4c9a8] hover:bg-[#b8860b]/30";
  const termText = dark ? "text-slate-200" : "text-stone-800";
  const termTextOutput = dark ? "text-slate-300" : "text-stone-700";
  const promptColor = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const infoColor = dark ? "text-[#FFD700]/70" : "text-[#9a7200]/70";
  const inputTextColor = dark ? "text-slate-200" : "text-stone-800";
  const placeholderColor = dark ? "placeholder:text-slate-600" : "placeholder:text-stone-400";

  // ── Restart node ───────────────────────────────────────────────────────

  const restartNode = useCallback(async () => {
    if (!sessionToken || provisioning) return;
    setShowRestartConfirm(false);
    setProvisioning(true);
    setNodeReady(false);
    setNodeUnresponsive(false);
    setLines((prev) => [...prev, { type: "info", text: "Restarting node..." }]);

    try {
      const res = await fetch("/api/node/restart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const data = await res.json();
      if (data.running) {
        setNodeReady(true);
        setLines((prev) => [...prev, { type: "info", text: "Node restarted. Ready for commands." }]);
      } else {
        setLines((prev) => [...prev, { type: "error", text: data.error || "Restart failed" }]);
      }
    } catch (err: any) {
      setLines((prev) => [...prev, { type: "error", text: "Restart failed: " + err.message }]);
    } finally {
      setProvisioning(false);
    }
  }, [sessionToken, provisioning]);

  // Listen for open event from Tools menu
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("node-terminal-open", handler);
    return () => window.removeEventListener("node-terminal-open", handler);
  }, []);

  if (!isOpen) {
    return null;
  }

  // ── Shared terminal content ────────────────────────────────────────────

  const terminalContent = (
    <>
      {/* Not authenticated */}
      {!authenticated && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className={`text-center ${textMuted}`} style={sansFont}>
            <div className={`font-pixel text-xs mb-3 ${goldText}`}>LOGIN REQUIRED</div>
            <div className="text-sm">Sign in to use the Bitcoin node terminal.</div>
          </div>
        </div>
      )}

      {/* Restart confirmation dialog */}
      {showRestartConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{
            backgroundColor: dark ? "rgba(10,15,26,0.85)" : "rgba(250,246,238,0.9)",
            backdropFilter: "blur(4px)",
            top: isMobile ? 0 : 44,
          }}
        >
          <div className={`max-w-xs mx-4 p-4 border-2 rounded ${panelBorder} ${panelBg}`} style={sansFont}>
            <div className={`font-pixel text-xs ${goldText} mb-3`}>Restart Node?</div>
            <div className={`text-sm ${dark ? "text-slate-300" : "text-stone-600"} space-y-2`}>
              <p>This restarts your Bitcoin node from a fresh state. Your <strong>course progress, exercise solutions, and transaction history</strong> are not affected.</p>
              <p>Use this if the node becomes unresponsive or commands stop working.</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={restartNode}
                className={`font-pixel text-[10px] px-3 py-1.5 border cursor-pointer transition-all
                  ${dark ? "border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700]/10" : "border-[#9a7200] text-[#9a7200] hover:bg-[#9a7200]/10"}`}
              >
                RESTART
              </button>
              <button
                onClick={() => setShowRestartConfirm(false)}
                className={`font-pixel text-[10px] px-3 py-1.5 border cursor-pointer transition-all
                  ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200" : "border-[#d4c9a8] text-black/50 hover:text-black"}`}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal content */}
      {authenticated && (
        <>
          {/* Output area */}
          <div
            ref={outputRef}
            className="flex-1 min-h-0 overflow-auto px-3 py-2 leading-relaxed cursor-text"
            style={{ fontSize: isMobile ? "16px" : "14px", fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
            onClick={() => {
              const sel = window.getSelection();
              if (!sel || sel.isCollapsed) inputRef.current?.focus();
            }}
          >
            {lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {line.type === "cmd" && (
                  <span>
                    <span className={promptColor}>{PROMPT}</span>
                    <span className={termText}>{line.text}</span>
                  </span>
                )}
                {line.type === "output" && (
                  <span className={termTextOutput}>
                    {highlightJSON(line.text, dark)}
                  </span>
                )}
                {line.type === "error" && (
                  <span className={dark ? "text-red-400" : "text-red-600"}>{line.text}</span>
                )}
                {line.type === "info" && (
                  <span className={`${infoColor} italic`}>{line.text}</span>
                )}
              </div>
            ))}
            {running && (
              <div className={`${dark ? "text-slate-500" : "text-stone-400"} flex items-center gap-2`}>
                <span className={`inline-block w-3 h-3 border-2 rounded-full animate-spin ${dark ? "border-slate-600 border-t-slate-300" : "border-stone-300 border-t-stone-500"}`} />
                executing...
              </div>
            )}
          </div>

          {/* Input area */}
          <div className={`shrink-0 border-t ${panelBorder} px-3 py-2 flex items-center gap-1`}
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
          >
            <span className={`${promptColor} text-sm shrink-0`}>{PROMPT}</span>
            <div className="flex-1 relative">
              {/* Ghost autocomplete suggestion */}
              {(() => {
                const trimmed = input.trimStart();
                if (trimmed.length > 0 && !trimmed.includes(" ")) {
                  const match = COMMANDS.find((c) => c.startsWith(trimmed.toLowerCase()) && c !== trimmed.toLowerCase());
                  if (match) {
                    return (
                      <div
                        aria-hidden
                        className={`absolute inset-0 pointer-events-none flex items-center ${dark ? "text-slate-500" : "text-stone-400"}`}
                        style={{ fontSize: isMobile ? "16px" : "14px" }}
                      >
                        <span className="invisible">{input}</span>
                        <span>{match.slice(trimmed.length)}</span>
                        <span className={`ml-2 text-xs ${dark ? "text-slate-600" : "text-stone-400"}`}>Tab</span>
                      </div>
                    );
                  }
                }
                return null;
              })()}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={running || provisioning || !nodeReady}
                className={`w-full bg-transparent ${inputTextColor} outline-none border-none ${placeholderColor} disabled:opacity-40 relative z-10`}
                style={{ fontSize: isMobile ? "16px" : "14px" }}
                placeholder={nodeReady ? "type a command..." : "waiting for node..."}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </>
      )}
    </>
  );

  // ── Mobile: Drawer ─────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
        <DrawerContent className={`max-h-[95dvh] h-[95dvh] flex flex-col ${panelBg}`} data-testid="drawer-node-terminal">
          <DrawerTitle className={`font-pixel text-xs ${goldText} px-4 pt-2 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              Bitcoin Node
              {provisioning ? (
                <span className="inline-block w-3 h-3 border-2 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
              ) : (
                <span className={`inline-block w-2 h-2 rounded-full ${
                  !nodeReady ? "bg-red-500" : nodeUnresponsive ? "bg-amber-500" : "bg-green-500"
                }`} />
              )}
            </div>
            <button
              onClick={() => setShowRestartConfirm(true)}
              disabled={provisioning}
              className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer disabled:opacity-40
                ${dark ? "border-[#2a3552] text-slate-400" : "border-[#d4c9a8] text-black/50"}`}
            >
              RESTART
            </button>
          </DrawerTitle>
          {terminalContent}
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
      {/* Left drag handle */}
      <div
        onMouseDown={handleWidthDragStart}
        className={`absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-50 transition-colors ${dragHandleColor}`}
      />

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b-2 ${panelBorder} ${dark ? "bg-[#0f1930]" : "bg-[#f0e8d8]"} shrink-0`}>
        <div className={`font-pixel text-xs ${goldText} flex items-center gap-2`}>
          Bitcoin Node
          {provisioning ? (
            <span className="inline-block w-3 h-3 border-2 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
          ) : (
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                !nodeReady ? "bg-red-500" : nodeUnresponsive ? "bg-amber-500" : "bg-green-500"
              }`}
              title={!nodeReady ? "Node stopped" : nodeUnresponsive ? "Node unresponsive" : "Node running"}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRestartConfirm(true)}
            disabled={provisioning}
            className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
              ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]" : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"}`}
            title="Restart Bitcoin node"
          >
            RESTART
          </button>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer
              ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]" : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"}
              ${showHelp ? (dark ? "bg-[#132043] text-slate-200" : "bg-[#e8dcc8] text-black") : ""}`}
            title="Command reference"
          >
            ?
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className={`font-pixel text-[10px] px-2 py-1 border transition-all cursor-pointer
              ${dark ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]" : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"}`}
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Help overlay */}
      {showHelp && (
        <div
          className="absolute inset-0 top-[44px] z-10 overflow-auto px-4 py-4"
          style={{
            ...sansFont,
            backgroundColor: dark ? "#0a0f1acc" : "#faf6eeee",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className={`${dark ? "text-slate-200" : "text-stone-800"} text-sm space-y-3`}>
            <div className={`${dark ? "text-slate-500" : "text-stone-400"} text-xs italic mb-3`}>
              Press <span className={`${dark ? "text-slate-300" : "text-stone-600"} font-bold not-italic`}>Tab</span> to autocomplete commands.
            </div>
            <div className={`${dark ? "text-[#FFD700]/50" : "text-[#9a7200]/50"} text-[10px] font-bold uppercase tracking-wider`}>Core Commands</div>
            {([
              ["sendrawtransaction", "raw tx hex", "Broadcast a raw transaction to the network."],
              ["decoderawtransaction", "raw tx hex", "Decode a raw transaction to inspect its inputs, outputs, and other details."],
              ["getrawtransaction", "txid true", "Get transaction details and confirmation count. Pass 'true' for decoded JSON."],
              ["gettxout", "txid, output index", "Look up a UTXO. Returns nothing if it has been spent or never existed."],
              ["mine", "number of blocks", "Mine blocks on the regtest network. Transactions in the mempool will be included."],
            ] as [string, string, string][]).map(([cmd, args, desc]) => (
              <div key={cmd}>
                <span className={`${dark ? "text-[#FFD700]" : "text-[#9a7200]"} font-bold`}>{cmd}</span>
                <span className={dark ? "text-slate-400" : "text-stone-500"}>{" "}&lt;{args}&gt;</span>
                <div className={`${dark ? "text-slate-400" : "text-stone-500"} text-xs mt-0.5`}>{desc}</div>
              </div>
            ))}
            <div className={`${dark ? "text-[#FFD700]/50" : "text-[#9a7200]/50"} text-[10px] font-bold uppercase tracking-wider mt-4`}>Inspection</div>
            {([
              ["decodescript", "hex", "Decode a hex-encoded script to see its opcodes and address."],
              ["testmempoolaccept", "raw tx hex", "Test if a transaction would be accepted to the mempool (without broadcasting)."],
              ["gettransaction", "txid", "Get wallet transaction info (only for transactions involving wallet addresses)."],
            ] as [string, string, string][]).map(([cmd, args, desc]) => (
              <div key={cmd}>
                <span className={`${dark ? "text-[#FFD700]" : "text-[#9a7200]"} font-bold`}>{cmd}</span>
                <span className={dark ? "text-slate-400" : "text-stone-500"}>{" "}&lt;{args}&gt;</span>
                <div className={`${dark ? "text-slate-400" : "text-stone-500"} text-xs mt-0.5`}>{desc}</div>
              </div>
            ))}
            <div className={`${dark ? "text-[#FFD700]/50" : "text-[#9a7200]/50"} text-[10px] font-bold uppercase tracking-wider mt-4`}>Blockchain</div>
            {([
              ["getblockcount", null, "Get the current block height."],
              ["getblockchaininfo", null, "Get blockchain status (chain, blocks, difficulty, etc.)."],
              ["getmempoolinfo", null, "Get mempool statistics (size, bytes, fee thresholds)."],
            ] as [string, string | null, string][]).map(([cmd, args, desc]) => (
              <div key={cmd}>
                <span className={`${dark ? "text-[#FFD700]" : "text-[#9a7200]"} font-bold`}>{cmd}</span>
                {args && <span className={dark ? "text-slate-400" : "text-stone-500"}>{" "}&lt;{args}&gt;</span>}
                <div className={`${dark ? "text-slate-400" : "text-stone-500"} text-xs mt-0.5`}>{desc}</div>
              </div>
            ))}
            <div className={`${dark ? "text-[#FFD700]/50" : "text-[#9a7200]/50"} text-[10px] font-bold uppercase tracking-wider mt-4`}>Utility</div>
            <div>
              <span className={`${dark ? "text-[#FFD700]" : "text-[#9a7200]"} font-bold`}>help</span>
              <div className={`${dark ? "text-slate-400" : "text-stone-500"} text-xs mt-0.5`}>List all available commands.</div>
            </div>
            <div>
              <span className={`${dark ? "text-[#FFD700]" : "text-[#9a7200]"} font-bold`}>clear</span>
              <div className={`${dark ? "text-slate-400" : "text-stone-500"} text-xs mt-0.5`}>Clear the terminal output.</div>
            </div>
          </div>
        </div>
      )}

      {terminalContent}
    </div>
  );
}
