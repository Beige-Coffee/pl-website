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
  ERROR_RED,
  INK,
  MONO,
  NODE_X_PCT,
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

// Backward hop-to-hop arrow shown on the travelling beats.
function arrowFor(step: number): { from: HopId; to: HopId } | null {
  if (step === 2) return { from: "charlie", to: "bob" };
  if (step === 3) return { from: "bob", to: "alice" };
  return null;
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
  const arrow = arrowFor(step);
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
      stageMinHeight={430}
    >
      {/* Persistent leftward RETURN PATH rail -- direction is unmistakable on
          EVERY beat, not only the two with a hop-to-hop arrow. */}
      <div className="mb-2">
        <ReturnPathRail />
      </div>

      {/* Route track + the travelling packet share one positioned canvas so
          the packet can slide horizontally to whichever hop holds it. */}
      <div className="relative" style={{ minHeight: 200 }}>
        <ErrorRouteTrack
          activeHop={packetHop}
          failingHop="charlie"
          dimmed={["dave"]}
        />

        {/* Backward hop-to-hop arrow on the travelling beats. */}
        {arrow && <BackwardArrow from={arrow.from} to={arrow.to} />}

        {/* The packet. Persistent element (mounted from step 0) so it slides
            and gains hatch in place rather than popping per beat. */}
        <div
          className="absolute"
          style={{
            top: 104,
            left: `${NODE_X_PCT[packetHop]}%`,
            transform: "translateX(-50%)",
            width: 460,
            transition: "left 700ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease-out",
            opacity: packetVisible ? 1 : 0,
            pointerEvents: packetVisible ? "auto" : "none",
          }}
        >
          <ErrorPacketCard
            appliedLayers={appliedLayers}
            failingHop="charlie"
            cornerSlot={<BoomerangCornerKeys step={step} />}
          />
        </div>
      </div>

      {/* Key-derivation zone below the packet. A full card on the beat a key
          is first introduced (§7); collapses to KeyHoverIcon afterward (the
          compact badges ride along on the packet's top-right corner). */}
      <div className="mt-3" style={{ minHeight: 156 }}>
        <BoomerangKeyZone step={step} />
      </div>
    </ErrorChrome>
  );
}

// ── Backward arrow between two hops on the track ────────────────────────────

function BackwardArrow({ from, to }: { from: HopId; to: HopId }) {
  // Arrow drawn between the two circle centers (the track sits at top ~40px).
  const x1 = NODE_X_PCT[from];
  const x2 = NODE_X_PCT[to];
  const markerId = `boomerang-arrow-${from}-${to}`;
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: 84 }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ERROR_RED} />
        </marker>
      </defs>
      <line
        x1={`calc(${x1}% - 26px)`}
        y1={40}
        x2={`calc(${x2}% + 26px)`}
        y2={40}
        stroke={ERROR_RED}
        strokeWidth={2}
        markerEnd={`url(#${markerId})`}
        style={{ transition: "all 600ms ease-in-out" }}
      />
      <text
        x={`${(x1 + x2) / 2}%`}
        y={30}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={ERROR_RED}
        fontFamily={MONO}
        style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
      >
        error
      </text>
    </svg>
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
