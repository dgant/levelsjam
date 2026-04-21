import {
  GROUND_Y,
  MAZE_CELL_SIZE,
  MAZE_TARGET_COUNT,
  MAZE_WALL_HEIGHT,
  MAZE_WALL_THICKNESS
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
export const MAZE_COUNT = MAZE_TARGET_COUNT
