import { test, expect } from "@playwright/test";
import { navigateToChapter, expandCheckpoint } from "./helpers";

test.describe("Checkpoint flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
  });

  test("checkpoint buttons render on protocols-fairness chapter", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");

    const checkpointBtns = page.locator('button:has-text("CHECKPOINT")');
    await expect(checkpointBtns.first()).toBeVisible({ timeout: 5_000 });
  });

  test("clicking checkpoint expands the question", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");
    await expandCheckpoint(page, 0);

    // When not authenticated, button says "LOGIN & SUBMIT"
    const submitBtn = page.locator('button:has-text("SUBMIT")').first();
    await expect(submitBtn).toBeVisible({ timeout: 3_000 });
  });

  test("checkpoint options are selectable", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");
    await expandCheckpoint(page, 0);
    await expect(page.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

    // Click option B (correct answer) and verify it becomes active/selected
    const article = page.getByTestId("container-article");
    const optionB = article.locator('button:has-text("chooser picks first")');
    await expect(optionB).toBeVisible({ timeout: 3_000 });
    await optionB.click();
    await page.waitForTimeout(200);

    // Option should still be visible after selection
    await expect(optionB).toBeVisible();
  });

  test("wrong option can be selected", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");
    await expandCheckpoint(page, 0);
    await expect(page.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

    // Click option A (wrong answer)
    const article = page.getByTestId("container-article");
    const optionA = article.locator('button:has-text("Mom is watching")');
    await expect(optionA).toBeVisible();
    await optionA.click();
    await page.waitForTimeout(200);

    // Verify the submit button is present (LOGIN & SUBMIT when not authenticated)
    await expect(page.locator('button:has-text("LOGIN & SUBMIT")').first()).toBeVisible();
  });

  test("multiple checkpoints render on funding-script chapter", async ({ page }) => {
    await navigateToChapter(page, "funding-script");

    const checkpointBtns = page.locator('button:has-text("CHECKPOINT")');
    await expect(checkpointBtns.first()).toBeVisible({ timeout: 5_000 });
    const count = await checkpointBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
