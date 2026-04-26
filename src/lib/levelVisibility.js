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

function getVisibilityCellsFrom(maze, cell) {
  const key = cellKey(cell)
  const visibleCells = maze?.visibility?.cells?.[key]

  return Array.isArray(visibleCells) && visibleCells.length > 0
    ? visibleCells
    : [key]
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
  const targetExitToCurrent = getExitToLevel(targetMaze, currentMaze.id)

  if (directExit && currentVisibleCellKeys.has(cellKey(directExit.cell))) {
    const targetConnectionCell = targetExitToCurrent?.cell ?? getIngressCell(targetMaze)
    return targetConnectionCell ? getVisibilityCellsFrom(targetMaze, targetConnectionCell) : []
  }

  const currentIngressCell = getIngressCell(currentMaze)

  if (
    targetExitToCurrent &&
    currentIngressCell &&
    currentVisibleCellKeys.has(cellKey(currentIngressCell))
  ) {
    return getVisibilityCellsFrom(targetMaze, targetExitToCurrent.cell)
  }

  return []
}
