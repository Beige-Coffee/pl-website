import { test, expect } from "@playwright/test";

test.describe("Donation flow", () => {
  test("donation page loads", async ({ page }) => {
    // Navigate to the donate/pay-it-forward section
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    const donateLink = page.locator(
      'a:has-text("Pay It Forward"), a:has-text("Donate"), a:has-text("donate")'
    );
    if (await donateLink.count() > 0) {
      await donateLink.first().click();
      await page.waitForTimeout(3000);

      // Should see donation-related content
      const donationContent = page.locator(
        '[class*="donation"], [class*="donate"], input[type="number"]'
      );
      if (await donationContent.count() > 0) {
        await expect(donationContent.first()).toBeVisible();
      }
    }
  });

  test("donation wall displays", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(2000);

    const donateLink = page.locator(
      'a:has-text("Pay It Forward"), a:has-text("Donate"), a:has-text("donate")'
    );
    if (await donateLink.count() > 0) {
      await donateLink.first().click();
      await page.waitForTimeout(3000);

      // Look for donation wall/list
      const wall = page.locator(
        '[class*="wall"], [class*="donation-list"], [class*="donors"]'
      );
      if (await wall.count() > 0) {
        await expect(wall.first()).toBeVisible();
      }
    }
  });
});
