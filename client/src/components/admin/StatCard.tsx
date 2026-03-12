interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { delta: number; label: string; direction: "up" | "down" };
  status?: "green" | "yellow" | "red";
}

const cardClass = "border-4 border-border bg-card p-4 pixel-shadow";

export default function StatCard({ label, value, trend, status }: StatCardProps) {
  const statusColor = status === "green" ? "text-green-600" : status === "yellow" ? "text-yellow-600" : status === "red" ? "text-red-500" : "";

  return (
    <div className={cardClass}>
      <div className="font-pixel text-[10px] text-foreground/60 mb-2">{label}</div>
      <div className={`font-pixel text-lg ${statusColor}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      {trend && (
        <div className={`text-[11px] mt-1 ${trend.direction === "up" ? "text-green-600" : "text-red-500"}`}
          style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          {trend.direction === "up" ? "+" : ""}{trend.delta} {trend.label}
        </div>
      )}
    </div>
  );
}
