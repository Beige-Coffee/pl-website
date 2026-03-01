import { useState, useCallback, useEffect, useRef } from "react";

export interface VLQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface VLQuizProps {
  questions: VLQuizQuestion[];
  onComplete?: () => void;
  onNextSection?: () => void;
}

export function VLQuiz({ questions, onComplete, onNextSection }: VLQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect">("idle");
  const [shakeKey, setShakeKey] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const completedRef = useRef(false);

  const question = questions[currentIndex];

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (status === "correct") return;

      setSelectedIndex(optionIndex);

      if (optionIndex === question.correctIndex) {
        setStatus("correct");
      } else {
        setStatus("incorrect");
        setShakeKey((k) => k + 1);
      }
    },
    [question, status],
  );

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setStatus("idle");
    } else {
      setAllDone(true);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }
  }, [currentIndex, questions.length, onComplete]);

  // Auto-advance after correct answer
  useEffect(() => {
    if (status === "correct") {
      const timer = setTimeout(handleNext, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, handleNext]);

  if (allDone) {
    return (
      <div className="text-center py-8">
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--vl-correct)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 style={{ color: "var(--vl-brown-900)", fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Section Complete
        </h3>
        <p style={{ color: "var(--vl-text-muted)", marginTop: 8 }}>
          You've answered all questions correctly.
        </p>
        {onNextSection && (
          <button
            onClick={onNextSection}
            style={{
              marginTop: 20,
              padding: "12px 28px",
              background: "var(--vl-gold-500)",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "system-ui, -apple-system, sans-serif",
              transition: "background 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--vl-gold-400)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--vl-shadow-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--vl-gold-500)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            Continue to Next Section &rarr;
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--vl-gold-600)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Knowledge Check
        </span>
        <span style={{ fontSize: 12, color: "var(--vl-text-muted)" }}>
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <h3
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--vl-brown-900)",
          marginBottom: 16,
          lineHeight: 1.4,
        }}
      >
        {question.question}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {question.options.map((option, i) => {
          const isSelected = selectedIndex === i;
          const isCorrectOption = i === question.correctIndex;

          let borderColor = "var(--vl-border)";
          let bg = "white";

          if (status === "correct" && isCorrectOption) {
            borderColor = "var(--vl-correct)";
            bg = "#f0fdf4";
          } else if (status === "incorrect" && isSelected) {
            borderColor = "var(--vl-incorrect)";
            bg = "#fef2f2";
          }

          return (
            <button
              key={`${question.id}-${i}-${shakeKey}`}
              onClick={() => handleSelect(i)}
              className={status === "incorrect" && isSelected ? "vl-shake" : ""}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 16px",
                border: `2px solid ${borderColor}`,
                borderRadius: 12,
                background: bg,
                cursor: status === "correct" ? "default" : "pointer",
                transition: "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
                fontSize: "0.95rem",
                color: "var(--vl-text)",
                fontFamily: "system-ui, -apple-system, sans-serif",
                boxShadow: isSelected && status === "idle" ? "var(--vl-shadow)" : "none",
              }}
              onMouseEnter={(e) => {
                if (status !== "correct") {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--vl-gold-400)";
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--vl-gold-50)";
                }
              }}
              onMouseLeave={(e) => {
                if (status !== "correct" && !(status === "incorrect" && isSelected)) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--vl-border)";
                  (e.currentTarget as HTMLButtonElement).style.background = "white";
                }
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {status === "incorrect" && (
        <p style={{ color: "var(--vl-incorrect)", fontSize: "0.9rem", marginTop: 8 }}>
          Not quite. Try again!
        </p>
      )}

      {status === "correct" && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              padding: "12px 16px",
            }}
          >
            <p style={{ color: "var(--vl-correct)", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
              Correct!
            </p>
            <p style={{ color: "var(--vl-text)", fontSize: "0.9rem", margin: "4px 0 0 0" }}>
              {question.explanation}
            </p>
          </div>
          <button
            onClick={handleNext}
            style={{
              marginTop: 12,
              padding: "8px 20px",
              background: "var(--vl-gold-500)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {currentIndex < questions.length - 1 ? "Next" : "Finish"}
          </button>
        </div>
      )}
    </div>
  );
}
