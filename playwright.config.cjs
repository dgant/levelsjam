const { defineConfig } = require('@playwright/test')

const port = Number(process.env.PLAYWRIGHT_PORT ?? 42731)
const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1'
const baseURL = `http://${host}:${port}`

module.exports = defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.cjs$/,
  reporter: [
    ['line'],
    ['./scripts/playwright-progress-reporter.cjs']
  ],
  timeout: 30_000,
  use: {
    baseURL,
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
    command: `node scripts/serve-root.cjs ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
