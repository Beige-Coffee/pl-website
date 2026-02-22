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
  "  })();",
  "  return readyPromise;",
  "}",
  "",
  "self.onmessage = async (e) => {",
  "  const { id, studentCode, testCode, code, mode } = e.data;",
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
  '    const combined = studentCode + "\\n\\n" + testCode + "\\n\\n" + harness;',
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
      const { id, type, results, message, output, error } = e.data;
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      clearTimeout(entry.timer);
      if (type === "result") {
        entry.resolve(results);
      } else if (type === "run_result") {
        entry.resolve({ output: output || "", error: error || null });
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
 * Pre-warm the worker so the first "Run Tests" click is faster.
 */
export function preloadWorker(): void {
  getWorker();
}
