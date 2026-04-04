export declare const REFERENCE_DIRECT_SUN_ILLUMINANCE_LUX: number
export declare const DEFAULT_DIRECT_SUN_ILLUMINANCE_LUX: number
export declare const MIN_DIRECT_SUN_ILLUMINANCE_LUX: number
export declare const MAX_DIRECT_SUN_ILLUMINANCE_LUX: number
export declare const DEFAULT_SKY_LIGHT_MULTIPLIER: number
export declare const BASE_RENDERER_EXPOSURE: number
export declare const DEFAULT_EXPOSURE_EV100: number

export declare function getDirectSunIlluminanceScale(
  directSunIlluminanceLux: number
): number

export declare function getSkyLightScale(
  directSunIlluminanceLux: number,
  skyLightMultiplier?: number
): number

export declare function getAtmosphereSolarIrradianceScale(
  directSunIlluminanceLux: number
): number

export declare function getRendererExposure(ev100: number): number
