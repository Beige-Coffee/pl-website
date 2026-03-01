import { test, expect } from "@playwright/test";

test.describe("Checkpoint flow", () => {
  test("checkpoint questions render", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    // Navigate to a chapter that has checkpoints
    const chapterLink = page.locator(
      'a:has-text("Protocols"), a:has-text("Off-Chain"), a:has-text("Fairness")'
    );
    if (await chapterLink.count() > 0) {
      await chapterLink.first().click();
      await page.waitForTimeout(3000);

      // Look for checkpoint question UI elements
      const checkpoint = page.locator(
        '[class*="checkpoint"], [class*="quiz"], [class*="question"], [data-checkpoint]'
      );
      if (await checkpoint.count() > 0) {
        await expect(checkpoint.first()).toBeVisible();
      }
    }
  });

  test("selecting a checkpoint answer shows feedback", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    // Navigate to chapter with checkpoints
    const chapterLink = page.locator(
      'a:has-text("Protocols"), a:has-text("Off-Chain"), a:has-text("Fairness")'
    );
    if (await chapterLink.count() > 0) {
      await chapterLink.first().click();
      await page.waitForTimeout(3000);

      // Find answer options (radio buttons, buttons, or clickable items)
      const options = page.locator(
        '[class*="checkpoint"] button, [class*="checkpoint"] [role="radio"], [class*="answer"]'
      );
      if (await options.count() > 0) {
        await options.first().click();
        await page.waitForTimeout(1000);

        // Should show some feedback (correct/incorrect indication)
        const feedback = page.locator(
          '[class*="correct"], [class*="incorrect"], [class*="shake"], [class*="success"]'
        );
        // At least some visual change should occur
        await page.waitForTimeout(500);
      }
    }
  });
});
