const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { chromium } = require('@playwright/test')
const { PNG } = require('pngjs')
const { BakeTimingRecorder } = require('./bake-timing.cjs')

const rootDir = path.resolve(__dirname, '..')
const servePort = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_PORT ?? '42735')
const faceSize = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_FACE_SIZE ?? '32')
const sceneReadyTimeoutMs = Number(process.env.LEVELSJAM_REFLECTION_SCENE_READY_TIMEOUT_MS ?? '120000')
const probeReadyTimeoutMs = Number(process.env.LEVELSJAM_REFLECTION_PROBE_READY_TIMEOUT_MS ?? '120000')
const probeCaptureTimeoutMs = Number(process.env.LEVELSJAM_REFLECTION_PROBE_CAPTURE_TIMEOUT_MS ?? '45000')
const useTwoPassReflection = process.env.LEVELSJAM_REFLECTION_TWO_PASS !== '0'
const bootstrapExistingReflection = process.env.LEVELSJAM_REFLECTION_BOOTSTRAP_EXISTING !== '0'
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

function createRecorder() {
  if (process.env.LEVELSJAM_BAKE_TIMING_FILE) {
    return BakeTimingRecorder.open(process.env.LEVELSJAM_BAKE_TIMING_FILE)
  }

  return new BakeTimingRecorder({ kind: 'export:maze-probes' })
}

function getRuntimeProbeManifestPath(runtimeDirectory, mazeId) {
  return path.join(runtimeDirectory, mazeId, 'probe-assets.json')
}

function hasCompleteRuntimeProbeManifest(maze, probeCount) {
  const existingRuntimeDirectories = runtimeMazeDataDirectories.filter((runtimeDirectory) =>
    fs.existsSync(path.join(runtimeDirectory, maze.id))
  )

  return existingRuntimeDirectories.length > 0 && existingRuntimeDirectories.every((runtimeDirectory) => {
    const manifestPath = getRuntimeProbeManifestPath(runtimeDirectory, maze.id)

    if (!fs.existsSync(manifestPath)) {
      return false
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

      if (
        manifest.mazeId !== maze.id ||
        manifest.faceSize !== faceSize ||
        manifest.probeCount !== probeCount ||
        !Array.isArray(manifest.probes) ||
        manifest.probes.length !== probeCount
      ) {
        return false
      }

      return manifest.probes.every((probe) => (
        Number.isInteger(probe.index) &&
        typeof probe.processedCubeUvRgbE === 'string' &&
        fs.existsSync(path.join(runtimeDirectory, probe.processedCubeUvRgbE))
      ))
    } catch {
      return false
    }
  })
}

function withTimeout(promise, timeoutMs, label) {
  let timeout = null

  return Promise.race([
    promise.finally(() => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

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

function readDataUrlPng(dataUrl) {
  return PNG.sync.read(
    Buffer.from(
      dataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    )
  )
}

function computeVolumetricCoefficientsFromCapture(rawRgbEAtlas, computeFromPixels) {
  const faces = rawRgbEAtlas.map((dataUrl) => readDataUrlPng(dataUrl))

  return computeFromPixels(faces, (face, x, y) => {
    const offset = ((y * face.width) + x) * 4
    const r = face.data[offset]
    const g = face.data[offset + 1]
    const b = face.data[offset + 2]
    const e = face.data[offset + 3]

    if (e <= 0) {
      return [0, 0, 0]
    }

    const scale = 2 ** (e - 128)

    return [
      (r / 255) * scale,
      (g / 255) * scale,
      (b / 255) * scale
    ]
  })
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

async function waitForCaptureSceneReady(page, mazeId) {
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getReflectionProbeState?.()?.captureSceneState?.ready === true ||
      window.__levelsjamDebug?.getReflectionCaptureSceneState?.()?.ready === true,
    undefined,
    { timeout: sceneReadyTimeoutMs }
  )

  const state = await page.evaluate(
    () => window.__levelsjamDebug?.getReflectionProbeState?.()?.captureSceneState ??
      window.__levelsjamDebug?.getReflectionCaptureSceneState?.() ??
      null
  )

  if (!state?.ready) {
    throw new Error(`Reflection capture scene for ${mazeId} did not report ready`)
  }

  return state
}

async function waitForRuntimeProbeReady(page, mazeId) {
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready === true,
    undefined,
    { timeout: probeReadyTimeoutMs }
  )

  const state = await page.evaluate(
    () => window.__levelsjamDebug?.getReflectionProbeState?.() ?? null
  )

  if (!state?.ready) {
    throw new Error(`Runtime reflection probes for ${mazeId} did not report ready`)
  }

  return state
}

async function captureMazeReflectionArtifacts(
  page,
  maze,
  recorder,
  artifactRoot,
  getMazeSceneLayout,
  sconceRadius,
  computeMazeVolumetricLightmapCoefficients,
  computeVolumetricLightmapCoefficientsFromPixels,
  levelIndex,
  levelTotal
) {
  const outputDirectory = path.join(
    artifactRoot,
    maze.id,
    'reflection-probes'
  )
  const mazeLayout = getMazeSceneLayout(maze, sconceRadius)

  fs.rmSync(outputDirectory, { force: true, recursive: true })
  fs.mkdirSync(outputDirectory, { recursive: true })

  const probeCount = maze.width * maze.height
  const canBootstrapExisting = (
    useTwoPassReflection &&
    bootstrapExistingReflection &&
    hasCompleteRuntimeProbeManifest(maze, probeCount)
  )
  const shouldRunFirstPass = useTwoPassReflection && !canBootstrapExisting
  const levelStepId = recorder.beginStep('reflection-level', {
    levelId: maze.id,
    quality: {
      bootstrapExistingReflection,
      faceSize,
      probeCaptureTimeoutMs,
      probeReadyTimeoutMs,
      sceneReadyTimeoutMs,
      useTwoPassReflection
    },
    workCounts: {
      expectedCaptureCount: probeCount * (shouldRunFirstPass ? 2 : 1),
      levelIndex,
      levelTotal,
      probeCount
    }
  })

  await page.goto(`http://127.0.0.1:${servePort}/?maze=${maze.id}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded'
  })
  console.log(
    `[export:maze-probes] level ${levelIndex}/${levelTotal} ${maze.id} waiting for capture scene`
  )
  const initialProbeState = await waitForCaptureSceneReady(page, maze.id)

  if (probeCount <= 0) {
    throw new Error(`Expected reflection probes for maze ${maze.id}`)
  }

  if (canBootstrapExisting) {
    console.log(
      `[export:maze-probes] ${maze.id} reusing complete existing probes as two-pass bootstrap`
    )
    const bootstrapStepId = recorder.beginStep('reflection-existing-bootstrap', {
      levelId: maze.id,
      workCounts: { probeCount }
    })
    const runtimeProbeState = await waitForRuntimeProbeReady(page, maze.id)

    recorder.endStep(bootstrapStepId, 'completed', {
      workCounts: {
        loadedProbeCount: runtimeProbeState.loadedProbeCount ?? 0,
        loadedVolumetricProbeCount: runtimeProbeState.loadedVolumetricProbeCount ?? 0,
        probeCount
      }
    })
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

  const writeRuntimeManifest = (manifest) => {
    for (const runtimeDirectory of runtimeMazeDataDirectories) {
      const manifestPath = path.join(runtimeDirectory, maze.id, 'probe-assets.json')

      fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
      fs.writeFileSync(
        manifestPath,
        JSON.stringify(manifest, null, 2)
      )
    }
  }

  const captureProbe = async (probeIndex) => {
    const capture = await withTimeout(
      page.evaluate(
        async ({ probeIndex, size }) =>
          await window.__levelsjamDebug?.bakeReflectionProbeAssets?.(
            probeIndex,
            size
          ),
        { probeIndex, size: faceSize }
      ),
      probeCaptureTimeoutMs,
      `${maze.id} probe ${probeIndex}`
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

    return capture
  }

  const appendRuntimeProbe = (manifest, probeIndex, capture) => {
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

    manifest.probes.push({
      coefficients: Array.isArray(capture.rawRgbEAtlas)
        ? computeVolumetricCoefficientsFromCapture(
            capture.rawRgbEAtlas,
            computeVolumetricLightmapCoefficientsFromPixels
          )
        : computeMazeVolumetricLightmapCoefficients(
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
  }

  if (shouldRunFirstPass) {
    const firstPassStepId = recorder.beginStep('reflection-first-pass', {
      levelId: maze.id,
      workCounts: {
        probeCount
      }
    })
    const firstPassManifest = {
      ...runtimeManifest,
      generatedAt: new Date().toISOString(),
      probes: []
    }

    for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
      console.log(
        `[export:maze-probes] ${maze.id} first-pass probe ${probeIndex + 1}/${probeCount}`
      )
      const probeStepId = recorder.beginStep('reflection-first-pass-probe', {
        levelId: maze.id,
        workCounts: {
          faceSize,
          probeCount,
          probeIndex
        }
      })
      try {
        const capture = await captureProbe(probeIndex)

        appendRuntimeProbe(firstPassManifest, probeIndex, capture)
        recorder.endStep(probeStepId, 'completed', {
          workCounts: {
            geometryFaceCount: capture.geometryAtlas.length,
            processedFaceCount: capture.processedAtlas.length,
            rawFaceCount: capture.rawAtlas.length,
            rawRgbEFaceCount: capture.rawRgbEAtlas.length
          }
        })
      } catch (error) {
        recorder.endStep(probeStepId, 'failed', {
          error: error.message
        })
        throw error
      }
    }

    writeRuntimeManifest(firstPassManifest)
    await page.goto(`http://127.0.0.1:${servePort}/?maze=${maze.id}`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded'
    })
    console.log(
      `[export:maze-probes] ${maze.id} waiting for first-pass runtime probes`
    )
    await waitForCaptureSceneReady(page, maze.id)
    await waitForRuntimeProbeReady(page, maze.id)
    recorder.endStep(firstPassStepId, 'completed', {
      workCounts: {
        probeCount,
        probesCaptured: probeCount
      }
    })
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
    const probeStepId = recorder.beginStep('reflection-final-probe', {
      levelId: maze.id,
      workCounts: {
        faceSize,
        probeCount,
        probeIndex
      }
    })
    let capture = null

    try {
      capture = await captureProbe(probeIndex)
    } catch (error) {
      recorder.endStep(probeStepId, 'failed', {
        error: error.message
      })
      throw error
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

    appendRuntimeProbe(runtimeManifest, probeIndex, capture)
    summary.probes.push({
      geometryFaceCount: capture.geometryAtlas.length,
      index: probeIndex,
      processedFaceCount: capture.processedAtlas.length,
      rawFaceCount: capture.rawAtlas.length
    })
    recorder.endStep(probeStepId, 'completed', {
      workCounts: {
        geometryFaceCount: capture.geometryAtlas.length,
        processedFaceCount: capture.processedAtlas.length,
        rawFaceCount: capture.rawAtlas.length,
        rawRgbEFaceCount: capture.rawRgbEAtlas.length
      }
    })
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'summary.json'),
    JSON.stringify(summary, null, 2)
  )

  writeRuntimeManifest(runtimeManifest)
  recorder.endStep(levelStepId, 'completed', {
    workCounts: {
      bootstrapExisting: canBootstrapExisting ? 1 : 0,
      faceSize,
      finalProbeCount: summary.probes.length,
      firstPassProbeCount: shouldRunFirstPass ? probeCount : 0,
      probeCount,
      totalCubemapFaces: summary.probes.length * 6
    }
  })
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
    computeVolumetricLightmapCoefficientsFromPixels
  } = await import('../src/lib/probeSphericalHarmonics.js')
  const {
    SCONCE_RADIUS
  } = await import('../src/lib/sceneConstants.js')
  const {
    DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY
  } = await import('../src/lib/mazePersistence.js')
  const recorder = createRecorder()
  const exportStepId = recorder.beginStep('reflection-export', {
    quality: {
      bootstrapExistingReflection,
      faceSize,
      probeCaptureTimeoutMs,
      probeReadyTimeoutMs,
      sceneReadyTimeoutMs,
      useTwoPassReflection
    }
  })
  let serverProcess = null
  let browser = null
  let cleanupStarted = false

  const cleanup = async () => {
    if (cleanupStarted) {
      return
    }

    cleanupStarted = true
    if (browser) {
      await browser.close().catch(() => {})
      browser = null
    }
    if (serverProcess) {
      if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
        serverProcess.kill()
        await new Promise((resolve) => serverProcess.once('exit', resolve))
      }
      serverProcess = null
    }
  }

  const handleSignal = (signal) => {
    console.error(`[export:maze-probes] received ${signal}; cleaning up browser and server`)
    cleanup()
      .finally(() => {
        recorder.endStep(exportStepId, 'failed', { signal })
        if (!process.env.LEVELSJAM_BAKE_TIMING_FILE) {
          recorder.finish('failed', { signal })
        }
        process.exit(signal === 'SIGINT' ? 130 : 143)
      })
  }

  process.once('SIGINT', () => handleSignal('SIGINT'))
  process.once('SIGTERM', () => handleSignal('SIGTERM'))

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
    page.setDefaultTimeout(Math.max(sceneReadyTimeoutMs, probeReadyTimeoutMs))
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

    recorder.mergeWorkCounts({
      reflectionLevelCount: mazesToCapture.length,
      reflectionProbeCount: mazesToCapture.reduce(
        (sum, maze) => sum + (maze.width * maze.height),
        0
      )
    })

    for (let mazeIndex = 0; mazeIndex < mazesToCapture.length; mazeIndex += 1) {
      const maze = mazesToCapture[mazeIndex]

      await captureMazeReflectionArtifacts(
        page,
        maze,
        recorder,
        DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY,
        getMazeSceneLayout,
        SCONCE_RADIUS,
        computeMazeVolumetricLightmapCoefficients,
        computeVolumetricLightmapCoefficientsFromPixels,
        mazeIndex + 1,
        mazesToCapture.length
      )
    }

    console.log(
      `Wrote reflection-probe artifacts to ${DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY}`
    )
    recorder.endStep(exportStepId, 'completed')
    if (!process.env.LEVELSJAM_BAKE_TIMING_FILE) {
      recorder.finish('completed')
      console.log(`Wrote bake timing to ${recorder.filePath}`)
    }
  } catch (error) {
    recorder.endStep(exportStepId, 'failed', {
      error: error.message
    })
    if (!process.env.LEVELSJAM_BAKE_TIMING_FILE) {
      recorder.finish('failed', {
        error: error.message
      })
      console.log(`Wrote bake timing to ${recorder.filePath}`)
    }
    throw error
  } finally {
    await cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  if (process.env.LEVELSJAM_BAKE_TIMING_FILE) {
    try {
      const recorder = BakeTimingRecorder.open(process.env.LEVELSJAM_BAKE_TIMING_FILE)

      recorder.finish('failed', { error: error.message })
    } catch {
      // Preserve the original failure.
    }
  }
  process.exitCode = 1
})
