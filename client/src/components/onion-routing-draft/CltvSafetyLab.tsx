import { useMemo, useState } from "react";
import { StepCaption } from "./StepCaption";

// ────────────────────────────────────────────────────────────────────────────
// CltvSafetyLab (DRAFT), editable HTLC expiries + sequential preimage walk
//
// Three editable expiry blocks (one per HTLC contract) and a "blocks per hop"
// claim latency. Constraint: each upstream HTLC's expiry must be ≥ the next
// downstream's (expiryAB ≥ expiryBC ≥ expiryCD). Defaults to a decreasing
// 160 / 150 / 140 ladder (the working case, with safe CLTV margins).
//
// Step-through animates the preimage moving Dave → Charlie → Bob → Alice. At
// each step, exactly one contract transitions: claimed (✓) if the claim made
// its deadline, expired (✗) if it didn't. The preimage token slides between
// nodes with a CSS transition, so students see WHY each contract resolves
// the way it does.
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_EXPIRY = 140;
// Earliest block an editable HTLC expiry may be set to.
const MIN_EXPIRY = 101;
// Fixed claim latency: we assume each on-chain claim takes 1 block to confirm.
// Not student-adjustable, it's a stated assumption, so the timeline reads
// cleanly (reveal, then claim, then claim) instead of giving readers a dial
// that overlaps with the expiry knobs.
const CLAIM_LATENCY = 1;
const MAX_EXPIRY = 300;

const DAVE_AMOUNT = 10_000;
const CHARLIE_FEE = 2;
const BOB_FEE = 1;
const BOB_TO_CHARLIE = DAVE_AMOUNT + CHARLIE_FEE; // 10,002
const ALICE_TO_BOB = DAVE_AMOUNT + CHARLIE_FEE + BOB_FEE; // 10,003

const COLORS = {
  alice: { stroke: "#b8860b", fill: "#fef3c7" },
  bob: { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3" },
} as const;
const INK = "#0f172a";
const SLATE = "#475569";
const AMBER = "#b8860b";
const GREEN = "#5a7a2f";
const RED = "#a13a3a";

type NodeId = "alice" | "bob" | "charlie" | "dave";
type ContractStatus = "active" | "claimed" | "expired";

const NODE_X_PCT: Record<NodeId, number> = {
  alice: 12,
  bob: 38,
  charlie: 62,
  dave: 88,
};

interface Sim {
  blocksPerHop: number;
  expiryAB: number;
  expiryBC: number;
  expiryCD: number;
  daveRevealsAt: number;
  charlieClaimsBobAt: number;
  bobClaimsAliceAt: number;
  charlieClaimSucceeds: boolean;
  bobClaimSucceeds: boolean;
  // final balance deltas
  alice: number;
  bob: number;
  charlie: number;
  dave: number;
}

function simulate(
  expiryAB: number,
  expiryBC: number,
  expiryCD: number,
  blocksPerHop: number,
): Sim {
  // Dave reveals as late as possible while still claiming his HTLC.
  const daveRevealsAt = expiryCD - 1;
  // Each hop's claim takes blocksPerHop blocks to broadcast/confirm.
  const charlieClaimsBobAt = daveRevealsAt + blocksPerHop;
  const bobClaimsAliceAt = daveRevealsAt + 2 * blocksPerHop;
  const charlieClaimSucceeds = charlieClaimsBobAt < expiryBC;
  const bobClaimSucceeds = charlieClaimSucceeds && bobClaimsAliceAt < expiryAB;

  let alice = 0, bob = 0, charlie = 0, dave = 0;
  charlie -= DAVE_AMOUNT;
  dave += DAVE_AMOUNT;
  if (charlieClaimSucceeds) {
    bob -= BOB_TO_CHARLIE;
    charlie += BOB_TO_CHARLIE;
  }
  if (bobClaimSucceeds) {
    alice -= ALICE_TO_BOB;
    bob += ALICE_TO_BOB;
  }

  return {
    blocksPerHop, expiryAB, expiryBC, expiryCD,
    daveRevealsAt, charlieClaimsBobAt, bobClaimsAliceAt,
    charlieClaimSucceeds, bobClaimSucceeds,
    alice, bob, charlie, dave,
  };
}

interface StepView {
  block: number;
  preimageHolder: NodeId | null;
  abStatus: ContractStatus;
  bcStatus: ContractStatus;
  cdStatus: ContractStatus;
  nodeOk: Record<NodeId, "neutral" | "ok" | "burned">;
  caption: string;
}

function viewAtStep(sim: Sim, step: number): StepView {
  if (step === 0) {
    return {
      block: sim.daveRevealsAt - 2,
      preimageHolder: "dave",
      abStatus: "active", bcStatus: "active", cdStatus: "active",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "neutral", dave: "neutral" },
      caption: `We've skipped ahead to block ${sim.daveRevealsAt - 2}. The three HTLCs were committed earlier in the payment, and Dave's been sitting on the preimage from his invoice the whole time. Nothing interesting happens until the deadlines get close, so let's pick it up right before they do...`,
    };
  }
  if (step === 1) {
    return {
      block: sim.daveRevealsAt,
      preimageHolder: "charlie",
      abStatus: "active",
      bcStatus: "active",
      cdStatus: "claimed",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "neutral", dave: "ok" },
      caption: `Block ${sim.daveRevealsAt}, just before his HTLC expires, Dave reveals the preimage on-chain to claim Charlie's payment. He pockets ${DAVE_AMOUNT.toLocaleString("en-US")} sats. And look, Charlie sees that preimage in Dave's claim transaction, so now Charlie holds it too.`,
    };
  }
  if (step === 2) {
    if (sim.charlieClaimSucceeds) {
      return {
        block: sim.charlieClaimsBobAt,
        preimageHolder: "bob",
        abStatus: "active",
        bcStatus: "claimed",
        cdStatus: "claimed",
        nodeOk: { alice: "neutral", bob: "neutral", charlie: "ok", dave: "ok" },
        caption: `Block ${sim.charlieClaimsBobAt}, and Charlie broadcasts his claim against Bob's HTLC, revealing the preimage as he does. It confirms before block ${sim.expiryBC}, so Charlie collects ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats. Now Bob's the one holding the preimage.`,
      };
    }
    return {
      block: sim.charlieClaimsBobAt,
      preimageHolder: "charlie",
      abStatus: "active",
      bcStatus: "expired",
      cdStatus: "claimed",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "burned", dave: "ok" },
      caption: `Block ${sim.charlieClaimsBobAt}, and Charlie goes to claim Bob's HTLC, but it already expired back at block ${sim.expiryBC}. Ouch. Bob's HTLC times out and Bob gets refunded. Charlie's out ${DAVE_AMOUNT.toLocaleString("en-US")} sats, since he paid Dave but couldn't recover from Bob.`,
    };
  }
  if (step === 3) {
    if (sim.bobClaimSucceeds) {
      return {
        block: sim.bobClaimsAliceAt,
        preimageHolder: "alice",
        abStatus: "claimed",
        bcStatus: "claimed",
        cdStatus: "claimed",
        nodeOk: { alice: "ok", bob: "ok", charlie: "ok", dave: "ok" },
        caption: `Block ${sim.bobClaimsAliceAt}, and Bob broadcasts his claim against Alice's HTLC. It confirms before block ${sim.expiryAB}, so Bob collects ${ALICE_TO_BOB.toLocaleString("en-US")} sats and keeps a ${BOB_FEE}-sat fee for his trouble. The whole route settled cleanly. Nice.`,
      };
    }
    if (sim.charlieClaimSucceeds) {
      return {
        block: sim.bobClaimsAliceAt,
        preimageHolder: "bob",
        abStatus: "expired",
        bcStatus: "claimed",
        cdStatus: "claimed",
        nodeOk: { alice: "neutral", bob: "burned", charlie: "ok", dave: "ok" },
        caption: `Block ${sim.bobClaimsAliceAt}, and Bob has the preimage, but Alice's HTLC already expired at block ${sim.expiryAB}. Her timeout fired and she clawed her funds back. So Bob's out ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats, since he paid Charlie but couldn't recover from Alice.`,
      };
    }
    // Both Charlie and Bob lost in step 2 (Charlie's claim failed earlier)
    return {
      block: sim.bobClaimsAliceAt,
      preimageHolder: "charlie",
      abStatus: "expired",
      bcStatus: "expired",
      cdStatus: "claimed",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "burned", dave: "ok" },
      caption: `Block ${sim.bobClaimsAliceAt}, and Alice's HTLC has expired too (block ${sim.expiryAB}). Bob never paid Charlie, so Bob's fine, and Alice gets refunded. Only Charlie is left out of pocket.`,
    };
  }
  // step 4, final summary
  let summary: string;
  if (sim.bobClaimSucceeds) {
    summary = `And we're done. Everyone settled cleanly. Charlie earned ${CHARLIE_FEE} sats, Bob earned ${BOB_FEE} sat, and Alice paid ${ALICE_TO_BOB.toLocaleString("en-US")} sats to deliver ${DAVE_AMOUNT.toLocaleString("en-US")} to Dave. The CLTV margins gave each forwarder *enough time* to react.`;
  } else if (sim.charlieClaimSucceeds) {
    const slack = sim.expiryAB - sim.bobClaimsAliceAt;
    summary = `And we're done, but Bob's out ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats. His claim broadcast at block ${sim.bobClaimsAliceAt}, but Alice's HTLC expired at block ${sim.expiryAB}, so he missed it by ${-slack + 1} block(s). Try raising Alice→Bob's expiry to give Bob more slack.`;
  } else {
    const slack = sim.expiryBC - sim.charlieClaimsBobAt;
    summary = `And we're done, but Charlie's out ${DAVE_AMOUNT.toLocaleString("en-US")} sats. His claim broadcast at block ${sim.charlieClaimsBobAt}, but Bob's HTLC to him expired at block ${sim.expiryBC}, so he missed it by ${-slack + 1} block(s). Try raising Bob→Charlie's expiry to give Charlie more slack.`;
  }
  return {
    block: Math.max(sim.expiryAB, sim.bobClaimsAliceAt) + 2,
    preimageHolder: null,
    abStatus: sim.bobClaimSucceeds ? "claimed" : "expired",
    bcStatus: sim.charlieClaimSucceeds ? "claimed" : "expired",
    cdStatus: "claimed",
    nodeOk: {
      alice: "neutral",
      bob: sim.bobClaimSucceeds ? "ok" : sim.charlieClaimSucceeds ? "burned" : "neutral",
      charlie: sim.charlieClaimSucceeds ? "ok" : "burned",
      dave: "ok",
    },
    caption: summary,
  };
}

const TOTAL_STEPS = 5;

// ────────────────────────────────────────────────────────────────────────────

export function CltvSafetyLab() {
  const [expiryAB, setExpiryAB] = useState(160);
  const [expiryBC, setExpiryBC] = useState(150);
  const [expiryCD, setExpiryCD] = useState(DEFAULT_EXPIRY);
  const [step, setStep] = useState(0);

  const sim = useMemo(
    () => simulate(expiryAB, expiryBC, expiryCD, CLAIM_LATENCY),
    [expiryAB, expiryBC, expiryCD],
  );
  const view = useMemo(() => viewAtStep(sim, step), [sim, step]);

  // StepCaption accent + title track which hop acts on this step. Setup (0)
  // and the final summary (4) use neutral amber/green; the three claim steps
  // borrow the acting node's color.
  const captionAccent =
    step === 1
      ? COLORS.dave.stroke
      : step === 2
        ? COLORS.charlie.stroke
        : step === 3
          ? COLORS.bob.stroke
          : step >= TOTAL_STEPS - 1
            ? GREEN
            : AMBER;
  const captionTitle =
    step === 0
      ? "Setup"
      : step === 1
        ? "Dave reveals the preimage"
        : step === 2
          ? "Charlie claims from Bob"
          : step === 3
            ? "Bob claims from Alice"
            : "Final state";

  function clampExpiry(v: number, min: number) {
    return Math.max(min, Math.min(MAX_EXPIRY, v));
  }
  // Setters enforce the constraint expiryAB ≥ expiryBC ≥ expiryCD: expiries can
  // only go DOWN as you move left-to-right across the cards. The sender's HTLC
  // (Alice→Bob) carries the largest expiry, and each downstream card is clamped
  // to AT MOST its left neighbour's value, so a forwarder always has time to
  // claim its incoming HTLC after its outgoing one is claimed. AB is the anchor
  // (floored at MIN_EXPIRY); lowering an upstream expiry pulls the downstream
  // ones down with it.
  function handleSetExpiryAB(v: number) {
    const next = clampExpiry(v, MIN_EXPIRY);
    setExpiryAB(next);
    // Cascade downward: BC and CD may need to drop to keep BC ≤ AB and CD ≤ BC.
    if (expiryBC > next) {
      setExpiryBC(next);
      if (expiryCD > next) setExpiryCD(next);
    }
    setStep(0);
  }
  function handleSetExpiryBC(v: number) {
    const next = Math.min(clampExpiry(v, MIN_EXPIRY), expiryAB);
    setExpiryBC(next);
    if (expiryCD > next) setExpiryCD(next);
    setStep(0);
  }
  function handleSetExpiryCD(v: number) {
    const next = Math.min(clampExpiry(v, MIN_EXPIRY), expiryBC);
    setExpiryCD(next);
    setStep(0);
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="cltv-safety-lab"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Step Through the Race
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6"
        style={{ minWidth: 760, minHeight: 480 }}
      >
        {/* Block counter, prominent */}
        <div className="flex items-center justify-center mb-4">
          <div
            className="px-4 py-1.5 border-[1.5px] flex items-center gap-2"
            style={{
              borderColor: AMBER,
              background: "#fef3c7",
              color: INK,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}
          >
            <span className="text-[10px] font-bold tracking-[0.08em] uppercase opacity-70">
              block
            </span>
            <span className="text-lg font-bold tabular-nums">{view.block}</span>
          </div>
        </div>

        {/* Node row + preimage token */}
        <NodeRow view={view} />

        {/* HTLC contract cards */}
        <div className="relative mt-4" style={{ height: 170 }}>
          <ContractCard
            leftPct={NODE_X_PCT.alice}
            rightPct={NODE_X_PCT.bob}
            from="alice"
            to="bob"
            amount={ALICE_TO_BOB}
            expiry={expiryAB}
            minExpiry={MIN_EXPIRY}
            maxExpiry={MAX_EXPIRY}
            onChange={handleSetExpiryAB}
            status={view.abStatus}
          />
          <ContractCard
            leftPct={NODE_X_PCT.bob}
            rightPct={NODE_X_PCT.charlie}
            from="bob"
            to="charlie"
            amount={BOB_TO_CHARLIE}
            expiry={expiryBC}
            minExpiry={MIN_EXPIRY}
            maxExpiry={expiryAB}
            onChange={handleSetExpiryBC}
            status={view.bcStatus}
          />
          <ContractCard
            leftPct={NODE_X_PCT.charlie}
            rightPct={NODE_X_PCT.dave}
            from="charlie"
            to="dave"
            amount={DAVE_AMOUNT}
            expiry={expiryCD}
            minExpiry={MIN_EXPIRY}
            maxExpiry={expiryBC}
            onChange={handleSetExpiryCD}
            status={view.cdStatus}
          />
        </div>

        <StepCaption
          label={`STEP ${step + 1} OF ${TOTAL_STEPS}`}
          title={captionTitle}
          caption={view.caption}
          accentColor={captionAccent}
        />
      </div>
      </div>

      {/* Footer: Reset + step buttons + bph control (caption now lives in the
          StepCaption block inside the stage above). */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
          <div className="flex gap-1.5 items-center flex-wrap shrink-0">
            <button
              onClick={() => setStep(0)}
              className="px-3 py-1.5 border-[1.5px] border-foreground/40 bg-card text-foreground text-xs uppercase tracking-[0.05em] hover:bg-secondary transition-colors"
            >
              Reset
            </button>
            <div className="ml-1 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-7 h-7 border-[1.5px] text-[10px] font-bold transition-colors"
                  style={{
                    background: step === i ? "#b8860b" : step > i ? "#fef3c7" : "#fffdf5",
                    borderColor: step === i ? "#b8860b" : "#0f172a",
                    color: step === i ? "#fffdf5" : "#0f172a",
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
              disabled={step >= TOTAL_STEPS - 1}
              className="ml-1 px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors disabled:opacity-50"
            >
              {step >= TOTAL_STEPS - 1 ? "Done" : "Next →"}
            </button>
          </div>

        {/* Fixed claim-latency assumption (not a dial). */}
        <div className="mt-3 pt-3 border-t-[1px] border-foreground/15 flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] tracking-[0.06em] uppercase opacity-60 shrink-0"
            style={{ color: INK }}
          >
            assume each on-chain claim takes 1 block to confirm
          </span>
          <span
            className="text-[10px] italic opacity-60 shrink-0"
            style={{ color: SLATE }}
          >
            so Charlie claims at block {sim.charlieClaimsBobAt}, Bob at block{" "}
            {sim.bobClaimsAliceAt}
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function NodeRow({ view }: { view: StepView }) {
  return (
    <div className="relative" style={{ height: 130 }}>
      {/* Backbone dashed line */}
      {[0, 1, 2].map((i) => {
        const ids: NodeId[] = ["alice", "bob", "charlie", "dave"];
        const startPct = NODE_X_PCT[ids[i]];
        const endPct = NODE_X_PCT[ids[i + 1]];
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              top: 32,
              left: `calc(${startPct}% + 34px)`,
              width: `calc(${endPct - startPct}% - 68px)`,
              borderTop: "1.5px dashed #475569",
            }}
          />
        );
      })}

      {view.preimageHolder && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            top: 78,
            left: `${NODE_X_PCT[view.preimageHolder]}%`,
            transform: "translateX(-50%)",
            transition: "left 700ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div
            className="px-2 py-0.5 border-[1.5px] text-[10px] font-bold tracking-[0.05em] uppercase whitespace-nowrap"
            style={{
              background: AMBER,
              color: "#fffdf5",
              borderColor: AMBER,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              boxShadow: "0 2px 8px rgba(184,134,11,0.45)",
            }}
          >
            🔑 preimage
          </div>
        </div>
      )}

      {(["alice", "bob", "charlie", "dave"] as NodeId[]).map((id) => {
        const label = id[0].toUpperCase() + id.slice(1);
        const role =
          id === "alice"
            ? "Sender"
            : id === "dave"
              ? "Destination"
              : "Forwarder";
        const status = view.nodeOk[id];
        return (
          <div
            key={id}
            className="absolute z-10 flex flex-col items-center"
            style={{
              top: 0,
              left: `${NODE_X_PCT[id]}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="rounded-full border-[2px] flex items-center justify-center transition-all duration-400 relative"
              style={{
                width: 64,
                height: 64,
                background:
                  status === "burned" ? "#fde0e0" : COLORS[id].fill,
                borderColor:
                  status === "burned"
                    ? RED
                    : status === "ok"
                      ? GREEN
                      : COLORS[id].stroke,
              }}
            >
              <span className="text-sm font-bold" style={{ color: INK }}>
                {label}
              </span>
              {status === "ok" && (
                <span
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
                  style={{ background: GREEN, color: "#fffdf5" }}
                >
                  ✓
                </span>
              )}
              {status === "burned" && (
                <span
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
                  style={{ background: RED, color: "#fffdf5" }}
                >
                  ✗
                </span>
              )}
            </div>
            <div
              className="mt-3 text-[10px] tracking-[0.05em] uppercase font-bold"
              style={{ color: SLATE }}
            >
              {role}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function ContractCard({
  leftPct,
  rightPct,
  from,
  to,
  amount,
  expiry,
  minExpiry,
  maxExpiry,
  onChange,
  status,
}: {
  leftPct: number;
  rightPct: number;
  from: NodeId;
  to: NodeId;
  amount: number;
  expiry: number;
  minExpiry: number;
  maxExpiry: number;
  onChange: (v: number) => void;
  status: ContractStatus;
}) {
  const centerPct = (leftPct + rightPct) / 2;
  const fromLabel = from[0].toUpperCase() + from.slice(1);
  const toLabel = to[0].toUpperCase() + to.slice(1);
  const colorFrom = COLORS[from];
  const colorTo = COLORS[to];

  let borderColor = INK;
  let background = "#fffdf5";
  let borderStyle: "solid" | "dashed" = "solid";
  let statusText = "● active";
  let statusColor = SLATE;

  if (status === "claimed") {
    borderColor = GREEN;
    background = "#eaf2db";
    statusText = `✓ claimed by ${toLabel}`;
    statusColor = GREEN;
  } else if (status === "expired") {
    borderColor = RED;
    background = "#fde0e0";
    borderStyle = "dashed";
    statusText = `⏱ expired, refunded to ${fromLabel}`;
    statusColor = RED;
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${centerPct}%`,
        transform: "translateX(-50%)",
        top: 0,
        width: 210,
        transition: "all 500ms ease",
      }}
    >
      <div
        className="border-[1.5px]"
        style={{ borderColor, background, borderStyle, transition: "border-color 500ms ease, background 500ms ease" }}
      >
        <div
          className="px-2 py-1 border-b-[1.5px] flex items-center gap-1.5"
          style={{ borderColor }}
        >
          <div className="w-1.5 h-1.5" style={{ background: colorFrom.stroke }} />
          <span
            className="text-[9px] font-bold tracking-[0.06em] uppercase"
            style={{ color: INK }}
          >
            {fromLabel} → {toLabel} HTLC
          </span>
          <div
            className="ml-auto w-1.5 h-1.5"
            style={{ background: colorTo.stroke }}
          />
        </div>

        <div
          className="px-2 py-1.5 text-[10px] leading-snug"
          style={{
            color: INK,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          <div>
            <span style={{ color: AMBER, fontWeight: 700 }}>if</span>{" "}
            preimage revealed:
          </div>
          <div className="pl-3">
            → <span style={{ fontWeight: 700 }}>{toLabel}</span> gets{" "}
            <span style={{ fontWeight: 700 }}>
              {amount.toLocaleString("en-US")}
            </span>{" "}
            sat
          </div>
          <div className="mt-0.5">
            <span style={{ color: AMBER, fontWeight: 700 }}>else</span> after
            block{" "}
            <input
              type="number"
              min={minExpiry}
              max={maxExpiry}
              value={expiry}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isNaN(n)) return;
                onChange(n);
              }}
              className="inline-block tabular-nums text-center"
              style={{
                width: 52,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontWeight: 700,
                color: INK,
                background: "#fffdf5",
                border: `1px dashed ${AMBER}`,
                padding: "0 2px",
                fontSize: 11,
              }}
              title={`Editable. Must be between ${minExpiry} and ${maxExpiry}.`}
            />
            :
          </div>
          <div className="pl-3">
            → <span style={{ fontWeight: 700 }}>{fromLabel}</span> refunds
          </div>
        </div>

        <div className="px-2 pb-1.5">
          <span
            className="px-1.5 py-0.5 text-[9px] font-bold tracking-[0.05em] uppercase border-[1.5px]"
            style={{
              color: statusColor,
              borderColor: statusColor,
              background: "#fffdf5",
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}
          >
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}

export default CltvSafetyLab;
