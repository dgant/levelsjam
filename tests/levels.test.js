import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  createAuthoredRuntimeMaze,
  getAdjacentRuntimeLevelIds,
  getAuthoredRuntimeLevelIds,
  getDefaultRuntimeLevelId,
  getDirectedRuntimeLevelGraph,
  getRuntimeLevelWorldTransform,
  getRuntimeLevelGraphRootId,
  getStoryMazeParentLevelId,
  isAuthoredRuntimeLevelId,
  parseLevelSpec,
  resolveRuntimeMazeIdForLevel
} from '../src/lib/levels.js'
import { getAdjacentLevelVisibleCellKeys } from '../src/lib/levelVisibility.js'
import { getMazeTorchPlacements, getMazeWallSegments } from '../src/lib/maze.js'

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
  assert.deepEqual(getAdjacentRuntimeLevelIds('entrance'), ['hallway-1-1'])
  assert.deepEqual(
    getAdjacentRuntimeLevelIds('chamber-1'),
    ['hallway-1-5', 'challenge-028', 'challenge-031', 'challenge-059', 'challenge-036', 'chamber-2']
  )

  assert.deepEqual(getRuntimeLevelWorldTransform('entrance'), { x: 0, z: -2, rotationY: 0 })
  assert.equal(getRuntimeLevelWorldTransform('chamber-1').rotationY, 0)
  assert.equal(typeof getRuntimeLevelWorldTransform('challenge-028').x, 'number')
})

test('Chamber 1 exposes four story maze altars and a gated north exit', async () => {
  const chamber = await createAuthoredRuntimeMaze('chamber-1')

  assert.equal(chamber.width, 5)
  assert.equal(chamber.height, 24)
  assert.deepEqual(chamber.roomBounds, { height: 24, width: 5 })
  assert.deepEqual(
    chamber.altars.map((altar) => altar.targetLevelId),
    ['challenge-028', 'challenge-031', 'challenge-059', 'challenge-036']
  )
  assert.deepEqual(
    chamber.levelExits.find((exit) => exit.targetLevelId === 'chamber-2').requiredAltarIds,
    chamber.altars.map((altar) => altar.id)
  )
})

test('Chamber 1 publishes a neutral lightmap while progression e2e is prioritized', async () => {
  const chamber = JSON.parse(fs.readFileSync('maze-data/chamber-1.json', 'utf8'))

  assert.equal(chamber.altars.length, 4)
  assert.equal(chamber.lightmap.encoding, 'rgb16f')
  assert.deepEqual(chamber.lightmap.altarRects, {})
  assert.ok(chamber.sourceSignature.startsWith('neutral-authored:chamber-1'))
})

test('Hallway 1-2 matches the minotaur-door ASCII topology', async () => {
  const hallway = await createAuthoredRuntimeMaze('hallway-1-2')

  assert.deepEqual(
    hallway.cells.filter((cell) => cell.y === 0),
    [{ x: 0, y: 0 }]
  )
  assert.deepEqual(
    hallway.cells.filter((cell) => cell.y === 4),
    [{ x: 0, y: 4 }]
  )
  assert.deepEqual(hallway.monsters, [{ cell: { x: 0, y: 0 }, type: 'minotaur' }])
  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-3'),
    { cell: { x: 0, y: 0 }, side: 'north', targetLevelId: 'hallway-1-3' }
  )
  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-1'),
    undefined
  )
  assert.deepEqual(
    hallway.levelConnections.find((connection) => connection.targetLevelId === 'hallway-1-1'),
    { cell: { x: 0, y: 4 }, side: 'south', targetLevelId: 'hallway-1-1' }
  )
  assert.deepEqual(
    hallway.lights.filter((light) => light.cell.x === 0 && light.cell.y === 0),
    [
      { cell: { x: 0, y: 0 }, side: 'west' },
      { cell: { x: 0, y: 0 }, side: 'east' }
    ]
  )
})

test('Hallway 1-1 renders the single door into Hallway 1-2', async () => {
  const hallway = await createAuthoredRuntimeMaze('hallway-1-1')

  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-2'),
    { cell: { x: 3, y: 0 }, side: 'north', targetLevelId: 'hallway-1-2' }
  )
})

test('Hallway 1-3 matches the gate ASCII topology', async () => {
  const hallway = await createAuthoredRuntimeMaze('hallway-1-3')

  assert.deepEqual(
    hallway.cells.filter((cell) => cell.y === 0),
    [{ x: 0, y: 0 }]
  )
  assert.deepEqual(
    hallway.cells.filter((cell) => cell.y === 5),
    [{ x: 0, y: 5 }]
  )
  assert.deepEqual(hallway.monsters, [{ cell: { x: 0, y: 0 }, type: 'minotaur' }])
  assert.deepEqual(hallway.gates, [
    { from: { x: 1, y: 3 }, id: 'hallway-1-3:gate', to: { x: 2, y: 3 } }
  ])
  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-4'),
    { cell: { x: 0, y: 0 }, side: 'north', targetLevelId: 'hallway-1-4' }
  )
  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-2'),
    undefined
  )
  assert.deepEqual(
    hallway.levelConnections.find((connection) => connection.targetLevelId === 'hallway-1-2'),
    { cell: { x: 0, y: 5 }, side: 'south', targetLevelId: 'hallway-1-2' }
  )
})

test('Hallway 1-4 uses the revised sword-tutorial bend', async () => {
  const hallway = await createAuthoredRuntimeMaze('hallway-1-4')

  assert.deepEqual(
    hallway.cells.filter((cell) => cell.y === 4),
    [{ x: 5, y: 4 }]
  )
  assert.deepEqual(
    hallway.levelConnections.find((connection) => connection.targetLevelId === 'hallway-1-3'),
    { cell: { x: 5, y: 4 }, side: 'south', targetLevelId: 'hallway-1-3' }
  )
  assert.deepEqual(
    hallway.levelExits.find((exit) => exit.targetLevelId === 'hallway-1-5'),
    { cell: { x: 4, y: 0 }, side: 'north', targetLevelId: 'hallway-1-5' }
  )
  assert.deepEqual(hallway.sword, { cell: { x: 5, y: 3 } })
  assert.equal(hallway.trophy, null)
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

function mazeFootprintCells(maze) {
  if (Array.isArray(maze.cells) && maze.cells.length > 0) {
    return maze.cells
  }

  const cells = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function wallWorldAxis(wall, transform) {
  const normalizedYaw =
    ((wall.yaw + transform.rotationY) % Math.PI + Math.PI) % Math.PI

  return Math.abs(normalizedYaw) < 1e-6 ? 'x' : 'z'
}

async function loadRuntimeMaze(levelId) {
  if (isAuthoredRuntimeLevelId(levelId)) {
    return createAuthoredRuntimeMaze(levelId)
  }

  if (levelId === 'werewolf-tutorial') {
    return (await import('../src/data/challenge-mazes/keepers/werewolf-tutorial.js')).default
  }

  if (levelId.match(/^challenge-\d{3}$/)) {
    return (await import(`../src/data/challenge-mazes/${levelId}.js`)).default
  }

  const maze = JSON.parse(
    fs.readFileSync(new URL(`../public/maze-data/${levelId}.json`, import.meta.url), 'utf8')
  )

  if (!levelId.match(/^maze-\d{3}$/) || !maze.opening) {
    return maze
  }

  return {
    ...maze,
    exitRequiresTrophy: false,
    levelExits: [
      ...(maze.levelExits ?? []),
      {
        cell: { ...maze.opening.cell },
        side: maze.opening.side,
        targetLevelId: 'chamber-1'
      }
    ]
  }
}

function exteriorWallId(cell, side) {
  return `${cell.x},${cell.y}:${side}:exterior`
}

function boundaryOpenings(maze) {
  return [
    maze.opening,
    ...(Array.isArray(maze.levelExits) ? maze.levelExits : []),
    ...(Array.isArray(maze.exteriorOpenings) ? maze.exteriorOpenings : [])
  ].filter(Boolean)
}

function expectedExteriorWallIds(maze) {
  const openings = new Set(
    boundaryOpenings(maze).map((opening) => exteriorWallId(opening.cell, opening.side))
  )
  const ids = []

  for (let x = 0; x < maze.width; x += 1) {
    for (const side of ['north', 'south']) {
      const cell = { x, y: side === 'north' ? 0 : maze.height - 1 }
      const id = exteriorWallId(cell, side)

      if (!openings.has(id)) {
        ids.push(id)
      }
    }
  }

  for (let y = 0; y < maze.height; y += 1) {
    for (const side of ['west', 'east']) {
      const cell = { x: side === 'west' ? 0 : maze.width - 1, y }
      const id = exteriorWallId(cell, side)

      if (!openings.has(id)) {
        ids.push(id)
      }
    }
  }

  return ids.sort()
}

test('interior numbered mazes keep exterior boundary walls except the doorway', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL('../public/maze-data/index.json', import.meta.url), 'utf8')
  )

  for (const levelId of manifest.mazeIds.filter((id) => /^maze-\d{3}$/.test(id))) {
    const maze = await loadRuntimeMaze(levelId)
    const exteriorWalls = getMazeWallSegments(maze)
      .filter((wall) => wall.id.endsWith(':exterior'))
      .map((wall) => wall.id)
      .sort()

    assert.deepEqual(
      exteriorWalls,
      expectedExteriorWallIds(maze),
      `${levelId} should preserve every exterior wall except explicit level openings`
    )
  }
})

test('interior numbered maze torches are unique ground-level interior wall fixtures', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL('../public/maze-data/index.json', import.meta.url), 'utf8')
  )

  for (const levelId of manifest.mazeIds.filter((id) => /^maze-\d{3}$/.test(id))) {
    const maze = await loadRuntimeMaze(levelId)
    const wallIds = new Set()

    for (const torch of getMazeTorchPlacements(maze, 0.1)) {
      assert.equal(
        torch.wallId.endsWith(':exterior'),
        false,
        `${levelId}:${torch.id} should not be mounted to an exterior wall`
      )
      assert.equal(
        wallIds.has(torch.wallId),
        false,
        `${levelId}:${torch.wallId} should not receive more than one torch`
      )
      assert.equal(
        torch.sconcePosition.y < 2,
        true,
        `${levelId}:${torch.id} should stay on the ground-level wall segment`
      )
      wallIds.add(torch.wallId)
    }
  }
})

test('runtime level cell footprints do not overlap', async () => {
  const levelIds = Object.keys(getDirectedRuntimeLevelGraph())
  const bounds = []

  for (const levelId of levelIds) {
    const maze = await loadRuntimeMaze(levelId)
    const transform = getRuntimeLevelWorldTransform(levelId)

    for (const cell of mazeFootprintCells(maze)) {
      bounds.push({
        bounds: cellWorldBounds(maze, transform, cell),
        id: `${levelId}:${cell.x},${cell.y}`
      })
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

test('new LEVELS progression authored rooms are implemented', async () => {
  assert.deepEqual(getAuthoredRuntimeLevelIds(), [
    'entrance',
    'hallway-1-1',
    'hallway-1-2',
    'hallway-1-3',
    'hallway-1-4',
    'hallway-1-5',
    'chamber-1',
    'chamber-2',
    'throne-room'
  ])
  const throne = await createAuthoredRuntimeMaze('throne-room')

  assert.equal(throne.altars[0].id, 'throne-altar')
  assert.ok(throne.trophy.cell)
})

test('runtime level wall volumes are not shared between levels', async () => {
  const levelIds = Object.keys(getDirectedRuntimeLevelGraph())
  const walls = []

  for (const levelId of levelIds) {
    const maze = await loadRuntimeMaze(levelId)
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

      if (
        walls[index].id.endsWith(':exterior') &&
        walls[otherIndex].id.endsWith(':exterior') &&
        (
          walls[index].levelId === 'chamber-1' ||
          walls[otherIndex].levelId === 'chamber-1'
        )
      ) {
        continue
      }

      if (
        getAdjacentRuntimeLevelIds(walls[index].levelId).includes(walls[otherIndex].levelId) ||
        getAdjacentRuntimeLevelIds(walls[otherIndex].levelId).includes(walls[index].levelId)
      ) {
        continue
      }

      if (
        getStoryMazeParentLevelId(walls[index].levelId) &&
        getStoryMazeParentLevelId(walls[index].levelId) === getStoryMazeParentLevelId(walls[otherIndex].levelId)
      ) {
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
      { cell: { x: 4, y: 12 }, side: 'east', targetLevelId: 'maze-004' }
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
