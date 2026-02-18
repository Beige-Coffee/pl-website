import React, { useState, useEffect, useCallback } from "react";
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
  alreadyCompleted: boolean;
  claimInfo: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest: () => void;
  onCompleted: (checkpointId: string) => void;
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
  alreadyCompleted,
  claimInfo,
  onLoginRequest,
  onCompleted,
}: CheckpointQuestionProps) {
  const dark = theme === "dark";

  const storageKey = `pl-checkpoint-${checkpointId}`;

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

  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const data = await res.json();
        setWithdrawalStatus(data.status);
        if (data.status === "paid") {
          onCompleted(checkpointId);
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
  }, [selected, answer, authenticated, onLoginRequest]);

  const handleClaimReward = useCallback(async () => {
    if (!sessionToken) return;
    setClaiming(true);
    setClaimError(null);

    // If user has a lightning address, show sending state
    if (lightningAddress) {
      setAutoPaySending(true);
    }

    try {
      const res = await fetch("/api/checkpoint/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ checkpointId, answer: selected }),
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
          onCompleted(checkpointId);
        } else {
          // Fall back to QR flow
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
        onCompleted(checkpointId);
      } else {
        setAutoPaySending(false);
        setClaimError(data.error || "Failed to claim reward");
      }
    } catch {
      setAutoPaySending(false);
      setClaimError("Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  }, [sessionToken, checkpointId, selected, onCompleted, lightningAddress]);

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward();
  }, [handleClaimReward]);

  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";
  const goldText = "text-[#FFD700]";
  const goldBorder = "border-[#FFD700]";
  const goldBg = "bg-[#FFD700]";

  if (alreadyCompleted && !rewardLnurl) {
    return (
      <div className={`my-8 border-2 ${goldBorder} ${cardBg} p-5`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT</div>
          <div className="font-pixel text-xs text-green-400">COMPLETED</div>
        </div>
        <div className={`text-[17px] md:text-[19px] font-semibold ${textColor} mb-3`}>{renderInlineCode(question, dark)}</div>
        <div className={`text-[15px] md:text-[17px] ${textMuted} leading-relaxed`}>
          <span className="font-semibold text-green-400">Correct answer: </span>
          {renderInlineCode(options[answer], dark)}
        </div>
        {explanation && (
          <div className={`mt-3 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
            <div className="font-pixel text-xs text-green-400 mb-1">EXPLANATION</div>
            <div className={`text-[15px] md:text-[17px] ${textMuted} leading-relaxed`}>{renderInlineCode(explanation, dark)}</div>
          </div>
        )}
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
    <div className={`my-8 border-2 ${submitted && correct ? goldBorder : cardBorder} ${cardBg} p-5 ${shaking ? "animate-shake" : ""}`}>
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

      <div className="flex items-center gap-3 mb-3">
        <div className={`font-pixel text-xs ${goldText}`}>CHECKPOINT</div>
        <div className={`font-pixel text-xs ${goldText}`}>EARN SATS</div>
      </div>

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
                <div className={`font-pixel text-xs mt-1 shrink-0 ${isSelected ? goldText : textMuted}`}>
                  {String.fromCharCode(65 + i)})
                </div>
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
          <div className="font-pixel text-sm text-green-400 mb-2">CORRECT!</div>

          {explanation && (
            <div className={`mb-4 pt-3 border-t ${dark ? "border-[#1f2a44]" : "border-border"}`}>
              <div className="font-pixel text-xs text-green-400 mb-1">EXPLANATION</div>
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

          {!rewardLnurl && !alreadyCompleted && !autoPaid && !autoPaySending && (
            <div>
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={claiming}
                className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95 ${
                  claiming ? "opacity-60 cursor-wait" : ""
                }`}
              >
                {claiming ? (lightningAddress ? "SENDING SATS..." : "GENERATING QR...") : `CLAIM ${rewardAmountSats} SATS`}
              </button>
              {claimError && (
                <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
              )}
            </div>
          )}

          {rewardLnurl && (
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
