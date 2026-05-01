const { expect, test } = require('@playwright/test')

test.setTimeout(180_000)

async function waitForCurrentSceneReady(page) {
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
      offer: typeof window.__levelsjamDebug?.offerHeldTrophyToAdjacentAltar,
      replay: typeof window.__levelsjamDebug?.startSolutionReplay,
      speed: typeof window.__levelsjamDebug?.setAnimationSpeedMultiplier,
      turn: typeof window.__levelsjamDebug?.getTurnStateSummary
    })), {
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      lifecycle: 'function',
      offer: 'function',
      player: 'function',
      replay: 'function',
      speed: 'function',
      turn: 'function'
    })
}

async function waitForLevel(page, levelId) {
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug?.getMazeLifecycleState?.()?.instantiatedMazeId ?? null), {
      timeout: 45_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe(levelId)
}

async function transitionFromCell(page, levelId, cell, direction) {
  const loaded = await page.evaluate(async (id) => {
    return await window.__levelsjamDebug.loadMazeData?.(id) ?? false
  }, levelId)

  expect(loaded).toBe(true)
  await expect
    .poll(async () => page.evaluate((id) => (
      window.__levelsjamDebug.getMazeLifecycleState?.()?.renderedMazeIds?.includes(id) ?? false
    ), levelId), {
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toBe(true)
  await waitForCurrentSceneReady(page)
  await page.evaluate(({ cell, direction }) => {
    window.__levelsjamDebug.setGlobalDebugPlayerCell?.(cell, direction)
  }, { cell, direction })
  await page.waitForTimeout(50)
  await page.keyboard.press('ArrowUp')
  await waitForLevel(page, levelId)
}

async function activateLevel(page, levelId) {
  const loaded = await page.evaluate(async (id) => {
    await window.__levelsjamDebug.loadMazeData?.(id)
    return window.__levelsjamDebug.instantiateMaze?.(id) ?? false
  }, levelId)

  expect(loaded).toBe(true)
  await waitForLevel(page, levelId)
}

async function solveStoryMaze(page, chamberId, mazeId, exitCell, direction, altarDirection) {
  await activateLevel(page, mazeId)
  await activateLevel(page, chamberId)
  await waitForCurrentSceneReady(page)
  await page.evaluate(({ cell, direction }) => {
    window.__levelsjamDebug.setGlobalDebugPlayerCell?.(cell, direction)
  }, { cell: exitCell, direction: altarDirection })
  const offered = await page.evaluate(() => window.__levelsjamDebug.offerHeldTrophyToAdjacentAltar?.() ?? false)

  expect(offered).toBe(true)
  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.altarCutsceneActive ?? 'false'), {
      timeout: 15_000,
      intervals: [250, 500, 1_000]
    })
    .toBe('false')
}

test('story progression reaches the throne room credits screen', async ({ page }) => {
  const consoleErrors = []
  const failedResponses = []
  const pageErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(response.url())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForCurrentSceneReady(page)
  await page.evaluate(() => window.__levelsjamDebug.setAnimationSpeedMultiplier?.(100))
  await waitForLevel(page, 'entrance')

  await activateLevel(page, 'hallway-1-1')
  await activateLevel(page, 'hallway-1-2')
  await activateLevel(page, 'hallway-1-3')
  await activateLevel(page, 'hallway-1-4')
  await activateLevel(page, 'hallway-1-5')
  await activateLevel(page, 'chamber-1')

  await solveStoryMaze(page, 'chamber-1', 'challenge-028', { x: 0, y: 2 }, 'west', 'east')
  await solveStoryMaze(page, 'chamber-1', 'challenge-031', { x: 0, y: 17 }, 'west', 'east')
  await solveStoryMaze(page, 'chamber-1', 'challenge-059', { x: 4, y: 2 }, 'east', 'west')
  await solveStoryMaze(page, 'chamber-1', 'challenge-036', { x: 4, y: 17 }, 'east', 'west')
  await activateLevel(page, 'chamber-2')

  await solveStoryMaze(page, 'chamber-2', 'werewolf-tutorial', { x: 0, y: 2 }, 'west', 'east')
  await solveStoryMaze(page, 'chamber-2', 'challenge-098', { x: 0, y: 14 }, 'west', 'east')
  await solveStoryMaze(page, 'chamber-2', 'challenge-095', { x: 0, y: 26 }, 'west', 'east')
  await solveStoryMaze(page, 'chamber-2', 'challenge-043', { x: 4, y: 2 }, 'east', 'west')
  await solveStoryMaze(page, 'chamber-2', 'challenge-040', { x: 4, y: 14 }, 'east', 'west')
  await solveStoryMaze(page, 'chamber-2', 'challenge-100', { x: 4, y: 26 }, 'east', 'west')
  await activateLevel(page, 'throne-room')

  const offered = await page.evaluate(() => window.__levelsjamDebug.offerHeldTrophyToAdjacentAltar?.() ?? false)

  expect(offered).toBe(true)

  await expect(page.locator('.credits-modal')).toContainText('Thank you for playing.', { timeout: 20_000 })
  await expect(page.locator('.credits-modal')).toContainText('https://x.com/dgant')

  expect(failedResponses.filter((url) => !url.endsWith('/@vite/client'))).toEqual([])
  expect(consoleErrors.filter((message) => (
    !message.includes('/@vite/client') &&
    message !== 'Failed to load resource: the server responded with a status of 404 (Not Found)'
  ))).toEqual([])
  expect(pageErrors).toEqual([])
})
