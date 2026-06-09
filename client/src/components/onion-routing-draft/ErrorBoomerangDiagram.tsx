import { useEffect, useState } from "react";
import {
  KeyDerivationCard,
  KeyHoverIcon,
  type KeyDerivationCardProps,
} from "./KeyDerivationCard";
import {
  ErrorChrome,
  ErrorPacketCard,
  ErrorRouteTrack,
  ReturnPathRail,
  SUCCESS_GREEN,
  INK,
  HOP_STROKE,
  type HopId,
} from "./errorOnionShared";

// ────────────────────────────────────────────────────────────────────────────
// ErrorBoomerangDiagram (rebuilt 2026-06-07)
//
// The error onion wraps BACKWARD. Charlie fails the payment, builds a fixed
// 292-byte error packet, and each upstream hop re-obfuscates the SAME buffer
// with its own ammag keystream until the packet reaches the sender (Alice).
// Path of the wrap: Charlie → Bob → Alice (Dave is dimmed -- it's off the
// failure path but shown for route continuity).
//
// The crypto invariant this visual teaches: the packet is FIXED SIZE. Every
// ammag layer XOR-re-obfuscates the same 292 bytes in place, so the packet
// card NEVER grows -- only the crosshatch density does (more layers = more
// crosshatch over the identical footprint). The earlier build grew the box
// taller per layer, which contradicted the "292 B fixed" caption; that bug
// is the whole reason this was rebuilt.
//
// Per-beat key disclosure follows §7: a full KeyDerivationCard on the beat a
// key is first introduced, then the compact KeyHoverIcon on later beats.
// ────────────────────────────────────────────────────────────────────────────

const TOTAL_BEATS = 5;
const STEP_MS = 2200;

const CAPTIONS: Record<number, string> = {
  0: "Charlie has decided to fail this payment with `temporary_channel_failure`. He needs to get that failure back to Alice without leaking anything to Bob on the way. The error will travel backward along the route, the mirror image of the forward onion.",
  1: "Charlie builds the unencrypted error packet: a 32-byte HMAC (computed with his `um_charlie` key over the payload) followed by the 260-byte length-prefixed payload. That's 292 bytes, and it stays 292 bytes the whole way back.",
  2: "Charlie XORs the 292-byte packet with his `ammag_charlie` keystream and sends it upstream to Bob. Notice the packet doesn't grow: encryption is an in-place XOR, so the crosshatch appears over the same bytes.",
  3: "Bob doesn't try to read what he received (he has no `ammag_charlie`). He just XORs the same 292 bytes with his own `ammag_bob`, adding a second layer. Two angles now crosshatch over the identical footprint, and he ships it to you (Alice).",
  4: "You receive 292 bytes wrapped in Bob's layer (outermost) over Charlie's (innermost). The packet never changed size. Next you'll peel the layers in route order, checking each hop's HMAC until one verifies, in the trial-decrypt visual below.",
};

// Per-beat StepCaption header label + title (the short verdict the
// IterationBanner used to carry above the visual; now in the block below it).
const STEP_LABELS: Record<number, string> = {
  0: "Charlie · DECIDE",
  1: "Charlie · BUILD",
  2: "Charlie · WRAP",
  3: "Bob · WRAP",
  4: "Alice · RECEIVE",
};
const STEP_TITLES: Record<number, string> = {
  0: "Charlie fails the payment",
  1: "Build the 292-byte error packet",
  2: "Charlie wraps with `ammag_charlie`",
  3: "Bob adds his `ammag_bob` layer",
  4: "The error reaches you, still 292 bytes",
};

// Accent color for the StepCaption block. Color-matched to the acting hop, with
// the return-path green (§2) on the beat the error lands back at the sender.
// Kept consistent with ErrorUnwrapDiagram.
function accentFor(step: number): string {
  if (step <= 2) return HOP_STROKE.charlie;
  if (step === 3) return HOP_STROKE.bob;
  return SUCCESS_GREEN; // step 4: returned to Alice (return-path framing)
}

// Which hop is holding the packet on each beat (drives the horizontal slide).
function packetHopFor(step: number): HopId {
  if (step <= 2) return "charlie";
  if (step === 3) return "bob";
  return "alice";
}

// ammag layers applied to the packet on each beat (outermost-first).
function appliedLayersFor(step: number): ("bob" | "charlie")[] {
  if (step <= 1) return [];
  if (step === 2) return ["charlie"];
  return ["bob", "charlie"];
}

const STAGE_MIN_WIDTH = 640;

export function ErrorBoomerangDiagram() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= TOTAL_BEATS - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step]);

  const onPlayPause = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= TOTAL_BEATS - 1) setStep(0);
    setPlaying(true);
  };
  const onReset = () => {
    setStep(0);
    setPlaying(false);
  };
  const onStep = (i: number) => {
    setPlaying(false);
    setStep(i);
  };

  const packetHop = packetHopFor(step);
  const appliedLayers = appliedLayersFor(step);
  const packetVisible = step >= 1;

  return (
    <ErrorChrome
      testId="onion-error-boomerang"
      title="Error onion wraps backward"
      totalBeats={TOTAL_BEATS}
      step={step}
      playing={playing}
      caption={CAPTIONS[step]}
      stepLabel={STEP_LABELS[step]}
      stepTitle={STEP_TITLES[step]}
      accentColor={accentFor(step)}
      onPlayPause={onPlayPause}
      onReset={onReset}
      onStep={onStep}
      stageMinWidth={STAGE_MIN_WIDTH}
      stageMinHeight={400}
    >
      {/* Persistent black RETURN PATH cue -- direction is unmistakable on EVERY
          beat. The active circle below shows which hop currently holds it. */}
      <div className="mb-3">
        <ReturnPathRail />
      </div>

      {/* Route track: the active circle marks who is holding the packet right
          now (Charlie -> Bob -> Alice), Charlie wears the persistent fail
          badge, Dave is dimmed. No per-hop sliding arrow -- the packet is a
          FIXED-size buffer re-obfuscated in place, so it stays centered and
          only gains crosshatch. This mirrors the unwrap visual's layout. */}
      <ErrorRouteTrack
        activeHop={packetHop}
        failingHop="charlie"
        dimmed={["dave"]}
      />

      {/* The error packet, centered. It is the SAME element on every beat from
          step 1 on (it gains hatch in place, never grows, never slides off the
          stage -- that off-stage slide was the "invisible at step 5" bug). It
          is centered with mx-auto and NO transform on the wrapper, so the
          corner KeyHoverIcon's fixed-position popover resolves against the
          viewport instead of being thrown off by a transformed containing
          block (§8 -- the dead KEYS-badge bug). */}
      <div
        className="mx-auto mt-2"
        style={{
          width: 460,
          opacity: packetVisible ? 1 : 0,
          pointerEvents: packetVisible ? "auto" : "none",
          transition: "opacity 400ms ease-out",
        }}
      >
        <ErrorPacketCard
          appliedLayers={appliedLayers}
          failingHop="charlie"
          cornerBadge={<BoomerangCornerKeys step={step} />}
        />
      </div>

      {/* Key-derivation zone below the packet. A full card on the beat a key
          is first introduced (§7); collapses to KeyHoverIcon afterward (the
          compact badges ride along on the packet's top-right corner). Sized to
          its content -- no fixed minHeight reserving dead space on the short
          beats (§10 no-dead-whitespace). */}
      <div className="mt-3">
        <BoomerangKeyZone step={step} />
      </div>
    </ErrorChrome>
  );
}

// ── Compact key badges that ride on the packet's corner (later beats) ───────

function BoomerangCornerKeys({ step }: { step: number }) {
  // Beat 3: Charlie's keys have been introduced, collapse to a hover badge
  // while Bob's full card shows below. Beat 4: both ammag keys are compact.
  if (step === 3) {
    return <CharlieAmmagIcon />;
  }
  if (step === 4) {
    return (
      <div className="flex gap-1.5">
        <BobAmmagIcon />
        <CharlieAmmagIcon />
      </div>
    );
  }
  return null;
}

// ── Key-derivation zone: full card on the introduction beat ─────────────────

function BoomerangKeyZone({ step }: { step: number }) {
  if (step === 1) {
    // First introduction: the HMAC key Charlie used to authenticate the error.
    return <UmCharlieCard active />;
  }
  if (step === 2) {
    // First introduction: Charlie's ammag encryption key.
    return <AmmagCharlieCard active />;
  }
  if (step === 3) {
    // First introduction: Bob's ammag. Charlie's already collapsed to a badge
    // on the packet corner above.
    return <AmmagBobCard active />;
  }
  if (step === 4) {
    return (
      <div
        className="mx-auto text-center"
        style={{ maxWidth: 540 }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-2 border-[1.5px]"
          style={{
            borderColor: SUCCESS_GREEN,
            background: "#fffdf5",
            color: INK,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
          }}
        >
          <span style={{ color: SUCCESS_GREEN, fontWeight: 700 }}>
            ✓ delivered
          </span>
          <span style={{ color: INK }}>
            Two ammag layers, one fixed-size packet. Hover a badge to recall
            either key.
          </span>
        </div>
      </div>
    );
  }
  // Beat 0: no key activity.
  return null;
}

// ── KeyDerivationCard / KeyHoverIcon prop bundles (single source of truth) ──
//
// Defining the card props once and reusing them for both the full card and the
// compact icon keeps the derivation identical across the two disclosure modes.

const UM_CHARLIE_PROPS: KeyDerivationCardProps = {
  title: "Charlie's HMAC key (authenticates the error)",
  source: {
    name: "ss_AC",
    subtitle: "Alice ↔ Charlie shared secret",
    accent: HOP_STROKE.charlie,
  },
  rows: [
    {
      formula: "HMAC('um', ss_AC)",
      keyName: "um_C",
      bytes: "32 bytes",
      useTitle: "Error HMAC key",
      useSubtitle: "tags the 260-byte payload",
      color: HOP_STROKE.charlie,
      active: true,
    },
  ],
};

const AMMAG_CHARLIE_PROPS: KeyDerivationCardProps = {
  title: "Charlie's encryption key (wraps the error)",
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
      useTitle: "Return-path cipher key",
      useSubtitle: "XOR keystream over 292 B",
      color: SUCCESS_GREEN,
      active: true,
    },
  ],
};

const AMMAG_BOB_PROPS: KeyDerivationCardProps = {
  title: "Bob's encryption key (wraps one more layer)",
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
      useTitle: "Return-path cipher key",
      useSubtitle: "XOR keystream over 292 B",
      color: SUCCESS_GREEN,
      active: true,
    },
  ],
};

function UmCharlieCard({ active }: { active: boolean }) {
  return (
    <KeyDerivationCard
      {...UM_CHARLIE_PROPS}
      rows={UM_CHARLIE_PROPS.rows.map((r) => ({ ...r, active }))}
    />
  );
}
function AmmagCharlieCard({ active }: { active: boolean }) {
  return (
    <KeyDerivationCard
      {...AMMAG_CHARLIE_PROPS}
      rows={AMMAG_CHARLIE_PROPS.rows.map((r) => ({ ...r, active }))}
    />
  );
}
function AmmagBobCard({ active }: { active: boolean }) {
  return (
    <KeyDerivationCard
      {...AMMAG_BOB_PROPS}
      rows={AMMAG_BOB_PROPS.rows.map((r) => ({ ...r, active }))}
    />
  );
}

function CharlieAmmagIcon() {
  return <KeyHoverIcon {...AMMAG_CHARLIE_PROPS} />;
}
function BobAmmagIcon() {
  return <KeyHoverIcon {...AMMAG_BOB_PROPS} />;
}

export default ErrorBoomerangDiagram;
