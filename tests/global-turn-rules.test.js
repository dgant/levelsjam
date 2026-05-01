import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthoredRuntimeMaze } from '../src/lib/levels.js'
import {
  activateGlobalTurnStateLevel,
  applyGlobalTurnActionForLevel,
  createInitialGlobalTurnState,
  ensureGlobalTurnStateLevel,
  getGlobalTurnStateForLevel,
  replaceGlobalTurnStateForLevel,
  resetGlobalTurnStateAllLevels,
  resetGlobalTurnStateLevel
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
  const hallway = await authoredLayout('hallway-1-1')
  let globalState = createInitialGlobalTurnState(entrance, [hallway])

  assert.equal(Object.prototype.hasOwnProperty.call(globalState, 'levelStates'), false)

  let result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')

  assert.equal(result.outcome.levelTransition, null)
  globalState = result.state

  result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')
  assert.equal(result.outcome.levelTransition, null)
  globalState = result.state

  result = applyGlobalTurnActionForLevel(globalState, entrance.maze.id, entrance.maze, 'move-forward')

  assert.equal(result.outcome.blocked, false)
  assert.deepEqual(result.outcome.levelTransition, { targetLevelId: 'hallway-1-1' })
  assert.deepEqual(
    result.state.player.cell,
    localCellToWorldCell(entrance, { x: 1, y: -1 })
  )

  const focused = activateGlobalTurnStateLevel(result.state, hallway)
  const hallwayState = getGlobalTurnStateForLevel(focused, hallway.maze.id, hallway.maze)

  assert.equal(focused.activeLevelId, 'hallway-1-1')
  assert.deepEqual(focused.player.cell, result.state.player.cell)
  assert.deepEqual(hallwayState.player.cell, { x: 0, y: 2 })
  assert.equal(hallwayState.player.direction, 'north')
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

test('activating a reset side level uses that level player start', () => {
  const sourceLayout = layout(testMaze())
  const sideLayout = layout(testMaze({
    id: 'side-level',
    opening: { cell: { x: 0, y: 1 }, side: 'west' },
    playerStart: {
      cell: { x: 0, y: 1 },
      direction: 'east'
    },
    sword: null
  }))
  const movedSourceState = applyGlobalTurnActionForLevel(
    createInitialGlobalTurnState(sourceLayout),
    sourceLayout.maze.id,
    sourceLayout.maze,
    'move-forward'
  ).state
  const activatedSideState = activateGlobalTurnStateLevel(
    ensureGlobalTurnStateLevel(movedSourceState, sideLayout),
    sideLayout
  )
  const resetSideState = resetGlobalTurnStateLevel(activatedSideState, sideLayout)
  const sideTurnState = getGlobalTurnStateForLevel(
    resetSideState,
    sideLayout.maze.id,
    sideLayout.maze
  )

  assert.equal(resetSideState.activeLevelId, 'side-level')
  assert.deepEqual(sideTurnState.player.cell, { x: 0, y: 1 })
  assert.equal(sideTurnState.player.direction, 'east')
})

test('resetting all global levels clears active monster state after death', async () => {
  const hallway = await authoredLayout('hallway-1-2')
  const nextHallway = await authoredLayout('hallway-1-3')
  let globalState = createInitialGlobalTurnState(hallway, [nextHallway])

  for (const action of ['move-forward', 'move-backward', 'rotate-left', 'move-backward']) {
    globalState = applyGlobalTurnActionForLevel(
      globalState,
      hallway.maze.id,
      hallway.maze,
      action
    ).state
  }

  assert.notDeepEqual(
    getGlobalTurnStateForLevel(globalState, hallway.maze.id, hallway.maze).monsters[0].cell,
    { x: 0, y: 0 }
  )

  const resetState = resetGlobalTurnStateAllLevels(globalState)
  const resetHallwayState = getGlobalTurnStateForLevel(
    resetState,
    hallway.maze.id,
    hallway.maze
  )

  assert.deepEqual(resetHallwayState.player.cell, { x: 0, y: 2 })
  assert.equal(resetHallwayState.player.direction, 'north')
  assert.deepEqual(resetHallwayState.monsters[0].cell, { x: 0, y: 0 })
  assert.equal(resetHallwayState.monsters[0].awake, false)
  assert.equal(resetHallwayState.monsters[0].lastSeenDirection, null)
})

test('Hallway 1-2 recorded solution reaches Hallway 1-3', async () => {
  const hallway = await authoredLayout('hallway-1-2')
  const nextHallway = await authoredLayout('hallway-1-3')
  let globalState = createInitialGlobalTurnState(hallway, [nextHallway])
  let transition = null

  for (const action of hallway.maze.solution.actions) {
    const result = applyGlobalTurnActionForLevel(
      globalState,
      hallway.maze.id,
      hallway.maze,
      action
    )

    assert.equal(result.outcome.blocked, false, `solution action blocked: ${action}`)
    assert.equal(result.outcome.killed, false, `solution action killed player: ${action}`)
    transition = result.outcome.levelTransition
    globalState = result.state

    if (transition) {
      break
    }
  }

  assert.deepEqual(transition, { targetLevelId: 'hallway-1-3' })
})

test('graph-excluded side levels do not inherit overlapping story layouts', () => {
  const sourceLayout = layout(testMaze())
  const sideLayout = layout(testMaze({
    id: 'challenge-001',
    opening: { cell: { x: 0, y: 1 }, side: 'west' },
    openEdges: [
      { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }
    ],
    playerStart: {
      cell: { x: 0, y: 1 },
      direction: 'east'
    },
    sword: null,
    width: 3
  }))
  const isolatedSideState = createInitialGlobalTurnState(sideLayout)
  const result = applyGlobalTurnActionForLevel(
    isolatedSideState,
    sideLayout.maze.id,
    sideLayout.maze,
    'move-forward'
  )
  const sideTurnState = getGlobalTurnStateForLevel(
    result.state,
    sideLayout.maze.id,
    sideLayout.maze
  )

  assert.equal(Object.keys(isolatedSideState.levelLayouts).includes(sourceLayout.maze.id), false)
  assert.equal(result.outcome.levelTransition, null)
  assert.deepEqual(sideTurnState.player.cell, { x: 1, y: 1 })
  assert.equal(sideTurnState.turn, 1)
})
