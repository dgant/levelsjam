export type AuthoredLevel = {
  description: string
  name: string
}

export function parseLevelSpec(markdown: string): AuthoredLevel[]

export function getDefaultRuntimeLevelId(): string

export function getAuthoredRuntimeLevelId(levelName: string): string | null

export function isAuthoredRuntimeLevelId(id: string): boolean

export function getAuthoredRuntimeLevelIds(): string[]

export function getAdjacentRuntimeLevelIds(id: string): string[]

export function getRuntimeLevelWorldTransform(id: string): {
  rotationY: number
  x: number
  z: number
}

export function createAuthoredRuntimeMaze(
  id: string,
  options?: { bakeLightmap?: boolean }
): Promise<unknown | null>

export function resolveRuntimeMazeIdForLevel(
  levelName: string,
  levelIndex: number,
  mazeIds: string[],
  fallbackMazeId?: string | null
): string | null
