import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { MAZES } from '../src/data/mazes/index.js'
import {
  MAZE_HEIGHT,
  MAZE_TARGET_COUNT,
  MAZE_CELL_SIZE,
  MAZE_WIDTH,
  bakeMazeLightmap,
  generateMaze,
  getMazeFloorLightmapBounds,
  getMazeSceneLayout,
  validateMaze
} from '../src/lib/maze.js'
import { ensureMazeFiles } from '../src/lib/mazePersistence.js'
import { SCONCE_RADIUS } from '../src/lib/sceneLayout.js'

test('generates valid mazes under 100ms', () => {
  const maze = generateMaze(123456)
  const validation = validateMaze(maze)

  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.equal(maze.width, MAZE_WIDTH)
  assert.equal(maze.height, MAZE_HEIGHT)
  assert.ok(maze.lightmap)
  assert.equal(typeof maze.lightmap.dataBase64, 'string')
  assert.equal(maze.lightmap.version, 8)
  assert.deepEqual(
    maze.lightmap.groundBounds,
    getMazeFloorLightmapBounds(maze)
  )
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
    assert.equal(layout.maze.lightmap.wallRects[wall.id].nz.width, 32)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].nz.height, 32)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].pz.width, 32)
    assert.equal(layout.maze.lightmap.wallRects[wall.id].pz.height, 32)
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
