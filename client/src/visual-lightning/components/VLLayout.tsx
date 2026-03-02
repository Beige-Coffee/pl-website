import { useEffect, useCallback, useState, useRef } from "react";
import { Link } from "wouter";
import { VL_SECTIONS } from "../data/vl-sections";
import type { VLVisualDef } from "../data/vl-sections";
import { TransactionDiagram } from "./diagrams/TransactionDiagram";
import { ScalingDiagram } from "./diagrams/ScalingDiagram";
import { FundingChannelDiagram } from "./diagrams/FundingChannelDiagram";
import { NaivePaymentDiagram } from "./diagrams/NaivePaymentDiagram";
import { CommitmentPairDiagram } from "./diagrams/CommitmentPairDiagram";
import { CheatingDiagram } from "./diagrams/CheatingDiagram";
import { RevocationDiagram } from "./diagrams/RevocationDiagram";
import { StateUpdateDiagram } from "./diagrams/StateUpdateDiagram";
import { HTLCDiagram } from "./diagrams/HTLCDiagram";
import { ClosingDiagram } from "./diagrams/ClosingDiagram";
import { HTLCSettleDiagram } from "./diagrams/HTLCSettleDiagram";
import { HTLCUpdateDiagram } from "./diagrams/HTLCUpdateDiagram";
import { NetworkDiagram } from "./diagrams/NetworkDiagram";
import { PlaceholderVisual } from "./diagrams/PlaceholderVisual";
import { SIMPLE_TX, FUNDING_TX } from "../data/vl-diagram-data";
import type { TxDiagramData } from "../data/vl-diagram-data";

const DIAGRAM_DATA: Record<string, TxDiagramData> = {
  SIMPLE_TX,
  FUNDING_TX,
};

const ACTIVE_SECTIONS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);

interface VLLayoutProps {
  currentSectionId: string;
  completedSections: string[];
  onNavigate: (sectionId: string) => void;
  children: React.ReactNode;
}

function renderVisual(
  visual: VLVisualDef,
  sectionId: string,
  sectionTitle: string,
) {
  switch (visual.component) {
    case "TransactionDiagram": {
      const data = visual.data ? DIAGRAM_DATA[visual.data] : undefined;
      if (!data) return null;
      return <TransactionDiagram data={data} />;
    }
    case "ScalingDiagram":
      return <ScalingDiagram />;
    case "FundingChannelDiagram":
      return <FundingChannelDiagram />;
    case "NaivePaymentDiagram":
      return <NaivePaymentDiagram />;
    case "CommitmentPairDiagram":
      return <CommitmentPairDiagram />;
    case "CheatingDiagram":
      return <CheatingDiagram />;
    case "RevocationDiagram":
      return <RevocationDiagram />;
    case "StateUpdateDiagram":
      return <StateUpdateDiagram />;
    case "HTLCDiagram":
      return <HTLCDiagram />;
    case "ClosingDiagram":
      return <ClosingDiagram />;
    case "HTLCSettleDiagram":
      return <HTLCSettleDiagram />;
    case "HTLCUpdateDiagram":
      return <HTLCUpdateDiagram />;
    case "NetworkDiagram":
      return <NetworkDiagram />;
    case "PlaceholderVisual":
      return (
        <PlaceholderVisual sectionNumber={sectionId} sectionTitle={sectionTitle} />
      );
    default:
      return null;
  }
}

export function VLLayout({
  currentSectionId,
  completedSections,
  onNavigate,
  children,
}: VLLayoutProps) {
  const currentSection = VL_SECTIONS.find((s) => s.id === currentSectionId) || VL_SECTIONS[0];
  // TODO: Re-enable completion gating when ready
  const canNavigate = useCallback(
    (sectionId: string) => ACTIVE_SECTIONS.has(sectionId),
    [],
  );

  // Mobile detection (matches CSS breakpoint)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Resizable split panel
  const [splitPct, setSplitPct] = useState(45);
  const dragging = useRef(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(Math.max(pct, 25), 70));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const currentIndex = VL_SECTIONS.findIndex(
          (s) => s.id === currentSectionId,
        );
        const delta = e.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = currentIndex + delta;
        if (nextIndex >= 0 && nextIndex < VL_SECTIONS.length) {
          const nextSection = VL_SECTIONS[nextIndex];
          if (canNavigate(nextSection.id)) {
            onNavigate(nextSection.id);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentSectionId, canNavigate, onNavigate]);

  // ── Mobile dial effect ──
  const bezelRef = useRef<HTMLDivElement>(null);
  const isInitialScrollRef = useRef(true);

  // Scroll listener: scale + fade ticks based on distance from viewport center
  useEffect(() => {
    if (!isMobile || !bezelRef.current) return;
    const bezel = bezelRef.current;
    let rafId: number;

    const updateDial = () => {
      const bezelRect = bezel.getBoundingClientRect();
      if (bezelRect.width === 0) return;
      const centerX = bezelRect.width / 2;
      const fadeZone = bezelRect.width * 0.38;

      bezel.querySelectorAll(".vl-bezel-tick").forEach((tick) => {
        const el = tick as HTMLElement;
        const tickRect = el.getBoundingClientRect();
        const tickCenterX = tickRect.left - bezelRect.left + tickRect.width / 2;
        const dist = Math.abs(tickCenterX - centerX);
        const t = Math.min(dist / fadeZone, 1);
        // Quadratic ease: center stays flat, edges drop off fast
        const ease = t * t;

        const scale = 1 - ease * 0.5;
        const opacity = 1 - ease * 0.85;

        el.style.transform = `scale(${scale})`;
        el.style.opacity = String(Math.max(opacity, 0.1));
      });
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateDial);
    };

    bezel.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(updateDial);

    return () => {
      bezel.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
      // Clean up inline styles when leaving mobile
      bezel.querySelectorAll(".vl-bezel-tick").forEach((tick) => {
        const el = tick as HTMLElement;
        el.style.transform = "";
        el.style.opacity = "";
      });
    };
  }, [isMobile]);

  // Center active tick: instant on first mount, smooth on navigation
  useEffect(() => {
    if (!isMobile || !bezelRef.current) return;
    const bezel = bezelRef.current;

    const centerTick = () => {
      const activeTick = bezel.querySelector(".vl-bezel-tick-active") as HTMLElement | null;
      if (!activeTick) return;

      const bezelRect = bezel.getBoundingClientRect();
      const tickRect = activeTick.getBoundingClientRect();
      const target = bezel.scrollLeft
        + (tickRect.left + tickRect.width / 2)
        - (bezelRect.left + bezelRect.width / 2);

      if (isInitialScrollRef.current) {
        // Instant jump — no animation on first paint
        bezel.scrollLeft = target;
        isInitialScrollRef.current = false;
        // scrollLeft assignment doesn't fire scroll events, so trigger dial update
        bezel.dispatchEvent(new Event("scroll"));
      } else {
        // Smooth dial spin on navigation
        bezel.scrollTo({ left: target, behavior: "smooth" });
      }
    };

    // Double-rAF ensures layout (incl. padding, max-content) is fully computed
    let outer: number, inner: number;
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(centerTick);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isMobile, currentSectionId]);

  return (
    <div style={{ position: "relative" }}>
      {/* Floating back button */}
      <Link href="/" className="vl-back-button" aria-label="Back to home">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </Link>

      {/* Split layout */}
      <div className="vl-split-layout" ref={layoutRef}>
        {/* Left: Visual panel */}
        <div className="vl-visual-panel" style={isMobile ? undefined : { width: `${splitPct}%`, minWidth: `${splitPct}%` }}>
          <div className="vl-visual-panel-inner vl-float" key={currentSection.id}>
            {renderVisual(currentSection.visual, currentSection.id, currentSection.title)}
          </div>
        </div>

        {/* Draggable resizer */}
        <div
          className={`vl-resizer${dragging.current ? " vl-resizer-active" : ""}`}
          onMouseDown={startDrag}
        >
          <div className="vl-resizer-bar" />
        </div>

        {/* Right: Text panel */}
        <div className="vl-text-panel">
          <div className="vl-text-panel-inner">
            {children}
          </div>
        </div>
      </div>

      {/* Compass bezel */}
      <div className="vl-bezel" ref={bezelRef}>
        <div className="vl-bezel-track">
          <div className="vl-bezel-line" />
          <div className="vl-bezel-ticks">
            {VL_SECTIONS.map((section) => {
              const isActive = section.id === currentSectionId;
              const isCompleted = completedSections.includes(section.id);
              const isEnabled = canNavigate(section.id);

              const isLocked = ACTIVE_SECTIONS.has(section.id) && !isEnabled;

              let tickClass = "vl-bezel-tick";
              if (isActive) tickClass += " vl-bezel-tick-active";
              else if (isCompleted) tickClass += " vl-bezel-tick-completed";
              if (isEnabled) tickClass += " vl-bezel-tick-enabled";
              if (isLocked) tickClass += " vl-bezel-tick-locked";

              return (
                <div
                  key={section.id}
                  className={tickClass}
                  onClick={() => isEnabled && onNavigate(section.id)}
                  title={section.title}
                >
                  {/* Title label above active tick */}
                  {isActive && (
                    <div className="vl-bezel-title">
                      {section.title}
                    </div>
                  )}
                  <div className="vl-bezel-tick-dot" />
                  <div className="vl-bezel-tick-label">{section.id}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
