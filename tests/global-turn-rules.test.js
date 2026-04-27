import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInitialGlobalTurnState,
  ensureGlobalTurnStateLevel,
  getGlobalTurnStateForLevel,
  replaceGlobalTurnStateForLevel,
  transitionGlobalTurnState
} from '../src/lib/globalTurnRules.js'

function testMaze(overrides = {}) {
  return {
    height: 3,
    id: 'source-level',
    monsters: [],
    opening: { cell: { x: 1, y: 2 }, side: 'south' },
    openEdges: [
      { from: { x: 1, y: 2 }, to: { x: 1, y: 1 } },
      { from: { x: 1, y: 1 }, to: { x: 1, y: 0 } }
    ],
    playerStart: {
      cell: { x: 1, y: 2 },
      direction: 'north'
    },
    sword: { cell: { x: 1, y: 1 } },
    trophy: null,
    width: 3,
    ...overrides
  }
}

function layout(maze) {
  return { maze }
}

test('global turn state owns canonical player state across level transition', () => {
  const sourceLayout = layout(testMaze({
    id: 'source-level',
    levelExits: [
      { cell: { x: 1, y: 0 }, side: 'north', targetLevelId: 'target-level' }
    ]
  }))
  const targetLayout = layout(testMaze({
    id: 'target-level',
    levelExits: [
      { cell: { x: 0, y: 1 }, side: 'west', targetLevelId: 'source-level' }
    ],
    opening: { cell: { x: 0, y: 1 }, side: 'west' },
    playerStart: {
      cell: { x: 0, y: 1 },
      direction: 'east'
    },
    sword: null
  }))
  const initial = createInitialGlobalTurnState(sourceLayout, [targetLayout])
  const sourcePreviousState = getGlobalTurnStateForLevel(
    initial,
    sourceLayout.maze.id,
    sourceLayout.maze
  )
  const sourceState = {
    ...sourcePreviousState,
    player: {
      ...sourcePreviousState.player,
      cell: { x: 1, y: -1 },
      hasSword: true
    },
    swordState: 'held',
    turn: 3
  }

  const transitioned = transitionGlobalTurnState({
    sourceLevelId: sourceLayout.maze.id,
    sourcePreviousState,
    sourceState,
    state: initial,
    targetLayout
  })
  const activeTargetState = getGlobalTurnStateForLevel(
    transitioned,
    targetLayout.maze.id,
    targetLayout.maze
  )

  assert.equal(transitioned.activeLevelId, 'target-level')
  assert.deepEqual(transitioned.player.cell, { x: 0, y: 1 })
  assert.equal(transitioned.player.hasSword, true)
  assert.equal(transitioned.player.hasTrophy, false)
  assert.equal(transitioned.turn, 3)
  assert.deepEqual(activeTargetState.player.cell, { x: 0, y: 1 })
  assert.equal(activeTargetState.player.hasSword, true)
  assert.equal(activeTargetState.player.hasTrophy, false)
  assert.equal(activeTargetState.escaped, false)
})

test('adding a loaded level does not reset existing per-level pickup state', () => {
  const sourceLayout = layout(testMaze())
  const laterLayout = layout(testMaze({
    id: 'later-level',
    opening: { cell: { x: 0, y: 0 }, side: 'west' },
    playerStart: {
      cell: { x: 0, y: 0 },
      direction: 'east'
    },
    sword: null
  }))
  const initial = createInitialGlobalTurnState(sourceLayout)
  const sourceState = getGlobalTurnStateForLevel(initial, sourceLayout.maze.id, sourceLayout.maze)
  const pickedUpState = {
    ...sourceState,
    player: {
      ...sourceState.player,
      hasSword: true
    },
    swordState: 'held',
    turn: 2
  }
  const withPickup = replaceGlobalTurnStateForLevel(
    initial,
    sourceLayout.maze.id,
    pickedUpState
  )
  const withLaterLevel = ensureGlobalTurnStateLevel(withPickup, laterLayout)
  const preservedSource = getGlobalTurnStateForLevel(
    withLaterLevel,
    sourceLayout.maze.id,
    sourceLayout.maze
  )

  assert.equal(preservedSource.player.hasSword, true)
  assert.equal(preservedSource.swordState, 'held')
  assert.equal(preservedSource.turn, 2)
  assert.ok(withLaterLevel.levelStates['later-level'])
})
