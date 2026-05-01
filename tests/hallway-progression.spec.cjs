const { expect, test } = require('@playwright/test')

test.setTimeout(90_000)

async function waitForReady(page) {
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 45_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(() => ({
      lifecycle: typeof window.__levelsjamDebug?.getMazeLifecycleState,
      player: typeof window.__levelsjamDebug?.setGlobalDebugPlayerCell,
      turn: typeof window.__levelsjamDebug?.getTurnStateSummary
    })), {
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      lifecycle: 'function',
      player: 'function',
      turn: 'function'
    })
}

test('Hallway 1-2 accepts movement after entry', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForReady(page)
  await page.evaluate(async () => {
    await window.__levelsjamDebug.loadMazeData?.('hallway-1-2')
    window.__levelsjamDebug.instantiateMaze?.('hallway-1-2')
    window.__levelsjamDebug.setAnimationSpeedMultiplier?.(100)
  })
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState?.()?.instantiatedMazeId ?? null), {
      timeout: 45_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe('hallway-1-2')
  await waitForReady(page)
  await page.evaluate(() => {
    window.__levelsjamDebug.setGlobalDebugPlayerCell?.({ x: 0, y: 2 }, 'east')
  })
  await page.keyboard.press('ArrowUp')
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getTurnStateSummary?.()?.player.cell ?? null), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toEqual({ x: 1, y: 2 })
})
