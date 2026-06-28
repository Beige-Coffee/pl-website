import { useEffect, useRef, useState } from "react";
import { forceReadable } from "./useReadableInDark";

// ────────────────────────────────────────────────────────────────────────────
// FeeCalculatorModal (DRAFT)
//
// Draggable floating panel that lets students plug numbers into the BOLT 7
// forwarding fee formula and see the result. No backdrop, the rest of the
// page stays interactive while the calculator is open. Click anywhere outside
// the panel to dismiss it; drag the header to reposition.
//
// Same locked visual format as the rest of the onion-routing visuals:
// black header bar with gold dot, cream body, JetBrains Mono on numerics.
//
// Formula:
//   total = base_fee + floor((fee_per_millionth * amount) / 1_000_000)
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const AMBER = "#b8860b";

const PANEL_WIDTH = 520;

export interface FeeCalculatorModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeeCalculatorModal({ open, onClose }: FeeCalculatorModalProps) {
  const [baseFee, setBaseFee] = useState<string>("100");
  const [feePpm, setFeePpm] = useState<string>("3000");
  const [amount, setAmount] = useState<string>("400000");

  // Position state. null means "unset", we compute the initial center the
  // first time the panel opens. Subsequent opens preserve the previous
  // position so a student who drags it to a corner finds it there next time.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const wasDraggingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute initial center on first open.
  useEffect(() => {
    if (!open) return;
    if (pos !== null) return;
    if (typeof window === "undefined") return;
    const x = Math.max(20, (window.innerWidth - PANEL_WIDTH) / 2);
    const y = Math.max(40, window.innerHeight / 5);
    setPos({ x, y });
  }, [open, pos]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click anywhere outside the panel closes. Defer the listener attach by one
  // tick so the click that opened the panel doesn't immediately close it.
  // Suppress the close if a drag just ended (mouseup outside the panel
  // wouldn't be a "click" the user intended).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      if (e.target instanceof Node && !panel.contains(e.target)) {
        onClose();
      }
    };
    const t = window.setTimeout(() => {
      document.addEventListener("click", onClick);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  // Drag handlers, attached globally while dragging so the panel keeps
  // following the cursor even when it leaves the header.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const { dx, dy } = dragOffsetRef.current;
      const newX = e.clientX - dx;
      const newY = e.clientY - dy;
      // Clamp so the panel can't be dragged completely off-screen.
      const clampedX = Math.max(
        -PANEL_WIDTH + 80,
        Math.min(window.innerWidth - 80, newX),
      );
      const clampedY = Math.max(
        0,
        Math.min(window.innerHeight - 60, newY),
      );
      setPos({ x: clampedX, y: clampedY });
    };
    const onUp = () => {
      setDragging(false);
      wasDraggingRef.current = true;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  function onHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!panelRef.current) return;
    // Don't initiate drag if user is clicking the close button.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    setDragging(true);
  }

  if (!open) return null;
  if (pos === null) return null; // wait for initial position computation

  const base = Number(baseFee) || 0;
  const ppm = Number(feePpm) || 0;
  const amt = Number(amount) || 0;
  const feeRate = Math.floor((ppm * amt) / 1_000_000);
  const total = base + feeRate;
  const fmt = (n: number) => n.toLocaleString("en-US");

  useEffect(() => {
    forceReadable(panelRef.current);
  });
  return (
    <div
      ref={panelRef}
      className="fixed border-[1.5px] overflow-hidden z-50"
      style={{
        left: pos.x,
        top: pos.y,
        width: PANEL_WIDTH,
        background: "#fefdfb",
        borderColor: "rgba(15,23,42,0.4)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
      data-testid="fee-calculator-modal"
    >
      {/* Header, drag handle */}
      <div
        className="bg-black text-white px-4 py-2 flex items-center justify-between"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onMouseDown={onHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Fee Calculator
          </span>
          <span
            className="ml-2 text-[10px] italic opacity-60 hidden sm:inline"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            drag to move · click outside to close
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-no-drag
          className="text-white text-lg leading-none px-2 py-0.5 hover:opacity-70"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div
        className="px-5 py-5"
        style={{ background: "#fefdfb", color: INK }}
      >
        <p
          className="text-xs leading-relaxed mb-4 opacity-80"
          style={{ color: INK }}
        >
          Plug your own numbers in. The Lightning forwarding fee floors the
          fee_rate result (real nodes drop fractional sats).
        </p>

        <div className="grid grid-cols-1 gap-3">
          <LabeledNumberInput
            label="base_fee (sats)"
            value={baseFee}
            onChange={setBaseFee}
          />
          <LabeledNumberInput
            label="fee_per_millionth"
            value={feePpm}
            onChange={setFeePpm}
          />
          <LabeledNumberInput
            label="amount (sats)"
            value={amount}
            onChange={setAmount}
          />
        </div>

        {/* Result block */}
        <div
          className="mt-5 px-3 py-3"
          style={{
            border: `1.5px dashed ${SLATE}`,
            background: "#fffdf5",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color: INK,
          }}
        >
          <div className="text-[12px] leading-relaxed space-y-0.5">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span style={{ color: SLATE, minWidth: 80, display: "inline-block" }}>
                Base Fee
              </span>
              <span style={{ color: SLATE }}>=</span>
              <span className="font-bold tabular-nums">{fmt(base)}</span>
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap flex-wrap">
              <span style={{ color: SLATE, minWidth: 80, display: "inline-block" }}>
                Fee Rate
              </span>
              <span style={{ color: SLATE }}>=</span>
              <span className="tabular-nums">
                ({fmt(ppm)} / 1,000,000) × {fmt(amt)}
              </span>
              <span style={{ color: SLATE }}>=</span>
              <span className="font-bold tabular-nums">{fmt(feeRate)}</span>
            </div>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap pt-1 mt-1 border-t-[1px] border-foreground/15">
              <span
                style={{
                  color: INK,
                  fontWeight: 700,
                  minWidth: 80,
                  display: "inline-block",
                }}
              >
                Total
              </span>
              <span style={{ color: SLATE }}>=</span>
              <span className="font-bold tabular-nums">{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span
        className="text-[12px] tracking-[0.05em]"
        style={{
          color: SLATE,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          minWidth: 180,
        }}
      >
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 flex-1 tabular-nums"
        style={{
          border: `1.5px solid ${SLATE}`,
          background: "#fffdf5",
          color: INK,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 13,
          minWidth: 0,
        }}
      />
    </label>
  );
}

export default FeeCalculatorModal;
