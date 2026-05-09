import { useEffect, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// OnionPeelDiagram (rebuilt 2026-05-08)
//
// Forward-direction visualization of one forwarder peeling its layer. Shows
// the 2,600-byte working buffer Bob allocates, the rho-keystream XOR over
// the full 2,600-byte region, and how the next 1,300-byte slice (window
// shifted forward by hop payload size) becomes Charlie's view.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

const STEP_CAPTIONS: Record<number, string> = {
  0: "Bob receives the packet. He copies the inbound 1,300-byte hop_payloads field into the front of a 2,600-byte working buffer. The trailing 1,300 bytes start as zeros. None of the bytes are decrypted yet; he doesn't know what's in any of them.",
  1: "Bob generates 2,600 bytes of ChaCha20 keystream from his rho key and XORs it onto the working buffer. The first 1,300 bytes now have the encryption layer removed, Bob's TLV hop payload at the front, Charlie's view in the rest. The trailing 1,300 bytes are now Bob's keystream applied to zeros, exactly the bytes Alice baked into the filler so Charlie's HMAC will line up.",
  2: "Bob reads his hop payload off the front: the bigsize length, the TLV records, and the next_hmac that points to Charlie's layer. He computes slot_size = bigsize_header + tlv_length + 32. The next packet's hop_payloads is the 1,300-byte window of the working buffer starting at slot_size, sliding the window forward by exactly Bob's hop payload.",
  3: "Bob assembles the outgoing packet: version || E_AC (advanced via the blinding chain) || next_hop_payloads || next_hmac. The packet Charlie receives is indistinguishable from one Alice could have built directly for her.",
};

const TOTAL_BEATS = 4;

export function OnionPeelDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2200);
    return () => clearTimeout(t);
  }, [playing, step]);

  const play = () => {
    if (step >= TOTAL_BEATS - 1) setStep(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const reset = () => {
    setStep(0);
    setPlaying(false);
  };

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-peel-forward"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Bob peels his layer
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 280 }}
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: 720 }}>
            {/* Buffer label */}
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "#475569" }}
              >
                2,600-byte working buffer
              </div>
              <div
                className="text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "#475569" }}
              >
                ← inbound | working space →
              </div>
            </div>

            {/* Buffer visualization */}
            <BufferStrip step={step} />

            {/* Step legend (after step 1) */}
            {step >= 1 && (
              <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
                <LegendSwatch fill="#dbeafe" stroke="#3b6aa0" label="Bob's hop payload (decrypted)" />
                <LegendSwatch fill="#ede1f3" stroke="#7b4b8a" label="Charlie + Dave (still encrypted for them)" />
                <LegendSwatch fill="#fef3c7" stroke="#b8860b" label="Bob's keystream extension (matches Alice's filler)" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
            >
              {playing
                ? "❚❚ Pause"
                : step >= TOTAL_BEATS - 1
                  ? "↻ Replay"
                  : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_BEATS }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-xs font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "rgba(15,23,42,0.4)",
                    color: step === i ? "#fff" : "#0f172a",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_CAPTIONS[step]}
          </div>
        </div>
      </div>
    </div>
  );
}

function BufferStrip({ step }: { step: number }) {
  // Total visible width: split into 5% (Bob hop payload) + 45% (Charlie/Dave) + 50% (working/filler)
  const slotPct = 5;
  const innerPct = 45;
  const workingPct = 50;

  const showDecrypted = step >= 1;
  const showWindow = step >= 2;

  return (
    <div className="relative">
      <div
        className="flex border-[1.5px]"
        style={{
          height: 60,
          borderColor: "#0f172a",
          background: "#fffdf5",
        }}
      >
        {/* Bob's hop payload (only after decryption) */}
        {showDecrypted ? (
          <>
            <div
              className="flex items-center justify-center transition-all"
              style={{
                width: `${slotPct}%`,
                background: "#dbeafe",
                borderRight: "1.5px solid #3b6aa0",
                color: "#0f172a",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              Bob
            </div>
            <div
              className="flex items-center justify-center transition-all"
              style={{
                width: `${innerPct}%`,
                background: "#ede1f3",
                borderRight: "1.5px solid #7b4b8a",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              encrypted for Charlie + Dave
            </div>
            <div
              className="flex items-center justify-center transition-all"
              style={{
                width: `${workingPct}%`,
                background: "#fef3c7",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              rho keystream extension
            </div>
          </>
        ) : (
          <>
            <div
              className="flex items-center justify-center"
              style={{
                width: "50%",
                background: "#cbd5e1",
                borderRight: "1.5px solid #475569",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              inbound encrypted hop_payloads (1,300 B)
            </div>
            <div
              className="flex items-center justify-center"
              style={{
                width: "50%",
                background: "#f1f5f9",
                color: "#475569",
                fontSize: 11,
                fontStyle: "italic",
              }}
            >
              zero (working space, 1,300 B)
            </div>
          </>
        )}
      </div>

      {/* The 1300-byte boundary indicator */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: -8,
          width: 1,
          height: 76,
          borderLeft: "1.5px dashed #475569",
        }}
      />
      <div
        className="absolute text-[9px]"
        style={{
          left: "50%",
          top: -16,
          transform: "translateX(-50%)",
          color: "#475569",
          fontFamily: MONO,
        }}
      >
        1,300 B
      </div>

      {/* Window highlight for next packet */}
      {showWindow && (
        <>
          <div
            className="absolute pointer-events-none transition-all"
            style={{
              left: `${slotPct}%`,
              top: -3,
              width: `${innerPct + 5}%`,
              height: 66,
              border: "2.5px solid #b8860b",
              boxShadow: "0 0 0 2px rgba(184,134,11,0.18)",
            }}
          />
          <div
            className="absolute text-[10px] tracking-[0.04em]"
            style={{
              left: `${slotPct}%`,
              top: 70,
              color: "#b8860b",
              fontFamily: MONO,
              fontWeight: 700,
            }}
          >
            next packet's hop_payloads (1,300 B, shifted by Bob's hop payload)
          </div>
        </>
      )}
    </div>
  );
}

function LegendSwatch({
  fill,
  stroke,
  label,
}: {
  fill: string;
  stroke: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 14,
          height: 14,
          background: fill,
          border: `1.5px solid ${stroke}`,
        }}
      />
      <span style={{ color: "#475569", letterSpacing: "0.02em" }}>{label}</span>
    </div>
  );
}

export default OnionPeelDiagram;
