const path = require('node:path')
const net = require('node:net')
const { spawnSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const smokePort = 42731
const thresholdsMs = {
  'test:unit': 20_000,
  'test:smoke:runner': 60_000
}
const requiredScripts = ['test:perf:runner']

function usesPlaywrightWebServer(scriptName) {
  return scriptName.includes('smoke') || scriptName.includes('perf')
}

function formatMilliseconds(value) {
  return `${value.toFixed(0)}ms`
}

function runTimedScript(scriptName) {
  const start = process.hrtime.bigint()
  const result = spawnSync(npmCommand, ['run', scriptName], {
    cwd: rootDir,
    stdio: 'inherit'
  })
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6

  if (result.status !== 0) {
    throw new Error(`${scriptName} failed after ${formatMilliseconds(durationMs)}`)
  }

  return durationMs
}

function assertThreshold(scriptName, durationMs) {
  const thresholdMs = thresholdsMs[scriptName]

  console.log(`${scriptName}: ${formatMilliseconds(durationMs)} (threshold ${formatMilliseconds(thresholdMs)})`)

  if (durationMs > thresholdMs) {
    throw new Error(`${scriptName} exceeded its threshold`)
  }
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })

    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(250, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function waitForPortToBeFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Port ${port} remained busy for ${formatMilliseconds(timeoutMs)}`)
}

async function main() {
  console.log('Preparing the published build once before the smoke benchmark')
  runTimedScript('build:pages')

  for (const scriptName of requiredScripts) {
    if (usesPlaywrightWebServer(scriptName)) {
      await waitForPortToBeFree(smokePort, 10_000)
    }

    runTimedScript(scriptName)
  }

  for (const scriptName of Object.keys(thresholdsMs)) {
    if (usesPlaywrightWebServer(scriptName)) {
      await waitForPortToBeFree(smokePort, 10_000)
    }

    const durationMs = runTimedScript(scriptName)
    assertThreshold(scriptName, durationMs)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
