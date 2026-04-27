import {
  AUTHORED_LIGHTING_SOURCE_SCALE,
  getHdrLightingIntensity
} from './lightingCalibration.js'
import {
  getMazeSolutionMoveBound,
  solveMaze,
  validateRecordedSolution
} from './mazeSolver.js'

export const MAZE_WIDTH = 7
export const MAZE_HEIGHT = 7
export const MAZE_CELL_SIZE = 2
export const MAZE_WALL_THICKNESS = 0.25
export const MAZE_WALL_HEIGHT = 2
export const MAZE_TARGET_COUNT = 5
export const MAZE_LIGHTMAP_VERSION = 29
export const MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS = 0.125

const MAZE_LIGHTMAP_GROUND_TILE_SIZE = 256
const MAZE_LIGHTMAP_WALL_TILE_WIDTH = 128
const MAZE_LIGHTMAP_WALL_TILE_HEIGHT = 128
const MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE = 4
const MAZE_LIGHTMAP_GROUND_MARGIN = 16
const MAZE_LIGHTMAP_SAMPLE_EPSILON = 0.02
const MAZE_LIGHTMAP_TORCH_STRENGTH = AUTHORED_LIGHTING_SOURCE_SCALE / 50
const MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID = 1
const MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID = 2
const MAZE_LIGHTMAP_SKY_RAY_DISTANCE = 24
const MAZE_REFLECTION_PROBE_Y = 1.25
const MAZE_LIGHTMAP_GROUND_BOUNCE_ALBEDO = [0.34, 0.32, 0.28]
const MAZE_LIGHTMAP_WALL_BOUNCE_ALBEDO = [0.5, 0.48, 0.43]
const MAZE_TORCH_LIGHT_COLOR = [10, 2.0863687013464577, 0]
const MAZE_SKY_LIGHT_COLOR = [
  1.4241132301976904 * getHdrLightingIntensity(AUTHORED_LIGHTING_SOURCE_SCALE),
  1.4103858565213159 * getHdrLightingIntensity(AUTHORED_LIGHTING_SOURCE_SCALE),
  1.414284307800699 * getHdrLightingIntensity(AUTHORED_LIGHTING_SOURCE_SCALE)
]
const MAZE_SKY_SAMPLE_DIRECTIONS = [
  [0, 1, 0],
  [1, 1, 0],
  [-1, 1, 0],
  [0, 1, 1],
  [0, 1, -1],
  [1, 1, 1],
  [1, 1, -1],
  [-1, 1, 1],
  [-1, 1, -1],
  [2, 1, 0],
  [-2, 1, 0],
  [0, 1, 2],
  [0, 1, -2]
].map(([x, y, z]) => {
  const length = Math.hypot(x, y, z) || 1
  return {
    x: x / length,
    y: y / length,
    z: z / length
  }
})

const CARDINAL_DIRECTIONS = [
  { dx: 0, dy: -1, side: 'north' },
  { dx: 1, dy: 0, side: 'east' },
  { dx: 0, dy: 1, side: 'south' },
  { dx: -1, dy: 0, side: 'west' }
]

const MAZE_DECAL_TEXTURE_COUNT = 7

const OPPOSITE_SIDE = {
  east: 'west',
  north: 'south',
  south: 'north',
  west: 'east'
}

const BASE_CYCLE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 1 },
  { x: 5, y: 1 },
  { x: 4, y: 1 },
  { x: 3, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 5, y: 3 },
  { x: 4, y: 3 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  { x: 6, y: 4 },
  { x: 6, y: 5 },
  { x: 6, y: 6 },
  { x: 5, y: 6 },
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 4, y: 6 },
  { x: 3, y: 6 },
  { x: 2, y: 6 },
  { x: 1, y: 6 },
  { x: 0, y: 6 },
  { x: 0, y: 5 },
  { x: 1, y: 5 },
  { x: 2, y: 5 },
  { x: 3, y: 5 },
  { x: 3, y: 4 },
  { x: 2, y: 4 },
  { x: 2, y: 3 },
  { x: 1, y: 3 },
  { x: 1, y: 4 },
  { x: 0, y: 4 },
  { x: 0, y: 3 },
  { x: 0, y: 2 },
  { x: 0, y: 1 }
]
const BASE_EAR = [
  { x: 3, y: 2 },
  { x: 3, y: 3 },
  { x: 3, y: 4 }
]
function encodeBytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  if (typeof btoa !== 'undefined') {
    const chunkSize = 0x8000
    let binary = ''

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize)
      binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
  }

  throw new Error('No base64 encoder is available in this environment')
}

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

function cellKey({ x, y }) {
  return `${x},${y}`
}

function parseCellKey(key) {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
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

function normalizeEdge(from, to) {
  const a = cellKey(from)
  const b = cellKey(to)

  if (a < b) {
    return { from, to }
  }

  return { from: to, to: from }
}

function edgeKey(from, to) {
  const normalized = normalizeEdge(from, to)
  return `${cellKey(normalized.from)}|${cellKey(normalized.to)}`
}

function getGateId(gate) {
  return gate.id ?? edgeKey(gate.from, gate.to)
}

function cloneMaze(maze) {
  return {
    ...maze,
    gates: (maze.gates ?? []).map((gate) => ({
      ...gate,
      from: { ...gate.from },
      to: { ...gate.to }
    })),
    lights: maze.lights.map((light) => ({
      cell: { ...light.cell },
      side: light.side
    })),
    monsters: (maze.monsters ?? []).map((monster) => ({
      ...monster,
      cell: { ...monster.cell }
    })),
    openEdges: maze.openEdges.map((edge) => ({
      from: { ...edge.from },
      to: { ...edge.to }
    })),
    opening: {
      cell: { ...maze.opening.cell },
      side: maze.opening.side
    },
    solution: maze.solution
      ? {
        ...maze.solution,
        actions: [...(maze.solution.actions ?? [])]
      }
      : null,
    sword: maze.sword?.cell
      ? {
        ...maze.sword,
        cell: { ...maze.sword.cell }
      }
      : maze.sword,
    trophy: maze.trophy?.cell
      ? {
        ...maze.trophy,
        cell: { ...maze.trophy.cell }
      }
      : maze.trophy
  }
}

function applyTransform(cell, transform, width, height) {
  switch (transform) {
    case 'identity':
      return { x: cell.x, y: cell.y }
    case 'rotate-90':
      return { x: height - 1 - cell.y, y: cell.x }
    case 'rotate-180':
      return { x: width - 1 - cell.x, y: height - 1 - cell.y }
    case 'rotate-270':
      return { x: cell.y, y: width - 1 - cell.x }
    case 'flip-x':
      return { x: width - 1 - cell.x, y: cell.y }
    case 'flip-y':
      return { x: cell.x, y: height - 1 - cell.y }
    case 'flip-diagonal':
      return { x: cell.y, y: cell.x }
    case 'flip-antidiagonal':
      return { x: height - 1 - cell.y, y: width - 1 - cell.x }
    default:
      throw new Error(`Unknown maze transform: ${transform}`)
  }
}

function transformSide(side, transform) {
  const byTransform = {
    identity: { north: 'north', east: 'east', south: 'south', west: 'west' },
    'rotate-90': { north: 'east', east: 'south', south: 'west', west: 'north' },
    'rotate-180': { north: 'south', east: 'west', south: 'north', west: 'east' },
    'rotate-270': { north: 'west', east: 'north', south: 'east', west: 'south' },
    'flip-x': { north: 'north', east: 'west', south: 'south', west: 'east' },
    'flip-y': { north: 'south', east: 'east', south: 'north', west: 'west' },
    'flip-diagonal': { north: 'west', east: 'south', south: 'east', west: 'north' },
    'flip-antidiagonal': { north: 'east', east: 'north', south: 'west', west: 'south' }
  }

  return byTransform[transform][side]
}

function getBoundarySides(cell, width, height) {
  const sides = []

  if (cell.y === 0) {
    sides.push('north')
  }
  if (cell.x === width - 1) {
    sides.push('east')
  }
  if (cell.y === height - 1) {
    sides.push('south')
  }
  if (cell.x === 0) {
    sides.push('west')
  }

  return sides
}

function getNeighbor(cell, side) {
  switch (side) {
    case 'north':
      return { x: cell.x, y: cell.y - 1 }
    case 'east':
      return { x: cell.x + 1, y: cell.y }
    case 'south':
      return { x: cell.x, y: cell.y + 1 }
    case 'west':
      return { x: cell.x - 1, y: cell.y }
    default:
      throw new Error(`Unknown side: ${side}`)
  }
}

function isInsideMaze(cell, width, height) {
  return (
    cell.x >= 0 &&
    cell.x < width &&
    cell.y >= 0 &&
    cell.y < height
  )
}

function buildAdjacency(maze) {
  const adjacency = new Map()

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      adjacency.set(cellKey({ x, y }), new Set())
    }
  }

  for (const edge of maze.openEdges) {
    const from = cellKey(edge.from)
    const to = cellKey(edge.to)

    adjacency.get(from).add(to)
    adjacency.get(to).add(from)
  }

  return adjacency
}

function getCellOpenEdgeCount(maze, adjacency, cell) {
  const key = cellKey(cell)
  let count = adjacency.get(key)?.size ?? 0

  if (
    maze.opening.cell.x === cell.x &&
    maze.opening.cell.y === cell.y
  ) {
    count += 1
  }

  return count
}

function shortestPathCells(adjacency, startCell, endCell) {
  const startKey = cellKey(startCell)
  const endKey = cellKey(endCell)
  const queue = [{ key: startKey, path: [startKey] }]
  const visited = new Set([startKey])

  while (queue.length > 0) {
    const current = queue.shift()

    if (current.key === endKey) {
      return current.path.map(parseCellKey)
    }

    for (const nextKey of adjacency.get(current.key) ?? []) {
      if (visited.has(nextKey)) {
        continue
      }

      visited.add(nextKey)
      queue.push({
        key: nextKey,
        path: [...current.path, nextKey]
      })
    }
  }

  return []
}

function shortestPathDistance(adjacency, startCell, endCell) {
  const path = shortestPathCells(adjacency, startCell, endCell)

  return path.length > 0
    ? path.length - 1
    : Number.POSITIVE_INFINITY
}

function listInteriorOpenEdges(maze) {
  return maze.openEdges
    .filter((edge) => (
      isInsideMaze(edge.from, maze.width, maze.height) &&
      isInsideMaze(edge.to, maze.width, maze.height)
    ))
    .map((edge) => ({
      from: { ...edge.from },
      id: edgeKey(edge.from, edge.to),
      to: { ...edge.to }
    }))
}

function chooseMazeGates(maze, random, count = 4) {
  const candidates = listInteriorOpenEdges(maze)
  const chosen = []

  while (candidates.length > 0 && chosen.length < count) {
    const candidateIndex = integerFromRandom(random, candidates.length)
    const [candidate] = candidates.splice(candidateIndex, 1)

    chosen.push(candidate)
  }

  return chosen
}

function hasClosedWallSide(maze, adjacency, cell) {
  return getClosedSides(maze, adjacency, cell).length > 0
}

function chooseMazeSwordCell(maze, random, adjacency) {
  const reserved = getReservedCellKeys(maze)
  let candidates = allCells(maze).filter(
    (cell) =>
      !reserved.has(cellKey(cell)) &&
      hasClosedWallSide(maze, adjacency, cell)
  )

  if (candidates.length === 0) {
    candidates = allCells(maze).filter((cell) => !reserved.has(cellKey(cell)))
  }

  const index = integerFromRandom(random, candidates.length)

  return candidates[index] ?? { x: 0, y: 0 }
}

function getReservedCellKeys(maze) {
  const reserved = new Set([cellKey(maze.opening.cell)])

  if (maze.sword?.cell) {
    reserved.add(cellKey(maze.sword.cell))
  }

  if (maze.trophy?.cell) {
    reserved.add(cellKey(maze.trophy.cell))
  }

  return reserved
}

function chooseMazeTrophyCell(maze, adjacency, reservedKeys) {
  let bestCell = { ...maze.opening.cell }
  let bestDistance = -1
  let foundWallHostedCell = false

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const cell = { x, y }
      const key = cellKey(cell)

      if (reservedKeys.has(key)) {
        continue
      }

      const hasClosedSide = hasClosedWallSide(maze, adjacency, cell)
      if (foundWallHostedCell && !hasClosedSide) {
        continue
      }
      if (!foundWallHostedCell && hasClosedSide) {
        foundWallHostedCell = true
        bestDistance = -1
      }

      const distance = shortestPathDistance(adjacency, maze.opening.cell, cell)

      if (distance > bestDistance) {
        bestCell = cell
        bestDistance = distance
      }
    }
  }

  return bestCell
}

function hasTwoVertexDisjointPaths(adjacency, startKey, endKey) {
  const relevantVertices = [...adjacency.keys()].filter(
    (key) => key !== startKey && key !== endKey
  )

  for (const blocked of relevantVertices) {
    const queue = [startKey]
    const visited = new Set([startKey, blocked])

    while (queue.length > 0) {
      const current = queue.shift()

      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) {
          continue
        }

        visited.add(next)
        queue.push(next)
      }
    }

    if (!visited.has(endKey)) {
      return false
    }
  }

  return true
}

function validateMazeCore(maze) {
  const errors = []

  if (!Number.isInteger(maze.width) || maze.width <= 0) {
    errors.push('Maze width must be a positive integer')
  }
  if (!Number.isInteger(maze.height) || maze.height <= 0) {
    errors.push('Maze height must be a positive integer')
  }
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const openingCell = maze.opening?.cell
  if (!openingCell || !isInsideMaze(openingCell, maze.width, maze.height)) {
    errors.push('Opening cell must be inside the maze bounds')
  } else if (
    !getBoundarySides(openingCell, maze.width, maze.height).includes(
      maze.opening.side
    )
  ) {
    errors.push('Opening side must lie on the maze exterior')
  }

  const seenEdges = new Set()
  for (const edge of maze.openEdges) {
    if (
      !isInsideMaze(edge.from, maze.width, maze.height) ||
      !isInsideMaze(edge.to, maze.width, maze.height)
    ) {
      errors.push('Open edges must connect cells inside the maze bounds')
      continue
    }

    const dx = Math.abs(edge.from.x - edge.to.x)
    const dy = Math.abs(edge.from.y - edge.to.y)
    if (dx + dy !== 1) {
      errors.push('Open edges must connect cardinally adjacent cells')
    }

    const key = edgeKey(edge.from, edge.to)
    if (seenEdges.has(key)) {
      errors.push('Open edges must be unique')
    }
    seenEdges.add(key)
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const adjacency = buildAdjacency(maze)
  const rootKey = cellKey(maze.opening.cell)
  const reachable = new Set([rootKey])
  const queue = [rootKey]

  while (queue.length > 0) {
    const current = queue.shift()
    for (const next of adjacency.get(current) ?? []) {
      if (reachable.has(next)) {
        continue
      }

      reachable.add(next)
      queue.push(next)
    }
  }

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const cell = { x, y }
      const key = cellKey(cell)

      if (!reachable.has(key)) {
        errors.push(`Cell ${key} is not reachable from the opening cell`)
      }

      if (getCellOpenEdgeCount(maze, adjacency, cell) < 2) {
        errors.push(`Cell ${key} has fewer than two open edges`)
      }

      if (key !== rootKey && !hasTwoVertexDisjointPaths(adjacency, key, rootKey)) {
        errors.push(
          `Cell ${key} does not have two internally vertex-disjoint paths to the opening cell`
        )
      }
    }
  }

  return {
    errors,
    valid: errors.length === 0
  }
}

function getClosedSides(maze, adjacency, cell) {
  const closed = []
  const exteriorOpenings = [
    maze.opening,
    ...(Array.isArray(maze.levelExits) ? maze.levelExits : []),
    ...(Array.isArray(maze.exteriorOpenings) ? maze.exteriorOpenings : [])
  ].filter(Boolean)

  for (const direction of CARDINAL_DIRECTIONS) {
    const neighbor = getNeighbor(cell, direction.side)

    if (!isInsideMaze(neighbor, maze.width, maze.height)) {
      if (exteriorOpenings.some((opening) => (
        opening.cell?.x === cell.x &&
        opening.cell?.y === cell.y &&
        opening.side === direction.side
      ))) {
        continue
      }

      closed.push(direction.side)
      continue
    }

    if (!adjacency.get(cellKey(cell))?.has(cellKey(neighbor))) {
      closed.push(direction.side)
    }
  }

  return closed
}

export function computeLightCoverage(maze, light) {
  const adjacency = buildAdjacency(maze)
  const covered = new Set([cellKey(light.cell)])

  for (const direction of CARDINAL_DIRECTIONS) {
    let current = { ...light.cell }

    while (true) {
      const neighbor = getNeighbor(current, direction.side)

      if (
        !isInsideMaze(neighbor, maze.width, maze.height) ||
        !adjacency.get(cellKey(current))?.has(cellKey(neighbor))
      ) {
        break
      }

      covered.add(cellKey(neighbor))
      current = neighbor
    }
  }

  return covered
}

function validateMazeLights(maze) {
  const errors = []
  const adjacency = buildAdjacency(maze)
  const litCells = new Set()
  const lightCellKeys = new Set()

  for (const light of maze.lights ?? []) {
    if (!isInsideMaze(light.cell, maze.width, maze.height)) {
      errors.push('Light cells must lie inside the maze bounds')
      continue
    }

    lightCellKeys.add(cellKey(light.cell))

    if (!getClosedSides(maze, adjacency, light.cell).includes(light.side)) {
      errors.push(
        `Light at ${cellKey(light.cell)} must be adjacent to a wall on side ${light.side}`
      )
      continue
    }

    for (const coveredCell of computeLightCoverage(maze, light)) {
      litCells.add(coveredCell)
    }
  }

  for (const [label, pickup] of [
    ['sword', maze.sword],
    ['trophy', maze.trophy]
  ]) {
    if (pickup?.cell && !lightCellKeys.has(cellKey(pickup.cell))) {
      errors.push(`Maze ${label} cell ${cellKey(pickup.cell)} must contain a torch light`)
    }
  }

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const key = cellKey({ x, y })

      if (!litCells.has(key)) {
        errors.push(`Cell ${key} is not covered by any light`)
      }
    }
  }

  return {
    errors,
    valid: errors.length === 0
  }
}

function hasValidMazeLightmap(maze) {
  const lightmap = maze.lightmap

  if (!lightmap || lightmap.version !== MAZE_LIGHTMAP_VERSION) {
    return false
  }

  if (
    !Number.isInteger(lightmap.atlasWidth) ||
    !Number.isInteger(lightmap.atlasHeight) ||
    typeof lightmap.dataBase64 !== 'string' ||
    !lightmap.groundRect ||
    !lightmap.groundBounds ||
    !lightmap.neutralRect ||
    !lightmap.wallRects
  ) {
    return false
  }

  const walls = getMazeWallSegments(maze)

  return walls.every((wall) => {
    const rects = lightmap.wallRects[wall.id]
    return Boolean(rects?.nx && rects?.px && (rects.nz || rects.pz))
  })
}

function hasUniqueCells(cells) {
  const seen = new Set()

  for (const cell of cells) {
    const key = cellKey(cell)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
  }

  return true
}

function validateMazeContent(maze) {
  const errors = []
  const adjacency = buildAdjacency(maze)
  const gateEdges = new Set()
  const monsterTypes = new Set((maze.monsters ?? []).map((monster) => monster.type))

  if (!Array.isArray(maze.gates) || maze.gates.length !== 4) {
    errors.push('Maze must include exactly four gates')
  } else {
    for (const gate of maze.gates) {
      if (
        !isInsideMaze(gate.from, maze.width, maze.height) ||
        !isInsideMaze(gate.to, maze.width, maze.height)
      ) {
        errors.push('Gate edges must stay inside the maze bounds')
        continue
      }

      const key = edgeKey(gate.from, gate.to)

      if (gateEdges.has(key)) {
        errors.push('Gate edges must be unique')
        continue
      }

      if (!adjacency.get(cellKey(gate.from))?.has(cellKey(gate.to))) {
        errors.push(`Gate ${key} must lie on an existing open edge`)
      }

      gateEdges.add(key)
    }
  }

  if (!maze.sword?.cell || !isInsideMaze(maze.sword.cell, maze.width, maze.height)) {
    errors.push('Maze must include a sword cell inside the maze')
  }

  if (!maze.trophy?.cell || !isInsideMaze(maze.trophy.cell, maze.width, maze.height)) {
    errors.push('Maze must include a trophy cell inside the maze')
  }

  const occupiedCells = [
    maze.opening.cell,
    ...(maze.sword?.cell ? [maze.sword.cell] : []),
    ...(maze.trophy?.cell ? [maze.trophy.cell] : []),
    ...((maze.monsters ?? []).map((monster) => monster.cell))
  ]

  if (!hasUniqueCells(occupiedCells)) {
    errors.push('Opening, items, and monsters must occupy distinct cells')
  }

  if ((maze.monsters ?? []).length !== 3) {
    errors.push('Maze must include exactly three monsters')
  }

  for (const requiredMonsterType of ['minotaur', 'werewolf', 'spider']) {
    if (!monsterTypes.has(requiredMonsterType)) {
      errors.push(`Maze must include a ${requiredMonsterType}`)
    }
  }

  return {
    errors,
    valid: errors.length === 0
  }
}

function hasValidRecordedSolution(maze) {
  const validation = validateRecordedSolution(maze)
  const moveBound = getMazeSolutionMoveBound(maze)

  return (
    validation.escaped &&
    validation.state.player.hasTrophy &&
    validation.moveCount <= moveBound
  )
}

function recordMazeSolution(maze) {
  const solution = solveMaze(maze)

  if (!solution) {
    maze.solution = null
    return false
  }

  maze.solution = {
    actions: solution.actions,
    moveCount: solution.moveCount,
    observedCellCount: solution.observedCellCount ?? null,
    visibilityLimited: solution.visibilityLimited === true
  }

  return true
}

export function validateMaze(maze, options = {}) {
  const {
    requireLightmap = true
  } = options
  const core = validateMazeCore(maze)
  if (!core.valid) {
    return core
  }

  const minimalityErrors = []
  for (let index = 0; index < maze.openEdges.length; index += 1) {
    const withoutEdge = {
      ...maze,
      openEdges: maze.openEdges.filter((_, currentIndex) => currentIndex !== index)
    }
    const revalidated = validateMazeCore(withoutEdge)

    if (revalidated.valid) {
      minimalityErrors.push(
        `Open edge ${index} can be removed without violating the maze constraints`
      )
    }
  }

  const lightValidation = validateMazeLights(maze)
  const contentValidation = validateMazeContent(maze)
  const lightmapErrors = requireLightmap && !hasValidMazeLightmap(maze)
    ? ['Maze must include a valid baked lightmap']
    : []
  const solutionErrors = hasValidRecordedSolution(maze)
    ? []
    : ['Maze must include a recorded winning solution within the move bound']

  return {
    errors: [
      ...minimalityErrors,
      ...lightValidation.errors,
      ...contentValidation.errors,
      ...lightmapErrors,
      ...solutionErrors
    ],
    valid:
      minimalityErrors.length === 0 &&
      lightValidation.valid &&
      contentValidation.valid &&
      lightmapErrors.length === 0 &&
      solutionErrors.length === 0
  }
}

function generateMazeLights(maze, random) {
  const adjacency = buildAdjacency(maze)
  const unlit = new Set()

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      unlit.add(cellKey({ x, y }))
    }
  }

  const lights = []
  const addLightForCell = (cell) => {
    const key = cellKey(cell)

    if (!unlit.has(key)) {
      return false
    }

    const closedSides = getClosedSides(maze, adjacency, cell)

    if (closedSides.length === 0) {
      return false
    }

    const side = closedSides[integerFromRandom(random, closedSides.length)]
    const light = { cell: { ...cell }, side }

    lights.push(light)
    for (const coveredCell of computeLightCoverage(maze, light)) {
      unlit.delete(coveredCell)
    }

    return true
  }

  for (const pickup of [maze.sword, maze.trophy]) {
    if (pickup?.cell) {
      addLightForCell(pickup.cell)
    }
  }

  while (unlit.size > 0) {
    const candidates = [...unlit]
      .map(parseCellKey)
      .filter((cell) => getClosedSides(maze, adjacency, cell).length > 0)

    if (candidates.length === 0) {
      break
    }

    addLightForCell(candidates[integerFromRandom(random, candidates.length)])
  }

  return lights
}

function getVisibleCellKeysFromCells(maze, cells) {
  const adjacency = buildAdjacency(maze)
  const visible = new Set()

  for (const cell of cells) {
    visible.add(cellKey(cell))

    for (const { side: direction } of CARDINAL_DIRECTIONS) {
      let current = { ...cell }

      while (true) {
        const next = getNeighbor(current, direction)

        if (!adjacency.get(cellKey(current))?.has(cellKey(next))) {
          break
        }

        visible.add(cellKey(next))
        current = next
      }
    }
  }

  return visible
}

function getSolutionRouteCells(maze, adjacency) {
  const route = []
  const appendPath = (path) => {
    for (const cell of path) {
      if (
        route.length === 0 ||
        cellKey(route[route.length - 1]) !== cellKey(cell)
      ) {
        route.push(cell)
      }
    }
  }

  if (maze.sword?.cell) {
    appendPath(shortestPathCells(adjacency, maze.opening.cell, maze.sword.cell))
  }

  if (maze.sword?.cell && maze.trophy?.cell) {
    appendPath(shortestPathCells(adjacency, maze.sword.cell, maze.trophy.cell))
  } else if (maze.trophy?.cell) {
    appendPath(shortestPathCells(adjacency, maze.opening.cell, maze.trophy.cell))
  }

  if (maze.trophy?.cell) {
    appendPath(shortestPathCells(adjacency, maze.trophy.cell, maze.opening.cell))
  }

  return route
}

function generateMazeMonsters(maze, random, protectedCellKeys = new Set()) {
  const reserved = getReservedCellKeys(maze)
  const allCandidateCells = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const cell = { x, y }

      if (!reserved.has(cellKey(cell))) {
        allCandidateCells.push(cell)
      }
    }
  }

  let cells = allCandidateCells.filter((cell) => !protectedCellKeys.has(cellKey(cell)))

  if (cells.length < 3) {
    cells = allCandidateCells
  }

  const takeCell = () => {
    const index = integerFromRandom(random, cells.length)
    const [cell] = cells.splice(index, 1)

    reserved.add(cellKey(cell))
    return cell
  }

  return [
    { cell: takeCell(), type: 'minotaur' },
    { cell: takeCell(), type: 'werewolf' },
    {
      cell: takeCell(),
      hand: random() < 0.5 ? 'left' : 'right',
      type: 'spider'
    }
  ]
}

export function generateMaze(seed = Date.now(), options = {}) {
  const {
    bakeLightmap = true
  } = options
  const startTime = performance.now()
  const random = createRandom(seed)
  const transforms = [
    'identity',
    'rotate-90',
    'rotate-180',
    'rotate-270',
    'flip-x',
    'flip-y',
    'flip-diagonal',
    'flip-antidiagonal'
  ]
  const transform = transforms[integerFromRandom(random, transforms.length)]
  const transformedCycle = BASE_CYCLE.map((cell) =>
    applyTransform(cell, transform, MAZE_WIDTH, MAZE_HEIGHT)
  )
  const transformedEar = BASE_EAR.map((cell) =>
    applyTransform(cell, transform, MAZE_WIDTH, MAZE_HEIGHT)
  )
  const boundaryCells = transformedCycle.filter((cell) =>
    getBoundarySides(cell, MAZE_WIDTH, MAZE_HEIGHT).length > 0
  )
  const openingCell =
    boundaryCells[integerFromRandom(random, boundaryCells.length)]
  const boundarySides = getBoundarySides(openingCell, MAZE_WIDTH, MAZE_HEIGHT)
  const openingSide =
    boundarySides[integerFromRandom(random, boundarySides.length)]
  const openEdges = transformedCycle.map((cell, index) => {
    const next = transformedCycle[(index + 1) % transformedCycle.length]
    return normalizeEdge(cell, next)
  })
  openEdges.push(
    normalizeEdge(transformedEar[0], transformedEar[1]),
    normalizeEdge(transformedEar[1], transformedEar[2])
  )
  const maze = {
    gates: [],
    height: MAZE_HEIGHT,
    id: `generated-${seed}`,
    lights: [],
    opening: {
      cell: openingCell,
      side: openingSide
    },
    openEdges,
    seed,
    width: MAZE_WIDTH
  }
  const adjacency = buildAdjacency(maze)

  maze.gates = chooseMazeGates(maze, random)
  maze.sword = {
    cell: chooseMazeSwordCell(maze, random, adjacency)
  }
  maze.trophy = {
    cell: chooseMazeTrophyCell(
      maze,
      adjacency,
      new Set([cellKey(maze.opening.cell), cellKey(maze.sword.cell)])
    )
  }

  maze.lights = generateMazeLights(maze, random)
  maze.monsters = generateMazeMonsters(
    maze,
    random,
    getVisibleCellKeysFromCells(
      maze,
      getSolutionRouteCells(maze, adjacency)
    )
  )
  maze.visibility = computeMazeCellVisibility(maze)
  maze.generationMs = performance.now() - startTime
  recordMazeSolution(maze)
  if (bakeLightmap) {
    throw new Error(
      'generateMaze no longer performs synchronous lightmap baking; call bakeMazeLightmap(maze) from async tooling after generation'
    )
  }
  maze.totalGenerationMs = performance.now() - startTime

  return maze
}

export function getMazeSignature(maze) {
  const edges = maze.openEdges
    .map((edge) => edgeKey(edge.from, edge.to))
    .sort()
    .join(',')
  const lights = (maze.lights ?? [])
    .map((light) => `${cellKey(light.cell)}:${light.side}`)
    .sort()
    .join(',')
  const gates = (maze.gates ?? [])
    .map((gate) => edgeKey(gate.from, gate.to))
    .sort()
    .join(',')
  const monsters = (maze.monsters ?? [])
    .map((monster) => `${monster.type}:${cellKey(monster.cell)}:${monster.hand ?? ''}`)
    .sort()
    .join(',')

  return [
    maze.width,
    maze.height,
    cellKey(maze.opening.cell),
    maze.opening.side,
    edges,
    gates,
    lights,
    monsters,
    maze.sword?.cell ? cellKey(maze.sword.cell) : '',
    maze.trophy?.cell ? cellKey(maze.trophy.cell) : ''
  ].join('|')
}

export function serializeMazeModule(maze) {
  return `export default ${JSON.stringify(maze, null, 2)}\n`
}

function getCellCenter(maze, cell) {
  const originX = -((maze.width * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2)
  const originZ = -((maze.height * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2)

  return {
    x: originX + (cell.x * MAZE_CELL_SIZE),
    z: originZ + (cell.y * MAZE_CELL_SIZE)
  }
}

function getWallDescriptorFromCellSide(maze, cell, side) {
  const center = getCellCenter(maze, cell)

  switch (side) {
    case 'north':
      return {
        axis: 'x',
        center: {
          x: center.x,
          z: center.z - (MAZE_CELL_SIZE / 2)
        },
        normal: { x: 0, z: 1 }
      }
    case 'south':
      return {
        axis: 'x',
        center: {
          x: center.x,
          z: center.z + (MAZE_CELL_SIZE / 2)
        },
        normal: { x: 0, z: -1 }
      }
    case 'east':
      return {
        axis: 'z',
        center: {
          x: center.x + (MAZE_CELL_SIZE / 2),
          z: center.z
        },
        normal: { x: -1, z: 0 }
      }
    case 'west':
      return {
        axis: 'z',
        center: {
          x: center.x - (MAZE_CELL_SIZE / 2),
          z: center.z
        },
        normal: { x: 1, z: 0 }
      }
    default:
      throw new Error(`Unknown wall side: ${side}`)
  }
}

export function getMazeWallSegments(maze) {
  const adjacency = buildAdjacency(maze)
  const seen = new Set()
  const walls = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const cell = { x, y }

      for (const side of getClosedSides(maze, adjacency, cell)) {
        const neighbor = getNeighbor(cell, side)
        const descriptor = getWallDescriptorFromCellSide(maze, cell, side)
        const uniqueKey = isInsideMaze(neighbor, maze.width, maze.height)
          ? edgeKey(cell, neighbor)
          : `${cellKey(cell)}:${side}:exterior`

        if (seen.has(uniqueKey)) {
          continue
        }
        seen.add(uniqueKey)

        const halfLength = descriptor.axis === 'x'
          ? MAZE_CELL_SIZE / 2
          : MAZE_WALL_THICKNESS / 2
        const halfWidth = descriptor.axis === 'x'
          ? MAZE_WALL_THICKNESS / 2
          : MAZE_CELL_SIZE / 2

        walls.push({
          axis: descriptor.axis,
          bounds: {
            id: uniqueKey,
            maxX: descriptor.center.x + halfLength,
            maxY: GROUND_Y + MAZE_WALL_HEIGHT,
            maxZ: descriptor.center.z + halfWidth,
            minX: descriptor.center.x - halfLength,
            minY: GROUND_Y,
            minZ: descriptor.center.z - halfWidth
          },
          center: descriptor.center,
          id: uniqueKey,
          yaw: descriptor.axis === 'x' ? 0 : Math.PI / 2
        })
      }
    }
  }

  assignWallSurfaceGroups(walls)
  return walls
}

function getVisibilitySamplePoints(maze, cell) {
  const center = getCellCenter(maze, cell)
  const inset = (MAZE_CELL_SIZE / 2) - 0.08

  return [
    center,
    { x: center.x - inset, z: center.z - inset },
    { x: center.x + inset, z: center.z - inset },
    { x: center.x - inset, z: center.z + inset },
    { x: center.x + inset, z: center.z + inset }
  ]
}

function wallToVisibilitySegment(wall) {
  if (wall.axis === 'x') {
    return {
      a: { x: wall.bounds.minX, z: wall.center.z },
      b: { x: wall.bounds.maxX, z: wall.center.z }
    }
  }

  return {
    a: { x: wall.center.x, z: wall.bounds.minZ },
    b: { x: wall.center.x, z: wall.bounds.maxZ }
  }
}

function orientation2d(a, b, c) {
  return ((b.z - a.z) * (c.x - b.x)) - ((b.x - a.x) * (c.z - b.z))
}

function pointOnSegment2d(a, b, c) {
  const epsilon = 1e-8

  return (
    Math.min(a.x, c.x) - epsilon <= b.x &&
    b.x <= Math.max(a.x, c.x) + epsilon &&
    Math.min(a.z, c.z) - epsilon <= b.z &&
    b.z <= Math.max(a.z, c.z) + epsilon
  )
}

function segmentsIntersect2d(a, b, c, d) {
  const epsilon = 1e-8
  const o1 = orientation2d(a, b, c)
  const o2 = orientation2d(a, b, d)
  const o3 = orientation2d(c, d, a)
  const o4 = orientation2d(c, d, b)

  if (
    ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon)) &&
    ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))
  ) {
    return true
  }

  return (
    (Math.abs(o1) <= epsilon && pointOnSegment2d(a, c, b)) ||
    (Math.abs(o2) <= epsilon && pointOnSegment2d(a, d, b)) ||
    (Math.abs(o3) <= epsilon && pointOnSegment2d(c, a, d)) ||
    (Math.abs(o4) <= epsilon && pointOnSegment2d(c, b, d))
  )
}

function hasClearVisibilitySegment(source, target, wallSegments) {
  for (const wall of wallSegments) {
    if (segmentsIntersect2d(source, target, wall.a, wall.b)) {
      return false
    }
  }

  return true
}

export function computeMazeCellVisibility(maze) {
  const cells = allCells(maze)
  const samplePoints = new Map(
    cells.map((cell) => [cellKey(cell), getVisibilitySamplePoints(maze, cell)])
  )
  const wallSegments = getMazeWallSegments(maze).map(wallToVisibilitySegment)
  const visibilityCells = {}

  for (const sourceCell of cells) {
    const sourceKey = cellKey(sourceCell)
    const sourceSamples = samplePoints.get(sourceKey) ?? []
    const visible = []

    for (const targetCell of cells) {
      const targetKey = cellKey(targetCell)

      if (sourceKey === targetKey) {
        visible.push(targetKey)
        continue
      }

      const targetSamples = samplePoints.get(targetKey) ?? []
      let canSee = false

      for (const sourceSample of sourceSamples) {
        for (const targetSample of targetSamples) {
          if (hasClearVisibilitySegment(sourceSample, targetSample, wallSegments)) {
            canSee = true
            break
          }
        }

        if (canSee) {
          break
        }
      }

      if (canSee) {
        visible.push(targetKey)
      }
    }

    visibilityCells[sourceKey] = visible.sort()
  }

  return {
    cells: visibilityCells,
    version: 1
  }
}

function getWallEndpointCoordinates(wall) {
  if (wall.axis === 'x') {
    return [
      { x: wall.bounds.minX, z: wall.center.z },
      { x: wall.bounds.maxX, z: wall.center.z }
    ]
  }

  return [
    { x: wall.center.x, z: wall.bounds.minZ },
    { x: wall.center.x, z: wall.bounds.maxZ }
  ]
}

function wallIntersectionKey(point) {
  return `${point.x.toFixed(6)},${point.z.toFixed(6)}`
}

function getWallEndpointDirectionFromIntersection(point, wall) {
  const dx = wall.center.x - point.x
  const dz = wall.center.z - point.z
  const length = Math.hypot(dx, dz) || 1

  return {
    x: Math.round(dx / length),
    z: Math.round(dz / length)
  }
}

export function getMazeCornerFillers(maze) {
  const endpointMap = new Map()
  const walls = getMazeWallSegments(maze)

  for (const wall of walls) {
    for (const point of getWallEndpointCoordinates(wall)) {
      const key = wallIntersectionKey(point)
      const entries = endpointMap.get(key) ?? []

      entries.push({ point, wall })
      endpointMap.set(key, entries)
    }
  }

  const fillers = []

  for (const [key, entries] of endpointMap) {
    if (entries.length !== 2) {
      continue
    }

    const [first, second] = entries

    if (!first || !second || first.wall.axis === second.wall.axis) {
      continue
    }

    const firstDirection = getWallEndpointDirectionFromIntersection(
      first.point,
      first.wall
    )
    const secondDirection = getWallEndpointDirectionFromIntersection(
      second.point,
      second.wall
    )
    const fillerSize = MAZE_WALL_THICKNESS / 2
    const halfFillerSize = fillerSize / 2
    const center = {
      x: first.point.x - ((firstDirection.x + secondDirection.x) * halfFillerSize),
      z: first.point.z - ((firstDirection.z + secondDirection.z) * halfFillerSize)
    }

    fillers.push({
      bounds: {
        id: `corner-filler-${key}`,
        maxX: center.x + halfFillerSize,
        maxY: GROUND_Y + MAZE_WALL_HEIGHT,
        maxZ: center.z + halfFillerSize,
        minX: center.x - halfFillerSize,
        minY: GROUND_Y,
        minZ: center.z - halfFillerSize
      },
      center,
      id: `corner-filler-${key}`,
      type: 'corner-filler'
    })
  }

  return fillers
}

function assignWallSurfaceGroups(walls) {
  const wallLines = new Map()

  for (const wall of walls) {
    const lineKey = wall.axis === 'x'
      ? `x:${wall.center.z.toFixed(6)}`
      : `z:${wall.center.x.toFixed(6)}`
    const alongCoordinate = wall.axis === 'x'
      ? wall.center.x
      : wall.center.z
    const lineWalls = wallLines.get(lineKey) ?? []

    lineWalls.push({ alongCoordinate, wall })
    wallLines.set(lineKey, lineWalls)
  }

  for (const [lineKey, lineWalls] of wallLines) {
    lineWalls.sort((a, b) => a.alongCoordinate - b.alongCoordinate)
    let groupIndex = -1
    let previousAlongCoordinate = null

    for (const entry of lineWalls) {
      if (
        previousAlongCoordinate === null ||
        Math.abs(entry.alongCoordinate - previousAlongCoordinate - MAZE_CELL_SIZE) > 1e-6
      ) {
        groupIndex += 1
      }

      entry.wall.surfaceGroupId = `${lineKey}:${groupIndex}`
      previousAlongCoordinate = entry.alongCoordinate
    }
  }
}

function getWallSurfaceGroups(walls) {
  const groups = new Map()

  for (const wall of walls) {
    const id = wall.surfaceGroupId

    if (!id) {
      continue
    }

    const group = groups.get(id) ?? {
      axis: wall.axis,
      id,
      walls: [],
      yaw: wall.yaw
    }

    group.walls.push(wall)
    groups.set(id, group)
  }

  return Array.from(groups.values()).map((group) => {
    const getLocalAlongCoordinate = (wall) =>
      (wall.center.x * Math.cos(group.yaw)) -
      (wall.center.z * Math.sin(group.yaw))
    const walls = group.walls.slice().sort((a, b) => {
      const aAlong = getLocalAlongCoordinate(a)
      const bAlong = getLocalAlongCoordinate(b)

      return aAlong - bAlong
    })
    const center = walls.reduce(
      (accumulator, wall) => ({
        x: accumulator.x + wall.center.x,
        z: accumulator.z + wall.center.z
      }),
      { x: 0, z: 0 }
    )

    center.x /= walls.length
    center.z /= walls.length

    for (let index = 0; index < walls.length; index += 1) {
      walls[index].surfaceGroupMemberIndex = index
      walls[index].surfaceGroupMemberCount = walls.length
    }

    return {
      axis: group.axis,
      center,
      id: group.id,
      length: walls.length * MAZE_CELL_SIZE,
      walls,
      yaw: group.yaw
    }
  })
}

function getExteriorWallSide(wall) {
  const match = String(wall.id).match(/:(north|east|south|west):exterior$/)
  return match ? match[1] : null
}

function getOuterLongWallFaceKey(wall) {
  switch (getExteriorWallSide(wall)) {
    case 'north':
    case 'west':
      return 'nz'
    case 'south':
    case 'east':
      return 'pz'
    default:
      return null
  }
}

function shouldLightmapWallLongFace(wall, faceKey) {
  return getOuterLongWallFaceKey(wall) !== faceKey
}

function allocateLightmapRect(state, width, height) {
  if (state.cursorX + width > state.atlasWidth) {
    state.cursorX = 0
    state.cursorY += state.rowHeight
    state.rowHeight = 0
  }

  const rect = {
    height,
    width,
    x: state.cursorX,
    y: state.cursorY
  }

  state.cursorX += width
  state.rowHeight = Math.max(state.rowHeight, height)

  return rect
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)))
}

function getPreferredLightmapAtlasWidth(wallCount) {
  const totalTexelCount =
    (MAZE_LIGHTMAP_GROUND_TILE_SIZE * MAZE_LIGHTMAP_GROUND_TILE_SIZE) +
    (MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE * MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE) +
    (
      wallCount *
      (
        (2 * MAZE_LIGHTMAP_WALL_TILE_WIDTH * MAZE_LIGHTMAP_WALL_TILE_HEIGHT) +
        (2 * MAZE_LIGHTMAP_WALL_TILE_HEIGHT * MAZE_LIGHTMAP_WALL_TILE_HEIGHT)
      )
    )

  return Math.max(
    MAZE_LIGHTMAP_GROUND_TILE_SIZE,
    nextPowerOfTwo(Math.ceil(Math.sqrt(totalTexelCount)))
  )
}

function getLightmapAtlasHeight(state) {
  const requiredHeight = state.cursorY + state.rowHeight
  return Math.max(
    1,
    2 ** Math.ceil(Math.log2(Math.max(requiredHeight, 1)))
  )
}

function rotateWallLocalVector(localX, localZ, yaw) {
  const cosine = Math.cos(yaw)
  const sine = Math.sin(yaw)

  return {
    x: (localX * cosine) + (localZ * sine),
    z: (-localX * sine) + (localZ * cosine)
  }
}

function getWallFaceSample(wall, faceKey, u, v) {
  const localY = (v - 0.5) * MAZE_WALL_HEIGHT
  let localX = 0
  let localZ = 0
  let normalX = 0
  let normalZ = 0

  switch (faceKey) {
    case 'pz':
      localX = (u - 0.5) * MAZE_CELL_SIZE
      localZ = MAZE_WALL_THICKNESS / 2
      normalZ = 1
      break
    case 'nz':
      localX = (u - 0.5) * MAZE_CELL_SIZE
      localZ = -(MAZE_WALL_THICKNESS / 2)
      normalZ = -1
      break
    default:
      throw new Error(`Unsupported wall face key: ${faceKey}`)
  }

  const rotatedPosition = rotateWallLocalVector(localX, localZ, wall.yaw)
  const rotatedNormal = rotateWallLocalVector(normalX, normalZ, wall.yaw)

  return {
    normal: {
      x: rotatedNormal.x,
      y: 0,
      z: rotatedNormal.z
    },
    position: {
      x: wall.center.x + rotatedPosition.x,
      y: GROUND_Y + (MAZE_WALL_HEIGHT / 2) + localY,
      z: wall.center.z + rotatedPosition.z
    }
  }
}

export function getMazeFloorLightmapBounds(
  maze,
  margin = MAZE_LIGHTMAP_GROUND_MARGIN
) {
  const width = (maze.width * MAZE_CELL_SIZE) + (margin * 2)
  const depth = (maze.height * MAZE_CELL_SIZE) + (margin * 2)

  return {
    centerX: 0,
    centerZ: 0,
    depth,
    height: depth,
    margin,
    maxX: width / 2,
    maxZ: depth / 2,
    minX: -(width / 2),
    minZ: -(depth / 2),
    width
  }
}

function segmentIntersectsBounds(start, end, bounds) {
  const direction = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  }
  let entry = 0
  let exit = 1

  for (const axis of ['x', 'y', 'z']) {
    const origin = start[axis]
    const delta = direction[axis]
    const minKey = `min${axis.toUpperCase()}`
    const maxKey = `max${axis.toUpperCase()}`
    const min = bounds[minKey]
    const max = bounds[maxKey]

    if (Math.abs(delta) < 1e-6) {
      if (origin < min || origin > max) {
        return false
      }
      continue
    }

    let near = (min - origin) / delta
    let far = (max - origin) / delta

    if (near > far) {
      ;[near, far] = [far, near]
    }

    entry = Math.max(entry, near)
    exit = Math.min(exit, far)

    if (entry > exit) {
      return false
    }
  }

  return exit > 0 && entry < 1
}

function isTorchOccluded(
  samplePosition,
  torchPosition,
  walls,
  skipWallId,
  skipSurfaceGroupId
) {
  const segmentMinX = Math.min(samplePosition.x, torchPosition.x)
  const segmentMaxX = Math.max(samplePosition.x, torchPosition.x)
  const segmentMinY = Math.min(samplePosition.y, torchPosition.y)
  const segmentMaxY = Math.max(samplePosition.y, torchPosition.y)
  const segmentMinZ = Math.min(samplePosition.z, torchPosition.z)
  const segmentMaxZ = Math.max(samplePosition.z, torchPosition.z)

  for (const wall of walls) {
    if (
      wall.id === skipWallId ||
      wall.surfaceGroupId === skipSurfaceGroupId
    ) {
      continue
    }

    if (
      wall.bounds.maxX < segmentMinX ||
      wall.bounds.minX > segmentMaxX ||
      wall.bounds.maxY < segmentMinY ||
      wall.bounds.minY > segmentMaxY ||
      wall.bounds.maxZ < segmentMinZ ||
      wall.bounds.minZ > segmentMaxZ
    ) {
      continue
    }

    if (segmentIntersectsBounds(samplePosition, torchPosition, wall.bounds)) {
      return true
    }
  }

  return false
}

function isSkyOccluded(
  samplePosition,
  direction,
  walls,
  skipWallId,
  skipSurfaceGroupId
) {
  const rayEnd = {
    x: samplePosition.x + (direction.x * MAZE_LIGHTMAP_SKY_RAY_DISTANCE),
    y: samplePosition.y + (direction.y * MAZE_LIGHTMAP_SKY_RAY_DISTANCE),
    z: samplePosition.z + (direction.z * MAZE_LIGHTMAP_SKY_RAY_DISTANCE)
  }

  return isTorchOccluded(
    samplePosition,
    rayEnd,
    walls,
    skipWallId,
    skipSurfaceGroupId
  )
}

const PROBE_SH_BASIS_WEIGHTS = [
  () => 0.282095,
  (direction) => 0.488603 * direction.x,
  (direction) => 0.488603 * direction.y,
  (direction) => 0.488603 * direction.z
]

function addIsotropicProbeRadiance(coefficients, color) {
  for (let channel = 0; channel < 3; channel += 1) {
    coefficients[0][channel] += color[channel] * PROBE_SH_BASIS_WEIGHTS[0]()
  }
}

function addDirectionalProbeRadiance(coefficients, direction, color) {
  const scale = 0.25

  for (let basisIndex = 0; basisIndex < PROBE_SH_BASIS_WEIGHTS.length; basisIndex += 1) {
    const basis = PROBE_SH_BASIS_WEIGHTS[basisIndex](direction) * scale

    coefficients[basisIndex][0] += color[0] * basis
    coefficients[basisIndex][1] += color[1] * basis
    coefficients[basisIndex][2] += color[2] * basis
  }
}

function sampleProbeSkylightVisibility(samplePosition, walls) {
  let visibleCount = 0

  for (const direction of MAZE_SKY_SAMPLE_DIRECTIONS) {
    if (!isSkyOccluded(samplePosition, direction, walls, null, null)) {
      visibleCount += 1
    }
  }

  return visibleCount / MAZE_SKY_SAMPLE_DIRECTIONS.length
}

export function computeMazeVolumetricLightmapCoefficients(
  maze,
  probePosition,
  sconceRadius = MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS
) {
  const walls = getMazeWallSegments(maze)
  const torchPlacements = getMazeTorchPlacements(maze, sconceRadius)
  const coefficients = PROBE_SH_BASIS_WEIGHTS.map(() => [0, 0, 0])
  const skylightVisibility = sampleProbeSkylightVisibility(probePosition, walls)

  addIsotropicProbeRadiance(
    coefficients,
    MAZE_SKY_LIGHT_COLOR.map((component) => component * skylightVisibility)
  )

  for (const torch of torchPlacements) {
    const toTorchX = torch.torchPosition.x - probePosition.x
    const toTorchY = torch.torchPosition.y - probePosition.y
    const toTorchZ = torch.torchPosition.z - probePosition.z
    const distance = Math.hypot(toTorchX, toTorchY, toTorchZ)

    if (distance <= 1e-6) {
      continue
    }

    if (
      isTorchOccluded(
        probePosition,
        torch.torchPosition,
        walls,
        null,
        null
      )
    ) {
      continue
    }

    const sourceRadius = Math.max(sconceRadius, 0.01)
    const falloff = 1 / Math.max(distance * distance, sourceRadius * sourceRadius)
    const strength = falloff * MAZE_LIGHTMAP_TORCH_STRENGTH
    const direction = {
      x: toTorchX / distance,
      y: toTorchY / distance,
      z: toTorchZ / distance
    }
    const color = [
      MAZE_TORCH_LIGHT_COLOR[0] * strength,
      MAZE_TORCH_LIGHT_COLOR[1] * strength,
      MAZE_TORCH_LIGHT_COLOR[2] * strength
    ]

    addDirectionalProbeRadiance(coefficients, direction, color)
  }

  return coefficients
}

export async function bakeMazeLightmap(
  maze,
  sconceRadius = MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS,
  options = {}
) {
  const bakeStart = performance.now()
  const walls = getMazeWallSegments(maze)
  const surfaceGroups = getWallSurfaceGroups(walls)
  const torchPlacements = getMazeTorchPlacements(maze, sconceRadius)
  const groundBounds = getMazeFloorLightmapBounds(maze)
  const atlasWidth = getPreferredLightmapAtlasWidth(walls.length)
  const packer = {
    atlasWidth,
    cursorX: 0,
    cursorY: 0,
    rowHeight: 0
  }
  const groundRect = allocateLightmapRect(
    packer,
    MAZE_LIGHTMAP_GROUND_TILE_SIZE,
    MAZE_LIGHTMAP_GROUND_TILE_SIZE
  )
  const neutralRect = allocateLightmapRect(
    packer,
    MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE,
    MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE
  )
  const wallRects = {}
  const surfaceGroupRects = {}
  const surfaces = [{
    alignUToRectEdges: false,
    rect: groundRect,
    surfaceA: [
      groundBounds.minX,
      groundBounds.minZ,
      groundBounds.width,
      groundBounds.depth
    ],
    surfaceB: [0, 0, 0, 0],
    supersampleGrid: MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID,
    type: 0
  }]

  for (const surfaceGroup of surfaceGroups) {
    const groupWidth = surfaceGroup.walls.length === 1
      ? MAZE_LIGHTMAP_WALL_TILE_WIDTH
      : (surfaceGroup.walls.length * (MAZE_LIGHTMAP_WALL_TILE_WIDTH - 1)) + 1
    const groupRects = {}

    for (const faceKey of ['nz', 'pz']) {
      if (
        surfaceGroup.walls.some((wall) =>
          shouldLightmapWallLongFace(wall, faceKey)
        )
      ) {
        groupRects[faceKey] = allocateLightmapRect(
          packer,
          groupWidth,
          MAZE_LIGHTMAP_WALL_TILE_HEIGHT
        )
      }
    }

    surfaceGroupRects[surfaceGroup.id] = groupRects

    for (let index = 0; index < surfaceGroup.walls.length; index += 1) {
      const wall = surfaceGroup.walls[index]
      const offsetX = index * (MAZE_LIGHTMAP_WALL_TILE_WIDTH - 1)

      wallRects[wall.id] = {}

      if (groupRects.nz && shouldLightmapWallLongFace(wall, 'nz')) {
        wallRects[wall.id].nz = {
          height: MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
          width: MAZE_LIGHTMAP_WALL_TILE_WIDTH,
          x: groupRects.nz.x + offsetX,
          y: groupRects.nz.y
        }
      }

      if (groupRects.pz && shouldLightmapWallLongFace(wall, 'pz')) {
        wallRects[wall.id].pz = {
          height: MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
          width: MAZE_LIGHTMAP_WALL_TILE_WIDTH,
          x: groupRects.pz.x + offsetX,
          y: groupRects.pz.y
        }
      }
    }
  }

  for (const surfaceGroup of surfaceGroups) {
    for (const faceKey of ['nz', 'pz']) {
      const rect = surfaceGroupRects[surfaceGroup.id][faceKey]

      if (!rect) {
        continue
      }

      surfaces.push({
        alignUToRectEdges: true,
        rect,
        surfaceA: [
          surfaceGroup.center.x,
          surfaceGroup.center.z,
          surfaceGroup.length,
          surfaceGroup.yaw
        ],
        surfaceB: [faceKey === 'pz' ? 1 : -1, 0, 0, 0],
        supersampleGrid: MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID,
        type: 1
      })
    }
  }

  for (const wall of walls) {
    const existingRects = wallRects[wall.id] ?? {}

    wallRects[wall.id] = {
      ...existingRects,
      nx: allocateLightmapRect(
        packer,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      ),
      px: allocateLightmapRect(
        packer,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      )
    }

    for (const faceKey of ['nx', 'px']) {
      surfaces.push({
        alignUToRectEdges: false,
        rect: wallRects[wall.id][faceKey],
        surfaceA: [
          wall.center.x,
          wall.center.z,
          wall.yaw,
          0
        ],
        surfaceB: [faceKey === 'px' ? 1 : -1, 0, 0, 0],
        supersampleGrid: MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID,
        type: 2
      })
    }
  }

  const atlasHeight = getLightmapAtlasHeight(packer)
  const nodeLightmapperModulePath = './gpuLightmapperNode.js'
  const { bakeGpuLightmapJob } = await import(
    /* @vite-ignore */ nodeLightmapperModulePath
  )
  const result = await bakeGpuLightmapJob({
    atlasHeight,
    atlasWidth,
    bakeModes: options.bakeModes,
    constants: {
      cellSize: MAZE_CELL_SIZE,
      groundBounds: [
        groundBounds.minX,
        groundBounds.minZ,
        groundBounds.maxX,
        groundBounds.maxZ
      ],
      groundBounceAlbedo: MAZE_LIGHTMAP_GROUND_BOUNCE_ALBEDO,
      sampleEpsilon: MAZE_LIGHTMAP_SAMPLE_EPSILON,
      sconceRadius,
      skyLightColor: MAZE_SKY_LIGHT_COLOR,
      skyRayDistance: MAZE_LIGHTMAP_SKY_RAY_DISTANCE,
      torchLightColor: MAZE_TORCH_LIGHT_COLOR,
      torchSourceRadius: sconceRadius,
      torchStrength: MAZE_LIGHTMAP_TORCH_STRENGTH,
      wallBounceAlbedo: MAZE_LIGHTMAP_WALL_BOUNCE_ALBEDO,
      wallHeight: MAZE_WALL_HEIGHT,
      wallThickness: MAZE_WALL_THICKNESS
    },
    surfaces,
    torches: torchPlacements,
    walls: walls.map((wall) => ({
      maxX: wall.bounds.maxX,
      maxY: wall.bounds.maxY,
      maxZ: wall.bounds.maxZ,
      minX: wall.bounds.minX,
      minY: wall.bounds.minY,
      minZ: wall.bounds.minZ
    }))
  })

  return {
    atlasHeight,
    atlasWidth,
    bakeMs: performance.now() - bakeStart,
    bakeRenderer: result.renderer,
    bakeVendor: result.vendor,
    dataBase64: result.dataBase64,
    ...(options.bakeModes ? { debugVariantDataBase64: result.variants } : {}),
    encoding: 'rgb16f',
    groundBounds,
    groundRect,
    neutralRect,
    version: MAZE_LIGHTMAP_VERSION,
    wallRects
  }
}

export function getMazeTorchPlacements(maze, sconceRadius) {
  return maze.lights.map((light, index) => {
    const descriptor = getWallDescriptorFromCellSide(maze, light.cell, light.side)
    const torchBillboardHalfSize =
      ((MAZE_WALL_THICKNESS / 2) + sconceRadius) / 2
    const sconcePosition = {
      x:
        descriptor.center.x +
        (descriptor.normal.x * ((MAZE_WALL_THICKNESS / 2) + sconceRadius)),
      y: GROUND_Y + 1.1,
      z:
        descriptor.center.z +
        (descriptor.normal.z * ((MAZE_WALL_THICKNESS / 2) + sconceRadius))
    }
    const torchPosition = {
      x: sconcePosition.x,
      y: sconcePosition.y + torchBillboardHalfSize,
      z: sconcePosition.z
    }

    return {
      cell: light.cell,
      id: `maze-light-${index}`,
      index,
      normal: { ...descriptor.normal },
      sconcePosition,
      side: light.side,
      torchPosition,
      wallAxis: descriptor.axis,
      wallCenter: { ...descriptor.center }
    }
  })
}

export const GROUND_Y = 0

export function getMazeGatePlacements(maze) {
  return (maze.gates ?? []).map((gate, index) => {
    const fromCenter = getCellCenter(maze, gate.from)
    const toCenter = getCellCenter(maze, gate.to)
    const horizontal = gate.from.y === gate.to.y

    return {
      axis: horizontal ? 'z' : 'x',
      cells: [
        { ...gate.from },
        { ...gate.to }
      ],
      center: {
        x: (fromCenter.x + toCenter.x) / 2,
        z: (fromCenter.z + toCenter.z) / 2
      },
      from: { ...gate.from },
      id: getGateId(gate),
      index,
      to: { ...gate.to },
      yaw: horizontal ? Math.PI / 2 : 0
    }
  })
}

function hashString(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function getMazeDecalPlacements(maze) {
  const walls = getMazeWallSegments(maze)
  const torchPlacements = getMazeTorchPlacements(maze, MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS)
  const litWallFaces = new Set(
    torchPlacements.map((torch) => [
      torch.wallCenter.x.toFixed(6),
      torch.wallCenter.z.toFixed(6),
      torch.normal.x.toFixed(6),
      torch.normal.z.toFixed(6)
    ].join(':'))
  )
  const decals = []

  for (const wall of walls) {
    for (const faceKey of ['pz', 'nz']) {
      const sample = getWallFaceSample(wall, faceKey, 0.5, 0.5)
      const litFaceKey = [
        wall.center.x.toFixed(6),
        wall.center.z.toFixed(6),
        sample.normal.x.toFixed(6),
        sample.normal.z.toFixed(6)
      ].join(':')

      if (litWallFaces.has(litFaceKey)) {
        continue
      }

      const hash = hashString(`${maze.id}:${wall.id}:${faceKey}`)

      if (hash % 5 !== 0) {
        continue
      }

      decals.push({
        faceKey,
        id: `decal-${wall.id}-${faceKey}`,
        normal: sample.normal,
        position: {
          x: sample.position.x + (sample.normal.x * 0.006),
          y: sample.position.y,
          z: sample.position.z + (sample.normal.z * 0.006)
        },
        textureIndex: hash % MAZE_DECAL_TEXTURE_COUNT,
        wallId: wall.id,
        yaw: Math.atan2(sample.normal.x, sample.normal.z)
      })
    }
  }

  return decals
}

export function getMazeItemPlacements(maze) {
  const items = []

  if (maze.sword?.cell) {
    const center = getCellCenter(maze, maze.sword.cell)

    items.push({
      cell: { ...maze.sword.cell },
      id: 'maze-sword',
      position: {
        x: center.x,
        y: GROUND_Y,
        z: center.z
      },
      type: 'sword'
    })
  }

  if (maze.trophy?.cell) {
    const center = getCellCenter(maze, maze.trophy.cell)

    items.push({
      cell: { ...maze.trophy.cell },
      id: 'maze-trophy',
      position: {
        x: center.x,
        y: GROUND_Y,
        z: center.z
      },
      type: 'trophy'
    })
  }

  return items
}

function getMazeReflectionProbePlacements(maze) {
  const probes = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const center = getCellCenter(maze, { x, y })

      probes.push({
        cell: { x, y },
        id: `probe-${x}-${y}`,
        position: {
          x: center.x,
          y: MAZE_REFLECTION_PROBE_Y,
          z: center.z
        }
      })
    }
  }

  return probes
}

export function getMazeSceneLayout(maze, sconceRadius) {
  const mazeWithVisibility = maze.visibility
    ? maze
    : {
        ...maze,
        visibility: computeMazeCellVisibility(maze)
      }

  return {
    cornerFillers: getMazeCornerFillers(mazeWithVisibility),
    decals: getMazeDecalPlacements(mazeWithVisibility),
    gates: getMazeGatePlacements(mazeWithVisibility),
    items: getMazeItemPlacements(mazeWithVisibility),
    lights: getMazeTorchPlacements(mazeWithVisibility, sconceRadius),
    maze: mazeWithVisibility,
    reflectionProbes: getMazeReflectionProbePlacements(mazeWithVisibility),
    walls: getMazeWallSegments(mazeWithVisibility)
  }
}

export function removeOpenEdge(maze, index) {
  const clone = cloneMaze(maze)
  clone.openEdges.splice(index, 1)
  return clone
}
