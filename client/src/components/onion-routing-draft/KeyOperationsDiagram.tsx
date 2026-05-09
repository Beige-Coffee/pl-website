import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// KeyOperationsDiagram (DRAFT)
//
// Five mini-operation diagrams showing each Sphinx job in action: the
// cryptographic primitive, its inputs (data + key), and its output. Lives
// at the top of the "What jobs the packet needs done" section in chapter 5.
//
// Three primitive shapes:
//   - stream-xor (rho, ammag): plaintext + key → XOR with ChaCha20 keystream → ciphertext
//   - hmac (mu, um):           bytes + key → HMAC-SHA256 → 32-byte tag
//   - stream-fill (pad):       key → ChaCha20 PRG → 1,300-byte buffer fill
//
// Visual style follows the locked onion-routing format spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream stage (#fefdfb), 1.5px ink borders.
//   - Body sans-serif; protocol/key names in JetBrains Mono.
//   - Canonical 5-key palette matches FiveKeysJobsDiagram /
//     KdfPipelineDiagram / PerHopKeyMatrixDiagram.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type Primitive = "stream-xor" | "hmac" | "stream-fill";
type Direction = "FORWARD" | "BACKWARD" | "SENDER ONLY";

interface JobSpec {
  name: string;
  color: string;
  direction: Direction;
  role: string;
  primitive: Primitive;
  // Names for the SVG mini-diagram boxes
  inputDataLabel: string | null; // null for stream-fill (pad)
  inputKeyLabel: string; // displayed inside the op box and as a key chip
  opName: string; // "ChaCha20", "HMAC-SHA256"
  outputLabel: string;
  description: string;
}

const JOBS: JobSpec[] = [
  {
    name: "rho",
    color: "#b8860b",
    direction: "FORWARD",
    role: "Encrypt the forward payload",
    primitive: "stream-xor",
    inputDataLabel: "payload",
    inputKeyLabel: "rho",
    opName: "ChaCha20",
    outputLabel: "ciphertext",
    description:
      "Each forwarder XORs the entire 1,300-byte payload with a keystream derived from rho to peel their layer of encryption.",
  },
  {
    name: "mu",
    color: "#3b6aa0",
    direction: "FORWARD",
    role: "Authenticate the forward layer",
    primitive: "hmac",
    inputDataLabel: "payload",
    inputKeyLabel: "mu",
    opName: "HMAC-SHA256",
    outputLabel: "32-byte tag",
    description:
      "HMAC-SHA256 with mu produces a tag covering the payload. The forwarder verifies it first, before any decryption, and rejects the packet if it doesn't match.",
  },
  {
    name: "ammag",
    color: "#5a7a2f",
    direction: "BACKWARD",
    role: "Encrypt return-path errors",
    primitive: "stream-xor",
    inputDataLabel: "error packet",
    inputKeyLabel: "ammag",
    opName: "ChaCha20",
    outputLabel: "ciphertext",
    description:
      "When a hop fails the payment, ammag wraps the error packet on the way back. Each hop adds another layer; Alice peels them off in order.",
  },
  {
    name: "um",
    color: "#2d7a7a",
    direction: "BACKWARD",
    role: "Authenticate return-path errors",
    primitive: "hmac",
    inputDataLabel: "error packet",
    inputKeyLabel: "um",
    opName: "HMAC-SHA256",
    outputLabel: "32-byte tag",
    description:
      "The failing hop authenticates its error packet with um. Alice verifies these tags on the return trip to identify which hop failed.",
  },
  {
    name: "pad",
    color: "#7b4b8a",
    direction: "SENDER ONLY",
    role: "Initialize the empty buffer",
    primitive: "stream-fill",
    inputDataLabel: null,
    inputKeyLabel: "pad",
    opName: "ChaCha20",
    outputLabel: "1,300 bytes",
    description:
      "Before Alice puts any layers in, ChaCha20(pad) fills the 1,300-byte buffer with random-looking bytes derived from her session key. Forwarders never see this key.",
  },
];

function directionStyles(dir: Direction): {
  bg: string;
  fg: string;
  border: string;
} {
  if (dir === "FORWARD")
    return { bg: "#0f172a", fg: "#fffdf5", border: "#0f172a" };
  if (dir === "BACKWARD")
    return { bg: "#fffdf5", fg: "#0f172a", border: "#0f172a" };
  return { bg: "#b8860b", fg: "#fffdf5", border: "#b8860b" };
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Mini SVG showing the primitive's flow: inputs → op box → output.
// Three layouts depending on `primitive`.
function OperationMini({ job }: { job: JobSpec }) {
  const { color, primitive, inputDataLabel, inputKeyLabel, opName, outputLabel } = job;
  const VB_W = 240;
  const VB_H = 100;

  // Output column shared by all primitives
  const outputBox = (
    <g>
      <rect
        x={186}
        y={36}
        width={48}
        height={28}
        fill={hexToRgba(color, 0.18)}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={210}
        y={54}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={color}
        style={{ fontFamily: MONO }}
      >
        {outputLabel}
      </text>
    </g>
  );

  // Op box (center)
  const opBox = (
    <g>
      <rect
        x={94}
        y={28}
        width={78}
        height={44}
        fill={color}
        stroke={color}
        strokeWidth={1.5}
        rx={2}
      />
      <text
        x={133}
        y={45}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#fffdf5"
        style={{ fontFamily: MONO }}
      >
        {opName}
      </text>
      <text
        x={133}
        y={60}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#fffdf5"
        style={{ fontFamily: MONO, fontStyle: "italic" }}
      >
        ({inputKeyLabel})
      </text>
    </g>
  );

  // Arrows
  const arrowToOp = (yStart: number) => (
    <g>
      <line
        x1={62}
        y1={yStart}
        x2={88}
        y2={50}
        stroke="#0f172a"
        strokeWidth={1.5}
      />
      <polygon points="92,50 84,46 84,54" fill="#0f172a" />
    </g>
  );

  const arrowFromOp = (
    <g>
      <line
        x1={172}
        y1={50}
        x2={182}
        y2={50}
        stroke="#0f172a"
        strokeWidth={1.5}
      />
      <polygon points="186,50 178,46 178,54" fill="#0f172a" />
    </g>
  );

  // Render based on primitive
  if (primitive === "stream-fill") {
    // Single input (key only), one arrow to op, one arrow to output.
    return (
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: 110 }}>
        {/* Input: session_key (acts as the only input here) */}
        <g>
          <rect
            x={6}
            y={36}
            width={56}
            height={28}
            fill="#fffdf5"
            stroke="#0f172a"
            strokeWidth={1.5}
          />
          <text
            x={34}
            y={54}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#0f172a"
            style={{ fontFamily: MONO }}
          >
            session_key
          </text>
        </g>
        {/* Arrow into op */}
        <g>
          <line x1={62} y1={50} x2={88} y2={50} stroke="#0f172a" strokeWidth={1.5} />
          <polygon points="92,50 84,46 84,54" fill="#0f172a" />
        </g>
        {opBox}
        {arrowFromOp}
        {outputBox}
      </svg>
    );
  }

  // stream-xor and hmac: two inputs (data + the key chip).
  // Stack them vertically and merge into the op box.
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: 110 }}>
      {/* Input data box (top) */}
      <g>
        <rect
          x={6}
          y={14}
          width={56}
          height={26}
          fill="#fffdf5"
          stroke="#0f172a"
          strokeWidth={1.5}
        />
        <text
          x={34}
          y={31}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#0f172a"
          style={{ fontFamily: MONO }}
        >
          {inputDataLabel}
        </text>
      </g>
      {/* Input key chip (bottom) */}
      <g>
        <rect
          x={6}
          y={60}
          width={56}
          height={26}
          fill={hexToRgba(color, 0.18)}
          stroke={color}
          strokeWidth={1.5}
        />
        <text
          x={34}
          y={77}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill={color}
          style={{ fontFamily: MONO }}
        >
          {inputKeyLabel} key
        </text>
      </g>
      {/* Two arrows merging into the op box */}
      {arrowToOp(27)}
      {arrowToOp(73)}
      {opBox}
      {arrowFromOp}
      {outputBox}
    </svg>
  );
}

export function KeyOperationsDiagram() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const focused = hoveredIdx !== null ? JOBS[hoveredIdx] : null;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="key-operations"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Five jobs, five operations
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 320 }}
      >
        <div className="overflow-x-auto">
          <div
            className="grid gap-3 mx-auto"
            style={{
              gridTemplateColumns: "repeat(5, minmax(180px, 1fr))",
              minWidth: 920,
            }}
          >
            {JOBS.map((job, idx) => {
              const isHovered = hoveredIdx === idx;
              const isOtherHovered = hoveredIdx !== null && hoveredIdx !== idx;
              const dirStyle = directionStyles(job.direction);
              return (
                <div
                  key={job.name}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="border-[1.5px] flex flex-col"
                  style={{
                    borderColor: isHovered ? job.color : "#0f172a",
                    background: "#fffdf5",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: isHovered
                      ? `0 6px 18px ${hexToRgba(job.color, 0.25)}`
                      : "none",
                    opacity: isOtherHovered ? 0.65 : 1,
                    transition:
                      "transform 200ms ease-out, box-shadow 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out",
                  }}
                  data-testid={`key-operations-card-${job.name}`}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b-[1.5px]"
                    style={{
                      borderColor: "#0f172a",
                      background: hexToRgba(job.color, 0.12),
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        background: job.color,
                        border: "1.5px solid #0f172a",
                      }}
                      aria-hidden
                    />
                    <span
                      className="text-base font-bold uppercase tracking-[0.05em]"
                      style={{ color: job.color, fontFamily: MONO }}
                    >
                      {job.name}
                    </span>
                    <span
                      className="ml-auto inline-block px-1.5 py-0.5 border-[1.5px] text-[9px] font-bold tracking-[0.08em] uppercase"
                      style={{
                        background: dirStyle.bg,
                        color: dirStyle.fg,
                        borderColor: dirStyle.border,
                      }}
                    >
                      {job.direction}
                    </span>
                  </div>

                  {/* Role label */}
                  <div
                    className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.04em]"
                    style={{ color: "#0f172a" }}
                  >
                    {job.role}
                  </div>

                  {/* Operation mini-diagram */}
                  <div className="px-2 pb-2">
                    <OperationMini job={job} />
                  </div>

                  {/* Description */}
                  <div
                    className="px-3 pb-3 text-[11px] leading-snug"
                    style={{ color: "#0f172a" }}
                  >
                    {job.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Focused detail panel (shown on hover) */}
        <div className="mt-4 mx-auto" style={{ maxWidth: 760 }}>
          {focused ? (
            <div
              className="border-[1.5px] p-3"
              style={{
                background: "#fffdf5",
                borderColor: "#0f172a",
                borderLeft: `4px solid ${focused.color}`,
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.08em] font-bold mb-1"
                style={{ color: "#475569" }}
              >
                {focused.opName} keyed by{" "}
                <span style={{ color: focused.color }}>{focused.inputKeyLabel}</span>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "#0f172a" }}>
                {focused.description}
              </div>
            </div>
          ) : (
            <div
              className="opacity-60 italic text-center text-xs"
              style={{ color: "#475569" }}
            >
              Hover any card to see the operation up close.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeyOperationsDiagram;
