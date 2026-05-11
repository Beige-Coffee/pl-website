import { Fragment, type ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Caption markup renderer
//
// Lightweight markdown for caption strings inside onion-routing visuals.
// Supports two inline tokens:
//   • `code`     →  monospace pill (JetBrains Mono on cream w/ thin border)
//   • *italic*   →  <em> (visually italic, or upright if the caption is
//                   already italic-styled — both read as "emphasized")
//
// Use this in any visual that renders captions/descriptions to text. Keeps
// caption authoring as plain strings while letting protocol identifiers
// (`rho`, `invalid_onion_hmac`, etc.) and emphasis tokens render correctly.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const INK = "#0f172a";

const CODE_STYLE = {
  fontFamily: MONO,
  background: "#f1f5f9",
  border: "1px solid rgba(15,23,42,0.14)",
  padding: "0px 5px",
  fontSize: "0.92em",
  color: INK,
  whiteSpace: "nowrap" as const,
};

export function renderCaption(text: string): ReactNode {
  // Split on either `code` or *italic*. The capture groups keep the tokens
  // in the resulting array so we can dispatch on prefix character.
  const parts = text.split(/(`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (
      part.length >= 2 &&
      part.startsWith("`") &&
      part.endsWith("`")
    ) {
      return (
        <code key={i} style={CODE_STYLE}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (
      part.length >= 2 &&
      part.startsWith("*") &&
      part.endsWith("*")
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
