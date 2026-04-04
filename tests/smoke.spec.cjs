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

async function screenshotCanvasRegion(page, canvas, width = 80, height = 48) {
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

async function waitForBrightFrame(page, canvas, minimumAverageBrightness, timeoutMs = 7_000) {
  const deadline = Date.now() + timeoutMs
  let lastMeasurement = { average: 0, max: 0 }

  while (Date.now() < deadline) {
    lastMeasurement = measureBrightness(
      await screenshotCanvasRegion(page, canvas)
    )

    if (lastMeasurement.average > minimumAverageBrightness) {
      return lastMeasurement
    }

    await page.waitForTimeout(250)
  }

  throw new Error(
    `Canvas brightness did not exceed ${minimumAverageBrightness}; last measurement was ${lastMeasurement.average.toFixed(2)}`
  )
}

async function waitForBrightnessMeasurement(page, canvas, predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  let lastMeasurement = { average: 0, max: 0 }

  while (Date.now() < deadline) {
    lastMeasurement = measureBrightness(
      await screenshotCanvasRegion(page, canvas)
    )

    if (predicate(lastMeasurement)) {
      return lastMeasurement
    }

    await page.waitForTimeout(200)
  }

  throw new Error(
    `Canvas brightness did not reach the expected state; last measurement was avg=${lastMeasurement.average.toFixed(2)} max=${lastMeasurement.max.toFixed(2)}`
  )
}

test('loads the labyrinth scene without runtime errors', async ({ page }) => {
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

  const loadingOverlay = page.locator('.loading-overlay')
  const loadingTitle = page.locator('.loading-overlay h1')
  const loadingSubtitle = page.locator('.loading-overlay h2')
  const canvas = page.locator('canvas')

  await expect(loadingOverlay).toBeVisible({ timeout: 5_000 })
  await expect(loadingTitle).toHaveText('MINOTAUR')
  await expect(loadingSubtitle).toContainText('Entering the labyrinth')

  const initialSubtitle = await loadingSubtitle.textContent()
  await page.waitForTimeout(275)
  const updatedSubtitle = await loadingSubtitle.textContent()
  expect(updatedSubtitle).not.toBeNull()
  expect(updatedSubtitle).not.toEqual(initialSubtitle)

  await expect(loadingOverlay).toBeHidden({ timeout: 12_000 })
  await expect(canvas).toBeVisible({ timeout: 5_000 })

  await expect
    .poll(async () => canvas.getAttribute('data-scene-ready'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  const frameBrightness = await waitForBrightFrame(page, canvas, 6)

  await expect(page.locator('.fps-counter')).toContainText('FPS', { timeout: 5_000 })
  await page.keyboard.press('KeyW')
  await expect
    .poll(async () => page.evaluate(() => document.pointerLockElement === null), {
      timeout: 2_000,
      intervals: [100, 250, 500]
    })
    .toBe(true)

  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
    timeout: 5_000
  })
  await expect(page.getByLabel('IBL Intensity')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByLabel('Torch Candelas')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByLabel('Exposure EV100')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByLabel('Tone Mapper')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('17.50 EV100')
  await expect(page.getByLabel('Sun Rotation')).toHaveCount(0)
  await expect(page.getByLabel('Direct Sun Illuminance')).toHaveCount(0)

  await page.getByLabel('Exposure EV100').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '16.5')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('400.000000')

  await page.getByLabel('Torch Candelas').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '4')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await page.getByLabel('Tone Mapper').selectOption('neutral')
  await expect
    .poll(async () => canvas.getAttribute('data-tone-mapping'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('neutral')

  const ssrToggle = page
    .locator('.visual-effect-toggle')
    .filter({ hasText: 'SSR' })
    .locator('input')
  await ssrToggle.check()
  await page.waitForTimeout(750)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(
    [...resourceUrls].some((url) => url.includes('overcast_soil_1k.hdr'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('1K-puddle_Diffuse.jpg'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('stonewall_29_basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('metal_13_basecolor-1K.png'))
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) =>
      url.includes('CampFire_l_nosmoke_front_Loop_01_4K_6x6.png')
    )
  ).toBe(true)
  expect(
    [...resourceUrls].some((url) => url.includes('textures/atmosphere/'))
  ).toBe(false)
  expect(
    [...resourceUrls].some((url) => url.includes('waternormals.jpg'))
  ).toBe(false)
  expect(frameBrightness.max).toBeGreaterThan(18)
})
