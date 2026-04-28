import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// FillerTraceDiagram
//
// Visual walkthrough of the BOLT 4 filler construction algorithm. Uses small
// fictional "rho keystream slice" colors per hop and shows the running filler
// as a stack of color-coded cells that grows with each hop.
//
// The hops are simplified to two intermediate forwarders (Bob, Carol) so the
// diagram fits on one screen. Dave (the destination) doesn't contribute.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { id: "bob", label: "Bob", color: "#bfdbfe", stroke: "#2563eb" },
  { id: "carol", label: "Carol", color: "#bbf7d0", stroke: "#16a34a" },
];

const STEPS: Array<{
  caption: string;
  fillerCells: Array<{ source: "bob" | "carol" | "empty"; }>;
}> = [
  {
    caption: "Start with empty filler. We'll grow it one hop at a time, building from the outside in.",
    fillerCells: [],
  },
  {
    caption:
      "Bob's hop. Append bob_size zero bytes (shown as empty). Then XOR with the trailing portion of Bob's rho keystream, which fills these positions with Bob-keystream bytes (blue).",
    fillerCells: Array(8).fill(null).map(() => ({ source: "bob" })),
  },
  {
    caption:
      "Carol's hop. Prepend carol_size zero bytes (empty), so filler is now (carol_size + bob_size) long. XOR the entire thing with the trailing portion of Carol's rho keystream. The new bytes become Carol-keystream (green); Bob's bytes get an additional layer of Carol-keystream XORed on top.",
    fillerCells: [
      ...Array(6).fill(null).map(() => ({ source: "carol" as const })),
      ...Array(8).fill(null).map(() => ({ source: "bob" as const })),
    ],
  },
  {
    caption:
      "Final filler. Total length = bob_size + carol_size. Carol contributed her keystream over the leading bytes; Bob contributed his over the trailing bytes (and Carol layered her keystream over those too). When the packet flows through the route, each hop's rho XOR will peel off exactly its contribution, leaving the right bytes for the next hop to verify.",
    fillerCells: [
      ...Array(6).fill(null).map(() => ({ source: "carol" as const })),
      ...Array(8).fill(null).map(() => ({ source: "bob" as const })),
    ],
  },
];

export function FillerTraceDiagram() {
  const [step, setStep] = useState(0);
  const stepData = STEPS[step];

  const cellColor = (source: "bob" | "carol" | "empty") => {
    if (source === "empty") return { bg: "#f1f5f9", border: "#cbd5e1" };
    const hop = HOPS.find((h) => h.id === source)!;
    return { bg: hop.color, border: hop.stroke };
  };

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-filler-trace"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Building the filler, hop by hop
      </div>

      {/* Filler bytes view */}
      <div className="mb-4">
        <div className="text-xs opacity-70 mb-2 font-mono">filler (left = newer, right = older)</div>
        <div
          className="flex gap-1 flex-wrap min-h-[40px] items-center bg-background p-2 border-2 border-border"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {stepData.fillerCells.length === 0 && (
            <div className="text-foreground/50 italic text-sm">empty</div>
          )}
          {stepData.fillerCells.map((c, i) => {
            const colors = cellColor(c.source);
            return (
              <div
                key={i}
                className="w-6 h-6 border-2 flex items-center justify-center text-[9px] font-semibold"
                style={{
                  background: colors.bg,
                  borderColor: colors.border,
                  color: "#0f172a",
                }}
                title={`From ${c.source}'s rho keystream`}
              >
                {c.source[0].toUpperCase()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs mb-4">
        {HOPS.map((h) => (
          <div key={h.id} className="flex items-center gap-1.5">
            <div
              className="w-3.5 h-3.5 border-2"
              style={{ background: h.color, borderColor: h.stroke }}
            />
            <span>{h.label}'s ρ keystream</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 border-2" style={{ background: "#f1f5f9", borderColor: "#cbd5e1" }} />
          <span className="text-foreground/70">empty / zero</span>
        </div>
      </div>

      {/* Step controls */}
      <div className="flex flex-col md:flex-row md:items-start md:gap-4">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                step >= i
                  ? "bg-primary text-foreground border-border"
                  : "bg-card text-foreground/50 border-border hover:bg-secondary"
              }`}
              data-testid={`onion-filler-step-${i}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1">
          {stepData.caption}
        </div>
      </div>
    </div>
  );
}

export default FillerTraceDiagram;
