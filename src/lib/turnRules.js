const DIRECTIONS = ['north', 'east', 'south', 'west']

const DIRECTION_DELTAS = {
  east: { x: 1, y: 0 },
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
}

const OPPOSITE_DIRECTIONS = {
  east: 'west',
  north: 'south',
  south: 'north',
  west: 'east'
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`
}

function normalizeEdge(from, to) {
  const fromKey = cellKey(from)
  const toKey = cellKey(to)

  return fromKey < toKey
    ? `${fromKey}|${toKey}`
    : `${toKey}|${fromKey}`
}

function getNeighbor(cell, direction) {
  const delta = DIRECTION_DELTAS[direction]

  return {
    x: cell.x + delta.x,
    y: cell.y + delta.y
  }
}

function isInsideMaze(maze, cell) {
  return (
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < maze.width &&
    cell.y < maze.height
  )
}

function createBaseOpenEdgeSet(maze) {
  return new Set(
    (maze.openEdges ?? []).map((edge) => normalizeEdge(edge.from, edge.to))
  )
}

function getGateId(gate) {
  return gate.id ?? normalizeEdge(gate.from, gate.to)
}

function createClosedGateEdgeSet(maze) {
  return new Set(
    (maze.gates ?? []).map((gate) => normalizeEdge(gate.from, gate.to))
  )
}

function createMonsterMoveEdgeSet(maze) {
  const openEdges = createBaseOpenEdgeSet(maze)

  for (const gate of maze.gates ?? []) {
    openEdges.delete(normalizeEdge(gate.from, gate.to))
  }

  return openEdges
}

function canMove(maze, openEdges, cell, direction) {
  const neighbor = getNeighbor(cell, direction)

  return (
    isInsideMaze(maze, neighbor) &&
    openEdges.has(normalizeEdge(cell, neighbor))
  )
}

function rotateDirection(direction, turn) {
  const index = DIRECTIONS.indexOf(direction)
  const offset = turn === 'left' ? -1 : turn === 'right' ? 1 : 2

  return DIRECTIONS[(index + offset + DIRECTIONS.length) % DIRECTIONS.length]
}

function hashString(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function allCells(maze) {
  const cells = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function getReservedCellKeys(maze) {
  const reserved = new Set([cellKey(maze.opening.cell)])

  if (maze.sword?.cell) {
    reserved.add(cellKey(maze.sword.cell))
  }

  if (maze.trophy?.cell) {
    reserved.add(cellKey(maze.trophy.cell))
  }

  return reserved
}

function chooseMonsterPlacements(maze) {
  if (Array.isArray(maze.monsters)) {
    return maze.monsters.map((monster) => ({
      ...monster,
      cell: { ...monster.cell }
    }))
  }

  const random = createRandom(Number(maze.seed ?? hashString(maze.id ?? 'maze')))
  const reserved = getReservedCellKeys(maze)
  const candidates = allCells(maze).filter((cell) => !reserved.has(cellKey(cell)))
  const monsters = [
    { type: 'minotaur' },
    { type: 'werewolf' },
    { hand: random() < 0.5 ? 'left' : 'right', type: 'spider' }
  ]

  return monsters.map((monster, index) => {
    const candidateIndex = Math.floor(random() * candidates.length)
    const cell = candidates.splice(candidateIndex, 1)[0] ?? { x: index, y: index }

    reserved.add(cellKey(cell))
    return {
      ...monster,
      cell
    }
  })
}

function cloneMonster(monster) {
  return {
    ...monster,
    cell: { ...monster.cell },
    lastPath: [...(monster.lastPath ?? [])]
  }
}

function createPlayerState(maze, direction) {
  return {
    cell: { ...(maze.playerStart?.cell ?? maze.opening.cell) },
    direction,
    hasSword: false,
    hasTrophy: false
  }
}

export function getExitForMove(maze, cell, direction) {
  const exits = Array.isArray(maze.levelExits) && maze.levelExits.length > 0
    ? maze.levelExits
    : [maze.opening]

  return exits.find((exit) => (
    cellKey(exit.cell) === cellKey(cell) &&
    exit.side === direction
  )) ?? null
}

function getPathDistanceToEntrance(maze, openEdges, from) {
  if (cellKey(from) === cellKey(maze.opening.cell)) {
    return 0
  }

  const queue = [{ cell: from, distance: 0 }]
  const visited = new Set([cellKey(from)])

  while (queue.length > 0) {
    const current = queue.shift()

    if (cellKey(current.cell) === cellKey(maze.opening.cell)) {
      return current.distance
    }

    for (const direction of DIRECTIONS) {
      if (!canMove(maze, openEdges, current.cell, direction)) {
        continue
      }

      const next = getNeighbor(current.cell, direction)
      const key = cellKey(next)

      if (visited.has(key)) {
        continue
      }

      visited.add(key)
      queue.push({
        cell: next,
        distance: current.distance + 1
      })
    }
  }

  return Number.POSITIVE_INFINITY
}

function chooseShortestEntranceDirection(maze, openEdges, cell) {
  let best = null

  for (const direction of DIRECTIONS) {
    if (!canMove(maze, openEdges, cell, direction)) {
      continue
    }

    const nextCell = getNeighbor(cell, direction)
    const distance = getPathDistanceToEntrance(maze, openEdges, nextCell)

    if (!best || distance < best.distance) {
      best = { direction, distance }
    }
  }

  return best?.direction ?? null
}

function chooseInitialSpiderDirection(maze, openEdges, monster) {
  let best = null

  for (const facingDirection of DIRECTIONS) {
    const candidateMoveDirection = chooseSpiderDirection(maze, openEdges, {
      ...monster,
      direction: facingDirection
    })

    if (!candidateMoveDirection) {
      continue
    }

    const nextCell = getNeighbor(monster.cell, candidateMoveDirection)
    const distance = getPathDistanceToEntrance(maze, openEdges, nextCell)
    const facesMoveCell = facingDirection === candidateMoveDirection ? 0 : 1

    if (
      !best ||
      facesMoveCell < best.facesMoveCell ||
      (
        facesMoveCell === best.facesMoveCell &&
        distance < best.distance
      )
    ) {
      best = {
        direction: candidateMoveDirection,
        distance,
        facesMoveCell
      }
    }
  }

  return best?.direction ?? null
}

function chooseInitialMonsterDirection(maze, openEdges, monster) {
  if (monster.direction && canMove(maze, openEdges, monster.cell, monster.direction)) {
    return monster.direction
  }

  if (monster.type === 'spider') {
    return (
      chooseInitialSpiderDirection(maze, openEdges, monster) ??
      chooseShortestEntranceDirection(maze, openEdges, monster.cell) ??
      monster.direction ??
      'south'
    )
  }

  return (
    chooseShortestEntranceDirection(maze, openEdges, monster.cell) ??
    monster.direction ??
    'south'
  )
}

export function createInitialTurnState(maze) {
  const playerDirection =
    maze.playerStart?.direction ??
    OPPOSITE_DIRECTIONS[maze.opening.side] ??
    'north'
  const playerStartCell = maze.playerStart?.cell ?? maze.opening.cell
  const monsterMoveEdges = createMonsterMoveEdgeSet(maze)

  return {
    checkpoint: {
      cell: { ...playerStartCell },
      direction: playerDirection
    },
    dead: false,
    escaped: false,
    monsters: chooseMonsterPlacements(maze).map((monster, index) => ({
      awake: false,
      cell: { ...monster.cell },
      direction: chooseInitialMonsterDirection(maze, monsterMoveEdges, monster),
      hand: monster.hand ?? null,
      id: `${monster.type}-${index}`,
      lastMoveDirection: null,
      lastPath: [],
      lastSeenDirection: null,
      movedPreviousTurn: false,
      type: monster.type
    })),
    player: createPlayerState(maze, playerDirection),
    swordState: maze.sword?.cell ? 'ground' : 'consumed',
    trophyState: maze.trophy?.cell ? 'ground' : 'held',
    turn: 0
  }
}

function cloneState(state) {
  return {
    ...state,
    checkpoint: {
      cell: { ...state.checkpoint.cell },
      direction: state.checkpoint.direction
    },
    monsters: state.monsters.map(cloneMonster),
    player: {
      ...state.player,
      cell: { ...state.player.cell }
    }
  }
}

function getMonsterAt(monsters, cell) {
  return monsters.find((monster) => cellKey(monster.cell) === cellKey(cell)) ?? null
}

function removeMonsterById(monsters, monsterId) {
  const index = monsters.findIndex((monster) => monster.id === monsterId)

  if (index === -1) {
    return null
  }

  const [monster] = monsters.splice(index, 1)
  return monster ?? null
}

function directionBetween(from, to) {
  if (from.x === to.x) {
    return to.y < from.y ? 'north' : 'south'
  }

  if (from.y === to.y) {
    return to.x < from.x ? 'west' : 'east'
  }

  return null
}

function canSeeCell(maze, openEdges, from, to) {
  const direction = directionBetween(from, to)

  if (!direction) {
    return false
  }

  let current = { ...from }

  while (cellKey(current) !== cellKey(to)) {
    if (!canMove(maze, openEdges, current, direction)) {
      return false
    }
    current = getNeighbor(current, direction)
  }

  return true
}

function getVisibleCells(maze, state) {
  const visible = new Set([cellKey(state.player.cell)])
  const openEdges = createBaseOpenEdgeSet(maze)

  for (const direction of DIRECTIONS) {
    let current = { ...state.player.cell }

    while (canMove(maze, openEdges, current, direction)) {
      current = getNeighbor(current, direction)
      visible.add(cellKey(current))
    }
  }

  return visible
}

function shortestPathDirections(maze, openEdges, from, to) {
  const queue = [{ cell: from, path: [] }]
  const visited = new Set([cellKey(from)])

  while (queue.length > 0) {
    const current = queue.shift()

    if (cellKey(current.cell) === cellKey(to)) {
      return current.path
    }

    for (const direction of DIRECTIONS) {
      if (!canMove(maze, openEdges, current.cell, direction)) {
        continue
      }

      const next = getNeighbor(current.cell, direction)
      const key = cellKey(next)

      if (visited.has(key)) {
        continue
      }

      visited.add(key)
      queue.push({
        cell: next,
        path: [...current.path, direction]
      })
    }
  }

  return []
}

function chooseSpiderDirection(maze, openEdges, monster) {
  const turnOrder = monster.hand === 'left'
    ? ['left', 'straight', 'right', 'back']
    : ['right', 'straight', 'left', 'back']
  const candidateDirection = (turn) =>
    turn === 'straight' ? monster.direction : rotateDirection(monster.direction, turn)

  for (const turn of turnOrder) {
    const direction = candidateDirection(turn)

    if (canMove(maze, openEdges, monster.cell, direction)) {
      return direction
    }
  }

  return null
}

function chooseWerewolfDirection(maze, openEdges, monster, playerCell) {
  const path = shortestPathDirections(maze, openEdges, monster.cell, playerCell)
  const bestLength = path.length

  if (bestLength === 0) {
    return {
      direction: null,
      path: []
    }
  }

  const candidateDirections = []

  for (const direction of DIRECTIONS) {
    if (!canMove(maze, openEdges, monster.cell, direction)) {
      continue
    }

    const nextCell = getNeighbor(monster.cell, direction)
    const nextPath = shortestPathDirections(maze, openEdges, nextCell, playerCell)

    if (nextPath.length === 0 && cellKey(nextCell) !== cellKey(playerCell)) {
      continue
    }

    if (nextPath.length !== (bestLength - 1)) {
      continue
    }

    candidateDirections.push({
      direction,
      path: [direction, ...nextPath]
    })
  }

  if (candidateDirections.length === 0) {
    return {
      direction: path[0] ?? null,
      path
    }
  }

  const preferredDirection = monster.lastPath?.[0] ?? null
  const preferredMoveDirection = monster.lastMoveDirection ?? null
  const preferred = (
    candidateDirections.find((candidate) => candidate.direction === preferredDirection) ??
    candidateDirections.find((candidate) => candidate.direction === preferredMoveDirection) ??
    candidateDirections[0]
  )

  return preferred
}

function getGateOtherCell(gate, cell) {
  if (cellKey(gate.from) === cellKey(cell)) {
    return gate.to
  }

  if (cellKey(gate.to) === cellKey(cell)) {
    return gate.from
  }

  return null
}

function getOpenGateIds(maze, state) {
  const occupiedCells = new Set(state.monsters.map((monster) => cellKey(monster.cell)))

  return (maze.gates ?? [])
    .filter((gate) => {
      const otherCell = getGateOtherCell(gate, state.player.cell)

      return otherCell && !occupiedCells.has(cellKey(otherCell))
    })
    .map(getGateId)
}

function createPlayerMoveEdgeSet(maze, state) {
  const openEdges = createMonsterMoveEdgeSet(maze)
  const openGateIds = new Set(getOpenGateIds(maze, state))

  for (const gate of maze.gates ?? []) {
    if (openGateIds.has(getGateId(gate))) {
      openEdges.add(normalizeEdge(gate.from, gate.to))
    }
  }

  return openEdges
}

function isExitMove(maze, state, direction) {
  return Boolean(getExitForMove(maze, state.player.cell, direction))
}

function consumeSword(state) {
  state.player.hasSword = false
  state.swordState = 'consumed'
}

function resolveMonsterTurn(maze, openEdges, visibilityEdges, monster, playerCell) {
  const nextMonster = cloneMonster(monster)
  const sawPlayer = canSeeCell(maze, visibilityEdges, monster.cell, playerCell)
  const wasAwake = monster.awake

  if (sawPlayer) {
    nextMonster.awake = true
    nextMonster.lastSeenDirection = directionBetween(monster.cell, playerCell)
    if (nextMonster.lastSeenDirection) {
      nextMonster.direction = nextMonster.lastSeenDirection
    }
  }

  if (!wasAwake) {
    return nextMonster
  }

  let moveDirection = null

  if (monster.type === 'minotaur') {
    moveDirection = sawPlayer
      ? directionBetween(monster.cell, playerCell)
      : monster.lastSeenDirection

    if (!moveDirection || !canMove(maze, openEdges, monster.cell, moveDirection)) {
      nextMonster.awake = false
      nextMonster.movedPreviousTurn = false
      return nextMonster
    }
  } else if (monster.type === 'spider') {
    moveDirection = chooseSpiderDirection(maze, openEdges, monster)
  } else if (monster.type === 'werewolf') {
    if (monster.movedPreviousTurn) {
      nextMonster.movedPreviousTurn = false
      return nextMonster
    }

    const pathChoice = chooseWerewolfDirection(maze, openEdges, monster, playerCell)
    moveDirection = pathChoice.direction
    nextMonster.lastPath = pathChoice.path
  }

  if (!moveDirection || !canMove(maze, openEdges, monster.cell, moveDirection)) {
    nextMonster.movedPreviousTurn = false
    return nextMonster
  }

  nextMonster.cell = getNeighbor(monster.cell, moveDirection)
  nextMonster.direction = moveDirection
  nextMonster.lastMoveDirection = moveDirection
  nextMonster.movedPreviousTurn = true

  return nextMonster
}

function resolvePlayerPickups(maze, state, outcome) {
  if (
    maze.sword?.cell &&
    state.swordState === 'ground' &&
    cellKey(state.player.cell) === cellKey(maze.sword.cell)
  ) {
    state.player.hasSword = true
    state.swordState = 'held'
    outcome.pickedUpSword = true
  }

  if (
    maze.trophy?.cell &&
    state.trophyState === 'ground' &&
    cellKey(state.player.cell) === cellKey(maze.trophy.cell)
  ) {
    state.player.hasTrophy = true
    state.trophyState = 'held'
    outcome.pickedUpTrophy = true
  }
}

export function applyTurnAction(maze, state, action) {
  const visibilityEdges = createBaseOpenEdgeSet(maze)
  const playerMoveEdges = createPlayerMoveEdgeSet(maze, state)
  const monsterMoveEdges = createMonsterMoveEdgeSet(maze)
  const next = cloneState(state)
  const outcome = {
    blocked: false,
    escaped: false,
    killed: false,
    pickedUpSword: false,
    pickedUpTrophy: false,
    playerEffect: null,
    previous: state,
    levelTransition: null,
    state: next
  }

  if (state.dead || state.escaped) {
    return outcome
  }

  if (action === 'rotate-left' || action === 'rotate-right') {
    next.player.direction = rotateDirection(
      next.player.direction,
      action === 'rotate-left' ? 'left' : 'right'
    )
    return outcome
  }

  const moveDirection = action === 'move-backward'
    ? OPPOSITE_DIRECTIONS[next.player.direction]
    : next.player.direction

  const levelExit = getExitForMove(maze, next.player.cell, moveDirection)

  if (levelExit) {
    if (maze.exitRequiresTrophy !== false && !next.player.hasTrophy) {
      outcome.blocked = true
      return outcome
    }

    if (levelExit.targetLevelId) {
      next.player.cell = getNeighbor(next.player.cell, moveDirection)
      next.turn += 1
      outcome.levelTransition = {
        direction: moveDirection,
        exit: {
          ...levelExit,
          cell: { ...levelExit.cell }
        },
        targetLevelId: levelExit.targetLevelId
      }
      return outcome
    }

    next.escaped = true
    next.turn += 1
    outcome.escaped = true
    outcome.playerEffect = 'escape'
    return outcome
  }

  if (!moveDirection || !canMove(maze, playerMoveEdges, next.player.cell, moveDirection)) {
    outcome.blocked = true
    return outcome
  }

  const nextPlayerCell = getNeighbor(next.player.cell, moveDirection)
  const blockingMonster = getMonsterAt(next.monsters, nextPlayerCell)

  if (blockingMonster) {
    if (!next.player.hasSword) {
      next.player.cell = nextPlayerCell
      next.dead = true
      outcome.killed = true
      outcome.playerEffect = 'death'
      return outcome
    }

    removeMonsterById(next.monsters, blockingMonster.id)
    consumeSword(next)
    outcome.playerEffect = 'sword-strike'
  }

  next.player.cell = nextPlayerCell
  resolvePlayerPickups(maze, next, outcome)

  const movedMonsters = []

  for (const monster of next.monsters) {
    const movedMonster = resolveMonsterTurn(
      maze,
      monsterMoveEdges,
      visibilityEdges,
      monster,
      next.player.cell
    )

    if (cellKey(movedMonster.cell) === cellKey(next.player.cell)) {
      if (!next.player.hasSword) {
        movedMonsters.push(movedMonster)
        next.dead = true
        outcome.killed = true
        outcome.playerEffect = 'death'
        break
      }

      consumeSword(next)
      outcome.playerEffect = 'sword-strike'
      continue
    }

    movedMonsters.push(movedMonster)
  }

  next.monsters = movedMonsters
  next.turn += 1

  return outcome
}

export function resetTurnStateToCheckpoint(maze, state) {
  const resetState = createInitialTurnState(maze)

  return {
    ...resetState,
    checkpoint: {
      cell: { ...state.checkpoint.cell },
      direction: state.checkpoint.direction
    }
  }
}

export {
  DIRECTIONS,
  OPPOSITE_DIRECTIONS,
  canSeeCell,
  canMove,
  cellKey,
  chooseSpiderDirection,
  createBaseOpenEdgeSet,
  createMonsterMoveEdgeSet,
  createPlayerMoveEdgeSet,
  getNeighbor,
  getOpenGateIds,
  getVisibleCells,
  normalizeEdge,
  rotateDirection,
  shortestPathDirections
}
