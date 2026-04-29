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

function measureAtlasDifference(leftAtlas, rightAtlas) {
  let maxDifference = 0
  let totalDifference = 0
  let sampleCount = 0

  for (let faceIndex = 0; faceIndex < Math.min(leftAtlas.length, rightAtlas.length); faceIndex += 1) {
    const left = decodePngDataUrl(leftAtlas[faceIndex])
    const right = decodePngDataUrl(rightAtlas[faceIndex])
    const width = Math.min(left.width, right.width)
    const height = Math.min(left.height, right.height)

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = ((y * left.width) + x) * 4
        const rightOffset = ((y * right.width) + x) * 4

        for (let channel = 0; channel < 3; channel += 1) {
          const difference = Math.abs(left.data[offset + channel] - right.data[rightOffset + channel])

          maxDifference = Math.max(maxDifference, difference)
          totalDifference += difference
          sampleCount += 1
        }
      }
    }
  }

  return {
    averageDifference: sampleCount > 0 ? totalDifference / sampleCount : 0,
    maxDifference
  }
}

function measureRgbELuminance(atlas) {
  let maxLuminance = 0
  let totalLuminance = 0
  let totalPixels = 0

  for (const faceDataUrl of atlas) {
    const png = decodePngDataUrl(faceDataUrl)

    for (let offset = 0; offset < png.data.length; offset += 4) {
      const e = png.data[offset + 3]
      if (e <= 0) {
        totalPixels += 1
        continue
      }

      const scale = 2 ** (e - 128)
      const r = (png.data[offset] / 255) * scale
      const g = (png.data[offset + 1] / 255) * scale
      const b = (png.data[offset + 2] / 255) * scale
      const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)

      maxLuminance = Math.max(maxLuminance, luminance)
      totalLuminance += luminance
      totalPixels += 1
    }
  }

  return {
    averageLuminance: totalPixels > 0 ? totalLuminance / totalPixels : 0,
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
    () => window.__levelsjamDebug?.getReflectionCaptureSceneState?.({
      requireTorchBillboards: true
    })?.ready === true,
    undefined,
    { timeout: 180_000 }
  )

  const capture = await page.evaluate(async () => {
    const baked = await window.__levelsjamDebug.bakeReflectionProbeAssets?.(4, 128)

    return {
      captureSceneState: window.__levelsjamDebug.getReflectionCaptureSceneState?.({
        requireTorchBillboards: true
      }) ?? null,
      geometryAtlas: baked?.geometryAtlas ?? null,
      processedAtlas: baked?.processedAtlas ?? null,
      probeState: window.__levelsjamDebug.getReflectionProbeState?.() ?? null,
      rawAtlas: baked?.rawAtlas ?? null,
      rawRgbEAtlas: baked?.rawRgbEAtlas ?? null,
      skyboxAtlas: await window.__levelsjamDebug.captureReflectionProbeSkyboxOnlyAtlas?.(4, 128)
    }
  })

  if (
    !Array.isArray(capture.rawAtlas) ||
    !Array.isArray(capture.rawRgbEAtlas) ||
    !Array.isArray(capture.processedAtlas) ||
    !Array.isArray(capture.geometryAtlas) ||
    !Array.isArray(capture.skyboxAtlas)
  ) {
    throw new Error(`Expected probe atlases for ${mazeId}`)
  }

  writeAtlasArtifacts(mazeId, 'raw', capture.rawAtlas)
  writeAtlasArtifacts(mazeId, 'raw-rgbe', capture.rawRgbEAtlas)
  writeAtlasArtifacts(mazeId, 'processed', capture.processedAtlas)
  writeAtlasArtifacts(mazeId, 'geometry', capture.geometryAtlas)
  writeAtlasArtifacts(mazeId, 'skybox', capture.skyboxAtlas)
  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, mazeId, 'summary.json'),
    JSON.stringify({
      captureSceneState: capture.captureSceneState,
      geometryVsSkybox: measureAtlasDifference(capture.geometryAtlas, capture.skyboxAtlas),
      metrics: measureAtlasTorchSignature(capture.rawAtlas),
      probeState: capture.probeState,
      rawVsSkybox: measureAtlasDifference(capture.rawAtlas, capture.skyboxAtlas),
      rgbELuminance: measureRgbELuminance(capture.rawRgbEAtlas)
    }, null, 2)
  )

  return {
    geometryAtlas: capture.geometryAtlas,
    metrics: measureAtlasTorchSignature(capture.rawAtlas),
    processedAtlas: capture.processedAtlas,
    rawAtlas: capture.rawAtlas,
    rawRgbEAtlas: capture.rawRgbEAtlas,
    rawVsSkybox: measureAtlasDifference(capture.rawAtlas, capture.skyboxAtlas),
    rgbELuminance: measureRgbELuminance(capture.rawRgbEAtlas),
    skyboxAtlas: capture.skyboxAtlas
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
  expect(sealed.rawVsSkybox.averageDifference).toBeGreaterThan(5)
  expect(sealed.rawVsSkybox.maxDifference).toBeGreaterThan(50)
  expect(openNorth.rgbELuminance.maxLuminance).toBeGreaterThan(
    noLights.rgbELuminance.maxLuminance * 1.5
  )
  expect(openNorth.rgbELuminance.averageLuminance).toBeGreaterThan(
    noLights.rgbELuminance.averageLuminance
  )
})
