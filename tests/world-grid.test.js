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

function levelTransitions(maze) {
  return [
    ...(maze.levelExits ?? []),
    ...(maze.levelConnections ?? [])
  ]
}

test('world grid aligns the Entrance to first hallway seam as one continuous cell edge', async () => {
  const entrance = await authoredLayout('entrance')
  const hallway = await authoredLayout('hallway-1-1')
  const worldGrid = buildWorldGridFromLayouts([entrance, hallway])
  const entranceExit = entrance.maze.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-1')
  const hallwayIngress = levelTransitions(hallway.maze).find((exit) => exit.targetLevelId === 'entrance')
  const entranceExitWorldCell = localCellToWorldCell(entrance, entranceExit.cell)
  const seamWorldCell = localCellToWorldCell(entrance, getNeighbor(entranceExit.cell, entranceExit.side))
  const hallwayIngressWorldCell = localCellToWorldCell(hallway, hallwayIngress.cell)

  assert.deepEqual(seamWorldCell, hallwayIngressWorldCell)
  assert.equal(worldGrid.openEdges.has(normalizeEdge(entranceExitWorldCell, seamWorldCell)), false)
  assert.ok(worldGrid.playerOnlyOpenEdges.has(normalizeEdge(entranceExitWorldCell, seamWorldCell)))

  const seamOwner = getWorldCellOwner(worldGrid, seamWorldCell)

  assert.ok(seamOwner)
  assert.ok(seamOwner.owners.some((owner) => owner.levelId === 'hallway-1-1'))
  assert.deepEqual(
    getLevelLocalCellForWorldCell(worldGrid, 'hallway-1-1', seamWorldCell),
    hallwayIngress.cell
  )
})

test('world grid rotates level-local directions into canonical world directions', async () => {
  const entrance = await authoredLayout('entrance')

  assert.equal(
    getWorldDirectionForLocalDirection(entrance, { x: 1, y: 0 }, 'north'),
    'north'
  )

  const rotatedMaze = await authoredLayout('throne-room')

  assert.equal(
    getWorldDirectionForLocalDirection(rotatedMaze, { x: 2, y: 7 }, 'north'),
    'north'
  )
})
