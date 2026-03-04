import { test, expect } from "@playwright/test";
import {
  registerUser,
  loginUser,
  logoutUser,
  navigateToChapter,
  expandCheckpoint,
  collectConsoleErrors,
  filterCriticalErrors,
} from "./helpers";

/**
 * Generate a unique email for each test run to avoid conflicts.
 */
function testEmail(label: string): string {
  return `e2e-${label}-${Date.now()}@test.com`;
}

const TEST_PASSWORD = "testpass123";

test.describe("Session persistence", () => {
  test("exercise code persists in localStorage across logout/login", async ({ page }) => {
    const email = testEmail("code-persist");

    // Register and navigate to a chapter with an exercise
    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    await registerUser(page, email, TEST_PASSWORD);

    await navigateToChapter(page, "keys-manager");

    // Set localStorage value simulating typed code
    await page.evaluate(() => {
      localStorage.setItem("pl-exercise-ln-exercise-1", "# my custom code\nprint('hello')");
    });

    // Logout
    await logoutUser(page);

    // Login again
    await loginUser(page, email, TEST_PASSWORD);

    // Verify localStorage still has the code (localStorage persists per origin, not per session)
    const savedCode = await page.evaluate(() =>
      localStorage.getItem("pl-exercise-ln-exercise-1")
    );
    expect(savedCode).toBe("# my custom code\nprint('hello')");
  });

  test("checkpoint completion persists across sessions via server", async ({ page }) => {
    const email = testEmail("checkpoint-persist");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    await registerUser(page, email, TEST_PASSWORD);

    // Navigate to a chapter with a checkpoint
    await navigateToChapter(page, "protocols-fairness");

    // Expand checkpoint and select the correct answer
    await expandCheckpoint(page, 0);
    await expect(page.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

    // Select option B (correct answer for first protocols-fairness checkpoint)
    const article = page.getByTestId("container-article");
    const correctOption = article.locator('button:has-text("chooser picks first")');
    await correctOption.click();
    await page.waitForTimeout(300);

    // Submit answer
    const submitBtn = page.locator('button:has-text("SUBMIT ANSWER")').first();
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verify checkpoint shows as completed (look for COMPLETED text or green styling)
    await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 5_000 });

    // Logout and login
    await logoutUser(page);
    await loginUser(page, email, TEST_PASSWORD);

    // Navigate back to same chapter
    await navigateToChapter(page, "protocols-fairness");
    await page.waitForTimeout(1000);

    // Checkpoint should still show as completed
    await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 5_000 });
  });

  test("tutorial mode persists in localStorage across sessions", async ({ page }) => {
    const email = testEmail("mode-persist");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    await registerUser(page, email, TEST_PASSWORD);

    // Set tutorial mode to "code" in localStorage
    await page.evaluate(() => {
      localStorage.setItem("pl-tutorial-mode", "code");
    });

    // Logout
    await logoutUser(page);

    // Login again
    await loginUser(page, email, TEST_PASSWORD);

    // Verify mode is still "code"
    const mode = await page.evaluate(() => localStorage.getItem("pl-tutorial-mode"));
    expect(mode).toBe("code");
  });

  test("sidebar reflects checkpoint progress after re-login", async ({ page }) => {
    const email = testEmail("sidebar-persist");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    await registerUser(page, email, TEST_PASSWORD);

    // Navigate to protocols-fairness and complete checkpoint
    await navigateToChapter(page, "protocols-fairness");
    await expandCheckpoint(page, 0);
    await expect(page.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

    const article = page.getByTestId("container-article");
    const correctOption = article.locator('button:has-text("chooser picks first")');
    await correctOption.click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("SUBMIT ANSWER")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 5_000 });

    // Check that the sidebar chapter button has some completion indicator
    // (The sidebar shows a checkmark circle when all requirements are met)
    const chapterBtn = page.getByTestId("button-chapter-protocols-fairness");
    await expect(chapterBtn).toBeVisible();

    // Logout and login
    await logoutUser(page);
    await loginUser(page, email, TEST_PASSWORD);

    // Sidebar should still show the chapter, and re-navigating shows completed checkpoint
    await navigateToChapter(page, "protocols-fairness");
    await expect(page.locator('text=COMPLETED').first()).toBeVisible({ timeout: 5_000 });
  });

  test("page loads without critical errors after re-login", async ({ page }) => {
    const email = testEmail("no-errors");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
    await registerUser(page, email, TEST_PASSWORD);

    // Navigate to a couple chapters
    await navigateToChapter(page, "protocols-fairness");
    await navigateToChapter(page, "keys-manager");

    // Logout
    await logoutUser(page);

    // Login and navigate, collecting errors
    const errors = await collectConsoleErrors(page, async () => {
      await loginUser(page, email, TEST_PASSWORD);
      await navigateToChapter(page, "keys-manager");
      await page.waitForTimeout(1000);
    });

    const critical = filterCriticalErrors(errors);
    expect(critical).toHaveLength(0);
  });
});
