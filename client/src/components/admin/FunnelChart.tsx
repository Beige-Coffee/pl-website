const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

interface FunnelChartProps {
  title: string;
  items: { label: string; count: number }[];
  total: number;
  color?: "gold" | "red";
}

export default function FunnelChart({ title, items, total, color = "gold" }: FunnelChartProps) {
  const barColor = color === "gold" ? "bg-[#FFD700]/60" : "bg-red-400/50";

  return (
    <div className="border-4 border-border bg-card p-4 pixel-shadow">
      <div className="font-pixel text-[10px] mb-2">{title}</div>
      <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
        {items.map((item) => {
          const pct = total > 0 ? Math.round(item.count / total * 100) : 0;
          const barWidth = color === "red" ? Math.max(pct, 3) : pct;
          return (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-20 text-xs text-foreground/60 shrink-0">{item.label}</div>
              <div className="flex-1 h-5 bg-border/20 relative overflow-hidden border border-border/30">
                <div className={`h-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold">{item.count} ({pct}%)</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
