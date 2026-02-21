import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/use-auth";
import LoginModal from "../components/LoginModal";

const posts = [
  {
    title: "An Approachable Deep Dive Into Lightning's Noise Protocol",
    href: "/noise-tutorial",
    description:
      "An interactive tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.",
  },
];

function ProfileDropdown({
  email,
  pubkey,
  lightningAddress,
  sessionToken,
  emailVerified,
  onSetLightningAddress,
  onLogout,
  onClose,
}: {
  email: string | null;
  pubkey: string | null;
  lightningAddress: string | null;
  sessionToken: string | null;
  emailVerified: boolean;
  onSetLightningAddress: (address: string | null) => Promise<void>;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [addressInput, setAddressInput] = useState(lightningAddress || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [showVerificationSection, setShowVerificationSection] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLightningUser = !!pubkey;
  const needsVerification = !!email && !emailVerified && !isLightningUser;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const identity = email || (pubkey ? pubkey.slice(0, 12) + "..." : "User");

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] border-4 z-50 border-border bg-card pixel-shadow"
      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      data-testid="container-profile-dropdown"
    >
      <div className="px-5 py-4 border-b-2 border-border">
        <div className="font-pixel text-xs mb-1 text-foreground/60">
          LOGGED IN AS
        </div>
        <div className="text-base truncate text-foreground">
          {identity}
        </div>
        {email && (
          <div className="mt-2 flex items-center gap-2">
            {emailVerified ? (
              <span className="text-xs font-pixel text-green-700">VERIFIED</span>
            ) : (
              <button
                type="button"
                onClick={() => setShowVerificationSection(v => !v)}
                className="font-pixel text-xs border-2 px-3 py-1.5 transition-all cursor-pointer border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
              >
                NOT VERIFIED
              </button>
            )}
          </div>
        )}
        {isLightningUser && !email && (
          <div className="mt-2">
            <span className="text-xs font-pixel text-green-700">LIGHTNING AUTH</span>
          </div>
        )}
      </div>

      {needsVerification && showVerificationSection && (
        <div className="px-5 py-4 border-b-2 border-border">
          <p className="text-base leading-relaxed mb-3 text-foreground/70">
            Verify your email to claim bitcoin rewards from checkpoints. You can also log in with LNURL-Auth instead.
          </p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className={`font-pixel text-sm border-2 px-5 py-3 transition-all border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20 ${resending ? "opacity-60 cursor-wait" : ""}`}
            data-testid="button-resend-verification"
          >
            {resending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
          </button>
          {resendMsg && (
            <p className={`mt-2 text-sm ${resendMsg.includes("sent") ? "text-green-700" : "text-red-400"}`}>
              {resendMsg}
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-4 border-b-2 border-border">
        <div className="font-pixel text-xs mb-2 text-[#9a7200]">
          LIGHTNING ADDRESS
        </div>
        {lightningAddress ? (
          <div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold truncate flex-1 px-3 py-1 rounded-full text-foreground bg-[#b8860b]/10">
                {lightningAddress}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddressInput(lightningAddress || "");
                  setSaveError(null);
                  setSaveSuccess(false);
                  setShowAddressForm(true);
                }}
                className="font-pixel text-xs border-2 px-3 py-1.5 transition-all shrink-0 border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                data-testid="button-edit-lightning-address"
              >
                EDIT
              </button>
            </div>
            <p className="mt-2 text-base leading-relaxed text-foreground/60">
              Rewards auto-send to this address.
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setAddressInput("");
                setSaveError(null);
                setSaveSuccess(false);
                setShowAddressForm(true);
              }}
              className="w-full font-pixel text-sm border-2 px-4 py-3 transition-all border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
              data-testid="button-add-lightning-address"
            >
              ADD LIGHTNING ADDRESS
            </button>
            <p className="mt-3 text-base font-medium leading-relaxed text-foreground/70">
              Adding a Lightning address makes for a much more seamless experience. Complete checkpoints and receive sats automatically without having to scan a QR code.
            </p>
          </div>
        )}
      </div>

      {showAddressForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddressForm(false); }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-[90vw] max-w-[400px] border-4 p-5 border-border bg-card">
            <div className="font-pixel text-xs mb-3 text-[#9a7200]">
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
              className="w-full px-3 py-2 text-base border-2 outline-none transition-colors border-border bg-background text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]"
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
                className="font-pixel text-xs border-2 px-4 py-2 transition-all border-border text-foreground/60 hover:text-foreground"
              >
                CANCEL
              </button>
              {saveSuccess && (
                <span className="font-pixel text-xs text-green-400">SAVED!</span>
              )}
              {saveError && (
                <span className="font-pixel text-xs text-red-400">{saveError}</span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              Rewards will auto-send to this address, so you can complete checkpoints and receive sats without scanning a QR code.
            </p>
          </div>
        </div>
      )}

      <div className="px-5 py-5">
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full font-pixel text-base border-2 px-4 py-3 transition-colors border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
          data-testid="button-logout"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
}

export default function Blog() {
  const auth = useAuth();
  const { authenticated, logout, loginWithToken, setLightningAddress } = auth;
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-between pixel-shadow relative z-50">
        <Link
          href="/"
          className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
          data-testid="link-back-home"
        >
          &lt; BACK TO HOME
        </Link>
        <div className="flex items-center gap-6">
          {authenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileDropdown((v) => !v)}
                className="p-1 transition-colors text-foreground/70 hover:text-foreground"
                title={auth.email || auth.pubkey ? `Logged in as ${auth.email || (auth.pubkey?.slice(0, 8) + "...")}` : "Logged in"}
                data-testid="button-profile"
                aria-label="Open profile menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {showProfileDropdown && (
                <ProfileDropdown
                  email={auth.email}
                  pubkey={auth.pubkey}
                  lightningAddress={auth.lightningAddress}
                  sessionToken={auth.sessionToken}
                  emailVerified={auth.emailVerified}
                  onSetLightningAddress={setLightningAddress}
                  onLogout={logout}
                  onClose={() => setShowProfileDropdown(false)}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
              data-testid="button-login"
            >
              LOGIN
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
        <header className="mb-8">
          <h1 className="font-pixel text-2xl md:text-4xl leading-tight text-shadow-retro mb-3" data-testid="text-blog-title">
            Learn
          </h1>
          <p className="font-mono text-2xl md:text-3xl" data-testid="text-blog-subtitle">
            Long-form technical articles and tutorials.
          </p>
        </header>

        <div className="grid gap-4">
          {posts.map((post) => (
            <div
              key={post.href}
              className="bg-card border-4 border-border p-4 md:p-5 pixel-shadow transition-all"
              data-testid="card-post-noise"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h2 className="font-pixel text-sm sm:text-lg md:text-xl leading-relaxed" data-testid="text-post-title">
                    {post.title}
                  </h2>
                  <p className="text-base sm:text-lg md:text-xl mt-2 text-muted-foreground" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} data-testid="text-post-description">
                    {post.description}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("pl-tutorial-mode");
                      setLocation(post.href);
                    }}
                    className="bg-primary text-foreground px-6 py-3 font-pixel text-base md:text-lg border-2 border-border text-center hover:brightness-110 transition-all cursor-pointer"
                    data-testid="badge-read"
                  >
                    READ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("pl-tutorial-mode", "code");
                      setLocation(post.href);
                    }}
                    className="bg-[#1a1a2e] text-[#ffd700] px-6 py-3 font-pixel text-base md:text-lg border-2 border-[#ffd700]/30 text-center hover:border-[#ffd700]/60 hover:bg-[#1a1a2e]/80 transition-all cursor-pointer"
                    data-testid="badge-code"
                  >
                    CODE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showLoginModal && (
        <LoginModal
          theme="light"
          onSuccess={(token, data) => {
            loginWithToken(token, data);
            setShowLoginModal(false);
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
