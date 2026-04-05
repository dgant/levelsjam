export type Vector3Like = {
  x: number
  y: number
  z: number
}

export type WallBounds = {
  id?: string
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
    floor: boolean
    wallNormals: Vector3Like[]
    walls: string[]
  }
  grounded: boolean
}

export declare function getPlayerSpawnPosition(): Vector3Like
export declare function getCameraPosition(playerPosition: Vector3Like): Vector3Like
export declare function resolvePlayerCollision(
  previousPosition: Vector3Like,
  desiredPosition: Vector3Like,
  options?: {
    floorY?: number
    wallBounds?: WallBounds[]
    radius?: number
    height?: number
  }
): CollisionResult
