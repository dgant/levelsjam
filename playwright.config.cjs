const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.cjs$/,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:42731',
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: 'node scripts/serve-root.cjs 42731',
    port: 42731,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
