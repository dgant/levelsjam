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
  { name: 'initial monsters face legal movement cells', thresholdMs: 5_000 },
  { name: 'generated wall decals avoid torch-bearing wall faces', thresholdMs: 5_000 },
  { name: 'persists at least five valid mazes', thresholdMs: 12_000 },
  { name: 'dumps persisted maze lightmap artifacts into the gitignored logs directory', thresholdMs: 5_000 },
  { name: 'deletes invalid maze files and regenerates replacements', thresholdMs: 5_000 },
  { name: 'converts persisted mazes into wall segments and torch placements', thresholdMs: 5_000 },
  { name: 'bakes visible floor light into the torch-facing side of each lit cell', thresholdMs: 5_000 },
  { name: 'keeps baked lighting continuous across an open coplanar wall run', thresholdMs: 15_000 },
  { name: 'bakes local sconce occlusion into the attached wall face', thresholdMs: 15_000 },
  { name: 'bakes same-cell torch energy into volumetric lightmap coefficients', thresholdMs: 5_000 },
  { name: 'keeps mid-wall torch lighting visible below the sconce top', thresholdMs: 15_000 },
  { name: 'stores baked wall skylight in the HDR lightmap', thresholdMs: 15_000 },
  { name: 'bakes lightmap rectangles for maze wall short end faces', thresholdMs: 15_000 },
  { name: 'three box geometry mirrors local -Z face UVs relative to +Z', thresholdMs: 5_000 },
  { name: 'assigns z-axis wall-run lightmap slices to the correct wall', thresholdMs: 15_000 }
]

function formatMilliseconds(value) {
  return `${value.toFixed(1)}ms`
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

function parseTapSubtests(stdout) {
  const matches = [...stdout.matchAll(/# Subtest: ([^\r\n]+)/g)]
  const subtests = []

  for (const match of matches) {
    const durationMatch = stdout
      .slice(match.index)
      .match(/duration_ms: ([0-9.]+)/)

    if (!durationMatch) {
      continue
    }

    const durationMs = Number(durationMatch[1])

    if (Number.isFinite(durationMs)) {
      subtests.push({
        durationMs,
        name: match[1]
      })
    }
  }

  return subtests
}

function runTestFile() {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint()
    const timeoutMs = 120_000
    console.log(`starting: ${testFile} (timeout ${formatMilliseconds(timeoutMs)})`)
    const child = spawn(
      nodeCommand,
      ['--test', testFile],
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
        reportedDurationMs: parseReportedDuration(stdout),
        stderr,
        stdout,
        subtests: parseTapSubtests(stdout),
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
  const result = await runTestFile()
  const subtestsByName = new Map(result.subtests.map((subtest) => [subtest.name, subtest]))

  const wallTotalDurationMs = Date.now() - startedAt
  const totalDurationMs = result.durationMs
  const failures = []

  console.log(`reported total: ${formatMilliseconds(totalDurationMs)}`)
  console.log(`wall total: ${formatMilliseconds(wallTotalDurationMs)}`)

  if (result.code !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    failures.push(
      result.timedOut
        ? `${testFile} timed out after ${formatMilliseconds(result.timeoutMs)}`
        : `${testFile} exited with code ${result.code}`
    )
  }

  for (const testCase of testCases) {
    const subtest = subtestsByName.get(testCase.name)

    if (!subtest) {
      failures.push(`${testCase.name} did not run`)
      continue
    }

    console.log(`${testCase.name}: ${formatMilliseconds(subtest.durationMs)}`)

    if (subtest.durationMs > testCase.thresholdMs) {
      failures.push(
        `${testCase.name} exceeded its threshold (${formatMilliseconds(subtest.durationMs)} > ${formatMilliseconds(testCase.thresholdMs)})`
      )
    }
  }

  if (totalDurationMs > overallThresholdMs) {
    failures.push(
      `maze suite exceeded its threshold (${formatMilliseconds(totalDurationMs)} > ${formatMilliseconds(overallThresholdMs)})`
    )
  }

  writeProfile({
    files: testCases.map((testCase) => {
      const subtest = subtestsByName.get(testCase.name)

      return {
        durationMs: subtest?.durationMs ?? null,
        name: testCase.name,
        overThreshold: subtest ? subtest.durationMs > testCase.thresholdMs : true,
        thresholdMs: testCase.thresholdMs
      }
    }),
    run: {
      durationMs: result.durationMs,
      reportedDurationMs: result.reportedDurationMs,
      timedOut: result.timedOut,
      timeoutMs: result.timeoutMs,
      wallDurationMs: result.wallDurationMs
    },
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
