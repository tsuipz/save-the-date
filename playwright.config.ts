import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Full flow is ~5900ms (zoom 3900ms + unmount 2000ms) — 15s covers that
  // plus navigation and assertion overhead.
  timeout: 15_000,

  // waitFor / expect polls must outlast the 5900ms EnterScreen unmount.
  expect: { timeout: 8_000 },

  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // Tests call page.goto('/save-the-date/'); this baseURL fills in the host.
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    // Bare '/' 404s because vite.config.ts sets base: '/save-the-date/'.
    // Playwright polls this URL to know when the server is ready.
    url: 'http://localhost:5173/save-the-date/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
