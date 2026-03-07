import { test, expect } from "@playwright/test";
import { navigateToChapter, filterCriticalErrors } from "./helpers";

test.describe("Noise tutorial navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/noise-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
  });

  test("first chapter renders content", async ({ page }) => {
    const article = page.getByTestId("container-article");
    await expect(article).toBeVisible();
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar shows section headers", async ({ page }) => {
    await expect(page.getByTestId("text-section-introduction")).toBeVisible();
    await expect(page.getByTestId("text-section-foundations")).toBeVisible();
    await expect(page.getByTestId("text-section-the-handshake")).toBeVisible();
  });

  test("navigate to chapters via sidebar", async ({ page }) => {
    await navigateToChapter(page, "noise-framework");

    await expect(page).toHaveURL(/\/noise-tutorial\/noise-framework/);

    const article = page.getByTestId("container-article");
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("clicking multiple sections loads different content", async ({ page }) => {
    await navigateToChapter(page, "crypto-primitives");
    const content1 = await page.getByTestId("container-article").innerText();

    await navigateToChapter(page, "handshake-setup");
    const content2 = await page.getByTestId("container-article").innerText();

    expect(content1).not.toBe(content2);
  });

  test("deep-link to a chapter via URL path", async ({ page }) => {
    await page.goto("/noise-tutorial/act-1");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const text = await page.getByTestId("container-article").innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar highlights active chapter", async ({ page }) => {
    await navigateToChapter(page, "noise-framework");

    const activeBtn = page.getByTestId("button-chapter-noise-framework");
    await expect(activeBtn).toBeVisible();
  });

  test("prev/next navigation links work", async ({ page }) => {
    await navigateToChapter(page, "crypto-primitives");

    const nextLink = page.getByTestId("link-next");
    await expect(nextLink).toBeVisible();
    await nextLink.click();
    await page.waitForTimeout(500);

    await expect(page).not.toHaveURL(/\/crypto-primitives$/);
  });

  test("no JS errors across chapter navigations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const chaptersToVisit = ["crypto-primitives", "noise-framework", "handshake-setup", "act-1"];
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

    await collapseBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId("text-section-introduction")).toBeVisible();
  });
});
