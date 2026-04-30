import { MAZE_CELL_SIZE } from './maze.js'

function clampIndex(value, count) {
  return Math.max(0, Math.min(count - 1, value))
}

function getProbeCenterCoordinate(index, count, cellSize) {
  return -((count * cellSize) / 2) + (cellSize / 2) + (index * cellSize)
}

function getAxisBlend(position, count, cellSize) {
  if (count <= 1) {
    return {
      endIndex: 0,
      startIndex: 0,
      t: 0
    }
  }

  const firstCenter = getProbeCenterCoordinate(0, count, cellSize)
  const lastCenter = getProbeCenterCoordinate(count - 1, count, cellSize)

  if (position <= firstCenter) {
    return {
      endIndex: 0,
      startIndex: 0,
      t: 0
    }
  }

  if (position >= lastCenter) {
    return {
      endIndex: count - 1,
      startIndex: count - 1,
      t: 0
    }
  }

  const normalized = (position - firstCenter) / cellSize
  const startIndex = clampIndex(Math.floor(normalized), count - 1)
  const endIndex = Math.min(startIndex + 1, count - 1)

  return {
    endIndex,
    startIndex,
    t: Math.max(0, Math.min(1, normalized - startIndex))
  }
}

function getProbeIndex(width, xIndex, yIndex) {
  return (yIndex * width) + xIndex
}

function getLayoutCells(layout) {
  if (Array.isArray(layout.maze.cells) && layout.maze.cells.length > 0) {
    return layout.maze.cells.map((cell) => ({ x: cell.x, y: cell.y }))
  }

  const cells = []

  for (let y = 0; y < layout.maze.height; y += 1) {
    for (let x = 0; x < layout.maze.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

export function getReflectionProbeBlendForPosition(layout, position) {
  const xBlend = getAxisBlend(position.x, layout.maze.width, MAZE_CELL_SIZE)
  const zBlend = getAxisBlend(position.z, layout.maze.height, MAZE_CELL_SIZE)
  const inverseX = 1 - xBlend.t
  const inverseZ = 1 - zBlend.t

  return {
    probeIndices: [
      getProbeIndex(layout.maze.width, xBlend.startIndex, zBlend.startIndex),
      getProbeIndex(layout.maze.width, xBlend.endIndex, zBlend.startIndex),
      getProbeIndex(layout.maze.width, xBlend.startIndex, zBlend.endIndex),
      getProbeIndex(layout.maze.width, xBlend.endIndex, zBlend.endIndex)
    ],
    region: {
      minX: getProbeCenterCoordinate(
        xBlend.startIndex,
        layout.maze.width,
        MAZE_CELL_SIZE
      ),
      minZ: getProbeCenterCoordinate(
        zBlend.startIndex,
        layout.maze.height,
        MAZE_CELL_SIZE
      ),
      sizeX:
        getProbeCenterCoordinate(
          xBlend.endIndex,
          layout.maze.width,
          MAZE_CELL_SIZE
        ) -
        getProbeCenterCoordinate(
          xBlend.startIndex,
          layout.maze.width,
          MAZE_CELL_SIZE
        ),
      sizeZ:
        getProbeCenterCoordinate(
          zBlend.endIndex,
          layout.maze.height,
          MAZE_CELL_SIZE
        ) -
        getProbeCenterCoordinate(
          zBlend.startIndex,
          layout.maze.height,
          MAZE_CELL_SIZE
        )
    },
    weights: [
      inverseX * inverseZ,
      xBlend.t * inverseZ,
      inverseX * zBlend.t,
      xBlend.t * zBlend.t
    ]
  }
}

export function buildGroundReflectionProbeRects(layout) {
  const mazeMinX = -((layout.maze.width * MAZE_CELL_SIZE) / 2)
  const mazeMinZ = -((layout.maze.height * MAZE_CELL_SIZE) / 2)
  const mazeMaxX = -mazeMinX
  const mazeMaxZ = -mazeMinZ
  const cells = getLayoutCells(layout)
  const cellKeys = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const xEdges = [
    mazeMinX,
    ...Array.from({ length: layout.maze.width }, (_, index) =>
      getProbeCenterCoordinate(index, layout.maze.width, MAZE_CELL_SIZE)
    ),
    mazeMaxX
  ]
  const zEdges = [
    mazeMinZ,
    ...Array.from({ length: layout.maze.height }, (_, index) =>
      getProbeCenterCoordinate(index, layout.maze.height, MAZE_CELL_SIZE)
    ),
    mazeMaxZ
  ]
  const rects = []

  for (let zIndex = 0; zIndex < zEdges.length - 1; zIndex += 1) {
    const minZ = zEdges[zIndex]
    const maxZ = zEdges[zIndex + 1]
    const centerZ = (minZ + maxZ) / 2

    for (let xIndex = 0; xIndex < xEdges.length - 1; xIndex += 1) {
      const minX = xEdges[xIndex]
      const maxX = xEdges[xIndex + 1]
      const centerX = (minX + maxX) / 2
      const overlappingCells = []

      for (
        let cellY = Math.max(0, Math.floor((minZ - mazeMinZ) / MAZE_CELL_SIZE));
        cellY <= Math.min(layout.maze.height - 1, Math.floor((maxZ - mazeMinZ - 1e-6) / MAZE_CELL_SIZE));
        cellY += 1
      ) {
        for (
          let cellX = Math.max(0, Math.floor((minX - mazeMinX) / MAZE_CELL_SIZE));
          cellX <= Math.min(layout.maze.width - 1, Math.floor((maxX - mazeMinX - 1e-6) / MAZE_CELL_SIZE));
          cellX += 1
        ) {
          if (cellKeys.has(`${cellX},${cellY}`)) {
            overlappingCells.push({ x: cellX, y: cellY })
          }
        }
      }

      if (overlappingCells.length === 0) {
        continue
      }

      const blend = getReflectionProbeBlendForPosition(layout, {
        x: centerX,
        z: centerZ
      })

      rects.push({
        cell: overlappingCells[0],
        cells: overlappingCells,
        centerX,
        centerZ,
        depth: maxZ - minZ,
        id: `floor-blend-${xIndex}-${zIndex}`,
        probeIndices: blend.probeIndices,
        region: blend.region,
        width: maxX - minX
      })
    }
  }

  return rects
}
