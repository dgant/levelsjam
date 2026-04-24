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

function createOpenEdgeSet(maze) {
  return new Set(
    (maze.openEdges ?? []).map((edge) => normalizeEdge(edge.from, edge.to))
  )
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

function chooseMonsterPlacements(maze) {
  if (Array.isArray(maze.monsters) && maze.monsters.length >= 3) {
    return maze.monsters
  }

  const random = createRandom(Number(maze.seed ?? hashString(maze.id ?? 'maze')))
  const reserved = new Set([cellKey(maze.opening.cell)])
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

export function createInitialTurnState(maze) {
  const playerDirection = OPPOSITE_DIRECTIONS[maze.opening.side] ?? 'north'

  return {
    checkpoint: {
      cell: { ...maze.opening.cell },
      direction: playerDirection
    },
    dead: false,
    monsters: chooseMonsterPlacements(maze).map((monster, index) => ({
      awake: false,
      cell: { ...monster.cell },
      direction: 'south',
      hand: monster.hand ?? null,
      id: `${monster.type}-${index}`,
      lastMoveDirection: null,
      lastPath: [],
      lastSeenDirection: null,
      movedPreviousTurn: false,
      type: monster.type
    })),
    player: {
      cell: { ...maze.opening.cell },
      direction: playerDirection
    },
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
    monsters: state.monsters.map((monster) => ({
      ...monster,
      cell: { ...monster.cell },
      lastPath: [...(monster.lastPath ?? [])]
    })),
    player: {
      cell: { ...state.player.cell },
      direction: state.player.direction
    }
  }
}

function getMonsterAt(monsters, cell) {
  return monsters.find((monster) => cellKey(monster.cell) === cellKey(cell)) ?? null
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

function shortestPathStep(maze, openEdges, from, to) {
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

function resolveMonsterTurn(maze, openEdges, monster, playerCell) {
  const nextMonster = {
    ...monster,
    cell: { ...monster.cell },
    lastPath: [...(monster.lastPath ?? [])]
  }
  const sawPlayer = canSeeCell(maze, openEdges, monster.cell, playerCell)
  const wasAwake = monster.awake

  if (sawPlayer) {
    nextMonster.awake = true
    nextMonster.lastSeenDirection = directionBetween(monster.cell, playerCell)
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

    const path = shortestPathStep(maze, openEdges, monster.cell, playerCell)
    moveDirection = path[0] ?? null
    nextMonster.lastPath = path
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

export function applyTurnAction(maze, state, action) {
  const openEdges = createOpenEdgeSet(maze)
  const next = cloneState(state)

  if (action === 'rotate-left' || action === 'rotate-right') {
    next.player.direction = rotateDirection(
      next.player.direction,
      action === 'rotate-left' ? 'left' : 'right'
    )
    return {
      blocked: false,
      killed: false,
      previous: state,
      state: next
    }
  }

  const moveDirection = action === 'move-backward'
    ? OPPOSITE_DIRECTIONS[next.player.direction]
    : next.player.direction

  if (!moveDirection || !canMove(maze, openEdges, next.player.cell, moveDirection)) {
    return {
      blocked: true,
      killed: false,
      previous: state,
      state: next
    }
  }

  if (moveDirection) {
    const nextPlayerCell = getNeighbor(next.player.cell, moveDirection)

    if (getMonsterAt(next.monsters, nextPlayerCell)) {
      next.player.cell = nextPlayerCell
      next.dead = true
      return {
        blocked: false,
        killed: true,
        previous: state,
        state: next
      }
    }

    next.player.cell = nextPlayerCell
  }

  const movedMonsters = next.monsters.map((monster) =>
    resolveMonsterTurn(maze, openEdges, monster, next.player.cell)
  )
  const killed = movedMonsters.some(
    (monster) => cellKey(monster.cell) === cellKey(next.player.cell)
  )

  next.monsters = movedMonsters
  next.dead = killed
  next.turn += 1

  return {
    blocked: false,
    killed,
    previous: state,
    state: next
  }
}

export function resetTurnStateToCheckpoint(state) {
  return {
    ...state,
    dead: false,
    player: {
      cell: { ...state.checkpoint.cell },
      direction: state.checkpoint.direction
    }
  }
}

export { DIRECTIONS, OPPOSITE_DIRECTIONS, canSeeCell, canMove, cellKey, getNeighbor, rotateDirection }
