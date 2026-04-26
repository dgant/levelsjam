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

const RUNTIME_LEVEL_ADJACENCY = Object.freeze({
  entrance: ['chamber-1'],
  'chamber-1': ['entrance', 'maze-001', 'maze-002', 'maze-003', 'maze-005'],
  'maze-001': ['chamber-1'],
  'maze-002': ['chamber-1'],
  'maze-003': ['chamber-1'],
  'maze-005': ['chamber-1']
})

const RUNTIME_LEVEL_WORLD_TRANSFORMS = Object.freeze({
  entrance: { x: 0, z: 0, rotationY: 0 },
  'chamber-1': { x: 0, z: -17, rotationY: 0 },
  'maze-001': { x: -12, z: -20, rotationY: Math.PI },
  'maze-002': { x: -12, z: -27, rotationY: Math.PI },
  'maze-003': { x: 12, z: -22, rotationY: 0 },
  'maze-005': { x: 12, z: -10, rotationY: 0 }
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
  const edges = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < width - 1) {
        edges.push({
          from: { x, y },
          to: { x: x + 1, y }
        })
      }
      if (y < height - 1) {
        edges.push({
          from: { x, y },
          to: { x, y: y + 1 }
        })
      }
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
        cell: { x: 1, y: 2 },
        side: 'south'
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
    return {
      exitRequiresTrophy: false,
      gates: [],
      height: 14,
      id,
      isAuthoredLevel: true,
      levelExits: [
        { cell: { x: 2, y: 13 }, side: 'south', targetLevelId: 'entrance' },
        { cell: { x: 0, y: 3 }, side: 'west', targetLevelId: 'maze-001' },
        { cell: { x: 0, y: 9 }, side: 'west', targetLevelId: 'maze-002' },
        { cell: { x: 4, y: 3 }, side: 'east', targetLevelId: 'maze-003' },
        { cell: { x: 4, y: 9 }, side: 'east', targetLevelId: 'maze-005' }
      ],
      levelName: AUTHORED_LEVEL_NAMES[id],
      lights: [
        { cell: { x: 0, y: 2 }, side: 'west' },
        { cell: { x: 0, y: 4 }, side: 'west' },
        { cell: { x: 0, y: 8 }, side: 'west' },
        { cell: { x: 0, y: 10 }, side: 'west' },
        { cell: { x: 4, y: 2 }, side: 'east' },
        { cell: { x: 4, y: 4 }, side: 'east' },
        { cell: { x: 4, y: 8 }, side: 'east' },
        { cell: { x: 4, y: 10 }, side: 'east' }
      ],
      monsters: [],
      openEdges: openRoomEdges(5, 14),
      opening: {
        cell: { x: 2, y: 13 },
        side: 'south'
      },
      playerStart: {
        cell: { x: 2, y: 13 },
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

export function getRuntimeLevelWorldTransform(id) {
  const transform = RUNTIME_LEVEL_WORLD_TRANSFORMS[id]

  return transform
    ? { ...transform }
    : { x: 0, z: 0, rotationY: 0 }
}

export function createAuthoredRuntimeMaze(id) {
  if (!isAuthoredRuntimeLevelId(id)) {
    return null
  }

  const cached = authoredLevelMazeCache.get(id)

  if (cached) {
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
  maze.lightmap = bakeMazeLightmap(maze)
  authoredLevelMazeCache.set(id, maze)

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
