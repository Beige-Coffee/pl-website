import { Link } from "wouter";
import lightningBolt from "@assets/generated_images/a_pixel_art_lightning_bolt_icon..png";

export default function About() {
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top Banner */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex justify-start pixel-shadow relative z-50">
        <Link href="/">
          <a className="font-pixel text-sm md:text-base hover:text-primary transition-colors border-b-4 border-transparent hover:border-primary pb-1">
            &lt; BACK TO HOME
          </a>
        </Link>
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
              Feedback and corrections are welcome - please feel free to open an issue or submit a pull request. You can also reach me directly at <a href="mailto:hello@programminglightning.com" className="underline hover:text-primary">hello@programminglightning.com</a>. I'd love to hear your thoughts on how to improve the content!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
