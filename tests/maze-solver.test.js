import assert from 'node:assert/strict'
import test from 'node:test'

import { generateMaze, validateMaze } from '../src/lib/maze.js'
import {
  getMazeSolutionMoveBound,
  solveMaze,
  validateRecordedSolution
} from '../src/lib/mazeSolver.js'
import { createInitialTurnState } from '../src/lib/turnRules.js'

test('generated mazes include gates, items, and a recorded winning solution', () => {
  const maze = generateMaze(24680, { bakeLightmap: false })
  const validation = validateMaze(maze, { requireLightmap: false })

  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.equal(maze.gates.length, 4)
  assert.ok(maze.sword?.cell)
  assert.ok(maze.trophy?.cell)
  assert.ok(Array.isArray(maze.solution?.actions))
  assert.ok(maze.solution.actions.length > 0)
  assert.equal(maze.solution.visibilityLimited, true)
  assert.ok(maze.solution.observedCellCount > 0)
})

test('recorded maze solutions replay to a winning escaped state within the move bound', () => {
  const maze = generateMaze(13579, { bakeLightmap: false })
  const replay = validateRecordedSolution(maze)
  const moveBound = getMazeSolutionMoveBound(maze)

  assert.equal(replay.escaped, true)
  assert.equal(replay.state.player.hasTrophy, true)
  assert.ok(replay.moveCount <= moveBound)
})

test('solver finds a winning route for a simple trophy-and-exit maze', () => {
  const maze = {
    gates: [],
    height: 1,
    id: 'solver-test',
    lights: [],
    monsters: [],
    opening: { cell: { x: 0, y: 0 }, side: 'west' },
    openEdges: [
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
    ],
    sword: { cell: { x: 1, y: 0 } },
    trophy: { cell: { x: 1, y: 0 } },
    width: 2
  }
  const solution = solveMaze(maze)

  assert.ok(solution)
  assert.equal(solution.visibilityLimited, true)
  const replay = validateRecordedSolution({
    ...maze,
    solution
  })

  assert.equal(replay.escaped, true)
  assert.ok(solution.actions.length >= 3)
})

test('solver does not use hidden trophy placement before it becomes visible', () => {
  const baseMaze = {
    gates: [],
    height: 3,
    id: 'visibility-test',
    lights: [],
    monsters: [],
    opening: { cell: { x: 2, y: 2 }, side: 'south' },
    openEdges: [
      { from: { x: 2, y: 2 }, to: { x: 2, y: 1 } },
      { from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
      { from: { x: 1, y: 1 }, to: { x: 1, y: 0 } },
      { from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
      { from: { x: 3, y: 1 }, to: { x: 3, y: 0 } }
    ],
    sword: { cell: { x: 4, y: 2 } },
    width: 5
  }
  const leftTrophyMaze = {
    ...baseMaze,
    trophy: { cell: { x: 1, y: 0 } }
  }
  const rightTrophyMaze = {
    ...baseMaze,
    trophy: { cell: { x: 3, y: 0 } }
  }
  const initialState = createInitialTurnState(leftTrophyMaze)

  initialState.player.cell = { x: 2, y: 1 }
  initialState.player.direction = 'north'
  initialState.checkpoint = {
    cell: { ...initialState.checkpoint.cell },
    direction: initialState.checkpoint.direction
  }

  const leftLog = []
  const rightLog = []
  const leftSolution = solveMaze(leftTrophyMaze, {
    debugLog: (entry) => leftLog.push(entry),
    initialState,
    moveBound: 20
  })
  solveMaze(rightTrophyMaze, {
    debugLog: (entry) => rightLog.push(entry),
    initialState,
    moveBound: 20
  })
  const leftFirstAction = leftLog.find((entry) => entry.event === 'act')?.action
  const rightFirstAction = rightLog.find((entry) => entry.event === 'act')?.action

  assert.ok(leftSolution)
  assert.ok(leftFirstAction)
  assert.equal(leftFirstAction, rightFirstAction)
})
