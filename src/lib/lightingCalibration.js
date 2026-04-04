export const REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX = 100000
export const DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX =
  REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX
export const MIN_DIRECT_SUN_ILLUMINANCE_LUX = 0
export const MAX_DIRECT_SUN_ILLUMINANCE_LUX = 130000
export const DEFAULT_SKY_LIGHT_MULTIPLIER = 1
export const BASE_RENDERER_EXPOSURE = 1.2
export const DEFAULT_EXPOSURE_EV100 = 15

function clampNonNegative(value) {
  return Math.max(0, value)
}

export function getDirectSunIlluminanceScale(directSunIlluminanceLux) {
  return (
    clampNonNegative(directSunIlluminanceLux) /
    REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX
  )
}

export function getSkyLightScale(
  directSunIlluminanceLux,
  skyLightMultiplier = DEFAULT_SKY_LIGHT_MULTIPLIER
) {
  return (
    getDirectSunIlluminanceScale(directSunIlluminanceLux) *
    clampNonNegative(skyLightMultiplier)
  )
}

export function getAtmosphereSolarIrradianceScale(directSunIlluminanceLux) {
  return getDirectSunIlluminanceScale(directSunIlluminanceLux)
}

export function getRendererExposure(ev100) {
  return BASE_RENDERER_EXPOSURE * (2 ** (DEFAULT_EXPOSURE_EV100 - ev100))
}
