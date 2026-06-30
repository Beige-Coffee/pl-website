import { useEffect, useMemo, useRef, useState } from "react";
import { ChannelUpdateCard } from "./ChannelUpdateCard";
import { FeeCalculatorModal } from "./FeeCalculatorModal";
import { CheckpointRewardClaim } from "./CheckpointRewardClaim";

// ────────────────────────────────────────────────────────────────────────────
// RouteCalcExercise (DRAFT)
//
// Fillable version of ComputedRouteDiagram for Route C
// (Alice → Bob → Charlie → Dave, the chapter-1 path). Same overall layout as
// ComputedRouteDiagram (invoice card, route stage with channel_update cards
// above forwarders, HTLC Amount/Timeout boxes between hops, fee + timeout
// calculation rows below) but with `<input type="number">` cells where
// ComputedRouteDiagram has static values.
//
// Validation is row-based: a row goes green only when ALL of its cells hold
// the correct value. Cells lock once their row is correct. Wrong values turn
// red only after the user has either blurred the field or filled every cell
// in the row, so students don't get one-cell-at-a-time feedback they can
// brute-force.
//
// Once all 7 rows are correct, the route picker panel slides in below.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const AMBER_FILL = "#fef3c7";
const AMBER = "#b8860b";
const GREEN = "#5a7a2f";
const RED = "#a13a3a";

const HOP_PALETTE = {
  alice:   { stroke: "#b8860b", fill: "#fef3c7" },
  bob:     { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave:    { stroke: "#7b4b8a", fill: "#ede1f3" },
} as const;

// Expected values
const EXPECTED = {
  htlcAmounts: [401225, 400410, 400000] as const,
  htlcTimeouts: [223, 183, 168] as const,
  // Bob's fee math: rate = 800, total = 815 (BOLT 7 floors 800.82 to 800)
  bobFee: { rate: 800, total: 815 },
  // Charlie's fee math: rate = 400, total = 410
  charlieFee: { rate: 400, total: 410 },
  // Single timeout per card
  timeoutAliceBob: 223,
  timeoutBobCharlie: 183,
  timeoutCharlieDave: 168,
};

type CellState = {
  value: string;
  blurred: boolean;
};

const empty = (): CellState => ({ value: "", blurred: false });

// ── Answer persistence ─────────────────────────────────────────────────────
// Save the student's entered values to localStorage so they survive a reload,
// and restore them on mount. If the exercise is already completed but no local
// values exist (e.g. a different browser), show the correct answers instead of
// a blank grid.
type PersistShape = {
  htlcAmts: CellState[];
  htlcTos: CellState[];
  bobRate: CellState;
  bobTotal: CellState;
  charlieRate: CellState;
  charlieTotal: CellState;
  toAB: CellState;
  toBC: CellState;
  toCD: CellState;
};

const filledCell = (v: number): CellState => ({ value: String(v), blurred: true });

function expectedFilled(): PersistShape {
  return {
    htlcAmts: EXPECTED.htlcAmounts.map(filledCell),
    htlcTos: EXPECTED.htlcTimeouts.map(filledCell),
    bobRate: filledCell(EXPECTED.bobFee.rate),
    bobTotal: filledCell(EXPECTED.bobFee.total),
    charlieRate: filledCell(EXPECTED.charlieFee.rate),
    charlieTotal: filledCell(EXPECTED.charlieFee.total),
    toAB: filledCell(EXPECTED.timeoutAliceBob),
    toBC: filledCell(EXPECTED.timeoutBobCharlie),
    toCD: filledCell(EXPECTED.timeoutCharlieDave),
  };
}

function loadPersisted(key: string, completed: boolean): PersistShape | null {
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.htlcAmts) && p.htlcAmts.length === 3) {
        return p as PersistShape;
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return completed ? expectedFilled() : null;
}

interface CellInputProps {
  cell: CellState;
  expected: number;
  rowComplete: boolean;
  rowAttempted: boolean; // any blurred sibling
  onChange: (next: CellState) => void;
  width?: number;
  fontSize?: number;
  ariaLabel?: string;
}

function CellInput({
  cell,
  expected,
  rowComplete,
  rowAttempted,
  onChange,
  width = 86,
  fontSize = 13,
  ariaLabel,
}: CellInputProps) {
  const numeric = cell.value.trim() === "" ? null : Number(cell.value);
  const isCorrect = numeric === expected;
  // Per-cell feedback: turn this cell green the moment ITS value is correct,
  // rather than waiting for the whole row/section to be complete.
  const showRed =
    !isCorrect &&
    cell.value.trim() !== "" &&
    (cell.blurred || rowAttempted);

  let borderColor = SLATE;
  if (isCorrect) borderColor = GREEN;
  else if (showRed) borderColor = RED;

  const bg = isCorrect ? "#eaf2db" : "#fffdf5";

  return (
    <input
      type="number"
      aria-label={ariaLabel}
      value={cell.value}
      readOnly={rowComplete}
      onChange={(e) =>
        onChange({ value: e.target.value, blurred: cell.blurred })
      }
      onBlur={() => onChange({ ...cell, blurred: true })}
      className="px-1 py-0.5 tabular-nums text-center"
      style={{
        border: `1.5px solid ${borderColor}`,
        background: bg,
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize,
        width,
        outline: "none",
      }}
    />
  );
}

export const ROUTE_CALC_EXERCISE_ID = "exercise-route-calc-draft";

// Auth + reward wiring passed down from the tutorial page so the completed
// exercise can pay out sats via the shared CheckpointRewardClaim flow.
export interface RouteCalcReward {
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  lightningAddress: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  alreadyCompleted: boolean;
  claimInfo: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest: () => void;
  onCompleted: (checkpointId: string, amountSats?: number) => void;
}

export interface RouteCalcExerciseProps {
  headerless?: boolean;
  reward?: RouteCalcReward;
}

export function RouteCalcExercise({
  headerless,
  reward,
}: RouteCalcExerciseProps = {}) {
  // Persisted answers: loaded once (from localStorage, or the correct answers
  // if the exercise is already complete on this account).
  const storageKey = `pl-route-calc-draft${
    reward?.sessionToken ? `-${reward.sessionToken.slice(0, 10)}` : ""
  }`;
  const loadedRef = useRef<PersistShape | null | undefined>(undefined);
  if (loadedRef.current === undefined) {
    loadedRef.current = loadPersisted(
      storageKey,
      reward?.alreadyCompleted ?? false,
    );
  }
  const loaded = loadedRef.current;

  // Cell state
  const [htlcAmts, setHtlcAmts] = useState<CellState[]>(
    loaded?.htlcAmts ?? [empty(), empty(), empty()],
  );
  const [htlcTos, setHtlcTos] = useState<CellState[]>(
    loaded?.htlcTos ?? [empty(), empty(), empty()],
  );
  const [bobRate, setBobRate] = useState<CellState>(loaded?.bobRate ?? empty());
  const [bobTotal, setBobTotal] = useState<CellState>(
    loaded?.bobTotal ?? empty(),
  );
  const [charlieRate, setCharlieRate] = useState<CellState>(
    loaded?.charlieRate ?? empty(),
  );
  const [charlieTotal, setCharlieTotal] = useState<CellState>(
    loaded?.charlieTotal ?? empty(),
  );
  const [toAB, setToAB] = useState<CellState>(loaded?.toAB ?? empty());
  const [toBC, setToBC] = useState<CellState>(loaded?.toBC ?? empty());
  const [toCD, setToCD] = useState<CellState>(loaded?.toCD ?? empty());

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          htlcAmts,
          htlcTos,
          bobRate,
          bobTotal,
          charlieRate,
          charlieTotal,
          toAB,
          toBC,
          toCD,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    storageKey,
    htlcAmts,
    htlcTos,
    bobRate,
    bobTotal,
    charlieRate,
    charlieTotal,
    toAB,
    toBC,
    toCD,
  ]);

  // If completion status arrives after mount and the grid is still blank (e.g.
  // a different browser), reveal the correct answers.
  useEffect(() => {
    if (!reward?.alreadyCompleted) return;
    const isEmpty = [
      ...htlcAmts,
      ...htlcTos,
      bobRate,
      bobTotal,
      charlieRate,
      charlieTotal,
      toAB,
      toBC,
      toCD,
    ].every((c) => c.value.trim() === "");
    if (!isEmpty) return;
    const e = expectedFilled();
    setHtlcAmts(e.htlcAmts);
    setHtlcTos(e.htlcTos);
    setBobRate(e.bobRate);
    setBobTotal(e.bobTotal);
    setCharlieRate(e.charlieRate);
    setCharlieTotal(e.charlieTotal);
    setToAB(e.toAB);
    setToBC(e.toBC);
    setToCD(e.toCD);
  }, [reward?.alreadyCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const [calcOpen, setCalcOpen] = useState(false);
  const [pickerChoice, setPickerChoice] =
    useState<null | "a" | "b" | "c">(null);

  const eq = (c: CellState, v: number) =>
    c.value.trim() !== "" && Number(c.value) === v;

  // Row completion booleans
  const rowAmts =
    eq(htlcAmts[0], EXPECTED.htlcAmounts[0]) &&
    eq(htlcAmts[1], EXPECTED.htlcAmounts[1]) &&
    eq(htlcAmts[2], EXPECTED.htlcAmounts[2]);
  const rowTos =
    eq(htlcTos[0], EXPECTED.htlcTimeouts[0]) &&
    eq(htlcTos[1], EXPECTED.htlcTimeouts[1]) &&
    eq(htlcTos[2], EXPECTED.htlcTimeouts[2]);
  const rowBob =
    eq(bobRate, EXPECTED.bobFee.rate) &&
    eq(bobTotal, EXPECTED.bobFee.total);
  const rowCharlie =
    eq(charlieRate, EXPECTED.charlieFee.rate) &&
    eq(charlieTotal, EXPECTED.charlieFee.total);
  const rowToAB = eq(toAB, EXPECTED.timeoutAliceBob);
  const rowToBC = eq(toBC, EXPECTED.timeoutBobCharlie);
  const rowToCD = eq(toCD, EXPECTED.timeoutCharlieDave);

  // "Attempted" = any sibling cell in the row has been blurred. Encourages
  // showing red only after the user has tabbed away from at least one cell.
  const anyBlurred = (cells: CellState[]) => cells.some((c) => c.blurred);

  const attemptAmts = anyBlurred(htlcAmts);
  const attemptTos = anyBlurred(htlcTos);
  const attemptBob = anyBlurred([bobRate, bobTotal]);
  const attemptCharlie = anyBlurred([charlieRate, charlieTotal]);
  const attemptToAB = toAB.blurred;
  const attemptToBC = toBC.blurred;
  const attemptToCD = toCD.blurred;

  const completedCount = useMemo(
    () =>
      [rowAmts, rowTos, rowBob, rowCharlie, rowToAB, rowToBC, rowToCD].filter(
        Boolean,
      ).length,
    [rowAmts, rowTos, rowBob, rowCharlie, rowToAB, rowToBC, rowToCD],
  );
  const allDone = completedCount === 7;

  // Layout constants mirror ComputedRouteDiagram
  const NODE_DIAMETER = 60;
  const SEGMENT_WIDTH = 220;
  const LEFT_GUTTER = 40;
  const STAGE_PAD_X = 16;

  const HOPS = [
    { id: "alice",   name: "Alice",   role: "sender",    color: HOP_PALETTE.alice   },
    { id: "bob",     name: "Bob",     role: "forwarder", color: HOP_PALETTE.bob     },
    { id: "charlie", name: "Charlie", role: "forwarder", color: HOP_PALETTE.charlie },
    { id: "dave",    name: "Dave",    role: "receiver",  color: HOP_PALETTE.dave    },
  ] as const;

  const segmentCount = HOPS.length - 1;
  const stageInnerWidth =
    LEFT_GUTTER + segmentCount * SEGMENT_WIDTH + NODE_DIAMETER + 40;
  const minStageWidth = stageInnerWidth + STAGE_PAD_X * 2;

  const nodeX = (i: number) =>
    LEFT_GUTTER + i * SEGMENT_WIDTH + NODE_DIAMETER / 2;

  const forwarderIndices = HOPS
    .map((h, i) => ({ h, i }))
    .filter((x) => x.h.role === "forwarder")
    .map((x) => x.i);

  const channelUpdates = [
    { atForwarderIndex: 0, baseFee: 15, feePpm: 2000, cltvDelta: 40 },
    { atForwarderIndex: 1, baseFee: 10, feePpm: 1000, cltvDelta: 15 },
  ];

  return (
    <div
      className={
        headerless
          ? "border-foreground/40 bg-card overflow-hidden"
          : "my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      }
      data-testid="route-calc-exercise"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {!headerless && (
        <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
            <span className="text-sm font-bold tracking-[0.08em] uppercase">
              Compute Route C
            </span>
          </div>
        </div>
      )}

      {/* Top action strip: progress + calculator button */}
      <div
        className="px-4 py-3 flex flex-wrap items-center gap-3 border-b-[1.5px]"
        style={{
          borderColor: "rgba(15,23,42,0.15)",
          background: "#fffdf5",
        }}
      >
        <div
          className="text-[11px] tracking-[0.06em] uppercase font-bold"
          style={{
            color: allDone ? GREEN : SLATE,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
          data-testid="route-calc-progress"
        >
          Progress: {completedCount} / 7 rows complete
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          className="px-3 py-1.5 border-[1.5px] text-xs font-bold uppercase tracking-[0.05em] hover:opacity-90 transition-opacity"
          style={{
            borderColor: AMBER,
            background: "#fef3c7",
            color: INK,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
          data-testid="open-fee-calculator"
        >
          🧮 Open fee calculator
        </button>
      </div>

      {/* Stage */}
      <div className="overflow-x-auto">
        <div
          className="relative bg-[#fefdfb] px-4 py-6"
          style={{ minWidth: minStageWidth }}
        >
          {/* Invoice (static) */}
          <div className="mb-4">
            <div
              className="border-[1.5px]"
              style={{
                width: 220,
                borderColor: INK,
                background: "#fffdf5",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="px-2 py-1"
                style={{ background: AMBER, color: "#fffdf5" }}
              >
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{
                    letterSpacing: "0.12em",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  }}
                >
                  Invoice
                </span>
              </div>
              <div
                style={{ borderBottom: "1.5px dashed #475569", height: 0 }}
              />
              <div
                className="px-3 py-2 leading-snug"
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 11,
                  color: INK,
                }}
              >
                <div className="mb-0.5">
                  <span style={{ color: SLATE }}>Product: </span>
                  <span className="font-bold">Double-Espresso w/ Raw Milk</span>
                </div>
                <div className="mb-0.5">
                  <span style={{ color: SLATE }}>Amount: </span>
                  <span className="font-bold tabular-nums">400,000 sats</span>
                </div>
                <div className="mb-0.5 flex items-baseline gap-1">
                  <span style={{ color: SLATE }}>
                    <code
                      style={{
                        fontFamily:
                          '"JetBrains Mono", "Fira Code", monospace',
                        background: "#f1f5f9",
                        border: "1px solid rgba(15,23,42,0.14)",
                        padding: "0 4px",
                        fontSize: "0.92em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      min_final_cltv_expiry_delta
                    </code>
                    :
                  </span>
                  <span className="font-bold tabular-nums">18</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span style={{ color: SLATE }}>
                    <code
                      style={{
                        fontFamily:
                          '"JetBrains Mono", "Fira Code", monospace',
                        background: "#f1f5f9",
                        border: "1px solid rgba(15,23,42,0.14)",
                        padding: "0 4px",
                        fontSize: "0.92em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      payment_hash
                    </code>
                    :
                  </span>
                  <span className="font-bold">566..c62</span>
                </div>
              </div>
            </div>
          </div>

          {/* Route stage */}
          <div
            className="relative mx-auto"
            style={{ width: stageInnerWidth, height: 280 }}
          >
            {/* Backbone connectors */}
            {Array.from({ length: segmentCount }).map((_, i) => {
              const startX = nodeX(i) + NODE_DIAMETER / 2;
              const endX = nodeX(i + 1) - NODE_DIAMETER / 2;
              return (
                <div
                  key={`backbone-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: 130,
                    left: startX,
                    width: endX - startX,
                    borderTop: "1.5px dashed #475569",
                  }}
                />
              );
            })}

            {/* Channel-update cards above each forwarder */}
            {channelUpdates.map((cu) => {
              const hopIdx = forwarderIndices[cu.atForwarderIndex];
              if (hopIdx === undefined) return null;
              const x = nodeX(hopIdx);
              const hop = HOPS[hopIdx];
              return (
                <div
                  key={`cu-${cu.atForwarderIndex}`}
                  className="absolute"
                  style={{ top: 0, left: x - 80 }}
                >
                  <ChannelUpdateCard
                    baseFee={cu.baseFee}
                    feePpm={cu.feePpm}
                    cltvDelta={cu.cltvDelta}
                    hopColor={hop.color}
                  />
                </div>
              );
            })}

            {/* Connector lines from each cu card down to its forwarder */}
            {channelUpdates.map((cu) => {
              const hopIdx = forwarderIndices[cu.atForwarderIndex];
              if (hopIdx === undefined) return null;
              const x = nodeX(hopIdx);
              return (
                <div
                  key={`cu-line-${cu.atForwarderIndex}`}
                  className="absolute pointer-events-none"
                  style={{
                    top: 92,
                    left: x - 1,
                    width: 0,
                    height: 18,
                    borderLeft: "1.5px dashed #475569",
                  }}
                />
              );
            })}

            {/* Per-segment HTLC Amount + HTLC Timeout boxes (with inputs) */}
            {Array.from({ length: segmentCount }).map((_, i) => {
              const startX = nodeX(i);
              const endX = nodeX(i + 1);
              const centerX = (startX + endX) / 2;
              return (
                <div
                  key={`htlc-box-${i}`}
                  className="absolute flex flex-col items-stretch gap-1"
                  style={{
                    top: 150,
                    left: centerX - 75,
                    width: 150,
                  }}
                >
                  <div
                    className="border-[1.5px] px-2 py-1.5"
                    style={{
                      borderColor: AMBER,
                      background: AMBER_FILL,
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <div
                      className="text-[10px] tracking-[0.05em] uppercase opacity-70"
                      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                    >
                      HTLC Amount
                    </div>
                    <CellInput
                      cell={htlcAmts[i]}
                      expected={EXPECTED.htlcAmounts[i]}
                      rowComplete={rowAmts}
                      rowAttempted={attemptAmts}
                      onChange={(next) =>
                        setHtlcAmts((prev) =>
                          prev.map((c, j) => (j === i ? next : c)),
                        )
                      }
                      width={120}
                      fontSize={14}
                      ariaLabel={`HTLC Amount ${i + 1}`}
                    />
                  </div>
                  <div
                    className="border-[1.5px] px-2 py-1.5"
                    style={{
                      borderColor: AMBER,
                      background: AMBER_FILL,
                      color: INK,
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    }}
                  >
                    <div
                      className="text-[10px] tracking-[0.05em] uppercase opacity-70"
                      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
                    >
                      HTLC Timeout
                    </div>
                    <CellInput
                      cell={htlcTos[i]}
                      expected={EXPECTED.htlcTimeouts[i]}
                      rowComplete={rowTos}
                      rowAttempted={attemptTos}
                      onChange={(next) =>
                        setHtlcTos((prev) =>
                          prev.map((c, j) => (j === i ? next : c)),
                        )
                      }
                      width={120}
                      fontSize={14}
                      ariaLabel={`HTLC Timeout ${i + 1}`}
                    />
                  </div>
                </div>
              );
            })}

            {/* Node circles */}
            {HOPS.map((hop, i) => {
              const x = nodeX(i);
              const stroke = hop.color.stroke;
              const fill = hop.color.fill;
              const role =
                hop.role === "sender"
                  ? "Sender"
                  : hop.role === "receiver"
                    ? "Destination"
                    : "Forwarder";
              return (
                <div
                  key={hop.id}
                  className="absolute flex flex-col items-center"
                  style={{
                    top: 100,
                    left: x - NODE_DIAMETER / 2,
                    width: NODE_DIAMETER,
                  }}
                >
                  <div
                    className="rounded-full border-[2px] flex items-center justify-center"
                    style={{
                      width: NODE_DIAMETER,
                      height: NODE_DIAMETER,
                      background: fill,
                      borderColor: stroke,
                      color: INK,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    <span className="text-base font-bold">{hop.name[0]}</span>
                  </div>
                  <div
                    className="mt-1 text-[10px] font-bold tracking-[0.05em]"
                    style={{ color: INK }}
                  >
                    {hop.name}
                  </div>
                  <div
                    className="text-[8px] tracking-[0.05em] uppercase"
                    style={{ color: SLATE }}
                  >
                    {role}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calculation rows */}
          <div className="mt-4 flex flex-col gap-3">
            <CalcRow label="Fees">
              <FillableFeeCard
                forwarderName="Bob"
                baseFee={15}
                feePpm={2000}
                amount={400410}
                rate={bobRate}
                total={bobTotal}
                onRateChange={setBobRate}
                onTotalChange={setBobTotal}
                rowComplete={rowBob}
                rowAttempted={attemptBob}
                expectedRateOverride={EXPECTED.bobFee.rate}
                expectedTotalOverride={EXPECTED.bobFee.total}
              />
              <FillableFeeCard
                forwarderName="Charlie"
                baseFee={10}
                feePpm={1000}
                amount={400000}
                rate={charlieRate}
                total={charlieTotal}
                onRateChange={setCharlieRate}
                onTotalChange={setCharlieTotal}
                rowComplete={rowCharlie}
                rowAttempted={attemptCharlie}
              />
            </CalcRow>
            <CalcRow label="HTLC Timeout">
              <FillableTimeoutCard
                label="HTLC Timeout (Alice → Bob)"
                expression="150 + 18 + 15 + 40"
                cell={toAB}
                expected={EXPECTED.timeoutAliceBob}
                rowComplete={rowToAB}
                rowAttempted={attemptToAB}
                onChange={setToAB}
              />
              <FillableTimeoutCard
                label="HTLC Timeout (Bob → Charlie)"
                expression="150 + 18 + 15"
                cell={toBC}
                expected={EXPECTED.timeoutBobCharlie}
                rowComplete={rowToBC}
                rowAttempted={attemptToBC}
                onChange={setToBC}
              />
              <FillableTimeoutCard
                label="HTLC Timeout (Charlie → Dave)"
                expression="150 + 18"
                cell={toCD}
                expected={EXPECTED.timeoutCharlieDave}
                rowComplete={rowToCD}
                rowAttempted={attemptToCD}
                onChange={setToCD}
              />
            </CalcRow>
          </div>

          {/* Route picker reveal */}
          <div
            className="overflow-hidden"
            style={{
              transition:
                "max-height 600ms ease-in-out, opacity 600ms ease-in-out, margin-top 600ms ease-in-out",
              maxHeight: allDone ? 360 : 0,
              opacity: allDone ? 1 : 0,
              marginTop: allDone ? 16 : 0,
            }}
            aria-hidden={!allDone}
          >
            <RoutePickerPanel
              choice={pickerChoice}
              onChoose={setPickerChoice}
            />
          </div>

          {reward && (allDone || reward.alreadyCompleted) && (
            <div style={{ marginTop: 16 }}>
              <CheckpointRewardClaim
                checkpointId={ROUTE_CALC_EXERCISE_ID}
                answer={0}
                theme={reward.theme}
                authenticated={reward.authenticated}
                sessionToken={reward.sessionToken}
                lightningAddress={reward.lightningAddress}
                emailVerified={reward.emailVerified}
                pubkey={reward.pubkey}
                alreadyCompleted={reward.alreadyCompleted}
                claimInfo={reward.claimInfo}
                onLoginRequest={reward.onLoginRequest}
                onCompleted={reward.onCompleted}
              />
            </div>
          )}
        </div>
      </div>

      <FeeCalculatorModal
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
      />
    </div>
  );
}

function CalcRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch md:gap-3">
      <div
        className="md:w-28 shrink-0 mb-2 md:mb-0 flex md:items-start"
        style={{ color: INK }}
      >
        <span
          className="text-[12px] font-bold tracking-[0.08em] uppercase"
          style={{ color: SLATE }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 flex-1">{children}</div>
    </div>
  );
}

interface FillableFeeCardProps {
  forwarderName: string;
  baseFee: number;
  feePpm: number;
  amount: number;
  rate: CellState;
  total: CellState;
  onRateChange: (next: CellState) => void;
  onTotalChange: (next: CellState) => void;
  rowComplete: boolean;
  rowAttempted: boolean;
  /** Optional override (e.g. when the chapter rounds an exact float for clarity) */
  expectedRateOverride?: number;
  expectedTotalOverride?: number;
}

function FillableFeeCard({
  forwarderName,
  baseFee,
  feePpm,
  amount,
  rate,
  total,
  onRateChange,
  onTotalChange,
  rowComplete,
  rowAttempted,
  expectedRateOverride,
  expectedTotalOverride,
}: FillableFeeCardProps) {
  const expectedRate =
    expectedRateOverride ?? Math.floor((feePpm * amount) / 1_000_000);
  const expectedTotal = expectedTotalOverride ?? baseFee + expectedRate;

  return (
    <div
      className="px-3 py-2 flex-1 min-w-[420px]"
      style={{
        border: `1.5px dashed ${rowComplete ? GREEN : SLATE}`,
        background: rowComplete ? "#eaf2db" : "#fffdf5",
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <div
        className="text-[12px] font-bold tracking-[0.06em] uppercase mb-1.5 pb-1 border-b-[1px] border-foreground/15 flex items-center justify-between"
        style={{
          color: INK,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span>Calculate {forwarderName}'s Fees</span>
        {rowComplete && (
          <span style={{ color: GREEN, fontSize: 14 }} aria-label="row complete">
            ✓
          </span>
        )}
      </div>
      <div className="text-[12px] leading-relaxed space-y-0.5">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span style={{ color: SLATE, minWidth: 70, display: "inline-block" }}>
            Base Fee
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="font-bold tabular-nums">{baseFee}</span>
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span style={{ color: SLATE, minWidth: 70, display: "inline-block" }}>
            Proportional Fee
          </span>
          <span style={{ color: SLATE }}>=</span>
          <span className="tabular-nums">
            ({feePpm.toLocaleString("en-US")} / 1,000,000) ×{" "}
            {amount.toLocaleString("en-US")}
          </span>
          <span style={{ color: SLATE }}>=</span>
          <CellInput
            cell={rate}
            expected={expectedRate}
            rowComplete={rowComplete}
            rowAttempted={rowAttempted}
            onChange={onRateChange}
            ariaLabel={`${forwarderName} fee rate result`}
          />
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap pt-1 mt-1 border-t-[1px] border-foreground/15">
          <span
            style={{
              color: INK,
              fontWeight: 700,
              minWidth: 70,
              display: "inline-block",
            }}
          >
            Total
          </span>
          <span style={{ color: SLATE }}>=</span>
          <CellInput
            cell={total}
            expected={expectedTotal}
            rowComplete={rowComplete}
            rowAttempted={rowAttempted}
            onChange={onTotalChange}
            ariaLabel={`${forwarderName} fee total`}
          />
        </div>
      </div>
    </div>
  );
}

interface FillableTimeoutCardProps {
  label: string;
  expression: string;
  cell: CellState;
  expected: number;
  rowComplete: boolean;
  rowAttempted: boolean;
  onChange: (next: CellState) => void;
}

function FillableTimeoutCard({
  label,
  expression,
  cell,
  expected,
  rowComplete,
  rowAttempted,
  onChange,
}: FillableTimeoutCardProps) {
  return (
    <div
      className="px-3 py-2 flex-1 min-w-[240px]"
      style={{
        border: `1.5px dashed ${rowComplete ? GREEN : SLATE}`,
        background: rowComplete ? "#eaf2db" : "#fffdf5",
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      <div
        className="text-[12px] font-bold tracking-[0.06em] uppercase mb-1 flex items-center justify-between"
        style={{
          color: INK,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span>{label}</span>
        {rowComplete && (
          <span style={{ color: GREEN, fontSize: 14 }} aria-label="row complete">
            ✓
          </span>
        )}
      </div>
      <div className="text-[12px] leading-snug flex items-baseline gap-1.5 flex-wrap">
        <span style={{ color: SLATE }}>=</span>
        <span className="tabular-nums">{expression}</span>
        <span style={{ color: SLATE }}>=</span>
        <CellInput
          cell={cell}
          expected={expected}
          rowComplete={rowComplete}
          rowAttempted={rowAttempted}
          onChange={onChange}
          ariaLabel={label}
        />
      </div>
    </div>
  );
}

function RoutePickerPanel({
  choice,
  onChoose,
}: {
  choice: null | "a" | "b" | "c";
  onChoose: (c: "a" | "b" | "c") => void;
}) {
  const correct = choice === "c";
  const wrong = choice !== null && choice !== "c";

  let panelBorder = AMBER;
  let panelBg = "#fef3c7";
  if (correct) {
    panelBorder = GREEN;
    panelBg = "#eaf2db";
  } else if (wrong) {
    panelBorder = RED;
    panelBg = "#fde0e0";
  }

  return (
    <div
      className="px-4 py-4"
      style={{
        border: `1.5px solid ${panelBorder}`,
        background: panelBg,
        color: INK,
      }}
      data-testid="route-picker-panel"
    >
      <div
        className="text-[12px] font-bold tracking-[0.08em] uppercase mb-3"
        style={{ color: INK }}
      >
        Pick the cheapest route Alice can use
      </div>
      <div className="flex flex-wrap gap-2">
        <RouteChoiceButton
          label="Route A, 900 sats"
          selected={choice === "a"}
          isCorrect={false}
          finalized={choice !== null}
          onClick={() => onChoose("a")}
        />
        <RouteChoiceButton
          label="Route B, 2,002 sats"
          selected={choice === "b"}
          isCorrect={false}
          finalized={choice !== null}
          onClick={() => onChoose("b")}
        />
        <RouteChoiceButton
          label="Route C, 1,225 sats"
          selected={choice === "c"}
          isCorrect={true}
          finalized={choice !== null}
          onClick={() => onChoose("c")}
        />
      </div>

      {choice && (
        <div
          className="mt-3 text-[13px] leading-relaxed"
          style={{ color: INK }}
          data-testid="route-picker-feedback"
        >
          {choice === "c" && (
            <span>
              <strong style={{ color: GREEN }}>✓ Correct.</strong> Route A is
              cheaper on fees (900 sats), but its 1,018-block CLTV delta blows
              past Alice's 200-block ceiling, so her wallet won't touch it.
              Among the routes Alice can actually use, Route C wins at 1,225
              sats, 777 sats less than Route B. It's also the same path she
              picked back in chapter 1: through Bob and Charlie.
            </span>
          )}
          {choice === "a" && (
            <span>
              <strong style={{ color: RED }}>✗ Not quite.</strong> Route A is
              the cheapest on fees (900 sats), but Hazel's 1,000-block
              cltv_expiry_delta pushes the total CLTV to 1,018 blocks, way over
              Alice's 200-block ceiling, so she can't use it. Pick the cheapest
              route that fits the ceiling.
            </span>
          )}
          {choice === "b" && (
            <span>
              <strong style={{ color: RED }}>✗ That's actually the most expensive option.</strong>{" "}
              Route B costs 2,002 sats, 777 sats more than Route C.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RouteChoiceButton({
  label,
  selected,
  isCorrect,
  finalized,
  onClick,
}: {
  label: string;
  selected: boolean;
  isCorrect: boolean;
  finalized: boolean;
  onClick: () => void;
}) {
  let border = SLATE;
  let bg = "#fffdf5";
  if (selected && isCorrect) {
    border = GREEN;
    bg = "#eaf2db";
  } else if (selected && !isCorrect) {
    border = RED;
    bg = "#fde0e0";
  } else if (finalized && isCorrect) {
    // Highlight the right answer when user picked wrong
    border = GREEN;
    bg = "#eaf2db";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={finalized}
      className="px-3 py-2 text-[12px] font-bold tracking-[0.05em] tabular-nums"
      style={{
        border: `1.5px solid ${border}`,
        background: bg,
        color: INK,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        cursor: finalized ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default RouteCalcExercise;
