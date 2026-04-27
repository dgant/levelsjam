const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(300_000)

const RENDER_TIMING_LOG_PATH = path.resolve(
  __dirname,
  '..',
  'logs',
  'latest-render-integration-profile.json'
)
let activeSmokeTimingProfile = null

function createSmokeTimingProfile() {
  return {
    measurements: {},
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

  fs.mkdirSync(path.dirname(RENDER_TIMING_LOG_PATH), { recursive: true })
  fs.writeFileSync(
    RENDER_TIMING_LOG_PATH,
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
  await page.getByRole('slider', { exact: true, name: label }).evaluate((element, nextValue) => {
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
  await page.getByRole('checkbox', { exact: true, name: label }).evaluate((element, nextEnabled) => {
    if (element.checked !== Boolean(nextEnabled)) {
      element.click()
    }
  }, enabled)
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

  const bootstrapLoadingOverlay = page.locator('#bootstrap-loading-shell .loading-overlay')
  const loadingOverlay = page.locator('#root .loading-overlay')
  const canvas = page.locator('canvas')

  await timedStep(timingProfile, 'startup', async () => {
    const response = await page.goto('/?maze=maze-001', { waitUntil: 'commit' })
    const initialHtml = await response.text()

    expect(initialHtml).toContain('bootstrap-loading-shell')
    expect(initialHtml).toContain('MINOTAUR')
    expect(initialHtml).toContain('Entering the labyrinth')

    if (await loadingOverlay.count()) {
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

    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('0')
    await expect(page.getByLabel('Surface Lightmap Enabled')).toBeVisible()
    await expect(page.getByLabel('Surface Lightmap Enabled')).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Surface Lightmap' })).toHaveValue('1')
    await expect(page.getByLabel('Surface Lightmap Source')).toHaveValue('default')
    await expect(page.getByLabel('Dynamic Volumetric Enabled')).toBeVisible()
    await expect(page.getByLabel('Dynamic Volumetric Enabled')).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Dynamic Volumetric' })).toHaveValue('1')
    await expect(page.getByLabel('Static Volumetric Enabled')).toBeVisible()
    await expect(page.getByLabel('Static Volumetric Enabled')).not.toBeChecked()
    await expect(page.getByRole('slider', { name: 'Static Volumetric' })).toHaveValue('1')
    await expect(page.getByLabel('Volumetric Occlusion Enabled')).toBeVisible()
    await expect(page.getByLabel('Volumetric Occlusion Enabled')).toBeChecked()
    await expect(page.getByLabel('Reflection Intensity Enabled')).toBeVisible()
    await expect(page.getByLabel('Reflection Intensity Enabled')).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Reflection Intensity' })).toHaveValue('1')

    await page.getByRole('button', { name: '2. AO' }).click()
    await expect(page.getByLabel('Ambient Occlusion', { exact: true })).toHaveValue('n8ao')
    await expect(page.getByRole('slider', { name: 'AO Radius' })).toHaveValue('1')

    await page.getByRole('button', { name: '3. Bloom' }).click()
    await expect(page.getByRole('slider', { name: 'Bloom Intensity' })).toHaveValue('0.65')
    await expect(page.getByLabel('Bloom Kernel', { exact: true })).toHaveValue('huge')
    await expect(page.getByRole('slider', { name: 'Bloom Threshold' })).toHaveValue('0.5')
    await expect(page.getByRole('slider', { name: 'Bloom Smoothing' })).toHaveValue('0.5')
    await expect(page.getByRole('slider', { name: 'Bloom Resolution' })).toHaveValue('0.25')

    await page.getByRole('button', { name: '5. Flares' }).click()
    await expect(page.getByRole('slider', { name: 'Lens Flares Intensity' })).toHaveValue('0.1')
    await expect(page.getByRole('slider', { name: 'Flare Opacity' })).toHaveValue('0.1')
    await expect(page.getByRole('slider', { name: 'Flare Size' })).toHaveValue('0.01')
    await expect(page.getByRole('slider', { name: 'Glare Size' })).toHaveValue('0')
    await expect(page.getByRole('slider', { name: 'Ghost Scale' })).toHaveValue('0')
    await expect(page.getByRole('slider', { name: 'Flare Shape' })).toHaveValue('0.03')

    await page.getByRole('button', { name: '8. Vignette' }).click()
    await expect(page.getByRole('slider', { name: 'Vignette Intensity' })).toHaveValue('0.6')
    await expect(page.getByRole('slider', { name: 'Vignette Noise Period' })).toHaveValue('5')
    await expect(page.getByRole('slider', { name: 'Vignette Noise Intensity' })).toHaveValue('0')
    await expect(page.getByRole('slider', { name: 'Exposure Noise Intensity' })).toHaveValue('0')
    await page.getByRole('button', { name: '1. Core' }).click()

    await setSlider(page, 'Exposure', 1.25)
    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('1.25')
    await page
      .locator('[data-testid="visual-controls"] span[title="Double-click to reset"]')
      .filter({ hasText: 'Exposure' })
      .dblclick()
    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('0')

    await page.keyboard.press('Backquote')
    await page.keyboard.press('KeyC')
    await expect(page.getByRole('dialog', { name: 'Credits' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Credits' })).toContainText('Minotaur')
    await expect(page.getByRole('dialog', { name: 'Credits' })).toContainText('PBR Jumping Spider Monster')
    await expect(page.getByRole('dialog', { name: 'Credits' })).toContainText('AWIL Werewolf')
    await page.keyboard.press('KeyX')
    await expect(page.getByRole('dialog', { name: 'Credits' })).toBeHidden()
    await page.keyboard.press('Backquote')
  })

  await timedStep(timingProfile, 'reflection-captures', async () => {
    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [0, 1.8, -14],
        [0, 1.3, 6]
      )
    })
    await page.waitForTimeout(250)
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
          () => Array.from({ length: 200 }, (_, index) =>
            window.__levelsjamDebug.getDebugMeshState('maze-wall', index)
          ).find(Boolean) ?? null
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
          () => window.__levelsjamDebug.getReflectionProbeState?.()?.loadedProbeCount ?? 0
        ),
        {
          timeout: 60_000,
          intervals: [100, 250, 500, 1_000]
        }
      )
      .toBeGreaterThan(0)
    await expect
      .poll(
        async () => page.evaluate(
          () => ({
            ground: window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 4),
            wall: Array.from({ length: 200 }, (_, index) =>
              window.__levelsjamDebug.getDebugMeshState('maze-wall', index)
            ).find(Boolean) ?? null
          })
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        ground: {
          hasLightMap: true
        },
        wall: {
          hasLightMap: true
        }
      })
    await setCheckbox(page, 'Static Volumetric Enabled', true)
    await setSlider(page, 'Static Volumetric', 1)
    await setCheckbox(page, 'Surface Lightmap Enabled', false)
    await expect
      .poll(
        async () => page.evaluate(
          () => ({
            ground: window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', 4),
            wall: Array.from({ length: 200 }, (_, index) =>
              window.__levelsjamDebug.getDebugMeshState('maze-wall', index)
            ).find(Boolean) ?? null
          })
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        ground: {
          hasLightMap: false
        },
        wall: {
          hasLightMap: false
        }
      })
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getReflectionProbeState?.() ?? null
        ),
        {
          timeout: 10_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        loadedProbeCount: expect.any(Number),
        probeTextureUUIDs: expect.any(Array)
      })
    const probeState = await page.evaluate(
      () => window.__levelsjamDebug.getReflectionProbeState?.() ?? null
    )
    expect(probeState.loadedProbeCount).toBeGreaterThan(0)
    expect(
      probeState.probeTextureUUIDs.filter(Boolean).length
    ).toBeGreaterThan(0)

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
    await page.keyboard.press('Backquote')
    await setCheckbox(page, 'Static Volumetric Enabled', false)
    await setCheckbox(page, 'Surface Lightmap Enabled', true)
    await setCheckbox(page, 'Reflection Intensity Enabled', false)
    await setCheckbox(page, 'Reflection Intensity Enabled', true)
    await setCheckbox(page, 'Static Volumetric Enabled', false)
    await setCheckbox(page, 'Surface Lightmap Enabled', true)
  })

  await timedStep(timingProfile, 'probe-debug-visualization', async () => {
    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [5.4, 1.55, -6.9],
        [7, 1.1, -6]
      )
    })
    await page.waitForTimeout(250)

    await page.getByRole('button', { name: '1. Core' }).click()
    await page.getByLabel('Probe Debug', { exact: true }).selectOption('none')
    await page.waitForTimeout(250)
    await expect
      .poll(
        async () => page.evaluate(() => {
          const probeState = window.__levelsjamDebug.getReflectionProbeState?.()
          const probeCount = probeState?.probeCount ?? 0
          let loadedProbeIndex = null

          for (let index = 0; index < probeCount; index += 1) {
            const textureState = window.__levelsjamDebug.getReflectionProbeTextureState?.(index)

            if (textureState?.processedTextureUUID) {
              loadedProbeIndex = index
              break
            }
          }

          return loadedProbeIndex === null
            ? null
            : window.__levelsjamDebug.getReflectionProbeVisualizationState?.(loadedProbeIndex) ?? null
        }),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toBeNull()

    await page.getByLabel('Probe Debug', { exact: true }).selectOption('reflection')
    await expect
      .poll(
        async () => page.evaluate(() => {
          const probeState = window.__levelsjamDebug.getReflectionProbeState?.()
          const probeCount = probeState?.probeCount ?? 0
          let loadedProbeIndex = null

          for (let index = 0; index < probeCount; index += 1) {
            const textureState = window.__levelsjamDebug.getReflectionProbeTextureState?.(index)

            if (textureState?.processedTextureUUID) {
              loadedProbeIndex = index
              break
            }
          }

          return {
            loadedProbeIndex,
            probeTextureState:
              loadedProbeIndex !== null
                ? window.__levelsjamDebug.getReflectionProbeTextureState?.(loadedProbeIndex) ?? null
                : null,
            visualizationState:
              loadedProbeIndex !== null
                ? window.__levelsjamDebug.getReflectionProbeVisualizationState?.(loadedProbeIndex) ?? null
                : null
          }
        }),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        loadedProbeIndex: expect.any(Number),
        probeTextureState: {
          processedTextureUUID: expect.any(String)
        },
        visualizationState: {
          mode: 'reflection',
          uniformTextureUUIDs: {
            probeCubeUvMap: expect.any(String)
          },
          visible: true
        }
      })

    await page.getByLabel('Probe Debug', { exact: true }).selectOption('volumetric-lightmap')
    await expect
      .poll(
        async () => page.evaluate(() => {
          const probeState = window.__levelsjamDebug.getReflectionProbeState?.()
          const probeCount = probeState?.probeCount ?? 0
          let loadedProbeIndex = null

          for (let index = 0; index < probeCount; index += 1) {
            const textureState = window.__levelsjamDebug.getReflectionProbeTextureState?.(index)

            if (textureState?.processedTextureUUID) {
              loadedProbeIndex = index
              break
            }
          }

          return loadedProbeIndex !== null
            ? window.__levelsjamDebug.getReflectionProbeVisualizationState?.(loadedProbeIndex) ?? null
            : null
        }),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        mode: 'volumetric-lightmap',
        uniformTextureUUIDs: {
          coeffL0: '__coefficients__',
          probeCubeUvMap: null
        },
        visible: true
      })

    await page.getByLabel('Probe Debug', { exact: true }).selectOption('none')
  })

  await timedStep(timingProfile, 'ssr', async () => {
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

    await page.getByRole('button', { name: '6. SSR' }).click()
    await setCheckbox(page, 'SSR', false)
    await page.waitForTimeout(250)
    const ssrOffFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.4,
      0.55,
      timingProfile
    )

    await setCheckbox(page, 'SSR', true)
    await setSlider(page, 'SSR Intensity', 1)
    await page.getByLabel('SSR Output', { exact: true }).selectOption('default')
    await page.waitForTimeout(500)
    const ssrOnFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.4,
      0.55,
      timingProfile
    )

    const ssrDiff = measureBufferDiff(ssrOnFrame, ssrOffFrame)
    timingProfile.measurements.ssrDiff = ssrDiff

    expect(ssrDiff.averagePerChannel).toBeGreaterThan(0.5)
    expect(ssrDiff.maxCombinedDifference).toBeGreaterThan(40)

    await setCheckbox(page, 'SSR', false)
    await page.evaluate(() => {
      for (let index = 0; index < 20; index += 1) {
        window.__levelsjamDebug.setDebugVisible?.('torch-billboard', index, true)
      }
    })
  })

  await timedStep(timingProfile, 'volumetric-fog', async () => {
    await page.getByRole('button', { name: '7. Fog' }).click()
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
    await setSlider(page, 'Fog Distance', 12)
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
        fogDistance: 12,
        noiseFrequency: 6,
        useProbeAmbientTexture: 0,
        useProbeCoefficientTexture: 1,
        useProbeConnectivity: 1
      })

    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug.getFogState?.()?.useProbeCoefficientTexture ?? null),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toBe(1)

    await setSlider(page, 'Volumetric Fog Intensity', 0)
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(250)
    const fogOffFrame = await screenshotCanvasRegion(
      page,
      canvas,
      320,
      200,
      0.5,
      0.6,
      timingProfile
    )
    await page.keyboard.press('Backquote')
    await page.getByRole('button', { name: '7. Fog' }).click()
    await setSlider(page, 'Volumetric Fog Intensity', 1)
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(250)
    const fogOnFrame = await screenshotCanvasRegion(
      page,
      canvas,
      320,
      200,
      0.5,
      0.6,
      timingProfile
    )
    const fogDiff = measureBufferDiff(fogOnFrame, fogOffFrame)
    timingProfile.measurements.fogDiff = fogDiff

    expect(fogDiff.averagePerChannel).toBeGreaterThan(0.05)
    expect(fogDiff.maxCombinedDifference).toBeGreaterThan(10)

    await page.keyboard.press('Backquote')
    await page.getByRole('button', { name: '7. Fog' }).click()
    await setCheckbox(page, 'Volumetric Fog', false)
  })

  await timedStep(timingProfile, 'lens-flares', async () => {
    await page.getByRole('button', { name: '5. Flares' }).click()
    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [0, 1.55, 3.95],
        [0, 1.225, 2.75]
      )
    })
    await page.waitForTimeout(200)
    await setCheckbox(page, 'Lens Flares', true)
    await setSlider(page, 'Lens Flares Intensity', 0)
    await setSlider(page, 'Flare Opacity', 1)
    await setSlider(page, 'Flare Size', 0.05)
    await setSlider(page, 'Glare Size', 0.1)
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(250)
    const lensFlareOffFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.5,
      0.5,
      timingProfile
    )
    await page.keyboard.press('Backquote')
    await page.getByRole('button', { name: '5. Flares' }).click()
    await setSlider(page, 'Lens Flares Intensity', 1)
    await page.keyboard.press('Backquote')
    await page.waitForTimeout(500)
    const lensFlareOnFrame = await screenshotCanvasRegion(
      page,
      canvas,
      260,
      180,
      0.5,
      0.5,
      timingProfile
    )
    const lensFlareDiff = measureBufferDiff(
      lensFlareOnFrame,
      lensFlareOffFrame
    )
    timingProfile.measurements.lensFlareDiff = lensFlareDiff

    expect(lensFlareDiff.averagePerChannel).toBeGreaterThan(0.1)
    expect(lensFlareDiff.maxCombinedDifference).toBeGreaterThan(25)

    await page.keyboard.press('Backquote')
    await page.getByRole('button', { name: '5. Flares' }).click()
    await setCheckbox(page, 'Lens Flares', false)
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
      url.includes('CampFire_l_nosmoke_front_Loop_01_4K_6x6')
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
