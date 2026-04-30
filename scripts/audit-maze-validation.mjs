import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { validateMaze } from '../src/lib/maze.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultChallengeDirectory = path.join(rootDir, 'src', 'data', 'challenge-mazes')
const outputPath = path.join(rootDir, 'logs', 'latest-maze-validation-audit.json')

function normalizeReason(error) {
  if (error.includes('expansion limit') || error.includes('time limit')) {
    return error.includes('time limit')
      ? 'Perfect-information search hit time limit'
      : 'Perfect-information search hit expansion limit'
  }
  if (error.startsWith('Cell ') && error.includes(' is not covered by any light')) {
    return 'Cell is not covered by any light'
  }
  if (error.startsWith('Cell ') && error.includes(' has fewer than two open edges')) {
    return 'Cell has fewer than two open edges'
  }
  if (error.startsWith('Cell ') && error.includes('does not have two internally vertex-disjoint paths')) {
    return 'Cell lacks two disjoint paths to opening'
  }
  if (error.startsWith('Open edge ') && error.includes('can be removed')) {
    return 'Open edge can be removed without violating core constraints'
  }
  if (error.startsWith('Removing monster ') && error.includes('no solution was found')) {
    return 'Removing monster found no faster solution because no solution was found'
  }
  if (error.startsWith('Removing monster ')) {
    return 'Removing monster did not produce a faster solution'
  }
  if (error.startsWith('Removing gate edge ')) {
    return 'Removing gate did not make maze impossible'
  }
  if (error.startsWith('Optimal solution must walk at least 75%')) {
    return 'Optimal solution walked too few cells'
  }
  if (error.startsWith('Optimal solution must see at least 90%')) {
    return 'Optimal solution saw too few cells'
  }
  if (error.startsWith('Optimal return must walk at least 25%')) {
    return 'Optimal return walked too few new cells'
  }
  if (error.startsWith('Imperfect-information solver success rate')) {
    return 'Imperfect-information solver success rate too low'
  }

  return error
}

function createFrequencyTracker() {
  const frequency = new Map()

  return {
    add(error) {
      const reason = normalizeReason(error)

      frequency.set(reason, (frequency.get(reason) ?? 0) + 1)
    },
    toJSON() {
      return [...frequency.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([reason, count]) => ({ count, reason }))
    }
  }
}

function createTimingTracker() {
  const timings = new Map()

  return {
    add(stage, durationMs) {
      const entry = timings.get(stage) ?? {
        count: 0,
        maxMs: 0,
        totalMs: 0
      }

      entry.count += 1
      entry.maxMs = Math.max(entry.maxMs, durationMs)
      entry.totalMs += durationMs
      timings.set(stage, entry)
    },
    toJSON() {
      return Object.fromEntries(
        [...timings.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([stage, entry]) => [stage, {
            averageMs: entry.count > 0 ? entry.totalMs / entry.count : 0,
            count: entry.count,
            maxMs: entry.maxMs,
            totalMs: entry.totalMs
          }])
      )
    }
  }
}

async function importMaze(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?audit=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)

  return imported.default
}

async function main() {
  const challengeDirectory =
    process.argv[2]
      ? path.resolve(process.argv[2])
      : defaultChallengeDirectory
  const files = fs.readdirSync(challengeDirectory)
    .filter((fileName) => /^(challenge|maze)-\d{3}\.js$/.test(fileName))
    .sort()
    .slice(0, Number(process.env.LEVELSJAM_AUDIT_MAX_FILES ?? Number.POSITIVE_INFINITY))
  const frequency = createFrequencyTracker()
  const timings = createTimingTracker()
  const sizeFrequency = new Map()
  const profileFrequency = new Map()
  const results = []

  for (const fileName of files) {
    const startedAt = performance.now()
    const filePath = path.join(challengeDirectory, fileName)
    const maze = await importMaze(filePath)
    const validation = validateMaze(maze, {
      requireLightmap: false,
      advancedDifficultyOptions: {
        imperfectTrialCount: Number(process.env.LEVELSJAM_AUDIT_IMPERFECT_TRIALS ?? '5'),
        maxImperfectActionCount: Number(process.env.LEVELSJAM_AUDIT_MAX_IMPERFECT_ACTIONS ?? '320'),
        maxImperfectPlanExpansions: Number(process.env.LEVELSJAM_AUDIT_MAX_IMPERFECT_EXPANSIONS ?? '500'),
        maxPerfectDurationMs: Number(process.env.LEVELSJAM_AUDIT_MAX_PERFECT_DURATION_MS ?? Number.POSITIVE_INFINITY),
        maxPerfectExpansions: Number(process.env.LEVELSJAM_AUDIT_MAX_PERFECT_EXPANSIONS ?? '50000'),
        onTiming(entry) {
          timings.add(entry.stage, entry.durationMs)
        }
      }
    })

    for (const error of validation.errors) {
      frequency.add(error)
    }

    const sizeKey = `${maze.width}x${maze.height}`
    const profileKey = JSON.stringify(maze.contentProfile ?? {})
    const sizeEntry = sizeFrequency.get(sizeKey) ?? createFrequencyTracker()
    const profileEntry = profileFrequency.get(profileKey) ?? createFrequencyTracker()

    for (const error of validation.errors) {
      sizeEntry.add(error)
      profileEntry.add(error)
    }

    sizeFrequency.set(sizeKey, sizeEntry)
    profileFrequency.set(profileKey, profileEntry)

    results.push({
      durationMs: performance.now() - startedAt,
      errors: validation.errors,
      fileName,
      id: maze.id,
      validationDurationMs: validation.durationMs,
      validationTimings: validation.timings,
      metrics: validation.metrics
        ? {
            postTrophyNewCellRatio: validation.metrics.postTrophyNewCellRatio,
            seenCellRatio: validation.metrics.seenCellRatio,
            walkedCellRatio: validation.metrics.walkedCellRatio
          }
        : null,
      profile: maze.contentProfile ?? null,
      size: sizeKey,
      valid: validation.valid
    })
    console.log(
      `${fileName}: ${validation.valid ? 'valid' : `${validation.errors.length} failures`} ` +
      `(${(performance.now() - startedAt).toFixed(1)}ms)`
    )
  }

  const report = {
    generatedAt: new Date().toISOString(),
    directory: challengeDirectory,
    failureFrequency: frequency.toJSON(),
    failureFrequencyByProfile: Object.fromEntries(
      [...profileFrequency.entries()].map(([profile, tracker]) => [profile, tracker.toJSON()])
    ),
    failureFrequencyBySize: Object.fromEntries(
      [...sizeFrequency.entries()].map(([size, tracker]) => [size, tracker.toJSON()])
    ),
    results,
    timings: {
      averageDurationMs: results.length > 0
        ? results.reduce((sum, result) => sum + result.durationMs, 0) / results.length
        : 0,
      maxDurationMs: results.reduce((max, result) => Math.max(max, result.durationMs), 0),
      phases: timings.toJSON()
    },
    validCount: results.filter((result) => result.valid).length
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
  console.log(`wrote ${path.relative(rootDir, outputPath)}`)
  console.log(`valid ${report.validCount}/${results.length}`)
  for (const entry of report.failureFrequency.slice(0, 20)) {
    console.log(`${entry.count}x ${entry.reason}`)
  }

  if (report.validCount !== results.length) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
