import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  createAuthoredRuntimeMaze,
  getAdjacentRuntimeLevelIds,
  getDefaultRuntimeLevelId,
  getDirectedRuntimeLevelGraph,
  getRuntimeLevelWorldTransform,
  getRuntimeLevelGraphRootId,
  parseLevelSpec,
  resolveRuntimeMazeIdForLevel
} from '../src/lib/levels.js'
import { getAdjacentLevelVisibleCellKeys } from '../src/lib/levelVisibility.js'
import { getMazeWallSegments } from '../src/lib/maze.js'

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

test('authored runtime levels are real level ids with authored payloads', async () => {
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

  const entrance = await createAuthoredRuntimeMaze('entrance')

  assert.equal(entrance.id, 'entrance')
  assert.equal(entrance.width, 3)
  assert.equal(entrance.height, 3)
  assert.equal(entrance.playerStart.direction, 'north')
  assert.equal(entrance.exitRequiresTrophy, false)
  assert.equal(entrance.lightmap, undefined)
})

test('runtime level graph keeps authored neighbors and spatial transforms explicit', () => {
  assert.deepEqual(getAdjacentRuntimeLevelIds('entrance'), ['chamber-1'])
  assert.deepEqual(
    getAdjacentRuntimeLevelIds('chamber-1'),
    ['entrance', 'maze-001', 'maze-002', 'maze-003', 'maze-005']
  )

  assert.deepEqual(getRuntimeLevelWorldTransform('entrance'), { x: 0, z: 0, rotationY: 0 })
  assert.deepEqual(getRuntimeLevelWorldTransform('chamber-1'), { x: 0, z: -21, rotationY: 0 })
  assert.equal(getRuntimeLevelWorldTransform('maze-001').rotationY, Math.PI)
})

test('directed runtime level graph is rooted at Entrance and acyclic', () => {
  const graph = getDirectedRuntimeLevelGraph()
  const root = getRuntimeLevelGraphRootId()
  const visited = new Set()
  const visiting = new Set()

  function visit(id) {
    assert.equal(visiting.has(id), false, `cycle includes ${id}`)
    if (visited.has(id)) {
      return
    }

    visiting.add(id)
    for (const target of graph[id] ?? []) {
      visit(target)
    }
    visiting.delete(id)
    visited.add(id)
  }

  visit(root)
  assert.deepEqual([...visited].sort(), Object.keys(graph).sort())
})

function cellWorldBounds(maze, transform, cell) {
  const minX = -((maze.width * 2) / 2) + (cell.x * 2)
  const minZ = -((maze.height * 2) / 2) + (cell.y * 2)
  const corners = [
    { x: minX, z: minZ },
    { x: minX + 2, z: minZ },
    { x: minX, z: minZ + 2 },
    { x: minX + 2, z: minZ + 2 }
  ]
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  const transformed = corners.map((corner) => ({
    x: transform.x + (corner.x * cos) + (corner.z * sin),
    z: transform.z - (corner.x * sin) + (corner.z * cos)
  }))

  return {
    maxX: Math.max(...transformed.map((corner) => corner.x)),
    maxZ: Math.max(...transformed.map((corner) => corner.z)),
    minX: Math.min(...transformed.map((corner) => corner.x)),
    minZ: Math.min(...transformed.map((corner) => corner.z))
  }
}

function boundsOverlap(a, b) {
  const epsilon = 1e-6

  return (
    a.minX < b.maxX - epsilon &&
    a.maxX > b.minX + epsilon &&
    a.minZ < b.maxZ - epsilon &&
    a.maxZ > b.minZ + epsilon
  )
}

function transformBounds(bounds, transform) {
  const corners = [
    { x: bounds.minX, z: bounds.minZ },
    { x: bounds.minX, z: bounds.maxZ },
    { x: bounds.maxX, z: bounds.minZ },
    { x: bounds.maxX, z: bounds.maxZ }
  ]
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  const transformed = corners.map((corner) => ({
    x: transform.x + (corner.x * cos) + (corner.z * sin),
    z: transform.z - (corner.x * sin) + (corner.z * cos)
  }))

  return {
    maxX: Math.max(...transformed.map((corner) => corner.x)),
    maxZ: Math.max(...transformed.map((corner) => corner.z)),
    minX: Math.min(...transformed.map((corner) => corner.x)),
    minZ: Math.min(...transformed.map((corner) => corner.z))
  }
}

function transformPoint(point, transform) {
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return {
    x: transform.x + (point.x * cos) + (point.z * sin),
    z: transform.z - (point.x * sin) + (point.z * cos)
  }
}

function wallWorldAxis(wall, transform) {
  const normalizedYaw =
    ((wall.yaw + transform.rotationY) % Math.PI + Math.PI) % Math.PI

  return Math.abs(normalizedYaw) < 1e-6 ? 'x' : 'z'
}

function loadRuntimeMaze(levelId) {
  const maze = JSON.parse(
    fs.readFileSync(new URL(`../public/maze-data/${levelId}.json`, import.meta.url), 'utf8')
  )

  if (!levelId.match(/^maze-\d{3}$/) || !maze.opening) {
    return maze
  }

  return {
    ...maze,
    exteriorOpenings: Array.from(
      { length: maze.opening.side === 'east' || maze.opening.side === 'west' ? maze.height : maze.width },
      (_, index) => ({
        cell:
          maze.opening.side === 'west'
            ? { x: 0, y: index }
            : maze.opening.side === 'east'
              ? { x: maze.width - 1, y: index }
              : maze.opening.side === 'north'
                ? { x: index, y: 0 }
                : { x: index, y: maze.height - 1 },
        side: maze.opening.side
      })
    )
  }
}

test('runtime level cell footprints do not overlap', () => {
  const levelIds = Object.keys(getDirectedRuntimeLevelGraph())
  const bounds = []

  for (const levelId of levelIds) {
    const maze = loadRuntimeMaze(levelId)
    const transform = getRuntimeLevelWorldTransform(levelId)

    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        bounds.push({
          bounds: cellWorldBounds(maze, transform, { x, y }),
          id: `${levelId}:${x},${y}`
        })
      }
    }
  }

  for (let index = 0; index < bounds.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < bounds.length; otherIndex += 1) {
      assert.equal(
        boundsOverlap(bounds[index].bounds, bounds[otherIndex].bounds),
        false,
        `${bounds[index].id} overlaps ${bounds[otherIndex].id}`
      )
    }
  }
})

test('runtime level wall volumes are not shared between levels', () => {
  const levelIds = Object.keys(getDirectedRuntimeLevelGraph())
  const walls = []

  for (const levelId of levelIds) {
    const maze = loadRuntimeMaze(levelId)
    const transform = getRuntimeLevelWorldTransform(levelId)

    for (const wall of getMazeWallSegments(maze)) {
      const center = transformPoint(wall.center, transform)
      walls.push({
        axis: wallWorldAxis(wall, transform),
        bounds: transformBounds(wall.bounds, transform),
        center,
        id: `${levelId}:${wall.id}`,
        levelId
      })
    }
  }

  for (let index = 0; index < walls.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < walls.length; otherIndex += 1) {
      if (walls[index].levelId === walls[otherIndex].levelId) {
        continue
      }

      if (walls[index].axis !== walls[otherIndex].axis) {
        continue
      }

      assert.equal(
        boundsOverlap(walls[index].bounds, walls[otherIndex].bounds) &&
          (
            walls[index].axis === 'x'
              ? Math.abs(walls[index].center.z - walls[otherIndex].center.z) < 1e-6
              : Math.abs(walls[index].center.x - walls[otherIndex].center.x) < 1e-6
          ),
        false,
        `${walls[index].id} overlaps ${walls[otherIndex].id}`
      )
    }
  }
})

test('adjacent streamed levels expose cells visible from the destination ingress under PVS', () => {
  const chamber = {
    height: 18,
    id: 'chamber-1',
    levelExits: [
      { cell: { x: 0, y: 3 }, side: 'west', targetLevelId: 'maze-001' },
      { cell: { x: 4, y: 12 }, side: 'east', targetLevelId: 'maze-005' }
    ],
    opening: { cell: { x: 2, y: 17 }, side: 'south' },
    playerStart: { cell: { x: 2, y: 17 }, direction: 'north' },
    width: 5
  }
  const maze = {
    height: 7,
    id: 'maze-001',
    opening: { cell: { x: 0, y: 5 }, side: 'west' },
    playerStart: { cell: { x: 0, y: 5 }, direction: 'east' },
    visibility: {
      cells: {
        '0,5': ['0,5', '1,5', '1,4']
      }
    },
    width: 7
  }

  assert.deepEqual(
    getAdjacentLevelVisibleCellKeys(chamber, maze, new Set(['0,3'])),
    ['0,5', '1,5', '1,4']
  )
  assert.deepEqual(
    getAdjacentLevelVisibleCellKeys(chamber, maze, new Set(['4,11'])),
    []
  )
})

test('adjacent streamed parent levels expose cells visible from their reverse exit under PVS', () => {
  const chamber = {
    height: 18,
    id: 'chamber-1',
    levelExits: [
      { cell: { x: 0, y: 3 }, side: 'west', targetLevelId: 'maze-001' }
    ],
    opening: { cell: { x: 2, y: 17 }, side: 'south' },
    playerStart: { cell: { x: 2, y: 17 }, direction: 'north' },
    visibility: {
      cells: {
        '0,3': ['0,3', '1,3', '0,4']
      }
    },
    width: 5
  }
  const maze = {
    height: 7,
    id: 'maze-001',
    levelExits: [
      { cell: { x: 0, y: 5 }, side: 'west', targetLevelId: 'chamber-1' }
    ],
    opening: { cell: { x: 0, y: 5 }, side: 'west' },
    playerStart: { cell: { x: 0, y: 5 }, direction: 'east' },
    width: 7
  }

  assert.deepEqual(
    getAdjacentLevelVisibleCellKeys(maze, chamber, new Set(['0,5'])),
    ['0,3', '1,3', '0,4']
  )
})
