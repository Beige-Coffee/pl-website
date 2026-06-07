// ────────────────────────────────────────────────────────────────────────────
// StepCaption
//
// The canonical per-step explanation block for onion-routing step visuals.
// Renders BELOW the main visual content (inside the stage, above the footer
// controls) as a single bordered card: a color-matched left edge plus a header
// (step/iteration label, title, optional color-matched chip) and a body that
// carries the prose explanation.
//
// This consolidates what used to be split three ways across the course (a thin
// above-visual banner, a footer caption to the right of the step chips, or an
// above-visual "STEP N OF M" box). The footer now holds ONLY controls. See
// onion-routing-visual-standards §1.5 (the description-block rule). Don't
// reinvent this block per visual.
// ────────────────────────────────────────────────────────────────────────────

import { type ReactNode } from "react";
import { renderCaption } from "./captionMarkup";

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";

export function StepCaption({
  label,
  title,
  caption,
  accentColor,
  chip,
  className = "",
}: {
  /** Short step/iteration label, e.g. "STEP 2 OF 5" or "BOB PEELS · DERIVE". MONO, slate, uppercased. */
  label: ReactNode;
  /** Optional bold title in the accent color. A string runs through renderCaption; nodes render as-is. */
  title?: ReactNode;
  /** Prose explanation. A string runs through renderCaption; nodes render as-is. */
  caption: ReactNode;
  /** The active step's accent color (hop / key / phase). Drives the left edge, title, and header tint. */
  accentColor: string;
  /** Optional color-matched chip (e.g. a key Tok) shown at the right of the header. */
  chip?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-[1.5px] mt-4 ${className}`}
      style={{
        background: "#fffdf5",
        borderColor: "rgba(15,23,42,0.25)",
        borderLeft: `3px solid ${accentColor}`,
        transition: "border-color 400ms ease-out",
      }}
      data-testid="step-caption"
    >
      <div
        className="px-3 py-1.5 border-b-[1.5px] flex items-center gap-3 flex-wrap"
        style={{
          borderColor: "rgba(15,23,42,0.15)",
          background: `${accentColor}14`,
          transition: "background 400ms ease-out",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.08em] font-bold"
          style={{ fontFamily: MONO, color: "#475569" }}
        >
          {label}
        </span>
        {title != null && (
          <span
            className="text-sm font-bold flex-1"
            style={{ color: accentColor, transition: "color 400ms ease-out" }}
          >
            {typeof title === "string" ? renderCaption(title) : title}
          </span>
        )}
        {chip != null && <span className="shrink-0">{chip}</span>}
      </div>
      <div
        className="px-3 py-2.5"
        style={{
          fontFamily: SANS,
          fontSize: 12.5,
          lineHeight: 1.7,
          color: "#0f172a",
          minHeight: 56,
        }}
      >
        {typeof caption === "string" ? renderCaption(caption) : caption}
      </div>
    </div>
  );
}
