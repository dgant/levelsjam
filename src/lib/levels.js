import { bakeMazeLightmap, computeMazeCellVisibility } from './maze.js'

const AUTHORED_LEVEL_IDS = Object.freeze({
  Entrance: 'entrance',
  'Chamber 1': 'chamber-1'
})

const AUTHORED_LEVEL_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(AUTHORED_LEVEL_IDS).map(([name, id]) => [id, name])
  )
)

const RUNTIME_LEVEL_GRAPH = Object.freeze({
  entrance: ['chamber-1'],
  'chamber-1': ['maze-001', 'maze-002', 'maze-003', 'maze-004'],
  'maze-001': [],
  'maze-002': [],
  'maze-003': [],
  'maze-004': []
})

const RUNTIME_LEVEL_ADJACENCY = Object.freeze({
  entrance: ['chamber-1'],
  'chamber-1': ['entrance', 'maze-001', 'maze-002', 'maze-003', 'maze-004'],
  'maze-001': ['chamber-1'],
  'maze-002': ['chamber-1'],
  'maze-003': ['chamber-1'],
  'maze-004': ['chamber-1']
})

const RUNTIME_LEVEL_WORLD_TRANSFORMS = Object.freeze({
  entrance: { x: 0, z: 0, rotationY: 0 },
  'chamber-1': { x: 0, z: -21, rotationY: 0 },
  'maze-001': { x: -12, z: -28, rotationY: Math.PI },
  'maze-002': { x: -12, z: -10, rotationY: Math.PI },
  'maze-003': { x: 12, z: -30, rotationY: 0 },
  'maze-004': { x: 12, z: -12, rotationY: 0 }
})

const authoredLevelMazeCache = new Map()

export function parseLevelSpec(markdown) {
  const levels = []
  let currentLevel = null

  for (const rawLine of String(markdown ?? '').split(/\r?\n/)) {
    const headingMatch = rawLine.match(/^\s*\+\s+(.+?)\s*$/)

    if (headingMatch) {
      currentLevel = {
        description: '',
        name: headingMatch[1].trim()
      }
      levels.push(currentLevel)
      continue
    }

    if (!currentLevel) {
      continue
    }

    const line = rawLine.trim()

    if (!line) {
      continue
    }

    currentLevel.description = currentLevel.description
      ? `${currentLevel.description}\n${line}`
      : line
  }

  return levels
}

function cloneCell(cell) {
  return { x: cell.x, y: cell.y }
}

function openRoomEdges(width, height) {
  return openEdgesForCells(rectangularCells(width, height))
}

function rectangularCells(width, height) {
  const cells = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function openEdgesForCells(cells) {
  const cellKeys = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const edges = []

  for (const cell of cells) {
    for (const delta of [
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]) {
      const to = { x: cell.x + delta.x, y: cell.y + delta.y }

      if (!cellKeys.has(`${to.x},${to.y}`)) {
        continue
      }

      edges.push({
        from: { ...cell },
        to
      })
    }
  }

  return edges
}

function createAuthoredMazeDefinition(id) {
  if (id === 'entrance') {
    return {
      exitRequiresTrophy: false,
      gates: [],
      height: 3,
      id,
      isAuthoredLevel: true,
      levelExits: [
        {
          cell: { x: 1, y: 0 },
          side: 'north',
          targetLevelId: 'chamber-1'
        }
      ],
      levelName: AUTHORED_LEVEL_NAMES[id],
      lights: [
        { cell: { x: 0, y: 0 }, side: 'north' },
        { cell: { x: 2, y: 0 }, side: 'north' }
      ],
      monsters: [],
      openEdges: openRoomEdges(3, 3),
      opening: {
        cell: { x: 1, y: 0 },
        side: 'north'
      },
      playerStart: {
        cell: { x: 1, y: 2 },
        direction: 'north'
      },
      sword: null,
      trophy: null,
      width: 3
    }
  }

  if (id === 'chamber-1') {
    const roomCells = rectangularCells(5, 17)
    const connectorCell = { x: 2, y: 17 }
    const cells = [
      ...roomCells,
      connectorCell
    ]

    return {
      altars: [
        { cell: { x: 0, y: 2 }, targetLevelId: 'maze-001' },
        { cell: { x: 0, y: 11 }, targetLevelId: 'maze-002' },
        { cell: { x: 4, y: 2 }, targetLevelId: 'maze-003' },
        { cell: { x: 4, y: 11 }, targetLevelId: 'maze-004' }
      ],
      cells,
      exitRequiresTrophy: false,
      gates: [],
      height: 18,
      id,
      isAuthoredLevel: true,
      levelExits: [
        { cell: { x: 2, y: 17 }, side: 'south', targetLevelId: 'entrance' },
        { cell: { x: 0, y: 3 }, side: 'west', targetLevelId: 'maze-001' },
        { cell: { x: 0, y: 12 }, side: 'west', targetLevelId: 'maze-002' },
        { cell: { x: 4, y: 3 }, side: 'east', targetLevelId: 'maze-003' },
        { cell: { x: 4, y: 12 }, side: 'east', targetLevelId: 'maze-004' }
      ],
      levelName: AUTHORED_LEVEL_NAMES[id],
      lights: [
        { cell: { x: 0, y: 2 }, side: 'west' },
        { cell: { x: 0, y: 4 }, side: 'west' },
        { cell: { x: 0, y: 11 }, side: 'west' },
        { cell: { x: 0, y: 13 }, side: 'west' },
        { cell: { x: 4, y: 2 }, side: 'east' },
        { cell: { x: 4, y: 4 }, side: 'east' },
        { cell: { x: 4, y: 11 }, side: 'east' },
        { cell: { x: 4, y: 13 }, side: 'east' }
      ],
      monsters: [],
      openEdges: openEdgesForCells(cells),
      opening: {
        cell: { x: 2, y: 17 },
        side: 'south'
      },
      roomBounds: {
        height: 17,
        width: 5
      },
      playerStart: {
        cell: { x: 2, y: 17 },
        direction: 'north'
      },
      sword: null,
      trophy: null,
      width: 5
    }
  }

  return null
}

export function getDefaultRuntimeLevelId() {
  return AUTHORED_LEVEL_IDS.Entrance
}

export function getAuthoredRuntimeLevelId(levelName) {
  return AUTHORED_LEVEL_IDS[String(levelName ?? '').trim()] ?? null
}

export function isAuthoredRuntimeLevelId(id) {
  return Object.prototype.hasOwnProperty.call(AUTHORED_LEVEL_NAMES, id)
}

export function getAuthoredRuntimeLevelIds() {
  return Object.values(AUTHORED_LEVEL_IDS)
}

export function getAdjacentRuntimeLevelIds(id) {
  return [...(RUNTIME_LEVEL_ADJACENCY[id] ?? [])]
}

export function getDirectedRuntimeLevelGraph() {
  return Object.fromEntries(
    Object.entries(RUNTIME_LEVEL_GRAPH).map(([id, targets]) => [id, [...targets]])
  )
}

export function getRuntimeLevelGraphRootId() {
  return AUTHORED_LEVEL_IDS.Entrance
}

export function getRuntimeLevelWorldTransform(id) {
  const transform = RUNTIME_LEVEL_WORLD_TRANSFORMS[id]

  return transform
    ? { ...transform }
    : { x: 0, z: 0, rotationY: 0 }
}

export async function createAuthoredRuntimeMaze(id, options = {}) {
  if (!isAuthoredRuntimeLevelId(id)) {
    return null
  }

  const bakeLightmap = options.bakeLightmap === true
  const cached = authoredLevelMazeCache.get(id)

  if (bakeLightmap && cached) {
    return {
      ...cached,
      levelExits: cached.levelExits.map((exit) => ({
        ...exit,
        cell: cloneCell(exit.cell)
      }))
    }
  }

  const maze = createAuthoredMazeDefinition(id)

  if (!maze) {
    return null
  }

  maze.visibility = computeMazeCellVisibility(maze)
  if (bakeLightmap) {
    maze.lightmap = await bakeMazeLightmap(maze)
    authoredLevelMazeCache.set(id, maze)
  }

  return {
    ...maze,
    levelExits: maze.levelExits.map((exit) => ({
      ...exit,
      cell: cloneCell(exit.cell)
    }))
  }
}

export function resolveRuntimeMazeIdForLevel(levelName, levelIndex, mazeIds, fallbackMazeId = null) {
  const authoredLevelId = getAuthoredRuntimeLevelId(levelName)

  if (authoredLevelId) {
    return authoredLevelId
  }

  const availableMazeIds = Array.isArray(mazeIds)
    ? mazeIds.filter((id) => (
        typeof id === 'string' &&
        id.length > 0 &&
        !isAuthoredRuntimeLevelId(id)
      ))
    : []

  if (availableMazeIds.length === 0) {
    return fallbackMazeId
  }

  const numberedMazeMatch = String(levelName ?? '').match(/^Maze\s+(\d+)$/i)

  if (numberedMazeMatch) {
    const mazeNumber = Number(numberedMazeMatch[1])
    const numberedMazeId = availableMazeIds[mazeNumber - 1]

    if (numberedMazeId) {
      return numberedMazeId
    }
  }

  return availableMazeIds[levelIndex] ?? fallbackMazeId ?? availableMazeIds[0]
}
