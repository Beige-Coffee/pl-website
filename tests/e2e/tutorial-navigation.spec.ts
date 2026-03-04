import { test, expect } from "@playwright/test";
import { navigateToChapter, filterCriticalErrors } from "./helpers";

test.describe("Tutorial navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
  });

  test("first chapter renders markdown content", async ({ page }) => {
    const article = page.getByTestId("container-article");
    await expect(article).toBeVisible();
    // Article should have actual text, not be empty
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar shows section headers", async ({ page }) => {
    // Check that key section headers are present
    await expect(page.getByTestId("text-section-introduction")).toBeVisible();
    await expect(page.getByTestId("text-section-keys-&-derivation")).toBeVisible();
    await expect(page.getByTestId("text-section-payment-channels")).toBeVisible();
  });

  test("navigate to chapters via sidebar", async ({ page }) => {
    await navigateToChapter(page, "funding-script");

    // URL uses path segments: /lightning-tutorial/funding-script
    await expect(page).toHaveURL(/\/lightning-tutorial\/funding-script/);

    // Article should have content
    const article = page.getByTestId("container-article");
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("clicking multiple sections loads different content", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");
    const content1 = await page.getByTestId("container-article").innerText();

    await navigateToChapter(page, "funding-script");
    const content2 = await page.getByTestId("container-article").innerText();

    expect(content1).not.toBe(content2);
  });

  test("deep-link to a chapter via URL path", async ({ page }) => {
    await page.goto("/lightning-tutorial/signing");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const text = await page.getByTestId("container-article").innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar highlights active chapter", async ({ page }) => {
    await navigateToChapter(page, "funding-script");

    const activeBtn = page.getByTestId("button-chapter-funding-script");
    await expect(activeBtn).toBeVisible();
  });

  test("prev/next navigation links work", async ({ page }) => {
    await navigateToChapter(page, "protocols-fairness");

    const nextLink = page.getByTestId("link-next");
    await expect(nextLink).toBeVisible();
    await nextLink.click();
    await page.waitForTimeout(500);

    // Should have navigated away from protocols-fairness
    await expect(page).not.toHaveURL(/\/protocols-fairness$/);
  });

  test("no JS errors across chapter navigations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const chaptersToVisit = ["protocols-fairness", "funding-script", "signing", "revocation-keys"];
    for (const ch of chaptersToVisit) {
      await navigateToChapter(page, ch);
    }

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("sidebar collapse/expand works", async ({ page }) => {
    const collapseBtn = page.getByTestId("button-sidebar-collapse");
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await page.waitForTimeout(300);

    // Click again to expand
    await collapseBtn.click();
    await page.waitForTimeout(300);

    // Section headers should be visible again
    await expect(page.getByTestId("text-section-introduction")).toBeVisible();
  });
});
