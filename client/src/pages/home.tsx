import { Link } from "wouter";
import { useState } from "react";
import lightningBolt from "@assets/generated_images/a_pixel_art_lightning_bolt_icon..png";
import discordLogo from "@assets/discord_1769114568630.png";

export default function Home() {
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  const handleStartClick = (e: React.MouseEvent) => {
    // Check if screen width is mobile (using standard md breakpoint of 768px)
    if (window.innerWidth < 768) {
      e.preventDefault();
      setShowMobileWarning(true);
    }
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

      {/* Top Banner */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex items-center justify-end gap-6 pixel-shadow relative z-50">
        <Link
          href="/learn"
          data-testid="link-blog"
          className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1 blog-attention"
        >
          LEARN
        </Link>
        <Link href="/about" data-testid="link-about" className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
          ABOUT
        </Link>
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

        <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-12 w-full max-w-7xl px-4">
        <div className="relative group shrink-0">
          <div className="absolute inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
          <img 
            src={lightningBolt} 
            alt="Pixel Art Lightning Bolt" 
            className="w-40 h-40 md:w-80 md:h-80 relative z-10 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]"
          />
        </div>

        <div className="grid gap-4 md:gap-6 w-full max-w-2xl">
          <a 
            href="https://replit.com/@austin-f/Programming-Lightning-Intro-to-Payment-Channels?v=1"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStartClick}
            className="bg-card border-4 border-border p-4 pixel-shadow pixel-shadow-hover transition-all cursor-pointer hover:bg-secondary group block text-foreground"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg md:text-xl font-pixel leading-relaxed">
                Intro to Payment Channels & the Bitcoin Lightning Network
              </h2>
              <div className="bg-primary text-foreground px-2 py-1 font-pixel text-[10px] border-2 border-border shrink-0">
                START
              </div>
            </div>
          </a>

          <div className="bg-muted border-4 border-muted-foreground/30 p-4 opacity-75 cursor-not-allowed relative overflow-hidden">
            {/* Scanline effect for disabled card */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-pixel text-muted-foreground">
                Coming Soon... Onion Routing & Lightning Payments
              </h2>
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
