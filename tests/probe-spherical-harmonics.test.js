import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeVolumetricLightmapCoefficientsFromPixels,
  decodeRgbE8,
  limitFirstOrderProbeCoefficientsToNonNegative,
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

function reconstructProbeRadianceUnclamped(direction, coefficients) {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1
  const normalizedDirection = [
    direction[0] / length,
    direction[1] / length,
    direction[2] / length
  ]
  const basis = [
    0.282095,
    0.488603 * normalizedDirection[0],
    0.488603 * normalizedDirection[1],
    0.488603 * normalizedDirection[2]
  ]
  const color = [0, 0, 0]

  for (let basisIndex = 0; basisIndex < basis.length; basisIndex += 1) {
    color[0] += coefficients[basisIndex][0] * basis[basisIndex]
    color[1] += coefficients[basisIndex][1] * basis[basisIndex]
    color[2] += coefficients[basisIndex][2] * basis[basisIndex]
  }

  return color.map((component) => component * 4 * Math.PI)
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

test('volumetric lightmap SH limiting prevents saturated opposite-color lobes', () => {
  const sharpDirectionalCoefficients = [
    [1.0, 0.45, 0.35],
    [2.8, 0.9, -0.02],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.25]
  ]
  const limited = limitFirstOrderProbeCoefficientsToNonNegative(sharpDirectionalCoefficients)
  const sampleDirections = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ]

  for (const direction of sampleDirections) {
    const color = reconstructProbeRadianceUnclamped(direction, limited)

    assert.ok(
      color.every((component) => component >= -1e-6),
      `expected limited first-order SH to reconstruct non-negative color for ${direction}, got ${color}`
    )
  }
})
