import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { EditorView, lineNumbers, Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { EXERCISE_GROUPS, LN_MODULE_DISPLAY_CODE, type ExerciseGroup } from "../lib/exercise-groups";
import { NOISE_EXERCISE_GROUPS } from "../lib/noise-exercise-groups";
import { LIGHTNING_EXERCISES } from "../data/lightning-exercises";
import { CODE_EXERCISES } from "../data/code-exercises";
import { useIsMobile } from "../hooks/use-mobile";

// ─── Search highlight for CodeMirror ─────────────────────────────────────────

const setSearchHighlights = StateEffect.define<DecorationSet>();
const searchHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSearchHighlights)) return e.value;
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const searchMatchMark = Decoration.mark({ class: "cm-search-match" });
const searchCurrentMark = Decoration.mark({ class: "cm-search-match-current" });

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExerciseFileBrowserProps {
  currentExerciseId: string;
  theme: "light" | "dark";
  onClose: () => void;
  tutorialType?: "lightning" | "noise";
}

interface SearchMatch {
  groupId: string;
  fileLabel: string;
  lineNum: number;
  lineText: string;
  charPos: number; // character offset within the file content
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFileTree(groups: Record<string, ExerciseGroup>): Record<string, ExerciseGroup[]> {
  const tree: Record<string, ExerciseGroup[]> = {};
  for (const group of Object.values(groups)) {
    const parts = group.label.replace(/\.py$/, "").split("/");
    const dir = parts.length > 1 ? parts[0] : "";
    if (!tree[dir]) tree[dir] = [];
    tree[dir].push(group);
  }
  return tree;
}

function getGroupForExercise(exerciseId: string, groups: Record<string, ExerciseGroup>): string | null {
  for (const group of Object.values(groups)) {
    if (group.exerciseIds.includes(exerciseId)) return group.id;
  }
  return null;
}

function assembleFileContent(
  group: ExerciseGroup,
  currentExerciseId: string,
  exercises: Record<string, { starterCode: string }>
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
    const exData = exercises[exId];
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

/** Build full file content for a group (for search indexing). */
function getFileCode(group: ExerciseGroup, exercises: Record<string, { starterCode: string }>): string {
  const parts: string[] = [];
  if (group.preamble.trim()) {
    parts.push(group.preamble.trim());
    parts.push("");
  }
  for (const exId of group.exerciseIds) {
    const exData = exercises[exId];
    if (!exData) continue;
    let code: string;
    try {
      const saved = localStorage.getItem(`pl-exercise-${exId}`);
      code = saved || exData.starterCode;
    } catch {
      code = exData.starterCode;
    }
    parts.push(code.trim());
    parts.push("");
  }
  return parts.join("\n").trimEnd();
}

const DIR_ORDER = ["keys", "scripts", "transactions"];

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function FileIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function SearchIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExerciseFileBrowser({
  currentExerciseId,
  theme,
  onClose,
  tutorialType = "lightning",
}: ExerciseFileBrowserProps) {
  const dark = theme === "dark";
  const isMobile = useIsMobile();
  const isNoise = tutorialType === "noise";
  const exerciseGroups = isNoise ? NOISE_EXERCISE_GROUPS : EXERCISE_GROUPS;
  const exercises: Record<string, { starterCode: string }> = isNoise ? CODE_EXERCISES : LIGHTNING_EXERCISES;
  const dirOrder = useMemo(() => {
    if (isNoise) return Array.from(new Set(Object.values(NOISE_EXERCISE_GROUPS).map(g => g.label.replace(/\.py$/, "").split("/")[0])));
    return DIR_ORDER;
  }, [isNoise]);
  const fileTree = useMemo(() => buildFileTree(exerciseGroups), [exerciseGroups]);
  const currentGroupId = useMemo(
    () => getGroupForExercise(currentExerciseId, exerciseGroups),
    [currentExerciseId, exerciseGroups]
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    currentGroupId || Object.values(exerciseGroups)[0]?.id || ""
  );
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(dirOrder));

  // Sidebar mode: "files" or "search"
  const [sidebarMode, setSidebarMode] = useState<"files" | "search">("files");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [expandedSearchFiles, setExpandedSearchFiles] = useState<Set<string>>(new Set());

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const isLnModule = !isNoise && selectedGroupId === "__ln_module__";
  const selectedGroup = isLnModule ? null : exerciseGroups[selectedGroupId];

  // Build content for selected file
  const fileContent = useMemo(() => {
    if (isLnModule) return { code: LN_MODULE_DISPLAY_CODE, currentLineStart: -1, currentLineEnd: -1 };
    if (!selectedGroup) return { code: "", currentLineStart: -1, currentLineEnd: -1 };
    return assembleFileContent(selectedGroup, currentExerciseId, exercises);
  }, [selectedGroup, currentExerciseId, isLnModule, exercises]);

  // ── Cross-file search ──────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const lower = searchQuery.toLowerCase();
    const results: SearchMatch[] = [];

    // Search ln.py (Lightning only)
    if (!isNoise) {
      const lnLines = LN_MODULE_DISPLAY_CODE.split("\n");
      let lnCharPos = 0;
      for (let i = 0; i < lnLines.length; i++) {
        const lineText = lnLines[i];
        const lineLower = lineText.toLowerCase();
        let col = 0;
        while (true) {
          const found = lineLower.indexOf(lower, col);
          if (found === -1) break;
          results.push({
            groupId: "__ln_module__",
            fileLabel: "ln.py",
            lineNum: i + 1,
            lineText,
            charPos: lnCharPos + found,
          });
          col = found + 1;
        }
        lnCharPos += lineText.length + 1; // +1 for newline
      }
    }

    // Search exercise groups
    for (const group of Object.values(exerciseGroups)) {
      const code = getFileCode(group, exercises);
      const lines = code.split("\n");
      let charPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const lineLower = lineText.toLowerCase();
        let col = 0;
        while (true) {
          const found = lineLower.indexOf(lower, col);
          if (found === -1) break;
          results.push({
            groupId: group.id,
            fileLabel: group.label,
            lineNum: i + 1,
            lineText,
            charPos: charPos + found,
          });
          col = found + 1;
        }
        charPos += lineText.length + 1;
      }
    }

    return results;
  }, [searchQuery, isNoise, exerciseGroups, exercises]);

  // Group search results by file
  const groupedSearchResults = useMemo(() => {
    const grouped: Record<string, SearchMatch[]> = {};
    for (const r of searchResults) {
      if (!grouped[r.groupId]) grouped[r.groupId] = [];
      grouped[r.groupId].push(r);
    }
    return grouped;
  }, [searchResults]);

  // Auto-expand all files in search results
  useEffect(() => {
    if (searchResults.length > 0) {
      const files = new Set(searchResults.map(r => r.groupId));
      setExpandedSearchFiles(files);
    }
  }, [searchResults]);

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
      searchHighlightField,
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
        ".cm-search-match": {
          backgroundColor: dark ? "rgba(255,215,0,0.25)" : "rgba(184,134,11,0.2)",
          borderRadius: "2px",
        },
        ".cm-search-match-current": {
          backgroundColor: dark ? "rgba(255,215,0,0.5)" : "rgba(184,134,11,0.4)",
          borderRadius: "2px",
        },
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

  // ── Highlight matches in editor when navigating from search ────────────
  const highlightMatchInEditor = useCallback((match: SearchMatch) => {
    // Switch to this file
    setSelectedGroupId(match.groupId);

    // After CodeMirror reinitializes, highlight and scroll
    requestAnimationFrame(() => {
      setTimeout(() => {
        const view = viewRef.current;
        if (!view) return;

        const query = searchQuery.toLowerCase();
        const doc = view.state.doc.toString();
        const lower = doc.toLowerCase();
        const positions: number[] = [];
        let idx = 0;
        while (true) {
          const found = lower.indexOf(query, idx);
          if (found === -1) break;
          positions.push(found);
          idx = found + 1;
        }

        // Find which match index corresponds to this line
        const targetLine = view.state.doc.line(Math.min(match.lineNum, view.state.doc.lines));
        let activeIdx = 0;
        for (let i = 0; i < positions.length; i++) {
          if (positions[i] >= targetLine.from && positions[i] < targetLine.to) {
            activeIdx = i;
            break;
          }
        }

        const decorations = positions.map((pos, i) =>
          (i === activeIdx ? searchCurrentMark : searchMatchMark).range(pos, pos + searchQuery.length)
        );
        view.dispatch({ effects: setSearchHighlights.of(Decoration.set(decorations)) });
        view.dispatch({ effects: EditorView.scrollIntoView(targetLine.from, { y: "center" }) });
      }, 80);
    });
  }, [searchQuery]);

  // Focus search input when switching to search mode
  useEffect(() => {
    if (sidebarMode === "search") {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      // Clear highlights when leaving search
      const view = viewRef.current;
      if (view) {
        view.dispatch({ effects: setSearchHighlights.of(Decoration.none) });
      }
    }
  }, [sidebarMode]);

  // ── Theme ─────────────────────────────────────────────────────────────
  const panelBg = dark ? "bg-[#0a0f1a]" : "bg-white";
  const sidebarBg = dark ? "bg-[#0b1220]" : "bg-[#f8f5ef]";
  const borderColor = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const textMuted = dark ? "text-slate-400" : "text-black/60";
  const activeFileBg = dark ? "bg-[#FFD700]/10" : "bg-[#b8860b]/10";
  const activeFileBorder = dark ? "border-l-[#FFD700]" : "border-l-[#b8860b]";
  const hoverBg = dark ? "hover:bg-[#0f1930]" : "hover:bg-[#f0e8d8]";
  const activityBarBg = dark ? "bg-[#080d17]" : "bg-[#f0ebe0]";
  const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;

  // Render a highlighted match line
  const renderMatchLine = (lineText: string, query: string) => {
    const trimmed = lineText.trimStart();
    const lower = trimmed.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return <span>{trimmed}</span>;
    return (
      <>
        {trimmed.slice(0, idx)}
        <span className={dark ? "bg-[#FFD700]/30 text-[#FFD700]" : "bg-[#b8860b]/25 text-[#6b4c00]"}>
          {trimmed.slice(idx, idx + query.length)}
        </span>
        {trimmed.slice(idx + query.length)}
      </>
    );
  };

  // Build flat list of all groups for mobile dropdown
  const allGroups = useMemo(() => {
    const groups: Array<{ id: string; label: string }> = [];
    if (!isNoise) groups.push({ id: "__ln_module__", label: "ln.py" });
    for (const dir of dirOrder) {
      for (const group of fileTree[dir] || []) {
        groups.push({ id: group.id, label: group.label });
      }
    }
    return groups;
  }, [fileTree, isNoise, dirOrder]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${dark ? "bg-black/70" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative ${isMobile ? "w-full h-full" : "w-[95vw] h-[90vh]"} flex ${isMobile ? "flex-col" : ""} border-2 ${borderColor} ${panelBg} shadow-2xl overflow-hidden`}>

        {/* Mobile: compact header with dropdown */}
        {isMobile && (
          <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderColor} shrink-0`}>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className={`flex-1 text-sm border px-2 py-2 min-h-[44px] ${
                dark
                  ? "bg-[#0f1930] border-[#2a3552] text-slate-200"
                  : "bg-white border-[#d4c9a8] text-foreground"
              }`}
              style={{ ...sansFont, fontSize: "16px" }}
              data-testid="select-mobile-file-browser"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <button
              onClick={onClose}
              className={`font-pixel text-xs px-3 py-2 min-h-[44px] border transition-all cursor-pointer ${
                dark
                  ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                  : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"
              }`}
              data-testid="button-mobile-file-browser-close"
            >
              CLOSE
            </button>
          </div>
        )}

        {/* Desktop: Activity bar (narrow icon strip) */}
        {!isMobile && (
          <div className={`w-10 shrink-0 ${activityBarBg} border-r ${borderColor} flex flex-col items-center pt-2 gap-1`}>
            <button
              type="button"
              onClick={() => setSidebarMode("files")}
              className={`p-2 transition-colors cursor-pointer ${
                sidebarMode === "files"
                  ? `${goldText} ${dark ? "border-l-2 border-l-[#FFD700]" : "border-l-2 border-l-[#9a7200]"}`
                  : `${textMuted} ${dark ? "hover:text-slate-200" : "hover:text-black/70"} border-l-2 border-l-transparent`
              }`}
              title="Explorer"
            >
              <FileIcon size={20} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarMode("search")}
              className={`p-2 transition-colors cursor-pointer ${
                sidebarMode === "search"
                  ? `${goldText} ${dark ? "border-l-2 border-l-[#FFD700]" : "border-l-2 border-l-[#9a7200]"}`
                  : `${textMuted} ${dark ? "hover:text-slate-200" : "hover:text-black/70"} border-l-2 border-l-transparent`
              }`}
              title="Search"
            >
              <SearchIcon size={20} />
            </button>
          </div>
        )}

        {/* Desktop: Sidebar panel (files or search) */}
        {!isMobile && (
        <div className={`w-72 shrink-0 border-r ${borderColor} ${sidebarBg} flex flex-col overflow-hidden`}>

          {/* ── Files view ──────────────────────────────────────────── */}
          {sidebarMode === "files" && (
            <>
              <div className={`px-3 py-2 border-b ${borderColor}`}>
                <span className={`font-pixel text-[10px] ${goldText}`}>EXPLORER</span>
              </div>
              <div className="flex-1 overflow-y-auto py-1">
                {/* ln.py (Lightning only) */}
                {!isNoise && (
                <button
                  type="button"
                  onClick={() => setSelectedGroupId("__ln_module__")}
                  className={`w-full flex items-center gap-1.5 px-3 pl-5 py-1.5 text-left transition-colors cursor-pointer border-l-2 ${
                    isLnModule
                      ? `${activeFileBg} ${activeFileBorder}`
                      : `border-l-transparent ${hoverBg}`
                  }`}
                >
                  <span className={`text-sm ${isLnModule ? goldText : textMuted}`} style={sansFont}>
                    ln.py
                  </span>
                </button>
                )}

                {dirOrder.map((dir) => {
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
            </>
          )}

          {/* ── Search view ─────────────────────────────────────────── */}
          {sidebarMode === "search" && (
            <>
              <div className={`px-3 py-2 border-b ${borderColor}`}>
                <span className={`font-pixel text-[10px] ${goldText}`}>SEARCH</span>
              </div>
              <div className={`px-2 py-2 border-b ${borderColor}`}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      setSidebarMode("files");
                    }
                  }}
                  placeholder="Search..."
                  className={`w-full text-[15px] px-2.5 py-2 border outline-none ${
                    dark
                      ? "bg-[#0a0f1a] border-[#2a3552] text-slate-200 placeholder:text-slate-600 focus:border-[#FFD700]/50"
                      : "bg-white border-[#d4c9a8] text-black/80 placeholder:text-black/30 focus:border-[#b8860b]/50"
                  }`}
                  style={sansFont}
                />
                {searchQuery.length >= 2 && (
                  <div className={`text-sm mt-1.5 px-0.5 ${textMuted}`} style={sansFont}>
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} in {Object.keys(groupedSearchResults).length} file{Object.keys(groupedSearchResults).length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className={`px-3 py-4 text-center text-sm ${textMuted}`} style={sansFont}>
                    No results found
                  </div>
                )}
                {Object.entries(groupedSearchResults).map(([groupId, matches]) => {
                  const fileLabel = matches[0].fileLabel;
                  const isExpanded = expandedSearchFiles.has(groupId);
                  return (
                    <div key={groupId}>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedSearchFiles((prev) => {
                            const next = new Set(prev);
                            if (next.has(groupId)) next.delete(groupId);
                            else next.add(groupId);
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${hoverBg} cursor-pointer`}
                      >
                        <span className={`text-xs ${textMuted} w-3`}>{isExpanded ? "▾" : "▸"}</span>
                        <span className={`text-[15px] font-semibold truncate ${dark ? "text-slate-300" : "text-black/70"}`} style={sansFont}>
                          {fileLabel}
                        </span>
                        <span className={`ml-auto text-xs shrink-0 px-1.5 py-0.5 ${
                          dark ? "bg-slate-700/50 text-slate-400" : "bg-black/5 text-black/40"
                        }`} style={sansFont}>
                          {matches.length}
                        </span>
                      </button>
                      {isExpanded && (
                        <div>
                          {matches.map((m, i) => (
                            <button
                              key={`${m.groupId}-${m.lineNum}-${i}`}
                              type="button"
                              onClick={() => highlightMatchInEditor(m)}
                              className={`w-full text-left pl-7 pr-2 py-1.5 transition-colors cursor-pointer ${
                                dark ? "hover:bg-[#0f1930]" : "hover:bg-[#f0e8d8]"
                              }`}
                            >
                              <div className={`text-[14px] truncate leading-relaxed ${
                                dark ? "text-slate-400" : "text-black/60"
                              }`} style={sansFont}>
                                {renderMatchLine(m.lineText, searchQuery)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        )}

        {/* Content - code view */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* File header (desktop only — mobile uses the compact header above) */}
          {!isMobile && (
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
          )}

          {/* Exercise tabs within file (hidden for ln.py) */}
          {selectedGroup && !isLnModule && (
            <div className={`px-2 py-1 border-b ${borderColor} flex items-center gap-1 overflow-x-auto shrink-0`}>
              {selectedGroup.exerciseIds.map((exId) => {
                const exData = exercises[exId];
                if (!exData) return null;
                const isCurrent = exId === currentExerciseId;
                const fnMatch = exData.starterCode.match(/def\s+(\w+)/);
                const fnName = fnMatch ? fnMatch[1] : exId.replace(/^(ln-exercise-|exercise-)/, "");

                return (
                  <button
                    key={exId}
                    type="button"
                    onClick={() => {
                      if (!viewRef.current) return;
                      const content = assembleFileContent(selectedGroup, exId, exercises);
                      if (content.currentLineStart > 0) {
                        const line = viewRef.current.state.doc.line(
                          Math.min(content.currentLineStart, viewRef.current.state.doc.lines)
                        );
                        viewRef.current.dispatch({
                          effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 40 }),
                        });
                      }
                    }}
                    className={`text-xs px-1.5 py-0.5 whitespace-nowrap transition-colors cursor-pointer border ${
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
