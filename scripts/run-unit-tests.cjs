const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const nodeCommand = process.execPath
const unitProfilePath = path.join(rootDir, 'logs', 'latest-unit-test-profile.json')
const overallThresholdMs = 20_000
const testFiles = [
  'tests/billboard.test.js',
  'tests/lighting-calibration.test.js',
  'tests/maze.test.js',
  'tests/player-collision.test.js',
  'tests/player-motion.test.js',
  'tests/probe-spherical-harmonics.test.js',
  'tests/reflection-probe-blending.test.js',
  'tests/scene-layout.test.js',
  'tests/turn-rules.test.js'
]
const perFileThresholdsMs = {
  'tests/billboard.test.js': 3_000,
  'tests/lighting-calibration.test.js': 3_000,
  'tests/maze.test.js': 14_000,
  'tests/player-collision.test.js': 3_000,
  'tests/player-motion.test.js': 3_000,
  'tests/probe-spherical-harmonics.test.js': 3_000,
  'tests/reflection-probe-blending.test.js': 3_000,
  'tests/scene-layout.test.js': 3_000,
  'tests/turn-rules.test.js': 3_000
}

function formatMilliseconds(value) {
  return `${value.toFixed(1)}ms`
}

function getWorkerCount() {
  const cpuCount = Math.max(1, os.cpus().length)
  const unusedCores = Math.max(4, Math.ceil(cpuCount / 2))
  const usableCores = Math.max(1, cpuCount - unusedCores)

  return Math.max(1, Math.floor(usableCores / 2))
}

function parseTapSubtests(stdout) {
  const matches = [...stdout.matchAll(/# Subtest: ([^\r\n]+)[\s\S]*?duration_ms: ([0-9.]+)/g)]

  return matches
    .map((match) => ({
      durationMs: Number(match[2]),
      name: match[1]
    }))
    .filter((entry) => Number.isFinite(entry.durationMs))
}

function parseReportedDuration(stdout) {
  const matches = [...stdout.matchAll(/# duration_ms ([0-9.]+)/g)]
  const lastMatch = matches.at(-1)

  if (!lastMatch) {
    return null
  }

  const durationMs = Number(lastMatch[1])

  return Number.isFinite(durationMs) ? durationMs : null
}

function runTestFile(filePath) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint()
    const child = spawn(nodeCommand, [filePath], {
      cwd: rootDir,
      env: { ...process.env }
    })
    let stdout = ''
    let stderr = ''
    let sawCompleteTapSummary = false
    let summaryIndicatesFailure = false
    let killScheduled = false

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      sawCompleteTapSummary =
        stdout.includes('\n# tests ') &&
        stdout.includes('\n# pass ') &&
        stdout.includes('\n# fail ') &&
        stdout.includes('\n# duration_ms ')
      summaryIndicatesFailure = /# fail [1-9]/.test(stdout)

      if (sawCompleteTapSummary && !summaryIndicatesFailure && !killScheduled) {
        killScheduled = true
        setTimeout(() => {
          if (!child.killed) {
            child.kill()
          }
        }, 100)
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => {
      const wallDurationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const reportedDurationMs = parseReportedDuration(stdout)
      const normalizedCode =
        sawCompleteTapSummary && !summaryIndicatesFailure
          ? 0
          : (code ?? 1)

      resolve({
        code: normalizedCode,
        durationMs: reportedDurationMs ?? wallDurationMs,
        filePath,
        reportedDurationMs,
        stderr,
        stdout,
        testCases: parseTapSubtests(stdout),
        wallDurationMs
      })
    })
  })
}

async function runWithWorkerPool(workerCount) {
  const results = []
  const queue = [...testFiles]

  async function worker() {
    while (queue.length > 0) {
      const filePath = queue.shift()

      if (!filePath) {
        return
      }

      const result = await runTestFile(filePath)

      results.push(result)
      console.log(
        `${filePath}: ${formatMilliseconds(result.durationMs)}${result.reportedDurationMs === null ? ` (wall ${formatMilliseconds(result.wallDurationMs)})` : ''}`
      )
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(workerCount, testFiles.length) }, () => worker())
  )

  return results.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

function writeProfile(profile) {
  fs.mkdirSync(path.dirname(unitProfilePath), { recursive: true })
  fs.writeFileSync(unitProfilePath, JSON.stringify(profile, null, 2))
}

async function main() {
  const workerCount = getWorkerCount()
  const startedAt = Date.now()
  const results = await runWithWorkerPool(workerCount)
  const wallTotalDurationMs = Date.now() - startedAt
  const totalDurationMs = results.reduce((sum, result) => sum + result.durationMs, 0)
  const failures = []
  const profile = {
    generatedAt: new Date().toISOString(),
    overallThresholdMs,
    totalDurationMs,
    wallTotalDurationMs,
    workerCount,
    files: results.map((result) => ({
      durationMs: result.durationMs,
      filePath: result.filePath,
      overThreshold: result.durationMs > (perFileThresholdsMs[result.filePath] ?? Infinity),
      reportedDurationMs: result.reportedDurationMs,
      testCases: result.testCases
    }))
  }

  console.log(`reported total: ${formatMilliseconds(totalDurationMs)}`)
  console.log(`wall total: ${formatMilliseconds(wallTotalDurationMs)}`)

  for (const result of results) {
    if (result.code !== 0) {
      process.stdout.write(result.stdout)
      process.stderr.write(result.stderr)
      failures.push(`${result.filePath} exited with code ${result.code}`)
      continue
    }

    const thresholdMs = perFileThresholdsMs[result.filePath]

    if (typeof thresholdMs === 'number' && result.durationMs > thresholdMs) {
      failures.push(
        `${result.filePath} exceeded its threshold (${formatMilliseconds(result.durationMs)} > ${formatMilliseconds(thresholdMs)})`
      )
    }
  }

  if (totalDurationMs > overallThresholdMs) {
    failures.push(
      `unit suite exceeded its threshold (${formatMilliseconds(totalDurationMs)} > ${formatMilliseconds(overallThresholdMs)})`
    )
  }

  writeProfile(profile)

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
