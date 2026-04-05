export const DEFAULT_EXPOSURE_EV100 = 17.5
export const DEFAULT_IBL_INTENSITY_MULTIPLIER = 1
export const DEFAULT_TORCH_CANDELA_MULTIPLIER = 1
export const MIN_IBL_INTENSITY_MULTIPLIER = 0
export const MAX_IBL_INTENSITY_MULTIPLIER = 16
export const MIN_TORCH_CANDELA_MULTIPLIER = 0
export const MAX_TORCH_CANDELA_MULTIPLIER = 16
export const INTERNAL_LIGHT_UNIT_SCALE = 0.001
export const EV100_EXPOSURE_CONSTANT = 1 / 1.2
export const CANONICAL_HDRI_EV100 = 17.5
export const CANONICAL_HDRI_RENDERER_EXPOSURE = 0.2

export function getRendererExposure(ev100) {
  return (
    CANONICAL_HDRI_RENDERER_EXPOSURE *
    (2 ** (CANONICAL_HDRI_EV100 - ev100)) /
    INTERNAL_LIGHT_UNIT_SCALE
  )
}

export function getHdrLightingIntensity(multiplier) {
  return multiplier * INTERNAL_LIGHT_UNIT_SCALE
}

export function scalePhotometricIntensity(value) {
  return value * INTERNAL_LIGHT_UNIT_SCALE
}
