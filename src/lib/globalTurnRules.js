import { getRuntimeLevelWorldTransform } from './levels.js'
import { MAZE_CELL_SIZE } from './maze.js'
import { createInitialTurnState } from './turnRules.js'
import {
  buildWorldGridFromLayouts,
  getLevelLocalCellForWorldCell,
  localCellToWorldCell
} from './worldGrid.js'

const DIRECTIONS_TO_YAW = {
  east: -Math.PI / 2,
  north: 0,
  south: Math.PI,
  west: Math.PI / 2
}

function normalizeAngleRadians(value) {
  return Math.atan2(Math.sin(value), Math.cos(value))
}

function yawToDirection(yaw) {
  const normalized = normalizeAngleRadians(yaw)
  const candidates = [
    { direction: 'north', yaw: 0 },
    { direction: 'east', yaw: -Math.PI / 2 },
    { direction: 'south', yaw: Math.PI },
    { direction: 'west', yaw: Math.PI / 2 }
  ]

  return candidates.reduce((best, candidate) => {
    const bestDistance = Math.abs(normalizeAngleRadians(normalized - best.yaw))
    const candidateDistance = Math.abs(normalizeAngleRadians(normalized - candidate.yaw))

    return candidateDistance < bestDistance ? candidate : best
  }).direction
}

function directionToYaw(direction) {
  return DIRECTIONS_TO_YAW[direction] ?? 0
}

function cloneCell(cell) {
  return { x: cell.x, y: cell.y }
}

function getMazeCellLocalCenter(maze, cell) {
  return {
    x: -((maze.width * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.x * MAZE_CELL_SIZE),
    z: -((maze.height * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.y * MAZE_CELL_SIZE)
  }
}

function transformLocalPointToWorld(point, transform) {
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return {
    x: transform.x + (point.x * cos) + (point.z * sin),
    z: transform.z - (point.x * sin) + (point.z * cos)
  }
}

function transformWorldPointToLocal(point, transform) {
  const dx = point.x - transform.x
  const dz = point.z - transform.z
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return {
    x: (dx * cos) - (dz * sin),
    z: (dx * sin) + (dz * cos)
  }
}

function getLocalCellFromLevelLocalPoint(maze, point) {
  return {
    x: Math.round((point.x + ((maze.width * MAZE_CELL_SIZE) / 2) - (MAZE_CELL_SIZE / 2)) / MAZE_CELL_SIZE),
    y: Math.round((point.z + ((maze.height * MAZE_CELL_SIZE) / 2) - (MAZE_CELL_SIZE / 2)) / MAZE_CELL_SIZE)
  }
}

function mapLocalCellBetweenLevels(sourceMaze, sourceTransform, targetMaze, targetTransform, cell) {
  const sourceLocalCenter = getMazeCellLocalCenter(sourceMaze, cell)
  const worldCenter = transformLocalPointToWorld(sourceLocalCenter, sourceTransform)
  const targetLocalCenter = transformWorldPointToLocal(worldCenter, targetTransform)

  return getLocalCellFromLevelLocalPoint(targetMaze, targetLocalCenter)
}

function cloneMonster(monster) {
  return {
    ...monster,
    cell: cloneCell(monster.cell),
    lastPath: [...(monster.lastPath ?? [])]
  }
}

export function cloneTurnStateForGlobal(state) {
  return {
    ...state,
    checkpoint: {
      cell: cloneCell(state.checkpoint.cell),
      direction: state.checkpoint.direction
    },
    monsters: state.monsters.map(cloneMonster),
    player: {
      ...state.player,
      cell: cloneCell(state.player.cell)
    }
  }
}

function cloneGlobalState(state) {
  return {
    ...state,
    checkpoint: {
      cell: cloneCell(state.checkpoint.cell),
      direction: state.checkpoint.direction,
      levelId: state.checkpoint.levelId
    },
    levelStates: Object.fromEntries(
      Object.entries(state.levelStates).map(([levelId, levelState]) => [
        levelId,
        cloneTurnStateForGlobal(levelState)
      ])
    ),
    player: {
      ...state.player,
      cell: cloneCell(state.player.cell),
      levelId: state.player.levelId
    }
  }
}

export function findIngressCellForGlobalTransition(targetMaze, sourceLevelId) {
  const reverseExit = Array.isArray(targetMaze.levelExits)
    ? targetMaze.levelExits.find((exit) => exit.targetLevelId === sourceLevelId)
    : null

  return {
    ...(reverseExit?.cell ?? targetMaze.playerStart?.cell ?? targetMaze.opening.cell)
  }
}

export function createInitialGlobalTurnState(activeLayout, additionalLayouts = []) {
  const activeTurnState = createInitialTurnState(activeLayout.maze)
  const globalState = {
    activeLevelId: activeLayout.maze.id,
    checkpoint: {
      cell: cloneCell(activeTurnState.checkpoint.cell),
      direction: activeTurnState.checkpoint.direction,
      levelId: activeLayout.maze.id
    },
    dead: activeTurnState.dead,
    escaped: activeTurnState.escaped,
    levelStates: {
      [activeLayout.maze.id]: cloneTurnStateForGlobal(activeTurnState)
    },
    player: {
      ...activeTurnState.player,
      cell: cloneCell(activeTurnState.player.cell),
      levelId: activeLayout.maze.id
    },
    turn: activeTurnState.turn
  }

  return ensureGlobalTurnStateLevels(globalState, additionalLayouts)
}

export function ensureGlobalTurnStateLevel(state, layout) {
  if (state.levelStates[layout.maze.id]) {
    return state
  }

  const next = cloneGlobalState(state)

  next.levelStates[layout.maze.id] = createInitialTurnState(layout.maze)
  return next
}

export function ensureGlobalTurnStateLevels(state, layouts) {
  return layouts.reduce(
    (current, layout) => ensureGlobalTurnStateLevel(current, layout),
    state
  )
}

export function getGlobalTurnStateForLevel(state, levelId, maze) {
  const storedState = state.levelStates[levelId] ?? createInitialTurnState(maze)
  const renderedState = cloneTurnStateForGlobal(storedState)

  if (levelId !== state.activeLevelId) {
    return renderedState
  }

  renderedState.dead = state.dead
  renderedState.escaped = state.escaped
  renderedState.player = {
    cell: cloneCell(state.player.cell),
    direction: state.player.direction,
    hasSword: state.player.hasSword,
    hasTrophy: state.player.hasTrophy
  }
  renderedState.turn = state.turn

  if (state.checkpoint.levelId === levelId) {
    renderedState.checkpoint = {
      cell: cloneCell(state.checkpoint.cell),
      direction: state.checkpoint.direction
    }
  }

  return renderedState
}

export function replaceGlobalTurnStateForLevel(state, levelId, turnState) {
  const next = cloneGlobalState(state)
  const storedState = cloneTurnStateForGlobal(turnState)

  next.levelStates[levelId] = storedState

  if (levelId === next.activeLevelId) {
    next.dead = storedState.dead
    next.escaped = storedState.escaped
    next.player = {
      ...storedState.player,
      cell: cloneCell(storedState.player.cell),
      levelId
    }
    next.turn = storedState.turn
    next.checkpoint = {
      cell: cloneCell(storedState.checkpoint.cell),
      direction: storedState.checkpoint.direction,
      levelId
    }
  }

  return next
}

export function resetGlobalTurnStateLevel(state, layout) {
  const next = cloneGlobalState(state)
  const resetState = createInitialTurnState(layout.maze)

  next.levelStates[layout.maze.id] = resetState

  if (layout.maze.id === next.activeLevelId) {
    next.dead = resetState.dead
    next.escaped = resetState.escaped
    next.player = {
      ...resetState.player,
      cell: cloneCell(resetState.player.cell),
      levelId: layout.maze.id
    }
    next.turn = resetState.turn
    next.checkpoint = {
      cell: cloneCell(resetState.checkpoint.cell),
      direction: resetState.checkpoint.direction,
      levelId: layout.maze.id
    }
  }

  return next
}

export function activateGlobalTurnStateLevel(state, layout) {
  const ensuredState = ensureGlobalTurnStateLevel(state, layout)
  const next = cloneGlobalState(ensuredState)
  const activeLevelState = next.levelStates[layout.maze.id]

  next.activeLevelId = layout.maze.id
  next.dead = activeLevelState.dead
  next.escaped = activeLevelState.escaped
  next.player = {
    ...activeLevelState.player,
    cell: cloneCell(activeLevelState.player.cell),
    levelId: layout.maze.id
  }
  next.turn = activeLevelState.turn
  next.checkpoint = {
    cell: cloneCell(activeLevelState.checkpoint.cell),
    direction: activeLevelState.checkpoint.direction,
    levelId: layout.maze.id
  }

  return next
}

export function transitionGlobalTurnState({
  sourceLevelId,
  sourcePreviousState,
  sourceState,
  sourceLayout,
  targetLayout,
  state
}) {
  const ensuredState = ensureGlobalTurnStateLevel(state, targetLayout)
  const next = cloneGlobalState(ensuredState)
  const targetLevelId = targetLayout.maze.id
  const sourceTransform = getRuntimeLevelWorldTransform(sourceLevelId)
  const targetTransform = getRuntimeLevelWorldTransform(targetLevelId)
  const sourceWorldYaw =
    directionToYaw(sourceState.player.direction) + sourceTransform.rotationY
  const targetLocalYaw = sourceWorldYaw - targetTransform.rotationY
  const sourceMaze = sourceLayout?.maze ?? null
  const sourceStoredState = cloneTurnStateForGlobal(sourcePreviousState ?? sourceState)
  const targetStoredState = cloneTurnStateForGlobal(next.levelStates[targetLevelId])
  const sourceWorldCell = sourceLayout
    ? localCellToWorldCell(sourceLayout, sourceState.player.cell)
    : null
  const canonicalTargetCell = sourceWorldCell && sourceLayout
    ? getLevelLocalCellForWorldCell(
        buildWorldGridFromLayouts([sourceLayout, targetLayout]),
        targetLevelId,
        sourceWorldCell
      )
    : null
  const targetPlayer = {
    cell: canonicalTargetCell ?? (
      sourceMaze
        ? mapLocalCellBetweenLevels(
          sourceMaze,
          sourceTransform,
          targetLayout.maze,
          targetTransform,
          sourceState.player.cell
        )
        : findIngressCellForGlobalTransition(targetLayout.maze, sourceLevelId)
    ),
    direction: yawToDirection(targetLocalYaw),
    hasSword: sourceState.player.hasSword,
    hasTrophy: sourceState.player.hasTrophy
  }

  sourceStoredState.player.hasSword = sourceState.player.hasSword
  sourceStoredState.player.hasTrophy = sourceState.player.hasTrophy
  sourceStoredState.turn = Math.max(sourceStoredState.turn, sourceState.turn)
  next.levelStates[sourceLevelId] = sourceStoredState

  targetStoredState.dead = false
  targetStoredState.escaped = false
  targetStoredState.player = { ...targetPlayer, cell: cloneCell(targetPlayer.cell) }
  targetStoredState.turn = Math.max(targetStoredState.turn, sourceState.turn)
  next.levelStates[targetLevelId] = targetStoredState

  next.activeLevelId = targetLevelId
  next.dead = false
  next.escaped = false
  next.player = {
    ...targetPlayer,
    cell: cloneCell(targetPlayer.cell),
    levelId: targetLevelId
  }
  next.turn = targetStoredState.turn
  next.checkpoint = {
    cell: cloneCell(targetStoredState.checkpoint.cell),
    direction: targetStoredState.checkpoint.direction,
    levelId: targetLevelId
  }

  return next
}
