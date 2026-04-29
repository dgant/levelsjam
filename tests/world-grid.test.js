import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthoredRuntimeMaze } from '../src/lib/levels.js'
import {
  buildWorldGridFromLayouts,
  getLevelLocalCellForWorldCell,
  getWorldCellOwner,
  getWorldDirectionForLocalDirection,
  localCellToWorldCell
} from '../src/lib/worldGrid.js'
import { getNeighbor, normalizeEdge } from '../src/lib/turnRules.js'

async function authoredLayout(id) {
  return {
    maze: await createAuthoredRuntimeMaze(id)
  }
}

test('world grid aligns the Entrance to Chamber 1 seam as one continuous cell edge', async () => {
  const entrance = await authoredLayout('entrance')
  const chamber = await authoredLayout('chamber-1')
  const worldGrid = buildWorldGridFromLayouts([entrance, chamber])
  const entranceExit = entrance.maze.levelExits.find((exit) => exit.targetLevelId === 'chamber-1')
  const chamberIngress = chamber.maze.levelExits.find((exit) => exit.targetLevelId === 'entrance')
  const entranceExitWorldCell = localCellToWorldCell(entrance, entranceExit.cell)
  const seamWorldCell = localCellToWorldCell(entrance, getNeighbor(entranceExit.cell, entranceExit.side))
  const chamberIngressWorldCell = localCellToWorldCell(chamber, chamberIngress.cell)

  assert.deepEqual(seamWorldCell, chamberIngressWorldCell)
  assert.equal(worldGrid.openEdges.has(normalizeEdge(entranceExitWorldCell, seamWorldCell)), false)
  assert.ok(worldGrid.playerOnlyOpenEdges.has(normalizeEdge(entranceExitWorldCell, seamWorldCell)))

  const seamOwner = getWorldCellOwner(worldGrid, seamWorldCell)

  assert.ok(seamOwner)
  assert.ok(seamOwner.owners.some((owner) => owner.levelId === 'chamber-1'))
  assert.deepEqual(
    getLevelLocalCellForWorldCell(worldGrid, 'chamber-1', seamWorldCell),
    chamberIngress.cell
  )
})

test('world grid rotates level-local directions into canonical world directions', async () => {
  const entrance = await authoredLayout('entrance')

  assert.equal(
    getWorldDirectionForLocalDirection(entrance, { x: 1, y: 0 }, 'north'),
    'north'
  )

  const rotatedMaze = {
    ...entrance,
    maze: {
      ...entrance.maze,
      id: 'maze-001'
    }
  }

  assert.equal(
    getWorldDirectionForLocalDirection(rotatedMaze, { x: 1, y: 0 }, 'north'),
    'south'
  )
})
