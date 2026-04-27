/**
 * ValidationChecksDiagram -- shows the 3 formula-based validation checks
 * that Bob performs before forwarding a payment.
 *
 * Each check is rendered as a card with the formula, Bob's substituted values,
 * and a green checkmark indicating pass.
 *
 * Replaces the 3 formula code blocks in 5.2-forwarding-and-validation.md.
 *
 * Embed via `<validation-checks></validation-checks>` custom tag.
 */

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface ValidationChecksDiagramProps {
  className?: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ValidationCheck {
  name: string;
  checkNumber: number;
  formulaLabel: string;
  /** Formula parts rendered as styled inline text */
  formulaParts: { text: string; bold?: boolean }[];
  /** Bob's values substituted into the formula */
  substitution: string;
  /** Result shown with checkmark */
  result: string;
  color: {
    bg: string;
    border: string;
    text: string;
    iconBg: string;
    iconBorder: string;
  };
}

const CHECKS: ValidationCheck[] = [
  {
    name: "Fee sufficiency",
    checkNumber: 1,
    formulaLabel: "Formula",
    formulaParts: [
      { text: "expected_fee", bold: true },
      { text: " = fee_base_msat + floor(amt_to_forward " },
      { text: "\u00d7" },
      { text: " fee_proportional_millionths / 1,000,000)" },
    ],
    substitution:
      "1,000 + floor(50,003,000 \u00d7 100 / 1,000,000) = 1,000 + 5,000 = 6,000 msat",
    result:
      "50,009,000 \u2265 50,003,000 + 6,000 = 50,009,000",
    color: {
      bg: "bg-green-500/5 dark:bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-700 dark:text-green-300",
      iconBg: "bg-green-500/20",
      iconBorder: "border-green-500/40",
    },
  },
  {
    name: "Timelock safety",
    checkNumber: 2,
    formulaLabel: "Formula",
    formulaParts: [
      { text: "incoming_cltv", bold: true },
      { text: " \u2265 outgoing_cltv + cltv_expiry_delta" },
    ],
    substitution: "700,088 \u2265 700,048 + 40 = 700,088",
    result: "700,088 \u2265 700,088",
    color: {
      bg: "bg-green-500/5 dark:bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-700 dark:text-green-300",
      iconBg: "bg-green-500/20",
      iconBorder: "border-green-500/40",
    },
  },
  {
    name: "Not expired",
    checkNumber: 3,
    formulaLabel: "Formula",
    formulaParts: [
      { text: "outgoing_cltv", bold: true },
      { text: " > current_block_height" },
    ],
    substitution: "700,048 > current_block_height",
    result: "Outgoing CLTV is still in the future",
    color: {
      bg: "bg-green-500/5 dark:bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-700 dark:text-green-300",
      iconBg: "bg-green-500/20",
      iconBorder: "border-green-500/40",
    },
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckCard({ check }: { check: ValidationCheck }) {
  return (
    <div className={cn("border-2 px-4 py-3", check.color.bg, check.color.border)}>
      {/* Header with check number and name */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 border",
            check.color.iconBg,
            check.color.iconBorder,
            check.color.text,
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <span className={cn("font-sans text-sm font-bold", check.color.text)}>
          Check {check.checkNumber}: {check.name}
        </span>
      </div>

      {/* Formula */}
      <div className="pl-7 mb-1.5">
        <span className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">
          {check.formulaLabel}
        </span>
        <p className="font-sans text-sm text-foreground/80 mt-0.5">
          {check.formulaParts.map((part, i) => (
            <span key={i} className={part.bold ? "font-semibold" : ""}>
              {part.text}
            </span>
          ))}
        </p>
      </div>

      {/* Bob's values */}
      <div className="pl-7 mb-1.5">
        <span className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">
          Bob's values
        </span>
        <p className="font-sans text-sm text-foreground/80 mt-0.5">
          {check.substitution}
        </p>
      </div>

      {/* Result */}
      <div className="pl-7 flex items-center gap-2">
        <span className="font-sans text-[10px] text-muted-foreground uppercase tracking-wider">
          Result
        </span>
        <span className={cn("font-sans text-sm font-semibold", check.color.text)}>
          {check.result} &#10003;
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ValidationChecksDiagram({
  className,
}: ValidationChecksDiagramProps) {
  return (
    <div className={cn("w-full my-6 max-w-lg mx-auto", className)}>
      {/* Title */}
      <div className="text-center mb-4">
        <span className="font-sans text-sm font-bold text-foreground">
          Bob's Validation Checks
        </span>
        <span className="block font-sans text-xs text-muted-foreground mt-0.5">
          Each formula must pass before Bob forwards the HTLC
        </span>
      </div>

      {/* Check cards */}
      <div className="space-y-3">
        {CHECKS.map((check) => (
          <CheckCard key={check.checkNumber} check={check} />
        ))}
      </div>
    </div>
  );
}
