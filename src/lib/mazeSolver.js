import {
  applyTurnAction,
  createBaseOpenEdgeSet,
  createInitialTurnState,
  getNeighbor,
  getVisibleCells
} from './turnRules.js'

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
    itemStates: { ...(state.itemStates ?? {}) },
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

function createRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function shuffleInPlace(values, random) {
  if (!random) {
    return values
  }

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const value = values[index]

    values[index] = values[swapIndex]
    values[swapIndex] = value
  }

  return values
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

function getRotationActions(fromDirection, toDirection) {
  const fromIndex = CARDINAL_DIRECTIONS.indexOf(fromDirection)
  const toIndex = CARDINAL_DIRECTIONS.indexOf(toDirection)

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return []
  }

  const clockwiseSteps = (toIndex - fromIndex + CARDINAL_DIRECTIONS.length) % CARDINAL_DIRECTIONS.length

  if (clockwiseSteps === 1) {
    return ['rotate-right']
  }
  if (clockwiseSteps === 2) {
    return ['rotate-right', 'rotate-right']
  }

  return ['rotate-left']
}

function getMovementActionSequence(state, direction) {
  return [
    ...getRotationActions(state.player.direction, direction),
    'move-forward'
  ]
}

function applyDirectionalMove(maze, state, direction) {
  if (state.player.direction === direction) {
    return applyTurnAction(maze, state, 'move-forward')
  }

  return applyTurnAction(maze, {
    ...state,
    player: {
      ...state.player,
      direction
    }
  }, 'move-forward')
}

function reconstructSearchActions(node) {
  const chunks = []
  let current = node
  let actionCount = 0

  while (current?.actionSequence) {
    chunks.push(current.actionSequence)
    actionCount += current.actionSequence.length
    current = current.parent
  }

  const actions = new Array(actionCount)
  let writeIndex = actionCount

  for (const chunk of chunks) {
    writeIndex -= chunk.length
    for (let index = 0; index < chunk.length; index += 1) {
      actions[writeIndex + index] = chunk[index]
    }
  }

  return actions
}

export function getMazeSolutionMoveBound(maze) {
  if (!maze.trophy?.cell) {
    return Number.POSITIVE_INFINITY
  }

  const toTrophy = shortestPathLength(maze, maze.opening.cell, maze.trophy.cell)
  const returnToOpening = shortestPathLength(maze, maze.trophy.cell, maze.opening.cell)

  return Number.isFinite(toTrophy) && Number.isFinite(returnToOpening)
    ? (toTrophy * 4) + ((returnToOpening + 1) * 4)
    : Number.POSITIVE_INFINITY
}

function getMazeSolutionLegBounds(maze) {
  if (!maze.trophy?.cell) {
    return {
      postTrophyMoveBound: Number.POSITIVE_INFINITY,
      preTrophyMoveBound: Number.POSITIVE_INFINITY
    }
  }

  const toTrophy = shortestPathLength(maze, maze.opening.cell, maze.trophy.cell)
  const returnToOpening = shortestPathLength(maze, maze.trophy.cell, maze.opening.cell)

  return {
    postTrophyMoveBound: Number.isFinite(returnToOpening)
      ? (returnToOpening + 1) * 4
      : Number.POSITIVE_INFINITY,
    preTrophyMoveBound: Number.isFinite(toTrophy)
      ? toTrophy * 4
      : Number.POSITIVE_INFINITY
  }
}

function serializeState(state, options = {}) {
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
  const itemStates = Object.entries(state.itemStates ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, itemState]) => `${itemId}:${itemState}`)
    .join('|')

  return [
    cellKey(state.player.cell),
    options.ignorePlayerDirection ? '*' : state.player.direction,
    state.dead ? '1' : '0',
    state.escaped ? '1' : '0',
    state.player.hasSword ? '1' : '0',
    state.player.hasTrophy ? '1' : '0',
    state.swordState,
    state.trophyState,
    itemStates,
    monsters
  ].join('||')
}

function compareSearchNodes(left, right) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority
  }

  if ((left.coverageScore ?? 0) !== (right.coverageScore ?? 0)) {
    return (right.coverageScore ?? 0) - (left.coverageScore ?? 0)
  }

  return left.actionCount - right.actionCount
}

function countMaskBits(mask) {
  let remaining = mask
  let count = 0

  while (remaining > 0n) {
    count += Number(remaining & 1n)
    remaining >>= 1n
  }

  return count
}

function createCoverageTracker(maze) {
  const cellIndexByKey = new Map()
  let index = 0

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      cellIndexByKey.set(`${x},${y}`, index)
      index += 1
    }
  }

  if (index > 64) {
    return null
  }

  const getCellMask = (cell) => {
    const cellIndex = cellIndexByKey.get(cellKey(cell))

    return typeof cellIndex === 'number' ? 1n << BigInt(cellIndex) : 0n
  }
  const getSeenMask = (state) => {
    let mask = 0n

    for (const key of getVisibleCells(maze, state)) {
      const cellIndex = cellIndexByKey.get(key)

      if (typeof cellIndex === 'number') {
        mask |= 1n << BigInt(cellIndex)
      }
    }

    return mask
  }
  const getCoverageScore = (walkedMask, seenMask) => (
    (countMaskBits(seenMask) * 2) + countMaskBits(walkedMask)
  )

  return {
    getCellMask,
    getCoverageScore,
    getSeenMask
  }
}

function isBetterSearchGoal(candidate, currentBest) {
  if (!currentBest) {
    return true
  }
  if (candidate.cost !== currentBest.cost) {
    return candidate.cost < currentBest.cost
  }
  if ((candidate.coverageScore ?? 0) !== (currentBest.coverageScore ?? 0)) {
    return (candidate.coverageScore ?? 0) > (currentBest.coverageScore ?? 0)
  }
  return candidate.actionCount < currentBest.actionCount
}

function pushSearchNode(heap, node) {
  heap.push(node)

  let index = heap.length - 1
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2)

    if (compareSearchNodes(heap[parentIndex], heap[index]) <= 0) {
      break
    }

    const parent = heap[parentIndex]
    heap[parentIndex] = heap[index]
    heap[index] = parent
    index = parentIndex
  }
}

function popSearchNode(heap) {
  if (heap.length <= 1) {
    return heap.pop() ?? null
  }

  const result = heap[0]
  heap[0] = heap.pop()

  let index = 0
  while (true) {
    const leftIndex = (index * 2) + 1
    const rightIndex = leftIndex + 1
    let smallestIndex = index

    if (
      leftIndex < heap.length &&
      compareSearchNodes(heap[leftIndex], heap[smallestIndex]) < 0
    ) {
      smallestIndex = leftIndex
    }
    if (
      rightIndex < heap.length &&
      compareSearchNodes(heap[rightIndex], heap[smallestIndex]) < 0
    ) {
      smallestIndex = rightIndex
    }

    if (smallestIndex === index) {
      break
    }

    const current = heap[index]
    heap[index] = heap[smallestIndex]
    heap[smallestIndex] = current
    index = smallestIndex
  }

  return result
}

function searchTurnState(maze, initialState, options) {
  const goal = options.goal
  const getActionCost = options.getActionCost ?? ((_, __, action) => (
    action === 'move-forward'
      ? 1
      : 0
  ))
  const estimateRemainingCost = options.estimateRemainingCost ?? (() => 0)
  const moveBound = options.moveBound ?? Number.POSITIVE_INFINITY
  const postTrophyMoveBound = options.postTrophyMoveBound ?? Number.POSITIVE_INFINITY
  const preTrophyMoveBound = options.preTrophyMoveBound ?? Number.POSITIVE_INFINITY
  const maxExpansions = options.maxExpansions ?? 20_000
  const maxDurationMs = options.maxDurationMs ?? Number.POSITIVE_INFINITY
  const startedAt = Number.isFinite(maxDurationMs) ? Date.now() : 0
  const coverageTracker = options.preferCoverage ? createCoverageTracker(maze) : null
  const initialWalkedMask = coverageTracker?.getCellMask(initialState.player.cell) ?? 0n
  const initialSeenMask = coverageTracker?.getSeenMask(initialState) ?? 0n
  const initialCoverageScore = coverageTracker?.getCoverageScore(initialWalkedMask, initialSeenMask) ?? 0
  const visited = new Map()
  const queue = []
  let bestGoal = null
  let expansions = 0
  const initialNode = {
    actionCount: 0,
    coverageScore: initialCoverageScore,
    cost: 0,
    moveCount: 0,
    parent: null,
    priority: estimateRemainingCost(initialState),
    seenMask: initialSeenMask,
    state: initialState,
    trophyMoveCount: initialState.player.hasTrophy ? 0 : null,
    walkedMask: initialWalkedMask
  }

  pushSearchNode(queue, initialNode)
  visited.set(serializeState(initialState, { ignorePlayerDirection: true }), {
    actionCount: 0,
    coverageScore: initialCoverageScore,
    cost: 0,
    moveCount: 0
  })

  while (queue.length > 0) {
    const current = popSearchNode(queue)

    if (bestGoal && current.priority > bestGoal.cost) {
      return {
        actions: reconstructSearchActions(bestGoal),
        moveCount: bestGoal.moveCount
      }
    }

    if (goal(current.state)) {
      if (!coverageTracker) {
        return {
          actions: reconstructSearchActions(current),
          moveCount: current.moveCount
        }
      }
      if (isBetterSearchGoal(current, bestGoal)) {
        bestGoal = current
      }
      continue
    }

    expansions += 1

    if (
      Number.isFinite(maxDurationMs) &&
      (expansions & 127) === 0 &&
      Date.now() - startedAt > maxDurationMs
    ) {
      return options.returnFailure
        ? { failureReason: 'time-limit' }
        : null
    }

    if (expansions > maxExpansions) {
      return options.returnFailure
        ? { failureReason: 'expansion-limit' }
        : null
    }

    for (const direction of CARDINAL_DIRECTIONS) {
      const result = applyDirectionalMove(maze, current.state, direction)

      if (result.blocked || result.killed) {
        continue
      }

      const nextMoveCount = current.moveCount + 1
      const nextTrophyMoveCount = current.trophyMoveCount === null && result.state.player.hasTrophy
        ? nextMoveCount
        : current.trophyMoveCount

      if (nextMoveCount > moveBound) {
        continue
      }
      if (current.trophyMoveCount === null && nextMoveCount > preTrophyMoveBound) {
        continue
      }
      if (
        nextTrophyMoveCount !== null &&
        nextMoveCount - nextTrophyMoveCount > postTrophyMoveBound
      ) {
        continue
      }

      const actionSequence = getMovementActionSequence(current.state, direction)
      const nextActionCount = current.actionCount + actionSequence.length
      const nextCost = current.cost + getActionCost(current.state, result.state, 'move-forward', result)
      const nextState = result.state
      const nextWalkedMask = coverageTracker
        ? current.walkedMask | coverageTracker.getCellMask(nextState.player.cell)
        : 0n
      const nextSeenMask = coverageTracker
        ? current.seenMask | coverageTracker.getSeenMask(nextState)
        : 0n
      const nextCoverageScore = coverageTracker
        ? coverageTracker.getCoverageScore(nextWalkedMask, nextSeenMask)
        : 0
      const nextKey = serializeState(nextState, { ignorePlayerDirection: true })
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
                (
                  (bestVisited.coverageScore ?? 0) > nextCoverageScore ||
                  (
                    (bestVisited.coverageScore ?? 0) === nextCoverageScore &&
                    bestVisited.actionCount <= nextActionCount
                  )
                )
              )
            )
          )
        )
      ) {
        continue
      }

      visited.set(nextKey, {
        actionCount: nextActionCount,
        coverageScore: nextCoverageScore,
        cost: nextCost,
        moveCount: nextMoveCount
      })

      pushSearchNode(queue, {
        actionCount: nextActionCount,
        actionSequence,
        coverageScore: nextCoverageScore,
        cost: nextCost,
        moveCount: nextMoveCount,
        parent: current,
        priority: nextCost + estimateRemainingCost(nextState),
        seenMask: nextSeenMask,
        state: nextState,
        trophyMoveCount: nextTrophyMoveCount,
        walkedMask: nextWalkedMask
      })
    }
  }

  if (bestGoal) {
    return {
      actions: reconstructSearchActions(bestGoal),
      moveCount: bestGoal.moveCount
    }
  }

  return options.returnFailure
    ? { failureReason: 'unsolvable' }
    : null
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
    itemStates: { ...(actualState.itemStates ?? {}) },
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
  beliefState.itemStates = { ...(actualState.itemStates ?? {}) }
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
  const visibleCells = getVisibleCellsIncludingDiagonals(maze, actualState)

  for (const key of visibleCells) {
    memory.observedCells.add(key)
  }

  syncBeliefPlayer(actualState, memory.beliefState)
  syncVisibleMonsters(actualState, memory.beliefState, visibleCells)
  updateKnownItems(maze, actualState, memory, visibleCells)

  return visibleCells
}

function getVisibleCellsIncludingDiagonals(maze, state) {
  const visible = new Set(getVisibleCells(maze, state))
  const center = state.player.cell

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cell = { x: center.x + dx, y: center.y + dy }

      if (
        cell.x < 0 ||
        cell.y < 0 ||
        cell.x >= maze.width ||
        cell.y >= maze.height
      ) {
        continue
      }

      visible.add(cellKey(cell))
    }
  }

  return visible
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
  const baseCost = action === 'move-forward'
    ? 1
    : 0

  if (action === 'move-forward' && previousState.player.hasSword && !nextState.player.hasSword) {
    return baseCost + 8
  }

  return baseCost
}

function planToGoal(
  maze,
  beliefMaze,
  beliefState,
  remainingMoveBound,
  goal,
  estimateRemainingCost,
  maxExpansions = 1_500
) {
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
      maxExpansions,
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
  const openEdges = createBaseOpenEdgeSet(maze)
  let count = 0

  for (const direction of CARDINAL_DIRECTIONS) {
    const neighbor = getNeighbor(cell, direction)
    const neighborEdgeKey = [cellKey(cell), cellKey(neighbor)].sort().join('|')

    if (
      neighbor.x < 0 ||
      neighbor.y < 0 ||
      neighbor.x >= maze.width ||
      neighbor.y >= maze.height
    ) {
      continue
    }

    if (openEdges.has(neighborEdgeKey) && !memory.observedCells.has(cellKey(neighbor))) {
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

function chooseNextPlan(maze, memory, moveBound, distanceBetween, options = {}) {
  const beliefState = memory.beliefState
  const beliefMaze = createBeliefMaze(maze, memory)
  const beliefDistanceBetween = distanceBetween
  const remainingMoveBound = moveBound - memory.moveCount
  const maxPlanExpansions = options.maxPlanExpansions ?? 1_500
  const random = options.random ?? null
  const plans = []
  const delayTrophyApproach = shouldDelayTrophyApproach(maze, memory)

  if (beliefState.player.hasTrophy) {
    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => state.escaped,
      (state) => estimateEscapeCost(beliefDistanceBetween, maze, state),
      maxPlanExpansions
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
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, swordCell),
      maxPlanExpansions
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
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, trophyCell),
      maxPlanExpansions
    ))
  }

  const explorationTargets = getExplorationTargets(maze, memory, beliefDistanceBetween)
  shuffleInPlace(explorationTargets, random)

  for (const target of explorationTargets) {
    const targetCell = cloneCell(target.cell)

    plans.push(() => planToGoal(
      maze,
      beliefMaze,
      beliefState,
      remainingMoveBound,
      (state) => cellKey(state.player.cell) === cellKey(targetCell),
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, targetCell),
      maxPlanExpansions
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
      (state) => estimateDistanceToCell(beliefDistanceBetween, state, trophyCell),
      maxPlanExpansions
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
  const maxPlanExpansions = options.maxPlanExpansions ?? 1_500
  const random = typeof options.explorationSeed === 'number'
    ? createRandom(options.explorationSeed)
    : null

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

    const plan = chooseNextPlan(
      maze,
      memory,
      moveBound,
      distanceBetween,
      { maxPlanExpansions, random }
    )

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

export function getSolutionRouteMetrics(maze, actions = []) {
  let state = createInitialTurnState(maze)
  const walkedCells = new Set([cellKey(state.player.cell)])
  const seenCells = new Set(getVisibleCells(maze, state))
  const preTrophyWalkedCells = new Set([cellKey(state.player.cell)])
  const postTrophyNewWalkedCells = new Set()
  let moveCount = 0
  let trophyMoveCount = null
  let trophyActionIndex = null

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex]
    const result = applyTurnAction(maze, state, action)

    if (result.blocked || result.killed) {
      break
    }

    state = result.state

    if (action === 'move-forward' || action === 'move-backward') {
      moveCount += 1
      const key = cellKey(state.player.cell)

      walkedCells.add(key)
      if (state.player.hasTrophy) {
        if (trophyMoveCount === null) {
          trophyMoveCount = moveCount
          trophyActionIndex = actionIndex
        }
        if (!preTrophyWalkedCells.has(key)) {
          postTrophyNewWalkedCells.add(key)
        }
      } else {
        preTrophyWalkedCells.add(key)
      }
    }

    for (const key of getVisibleCells(maze, state)) {
      seenCells.add(key)
    }

    if (state.escaped) {
      break
    }
  }

  const cellCount = Math.max(1, maze.width * maze.height)

  return {
    cellCount,
    escaped: state.escaped,
    moveCount,
    postTrophyMoveCount: trophyMoveCount === null ? 0 : moveCount - trophyMoveCount,
    postTrophyNewCellCount: postTrophyNewWalkedCells.size,
    postTrophyNewCellRatio: postTrophyNewWalkedCells.size / cellCount,
    preTrophyMoveCount: trophyMoveCount ?? moveCount,
    seenCellCount: seenCells.size,
    seenCellRatio: seenCells.size / cellCount,
    trophyActionIndex,
    trophyMoveCount,
    walkedCellCount: walkedCells.size,
    walkedCellRatio: walkedCells.size / cellCount
  }
}

function cloneMazeForValidation(maze, overrides = {}) {
  return JSON.parse(JSON.stringify({
    ...maze,
    lightmap: undefined,
    solution: undefined,
    visibility: undefined,
    ...overrides
  }))
}

function getSwordRemovalCases(maze) {
  const cases = []

  if (maze.sword?.cell) {
    cases.push({
      label: maze.sword.id ?? 'sword',
      maze: cloneMazeForValidation(maze, { sword: null })
    })
  }

  for (const item of maze.items ?? []) {
    if (item.type !== 'sword') {
      continue
    }

    cases.push({
      label: item.id ?? `sword-${cases.length + 1}`,
      maze: cloneMazeForValidation(maze, {
        items: (maze.items ?? []).filter((candidate) => candidate !== item)
      })
    })
  }

  return cases
}

export function solveMazeWithPerfectInformation(maze, options = {}) {
  const result = solveMazeWithPerfectInformationResult(maze, options)

  return result.solution
}

export function solveMazeWithPerfectInformationResult(maze, options = {}) {
  const moveBound = options.moveBound ?? getMazeSolutionMoveBound(maze)
  const initialState = options.initialState ?? createInitialTurnState(maze)
  const distanceBetween = createDistanceLookup(maze)
  const legBounds = getMazeSolutionLegBounds(maze)
  const searchResult = searchTurnState(
    maze,
    cloneState(initialState),
    {
      estimateRemainingCost: (state) => {
        if (state.player.hasTrophy) {
          return estimateEscapeCost(distanceBetween, maze, state)
        }

        return estimateDistanceToCell(
          distanceBetween,
          state,
          maze.trophy?.cell ?? maze.opening.cell
        )
      },
      goal: (state) => state.escaped && state.player.hasTrophy,
      maxDurationMs: options.maxDurationMs,
      maxExpansions: options.maxExpansions ?? 50_000,
      moveBound,
      postTrophyMoveBound: options.postTrophyMoveBound ?? legBounds.postTrophyMoveBound,
      preTrophyMoveBound: options.preTrophyMoveBound ?? legBounds.preTrophyMoveBound,
      preferCoverage: options.preferCoverage !== false,
      returnFailure: true
    }
  )

  if (searchResult?.failureReason) {
    return {
      failureReason: searchResult.failureReason,
      solution: null
    }
  }

  return {
    failureReason: null,
    solution: {
      ...searchResult,
      metrics: getSolutionRouteMetrics(maze, searchResult.actions),
      perfectInformation: true
    }
  }
}

export function validateMazeAdvancedDifficulty(maze, options = {}) {
  const errors = []
  const timings = []
  const measure = (stage, work) => {
    const startedAt = performance.now()
    const result = work()
    const durationMs = performance.now() - startedAt
    const entry = { durationMs, stage }

    timings.push(entry)
    options.onTiming?.(entry)
    return result
  }
  const imperfectTrialCount = options.imperfectTrialCount ?? 5
  const requiredImperfectSuccessRate = options.requiredImperfectSuccessRate ?? 0.8
  const perfectResult = measure('perfect-solution', () =>
    solveMazeWithPerfectInformationResult(maze, {
      maxDurationMs: options.maxPerfectDurationMs,
      maxExpansions: options.maxPerfectExpansions ?? 50_000
    })
  )
  const perfect = perfectResult.solution

  if (!perfect) {
    const reason = perfectResult.failureReason === 'expansion-limit'
      ? 'Advanced validation hit the perfect-information expansion limit before proving optimality'
      : perfectResult.failureReason === 'time-limit'
        ? 'Advanced validation hit the perfect-information time limit before proving optimality'
        : 'Advanced validation requires a perfect-information winning solution'

    return {
      errors: [reason],
      imperfectSuccessRate: 0,
      metrics: null,
      perfect: null,
      timings,
      valid: false
    }
  }

  const imperfectSolutions = []
  for (let trial = 0; trial < imperfectTrialCount; trial += 1) {
    const solution = measure('imperfect-solution-trial', () =>
      solveMaze(maze, {
        explorationSeed: (Number(maze.seed ?? 0) + (trial * 977)) >>> 0,
        maxActionCount: options.maxImperfectActionCount ?? 320,
        maxPlanExpansions: options.maxImperfectPlanExpansions ?? 500
      })
    )

    if (solution) {
      imperfectSolutions.push(solution)
    }
  }

  const imperfectSuccessRate = imperfectSolutions.length / Math.max(1, imperfectTrialCount)
  if (imperfectSuccessRate < requiredImperfectSuccessRate) {
    errors.push(
      `Imperfect-information solver success rate ${imperfectSuccessRate.toFixed(2)} is below ${requiredImperfectSuccessRate.toFixed(2)}`
    )
  }

  const noMonsterMaze = cloneMazeForValidation(maze, { monsters: [] })
  const noMonsterResult = measure('monster-free-solution', () =>
    solveMazeWithPerfectInformationResult(noMonsterMaze, {
      maxDurationMs: options.maxPerfectDurationMs,
      maxExpansions: options.maxPerfectExpansions ?? 50_000
    })
  )
  const noMonster = noMonsterResult.solution

  if (noMonsterResult.failureReason === 'expansion-limit' || noMonsterResult.failureReason === 'time-limit') {
    errors.push(`Could not prove the monster-free baseline because perfect-information search hit the ${noMonsterResult.failureReason === 'time-limit' ? 'time limit' : 'expansion limit'}`)
  } else if (!noMonster) {
    errors.push('Monster-free baseline must be solvable')
  } else {
    if (!(perfect.metrics.preTrophyMoveCount > noMonster.metrics.preTrophyMoveCount)) {
      errors.push('Optimal solution must take more turns to acquire the trophy than the monster-free baseline')
    }
  }

  for (const [monsterIndex, monster] of (maze.monsters ?? []).entries()) {
    const withoutMonster = cloneMazeForValidation(maze, {
      monsters: (maze.monsters ?? []).filter((_, candidateIndex) => candidateIndex !== monsterIndex)
    })
    const result = measure('without-monster-solution', () =>
      solveMazeWithPerfectInformationResult(withoutMonster, {
        maxDurationMs: options.maxPerfectDurationMs,
        maxExpansions: options.maxPerfectExpansions ?? 50_000
      })
    )
    const solution = result.solution

    if (result.failureReason === 'expansion-limit' || result.failureReason === 'time-limit') {
      errors.push(`Could not prove removing monster ${monster.id ?? monster.type} makes a faster solution because perfect-information search hit the ${result.failureReason === 'time-limit' ? 'time limit' : 'expansion limit'}`)
    } else if (!solution) {
      errors.push(`Removing monster ${monster.id ?? monster.type} must leave a faster optimal solution, but no solution was found`)
    } else if (!(solution.moveCount < perfect.moveCount)) {
      errors.push(`Removing monster ${monster.id ?? monster.type} must produce a faster optimal solution`)
    }
  }

  for (const removal of getSwordRemovalCases(maze)) {
    const withoutSwordResult = measure(
      'without-sword-solution',
      () => solveMazeWithPerfectInformationResult(
        removal.maze,
        {
          maxDurationMs: options.maxPerfectDurationMs,
          maxExpansions: options.maxPerfectExpansions ?? 50_000
        }
      )
    )
    const withoutSword = withoutSwordResult.solution
    if (withoutSwordResult.failureReason === 'expansion-limit' || withoutSwordResult.failureReason === 'time-limit') {
      errors.push(`Could not prove removing sword ${removal.label} makes the maze impossible because perfect-information search hit the ${withoutSwordResult.failureReason === 'time-limit' ? 'time limit' : 'expansion limit'}`)
    }
    if (withoutSword) {
      errors.push(`Removing sword ${removal.label} must make the maze impossible`)
    }
  }

  for (const gate of maze.gates ?? []) {
    const gateEdgeKey = [cellKey(gate.from), cellKey(gate.to)].sort().join('|')
    const withoutGate = cloneMazeForValidation(maze, {
      gates: (maze.gates ?? []).filter((candidate) => {
        return [cellKey(candidate.from), cellKey(candidate.to)].sort().join('|') !== gateEdgeKey
      })
    })
    const result = measure('without-gate-solution', () =>
      solveMazeWithPerfectInformationResult(withoutGate, {
        maxDurationMs: options.maxPerfectDurationMs,
        maxExpansions: options.maxPerfectExpansions ?? 50_000
      })
    )
    const solution = result.solution

    if (result.failureReason === 'expansion-limit' || result.failureReason === 'time-limit') {
      errors.push(`Could not prove removing gate edge ${gateEdgeKey} makes the maze impossible because perfect-information search hit the ${result.failureReason === 'time-limit' ? 'time limit' : 'expansion limit'}`)
    } else if (solution) {
      errors.push(`Removing gate edge ${gateEdgeKey} as a monster-blocking gate must make the maze impossible`)
    }
  }

  if (perfect.metrics.walkedCellRatio < 0.5) {
    errors.push(`Optimal solution must walk at least 50% of cells; got ${(perfect.metrics.walkedCellRatio * 100).toFixed(1)}%`)
  }
  if (perfect.metrics.seenCellRatio < 0.65) {
    errors.push(`Optimal solution must see at least 65% of cells; got ${(perfect.metrics.seenCellRatio * 100).toFixed(1)}%`)
  }
  if (perfect.metrics.postTrophyNewCellRatio < 0) {
    errors.push(`Optimal return must walk at least 0% new cells after trophy; got ${(perfect.metrics.postTrophyNewCellRatio * 100).toFixed(1)}%`)
  }

  return {
    errors,
    imperfectSuccessRate,
    imperfectSolutions,
    metrics: perfect.metrics,
    monsterFree: noMonster,
    perfect,
    timings,
    valid: errors.length === 0
  }
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
