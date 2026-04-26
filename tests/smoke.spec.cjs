const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')
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
const CURRENT_GIT_BRANCH = execSync('git branch --show-current', {
  cwd: path.resolve(__dirname, '..'),
  encoding: 'utf8'
}).trim()

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

async function measureRafLatency(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const startedAt = performance.now()

    requestAnimationFrame(() => {
      resolve(performance.now() - startedAt)
    })
  }))
}

test('default route loads the authored Entrance level to scene-ready', async ({ page }) => {
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

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('canvas')?.dataset.sceneReady === 'true',
    undefined,
    { timeout: 30_000 }
  )

  const state = await page.evaluate(() => ({
    error: document.body.dataset.mazeLayoutLoadError ?? null,
    lifecycle: window.__levelsjamDebug?.getMazeLifecycleState?.() ?? null,
    loadedMazeId: document.body.dataset.loadedMazeId ?? null,
    requestedMazeId: document.body.dataset.requestedMazeId ?? null
  }))

  expect(state).toMatchObject({
    error: null,
    loadedMazeId: 'entrance',
    requestedMazeId: 'entrance'
  })
  expect(state.lifecycle.loadedMazeIds).toEqual(expect.arrayContaining(['entrance', 'chamber-1']))

  const pressAndWaitForTurn = async (key, expectedPlayer) => {
    await page.keyboard.press(key)
    await expect
      .poll(
        async () => page.evaluate(() => window.__levelsjamDebug?.getTurnStateSummary?.()?.player ?? null),
        {
          timeout: 5_000,
          intervals: [50, 100, 250]
        }
      )
      .toMatchObject(expectedPlayer)
  }

  await pressAndWaitForTurn('KeyW', {
    cell: { x: 1, y: 1 },
    direction: 'north'
  })
  await pressAndWaitForTurn('KeyW', {
    cell: { x: 1, y: 0 },
    direction: 'north'
  })

  const beforeBoundaryMove = await page.evaluate(() => ({
    camera: window.__levelsjamDebug?.getCameraState?.() ?? null,
    sceneMountCount: document.body.dataset.sceneMountCount ?? null,
    turn: window.__levelsjamDebug?.getTurnStateSummary?.() ?? null
  }))

  expect(beforeBoundaryMove.turn.player).toMatchObject({
    cell: { x: 1, y: 0 },
    direction: 'north',
    hasSword: false,
    hasTrophy: false
  })

  await page.keyboard.press('KeyW')

  await page.waitForFunction(
    () => window.__levelsjamDebug?.getMazeLifecycleState?.()?.instantiatedMazeId === 'chamber-1',
    undefined,
    { timeout: 10_000 }
  )

  const transitionedState = await page.evaluate(() => ({
    lifecycle: window.__levelsjamDebug?.getMazeLifecycleState?.() ?? null,
    camera: window.__levelsjamDebug?.getCameraState?.() ?? null,
    sceneMountCount: document.body.dataset.sceneMountCount ?? null,
    turn: window.__levelsjamDebug?.getTurnStateSummary?.() ?? null
  }))

  expect(transitionedState.lifecycle.loadedMazeIds).toEqual(
    expect.arrayContaining(['entrance', 'chamber-1', 'maze-001', 'maze-002', 'maze-003', 'maze-005'])
  )
  expect(transitionedState.turn.escaped).toBe(false)
  expect(transitionedState.turn.player.cell).toEqual({ x: 2, y: 17 })
  expect(transitionedState.turn.player).toMatchObject({
    direction: 'north',
    hasSword: false,
    hasTrophy: false
  })
  expect(transitionedState.sceneMountCount).toBe(beforeBoundaryMove.sceneMountCount)
  expect(Math.abs(transitionedState.camera.yaw - beforeBoundaryMove.camera.yaw)).toBeLessThan(0.001)
  expect(Math.abs(transitionedState.camera.pitch - beforeBoundaryMove.camera.pitch)).toBeLessThan(0.001)

  await pressAndWaitForTurn('ArrowRight', {
    cell: { x: 2, y: 17 },
    direction: 'east'
  })
  await pressAndWaitForTurn('ArrowRight', {
    cell: { x: 2, y: 17 },
    direction: 'south'
  })
  const beforeReturnMove = await page.evaluate(() => ({
    camera: window.__levelsjamDebug?.getCameraState?.() ?? null,
    sceneMountCount: document.body.dataset.sceneMountCount ?? null,
    turn: window.__levelsjamDebug?.getTurnStateSummary?.() ?? null
  }))

  expect(beforeReturnMove.turn.player).toMatchObject({
    cell: { x: 2, y: 17 },
    direction: 'south',
    hasSword: false,
    hasTrophy: false
  })

  await page.keyboard.press('KeyW')
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getMazeLifecycleState?.()?.instantiatedMazeId === 'entrance',
    undefined,
    { timeout: 10_000 }
  )

  const returnedState = await page.evaluate(() => ({
    camera: window.__levelsjamDebug?.getCameraState?.() ?? null,
    sceneMountCount: document.body.dataset.sceneMountCount ?? null,
    turn: window.__levelsjamDebug?.getTurnStateSummary?.() ?? null
  }))

  expect(returnedState.turn.escaped).toBe(false)
  expect(returnedState.turn.player).toMatchObject({
    cell: { x: 1, y: 0 },
    direction: 'south',
    hasSword: false,
    hasTrophy: false
  })
  expect(returnedState.sceneMountCount).toBe(beforeBoundaryMove.sceneMountCount)
  expect(Math.abs(returnedState.camera.yaw - beforeReturnMove.camera.yaw)).toBeLessThan(0.001)
  expect(Math.abs(returnedState.camera.pitch - beforeReturnMove.camera.pitch)).toBeLessThan(0.001)
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('loads the maze scene and exposes working debug/render controls', async ({ page }) => {
  const consoleErrors = []
  const pageErrors = []
  const resourceUrls = new Set()
  const timingProfile = createSmokeTimingProfile()
  const runStartedAt = Date.now()
  let loadingCompleteAtMs = Number.NaN
  let shellVisibleAtMs = Number.NaN
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
    shellVisibleAtMs = await page.evaluate(() => performance.now())
    const initialHtml = await response.text()

    expect(initialHtml).toContain('bootstrap-loading-shell')
    expect(initialHtml).toContain('MINOTAUR')
    expect(initialHtml).toContain('Entering the labyrinth')

    if (await loadingOverlay.count()) {
      await expect
        .poll(
          async () => page.evaluate(() => {
            const dots = document.querySelector('.loading-overlay-dots')

            if (!dots) {
              return null
            }

            return getComputedStyle(dots, '::after').animationName
          }),
          {
            timeout: 5_000,
            intervals: [100, 250, 500]
          }
        )
        .toBe('loading-overlay-dots')
      await expect
        .poll(
          async () => loadingOverlay.getAttribute('data-loading-complete'),
          {
            timeout: 180_000,
            intervals: [250, 500, 1_000]
          }
        )
        .toBe('true')
      loadingCompleteAtMs = await page.evaluate(() => {
        const marker = Number(document.body.dataset.loadingOverlayCompleteAt ?? 'NaN')

        return Number.isFinite(marker) ? marker : performance.now()
      })
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

  await timedStep(timingProfile, 'debug-controls', async () => {
    await expect(page.locator('.fps-counter')).toContainText('FPS', { timeout: 5_000 })
    await expect(page.locator('.fps-counter')).toContainText('maze-001')
    await expect(page.locator('.fps-counter')).toContainText(`${CURRENT_GIT_BRANCH}@`)
    await expect(page.locator('.fps-counter')).not.toContainText('unknown')

    await page.keyboard.press('Backquote')
    await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
      timeout: 5_000
    })

    await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('0')
    await expect(page.getByRole('slider', { name: 'Camera FOV' })).toHaveValue('80')
    await expect(page.getByRole('slider', { name: 'Camera FOV' })).toHaveAttribute('max', '120')
    await setSlider(page, 'Camera FOV', 100)
    await expect(page.getByRole('slider', { name: 'Camera FOV' })).toHaveValue('100')
    await expect
      .poll(
        async () => canvas.getAttribute('data-camera-fov'),
        {
          timeout: 2_000,
          intervals: [50, 100, 250]
        }
      )
      .toBe('100.00')
    await setSlider(page, 'Camera FOV', 80)
    await expect(page.getByLabel('Surface Lightmap Enabled')).toBeVisible()
    await expect(page.getByLabel('Surface Lightmap Enabled')).toBeChecked()
    await expect(page.getByRole('slider', { name: 'Surface Lightmap' })).toHaveValue('1')
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
    await expect(page.getByLabel('Probe Debug', { exact: true })).toBeVisible()
    await page.keyboard.press('Digit7')
    await expect(page.getByRole('slider', { name: 'Volumetric Fog Intensity' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Volumetric Fog Intensity' })).toHaveValue('0.75')
    await expect(page.getByLabel('Fog Ambient Color Hex')).toHaveValue('#2c2c68')
    await expect(page.getByLabel('Fog Ambient Color Picker')).toHaveValue('#2c2c68')
    await expect(page.getByRole('slider', { name: 'Fog Distance' })).toHaveValue('12')
    await expect(page.getByRole('slider', { name: 'Fog Noise Frequency' })).toHaveValue('0.25')
    await expect(page.getByRole('slider', { name: 'Fog Noise Period' })).toHaveValue('0.75')
    await expect(page.getByRole('slider', { name: 'Fog Height 50%' })).toHaveValue('0.4')
    await page.keyboard.press('Digit1')
    await expect(page.getByRole('slider', { name: 'Exposure' })).toBeVisible()

    const swordStrikeFadeState = await page.evaluate(async () => {
      document.body.dataset.playerEffect = 'sword-strike'
      await new Promise((resolve) => setTimeout(resolve, 150))
      const fadeIn = window.__levelsjamDebug.getPlayerFadeState()
      document.body.dataset.playerEffect = 'sword-strike-out'
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const fadeOut = window.__levelsjamDebug.getPlayerFadeState()
      delete document.body.dataset.playerEffect

      return { fadeIn, fadeOut }
    })

    expect(swordStrikeFadeState.fadeIn.name).toBe('sword-strike')
    expect(swordStrikeFadeState.fadeIn.alpha).toBeGreaterThan(0.9)
    expect(swordStrikeFadeState.fadeIn.color).toEqual([0.5, 0, 0])
    expect(swordStrikeFadeState.fadeOut.name).toBe('sword-strike-out')
    expect(swordStrikeFadeState.fadeOut.color).toEqual([0.5, 0, 0])

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
          depthTest: true,
          depthWrite: true,
          mode: 'reflection',
          toneMapped: true,
          uniformTextureUUIDs: {
            probeCubeUvMap: expect.any(String)
          },
          visible: true
        }
      })
    const probeVisualizationState = await page.evaluate(
      () => {
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
      }
    )
    expect(
      probeVisualizationState.visualizationState.uniformTextureUUIDs.probeCubeUvMap
    ).toBe(probeVisualizationState.probeTextureState.processedTextureUUID)
    await page.getByLabel('Probe Debug', { exact: true }).selectOption('none')
  })

  await timedStep(timingProfile, 'reflection-captures', async () => {
    await setCheckbox(page, 'Precomputed Visibility', false)
    await page.evaluate(() => {
      window.__levelsjamDebug.setView(
        [5.4, 1.55, -6.9],
        [7, 1.1, -6]
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
          () => ({
            ground: Array.from({ length: 200 }, (_, index) =>
              window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', index)
            ).find((state) => state?.hasLightMap) ?? null,
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
          hasLightMap: true,
          probeBlend: {
            diffuseIntensity: 0,
            mode: 'disabled',
            probeConnectivity: true
          }
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
        async () => page.evaluate(() => ({
          ground: Array.from({ length: 200 }, (_, index) =>
            window.__levelsjamDebug.getDebugMeshState('maze-ground-lightmap', index)
          ).find(Boolean) ?? null,
          wall: Array.from({ length: 200 }, (_, index) =>
            window.__levelsjamDebug.getDebugMeshState('maze-wall', index)
          ).find((state) => state?.probeBlend) ?? null
        })),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        ground: {
          hasLightMap: false,
          probeBlend: {
            diffuseIntensity: 1,
            mode: 'disabled',
            probeConnectivity: true,
            radianceIntensity: 1,
            radianceMode: 'disabled'
          }
        },
        wall: {
          hasLightMap: false,
          probeBlend: {
            diffuseIntensity: 1,
            radianceIntensity: 1,
            mode: 'disabled',
            radianceMode: 'disabled'
          }
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

    await setCheckbox(page, 'Reflection Intensity Enabled', false)
    await page.evaluate(() => window.__levelsjamBenchmark?.(5))
    await expect
      .poll(
        async () => page.evaluate(() => ({
          wall: Array.from({ length: 200 }, (_, index) =>
            window.__levelsjamDebug.getDebugMeshState('maze-wall', index)
          ).find(Boolean) ?? null
        })),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        wall: {
          hasMap: true,
          visible: expect.any(Boolean)
        }
      })
    await setCheckbox(page, 'Reflection Intensity Enabled', true)
    await setCheckbox(page, 'Static Volumetric Enabled', false)
    await setCheckbox(page, 'Surface Lightmap Enabled', true)
    await page.keyboard.press('7')
    await expect
      .poll(
        async () => page.evaluate(
          () => window.__levelsjamDebug.getFogState?.() ?? null
        ),
        {
          timeout: 5_000,
          intervals: [100, 250, 500]
        }
      )
      .toMatchObject({
        density: 0.75,
        heightFalloff: 0.4,
        noiseFrequency: 0.25,
        noisePeriod: 0.75,
        useProbeAmbientTexture: 0
      })
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(shellVisibleAtMs).toBeLessThan(1_000)
  expect(loadingCompleteAtMs).toBeLessThan(5_000)
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

  timingProfile.loadingCompleteAtMs = loadingCompleteAtMs
  timingProfile.shellVisibleAtMs = shellVisibleAtMs
  timingProfile.totalRunMs = Date.now() - runStartedAt
})

test('maze-003 remains responsive through background probe loading', async ({ page }) => {
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

  await page.goto('/?maze=maze-003', { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 180_000,
      intervals: [250, 500, 1_000]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(
      () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready ?? false
    ), {
      timeout: 30_000,
      intervals: [250, 500, 1_000]
    })
    .toBe(true)
  await page.waitForTimeout(20_000)
  await expect(page.locator('.fps-counter')).toContainText('maze-003')
  await page.keyboard.press('Backquote')
  await expect(page.locator('[data-testid="visual-controls"]')).toBeVisible({
    timeout: 5_000
  })

  const rafLatencyMs = await measureRafLatency(page)
  const probeAndMemoryState = await page.evaluate(() => {
    const probeState = window.__levelsjamDebug?.getReflectionProbeState?.() ?? null
    const memoryState = window.__levelsjamDebug?.getRuntimeMemoryHighWater?.() ?? null

    return {
      currentEstimatedTextureBytes: memoryState?.current?.estimatedTextureBytes ?? 0,
      highWaterEstimatedTextureBytes: memoryState?.highWater?.estimatedTextureBytes ?? 0,
      loadedProbeCount: probeState?.loadedProbeCount ?? 0,
      residentProbeLimit: probeState?.residentProbeLimit ?? null,
      textureMemoryBudgetBytes: probeState?.textureMemoryBudgetBytes ?? null
    }
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(rafLatencyMs).toBeLessThan(500)
  expect(probeAndMemoryState.loadedProbeCount).toBeGreaterThan(0)
  expect(probeAndMemoryState.loadedProbeCount).toBeLessThanOrEqual(
    probeAndMemoryState.residentProbeLimit
  )
  expect(probeAndMemoryState.currentEstimatedTextureBytes).toBeLessThanOrEqual(
    probeAndMemoryState.textureMemoryBudgetBytes
  )
  expect(probeAndMemoryState.highWaterEstimatedTextureBytes).toBeLessThanOrEqual(
    probeAndMemoryState.textureMemoryBudgetBytes
  )
})

test('runtime probe assets stay loaded when volumetric fog is toggled', async ({ page }) => {
  await page.goto('/?maze=maze-001', { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 180_000,
      intervals: [250, 500, 1_000]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(
      () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready ?? false
    ), {
      timeout: 180_000,
      intervals: [250, 500, 1_000]
    })
    .toBe(true)

  await expect
    .poll(async () => page.evaluate(
      () => window.__levelsjamDebug.getReflectionProbeState()
    ), {
      timeout: 30_000,
      intervals: [250, 500, 1_000]
    })
    .toMatchObject({
      loadedProbeCount: expect.any(Number),
      ready: true
    })

  const stableBeforeToggle = await page.evaluate(
    () => window.__levelsjamDebug.getReflectionProbeState()
  )

  await page.evaluate(() => {
    window.__levelsjamSetVisualSettings({
      volumetricLighting: {
        enabled: false,
        intensity: 0
      }
    })
  })
  await page.waitForTimeout(2_000)

  const afterDisable = await page.evaluate(
    () => window.__levelsjamDebug.getReflectionProbeState()
  )

  await page.evaluate(() => {
    window.__levelsjamSetVisualSettings({
      volumetricLighting: {
        enabled: true,
        intensity: 1
      }
    })
  })
  await page.waitForTimeout(2_000)

  const afterEnable = await page.evaluate(
    () => window.__levelsjamDebug.getReflectionProbeState()
  )

  expect(stableBeforeToggle.ready).toBe(true)
  expect(stableBeforeToggle.loadedProbeCount).toBeGreaterThan(0)
  expect(afterDisable.ready).toBe(true)
  expect(afterEnable.ready).toBe(true)
  expect(afterDisable.loadedProbeCount).toBeGreaterThanOrEqual(stableBeforeToggle.loadedProbeCount)
  expect(afterEnable.loadedProbeCount).toBeGreaterThanOrEqual(stableBeforeToggle.loadedProbeCount)
})
