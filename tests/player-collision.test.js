import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GROUND_Y,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPAWN_POSITION
} from '../src/lib/sceneLayout.js'
import {
  getCameraPosition,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from '../src/lib/playerCollision.js'

const customWall = {
  id: 'custom',
  minX: -1,
  maxX: 1,
  minY: 0,
  maxY: 2,
  minZ: -1,
  maxZ: 1
}

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
    { x: 0, y: -4, z: 0 },
    { wallBounds: [] }
  )

  assert.deepEqual(result.position, { x: 0, y: GROUND_Y, z: 0 })
  assert.equal(result.collisions.floor, true)
  assert.deepEqual(result.collisions.walls, [])
  assert.equal(result.grounded, true)
})

test('clamps the player to a wall side when moving through it horizontally', () => {
  const result = resolvePlayerCollision(
    { x: customWall.minX - 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { wallBounds: [customWall] }
  )

  assert.deepEqual(result.position, {
    x: customWall.minX - PLAYER_RADIUS,
    y: 0,
    z: 0
  })
  assert.deepEqual(result.collisions.walls, [customWall.id])
  assert.deepEqual(result.collisions.wallNormals, [{ x: -1, y: 0, z: 0 }])
  assert.equal(result.grounded, true)
})

test('preserves tangential motion when sliding along a wall face', () => {
  const result = resolvePlayerCollision(
    { x: customWall.minX - PLAYER_RADIUS, y: 0, z: -1.1 },
    { x: 0, y: 0, z: -1.05 },
    { wallBounds: [customWall] }
  )

  assert.equal(result.position.x, customWall.minX - PLAYER_RADIUS)
  assert.equal(result.position.z, -1.05)
  assert.deepEqual(result.collisions.wallNormals, [{ x: -1, y: 0, z: 0 }])
})

test('repeated wall-slide resolution preserves tangent travel without tunneling through the wall', () => {
  const velocity = { x: 3, y: 0, z: 4 }
  let position = { x: customWall.minX - PLAYER_RADIUS - 0.05, y: 0, z: -1.1 }
  let maxXDuringOverlap = -Infinity

  for (let index = 0; index < 60; index += 1) {
    const desired = {
      x: position.x + (velocity.x / 60),
      y: position.y,
      z: position.z + (velocity.z / 60)
    }
    const result = resolvePlayerCollision(position, desired, { wallBounds: [customWall] })

    for (const normal of result.collisions.wallNormals) {
      const dot =
        (velocity.x * normal.x) +
        (velocity.y * normal.y) +
        (velocity.z * normal.z)

      if (dot < 0) {
        velocity.x -= normal.x * dot
        velocity.y -= normal.y * dot
        velocity.z -= normal.z * dot
      }
    }

    position = result.position
    if (
      position.z > customWall.minZ - PLAYER_RADIUS &&
      position.z < customWall.maxZ + PLAYER_RADIUS
    ) {
      maxXDuringOverlap = Math.max(maxXDuringOverlap, position.x)
    }
  }

  assert.equal(maxXDuringOverlap, customWall.minX - PLAYER_RADIUS)
  assert.ok(position.z > 1.5)
})

test('lands on top of a wall when descending onto it', () => {
  const result = resolvePlayerCollision(
    { x: 0, y: customWall.maxY + 1, z: 0 },
    { x: 0, y: customWall.maxY - 0.2, z: 0 },
    { wallBounds: [customWall] }
  )

  assert.deepEqual(result.position, {
    x: 0,
    y: customWall.maxY,
    z: 0
  })
  assert.deepEqual(result.collisions.walls, [customWall.id])
  assert.equal(result.grounded, true)
})

test('accepts custom wall bounds for isolated collision checks', () => {
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
