// ────────────────────────────────────────────────────────────────────────────
// RouteCalcExerciseStub (DRAFT)
//
// Placeholder for the chapter-1 interactive route-calculation exercise. The
// real interactive (where students compute amt_to_forward and outgoing_cltv
// for each hop given fees + deltas) hasn't been built yet. This stub keeps the
// chapter renderable and tells students it's coming.
// ────────────────────────────────────────────────────────────────────────────

export function RouteCalcExerciseStub() {
  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="route-calc-exercise-stub"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Compute the route
          </span>
        </div>
      </div>
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
          A hands-on exercise will live here. Given a 3-hop route with each hop's fee
          policy and CLTV delta, you'll compute <code>amt_to_forward</code> and{" "}
          <code>outgoing_cltv_value</code> for every hop, working backward from the
          destination. For now, the worked example above is the recipe.
        </p>
      </div>
    </div>
  );
}

export default RouteCalcExerciseStub;
