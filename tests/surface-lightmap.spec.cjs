const { expect, test } = require('@playwright/test')
const { PNG } = require('pngjs')

test.setTimeout(60_000)

function summarizePng(buffer) {
  const png = PNG.sync.read(buffer)
  let nonBlackPixelCount = 0
  let averageLuminance = 0

  for (let index = 0; index < png.data.length; index += 4) {
    const r = png.data[index]
    const g = png.data[index + 1]
    const b = png.data[index + 2]
    const a = png.data[index + 3]

    if (a > 0 && (r > 8 || g > 8 || b > 8)) {
      nonBlackPixelCount += 1
    }

    averageLuminance += ((r + g + b) / 3)
  }

  averageLuminance /= (png.width * png.height)

  return {
    averageLuminance,
    nonBlackPixelCount
  }
}

test('surface lightmapped wall remains visibly lit with runtime effects disabled', async ({ page }) => {
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
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  await expect
    .poll(
      async () => page.evaluate(
        () => window.__levelsjamDebug?.getReflectionCaptureSceneState?.()?.ready ?? false
      ),
      {
        timeout: 20_000,
        intervals: [100, 250, 500]
      }
    )
    .toBe(true)

  await page.evaluate(() => {
    window.__levelsjamDebug.clearDebugIsolation()
    window.__levelsjamDebug.setVisualSettings({
      ambientOcclusionMode: 'off',
      bloom: { enabled: false },
      depthOfField: { enabled: false },
      exposureStops: -6,
      iblContribution: { enabled: false, intensity: 0 },
      lensFlare: { enabled: false },
      reflectionContribution: { enabled: false, intensity: 0 },
      ssr: { enabled: false, intensity: 0 },
      vignette: { enabled: false },
      volumetricLighting: { enabled: false, intensity: 0 }
    })

    const position = window.__levelsjamDebug.getDebugPosition('maze-wall', 10)
    window.__levelsjamDebug.isolateDebugRole('maze-wall', 10)
    window.__levelsjamDebug.setView(
      [position[0] + 1.6, position[1] + 0.8, position[2] + 2.4],
      [position[0], position[1] + 0.8, position[2]]
    )
  })

  await page.waitForTimeout(500)

  const screenshot = await page.locator('canvas').screenshot()
  const summary = summarizePng(screenshot)

  expect(summary.nonBlackPixelCount).toBeGreaterThan(100_000)
  expect(summary.averageLuminance).toBeGreaterThan(20)
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
