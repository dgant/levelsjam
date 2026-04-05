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
  MAZE_WIDTH,
  generateMaze,
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
  assert.ok(maze.generationMs < 100, `generation took ${maze.generationMs}ms`)
})

test('persists at least five valid mazes', async () => {
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({ directory: mazeDirectory })

  assert.ok(files.length >= MAZE_TARGET_COUNT)

  for (const maze of MAZES) {
    const validation = validateMaze(maze)
    assert.equal(validation.valid, true, validation.errors.join('\n'))
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

    const files = await ensureMazeFiles({ directory: temporaryDirectory })

    assert.ok(files.length >= MAZE_TARGET_COUNT)
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

  for (const wall of layout.walls) {
    assert.ok(wall.bounds.maxY > wall.bounds.minY)
    assert.ok(wall.bounds.maxX > wall.bounds.minX)
    assert.ok(wall.bounds.maxZ > wall.bounds.minZ)
  }

  for (const light of layout.lights) {
    assert.equal(light.torchPosition.x, light.sconcePosition.x)
    assert.equal(light.torchPosition.z, light.sconcePosition.z)
    assert.ok(light.torchPosition.y > light.sconcePosition.y)
  }
})
