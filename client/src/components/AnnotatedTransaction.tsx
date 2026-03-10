import { useState, useRef, useCallback } from "react";

const RAW_HEX =
  "020000000001018d54238793c4547bb913e369a27c74bc08fc20c33197f5690f41565c7cfad12e0000000000ffffffff01784a4c0000000000220020657760ca015175e42ff5b4470563b23adcf0d2973a0506a176a5569690d64437024730440220548d3aeae38390d1d4f79b8756b5758d131051ddce223aa4f395bb88be1ccaeb02201698654ab9c29d41822771cd3a75bffec87488322a46783f64cd53aefb1f5d960121024e77786b0c8bef20ef469345cf4c306b14dee25dd5bab152155bee1e2115e93100000000";

interface Segment {
  hex: string;
  label: string;
  category: "structure" | "input" | "output" | "witness" | "meta";
}

// 5 warm category colors matching PL's palette
const CATEGORY_COLORS = {
  structure: { light: "#92700a", dark: "#fbbf24" },  // gold — tx frame
  input:     { light: "#9a3412", dark: "#fb923c" },  // warm amber — input fields
  output:    { light: "#166534", dark: "#4ade80" },  // warm green — output fields
  witness:   { light: "#6b21a8", dark: "#c084fc" },  // warm purple — witness data
  meta:      { light: "#78716c", dark: "#a8a29e" },  // stone — counts & lengths
} as const;

const SEGMENTS: Segment[] = [
  { hex: "02000000", label: "Version", category: "structure" },
  { hex: "00", label: "SegWit Marker", category: "structure" },
  { hex: "01", label: "SegWit Flag", category: "structure" },
  { hex: "01", label: "Input Count", category: "meta" },
  { hex: "8d54238793c4547bb913e369a27c74bc08fc20c33197f5690f41565c7cfad12e", label: "Previous Txid", category: "input" },
  { hex: "00000000", label: "Previous Output Index", category: "input" },
  { hex: "00", label: "ScriptSig Length", category: "meta" },
  { hex: "ffffffff", label: "Sequence", category: "input" },
  { hex: "01", label: "Output Count", category: "meta" },
  { hex: "784a4c0000000000", label: "Amount (satoshis)", category: "output" },
  { hex: "22", label: "ScriptPubKey Length", category: "meta" },
  { hex: "0020657760ca015175e42ff5b4470563b23adcf0d2973a0506a176a5569690d64437", label: "ScriptPubKey (P2WSH)", category: "output" },
  { hex: "02", label: "Witness Items", category: "meta" },
  { hex: "47", label: "Signature Length", category: "meta" },
  { hex: "30440220548d3aeae38390d1d4f79b8756b5758d131051ddce223aa4f395bb88be1ccaeb02201698654ab9c29d41822771cd3a75bffec87488322a46783f64cd53aefb1f5d9601", label: "Signature (DER)", category: "witness" },
  { hex: "21", label: "Public Key Length", category: "meta" },
  { hex: "024e77786b0c8bef20ef469345cf4c306b14dee25dd5bab152155bee1e2115e931", label: "Public Key", category: "witness" },
  { hex: "00000000", label: "Locktime", category: "structure" },
];

export default function AnnotatedTransaction({ theme }: { theme: string }) {
  const [activeTab, setActiveTab] = useState<"annotated" | "raw">("annotated");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, idx: number) => {
      setHoveredIdx(idx);
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({
        label: SEGMENTS[idx].label,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setTooltip(null);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(RAW_HEX);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabBase = `px-3 py-1.5 text-xs font-bold border-2 transition-colors cursor-pointer`;
  const tabActive = isDark
    ? "bg-[#0f1930] text-[#ffd700] border-[#ffd700]"
    : "bg-[#fffdf5] text-[#9a7200] border-[#b8860b]";
  const tabInactive = isDark
    ? "bg-transparent text-[#94a3b8] border-[#2a3552] hover:text-[#e2e8f0]"
    : "bg-transparent text-[#a09070] border-[#d4c9a8] hover:text-[#5a4a30]";

  const containerBorder = isDark ? "border-[#ffd700]" : "border-[#b8860b]";
  const containerBg = isDark ? "bg-[#0f1930]" : "bg-[#fffdf5]";

  return (
    <div className="my-4">
      {/* Tab bar */}
      <div className="flex">
        <button
          onClick={() => setActiveTab("annotated")}
          className={`${tabBase} ${activeTab === "annotated" ? tabActive : tabInactive} border-b-0`}
          style={{ borderRadius: 0 }}
        >
          Annotated
        </button>
        <button
          onClick={() => setActiveTab("raw")}
          className={`${tabBase} ${activeTab === "raw" ? tabActive : tabInactive} border-b-0 -ml-0.5`}
          style={{ borderRadius: 0 }}
        >
          Raw
        </button>
      </div>

      {/* Content area */}
      <div
        className={`border-2 ${containerBorder} ${containerBg} p-4 relative`}
        style={{ borderRadius: 0 }}
      >
        {activeTab === "annotated" ? (
          <>
            {/* Annotated hex with color-coded segments */}
            <div
              ref={containerRef}
              className="font-sans text-base leading-8 break-all relative tracking-wide"
              style={{ overflowWrap: "break-word" }}
            >
              {/* Floating tooltip */}
              {tooltip && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: `${tooltip.x}px`,
                    top: `${tooltip.y - 4}px`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div
                    className={`px-2 py-1 text-xs font-bold whitespace-nowrap ${
                      isDark
                        ? "bg-[#e2e8f0] text-[#0a0f1a]"
                        : "bg-[#1a1a1a] text-[#f5f5f5]"
                    }`}
                    style={{ borderRadius: 0, boxShadow: "2px 2px 0px rgba(0,0,0,0.2)" }}
                  >
                    {tooltip.label}
                  </div>
                </div>
              )}

              {SEGMENTS.map((seg, i) => {
                const isHovered = hoveredIdx === i;
                const cat = CATEGORY_COLORS[seg.category];
                const color = isDark ? cat.dark : cat.light;
                return (
                  <span
                    key={i}
                    onMouseEnter={(e) => handleMouseEnter(e, i)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      color,
                      backgroundColor: isHovered
                        ? isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.06)"
                        : undefined,
                      transition: "background-color 0.15s",
                      cursor: "pointer",
                    }}
                  >
                    {seg.hex}
                  </span>
                );
              })}
            </div>

            {/* Status bar */}
            <div
              className={`mt-3 pt-2 text-sm font-sans h-6 ${
                isDark
                  ? "border-t border-[#2a3552] text-[#94a3b8]"
                  : "border-t border-[#d4c9a8] text-[#8a7a60]"
              }`}
            >
              {hoveredIdx !== null ? (
                <span
                  className="font-bold"
                  style={{
                    color: isDark
                      ? CATEGORY_COLORS[SEGMENTS[hoveredIdx].category].dark
                      : CATEGORY_COLORS[SEGMENTS[hoveredIdx].category].light,
                  }}
                >
                  {SEGMENTS[hoveredIdx].label}
                </span>
              ) : (
                <span className="italic opacity-60">
                  Hover over the transaction to identify each field
                </span>
              )}
            </div>
          </>
        ) : (
          /* Raw view for copy/paste */
          <div className="relative">
            <pre
              className={`font-sans text-base leading-relaxed break-all whitespace-pre-wrap tracking-wide ${
                isDark ? "text-[#e2e8f0]" : "text-[#1a1a1a]"
              }`}
            >
              {RAW_HEX}
            </pre>
            <button
              onClick={handleCopy}
              className={`absolute top-0 right-0 px-2 py-1 text-xs font-bold border-2 transition-colors cursor-pointer ${
                copied
                  ? isDark
                    ? "bg-green-500/20 text-green-400 border-green-500"
                    : "bg-green-50 text-green-700 border-green-600"
                  : isDark
                    ? "bg-[#0b1220] text-[#94a3b8] border-[#2a3552] hover:text-[#ffd700] hover:border-[#ffd700]"
                    : "bg-[#fdf9f2] text-[#8a7a60] border-[#d4c9a8] hover:text-[#b8860b] hover:border-[#b8860b]"
              }`}
              style={{ borderRadius: 0 }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
