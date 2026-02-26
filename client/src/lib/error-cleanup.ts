/**
 * Transform a raw Pyodide traceback into a student-friendly error message.
 *
 * @param raw - The full traceback string from Pyodide
 * @param lineOffset - Number of hidden lines before student code
 * @returns Cleaned error message with adjusted line numbers
 */
export function cleanErrorMessage(raw: string, lineOffset: number): string {
  const lines = raw.split("\n");
  const cleaned: string[] = [];

  // Patterns for internal Pyodide frames to strip
  const internalPatterns = [
    /python\d+\.zip\/_pyodide\//,
    /pyodide\/_base\.py/,
    /_parse_and_compile_gen/,
    /eval_code_async/,
    /^\s+await CodeRunner/,
    /^\s+self\.ast = next/,
  ];

  for (const line of lines) {
    // Skip internal Pyodide frames
    if (internalPatterns.some(p => p.test(line))) {
      continue;
    }

    // Skip caret-only lines that followed internal frames
    // (standalone lines of just ^ characters with optional whitespace)
    if (/^\s+\^+\s*$/.test(line) && cleaned.length > 0) {
      // Check if the previous cleaned line was removed (i.e., we're after a skipped frame)
      // Keep carets that follow student code lines (File "<exec>" lines)
      const prev = cleaned[cleaned.length - 1];
      if (!prev || (!prev.includes("Line ") && !prev.includes("<exec>") && !/^\s{4,}/.test(prev))) {
        continue;
      }
    }

    // Adjust line numbers in File references: File "<exec>", line 134
    let adjusted = line.replace(
      /File "<exec>", line (\d+)/g,
      (_, num) => {
        const adj = Math.max(1, parseInt(num) - lineOffset);
        return `Line ${adj}`;
      }
    );

    // Adjust "on line N" references (e.g., "after class definition on line 132")
    adjusted = adjusted.replace(
      /on line (\d+)/g,
      (_, num) => {
        const adj = Math.max(1, parseInt(num) - lineOffset);
        return `on line ${adj}`;
      }
    );

    // Clean up remaining "<exec>" references
    adjusted = adjusted.replace(/File "<exec>"/g, "In your code");

    cleaned.push(adjusted);
  }

  let result = cleaned.join("\n").trim();

  // Remove empty "Traceback" header if no student frames remain
  result = result.replace(/^Traceback \(most recent call last\):\s*\n\s*\n/m, "");

  // Collapse multiple blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}
