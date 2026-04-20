import { MAZES } from '../data/mazes/index.js'
import {
  bakeMazeLightmap,
  GROUND_Y,
  MAZE_CELL_SIZE,
  MAZE_TARGET_COUNT,
  MAZE_WALL_HEIGHT,
  MAZE_WALL_THICKNESS,
  getMazeSceneLayout
} from './maze.js'

export { GROUND_Y, MAZE_CELL_SIZE }

export const PLAYER_RADIUS = 0.25
export const PLAYER_HEIGHT = 1.75
export const PLAYER_EYE_HEIGHT = 1.5
export const GROUND_SIZE = 200
export const WALL_HEIGHT = MAZE_WALL_HEIGHT
export const WALL_LENGTH = MAZE_CELL_SIZE
export const WALL_WIDTH = MAZE_WALL_THICKNESS
export const SCONCE_RADIUS = 0.125
export const WALL_FACE_OFFSET = (WALL_WIDTH / 2) + SCONCE_RADIUS
export const TORCH_BILLBOARD_SIZE = WALL_FACE_OFFSET
export const TORCH_BASE_CANDELA = 1500
export const PLAYER_SPAWN_POSITION = Object.freeze({
  x: 0,
  y: GROUND_Y + 1,
  z: 0
})

export const AVAILABLE_MAZES = Object.freeze(
  MAZES.map((maze) => Object.freeze(structuredClone(maze)))
)

export const DEFAULT_MAZE_LAYOUT = Object.freeze(
  getMazeSceneLayout(AVAILABLE_MAZES[0], SCONCE_RADIUS)
)

export const MAZE_COUNT = MAZE_TARGET_COUNT

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

            if (x < centerCell.x) {
              side = 'east'
            } else if (x > centerCell.x) {
              side = 'west'
            } else if (y < centerCell.y) {
              side = 'south'
            } else {
              side = 'north'
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
