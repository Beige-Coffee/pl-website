import { Link } from "wouter";
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
  onSetLightningAddress,
  onLogout,
  onClose,
}: {
  email: string | null;
  pubkey: string | null;
  lightningAddress: string | null;
  onSetLightningAddress: (address: string | null) => Promise<void>;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [addressInput, setAddressInput] = useState(lightningAddress || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(!!lightningAddress);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const trimmed = addressInput.trim();
      await onSetLightningAddress(trimmed || null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save");
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
      </div>

      <div className="px-5 py-4 border-b-2 border-border">
        {!showAddressForm ? (
          <div>
            <button
              type="button"
              onClick={() => setShowAddressForm(true)}
              className="w-full font-pixel text-sm border-2 px-4 py-3 transition-all border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
              data-testid="button-add-lightning-address"
            >
              ADD LIGHTNING ADDRESS
            </button>
            <p className="mt-3 text-sm leading-relaxed text-foreground/60">
              Adding a Lightning address makes for a much more seamless experience. Complete checkpoints and receive sats automatically without having to scan a QR code.
            </p>
          </div>
        ) : (
          <div>
            <div className="font-pixel text-xs mb-2 text-[#9a7200]">
              LIGHTNING ADDRESS
            </div>
            {lightningAddress && !saveSuccess && (
              <div className="text-sm mb-2 truncate text-foreground/70">
                Current: {lightningAddress}
              </div>
            )}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`font-pixel text-xs border-2 px-4 py-2 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
                  saving ? "opacity-60 cursor-wait" : ""
                }`}
                data-testid="button-save-lightning-address"
              >
                {saving ? "SAVING..." : "SAVE"}
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
        )}
      </div>

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
            <Link
              key={post.href}
              href={post.href}
              className="bg-card border-4 border-border p-4 md:p-5 pixel-shadow pixel-shadow-hover transition-all hover:bg-secondary block"
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
                <div
                  className="bg-primary text-foreground px-6 py-3 font-pixel text-base md:text-lg border-2 border-border shrink-0 self-start sm:self-auto"
                  data-testid="badge-read"
                >
                  READ
                </div>
              </div>
            </Link>
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
