import { useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// OnionPeelDiagram
//
// Forward-direction visualization: shows the 2,600-byte working buffer Bob
// allocates during peel, the rho-keystream XOR, and the slot extraction.
// Used in Chapter 8.
// ────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: "1. Bob receives the packet",
    desc: "Bob copies the inbound 1,300-byte hop_payloads into the front of a 2,600-byte working buffer. The trailing 1,300 bytes are zero. Bob has no idea what's in the encrypted bytes yet.",
  },
  {
    title: "2. XOR with extended rho keystream",
    desc: "Bob generates 2,600 bytes of ChaCha20 keystream from rho_bob and XORs it onto the working buffer. The first part decrypts to Bob's TLV payload + next_hmac. The trailing portion is now Bob's keystream applied to zeros — exactly the bytes Alice precomputed in the filler so Carol's view will line up.",
  },
  {
    title: "3. Extract Bob's slot, slide the window",
    desc: "Bob reads his TLV payload off the front, learns slot_size = len(payload) + 32, and reads next_hmac. The next packet's hop_payloads is bytes [slot_size : slot_size + 1300] of the working buffer. He's effectively slid the 1,300-byte window forward by slot_size.",
  },
  {
    title: "4. Forward to Carol",
    desc: "Bob computes E_{i+1} = E_i × SHA256(E_i || ss_i), assembles version || E_{i+1} || next_hop_payloads || next_hmac, and sends it to Carol. The packet she receives looks indistinguishable from one Alice could have sent her directly.",
  },
];

export function OnionPeelDiagram() {
  const [step, setStep] = useState(0);

  // Visualize the 2600-byte working buffer at the current step.
  // - Step 0: front 1300 bytes "encrypted" (gray hatched), rest empty
  // - Step 1: front 1300 decrypted (Bob's slot at very front in blue, then encrypted-for-Carol),
  //           trailing 1300 bytes is keystream-applied-to-zero (filler-shape, light)
  // - Step 2/3: same buffer, with a window highlighted around the next 1300 bytes after Bob's slot

  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-peel-forward"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        Bob peels his layer
      </div>

      {/* Buffer visualization */}
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 720 160"
          className="w-full max-w-4xl mx-auto"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {/* Buffer outline */}
          <rect x={20} y={50} width={680} height={50} fill="none" stroke="#0f172a" strokeWidth={2} />
          {/* 1300-byte boundary line */}
          <line x1={360} y1={50} x2={360} y2={100} stroke="#0f172a" strokeWidth={1.5} strokeDasharray="3 3" />
          <text x={360} y={45} textAnchor="middle" fontSize={9} fill="#475569">
            1,300 byte boundary
          </text>

          {/* Step 0: front half encrypted (#cbd5e1), back half empty */}
          {step === 0 && (
            <>
              <rect x={20} y={51} width={340} height={48} fill="#cbd5e1" />
              <text x={190} y={80} textAnchor="middle" fontSize={11} fill="#0f172a">
                inbound encrypted hop_payloads
              </text>
              <rect x={360} y={51} width={340} height={48} fill="#f1f5f9" />
              <text x={530} y={80} textAnchor="middle" fontSize={11} fill="#475569" fontStyle="italic">
                zero (working space)
              </text>
            </>
          )}

          {/* Step 1: full decrypted view */}
          {step >= 1 && (
            <>
              {/* Bob's slot */}
              <rect x={20} y={51} width={45} height={48} fill="#bfdbfe" stroke="#2563eb" strokeWidth={1.5} />
              <text x={42} y={80} textAnchor="middle" fontSize={9} fill="#0f172a">
                bob slot
              </text>
              {/* Carol+Dave encrypted view */}
              <rect x={65} y={51} width={295} height={48} fill="#ddd6fe" />
              <text x={213} y={80} textAnchor="middle" fontSize={11} fill="#0f172a">
                encrypted for Carol → Dave
              </text>
              {/* Trailing keystream-extended portion */}
              <rect x={360} y={51} width={340} height={48} fill="#fef3c7" />
              <text x={530} y={80} textAnchor="middle" fontSize={11} fill="#0f172a">
                rho-keystream extension (matches Alice's filler)
              </text>
            </>
          )}

          {/* Step 2/3: highlight window for next packet */}
          {step >= 2 && (
            <>
              <rect
                x={65}
                y={48}
                width={340}
                height={54}
                fill="none"
                stroke="#dc2626"
                strokeWidth={3}
              />
              <text x={235} y={120} textAnchor="middle" fontSize={11} fill="#dc2626" fontWeight={600}>
                next packet's hop_payloads (1,300 bytes)
              </text>
            </>
          )}

          {/* Step 3: ephemeral pubkey advance */}
          {step >= 3 && (
            <>
              <text x={350} y={140} textAnchor="middle" fontSize={11} fill="#16a34a" fontWeight={600}>
                + advance E_i → E_{"{i+1}"} via blinding
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Step controls */}
      <div className="mt-4 flex flex-col md:flex-row md:items-start md:gap-4">
        <div className="flex gap-1.5 flex-wrap">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`px-3 py-1.5 border-2 font-pixel text-xs transition-colors ${
                step >= i
                  ? "bg-primary text-foreground border-border"
                  : "bg-card text-foreground/50 border-border hover:bg-secondary"
              }`}
              data-testid={`onion-peel-step-${i}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1">
          <div className="font-semibold mb-1">{STEPS[step].title}</div>
          <div>{STEPS[step].desc}</div>
        </div>
      </div>
    </div>
  );
}

export default OnionPeelDiagram;
