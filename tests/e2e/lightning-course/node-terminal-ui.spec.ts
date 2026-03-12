import { test, expect } from "@playwright/test";
import {
  authenticateLearner,
  createLocalLearnerCredentials,
  enableCodeMode,
} from "./helpers.ts";
import { nodeExec, MOBILE_VIEWPORT } from "../helpers.ts";

/**
 * Focused UI tests for the Bitcoin Node terminal panel.
 * These verify the panel opens and renders — not transaction validity.
 */
test.describe("Node terminal UI", () => {
  test.setTimeout(3 * 60_000);

  test("desktop TOOLS opens Bitcoin Node and getblockcount returns output", async ({ page }, testInfo) => {
    const environment = testInfo.project.name.includes("production") ? "production" : "local";
    const credentials = createLocalLearnerCredentials();

    await enableCodeMode(page.context());
    await authenticateLearner(page, environment, credentials);

    // Open TOOLS dropdown via test ID
    await page.getByTestId("button-desktop-tools-toggle").click();
    await expect(page.getByTestId("button-desktop-tool-node")).toBeVisible({ timeout: 5_000 });

    // Click Bitcoin Node
    await page.getByTestId("button-desktop-tool-node").click();

    // Wait for the terminal input to appear (node is provisioned)
    const nodeInput = page.locator('input[placeholder="type a command..."]').first();
    await expect(nodeInput).toBeVisible({ timeout: 60_000 });

    // Run getblockcount and verify numeric output appears in the terminal panel
    await nodeExec(page, "getblockcount");
    const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
    await expect(terminalPanel).toContainText(/\d+/, { timeout: 15_000 });
  });

  test("mobile TOOLS FAB opens Bitcoin Node and getblockcount returns output", async ({ page }, testInfo) => {
    const environment = testInfo.project.name.includes("production") ? "production" : "local";
    const credentials = createLocalLearnerCredentials();

    await page.setViewportSize(MOBILE_VIEWPORT);
    await enableCodeMode(page.context());
    await authenticateLearner(page, environment, credentials);

    // Open via mobile FAB
    await page.getByTestId("button-mobile-tools-toggle").click();
    await expect(page.getByTestId("container-mobile-tools-menu")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("button-mobile-tool-node").click();

    // Wait for the terminal input
    const nodeInput = page.locator('input[placeholder="type a command..."]').first();
    await expect(nodeInput).toBeVisible({ timeout: 60_000 });

    // Run getblockcount and verify output
    await nodeExec(page, "getblockcount");
    const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
    await expect(terminalPanel).toContainText(/\d+/, { timeout: 15_000 });
  });
});
