import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CUBE_BOUNDS,
  CUBE_SIZE,
  getCameraPosition,
  LOWER_GROUND_Y,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from '../src/lib/playerCollision.js'

test('spawns the player one meter above the cube', () => {
  const spawnPosition = getPlayerSpawnPosition()

  assert.equal(spawnPosition.y, CUBE_BOUNDS.maxY + 1)
  assert.equal(spawnPosition.x, 0)
  assert.equal(spawnPosition.z, 4)
  assert.equal(CUBE_BOUNDS.maxY, CUBE_SIZE)
})

test('derives the camera position from the capsule base position', () => {
  assert.deepEqual(getCameraPosition({ x: 2, y: 10, z: -3 }), {
    x: 2,
    y: 10 + PLAYER_EYE_HEIGHT,
    z: -3
  })
})

test('clamps the player to the cube top when falling into it', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: 11, z: 0 },
    { x: 0, y: 9, z: 0 }
  )

  assert.deepEqual(result.position, { x: 0, y: 10, z: 0 })
  assert.equal(result.collisions.cube, true)
  assert.equal(result.collisions.floor, false)
  assert.equal(result.grounded, true)
})

test('clamps the player to the cube side when moving through it horizontally', () => {
  const result = resolvePlayerCollision(
    { x: -8, y: 5, z: 0 },
    { x: 0, y: 5, z: 0 },
    { floorY: -100 }
  )

  assert.deepEqual(result.position, { x: -5 - PLAYER_RADIUS, y: 5, z: 0 })
  assert.equal(result.collisions.cube, true)
  assert.equal(result.collisions.floor, false)
  assert.equal(result.grounded, false)
})

test('clamps the player to the lower ground plane', () => {
  const result = resolvePlayerCollision(
    { x: 20, y: 9, z: 0 },
    { x: 20, y: -10, z: 0 }
  )

  assert.deepEqual(result.position, { x: 20, y: LOWER_GROUND_Y, z: 0 })
  assert.equal(result.collisions.floor, true)
  assert.equal(result.collisions.cube, false)
  assert.equal(result.grounded, true)
})

test('keeps the player grounded when already resting on the cube top', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: 10, z: 0 },
    { x: 0, y: 10, z: 0 }
  )

  assert.deepEqual(result.position, { x: 0, y: 10, z: 0 })
  assert.equal(result.grounded, true)
})
