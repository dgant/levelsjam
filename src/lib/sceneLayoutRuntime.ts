import {
  GROUND_Y,
  GROUND_SIZE,
  MAZE_CELL_SIZE,
  MAZE_COUNT,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BASE_CANDELA,
  TORCH_BILLBOARD_SIZE,
  WALL_FACE_OFFSET,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH
} from './sceneConstants.js'
import {
  getMazeSceneLayout
} from './maze.js'
import type { MazeLayout, WallBounds } from './sceneLayout.js'

export {
  GROUND_Y,
  GROUND_SIZE,
  MAZE_CELL_SIZE,
  MAZE_COUNT,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BASE_CANDELA,
  TORCH_BILLBOARD_SIZE,
  WALL_FACE_OFFSET,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH
}

type PersistedMaze = {
  height: number
  id: string
  lightmap?: unknown
  width: number
}

type MazeManifest = {
  mazeIds: string[]
}

const MAZE_DATA_BASE_URL = `${import.meta.env.BASE_URL}maze-data`
const MAZE_MANIFEST_URL = `${MAZE_DATA_BASE_URL}/index.json`
const AVAILABLE_MAZE_IDS: string[] = []
let mazeManifestPromise: Promise<string[]> | null = null
const mazeLayoutPromiseCache = new Map<string, Promise<MazeLayout | null>>()
const loadedDebugMazes = new Map<string, PersistedMaze>()
const DEBUG_MAZE_LOADERS = Object.freeze({
  'debug-probe-occlusion-3x3-no-lights': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-no-lights.js'),
  'debug-probe-occlusion-3x3-open-north': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-open-north.js'),
  'debug-probe-occlusion-3x3-sealed': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-sealed.js')
} satisfies Record<string, () => Promise<{ default: PersistedMaze }>>)

export function resolveMazeDataUrl(relativePath: string) {
  return `${MAZE_DATA_BASE_URL}/${relativePath}`
}

async function loadAvailableMazeIds() {
  if (!mazeManifestPromise) {
    mazeManifestPromise = fetch(MAZE_MANIFEST_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load maze manifest from ${MAZE_MANIFEST_URL}: ${response.status}`
          )
        }

        const manifest = await response.json() as MazeManifest
        const mazeIds = Array.isArray(manifest.mazeIds)
          ? manifest.mazeIds.filter((id): id is string => typeof id === 'string')
          : []

        AVAILABLE_MAZE_IDS.length = 0
        AVAILABLE_MAZE_IDS.push(...mazeIds)
        return [...AVAILABLE_MAZE_IDS]
      })
  }

  return mazeManifestPromise
}

async function loadPersistedMaze(id: string) {
  const loadDebugMaze = DEBUG_MAZE_LOADERS[id]

  if (loadDebugMaze) {
    const module = await loadDebugMaze()
    const maze = module.default

    loadedDebugMazes.set(id, maze)
    return maze
  }

  const response = await fetch(resolveMazeDataUrl(`${id}.json`))

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    throw new Error(
      `Failed to load maze payload ${id}: ${response.status}`
    )
  }

  return await response.json() as PersistedMaze
}

export function getDebugMazeLayoutById(id: string): MazeLayout | null {
  const maze = loadedDebugMazes.get(id)

  return maze
    ? getMazeSceneLayout(maze, SCONCE_RADIUS) as MazeLayout
    : null
}

export async function loadMazeLayoutById(id: string): Promise<MazeLayout | null> {
  const cached = mazeLayoutPromiseCache.get(id)

  if (cached) {
    return cached
  }

  const layoutPromise = (async () => {
    const persistedMaze = await loadPersistedMaze(id)

    if (!persistedMaze) {
      return null
    }

    return getMazeSceneLayout(persistedMaze, SCONCE_RADIUS) as MazeLayout
  })()

  mazeLayoutPromiseCache.set(id, layoutPromise)
  return layoutPromise
}

export async function loadRandomMazeLayout(
  random: () => number = Math.random
): Promise<MazeLayout> {
  const mazeIds = await loadAvailableMazeIds()
  const index = Math.floor(random() * mazeIds.length)
  const mazeId = mazeIds[index] ?? mazeIds[0]

  if (!mazeId) {
    throw new Error('No persisted mazes are available')
  }

  const layout = await loadMazeLayoutById(mazeId)

  if (!layout) {
    throw new Error(`Failed to load persisted maze ${mazeId}`)
  }

  return layout
}

export function getWallBounds(layout: MazeLayout): WallBounds[] {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}
