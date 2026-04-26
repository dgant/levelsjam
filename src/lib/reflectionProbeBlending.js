import { MAZE_CELL_SIZE } from './maze.js'

function clampIndex(value, count) {
  return Math.max(0, Math.min(count - 1, value))
}

function getProbeCenterCoordinate(index, count, cellSize) {
  return -((count * cellSize) / 2) + (cellSize / 2) + (index * cellSize)
}

function getProbeCenterCoordinates(count, cellSize) {
  return Array.from(
    { length: count },
    (_, index) => getProbeCenterCoordinate(index, count, cellSize)
  )
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
  const xCenters = getProbeCenterCoordinates(layout.maze.width, MAZE_CELL_SIZE)
  const zCenters = getProbeCenterCoordinates(layout.maze.height, MAZE_CELL_SIZE)
  const mazeMinX = -((layout.maze.width * MAZE_CELL_SIZE) / 2)
  const mazeMaxX = (layout.maze.width * MAZE_CELL_SIZE) / 2
  const mazeMinZ = -((layout.maze.height * MAZE_CELL_SIZE) / 2)
  const mazeMaxZ = (layout.maze.height * MAZE_CELL_SIZE) / 2
  const xBoundaries = [mazeMinX, ...xCenters, mazeMaxX]
  const zBoundaries = [mazeMinZ, ...zCenters, mazeMaxZ]
  const rects = []

  for (let zSegment = 0; zSegment < zBoundaries.length - 1; zSegment += 1) {
    const z0 = zBoundaries[zSegment]
    const z1 = zBoundaries[zSegment + 1]
    const zStartIndex = clampIndex(zSegment - 1, layout.maze.height)
    const zEndIndex = clampIndex(zSegment, layout.maze.height)

    for (let xSegment = 0; xSegment < xBoundaries.length - 1; xSegment += 1) {
      const x0 = xBoundaries[xSegment]
      const x1 = xBoundaries[xSegment + 1]
      const xStartIndex = clampIndex(xSegment - 1, layout.maze.width)
      const xEndIndex = clampIndex(xSegment, layout.maze.width)

      rects.push({
        centerX: (x0 + x1) / 2,
        centerZ: (z0 + z1) / 2,
        depth: z1 - z0,
        id: `probe-tile-${xSegment}-${zSegment}`,
        probeIndices: [
          getProbeIndex(layout.maze.width, xStartIndex, zStartIndex),
          getProbeIndex(layout.maze.width, xEndIndex, zStartIndex),
          getProbeIndex(layout.maze.width, xStartIndex, zEndIndex),
          getProbeIndex(layout.maze.width, xEndIndex, zEndIndex)
        ],
        region: {
          minX: x0,
          minZ: z0,
          sizeX: x1 - x0,
          sizeZ: z1 - z0
        },
        width: x1 - x0
      })
    }
  }

  return rects
}
