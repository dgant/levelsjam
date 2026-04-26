export type AuthoredLevel = {
  description: string
  name: string
}

export function parseLevelSpec(markdown: string): AuthoredLevel[]

export function resolveRuntimeMazeIdForLevel(
  levelName: string,
  levelIndex: number,
  mazeIds: string[],
  fallbackMazeId?: string | null
): string | null
