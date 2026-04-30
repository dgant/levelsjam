const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const nodeCommand = process.execPath
const profilePath = path.join(rootDir, 'logs', 'latest-maze-test-profile.json')
const overallThresholdMs = 45_000
const testFile = 'tests/maze.test.js'
const testCases = [
  { name: 'generates valid mazes under 100ms', thresholdMs: 5_000 },
  { name: 'places initial torch lights on pickup cells', thresholdMs: 5_000 },
  { name: 'initial monsters face legal movement cells or their backlight torches', thresholdMs: 5_000 },
  { name: 'generated wall decals avoid torch-bearing wall faces', thresholdMs: 5_000 },
  { name: 'persists at least five valid mazes', thresholdMs: 12_000 },
  { name: 'persists thirty compact valid challenge mazes from 5x5 through 9x9', thresholdMs: 25_000 },
  { name: 'dumps persisted maze lightmap artifacts into the gitignored logs directory', thresholdMs: 5_000 },
  { name: 'deletes invalid maze files and regenerates replacements', thresholdMs: 5_000 },
  { name: 'converts persisted mazes into wall segments and torch placements', thresholdMs: 5_000 },
  { name: 'maps runtime floor lightmap UVs to the same world-space orientation used by baking', thresholdMs: 5_000 },
  { name: 'keeps baked lighting continuous across an open coplanar wall run', thresholdMs: 5_000 },
  { name: 'bakes local sconce occlusion into the attached wall face', thresholdMs: 5_000 },
  { name: 'bakes same-cell torch energy into volumetric lightmap coefficients', thresholdMs: 5_000 },
  { name: 'keeps mid-wall torch lighting visible below the sconce top', thresholdMs: 5_000 },
  { name: 'stores baked wall skylight in the HDR lightmap', thresholdMs: 5_000 },
  { name: 'bakes lightmap rectangles for maze wall short end faces', thresholdMs: 5_000 },
  { name: 'three box geometry mirrors local -Z face UVs relative to +Z', thresholdMs: 5_000 },
  { name: 'assigns z-axis wall-run lightmap slices to the correct wall', thresholdMs: 5_000 }
]

function formatMilliseconds(value) {
  return `${value.toFixed(1)}ms`
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseTestDurations(stdout) {
  const durations = new Map()
  const lines = stdout.split(/\r?\n/)
  let currentName = null

  for (const line of lines) {
    const nameMatch = line.match(/# Subtest: (.+)$/)

    if (nameMatch) {
      currentName = nameMatch[1]
      continue
    }

    const durationMatch = line.match(/duration_ms: ([0-9.]+)/)

    if (!durationMatch || !currentName) {
      continue
    }

    const durationMs = Number(durationMatch[1])

    if (Number.isFinite(durationMs) && !durations.has(currentName)) {
      durations.set(currentName, durationMs)
    }
  }

  return durations
}

function runSelectedTests() {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint()
    const timeoutMs = Math.max(
      testCases.reduce((sum, testCase) => sum + testCase.thresholdMs, 0) * 2,
      60_000
    )
    const pattern = `^(${testCases.map((testCase) => escapeRegExp(testCase.name)).join('|')})$`

    console.log(
      `starting maze test batch: ${testCases.length} selected tests (timeout ${formatMilliseconds(timeoutMs)})`
    )
    const child = spawn(
      nodeCommand,
      ['--test', '--test-name-pattern', pattern, testFile],
      {
        cwd: rootDir,
        env: { ...process.env }
      }
    )
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
      setTimeout(() => {
        if (!settled) {
          child.kill('SIGKILL')
        }
      }, 1_000).unref()
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('close', (code) => {
      settled = true
      clearTimeout(timeout)
      const wallDurationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
      const durations = parseTestDurations(stdout)

      resolve({
        code: timedOut ? 1 : code ?? 1,
        durations,
        stderr,
        stdout,
        timedOut,
        timeoutMs,
        wallDurationMs
      })
    })
  })
}

function writeProfile(profile) {
  fs.mkdirSync(path.dirname(profilePath), { recursive: true })
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
}

async function main() {
  const startedAt = Date.now()
  const batchResult = await runSelectedTests()
  const results = testCases.map((testCase) => {
    const durationMs = batchResult.durations.get(testCase.name)

    return {
      code: durationMs === undefined ? 1 : batchResult.code,
      durationMs: durationMs ?? batchResult.wallDurationMs,
      name: testCase.name,
      reportedDurationMs: durationMs,
      stderr: batchResult.stderr,
      stdout: batchResult.stdout,
      thresholdMs: testCase.thresholdMs,
      timedOut: batchResult.timedOut,
      timeoutMs: batchResult.timeoutMs,
      wallDurationMs: batchResult.wallDurationMs
    }
  })

  const wallTotalDurationMs = Date.now() - startedAt
  const totalDurationMs = results.reduce((sum, result) => sum + result.durationMs, 0)
  const failures = []

  console.log(`reported total: ${formatMilliseconds(totalDurationMs)}`)
  console.log(`wall total: ${formatMilliseconds(wallTotalDurationMs)}`)

  for (const result of results) {
    if (result.code !== 0) {
      failures.push(
        result.timedOut
          ? `${result.name} timed out after ${formatMilliseconds(result.timeoutMs)}`
          : `${result.name} failed or did not report a duration`
      )
      continue
    }

    if (result.durationMs > result.thresholdMs) {
      failures.push(
        `${result.name} exceeded its threshold (${formatMilliseconds(result.durationMs)} > ${formatMilliseconds(result.thresholdMs)})`
      )
    }
  }

  if (totalDurationMs > overallThresholdMs) {
    failures.push(
      `maze suite exceeded its threshold (${formatMilliseconds(totalDurationMs)} > ${formatMilliseconds(overallThresholdMs)})`
    )
  }

  writeProfile({
    files: results.map((result) => ({
      durationMs: result.durationMs,
      name: result.name,
      overThreshold: result.durationMs > result.thresholdMs,
      reportedDurationMs: result.reportedDurationMs,
      thresholdMs: result.thresholdMs,
      timedOut: result.timedOut,
      timeoutMs: result.timeoutMs,
      wallDurationMs: result.wallDurationMs
    })),
    generatedAt: new Date().toISOString(),
    overallThresholdMs,
    totalDurationMs,
    wallTotalDurationMs
  })

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
