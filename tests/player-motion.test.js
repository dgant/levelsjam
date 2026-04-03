import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GRAVITY_ACCELERATION,
  HORIZONTAL_ACCELERATION,
  HORIZONTAL_DECELERATION,
  JETPACK_ACCELERATION,
  MAX_FALL_SPEED,
  MAX_HORIZONTAL_SPEED,
  MAX_VERTICAL_SPEED,
  MPH_TO_METERS_PER_SECOND,
  updateHorizontalVelocity,
  updateVerticalVelocity
} from '../src/lib/playerMotion.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('converts the requested mph limits to meters per second', () => {
  almostEqual(MPH_TO_METERS_PER_SECOND, 0.44704)
  almostEqual(MAX_HORIZONTAL_SPEED, 8.9408)
  almostEqual(MAX_VERTICAL_SPEED, 2.2352)
  almostEqual(MAX_FALL_SPEED, 17.8816)
})

test('matches the requested acceleration and deceleration distances', () => {
  almostEqual(HORIZONTAL_ACCELERATION, (MAX_HORIZONTAL_SPEED ** 2) / 16)
  almostEqual(HORIZONTAL_DECELERATION, (MAX_HORIZONTAL_SPEED ** 2) / 4)
})

test('matches the requested gravity and jetpack forces', () => {
  almostEqual(GRAVITY_ACCELERATION, 9.80665)
  almostEqual(JETPACK_ACCELERATION, GRAVITY_ACCELERATION * 1.25)
})

test('clamps horizontal velocity to the requested top speed', () => {
  const result = updateHorizontalVelocity(
    { x: MAX_HORIZONTAL_SPEED, z: 0 },
    { x: 1, z: 0 },
    1
  )

  almostEqual(Math.hypot(result.x, result.z), MAX_HORIZONTAL_SPEED)
})

test('decelerates horizontal velocity toward rest without reversing', () => {
  const result = updateHorizontalVelocity(
    { x: 1, z: 0 },
    { x: 0, z: 0 },
    1
  )

  almostEqual(result.x, 0)
  almostEqual(result.z, 0)
})

test('keeps grounded vertical velocity at rest without jetpack', () => {
  almostEqual(updateVerticalVelocity(3, true, false, 1), 0)
})

test('caps upward jetpack velocity to the requested vertical limit', () => {
  almostEqual(
    updateVerticalVelocity(MAX_VERTICAL_SPEED, false, true, 1),
    MAX_VERTICAL_SPEED
  )
})

test('caps downward velocity to the requested fall-speed limit', () => {
  almostEqual(
    updateVerticalVelocity(-MAX_FALL_SPEED, false, false, 1),
    -MAX_FALL_SPEED
  )
})
