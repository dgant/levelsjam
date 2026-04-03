const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test('loads the flight scaffold without runtime errors', async ({ page }) => {
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

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(0)
  await expect(page.locator('.start-button')).toHaveCount(0)
  await expect(page.getByText('Cursor / levels.io jam')).toHaveCount(0)
  await expect(page.getByText('WebGL ready')).toHaveCount(0)

  await page.mouse.move(400, 300)
  await page.waitForTimeout(500)

  const screenshot = PNG.sync.read(await page.screenshot())
  const pixelOffset =
    ((Math.floor(screenshot.height / 2) * screenshot.width) +
      Math.floor(screenshot.width / 2)) *
    4

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(
    screenshot.data[pixelOffset] +
      screenshot.data[pixelOffset + 1] +
      screenshot.data[pixelOffset + 2]
  ).toBeGreaterThan(30)
})
