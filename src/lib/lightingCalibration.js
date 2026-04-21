export const DEFAULT_EXPOSURE_STOPS = 0
export const LEGACY_DEFAULT_EXPOSURE_STOPS = -4.5
export const INTERNAL_LIGHT_UNIT_SCALE = 0.001

export function getRendererExposure(exposureStops) {
  return 2 ** (-exposureStops)
}

export const AUTHORED_LIGHTING_SOURCE_SCALE =
  getRendererExposure(LEGACY_DEFAULT_EXPOSURE_STOPS)

export function getHdrLightingIntensity(multiplier) {
  return multiplier * INTERNAL_LIGHT_UNIT_SCALE
}
