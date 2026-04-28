const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { chromium } = require('@playwright/test')

const rootDir = path.resolve(__dirname, '..')
const servePort = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_PORT ?? '42735')
const faceSize = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_FACE_SIZE ?? '32')
const runtimeMazeDataDirectories = [
  path.join(rootDir, 'public', 'maze-data'),
  path.join(rootDir, 'maze-data')
]
const requestedMazeIds = (
  process.env.LEVELSJAM_MAZE_IDS ??
  process.argv.slice(2).join(',')
)
  .split(',')
  .map((mazeId) => mazeId.trim())
  .filter(Boolean)

function writeAtlasArtifacts(outputDirectory, label, atlas) {
  fs.mkdirSync(outputDirectory, { recursive: true })

  for (let faceIndex = 0; faceIndex < atlas.length; faceIndex += 1) {
    fs.writeFileSync(
      path.join(outputDirectory, `${label}-face-${faceIndex}.png`),
      Buffer.from(
        atlas[faceIndex].replace(/^data:image\/png;base64,/, ''),
        'base64'
      )
    )
  }
}

function writeDataUrlPng(filePath, dataUrl) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(
    filePath,
    Buffer.from(
      dataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    )
  )
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs

    const check = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port })

      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for port ${port}`))
          return
        }
        setTimeout(check, 250)
      })
      socket.setTimeout(250, () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for port ${port}`))
          return
        }
        setTimeout(check, 250)
      })
    }

    check()
  })
}

async function captureMazeReflectionArtifacts(
  page,
  maze,
  artifactRoot,
  getMazeSceneLayout,
  sconceRadius,
  computeMazeVolumetricLightmapCoefficients
) {
  const outputDirectory = path.join(
    artifactRoot,
    maze.id,
    'reflection-probes'
  )
  const mazeLayout = getMazeSceneLayout(maze, sconceRadius)

  fs.rmSync(outputDirectory, { force: true, recursive: true })
  fs.mkdirSync(outputDirectory, { recursive: true })

  await page.goto(`http://127.0.0.1:${servePort}/?maze=${maze.id}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded'
  })
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getReflectionCaptureSceneState?.()?.ready === true,
    undefined,
    { timeout: 600_000 }
  )
  const initialProbeState = await page.evaluate(
    () => window.__levelsjamDebug?.getReflectionCaptureSceneState?.() ?? null
  )
  const probeCount = maze.width * maze.height

  if (probeCount <= 0) {
    throw new Error(`Expected reflection probes for maze ${maze.id}`)
  }

  const compactProbeState = initialProbeState
    ? {
        ...initialProbeState,
        probeCount,
        ready: initialProbeState?.ready ?? false
      }
    : null

  const runtimeManifest = {
    faceSize,
    generatedAt: new Date().toISOString(),
    mazeId: maze.id,
    probeCount,
    probes: []
  }

  const summary = {
    faceSize,
    generatedAt: new Date().toISOString(),
    mazeId: maze.id,
    probeCount,
    probeState: compactProbeState,
    probes: []
  }

  for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
    console.log(
      `[export:maze-probes] ${maze.id} probe ${probeIndex + 1}/${probeCount}`
    )
    const capture = await page.evaluate(
      async ({ probeIndex, size }) =>
        await window.__levelsjamDebug?.bakeReflectionProbeAssets?.(
          probeIndex,
          size
        ),
      { probeIndex, size: faceSize }
    )

    if (
      !capture ||
      !Array.isArray(capture.rawAtlas) ||
      !Array.isArray(capture.rawRgbEAtlas) ||
      !Array.isArray(capture.processedAtlas) ||
      !Array.isArray(capture.geometryAtlas) ||
      !capture.processedCubeUvRgbE?.dataUrl
    ) {
      const probeState = await page.evaluate(
        () => ({
          captureSceneState: window.__levelsjamDebug?.getReflectionCaptureSceneState?.() ?? null,
          reflectionProbeState: window.__levelsjamDebug?.getReflectionProbeState?.() ?? null
        })
      )
      throw new Error(
        `Expected full probe bake output for maze ${maze.id} probe ${probeIndex}; got ${JSON.stringify({
          capture,
          probeState
        })}`
      )
    }

    const probeDirectory = path.join(
      outputDirectory,
      `probe-${String(probeIndex).padStart(3, '0')}`
    )

    writeAtlasArtifacts(probeDirectory, 'raw', capture.rawAtlas)
    writeAtlasArtifacts(probeDirectory, 'raw-rgbe', capture.rawRgbEAtlas)
    writeAtlasArtifacts(probeDirectory, 'processed', capture.processedAtlas)
    writeAtlasArtifacts(probeDirectory, 'geometry', capture.geometryAtlas)
    writeDataUrlPng(
      path.join(probeDirectory, 'processed-cubeuv-rgbe.png'),
      capture.processedCubeUvRgbE.dataUrl
    )

    const runtimeProbeDirectoryRelative = path.posix.join(
      maze.id,
      'reflection-probes'
    )
    const runtimeProcessedFile = `probe-${String(probeIndex).padStart(3, '0')}-processed-cubeuv-rgbe.png`

    for (const runtimeDirectory of runtimeMazeDataDirectories) {
      const runtimeProbeDirectory = path.join(runtimeDirectory, maze.id, 'reflection-probes')

      fs.mkdirSync(runtimeProbeDirectory, { recursive: true })
      writeDataUrlPng(
        path.join(runtimeProbeDirectory, runtimeProcessedFile),
        capture.processedCubeUvRgbE.dataUrl
      )
    }

    runtimeManifest.probes.push({
      coefficients: computeMazeVolumetricLightmapCoefficients(
        maze,
        mazeLayout.reflectionProbes[probeIndex].position,
        sconceRadius
      ),
      index: probeIndex,
      processedCubeUvRgbE: path.posix.join(
        runtimeProbeDirectoryRelative,
        runtimeProcessedFile
      ),
      textureHeight: capture.processedCubeUvRgbE.height,
      textureWidth: capture.processedCubeUvRgbE.width
    })
    summary.probes.push({
      geometryFaceCount: capture.geometryAtlas.length,
      index: probeIndex,
      processedFaceCount: capture.processedAtlas.length,
      rawFaceCount: capture.rawAtlas.length
    })
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'summary.json'),
    JSON.stringify(summary, null, 2)
  )

  for (const runtimeDirectory of runtimeMazeDataDirectories) {
    const manifestPath = path.join(runtimeDirectory, maze.id, 'probe-assets.json')

    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(runtimeManifest, null, 2)
    )
  }
}

async function main() {
  const {
    MAZES
  } = await import('../src/data/mazes/index.js')
  const {
    createAuthoredRuntimeMaze,
    getAuthoredRuntimeLevelIds
  } = await import('../src/lib/levels.js')
  const {
    computeMazeVolumetricLightmapCoefficients,
    getMazeSceneLayout
  } = await import('../src/lib/maze.js')
  const {
    SCONCE_RADIUS
  } = await import('../src/lib/sceneConstants.js')
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY
  } = await import('../src/lib/mazePersistence.js')
  let serverProcess = null
  let browser = null

  try {
    serverProcess = spawn(
      process.execPath,
      [path.join('scripts', 'serve-root.cjs'), String(servePort)],
      {
        cwd: rootDir,
        stdio: 'inherit'
      }
    )
    await waitForPort(servePort, 30_000)

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 800, height: 450 }
    })
    const authoredMazes = (
      await Promise.all(
        getAuthoredRuntimeLevelIds().map((id) => createAuthoredRuntimeMaze(id))
      )
    ).filter(Boolean)
    const allMazes = [...authoredMazes, ...MAZES]
    const mazesToCapture = requestedMazeIds.length > 0
      ? allMazes.filter((maze) => requestedMazeIds.includes(maze.id))
      : allMazes

    if (mazesToCapture.length === 0) {
      throw new Error(`No mazes matched requested ids: ${requestedMazeIds.join(', ')}`)
    }

    for (const maze of mazesToCapture) {
      await captureMazeReflectionArtifacts(
        page,
        maze,
        DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
        getMazeSceneLayout,
        SCONCE_RADIUS,
        computeMazeVolumetricLightmapCoefficients
      )
    }

    console.log(
      `Wrote reflection-probe artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`
    )
  } finally {
    if (browser) {
      await browser.close()
    }
    if (serverProcess) {
      if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
        serverProcess.kill()
        await new Promise((resolve) => serverProcess.once('exit', resolve))
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
