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
import {
  createAuthoredRuntimeMaze,
  getAuthoredRuntimeLevelIds,
  getStoryMazeParentLevelId,
  isAuthoredRuntimeLevelId
} from './levels.js'
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
  cells?: Array<{ x: number; y: number }>
  height: number
  id: string
  isAuthoredLevel?: boolean
  levelExits?: Array<{
    cell: { x: number; y: number }
    side: 'north' | 'east' | 'south' | 'west'
    targetLevelId?: string
  }>
  levelConnections?: Array<{
    cell: { x: number; y: number }
    side: 'north' | 'east' | 'south' | 'west'
    targetLevelId?: string
  }>
  exteriorOpenings?: Array<{
    cell: { x: number; y: number }
    side: 'north' | 'east' | 'south' | 'west'
  }>
  lightmap?: unknown
  opening?: {
    cell: { x: number; y: number }
    side: 'north' | 'east' | 'south' | 'west'
  }
  width: number
}

type MazeManifest = {
  challengeMazeIds?: string[]
  challenges?: Array<{
    description?: string
    id: string
    name: string
  }>
  mazeIds: string[]
  storyMazeIds?: string[]
}

const MAZE_DATA_BASE_URL = `${import.meta.env.BASE_URL}maze-data`
const MAZE_MANIFEST_URL = `${MAZE_DATA_BASE_URL}/index.json`
const DEV_BYPASS_MAZE_LAYOUT_CACHE = import.meta.env.DEV
const AVAILABLE_MAZE_IDS: string[] = []
let mazeManifestPromise: Promise<MazeManifest> | null = null
const mazeLayoutPromiseCache = new Map<string, Promise<MazeLayout | null>>()
const mazeLayoutCache = new Map<string, MazeLayout>()
const loadedDebugMazes = new Map<string, PersistedMaze>()
const DEBUG_MAZE_LOADERS = Object.freeze({
  'debug-probe-occlusion-3x3-no-lights': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-no-lights.js'),
  'debug-probe-occlusion-3x3-open-north': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-open-north.js'),
  'debug-probe-occlusion-3x3-sealed': () => import('../data/debug-mazes/debug-probe-occlusion-3x3-sealed.js')
} satisfies Record<string, () => Promise<{ default: PersistedMaze }>>)
const STORY_MAZE_LOADERS = Object.freeze({
  'werewolf-tutorial': () => import('../data/challenge-mazes/keepers/werewolf-tutorial.js')
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
        AVAILABLE_MAZE_IDS.push(...Array.from(new Set([
          ...getAuthoredRuntimeLevelIds(),
          ...mazeIds
        ])))
        return {
          ...manifest,
          mazeIds: [...AVAILABLE_MAZE_IDS]
        }
      })
  }

  return (await mazeManifestPromise).mazeIds
}

export async function getAvailableMazeIds() {
  return loadAvailableMazeIds()
}

export async function getRuntimeLevelMenuEntries() {
  if (!mazeManifestPromise) {
    await loadAvailableMazeIds()
  }

  const manifest = await mazeManifestPromise

  return (manifest?.challenges ?? [])
    .filter((entry) => (
      typeof entry?.id === 'string' &&
      typeof entry?.name === 'string'
    ))
    .map((entry) => ({
      description: entry.description ?? '',
      name: entry.name,
      runtimeLevelId: entry.id
    }))
}

async function loadPersistedMaze(id: string) {
  const loadDebugMaze = DEBUG_MAZE_LOADERS[id]

  if (loadDebugMaze) {
    const module = await loadDebugMaze()
    const maze = module.default

    loadedDebugMazes.set(id, maze)
    return maze
  }

  const response = await fetch(resolveMazeDataUrl(`${id}.json`), {
    cache: import.meta.env.DEV ? 'no-store' : 'default'
  })

  if (!response.ok) {
    if (response.status === 404) {
      const loadStoryMaze = STORY_MAZE_LOADERS[id]

      if (loadStoryMaze) {
        const module = await loadStoryMaze()

        return module.default
      }

      if (isAuthoredRuntimeLevelId(id)) {
        return (await createAuthoredRuntimeMaze(id)) as PersistedMaze | null
      }

      return null
    }

    throw new Error(
      `Failed to load maze payload ${id}: ${response.status}`
    )
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  if (contentType.includes('text/html')) {
    return null
  }

  try {
    return await response.json() as PersistedMaze
  } catch {
    return null
  }
}

function withRuntimeLevelExits(maze: PersistedMaze) {
  const storyParentLevelId = getStoryMazeParentLevelId(maze.id)

  if (storyParentLevelId && maze.opening) {
    return {
      ...maze,
      exteriorOpenings: [
        {
          cell: { ...maze.opening.cell },
          side: maze.opening.side
        }
      ],
      exitRequiresTrophy: false,
      levelExits: [
        ...(maze.levelExits ?? []).filter((exit) => exit.targetLevelId !== storyParentLevelId),
        {
          cell: { ...maze.opening.cell },
          side: maze.opening.side,
          targetLevelId: storyParentLevelId
        }
      ]
    }
  }

  if (
    !maze.id.match(/^maze-\d{3}$/) ||
    !maze.opening ||
    maze.levelExits?.some((exit) => exit.targetLevelId === 'chamber-1')
  ) {
    return maze
  }

  return {
    ...maze,
    exitRequiresTrophy: false,
    levelExits: [
      ...(maze.levelExits ?? []),
      {
        cell: { ...maze.opening.cell },
        side: maze.opening.side,
        targetLevelId: 'chamber-1'
      }
    ]
  }
}

export function getDebugMazeLayoutById(id: string): MazeLayout | null {
  const maze = loadedDebugMazes.get(id)

  return maze
    ? getMazeSceneLayout(maze, SCONCE_RADIUS) as MazeLayout
    : null
}

export async function loadMazeLayoutById(id: string): Promise<MazeLayout | null> {
  if (DEV_BYPASS_MAZE_LAYOUT_CACHE) {
    mazeLayoutPromiseCache.delete(id)
    mazeLayoutCache.delete(id)
  }

  const cachedLayout = mazeLayoutCache.get(id)

  if (cachedLayout) {
    return cachedLayout
  }

  const cached = mazeLayoutPromiseCache.get(id)

  if (cached) {
    return cached
  }

  const layoutPromise = (async () => {
    const persistedMaze = await loadPersistedMaze(id)

    if (!persistedMaze) {
      return null
    }

    const layout = getMazeSceneLayout(withRuntimeLevelExits(persistedMaze), SCONCE_RADIUS) as MazeLayout

    mazeLayoutCache.set(id, layout)
    return layout
  })()

  mazeLayoutPromiseCache.set(id, layoutPromise)
  return layoutPromise
}

export function unloadMazeLayoutById(id: string) {
  mazeLayoutPromiseCache.delete(id)
  mazeLayoutCache.delete(id)
  loadedDebugMazes.delete(id)
}

export function clearMazeLayoutCache() {
  for (const id of [
    ...mazeLayoutPromiseCache.keys(),
    ...mazeLayoutCache.keys(),
    ...loadedDebugMazes.keys()
  ]) {
    unloadMazeLayoutById(id)
  }

  AVAILABLE_MAZE_IDS.length = 0
  mazeManifestPromise = null
}

export function getLoadedMazeLayoutIds() {
  return Array.from(mazeLayoutCache.keys()).sort()
}

export async function loadRandomMazeLayout(
  random: () => number = Math.random
): Promise<MazeLayout> {
  const mazeIds = (await loadAvailableMazeIds())
    .filter((id) => !isAuthoredRuntimeLevelId(id))
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
