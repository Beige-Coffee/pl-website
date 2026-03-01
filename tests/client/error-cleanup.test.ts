import { describe, it, expect } from "vitest";
import { cleanErrorMessage } from "../../client/src/lib/error-cleanup";

describe("cleanErrorMessage", () => {
  it("strips Pyodide internal frames", () => {
    const raw = `Traceback (most recent call last):
  File "python311.zip/_pyodide/_base.py", line 501, in run_async
    coroutine = eval_code_async(source, globals, locals)
  File "<exec>", line 15
    x = 1 +
        ^
SyntaxError: invalid syntax`;

    const result = cleanErrorMessage(raw, 0);
    expect(result).not.toContain("_pyodide");
    expect(result).not.toContain("eval_code_async");
    expect(result).toContain("SyntaxError");
  });

  it("adjusts line numbers by lineOffset", () => {
    const raw = `Traceback (most recent call last):
  File "<exec>", line 150, in test_function
    result = my_func()
  File "<exec>", line 134, in my_func
    return x + y
TypeError: unsupported operand type(s)`;

    const result = cleanErrorMessage(raw, 100);
    expect(result).toContain("Line 50");
    expect(result).toContain("Line 34");
    expect(result).not.toContain("line 150");
    expect(result).not.toContain("line 134");
  });

  it("replaces File <exec> with In your code", () => {
    const raw = `  File "<exec>", line 5`;
    // After adjustment the File "<exec>" part is replaced by "Line N"
    const result = cleanErrorMessage(raw, 0);
    expect(result).toContain("Line 5");
    expect(result).not.toContain('<exec>');
  });

  it("preserves final error message", () => {
    const raw = `Traceback (most recent call last):
  File "<exec>", line 10, in <module>
    foo()
  File "<exec>", line 5, in foo
    return 1/0
ZeroDivisionError: division by zero`;

    const result = cleanErrorMessage(raw, 0);
    expect(result).toContain("ZeroDivisionError: division by zero");
  });

  it("handles empty input", () => {
    const result = cleanErrorMessage("", 0);
    expect(result).toBe("");
  });

  it("handles single-line error", () => {
    const result = cleanErrorMessage("NameError: name 'x' is not defined", 0);
    expect(result).toBe("NameError: name 'x' is not defined");
  });

  it("removes empty Traceback header when no student frames", () => {
    const raw = `Traceback (most recent call last):

SyntaxError: invalid syntax`;

    const result = cleanErrorMessage(raw, 0);
    expect(result).not.toMatch(/^Traceback/);
    expect(result).toContain("SyntaxError");
  });

  it("collapses multiple blank lines", () => {
    const raw = `Error line 1



Error line 2`;

    const result = cleanErrorMessage(raw, 0);
    expect(result).not.toContain("\n\n\n");
  });

  it("adjusts 'on line N' references", () => {
    const raw = `SyntaxError: expected after class definition on line 132`;
    const result = cleanErrorMessage(raw, 100);
    expect(result).toContain("on line 32");
    expect(result).not.toContain("on line 132");
  });

  it("ensures line numbers don't go below 1", () => {
    const raw = `  File "<exec>", line 2, in <module>
NameError: name 'x' is not defined`;
    const result = cleanErrorMessage(raw, 100);
    expect(result).toContain("Line 1");
  });
});
