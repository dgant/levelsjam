export type Vector3Like = {
  x: number
  y: number
  z: number
}

export type CubeBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export type CollisionResult = {
  position: Vector3Like
  collisions: {
    cube: boolean
    floor: boolean
  }
  grounded: boolean
}

export declare const CUBE_CENTER: Readonly<Vector3Like>
export declare const CUBE_SIZE: number
export declare const CUBE_HALF_SIZE: number
export declare const CUBE_BOUNDS: Readonly<CubeBounds>
export declare const LOWER_GROUND_Y: number
export declare const PLAYER_RADIUS: number
export declare const PLAYER_HEIGHT: number
export declare const PLAYER_EYE_HEIGHT: number
export declare const PLAYER_SPAWN_POSITION: Readonly<Vector3Like>

export declare function getPlayerSpawnPosition(): Vector3Like
export declare function getCameraPosition(playerPosition: Vector3Like): Vector3Like
export declare function resolvePlayerCollision(
  previousPosition: Vector3Like,
  desiredPosition: Vector3Like,
  options?: {
    floorY?: number
    cubeBounds?: CubeBounds
    radius?: number
    height?: number
  }
): CollisionResult
