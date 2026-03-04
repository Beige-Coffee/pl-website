import { Page, expect } from "@playwright/test";

/**
 * Navigate to a specific chapter by clicking its sidebar button.
 * Waits for content to render after navigation.
 */
export async function navigateToChapter(page: Page, chapterId: string) {
  const btn = page.getByTestId(`button-chapter-${chapterId}`);
  await btn.click();
  // Wait for the article content to update
  await page.getByTestId("container-article").waitFor({ state: "visible" });
  // Small settle time for markdown rendering
  await page.waitForTimeout(500);
}

/**
 * Wait for Pyodide to finish loading.
 * Looks for the "RUN TESTS" button text (which replaces "LOADING PYTHON...").
 */
export async function waitForPyodide(page: Page) {
  await page.getByText("RUN TESTS", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

/**
 * Get the text content of the CodeMirror editor.
 */
export async function getEditorContent(page: Page): Promise<string> {
  return page.locator(".cm-content").first().innerText();
}

/**
 * Type into the CodeMirror editor by focusing it and using keyboard input.
 * Clears existing editable content first.
 */
export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(".cm-content").first();
  await editor.click();
  // Select all editable text and replace
  await page.keyboard.press("Meta+a");
  await page.keyboard.type(text, { delay: 10 });
}

/**
 * Expand a collapsed checkpoint by clicking on it.
 * Checkpoints render as a "CHECKPOINT Knowledge Check" button that must be clicked to expand.
 */
export async function expandCheckpoint(page: Page, index = 0) {
  const checkpointButtons = page.locator('button:has-text("CHECKPOINT")');
  await checkpointButtons.nth(index).click();
  await page.waitForTimeout(300);
}

/**
 * Collect JS console errors during a callback.
 * Returns the list of errors encountered.
 */
export async function collectConsoleErrors(
  page: Page,
  callback: () => Promise<void>
): Promise<string[]> {
  const errors: string[] = [];
  const handler = (err: Error) => errors.push(err.message);
  page.on("pageerror", handler);
  await callback();
  page.off("pageerror", handler);
  return errors;
}

/**
 * Expand a collapsed exercise by clicking on its "EXERCISE" button.
 * Exercises render as collapsible items similar to checkpoints.
 */
export async function expandExercise(page: Page, index = 0) {
  const exerciseButtons = page.locator('button:has-text("EXERCISE")');
  await exerciseButtons.nth(index).click();
  await page.waitForTimeout(500);
}

/**
 * Assert no critical JS errors on the page.
 * Filters out network/fetch errors which are expected in dev.
 */
export function filterCriticalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes("fetch") &&
      !e.includes("network") &&
      !e.includes("Failed to load") &&
      !e.includes("NetworkError") &&
      !e.includes("ERR_CONNECTION_REFUSED")
  );
}

// ── Auth helpers ──

/**
 * Register a new user via the UI modal.
 * Opens the login modal, switches to register tab, fills form, submits.
 * Waits for modal to close (indicating success).
 */
export async function registerUser(page: Page, email: string, password: string) {
  // Click LOGIN button to open modal
  const loginBtn = page.locator('button:has-text("LOGIN")').first();
  await loginBtn.click();
  await expect(page.getByTestId("button-choose-register")).toBeVisible({ timeout: 5_000 });

  // Click REGISTER
  await page.getByTestId("button-choose-register").click();
  await expect(page.getByTestId("input-register-email")).toBeVisible({ timeout: 3_000 });

  // Fill form and submit
  await page.getByTestId("input-register-email").fill(email);
  await page.getByTestId("input-register-password").fill(password);
  await page.getByTestId("button-register-submit").click();

  // Wait for modal to close (registration success shows verification message then auto-closes,
  // or we wait for the profile button to appear indicating logged-in state)
  await expect(page.getByTestId("button-profile")).toBeVisible({ timeout: 10_000 });
}

/**
 * Log in an existing user via the UI modal.
 * Opens the login modal, switches to login tab, fills form, submits.
 */
export async function loginUser(page: Page, email: string, password: string) {
  const loginBtn = page.locator('button:has-text("LOGIN")').first();
  await loginBtn.click();
  await expect(page.getByTestId("button-choose-login")).toBeVisible({ timeout: 5_000 });

  // Click LOG IN
  await page.getByTestId("button-choose-login").click();
  await expect(page.getByTestId("input-email")).toBeVisible({ timeout: 3_000 });

  // Fill form and submit
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-auth-submit").click();

  // Wait for profile button (logged-in state)
  await expect(page.getByTestId("button-profile")).toBeVisible({ timeout: 10_000 });
}

/**
 * Log out the current user via the profile dropdown.
 */
export async function logoutUser(page: Page) {
  await page.getByTestId("button-profile").click();
  await expect(page.getByTestId("container-profile-dropdown")).toBeVisible({ timeout: 3_000 });
  await page.getByTestId("button-logout").click();

  // Wait for LOGIN button to reappear (logged-out state)
  await expect(page.locator('button:has-text("LOGIN")').first()).toBeVisible({ timeout: 5_000 });
}

// ── Node terminal helpers ──

/**
 * Open the node terminal panel via the TOOLS dropdown.
 * Clicks TOOLS > Bitcoin Node, waits for terminal input to be ready.
 */
export async function openNodeTerminal(page: Page) {
  // Open TOOLS dropdown
  await page.locator('button:has-text("TOOLS")').first().click();
  await page.waitForTimeout(300);
  // Click "Bitcoin Node" in the dropdown
  await page.locator('button:has-text("Bitcoin Node")').click();
  // Wait for terminal input to be visible (placeholder changes when node is ready)
  await expect(
    page.locator('input[placeholder="type a command..."]').first()
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Execute a command in the node terminal.
 * Types the command, presses Enter, waits for output to appear.
 */
export async function nodeExec(page: Page, command: string): Promise<void> {
  const input = page.locator('input[placeholder="type a command..."]').first();
  await input.fill(command);
  await input.press("Enter");
  // Wait for the command to execute and output to render
  await page.waitForTimeout(3000);
}

/**
 * Run a transaction generator by clicking its generate/run button.
 * Identifies the generator by its title text, then clicks the action button.
 * Waits for the output to appear.
 */
export async function runTxGenerator(page: Page, title: string): Promise<void> {
  // Find the generator card by its title, then click the action button within it
  const card = page.locator(`text=${title}`).first().locator("..").locator("..");
  const btn = card.locator('button:has-text("Generate"), button:has-text("Get Transaction"), button:has-text("Calculate")').first();
  await btn.click();
  await page.waitForTimeout(3000);
}
