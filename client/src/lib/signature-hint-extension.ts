/**
 * CodeMirror extension for auto-showing function signature hints.
 *
 * When the user types `(` after a function name, a tooltip appears above
 * showing the function's parameter signature and a one-line description.
 * Dismisses when the cursor moves before the `(`, past the matching `)`,
 * or on Escape.
 *
 * Uses EditorView.updateListener with explicit loop prevention.
 * Dispatching from updateListener is supported by CM6:
 * "It is possible to dispatch new transactions from an update listener."
 */

import {
  StateField,
  StateEffect,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  showTooltip,
  keymap,
  type Tooltip,
} from "@codemirror/view";
import { lookupSignature, isPythonKeyword, type SignatureInfo } from "./signature-hints";
import { getPythonSignature } from "./pyodide-runner";

// ─── State ────────────────────────────────────────────────────────────────────

interface HintState {
  tooltip: Tooltip | null;
  parenPos: number; // Position of the `(` character in the current doc
  funcName: string;
}

const EMPTY_STATE: HintState = { tooltip: null, parenPos: -1, funcName: "" };

const setHint = StateEffect.define<HintState>();
const clearHint = StateEffect.define<void>();

const hintField = StateField.define<HintState>({
  create: () => EMPTY_STATE,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setHint)) return e.value;
      if (e.is(clearHint)) return EMPTY_STATE;
    }
    // If doc changed, map the paren position so it tracks correctly
    if (tr.docChanged && value.tooltip) {
      const newParenPos = tr.changes.mapPos(value.parenPos, 1);
      return {
        ...value,
        parenPos: newParenPos,
        tooltip: { ...value.tooltip, pos: newParenPos },
      };
    }
    return value;
  },
  provide: (f) => showTooltip.from(f, (val) => val.tooltip),
});

// ─── Tooltip DOM ──────────────────────────────────────────────────────────────

function createTooltipDOM(info: SignatureInfo): Tooltip["create"] {
  return () => {
    const dom = document.createElement("div");
    dom.className = "cm-sig-hint";

    // Signature line: functionName(param1, param2, ...)
    const sigLine = document.createElement("div");
    sigLine.className = "cm-sig-hint-sig";

    const nameSpan = document.createElement("span");
    nameSpan.className = "cm-sig-hint-name";
    nameSpan.textContent = info.name;

    const paramsSpan = document.createElement("span");
    paramsSpan.className = "cm-sig-hint-params";
    paramsSpan.textContent = info.params;

    sigLine.appendChild(nameSpan);
    sigLine.appendChild(paramsSpan);
    dom.appendChild(sigLine);

    // One-line description
    if (info.description) {
      const descLine = document.createElement("div");
      descLine.className = "cm-sig-hint-desc";
      descLine.textContent = info.description;
      dom.appendChild(descLine);
    }

    // Per-parameter details
    if (info.paramDetails && info.paramDetails.length > 0) {
      const paramsDiv = document.createElement("div");
      paramsDiv.className = "cm-sig-hint-params-list";

      for (const p of info.paramDetails) {
        const row = document.createElement("div");
        row.className = "cm-sig-hint-param-row";

        const pName = document.createElement("span");
        pName.className = "cm-sig-hint-param-name";
        pName.textContent = p.name;

        const pDesc = document.createElement("span");
        pDesc.className = "cm-sig-hint-param-desc";
        pDesc.textContent = " \u2014 " + p.description;

        row.appendChild(pName);
        row.appendChild(pDesc);
        paramsDiv.appendChild(row);
      }

      dom.appendChild(paramsDiv);
    }

    return { dom, offset: { x: 0, y: -4 } };
  };
}

// ─── Extract Function Name ────────────────────────────────────────────────────

const FUNC_NAME_RE = /([\w.]+)\s*$/;

function extractFuncName(text: string): string | null {
  const m = text.match(FUNC_NAME_RE);
  if (!m) return null;
  const name = m[1];
  if (isPythonKeyword(name)) return null;
  if (name.endsWith(".")) return null;
  return name;
}

// ─── Scan Backward for Unclosed `(` ───────────────────────────────────────────

/**
 * Scan backward from the cursor to find the nearest unclosed `(`.
 * Returns the offset within `text` of the `(`, or -1 if not found.
 */
function findUnclosedParen(text: string): number {
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === ")") depth++;
    else if (text[i] === "(") {
      if (depth === 0) return i; // unclosed!
      depth--;
    }
  }
  return -1;
}

// ─── Update Listener ──────────────────────────────────────────────────────────
//
// On every update (doc change, selection change), scan backward from the cursor
// to find if it sits inside a function call `func(...)`. If so, show the hint.
// If not, dismiss it. This makes the hint persistent while typing args.

const SCAN_LIMIT = 500; // chars before cursor to scan

const sigHintListener = EditorView.updateListener.of((update) => {
  // ── Loop guard: skip updates caused by our own effects ────────────
  for (const tr of update.transactions) {
    for (const e of tr.effects) {
      if (e.is(setHint) || e.is(clearHint)) return;
    }
  }

  // Only re-evaluate when something changed
  if (!update.docChanged && !update.selectionSet) return;

  const view = update.view;
  const state = update.state;
  const hint = state.field(hintField);
  const cursorPos = state.selection.main.head;

  // ── Scan backward from cursor for an unclosed `(` ─────────────────
  const scanStart = Math.max(0, cursorPos - SCAN_LIMIT);
  const textBeforeCursor = state.doc.sliceString(scanStart, cursorPos);
  const parenOffset = findUnclosedParen(textBeforeCursor);

  if (parenOffset >= 0) {
    const absParenPos = scanStart + parenOffset;
    // Extract the function name from text before the `(`
    const textBeforeParen = textBeforeCursor.slice(0, parenOffset);
    const funcName = extractFuncName(textBeforeParen);

    if (funcName) {
      // Already showing the same hint — do nothing
      if (hint.tooltip && hint.funcName === funcName && hint.parenPos === absParenPos) {
        return;
      }

      // Try static registry (synchronous)
      const info = lookupSignature(funcName);
      if (info) {
        view.dispatch({
          effects: setHint.of({
            tooltip: {
              pos: absParenPos,
              above: true,
              create: createTooltipDOM(info),
            },
            parenPos: absParenPos,
            funcName,
          }),
        });
        return;
      }

      // Fall back to Pyodide introspection (async)
      getPythonSignature(funcName).then((pyInfo) => {
        if (!pyInfo) return;
        const current = view.state.field(hintField);
        // Don't overwrite a hint that's already showing
        if (current.tooltip) return;
        const cursor = view.state.selection.main.head;
        if (cursor <= absParenPos) return;
        view.dispatch({
          effects: setHint.of({
            tooltip: {
              pos: absParenPos,
              above: true,
              create: createTooltipDOM(pyInfo),
            },
            parenPos: absParenPos,
            funcName,
          }),
        });
      });
      return;
    }
  }

  // ── Not inside a known function call — dismiss if hint is showing ──
  if (hint.tooltip) {
    view.dispatch({ effects: clearHint.of(undefined) });
  }
});

// ─── Keymap: Escape to Dismiss ────────────────────────────────────────────────

const hintKeymap = keymap.of([
  {
    key: "Escape",
    run: (view) => {
      const state = view.state.field(hintField);
      if (state.tooltip) {
        view.dispatch({ effects: clearHint.of(undefined) });
        return true;
      }
      return false;
    },
  },
]);

// ─── Theme ────────────────────────────────────────────────────────────────────

const hintTheme = EditorView.baseTheme({
  ".cm-sig-hint": {
    padding: "6px 10px",
    borderRadius: "4px",
    fontSize: "13px",
    lineHeight: "1.4",
    maxWidth: "560px",
    zIndex: "200",
    border: "1px solid #3a3a5c",
    backgroundColor: "#1e1e2e",
    color: "#d4d4d4",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
  },
  ".cm-sig-hint-sig": {
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ".cm-sig-hint-name": {
    color: "#dcdcaa",
    fontWeight: "600",
  },
  ".cm-sig-hint-params": {
    color: "#9cdcfe",
  },
  ".cm-sig-hint-desc": {
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontStyle: "italic",
    fontSize: "12px",
    color: "#888",
    marginTop: "3px",
  },
  ".cm-sig-hint-params-list": {
    marginTop: "4px",
    paddingTop: "4px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: "12px",
    lineHeight: "1.5",
  },
  ".cm-sig-hint-param-row": {
    padding: "1px 0",
  },
  ".cm-sig-hint-param-name": {
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#9cdcfe",
    fontSize: "12px",
  },
  ".cm-sig-hint-param-desc": {
    color: "#999",
  },
  // Light theme overrides
  "&light .cm-sig-hint": {
    backgroundColor: "#ffffff",
    border: "1px solid #d4c9a8",
    color: "#333",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  },
  "&light .cm-sig-hint-name": {
    color: "#795e26",
  },
  "&light .cm-sig-hint-params": {
    color: "#0451a5",
  },
  "&light .cm-sig-hint-desc": {
    color: "#666",
  },
  "&light .cm-sig-hint-params-list": {
    borderTop: "1px solid rgba(0,0,0,0.1)",
  },
  "&light .cm-sig-hint-param-name": {
    color: "#0451a5",
  },
  "&light .cm-sig-hint-param-desc": {
    color: "#666",
  },
});

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * CodeMirror extension that shows function signature hints when `(` is typed.
 * Add to the extensions array after `autocompletion()`.
 */
export function signatureHints(): Extension {
  return [hintField, sigHintListener, hintKeymap, hintTheme];
}
