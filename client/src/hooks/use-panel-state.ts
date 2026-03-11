import { createContext, useContext, useCallback, useState, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PanelId = "node" | "notebook" | "scratchpad";

export interface PanelState {
  activePanel: PanelId | null;
  panelWidth: number;
  isDragging: boolean;
}

export interface PanelActions {
  openPanel: (id: PanelId, width: number) => void;
  closePanel: (id: PanelId) => void;
  resizePanel: (width: number) => void;
  startDragging: () => void;
  stopDragging: () => void;
  /** Switch to a panel, dispatching the appropriate open event */
  switchPanel: (id: PanelId) => void;
}

const defaultState: PanelState & PanelActions = {
  activePanel: null,
  panelWidth: 0,
  isDragging: false,
  openPanel: () => {},
  closePanel: () => {},
  resizePanel: () => {},
  startDragging: () => {},
  stopDragging: () => {},
  switchPanel: () => {},
};

// ─── Context ─────────────────────────────────────────────────────────────────

export const PanelStateContext = createContext<PanelState & PanelActions>(defaultState);

export function usePanelState() {
  return useContext(PanelStateContext);
}

// ─── Provider hook (used by PanelStateProvider in lightning-tutorial.tsx) ────

const PANEL_EVENTS: Record<PanelId, string> = {
  node: "node-terminal-open",
  notebook: "tx-notebook-open",
  scratchpad: "scratchpad-open",
};

const SHARED_WIDTH_KEY = "pl-panel-width";
const DEFAULT_SHARED_WIDTH = 450;

function loadSharedWidth(): number {
  try {
    const stored = localStorage.getItem(SHARED_WIDTH_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (n >= 300 && n <= 2000) return n;
    }
  } catch {}
  return DEFAULT_SHARED_WIDTH;
}

export function usePanelStateProvider(): PanelState & PanelActions {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const activePanelRef = useRef<PanelId | null>(null);

  const openPanel = useCallback((id: PanelId, _width: number) => {
    activePanelRef.current = id;
    setActivePanel(id);
    setPanelWidth(loadSharedWidth());
  }, []);

  const closePanel = useCallback((id: PanelId) => {
    setActivePanel((current) => {
      if (current === id) {
        activePanelRef.current = null;
        setPanelWidth(0);
        return null;
      }
      return current;
    });
  }, []);

  const resizePanel = useCallback((width: number) => {
    setPanelWidth(width);
    try { localStorage.setItem(SHARED_WIDTH_KEY, String(width)); } catch {}
  }, []);

  const startDragging = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  const switchPanel = useCallback((id: PanelId) => {
    const current = activePanelRef.current;
    if (current === id) {
      // Already showing this panel — do nothing
      return;
    }
    // Set activePanel to the new panel BEFORE dispatching the open event.
    // This prevents the new panel's close-on-takeover effect from seeing a
    // stale activePanel value and immediately closing itself.
    activePanelRef.current = id;
    setActivePanel(id);
    // Now dispatch the open event — the new panel will set isOpen=true and
    // the old panel's close-on-takeover will detect the change and close.
    window.dispatchEvent(new CustomEvent(PANEL_EVENTS[id]));
  }, []);

  return {
    activePanel,
    panelWidth,
    isDragging,
    openPanel,
    closePanel,
    resizePanel,
    startDragging,
    stopDragging,
    switchPanel,
  };
}
