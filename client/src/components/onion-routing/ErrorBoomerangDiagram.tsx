// ────────────────────────────────────────────────────────────────────────────
// ErrorBoomerangDiagram
//
// Side-by-side trace of an error wrapping its way back from Carol (failing
// hop) → Bob → Alice. Each transition shows the additional ammag layer that
// gets XORed on top.
// Used in Chapter 10.
// ────────────────────────────────────────────────────────────────────────────

const HOPS = [
  { label: "Alice", color: "#fde68a", stroke: "#b8860b" },
  { label: "Bob",   color: "#bfdbfe", stroke: "#2563eb" },
  { label: "Carol", color: "#bbf7d0", stroke: "#16a34a" },
];

export function ErrorBoomerangDiagram() {
  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-error-boomerang"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        An error wrapping its way back to Alice
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 720 240"
          className="w-full max-w-4xl mx-auto"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {/* Three nodes in a row */}
          {HOPS.map((h, i) => {
            const x = 80 + i * 280;
            return (
              <g key={h.label}>
                <circle cx={x} cy={50} r={28} fill={h.color} stroke={h.stroke} strokeWidth={2} />
                <text x={x} y={54} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f172a">
                  {h.label}
                </text>
              </g>
            );
          })}

          {/* Carol fails: yellow burst at Carol */}
          <g>
            <text x={640} y={20} textAnchor="middle" fontSize={11} fontWeight={600} fill="#dc2626">
              ✗ Carol fails the HTLC
            </text>
          </g>

          {/* Carol's wrap: arrow Carol → Bob with packet annotation */}
          <g>
            <path
              d="M615,70 Q450,140 360,90"
              fill="none"
              stroke="#475569"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            <rect x={420} y={120} width={180} height={48} rx={4} fill="#bbf7d0" stroke="#16a34a" strokeWidth={2} />
            <text x={510} y={138} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
              error ⊕ ammag_carol
            </text>
            <text x={510} y={156} textAnchor="middle" fontSize={9} fill="#475569">
              hmac_carol || padded_msg, encrypted
            </text>
          </g>

          {/* Bob's wrap: arrow Bob → Alice with another layer */}
          <g>
            <path
              d="M335,70 Q200,140 110,90"
              fill="none"
              stroke="#475569"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            <rect x={140} y={180} width={210} height={48} rx={4} fill="#bfdbfe" stroke="#2563eb" strokeWidth={2} />
            <text x={245} y={198} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
              (carol's wrap) ⊕ ammag_bob
            </text>
            <text x={245} y={214} textAnchor="middle" fontSize={9} fill="#475569">
              one extra encryption layer
            </text>
          </g>

          {/* Arrow definitions */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="mt-4 text-sm leading-relaxed">
        Each upstream hop wraps the error with its own ammag keystream before passing it along. By the time Alice receives it, the error has Carol's wrap on the inside and Bob's on the outside. To find the failing hop, Alice peels in the same direction she'd construct the forward onion — Bob first, then Carol.
      </div>
    </div>
  );
}

export default ErrorBoomerangDiagram;
