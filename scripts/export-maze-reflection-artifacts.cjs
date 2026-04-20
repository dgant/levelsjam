const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { chromium } = require('@playwright/test')

const rootDir = path.resolve(__dirname, '..')
const servePort = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_PORT ?? '42735')
const faceSize = Number(process.env.LEVELSJAM_REFLECTION_ARTIFACT_FACE_SIZE ?? '128')
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

async function captureMazeReflectionArtifacts(page, maze, artifactRoot) {
  const outputDirectory = path.join(
    artifactRoot,
    maze.id,
    'reflection-probes'
  )

  fs.rmSync(outputDirectory, { force: true, recursive: true })
  fs.mkdirSync(outputDirectory, { recursive: true })

  await page.goto(`http://127.0.0.1:${servePort}/?maze=${maze.id}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded'
  })
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready === true,
    undefined,
    { timeout: 180_000 }
  )

  const initialProbeState = await page.evaluate(
    () => window.__levelsjamDebug?.getReflectionProbeState?.() ?? null
  )
  const probeCount = Number(initialProbeState?.probeCount ?? 0)

  if (probeCount <= 0) {
    throw new Error(`Expected reflection probes for maze ${maze.id}`)
  }

  const compactProbeState = initialProbeState
    ? {
        activeProbeId: initialProbeState.activeProbeId ?? null,
        captureSceneState: initialProbeState.captureSceneState ?? null,
        probeCaptureCounts: initialProbeState.probeCaptureCounts ?? null,
        probeCount: initialProbeState.probeCount ?? 0,
        probeRawReadbackErrors: Array.isArray(initialProbeState.probeRawReadbackErrors)
          ? [...new Set(initialProbeState.probeRawReadbackErrors.filter(Boolean))]
          : [],
        probeRawTextureSummaries: initialProbeState.probeRawTextureSummaries ?? null,
        ready: initialProbeState.ready ?? false
      }
    : null

  const summary = {
    faceSize,
    generatedAt: new Date().toISOString(),
    mazeId: maze.id,
    probeCount,
    probeState: compactProbeState,
    probes: []
  }

  for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
    const capture = await page.evaluate(
      async ({ probeIndex, size }) => ({
        geometryAtlas:
          await window.__levelsjamDebug?.captureReflectionProbeGeometryAtlas?.(
            probeIndex,
            size
          ),
        processedAtlas:
          await window.__levelsjamDebug?.captureReflectionProbeProcessedAtlas?.(
            probeIndex,
            size
          ),
        rawAtlas:
          await window.__levelsjamDebug?.captureReflectionProbeAtlas?.(
            probeIndex,
            size
          )
      }),
      { probeIndex, size: faceSize }
    )

    if (
      !Array.isArray(capture.rawAtlas) ||
      !Array.isArray(capture.processedAtlas) ||
      !Array.isArray(capture.geometryAtlas)
    ) {
      throw new Error(
        `Expected raw, processed, and geometry probe atlases for maze ${maze.id} probe ${probeIndex}`
      )
    }

    const probeDirectory = path.join(
      outputDirectory,
      `probe-${String(probeIndex).padStart(3, '0')}`
    )

    writeAtlasArtifacts(probeDirectory, 'raw', capture.rawAtlas)
    writeAtlasArtifacts(probeDirectory, 'processed', capture.processedAtlas)
    writeAtlasArtifacts(probeDirectory, 'geometry', capture.geometryAtlas)
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
}

async function main() {
  const {
    MAZES
  } = await import('../src/data/mazes/index.js')
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
    const mazesToCapture = requestedMazeIds.length > 0
      ? MAZES.filter((maze) => requestedMazeIds.includes(maze.id))
      : MAZES

    if (mazesToCapture.length === 0) {
      throw new Error(`No mazes matched requested ids: ${requestedMazeIds.join(', ')}`)
    }

    for (const maze of mazesToCapture) {
      await captureMazeReflectionArtifacts(
        page,
        maze,
        DEFAULT_LIGHTMAP_ARTIFACT_DIRECTORY
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
