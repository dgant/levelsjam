const { expect, test } = require('@playwright/test')

test.setTimeout(45_000)

test('default scene benchmark stays at or above 120 FPS', async ({ page }) => {
  const consoleErrors = []
  const pageErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => {
      return page.locator('.loading-overlay').getAttribute('data-loading-complete')
    }, {
      timeout: 12_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  await expect
    .poll(async () => {
      return page.evaluate(() => typeof window.__levelsjamBenchmark)
    }, {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toBe('function')

  await page.waitForTimeout(500)

  const benchmark = await page.evaluate(async () => {
    return window.__levelsjamBenchmark(90)
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(benchmark.averageFrameMs).toBeGreaterThan(0)
  expect(benchmark.fps).toBeGreaterThanOrEqual(120)
})
