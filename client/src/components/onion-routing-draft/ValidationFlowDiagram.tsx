// ────────────────────────────────────────────────────────────────────────────
// ValidationFlowDiagram (rebuilt 2026-05-08)
//
// Strict order of operations when a forwarder processes an inbound onion.
// 6 steps with associated failure codes. Static (no animation) but each
// step has its own card with the failure mode visible.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

const STEPS = [
  {
    name: "Length & version check",
    desc: "Reject if packet ≠ 1,366 bytes or version ≠ 0x00.",
    failureCode: "invalid_onion_version",
    accent: "#b8860b",
  },
  {
    name: "HMAC verification",
    desc: "HMAC-SHA256(mu_i, hop_payloads || associated_data) == packet.hmac. Constant-time compare.",
    failureCode: "invalid_onion_hmac",
    accent: "#3b6aa0",
  },
  {
    name: "Peel layer",
    desc: "ECDH, derive rho, decrypt with extended keystream, extract hop payload.",
    failureCode: null,
    accent: "#2d7a7a",
  },
  {
    name: "Parse TLV payload",
    desc: "Walk bigsize-prefixed records. Read amt_to_forward, outgoing_cltv_value, plus short_channel_id (forwarder) or payment_data (destination).",
    failureCode: "invalid_onion_payload",
    accent: "#7b4b8a",
  },
  {
    name: "Validate fees + CLTV",
    desc: "Check incoming amount covers amt_to_forward + own fee, incoming CLTV gives ≥ delta cushion, outgoing CLTV is in the future.",
    failureCode: "fee_insufficient / expiry_too_soon",
    accent: "#a13a3a",
  },
  {
    name: "Forward or settle",
    desc: "Hand the outgoing HTLC to the channel (forwarder) or claim the inbound HTLC by revealing the preimage (destination).",
    failureCode: null,
    accent: "#5a7a2f",
  },
];

export function ValidationFlowDiagram() {
  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-validation-flow"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Forwarder processing order
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 480 }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.08em] mb-4"
          style={{ color: "#475569" }}
        >
          Each step gates the next. A failure here returns an error onion (chapter 11) without proceeding.
        </div>
        <div className="space-y-2">
          {STEPS.map((s, i) => (
            <div key={s.name} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center" style={{ width: 36 }}>
                <div
                  className="flex items-center justify-center border-[1.5px]"
                  style={{
                    width: 32,
                    height: 32,
                    background: s.accent,
                    borderColor: s.accent,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: MONO,
                  }}
                >
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 my-0.5"
                    style={{
                      width: 2,
                      background: "rgba(15,23,42,0.3)",
                      minHeight: 16,
                    }}
                  />
                )}
              </div>
              <div
                className="flex-1 pb-3 border-[1.5px] px-3 py-2"
                style={{
                  background: "#fffdf5",
                  borderColor: "rgba(15,23,42,0.25)",
                  borderLeft: `3px solid ${s.accent}`,
                }}
              >
                <div
                  className="font-bold text-sm"
                  style={{ color: "#0f172a", letterSpacing: "0.02em" }}
                >
                  {s.name}
                </div>
                <div
                  className="text-sm leading-snug mt-1"
                  style={{ color: "#0f172a" }}
                >
                  {s.desc}
                </div>
                {s.failureCode && (
                  <div
                    className="text-[11px] mt-1.5 inline-block px-1.5 py-0.5 border-[1.5px]"
                    style={{
                      fontFamily: MONO,
                      color: "#a13a3a",
                      borderColor: "#a13a3a",
                      background: "#fde7e7",
                      letterSpacing: "0.02em",
                    }}
                  >
                    on failure → {s.failureCode}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ValidationFlowDiagram;
