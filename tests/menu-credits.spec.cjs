const { expect, test } = require('@playwright/test')

test.setTimeout(90_000)

async function waitForLoadedScene(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => page.locator('#root .loading-overlay').getAttribute('data-loading-complete'), {
      timeout: 45_000,
      intervals: [100, 250, 500, 1_000]
    })
    .toBe('true')
}

test('main menu exposes skip, graphics toggles, and full-screen credits', async ({ page }) => {
  await waitForLoadedScene(page)

  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Graphics' }).click()

  for (const label of [
    'Bloom',
    'DOF',
    'Lens Flares',
    'Chromatic Aberration'
  ]) {
    const checkbox = page.getByRole('checkbox', { name: label })
    await expect(checkbox).toBeVisible()
    const before = await checkbox.isChecked()

    await checkbox.click()
    await expect(checkbox).toBeChecked({ checked: !before })
  }

  await page.getByRole('tab', { name: 'Skip' }).click()
  await expect(page.locator('.level-menu-list .level-menu-button small')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Entrance' })).toBeVisible()

  await page.getByRole('tab', { name: 'Credits' }).click()
  const credits = page.locator('.credits-modal')

  await expect(credits).toBeVisible()
  await expect(credits.locator('.credits-title-image')).toBeVisible()
  await expect(credits).toContainText('Credits')
  await expect(credits).toContainText('Minotaur')

  const styles = await credits.evaluate((element) => {
    const modal = window.getComputedStyle(element)
    const list = window.getComputedStyle(element.querySelector('.credits-list'))
    const panel = window.getComputedStyle(element.querySelector('.credits-panel'))

    return {
      backgroundColor: modal.backgroundColor,
      borderStyle: panel.borderStyle,
      columnCount: list.columnCount
    }
  })

  expect(styles.backgroundColor).toBe('rgb(0, 0, 0)')
  expect(styles.borderStyle).toBe('none')
  expect(styles.columnCount).toBe('3')
})
