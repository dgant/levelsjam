import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { BoxGeometry } from 'three'

import { MAZES } from '../src/data/mazes/index.js'
import {
  MAZE_HEIGHT,
  MAZE_TARGET_COUNT,
  MAZE_CELL_SIZE,
  MAZE_WIDTH,
  bakeMazeLightmap,
  generateMaze,
  getMazeSceneLayout,
  validateMaze
} from '../src/lib/maze.js'
import { ensureMazeFiles } from '../src/lib/mazePersistence.js'
import { SCONCE_RADIUS } from '../src/lib/sceneLayout.js'

test('generates valid mazes under 100ms', () => {
  const maze = generateMaze(123456, { bakeLightmap: false })
  const validation = validateMaze(maze, { requireLightmap: false })

  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.equal(maze.width, MAZE_WIDTH)
  assert.equal(maze.height, MAZE_HEIGHT)
  assert.equal(maze.lightmap, undefined)
  assert.ok(maze.generationMs < 100, `generation took ${maze.generationMs}ms`)
})

test('persists at least five valid mazes', async () => {
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({ directory: mazeDirectory })

  assert.ok(files.length >= MAZE_TARGET_COUNT)

  for (const fileName of files) {
    const module = await import(
      `${pathToFileURL(path.join(mazeDirectory, fileName)).href}?verify=${Math.random()}`
    )
    const maze = module.default
    const validation = validateMaze(maze)
    assert.equal(validation.valid, true, validation.errors.join('\n'))
    assert.ok(maze.lightmap)
  }
})

test('deletes invalid maze files and regenerates replacements', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'levelsjam-maze-test-')
  )

  try {
    fs.writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ type: 'module' })
    )
    fs.writeFileSync(
      path.join(temporaryDirectory, 'maze-001.js'),
      'export default { width: 4, height: 4, opening: { cell: { x: 0, y: 0 }, side: "north" }, openEdges: [], lights: [] }\n'
    )

    const files = await ensureMazeFiles({
      directory: temporaryDirectory,
      mazeFactory: () => structuredClone(MAZES[0]),
      targetCount: 1
    })

    assert.ok(files.length >= 1)
    for (const fileName of files) {
      const module = await import(
        `${pathToFileURL(path.join(temporaryDirectory, fileName)).href}?verify=${Math.random()}`
      )
      const validation = validateMaze(module.default)
      assert.equal(validation.valid, true, validation.errors.join('\n'))
    }
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true })
  }
})

test('converts persisted mazes into wall segments and torch placements', () => {
  const layout = getMazeSceneLayout(MAZES[0], SCONCE_RADIUS)

  assert.ok(layout.walls.length > 0)
  assert.ok(layout.lights.length > 0)
  assert.equal(layout.reflectionProbes.length, layout.maze.width * layout.maze.height)
  assert.ok(layout.maze.lightmap)
  assert.equal(
    Buffer.from(layout.maze.lightmap.dataBase64, 'base64').length,
    layout.maze.lightmap.atlasWidth * layout.maze.lightmap.atlasHeight * 3
  )
  assert.equal(layout.maze.lightmap.groundRect.width, 256)
  assert.equal(layout.maze.lightmap.groundRect.height, 256)
  assert.ok(layout.maze.lightmap.groundBounds.width > (layout.maze.width * MAZE_CELL_SIZE))
  assert.ok(layout.maze.lightmap.groundBounds.depth > (layout.maze.height * MAZE_CELL_SIZE))

  for (const wall of layout.walls) {
    assert.ok(wall.bounds.maxY > wall.bounds.minY)
    assert.ok(wall.bounds.maxX > wall.bounds.minX)
    assert.ok(wall.bounds.maxZ > wall.bounds.minZ)
    assert.ok(layout.maze.lightmap.wallRects[wall.id])
    assert.equal(layout.maze.lightmap.wallRects[wall.id].nz.width, 128)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].nz.height, 128)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].pz.width, 128)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].pz.height, 128)
  }

  for (const light of layout.lights) {
    assert.equal(light.torchPosition.x, light.sconcePosition.x)
    assert.equal(light.torchPosition.z, light.sconcePosition.z)
    assert.ok(light.torchPosition.y > light.sconcePosition.y)
  }
})

test('keeps baked lighting continuous across an open coplanar wall run', () => {
  const seamMaze = {
    height: 1,
    id: 'seam-test',
    lights: [{ cell: { x: 1, y: 0 }, side: 'north' }],
    openEdges: [
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } }
    ],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 3
  }
  const lightmap = bakeMazeLightmap(seamMaze)
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const centerRect = lightmap.wallRects['1,0:north:exterior'].pz
  const rightRect = lightmap.wallRects['2,0:north:exterior'].pz

  const sample = (rect, column, row) => {
    const atlasOffset =
      ((((rect.y + row) * lightmap.atlasWidth) + rect.x + column) * 3)

    return bytes[atlasOffset]
  }

  let seamDifferenceTotal = 0
  let seamRowCount = 0

  for (let row = 0; row < centerRect.height; row += 1) {
    seamDifferenceTotal += Math.abs(
      sample(centerRect, centerRect.width - 1, row) -
      sample(rightRect, 0, row)
    )
    seamRowCount += 1
  }

  const averageSeamDifference = seamDifferenceTotal / seamRowCount

  assert.ok(
    averageSeamDifference <= 2,
    `expected open coplanar wall seam to stay continuous, got average edge delta ${averageSeamDifference}`
  )
})

test('bakes local sconce occlusion into the attached wall face', () => {
  const shadowMaze = {
    height: 1,
    id: 'shadow-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'north' }],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 1
  }
  const lightmap = bakeMazeLightmap(shadowMaze)
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const rect = lightmap.wallRects['0,0:north:exterior'].pz
  const sample = (column, row) => {
    const atlasOffset =
      ((((rect.y + row) * lightmap.atlasWidth) + rect.x + column) * 3)

    return bytes[atlasOffset]
  }
  const shadowRow = 64
  const centerColumn = Math.floor(rect.width / 2)
  const sideColumn = centerColumn - 18
  const center = sample(centerColumn, shadowRow)
  const left = sample(sideColumn, shadowRow)
  const right = sample(rect.width - 1 - sideColumn, shadowRow)

  assert.ok(
    center < left && center < right,
    `expected sconce occlusion shadow at row ${shadowRow}, got center=${center} left=${left} right=${right}`
  )
})

test('keeps mid-wall torch lighting visible below the sconce top', () => {
  const wallMaze = {
    height: 1,
    id: 'wall-gradient-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'north' }],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 1
  }
  const lightmap = bakeMazeLightmap(wallMaze)
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const rect = lightmap.wallRects['0,0:north:exterior'].pz
  const sampleRowAverage = (row) => {
    let sum = 0

    for (let column = 0; column < rect.width; column += 1) {
      sum += bytes[((((rect.y + row) * lightmap.atlasWidth) + rect.x + column) * 3)]
    }

    return sum / rect.width
  }
  const midWallAverage = sampleRowAverage(72)

  assert.ok(
    midWallAverage > 0,
    `expected visible baked torch contribution below the sconce top, got row-72 average ${midWallAverage}`
  )
})

test('stores baked wall ambient in the lightmap ambient channel', () => {
  const wallMaze = {
    height: 1,
    id: 'wall-ambient-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'north' }],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 1
  }
  const lightmap = bakeMazeLightmap(wallMaze)
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const rect = lightmap.wallRects['0,0:north:exterior'].pz
  let sum = 0

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const atlasOffset =
        ((((rect.y + row) * lightmap.atlasWidth) + rect.x + column) * 3)

      sum += bytes[atlasOffset + 1]
    }
  }

  assert.ok(
    sum > 0,
    'expected the wall-face ambient lightmap channel to contain baked environment contribution'
  )
})

test('three box geometry mirrors local -Z face UVs relative to +Z', () => {
  const geometry = new BoxGeometry(1, 1, 1)
  const positions = geometry.getAttribute('position')
  const uvs = geometry.getAttribute('uv')
  const findVertexUvX = (materialIndex, predicate) => {
    const group = geometry.groups.find((entry) => entry.materialIndex === materialIndex)

    assert.ok(group, `missing geometry group ${materialIndex}`)

    for (let offset = group.start; offset < (group.start + group.count); offset += 1) {
      const vertexIndex = geometry.index.array[offset]
      if (predicate(vertexIndex)) {
        return uvs.getX(vertexIndex)
      }
    }

    throw new Error(`no matching vertex found for group ${materialIndex}`)
  }
  const pzLeftUv = findVertexUvX(
    4,
    (vertexIndex) => positions.getZ(vertexIndex) > 0 && positions.getX(vertexIndex) < 0
  )
  const pzRightUv = findVertexUvX(
    4,
    (vertexIndex) => positions.getZ(vertexIndex) > 0 && positions.getX(vertexIndex) > 0
  )
  const nzLeftUv = findVertexUvX(
    5,
    (vertexIndex) => positions.getZ(vertexIndex) < 0 && positions.getX(vertexIndex) < 0
  )
  const nzRightUv = findVertexUvX(
    5,
    (vertexIndex) => positions.getZ(vertexIndex) < 0 && positions.getX(vertexIndex) > 0
  )

  assert.ok(pzLeftUv < pzRightUv, `expected +Z face UVs to increase with local X, got ${pzLeftUv}..${pzRightUv}`)
  assert.ok(nzLeftUv > nzRightUv, `expected -Z face UVs to be mirrored in local X, got ${nzLeftUv}..${nzRightUv}`)
})

test('assigns z-axis wall-run lightmap slices to the correct wall', () => {
  const maze = {
    height: 2,
    id: 'z-order-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'west' }],
    openEdges: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }],
    opening: { cell: { x: 0, y: 0 }, side: 'north' },
    width: 1
  }
  const lightmap = bakeMazeLightmap(maze)
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const getFaceAverage = (wallId, faceKey) => {
    const rect = lightmap.wallRects[wallId][faceKey]
    let sum = 0

    for (let row = 0; row < rect.height; row += 1) {
      for (let column = 0; column < rect.width; column += 1) {
        sum += bytes[((((rect.y + row) * lightmap.atlasWidth) + rect.x + column) * 3)]
      }
    }

    return sum / (rect.width * rect.height)
  }
  const litWallAverage = getFaceAverage('0,0:west:exterior', 'pz')
  const adjacentWallAverage = getFaceAverage('0,1:west:exterior', 'pz')

  assert.ok(
    litWallAverage > adjacentWallAverage,
    `expected the torch wall to bake brighter than the adjacent z-run wall, got ${litWallAverage} <= ${adjacentWallAverage}`
  )
})
