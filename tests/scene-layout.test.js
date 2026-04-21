import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  MAZE_CELL_SIZE,
  MAZE_HEIGHT,
  MAZE_WIDTH,
  getMazeSceneLayout
} from '../src/lib/maze.js'
import {
  GROUND_Y,
  MAZE_COUNT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BILLBOARD_SIZE,
  WALL_FACE_OFFSET,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH
} from '../src/lib/sceneConstants.js'
import { getDebugMazeLayoutById } from '../src/lib/debugMazeLayouts.js'

const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')

async function importPersistedMaze(fileName) {
  const module = await import(
    `${pathToFileURL(path.join(mazeDirectory, fileName)).href}?verify=${Math.random()}`
  )

  return module.default
}

let defaultMazeLayoutPromise = null

async function getDefaultMazeLayout() {
  defaultMazeLayoutPromise ??= importPersistedMaze('maze-001.js').then((maze) =>
    getMazeSceneLayout(maze, SCONCE_RADIUS)
  )

  return defaultMazeLayoutPromise
}

function decodeBase64Bytes(base64) {
  return Uint8Array.from(Buffer.from(base64, 'base64'))
}

function averageTorchLightmapChannel(bytes, atlasWidth, rect) {
  let sum = 0

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const atlasIndex = ((((rect.y + row) * atlasWidth) + rect.x + column) * 3)
      sum += bytes[atlasIndex]
    }
  }

  return sum / (rect.width * rect.height * 255)
}

function getWallBounds(layout) {
  return layout.walls.map((wall) => ({
    ...wall.bounds
  }))
}

test('keeps at least five persisted mazes available to the runtime', async () => {
  const mazeFiles = fs.readdirSync(mazeDirectory).filter((fileName) => /^maze-\d+\.js$/.test(fileName))
  const firstMaze = await importPersistedMaze(mazeFiles[0])

  assert.ok(mazeFiles.length >= MAZE_COUNT)
  assert.equal(firstMaze.width, MAZE_WIDTH)
  assert.equal(firstMaze.height, MAZE_HEIGHT)
})

test('builds a scene layout from a persisted maze with walls, lights, probes, and a lightmap', async () => {
  const layout = await getDefaultMazeLayout()

  assert.equal(layout.maze.id, 'maze-001')
  assert.ok(layout.walls.length > 0)
  assert.ok(layout.lights.length > 0)
  assert.equal(layout.reflectionProbes.length, layout.maze.width * layout.maze.height)
  assert.ok(layout.maze.lightmap)
})

test('expands the baked ground patch beyond the maze footprint', async () => {
  const layout = await getDefaultMazeLayout()
  const bounds = layout.maze.lightmap.groundBounds

  assert.equal(bounds.centerX, 0)
  assert.equal(bounds.centerZ, 0)
  assert.ok(bounds.width > (MAZE_WIDTH * MAZE_CELL_SIZE))
  assert.ok(bounds.depth > (MAZE_HEIGHT * MAZE_CELL_SIZE))
})

test('uses the requested wall mesh dimensions for maze wall segments', async () => {
  const layout = await getDefaultMazeLayout()

  assert.equal(WALL_WIDTH, 0.25)
  assert.equal(WALL_HEIGHT, 2)
  assert.equal(WALL_LENGTH, 2)

  for (const wall of layout.walls) {
    const width = wall.bounds.maxX - wall.bounds.minX
    const depth = wall.bounds.maxZ - wall.bounds.minZ

    if (wall.axis === 'x') {
      assert.equal(width, WALL_LENGTH)
      assert.equal(depth, WALL_WIDTH)
    } else {
      assert.equal(width, WALL_WIDTH)
      assert.equal(depth, WALL_LENGTH)
    }
  }
})

test('places each sconce one radius outside the wall face on the lit-cell side', async () => {
  const layout = await getDefaultMazeLayout()

  for (const light of layout.lights) {
    const deltaX = light.sconcePosition.x - light.torchPosition.x
    const deltaZ = light.sconcePosition.z - light.torchPosition.z

    assert.equal(deltaX, 0)
    assert.equal(deltaZ, 0)
    assert.equal(light.torchPosition.y, light.sconcePosition.y + (TORCH_BILLBOARD_SIZE / 2))
    assert.equal(
      light.torchPosition.y - (TORCH_BILLBOARD_SIZE / 2),
      light.sconcePosition.y
    )
  }
})

test('sizes the torch billboard to match its wall clearance', () => {
  assert.equal(TORCH_BILLBOARD_SIZE, WALL_FACE_OFFSET)
})

test('exposes wall bounds for collision checks', async () => {
  const layout = await getDefaultMazeLayout()
  const bounds = getWallBounds(layout)

  assert.equal(bounds.length, layout.walls.length)
  assert.ok(bounds.every((wall) => wall.maxY - wall.minY === WALL_HEIGHT))
  assert.ok(bounds.every((wall) => wall.minY === GROUND_Y))
  assert.equal(WALL_FACE_OFFSET, (WALL_WIDTH / 2) + SCONCE_RADIUS)
})

test('keeps the player spawn one meter above the ground', () => {
  assert.deepEqual(PLAYER_SPAWN_POSITION, { x: 0, y: 1, z: 0 })
})

test('provides synthetic 3x3 probe-occlusion layouts for diagnostics', () => {
  const noLights = getDebugMazeLayoutById('debug-probe-occlusion-3x3-no-lights')
  const sealed = getDebugMazeLayoutById('debug-probe-occlusion-3x3-sealed')
  const openNorth = getDebugMazeLayoutById('debug-probe-occlusion-3x3-open-north')

  assert.ok(noLights)
  assert.ok(sealed)
  assert.ok(openNorth)
  assert.equal(noLights.maze.width, 3)
  assert.equal(noLights.maze.height, 3)
  assert.equal(noLights.lights.length, 0)
  assert.equal(sealed.maze.width, 3)
  assert.equal(sealed.maze.height, 3)
  assert.equal(sealed.reflectionProbes.length, 9)
  assert.equal(sealed.lights.length, 8)
  assert.equal(sealed.maze.openEdges.length, 0)
  assert.ok(sealed.maze.lightmap)
  assert.deepEqual(
    sealed.lights.map((light) => `${light.cell.x},${light.cell.y}:${light.side}`).sort(),
    [
      '0,0:west',
      '0,1:west',
      '0,2:west',
      '1,0:north',
      '1,2:south',
      '2,0:east',
      '2,1:east',
      '2,2:east'
    ]
  )
  assert.equal(openNorth.maze.openEdges.length, 1)
  assert.deepEqual(openNorth.maze.openEdges[0], {
    from: { x: 1, y: 0 },
    to: { x: 1, y: 1 }
  })
})

test('keeps the sealed 3x3 center-facing wall lightmap faces dark', () => {
  const sealed = getDebugMazeLayoutById('debug-probe-occlusion-3x3-sealed')

  assert.ok(sealed)

  const bytes = decodeBase64Bytes(sealed.maze.lightmap.dataBase64)
  const centerWallExpectations = [
    { center: { x: 0, z: -1 }, litFace: 'nz', darkFace: 'pz' },
    { center: { x: -1, z: 0 }, litFace: 'nz', darkFace: 'pz' },
    { center: { x: 1, z: 0 }, litFace: 'pz', darkFace: 'nz' },
    { center: { x: 0, z: 1 }, litFace: 'pz', darkFace: 'nz' }
  ]

  for (const expectation of centerWallExpectations) {
    const wall = sealed.walls.find(
      (candidate) =>
        candidate.center.x === expectation.center.x &&
        candidate.center.z === expectation.center.z
    )

    assert.ok(wall, `missing debug wall at ${JSON.stringify(expectation.center)}`)

    const rects = sealed.maze.lightmap.wallRects[wall.id]
    const litAverage = averageTorchLightmapChannel(
      bytes,
      sealed.maze.lightmap.atlasWidth,
      rects[expectation.litFace]
    )
    const darkAverage = averageTorchLightmapChannel(
      bytes,
      sealed.maze.lightmap.atlasWidth,
      rects[expectation.darkFace]
    )

    assert.ok(
      litAverage > 0.04,
      `expected ${wall.id} ${expectation.litFace} to contain baked torch light, got ${litAverage}`
    )
    assert.ok(
      darkAverage < 0.005,
      `expected ${wall.id} ${expectation.darkFace} to stay dark toward the sealed center cell, got ${darkAverage}`
    )
  }
})
