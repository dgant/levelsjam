const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const sourceDirectory = path.join(rootDir, 'src', 'data', 'mazes')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const mazeFilePattern = /^maze-\d{3}\.js$/

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)
  return imported.default
}

function replaceMazeLightmapWithRuntimeAssetUrls(maze) {
  if (!maze.lightmap) {
    return maze
  }

  return {
    ...maze,
    lightmap: {
      ...maze.lightmap,
      atlasUrl:
        maze.lightmap.encoding === 'rgb16f'
          ? `${maze.id}/surface-lightmap.bin`
          : `${maze.id}/surface-lightmap.png`,
      dataBase64: undefined
    }
  }
}

async function main() {
  const {
    buildMazeLightmapArtifactBuffers,
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
    dumpMazeLightmapArtifacts
  } = await import('../src/lib/mazePersistence.js')

  fs.mkdirSync(outputDirectory, { recursive: true })

  for (const fileName of fs.readdirSync(outputDirectory)) {
    if (fileName.endsWith('.json')) {
      fs.rmSync(path.join(outputDirectory, fileName), {
        force: true
      })
    }
  }

  const mazeFileNames = fs.readdirSync(sourceDirectory)
    .filter((fileName) => mazeFilePattern.test(fileName))
    .sort()
  const mazeIds = []

  for (let index = 0; index < mazeFileNames.length; index += 1) {
    const fileName = mazeFileNames[index]
    const filePath = path.join(sourceDirectory, fileName)
    const maze = await importMazeModule(filePath)
    const mazeId = path.basename(fileName, '.js')
    const mazeOutputDirectory = path.join(outputDirectory, mazeId)
    const runtimeMaze = replaceMazeLightmapWithRuntimeAssetUrls(maze)
    const lightmapBuffers = buildMazeLightmapArtifactBuffers(maze)

    console.log(
      `[sync-maze-runtime-data] writing ${index + 1}/${mazeFileNames.length} ${mazeId}.json`
    )
    fs.mkdirSync(mazeOutputDirectory, { recursive: true })
    if (lightmapBuffers) {
      if (lightmapBuffers.runtimeAtlasBytes) {
        fs.writeFileSync(
          path.join(mazeOutputDirectory, 'surface-lightmap.bin'),
          lightmapBuffers.runtimeAtlasBytes
        )
        fs.writeFileSync(
          path.join(mazeOutputDirectory, 'surface-lightmap.png'),
          lightmapBuffers.atlasPng
        )
        fs.writeFileSync(
          path.join(mazeOutputDirectory, 'surface-lightmap-rgbe.png'),
          lightmapBuffers.runtimeAtlasPng
        )
      } else {
        fs.rmSync(
          path.join(mazeOutputDirectory, 'surface-lightmap.bin'),
          { force: true }
        )
        fs.writeFileSync(
          path.join(mazeOutputDirectory, 'surface-lightmap.png'),
          lightmapBuffers.runtimeAtlasPng
        )
        fs.rmSync(
          path.join(mazeOutputDirectory, 'surface-lightmap-rgbe.png'),
          { force: true }
        )
      }
    }
    fs.writeFileSync(
      path.join(outputDirectory, `${mazeId}.json`),
      JSON.stringify(runtimeMaze)
    )
    dumpMazeLightmapArtifacts({
      directory: DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
      maze
    })
    mazeIds.push(mazeId)
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'index.json'),
    JSON.stringify({ mazeIds }, null, 2)
  )

  console.log(
    `[sync-maze-runtime-data] wrote ${mazeIds.length} maze payloads to ${outputDirectory}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
