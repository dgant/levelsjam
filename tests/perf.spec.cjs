const fs = require('node:fs')
const path = require('node:path')
const { expect, test } = require('@playwright/test')

test.setTimeout(120_000)

const TARGET_FPS = 144
const MIN_ACCEPTABLE_REPLAY_FPS = TARGET_FPS * 0.85
const LIVE_MOVEMENT_HITCH_MS = 40

function ensureLogsDirectory() {
  const logsDirectory = path.resolve(__dirname, '..', 'logs')

  fs.mkdirSync(logsDirectory, { recursive: true })
  return logsDirectory
}

function writeChamberRunProfile(result) {
  const logsDirectory = ensureLogsDirectory()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(logsDirectory, `chamber-1-run-profile-${stamp}.json`)
  const markdownPath = path.join(logsDirectory, `chamber-1-run-profile-${stamp}.md`)
  const frameBudget144 = 1000 / TARGET_FPS
  const summary = result.summary ?? {}
  const lines = [
    '# Chamber 1 Live Movement Profile',
    '',
    `- Samples: ${summary.samples ?? 0}`,
    `- Duration: ${Number(summary.durationMs ?? 0).toFixed(3)}ms`,
    `- Average RAF delta: ${Number(summary.averageDeltaMs ?? 0).toFixed(3)}ms`,
    `- Max RAF delta: ${Number(summary.maxDeltaMs ?? 0).toFixed(3)}ms`,
    `- Frames over 144 FPS budget (${frameBudget144.toFixed(3)}ms): ${summary.framesOver144Budget ?? 0}`,
    `- Frames over 60 FPS budget (16.667ms): ${summary.framesOver60Budget ?? 0}`,
    `- Frames over hitch budget (${LIVE_MOVEMENT_HITCH_MS.toFixed(1)}ms): ${summary.framesOverHitchBudget ?? 0}`,
    `- Shader program increases: ${result.shaderProgramIncreaseCount ?? 'n/a'}`,
    `- Start player: ${JSON.stringify(result.startPlayer ?? null)}`,
    `- End player: ${JSON.stringify(result.endPlayer ?? null)}`,
    `- Start lifecycle: ${JSON.stringify(result.startLifecycle ?? null)}`,
    `- End lifecycle: ${JSON.stringify(result.endLifecycle ?? null)}`,
    `- Final renderer: ${JSON.stringify(result.finalRenderer ?? null)}`,
    `- Final scene objects: ${JSON.stringify(result.finalSceneObjects ?? null)}`,
    `- Final probes: ${JSON.stringify(result.finalProbeState ?? null)}`,
    '',
    '## App Frame Profile',
    '',
    result.appProfile?.markdown ?? '- App frame profile unavailable.',
    '',
    '## Long Frames',
    ''
  ]

  if ((result.longFrames ?? []).length === 0) {
    lines.push('- None')
  } else {
    for (const frame of result.longFrames) {
      lines.push(
        `- ${Number(frame.deltaMs).toFixed(3)}ms at +${Number(frame.elapsedMs).toFixed(3)}ms; player=${JSON.stringify(frame.player ?? null)}; action=${JSON.stringify(frame.replay ?? null)}; programs=${frame.shaderProgramIncreaseCount}; renderer=${JSON.stringify(frame.renderer ?? null)}; probes=${JSON.stringify(frame.probes ?? null)}; lifecycle=${JSON.stringify(frame.lifecycle ?? null)}; scene=${JSON.stringify(frame.sceneObjects ?? null)}`
      )
    }
  }

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`)

  return { jsonPath, markdownPath }
}

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
    let lastFrameTime = null

    const tick = (frameTime) => {
      const monitor = window.__levelsjamStartupRaf

      if (lastFrameTime === null) {
        lastFrameTime = frameTime
        requestAnimationFrame(tick)
        return
      }

      const delta = frameTime - lastFrameTime
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
  expect(startup.loadingCompleteAt).toBeLessThan(5_250)
  expect(startup.monitor.samples).toBeGreaterThan(45)
  expect(startup.monitor.maxDelta).toBeLessThan(4_000)
  expect(startup.monitor.longTasks.every((entry) => entry.duration < 4_000)).toBe(true)
  expect([...resourceUrls].some((url) => url.includes('surface-lightmap.bin'))).toBe(false)
  expect([...resourceUrls].some((url) => url.includes('surface-lightmap-rgbe.rgbe'))).toBe(true)
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
  for (let expectedY = 16; expectedY >= 13; expectedY -= 1) {
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__levelsjamDebug?.getReplayControllerState?.()

        return {
          action: state?.playerAnimationAction ?? null,
          queue: state?.inputQueueLength ?? 0
        }
      }), {
        timeout: 5_000,
        intervals: [50, 100, 250]
      })
      .toEqual({ action: null, queue: 0 })
    await page.keyboard.press('KeyW')
    await expect
      .poll(async () => page.evaluate(() =>
        window.__levelsjamDebug?.getTurnStateSummary?.()?.player?.cell ?? null
      ), {
        timeout: 5_000,
        intervals: [50, 100, 250]
      })
      .toEqual({ x: 2, y: expectedY })
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

async function captureChamberMovementRun(page, stepCount = 14) {
  await page.evaluate(() => {
    window.__levelsjamSetVisualSettings?.({
      ambientOcclusionMode: 'n8ao',
      anamorphic: { enabled: false, intensity: 0 },
      bloom: { enabled: false, intensity: 0 },
      depthOfField: { bokehScale: 0, enabled: false },
      lensFlare: { enabled: false, intensity: 0 },
      precomputedVisibilityEnabled: true,
      ssr: { enabled: false, intensity: 0 },
      vignette: { enabled: true, intensity: 0.7 },
      volumetricLighting: { enabled: true, intensity: 0.33 }
    })
  })
  await page.evaluate(async () => {
    for (let index = 0; index < 30; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
  })

  const profilePromise = page.evaluate(async ({ stepCount, hitchMs }) => {
    const summarizeProbeState = (state) => state
      ? {
          activeProbeId: state.activeProbeId ?? null,
          complete: state.complete ?? null,
          loadedProbeCount: state.loadedProbeCount ?? null,
          loadedVolumetricProbeCount: state.loadedVolumetricProbeCount ?? null,
          priorityProbeIndices: state.priorityProbeIndices ?? null,
          probeCount: state.probeCount ?? null,
          ready: state.ready ?? null,
          requestedResidentProbeIndices: state.requestedResidentProbeIndices ?? null,
          residentProbeLimit: state.residentProbeLimit ?? null,
          startupVolumetricProbeCount: state.startupVolumetricProbeCount ?? null,
          startupVolumetricProbeIndices: state.startupVolumetricProbeIndices ?? null,
          textureMemoryBudgetBytes: state.textureMemoryBudgetBytes ?? null
        }
      : null
    const sampleState = () => ({
      lifecycle: window.__levelsjamDebug?.getMazeLifecycleState?.() ?? null,
      player: window.__levelsjamDebug?.getTurnStateSummary?.()?.player ?? null,
      probes: summarizeProbeState(window.__levelsjamDebug?.getReflectionProbeState?.() ?? null),
      renderer: window.__levelsjamDebug?.getRendererStats?.() ?? null,
      replay: window.__levelsjamDebug?.getReplayControllerState?.() ?? null,
      sceneObjects: window.__levelsjamDebug?.getSceneObjectStats?.() ?? null,
      shaderProgramIncreaseCount: Number(document.body.dataset.shaderProgramIncreaseCount ?? '0')
    })
    const frameBudget144 = 1000 / 144
    const frames = []
    const longFrames = []
    const startState = sampleState()
    const startedAt = performance.now()
    const appProfilePromise = window.__levelsjamCapturePerformanceProfile?.({
      liveDurationMs: Math.max(3_000, stepCount * 300),
      liveOnly: true,
      samples: 4
    }) ?? Promise.resolve(null)
    let lastFrameTime = null
    let stopped = false

    const monitorPromise = new Promise((resolve) => {
      const tick = (frameTime) => {
        if (stopped) {
          resolve()
          return
        }
        if (lastFrameTime !== null) {
          const deltaMs = frameTime - lastFrameTime
          const frame = {
            deltaMs,
            elapsedMs: frameTime - startedAt
          }

          frames.push(frame)
          if (deltaMs > hitchMs) {
            longFrames.push({
              ...frame,
              ...sampleState()
            })
          }
        }
        lastFrameTime = frameTime
        requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    })

    const waitForIdle = async () => {
      const timeoutAt = performance.now() + 8_000

      while (performance.now() < timeoutAt) {
        const replay = window.__levelsjamDebug?.getReplayControllerState?.()

        if (!replay || (
          (replay.playerAnimationAction ?? null) === null &&
          (replay.inputQueueLength ?? 0) === 0
        )) {
          return true
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      return false
    }

    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        code: 'KeyW',
        key: 'w'
      }))
      window.dispatchEvent(new KeyboardEvent('keyup', {
        bubbles: true,
        code: 'KeyW',
        key: 'w'
      }))
      await new Promise((resolve) => setTimeout(resolve, 45))
    }

    const wentIdle = await waitForIdle()
    for (let index = 0; index < 20; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }

    stopped = true
    await monitorPromise
    const appProfile = await appProfilePromise

    const durationMs = performance.now() - startedAt
    const totalDeltaMs = frames.reduce((total, frame) => total + frame.deltaMs, 0)
    const summary = {
      averageDeltaMs: frames.length > 0 ? totalDeltaMs / frames.length : 0,
      durationMs,
      framesOver144Budget: frames.filter((frame) => frame.deltaMs > frameBudget144).length,
      framesOver60Budget: frames.filter((frame) => frame.deltaMs > 16.667).length,
      framesOverHitchBudget: frames.filter((frame) => frame.deltaMs > hitchMs).length,
      maxDeltaMs: frames.reduce((max, frame) => Math.max(max, frame.deltaMs), 0),
      samples: frames.length,
      wentIdle
    }
    const endState = sampleState()

    return {
      endLifecycle: endState.lifecycle,
      endPlayer: endState.player,
      appProfile,
      finalProbeState: endState.probes,
      finalRenderer: endState.renderer,
      finalSceneObjects: endState.sceneObjects,
      frames,
      longFrames,
      shaderProgramIncreaseCount: endState.shaderProgramIncreaseCount,
      shaderProgramIncreaseHistory: document.body.dataset.shaderProgramIncreaseHistory ?? '[]',
      startLifecycle: startState.lifecycle,
      startPlayer: startState.player,
      summary
    }
  }, { hitchMs: LIVE_MOVEMENT_HITCH_MS, stepCount })

  return profilePromise
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
      'maze-004'
    ]))

  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.sceneProgramsReady), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')
  await page.evaluate(() => window.__levelsjamWarmPerformanceScene?.())
  await page.evaluate(() => window.__levelsjamDebug?.resetShaderProgramMonitor?.())
  await moveChamberPlayerToExitSightline(page)
  const traversalProgramIncreaseCount = await page.evaluate(() =>
    Number(document.body.dataset.shaderProgramIncreaseCount ?? '0')
  )

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
      vignette: { enabled: true, intensity: 0.7 },
      volumetricLighting: { enabled: true, intensity: 0.33 }
    })
    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    }
    return window.__levelsjamBenchmark(120)
  })
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(traversalProgramIncreaseCount).toBe(0)
  expect(noPost.averageFrameMs).toBeGreaterThan(0)
  expect(noPost.fps).toBeGreaterThanOrEqual(144)
  expect(defaultVisuals.averageFrameMs).toBeGreaterThan(0)
  expect(defaultVisuals.fps).toBeGreaterThanOrEqual(144)
})

test('running down Chamber 1 stays stutter-free during live repeated movement', async ({ page }) => {
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
      'maze-004'
    ]))
  await waitForProbeResidency(page)
  await waitForRuntimeModelCache(page)
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.sceneProgramsReady), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  await page.evaluate(() => window.__levelsjamWarmPerformanceScene?.())
  await page.evaluate(() => window.__levelsjamDebug?.resetShaderProgramMonitor?.())

  const result = await captureChamberMovementRun(page)
  const logPaths = writeChamberRunProfile(result)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
  expect(result.summary.samples).toBeGreaterThan(60)
  expect(result.summary.wentIdle).toBe(true)
  expect(result.shaderProgramIncreaseCount, `shader history: ${result.shaderProgramIncreaseHistory}`).toBe(0)
  expect(result.summary.framesOverHitchBudget, `profile: ${logPaths.markdownPath}`).toBe(0)
  expect(result.summary.maxDeltaMs, `profile: ${logPaths.markdownPath}`).toBeLessThanOrEqual(LIVE_MOVEMENT_HITCH_MS)
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
  await expect
    .poll(async () => page.evaluate(() =>
      window.__levelsjamDebug?.getMazeLifecycleState?.().renderedMazeIds ?? []
    ), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toEqual(expect.arrayContaining(['maze-001', 'chamber-1']))
  await page.evaluate(() => window.__levelsjamWarmPerformanceScene?.())
  await page.evaluate(() => window.__levelsjamDebug?.resetShaderProgramMonitor?.())

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

    await window.__levelsjamWarmPerformanceScene?.()
    window.__levelsjamDebug.resetShaderProgramMonitor?.()

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
      shaderProgramIncreaseCount: Number(document.body.dataset.shaderProgramIncreaseCount ?? '0'),
      shaderProgramIncreaseHistory: document.body.dataset.shaderProgramIncreaseHistory ?? '[]',
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
  expect(replayResult.shaderProgramIncreaseCount).toBe(0)
})
