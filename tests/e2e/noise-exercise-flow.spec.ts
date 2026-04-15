import { test, expect } from "@playwright/test";
import { expandExercise, waitForPyodide } from "./helpers";

test.describe("Noise exercise flow", () => {
  test.beforeEach(async ({ page }) => {
    // Use ?mode=code URL param to enter the noise tutorial in coding mode.
    // This matches the supported public flow (e.g. links from the blog) and
    // doesn't depend on knowing the internal localStorage key name.
    // Use handshake-setup: it has a single exercise (no CollapsibleGroup wrapping).
    await page.goto("/noise-tutorial/handshake-setup?mode=code");
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

    // Find the Answer tab near the other hint tabs to avoid matching <details><summary>Answer</summary>
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
});
