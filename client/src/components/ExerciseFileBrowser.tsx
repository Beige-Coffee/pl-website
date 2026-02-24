import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { EXERCISE_GROUPS, LN_MODULE_DISPLAY_CODE, type ExerciseGroup } from "../lib/exercise-groups";
import { LIGHTNING_EXERCISES } from "../data/lightning-exercises";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExerciseFileBrowserProps {
  currentExerciseId: string;
  theme: "light" | "dark";
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFileTree(): Record<string, ExerciseGroup[]> {
  const tree: Record<string, ExerciseGroup[]> = {};
  for (const group of Object.values(EXERCISE_GROUPS)) {
    const parts = group.label.replace(/\.py$/, "").split("/");
    const dir = parts.length > 1 ? parts[0] : "";
    if (!tree[dir]) tree[dir] = [];
    tree[dir].push(group);
  }
  return tree;
}

function getGroupForExercise(exerciseId: string): string | null {
  for (const group of Object.values(EXERCISE_GROUPS)) {
    if (group.exerciseIds.includes(exerciseId)) return group.id;
  }
  return null;
}

function assembleFileContent(
  group: ExerciseGroup,
  currentExerciseId: string
): { code: string; currentLineStart: number; currentLineEnd: number } {
  const parts: string[] = [];
  let currentLineStart = -1;
  let currentLineEnd = -1;

  // Add preamble
  if (group.preamble.trim()) {
    parts.push(group.preamble.trim());
    parts.push(""); // blank line
  }

  // Add each exercise's code
  for (const exId of group.exerciseIds) {
    const exData = LIGHTNING_EXERCISES[exId];
    if (!exData) continue;

    const linesBefore = parts.join("\n").split("\n").length;

    // Try to get student's saved code, fall back to starter code
    let code: string;
    try {
      const saved = localStorage.getItem(`pl-exercise-${exId}`);
      code = saved || exData.starterCode;
    } catch {
      code = exData.starterCode;
    }

    if (exId === currentExerciseId) {
      currentLineStart = linesBefore;
    }

    parts.push(code.trim());

    if (exId === currentExerciseId) {
      currentLineEnd = parts.join("\n").split("\n").length;
    }

    parts.push(""); // blank line between exercises
  }

  return {
    code: parts.join("\n").trimEnd(),
    currentLineStart,
    currentLineEnd,
  };
}

const DIR_ORDER = ["keys", "scripts", "transactions"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExerciseFileBrowser({
  currentExerciseId,
  theme,
  onClose,
}: ExerciseFileBrowserProps) {
  const dark = theme === "dark";
  const fileTree = useMemo(() => buildFileTree(), []);
  const currentGroupId = useMemo(
    () => getGroupForExercise(currentExerciseId),
    [currentExerciseId]
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    currentGroupId || Object.values(EXERCISE_GROUPS)[0]?.id || ""
  );
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    // Expand all dirs by default
    return new Set(DIR_ORDER);
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const isLnModule = selectedGroupId === "__ln_module__";
  const selectedGroup = isLnModule ? null : EXERCISE_GROUPS[selectedGroupId];

  // Build content for selected file
  const fileContent = useMemo(() => {
    if (isLnModule) return { code: LN_MODULE_DISPLAY_CODE, currentLineStart: -1, currentLineEnd: -1 };
    if (!selectedGroup) return { code: "", currentLineStart: -1, currentLineEnd: -1 };
    return assembleFileContent(selectedGroup, currentExerciseId);
  }, [selectedGroup, currentExerciseId, isLnModule]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Create/update CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = [
      python(),
      lineNumbers(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...(dark ? [oneDark] : []),
      EditorView.theme({
        "&": { fontSize: "14px", height: "100%", overflow: "hidden" },
        ".cm-scroller": { overflow: "auto", height: "100%" },
        ".cm-gutters": {
          backgroundColor: dark ? "#0b1220" : "#f5f0e8",
          borderRight: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
        },
        ".cm-content": { padding: "8px 0" },
        "&.cm-focused": { outline: "none" },
        ".cm-activeLine": { backgroundColor: "transparent" },
        ".cm-activeLineGutter": { backgroundColor: "transparent" },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: fileContent.code, extensions }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Scroll to current exercise
    if (
      selectedGroupId === currentGroupId &&
      fileContent.currentLineStart > 0
    ) {
      requestAnimationFrame(() => {
        const line = view.state.doc.line(
          Math.min(fileContent.currentLineStart, view.state.doc.lines)
        );
        view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 40 }),
        });
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [fileContent.code, dark, selectedGroupId, currentGroupId]);

  const toggleDir = useCallback((dir: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  // ── Theme ─────────────────────────────────────────────────────────────
  const panelBg = dark ? "bg-[#0a0f1a]" : "bg-white";
  const sidebarBg = dark ? "bg-[#0b1220]" : "bg-[#f8f5ef]";
  const borderColor = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const activeFileBg = dark ? "bg-[#FFD700]/10" : "bg-[#b8860b]/10";
  const activeFileBorder = dark ? "border-l-[#FFD700]" : "border-l-[#b8860b]";
  const hoverBg = dark ? "hover:bg-[#0f1930]" : "hover:bg-[#f0e8d8]";
  const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${dark ? "bg-black/70" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative w-[95vw] h-[90vh] flex border-2 ${borderColor} ${panelBg} shadow-2xl overflow-hidden`}>
        {/* Sidebar - file tree */}
        <div className={`w-56 shrink-0 border-r ${borderColor} ${sidebarBg} flex flex-col overflow-hidden`}>
          <div className={`px-3 py-2.5 border-b ${borderColor} flex items-center justify-between`}>
            <span className={`font-pixel text-[10px] ${goldText}`}>FILES</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {/* ln.py — root level helper module */}
            <button
              type="button"
              onClick={() => setSelectedGroupId("__ln_module__")}
              className={`w-full flex items-center gap-1.5 px-3 pl-5 py-1.5 text-left transition-colors cursor-pointer border-l-2 ${
                isLnModule
                  ? `${activeFileBg} ${activeFileBorder}`
                  : `border-l-transparent ${hoverBg}`
              }`}
            >
              <span className={`text-sm ${
                isLnModule ? goldText : textMuted
              }`} style={sansFont}>
                ln.py
              </span>
            </button>

            {DIR_ORDER.map((dir) => {
              const groups = fileTree[dir];
              if (!groups?.length) return null;
              const isExpanded = expandedDirs.has(dir);

              return (
                <div key={dir}>
                  <button
                    type="button"
                    onClick={() => toggleDir(dir)}
                    className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors ${hoverBg} cursor-pointer`}
                  >
                    <span className={`text-[10px] ${textMuted} w-3`}>{isExpanded ? "▾" : "▸"}</span>
                    <span className={`text-sm font-semibold ${dark ? "text-slate-300" : "text-black/70"}`} style={sansFont}>
                      {dir}/
                    </span>
                  </button>

                  {isExpanded && groups.map((group) => {
                    const isSelected = group.id === selectedGroupId;
                    const isCurrent = group.id === currentGroupId;
                    const fileName = group.label.split("/").pop() || group.label;

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`w-full flex items-center gap-1.5 pl-7 pr-3 py-1.5 text-left transition-colors cursor-pointer border-l-2 ${
                          isSelected
                            ? `${activeFileBg} ${activeFileBorder}`
                            : `border-l-transparent ${hoverBg}`
                        }`}
                      >
                        <span className={`text-sm ${
                          isSelected
                            ? (dark ? "text-[#FFD700]" : "text-[#9a7200]")
                            : (dark ? "text-slate-400" : "text-black/60")
                        }`} style={sansFont}>
                          {fileName}
                        </span>
                        {isCurrent && (
                          <span className={`ml-auto text-[8px] font-pixel px-1 py-0.5 ${
                            dark ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-[#b8860b]/15 text-[#9a7200]"
                          }`}>
                            ACTIVE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content - code view */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* File header */}
          <div className={`px-4 py-2.5 border-b ${borderColor} flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-3">
              <span className={`text-base font-semibold ${dark ? "text-slate-200" : "text-black/80"}`} style={sansFont}>
                {isLnModule ? "ln.py" : selectedGroup?.label || ""}
              </span>
              {isLnModule ? (
                <span className={`text-xs px-2 py-0.5 ${
                  dark ? "bg-slate-700/50 text-slate-400" : "bg-black/5 text-black/50"
                }`} style={sansFont}>
                  helper module — available in all exercises
                </span>
              ) : selectedGroupId === currentGroupId ? (
                <span className={`text-xs px-2 py-0.5 ${
                  dark ? "bg-[#FFD700]/15 text-[#FFD700]" : "bg-[#b8860b]/10 text-[#9a7200]"
                }`} style={sansFont}>
                  current file
                </span>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className={`font-pixel text-[10px] px-2.5 py-1 border transition-all cursor-pointer ${
                dark
                  ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                  : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"
              }`}
            >
              CLOSE
            </button>
          </div>

          {/* Exercise tabs within file (hidden for ln.py) */}
          {selectedGroup && !isLnModule && (
            <div className={`px-3 py-1.5 border-b ${borderColor} flex items-center gap-1 overflow-x-auto shrink-0`}>
              {selectedGroup.exerciseIds.map((exId) => {
                const exData = LIGHTNING_EXERCISES[exId];
                if (!exData) return null;
                const isCurrent = exId === currentExerciseId;
                // Extract function name from starterCode
                const fnMatch = exData.starterCode.match(/def\s+(\w+)/);
                const fnName = fnMatch ? fnMatch[1] : exId.replace("ln-exercise-", "");

                return (
                  <button
                    key={exId}
                    type="button"
                    onClick={() => {
                      if (!viewRef.current) return;
                      const content = assembleFileContent(selectedGroup, exId);
                      if (content.currentLineStart > 0) {
                        const line = viewRef.current.state.doc.line(
                          Math.min(content.currentLineStart, viewRef.current.state.doc.lines)
                        );
                        viewRef.current.dispatch({
                          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 40 }),
                        });
                      }
                    }}
                    className={`text-sm px-2 py-1 whitespace-nowrap transition-colors cursor-pointer border ${
                      isCurrent
                        ? `${dark ? "border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]" : "border-[#b8860b]/30 bg-[#b8860b]/10 text-[#9a7200]"}`
                        : `${dark ? "border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#0f1930]" : "border-transparent text-black/40 hover:text-black/70 hover:bg-[#f0e8d8]"}`
                    }`}
                    style={sansFont}
                  >
                    {fnName}()
                  </button>
                );
              })}
            </div>
          )}

          {/* Code viewer */}
          <div ref={editorRef} className="flex-1 min-h-0 overflow-hidden" />
        </div>
      </div>
    </div>
  );
}
