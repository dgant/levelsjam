const fs = require('node:fs')
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
const smokeProfilePath = path.join(rootDir, 'logs', 'latest-smoke-profile.json')
const benchmarkReportPath = path.join(rootDir, 'logs', 'latest-test-benchmark.json')

function usesPlaywrightWebServer(scriptName) {
  return scriptName.includes('smoke') || scriptName.includes('perf')
}

function formatMilliseconds(value) {
  return `${value.toFixed(0)}ms`
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function runTimedScript(scriptName) {
  const start = process.hrtime.bigint()
  const result = spawnSync(npmCommand, ['run', scriptName], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env }
  })
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6

  return {
    durationMs,
    error:
      result.status === 0
        ? null
        : `${scriptName} exited with code ${result.status} after ${formatMilliseconds(durationMs)}`,
    exitCode: result.status ?? 1,
    scriptName
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

function writeBenchmarkReport(report) {
  fs.mkdirSync(path.dirname(benchmarkReportPath), { recursive: true })
  fs.writeFileSync(benchmarkReportPath, JSON.stringify(report, null, 2))
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    results: []
  }
  const failures = []

  console.log('Preparing the published build once before the smoke benchmark')
  const buildResult = runTimedScript('build:pages')
  report.buildPages = buildResult
  if (buildResult.error) {
    failures.push(buildResult.error)
    writeBenchmarkReport(report)
    throw new Error(buildResult.error)
  }

  for (const scriptName of Object.keys(thresholdsMs)) {
    if (usesPlaywrightWebServer(scriptName)) {
      await waitForPortToBeFree(smokePort, 10_000)
    }

    const result = runTimedScript(scriptName)
    const thresholdMs = thresholdsMs[scriptName]
    const overThreshold = result.durationMs > thresholdMs
    const smokeProfile =
      scriptName === 'test:smoke:runner'
        ? readJsonIfPresent(smokeProfilePath)
        : null

    const record = {
      ...result,
      overThreshold,
      smokeProfile,
      thresholdMs
    }

    report.results.push(record)
    console.log(
      `${scriptName}: ${formatMilliseconds(result.durationMs)} (threshold ${formatMilliseconds(thresholdMs)})`
    )

    if (smokeProfile?.phases?.length) {
      console.log('Top smoke phases:')
      for (const phase of smokeProfile.phases.slice(0, 5)) {
        console.log(`- ${formatMilliseconds(phase.durationMs)} ${phase.label}`)
      }
      console.log(
        `Smoke screenshots: ${smokeProfile.screenshotCount} in ${formatMilliseconds(smokeProfile.screenshotMs)}`
      )
    }

    if (result.error) {
      failures.push(result.error)
      continue
    }

    if (overThreshold) {
      failures.push(`${scriptName} exceeded its threshold`)
    }
  }

  writeBenchmarkReport(report)

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
