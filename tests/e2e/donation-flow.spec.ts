import { test, expect } from "@playwright/test";
import { navigateToChapter } from "./helpers";

test.describe("Donation flow", () => {
  test("Pay It Forward chapter loads", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });

    await navigateToChapter(page, "pay-it-forward");

    // Should render the donation/pay-it-forward content
    const article = page.getByTestId("container-article");
    await expect(article).toBeVisible();
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(50);
  });

  test("donation wall or donation content renders", async ({ page }) => {
    await page.goto("/lightning-tutorial?chapter=pay-it-forward");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    // The pay-it-forward section should have some donation-related UI
    const article = page.getByTestId("container-article");
    const text = await article.innerText();
    // Should mention donations, sats, or pay it forward
    const hasDonationContent =
      text.toLowerCase().includes("donat") ||
      text.toLowerCase().includes("sat") ||
      text.toLowerCase().includes("pay it forward") ||
      text.toLowerCase().includes("lightning");
    expect(hasDonationContent).toBe(true);
  });
});
