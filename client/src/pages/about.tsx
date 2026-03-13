import { useState } from "react";
import { Link } from "wouter";
import lightningBolt from "@/assets/lightning-bolt.png";
import FeedbackWidget from "../components/FeedbackWidget";
import LoginModal from "../components/LoginModal";
import ProfileDropdown from "../components/ProfileDropdown";
import { useAuth } from "../hooks/use-auth";

export default function About() {
  const auth = useAuth();
  const { authenticated, logout, loginWithToken, setLightningAddress } = auth;
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {showLoginModal && (
        <LoginModal
          theme="light"
          onSuccess={(token, data) => { loginWithToken(token, data); setShowLoginModal(false); }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Top Banner */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-between pixel-shadow relative z-50">
        <Link href="/">
          <a className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            &lt; BACK TO HOME
          </a>
        </Link>
        <div className="flex items-center">
          {authenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu((v) => !v)}
                data-profile-toggle
                className="p-2 text-foreground/70 hover:text-foreground transition-colors"
                title={auth.email || auth.pubkey ? `Logged in as ${auth.email || (auth.pubkey?.slice(0, 8) + "...")}` : "Logged in"}
                data-testid="button-profile"
                aria-label="Toggle profile menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {showProfileMenu && (
                <ProfileDropdown
                  theme="light"
                  email={auth.email}
                  pubkey={auth.pubkey}
                  lightningAddress={auth.lightningAddress}
                  sessionToken={auth.sessionToken}
                  emailVerified={auth.emailVerified}
                  onSetLightningAddress={setLightningAddress}
                  onLogout={logout}
                  onClose={() => setShowProfileMenu(false)}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
            >
              LOGIN
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto p-8 md:p-12 flex flex-col justify-center">
        <div className="mb-8 flex flex-col items-center justify-center">
          <h1 className="text-xl md:text-3xl font-pixel leading-tight text-center text-shadow-retro flex items-center gap-4">
            <img src={lightningBolt} alt="" className="w-8 h-8 md:w-12 md:h-12 pixelated" />
            About Programming Lightning
            <img src={lightningBolt} alt="" className="w-8 h-8 md:w-12 md:h-12 pixelated" />
          </h1>
        </div>

        <div className="font-sans text-lg md:text-xl leading-relaxed">
          <div className="bg-card border-4 border-border p-8 pixel-shadow">
            <p className="mb-6">
              Hi, my name is Austin, and I'm a <a href="https://spiral.xyz/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Spiral</a> and <a href="https://hrf.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">HRF</a> grantee working on Programming Lightning.
            </p>
            <p className="mb-6">
              Inspired by <a href="https://github.com/jimmysong/programmingbitcoin" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Programming Bitcoin</a>, Programming Lightning is a free and open source educational resource that teaches developers and technically-inclined individuals how Lightning works by coding important pieces of the protocol from scratch.
            </p>
            <p className="mb-6">
              This project is in active development. Additional modules focusing on Lightning payments, invoices, and newer protocol advancements are coming soon!
            </p>
            <p>
              Feedback is welcome - please feel free to <a href="https://github.com/Beige-Coffee/pl-website" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">open an issue</a> or leave <button onClick={() => window.dispatchEvent(new Event("open-feedback"))} className="underline hover:text-primary cursor-pointer">feedback</button> here.
            </p>
          </div>
        </div>
      </div>
      <FeedbackWidget theme="light" />
    </div>
  );
}
