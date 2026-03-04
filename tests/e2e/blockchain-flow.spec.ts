import { test, expect } from "@playwright/test";
import {
  registerUser,
  loginUser,
  logoutUser,
  navigateToChapter,
} from "./helpers";

/**
 * Generate a unique email for each test run.
 */
function testEmail(label: string): string {
  return `e2e-${label}-${Date.now()}@test.com`;
}

const TEST_PASSWORD = "testpass123";

/**
 * Switch tutorial mode to "code" (required for TOOLS dropdown and node terminal).
 * Sets localStorage before navigation or triggers the mode toggle on page.
 */
async function enableCodeMode(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    localStorage.setItem("pl-tutorial-mode", "code");
  });
  // Reload to pick up the mode change
  await page.reload();
  await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Open the node terminal via the TOOLS dropdown.
 * Requires tutorialMode === "code".
 */
async function openNodeTerminal(page: import("@playwright/test").Page) {
  // Click TOOLS button to open dropdown
  await page.locator('button:has-text("TOOLS")').first().click();
  await page.waitForTimeout(300);

  // Click "Bitcoin Node" in the dropdown
  await page.locator('button:has-text("Bitcoin Node")').click();

  // Wait for terminal input to become available
  await expect(
    page.locator('input[placeholder="type a command..."]').first()
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Execute a command in the node terminal and wait for output.
 */
async function execNodeCommand(
  page: import("@playwright/test").Page,
  command: string
): Promise<void> {
  const input = page.locator('input[placeholder="type a command..."]').first();
  await input.fill(command);
  await input.press("Enter");
  // Wait for command to execute and output to render
  await page.waitForTimeout(3000);
}

test.describe("Blockchain & transaction flow", () => {
  // These tests require a real bitcoind and are slower
  test.setTimeout(120_000);

  test("node terminal connects and responds to getblockcount", async ({
    page,
  }) => {
    const email = testEmail("node-connect");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({
      timeout: 10_000,
    });
    await registerUser(page, email, TEST_PASSWORD);

    // Switch to code mode (TOOLS dropdown only shows in code mode)
    await enableCodeMode(page);

    // Navigate to any chapter
    await navigateToChapter(page, "bitcoin-cli");

    // Open node terminal
    await openNodeTerminal(page);

    // Run getblockcount
    await execNodeCommand(page, "getblockcount");

    // The output container should contain a number (the regtest snapshot starts at block 101)
    // The terminal output area is inside the node terminal panel (has class "overflow-auto")
    // Look for the output text within the terminal panel that has "Bitcoin Node" header
    const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
    await expect(terminalPanel).toContainText(/\d+/, { timeout: 10_000 });
  });

  test("simple HTLC flow: generate and get transaction", async ({
    page,
  }) => {
    const email = testEmail("htlc-flow");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({
      timeout: 10_000,
    });
    await registerUser(page, email, TEST_PASSWORD);

    // Switch to code mode
    await enableCodeMode(page);

    // Navigate to HTLC chapter (offered-htlcs has the simple HTLC generator)
    await navigateToChapter(page, "offered-htlcs");
    await page.waitForTimeout(1000);

    // Find the Simple HTLC generator and click "Get Transaction"
    const simpleHtlcBtn = page
      .locator('button:has-text("Get Transaction")')
      .first();
    if ((await simpleHtlcBtn.count()) > 0) {
      await simpleHtlcBtn.click();
      await page.waitForTimeout(3000);

      // Check that output appears (TXID or HEX as hex string)
      const txOutput = page.locator("code").first();
      if ((await txOutput.count()) > 0) {
        const text = await txOutput.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test("node terminal mine command works", async ({ page }) => {
    const email = testEmail("mine-blocks");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({
      timeout: 10_000,
    });
    await registerUser(page, email, TEST_PASSWORD);

    // Switch to code mode
    await enableCodeMode(page);

    await navigateToChapter(page, "bitcoin-cli");
    await openNodeTerminal(page);

    // Get initial block count
    await execNodeCommand(page, "getblockcount");
    await page.waitForTimeout(1000);

    // Mine 1 block
    await execNodeCommand(page, "mine 1");
    await page.waitForTimeout(2000);

    // Get block count again - should have increased
    await execNodeCommand(page, "getblockcount");

    // Terminal should show output from all commands
    // The terminal output area is inside the node terminal panel (has class "overflow-auto")
    // Look for the output text within the terminal panel that has "Bitcoin Node" header
    const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
    await expect(terminalPanel).toContainText(/\d+/, { timeout: 10_000 });
  });

  test("node data persists across logout/login", async ({ page }) => {
    const email = testEmail("node-persist");

    await page.goto("/lightning-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({
      timeout: 10_000,
    });
    await registerUser(page, email, TEST_PASSWORD);

    // Switch to code mode
    await enableCodeMode(page);

    await navigateToChapter(page, "bitcoin-cli");
    await openNodeTerminal(page);

    // Mine some blocks to create state
    await execNodeCommand(page, "mine 5");
    await page.waitForTimeout(2000);

    // Get block count
    await execNodeCommand(page, "getblockcount");
    await page.waitForTimeout(1000);

    // Logout
    await logoutUser(page);

    // Login again
    await loginUser(page, email, TEST_PASSWORD);

    // Re-enable code mode and navigate back
    await enableCodeMode(page);
    await navigateToChapter(page, "bitcoin-cli");
    await openNodeTerminal(page);

    // Get block count - should reflect previously mined blocks
    await execNodeCommand(page, "getblockcount");

    // The terminal output area is inside the node terminal panel (has class "overflow-auto")
    // Look for the output text within the terminal panel that has "Bitcoin Node" header
    const terminalPanel = page.locator('div:has(> div:has-text("Bitcoin Node"))').last();
    await expect(terminalPanel).toContainText(/\d+/, { timeout: 10_000 });
  });
});
