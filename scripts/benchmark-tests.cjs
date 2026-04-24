const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawnSync } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const smokePort = 42731
const thresholdsMs = {
  'test:unit': 20_000,
  'test:perf:runner': 60_000,
  'test:smoke:runner': 180_000,
  'test:render:integration:runner': 180_000
}
const smokeStartupThresholdMs = 60_000
const smokeProfilePath = path.join(rootDir, 'logs', 'latest-smoke-profile.json')
const renderIntegrationProfilePath = path.join(
  rootDir,
  'logs',
  'latest-render-integration-profile.json'
)
const unitProfilePath = path.join(rootDir, 'logs', 'latest-unit-test-profile.json')
const benchmarkReportPath = path.join(rootDir, 'logs', 'latest-test-benchmark.json')

function usesPlaywrightWebServer(scriptName) {
  return (
    scriptName.includes('smoke') ||
    scriptName.includes('perf') ||
    scriptName.includes('render:integration')
  )
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
    env: { ...process.env },
    stdio: 'inherit',
    windowsHide: true
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
    const renderIntegrationProfile =
      scriptName === 'test:render:integration:runner'
        ? readJsonIfPresent(renderIntegrationProfilePath)
        : null
    const unitProfile =
      scriptName === 'test:unit'
        ? readJsonIfPresent(unitProfilePath)
        : null
    const effectiveDurationMs =
      scriptName === 'test:unit' && typeof unitProfile?.totalDurationMs === 'number'
        ? unitProfile.totalDurationMs
        : scriptName === 'test:render:integration:runner' &&
            typeof renderIntegrationProfile?.totalRunMs === 'number'
          ? renderIntegrationProfile.totalRunMs
        : result.durationMs
    const startupPhaseDurationMs =
      scriptName === 'test:smoke:runner'
        ? smokeProfile?.phases?.find((phase) => phase.label === 'startup')?.durationMs ?? null
        : null

    const record = {
      ...result,
      effectiveDurationMs,
      overThreshold,
      renderIntegrationProfile,
      startupPhaseDurationMs,
      smokeProfile,
      unitProfile,
      thresholdMs
    }

    record.overThreshold = effectiveDurationMs > thresholdMs

    report.results.push(record)
    console.log(
      `${scriptName}: ${formatMilliseconds(effectiveDurationMs)} (threshold ${formatMilliseconds(thresholdMs)})`
    )

    if (smokeProfile?.phases?.length) {
      console.log('Top smoke phases:')
      for (const phase of smokeProfile.phases.slice(0, 5)) {
        console.log(`- ${formatMilliseconds(phase.durationMs)} ${phase.label}`)
      }
      if (typeof startupPhaseDurationMs === 'number') {
        console.log(
          `Smoke startup phase: ${formatMilliseconds(startupPhaseDurationMs)} (threshold ${formatMilliseconds(smokeStartupThresholdMs)})`
        )
      }
      console.log(
        `Smoke screenshots: ${smokeProfile.screenshotCount} in ${formatMilliseconds(smokeProfile.screenshotMs)}`
      )
    }

    if (renderIntegrationProfile?.phases?.length) {
      console.log('Top render-integration phases:')
      for (const phase of renderIntegrationProfile.phases.slice(0, 5)) {
        console.log(`- ${formatMilliseconds(phase.durationMs)} ${phase.label}`)
      }
      console.log(
        `Render screenshots: ${renderIntegrationProfile.screenshotCount} in ${formatMilliseconds(renderIntegrationProfile.screenshotMs)}`
      )
    }

    if (unitProfile?.files?.length) {
      console.log('Slowest unit files:')
      for (const entry of [...unitProfile.files]
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 5)) {
        console.log(`- ${formatMilliseconds(entry.durationMs)} ${entry.filePath}`)
      }
    }

    if (result.error) {
      failures.push(result.error)
      continue
    }

    if (record.overThreshold) {
      failures.push(`${scriptName} exceeded its threshold`)
    }

    if (
      scriptName === 'test:smoke:runner' &&
      typeof startupPhaseDurationMs === 'number' &&
      startupPhaseDurationMs > smokeStartupThresholdMs
    ) {
      failures.push('test:smoke:runner startup phase exceeded its threshold')
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
