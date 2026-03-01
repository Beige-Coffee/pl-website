import { test, expect } from "@playwright/test";

test.describe("Tutorial navigation", () => {
  test("sidebar chapter list loads", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    // Wait for the sidebar/chapter list to appear
    const sidebar = page.locator('[class*="sidebar"], nav, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
  });

  test("chapter content loads", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    // Some content should be visible (markdown rendered)
    const content = page.locator("article, main, [class*='content'], [class*='tutorial']");
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("navigate between chapters via sidebar", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    // Find clickable chapter links in sidebar
    const chapterLinks = page.locator('nav a, [class*="sidebar"] a, [class*="chapter"] a');
    const count = await chapterLinks.count();

    if (count >= 2) {
      // Click the second chapter link
      const secondChapter = chapterLinks.nth(1);
      const href = await secondChapter.getAttribute("href");
      await secondChapter.click();
      await page.waitForTimeout(1000);

      // URL should have changed
      if (href) {
        await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
  });

  test("page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(3000);

    // Filter out non-critical errors (e.g., network issues in dev)
    const criticalErrors = errors.filter(
      (e) => !e.includes("fetch") && !e.includes("network") && !e.includes("Failed to load")
    );
    expect(criticalErrors).toEqual([]);
  });
});
