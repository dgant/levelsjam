export function parseLevelSpec(markdown) {
  const levels = []
  let currentLevel = null

  for (const rawLine of String(markdown ?? '').split(/\r?\n/)) {
    const headingMatch = rawLine.match(/^\s*\+\s+(.+?)\s*$/)

    if (headingMatch) {
      currentLevel = {
        description: '',
        name: headingMatch[1].trim()
      }
      levels.push(currentLevel)
      continue
    }

    if (!currentLevel) {
      continue
    }

    const line = rawLine.trim()

    if (!line) {
      continue
    }

    currentLevel.description = currentLevel.description
      ? `${currentLevel.description}\n${line}`
      : line
  }

  return levels
}

export function resolveRuntimeMazeIdForLevel(levelName, levelIndex, mazeIds, fallbackMazeId = null) {
  const availableMazeIds = Array.isArray(mazeIds)
    ? mazeIds.filter((id) => typeof id === 'string' && id.length > 0)
    : []

  if (availableMazeIds.length === 0) {
    return fallbackMazeId
  }

  const numberedMazeMatch = String(levelName ?? '').match(/^Maze\s+(\d+)$/i)

  if (numberedMazeMatch) {
    const mazeNumber = Number(numberedMazeMatch[1])
    const numberedMazeId = availableMazeIds[mazeNumber - 1]

    if (numberedMazeId) {
      return numberedMazeId
    }
  }

  return availableMazeIds[levelIndex] ?? fallbackMazeId ?? availableMazeIds[0]
}
