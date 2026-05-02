import { useMemo, useState } from "react";

// ────────────────────────────────────────────────────────────────────────────
// CltvSafetyLab (DRAFT) — editable HTLC expiries + sequential preimage walk
//
// Three editable expiry blocks (one per HTLC contract) and a "blocks per hop"
// claim latency. Constraint: each upstream HTLC's expiry must be ≥ the next
// downstream's. Defaults to all 140 (the broken same-expiry case).
//
// Step-through animates the preimage moving Dave → Charlie → Bob → Alice. At
// each step, exactly one contract transitions: claimed (✓) if the claim made
// its deadline, expired (✗) if it didn't. The preimage token slides between
// nodes with a CSS transition, so students see WHY each contract resolves
// the way it does.
// ────────────────────────────────────────────────────────────────────────────

const START_BLOCK = 100;
const DEFAULT_EXPIRY = 140;
const MIN_EXPIRY = START_BLOCK + 1;
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
  alice: 14,
  bob: 38,
  charlie: 62,
  dave: 86,
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
      block: START_BLOCK,
      preimageHolder: "dave",
      abStatus: "active", bcStatus: "active", cdStatus: "active",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "neutral", dave: "neutral" },
      caption: `Setup. Block ${START_BLOCK}. All three HTLCs are committed. Dave holds the preimage from his invoice. Watch what happens as time advances and each hop tries to pass the preimage upstream.`,
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
      caption: `Block ${sim.daveRevealsAt}. Just before his HTLC expires, Dave reveals the preimage on-chain to claim Charlie's payment. Dave gets ${DAVE_AMOUNT.toLocaleString("en-US")} sats. Charlie sees the preimage in Dave's claim transaction and now holds it.`,
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
        caption: `Block ${sim.charlieClaimsBobAt}. Charlie broadcasts his claim against Bob's HTLC, revealing the preimage in the process. The claim confirms before block ${sim.expiryBC}. Charlie collects ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats. Bob now holds the preimage.`,
      };
    }
    return {
      block: sim.charlieClaimsBobAt,
      preimageHolder: "charlie",
      abStatus: "active",
      bcStatus: "expired",
      cdStatus: "claimed",
      nodeOk: { alice: "neutral", bob: "neutral", charlie: "burned", dave: "ok" },
      caption: `Block ${sim.charlieClaimsBobAt}. Charlie tried to claim Bob's HTLC, but it already expired at block ${sim.expiryBC}. Bob's HTLC times out and Bob refunds. Charlie is out ${DAVE_AMOUNT.toLocaleString("en-US")} sats — he paid Dave but couldn't recover from Bob.`,
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
        caption: `Block ${sim.bobClaimsAliceAt}. Bob broadcasts his claim against Alice's HTLC. The claim confirms before block ${sim.expiryAB}. Bob collects ${ALICE_TO_BOB.toLocaleString("en-US")} sats and keeps a ${BOB_FEE}-sat fee. The route settled cleanly.`,
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
        caption: `Block ${sim.bobClaimsAliceAt}. Bob has the preimage but Alice's HTLC already expired at block ${sim.expiryAB}. Alice's timeout fired and she clawed her funds back. Bob is out ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats — he paid Charlie but couldn't recover from Alice.`,
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
      caption: `Block ${sim.bobClaimsAliceAt}. Alice's HTLC has also expired (block ${sim.expiryAB}). Bob never paid Charlie, so Bob is fine, and Alice gets refunded. Only Charlie is out of pocket.`,
    };
  }
  // step 4 — final summary
  let summary: string;
  if (sim.bobClaimSucceeds) {
    summary = `Final state. Everyone settled cleanly. Charlie earned ${CHARLIE_FEE} sats, Bob earned ${BOB_FEE} sat, Alice paid ${ALICE_TO_BOB.toLocaleString("en-US")} sats to deliver ${DAVE_AMOUNT.toLocaleString("en-US")} to Dave. The CLTV margins gave each forwarder enough time to react.`;
  } else if (sim.charlieClaimSucceeds) {
    const slack = sim.expiryAB - sim.bobClaimsAliceAt;
    summary = `Final state. Bob is out ${BOB_TO_CHARLIE.toLocaleString("en-US")} sats. His claim broadcast at block ${sim.bobClaimsAliceAt}, but Alice's HTLC expired at block ${sim.expiryAB} (${-slack + 1} block(s) too late). Try raising Alice→Bob's expiry to give Bob more slack.`;
  } else {
    const slack = sim.expiryBC - sim.charlieClaimsBobAt;
    summary = `Final state. Charlie is out ${DAVE_AMOUNT.toLocaleString("en-US")} sats. His claim broadcast at block ${sim.charlieClaimsBobAt}, but Bob's HTLC to him expired at block ${sim.expiryBC} (${-slack + 1} block(s) too late). Try raising Bob→Charlie's expiry, or reducing the per-hop claim latency.`;
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
  const [expiryAB, setExpiryAB] = useState(DEFAULT_EXPIRY);
  const [expiryBC, setExpiryBC] = useState(DEFAULT_EXPIRY);
  const [expiryCD, setExpiryCD] = useState(DEFAULT_EXPIRY);
  const [blocksPerHop, setBlocksPerHop] = useState(1);
  const [step, setStep] = useState(0);

  const sim = useMemo(
    () => simulate(expiryAB, expiryBC, expiryCD, blocksPerHop),
    [expiryAB, expiryBC, expiryCD, blocksPerHop],
  );
  const view = useMemo(() => viewAtStep(sim, step), [sim, step]);

  function clampExpiry(v: number, min: number) {
    return Math.max(min, Math.min(MAX_EXPIRY, v));
  }
  // Setters enforce the constraint expiryAB ≤ expiryBC ≤ expiryCD: as you
  // move left-to-right across the cards, expiries can only go up. Lower
  // values are clamped to the previous card's value.
  function handleSetExpiryAB(v: number) {
    const next = clampExpiry(v, MIN_EXPIRY);
    setExpiryAB(next);
    // Cascade upward: BC and CD may need to rise to keep BC ≥ AB and CD ≥ BC.
    if (expiryBC < next) {
      setExpiryBC(next);
      if (expiryCD < next) setExpiryCD(next);
    }
    setStep(0);
  }
  function handleSetExpiryBC(v: number) {
    const next = clampExpiry(v, expiryAB);
    setExpiryBC(next);
    if (expiryCD < next) setExpiryCD(next);
    setStep(0);
  }
  function handleSetExpiryCD(v: number) {
    const next = clampExpiry(v, expiryBC);
    setExpiryCD(next);
    setStep(0);
  }
  function handleSetBph(v: number) {
    setBlocksPerHop(Math.max(1, Math.min(20, v)));
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
        {/* Block counter — prominent */}
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
            minExpiry={expiryAB}
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
            minExpiry={expiryBC}
            onChange={handleSetExpiryCD}
            status={view.cdStatus}
          />
        </div>
      </div>
      </div>

      {/* Footer: Reset + step buttons + caption + bph control */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex flex-col md:flex-row md:items-start md:gap-4">
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
          <div
            className="mt-3 md:mt-0 text-sm leading-relaxed flex-1 max-w-3xl"
            style={{ color: INK }}
          >
            {view.caption}
          </div>
        </div>

        {/* Blocks-per-hop control */}
        <div className="mt-3 pt-3 border-t-[1px] border-foreground/15 flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] tracking-[0.06em] uppercase opacity-60 shrink-0"
            style={{ color: INK }}
          >
            blocks per hop (claim latency, applies to every hop)
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={blocksPerHop}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isNaN(n)) return;
              handleSetBph(n);
            }}
            className="w-14 border-[1.5px] px-1 py-0.5 text-[11px] font-bold tabular-nums"
            style={{
              borderColor: INK,
              background: "#fffdf5",
              color: INK,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}
          />
          <input
            type="range"
            min={1}
            max={20}
            value={blocksPerHop}
            onChange={(e) => handleSetBph(parseInt(e.target.value, 10))}
            style={{ flex: 1, maxWidth: 200, accentColor: AMBER }}
          />
          <span
            className="text-[10px] italic opacity-60 shrink-0"
            style={{ color: SLATE }}
          >
            Charlie claims at block {sim.charlieClaimsBobAt}, Bob at block{" "}
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
              top: 38,
              left: `calc(${startPct}% + 36px)`,
              width: `calc(${endPct - startPct}% - 72px)`,
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
              ? "Receiver"
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
                width: 76,
                height: 76,
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
    statusText = `⏱ expired — refunded to ${fromLabel}`;
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
              max={MAX_EXPIRY}
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
              title={`Editable. Must be ≥ ${minExpiry}.`}
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
