import { Link } from "wouter";

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

      <div className="flex-1 w-full max-w-4xl mx-auto p-8 md:p-12">
        <div className="mb-8 flex flex-col items-center justify-center">
          <h1 className="text-xl md:text-3xl font-pixel leading-tight text-center text-shadow-retro">
            About Programming Lightning
          </h1>
        </div>

        <div className="space-y-8 font-mono text-xl md:text-2xl leading-relaxed">
          <div className="bg-card border-4 border-border p-8 pixel-shadow">
            <p className="mb-6">
              Hi, my name is Austin, and I'm a <a href="https://spiral.xyz/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Spiral</a> and <a href="https://hrf.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">HRF</a> grantee working on Programming Lightning.
            </p>
            <p className="mb-6">
              Inspired by <a href="https://github.com/jimmysong/programmingbitcoin" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Programming Bitcoin</a>, Programming Lightning is a free and open source educational resource that teaches developers how Lightning works by implementing crucial parts of the protocol scratch.
            </p>
            <p className="mb-6">
              In the first course, Intro to Payment Channels, we implement a Lightning payment channel from scratch. In fact, once complete, your implementation will pass many of the Test Vectors provided in <a href="https://github.com/lightning/bolts/blob/master/03-transactions.md#appendix-b-funding-transaction-test-vectors" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">BOLT 3</a>, putting you in a great position to start contributing to popular Lightning implementations such as LDK. During this course, you’ll learn exactly how Lightning payment channels are constructed, how Hash-Time-Locked-Contracts (HTLCs) work, and how to build an off-chain Lightning wallet to manage all of the cryptographic material needed.
            </p>
            <p className="mb-6">
              This project is currently in active development. The first module on payment channels is now available, with additional sections coming soon.
            </p>
            <p>
              Check back for new releases!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-secondary border-4 border-border p-6 pixel-shadow">
              <h2 className="font-pixel text-lg mb-4">Why Lightning?</h2>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
              </p>
            </div>
            
            <div className="bg-primary border-4 border-border p-6 pixel-shadow">
              <h2 className="font-pixel text-lg mb-4">What You'll Learn</h2>
              <p>
                Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
