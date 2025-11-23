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
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
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
  );
}
