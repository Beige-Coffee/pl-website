import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useReadableInDark } from "./useReadableInDark";
import {
  CommitmentTxCard,
  type CommitmentOutput,
} from "./CommitmentTxCard";
import { StepCaption } from "./StepCaption";

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
//     HTLC   10,004 sat from Alice → Bob
//     end    Alice 589,996 / Bob     410,004        sum = 1,000,000 ✓
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
//     Alice   = -10,004                              (sender)
//     Bob     = +10,004 - 10,002 = +2 sat            (Bob's fee = 2)
//     Charlie = +10,002 - 10,000 = +2 sat            (Charlie's fee = 2)
//     Dave    = +10,000                              (receives)
//
// Visual style follows the Noise capstone:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body (#fefdfb), dark borders, gold (#b8860b) accents.
//   - JetBrains Mono on hex/protocol values; sans-serif elsewhere.
// ────────────────────────────────────────────────────────────────────────────

type HopId = "alice" | "bob" | "charlie" | "dave";

// Canonical hop palette, shared with ForwarderPolicyMap, ComputedRouteDiagram,
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
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

const TOTAL_BEATS = 9;

const PAYMENT_HASH = "0xa3f1...e9c4";

const STEP_CAPTIONS: Record<number, string> = {
  0: "Here are three channels along the path, each anchored by its own pair of commitment transactions. Notice Bob and Charlie each hold two, one for each channel they sit between. Let's send a 10,000-sat payment from Alice to Dave and watch what happens.",
  1: "First, Alice and Bob each add a new HTLC output to their commitments. It's locked to payment_hash 0xa3f1...e9c4 and times out at block 260.",
  2: "Now Bob forwards the payment on to Charlie, keeping 2 sats as his forwarding fee, so the B↔C HTLC carries 10,002 sat. They each add an HTLC output on their B↔C commitments, this time with a tighter CLTV of 220 (that's Bob's safety margin, so he can resolve A↔B before B↔C times out).",
  3: "Then Charlie passes it on to Dave, with a CLTV of 180 and an amount of 10,000 sat. Where'd the other two sats go? That's Charlie's forwarding fee. The HTLC now sits on every channel along the path.",
  4: "Finally, the HTLC is routed to Dave, who knows the preimage because he generated it for this specific invoice.",
  5: "Now Dave hands the preimage to Charlie. The Charlie-Dave HTLC outputs are removed and 10,000 sats slide into Dave's to_local.",
  6: "Charlie passes the preimage back to Bob. The B↔C HTLC outputs are removed and 10,002 sats slide into Charlie's to_local on B↔C. Charlie's just pocketed his two-sat fee.",
  7: "Bob hands the preimage back to Alice. The A↔B HTLC outputs are removed and 10,004 sats land in Bob's to_local. After forwarding 10,002 on to Charlie, Bob keeps 2 sats as his fee, and the payment has fully cleared.",
  8: "And we're settled. Alice is down 10,004, Bob and Charlie are each up 2 (their fees), and Dave's up 10,000. The same preimage Dave revealed travelled all the way back along the path. Atomic, off-chain, in seconds. Pretty slick, right?",
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
    endLeft: 589_996,
    endRight: 410_004,
    htlcAmount: 10_004,
    htlcCltv: 260,
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

// Accent color for the StepCaption below the visual: track the active step's
// hop. Forward + settle beats center on the active channel's right (receiving)
// party (the HTLC is offered toward them, and settlement value flows into
// them); beat 4 is Dave holding the preimage; steady states fall back to gold.
function stepAccentAt(beat: number): string {
  if (beat === 4) return HOP_PALETTE.dave.stroke;
  const ch = activeChannelAt(beat);
  if (ch) {
    const def = CHANNELS.find((c) => c.id === ch)!;
    return HOP_PALETTE[def.rightId].stroke;
  }
  return "#b8860b";
}

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
  "<RIPEMD160(SHA256(revocationpubkey))>",
  "OP_EQUAL",
  "OP_IF",
  "  OP_CHECKSIG",
  "OP_ELSE",
  "  <remote_htlcpubkey>",
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
  "<RIPEMD160(SHA256(revocationpubkey))>",
  "OP_EQUAL",
  "OP_IF",
  "  OP_CHECKSIG",
  "OP_ELSE",
  "  <remote_htlcpubkey>",
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
      // P2WPKH, no witness script (just a pubkey hash); no panel on hover.
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
  const [popover, setPopover] = useState<PinnedPopover | null>(null);

  // Escape closes pinned popover
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reset() { setBeat(0); setPopover(null); }

  const activeCh = activeChannelAt(beat);
  const expandedId: ChannelId = defaultExpandedAt(beat);
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

  const rootRef = useReadableInDark();
  return (
    <div
      ref={rootRef}
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
          collapsing. The layout is the node row (live channel un-faded, with
          an in-flight marker on its edge) above a single commitment-tx pair
          for the current step, which keeps the path geometry intact without
          requiring 1500px+ of width as the original three-pair layout did. */}
      <div className="overflow-x-auto">
      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 380, minWidth: 720 }}
      >
        {/* Hop track, same NODE_X_PCT layout as the sibling visuals. */}
        <div className="relative" style={{ height: 160 }}>
          {/* Backbone dashes between circles. Circle radius is 32px (64px
              diameter), so backbone center sits at y=32 and the dashes start
              just past each circle's edge. */}
          {[0, 1, 2].map((i) => {
            const startPct = NODE_X_PCT[(["alice", "bob", "charlie"] as HopId[])[i]];
            const endPct = NODE_X_PCT[(["bob", "charlie", "dave"] as HopId[])[i]];
            const segCh = (["ab", "bc", "cd"] as ChannelId[])[i];
            const segDim = activeCh !== null && segCh !== activeCh;
            return (
              <div
                key={i}
                className="absolute pointer-events-none transition-opacity duration-500"
                style={{
                  top: 32,
                  left: `calc(${startPct}% + 34px)`,
                  width: `calc(${endPct - startPct}% - 68px)`,
                  borderTop: "1.5px dashed #475569",
                  opacity: segDim ? 0.2 : 1,
                }}
              />
            );
          })}

          {(["alice", "bob", "charlie", "dave"] as HopId[]).map((id) => {
            // Highlight the two endpoints of the channel whose commitment-tx
            // pair is shown below; fade the other two. The shown channel is
            // expandedCh, so the highlight always matches the txs on screen,
            // including the steady-state beats (0, 4, 8) where no HTLC is
            // mid-flight but a specific channel's txs are still displayed.
            const isActive =
              id === expandedCh.leftId || id === expandedCh.rightId;
            const dim = !isActive;
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
                  ? "Destination"
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
                  width: 64,
                  opacity: dim ? 0.32 : 1,
                  transition: "opacity 500ms ease-out",
                }}
              >
                <div
                  className="rounded-full border-[2px] flex items-center justify-center transition-all duration-500"
                  style={{
                    width: 64,
                    height: 64,
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

          {/* HTLC-in-flight marker on the live edge. Replaces the old
              channel-capsule row: the active channel reads from its two
              un-faded nodes plus this marker sitting on the backbone between
              them. */}
          {htlcStateAt(beat, expandedCh.id) === "in-flight" &&
            (() => {
              const def = expandedCh;
              const centerPct =
                (NODE_X_PCT[def.leftId] + NODE_X_PCT[def.rightId]) / 2;
              return (
                <div
                  className="absolute z-20 flex items-center gap-1 px-2 py-0.5 border-[1.5px] transition-all duration-300"
                  style={{
                    top: 22,
                    left: `${centerPct}%`,
                    transform: "translateX(-50%)",
                    background: "#fef3c7",
                    borderColor: "#b8860b",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    whiteSpace: "nowrap",
                  }}
                >
                  <div className="w-1.5 h-1.5" style={{ background: "#b8860b" }} />
                  <span
                    className="text-[8px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: "#b8860b" }}
                  >
                    HTLC in flight · {def.htlcAmount.toLocaleString("en-US")} sats
                  </span>
                </div>
              );
            })()}
        </div>

        {/* (The old channel-capsule selector row was removed. The live
            channel now reads from the un-faded node pair + the in-flight
            marker on the active edge above; the commitment-tx pair below
            follows the current step.) */}

        {/* Tier 2: expanded panel for the focused channel. Shows the pair of
            commitment-tx thumbnails for whichever channel is currently
            expanded (the active channel for the current step). Centered in
            the stage; remounted on
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
              <div className="flex flex-col items-center" style={{ width: 460 }}>
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

        <StepCaption
          label={`Step ${beat + 1} of ${TOTAL_BEATS}`}
          caption={STEP_CAPTIONS[beat]}
          accentColor={stepAccentAt(beat)}
        />
      </div>
      </div>

      {/* Floating popover. Portal-mounted to document.body so the new
          overflow-x-auto stage wrapper can't clip it. Coordinates are already
          viewport-relative (position: fixed) and clamped in the open/pin
          handlers, so the on-screen position is unchanged by the portal. */}
      {popover &&
        typeof document !== "undefined" &&
        createPortal(
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
          </div>,
          document.body,
        )}

      {/* Controls */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex gap-1.5 items-center flex-wrap shrink-0">
          <button
            onClick={() => setBeat((b) => Math.max(0, b - 1))}
            disabled={beat <= 0}
            className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            data-testid="htlc-propagation-back"
          >
            ← Back
          </button>
          <button
            onClick={() => setBeat((b) => Math.min(TOTAL_BEATS - 1, b + 1))}
            disabled={beat >= TOTAL_BEATS - 1}
            className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors disabled:opacity-40 disabled:pointer-events-none"
            data-testid="htlc-propagation-next"
          >
            Next →
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
      </div>
    </div>
  );
}

export default HtlcPropagationDiagram;
