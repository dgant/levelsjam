export const MAZE_WIDTH = 7
export const MAZE_HEIGHT = 7
export const MAZE_CELL_SIZE = 2
export const MAZE_WALL_THICKNESS = 0.25
export const MAZE_WALL_HEIGHT = 2
export const MAZE_TARGET_COUNT = 5
export const MAZE_LIGHTMAP_VERSION = 6
export const MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS = 0.125

const MAZE_LIGHTMAP_GROUND_TILE_SIZE = 256
const MAZE_LIGHTMAP_WALL_TILE_WIDTH = 32
const MAZE_LIGHTMAP_WALL_TILE_HEIGHT = 32
const MAZE_LIGHTMAP_NEUTRAL_TILE_SIZE = 4
const MAZE_LIGHTMAP_TORCH_DISTANCE = 16
const MAZE_LIGHTMAP_GROUND_MARGIN = MAZE_LIGHTMAP_TORCH_DISTANCE
const MAZE_LIGHTMAP_SAMPLE_EPSILON = 0.02
const MAZE_LIGHTMAP_TORCH_STRENGTH = 1
const MAZE_LIGHTMAP_TARGET_PEAK = 0.45
const MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID = 1
const MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID = 2
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

export function validateMaze(maze) {
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
  const lightmapErrors = hasValidMazeLightmap(maze)
    ? []
    : ['Maze must include a valid baked lightmap']

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

export function generateMaze(seed = Date.now()) {
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
  maze.lightmap = bakeMazeLightmap(maze)
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

  return walls
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

function isTorchOccluded(samplePosition, torchPosition, walls, skipWallId) {
  for (const wall of walls) {
    if (wall.id === skipWallId) {
      continue
    }

    if (segmentIntersectsBounds(samplePosition, torchPosition, wall.bounds)) {
      return true
    }
  }

  return false
}

function accumulateTorchLighting(samplePosition, sampleNormal, torchPlacements, walls, skipWallId) {
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

    const rayStart = {
      x: samplePosition.x + (sampleNormal.x * MAZE_LIGHTMAP_SAMPLE_EPSILON),
      y: samplePosition.y + (sampleNormal.y * MAZE_LIGHTMAP_SAMPLE_EPSILON),
      z: samplePosition.z + (sampleNormal.z * MAZE_LIGHTMAP_SAMPLE_EPSILON)
    }

    if (isTorchOccluded(rayStart, torch.torchPosition, walls, skipWallId)) {
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

function bakeMazeLightmap(maze, sconceRadius = MAZE_LIGHTMAP_DEFAULT_SCONCE_RADIUS) {
  const bakeStart = performance.now()
  const walls = getMazeWallSegments(maze)
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

  for (const wall of walls) {
    wallRects[wall.id] = {
      nz: allocateLightmapRect(
        packer,
        MAZE_LIGHTMAP_WALL_TILE_WIDTH,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      ),
      pz: allocateLightmapRect(
        packer,
        MAZE_LIGHTMAP_WALL_TILE_WIDTH,
        MAZE_LIGHTMAP_WALL_TILE_HEIGHT
      )
    }
  }

  const atlasHeight = getLightmapAtlasHeight(packer)
  const atlasFloatData = new Float32Array(atlasWidth * atlasHeight)
  let peakIntensity = 0

  const writeIntensityRect = (rect, supersampleGrid, sampleIntensity) => {
    for (let row = 0; row < rect.height; row += 1) {
      for (let column = 0; column < rect.width; column += 1) {
        let accumulatedIntensity = 0

        for (let sampleRow = 0; sampleRow < supersampleGrid; sampleRow += 1) {
          for (let sampleColumn = 0; sampleColumn < supersampleGrid; sampleColumn += 1) {
            const u = (
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

        atlasFloatData[pixelOffset] = intensity
        peakIntensity = Math.max(peakIntensity, intensity)
      }
    }
  }

  writeIntensityRect(
    groundRect,
    MAZE_LIGHTMAP_GROUND_SUPERSAMPLE_GRID,
    (u, v) => {
      const sample = getGroundSample(groundBounds, u, v)
      return accumulateTorchLighting(
        sample.position,
        sample.normal,
        torchPlacements,
        walls
      )
    }
  )

  for (const wall of walls) {
    for (const faceKey of ['nz', 'pz']) {
      writeIntensityRect(
        wallRects[wall.id][faceKey],
        MAZE_LIGHTMAP_WALL_SUPERSAMPLE_GRID,
        (u, v) => {
          const sample = getWallFaceSample(wall, faceKey, u, v)
          return accumulateTorchLighting(
            sample.position,
            sample.normal,
            torchPlacements,
            walls,
            wall.id
          )
        }
      )
    }
  }

  const atlasData = new Uint8Array(atlasWidth * atlasHeight * 3)
  const intensityScale =
    peakIntensity > 0
      ? MAZE_LIGHTMAP_TARGET_PEAK / peakIntensity
      : 1

  for (let pixelIndex = 0; pixelIndex < atlasFloatData.length; pixelIndex += 1) {
    const intensity = Math.min(1, atlasFloatData[pixelIndex] * intensityScale)
    const channel = Math.round(intensity * 255)
    const outputOffset = pixelIndex * 3

    atlasData[outputOffset] = channel
    atlasData[outputOffset + 1] = channel
    atlasData[outputOffset + 2] = channel
  }

  return {
    atlasHeight,
    atlasWidth,
    bakeMs: performance.now() - bakeStart,
    dataBase64: Buffer.from(atlasData).toString('base64'),
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
      y: sconcePosition.y + 0.25,
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
