const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const authoredMazeDirectory = path.join(rootDir, 'maze-data')
const sourceDirectory = path.join(rootDir, 'src', 'data', 'mazes')
const challengeSourceDirectory = path.join(rootDir, 'src', 'data', 'challenge-mazes')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const mazeFilePattern = /^maze-\d{3}\.js$/
const challengeMazeFilePattern = /^challenge-\d{3}\.js$/
const bakeChallengeMazes = process.env.LEVELSJAM_SYNC_CHALLENGE_LIGHTMAPS === '1'
const bakeChallengeMazesCpu = process.env.LEVELSJAM_SYNC_CHALLENGE_LIGHTMAPS_CPU === '1'

async function importMazeModule(filePath) {
  const moduleUrl = `${pathToFileURL(filePath).href}?cacheBust=${Date.now()}-${Math.random()}`
  const imported = await import(moduleUrl)
  return imported.default
}

function loadPersistedAuthoredMaze(id) {
  const filePath = path.join(authoredMazeDirectory, `${id}.json`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function authoredMazeNeedsRebake(id, maze) {
  if (!maze?.lightmap) {
    return true
  }

  const altars = Array.isArray(maze.altars) ? maze.altars : []

  if (id === 'chamber-1' && altars.length === 0) {
    return true
  }

  if (altars.length === 0) {
    return false
  }

  const altarRects = maze.lightmap.altarRects ?? {}

  return altars.some((altar, index) => {
    const id = altar.id ?? `altar-${index}`
    const rects = altarRects[id]

    return !rects?.py || !rects?.nz || !rects?.pz || !rects?.nx || !rects?.px
  })
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
          ? `${maze.id}/surface-lightmap-rgbe.rgbe`
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
  const {
    createAuthoredRuntimeMaze,
    getAuthoredRuntimeLevelIds
  } = await import('../src/lib/levels.js')
  const {
    bakeMazeLightmap,
    computeMazeCellVisibility,
    getMazeSignature
  } = await import('../src/lib/maze.js')

  fs.mkdirSync(outputDirectory, { recursive: true })

  const authoredLevelIds = getAuthoredRuntimeLevelIds()
  const mazeFileNames = fs.readdirSync(sourceDirectory)
    .filter((fileName) => mazeFilePattern.test(fileName))
    .sort()
  const challengeMazeFileNames = fs.existsSync(challengeSourceDirectory)
    ? fs.readdirSync(challengeSourceDirectory)
      .filter((fileName) => challengeMazeFilePattern.test(fileName))
      .sort()
    : []
  const mazeIds = []
  const storyMazeIds = []
  const challengeMazeIds = []
  const challenges = []
  const skippedChallengeMazeIds = []

  const writeRuntimeMaze = (maze, mazeId, position, total) => {
    const mazeOutputDirectory = path.join(outputDirectory, mazeId)
    const runtimeMaze = replaceMazeLightmapWithRuntimeAssetUrls(maze)
    const lightmapBuffers = buildMazeLightmapArtifactBuffers(maze)

    console.log(
      `[sync-maze-runtime-data] writing ${position}/${total} ${mazeId}.json`
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
        fs.writeFileSync(
          path.join(mazeOutputDirectory, 'surface-lightmap-rgbe.rgbe'),
          lightmapBuffers.runtimeAtlasRgbEBytes
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
        fs.rmSync(
          path.join(mazeOutputDirectory, 'surface-lightmap-rgbe.rgbe'),
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

  const ensureMazeHasRuntimeLightmap = async (maze, mazeId) => {
    const runtimePayloadPath = path.join(outputDirectory, `${mazeId}.json`)
    const sourceSignature = getMazeSignature(maze)

    if (maze.lightmap?.dataBase64) {
      return maze
    }

    if (fs.existsSync(runtimePayloadPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(runtimePayloadPath, 'utf8'))

        if (
          existing.sourceSignature === sourceSignature &&
          existing.lightmap?.atlasUrl
        ) {
          return {
            ...maze,
            lightmap: existing.lightmap,
            sourceSignature
          }
        }
      } catch {
        // A corrupt runtime payload will be overwritten by a fresh bake below.
      }
    }

    const mazeWithVisibility = maze.visibility
      ? maze
      : {
          ...maze,
          visibility: computeMazeCellVisibility(maze)
        }

    if (!bakeChallengeMazes) {
      return null
    }

    return {
      ...mazeWithVisibility,
      lightmap: await bakeMazeLightmap(mazeWithVisibility, undefined, {
        forceCpu: bakeChallengeMazesCpu
      }),
      sourceSignature
    }
  }

  const totalPayloads =
    authoredLevelIds.length +
    mazeFileNames.length +
    (bakeChallengeMazes ? challengeMazeFileNames.length : 0)

  for (let index = 0; index < authoredLevelIds.length; index += 1) {
    const authoredLevelId = authoredLevelIds[index]
    const persistedMaze = loadPersistedAuthoredMaze(authoredLevelId)
    const needsAuthoredRebake =
      !persistedMaze || authoredMazeNeedsRebake(authoredLevelId, persistedMaze)
    const maze = persistedMaze && !needsAuthoredRebake
      ? persistedMaze
      : await createAuthoredRuntimeMaze(authoredLevelId, { bakeLightmap: true })

    if (!maze) {
      throw new Error(`Failed to create authored runtime level ${authoredLevelId}`)
    }

    if (needsAuthoredRebake) {
      fs.writeFileSync(
        path.join(authoredMazeDirectory, `${authoredLevelId}.json`),
        JSON.stringify(maze, null, 2)
      )
    }

    writeRuntimeMaze(maze, authoredLevelId, index + 1, totalPayloads)
  }

  for (let index = 0; index < mazeFileNames.length; index += 1) {
    const fileName = mazeFileNames[index]
    const filePath = path.join(sourceDirectory, fileName)
    const maze = await importMazeModule(filePath)
    const mazeId = path.basename(fileName, '.js')

    writeRuntimeMaze(
      maze,
      mazeId,
      authoredLevelIds.length + index + 1,
      totalPayloads
    )
    storyMazeIds.push(mazeId)
  }

  for (let index = 0; index < challengeMazeFileNames.length; index += 1) {
    const fileName = challengeMazeFileNames[index]
    const filePath = path.join(challengeSourceDirectory, fileName)
    const sourceMaze = await importMazeModule(filePath)
    const mazeId = path.basename(fileName, '.js')
    const maze = await ensureMazeHasRuntimeLightmap(
      {
        ...sourceMaze,
        id: mazeId
      },
      mazeId
    )

    if (!maze) {
      skippedChallengeMazeIds.push(mazeId)
      continue
    }

    writeRuntimeMaze(
      maze,
      mazeId,
      authoredLevelIds.length + mazeFileNames.length + index + 1,
      totalPayloads
    )
    challengeMazeIds.push(mazeId)
    challenges.push({
      description: sourceMaze.description ?? '',
      id: mazeId,
      name: sourceMaze.name ?? mazeId
    })
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'index.json'),
    JSON.stringify({
      challengeMazeIds,
      challenges,
      mazeIds,
      storyMazeIds
    }, null, 2)
  )

  console.log(
    `[sync-maze-runtime-data] wrote ${mazeIds.length} maze payloads to ${outputDirectory}`
  )
  if (skippedChallengeMazeIds.length > 0) {
    console.log(
      `[sync-maze-runtime-data] skipped ${skippedChallengeMazeIds.length} challenge payloads without existing baked artifacts; set LEVELSJAM_SYNC_CHALLENGE_LIGHTMAPS=1 to bake them`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
