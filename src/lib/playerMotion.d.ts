export declare const METERS_PER_MILE: number
export declare const SECONDS_PER_HOUR: number
export declare const MPH_TO_METERS_PER_SECOND: number

export declare const MAX_HORIZONTAL_SPEED: number
export declare const MAX_VERTICAL_SPEED: number
export declare const MAX_FALL_SPEED: number

export declare const HORIZONTAL_ACCELERATION_DISTANCE: number
export declare const HORIZONTAL_DECELERATION_DISTANCE: number
export declare const HORIZONTAL_ACCELERATION: number
export declare const HORIZONTAL_DECELERATION: number

export declare const GRAVITY_ACCELERATION: number
export declare const JETPACK_ACCELERATION: number
export declare const DEFAULT_MOVEMENT_SETTINGS: Readonly<{
  horizontalAccelerationDistance: number
  horizontalDecelerationDistance: number
  maxFallSpeed: number
  maxHorizontalSpeed: number
  maxHorizontalSpeedMph: number
  maxVerticalSpeed: number
}>

export declare function getHorizontalAcceleration(
  maxHorizontalSpeed: number,
  distance: number
): number

export declare function getHorizontalDeceleration(
  maxHorizontalSpeed: number,
  distance: number
): number

export declare function createMovementSettings(options?: {
  horizontalAccelerationDistance?: number
  horizontalDecelerationDistance?: number
  maxHorizontalSpeedMph?: number
  maxVerticalSpeed?: number
  maxFallSpeed?: number
}): {
  horizontalAccelerationDistance: number
  horizontalDecelerationDistance: number
  maxFallSpeed: number
  maxHorizontalSpeed: number
  maxHorizontalSpeedMph: number
  maxVerticalSpeed: number
}

export declare function updateHorizontalVelocity(
  currentSpeed: number,
  currentDirection: { x: number; z: number },
  desiredDirection: { x: number; z: number },
  delta: number,
  movementSettings?: {
    horizontalAccelerationDistance: number
    horizontalDecelerationDistance: number
    maxFallSpeed: number
    maxHorizontalSpeed: number
    maxHorizontalSpeedMph: number
    maxVerticalSpeed: number
  }
): {
  speed: number
  direction: { x: number; z: number }
}

export declare function updateVerticalVelocity(
  currentVelocity: number,
  grounded: boolean,
  jetpackActive: boolean,
  delta: number,
  movementSettings?: {
    horizontalAccelerationDistance: number
    horizontalDecelerationDistance: number
    maxFallSpeed: number
    maxHorizontalSpeed: number
    maxHorizontalSpeedMph: number
    maxVerticalSpeed: number
  }
): number
