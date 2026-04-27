const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const sourceDirectory = path.join(rootDir, 'src', 'data', 'mazes')
const mazeFilePattern = /^maze-\d{3}\.js$/

const debugBakeModes = [
  {
    fileName: 'surface-lightmap-legacy-gpu-rgbe.png',
    key: 'legacy-gpu',
    label: 'Legacy GPU direct',
    mode: 0
  },
  {
    fileName: 'surface-lightmap-soft-shadows-rgbe.png',
    key: 'soft-shadows',
    label: 'Soft shadows only',
    mode: 2
  },
  {
    fileName: 'surface-lightmap-bounce-only-rgbe.png',
    key: 'bounce-only',
    label: 'Bounce only',
    mode: 3
  },
  {
    fileName: 'surface-lightmap-bounce-only-16x-rgbe.png',
    key: 'bounce-only-16x',
    label: 'Bounce only 16x',
    mode: 4
  },
  {
    fileName: 'surface-lightmap-bounce-only-no-pbr-rgbe.png',
    key: 'bounce-only-no-pbr',
    label: 'Bounce only no PBR',
    mode: 5
  }
]

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)
  return imported.default
}

function writeVariantAtlas({
  buildMazeLightmapArtifactBuffers,
  dataBase64,
  fileName,
  maze,
  outputDirectory
}) {
  const lightmap = {
    ...maze.lightmap,
    dataBase64
  }
  const buffers = buildMazeLightmapArtifactBuffers({
    ...maze,
    lightmap
  })

  if (!buffers?.runtimeAtlasPng) {
    throw new Error(`Failed to build runtime lightmap atlas for ${maze.id}/${fileName}`)
  }

  fs.writeFileSync(path.join(outputDirectory, fileName), buffers.runtimeAtlasPng)
}

async function main() {
  const {
    bakeMazeLightmap
  } = await import('../src/lib/maze.js')
  const {
    buildMazeLightmapArtifactBuffers
  } = await import('../src/lib/mazePersistence.js')
  const {
    createAuthoredRuntimeMaze,
    getAuthoredRuntimeLevelIds
  } = await import('../src/lib/levels.js')

  fs.mkdirSync(outputDirectory, { recursive: true })

  const authoredLevelIds = getAuthoredRuntimeLevelIds()
  const sourceMazeFiles = fs.readdirSync(sourceDirectory)
    .filter((fileName) => mazeFilePattern.test(fileName))
    .sort()
  const entries = []

  for (const authoredLevelId of authoredLevelIds) {
    entries.push({
      id: authoredLevelId,
      load: () => createAuthoredRuntimeMaze(authoredLevelId)
    })
  }

  for (const fileName of sourceMazeFiles) {
    const filePath = path.join(sourceDirectory, fileName)
    const id = path.basename(fileName, '.js')

    entries.push({
      id,
      load: () => importMazeModule(filePath)
    })
  }

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const mazeOutputDirectory = path.join(outputDirectory, entry.id)
    const missingModes = debugBakeModes.filter((mode) =>
      !fs.existsSync(path.join(mazeOutputDirectory, mode.fileName))
    )

    if (missingModes.length === 0) {
      console.log(
        `[lightmap-debug-variants] skipping ${index + 1}/${entries.length} ${entry.id}; variants already exist`
      )
      continue
    }

    const maze = await entry.load()

    if (!maze?.lightmap) {
      throw new Error(`Maze ${entry.id} does not have a base lightmap`)
    }

    console.log(
      `[lightmap-debug-variants] baking ${index + 1}/${entries.length} ${entry.id}`
    )

    const lightmap = await bakeMazeLightmap(maze, undefined, {
      bakeModes: missingModes.map((mode) => ({
        key: mode.key,
        mode: mode.mode
      }))
    })

    fs.mkdirSync(mazeOutputDirectory, { recursive: true })

    for (const mode of missingModes) {
      const dataBase64 = lightmap.debugVariantDataBase64?.[mode.key]

      if (!dataBase64) {
        throw new Error(`Missing ${mode.key} lightmap variant for ${entry.id}`)
      }

      writeVariantAtlas({
        buildMazeLightmapArtifactBuffers,
        dataBase64,
        fileName: mode.fileName,
        maze: {
          ...maze,
          lightmap: {
            ...maze.lightmap,
            atlasHeight: lightmap.atlasHeight,
            atlasWidth: lightmap.atlasWidth,
            groundBounds: lightmap.groundBounds,
            groundRect: lightmap.groundRect,
            neutralRect: lightmap.neutralRect,
            version: lightmap.version,
            wallRects: lightmap.wallRects
          }
        },
        outputDirectory: mazeOutputDirectory
      })
    }
  }

  console.log(
    `[lightmap-debug-variants] wrote ${debugBakeModes.length} variants for ${entries.length} mazes`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
