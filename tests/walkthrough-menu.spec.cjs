const { expect, test } = require('@playwright/test')

test.setTimeout(90_000)

test('gameplay menu walkthrough button starts the shared story replay', async ({ page }) => {
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

  expect(consoleErrors.filter((message) => (
    !message.includes('/@vite/client') &&
    message !== 'Failed to load resource: the server responded with a status of 404 (Not Found)'
  ))).toEqual([])
  expect(pageErrors).toEqual([])
})
