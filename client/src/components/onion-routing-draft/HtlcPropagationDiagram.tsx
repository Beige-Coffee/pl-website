import { useEffect, useRef, useState } from "react";
import {
  CommitmentTxCard,
  type CommitmentOutput,
} from "./CommitmentTxCard";

// ────────────────────────────────────────────────────────────────────────────
// HtlcPropagationDiagram (DRAFT)
//
// A path is a sequence of channels; each channel is a *pair* of asymmetric
// commitment transactions. This visual zooms in on the Alice → Bob → Charlie →
// Dave path and animates an HTLC payment locking forward across the route and
// then settling backward as the preimage propagates D → C → B → A.
//
// Educational targets:
//   1. A channel is a pair of commitment txs (one per party).
//   2. Forwarders (Bob, Charlie) hold double the state.
//   3. Settlement is atomic: the preimage flows back the same path it came in.
//
// Channel ledger arithmetic (verified):
//
//   Channel A↔B (cap 1,000,000):
//     start  Alice 600,000 / Bob     400,000
//     HTLC   10,002 sat from Alice → Bob
//     end    Alice 589,998 / Bob     410,002        sum = 1,000,000 ✓
//
//   Channel B↔C (cap   500,000):
//     start  Bob   250,000 / Charlie 250,000
//     HTLC   10,002 sat from Bob → Charlie
//     end    Bob   239,998 / Charlie 260,002        sum =   500,000 ✓
//
//   Channel C↔D (cap   300,000):
//     start  Charlie 200,000 / Dave  100,000
//     HTLC   10,000 sat from Charlie → Dave
//     end    Charlie 190,000 / Dave  110,000        sum =   300,000 ✓
//
//   Net per party:
//     Alice   = -10,002                              (sender)
//     Bob     = +10,002 - 10,002 =  0 sat            (Bob's fee = 0)
//     Charlie = +10,002 - 10,000 = +2 sat            (Charlie's fee = 2)
//     Dave    = +10,000                              (receives)
//
// Visual style follows the Noise capstone:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - JetBrains Mono on hex/protocol values; sans-serif elsewhere.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

// Canonical hop palette — shared with ForwarderPolicyMap, ComputedRouteDiagram,
// RouteCalcExercise, and the chapter 1 visuals. Used to color-code each
// commitment-tx output row by the party whose balance it represents.
const HOP_PALETTE: Record<HopId, { stroke: string; fill: string }> = {
  alice: { stroke: "#b8860b", fill: "#fef3c7" },
  bob: { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3" },
};
type ChannelId = "ab" | "bc" | "cd";

const NODE_X_PCT: Record<HopId, number> = {
  alice: 20,
  bob: 40,
  charlie: 60,
  dave: 80,
};

const TOTAL_BEATS = 9;

const PAYMENT_HASH = "0xa3f1...e9c4";

const STEP_CAPTIONS: Record<number, string> = {
  0: "Three channels along the path, each anchored by its own pair of commitment transactions. Bob and Charlie each hold two, one for each channel they sit between. Click play to watch a 10,000-sat payment travel from Alice to Dave.",
  1: "Alice and Bob each add a new HTLC output to their commitments. The output is locked to payment_hash 0xa3f1...e9c4 and times out at block 240. Until the preimage shows up, that 10,002 sat is in limbo.",
  2: "Bob extends the same conditional payment to Charlie. Bob and Charlie now each carry an HTLC output on their B↔C commitments, with a tighter CLTV of 220 (Bob's safety margin so he can resolve A↔B before C↔D times out).",
  3: "Charlie extends the chain to Dave with a CLTV of 180 and an amount of 10,000 sat. The two-sat difference is Charlie's forwarding fee. The HTLC is now committed on every channel along the path.",
  4: "Dave is the only one who knows the preimage, because he generated it for the invoice. Nothing on chain has happened yet, but he holds the key that unlocks every HTLC on the route.",
  5: "Dave reveals the preimage to Charlie. The Charlie-Dave HTLC outputs dissolve and 10,000 sats flow into Dave's to_local. Atomic settlement, hop one of three.",
  6: "Charlie passes the preimage back to Bob. The B↔C HTLC outputs dissolve and 10,002 sats migrate into Charlie's to_local on B↔C. Charlie has now collected his two-sat fee.",
  7: "Bob hands the preimage back to Alice. The A↔B HTLC outputs dissolve and 10,002 sats land in Bob's to_local. Bob is back to even (zero fee), and the payment has fully cleared.",
  8: "Settled state. Alice is down 10,002. Charlie is up 2 (his fee). Bob is flat. Dave is up 10,000. The same preimage that Dave revealed travelled all the way back along the path. Atomic, off-chain, in seconds.",
};

// ── Channel definitions with starting & ending balances ────────────────────

interface ChannelDef {
  id: ChannelId;
  fundingTxid: string;
  capacity: number;
  leftId: HopId;
  rightId: HopId;
  leftLabel: string;        // e.g., "Alice"
  rightLabel: string;       // e.g., "Bob"
  // Per-party balances at beats 0 and 8 in this channel
  startLeft: number;
  startRight: number;
  endLeft: number;
  endRight: number;
  // HTLC for this channel (sender = left, recipient = right)
  htlcAmount: number;
  htlcCltv: number;
}

const CHANNELS: ChannelDef[] = [
  {
    id: "ab",
    fundingTxid: "AliceBobFunding1",
    capacity: 1_000_000,
    leftId: "alice",
    rightId: "bob",
    leftLabel: "Alice",
    rightLabel: "Bob",
    startLeft: 600_000,
    startRight: 400_000,
    endLeft: 589_998,
    endRight: 410_002,
    htlcAmount: 10_002,
    htlcCltv: 240,
  },
  {
    id: "bc",
    fundingTxid: "BobCharlieFunding1",
    capacity: 500_000,
    leftId: "bob",
    rightId: "charlie",
    leftLabel: "Bob",
    rightLabel: "Charlie",
    startLeft: 250_000,
    startRight: 250_000,
    endLeft: 239_998,
    endRight: 260_002,
    htlcAmount: 10_002,
    htlcCltv: 220,
  },
  {
    id: "cd",
    fundingTxid: "CharlieDaveFunding1",
    capacity: 300_000,
    leftId: "charlie",
    rightId: "dave",
    leftLabel: "Charlie",
    rightLabel: "Dave",
    startLeft: 200_000,
    startRight: 100_000,
    endLeft: 190_000,
    endRight: 110_000,
    htlcAmount: 10_000,
    htlcCltv: 180,
  },
];

// Beat → which channel is "active" (drives highlight on cards + nodes)
function activeChannelAt(beat: number): ChannelId | null {
  switch (beat) {
    case 1: return "ab";
    case 2: return "bc";
    case 3: return "cd";
    case 5: return "cd";
    case 6: return "bc";
    case 7: return "ab";
    default: return null;
  }
}

// Forward beats commit a new HTLC on a channel; settle beats dissolve it.
// Beat 4 is "Dave received" pause, beats 0 and 8 are steady states.
function htlcStateAt(beat: number, ch: ChannelId): "absent" | "in-flight" | "settled" {
  // Each channel has its own commit beat and settle beat:
  //   ab: commit 1, settle 7
  //   bc: commit 2, settle 6
  //   cd: commit 3, settle 5
  const commitBeat: Record<ChannelId, number> = { ab: 1, bc: 2, cd: 3 };
  const settleBeat: Record<ChannelId, number> = { ab: 7, bc: 6, cd: 5 };
  if (beat < commitBeat[ch]) return "absent";
  if (beat >= settleBeat[ch]) return "settled";
  return "in-flight";
}

// to_local amount for a given party on a given channel at a given beat.
// While an HTLC is in flight, the offered amount is deducted from the
// OFFERER's to_local (the offerer is always the left party in our forward
// path: Alice on A↔B, Bob on B↔C, Charlie on C↔D). The HTLC output holds
// those sats until either the recipient claims them (settlement → recipient's
// to_local rises by the HTLC amount, offerer's stays at its reduced value)
// or the HTLC times out (offerer's to_local restored). This matches BOLT 3
// commitment math: the channel capacity always sums to to_local + to_remote
// + sum of in-flight HTLC outputs.
function balanceAt(beat: number, ch: ChannelDef, side: "left" | "right"): number {
  const state = htlcStateAt(beat, ch.id);
  if (state === "absent") {
    return side === "left" ? ch.startLeft : ch.startRight;
  }
  if (state === "in-flight") {
    // Left party (the offerer) has the HTLC amount taken out of to_local.
    // Right party (the recipient) is unchanged from start until settlement.
    if (side === "left") return ch.startLeft - ch.htlcAmount;
    return ch.startRight;
  }
  // Settled: balances at their post-payment end-state.
  return side === "left" ? ch.endLeft : ch.endRight;
}

// Witness scripts (BOLT 3 simplified). These render in the side panel that
// appears on hover in CommitmentTxCard's full mode. They're trimmed slightly
// from the spec for readability but preserve the script structure.

const WITNESS_TO_LOCAL: string[] = [
  "OP_IF",
  "  <revocation_pubkey>",
  "OP_ELSE",
  "  <to_self_delay>",
  "  OP_CHECKSEQUENCEVERIFY",
  "  OP_DROP",
  "  <local_delayedpubkey>",
  "OP_ENDIF",
  "OP_CHECKSIG",
];

const WITNESS_HTLC_OFFERED: string[] = [
  "OP_DUP OP_HASH160",
  "<RIPEMD160(remote_htlcpubkey)>",
  "OP_EQUAL",
  "OP_IF",
  "  OP_CHECKSIG",
  "OP_ELSE",
  "  <local_htlcpubkey>",
  "  OP_SWAP OP_SIZE 32 OP_EQUAL",
  "  OP_NOTIF",
  "    OP_DROP 2 OP_SWAP",
  "    <local_htlcpubkey>",
  "    2 OP_CHECKMULTISIG",
  "  OP_ELSE",
  "    OP_HASH160",
  "    <RIPEMD160(payment_hash)>",
  "    OP_EQUALVERIFY",
  "    OP_CHECKSIG",
  "  OP_ENDIF",
  "OP_ENDIF",
];

const WITNESS_HTLC_RECEIVED: string[] = [
  "OP_DUP OP_HASH160",
  "<RIPEMD160(remote_htlcpubkey)>",
  "OP_EQUAL",
  "OP_IF",
  "  OP_CHECKSIG",
  "OP_ELSE",
  "  <local_htlcpubkey>",
  "  OP_SWAP OP_SIZE 32 OP_EQUAL",
  "  OP_IF",
  "    OP_HASH160",
  "    <RIPEMD160(payment_hash)>",
  "    OP_EQUALVERIFY",
  "    2 OP_SWAP",
  "    <local_htlcpubkey>",
  "    2 OP_CHECKMULTISIG",
  "  OP_ELSE",
  "    OP_DROP <cltv_expiry>",
  "    OP_CHECKLOCKTIMEVERIFY",
  "    OP_DROP",
  "    OP_CHECKSIG",
  "  OP_ENDIF",
  "OP_ENDIF",
];

// Build the output rows for one side of a channel at a given beat. Each side
// always renders to_local first (its own balance), then to_remote, then the
// HTLC row (if present).
function buildOutputs(
  beat: number,
  ch: ChannelDef,
  side: "left" | "right",
): CommitmentOutput[] {
  const ownerLabel = side === "left" ? ch.leftLabel : ch.rightLabel;
  const remoteLabel = side === "left" ? ch.rightLabel : ch.leftLabel;
  const ownerId = side === "left" ? ch.leftId : ch.rightId;
  const remoteId = side === "left" ? ch.rightId : ch.leftId;
  const ownerSats = balanceAt(beat, ch, side);
  const remoteSats = balanceAt(beat, ch, side === "left" ? "right" : "left");

  const out: CommitmentOutput[] = [
    {
      label: `${ownerLabel} (DELAYED)`,
      role: "to_local",
      valueSats: ownerSats,
      immediate: false,
      witnessScript: WITNESS_TO_LOCAL,
      accentColor: HOP_PALETTE[ownerId].stroke,
    },
    {
      label: `${remoteLabel}`,
      role: "to_remote",
      valueSats: remoteSats,
      immediate: true,
      accentColor: HOP_PALETTE[remoteId].stroke,
      // P2WPKH — no witness script (just a pubkey hash); no panel on hover.
    },
  ];

  const htlcState = htlcStateAt(beat, ch.id);
  if (htlcState === "in-flight") {
    // BOLT 3 asymmetry: the offering side's commitment shows the HTLC as
    // "offered" (claimable by the remote party with the preimage); the
    // receiving side's commitment shows it as "received" (claimable by the
    // local party with the preimage).
    out.push({
      label: side === "left" ? "HTLC offered" : "HTLC received",
      role: "htlc",
      valueSats: ch.htlcAmount,
      immediate: false,
      witnessScript:
        side === "left" ? WITNESS_HTLC_OFFERED : WITNESS_HTLC_RECEIVED,
      htlc: {
        paymentHash: PAYMENT_HASH,
        cltv: ch.htlcCltv,
        inFlight: true,
      },
    });
  }
  return out;
}

// "Holds X's signature" subtitle for full mode. The asymmetric flag is part
// of the educational point: each side's commitment is signed by the *other*
// party.
function subtitleFor(ch: ChannelDef, side: "left" | "right"): string {
  const other = side === "left" ? ch.rightLabel : ch.leftLabel;
  return `(holds ${other}'s signature)`;
}

function nodeIsActive(beat: number, id: HopId): boolean {
  const ch = activeChannelAt(beat);
  if (ch) {
    const def = CHANNELS.find((c) => c.id === ch)!;
    return id === def.leftId || id === def.rightId;
  }
  if (beat === 4) return id === "dave";
  return false;
}

interface PinnedPopover {
  ownerLabel: string;
  subtitle: string;
  fundingTxid: string;
  outputs: CommitmentOutput[];
  // Anchor coordinates (viewport-relative, "fixed" position)
  x: number;
  y: number;
  pinned: boolean;
}

const BEAT_DURATION_MS = 2300;

// "Value-flying" chip rendered during settlement beats. It mounts at the HTLC
// row position and transitions up to the recipient's to_local row position
// over 400ms, so students see the HTLC value physically migrate into the
// recipient's balance row rather than just disappearing.
//
// Positioning: the recipient is always the right-hand card (forward direction).
// The chip anchors near the right edge of that card, in line with the value
// column where the to_local amount lives, so it visually lands ON the number
// it's about to add to.
function FlyingChip({
  amount,
  recipient,
  recipientColor,
}: {
  amount: number;
  recipient: string;
  recipientColor: string;
}) {
  const [phase, setPhase] = useState<"start" | "end">("start");
  useEffect(() => {
    const t = setTimeout(() => setPhase("end"), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{
        // Anchor the chip's LEFT edge just past the wrapper's right edge so
        // it can never land on top of the right-card content. Now that the
        // chip carries the recipient's name (e.g., "+10,000 sat → Dave") it
        // is wider; pinning by `left` instead of `right` keeps the gap stable
        // regardless of label length.
        left: "100%",
        marginLeft: 12,
        top: phase === "start" ? 110 : 32,
        opacity: phase === "start" ? 0 : 1,
        transition:
          "top 450ms cubic-bezier(0.4,0,0.2,1), opacity 250ms ease-out",
      }}
    >
      <div
        className="px-2 py-0.5 border-[1.5px] text-[10px] font-bold tabular-nums whitespace-nowrap"
        style={{
          background: recipientColor,
          color: "#fffdf5",
          borderColor: recipientColor,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        +{amount.toLocaleString("en-US")} sat → {recipient}
      </div>
    </div>
  );
}

// Which channel is settling at a given beat (settlement beats only).
function settlingChannelAt(beat: number): ChannelId | null {
  if (beat === 5) return "cd";
  if (beat === 6) return "bc";
  if (beat === 7) return "ab";
  return null;
}

// Which channel should be shown in the expanded panel by default for a given
// beat. For active beats (1–3, 5–7) it's the active channel. For the steady-
// state and pause beats we pick a sensible focus: A↔B at beat 0 (start of the
// payment), C↔D at beat 4 (Dave just received), A↔B at beat 8 (last channel
// to settle is the one closest to the payer).
function defaultExpandedAt(beat: number): ChannelId {
  const active = activeChannelAt(beat);
  if (active) return active;
  if (beat === 4) return "cd";
  return "ab";
}

export function HtlcPropagationDiagram() {
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [popover, setPopover] = useState<PinnedPopover | null>(null);
  // User-clicked override on which channel is expanded. Reset to null on every
  // beat change, so the animation drives focus while playing — but a manual
  // click during a pause overrides until the next beat.
  const [overrideExpanded, setOverrideExpanded] = useState<ChannelId | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOverrideExpanded(null);
  }, [beat]);

  // Auto-advance
  useEffect(() => {
    if (!playing) return;
    if (popover && popover.pinned === false) {
      // hover (non-pinned) pauses the timer entirely
      return;
    }
    timerRef.current = setTimeout(() => {
      setBeat((b) => {
        if (b + 1 >= TOTAL_BEATS) {
          setPlaying(false);
          return b;
        }
        return b + 1;
      });
    }, BEAT_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, beat, popover]);

  // Escape closes pinned popover
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function play() {
    if (beat >= TOTAL_BEATS - 1) setBeat(0);
    setPlaying(true);
  }
  function pause() { setPlaying(false); }
  function reset() { setPlaying(false); setBeat(0); setPopover(null); }

  const activeCh = activeChannelAt(beat);
  const expandedId: ChannelId = overrideExpanded ?? defaultExpandedAt(beat);
  const expandedCh = CHANNELS.find((c) => c.id === expandedId)!;

  // Anchor a hover popover near the mouse, but clamped to viewport.
  function openHoverPopover(props: Omit<PinnedPopover, "x" | "y" | "pinned">, e: React.MouseEvent) {
    if (popover?.pinned) return; // pinned wins
    const POPOVER_W = 360;
    const POPOVER_H = 460;
    const padding = 12;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + POPOVER_W > window.innerWidth - padding) {
      x = Math.max(padding, e.clientX - POPOVER_W - 16);
    }
    if (y + POPOVER_H > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - POPOVER_H - padding);
    }
    setPopover({ ...props, x, y, pinned: false });
  }
  function closeHoverPopover() {
    setPopover((p) => (p && p.pinned ? p : null));
  }
  function pinPopover(props: Omit<PinnedPopover, "x" | "y" | "pinned">, e: React.MouseEvent) {
    const POPOVER_W = 360;
    const POPOVER_H = 460;
    const padding = 12;
    let x = e.clientX + 16;
    let y = e.clientY + 16;
    if (x + POPOVER_W > window.innerWidth - padding) {
      x = Math.max(padding, e.clientX - POPOVER_W - 16);
    }
    if (y + POPOVER_H > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - POPOVER_H - padding);
    }
    setPopover({ ...props, x, y, pinned: true });
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="htlc-propagation"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            HTLC Propagation Across the Path
          </span>
        </div>
      </div>

      {/* Stage. Wrapped in an overflow-x container so that on viewports
          narrower than ~720px the layout scrolls horizontally rather than
          collapsing. The two-tier layout (minimized capsules row + a single
          expanded panel below) keeps the path geometry intact without
          requiring 1500px+ of width as the original three-pair layout did. */}
      <div className="overflow-x-auto">
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minHeight: 460, minWidth: 720 }}
      >
        {/* Hop track — same NODE_X_PCT layout as the sibling visuals. */}
        <div className="relative" style={{ height: 160 }}>
          {/* Backbone dashes between circles. Circle radius is 38px (76px
              diameter), so backbone center sits at y=38 and the dashes start
              just past each circle's edge. */}
          {[0, 1, 2].map((i) => {
            const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{
                  top: 38,
                  left: `calc(${startPct}% + 40px)`,
                  width: `calc(${endPct - startPct}% - 80px)`,
                  borderTop: "1.5px dashed #475569",
                }}
              />
            );
          })}

          {(["alice", "bob", "charlie", "dave"] as HopId[]).map((id) => {
            const isActive = nodeIsActive(beat, id);
            const label =
              id === "alice"
                ? "Alice"
                : id === "bob"
                  ? "Bob"
                  : id === "charlie"
                    ? "Charlie"
                    : "Dave";
            const role =
              id === "alice"
                ? "Sender"
                : id === "dave"
                  ? "Receiver"
                  : "Forwarder";
            // Canonical hop palette (matches ForwarderPolicyMap +
            // ComputedRouteDiagram + RouteCalcExercise so chapter 1 and
            // chapter 2 visuals share the same node language).
            const palette =
              id === "alice"
                ? { stroke: "#b8860b", fill: "#fef3c7" }
                : id === "bob"
                  ? { stroke: "#3b6aa0", fill: "#dbeafe" }
                  : id === "charlie"
                    ? { stroke: "#2d7a7a", fill: "#ccece8" }
                    : { stroke: "#7b4b8a", fill: "#ede1f3" };
            return (
              <div
                key={id}
                className="absolute z-10 flex flex-col items-center"
                style={{
                  top: 0,
                  left: `${NODE_X_PCT[id]}%`,
                  transform: "translateX(-50%)",
                  width: 76,
                }}
              >
                <div
                  className="rounded-full border-[2px] flex items-center justify-center transition-all duration-500"
                  style={{
                    width: 76,
                    height: 76,
                    background: palette.fill,
                    borderColor: isActive ? "#b8860b" : palette.stroke,
                    boxShadow: isActive
                      ? "0 0 0 3px rgba(184,134,11,0.25)"
                      : "none",
                    color: "#0f172a",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                  }}
                >
                  <span className="text-base font-bold">{label[0]}</span>
                </div>
                <div
                  className="mt-1 text-[10px] font-bold tracking-[0.05em]"
                  style={{ color: "#0f172a" }}
                >
                  {label}
                </div>
                <div
                  className="text-[8px] tracking-[0.05em] uppercase"
                  style={{ color: "#475569" }}
                >
                  {role}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tier 1: minimized channel capsules. Each is positioned between its
            two nodes geometrically so the path-to-channel link reads at a
            glance. Click any capsule to override which channel is shown in
            the expanded panel below; the override clears on the next beat. */}
        <div className="relative mt-3" style={{ height: 76 }}>
          {CHANNELS.map((ch) => {
            const leftPct = NODE_X_PCT[ch.leftId];
            const rightPct = NODE_X_PCT[ch.rightId];
            const centerPct = (leftPct + rightPct) / 2;
            const isExpanded = ch.id === expandedId;
            const isActive = activeCh === ch.id;
            const hasHtlc = htlcStateAt(beat, ch.id) === "in-flight";
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setOverrideExpanded(ch.id)}
                className="absolute text-left"
                style={{
                  left: `${centerPct}%`,
                  transform: "translateX(-50%)",
                  top: 0,
                  width: 160,
                }}
                title={`Show ${ch.leftLabel}↔${ch.rightLabel} below`}
              >
                <div
                  className="border-[1.5px] px-2 py-1.5 flex flex-col items-center transition-all duration-300"
                  style={{
                    borderColor: isActive
                      ? "#b8860b"
                      : isExpanded
                        ? "#0f172a"
                        : "#94a3b8",
                    background: isActive
                      ? "#fef3c7"
                      : isExpanded
                        ? "#fffdf5"
                        : "rgba(255,253,245,0.5)",
                    transform: isExpanded ? "scale(1.02)" : "scale(1)",
                    boxShadow: isExpanded ? "0 0 0 2px rgba(15,23,42,0.08)" : "none",
                    cursor: "pointer",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                >
                  <div
                    className="text-[10px] font-bold tracking-[0.05em] uppercase"
                    style={{ color: "#0f172a" }}
                  >
                    {ch.leftLabel} ↔ {ch.rightLabel}
                  </div>
                  <div
                    className="text-[9px]"
                    style={{ color: "#475569" }}
                  >
                    {ch.capacity.toLocaleString("en-US")} sats
                  </div>
                  {hasHtlc && (
                    <div className="mt-0.5 flex items-center gap-1">
                      <div
                        className="w-1.5 h-1.5"
                        style={{ background: "#b8860b" }}
                      />
                      <span
                        className="text-[8px] font-bold tracking-[0.08em] uppercase"
                        style={{ color: "#b8860b" }}
                      >
                        HTLC in flight
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tier 2: expanded panel for the focused channel. Shows the pair of
            commitment-tx thumbnails for whichever channel is currently
            expanded (animation-driven default, overridable by click on a
            minimized capsule above). Centered in the stage; remounted on
            channel change via the React key so the AnimatedSats values reset
            cleanly between channels. */}
        <div className="mt-4 flex justify-center" key={expandedId}>
          {(() => {
            const ch = expandedCh;
            const isActive = activeCh === ch.id;
            const leftOutputs = buildOutputs(beat, ch, "left");
            const rightOutputs = buildOutputs(beat, ch, "right");
            const leftOwner = `${ch.leftLabel}'s commitment tx`;
            const rightOwner = `${ch.rightLabel}'s commitment tx`;
            const leftSubtitle = subtitleFor(ch, "left");
            const rightSubtitle = subtitleFor(ch, "right");
            return (
              <div className="flex flex-col items-center" style={{ width: 360 }}>
                <div
                  className="grid grid-cols-2 gap-2 p-2 relative w-full"
                  style={{
                    border: `1.5px dashed ${isActive ? "#b8860b" : "#94a3b8"}`,
                    background: isActive
                      ? "rgba(184,134,11,0.04)"
                      : "transparent",
                    transition:
                      "border-color 400ms ease-out, background 400ms ease-out",
                  }}
                  onMouseLeave={() => closeHoverPopover()}
                >
                  <CommitmentTxCard
                    mode="thumbnail"
                    ownerLabel={leftOwner}
                    outputs={leftOutputs}
                    highlight={isActive}
                    onMouseEnter={(e) =>
                      openHoverPopover(
                        {
                          ownerLabel: leftOwner,
                          subtitle: leftSubtitle,
                          fundingTxid: ch.fundingTxid,
                          outputs: leftOutputs,
                        },
                        e,
                      )
                    }
                    onClick={(e) =>
                      pinPopover(
                        {
                          ownerLabel: leftOwner,
                          subtitle: leftSubtitle,
                          fundingTxid: ch.fundingTxid,
                          outputs: leftOutputs,
                        },
                        e,
                      )
                    }
                  />
                  <CommitmentTxCard
                    mode="thumbnail"
                    ownerLabel={rightOwner}
                    outputs={rightOutputs}
                    highlight={isActive}
                    onMouseEnter={(e) =>
                      openHoverPopover(
                        {
                          ownerLabel: rightOwner,
                          subtitle: rightSubtitle,
                          fundingTxid: ch.fundingTxid,
                          outputs: rightOutputs,
                        },
                        e,
                      )
                    }
                    onClick={(e) =>
                      pinPopover(
                        {
                          ownerLabel: rightOwner,
                          subtitle: rightSubtitle,
                          fundingTxid: ch.fundingTxid,
                          outputs: rightOutputs,
                        },
                        e,
                      )
                    }
                  />
                  {settlingChannelAt(beat) === ch.id && (
                    <FlyingChip
                      amount={ch.htlcAmount}
                      recipient={ch.rightLabel}
                      recipientColor={HOP_PALETTE[ch.rightId].stroke}
                    />
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      </div>

      {/* Floating popover */}
      {popover && (
        <div
          className="fixed z-50"
          style={{ left: popover.x, top: popover.y }}
          onMouseEnter={() => {
            // Hover into the popover keeps it open (only matters when not
            // pinned; pinned popovers are unaffected anyway).
          }}
          onMouseLeave={() => {
            if (!popover.pinned) closeHoverPopover();
          }}
        >
          <div className="relative">
            {popover.pinned && (
              <>
                <span
                  className="absolute -top-2 left-2 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] uppercase border-[1.5px] z-10"
                  style={{ background: "#b8860b", color: "#fffdf5", borderColor: "#b8860b" }}
                >
                  PINNED
                </span>
                <button
                  onClick={() => setPopover(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 border-[1.5px] flex items-center justify-center text-xs font-bold z-10"
                  style={{ background: "#fffdf5", color: "#0f172a", borderColor: "#0f172a" }}
                  aria-label="Close pinned commitment tx"
                >
                  ×
                </button>
              </>
            )}
            <CommitmentTxCard
              mode="full"
              ownerLabel={popover.ownerLabel}
              subtitle={popover.subtitle}
              fundingTxid={popover.fundingTxid}
              outputs={popover.outputs}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={playing ? pause : play}
              className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors"
              data-testid="htlc-propagation-play"
            >
              {playing ? "❚❚ Pause" : beat >= TOTAL_BEATS - 1 ? "↻ Replay" : "▶ Play"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_BEATS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlaying(false);
                    setBeat(i);
                  }}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: beat === i ? "#b8860b" : beat > i ? "#fef3c7" : "#fffdf5",
                    borderColor: beat === i ? "#b8860b" : "#0f172a",
                    color: beat === i ? "#fffdf5" : "#0f172a",
                  }}
                  data-testid={`htlc-propagation-step-${i}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-2xl">
            {STEP_CAPTIONS[beat]}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HtlcPropagationDiagram;
