export type AuthoredLevel = {
  description: string
  name: string
}

export function parseLevelSpec(markdown: string): AuthoredLevel[]

export function getDefaultRuntimeLevelId(): string

export function getAuthoredRuntimeLevelId(levelName: string): string | null

export function isAuthoredRuntimeLevelId(id: string): boolean

export function getAuthoredRuntimeLevelIds(): string[]

export function createAuthoredRuntimeMaze(id: string): unknown | null

export function resolveRuntimeMazeIdForLevel(
  levelName: string,
  levelIndex: number,
  mazeIds: string[],
  fallbackMazeId?: string | null
): string | null
