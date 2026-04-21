import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUTHORED_LIGHTING_SOURCE_SCALE,
  DEFAULT_EXPOSURE_STOPS,
  LEGACY_DEFAULT_EXPOSURE_STOPS,
  INTERNAL_LIGHT_UNIT_SCALE,
  getHdrLightingIntensity,
  getRendererExposure
} from '../src/lib/lightingCalibration.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('keeps neutral exposure at zero stops', () => {
  assert.equal(DEFAULT_EXPOSURE_STOPS, 0)
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

test('preserves the legacy default exposure as authored source scale', () => {
  assert.equal(LEGACY_DEFAULT_EXPOSURE_STOPS, -4.5)
  almostEqual(
    AUTHORED_LIGHTING_SOURCE_SCALE,
    getRendererExposure(LEGACY_DEFAULT_EXPOSURE_STOPS)
  )
})

test('uses a shared internal light-unit scale for HDRI', () => {
  almostEqual(INTERNAL_LIGHT_UNIT_SCALE, 0.001)
  almostEqual(getHdrLightingIntensity(1), INTERNAL_LIGHT_UNIT_SCALE)
})
