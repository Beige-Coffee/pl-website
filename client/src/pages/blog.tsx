import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import LoginModal from "../components/LoginModal";
import ProfileDropdown from "../components/ProfileDropdown";

const posts = [
  {
    title: "Programming Lightning: Intro to Payment Channels",
    href: "/lightning-tutorial",
    description:
      "Build a Lightning payment channel from scratch. By the end, your implementation will pass the official BOLT 3 test vectors.",
  },
  {
    title: "An Approachable Deep Dive Into Lightning's Noise Protocol",
    href: "/noise-tutorial",
    description:
      "An interactive tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.",
  },
];

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
                data-profile-toggle
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
                  theme="light"
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
                    className="bg-[#1a1a2e] text-white px-6 py-3 font-pixel text-base md:text-lg border-2 border-white/30 text-center hover:border-white/60 hover:bg-[#1a1a2e]/80 transition-all cursor-pointer"
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
