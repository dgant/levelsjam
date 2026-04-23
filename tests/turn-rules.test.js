import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyTurnAction,
  canSeeCell,
  createInitialTurnState
} from '../src/lib/turnRules.js'

function testMaze(overrides = {}) {
  return {
    height: 3,
    id: 'turn-rules-test',
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
    width: 3,
    ...overrides
  }
}

test('initial turn state starts at the maze entrance facing inward', () => {
  const state = createInitialTurnState(testMaze())

  assert.deepEqual(state.player.cell, { x: 0, y: 1 })
  assert.equal(state.player.direction, 'east')
  assert.equal(state.monsters.length, 3)
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
