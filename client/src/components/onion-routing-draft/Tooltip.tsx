import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// ────────────────────────────────────────────────────────────────────────────
// Tooltip (DRAFT)
//
// Lightweight hover tooltip that matches the locked Onion Routing visual
// format: cream body (#fffdf5), 1.5px ink border, soft shadow, sans-serif at
// 11px. Shows immediately on hover, hides on mouse-out, no native HTML
// `title` delay, no question-mark cursor.
//
// Wraps its child via a `display: contents` span so it doesn't perturb the
// surrounding layout. The popover is rendered with `position: fixed` so it
// can escape any `overflow: hidden` ancestors.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";

export interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Fixed pixel width for the popover. Default 280. */
  width?: number;
}

export function Tooltip({ label, children, width = 280 }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number; flipped: boolean } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  function show() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const target = (wrap.firstElementChild as HTMLElement | null) ?? wrap;
    const rect = target.getBoundingClientRect();
    const halfW = width / 2;
    let x = rect.left + rect.width / 2;
    if (x - halfW < 8) x = halfW + 8;
    if (x + halfW > window.innerWidth - 8) x = window.innerWidth - halfW - 8;
    // Flip below if there isn't ~100px of headroom above.
    const flipped = rect.top < 110;
    const y = flipped ? rect.bottom + 8 : rect.top - 8;
    setPos({ x, y, flipped });
  }

  function hide() {
    setPos(null);
  }

  return (
    <>
      <span
        ref={wrapRef}
        style={{ display: "contents" }}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 border-[1.5px] text-[11px] leading-relaxed pointer-events-none"
            style={{
              left: pos.x,
              top: pos.y,
              transform: pos.flipped
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
              width,
              background: "#fffdf5",
              borderColor: INK,
              color: INK,
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Tooltip;
