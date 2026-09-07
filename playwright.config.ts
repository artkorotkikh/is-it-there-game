import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true,
  },
});
