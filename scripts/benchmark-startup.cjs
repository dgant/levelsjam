const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { chromium } = require('@playwright/test')
const { PNG } = require('pngjs')

const rootDir = path.resolve(__dirname, '..')
const devServerCommand = [process.execPath, ['scripts/dev-server.cjs', 'start']]
const url = process.env.LEVELSJAM_DEV_URL ?? 'http://127.0.0.1:4273/'

function runNodeScript(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} exited with code ${result.status}`)
  }
}

function formatMilliseconds(value) {
  return `${value.toFixed(1)}ms`
}

function measureBrightness(buffer) {
  const screenshot = PNG.sync.read(buffer)
  let total = 0
  let count = 0
  const rowStep = Math.max(1, Math.floor(screenshot.height / 20))
  const columnStep = Math.max(1, Math.floor(screenshot.width / 20))

  for (let row = 0; row < screenshot.height; row += rowStep) {
    for (let column = 0; column < screenshot.width; column += columnStep) {
      const pixelOffset = ((row * screenshot.width) + column) * 4

      total +=
        screenshot.data[pixelOffset] +
        screenshot.data[pixelOffset + 1] +
        screenshot.data[pixelOffset + 2]
      count += 1
    }
  }

  return total / count
}

async function waitForBrightCanvas(page) {
  const canvas = page.locator('canvas')

  await canvas.waitFor({
    state: 'visible',
    timeout: 180_000
  })

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const brightness = measureBrightness(
      await canvas.screenshot({ scale: 'css' })
    )

    if (brightness > 20) {
      return page.evaluate(() => performance.now())
    }

    await page.waitForTimeout(500)
  }

  throw new Error('Canvas did not reach the expected brightness threshold')
}

async function waitForLoadingShell(page) {
  const overlay = page.locator('#bootstrap-loading-shell .loading-overlay')

  await overlay.waitFor({
    state: 'visible',
    timeout: 5_000
  })

  return page.evaluate(() => {
    const dots = document.querySelector('.loading-overlay-dots')

    return {
      dotsAnimationName: dots
        ? getComputedStyle(dots, '::after').animationName
        : null,
      visibleAt: performance.now()
    }
  })
}

async function waitForLoadingComplete(page) {
  await page.waitForFunction(
    () => document.querySelector('#root .loading-overlay')?.getAttribute('data-loading-complete') === 'true',
    undefined,
    { timeout: 10_000 }
  )

  return page.evaluate(() => performance.now())
}

async function main() {
  const serverStart = process.hrtime.bigint()
  runNodeScript(devServerCommand[0], devServerCommand[1])
  const serverReadyMs = Number(process.hrtime.bigint() - serverStart) / 1e6

  let browser
  let loadingCompleteAt
  let metrics
  let shellState
  let sceneReadyAt

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    await page.goto(url, {
      timeout: 120_000,
      waitUntil: 'commit'
    })
    shellState = await waitForLoadingShell(page)
    loadingCompleteAt = await waitForLoadingComplete(page)
    sceneReadyAt = await waitForBrightCanvas(page)

    metrics = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType('navigation')[0]
      const resources = performance
        .getEntriesByType('resource')
        .map((entry) => ({
          name: entry.name,
          duration: entry.duration,
          transferSize: 'transferSize' in entry ? entry.transferSize : 0,
          initiatorType: entry.initiatorType
        }))
        .sort((left, right) => right.duration - left.duration)

      return {
        domContentLoaded: navigationEntry?.domContentLoadedEventEnd ?? Number.NaN,
        loadEventEnd: navigationEntry?.loadEventEnd ?? Number.NaN,
        responseEnd: navigationEntry?.responseEnd ?? Number.NaN,
        transferSize: navigationEntry?.transferSize ?? 0,
        encodedBodySize: navigationEntry?.encodedBodySize ?? 0,
        resourceCount: resources.length,
        scriptCount: resources.filter((entry) => entry.initiatorType === 'script').length,
        topResources: resources.slice(0, 8)
      }
    })
  } finally {
    await browser?.close()
  }

  console.log(`Startup benchmark against ${url}`)
  console.log(`Server ready: ${formatMilliseconds(serverReadyMs)}`)
  console.log(`First response end: ${formatMilliseconds(metrics.responseEnd)}`)
  console.log(`DOMContentLoaded: ${formatMilliseconds(metrics.domContentLoaded)}`)
  console.log(`Loading shell visible: ${formatMilliseconds(shellState.visibleAt)}`)
  console.log(`Loading shell complete: ${formatMilliseconds(loadingCompleteAt)}`)
  console.log(`Loading dots animation: ${shellState.dotsAnimationName ?? 'missing'}`)
  console.log(`Load event end: ${formatMilliseconds(metrics.loadEventEnd)}`)
  console.log(`Scene ready at first rendered frame: ${formatMilliseconds(sceneReadyAt)}`)
  console.log(`Navigation transfer size: ${metrics.transferSize} bytes`)
  console.log(`Navigation encoded body size: ${metrics.encodedBodySize} bytes`)
  console.log(`Resource requests: ${metrics.resourceCount}`)
  console.log(`Script-initiated requests: ${metrics.scriptCount}`)
  console.log('Slowest startup resources:')

  for (const resource of metrics.topResources) {
    console.log(
      `- ${formatMilliseconds(resource.duration)} ${resource.initiatorType || 'other'} ${resource.name}`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
