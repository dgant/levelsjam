const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const rootDir = path.resolve(__dirname, '..')
const nodeCommand = process.execPath
const profilePath = path.join(rootDir, 'logs', 'latest-maze-test-profile.json')
const overallThresholdMs = 20_000
const testFile = 'tests/maze.test.js'
const testCases = [
  { name: 'generates valid mazes under 100ms', thresholdMs: 5_000 },
  { name: 'places initial torch lights on pickup cells', thresholdMs: 5_000 },
  { name: 'persists at least five valid mazes', thresholdMs: 12_000 },
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

function parseReportedDuration(stdout) {
  const matches = [...stdout.matchAll(/# duration_ms ([0-9.]+)/g)]
  const lastMatch = matches.at(-1)

  if (!lastMatch) {
    return null
  }

  const durationMs = Number(lastMatch[1])
  return Number.isFinite(durationMs) ? durationMs : null
}

function runTestCase(testCase) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint()
    const timeoutMs = Math.max(testCase.thresholdMs * 4, 15_000)
    console.log(
      `starting: ${testCase.name} (timeout ${formatMilliseconds(timeoutMs)})`
    )
    const child = spawn(
      nodeCommand,
      ['--test', '--test-name-pattern', `^${escapeRegExp(testCase.name)}$`, testFile],
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
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => {
      settled = true
      clearTimeout(timeout)
      const wallDurationMs = Number(process.hrtime.bigint() - startedAt) / 1e6

      resolve({
        code: timedOut ? 1 : code ?? 1,
        durationMs: parseReportedDuration(stdout) ?? wallDurationMs,
        name: testCase.name,
        reportedDurationMs: parseReportedDuration(stdout),
        stderr,
        stdout,
        thresholdMs: testCase.thresholdMs,
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
  const results = []

  for (const testCase of testCases) {
    const result = await runTestCase(testCase)
    results.push(result)
    console.log(
      `${testCase.name}: ${formatMilliseconds(result.durationMs)}`
    )
  }

  const wallTotalDurationMs = Date.now() - startedAt
  const totalDurationMs = results.reduce((sum, result) => sum + result.durationMs, 0)
  const failures = []

  console.log(`reported total: ${formatMilliseconds(totalDurationMs)}`)
  console.log(`wall total: ${formatMilliseconds(wallTotalDurationMs)}`)

  for (const result of results) {
    if (result.code !== 0) {
      process.stdout.write(result.stdout)
      process.stderr.write(result.stderr)
      failures.push(
        result.timedOut
          ? `${result.name} timed out after ${formatMilliseconds(result.timeoutMs)}`
          : `${result.name} exited with code ${result.code}`
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
