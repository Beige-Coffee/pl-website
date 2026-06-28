import { type ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// SpecFormula
//
// Compact card for quoting pseudocode or formulas from external specs (BOLT
// 4, Sphinx paper, etc.). Visually distinct from the PythonSnippet
// component on purpose: white background, italic serif font, small
// floating source tag in the top-right corner. The pair reads as
// "spec form (this card) → implementation form (PythonSnippet card)".
//
// Markdown tag:
//   <spec-formula source="BOLT 4">generate_key(name, secret) = …</spec-formula>
//
// Per the user-locked Python Snippet Rule, code snippets that the reader
// will run go through PythonSnippet (real Python, monospace, syntax
// highlighted). SpecFormula is for *external-source quotations*, not
// runnable code.
// ────────────────────────────────────────────────────────────────────────────

const SERIF =
  '"Iowan Old Style", Georgia, "Times New Roman", "Times", serif';
const SANS = "ui-sans-serif, system-ui, sans-serif";

export function SpecFormula({
  source = "Spec",
  children,
}: {
  source?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="my-6 mx-auto"
      data-testid="spec-formula"
      style={{
        position: "relative",
        background: "#ffffff",
        border: "1.5px solid #94a3b8",
        padding: "18px 36px",
        maxWidth: "fit-content",
        fontFamily: SERIF,
        fontStyle: "italic",
        fontSize: 20,
        color: "#0f172a",
        textAlign: "center",
        lineHeight: 1.55,
      }}
    >
      {/* Floating source tag: rides the top-right corner on the border, with
          a small notch of background behind it so it looks cut into the line. */}
      <div
        style={{
          position: "absolute",
          top: -9,
          right: 16,
          fontFamily: SANS,
          fontStyle: "normal",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#475569",
          background: "#ffffff",
          padding: "0 8px",
          lineHeight: 1,
          height: 16,
          display: "flex",
          alignItems: "center",
        }}
      >
        {source}
      </div>
      {children}
    </div>
  );
}

export default SpecFormula;
