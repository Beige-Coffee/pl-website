import { useState, useEffect, useRef, type ReactNode } from "react";

const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;

function HoverTip({ children, text, dark }: { children: ReactNode; text: string; dark: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-2.5 text-xs leading-relaxed border z-[60] pointer-events-none ${
          dark ? "bg-[#0f1930] border-[#2a3552] text-slate-300" : "bg-card border-border text-foreground/80"
        }`}>
          <div className={`absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent ${
            dark ? "border-b-[#2a3552]" : "border-b-border"
          }`} />
          {text}
        </div>
      )}
    </span>
  );
}

interface ProfileDropdownProps {
  theme: "light" | "dark";
  email: string | null;
  pubkey: string | null;
  lightningAddress: string | null;
  sessionToken: string | null;
  emailVerified: boolean;
  onSetLightningAddress: (address: string | null) => Promise<void>;
  onLogout: () => void;
  onClose: () => void;
}

export default function ProfileDropdown({
  theme,
  email,
  pubkey,
  lightningAddress,
  sessionToken,
  emailVerified,
  onSetLightningAddress,
  onLogout,
  onClose,
}: ProfileDropdownProps) {
  const dark = theme === "dark";
  const [addressInput, setAddressInput] = useState(lightningAddress || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLightningUser = !!pubkey;
  const needsVerification = !!email && !emailVerified && !isLightningUser;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-profile-toggle]")) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleResendVerification = async () => {
    if (!sessionToken) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg("Verification email sent! Check your inbox.");
      } else {
        setResendMsg(data.error || "Failed to send");
      }
    } catch {
      setResendMsg("Failed to send");
    } finally {
      setResending(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const trimmed = addressInput.trim();
      await onSetLightningAddress(trimmed || null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const identity = email || (pubkey ? pubkey.slice(0, 16) + "..." : "User");

  // Shared colors
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldBg = dark ? "bg-[#FFD700]/10" : "bg-[#FFD700]/10";
  const goldHover = dark ? "hover:bg-[#FFD700]/20" : "hover:bg-[#FFD700]/20";
  const mutedText = dark ? "text-slate-400" : "text-foreground/60";
  const dividerColor = dark ? "border-[#1f2a44]" : "border-border";

  return (
    <div
      ref={dropdownRef}
      className={`absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[340px] max-w-[340px] border-2 z-50 ${
        dark ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"
      }`}
      style={sansFont}
      data-testid="container-profile-dropdown"
    >
      {/* ── Identity row ─────────────────────────────────────────── */}
      <div className={`px-4 py-3 border-b ${dividerColor}`}>
        <div className={`font-pixel text-[10px] mb-1.5 ${mutedText}`}>LOGGED IN AS</div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={`text-sm truncate font-medium ${dark ? "text-slate-200" : "text-foreground"}`}>
              {identity}
            </div>
          </div>
          {email && emailVerified && (
            <HoverTip dark={dark} text="Your email is verified. You're eligible to earn bitcoin rewards from checkpoints and coding exercises.">
              <span className={`font-pixel text-[10px] px-2 py-0.5 shrink-0 cursor-default ${dark ? "text-green-400 border border-green-400/30 bg-green-400/10" : "text-green-700 border border-green-700/30 bg-green-700/5"}`}>
                VERIFIED
              </span>
            </HoverTip>
          )}
          {isLightningUser && !email && (
            <HoverTip dark={dark} text="You signed in with LNURL-auth via a Lightning wallet. You're eligible to earn bitcoin rewards from checkpoints and coding exercises.">
              <span className={`font-pixel text-[10px] px-2 py-0.5 shrink-0 cursor-default ${dark ? "text-green-400 border border-green-400/30 bg-green-400/10" : "text-green-700 border border-green-700/30 bg-green-700/5"}`}>
                LIGHTNING
              </span>
            </HoverTip>
          )}
          {needsVerification && (
            <HoverTip dark={dark} text="Your email is not yet verified. Verify to earn bitcoin rewards from checkpoints and coding exercises. Click this badge to resend the verification email.">
              <span
                className={`font-pixel text-[10px] px-2 py-0.5 shrink-0 cursor-pointer transition-all ${goldText} ${goldBorder} border ${goldBg} ${goldHover}`}
                onClick={handleResendVerification}
              >
                {resending ? "SENDING..." : "NOT VERIFIED"}
              </span>
            </HoverTip>
          )}
        </div>
        {resendMsg && (
          <p className={`mt-1.5 text-xs ${resendMsg.includes("sent") ? (dark ? "text-green-400" : "text-green-700") : "text-red-400"}`}>
            {resendMsg}
          </p>
        )}
      </div>

      {/* ── Lightning address row ────────────────────────────────── */}
      <div className={`px-4 py-3 border-b ${dividerColor}`}>
        <HoverTip dark={dark} text="A Lightning address (like you@wallet.com) lets you auto-receive bitcoin rewards when you complete checkpoints and coding exercises, no QR code scanning needed.">
          <span className={`font-pixel text-[10px] mb-1.5 inline-flex items-center gap-1 cursor-default ${goldText}`}>
            LIGHTNING ADDRESS
            <svg className={`w-3 h-3 ${mutedText}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        </HoverTip>
        {lightningAddress ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <svg className={`w-3.5 h-3.5 shrink-0 ${goldText}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className={`text-sm truncate ${dark ? "text-slate-200" : "text-foreground"}`}>
                {lightningAddress}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddressInput(lightningAddress || "");
                setSaveError(null);
                setSaveSuccess(false);
                setShowAddressForm(true);
              }}
              className={`font-pixel text-[10px] px-2 py-0.5 border transition-all cursor-pointer shrink-0 ${goldBorder} ${goldText} ${goldBg} ${goldHover}`}
              data-testid="button-edit-lightning-address"
            >
              EDIT
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAddressInput("");
              setSaveError(null);
              setSaveSuccess(false);
              setShowAddressForm(true);
            }}
            className={`w-full font-pixel text-[10px] py-1.5 border transition-all cursor-pointer ${goldBorder} ${goldText} ${goldBg} ${goldHover}`}
            data-testid="button-add-lightning-address"
          >
            + ADD LIGHTNING ADDRESS
          </button>
        )}
      </div>

      {/* ── Logout ───────────────────────────────────────────────── */}
      <div className="px-4 py-2.5">
        <button
          type="button"
          onClick={() => { onLogout(); onClose(); }}
          className={`w-full font-pixel text-xs py-2 transition-colors text-center ${
            dark
              ? "text-slate-500 hover:text-slate-200"
              : "text-foreground/40 hover:text-foreground"
          }`}
          data-testid="button-logout"
        >
          LOGOUT
        </button>
      </div>

      {/* ── Lightning address modal ──────────────────────────────── */}
      {showAddressForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddressForm(false); }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className={`relative w-[90vw] max-w-[380px] border-4 p-5 ${
            dark ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"
          }`}>
            <div className={`font-pixel text-xs mb-3 ${goldText}`}>
              {lightningAddress ? "EDIT LIGHTNING ADDRESS" : "ADD LIGHTNING ADDRESS"}
            </div>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setSaveError(null);
                setSaveSuccess(false);
              }}
              placeholder="you@wallet.com"
              className={`w-full px-4 py-3 text-base border-2 outline-none transition-colors ${
                dark
                  ? "border-[#2a3552] bg-[#0b1220] text-slate-200 placeholder:text-slate-600 focus:border-[#FFD700]"
                  : "border-border bg-background text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]"
              }`}
              style={sansFont}
              data-testid="input-lightning-address"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowAddressForm(false);
              }}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) setShowAddressForm(false);
                }}
                disabled={saving}
                className={`font-pixel text-xs border-2 px-4 py-2 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
                  saving ? "opacity-60 cursor-wait" : ""
                }`}
                data-testid="button-save-lightning-address"
              >
                {saving ? "SAVING..." : "SAVE"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddressForm(false)}
                className={`font-pixel text-xs border-2 px-4 py-2 transition-all ${
                  dark
                    ? "border-[#2a3552] text-slate-400 hover:text-slate-200"
                    : "border-border text-foreground/60 hover:text-foreground"
                }`}
              >
                CANCEL
              </button>
              {saveSuccess && <span className="font-pixel text-[10px] text-green-400">SAVED!</span>}
              {saveError && <span className="font-pixel text-[10px] text-red-400">{saveError}</span>}
            </div>
            <p className={`mt-3 text-sm leading-relaxed ${dark ? "text-slate-400" : "text-foreground/60"}`}>
              Rewards will auto-send to this address. Complete checkpoints and receive sats without scanning a QR code.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
