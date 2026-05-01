const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const rootDir = path.resolve(__dirname, '..')
const authoredMazeDirectory = path.join(rootDir, 'maze-data')
const sourceDirectory = path.join(rootDir, 'src', 'data', 'mazes')
const challengeSourceDirectory = path.join(rootDir, 'src', 'data', 'challenge-mazes')
const keeperChallengeSourceDirectory = path.join(challengeSourceDirectory, 'keepers')
const outputDirectory = path.join(rootDir, 'public', 'maze-data')
const mazeFilePattern = /^maze-\d{3}\.js$/
const challengeMazeFilePattern = /^challenge-\d{3}\.js$/
const bakeChallengeMazes = process.env.LEVELSJAM_SYNC_CHALLENGE_LIGHTMAPS === '1'
const bakeChallengeMazesCpu = process.env.LEVELSJAM_SYNC_CHALLENGE_LIGHTMAPS_CPU === '1'
const NEUTRAL_LIGHTMAP_SIZE = 4

function createNeutralLightmapDataBase64() {
  const bytes = Buffer.alloc(NEUTRAL_LIGHTMAP_SIZE * NEUTRAL_LIGHTMAP_SIZE * 3 * 2)

  for (let index = 0; index < bytes.length; index += 2) {
    bytes[index] = 0x00
    bytes[index + 1] = 0x3c
  }

  return bytes.toString('base64')
}

function createNeutralRuntimeLightmap(maze) {
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
    const probeManifestPath = path.join(mazeOutputDirectory, 'probe-assets.json')

    console.log(
      `[sync-maze-runtime-data] writing ${position}/${total} ${mazeId}.json`
    )
    fs.mkdirSync(mazeOutputDirectory, { recursive: true })
    if (maze.sourceSignature?.startsWith('neutral-') || !fs.existsSync(probeManifestPath)) {
      fs.writeFileSync(
        probeManifestPath,
        JSON.stringify({
          faceSize: 0,
          generatedAt: new Date(0).toISOString(),
          mazeId,
          probeCount: 0,
          probes: []
        }, null, 2)
      )
    }
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
    1 +
    (bakeChallengeMazes ? challengeMazeFileNames.length : 0)

  for (let index = 0; index < authoredLevelIds.length; index += 1) {
    const authoredLevelId = authoredLevelIds[index]
    const authoredMaze = await createAuthoredRuntimeMaze(authoredLevelId, { bakeLightmap: false })
    const maze = authoredMaze
      ? {
          ...authoredMaze,
          lightmap: createNeutralRuntimeLightmap(authoredMaze),
          sourceSignature: `neutral-authored:${authoredLevelId}`
        }
      : null

    if (!maze) {
      throw new Error(`Failed to create authored runtime level ${authoredLevelId}`)
    }

    fs.writeFileSync(
      path.join(authoredMazeDirectory, `${authoredLevelId}.json`),
      JSON.stringify(maze, null, 2)
    )

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

  const werewolfTutorial = await importMazeModule(
    path.join(keeperChallengeSourceDirectory, 'werewolf-tutorial.js')
  )
  writeRuntimeMaze(
    {
      ...werewolfTutorial,
      id: 'werewolf-tutorial',
      lightmap: createNeutralRuntimeLightmap(werewolfTutorial),
      sourceSignature: 'neutral-story:werewolf-tutorial'
    },
    'werewolf-tutorial',
    authoredLevelIds.length + mazeFileNames.length + 1,
    totalPayloads
  )
  storyMazeIds.push('werewolf-tutorial')

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
