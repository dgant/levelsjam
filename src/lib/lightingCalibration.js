export const DEFAULT_EXPOSURE_STOPS = -4.5
export const DEFAULT_IBL_INTENSITY_MULTIPLIER = 1
export const DEFAULT_TORCH_CANDELA_MULTIPLIER = 1
export const MIN_IBL_INTENSITY_MULTIPLIER = 0
export const MAX_IBL_INTENSITY_MULTIPLIER = 16
export const MIN_TORCH_CANDELA_MULTIPLIER = 0
export const MAX_TORCH_CANDELA_MULTIPLIER = 16
export const INTERNAL_LIGHT_UNIT_SCALE = 0.001

export function getRendererExposure(exposureStops) {
  return 2 ** (-exposureStops)
}

export function getHdrLightingIntensity(multiplier) {
  return multiplier * INTERNAL_LIGHT_UNIT_SCALE
}
