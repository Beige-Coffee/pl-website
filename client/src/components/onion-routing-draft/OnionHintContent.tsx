import { Fragment, type ReactNode } from "react";
import { highlightPython } from "../../lib/pythonHighlight";

// ────────────────────────────────────────────────────────────────────────────
// OnionHintContent
//
// Renders the onion-routing course's Conceptual / Steps hint HTML with real
// Python syntax coloring instead of flat grey pills. Short code references stay
// inline; longer "actionable" code (assignments, control-flow, multi-line, or
// anything long) drops onto its own line as a code card so each step reads as
// "description, then the code underneath."
//
// Used only for tutorialType === "onion-routing". Other courses keep their
// existing dangerouslySetInnerHTML rendering untouched. The hint vocabulary in
// the onion data is limited and flat (strong/b/em/i/sub/code/br, no nested tags
// inside <code>, no entities inside <code>), which is what this small parser
// assumes.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ") // keep as a non-breaking space (sub-step indentation)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Decide whether a code snippet is substantial enough to live on its own line.
// Block: multi-line, OR a statement (assignment / control-flow) of some length,
// OR anything long. Inline: short identifiers, expressions, constants, strings.
function isBlockCode(raw: string): boolean {
  const c = raw.trim();
  if (c.includes("\n")) return true;
  const noStrings = c.replace(/(['"]).*?\1/g, "");
  const hasAssignment = /(^|[^=!<>+\-*/%&|^:])=(?!=)/.test(noStrings);
  const startsWithStmt =
    /^(for|if|elif|else|while|def|class|return|raise|with|try|except|finally|import|from|assert)\b/.test(c);
  // Bare equality/inequality expressions (e.g. "a + b == len(x)") are references
  // used mid-sentence, not lines to type. Keep them inline regardless of length.
  if (!hasAssignment && !startsWithStmt && /[=!]=/.test(noStrings)) return false;
  if (c.length >= 40) return true;
  return (hasAssignment || startsWithStmt) && c.length >= 16;
}

// When a code snippet is pulled onto its own line, the sentence punctuation that
// hugged it inline (a trailing ")", ".", "," etc.) becomes visually orphaned.
// Strip only that trailing punctuation, but PRESERVE any separating whitespace so
// the following word doesn't glue onto the card. Inline snippets are left alone.
function tidyAroundBlocks(segment: string): string {
  return segment.replace(
    /<code>([\s\S]*?)<\/code>(\s*[).,:;]+)/gi,
    (full, inner: string, post: string) => {
      if (!isBlockCode(decodeEntities(inner))) return full;
      return `<code>${inner}</code>${post.replace(/[).,:;]+/g, "")}`;
    },
  );
}

const INLINE_TAG = /<(strong|b|em|i|sub|code)>/i;

function parseInline(s: string, dark: boolean, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = s;
  let k = 0;
  while (rest.length) {
    const m = rest.match(INLINE_TAG);
    if (!m || m.index === undefined) {
      out.push(<Fragment key={`${keyBase}-t${k++}`}>{decodeEntities(rest)}</Fragment>);
      break;
    }
    if (m.index > 0) {
      out.push(<Fragment key={`${keyBase}-t${k++}`}>{decodeEntities(rest.slice(0, m.index))}</Fragment>);
    }
    const tag = m[1].toLowerCase();
    const closeTag = `</${tag}>`;
    const closeIdx = rest.toLowerCase().indexOf(closeTag, m.index + m[0].length);
    if (closeIdx < 0) {
      // Unmatched opening tag: drop the stray tag and keep parsing the remainder
      // (graceful degradation instead of dumping raw markup as visible text).
      rest = rest.slice(m.index + m[0].length);
      continue;
    }
    const inner = rest.slice(m.index + m[0].length, closeIdx);
    const key = `${keyBase}-x${k++}`;
    if (tag === "code") {
      const code = decodeEntities(inner);
      // Rendered as <span>, not <code>: the course wraps tutorial prose in
      // ".noise-md", whose layered "code { font-family: inherit !important }"
      // rule would force these back to the prose font. <span> sidesteps it so
      // our monospace + syntax colors actually take effect.
      out.push(
        isBlockCode(code) ? (
          <span key={key} className="onion-hint-code-block">
            {highlightPython(code.trim(), dark)}
          </span>
        ) : (
          <span key={key} className="onion-hint-code-inline">
            {highlightPython(code, dark)}
          </span>
        ),
      );
    } else if (tag === "strong" || tag === "b") {
      out.push(<strong key={key}>{parseInline(inner, dark, key)}</strong>);
    } else if (tag === "em" || tag === "i") {
      out.push(<em key={key}>{parseInline(inner, dark, key)}</em>);
    } else if (tag === "sub") {
      out.push(<sub key={key}>{parseInline(inner, dark, key)}</sub>);
    }
    rest = rest.slice(closeIdx + closeTag.length);
  }
  return out;
}

export function OnionHintContent({ html, dark }: { html: string; dark: boolean }) {
  const segments = html
    .split(/<br\s*\/?>/i)
    .map((s) => tidyAroundBlocks(s.trim()))
    .filter((s) => s.length > 0);

  const inlineBg = dark ? "rgba(255,255,255,0.07)" : "rgba(13,21,38,0.06)";
  const inlineBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(13,21,38,0.12)";
  const blockBg = dark ? "#0d1526" : "#eef1f7";
  const blockBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(13,21,38,0.16)";
  const accent = dark ? "#FFD700" : "#b8860b";

  return (
    <>
      <style>{`
        .onion-hint-line { margin: 0 0 0.25em 0; line-height: 1.5; }
        .onion-hint-line:last-child { margin-bottom: 0; }
        .hint-content .onion-hint-code-inline {
          font-family: ${MONO};
          font-size: 0.86em;
          padding: 0.06em 0.34em;
          border-radius: 4px;
          background: ${inlineBg};
          border: 1px solid ${inlineBorder};
          white-space: pre-wrap;
          word-break: break-word;
        }
        .hint-content .onion-hint-code-block {
          display: block;
          font-family: ${MONO};
          font-size: 0.9em;
          line-height: 1.45;
          /* Indent block-code cards so they read as nested under the step that
             introduces them. Applies uniformly to every onion hint (Conceptual
             + Steps) via this single shared rule. */
          margin: 0.15em 0 0.25em 1.4em;
          padding: 0.35em 0.7em 0.35em 0.6em;
          border-radius: 6px;
          background: ${blockBg};
          border: 1px solid ${blockBorder};
          border-left: 3px solid ${accent};
          white-space: pre-wrap;
          word-break: break-word;
          overflow-x: auto;
        }
      `}</style>
      {segments.map((seg, i) => (
        <div key={i} className="onion-hint-line">
          {parseInline(seg, dark, `s${i}`)}
        </div>
      ))}
    </>
  );
}

export default OnionHintContent;
