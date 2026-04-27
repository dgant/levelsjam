import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyTurnAction,
  canSeeCell,
  createInitialTurnState,
  getOpenGateIds,
  resetTurnStateToCheckpoint
} from '../src/lib/turnRules.js'

function testMaze(overrides = {}) {
  return {
    height: 3,
    id: 'turn-rules-test',
    gates: [
      {
        from: { x: 1, y: 1 },
        to: { x: 1, y: 2 }
      }
    ],
    monsters: [
      { cell: { x: 2, y: 1 }, type: 'minotaur' },
      { cell: { x: 2, y: 2 }, type: 'werewolf' },
      { cell: { x: 0, y: 2 }, hand: 'left', type: 'spider' }
    ],
    opening: { cell: { x: 0, y: 1 }, side: 'west' },
    openEdges: [
      { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { from: { x: 2, y: 1 }, to: { x: 2, y: 2 } },
      { from: { x: 1, y: 1 }, to: { x: 1, y: 2 } },
      { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
      { from: { x: 1, y: 2 }, to: { x: 2, y: 2 } }
    ],
    sword: { cell: { x: 1, y: 1 } },
    trophy: { cell: { x: 2, y: 2 } },
    width: 3,
    ...overrides
  }
}

function edgeFromDirection(cell, direction) {
  const deltas = {
    east: { x: 1, y: 0 },
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 }
  }
  const delta = deltas[direction]

  return {
    from: cell,
    to: {
      x: cell.x + delta.x,
      y: cell.y + delta.y
    }
  }
}

function resolveAwakeSpiderMove(hand, openDirections) {
  const spiderCell = { x: 2, y: 2 }
  const maze = testMaze({
    gates: [],
    height: 5,
    monsters: [
      { cell: spiderCell, hand, type: 'spider' }
    ],
    openEdges: [
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      ...openDirections.map((direction) => edgeFromDirection(spiderCell, direction))
    ],
    opening: { cell: { x: 0, y: 0 }, side: 'west' },
    sword: null,
    trophy: null,
    width: 5
  })
  const state = createInitialTurnState(maze)

  state.monsters[0] = {
    ...state.monsters[0],
    awake: true,
    direction: 'north'
  }

  return applyTurnAction(maze, state, 'move-forward').state.monsters[0]
}

test('initial turn state starts at the maze entrance facing inward', () => {
  const state = createInitialTurnState(testMaze())

  assert.deepEqual(state.player.cell, { x: 0, y: 1 })
  assert.equal(state.player.direction, 'east')
  assert.equal(state.player.hasSword, false)
  assert.equal(state.player.hasTrophy, false)
  assert.equal(state.swordState, 'ground')
  assert.equal(state.trophyState, 'ground')
  assert.equal(state.monsters.length, 3)
})

test('initial turn state does not treat an absent trophy as held', () => {
  const state = createInitialTurnState(testMaze({
    trophy: null
  }))

  assert.equal(state.player.hasTrophy, false)
  assert.equal(state.trophyState, 'consumed')
})

test('left-wall spiders prefer left, straight, right, then backwards', () => {
  assert.deepEqual(resolveAwakeSpiderMove('left', ['west', 'north', 'east', 'south']).cell, { x: 1, y: 2 })
  assert.equal(resolveAwakeSpiderMove('left', ['west', 'north', 'east', 'south']).direction, 'west')
  assert.deepEqual(resolveAwakeSpiderMove('left', ['north', 'east', 'south']).cell, { x: 2, y: 1 })
  assert.equal(resolveAwakeSpiderMove('left', ['north', 'east', 'south']).direction, 'north')
  assert.deepEqual(resolveAwakeSpiderMove('left', ['east', 'south']).cell, { x: 3, y: 2 })
  assert.equal(resolveAwakeSpiderMove('left', ['east', 'south']).direction, 'east')
  assert.deepEqual(resolveAwakeSpiderMove('left', ['south']).cell, { x: 2, y: 3 })
  assert.equal(resolveAwakeSpiderMove('left', ['south']).direction, 'south')
})

test('right-wall spiders prefer right, straight, left, then backwards', () => {
  assert.deepEqual(resolveAwakeSpiderMove('right', ['west', 'north', 'east', 'south']).cell, { x: 3, y: 2 })
  assert.equal(resolveAwakeSpiderMove('right', ['west', 'north', 'east', 'south']).direction, 'east')
  assert.deepEqual(resolveAwakeSpiderMove('right', ['west', 'north', 'south']).cell, { x: 2, y: 1 })
  assert.equal(resolveAwakeSpiderMove('right', ['west', 'north', 'south']).direction, 'north')
  assert.deepEqual(resolveAwakeSpiderMove('right', ['west', 'south']).cell, { x: 1, y: 2 })
  assert.equal(resolveAwakeSpiderMove('right', ['west', 'south']).direction, 'west')
  assert.deepEqual(resolveAwakeSpiderMove('right', ['south']).cell, { x: 2, y: 3 })
  assert.equal(resolveAwakeSpiderMove('right', ['south']).direction, 'south')
})

test('rotation changes player direction without advancing monster turns', () => {
  const maze = testMaze()
  const state = createInitialTurnState(maze)
  const result = applyTurnAction(maze, state, 'rotate-left')

  assert.equal(result.state.player.direction, 'north')
  assert.deepEqual(result.state.player.cell, state.player.cell)
  assert.deepEqual(
    result.state.monsters.map((monster) => monster.cell),
    state.monsters.map((monster) => monster.cell)
  )
  assert.equal(result.state.turn, state.turn)
})

test('sleeping monsters wake on sight and move on a later turn', () => {
  const maze = testMaze()
  const state = createInitialTurnState(maze)
  const firstMove = applyTurnAction(maze, state, 'move-forward').state
  const minotaurAfterWake = firstMove.monsters.find((monster) => monster.type === 'minotaur')

  assert.equal(minotaurAfterWake.awake, true)
  assert.deepEqual(minotaurAfterWake.cell, { x: 2, y: 1 })

  const secondMove = applyTurnAction(maze, firstMove, 'move-backward').state
  const minotaurAfterMove = secondMove.monsters.find((monster) => monster.type === 'minotaur')

  assert.deepEqual(minotaurAfterMove.cell, { x: 1, y: 1 })
})

test('walls block line of sight for monster wakeups', () => {
  const maze = testMaze({
    openEdges: [
      { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }
    ]
  })
  const openEdges = new Set(
    maze.openEdges.map((edge) => {
      const a = `${edge.from.x},${edge.from.y}`
      const b = `${edge.to.x},${edge.to.y}`
      return a < b ? `${a}|${b}` : `${b}|${a}`
    })
  )

  assert.equal(
    canSeeCell(maze, openEdges, { x: 2, y: 1 }, { x: 0, y: 1 }),
    false
  )
})

test('blocked movement reports a bump without consuming a turn', () => {
  const maze = testMaze()
  const state = createInitialTurnState(maze)
  const result = applyTurnAction(maze, state, 'move-backward')

  assert.equal(result.blocked, true)
  assert.equal(result.killed, false)
  assert.deepEqual(result.state.player.cell, state.player.cell)
  assert.equal(result.state.turn, state.turn)
  assert.deepEqual(result.state.monsters, state.monsters)
})

test('adjacent safe gates open for player movement', () => {
  const maze = testMaze({
    monsters: [
      { cell: { x: 2, y: 1 }, type: 'minotaur' }
    ]
  })
  const state = createInitialTurnState(maze)
  const openGateIds = getOpenGateIds(maze, state)

  assert.equal(openGateIds.length, 0)

  const moved = applyTurnAction(maze, state, 'move-forward').state
  assert.deepEqual(getOpenGateIds(maze, moved), ['1,1|1,2'])
})

test('player picks up the sword and kills a monster instead of dying', () => {
  const maze = testMaze({
    gates: [],
    monsters: [
      { cell: { x: 2, y: 1 }, type: 'minotaur' }
    ],
    openEdges: [
      { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }
    ],
    sword: { cell: { x: 1, y: 1 } },
    trophy: { cell: { x: 2, y: 1 } }
  })
  const initial = createInitialTurnState(maze)
  const pickup = applyTurnAction(maze, initial, 'move-forward')

  assert.equal(pickup.killed, false)
  assert.equal(pickup.pickedUpSword, true)
  assert.equal(pickup.state.player.hasSword, true)
  assert.equal(pickup.state.swordState, 'held')

  const strike = applyTurnAction(maze, pickup.state, 'move-forward')

  assert.equal(strike.killed, false)
  assert.equal(strike.playerEffect, 'sword-strike')
  assert.equal(strike.state.player.hasSword, false)
  assert.equal(strike.state.swordState, 'consumed')
  assert.equal(strike.state.monsters.length, 0)
  assert.deepEqual(strike.state.player.cell, { x: 2, y: 1 })
})

test('player can escape only while holding the trophy', () => {
  const maze = testMaze({
    gates: [],
    monsters: [],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'west' },
    sword: { cell: { x: 0, y: 0 } },
    trophy: { cell: { x: 0, y: 0 } },
    width: 1,
    height: 1
  })
  const initial = createInitialTurnState(maze)
  const blockedExit = applyTurnAction(maze, initial, 'move-backward')

  assert.equal(blockedExit.blocked, true)

  const escaped = applyTurnAction(
    maze,
    {
      ...initial,
      player: {
        ...initial.player,
        hasTrophy: true
      },
      trophyState: 'held'
    },
    'move-backward'
  )

  assert.equal(escaped.escaped, true)
  assert.equal(escaped.state.escaped, true)
})

test('authored level exits transition without entering escaped state', () => {
  const maze = testMaze({
    exitRequiresTrophy: false,
    gates: [],
    levelExits: [
      {
        cell: { x: 0, y: 0 },
        side: 'west',
        targetLevelId: 'neighbor-level'
      }
    ],
    monsters: [],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'west' },
    playerStart: {
      cell: { x: 0, y: 0 },
      direction: 'west'
    },
    sword: null,
    trophy: null,
    width: 1,
    height: 1
  })
  const initial = createInitialTurnState(maze)
  const result = applyTurnAction(maze, initial, 'move-forward')

  assert.equal(result.escaped, false)
  assert.equal(result.state.escaped, false)
  assert.equal(result.levelTransition.targetLevelId, 'neighbor-level')
  assert.deepEqual(result.state.player.cell, { x: -1, y: 0 })
})

test('reset restores monsters and items to the initial maze state', () => {
  const maze = testMaze({
    gates: [],
    monsters: [
      { cell: { x: 2, y: 1 }, type: 'minotaur' }
    ],
    openEdges: [
      { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }
    ],
    sword: { cell: { x: 1, y: 1 } },
    trophy: { cell: { x: 2, y: 1 } }
  })
  const initial = createInitialTurnState(maze)
  const pickup = applyTurnAction(maze, initial, 'move-forward').state
  const strike = applyTurnAction(maze, pickup, 'move-forward').state
  const reset = resetTurnStateToCheckpoint(maze, strike)

  assert.deepEqual(reset.player.cell, maze.opening.cell)
  assert.equal(reset.player.hasSword, false)
  assert.equal(reset.swordState, 'ground')
  assert.equal(reset.monsters.length, 1)
})
