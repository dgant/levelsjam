const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(75_000)

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
  await expect(page.locator('.fps-counter')).toContainText('FPS')
  await expect(page.locator('h1')).toHaveCount(0)
  await expect(page.locator('.start-button')).toHaveCount(0)
  await expect(page.getByText('Cursor / levels.io jam')).toHaveCount(0)
  await expect(page.getByText('WebGL ready')).toHaveCount(0)

  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible()
  await expect(page.getByLabel('Sun Elevation')).toBeVisible()

  await page.mouse.move(400, 300)
  await page.waitForTimeout(500)

  const canvas = page.locator('canvas')
  const brightScreenshot = PNG.sync.read(await canvas.screenshot())
  const pixelOffset =
    ((Math.floor(brightScreenshot.height / 2) * brightScreenshot.width) +
      Math.floor(brightScreenshot.width / 2)) *
    4
  const initialExposure = await canvas.getAttribute('data-renderer-exposure')

  await page.getByLabel('Sun Intensity').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '0.25')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(250)
  const updatedExposure = await canvas.getAttribute('data-renderer-exposure')
  const brightPixelSum =
    brightScreenshot.data[pixelOffset] +
    brightScreenshot.data[pixelOffset + 1] +
    brightScreenshot.data[pixelOffset + 2]

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(
    [...resourceUrls].some((url) => url.includes('grass_1_basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('ground_14_Basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('waternormals.jpg'))
  ).toBe(true)
  expect(
    [...resourceUrls].some(
      (url) =>
        url.includes('textures/grass_1.webp') ||
        url.includes('textures/ground_14.webp')
    )
  ).toBe(false)
  expect(brightPixelSum).toBeGreaterThan(30)
  expect(initialExposure).toBe('1.200')
  expect(updatedExposure).toBe('0.300')
})
