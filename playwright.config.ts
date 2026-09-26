import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: a real browser against the production build, talking to a
 * local Supabase stack (see the e2e job in .github/workflows/ci.yml).
 *
 * The app is built beforehand with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * pointing at the local stack, then served by `vite preview` on :5173 — the
 * origin the local auth config allows for magic-link redirects.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
