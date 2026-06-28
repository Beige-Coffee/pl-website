import { useState, useEffect } from "react";
import { Tooltip } from "./Tooltip";
import { CheckpointRewardClaim } from "./CheckpointRewardClaim";

// ────────────────────────────────────────────────────────────────────────────
// KnowledgeMatrix (DRAFT)
//
// Interactive privacy-properties rubric. Rows are the four participants in
// the running Alice → Bob → Charlie → Dave example; columns are facts about
// the payment. The student clicks each cell to mark whether that participant
// should *know* or *not know* that fact, then submits the whole grid for
// feedback.
//
// Pedagogical goal: teach the asymmetry of the privacy rubric. Once filled
// in correctly, Alice's row is all "knows," Bob/Charlie's rows are almost
// entirely "doesn't know," and Dave's row is in between. The shape of the
// answer is itself the lesson.
//
// Visual style follows the locked Onion Routing format: black header bar
// with gold dot, cream stage (#fefdfb), 1.5px ink borders, JetBrains Mono
// for protocol-y bits, sans-serif elsewhere. Canonical hop palette for
// participant rows, gold-on-cream for the active/selected state.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const GOLD = "#b8860b";
const GREEN = "#5a7a2f";
const RED = "#a13a3a";

type Answer = "knows" | "doesnt-know";
type ParticipantId = "alice" | "bob" | "charlie" | "dave";
type FactId =
  | "sender"
  | "recipient"
  | "route-length"
  | "position"
  | "payment-hash"
  | "total-amount";

interface Participant {
  id: ParticipantId;
  name: string;
  role: string;
  hop: { stroke: string; fill: string };
}

const PARTICIPANTS: Participant[] = [
  { id: "alice",   name: "Alice",   role: "Sender",     hop: { stroke: "#b8860b", fill: "#fef3c7" } },
  { id: "bob",     name: "Bob",     role: "Forwarder",  hop: { stroke: "#3b6aa0", fill: "#dbeafe" } },
  { id: "charlie", name: "Charlie", role: "Forwarder",  hop: { stroke: "#2d7a7a", fill: "#ccece8" } },
  { id: "dave",    name: "Dave",    role: "Destination", hop: { stroke: "#7b4b8a", fill: "#ede1f3" } },
];

interface Fact {
  id: FactId;
  short: string;       // column header (compact)
  long: string;        // explanatory tooltip text
}

const FACTS: Fact[] = [
  {
    id: "sender",
    short: "Sender's identity",
    long: "Who originally sent the payment (Alice).",
  },
  {
    id: "recipient",
    short: "Recipient's identity",
    long: "Who the final recipient of the payment is (Dave).",
  },
  {
    id: "route-length",
    short: "Total route length",
    long: "How many hops are in the route from sender to recipient.",
  },
  {
    id: "position",
    short: "Own position",
    long: "Their own position in the route (first hop? middle? last?).",
  },
  {
    id: "payment-hash",
    short: "Payment hash",
    long: "The payment hash that ties every HTLC in the route together.",
  },
  {
    id: "total-amount",
    short: "Total amount Alice paid",
    long: "The total amount Alice originally paid, including every forwarder's fee.",
  },
];

// The canonical answer for each cell. This is what the chapter's rubric
// section actually asserts.
const CORRECT: Record<ParticipantId, Record<FactId, Answer>> = {
  alice: {
    sender:        "knows",
    recipient:     "knows",
    "route-length": "knows",
    position:      "knows",
    "payment-hash": "knows",
    "total-amount": "knows",
  },
  bob: {
    sender:        "doesnt-know",
    recipient:     "doesnt-know",
    "route-length": "doesnt-know",
    position:      "doesnt-know",
    "payment-hash": "knows",
    "total-amount": "doesnt-know",
  },
  charlie: {
    sender:        "doesnt-know",
    recipient:     "doesnt-know",
    "route-length": "doesnt-know",
    position:      "doesnt-know",
    "payment-hash": "knows",
    "total-amount": "doesnt-know",
  },
  dave: {
    sender:        "doesnt-know",
    recipient:     "knows",
    "route-length": "doesnt-know",
    position:      "knows",
    "payment-hash": "knows",
    "total-amount": "doesnt-know",
  },
};

type AnswerMap = Record<ParticipantId, Record<FactId, Answer | null>>;

function emptyAnswers(): AnswerMap {
  const out = {} as AnswerMap;
  for (const p of PARTICIPANTS) {
    out[p.id] = {} as Record<FactId, Answer | null>;
    for (const f of FACTS) out[p.id][f.id] = null;
  }
  return out;
}

// The fully-correct grid + an all-cells-locked map, used to restore the
// completed state when the student has already finished this checkpoint.
function fullCorrectAnswers(): AnswerMap {
  const out = {} as AnswerMap;
  for (const p of PARTICIPANTS) {
    out[p.id] = {} as Record<FactId, Answer | null>;
    for (const f of FACTS) out[p.id][f.id] = CORRECT[p.id][f.id];
  }
  return out;
}

function allLockedMap(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const p of PARTICIPANTS) for (const f of FACTS) out[`${p.id}:${f.id}`] = true;
  return out;
}

interface KnowledgeMatrixProps {
  // When wired as a real checkpoint, these enable saving completion + claiming
  // the sat reward. Omitted (standalone) renders just the interactive grid.
  checkpointId?: string;
  theme?: "light" | "dark";
  authenticated?: boolean;
  sessionToken?: string | null;
  lightningAddress?: string | null;
  emailVerified?: boolean;
  pubkey?: string | null;
  alreadyCompleted?: boolean;
  claimInfo?: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest?: () => void;
  onCompleted?: (checkpointId: string, amountSats?: number) => void;
  onOpenProfile?: () => void;
}

export function KnowledgeMatrix({
  checkpointId,
  theme = "light",
  authenticated = false,
  sessionToken = null,
  lightningAddress = null,
  emailVerified = false,
  pubkey = null,
  alreadyCompleted = false,
  claimInfo = null,
  onLoginRequest,
  onCompleted,
  onOpenProfile,
}: KnowledgeMatrixProps = {}) {
  // Persist the in-progress grid to localStorage (scoped per user, mirroring
  // CheckpointQuestion) so a reload never wipes the student's work, even before
  // they submit or log in. When the checkpoint is already completed server-side,
  // that state is authoritative and we ignore any local draft.
  const userSuffix = sessionToken ? `-${sessionToken.slice(0, 8)}` : "";
  const storageKey = `pl-km-${checkpointId ?? "standalone"}${userSuffix}`;

  const restored = (() => {
    if (alreadyCompleted) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return JSON.parse(raw) as {
          answers: AnswerMap;
          submitted: boolean;
          locked: Record<string, boolean>;
        };
      }
    } catch {}
    return null;
  })();

  const [answers, setAnswers] = useState<AnswerMap>(() =>
    alreadyCompleted ? fullCorrectAnswers() : (restored?.answers ?? emptyAnswers()),
  );
  const [submitted, setSubmitted] = useState(
    alreadyCompleted || !!restored?.submitted,
  );
  // Cells the student has already gotten right and locked in. "Try again"
  // keeps these and only clears the wrong ones, so prior work isn't lost.
  const [locked, setLocked] = useState<Record<string, boolean>>(() =>
    alreadyCompleted ? allLockedMap() : (restored?.locked ?? {}),
  );

  // Save the in-progress attempt whenever it changes. Once completed
  // server-side, the alreadyCompleted prop is the source of truth, so skip.
  useEffect(() => {
    if (alreadyCompleted) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, submitted, locked }),
      );
    } catch {}
  }, [answers, submitted, locked, alreadyCompleted, storageKey]);

  const cellKey = (p: ParticipantId, f: FactId) => `${p}:${f}`;

  function setCell(p: ParticipantId, f: FactId, v: Answer) {
    if (submitted) return;
    if (locked[cellKey(p, f)]) return;
    setAnswers((prev) => ({
      ...prev,
      [p]: { ...prev[p], [f]: v },
    }));
  }

  const totalCells = PARTICIPANTS.length * FACTS.length;
  const filledCells = PARTICIPANTS.reduce(
    (acc, p) =>
      acc +
      FACTS.filter((f) => answers[p.id][f.id] !== null).length,
    0,
  );
  const allFilled = filledCells === totalCells;

  let correctCount = 0;
  if (submitted) {
    for (const p of PARTICIPANTS) {
      for (const f of FACTS) {
        if (answers[p.id][f.id] === CORRECT[p.id][f.id]) correctCount++;
      }
    }
  }

  // Reward is earned once the whole grid is correct (or was on a prior visit).
  const allCorrectNow = submitted && correctCount === totalCells;
  const earned = alreadyCompleted || allCorrectNow;

  // "Try again": lock in the cells that are now correct and clear only the
  // wrong ones, so the student keeps the progress they already earned.
  function tryAgain() {
    const nextLocked = { ...locked };
    const nextAnswers = emptyAnswers();
    for (const p of PARTICIPANTS) {
      for (const f of FACTS) {
        const cur = answers[p.id][f.id];
        if (cur === CORRECT[p.id][f.id]) {
          nextLocked[cellKey(p.id, f.id)] = true;
          nextAnswers[p.id][f.id] = cur;
        }
      }
    }
    setLocked(nextLocked);
    setAnswers(nextAnswers);
    setSubmitted(false);
  }

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-knowledge-matrix"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black header bar */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            What does each participant know?
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="p-4 bg-[#fefdfb]">
        <p
          className="text-sm mb-3"
          style={{ color: SLATE, lineHeight: 1.55 }}
        >
          For each participant in the route Alice → Bob → Charlie → Dave, mark
          whether they should <strong style={{ color: GREEN }}>know</strong> or{" "}
          <strong style={{ color: RED }}>not know</strong> each piece of
          information after the payment completes. Think about this strictly{" "}
          <strong style={{ color: INK }}>from the protocol's perspective</strong>:
          what each participant learns from the bytes that flow across the
          network, not from any out-of-band context (like Alice telling Dave in
          person that she's about to pay him).
        </p>

        <div className="overflow-x-auto">
          <table
            className="border-collapse"
            style={{ minWidth: 720, width: "100%" }}
          >
            <thead>
              <tr>
                <th
                  className="text-left p-2 border-[1.5px]"
                  style={{
                    borderColor: INK,
                    background: "#fffdf5",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: SLATE,
                    width: 130,
                  }}
                >
                  Participant
                </th>
                {FACTS.map((f) => (
                  <th
                    key={f.id}
                    className="p-2 border-[1.5px] text-center"
                    style={{
                      borderColor: INK,
                      background: "#fffdf5",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: INK,
                      lineHeight: 1.3,
                      verticalAlign: "bottom",
                    }}
                  >
                    <Tooltip label={f.long}>
                      <span style={{ cursor: "help" }}>{f.short}</span>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARTICIPANTS.map((p) => (
                <tr key={p.id}>
                  {/* Row label: hop circle + name + role */}
                  <td
                    className="p-2 border-[1.5px]"
                    style={{
                      borderColor: INK,
                      background: "#fffdf5",
                      verticalAlign: "middle",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 36,
                          height: 36,
                          flex: "0 0 36px",
                          background: p.hop.fill,
                          border: `2px solid ${p.hop.stroke}`,
                          color: INK,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div className="leading-tight">
                        <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: SLATE,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {p.role}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Each fact cell */}
                  {FACTS.map((f) => {
                    const studentAnswer = answers[p.id][f.id];
                    const correctAnswer = CORRECT[p.id][f.id];
                    const isLocked = locked[cellKey(p.id, f.id)];
                    const isCorrect =
                      isLocked || (submitted && studentAnswer === correctAnswer);
                    const isWrong =
                      submitted &&
                      !isLocked &&
                      studentAnswer !== null &&
                      studentAnswer !== correctAnswer;
                    const cellBg = isCorrect
                      ? "#eaf2db"
                      : isWrong
                        ? "#fde0e0"
                        : "#fffdf5";
                    const cellBorder = isCorrect
                      ? GREEN
                      : isWrong
                        ? RED
                        : INK;
                    return (
                      <td
                        key={f.id}
                        className="p-1 border-[1.5px] text-center"
                        style={{
                          borderColor: cellBorder,
                          background: cellBg,
                          minWidth: 90,
                        }}
                      >
                        <div className="flex flex-col gap-1 items-stretch">
                          <CellButton
                            label="Knows"
                            symbol="✓"
                            color={GREEN}
                            selected={studentAnswer === "knows"}
                            disabled={submitted || isLocked}
                            submitted={submitted || isLocked}
                            onClick={() => setCell(p.id, f.id, "knows")}
                          />
                          <CellButton
                            label="Doesn't"
                            symbol="✗"
                            color={RED}
                            selected={studentAnswer === "doesnt-know"}
                            disabled={submitted || isLocked}
                            submitted={submitted || isLocked}
                            onClick={() => setCell(p.id, f.id, "doesnt-know")}
                          />
                          {submitted && isWrong && (
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: GREEN,
                                marginTop: 2,
                                fontFamily:
                                  '"JetBrains Mono", "Fira Code", monospace',
                                letterSpacing: "0.03em",
                                textTransform: "uppercase",
                              }}
                            >
                              ✓ {correctAnswer === "knows" ? "knows" : "doesn't"}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Controls + status */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {!submitted ? (
            <>
              <button
                onClick={() => setSubmitted(true)}
                disabled={!allFilled}
                className="px-4 py-2 border-[1.5px] font-bold text-xs uppercase tracking-[0.06em] transition-colors"
                style={{
                  borderColor: INK,
                  background: allFilled ? "#000" : "#e5e5e5",
                  color: allFilled ? "#fffdf5" : SLATE,
                  cursor: allFilled ? "pointer" : "not-allowed",
                  opacity: allFilled ? 1 : 0.7,
                }}
                onMouseEnter={(e) => {
                  if (allFilled) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      GOLD;
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      GOLD;
                  }
                }}
                onMouseLeave={(e) => {
                  if (allFilled) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "#000";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      INK;
                  }
                }}
              >
                Check answers
              </button>
              <span style={{ fontSize: 12, color: SLATE }}>
                {filledCells} / {totalCells} cells filled
              </span>
            </>
          ) : (
            <>
              <div
                className="px-3 py-2 border-[1.5px] flex items-center gap-2"
                style={{
                  borderColor: INK,
                  background: correctCount === totalCells ? "#eaf2db" : "#fffdf5",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: correctCount === totalCells ? GREEN : INK,
                  }}
                >
                  {correctCount} / {totalCells} correct
                </span>
                {correctCount === totalCells && (
                  <span
                    style={{
                      fontSize: 11,
                      color: GREEN,
                      fontStyle: "italic",
                    }}
                  >
                    nailed it
                  </span>
                )}
              </div>
              {correctCount < totalCells && (
              <button
                onClick={tryAgain}
                className="px-3 py-2 border-[1.5px] font-bold text-xs uppercase tracking-[0.06em] transition-colors"
                style={{
                  borderColor: INK,
                  background: "#fffdf5",
                  color: INK,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = GOLD;
                  (e.currentTarget as HTMLButtonElement).style.color = "#fffdf5";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = GOLD;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#fffdf5";
                  (e.currentTarget as HTMLButtonElement).style.color = INK;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = INK;
                }}
              >
                Try again
              </button>
              )}
            </>
          )}
        </div>

        {earned && checkpointId && (
          <div
            className="mt-4 pt-4 border-t-[1.5px]"
            style={{ borderColor: `${INK}25` }}
            data-testid="knowledge-matrix-reward"
          >
            <CheckpointRewardClaim
              checkpointId={checkpointId}
              answer={0}
              theme={theme}
              authenticated={authenticated}
              sessionToken={sessionToken}
              lightningAddress={lightningAddress}
              emailVerified={emailVerified}
              pubkey={pubkey}
              alreadyCompleted={alreadyCompleted}
              claimInfo={claimInfo}
              onLoginRequest={onLoginRequest ?? (() => {})}
              onCompleted={onCompleted ?? (() => {})}
              onOpenProfile={onOpenProfile}
            />
          </div>
        )}

        {submitted && correctCount < totalCells && (
          <div
            className="mt-3 px-3 py-2 border-[1.5px] text-xs"
            style={{
              borderColor: `${INK}40`,
              background: "#faf6e8",
              color: SLATE,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: INK }}>Tip:</strong> The privacy rubric is
            asymmetric. Alice (the sender) is the only one who needs to see the
            full picture. Bob and Charlie should know almost nothing about the
            wider route, only their immediate neighbors and the slice they're
            forwarding. Dave (the destination) sits in between: he knows the
            payment is for him and learns whatever metadata Alice put in the
            invoice, but not who paid him or how the route reached him.
          </div>
        )}
      </div>
    </div>
  );
}

interface CellButtonProps {
  label: string;
  symbol: string;
  color: string;
  selected: boolean;
  disabled: boolean;
  submitted: boolean;
  onClick: () => void;
}

function CellButton({
  label,
  symbol,
  color,
  selected,
  disabled,
  submitted,
  onClick,
}: CellButtonProps) {
  // After submission, only the option the student picked shows in color.
  // The unpicked option fades to neutral gray so the answer they committed
  // to is visually unambiguous.
  const grayed = submitted && !selected;
  const borderColor = grayed
    ? "#cbd5e1"
    : selected
      ? color
      : `${INK}30`;
  const background = grayed
    ? "#f1f5f9"
    : selected
      ? color
      : "#fffdf5";
  const textColor = grayed ? "#94a3b8" : selected ? "#fffdf5" : INK;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-[1.5px] flex items-center justify-center gap-1 transition-colors"
      style={{
        borderColor,
        background,
        color: textColor,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.03em",
        padding: "4px 6px",
        cursor: disabled ? "default" : "pointer",
        opacity: grayed ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !selected) {
          (e.currentTarget as HTMLButtonElement).style.background = `${color}20`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = color;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !selected) {
          (e.currentTarget as HTMLButtonElement).style.background = "#fffdf5";
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${INK}30`;
        }
      }}
    >
      <span style={{ fontWeight: 900 }}>{symbol}</span>
      <span>{label}</span>
    </button>
  );
}

export default KnowledgeMatrix;
