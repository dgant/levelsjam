export const MAZE_WIDTH = 7
export const MAZE_HEIGHT = 7
export const MAZE_CELL_SIZE = 2
export const MAZE_WALL_THICKNESS = 0.25
export const MAZE_WALL_HEIGHT = 2
export const MAZE_TARGET_COUNT = 5
export const MAZE_LIGHTMAP_VERSION = 14
export const MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS = 0.125

const MAZE_LIGHTMAP_GROUND_TILE_SIZE = 256
const MAZE_LIGHTMAP_WALL_TILE_WIDTH = 128
const MAZE_LIGHTMAP_WALL_TILE_HEIGHT = 128
const MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE = 4
const MAZE_LIGHTMAP_TORCH_DISTANCE = 16
const MAZE_LIGHTMAP_GROUND_MARGIN = MAZE_LIGHTMAP_TORCH_DISTANCE
const MAZE_LIGHTMAP_SAMPLE_EPSILON = 0.02
const MAZE_LIGHTMAP_TORCH_STRENGTH = 1
const MAZE_LIGHTMAP_TARGET_PEAK = 0.45
const MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID = 1
const MAZE_LIGHTMAP_GROUND_AMBIENT_SAMPLE_SIZE = 48
const MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID = 2
const MAZE_LIGHTMAP_WALL_AMBIENT_SAMPLE_WIDTH = 24
const MAZE_LIGHTMAP_WALL_AMBIENT_SAMPLE_HEIGHT = 32
const MAZE_LIGHTMAP_SKY_AMBIENT_DISTANCE = 24
const MAZE_LIGHTMAP_SKY_AMBIENT_INTENSITY = 0.03
const MAZE_REFLECTION_PROBE_Y = 1.25

const CARDINAL_DIRECTIONS = [
  { dx: 0, dy: -1, side: 'north' },
  { dx: 1, dy: 0, side: 'east' },
  { dx: 0, dy: 1, side: 'south' },
  { dx: -1, dy: 0, side: 'west' }
]

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
const SKY_AMBIENT_DIRECTIONS = Object.freeze(
  [
    [0, 1, 0],
    [0.55, 0.83, 0],
    [-0.55, 0.83, 0],
    [0, 0.83, 0.55],
    [0, 0.83, -0.55],
    [0.42, 0.7, 0.58],
    [-0.42, 0.7, 0.58],
    [0.42, 0.7, -0.58],
    [-0.42, 0.7, -0.58]
  ].map(([x, y, z]) => {
    const length = Math.hypot(x, y, z)

    return {
      x: x / length,
      y: y / length,
      z: z / length
    }
  })
)

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

function cloneMaze(maze) {
  return {
    ...maze,
    lights: maze.lights.map((light) => ({
      cell: { ...light.cell },
      side: light.side
    })),
    openEdges: maze.openEdges.map((edge) => ({
      from: { ...edge.from },
      to: { ...edge.to }
    })),
    opening: {
      cell: { ...maze.opening.cell },
      side: maze.opening.side
    }
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

  for (const direction of CARDINAL_DIRECTIONS) {
    const neighbor = getNeighbor(cell, direction.side)

    if (!isInsideMaze(neighbor, maze.width, maze.height)) {
      if (
        maze.opening.cell.x === cell.x &&
        maze.opening.cell.y === cell.y &&
        maze.opening.side === direction.side
      ) {
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

  for (const light of maze.lights ?? []) {
    if (!isInsideMaze(light.cell, maze.width, maze.height)) {
      errors.push('Light cells must lie inside the maze bounds')
      continue
    }

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
    return Boolean(rects?.nz && rects?.pz)
  })
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
  const lightmapErrors = requireLightmap && !hasValidMazeLightmap(maze)
    ? ['Maze must include a valid baked lightmap']
    : []

  return {
    errors: [...minimalityErrors, ...lightValidation.errors, ...lightmapErrors],
    valid:
      minimalityErrors.length === 0 &&
      lightValidation.valid &&
      lightmapErrors.length === 0
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

  while (unlit.size > 0) {
    const candidates = [...unlit]
      .map(parseCellKey)
      .filter((cell) => getClosedSides(maze, adjacency, cell).length > 0)

    if (candidates.length === 0) {
      break
    }

    const cell = candidates[integerFromRandom(random, candidates.length)]
    const closedSides = getClosedSides(maze, adjacency, cell)
    const side = closedSides[integerFromRandom(random, closedSides.length)]
    const light = { cell, side }

    lights.push(light)
    for (const coveredCell of computeLightCoverage(maze, light)) {
      unlit.delete(coveredCell)
    }
  }

  return lights
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

  maze.lights = generateMazeLights(maze, random)
  maze.generationMs = performance.now() - startTime
  if (bakeLightmap) {
    maze.lightmap = bakeMazeLightmap(maze)
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

  return [
    maze.width,
    maze.height,
    cellKey(maze.opening.cell),
    maze.opening.side,
    edges,
    lights
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

function writeResampledIntensityRect(
  target,
  atlasWidth,
  rect,
  sampleWidth,
  sampleHeight,
  sampleIntensity,
  options = {}
) {
  const alignUToRectEdges = options.alignUToRectEdges ?? false
  const coarseSamples = new Float32Array(sampleWidth * sampleHeight)
  let maxIntensity = 0

  for (let sampleRow = 0; sampleRow < sampleHeight; sampleRow += 1) {
    const sampleV = sampleHeight > 1
      ? sampleRow / (sampleHeight - 1)
      : 0.5

    for (let sampleColumn = 0; sampleColumn < sampleWidth; sampleColumn += 1) {
      const sampleU = alignUToRectEdges && sampleWidth > 1
        ? sampleColumn / (sampleWidth - 1)
        : (sampleColumn + 0.5) / sampleWidth
      const coarseIndex = (sampleRow * sampleWidth) + sampleColumn
      const intensity = Math.max(0, sampleIntensity(sampleU, sampleV))

      coarseSamples[coarseIndex] = intensity
    }
  }

  for (let row = 0; row < rect.height; row += 1) {
    const v = rect.height > 1
      ? row / (rect.height - 1)
      : 0.5
    const sampleY = Math.max(0, Math.min(sampleHeight - 1, v * (sampleHeight - 1)))
    const sampleY0 = Math.floor(sampleY)
    const sampleY1 = Math.min(sampleHeight - 1, sampleY0 + 1)
    const sampleTY = sampleY - sampleY0

    for (let column = 0; column < rect.width; column += 1) {
      const u = alignUToRectEdges && rect.width > 1
        ? column / (rect.width - 1)
        : (column + 0.5) / rect.width
      const sampleX = Math.max(0, Math.min(sampleWidth - 1, u * (sampleWidth - 1)))
      const sampleX0 = Math.floor(sampleX)
      const sampleX1 = Math.min(sampleWidth - 1, sampleX0 + 1)
      const sampleTX = sampleX - sampleX0
      const topLeft = coarseSamples[(sampleY0 * sampleWidth) + sampleX0]
      const topRight = coarseSamples[(sampleY0 * sampleWidth) + sampleX1]
      const bottomLeft = coarseSamples[(sampleY1 * sampleWidth) + sampleX0]
      const bottomRight = coarseSamples[(sampleY1 * sampleWidth) + sampleX1]
      const top = topLeft + ((topRight - topLeft) * sampleTX)
      const bottom = bottomLeft + ((bottomRight - bottomLeft) * sampleTX)
      const intensity = top + ((bottom - top) * sampleTY)
      const pixelOffset =
        ((rect.y + row) * atlasWidth) + rect.x + column

      target[pixelOffset] = intensity
      maxIntensity = Math.max(maxIntensity, intensity)
    }
  }

  return maxIntensity
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, value)))
}

function getPreferredLightmapAtlasWidth(wallCount) {
  const totalTexelCount =
    (MAZE_LIGHTMAP_GROUND_TILE_SIZE * MAZE_LIGHTMAP_GROUND_TILE_SIZE) +
    (MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE * MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE) +
    (wallCount * 2 * MAZE_LIGHTMAP_WALL_TILE_WIDTH * MAZE_LIGHTMAP_WALL_TILE_HEIGHT)

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
      throw new Error(`Unsupported wall face bake key: ${faceKey}`)
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

function getWallSurfaceFaceSample(surfaceGroup, faceKey, u, v) {
  const localAlong = (u - 0.5) * surfaceGroup.length
  const localY = (v - 0.5) * MAZE_WALL_HEIGHT
  let localZ = 0
  let normalX = 0
  let normalZ = 0

  switch (faceKey) {
    case 'pz':
      localZ = MAZE_WALL_THICKNESS / 2
      normalZ = 1
      break
    case 'nz':
      localZ = -(MAZE_WALL_THICKNESS / 2)
      normalZ = -1
      break
    default:
      throw new Error(`Unsupported wall surface bake key: ${faceKey}`)
  }

  const rotatedPosition = rotateWallLocalVector(
    localAlong,
    localZ,
    surfaceGroup.yaw
  )
  const rotatedNormal = rotateWallLocalVector(normalX, normalZ, surfaceGroup.yaw)

  return {
    normal: {
      x: rotatedNormal.x,
      y: 0,
      z: rotatedNormal.z
    },
    position: {
      x: surfaceGroup.center.x + rotatedPosition.x,
      y: GROUND_Y + (MAZE_WALL_HEIGHT / 2) + localY,
      z: surfaceGroup.center.z + rotatedPosition.z
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

function getGroundSample(groundBounds, u, v) {
  return {
    normal: { x: 0, y: 1, z: 0 },
    position: {
      x: groundBounds.minX + (u * groundBounds.width),
      y: GROUND_Y,
      z: groundBounds.minZ + (v * groundBounds.depth)
    }
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

function segmentIntersectsSphere(start, end, center, radius) {
  const directionX = end.x - start.x
  const directionY = end.y - start.y
  const directionZ = end.z - start.z
  const toStartX = start.x - center.x
  const toStartY = start.y - center.y
  const toStartZ = start.z - center.z
  const a =
    (directionX * directionX) +
    (directionY * directionY) +
    (directionZ * directionZ)

  if (a <= 1e-8) {
    return false
  }

  const b = 2 * (
    (toStartX * directionX) +
    (toStartY * directionY) +
    (toStartZ * directionZ)
  )
  const c =
    (toStartX * toStartX) +
    (toStartY * toStartY) +
    (toStartZ * toStartZ) -
    (radius * radius)
  const discriminant = (b * b) - (4 * a * c)

  if (discriminant < 0) {
    return false
  }

  const root = Math.sqrt(discriminant)
  const near = (-b - root) / (2 * a)
  const far = (-b + root) / (2 * a)

  return (
    (near > 0 && near < 1) ||
    (far > 0 && far < 1)
  )
}

function segmentIntersectsLowerHemisphereCap(start, end, center, radius) {
  const directionX = end.x - start.x
  const directionY = end.y - start.y
  const directionZ = end.z - start.z
  const toStartX = start.x - center.x
  const toStartY = start.y - center.y
  const toStartZ = start.z - center.z
  const a =
    (directionX * directionX) +
    (directionY * directionY) +
    (directionZ * directionZ)

  if (a > 1e-8) {
    const b = 2 * (
      (toStartX * directionX) +
      (toStartY * directionY) +
      (toStartZ * directionZ)
    )
    const c =
      (toStartX * toStartX) +
      (toStartY * toStartY) +
      (toStartZ * toStartZ) -
      (radius * radius)
    const discriminant = (b * b) - (4 * a * c)

    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant)
      const near = (-b - root) / (2 * a)
      const far = (-b + root) / (2 * a)

      for (const t of [near, far]) {
        if (t > 1e-6 && t < (1 - 1e-6)) {
          const intersectionY = start.y + (directionY * t)

          if (intersectionY <= center.y + 1e-6) {
            return true
          }
        }
      }
    }
  }

  if (Math.abs(directionY) > 1e-8) {
    const planeT = (center.y - start.y) / directionY

    if (planeT > 1e-6 && planeT < (1 - 1e-6)) {
      const planeX = start.x + (directionX * planeT)
      const planeZ = start.z + (directionZ * planeT)
      const distanceToCenterSquared =
        ((planeX - center.x) * (planeX - center.x)) +
        ((planeZ - center.z) * (planeZ - center.z))

      if (distanceToCenterSquared <= ((radius * radius) + 1e-6)) {
        return true
      }
    }
  }

  return false
}

function isTorchBlockedBySconce(samplePosition, torchPlacement, sconceRadius) {
  return segmentIntersectsLowerHemisphereCap(
    samplePosition,
    torchPlacement.torchPosition,
    torchPlacement.sconcePosition,
    sconceRadius
  )
}

function isTorchOccluded(
  samplePosition,
  torchPosition,
  walls,
  skipWallId,
  skipSurfaceGroupId
) {
  for (const wall of walls) {
    if (
      wall.id === skipWallId ||
      wall.surfaceGroupId === skipSurfaceGroupId
    ) {
      continue
    }

    if (segmentIntersectsBounds(samplePosition, torchPosition, wall.bounds)) {
      return true
    }
  }

  return false
}

function accumulateTorchLighting(
  samplePosition,
  sampleNormal,
  torchPlacements,
  walls,
  skipWallId,
  skipSurfaceGroupId,
  sconceRadius
) {
  let litIntensity = 0

  for (const torch of torchPlacements) {
    const toTorchX = torch.torchPosition.x - samplePosition.x
    const toTorchY = torch.torchPosition.y - samplePosition.y
    const toTorchZ = torch.torchPosition.z - samplePosition.z
    const distance = Math.hypot(toTorchX, toTorchY, toTorchZ)

    if (distance <= 1e-6 || distance > MAZE_LIGHTMAP_TORCH_DISTANCE) {
      continue
    }

    const directionX = toTorchX / distance
    const directionY = toTorchY / distance
    const directionZ = toTorchZ / distance
    const lambert =
      (sampleNormal.x * directionX) +
      (sampleNormal.y * directionY) +
      (sampleNormal.z * directionZ)

    if (lambert <= 0) {
      continue
    }

    if (
      isTorchBlockedBySconce(
        samplePosition,
        torch,
        sconceRadius
      )
    ) {
      continue
    }

    const rayStart = {
      x: samplePosition.x + (sampleNormal.x * MAZE_LIGHTMAP_SAMPLE_EPSILON),
      y: samplePosition.y + (sampleNormal.y * MAZE_LIGHTMAP_SAMPLE_EPSILON),
      z: samplePosition.z + (sampleNormal.z * MAZE_LIGHTMAP_SAMPLE_EPSILON)
    }

    if (
      isTorchOccluded(
        rayStart,
        torch.torchPosition,
        walls,
        skipWallId,
        skipSurfaceGroupId
      )
    ) {
      continue
    }

    const normalizedDistance = distance / MAZE_LIGHTMAP_TORCH_DISTANCE
    const falloff =
      ((1 - normalizedDistance) ** 2) / (1 + (distance * distance * 0.12))
    const strength = lambert * falloff * MAZE_LIGHTMAP_TORCH_STRENGTH

    litIntensity += strength
  }

  return litIntensity
}

function accumulateSkyAmbientLighting(
  samplePosition,
  sampleNormal,
  walls,
  torchPlacements,
  skipWallId,
  skipSurfaceGroupId,
  sconceRadius
) {
  const rayStart = {
    x: samplePosition.x + (sampleNormal.x * MAZE_LIGHTMAP_SAMPLE_EPSILON),
    y: samplePosition.y + (sampleNormal.y * MAZE_LIGHTMAP_SAMPLE_EPSILON),
    z: samplePosition.z + (sampleNormal.z * MAZE_LIGHTMAP_SAMPLE_EPSILON)
  }
  let visibleWeight = 0
  let totalWeight = 0

  for (const direction of SKY_AMBIENT_DIRECTIONS) {
    const lambert =
      (sampleNormal.x * direction.x) +
      (sampleNormal.y * direction.y) +
      (sampleNormal.z * direction.z)

    if (lambert <= 0) {
      continue
    }

    totalWeight += lambert
    const rayEnd = {
      x: rayStart.x + (direction.x * MAZE_LIGHTMAP_SKY_AMBIENT_DISTANCE),
      y: rayStart.y + (direction.y * MAZE_LIGHTMAP_SKY_AMBIENT_DISTANCE),
      z: rayStart.z + (direction.z * MAZE_LIGHTMAP_SKY_AMBIENT_DISTANCE)
    }

    if (
      isTorchOccluded(
        rayStart,
        rayEnd,
        walls,
        skipWallId,
        skipSurfaceGroupId
      )
    ) {
      continue
    }

    let blockedBySconce = false

    for (const torchPlacement of torchPlacements) {
      if (
        segmentIntersectsLowerHemisphereCap(
          rayStart,
          rayEnd,
          torchPlacement.sconcePosition,
          sconceRadius
        )
      ) {
        blockedBySconce = true
        break
      }
    }

    if (blockedBySconce) {
      continue
    }

    visibleWeight += lambert
  }

  if (totalWeight <= 1e-6) {
    return 0
  }

  return (visibleWeight / totalWeight) * MAZE_LIGHTMAP_SKY_AMBIENT_INTENSITY
}

export function bakeMazeLightmap(
  maze,
  sconceRadius = MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS
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

  for (const surfaceGroup of surfaceGroups) {
    const groupWidth = surfaceGroup.walls.length === 1
      ? MAZE_LIGHTMAP_WALL_TILE_WIDTH
      : (surfaceGroup.walls.length * (MAZE_LIGHTMAP_WALL_TILE_WIDTH - 1)) + 1
    const groupRects = {
      nz: allocateLightmapRect(
        packer,
        groupWidth,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      ),
      pz: allocateLightmapRect(
        packer,
        groupWidth,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      )
    }

    surfaceGroupRects[surfaceGroup.id] = groupRects

    for (let index = 0; index < surfaceGroup.walls.length; index += 1) {
      const wall = surfaceGroup.walls[index]
      const offsetX = index * (MAZE_LIGHTMAP_WALL_TILE_WIDTH - 1)

      wallRects[wall.id] = {
        nz: {
          height: MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
          width: MAZE_LIGHTMAP_WALL_TILE_WIDTH,
          x: groupRects.nz.x + offsetX,
          y: groupRects.nz.y
        },
        pz: {
          height: MAZE_LIGHTMAP_WALL_TILE_HEIGHT,
          width: MAZE_LIGHTMAP_WALL_TILE_WIDTH,
          x: groupRects.pz.x + offsetX,
          y: groupRects.pz.y
        }
      }
    }
  }

  const atlasHeight = getLightmapAtlasHeight(packer)
  const atlasAmbientFloatData = new Float32Array(atlasWidth * atlasHeight)
  const atlasTorchFloatData = new Float32Array(atlasWidth * atlasHeight)
  let peakIntensity = 0

  const writeIntensityRect = (
    target,
    rect,
    supersampleGrid,
    sampleIntensity,
    options = {}
  ) => {
    const alignUToRectEdges = options.alignUToRectEdges ?? false

    for (let row = 0; row < rect.height; row += 1) {
      for (let column = 0; column < rect.width; column += 1) {
        let accumulatedIntensity = 0

        for (let sampleRow = 0; sampleRow < supersampleGrid; sampleRow += 1) {
          for (let sampleColumn = 0; sampleColumn < supersampleGrid; sampleColumn += 1) {
            const u = alignUToRectEdges && rect.width > 1
              ? column / (rect.width - 1)
              : (
                  column +
                  ((sampleColumn + 0.5) / supersampleGrid)
                ) / rect.width
            const v = (
              row +
              ((sampleRow + 0.5) / supersampleGrid)
            ) / rect.height

            accumulatedIntensity += Math.max(0, sampleIntensity(u, v))
          }
        }

        const intensity =
          accumulatedIntensity /
          (supersampleGrid * supersampleGrid)
        const pixelOffset =
          ((rect.y + row) * atlasWidth) + rect.x + column

        target[pixelOffset] = intensity
        peakIntensity = Math.max(peakIntensity, intensity)
      }
    }
  }

  writeIntensityRect(
    atlasTorchFloatData,
    groundRect,
    MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID,
    (u, v) => {
      const sample = getGroundSample(groundBounds, u, v)
      return accumulateTorchLighting(
        sample.position,
        sample.normal,
        torchPlacements,
        walls,
        null,
        null,
        sconceRadius
      )
    }
  )
  peakIntensity = Math.max(
    peakIntensity,
    writeResampledIntensityRect(
      atlasAmbientFloatData,
      atlasWidth,
      groundRect,
      MAZE_LIGHTMAP_GROUND_AMBIENT_SAMPLE_SIZE,
      MAZE_LIGHTMAP_GROUND_AMBIENT_SAMPLE_SIZE,
      (u, v) => {
        const sample = getGroundSample(groundBounds, u, v)
        return accumulateSkyAmbientLighting(
          sample.position,
          sample.normal,
          walls,
          torchPlacements,
          null,
          null,
          sconceRadius
        )
      }
    )
  )

  for (const surfaceGroup of surfaceGroups) {
    for (const faceKey of ['nz', 'pz']) {
      writeIntensityRect(
        atlasTorchFloatData,
        surfaceGroupRects[surfaceGroup.id][faceKey],
        MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID,
        (u, v) => {
          const sample = getWallSurfaceFaceSample(surfaceGroup, faceKey, u, v)
          return accumulateTorchLighting(
            sample.position,
            sample.normal,
            torchPlacements,
            walls,
            null,
            surfaceGroup.id,
            sconceRadius
          )
        },
        { alignUToRectEdges: true }
      )
      peakIntensity = Math.max(
        peakIntensity,
        writeResampledIntensityRect(
          atlasAmbientFloatData,
          atlasWidth,
          surfaceGroupRects[surfaceGroup.id][faceKey],
          MAZE_LIGHTMAP_WALL_AMBIENT_SAMPLE_WIDTH,
          MAZE_LIGHTMAP_WALL_AMBIENT_SAMPLE_HEIGHT,
          (u, v) => {
            const sample = getWallSurfaceFaceSample(surfaceGroup, faceKey, u, v)
            return accumulateSkyAmbientLighting(
              sample.position,
              sample.normal,
              walls,
              torchPlacements,
              null,
              surfaceGroup.id,
              sconceRadius
            )
          },
          { alignUToRectEdges: true }
        )
      )
    }
  }

  const atlasData = new Uint8Array(atlasWidth * atlasHeight * 3)
  const intensityScale =
    peakIntensity > 0
      ? MAZE_LIGHTMAP_TARGET_PEAK / peakIntensity
      : 1

  for (let pixelIndex = 0; pixelIndex < atlasTorchFloatData.length; pixelIndex += 1) {
    const ambientIntensity = Math.min(1, atlasAmbientFloatData[pixelIndex] * intensityScale)
    const torchIntensity = Math.min(1, atlasTorchFloatData[pixelIndex] * intensityScale)
    const outputOffset = pixelIndex * 3

    atlasData[outputOffset] = Math.round(torchIntensity * 255)
    atlasData[outputOffset + 1] = Math.round(ambientIntensity * 255)
    atlasData[outputOffset + 2] = 0
  }

  return {
    atlasHeight,
    atlasWidth,
    bakeMs: performance.now() - bakeStart,
    dataBase64: encodeBytesToBase64(atlasData),
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
      sconcePosition,
      side: light.side,
      torchPosition
    }
  })
}

export const GROUND_Y = 0

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
  return {
    lights: getMazeTorchPlacements(maze, sconceRadius),
    maze,
    reflectionProbes: getMazeReflectionProbePlacements(maze),
    walls: getMazeWallSegments(maze)
  }
}

export function removeOpenEdge(maze, index) {
  const clone = cloneMaze(maze)
  clone.openEdges.splice(index, 1)
  return clone
}
