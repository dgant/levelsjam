const { expect, test } = require('@playwright/test')

test.setTimeout(120_000)

async function waitForSceneReady(page, mazeId = 'maze-001') {
  await page.goto(`/?maze=${mazeId}`, { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 30_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe('true')
  await expect
    .poll(async () => page.evaluate(() => ({
      getDebugPosition: typeof window.__levelsjamDebug?.getDebugPosition,
      getMazeLifecycleState: typeof window.__levelsjamDebug?.getMazeLifecycleState,
      getRuntimeMemoryHighWater: typeof window.__levelsjamDebug?.getRuntimeMemoryHighWater,
      getTurnStateSummary: typeof window.__levelsjamDebug?.getTurnStateSummary,
      startSolutionReplay: typeof window.__levelsjamDebug?.startSolutionReplay
    })), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      getDebugPosition: 'function',
      getMazeLifecycleState: 'function',
      getRuntimeMemoryHighWater: 'function',
      getTurnStateSummary: 'function',
      startSolutionReplay: 'function'
    })
}

async function findDebugPosition(page, role, maxIndex = 8) {
  return page.evaluate(
    ({ maxIndex, role }) => {
      for (let index = 0; index < maxIndex; index += 1) {
        const position = window.__levelsjamDebug.getDebugPosition?.(role, index) ?? null

        if (Array.isArray(position)) {
          return { index, position }
        }
      }

      return null
    },
    { maxIndex, role }
  )
}

async function pressAndWaitForPlayer(page, key, expectedPlayer) {
  await page.keyboard.press(key)
  await expect
    .poll(
      async () => page.evaluate(() => window.__levelsjamDebug.getTurnStateSummary?.()?.player ?? null),
      {
        timeout: 10_000,
        intervals: [50, 100, 250]
      }
    )
    .toMatchObject(expectedPlayer)
}

test('maze runtime exposes gate/item/lifecycle and memory state', async ({ page }) => {
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

  await waitForSceneReady(page, 'maze-001')

  const initialGateYs = await page.evaluate(() => {
    const positions = []

    for (let index = 0; index < 8; index += 1) {
      const position = window.__levelsjamDebug.getDebugPosition?.('maze-gate', index) ?? null

      if (Array.isArray(position)) {
        positions.push(position[1])
      }
    }

    return positions
  })

  expect(initialGateYs.length).toBeGreaterThan(0)
  expect(Math.min(...initialGateYs)).toBeGreaterThan(-0.25)

  await expect
    .poll(
      async () => page.evaluate(() => ({
        gate0: window.__levelsjamDebug.getDebugPosition?.('maze-gate', 0) ?? null,
        gate3: window.__levelsjamDebug.getDebugPosition?.('maze-gate', 3) ?? null,
        sword: null,
        trophy: null
      })),
      {
        timeout: 20_000,
        intervals: [100, 250, 500]
      }
    )
    .toMatchObject({
      gate0: expect.any(Array),
      gate3: expect.any(Array),
      sword: null,
      trophy: null
    })

  await expect
    .poll(async () => ({
      sword: await findDebugPosition(page, 'maze-sword'),
      trophy: await findDebugPosition(page, 'maze-trophy')
    }), {
      timeout: 20_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      sword: {
        index: expect.any(Number),
        position: expect.any(Array)
      },
      trophy: {
        index: expect.any(Number),
        position: expect.any(Array)
      }
    })

  const lifecycleBefore = await page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState())
  const memoryBefore = await page.evaluate(() => window.__levelsjamDebug.getRuntimeMemoryHighWater())

  expect(lifecycleBefore.instantiatedMazeId).toBe('maze-001')
  expect(lifecycleBefore.loadedMazeIds).toContain('maze-001')
  expect(lifecycleBefore.availableMazeIds.length).toBeGreaterThanOrEqual(5)
  expect(memoryBefore.current.rendererTextures).toBeGreaterThan(0)
  expect(memoryBefore.highWater.rendererTextures).toBeGreaterThan(0)

  const loadedState = await page.evaluate(async () => {
    await window.__levelsjamDebug.loadMazeData?.('maze-002')
    await window.__levelsjamDebug.loadMazeData?.('maze-003')
    return window.__levelsjamDebug.getMazeLifecycleState?.()
  })

  expect(loadedState.loadedMazeIds).toEqual(
    expect.arrayContaining(['maze-001', 'maze-002', 'maze-003'])
  )

  await page.evaluate(() => {
    window.__levelsjamDebug.instantiateMaze?.('maze-002')
  })
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState?.()), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      instantiatedMazeId: 'maze-002',
      loadedMazeIds: expect.arrayContaining(['maze-002', 'maze-003'])
    })
  await expect(page.locator('.fps-counter')).toContainText('maze-002')

  await page.evaluate(() => {
    window.__levelsjamDebug.uninstantiateMaze?.()
  })
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState?.()), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      instantiatedMazeId: null
    })
  await expect
    .poll(async () => findDebugPosition(page, 'maze-gate', 4), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toBe(null)

  await page.evaluate(() => {
    window.__levelsjamDebug.instantiateMaze?.('maze-003')
  })
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState?.()), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      instantiatedMazeId: 'maze-003'
    })
  await expect(page.locator('.fps-counter')).toContainText('maze-003')
  await expect
    .poll(async () => findDebugPosition(page, 'maze-gate', 4), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      index: expect.any(Number),
      position: expect.any(Array)
    })

  await page.evaluate(() => {
    window.__levelsjamDebug.unloadMazeData?.('maze-002')
  })
  const lifecycleAfterUnload = await page.evaluate(() => window.__levelsjamDebug.getMazeLifecycleState())
  expect(lifecycleAfterUnload.loadedMazeIds).not.toContain('maze-002')

  await page.evaluate(() => {
    window.__levelsjamDebug.resetMaze?.()
  })
  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getTurnStateSummary?.()), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      dead: false,
      escaped: false,
      player: {
        hasSword: false,
        hasTrophy: false
      },
      turn: 0
    })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('maze 005 sword pickup swaps the floor sword for the held sword', async ({ page }) => {
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

  await waitForSceneReady(page, 'maze-005')
  await page.evaluate(() => window.__levelsjamDebug.setAnimationSpeedMultiplier?.(20))

  await pressAndWaitForPlayer(page, 'ArrowRight', {
    cell: { x: 0, y: 2 },
    direction: 'south',
    hasSword: false
  })
  await pressAndWaitForPlayer(page, 'KeyW', {
    cell: { x: 0, y: 3 },
    direction: 'south',
    hasSword: false
  })
  await pressAndWaitForPlayer(page, 'KeyW', {
    cell: { x: 0, y: 4 },
    direction: 'south',
    hasSword: true
  })

  const pickupState = await page.evaluate(() => window.__levelsjamDebug.getTurnStateSummary?.())
  expect(pickupState.swordState).toBe('held')
  await expect
    .poll(async () => ({
      floorSword: await findDebugPosition(page, 'maze-sword'),
      camera: await page.evaluate(() => window.__levelsjamDebug.getCameraState?.() ?? null),
      heldSword: await findDebugPosition(page, 'held-sword')
    }), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      camera: {
        position: expect.any(Array)
      },
      floorSword: null,
      heldSword: {
        index: expect.any(Number),
        position: expect.any(Array)
      }
    })
  const heldSwordPose = await page.evaluate(() => ({
    camera: window.__levelsjamDebug.getCameraState?.() ?? null,
    heldSword: window.__levelsjamDebug.getDebugPosition?.('held-sword', 0) ?? null
  }))
  const heldSwordDistance = Math.hypot(
    heldSwordPose.heldSword[0] - heldSwordPose.camera.position[0],
    heldSwordPose.heldSword[1] - heldSwordPose.camera.position[1],
    heldSwordPose.heldSword[2] - heldSwordPose.camera.position[2]
  )

  expect(heldSwordDistance).toBeLessThan(1.5)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('replay solution drives the maze to a winning escaped state', async ({ page }) => {
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

  await waitForSceneReady(page, 'maze-001')
  await page.evaluate(() => window.__levelsjamDebug.setAnimationSpeedMultiplier?.(20))

  const started = await page.evaluate(() => window.__levelsjamDebug.startSolutionReplay?.() ?? false)
  expect(started).toBe(true)

  await expect
    .poll(async () => page.evaluate(() => window.__levelsjamDebug.getTurnStateSummary?.()), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toMatchObject({
      replayActive: true
    })

  await expect
    .poll(async () => page.evaluate(() => ({
      lifecycle: window.__levelsjamDebug.getMazeLifecycleState?.(),
      turn: window.__levelsjamDebug.getTurnStateSummary?.()
    })), {
      timeout: 60_000,
      intervals: [250, 500, 1_000]
    })
    .toMatchObject({
      lifecycle: {
        instantiatedMazeId: 'chamber-1'
      },
      turn: {
        dead: false,
        escaped: false,
        player: {
          hasTrophy: true
        },
        replayActive: false
      }
    })

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
