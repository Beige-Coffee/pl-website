import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { runPythonTests, preloadWorker, type TestResult } from "../lib/pyodide-runner";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CodeExerciseData {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  testCode: string;
  hints: {
    conceptual: string;
    steps: string;
    code: string;
  };
  rewardSats: number;
}

interface CodeExerciseProps {
  exerciseId: string;
  data: CodeExerciseData;
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  lightningAddress: string | null;
  alreadyCompleted: boolean;
  claimInfo: { checkpointId: string; amountSats: number; paidAt: string } | null;
  onLoginRequest: () => void;
  onCompleted: (checkpointId: string, amountSats?: number) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CodeExercise({
  exerciseId,
  data,
  theme,
  authenticated,
  sessionToken,
  lightningAddress,
  alreadyCompleted,
  claimInfo,
  onLoginRequest,
  onCompleted,
}: CodeExerciseProps) {
  const dark = theme === "dark";
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const storageKey = `pl-exercise-${exerciseId}`;

  const [expanded, setExpanded] = useState(false);

  // Hint state: null = closed, "conceptual" | "steps" | "code" = which is open
  const [activeHint, setActiveHint] = useState<"conceptual" | "steps" | "code" | null>(null);
  const hintCodeRef = useRef<HTMLDivElement>(null);
  const hintViewRef = useRef<EditorView | null>(null);

  // Test run state
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  // Reward state (mirrors CheckpointQuestion)
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [rewardAmountSats, setRewardAmountSats] = useState(data.rewardSats);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);
  const [autoPaySending, setAutoPaySending] = useState(false);
  const [showClaimChoice, setShowClaimChoice] = useState(false);

  // Read-only CodeMirror for code hint
  useEffect(() => {
    if (activeHint !== "code" || !hintCodeRef.current) {
      if (hintViewRef.current) {
        hintViewRef.current.destroy();
        hintViewRef.current = null;
      }
      return;
    }
    // Already mounted
    if (hintViewRef.current) return;

    const hintExtensions = [
      python(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      ...(dark ? [oneDark] : []),
      EditorView.theme({
        "&": { fontSize: "14px", borderRadius: "4px", overflow: "hidden" },
        ".cm-scroller": { overflow: "auto", maxHeight: "350px" },
        ".cm-gutters": { display: "none" },
        ".cm-content": { padding: "8px 12px" },
        "&.cm-focused": { outline: "none" },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: data.hints.code.trim(), extensions: hintExtensions }),
      parent: hintCodeRef.current,
    });
    hintViewRef.current = view;

    return () => {
      view.destroy();
      hintViewRef.current = null;
    };
  }, [activeHint, dark, data.hints.code]);

  // Pre-warm Pyodide on mount
  useEffect(() => {
    preloadWorker();
  }, []);

  // Lock body scroll and handle Escape when expanded
  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [expanded]);

  // ── CodeMirror setup ────────────────────────────────────────────────────

  const savedCode = useMemo(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    } catch {}
    return data.starterCode;
  }, [storageKey, data.starterCode]);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      python(),
      keymap.of([...defaultKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const code = update.state.doc.toString();
          try {
            localStorage.setItem(storageKey, code);
          } catch {}
        }
      }),
      // Apply oneDark BEFORE custom overrides so syntax highlighting takes effect
      ...(dark ? [oneDark] : []),
      EditorView.theme({
        "&": {
          fontSize: "14px",
          border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
          borderRadius: "8px",
          overflow: "hidden",
        },
        ".cm-scroller": { overflow: "auto", maxHeight: "500px" },
        ".cm-gutters": {
          backgroundColor: dark ? "#1e1e2e" : "#f5f0e8",
          borderRight: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
        },
      }),
    ];

    const state = EditorState.create({
      doc: savedCode,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [dark]); // recreate on theme change

  // ── Reward polling (same as CheckpointQuestion) ──────────────────────────

  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const d = await res.json();
        setWithdrawalStatus(d.status);
        if (d.status === "paid") {
          onCompleted(exerciseId, rewardAmountSats);
          clearInterval(interval);
        } else if (d.status === "expired" || d.status === "failed") {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [rewardK1, withdrawalStatus]);

  useEffect(() => {
    if (!rewardCreatedAt || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rewardCreatedAt) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        setWithdrawalStatus("expired");
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rewardCreatedAt, withdrawalStatus]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Auto-pay when tests pass ────────────────────────────────────────────
  const completedDisplay = alreadyCompleted || autoPaid;

  useEffect(() => {
    if (
      allPassed &&
      !completedDisplay &&
      !autoPaid &&
      !autoPaySending &&
      !claiming &&
      !rewardK1 &&
      authenticated &&
      lightningAddress &&
      sessionToken
    ) {
      handleClaimReward("address");
    }
  }, [allPassed]);

  // ── Run tests ────────────────────────────────────────────────────────────

  const handleRunTests = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setPyodideLoading(true);
    setRunError(null);
    setResults(null);
    setAllPassed(false);

    try {
      const studentCode = viewRef.current?.state.doc.toString() || "";
      const testResults = await runPythonTests(studentCode, data.testCode);
      setResults(testResults);
      const passed = testResults.length > 0 && testResults.every((r) => r.passed);
      setAllPassed(passed);
    } catch (err: any) {
      setRunError(err.message || "Unknown error");
    } finally {
      setRunning(false);
      setPyodideLoading(false);
    }
  }, [running, data.testCode]);

  // ── Claim reward ─────────────────────────────────────────────────────────

  const handleClaimReward = useCallback(
    async (claimMethod?: "address" | "lnurl") => {
      if (!sessionToken) return;
      setClaiming(true);
      setClaimError(null);
      setShowClaimChoice(false);

      if (claimMethod !== "lnurl" && lightningAddress) {
        setAutoPaySending(true);
      }

      try {
        const res = await fetch("/api/checkpoint/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            checkpointId: exerciseId,
            answer: 0, // exercises use 0 as the "correct" answer
            method: claimMethod === "lnurl" ? "lnurl" : undefined,
          }),
        });

        let resData: any;
        try {
          resData = await res.json();
        } catch {
          setClaimError(`Server returned non-JSON response (status ${res.status})`);
          setAutoPaySending(false);
          return;
        }

        if (res.ok && resData.correct !== false) {
          if (resData.autoPaid) {
            setAutoPaid(true);
            setAutoPaySending(false);
            setRewardAmountSats(resData.amountSats || data.rewardSats);
            onCompleted(exerciseId, resData.amountSats || data.rewardSats);
          } else if (resData.alreadyCompleted) {
            setAutoPaySending(false);
            onCompleted(exerciseId, resData.amountSats || rewardAmountSats);
          } else {
            setAutoPaySending(false);
            setRewardK1(resData.k1);
            setRewardLnurl(resData.lnurl);
            setRewardAmountSats(resData.amountSats || data.rewardSats);
            setRewardCreatedAt(Date.now());
            setWithdrawalStatus("pending");
            setCountdown(300);
          }
        } else {
          setAutoPaySending(false);
          setClaimError(resData.error || "Failed to claim reward");
        }
      } catch {
        setAutoPaySending(false);
        setClaimError("Network error. Please try again.");
      } finally {
        setClaiming(false);
      }
    },
    [sessionToken, exerciseId, lightningAddress, data.rewardSats, onCompleted, rewardAmountSats]
  );

  // ── Reset code ────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: viewRef.current.state.doc.length,
        insert: data.starterCode,
      },
    });
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setResults(null);
    setRunError(null);
    setAllPassed(false);
  }, [data.starterCode, storageKey]);

  // ── Render ────────────────────────────────────────────────────────────────

  const sansFont = { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' } as const;
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-400" : "text-black/80";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const greenText = dark ? "text-green-400" : "text-green-700";

  const exerciseContent = (
    <div className={expanded ? "" : `my-4 border-2 ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-5`}>
      {/* Description + Expand button */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`text-lg md:text-[19px] ${textMuted} leading-relaxed flex-1`} style={sansFont}>
          {data.description}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`font-pixel text-[10px] border-2 px-2.5 py-1.5 transition-all shrink-0 mt-0.5 ${
            dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
          }`}
          title={expanded ? "Exit full screen" : "Expand to full screen"}
          data-testid="button-expand-exercise"
        >
          {expanded ? "⊟" : "⊞"}
        </button>
      </div>

      {/* Code Editor */}
      <div ref={editorRef} className="mb-3" />

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={handleRunTests}
          disabled={running}
          className={`font-pixel text-xs border-2 px-5 py-2.5 transition-all ${
            running
              ? "opacity-50 cursor-not-allowed border-[#2a3552] bg-[#0f1930] text-slate-500"
              : `${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 cursor-pointer`
          }`}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {pyodideLoading ? "LOADING PYTHON..." : "RUNNING..."}
            </span>
          ) : (
            "RUN TESTS"
          )}
        </button>

        <button
          onClick={handleReset}
          className={`font-pixel text-xs border-2 px-5 py-2.5 transition-all ${
            dark
              ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
          }`}
        >
          RESET
        </button>
      </div>

      {/* Test Results */}
      {runError && (
        <div className={`mb-3 px-3 py-2 border ${dark ? "border-red-500/30" : "border-red-300"} ${dark ? "bg-red-500/10" : "bg-red-50"}`} style={sansFont}>
          <pre className={`text-sm whitespace-pre-wrap m-0 ${dark ? "text-red-300" : "text-red-700"}`} style={sansFont}>{runError}</pre>
        </div>
      )}

      {results && (() => {
        const allTestsPassed = results.length > 0 && results.every((r) => r.passed);
        const failed = results.filter((r) => !r.passed);
        return (
          <div className="mb-3" style={sansFont}>
            {allTestsPassed ? (
              <div className={`text-base font-semibold ${greenText}`}>Passed!</div>
            ) : (
              <>
                <div className={`text-sm font-semibold ${textMuted} mb-1`}>
                  {results.filter((r) => r.passed).length}/{results.length} passed
                </div>
                {failed.map((r, i) => (
                  <div key={i} className={`flex items-baseline gap-1.5 text-sm py-0.5`}>
                    <span className="text-red-400 font-bold shrink-0">✗</span>
                    <span className={`${dark ? "text-red-300" : "text-red-700"}`}>
                      {r.name.replace(/^test_/, "").replace(/_/g, " ")}
                    </span>
                    {r.message && (
                      <span className={`text-[13px] px-1.5 py-0.5 rounded ${dark ? "text-red-300/80 bg-red-500/10" : "text-red-600/80 bg-red-100"}`}>
                        {r.message}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Hints — inline tabs */}
      <div className="mb-3" style={sansFont}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: "conceptual" as const, label: "Conceptual" },
            { key: "steps" as const, label: "Steps" },
            { key: "code" as const, label: "Code" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveHint(activeHint === key ? null : key)}
              className={`text-sm border px-3 py-1.5 transition-all cursor-pointer ${
                activeHint === key
                  ? `${goldBorder} ${dark ? "bg-[#FFD700]/15 text-[#FFD700]" : "bg-[#b8860b]/10 text-[#9a7200]"} font-semibold`
                  : `${cardBorder} ${dark ? "text-slate-400 hover:text-[#FFD700] hover:border-[#FFD700]/40" : "text-foreground/50 hover:text-[#9a7200] hover:border-[#b8860b]/40"}`
              }`}
            >
              Hint: {label}
            </button>
          ))}
        </div>

        {activeHint && (
          <div className={`mt-1.5 border ${goldBorder} px-3 py-2.5 ${dark ? "bg-[#0b1220]" : "bg-background"} hint-content relative`}>
            <button
              type="button"
              onClick={() => setActiveHint(null)}
              className={`absolute top-1.5 right-2 text-lg leading-none px-1.5 py-0.5 transition-colors cursor-pointer ${
                dark ? "text-slate-500 hover:text-slate-200" : "text-foreground/40 hover:text-foreground"
              }`}
              aria-label="Close hint"
              data-testid="button-close-hint"
            >
              ✕
            </button>
            <style>{`
              .hint-content p { margin: 0 0 0.4em 0; }
              .hint-content p:last-child { margin-bottom: 0; }
              .hint-content ol, .hint-content ul { margin: 0.3em 0; padding-left: 1.4em; }
              .hint-content li { margin-bottom: 0.2em; }
              .hint-content code { font-size: 0.9em; padding: 0.15em 0.35em; border-radius: 3px; background: ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}; }
            `}</style>
            {activeHint === "conceptual" && (
              <div className={`text-[15px] ${textMuted} leading-relaxed pr-6`}>
                <div dangerouslySetInnerHTML={{ __html: data.hints.conceptual }} />
              </div>
            )}
            {activeHint === "steps" && (
              <div className={`text-[15px] ${textMuted} leading-relaxed pr-6`}>
                <div dangerouslySetInnerHTML={{ __html: data.hints.steps }} />
              </div>
            )}
            {activeHint === "code" && (
              <div ref={hintCodeRef} className="pr-6" />
            )}
          </div>
        )}
      </div>

      {/* Reward Section */}
      {allPassed && !completedDisplay && (
        <div className="mt-4">
          {/* Auto-pay in progress */}
          {autoPaySending && (
            <div className={`font-pixel text-sm ${goldText}`}>
              SENDING {rewardAmountSats} SATS TO {lightningAddress}...
            </div>
          )}

          {/* Auto-pay succeeded */}
          {autoPaid && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-lg mb-2 ${goldText}`}>
                {rewardAmountSats} SATS SENT!
              </div>
              <div className={`text-[15px] ${textColor}`}>
                Sent to {lightningAddress}. Keep coding!
              </div>
            </div>
          )}

          {/* Manual claim fallback: no lightning address, not authenticated, or auto-pay failed */}
          {!rewardK1 && !autoPaid && !autoPaySending && !(authenticated && lightningAddress && !claimError) && (
            <>
              <div className={`font-pixel text-sm mb-3 ${greenText}`}>ALL TESTS PASSED!</div>
              {!authenticated ? (
                <button
                  onClick={onLoginRequest}
                  className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95`}
                >
                  LOGIN & CLAIM {rewardAmountSats} SATS
                </button>
              ) : (
                <button
                  onClick={() => handleClaimReward("lnurl")}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-6 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                >
                  {claiming ? "GENERATING QR..." : `CLAIM ${rewardAmountSats} SATS`}
                </button>
              )}
            </>
          )}

          {/* Auto-pay failed — show error + manual fallback buttons */}
          {claimError && authenticated && lightningAddress && !rewardK1 && !autoPaid && (
            <div className="mt-2">
              <div className="font-pixel text-xs text-red-400 mb-3">{claimError}</div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setClaimError(null); handleClaimReward("address"); }}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                >
                  {claiming ? "RETRYING..." : `RETRY SEND TO ${lightningAddress.toUpperCase()}`}
                </button>
                <button
                  onClick={() => handleClaimReward("lnurl")}
                  disabled={claiming}
                  className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${goldBorder} bg-transparent hover:bg-[#FFC800] active:scale-95 disabled:opacity-50`}
                  style={{ color: dark ? "#FFD700" : "#b8860b" }}
                >
                  LNURL WITHDRAWAL
                </button>
              </div>
            </div>
          )}

          {/* Non-address claim error */}
          {claimError && !(authenticated && lightningAddress) && (
            <div className="mt-2 font-pixel text-xs text-red-400">{claimError}</div>
          )}

          {rewardLnurl && withdrawalStatus === "pending" && (
            <div className="mt-4 text-center">
              <div className={`font-pixel text-sm mb-3 ${goldText}`}>
                SCAN TO CLAIM {rewardAmountSats} SATS
              </div>
              <div className={`inline-block border-4 ${dark ? "border-[#2a3552]" : "border-border"} ${dark ? "bg-[#0b1220]" : "bg-background"} p-4`}>
                <QRCodeSVG value={rewardLnurl} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className={`mt-3 font-mono text-sm ${countdown <= 60 ? "text-red-400" : textMuted}`}>
                Expires in {formatCountdown(countdown)}
              </div>
            </div>
          )}

          {withdrawalStatus === "expired" && (
            <div>
              <div className="font-pixel text-sm mb-2 text-red-400">QR EXPIRED</div>
              <button
                onClick={() => { setRewardK1(null); setRewardLnurl(null); setWithdrawalStatus("pending"); handleClaimReward("lnurl"); }}
                className={`font-pixel text-sm border-2 px-4 py-2 ${goldBorder} bg-[#FFD700] text-black hover:bg-[#FFC800]`}
              >
                GENERATE NEW QR
              </button>
            </div>
          )}
        </div>
      )}

      {/* Already completed */}
      {completedDisplay && (
        <div className={`mt-5 ${expanded ? "" : "-mx-5 -mb-5"} px-5 py-4 border-t-2 text-[17px] md:text-[19px] font-semibold text-black ${dark ? "bg-[#FFD700]/30 border-[#FFD700]/40" : "bg-[#b8860b]/20 border-[#b8860b]/30"}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          {claimInfo ? (
            <>{claimInfo.amountSats} Sats Claimed on {new Date(claimInfo.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {new Date(claimInfo.paidAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
          ) : autoPaid ? (
            <>{rewardAmountSats} Sats Sent</>
          ) : (
            <>Exercise Completed</>
          )}
        </div>
      )}
    </div>
  );

  if (expanded) {
    return (
      <>
        <div className={`my-4 border-2 ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-5`}>
          <div className={`text-sm ${textMuted} text-center py-4`} style={sansFont}>
            Exercise is open in expanded view.{" "}
            <button onClick={() => setExpanded(false)} className={`${goldText} underline cursor-pointer`}>Close expanded view</button>
          </div>
        </div>
        <div className="fixed inset-0 z-[9999] flex items-start justify-center" onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className={`absolute inset-0 ${dark ? "bg-black/80" : "bg-black/50"} backdrop-blur-sm`} />
          <div className={`relative w-full max-w-4xl mx-4 my-6 max-h-[calc(100vh-48px)] overflow-y-auto border-2 ${completedDisplay ? goldBorder : cardBorder} ${cardBg} p-6`}>
            <button
              onClick={() => setExpanded(false)}
              className={`absolute top-3 right-3 font-pixel text-xs border-2 px-3 py-1.5 transition-all z-10 ${
                dark
                  ? "border-[#2a3552] bg-[#0f1930] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
                  : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
              }`}
              data-testid="button-close-expanded"
            >
              ✕ CLOSE
            </button>
            <div className={`font-pixel text-sm ${goldText} mb-4`}>
              {data.title.toUpperCase()}
            </div>
            {exerciseContent}
          </div>
        </div>
      </>
    );
  }

  return exerciseContent;
}
