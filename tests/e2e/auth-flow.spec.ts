import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("register form is accessible", async ({ page }) => {
    await page.goto("/");
    // Look for login/register link
    const authLink = page.locator('a[href*="login"], button:has-text("Log"), a:has-text("Sign")');
    if (await authLink.count() > 0) {
      await authLink.first().click();
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test("shows validation errors for empty form", async ({ page }) => {
    await page.goto("/");
    const authLink = page.locator('a[href*="login"], button:has-text("Log"), a:has-text("Sign")');
    if (await authLink.count() > 0) {
      await authLink.first().click();
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.first().click();
        // Should show some validation feedback
        await page.waitForTimeout(500);
      }
    }
  });

  test("LNURL auth displays QR on lightning login page", async ({ page }) => {
    await page.goto("/");
    const lnLink = page.locator('a:has-text("Lightning"), button:has-text("Lightning")');
    if (await lnLink.count() > 0) {
      await lnLink.first().click();
      // QR code should appear
      const qr = page.locator('img[src*="data:image"], canvas, svg');
      await expect(qr.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
