import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("tutorial page has LOGIN button", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('button:has-text("LOGIN")');
    await expect(loginBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("clicking LOGIN opens modal with LOG IN and REGISTER options", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('button:has-text("LOGIN")').first();
    await loginBtn.click();
    await page.waitForTimeout(500);

    // The login modal shows a "choose" screen with LOG IN and REGISTER buttons
    await expect(page.getByTestId("button-choose-login")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("button-choose-register")).toBeVisible({ timeout: 3_000 });
  });

  test("clicking LOG IN shows email and password form", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(1000);

    // Open login modal
    await page.locator('button:has-text("LOGIN")').first().click();
    await expect(page.getByTestId("button-choose-login")).toBeVisible({ timeout: 3_000 });

    // Click LOG IN option using data-testid
    await page.getByTestId("button-choose-login").click();
    await page.waitForTimeout(500);

    // Should show email and password fields
    await expect(page.getByTestId("input-email")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("input-password")).toBeVisible({ timeout: 3_000 });
  });

  test("clicking REGISTER shows registration form", async ({ page }) => {
    await page.goto("/lightning-tutorial");
    await page.waitForTimeout(1000);

    // Open login modal
    await page.locator('button:has-text("LOGIN")').first().click();
    await expect(page.getByTestId("button-choose-register")).toBeVisible({ timeout: 3_000 });

    // Click REGISTER option using data-testid
    await page.getByTestId("button-choose-register").click();
    await page.waitForTimeout(500);

    // Should show registration form with email and password
    await expect(page.getByTestId("input-register-email")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("input-register-password")).toBeVisible({ timeout: 3_000 });
  });
});
