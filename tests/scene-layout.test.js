import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AVAILABLE_MAZES,
  DEFAULT_MAZE_LAYOUT,
  MAZE_COUNT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BILLBOARD_SIZE,
  WALL_FACE_OFFSET,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH,
  getDebugMazeLayoutById,
  getRandomMazeLayout,
  getWallBounds
} from '../src/lib/sceneLayout.js'
import { MAZE_CELL_SIZE, MAZE_HEIGHT, MAZE_WIDTH } from '../src/lib/maze.js'

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

test('keeps at least five persisted mazes available to the runtime', () => {
  assert.ok(AVAILABLE_MAZES.length >= MAZE_COUNT)
  assert.ok(AVAILABLE_MAZES.every((maze) => maze.width === MAZE_WIDTH))
  assert.ok(AVAILABLE_MAZES.every((maze) => maze.height === MAZE_HEIGHT))
})

test('returns one of the available mazes when selecting a random layout', () => {
  const layout = getRandomMazeLayout(() => 0)

  assert.equal(layout.maze.id, AVAILABLE_MAZES[0].id)
  assert.ok(layout.walls.length > 0)
  assert.ok(layout.lights.length > 0)
  assert.equal(layout.reflectionProbes.length, layout.maze.width * layout.maze.height)
  assert.ok(layout.maze.lightmap)
})

test('expands the baked ground patch beyond the maze footprint', () => {
  const bounds = DEFAULT_MAZE_LAYOUT.maze.lightmap.groundBounds

  assert.equal(bounds.centerX, 0)
  assert.equal(bounds.centerZ, 0)
  assert.ok(bounds.width > (MAZE_WIDTH * MAZE_CELL_SIZE))
  assert.ok(bounds.depth > (MAZE_HEIGHT * MAZE_CELL_SIZE))
})

test('uses the requested wall mesh dimensions for maze wall segments', () => {
  assert.equal(WALL_WIDTH, 0.25)
  assert.equal(WALL_HEIGHT, 2)
  assert.equal(WALL_LENGTH, 2)

  for (const wall of DEFAULT_MAZE_LAYOUT.walls) {
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

test('places each sconce one radius outside the wall face on the lit-cell side', () => {
  for (const light of DEFAULT_MAZE_LAYOUT.lights) {
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

test('exposes wall bounds for collision checks', () => {
  const bounds = getWallBounds(DEFAULT_MAZE_LAYOUT)

  assert.equal(bounds.length, DEFAULT_MAZE_LAYOUT.walls.length)
  assert.ok(bounds.every((wall) => wall.maxY - wall.minY === WALL_HEIGHT))
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
