import { test, expect } from "@playwright/test";
import { filterCriticalErrors } from "./helpers";

test.describe("Visual Lightning", () => {
  test("visual lightning page loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/visual-lightning");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(2000);

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("visual lightning page has content", async ({ page }) => {
    await page.goto("/visual-lightning");
    await page.waitForTimeout(2000);

    // Should have some visible content (headings, diagrams, or text)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test("visual lightning with section ID loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/visual-lightning/1");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(2000);

    expect(filterCriticalErrors(errors)).toEqual([]);
  });
});
