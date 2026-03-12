import React, { useState, useEffect, useCallback, useRef } from "react";
import { runPythonCode } from "../lib/pyodide-runner";
import type { TxGeneratorConfig } from "../data/tx-generators";
import { LIGHTNING_EXERCISES } from "../data/lightning-exercises";

const STORAGE_PREFIX = "pl-txnotebook-";
const GENERATOR_FETCH_TIMEOUT_MS = 150_000;

const sansFont = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

interface TxGeneratorProps {
  config: TxGeneratorConfig;
  theme: "light" | "dark";
  sessionToken?: string | null;
  isCompleted?: boolean;
  onCompleted?: (id: string, amountSats?: number) => void;
  getProgress?: (exerciseId: string) => { completed: boolean } | undefined;
}

/** Parse stdout lines in format "LABEL: value" */
function parseOutput(stdout: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function getFriendlyGeneratorError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("node is still starting")) {
    return "Your Bitcoin node is still starting. Wait a few seconds, then try again.";
  }
  if (normalized.includes("wallet not ready") || normalized.includes("listunspent failed")) {
    return "The Bitcoin wallet is still warming up. Open Bitcoin Node, wait for it to finish loading, then try again.";
  }
  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return "The Bitcoin node request timed out. Open Bitcoin Node first or wait a moment, then retry.";
  }
  if (normalized.includes("signrawtransactionwithwallet failed") || normalized.includes("transaction signing incomplete")) {
    return "The node could not sign the transaction. Open Bitcoin Node, make sure the wallet is ready, then retry.";
  }
  if (normalized.includes("createmultisig failed") || normalized.includes("createrawtransaction failed")) {
    return "The generator could not build the funding transaction. Retry after the Bitcoin node is ready.";
  }
  return message;
}

export default function TxGenerator({ config, theme, sessionToken, isCompleted, onCompleted, getProgress }: TxGeneratorProps) {
  const dark = theme === "dark";
  const isUtility = config.type === "utility";

  // Check if all required exercises are completed
  const missingExercises = config.requiredExercises?.filter(
    (id) => !getProgress?.(id)?.completed
  ) ?? [];
  const prerequisitesMet = missingExercises.length === 0;

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [outputParsed, setOutputParsed] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [runningHint, setRunningHint] = useState<string | null>(null);

  // Track whether we've already submitted completion this session
  const completionSubmittedRef = useRef(false);

  // Auto-fill inputs from localStorage
  useEffect(() => {
    const filled: Record<string, string> = {};
    for (const inp of config.inputs) {
      if (inp.autoFillFrom) {
        try {
          const val = localStorage.getItem(STORAGE_PREFIX + inp.autoFillFrom);
          if (val) filled[inp.key] = val;
        } catch {}
      }
    }
    if (Object.keys(filled).length > 0) {
      setInputs((prev) => ({ ...filled, ...prev }));
    }
  }, [config.inputs]);

  // Restore previously saved output from localStorage
  useEffect(() => {
    if (!config.notebookSaves) return;
    const restored: Record<string, string> = {};
    for (const save of config.notebookSaves) {
      try {
        const val = localStorage.getItem(STORAGE_PREFIX + save.key);
        if (val) restored[save.parseLabel] = val;
      } catch {}
    }
    if (Object.keys(restored).length > 0) {
      setOutputParsed(restored);
      setSaved(true);
    }
  }, [config.notebookSaves]);

  useEffect(() => {
    if (!running) {
      setRunningHint(null);
      return;
    }
    if (!config.execute) {
      setRunningHint("Running the generator...");
      return;
    }

    setRunningHint("Starting your Bitcoin node...");
    const walletTimer = window.setTimeout(() => {
      setRunningHint("Still working. This may take a moment on first use.");
    }, 10_000);
    const retryTimer = window.setTimeout(() => {
      setRunningHint("If this takes too long, open Bitcoin Node first, wait for it to finish starting, then retry.");
    }, 35_000);

    return () => {
      window.clearTimeout(walletTimer);
      window.clearTimeout(retryTimer);
    };
  }, [running, config.execute]);

  const handleRun = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setOutputParsed(null);
    setSaved(false);

    try {
      let parsed: Record<string, string>;

      if (config.execute) {
        // Hybrid execution: uses server RPC + optional Python
        const nodeRpc = async (method: string, params: unknown[]) => {
          try {
            const res = await fetch("/api/node/rpc", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
              },
              body: JSON.stringify({ method, params }),
              signal: AbortSignal.timeout(GENERATOR_FETCH_TIMEOUT_MS),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
              return { error: payload.error || `${method} failed with HTTP ${res.status}` };
            }
            return payload;
          } catch (err: any) {
            if (err?.name === "TimeoutError" || err?.message?.includes("aborted due to timeout")) {
              return { error: `${method} timed out after ${Math.round(GENERATOR_FETCH_TIMEOUT_MS / 1000)}s` };
            }
            return { error: err?.message || `${method} failed` };
          }
        };
        parsed = await config.execute({ inputs, nodeRpc, runPython: runPythonCode });
      } else if (config.pythonCode) {
        // Pure Python execution
        let code = "";
        for (const inp of config.inputs) {
          const val = inputs[inp.key] || "";
          code += `${inp.key} = ${JSON.stringify(val)}\n`;
        }
        code += config.pythonCode;

        const result = await runPythonCode(code);

        if (result.error) {
          const lines = result.error.trim().split("\n");
          const last = lines[lines.length - 1] || result.error;
          setError(last);
          return;
        }
        parsed = parseOutput(result.output);
      } else {
        setError("Generator has no execution method configured");
        return;
      }

      setOutputParsed(parsed);

      // Save to TxNotebook localStorage
      if (config.notebookSaves || config.invalidatesNotebookKeys?.length) {
        if (config.invalidatesNotebookKeys?.length) {
          for (const key of config.invalidatesNotebookKeys) {
            try {
              localStorage.removeItem(STORAGE_PREFIX + key);
            } catch {}
          }
        }
        for (const save of config.notebookSaves) {
          const value = parsed[save.parseLabel];
          if (value) {
            try {
              localStorage.setItem(STORAGE_PREFIX + save.key, value);
            } catch {}
          }
        }
        // Dispatch event so TxNotebook refreshes
        window.dispatchEvent(new CustomEvent("tx-notebook-updated"));
        setSaved(true);
      }

      // Submit completion for tracked generators
      if (sessionToken && onCompleted && !completionSubmittedRef.current && !isCompleted) {
        completionSubmittedRef.current = true;
        try {
          await fetch("/api/checkpoint/complete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ checkpointId: config.id, answer: 0 }),
          });
          onCompleted(config.id);
        } catch (e) {
          // Non-critical; don't block the UI
          console.warn("Generator completion save failed:", e);
          completionSubmittedRef.current = false;
        }
      }
    } catch (err: any) {
      setError(getFriendlyGeneratorError(err.message || "Unknown error"));
    } finally {
      setRunning(false);
    }
  }, [running, config, inputs, sessionToken, isCompleted, onCompleted]);

  const handleCopy = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // ── Theme ──
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const panelBg = dark ? "bg-[#0a0f1a]" : "bg-[#fdf9f2]";
  const panelBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const headerBg = dark ? "bg-[#0b1220]" : "bg-[#f5f0e8]";
  const labelColor = dark ? "text-slate-300" : "text-black/75";
  const inputBg = dark ? "bg-[#0f1930]" : "bg-white";
  const inputBorder = dark ? "border-[#2a3552]" : "border-[#d4c9a8]";
  const inputText = dark ? "text-slate-200" : "text-black/80";
  const mutedText = dark ? "text-slate-400" : "text-black/50";
  const outputBg = dark ? "bg-[#0f1930]" : "bg-[#f8f5ee]";
  const greenText = dark ? "text-emerald-400" : "text-emerald-700";

  // ── Utility layout (compact inline) ──
  if (isUtility) {
    return (
      <div className={`my-4 border ${panelBorder} ${panelBg} px-5 py-4`} style={sansFont}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`font-pixel text-xs ${goldText}`}>TOOL</span>
          <span className={`text-base font-semibold ${dark ? "text-slate-200" : "text-black/80"}`}>
            {config.title}
          </span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          {config.inputs.map((inp) => (
            <div key={inp.key} className="flex-1 min-w-[200px]">
              <label className={`block text-sm mb-1 ${labelColor}`}>{inp.label}</label>
              <input
                type="text"
                value={inputs[inp.key] || ""}
                onChange={(e) => setInputs((p) => ({ ...p, [inp.key]: e.target.value }))}
                placeholder={inp.placeholder}
                spellCheck={false}
                className={`w-full text-base border ${inputBorder} ${inputBg} ${inputText} px-3 py-2 focus:outline-none focus:ring-1 ${
                  dark ? "focus:ring-[#FFD700]/30 placeholder:text-slate-600" : "focus:ring-[#b8860b]/30 placeholder:text-black/25"
                }`}
                style={sansFont}
              />
            </div>
          ))}
          <button
            onClick={handleRun}
            disabled={running}
            className={`font-pixel text-xs px-5 py-2.5 border-2 transition-all cursor-pointer shrink-0
              ${goldBorder} ${dark ? "bg-[#0f1930] text-[#FFD700] hover:bg-[#132043]" : "bg-[#f0e8d8] text-[#9a7200] hover:bg-[#e8dcc8]"}
              disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
          >
            {running ? "..." : config.buttonLabel}
          </button>
        </div>
        {error && (
          <div className={`mt-2 text-sm ${dark ? "text-red-400" : "text-red-600"}`}>
            Error: {error}
          </div>
        )}
        {outputParsed?.RESULT && (
          <div className="mt-3 flex items-center gap-2.5">
            <code className={`text-base font-mono break-all ${dark ? "text-emerald-300" : "text-emerald-800"}`}>
              {outputParsed.RESULT}
            </code>
            <button
              onClick={() => handleCopy("RESULT", outputParsed.RESULT!)}
              className={`text-sm px-2.5 py-1 border ${panelBorder} ${mutedText} hover:${goldText} transition-colors cursor-pointer shrink-0`}
            >
              {copied === "RESULT" ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const completed = isCompleted || completionSubmittedRef.current;
  const completedBorder = completed ? (dark ? "border-[#FFD700]/60" : "border-[#b8860b]/60") : panelBorder;

  // ── Transaction layout (full card) ──
  return (
    <div className={`my-6 border-2 ${completedBorder} ${panelBg} overflow-hidden`} style={sansFont}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${panelBorder} ${headerBg}`}>
        <span className={`font-pixel text-[10px] ${goldText}`}>TX GENERATOR</span>
        <span className={`text-lg font-semibold ${dark ? "text-slate-200" : "text-black/80"}`}>
          {config.title}
        </span>
        {completed && (
          <span className={`ml-auto font-pixel text-[10px] ${goldText}`}>COMPLETE</span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className={`text-base mb-3 leading-relaxed ${mutedText}`} dangerouslySetInnerHTML={{ __html: config.description }} />

        {/* Locked state: prerequisites not met */}
        {!prerequisitesMet ? (
          <div className={`opacity-60 border ${panelBorder} ${outputBg} px-4 py-4`}>
            <p className={`text-sm font-semibold mb-2 ${mutedText}`}>
              Complete the following exercises to unlock this generator:
            </p>
            <ul className={`text-sm ${mutedText} list-disc list-inside space-y-1`}>
              {missingExercises.map((id) => {
                const exercise = LIGHTNING_EXERCISES[id];
                return (
                  <li key={id}>{exercise?.title || id}</li>
                );
              })}
            </ul>
            <button
              disabled
              className={`mt-3 font-semibold text-sm px-5 py-2.5 border-2 opacity-40 cursor-not-allowed
                ${dark ? "border-slate-600 bg-[#0f1930] text-slate-500" : "border-[#d4c9a8] bg-[#f0e8d8] text-black/30"}`}
              style={sansFont}
            >
              {config.buttonLabel}
            </button>
          </div>
        ) : (
        <>
        {/* Input fields */}
        {config.inputs.length > 0 && (
          <div className="space-y-2 mb-3">
            {config.inputs.map((inp) => (
              <div key={inp.key}>
                <label className={`block text-sm font-semibold mb-1 ${labelColor}`}>
                  {inp.label}
                </label>
                <input
                  type="text"
                  value={inputs[inp.key] || ""}
                  onChange={(e) => setInputs((p) => ({ ...p, [inp.key]: e.target.value }))}
                  placeholder={inp.placeholder}
                  spellCheck={false}
                  className={`w-full text-base border ${inputBorder} ${inputBg} ${inputText} px-3 py-2 focus:outline-none focus:ring-1 ${
                    dark ? "focus:ring-[#FFD700]/30 placeholder:text-slate-600" : "focus:ring-[#b8860b]/30 placeholder:text-black/25"
                  }`}
                  style={sansFont}
                />
                {inp.autoFillFrom && inputs[inp.key] && (
                  <span className={`text-[10px] ${mutedText} mt-0.5 inline-block`}>
                    Auto-filled from Transactions notebook
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleRun}
          disabled={running}
          className={`font-semibold text-sm px-5 py-2.5 border-2 transition-all cursor-pointer
            ${goldBorder} ${dark ? "bg-[#0f1930] text-[#FFD700] hover:bg-[#132043]" : "bg-[#f0e8d8] text-[#9a7200] hover:bg-[#e8dcc8]"}
            disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`}
          style={sansFont}
        >
          {running ? "Generating..." : config.buttonLabel}
        </button>

        {runningHint && (
          <div className={`mt-2 text-xs ${mutedText}`}>
            {runningHint}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`mt-3 text-xs ${dark ? "text-red-400" : "text-red-600"} border ${dark ? "border-red-900/50" : "border-red-200"} ${dark ? "bg-red-950/20" : "bg-red-50"} px-3 py-2`}>
            {error}
          </div>
        )}

        {/* Output */}
        {outputParsed && !error && (
          <div className={`mt-3 border ${panelBorder} ${outputBg} px-4 py-4`}>
            {outputParsed.TXID && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-base font-bold uppercase ${labelColor}`}>
                    Transaction ID
                  </span>
                  <button
                    onClick={() => handleCopy("TXID", outputParsed.TXID!)}
                    className={`text-sm font-semibold px-3 py-1.5 border ${panelBorder} ${mutedText} hover:opacity-80 transition-opacity cursor-pointer`}
                    style={sansFont}
                  >
                    {copied === "TXID" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <code className={`text-lg font-mono break-all ${dark ? "text-slate-200" : "text-black/80"}`}>
                  {outputParsed.TXID}
                </code>
              </div>
            )}
            {outputParsed.HEX && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-base font-bold uppercase ${labelColor}`}>
                    Raw Transaction Hex
                  </span>
                  <button
                    onClick={() => handleCopy("HEX", outputParsed.HEX!)}
                    className={`text-sm font-semibold px-3 py-1.5 border ${panelBorder} ${mutedText} hover:opacity-80 transition-opacity cursor-pointer`}
                    style={sansFont}
                  >
                    {copied === "HEX" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <code className={`text-lg font-mono break-all leading-relaxed ${dark ? "text-slate-300" : "text-black/70"}`}>
                  {outputParsed.HEX}
                </code>
              </div>
            )}
            {outputParsed.RESULT && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-base font-bold uppercase ${labelColor}`}>
                    Result
                  </span>
                  <button
                    onClick={() => handleCopy("RESULT", outputParsed.RESULT!)}
                    className={`text-sm font-semibold px-3 py-1.5 border ${panelBorder} ${mutedText} hover:opacity-80 transition-opacity cursor-pointer`}
                    style={sansFont}
                  >
                    {copied === "RESULT" ? "COPIED" : "COPY"}
                  </button>
                </div>
                <code className={`text-lg font-mono break-all ${dark ? "text-emerald-300" : "text-emerald-800"}`}>
                  {outputParsed.RESULT}
                </code>
              </div>
            )}
            {saved && (
              <div className={`mt-2 text-[10px] font-pixel ${greenText}`}>
                SAVED TO TRANSACTIONS NOTEBOOK
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
