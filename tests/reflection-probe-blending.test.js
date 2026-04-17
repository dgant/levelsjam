import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroundReflectionProbeRects, getReflectionProbeBlendForPosition } from '../src/lib/reflectionProbeBlending.js'

const layout = {
  maze: {
    height: 3,
    lightmap: {
      groundBounds: {
        maxX: 5,
        maxZ: 5,
        minX: -5,
        minZ: -5
      }
    },
    width: 3
  }
}

test('blends fully to the nearest probe at a probe center', () => {
  const blend = getReflectionProbeBlendForPosition(layout, { x: 0, z: 0 })

  assert.deepEqual(blend.probeIndices, [4, 5, 7, 8])
  assert.deepEqual(blend.weights, [1, 0, 0, 0])
})

test('blends evenly between adjacent probes midway between their centers', () => {
  const blend = getReflectionProbeBlendForPosition(layout, { x: 1, z: 0 })

  assert.deepEqual(blend.probeIndices, [4, 5, 7, 8])
  assert.deepEqual(blend.weights, [0.5, 0.5, 0, 0])
})

test('blends across four probes at the midpoint between both axes', () => {
  const blend = getReflectionProbeBlendForPosition(layout, { x: 1, z: 1 })

  assert.deepEqual(blend.probeIndices, [4, 5, 7, 8])
  assert.deepEqual(blend.weights, [0.25, 0.25, 0.25, 0.25])
})

test('builds ground probe blend tiles that cover the ground bounds continuously', () => {
  const rects = buildGroundReflectionProbeRects(layout)

  assert.equal(rects.length, 16)
  assert.deepEqual(rects[0].probeIndices, [0, 0, 0, 0])
  assert.deepEqual(rects[5].probeIndices, [0, 1, 3, 4])
  assert.deepEqual(rects[5].region, {
    minX: -2,
    minZ: -2,
    sizeX: 2,
    sizeZ: 2
  })
  assert.deepEqual(rects.at(-1)?.probeIndices, [8, 8, 8, 8])
})
