import { Link } from "wouter";

const RESOURCES = [
  {
    id: "lightning-tldr",
    title: "Lightning TLDR",
    description:
      "Simple, yet elegant. Technical, yet approachable. The whole Lightning protocol, visual and interactive.",
    href: "/visual-lightning",
    thumbnail: "messages",
  },
];

function MessagesThumbnail() {
  const W = 380;
  const H = 248;
  const mono = "'JetBrains Mono', 'Fira Code', Consolas, monospace";
  const sans = "system-ui, -apple-system, sans-serif";
  const GOLD = "#b8860b";
  const BORDER = "#e8dcc8";
  const TEXT = "#2a1f0d";
  const MUTED = "#6b5d4f";
  const BLUE = "#2563eb";
  const ORANGE = "#ea580c";

  const cardW = 240;
  const cardX = (W - cardW) / 2;

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none select-none bg-white">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Arrow: commitment_signed → */}
        <line x1={cardX + 20} y1={24} x2={cardX + cardW - 20} y2={24}
          stroke={BLUE} strokeWidth="2.5" opacity="0.6" />
        <polygon points={`${cardX + cardW - 20},20 ${cardX + cardW - 10},24 ${cardX + cardW - 20},28`}
          fill={BLUE} opacity="0.6" />

        {/* commitment_signed label */}
        <rect x={cardX + 50} y={12} width={140} height={22} rx={4}
          fill="white" stroke={BORDER} strokeWidth="1" />
        <text x={cardX + 120} y={27} textAnchor="middle" fontSize="10"
          fontFamily={mono} fontStyle="italic" fill={MUTED}>
          commitment_signed
        </text>

        {/* Arrow: ← revoke_and_ack */}
        <line x1={cardX + cardW - 20} y1={50} x2={cardX + 20} y2={50}
          stroke={ORANGE} strokeWidth="2.5" />
        <polygon points={`${cardX + 20},46 ${cardX + 10},50 ${cardX + 20},54`}
          fill={ORANGE} />

        {/* revoke_and_ack card */}
        <rect x={cardX} y={66} width={cardW} height={100} rx={8}
          fill="white" stroke={GOLD} strokeWidth="1.5" />
        {/* Header band */}
        <rect x={cardX} y={66} width={cardW} height={26} rx={8}
          fill="#fdf8e8" />
        <rect x={cardX} y={84} width={cardW} height={8}
          fill="#fdf8e8" />
        <line x1={cardX + 8} y1={92} x2={cardX + cardW - 8} y2={92}
          stroke={BORDER} strokeWidth="0.75" />
        <text x={cardX + 14} y={84} fontSize="12" fontWeight="700"
          fontFamily={mono} fill={ORANGE}>
          revoke_and_ack
        </text>

        {/* Fields */}
        <text x={cardX + 14} y={110} fontSize="10" fontFamily={mono} fill={MUTED}>channel_id:</text>
        <text x={cardX + cardW - 14} y={110} fontSize="10" fontWeight="600" fontFamily={mono} fill={TEXT} textAnchor="end">AliceBob1</text>

        <text x={cardX + 14} y={128} fontSize="10" fontFamily={mono} fill={MUTED}>per_commitment_secret:</text>
        <text x={cardX + cardW - 14} y={128} fontSize="10" fontWeight="600" fontFamily={mono} fill={ORANGE} textAnchor="end">bob_secret_1</text>

        <text x={cardX + 14} y={146} fontSize="10" fontFamily={mono} fill={MUTED}>next_per_commitment_point:</text>
        <text x={cardX + cardW - 14} y={146} fontSize="10" fontWeight="600" fontFamily={mono} fill={GOLD} textAnchor="end">bob_point_3</text>

      </svg>
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

        <div className="flex flex-col gap-6">
          {RESOURCES.map((resource) => (
            <Link key={resource.id} href={resource.href}>
              <a className="flex flex-col sm:flex-row sm:h-[248px] bg-card border-4 border-border pixel-shadow hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_rgba(0,0,0,0.3)] transition-all group overflow-hidden">
                {/* Thumbnail — left side */}
                <div className="sm:w-[45%] md:w-[40%] flex-shrink-0 border-b-4 sm:border-b-0 sm:border-r-4 border-border bg-white overflow-hidden">
                  {resource.thumbnail === "messages" && (
                    <MessagesThumbnail />
                  )}
                </div>

                {/* Text — right side, vertically centered */}
                <div className="p-6 md:p-8 flex flex-col justify-center min-h-0">
                  <h2 className="font-pixel text-xl md:text-2xl group-hover:text-primary transition-colors">
                    {resource.title}
                  </h2>
                  <p
                    className="text-base md:text-lg text-foreground/70 mt-3 leading-relaxed"
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
