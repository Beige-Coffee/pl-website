import { MONO, SANS, INK } from "./WrapTraceDiagram";
import { Tooltip } from "./Tooltip";

// ────────────────────────────────────────────────────────────────────────────
// FailureReasonsDiagram  (tag: <failure-reasons>)
//
// Static reference for chapter 11's "What kind of failure is it?" section. The
// failure_code's top byte is a set of flags; this lays out the four flags with
// canonical BOLT-4 example codes, and a callout that the flags COMBINE (the key
// point a four-exclusive-buckets diagram gets wrong). All names + flag
// compositions verified against BOLT 4.
// ────────────────────────────────────────────────────────────────────────────

const FLAGS: { hex: string; name: string; meaning: string; codes: string[] }[] = [
  {
    hex: "0x8000",
    name: "BADONION",
    meaning: "the onion itself was unreadable",
    codes: ["invalid_onion_version", "invalid_onion_hmac", "invalid_onion_key"],
  },
  {
    hex: "0x4000",
    name: "PERM",
    meaning: "permanent, don't retry this hop",
    codes: ["permanent_channel_failure", "unknown_next_peer", "incorrect_or_unknown_payment_details"],
  },
  {
    hex: "0x2000",
    name: "NODE",
    meaning: "the whole node, not one channel",
    codes: ["temporary_node_failure"],
  },
  {
    hex: "0x1000",
    name: "UPDATE",
    meaning: "a forwarding parameter was violated",
    codes: ["fee_insufficient", "incorrect_cltv_expiry", "amount_below_minimum"],
  },
];

// Per-code detail shown on hover. hex + flag composition + a plain-English gloss,
// all verified against the BOLT 4 failure-message table.
const CODE_DETAILS: Record<string, { hex: string; flags: string; desc: string }> = {
  invalid_onion_version: {
    hex: "0xC004",
    flags: "BADONION + PERM",
    desc: "The onion's version byte wasn't 0x00, so the hop can't process it.",
  },
  invalid_onion_hmac: {
    hex: "0xC005",
    flags: "BADONION + PERM",
    desc: "The onion's HMAC didn't verify: the bytes were tampered with, or the onion was re-attached to a different payment.",
  },
  invalid_onion_key: {
    hex: "0xC006",
    flags: "BADONION + PERM",
    desc: "The onion's ephemeral key was unusable, so the hop couldn't perform the ECDH to recover its shared secret.",
  },
  permanent_channel_failure: {
    hex: "0x4008",
    flags: "PERM",
    desc: "This channel can no longer forward (for example, it's closing). Don't route through it again.",
  },
  unknown_next_peer: {
    hex: "0x400A",
    flags: "PERM",
    desc: "The forwarder has no channel to the next hop the onion names, usually a stale route. Pick a different path.",
  },
  incorrect_or_unknown_payment_details: {
    hex: "0x400F",
    flags: "PERM",
    desc: "The destination's deliberately vague reply when the payment hash, secret, or amount doesn't match. Vague on purpose, so probers learn nothing.",
  },
  temporary_node_failure: {
    hex: "0x2002",
    flags: "NODE",
    desc: "The node can't forward right now, but the problem is transient, so the sender can try it again later.",
  },
  fee_insufficient: {
    hex: "0x100C",
    flags: "UPDATE",
    desc: "The fee paid (the incoming amount minus what's forwarded) is below what the hop advertises in its channel update.",
  },
  incorrect_cltv_expiry: {
    hex: "0x100D",
    flags: "UPDATE",
    desc: "The outgoing timelock doesn't clear the hop's required CLTV delta cushion.",
  },
  amount_below_minimum: {
    hex: "0x100B",
    flags: "UPDATE",
    desc: "The forwarded amount is below the channel's minimum HTLC size.",
  },
};

// The course wraps content in .noise-md-dark, whose layered
// "span/strong/em { color: ... !important }" repaints our colored text grey in
// dark mode (invisible on the cream cards / gold callout). Re-assert each
// element's own inline color with !important (inline beats a layered !important)
// so the diagram keeps its palette in both themes. See
// reference-noise-md-important-cascade.
function forceInlineColors(root: HTMLDivElement | null) {
  if (!root) return;
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const c = el.style.color;
    if (c) el.style.setProperty("color", c, "important");
  });
}

// Hover-popover body for one failure code. Rendered in a portal (document.body),
// so it is OUTSIDE .noise-md-dark and its colors are not force-recolored.
function CodeDetail({ code }: { code: string }) {
  const d = CODE_DETAILS[code];
  if (!d) return <span style={{ color: INK }}>{code}</span>;
  return (
    <div style={{ fontFamily: SANS }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 5,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: INK }}>{code}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#475569", flexShrink: 0 }}>{d.hex}</span>
      </div>
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#b8860b",
            border: "1px solid rgba(184,134,11,0.4)",
            borderRadius: 3,
            padding: "1px 5px",
          }}
        >
          {d.flags}
        </span>
      </div>
      <div style={{ fontSize: 12, color: INK, lineHeight: 1.5 }}>{d.desc}</div>
    </div>
  );
}

function FlagCard({ hex, name, meaning, codes }: (typeof FLAGS)[number]) {
  return (
    <div className="border-[1.5px] overflow-hidden" style={{ borderColor: INK, background: "#fffdf5" }}>
      <div className="px-3 py-1.5" style={{ background: INK }}>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px]" style={{ fontFamily: MONO, color: "#cbd5e1", fontWeight: 700 }}>
            {hex}
          </span>
          <span
            className="text-[12px]"
            style={{ fontFamily: MONO, color: "#ffffff", fontWeight: 700, letterSpacing: "0.04em" }}
          >
            {name}
          </span>
        </div>
        <div className="text-[10px]" style={{ fontFamily: SANS, color: "#cbd5e1", marginTop: 1 }}>
          {meaning}
        </div>
      </div>
      <div className="px-3 py-2 flex flex-wrap gap-1.5">
        {codes.map((c) => (
          <Tooltip key={c} width={300} label={<CodeDetail code={c} />}>
            <span
              className="text-[10.5px] border-[1.5px] inline-flex items-center gap-1"
              style={{
                fontFamily: MONO,
                color: INK,
                background: "rgba(15,23,42,0.04)",
                borderColor: "rgba(15,23,42,0.16)",
                padding: "1px 6px",
                cursor: "help",
              }}
            >
              {c}
              <span
                aria-hidden="true"
                style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}
              >
                ⓘ
              </span>
            </span>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function FailureReasonsDiagram() {
  return (
    <div
      ref={forceInlineColors}
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-failure-reasons"
      style={{ fontFamily: SANS }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">Failure reasons</span>
      </div>

      <div className="bg-[#fefdfb] px-4 py-6 overflow-x-auto">
        <div style={{ minWidth: 560 }}>
          <div className="grid grid-cols-2 gap-3">
            {FLAGS.map((f) => (
              <FlagCard key={f.name} {...f} />
            ))}
          </div>

          <div
            className="mt-3 border-[1.5px] px-3 py-2"
            style={{ borderColor: "#b8860b", background: "#fef3c7", borderLeft: "3px solid #b8860b" }}
          >
            <div className="text-[12px]" style={{ fontFamily: SANS, color: INK, lineHeight: 1.5 }}>
              <strong style={{ color: INK }}>These are flags, and they combine.</strong> A failure code
              is two bytes: the top byte is this set of flags, the low byte names the specific failure,
              and a single code can set several flags at once. For example,{" "}
              <span style={{ fontFamily: MONO, color: INK }}>invalid_onion_version</span> is{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK }}>BADONION</span> +{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK }}>PERM</span>, and{" "}
              <span style={{ fontFamily: MONO, color: INK }}>permanent_node_failure</span> is{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK }}>PERM</span> +{" "}
              <span style={{ fontFamily: MONO, fontWeight: 700, color: INK }}>NODE</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FailureReasonsDiagram;
