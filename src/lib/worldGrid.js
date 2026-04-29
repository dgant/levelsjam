import { getRuntimeLevelWorldTransform } from './levels.js'
import { MAZE_CELL_SIZE } from './maze.js'
import { getNeighbor, normalizeEdge } from './turnRules.js'

const DIRECTIONS_BY_DELTA = new Map([
  ['0,-1', 'north'],
  ['1,0', 'east'],
  ['0,1', 'south'],
  ['-1,0', 'west']
])

function cloneCell(cell) {
  return { x: cell.x, y: cell.y }
}

function localCellCenter(maze, cell) {
  return {
    x: -((maze.width * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.x * MAZE_CELL_SIZE),
    z: -((maze.height * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.y * MAZE_CELL_SIZE)
  }
}

function localPointToWorld(point, transform) {
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return {
    x: transform.x + (point.x * cos) + (point.z * sin),
    z: transform.z - (point.x * sin) + (point.z * cos)
  }
}

function getLayoutCells(maze) {
  if (Array.isArray(maze.cells) && maze.cells.length > 0) {
    return maze.cells.map(cloneCell)
  }

  const cells = []

  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function worldCellKey(cell) {
  return `${cell.x},${cell.y}`
}

function localCellToWorldCellWithTransform(maze, transform, cell) {
  const worldCenter = localPointToWorld(localCellCenter(maze, cell), transform)

  return {
    x: Math.round(worldCenter.x / MAZE_CELL_SIZE),
    y: Math.round(worldCenter.z / MAZE_CELL_SIZE)
  }
}

function localDirectionToWorldDirection(maze, transform, cell, direction) {
  const from = localCellToWorldCellWithTransform(maze, transform, cell)
  const to = localCellToWorldCellWithTransform(maze, transform, getNeighbor(cell, direction))
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)

  return DIRECTIONS_BY_DELTA.get(`${dx},${dy}`) ?? direction
}

function addWorldCell(cellsByKey, worldCell, levelId, localCell) {
  const key = worldCellKey(worldCell)
  const existing = cellsByKey.get(key)

  if (existing) {
    existing.owners.push({
      levelId,
      localCell: cloneCell(localCell)
    })
    return existing
  }

  const next = {
    cell: { ...worldCell },
    key,
    owners: [{
      levelId,
      localCell: cloneCell(localCell)
    }]
  }

  cellsByKey.set(key, next)
  return next
}

export function localCellToWorldCell(layout, cell) {
  return localCellToWorldCellWithTransform(
    layout.maze,
    getRuntimeLevelWorldTransform(layout.maze.id),
    cell
  )
}

export function buildWorldGridFromLayouts(layouts) {
  const cellsByKey = new Map()
  const openEdges = new Set()
  const playerOnlyOpenEdges = new Set()
  const levels = new Map()

  for (const layout of layouts) {
    const maze = layout.maze
    const levelId = maze.id
    const transform = getRuntimeLevelWorldTransform(levelId)
    const localCells = getLayoutCells(maze)
    const levelCells = new Map()

    for (const localCell of localCells) {
      const worldCell = localCellToWorldCellWithTransform(maze, transform, localCell)
      const key = worldCellKey(worldCell)

      addWorldCell(cellsByKey, worldCell, levelId, localCell)
      levelCells.set(`${localCell.x},${localCell.y}`, key)
    }

    for (const edge of maze.openEdges ?? []) {
      const from = localCellToWorldCellWithTransform(maze, transform, edge.from)
      const to = localCellToWorldCellWithTransform(maze, transform, edge.to)

      openEdges.add(normalizeEdge(from, to))
    }

    for (const exit of maze.levelExits ?? []) {
      if (!exit.targetLevelId) {
        continue
      }

      const from = localCellToWorldCellWithTransform(maze, transform, exit.cell)
      const toLocalCell = getNeighbor(exit.cell, exit.side)
      const to = localCellToWorldCellWithTransform(maze, transform, toLocalCell)

      addWorldCell(cellsByKey, to, exit.targetLevelId, toLocalCell)
      playerOnlyOpenEdges.add(normalizeEdge(from, to))
      openEdges.add(normalizeEdge(from, to))
    }

    levels.set(levelId, {
      cells: levelCells,
      transform
    })
  }

  return {
    cells: Array.from(cellsByKey.values()),
    levels,
    openEdges,
    playerOnlyOpenEdges
  }
}

export function getWorldCellOwner(worldGrid, worldCell) {
  return worldGrid.cells.find((entry) => entry.key === worldCellKey(worldCell)) ?? null
}

export function getLevelLocalCellForWorldCell(worldGrid, levelId, worldCell) {
  const owner = getWorldCellOwner(worldGrid, worldCell)
  const levelCells = worldGrid.levels.get(levelId)?.cells
  const levelOwner = owner?.owners.find((candidate) => (
    candidate.levelId === levelId &&
    (!levelCells || levelCells.has(`${candidate.localCell.x},${candidate.localCell.y}`))
  )) ?? owner?.owners.find((candidate) => candidate.levelId === levelId)

  return levelOwner
    ? cloneCell(levelOwner.localCell)
    : null
}

export function getWorldDirectionForLocalDirection(layout, cell, direction) {
  return localDirectionToWorldDirection(
    layout.maze,
    getRuntimeLevelWorldTransform(layout.maze.id),
    cell,
    direction
  )
}
