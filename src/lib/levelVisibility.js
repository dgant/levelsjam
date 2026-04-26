function cellKey(cell) {
  return `${cell.x},${cell.y}`
}

function cloneCell(cell) {
  return cell ? { x: cell.x, y: cell.y } : null
}

function getIngressCell(maze) {
  return cloneCell(maze?.playerStart?.cell) ?? cloneCell(maze?.opening?.cell)
}

function getExitToLevel(maze, targetLevelId) {
  const exits = Array.isArray(maze?.levelExits)
    ? maze.levelExits
    : []

  return exits.find((exit) => exit?.targetLevelId === targetLevelId) ?? null
}

export function getAdjacentLevelVisibleCellKeys(
  currentMaze,
  targetMaze,
  currentVisibleCellKeys
) {
  if (!currentMaze || !targetMaze || !currentVisibleCellKeys) {
    return null
  }

  const directExit = getExitToLevel(currentMaze, targetMaze.id)

  if (directExit && currentVisibleCellKeys.has(cellKey(directExit.cell))) {
    const ingressCell = getIngressCell(targetMaze)
    return ingressCell ? [cellKey(ingressCell)] : []
  }

  const reverseExit = getExitToLevel(targetMaze, currentMaze.id)
  const currentIngressCell = getIngressCell(currentMaze)

  if (
    reverseExit &&
    currentIngressCell &&
    currentVisibleCellKeys.has(cellKey(currentIngressCell))
  ) {
    return [cellKey(reverseExit.cell)]
  }

  return []
}

