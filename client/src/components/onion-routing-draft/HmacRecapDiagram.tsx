import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────────
// HmacRecapDiagram (DRAFT)
//
// Block-diagram recap of HMAC-SHA256 as it's used in BOLT 4: derive a per-hop
// key by calling HMAC-SHA256(key=name, msg=shared_secret) for each of five
// ASCII names ("rho", "mu", "um", "pad", "ammag"). Same shared secret in,
// five independent 32-byte keys out.
//
// This component shows the operation only — the next visual
// (FiveKeysJobsDiagram) shows what each of the five outputs is used for.
//
// Visual style follows the pinned onion-routing format:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body, gold accents, 1.5px borders.
//   - Body sans-serif, monospace for protocol values + hex.
// ────────────────────────────────────────────────────────────────────────────

type KeyName = "rho" | "mu" | "um" | "pad" | "ammag";

interface KeyEntry {
  name: KeyName;
  color: string;
  hex: string;
}

const KEYS: KeyEntry[] = [
  { name: "rho",   color: "#b8860b", hex: "8f a3 7c d1  4e 09 b2 6a  …  2f c4 12 a7" },
  { name: "mu",    color: "#3b6aa0", hex: "21 e0 9b 4d  77 c1 38 5f  …  a4 0b 6e 92" },
  { name: "um",    color: "#2d7a7a", hex: "5c 18 d3 b7  09 4a 6c f2  …  e1 73 28 bd" },
  { name: "pad",   color: "#7b4b8a", hex: "a9 4f 02 ce  6b 88 11 7d  …  35 9c d8 47" },
  { name: "ammag", color: "#5a7a2f", hex: "13 b6 6d 8a  c4 27 fe 50  …  72 ee 19 03" },
];

const BEAT_MS = 1500;

export function HmacRecapDiagram() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setTimeout(() => {
      setIdx((i) => (i + 1) % KEYS.length);
    }, BEAT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, idx]);

  function toggle() {
    setPlaying((p) => !p);
  }

  const active = KEYS[idx];

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="hmac-recap"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            HMAC-SHA256 in one picture
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-8"
        style={{ minHeight: 280 }}
      >
        <div className="overflow-x-auto">
          <div
            className="relative mx-auto"
            style={{ minWidth: 720, maxWidth: 820, height: 200 }}
          >
            {/* LEFT — stacked input pills */}
            <div
              className="absolute flex flex-col gap-3"
              style={{ left: 0, top: 20, width: 200 }}
            >
              {/* key pill */}
              <div
                className="border-[1.5px] bg-[#fffdf5] px-3 py-2"
                style={{
                  borderColor: active.color,
                  transition: "border-color 400ms ease-out",
                }}
              >
                <div className="text-[9px] uppercase tracking-[0.12em] opacity-60 mb-1">
                  key
                </div>
                <div
                  className="text-base font-bold"
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    color: active.color,
                    transition: "color 400ms ease-out",
                  }}
                  key={active.name}
                >
                  "{active.name}"
                </div>
              </div>

              {/* msg pill */}
              <div className="border-[1.5px] border-[#0f172a] bg-[#fffdf5] px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.12em] opacity-60 mb-1">
                  msg
                </div>
                <div
                  className="text-base font-bold"
                  style={{
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    color: "#0f172a",
                  }}
                >
                  ss_i
                </div>
                <div className="text-[10px] opacity-60 mt-0.5 italic">
                  the per-hop shared secret
                </div>
              </div>
            </div>

            {/* ARROWS — left inputs converging into the box */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 200, top: 20, width: 140, height: 160 }}
              viewBox="0 0 140 160"
            >
              {/* arrow from key pill (top) into box (mid-top) */}
              <line
                x1="0"
                y1="30"
                x2="128"
                y2="60"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* arrow from msg pill (bottom) into box (mid-bottom) */}
              <line
                x1="0"
                y1="120"
                x2="128"
                y2="100"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              {/* arrowheads */}
              <polygon points="128,60 122,57 122,63" fill="#0f172a" />
              <polygon points="128,100 122,97 122,103" fill="#0f172a" />
            </svg>

            {/* CENTER — black HMAC box */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: 340,
                top: 60,
                width: 140,
                height: 80,
                background: "#000000",
                border: "1.5px solid #b8860b",
              }}
            >
              <span
                className="text-white text-sm font-bold tracking-[0.1em] uppercase text-center"
                style={{ lineHeight: 1.2 }}
              >
                HMAC-
                <br />
                SHA256
              </span>
            </div>

            {/* ARROW — out of the box */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 480, top: 90, width: 80, height: 20 }}
              viewBox="0 0 80 20"
            >
              <line
                x1="0"
                y1="10"
                x2="68"
                y2="10"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <polygon points="68,10 62,7 62,13" fill="#0f172a" />
            </svg>

            {/* RIGHT — output pill */}
            <div
              className="absolute border-[1.5px] bg-[#fffdf5] px-3 py-2"
              style={{
                left: 560,
                top: 50,
                width: 220,
                borderColor: active.color,
                transition: "border-color 400ms ease-out",
              }}
            >
              <div className="text-[9px] uppercase tracking-[0.12em] opacity-60 mb-1">
                → 32 bytes
              </div>
              <div
                className="text-[11px] font-bold leading-relaxed"
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  color: active.color,
                  transition: "color 400ms ease-out",
                }}
                key={active.hex}
              >
                {active.hex}
              </div>
            </div>
          </div>
        </div>

        {/* Formula below the row */}
        <div
          className="text-center mt-6 text-sm"
          style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        >
          <span className="opacity-70">generate_key(name, ss_i) = </span>
          <span className="font-bold">HMAC-SHA256(name, ss_i)</span>
        </div>

        {/* Active key indicator dots */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {KEYS.map((k, i) => (
            <div
              key={k.name}
              className="flex items-center gap-1.5"
              style={{
                opacity: i === idx ? 1 : 0.35,
                transition: "opacity 400ms ease-out",
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: k.color }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.1em] font-bold"
                style={{
                  color: i === idx ? k.color : "#475569",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                {k.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={toggle}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="hmac-recap-toggle"
            >
              {playing ? "❚❚ Pause" : "▶ Resume"}
            </button>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            Five names, five keys. Same shared secret in, five independent
            32-byte keys out.
          </div>
        </div>
      </div>
    </div>
  );
}

export default HmacRecapDiagram;
