import {
  applyEntryTurn,
  applyMonsterTurn,
  applyTurnAction,
  createInitialTurnState
} from './turnRules.js'
import {
  buildWorldGridFromLayouts,
  createWorldRulesMaze,
  getLevelLocalCellForWorldCell,
  getLocalDirectionForWorldDirection,
  getWorldCellOwner,
  getWorldDirectionForLocalDirection,
  localCellToWorldCell
} from './worldGrid.js'

function cloneCell(cell) {
  return { x: cell.x, y: cell.y }
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
    itemStates: { ...(state.itemStates ?? {}) },
    monsters: state.monsters.map(cloneMonster),
    player: {
      ...state.player,
      cell: cloneCell(state.player.cell)
    }
  }
}

function cloneLayoutRegistry(layouts) {
  return Object.fromEntries(Object.entries(layouts ?? {}))
}

function getRegisteredLayouts(state, extraLayouts = []) {
  const layoutsById = new Map(
    Object.values(state?.levelLayouts ?? {}).map((layout) => [layout.maze.id, layout])
  )

  for (const layout of extraLayouts) {
    if (layout?.maze?.id) {
      layoutsById.set(layout.maze.id, layout)
    }
  }

  return Array.from(layoutsById.values())
}

function cloneGlobalState(state) {
  return {
    ...state,
    checkpoint: {
      cell: cloneCell(state.checkpoint.cell),
      direction: state.checkpoint.direction,
      levelId: state.checkpoint.levelId
    },
    levelLayouts: cloneLayoutRegistry(state.levelLayouts),
    player: {
      ...state.player,
      cell: cloneCell(state.player.cell)
    },
    worldTurnState: cloneTurnStateForGlobal(state.worldTurnState)
  }
}

function createWorldTurnState(layouts, activeLayout) {
  const worldGrid = buildWorldGridFromLayouts(layouts)
  const activeInitialState = createInitialTurnState(activeLayout.maze)
  const activeWorldCell = localCellToWorldCell(activeLayout, activeInitialState.player.cell)
  const activeWorldDirection = getWorldDirectionForLocalDirection(
    activeLayout,
    activeInitialState.player.cell,
    activeInitialState.player.direction
  )
  const worldMaze = createWorldRulesMaze(worldGrid, {
    playerStart: {
      cell: activeWorldCell,
      direction: activeWorldDirection
    }
  })
  const worldTurnState = createInitialTurnState(worldMaze)

  worldTurnState.player.cell = cloneCell(activeWorldCell)
  worldTurnState.player.direction = activeWorldDirection
  worldTurnState.checkpoint = {
    cell: cloneCell(activeWorldCell),
    direction: activeWorldDirection
  }

  return worldTurnState
}

function syncTopLevelState(next, levelId = next.activeLevelId) {
  next.dead = next.worldTurnState.dead
  next.escaped = next.worldTurnState.escaped
  next.turn = next.worldTurnState.turn
  next.player = {
    ...next.worldTurnState.player,
    cell: cloneCell(next.worldTurnState.player.cell),
    levelId
  }
  next.checkpoint = {
    cell: cloneCell(next.worldTurnState.checkpoint.cell),
    direction: next.worldTurnState.checkpoint.direction,
    levelId: next.checkpoint?.levelId ?? levelId
  }
  return next
}

function withWorldTurnState(state, worldTurnState) {
  return {
    ...state,
    worldTurnState: cloneTurnStateForGlobal(worldTurnState)
  }
}

function getLayoutForLevel(state, levelId, maze) {
  return state.levelLayouts[levelId] ?? { maze }
}

function projectWorldTurnStateToLevel(state, levelId, maze) {
  const layout = getLayoutForLevel(state, levelId, maze)
  const worldGrid = buildWorldGridFromLayouts(getRegisteredLayouts(state, [layout]))
  const projected = createInitialTurnState(maze)
  const localPlayerCell = getLevelLocalCellForWorldCell(
    worldGrid,
    levelId,
    state.worldTurnState.player.cell
  )

  projected.dead = state.worldTurnState.dead
  projected.escaped = state.worldTurnState.escaped
  projected.turn = state.worldTurnState.turn
  projected.player = {
    cell: localPlayerCell ?? cloneCell(projected.player.cell),
    direction: localPlayerCell
      ? getLocalDirectionForWorldDirection(
          layout,
          localPlayerCell,
          state.worldTurnState.player.direction
        )
      : projected.player.direction,
    hasSword: state.worldTurnState.player.hasSword,
    hasTrophy: state.worldTurnState.player.hasTrophy
  }

  projected.monsters = state.worldTurnState.monsters
    .filter((monster) => monster.ownerLevelId === levelId)
    .map((monster) => {
      const localCell = getLevelLocalCellForWorldCell(worldGrid, levelId, monster.cell)

      return {
        ...monster,
        cell: localCell ?? cloneCell(monster.cell),
        direction: localCell
          ? getLocalDirectionForWorldDirection(layout, localCell, monster.direction)
          : monster.direction,
        id: String(monster.id).startsWith(`${levelId}:`)
          ? String(monster.id).slice(levelId.length + 1)
          : monster.id,
        lastPath: [...(monster.lastPath ?? [])],
        lastSeenDirection: monster.lastSeenDirection && localCell
          ? getLocalDirectionForWorldDirection(layout, localCell, monster.lastSeenDirection)
          : monster.lastSeenDirection
      }
    })

  projected.itemStates = Object.fromEntries(
    Object.entries(state.worldTurnState.itemStates ?? {})
      .filter(([itemId]) => itemId.startsWith(`${levelId}:`))
      .map(([itemId, itemState]) => [itemId.slice(levelId.length + 1), itemState])
  )
  projected.swordState = state.worldTurnState.itemStates?.[`${levelId}:sword`] ?? 'consumed'
  projected.trophyState = state.worldTurnState.itemStates?.[`${levelId}:trophy`] ?? 'consumed'

  const localCheckpointCell = getLevelLocalCellForWorldCell(
    worldGrid,
    levelId,
    state.worldTurnState.checkpoint.cell
  )

  if (localCheckpointCell) {
    projected.checkpoint = {
      cell: localCheckpointCell,
      direction: getLocalDirectionForWorldDirection(
        layout,
        localCheckpointCell,
        state.worldTurnState.checkpoint.direction
      )
    }
  }

  return projected
}

function applyLocalProjectionToWorld(state, levelId, turnState, maze) {
  const next = cloneGlobalState(state)
  const layout = getLayoutForLevel(next, levelId, maze)
  const worldGrid = buildWorldGridFromLayouts(getRegisteredLayouts(next, [layout]))
  const localPlayerCell = turnState.player.cell
  const worldPlayerCell = localCellToWorldCell(layout, localPlayerCell)
  const worldPlayerDirection = getWorldDirectionForLocalDirection(
    layout,
    localPlayerCell,
    turnState.player.direction
  )

  next.activeLevelId = levelId
  next.worldTurnState.dead = turnState.dead
  next.worldTurnState.escaped = turnState.escaped
  next.worldTurnState.turn = turnState.turn
  next.worldTurnState.player = {
    ...next.worldTurnState.player,
    cell: worldPlayerCell,
    direction: worldPlayerDirection,
    hasSword: turnState.player.hasSword,
    hasTrophy: turnState.player.hasTrophy
  }
  next.worldTurnState.checkpoint = {
    cell: localCellToWorldCell(layout, turnState.checkpoint.cell),
    direction: getWorldDirectionForLocalDirection(
      layout,
      turnState.checkpoint.cell,
      turnState.checkpoint.direction
    )
  }
  next.worldTurnState.itemStates = {
    ...(next.worldTurnState.itemStates ?? {}),
    [`${levelId}:sword`]: turnState.swordState,
    [`${levelId}:trophy`]: turnState.trophyState
  }

  const localMonsterById = new Map(turnState.monsters.map((monster) => [monster.id, monster]))

  next.worldTurnState.monsters = next.worldTurnState.monsters.map((monster) => {
    if (monster.ownerLevelId !== levelId) {
      return monster
    }

    const localId = String(monster.id).startsWith(`${levelId}:`)
      ? String(monster.id).slice(levelId.length + 1)
      : monster.id
    const localMonster = localMonsterById.get(localId) ?? localMonsterById.get(monster.id)

    if (!localMonster) {
      return monster
    }

    const worldCell = localCellToWorldCell(layout, localMonster.cell)

    return {
      ...monster,
      ...localMonster,
      cell: worldCell,
      direction: getWorldDirectionForLocalDirection(
        layout,
        localMonster.cell,
        localMonster.direction
      ),
      id: monster.id,
      lastPath: [...(localMonster.lastPath ?? [])],
      lastSeenDirection: localMonster.lastSeenDirection
        ? getWorldDirectionForLocalDirection(
            layout,
            localMonster.cell,
            localMonster.lastSeenDirection
          )
        : localMonster.lastSeenDirection,
      ownerLevelId: levelId
    }
  })

  return syncTopLevelState(next, levelId)
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
  const layouts = [activeLayout, ...additionalLayouts]
    .filter((layout, index, all) => (
      layout?.maze?.id &&
      all.findIndex((candidate) => candidate?.maze?.id === layout.maze.id) === index
    ))
  const worldTurnState = createWorldTurnState(layouts, activeLayout)
  const globalState = {
    activeLevelId: activeLayout.maze.id,
    checkpoint: {
      cell: cloneCell(worldTurnState.checkpoint.cell),
      direction: worldTurnState.checkpoint.direction,
      levelId: activeLayout.maze.id
    },
    dead: worldTurnState.dead,
    escaped: worldTurnState.escaped,
    levelLayouts: Object.fromEntries(layouts.map((layout) => [layout.maze.id, layout])),
    player: {
      ...worldTurnState.player,
      cell: cloneCell(worldTurnState.player.cell),
      levelId: activeLayout.maze.id
    },
    turn: worldTurnState.turn,
    worldTurnState
  }

  return syncTopLevelState(globalState, activeLayout.maze.id)
}

export function applyGlobalMonsterTurn(state) {
  const layouts = getRegisteredLayouts(state)
  const worldGrid = buildWorldGridFromLayouts(layouts)
  const worldMaze = createWorldRulesMaze(worldGrid, {
    playerStart: {
      cell: state.worldTurnState.player.cell,
      direction: state.worldTurnState.player.direction
    }
  })
  const result = applyMonsterTurn(worldMaze, state.worldTurnState)
  const next = cloneGlobalState(state)

  next.worldTurnState = cloneTurnStateForGlobal(result.state)
  return {
    outcome: {
      ...result,
      previous: cloneTurnStateForGlobal(result.previous),
      state: cloneTurnStateForGlobal(result.state)
    },
    state: syncTopLevelState(next)
  }
}

export function applyGlobalEntryTurn(state) {
  const layouts = getRegisteredLayouts(state)
  const worldGrid = buildWorldGridFromLayouts(layouts)
  const worldMaze = createWorldRulesMaze(worldGrid, {
    playerStart: {
      cell: state.worldTurnState.player.cell,
      direction: state.worldTurnState.player.direction
    }
  })
  const result = applyEntryTurn(worldMaze, state.worldTurnState)
  const next = cloneGlobalState(state)

  next.worldTurnState = cloneTurnStateForGlobal(result.state)
  return {
    outcome: {
      ...result,
      previous: cloneTurnStateForGlobal(result.previous),
      state: cloneTurnStateForGlobal(result.state)
    },
    state: syncTopLevelState(next)
  }
}

export function createEnteredGlobalTurnState(activeLayout, additionalLayouts = []) {
  const initialState = createInitialGlobalTurnState(activeLayout, additionalLayouts)

  return applyGlobalEntryTurn(initialState).state
}

export const createChallengeGlobalTurnState = createEnteredGlobalTurnState

export function ensureGlobalTurnStateLevel(state, layout) {
  if (state.levelLayouts?.[layout.maze.id]) {
    return state
  }

  const next = cloneGlobalState(state)
  const layouts = getRegisteredLayouts(next, [layout])
  const previousWorldTurnState = next.worldTurnState
  const rebuiltWorldTurnState = createWorldTurnState(layouts, getLayoutForLevel(next, next.activeLevelId, layout.maze))
  const existingMonsterIds = new Set(previousWorldTurnState.monsters.map((monster) => monster.id))

  rebuiltWorldTurnState.player = {
    ...previousWorldTurnState.player,
    cell: cloneCell(previousWorldTurnState.player.cell)
  }
  rebuiltWorldTurnState.checkpoint = {
    cell: cloneCell(previousWorldTurnState.checkpoint.cell),
    direction: previousWorldTurnState.checkpoint.direction
  }
  rebuiltWorldTurnState.dead = previousWorldTurnState.dead
  rebuiltWorldTurnState.escaped = previousWorldTurnState.escaped
  rebuiltWorldTurnState.turn = previousWorldTurnState.turn
  rebuiltWorldTurnState.itemStates = {
    ...(rebuiltWorldTurnState.itemStates ?? {}),
    ...(previousWorldTurnState.itemStates ?? {})
  }
  rebuiltWorldTurnState.monsters = [
    ...previousWorldTurnState.monsters,
    ...rebuiltWorldTurnState.monsters.filter((monster) => !existingMonsterIds.has(monster.id))
  ]

  next.levelLayouts[layout.maze.id] = layout
  next.worldTurnState = rebuiltWorldTurnState
  return syncTopLevelState(next)
}

export function ensureGlobalTurnStateLevels(state, layouts) {
  return layouts.reduce(
    (current, layout) => ensureGlobalTurnStateLevel(current, layout),
    state
  )
}

export function getGlobalTurnStateForLevel(state, levelId, maze) {
  return projectWorldTurnStateToLevel(state, levelId, maze)
}

export function replaceGlobalTurnStateForLevel(state, levelId, turnState) {
  return applyLocalProjectionToWorld(state, levelId, turnState, getLayoutForLevel(state, levelId, null).maze)
}

export function resetGlobalTurnStateLevel(state, layout) {
  const next = cloneGlobalState(ensureGlobalTurnStateLevel(state, layout))
  const resetState = createInitialTurnState(createWorldRulesMaze(
    buildWorldGridFromLayouts(getRegisteredLayouts(next)),
    {
      playerStart: {
        cell: localCellToWorldCell(layout, createInitialTurnState(layout.maze).player.cell),
        direction: getWorldDirectionForLocalDirection(
          layout,
          createInitialTurnState(layout.maze).player.cell,
          createInitialTurnState(layout.maze).player.direction
        )
      }
    }
  ))
  const ownerPrefix = `${layout.maze.id}:`
  const resetItemStates = Object.fromEntries(
    Object.entries(resetState.itemStates ?? {}).filter(([itemId]) => itemId.startsWith(ownerPrefix))
  )

  next.worldTurnState.monsters = [
    ...next.worldTurnState.monsters.filter((monster) => monster.ownerLevelId !== layout.maze.id),
    ...resetState.monsters.filter((monster) => monster.ownerLevelId === layout.maze.id)
  ]
  next.worldTurnState.itemStates = {
    ...(next.worldTurnState.itemStates ?? {}),
    ...resetItemStates
  }

  if (layout.maze.id === next.activeLevelId) {
    const localInitialState = createInitialTurnState(layout.maze)

    return applyLocalProjectionToWorld(next, layout.maze.id, localInitialState, layout.maze)
  }

  return syncTopLevelState(next)
}

export function resetGlobalTurnStateAllLevels(state) {
  return getRegisteredLayouts(state).reduce(
    (next, layout) => resetGlobalTurnStateLevel(next, layout),
    state
  )
}

export function activateGlobalTurnStateLevel(state, layout) {
  const ensuredState = ensureGlobalTurnStateLevel(state, layout)
  const next = cloneGlobalState(ensuredState)

  next.activeLevelId = layout.maze.id
  return syncTopLevelState(next, layout.maze.id)
}

export function transitionGlobalTurnState({
  sourceLevelId,
  sourceState,
  targetLayout,
  state
}) {
  const stateWithSource = sourceState
    ? replaceGlobalTurnStateForLevel(
        ensureGlobalTurnStateLevel(state, targetLayout),
        sourceLevelId,
        sourceState
      )
    : ensureGlobalTurnStateLevel(state, targetLayout)
  const next = cloneGlobalState(stateWithSource)

  next.activeLevelId = targetLayout.maze.id
  return syncTopLevelState(next, targetLayout.maze.id)
}

export function applyGlobalTurnAction(state, action) {
  const layouts = getRegisteredLayouts(state)
  const worldGrid = buildWorldGridFromLayouts(layouts)
  const worldMaze = createWorldRulesMaze(worldGrid, {
    playerStart: {
      cell: state.worldTurnState.player.cell,
      direction: state.worldTurnState.player.direction
    }
  })
  const result = applyTurnAction(worldMaze, state.worldTurnState, action)
  const next = cloneGlobalState(state)

  next.worldTurnState = cloneTurnStateForGlobal(result.state)
  return {
    outcome: {
      ...result,
      previous: cloneTurnStateForGlobal(result.previous),
      state: cloneTurnStateForGlobal(result.state)
    },
    state: syncTopLevelState(next)
  }
}

export function applyGlobalTurnActionForLevel(state, levelId, maze, action) {
  const ensuredState = ensureGlobalTurnStateLevel(state, getLayoutForLevel(state, levelId, maze))
  const layouts = getRegisteredLayouts(ensuredState)
  const worldGrid = buildWorldGridFromLayouts(layouts)
  const result = applyGlobalTurnAction(ensuredState, action)
  const nextWorldCell = result.outcome.state.player.cell
  const owners = getWorldCellOwner(worldGrid, nextWorldCell)?.owners ?? []
  const isRealOwner = (owner) => {
    const levelCells = worldGrid.levels.get(owner.levelId)?.cells

    return !levelCells || levelCells.has(`${owner.localCell.x},${owner.localCell.y}`)
  }
  const nextLevelId =
    owners.find((owner) => owner.levelId !== levelId && isRealOwner(owner))?.levelId ??
    owners.find((owner) => owner.levelId === levelId && isRealOwner(owner))?.levelId ??
    owners.find((owner) => owner.levelId !== levelId)?.levelId ??
    owners.find((owner) => owner.levelId === levelId)?.levelId ??
    levelId
  const previousLocalState = projectWorldTurnStateToLevel(
    withWorldTurnState(ensuredState, result.outcome.previous),
    levelId,
    maze
  )
  const nextLocalState = projectWorldTurnStateToLevel(
    withWorldTurnState(result.state, result.outcome.state),
    levelId,
    maze
  )

  return {
    outcome: {
      ...result.outcome,
      levelTransition: nextLevelId === levelId
        ? null
        : { targetLevelId: nextLevelId },
      previous: previousLocalState,
      state: nextLocalState
    },
    state: result.state
  }
}
