const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const challengeSourceDirectory = path.join(rootDir, 'src', 'data', 'challenge-mazes')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const manifestPath = path.join(outputDirectory, 'index.json')
const challengeMazeFilePattern = /^challenge-\d{3}\.js$/
const NEUTRAL_LIGHTMAP_SIZE = 4

function createNeutralLightmapDataBase64() {
  const bytes = Buffer.alloc(NEUTRAL_LIGHTMAP_SIZE * NEUTRAL_LIGHTMAP_SIZE * 3 * 2)

  for (let index = 0; index < bytes.length; index += 2) {
    bytes[index] = 0x00
    bytes[index + 1] = 0x3c
  }

  return bytes.toString('base64')
}

function createCompactPlaytestLightmap(maze) {
  const worldWidth = Math.max(maze.width * 2, 1)
  const worldDepth = Math.max(maze.height * 2, 1)
  const margin = 2
  const boundsWidth = worldWidth + (margin * 2)
  const boundsDepth = worldDepth + (margin * 2)

  return {
    atlasHeight: NEUTRAL_LIGHTMAP_SIZE,
    atlasWidth: NEUTRAL_LIGHTMAP_SIZE,
    bakeMs: 0,
    dataBase64: createNeutralLightmapDataBase64(),
    encoding: 'rgb16f',
    groundBounds: {
      centerX: 0,
      centerZ: 0,
      depth: boundsDepth,
      height: boundsDepth,
      margin,
      maxX: boundsWidth / 2,
      maxZ: boundsDepth / 2,
      minX: -boundsWidth / 2,
      minZ: -boundsDepth / 2,
      width: boundsWidth
    },
    groundRect: {
      height: NEUTRAL_LIGHTMAP_SIZE,
      width: NEUTRAL_LIGHTMAP_SIZE,
      x: 0,
      y: 0
    },
    neutralRect: {
      height: NEUTRAL_LIGHTMAP_SIZE,
      width: NEUTRAL_LIGHTMAP_SIZE,
      x: 0,
      y: 0
    },
    altarRects: {},
    version: 32,
    wallRects: {}
  }
}

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)

  return imported.default
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true })

  const existingManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { mazeIds: [], storyMazeIds: [] }
  const challengeMazeFileNames = fs.readdirSync(challengeSourceDirectory)
    .filter((fileName) => challengeMazeFilePattern.test(fileName))
    .sort()
  const challengeMazeIds = []
  const challenges = []
  const nonChallengeMazeIds = (existingManifest.mazeIds ?? [])
    .filter((id) => typeof id === 'string' && !id.startsWith('challenge-'))

  for (const fileName of challengeMazeFileNames) {
    const mazeId = path.basename(fileName, '.js')
    const maze = await importMazeModule(path.join(challengeSourceDirectory, fileName))
    const runtimeMaze = {
      ...maze,
      id: mazeId,
      lightmap: maze.lightmap ?? createCompactPlaytestLightmap(maze),
      sourceSignature: `compact-playtest:${mazeId}`
    }

    fs.writeFileSync(
      path.join(outputDirectory, `${mazeId}.json`),
      JSON.stringify(runtimeMaze)
    )
    fs.mkdirSync(path.join(outputDirectory, mazeId), { recursive: true })
    fs.writeFileSync(
      path.join(outputDirectory, mazeId, 'probe-assets.json'),
      JSON.stringify({
        faceSize: 0,
        generatedAt: new Date(0).toISOString(),
        mazeId,
        probeCount: 0,
        probes: []
      }, null, 2)
    )
    challengeMazeIds.push(mazeId)
    challenges.push({
      description: maze.description ?? '',
      id: mazeId,
      name: maze.name ?? mazeId
    })
  }

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      ...existingManifest,
      challengeMazeIds,
      challenges,
      mazeIds: [...nonChallengeMazeIds, ...challengeMazeIds],
      storyMazeIds: existingManifest.storyMazeIds ?? []
    }, null, 2)
  )

  console.log(
    `[publish-challenge-maze-playtest] published ${challengeMazeIds.length} compact challenge mazes`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
