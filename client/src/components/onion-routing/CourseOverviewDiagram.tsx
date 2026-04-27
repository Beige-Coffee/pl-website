/**
 * CourseOverviewDiagram -- Visual roadmap of the onion routing course,
 * showing the progression from privacy model through building onion
 * packets to the full payment trace lab.
 *
 * Embed via `<course-overview></course-overview>` custom tag.
 */

import { cn } from "@/lib/utils";
import {
  Eye,
  Map,
  KeyRound,
  Layers,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CourseOverviewDiagramProps {
  className?: string;
}

interface CourseStep {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color: string; // Tailwind color token (e.g. "emerald")
}

// ---------------------------------------------------------------------------
// Course steps
// ---------------------------------------------------------------------------

const STEPS: CourseStep[] = [
  {
    icon: Eye,
    title: "Privacy Model",
    subtitle: "What each hop sees",
    color: "emerald",
  },
  {
    icon: Map,
    title: "Route Planning",
    subtitle: "Fees, timelocks, payloads",
    color: "emerald",
  },
  {
    icon: KeyRound,
    title: "Crypto Primitives",
    subtitle: "Shared secrets, key derivation",
    color: "emerald",
  },
  {
    icon: Layers,
    title: "Building Onions",
    subtitle: "Sphinx packet construction",
    color: "emerald",
  },
  {
    icon: ArrowRight,
    title: "Processing Hops",
    subtitle: "Peeling & forwarding",
    color: "emerald",
  },
  {
    icon: CheckCircle2,
    title: "Payment Flow",
    subtitle: "Commitment dance, fulfillment",
    color: "emerald",
  },
  {
    icon: FlaskConical,
    title: "Trace Lab",
    subtitle: "End-to-end payment trace",
    color: "emerald",
  },
];

// ---------------------------------------------------------------------------
// Color helpers (all emerald-based to keep the scheme cohesive)
// ---------------------------------------------------------------------------

function stepColors(index: number) {
  // Gradually intensify the emerald as we progress through the course
  const opacity = 0.6 + (index / (STEPS.length - 1)) * 0.4;
  return {
    border: "border-emerald-500/30 dark:border-emerald-400/25",
    bg: "bg-emerald-500/5 dark:bg-emerald-500/8",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-400/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    opacity,
  };
}

// ---------------------------------------------------------------------------
// Connector arrow between cards (horizontal on desktop, vertical on mobile)
// ---------------------------------------------------------------------------

function Connector() {
  return (
    <div className="flex items-center justify-center shrink-0">
      {/* Horizontal arrow (desktop) */}
      <div className="hidden sm:flex items-center text-emerald-500/40 dark:text-emerald-400/30">
        <div className="w-4 h-px bg-current" />
        <svg width="8" height="10" viewBox="0 0 8 10" className="shrink-0">
          <path d="M0 0L8 5L0 10Z" fill="currentColor" />
        </svg>
      </div>
      {/* Vertical arrow (mobile) */}
      <div className="flex sm:hidden flex-col items-center text-emerald-500/40 dark:text-emerald-400/30 py-1">
        <div className="w-px h-3 bg-current" />
        <svg width="10" height="6" viewBox="0 0 10 6" className="shrink-0">
          <path d="M5 6L0 0h10z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CourseOverviewDiagram({
  className,
}: CourseOverviewDiagramProps) {
  return (
    <div className={cn("w-full my-8", className)}>
      {/* Desktop: horizontal flow (wrapping at 4 items per row) */}
      <div className="hidden sm:flex flex-wrap justify-center items-start gap-y-3">
        {STEPS.map((step, i) => {
          const colors = stepColors(i);
          const Icon = step.icon;
          return (
            <div key={step.title} className="flex items-center">
              {i > 0 && <Connector />}
              <div
                className={cn(
                  "flex flex-col items-center text-center border px-3 py-3 w-[120px] font-sans",
                  colors.border,
                  colors.bg,
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 mb-2",
                    colors.iconBg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", colors.iconColor)} strokeWidth={2} />
                </div>
                <div className="text-xs font-bold leading-tight">{step.title}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  {step.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical flow */}
      <div className="flex sm:hidden flex-col items-center">
        {STEPS.map((step, i) => {
          const colors = stepColors(i);
          const Icon = step.icon;
          return (
            <div key={step.title} className="flex flex-col items-center">
              {i > 0 && <Connector />}
              <div
                className={cn(
                  "flex items-center gap-3 border px-4 py-3 w-full max-w-xs font-sans",
                  colors.border,
                  colors.bg,
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 shrink-0",
                    colors.iconBg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", colors.iconColor)} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                    {step.subtitle}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground text-center italic mt-4 font-sans">
        Your journey through the course: from understanding privacy to tracing a complete payment.
      </p>
    </div>
  );
}
