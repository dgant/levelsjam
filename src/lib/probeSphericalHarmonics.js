export function normalizeDirection(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1

  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

export function directionForProbeFaceUv(faceIndex, u, v) {
  const px = (u * 2) - 1
  const py = (v * 2) - 1

  switch (faceIndex) {
    case 0:
      return normalizeDirection([1, -py, -px])
    case 1:
      return normalizeDirection([-1, -py, px])
    case 2:
      return normalizeDirection([px, 1, py])
    case 3:
      return normalizeDirection([px, -1, -py])
    case 4:
      return normalizeDirection([px, -py, 1])
    default:
      return normalizeDirection([-px, -py, -1])
  }
}

export function cubeTexelSolidAngle(u, v, size) {
  const invSize = 1 / size
  const x0 = ((2 * (u + 0)) * invSize) - 1
  const y0 = ((2 * (v + 0)) * invSize) - 1
  const x1 = ((2 * (u + 1)) * invSize) - 1
  const y1 = ((2 * (v + 1)) * invSize) - 1

  const areaElement = (x, y) =>
    Math.atan2(x * y, Math.sqrt((x * x) + (y * y) + 1))

  return (
    areaElement(x0, y0) -
    areaElement(x0, y1) -
    areaElement(x1, y0) +
    areaElement(x1, y1)
  )
}

export function decodeRgbE8(r, g, b, a) {
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

export function encodeRgbE8(color) {
  const maxComponent = Math.max(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0)

  if (!(maxComponent > 1e-32)) {
    return [0, 0, 0, 0]
  }

  const exponent = Math.ceil(Math.log2(maxComponent))
  const scale = 2 ** exponent

  return [
    Math.max(0, Math.min(255, Math.round(((color[0] ?? 0) / scale) * 255))),
    Math.max(0, Math.min(255, Math.round(((color[1] ?? 0) / scale) * 255))),
    Math.max(0, Math.min(255, Math.round(((color[2] ?? 0) / scale) * 255))),
    Math.max(1, Math.min(255, exponent + 128))
  ]
}

export function computeVolumetricLightmapCoefficientsFromPixels(
  faces,
  decodePixel
) {
  const basisWeights = [
    () => 0.282095,
    ([x]) => 0.488603 * x,
    ([, y]) => 0.488603 * y,
    ([, , z]) => 0.488603 * z
  ]
  const coefficients = basisWeights.map(() => [0, 0, 0])
  let totalWeight = 0

  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const face = faces[faceIndex]

    for (let row = 0; row < face.height; row += 1) {
      for (let column = 0; column < face.width; column += 1) {
        const color = decodePixel(face, column, row)
        const direction = directionForProbeFaceUv(
          faceIndex,
          (column + 0.5) / face.width,
          (row + 0.5) / face.height
        )
        const weight = cubeTexelSolidAngle(column, row, face.width)

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

export function reconstructProbeRadiance(direction, coefficients) {
  const normalizedDirection = normalizeDirection(direction)
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

  const fullSphereScale = 4 * Math.PI

  return color.map((component) => Math.max(0, component * fullSphereScale))
}
