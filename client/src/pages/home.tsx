import { Link } from "wouter";
import lightningBolt from "@assets/generated_images/a_pixel_art_lightning_bolt_icon..png";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top Banner */}
      <div className="w-full border-b-4 border-border bg-card p-4 flex justify-end pixel-shadow relative z-50">
        <Link href="/about">
          <a className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            ABOUT
          </a>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 md:p-4">
        <header className="text-center mb-8 md:mb-10 w-full max-w-4xl mt-8 md:mt-0">
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
          <div 
            className="bg-card border-4 border-border p-4 pixel-shadow pixel-shadow-hover transition-all cursor-pointer hover:bg-secondary group block"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg md:text-xl font-pixel leading-relaxed">
                Intro to Payment Channels & the Bitcoin Lightning Network
              </h2>
              <div className="bg-primary text-foreground px-2 py-1 font-pixel text-[10px] border-2 border-border shrink-0">
                START
              </div>
            </div>
          </div>

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
    </div>
  );
}
