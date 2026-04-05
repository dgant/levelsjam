import assert from 'node:assert/strict'
import test from 'node:test'

import { Euler, Quaternion } from 'three'

import { computeLocalBillboardQuaternion } from '../src/lib/billboard.js'

function almostEqualQuaternion(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual.x - expected.x) <= epsilon, `${actual.x} != ${expected.x}`)
  assert.ok(Math.abs(actual.y - expected.y) <= epsilon, `${actual.y} != ${expected.y}`)
  assert.ok(Math.abs(actual.z - expected.z) <= epsilon, `${actual.z} != ${expected.z}`)
  assert.ok(Math.abs(actual.w - expected.w) <= epsilon, `${actual.w} != ${expected.w}`)
}

test('converts camera world orientation into billboard local orientation under a rotated parent', () => {
  const parentWorldQuaternion = new Quaternion().setFromEuler(
    new Euler(0, Math.PI / 2, 0)
  )
  const cameraWorldQuaternion = new Quaternion().setFromEuler(
    new Euler(0.15, -0.7, 0.1)
  )
  const localQuaternion = computeLocalBillboardQuaternion(
    parentWorldQuaternion,
    cameraWorldQuaternion
  )
  const reconstructedWorldQuaternion = parentWorldQuaternion
    .clone()
    .multiply(localQuaternion)

  almostEqualQuaternion(reconstructedWorldQuaternion, cameraWorldQuaternion)
})
