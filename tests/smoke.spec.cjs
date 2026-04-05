const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(140_000)

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

function measureDifference(bufferA, bufferB) {
  const imageA = PNG.sync.read(bufferA)
  const imageB = PNG.sync.read(bufferB)

  if (imageA.width !== imageB.width || imageA.height !== imageB.height) {
    throw new Error('Cannot diff screenshots with mismatched dimensions')
  }

  let total = 0
  const pixelCount = imageA.width * imageA.height

  for (let index = 0; index < imageA.data.length; index += 4) {
    total += Math.abs(imageA.data[index] - imageB.data[index])
    total += Math.abs(imageA.data[index + 1] - imageB.data[index + 1])
    total += Math.abs(imageA.data[index + 2] - imageB.data[index + 2])
  }

  return total / (pixelCount * 3)
}

async function screenshotCanvasRegion(
  page,
  canvas,
  width = 160,
  height = 100,
  anchorX = 0.5,
  anchorY = 0.5
) {
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Canvas bounding box unavailable')
  }

  const clipWidth = Math.min(width, box.width)
  const clipHeight = Math.min(height, box.height)
  const centerX = box.x + (box.width * anchorX)
  const centerY = box.y + (box.height * anchorY)
  const minX = box.x
  const maxX = box.x + box.width - clipWidth
  const minY = box.y
  const maxY = box.y + box.height - clipHeight

  return page.screenshot({
    clip: {
      x: Math.max(minX, Math.min(maxX, centerX - (clipWidth / 2))),
      y: Math.max(minY, Math.min(maxY, centerY - (clipHeight / 2))),
      width: clipWidth,
      height: clipHeight
    }
  })
}

async function waitForBrightFrame(
  page,
  canvas,
  minimumAverageBrightness,
  minimumPeakBrightness,
  timeoutMs = 7_000
) {
  const deadline = Date.now() + timeoutMs
  let lastMeasurement = { average: 0, max: 0 }

  while (Date.now() < deadline) {
    lastMeasurement = measureBrightness(
      await screenshotCanvasRegion(page, canvas, 180, 120, 0.5, 0.72)
    )

    if (
      lastMeasurement.average > minimumAverageBrightness &&
      lastMeasurement.max > minimumPeakBrightness
    ) {
      return lastMeasurement
    }

    await page.waitForTimeout(250)
  }

  throw new Error(
    `Canvas brightness did not exceed avg ${minimumAverageBrightness} and peak ${minimumPeakBrightness}; last measurement was avg ${lastMeasurement.average.toFixed(2)} peak ${lastMeasurement.max.toFixed(2)}`
  )
}

async function setSlider(page, label, value) {
  await page.getByRole('slider', { name: label }).evaluate((element, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, String(nextValue))
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function setCheckboxByLabelText(page, label, enabled) {
  const checkbox = page.locator('.visual-effect-label').filter({ hasText: label }).locator('input')

  if (enabled) {
    await checkbox.check()
  } else {
    await checkbox.uncheck()
  }
}

test('loads the maze scene and exposes working debug/render controls', async ({ page }) => {
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

  await page.goto('/?maze=maze-001', { waitUntil: 'domcontentloaded' })

  const loadingOverlay = page.locator('.loading-overlay')
  const canvas = page.locator('canvas')

  await expect(loadingOverlay).toBeVisible({ timeout: 5_000 })

  await expect(loadingOverlay).toBeHidden({ timeout: 12_000 })
  await expect(canvas).toBeVisible({ timeout: 5_000 })

  const frameBrightness = await waitForBrightFrame(page, canvas, 45, 90)

  await expect(page.locator('.fps-counter')).toContainText('FPS', { timeout: 5_000 })
  await expect(page.locator('.fps-counter')).not.toContainText('unknown')

  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
    timeout: 5_000
  })

  await expect(page.getByRole('slider', { name: 'Exposure' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Torch Flicker' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Move Speed' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Accel Distance' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Decel Distance' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'AO Radius' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Fog Noise Frequency' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Bloom Kernel' })).toBeVisible()

  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('-4.5')
  await expect(page.getByRole('slider', { name: 'Torch Flicker' })).toHaveValue('0.15')
  await expect(page.getByRole('slider', { name: 'Move Speed' })).toHaveValue('20')
  await expect(page.getByRole('slider', { name: 'Accel Distance' })).toHaveValue('2')
  await expect(page.getByRole('slider', { name: 'Decel Distance' })).toHaveValue('0.5')
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('DOF Focus Distance (m)')
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('DOF Focal Length / Range (m)')
  await expect(page.getByRole('slider', { name: 'DOF Focus Distance' })).toHaveAttribute('max', '8')

  await expect
    .poll(async () => {
      return page.evaluate(() => window.__levelsjamDebug?.getDebugPosition?.('sconce-body', 0) ?? null)
    }, {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .not.toBeNull()
  const debugSconcePosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('sconce-body', 0)
  )

  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.setView(
      [x - 1.75, y + 0.25, z - 1.85],
      [x, y, z]
    )
  }, debugSconcePosition)
  await page.waitForTimeout(200)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('off')
  await page.waitForTimeout(200)
  const aoOffRegion = await screenshotCanvasRegion(page, canvas, 150, 110, 0.5, 0.72)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('n8ao')
  await setSlider(page, 'AO Intensity', 5)
  await setSlider(page, 'AO Radius', 2.5)
  await page.waitForTimeout(250)
  const n8aoRegion = await screenshotCanvasRegion(page, canvas, 150, 110, 0.5, 0.72)
  expect(measureDifference(aoOffRegion, n8aoRegion)).toBeGreaterThan(0.45)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('ssao')
  await page.waitForTimeout(250)
  const ssaoRegion = await screenshotCanvasRegion(page, canvas, 150, 110, 0.5, 0.72)
  expect(measureDifference(aoOffRegion, ssaoRegion)).toBeGreaterThan(0.45)

  await expect
    .poll(async () => {
      return page.evaluate(() => window.__levelsjamDebug?.getDebugPosition?.('torch-light', 0) ?? null)
    }, {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .not.toBeNull()
  const debugTorchPosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('torch-light', 0)
  )
  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.setView(
      [x - 1.4, y + 0.15, z - 1.35],
      [x, y, z]
    )
  }, debugTorchPosition)
  await page.waitForTimeout(200)

  await setSlider(page, 'Torch Candelas', 10)
  await setCheckboxByLabelText(page, 'Bloom', true)
  await setSlider(page, 'Bloom Intensity', 3)
  await page.waitForTimeout(250)
  await page.getByRole('combobox', { name: 'Bloom Kernel' }).selectOption('very-small')
  await page.getByRole('combobox', { name: 'Bloom Kernel' }).selectOption('huge')
  await expect(page.getByRole('combobox', { name: 'Bloom Kernel' })).toHaveValue('huge')

  await setCheckboxByLabelText(page, 'Volumetric Fog', false)
  await page.waitForTimeout(150)
  const fogOff = await screenshotCanvasRegion(page, canvas, 150, 110, 0.5, 0.52)
  await setCheckboxByLabelText(page, 'Volumetric Fog', true)
  await setSlider(page, 'Volumetric Fog Intensity', 1)
  await setSlider(page, 'Fog Noise Frequency', 6)
  await page.waitForTimeout(200)
  const fogOn = await screenshotCanvasRegion(page, canvas, 150, 110, 0.5, 0.52)
  expect(measureDifference(fogOff, fogOn)).toBeGreaterThan(0.008)

  await setSlider(page, 'Exposure', -3.5)
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('11.313708')

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(frameBrightness.average).toBeGreaterThan(45)
  expect(frameBrightness.max).toBeGreaterThan(90)
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
})
