import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { BoxGeometry, DataUtils } from 'three'

import {
  MAZE_HEIGHT,
  MAZE_TARGET_COUNT,
  MAZE_CELL_SIZE,
  MAZE_WIDTH,
  bakeMazeLightmap,
  computeMazeVolumetricLightmapCoefficients,
  generateMaze,
  getMazeSceneLayout,
  validateMaze
} from '../src/lib/maze.js'
import {
  canMove,
  chooseSpiderDirection,
  createInitialTurnState,
  createMonsterMoveEdgeSet,
  cellKey
} from '../src/lib/turnRules.js'
import {
  DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
  dumpMazeLightmapArtifacts,
  ensureMazeFiles
} from '../src/lib/mazePersistence.js'
import { mapGroundWorldToLightmapLocalUv } from '../src/lib/groundLightmapUv.js'
import { decodeRgbE8, reconstructProbeRadiance } from '../src/lib/probeSphericalHarmonics.js'
import { SCONCE_RADIUS, WALL_WIDTH } from '../src/lib/sceneConstants.js'

const DEFAULT_MAZE_DIRECTORY = path.join(process.cwd(), 'src', 'data', 'mazes')

async function importPersistedMaze(
  fileName = 'maze-001.js',
  directory = DEFAULT_MAZE_DIRECTORY
) {
  const module = await import(
    `${pathToFileURL(path.join(directory, fileName)).href}?verify=${Math.random()}`
  )

  return module.default
}

function decodeLightmapPixel(bytes, lightmap, x, y) {
  const pixelIndex = ((y * lightmap.atlasWidth) + x)

  if (lightmap.encoding === 'rgb16f') {
    const atlasOffset = pixelIndex * 6
    return [
      DataUtils.fromHalfFloat(bytes.readUInt16LE(atlasOffset)),
      DataUtils.fromHalfFloat(bytes.readUInt16LE(atlasOffset + 2)),
      DataUtils.fromHalfFloat(bytes.readUInt16LE(atlasOffset + 4))
    ]
  }

  const atlasOffset = pixelIndex * 4
  return decodeRgbE8(
    bytes[atlasOffset],
    bytes[atlasOffset + 1],
    bytes[atlasOffset + 2],
    bytes[atlasOffset + 3]
  )
}

function sampleLightmapLuminance(bytes, lightmap, rect, column, row) {
  const pixel = decodeLightmapPixel(bytes, lightmap, rect.x + column, rect.y + row)
  return (pixel[0] + pixel[1] + pixel[2]) / 3
}

function luminance(color) {
  return (0.2126 * color[0]) + (0.7152 * color[1]) + (0.0722 * color[2])
}

test('generates valid mazes under 100ms', () => {
  const maze = generateMaze(123456, { bakeLightmap: false })
  const validation = validateMaze(maze, { requireLightmap: false })

  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.equal(maze.width, MAZE_WIDTH)
  assert.equal(maze.height, MAZE_HEIGHT)
  assert.equal(maze.lightmap, undefined)
  assert.ok(maze.generationMs < 100, `generation took ${maze.generationMs}ms`)
  assert.ok(maze.totalGenerationMs < 5000, `full generation took ${maze.totalGenerationMs}ms`)
})

test('places initial torch lights on pickup cells', () => {
  const maze = generateMaze(123456, { bakeLightmap: false })
  const lightCellKeys = new Set(
    maze.lights.map((light) => `${light.cell.x},${light.cell.y}`)
  )

  assert.ok(lightCellKeys.has(`${maze.sword.cell.x},${maze.sword.cell.y}`))
  assert.ok(lightCellKeys.has(`${maze.trophy.cell.x},${maze.trophy.cell.y}`))
})

test('initial monsters face legal movement cells', () => {
  const maze = generateMaze(123456, { bakeLightmap: false })
  const state = createInitialTurnState(maze)
  const openEdges = createMonsterMoveEdgeSet(maze)

  for (const monster of state.monsters) {
    assert.equal(
      canMove(maze, openEdges, monster.cell, monster.direction),
      true,
      `${monster.type} at ${cellKey(monster.cell)} faces blocked ${monster.direction}`
    )

    if (monster.type === 'spider') {
      assert.equal(
        chooseSpiderDirection(maze, openEdges, monster),
        monster.direction,
        'spider should begin facing the cell its wall-following rule will enter'
      )
    }
  }
})

test('generated wall decals avoid torch-bearing wall faces', () => {
  const maze = generateMaze(123456, { bakeLightmap: false })
  const layout = getMazeSceneLayout(maze, SCONCE_RADIUS)
  const lightFaceKeys = new Set(
    layout.lights.map((light) => {
      const normal =
        light.side === 'north'
          ? { x: 0, z: 1 }
          : light.side === 'south'
            ? { x: 0, z: -1 }
            : light.side === 'east'
              ? { x: -1, z: 0 }
              : { x: 1, z: 0 }
      const wallClearance = (WALL_WIDTH / 2) + SCONCE_RADIUS
      const wallX = light.sconcePosition.x - (normal.x * wallClearance)
      const wallZ = light.sconcePosition.z - (normal.z * wallClearance)

      return [
        wallX.toFixed(3),
        wallZ.toFixed(3),
        normal.x,
        normal.z
      ].join(':')
    })
  )

  for (const decal of layout.decals) {
    const key = [
      decal.position.x - (decal.normal.x * 0.006),
      decal.position.z - (decal.normal.z * 0.006),
      decal.normal.x,
      decal.normal.z
    ].map((value, index) => index < 2 ? Number(value).toFixed(3) : value).join(':')

    assert.equal(lightFaceKeys.has(key), false, `${decal.id} was placed on a lit wall face`)
  }
})

test('persists at least five valid mazes', async () => {
  const mazeDirectory = path.join(process.cwd(), 'src', 'data', 'mazes')
  const files = await ensureMazeFiles({
    artifactsDirectory: null,
    directory: mazeDirectory
  })

  assert.ok(files.length >= MAZE_TARGET_COUNT)
  assert.ok(files.every((fileName) => /^maze-\d{3}\.js$/.test(fileName)))
})

test('dumps persisted maze lightmap artifacts into the gitignored logs directory', async () => {
  const maze = await importPersistedMaze()
  const artifactDirectory = dumpMazeLightmapArtifacts({ maze })

  assert.equal(artifactDirectory, path.join(DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY, maze.id))
  assert.equal(fs.existsSync(path.join(artifactDirectory, 'lightmap-atlas.png')), true)
  assert.equal(fs.existsSync(path.join(artifactDirectory, 'lightmap-rgbe.png')), true)
  assert.equal(fs.existsSync(path.join(artifactDirectory, 'lightmap-torch.png')), true)
  assert.equal(fs.existsSync(path.join(artifactDirectory, 'lightmap-metadata.json')), true)
})

test('deletes invalid maze files and regenerates replacements', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'levelsjam-maze-test-')
  )
  const replacementMaze = await importPersistedMaze()

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
      artifactsDirectory: null,
      directory: temporaryDirectory,
      mazeFactory: () => ({
        ...JSON.parse(JSON.stringify(replacementMaze)),
        generationMs: 1,
        totalGenerationMs: 1
      }),
      targetCount: 1
    })

    assert.ok(files.length >= 1)
    assert.ok(files.some((fileName) => /^maze-\d{3}\.js$/.test(fileName)))
    const regeneratedMazeSource = fs.readFileSync(
      path.join(temporaryDirectory, files[0]),
      'utf8'
    )
    assert.notEqual(regeneratedMazeSource.includes('width: 4'), true)
    assert.equal(
      fs.existsSync(path.join(temporaryDirectory, 'index.js')),
      true
    )
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true })
  }
})

test('converts persisted mazes into wall segments and torch placements', async () => {
  const layout = getMazeSceneLayout(await importPersistedMaze(), SCONCE_RADIUS)

  assert.ok(layout.walls.length > 0)
  assert.ok(layout.lights.length > 0)
  assert.equal(layout.reflectionProbes.length, layout.maze.width * layout.maze.height)
  assert.ok(layout.maze.lightmap)
  assert.equal(
    Buffer.from(layout.maze.lightmap.dataBase64, 'base64').length,
    layout.maze.lightmap.atlasWidth * layout.maze.lightmap.atlasHeight * 6
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

test('maps runtime floor lightmap UVs to the same world-space orientation used by baking', async () => {
  const maze = await importPersistedMaze()
  const layout = getMazeSceneLayout(maze, SCONCE_RADIUS)
  const lightmap = layout.maze.lightmap
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')

  const sampleGroundAt = (worldX, worldZ) => {
    const localUv = mapGroundWorldToLightmapLocalUv(
      lightmap.groundBounds,
      worldX,
      worldZ
    )
    const column = Math.max(
      0,
      Math.min(
        lightmap.groundRect.width - 1,
        Math.round(localUv.u * (lightmap.groundRect.width - 1))
      )
    )
    const row = Math.max(
      0,
      Math.min(
        lightmap.groundRect.height - 1,
        Math.round(localUv.v * (lightmap.groundRect.height - 1))
      )
    )

    return sampleLightmapLuminance(bytes, lightmap, lightmap.groundRect, column, row)
  }

  for (const light of layout.lights) {
    const directLuminance = sampleGroundAt(light.torchPosition.x, light.torchPosition.z)
    const mirroredLuminance = sampleGroundAt(light.torchPosition.x, -light.torchPosition.z)

    assert.ok(
      directLuminance > 0.8,
      `expected floor lightmap to be bright at torch ${light.cell.x},${light.cell.y}:${light.side}, got ${directLuminance}`
    )
    assert.ok(
      directLuminance > mirroredLuminance * 2,
      `expected floor lightmap orientation to match bake at torch ${light.cell.x},${light.cell.y}:${light.side}, got direct=${directLuminance} mirrored=${mirroredLuminance}`
    )
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
    return sampleLightmapLuminance(bytes, lightmap, rect, column, row)
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
    return sampleLightmapLuminance(bytes, lightmap, rect, column, row)
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

  const floorRow = 8
  const floorCenter = sample(centerColumn, floorRow)
  const floorLeft = sample(sideColumn, floorRow)
  const floorRight = sample(rect.width - 1 - sideColumn, floorRow)

  assert.ok(
    floorCenter <= Math.max(floorLeft, floorRight) + 1e-6,
    `expected sconce contact shadow to continue to row ${floorRow}, got center=${floorCenter} left=${floorLeft} right=${floorRight}`
  )

  for (const row of [64, 72]) {
    const rowCenter = sample(centerColumn, row)
    const rowLeft = sample(sideColumn, row)
    const rowRight = sample(rect.width - 1 - sideColumn, row)
    const sideAverage = (rowLeft + rowRight) / 2

    assert.ok(
      rowCenter < sideAverage * 0.45,
      `expected attached sconce shadow to stay continuous at row ${row}, got center=${rowCenter} sideAverage=${sideAverage}`
    )
  }
})

test('bakes same-cell torch energy into volumetric lightmap coefficients', () => {
  const maze = {
    height: 1,
    id: 'volumetric-probe-torch-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'north' }],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 1
  }
  const layout = getMazeSceneLayout(maze, SCONCE_RADIUS)
  const probePosition = layout.reflectionProbes[0].position
  const torchPosition = layout.lights[0].torchPosition
  const toTorch = [
    torchPosition.x - probePosition.x,
    torchPosition.y - probePosition.y,
    torchPosition.z - probePosition.z
  ]
  const coefficients = computeMazeVolumetricLightmapCoefficients(
    maze,
    probePosition,
    SCONCE_RADIUS
  )
  const towardTorch = reconstructProbeRadiance(toTorch, coefficients)
  const awayFromTorch = reconstructProbeRadiance(
    [-toTorch[0], -toTorch[1], -toTorch[2]],
    coefficients
  )

  assert.ok(
    luminance(towardTorch) > luminance(awayFromTorch) * 2,
    `expected warm directional VLM torch energy, got toward=${towardTorch} away=${awayFromTorch}`
  )
  assert.ok(
    towardTorch[0] > towardTorch[1] * 2,
    `expected torch VLM energy to be warm, got ${towardTorch}`
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
      sum += sampleLightmapLuminance(bytes, lightmap, rect, column, row)
    }

    return sum / rect.width
  }
  const midWallAverage = sampleRowAverage(72)

  assert.ok(
    midWallAverage > 0,
    `expected visible baked torch contribution below the sconce top, got row-72 average ${midWallAverage}`
  )
})

test('stores baked wall skylight in the HDR lightmap', () => {
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
      sum += sampleLightmapLuminance(bytes, lightmap, rect, column, row)
    }
  }

  assert.ok(
    sum > 0,
    'expected the wall-face HDR lightmap to contain baked skylight contribution'
  )
})

test('bakes lightmap rectangles for maze wall short end faces', () => {
  const wallMaze = {
    height: 1,
    id: 'wall-short-side-lightmap-test',
    lights: [{ cell: { x: 0, y: 0 }, side: 'north' }],
    openEdges: [],
    opening: { cell: { x: 0, y: 0 }, side: 'south' },
    width: 1
  }
  const lightmap = bakeMazeLightmap(wallMaze)
  const rects = lightmap.wallRects['0,0:north:exterior']

  assert.equal(rects.nx.width, rects.nx.height)
  assert.equal(rects.px.width, rects.px.height)
  assert.ok(rects.nx.width > 1)
  assert.ok(rects.px.width > 1)
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
        sum += sampleLightmapLuminance(bytes, lightmap, rect, column, row)
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
