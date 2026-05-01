export type AuthoredLevel = {
  description: string
  name: string
}

export type RuntimeLevelMenuEntry = AuthoredLevel & {
  runtimeLevelId: string
}

export function parseLevelSpec(markdown: string): AuthoredLevel[]

export function getDefaultRuntimeLevelId(): string

export function getAuthoredRuntimeLevelId(levelName: string): string | null

export function isAuthoredRuntimeLevelId(id: string): boolean

export function getAuthoredRuntimeLevelIds(): string[]

export function getAdjacentRuntimeLevelIds(id: string): string[]

export function getDirectedRuntimeLevelGraph(): Record<string, string[]>

export function getRuntimeLevelGraphRootId(): string

export function isRuntimeMazeLevelId(id: string): boolean

export function getLatestDirectedNonMazeLevelId(
  enteredLevelIds: string[],
  options?: { rootId?: string }
): string

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
