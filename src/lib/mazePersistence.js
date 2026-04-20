import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
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

function needsMazeRewrite(maze) {
  if (maze.lightmap?.version !== MAZE_LIGHTMAP_VERSION) {
    return true
  }

  const walls = getMazeWallSegments(maze)
  return walls.some((wall) => !maze.lightmap?.wallRects?.[wall.id])
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

export function dumpMazeLightmapArtifacts({
  directory = DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
  maze
}) {
  if (!directory || !maze.lightmap?.dataBase64) {
    return null
  }

  const mazeDirectory = path.join(directory, maze.id)
  const lightmap = maze.lightmap
  const bytes = Buffer.from(lightmap.dataBase64, 'base64')
  const pixelStride = 3

  fs.mkdirSync(mazeDirectory, { recursive: true })

  const readChannel = (row, column, channelOffset) => {
    const pixelIndex = (((row * lightmap.atlasWidth) + column) * pixelStride) + channelOffset
    return bytes[pixelIndex] ?? 0
  }

  writeLightmapArtifactPng(
    path.join(mazeDirectory, 'lightmap-atlas.png'),
    lightmap.atlasWidth,
    lightmap.atlasHeight,
    (row, column) => [
      readChannel(row, column, 0),
      readChannel(row, column, 1),
      readChannel(row, column, 2),
      255
    ]
  )
  writeLightmapArtifactPng(
    path.join(mazeDirectory, 'lightmap-torch.png'),
    lightmap.atlasWidth,
    lightmap.atlasHeight,
    (row, column) => {
      const value = readChannel(row, column, 0)
      return [value, value, value, 255]
    }
  )
  writeLightmapArtifactPng(
    path.join(mazeDirectory, 'lightmap-ambient.png'),
    lightmap.atlasWidth,
    lightmap.atlasHeight,
    (row, column) => {
      const value = readChannel(row, column, 1)
      return [value, value, value, 255]
    }
  )
  fs.writeFileSync(
    path.join(mazeDirectory, 'lightmap-metadata.json'),
    JSON.stringify(
      {
        atlasHeight: lightmap.atlasHeight,
        atlasWidth: lightmap.atlasWidth,
        bakeMs: lightmap.bakeMs,
        groundBounds: lightmap.groundBounds,
        groundRect: lightmap.groundRect,
        neutralRect: lightmap.neutralRect,
        version: lightmap.version,
        wallRects: lightmap.wallRects
      },
      null,
      2
    )
  )

  return mazeDirectory
}

export async function ensureMazeFiles({
  artifactsDirectory = DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
  directory,
  mazeFactory = generateMaze,
  targetCount = MAZE_TARGET_COUNT
}) {
  fs.mkdirSync(directory, { recursive: true })

  const validMazes = []
  const signatures = new Set()
  const fileNames = getMazeFiles(directory)

  for (const fileName of fileNames) {
    const filePath = path.join(directory, fileName)
    let maze = await importMazeModule(filePath)
    if (maze.width !== MAZE_WIDTH || maze.height !== MAZE_HEIGHT) {
      fs.rmSync(filePath, { force: true })
      continue
    }

    const shouldRewrite = needsMazeRewrite(maze)
    if (shouldRewrite) {
      maze.lightmap = bakeMazeLightmap(maze)
      fs.writeFileSync(filePath, serializeMazeModule(maze))
    }

    const validation = validateMaze(maze)

    if (!validation.valid) {
      fs.rmSync(filePath, { force: true })
      continue
    }

    const signature = getMazeSignature(maze)
    if (signatures.has(signature)) {
      fs.rmSync(filePath, { force: true })
      continue
    }

    signatures.add(signature)
    validMazes.push({ fileName, maze })
  }

  let nextIndex = getNextMazeIndex(getMazeFiles(directory))
  let generationAttempt = 0

  while (validMazes.length < targetCount) {
    const seed =
      Date.now() +
      (nextIndex * 97) +
      (generationAttempt * 8191)
    generationAttempt += 1
    const maze = mazeFactory(seed)
    const validation = validateMaze(maze)

    if (!validation.valid || maze.generationMs > 100) {
      continue
    }

    const signature = getMazeSignature(maze)
    if (signatures.has(signature)) {
      continue
    }

    const fileName = `maze-${String(nextIndex).padStart(3, '0')}.js`
    nextIndex += 1
    maze.id = path.basename(fileName, '.js')
    fs.writeFileSync(
      path.join(directory, fileName),
      serializeMazeModule(maze)
    )
    signatures.add(signature)
    validMazes.push({ fileName, maze })
  }

  if (artifactsDirectory) {
    for (const { maze } of validMazes) {
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
