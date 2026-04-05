import { MAZES } from '../data/mazes/index.js'
import {
  GROUND_Y,
  MAZE_CELL_SIZE,
  MAZE_TARGET_COUNT,
  MAZE_WALL_HEIGHT,
  MAZE_WALL_THICKNESS,
  getMazeSceneLayout
} from './maze.js'

export { GROUND_Y }

export const PLAYER_RADIUS = 0.25
export const PLAYER_HEIGHT = 1.75
export const PLAYER_EYE_HEIGHT = 1.5
export const GROUND_SIZE = 200
export const WALL_HEIGHT = MAZE_WALL_HEIGHT
export const WALL_LENGTH = MAZE_CELL_SIZE
export const WALL_WIDTH = MAZE_WALL_THICKNESS
export const SCONCE_RADIUS = 0.125
export const TORCH_BILLBOARD_SIZE = 0.5
export const TORCH_BASE_CANDELA = 1500
export const WALL_FACE_OFFSET = (WALL_WIDTH / 2) + SCONCE_RADIUS
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

export function getWallBounds(layout = DEFAULT_MAZE_LAYOUT) {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}
