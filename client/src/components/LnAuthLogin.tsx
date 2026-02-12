import { useEffect, useState } from "react";
import { useLnAuthChallenge } from "../hooks/use-lnauth";

interface LnAuthLoginProps {
  theme: "light" | "dark";
  onSuccess: (token: string, pubkey: string) => void;
  onClose?: () => void;
}

const SUPPORTED_WALLETS = [
  { name: "Phoenix", url: "https://phoenix.acinq.co/" },
  { name: "Zeus", url: "https://zeusln.com/" },
  { name: "Breez", url: "https://breez.technology/" },
  { name: "Blixt", url: "https://blixtwallet.github.io/" },
  { name: "BlueWallet", url: "https://bluewallet.io/" },
  { name: "Alby", url: "https://getalby.com/", note: "browser extension" },
];

export default function LnAuthLogin({ theme, onSuccess, onClose }: LnAuthLoginProps) {
  const { challenge, loading, error, generate, pollStatus, stopPolling } = useLnAuthChallenge();
  const [status, setStatus] = useState<"idle" | "waiting" | "success">("idle");

  useEffect(() => {
    generate();
  }, [generate]);

  useEffect(() => {
    if (challenge && status !== "success") {
      setStatus("waiting");
      pollStatus(challenge.k1, (token, pubkey) => {
        setStatus("success");
        onSuccess(token, pubkey);
      });
    }
    return () => stopPolling();
  }, [challenge, pollStatus, stopPolling, onSuccess, status]);

  const dark = theme === "dark";
  const bg = dark ? "bg-[#0b1220]" : "bg-background";
  const border = dark ? "border-[#2a3552]" : "border-border";
  const text = dark ? "text-slate-200" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";

  return (
    <div className={`border-4 ${border} ${bg} p-6 max-w-lg mx-auto`} data-testid="container-lnauth">
      <div className="font-pixel text-sm mb-4 text-center" style={{ color: "#ffd700" }} data-testid="text-lnauth-title">
        LOGIN WITH LIGHTNING
      </div>

      <p className={`text-sm ${text} mb-4 text-center`}>
        Scan the QR code below with a Lightning wallet that supports LNURL-auth to log in.
      </p>

      {loading && (
        <div className={`text-center py-8 ${textMuted} font-pixel text-xs`} data-testid="status-lnauth-loading">
          GENERATING CHALLENGE...
        </div>
      )}

      {error && (
        <div className="text-center py-4" data-testid="status-lnauth-error">
          <p className="text-red-500 font-pixel text-xs mb-3">ERROR: {error}</p>
          <button
            onClick={generate}
            className={`border-2 ${border} ${cardBg} px-4 py-2 font-pixel text-xs hover:opacity-80`}
            data-testid="button-lnauth-retry"
          >
            RETRY
          </button>
        </div>
      )}

      {challenge && !loading && !error && (
        <>
          <div className={`border-2 ${border} ${cardBg} p-4 mb-4 flex justify-center`} data-testid="container-lnauth-qr">
            {status === "success" ? (
              <div className="text-center py-4">
                <div className="font-pixel text-sm mb-2" style={{ color: "#ffd700" }}>AUTHENTICATED!</div>
                <div className={`font-pixel text-xs ${textMuted}`}>Redirecting...</div>
              </div>
            ) : (
              <img
                src={challenge.qr}
                alt="LNURL-auth QR code"
                style={{ imageRendering: "pixelated", width: 250, height: 250 }}
                data-testid="img-lnauth-qr"
              />
            )}
          </div>

          {status === "waiting" && (
            <div className={`text-center mb-4 font-pixel text-[10px] ${textMuted}`} data-testid="status-lnauth-waiting">
              WAITING FOR WALLET...
            </div>
          )}

          <div className={`text-center mb-4`}>
            <a
              href={`lightning:${challenge.lnurl}`}
              className={`inline-block border-2 ${border} ${cardBg} px-4 py-2 font-pixel text-xs hover:opacity-80 transition-opacity`}
              style={{ color: "#ffd700" }}
              data-testid="link-lnauth-open-wallet"
            >
              OPEN IN WALLET
            </a>
          </div>
        </>
      )}

      <div className={`border-t-2 ${border} pt-4 mt-4`}>
        <div className={`font-pixel text-[10px] mb-3 text-center ${textMuted}`}>
          SUPPORTED WALLETS
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {SUPPORTED_WALLETS.map((w) => (
            <a
              key={w.name}
              href={w.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`border ${border} px-2 py-1 text-xs ${text} hover:opacity-70 transition-opacity`}
              data-testid={`link-wallet-${w.name.toLowerCase()}`}
            >
              {w.name}
              {w.note && <span className={`ml-1 ${textMuted} text-[10px]`}>({w.note})</span>}
            </a>
          ))}
        </div>
        <p className={`text-[11px] ${textMuted} text-center leading-relaxed`}>
          Wallet of Satoshi does not support LNURL-auth.
          <br />
          LNURL-auth works best with non-custodial wallets.
          <br />
          If you lose your wallet seed, you lose this login identity.
        </p>
      </div>

      {onClose && (
        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className={`border-2 ${border} ${cardBg} px-4 py-2 font-pixel text-xs hover:opacity-80`}
            data-testid="button-lnauth-close"
          >
            CANCEL
          </button>
        </div>
      )}
    </div>
  );
}
