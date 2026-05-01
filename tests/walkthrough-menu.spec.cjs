const { expect, test } = require('@playwright/test')

test.setTimeout(240_000)

async function sampleWalkthroughState(page) {
  return await page.evaluate(() => {
    const debug = window.__levelsjamDebug ?? {}
    const lifecycle = debug.getMazeLifecycleState?.() ?? null
    const turn = debug.getTurnStateSummary?.() ?? null
    const replay = debug.getReplayControllerState?.() ?? null

    return {
      activeMaze: lifecycle?.instantiatedMazeId ?? null,
      body: { ...document.body.dataset },
      creditsText: document.querySelector('.credits-modal')?.textContent ?? '',
      inputEnabled: replay?.inputEnabled ?? null,
      player: turn?.player ?? null,
      turn: turn?.turn ?? null
    }
  })
}

function walkthroughProgressKey(state) {
  return JSON.stringify({
    activeMaze: state.activeMaze,
    altarCutsceneActive: state.body.altarCutsceneActive ?? null,
    creditsText: state.creditsText,
    inputEnabled: state.inputEnabled,
    player: state.player,
    turn: state.turn,
    walkthroughActive: state.body.walkthroughActive ?? null
  })
}

async function waitForWalkthroughProgress(page, predicate, label) {
  const startedAt = Date.now()
  let lastKey = ''
  let lastProgressAt = Date.now()
  let lastState = null

  while (Date.now() - startedAt < 240_000) {
    const state = await sampleWalkthroughState(page)

    lastState = state
    if (predicate(state)) {
      return state
    }

    const nextKey = walkthroughProgressKey(state)

    if (nextKey !== lastKey) {
      lastKey = nextKey
      lastProgressAt = Date.now()
    }

    if (Date.now() - lastProgressAt > 5_000) {
      throw new Error(`${label} stalled for 5s at ${JSON.stringify(lastState)}`)
    }

    await page.waitForTimeout(100)
  }

  throw new Error(`${label} did not complete; last state ${JSON.stringify(lastState)}`)
}

test('gameplay menu walkthrough button plays through to the credits', async ({ page }) => {
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
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 45_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe('true')

  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Gameplay' }).click()
  await page.getByRole('button', { name: /Walkthrough/ }).click()

  await expect
    .poll(async () => page.evaluate(() => document.body.dataset.walkthroughActive ?? 'false'), {
      timeout: 10_000,
      intervals: [100, 250, 500]
    })
    .toBe('true')

  await waitForWalkthroughProgress(
    page,
    (state) => state.creditsText.includes('Thank you for playing.'),
    'walkthrough credits'
  )

  expect(consoleErrors.filter((message) => (
    !message.includes('/@vite/client') &&
    message !== 'Failed to load resource: the server responded with a status of 404 (Not Found)'
  ))).toEqual([])
  expect(pageErrors).toEqual([])
})
