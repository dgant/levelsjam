const { expect, test } = require('@playwright/test')

test.setTimeout(120_000)

const TARGET_FPS = 144
const MIN_ACCEPTABLE_REPLAY_FPS = TARGET_FPS * 0.85

async function waitForSceneReady(page, mazeId = 'maze-001') {
  const loadingOverlay = page.locator('#root .loading-overlay')

  await page.setViewportSize({ width: 2560, height: 1440 })
  await page.goto(`/?maze=${mazeId}`, { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => loadingOverlay.getAttribute('data-loading-complete'), {
      timeout: 12_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')
  await expect
    .poll(async () => {
      return page.evaluate(() => ({
        benchmark: typeof window.__levelsjamBenchmark,
        setVisualSettings: typeof window.__levelsjamSetVisualSettings
      }))
    }, {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      benchmark: 'function',
      setVisualSettings: 'function'
    })
}

async function waitForProbeResidency(page) {
  await expect
    .poll(async () => page.evaluate(() => {
      const probeState = window.__levelsjamDebug?.getReflectionProbeState?.()
      const memoryState = window.__levelsjamDebug?.getRuntimeMemoryHighWater?.()

      return {
        currentEstimatedTextureBytes: memoryState?.current?.estimatedTextureBytes ?? 0,
        highWaterEstimatedTextureBytes: memoryState?.highWater?.estimatedTextureBytes ?? 0,
        loadedProbeCount: probeState?.loadedProbeCount ?? 0,
        ready: probeState?.ready ?? false,
        residentProbeLimit: probeState?.residentProbeLimit ?? null,
        textureMemoryBudgetBytes: probeState?.textureMemoryBudgetBytes ?? null
      }
    }), {
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      ready: true,
      residentProbeLimit: expect.any(Number),
      textureMemoryBudgetBytes: expect.any(Number)
    })

  await page.waitForTimeout(5_000)

  const state = await page.evaluate(() => {
    const probeState = window.__levelsjamDebug.getReflectionProbeState()
    const memoryState = window.__levelsjamDebug.getRuntimeMemoryHighWater()

    return {
      currentEstimatedTextureBytes: memoryState.current.estimatedTextureBytes,
      highWaterEstimatedTextureBytes: memoryState.highWater.estimatedTextureBytes,
      loadedProbeCount: probeState.loadedProbeCount,
      residentProbeLimit: probeState.residentProbeLimit,
      textureMemoryBudgetBytes: probeState.textureMemoryBudgetBytes
    }
  })

  expect(state.loadedProbeCount).toBeGreaterThan(0)
  expect(state.loadedProbeCount).toBeLessThanOrEqual(state.residentProbeLimit)
  expect(state.currentEstimatedTextureBytes).toBeLessThanOrEqual(state.textureMemoryBudgetBytes)
  expect(state.highWaterEstimatedTextureBytes).toBeLessThanOrEqual(state.textureMemoryBudgetBytes)
  return state
}

async function waitForRuntimeModelCache(page) {
  await expect
    .poll(async () => page.evaluate(() =>
      window.__levelsjamDebug?.getMazeLifecycleState?.().cachedGltfRootUrls?.length ?? 0
    ), {
      timeout: 30_000,
      intervals: [100, 250, 500]
    })
    .toBeGreaterThanOrEqual(3)
}

async function installStartupRafMonitor(page) {
  await page.addInitScript(() => {
    window.__levelsjamStartupRaf = {
      deltasOver50: [],
      longTasks: [],
      maxDelta: 0,
      over250: 0,
      samples: 0
    }
    let lastFrameTime = performance.now()

    const tick = (frameTime) => {
      const delta = frameTime - lastFrameTime
      const monitor = window.__levelsjamStartupRaf

      lastFrameTime = frameTime
      monitor.samples += 1
      monitor.maxDelta = Math.max(monitor.maxDelta, delta)

      if (delta > 250) {
        monitor.over250 += 1
      }
      if (delta > 50) {
        monitor.deltasOver50.push({
          delta,
          time: frameTime
        })
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__levelsjamStartupRaf.longTasks.push({
            duration: entry.duration,
            start: entry.startTime
          })
        }
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Long-task reporting is unavailable in some browser contexts.
    }
  })
}

test('startup remains responsive while loading lightmaps and probes', async ({ page }) => {
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

  page.on('requestfinished', (request) => {
    resourceUrls.add(request.url())
  })

  await installStartupRafMonitor(page)
  await page.goto('/?maze=maze-001', { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 8_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')
  await page.waitForTimeout(1_000)

  const startup = await page.evaluate(() => ({
    loadingCompleteAt: Number(document.body.dataset.loadingOverlayCompleteAt ?? 'NaN'),
    monitor: window.__levelsjamStartupRaf,
    markers: { ...document.body.dataset }
  }))

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(startup.loadingCompleteAt).toBeLessThan(5_000)
  expect(startup.monitor.samples).toBeGreaterThan(60)
  expect(startup.monitor.maxDelta).toBeLessThan(900)
  expect(startup.monitor.longTasks.every((entry) => entry.duration < 900)).toBe(true)
  expect([...resourceUrls].some((url) => url.includes('surface-lightmap.bin'))).toBe(false)
  expect([...resourceUrls].some((url) => url.includes('surface-lightmap-rgbe.png'))).toBe(true)
  expect([...resourceUrls].some((url) => url.includes('/textures/runtime/stone-wall-29/'))).toBe(true)
  expect([...resourceUrls].some((url) => url.includes('/textures/stone-wall-29/stonewall_29-1K/'))).toBe(false)
  expect([...resourceUrls].some((url) => url.includes('/textures/runtime/fire/'))).toBe(false)
})

async function benchmarkWithSettings(page, patch) {
  return page.evaluate(async ({ patch }) => {
    window.__levelsjamDebug.setView?.(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
    window.__levelsjamSetVisualSettings?.(patch)
    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(90)
  }, { patch })
}

async function benchmarkInitialGameplayView(page, patch) {
  return page.evaluate(async ({ patch }) => {
    window.__levelsjamDebug.setView?.(
      [4, 1.55, -6],
      [4, 1.1, -4]
    )
    window.__levelsjamSetVisualSettings?.(patch)
    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(90)
  }, { patch })
}

async function moveChamberPlayerToExitSightline(page) {
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('KeyW')
    await page.waitForTimeout(320)
  }

  await expect
    .poll(async () => page.evaluate(() =>
      window.__levelsjamDebug?.getTurnStateSummary?.()?.player?.cell ?? null
    ), {
      timeout: 5_000,
      intervals: [100, 250]
    })
    .toEqual({ x: 2, y: 13 })
}

async function benchmarkMonsterView(page, monsterType, patch) {
  await page.evaluate(() => {
    window.__levelsjamSetVisualSettings?.({
      precomputedVisibilityEnabled: false
    })
  })

  await expect
    .poll(async () => page.evaluate(() =>
      Array.from({ length: 3 }, (_, index) => window.__levelsjamDebug.getMonsterRenderState?.(index))
    ), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toContainEqual(expect.objectContaining({ type: monsterType }))

  return page.evaluate(async ({ monsterType, patch }) => {
    const monsters = Array.from({ length: 3 }, (_, index) => ({
      index,
      position: window.__levelsjamDebug.getDebugPosition?.('monster', index) ?? null,
      state: window.__levelsjamDebug.getMonsterRenderState?.(index) ?? null
    }))
    const target = monsters.find((monster) => monster.state?.type === monsterType)

    if (!target?.position) {
      return null
    }

    window.__levelsjamDebug.setView?.(
      [target.position[0] + 1.8, target.position[1] + 1.0, target.position[2] + 1.8],
      [target.position[0], target.position[1] + 0.7, target.position[2]]
    )
    window.__levelsjamSetVisualSettings?.({
      ...patch,
      precomputedVisibilityEnabled: true
    })
    for (let index = 0; index < 5; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(90)
  }, { monsterType, patch })
}

test('GPU-backed scene benchmark stays at or above 144 FPS for baseline and lens flares', async ({ page }) => {
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

  await waitForSceneReady(page)
  await waitForProbeResidency(page)
  await waitForRuntimeModelCache(page)

  const rendererInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

    if (!gl) {
      return null
    }

    const ext = gl.getExtension('WEBGL_debug_renderer_info')

    return ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
  })

  expect(rendererInfo).toBeTruthy()
  expect(rendererInfo).not.toContain('SwiftShader')

  const defaultScene = await page.evaluate(async () => {
    window.__levelsjamDebug.setView?.(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    return window.__levelsjamBenchmark(90)
  })

  const baseline = await benchmarkWithSettings(page, {
    ambientOcclusionMode: 'off',
    anamorphic: { enabled: false, intensity: 0 },
    bloom: { enabled: false, intensity: 0 },
    depthOfField: { bokehScale: 0, enabled: false },
    lensFlare: { enabled: false, intensity: 0 },
    ssr: { enabled: false, intensity: 0 },
    vignette: { enabled: false, intensity: 0 },
    volumetricLighting: { enabled: false, intensity: 0 }
  })

  const initialGameplayView = await benchmarkInitialGameplayView(page, {
    ambientOcclusionMode: 'off',
    anamorphic: { enabled: false, intensity: 0 },
    bloom: { enabled: false, intensity: 0 },
    depthOfField: { bokehScale: 0, enabled: false },
    lensFlare: { enabled: false, intensity: 0 },
    ssr: { enabled: false, intensity: 0 },
    vignette: { enabled: false, intensity: 0 },
    volumetricLighting: { enabled: false, intensity: 0 }
  })

  const lensFlareOnly = await benchmarkWithSettings(page, {
    ambientOcclusionMode: 'off',
    anamorphic: { enabled: false, intensity: 0 },
    bloom: { enabled: false, intensity: 0 },
    depthOfField: { bokehScale: 0, enabled: false },
    lensFlare: { enabled: true, intensity: 0.1 },
    ssr: { enabled: false, intensity: 0 },
    vignette: { enabled: false, intensity: 0 },
    volumetricLighting: { enabled: false, intensity: 0 }
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(defaultScene.averageFrameMs).toBeGreaterThan(0)
  expect(defaultScene.fps).toBeGreaterThanOrEqual(144)
  expect(baseline.averageFrameMs).toBeGreaterThan(0)
  expect(baseline.fps).toBeGreaterThanOrEqual(144)
  expect(initialGameplayView.averageFrameMs).toBeGreaterThan(0)
  expect(initialGameplayView.fps).toBeGreaterThanOrEqual(144)
  expect(lensFlareOnly.averageFrameMs).toBeGreaterThan(0)
  expect(lensFlareOnly.fps).toBeGreaterThanOrEqual(144)

  const minotaurView = await benchmarkMonsterView(page, 'minotaur', {
    ambientOcclusionMode: 'off',
    anamorphic: { enabled: false, intensity: 0 },
    bloom: { enabled: false, intensity: 0 },
    depthOfField: { bokehScale: 0, enabled: false },
    lensFlare: { enabled: false, intensity: 0 },
    ssr: { enabled: false, intensity: 0 },
    vignette: { enabled: false, intensity: 0 },
    volumetricLighting: { enabled: false, intensity: 0 }
  })

  expect(minotaurView).not.toBeNull()
  expect(minotaurView.averageFrameMs).toBeGreaterThan(0)
  expect(minotaurView.fps).toBeGreaterThanOrEqual(144)
})

test('Chamber 1 with adjacent levels loaded stays within the 144 FPS render budget', async ({ page }) => {
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

  await waitForSceneReady(page, 'chamber-1')
  await expect
    .poll(async () => page.evaluate(() =>
      window.__levelsjamDebug?.getMazeLifecycleState?.()?.renderedMazeIds ?? []
    ), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toEqual(expect.arrayContaining([
      'chamber-1',
      'entrance',
      'maze-001',
      'maze-002',
      'maze-003',
      'maze-005'
    ]))

  await moveChamberPlayerToExitSightline(page)
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.sceneProgramsReady), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  const noPost = await page.evaluate(async () => {
    window.__levelsjamSetVisualSettings?.({
      ambientOcclusionMode: 'off',
      anamorphic: { enabled: false, intensity: 0 },
      bloom: { enabled: false, intensity: 0 },
      depthOfField: { bokehScale: 0, enabled: false },
      lensFlare: { enabled: false, intensity: 0 },
      precomputedVisibilityEnabled: true,
      ssr: { enabled: false, intensity: 0 },
      vignette: { enabled: false, intensity: 0 },
      volumetricLighting: { enabled: false, intensity: 0 }
    })
    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(120)
  })
  const defaultVisuals = await page.evaluate(async () => {
    window.__levelsjamSetVisualSettings?.({
      ambientOcclusionMode: 'n8ao',
      precomputedVisibilityEnabled: true,
      vignette: { enabled: true, intensity: 0.6 },
      volumetricLighting: { enabled: true, intensity: 0.75 }
    })
    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(120)
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(noPost.averageFrameMs).toBeGreaterThan(0)
  expect(noPost.fps).toBeGreaterThanOrEqual(144)
  expect(defaultVisuals.averageFrameMs).toBeGreaterThan(0)
  expect(defaultVisuals.fps).toBeGreaterThanOrEqual(144)
})

test('solution replay maintains the GPU render budget through the maze', async ({ page }) => {
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

  await waitForSceneReady(page)
  await waitForProbeResidency(page)
  await waitForRuntimeModelCache(page)
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.fireFlipbookReady), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.sceneProgramsReady), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(() =>
      window.__levelsjamDebug?.getMazeLifecycleState?.().cachedGltfRootUrls?.length ?? 0
    ), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBeGreaterThanOrEqual(3)

  const replayResult = await page.evaluate(async ({ minAcceptableReplayFps }) => {
    const samples = []
    window.__levelsjamDebug.setAnimationSpeedMultiplier?.(80)
    const started = window.__levelsjamDebug.startSolutionReplay?.() ?? false
    const startTime = performance.now()
    let lastSampledTurn = -1

    if (!started) {
      return {
        escaped: false,
        minFps: 0,
        samples,
        started
      }
    }

    while (performance.now() - startTime < 90_000) {
      const summary = window.__levelsjamDebug.getTurnStateSummary?.()

      if (summary?.replayActive) {
        break
      }

      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
    }

    while (performance.now() - startTime < 90_000) {
      const summary = window.__levelsjamDebug.getTurnStateSummary?.()

      if (summary && !summary.replayActive) {
        break
      }

      if (
        summary?.turn !== undefined &&
        summary.turn !== lastSampledTurn &&
        summary.turn % 5 === 0
      ) {
        lastSampledTurn = summary.turn
        for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
          await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
        }
        const benchmark = await window.__levelsjamBenchmark(12)

        samples.push({
          benchmark,
          turn: summary.turn
        })

      }

      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
    }

    const finalSummary = window.__levelsjamDebug.getTurnStateSummary?.()
    const minFps = samples.reduce(
      (currentMin, sample) => Math.min(currentMin, sample.benchmark.fps),
      Number.POSITIVE_INFINITY
    )
    const averageFps = samples.length > 0
      ? samples.reduce((total, sample) => total + sample.benchmark.fps, 0) / samples.length
      : 0

    return {
      averageFps,
      finalSummary,
      minFps: Number.isFinite(minFps) ? minFps : 0,
      sampleCount: samples.length,
      samples,
      started
    }
  }, { minAcceptableReplayFps: MIN_ACCEPTABLE_REPLAY_FPS })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(replayResult.started).toBe(true)
  expect(replayResult.finalSummary?.dead).toBe(false)
  expect(replayResult.finalSummary?.replayActive).toBe(false)
  expect(replayResult.sampleCount).toBeGreaterThan(0)
  expect(replayResult.averageFps).toBeGreaterThanOrEqual(MIN_ACCEPTABLE_REPLAY_FPS)
})
