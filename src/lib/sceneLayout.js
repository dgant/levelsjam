import { MAZES } from '../data/mazes/index.js'
import {
  bakeMazeLightmap,
  getMazeSceneLayout
} from './maze.js'
import {
  GROUND_Y,
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
  WALL_WIDTH,
  GROUND_SIZE
} from './sceneConstants.js'

export {
  GROUND_Y,
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
  WALL_WIDTH,
  GROUND_SIZE
}

export const AVAILABLE_MAZES = Object.freeze(MAZES.slice())

export const DEFAULT_MAZE_LAYOUT = Object.freeze(
  getMazeSceneLayout(AVAILABLE_MAZES[0], SCONCE_RADIUS)
)

function buildDebugProbeOcclusionMaze(id, options = {}) {
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

            let side = 'north'

            // Keep the sealed center-cell probe honest by mounting each torch
            // on an exterior-facing wall, never on the wall facing the center.
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

export function getRandomMazeLayout(random = Math.random) {
  const index = Math.floor(random() * AVAILABLE_MAZES.length)
  const maze = AVAILABLE_MAZES[index] ?? AVAILABLE_MAZES[0]

  return getMazeSceneLayout(maze, SCONCE_RADIUS)
}

export function getMazeLayoutById(id) {
  const maze = AVAILABLE_MAZES.find((candidate) => candidate.id === id)

  if (!maze) {
    return null
  }

  return getMazeSceneLayout(maze, SCONCE_RADIUS)
}

export function getDebugMazeLayoutById(id) {
  const maze = DEBUG_MAZES[id]

  if (!maze) {
    return null
  }

  return getMazeSceneLayout(maze, SCONCE_RADIUS)
}

export function getWallBounds(layout = DEFAULT_MAZE_LAYOUT) {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}
