import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
import { DataUtils } from 'three'
import {
  bakeMazeLightmap,
  MAZE_LIGHTMAP_VERSION,
  MAZE_HEIGHT,
  MAZE_TARGET_COUNT,
  MAZE_WIDTH,
  generateMaze,
  getMazeWallSegments,
  getMazeSignature,
  serializeMazeModule,
  validateMaze
} from './maze.js'
import { decodeRgbE8, encodeRgbE8 } from './probeSphericalHarmonics.js'

const MAZE_FILE_PATTERN = /^maze-\d{3}\.js$/
export const DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY = path.join(
  process.cwd(),
  'logs',
  'lightmap-artifacts'
)

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)
  return imported.default
}

function getMazeFiles(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  return fs.readdirSync(directory)
    .filter((name) => MAZE_FILE_PATTERN.test(name))
    .sort()
}

function getNextMazeIndex(fileNames) {
  return fileNames.reduce((nextIndex, fileName) => {
    const match = fileName.match(/^maze-(\d{3})\.js$/)
    if (!match) {
      return nextIndex
    }

    return Math.max(nextIndex, Number(match[1]) + 1)
  }, 1)
}

function writeMazeIndex(directory, fileNames) {
  const imports = fileNames.map((fileName, index) => {
    return `import maze${index} from './${fileName}'`
  }).join('\n')
  const exportList = fileNames.map((_, index) => `maze${index}`).join(', ')
  const contents =
    `${imports}\n\nexport const MAZES = [${exportList}]\n`

  fs.writeFileSync(path.join(directory, 'index.js'), contents)
}

function pruneObsoleteMazeArtifactDirectories(artifactsDirectory, mazeIds) {
  if (!artifactsDirectory || !fs.existsSync(artifactsDirectory)) {
    return
  }

  const expectedMazeIds = new Set(mazeIds)

  for (const entry of fs.readdirSync(artifactsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    if (!expectedMazeIds.has(entry.name)) {
      fs.rmSync(path.join(artifactsDirectory, entry.name), {
        force: true,
        recursive: true
      })
    }
  }
}

function needsMazeRewrite(maze) {
  if (maze.lightmap?.version !== MAZE_LIGHTMAP_VERSION) {
    return true
  }

  const walls = getMazeWallSegments(maze)
  return walls.some((wall) => !maze.lightmap?.wallRects?.[wall.id])
}

function createMazeCandidate(mazeFactory, seed) {
  return mazeFactory === generateMaze
    ? mazeFactory(seed, { bakeLightmap: false })
    : mazeFactory(seed)
}

function normalizeCandidateTiming(maze) {
  if (!Number.isFinite(maze.generationMs)) {
    maze.generationMs = 0
  }
  if (!Number.isFinite(maze.totalGenerationMs)) {
    maze.totalGenerationMs = maze.generationMs
  }
}

function isAcceptableCandidate(maze, validation) {
  return (
    validation.valid &&
    maze.generationMs <= 100 &&
    maze.totalGenerationMs <= 5000
  )
}

function generateReplacementMaze({
  fileName,
  mazeFactory,
  maxGenerationAttempts,
  signatures,
  startingAttempt = 0
}) {
  for (let attempt = 0; attempt < maxGenerationAttempts; attempt += 1) {
    const seed =
      Date.now() +
      (startingAttempt * 8191) +
      (attempt * 131071)
    const maze = createMazeCandidate(mazeFactory, seed)
    normalizeCandidateTiming(maze)
    maze.id = path.basename(fileName, '.js')
    if (!maze.lightmap) {
      maze.lightmap = bakeMazeLightmap(maze)
    }
    const validation = validateMaze(maze)

    if (!isAcceptableCandidate(maze, validation)) {
      continue
    }

    const signature = getMazeSignature(maze)
    if (signatures.has(signature)) {
      continue
    }

    return { maze, signature }
  }

  return null
}

function writeLightmapArtifactPng(filePath, width, height, pixelWriter) {
  const png = new PNG({ width, height })

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const pixelIndex = ((row * width) + column) * 4
      const [r, g, b, a] = pixelWriter(row, column)

      png.data[pixelIndex] = r
      png.data[pixelIndex + 1] = g
      png.data[pixelIndex + 2] = b
      png.data[pixelIndex + 3] = a
    }
  }

  fs.writeFileSync(filePath, PNG.sync.write(png))
}

export function buildMazeLightmapArtifactBuffers(maze) {
  if (!maze.lightmap?.dataBase64) {
    return null
  }

  const lightmap = maze.lightmap
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const pixelStride =
    lightmap.encoding === 'rgb16f'
      ? 6
      : lightmap.encoding === 'rgbe8'
        ? 4
        : 3
  const byteView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  const readChannel = (row, column, channelOffset) => {
    const pixelIndex = (((row * lightmap.atlasWidth) + column) * pixelStride) + channelOffset
    return bytes[pixelIndex] ?? 0
  }
  const readHalfFloatChannel = (row, column, channelOffset) => {
    const pixelIndex = ((((row * lightmap.atlasWidth) + column) * 3) + channelOffset) * 2
    return DataUtils.fromHalfFloat(byteView.getUint16(pixelIndex, true))
  }

  const decodedPixels = new Float32Array(lightmap.atlasWidth * lightmap.atlasHeight * 3)
  let maxComponent = 0

  for (let row = 0; row < lightmap.atlasHeight; row += 1) {
    for (let column = 0; column < lightmap.atlasWidth; column += 1) {
      const pixelOffset = ((row * lightmap.atlasWidth) + column) * 3

      if (lightmap.encoding === 'rgb16f') {
        decodedPixels[pixelOffset] = readHalfFloatChannel(row, column, 0)
        decodedPixels[pixelOffset + 1] = readHalfFloatChannel(row, column, 1)
        decodedPixels[pixelOffset + 2] = readHalfFloatChannel(row, column, 2)
        maxComponent = Math.max(
          maxComponent,
          decodedPixels[pixelOffset],
          decodedPixels[pixelOffset + 1],
          decodedPixels[pixelOffset + 2]
        )
        continue
      }

      if (pixelStride === 4) {
        const decoded = decodeRgbE8(
          readChannel(row, column, 0),
          readChannel(row, column, 1),
          readChannel(row, column, 2),
          readChannel(row, column, 3)
        )

        decodedPixels[pixelOffset] = decoded[0]
        decodedPixels[pixelOffset + 1] = decoded[1]
        decodedPixels[pixelOffset + 2] = decoded[2]
        maxComponent = Math.max(maxComponent, decoded[0], decoded[1], decoded[2])
        continue
      }

      decodedPixels[pixelOffset] = readChannel(row, column, 0) / 255
      decodedPixels[pixelOffset + 1] = readChannel(row, column, 1) / 255
      decodedPixels[pixelOffset + 2] = readChannel(row, column, 2) / 255
      maxComponent = Math.max(
        maxComponent,
        decodedPixels[pixelOffset],
        decodedPixels[pixelOffset + 1],
        decodedPixels[pixelOffset + 2]
      )
    }
  }

  const previewComponent = (value) => {
    if (!(value > 0)) {
      return 0
    }

    const toneMapped = value / (1 + value)
    return Math.max(0, Math.min(255, Math.round(toneMapped * 255)))
  }

  const buildPngBuffer = (pixelWriter) => {
    const png = new PNG({
      height: lightmap.atlasHeight,
      width: lightmap.atlasWidth
    })

    for (let row = 0; row < lightmap.atlasHeight; row += 1) {
      for (let column = 0; column < lightmap.atlasWidth; column += 1) {
        const pixelIndex = ((row * lightmap.atlasWidth) + column) * 4
        const [r, g, b, a] = pixelWriter(row, column)

        png.data[pixelIndex] = r
        png.data[pixelIndex + 1] = g
        png.data[pixelIndex + 2] = b
        png.data[pixelIndex + 3] = a
      }
    }

    return PNG.sync.write(png)
  }

  return {
    atlasPng: buildPngBuffer((row, column) => {
      const pixelOffset = ((row * lightmap.atlasWidth) + column) * 3
      return [
        previewComponent(decodedPixels[pixelOffset]),
        previewComponent(decodedPixels[pixelOffset + 1]),
        previewComponent(decodedPixels[pixelOffset + 2]),
        255
      ]
    }),
    metadata: {
      atlasHeight: lightmap.atlasHeight,
      atlasWidth: lightmap.atlasWidth,
      bakeMs: lightmap.bakeMs,
      encoding: lightmap.encoding ?? 'legacy-rgb',
      groundBounds: lightmap.groundBounds,
      groundRect: lightmap.groundRect,
      maxComponent,
      neutralRect: lightmap.neutralRect,
      version: lightmap.version,
      wallRects: lightmap.wallRects
    },
    runtimeAtlasPng: buildPngBuffer((row, column) => {
      if (lightmap.encoding === 'rgb16f') {
        const pixelOffset = ((row * lightmap.atlasWidth) + column) * 3
        const [r, g, b, a] = encodeRgbE8([
          decodedPixels[pixelOffset],
          decodedPixels[pixelOffset + 1],
          decodedPixels[pixelOffset + 2]
        ])

        return [r, g, b, a]
      }

      if (pixelStride === 4) {
        return [
          readChannel(row, column, 0),
          readChannel(row, column, 1),
          readChannel(row, column, 2),
          readChannel(row, column, 3)
        ]
      }

      return [
        readChannel(row, column, 0),
        readChannel(row, column, 1),
        readChannel(row, column, 2),
        255
      ]
    }),
    runtimeAtlasBytes:
      lightmap.encoding === 'rgb16f'
        ? Buffer.from(bytes)
        : null
  }
}

export function dumpMazeLightmapArtifacts({
  directory = DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
  maze
}) {
  if (!directory) {
    return null
  }

  const mazeDirectory = path.join(directory, maze.id)
  const buffers = buildMazeLightmapArtifactBuffers(maze)

  if (!buffers) {
    return null
  }

  fs.mkdirSync(mazeDirectory, { recursive: true })
  for (const obsoleteFileName of [
    'lightmap-ambient.png'
  ]) {
    fs.rmSync(path.join(mazeDirectory, obsoleteFileName), { force: true })
  }
  fs.writeFileSync(
    path.join(mazeDirectory, 'lightmap-atlas.png'),
    buffers.atlasPng
  )
  fs.writeFileSync(
    path.join(mazeDirectory, 'lightmap-torch.png'),
    buffers.atlasPng
  )
  fs.writeFileSync(
    path.join(mazeDirectory, 'lightmap-rgbe.png'),
    buffers.runtimeAtlasPng
  )
  if (buffers.runtimeAtlasBytes) {
    fs.writeFileSync(
      path.join(mazeDirectory, 'lightmap-runtime.bin'),
      buffers.runtimeAtlasBytes
    )
  }
  fs.writeFileSync(
    path.join(mazeDirectory, 'lightmap-metadata.json'),
    JSON.stringify(buffers.metadata, null, 2)
  )

  return mazeDirectory
}

export async function ensureMazeFiles({
  artifactsDirectory = DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
  directory,
  mazeFactory = generateMaze,
  maxGenerationAttempts = 200,
  onProgress = null,
  targetCount = MAZE_TARGET_COUNT
}) {
  const reportProgress = onProgress ?? (() => {})

  fs.mkdirSync(directory, { recursive: true })

  const validMazes = []
  const signatures = new Set()
  const fileNames = getMazeFiles(directory)

  for (let fileIndex = 0; fileIndex < fileNames.length; fileIndex += 1) {
    const fileName = fileNames[fileIndex]

    reportProgress({
      fileName,
      index: fileIndex + 1,
      stage: 'inspect-existing',
      total: fileNames.length
    })
    const filePath = path.join(directory, fileName)
    let maze = await importMazeModule(filePath)
    if (maze.width !== MAZE_WIDTH || maze.height !== MAZE_HEIGHT) {
      fs.rmSync(filePath, { force: true })
      reportProgress({
        action: 'remove-invalid-dimensions',
        fileName,
        stage: 'inspect-existing'
      })
      continue
    }

    const shouldRewrite = needsMazeRewrite(maze)
    if (shouldRewrite) {
      maze.lightmap = bakeMazeLightmap(maze)
      fs.writeFileSync(filePath, serializeMazeModule(maze))
      reportProgress({
        action: 'rewrite-lightmap',
        fileName,
        stage: 'inspect-existing'
      })
    }

    const validation = validateMaze(maze)

    if (!validation.valid) {
      const replacement = generateReplacementMaze({
        fileName,
        mazeFactory,
        maxGenerationAttempts,
        signatures,
        startingAttempt: fileIndex + 1
      })

      if (!replacement) {
        fs.rmSync(filePath, { force: true })
        reportProgress({
          action: 'remove-invalid-maze',
          fileName,
          stage: 'inspect-existing'
        })
        continue
      }

      maze = replacement.maze
      fs.writeFileSync(filePath, serializeMazeModule(maze))
      signatures.add(replacement.signature)
      validMazes.push({ fileName, maze })
      reportProgress({
        action: 'replace-invalid-maze-in-place',
        fileName,
        stage: 'inspect-existing',
        validCount: validMazes.length
      })
      continue
    }

    const signature = getMazeSignature(maze)
    if (signatures.has(signature)) {
      fs.rmSync(filePath, { force: true })
      reportProgress({
        action: 'remove-duplicate-maze',
        fileName,
        stage: 'inspect-existing'
      })
      continue
    }

    signatures.add(signature)
    validMazes.push({ fileName, maze })
    reportProgress({
      action: shouldRewrite ? 'kept-rewritten' : 'kept-existing',
      fileName,
      stage: 'inspect-existing',
      validCount: validMazes.length
    })
  }

  let nextIndex = getNextMazeIndex(getMazeFiles(directory))
  let generationAttempt = 0

  while (validMazes.length < targetCount) {
    if (generationAttempt >= maxGenerationAttempts) {
      throw new Error(
        `Unable to generate ${targetCount} valid mazes after ${maxGenerationAttempts} attempts`
      )
    }

    const seed =
      Date.now() +
      (nextIndex * 97) +
      (generationAttempt * 8191)
    generationAttempt += 1
    const maze = createMazeCandidate(mazeFactory, seed)
    normalizeCandidateTiming(maze)
    const validation = validateMaze(maze, {
      requireLightmap: maze.lightmap !== undefined
    })

    if (!isAcceptableCandidate(maze, validation)) {
      continue
    }

    const signature = getMazeSignature(maze)
    if (signatures.has(signature)) {
      continue
    }

    const fileName = `maze-${String(nextIndex).padStart(3, '0')}.js`
    nextIndex += 1
    maze.id = path.basename(fileName, '.js')
    if (!maze.lightmap) {
      maze.lightmap = bakeMazeLightmap(maze)
    }
    fs.writeFileSync(
      path.join(directory, fileName),
      serializeMazeModule(maze)
    )
    signatures.add(signature)
    validMazes.push({ fileName, maze })
    reportProgress({
      action: 'generate-new-maze',
      fileName,
      stage: 'generate-missing',
      validCount: validMazes.length
    })
  }

  if (artifactsDirectory) {
    pruneObsoleteMazeArtifactDirectories(
      artifactsDirectory,
      validMazes.map(({ maze }) => maze.id)
    )

    for (let index = 0; index < validMazes.length; index += 1) {
      const { maze } = validMazes[index]

      reportProgress({
        index: index + 1,
        mazeId: maze.id,
        stage: 'dump-artifacts',
        total: validMazes.length
      })
      dumpMazeLightmapArtifacts({
        directory: artifactsDirectory,
        maze
      })
    }
  }

  const finalFiles = getMazeFiles(directory)
  writeMazeIndex(directory, finalFiles)

  return finalFiles
}
