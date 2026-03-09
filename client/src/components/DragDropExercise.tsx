import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

interface DragDropExerciseProps {
  checkpointId: string;
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
  onOpenProfile?: () => void;
}

export interface MatchItem {
  label: string;
  definition: string;
}

export const MATCH_DATA: MatchItem[] = [
  {
    label: "Scratchpad",
    definition:
      "A sandbox for running Python code snippets. Use \"Send to Sandbox\" to send function-specific code and data to the Scratchpad so you can explore freely.",
  },
  {
    label: "Bitcoin Node",
    definition:
      "Simulate broadcasting transactions, mining blocks, and opening Lightning channels on your own private blockchain.",
  },
  {
    label: "Files",
    definition:
      "View and revisit the code you've written across exercises.",
  },
  {
    label: "Transactions",
    definition:
      "Stores your Lightning transactions as you build them and advance through your payment channel.",
  },
  {
    label: "Checkpoint Quizzes",
    definition:
      "Short knowledge-check questions that appear inline as you read.",
  },
  {
    label: "Coding Exercises",
    definition:
      "Write Python to build key parts of the Lightning protocol, with code running directly in your browser.",
  },
];

function shuffleArray<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function DragDropExercise({
  checkpointId,
  theme,
  authenticated,
  sessionToken,
  lightningAddress,
  emailVerified,
  pubkey,
  alreadyCompleted,
  claimInfo,
  onLoginRequest,
  onCompleted,
  onOpenProfile,
}: DragDropExerciseProps) {
  const dark = theme === "dark";
  const canClaimRewards = !!pubkey || emailVerified;

  const userSuffix = sessionToken ? `-${sessionToken.slice(0, 8)}` : "";
  const storageKey = `pl-dragdrop-${checkpointId}${userSuffix}`;

  // Shuffled definitions (stable across re-renders)
  const shuffledDefs = useMemo(() => {
    const seed = 42;
    return shuffleArray(
      MATCH_DATA.map((m, i) => ({ text: m.definition, correctIndex: i })),
      seed
    );
  }, []);

  // Restore saved state from localStorage
  const savedState = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as { assignments: (number | null)[]; submitted: boolean; correct: boolean };
    } catch {}
    return null;
  }, [storageKey]);

  // assignments[slotIndex] = shuffled definition index (or null if unassigned)
  const [assignments, setAssignments] = useState<(number | null)[]>(
    () => savedState?.assignments ?? new Array(MATCH_DATA.length).fill(null)
  );
  const [submitted, setSubmitted] = useState(() => savedState?.submitted ?? false);
  const [correct, setCorrect] = useState(() => savedState?.correct ?? false);
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const [shaking, setShaking] = useState(false);

  // For click-to-assign: track which definition is "selected" for placement
  const [selectedDef, setSelectedDef] = useState<number | null>(null);

  // Drag state
  const dragSourceRef = useRef<{ type: "pool" | "slot"; index: number } | null>(null);

  // Reward claim state (mirrors CheckpointQuestion)
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [rewardAmountSats, setRewardAmountSats] = useState(21);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);
  const [autoPaySending, setAutoPaySending] = useState(false);
  const [showClaimChoice, setShowClaimChoice] = useState(false);

  // On mount: if restored from localStorage as correct, notify parent for chapter completion
  useEffect(() => {
    if (savedState?.submitted && savedState?.correct && !alreadyCompleted) {
      onCompleted(checkpointId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll withdrawal status
  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const data = await res.json();
        setWithdrawalStatus(data.status);
        if (data.status === "paid") {
          onCompleted(checkpointId, rewardAmountSats);
          clearInterval(interval);
        } else if (data.status === "expired" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [rewardK1, withdrawalStatus]);

  // Countdown timer
  useEffect(() => {
    if (!rewardCreatedAt || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rewardCreatedAt) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        setWithdrawalStatus("expired");
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rewardCreatedAt, withdrawalStatus]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ assignments, submitted, correct }));
    } catch {}
  }, [assignments, submitted, correct, storageKey]);

  // Which definitions are still in the pool (not assigned to any slot)
  const assignedSet = new Set(assignments.filter((a): a is number => a !== null));
  const poolDefs = shuffledDefs
    .map((d, i) => ({ ...d, shuffledIndex: i }))
    .filter((d) => !assignedSet.has(d.shuffledIndex));

  // Assign a definition to a slot
  const assignToSlot = useCallback(
    (slotIndex: number, defShuffledIndex: number) => {
      if (submitted) return;
      setAssignments((prev) => {
        const next = [...prev];
        // Remove this def from any other slot
        for (let i = 0; i < next.length; i++) {
          if (next[i] === defShuffledIndex) next[i] = null;
        }
        // If slot already has a different def, unassign it
        next[slotIndex] = defShuffledIndex;
        return next;
      });
      setWrongAttempt(false);
    },
    [submitted]
  );

  // Unassign a slot
  const unassignSlot = useCallback(
    (slotIndex: number) => {
      if (submitted) return;
      setAssignments((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
    },
    [submitted]
  );

  // Handle clicking a slot (for click-to-assign)
  const handleSlotClick = useCallback(
    (slotIndex: number) => {
      if (submitted) return;
      if (selectedDef !== null) {
        assignToSlot(slotIndex, selectedDef);
        setSelectedDef(null);
      } else if (assignments[slotIndex] !== null) {
        // Clicking an assigned slot unassigns it
        unassignSlot(slotIndex);
      }
    },
    [submitted, selectedDef, assignments, assignToSlot, unassignSlot]
  );

  // Handle clicking a pool definition
  const handleDefClick = useCallback(
    (shuffledIndex: number) => {
      if (submitted) return;
      if (selectedDef === shuffledIndex) {
        setSelectedDef(null);
      } else {
        setSelectedDef(shuffledIndex);
      }
    },
    [submitted, selectedDef]
  );

  // Drag handlers for definitions
  const handleDragStart = useCallback(
    (e: React.DragEvent, source: { type: "pool" | "slot"; index: number }, defIndex: number) => {
      if (submitted) return;
      dragSourceRef.current = source;
      e.dataTransfer.setData("text/plain", String(defIndex));
      e.dataTransfer.effectAllowed = "move";
    },
    [submitted]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropOnSlot = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      e.preventDefault();
      if (submitted) return;
      const defIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!isNaN(defIndex)) {
        assignToSlot(slotIndex, defIndex);
      }
      dragSourceRef.current = null;
      setSelectedDef(null);
    },
    [submitted, assignToSlot]
  );

  const handleDropOnPool = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (submitted) return;
      const defIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!isNaN(defIndex)) {
        // Remove from any slot
        setAssignments((prev) => {
          const next = [...prev];
          for (let i = 0; i < next.length; i++) {
            if (next[i] === defIndex) next[i] = null;
          }
          return next;
        });
      }
      dragSourceRef.current = null;
    },
    [submitted]
  );

  // Check answers
  const handleSubmit = useCallback(async () => {
    if (assignments.some((a) => a === null)) return;

    if (!authenticated) {
      onLoginRequest();
      return;
    }

    // Check all matches
    const allCorrect = assignments.every((defShuffledIndex, slotIndex) => {
      if (defShuffledIndex === null) return false;
      return shuffledDefs[defShuffledIndex].correctIndex === slotIndex;
    });

    if (!allCorrect) {
      setWrongAttempt(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    setSubmitted(true);
    setCorrect(true);
    setWrongAttempt(false);
    justSubmittedRef.current = true;

    // Save completion server-side (independent of reward claim)
    if (sessionToken) {
      try {
        const res = await fetch("/api/checkpoint/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ checkpointId, answer: 0 }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          console.warn(`Checkpoint save failed for ${checkpointId}:`, d);
        }
      } catch (err) { console.warn(`Checkpoint save error for ${checkpointId}:`, err); }
    }
    onCompleted(checkpointId);
  }, [assignments, shuffledDefs, authenticated, onLoginRequest, onCompleted, checkpointId, sessionToken]);

  // Claim reward (mirrors CheckpointQuestion)
  const claimingRef = useRef(false);
  const justSubmittedRef = useRef(false);

  const handleClaimReward = useCallback(
    async (claimMethod?: "address" | "lnurl") => {
      if (!sessionToken) return;
      if (claimingRef.current) return;
      claimingRef.current = true;
      setClaiming(true);
      setClaimError(null);
      setShowClaimChoice(false);

      if (claimMethod !== "lnurl" && lightningAddress) {
        setAutoPaySending(true);
      }

      try {
        const res = await fetch("/api/checkpoint/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            checkpointId,
            answer: 0,
            method: claimMethod === "lnurl" ? "lnurl" : undefined,
          }),
        });

        let data: any;
        try {
          data = await res.json();
        } catch {
          setClaimError(`Server returned non-JSON response (status ${res.status})`);
          setAutoPaySending(false);
          return;
        }

        if (res.ok && data.correct) {
          if (data.autoPaid) {
            setAutoPaid(true);
            setAutoPaySending(false);
            setRewardAmountSats(data.amountSats || 21);
            onCompleted(checkpointId, data.amountSats || 21);
          } else {
            setAutoPaySending(false);
            setRewardK1(data.k1);
            setRewardLnurl(data.lnurl);
            setRewardAmountSats(data.amountSats || 21);
            setRewardCreatedAt(Date.now());
            setWithdrawalStatus("pending");
            setCountdown(300);
          }
        } else if (data.alreadyCompleted) {
          setAutoPaySending(false);
          onCompleted(checkpointId, data.amountSats || rewardAmountSats);
        } else {
          setAutoPaySending(false);
          setClaimError(data.error || "Failed to claim reward");
        }
      } catch {
        setAutoPaySending(false);
        setClaimError("Network error. Please try again.");
      } finally {
        claimingRef.current = false;
        setClaiming(false);
      }
    },
    [sessionToken, checkpointId, onCompleted, lightningAddress, rewardAmountSats]
  );

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward("lnurl");
  }, [handleClaimReward]);

  // Theme colors (same as CheckpointQuestion)
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldBg = "bg-[#FFD700]";
  const greenText = dark ? "text-green-400" : "text-green-700";

  const allAssigned = assignments.every((a) => a !== null);

  const completedButUnclaimed = alreadyCompleted && (!claimInfo || claimInfo.amountSats === 0);

  // If completed but sats not yet claimed, auto-set submitted state so claim UI shows
  useEffect(() => {
    if (justSubmittedRef.current) return;
    if (completedButUnclaimed && !submitted) {
      // Set correct assignments
      const correctAssignments = MATCH_DATA.map((_, slotIndex) => {
        return shuffledDefs.findIndex((d) => d.correctIndex === slotIndex);
      });
      setAssignments(correctAssignments);
      setSubmitted(true);
      setCorrect(true);
    }
  }, [completedButUnclaimed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Already-completed and claimed state ──
  if (alreadyCompleted && !rewardLnurl && !completedButUnclaimed) {
    return (
      <div className={`my-8 border-2 ${goldBorder} ${cardBg} p-5`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`font-pixel text-xs ${goldText}`}>MATCH THE TOOLS</div>
          <div className={`font-pixel text-xs ${greenText}`}>COMPLETED</div>
        </div>
        <div className={`text-[17px] md:text-[19px] font-semibold ${textColor} mb-4`}>
          Match each tool or feature to its description.
        </div>
        <div className="space-y-2">
          {MATCH_DATA.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col sm:flex-row gap-2 sm:gap-4 border-2 border-green-500 ${
                dark ? "bg-green-500/10" : "bg-green-50"
              } px-4 py-3`}
            >
              <div
                className={`font-pixel text-xs shrink-0 sm:w-40 ${greenText} flex items-center`}
              >
                {item.label}
              </div>
              <div className={`text-[14px] md:text-[15px] ${textMuted} leading-relaxed`}>
                {item.definition}
              </div>
            </div>
          ))}
        </div>
        <div
          className={`mt-5 -mx-5 -mb-5 px-5 py-4 border-t-2 text-[17px] md:text-[19px] font-semibold text-black ${
            dark
              ? "bg-[#FFD700]/30 border-[#FFD700]/40"
              : "bg-[#b8860b]/20 border-[#b8860b]/30"
          }`}
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {claimInfo && claimInfo.amountSats > 0 ? (
            <>
              {claimInfo.amountSats} Sats Claimed on{" "}
              {new Date(claimInfo.paidAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              at{" "}
              {new Date(claimInfo.paidAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </>
          ) : (
            <>Reward Claimed</>
          )}
        </div>
      </div>
    );
  }

  // ── Active exercise state ──
  return (
    <div
      className={`my-8 border-2 ${
        submitted && correct ? goldBorder : cardBorder
      } ${cardBg} p-5 ${shaking ? "animate-shake" : ""}`}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>

      <div className={`font-pixel text-xs mb-2 ${goldText}`}>MATCH THE TOOLS</div>
      <div className={`text-[17px] md:text-[19px] font-semibold ${textColor} mb-1`}>
        Match each tool or feature to its description.
      </div>
      <div className={`text-[14px] ${textMuted} mb-5`}>
        Drag a description from the pool and drop it next to the matching tool, or click a description then click a slot.
      </div>

      {/* Matching slots */}
      <div className="space-y-2 mb-4">
        {MATCH_DATA.map((item, slotIndex) => {
          const assignedDefIdx = assignments[slotIndex];
          const isCorrectSlot = submitted && correct;
          const hasAssignment = assignedDefIdx !== null;

          let slotBorder = dark ? "border-[#2a3552]" : "border-border";
          let slotBg = dark ? "bg-[#0b1220]" : "bg-background";

          if (isCorrectSlot) {
            slotBorder = "border-green-500";
            slotBg = dark ? "bg-green-500/10" : "bg-green-50";
          } else if (hasAssignment) {
            slotBorder = goldBorder;
            slotBg = dark ? "bg-[#FFD700]/5" : "bg-[#FFD700]/5";
          }

          return (
            <div
              key={slotIndex}
              className={`flex flex-col sm:flex-row gap-2 sm:gap-4 border-2 ${slotBorder} ${slotBg} px-4 py-3 transition-all ${
                submitted ? "cursor-default" : "cursor-pointer"
              }`}
              onClick={() => handleSlotClick(slotIndex)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnSlot(e, slotIndex)}
            >
              <div
                className={`font-pixel text-xs shrink-0 sm:w-40 flex items-center ${
                  isCorrectSlot ? greenText : goldText
                }`}
              >
                {isCorrectSlot && <span className="mr-1.5">{"\u2713"}</span>}
                {item.label}
              </div>
              <div className={`text-[14px] md:text-[15px] leading-relaxed flex-1 min-h-[2rem] flex items-center`}>
                {hasAssignment ? (
                  <span
                    className={textColor}
                    draggable={!submitted}
                    onDragStart={(e) =>
                      handleDragStart(e, { type: "slot", index: slotIndex }, assignedDefIdx!)
                    }
                  >
                    {shuffledDefs[assignedDefIdx!].text}
                  </span>
                ) : (
                  <span className={`${dark ? "text-slate-600" : "text-black/30"} italic text-[13px]`}>
                    {selectedDef !== null ? "Click to place here" : "Drop a description here"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Definition pool */}
      {!submitted && poolDefs.length > 0 && (
        <div
          className={`border-2 ${
            dark ? "border-[#1f2a44] bg-[#0b1220]/50" : "border-border/50 bg-background/50"
          } p-3 mb-4`}
          onDragOver={handleDragOver}
          onDrop={handleDropOnPool}
        >
          <div className={`font-pixel text-xs mb-2 ${textMuted}`}>DESCRIPTIONS</div>
          <div className="flex flex-wrap gap-2">
            {poolDefs.map((def) => (
              <button
                key={def.shuffledIndex}
                type="button"
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, { type: "pool", index: def.shuffledIndex }, def.shuffledIndex)
                }
                onClick={() => handleDefClick(def.shuffledIndex)}
                className={`text-left text-[13px] md:text-[14px] leading-relaxed border-2 px-3 py-2 transition-all cursor-grab active:cursor-grabbing ${
                  selectedDef === def.shuffledIndex
                    ? `${goldBorder} ${dark ? "bg-[#FFD700]/10" : "bg-[#FFD700]/5"} ${textColor}`
                    : `${dark ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"} ${textColor} hover:brightness-110`
                }`}
              >
                {def.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wrong attempt message */}
      {wrongAttempt && !submitted && (
        <div className="font-pixel text-xs text-red-400 mb-3">INCORRECT — TRY AGAIN</div>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAssigned}
          className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${
            allAssigned
              ? `${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95`
              : dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-500 cursor-not-allowed"
              : "border-border bg-secondary text-foreground/40 cursor-not-allowed"
          }`}
        >
          {allAssigned && !authenticated ? "LOGIN & CHECK ANSWERS" : "CHECK ANSWERS"}
        </button>
      )}

      {/* Correct + reward claim flow */}
      {submitted && correct && (
        <div className="mt-4">
          <div className={`font-pixel text-sm ${greenText} mb-2`}>ALL MATCHED CORRECTLY!</div>

          {autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                {rewardAmountSats} SATS SENT!
              </div>
              <div className={`text-[15px] ${textColor}`}>
                Sent to {lightningAddress}. Keep reading!
              </div>
            </div>
          )}

          {autoPaySending && !autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-sm mb-2 ${goldText}`}>
                SENDING {rewardAmountSats} SATS TO {lightningAddress}...
              </div>
            </div>
          )}

          {!rewardLnurl && (!alreadyCompleted || completedButUnclaimed) && !autoPaid && !autoPaySending && !claiming && !showClaimChoice && (
            <div>
              {authenticated && !canClaimRewards && (
                <div
                  className={`border-2 ${
                    dark ? "border-[#2a3552] bg-[#0b1220]" : "border-border bg-background"
                  } p-3 mb-3`}
                >
                  <div className={`font-pixel text-sm ${goldText} mb-2`}>EMAIL NOT VERIFIED</div>
                  <p
                    className={`text-xs ${textMuted}`}
                    style={{
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    }}
                  >
                    Throughout the educational material, there are checkpoints that offer real bitcoin
                    rewards when completed successfully. To mitigate spam, users must either verify
                    their email or log in with LNURL-Auth to claim these rewards.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowClaimChoice(true)}
                disabled={authenticated && !canClaimRewards}
                className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95 ${
                  authenticated && !canClaimRewards ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                CLAIM {rewardAmountSats} SATS
              </button>
              {claimError && (
                <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}

          {showClaimChoice && !claiming && (
            <div
              className={`border-2 ${
                dark ? "border-[#2a3552] bg-[#0b1220]" : "border-border bg-background"
              } p-4`}
            >
              <div className={`font-pixel text-xs mb-4 ${goldText}`}>
                HOW WOULD YOU LIKE TO RECEIVE?
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {lightningAddress ? (
                  <button
                    type="button"
                    onClick={() => handleClaimReward("address")}
                    className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} ${goldBg} hover:bg-[#FFC800] active:scale-95 flex-1`}
                    style={{ color: "#000" }}
                  >
                    LIGHTNING ADDRESS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.()}
                    className={`flex-1 border-2 px-5 py-3 cursor-pointer hover:opacity-70 transition-opacity ${
                      dark ? "border-[#2a3552]" : "border-border"
                    } opacity-60 bg-transparent`}
                  >
                    <div
                      className="font-pixel text-sm text-center mb-1"
                      style={{ color: dark ? "#94a3b8" : undefined }}
                    >
                      LIGHTNING ADDRESS
                    </div>
                    <div className={`text-sm text-center font-bold ${textMuted}`}>
                      Set address in profile first
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleClaimReward("lnurl")}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} hover:bg-[#FFC800] active:scale-95 flex-1 bg-transparent`}
                  style={{ color: dark ? "#FFD700" : "#b8860b" }}
                >
                  LNURL WITHDRAWAL
                </button>
              </div>
              {claimError && (
                <div className="mt-3 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}

          {claiming && (
            <div className={`font-pixel text-sm ${goldText}`}>
              {autoPaySending ? `SENDING ${rewardAmountSats} SATS...` : "GENERATING QR..."}
            </div>
          )}

          {rewardLnurl && !autoPaySending && (
            <div className="mt-4 text-center">
              {withdrawalStatus === "paid" ? (
                <div>
                  <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                    {rewardAmountSats} SATS SENT!
                  </div>
                  <div className={`text-[15px] ${textColor}`}>Payment complete. Keep reading!</div>
                </div>
              ) : withdrawalStatus === "expired" ? (
                <div>
                  <div className="font-pixel text-sm mb-2 text-red-400">QR EXPIRED</div>
                  <button
                    type="button"
                    onClick={handleNewQR}
                    className={`font-pixel text-sm border-2 px-4 py-2 ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800]`}
                  >
                    GENERATE NEW QR
                  </button>
                </div>
              ) : withdrawalStatus === "failed" ? (
                <div>
                  <div className="font-pixel text-sm mb-2 text-red-400">PAYMENT FAILED</div>
                  <button
                    type="button"
                    onClick={handleNewQR}
                    className={`font-pixel text-sm border-2 px-4 py-2 ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800]`}
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : (
                <div>
                  <div className={`font-pixel text-sm mb-3 ${goldText}`}>
                    SCAN TO CLAIM {rewardAmountSats} SATS
                  </div>
                  <div
                    className={`inline-block border-4 ${
                      dark ? "border-[#2a3552]" : "border-border"
                    } ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}
                  >
                    <QRCodeSVG
                      value={rewardLnurl}
                      size={200}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <div className={`mt-3 font-pixel text-xs ${textMuted}`}>
                    {withdrawalStatus === "claimed"
                      ? "PROCESSING PAYMENT..."
                      : "WAITING FOR SCAN..."}
                  </div>
                  <div
                    className={`mt-1 font-mono text-sm ${
                      countdown <= 60 ? "text-red-400" : textMuted
                    }`}
                  >
                    Expires in {formatCountdown(countdown)}
                  </div>
                  <div
                    className={`mt-4 pt-4 border-t ${
                      dark ? "border-[#1f2a44]" : "border-border"
                    } text-left`}
                  >
                    <div className={`font-pixel text-sm mb-3 ${textMuted}`}>
                      COMPATIBLE WALLETS (LNURL-WITHDRAW)
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {[
                        { name: "Wallet of Satoshi", url: "https://walletofsatoshi.com" },
                        { name: "Phoenix", url: "https://phoenix.acinq.co" },
                        { name: "BlueWallet", url: "https://bluewallet.io" },
                        { name: "Breez", url: "https://breez.technology" },
                        { name: "Zeus", url: "https://zeusln.com" },
                        { name: "Alby", url: "https://getalby.com" },
                        { name: "ZEBEDEE", url: "https://zbd.gg" },
                        { name: "Bitkit", url: "https://bitkit.to" },
                        { name: "Muun", url: "https://muun.com" },
                      ].map((w) => (
                        <a
                          key={w.name}
                          href={w.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-base font-mono underline ${
                            dark
                              ? "text-slate-400 hover:text-slate-200"
                              : "text-foreground/60 hover:text-foreground"
                          }`}
                        >
                          {w.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
