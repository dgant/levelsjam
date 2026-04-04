export declare const DEFAULT_EXPOSURE_EV100: number
export declare const DEFAULT_IBL_INTENSITY_MULTIPLIER: number
export declare const DEFAULT_TORCH_CANDELA_MULTIPLIER: number
export declare const MIN_IBL_INTENSITY_MULTIPLIER: number
export declare const MAX_IBL_INTENSITY_MULTIPLIER: number
export declare const MIN_TORCH_CANDELA_MULTIPLIER: number
export declare const MAX_TORCH_CANDELA_MULTIPLIER: number
export declare const INTERNAL_LIGHT_UNIT_SCALE: number
export declare const EV100_EXPOSURE_CONSTANT: number
export declare const CANONICAL_HDRI_EV100: number
export declare const CANONICAL_HDRI_RENDERER_EXPOSURE: number

export declare function getRendererExposure(ev100: number): number
export declare function getHdrLightingIntensity(multiplier: number): number
export declare function scalePhotometricIntensity(value: number): number
