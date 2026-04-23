import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeVolumetricLightmapCoefficientsFromPixels,
  decodeRgbE8,
  reconstructProbeRadiance
} from '../src/lib/probeSphericalHarmonics.js'

function encodeRgbE8(color) {
  const maxComponent = Math.max(color[0], color[1], color[2])

  if (maxComponent <= 0) {
    return [0, 0, 0, 0]
  }

  const exponent = Math.ceil(Math.log2(maxComponent))
  const scale = 2 ** exponent

  return [
    Math.round(Math.min(1, color[0] / scale) * 255),
    Math.round(Math.min(1, color[1] / scale) * 255),
    Math.round(Math.min(1, color[2] / scale) * 255),
    exponent + 128
  ]
}

function createFace(size, color) {
  const data = new Uint8Array(size * size * 4)
  const encodedColor = encodeRgbE8(color)

  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = encodedColor[0]
    data[offset + 1] = encodedColor[1]
    data[offset + 2] = encodedColor[2]
    data[offset + 3] = encodedColor[3]
  }

  return {
    data,
    height: size,
    width: size
  }
}

function createDirectionalFaces(faceIndex, color) {
  const faces = Array.from({ length: 6 }, () => createFace(16, [0, 0, 0]))

  faces[faceIndex] = createFace(16, color)

  return faces
}

function luminance(color) {
  return (0.2126 * color[0]) + (0.7152 * color[1]) + (0.0722 * color[2])
}

function computeCoefficients(faces) {
  return computeVolumetricLightmapCoefficientsFromPixels(
    faces,
    (face, column, row) => {
      const pixelIndex = ((row * face.width) + column) * 4

      return decodeRgbE8(
        face.data[pixelIndex],
        face.data[pixelIndex + 1],
        face.data[pixelIndex + 2],
        face.data[pixelIndex + 3]
      )
    }
  )
}

test('volumetric lightmap SH keeps probe face directions coherent', () => {
  const positiveX = computeCoefficients(createDirectionalFaces(0, [4, 1.5, 0.5]))
  const positiveXIncoming = reconstructProbeRadiance([1, 0, 0], positiveX)
  const negativeXIncoming = reconstructProbeRadiance([-1, 0, 0], positiveX)
  const positiveYIncoming = reconstructProbeRadiance([0, 1, 0], positiveX)

  assert.ok(
    luminance(positiveXIncoming) > luminance(negativeXIncoming) * 2,
    'positive-X capture should reconstruct brighter from positive X than negative X'
  )
  assert.ok(
    luminance(positiveXIncoming) > luminance(positiveYIncoming) * 1.25,
    'positive-X capture should reconstruct strongest near positive X'
  )

  const positiveZ = computeCoefficients(createDirectionalFaces(4, [1, 3, 1]))
  const positiveZIncoming = reconstructProbeRadiance([0, 0, 1], positiveZ)
  const negativeZIncoming = reconstructProbeRadiance([0, 0, -1], positiveZ)

  assert.ok(
    luminance(positiveZIncoming) > luminance(negativeZIncoming) * 2,
    'positive-Z capture should reconstruct brighter from positive Z than negative Z'
  )
})
