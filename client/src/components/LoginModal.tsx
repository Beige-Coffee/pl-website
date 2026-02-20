import { useState, useEffect, useRef, useCallback } from "react";
import { useLnAuthChallenge } from "../hooks/use-lnauth";

interface LoginModalProps {
  theme: "light" | "dark";
  onSuccess: (token: string, data: any) => void;
  onClose: () => void;
}

const SUPPORTED_WALLETS = [
  { name: "Phoenix", url: "https://phoenix.acinq.co/" },
  { name: "Zeus", url: "https://zeusln.com/" },
  { name: "Breez", url: "https://breez.technology/" },
  { name: "Alby", url: "https://getalby.com/", note: "browser extension" },
];

export default function LoginModal({ theme, onSuccess, onClose }: LoginModalProps) {
  const [tab, setTab] = useState<"lightning" | "email">("email");
  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-gray-800";
  const bg = dark ? "bg-[#0f1930]" : "bg-white";
  const pageBg = dark ? "bg-[#0b1220]" : "bg-white";
  const textMuted = dark ? "text-slate-400" : "text-gray-500";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      data-testid="container-login-modal"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className={`relative w-full max-w-md border-4 ${border} ${pageBg} p-8`}>
        <div className="flex items-center justify-between mb-6">
          <div className={`font-pixel text-lg ${dark ? "text-[#FFD700]" : "text-gray-900"}`} data-testid="text-login-title">
            LOGIN / REGISTER
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`border-2 ${border} ${bg} px-3 py-2 font-pixel text-sm hover:opacity-80 ${dark ? "text-slate-200" : "text-gray-900"}`}
            data-testid="button-login-close"
          >
            X
          </button>
        </div>

        <div className="flex gap-0 mb-6">
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex-1 border-2 px-4 py-3 font-pixel text-sm transition-colors ${
              tab === "email"
                ? dark
                  ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]"
                  : "border-gray-900 bg-gray-900 text-white"
                : `${border} ${bg} ${dark ? "text-slate-400" : "text-gray-600"} hover:opacity-80`
            }`}
            data-testid="button-tab-email"
          >
            EMAIL
          </button>
          <button
            type="button"
            onClick={() => setTab("lightning")}
            className={`flex-1 border-2 border-l-0 px-4 py-3 font-pixel text-sm transition-colors ${
              tab === "lightning"
                ? dark
                  ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]"
                  : "border-gray-900 bg-gray-900 text-white"
                : `${border} ${bg} ${dark ? "text-slate-400" : "text-gray-600"} hover:opacity-80`
            }`}
            data-testid="button-tab-lightning"
          >
            LIGHTNING
          </button>
        </div>

        {tab === "email" ? (
          <EmailAuthForm theme={theme} onSuccess={onSuccess} />
        ) : (
          <LightningAuthForm theme={theme} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  );
}

function EmailAuthForm({
  theme,
  onSuccess,
}: {
  theme: "light" | "dark";
  onSuccess: (token: string, data: any) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-gray-400";
  const bg = dark ? "bg-[#0f1930]" : "bg-white";
  const textColor = dark ? "text-slate-200" : "text-gray-900";
  const textMuted = dark ? "text-slate-400" : "text-gray-600";
  const inputBg = dark ? "bg-[#0b1220]" : "bg-white";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Try login first
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();

      if (loginRes.ok) {
        onSuccess(loginData.sessionToken, loginData);
        return;
      }

      // Login failed - try registering (email might not exist yet)
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const registerData = await registerRes.json();

      if (registerRes.ok) {
        onSuccess(registerData.sessionToken, registerData);
        return;
      }

      // Register also failed - if email already exists, password was wrong
      if (registerRes.status === 409) {
        setError("Incorrect password");
      } else {
        setError(registerData.error || "Something went wrong");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={`block font-pixel text-xs mb-2 ${dark ? "text-slate-400" : "text-gray-700"}`}>EMAIL</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={`w-full border-2 ${border} ${inputBg} ${textColor} px-4 py-3 text-base font-mono focus:outline-none focus:border-gray-900 placeholder:text-gray-400`}
          placeholder="you@example.com"
          data-testid="input-email"
        />
      </div>
      <div>
        <label className={`block font-pixel text-xs mb-2 ${dark ? "text-slate-400" : "text-gray-700"}`}>PASSWORD</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className={`w-full border-2 ${border} ${inputBg} ${textColor} px-4 py-3 text-base font-mono focus:outline-none focus:border-gray-900 placeholder:text-gray-400`}
          placeholder="Min 6 characters"
          data-testid="input-password"
        />
      </div>

      {error && (
        <div className="font-pixel text-sm text-red-500 text-center" data-testid="text-auth-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`w-full font-pixel text-base border-2 px-4 py-4 transition-all ${
          loading
            ? `${border} ${bg} ${textMuted} cursor-wait`
            : dark
            ? "border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-[0.98]"
            : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]"
        }`}
        data-testid="button-auth-submit"
      >
        {loading ? "PLEASE WAIT..." : "CONTINUE"}
      </button>

      <div className={`text-center font-pixel text-xs ${textMuted}`}>
        NEW USERS ARE REGISTERED AUTOMATICALLY
      </div>
    </form>
  );
}

function LightningAuthForm({
  theme,
  onSuccess,
}: {
  theme: "light" | "dark";
  onSuccess: (token: string, data: any) => void;
}) {
  const { challenge, loading, error, generate, pollStatus, stopPolling } = useLnAuthChallenge();
  const [status, setStatus] = useState<"idle" | "waiting" | "success">("idle");

  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-gray-400";
  const bg = dark ? "bg-[#0f1930]" : "bg-gray-50";
  const textMuted = dark ? "text-slate-400" : "text-gray-500";

  useEffect(() => {
    generate();
  }, [generate]);

  useEffect(() => {
    if (challenge && status !== "success") {
      setStatus("waiting");
      pollStatus(challenge.k1, async (token, pubkey) => {
        setStatus("success");
        try {
          const verifyRes = await fetch("/api/auth/verify", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const verifyData = await verifyRes.json();
          onSuccess(token, { ...verifyData, pubkey, sessionToken: token });
        } catch {
          onSuccess(token, { pubkey, sessionToken: token });
        }
      });
    }
    return () => stopPolling();
  }, [challenge, pollStatus, stopPolling, onSuccess, status]);

  return (
    <div>
      <p className={`text-base ${dark ? "text-slate-300" : "text-gray-700"} mb-4 text-center`}>
        Scan with a Lightning wallet that supports LNURL-auth
      </p>

      {loading && (
        <div className={`text-center py-6 ${textMuted} font-pixel text-sm`} data-testid="status-ln-loading">
          GENERATING...
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-500 font-pixel text-sm mb-3">ERROR: {error}</p>
          <button onClick={generate} className={`border-2 ${border} ${bg} px-4 py-3 font-pixel text-sm hover:opacity-80 ${dark ? "text-slate-200" : "text-gray-900"}`} data-testid="button-ln-retry">
            RETRY
          </button>
        </div>
      )}

      {challenge && !loading && !error && (
        <>
          <div className={`border-2 ${border} ${bg} p-4 mb-4 flex justify-center`}>
            {status === "success" ? (
              <div className="text-center py-4">
                <div className={`font-pixel text-base mb-2 ${dark ? "text-[#FFD700]" : "text-gray-900"}`}>AUTHENTICATED!</div>
              </div>
            ) : (
              <img
                src={challenge.qr}
                alt="LNURL-auth QR code"
                style={{ imageRendering: "pixelated", width: 220, height: 220 }}
                data-testid="img-ln-qr"
              />
            )}
          </div>

          {status === "waiting" && (
            <div className={`text-center mb-4 font-pixel text-xs ${textMuted}`}>
              WAITING FOR WALLET...
            </div>
          )}

          <div className="text-center mb-4">
            <a
              href={`lightning:${challenge.lnurl}`}
              className={`inline-block border-2 px-5 py-3 font-pixel text-sm hover:opacity-80 ${
                dark ? "border-[#2a3552] bg-[#0f1930] text-[#FFD700]" : "border-gray-900 bg-gray-900 text-white"
              }`}
              data-testid="link-open-wallet"
            >
              OPEN IN WALLET
            </a>
          </div>
        </>
      )}

      <div className={`border-t-2 ${border} pt-4 mt-4`}>
        <div className={`font-pixel text-xs mb-3 text-center ${textMuted}`}>SUPPORTED WALLETS</div>
        <div className="flex flex-wrap justify-center gap-2">
          {SUPPORTED_WALLETS.map((w) => (
            <a
              key={w.name}
              href={w.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`border ${border} px-3 py-1.5 text-sm ${dark ? "text-slate-300" : "text-gray-700"} hover:opacity-70`}
            >
              {w.name}
              {w.note && <span className={`ml-1 ${textMuted} text-xs`}>({w.note})</span>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
