import { useEffect, useRef } from "react";

// The course wraps tutorial content in `.noise-md-dark`, whose layered
// `span/strong/em/p/li/td { color: <grey> !important }` rule repaints text grey
// for dark prose. Inside the light-island visuals that makes their card values
// illegible (grey on cream) in dark mode. Re-anchor a visual's text so it
// survives the cascade:
//   - the root defaults to dark ink (the light-island text color),
//   - every descendant keeps its OWN inline color, re-asserted with !important so
//     it beats the layered rule (preserving character colors), and
//   - descendants with no inline color inherit (so they pick up the ink default
//     or a colored ancestor, instead of the grey prose color).
// See docs/standards/onion-visual-standards.md §8 and the .noise-md-dark cascade note.
export function forceReadable(root: HTMLElement | null) {
  if (!root) return;
  root.style.setProperty("color", "#0f172a", "important");
  root.querySelectorAll<HTMLElement>("span, strong, em, p, li, td").forEach((el) => {
    const inline = el.style.color;
    el.style.setProperty("color", inline || "inherit", "important");
  });
}

// Attach the returned ref to a visual's root element. Runs after every render, so
// it also covers interactive re-renders.
export function useReadableInDark<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    forceReadable(ref.current);
  });
  return ref;
}
