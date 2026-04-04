const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(75_000)

function measureBrightness(buffer) {
  const screenshot = PNG.sync.read(buffer)
  let total = 0
  let max = 0
  let count = 0
  const rowStep = Math.max(1, Math.floor(screenshot.height / 12))
  const columnStep = Math.max(1, Math.floor(screenshot.width / 12))

  for (let row = 0; row < screenshot.height; row += rowStep) {
    for (let column = 0; column < screenshot.width; column += columnStep) {
      const pixelOffset = ((row * screenshot.width) + column) * 4
      const brightness =
        screenshot.data[pixelOffset] +
        screenshot.data[pixelOffset + 1] +
        screenshot.data[pixelOffset + 2]

      total += brightness
      max = Math.max(max, brightness)
      count += 1
    }
  }

  return {
    average: total / count,
    max
  }
}

async function screenshotCanvasRegion(page, canvas, width = 160, height = 100) {
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Canvas bounding box unavailable')
  }

  const clipWidth = Math.min(width, box.width)
  const clipHeight = Math.min(height, box.height)

  return page.screenshot({
    clip: {
      x: box.x + ((box.width - clipWidth) / 2),
      y: box.y + ((box.height - clipHeight) / 2),
      width: clipWidth,
      height: clipHeight
    }
  })
}

async function waitForBrightFrame(page, canvas, minimumAverageBrightness, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  let lastMeasurement = { average: 0, max: 0 }

  while (Date.now() < deadline) {
    lastMeasurement = measureBrightness(
      await screenshotCanvasRegion(page, canvas)
    )

    if (lastMeasurement.average > minimumAverageBrightness) {
      return lastMeasurement
    }

    await page.waitForTimeout(150)
  }

  throw new Error(
    `Canvas brightness did not exceed ${minimumAverageBrightness}; last measurement was ${lastMeasurement.average.toFixed(2)}`
  )
}

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

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const canvas = page.locator('canvas')

  await expect(canvas).toBeVisible({ timeout: 5_000 })
  const frameBrightness = await waitForBrightFrame(page, canvas, 20)

  expect(frameBrightness.average).toBeGreaterThan(20)
  await expect(page.locator('.fps-counter')).toContainText('FPS', { timeout: 5_000 })
  await expect(page.locator('h1')).toHaveCount(0, { timeout: 1_000 })
  await expect(page.locator('.start-button')).toHaveCount(0, { timeout: 1_000 })
  await expect(page.getByText('Cursor / levels.io jam')).toHaveCount(0, {
    timeout: 1_000
  })
  await expect(page.getByText('WebGL ready')).toHaveCount(0, { timeout: 1_000 })

  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
    timeout: 5_000
  })
  await expect(page.getByLabel('Sun Rotation')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByLabel('Sky Light Intensity')).toBeVisible({
    timeout: 5_000
  })
  await expect(page.getByLabel('Exposure EV')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByLabel('Tone Mapper')).toBeVisible({ timeout: 5_000 })

  await page.getByLabel('Tone Mapper').selectOption('linear')
  await expect
    .poll(async () => canvas.getAttribute('data-tone-mapping'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('linear')

  await page.getByLabel('Sun Intensity').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '25')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('1.200')
  const sunAdjustedExposure = await canvas.getAttribute('data-renderer-exposure')

  await page.getByLabel('Exposure EV').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '1')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('2.400')
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-ev'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('1.00')
  const updatedExposure = await canvas.getAttribute('data-renderer-exposure')
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
    [...resourceUrls].some((url) => url.includes('textures/atmosphere/scattering.exr'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('media.githubusercontent.com'))
  ).toBe(false)
  expect(
    [...resourceUrls].some(
      (url) =>
        url.includes('textures/grass_1.webp') ||
        url.includes('textures/ground_14.webp')
    )
  ).toBe(false)
  expect(frameBrightness.max).toBeGreaterThan(40)
  expect(sunAdjustedExposure).toBe('1.200')
  expect(updatedExposure).toBe('2.400')
})
