import { Link } from "wouter";

export default function About() {
  return (
    <div className="min-h-screen p-8 md:p-16 relative z-10 max-w-4xl mx-auto">
      <div className="mb-12">
        <Link href="/">
          <a className="inline-block font-pixel text-sm hover:text-primary transition-colors mb-8">
            &lt; BACK TO HOME
          </a>
        </Link>
        
        <h1 className="text-4xl md:text-6xl font-pixel leading-tight mb-8 text-shadow-retro">
          About<br />Programming<br />Lightning
        </h1>
      </div>

      <div className="space-y-8 font-mono text-xl md:text-2xl leading-relaxed">
        <div className="bg-card border-4 border-border p-8 pixel-shadow">
          <p className="mb-6">
            Programming Lightning is an interactive educational platform designed to teach developers how to build on the Bitcoin Lightning Network.
          </p>
          <p>
            Our mission is to demystify Layer 2 protocols and empower the next generation of fintech engineers with the skills they need to build the future of payments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-secondary border-4 border-border p-6 pixel-shadow">
            <h2 className="font-pixel text-lg mb-4">Why Lightning?</h2>
            <p>
              Instant payments. Micro-transactions. Scalability. The Lightning Network is the most robust Layer 2 solution for Bitcoin.
            </p>
          </div>
          
          <div className="bg-primary border-4 border-border p-6 pixel-shadow">
            <h2 className="font-pixel text-lg mb-4">What You'll Learn</h2>
            <p>
              Payment channels, HTLCs, routing, liquidity management, and building real-world Lightning applications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
