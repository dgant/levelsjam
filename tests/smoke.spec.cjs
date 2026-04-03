const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test('loads the flight scaffold without runtime errors', async ({ page }) => {
  const consoleErrors = []
  const pageErrors = []
  const resourceUrls = new Set()

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  page.on('response', (response) => {
    resourceUrls.add(response.url())
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
    [...resourceUrls].some((url) => url.includes('grass_1_basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('ground_14_Basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some(
      (url) =>
        url.includes('textures/grass_1.webp') ||
        url.includes('textures/ground_14.webp')
    )
  ).toBe(false)
  expect(
    screenshot.data[pixelOffset] +
      screenshot.data[pixelOffset + 1] +
      screenshot.data[pixelOffset + 2]
  ).toBeGreaterThan(30)
})
