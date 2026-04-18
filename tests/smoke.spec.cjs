const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(240_000)

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
  const fullBuffer = await canvas.screenshot({ timeout: 0 })
  const fullImage = PNG.sync.read(fullBuffer)
  const clipWidth = Math.min(width, fullImage.width)
  const clipHeight = Math.min(height, fullImage.height)
  const centerX = fullImage.width * anchorX
  const centerY = fullImage.height * anchorY
  const startX = Math.max(
    0,
    Math.min(fullImage.width - clipWidth, Math.round(centerX - (clipWidth / 2)))
  )
  const startY = Math.max(
    0,
    Math.min(fullImage.height - clipHeight, Math.round(centerY - (clipHeight / 2)))
  )
  const clippedImage = new PNG({ width: clipWidth, height: clipHeight })

  for (let row = 0; row < clipHeight; row += 1) {
    for (let column = 0; column < clipWidth; column += 1) {
      const sourceOffset =
        (((startY + row) * fullImage.width) + startX + column) * 4
      const targetOffset = ((row * clipWidth) + column) * 4

      clippedImage.data[targetOffset] = fullImage.data[sourceOffset]
      clippedImage.data[targetOffset + 1] = fullImage.data[sourceOffset + 1]
      clippedImage.data[targetOffset + 2] = fullImage.data[sourceOffset + 2]
      clippedImage.data[targetOffset + 3] = fullImage.data[sourceOffset + 3]
    }
  }

  return PNG.sync.write(clippedImage)
}

async function measureAnimatedCanvasDifference(
  page,
  canvas,
  width = 220,
  height = 160,
  anchorX = 0.5,
  anchorY = 0.5,
  waitMs = 500
) {
  const firstFrame = await screenshotCanvasRegion(
    page,
    canvas,
    width,
    height,
    anchorX,
    anchorY
  )
  await page.waitForTimeout(waitMs)
  const secondFrame = await screenshotCanvasRegion(
    page,
    canvas,
    width,
    height,
    anchorX,
    anchorY
  )

  return measureDifference(firstFrame, secondFrame)
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
  await expect
    .poll(
      async () => loadingOverlay.getAttribute('data-loading-complete'),
      {
        timeout: 25_000,
        intervals: [250, 500, 1_000]
      }
    )
    .toBe('true')
  await expect(loadingOverlay).toHaveAttribute('aria-hidden', 'true')
  await expect(canvas).toBeVisible({ timeout: 5_000 })

  const frameBrightness = await waitForBrightFrame(page, canvas, 8, 20)

  await expect(page.locator('.fps-counter')).toContainText('FPS', { timeout: 5_000 })
  await expect(page.locator('.fps-counter')).toContainText('maze-001')
  await expect(page.locator('.fps-counter')).not.toContainText('unknown')

  await page.keyboard.press('F9')
  await expect(page.locator('.fps-counter')).toBeHidden({ timeout: 5_000 })
  await page.keyboard.press('F9')
  await expect(page.locator('.fps-counter')).toBeVisible({ timeout: 5_000 })

  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
    timeout: 5_000
  })

  await expect(page.getByRole('slider', { name: 'Exposure' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Move Speed' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Accel Distance' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Decel Distance' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'AO Radius' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Fog Noise Frequency' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Bloom Kernel' })).toBeVisible()

  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('-4.5')
  await expect(page.getByRole('slider', { name: 'Move Speed' })).toHaveValue('20')
  await expect(page.getByRole('slider', { name: 'Accel Distance' })).toHaveValue('2')
  await expect(page.getByRole('slider', { name: 'Decel Distance' })).toHaveValue('0.5')
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('DOF Focus Distance (m)')
  await expect(page.locator('[data-testid="visual-controls"]')).toContainText('DOF Focal Length / Range (m)')
  await expect(page.getByRole('slider', { name: 'DOF Focus Distance' })).toHaveAttribute('max', '8')
  await expect(page.getByLabel('Baked Lightmaps')).toBeVisible()
  await expect(page.getByLabel('Reflection Captures')).toBeVisible()
  await expect(page.getByLabel('Show Reflection Probes')).toBeVisible()

  await expect
    .poll(async () => {
      return page.evaluate(() => window.__levelsjamDebug?.getDebugPosition?.('sconce-body', 0) ?? null)
    }, {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .not.toBeNull()
  await expect
    .poll(async () => {
      return page.evaluate(() => window.__levelsjamDebug?.getDebugPosition?.('maze-wall', 0) ?? null)
    }, {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .not.toBeNull()
  const debugWallPosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('maze-wall', 12)
  )
  const debugSconcePosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('sconce-body', 0)
  )
  const wallMeshState = await page.evaluate(
    () => window.__levelsjamDebug.getDebugMeshState('maze-wall', 12)
  )
  expect(wallMeshState).not.toBeNull()
  expect(wallMeshState.hasEmissiveMap).toBe(false)
  expect(wallMeshState.hasLightMap).toBe(true)
  expect(wallMeshState.hasMap).toBe(true)
  expect(wallMeshState.hasUv1).toBe(false)
  expect(wallMeshState.hasUv2).toBe(false)

  const wallLightmapState = await page.evaluate(
    () => window.__levelsjamDebug.getDebugMeshState('maze-wall-lightmap', 12)
  )
  expect(wallLightmapState).not.toBeNull()
  expect(wallLightmapState.hasEnvMap).toBe(false)
  expect(wallLightmapState.hasLightMap).toBe(true)
  expect(wallLightmapState.hasMap).toBe(true)
  expect(wallLightmapState.mapChannel).toBe(0)

  const groundLightmapState = await page.evaluate(
    () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 0)
  )
  expect(groundLightmapState).not.toBeNull()
  expect(groundLightmapState.hasEnvMap).toBe(true)
  expect(groundLightmapState.hasLightMap).toBe(true)
  expect(groundLightmapState.hasUv1).toBe(true)
  expect(groundLightmapState.lightMapChannel).toBe(1)

  const centerGroundPatchPosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('maze-ground-lightmap', 36)
  )
  expect(centerGroundPatchPosition).not.toBeNull()
  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, false)
    }
  })
  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.setView(
      [x - 1.8, y + 0.9, z - 1.4],
      [x + 0.6, y + 0.02, z]
    )
  }, centerGroundPatchPosition)
  await page.waitForTimeout(250)
  await page.getByLabel('Reflection Captures').check()
  await expect(page.getByLabel('Reflection Captures')).toBeChecked()
  await page.waitForTimeout(250)
  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 36)?.probeBlend?.mode
      ),
      {
        timeout: 5_000,
        intervals: [100, 250, 500]
      }
    )
    .toBe('world')
  await page.getByLabel('Show Reflection Probes').check()
  await expect(page.getByLabel('Show Reflection Probes')).toBeChecked()
  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug.getDebugPosition('reflection-probe-visual', 0)
      ),
      {
        timeout: 5_000,
        intervals: [100, 250, 500]
      }
    )
    .not.toBeNull()
  const firstProbePosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('reflection-probe-visual', 0)
  )
  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.setView(
      [x - 0.65, y + 0.1, z - 0.65],
      [x, y, z]
    )
  }, firstProbePosition)
  await page.waitForTimeout(250)
  const reflectionProbeVisualOn = await screenshotCanvasRegion(page, canvas, 220, 180, 0.5, 0.5)
  await page.getByLabel('Show Reflection Probes').uncheck()
  await expect(page.getByLabel('Show Reflection Probes')).not.toBeChecked()
  await page.waitForTimeout(250)
  const reflectionProbeVisualOff = await screenshotCanvasRegion(page, canvas, 220, 180, 0.5, 0.5)
  expect(measureDifference(reflectionProbeVisualOn, reflectionProbeVisualOff)).toBeGreaterThan(0.05)
  await page.evaluate(() => {
    window.__levelsjamDebug.setView(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
  })
  await page.waitForTimeout(200)
  await page.getByLabel('Reflection Captures').uncheck()
  await expect(page.getByLabel('Reflection Captures')).not.toBeChecked()
  await page.waitForTimeout(250)
  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 36)?.probeBlend?.mode
      ),
      {
        timeout: 5_000,
        intervals: [100, 250, 500]
      }
    )
    .toBe('none')
  await page.getByLabel('Reflection Captures').check()
  await expect(page.getByLabel('Reflection Captures')).toBeChecked()

  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, false)
    }
    window.__levelsjamDebug.setView(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
  })
  await page.waitForTimeout(200)

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
  const aoOffRegion = await screenshotCanvasRegion(page, canvas, 150, 110, 0.76, 0.72)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('n8ao')
  await setSlider(page, 'AO Intensity', 5)
  await setSlider(page, 'AO Radius', 2.5)
  await page.waitForTimeout(250)
  await expect(page.getByRole('combobox', { name: 'Ambient Occlusion' })).toHaveValue('n8ao')

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('ssao')
  await page.waitForTimeout(250)
  await expect(page.getByRole('combobox', { name: 'Ambient Occlusion' })).toHaveValue('ssao')

  await page.evaluate(() => {
    window.__levelsjamDebug.setView(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
  })
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, false)
    }
  })
  await setSlider(page, 'IBL Intensity', 0)
  await setSlider(page, 'Exposure', 0)
  await setSlider(page, 'Torch Candelas', 0)
  await page.waitForTimeout(200)
  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug.getDebugMeshState('maze-wall-lightmap', 12)?.lightMapIntensity
      ),
      {
        timeout: 15_000,
        intervals: [100, 250, 500, 1_000]
      }
    )
    .toBe(0)
  const bakedLightmapOff = await screenshotCanvasRegion(page, canvas, 640, 360, 0.68, 0.62)
  await setSlider(page, 'Torch Candelas', 10)
  await page.waitForTimeout(200)
  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug.getDebugMeshState('maze-wall-lightmap', 12)?.lightMapIntensity
      ),
      {
        timeout: 15_000,
        intervals: [100, 250, 500, 1_000]
      }
    )
    .toBe(10)
  const bakedLightmapOn = await screenshotCanvasRegion(page, canvas, 640, 360, 0.68, 0.62)
  expect(measureDifference(bakedLightmapOff, bakedLightmapOn)).toBeGreaterThan(0.2)
  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, true)
    }
  })

  await expect
    .poll(async () => {
      return page.evaluate(() => window.__levelsjamDebug?.getDebugPosition?.('torch-billboard', 0) ?? null)
    }, {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .not.toBeNull()
  const debugTorchPosition = await page.evaluate(
    () => window.__levelsjamDebug.getDebugPosition('torch-billboard', 0)
  )
  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.isolateDebugRole('torch-billboard', 0)
    window.__levelsjamDebug.setView([x - 1.0, y, z], [x, y, z])
  }, debugTorchPosition)
  await page.waitForTimeout(300)
  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('n8ao')
  await page.waitForTimeout(300)
  await page.keyboard.press('F9')
  await page.keyboard.press('`')
  await page.waitForTimeout(200)
  const torchBillboardWithAo = await screenshotCanvasRegion(page, canvas, 320, 240, 0.5, 0.62)
  await page.evaluate(() => {
    window.__levelsjamDebug.setDebugVisible('torch-billboard', 0, false)
  })
  await page.waitForTimeout(300)
  const torchBillboardHiddenWithAo = await screenshotCanvasRegion(page, canvas, 320, 240, 0.5, 0.62)
  expect(measureDifference(torchBillboardWithAo, torchBillboardHiddenWithAo)).toBeGreaterThan(0.05)
  await page.evaluate(() => {
    window.__levelsjamDebug.setDebugVisible('torch-billboard', 0, true)
    window.__levelsjamDebug.clearDebugIsolation()
  })
  await page.keyboard.press('F9')
  await page.keyboard.press('`')
  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('off')
  await page.waitForTimeout(200)

  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, false)
    }
    window.__levelsjamDebug.setView(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
  })
  await setSlider(page, 'IBL Intensity', 1)
  await setSlider(page, 'Exposure', -4.5)
  await setSlider(page, 'Torch Candelas', 1)
  await page.waitForTimeout(200)

  const zeroEffectBaseline = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)

  await setCheckboxByLabelText(page, 'SSR', true)
  await setSlider(page, 'SSR Intensity', 0)
  await page.waitForTimeout(200)
  const zeroSsrRegion = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)
  expect(measureDifference(zeroEffectBaseline, zeroSsrRegion)).toBeLessThan(0.02)
  await setCheckboxByLabelText(page, 'SSR', false)

  const responsiveViewA = {
    camera: [debugTorchPosition[0] - 1.4, debugTorchPosition[1] + 0.15, debugTorchPosition[2] - 1.35],
    target: [debugTorchPosition[0], debugTorchPosition[1], debugTorchPosition[2]]
  }
  const responsiveViewB = {
    camera: [debugTorchPosition[0] - 1.05, debugTorchPosition[1] + 0.28, debugTorchPosition[2] - 1.1],
    target: [debugTorchPosition[0] + 0.18, debugTorchPosition[1] + 0.06, debugTorchPosition[2] - 0.08]
  }

  await setCheckboxByLabelText(page, 'Depth Of Field', false)
  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('off')
  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, true)
    }
  })
  await page.evaluate((view) => {
    window.__levelsjamDebug.setView(view.camera, view.target)
  }, responsiveViewA)
  await page.waitForTimeout(250)

  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('ssao')
  await setSlider(page, 'AO Intensity', 3)
  await setSlider(page, 'AO Radius', 2)
  await page.waitForTimeout(250)
  const ssaoResponsiveBefore = await screenshotCanvasRegion(page, canvas, 220, 160, 0.5, 0.5)
  await page.evaluate((view) => {
    window.__levelsjamDebug.setView(view.camera, view.target)
  }, responsiveViewB)
  await page.waitForTimeout(500)
  const ssaoResponsiveAfter = await screenshotCanvasRegion(page, canvas, 220, 160, 0.5, 0.5)
  expect(measureDifference(ssaoResponsiveBefore, ssaoResponsiveAfter)).toBeGreaterThan(0.02)
  await page.getByRole('combobox', { name: 'Ambient Occlusion' }).selectOption('off')
  await page.evaluate((view) => {
    window.__levelsjamDebug.setView(view.camera, view.target)
  }, responsiveViewA)
  await page.waitForTimeout(250)

  await setCheckboxByLabelText(page, 'Depth Of Field', true)
  await setSlider(page, 'DOF Focus Distance', 2)
  await setSlider(page, 'DOF Focal Length', 2)
  await setSlider(page, 'Depth Of Field Bokeh Scale', 1.5)
  await page.waitForTimeout(250)
  const dofResponsiveBefore = await screenshotCanvasRegion(page, canvas, 220, 160, 0.5, 0.5)
  await page.evaluate((view) => {
    window.__levelsjamDebug.setView(view.camera, view.target)
  }, responsiveViewB)
  await page.waitForTimeout(500)
  const dofResponsiveAfter = await screenshotCanvasRegion(page, canvas, 220, 160, 0.5, 0.5)
  expect(measureDifference(dofResponsiveBefore, dofResponsiveAfter)).toBeGreaterThan(0.02)
  await setSlider(page, 'Depth Of Field Bokeh Scale', 0)
  await page.waitForTimeout(200)
  await setCheckboxByLabelText(page, 'Depth Of Field', false)
  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, false)
    }
    window.__levelsjamDebug.setView(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
  })
  await page.waitForTimeout(250)

  const zeroDofBaseline = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)
  await setCheckboxByLabelText(page, 'Depth Of Field', true)
  await setSlider(page, 'Depth Of Field Bokeh Scale', 0)
  await page.waitForTimeout(200)
  const zeroDofRegion = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)
  expect(measureDifference(zeroDofBaseline, zeroDofRegion)).toBeLessThan(0.02)
  await setCheckboxByLabelText(page, 'Depth Of Field', false)

  const zeroLensFlareBaseline = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)
  await setCheckboxByLabelText(page, 'Lens Flares', true)
  await setSlider(page, 'Lens Flares Intensity', 0)
  await page.waitForTimeout(200)
  const zeroLensFlareRegion = await screenshotCanvasRegion(page, canvas, 220, 160, 0.72, 0.52)
  expect(measureDifference(zeroLensFlareBaseline, zeroLensFlareRegion)).toBeLessThan(0.02)
  await setCheckboxByLabelText(page, 'Lens Flares', false)

  await page.evaluate(() => {
    for (let index = 0; index < 32; index += 1) {
      window.__levelsjamDebug.setDebugVisible('torch-billboard', index, true)
    }
  })
  await page.evaluate((position) => {
    const [x, y, z] = position
    window.__levelsjamDebug.setView(
      [x - 1.4, y + 0.15, z - 1.35],
      [x, y, z]
    )
  }, debugTorchPosition)
  await page.waitForTimeout(200)

  await setCheckboxByLabelText(page, 'Bloom', true)
  await setSlider(page, 'Bloom Intensity', 3)
  await page.waitForTimeout(250)
  await page.getByRole('combobox', { name: 'Bloom Kernel' }).selectOption('very-small')
  await page.getByRole('combobox', { name: 'Bloom Kernel' }).selectOption('huge')
  await expect(page.getByRole('combobox', { name: 'Bloom Kernel' })).toHaveValue('huge')

  await setCheckboxByLabelText(page, 'Volumetric Fog', false)
  await page.waitForTimeout(150)
  const fogOff = await screenshotCanvasRegion(page, canvas, 640, 360, 0.68, 0.6)
  await setCheckboxByLabelText(page, 'Volumetric Fog', true)
  await setSlider(page, 'Volumetric Fog Intensity', 1)
  await setSlider(page, 'Fog Noise Frequency', 6)
  await page.waitForTimeout(200)
  const fogOn = await screenshotCanvasRegion(page, canvas, 640, 360, 0.68, 0.6)
  expect(measureDifference(fogOff, fogOn)).toBeGreaterThan(0.03)

  await setSlider(page, 'Exposure', -3.5)
  await expect
    .poll(async () => canvas.getAttribute('data-renderer-exposure'), {
      timeout: 5_000,
      intervals: [100, 250, 500]
    })
    .toBe('11.313708')

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(frameBrightness.average).toBeGreaterThan(8)
  expect(frameBrightness.max).toBeGreaterThan(20)
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
