import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AVAILABLE_MAZES,
  DEFAULT_MAZE_LAYOUT,
  MAZE_COUNT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  WALL_FACE_OFFSET,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH,
  getRandomMazeLayout,
  getWallBounds
} from '../src/lib/sceneLayout.js'
import { MAZE_HEIGHT, MAZE_WIDTH } from '../src/lib/maze.js'

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
    assert.equal(light.torchPosition.y, light.sconcePosition.y + 0.25)
  }
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
