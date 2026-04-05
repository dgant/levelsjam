import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANONICAL_HDRI_EV100,
  CANONICAL_HDRI_RENDERER_EXPOSURE,
  DEFAULT_EXPOSURE_EV100,
  DEFAULT_IBL_INTENSITY_MULTIPLIER,
  DEFAULT_TORCH_CANDELA_MULTIPLIER,
  INTERNAL_LIGHT_UNIT_SCALE,
  MAX_IBL_INTENSITY_MULTIPLIER,
  MAX_TORCH_CANDELA_MULTIPLIER,
  MIN_IBL_INTENSITY_MULTIPLIER,
  MIN_TORCH_CANDELA_MULTIPLIER,
  getHdrLightingIntensity,
  getRendererExposure,
  scalePhotometricIntensity
} from '../src/lib/lightingCalibration.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('keeps the default EV100 value without using it as the calibration pivot', () => {
  assert.equal(DEFAULT_EXPOSURE_EV100, 17.5)
  assert.equal(CANONICAL_HDRI_EV100, 17.5)
  assert.equal(CANONICAL_HDRI_RENDERER_EXPOSURE, 0.2)
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100),
    CANONICAL_HDRI_RENDERER_EXPOSURE / INTERNAL_LIGHT_UNIT_SCALE
  )
})

test('maps EV100 stops to renderer exposure', () => {
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 + 1),
    getRendererExposure(DEFAULT_EXPOSURE_EV100) / 2
  )
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 - 1),
    getRendererExposure(DEFAULT_EXPOSURE_EV100) * 2
  )
})

test('exposes the ibl and torch multiplier control ranges', () => {
  assert.equal(DEFAULT_IBL_INTENSITY_MULTIPLIER, 1)
  assert.equal(DEFAULT_TORCH_CANDELA_MULTIPLIER, 1)
  assert.equal(MIN_IBL_INTENSITY_MULTIPLIER, 0)
  assert.equal(MAX_IBL_INTENSITY_MULTIPLIER, 16)
  assert.equal(MIN_TORCH_CANDELA_MULTIPLIER, 0)
  assert.equal(MAX_TORCH_CANDELA_MULTIPLIER, 16)
})

test('uses a shared internal light-unit scale for HDRI and photometric lights', () => {
  almostEqual(INTERNAL_LIGHT_UNIT_SCALE, 0.001)
  almostEqual(getHdrLightingIntensity(1), INTERNAL_LIGHT_UNIT_SCALE)
  almostEqual(scalePhotometricIntensity(1500), 1.5)
})
