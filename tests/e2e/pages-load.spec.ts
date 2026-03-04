import { test, expect } from "@playwright/test";
import { filterCriticalErrors } from "./helpers";

test.describe("Pages load without errors", () => {
  test("home page loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // Should have some visible text content
    await expect(page.locator("h1, h2, [class*='hero']").first()).toBeVisible({ timeout: 10_000 });

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("about page loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/about");
    await expect(page.locator("body")).toBeVisible();

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("lightning tutorial loads", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/lightning-tutorial");
    // Sidebar should render
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    // Article content should render
    await expect(page.getByTestId("container-article")).toBeVisible();

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("404 page for bad route", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    // Should show the app shell (not a server error)
    await expect(page.locator("body")).toBeVisible();
  });
});
