import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MathLine } from "./mathTokens";
import { MorphBox } from "./morph";
import {
  KeyHoverIcon,
  type KeyDerivationCardProps,
} from "./KeyDerivationCard";
import {
  ErrorChrome,
  ErrorPacketCard,
  ErrorRouteTrack,
  ErrorXorStack,
  ReturnPathRail,
  FOCUS_GOLD,
  SUCCESS_GREEN,
  ERROR_RED,
  NEUTRAL_TEXT,
  INK,
  MONO,
  SANS,
  HOP_STROKE,
  HOP_LABEL,
  type HopId,
} from "./errorOnionShared";

// ────────────────────────────────────────────────────────────────────────────
// ErrorUnwrapDiagram (rebuilt 2026-06-07)
//
// The sender (Alice) trial-decrypts the returned error in ROUTE ORDER. She
// peels one obfuscation layer per hop and checks the HMAC until one matches.
// Because Bob wrapped last, his layer is outermost, so Alice tries Bob first
// (i=0), then Charlie (i=1, the failing hop whose um HMAC verifies).
//
// One ErrorPacketCard sits near Alice and starts FULLY crosshatched (Bob over
// Charlie). Each beat peels one hatch via XOR -- the card loses a layer but
// keeps its 292-byte footprint (the fixed-size invariant, same as the
// boomerang visual). The ✓/✗ verdict lands on the node circles, not on
// separate equal-weight rows. The dense XOR/HMAC formula shows only for the
// ACTIVE hop (§: declutter), and keys disclose via the compact KeyHoverIcon
// because they were introduced earlier in the chapter (§7).
//
// This replaces the old build's redundant LayerStack card + iteration rows
// (two systems showing the same thing) and the formula blasted on every row.
// ────────────────────────────────────────────────────────────────────────────

const TOTAL_BEATS = 4;

const CAPTIONS: Record<number, string> = {
  0: "So, 292 bytes of encrypted data just came back on the return HTLC. Which hop failed? Alice doesn't know yet. She'll find out by trial-decrypting layer by layer, in the same order the hops wrapped on the way back.",
  1: "Iteration `i=0`: Alice tries Bob first, since his layer is outermost. She XORs with `ammag_B`, then checks `HMAC(um_B, peeled[32:])` against `peeled[:32]`. No match. Bob isn't the failing hop, so his `um` can't authenticate this error. She keeps peeling...",
  2: "Iteration `i=1`: now Alice tries Charlie. She XORs with `ammag_C`, then checks `HMAC(um_C, peeled[32:])`. It matches. Charlie made this error, and the packet is fully decrypted now.",
  3: "Finally, Alice parses the payload. The leading 32 bytes are the HMAC she just verified. The next two bytes (a u16 at offset 32) give `failure_len`, and the following `failure_len` bytes are the failure message itself. Now Alice knows *which* hop failed and why, so she can retry on a different route or surface it to her wallet.",
};

// Per-beat StepCaption header label + title (the short verdict that used to sit
// in the footer caption; now in the block below the visual).
const STEP_LABELS: Record<number, string> = {
  0: "Alice · RECEIVE",
  1: "Try i=0 · BOB",
  2: "Try i=1 · CHARLIE",
  3: "Decoded · PARSE",
};
const STEP_TITLES: Record<number, string> = {
  0: "292 encrypted bytes return to Alice",
  1: "Bob's HMAC fails",
  2: "Charlie's HMAC matches",
  3: "Read the failure message",
};

// Accent color for the StepCaption block. Return-path green (§2) frames the
// arrival and the decoded payoff; the trial beats take the hop being tried.
// Kept consistent with ErrorBoomerangDiagram.
function accentFor(step: number): string {
  if (step === 1) return HOP_STROKE.bob;
  if (step === 2) return HOP_STROKE.charlie;
  return SUCCESS_GREEN; // step 0 (arrival) + step 3 (decoded) framing
}

// ammag layers still ON the packet at each beat (outermost-first). Peeling
// removes the outermost layer each step.
function layersFor(step: number): ("bob" | "charlie")[] {
  if (step === 0) return ["bob", "charlie"];
  if (step === 1) return ["charlie"]; // Bob's layer peeled
  return []; // Charlie's layer peeled too -- plaintext
}

// Which hop Alice is currently trial-decrypting.
function activeHopFor(step: number): HopId | null {
  if (step === 1) return "bob";
  if (step === 2 || step === 3) return "charlie";
  return null;
}

// Cumulative verdicts on the node circles.
function verdictsFor(step: number): Partial<Record<HopId, "match" | "fail">> {
  if (step >= 2) return { bob: "fail", charlie: "match" };
  if (step === 1) return { bob: "fail" };
  return {};
}

const STAGE_MIN_WIDTH = 640;

export function ErrorUnwrapDiagram() {
  const [step, setStep] = useState(0);

  const onReset = () => {
    setStep(0);
  };
  const onStep = (i: number) => {
    setStep(i);
  };

  const layers = layersFor(step);
  const activeHop = activeHopFor(step);
  const verdicts = verdictsFor(step);

  return (
    <ErrorChrome
      testId="onion-error-unwrap"
      title="Alice peels the error"
      totalBeats={TOTAL_BEATS}
      step={step}
      caption={CAPTIONS[step]}
      stepLabel={STEP_LABELS[step]}
      stepTitle={STEP_TITLES[step]}
      accentColor={accentFor(step)}
      onReset={onReset}
      onStep={onStep}
      stageMinWidth={STAGE_MIN_WIDTH}
      stageMinHeight={step === 0 ? 0 : 420}
    >
      {/* The return arrived; the same leftward rail anchors this as the
          continuation of the boomerang. */}
      <div className="mb-2">
        <ReturnPathRail />
      </div>

      {/* Route track -- the trial-decrypt loop IS a walk along the route. The
          active hop highlights; the ✓/✗ verdicts land on the circles. */}
      <ErrorRouteTrack activeHop={activeHop} verdicts={verdicts} />

      {/* One packet, peeled in place. Arrival (0) and the decoded payoff (3)
          show the full card; the two trial beats (1, 2) show the canonical
          three-bar XOR stack so the peel is explicit: packet ⊕ that hop's
          ammag keystream = same 292 bytes, one crosshatch angle removed. The
          corner badge is the compact KeyHoverIcon for the hop being tried. */}
      {(step === 0 || step === 3) && (
        <div className="mt-1">
          <ErrorPacketCard
            appliedLayers={layers}
            failingHop="charlie"
            cornerBadge={<ActiveKeyIcon step={step} />}
            footnote={
              step === 0
                ? "fully wrapped: Bob's layer over Charlie's"
                : "all layers peeled, payload is readable"
            }
          />
        </div>
      )}
      {step === 1 && (
        <div className="mt-1">
          <ErrorXorStack
            wrapHop="bob"
            beforeLayers={["bob", "charlie"]}
            afterLayers={["charlie"]}
            beforeLabel="as received · 2 layers"
            afterLabel="bob's layer off · charlie's remains"
            cornerBadge={<ActiveKeyIcon step={step} />}
          />
        </div>
      )}
      {step === 2 && (
        <div className="mt-1">
          <ErrorXorStack
            wrapHop="charlie"
            beforeLayers={["charlie"]}
            afterLayers={[]}
            beforeLabel="after bob's peel · 1 layer"
            afterLabel="fully peeled · plaintext · still 292 B"
            cornerBadge={<ActiveKeyIcon step={step} />}
          />
        </div>
      )}

      {/* Active-hop operation zone: the XOR + HMAC check formula shows ONLY
          for the hop Alice is currently trying. On the final beat this zone
          gives way to the Decoded payoff panel. */}
      <div className="mt-4" style={{ minHeight: step === 0 ? 0 : 96 }}>
        {step === 1 || step === 2 ? (
          <ActiveCheck hop={activeHop === "bob" ? "bob" : "charlie"} />
        ) : null}

        <AnimatePresence initial={false}>
          {step === 3 && (
            <MorphBox
              key="decoded"
              className="mx-auto border-[1.5px] p-3 overflow-hidden"
              initial={{ opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -4 }}
              style={{
                background: "#fef3c7",
                borderColor: FOCUS_GOLD,
                maxWidth: 520,
              }}
            >
              <div
                className="text-sm font-bold mb-1.5 flex items-center gap-2"
                style={{ color: INK, fontFamily: SANS }}
              >
                <span
                  style={{
                    color: SUCCESS_GREEN,
                    fontWeight: 900,
                    fontSize: 15,
                  }}
                >
                  ✓
                </span>
                Decoded
              </div>
              <div className="flex flex-col gap-1">
                <MathLine
                  text="failing_hop = i=1 (Charlie)"
                  color={INK}
                  fontSize={12}
                  weight={700}
                />
                <MathLine
                  text="failure_code = 0x1007 (temporary_channel_failure)"
                  color={INK}
                  fontSize={12}
                  weight={700}
                />
                <MathLine
                  text="failure_data = channel_update bytes"
                  color={INK}
                  fontSize={12}
                  weight={700}
                />
              </div>
            </MorphBox>
          )}
        </AnimatePresence>
      </div>
    </ErrorChrome>
  );
}

// ── Active-hop check: XOR + HMAC formula, shown only for the active hop ──────

function ActiveCheck({ hop }: { hop: "bob" | "charlie" }) {
  const matched = hop === "charlie";
  const accent = HOP_STROKE[hop];
  const sub = hop.charAt(0); // B / C for the math subscripts
  return (
    <div
      className="mx-auto border-[1.5px] px-3 py-2.5"
      style={{
        maxWidth: 520,
        borderColor: matched ? SUCCESS_GREEN : accent,
        background: "#fffdf5",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="uppercase tracking-[0.08em]"
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            fontWeight: 700,
            color: accent,
          }}
        >
          trying {HOP_LABEL[hop]}'s keys
        </span>
        <span
          className="px-2 py-0.5 border-[1.5px] uppercase tracking-[0.04em]"
          style={{
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: 700,
            background: matched ? SUCCESS_GREEN : "#fde7e7",
            borderColor: matched ? SUCCESS_GREEN : ERROR_RED,
            color: matched ? "#fff" : ERROR_RED,
          }}
        >
          {matched ? "✓ HMAC matches" : "✗ HMAC fails"}
        </span>
      </div>
      {/* The XOR itself is shown in the stack above; this box carries only
          the authenticity question that decides the verdict. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <MathLine
          text={`HMAC(um_${sub}, peeled[32:]) ?= peeled[:32]`}
          color={matched ? SUCCESS_GREEN : NEUTRAL_TEXT}
          fontSize={11.5}
          weight={600}
        />
      </div>
    </div>
  );
}

// ── Compact key reminder for the active hop (KeyHoverIcon, §7) ───────────────
//
// The per-hop keys were introduced earlier in the chapter (and in the
// boomerang visual), so here we use the compact badge -- hover to recall the
// full derivation -- rather than a full card. Each hop's badge surfaces BOTH
// keys Alice needs at that step: ammag (to peel) and um (to check).

function ActiveKeyIcon({ step }: { step: number }) {
  if (step === 1) return <KeyHoverIcon {...BOB_KEYS_PROPS} />;
  if (step === 2 || step === 3) return <KeyHoverIcon {...CHARLIE_KEYS_PROPS} />;
  return null;
}

const BOB_KEYS_PROPS: KeyDerivationCardProps = {
  title: "Bob's return-path keys (peel + check)",
  source: {
    name: "ss_AB",
    subtitle: "Alice ↔ Bob shared secret",
    accent: HOP_STROKE.bob,
  },
  rows: [
    {
      formula: "HMAC('ammag', ss_AB)",
      keyName: "ammag_B",
      bytes: "32 bytes",
      useTitle: "Peels Bob's layer",
      useSubtitle: "XOR keystream",
      color: SUCCESS_GREEN,
      active: true,
    },
    {
      formula: "HMAC('um', ss_AB)",
      keyName: "um_B",
      bytes: "32 bytes",
      useTitle: "Checks the HMAC",
      useSubtitle: "no match here",
      color: HOP_STROKE.bob,
      active: true,
    },
  ],
};

const CHARLIE_KEYS_PROPS: KeyDerivationCardProps = {
  title: "Charlie's return-path keys (peel + check)",
  source: {
    name: "ss_AC",
    subtitle: "Alice ↔ Charlie shared secret",
    accent: HOP_STROKE.charlie,
  },
  rows: [
    {
      formula: "HMAC('ammag', ss_AC)",
      keyName: "ammag_C",
      bytes: "32 bytes",
      useTitle: "Peels Charlie's layer",
      useSubtitle: "XOR keystream",
      color: SUCCESS_GREEN,
      active: true,
    },
    {
      formula: "HMAC('um', ss_AC)",
      keyName: "um_C",
      bytes: "32 bytes",
      useTitle: "Checks the HMAC",
      useSubtitle: "matches: failing hop",
      color: HOP_STROKE.charlie,
      active: true,
    },
  ],
};

export default ErrorUnwrapDiagram;
