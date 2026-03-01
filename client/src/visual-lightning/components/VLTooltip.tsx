interface VLTooltipProps {
  title: string;
  description: string;
  x: number;
  y: number;
}

export function VLTooltip({ title, description, x, y }: VLTooltipProps) {
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
          <div
            style={{
              fontSize: 13,
              color: "#6b5d4f",
              lineHeight: 1.5,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}
