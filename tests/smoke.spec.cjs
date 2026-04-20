const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(300_000)

const SMOKE_TIMING_LOG_PATH = path.resolve(
  __dirname,
  '..',
  'logs',
  'latest-smoke-profile.json'
)
let activeSmokeTimingProfile = null

function createSmokeTimingProfile() {
  return {
    phases: [],
    screenshotCount: 0,
    screenshotMs: 0,
    startedAt: new Date().toISOString()
  }
}

async function timedStep(timingProfile, label, action) {
  const startedAt = Date.now()

  try {
    return await action()
  } finally {
    timingProfile.phases.push({
      durationMs: Date.now() - startedAt,
      label
    })
  }
}

function writeSmokeTimingProfile(timingProfile) {
  const completedProfile = {
    ...timingProfile,
    phases: timingProfile.phases.slice().sort((left, right) => right.durationMs - left.durationMs),
    totalPhaseMs: timingProfile.phases.reduce((sum, phase) => sum + phase.durationMs, 0),
    wroteAt: new Date().toISOString()
  }

  fs.mkdirSync(path.dirname(SMOKE_TIMING_LOG_PATH), { recursive: true })
  fs.writeFileSync(
    SMOKE_TIMING_LOG_PATH,
    JSON.stringify(completedProfile, null, 2)
  )
}

test.afterEach(() => {
  if (!activeSmokeTimingProfile) {
    return
  }

  activeSmokeTimingProfile.finishedAt = new Date().toISOString()
  writeSmokeTimingProfile(activeSmokeTimingProfile)
  activeSmokeTimingProfile = null
})

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

function decodePngDataUrl(dataUrl) {
  return PNG.sync.read(
    Buffer.from(
      dataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    )
  )
}

function measurePngDetail(png) {
  let darkest = 255
  let luminanceTotal = 0
  let luminanceSquaredTotal = 0
  let nonBlackCount = 0
  let sampleCount = 0

  for (let offset = 0; offset < png.data.length; offset += 4) {
    const r = png.data[offset]
    const g = png.data[offset + 1]
    const b = png.data[offset + 2]
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)

    darkest = Math.min(darkest, r, g, b)
    luminanceTotal += luminance
    luminanceSquaredTotal += luminance * luminance
    if (r > 8 || g > 8 || b > 8) {
      nonBlackCount += 1
    }
    sampleCount += 1
  }

  const averageLuminance = luminanceTotal / sampleCount
  const variance = Math.max(
    0,
    (luminanceSquaredTotal / sampleCount) - (averageLuminance * averageLuminance)
  )

  return {
    darkest,
    luminanceStdDev: Math.sqrt(variance),
    nonBlackFraction: nonBlackCount / sampleCount
  }
}

function measureBufferDiff(leftBuffer, rightBuffer) {
  const left = PNG.sync.read(leftBuffer)
  const right = PNG.sync.read(rightBuffer)

  if (left.width !== right.width || left.height !== right.height) {
    throw new Error('Cannot diff screenshots with different dimensions')
  }

  let total = 0
  let max = 0

  for (let offset = 0; offset < left.data.length; offset += 4) {
    const difference =
      Math.abs(left.data[offset] - right.data[offset]) +
      Math.abs(left.data[offset + 1] - right.data[offset + 1]) +
      Math.abs(left.data[offset + 2] - right.data[offset + 2])

    total += difference
    max = Math.max(max, difference)
  }

  return {
    averagePerChannel: total / (left.width * left.height * 3),
    maxCombinedDifference: max
  }
}

async function screenshotCanvasRegion(
  page,
  canvas,
  width = 160,
  height = 100,
  anchorX = 0.5,
  anchorY = 0.5,
  timingProfile = null
) {
  const startedAt = Date.now()
  const activeTimingProfileForShot = timingProfile ?? activeSmokeTimingProfile
  const canvasBox = await canvas.boundingBox()

  if (!canvasBox) {
    throw new Error('Canvas bounding box was unavailable for screenshot capture')
  }

  const clipWidth = Math.min(width, Math.max(1, Math.round(canvasBox.width)))
  const clipHeight = Math.min(height, Math.max(1, Math.round(canvasBox.height)))
  const centerX = canvasBox.x + (canvasBox.width * anchorX)
  const centerY = canvasBox.y + (canvasBox.height * anchorY)
  const clipX = Math.max(
    canvasBox.x,
    Math.min(
      canvasBox.x + canvasBox.width - clipWidth,
      centerX - (clipWidth / 2)
    )
  )
  const clipY = Math.max(
    canvasBox.y,
    Math.min(
      canvasBox.y + canvasBox.height - clipHeight,
      centerY - (clipHeight / 2)
    )
  )
  const clippedBuffer = await page.screenshot({
    clip: {
      x: clipX,
      y: clipY,
      width: clipWidth,
      height: clipHeight
    },
    timeout: 0
  })

  if (activeTimingProfileForShot) {
    activeTimingProfileForShot.screenshotCount += 1
    activeTimingProfileForShot.screenshotMs += Date.now() - startedAt
  }

  return clippedBuffer
}

async function waitForBrightFrame(
  page,
  canvas,
  minimumAverageBrightness,
  minimumPeakBrightness,
  timeoutMs = 7_000,
  timingProfile = null
) {
  const deadline = Date.now() + timeoutMs
  let lastMeasurement = { average: 0, max: 0 }

  while (Date.now() < deadline) {
    lastMeasurement = measureBrightness(
      await screenshotCanvasRegion(page, canvas, 180, 120, 0.5, 0.72, timingProfile)
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

async function setCheckbox(page, label, enabled) {
  const checkbox = page.getByRole('checkbox', { name: label })

  if (enabled) {
    await checkbox.check()
    return
  }

  await checkbox.uncheck()
}

test('loads the maze scene and exposes working debug/render controls', async ({ page }) => {
  const consoleErrors = []
  const pageErrors = []
  const resourceUrls = new Set()
  const timingProfile = createSmokeTimingProfile()
  const runStartedAt = Date.now()
  activeSmokeTimingProfile = timingProfile

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

  const loadingOverlay = page.locator('.loading-overlay')
  const canvas = page.locator('canvas')

  await timedStep(timingProfile, 'startup', async () => {
    await page.goto('/?maze=maze-001', { waitUntil: 'domcontentloaded' })
    if (await loadingOverlay.count()) {
      await expect(loadingOverlay).toBeVisible({ timeout: 5_000 })
      await expect
        .poll(
          async () => loadingOverlay.getAttribute('data-loading-complete'),
          {
            timeout: 180_000,
            intervals: [250, 500, 1_000]
          }
        )
        .toBe('true')
      await expect(loadingOverlay).toHaveAttribute('aria-hidden', 'true')
    }
    await expect
      .poll(
        async () => await canvas.count(),
        {
          timeout: 180_000,
          intervals: [250, 500, 1_000]
        }
      )
      .toBeGreaterThan(0)
    await expect(canvas).toBeVisible({ timeout: 180_000 })
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready ?? false
        ),
        {
          timeout: 180_000,
          intervals: [250, 500, 1_000]
        }
      )
      .toBe(true)
  })

  const frameBrightness = await waitForBrightFrame(page, canvas, 8, 20, 7_000, timingProfile)

  await timedStep(timingProfile, 'debug-controls', async () => {
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

    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('-4.5')
    await expect(page.getByLabel('Probe IBL')).toBeVisible()
    await expect(page.getByLabel('Probe IBL')).not.toBeChecked()
    await expect(page.getByLabel('Reflection Captures')).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Move Speed' })).toBeVisible()

    await setSlider(page, 'Exposure', 1.25)
    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('1.25')
    await page
      .locator('[data-testid="visual-controls"] span[title="Double-click to reset"]')
      .filter({ hasText: 'Exposure' })
      .dblclick()
    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('-4.5')
  })

  await timedStep(timingProfile, 'reflection-captures', async () => {
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getReflectionProbeState()?.ready ?? false
        ),
        {
          timeout: 60_000,
          intervals: [100, 250, 500, 1_000]
        }
      )
      .toBe(true)
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getDebugMeshState('maze-wall', 24)
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        hasLightMap: true,
        hasMap: true,
        hasUv1: true,
        lightMapChannel: 1
      })
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
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 36)?.probeBlend?.radianceMode
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toBe('world')
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 36)?.probeBlendUniforms ?? null
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        localProbeTextureBoundCount: 4,
        probeBlendMode: 0,
        probeBlendRadianceMode: 1
      })
    await setCheckbox(page, 'Probe IBL', true)
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
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getDebugMeshState('maze-wall', 24)?.probeBlendUniforms ?? null
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        localProbeTextureBoundCount: 4,
        probeBlendMode: 2,
        probeBlendRadianceMode: 2
      })
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 36)?.probeBlend?.radianceMode
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toBe('world')
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getReflectionProbeState()?.probeCaptureCounts?.[24] ?? null
        ),
        {
          timeout: 10_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        billboard: expect.any(Number),
        ground: expect.any(Number),
        sconce: expect.any(Number),
        wall: expect.any(Number)
      })
    const probeAtlas = await page.evaluate(
      () => window.__levelsjamDebug.captureReflectionProbeAtlas?.(24, 96) ?? null
    )
    const probeGeometryAtlas = await page.evaluate(
      () => window.__levelsjamDebug.captureReflectionProbeGeometryAtlas?.(24, 96) ?? null
    )
    const probeCaptureCounts = await page.evaluate(
      () => window.__levelsjamDebug.getReflectionProbeState()?.probeCaptureCounts?.[24] ?? null
    )
    expect(Array.isArray(probeAtlas)).toBe(true)
    expect(probeAtlas).toHaveLength(6)
    expect(Array.isArray(probeGeometryAtlas)).toBe(true)
    expect(probeGeometryAtlas).toHaveLength(6)
    const probeFaceDetails = probeAtlas.map((faceDataUrl) =>
      measurePngDetail(decodePngDataUrl(faceDataUrl))
    )
    const probeGeometryFaceDetails = probeGeometryAtlas.map((faceDataUrl) =>
      measurePngDetail(decodePngDataUrl(faceDataUrl))
    )
    expect(
      probeFaceDetails.filter((detail) => detail.nonBlackFraction > 0.15).length
    ).toBeGreaterThanOrEqual(4)
    expect(
      probeFaceDetails.filter(
        (detail) => detail.nonBlackFraction > 0.1 && detail.nonBlackFraction < 0.95
      ).length
    ).toBeGreaterThanOrEqual(2)
    expect(
      Math.max(...probeFaceDetails.map((detail) => detail.luminanceStdDev))
    ).toBeGreaterThan(20)
    expect(
      Math.min(...probeFaceDetails.map((detail) => detail.darkest))
    ).toBeLessThan(8)
    expect(
      probeGeometryFaceDetails.filter((detail) => detail.nonBlackFraction > 0.2).length
    ).toBeGreaterThanOrEqual(4)
    expect(
      probeGeometryFaceDetails.filter(
        (detail) => detail.nonBlackFraction > 0.05 && detail.nonBlackFraction < 0.98
      ).length
    ).toBeGreaterThanOrEqual(4)
    expect(
      Math.max(...probeGeometryFaceDetails.map((detail) => detail.luminanceStdDev))
    ).toBeGreaterThan(25)
    expect(
      Math.min(...probeGeometryFaceDetails.map((detail) => detail.darkest))
    ).toBe(0)
    expect(probeCaptureCounts.billboard).toBeGreaterThan(0)
    expect(probeCaptureCounts.ground).toBeGreaterThan(0)
    expect(probeCaptureCounts.sconce).toBeGreaterThan(0)
    expect(probeCaptureCounts.wall).toBeGreaterThan(0)

    await setCheckbox(page, 'Probe IBL', false)
    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [5.4, 1.55, -6.9],
        [7, 1.1, -6]
      )
      for (let index = 0; index < 20; index += 1) {
        window.__levelsjamDebug.setDebugVisible?.('torch-billboard', index, false)
      }
    })
    await page.waitForTimeout(250)
    await page.keyboard.press('Backquote')
    const reflectionCaptureOnFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.72,
      0.74,
      timingProfile
    )
    await page.keyboard.press('Backquote')
    await setCheckbox(page, 'Reflection Captures', false)
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(250)
    const reflectionCaptureOffFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.72,
      0.74,
      timingProfile
    )
    const reflectionCaptureDiff = measureBufferDiff(
      reflectionCaptureOnFrame,
      reflectionCaptureOffFrame
    )

    expect(reflectionCaptureDiff.averagePerChannel).toBeGreaterThan(1)
    expect(reflectionCaptureDiff.maxCombinedDifference).toBeGreaterThan(50)
    await page.keyboard.press('Backquote')
    await setCheckbox(page, 'Reflection Captures', true)
    await setCheckbox(page, 'Probe IBL', false)
  })

  await timedStep(timingProfile, 'volumetric-fog', async () => {
    const volumetricFogIntensitySlider = page.getByRole('slider', {
      name: 'Volumetric Fog Intensity'
    })

    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [5.4, 1.55, -6.9],
        [7, 1.1, -6]
      )
    })
    await page.waitForTimeout(200)

    await setCheckbox(page, 'Volumetric Fog', false)
    await expect(volumetricFogIntensitySlider).toBeDisabled()
    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug.getFogState?.()?.meshCount ?? 0),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toBe(0)
    await setCheckbox(page, 'Volumetric Fog', true)
    await expect(volumetricFogIntensitySlider).toBeEnabled()
    await setSlider(page, 'Volumetric Fog Intensity', 1)
    await setSlider(page, 'Fog Noise Frequency', 6)
    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug.getFogState?.()?.meshCount ?? 0),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toBeGreaterThan(0)
    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug.getFogState?.()),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toMatchObject({
        density: 1,
        noiseFrequency: 6,
        useProbeAmbientTexture: 1
      })

    await setCheckbox(page, 'Reflection Captures', true)
    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug.getFogState?.()?.useProbeAmbientTexture ?? null),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toBe(1)
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(frameBrightness.average).toBeGreaterThan(8)
  expect(frameBrightness.max).toBeGreaterThan(20)
  expect(
    [...resourceUrls].some((url) => url.includes('overcast_soil_1k.hdr'))
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

  timingProfile.totalRunMs = Date.now() - runStartedAt
})
