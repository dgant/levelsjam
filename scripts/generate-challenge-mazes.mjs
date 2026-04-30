import fs from 'node:fs'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  isMainThread,
  parentPort,
  Worker,
  workerData
} from 'node:worker_threads'

import {
  finalizeGeneratedMaze,
  generateMaze,
  getMazeSignature,
  serializeMazeModule,
  validateMaze
} from '../src/lib/maze.js'
import {
  solveMaze,
  solveMazeWithPerfectInformationResult
} from '../src/lib/mazeSolver.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(rootDir, 'src', 'data', 'challenge-mazes')
const reportPath = path.join(rootDir, 'logs', 'latest-challenge-generation-report.json')
const targetCount = Number(process.env.LEVELSJAM_CHALLENGE_TARGET_COUNT ?? '30')
const maxAttemptsPerMaze = Number(process.env.LEVELSJAM_CHALLENGE_MAX_ATTEMPTS ?? '1200')
const maxPerfectExpansions = Number(process.env.LEVELSJAM_CHALLENGE_MAX_PERFECT_EXPANSIONS ?? '50000')
const searchPerfectExpansions = Number(process.env.LEVELSJAM_CHALLENGE_SEARCH_PERFECT_EXPANSIONS ?? '12000')
const imperfectTrialCount = Number(process.env.LEVELSJAM_CHALLENGE_IMPERFECT_TRIALS ?? '5')
const progressInterval = Number(process.env.LEVELSJAM_CHALLENGE_PROGRESS_INTERVAL ?? '50')
const profileAttemptWindow = Number(process.env.LEVELSJAM_CHALLENGE_PROFILE_ATTEMPT_WINDOW ?? '50')
const topologyAttemptWindow = Number(process.env.LEVELSJAM_CHALLENGE_TOPOLOGY_ATTEMPT_WINDOW ?? '50')
const maxRunMs = Number(process.env.LEVELSJAM_CHALLENGE_MAX_RUN_MS ?? '60000')
const maxPrefilterSolveMs = Number(process.env.LEVELSJAM_CHALLENGE_MAX_PREFILTER_SOLVE_MS ?? '250')
const keepExistingValid = process.env.LEVELSJAM_CHALLENGE_KEEP_EXISTING !== '0'
const trustGeneratedExisting = process.env.LEVELSJAM_CHALLENGE_TRUST_GENERATED_EXISTING !== '0'
const workerCount = Math.max(
  1,
  Number(process.env.LEVELSJAM_CHALLENGE_WORKERS ?? Math.floor((availableParallelism?.() ?? 2) / 2))
)

const monsterProfiles = [
  ['minotaur', 'werewolf', 'spider'],
  ['minotaur', 'minotaur', 'werewolf'],
  ['minotaur', 'spider', 'spider'],
  ['werewolf', 'werewolf', 'spider'],
  ['spider', 'spider', 'spider'],
  ['minotaur', 'minotaur', 'spider']
]
const sizeProfileOrder = [
  { size: 5, profileIndex: 0 },
  { size: 5, profileIndex: 1 },
  { size: 5, profileIndex: 5 },
  { size: 6, profileIndex: 0 },
  { size: 6, profileIndex: 1 },
  { size: 6, profileIndex: 5 },
  { size: 7, profileIndex: 0 },
  { size: 6, profileIndex: 2 },
  { size: 7, profileIndex: 1 },
  { size: 8, profileIndex: 2 },
  { size: 7, profileIndex: 5 },
  { size: 8, profileIndex: 0 },
  { size: 9, profileIndex: 1 },
  { size: 8, profileIndex: 5 },
  { size: 9, profileIndex: 2 },
  { size: 9, profileIndex: 0 },
  { size: 7, profileIndex: 2 }
]

const names = [
  'Crossfire Loop',
  'Long Way Home',
  'Two-Step Ambush',
  'Outer Spiral',
  'Backtrack Trap',
  'Bull Corridor',
  'Wolf Return',
  'Wolf Detour',
  'Torchline',
  'Hard Left',
  'Trophy Sweep',
  'Corner Pressure',
  'Late Bite',
  'Forked Return',
  'North Hook',
  'South Hook',
  'Redoubt',
  'Sidewind',
  'Drawn Blade',
  'Last Lap',
  'Low Road',
  'High Road',
  'Sightline',
  'Coil',
  'Crosscut',
  'Double Back',
  'Red Path',
  'Dark Circuit',
  'Blade Tax',
  'Final Loop'
]
const topologyCache = new Map()

function createRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function integerFromRandom(random, maxExclusive) {
  return Math.floor(random() * maxExclusive)
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`
}

function edgeKey(edge) {
  return [cellKey(edge.from), cellKey(edge.to)].sort().join('|')
}

const geometryTransforms = [
  'identity',
  'rotate-90',
  'rotate-180',
  'rotate-270',
  'flip-x',
  'flip-y',
  'flip-diagonal',
  'flip-antidiagonal'
]

function transformGeometryCell(cell, width, height, transform) {
  const maxX = width - 1
  const maxY = height - 1

  switch (transform) {
    case 'rotate-90':
      return { x: maxY - cell.y, y: cell.x }
    case 'rotate-180':
      return { x: maxX - cell.x, y: maxY - cell.y }
    case 'rotate-270':
      return { x: cell.y, y: maxX - cell.x }
    case 'flip-x':
      return { x: maxX - cell.x, y: cell.y }
    case 'flip-y':
      return { x: cell.x, y: maxY - cell.y }
    case 'flip-diagonal':
      return { x: cell.y, y: cell.x }
    case 'flip-antidiagonal':
      return { x: maxY - cell.y, y: maxX - cell.x }
    default:
      return { ...cell }
  }
}

function directionToDelta(direction) {
  return {
    east: { x: 1, y: 0 },
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 }
  }[direction]
}

function deltaToDirection(delta) {
  if (delta.x === 1 && delta.y === 0) return 'east'
  if (delta.x === -1 && delta.y === 0) return 'west'
  if (delta.x === 0 && delta.y === 1) return 'south'
  if (delta.x === 0 && delta.y === -1) return 'north'
  return null
}

function transformGeometryDirection(direction, width, height, transform) {
  const delta = directionToDelta(direction)

  if (!delta) {
    return direction
  }

  const center = { x: 1, y: 1 }
  const moved = { x: center.x + delta.x, y: center.y + delta.y }
  const transformedCenter = transformGeometryCell(center, width + 2, height + 2, transform)
  const transformedMoved = transformGeometryCell(moved, width + 2, height + 2, transform)

  return deltaToDirection({
    x: transformedMoved.x - transformedCenter.x,
    y: transformedMoved.y - transformedCenter.y
  }) ?? direction
}

function getTransformedGeometrySize(maze, transform) {
  if (
    transform === 'rotate-90' ||
    transform === 'rotate-270' ||
    transform === 'flip-diagonal' ||
    transform === 'flip-antidiagonal'
  ) {
    return {
      height: maze.width,
      width: maze.height
    }
  }

  return {
    height: maze.height,
    width: maze.width
  }
}

function getGeometrySignatureForTransform(maze, transform) {
  const size = getTransformedGeometrySize(maze, transform)
  const openingCell = transformGeometryCell(
    maze.opening.cell,
    maze.width,
    maze.height,
    transform
  )

  return JSON.stringify({
    height: size.height,
    openEdges: (maze.openEdges ?? [])
      .map((edge) => edgeKey({
        from: transformGeometryCell(edge.from, maze.width, maze.height, transform),
        to: transformGeometryCell(edge.to, maze.width, maze.height, transform)
      }))
      .sort(),
    opening: `${cellKey(openingCell)}:${transformGeometryDirection(maze.opening.side, maze.width, maze.height, transform)}`,
    width: size.width
  })
}

function getStructuralSignature(maze) {
  return geometryTransforms
    .map((transform) => getGeometrySignatureForTransform(maze, transform))
    .sort()[0]
}

function allCells(maze) {
  const cells = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function createTopologyContext(maze) {
  const cells = allCells(maze)
  const cellIndexByKey = new Map(cells.map((cell, index) => [cellKey(cell), index]))
  const neighborsByKey = new Map(cells.map((cell) => [cellKey(cell), []]))

  for (const edge of maze.openEdges ?? []) {
    neighborsByKey.get(cellKey(edge.from))?.push(edge.to)
    neighborsByKey.get(cellKey(edge.to))?.push(edge.from)
  }

  const distanceFromOpening = new Map([[cellKey(maze.opening.cell), 0]])
  const queue = [maze.opening.cell]
  let readIndex = 0

  while (readIndex < queue.length) {
    const current = queue[readIndex]
    readIndex += 1
    const currentDistance = distanceFromOpening.get(cellKey(current)) ?? 0

    for (const neighbor of neighborsByKey.get(cellKey(current)) ?? []) {
      const key = cellKey(neighbor)

      if (distanceFromOpening.has(key)) {
        continue
      }

      distanceFromOpening.set(key, currentDistance + 1)
      queue.push(neighbor)
    }
  }

  const cellsByDescendingEntranceDistance = [...cells]
    .filter((cell) => Number.isFinite(distanceFromOpening.get(cellKey(cell)) ?? Number.POSITIVE_INFINITY))
    .sort((left, right) => (
      (distanceFromOpening.get(cellKey(right)) ?? 0) -
      (distanceFromOpening.get(cellKey(left)) ?? 0)
    ))

  return {
    cells,
    cellIndexByKey,
    cellsByDescendingEntranceDistance,
    distanceFromOpening,
    maze,
    neighborsByKey
  }
}

function chooseFarthestTrophyCell(topology, reservedKeys) {
  for (const cell of topology.cellsByDescendingEntranceDistance) {
    if (reservedKeys.has(cellKey(cell))) {
      continue
    }

    return cell
  }

  return null
}

function chooseSwordAndTrophyCells(topology, reservedKeys, random) {
  const scored = []
  const cellCount = topology.maze.width * topology.maze.height

  for (const sword of topology.cellsByDescendingEntranceDistance) {
    const swordKey = cellKey(sword)

    if (reservedKeys.has(swordKey)) {
      continue
    }

    const trophy = chooseFarthestTrophyCell(topology, new Set([...reservedKeys, swordKey]))

    if (!trophy) {
      continue
    }

    const routeAnalysis = getRouteAnalysis(topology, sword, trophy)
    const staticCoverage = routeAnalysis.uniqueCellCount / cellCount
    const staticReturnNovelty = routeAnalysis.postTrophyNewCellCount / cellCount
    const score =
      (staticCoverage * 4) +
      (staticReturnNovelty * 4) +
      (Math.min(routeAnalysis.moveCount / Math.max(1, cellCount), 1.2) * 2) +
      (random() * 0.2)

    scored.push({
      routeAnalysis,
      score,
      sword,
      trophy
    })
  }

  if (scored.length === 0) {
    return null
  }

  scored.sort((left, right) => right.score - left.score)

  return scored[integerFromRandom(random, Math.min(scored.length, 4))]
}

function takeUnreservedCell(cells, reservedKeys, random) {
  const candidates = cells.filter((cell) => !reservedKeys.has(cellKey(cell)))

  if (candidates.length === 0) {
    return null
  }

  return candidates[integerFromRandom(random, candidates.length)]
}

function shortestPathCells(topology, from, to) {
  const targetKey = cellKey(to)
  const queue = [from]
  const previousByKey = new Map([[cellKey(from), null]])
  let readIndex = 0

  while (readIndex < queue.length) {
    const current = queue[readIndex]
    readIndex += 1

    if (cellKey(current) === targetKey) {
      break
    }

    for (const neighbor of topology.neighborsByKey.get(cellKey(current)) ?? []) {
      const key = cellKey(neighbor)

      if (previousByKey.has(key)) {
        continue
      }

      previousByKey.set(key, current)
      queue.push(neighbor)
    }
  }

  if (!previousByKey.has(targetKey)) {
    return []
  }

  const pathCells = []
  let current = to

  while (current) {
    pathCells.push(current)
    current = previousByKey.get(cellKey(current))
  }

  pathCells.reverse()
  return pathCells
}

function getRouteAnalysis(topology, sword, trophy) {
  const toSword = shortestPathCells(topology, topology.maze.opening.cell, sword)
  const toTrophy = shortestPathCells(topology, sword, trophy)
  const toExit = shortestPathCells(topology, trophy, topology.maze.opening.cell)
  const preTrophyCells = [
    ...toSword,
    ...toTrophy.slice(1)
  ]
  const allRouteCells = [
    ...preTrophyCells,
    ...toExit.slice(1)
  ]
  const preTrophyKeys = new Set(preTrophyCells.map(cellKey))
  const routeKeys = new Set(allRouteCells.map(cellKey))
  const postTrophyNewKeys = new Set(
    toExit
      .map(cellKey)
      .filter((key) => !preTrophyKeys.has(key))
  )

  return {
    allRouteCells,
    moveCount: Math.max(0, allRouteCells.length - 1),
    postTrophyNewCellCount: postTrophyNewKeys.size,
    routeKeys,
    uniqueCellCount: routeKeys.size
  }
}

function getRouteDistanceMap(topology, routeKeys) {
  const distanceByKey = new Map()
  const queue = []
  let readIndex = 0

  for (const key of routeKeys) {
    const cell = topology.cells[topology.cellIndexByKey.get(key)]

    if (cell) {
      distanceByKey.set(key, 0)
      queue.push(cell)
    }
  }

  while (readIndex < queue.length) {
    const current = queue[readIndex]
    readIndex += 1
    const currentDistance = distanceByKey.get(cellKey(current)) ?? 0

    if (currentDistance >= 2) {
      continue
    }

    for (const neighbor of topology.neighborsByKey.get(cellKey(current)) ?? []) {
      const key = cellKey(neighbor)

      if (distanceByKey.has(key)) {
        continue
      }

      distanceByKey.set(key, currentDistance + 1)
      queue.push(neighbor)
    }
  }

  return distanceByKey
}

function chooseMonsterCells(topology, routeAnalysis, reservedKeys, monsterTypes, random) {
  const distanceByKey = getRouteDistanceMap(topology, routeAnalysis.routeKeys)
  const candidates = topology.cells
    .filter((cell) => !reservedKeys.has(cellKey(cell)))
    .map((cell) => {
      const key = cellKey(cell)
      const routeDistance = distanceByKey.get(key) ?? 99
      const entranceDistance = topology.distanceFromOpening.get(key) ?? 0

      return {
        cell,
        score:
          (routeDistance === 0 ? 8 : routeDistance === 1 ? 5 : routeDistance === 2 ? 2 : -4) +
          (entranceDistance * 0.1) +
          (random() * 0.4)
      }
    })
    .sort((left, right) => right.score - left.score)
  const reservedOrSelected = new Set(reservedKeys)
  const monsters = []

  for (const type of monsterTypes) {
    let chosen = null

    for (const candidate of candidates) {
      const key = cellKey(candidate.cell)

      if (reservedOrSelected.has(key)) {
        continue
      }

      const adjacentSelected = (topology.neighborsByKey.get(key) ?? [])
        .some((neighbor) => reservedOrSelected.has(cellKey(neighbor)) && !reservedKeys.has(cellKey(neighbor)))

      if (adjacentSelected && monsters.length + 1 < monsterTypes.length) {
        continue
      }

      chosen = candidate.cell
      break
    }

    if (!chosen) {
      chosen = takeUnreservedCell(topology.cells, reservedOrSelected, random)
    }
    if (!chosen) {
      return null
    }

    reservedOrSelected.add(cellKey(chosen))
    monsters.push({
      cell: chosen,
      ...(type === 'spider'
        ? { hand: random() < 0.5 ? 'left' : 'right' }
        : {}),
      type
    })
  }

  return monsters
}

function addFailure(frequency, reason) {
  frequency.set(reason, (frequency.get(reason) ?? 0) + 1)
}

function summarizeFailureFrequency(frequency) {
  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ count, reason }))
}

function createTimingStats() {
  return new Map()
}

function recordTiming(timings, stage, durationMs) {
  const entry = timings.get(stage) ?? {
    count: 0,
    maxMs: 0,
    totalMs: 0
  }

  entry.count += 1
  entry.maxMs = Math.max(entry.maxMs, durationMs)
  entry.totalMs += durationMs
  timings.set(stage, entry)
}

function measureTiming(timings, stage, work) {
  const startedAt = performance.now()
  const result = work()

  recordTiming(timings, stage, performance.now() - startedAt)
  return result
}

function summarizeTimingStats(timings) {
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

function mergeFailureFrequency(target, entries = []) {
  for (const entry of entries) {
    target.set(entry.reason, (target.get(entry.reason) ?? 0) + entry.count)
  }
}

function mergeTimingSummary(target, summary = {}) {
  for (const [stage, entry] of Object.entries(summary)) {
    const targetEntry = target.get(stage) ?? {
      count: 0,
      maxMs: 0,
      totalMs: 0
    }

    targetEntry.count += entry.count ?? 0
    targetEntry.maxMs = Math.max(targetEntry.maxMs, entry.maxMs ?? 0)
    targetEntry.totalMs += entry.totalMs ?? 0
    target.set(stage, targetEntry)
  }
}

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?challengeGen=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)

  return imported.default
}

function getMonsterDifficulty(monsterTypes) {
  const weights = {
    minotaur: 1.15,
    spider: 0.9,
    werewolf: 1.25
  }

  return monsterTypes.reduce((sum, type) => sum + (weights[type] ?? 1), 0)
}

function scoreParameterDifficulty({ gateCount = 0, size, swordCount = 1, monsterTypes }) {
  const cellCount = size * size
  const sizeSolvability = (size - 5) * 0.45
  const sizeTrivialityRisk = (size - 5) * 0.32
  const monsterDifficulty = getMonsterDifficulty(monsterTypes)
  const relief = (swordCount * 0.75) + (gateCount * 0.45)

  return {
    difficulty: monsterDifficulty - relief - sizeSolvability,
    nonTriviality: monsterDifficulty - relief - sizeTrivialityRisk + (cellCount >= 49 ? 0.35 : 0)
  }
}

function chooseParameterSet(index, attempt) {
  const parameterIndex = index % 6

  for (let offset = 0; offset < sizeProfileOrder.length; offset += 1) {
    const shift = Math.floor(attempt / Math.max(1, profileAttemptWindow)) + offset
    const entry = sizeProfileOrder[(parameterIndex + shift) % sizeProfileOrder.length]
    const monsterTypes = monsterProfiles[entry.profileIndex]
    const score = scoreParameterDifficulty({
      gateCount: 0,
      monsterTypes,
      size: entry.size,
      swordCount: 1
    })

    if (
      score.difficulty >= 1.25 &&
      score.difficulty <= 2.8 &&
      score.nonTriviality >= 1.8
    ) {
      return {
        ...entry,
        monsterTypes,
        score
      }
    }
  }

  const entry = sizeProfileOrder[parameterIndex % sizeProfileOrder.length]
  const monsterTypes = monsterProfiles[entry.profileIndex]
  const score = scoreParameterDifficulty({
    gateCount: 0,
    monsterTypes,
    size: entry.size,
    swordCount: 1
  })

  return {
    ...entry,
    monsterTypes,
    score
  }
}

function getPerfectResult(maze, timings, stage) {
  return measureTiming(timings, stage, () =>
    solveMazeWithPerfectInformationResult(maze, {
      maxDurationMs: maxPrefilterSolveMs,
      maxExpansions: searchPerfectExpansions
    })
  )
}

function prevalidateCandidate(maze, frequency, timings) {
  const perfectResult = getPerfectResult(maze, timings, 'prefilter.perfect')
  const perfect = perfectResult.solution

  if (!perfect) {
    addFailure(frequency, `perfect:${perfectResult.failureReason}`)
    return false
  }

  if (perfect.metrics.walkedCellRatio < 0.75) {
    addFailure(frequency, 'walked-too-few-cells')
    return false
  }
  if (perfect.metrics.seenCellRatio < 0.9) {
    addFailure(frequency, 'saw-too-few-cells')
    return false
  }
  if (perfect.metrics.postTrophyNewCellRatio < 0.25) {
    addFailure(frequency, 'post-trophy-too-few-new-cells')
    return false
  }

  const noMonsterResult = getPerfectResult({
    ...maze,
    monsters: []
  }, timings, 'prefilter.monster-free')
  const noMonster = noMonsterResult.solution

  if (!noMonster) {
    addFailure(frequency, `monster-free:${noMonsterResult.failureReason}`)
    return false
  }
  if (!(perfect.metrics.preTrophyMoveCount > noMonster.metrics.preTrophyMoveCount)) {
    addFailure(frequency, 'pre-trophy-not-slower-than-monster-free')
    return false
  }
  if (!(perfect.metrics.postTrophyMoveCount > noMonster.metrics.postTrophyMoveCount)) {
    addFailure(frequency, 'post-trophy-not-slower-than-monster-free')
    return false
  }

  const withoutSwordResult = getPerfectResult({
    ...maze,
    sword: null
  }, timings, 'prefilter.without-sword')

  if (withoutSwordResult.failureReason !== 'unsolvable') {
    addFailure(frequency, withoutSwordResult.solution ? 'sword-removal-still-solvable' : 'sword-removal-not-proven')
    return false
  }

  for (let index = 0; index < maze.monsters.length; index += 1) {
    const withoutMonsterResult = getPerfectResult({
      ...maze,
      monsters: maze.monsters.filter((_, candidateIndex) => candidateIndex !== index)
    }, timings, 'prefilter.without-monster')
    const withoutMonster = withoutMonsterResult.solution

    if (!withoutMonster) {
      addFailure(frequency, `monster-removal:${withoutMonsterResult.failureReason}`)
      return false
    }
    if (!(withoutMonster.moveCount < perfect.moveCount)) {
      addFailure(frequency, 'monster-removal-not-faster')
      return false
    }
  }

  let imperfectWins = 0
  for (let trial = 0; trial < imperfectTrialCount; trial += 1) {
    const solution = measureTiming(timings, 'prefilter.imperfect-trial', () =>
      solveMaze(maze, {
        explorationSeed: (Number(maze.seed ?? 0) + (trial * 977)) >>> 0,
        maxActionCount: 320,
        maxPlanExpansions: 500
      })
    )

    if (solution) {
      imperfectWins += 1
    }
  }

  if (imperfectWins / imperfectTrialCount < 0.8) {
    addFailure(frequency, 'imperfect-success-rate-too-low')
    return false
  }

  return true
}

function createCandidate({ attempt, index, monsterTypes, size, timings }) {
  const baseSeed = 300000 + (index * 1009) + Math.floor(attempt / Math.max(1, topologyAttemptWindow))
  const seed = baseSeed + attempt
  const random = createRandom(777 + (index * 100003) + attempt)
  const topologyKey = `${size}x${size}:${baseSeed}`
  let topology = topologyCache.get(topologyKey)

  if (!topology) {
    const base = measureTiming(timings, 'candidate.generate-base', () =>
      generateMaze(baseSeed, {
        bakeLightmap: false,
        gateCount: 0,
        height: size,
        monsterTypes,
        populateContent: false,
        width: size
      })
    )
    topology = createTopologyContext(base)
    topologyCache.set(topologyKey, topology)
  } else {
    recordTiming(timings, 'candidate.topology-cache-hit', 0)
  }
  const base = topology.maze
  const reservedKeys = new Set([cellKey(base.opening.cell)])
  const swordChoice = chooseSwordAndTrophyCells(topology, reservedKeys, random)

  if (!swordChoice) {
    return null
  }
  const { routeAnalysis, sword, trophy } = swordChoice

  reservedKeys.add(cellKey(sword))
  reservedKeys.add(cellKey(trophy))

  const cellCount = base.width * base.height
  const minimumStaticMoveRatio = base.width <= 5 ? 0.75 : base.width <= 6 ? 0.48 : 0.4
  const minimumStaticUniqueRatio = base.width <= 5 ? 0.65 : base.width <= 6 ? 0.34 : 0.28
  const minimumStaticReturnRatio = base.width <= 5 ? 0.22 : base.width <= 6 ? 0.08 : 0.05

  if (
    routeAnalysis.moveCount < Math.ceil(cellCount * minimumStaticMoveRatio) ||
    routeAnalysis.uniqueCellCount < Math.ceil(cellCount * minimumStaticUniqueRatio)
  ) {
    return { rejectedReason: 'heuristic-static-route-too-short' }
  }

  const minimumPostTrophyNewCells = Math.max(1, Math.floor(cellCount * minimumStaticReturnRatio))
  if (routeAnalysis.postTrophyNewCellCount < minimumPostTrophyNewCells) {
    return { rejectedReason: 'heuristic-static-return-overlaps-too-much' }
  }

  const monsters = chooseMonsterCells(topology, routeAnalysis, reservedKeys, monsterTypes, random)

  if (!monsters) {
    return { rejectedReason: 'candidate-construction-failed' }
  }

    return {
    ...base,
    contentProfile: {
      gateCount: 0,
      monsterTypes: [...monsterTypes]
    },
    gates: [],
    generatedByChallengeTool: true,
    monsters,
    seed,
    sword: { cell: sword },
    trophy: { cell: trophy }
  }
}

function searchChallengeCandidates({
  deadlineMs,
  endAttempt = maxAttempts,
  index,
  maxAttempts,
  startAttempt = 0,
  stride = 1
}) {
  const failureFrequency = new Map()
  const timingStats = createTimingStats()
  let attemptsChecked = 0

  for (let attempt = startAttempt; attempt < Math.min(maxAttempts, endAttempt); attempt += stride) {
    if (Date.now() > deadlineMs) {
      break
    }

    const parameters = chooseParameterSet(index, attempt)
    const { size, monsterTypes } = parameters
    const candidate = measureTiming(timingStats, 'candidate.create', () =>
      createCandidate({
        attempt,
        index,
        monsterTypes,
        size,
        timings: timingStats
      })
    )

    attemptsChecked += 1

    if (!candidate || candidate.rejectedReason) {
      addFailure(failureFrequency, candidate?.rejectedReason ?? 'candidate-construction-failed')
      continue
    }

    if (!prevalidateCandidate(candidate, failureFrequency, timingStats)) {
      continue
    }

    return {
      attemptsChecked,
      candidate,
      failureFrequency: summarizeFailureFrequency(failureFrequency),
      status: 'accepted',
      timingSummary: summarizeTimingStats(timingStats),
      winningAttempt: attempt
    }
  }

  return {
    attemptsChecked,
    candidate: null,
    failureFrequency: summarizeFailureFrequency(failureFrequency),
    status: 'exhausted',
    timingSummary: summarizeTimingStats(timingStats)
  }
}

function runWorkerSearch() {
  const result = searchChallengeCandidates(workerData)

  parentPort.postMessage(result)
}

function searchChallengeCandidatesInParallel({
  deadlineMs,
  index,
  maxAttempts
}) {
  const activeWorkerCount = Math.min(workerCount, Math.max(1, maxAttempts))

  if (activeWorkerCount <= 1) {
    return Promise.resolve(searchChallengeCandidates({
      deadlineMs,
      index,
      maxAttempts
    }))
  }

  return new Promise((resolve, reject) => {
    const workers = []
    const aggregateFailures = new Map()
    const aggregateTimings = createTimingStats()
    let attemptsChecked = 0
    let completedCount = 0
    let settled = false

    const finish = (result) => {
      if (settled) {
        return
      }

      settled = true
      for (const worker of workers) {
        worker.terminate()
      }
      resolve({
        ...result,
        attemptsChecked,
        failureFrequency: summarizeFailureFrequency(aggregateFailures),
        timingSummary: summarizeTimingStats(aggregateTimings),
        workerCount: activeWorkerCount
      })
    }

    for (let workerIndex = 0; workerIndex < activeWorkerCount; workerIndex += 1) {
      const chunkSize = Math.ceil(maxAttempts / activeWorkerCount)
      const startAttempt = workerIndex * chunkSize
      const endAttempt = Math.min(maxAttempts, startAttempt + chunkSize)
      const worker = new Worker(fileURLToPath(import.meta.url), {
        workerData: {
          deadlineMs,
          endAttempt,
          index,
          maxAttempts,
          startAttempt,
          stride: 1
        }
      })

      workers.push(worker)
      worker.on('message', (result) => {
        attemptsChecked += result.attemptsChecked ?? 0
        mergeFailureFrequency(aggregateFailures, result.failureFrequency)
        mergeTimingSummary(aggregateTimings, result.timingSummary)

        if (result.status === 'accepted' && result.candidate) {
          finish(result)
          return
        }

        completedCount += 1
        if (completedCount === activeWorkerCount) {
          finish({
            candidate: null,
            status: 'exhausted'
          })
        }
      })
      worker.on('error', (error) => {
        if (!settled) {
          settled = true
          for (const candidateWorker of workers) {
            candidateWorker.terminate()
          }
          reject(error)
        }
      })
    }
  })
}

async function main() {
  const generated = []
  const signatures = new Set()
  const structuralSignatures = new Set()
  const failureFrequency = new Map()
  const timingStats = createTimingStats()
  const startedAt = performance.now()
  const writeReport = (status, extra = {}) => {
    const report = {
      durationMs: performance.now() - startedAt,
      failureFrequency: summarizeFailureFrequency(failureFrequency),
      generated,
      status,
      targetCount,
      timingSummary: summarizeTimingStats(timingStats),
      ...extra
    }

    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    return report
  }
  const stopIfBudgetExhausted = (extra = {}) => {
    if (performance.now() - startedAt <= maxRunMs) {
      return false
    }

    writeReport('time-budget-exhausted', {
      maxRunMs,
      ...extra
    })
    console.log(`stopped after ${(maxRunMs / 1000).toFixed(1)}s generation budget`)
    return true
  }
  const maybeReportProgress = (index, attempt) => {
    if (progressInterval <= 0 || (attempt + 1) % progressInterval !== 0) {
      return
    }

    const topFailures = summarizeFailureFrequency(failureFrequency)
      .slice(0, 3)
      .map((entry) => `${entry.count}x ${entry.reason}`)
      .join('; ')
    const timingSummary = summarizeTimingStats(timingStats)
    const baseAverage = timingSummary['candidate.generate-base']?.averageMs ?? 0
    const perfectAverage = timingSummary['prefilter.perfect']?.averageMs ?? 0
    const parameters = chooseParameterSet(index, attempt)

    writeReport('running', {
      activeChallengeIndex: index + 1,
      activeAttempt: attempt + 1,
      activeParameters: {
        difficulty: parameters.score.difficulty,
        monsterTypes: parameters.monsterTypes,
        nonTriviality: parameters.score.nonTriviality,
        size: parameters.size
      }
    })
    console.log(
      `challenge-${String(index + 1).padStart(3, '0')} attempt ${attempt + 1}/${maxAttemptsPerMaze}; ` +
      `size ${parameters.size}; difficulty ${parameters.score.difficulty.toFixed(2)}; ` +
      `nontrivial ${parameters.score.nonTriviality.toFixed(2)}; ` +
      `avg generate ${baseAverage.toFixed(1)}ms; avg optimal ${perfectAverage.toFixed(1)}ms; ` +
      `top failures: ${topFailures || 'none'}`
    )
  }

  fs.mkdirSync(outputDirectory, { recursive: true })

  for (let index = 0; index < targetCount; index += 1) {
    if (stopIfBudgetExhausted({ activeChallengeIndex: index + 1 })) {
      return
    }

    const fileName = `challenge-${String(index + 1).padStart(3, '0')}.js`
    const filePath = path.join(outputDirectory, fileName)

    if (keepExistingValid && fs.existsSync(filePath)) {
      const existing = await importMazeModule(filePath)
      const trustedGenerated = trustGeneratedExisting && (
        existing.generatedByChallengeTool === true ||
        existing.description === `${existing.width}x${existing.height} no-gate monster route challenge.`
      )

      if (trustedGenerated) {
        signatures.add(getMazeSignature(existing))
        structuralSignatures.add(getStructuralSignature(existing))
        generated.push({
          attemptCount: 0,
          durationMs: 0,
          fileName,
          keptExisting: true,
          metrics: null,
          name: existing.name,
          parameterScore: scoreParameterDifficulty({
            gateCount: existing.contentProfile?.gateCount ?? 0,
            monsterTypes: existing.contentProfile?.monsterTypes ?? [],
            size: existing.width,
            swordCount: existing.sword?.cell ? 1 : 0
          }),
          profile: existing.contentProfile,
          seed: existing.seed,
          size: `${existing.width}x${existing.height}`,
          trustedGenerated: true,
          validationDurationMs: 0
        })
        console.log(`${fileName}: trusted existing generated ${existing.name}`)
        continue
      }

      const validation = measureTiming(timingStats, 'existing.validation', () =>
        validateMaze(existing, {
          requireLightmap: false,
          advancedDifficultyOptions: {
            imperfectTrialCount,
            maxImperfectActionCount: 320,
            maxImperfectPlanExpansions: 500,
            maxPerfectDurationMs: 5000,
            maxPerfectExpansions
          }
        })
      )

      if (validation.valid) {
        signatures.add(getMazeSignature(existing))
        structuralSignatures.add(getStructuralSignature(existing))
        generated.push({
          attemptCount: 0,
          durationMs: 0,
          fileName,
          keptExisting: true,
          metrics: validation.metrics,
          name: existing.name,
          parameterScore: scoreParameterDifficulty({
            gateCount: existing.contentProfile?.gateCount ?? 0,
            monsterTypes: existing.contentProfile?.monsterTypes ?? [],
            size: existing.width,
            swordCount: existing.sword?.cell ? 1 : 0
          }),
          profile: existing.contentProfile,
          seed: existing.seed,
          size: `${existing.width}x${existing.height}`,
          validationDurationMs: validation.durationMs
        })
        console.log(`${fileName}: kept existing valid ${existing.name}`)
        continue
      }

      for (const error of validation.errors) {
        addFailure(failureFrequency, `existing:${error}`)
      }
    }

    const mazeStartedAt = performance.now()
    if (stopIfBudgetExhausted({ activeChallengeIndex: index + 1 })) {
      return
    }

    const deadlineMs = Date.now() + Math.max(1, maxRunMs - (performance.now() - startedAt))
    const searchResult = await searchChallengeCandidatesInParallel({
      deadlineMs,
      index,
      maxAttempts: maxAttemptsPerMaze
    })

    mergeFailureFrequency(failureFrequency, searchResult.failureFrequency)
    mergeTimingSummary(timingStats, searchResult.timingSummary)

    if (!searchResult.candidate) {
      const exhaustedTimeBudget = Date.now() >= deadlineMs
      writeReport(
        exhaustedTimeBudget ? 'time-budget-exhausted' : 'failed',
        {
          activeChallengeIndex: index + 1,
          attemptsChecked: searchResult.attemptsChecked,
          maxAttemptsPerMaze,
          maxRunMs,
          workerCount: searchResult.workerCount ?? 1
        }
      )
      console.log(
        `${exhaustedTimeBudget ? `stopped after ${(maxRunMs / 1000).toFixed(1)}s generation budget` : 'exhausted attempt budget'}; ` +
        `checked ${searchResult.attemptsChecked} attempts across ${searchResult.workerCount ?? 1} worker(s)`
      )
      return
    }

    const candidate = searchResult.candidate
    candidate.id = path.basename(fileName, '.js')
    candidate.name = names[index] ?? `Challenge ${index + 1}`
    candidate.description = `${candidate.width}x${candidate.height} no-gate monster route challenge.`
    measureTiming(timingStats, 'candidate.finalize', () =>
      finalizeGeneratedMaze(candidate, {
        seed: candidate.seed,
        maxActionCount: 320,
        maxPlanExpansions: 500
      })
    )

    const validation = measureTiming(timingStats, 'candidate.full-validation', () =>
      validateMaze(candidate, {
        requireLightmap: false,
        advancedDifficultyOptions: {
          imperfectTrialCount,
          maxImperfectActionCount: 320,
          maxImperfectPlanExpansions: 500,
          maxPerfectDurationMs: 5000,
          maxPerfectExpansions,
          onTiming(entry) {
            recordTiming(timingStats, `full-validation.${entry.stage}`, entry.durationMs)
          }
        }
      })
    )

    if (!validation.valid) {
      for (const error of validation.errors) {
        addFailure(failureFrequency, error)
      }
      writeReport('failed', {
        failedChallengeIndex: index + 1,
        failureReason: 'full-validation-rejected-worker-candidate',
        validationErrors: validation.errors,
        workerCount: searchResult.workerCount ?? 1
      })
      throw new Error(`Worker candidate for ${fileName} failed full validation: ${validation.errors.join('; ')}`)
    }

    const signature = getMazeSignature(candidate)
    const structuralSignature = getStructuralSignature(candidate)

    if (signatures.has(signature)) {
      addFailure(failureFrequency, 'duplicate-signature')
      writeReport('failed', {
        failureReason: 'duplicate-signature',
        failedChallengeIndex: index + 1,
        workerCount: searchResult.workerCount ?? 1
      })
      throw new Error(`Worker candidate for ${fileName} duplicated an existing challenge signature`)
    }

    if (structuralSignatures.has(structuralSignature)) {
      addFailure(failureFrequency, 'duplicate-geometry')
      writeReport('failed', {
        failureReason: 'duplicate-geometry',
        failedChallengeIndex: index + 1,
        workerCount: searchResult.workerCount ?? 1
      })
      throw new Error(`Worker candidate for ${fileName} duplicated an existing challenge geometry`)
    }

    signatures.add(signature)
    structuralSignatures.add(structuralSignature)
    const accepted = {
      attemptCount: (searchResult.winningAttempt ?? 0) + 1,
      fileName,
      maze: candidate,
      metrics: validation.metrics,
      validationDurationMs: validation.durationMs,
      workerCount: searchResult.workerCount ?? 1
    }

    generated.push({
      attemptCount: accepted.attemptCount,
      durationMs: performance.now() - mazeStartedAt,
      fileName: accepted.fileName,
      metrics: accepted.metrics,
      name: accepted.maze.name,
      profile: accepted.maze.contentProfile,
      parameterScore: scoreParameterDifficulty({
        gateCount: accepted.maze.contentProfile.gateCount,
        monsterTypes: accepted.maze.contentProfile.monsterTypes,
        size: accepted.maze.width,
        swordCount: 1
      }),
      seed: accepted.maze.seed,
      size: `${accepted.maze.width}x${accepted.maze.height}`,
      validationDurationMs: accepted.validationDurationMs,
      workerCount: accepted.workerCount
    })
    fs.writeFileSync(
      path.join(outputDirectory, accepted.fileName),
      serializeMazeModule(accepted.maze)
    )
    console.log(
      `${accepted.fileName}: ${accepted.maze.name} ${accepted.maze.width}x${accepted.maze.height} ` +
      `${accepted.maze.contentProfile.monsterTypes.join('/')} seed ${accepted.maze.seed} ` +
      `attempts ${accepted.attemptCount}`
    )
  }

  const files = generated.map((entry) => entry.fileName)
  const imports = files.map((fileName, index) => `import maze${index} from './${fileName}'`).join('\n')
  const exportList = files.map((_, index) => `maze${index}`).join(', ')

  fs.writeFileSync(
    path.join(outputDirectory, 'index.js'),
    `${imports}\n\nexport const CHALLENGE_MAZES = [${exportList}]\n`
  )

  const report = writeReport('completed')
  console.log(`wrote ${path.relative(rootDir, reportPath)}`)
  for (const entry of report.failureFrequency.slice(0, 20)) {
    console.log(`${entry.count}x ${entry.reason}`)
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
} else {
  runWorkerSearch()
}
