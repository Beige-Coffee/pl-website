import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface FeedbackWidgetProps {
  theme: "light" | "dark";
  chapterTitle?: string;
  exerciseId?: string;
  sessionToken?: string | null;
}

type Step = "form" | "submitting" | "done";
type Category = "bug" | "confusing" | "suggestion" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "bug", label: "BUG" },
  { value: "confusing", label: "CONFUSING" },
  { value: "suggestion", label: "SUGGESTION" },
  { value: "other", label: "OTHER" },
];

export default function FeedbackWidget({ theme, chapterTitle, exerciseId, sessionToken }: FeedbackWidgetProps) {
  const dark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");

  const [dragY, setDragY] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ startY: number; startTop: number }>({ startY: 0, startTop: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    draggingRef.current = true;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const currentY = dragY ?? (window.innerHeight - 80);
    dragStartRef.current = { startY: clientY, startTop: currentY };
    e.preventDefault();
  }, [dragY]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const delta = clientY - dragStartRef.current.startY;
      const newY = Math.max(60, Math.min(window.innerHeight - 60, dragStartRef.current.startTop + delta));
      setDragY(newY);
    };
    const handleUp = () => { draggingRef.current = false; };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);

  const resetState = useCallback(() => {
    setTimeout(() => {
      setStep("form");
      setCategory(null);
      setMessage("");
    }, 200);
  }, []);

  const handleOpenChange = useCallback((val: boolean) => {
    setOpen(val);
    if (!val) resetState();
  }, [resetState]);

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;
    setStep("submitting");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
          pageUrl: window.location.href,
          chapterTitle: chapterTitle || null,
          exerciseId: exerciseId || null,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStep("done");
        toast({ title: "Feedback submitted. Thank you!" });
        setTimeout(() => handleOpenChange(false), 1500);
      } else {
        toast({ title: data.error || "Failed to submit feedback", variant: "destructive" });
        setStep("form");
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
      setStep("form");
    }
  };

  const canSubmit = category && message.trim().length > 0 && step === "form";

  // Default position: offset higher on mobile to avoid overlap with TOOLS FAB
  const defaultTop = typeof window !== "undefined"
    ? window.innerWidth < 768 ? window.innerHeight - 140 : window.innerHeight - 80
    : 700;
  const iconTop = dragY ?? defaultTop;

  return (
    <>
      <div
        data-feedback-widget="true"
        className="fixed right-2 z-[100] select-none"
        style={{ top: iconTop, transform: "translateY(-50%)" }}
      >
        <button
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={() => {
            if (!draggingRef.current) setOpen(true);
          }}
          className={`w-10 h-10 flex items-center justify-center rounded-full border-2 shadow-lg transition-all cursor-grab active:cursor-grabbing ${
            dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-300 hover:text-[#FFD700] hover:border-[#FFD700]"
              : "border-[#d4c9a8] bg-[#fdf9f2] text-foreground/70 hover:text-foreground hover:border-[#b8860b]"
          }`}
          title="Send feedback"
          data-testid="button-feedback"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-feedback-widget="true"
          className={`border-2 font-sans max-w-xl ${
            dark
              ? "bg-[#0f1930] border-[#2a3552] text-slate-100"
              : "bg-[#fdf9f2] border-[#d4c9a8] text-foreground"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="font-pixel text-base" style={{ color: dark ? "#FFD700" : "#7a5600" }}>
              {step === "done" ? "THANK YOU" : "SEND FEEDBACK"}
            </DialogTitle>
            <DialogDescription className={`font-sans text-sm ${dark ? "text-slate-400" : "text-[#5a4a30]"}`}>
              {step === "done"
                ? "Your feedback helps us improve!"
                : "Help improve Programming Lightning."}
            </DialogDescription>
          </DialogHeader>

          {(step === "form" || step === "submitting") && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    data-testid={`button-category-${cat.value}`}
                    className={`border-2 px-4 py-3 font-pixel text-sm transition-all cursor-pointer ${
                      category === cat.value
                        ? dark
                          ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10"
                          : "border-[#b8860b] text-[#7a5600] bg-[#b8860b]/10"
                        : dark
                          ? "border-[#2a3552] text-slate-200 hover:border-slate-500"
                          : "border-[#d4c9a8] text-[#7a5600] hover:border-[#b8a880]"
                    }`}
                    style={{ color: category === cat.value ? undefined : (dark ? undefined : "#7a5600") }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
                  placeholder="Describe the issue or suggestion..."
                  rows={4}
                  data-testid="input-feedback-message"
                  className={`w-full border-2 px-3 py-2 text-base font-sans resize-none focus:outline-none ${
                    dark
                      ? "bg-[#0a0f1a] border-[#2a3552] text-slate-100 placeholder:text-slate-600 focus:border-[#FFD700]/50"
                      : "bg-white border-[#d4c9a8] text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]/50"
                  }`}
                />
                <span className={`absolute bottom-2 right-3 text-[10px] font-sans ${dark ? "text-slate-600" : "text-[#8a7a60]"}`}>
                  {message.length}/5000
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                data-testid="button-submit-feedback"
                className={`w-full flex items-center justify-center gap-2 font-pixel text-sm border-2 px-4 py-3 transition-all ${
                  canSubmit
                    ? dark
                      ? "border-[#FFD700] bg-[#FFD700] !text-[#000000] hover:bg-[#FFC800] cursor-pointer active:scale-95"
                      : "border-[#b8860b] bg-[#b8860b] text-white hover:bg-[#9a7200] cursor-pointer active:scale-95"
                    : dark
                      ? "opacity-40 cursor-not-allowed border-[#2a3552] bg-transparent text-slate-500"
                      : "opacity-40 cursor-not-allowed border-[#d4c9a8] bg-transparent text-[#8a7a60]"
                }`}
              >
                {step === "submitting" ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    SUBMITTING...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    SUBMIT
                  </>
                )}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">&#9889;</div>
              <p className={`font-pixel text-xs ${dark ? "text-[#FFD700]" : "text-[#7a5600]"}`}>
                FEEDBACK SUBMITTED
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
