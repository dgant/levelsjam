import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAuthoredRuntimeMaze,
  getAdjacentRuntimeLevelIds,
  getDefaultRuntimeLevelId,
  getRuntimeLevelWorldTransform,
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
    'entrance'
  )
  assert.equal(
    resolveRuntimeMazeIdForLevel('Unknown', 8, [], 'maze-003'),
    'maze-003'
  )
})

test('authored runtime levels are real level ids with authored payloads', () => {
  assert.equal(getDefaultRuntimeLevelId(), 'entrance')
  assert.equal(
    resolveRuntimeMazeIdForLevel(
      'Chamber 1',
      1,
      ['entrance', 'chamber-1', 'maze-001'],
      null
    ),
    'chamber-1'
  )
  assert.equal(
    resolveRuntimeMazeIdForLevel(
      'Maze 1',
      2,
      ['entrance', 'chamber-1', 'maze-001'],
      null
    ),
    'maze-001'
  )

  const entrance = createAuthoredRuntimeMaze('entrance')

  assert.equal(entrance.id, 'entrance')
  assert.equal(entrance.width, 3)
  assert.equal(entrance.height, 3)
  assert.equal(entrance.playerStart.direction, 'north')
  assert.equal(entrance.exitRequiresTrophy, false)
  assert.ok(entrance.lightmap)
})

test('runtime level graph keeps authored neighbors and spatial transforms explicit', () => {
  assert.deepEqual(getAdjacentRuntimeLevelIds('entrance'), ['chamber-1'])
  assert.deepEqual(
    getAdjacentRuntimeLevelIds('chamber-1'),
    ['entrance', 'maze-001', 'maze-002', 'maze-003', 'maze-005']
  )

  assert.deepEqual(
    getRuntimeLevelWorldTransform('entrance'),
    { x: 0, z: 0, rotationY: 0 }
  )
  assert.equal(getRuntimeLevelWorldTransform('maze-001').rotationY, Math.PI)
})
