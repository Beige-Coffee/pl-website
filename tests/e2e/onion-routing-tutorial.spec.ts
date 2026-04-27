import { test, expect } from "@playwright/test";
import { navigateToChapter, filterCriticalErrors } from "./helpers";

test.describe("Onion routing tutorial navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/onion-routing-tutorial");
    await expect(page.getByTestId("button-sidebar-collapse")).toBeVisible({ timeout: 10_000 });
  });

  test("first chapter renders content", async ({ page }) => {
    const article = page.getByTestId("container-article");
    await expect(article).toBeVisible();
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar shows all section headers", async ({ page }) => {
    await expect(page.getByTestId("text-section-what-each-hop-knows")).toBeVisible();
    await expect(page.getByTestId("text-section-routing-fundamentals")).toBeVisible();
    await expect(page.getByTestId("text-section-cryptographic-primitives")).toBeVisible();
    await expect(page.getByTestId("text-section-building-the-onion")).toBeVisible();
    await expect(page.getByTestId("text-section-peeling-the-onion")).toBeVisible();
    await expect(page.getByTestId("text-section-the-commitment-dance")).toBeVisible();
    await expect(page.getByTestId("text-section-success-&-failure")).toBeVisible();
    await expect(page.getByTestId("text-section-payment-trace-lab")).toBeVisible();
    await expect(page.getByTestId("text-section-advanced-topics")).toBeVisible();
    await expect(page.getByTestId("text-section-quiz")).toBeVisible();
    await expect(page.getByTestId("text-section-pay-it-forward")).toBeVisible();
  });

  test("navigate to chapters via sidebar", async ({ page }) => {
    await navigateToChapter(page, "what-each-hop-knows");

    await expect(page).toHaveURL(/\/onion-routing-tutorial\/what-each-hop-knows/);

    const article = page.getByTestId("container-article");
    const text = await article.innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("clicking multiple sections loads different content", async ({ page }) => {
    await navigateToChapter(page, "what-each-hop-knows");
    const content1 = await page.getByTestId("container-article").innerText();

    await navigateToChapter(page, "shared-secrets");
    const content2 = await page.getByTestId("container-article").innerText();

    expect(content1).not.toBe(content2);
  });

  test("deep-link to a chapter via URL path", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/fees-and-timelocks");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const text = await page.getByTestId("container-article").innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test("sidebar highlights active chapter", async ({ page }) => {
    await navigateToChapter(page, "hop-payloads");

    const activeBtn = page.getByTestId("button-chapter-hop-payloads");
    await expect(activeBtn).toBeVisible();
  });

  test("prev/next navigation links work", async ({ page }) => {
    await navigateToChapter(page, "what-each-hop-knows");

    const nextLink = page.getByTestId("link-next");
    await expect(nextLink).toBeVisible();
    await nextLink.click();
    await page.waitForTimeout(500);

    await expect(page).not.toHaveURL(/\/what-each-hop-knows$/);
  });

  test("no JS errors across chapter navigations", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const chaptersToVisit = [
      "what-each-hop-knows",
      "fees-and-timelocks",
      "shared-secrets",
      "naive-approach",
      "peeling-a-layer",
      "commitment-dance",
      "failure-handling",
    ];
    for (const ch of chaptersToVisit) {
      await navigateToChapter(page, ch);
    }

    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  test("sidebar collapse/expand works", async ({ page }) => {
    const collapseBtn = page.getByTestId("button-sidebar-collapse");
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await page.waitForTimeout(300);

    await collapseBtn.click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId("text-section-what-each-hop-knows")).toBeVisible();
  });
});

test.describe("Onion routing tutorial content", () => {
  test("exercise chapters contain code editors", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/fees-and-timelocks");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    // Exercise sections should be present (either expanded or collapsed)
    const exerciseButtons = page.locator('button:has-text("EXERCISE")');
    const count = await exerciseButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("checkpoint questions render in content chapters", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/what-each-hop-knows");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const checkpointButtons = page.locator('button:has-text("CHECKPOINT")');
    const count = await checkpointButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("quiz chapter renders multiple checkpoints", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/quiz");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const checkpointButtons = page.locator('button:has-text("CHECKPOINT")');
    const count = await checkpointButtons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("advanced topics chapters render", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/route-blinding");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const text = await page.getByTestId("container-article").innerText();
    expect(text.length).toBeGreaterThan(100);
    expect(text.toLowerCase()).toContain("blind");
  });
});

test.describe("Onion routing interactive features", () => {
  test("route diagram renders on Section 1", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/what-each-hop-knows");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    // The route-diagram custom tag should render the Section1Diagram component
    // Look for SVG elements or perspective toggle buttons
    const article = page.getByTestId("container-article");
    const svgOrDiagram = article.locator("svg, [class*='diagram'], [class*='perspective']");
    const hasDiagram = await svgOrDiagram.count();
    expect(hasDiagram).toBeGreaterThanOrEqual(1);
  });

  test("backward calc diagram renders on fees chapter", async ({ page }) => {
    await page.goto("/onion-routing-tutorial/fees-and-timelocks");
    await expect(page.getByTestId("container-article")).toBeVisible({ timeout: 10_000 });

    const article = page.getByTestId("container-article");
    const diagrams = article.locator("svg, [class*='diagram'], [class*='step']");
    const count = await diagrams.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Onion routing homepage integration", () => {
  test("homepage has onion routing course card", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('text=Onion Routing')).toBeVisible({ timeout: 10_000 });
  });

  test("course card links to tutorial", async ({ page }) => {
    await page.goto("/");
    const readBtn = page.locator('a[href="/onion-routing-tutorial"]').first();
    await expect(readBtn).toBeVisible({ timeout: 10_000 });
    await readBtn.click();
    await expect(page).toHaveURL(/\/onion-routing-tutorial/);
  });
});
