// One browser smoke test (review P3 b): the production build with the
// simulated boards (`VITE_ENABLE_MOCKS=1`), served by `vite preview`, in
// Chromium only. Run it with `npm run e2e` (scripts/e2e.sh builds first and
// installs the browser); E2E_CHROMIUM=<path> uses a Chromium already on the
// machine instead of Playwright's.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.E2E_CHROMIUM || undefined } },
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
  },
});
