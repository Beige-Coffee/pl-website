import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { EditorView, ViewPlugin, keymap, placeholder as cmPlaceholder, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, Decoration, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { EditorState, StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { indentUnit, indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
// pythonLanguage import kept for potential future use
// import { pythonLanguage } from "@codemirror/lang-python";
import { lintKeymap } from "@codemirror/lint";
import { runPythonTests, type TestResult } from "../lib/pyodide-runner";
import { createPyodideCompletionSource, createWordCompletionSource, preloadCompletionContext, invalidateCompletionCache } from "../lib/pyodide-completions";
import { signatureHints } from "../lib/signature-hint-extension";
import { cleanErrorMessage } from "../lib/error-cleanup";
import { QRCodeSVG } from "qrcode.react";
import ExerciseFileBrowser from "./ExerciseFileBrowser";

// ─── Light Mode Syntax Highlighting ──────────────────────────────────────────

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#d73a49" },               // if, for, def, class, return, from, import
  { tag: tags.controlKeyword, color: "#d73a49" },
  { tag: tags.definitionKeyword, color: "#d73a49" },
  { tag: tags.operatorKeyword, color: "#d73a49" },        // and, or, not, in, is
  { tag: tags.standard(tags.variableName), color: "#6f42c1" }, // bytearray, int, bytes, len, range, print
  { tag: tags.function(tags.variableName), color: "#6f42c1" },  // function calls
  { tag: tags.function(tags.definition(tags.variableName)), color: "#6f42c1" }, // function defs
  { tag: tags.string, color: "#032f62" },                 // strings
  { tag: tags.comment, color: "#6a737d", fontStyle: "italic" },
  { tag: tags.number, color: "#005cc5" },
  { tag: tags.bool, color: "#005cc5" },                   // True, False
  { tag: tags.self, color: "#d73a49" },                   // self
  { tag: tags.operator, color: "#d73a49" },               // =, +, *, etc.
  { tag: tags.className, color: "#6f42c1" },
  { tag: tags.propertyName, color: "#005cc5" },
  { tag: tags.special(tags.string), color: "#032f62" },   // f-strings, docstrings
]);

// ─── Editable Range Extensions ───────────────────────────────────────────────

/** Effect to initialize or reset the editable range */
const setEditableRange = StateEffect.define<{ from: number; to: number }>();

/** StateField tracking the editable region boundaries as the user types */
const editableRangeField = StateField.define<{ from: number; to: number }>({
  create: () => ({ from: 0, to: 0 }),
  update(value, tr) {
    let newValue = value;
    for (const e of tr.effects) {
      if (e.is(setEditableRange)) newValue = e.value;
    }
    if (tr.docChanged && newValue !== value) {
      // Just set, don't map
      return newValue;
    }
    if (tr.docChanged) {
      return {
        from: tr.changes.mapPos(newValue.from),
        to: tr.changes.mapPos(newValue.to, 1), // bias right so inserts expand range
      };
    }
    return newValue;
  },
});

/** Transaction filter that blocks edits outside the editable range */
const editableRangeFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  const range = tr.startState.field(editableRangeField);
  // If range is 0,0 (not initialized), allow everything
  if (range.from === 0 && range.to === 0) return tr;
  let dominated = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (fromA < range.from || toA > range.to) dominated = true;
  });
  return dominated ? [] : tr;
});

/** Line decoration for read-only regions */
const readOnlyLineDeco = Decoration.line({ class: "cm-readonly-line" });

/** ViewPlugin that adds dim decorations to lines outside the editable range */
const readOnlyDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.transactions.some(t => t.effects.some(e => e.is(setEditableRange)))) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const range = view.state.field(editableRangeField);
      if (range.from === 0 && range.to === 0) return Decoration.none;
      const builder = new RangeSetBuilder<Decoration>();
      for (let i = 1; i <= view.state.doc.lines; i++) {
        const line = view.state.doc.line(i);
        if (line.to <= range.from || line.from >= range.to) {
          builder.add(line.from, line.from, readOnlyLineDeco);
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CodeBlock {
  code: string;
  explanation: string;
}

export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  sampleCode?: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
    codeBlocks?: CodeBlock[];
  };
  rewardSats: number;
}

interface CodeExerciseProps {
  exerciseId: string;
  data: CodeExerciseData;
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  lightningAddress: string | null;
  alreadyCompleted: boolean;
  claimInfo: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest: () => void;
  onCompleted: (checkpointId: string, amountSats?: number) => void;
  getProgress: (key: string) => string | null;
  saveProgress: (key: string, value: string) => void;
  // Group context for "accumulating file" model
  fileLabel?: string;
  preamble?: string;
  setupCode?: string; // Hidden Python code executed but not shown in editor
  crossGroupExercises?: Array<{ id: string; starterCode: string }>; // Standalone functions — before preamble
  classMethodExercises?: Array<{ id: string; starterCode: string }>; // CKM class methods — after setupCode's class decl
  priorInGroupExercises?: Array<{ id: string; starterCode: string }>; // Same-group priors — after preamble
  futureExercises?: Array<{ id: string; starterCode: string }>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CodeExercise({
  exerciseId,
  data,
  theme,
  authenticated,
  sessionToken,
  lightningAddress,
  alreadyCompleted,
  claimInfo,
  onLoginRequest,
  onCompleted,
  getProgress,
  saveProgress,
  fileLabel,
  preamble,
  setupCode,
  crossGroupExercises,
  classMethodExercises,
  priorInGroupExercises,
  futureExercises,
}: CodeExerciseProps) {
  const dark = theme === "dark";
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const storageKey = `pl-exercise-${exerciseId}`;

  // Whether this exercise has group context (read-only region above)
  const hasGroupContext = !!preamble;

  const [expanded, setExpanded] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate editor from server-saved progress (once).
  // We track the last getProgress ref to detect when server data first arrives,
  // but stop attempting hydration as soon as the user starts editing.
  const userEditedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || userEditedRef.current) return;
    const serverSaved = getProgress(`exercise-${exerciseId}`);
    if (serverSaved && viewRef.current) {
      if (hasGroupContext) {
        // Replace only the editable region with server-saved code
        const range = viewRef.current.state.field(editableRangeField);
        const currentEditable = viewRef.current.state.doc.sliceString(range.from, range.to);
        if (currentEditable !== serverSaved) {
          viewRef.current.dispatch({
            changes: { from: range.from, to: range.to, insert: serverSaved },
          });
        }
      } else {
        const currentCode = viewRef.current.state.doc.toString();
        if (currentCode !== serverSaved) {
          viewRef.current.dispatch({
            changes: { from: 0, to: currentCode.length, insert: serverSaved },
          });
        }
      }
      hydratedRef.current = true;
    }
  }, [getProgress, exerciseId, hasGroupContext]);

  // File browser state
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);

  // Hint state: null = closed, "conceptual" | "steps" | "code" = which is open
  const [activeHint, setActiveHint] = useState<"conceptual" | "steps" | "code" | null>(null);
  const hintCodeRef = useRef<HTMLDivElement>(null);
  const hintViewRef = useRef<EditorView | null>(null);

  // Test run state
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  // Reward state (mirrors CheckpointQuestion)
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [rewardAmountSats, setRewardAmountSats] = useState(data.rewardSats);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);
  const [autoPaySending, setAutoPaySending] = useState(false);
  const [showClaimChoice, setShowClaimChoice] = useState(false);

  // Read-only CodeMirror for code hint (fallback when no codeBlocks)
  useEffect(() => {
    if (activeHint !== "code" || !hintCodeRef.current || data.hints.codeBlocks?.length) {
      if (hintViewRef.current) {
        hintViewRef.current.destroy();
        hintViewRef.current = null;
      }
      return;
    }
    if (hintViewRef.current) return;

    const hintExtensions = [
      python(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      ...(dark ? [oneDark] : [syntaxHighlighting(lightHighlightStyle)]),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.theme({
        "&": { fontSize: "14px", borderRadius: "4px", overflow: "hidden" },
        ".cm-scroller": { overflow: "auto", maxHeight: "350px" },
        ".cm-gutters": { display: "none" },
        ".cm-content": { padding: "8px 12px" },
        "&.cm-focused": { outline: "none" },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: data.hints.code.trim(), extensions: hintExtensions }),
      parent: hintCodeRef.current,
    });
    hintViewRef.current = view;

    return () => {
      view.destroy();
      hintViewRef.current = null;
    };
  }, [activeHint, dark, data.hints.code, data.hints.codeBlocks]);

  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);

  // Assemble the editor display: visible preamble + editable student code.
  // No prior exercises, no future stubs — only clean imports + current exercise.
  const assembleFullFile = useCallback((studentCode: string): { code: string; editableFrom: number; editableTo: number } => {
    if (!hasGroupContext) {
      return { code: studentCode, editableFrom: 0, editableTo: studentCode.length };
    }
    const readOnlyTop = preamble ?? "";
    const beforeEditable = readOnlyTop ? readOnlyTop + "\n\n" : "";
    const fullCode = beforeEditable + studentCode;
    const editableFrom = beforeEditable.length;
    const editableTo = editableFrom + studentCode.length;
    return { code: fullCode, editableFrom, editableTo };
  }, [preamble, hasGroupContext]);

  // Assemble context for autocomplete preloading (includes hidden setupCode)
  const assembleContext = useCallback((): string => {
    const parts: string[] = [];
    if (setupCode) parts.push(setupCode);
    // Class method deps go right after setupCode (inside class ChannelKeyManager:)
    for (const cm of classMethodExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${cm.id}`);
        parts.push(saved ?? cm.starterCode);
      } catch {
        parts.push(cm.starterCode);
      }
    }
    // Standalone cross-group deps go before the preamble
    for (const cg of crossGroupExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${cg.id}`);
        parts.push(saved ?? cg.starterCode);
      } catch {
        parts.push(cg.starterCode);
      }
    }
    if (preamble) parts.push(preamble);
    // Prior in-group exercises go after preamble
    for (const pe of priorInGroupExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${pe.id}`);
        parts.push(saved ?? pe.starterCode);
      } catch {
        parts.push(pe.starterCode);
      }
    }
    return parts.filter(Boolean).join("\n\n");
  }, [setupCode, preamble, crossGroupExercises, classMethodExercises, priorInGroupExercises]);

  // Assemble full code for test execution
  // Order: [setupCode] → [classMethodDeps] → [standaloneDeps] → [preamble] → [inGroupPriors] → [student] → [futureStubs]
  const assembleTestCode = useCallback((): string => {
    if (!hasGroupContext) {
      const studentCode = viewRef.current?.state.doc.toString() || "";
      const context = assembleContext();
      return [context, studentCode].filter(Boolean).join("\n\n");
    }

    const parts: string[] = [];

    // 1. Hidden setup code (registers `ln` module, may include `class ChannelKeyManager:`)
    if (setupCode) parts.push(setupCode);

    // 2. Class method cross-group deps (go right after setupCode's class declaration)
    for (const cm of classMethodExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${cm.id}`);
        parts.push(saved ?? cm.starterCode);
      } catch {
        parts.push(cm.starterCode);
      }
    }

    // 3. Standalone cross-group deps (go BEFORE the preamble, at module level)
    for (const cg of crossGroupExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${cg.id}`);
        parts.push(saved ?? cg.starterCode);
      } catch {
        parts.push(cg.starterCode);
      }
    }

    // 4. Visible preamble (imports from ln, class declarations)
    if (preamble) parts.push(preamble);

    // 5. Prior in-group exercises (inside the class body if applicable)
    for (const pe of priorInGroupExercises ?? []) {
      try {
        const saved = localStorage.getItem(`pl-exercise-${pe.id}`);
        parts.push(saved ?? pe.starterCode);
      } catch {
        parts.push(pe.starterCode);
      }
    }

    // 6. Current exercise: extract from editor
    const range = viewRef.current?.state.field(editableRangeField);
    const editableCode = range
      ? viewRef.current?.state.doc.sliceString(range.from, range.to) || ""
      : viewRef.current?.state.doc.toString() || "";
    parts.push(editableCode);

    // 7. Future exercises: include stubs so class body is complete
    for (const fe of futureExercises ?? []) {
      parts.push(fe.starterCode);
    }

    return parts.filter(Boolean).join("\n\n");
  }, [setupCode, preamble, crossGroupExercises, classMethodExercises, priorInGroupExercises, futureExercises, hasGroupContext, assembleContext]);


  // Stable completion sources (created once)
  const pyodideCompleteSource = useMemo(() => createPyodideCompletionSource(), []);
  const wordCompleteSource = useMemo(() => createWordCompletionSource(), []);

  // Preload completion context immediately on mount (Pyodide worker is
  // pre-warmed at the tutorial page level, so the exec queues behind init)
  useEffect(() => {
    const ctx = assembleContext();
    if (ctx) preloadCompletionContext(ctx);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll and handle Escape when expanded
  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [expanded]);

  // ── CodeMirror setup ────────────────────────────────────────────────────

  // Load only the student's editable code (not the full file)
  const getStudentCode = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    } catch {}
    return data.starterCode;
  }, [storageKey, data.starterCode]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Assemble the full file with fresh student code from localStorage
    const { code: fullFile, editableFrom, editableTo } = assembleFullFile(getStudentCode());

    const extensions = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      ...(dark ? [oneDark] : [syntaxHighlighting(lightHighlightStyle)]),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion({
        activateOnTyping: true,
        activateOnTypingDelay: 100,
        override: [pyodideCompleteSource, wordCompleteSource],
      }),
      signatureHints(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
      ]),
      python(),
      indentUnit.of("    "),
      EditorState.tabSize.of(4),
      keymap.of([...defaultKeymap, indentWithTab]),
      // Editable range tracking + restriction (only when group context exists)
      ...(hasGroupContext ? [
        editableRangeField,
        editableRangeFilter,
        readOnlyDecoPlugin,
      ] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          userEditedRef.current = true;
          if (hasGroupContext) {
            // Save only the editable region
            const range = update.state.field(editableRangeField);
            const editableCode = update.state.doc.sliceString(range.from, range.to);
            try {
              localStorage.setItem(storageKey, editableCode);
            } catch {}
            saveProgress(`exercise-${exerciseId}`, editableCode);
          } else {
            const code = update.state.doc.toString();
            try {
              localStorage.setItem(storageKey, code);
            } catch {}
            saveProgress(`exercise-${exerciseId}`, code);
          }
        }
      }),
      EditorView.theme({
        "&": {
          fontSize: "14px",
          border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
          borderRadius: "8px",
          overflow: "hidden",
          ...(expanded ? { display: "flex", flexDirection: "column", height: "100%" } : {}),
        },
        ".cm-scroller": { overflow: "auto", maxHeight: expanded ? "none" : "500px", ...(expanded ? { flex: "1", minHeight: "0" } : {}) },
        ".cm-gutters": {
          backgroundColor: dark ? "#1e1e2e" : "#f5f0e8",
          borderRight: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
        },
        ".cm-readonly-line": {
        },
        ".cm-panels": { fontSize: "14px" },
        ".cm-search": { fontSize: "14px" },
        ".cm-search input, .cm-search button, .cm-search label": { fontSize: "14px" },
      }),
    ];

    const state = EditorState.create({
      doc: fullFile,
      selection: hasGroupContext ? { anchor: editableFrom } : undefined,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Initialize editable range
    if (hasGroupContext) {
      view.dispatch({
        effects: setEditableRange.of({ from: editableFrom, to: editableTo }),
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [dark, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reward polling (same as CheckpointQuestion) ──────────────────────────

  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const d = await res.json();
        setWithdrawalStatus(d.status);
        if (d.status === "paid") {
          onCompleted(exerciseId, rewardAmountSats);
          clearInterval(interval);
        } else if (d.status === "expired" || d.status === "failed") {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [rewardK1, withdrawalStatus]);

  useEffect(() => {
    if (!rewardCreatedAt || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rewardCreatedAt) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        setWithdrawalStatus("expired");
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rewardCreatedAt, withdrawalStatus]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Save completion when tests pass ────────────────────────────────────
  const completedDisplay = alreadyCompleted || autoPaid;

  useEffect(() => {
    if (allPassed) justCompletedRef.current = true;
    if (allPassed && sessionToken) {
      // Save completion server-side (independent of reward claim)
      fetch("/api/checkpoint/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ checkpointId: exerciseId, answer: 0 }),
      }).then(res => {
        if (!res.ok) res.json().then(d => console.warn(`Checkpoint save failed for ${exerciseId}:`, d)).catch(() => {});
      }).catch(err => console.warn(`Checkpoint save error for ${exerciseId}:`, err));
      onCompleted(exerciseId);
    }
  }, [allPassed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-pay when tests pass ────────────────────────────────────────────
  useEffect(() => {
    if (
      allPassed &&
      !completedDisplay &&
      !autoPaid &&
      !autoPaySending &&
      !claiming &&
      !rewardK1 &&
      authenticated &&
      lightningAddress &&
      sessionToken
    ) {
      handleClaimReward("address");
    }
  }, [allPassed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-pay for already-completed but unclaimed exercises ──────────────
  const completedButUnclaimed = alreadyCompleted && (!claimInfo || claimInfo.amountSats === 0);
  useEffect(() => {
    if (justCompletedRef.current) return;
    if (
      completedButUnclaimed &&
      !autoPaid &&
      !autoPaySending &&
      !claiming &&
      !rewardK1 &&
      authenticated &&
      lightningAddress &&
      sessionToken
    ) {
      handleClaimReward("address");
    }
  }, [completedButUnclaimed, authenticated, lightningAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run tests ────────────────────────────────────────────────────────────

  const handleRunTests = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setPyodideLoading(true);
    setRunError(null);
    setResults(null);
    setAllPassed(false);

    try {
      const fullCode = assembleTestCode();
      const testResults = await runPythonTests(fullCode, data.testCode);
      setResults(testResults);
      const passed = testResults.length > 0 && testResults.every((r) => r.passed);
      setAllPassed(passed);
    } catch (err: any) {
      // Calculate how many hidden lines precede student code
      // Assembly order: setupCode → classMethodDeps → standaloneDeps → preamble → inGroupPriors → student
      const countLines = (code: string) => code.split("\n").length;
      const setupLines = countLines(setupCode || "");
      const classMethodLines = (classMethodExercises ?? []).reduce((sum, cm) => {
        try {
          const code = localStorage.getItem(`pl-exercise-${cm.id}`) || cm.starterCode;
          return sum + countLines(code) + 2;
        } catch { return sum + countLines(cm.starterCode) + 2; }
      }, 0);
      const crossGroupLines = (crossGroupExercises ?? []).reduce((sum, cg) => {
        try {
          const code = localStorage.getItem(`pl-exercise-${cg.id}`) || cg.starterCode;
          return sum + countLines(code) + 2;
        } catch { return sum + countLines(cg.starterCode) + 2; }
      }, 0);
      const preambleLines = countLines(preamble || "");
      const priorLines = (priorInGroupExercises ?? []).reduce((sum, pe) => {
        try {
          const code = localStorage.getItem(`pl-exercise-${pe.id}`) || pe.starterCode;
          return sum + countLines(code) + 2;
        } catch { return sum + countLines(pe.starterCode) + 2; }
      }, 0);
      const lineOffset = hasGroupContext
        ? setupLines + 2 + classMethodLines + crossGroupLines + preambleLines + 2 + priorLines
        : 0;
      setRunError(cleanErrorMessage(err.message || "Unknown error", lineOffset));
    } finally {
      setRunning(false);
      setPyodideLoading(false);
      invalidateCompletionCache();
      // Re-preload context so completions work after test run
      const ctx = assembleContext();
      if (ctx) preloadCompletionContext(ctx);
    }
  }, [running, data.testCode, assembleTestCode, assembleContext, setupCode, preamble, crossGroupExercises, classMethodExercises, priorInGroupExercises, hasGroupContext]);

  // ── Claim reward ─────────────────────────────────────────────────────────

  const claimingRef = useRef(false);
  const justCompletedRef = useRef(false);

  const handleClaimReward = useCallback(
    async (claimMethod?: "address" | "lnurl") => {
      if (!sessionToken) return;
      if (claimingRef.current) return;
      claimingRef.current = true;
      setClaiming(true);
      setClaimError(null);
      setShowClaimChoice(false);

      if (claimMethod !== "lnurl" && lightningAddress) {
        setAutoPaySending(true);
      }

      try {
        const res = await fetch("/api/checkpoint/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            checkpointId: exerciseId,
            answer: 0, // exercises use 0 as the "correct" answer
            method: claimMethod === "lnurl" ? "lnurl" : undefined,
          }),
        });

        let resData: any;
        try {
          resData = await res.json();
        } catch {
          setClaimError(`Server returned non-JSON response (status ${res.status})`);
          setAutoPaySending(false);
          return;
        }

        if (res.ok && resData.correct !== false) {
          if (resData.autoPaid) {
            setAutoPaid(true);
            setAutoPaySending(false);
            setRewardAmountSats(resData.amountSats || data.rewardSats);
            onCompleted(exerciseId, resData.amountSats || data.rewardSats);
          } else if (resData.alreadyCompleted) {
            setAutoPaySending(false);
            onCompleted(exerciseId, resData.amountSats || rewardAmountSats);
          } else {
            setAutoPaySending(false);
            setRewardK1(resData.k1);
            setRewardLnurl(resData.lnurl);
            setRewardAmountSats(resData.amountSats || data.rewardSats);
            setRewardCreatedAt(Date.now());
            setWithdrawalStatus("pending");
            setCountdown(300);
          }
        } else {
          setAutoPaySending(false);
          setClaimError(resData.error || "Failed to claim reward");
        }
      } catch {
        setAutoPaySending(false);
        setClaimError("Network error. Please try again.");
      } finally {
        claimingRef.current = false;
        setClaiming(false);
      }
    },
    [sessionToken, exerciseId, lightningAddress, data.rewardSats, onCompleted, rewardAmountSats]
  );

  // ── Reset code ────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (!viewRef.current) return;
    if (hasGroupContext) {
      // Replace only the editable region with the starter code
      const range = viewRef.current.state.field(editableRangeField);
      viewRef.current.dispatch({
        changes: { from: range.from, to: range.to, insert: data.starterCode },
      });
    } else {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: data.starterCode,
        },
      });
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setResults(null);
    setRunError(null);
    setAllPassed(false);
  }, [data.starterCode, storageKey, hasGroupContext]);

  // ── Send to Scratchpad ──────────────────────────────────────────────────

  const [showScratchpadTooltip, setShowScratchpadTooltip] = useState(false);
  const [showExpandTooltip, setShowExpandTooltip] = useState(false);
  const [scratchpadSent, setScratchpadSent] = useState(false);

  const handleSendToScratchpad = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("scratchpad-send-code", { detail: data.sampleCode || "" })
    );
    setScratchpadSent(true);
    setTimeout(() => setScratchpadSent(false), 2000);
  }, [data.sampleCode]);

  // ── Render ────────────────────────────────────────────────────────────────

  const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const greenText = dark ? "text-green-400" : "text-green-700";

  const exerciseContent = (
    <div className={expanded ? "flex flex-col flex-1 min-h-0" : `my-4 border-2 ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-5`}>
      {/* Description + Expand button */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`text-lg md:text-[19px] ${textMuted} leading-relaxed flex-1 [&_code]:bg-amber-100/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.88em] [&_code]:font-mono`} style={sansFont}
          dangerouslySetInnerHTML={{ __html: data.description }}
        />
        {!expanded && (
          <div className="relative">
            <button
              onClick={() => setExpanded(true)}
              onMouseEnter={() => setShowExpandTooltip(true)}
              onMouseLeave={() => setShowExpandTooltip(false)}
              className={`font-pixel text-base border-2 px-2.5 py-0.5 transition-all shrink-0 mt-0.5 leading-none cursor-pointer ${
                dark
                  ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                  : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
              }`}
              data-testid="button-expand-exercise"
            >
              +
            </button>
            {showExpandTooltip && (
              <div
                className={`absolute top-full right-0 mt-1.5 w-44 px-3 py-2 text-xs z-50 border ${
                  dark
                    ? "bg-[#0f1930] border-[#2a3552] text-slate-300"
                    : "bg-white border-border text-foreground/80"
                } shadow-lg`}
                style={sansFont}
              >
                Expand editor to full screen
                <div className={`absolute bottom-full right-3 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent ${
                  dark ? "border-b-[#2a3552]" : "border-b-border"
                }`} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* File browser button (shown when group context is available) */}
      {(fileLabel || (priorInGroupExercises && priorInGroupExercises.length > 0) || (crossGroupExercises && crossGroupExercises.length > 0) || (classMethodExercises && classMethodExercises.length > 0) || preamble) && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setFileBrowserOpen(true)}
            className={`flex items-center gap-2 px-3 py-2 text-left transition-all border cursor-pointer ${
              dark
                ? "border-[#2a3552] bg-[#0b1220] text-slate-400 hover:text-[#FFD700] hover:border-[#FFD700]/40 hover:bg-[#0f1930]"
                : "border-border bg-secondary/50 text-foreground/80 hover:text-[#9a7200] hover:border-[#b8860b]/40 hover:bg-secondary"
            }`}
          >
            <span className="text-sm opacity-80">📁</span>
            <span className="text-sm" style={sansFont}>
              {fileLabel ?? "exercise files"}
            </span>
            <span className={`ml-auto text-sm opacity-70`} style={sansFont}>
              browse all files
            </span>
          </button>
        </div>
      )}

      {/* Scratchpad button — above editor, right-aligned */}
      <div className="flex justify-end mb-1.5 hidden lg:flex">
        <div className="relative">
          <button
            onClick={handleSendToScratchpad}
            onMouseEnter={() => setShowScratchpadTooltip(true)}
            onMouseLeave={() => setShowScratchpadTooltip(false)}
            className={`font-pixel text-[9px] px-2.5 py-1.5 border transition-all cursor-pointer flex items-center gap-1.5 ${
              scratchpadSent
                ? `${goldBorder} ${dark ? "bg-[#FFD700]/20 text-[#FFD700]" : "bg-[#b8860b]/15 text-[#9a7200]"}`
                : dark
                  ? "border-[#2a3552]/80 bg-[#0f1930] text-slate-500 hover:text-[#FFD700] hover:border-[#FFD700]/40 hover:bg-[#0f1930]"
                  : "border-border/60 bg-white text-foreground/40 hover:text-[#9a7200] hover:border-[#b8860b]/40 hover:bg-white"
            }`}
            data-testid="button-send-to-scratchpad"
          >
            <span style={{ fontFamily: "monospace", fontSize: "10px", lineHeight: 1 }}>{"{ }"}</span>
            <span>{scratchpadSent ? "SENT!" : "SEND TO SANDBOX"}</span>
          </button>
          {showScratchpadTooltip && !scratchpadSent && (
            <div
              className={`absolute top-full right-0 mt-1.5 w-52 px-3 py-2 text-xs z-50 border ${
                dark
                  ? "bg-[#0f1930] border-[#2a3552] text-slate-300"
                  : "bg-white border-border text-foreground/80"
              } shadow-lg`}
              style={sansFont}
            >
              Send sample inputs to the Scratchpad sandbox for experimentation
              <div className={`absolute bottom-full right-3 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent ${
                dark ? "border-b-[#2a3552]" : "border-b-border"
              }`} />
            </div>
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className={`relative mb-3 ${expanded ? "flex-1 min-h-0" : ""}`}>
        <div ref={editorRef} className="h-full" />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={handleRunTests}
          disabled={running}
          className={`font-pixel text-xs border-2 px-5 py-2.5 transition-all ${
            running
              ? "opacity-50 cursor-not-allowed border-[#2a3552] bg-[#0f1930] text-slate-500"
              : `${goldBorder} bg-[#FFD700] !text-[#000000] hover:bg-[#FFC800] active:scale-95 cursor-pointer`
          }`}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {pyodideLoading ? "LOADING PYTHON..." : "RUNNING..."}
            </span>
          ) : (
            "RUN TESTS"
          )}
        </button>

        <button
          onClick={handleReset}
          className={`font-pixel text-xs border-2 px-5 py-2.5 transition-all ${
            dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
          }`}
        >
          RESET
        </button>
      </div>

      {/* Test Results */}
      {runError && (
        <div className={`mb-3 px-3 py-2 border ${dark ? "border-red-500/30" : "border-red-300"} ${dark ? "bg-red-500/10" : "bg-red-50"}`} style={sansFont}>
          <pre className={`text-sm whitespace-pre-wrap m-0 ${dark ? "text-red-300" : "text-red-700"}`} style={sansFont}>{runError}</pre>
        </div>
      )}

      {results && (() => {
        const allTestsPassed = results.length > 0 && results.every((r) => r.passed);
        const failed = results.filter((r) => !r.passed);
        return (
          <div className="mb-3" style={sansFont}>
            {allTestsPassed ? (
              <div className={`text-base font-semibold ${greenText}`}>Passed!</div>
            ) : (
              <>
                <div className={`text-sm font-semibold ${textMuted} mb-1`}>
                  {results.filter((r) => r.passed).length}/{results.length} passed
                </div>
                {failed.map((r, i) => (
                  <div key={i} className={`flex items-baseline gap-1.5 text-sm py-0.5`}>
                    <span className="text-red-400 font-bold shrink-0">✗</span>
                    <span className={`${dark ? "text-red-300" : "text-red-700"}`}>
                      {r.name.replace(/^test_/, "").replace(/_/g, " ")}
                    </span>
                    {r.message && (
                      <span className={`text-[13px] px-1.5 py-0.5 rounded ${dark ? "text-red-300/80 bg-red-500/10" : "text-red-600/80 bg-red-100"}`}>
                        {r.message}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Hints — inline tabs */}
      <div className="mb-3" style={sansFont}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "conceptual" as const, label: "Conceptual" },
            { key: "steps" as const, label: "Steps" },
            { key: "code" as const, label: "Answer" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveHint(activeHint === key ? null : key)}
              className={`text-sm border px-3 py-1.5 transition-all cursor-pointer ${
                activeHint === key
                  ? `${goldBorder} ${dark ? "bg-[#FFD700]/15 text-[#FFD700]" : "bg-[#b8860b]/10 text-[#9a7200]"} font-semibold`
                  : `${cardBorder} ${dark ? "text-slate-400 hover:text-[#FFD700] hover:border-[#FFD700]/40" : "text-foreground/50 hover:text-[#9a7200] hover:border-[#b8860b]/40"}`
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeHint && (
          <div className={`mt-1.5 border ${goldBorder} px-3 py-2.5 ${dark ? "bg-[#0b1220]" : "bg-background"} hint-content relative`}>
            <button
              type="button"
              onClick={() => setActiveHint(null)}
              className={`absolute top-1.5 right-2 text-lg leading-none px-1.5 py-0.5 transition-colors cursor-pointer ${
                dark ? "text-slate-500 hover:text-slate-200" : "text-foreground/40 hover:text-foreground"
              }`}
              aria-label="Close hint"
              data-testid="button-close-hint"
            >
              ✕
            </button>
            <style>{`
              .hint-content p { margin: 0 0 0.4em 0; }
              .hint-content p:last-child { margin-bottom: 0; }
              .hint-content ol, .hint-content ul { margin: 0.3em 0; padding-left: 1.4em; }
              .hint-content li { margin-bottom: 0.2em; }
              .hint-content code { font-size: 0.9em; padding: 0.15em 0.35em; border-radius: 3px; background: ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}; }
            `}</style>
            {activeHint === "conceptual" && (
              <div className={`text-lg ${textMuted} leading-relaxed pr-6`}>
                <div dangerouslySetInnerHTML={{ __html: data.hints.conceptual }} />
              </div>
            )}
            {activeHint === "steps" && (
              <div className={`text-lg ${textMuted} leading-relaxed pr-6`}>
                <div dangerouslySetInnerHTML={{ __html: data.hints.steps }} />
              </div>
            )}
            {activeHint === "code" && data.hints.codeBlocks?.length ? (
              <div className={`pr-6 overflow-x-auto`}>
                {data.hints.codeBlocks.map((block, i) => (
                  <div
                    key={i}
                    className="relative"
                    data-testid={`code-block-${i}`}
                    onMouseEnter={() => setHoveredBlock(i)}
                    onMouseLeave={() => setHoveredBlock(null)}
                  >
                    <pre
                      className={`text-sm font-mono whitespace-pre m-0 px-3 py-0 leading-snug cursor-default transition-colors ${
                        dark ? "text-slate-300" : "text-foreground/80"
                      } ${
                        hoveredBlock === i
                          ? (dark ? "bg-[#FFD700]/8" : "bg-[#b8860b]/6")
                          : ""
                      }`}
                    >{block.code}</pre>
                    {hoveredBlock === i && (
                      <div
                        className={`absolute z-50 right-2 top-1 max-w-xs px-4 py-3 text-base font-sans leading-relaxed border ${
                          dark
                            ? "bg-[#1a2332] border-[#FFD700]/30 text-slate-200"
                            : "bg-white border-[#b8860b]/30 text-foreground/80"
                        }`}
                        style={{ boxShadow: dark ? "3px 3px 0 rgba(255,215,0,0.15)" : "3px 3px 0 rgba(0,0,0,0.08)" }}
                      >
                        {block.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : activeHint === "code" ? (
              <div ref={hintCodeRef} className="pr-6" />
            ) : null}
          </div>
        )}
      </div>

      {/* Reward Section */}
      {allPassed && !completedDisplay && (
        <div className="mt-4">
          {/* Auto-pay in progress */}
          {autoPaySending && (
            <div className={`font-pixel text-sm ${goldText}`}>
              SENDING {rewardAmountSats} SATS TO {lightningAddress}...
            </div>
          )}

          {/* Auto-pay succeeded */}
          {autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                {rewardAmountSats} SATS SENT!
              </div>
              <div className={`text-[15px] ${textColor}`}>
                Sent to {lightningAddress}. Keep coding!
              </div>
            </div>
          )}

          {/* Manual claim fallback: no lightning address, not authenticated, or auto-pay failed */}
          {!rewardK1 && !autoPaid && !autoPaySending && !(authenticated && lightningAddress && !claimError) && (
            <>
              <div className={`font-pixel text-sm mb-3 ${greenText}`}>ALL TESTS PASSED!</div>
              {!authenticated ? (
                <button
                  onClick={onLoginRequest}
                  className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95`}
                >
                  LOGIN & CLAIM {rewardAmountSats} SATS
                </button>
              ) : (
                <button
                  onClick={() => handleClaimReward("lnurl")}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                >
                  {claiming ? "GENERATING QR..." : `CLAIM ${rewardAmountSats} SATS`}
                </button>
              )}
            </>
          )}

          {/* Auto-pay failed — show error + manual fallback buttons */}
          {claimError && authenticated && lightningAddress && !rewardK1 && !autoPaid && (
            <div className="mt-2">
              <div className="font-pixel text-xs text-red-400 mb-3">{claimError}</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setClaimError(null); handleClaimReward("address"); }}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                >
                  {claiming ? "RETRYING..." : `RETRY SEND TO ${lightningAddress.toUpperCase()}`}
                </button>
                <button
                  onClick={() => handleClaimReward("lnurl")}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} bg-transparent hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                  style={{ color: dark ? "#FFD700" : "#b8860b" }}
                >
                  LNURL WITHDRAWAL
                </button>
              </div>
            </div>
          )}

          {/* Non-address claim error */}
          {claimError && !(authenticated && lightningAddress) && (
            <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
          )}

          {rewardLnurl && !autoPaySending && withdrawalStatus === "pending" && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-sm mb-3 ${goldText}`}>
                SCAN TO CLAIM {rewardAmountSats} SATS
              </div>
              <div className={`inline-block border-4 ${dark ? "border-[#2a3552]" : "border-border"} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
                <QRCodeSVG value={rewardLnurl} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className={`mt-3 font-mono text-sm ${countdown <= 60 ? "text-red-400" : textMuted}`}>
                Expires in {formatCountdown(countdown)}
              </div>
            </div>
          )}

          {withdrawalStatus === "expired" && (
            <div>
              <div className="font-pixel text-sm mb-2 text-red-400">QR EXPIRED</div>
              <button
                onClick={() => { setRewardK1(null); setRewardLnurl(null); setWithdrawalStatus("pending"); handleClaimReward("lnurl"); }}
                className={`font-pixel text-sm border-2 px-4 py-2 ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800]`}
              >
                GENERATE NEW QR
              </button>
            </div>
          )}
        </div>
      )}

      {/* Already completed */}
      {completedDisplay && (
        <div className={`mt-5 ${expanded ? "" : "-mx-5 -mb-5"}`}>
          <div className={`px-5 py-4 border-t-2 text-[17px] md:text-[19px] font-semibold text-black ${dark ? "bg-[#FFD700]/30 border-[#FFD700]/40" : "bg-[#b8860b]/20 border-[#b8860b]/30"}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            {claimInfo && claimInfo.amountSats > 0 ? (
              <>{claimInfo.amountSats} Sats Claimed on {new Date(claimInfo.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(claimInfo.paidAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
            ) : autoPaid ? (
              <>{rewardAmountSats} Sats Sent</>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span>Exercise Completed</span>
                {authenticated && !showClaimChoice && !claiming && !rewardK1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowClaimChoice(true); }}
                    className="font-pixel text-sm border-2 px-4 py-2 border-black bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95"
                  >
                    CLAIM {rewardAmountSats} SATS
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Claim choice UI for completed-but-unclaimed exercises */}
          {showClaimChoice && !claiming && !autoPaid && !rewardLnurl && (
            <div className={`px-5 py-4 ${dark ? "bg-[#0b1220]" : "bg-background"}`}>
              <div className={`font-pixel text-xs mb-4 ${goldText}`}>HOW WOULD YOU LIKE TO RECEIVE?</div>
              <div className="flex flex-col sm:flex-row gap-3">
                {lightningAddress ? (
                  <button
                    type="button"
                    onClick={() => handleClaimReward("address")}
                    className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} bg-[#FFD700] hover:bg-[#FFC800] active:scale-95 flex-1`}
                    style={{ color: "#000" }}
                  >
                    LIGHTNING ADDRESS
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`flex-1 border-2 px-5 py-3 cursor-pointer hover:opacity-70 transition-opacity ${dark ? "border-[#2a3552]" : "border-border"} opacity-60 bg-transparent`}
                  >
                    <div className="font-pixel text-sm text-center mb-1" style={{ color: dark ? "#94a3b8" : undefined }}>LIGHTNING ADDRESS</div>
                    <div className={`text-sm text-center font-bold ${textMuted}`}>Set address in profile first</div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleClaimReward("lnurl")}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} hover:bg-[#FFC800] active:scale-95 flex-1 bg-transparent`}
                  style={{ color: dark ? "#FFD700" : "#b8860b" }}
                >
                  LNURL WITHDRAWAL
                </button>
              </div>
              {claimError && (
                <div className="mt-3 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}
          {claiming && (
            <div className={`px-5 py-4 font-pixel text-sm ${goldText}`}>
              {autoPaySending ? `SENDING ${rewardAmountSats} SATS...` : "GENERATING QR..."}
            </div>
          )}
          {rewardLnurl && !autoPaySending && withdrawalStatus !== "paid" && (
            <div className="px-5 py-4 text-center">
              {withdrawalStatus === "expired" ? (
                <div>
                  <div className="font-pixel text-sm mb-2 text-red-400">QR EXPIRED</div>
                  <button
                    onClick={() => { setRewardK1(null); setRewardLnurl(null); setWithdrawalStatus("pending"); handleClaimReward("lnurl"); }}
                    className={`font-pixel text-sm border-2 px-4 py-2 ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800]`}
                  >
                    GENERATE NEW QR
                  </button>
                </div>
              ) : (
                <div>
                  <div className={`font-pixel text-sm mb-3 ${goldText}`}>
                    SCAN TO CLAIM {rewardAmountSats} SATS
                  </div>
                  <div className={`inline-block border-4 ${dark ? "border-[#2a3552]" : "border-border"} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
                    <QRCodeSVG value={rewardLnurl} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <div className={`mt-3 font-mono text-sm ${countdown <= 60 ? "text-red-400" : textMuted}`}>
                    Expires in {formatCountdown(countdown)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const fileBrowserModal = fileBrowserOpen ? (
    <ExerciseFileBrowser
      currentExerciseId={exerciseId}
      theme={theme}
      onClose={() => setFileBrowserOpen(false)}
    />
  ) : null;

  if (expanded) {
    return (
      <>
        <div className={`my-4 border-2 ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-5`}>
          <div className={`text-sm ${textMuted} text-center py-4`} style={sansFont}>
            Exercise is open in expanded view.{" "}
            <button onClick={() => setExpanded(false)} className={`${goldText} underline cursor-pointer`}>Close expanded view</button>
          </div>
        </div>
        <div className="fixed inset-0 z-[9999] flex items-start justify-center" onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className={`absolute inset-0 ${dark ? "bg-black/80" : "bg-black/50"} backdrop-blur-sm`} />
          <div className={`relative w-full max-w-6xl mx-4 my-4 h-[calc(100vh-32px)] overflow-y-auto border-2 flex flex-col ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-6`}>
            <button
              onClick={() => setExpanded(false)}
              className={`absolute top-3 right-3 font-pixel text-xs border-2 px-3 py-1.5 transition-all z-10 ${
                dark
                  ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                  : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
              }`}
              data-testid="button-close-expanded"
            >
              ✕ CLOSE
            </button>
            <div className={`font-pixel text-sm ${goldText} mb-4`}>
              {data.title.toUpperCase()}
            </div>
            {exerciseContent}
          </div>
        </div>
        {fileBrowserModal}
      </>
    );
  }

  return (
    <>
      {exerciseContent}
      {fileBrowserModal}
    </>
  );
}
