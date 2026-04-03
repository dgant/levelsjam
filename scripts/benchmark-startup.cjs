const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { chromium } = require('@playwright/test')

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

async function main() {
  const serverStart = process.hrtime.bigint()
  runNodeScript(devServerCommand[0], devServerCommand[1])
  const serverReadyMs = Number(process.hrtime.bigint() - serverStart) / 1e6

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto(url, { waitUntil: 'load' })
  await page.locator('canvas[data-scene-ready=\"true\"]').waitFor()

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
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
      sceneReadyAt: Number(canvas?.dataset.sceneReadyAt ?? Number.NaN),
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

  await browser.close()

  console.log(`Startup benchmark against ${url}`)
  console.log(`Server ready: ${formatMilliseconds(serverReadyMs)}`)
  console.log(`First response end: ${formatMilliseconds(metrics.responseEnd)}`)
  console.log(`DOMContentLoaded: ${formatMilliseconds(metrics.domContentLoaded)}`)
  console.log(`Load event end: ${formatMilliseconds(metrics.loadEventEnd)}`)
  console.log(`Scene ready at first rendered frame: ${formatMilliseconds(metrics.sceneReadyAt)}`)
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
