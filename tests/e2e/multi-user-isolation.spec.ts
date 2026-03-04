import { test, expect, Browser } from "@playwright/test";
import {
  registerUser,
  navigateToChapter,
  expandCheckpoint,
} from "./helpers";

/**
 * Generate a unique email for each test run.
 */
function testEmail(label: string): string {
  return `e2e-${label}-${Date.now()}@test.com`;
}

const TEST_PASSWORD = "testpass123";

test.describe("Multi-user isolation", () => {
  test("exercise progress is isolated between users in separate contexts", async ({
    browser,
  }) => {
    // Create two independent browser contexts (separate cookies + localStorage)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const emailA = testEmail("iso-a");
      const emailB = testEmail("iso-b");

      // Register User A
      await pageA.goto("/lightning-tutorial");
      await expect(pageA.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
      await registerUser(pageA, emailA, TEST_PASSWORD);

      // Register User B
      await pageB.goto("/lightning-tutorial");
      await expect(pageB.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
      await registerUser(pageB, emailB, TEST_PASSWORD);

      // User A navigates to keys-manager and stores exercise code
      await navigateToChapter(pageA, "keys-manager");
      await pageA.evaluate(() => {
        localStorage.setItem("pl-exercise-ln-exercise-1", "# User A's solution\npass");
      });

      // User B navigates to same chapter - localStorage should be empty for this exercise
      await navigateToChapter(pageB, "keys-manager");
      const codeB = await pageB.evaluate(() =>
        localStorage.getItem("pl-exercise-ln-exercise-1")
      );
      expect(codeB).toBeNull();

      // Verify User A's code is still there
      const codeA = await pageA.evaluate(() =>
        localStorage.getItem("pl-exercise-ln-exercise-1")
      );
      expect(codeA).toBe("# User A's solution\npass");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("checkpoint answers are isolated between users", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const emailA = testEmail("cp-iso-a");
      const emailB = testEmail("cp-iso-b");

      // Register both users
      await pageA.goto("/lightning-tutorial");
      await expect(pageA.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
      await registerUser(pageA, emailA, TEST_PASSWORD);

      await pageB.goto("/lightning-tutorial");
      await expect(pageB.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
      await registerUser(pageB, emailB, TEST_PASSWORD);

      // User A navigates to protocols-fairness and completes checkpoint
      await navigateToChapter(pageA, "protocols-fairness");
      await expandCheckpoint(pageA, 0);
      await expect(pageA.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

      const articleA = pageA.getByTestId("container-article");
      const correctOptionA = articleA.locator('button:has-text("chooser picks first")');
      await correctOptionA.click();
      await pageA.waitForTimeout(300);
      await pageA.locator('button:has-text("SUBMIT ANSWER")').first().click();
      await pageA.waitForTimeout(1000);
      await expect(pageA.locator('text=COMPLETED').first()).toBeVisible({ timeout: 5_000 });

      // User B navigates to same chapter - checkpoint should NOT be completed
      await navigateToChapter(pageB, "protocols-fairness");
      await expandCheckpoint(pageB, 0);
      await expect(pageB.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

      // User B should see SUBMIT button (not COMPLETED), meaning checkpoint is unanswered
      const completedB = pageB.locator('text=COMPLETED');
      const completedCount = await completedB.count();
      expect(completedCount).toBe(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("localStorage is fully isolated between browser contexts", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      // Load the tutorial in both contexts
      await pageA.goto("/lightning-tutorial");
      await pageB.goto("/lightning-tutorial");
      await expect(pageA.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
      await expect(pageB.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });

      // User A sets various localStorage values
      await pageA.evaluate(() => {
        localStorage.setItem("pl-tutorial-mode", "code");
        localStorage.setItem("pl-exercise-ln-exercise-1", "# A's code");
        localStorage.setItem("pl-checkpoint-pubkey-compression", "1");
      });

      // User B should see none of these values
      const modeB = await pageB.evaluate(() => localStorage.getItem("pl-tutorial-mode"));
      const exerciseB = await pageB.evaluate(() => localStorage.getItem("pl-exercise-ln-exercise-1"));
      const checkpointB = await pageB.evaluate(() => localStorage.getItem("pl-checkpoint-pubkey-compression"));

      expect(modeB).toBeNull();
      expect(exerciseB).toBeNull();
      expect(checkpointB).toBeNull();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
