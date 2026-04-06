import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_EXPOSURE_STOPS,
  DEFAULT_IBL_INTENSITY_MULTIPLIER,
  DEFAULT_TORCH_CANDELA_MULTIPLIER,
  INTERNAL_LIGHT_UNIT_SCALE,
  MAX_IBL_INTENSITY_MULTIPLIER,
  MAX_TORCH_CANDELA_MULTIPLIER,
  MIN_IBL_INTENSITY_MULTIPLIER,
  MIN_TORCH_CANDELA_MULTIPLIER,
  getHdrLightingIntensity,
  getRendererExposure
} from '../src/lib/lightingCalibration.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('keeps neutral exposure at zero stops', () => {
  assert.equal(DEFAULT_EXPOSURE_STOPS, -4.5)
  almostEqual(getRendererExposure(0), 1)
})

test('maps exposure stops to renderer exposure', () => {
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_STOPS + 1),
    getRendererExposure(DEFAULT_EXPOSURE_STOPS) / 2
  )
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_STOPS - 1),
    getRendererExposure(DEFAULT_EXPOSURE_STOPS) * 2
  )
})

test('exposes the ibl and torch control ranges', () => {
  assert.equal(DEFAULT_IBL_INTENSITY_MULTIPLIER, 1)
  assert.equal(DEFAULT_TORCH_CANDELA_MULTIPLIER, 1)
  assert.equal(MIN_IBL_INTENSITY_MULTIPLIER, 0)
  assert.equal(MAX_IBL_INTENSITY_MULTIPLIER, 16)
  assert.equal(MIN_TORCH_CANDELA_MULTIPLIER, 0)
  assert.equal(MAX_TORCH_CANDELA_MULTIPLIER, 16)
})

test('uses a shared internal light-unit scale for HDRI', () => {
  almostEqual(INTERNAL_LIGHT_UNIT_SCALE, 0.001)
  almostEqual(getHdrLightingIntensity(1), INTERNAL_LIGHT_UNIT_SCALE)
})
