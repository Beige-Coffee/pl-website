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
  const [tab, setTab] = useState<"lightning" | "login" | "register">("login");
  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-gray-800";
  const bg = dark ? "bg-[#0f1930]" : "bg-white";
  const pageBg = dark ? "bg-[#0b1220]" : "bg-white";
  const textMuted = dark ? "text-slate-400" : "text-gray-500";

  const activeTabClass = dark
    ? "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]"
    : "border-gray-900 bg-gray-900 text-white";
  const inactiveTabClass = `${border} ${bg} ${dark ? "text-slate-400" : "text-gray-600"} hover:opacity-80`;

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
            {tab === "register" ? "REGISTER" : "LOGIN"}
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
            onClick={() => setTab("login")}
            className={`flex-1 border-2 px-3 py-3 font-pixel text-xs transition-colors ${
              tab === "login" ? activeTabClass : inactiveTabClass
            }`}
            data-testid="button-tab-login"
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`flex-1 border-2 border-l-0 px-3 py-3 font-pixel text-xs transition-colors ${
              tab === "register" ? activeTabClass : inactiveTabClass
            }`}
            data-testid="button-tab-register"
          >
            REGISTER
          </button>
          <button
            type="button"
            onClick={() => setTab("lightning")}
            className={`flex-1 border-2 border-l-0 px-3 py-3 font-pixel text-xs transition-colors ${
              tab === "lightning" ? activeTabClass : inactiveTabClass
            }`}
            data-testid="button-tab-lightning"
          >
            LIGHTNING
          </button>
        </div>

        {tab === "login" ? (
          <EmailLoginForm theme={theme} onSuccess={onSuccess} onSwitchToRegister={() => setTab("register")} />
        ) : tab === "register" ? (
          <EmailRegisterForm theme={theme} onSuccess={onSuccess} onSwitchToLogin={() => setTab("login")} />
        ) : (
          <LightningAuthForm theme={theme} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  );
}

function EmailLoginForm({
  theme,
  onSuccess,
  onSwitchToRegister,
}: {
  theme: "light" | "dark";
  onSuccess: (token: string, data: any) => void;
  onSwitchToRegister: () => void;
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        onSuccess(data.sessionToken, data);
        return;
      }

      setError(data.error || "Invalid email or password");
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
          placeholder="Your password"
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
        {loading ? "PLEASE WAIT..." : "LOG IN"}
      </button>

      <div className={`text-center font-pixel text-xs ${textMuted}`}>
        DON'T HAVE AN ACCOUNT?{" "}
        <button type="button" onClick={onSwitchToRegister} className={`${dark ? "text-[#FFD700]" : "text-gray-900"} underline`} data-testid="link-switch-register">
          REGISTER
        </button>
      </div>
    </form>
  );
}

function EmailRegisterForm({
  theme,
  onSuccess,
  onSwitchToLogin,
}: {
  theme: "light" | "dark";
  onSuccess: (token: string, data: any) => void;
  onSwitchToLogin: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setRegistered(true);
        onSuccess(data.sessionToken, data);
        return;
      }

      if (res.status === 409) {
        setError("This email is already registered. Please log in instead.");
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="text-center space-y-4">
        <div className={`font-pixel text-sm ${dark ? "text-[#FFD700]" : "text-gray-900"}`}>
          CHECK YOUR EMAIL
        </div>
        <div className={`border-2 ${border} ${dark ? "bg-[#0f1930]" : "bg-gray-50"} p-4`}>
          <p className={`text-base ${dark ? "text-slate-300" : "text-gray-700"} mb-3`}>
            We sent a verification link to <strong>{email}</strong>.
          </p>
          <p className={`text-sm ${textMuted}`}>
            You must verify your email before you can claim sat rewards. Check your inbox (and spam folder) for the verification email.
          </p>
        </div>
        <p className={`font-pixel text-xs ${textMuted}`}>
          ACCOUNT CREATED SUCCESSFULLY
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={`border-2 ${border} ${dark ? "bg-[#FFD700]/5" : "bg-yellow-50"} p-3 mb-2`}>
        <p className={`text-sm ${dark ? "text-slate-300" : "text-gray-700"}`}>
          After registering, you will receive a verification email. You must verify your email to claim sat rewards.
        </p>
      </div>

      <div>
        <label className={`block font-pixel text-xs mb-2 ${dark ? "text-slate-400" : "text-gray-700"}`}>EMAIL</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={`w-full border-2 ${border} ${inputBg} ${textColor} px-4 py-3 text-base font-mono focus:outline-none focus:border-gray-900 placeholder:text-gray-400`}
          placeholder="you@example.com"
          data-testid="input-register-email"
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
          data-testid="input-register-password"
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
        data-testid="button-register-submit"
      >
        {loading ? "PLEASE WAIT..." : "CREATE ACCOUNT"}
      </button>

      <div className={`text-center font-pixel text-xs ${textMuted}`}>
        ALREADY HAVE AN ACCOUNT?{" "}
        <button type="button" onClick={onSwitchToLogin} className={`${dark ? "text-[#FFD700]" : "text-gray-900"} underline`} data-testid="link-switch-login">
          LOG IN
        </button>
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
