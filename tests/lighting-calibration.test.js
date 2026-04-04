import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BASE_RENDERER_EXPOSURE,
  DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX,
  DEFAULT_EXPOSURE_EV100,
  DEFAULT_SKY_LIGHT_MULTIPLIER,
  REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX,
  getAtmosphereSolarIrradianceScale,
  getDirectSunIlluminanceScale,
  getRendererExposure,
  getSkyLightScale
} from '../src/lib/lightingCalibration.js'

function almostEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
}

test('anchors the default direct sun illuminance to the calibrated reference', () => {
  assert.equal(
    DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX,
    REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX
  )
  almostEqual(getDirectSunIlluminanceScale(DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX), 1)
  almostEqual(
    getAtmosphereSolarIrradianceScale(DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX),
    1
  )
})

test('scales direct sun and sky lighting linearly from the lux input', () => {
  almostEqual(getDirectSunIlluminanceScale(50000), 0.5)
  almostEqual(
    getSkyLightScale(50000, DEFAULT_SKY_LIGHT_MULTIPLIER),
    0.5
  )
  almostEqual(getSkyLightScale(50000, 1.5), 0.75)
  almostEqual(getSkyLightScale(-10, 1.5), 0)
})

test('maps EV100 stops to renderer exposure', () => {
  almostEqual(getRendererExposure(DEFAULT_EXPOSURE_EV100), BASE_RENDERER_EXPOSURE)
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 + 1),
    BASE_RENDERER_EXPOSURE / 2
  )
  almostEqual(
    getRendererExposure(DEFAULT_EXPOSURE_EV100 - 1),
    BASE_RENDERER_EXPOSURE * 2
  )
})
