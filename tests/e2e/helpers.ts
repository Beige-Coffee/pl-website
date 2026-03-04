import { Page, expect } from "@playwright/test";

/**
 * Navigate to a specific chapter by clicking its sidebar button.
 * Waits for content to render after navigation.
 */
export async function navigateToChapter(page: Page, chapterId: string) {
  const btn = page.getByTestId(`button-chapter-${chapterId}`);
  await btn.click();
  // Wait for the article content to update
  await page.getByTestId("container-article").waitFor({ state: "visible" });
  // Small settle time for markdown rendering
  await page.waitForTimeout(500);
}

/**
 * Wait for Pyodide to finish loading.
 * Looks for the "RUN TESTS" button text (which replaces "LOADING PYTHON...").
 */
export async function waitForPyodide(page: Page) {
  await page.getByText("RUN TESTS", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

/**
 * Get the text content of the CodeMirror editor.
 */
export async function getEditorContent(page: Page): Promise<string> {
  return page.locator(".cm-content").first().innerText();
}

/**
 * Type into the CodeMirror editor by focusing it and using keyboard input.
 * Clears existing editable content first.
 */
export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(".cm-content").first();
  await editor.click();
  // Select all editable text and replace
  await page.keyboard.press("Meta+a");
  await page.keyboard.type(text, { delay: 10 });
}

/**
 * Expand a collapsed checkpoint by clicking on it.
 * Checkpoints render as a "CHECKPOINT Knowledge Check" button that must be clicked to expand.
 */
export async function expandCheckpoint(page: Page, index = 0) {
  const checkpointButtons = page.locator('button:has-text("CHECKPOINT")');
  await checkpointButtons.nth(index).click();
  await page.waitForTimeout(300);
}

/**
 * Collect JS console errors during a callback.
 * Returns the list of errors encountered.
 */
export async function collectConsoleErrors(
  page: Page,
  callback: () => Promise<void>
): Promise<string[]> {
  const errors: string[] = [];
  const handler = (err: Error) => errors.push(err.message);
  page.on("pageerror", handler);
  await callback();
  page.off("pageerror", handler);
  return errors;
}

/**
 * Expand a collapsed exercise by clicking on its "EXERCISE" button.
 * Exercises render as collapsible items similar to checkpoints.
 */
export async function expandExercise(page: Page, index = 0) {
  const exerciseButtons = page.locator('button:has-text("EXERCISE")');
  await exerciseButtons.nth(index).click();
  await page.waitForTimeout(500);
}

/**
 * Assert no critical JS errors on the page.
 * Filters out network/fetch errors which are expected in dev.
 */
export function filterCriticalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes("fetch") &&
      !e.includes("network") &&
      !e.includes("Failed to load") &&
      !e.includes("NetworkError") &&
      !e.includes("ERR_CONNECTION_REFUSED")
  );
}
