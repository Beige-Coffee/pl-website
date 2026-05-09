import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// PacketJobsPreviewDiagram (DRAFT)
//
// Sets up the chapter-5 (key-derivation) intro by showing the onion packet's
// regions colored by the *job* each region needs done (encrypt forward, auth
// forward, encrypt backward, auth backward, sender-only init), without
// committing to byte counts. The byte-precise layout lives in the next
// chapter (5.0-fixed-size-packet, OnionPacketLayoutDiagram).
//
// Why this exists: the chapter is about why one shared secret expands into
// five named keys. Students need to see *what jobs the keys do* before the
// "why one isn't enough" argument lands. This diagram is the bridge.
//
// Visual style follows the locked onion-routing format spec:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream stage (#fefdfb), 1.5px ink borders.
//   - Body sans-serif; key/job names in JetBrains Mono.
//   - Canonical 5-key palette matches FiveKeysJobsDiagram /
//     KdfPipelineDiagram / PerHopKeyMatrixDiagram.
// ────────────────────────────────────────────────────────────────────────────

type Direction = "FORWARD" | "BACKWARD" | "SENDER ONLY";
type JobId = "encrypt-fwd" | "auth-fwd" | "encrypt-err" | "auth-err" | "init";

const MONO = '"JetBrains Mono", "Fira Code", monospace';

interface JobSpec {
  id: JobId;
  label: string;
  keyName: string;
  color: string;
  direction: Direction;
  question: string;
  oneLiner: string;
}

const JOBS: JobSpec[] = [
  {
    id: "encrypt-fwd",
    label: "Encrypt the forward payload",
    keyName: "rho",
    color: "#b8860b",
    direction: "FORWARD",
    question: "How do we keep the hop instructions secret from everyone except the right hop?",
    oneLiner:
      "A stream cipher (ChaCha20) XORs over the 1,300-byte payload area. Each hop peels its layer with the same keystream.",
  },
  {
    id: "auth-fwd",
    label: "Authenticate the forward layer",
    keyName: "mu",
    color: "#3b6aa0",
    direction: "FORWARD",
    question: "How does a forwarder know nobody tampered with the bytes it just received?",
    oneLiner:
      "An HMAC-SHA256 tag covers the payload area. The forwarder verifies it before doing anything else.",
  },
  {
    id: "encrypt-err",
    label: "Encrypt return-path errors",
    keyName: "ammag",
    color: "#5a7a2f",
    direction: "BACKWARD",
    question: "When a hop fails the payment, how do we keep the failure reason private from everyone except Alice?",
    oneLiner:
      "A separate stream cipher wraps the error packet on the way back. Each hop adds another layer; Alice peels them in order.",
  },
  {
    id: "auth-err",
    label: "Authenticate return-path errors",
    keyName: "um",
    color: "#2d7a7a",
    direction: "BACKWARD",
    question: "How does Alice know the failure she received actually came from a real hop on the route?",
    oneLiner:
      "Each hop authenticates its error with a separate HMAC key. Alice verifies on the way back to identify which hop failed.",
  },
  {
    id: "init",
    label: "Initialize the empty packet",
    keyName: "pad",
    color: "#7b4b8a",
    direction: "SENDER ONLY",
    question: "Before Alice puts anything in the 1,300-byte buffer, what fills the empty space so it doesn't leak path length?",
    oneLiner:
      "Alice deterministically fills the buffer with random-looking bytes derived from her session key. Nobody else sees this key.",
  },
];

function directionStyles(dir: Direction): { bg: string; fg: string; border: string } {
  if (dir === "FORWARD") return { bg: "#0f172a", fg: "#fffdf5", border: "#0f172a" };
  if (dir === "BACKWARD") return { bg: "#fffdf5", fg: "#0f172a", border: "#0f172a" };
  return { bg: "#b8860b", fg: "#fffdf5", border: "#b8860b" };
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Forward-direction regions of the packet, in left-to-right order. Widths are
// schematic, not byte-accurate. The "init" job (pad) is shown as an annotation
// over the payload region rather than a separate band, since pad's bytes
// physically occupy the same region the encrypt-fwd job later overwrites.
interface PacketRegion {
  id: "header" | "payload" | "tag";
  label: string;
  hint: string;
  jobId: JobId | null;
  width: number; // schematic flex weight
}

const FORWARD_REGIONS: PacketRegion[] = [
  { id: "header", label: "header", hint: "version + ephemeral pubkey", jobId: null, width: 0.8 },
  {
    id: "payload",
    label: "payload area",
    hint: "1,300 bytes of hop instructions + filler",
    jobId: "encrypt-fwd",
    width: 7.5,
  },
  { id: "tag", label: "HMAC", hint: "32-byte authentication tag", jobId: "auth-fwd", width: 1.2 },
];

const BACKWARD_REGIONS: PacketRegion[] = [
  {
    id: "payload",
    label: "error payload",
    hint: "encrypted failure reason + context",
    jobId: "encrypt-err",
    width: 7.5,
  },
  { id: "tag", label: "HMAC", hint: "32-byte authentication tag", jobId: "auth-err", width: 1.2 },
];

export function PacketJobsPreviewDiagram() {
  const [activeJob, setActiveJob] = useState<JobId | null>(null);
  const focused = JOBS.find((j) => j.id === activeJob) ?? null;

  function jobColor(jobId: JobId | null): string {
    if (!jobId) return "#94a3b8";
    return JOBS.find((j) => j.id === jobId)!.color;
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="packet-jobs-preview"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            What jobs the packet needs done
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 460 }}
      >
        <div className="overflow-x-auto">
          <div className="mx-auto" style={{ minWidth: 640, maxWidth: 820 }}>
            {/* FORWARD packet row */}
            <PacketBand
              direction="Alice → Dave"
              caption="Forward onion packet"
              regions={FORWARD_REGIONS}
              activeJob={activeJob}
              onSelectJob={setActiveJob}
              jobColor={jobColor}
            />

            {/* SENDER-ONLY annotation, hovering above the payload region */}
            <div
              className="mt-1 mb-3 flex justify-center"
              style={{ position: "relative" }}
            >
              <button
                onClick={() =>
                  setActiveJob(activeJob === "init" ? null : "init")
                }
                onMouseEnter={() => setActiveJob("init")}
                onMouseLeave={() => setActiveJob(null)}
                className="border-[1.5px] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{
                  background:
                    activeJob === "init"
                      ? hexToRgba("#7b4b8a", 0.18)
                      : "#fffdf5",
                  borderColor: "#7b4b8a",
                  color: "#7b4b8a",
                  fontFamily: MONO,
                  cursor: "pointer",
                  transition: "background 200ms ease-out",
                }}
                data-testid="packet-jobs-job-init"
              >
                pad · seeds the empty buffer (sender only)
              </button>
            </div>

            {/* BACKWARD packet row */}
            <PacketBand
              direction="Failing hop → Alice"
              caption="Return error packet"
              regions={BACKWARD_REGIONS}
              activeJob={activeJob}
              onSelectJob={setActiveJob}
              jobColor={jobColor}
            />
          </div>
        </div>

        {/* Job legend / detail */}
        <div className="mt-6 mx-auto" style={{ maxWidth: 760 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {JOBS.filter((j) => j.id !== "init").map((j) => {
              const isActive = activeJob === j.id;
              const dimmed = activeJob !== null && !isActive;
              return (
                <button
                  key={j.id}
                  onMouseEnter={() => setActiveJob(j.id)}
                  onMouseLeave={() => setActiveJob(null)}
                  onClick={() =>
                    setActiveJob(isActive ? null : j.id)
                  }
                  className="border-[1.5px] p-2 text-left"
                  style={{
                    background: isActive
                      ? hexToRgba(j.color, 0.18)
                      : "#fffdf5",
                    borderColor: isActive ? j.color : "#0f172a",
                    opacity: dimmed ? 0.55 : 1,
                    cursor: "pointer",
                    transition:
                      "background 200ms ease-out, opacity 200ms ease-out, border-color 200ms ease-out",
                  }}
                  data-testid={`packet-jobs-job-${j.id}`}
                >
                  <div
                    className="text-[10px] uppercase tracking-[0.08em] font-bold"
                    style={{
                      color:
                        directionStyles(j.direction).bg === "#0f172a"
                          ? "#0f172a"
                          : j.direction === "SENDER ONLY"
                          ? "#b8860b"
                          : "#475569",
                    }}
                  >
                    {j.direction}
                  </div>
                  <div
                    className="text-[11px] font-bold mt-0.5"
                    style={{ color: j.color, fontFamily: MONO }}
                  >
                    {j.keyName}
                  </div>
                  <div
                    className="text-[11px] font-semibold mt-0.5"
                    style={{ color: "#0f172a" }}
                  >
                    {j.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="mt-4">
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
                  question
                </div>
                <div
                  className="text-sm font-semibold mb-2"
                  style={{ color: "#0f172a" }}
                >
                  {focused.question}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: "#0f172a" }}>
                  <span
                    className="font-bold"
                    style={{ color: focused.color, fontFamily: MONO }}
                  >
                    {focused.keyName}
                  </span>
                  : {focused.oneLiner}
                </div>
              </div>
            ) : (
              <div
                className="text-xs italic text-center opacity-60"
                style={{ color: "#475569" }}
              >
                Hover or click any region to see the job that key handles.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PacketBandProps {
  direction: string;
  caption: string;
  regions: PacketRegion[];
  activeJob: JobId | null;
  onSelectJob: (job: JobId | null) => void;
  jobColor: (jobId: JobId | null) => string;
}

function PacketBand({
  direction,
  caption,
  regions,
  activeJob,
  onSelectJob,
  jobColor,
}: PacketBandProps) {
  const totalWeight = regions.reduce((s, r) => s + r.width, 0);
  return (
    <div className="mb-2">
      {/* Caption + flow direction */}
      <div className="flex items-baseline justify-between mb-1">
        <span
          className="text-[10px] uppercase tracking-[0.1em] font-bold"
          style={{ color: "#0f172a" }}
        >
          {caption}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.1em]"
          style={{ color: "#475569", fontFamily: MONO }}
        >
          {direction}
        </span>
      </div>

      {/* Band */}
      <div
        className="flex border-[1.5px]"
        style={{
          height: 56,
          background: "#fffdf5",
          borderColor: "#0f172a",
        }}
      >
        {regions.map((r, i) => {
          const isActive = r.jobId !== null && activeJob === r.jobId;
          const dimmed = activeJob !== null && !isActive;
          const tint = r.jobId
            ? hexToRgba(jobColor(r.jobId), isActive ? 0.32 : 0.14)
            : "#f5f1e8";
          const flexBasis = `${(r.width / totalWeight) * 100}%`;
          const isHeader = r.id === "header";
          return (
            <button
              key={r.id}
              onMouseEnter={() =>
                r.jobId && onSelectJob(r.jobId)
              }
              onMouseLeave={() => onSelectJob(null)}
              onClick={() => {
                if (!r.jobId) return;
                onSelectJob(activeJob === r.jobId ? null : r.jobId);
              }}
              className="flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-[0.06em] border-r-[1.5px] last:border-r-0"
              style={{
                flexBasis,
                background: tint,
                borderColor: "#0f172a",
                color: "#0f172a",
                opacity: dimmed ? 0.5 : 1,
                cursor: r.jobId ? "pointer" : "default",
                transition:
                  "background 200ms ease-out, opacity 200ms ease-out",
                padding: "4px 6px",
                minWidth: 0,
              }}
              data-testid={`packet-jobs-region-${r.id}`}
            >
              <span
                className="leading-tight text-center"
                style={{ fontFamily: MONO }}
              >
                {r.label}
              </span>
              {!isHeader && (
                <span
                  className="text-[9px] font-normal opacity-70 leading-tight text-center mt-0.5"
                  style={{ fontFamily: MONO }}
                >
                  {r.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PacketJobsPreviewDiagram;
