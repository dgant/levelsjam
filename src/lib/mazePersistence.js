import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
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

export async function ensureMazeFiles({
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

  const finalFiles = getMazeFiles(directory)
  writeMazeIndex(directory, finalFiles)

  return finalFiles
}
