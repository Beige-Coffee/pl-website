import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePanelState } from "../hooks/use-panel-state";
import { useIsMobile } from "../hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TxNotebookProps {
  theme: "light" | "dark";
}

// ─── Data ────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    key: "funding",
    fields: [
      { key: "funding-txid", label: "Funding Tx ID" },
      { key: "funding-txhex", label: "Funding Tx Hex" },
    ],
  },
  {
    key: "commitment-refund",
    fields: [
      { key: "commitment-refund-txid", label: "Commitment Tx (Refund) ID" },
      { key: "commitment-refund-txhex", label: "Commitment Tx (Refund) Hex" },
    ],
  },
  {
    key: "commitment-htlc",
    fields: [
      { key: "commitment-htlc-txid", label: "Commitment Tx (With HTLC) ID" },
      { key: "commitment-htlc-txhex", label: "Commitment Tx (With HTLC) Hex" },
    ],
  },
  {
    key: "htlc-timeout",
    fields: [
      { key: "htlc-timeout-txid", label: "HTLC Timeout Tx ID" },
      { key: "htlc-timeout-txhex", label: "HTLC Timeout Tx Hex" },
    ],
  },
] as const;

type FieldKey =
  | "funding-txid"
  | "funding-txhex"
  | "commitment-refund-txid"
  | "commitment-refund-txhex"
  | "commitment-htlc-txid"
  | "commitment-htlc-txhex"
  | "htlc-timeout-txid"
  | "htlc-timeout-txhex";

const STORAGE_PREFIX = "pl-txnotebook-";

function loadAll(): Record<FieldKey, string> {
  const out = {} as Record<FieldKey, string>;
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      try {
        out[field.key] = localStorage.getItem(STORAGE_PREFIX + field.key) ?? "";
      } catch {
        out[field.key] = "";
      }
    }
  }
  return out;
}

const sansFont = {
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 300;

// ─── Component ───────────────────────────────────────────────────────────────

export default function TxNotebook({ theme }: TxNotebookProps) {
  const dark = theme === "dark";
  const isMobile = useIsMobile();
  const panel = usePanelState();
  const [isOpenRaw, setIsOpenRaw] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>(loadAll);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const isOpen = isOpenRaw;
  const setIsOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsOpenRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (!next && prev) {
        panel.closePanel("notebook");
      }
      return next;
    });
  }, [panel]);

  // Persist changes to localStorage
  function handleChange(key: FieldKey, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
    try { localStorage.setItem(STORAGE_PREFIX + key, val); } catch {}
  }

  // Drag-to-resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(startWidthRef.current + delta, window.innerWidth * 0.75));
      setWidth(newWidth);
      panel.resizePanel(newWidth);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        panel.stopDragging();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panel]);

  // Refresh when a TxGenerator saves new values
  useEffect(() => {
    const refresh = () => setValues(loadAll());
    window.addEventListener("tx-notebook-updated", refresh);
    return () => window.removeEventListener("tx-notebook-updated", refresh);
  }, []);

  // Sync with panel context when open or width changes
  useEffect(() => {
    if (isOpen) {
      panel.openPanel("notebook", width);
    }
  }, [isOpen, width]);

  // Close if another panel takes over
  useEffect(() => {
    if (isOpen && panel.activePanel !== null && panel.activePanel !== "notebook") {
      setIsOpenRaw(false);
    }
  }, [isOpen, panel.activePanel]);

  // ── Theme ────────────────────────────────────────────────────────────────
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const panelBg = dark ? "bg-[#0a0f1a]" : "bg-[#fdf9f2]";
  const panelBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const headerBg = dark ? "bg-[#0b1220]" : "bg-[#f5f0e8]";
  const labelColor = dark ? "text-slate-300" : "text-black/75";
  const inputBg = dark ? "bg-[#0f1930]" : "bg-white";
  const inputBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const inputText = dark ? "text-slate-200" : "text-black/80";
  const dividerColor = dark ? "border-[#1e2d4a]" : "border-[#e8dcc8]";

  // Listen for open event from Tools menu
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("tx-notebook-open", handler);
    return () => window.removeEventListener("tx-notebook-open", handler);
  }, []);

  if (!isOpen) {
    return null;
  }

  // ── Shared body content ────────────────────────────────────────────────

  const bodyContent = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0" style={sansFont}>
      {SECTIONS.map((section, sIdx) => (
        <div key={section.key}>
          {section.fields.map((field) => (
            <div key={field.key} className="mb-3">
              <label className={`block text-sm font-semibold mb-1 ${labelColor}`}>
                {field.label}:
              </label>
              <textarea
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                rows={field.key.endsWith("-txhex") ? 3 : 2}
                spellCheck={false}
                placeholder={field.key.endsWith("-txhex") ? "Paste hex here..." : "Paste ID here..."}
                style={{ ...sansFont, ...(isMobile ? { fontSize: "16px" } : {}) }}
                className={`w-full text-sm resize-none border ${inputBorder} ${inputBg} ${inputText} px-2.5 py-2 focus:outline-none focus:ring-1 ${
                  dark ? "focus:ring-[#FFD700]/30 placeholder:text-slate-600" : "focus:ring-[#b8860b]/30 placeholder:text-black/25"
                }`}
              />
            </div>
          ))}
          {sIdx < SECTIONS.length - 1 && (
            <hr className={`my-4 border-t ${dividerColor}`} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Mobile: Drawer ─────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
        <DrawerContent className={`max-h-[85dvh] flex flex-col ${panelBg}`} data-testid="drawer-tx-notebook">
          <DrawerTitle className={`font-pixel text-xs ${goldText} px-4 pt-2`}>TRANSACTIONS</DrawerTitle>
          {bodyContent}
        </DrawerContent>
      </Drawer>
    );
  }

  // ── Desktop: Fixed side panel ──────────────────────────────────────────

  return (
    <div
      className={`fixed top-[68px] right-0 h-[calc(100vh-68px)] z-40 hidden lg:flex border-l-2 ${panelBorder} ${panelBg} shadow-2xl`}
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        className={`absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#FFD700]/30 transition-colors`}
        onMouseDown={(e) => {
          draggingRef.current = true;
          startXRef.current = e.clientX;
          startWidthRef.current = width;
          panel.startDragging();
          e.preventDefault();
        }}
      />

      <div className="flex flex-col w-full min-h-0">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b-2 ${panelBorder} ${headerBg} shrink-0`}>
          <div className={`font-pixel text-xs ${goldText}`}>TRANSACTIONS</div>
          <button
            onClick={() => setIsOpen(false)}
            className={`font-pixel text-[10px] px-2.5 py-1 border transition-all cursor-pointer ${
              dark
                ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                : "border-[#d4c9a8] text-black/50 hover:text-black hover:bg-[#e8dcc8]"
            }`}
          >
            CLOSE
          </button>
        </div>

        {bodyContent}
      </div>
    </div>
  );
}
