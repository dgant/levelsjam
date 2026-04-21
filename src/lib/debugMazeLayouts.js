import {
  getMazeSceneLayout
} from './maze.js'
import { SCONCE_RADIUS } from './sceneConstants.js'
import { DEBUG_MAZES } from '../data/debug-mazes/index.js'

const DEBUG_MAZES_BY_ID = Object.freeze(
  Object.fromEntries(DEBUG_MAZES.map((maze) => [maze.id, Object.freeze(maze)]))
)

export function getDebugMazeLayoutById(id) {
  const maze = DEBUG_MAZES_BY_ID[id]

  if (!maze) {
    return null
  }

  return getMazeSceneLayout(maze, SCONCE_RADIUS)
}
