const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.cjs$/,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:42731',
    headless: true,
    launchOptions: {
      args: [
        '--use-angle=d3d11',
        '--use-gl=angle',
        '--enable-gpu',
        '--enable-gpu-rasterization',
        '--ignore-gpu-blocklist',
        '--disable-software-rasterizer'
      ]
    },
    viewport: { width: 800, height: 450 }
  },
  webServer: {
    command: 'node scripts/serve-root.cjs 42731',
    port: 42731,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
