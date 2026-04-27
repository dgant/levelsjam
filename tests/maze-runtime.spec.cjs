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
      getMonsterRenderState: typeof window.__levelsjamDebug?.getMonsterRenderState,
      getRuntimeMemoryHighWater: typeof window.__levelsjamDebug?.getRuntimeMemoryHighWater,
      setDebugMonsterCell: typeof window.__levelsjamDebug?.setDebugMonsterCell,
      getTurnStateSummary: typeof window.__levelsjamDebug?.getTurnStateSummary,
      setAnimationSpeedMultiplier: typeof window.__levelsjamDebug?.setAnimationSpeedMultiplier,
      startSolutionReplay: typeof window.__levelsjamDebug?.startSolutionReplay
    })), {
      timeout: 15_000,
      intervals: [100, 250, 500]
    })
    .toEqual({
      getDebugPosition: 'function',
      getMazeLifecycleState: 'function',
      getMonsterRenderState: 'function',
      getRuntimeMemoryHighWater: 'function',
      setDebugMonsterCell: 'function',
      getTurnStateSummary: 'function',
      setAnimationSpeedMultiplier: 'function',
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

test('monster movement renders intermediate positions instead of snapping', async ({ page }) => {
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
  await expect
    .poll(
      async () => page.evaluate(() =>
        Array.from({ length: 3 }, (_, index) => Boolean(
          window.__levelsjamDebug?.getMonsterRenderState?.(index)
        ))
      ),
      {
        timeout: 20_000,
        intervals: [100, 250, 500]
      }
    )
    .toEqual([true, true, true])

  const result = await page.evaluate(async () => {
    const raf = () => new Promise((resolve) => requestAnimationFrame(resolve))
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

    window.__levelsjamDebug.setAnimationSpeedMultiplier?.(1)
    window.__levelsjamSetVisualSettings?.({ precomputedVisibilityEnabled: false })
    await raf()
    await raf()

    const initialSummary = window.__levelsjamDebug.getTurnStateSummary?.()
    const monster = initialSummary?.monsters?.[0] ?? null
    const startPosition = window.__levelsjamDebug.getDebugPosition?.('monster', 0) ?? null
    const mounted = Array.from({ length: 3 }, (_, index) =>
      Boolean(window.__levelsjamDebug.getMonsterRenderState?.(index))
    )

    if (!monster || !startPosition) {
      return { mounted, reason: 'monster-not-ready' }
    }

    const targetCell = monster.cell.x > 0
      ? { x: monster.cell.x - 1, y: monster.cell.y }
      : { x: monster.cell.x + 1, y: monster.cell.y }
    const applied = window.__levelsjamDebug.setDebugMonsterCell?.(0, targetCell, 'west') ?? false
    const samples = []

    if (!applied) {
      return { mounted, reason: 'debug-monster-cell-not-applied' }
    }

    for (let sampleIndex = 0; sampleIndex < 24; sampleIndex += 1) {
      await raf()
      samples.push({
        animationActive:
          window.__levelsjamDebug?.getMonsterRenderState?.(0)?.animationActive === true,
        position: window.__levelsjamDebug?.getDebugPosition?.('monster', 0) ?? null
      })
    }

    for (let waitIndex = 0; waitIndex < 60; waitIndex += 1) {
      const state = window.__levelsjamDebug?.getMonsterRenderState?.(0)
      if (state && !state.animationActive) {
        break
      }
      await raf()
    }

    let finalPosition = window.__levelsjamDebug?.getDebugPosition?.('monster', 0) ?? null

    for (let waitIndex = 0; !finalPosition && waitIndex < 60; waitIndex += 1) {
      await raf()
      finalPosition = window.__levelsjamDebug?.getDebugPosition?.('monster', 0) ?? null
    }

    return {
      finalPosition,
      index: 0,
      mounted,
      samples,
      startPosition,
      targetCell,
      totalDistance: finalPosition ? distance(startPosition, finalPosition) : null,
      type: monster.type
    }
  })

  expect(result.reason ?? null).toBe(null)
  expect(result.mounted).toEqual([true, true, true])
  expect(result.totalDistance).toBeGreaterThan(1)
  expect(result.samples.some((sample) => sample.animationActive)).toBe(true)

  const hasIntermediatePose = result.samples.some((sample) => {
    if (!sample.position || !result.finalPosition) {
      return false
    }

    const fromStart = Math.hypot(
      sample.position[0] - result.startPosition[0],
      sample.position[1] - result.startPosition[1],
      sample.position[2] - result.startPosition[2]
    )
    const fromEnd = Math.hypot(
      sample.position[0] - result.finalPosition[0],
      sample.position[1] - result.finalPosition[1],
      sample.position[2] - result.finalPosition[2]
    )

    return fromStart > 0.05 && fromEnd > 0.05
  })

  expect(hasIntermediatePose).toBe(true)

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
