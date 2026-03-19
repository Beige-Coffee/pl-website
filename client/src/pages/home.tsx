import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import lightningBolt from "@/assets/lightning-bolt.png";
import xkLogo from "/xk-logo.png";
import LoginModal from "../components/LoginModal";
import ProfileDropdown from "../components/ProfileDropdown";
import { useAuth } from "../hooks/use-auth";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { chapters as lightningChapters } from "./lightning-tutorial";
import { chapters as noiseChapters } from "./noise-tutorial";

export default function Home() {
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showRustConfirm, setShowRustConfirm] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { authenticated, logout, loginWithToken, setLightningAddress } = auth;

  // "Continue Where You Left Off" — read last chapters from localStorage
  const continueData = useMemo(() => {
    try {
      const lnChapterId = localStorage.getItem("pl-lightning-last-chapter");
      const noiseChapterId = localStorage.getItem("pl-noise-last-chapter");
      const items: { course: string; chapterId: string; chapterTitle: string; path: string }[] = [];
      if (lnChapterId) {
        const ch = lightningChapters.find((c) => c.id === lnChapterId);
        if (ch) items.push({ course: "Intro to Payment Channels", chapterId: lnChapterId, chapterTitle: ch.title, path: `/lightning-tutorial/${lnChapterId}` });
      }
      if (noiseChapterId) {
        const ch = noiseChapters.find((c) => c.id === noiseChapterId);
        if (ch) items.push({ course: "Noise Protocol", chapterId: noiseChapterId, chapterTitle: ch.title, path: `/noise-tutorial/${noiseChapterId}` });
      }
      return items;
    } catch { return []; }
  }, []);

  const handleCodeClick = () => {
    setShowCodeModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Code Language Modal */}
      {showCodeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCodeModal(false); }}
        >
          <div className="bg-card border-4 border-border p-6 pixel-shadow max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
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
                  onClick={() => { setShowCodeModal(false); navigate("/lightning-tutorial?mode=code"); }}
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
                <button
                  onClick={() => setShowRustConfirm(true)}
                  className="block w-full text-center bg-[#a72145] text-white px-3 py-2 font-pixel text-sm border-2 border-[#8b1a38] hover:bg-[#8b1a38] transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                >
                  START IN RUST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rust Confirmation Modal */}
      {showRustConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRustConfirm(false); }}
        >
          <div className="bg-card border-4 border-border p-6 pixel-shadow max-w-lg w-full relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowRustConfirm(false)}
              className="absolute top-2 right-3 font-pixel text-xl hover:text-primary"
            >
              X
            </button>
            <h3 className="font-pixel text-lg mb-4">Before You Go</h3>
            <div className="space-y-3 text-base text-foreground/80 mb-5" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              <p>
                The <strong>Rust version</strong> is the original course hosted on <strong>Replit</strong>. It covers the same material but is a simpler, older format.
              </p>
              <p>
                The <strong>Python version</strong> is newer and built directly into this website with a richer learning experience, including:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Interactive code exercises with instant feedback</li>
                <li>Built-in Bitcoin regtest node for broadcasting real transactions</li>
                <li>Knowledge checkpoints with sat rewards</li>
                <li>Scratch pad sandbox for experimenting with code</li>
                <li>Auto-complete, signature hints, and file browser</li>
                <li>Progress tracking across sessions</li>
              </ul>
              <p>
                If you specifically want to learn Rust, the Replit version is a great choice. Otherwise, we recommend the Python version for the best experience.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://replit.com/@austin-f/Programming-Lightning-Intro-to-Payment-Channels?v=1"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { setShowRustConfirm(false); setShowCodeModal(false); }}
                className="flex-1 text-center bg-[#a72145] text-white px-3 py-3 font-pixel text-sm border-2 border-[#8b1a38] hover:bg-[#8b1a38] transition-colors pixel-shadow"
              >
                CONTINUE TO RUST
              </a>
              <button
                onClick={() => { setShowRustConfirm(false); setShowCodeModal(false); navigate("/lightning-tutorial?mode=code"); }}
                className="flex-1 bg-primary text-foreground px-3 py-3 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors pixel-shadow"
              >
                TRY PYTHON INSTEAD
              </button>
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
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-between pixel-shadow relative z-50">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/learn" className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            LEARN
          </Link>
          <Link href="/about" data-testid="link-about" className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            ABOUT
          </Link>
          <a href="https://discord.gg/j2G7nK8EDh" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1" title="Discord">
            <svg width="20" height="20" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.3 37.3 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.5 4.9a.2.2 0 0 0-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.9 58.9 0 0 0 17.7 9a.2.2 0 0 0 .3-.1 42.1 42.1 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.6 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.3 47.3 0 0 0 3.6 5.9.2.2 0 0 0 .3.1A58.7 58.7 0 0 0 70.5 45.7v-.2c1.4-15-2.3-28-9.8-39.5a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7Zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7Z" />
            </svg>
          </a>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
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
              data-testid="button-login"
            >
              LOGIN
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 pt-8 md:pt-12 pb-8 relative">
        {/* Continue Where You Left Off — desktop: floating top-left, mobile: inline below header */}
        {authenticated && continueData.length > 0 && (
          <>
            {/* Desktop: absolute positioned */}
            <div className="hidden md:block absolute top-2 left-4 z-20">
              <button
                onClick={() => continueData.length === 1 ? navigate(continueData[0].path) : setShowContinue((s) => !s)}
                className="flex items-start gap-2.5 bg-card border-2 border-border px-3 py-2 shadow-[2px_2px_0px_rgba(0,0,0,0.15)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.25)] hover:border-foreground/30 transition-all group cursor-pointer text-left"
              >
                <span className="text-[#b8860b] mt-0.5 text-base leading-none">&#9654;</span>
                <div className="min-w-0">
                  <span className="font-pixel text-[10px] text-foreground/45 block leading-none">RESUME</span>
                  <span
                    className="text-sm font-semibold text-foreground/80 group-hover:text-foreground truncate block mt-0.5 max-w-[200px]"
                    style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    {continueData[0].chapterTitle}
                  </span>
                  {continueData.length > 1 && (
                    <span className="font-pixel text-[9px] text-foreground/35 block mt-0.5">+{continueData.length - 1} MORE ▾</span>
                  )}
                </div>
              </button>
              {showContinue && continueData.length > 1 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowContinue(false)} />
                  <div className="absolute top-full left-0 mt-1 z-20 bg-card border-2 border-border shadow-md min-w-[240px]">
                    {continueData.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors border-b last:border-b-0 border-border"
                        style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                        onClick={() => setShowContinue(false)}
                      >
                        <span className="text-[#b8860b] text-xs leading-none">&#9654;</span>
                        <div className="min-w-0">
                          <span className="font-pixel text-[9px] text-foreground/40 block leading-none">{item.course === "Intro to Payment Channels" ? "LIGHTNING" : "NOISE"}</span>
                          <span className="text-sm font-semibold text-foreground/80 truncate block mt-0.5">{item.chapterTitle}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <header className="text-center mb-8 md:mb-10 w-full max-w-4xl">
          <h1 className="text-3xl md:text-5xl font-pixel leading-tight mb-4 text-shadow-retro">
            Programming<br />Lightning
          </h1>
          <p className="text-xl md:text-3xl font-mono font-bold text-foreground">
            A Free, Open-Source Guide to Programming the Bitcoin Lightning Network
          </p>
        </header>

        {/* Mobile: inline resume card below header */}
        {authenticated && continueData.length > 0 && (
          <div className="md:hidden w-full max-w-6xl mb-4 relative">
            <button
              onClick={() => continueData.length === 1 ? navigate(continueData[0].path) : setShowContinue((s) => !s)}
              className="w-full flex items-center gap-3 bg-card border-2 border-border px-4 py-3 shadow-[2px_2px_0px_rgba(0,0,0,0.15)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.25)] hover:border-foreground/30 transition-all group cursor-pointer text-left"
            >
              <span className="text-[#b8860b] text-lg leading-none">&#9654;</span>
              <div className="min-w-0 flex-1">
                <span className="font-pixel text-[10px] text-foreground/45 block leading-none">RESUME</span>
                <span
                  className="text-sm font-semibold text-foreground/80 group-hover:text-foreground truncate block mt-0.5"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                >
                  {continueData[0].chapterTitle}
                </span>
              </div>
              {continueData.length > 1 && (
                <span className="font-pixel text-[9px] text-foreground/35 shrink-0">+{continueData.length - 1} MORE ▾</span>
              )}
            </button>
            {showContinue && continueData.length > 1 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowContinue(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border-2 border-border shadow-md">
                  {continueData.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors border-b last:border-b-0 border-border"
                      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                      onClick={() => setShowContinue(false)}
                    >
                      <span className="text-[#b8860b] text-xs leading-none">&#9654;</span>
                      <div className="min-w-0">
                        <span className="font-pixel text-[9px] text-foreground/40 block leading-none">{item.course === "Intro to Payment Channels" ? "LIGHTNING" : "NOISE"}</span>
                        <span className="text-sm font-semibold text-foreground/80 truncate block mt-0.5">{item.chapterTitle}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="w-full max-w-6xl space-y-4 md:space-y-5">

          {/* Course 1: Intro to Payment Channels */}
          <div>
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
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span
                          className="bg-muted text-muted-foreground px-6 py-2.5 font-pixel text-sm border-2 border-muted-foreground/30 cursor-not-allowed pixel-shadow text-center flex-1 md:flex-none opacity-75"
                        >
                          READ
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="bg-card text-foreground border-4 border-border text-lg px-4 py-3 pixel-shadow max-w-xs rounded-none font-sans">
                        Coming March 2026
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCodeClick}
                          className="bg-foreground text-background px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-foreground/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex-1 md:flex-none"
                        >
                          CODE
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="bg-card text-foreground border-4 border-border text-lg px-4 py-3 pixel-shadow max-w-xs rounded-none font-sans">
                        Deep dive into how Lightning payment channels work. You'll build one from scratch with hands-on Python exercises.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              {/* Bracket annotation — large screens */}
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
                    BOLT 2 &mdash; channel management<br />
                    BOLT 3 &mdash; transactions<br />
                    BOLT 5 &mdash; on-chain
                  </div>
                </div>
              </div>
            </div>
            {/* Annotation below card — small screens */}
            <div className="lg:hidden pl-6 mt-2" style={{ fontFamily: 'Caveat, cursive' }}>
              <div className="text-2xl text-foreground/90 leading-snug font-bold underline decoration-foreground/30 underline-offset-4">Peer-to-peer layer</div>
              <ul className="text-xl text-foreground/70 leading-snug list-disc pl-6 mt-0.5">
                <li>BOLT 2 &mdash; channel management</li>
                <li>BOLT 3 &mdash; transactions</li>
                <li>BOLT 5 &mdash; on-chain</li>
              </ul>
            </div>
          </div>

          {/* Course 2: Noise Protocol */}
          <div>
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
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Link
                          href="/noise-tutorial?mode=read"
                          className="bg-primary text-foreground px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-primary/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-center flex-1 md:flex-none"
                        >
                          READ
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="bg-card text-foreground border-4 border-border text-lg px-4 py-3 pixel-shadow max-w-xs rounded-none font-sans">
                        Learn how Lightning nodes establish encrypted connections, with checkpoint quizzes along the way. No programming required.
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        {auth.email === "francis.austin@proton.me" ? (
                          <Link
                            href="/noise-tutorial?mode=code"
                            className="bg-foreground text-background px-6 py-2.5 font-pixel text-sm border-2 border-border hover:bg-foreground/80 transition-colors pixel-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-center flex-1 md:flex-none"
                          >
                            CODE
                          </Link>
                        ) : (
                          <span
                            className="bg-muted text-muted-foreground px-6 py-2.5 font-pixel text-sm border-2 border-muted-foreground/30 cursor-not-allowed pixel-shadow text-center flex-1 md:flex-none opacity-75"
                          >
                            CODE
                          </span>
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="bg-card text-foreground border-4 border-border text-lg px-4 py-3 pixel-shadow max-w-xs rounded-none font-sans">
                        {auth.email === "francis.austin@proton.me"
                          ? "Build the Noise Protocol from scratch with hands-on Python exercises."
                          : "Coming March 2026"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              {/* Bracket annotation — large screens */}
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
            {/* Annotation below card — small screens */}
            <div className="lg:hidden pl-6 mt-2" style={{ fontFamily: 'Caveat, cursive' }}>
              <div className="text-2xl text-foreground/90 leading-snug font-bold underline decoration-foreground/30 underline-offset-4">Network layer</div>
              <ul className="text-xl text-foreground/70 leading-snug list-disc pl-6 mt-0.5">
                <li>BOLT 8 &mdash; transport</li>
                <li>Noise_XK handshake</li>
                <li>DH key exchange</li>
                <li>Key rotation</li>
              </ul>
            </div>
          </div>

          {/* Coming Soon: Onion Routing */}
          <div>
            <div className="flex items-stretch gap-0">
              <div className="bg-muted border-4 border-muted-foreground/30 p-4 opacity-75 cursor-not-allowed relative overflow-hidden flex-1 min-w-0">
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
                <h2 className="text-lg md:text-xl font-pixel text-muted-foreground">
                  Coming Soon... Onion Routing & Lightning Payments
                </h2>
              </div>
              {/* Bracket annotation — large screens */}
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
            {/* Annotation below card — small screens */}
            <div className="lg:hidden pl-6 mt-2" style={{ fontFamily: 'Caveat, cursive' }}>
              <div className="text-2xl text-foreground/90 leading-snug font-bold underline decoration-foreground/30 underline-offset-4">Routing layer</div>
              <ul className="text-xl text-foreground/70 leading-snug list-disc pl-6 mt-0.5">
                <li>BOLT 4 &mdash; onion routing</li>
                <li>BOLT 7 &mdash; pathfinding</li>
              </ul>
            </div>
          </div>

          {/* Coming Soon: Lightning Invoices */}
          <div>
            <div className="flex items-stretch gap-0">
              <div className="bg-muted border-4 border-muted-foreground/30 p-4 opacity-75 cursor-not-allowed relative overflow-hidden flex-1 min-w-0">
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
                <h2 className="text-lg md:text-xl font-pixel text-muted-foreground">
                  Coming Soon... Lightning Invoices
                </h2>
              </div>
              {/* Bracket annotation — large screens */}
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
            {/* Annotation below card — small screens */}
            <div className="lg:hidden pl-6 mt-2" style={{ fontFamily: 'Caveat, cursive' }}>
              <div className="text-2xl text-foreground/90 leading-snug font-bold underline decoration-foreground/30 underline-offset-4">Payment layer</div>
              <ul className="text-xl text-foreground/70 leading-snug list-disc pl-6 mt-0.5">
                <li>BOLT 11 &mdash; invoices</li>
                <li>BOLT 12 &mdash; offers</li>
              </ul>
            </div>
          </div>
        </div>

    </div>
    </div>
  );
}
