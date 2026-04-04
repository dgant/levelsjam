import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GROUND_Y,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPAWN_POSITION,
  WALL_LAYOUT
} from '../src/lib/sceneLayout.js'
import {
  getCameraPosition,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from '../src/lib/playerCollision.js'

const firstWall = WALL_LAYOUT[0]

test('spawns the player one meter above the ground plane', () => {
  const spawnPosition = getPlayerSpawnPosition()

  assert.deepEqual(spawnPosition, PLAYER_SPAWN_POSITION)
  assert.equal(spawnPosition.y, GROUND_Y + 1)
  assert.equal(spawnPosition.x, 0)
  assert.equal(spawnPosition.z, 0)
})

test('derives the camera position from the capsule base position', () => {
  assert.deepEqual(getCameraPosition({ x: 2, y: 1, z: -3 }), {
    x: 2,
    y: 1 + PLAYER_EYE_HEIGHT,
    z: -3
  })
})

test('clamps the player to the ground plane', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -4, z: 0 }
  )

  assert.deepEqual(result.position, { x: 0, y: GROUND_Y, z: 0 })
  assert.equal(result.collisions.floor, true)
  assert.deepEqual(result.collisions.walls, [])
  assert.equal(result.grounded, true)
})

test('clamps the player to a wall side when moving through it horizontally', () => {
  const result = resolvePlayerCollision(
    { x: firstWall.bounds.minX - 1, y: 0, z: -6 },
    { x: firstWall.position.x, y: 0, z: -6 }
  )

  assert.deepEqual(result.position, {
    x: firstWall.bounds.minX - PLAYER_RADIUS,
    y: 0,
    z: -6
  })
  assert.deepEqual(result.collisions.walls, [firstWall.id])
  assert.equal(result.grounded, true)
})

test('lands on top of a wall when descending onto it', () => {
  const result = resolvePlayerCollision(
    { x: firstWall.position.x, y: firstWall.bounds.maxY + 1, z: firstWall.position.z },
    { x: firstWall.position.x, y: firstWall.bounds.maxY - 0.2, z: firstWall.position.z }
  )

  assert.deepEqual(result.position, {
    x: firstWall.position.x,
    y: firstWall.bounds.maxY,
    z: firstWall.position.z
  })
  assert.deepEqual(result.collisions.walls, [firstWall.id])
  assert.equal(result.grounded, true)
})

test('accepts custom wall bounds for isolated collision checks', () => {
  const customWall = {
    id: 'custom',
    minX: -1,
    maxX: 1,
    minY: 0,
    maxY: 2,
    minZ: -1,
    maxZ: 1
  }
  const result = resolvePlayerCollision(
    { x: -3, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { wallBounds: [customWall] }
  )

  assert.deepEqual(result.position, { x: customWall.minX - PLAYER_RADIUS, y: 0, z: 0 })
  assert.deepEqual(result.collisions.walls, ['custom'])
  assert.equal(result.grounded, true)
  assert.equal(PLAYER_HEIGHT, 1.75)
})
