export const METERS_PER_MILE = 1609.344
export const SECONDS_PER_HOUR = 3600
export const MPH_TO_METERS_PER_SECOND = METERS_PER_MILE / SECONDS_PER_HOUR

export const MAX_HORIZONTAL_SPEED = 20 * MPH_TO_METERS_PER_SECOND
export const MAX_VERTICAL_SPEED = 5 * MPH_TO_METERS_PER_SECOND
export const MAX_FALL_SPEED = 40 * MPH_TO_METERS_PER_SECOND

export const HORIZONTAL_ACCELERATION_DISTANCE = 2
export const HORIZONTAL_DECELERATION_DISTANCE = 0.5
export const HORIZONTAL_ACCELERATION = getHorizontalAcceleration(
  MAX_HORIZONTAL_SPEED,
  HORIZONTAL_ACCELERATION_DISTANCE
)
export const HORIZONTAL_DECELERATION = getHorizontalDeceleration(
  MAX_HORIZONTAL_SPEED,
  HORIZONTAL_DECELERATION_DISTANCE
)

export const GRAVITY_ACCELERATION = 9.80665
export const JETPACK_ACCELERATION = GRAVITY_ACCELERATION * 1.25
export const DEFAULT_MOVEMENT_SETTINGS = Object.freeze({
  horizontalAccelerationDistance: HORIZONTAL_ACCELERATION_DISTANCE,
  horizontalDecelerationDistance: HORIZONTAL_DECELERATION_DISTANCE,
  maxFallSpeed: MAX_FALL_SPEED,
  maxHorizontalSpeed: MAX_HORIZONTAL_SPEED,
  maxHorizontalSpeedMph: 20,
  maxVerticalSpeed: MAX_VERTICAL_SPEED
})

const DIRECTION_EPSILON = 1e-6
const DEFAULT_DIRECTION = { x: 0, z: -1 }

export function getHorizontalAcceleration(maxHorizontalSpeed, distance) {
  return (maxHorizontalSpeed * maxHorizontalSpeed) / (2 * distance)
}

export function getHorizontalDeceleration(maxHorizontalSpeed, distance) {
  return (maxHorizontalSpeed * maxHorizontalSpeed) / (2 * distance)
}

export function createMovementSettings({
  horizontalAccelerationDistance = HORIZONTAL_ACCELERATION_DISTANCE,
  horizontalDecelerationDistance = HORIZONTAL_DECELERATION_DISTANCE,
  maxHorizontalSpeedMph = 20,
  maxVerticalSpeed = MAX_VERTICAL_SPEED,
  maxFallSpeed = MAX_FALL_SPEED
} = {}) {
  const maxHorizontalSpeed = maxHorizontalSpeedMph * MPH_TO_METERS_PER_SECOND

  return {
    horizontalAccelerationDistance,
    horizontalDecelerationDistance,
    maxFallSpeed,
    maxHorizontalSpeed,
    maxHorizontalSpeedMph,
    maxVerticalSpeed
  }
}

function normalizeDirection(direction, fallback = DEFAULT_DIRECTION) {
  const length = Math.hypot(direction.x, direction.z)

  if (length <= DIRECTION_EPSILON) {
    return { x: fallback.x, z: fallback.z }
  }

  return {
    x: direction.x / length,
    z: direction.z / length
  }
}

export function updateHorizontalVelocity(
  currentSpeed,
  currentDirection,
  desiredDirection,
  delta,
  movementSettings = DEFAULT_MOVEMENT_SETTINGS
) {
  const horizontalAcceleration = getHorizontalAcceleration(
    movementSettings.maxHorizontalSpeed,
    movementSettings.horizontalAccelerationDistance
  )
  const horizontalDeceleration = getHorizontalDeceleration(
    movementSettings.maxHorizontalSpeed,
    movementSettings.horizontalDecelerationDistance
  )
  const normalizedCurrentDirection = normalizeDirection(currentDirection)
  const desiredLength = Math.hypot(desiredDirection.x, desiredDirection.z)

  if (desiredLength <= DIRECTION_EPSILON) {
    return {
      speed: Math.max(0, currentSpeed - (horizontalDeceleration * delta)),
      direction: normalizedCurrentDirection
    }
  }

  const normalizedDesiredDirection = normalizeDirection(desiredDirection)

  if (currentSpeed <= DIRECTION_EPSILON) {
    return {
      speed: Math.min(
        movementSettings.maxHorizontalSpeed,
        horizontalAcceleration * delta
      ),
      direction: normalizedDesiredDirection
    }
  }

  const alignment =
    (normalizedCurrentDirection.x * normalizedDesiredDirection.x) +
    (normalizedCurrentDirection.z * normalizedDesiredDirection.z)

  if (alignment < 0) {
    const nextSpeed = Math.max(
      0,
      currentSpeed - (horizontalDeceleration * delta)
    )

    return {
      speed: nextSpeed,
      direction:
        nextSpeed > DIRECTION_EPSILON
          ? normalizedCurrentDirection
          : normalizedDesiredDirection
    }
  }

  return {
    speed: Math.min(
      movementSettings.maxHorizontalSpeed,
      currentSpeed + (horizontalAcceleration * delta)
    ),
    direction: normalizedDesiredDirection
  }
}

export function updateVerticalVelocity(
  currentVelocity,
  grounded,
  jetpackActive,
  delta,
  movementSettings = DEFAULT_MOVEMENT_SETTINGS
) {
  if (grounded && !jetpackActive) {
    return 0
  }

  let nextVelocity = currentVelocity

  if (jetpackActive) {
    nextVelocity += (JETPACK_ACCELERATION - GRAVITY_ACCELERATION) * delta
    return Math.min(nextVelocity, movementSettings.maxVerticalSpeed)
  }

  nextVelocity -= GRAVITY_ACCELERATION * delta
  return Math.max(nextVelocity, -movementSettings.maxFallSpeed)
}
