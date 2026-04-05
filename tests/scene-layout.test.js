import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WALL_FACE_OFFSET,
  getWallAttachmentLocalLayout,
  SCONCE_RADIUS,
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
