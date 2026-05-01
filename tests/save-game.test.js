import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_SAVE_STORAGE_KEY,
  createGameSave,
  readGameSave,
  writeGameSave
} from '../src/lib/saveGame.js'
import {
  getLatestDirectedNonMazeLevelId
} from '../src/lib/levels.js'

function createStorage() {
  const entries = new Map()

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null
    },
    removeItem(key) {
      entries.delete(key)
    },
    setItem(key, value) {
      entries.set(key, String(value))
    }
  }
}

test('save game stores only resume level and permanent progress', () => {
  const save = createGameSave(
    {
      activeLevelId: 'maze-002',
      player: {
        cell: { x: 99, y: 99 },
        direction: 'south',
        levelId: 'maze-002'
      }
    },
    {
      activatedAltarIds: new Set(['altar-b', 'altar-a', 'altar-a']),
      enteredLevelIds: ['entrance', 'chamber-1', 'maze-002'],
      openedPassageways: ['passage-1']
    }
  )

  assert.deepEqual(save.enteredLevelIds, ['chamber-1', 'entrance', 'maze-002'])
  assert.equal(save.lastLevelId, 'maze-002')
  assert.deepEqual(save.litAltars, ['altar-a', 'altar-b'])
  assert.deepEqual(save.openedPassageways, ['passage-1'])
  assert.equal(Object.prototype.hasOwnProperty.call(save, 'player'), false)
})

test('save game round-trips through storage and rejects malformed payloads', () => {
  const storage = createStorage()
  const save = createGameSave(
    { activeLevelId: 'chamber-1', player: { levelId: 'chamber-1' } },
    { litAltars: ['altar-0'] }
  )

  assert.equal(writeGameSave(storage, save), true)
  assert.deepEqual(readGameSave(storage), {
    enteredLevelIds: ['chamber-1'],
    lastLevelId: 'chamber-1',
    litAltars: ['altar-0'],
    openedPassageways: [],
    savedAt: save.savedAt,
    version: save.version
  })

  storage.setItem(GAME_SAVE_STORAGE_KEY, '{"version":999,"lastLevelId":"maze-001"}')
  assert.equal(readGameSave(storage), null)
})

test('legacy saves infer entered levels from last level', () => {
  const storage = createStorage()

  storage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify({
    lastLevelId: 'maze-001',
    litAltars: ['altar-0'],
    openedPassageways: [],
    savedAt: '2026-04-30T00:00:00.000Z',
    version: 1
  }))

  assert.deepEqual(readGameSave(storage), {
    enteredLevelIds: ['maze-001'],
    lastLevelId: 'maze-001',
    litAltars: ['altar-0'],
    openedPassageways: [],
    savedAt: '2026-04-30T00:00:00.000Z',
    version: 2
  })
})

test('resume target chooses the latest entered non-maze level in the directed graph', () => {
  assert.equal(
    getLatestDirectedNonMazeLevelId(['entrance', 'chamber-1', 'maze-003']),
    'chamber-1'
  )
  assert.equal(
    getLatestDirectedNonMazeLevelId(['maze-003']),
    'entrance'
  )
})
