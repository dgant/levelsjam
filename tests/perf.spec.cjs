const { expect, test } = require('@playwright/test')

test.setTimeout(60_000)

async function waitForSceneReady(page) {
  const loadingOverlay = page.locator('#root .loading-overlay')

  await page.goto('/?maze=maze-001', { waitUntil: 'domcontentloaded' })
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

async function benchmarkWithSettings(page, patch) {
  return page.evaluate(async ({ patch }) => {
    window.__levelsjamDebug.setView?.(
      [5.4, 1.55, -6.9],
      [7, 1.1, -6]
    )
    window.__levelsjamSetVisualSettings?.(patch)
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    return window.__levelsjamBenchmark(90)
  }, { patch })
}

async function benchmarkMonsterView(page, monsterType, patch) {
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
    window.__levelsjamSetVisualSettings?.(patch)
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
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
  expect(baseline.averageFrameMs).toBeGreaterThan(0)
  expect(baseline.fps).toBeGreaterThanOrEqual(144)
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
