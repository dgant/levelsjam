const { expect, test } = require('@playwright/test')
const { PNG } = require('pngjs')

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
        clearDebugIsolation: typeof window.__levelsjamDebug?.clearDebugIsolation,
        getDebugPosition: typeof window.__levelsjamDebug?.getDebugPosition,
        getMonsterRenderState: typeof window.__levelsjamDebug?.getMonsterRenderState,
        isolateDebugRole: typeof window.__levelsjamDebug?.isolateDebugRole,
        setView: typeof window.__levelsjamDebug?.setView
      }))
    }, {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      clearDebugIsolation: 'function',
      getDebugPosition: 'function',
      getMonsterRenderState: 'function',
      isolateDebugRole: 'function',
      setView: 'function'
    })
}

function countNonWhitePixels(buffer) {
  const png = PNG.sync.read(buffer)
  let count = 0

  for (let index = 0; index < png.data.length; index += 4) {
    const r = png.data[index]
    const g = png.data[index + 1]
    const b = png.data[index + 2]
    const a = png.data[index + 3]

    if (a > 0 && (r < 245 || g < 245 || b < 245)) {
      count += 1
    }
  }

  return count
}

test('monsters render, stay off surface lightmaps, and land near intended size', async ({ page }) => {
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

  await expect
    .poll(
      async () => page.evaluate(() =>
        Array.from({ length: 3 }, (_, index) => Boolean(
          window.__levelsjamDebug.getMonsterRenderState?.(index)
        ))
      ),
      {
        timeout: 20_000,
        intervals: [100, 250, 500]
      }
    )
    .toEqual([true, true, true])

  const monsterStates = await page.evaluate(() =>
    Array.from({ length: 3 }, (_, index) => ({
      index,
      position: window.__levelsjamDebug.getDebugPosition?.('monster', index) ?? null,
      state: window.__levelsjamDebug.getMonsterRenderState?.(index) ?? null
    }))
  )

  for (const monster of monsterStates) {
    expect(monster.position).not.toBeNull()
    expect(monster.state).not.toBeNull()
    expect(['minotaur', 'spider', 'werewolf']).toContain(monster.state.type)
    expect(monster.state.meshCount).toBeGreaterThan(0)
    expect(monster.state.totalTriangleCount).toBeGreaterThan(0)
    expect(monster.state.hasLightMap).toBe(false)
    expect(monster.state.visible).toBe(true)
    expect(monster.state.targetSize).toBeGreaterThan(0)
    expect(monster.state.boundsMin).not.toBeNull()
    expect(monster.state.boundsMax).not.toBeNull()

    const maxDimension = Math.max(...monster.state.boundsSize)
    expect(maxDimension).toBeGreaterThan(monster.state.targetSize * 0.6)
    expect(maxDimension).toBeLessThan(monster.state.targetSize * 1.35)

    if (monster.state.type === 'minotaur') {
      expect(monster.state.targetSize).toBeCloseTo(2.7, 3)
      expect(monster.state.boundsMin[1]).toBeCloseTo(-0.25, 3)
      expect(monster.state.totalTriangleCount).toBeLessThanOrEqual(11_000)
    }

    if (monster.state.type === 'werewolf') {
      expect(monster.state.targetSize).toBeCloseTo(1.6, 3)
      expect(monster.state.boundsMin[1]).toBeGreaterThanOrEqual(0)
    }

    if (monster.state.type === 'spider') {
      expect(monster.state.totalTriangleCount).toBeLessThanOrEqual(8_000)
    }

    await page.evaluate(({ index, position }) => {
      window.__levelsjamDebug.isolateDebugRole?.('monster', index)
      window.__levelsjamDebug.setView?.(
        [position[0] + 1.8, position[1] + 1.0, position[2] + 1.8],
        [position[0], position[1] + 0.75, position[2]]
      )
    }, {
      index: monster.index,
      position: monster.position
    })
    await page.waitForTimeout(250)

    const screenshot = await page.locator('canvas').screenshot()
    expect(countNonWhitePixels(screenshot)).toBeGreaterThan(2_000)
  }

  await page.evaluate(() => {
    window.__levelsjamDebug.clearDebugIsolation?.()
  })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
