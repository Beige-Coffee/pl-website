/**
 * Pyodide Runner — manages in-browser Python execution via Web Worker.
 *
 * Lazy-loads Pyodide on first use. Runs student code + test suites in an
 * isolated Web Worker so the UI thread is never blocked.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface CodeRunResult {
  output: string;
  error: string | null;
}

export interface CompletionItem {
  label: string;
  type: "function" | "variable";
}

export interface SignatureResult {
  name: string;
  params: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Inline Web Worker source (avoids a separate file that Vite may struggle with)
// ---------------------------------------------------------------------------

const WORKER_SRC = [
  "// Pyodide Web Worker",
  "let pyodide = null;",
  "let readyPromise = null;",
  "",
  "async function initPyodide() {",
  "  if (readyPromise) return readyPromise;",
  "  readyPromise = (async () => {",
  '    importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");',
  "    pyodide = await loadPyodide();",
  '    await pyodide.loadPackage("micropip");',
  '    const micropip = pyodide.pyimport("micropip");',
  '    await micropip.install(["cryptography", "ecdsa", "python-bitcoinlib"]);',
  "    // Optional: load coincurve + bip32 if the WASM wheel is available",
  "    try {",
  '      await micropip.install(self.location.origin + "/wasm-wheels/coincurve-20.0.0-cp312-cp312-pyodide_2024_0_wasm32.whl");',
  '      await micropip.install("bip32");',
  "    } catch (e) {",
  '      console.warn("Optional: coincurve/bip32 not available:", e);',
  "    }",
  "  })();",
  "  return readyPromise;",
  "}",
  "",
  "self.onmessage = async (e) => {",
  "  const { id, studentCode, testCode, code, mode, expression } = e.data;",
  "  try {",
  "    await initPyodide();",
  "",
  '    if (mode === "run") {',
  "      // ── Scratchpad mode: run arbitrary code and capture stdout ──",
  '      const setupCapture = [',
  '        "import sys as _sys",',
  '        "import io as _io",',
  '        "_captured_buf = _io.StringIO()",',
  '        "_sys.stdout = _captured_buf",',
  "      ].join('\\n');",
  "      await pyodide.runPythonAsync(setupCapture);",
  "      let error = null;",
  "      try {",
  "        await pyodide.runPythonAsync(code);",
  "      } catch (runErr) {",
  "        error = runErr.message || String(runErr);",
  "      }",
  '      const getOutput = [',
  '        "_sys.stdout = _sys.__stdout__",',
  '        "_captured_buf.getvalue()",',
  "      ].join('\\n');",
  "      const output = await pyodide.runPythonAsync(getOutput);",
  '      self.postMessage({ id, type: "run_result", output: output || "", error: error });',
  "      return;",
  "    }",
  "",
  '    if (mode === "exec") {',
  "      // ── Exec mode: run code silently (no stdout capture, no test harness) ──",
  "      await pyodide.runPythonAsync(code);",
  '      self.postMessage({ id, type: "exec_result" });',
  "      return;",
  "    }",
  "",
  '    if (mode === "signature") {',
  "      // ── Signature mode: get function signature via inspect ──",
  '      const script = [',
  '        "import json as _json",',
  '        "import inspect as _inspect",',
  '        "_sig_result = \\"null\\"",',
  '        "try:",',
  '        "    _obj = eval(" + JSON.stringify(expression) + ")",',
  '        "    _sig = _inspect.signature(_obj)",',
  '        "    _name = getattr(_obj, \\"__name__\\", " + JSON.stringify(expression) + ")",',
  '        "    _doc = (getattr(_obj, \\"__doc__\\", \\"\\") or \\"\\").split(\\"\\\\n\\")[0].strip()",',
  '        "    _sig_result = _json.dumps({\\"name\\": str(_name), \\"params\\": str(_sig), \\"description\\": _doc[:120]})",',
  '        "except Exception:",',
  '        "    _sig_result = \\"null\\"",',
  '        "_sig_result",',
  "      ].join('\\n');",
  "      const result = await pyodide.runPythonAsync(script);",
  "      const parsed = JSON.parse(result);",
  '      self.postMessage({ id, type: "signature_result", signature: parsed });',
  "      return;",
  "    }",
  "",
  '    if (mode === "complete") {',
  "      // ── Complete mode: introspect an expression and return its attributes ──",
  '      const script = [',
  '        "import json as _json",',
  '        "_completion_result = \\"[]\\"",',
  '        "try:",',
  '        "    _obj = eval(" + JSON.stringify(expression) + ")",',
  '        "    _attrs = []",',
  '        "    for _a in dir(_obj):",',
  '        "        if _a.startswith(\\"_\\"):",',
  '        "            continue",',
  '        "        try:",',
  '        "            _attrs.append({\\"label\\": _a, \\"type\\": \\"function\\" if callable(getattr(_obj, _a)) else \\"variable\\"})",',
  '        "        except Exception:",',
  '        "            _attrs.append({\\"label\\": _a, \\"type\\": \\"variable\\"})",',
  '        "    _completion_result = _json.dumps(_attrs)",',
  '        "except Exception:",',
  '        "    _completion_result = _json.dumps([])",',
  '        "_completion_result",',
  "      ].join('\\n');",
  "      const result = await pyodide.runPythonAsync(script);",
  "      const items = JSON.parse(result);",
  '      self.postMessage({ id, type: "complete_result", items });',
  "      return;",
  "    }",
  "",
  "    // ── Test mode: run student code + test suite ──",
  '    const harness = [',
  '      "import json as _json",',
  '      "_test_results = []",',
  '      "for _name, _fn in sorted(globals().items()):",',
  '      "    if _name.startswith(\\"test_\\") and callable(_fn):",',
  '      "        try:",',
  '      "            _fn()",',
  '      "            _test_results.append({\\"name\\": _name, \\"passed\\": True, \\"message\\": \\"Passed\\"})",',
  '      "        except AssertionError as _ae:",',
  '      "            _test_results.append({\\"name\\": _name, \\"passed\\": False, \\"message\\": str(_ae) or \\"Assertion failed\\"})",',
  '      "        except Exception as _ex:",',
  '      "            _test_results.append({\\"name\\": _name, \\"passed\\": False, \\"message\\": type(_ex).__name__ + \\": \\" + str(_ex)})",',
  '      "_json.dumps(_test_results)",',
  "    ].join('\\n');",
  '    const cleanup = "for _k in [k for k in list(globals()) if k.startswith(\\"test_\\")]: del globals()[_k]\\n";',
  '    const combined = cleanup + studentCode + "\\n\\n" + testCode + "\\n\\n" + harness;',
  "    const result = await pyodide.runPythonAsync(combined);",
  "    const results = JSON.parse(result);",
  '    self.postMessage({ id, type: "result", results });',
  "  } catch (err) {",
  "    self.postMessage({",
  "      id,",
  '      type: "error",',
  "      message: err.message || String(err),",
  "    });",
  "  }",
  "};",
].join("\n");

const workerURL = URL.createObjectURL(
  new Blob([WORKER_SRC], { type: "application/javascript" })
);

// ---------------------------------------------------------------------------
// Singleton runner
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let messageId = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<
  number,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(workerURL);
    worker.onmessage = (e) => {
      const { id, type, results, message, output, error, items, signature } = e.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      clearTimeout(entry.timer);
      if (type === "result") {
        entry.resolve(results);
      } else if (type === "run_result") {
        entry.resolve({ output: output || "", error: error || null });
      } else if (type === "exec_result") {
        entry.resolve(undefined);
      } else if (type === "complete_result") {
        entry.resolve(items as CompletionItem[]);
      } else if (type === "signature_result") {
        entry.resolve(signature);
      } else {
        entry.reject(new Error(message));
      }
    };
    worker.onerror = (err) => {
      pending.forEach((entry) => {
        clearTimeout(entry.timer);
        entry.reject(new Error(err.message || "Worker error"));
      });
      pending.clear();
    };
  }
  return worker;
}

const TIMEOUT_MS = 60_000; // 60s — first run installs packages
const COMPLETION_TIMEOUT_MS = 5_000; // 5s for completions

/**
 * Run student Python code against a test suite. Returns structured results.
 * The test suite should define `test_*` functions that use `assert`.
 */
export async function runPythonTests(
  studentCode: string,
  testCode: string
): Promise<TestResult[]> {
  const w = getWorker();
  const id = ++messageId;
  return new Promise<TestResult[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Execution timed out (60 s). Check for infinite loops."));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, studentCode, testCode });
  });
}

/**
 * Run arbitrary Python code and capture stdout + errors.
 * Used by the Scratchpad for free-form experimentation.
 */
export async function runPythonCode(code: string): Promise<CodeRunResult> {
  const w = getWorker();
  const id = ++messageId;
  return new Promise<CodeRunResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Execution timed out (60 s). Check for infinite loops."));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, code, mode: "run" });
  });
}

/**
 * Run Python code silently — no stdout capture, no test harness.
 * Used to preload exercise context (preamble + prior exercises) into Pyodide
 * so that `dir()` introspection works for autocomplete.
 */
export async function execPythonSilent(code: string): Promise<void> {
  const w = getWorker();
  const id = ++messageId;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Exec timed out (60 s)."));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, code, mode: "exec" });
  });
}

/**
 * Introspect a Python expression and return its public attributes.
 * Returns `[]` if the expression can't be evaluated.
 */
export async function getPythonCompletions(expression: string): Promise<CompletionItem[]> {
  const w = getWorker();
  const id = ++messageId;
  return new Promise<CompletionItem[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve([]); // graceful: return empty on timeout
    }, COMPLETION_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, expression, mode: "complete" });
  });
}

const SIGNATURE_TIMEOUT_MS = 3_000;

/**
 * Introspect a Python expression and return its function signature.
 * Returns `null` if the expression can't be evaluated or isn't callable.
 * Used as a fallback when the static signature registry has no entry.
 */
export async function getPythonSignature(expression: string): Promise<SignatureResult | null> {
  if (!worker) return null; // Don't create worker just for signature lookup
  const w = getWorker();
  const id = ++messageId;
  return new Promise<SignatureResult | null>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
    }, SIGNATURE_TIMEOUT_MS);
    pending.set(id, { resolve, reject: () => resolve(null), timer });
    w.postMessage({ id, expression, mode: "signature" });
  });
}

/**
 * Pre-warm the worker so the first "Run Tests" click is faster.
 */
export function preloadWorker(): void {
  getWorker();
}

/**
 * Returns true if the Pyodide worker has been created (not necessarily ready).
 */
export function isWorkerCreated(): boolean {
  return worker !== null;
}
