import { Link } from "wouter";
import { FundingChannelDiagram } from "../visual-lightning/components/diagrams/FundingChannelDiagram";

const RESOURCES = [
  {
    id: "lightning-tldr",
    title: "Lightning TLDR",
    description:
      "A visual, interactive walkthrough of how Lightning payment channels work. No code required.",
    href: "/visual-lightning",
    thumbnail: "funding-diagram",
  },
];

function FundingThumbnail() {
  return (
    <div
      className="w-full overflow-hidden pointer-events-none select-none"
      style={{ height: 180 }}
    >
      <div
        style={{
          transform: "scale(0.38)",
          transformOrigin: "top left",
          width: "263%",
          height: "263%",
        }}
      >
        <FundingChannelDiagram />
      </div>
    </div>
  );
}

export default function Learn() {
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

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-10 text-center">
          <h1 className="text-2xl md:text-4xl font-pixel leading-tight text-shadow-retro">
            Learn
          </h1>
          <p
            className="text-lg md:text-xl text-foreground/70 mt-3"
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
          >
            Articles and resources to deepen your understanding.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {RESOURCES.map((resource) => (
            <Link key={resource.id} href={resource.href}>
              <a className="block bg-card border-4 border-border pixel-shadow hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_rgba(0,0,0,0.3)] transition-all group">
                {/* Thumbnail */}
                <div className="border-b-4 border-border bg-[#faf6ee] overflow-hidden">
                  {resource.thumbnail === "funding-diagram" && (
                    <FundingThumbnail />
                  )}
                </div>

                {/* Text */}
                <div className="p-4">
                  <h2 className="font-pixel text-base md:text-lg group-hover:text-primary transition-colors">
                    {resource.title}
                  </h2>
                  <p
                    className="text-sm md:text-base text-foreground/70 mt-2 leading-relaxed"
                    style={{
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    }}
                  >
                    {resource.description}
                  </p>
                </div>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
