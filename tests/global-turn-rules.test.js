import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthoredRuntimeMaze } from '../src/lib/levels.js'
import {
  activateGlobalTurnStateLevel,
  applyGlobalTurnActionForLevel,
  createInitialGlobalTurnState,
  ensureGlobalTurnStateLevel,
  getGlobalTurnStateForLevel,
  replaceGlobalTurnStateForLevel
} from '../src/lib/globalTurnRules.js'
import { localCellToWorldCell } from '../src/lib/worldGrid.js'

async function authoredLayout(id) {
  return {
    maze: await createAuthoredRuntimeMaze(id)
  }
}

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

test('global turns move the canonical player across authored level seams without teleporting', async () => {
  const entrance = await authoredLayout('entrance')
  const chamber = await authoredLayout('chamber-1')
  let globalState = createInitialGlobalTurnState(entrance, [chamber])

  assert.equal(Object.prototype.hasOwnProperty.call(globalState, 'levelStates'), false)

  let result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')

  assert.equal(result.outcome.levelTransition, null)
  globalState = result.state

  result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')
  assert.equal(result.outcome.levelTransition, null)
  globalState = result.state

  result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')

  assert.equal(result.outcome.blocked, false)
  assert.deepEqual(result.outcome.levelTransition, { targetLevelId: 'chamber-1' })
  assert.deepEqual(
    result.state.player.cell,
    localCellToWorldCell(entrance, { x: 1, y: -1 })
  )

  const focused = activateGlobalTurnStateLevel(result.state, chamber)
  const chamberState = getGlobalTurnStateForLevel(focused, chamber.maze.id, chamber.maze)

  assert.equal(focused.activeLevelId, 'chamber-1')
  assert.deepEqual(focused.player.cell, result.state.player.cell)
  assert.deepEqual(chamberState.player.cell, { x: 2, y: 17 })
  assert.equal(chamberState.player.direction, 'north')
})

test('adding a loaded level does not reset existing global pickup state', () => {
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

  assert.equal(Object.prototype.hasOwnProperty.call(withLaterLevel, 'levelStates'), false)
  assert.ok(withLaterLevel.levelLayouts['later-level'])
  assert.equal(preservedSource.player.hasSword, true)
  assert.equal(preservedSource.swordState, 'held')
  assert.equal(preservedSource.turn, 2)
})
