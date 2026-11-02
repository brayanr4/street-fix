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
    command: "npm run build && npm start -- -p 3123",
    url: "http://localhost:3123",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ANTHROPIC_API_KEY: "", STREET_FIX_RATE_LIMIT: "10000" },
  },
});
