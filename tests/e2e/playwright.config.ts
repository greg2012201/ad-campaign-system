import { defineConfig } from "@playwright/test";

const workers = Number(process.env["E2E_WORKERS"] || 1);
const retries = Number(process.env["E2E_RETRIES"] || 0);
const browsers = (process.env["E2E_BROWSERS"] || "chromium")
  .split(",")
  .map((b) => b.trim());
const headed = process.env["E2E_HEADED"] === "true";
const trace = (process.env["E2E_TRACE"] || "on-first-retry") as
  | "on"
  | "off"
  | "on-first-retry";
const baseURL =
  process.env["E2E_BASE_URL"] ||
  process.env["E2E_UI_URL"] ||
  "http://localhost:5200";

const browserToDevice: Record<string, string> = {
  chromium: "Desktop Chrome",
  firefox: "Desktop Firefox",
  webkit: "Desktop Safari",
};

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries,
  workers,
  reporter: "html",
  use: {
    baseURL,
    trace,
    headless: !headed,
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  projects: browsers.map((browser) => ({
    name: browser,
    use: { browserName: browser as "chromium" | "firefox" | "webkit" },
    ...(browserToDevice[browser] ? {} : {}),
  })),
});
