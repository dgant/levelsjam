import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseLevelSpec,
  resolveRuntimeMazeIdForLevel
} from '../src/lib/levels.js'

test('LEVELS markdown parser preserves authored order and descriptions', () => {
  const levels = parseLevelSpec(`
Preamble text is ignored.

 + Entrance
 A 3x3 room.
 Opens to Chamber 1.

 + Chamber 1
 A long room.

 + Maze 1
 A standard maze.
`)

  assert.deepEqual(
    levels.map((level) => level.name),
    ['Entrance', 'Chamber 1', 'Maze 1']
  )
  assert.equal(levels[0].description, 'A 3x3 room.\nOpens to Chamber 1.')
  assert.equal(levels[1].description, 'A long room.')
  assert.equal(levels[2].description, 'A standard maze.')
})

test('level runtime maze resolver maps numbered maze levels when possible', () => {
  const mazeIds = ['maze-001', 'maze-002', 'maze-003']

  assert.equal(
    resolveRuntimeMazeIdForLevel('Maze 2', 4, mazeIds, 'maze-001'),
    'maze-002'
  )
  assert.equal(
    resolveRuntimeMazeIdForLevel('Entrance', 0, mazeIds, null),
    'maze-001'
  )
  assert.equal(
    resolveRuntimeMazeIdForLevel('Unknown', 8, [], 'maze-003'),
    'maze-003'
  )
})
