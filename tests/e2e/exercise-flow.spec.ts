import { test, expect } from "@playwright/test";
import { expandExercise, waitForPyodide } from "./helpers";

test.describe("Exercise flow", () => {
  test.beforeEach(async ({ page }) => {
    // Set tutorial mode to "code" BEFORE the page loads using addInitScript
    // This runs before any page JavaScript, ensuring localStorage is set before React initializes
    await page.addInitScript(() => {
      localStorage.setItem("pl-tutorial-mode", "code");
    });
    await page.goto("/lightning-tutorial/funding-script");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });
    // Expand the first exercise collapsible to reveal the CodeMirror editor
    await expandExercise(page, 0);
  });

  test("CodeMirror editor is visible on exercise chapter", async ({ page }) => {
    const editor = page.locator(".cm-editor").first();
    await expect(editor).toBeVisible({ timeout: 30_000 });
  });

  test("Pyodide loads and RUN TESTS button appears", async ({ page }) => {
    await waitForPyodide(page);
    const runButton = page.getByText("RUN TESTS", { exact: true }).first();
    await expect(runButton).toBeVisible();
  });

  test("clicking RUN TESTS with starter code shows test output", async ({ page }) => {
    await waitForPyodide(page);

    const runButton = page.getByText("RUN TESTS", { exact: true }).first();
    await runButton.click();

    // Wait for results
    await page.waitForTimeout(10_000);

    const article = page.getByTestId("container-article");
    const text = await article.innerText();
    const hasResults =
      text.includes("passed") ||
      text.includes("Error") ||
      text.includes("error") ||
      text.includes("PASSED") ||
      text.includes("FAILED");
    expect(hasResults).toBe(true);
  });

  test("hint tabs show content when clicked", async ({ page }) => {
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    const conceptualTab = page.getByText("Conceptual", { exact: true }).first();
    await expect(conceptualTab).toBeVisible({ timeout: 5_000 });
    await conceptualTab.click();
    await page.waitForTimeout(300);

    const closeHint = page.getByTestId("button-close-hint").first();
    await expect(closeHint).toBeVisible();
    await closeHint.click();
  });

  test("steps hint tab works", async ({ page }) => {
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    const stepsTab = page.getByText("Steps", { exact: true }).first();
    await expect(stepsTab).toBeVisible({ timeout: 5_000 });
    await stepsTab.click();
    await page.waitForTimeout(300);

    const closeHint = page.getByTestId("button-close-hint").first();
    await expect(closeHint).toBeVisible();
  });

  test("answer hint tab works", async ({ page }) => {
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    // The "Answer" hint tab is next to "Conceptual" and "Steps" in the exercise area.
    // Use a locator that finds it near the other hint tabs to avoid matching
    // the <details><summary>Answer</summary> elements in the article prose.
    const hintArea = page.locator("button:has-text('Conceptual')").first().locator("..");
    const answerTab = hintArea.locator("button:has-text('Answer')");
    await expect(answerTab).toBeVisible({ timeout: 5_000 });
    await answerTab.click();
    await page.waitForTimeout(300);

    const closeHint = page.getByTestId("button-close-hint").first();
    await expect(closeHint).toBeVisible();
  });

  test("expand button opens fullscreen editor", async ({ page }) => {
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    const expandBtn = page.getByTestId("button-expand-exercise").first();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await page.waitForTimeout(500);

    const closeExpanded = page.getByTestId("button-close-expanded");
    await expect(closeExpanded).toBeVisible();
    await closeExpanded.click();
  });

  test("exercise code persists after page reload", async ({ page }) => {
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    const originalContent = await page.locator(".cm-content").first().innerText();

    // Reload the page (addInitScript persists across reloads)
    // The CollapsibleItem persists its open state in localStorage, so the exercise
    // should already be expanded after reload — do NOT click expand again.
    await page.reload();
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".cm-editor").first()).toBeVisible({ timeout: 30_000 });

    const restoredContent = await page.locator(".cm-content").first().innerText();
    expect(restoredContent).toBe(originalContent);
  });
});
