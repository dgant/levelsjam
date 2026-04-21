import { MAZES } from '../data/mazes/index.js'
import {
  getMazeSceneLayout
} from './maze.js'
import { getDebugMazeLayoutById } from './debugMazeLayouts.js'
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

export { getDebugMazeLayoutById }

export function getWallBounds(layout = DEFAULT_MAZE_LAYOUT) {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}
