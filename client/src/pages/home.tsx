import { Link, useLocation } from "wouter";
import { useState } from "react";
import lightningBolt from "@assets/generated_images/a_pixel_art_lightning_bolt_icon..png";
import xkLogo from "/xk-logo.png";
import discordLogo from "@assets/discord_1769114568630.png";
import LoginModal from "../components/LoginModal";
import { useAuth } from "../hooks/use-auth";

export default function Home() {
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [, navigate] = useLocation();
  const { authenticated, logout, loginWithToken, email, pubkey } = useAuth();

  const checkMobile = () => {
    if (window.innerWidth < 768) {
      setShowMobileWarning(true);
      return true;
    }
    return false;
  };

  const handleReadClick = (e: React.MouseEvent) => {
    if (checkMobile()) e.preventDefault();
  };

  const handleCodeClick = () => {
    if (!checkMobile()) setShowCodeModal(true);
  };

  const handleNoiseClick = (e: React.MouseEvent) => {
    if (checkMobile()) e.preventDefault();
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Mobile Warning Modal */}
      {showMobileWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border-4 border-border p-6 pixel-shadow max-w-sm w-full relative">
            <button
              onClick={() => setShowMobileWarning(false)}
              className="absolute top-2 right-2 font-pixel text-xl hover:text-primary"
            >
              X
            </button>
            <h3 className="font-pixel text-xl mb-4 text-center">Desktop Only</h3>
            <p className="font-mono text-center mb-6">
              Please note: This course is designed for desktop browsers and doesn't currently support mobile devices.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowMobileWarning(false)}
                className="bg-primary text-foreground px-4 py-2 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Language Modal */}
      {showCodeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCodeModal(false); }}
        >
          <div className="bg-card border-4 border-border p-6 pixel-shadow max-w-2xl w-full relative">
            <button
              onClick={() => setShowCodeModal(false)}
              className="absolute top-2 right-3 font-pixel text-xl hover:text-primary"
            >
              X
            </button>
            <h3 className="font-pixel text-lg mb-2 text-center">Choose Your Language</h3>
            <p className="text-base text-center text-foreground font-bold mb-6" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Both courses cover the same material. Pick the one that fits your goals.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Python option */}
              <div className="border-4 border-border p-4 bg-card hover:bg-secondary transition-colors group relative flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-pixel text-base">Python</span>
                  <span className="bg-[#FFD700] text-black font-pixel text-[9px] px-1.5 py-0.5 border border-border">RECOMMENDED</span>
                </div>
                <ul className="text-base space-y-2 text-foreground/80 mb-4 flex-1" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  <li>Recommended for most learners. Focus on understanding Lightning protocol concepts without worrying about memory management or ownership.</li>
                  <li>Completely hosted on the Programming Lightning website with an enhanced, interactive learning experience.</li>
                </ul>
                <button
                  onClick={() => { setShowCodeModal(false); navigate("/lightning-tutorial"); }}
                  className="w-full bg-primary text-foreground px-3 py-2 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  START IN PYTHON
                </button>
              </div>

              {/* Rust option */}
              <div className="border-4 border-border p-4 bg-card hover:bg-secondary transition-colors group relative flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-pixel text-base">Rust</span>
                  <span className="bg-[#a72145]/20 text-[#a72145] font-pixel text-[9px] px-1.5 py-0.5 border border-[#a72145]/40">ADVANCED</span>
                </div>
                <ul className="text-base space-y-2 text-foreground/80 mb-4 flex-1" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  <li>Best for students who want to program in Rust and work towards protocol development. More challenging because it requires thinking about memory management and ownership.</li>
                  <li>Currently hosted on Replit and may be migrated to this website in the near future for a better learning experience.</li>
                </ul>
                <a
                  href="https://replit.com/@austin-f/Programming-Lightning-Intro-to-Payment-Channels?v=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-[#a72145] text-white px-3 py-2 font-pixel text-sm border-2 border-[#8b1a38] hover:bg-[#8b1a38] transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  START IN RUST
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
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

      {/* Top Banner */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-end gap-6 pixel-shadow relative z-50">
        <Link href="/about" data-testid="link-about" className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
          ABOUT
        </Link>
        {authenticated ? (
          <button
            type="button"
            onClick={logout}
            className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1"
            title={email || pubkey ? `Logged in as ${email || (pubkey?.slice(0, 8) + "...")}` : "Logged in"}
          >
            LOGOUT
          </button>
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

      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-8 md:pt-12 pb-8">
        <header className="text-center mb-8 md:mb-10 w-full max-w-4xl">
          <h1 className="text-3xl md:text-5xl font-pixel leading-tight mb-4 text-shadow-retro">
            Programming<br />Lightning
          </h1>
          <p className="text-xl md:text-3xl font-mono font-bold text-foreground">
            A Free, Open-Source Guide to Programming the Bitcoin Lightning Network
          </p>
        </header>

        <div className="w-full max-w-6xl space-y-4 md:space-y-5">
          {/* Course 1: Intro to Payment Channels */}
          <div className="flex items-stretch gap-0">
            <div className="bg-card border-4 border-border p-4 pixel-shadow flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex items-start md:items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <img
                    src={lightningBolt}
                    alt="Lightning Bolt"
                    className="w-14 h-14 md:w-28 md:h-28 shrink-0 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.6)]"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-xl font-pixel leading-relaxed">
                      Intro to Payment Channels
                    </h2>
                    <p className="hidden md:block text-base text-foreground/70 mt-2" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      Build a Lightning payment channel from scratch. By the end, your implementation will pass many of the official BOLT 3 test vectors.
                    </p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 shrink-0">
                  <Link
                    href="/lightning-tutorial"
                    onClick={handleReadClick}
                    className="bg-primary text-foreground px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-center flex-1 md:flex-none"
                  >
                    READ
                  </Link>
                  <button
                    onClick={handleCodeClick}
                    className="bg-foreground text-background px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-foreground/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex-1 md:flex-none"
                  >
                    CODE
                  </button>
                </div>
              </div>
            </div>
            {/* Bracket annotation */}
            <div className="hidden lg:flex items-center shrink-0">
              <svg width="24" viewBox="0 0 24 100" preserveAspectRatio="none" className="h-full text-foreground/70" style={{ minHeight: 80 }}>
                <defs>
                  <filter id="sketch1" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
                    <feTurbulence type="turbulence" baseFrequency="0.03 0.01" numOctaves="3" seed="2" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <path d="M 2,2 L 14,2 L 14,46 L 22,50 L 14,54 L 14,98 L 2,98" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#sketch1)" />
              </svg>
              <div className="pl-3 w-64" style={{ fontFamily: 'Caveat, cursive' }}>
                <div className="text-3xl text-foreground/90 leading-snug font-bold">Peer-to-peer layer</div>
                <div className="text-2xl text-foreground/70 leading-snug">
                  BOLT 2 &mdash; channels<br />
                  BOLT 3 &mdash; transactions<br />
                  BOLT 5 &mdash; on-chain
                </div>
              </div>
            </div>
          </div>

          {/* Course 2: Noise Protocol */}
          <div className="flex items-stretch gap-0">
            <div className="bg-card border-4 border-border p-4 pixel-shadow flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex items-start md:items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <img
                    src={xkLogo}
                    alt="XK Noise Protocol"
                    className="w-14 h-14 md:w-28 md:h-28 shrink-0 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-xl font-pixel leading-relaxed">
                      Secure Communication & Lightning's Noise Protocol
                    </h2>
                    <p className="hidden md:block text-base text-foreground/70 mt-2" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      An interactive tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging in Lightning transport.
                    </p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-2 shrink-0">
                  <Link
                    href="/noise-tutorial"
                    onClick={handleNoiseClick}
                    className="bg-primary text-foreground px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-center flex-1 md:flex-none"
                  >
                    READ
                  </Link>
                  <Link
                    href="/noise-tutorial"
                    onClick={handleNoiseClick}
                    className="bg-foreground text-background px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-foreground/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-center flex-1 md:flex-none"
                  >
                    CODE
                  </Link>
                </div>
              </div>
            </div>
            {/* Bracket annotation */}
            <div className="hidden lg:flex items-center shrink-0">
              <svg width="24" viewBox="0 0 24 100" preserveAspectRatio="none" className="h-full text-foreground/70" style={{ minHeight: 80 }}>
                <defs>
                  <filter id="sketch2" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
                    <feTurbulence type="turbulence" baseFrequency="0.03 0.01" numOctaves="3" seed="7" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <path d="M 2,2 L 14,2 L 14,46 L 22,50 L 14,54 L 14,98 L 2,98" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#sketch2)" />
              </svg>
              <div className="pl-3 w-64" style={{ fontFamily: 'Caveat, cursive' }}>
                <div className="text-3xl text-foreground/90 leading-snug font-bold">Network layer</div>
                <div className="text-2xl text-foreground/70 leading-snug">
                  BOLT 8 &mdash; transport<br />
                  Noise_XK handshake<br />
                  DH key exchange<br />
                  Key rotation
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon: Onion Routing */}
          <div className="flex items-stretch gap-0">
            <div className="bg-muted border-4 border-muted-foreground/30 p-4 opacity-75 cursor-not-allowed relative overflow-hidden flex-1 min-w-0">
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
              <h2 className="text-lg md:text-xl font-pixel text-muted-foreground">
                Coming Soon... Onion Routing & Lightning Payments
              </h2>
            </div>
            {/* Bracket annotation */}
            <div className="hidden lg:flex items-center shrink-0">
              <svg width="24" viewBox="0 0 24 100" preserveAspectRatio="none" className="h-full text-foreground/70" style={{ minHeight: 50 }}>
                <defs>
                  <filter id="sketch3" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
                    <feTurbulence type="turbulence" baseFrequency="0.03 0.01" numOctaves="3" seed="13" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <path d="M 2,2 L 14,2 L 14,46 L 22,50 L 14,54 L 14,98 L 2,98" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#sketch3)" />
              </svg>
              <div className="pl-3 w-64" style={{ fontFamily: 'Caveat, cursive' }}>
                <div className="text-3xl text-foreground/90 leading-snug font-bold">Routing layer</div>
                <div className="text-2xl text-foreground/70 leading-snug">
                  BOLT 4 &mdash; onion routing<br />
                  BOLT 7 &mdash; pathfinding
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon: Lightning Invoices */}
          <div className="flex items-stretch gap-0">
            <div className="bg-muted border-4 border-muted-foreground/30 p-4 opacity-75 cursor-not-allowed relative overflow-hidden flex-1 min-w-0">
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
              <h2 className="text-lg md:text-xl font-pixel text-muted-foreground">
                Coming Soon... Lightning Invoices
              </h2>
            </div>
            {/* Bracket annotation */}
            <div className="hidden lg:flex items-center shrink-0">
              <svg width="24" viewBox="0 0 24 100" preserveAspectRatio="none" className="h-full text-foreground/70" style={{ minHeight: 50 }}>
                <defs>
                  <filter id="sketch4" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
                    <feTurbulence type="turbulence" baseFrequency="0.03 0.01" numOctaves="3" seed="19" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
                <path d="M 2,2 L 14,2 L 14,46 L 22,50 L 14,54 L 14,98 L 2,98" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#sketch4)" />
              </svg>
              <div className="pl-3 w-64" style={{ fontFamily: 'Caveat, cursive' }}>
                <div className="text-3xl text-foreground/90 leading-snug font-bold">Payment layer</div>
                <div className="text-2xl text-foreground/70 leading-snug">
                  BOLT 11 &mdash; invoices<br />
                  BOLT 12 &mdash; offers
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="mt-16 mb-8 text-center max-w-2xl mx-auto w-full">
        <div className="flex flex-col items-center gap-4">
          <img
            src={discordLogo}
            alt="Discord Logo"
            className="w-12 h-12 md:w-16 md:h-16 pixelated"
          />
          <p className="font-mono text-xl md:text-2xl font-bold bg-card border-4 border-border p-4 pixel-shadow" data-testid="text-discord-invite">
            Have questions or feedback? Want to share your progress? <br className="hidden md:block"/>
            <a
              href="https://discord.gg/j2G7nK8EDh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              data-testid="link-discord"
            >
              Join the Programming Lightning Discord
            </a>{" "}
            to connect with other students, get help, and discuss Lightning development!
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
