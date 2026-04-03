const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4273',
    headless: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'node scripts/serve-root.cjs 4273',
    port: 4273,
    reuseExistingServer: true,
    timeout: 120_000
  }
})
