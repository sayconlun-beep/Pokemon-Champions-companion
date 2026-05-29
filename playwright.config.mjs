import { defineConfig } from '@playwright/test';

const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  : {};

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    launchOptions,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  },
  webServer: {
    command: 'node scripts/serve-spa.mjs',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
