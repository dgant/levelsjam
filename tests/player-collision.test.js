import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CUBE_BOUNDS,
  CUBE_SIZE,
  LOWER_GROUND_Y,
  PLAYER_HEIGHT,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from '../src/lib/playerCollision.js'

test('spawns the player one meter above the cube', () => {
  const spawnPosition = getPlayerSpawnPosition()

  assert.equal(spawnPosition.y, CUBE_BOUNDS.maxY + PLAYER_HEIGHT)
  assert.equal(spawnPosition.x, 0)
  assert.equal(spawnPosition.z, 4)
  assert.equal(CUBE_BOUNDS.maxY, CUBE_SIZE)
})

test('clamps the player to the cube top when falling into it', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: 11, z: 0 },
    { x: 0, y: 9, z: 0 }
  )

  assert.deepEqual(result.position, { x: 0, y: 11, z: 0 })
  assert.equal(result.collisions.cube, true)
  assert.equal(result.collisions.floor, false)
})

test('clamps the player to the cube side when moving through it horizontally', () => {
  const result = resolvePlayerCollision(
    { x: -8, y: 5, z: 0 },
    { x: 0, y: 5, z: 0 }
  )

  assert.deepEqual(result.position, { x: -5, y: 5, z: 0 })
  assert.equal(result.collisions.cube, true)
  assert.equal(result.collisions.floor, false)
})

test('clamps the player to the lower ground plane', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -10, z: 0 }
  )

  assert.deepEqual(result.position, { x: 0, y: LOWER_GROUND_Y + PLAYER_HEIGHT, z: 0 })
  assert.equal(result.collisions.floor, true)
  assert.equal(result.collisions.cube, false)
})
