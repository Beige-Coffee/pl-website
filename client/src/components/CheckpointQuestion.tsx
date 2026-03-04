import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface CheckpointQuestionProps {
  checkpointId: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
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

// Render inline code: converts `text` to <code> elements
function renderInlineCode(text: string, dark: boolean): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = part.slice(1, -1);
      return (
        <code
          key={i}
          className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${dark ? "bg-white/10" : "bg-black/[0.06]"}`}
        >
          {code}
        </code>
      );
    }
    return part;
  });
}

export default function CheckpointQuestion({
  checkpointId,
  question,
  options,
  answer,
  explanation,
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
}: CheckpointQuestionProps) {
  const dark = theme === "dark";
  const canClaimRewards = !!pubkey || emailVerified;

  const userSuffix = sessionToken ? `-${sessionToken.slice(0, 8)}` : "";
  const storageKey = `pl-checkpoint-${checkpointId}${userSuffix}`;

  const [selected, setSelected] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [wrongAttempt, setWrongAttempt] = useState(false);
  const [shaking, setShaking] = useState(false);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [rewardAmountSats, setRewardAmountSats] = useState(5);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);
  const [autoPaySending, setAutoPaySending] = useState(false);
  const [showClaimChoice, setShowClaimChoice] = useState(false);

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

  const handleSubmit = useCallback(async () => {
    if (selected === null) return;

    if (!authenticated) {
      onLoginRequest();
      return;
    }

    if (selected !== answer) {
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
          body: JSON.stringify({ checkpointId, answer: selected }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          console.warn(`Checkpoint save failed for ${checkpointId}:`, d);
        }
      } catch (err) { console.warn(`Checkpoint save error for ${checkpointId}:`, err); }
    }
    onCompleted(checkpointId);
  }, [selected, answer, authenticated, onLoginRequest, sessionToken, checkpointId, onCompleted]);

  const claimingRef = useRef(false);
  const justSubmittedRef = useRef(false);

  const handleClaimReward = useCallback(async (claimMethod?: "address" | "lnurl") => {
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
        body: JSON.stringify({ checkpointId, answer: selected, method: claimMethod === "lnurl" ? "lnurl" : undefined }),
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
          // Auto-pay succeeded, skip QR entirely
          setAutoPaid(true);
          setAutoPaySending(false);
          setRewardAmountSats(data.amountSats || 5);
          onCompleted(checkpointId, data.amountSats || 5);
        } else if (claimMethod === "address" && lightningAddress && data.k1) {
          // Auto-pay was attempted but failed silently (server fell back to QR).
          // Show the error/retry UI instead of auto-displaying a QR code.
          setAutoPaySending(false);
          setRewardAmountSats(data.amountSats || 5);
          setClaimError("Auto-pay failed. Retry or use QR withdrawal.");
        } else {
          // Explicit QR flow
          setAutoPaySending(false);
          setRewardK1(data.k1);
          setRewardLnurl(data.lnurl);
          setRewardAmountSats(data.amountSats || 5);
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
  }, [sessionToken, checkpointId, selected, onCompleted, lightningAddress]);

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward("lnurl");
  }, [handleClaimReward]);

  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldBg = "bg-[#FFD700]";
  const greenText = dark ? "text-green-400" : "text-green-700";

  const completedButUnclaimed = alreadyCompleted && (!claimInfo || claimInfo.amountSats === 0);

  // Prevent scroll jump when component shrinks on completion.
  // Capture the element's top offset before render and restore scroll after.
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCompletedRef = useRef(alreadyCompleted);
  useLayoutEffect(() => {
    if (alreadyCompleted && !prevCompletedRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Keep the top of the checkpoint at the same viewport position
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const newRect = containerRef.current.getBoundingClientRect();
        const drift = newRect.top - rect.top;
        if (Math.abs(drift) > 5) {
          window.scrollBy(0, drift);
        }
      });
    }
    prevCompletedRef.current = alreadyCompleted;
  }, [alreadyCompleted]);

  // If completed but sats not yet claimed, auto-set submitted state so claim UI shows
  useEffect(() => {
    if (justSubmittedRef.current) return;
    if (completedButUnclaimed && !submitted) {
      setSelected(answer);
      setSubmitted(true);
      setCorrect(true);
    }
  }, [completedButUnclaimed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-claim reward via lightning address when correct answer is submitted
  const willAutoPay = submitted && correct && !autoPaid && !autoPaySending && !claiming
    && !rewardK1 && (!alreadyCompleted || completedButUnclaimed)
    && canClaimRewards && !!lightningAddress && !!sessionToken;

  useEffect(() => {
    if (
      submitted &&
      correct &&
      !autoPaid &&
      !autoPaySending &&
      !claiming &&
      !rewardK1 &&
      (!alreadyCompleted || completedButUnclaimed) &&
      canClaimRewards &&
      lightningAddress &&
      sessionToken
    ) {
      handleClaimReward("address");
    }
  }, [submitted, correct, lightningAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  if (alreadyCompleted && !rewardLnurl && !completedButUnclaimed) {
    return (
      <div ref={containerRef} className={`my-8 border-2 ${goldBorder} ${cardBg} p-5`} style={{ overflowAnchor: "none" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT</div>
          <div className={`font-pixel text-xs ${greenText}`}>COMPLETED</div>
        </div>
        <div className={`text-[17px] md:text-[19px] font-semibold ${textColor} mb-3`}>{renderInlineCode(question, dark)}</div>
        <div className={`text-[15px] md:text-[17px] ${textMuted} leading-relaxed`}>
          <span className={`font-semibold ${greenText}`}>Correct answer: </span>
          {renderInlineCode(options[answer], dark)}
        </div>
        {explanation && (
          <div className={`mt-3 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
            <div className={`font-pixel text-xs ${greenText} mb-1`}>EXPLANATION</div>
            <div className={`text-[15px] md:text-[17px] ${textMuted} leading-relaxed`}>{renderInlineCode(explanation, dark)}</div>
          </div>
        )}
        <div className={`mt-5 -mx-5 -mb-5 px-5 py-4 border-t-2 text-[17px] md:text-[19px] font-semibold text-black ${dark ? "bg-[#FFD700]/30 border-[#FFD700]/40" : "bg-[#b8860b]/20 border-[#b8860b]/30"}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          {claimInfo && claimInfo.amountSats > 0 ? (
            <>{claimInfo.amountSats} Sats Claimed on {new Date(claimInfo.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(claimInfo.paidAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
          ) : (
            <>Reward Claimed</>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`my-8 border-2 ${submitted && correct ? goldBorder : cardBorder} ${cardBg} p-5 ${shaking ? "animate-shake" : ""}`} style={{ overflowAnchor: "none" }}>
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

      <div className={`text-[17px] md:text-[19px] font-semibold ${textColor} mb-4`}>{renderInlineCode(question, dark)}</div>

      <div className="space-y-2 mb-4">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const isWrongSelection = wrongAttempt && isSelected && i !== answer;
          const isCorrectReveal = submitted && correct && i === answer;

          let optBorder = dark ? "border-[#2a3552]" : "border-border";
          let optBg = dark ? "bg-[#0b1220]" : "bg-background";
          let optText = textColor;

          if (isCorrectReveal) {
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
                setSelected(i);
                try { localStorage.setItem(storageKey, JSON.stringify(i)); } catch {}
                setWrongAttempt(false);
              }}
              disabled={submitted}
              className={`w-full text-left border-2 ${optBorder} ${optBg} px-4 py-3 transition-all ${
                submitted ? "cursor-default" : "cursor-pointer hover:brightness-110"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`font-pixel text-xs mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center border ${
                    isCorrectReveal
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
                  {isCorrectReveal ? "\u2713" : isWrongSelection ? "\u2717" : String.fromCharCode(65 + i)}
                </span>
                <div className={`text-[15px] md:text-[17px] ${optText} leading-relaxed`}>{renderInlineCode(opt, dark)}</div>
              </div>
            </button>
          );
        })}
      </div>

      {wrongAttempt && !submitted && (
        <div className="font-pixel text-xs text-red-400 mb-3">
          INCORRECT - TRY AGAIN
        </div>
      )}

      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selected === null}
          className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${
            selected !== null
              ? `${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95`
              : dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-500 cursor-not-allowed"
              : "border-border bg-secondary text-foreground/40 cursor-not-allowed"
          }`}
        >
          {selected !== null && !authenticated ? "LOGIN & SUBMIT" : "SUBMIT ANSWER"}
        </button>
      )}

      {submitted && correct && (
        <div className="mt-4">
          <div className={`font-pixel text-sm ${greenText} mb-2`}>CORRECT!</div>

          {explanation && (
            <div className={`mb-4 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
              <div className={`font-pixel text-xs ${greenText} mb-1`}>EXPLANATION</div>
              <div className={`text-[15px] md:text-[17px] ${textMuted} leading-relaxed`}>{renderInlineCode(explanation, dark)}</div>
            </div>
          )}

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

          {!rewardLnurl && (!alreadyCompleted || completedButUnclaimed) && !autoPaid && !autoPaySending && !claiming && !showClaimChoice && !willAutoPay && (
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
                CLAIM {rewardAmountSats} SATS
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
