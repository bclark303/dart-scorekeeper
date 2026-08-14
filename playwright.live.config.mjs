import { defineConfig } from "@playwright/test";

const baseURL = process.env.LIVE_PREVIEW_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!baseURL) {
  throw new Error("LIVE_PREVIEW_URL is required.");
}
if (!bypassSecret) {
  throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is required.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "live-preview.spec.mjs",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL,
    browserName: "chromium",
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results/live-preview",
});
