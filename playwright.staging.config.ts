import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against the real staging site (staging.ekkle.org), run by CI
 * after each staging deploy and before production. They sign in as the demo
 * personas (scripts/staging/personas.mjs) with DEMO_PASSWORD.
 */
export default defineConfig({
  testDir: './e2e-staging',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.STAGING_URL || 'https://staging.ekkle.org',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
