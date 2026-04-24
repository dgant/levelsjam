const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')
const { expect, test } = require('@playwright/test')

test.setTimeout(240_000)

const ARTIFACT_ROOT = path.resolve(
  __dirname,
  '..',
  'logs',
  'probe-occlusion-artifacts'
)

function decodePngDataUrl(dataUrl) {
  return PNG.sync.read(
    Buffer.from(
      dataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64'
    )
  )
}

function measureAtlasTorchSignature(atlas) {
  let brightWarmPixels = 0
  let maxLuminance = 0
  let totalPixels = 0

  for (const faceDataUrl of atlas) {
    const png = decodePngDataUrl(faceDataUrl)

    for (let offset = 0; offset < png.data.length; offset += 4) {
      const r = png.data[offset]
      const g = png.data[offset + 1]
      const b = png.data[offset + 2]
      const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)

      maxLuminance = Math.max(maxLuminance, luminance)
      if (luminance > 220 && r >= g * 0.95 && g > b * 1.1) {
        brightWarmPixels += 1
      }
      totalPixels += 1
    }
  }

  return {
    brightWarmFraction: brightWarmPixels / totalPixels,
    maxLuminance
  }
}

function writeAtlasArtifacts(mazeId, label, atlas) {
  const outputDirectory = path.join(ARTIFACT_ROOT, mazeId)

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

async function captureProbeArtifacts(page, mazeId) {
  await page.goto(`/?maze=${mazeId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  })
  await page.waitForFunction(
    () => window.__levelsjamDebug?.getReflectionProbeState?.()?.ready === true,
    undefined,
    { timeout: 180_000 }
  )

  const capture = await page.evaluate(async () => ({
    geometryAtlas: await window.__levelsjamDebug.captureReflectionProbeGeometryAtlas?.(4, 128),
    processedAtlas: await window.__levelsjamDebug.captureReflectionProbeProcessedAtlas?.(4, 128),
    probeState: window.__levelsjamDebug.getReflectionProbeState?.() ?? null,
    rawAtlas: await window.__levelsjamDebug.captureReflectionProbeAtlas?.(4, 128)
  }))

  if (
    !Array.isArray(capture.rawAtlas) ||
    !Array.isArray(capture.processedAtlas) ||
    !Array.isArray(capture.geometryAtlas)
  ) {
    throw new Error(`Expected probe atlases for ${mazeId}`)
  }

  writeAtlasArtifacts(mazeId, 'raw', capture.rawAtlas)
  writeAtlasArtifacts(mazeId, 'processed', capture.processedAtlas)
  writeAtlasArtifacts(mazeId, 'geometry', capture.geometryAtlas)
  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, mazeId, 'summary.json'),
    JSON.stringify({
      metrics: measureAtlasTorchSignature(capture.rawAtlas),
      probeState: capture.probeState
    }, null, 2)
  )

  return {
    geometryAtlas: capture.geometryAtlas,
    metrics: measureAtlasTorchSignature(capture.rawAtlas),
    processedAtlas: capture.processedAtlas,
    rawAtlas: capture.rawAtlas
  }
}

test('sealed 3x3 probe artifacts exclude torch signatures while open north exposes them', async ({ page }) => {
  fs.rmSync(ARTIFACT_ROOT, { force: true, recursive: true })

  const noLights = await captureProbeArtifacts(page, 'debug-probe-occlusion-3x3-no-lights')
  const sealed = await captureProbeArtifacts(page, 'debug-probe-occlusion-3x3-sealed')
  const openNorth = await captureProbeArtifacts(page, 'debug-probe-occlusion-3x3-open-north')

  expect(noLights.geometryAtlas).toHaveLength(6)
  expect(sealed.geometryAtlas).toHaveLength(6)
  expect(openNorth.geometryAtlas).toHaveLength(6)

  expect(noLights.metrics.brightWarmFraction).toBe(0)
  expect(sealed.metrics.brightWarmFraction).toBeLessThanOrEqual(0.002)
  expect(openNorth.metrics.maxLuminance).toBeGreaterThan(10)
  expect(openNorth.metrics.maxLuminance).toBeGreaterThan(noLights.metrics.maxLuminance * 1.5)
  expect(openNorth.metrics.brightWarmFraction).toBeGreaterThan(
    sealed.metrics.brightWarmFraction + 0.00001
  )
})
