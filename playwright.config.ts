import { defineConfig, devices } from "@playwright/test";

// Phone-first end-to-end tests. Set PW_CHROMIUM_PATH to use an existing Chromium
// instead of the one `npx playwright install` downloads.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3123",
    ...devices["iPhone 13"],
    browserName: "chromium",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "rm -rf .data/e2e && npm run build && npm start -- -p 3123",
    url: "http://localhost:3123",
    reuseExistingServer: false,
    timeout: 180_000,
    // Emails are written to files instead of being sent.
    env: {
      ANTHROPIC_API_KEY: "",
      STREET_FIX_RATE_LIMIT: "10000",
      MAIL_OUTBOX_DIR: ".data/e2e/outbox",
      STREET_FIX_DATA_DIR: ".data/e2e/reports",
      CRON_SECRET: "e2e-secret",
    },
  },
});
