import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Mayordomía PWA e2e tests.
 *
 * Runs against `vite preview` so the e2e suite exercises the production
 * build (precached service worker, hashed assets, etc.) rather than the
 * raw dev server.
 *
 * Mock mode is forced via env so the suite does not need a real Apps
 * Script URL or a live Google client ID. The CI workflow reuses this
 * behaviour.
 */
export default defineConfig({
  testDir: './e2e',
  // Don't waste CI time on retries — the suite is intentionally small.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The dev server uses `base: '/'` per vite.config.ts (only `build`
    // uses `/Mayordomia/` for GitHub Pages). The dev path matches what
    // Vite serves locally so baseURL stays at the root.
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_USE_MOCK_PUBLIC: 'true',
      VITE_APPS_SCRIPT_URL: '',
      VITE_GOOGLE_CLIENT_ID: 'e2e-mock-client-id',
    },
  },
});
