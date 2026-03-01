interface VLStepAnimationProps {
  steps: Array<{ label: string }>;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function VLStepAnimation({ steps, currentStep, onStepChange }: VLStepAnimationProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 0 4px",
      }}
    >
      {/* Back button */}
      <button
        onClick={() => onStepChange(Math.max(0, currentStep - 1))}
        disabled={currentStep === 0}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1.5px solid var(--vl-border)",
          background: currentStep === 0 ? "transparent" : "white",
          cursor: currentStep === 0 ? "default" : "pointer",
          opacity: currentStep === 0 ? 0.3 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          color: "var(--vl-text-muted)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        aria-label="Previous step"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Step dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {/* Connecting line before dot (except first) */}
              {i > 0 && (
                <div
                  style={{
                    width: 24,
                    height: 2,
                    background: isCompleted || isActive ? "var(--vl-gold-400)" : "var(--vl-border)",
                    transition: "background 0.3s ease",
                  }}
                />
              )}
              {/* Dot */}
              <button
                onClick={() => onStepChange(i)}
                title={step.label}
                style={{
                  width: isActive ? 14 : 10,
                  height: isActive ? 14 : 10,
                  borderRadius: "50%",
                  border: `2px solid ${isActive ? "var(--vl-gold-500)" : isCompleted ? "var(--vl-gold-400)" : "var(--vl-border)"}`,
                  background: isActive
                    ? "var(--vl-gold-500)"
                    : isCompleted
                      ? "var(--vl-gold-400)"
                      : "white",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: isActive ? "0 0 8px rgba(184, 134, 11, 0.4)" : "none",
                  padding: 0,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
                aria-label={step.label}
              />
            </div>
          );
        })}
      </div>

      {/* Forward button */}
      <button
        onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}
        disabled={currentStep === steps.length - 1}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "1.5px solid var(--vl-border)",
          background: currentStep === steps.length - 1 ? "transparent" : "white",
          cursor: currentStep === steps.length - 1 ? "default" : "pointer",
          opacity: currentStep === steps.length - 1 ? 0.3 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          color: "var(--vl-text-muted)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        aria-label="Next step"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
