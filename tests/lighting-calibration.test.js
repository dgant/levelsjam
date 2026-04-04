import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BASE_RENDERER_EXPOSURE,
  DEFAULT_EXPOSURE_EV100,
  DEFAULT_IBL_INTENSITY_MULTIPLIER,
  DEFAULT_TORCH_CANDELA_MULTIPLIER,
  MAX_IBL_INTENSITY_MULTIPLIER,
  MAX_TORCH_CANDELA_MULTIPLIER,
  MIN_IBL_INTENSITY_MULTIPLIER,
  MIN_TORCH_CANDELA_MULTIPLIER,
  getRendererExposure
} from '../src/lib/lightingCalibration.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('anchors the default EV100 to the calibrated renderer exposure', () => {
  almostEqual(getRendererExposure(DEFAULT_EXPOSURE_EV100), BASE_RENDERER_EXPOSURE)
})

test('maps EV100 stops to renderer exposure', () => {
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 + 1),
    BASE_RENDERER_EXPOSURE / 2
  )
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 - 1),
    BASE_RENDERER_EXPOSURE * 2
  )
})

test('exposes the ibl and torch multiplier control ranges', () => {
  assert.equal(DEFAULT_IBL_INTENSITY_MULTIPLIER, 1)
  assert.equal(DEFAULT_TORCH_CANDELA_MULTIPLIER, 1)
  assert.equal(MIN_IBL_INTENSITY_MULTIPLIER, 0)
  assert.equal(MAX_IBL_INTENSITY_MULTIPLIER, 4)
  assert.equal(MIN_TORCH_CANDELA_MULTIPLIER, 0)
  assert.equal(MAX_TORCH_CANDELA_MULTIPLIER, 4)
})
