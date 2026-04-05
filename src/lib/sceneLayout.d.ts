export type Vector3Like = {
  x: number
  y: number
  z: number
}

export type WallLayout = {
  axis: 'x' | 'z'
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
  id: string
  index: number
  position: Vector3Like
  sconceDirection: number
  sconcePosition: Vector3Like
  torchPosition: Vector3Like
  yaw: number
}

export declare const PLAYER_RADIUS: number
export declare const PLAYER_HEIGHT: number
export declare const PLAYER_EYE_HEIGHT: number
export declare const GROUND_Y: number
export declare const GROUND_SIZE: number
export declare const WALL_COUNT: number
export declare const WALL_HEIGHT: number
export declare const WALL_LENGTH: number
export declare const WALL_WIDTH: number
export declare const SCONCE_RADIUS: number
export declare const TORCH_BILLBOARD_SIZE: number
export declare const TORCH_BASE_CANDELA: number
export declare const WALL_FACE_OFFSET: number
export declare const PLAYER_SPAWN_POSITION: Readonly<Vector3Like>
export declare const WALL_LAYOUT: readonly WallLayout[]

export declare function getWallBounds(): Array<WallLayout['bounds'] & { id: string }>
export declare function getWallAttachmentLocalLayout(wall: WallLayout): {
  sconcePosition: Vector3Like
  torchPosition: Vector3Like
  sconceRotationY: number
}
