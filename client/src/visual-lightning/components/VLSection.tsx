import type { VLContentBlock } from "../data/vl-sections";
import { VLQuiz } from "./VLQuiz";

interface VLSectionProps {
  content: VLContentBlock[];
  onQuizComplete?: () => void;
  onNextSection?: () => void;
}

export function VLSection({ content, onQuizComplete, onNextSection }: VLSectionProps) {
  if (content.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {content.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <h1>{block.text}</h1>
                {block.subtitle && (
                  <p
                    style={{
                      color: "var(--vl-text-muted)",
                      fontSize: "1.1rem",
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {block.subtitle}
                  </p>
                )}
              </div>
            );

          case "text":
            return (
              <div
                key={i}
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.8,
                  color: "var(--vl-text)",
                }}
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            );

          case "callout": {
            const variantIcon =
              block.variant === "warning"
                ? "!!"
                : block.variant === "key-concept"
                  ? "\u2728"
                  : "\u2139\uFE0F";
            return (
              <div key={i} className="vl-callout">
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "var(--vl-gold-600)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {variantIcon} {block.title}
                </div>
                <div style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "var(--vl-text)" }}>
                  {block.body}
                </div>
              </div>
            );
          }

          case "quiz":
            return (
              <div
                key={i}
                style={{
                  marginTop: 16,
                  paddingTop: 24,
                  borderTop: "1px solid var(--vl-border)",
                }}
              >
                <VLQuiz questions={block.questions} onComplete={onQuizComplete} onNextSection={onNextSection} />
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
