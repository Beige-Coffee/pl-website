import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/use-auth";
import LoginModal from "../components/LoginModal";

const posts = [
  {
    title: "An Approachable Deep Dive Into Lightning's Noise Protocol",
    href: "/noise-tutorial",
    description:
      "A multi-chapter tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.",
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
      className="absolute right-0 top-full mt-2 w-80 border-2 z-50 border-border bg-card"
      data-testid="container-profile-dropdown"
    >
      <div className="px-4 py-3 border-b border-border">
        <div className="font-pixel text-xs mb-1 text-foreground/60">
          LOGGED IN AS
        </div>
        <div className="font-mono text-sm truncate text-foreground">
          {identity}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border">
        <div className="font-pixel text-xs mb-2 text-[#b8860b]">
          LIGHTNING ADDRESS
        </div>
        {lightningAddress && !saveSuccess && (
          <div className="font-mono text-xs mb-2 truncate text-foreground/70">
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
          className="w-full px-3 py-2 font-mono text-sm border-2 outline-none transition-colors border-border bg-background text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]"
          data-testid="input-lightning-address"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`font-pixel text-xs border-2 px-4 py-1.5 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
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
        <div className="mt-2 font-mono text-[11px] text-foreground/40">
          Rewards will auto-send to this address
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full font-pixel text-xs border-2 px-4 py-2 transition-colors border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
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
          <p className="font-mono text-xl md:text-2xl" data-testid="text-blog-subtitle">
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
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-pixel text-lg md:text-xl leading-relaxed" data-testid="text-post-title">
                    {post.title}
                  </h2>
                  <p className="font-mono text-lg md:text-xl mt-2 text-muted-foreground" data-testid="text-post-description">
                    {post.description}
                  </p>
                </div>
                <div
                  className="bg-primary text-foreground px-2 py-1 font-pixel text-[10px] border-2 border-border shrink-0"
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
