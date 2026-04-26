export type Vector3Like = {
  x: number
  y: number
  z: number
}

export type WallBounds = {
  id: string
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

export type MazeLayout = {
  cornerFillers: Array<{
    bounds: WallBounds
    center: { x: number; z: number }
    id: string
    type: 'corner-filler'
  }>
  decals: Array<{
    faceKey: 'pz' | 'nz'
    id: string
    normal: { x: number; y: number; z: number }
    position: Vector3Like
    textureIndex: number
    wallId: string
    yaw: number
  }>
  gates: Array<{
    axis: 'x' | 'z'
    cells: [{ x: number; y: number }, { x: number; y: number }]
    center: { x: number; z: number }
    from: { x: number; y: number }
    id: string
    index: number
    to: { x: number; y: number }
    yaw: number
  }>
  gatePosts: Array<{
    axis: 'x' | 'z'
    bounds: WallBounds
    center: { x: number; z: number }
    gateId: string
    id: string
    index: number
    radius: number
    type: 'gate-post'
  }>
  items: Array<{
    cell: { x: number; y: number }
    id: string
    position: Vector3Like
    type: 'sword' | 'trophy'
  }>
  lights: Array<{
    cell: { x: number; y: number }
    id: string
    index: number
    sconcePosition: Vector3Like
    side: 'north' | 'east' | 'south' | 'west'
    torchPosition: Vector3Like
  }>
  maze: {
    lightmap: {
      atlasUrl?: string
      atlasHeight: number
      atlasWidth: number
      bakeMs: number
      dataBase64?: string
      encoding?: 'rgbe8' | 'rgb16f'
      groundBounds: {
        centerX: number
        centerZ: number
        depth: number
        height: number
        margin: number
        maxX: number
        maxZ: number
        minX: number
        minZ: number
        width: number
      }
      groundRect: { height: number; width: number; x: number; y: number }
      neutralRect: { height: number; width: number; x: number; y: number }
      version: number
      wallRects: Record<
        string,
        {
          nx?: { height: number; width: number; x: number; y: number }
          nz?: { height: number; width: number; x: number; y: number }
          px?: { height: number; width: number; x: number; y: number }
          pz?: { height: number; width: number; x: number; y: number }
        }
      >
    }
    gates?: Array<{
      from: { x: number; y: number }
      id?: string
      to: { x: number; y: number }
    }>
    height: number
    id: string
    isAuthoredLevel?: boolean
    visibility?: {
      cells: Record<string, string[]>
      version: number
    }
    levelExits?: Array<{
      cell: { x: number; y: number }
      side: 'north' | 'east' | 'south' | 'west'
      targetLevelId?: string
    }>
    levelName?: string
    monsters?: Array<{
      cell: { x: number; y: number }
      direction?: 'north' | 'east' | 'south' | 'west'
      hand?: 'left' | 'right'
      type: 'minotaur' | 'spider' | 'werewolf'
    }>
    openEdges?: Array<{
      from: { x: number; y: number }
      to: { x: number; y: number }
    }>
    playerStart?: {
      cell: { x: number; y: number }
      direction: 'north' | 'east' | 'south' | 'west'
    }
    width: number
    solution?: {
      actions: Array<'move-forward' | 'move-backward' | 'rotate-left' | 'rotate-right'>
      moveCount: number
    } | null
    sword?: {
      cell: { x: number; y: number }
    }
    trophy?: {
      cell: { x: number; y: number }
    }
  }
  reflectionProbes: Array<{
    cell: { x: number; y: number }
    id: string
    position: Vector3Like
  }>
  walls: Array<{
    axis: 'x' | 'z'
    bounds: WallBounds
    center: { x: number; z: number }
    id: string
    yaw: number
  }>
}

export declare const PLAYER_RADIUS: number
export declare const PLAYER_HEIGHT: number
export declare const PLAYER_EYE_HEIGHT: number
export declare const GROUND_Y: number
export declare const GROUND_SIZE: number
export declare const MAZE_CELL_SIZE: number
export declare const WALL_HEIGHT: number
export declare const WALL_LENGTH: number
export declare const WALL_WIDTH: number
export declare const SCONCE_RADIUS: number
export declare const TORCH_BILLBOARD_SIZE: number
export declare const TORCH_BASE_CANDELA: number
export declare const WALL_FACE_OFFSET: number
export declare const PLAYER_SPAWN_POSITION: Readonly<Vector3Like>
export declare const AVAILABLE_MAZES: readonly Array<{
  height: number
  id: string
  width: number
}>
export declare const DEFAULT_MAZE_LAYOUT: MazeLayout
export declare const MAZE_COUNT: number

export declare function getRandomMazeLayout(random?: () => number): MazeLayout
export declare function getMazeLayoutById(id: string): MazeLayout | null
export declare function getDebugMazeLayoutById(id: string): MazeLayout | null
export declare function getWallBounds(layout?: MazeLayout): WallBounds[]
export declare function resolveMazeDataUrl(relativePath: string): string
