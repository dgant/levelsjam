export const METERS_PER_MILE = 1609.344
export const SECONDS_PER_HOUR = 3600
export const MPH_TO_METERS_PER_SECOND = METERS_PER_MILE / SECONDS_PER_HOUR

export const MAX_HORIZONTAL_SPEED = 20 * MPH_TO_METERS_PER_SECOND
export const MAX_VERTICAL_SPEED = 5 * MPH_TO_METERS_PER_SECOND
export const MAX_FALL_SPEED = 40 * MPH_TO_METERS_PER_SECOND

export const HORIZONTAL_ACCELERATION_DISTANCE = 2
export const HORIZONTAL_DECELERATION_DISTANCE = 0.5
export const HORIZONTAL_ACCELERATION =
  (MAX_HORIZONTAL_SPEED * MAX_HORIZONTAL_SPEED) /
  (2 * HORIZONTAL_ACCELERATION_DISTANCE)
export const HORIZONTAL_DECELERATION =
  (MAX_HORIZONTAL_SPEED * MAX_HORIZONTAL_SPEED) /
  (2 * HORIZONTAL_DECELERATION_DISTANCE)

export const GRAVITY_ACCELERATION = 9.80665
export const JETPACK_ACCELERATION = GRAVITY_ACCELERATION * 1.25

export function updateHorizontalVelocity(currentVelocity, desiredDirection, delta) {
  const nextVelocity = {
    x: currentVelocity.x,
    z: currentVelocity.z
  }
  const directionLength = Math.hypot(desiredDirection.x, desiredDirection.z)

  if (directionLength > 0) {
    nextVelocity.x +=
      (desiredDirection.x / directionLength) * HORIZONTAL_ACCELERATION * delta
    nextVelocity.z +=
      (desiredDirection.z / directionLength) * HORIZONTAL_ACCELERATION * delta
  } else {
    const speed = Math.hypot(nextVelocity.x, nextVelocity.z)
    if (speed > 0) {
      const deceleration = Math.min(speed, HORIZONTAL_DECELERATION * delta)
      nextVelocity.x -= (nextVelocity.x / speed) * deceleration
      nextVelocity.z -= (nextVelocity.z / speed) * deceleration
    }
  }

  const nextSpeed = Math.hypot(nextVelocity.x, nextVelocity.z)
  if (nextSpeed > MAX_HORIZONTAL_SPEED) {
    const speedScale = MAX_HORIZONTAL_SPEED / nextSpeed
    nextVelocity.x *= speedScale
    nextVelocity.z *= speedScale
  }

  return nextVelocity
}

export function updateVerticalVelocity(
  currentVelocity,
  grounded,
  jetpackActive,
  delta
) {
  if (grounded && !jetpackActive) {
    return 0
  }

  let nextVelocity = currentVelocity

  if (jetpackActive) {
    nextVelocity += (JETPACK_ACCELERATION - GRAVITY_ACCELERATION) * delta
    return Math.min(nextVelocity, MAX_VERTICAL_SPEED)
  }

  nextVelocity -= GRAVITY_ACCELERATION * delta
  return Math.max(nextVelocity, -MAX_FALL_SPEED)
}
