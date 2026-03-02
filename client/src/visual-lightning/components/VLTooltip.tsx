interface VLTooltipProps {
  title: string;
  description: string;
  x: number;
  y: number;
}

/** Split description into prose + optional script block. */
function parseDescription(desc: string): { prose: string; scriptTitle: string; scriptLines: string[] } | { prose: string } {
  const marker = /\n\n(witnessScript|Witness Script|Spend requires):/i;
  const match = desc.match(marker);
  if (!match || match.index === undefined) return { prose: desc };

  const prose = desc.slice(0, match.index).trimEnd();
  const scriptBlock = desc.slice(match.index).trim();
  // First line is the header (e.g. "witnessScript:"), rest are code
  const lines = scriptBlock.split("\n");
  const scriptTitle = lines[0].replace(/:$/, "");
  const scriptLines = lines.slice(1).map((l) => l.replace(/^  /, ""));
  return { prose, scriptTitle, scriptLines };
}

export function VLTooltip({ title, description, x, y }: VLTooltipProps) {
  const parsed = parseDescription(description);
  const hasScript = "scriptLines" in parsed;

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: x,
        top: y - 12,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(184, 134, 11, 0.15)",
          borderTop: "3px solid #b8860b",
          minWidth: 220,
          maxWidth: 340,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 14px" }}>
          {/* Title */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#2a1f0d",
              marginBottom: 4,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {title}
          </div>
          {/* Prose */}
          <div
            style={{
              fontSize: 13,
              color: "#6b5d4f",
              lineHeight: 1.5,
              whiteSpace: "pre-line",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {parsed.prose}
          </div>
        </div>

        {/* Script code block */}
        {hasScript && parsed.scriptLines.length > 0 && (
          <div
            style={{
              margin: "0 10px 10px",
              padding: "8px 12px",
              background: "#fefdfb",
              border: "1px solid #e8dcc8",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#2a1f0d",
                marginBottom: 6,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {parsed.scriptTitle}
            </div>
            <div
              style={{
                borderTop: "1px solid #e8dcc8",
                paddingTop: 6,
              }}
            >
              {parsed.scriptLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.6,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    color: "#b8860b",
                    whiteSpace: "pre",
                  }}
                >
                  {line || "\u00A0"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
