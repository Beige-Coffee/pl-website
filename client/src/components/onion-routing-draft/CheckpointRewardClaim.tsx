import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useIsMobile } from "../../hooks/use-mobile";

// ────────────────────────────────────────────────────────────────────────────
// CheckpointRewardClaim
//
// Self-contained reward/claim flow for interactive checkpoints that verify
// themselves in the browser (like KnowledgeMatrix), as opposed to the
// multiple-choice CheckpointQuestion. The host component decides WHEN the
// reward is earned (e.g. all grid cells correct) and renders this; here we
// handle the money: save completion, auto-pay to a Lightning address, or fall
// back to an LNURL-withdraw QR with polling.
//
// This mirrors the reward portion of CheckpointQuestion but lives separately so
// the matrix can't affect the payout flow of the existing MC checkpoints. The
// answer sent to the server is whatever the host passes (the matrix sends 0,
// meaning "client verified all cells correct", the same convention coding
// exercises use).
// ────────────────────────────────────────────────────────────────────────────

interface CheckpointRewardClaimProps {
  checkpointId: string;
  /** Payload the server validates against CHECKPOINT_ANSWER_KEY. */
  answer: number | number[];
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

export function CheckpointRewardClaim({
  checkpointId,
  answer,
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
}: CheckpointRewardClaimProps) {
  const dark = theme === "dark";
  const isMobile = useIsMobile();
  const canClaimRewards = !!pubkey || emailVerified;
  const completedButUnclaimed =
    alreadyCompleted && (!claimInfo || claimInfo.amountSats === 0);

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

  const claimingRef = useRef(false);
  const savedRef = useRef(false);

  // Theme tokens (mirror CheckpointQuestion).
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldBg = "bg-[#FFD700]";

  // Poll withdrawal status while a QR is outstanding.
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
  }, [rewardK1, withdrawalStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown for the QR expiry.
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

  const handleClaimReward = useCallback(
    async (claimMethod?: "address" | "lnurl") => {
      if (!sessionToken) return;
      if (claimingRef.current) return;
      claimingRef.current = true;
      setClaiming(true);
      setClaimError(null);
      setShowClaimChoice(false);
      if (claimMethod !== "lnurl" && lightningAddress) setAutoPaySending(true);

      try {
        const res = await fetch("/api/checkpoint/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            checkpointId,
            answer,
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
          } else if (claimMethod === "address" && lightningAddress && data.k1) {
            setAutoPaySending(false);
            setRewardAmountSats(data.amountSats || 21);
            setClaimError("Auto-pay failed. Retry or use QR withdrawal.");
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
    [sessionToken, checkpointId, answer, onCompleted, lightningAddress, rewardAmountSats],
  );

  const handleNewQR = useCallback(async () => {
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    handleClaimReward("lnurl");
  }, [handleClaimReward]);

  // Save completion server-side once (independent of the reward claim), then
  // let the auto-claim effect take over. Skipped if already completed.
  useEffect(() => {
    if (savedRef.current) return;
    if (!authenticated || !sessionToken) return;
    if (alreadyCompleted) return;
    savedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/checkpoint/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ checkpointId, answer }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          console.warn(`Checkpoint save failed for ${checkpointId}:`, d);
        }
      } catch (err) {
        console.warn(`Checkpoint save error for ${checkpointId}:`, err);
      }
      onCompleted(checkpointId);
    })();
  }, [authenticated, sessionToken, alreadyCompleted, checkpointId, answer, onCompleted]);

  // Auto-pay via Lightning address when eligible.
  useEffect(() => {
    if (
      authenticated &&
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
  }, [authenticated, lightningAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────

  // Not logged in: nudge to log in so progress saves + reward can be claimed.
  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={onLoginRequest}
        className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95`}
      >
        LOG IN TO CLAIM YOUR SATS
      </button>
    );
  }

  // Already completed and already paid out: compact claimed badge.
  if (alreadyCompleted && !completedButUnclaimed && !rewardLnurl) {
    return (
      <div
        className={`px-4 py-3 border-2 ${goldBorder} text-[15px] font-semibold ${textColor}`}
        style={{ background: dark ? "rgba(255,215,0,0.12)" : "rgba(184,134,11,0.12)" }}
      >
        {claimInfo && claimInfo.amountSats > 0 ? (
          <>
            ✓ {claimInfo.amountSats} sats claimed on{" "}
            {new Date(claimInfo.paidAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </>
        ) : (
          <>✓ Reward claimed</>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {autoPaid && (
        <div className="text-center">
          <div className={`font-pixel text-lg mb-2 ${goldText}`}>
            {rewardAmountSats} SATS SENT!
          </div>
          <div className={`text-[15px] ${textColor}`}>
            Sent to {lightningAddress}. Keep reading!
          </div>
        </div>
      )}

      {autoPaySending && !autoPaid && (
        <div className="text-center">
          <div className={`font-pixel text-sm mb-2 ${goldText}`}>
            SENDING {rewardAmountSats} SATS TO {lightningAddress}...
          </div>
        </div>
      )}

      {!rewardLnurl &&
        (!alreadyCompleted || completedButUnclaimed) &&
        !autoPaid &&
        !autoPaySending &&
        !claiming &&
        !showClaimChoice &&
        !(canClaimRewards && lightningAddress) && (
          <div>
            {!canClaimRewards && (
              <div className={`border-2 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-background"} p-3 mb-3`}>
                <div className={`font-pixel text-sm ${goldText} mb-2`}>EMAIL NOT VERIFIED</div>
                <p className={`text-xs ${textMuted}`} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                  Checkpoints offer real bitcoin rewards. To claim, verify your
                  email or log in with LNURL-Auth. Your progress is already saved.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowClaimChoice(true)}
              disabled={!canClaimRewards}
              className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} ${goldBg} text-black hover:bg-[#FFC800] active:scale-95 ${!canClaimRewards ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              CLAIM {rewardAmountSats} SATS
            </button>
            {claimError && <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>}
          </div>
        )}

      {showClaimChoice && !claiming && (
        <div className={`border-2 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
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
                className={`flex-1 border-2 px-5 py-3 cursor-pointer hover:opacity-70 transition-opacity ${cardBorder} opacity-60 bg-transparent`}
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
          {claimError && <div className="mt-3 font-pixel text-xs text-red-400">{claimError}</div>}
        </div>
      )}

      {claiming && (
        <div className={`font-pixel text-sm ${goldText}`}>
          {autoPaySending ? `SENDING ${rewardAmountSats} SATS...` : "GENERATING QR..."}
        </div>
      )}

      {rewardLnurl && !autoPaySending && (
        <div className="text-center">
          {withdrawalStatus === "paid" ? (
            <div>
              <div className={`font-pixel text-lg mb-2 ${goldText}`}>{rewardAmountSats} SATS SENT!</div>
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
              <div className={`font-pixel text-sm mb-3 ${goldText}`}>SCAN TO CLAIM {rewardAmountSats} SATS</div>
              <div className={`inline-block border-4 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
                <QRCodeSVG value={rewardLnurl} size={isMobile ? 160 : 200} level="M" bgColor="#ffffff" fgColor="#000000" />
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
  );
}

export default CheckpointRewardClaim;
