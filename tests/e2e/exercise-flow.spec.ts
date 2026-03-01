import { test, expect } from "@playwright/test";

test.describe("Exercise flow", () => {
  test("code editor loads on exercise chapter", async ({ page }) => {
    // Navigate to a chapter with an exercise (keys chapter has exercises)
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    // Find and click a chapter that has coding exercises
    const exerciseChapter = page.locator(
      'a:has-text("Key Management"), a:has-text("Channel Key"), a:has-text("Funding Script")'
    );
    if (await exerciseChapter.count() > 0) {
      await exerciseChapter.first().click();
      await page.waitForTimeout(3000);

      // Look for CodeMirror editor
      const editor = page.locator(".cm-editor, [class*='CodeMirror'], [class*='code-editor']");
      await expect(editor.first()).toBeVisible({ timeout: 15000 });
    }
  });

  test("hints toggle visibility", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    // Navigate to an exercise chapter
    const exerciseChapter = page.locator(
      'a:has-text("Key Management"), a:has-text("Channel Key"), a:has-text("Funding Script")'
    );
    if (await exerciseChapter.count() > 0) {
      await exerciseChapter.first().click();
      await page.waitForTimeout(3000);

      // Look for hint buttons
      const hintButton = page.locator(
        'button:has-text("Hint"), button:has-text("hint"), [class*="hint"] button'
      );
      if (await hintButton.count() > 0) {
        await hintButton.first().click();
        await page.waitForTimeout(500);

        // Some hint content should now be visible
        const hintContent = page.locator('[class*="hint-content"], [class*="hint"] [class*="content"]');
        if (await hintContent.count() > 0) {
          await expect(hintContent.first()).toBeVisible();
        }
      }
    }
  });
});
