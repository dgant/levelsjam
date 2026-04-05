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

function measureDifference(bufferA, bufferB) {
  const imageA = PNG.sync.read(bufferA)
  const imageB = PNG.sync.read(bufferB)

  if (
    imageA.width !== imageB.width ||
    imageA.height !== imageB.height
  ) {
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

function createNonBlackMask(buffer, minimumChannel = 12) {
  const image = PNG.sync.read(buffer)
  const mask = new Uint8Array(image.width * image.height)
  let count = 0

  for (let index = 0; index < image.data.length; index += 4) {
    const pixelIndex = index / 4
    if (
      image.data[index] >= minimumChannel ||
      image.data[index + 1] >= minimumChannel ||
      image.data[index + 2] >= minimumChannel
    ) {
      mask[pixelIndex] = 1
      count += 1
    }
  }

  return {
    count,
    height: image.height,
    mask,
    width: image.width
  }
}

function measureMaskedDifference(bufferA, bufferB, maskInfo) {
  const imageA = PNG.sync.read(bufferA)
  const imageB = PNG.sync.read(bufferB)

  if (
    imageA.width !== imageB.width ||
    imageA.height !== imageB.height ||
    imageA.width !== maskInfo.width ||
    imageA.height !== maskInfo.height
  ) {
    throw new Error('Masked diff requires matching image dimensions')
  }

  let total = 0
  let count = 0

  for (let pixelIndex = 0; pixelIndex < maskInfo.mask.length; pixelIndex += 1) {
    if (!maskInfo.mask[pixelIndex]) {
      continue
    }

    const index = pixelIndex * 4
    total += Math.abs(imageA.data[index] - imageB.data[index])
    total += Math.abs(imageA.data[index + 1] - imageB.data[index + 1])
    total += Math.abs(imageA.data[index + 2] - imageB.data[index + 2])
    count += 1
  }

  if (count === 0) {
    return 0
  }

  return total / (count * 3)
}

async function screenshotCanvasRegion(
  page,
  canvas,
  width = 80,
  height = 48,
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
  const initialSubtitleWidth = (await loadingSubtitle.boundingBox())?.width ?? 0

  const initialSubtitle = await loadingSubtitle.textContent()
  await page.waitForTimeout(275)
  const updatedSubtitle = await loadingSubtitle.textContent()
  const updatedSubtitleWidth = (await loadingSubtitle.boundingBox())?.width ?? 0
  expect(updatedSubtitle).not.toBeNull()
  expect(updatedSubtitle).not.toEqual(initialSubtitle)
  expect(Math.abs(updatedSubtitleWidth - initialSubtitleWidth)).toBeLessThanOrEqual(1)

  await expect(loadingOverlay).toBeHidden({ timeout: 12_000 })
  await expect(canvas).toBeVisible({ timeout: 5_000 })

  const frameBrightness = await waitForBrightFrame(page, canvas, 6)

  await page.evaluate(() => {
    window.__levelsjamDebug.setView(
      [-5.8, 1.45, -0.48],
      [-6.739980294369161, 1.2, -0.4781253710389137]
    )
    window.__levelsjamDebug.isolateDebugRole('sconce-body', 4)
  })
  await page.waitForTimeout(300)
  const sconceBodyMaskSource = await screenshotCanvasRegion(page, canvas, 220, 180, 0.46, 0.68)
  const sconceBodyMask = createNonBlackMask(sconceBodyMaskSource)
  expect(sconceBodyMask.count).toBeGreaterThan(4_000)
  await page.evaluate(() => {
    window.__levelsjamDebug.clearDebugIsolation()
    window.__levelsjamDebug.setDebugVisible('torch-billboard', 4, false)
    window.__levelsjamDebug.setDebugVisible('sconce-cap', 4, false)
  })
  await page.waitForTimeout(300)
  const sconceBodyVisible = await screenshotCanvasRegion(page, canvas, 220, 180, 0.46, 0.68)
  await page.evaluate(() => {
    window.__levelsjamDebug.setDebugVisible('sconce-body', 4, false)
  })
  await page.waitForTimeout(200)
  const sconceBodyHidden = await screenshotCanvasRegion(page, canvas, 220, 180, 0.46, 0.68)
  await page.evaluate(() => {
    window.__levelsjamDebug.setDebugVisible('sconce-body', 4, true)
    window.__levelsjamDebug.setDebugVisible('sconce-cap', 4, true)
    window.__levelsjamDebug.setDebugVisible('torch-billboard', 4, true)
  })
  expect(
    measureMaskedDifference(sconceBodyVisible, sconceBodyHidden, sconceBodyMask)
  ).toBeGreaterThan(6)
  await page.evaluate(() => {
    window.__levelsjamDebug.setView([0, 2.5, 0], [0, 2.5, -10])
  })
  await page.waitForTimeout(200)

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
  await expect(page.getByRole('slider', { name: 'IBL Intensity' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'Torch Candelas' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'Torch Flicker' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('combobox', { name: 'Ambient Occlusion' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'AO Intensity' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'Exposure' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('combobox', { name: 'Tone Mapper' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('combobox', { name: 'Bloom Kernel' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'DOF Focus Distance' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'DOF Focal Length' })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('slider', { name: 'Depth Of Field Bokeh Scale' })).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('0.00')
  await expect(page.getByLabel('Sun Rotation')).toHaveCount(0)
  await expect(page.getByLabel('Direct Sun Illuminance')).toHaveCount(0)
  await expect(page.getByRole('slider', { name: 'IBL Intensity' })).toHaveAttribute('max', '16')
  await expect(page.getByRole('slider', { name: 'Torch Candelas' })).toHaveAttribute('max', '16')
  await expect(page.getByRole('slider', { name: 'Torch Flicker' })).toHaveAttribute('max', '1')
  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveAttribute('min', '-20')
  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveAttribute('max', '20')

  await page.getByRole('slider', { name: 'Exposure' }).evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '-1')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('2.000000')

  await page.getByRole('slider', { name: 'Torch Candelas' }).evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '4')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })

  await page.getByRole('combobox', { name: 'Tone Mapper' }).selectOption('neutral')
  await expect
    .poll(async () => canvas.getAttribute('data-tone-mapping'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('neutral')

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('off')
  await page.waitForTimeout(400)
  const contactRegionOff = await screenshotCanvasRegion(page, canvas, 140, 100, 0.5, 0.62)
  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('n8ao')
  await page.getByRole('slider', { name: 'AO Intensity' }).evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '5')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  const contactRegionN8AO = await screenshotCanvasRegion(page, canvas, 140, 100, 0.5, 0.62)
  expect(measureDifference(contactRegionOff, contactRegionN8AO)).toBeGreaterThan(1.2)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('ssao')
  await page.waitForTimeout(400)
  const contactRegionSSAO = await screenshotCanvasRegion(page, canvas, 140, 100, 0.5, 0.62)
  expect(measureDifference(contactRegionOff, contactRegionSSAO)).toBeGreaterThan(1.1)

  const flareRegionBefore = await screenshotCanvasRegion(page, canvas, 180, 120, 0.5, 0.42)
  await page.getByRole('slider', { name: 'Lens Flares Intensity' }).evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '1')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('.visual-effect-label').filter({ hasText: 'Lens Flares' }).locator('input').check()
  await page.waitForTimeout(750)
  const flareRegionAfter = await screenshotCanvasRegion(page, canvas, 180, 120, 0.5, 0.42)
  expect(measureDifference(flareRegionBefore, flareRegionAfter)).toBeGreaterThan(0.8)

  const skyBrightnessBeforeSSR = measureBrightness(
    await screenshotCanvasRegion(page, canvas, 120, 60, 0.5, 0.12)
  )
  const reflectiveRegionBeforeSSR = await screenshotCanvasRegion(page, canvas, 140, 100, 0.5, 0.75)
  await page.getByRole('slider', { name: 'SSR Intensity' }).evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )
    descriptor.set.call(element, '1')
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('.visual-effect-label').filter({ hasText: 'SSR' }).locator('input').check()
  await page.waitForTimeout(750)
  const reflectiveRegionWithSSR = await screenshotCanvasRegion(page, canvas, 140, 100, 0.5, 0.75)
  const skyBrightnessWithSSR = measureBrightness(
    await screenshotCanvasRegion(page, canvas, 120, 60, 0.5, 0.12)
  )
  expect(measureDifference(reflectiveRegionBeforeSSR, reflectiveRegionWithSSR)).toBeGreaterThan(0.35)
  expect(skyBrightnessWithSSR.average).toBeLessThanOrEqual(
    skyBrightnessBeforeSSR.average * 1.35
  )

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
