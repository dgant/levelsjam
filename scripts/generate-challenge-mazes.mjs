import fs from 'node:fs'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import {
  isMainThread,
  parentPort,
  Worker,
  workerData
} from 'node:worker_threads'

import {
  finalizeGeneratedMaze,
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
const publicMazeDataDirectory = path.join(rootDir, 'public', 'maze-data')
const publishScriptPath = path.join(rootDir, 'scripts', 'publish-challenge-maze-playtest.cjs')
const reportPath = path.join(rootDir, 'logs', 'latest-challenge-generation-report.json')
const targetCount = Number(process.env.LEVELSJAM_CHALLENGE_TARGET_COUNT ?? '30')
const maxAttemptsPerMaze = Number(process.env.LEVELSJAM_CHALLENGE_MAX_ATTEMPTS ?? '1200')
const maxPerfectExpansions = Number(process.env.LEVELSJAM_CHALLENGE_MAX_PERFECT_EXPANSIONS ?? '50000')
const maxPerfectSolveMs = Number(process.env.LEVELSJAM_CHALLENGE_MAX_PERFECT_SOLVE_MS ?? '1500')
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

const challengePlans = [
  { gateCount: 3, height: 6, minotaur: 3, spider: 0, swordCount: 3, werewolf: 0, width: 3 },
  { gateCount: 2, height: 6, minotaur: 2, spider: 0, swordCount: 2, werewolf: 0, width: 3 },
  { gateCount: 2, height: 7, minotaur: 2, spider: 0, swordCount: 2, werewolf: 0, width: 4 },
  { gateCount: 2, height: 8, minotaur: 2, spider: 0, swordCount: 2, werewolf: 0, width: 3 },
  { gateCount: 2, height: 5, minotaur: 2, spider: 0, swordCount: 2, werewolf: 0, width: 4 },
  { gateCount: 1, height: 6, minotaur: 2, spider: 0, swordCount: 2, werewolf: 0, width: 4 },
  { gateCount: 1, height: 7, minotaur: 1, spider: 0, swordCount: 1, werewolf: 0, width: 4 },
  { gateCount: 1, height: 8, minotaur: 1, spider: 0, swordCount: 1, werewolf: 0, width: 4 },
  { gateCount: 1, height: 6, minotaur: 1, spider: 0, swordCount: 1, werewolf: 0, width: 5 },
  { gateCount: 1, height: 6, minotaur: 1, spider: 0, swordCount: 1, werewolf: 0, width: 5 },
  { gateCount: 0, height: 7, minotaur: 0, spider: 3, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 8, minotaur: 0, spider: 2, swordCount: 1, werewolf: 0, width: 5 },
  { gateCount: 0, height: 5, minotaur: 0, spider: 2, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 6, minotaur: 0, spider: 2, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 7, minotaur: 0, spider: 2, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 8, minotaur: 0, spider: 2, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 6, minotaur: 0, spider: 1, swordCount: 1, werewolf: 0, width: 7 },
  { gateCount: 0, height: 6, minotaur: 0, spider: 1, swordCount: 1, werewolf: 0, width: 7 },
  { gateCount: 0, height: 7, minotaur: 0, spider: 1, swordCount: 1, werewolf: 0, width: 8 },
  { gateCount: 0, height: 8, minotaur: 0, spider: 1, swordCount: 1, werewolf: 0, width: 7 },
  { gateCount: 0, height: 5, minotaur: 0, spider: 0, swordCount: 1, werewolf: 3, width: 8 },
  { gateCount: 0, height: 6, minotaur: 0, spider: 0, swordCount: 1, werewolf: 2, width: 8 },
  { gateCount: 0, height: 7, minotaur: 0, spider: 0, swordCount: 1, werewolf: 2, width: 8 },
  { gateCount: 0, height: 8, minotaur: 0, spider: 0, swordCount: 1, werewolf: 2, width: 8 },
  { gateCount: 0, height: 4, minotaur: 0, spider: 0, swordCount: 1, werewolf: 2, width: 6 },
  { gateCount: 0, height: 4, minotaur: 0, spider: 0, swordCount: 1, werewolf: 2, width: 7 },
  { gateCount: 0, height: 4, minotaur: 0, spider: 0, swordCount: 1, werewolf: 1, width: 8 },
  { gateCount: 0, height: 3, minotaur: 0, spider: 0, swordCount: 1, werewolf: 1, width: 8 },
  { gateCount: 0, height: 6, minotaur: 0, spider: 0, swordCount: 1, werewolf: 1, width: 7 },
  { gateCount: 0, height: 8, minotaur: 0, spider: 0, swordCount: 1, werewolf: 1, width: 8 },
  { gateCount: 0, height: 5, minotaur: 2, spider: 1, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 6, minotaur: 2, spider: 0, swordCount: 1, werewolf: 1, width: 6 },
  { gateCount: 0, height: 5, minotaur: 1, spider: 1, swordCount: 1, werewolf: 1, width: 6 },
  { gateCount: 0, height: 5, minotaur: 0, spider: 1, swordCount: 1, werewolf: 2, width: 6 },
  { gateCount: 0, height: 6, minotaur: 1, spider: 2, swordCount: 1, werewolf: 0, width: 6 },
  { gateCount: 0, height: 6, minotaur: 1, spider: 0, swordCount: 1, werewolf: 2, width: 6 }
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

const cardinalDirections = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 }
]

function shuffleInPlace(values, random) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = integerFromRandom(random, index + 1)
    const value = values[index]
    values[index] = values[swapIndex]
    values[swapIndex] = value
  }

  return values
}

function getBoundarySides(cell, width, height) {
  const sides = []

  if (cell.y === 0) sides.push('north')
  if (cell.x === width - 1) sides.push('east')
  if (cell.y === height - 1) sides.push('south')
  if (cell.x === 0) sides.push('west')

  return sides
}

function createChallengeTopology(width, height, seed) {
  const random = createRandom(seed)
  const makeCycleMaze = (cycleCells) => {
    const openEdges = cycleCells.map((cell, index) => ({
      from: { ...cell },
      to: { ...cycleCells[(index + 1) % cycleCells.length] }
    }))
    const boundaryCells = cycleCells
      .map((cell) => ({
        ...cell,
        sides: getBoundarySides(cell, width, height)
      }))
      .filter((cell) => cell.sides.length > 0)
    const openingCell = boundaryCells[integerFromRandom(random, boundaryCells.length)]

    return {
      gates: [],
      height,
      id: `generated-${seed}`,
      lights: [],
      opening: {
        cell: { x: openingCell.x, y: openingCell.y },
        side: openingCell.sides[integerFromRandom(random, openingCell.sides.length)]
      },
      openEdges,
      seed,
      width
    }
  }

  if (height % 2 === 0) {
    const cycleCells = []
    for (let y = 0; y < height; y += 1) {
      cycleCells.push({ x: 0, y })
    }
    for (let y = height - 1; y >= 1; y -= 1) {
      const offset = (height - 1) - y
      if (offset % 2 === 0) {
        for (let x = 1; x < width; x += 1) {
          cycleCells.push({ x, y })
        }
      } else {
        for (let x = width - 1; x >= 1; x -= 1) {
          cycleCells.push({ x, y })
        }
      }
    }
    for (let x = width - 1; x >= 1; x -= 1) {
      cycleCells.push({ x, y: 0 })
    }

    return makeCycleMaze(cycleCells)
  }

  if (width % 2 === 0) {
    const transposed = createChallengeTopology(height, width, seed)
    return {
      ...transposed,
      height,
      opening: {
        cell: {
          x: transposed.opening.cell.y,
          y: transposed.opening.cell.x
        },
        side: {
          east: 'south',
          north: 'west',
          south: 'east',
          west: 'north'
        }[transposed.opening.side]
      },
      openEdges: transposed.openEdges.map((edge) => ({
        from: { x: edge.from.y, y: edge.from.x },
        to: { x: edge.to.y, y: edge.to.x }
      })),
      width
    }
  }

  const start = {
    x: integerFromRandom(random, width),
    y: integerFromRandom(random, height)
  }
  const stack = [start]
  const visited = new Set([cellKey(start)])
  const openEdges = []

  while (stack.length > 0) {
    const current = stack[stack.length - 1]
    const neighbors = shuffleInPlace(
      cardinalDirections
        .map((direction) => ({
          x: current.x + direction.dx,
          y: current.y + direction.dy
        }))
        .filter((cell) => (
          cell.x >= 0 &&
          cell.y >= 0 &&
          cell.x < width &&
          cell.y < height &&
          !visited.has(cellKey(cell))
        )),
      random
    )

    if (neighbors.length === 0) {
      stack.pop()
      continue
    }

    const next = neighbors[0]
    visited.add(cellKey(next))
    openEdges.push({ from: { ...current }, to: { ...next } })
    stack.push(next)
  }

  const openEdgeKeys = new Set(openEdges.map(edgeKey))
  const extraEdgeCandidates = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (const direction of cardinalDirections.slice(0, 2)) {
        const from = { x, y }
        const to = { x: x + direction.dx, y: y + direction.dy }

        if (to.x < 0 || to.y < 0 || to.x >= width || to.y >= height) {
          continue
        }

        const candidate = { from, to }
        if (!openEdgeKeys.has(edgeKey(candidate))) {
          extraEdgeCandidates.push(candidate)
        }
      }
    }
  }

  const treeNeighbors = new Map()
  const addTreeNeighbor = (from, to) => {
    const key = cellKey(from)
    const neighbors = treeNeighbors.get(key) ?? []
    neighbors.push(to)
    treeNeighbors.set(key, neighbors)
  }
  for (const edge of openEdges) {
    addTreeNeighbor(edge.from, edge.to)
    addTreeNeighbor(edge.to, edge.from)
  }
  const getTreeDistance = (from, to) => {
    const targetKey = cellKey(to)
    const queue = [{ cell: from, distance: 0 }]
    const visited = new Set([cellKey(from)])

    for (let readIndex = 0; readIndex < queue.length; readIndex += 1) {
      const current = queue[readIndex]

      if (cellKey(current.cell) === targetKey) {
        return current.distance
      }

      for (const neighbor of treeNeighbors.get(cellKey(current.cell)) ?? []) {
        const key = cellKey(neighbor)

        if (visited.has(key)) {
          continue
        }

        visited.add(key)
        queue.push({
          cell: neighbor,
          distance: current.distance + 1
        })
      }
    }

    return 0
  }

  const extraEdgeCount = Math.max(1, Math.floor(width * height / 24))
  const scoredExtraEdges = extraEdgeCandidates
    .map((edge) => ({
      edge,
      score: getTreeDistance(edge.from, edge.to) + random()
    }))
    .sort((left, right) => right.score - left.score)

  for (const { edge } of scoredExtraEdges.slice(0, extraEdgeCount)) {
    openEdgeKeys.add(edgeKey(edge))
    openEdges.push(edge)
  }

  const boundaryCells = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sides = getBoundarySides({ x, y }, width, height)
      if (sides.length > 0) {
        boundaryCells.push({ sides, x, y })
      }
    }
  }
  const openingCell = boundaryCells[integerFromRandom(random, boundaryCells.length)]

  return {
    gates: [],
    height,
    id: `generated-${seed}`,
    lights: [],
    opening: {
      cell: { x: openingCell.x, y: openingCell.y },
      side: openingCell.sides[integerFromRandom(random, openingCell.sides.length)]
    },
    openEdges,
    seed,
    width
  }
}

function getPlanMonsterTypes(plan) {
  return [
    ...Array.from({ length: plan.minotaur }, () => 'minotaur'),
    ...Array.from({ length: plan.spider }, () => 'spider'),
    ...Array.from({ length: plan.werewolf }, () => 'werewolf')
  ]
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getPlanLabel(plan) {
  return [
    `${plan.width}x${plan.height}`,
    pluralize(plan.minotaur, 'minotaur'),
    pluralize(plan.spider, 'spider'),
    pluralize(plan.werewolf, 'wolf', 'wolves'),
    pluralize(plan.swordCount, 'sword'),
    pluralize(plan.gateCount, 'gate')
  ].join(', ')
}

function getPlanName(index, plan) {
  return `Challenge ${String(index + 1).padStart(2, '0')}: ${getPlanLabel(plan)}`
}

function getPlanDescription(plan) {
  return getPlanLabel(plan)
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

function getDistanceFromCells(topology, sourceKeys) {
  const distanceByKey = new Map()
  const queue = []

  for (const key of sourceKeys) {
    const cell = topology.cells[topology.cellIndexByKey.get(key)]
    if (cell) {
      distanceByKey.set(key, 0)
      queue.push(cell)
    }
  }

  for (let readIndex = 0; readIndex < queue.length; readIndex += 1) {
    const current = queue[readIndex]
    const distance = distanceByKey.get(cellKey(current)) ?? 0

    for (const neighbor of topology.neighborsByKey.get(cellKey(current)) ?? []) {
      const key = cellKey(neighbor)
      if (distanceByKey.has(key)) {
        continue
      }
      distanceByKey.set(key, distance + 1)
      queue.push(neighbor)
    }
  }

  return distanceByKey
}

function chooseSwordCells(topology, reservedKeys, random, swordCount, trophy) {
  const swordCells = []
  const reservedOrSelected = new Set(reservedKeys)
  const directPath = shortestPathCells(topology, topology.maze.opening.cell, trophy)
  const distanceFromDirectPath = getDistanceFromCells(topology, new Set(directPath.map(cellKey)))
  const candidatePool = topology.cells
    .filter((cell) => !reservedOrSelected.has(cellKey(cell)) && cellKey(cell) !== cellKey(trophy))
    .map((cell) => ({
      cell,
      score:
        ((distanceFromDirectPath.get(cellKey(cell)) ?? 0) * 4) +
        ((topology.distanceFromOpening.get(cellKey(cell)) ?? 0) * 0.25) +
        random()
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.cell)

  for (let index = 0; index < swordCount; index += 1) {
    const candidates = candidatePool.filter((cell) => !reservedOrSelected.has(cellKey(cell)))

    if (candidates.length === 0) {
      return null
    }

    const cell = candidates[integerFromRandom(random, Math.min(candidates.length, 6))]
    swordCells.push(cell)
    reservedOrSelected.add(cellKey(cell))
  }

  return swordCells
}

function chooseSwordAndTrophyCells(topology, reservedKeys, random, swordCount) {
  const scored = []
  const cellCount = topology.maze.width * topology.maze.height
  const trophy = chooseFarthestTrophyCell(topology, reservedKeys)

  if (!trophy) {
    return null
  }

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const swordCells = chooseSwordCells(topology, reservedKeys, random, swordCount, trophy)

    if (!swordCells) {
      continue
    }

    const swordKeys = swordCells.map(cellKey)
    if (swordKeys.includes(cellKey(trophy))) {
      continue
    }

    const routeAnalysis = getRouteAnalysis(topology, swordCells, trophy)
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
      swordCells,
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

function shortestPathCells(topology, from, to, blockedKeys = new Set()) {
  const targetKey = cellKey(to)
  const startKey = cellKey(from)

  if (blockedKeys.has(startKey) || blockedKeys.has(targetKey)) {
    return []
  }

  const queue = [from]
  const previousByKey = new Map([[startKey, null]])
  let readIndex = 0

  while (readIndex < queue.length) {
    const current = queue[readIndex]
    readIndex += 1

    if (cellKey(current) === targetKey) {
      break
    }

    for (const neighbor of topology.neighborsByKey.get(cellKey(current)) ?? []) {
      const key = cellKey(neighbor)

      if (blockedKeys.has(key) || previousByKey.has(key)) {
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

function shortestPathFavoringNovelCells(topology, from, to, visitedKeys) {
  const targetKey = cellKey(to)
  const startKey = cellKey(from)
  const costsByKey = new Map([[startKey, 0]])
  const previousByKey = new Map([[startKey, null]])
  const queue = [{ cell: from, cost: 0 }]
  let readIndex = 0

  while (readIndex < queue.length) {
    let bestIndex = readIndex
    for (let index = readIndex + 1; index < queue.length; index += 1) {
      if (queue[index].cost < queue[bestIndex].cost) {
        bestIndex = index
      }
    }

    if (bestIndex !== readIndex) {
      const current = queue[readIndex]
      queue[readIndex] = queue[bestIndex]
      queue[bestIndex] = current
    }

    const { cell: current, cost } = queue[readIndex]
    readIndex += 1
    const currentKey = cellKey(current)

    if (cost !== costsByKey.get(currentKey)) {
      continue
    }
    if (currentKey === targetKey) {
      break
    }

    for (const neighbor of topology.neighborsByKey.get(currentKey) ?? []) {
      const key = cellKey(neighbor)
      const revisitPenalty = visitedKeys.has(key) && key !== targetKey ? 8 : 0
      const nextCost = cost + 1 + revisitPenalty

      if (nextCost >= (costsByKey.get(key) ?? Infinity)) {
        continue
      }

      costsByKey.set(key, nextCost)
      previousByKey.set(key, current)
      queue.push({ cell: neighbor, cost: nextCost })
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

function getRouteAnalysis(topology, swordCells, trophy) {
  const orderedSwordCells = [...swordCells]
    .sort((left, right) => (
      (topology.distanceFromOpening.get(cellKey(left)) ?? 0) -
      (topology.distanceFromOpening.get(cellKey(right)) ?? 0)
    ))
  const toSwords = []
  let from = topology.maze.opening.cell

  for (const sword of orderedSwordCells) {
    const path = shortestPathCells(topology, from, sword)
    toSwords.push(...(toSwords.length === 0 ? path : path.slice(1)))
    from = sword
  }

  const toTrophy = shortestPathCells(topology, from, trophy)
  const preTrophyCells = [
    ...toSwords,
    ...toTrophy.slice(1)
  ]
  const preTrophyKeys = new Set(preTrophyCells.map(cellKey))
  const toExit = shortestPathFavoringNovelCells(
    topology,
    trophy,
    topology.maze.opening.cell,
    preTrophyKeys
  )
  const allRouteCells = [
    ...preTrophyCells,
    ...toExit.slice(1)
  ]
  const routeKeys = new Set(allRouteCells.map(cellKey))
  const postTrophyNewKeys = new Set(
    toExit
      .map(cellKey)
      .filter((key) => !preTrophyKeys.has(key))
  )

  return {
    allRouteCells,
    moveCount: Math.max(0, allRouteCells.length - 1),
    orderedSwordCells,
    postTrophyCells: toExit,
    postTrophyNewCellCount: postTrophyNewKeys.size,
    preTrophyCells,
    routeKeys,
    trophy,
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

function getBlockedPathPenalty(topology, from, to, basePath, blockedCell) {
  const baseDistance = Math.max(0, basePath.length - 1)
  const blockedPath = shortestPathCells(
    topology,
    from,
    to,
    new Set([cellKey(blockedCell)])
  )

  if (blockedPath.length === 0) {
    return topology.maze.width * topology.maze.height
  }

  return Math.max(0, (blockedPath.length - 1) - baseDistance)
}

function chooseMonsterCells(topology, routeAnalysis, reservedKeys, monsterTypes, random) {
  const distanceByKey = getRouteDistanceMap(topology, routeAnalysis.routeKeys)
  const directTrophyPath = shortestPathCells(
    topology,
    topology.maze.opening.cell,
    routeAnalysis.trophy
  )
  const firstSwordKey = cellKey(routeAnalysis.orderedSwordCells[0] ?? topology.maze.opening.cell)
  const firstSwordIndex = routeAnalysis.preTrophyCells.findIndex((cell) => cellKey(cell) === firstSwordKey)
  const fallbackCandidateRoutes = [
    directTrophyPath.slice(1, -1),
    routeAnalysis.preTrophyCells.slice(Math.max(0, firstSwordIndex + 1), -1),
    routeAnalysis.postTrophyCells.slice(1, -1),
    routeAnalysis.allRouteCells
  ]
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
    const selectedMonsterKeys = new Set(monsters.map((monster) => cellKey(monster.cell)))
    const targetsReturnPath = monsters.length >= 2
    const pathFrom = targetsReturnPath ? routeAnalysis.trophy : topology.maze.opening.cell
    const pathTo = targetsReturnPath ? topology.maze.opening.cell : routeAnalysis.trophy
    const priorityPath = shortestPathCells(topology, pathFrom, pathTo, selectedMonsterKeys)
    const routeIndex = targetsReturnPath ? 2 : 0
    const basePath = priorityPath.length > 0
      ? priorityPath
      : fallbackCandidateRoutes[routeIndex]
    const routeCells = basePath
      .slice(1, -1)
      .filter((cell) => !reservedOrSelected.has(cellKey(cell)))
      .map((cell) => ({
        cell,
        score:
          (
            routeIndex === 0
              ? getBlockedPathPenalty(
                topology,
                pathFrom,
                pathTo,
                basePath,
                cell
              )
              : routeIndex === 2
                ? getBlockedPathPenalty(
                  topology,
                  pathFrom,
                  pathTo,
                  basePath,
                  cell
                )
                : 0
          ) * 5 +
          ((topology.distanceFromOpening.get(cellKey(cell)) ?? 0) * 0.15) +
          random()
      }))
      .sort((left, right) => right.score - left.score)

    for (const candidate of routeCells) {
      const key = cellKey(candidate.cell)
      const adjacentSelected = (topology.neighborsByKey.get(key) ?? [])
        .some((neighbor) => reservedOrSelected.has(cellKey(neighbor)) && !reservedKeys.has(cellKey(neighbor)))

      if (adjacentSelected && monsters.length + 1 < monsterTypes.length) {
        continue
      }

      chosen = candidate.cell
      break
    }

    if (!chosen) {
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

function chooseGateEdges(topology, routeAnalysis, gateCount, random) {
  if (gateCount <= 0) {
    return []
  }

  const routeEdges = []
  for (let index = 1; index < routeAnalysis.allRouteCells.length; index += 1) {
    routeEdges.push({
      from: routeAnalysis.allRouteCells[index - 1],
      to: routeAnalysis.allRouteCells[index]
    })
  }
  const routeEdgeKeys = new Set(routeEdges.map(edgeKey))
  const candidates = [
    ...routeEdges,
    ...(topology.maze.openEdges ?? []).filter((edge) => !routeEdgeKeys.has(edgeKey(edge)))
  ]
  const chosen = []
  const chosenKeys = new Set()

  for (const edge of candidates) {
    if (chosen.length >= gateCount) {
      break
    }

    const key = edgeKey(edge)
    if (chosenKeys.has(key) || random() < 0.25) {
      continue
    }

    chosenKeys.add(key)
    chosen.push({
      from: { ...edge.from },
      id: key,
      to: { ...edge.to }
    })
  }

  for (const edge of candidates) {
    if (chosen.length >= gateCount) {
      break
    }

    const key = edgeKey(edge)
    if (chosenKeys.has(key)) {
      continue
    }

    chosenKeys.add(key)
    chosen.push({
      from: { ...edge.from },
      id: key,
      to: { ...edge.to }
    })
  }

  return chosen.length === gateCount ? chosen : null
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

function createMetricStats() {
  return new Map()
}

function recordMetric(stats, name, value) {
  if (!Number.isFinite(value)) {
    return
  }

  const entry = stats.get(name) ?? {
    count: 0,
    max: Number.NEGATIVE_INFINITY,
    min: Number.POSITIVE_INFINITY,
    total: 0
  }

  entry.count += 1
  entry.max = Math.max(entry.max, value)
  entry.min = Math.min(entry.min, value)
  entry.total += value
  stats.set(name, entry)
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

function summarizeMetricStats(stats) {
  return Object.fromEntries(
    [...stats.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entry]) => [name, {
        average: entry.count > 0 ? entry.total / entry.count : 0,
        count: entry.count,
        max: entry.max,
        min: entry.min
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

function mergeMetricSummary(target, summary = {}) {
  for (const [name, entry] of Object.entries(summary)) {
    const targetEntry = target.get(name) ?? {
      count: 0,
      max: Number.NEGATIVE_INFINITY,
      min: Number.POSITIVE_INFINITY,
      total: 0
    }

    targetEntry.count += entry.count ?? 0
    targetEntry.max = Math.max(targetEntry.max, entry.max ?? Number.NEGATIVE_INFINITY)
    targetEntry.min = Math.min(targetEntry.min, entry.min ?? Number.POSITIVE_INFINITY)
    targetEntry.total += (entry.average ?? 0) * (entry.count ?? 0)
    target.set(name, targetEntry)
  }
}

function removeExistingChallengeArtifacts() {
  for (const fileName of fs.readdirSync(outputDirectory, { withFileTypes: true })) {
    if (fileName.isFile() && /^challenge-\d{3}\.js$/.test(fileName.name)) {
      fs.unlinkSync(path.join(outputDirectory, fileName.name))
    }
  }

  if (!fs.existsSync(publicMazeDataDirectory)) {
    return
  }

  for (const entry of fs.readdirSync(publicMazeDataDirectory, { withFileTypes: true })) {
    if (!/^challenge-\d{3}(?:\.json)?$/.test(entry.name)) {
      continue
    }

    const fullPath = path.join(publicMazeDataDirectory, entry.name)
    fs.rmSync(fullPath, { force: true, recursive: entry.isDirectory() })
  }
}

function publishChallengePlaytestArtifacts() {
  execFileSync(process.execPath, [publishScriptPath], {
    cwd: rootDir,
    stdio: 'inherit'
  })
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

function scoreParameterDifficulty({ gateCount = 0, height, swordCount = 1, monsterTypes, width }) {
  const cellCount = width * height
  const size = Math.sqrt(cellCount)
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
  const shift = Math.floor(attempt / Math.max(1, profileAttemptWindow))
  const plan = challengePlans[(index + shift) % challengePlans.length]
  const monsterTypes = getPlanMonsterTypes(plan)
  const score = scoreParameterDifficulty({
    gateCount: plan.gateCount,
    height: plan.height,
    monsterTypes,
    swordCount: plan.swordCount,
    width: plan.width
  })

  return {
    ...plan,
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

function getSwordRemovalCases(maze) {
  const cases = []

  if (maze.sword?.cell) {
    cases.push({
      label: maze.sword.id ?? 'sword',
      maze: {
        ...maze,
        sword: null
      }
    })
  }

  for (const item of maze.items ?? []) {
    if (item.type !== 'sword') {
      continue
    }

    cases.push({
      label: item.id,
      maze: {
        ...maze,
        items: (maze.items ?? []).filter((candidate) => candidate.id !== item.id)
      }
    })
  }

  return cases
}

function prevalidateCandidate(maze, frequency, timings, metrics) {
  const perfectResult = getPerfectResult(maze, timings, 'prefilter.perfect')
  const perfect = perfectResult.solution

  if (!perfect) {
    addFailure(frequency, `perfect:${perfectResult.failureReason}`)
    return false
  }

  if (perfect.metrics.walkedCellRatio < 0.65) {
    addFailure(frequency, 'walked-too-few-cells')
    recordMetric(metrics, 'rejected.walkedCellRatio', perfect.metrics.walkedCellRatio)
    return false
  }
  if (perfect.metrics.seenCellRatio < 0.9) {
    addFailure(frequency, 'saw-too-few-cells')
    recordMetric(metrics, 'rejected.seenCellRatio', perfect.metrics.seenCellRatio)
    return false
  }
  if (perfect.metrics.postTrophyNewCellRatio < 0) {
    addFailure(frequency, 'post-trophy-too-few-new-cells')
    recordMetric(metrics, 'rejected.postTrophyNewCellRatio', perfect.metrics.postTrophyNewCellRatio)
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
    recordMetric(metrics, 'rejected.preTrophyMoveDelta', perfect.metrics.preTrophyMoveCount - noMonster.metrics.preTrophyMoveCount)
    return false
  }
  if (!(perfect.metrics.postTrophyMoveCount > noMonster.metrics.postTrophyMoveCount)) {
    addFailure(frequency, 'post-trophy-not-slower-than-monster-free')
    recordMetric(metrics, 'rejected.postTrophyMoveDelta', perfect.metrics.postTrophyMoveCount - noMonster.metrics.postTrophyMoveCount)
    return false
  }

  for (const removal of getSwordRemovalCases(maze)) {
    const withoutSwordResult = getPerfectResult(removal.maze, timings, 'prefilter.without-sword')

    if (withoutSwordResult.failureReason !== 'unsolvable') {
      addFailure(frequency, withoutSwordResult.solution ? 'sword-removal-still-solvable' : 'sword-removal-not-proven')
      return false
    }
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
      recordMetric(metrics, 'rejected.monsterRemovalMoveDelta', withoutMonster.moveCount - perfect.moveCount)
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
    recordMetric(metrics, 'rejected.imperfectSuccessRate', imperfectWins / imperfectTrialCount)
    return false
  }

  return true
}

function createCandidate({ attempt, gateCount, height, index, monsterTypes, swordCount, timings, width }) {
  const baseSeed = 300000 + (index * 1009) + Math.floor(attempt / Math.max(1, topologyAttemptWindow))
  const seed = baseSeed + attempt
  const random = createRandom(777 + (index * 100003) + attempt)
  const topologyKey = `${width}x${height}:${baseSeed}`
  let topology = topologyCache.get(topologyKey)

  if (!topology) {
    const base = measureTiming(timings, 'candidate.generate-base', () =>
      createChallengeTopology(width, height, baseSeed)
    )
    topology = createTopologyContext(base)
    topologyCache.set(topologyKey, topology)
  } else {
    recordTiming(timings, 'candidate.topology-cache-hit', 0)
  }
  const base = topology.maze
  const reservedKeys = new Set([cellKey(base.opening.cell)])
  const swordChoice = chooseSwordAndTrophyCells(topology, reservedKeys, random, swordCount)

  if (!swordChoice) {
    return null
  }
  const { routeAnalysis, swordCells, trophy } = swordChoice

  for (const sword of swordCells) {
    reservedKeys.add(cellKey(sword))
  }
  reservedKeys.add(cellKey(trophy))

  const cellCount = base.width * base.height
  const minimumStaticMoveRatio = cellCount <= 24 ? 0.55 : cellCount <= 36 ? 0.48 : 0.4
  const minimumStaticUniqueRatio = cellCount <= 24 ? 0.48 : cellCount <= 36 ? 0.34 : 0.28
  const minimumStaticReturnRatio = 0

  if (
    routeAnalysis.moveCount < Math.ceil(cellCount * minimumStaticMoveRatio) ||
    routeAnalysis.uniqueCellCount < Math.ceil(cellCount * minimumStaticUniqueRatio)
  ) {
    return { rejectedReason: 'heuristic-static-route-too-short' }
  }

  const minimumPostTrophyNewCells = Math.floor(cellCount * minimumStaticReturnRatio)
  if (routeAnalysis.postTrophyNewCellCount < minimumPostTrophyNewCells) {
    return { rejectedReason: 'heuristic-static-return-overlaps-too-much' }
  }

  const monsters = chooseMonsterCells(topology, routeAnalysis, reservedKeys, monsterTypes, random)

  if (!monsters) {
    return { rejectedReason: 'candidate-construction-failed' }
  }
  const gates = chooseGateEdges(topology, routeAnalysis, gateCount, random)

  if (!gates) {
    return { rejectedReason: 'candidate-gate-placement-failed' }
  }

  return {
    ...base,
    contentProfile: {
      gateCount,
      monsterTypes: [...monsterTypes],
      swordCount
    },
    gates,
    generatedByChallengeTool: true,
    items: swordCells.slice(1).map((cell, swordIndex) => ({
      cell: { ...cell },
      id: `extra-sword-${swordIndex + 1}`,
      type: 'sword'
    })),
    monsters,
    seed,
    sword: { cell: swordCells[0] },
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
  const metricStats = createMetricStats()
  const timingStats = createTimingStats()
  let attemptsChecked = 0

  for (let attempt = startAttempt; attempt < Math.min(maxAttempts, endAttempt); attempt += stride) {
    if (Date.now() > deadlineMs) {
      break
    }

    const parameters = chooseParameterSet(index, attempt)
    const { gateCount, height, monsterTypes, swordCount, width } = parameters
    const candidate = measureTiming(timingStats, 'candidate.create', () =>
      createCandidate({
        attempt,
        gateCount,
        height,
        index,
        monsterTypes,
        swordCount,
        width,
        timings: timingStats
      })
    )

    attemptsChecked += 1

    if (!candidate || candidate.rejectedReason) {
      addFailure(failureFrequency, candidate?.rejectedReason ?? 'candidate-construction-failed')
      continue
    }

    if (!prevalidateCandidate(candidate, failureFrequency, timingStats, metricStats)) {
      continue
    }

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
          maxPerfectDurationMs: maxPerfectSolveMs,
          maxPerfectExpansions
        }
      })
    )

    if (!validation.valid) {
      for (const error of validation.errors) {
        addFailure(failureFrequency, `full:${error}`)
      }
      continue
    }

    return {
      attemptsChecked,
      candidate,
      failureFrequency: summarizeFailureFrequency(failureFrequency),
      metricSummary: summarizeMetricStats(metricStats),
      metrics: validation.metrics,
      status: 'accepted',
      timingSummary: summarizeTimingStats(timingStats),
      validationDurationMs: validation.durationMs,
      winningAttempt: attempt
    }
  }

  return {
    attemptsChecked,
    candidate: null,
    failureFrequency: summarizeFailureFrequency(failureFrequency),
    metricSummary: summarizeMetricStats(metricStats),
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
    const aggregateMetrics = createMetricStats()
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
        metricSummary: summarizeMetricStats(aggregateMetrics),
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
        mergeMetricSummary(aggregateMetrics, result.metricSummary)
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
  const metricStats = createMetricStats()
  const timingStats = createTimingStats()
  const startedAt = performance.now()
  const writeReport = (status, extra = {}) => {
    const report = {
      durationMs: performance.now() - startedAt,
      failureFrequency: summarizeFailureFrequency(failureFrequency),
      generated,
      metricSummary: summarizeMetricStats(metricStats),
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
        gateCount: parameters.gateCount,
        height: parameters.height,
        monsterTypes: parameters.monsterTypes,
        nonTriviality: parameters.score.nonTriviality,
        swordCount: parameters.swordCount,
        width: parameters.width
      }
    })
    console.log(
      `challenge-${String(index + 1).padStart(3, '0')} attempt ${attempt + 1}/${maxAttemptsPerMaze}; ` +
      `size ${parameters.width}x${parameters.height}; difficulty ${parameters.score.difficulty.toFixed(2)}; ` +
      `nontrivial ${parameters.score.nonTriviality.toFixed(2)}; ` +
      `avg generate ${baseAverage.toFixed(1)}ms; avg optimal ${perfectAverage.toFixed(1)}ms; ` +
      `top failures: ${topFailures || 'none'}`
    )
  }

  fs.mkdirSync(outputDirectory, { recursive: true })
  if (!keepExistingValid && isMainThread) {
    removeExistingChallengeArtifacts()
  }

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
            height: existing.height,
            monsterTypes: existing.contentProfile?.monsterTypes ?? [],
            swordCount: existing.contentProfile?.swordCount ?? (existing.sword?.cell ? 1 : 0),
            width: existing.width
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
            maxPerfectDurationMs: maxPerfectSolveMs,
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
            height: existing.height,
            monsterTypes: existing.contentProfile?.monsterTypes ?? [],
            swordCount: existing.contentProfile?.swordCount ?? (existing.sword?.cell ? 1 : 0),
            width: existing.width
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
    mergeMetricSummary(metricStats, searchResult.metricSummary)
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
    const plan = chooseParameterSet(index, searchResult.winningAttempt ?? 0)
    candidate.name = getPlanName(index, plan)
    candidate.description = getPlanDescription(plan)
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
      metrics: searchResult.metrics,
      validationDurationMs: searchResult.validationDurationMs,
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
        height: accepted.maze.height,
        monsterTypes: accepted.maze.contentProfile.monsterTypes,
        swordCount: accepted.maze.contentProfile.swordCount,
        width: accepted.maze.width
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
    publishChallengePlaytestArtifacts()
    console.log(
      `${accepted.fileName}: ${accepted.maze.name} ${accepted.maze.width}x${accepted.maze.height} ` +
      `${accepted.maze.contentProfile.monsterTypes.join('/')} ` +
      `swords ${accepted.maze.contentProfile.swordCount} gates ${accepted.maze.contentProfile.gateCount} ` +
      `seed ${accepted.maze.seed} ` +
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
