// ────────────────────────────────────────────────────────────────────────────
// RouteCalcExerciseStubV2 (DRAFT)
//
// Replacement for RouteCalcExerciseStub. Same locked visual format (black
// header bar, cream stage, ink borders, gold accent badge) but the body copy
// reflects the new chapter structure: two routes are precomputed above, and
// the interactive exercise where students compute the third route is coming
// next.
// ────────────────────────────────────────────────────────────────────────────

export interface RouteCalcExerciseStubV2Props {
  /**
   * When true, the component skips its outer container border and the black
   * header bar (used when wrapped inside RouteComparisonDiagram, which
   * provides its own wrapper + header).
   */
  headerless?: boolean;
}

export function RouteCalcExerciseStubV2({ headerless }: RouteCalcExerciseStubV2Props = {}) {
  return (
    <div
      className={
        headerless
          ? "border-foreground/40 bg-card overflow-hidden"
          : "my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      }
      data-testid="route-calc-exercise-stub-v2"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {!headerless && (
        <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
            <span className="text-sm font-bold tracking-[0.08em] uppercase">
              Compute Route C
            </span>
          </div>
        </div>
      )}
      <div
        className="bg-[#fefdfb] dark:bg-[#0b1220] px-6 py-10 flex flex-col items-center justify-center text-center"
        style={{ minHeight: 180 }}
      >
        <div
          className="px-3 py-1 border-[1.5px] mb-3 inline-block"
          style={{
            borderColor: "#b8860b",
            background: "#fef3c7",
            color: "#0f172a",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase">
            interactive exercise · coming soon
          </span>
        </div>
        <p className="text-sm leading-relaxed max-w-xl opacity-80">
          Interactive exercise coming next: compute the third route yourself,
          then pick the cheapest of the three. For now, the two precomputed
          routes above show the math. Try it on paper first.
        </p>
      </div>
    </div>
  );
}

export default RouteCalcExerciseStubV2;
