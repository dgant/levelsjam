import {
  applyTurnAction,
  createBaseOpenEdgeSet,
  createInitialTurnState,
  getNeighbor,
  getVisibleCells
} from './turnRules.js'

const SEARCH_ACTIONS = [
  'move-forward',
  'move-backward',
  'rotate-left',
  'rotate-right'
]

const CARDINAL_DIRECTIONS = ['north', 'east', 'south', 'west']

function cellKey(cell) {
  return `${cell.x},${cell.y}`
}

function parseCellKey(key) {
  const [x, y] = key.split(',').map(Number)

  return { x, y }
}

function cloneCell(cell) {
  return {
    x: cell.x,
    y: cell.y
  }
}

function cloneMonster(monster) {
  return {
    ...monster,
    cell: cloneCell(monster.cell),
    lastPath: [...(monster.lastPath ?? [])]
  }
}

function cloneState(state) {
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

function shortestPathLength(maze, from, to) {
  const openEdges = createBaseOpenEdgeSet(maze)
  const queue = [{ cell: from, distance: 0 }]
  const visited = new Set([cellKey(from)])

  while (queue.length > 0) {
    const current = queue.shift()

    if (cellKey(current.cell) === cellKey(to)) {
      return current.distance
    }

    for (const direction of CARDINAL_DIRECTIONS) {
      const next = getNeighbor(current.cell, direction)
      const edgeKey = [cellKey(current.cell), cellKey(next)].sort().join('|')

      if (!openEdges.has(edgeKey)) {
        continue
      }

      const nextKey = cellKey(next)

      if (visited.has(nextKey)) {
        continue
      }

      visited.add(nextKey)
      queue.push({
        cell: next,
        distance: current.distance + 1
      })
    }
  }

  return Number.POSITIVE_INFINITY
}

function createDistanceLookup(maze) {
  const cache = new Map()

  return (from, to) => {
    const key = `${cellKey(from)}=>${cellKey(to)}`

    if (!cache.has(key)) {
      cache.set(key, shortestPathLength(maze, from, to))
    }

    return cache.get(key)
  }
}

export function getMazeSolutionMoveBound(maze) {
  if (!maze.trophy?.cell) {
    return Number.POSITIVE_INFINITY
  }

  const toTrophy = shortestPathLength(maze, maze.opening.cell, maze.trophy.cell)

  return Number.isFinite(toTrophy)
    ? toTrophy * 4
    : Number.POSITIVE_INFINITY
}

function serializeState(state) {
  const monsters = state.monsters
    .map((monster) => [
      monster.id,
      monster.type,
      monster.awake ? '1' : '0',
      cellKey(monster.cell),
      monster.direction,
      monster.hand ?? '',
      monster.lastMoveDirection ?? '',
      monster.lastSeenDirection ?? '',
      monster.movedPreviousTurn ? '1' : '0',
      (monster.lastPath ?? []).join('.')
    ].join(':'))
    .sort()
    .join('|')

  return [
    cellKey(state.player.cell),
    state.player.direction,
    state.dead ? '1' : '0',
    state.escaped ? '1' : '0',
    state.player.hasSword ? '1' : '0',
    state.player.hasTrophy ? '1' : '0',
    state.swordState,
    state.trophyState,
    monsters
  ].join('||')
}

function insertByPriority(queue, node) {
  let insertIndex = queue.length

  while (insertIndex > 0) {
    const previous = queue[insertIndex - 1]

    if (
      previous.priority < node.priority ||
      (previous.priority === node.priority && previous.actionCount <= node.actionCount)
    ) {
      break
    }

    insertIndex -= 1
  }

  queue.splice(insertIndex, 0, node)
}

function searchTurnState(maze, initialState, options) {
  const goal = options.goal
  const getActionCost = options.getActionCost ?? ((_, __, action) => (
    action === 'move-forward' || action === 'move-backward'
      ? 1
      : 0.25
  ))
  const estimateRemainingCost = options.estimateRemainingCost ?? (() => 0)
  const moveBound = options.moveBound ?? Number.POSITIVE_INFINITY
  const maxExpansions = options.maxExpansions ?? 20_000
  const visited = new Map()
  const queue = []
  let expansions = 0
  const initialNode = {
    actionCount: 0,
    actions: [],
    cost: 0,
    moveCount: 0,
    priority: estimateRemainingCost(initialState),
    state: initialState
  }

  insertByPriority(queue, initialNode)
  visited.set(serializeState(initialState), {
    actionCount: 0,
    cost: 0,
    moveCount: 0
  })

  while (queue.length > 0) {
    const current = queue.shift()

    if (goal(current.state)) {
      return {
        actions: current.actions,
        moveCount: current.moveCount
      }
    }

    expansions += 1

    if (expansions > maxExpansions) {
      return null
    }

    for (const action of SEARCH_ACTIONS) {
      const result = applyTurnAction(maze, current.state, action)

      if (result.blocked || result.killed) {
        continue
      }

      const nextMoveCount = current.moveCount + Number(
        action === 'move-forward' || action === 'move-backward'
      )

      if (nextMoveCount > moveBound) {
        continue
      }

      const nextActionCount = current.actionCount + 1
      const nextActions = [...current.actions, action]
      const nextCost = current.cost + getActionCost(
        current.state,
        result.state,
        action,
        result
      )
      const nextState = result.state
      const nextKey = serializeState(nextState)
      const bestVisited = visited.get(nextKey)

      if (
        bestVisited &&
        (
          bestVisited.cost < nextCost ||
          (
            bestVisited.cost === nextCost &&
            (
              bestVisited.moveCount < nextMoveCount ||
              (
                bestVisited.moveCount === nextMoveCount &&
                bestVisited.actionCount <= nextActionCount
              )
            )
          )
        )
      ) {
        continue
      }

      visited.set(nextKey, {
        actionCount: nextActionCount,
        cost: nextCost,
        moveCount: nextMoveCount
      })

      insertByPriority(queue, {
        actionCount: nextActionCount,
        actions: nextActions,
        cost: nextCost,
        moveCount: nextMoveCount,
        priority: nextCost + estimateRemainingCost(nextState),
        state: nextState
      })
    }
  }

  return null
}

function createBeliefState(actualState) {
  return {
    checkpoint: {
      cell: cloneCell(actualState.checkpoint.cell),
      direction: actualState.checkpoint.direction
    },
    dead: actualState.dead,
    escaped: actualState.escaped,
    monsters: [],
    player: {
      ...actualState.player,
      cell: cloneCell(actualState.player.cell)
    },
    swordState: actualState.swordState,
    trophyState: actualState.trophyState,
    turn: actualState.turn
  }
}

function createBeliefMaze(maze, memory) {
  return {
    ...maze,
    sword: memory.knownSwordCell
      ? {
        ...(maze.sword ?? {}),
        cell: cloneCell(memory.knownSwordCell)
      }
      : undefined,
    trophy: memory.knownTrophyCell
      ? {
        ...(maze.trophy ?? {}),
        cell: cloneCell(memory.knownTrophyCell)
      }
      : undefined
  }
}

function syncBeliefPlayer(actualState, beliefState) {
  beliefState.checkpoint = {
    cell: cloneCell(actualState.checkpoint.cell),
    direction: actualState.checkpoint.direction
  }
  beliefState.dead = actualState.dead
  beliefState.escaped = actualState.escaped
  beliefState.player = {
    ...actualState.player,
    cell: cloneCell(actualState.player.cell)
  }
  beliefState.swordState = actualState.swordState
  beliefState.trophyState = actualState.trophyState
  beliefState.turn = actualState.turn
}

function syncVisibleMonsters(actualState, beliefState, visibleCells) {
  const visibleMonsters = actualState.monsters.filter((monster) =>
    visibleCells.has(cellKey(monster.cell))
  )
  const visibleMonsterIds = new Set(visibleMonsters.map((monster) => monster.id))

  beliefState.monsters = beliefState.monsters
    .filter((monster) => {
      if (!visibleCells.has(cellKey(monster.cell))) {
        return true
      }

      return visibleMonsterIds.has(monster.id)
    })
    .map(cloneMonster)

  const trackedById = new Map(
    beliefState.monsters.map((monster) => [monster.id, monster])
  )

  for (const monster of visibleMonsters) {
    trackedById.set(monster.id, cloneMonster(monster))
  }

  beliefState.monsters = [...trackedById.values()]
}

function updateKnownItems(maze, actualState, memory, visibleCells) {
  if (actualState.player.hasSword) {
    memory.knownSwordCell = maze.sword?.cell
      ? cloneCell(maze.sword.cell)
      : null
  } else if (actualState.swordState === 'consumed') {
    memory.knownSwordCell = null
  } else if (
    maze.sword?.cell &&
    actualState.swordState === 'ground' &&
    visibleCells.has(cellKey(maze.sword.cell))
  ) {
    memory.knownSwordCell = cloneCell(maze.sword.cell)
  }

  if (actualState.player.hasTrophy) {
    memory.knownTrophyCell = maze.trophy?.cell
      ? cloneCell(maze.trophy.cell)
      : null
  } else if (
    maze.trophy?.cell &&
    actualState.trophyState === 'ground' &&
    visibleCells.has(cellKey(maze.trophy.cell))
  ) {
    memory.knownTrophyCell = cloneCell(maze.trophy.cell)
  }
}

function observeState(maze, actualState, memory) {
  const visibleCells = getVisibleCells(maze, actualState)

  for (const key of visibleCells) {
    memory.observedCells.add(key)
  }

  syncBeliefPlayer(actualState, memory.beliefState)
  syncVisibleMonsters(actualState, memory.beliefState, visibleCells)
  updateKnownItems(maze, actualState, memory, visibleCells)

  return visibleCells
}

function createObservationSignature(memory) {
  const observedCells = [...memory.observedCells].sort().join(',')

  return [
    serializeState(memory.beliefState),
    observedCells,
    memory.knownSwordCell ? cellKey(memory.knownSwordCell) : '',
    memory.knownTrophyCell ? cellKey(memory.knownTrophyCell) : ''
  ].join('###')
}

function estimateDistanceToCell(distanceBetween, state, cell) {
  const distance = distanceBetween(state.player.cell, cell)

  return Number.isFinite(distance)
    ? distance
    : 0
}

function estimateEscapeCost(distanceBetween, maze, state) {
  const toOpening = distanceBetween(state.player.cell, maze.opening.cell)

  if (!Number.isFinite(toOpening)) {
    return 0
  }

  return toOpening + Number(cellKey(state.player.cell) !== cellKey(maze.opening.cell))
}

function getPlanningActionCost(previousState, nextState, action) {
  const baseCost = action === 'move-forward' || action === 'move-backward'
    ? 1
    : 0.25

  if (previousState.player.hasSword && !nextState.player.hasSword) {
    return baseCost + 8
  }

  return baseCost
}

function planToGoal(maze, beliefMaze, beliefState, remainingMoveBound, goal, estimateRemainingCost) {
  if (remainingMoveBound < 0) {
    return null
  }

  return searchTurnState(
    beliefMaze,
    cloneState(beliefState),
    {
      estimateRemainingCost,
      getActionCost: getPlanningActionCost,
      goal,
      maxExpansions: 1_500,
      moveBound: remainingMoveBound
    }
  )
}

function getExplorationTargets(maze, memory, distanceBetween) {
  const targets = []

  for (const key of memory.observedCells) {
    const cell = parseCellKey(key)

    if (!hasUnseenNeighbor(maze, memory, cell)) {
      continue
    }

    const playerDistance = distanceBetween(memory.beliefState.player.cell, cell)

    if (!Number.isFinite(playerDistance)) {
      continue
    }

    targets.push({
      cell,
      entranceDistance: distanceBetween(maze.opening.cell, cell),
      playerDistance,
      unseenNeighborCount: countUnseenNeighbors(maze, memory, cell)
    })
  }

  if (targets.length === 0) {
    for (const key of memory.observedCells) {
      const cell = parseCellKey(key)
      const playerDistance = distanceBetween(memory.beliefState.player.cell, cell)

      if (!Number.isFinite(playerDistance)) {
        continue
      }

      targets.push({
        cell,
        entranceDistance: distanceBetween(maze.opening.cell, cell),
        playerDistance,
        unseenNeighborCount: 0
      })
    }
  }

  const byFarthest = [...targets]
    .sort((left, right) => {
      if (left.entranceDistance !== right.entranceDistance) {
        return right.entranceDistance - left.entranceDistance
      }

      if (left.unseenNeighborCount !== right.unseenNeighborCount) {
        return left.unseenNeighborCount - right.unseenNeighborCount
      }

      if (left.playerDistance !== right.playerDistance) {
        return left.playerDistance - right.playerDistance
      }

      return cellKey(left.cell).localeCompare(cellKey(right.cell))
    })
    .slice(0, 12)
  const byNearest = [...targets]
    .sort((left, right) => {
      if (left.unseenNeighborCount !== right.unseenNeighborCount) {
        return left.unseenNeighborCount - right.unseenNeighborCount
      }

      if (left.playerDistance !== right.playerDistance) {
        return left.playerDistance - right.playerDistance
      }

      if (left.entranceDistance !== right.entranceDistance) {
        return right.entranceDistance - left.entranceDistance
      }

      return cellKey(left.cell).localeCompare(cellKey(right.cell))
    })
    .slice(0, 12)
  const orderedTargets = []
  const seenTargets = new Set()

  for (const target of [...byFarthest, ...byNearest]) {
    const key = cellKey(target.cell)

    if (seenTargets.has(key)) {
      continue
    }

    seenTargets.add(key)
    orderedTargets.push(target)
  }

  return orderedTargets
}

function hasUnseenNeighbor(maze, memory, cell) {
  return countUnseenNeighbors(maze, memory, cell) > 0
}

function countUnseenNeighbors(maze, memory, cell) {
  let count = 0

  for (const direction of CARDINAL_DIRECTIONS) {
    const neighbor = getNeighbor(cell, direction)

    if (
      neighbor.x < 0 ||
      neighbor.y < 0 ||
      neighbor.x >= maze.width ||
      neighbor.y >= maze.height
    ) {
      continue
    }

    if (!memory.observedCells.has(cellKey(neighbor))) {
      count += 1
    }
  }

  return count
}

function shouldDelayTrophyApproach(maze, memory) {
  if (!memory.knownTrophyCell) {
    return false
  }

  if (memory.beliefState.player.hasSword || memory.beliefState.swordState === 'consumed') {
    return false
  }

  return countUnseenNeighbors(maze, memory, memory.knownTrophyCell) > 0
}

function chooseNextPlan(maze, memory, moveBound, distanceBetween) {
  const beliefState = memory.beliefState
  const beliefMaze = createBeliefMaze(maze, memory)
  const beliefDistanceBetween = distanceBetween
  const remainingMoveBound = moveBound - memory.moveCount
  const plans = []
  const delayTrophyApproach = shouldDelayTrophyApproach(maze, memory)

  if (beliefState.player.hasTrophy) {
    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => state.escaped,
      (state) => estimateEscapeCost(beliefDistanceBetween, maze, state)
    ))
  }

  if (!beliefState.player.hasSword && memory.knownSwordCell) {
    const swordCell = cloneCell(memory.knownSwordCell)

    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => (
        state.player.hasSword ||
        cellKey(state.player.cell) === cellKey(swordCell)
      ),
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, swordCell)
    ))
  }

  if (
    memory.knownTrophyCell &&
    !beliefState.player.hasTrophy &&
    !delayTrophyApproach
  ) {
    const trophyCell = cloneCell(memory.knownTrophyCell)

    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => (
        state.player.hasTrophy ||
        cellKey(state.player.cell) === cellKey(trophyCell)
      ),
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, trophyCell)
    ))
  }

  for (const target of getExplorationTargets(maze, memory, beliefDistanceBetween)) {
    const targetCell = cloneCell(target.cell)

    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => cellKey(state.player.cell) === cellKey(targetCell),
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, targetCell)
    ))
  }

  if (
    memory.knownTrophyCell &&
    !beliefState.player.hasTrophy &&
    delayTrophyApproach
  ) {
    const trophyCell = cloneCell(memory.knownTrophyCell)

    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => (
        state.player.hasTrophy ||
        cellKey(state.player.cell) === cellKey(trophyCell)
      ),
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, trophyCell)
    ))
  }

  for (const planFactory of plans) {
    const plan = planFactory()

    if (plan?.actions?.length) {
      return plan
    }
  }

  return null
}

export function solveMaze(maze, options = {}) {
  const moveBound = options.moveBound ?? getMazeSolutionMoveBound(maze)
  const debugLog = options.debugLog ?? null

  if (!Number.isFinite(moveBound) || moveBound <= 0) {
    return null
  }

  const initialState = options.initialState ?? createInitialTurnState(maze)
  const distanceBetween = createDistanceLookup(maze)
  const maxActionCount = options.maxActionCount ?? Math.max(128, moveBound * 12)
  const actualState = cloneState(initialState)
  const memory = {
    beliefState: createBeliefState(actualState),
    knownSwordCell: null,
    knownTrophyCell: null,
    moveCount: 0,
    observedCells: new Set()
  }
  const actions = []
  const seenObservationCounts = new Map()

  while (actions.length < maxActionCount) {
    observeState(maze, actualState, memory)
    debugLog?.({
      event: 'observe',
      knownSwordCell: memory.knownSwordCell,
      knownTrophyCell: memory.knownTrophyCell,
      moveCount: memory.moveCount,
      observedCells: [...memory.observedCells].sort(),
      player: cloneCell(actualState.player.cell),
      trackedMonsters: memory.beliefState.monsters.map((monster) => ({
        awake: monster.awake,
        cell: cloneCell(monster.cell),
        id: monster.id,
        type: monster.type
      }))
    })

    if (actualState.escaped) {
      return {
        actions,
        moveCount: memory.moveCount,
        observedCellCount: memory.observedCells.size,
        visibilityLimited: true
      }
    }

    const observationSignature = createObservationSignature(memory)
    const observationCount = (seenObservationCounts.get(observationSignature) ?? 0) + 1

    seenObservationCounts.set(observationSignature, observationCount)

    if (observationCount > 32) {
      debugLog?.({
        event: 'fail',
        reason: 'repeated-observation',
        signature: observationSignature
      })
      return null
    }

    const plan = chooseNextPlan(maze, memory, moveBound, distanceBetween)

    if (!plan?.actions?.length) {
      debugLog?.({
        event: 'fail',
        reason: 'no-plan'
      })
      return null
    }

    const action = plan.actions[0]
    debugLog?.({
      action,
      event: 'act',
      plan
    })
    const beliefResult = applyTurnAction(
      createBeliefMaze(maze, memory),
      memory.beliefState,
      action
    )

    if (beliefResult.blocked || beliefResult.killed) {
      debugLog?.({
        event: 'fail',
        reason: 'belief-transition',
        result: beliefResult
      })
      return null
    }

    const actualResult = applyTurnAction(maze, actualState, action)

    if (actualResult.blocked || actualResult.killed) {
      debugLog?.({
        event: 'fail',
        reason: 'actual-transition',
        result: actualResult
      })
      return null
    }

    memory.beliefState = beliefResult.state
    actions.push(action)

    if (action === 'move-forward' || action === 'move-backward') {
      memory.moveCount += 1

      if (memory.moveCount > moveBound) {
        debugLog?.({
          event: 'fail',
          reason: 'move-bound'
        })
        return null
      }
    }

    Object.assign(actualState, cloneState(actualResult.state))
  }

  return null
}

export function validateRecordedSolution(maze) {
  const actions = maze.solution?.actions

  if (!Array.isArray(actions) || actions.length === 0) {
    return {
      escaped: false,
      moveCount: 0,
      state: createInitialTurnState(maze)
    }
  }

  let state = createInitialTurnState(maze)
  let moveCount = 0

  for (const action of actions) {
    const result = applyTurnAction(maze, state, action)

    if (result.blocked || result.killed) {
      return {
        escaped: false,
        moveCount,
        state: result.state
      }
    }

    moveCount += Number(action === 'move-forward' || action === 'move-backward')
    state = result.state

    if (state.escaped) {
      return {
        escaped: true,
        moveCount,
        state
      }
    }
  }

  return {
    escaped: state.escaped,
    moveCount,
    state
  }
}
