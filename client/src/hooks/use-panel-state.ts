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
};

// ─── Context ─────────────────────────────────────────────────────────────────

export const PanelStateContext = createContext<PanelState & PanelActions>(defaultState);

export function usePanelState() {
  return useContext(PanelStateContext);
}

// ─── Provider hook (used by PanelStateProvider in lightning-tutorial.tsx) ────

export function usePanelStateProvider(): PanelState & PanelActions {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const openPanel = useCallback((id: PanelId, width: number) => {
    setActivePanel(id);
    setPanelWidth(width);
  }, []);

  const closePanel = useCallback((id: PanelId) => {
    setActivePanel((current) => (current === id ? null : current));
    // Don't reset width — let it persist for reopening
  }, []);

  const resizePanel = useCallback((width: number) => {
    setPanelWidth(width);
  }, []);

  const startDragging = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
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
  };
}
