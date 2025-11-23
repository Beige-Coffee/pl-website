import { Link } from "wouter";
import lightningBolt from "@assets/generated_images/a_pixel_art_lightning_bolt_icon..png";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="absolute top-4 right-4 md:top-8 md:right-8">
        <Link href="/about">
          <a className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            ABOUT
          </a>
        </Link>
      </div>

      {/* Decorative background elements could go here if needed, but CSS handles the grid */}
      
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-5xl font-pixel leading-tight mb-4 text-shadow-retro">
          Programming<br />Lightning
        </h1>
        <p className="text-lg md:text-2xl font-mono text-muted-foreground">
          A Free, Open-Source Guide to Programming the Bitcoin Lightning Network
        </p>
      </header>

      <div className="mb-10 md:mb-16 relative group">
        <div className="absolute inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
        <img 
          src={lightningBolt} 
          alt="Pixel Art Lightning Bolt" 
          className="w-40 h-40 md:w-64 md:h-64 relative z-10 drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]"
        />
      </div>

      <div className="grid gap-4 md:gap-6 w-full max-w-2xl">
        <a 
          href="https://replit.com/@austin-f/Programming-Lightning-Intro-to-Payment-Channels"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card border-4 border-border p-6 pixel-shadow pixel-shadow-hover transition-all cursor-pointer hover:bg-secondary group block"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-pixel leading-relaxed">
              Intro to Payment Channels & the Bitcoin Lightning Network
            </h2>
            <div className="bg-primary text-foreground px-3 py-1 font-pixel text-xs border-2 border-border shrink-0">
              START
            </div>
          </div>
        </a>

        <div className="bg-muted border-4 border-muted-foreground/30 p-6 opacity-75 cursor-not-allowed relative overflow-hidden">
          {/* Scanline effect for disabled card */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />
          
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-pixel text-muted-foreground">
              More Coming Soon...
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
