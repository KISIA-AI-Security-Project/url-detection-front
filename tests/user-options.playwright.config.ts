import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: ["user-options.spec.ts", "builder-replay.spec.js"],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5194",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5194 --strictPort",
    url: "http://127.0.0.1:5194",
    reuseExistingServer: false,
  },
});
