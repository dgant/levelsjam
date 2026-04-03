const path = require('node:path')
const { spawnSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const thresholdsMs = {
  'test:unit': 20_000,
  'test:smoke:runner': 60_000
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

function main() {
  console.log('Preparing the published build once before the smoke benchmark')
  runTimedScript('build:pages')

  for (const scriptName of Object.keys(thresholdsMs)) {
    const durationMs = runTimedScript(scriptName)
    assertThreshold(scriptName, durationMs)
  }
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
