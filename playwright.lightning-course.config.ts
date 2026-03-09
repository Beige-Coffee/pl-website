import { defineConfig } from "@playwright/test";

const skipLocalWebServer = process.env.PW_LIGHTNING_COURSE_NO_WEBSERVER === "1";

export default defineConfig({
  testDir: "tests/e2e/lightning-course",
  timeout: 30 * 60_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/lightning-course/playwright-report.json" }],
  ],
  outputDir: "test-results/lightning-course/artifacts",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: skipLocalWebServer
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 30_000,
      },
  projects: [
    {
      name: "local-preflight",
      use: {
        baseURL: process.env.PL_LOCAL_BASE_URL || "http://localhost:3000",
      },
    },
    {
      name: "production-course",
      use: {
        baseURL: process.env.PL_PROD_BASE_URL || "https://programminglightning.com",
      },
    },
  ],
});
