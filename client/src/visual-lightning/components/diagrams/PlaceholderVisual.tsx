interface PlaceholderVisualProps {
  sectionNumber: string;
  sectionTitle: string;
}

export function PlaceholderVisual({ sectionNumber, sectionTitle }: PlaceholderVisualProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "40px 20px",
      }}
    >
      {/* Golden circle with section number */}
      <div
        className="vl-placeholder-glow"
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--vl-gold-100), var(--vl-gold-200))",
          border: "2px solid var(--vl-gold-400)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--vl-gold-600)",
            lineHeight: 1,
          }}
        >
          {sectionNumber}
        </span>
      </div>

      {/* Section title */}
      <div
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--vl-brown-900)",
          textAlign: "center",
          maxWidth: 240,
        }}
      >
        {sectionTitle}
      </div>

      {/* Coming soon */}
      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--vl-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Coming Soon
      </div>
    </div>
  );
}
