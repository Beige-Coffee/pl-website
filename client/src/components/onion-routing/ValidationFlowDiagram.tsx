// ────────────────────────────────────────────────────────────────────────────
// ValidationFlowDiagram
//
// Shows the strict order of operations when a forwarder processes an inbound
// onion: length/version → HMAC → peel → parse → validate → forward or fail.
// Used in Chapter 9.
// ────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    name: "1. Length & version",
    desc: "Reject if the packet isn't 1,366 bytes or version != 0x00.",
    failureCode: "invalid_onion_version",
  },
  {
    name: "2. HMAC verify",
    desc: "HMAC-SHA256(mu_i, hop_payloads) == packet.hmac. Constant-time compare.",
    failureCode: "invalid_onion_hmac",
  },
  {
    name: "3. Peel layer",
    desc: "Decrypt with extended rho keystream, extract slot, advance E.",
    failureCode: "(no failure here — peel is mechanical)",
  },
  {
    name: "4. Parse TLV",
    desc: "Read amt_to_forward, outgoing_cltv, short_channel_id (or payment_data).",
    failureCode: "invalid_onion_payload",
  },
  {
    name: "5. Validate",
    desc: "Check fee math, CLTV cushion, downstream channel availability.",
    failureCode: "fee_insufficient / temporary_channel_failure / etc.",
  },
  {
    name: "6. Forward or settle",
    desc: "Hand to the channel (forwarder) or claim the HTLC (destination).",
    failureCode: null,
  },
];

export function ValidationFlowDiagram() {
  return (
    <div
      className="my-8 border-2 border-border bg-card p-4 md:p-6"
      data-testid="onion-validation-flow"
    >
      <div className="text-xs uppercase tracking-wider opacity-70 font-pixel mb-3">
        The forwarder's processing order
      </div>

      <div className="space-y-2">
        {STEPS.map((s, i) => (
          <div key={s.name} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold bg-primary border-border text-foreground"
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-0.5 flex-1 my-1 bg-foreground/40" />
              )}
            </div>
            <div className="flex-1 pb-3">
              <div className="font-semibold text-sm">{s.name.replace(/^\d+\.\s*/, "")}</div>
              <div className="text-sm opacity-80 leading-snug">{s.desc}</div>
              {s.failureCode && (
                <div className="text-xs mt-1 font-mono text-red-700 dark:text-red-400">
                  on failure → {s.failureCode}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ValidationFlowDiagram;
