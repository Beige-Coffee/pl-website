import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "pl-txnotebook-";

interface NotebookRefProps {
  storageKey: string;
  label: string;
  theme: "light" | "dark";
}

export default function NotebookRef({ storageKey, label, theme }: NotebookRefProps) {
  const dark = theme === "dark";
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    try {
      setValue(localStorage.getItem(STORAGE_PREFIX + storageKey));
    } catch {
      setValue(null);
    }
  }, [storageKey]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("tx-notebook-updated", handler);
    return () => window.removeEventListener("tx-notebook-updated", handler);
  }, [refresh]);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  if (!value) {
    return (
      <div className={`my-3 px-4 py-3 border rounded text-sm ${
        dark ? "border-yellow-800/50 bg-yellow-950/20 text-yellow-200/70" : "border-yellow-300 bg-yellow-50 text-yellow-800"
      }`}>
        Not yet generated. Complete the <strong>{label}</strong> section first.
      </div>
    );
  }

  return (
    <div className={`my-3 border rounded overflow-hidden ${
      dark ? "border-[#2a3552] bg-[#0f1930]" : "border-[#d4c9a8] bg-[#f8f5ee]"
    }`}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className={`text-[10px] font-semibold uppercase ${dark ? "text-slate-400" : "text-black/50"}`}>
          {label}
        </span>
        <button
          onClick={handleCopy}
          className={`font-pixel text-[9px] px-2 py-0.5 border cursor-pointer transition-opacity hover:opacity-80 ${
            dark ? "border-[#2a3552] text-slate-400" : "border-[#d4c9a8] text-black/50"
          }`}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <div className="px-3 pb-2 overflow-x-auto">
        <code className={`text-[11px] font-mono break-all leading-relaxed ${
          dark ? "text-emerald-300" : "text-emerald-800"
        }`}>
          {value}
        </code>
      </div>
    </div>
  );
}
