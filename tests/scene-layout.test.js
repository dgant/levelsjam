import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WALL_FACE_OFFSET,
  WALL_LENGTH,
  WALL_PLACEMENT_LIMIT,
  getWallAttachmentLocalLayout,
  SCONCE_RADIUS,
  STANDALONE_REFERENCE_TORCH_POSITION,
  STANDALONE_SCONCE_COUNT,
  STANDALONE_SCONCE_LAYOUT,
  STANDALONE_SCONCE_STEP,
  WALL_LAYOUT,
  WALL_WIDTH
} from '../src/lib/sceneLayout.js'

const expectedFaceOffset = (WALL_WIDTH / 2) + SCONCE_RADIUS

test('places each sconce center one radius outside the wall face', () => {
  for (const wall of WALL_LAYOUT) {
    if (wall.axis === 'x') {
      assert.equal(wall.sconcePosition.x, wall.position.x)
      assert.equal(
        Math.abs(wall.sconcePosition.z - wall.position.z),
        expectedFaceOffset
      )
    } else {
      assert.equal(wall.sconcePosition.z, wall.position.z)
      assert.equal(
        Math.abs(wall.sconcePosition.x - wall.position.x),
        expectedFaceOffset
      )
    }
  }
})

test('keeps each torch aligned with its wall sconce outside the wall face', () => {
  for (const wall of WALL_LAYOUT) {
    assert.equal(wall.torchPosition.x, wall.sconcePosition.x)
    assert.equal(wall.torchPosition.z, wall.sconcePosition.z)
    assert.equal(
      wall.torchPosition.y,
      wall.sconcePosition.y + SCONCE_RADIUS + 0.08
    )
  }
})

test('uses wall-local attachment offsets that stay on the wall face after rotation', () => {
  for (const wall of WALL_LAYOUT) {
    const local = getWallAttachmentLocalLayout(wall)

    assert.equal(local.sconcePosition.x, 0)
    assert.equal(local.torchPosition.x, 0)
    assert.equal(local.sconcePosition.z, wall.sconceDirection * WALL_FACE_OFFSET)
    assert.equal(local.torchPosition.z, wall.sconceDirection * WALL_FACE_OFFSET)
    assert.equal(local.sconcePosition.y, wall.sconcePosition.y - wall.position.y)
    assert.equal(local.torchPosition.y, wall.torchPosition.y - wall.position.y)
  }
})

test('places the standalone sconce line just outside the wall assembly area', () => {
  assert.equal(STANDALONE_SCONCE_LAYOUT.length, STANDALONE_SCONCE_COUNT)

  const minimumOutsideX = WALL_PLACEMENT_LIMIT + (WALL_LENGTH / 2)
  const first = STANDALONE_SCONCE_LAYOUT[0]

  assert.equal(first.position.y, SCONCE_RADIUS)
  assert.ok(first.position.x > minimumOutsideX)

  for (let index = 1; index < STANDALONE_SCONCE_LAYOUT.length; index += 1) {
    const previous = STANDALONE_SCONCE_LAYOUT[index - 1]
    const current = STANDALONE_SCONCE_LAYOUT[index]

    assert.equal(current.position.x, previous.position.x)
    assert.equal(current.position.y, previous.position.y + STANDALONE_SCONCE_STEP)
    assert.equal(current.position.z, previous.position.z + STANDALONE_SCONCE_STEP)
  }
})

test('places the standalone torch reference outside the standalone sconce aabb', () => {
  const minX = Math.min(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.x - SCONCE_RADIUS))
  const maxX = Math.max(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.x + SCONCE_RADIUS))
  const minY = Math.min(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.y - SCONCE_RADIUS))
  const maxY = Math.max(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.y + SCONCE_RADIUS))
  const minZ = Math.min(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.z - SCONCE_RADIUS))
  const maxZ = Math.max(...STANDALONE_SCONCE_LAYOUT.map((sconce) => sconce.position.z + SCONCE_RADIUS))
  const torch = STANDALONE_REFERENCE_TORCH_POSITION

  const outsideAabb =
    torch.x < minX ||
    torch.x > maxX ||
    torch.y < minY ||
    torch.y > maxY ||
    torch.z < minZ ||
    torch.z > maxZ

  assert.equal(outsideAabb, true)
})
