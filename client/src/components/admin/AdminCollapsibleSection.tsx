import { useState } from "react";

interface AdminCollapsibleSectionProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  status?: "ok" | "warn" | "error";
  children: React.ReactNode;
}

export default function AdminCollapsibleSection({ title, summary, defaultOpen = false, status, children }: AdminCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const statusDot = status === "ok" ? "bg-green-500" : status === "warn" ? "bg-yellow-500" : status === "error" ? "bg-red-500" : "";

  return (
    <div className="border-4 border-border bg-card pixel-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[10px] text-foreground/40">{open ? "▼" : "▶"}</span>
          {status && <span className={`w-2 h-2 rounded-full ${statusDot}`} />}
          <span className="font-pixel text-sm">{title}</span>
          {summary && <span className="text-xs text-foreground/40 ml-2" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{summary}</span>}
        </div>
      </button>
      {open && <div className="p-4 pt-0 border-t border-border/30">{children}</div>}
    </div>
  );
}
