const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { chromium } = require('@playwright/test')
const { PNG } = require('pngjs')

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

function directionForFaceUv(faceIndex, u, v) {
  const px = (u * 2) - 1
  const py = (v * 2) - 1

  switch (faceIndex) {
    case 0:
      return normalize([1, -py, -px])
    case 1:
      return normalize([-1, -py, px])
    case 2:
      return normalize([px, 1, py])
    case 3:
      return normalize([px, -1, -py])
    case 4:
      return normalize([px, -py, 1])
    default:
      return normalize([-px, -py, -1])
  }
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function cubeTexelSolidAngle(u, v, size) {
  const invSize = 1 / size
  const x0 = ((2 * (u + 0)) * invSize) - 1
  const y0 = ((2 * (v + 0)) * invSize) - 1
  const x1 = ((2 * (u + 1)) * invSize) - 1
  const y1 = ((2 * (v + 1)) * invSize) - 1

  const areaElement = (x, y) => Math.atan2(x * y, Math.sqrt((x * x) + (y * y) + 1))

  return (
    areaElement(x0, y0) -
    areaElement(x0, y1) -
    areaElement(x1, y0) +
    areaElement(x1, y1)
  )
}

function decodeRgbE8(r, g, b, a) {
  if (a <= 0) {
    return [0, 0, 0]
  }

  const exponent = a - 128
  const scale = 2 ** exponent

  return [
    (r / 255) * scale,
    (g / 255) * scale,
    (b / 255) * scale
  ]
}

function computeVolumetricLightmapCoefficients(rawRgbEAtlas) {
  const basisWeights = [
    ([x, y, z]) => 0.282095,
    ([x, y, z]) => 0.488603 * x,
    ([x, y, z]) => 0.488603 * y,
    ([x, y, z]) => 0.488603 * z
  ]
  const coefficients = basisWeights.map(() => [0, 0, 0])
  let totalWeight = 0

  for (let faceIndex = 0; faceIndex < rawRgbEAtlas.length; faceIndex += 1) {
    const png = PNG.sync.read(
      Buffer.from(rawRgbEAtlas[faceIndex].replace(/^data:image\/png;base64,/, ''), 'base64')
    )

    for (let row = 0; row < png.height; row += 1) {
      for (let column = 0; column < png.width; column += 1) {
        const pixelIndex = ((row * png.width) + column) * 4
        const color = decodeRgbE8(
          png.data[pixelIndex],
          png.data[pixelIndex + 1],
          png.data[pixelIndex + 2],
          png.data[pixelIndex + 3]
        )
        const direction = directionForFaceUv(
          faceIndex,
          (column + 0.5) / png.width,
          (row + 0.5) / png.height
        )
        const weight = cubeTexelSolidAngle(column, row, png.width)

        totalWeight += weight

        basisWeights.forEach((basisWeight, basisIndex) => {
          const basis = basisWeight(direction) * weight
          coefficients[basisIndex][0] += color[0] * basis
          coefficients[basisIndex][1] += color[1] * basis
          coefficients[basisIndex][2] += color[2] * basis
        })
      }
    }
  }

  if (totalWeight > 0) {
    for (const coefficient of coefficients) {
      coefficient[0] /= totalWeight
      coefficient[1] /= totalWeight
      coefficient[2] /= totalWeight
    }
  }

  return coefficients
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
      !Array.isArray(capture.rawAtlas) ||
      !Array.isArray(capture.rawRgbEAtlas) ||
      !Array.isArray(capture.processedAtlas) ||
      !Array.isArray(capture.geometryAtlas) ||
      !Array.isArray(capture.depthAtlas) ||
      !capture.processedCubeUvRgbE?.dataUrl
    ) {
      throw new Error(
        `Expected full probe bake output for maze ${maze.id} probe ${probeIndex}`
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
    writeAtlasArtifacts(probeDirectory, 'depth', capture.depthAtlas)
    writeDataUrlPng(
      path.join(probeDirectory, 'processed-cubeuv-rgbe.png'),
      capture.processedCubeUvRgbE.dataUrl
    )

    const runtimeProbeDirectoryRelative = path.posix.join(
      maze.id,
      'reflection-probes'
    )
    const runtimeProcessedFile = `probe-${String(probeIndex).padStart(3, '0')}-processed-cubeuv-rgbe.png`
    const runtimeDepthFiles = Array.from({ length: capture.depthAtlas.length }, (_, faceIndex) =>
      `probe-${String(probeIndex).padStart(3, '0')}-depth-face-${faceIndex}.png`
    )

    for (const runtimeDirectory of runtimeMazeDataDirectories) {
      const runtimeProbeDirectory = path.join(runtimeDirectory, maze.id, 'reflection-probes')

      fs.mkdirSync(runtimeProbeDirectory, { recursive: true })
      writeDataUrlPng(
        path.join(runtimeProbeDirectory, runtimeProcessedFile),
        capture.processedCubeUvRgbE.dataUrl
      )
      for (let faceIndex = 0; faceIndex < capture.depthAtlas.length; faceIndex += 1) {
        writeDataUrlPng(
          path.join(runtimeProbeDirectory, runtimeDepthFiles[faceIndex]),
          capture.depthAtlas[faceIndex]
        )
      }
    }

    runtimeManifest.probes.push({
      coefficients: computeVolumetricLightmapCoefficients(capture.rawRgbEAtlas),
      depthFaces: runtimeDepthFiles.map((fileName) =>
        path.posix.join(runtimeProbeDirectoryRelative, fileName)
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
      depthFaceCount: capture.depthAtlas.length,
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
