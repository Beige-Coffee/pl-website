import { test, expect } from "@playwright/test";
import { navigateToChapter, expandCheckpoint } from "./helpers";

test.describe("Noise checkpoint flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/noise-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
  });

  test("checkpoint-group renders on crypto-primitives chapter", async ({ page }) => {
    await navigateToChapter(page, "crypto-primitives");

    // crypto-primitives has a checkpoint-group that renders as a single collapsible
    const checkpointBtns = page.locator('button:has-text("CHECKPOINT")');
    await expect(checkpointBtns.first()).toBeVisible({ timeout: 5_000 });
  });

  test("clicking checkpoint-group expands and shows questions", async ({ page }) => {
    await navigateToChapter(page, "crypto-primitives");
    await expandCheckpoint(page, 0);

    const submitBtn = page.locator('button:has-text("SUBMIT")').first();
    await expect(submitBtn).toBeVisible({ timeout: 3_000 });
  });

  test("checkpoint options are selectable", async ({ page }) => {
    await navigateToChapter(page, "crypto-primitives");
    await expandCheckpoint(page, 0);
    await expect(page.locator('button:has-text("SUBMIT")').first()).toBeVisible({ timeout: 3_000 });

    // After expanding, there should be multiple buttons (questions + options + submit)
    const article = page.getByTestId("container-article");
    const allButtons = article.locator("button");
    const count = await allButtons.count();
    expect(count).toBeGreaterThan(3);
  });

  test("individual checkpoint renders on handshake-setup chapter", async ({ page }) => {
    await navigateToChapter(page, "handshake-setup");

    const checkpointBtns = page.locator('button:has-text("CHECKPOINT")');
    await expect(checkpointBtns.first()).toBeVisible({ timeout: 5_000 });
  });

  test("individual checkpoint renders on sending-messages chapter", async ({ page }) => {
    await navigateToChapter(page, "sending-messages");

    const checkpointBtns = page.locator('button:has-text("CHECKPOINT")');
    await expect(checkpointBtns.first()).toBeVisible({ timeout: 5_000 });
  });
});
