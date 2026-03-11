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

    // Listen for our custom event (same-tab updates from TxGenerator)
    const handler = () => refresh();
    window.addEventListener("tx-notebook-updated", handler);

    // Listen for cross-tab localStorage changes
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + storageKey) refresh();
    };
    window.addEventListener("storage", storageHandler);

    // Re-read when tab regains focus (catches SPA navigation misses)
    const visHandler = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visHandler);

    // Poll every 2s as fallback while value is null
    const interval = setInterval(() => {
      try {
        const val = localStorage.getItem(STORAGE_PREFIX + storageKey);
        if (val !== null) setValue(val);
      } catch {}
    }, 2000);

    return () => {
      window.removeEventListener("tx-notebook-updated", handler);
      window.removeEventListener("storage", storageHandler);
      document.removeEventListener("visibilitychange", visHandler);
      clearInterval(interval);
    };
  }, [refresh, storageKey]);

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
    <div className={`my-3 border overflow-hidden ${
      dark ? "border-[#2a3552] bg-[#0f1930]" : "border-[#d4c9a8] bg-[#fdf9f2]"
    }`}>
      <div className="flex items-center justify-between px-4 py-2">
        <span className={`text-sm font-bold uppercase ${dark ? "text-slate-300" : "text-black/75"}`}>
          {label}
        </span>
        <button
          onClick={handleCopy}
          className={`text-sm font-semibold px-3 py-1.5 border cursor-pointer transition-opacity hover:opacity-80 ${
            dark ? "border-[#2a3552] text-slate-400" : "border-[#d4c9a8] text-black/50"
          }`}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <div className="px-4 pb-3 overflow-x-auto">
        <code className={`text-base font-mono break-all leading-relaxed ${
          dark ? "text-slate-200" : "text-black/80"
        }`}>
          {value}
        </code>
      </div>
    </div>
  );
}
