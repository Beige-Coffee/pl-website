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
  lightningAddress: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  alreadyCompleted: boolean;
  claimInfo: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest: () => void;
  onCompleted: (groupId: string, amountSats?: number) => void;
  onOpenProfile?: () => void;
}

export default function CheckpointGroup({
  groupId,
  questions,
  rewardSats,
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
}: CheckpointGroupProps) {
  const dark = theme === "dark";
  const canClaimRewards = !!pubkey || emailVerified;

  const userSuffix = sessionToken ? `-${sessionToken.slice(0, 8)}` : "";
  const storageKey = `pl-checkpoint-${groupId}${userSuffix}`;

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

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);
  const [autoPaySending, setAutoPaySending] = useState(false);
  const [showClaimChoice, setShowClaimChoice] = useState(false);

  // Poll withdrawal status
  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const data = await res.json();
        setWithdrawalStatus(data.status);
        if (data.status === "paid") {
          onCompleted(groupId, rewardSats);
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

  const handleClaimReward = useCallback(async (claimMethod?: "address" | "lnurl") => {
    if (!sessionToken) return;
    setClaiming(true);
    setClaimError(null);
    setShowClaimChoice(false);

    if (claimMethod !== "lnurl" && lightningAddress) {
      setAutoPaySending(true);
    }

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
          method: claimMethod === "lnurl" ? "lnurl" : undefined,
        }),
      });

      if (!res.ok && res.status === 404) {
        setClaimError("Endpoint not found. Server may need a restart.");
        setAutoPaySending(false);
        return;
      }

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
          onCompleted(groupId, data.amountSats || rewardSats);
        } else {
          setAutoPaySending(false);
          setRewardK1(data.k1);
          setRewardLnurl(data.lnurl);
          setRewardCreatedAt(Date.now());
          setWithdrawalStatus("pending");
          setCountdown(300);
        }
      } else if (data.alreadyCompleted) {
        setAutoPaySending(false);
        onCompleted(groupId, data.amountSats || rewardSats);
      } else {
        setAutoPaySending(false);
        setClaimError(data.error || "Failed to claim reward");
      }
    } catch (err: any) {
      console.error("Checkpoint group claim error:", err);
      setAutoPaySending(false);
      setClaimError(err?.message || "Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [sessionToken, groupId, questions, selections, onCompleted, lightningAddress]);

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward("lnurl");
  }, [handleClaimReward]);

  // Styling
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldBg = "bg-[#FFD700]";
  const greenText = dark ? "text-green-400" : "text-green-700";

  // Already completed state
  if (alreadyCompleted && !rewardLnurl) {
    return (
      <div className={`my-8 border-2 ${goldBorder} ${cardBg} p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT REVIEW</div>
          <div className={`font-pixel text-xs ${greenText}`}>COMPLETED</div>
        </div>
        {questions.map((q, qi) => (
          <div key={q.id} className={`mb-4 ${qi < questions.length - 1 ? `pb-4 border-b ${dark ? "border-[#1f2a44]" : "border-border"}` : ""}`}>
            <div className={`text-[15px] md:text-[17px] font-semibold ${textColor} mb-2`}>{qi + 1}. {q.question}</div>
            <div className={`text-[14px] md:text-[15px] ${textMuted} leading-relaxed`}>
              <span className={`font-semibold ${greenText}`}>Correct: </span>
              {q.options[q.answer]}
            </div>
          </div>
        ))}
        <div className={`mt-5 -mx-5 -mb-5 px-5 py-4 border-t-2 text-[17px] md:text-[19px] font-semibold text-black ${dark ? "bg-[#FFD700]/30 border-[#FFD700]/40" : "bg-[#b8860b]/20 border-[#b8860b]/30"}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          {claimInfo ? (
            <>{claimInfo.amountSats} Sats Claimed on {new Date(claimInfo.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(claimInfo.paidAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
          ) : (
            <>Reward Claimed</>
          )}
        </div>
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
                      <span
                        className={`font-pixel text-xs mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center border ${
                          isCorrectShow
                            ? "border-green-500 text-green-400"
                            : isWrongSelection
                            ? "border-red-500 text-red-400"
                            : isSelected
                            ? `${goldBorder} ${goldText}`
                            : dark
                            ? "border-[#2a3552] text-slate-400"
                            : "border-border text-foreground/60"
                        }`}
                      >
                        {isCorrectShow ? "\u2713" : isWrongSelection ? "\u2717" : String.fromCharCode(65 + i)}
                      </span>
                      <div className={`text-[14px] md:text-[16px] ${textColor} leading-relaxed`}>{opt}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Show explanation after all correct */}
            {isCorrectReveal && q.explanation && (
              <div className={`mt-3 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
                <div className={`font-pixel text-xs ${greenText} mb-1`}>EXPLANATION</div>
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
          <div className={`font-pixel text-sm ${greenText} mb-4`}>ALL CORRECT!</div>

          {/* Auto-pay success */}
          {autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                {rewardSats} SATS SENT!
              </div>
              <div className={`text-[15px] ${textColor}`}>
                Sent to {lightningAddress}. Keep reading!
              </div>
            </div>
          )}

          {/* Auto-pay sending */}
          {autoPaySending && !autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-sm mb-2 ${goldText}`}>
                SENDING {rewardSats} SATS TO {lightningAddress}...
              </div>
            </div>
          )}

          {!rewardLnurl && !alreadyCompleted && !autoPaid && !autoPaySending && !claiming && !showClaimChoice && (
            <div>
              {authenticated && !canClaimRewards && (
                <div className={`border-2 ${dark ? "border-[#2a3552] bg-[#0b1220]" : "border-border bg-background"} p-3 mb-3`}>
                  <div className={`font-pixel text-sm ${dark ? "text-[#FFD700]" : "text-[#9a7200]"} mb-2`}>EMAIL NOT VERIFIED</div>
                  <p className={`text-xs ${textMuted}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Throughout the educational material, there are checkpoints that offer real bitcoin rewards when completed successfully. To mitigate spam, users must either verify their email or log in with LNURL-Auth to claim these rewards.</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowClaimChoice(true)}
                disabled={authenticated && !canClaimRewards}
                className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95 ${authenticated && !canClaimRewards ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                CLAIM {rewardSats} SATS
              </button>
              {claimError && (
                <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}

          {showClaimChoice && !claiming && (
            <div className={`border-2 ${dark ? "border-[#2a3552] bg-[#0b1220]" : "border-border bg-background"} p-4`}>
              <div className={`font-pixel text-xs mb-4 ${goldText}`}>HOW WOULD YOU LIKE TO RECEIVE?</div>
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
                    className={`flex-1 border-2 px-5 py-3 cursor-pointer hover:opacity-70 transition-opacity ${dark ? "border-[#2a3552]" : "border-border"} opacity-60 bg-transparent`}
                  >
                    <div className="font-pixel text-sm text-center mb-1" style={{ color: dark ? "#94a3b8" : undefined }}>LIGHTNING ADDRESS</div>
                    <div className={`text-sm text-center font-bold ${textMuted}`}>Set address in profile first</div>
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
              {autoPaySending ? `SENDING ${rewardSats} SATS...` : "GENERATING QR..."}
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
                  <div className={`mt-4 pt-4 border-t ${dark ? "border-[#1f2a44]" : "border-border"} text-left`}>
                    <div className={`font-pixel text-sm mb-3 ${textMuted}`}>COMPATIBLE WALLETS (LNURL-WITHDRAW)</div>
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
                          className={`text-base font-mono underline ${dark ? "text-slate-400 hover:text-slate-200" : "text-foreground/60 hover:text-foreground"}`}
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
