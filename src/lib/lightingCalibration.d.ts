export declare const DEFAULT_EXPOSURE_STOPS: number
export declare const DEFAULT_IBL_INTENSITY_MULTIPLIER: number
export declare const DEFAULT_TORCH_CANDELA_MULTIPLIER: number
export declare const MIN_IBL_INTENSITY_MULTIPLIER: number
export declare const MAX_IBL_INTENSITY_MULTIPLIER: number
export declare const MIN_TORCH_CANDELA_MULTIPLIER: number
export declare const MAX_TORCH_CANDELA_MULTIPLIER: number
export declare const INTERNAL_LIGHT_UNIT_SCALE: number

export declare function getRendererExposure(exposureStops: number): number
export declare function getHdrLightingIntensity(multiplier: number): number
