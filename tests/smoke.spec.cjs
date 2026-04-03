const { expect, test } = require('@playwright/test')

test('loads the flight scaffold without runtime errors', async ({ page }) => {
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

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page.locator('h1')).toHaveText('Atmospheric flight scaffold')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('.start-button')).toBeVisible()

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
