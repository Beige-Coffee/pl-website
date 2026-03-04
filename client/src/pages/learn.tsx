import { Link } from "wouter";

const RESOURCES = [
  {
    id: "lightning-tldr",
    title: "Lightning TLDR",
    description:
      "Simple, yet elegant. Technical, yet approachable. The whole Lightning protocol, visual and interactive.",
    href: "/visual-lightning",
    thumbnail: "network",
  },
];

function NetworkThumbnail() {
  const W = 400;
  const H = 240;

  const nodes = [
    { id: "A", x: 50, y: 130, r: 22, color: "#2563eb", label: "Sender" },
    { id: "B", x: 140, y: 50, r: 18, color: "#9a8b78" },
    { id: "C", x: 200, y: 140, r: 20, color: "#b8860b" },
    { id: "D", x: 160, y: 210, r: 16, color: "#9a8b78" },
    { id: "E", x: 290, y: 120, r: 20, color: "#b8860b" },
    { id: "F", x: 320, y: 48, r: 16, color: "#9a8b78" },
    { id: "G", x: 370, y: 150, r: 20, color: "#7c3aed", label: "Receiver" },
  ];

  const edges = [
    ["A", "B"], ["A", "C"], ["A", "D"],
    ["B", "C"], ["B", "E"],
    ["C", "D"], ["C", "E"],
    ["D", "E"],
    ["E", "F"], ["E", "G"],
    ["F", "G"],
  ];

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none select-none bg-[#faf6ee]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", maxHeight: 240 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodeMap[a].x} y1={nodeMap[a].y}
            x2={nodeMap[b].x} y2={nodeMap[b].y}
            stroke="#d4c5a9" strokeWidth="1.2"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill={`${n.color}12`} stroke={n.color} strokeWidth="2.5"
            />
            <text
              x={n.x} y={n.y + 5}
              textAnchor="middle" fontSize="13" fontWeight="700"
              fill={n.color}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {n.id}
            </text>
            {n.label && (
              <text
                x={n.x} y={n.y + n.r + 14}
                textAnchor="middle" fontSize="9" fontWeight="600"
                fill={n.color}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {n.label}
              </text>
            )}
          </g>
        ))}
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
                <div className="sm:w-[45%] md:w-[40%] flex-shrink-0 border-b-4 sm:border-b-0 sm:border-r-4 border-border bg-[#faf6ee] overflow-hidden">
                  {resource.thumbnail === "network" && (
                    <NetworkThumbnail />
                  )}
                </div>

                {/* Text — right side, vertically centered */}
                <div className="p-6 md:p-8 flex flex-col justify-center min-h-0">
                  <h2 className="font-pixel text-lg md:text-xl group-hover:text-primary transition-colors">
                    {resource.title}
                  </h2>
                  <p
                    className="text-sm md:text-base text-foreground/70 mt-3 leading-relaxed"
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
