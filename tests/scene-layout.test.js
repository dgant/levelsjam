import test from 'node:test'
import assert from 'node:assert/strict'

import {
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
    assert.ok(wall.torchPosition.y > wall.sconcePosition.y)
  }
})
