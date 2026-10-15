import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.TESSERA_E2E_BASE_URL ?? "http://127.0.0.1:80",
    headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: process.env.TESSERA_E2E_CHROMIUM ?? "/repl/tools/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
