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
  bakeMazeLightmap,
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

type MazeModule = {
  default: {
    height: number
    id: string
    lightmap?: unknown
    width: number
  }
}

const mazeModuleLoaders = import.meta.glob<MazeModule>('../data/mazes/maze-*.js')
const mazeModuleEntries = Object.entries(mazeModuleLoaders)
  .map(([path, load]) => {
    const match = path.match(/\/(maze-\d+)\.js$/)

    if (!match) {
      return null
    }

    return {
      id: match[1],
      load
    }
  })
  .filter((entry): entry is { id: string; load: () => Promise<MazeModule> } => Boolean(entry))
  .sort((left, right) => left.id.localeCompare(right.id))

export const AVAILABLE_MAZE_IDS = Object.freeze(
  mazeModuleEntries.map((entry) => entry.id)
)

function buildDebugProbeOcclusionMaze(id: string, options: {
  includeLights?: boolean
  openCenterNorth?: boolean
} = {}) {
  const width = 3
  const height = 3
  const centerCell = { x: 1, y: 1 }
  const openEdges = []

  if (options.openCenterNorth) {
    openEdges.push({
      from: { x: 1, y: 0 },
      to: { x: 1, y: 1 }
    })
  }

  const lights = options.includeLights === false
    ? []
    : (() => {
        const placements = []

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (x === centerCell.x && y === centerCell.y) {
              continue
            }

            let side: 'north' | 'east' | 'south' | 'west' = 'north'

            if (x < centerCell.x) {
              side = 'west'
            } else if (x > centerCell.x) {
              side = 'east'
            } else if (y < centerCell.y) {
              side = 'north'
            } else {
              side = 'south'
            }

            placements.push({
              cell: { x, y },
              side
            })
          }
        }

        return placements
      })()

  const maze = {
    height,
    id,
    lights,
    opening: {
      cell: { x: -1, y: -1 },
      side: 'north'
    },
    openEdges,
    width
  }

  maze.lightmap = bakeMazeLightmap(maze)
  return maze
}

const DEBUG_MAZES = Object.freeze({
  'debug-probe-occlusion-3x3-no-lights': Object.freeze(
    buildDebugProbeOcclusionMaze('debug-probe-occlusion-3x3-no-lights', {
      includeLights: false
    })
  ),
  'debug-probe-occlusion-3x3-open-north': Object.freeze(
    buildDebugProbeOcclusionMaze('debug-probe-occlusion-3x3-open-north', {
      openCenterNorth: true
    })
  ),
  'debug-probe-occlusion-3x3-sealed': Object.freeze(
    buildDebugProbeOcclusionMaze('debug-probe-occlusion-3x3-sealed')
  )
})

export function getDebugMazeLayoutById(id: string): MazeLayout | null {
  const maze = DEBUG_MAZES[id as keyof typeof DEBUG_MAZES]

  if (!maze) {
    return null
  }

  return getMazeSceneLayout(maze, SCONCE_RADIUS) as MazeLayout
}

export async function loadMazeLayoutById(id: string): Promise<MazeLayout | null> {
  const entry = mazeModuleEntries.find((candidate) => candidate.id === id)

  if (!entry) {
    return null
  }

  const imported = await entry.load()
  return getMazeSceneLayout(imported.default, SCONCE_RADIUS) as MazeLayout
}

export async function loadRandomMazeLayout(
  random: () => number = Math.random
): Promise<MazeLayout> {
  const index = Math.floor(random() * mazeModuleEntries.length)
  const entry = mazeModuleEntries[index] ?? mazeModuleEntries[0]

  if (!entry) {
    throw new Error('No persisted mazes are available')
  }

  const imported = await entry.load()
  return getMazeSceneLayout(imported.default, SCONCE_RADIUS) as MazeLayout
}

export function getWallBounds(layout: MazeLayout): WallBounds[] {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}
