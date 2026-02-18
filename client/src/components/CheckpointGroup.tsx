import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QuestionData {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface CheckpointGroupProps {
  groupId: string;
  questions: QuestionData[];
  rewardSats: number;
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  alreadyCompleted: boolean;
  onLoginRequest: () => void;
  onCompleted: (groupId: string) => void;
}

export default function CheckpointGroup({
  groupId,
  questions,
  rewardSats,
  theme,
  authenticated,
  sessionToken,
  alreadyCompleted,
  onLoginRequest,
  onCompleted,
}: CheckpointGroupProps) {
  const dark = theme === "dark";

  const storageKey = `pl-checkpoint-${groupId}`;

  const [selections, setSelections] = useState<Record<string, number | null>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [submitted, setSubmitted] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  // Reward state
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);

  // Poll withdrawal status
  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const data = await res.json();
        setWithdrawalStatus(data.status);
        if (data.status === "paid") {
          onCompleted(groupId);
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

  const allAnswered = questions.every((q) => selections[q.id] !== undefined && selections[q.id] !== null);
  const allCorrect = questions.every((q) => selections[q.id] === q.answer);

  const handleSubmit = useCallback(() => {
    if (!allAnswered) return;

    if (!authenticated) {
      onLoginRequest();
      return;
    }

    // Check which are wrong
    const wrong = new Set<string>();
    questions.forEach((q) => {
      if (selections[q.id] !== q.answer) wrong.add(q.id);
    });

    if (wrong.size > 0) {
      setWrongIds(wrong);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    // All correct!
    setSubmitted(true);
    setWrongIds(new Set());
  }, [allAnswered, authenticated, onLoginRequest, questions, selections]);

  const handleClaimReward = useCallback(async () => {
    if (!sessionToken) return;
    setClaiming(true);
    setClaimError(null);

    try {
      const res = await fetch("/api/checkpoint-group/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          groupId,
          answers: Object.fromEntries(questions.map((q) => [q.id, selections[q.id]])),
        }),
      });

      if (!res.ok && res.status === 404) {
        setClaimError("Endpoint not found. Server may need a restart.");
        return;
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        setClaimError(`Server returned non-JSON response (status ${res.status})`);
        return;
      }

      if (res.ok && data.correct) {
        setRewardK1(data.k1);
        setRewardLnurl(data.lnurl);
        setRewardCreatedAt(Date.now());
        setWithdrawalStatus("pending");
        setCountdown(300);
      } else if (data.alreadyCompleted) {
        onCompleted(groupId);
      } else {
        setClaimError(data.error || "Failed to claim reward");
      }
    } catch (err: any) {
      console.error("Checkpoint group claim error:", err);
      setClaimError(err?.message || "Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [sessionToken, groupId, questions, selections, onCompleted]);

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward();
  }, [handleClaimReward]);

  // Styling
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";
  const goldText = "text-[#FFD700]";
  const goldBorder = "border-[#FFD700]";
  const goldBg = "bg-[#FFD700]";

  // Already completed state
  if (alreadyCompleted && !rewardLnurl) {
    return (
      <div className={`my-8 border-2 ${goldBorder} ${cardBg} p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT REVIEW</div>
          <div className="font-pixel text-xs text-green-400">COMPLETED</div>
        </div>
        {questions.map((q, qi) => (
          <div key={q.id} className={`mb-4 ${qi < questions.length - 1 ? `pb-4 border-b ${dark ? "border-[#1f2a44]" : "border-border"}` : ""}`}>
            <div className={`text-[15px] md:text-[17px] font-semibold ${textColor} mb-2`}>{qi + 1}. {q.question}</div>
            <div className={`text-[14px] md:text-[15px] ${textMuted} leading-relaxed`}>
              <span className="font-semibold text-green-400">Correct: </span>
              {q.options[q.answer]}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`my-8 border-2 ${submitted && allCorrect ? goldBorder : cardBorder} ${cardBg} p-5 ${shaking ? "animate-shake" : ""}`}>
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

      <div className="flex items-center gap-3 mb-4">
        <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT REVIEW</div>
        <div className={`font-pixel text-xs ${goldText}`}>EARN {rewardSats} SATS</div>
      </div>

      <div className={`text-[14px] md:text-[15px] ${textMuted} mb-5`}>
        Answer all {questions.length} questions correctly to claim your reward.
      </div>

      {/* Questions */}
      {questions.map((q, qi) => {
        const isWrong = wrongIds.has(q.id);
        const isCorrectReveal = submitted && allCorrect;

        return (
          <div key={q.id} className={`mb-6 ${qi < questions.length - 1 ? `pb-6 border-b ${dark ? "border-[#1f2a44]" : "border-border"}` : ""}`}>
            <div className={`text-[16px] md:text-[18px] font-semibold ${textColor} mb-3`}>
              {qi + 1}. {q.question}
              {isWrong && !submitted && (
                <span className="ml-2 font-pixel text-xs text-red-400">INCORRECT</span>
              )}
            </div>

            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isSelected = selections[q.id] === i;
                const isCorrectAnswer = i === q.answer;
                const isWrongSelection = isWrong && isSelected && !isCorrectAnswer;
                const isCorrectShow = isCorrectReveal && isCorrectAnswer;

                let optBorder = dark ? "border-[#2a3552]" : "border-border";
                let optBg = dark ? "bg-[#0b1220]" : "bg-background";

                if (isCorrectShow) {
                  optBorder = "border-green-500";
                  optBg = dark ? "bg-green-500/15" : "bg-green-50";
                } else if (isWrongSelection) {
                  optBorder = "border-red-500";
                  optBg = dark ? "bg-red-500/15" : "bg-red-50";
                } else if (isSelected) {
                  optBorder = goldBorder;
                  optBg = dark ? "bg-[#FFD700]/10" : "bg-[#FFD700]/5";
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (submitted) return;
                      setSelections((prev) => {
                        const next = { ...prev, [q.id]: i };
                        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
                        return next;
                      });
                      setWrongIds((prev) => {
                        const next = new Set(prev);
                        next.delete(q.id);
                        return next;
                      });
                    }}
                    disabled={submitted}
                    className={`w-full text-left border-2 ${optBorder} ${optBg} px-4 py-3 transition-all ${
                      submitted ? "cursor-default" : "cursor-pointer hover:brightness-110"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`font-pixel text-xs mt-1 shrink-0 ${isSelected ? goldText : textMuted}`}>
                        {String.fromCharCode(65 + i)})
                      </div>
                      <div className={`text-[14px] md:text-[16px] ${textColor} leading-relaxed`}>{opt}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Show explanation after all correct */}
            {isCorrectReveal && q.explanation && (
              <div className={`mt-3 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
                <div className="font-pixel text-xs text-green-400 mb-1">EXPLANATION</div>
                <div className={`text-[14px] md:text-[15px] ${textMuted} leading-relaxed`}>{q.explanation}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Wrong attempt feedback */}
      {wrongIds.size > 0 && !submitted && (
        <div className="font-pixel text-xs text-red-400 mb-3">
          {wrongIds.size === 1 ? "1 ANSWER IS INCORRECT" : `${wrongIds.size} ANSWERS ARE INCORRECT`} - TRY AGAIN
        </div>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${
            allAnswered
              ? `${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95`
              : dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-500 cursor-not-allowed"
              : "border-border bg-secondary text-foreground/40 cursor-not-allowed"
          }`}
        >
          {allAnswered && !authenticated ? "LOGIN & SUBMIT" : "SUBMIT ALL ANSWERS"}
        </button>
      )}

      {/* All correct - claim reward */}
      {submitted && allCorrect && (
        <div className="mt-4">
          <div className="font-pixel text-sm text-green-400 mb-4">ALL CORRECT!</div>

          {/* Reward section */}
          {!rewardLnurl && !alreadyCompleted && (
            <div>
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={claiming}
                className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95 ${
                  claiming ? "opacity-60 cursor-wait" : ""
                }`}
              >
                {claiming ? "GENERATING QR..." : `CLAIM ${rewardSats} SATS`}
              </button>
              {claimError && (
                <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}

          {/* QR code display */}
          {rewardLnurl && (
            <div className="mt-4 text-center">
              {withdrawalStatus === "paid" ? (
                <div>
                  <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                    {rewardSats} SATS SENT!
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
                    SCAN TO CLAIM {rewardSats} SATS
                  </div>
                  <div className={`inline-block border-4 ${dark ? "border-[#2a3552]" : "border-border"} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
                    <QRCodeSVG
                      value={rewardLnurl}
                      size={200}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <div className={`mt-3 font-pixel text-xs ${textMuted}`}>
                    {withdrawalStatus === "claimed" ? "PROCESSING PAYMENT..." : "WAITING FOR SCAN..."}
                  </div>
                  <div className={`mt-1 font-mono text-sm ${countdown <= 60 ? "text-red-400" : textMuted}`}>
                    Expires in {formatCountdown(countdown)}
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
