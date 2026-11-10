import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    channel:
      process.env.E2E_WEBKIT === "1"
        ? undefined
        : process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: process.env.E2E_WEBKIT === "1" ? "webkit" : "chromium",
      },
    },
  ],
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
