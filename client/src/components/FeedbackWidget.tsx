import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface FeedbackWidgetProps {
  theme: "light" | "dark";
  chapterTitle?: string;
  exerciseId?: string;
  sessionToken?: string | null;
}

type Step = "form" | "annotate" | "submitting" | "done";
type Category = "bug" | "confusing" | "suggestion" | "other";

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "bug", label: "Bug", icon: "\uD83D\uDC1B" },
  { value: "confusing", label: "Confusing", icon: "\uD83D\uDE15" },
  { value: "suggestion", label: "Suggestion", icon: "\uD83D\uDCA1" },
  { value: "other", label: "Other", icon: "\uD83D\uDCAC" },
];

export default function FeedbackWidget({ theme, chapterTitle, exerciseId, sessionToken }: FeedbackWidgetProps) {
  const dark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [annotatedDataUrl, setAnnotatedDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Draggable Y position
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const capturingRef = useRef(false);

  const resetState = useCallback(() => {
    setTimeout(() => {
      if (capturingRef.current) return; // don't reset during screenshot capture
      setStep("form");
      setCategory(null);
      setMessage("");
      setScreenshotDataUrl(null);
      setAnnotatedDataUrl(null);
    }, 200);
  }, []);

  const handleOpenChange = useCallback((val: boolean) => {
    if (capturingRef.current) return; // ignore dialog close during capture
    setOpen(val);
    if (!val) resetState();
  }, [resetState]);

  // Screenshot capture
  const captureScreenshot = useCallback(async () => {
    capturingRef.current = true;
    setIsCapturing(true);
    setOpen(false);

    await new Promise((r) => setTimeout(r, 350));

    try {
      const mod = await import("html2canvas-pro");
      const html2canvas = (mod.default || mod) as typeof mod.default;
      if (typeof html2canvas !== "function") {
        throw new Error(`html2canvas is ${typeof html2canvas}, not a function`);
      }
      const canvas = await html2canvas(document.documentElement, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (el: Element) =>
          el.getAttribute?.("data-feedback-widget") === "true",
      });
      const dataUrl = canvas.toDataURL("image/png");
      setScreenshotDataUrl(dataUrl);
      setAnnotatedDataUrl(dataUrl);
      setStep("annotate");
    } catch (err: any) {
      console.error("Screenshot capture failed:", err);
      toast({ title: `Screenshot failed: ${err?.message || err}`, variant: "destructive" });
      setStep("form");
    }

    setIsCapturing(false);
    capturingRef.current = false;
    setOpen(true);
  }, []);

  // Annotation canvas setup — retry until canvas ref is available (Dialog portal may delay mount)
  useEffect(() => {
    if (step !== "annotate" || !screenshotDataUrl) return;

    const loadImage = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        // Canvas not mounted yet (Dialog portal animating), retry
        const timer = setTimeout(loadImage, 50);
        return () => clearTimeout(timer);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        const maxW = 1800;
        const scale = Math.min(maxW / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = annotatedDataUrl || screenshotDataUrl;
    };

    // Small delay to ensure Dialog portal has mounted the canvas element
    const timer = setTimeout(loadImage, 100);
    return () => clearTimeout(timer);
  }, [step, screenshotDataUrl, annotatedDataUrl]);

  // Drawing handlers
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    drawingRef.current = true;
    lastPointRef.current = getCanvasPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const pos = getCanvasPos(e);
    if (!ctx || !pos || !lastPointRef.current) return;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  };

  const stopDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const finishAnnotation = () => {
    if (canvasRef.current) {
      setAnnotatedDataUrl(canvasRef.current.toDataURL("image/png"));
    }
    setStep("form");
  };

  // Submit
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
          screenshot: annotatedDataUrl || null,
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

  // Compact icon position
  const iconTop = dragY ?? (typeof window !== "undefined" ? window.innerHeight - 80 : 700);

  return (
    <>
      {/* Draggable feedback icon */}
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
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* Capture overlay */}
      {isCapturing && (
        <div data-feedback-widget="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-white font-pixel text-sm">
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            CAPTURING...
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-feedback-widget="true"
          className={`border-2 font-sans ${step === "annotate" ? "max-w-[90vw] max-h-[90vh] flex flex-col" : "max-w-xl"} ${
            dark
              ? "bg-[#0f1930] border-[#2a3552] text-slate-100"
              : "bg-[#fdf9f2] border-[#d4c9a8] text-foreground"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="font-pixel text-base" style={{ color: dark ? "#FFD700" : "#7a5600" }}>
              {step === "annotate" ? "ANNOTATE SCREENSHOT" : step === "done" ? "THANK YOU" : "SEND FEEDBACK"}
            </DialogTitle>
            <DialogDescription className={`font-sans text-sm ${dark ? "text-slate-400" : "text-foreground/60"}`}>
              {step === "annotate"
                ? "Draw on the screenshot to highlight the issue."
                : step === "done"
                ? "Your feedback helps us improve!"
                : "Help improve Programming Lightning."}
            </DialogDescription>
          </DialogHeader>

          {/* Form step */}
          {(step === "form" || step === "submitting") && (
            <div className="space-y-4 mt-2">
              {/* Category grid */}
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`border-2 px-4 py-3 text-base font-sans transition-all cursor-pointer ${
                      category === cat.value
                        ? dark
                          ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10"
                          : "border-[#b8860b] text-[#7a5600] bg-[#b8860b]/10"
                        : dark
                          ? "border-[#2a3552] text-slate-300 hover:border-slate-500"
                          : "border-[#d4c9a8] text-foreground/70 hover:border-[#b8a880]"
                    }`}
                  >
                    <span className="mr-1.5">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <div className="relative">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
                  placeholder="Describe the issue or suggestion..."
                  rows={4}
                  className={`w-full border-2 px-3 py-2 text-base font-sans resize-none focus:outline-none ${
                    dark
                      ? "bg-[#0a0f1a] border-[#2a3552] text-slate-100 placeholder:text-slate-600 focus:border-[#FFD700]/50"
                      : "bg-white border-[#d4c9a8] text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]/50"
                  }`}
                />
                <span className={`absolute bottom-2 right-3 text-[10px] font-sans ${dark ? "text-slate-600" : "text-foreground/30"}`}>
                  {message.length}/5000
                </span>
              </div>

              {/* Screenshot section */}
              {annotatedDataUrl ? (
                <div className="space-y-2">
                  <img
                    src={annotatedDataUrl}
                    alt="Screenshot preview"
                    className={`w-full border-2 ${dark ? "border-[#2a3552]" : "border-[#d4c9a8]"}`}
                    style={{ maxHeight: 150, objectFit: "contain" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("annotate")}
                      className={`text-xs font-sans border-2 px-3 py-1.5 cursor-pointer ${
                        dark
                          ? "border-[#2a3552] text-slate-400 hover:text-slate-200"
                          : "border-[#d4c9a8] text-foreground/60 hover:text-foreground"
                      }`}
                    >
                      Re-annotate
                    </button>
                    <button
                      onClick={() => { setScreenshotDataUrl(null); setAnnotatedDataUrl(null); }}
                      className={`text-xs font-sans border-2 px-3 py-1.5 cursor-pointer ${
                        dark
                          ? "border-[#2a3552] text-red-400 hover:text-red-300"
                          : "border-[#d4c9a8] text-red-600 hover:text-red-500"
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={captureScreenshot}
                      className={`w-full flex items-center justify-center gap-2 text-sm font-sans border-2 px-3 py-2.5 cursor-pointer ${
                        dark
                          ? "border-[#2a3552] text-slate-400 hover:text-slate-200 hover:border-slate-500"
                          : "border-[#d4c9a8] text-foreground/60 hover:text-foreground hover:border-[#b8a880]"
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      Capture screenshot (optional)
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className={`max-w-[240px] text-center font-sans text-xs border-2 rounded-none ${
                      dark
                        ? "bg-[#0f1930] border-[#2a3552] text-slate-300"
                        : "bg-[#fdf9f2] border-[#d4c9a8] text-foreground/70"
                    }`}
                  >
                    Captures your current view of the course so you can annotate or point to exactly what your feedback is about
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full flex items-center justify-center gap-2 font-pixel text-sm border-2 px-4 py-3 transition-all ${
                  canSubmit
                    ? dark
                      ? "border-[#FFD700] bg-[#FFD700] !text-[#000000] hover:bg-[#FFC800] cursor-pointer active:scale-95"
                      : "border-[#b8860b] bg-[#b8860b] text-white hover:bg-[#9a7200] cursor-pointer active:scale-95"
                    : "opacity-40 cursor-not-allowed border-[#2a3552] bg-transparent text-slate-500"
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

          {/* Annotate step */}
          {step === "annotate" && (
            <div className="flex flex-col gap-3 mt-2 min-h-0">
              <div className="flex-1 min-h-0 overflow-auto">
                <canvas
                  ref={canvasRef}
                  className="w-full cursor-crosshair touch-none"
                  style={{ border: `2px solid ${dark ? "#2a3552" : "#d4c9a8"}` }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={finishAnnotation}
                  className={`flex-1 font-pixel text-xs border-2 px-4 py-2 cursor-pointer ${
                    dark
                      ? "border-[#FFD700] bg-[#FFD700] !text-[#000000] hover:bg-[#FFC800]"
                      : "border-[#b8860b] bg-[#b8860b] text-white hover:bg-[#9a7200]"
                  }`}
                >
                  DONE
                </button>
                <button
                  onClick={() => { setScreenshotDataUrl(null); setAnnotatedDataUrl(null); setStep("form"); }}
                  className={`font-sans text-xs border-2 px-4 py-2 cursor-pointer ${
                    dark
                      ? "border-[#2a3552] text-slate-400 hover:text-slate-200"
                      : "border-[#d4c9a8] text-foreground/60 hover:text-foreground"
                  }`}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Done step */}
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
