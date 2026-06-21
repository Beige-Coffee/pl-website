/**
 * CodeMirror extension: hover a function name to see its signature + param docs.
 *
 * This is HOVER-ONLY by design. It shows the tooltip while the mouse is directly
 * over a known function name, and hides as soon as the pointer moves away. It is
 * deliberately NOT tied to the cursor/selection: an earlier version showed the
 * hint whenever the caret sat inside a call's parens, which felt like it "stayed
 * up" whenever you were editing near the code.
 */

import { type Extension } from "@codemirror/state";
import {
  EditorView,
  hoverTooltip,
  type Tooltip,
} from "@codemirror/view";
import { lookupSignature, isPythonKeyword, type SignatureInfo } from "./signature-hints";

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
        pDesc.textContent = ": " + p.description;

        row.appendChild(pName);
        row.appendChild(pDesc);
        paramsDiv.appendChild(row);
      }

      dom.appendChild(paramsDiv);
    }

    return { dom };
  };
}

// ─── Hover tooltip ────────────────────────────────────────────────────────────
//
// On hover, find the identifier under the pointer. If it's a known function,
// anchor the signature tooltip to that word. CodeMirror's hoverTooltip handles
// the show-on-hover / hide-on-leave lifecycle for us.

const WORD_CHAR = /[A-Za-z0-9_]/;

const sigHover = hoverTooltip(
  (view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    const rel = pos - line.from;

    // Expand to the full identifier under the pointer.
    let start = rel;
    let end = rel;
    while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
    while (end < text.length && WORD_CHAR.test(text[end])) end++;
    if (start === end) return null; // pointer is not over a word

    const word = text.slice(start, end);
    if (isPythonKeyword(word)) return null;

    const info = lookupSignature(word);
    if (!info) return null;

    return {
      pos: line.from + start,
      end: line.from + end,
      above: true,
      create: createTooltipDOM(info),
    };
  },
  { hoverTime: 300 },
);

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
 * CodeMirror extension that shows a function's signature + parameter docs when
 * you HOVER over its name. Add it to the extensions array after autocompletion().
 */
export function signatureHints(): Extension {
  return [sigHover, hintTheme];
}
