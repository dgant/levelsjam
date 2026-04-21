import {
  DepthOfField,
  EffectComposer,
  LensFlareEffect as PostLensFlareEffectImpl,
  N8AO,
  SSAO,
  ToneMapping,
  Vignette
} from '@react-three/postprocessing'
import { Canvas, createPortal, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  BasicShadowMap,
  BoxGeometry,
  Camera as ThreeCamera,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CubeCamera,
  CubeUVReflectionMapping,
  DataTexture,
  DepthTexture,
  DoubleSide,
  EquirectangularReflectionMapping,
  Euler,
  Float32BufferAttribute,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  NearestFilter,
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhysicalMaterial as ThreeMeshPhysicalMaterial,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  NoBlending,
  NoToneMapping,
  NeutralToneMapping,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  RGBADepthPacking,
  ReinhardToneMapping,
  RepeatWrapping,
  SRGBColorSpace,
  Scene as ThreeScene,
  Shader,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  TextureLoader,
  Uniform,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLCubeRenderTarget
} from 'three'
import {
  Suspense,
  useEffect,
  useMemo,
  type RefObject,
  type ReactNode,
  useRef,
  useState
} from 'react'
import {
  BloomEffect,
  BlendFunction,
  Effect,
  KernelSize,
  Pass,
  ToneMappingMode as PostToneMappingMode
} from 'postprocessing'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { SSREffect } from './vendor/screen-space-reflections.js'
import {
  DEFAULT_EXPOSURE_STOPS,
  DEFAULT_IBL_INTENSITY_MULTIPLIER,
  DEFAULT_TORCH_CANDELA_MULTIPLIER,
  MAX_IBL_INTENSITY_MULTIPLIER,
  MAX_TORCH_CANDELA_MULTIPLIER,
  MIN_IBL_INTENSITY_MULTIPLIER,
  MIN_TORCH_CANDELA_MULTIPLIER,
  getHdrLightingIntensity,
  getRendererExposure
} from './lib/lightingCalibration.js'
import {
  getCameraPosition,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from './lib/playerCollision.js'
import {
  createMovementSettings,
  DEFAULT_MOVEMENT_SETTINGS,
  updateVerticalVelocity
} from './lib/playerMotion.js'
import {
  GROUND_SIZE,
  GROUND_Y,
  MAZE_CELL_SIZE,
  getDebugMazeLayoutById,
  getWallBounds,
  loadMazeLayoutById,
  loadRandomMazeLayout,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BASE_CANDELA,
  TORCH_BILLBOARD_SIZE,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH
} from './lib/sceneLayoutRuntime'
import type { MazeLayout } from './lib/sceneLayout.js'
import { computeLocalBillboardQuaternion } from './lib/billboard.js'
import {
  buildGroundReflectionProbeRects,
  getReflectionProbeBlendForPosition
} from './lib/reflectionProbeBlending.js'

declare const __GIT_REVISION__: string
declare const __GIT_REVISION_TIMESTAMP__: string

const assetBase = import.meta.env.BASE_URL
const ENVIRONMENT_URL = `${assetBase}textures/environment/overcast_soil_1k.hdr`
const FIRE_FLIPBOOK_URL =
  `${assetBase}textures/fire/CampFire_l_nosmoke_front_Loop_01_4K_6x6.png`
const PUDDLE_TEXTURE_URLS = {
  ao: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_AO.jpg`,
  color: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Diffuse.jpg`,
  displacement: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Displacement.jpg`,
  gloss: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Gloss.jpg`,
  normal: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Normal.jpg`
}
const WALL_TEXTURE_URLS = {
  ao: `${assetBase}textures/stone-wall-29/stonewall_29-1K/stonewall_29_ambientocclusion-1K.png`,
  color: `${assetBase}textures/stone-wall-29/stonewall_29-1K/stonewall_29_basecolor-1K.png`,
  height: `${assetBase}textures/stone-wall-29/stonewall_29-1K/stonewall_29_height-1K.png`,
  normal: `${assetBase}textures/stone-wall-29/stonewall_29-1K/stonewall_29_normal-1K.png`,
  roughness: `${assetBase}textures/stone-wall-29/stonewall_29-1K/stonewall_29_roughness-1K.png`
}
const METAL_TEXTURE_URLS = {
  ao: `${assetBase}textures/metal-13/metal_13-1K/metal_13_ambientocclusion-1K.png`,
  color: `${assetBase}textures/metal-13/metal_13-1K/metal_13_basecolor-1K.png`,
  height: `${assetBase}textures/metal-13/metal_13-1K/metal_13_height-1K.png`,
  metallic: `${assetBase}textures/metal-13/metal_13-1K/metal_13_metallic-1K.png`,
  normal: `${assetBase}textures/metal-13/metal_13-1K/metal_13_normal-1K.png`,
  roughness: `${assetBase}textures/metal-13/metal_13-1K/metal_13_roughness-1K.png`
}
const LOOK_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.05
const BACKQUOTE_CODE = 'Backquote'
const OVERLAY_TOGGLE_CODE = 'F9'
const POINTER_UNLOCK_CODES = new Set([
  'Escape',
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight'
])
const PUDDLE_TEXTURE_REPEAT = 60
const WALL_TEXTURE_REPEAT = 2
const METAL_TEXTURE_REPEAT = 1
const LOADING_DOT_INTERVAL_MS = 250
const LOADING_FADE_DURATION_MS = 2000
const FIRE_FLIPBOOK_GRID = 6
const FIRE_FLIPBOOK_FRAME_COUNT = FIRE_FLIPBOOK_GRID * FIRE_FLIPBOOK_GRID
const FIRE_FLIPBOOK_DURATION_SECONDS = 0.5
const FIRE_FLIPBOOK_FRAME_CROP = {
  maxX: 0.6187683284457478,
  maxY: 0.8123167155425219,
  minX: 0.25806451612903225,
  minY: 0.18621700879765396
} as const
const FIRE_FLIPBOOK_CROP_WIDTH =
  FIRE_FLIPBOOK_FRAME_CROP.maxX - FIRE_FLIPBOOK_FRAME_CROP.minX
const FIRE_FLIPBOOK_CROP_HEIGHT =
  FIRE_FLIPBOOK_FRAME_CROP.maxY - FIRE_FLIPBOOK_FRAME_CROP.minY
const FIRE_COLOR = new Color('#ffb168')
const BLACK_COLOR = new Color(0, 0, 0)
const FIRE_BILLBOARD_INTENSITY_SCALE = 1 / TORCH_BASE_CANDELA
const TORCH_LIGHTMAP_TINT = FIRE_COLOR.clone()
const TORCH_BILLBOARD_LAYER = 1
const FLOOR_LIGHTMAP_INTENSITY_SCALE = 1
const WALL_LIGHTMAP_INTENSITY_SCALE = 1
const MAZE_GROUND_PATCH_OFFSET_Y = 0.002
const REFLECTION_PROBE_RENDER_SIZE = 64
const REFLECTION_PROBE_AMBIENT_RENDER_SIZE = 24
const REFLECTION_PROBE_FAR = 48
const REFLECTION_PROBE_EMISSIVE_RADIUS = 0.16
const REFLECTION_PROBE_EMISSIVE_SCALE = 2
const FOG_VOLUME_HEIGHT = 6
const FOG_VOLUME_SLICE_COUNT = 24
const FOG_VOLUME_MAX_TORCHES = 16
const EFFECT_EPSILON = 0.0001
const MAX_PHYSICS_SUBSTEPS = 10
const MIN_LOADING_OVERLAY_MS = 300
const DEFAULT_PROBE_BOX_MAX = new Vector3(0.5, WALL_HEIGHT, 0.5)
const DEFAULT_PROBE_BOX_MIN = new Vector3(-0.5, GROUND_Y, -0.5)
const DEFAULT_PROBE_POSITION = new Vector3(0, 1, 0)
const DEFAULT_FOG_IBL_COLOR = new Color(0.56, 0.58, 0.62)
const AMBIENT_OCCLUSION_OPTIONS = [
  { key: 'off', label: 'Off' },
  { key: 'n8ao', label: 'N8AO' },
  { key: 'ssao', label: 'SSAO' }
] as const
const TONE_MAPPING_MODES = {
  linear: PostToneMappingMode.LINEAR,
  reinhard: PostToneMappingMode.REINHARD,
  cineon: PostToneMappingMode.CINEON,
  aces: PostToneMappingMode.ACES_FILMIC,
  agx: PostToneMappingMode.AGX,
  neutral: PostToneMappingMode.NEUTRAL
} as const
const RENDERER_TONE_MAPPING_MODES = {
  linear: LinearToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping
} as const
const TONE_MAPPING_OPTIONS = [
  { key: 'linear', label: 'Linear' },
  { key: 'reinhard', label: 'Reinhard' },
  { key: 'cineon', label: 'Cineon' },
  { key: 'aces', label: 'ACES Filmic' },
  { key: 'agx', label: 'AgX' },
  { key: 'neutral', label: 'Neutral' }
] as const
const cameraEuler = new Euler(0, 0, 0, 'YXZ')
const defaultMoveDirection = new Vector3(0, 0, -1)
const WHITE_COLOR = new Color(1, 1, 1)
const SCONCE_PROFILE_POINTS = (() => {
  const points = [new Vector2(0, 0), new Vector2(SCONCE_RADIUS, 0)]
  const segments = 12

  for (let index = 1; index <= segments; index += 1) {
    const angle = (index / segments) * (Math.PI / 2)
    points.push(
      new Vector2(
        Math.cos(angle) * SCONCE_RADIUS,
        -Math.sin(angle) * SCONCE_RADIUS
      )
    )
  }

  return points
})()
const exposureEffectShader = `
uniform float exposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
`

type ToneMappingMode = keyof typeof TONE_MAPPING_MODES
type AmbientOcclusionMode = (typeof AMBIENT_OCCLUSION_OPTIONS)[number]['key']

type EffectSettings = {
  enabled: boolean
  intensity: number
}

type BloomKernelSizeKey =
  | 'very-small'
  | 'small'
  | 'medium'
  | 'large'
  | 'very-large'
  | 'huge'

type BloomSettings = EffectSettings & {
  kernelSize: BloomKernelSizeKey
}

type DepthOfFieldSettings = {
  bokehScale: number
  enabled: boolean
  focalLength: number
  focusDistance: number
}

type MovementSettings = {
  accelerationDistance: number
  decelerationDistance: number
  maxHorizontalSpeedMph: number
}

const BLOOM_KERNEL_SIZES: Record<BloomKernelSizeKey, KernelSize> = {
  'very-small': KernelSize.VERY_SMALL,
  small: KernelSize.SMALL,
  medium: KernelSize.MEDIUM,
  large: KernelSize.LARGE,
  'very-large': KernelSize.VERY_LARGE,
  huge: KernelSize.HUGE
}

const BLOOM_RESOLUTION_SCALES: Record<BloomKernelSizeKey, number> = {
  'very-small': 0.35,
  small: 0.4,
  medium: 0.5,
  large: 0.65,
  'very-large': 0.8,
  huge: 1
}

const BLOOM_KERNEL_OPTIONS: Array<{
  key: BloomKernelSizeKey
  label: string
}> = [
  { key: 'very-small', label: 'Very Small' },
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
  { key: 'very-large', label: 'Very Large' },
  { key: 'huge', label: 'Huge' }
]

const DEFAULT_AO_RADIUS_METERS = 1.25
const DEFAULT_VOLUMETRIC_NOISE_FREQUENCY = 2
const GIT_REVISION = __GIT_REVISION__
const GIT_REVISION_TIMESTAMP = __GIT_REVISION_TIMESTAMP__

type VisualSettings = {
  ambientOcclusionIntensity: number
  ambientOcclusionMode: AmbientOcclusionMode
  ambientOcclusionRadius: number
  bakedLightmapsEnabled: boolean
  exposureStops: number
  iblIntensity: number
  probeIblEnabled: boolean
  reflectionCapturesEnabled: boolean
  showReflectionProbes: boolean
  torchCandelaMultiplier: number
  toneMapping: ToneMappingMode
  bloom: BloomSettings
  depthOfField: DepthOfFieldSettings
  lensFlare: EffectSettings
  movement: MovementSettings
  ssr: EffectSettings
  volumetricLighting: EffectSettings
  volumetricNoiseFrequency: number
  vignette: EffectSettings
}

type GenericEffectSettingKey =
  'lensFlare' |
  'ssr' |
  'vignette' |
  'volumetricLighting'
type BooleanSettingKey =
  | 'bakedLightmapsEnabled'
  | 'probeIblEnabled'
  | 'reflectionCapturesEnabled'
  | 'showReflectionProbes'
type ScalarSettingKey =
  | 'ambientOcclusionIntensity'
  | 'ambientOcclusionRadius'
  | 'exposureStops'
  | 'iblIntensity'
  | 'movementAccelerationDistance'
  | 'movementDecelerationDistance'
  | 'movementMaxHorizontalSpeedMph'
  | 'torchCandelaMultiplier'
  | 'volumetricNoiseFrequency'

type PbrMaps = {
  aoMap?: Texture
  bumpMap?: Texture
  map: Texture
  metalnessMap?: Texture
  normalMap?: Texture
  roughnessMap?: Texture
}

type BenchmarkResult = {
  averageFrameMs: number
  fps: number
  maxFrameMs: number
  minFrameMs: number
  samples: number
}

type ProbeMetric = {
  darkest: number
  faceCenterColors: Array<{
    b: number
    g: number
    r: number
  }>
  faceGridColors: Array<Array<{
    b: number
    g: number
    r: number
    x: number
    y: number
  }>>
  luminanceStdDev: number
  nonWhiteFraction: number
  warmFraction: number
}

type ProbeTextureSummary = {
  colorSpace: string | null
  generateMipmaps: boolean
  imageHeight: number | null
  imageWidth: number | null
  magFilter: number
  mapping: number
  minFilter: number
  type: number
}

type LightmapRect = {
  height: number
  width: number
  x: number
  y: number
}

type GroundPatchRect = {
  centerX: number
  centerZ: number
  depth: number
  id: string
  probeIndices: [number, number, number, number]
  region: {
    minX: number
    minZ: number
    sizeX: number
    sizeZ: number
  }
  width: number
}

type ProbeBlendMode = 'none' | 'constant' | 'world' | 'disabled'

type ProbeTextureInfo = {
  maxMip: number
  texelHeight: number
  texelWidth: number
}

type ProbeBlendConfig = {
  mode: ProbeBlendMode
  radianceMode?: ProbeBlendMode
  probeBoxes?: Array<{
    max: { x: number, y: number, z: number } | null
    min: { x: number, y: number, z: number } | null
  }>
  probePositions?: Array<{ x: number, y: number, z: number } | null>
  probeTextureInfos?: Array<ProbeTextureInfo | null>
  probeTextures: Array<Texture | null>
  region?: {
    minX: number
    minZ: number
    sizeX: number
    sizeZ: number
  }
  weights?: [number, number, number, number]
}

type ProbeBlendShader = Shader & {
  uniforms: Shader['uniforms'] & {
    lightMapAmbientTint?: Uniform<Color>
    lightMapTorchTint?: Uniform<Color>
    localProbeBoxMax0?: Uniform<Vector3>
    localProbeBoxMax1?: Uniform<Vector3>
    localProbeBoxMax2?: Uniform<Vector3>
    localProbeBoxMax3?: Uniform<Vector3>
    localProbeBoxMin0?: Uniform<Vector3>
    localProbeBoxMin1?: Uniform<Vector3>
    localProbeBoxMin2?: Uniform<Vector3>
    localProbeBoxMin3?: Uniform<Vector3>
    localProbeEnvMap0?: Uniform<Texture | null>
    localProbeEnvMap1?: Uniform<Texture | null>
    localProbeEnvMap2?: Uniform<Texture | null>
    localProbeEnvMap3?: Uniform<Texture | null>
    localProbeMaxMip0?: Uniform<number>
    localProbeMaxMip1?: Uniform<number>
    localProbeMaxMip2?: Uniform<number>
    localProbeMaxMip3?: Uniform<number>
    localProbePosition0?: Uniform<Vector3>
    localProbePosition1?: Uniform<Vector3>
    localProbePosition2?: Uniform<Vector3>
    localProbePosition3?: Uniform<Vector3>
    localProbeTexelHeight0?: Uniform<number>
    localProbeTexelHeight1?: Uniform<number>
    localProbeTexelHeight2?: Uniform<number>
    localProbeTexelHeight3?: Uniform<number>
    localProbeTexelWidth0?: Uniform<number>
    localProbeTexelWidth1?: Uniform<number>
    localProbeTexelWidth2?: Uniform<number>
    localProbeTexelWidth3?: Uniform<number>
    probeBlendMode?: Uniform<number>
    probeBlendRadianceMode?: Uniform<number>
    probeBlendRegion?: Uniform<Vector4>
    probeBlendWeights?: Uniform<Vector4>
  }
}

type MaterialShaderPatchConfig = {
  lightMapAmbientTint?: Color
  lightMapTorchTint?: Color
}

type WallMaterialContinuumStepKey =
  | 'basic-white'
  | 'basic-albedo'
  | 'standard-white'
  | 'standard-albedo'
  | 'standard-surface'
  | 'standard-surface-ao'
  | 'standard-surface-lightmap'
  | 'standard-surface-lightmap-patch'
  | 'runtime-original'

type MazeLightmap = MazeLayout['maze']['lightmap']

type StandardPbrTextureUrls = {
  ao?: string
  color: string
  height?: string
  metallic?: string
  normal?: string
  roughness?: string
}

class ExposureEffectImpl extends Effect {
  constructor(exposure: number) {
    super('ExposureEffect', exposureEffectShader, {
      uniforms: new Map([['exposure', new Uniform(exposure)]])
    })
  }

  set exposure(value: number) {
    this.uniforms.get('exposure').value = value
  }
}

function createDefaultVisualSettings(): VisualSettings {
  return {
    ambientOcclusionIntensity: 1,
    ambientOcclusionRadius: DEFAULT_AO_RADIUS_METERS,
    ambientOcclusionMode: 'off',
    bakedLightmapsEnabled: true,
    exposureStops: DEFAULT_EXPOSURE_STOPS,
    iblIntensity: DEFAULT_IBL_INTENSITY_MULTIPLIER,
    probeIblEnabled: false,
    reflectionCapturesEnabled: true,
    showReflectionProbes: false,
    torchCandelaMultiplier: DEFAULT_TORCH_CANDELA_MULTIPLIER,
    toneMapping: 'agx',
    bloom: { enabled: false, intensity: 0.7, kernelSize: 'large' },
    depthOfField: {
      bokehScale: 0,
      enabled: false,
      focalLength: 0.03,
      focusDistance: 0.02
    },
    lensFlare: { enabled: false, intensity: 0 },
    movement: {
      accelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalAccelerationDistance,
      decelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalDecelerationDistance,
      maxHorizontalSpeedMph: DEFAULT_MOVEMENT_SETTINGS.maxHorizontalSpeedMph
    },
    ssr: { enabled: false, intensity: 0 },
    volumetricLighting: { enabled: false, intensity: 0 },
    volumetricNoiseFrequency: DEFAULT_VOLUMETRIC_NOISE_FREQUENCY,
    vignette: { enabled: false, intensity: 0.4 }
  }
}

function isEffectActive(effect: EffectSettings) {
  return effect.enabled && effect.intensity > EFFECT_EPSILON
}

function isDepthOfFieldActive(settings: DepthOfFieldSettings) {
  return settings.enabled && settings.bokehScale > EFFECT_EPSILON
}

function isAmbientOcclusionActive(settings: VisualSettings) {
  return (
    settings.ambientOcclusionMode !== 'off' &&
    settings.ambientOcclusionIntensity > EFFECT_EPSILON
  )
}

function matchesDebugRole(
  object: {
    userData?: {
      debugIndex?: number
      debugRole?: string
      debugRoles?: string[]
    }
  },
  role: string,
  index: number
) {
  const userData = object.userData

  if (!userData || userData.debugIndex !== index) {
    return false
  }

  return (
    userData.debugRole === role ||
    (Array.isArray(userData.debugRoles) && userData.debugRoles.includes(role))
  )
}

const PROBE_CUBEUV_SAMPLING_GLSL = `
const float probeBlend_cubeUV_minMipLevel = 4.0;
const float probeBlend_cubeUV_minTileSize = 16.0;

float probeBlendGetFace( vec3 direction ) {
  vec3 absDirection = abs( direction );
  float face = -1.0;

  if ( absDirection.x > absDirection.z ) {
    if ( absDirection.x > absDirection.y ) {
      face = direction.x > 0.0 ? 0.0 : 3.0;
    } else {
      face = direction.y > 0.0 ? 1.0 : 4.0;
    }
  } else {
    if ( absDirection.z > absDirection.y ) {
      face = direction.z > 0.0 ? 2.0 : 5.0;
    } else {
      face = direction.y > 0.0 ? 1.0 : 4.0;
    }
  }

  return face;
}

vec2 probeBlendGetUV( vec3 direction, float face ) {
  vec2 uv;

  if ( face == 0.0 ) {
    uv = vec2( direction.z, direction.y ) / abs( direction.x );
  } else if ( face == 1.0 ) {
    uv = vec2( -direction.x, -direction.z ) / abs( direction.y );
  } else if ( face == 2.0 ) {
    uv = vec2( -direction.x, direction.y ) / abs( direction.z );
  } else if ( face == 3.0 ) {
    uv = vec2( -direction.z, direction.y ) / abs( direction.x );
  } else if ( face == 4.0 ) {
    uv = vec2( -direction.x, direction.z ) / abs( direction.y );
  } else {
    uv = vec2( direction.x, direction.y ) / abs( direction.z );
  }

  return 0.5 * ( uv + 1.0 );
}

vec3 probeBlendBilinearCubeUV(
  sampler2D envMap,
  vec3 direction,
  float mipInt,
  float texelWidth,
  float texelHeight,
  float maxMip
) {
  float face = probeBlendGetFace( direction );
  float filterInt = max( probeBlend_cubeUV_minMipLevel - mipInt, 0.0 );
  mipInt = max( mipInt, probeBlend_cubeUV_minMipLevel );
  float faceSize = exp2( mipInt );
  highp vec2 uv = probeBlendGetUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;

  if ( face > 2.0 ) {
    uv.y += faceSize;
    face -= 3.0;
  }

  uv.x += face * faceSize;
  uv.x += filterInt * 3.0 * probeBlend_cubeUV_minTileSize;
  uv.y += 4.0 * ( exp2( maxMip ) - faceSize );
  uv.x *= texelWidth;
  uv.y *= texelHeight;

  #ifdef texture2DGradEXT
    return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
  #else
    return texture2D( envMap, uv ).rgb;
  #endif
}

float probeBlendRoughnessToMip( float roughness ) {
  float mip = 0.0;

  if ( roughness >= 0.8 ) {
    mip = ( 1.0 - roughness ) * 5.0 - 2.0;
  } else if ( roughness >= 0.4 ) {
    mip = ( 0.8 - roughness ) * 7.5 - 1.0;
  } else if ( roughness >= 0.305 ) {
    mip = ( 0.4 - roughness ) * 10.526315789473685 + 2.0;
  } else if ( roughness >= 0.21 ) {
    mip = ( 0.305 - roughness ) * 10.526315789473683 + 3.0;
  } else {
    mip = -2.0 * log2( 1.16 * roughness );
  }

  return mip;
}

vec4 probeBlendTextureCubeUV(
  sampler2D envMap,
  vec3 sampleDir,
  float roughness,
  float texelWidth,
  float texelHeight,
  float maxMip
) {
  float mip = clamp( probeBlendRoughnessToMip( roughness ), -2.0, maxMip );
  float mipF = fract( mip );
  float mipInt = floor( mip );
  vec3 color0 = probeBlendBilinearCubeUV(
    envMap,
    sampleDir,
    mipInt,
    texelWidth,
    texelHeight,
    maxMip
  );

  if ( mipF == 0.0 ) {
    return vec4( color0, 1.0 );
  }

  vec3 color1 = probeBlendBilinearCubeUV(
    envMap,
    sampleDir,
    mipInt + 1.0,
    texelWidth,
    texelHeight,
    maxMip
  );

  return vec4( mix( color0, color1, mipF ), 1.0 );
}
`

const PROBE_BLEND_SHADER_CHUNK = `
#ifdef USE_ENVMAP

uniform sampler2D localProbeEnvMap0;
uniform sampler2D localProbeEnvMap1;
uniform sampler2D localProbeEnvMap2;
uniform sampler2D localProbeEnvMap3;
uniform float localProbeTexelWidth0;
uniform float localProbeTexelWidth1;
uniform float localProbeTexelWidth2;
uniform float localProbeTexelWidth3;
uniform float localProbeTexelHeight0;
uniform float localProbeTexelHeight1;
uniform float localProbeTexelHeight2;
uniform float localProbeTexelHeight3;
uniform float localProbeMaxMip0;
uniform float localProbeMaxMip1;
uniform float localProbeMaxMip2;
uniform float localProbeMaxMip3;
uniform int probeBlendMode;
uniform int probeBlendRadianceMode;
uniform vec4 probeBlendWeights;
uniform vec4 probeBlendRegion;

uniform vec3 localProbePosition0;
uniform vec3 localProbePosition1;
uniform vec3 localProbePosition2;
uniform vec3 localProbePosition3;
uniform vec3 localProbeBoxMin0;
uniform vec3 localProbeBoxMin1;
uniform vec3 localProbeBoxMin2;
uniform vec3 localProbeBoxMin3;
uniform vec3 localProbeBoxMax0;
uniform vec3 localProbeBoxMax1;
uniform vec3 localProbeBoxMax2;
uniform vec3 localProbeBoxMax3;

${PROBE_CUBEUV_SAMPLING_GLSL}

float probeBlendSafeComponent( float value ) {
  if ( abs( value ) < 0.0001 ) {
    return value < 0.0 ? -0.0001 : 0.0001;
  }

  return value;
}

vec3 applyProbeBoxProjection(
  vec3 worldPosition,
  vec3 direction,
  vec3 probePosition,
  vec3 boxMin,
  vec3 boxMax
) {
  vec3 safeDirection = vec3(
    probeBlendSafeComponent( direction.x ),
    probeBlendSafeComponent( direction.y ),
    probeBlendSafeComponent( direction.z )
  );
  vec3 distancesToMin = ( boxMin - worldPosition ) / safeDirection;
  vec3 distancesToMax = ( boxMax - worldPosition ) / safeDirection;
  vec3 travel = vec3(
    safeDirection.x > 0.0 ? distancesToMax.x : distancesToMin.x,
    safeDirection.y > 0.0 ? distancesToMax.y : distancesToMin.y,
    safeDirection.z > 0.0 ? distancesToMax.z : distancesToMin.z
  );
  float distanceToBox = min( min( travel.x, travel.y ), travel.z );
  vec3 projectedWorldPosition = worldPosition + ( direction * distanceToBox );

  return projectedWorldPosition - probePosition;
}

vec4 sampleProbeBlendTexture(
  sampler2D probeMap,
  vec3 worldPosition,
  vec3 direction,
  float roughness,
  vec3 probePosition,
  vec3 boxMin,
  vec3 boxMax,
  float texelWidth,
  float texelHeight,
  float maxMip
) {
  vec3 projectedDirection = applyProbeBoxProjection(
    worldPosition,
    direction,
    probePosition,
    boxMin,
    boxMax
  );

  return probeBlendTextureCubeUV(
    probeMap,
    envMapRotation * projectedDirection,
    roughness,
    texelWidth,
    texelHeight,
    maxMip
  );
}

vec4 sampleProbeBlendLocalMaps( vec3 worldPosition, vec3 direction, float roughness, vec4 weights ) {
  vec4 color0 = sampleProbeBlendTexture(
    localProbeEnvMap0,
    worldPosition,
    direction,
    roughness,
    localProbePosition0,
    localProbeBoxMin0,
    localProbeBoxMax0,
    localProbeTexelWidth0,
    localProbeTexelHeight0,
    localProbeMaxMip0
  );
  vec4 color1 = sampleProbeBlendTexture(
    localProbeEnvMap1,
    worldPosition,
    direction,
    roughness,
    localProbePosition1,
    localProbeBoxMin1,
    localProbeBoxMax1,
    localProbeTexelWidth1,
    localProbeTexelHeight1,
    localProbeMaxMip1
  );
  vec4 color2 = sampleProbeBlendTexture(
    localProbeEnvMap2,
    worldPosition,
    direction,
    roughness,
    localProbePosition2,
    localProbeBoxMin2,
    localProbeBoxMax2,
    localProbeTexelWidth2,
    localProbeTexelHeight2,
    localProbeMaxMip2
  );
  vec4 color3 = sampleProbeBlendTexture(
    localProbeEnvMap3,
    worldPosition,
    direction,
    roughness,
    localProbePosition3,
    localProbeBoxMin3,
    localProbeBoxMax3,
    localProbeTexelWidth3,
    localProbeTexelHeight3,
    localProbeMaxMip3
  );

  return
    ( color0 * weights.x ) +
    ( color1 * weights.y ) +
    ( color2 * weights.z ) +
    ( color3 * weights.w );
}

vec4 sampleProbeBlendEnvMapWithMode( vec3 direction, float roughness, int mode ) {
  if ( mode == 1 ) {
    float tx = probeBlendRegion.z > 0.0
      ? clamp( ( vProbeBlendWorldPosition.x - probeBlendRegion.x ) / probeBlendRegion.z, 0.0, 1.0 )
      : 0.0;
    float tz = probeBlendRegion.w > 0.0
      ? clamp( ( vProbeBlendWorldPosition.z - probeBlendRegion.y ) / probeBlendRegion.w, 0.0, 1.0 )
      : 0.0;
    vec4 weights = vec4(
      ( 1.0 - tx ) * ( 1.0 - tz ),
      tx * ( 1.0 - tz ),
      ( 1.0 - tx ) * tz,
      tx * tz
    );

    return sampleProbeBlendLocalMaps( vProbeBlendWorldPosition, direction, roughness, weights );
  }

  if ( mode == 2 ) {
    return sampleProbeBlendLocalMaps( vProbeBlendWorldPosition, direction, roughness, probeBlendWeights );
  }

  if ( mode == 3 ) {
    return vec4( 0.0 );
  }

  return textureCubeUV( envMap, envMapRotation * direction, roughness ) * envMapIntensity;
}

vec3 getIBLIrradiance( const in vec3 normal ) {

  #ifdef ENVMAP_TYPE_CUBE_UV

    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
    vec4 envMapColor = sampleProbeBlendEnvMapWithMode( worldNormal, 1.0, probeBlendMode );

    return PI * envMapColor.rgb;

  #else

    return vec3( 0.0 );

  #endif

}

vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

  #ifdef ENVMAP_TYPE_CUBE_UV

    vec3 reflectVec = reflect( - viewDir, normal );
    reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

    vec4 envMapColor = sampleProbeBlendEnvMapWithMode( reflectVec, roughness, probeBlendRadianceMode );

    return envMapColor.rgb;

  #else

    return vec3( 0.0 );

  #endif

}

  #ifdef USE_ANISOTROPY

    vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

      #ifdef ENVMAP_TYPE_CUBE_UV

        vec3 bentNormal = cross( bitangent, viewDir );
        bentNormal = normalize( cross( bentNormal, bitangent ) );
        bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

        return getIBLRadiance( viewDir, bentNormal, roughness );

      #else

        return vec3( 0.0 );

      #endif

    }

  #endif

#endif
`

function updateProbeBlendShaderUniforms(
  shader: ProbeBlendShader | null,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig
) {
  if (!shader) {
    return
  }

  shader.uniforms.lightMapAmbientTint?.value.copy(
    patchConfig.lightMapAmbientTint ?? BLACK_COLOR
  )
  shader.uniforms.lightMapTorchTint?.value.copy(
    patchConfig.lightMapTorchTint ?? WHITE_COLOR
  )

  const probePositions = probeBlend.probePositions ?? []
  const probeBoxes = probeBlend.probeBoxes ?? []
  const probeTextureInfos = probeBlend.probeTextureInfos ?? []
  const defaultProbePosition = DEFAULT_PROBE_POSITION
  const defaultProbeBoxMin = DEFAULT_PROBE_BOX_MIN
  const defaultProbeBoxMax = DEFAULT_PROBE_BOX_MAX
  const defaultProbeTextureInfo = DEFAULT_PROBE_TEXTURE_INFO
  const applyProbeUniforms = (
    index: number,
    positionUniform: Uniform<Vector3> | undefined,
    boxMinUniform: Uniform<Vector3> | undefined,
    boxMaxUniform: Uniform<Vector3> | undefined
  ) => {
    positionUniform?.value.set(
      probePositions[index]?.x ?? defaultProbePosition.x,
      probePositions[index]?.y ?? defaultProbePosition.y,
      probePositions[index]?.z ?? defaultProbePosition.z
    )
    boxMinUniform?.value.set(
      probeBoxes[index]?.min?.x ?? defaultProbeBoxMin.x,
      probeBoxes[index]?.min?.y ?? defaultProbeBoxMin.y,
      probeBoxes[index]?.min?.z ?? defaultProbeBoxMin.z
    )
    boxMaxUniform?.value.set(
      probeBoxes[index]?.max?.x ?? defaultProbeBoxMax.x,
      probeBoxes[index]?.max?.y ?? defaultProbeBoxMax.y,
      probeBoxes[index]?.max?.z ?? defaultProbeBoxMax.z
    )
  }
  const applyProbeTextureInfoUniforms = (
    index: number,
    texelWidthUniform: Uniform<number> | undefined,
    texelHeightUniform: Uniform<number> | undefined,
    maxMipUniform: Uniform<number> | undefined
  ) => {
    if (texelWidthUniform) {
      texelWidthUniform.value =
        probeTextureInfos[index]?.texelWidth ?? defaultProbeTextureInfo.texelWidth
    }
    if (texelHeightUniform) {
      texelHeightUniform.value =
        probeTextureInfos[index]?.texelHeight ?? defaultProbeTextureInfo.texelHeight
    }
    if (maxMipUniform) {
      maxMipUniform.value =
        probeTextureInfos[index]?.maxMip ?? defaultProbeTextureInfo.maxMip
    }
  }

  applyProbeUniforms(
    0,
    shader.uniforms.localProbePosition0,
    shader.uniforms.localProbeBoxMin0,
    shader.uniforms.localProbeBoxMax0
  )
  applyProbeUniforms(
    1,
    shader.uniforms.localProbePosition1,
    shader.uniforms.localProbeBoxMin1,
    shader.uniforms.localProbeBoxMax1
  )
  applyProbeUniforms(
    2,
    shader.uniforms.localProbePosition2,
    shader.uniforms.localProbeBoxMin2,
    shader.uniforms.localProbeBoxMax2
  )
  applyProbeUniforms(
    3,
    shader.uniforms.localProbePosition3,
    shader.uniforms.localProbeBoxMin3,
    shader.uniforms.localProbeBoxMax3
  )
  applyProbeTextureInfoUniforms(
    0,
    shader.uniforms.localProbeTexelWidth0,
    shader.uniforms.localProbeTexelHeight0,
    shader.uniforms.localProbeMaxMip0
  )
  applyProbeTextureInfoUniforms(
    1,
    shader.uniforms.localProbeTexelWidth1,
    shader.uniforms.localProbeTexelHeight1,
    shader.uniforms.localProbeMaxMip1
  )
  applyProbeTextureInfoUniforms(
    2,
    shader.uniforms.localProbeTexelWidth2,
    shader.uniforms.localProbeTexelHeight2,
    shader.uniforms.localProbeMaxMip2
  )
  applyProbeTextureInfoUniforms(
    3,
    shader.uniforms.localProbeTexelWidth3,
    shader.uniforms.localProbeTexelHeight3,
    shader.uniforms.localProbeMaxMip3
  )
  if (shader.uniforms.localProbeEnvMap0) {
    shader.uniforms.localProbeEnvMap0.value = probeBlend.probeTextures[0] ?? null
  }
  if (shader.uniforms.localProbeEnvMap1) {
    shader.uniforms.localProbeEnvMap1.value = probeBlend.probeTextures[1] ?? null
  }
  if (shader.uniforms.localProbeEnvMap2) {
    shader.uniforms.localProbeEnvMap2.value = probeBlend.probeTextures[2] ?? null
  }
  if (shader.uniforms.localProbeEnvMap3) {
    shader.uniforms.localProbeEnvMap3.value = probeBlend.probeTextures[3] ?? null
  }
  if (shader.uniforms.probeBlendMode) {
    shader.uniforms.probeBlendMode.value =
      probeBlend.mode === 'world'
        ? 1
        : probeBlend.mode === 'constant'
          ? 2
          : probeBlend.mode === 'disabled'
            ? 3
          : 0
  }
  if (shader.uniforms.probeBlendRadianceMode) {
    shader.uniforms.probeBlendRadianceMode.value =
      (probeBlend.radianceMode ?? probeBlend.mode) === 'world'
        ? 1
        : (probeBlend.radianceMode ?? probeBlend.mode) === 'constant'
          ? 2
          : (probeBlend.radianceMode ?? probeBlend.mode) === 'disabled'
            ? 3
          : 0
  }
  shader.uniforms.probeBlendWeights?.value.set(
    ...(probeBlend.weights ?? [1, 0, 0, 0])
  )
  shader.uniforms.probeBlendRegion?.value.set(
    probeBlend.region?.minX ?? 0,
    probeBlend.region?.minZ ?? 0,
    probeBlend.region?.sizeX ?? 0,
    probeBlend.region?.sizeZ ?? 0
  )
}

function getProbeBlendUpdateKey(
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig
) {
  return JSON.stringify({
    lightMapAmbientTint: patchConfig.lightMapAmbientTint
      ? [
          patchConfig.lightMapAmbientTint.r,
          patchConfig.lightMapAmbientTint.g,
          patchConfig.lightMapAmbientTint.b
        ]
      : null,
    lightMapTorchTint: patchConfig.lightMapTorchTint
      ? [
          patchConfig.lightMapTorchTint.r,
          patchConfig.lightMapTorchTint.g,
          patchConfig.lightMapTorchTint.b
        ]
      : null,
    mode: probeBlend.mode,
    probeBoxes: (probeBlend.probeBoxes ?? []).map((box) => box
      ? {
          max: [box.max.x, box.max.y, box.max.z],
          min: [box.min.x, box.min.y, box.min.z]
        }
      : null),
    probePositions: (probeBlend.probePositions ?? []).map((position) =>
      position
        ? [position.x, position.y, position.z]
        : null
    ),
    probeTextureInfos: (probeBlend.probeTextureInfos ?? []).map((textureInfo) =>
      textureInfo
        ? [textureInfo.texelWidth, textureInfo.texelHeight, textureInfo.maxMip]
        : null
    ),
    probeTextureUUIDs: probeBlend.probeTextures.map((texture) => texture?.uuid ?? null),
    radianceMode: probeBlend.radianceMode ?? probeBlend.mode,
    region: probeBlend.region
      ? [
          probeBlend.region.minX,
          probeBlend.region.minZ,
          probeBlend.region.sizeX,
          probeBlend.region.sizeZ
        ]
      : null,
    weights: probeBlend.weights ?? null
  })
}

function getProbeBlendMaterialKey(
  role: string,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig
) {
  return `${role}:${getProbeBlendUpdateKey(probeBlend, patchConfig)}`
}

function updateProbeBlendMaterialDebugState(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  probeBlend: ProbeBlendConfig
) {
  if (!material) {
    return
  }

  material.userData.probeBlendDebug = {
    mode: probeBlend.mode,
    radianceMode: probeBlend.radianceMode ?? probeBlend.mode,
    probeTextureCount: probeBlend.probeTextures.filter(Boolean).length,
    region: probeBlend.region
      ? {
          minX: probeBlend.region.minX,
          minZ: probeBlend.region.minZ,
          sizeX: probeBlend.region.sizeX,
          sizeZ: probeBlend.region.sizeZ
        }
      : null,
    weights: probeBlend.weights ? [...probeBlend.weights] : null
  }
}

function updateProbeBlendUniformDebugState(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  shader: ProbeBlendShader | null
) {
  if (!material || !shader) {
    return
  }

  material.userData.probeBlendUniformDebug = {
    localProbeTextureUUIDs: [
      shader.uniforms.localProbeEnvMap0?.value?.uuid ?? null,
      shader.uniforms.localProbeEnvMap1?.value?.uuid ?? null,
      shader.uniforms.localProbeEnvMap2?.value?.uuid ?? null,
      shader.uniforms.localProbeEnvMap3?.value?.uuid ?? null
    ],
    localProbeTextureInfo: [0, 1, 2, 3].map((index) => ({
      maxMip:
        shader.uniforms[
          `localProbeMaxMip${index}` as keyof ProbeBlendShader['uniforms']
        ]?.value ?? null,
      texelHeight:
        shader.uniforms[
          `localProbeTexelHeight${index}` as keyof ProbeBlendShader['uniforms']
        ]?.value ?? null,
      texelWidth:
        shader.uniforms[
          `localProbeTexelWidth${index}` as keyof ProbeBlendShader['uniforms']
        ]?.value ?? null
    })),
    localProbeTextureBoundCount: [
      shader.uniforms.localProbeEnvMap0?.value,
      shader.uniforms.localProbeEnvMap1?.value,
      shader.uniforms.localProbeEnvMap2?.value,
      shader.uniforms.localProbeEnvMap3?.value
    ].filter(Boolean).length,
    probeBlendMode: shader.uniforms.probeBlendMode?.value ?? null,
    probeBlendRadianceMode: shader.uniforms.probeBlendRadianceMode?.value ?? null
  }
}

function patchProbeBlendMaterialShader(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial,
  shader: Shader,
  probeBlendRef: { current: ProbeBlendConfig },
  patchConfigRef: { current: MaterialShaderPatchConfig },
  shaderRef: { current: ProbeBlendShader | null }
) {
  const probeBlendShader = shader as ProbeBlendShader
  const currentProbeBlend = probeBlendRef.current
  const currentPatchConfig = patchConfigRef.current

  probeBlendShader.uniforms.lightMapAmbientTint = new Uniform(BLACK_COLOR.clone())
  probeBlendShader.uniforms.lightMapTorchTint = new Uniform(WHITE_COLOR.clone())
  probeBlendShader.uniforms.localProbePosition0 = new Uniform(DEFAULT_PROBE_POSITION.clone())
  probeBlendShader.uniforms.localProbePosition1 = new Uniform(DEFAULT_PROBE_POSITION.clone())
  probeBlendShader.uniforms.localProbePosition2 = new Uniform(DEFAULT_PROBE_POSITION.clone())
  probeBlendShader.uniforms.localProbePosition3 = new Uniform(DEFAULT_PROBE_POSITION.clone())
  probeBlendShader.uniforms.localProbeBoxMin0 = new Uniform(DEFAULT_PROBE_BOX_MIN.clone())
  probeBlendShader.uniforms.localProbeBoxMin1 = new Uniform(DEFAULT_PROBE_BOX_MIN.clone())
  probeBlendShader.uniforms.localProbeBoxMin2 = new Uniform(DEFAULT_PROBE_BOX_MIN.clone())
  probeBlendShader.uniforms.localProbeBoxMin3 = new Uniform(DEFAULT_PROBE_BOX_MIN.clone())
  probeBlendShader.uniforms.localProbeBoxMax0 = new Uniform(DEFAULT_PROBE_BOX_MAX.clone())
  probeBlendShader.uniforms.localProbeBoxMax1 = new Uniform(DEFAULT_PROBE_BOX_MAX.clone())
  probeBlendShader.uniforms.localProbeBoxMax2 = new Uniform(DEFAULT_PROBE_BOX_MAX.clone())
  probeBlendShader.uniforms.localProbeBoxMax3 = new Uniform(DEFAULT_PROBE_BOX_MAX.clone())
  probeBlendShader.uniforms.localProbeEnvMap0 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeEnvMap1 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeEnvMap2 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeEnvMap3 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeMaxMip0 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip1 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip2 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip3 = new Uniform(0)
  probeBlendShader.uniforms.probeBlendMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendRadianceMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendWeights = new Uniform(new Vector4(1, 0, 0, 0))
  probeBlendShader.uniforms.probeBlendRegion = new Uniform(new Vector4(0, 0, 0, 0))
  probeBlendShader.uniforms.localProbeTexelHeight0 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelHeight1 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelHeight2 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelHeight3 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelWidth0 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelWidth1 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelWidth2 = new Uniform(1)
  probeBlendShader.uniforms.localProbeTexelWidth3 = new Uniform(1)

  probeBlendShader.vertexShader =
    `varying vec3 vProbeBlendWorldPosition;\n${probeBlendShader.vertexShader}`
      .replace(
        '#include <project_vertex>',
        `vec4 probeBlendWorldPosition = vec4( transformed, 1.0 );
\t#ifdef USE_BATCHING
\t\tprobeBlendWorldPosition = batchingMatrix * probeBlendWorldPosition;
\t#endif
\t#ifdef USE_INSTANCING
\t\tprobeBlendWorldPosition = instanceMatrix * probeBlendWorldPosition;
\t#endif
\tprobeBlendWorldPosition = modelMatrix * probeBlendWorldPosition;
\tvProbeBlendWorldPosition = probeBlendWorldPosition.xyz;
\t#include <project_vertex>`
      )
  probeBlendShader.fragmentShader =
    `uniform vec3 lightMapAmbientTint;\nuniform vec3 lightMapTorchTint;\nvarying vec3 vProbeBlendWorldPosition;\n${probeBlendShader.fragmentShader}`
      .replace(
        '#include <envmap_physical_pars_fragment>',
        PROBE_BLEND_SHADER_CHUNK
      )
      .replace(
        'vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;',
        `vec3 lightMapTorchIrradiance = vec3( lightMapTexel.r ) * lightMapTorchTint * lightMapIntensity;
\t\tvec3 lightMapAmbientIrradiance = vec3( lightMapTexel.g ) * lightMapAmbientTint;
\t\tvec3 lightMapIrradiance = lightMapTorchIrradiance + lightMapAmbientIrradiance;`
      )

  material.userData.probeBlendShaderDebug = {
    fragmentHasProbeRadianceMode: probeBlendShader.fragmentShader.includes('probeBlendRadianceMode'),
    fragmentHasSampleProbeBlendEnvMapWithMode: probeBlendShader.fragmentShader.includes(
      'sampleProbeBlendEnvMapWithMode'
    ),
    fragmentHasGetIBLRadianceOverride: probeBlendShader.fragmentShader.includes(
      'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness )'
    ),
    fragmentHasGetIBLIrradianceOverride: probeBlendShader.fragmentShader.includes(
      'vec3 getIBLIrradiance( const in vec3 normal )'
    )
  }
  shaderRef.current = probeBlendShader
  updateProbeBlendShaderUniforms(probeBlendShader, currentProbeBlend, currentPatchConfig)
  updateProbeBlendUniformDebugState(material, probeBlendShader)
}

function hasCompleteProbeTextures(textures: Array<Texture | null | undefined>) {
  return textures.length > 0 && textures.every(Boolean)
}

function computeAverageHdrColor(texture: Texture | null, intensity = 1) {
  const image = texture?.image as
    | {
      data?: ArrayLike<number>
      height?: number
      width?: number
    }
    | undefined
  const data = image?.data
  const width = image?.width ?? 0
  const height = image?.height ?? 0

  if (!data || width <= 0 || height <= 0) {
    return DEFAULT_FOG_IBL_COLOR.clone().multiplyScalar(intensity)
  }

  const pixelStride = data.length / (width * height)
  const rowStep = Math.max(1, Math.floor(height / 48))
  const columnStep = Math.max(1, Math.floor(width / 48))
  let sampleCount = 0
  let totalR = 0
  let totalG = 0
  let totalB = 0

  for (let row = 0; row < height; row += rowStep) {
    for (let column = 0; column < width; column += columnStep) {
      const pixelIndex = ((row * width) + column) * pixelStride

      totalR += Number(data[pixelIndex] ?? 0)
      totalG += Number(data[pixelIndex + 1] ?? 0)
      totalB += Number(data[pixelIndex + 2] ?? 0)
      sampleCount += 1
    }
  }

  if (sampleCount === 0) {
    return DEFAULT_FOG_IBL_COLOR.clone().multiplyScalar(intensity)
  }

  return new Color(
    totalR / sampleCount,
    totalG / sampleCount,
    totalB / sampleCount
  ).multiplyScalar(intensity)
}

function getPmremCubeSize(texture: Texture | null | undefined) {
  const image = texture?.image as
    | {
      height?: number
    }
    | undefined

  if (
    texture?.mapping === CubeUVReflectionMapping &&
    typeof image?.height === 'number' &&
    image.height > 0
  ) {
    return Math.max(16, Math.floor(image.height / 4))
  }

  return REFLECTION_PROBE_RENDER_SIZE
}

const DEFAULT_PROBE_TEXTURE_INFO: ProbeTextureInfo = {
  maxMip: 0,
  texelHeight: 1,
  texelWidth: 1
}

function getCubeUvTextureInfo(texture: Texture | null | undefined): ProbeTextureInfo | null {
  const image = texture?.image as
    | {
      height?: number
      width?: number
    }
    | undefined

  if (
    texture?.mapping !== CubeUVReflectionMapping ||
    typeof image?.width !== 'number' ||
    typeof image?.height !== 'number' ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return null
  }

  return {
    maxMip: Math.max(0, Math.round(Math.log2(image.height) - 2)),
    texelHeight: 1 / image.height,
    texelWidth: 1 / image.width
  }
}

function getCubeTextureFaceSize(texture: Texture | null | undefined) {
  const image = texture?.image as
    | Array<{
      height?: number
      image?: {
        height?: number
        width?: number
      }
      width?: number
    }>
    | undefined

  if (!Array.isArray(image) || image.length === 0) {
    return {
      height: null,
      width: null
    }
  }

  const firstFace = image[0]

  return {
    height:
      typeof firstFace?.height === 'number'
        ? firstFace.height
        : typeof firstFace?.image?.height === 'number'
          ? firstFace.image.height
          : null,
    width:
      typeof firstFace?.width === 'number'
        ? firstFace.width
        : typeof firstFace?.image?.width === 'number'
          ? firstFace.image.width
          : null
  }
}

function computeCubeRenderTargetDebugStats(
  renderer: {
    readRenderTargetPixels: (
      renderTarget: WebGLCubeRenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
      buffer: Uint8Array,
      activeCubeFaceIndex?: number
    ) => void
  },
  renderTarget: WebGLCubeRenderTarget
) {
  const buffer = new Uint8Array(renderTarget.width * renderTarget.height * 4)
  const centerBuffer = new Uint8Array(4)
  let sampleCount = 0
  let nonWhiteCount = 0
  let warmCount = 0
  let darkest = 255
  let luminanceTotal = 0
  let luminanceSquaredTotal = 0
  let totalR = 0
  let totalG = 0
  let totalB = 0
  const faceCenterColors: Array<{
    b: number
    g: number
    r: number
  }> = []
  const faceGridColors: Array<Array<{
    b: number
    g: number
    r: number
    x: number
    y: number
  }>> = []

  for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
    renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      renderTarget.width,
      renderTarget.height,
      buffer,
      faceIndex
    )
    renderer.readRenderTargetPixels(
      renderTarget,
      Math.floor(renderTarget.width / 2),
      Math.floor(renderTarget.height / 2),
      1,
      1,
      centerBuffer,
      faceIndex
    )
    faceCenterColors.push({
      b: centerBuffer[2],
      g: centerBuffer[1],
      r: centerBuffer[0]
    })
    const faceSamples: Array<{
      b: number
      g: number
      r: number
      x: number
      y: number
    }> = []

    for (const sampleY of [0.25, 0.5, 0.75]) {
      for (const sampleX of [0.25, 0.5, 0.75]) {
        renderer.readRenderTargetPixels(
          renderTarget,
          Math.min(renderTarget.width - 1, Math.max(0, Math.floor((renderTarget.width - 1) * sampleX))),
          Math.min(renderTarget.height - 1, Math.max(0, Math.floor((renderTarget.height - 1) * sampleY))),
          1,
          1,
          centerBuffer,
          faceIndex
        )
        faceSamples.push({
          b: centerBuffer[2],
          g: centerBuffer[1],
          r: centerBuffer[0],
          x: sampleX,
          y: sampleY
        })
      }
    }
    faceGridColors.push(faceSamples)

    for (let offset = 0; offset < buffer.length; offset += 4) {
      const r = buffer[offset]
      const g = buffer[offset + 1]
      const b = buffer[offset + 2]
      const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)

      totalR += r
      totalG += g
      totalB += b
      luminanceTotal += luminance
      luminanceSquaredTotal += luminance * luminance
      darkest = Math.min(darkest, r, g, b)
      if (r < 235 || g < 235 || b < 235) {
        nonWhiteCount += 1
      }
      if (r > (g + 12) && g > (b + 4)) {
        warmCount += 1
      }
      sampleCount += 1
    }
  }

  if (sampleCount === 0) {
    return {
      averageColor: DEFAULT_FOG_IBL_COLOR.clone(),
      darkest: 255,
      faceCenterColors,
      faceGridColors,
      luminanceStdDev: 0,
      nonWhiteFraction: 0,
      warmFraction: 0
    }
  }

  const averageLuminance = luminanceTotal / sampleCount
  const variance = Math.max(
    0,
    (luminanceSquaredTotal / sampleCount) - (averageLuminance * averageLuminance)
  )

  return {
    averageColor: new Color(
      totalR / (sampleCount * 255),
      totalG / (sampleCount * 255),
      totalB / (sampleCount * 255)
    ),
    darkest,
    faceCenterColors,
    faceGridColors,
    luminanceStdDev: Math.sqrt(variance),
    nonWhiteFraction: nonWhiteCount / sampleCount,
    warmFraction: warmCount / sampleCount
  }
}

function isCubeRenderTargetReadbackSupported(renderTarget: WebGLCubeRenderTarget) {
  return renderTarget.texture.type === UnsignedByteType
}

function getReflectionCaptureCountKey(
  object: Mesh
): 'billboard' | 'ground' | 'sconce' | 'wall' | null {
  if (object.userData?.debugRole === 'maze-ground-lightmap') {
    return 'ground'
  }

  if (
    object.userData?.debugRole === 'maze-wall' ||
    (
      Array.isArray(object.userData?.debugRoles) &&
      object.userData.debugRoles.includes('maze-wall-lightmap')
    )
  ) {
    return 'wall'
  }

  if (object.userData?.debugRole === 'sconce-body') {
    return 'sconce'
  }

  if (object.userData?.debugRole === 'torch-billboard') {
    return 'billboard'
  }

  return null
}

function getProbeVolumeBounds(
  probePosition: { x: number, y: number, z: number } | null | undefined
) {
  if (!probePosition) {
    return {
      max: DEFAULT_PROBE_BOX_MAX,
      min: DEFAULT_PROBE_BOX_MIN
    }
  }

  return {
    max: {
      x: probePosition.x + (MAZE_CELL_SIZE / 2),
      y: GROUND_Y + WALL_HEIGHT,
      z: probePosition.z + (MAZE_CELL_SIZE / 2)
    },
    min: {
      x: probePosition.x - (MAZE_CELL_SIZE / 2),
      y: GROUND_Y,
      z: probePosition.z - (MAZE_CELL_SIZE / 2)
    }
  }
}

function buildProbeBlendConfig(
  layout: MazeLayout,
  probeIndices: [number, number, number, number],
  probeTextures: Array<Texture | null>,
  mode: ProbeBlendMode,
  options: {
    radianceMode?: ProbeBlendMode
    region?: {
      minX: number
      minZ: number
      sizeX: number
      sizeZ: number
    }
    weights?: [number, number, number, number]
  } = {}
) {
  return {
    mode,
    radianceMode: options.radianceMode ?? mode,
    probeBoxes: probeIndices.map((probeIndex) =>
      getProbeVolumeBounds(layout.reflectionProbes[probeIndex]?.position)
    ),
    probePositions: probeIndices.map(
      (probeIndex) => layout.reflectionProbes[probeIndex]?.position ?? null
    ),
    probeTextureInfos: probeTextures.map((texture) => getCubeUvTextureInfo(texture)),
    probeTextures,
    region: options.region,
    weights: options.weights
  } satisfies ProbeBlendConfig
}

function useProbeBlendMaterialShader(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig = {},
  materialKey: string
) {
  const shaderRef = useRef<ProbeBlendShader | null>(null)
  const materialRef = useRef(material)
  const probeBlendRef = useRef(probeBlend)
  const patchConfigRef = useRef(patchConfig)

  materialRef.current = material
  probeBlendRef.current = probeBlend
  patchConfigRef.current = patchConfig

  const customProgramCacheKey = useMemo(
    () => () => {
      const currentPatchConfig = patchConfigRef.current
      const currentProbeBlend = probeBlendRef.current
      const usesTintedLightMap =
        Boolean(currentPatchConfig.lightMapAmbientTint) ||
        Boolean(currentPatchConfig.lightMapTorchTint)

      return [
        'probe-blend-v3',
        usesTintedLightMap ? 'lightmap-tint' : 'plain',
        currentProbeBlend.mode,
        currentProbeBlend.radianceMode ?? currentProbeBlend.mode
      ].join('-')
    },
    []
  )
  const onBeforeCompile = useMemo(
    () => (shader: Shader) => {
      const currentMaterial = materialRef.current

      if (!currentMaterial) {
        return
      }

      patchProbeBlendMaterialShader(
        currentMaterial,
        shader,
        probeBlendRef,
        patchConfigRef,
        shaderRef
      )
    },
    []
  )
  const onBeforeRender = useMemo(
    () => () => {
      const currentMaterial = materialRef.current

      updateProbeBlendMaterialDebugState(currentMaterial, probeBlendRef.current)
      updateProbeBlendShaderUniforms(
        shaderRef.current,
        probeBlendRef.current,
        patchConfigRef.current
      )
      updateProbeBlendUniformDebugState(currentMaterial, shaderRef.current)
    },
    []
  )

  useEffect(() => {
    shaderRef.current = null
  }, [materialKey])

  useEffect(() => {
    updateProbeBlendMaterialDebugState(material, probeBlend)
    updateProbeBlendShaderUniforms(shaderRef.current, probeBlend, patchConfig)
    updateProbeBlendUniformDebugState(material, shaderRef.current)
  }, [material, materialKey, patchConfig, probeBlend])

  return {
    customProgramCacheKey,
    onBeforeCompile,
    onBeforeRender
  }
}

function isTextureRenderable(texture: Texture | null | undefined) {
  if (!texture) {
    return false
  }

  const renderTargetTexture = texture as Texture & {
    isRenderTargetTexture?: boolean
    source?: {
      data?: unknown
    }
  }

  if (renderTargetTexture.isRenderTargetTexture) {
    return true
  }

  const image = texture.image ?? renderTargetTexture.source?.data

  if (!image) {
    return false
  }

  if (
    typeof HTMLImageElement !== 'undefined' &&
    image instanceof HTMLImageElement
  ) {
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  }

  if (
    typeof HTMLCanvasElement !== 'undefined' &&
    image instanceof HTMLCanvasElement
  ) {
    return image.width > 0 && image.height > 0
  }

  if (
    typeof ImageBitmap !== 'undefined' &&
    image instanceof ImageBitmap
  ) {
    return image.width > 0 && image.height > 0
  }

  if (
    typeof OffscreenCanvas !== 'undefined' &&
    image instanceof OffscreenCanvas
  ) {
    return image.width > 0 && image.height > 0
  }

  if (ArrayBuffer.isView(image)) {
    return image.byteLength > 0
  }

  if (
    typeof image === 'object' &&
    image !== null &&
    'width' in image &&
    'height' in image
  ) {
    return (
      typeof image.width === 'number' &&
      typeof image.height === 'number' &&
      image.width > 0 &&
      image.height > 0
    )
  }

  return true
}

function isMeshMaterialReady(
  mesh: Mesh,
  requirements: {
    aoMap?: boolean
    bumpMap?: boolean
    lightMap?: boolean
    map?: boolean
    metalnessMap?: boolean
    normalMap?: boolean
    roughnessMap?: boolean
  }
) {
  const materials = (
    Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
  ) as Array<{
    aoMap?: Texture | null
    bumpMap?: Texture | null
    lightMap?: Texture | null
    map?: Texture | null
    metalnessMap?: Texture | null
    normalMap?: Texture | null
    roughnessMap?: Texture | null
  }>

  return materials.every((material) => {
    if (requirements.map && !isTextureRenderable(material.map)) {
      return false
    }
    if (requirements.lightMap && !isTextureRenderable(material.lightMap)) {
      return false
    }
    if (requirements.aoMap && !isTextureRenderable(material.aoMap)) {
      return false
    }
    if (requirements.bumpMap && !isTextureRenderable(material.bumpMap)) {
      return false
    }
    if (requirements.metalnessMap && !isTextureRenderable(material.metalnessMap)) {
      return false
    }
    if (requirements.normalMap && !isTextureRenderable(material.normalMap)) {
      return false
    }
    if (requirements.roughnessMap && !isTextureRenderable(material.roughnessMap)) {
      return false
    }

    return true
  })
}

function getReflectionCaptureSceneState(scene: ThreeScene, layout: MazeLayout) {
  const expectedGroundPatchCount = buildGroundReflectionProbeRects(layout).length
  let groundPatchCount = 0
  let readyGroundPatchCount = 0
  let wallCount = 0
  let readyWallCount = 0
  let sconceCount = 0
  let readySconceCount = 0

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }

    if (object.userData?.debugRole === 'maze-ground-lightmap') {
      groundPatchCount += 1
      if (isMeshMaterialReady(object, {
        aoMap: true,
        bumpMap: true,
        lightMap: true,
        map: true,
        normalMap: true,
        roughnessMap: true
      })) {
        readyGroundPatchCount += 1
      }
      return
    }

    if (
      object.userData?.debugRole === 'maze-wall' ||
      (
        Array.isArray(object.userData?.debugRoles) &&
        object.userData.debugRoles.includes('maze-wall-lightmap')
      )
    ) {
      wallCount += 1
      if (isMeshMaterialReady(object, {
        aoMap: true,
        bumpMap: true,
        lightMap: true,
        map: true,
        normalMap: true,
        roughnessMap: true
      })) {
        readyWallCount += 1
      }
      return
    }

    if (object.userData?.debugRole === 'sconce-body') {
      sconceCount += 1
      if (isMeshMaterialReady(object, {
        bumpMap: true,
        map: true,
        metalnessMap: true,
        normalMap: true,
        roughnessMap: true
      })) {
        readySconceCount += 1
      }
    }
  })

  return (
    {
      expectedGroundPatchCount,
      groundPatchCount,
      readyGroundPatchCount,
      ready:
        groundPatchCount === expectedGroundPatchCount &&
        readyGroundPatchCount === expectedGroundPatchCount &&
        wallCount === layout.walls.length &&
        readyWallCount === layout.walls.length &&
        sconceCount === layout.lights.length &&
        readySconceCount === layout.lights.length,
      readySconceCount,
      readyWallCount,
      sconceCount,
      wallCount
    }
  )
}

function configureRepeatedTexture(
  texture: Texture,
  repeat: number,
  anisotropy: number,
  isColorMap = false
) {
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = anisotropy
  if (isColorMap) {
    texture.colorSpace = SRGBColorSpace
  }
  texture.needsUpdate = true
}

function createInvertedGrayscaleTexture(source: Texture) {
  const image = source.image as CanvasImageSource & {
    height: number
    width: number
  }
  const canvas = document.createElement('canvas')

  canvas.width = image.width
  canvas.height = image.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create roughness texture canvas context')
  }

  context.drawImage(image, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  for (let index = 0; index < imageData.data.length; index += 4) {
    imageData.data[index] = 255 - imageData.data[index]
    imageData.data[index + 1] = 255 - imageData.data[index + 1]
    imageData.data[index + 2] = 255 - imageData.data[index + 2]
  }

  context.putImageData(imageData, 0, 0)

  return new CanvasTexture(canvas)
}

function usePuddleTextures(repeat: number) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const sourceTextures = useLoader(TextureLoader, [
    PUDDLE_TEXTURE_URLS.color,
    PUDDLE_TEXTURE_URLS.normal,
    PUDDLE_TEXTURE_URLS.gloss,
    PUDDLE_TEXTURE_URLS.displacement,
    PUDDLE_TEXTURE_URLS.ao
  ]) as [Texture, Texture, Texture, Texture, Texture]
  const textures = useMemo(
    () => sourceTextures.map((texture) => texture.clone()) as [Texture, Texture, Texture, Texture, Texture],
    [sourceTextures]
  )
  const roughnessTexture = useMemo(
    () => createInvertedGrayscaleTexture(textures[2]),
    [textures]
  )

  useEffect(() => {
    const anisotropy = Math.min(maxAnisotropy, 8)
    configureRepeatedTexture(textures[0], repeat, anisotropy, true)
    configureRepeatedTexture(textures[1], repeat, anisotropy)
    configureRepeatedTexture(textures[3], repeat, anisotropy)
    configureRepeatedTexture(textures[4], repeat, anisotropy)
    configureRepeatedTexture(roughnessTexture, repeat, anisotropy)
  }, [maxAnisotropy, repeat, roughnessTexture, textures])

  useEffect(
    () => () => {
      for (const texture of textures) {
        texture.dispose()
      }
      roughnessTexture.dispose()
    },
    [roughnessTexture, textures]
  )

  return {
    aoMap: textures[4],
    bumpMap: textures[3],
    map: textures[0],
    normalMap: textures[1],
    roughnessMap: roughnessTexture
  } satisfies PbrMaps
}

function useStandardPbrTextures(urls: StandardPbrTextureUrls, repeat: number) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const textureOrder = useMemo(
    () =>
      [
        ['ao', urls.ao],
        ['color', urls.color],
        ['height', urls.height],
        ['metallic', urls.metallic],
        ['normal', urls.normal],
        ['roughness', urls.roughness]
      ].filter((entry): entry is [keyof StandardPbrTextureUrls, string] => Boolean(entry[1])),
    [urls]
  )
  const textures = useLoader(
    TextureLoader,
    textureOrder.map((entry) => entry[1])
  ) as Texture[]
  const keyedTextures = useMemo(() => {
    const entries = textureOrder.map(([key], index) => [key, textures[index]])
    return Object.fromEntries(entries) as Partial<Record<keyof StandardPbrTextureUrls, Texture>>
  }, [textureOrder, textures])

  useEffect(() => {
    const anisotropy = Math.min(maxAnisotropy, 8)
    for (const [key, texture] of Object.entries(keyedTextures)) {
      configureRepeatedTexture(texture, repeat, anisotropy, key === 'color')
    }
  }, [keyedTextures, maxAnisotropy, repeat])

  return {
    aoMap: keyedTextures.ao,
    bumpMap: keyedTextures.height,
    map: keyedTextures.color!,
    metalnessMap: keyedTextures.metallic,
    normalMap: keyedTextures.normal,
    roughnessMap: keyedTextures.roughness
  } satisfies PbrMaps
}

function useFireFlipbookTexture() {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const texture = useLoader(TextureLoader, FIRE_FLIPBOOK_URL)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(
      FIRE_FLIPBOOK_CROP_WIDTH / FIRE_FLIPBOOK_GRID,
      FIRE_FLIPBOOK_CROP_HEIGHT / FIRE_FLIPBOOK_GRID
    )
    texture.offset.set(
      FIRE_FLIPBOOK_FRAME_CROP.minX / FIRE_FLIPBOOK_GRID,
      1 -
        ((1 + FIRE_FLIPBOOK_FRAME_CROP.maxY) / FIRE_FLIPBOOK_GRID)
    )
    texture.anisotropy = Math.min(maxAnisotropy, 8)
    texture.needsUpdate = true
  }, [maxAnisotropy, texture])

  return texture
}

function decodeBase64Bytes(base64: string) {
  const decoded = window.atob(base64)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return bytes
}

function useMazeLightmapBytes(lightmap: MazeLightmap) {
  return useMemo(
    () => decodeBase64Bytes(lightmap.dataBase64),
    [lightmap]
  )
}

function useGroundLightmapTexture(
  lightmap: MazeLightmap,
  lightmapBytes: Uint8Array
) {
  const texture = useMemo(
    () => createLightmapFaceTexture(lightmapBytes, lightmap.atlasWidth, lightmap.groundRect),
    [lightmap, lightmapBytes]
  )

  texture.channel = 1

  useEffect(
    () => () => {
      texture.dispose()
    },
    [texture]
  )

  return texture
}

function createLightmapFaceTexture(
  data: Uint8Array,
  atlasWidth: number,
  rect: LightmapRect,
  options: {
    flipY?: boolean
    mirrorX?: boolean
  } = {}
) {
  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create 2D context for wall lightmap face texture')
  }

  const image = context.createImageData(rect.width, rect.height)

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const sourceColumn = options.mirrorX
        ? (rect.width - 1 - column)
        : column
      const atlasIndex =
        ((((rect.y + row) * atlasWidth) + rect.x + sourceColumn) * 3)
      const pixelIndex = ((row * rect.width) + column) * 4

      image.data[pixelIndex] = data[atlasIndex]
      image.data[pixelIndex + 1] = data[atlasIndex + 1]
      image.data[pixelIndex + 2] = data[atlasIndex + 2]
      image.data[pixelIndex + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.flipY = options.flipY ?? true
  texture.generateMipmaps = true
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function createGroundPatchGeometry(
  rect: GroundPatchRect,
  groundBounds: MazeLightmap['groundBounds']
) {
  const geometry = new PlaneGeometry(rect.width, rect.depth, 1, 1)
  const positions = geometry.getAttribute('position')
  const mapUvs: number[] = []
  const lightmapUvs: number[] = []

  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index)
    const localY = positions.getY(index)
    const worldX = rect.centerX + localX
    const worldZ = rect.centerZ - localY
    const mapU = (worldX + (GROUND_SIZE / 2)) / GROUND_SIZE
    const mapV = 1 - ((worldZ + (GROUND_SIZE / 2)) / GROUND_SIZE)
    const lightmapU = (worldX - groundBounds.minX) / groundBounds.width
    const lightmapV = 1 - ((worldZ - groundBounds.minZ) / groundBounds.depth)

    mapUvs.push(mapU, mapV)
    lightmapUvs.push(lightmapU, lightmapV)
  }

  geometry.setAttribute('uv', new Float32BufferAttribute(mapUvs, 2))
  geometry.setAttribute('uv1', new Float32BufferAttribute(lightmapUvs, 2))
  return geometry
}

function createWallGeometry() {
  const geometry = new BoxGeometry(WALL_LENGTH, WALL_HEIGHT, WALL_WIDTH)
  const uv = geometry.getAttribute('uv')

  geometry.setAttribute('uv1', uv.clone())
  return geometry
}

function useWallLightmapTextures(
  lightmap: MazeLightmap,
  lightmapBytes: Uint8Array,
  wallId: string
) {
  const textures = useMemo(() => {
    const rects = lightmap.wallRects[wallId]

    return {
      neutral: createLightmapFaceTexture(
        lightmapBytes,
        lightmap.atlasWidth,
        lightmap.neutralRect
      ),
      // BoxGeometry's local -Z face UVs are mirrored horizontally relative to +Z.
      nz: createLightmapFaceTexture(lightmapBytes, lightmap.atlasWidth, rects.nz, {
        flipY: false,
        mirrorX: true
      }),
      pz: createLightmapFaceTexture(lightmapBytes, lightmap.atlasWidth, rects.pz, {
        flipY: false
      })
    }
  }, [lightmap, lightmapBytes, wallId])

  textures.neutral.channel = 1
  textures.nz.channel = 1
  textures.pz.channel = 1

  useEffect(
    () => () => {
      textures.neutral.dispose()
      textures.nz.dispose()
      textures.pz.dispose()
    },
    [textures]
  )

  return textures
}

function createWallMaterialContinuumStepMaterial(
  sourceMaterial: ThreeMeshStandardMaterial,
  step: WallMaterialContinuumStepKey
) {
  if (step === 'basic-white') {
    return new MeshBasicMaterial({
      color: 'white',
      side: sourceMaterial.side
    })
  }

  if (step === 'basic-albedo') {
    return new MeshBasicMaterial({
      color: 'white',
      map: sourceMaterial.map ?? null,
      side: sourceMaterial.side
    })
  }

  const material = new ThreeMeshStandardMaterial({
    color:
      step === 'standard-white'
        ? WHITE_COLOR.clone()
        : sourceMaterial.color.clone(),
    envMap:
      step === 'standard-white' ||
      step === 'standard-albedo' ||
      step === 'standard-surface' ||
      step === 'standard-surface-ao' ||
      step === 'standard-surface-lightmap' ||
      step === 'standard-surface-lightmap-patch'
        ? sourceMaterial.envMap ?? null
        : null,
    envMapIntensity:
      step === 'standard-white' ||
      step === 'standard-albedo' ||
      step === 'standard-surface' ||
      step === 'standard-surface-ao' ||
      step === 'standard-surface-lightmap' ||
      step === 'standard-surface-lightmap-patch'
        ? sourceMaterial.envMapIntensity
        : 0,
    metalness: sourceMaterial.metalness,
    roughness: sourceMaterial.roughness,
    side: sourceMaterial.side
  })

  if (
    step === 'standard-albedo' ||
    step === 'standard-surface' ||
    step === 'standard-surface-ao' ||
    step === 'standard-surface-lightmap' ||
    step === 'standard-surface-lightmap-patch'
  ) {
    material.map = sourceMaterial.map ?? null
  }

  if (
    step === 'standard-surface' ||
    step === 'standard-surface-ao' ||
    step === 'standard-surface-lightmap' ||
    step === 'standard-surface-lightmap-patch'
  ) {
    material.bumpMap = sourceMaterial.bumpMap ?? null
    material.bumpScale = sourceMaterial.bumpScale
    material.metalnessMap = sourceMaterial.metalnessMap ?? null
    material.normalMap = sourceMaterial.normalMap ?? null
    material.normalScale.copy(sourceMaterial.normalScale)
    material.roughnessMap = sourceMaterial.roughnessMap ?? null
  }

  if (
    step === 'standard-surface-ao' ||
    step === 'standard-surface-lightmap' ||
    step === 'standard-surface-lightmap-patch'
  ) {
    material.aoMap = sourceMaterial.aoMap ?? null
    material.aoMapIntensity = sourceMaterial.aoMapIntensity
  }

  if (
    step === 'standard-surface-lightmap' ||
    step === 'standard-surface-lightmap-patch'
  ) {
    material.lightMap = sourceMaterial.lightMap ?? null
    material.lightMapIntensity = sourceMaterial.lightMapIntensity
  }

  if (step === 'standard-surface-lightmap-patch') {
    attachProbeBlendMaterialShader(
      material,
      {
        mode: 'none',
        probeTextures: [null, null, null, null],
        radianceMode: 'none'
      },
      {
        lightMapAmbientTint: WHITE_COLOR,
        lightMapTorchTint: TORCH_LIGHTMAP_TINT
      },
      { current: null }
    )
  }

  return material
}

function getWallMaterialContinuumSteps() {
  return [
    { key: 'basic-white', label: '01-basic-white' },
    { key: 'basic-albedo', label: '02-basic-albedo' },
    { key: 'standard-white', label: '03-standard-white' },
    { key: 'standard-albedo', label: '04-standard-albedo' },
    { key: 'standard-surface', label: '05-standard-surface' },
    { key: 'standard-surface-ao', label: '06-standard-surface-ao' },
    { key: 'standard-surface-lightmap', label: '07-standard-surface-lightmap' },
    { key: 'standard-surface-lightmap-patch', label: '08-standard-surface-lightmap-patch' },
    { key: 'runtime-original', label: '09-runtime-original' }
  ] satisfies Array<{
    key: WallMaterialContinuumStepKey
    label: string
  }>
}

function LoadingOverlay({
  complete
}: {
  complete: boolean
}) {
  const [dotCount, setDotCount] = useState(1)
  const [minimumDisplayElapsed, setMinimumDisplayElapsed] = useState(false)
  const dots = '.'.repeat(dotCount)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMinimumDisplayElapsed(true)
    }, MIN_LOADING_OVERLAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (complete) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setDotCount((current) => (current % 3) + 1)
    }, LOADING_DOT_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [complete])

  const visiblyComplete = complete && minimumDisplayElapsed

  return (
    <div
      aria-hidden={visiblyComplete}
      className={`loading-overlay${visiblyComplete ? ' loading-overlay-hidden' : ''}`}
      data-loading-complete={visiblyComplete ? 'true' : 'false'}
    >
      <h1>MINOTAUR</h1>
      <h2>
        <span>Entering the labyrinth</span>
        <span
          aria-hidden="true"
          className="loading-overlay-dots"
        >
          {dots}
        </span>
      </h2>
    </div>
  )
}

function RendererSettings({
  composerEnabled,
  exposureStops,
  toneMapping
}: {
  composerEnabled: boolean
  exposureStops: number
  toneMapping: ToneMappingMode
}) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const exposure = getRendererExposure(exposureStops)

    gl.toneMapping = composerEnabled
      ? NoToneMapping
      : RENDERER_TONE_MAPPING_MODES[toneMapping]
    gl.toneMappingExposure = composerEnabled ? 1 : exposure
    gl.domElement.dataset.rendererExposure = exposure.toFixed(6)
    gl.domElement.dataset.rendererExposureStops = exposureStops.toFixed(2)
    gl.domElement.dataset.toneMapping = toneMapping
  }, [composerEnabled, exposureStops, gl, toneMapping])

  return null
}

function FpsReporter({
  onSample
}: {
  onSample: (value: number) => void
}) {
  const elapsed = useRef(0)
  const frames = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    frames.current += 1

    if (elapsed.current < 0.5) {
      return
    }

    onSample(frames.current / elapsed.current)
    elapsed.current = 0
    frames.current = 0
  })

  return null
}

function StartupReporter() {
  const gl = useThree((state) => state.gl)
  const hasMarkedReady = useRef(false)

  useEffect(() => {
    gl.domElement.dataset.sceneReady = 'false'
    delete gl.domElement.dataset.sceneReadyAt
  }, [gl])

  useFrame(() => {
    if (hasMarkedReady.current) {
      return
    }

    hasMarkedReady.current = true
    gl.domElement.dataset.sceneReady = 'true'
    gl.domElement.dataset.sceneReadyAt = performance.now().toFixed(1)
  })

  return null
}

function EnvironmentLighting({
  layout,
  iblIntensity,
  onEnvironmentFogColorChange,
  onEnvironmentTextureChange,
  onReflectionProbeAmbientColorsChange,
  onReflectionProbeRawTexturesChange,
  onReflectionProbeTexturesChange
}: {
  layout: MazeLayout
  iblIntensity: number
  onEnvironmentFogColorChange: (color: Color) => void
  onEnvironmentTextureChange: (texture: Texture | null) => void
  onReflectionProbeAmbientColorsChange: (colors: Color[]) => void
  onReflectionProbeRawTexturesChange: (textures: Texture[]) => void
  onReflectionProbeTexturesChange: (textures: Texture[]) => void
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const hdrTexture = useLoader(HDRLoader, ENVIRONMENT_URL)
  const pmremGenerator = useMemo(() => new PMREMGenerator(gl), [gl])
  const environmentTarget = useRef<{ dispose: () => void; texture: Texture } | null>(null)
  const reflectionProbeRawTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const reflectionProbeTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const calibratedIntensity = getHdrLightingIntensity(iblIntensity)
  const fogAmbientColor = useMemo(
    () => computeAverageHdrColor(hdrTexture, calibratedIntensity),
    [calibratedIntensity, hdrTexture]
  )

  useEffect(() => {
    const captureSceneState = getReflectionCaptureSceneState(scene, layout)

    scene.userData.reflectionProbeState = {
      activeProbeId: null,
      captureSceneState,
      probeCaptureCounts: [],
      probeMetrics: [],
      probeRawMetrics: [],
      probeRawReadbackErrors: [],
      probeRawTextureSummaries: [],
      probeCount: layout.reflectionProbes.length,
      ready: false
    }
    onEnvironmentFogColorChange(DEFAULT_FOG_IBL_COLOR.clone())
    onEnvironmentTextureChange(null)
    onReflectionProbeAmbientColorsChange([])
    onReflectionProbeRawTexturesChange([])
    onReflectionProbeTexturesChange([])

    return () => {
      delete scene.userData.reflectionProbeState
      onEnvironmentFogColorChange(DEFAULT_FOG_IBL_COLOR.clone())
      onEnvironmentTextureChange(null)
      onReflectionProbeAmbientColorsChange([])
      onReflectionProbeRawTexturesChange([])
      onReflectionProbeTexturesChange([])
    }
  }, [
    layout.reflectionProbes.length,
    onEnvironmentFogColorChange,
    onEnvironmentTextureChange,
    onReflectionProbeAmbientColorsChange,
    onReflectionProbeRawTexturesChange,
    onReflectionProbeTexturesChange,
    scene
  ])

  useEffect(() => {
    hdrTexture.mapping = EquirectangularReflectionMapping
    pmremGenerator.compileEquirectangularShader()
    const nextEnvironment = pmremGenerator.fromEquirectangular(hdrTexture)

    environmentTarget.current = nextEnvironment
    scene.background = hdrTexture
    scene.environment = nextEnvironment.texture
    scene.backgroundIntensity = calibratedIntensity
    scene.environmentIntensity = calibratedIntensity
    onEnvironmentFogColorChange(fogAmbientColor.clone())
    onEnvironmentTextureChange(nextEnvironment.texture)

    return () => {
      if (scene.background === hdrTexture) {
        scene.background = null
      }
      if (scene.environment === nextEnvironment.texture) {
        scene.environment = null
      }
      nextEnvironment.dispose()
      environmentTarget.current = null
      pmremGenerator.dispose()
      onEnvironmentFogColorChange(DEFAULT_FOG_IBL_COLOR.clone())
      onEnvironmentTextureChange(null)
    }
  }, [
    fogAmbientColor,
    gl,
    hdrTexture,
    onEnvironmentFogColorChange,
    onEnvironmentTextureChange,
    pmremGenerator,
    scene
  ])

  useEffect(() => {
    scene.backgroundIntensity = calibratedIntensity
  }, [calibratedIntensity, scene])

  useEffect(() => {
    const baseEnvironment = environmentTarget.current

    if (!baseEnvironment) {
      return undefined
    }

    const probeCount = layout.reflectionProbes.length
    const spawnPosition = getPlayerSpawnPosition()
    const startupProbeIndices = Array.from(
      new Set(
        (() => {
          const prioritizedProbeIndices = getReflectionProbeBlendForPosition(
            layout,
            {
              x: spawnPosition.x,
              z: spawnPosition.z
            }
          ).probeIndices.filter(
            (probeIndex) =>
              Number.isInteger(probeIndex) &&
              probeIndex >= 0 &&
              probeIndex < probeCount
          )
          let nearestProbeIndex = 0
          let nearestProbeDistanceSquared = Number.POSITIVE_INFINITY

          layout.reflectionProbes.forEach((probe, probeIndex) => {
            const dx = probe.position.x - spawnPosition.x
            const dz = probe.position.z - spawnPosition.z
            const distanceSquared = (dx * dx) + (dz * dz)

            if (distanceSquared < nearestProbeDistanceSquared) {
              nearestProbeDistanceSquared = distanceSquared
              nearestProbeIndex = probeIndex
            }
          })

          return [...prioritizedProbeIndices, nearestProbeIndex]
        })()
      )
    )
    const previousTargets = reflectionProbeTargets.current
    const previousRawTargets = reflectionProbeRawTargets.current
    reflectionProbeRawTargets.current = []
    reflectionProbeTargets.current = []
    const previousBackground = scene.background
    const previousBackgroundIntensity = scene.backgroundIntensity
    const previousEnvironment = scene.environment
    const previousEnvironmentIntensity = scene.environmentIntensity
    const emptyTextureArray = new Array<Texture>(probeCount)
    const emptyAmbientColorArray = new Array<Color>(probeCount)

    if (scene.environment !== baseEnvironment.texture) {
      scene.environment = baseEnvironment.texture
    }
    scene.environmentIntensity = calibratedIntensity
    onReflectionProbeAmbientColorsChange(emptyAmbientColorArray)
    onReflectionProbeRawTexturesChange(emptyTextureArray)
    onReflectionProbeTexturesChange(emptyTextureArray)

    let nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
    let nextRawTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
    let nextProbeCaptureCounts = new Array<{
      billboard: number
      ground: number
      sconce: number
      wall: number
    } | null>(probeCount).fill(null)
    let nextProbeAmbientColors = new Array<Color>(probeCount)
    let nextProbeMetrics = new Array<ProbeMetric | null>(probeCount).fill(null)
    let nextProbeRawMetrics = new Array<ProbeMetric | null>(probeCount).fill(null)
    let nextProbeRawReadbackErrors = new Array<string | null>(probeCount).fill(null)
    let nextProbeRawTextureSummaries = new Array<ProbeTextureSummary | null>(probeCount).fill(null)
    let cancelled = false
    let bakeHandle = 0
    const buildReflectionProbeState = (
      captureSceneState: ReturnType<typeof getReflectionCaptureSceneState>
    ) => {
      const loadedProbeCount = nextTargets.reduce(
        (count, target) => count + Number(Boolean(target)),
        0
      )

      return {
        activeProbeId: null,
        captureSceneState,
        complete: loadedProbeCount === probeCount,
        loadedProbeCount,
        priorityProbeIndices: [...startupProbeIndices],
        probeCaptureCounts: nextProbeCaptureCounts.map((counts) => (
          counts
            ? { ...counts }
            : null
        )),
        probeCount,
        probeMetrics: nextProbeMetrics.map((metric) => (
          metric
            ? { ...metric }
            : null
        )),
        probeRawMetrics: nextProbeRawMetrics.map((metric) => (
          metric
            ? { ...metric }
            : null
        )),
        probeRawReadbackErrors: [...nextProbeRawReadbackErrors],
        probeRawTextureSummaries: nextProbeRawTextureSummaries.map((summary) => (
          summary
            ? { ...summary }
            : null
        )),
        probeRawTextureUUIDs: nextRawTargets.map((target) => target?.texture.uuid ?? null),
        probeTextureUUIDs: nextTargets.map((target) => target?.texture.uuid ?? null),
        ready:
          startupProbeIndices.length > 0 &&
          startupProbeIndices.every((probeIndex) => Boolean(nextTargets[probeIndex]))
      }
    }

    scene.userData.reflectionProbeState = buildReflectionProbeState(
      getReflectionCaptureSceneState(scene, layout)
    )

    const disposeProbeTargets = (
      targets: Array<{ dispose: () => void; texture: Texture }>
    ) => {
      for (const target of targets) {
        if (!target) {
          continue
        }

        target.dispose()
      }
    }

    const publishReflectionProbeState = (captureSceneState: ReturnType<typeof getReflectionCaptureSceneState>) => {
      const publishedAmbientColors = new Array<Color>(probeCount)
      const publishedRawTextures = new Array<Texture>(probeCount)
      const publishedTextures = new Array<Texture>(probeCount)

      for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
        const ambientColor = nextProbeAmbientColors[probeIndex]
        const rawTarget = nextRawTargets[probeIndex]
        const target = nextTargets[probeIndex]

        if (ambientColor) {
          publishedAmbientColors[probeIndex] = ambientColor.clone()
        }
        if (rawTarget) {
          publishedRawTextures[probeIndex] = rawTarget.texture
        }
        if (target) {
          publishedTextures[probeIndex] = target.texture
        }
      }

      reflectionProbeRawTargets.current = nextRawTargets
      reflectionProbeTargets.current = nextTargets
      onReflectionProbeAmbientColorsChange(publishedAmbientColors)
      onReflectionProbeRawTexturesChange(publishedRawTextures)
      onReflectionProbeTexturesChange(publishedTextures)
      scene.userData.reflectionProbeState = buildReflectionProbeState(captureSceneState)
    }

    const restoreScene = (
      hiddenObjects: Array<{ object: { visible: boolean }; visible: boolean }>
    ) => {
      for (const entry of hiddenObjects) {
        entry.object.visible = entry.visible
      }
      scene.background = previousBackground
      scene.backgroundIntensity = previousBackgroundIntensity
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousEnvironmentIntensity
    }

    const attemptBake = () => {
      if (cancelled) {
        return
      }

      const captureSceneState = getReflectionCaptureSceneState(scene, layout)
      scene.userData.reflectionProbeState = buildReflectionProbeState(captureSceneState)

      if (!captureSceneState.ready) {
        bakeHandle = window.setTimeout(attemptBake, 50)
        return
      }

      const hiddenObjects: Array<{ object: { visible: boolean }; visible: boolean }> = []
      scene.traverse((object) => {
        if (
          object.userData?.debugRole === 'torch-lens-flare' ||
          object.userData?.debugRole === 'global-fog-volume' ||
          object.userData?.debugRole === 'reflection-probe-visual'
        ) {
          hiddenObjects.push({ object, visible: object.visible })
          object.visible = false
        }
      })

      scene.environment = baseEnvironment.texture
      scene.environmentIntensity = calibratedIntensity

      const probeCaptureSize = getPmremCubeSize(baseEnvironment.texture)
      const probeCaptureOrder = [
        ...startupProbeIndices,
        ...layout.reflectionProbes
          .map((_, probeIndex) => probeIndex)
          .filter((probeIndex) => !startupProbeIndices.includes(probeIndex))
      ]
      let captureOrderIndex = 0

      nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
      nextRawTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
      nextProbeCaptureCounts = new Array<{
        billboard: number
        ground: number
        sconce: number
        wall: number
      } | null>(probeCount).fill(null)
      nextProbeAmbientColors = new Array<Color>(probeCount)
      nextProbeMetrics = new Array<ProbeMetric | null>(probeCount).fill(null)
      nextProbeRawMetrics = new Array<ProbeMetric | null>(probeCount).fill(null)
      nextProbeRawReadbackErrors = new Array<string | null>(probeCount).fill(null)
      nextProbeRawTextureSummaries = new Array<ProbeTextureSummary | null>(probeCount).fill(null)

      const captureProbe = (probeIndex: number) => {
        const probe = layout.reflectionProbes[probeIndex]
        const cubeRenderTarget = new WebGLCubeRenderTarget(
          probeCaptureSize,
          { type: HalfFloatType }
        )
        const ambientCubeRenderTarget = new WebGLCubeRenderTarget(
          REFLECTION_PROBE_AMBIENT_RENDER_SIZE,
          { type: UnsignedByteType }
        )
        const cubeCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, cubeRenderTarget)
        const ambientCubeCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, ambientCubeRenderTarget)
        const captureCounts = {
          billboard: 0,
          ground: 0,
          sconce: 0,
          wall: 0
        }
        const originalMeshCallbacks: Array<{
          mesh: Mesh
          onBeforeRender: Mesh['onBeforeRender']
        }> = []

        cubeCamera.position.set(
          probe.position.x,
          probe.position.y,
          probe.position.z
        )
        cubeCamera.layers.enable(TORCH_BILLBOARD_LAYER)
        ambientCubeCamera.position.copy(cubeCamera.position)
        ambientCubeCamera.layers.enable(TORCH_BILLBOARD_LAYER)
        scene.traverse((object) => {
          if (!(object instanceof Mesh)) {
            return
          }

          const countKey = getReflectionCaptureCountKey(object)

          if (!countKey) {
            return
          }

          const originalOnBeforeRender = object.onBeforeRender

          originalMeshCallbacks.push({
            mesh: object,
            onBeforeRender: originalOnBeforeRender
          })
          object.onBeforeRender = function (...args) {
            const activeCamera = args[2] as ThreeCamera

            if (activeCamera.parent === cubeCamera) {
              captureCounts[countKey] += 1
            }

            originalOnBeforeRender.apply(this, args)
          }
        })
        scene.add(cubeCamera)
        cubeCamera.update(gl, scene)
        scene.remove(cubeCamera)
        scene.add(ambientCubeCamera)
        ambientCubeCamera.update(gl, scene)
        scene.remove(ambientCubeCamera)
        for (const entry of originalMeshCallbacks) {
          entry.mesh.onBeforeRender = entry.onBeforeRender
        }

        nextTargets[probeIndex] = pmremGenerator.fromCubemap(cubeRenderTarget.texture)
        nextRawTargets[probeIndex] = cubeRenderTarget
        nextProbeCaptureCounts[probeIndex] = { ...captureCounts }
        const probeDebugStats = computeCubeRenderTargetDebugStats(gl, ambientCubeRenderTarget)
        let rawProbeDebugStats: ProbeMetric | null = null
        let rawProbeReadbackError: string | null = null

        if (isCubeRenderTargetReadbackSupported(cubeRenderTarget)) {
          try {
            rawProbeDebugStats = computeCubeRenderTargetDebugStats(gl, cubeRenderTarget)
          } catch (error) {
            rawProbeReadbackError =
              error instanceof Error
                ? error.message
                : String(error)
          }
        } else {
          rawProbeReadbackError =
            `three.js WebGL readRenderTargetPixels only supports UnsignedByteType targets; raw probe target type ${cubeRenderTarget.texture.type} is not directly readable`
        }

        nextProbeAmbientColors[probeIndex] = probeDebugStats.averageColor
        nextProbeMetrics[probeIndex] = {
          darkest: probeDebugStats.darkest,
          faceCenterColors: probeDebugStats.faceCenterColors.map((color) => ({ ...color })),
          faceGridColors: probeDebugStats.faceGridColors.map((face) =>
            face.map((color) => ({ ...color }))
          ),
          luminanceStdDev: probeDebugStats.luminanceStdDev,
          nonWhiteFraction: probeDebugStats.nonWhiteFraction,
          warmFraction: probeDebugStats.warmFraction
        }
        nextProbeRawMetrics[probeIndex] =
          rawProbeDebugStats
            ? {
                darkest: rawProbeDebugStats.darkest,
                faceCenterColors: rawProbeDebugStats.faceCenterColors.map((color) => ({ ...color })),
                faceGridColors: rawProbeDebugStats.faceGridColors.map((face) =>
                  face.map((color) => ({ ...color }))
                ),
                luminanceStdDev: rawProbeDebugStats.luminanceStdDev,
                nonWhiteFraction: rawProbeDebugStats.nonWhiteFraction,
                warmFraction: rawProbeDebugStats.warmFraction
              }
            : null
        nextProbeRawReadbackErrors[probeIndex] = rawProbeReadbackError
        nextProbeRawTextureSummaries[probeIndex] = {
          ...getCubeTextureFaceSize(cubeRenderTarget.texture),
          colorSpace:
            typeof cubeRenderTarget.texture.colorSpace === 'string'
              ? cubeRenderTarget.texture.colorSpace
              : null,
          generateMipmaps: cubeRenderTarget.texture.generateMipmaps,
          magFilter: cubeRenderTarget.texture.magFilter,
          mapping: cubeRenderTarget.texture.mapping,
          minFilter: cubeRenderTarget.texture.minFilter,
          type: cubeRenderTarget.texture.type
        }
        ambientCubeRenderTarget.dispose()
      }

      const finishBake = () => {
        restoreScene(hiddenObjects)

        if (cancelled) {
          disposeProbeTargets(nextTargets)
          disposeProbeTargets(nextRawTargets)
          nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
          nextRawTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
          return
        }

        disposeProbeTargets(previousTargets)
        disposeProbeTargets(previousRawTargets)
        publishReflectionProbeState(getReflectionCaptureSceneState(scene, layout))
      }

      const bakeNextProbe = () => {
        if (cancelled) {
          finishBake()
          return
        }

        const probeIndex = probeCaptureOrder[captureOrderIndex]

        if (probeIndex === undefined) {
          finishBake()
          return
        }

        captureOrderIndex += 1
        captureProbe(probeIndex)
        publishReflectionProbeState(captureSceneState)
        bakeHandle = window.setTimeout(
          bakeNextProbe,
          startupProbeIndices.every((startupProbeIndex) => Boolean(nextTargets[startupProbeIndex]))
            ? 500
            : 0
        )
      }

      bakeNextProbe()
    }
    bakeHandle = window.setTimeout(attemptBake, 0)

    return () => {
      cancelled = true
      window.clearTimeout(bakeHandle)
      disposeProbeTargets(nextTargets)
      disposeProbeTargets(nextRawTargets)
      disposeProbeTargets(previousRawTargets)
      disposeProbeTargets(previousTargets)
      onReflectionProbeAmbientColorsChange([])
      onReflectionProbeRawTexturesChange([])
      onReflectionProbeTexturesChange([])
      scene.background = previousBackground
      scene.backgroundIntensity = previousBackgroundIntensity
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousEnvironmentIntensity
      if (scene.environment !== baseEnvironment.texture) {
        scene.environment = baseEnvironment.texture
      }
      scene.environmentIntensity = calibratedIntensity
      scene.userData.reflectionProbeState = {
        activeProbeId: null,
        captureSceneState: getReflectionCaptureSceneState(scene, layout),
        complete: false,
        loadedProbeCount: 0,
        priorityProbeIndices: [...startupProbeIndices],
        probeCaptureCounts: [],
        probeMetrics: [],
        probeRawMetrics: [],
        probeRawReadbackErrors: [],
        probeRawTextureSummaries: [],
        probeCount,
        ready: false
      }
    }
  }, [
    gl,
    hdrTexture,
    layout.lights,
    layout.reflectionProbes,
    onReflectionProbeAmbientColorsChange,
    onReflectionProbeRawTexturesChange,
    onReflectionProbeTexturesChange,
    pmremGenerator,
    calibratedIntensity,
    scene
  ])

  return null
}

function GroundSurfaceMaterial({
  globalEnvMap,
  globalEnvMapIntensity = 1,
  lightMap,
  lightMapIntensity,
  maps,
  patchConfig,
  probeBlend
}: {
  globalEnvMap?: Texture | null
  globalEnvMapIntensity?: number
  lightMap?: Texture
  lightMapIntensity?: number
  maps: PbrMaps
  patchConfig?: MaterialShaderPatchConfig
  probeBlend?: ProbeBlendConfig
}) {
  const [material, setMaterial] = useState<ThreeMeshPhysicalMaterial | null>(null)
  const normalizedProbeBlend = useMemo(
    () => probeBlend ?? { mode: 'none', probeTextures: [] },
    [probeBlend]
  )
  const resolvedPatchConfig = useMemo(
    () => ({
      ...patchConfig,
      lightMapAmbientTint: BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT,
      ...patchConfig
    }),
    [patchConfig]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('ground-surface', normalizedProbeBlend, resolvedPatchConfig),
    [normalizedProbeBlend, resolvedPatchConfig]
  )

  const probeBlendMaterialProps = useProbeBlendMaterialShader(
    material,
    normalizedProbeBlend,
    resolvedPatchConfig,
    materialKey
  )

  return (
    <meshPhysicalMaterial
      {...maps}
      bumpScale={0.08}
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={globalEnvMap ?? null}
      envMapIntensity={globalEnvMapIntensity}
      key={materialKey}
      lightMap={lightMap}
      lightMapIntensity={lightMapIntensity}
      metalness={0}
      onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
      onBeforeRender={probeBlendMaterialProps.onBeforeRender}
      ref={setMaterial}
      roughness={0.18}
    />
  )
}

function GroundPatchMesh({
  bakedLightmapsEnabled,
  debugIndex,
  environmentTexture,
  environmentIntensity,
  groundBounds,
  groundLightmapTexture,
  maps,
  probeBlend,
  rect,
  torchCandelaMultiplier
}: {
  bakedLightmapsEnabled: boolean
  debugIndex: number
  environmentTexture: Texture | null
  environmentIntensity: number
  groundBounds: MazeLightmap['groundBounds']
  groundLightmapTexture: Texture
  maps: PbrMaps
  probeBlend: ProbeBlendConfig
  rect: GroundPatchRect
  torchCandelaMultiplier: number
}) {
  const geometry = useMemo(
    () => createGroundPatchGeometry(rect, groundBounds),
    [groundBounds, rect]
  )

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry]
  )
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        bakedLightmapsEnabled && probeBlend.mode !== 'world'
          ? WHITE_COLOR
          : BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [bakedLightmapsEnabled, probeBlend.mode]
  )

  return (
    <mesh
      position={[rect.centerX, GROUND_Y + MAZE_GROUND_PATCH_OFFSET_Y, rect.centerZ]}
      receiveShadow
      rotation-x={-Math.PI / 2}
      userData={{ debugIndex, debugRole: 'maze-ground-lightmap' }}
    >
      <primitive
        attach="geometry"
        object={geometry}
      />
      <GroundSurfaceMaterial
        globalEnvMap={environmentTexture}
        globalEnvMapIntensity={environmentIntensity}
        lightMap={bakedLightmapsEnabled ? groundLightmapTexture : undefined}
        lightMapIntensity={
          bakedLightmapsEnabled
            ? torchCandelaMultiplier * FLOOR_LIGHTMAP_INTENSITY_SCALE
            : 0
        }
        maps={maps}
        patchConfig={patchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function Ground({
  bakedLightmapsEnabled,
  environmentTexture,
  environmentIntensity,
  layout,
  groundLightmapTexture,
  probeIblEnabled,
  reflectionCapturesEnabled,
  reflectionProbeTextures,
  torchCandelaMultiplier
}: {
  bakedLightmapsEnabled: boolean
  environmentTexture: Texture | null
  environmentIntensity: number
  layout: MazeLayout
  groundLightmapTexture: Texture
  probeIblEnabled: boolean
  reflectionCapturesEnabled: boolean
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
}) {
  const puddle = usePuddleTextures(PUDDLE_TEXTURE_REPEAT)
  const groundPatchRects = useMemo(
    () => buildGroundReflectionProbeRects(layout) as GroundPatchRect[],
    [layout]
  )

  return (
    <>
      <mesh
        position={[0, GROUND_Y, 0]}
        receiveShadow
        rotation-x={-Math.PI / 2}
        userData={{ debugIndex: 0, debugRole: 'maze-ground-base' }}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <GroundSurfaceMaterial
          globalEnvMap={environmentTexture}
          globalEnvMapIntensity={environmentIntensity}
          maps={puddle}
        />
      </mesh>
      {groundPatchRects.map((rect, index) => (
        <GroundPatchMesh
          bakedLightmapsEnabled={bakedLightmapsEnabled}
          debugIndex={index}
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          groundBounds={layout.maze.lightmap.groundBounds}
          groundLightmapTexture={groundLightmapTexture}
          key={rect.id}
          maps={puddle}
          probeBlend={(() => {
            const probeTextures = rect.probeIndices.map(
              (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
            )
            const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
            const useProbeDiffuse =
              probeIblEnabled &&
              reflectionCapturesEnabled &&
              hasProbeTextures

            return buildProbeBlendConfig(
              layout,
              rect.probeIndices,
              probeTextures,
              useProbeDiffuse
                ? 'world'
                : bakedLightmapsEnabled
                  ? 'disabled'
                  : 'none',
              {
                radianceMode:
                  reflectionCapturesEnabled &&
                  hasProbeTextures
                    ? 'world'
                    : 'none',
                region: rect.region
              }
            )
          })()}
          rect={rect}
          torchCandelaMultiplier={torchCandelaMultiplier}
        />
      ))}
    </>
  )
}

function TorchBillboard({
  position,
  seed,
  torchCandelaMultiplier
}: {
  position: [number, number, number]
  seed: number
  torchCandelaMultiplier: number
}) {
  const camera = useThree((state) => state.camera)
  const texture = useFireFlipbookTexture()
  const group = useRef<Group>(null)
  const material = useRef<Mesh>(null)
  const parentWorldQuaternion = useMemo(() => new Quaternion(), [])
  const localBillboardQuaternion = useMemo(() => new Quaternion(), [])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    const frameIndex = Math.floor(
      ((elapsed % FIRE_FLIPBOOK_DURATION_SECONDS) / FIRE_FLIPBOOK_DURATION_SECONDS) *
        FIRE_FLIPBOOK_FRAME_COUNT
    )
    const column = frameIndex % FIRE_FLIPBOOK_GRID
    const row = Math.floor(frameIndex / FIRE_FLIPBOOK_GRID)

    if (group.current) {
      if (group.current.parent) {
        group.current.parent.getWorldQuaternion(parentWorldQuaternion)
        group.current.quaternion.copy(
          computeLocalBillboardQuaternion(
            parentWorldQuaternion,
            camera.quaternion,
            localBillboardQuaternion
          )
        )
      } else {
        group.current.quaternion.copy(camera.quaternion)
      }
    }

    texture.offset.x =
      (column + FIRE_FLIPBOOK_FRAME_CROP.minX) / FIRE_FLIPBOOK_GRID
    texture.offset.y =
      1 -
      ((row + FIRE_FLIPBOOK_FRAME_CROP.maxY) / FIRE_FLIPBOOK_GRID)

    if (material.current) {
      const brightness =
        TORCH_BASE_CANDELA *
        torchCandelaMultiplier
      const billboardMaterial = material.current.material as {
        color: Color
      }

      billboardMaterial.color.copy(FIRE_COLOR).multiplyScalar(
        brightness * FIRE_BILLBOARD_INTENSITY_SCALE
      )
    }
  })

  return (
    <group
      onUpdate={(object) => {
        object.layers.set(TORCH_BILLBOARD_LAYER)
      }}
      position={position}
      ref={group}
      userData={{ debugIndex: seed - 1, debugRole: 'torch-billboard' }}
    >
      <mesh
        onUpdate={(object) => {
          object.layers.set(TORCH_BILLBOARD_LAYER)
        }}
        ref={material}
        userData={{
          debugIndex: seed - 1,
          debugRole: 'torch-billboard',
          lensflare: 'no-occlusion'
        }}
      >
        <planeGeometry args={[TORCH_BILLBOARD_SIZE, TORCH_BILLBOARD_SIZE]} />
        <meshBasicMaterial
          alphaTest={0.005}
          color={new Color(1, 1, 1)}
          depthWrite
          map={texture}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </group>
  )
}

function WallSconce({
  environmentTexture,
  environmentIntensity,
  layout,
  mazeLight,
  probeIblEnabled,
  reflectionCapturesEnabled,
  reflectionProbeTextures,
  torchCandelaMultiplier
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  layout: MazeLayout
  mazeLight: MazeLayout['lights'][number]
  probeIblEnabled: boolean
  reflectionCapturesEnabled: boolean
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
}) {
  const metal = useStandardPbrTextures(METAL_TEXTURE_URLS, METAL_TEXTURE_REPEAT)
  const [material, setMaterial] = useState<ThreeMeshStandardMaterial | null>(null)
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint: BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    []
  )
  const position: [number, number, number] = [
    mazeLight.sconcePosition.x,
    mazeLight.sconcePosition.y,
    mazeLight.sconcePosition.z
  ]
  const torchPosition: [number, number, number] = [
    mazeLight.torchPosition.x,
    mazeLight.torchPosition.y,
    mazeLight.torchPosition.z
  ]
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: mazeLight.sconcePosition.x,
        z: mazeLight.sconcePosition.z
      }),
    [layout, mazeLight.sconcePosition.x, mazeLight.sconcePosition.y, mazeLight.sconcePosition.z, reflectionProbeTextures]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const probeBlend = useMemo(
    () => ({
      ...buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeIblEnabled &&
          reflectionCapturesEnabled &&
          hasCompleteProbeTextures(probeTextures)
          ? 'constant'
          : 'none',
        {
          radianceMode:
            reflectionCapturesEnabled &&
            hasCompleteProbeTextures(probeTextures)
              ? 'constant'
              : 'none',
          weights: reflectionProbeBlend.weights as [number, number, number, number]
        }
      )
    }),
    [
      layout,
      probeIblEnabled,
      probeTextures,
      reflectionCapturesEnabled,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights
    ]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('wall-sconce', probeBlend, patchConfig),
    [patchConfig, probeBlend]
  )

  const probeBlendMaterialProps = useProbeBlendMaterialShader(
    material,
    probeBlend,
    patchConfig,
    materialKey
  )

  return (
    <>
      <SconceMesh
        debugIndex={mazeLight.index}
        debugRole="sconce-body"
        material={
          <meshStandardMaterial
            bumpMap={metal.bumpMap}
            bumpScale={0.02}
            color="white"
            customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
            envMap={environmentTexture ?? null}
            envMapIntensity={environmentIntensity}
            key={materialKey}
            map={metal.map}
            metalness={0.85}
            metalnessMap={metal.metalnessMap}
            normalMap={metal.normalMap}
            onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
            onBeforeRender={probeBlendMaterialProps.onBeforeRender}
            ref={setMaterial}
            roughness={0.3}
            roughnessMap={metal.roughnessMap}
            side={DoubleSide}
          />
        }
        position={position}
      />
      <TorchBillboard
        position={torchPosition}
        seed={mazeLight.index + 1}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
    </>
  )
}

const BILLBOARD_COMPOSITE_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const BILLBOARD_COMPOSITE_FRAGMENT_SHADER = `
uniform sampler2D inputBuffer;
uniform sampler2D billboardBuffer;
uniform sampler2D sceneDepthBuffer;
uniform sampler2D billboardDepthBuffer;

varying vec2 vUv;

void main() {
  vec4 baseColor = texture2D(inputBuffer, vUv);
  vec4 billboardColor = texture2D(billboardBuffer, vUv);

  if (billboardColor.a <= 0.0001) {
    gl_FragColor = baseColor;
    return;
  }

  float sceneDepth = texture2D(sceneDepthBuffer, vUv).r;
  float billboardDepth = texture2D(billboardDepthBuffer, vUv).r;

  if (billboardDepth >= 0.999999 || billboardDepth > sceneDepth + 0.000001) {
    gl_FragColor = baseColor;
    return;
  }

  gl_FragColor = vec4(
    mix(baseColor.rgb, billboardColor.rgb, billboardColor.a),
    max(baseColor.a, billboardColor.a)
  );
}
`

class BillboardCompositePassImpl extends Pass {
  billboardCamera: ThreeCamera
  depthMaterial: MeshDepthMaterial
  depthRenderTarget: WebGLRenderTarget
  billboardRenderTarget: WebGLRenderTarget
  clearColor: Color
  opaqueScene: ThreeScene | null

  constructor(billboardCamera: ThreeCamera) {
    super('BillboardCompositePass')
    this.billboardCamera = billboardCamera
    this.clearColor = new Color()
    this.opaqueScene = null
    this.depthMaterial = new MeshDepthMaterial({
      depthPacking: RGBADepthPacking
    })
    this.depthMaterial.blending = NoBlending

    const billboardDepthTexture = new DepthTexture(1, 1, UnsignedIntType)
    this.billboardRenderTarget = new WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      depthTexture: billboardDepthTexture,
      format: RGBAFormat,
      magFilter: NearestFilter,
      minFilter: NearestFilter
    })
    this.billboardRenderTarget.texture.name = 'TorchBillboardComposite.Target'
    this.depthRenderTarget = new WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      depthTexture: new DepthTexture(1, 1, UnsignedIntType),
      format: RGBAFormat,
      magFilter: NearestFilter,
      minFilter: NearestFilter
    })
    this.depthRenderTarget.texture.name = 'TorchBillboardComposite.SceneDepth'

    this.fullscreenMaterial = new ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: BILLBOARD_COMPOSITE_FRAGMENT_SHADER,
      uniforms: {
        billboardBuffer: new Uniform(this.billboardRenderTarget.texture),
        billboardDepthBuffer: new Uniform(this.billboardRenderTarget.depthTexture),
        inputBuffer: new Uniform<Texture | null>(null),
        sceneDepthBuffer: new Uniform(this.depthRenderTarget.depthTexture)
      },
      vertexShader: BILLBOARD_COMPOSITE_VERTEX_SHADER
    })
  }

  set mainScene(value: ThreeScene) {
    this.opaqueScene = value
  }

  set mainCamera(value: ThreeCamera) {
    this.billboardCamera = value
  }

  render(renderer: { autoClear: boolean; clear: (color?: boolean, depth?: boolean, stencil?: boolean) => void; getClearAlpha: () => number; getClearColor: (target: Color) => Color; render: (scene: ThreeScene, camera: ThreeCamera) => void; setClearColor: (color: number | Color, alpha?: number) => void; setRenderTarget: (target: WebGLRenderTarget | null) => void; shadowMap: { autoUpdate: boolean } }, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget) {
    const previousClearAlpha = renderer.getClearAlpha()
    renderer.getClearColor(this.clearColor)
    const previousAutoClear = renderer.autoClear
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate
    const previousBackground = this.opaqueScene?.background ?? null
    const previousOverrideMaterial = this.opaqueScene?.overrideMaterial ?? null
    const previousLayerMask = this.billboardCamera.layers.mask

    renderer.autoClear = false
    renderer.shadowMap.autoUpdate = false
    if (this.opaqueScene) {
      this.billboardCamera.layers.set(0)
      this.opaqueScene.overrideMaterial = this.depthMaterial
      renderer.setRenderTarget(this.depthRenderTarget)
      renderer.setClearColor(0x000000, 0)
      renderer.clear(true, true, true)
      renderer.render(this.opaqueScene, this.billboardCamera)
      this.opaqueScene.overrideMaterial = previousOverrideMaterial
    }
    this.billboardCamera.layers.set(TORCH_BILLBOARD_LAYER)
    renderer.setRenderTarget(this.billboardRenderTarget)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, true)
    if (this.opaqueScene) {
      this.opaqueScene.background = null
      renderer.render(this.opaqueScene, this.billboardCamera)
      this.opaqueScene.background = previousBackground
    }

    const shaderMaterial = this.fullscreenMaterial as ShaderMaterial
    shaderMaterial.uniforms.inputBuffer.value = inputBuffer.texture

    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)

    this.billboardCamera.layers.mask = previousLayerMask
    renderer.setClearColor(this.clearColor, previousClearAlpha)
    renderer.autoClear = previousAutoClear
    renderer.shadowMap.autoUpdate = previousShadowAutoUpdate
  }

  setSize(width: number, height: number) {
    this.billboardRenderTarget.setSize(width, height)
    this.depthRenderTarget.setSize(width, height)
  }

  dispose() {
    super.dispose()
    this.billboardRenderTarget.dispose()
    this.depthRenderTarget.dispose()
    this.depthMaterial.dispose()
  }
}

function BillboardCompositePass() {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const pass = useMemo(
    () => new BillboardCompositePassImpl(camera),
    [camera]
  )

  useEffect(() => {
    pass.billboardCamera = camera
    pass.opaqueScene = scene
  }, [camera, pass, scene])

  useEffect(() => () => pass.dispose(), [pass])

  return <primitive object={pass} />
}

function SconceMesh({
  debugIndex,
  debugRole,
  material,
  position
}: {
  debugIndex: number
  debugRole: string
  material: ReactNode
  position: [number, number, number]
}) {
  return (
    <mesh
      castShadow
      position={position}
      receiveShadow
      userData={{ debugIndex, debugRole }}
    >
      <latheGeometry args={[SCONCE_PROFILE_POINTS, 24]} />
      {material}
    </mesh>
  )
}

function FogVolume({
  environmentFogColor,
  layout,
  noiseFrequency,
  reflectionCapturesEnabled,
  reflectionProbeAmbientColors,
  torchPositions,
  visible,
  volumeIntensity
}: {
  environmentFogColor: Color
  layout: MazeLayout
  noiseFrequency: number
  reflectionCapturesEnabled: boolean
  reflectionProbeAmbientColors: Color[]
  torchPositions: Array<{ x: number, y: number, z: number }>
  visible: boolean
  volumeIntensity: number
}) {
  const materials = useRef<Array<{
    uniforms?: {
      density?: { value: number }
      layerHeight?: { value: number }
      noiseFrequency?: { value: number }
      probeAmbientBounds?: { value: Vector4 }
      probeAmbientGrid?: { value: Vector2 }
      probeAmbientTexture?: { value: Texture | null }
      torchCount?: { value: number }
      torchPositions?: { value: Vector3[] }
      time?: { value: number }
      useProbeAmbientTexture?: { value: number }
      environmentFogColor?: { value: Color }
    }
  } | null>>([])
  const probeBounds = useMemo(() => {
    const firstProbe = layout.reflectionProbes[0]?.position
    const lastXProbe = layout.reflectionProbes[layout.maze.width - 1]?.position
    const lastZProbe =
      layout.reflectionProbes[((layout.maze.height - 1) * layout.maze.width)]?.position

    return new Vector4(
      firstProbe?.x ?? 0,
      firstProbe?.z ?? 0,
      (lastXProbe?.x ?? firstProbe?.x ?? 0) - (firstProbe?.x ?? 0),
      (lastZProbe?.z ?? firstProbe?.z ?? 0) - (firstProbe?.z ?? 0)
    )
  }, [layout])
  const probeGrid = useMemo(
    () => new Vector2(layout.maze.width, layout.maze.height),
    [layout.maze.height, layout.maze.width]
  )
  const probeAmbientTexture = useMemo(() => {
    const probeCount = layout.maze.width * layout.maze.height

    if (
      probeCount === 0 ||
      reflectionProbeAmbientColors.length !== probeCount
    ) {
      return null
    }

    const data = new Uint8Array(probeCount * 4)

    for (let index = 0; index < probeCount; index += 1) {
      const color = reflectionProbeAmbientColors[index] ?? DEFAULT_FOG_IBL_COLOR
      const offset = index * 4

      data[offset] = Math.round(MathUtils.clamp(color.r, 0, 1) * 255)
      data[offset + 1] = Math.round(MathUtils.clamp(color.g, 0, 1) * 255)
      data[offset + 2] = Math.round(MathUtils.clamp(color.b, 0, 1) * 255)
      data[offset + 3] = 255
    }

    const texture = new DataTexture(
      data,
      layout.maze.width,
      layout.maze.height,
      RGBAFormat,
      UnsignedByteType
    )

    texture.generateMipmaps = false
    texture.magFilter = LinearFilter
    texture.minFilter = LinearFilter
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.needsUpdate = true

    return texture
  }, [layout.maze.height, layout.maze.width, reflectionProbeAmbientColors])
  const fogTorchPositions = useMemo(
    () =>
      Array.from({ length: FOG_VOLUME_MAX_TORCHES }, (_, index) => {
        const torch = torchPositions[index]

        return new Vector3(
          torch?.x ?? 10000,
          torch?.y ?? 10000,
          torch?.z ?? 10000
        )
      }),
    [torchPositions]
  )
  const layerHeights = useMemo(
    () =>
      Array.from({ length: FOG_VOLUME_SLICE_COUNT }, (_, index) => {
        return ((index + 0.5) / FOG_VOLUME_SLICE_COUNT) * FOG_VOLUME_HEIGHT
      }),
    []
  )

  useEffect(() => {
    for (const material of materials.current) {
      const uniforms = material?.uniforms
      if (!uniforms) {
        continue
      }

      uniforms.density.value = visible ? volumeIntensity : 0
      uniforms.environmentFogColor.value.copy(environmentFogColor)
      uniforms.noiseFrequency.value = noiseFrequency
      uniforms.probeAmbientBounds.value.copy(probeBounds)
      uniforms.probeAmbientGrid.value.copy(probeGrid)
      uniforms.probeAmbientTexture.value = probeAmbientTexture
      uniforms.torchCount.value = Math.min(FOG_VOLUME_MAX_TORCHES, torchPositions.length)
      uniforms.torchPositions.value = fogTorchPositions
      uniforms.useProbeAmbientTexture.value =
        reflectionCapturesEnabled &&
        Boolean(probeAmbientTexture)
          ? 1
          : 0
    }
  }, [
    environmentFogColor,
    fogTorchPositions,
    noiseFrequency,
    probeAmbientTexture,
    probeBounds,
    probeGrid,
    reflectionCapturesEnabled,
    torchPositions.length,
    visible,
    volumeIntensity
  ])

  useEffect(() => {
    return () => {
      probeAmbientTexture?.dispose()
    }
  }, [probeAmbientTexture])

  useFrame((state) => {
    for (const material of materials.current) {
      const uniforms = material?.uniforms
      if (!uniforms) {
        continue
      }

      uniforms.time.value = state.clock.getElapsedTime()
    }
  })

  return (
    <group userData={{ debugRole: 'global-fog-volume' }}>
      {layerHeights.map((layerHeight, index) => (
        <mesh
            key={layerHeight}
            position={[0, GROUND_Y + layerHeight, 0]}
            rotation-x={-Math.PI / 2}
            userData={{ debugIndex: index, debugRole: 'global-fog-volume' }}
        >
          <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
          <shaderMaterial
            depthTest
            depthWrite={false}
            fragmentShader={`
              uniform float density;
              uniform vec3 environmentFogColor;
              uniform float layerHeight;
              uniform float noiseFrequency;
              uniform vec4 probeAmbientBounds;
              uniform vec2 probeAmbientGrid;
              uniform sampler2D probeAmbientTexture;
              uniform int torchCount;
              uniform vec3 torchPositions[${FOG_VOLUME_MAX_TORCHES}];
              uniform float time;
              uniform float useProbeAmbientTexture;
              varying vec3 vWorldPosition;

              float hash(vec3 p) {
                return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
              }

              float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                float n000 = hash(i + vec3(0.0, 0.0, 0.0));
                float n100 = hash(i + vec3(1.0, 0.0, 0.0));
                float n010 = hash(i + vec3(0.0, 1.0, 0.0));
                float n110 = hash(i + vec3(1.0, 1.0, 0.0));
                float n001 = hash(i + vec3(0.0, 0.0, 1.0));
                float n101 = hash(i + vec3(1.0, 0.0, 1.0));
                float n011 = hash(i + vec3(0.0, 1.0, 1.0));
                float n111 = hash(i + vec3(1.0, 1.0, 1.0));

                float n00 = mix(n000, n100, f.x);
                float n10 = mix(n010, n110, f.x);
                float n01 = mix(n001, n101, f.x);
                float n11 = mix(n011, n111, f.x);
                float n0 = mix(n00, n10, f.y);
                float n1 = mix(n01, n11, f.y);

                return mix(n0, n1, f.z);
              }

              vec3 sampleFogAmbientColor() {
                if (useProbeAmbientTexture < 0.5) {
                  return environmentFogColor;
                }

                if (
                  vWorldPosition.x < probeAmbientBounds.x ||
                  vWorldPosition.z < probeAmbientBounds.y ||
                  vWorldPosition.x > probeAmbientBounds.x + probeAmbientBounds.z ||
                  vWorldPosition.z > probeAmbientBounds.y + probeAmbientBounds.w
                ) {
                  return environmentFogColor;
                }

                float u = 0.5;
                float v = 0.5;

                if (probeAmbientGrid.x > 1.5) {
                  float tx = clamp(
                    (vWorldPosition.x - probeAmbientBounds.x) / max(probeAmbientBounds.z, 0.0001),
                    0.0,
                    1.0
                  );
                  u = ((tx * (probeAmbientGrid.x - 1.0)) + 0.5) / probeAmbientGrid.x;
                }

                if (probeAmbientGrid.y > 1.5) {
                  float tz = clamp(
                    (vWorldPosition.z - probeAmbientBounds.y) / max(probeAmbientBounds.w, 0.0001),
                    0.0,
                    1.0
                  );
                  v = ((tz * (probeAmbientGrid.y - 1.0)) + 0.5) / probeAmbientGrid.y;
                }

                return texture2D(probeAmbientTexture, vec2(u, v)).rgb;
              }

              void main() {
                vec3 samplePoint = vec3(
                  vWorldPosition.x * 0.08 * noiseFrequency,
                  (layerHeight * 0.5 * noiseFrequency) - (time * 0.12),
                  vWorldPosition.z * 0.08 * noiseFrequency
                );
                float verticalFalloff = 1.0 - smoothstep(0.0, ${FOG_VOLUME_HEIGHT.toFixed(1)}, layerHeight);
                float baseNoise = mix(0.45, 1.0, noise(samplePoint));
                float horizontalFade = 1.0 - smoothstep(${(GROUND_SIZE * 0.33).toFixed(1)}, ${(GROUND_SIZE * 0.6).toFixed(1)}, length(vWorldPosition.xz));
                float torchScatter = 0.0;

                for (int torchIndex = 0; torchIndex < ${FOG_VOLUME_MAX_TORCHES}; torchIndex += 1) {
                  if (torchIndex >= torchCount) {
                    continue;
                  }

                  vec3 toTorch = torchPositions[torchIndex] - vWorldPosition;
                  float torchDistance = length(toTorch);
                  float torchInfluence = max(0.0, 1.0 - (torchDistance / 7.5));
                  float heightInfluence = max(0.0, 1.0 - (abs(toTorch.y) / 3.0));

                  torchScatter += torchInfluence * torchInfluence * heightInfluence;
                }

                float densityGain = max(0.0, density) * (0.35 + (max(0.0, density) * 2.2));
                float alpha = clamp(
                  densityGain *
                  verticalFalloff *
                  horizontalFade *
                  baseNoise *
                  0.09 *
                  (0.7 + (torchScatter * 0.55)),
                  0.0,
                  0.14
                );
                if (alpha < 0.0005) {
                  discard;
                }

                vec3 fogColor = mix(
                  sampleFogAmbientColor(),
                  vec3(0.92, 0.69, 0.42),
                  clamp(torchScatter * 0.45, 0.0, 1.0)
                );

                gl_FragColor = vec4(fogColor, alpha);
              }
            `}
            ref={(material) => {
              materials.current[index] = material
            }}
            side={DoubleSide}
            transparent
            uniforms={{
              density: { value: visible ? volumeIntensity : 0 },
              environmentFogColor: { value: environmentFogColor.clone() },
              layerHeight: { value: layerHeight },
              noiseFrequency: { value: noiseFrequency },
              probeAmbientBounds: { value: probeBounds.clone() },
              probeAmbientGrid: { value: probeGrid.clone() },
              probeAmbientTexture: { value: probeAmbientTexture },
              torchCount: { value: Math.min(FOG_VOLUME_MAX_TORCHES, torchPositions.length) },
              torchPositions: { value: fogTorchPositions },
              time: { value: 0 },
              useProbeAmbientTexture: {
                value:
                  reflectionCapturesEnabled &&
                  Boolean(probeAmbientTexture)
                    ? 1
                    : 0
              }
            }}
            vertexShader={`
              varying vec3 vWorldPosition;

              void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
              }
            `}
          />
        </mesh>
      ))}
    </group>
  )
}

function ReflectionProbeVisualization({
  layout,
  reflectionProbeTextures,
  visible
}: {
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  if (!visible) {
    return null
  }

  return (
    <>
      {layout.reflectionProbes.map((probe, index) => {
        const texture = reflectionProbeTextures[index]
        const textureInfo = getCubeUvTextureInfo(texture)

        if (!texture || !textureInfo) {
          return null
        }

        return (
          <mesh
            key={probe.id}
            position={[probe.position.x, probe.position.y, probe.position.z]}
            userData={{ debugIndex: index, debugRole: 'reflection-probe-visual' }}
          >
            <sphereGeometry args={[0.18, 16, 16]} />
            <shaderMaterial
              depthTest={false}
              depthWrite={false}
              fragmentShader={createProcessedReflectionProbeSphereFragmentShader()
                .replaceAll('PROBE_CUBEUV_TEXEL_WIDTH', textureInfo.texelWidth.toFixed(12))
                .replaceAll('PROBE_CUBEUV_TEXEL_HEIGHT', textureInfo.texelHeight.toFixed(12))
                .replaceAll('PROBE_CUBEUV_MAX_MIP', textureInfo.maxMip.toFixed(1))}
              side={DoubleSide}
              toneMapped={false}
              uniforms={{
                probeCubeUvMap: { value: texture }
              }}
              vertexShader={`
                varying vec3 vProbeDirection;

                void main() {
                  vProbeDirection = position;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
            />
          </mesh>
        )
      })}
    </>
  )
}

function DebugOverlayRenderer({
  overlayScene,
  visible
}: {
  overlayScene: ThreeScene
  visible: boolean
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useFrame(() => {
    if (!visible || overlayScene.children.length === 0) {
      return
    }

    const savedAutoClear = gl.autoClear

    gl.autoClear = false
    gl.clearDepth()
    gl.render(overlayScene, camera)
    gl.autoClear = savedAutoClear
  }, 1000)

  return null
}

function ReflectionProbeDebugOverlay({
  layout,
  reflectionProbeTextures,
  visible
}: {
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  const gl = useThree((state) => state.gl)
  const overlayScene = useMemo(() => new ThreeScene(), [])

  useEffect(
    () => () => {
      overlayScene.clear()
    },
    [overlayScene]
  )

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        getReflectionProbeVisualizationState?: (probeIndex: number) => {
          uniformTextureUUID: string | null
          visible: boolean | null
        } | null
        getReflectionProbeVisualizationProgramState?: (probeIndex: number) => {
          uniforms: Record<string, {
            cacheValue: number | null
            glValue: number | number[] | null
            textureUUID: string | null
          }>
        } | null
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}

    globalWindow.__levelsjamDebug = {
      ...existing,
      getReflectionProbeVisualizationState: (probeIndex: number) => {
        let match: {
          uniformTextureUUID: string | null
          visible: boolean | null
        } | null = null

        overlayScene.traverse((object) => {
          if (
            match ||
            !(object instanceof Mesh) ||
            !matchesDebugRole(object, 'reflection-probe-visual', probeIndex)
          ) {
            return
          }

          const material = object.material as {
            uniforms?: {
              probeCubeUvMap?: { value?: Texture | null }
            }
          }

          match = {
            uniformTextureUUID:
              material.uniforms?.probeCubeUvMap?.value?.uuid ?? null,
            visible: object.visible
          }
        })

        return match
      },
      getReflectionProbeVisualizationProgramState: (probeIndex: number) => {
        let match: {
          uniforms: Record<string, {
            cacheValue: number | null
            glValue: number | number[] | null
            textureUUID: string | null
          }>
        } | null = null

        overlayScene.traverse((object) => {
          if (
            match ||
            !(object instanceof Mesh) ||
            !matchesDebugRole(object, 'reflection-probe-visual', probeIndex)
          ) {
            return
          }

          const material = object.material as ShaderMaterial
          const materialProperties = gl.properties.get(material)
          const currentProgram = materialProperties.currentProgram
          const rawGl = gl.getContext()
          const uniformMap = currentProgram?.getUniforms?.().map ?? {}

          match = {
            uniforms: Object.fromEntries(
              ['probeCubeUvMap'].map((name) => {
                const uniform = uniformMap[name]
                const glValue =
                  currentProgram?.program && uniform?.addr
                    ? rawGl.getUniform(currentProgram.program, uniform.addr)
                    : null

                return [
                  name,
                  {
                    cacheValue:
                      Array.isArray(uniform?.cache) && uniform.cache.length > 0
                        ? uniform.cache[0]
                        : null,
                    glValue: ArrayBuffer.isView(glValue)
                      ? Array.from(glValue as ArrayLike<number>)
                      : typeof glValue === 'number'
                        ? glValue
                        : null,
                    textureUUID:
                      material.uniforms?.probeCubeUvMap?.value?.uuid ?? null
                  }
                ]
              })
            ) as Record<string, {
              cacheValue: number | null
              glValue: number | number[] | null
              textureUUID: string | null
            }>
          }
        })

        return match
      }
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getReflectionProbeVisualizationState
      delete globalWindow.__levelsjamDebug.getReflectionProbeVisualizationProgramState
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [gl, overlayScene])

  return (
    <>
      {createPortal(
        <ReflectionProbeVisualization
          layout={layout}
          reflectionProbeTextures={reflectionProbeTextures}
          visible={visible}
        />,
        overlayScene
      )}
      <DebugOverlayRenderer
        overlayScene={overlayScene}
        visible={visible}
      />
    </>
  )
}

const REFLECTION_PROBE_ATLAS_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const REFLECTION_PROBE_DEBUG_TONEMAP_GLSL = `
vec3 debugTonemap(vec3 color) {
  const float debugExposure = 1.5;
  const float debugWhitePoint = 24.0;
  color = max(color * debugExposure, vec3(0.0));
  return clamp(
    log2(vec3(1.0) + color) / log2(vec3(1.0 + debugWhitePoint)),
    vec3(0.0),
    vec3(1.0)
  );
}
`

function createProcessedReflectionProbeFragmentShader(options: {
  toneMap?: boolean
}) {
  return `
uniform int faceIndex;
uniform sampler2D probeCubeUvMap;

varying vec2 vUv;

${PROBE_CUBEUV_SAMPLING_GLSL}
${options.toneMap === false ? '' : REFLECTION_PROBE_DEBUG_TONEMAP_GLSL}

vec3 getFaceDirection(int face, vec2 uv) {
  vec2 p = (uv * 2.0) - 1.0;

  if (face == 0) {
    return normalize(vec3(1.0, -p.y, -p.x));
  }
  if (face == 1) {
    return normalize(vec3(-1.0, -p.y, p.x));
  }
  if (face == 2) {
    return normalize(vec3(p.x, 1.0, p.y));
  }
  if (face == 3) {
    return normalize(vec3(p.x, -1.0, -p.y));
  }
  if (face == 4) {
    return normalize(vec3(p.x, -p.y, 1.0));
  }

  return normalize(vec3(-p.x, -p.y, -1.0));
}

void main() {
  vec4 texel = probeBlendTextureCubeUV(
    probeCubeUvMap,
    getFaceDirection(faceIndex, vUv),
    0.0,
    PROBE_CUBEUV_TEXEL_WIDTH,
    PROBE_CUBEUV_TEXEL_HEIGHT,
    PROBE_CUBEUV_MAX_MIP
  );
  ${
    options.toneMap === false
      ? 'gl_FragColor = vec4(texel.rgb, 1.0);'
      : 'gl_FragColor = vec4(debugTonemap(texel.rgb), 1.0);'
  }
  #include <colorspace_fragment>
}
`
}

function createProcessedReflectionProbeSphereFragmentShader() {
  return `
uniform sampler2D probeCubeUvMap;

varying vec3 vProbeDirection;

${PROBE_CUBEUV_SAMPLING_GLSL}
${REFLECTION_PROBE_DEBUG_TONEMAP_GLSL}

void main() {
  vec4 texel = probeBlendTextureCubeUV(
    probeCubeUvMap,
    normalize(vProbeDirection),
    0.0,
    PROBE_CUBEUV_TEXEL_WIDTH,
    PROBE_CUBEUV_TEXEL_HEIGHT,
    PROBE_CUBEUV_MAX_MIP
  );
  gl_FragColor = vec4(debugTonemap(texel.rgb), 1.0);
  #include <colorspace_fragment>
}
`
}

const REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER = `
uniform int faceIndex;
uniform samplerCube probeCubeMap;

varying vec2 vUv;

${REFLECTION_PROBE_DEBUG_TONEMAP_GLSL}

vec3 getFaceDirection(int face, vec2 uv) {
  vec2 p = (uv * 2.0) - 1.0;

  if (face == 0) {
    return normalize(vec3(1.0, -p.y, -p.x));
  }
  if (face == 1) {
    return normalize(vec3(-1.0, -p.y, p.x));
  }
  if (face == 2) {
    return normalize(vec3(p.x, 1.0, p.y));
  }
  if (face == 3) {
    return normalize(vec3(p.x, -1.0, -p.y));
  }
  if (face == 4) {
    return normalize(vec3(p.x, -p.y, 1.0));
  }

  return normalize(vec3(-p.x, -p.y, -1.0));
}

void main() {
  vec4 texel = textureCube(probeCubeMap, getFaceDirection(faceIndex, vUv));
  gl_FragColor = vec4(debugTonemap(texel.rgb), 1.0);
  #include <colorspace_fragment>
}
`

const REFLECTION_PROBE_ATLAS_RAW_FRAGMENT_SHADER = `
uniform int faceIndex;
uniform samplerCube probeCubeMap;

varying vec2 vUv;

vec3 getFaceDirection(int face, vec2 uv) {
  vec2 p = (uv * 2.0) - 1.0;

  if (face == 0) {
    return normalize(vec3(1.0, -p.y, -p.x));
  }
  if (face == 1) {
    return normalize(vec3(-1.0, -p.y, p.x));
  }
  if (face == 2) {
    return normalize(vec3(p.x, 1.0, p.y));
  }
  if (face == 3) {
    return normalize(vec3(p.x, -1.0, -p.y));
  }
  if (face == 4) {
    return normalize(vec3(p.x, -p.y, 1.0));
  }

  return normalize(vec3(-p.x, -p.y, -1.0));
}

void main() {
  vec4 texel = textureCube(probeCubeMap, getFaceDirection(faceIndex, vUv));
  gl_FragColor = vec4(texel.rgb, 1.0);
  #include <colorspace_fragment>
}
`

function captureCubeTextureAtlasDataUrls(
  gl: WebGLRenderer,
  probeTexture: Texture,
  size: number,
  options: {
    toneMap?: boolean
  } = {}
) {
  if (size <= 0) {
    return null
  }

  const atlasScene = new ThreeScene()
  const atlasCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const atlasMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader:
      options.toneMap === false
        ? REFLECTION_PROBE_ATLAS_RAW_FRAGMENT_SHADER
        : REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER,
    uniforms: {
      faceIndex: { value: 0 },
      probeCubeMap: { value: probeTexture }
    },
    vertexShader: REFLECTION_PROBE_ATLAS_VERTEX_SHADER
  })
  const atlasMesh = new Mesh(new PlaneGeometry(2, 2), atlasMaterial)
  const atlasTarget = new WebGLRenderTarget(size, size, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    stencilBuffer: false,
    type: UnsignedByteType
  })
  const savedAutoClear = gl.autoClear
  const savedTarget = gl.getRenderTarget()
  const pixelBuffer = new Uint8Array(size * size * 4)
  const dataUrls: string[] = []

  atlasScene.add(atlasMesh)
  gl.autoClear = true

  try {
    for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
      atlasMaterial.uniforms.faceIndex.value = faceIndex
      gl.setRenderTarget(atlasTarget)
      gl.clear(true, true, true)
      gl.render(atlasScene, atlasCamera)
      gl.readRenderTargetPixels(atlasTarget, 0, 0, size, size, pixelBuffer)

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        return null
      }

      canvas.width = size
      canvas.height = size
      const imageData = context.createImageData(size, size)

      for (let row = 0; row < size; row += 1) {
        const sourceRow = size - 1 - row
        const sourceOffset = sourceRow * size * 4
        const targetOffset = row * size * 4

        imageData.data.set(
          pixelBuffer.subarray(sourceOffset, sourceOffset + (size * 4)),
          targetOffset
        )
      }

      context.putImageData(imageData, 0, 0)
      dataUrls.push(canvas.toDataURL('image/png'))
    }
  } finally {
    gl.setRenderTarget(savedTarget)
    gl.autoClear = savedAutoClear
    atlasMesh.geometry.dispose()
    atlasMaterial.dispose()
    atlasTarget.dispose()
  }

  return dataUrls
}

function captureCubeUvTextureAtlasDataUrls(
  gl: WebGLRenderer,
  probeTexture: Texture,
  size: number,
  options: {
    toneMap?: boolean
  } = {}
) {
  if (size <= 0) {
    return null
  }

  const textureInfo = getCubeUvTextureInfo(probeTexture)

  if (!textureInfo) {
    return null
  }

  const atlasScene = new ThreeScene()
  const atlasCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const atlasMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: createProcessedReflectionProbeFragmentShader(options)
      .replaceAll('PROBE_CUBEUV_TEXEL_WIDTH', textureInfo.texelWidth.toFixed(12))
      .replaceAll('PROBE_CUBEUV_TEXEL_HEIGHT', textureInfo.texelHeight.toFixed(12))
      .replaceAll('PROBE_CUBEUV_MAX_MIP', textureInfo.maxMip.toFixed(1)),
    uniforms: {
      faceIndex: { value: 0 },
      probeCubeUvMap: { value: probeTexture }
    },
    vertexShader: REFLECTION_PROBE_ATLAS_VERTEX_SHADER
  })
  const atlasMesh = new Mesh(new PlaneGeometry(2, 2), atlasMaterial)
  const atlasTarget = new WebGLRenderTarget(size, size, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    stencilBuffer: false,
    type: UnsignedByteType
  })
  const savedAutoClear = gl.autoClear
  const savedTarget = gl.getRenderTarget()
  const pixelBuffer = new Uint8Array(size * size * 4)
  const dataUrls: string[] = []

  atlasScene.add(atlasMesh)
  gl.autoClear = true

  try {
    for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
      atlasMaterial.uniforms.faceIndex.value = faceIndex
      gl.setRenderTarget(atlasTarget)
      gl.clear(true, true, true)
      gl.render(atlasScene, atlasCamera)
      gl.readRenderTargetPixels(atlasTarget, 0, 0, size, size, pixelBuffer)

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        return null
      }

      canvas.width = size
      canvas.height = size
      const imageData = context.createImageData(size, size)

      for (let row = 0; row < size; row += 1) {
        const sourceRow = size - 1 - row
        const sourceOffset = sourceRow * size * 4
        const targetOffset = row * size * 4

        imageData.data.set(
          pixelBuffer.subarray(sourceOffset, sourceOffset + (size * 4)),
          targetOffset
        )
      }

      context.putImageData(imageData, 0, 0)
      dataUrls.push(canvas.toDataURL('image/png'))
    }
  } finally {
    gl.setRenderTarget(savedTarget)
    gl.autoClear = savedAutoClear
    atlasMesh.geometry.dispose()
    atlasMaterial.dispose()
    atlasTarget.dispose()
  }

  return dataUrls
}

function MazeWalls({
  bakedLightmapsEnabled,
  environmentTexture,
  environmentIntensity,
  layout,
  lightmapBytes,
  probeIblEnabled,
  reflectionCapturesEnabled,
  reflectionProbeTextures,
  torchCandelaMultiplier
}: {
  bakedLightmapsEnabled: boolean
  environmentTexture: Texture | null
  environmentIntensity: number
  layout: MazeLayout
  lightmapBytes: Uint8Array
  probeIblEnabled: boolean
  reflectionCapturesEnabled: boolean
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
}) {
  const wall = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT)

  return (
    <>
      {layout.walls.map((mazeWall, wallIndex) => (
        <MazeWallMesh
          bakedLightmapsEnabled={bakedLightmapsEnabled}
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          key={mazeWall.id}
          lightmap={layout.maze.lightmap}
          lightmapBytes={lightmapBytes}
          layout={layout}
          mazeWall={mazeWall}
          probeIblEnabled={probeIblEnabled}
          reflectionCapturesEnabled={reflectionCapturesEnabled}
          reflectionProbeTextures={reflectionProbeTextures}
          torchCandelaMultiplier={torchCandelaMultiplier}
          wallIndex={wallIndex}
          wallMaterialMaps={wall}
        />
      ))}
      {layout.lights.map((mazeLight) => (
        <WallSconce
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          key={mazeLight.id}
          layout={layout}
          mazeLight={mazeLight}
          probeIblEnabled={probeIblEnabled}
          reflectionCapturesEnabled={reflectionCapturesEnabled}
          reflectionProbeTextures={reflectionProbeTextures}
          torchCandelaMultiplier={torchCandelaMultiplier}
        />
      ))}
    </>
  )
}

function WallFaceMaterial({
  attach,
  environmentTexture,
  environmentIntensity,
  lightMap,
  lightMapIntensity,
  materialKey,
  maps,
  patchConfig,
  probeBlend
}: {
  attach: string
  environmentTexture: Texture | null
  environmentIntensity: number
  lightMap?: Texture
  lightMapIntensity: number
  materialKey: string
  maps: PbrMaps
  patchConfig: MaterialShaderPatchConfig
  probeBlend: ProbeBlendConfig
}) {
  const [material, setMaterial] = useState<ThreeMeshStandardMaterial | null>(null)

  const probeBlendMaterialProps = useProbeBlendMaterialShader(
    material,
    probeBlend,
    patchConfig,
    materialKey
  )

  return (
    <meshStandardMaterial
      {...maps}
      attach={attach}
      bumpScale={0.05}
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={environmentTexture ?? null}
      envMapIntensity={environmentIntensity}
      key={materialKey}
      lightMap={lightMap}
      lightMapIntensity={lightMapIntensity}
      metalness={0.02}
      onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
      onBeforeRender={probeBlendMaterialProps.onBeforeRender}
      ref={setMaterial}
      roughness={0.92}
    />
  )
}

function MazeWallMesh({
  bakedLightmapsEnabled,
  environmentTexture,
  environmentIntensity,
  lightmap,
  lightmapBytes,
  layout,
  mazeWall,
  probeIblEnabled,
  reflectionCapturesEnabled,
  reflectionProbeTextures,
  torchCandelaMultiplier,
  wallIndex,
  wallMaterialMaps
}: {
  bakedLightmapsEnabled: boolean
  environmentTexture: Texture | null
  environmentIntensity: number
  lightmap: MazeLightmap
  lightmapBytes: Uint8Array
  layout: MazeLayout
  mazeWall: MazeLayout['walls'][number]
  probeIblEnabled: boolean
  reflectionCapturesEnabled: boolean
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
  wallIndex: number
  wallMaterialMaps: PbrMaps
}) {
  const lightmapTextures = useWallLightmapTextures(
    lightmap,
    lightmapBytes,
    mazeWall.id
  )
  const geometry = useMemo(
    () => createWallGeometry(),
    []
  )
  const lightMapIntensity =
    bakedLightmapsEnabled
      ? torchCandelaMultiplier * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: mazeWall.center.x,
        z: mazeWall.center.z
      }),
    [layout, mazeWall.center.x, mazeWall.center.z]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const useProbeDiffuse =
    probeIblEnabled &&
    reflectionCapturesEnabled &&
    hasProbeTextures
  const faceMaterialPatchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        bakedLightmapsEnabled && !useProbeDiffuse
          ? WHITE_COLOR
          : BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [bakedLightmapsEnabled, useProbeDiffuse]
  )
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        useProbeDiffuse
          ? 'constant'
          : bakedLightmapsEnabled
            ? 'disabled'
            : 'none',
        {
          radianceMode:
            reflectionCapturesEnabled &&
            hasProbeTextures
              ? 'constant'
              : 'none',
          weights: reflectionProbeBlend.weights as [number, number, number, number]
        }
      ),
    [
      bakedLightmapsEnabled,
      layout,
      useProbeDiffuse,
      reflectionCapturesEnabled,
      probeTextures,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights
    ]
  )
  const wallFaceMaterialBaseKey = useMemo(
    () => getProbeBlendMaterialKey('maze-wall', probeBlend, faceMaterialPatchConfig),
    [faceMaterialPatchConfig, probeBlend]
  )
  const envMapIntensity = environmentIntensity

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry]
  )

  return (
    <mesh
      castShadow
      position={[
        mazeWall.center.x,
        GROUND_Y + (WALL_HEIGHT / 2),
        mazeWall.center.z
      ]}
      receiveShadow
      rotation-y={mazeWall.yaw}
      userData={{
        debugIndex: wallIndex,
        debugRole: 'maze-wall',
        debugRoles: ['maze-wall', 'maze-wall-lightmap']
      }}
    >
      <primitive
        attach="geometry"
        object={geometry}
      />
      <WallFaceMaterial
        attach="material-0"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.neutral : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-0`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
      <WallFaceMaterial
        attach="material-1"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.neutral : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-1`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
      <WallFaceMaterial
        attach="material-2"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.neutral : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-2`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
      <WallFaceMaterial
        attach="material-3"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.neutral : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-3`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
      <WallFaceMaterial
        attach="material-4"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.pz : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-4`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
      <WallFaceMaterial
        attach="material-5"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={bakedLightmapsEnabled ? lightmapTextures.nz : undefined}
        lightMapIntensity={lightMapIntensity}
        materialKey={`${wallFaceMaterialBaseKey}:material-5`}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function SceneGeometry({
  bakedLightmapsEnabled,
  environmentTexture,
  environmentIntensity,
  environmentFogColor,
  layout,
  probeIblEnabled,
  reflectionProbeAmbientColors,
  reflectionCapturesEnabled,
  reflectionProbeTextures,
  showReflectionProbes,
  torchCandelaMultiplier,
  volumetricLighting,
  volumetricNoiseFrequency
}: {
  bakedLightmapsEnabled: boolean
  environmentTexture: Texture | null
  environmentIntensity: number
  environmentFogColor: Color
  layout: MazeLayout
  probeIblEnabled: boolean
  reflectionProbeAmbientColors: Color[]
  reflectionCapturesEnabled: boolean
  reflectionProbeTextures: Texture[]
  showReflectionProbes: boolean
  torchCandelaMultiplier: number
  volumetricLighting: EffectSettings
  volumetricNoiseFrequency: number
}) {
  const lightmapBytes = useMazeLightmapBytes(layout.maze.lightmap)
  const groundLightmapTexture = useGroundLightmapTexture(layout.maze.lightmap, lightmapBytes)

  return (
    <>
      <Ground
        bakedLightmapsEnabled={bakedLightmapsEnabled}
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        layout={layout}
        groundLightmapTexture={groundLightmapTexture}
        probeIblEnabled={probeIblEnabled}
        reflectionCapturesEnabled={reflectionCapturesEnabled}
        reflectionProbeTextures={reflectionProbeTextures}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
      <MazeWalls
        bakedLightmapsEnabled={bakedLightmapsEnabled}
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        layout={layout}
        lightmapBytes={lightmapBytes}
        probeIblEnabled={probeIblEnabled}
        reflectionCapturesEnabled={reflectionCapturesEnabled}
        reflectionProbeTextures={reflectionProbeTextures}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
      <ReflectionProbeDebugOverlay
        layout={layout}
        reflectionProbeTextures={reflectionProbeTextures}
        visible={showReflectionProbes}
      />
      {isEffectActive(volumetricLighting) ? (
        <FogVolume
          environmentFogColor={environmentFogColor}
          layout={layout}
          noiseFrequency={volumetricNoiseFrequency}
          reflectionCapturesEnabled={reflectionCapturesEnabled}
          reflectionProbeAmbientColors={reflectionProbeAmbientColors}
          torchPositions={layout.lights.map((light) => light.torchPosition)}
          visible={volumetricLighting.enabled}
          volumeIntensity={volumetricLighting.intensity}
        />
      ) : null}
    </>
  )
}

function BloomEffectPrimitive({
  intensity,
  kernelSize
}: {
  intensity: number
  kernelSize: BloomKernelSizeKey
}) {
  const effect = useMemo(
    () =>
      new BloomEffect({
        intensity,
        kernelSize: BLOOM_KERNEL_SIZES[kernelSize],
        luminanceSmoothing: 0,
        luminanceThreshold: 0.05,
        mipmapBlur: false,
        resolutionScale: BLOOM_RESOLUTION_SCALES[kernelSize]
      }),
    [kernelSize]
  )

  useEffect(() => {
    effect.intensity = intensity
    effect.luminanceMaterial.threshold = 0.05
    effect.luminanceMaterial.smoothing = 0
  }, [effect, intensity])

  useEffect(() => () => effect.dispose(), [effect])

  return (
    <primitive
      key={kernelSize}
      object={effect as unknown as Effect}
    />
  )
}

function SSREffectPrimitive({
  intensity
}: {
  intensity: number
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const clampedIntensity = Math.min(1, Math.max(0, intensity))
  const effect = useMemo(
    () =>
      new SSREffect(scene, camera, {
        blend: 0.92,
        blur: 0.3,
        correction: 1,
        distance: 18,
        fade: 0.12,
        intensity: clampedIntensity,
        ior: 1.333,
        jitter: 0.05,
        jitterRoughness: 0.1,
        maxDepthDifference: 6,
        maxRoughness: 0.95,
        missedRays: true,
        refineSteps: 5,
        resolutionScale: 0.75,
        steps: 24,
        thickness: 4,
        useNormalMap: true,
        useRoughnessMap: true
      }),
    [camera, scene]
  )

  useEffect(() => {
    effect.intensity = clampedIntensity
  }, [clampedIntensity, effect])

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function PerformanceBenchmarkBridge() {
  const advance = useThree((state) => state.advance)
  const gl = useThree((state) => state.gl)
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const setFrameloop = useThree((state) => state.setFrameloop)

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamBenchmark?: (samples?: number) => Promise<BenchmarkResult>
    }
    const finish = gl.getContext().finish?.bind(gl.getContext())

    globalWindow.__levelsjamBenchmark = async (samples = 90) => {
      const durations: number[] = []
      const initialTimestamp = performance.now()
      const originalFrameloop = get().frameloop

      setFrameloop('never')

      try {
        for (let index = 0; index < samples; index += 1) {
          const start = performance.now()

          advance(initialTimestamp + (index * (1000 / 120)), true)
          finish?.()

          durations.push(performance.now() - start)
        }
      } finally {
        setFrameloop(originalFrameloop)
        invalidate()
      }

      const totalDuration = durations.reduce((sum, value) => sum + value, 0)
      const averageFrameMs = totalDuration / durations.length

      return {
        averageFrameMs,
        fps: 1000 / averageFrameMs,
        maxFrameMs: Math.max(...durations),
        minFrameMs: Math.min(...durations),
        samples
      }
    }

    return () => {
      delete globalWindow.__levelsjamBenchmark
    }
  }, [advance, get, gl, invalidate, setFrameloop])

  return null
}

function ExposureEffectPrimitive({
  exposure
}: {
  exposure: number
}) {
  const effect = useMemo(() => new ExposureEffectImpl(exposure), [])

  useEffect(() => {
    effect.exposure = exposure
  }, [effect, exposure])

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function TorchLensFlareEffectPrimitive({
  intensity,
  mazeLights,
  torchCandelaMultiplier
}: {
  intensity: number
  mazeLights: MazeLayout['lights']
  torchCandelaMultiplier: number
}) {
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const lensPositions = useMemo(
    () =>
      mazeLights.map(
        (mazeLight) =>
          new Vector3(
            mazeLight.torchPosition.x,
            mazeLight.torchPosition.y,
            mazeLight.torchPosition.z
          )
      ),
    [mazeLights]
  )
  const projectedPosition = useMemo(() => new Vector3(), [])
  const selectedProjectedPosition = useMemo(() => new Vector3(), [])
  const raycasterPosition = useMemo(() => new Vector2(), [])
  const lensRaycasterMask = useMemo(
    () => ((1 << 0) | (1 << TORCH_BILLBOARD_LAYER)),
    []
  )
  const effect = useMemo(
    () => {
      const nextEffect = new PostLensFlareEffectImpl({
        aditionalStreaks: false,
        animated: true,
        anamorphic: false,
        blendFunction: BlendFunction.NORMAL,
        colorGain: new Color(0, 0, 0),
        enabled: true,
        flareShape: 0.08,
        flareSize: 0.0025,
        flareSpeed: 0.01,
        ghostScale: 0.14,
        glareSize: 0.03,
        haloScale: 0.16,
        lensDirtTexture: null,
        lensPosition: new Vector3(),
        opacity: 1,
        screenRes: new Vector2(size.width, size.height),
        secondaryGhosts: true,
        starBurst: false,
        starPoints: 6
      })

      nextEffect.blendMode.opacity.value = 0
      return nextEffect
    },
    [size.height, size.width]
  )

  useFrame((_, delta) => {
    const blendOpacityUniform = effect.blendMode?.opacity
    const lensUniform = effect.uniforms.get('lensPosition')
    const opacityUniform = effect.uniforms.get('opacity')
    const colorGainUniform = effect.uniforms.get('colorGain')
    const glareSizeUniform = effect.uniforms.get('glareSize')
    const flareSizeUniform = effect.uniforms.get('flareSize')
    const ghostScaleUniform = effect.uniforms.get('ghostScale')
    const haloScaleUniform = effect.uniforms.get('haloScale')
    const screenResUniform = effect.uniforms.get('screenRes')

    if (
      !lensUniform ||
      !opacityUniform ||
      !colorGainUniform ||
      !glareSizeUniform ||
      !flareSizeUniform ||
      !ghostScaleUniform ||
      !haloScaleUniform ||
      !screenResUniform
    ) {
      return
    }

    screenResUniform.value.set(size.width, size.height)
    let bestLensScore = Number.POSITIVE_INFINITY

    for (const lensPosition of lensPositions) {
      projectedPosition.copy(lensPosition).project(camera)

      if (
        projectedPosition.z >= 1 ||
        projectedPosition.z <= -1 ||
        Math.abs(projectedPosition.x) > 1.15 ||
        Math.abs(projectedPosition.y) > 1.15
      ) {
        continue
      }

      const lensScore =
        (projectedPosition.x * projectedPosition.x) +
        (projectedPosition.y * projectedPosition.y)

      if (lensScore >= bestLensScore) {
        continue
      }

      bestLensScore = lensScore
      selectedProjectedPosition.copy(projectedPosition)
    }

    if (!Number.isFinite(bestLensScore)) {
      opacityUniform.value = MathUtils.damp(opacityUniform.value, 1, 18, delta)
      if (blendOpacityUniform) {
        blendOpacityUniform.value = MathUtils.damp(blendOpacityUniform.value, 0, 18, delta)
      }
      return
    }

    lensUniform.value.set(selectedProjectedPosition.x, selectedProjectedPosition.y)
    raycasterPosition.set(selectedProjectedPosition.x, selectedProjectedPosition.y)
    const previousRaycasterMask = raycaster.layers.mask
    raycaster.layers.mask = lensRaycasterMask
    raycaster.setFromCamera(raycasterPosition, camera)

    let visibility = 1
    const hitObject = raycaster.intersectObjects(scene.children, true)[0]?.object
    raycaster.layers.mask = previousRaycasterMask

    if (hitObject && hitObject !== camera) {
      if (hitObject.userData?.lensflare === 'no-occlusion') {
        visibility = 1
      } else if (hitObject instanceof Mesh) {
        const material = Array.isArray(hitObject.material)
          ? hitObject.material[0]
          : hitObject.material

        if (material?.uniforms?._transmission?.value > 0.2) {
          visibility = 0.8
        } else if (material?._transmission && material._transmission > 0.2) {
          visibility = 0.8
        } else if (material?.transparent) {
          visibility = Math.max(0, 1 - (material.opacity ?? 1))
        } else {
          visibility = 0
        }
      } else {
        visibility = 0
      }
    }

    const normalizedIntensity = Math.min(1, intensity / 0.02)
    const targetOpacity = 1 - (normalizedIntensity * visibility * 0.2)
    const targetBlendOpacity = normalizedIntensity * visibility * 0.18

    opacityUniform.value = MathUtils.damp(
      opacityUniform.value,
      targetOpacity,
      18,
      delta
    )
    if (blendOpacityUniform) {
      blendOpacityUniform.value = MathUtils.damp(
        blendOpacityUniform.value,
        targetBlendOpacity,
        18,
        delta
      )
    }
    glareSizeUniform.value = 0.03 + (normalizedIntensity * 0.08)
    flareSizeUniform.value = 0.002 + (normalizedIntensity * 0.005)
    ghostScaleUniform.value = 0.14 + (normalizedIntensity * 0.08)
    haloScaleUniform.value = 0.16 + (normalizedIntensity * 0.08)
    colorGainUniform.value.copy(FIRE_COLOR).multiplyScalar(
      (0.05 + (normalizedIntensity * 0.25)) *
      Math.sqrt(torchCandelaMultiplier)
    )
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function TorchLensFlare({
  intensity,
  layout,
  torchCandelaMultiplier
}: {
  intensity: number
  layout: MazeLayout
  torchCandelaMultiplier: number
}) {
  if (layout.lights.length === 0) {
    return null
  }

  return (
    <TorchLensFlareEffectPrimitive
      intensity={intensity}
      mazeLights={layout.lights}
      torchCandelaMultiplier={torchCandelaMultiplier}
    />
  )
}

function FlightRig({
  controlsOpen,
  movementSettings,
  wallBounds
}: {
  controlsOpen: boolean
  movementSettings: MovementSettings
  wallBounds: ReturnType<typeof getWallBounds>
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const canvas = useThree((state) => state.gl.domElement)
  const scene = useThree((state) => state.scene)
  const keys = useRef<Record<string, boolean>>({})
  const grounded = useRef(false)
  const playerPosition = useRef(
    new Vector3(
      PLAYER_SPAWN_POSITION.x,
      PLAYER_SPAWN_POSITION.y,
      PLAYER_SPAWN_POSITION.z
    )
  )
  const velocity = useRef(new Vector3())
  const keyboardLocal = useRef(new Vector3())
  const decelLocal = useRef(new Vector3())
  const accelWorld = useRef(new Vector3())
  const decelWorld = useRef(new Vector3())
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const intendedPosition = useRef(new Vector3())
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isPointerLocked = useRef(false)
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const resolvedMovementSettings = useMemo(
    () =>
      createMovementSettings({
        horizontalAccelerationDistance: movementSettings.accelerationDistance,
        horizontalDecelerationDistance: movementSettings.decelerationDistance,
        maxHorizontalSpeedMph: movementSettings.maxHorizontalSpeedMph
      }),
    [
      movementSettings.accelerationDistance,
      movementSettings.decelerationDistance,
      movementSettings.maxHorizontalSpeedMph
    ]
  )

  useEffect(() => {
    const spawnPosition = getPlayerSpawnPosition()
    const cameraPosition = getCameraPosition(spawnPosition)

    camera.rotation.order = 'YXZ'
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    camera.quaternion.setFromEuler(cameraEuler.set(0, 0, 0, 'YXZ'))
    yaw.current = 0
    pitch.current = 0
  }, [camera])

  useEffect(() => {
    const updateRotation = () => {
      camera.quaternion.setFromEuler(
        cameraEuler.set(pitch.current, yaw.current, 0, 'YXZ')
      )
    }

    const requestLock = () => {
      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock()
      }
    }

    const onPointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!isPointerLocked.current) {
        return
      }

      yaw.current -= event.movementX * LOOK_SENSITIVITY
      pitch.current = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, pitch.current - (event.movementY * LOOK_SENSITIVITY))
      )
      updateRotation()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (controlsOpen) {
        return
      }

      if (!(event.target instanceof Node) || !canvas.contains(event.target)) {
        return
      }

      requestLock()
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [camera, canvas, controlsOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === BACKQUOTE_CODE) {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        keys.current[event.code] = false
        return
      }

      if (controlsOpen) {
        keys.current[event.code] = false
        return
      }

      if (POINTER_UNLOCK_CODES.has(event.code) || event.key === 'Meta') {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        keys.current[event.code] = false
        return
      }

      if (
        event.code === 'Space' ||
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD'
      ) {
        event.preventDefault()
      }

      keys.current[event.code] = true
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false
    }

    const onBlur = () => {
      keys.current = {}
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [canvas, controlsOpen])

  useEffect(() => {
    if (controlsOpen) {
      keys.current = {}
    }
  }, [controlsOpen])

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        getDebugPosition?: (
          role: string,
          index: number
        ) => [number, number, number] | null
        getDebugMeshState?: (
          role: string,
          index: number
        ) => {
          emissiveColor: [number, number, number] | null
          emissiveIntensity: number | null
          emissiveMapChannel: number | null
          envMapIntensity: number | null
          hasEmissiveMap: boolean
          hasEnvMap: boolean
          hasLightMap: boolean
          hasMap: boolean
          hasUv1: boolean
          hasUv2: boolean
          layerMask: number
          lightMapChannel: number | null
          lightMapIntensity: number | null
          mapChannel: number | null
          materialColor: [number, number, number] | null
          quaternion: [number, number, number, number]
          probeBlend: {
            mode: 'constant' | 'disabled' | 'none' | 'world'
            radianceMode: 'constant' | 'disabled' | 'none' | 'world'
            probeTextureCount: number
            region: {
              minX: number
              minZ: number
              sizeX: number
              sizeZ: number
            } | null
            weights: number[] | null
          } | null
          probeBlendShader: {
            fragmentHasGetIBLIrradianceOverride: boolean
            fragmentHasGetIBLRadianceOverride: boolean
            fragmentHasProbeRadianceMode: boolean
            fragmentHasSampleProbeBlendEnvMapWithMode: boolean
          } | null
          probeBlendUniforms: {
            localProbeTextureUUIDs: Array<string | null>
            localProbeTextureInfo: Array<{
              maxMip: number | null
              texelHeight: number | null
              texelWidth: number | null
            }>
            localProbeTextureBoundCount: number
            probeBlendMode: number | null
            probeBlendRadianceMode: number | null
          } | null
          scale: [number, number, number]
          visible: boolean
          worldQuaternion: [number, number, number, number]
          worldPosition: [number, number, number]
        } | null
        getReflectionProbeState?: () => {
          activeProbeId: string | null
          captureSceneState?: {
            expectedGroundPatchCount: number
            groundPatchCount: number
            ready: boolean
            readyGroundPatchCount: number
            readySconceCount: number
            readyWallCount: number
            sconceCount: number
            wallCount: number
          }
          complete?: boolean
          loadedProbeCount?: number
          priorityProbeIndices?: number[]
          probeCaptureCounts?: Array<{
            billboard: number
            ground: number
            sconce: number
            wall: number
          } | null>
          probeMetrics?: Array<ProbeMetric | null>
          probeRawMetrics?: Array<ProbeMetric | null>
          probeRawReadbackErrors?: Array<string | null>
          probeRawTextureSummaries?: Array<ProbeTextureSummary | null>
          probeRawTextureUUIDs?: Array<string | null>
          probeTextureUUIDs?: Array<string | null>
          probeCount: number
          ready: boolean
        } | null
        getReflectionProbeTextureState?: (probeIndex: number) => {
          processedTextureUUID: string | null
          rawTextureUUID: string | null
        } | null
        getDebugProgramUniformState?: (
          role: string,
          index: number
        ) => {
          materialEnvMapUUID: string | null
          uniforms: Record<string, {
            cacheValue: number | null
            glValue: number | number[] | null
            textureUUID: string | null
          }>
        } | null
        setView?: (
          cameraPosition: [number, number, number],
          target: [number, number, number]
        ) => void
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    const worldPosition = new Vector3()
    const worldQuaternion = new Quaternion()
    const getDebugRoots = () => [scene]

    globalWindow.__levelsjamDebug = {
      ...existing,
      getDebugPosition: (role, index) => {
        let match: [number, number, number] | null = null

        for (const root of getDebugRoots()) {
          root.traverse((object) => {
            if (
              match ||
              !matchesDebugRole(object, role, index)
            ) {
              return
            }

            object.getWorldPosition(worldPosition)
            match = [worldPosition.x, worldPosition.y, worldPosition.z]
          })
        }

        return match
      },
      getDebugMeshState: (role, index) => {
        let match: {
          emissiveColor: [number, number, number] | null
          emissiveIntensity: number | null
          emissiveMapChannel: number | null
          envMapIntensity: number | null
          hasEmissiveMap: boolean
          hasEnvMap: boolean
          hasLightMap: boolean
          hasMap: boolean
          hasUv1: boolean
          hasUv2: boolean
          layerMask: number
          lightMapChannel: number | null
          lightMapIntensity: number | null
          mapChannel: number | null
          materialColor: [number, number, number] | null
          quaternion: [number, number, number, number]
          probeBlend: {
            mode: 'constant' | 'disabled' | 'none' | 'world'
            radianceMode: 'constant' | 'disabled' | 'none' | 'world'
            probeTextureCount: number
            region: {
              minX: number
              minZ: number
              sizeX: number
              sizeZ: number
            } | null
            weights: number[] | null
          } | null
          probeBlendShader: {
            fragmentHasGetIBLIrradianceOverride: boolean
            fragmentHasGetIBLRadianceOverride: boolean
            fragmentHasProbeRadianceMode: boolean
            fragmentHasSampleProbeBlendEnvMapWithMode: boolean
          } | null
          probeBlendUniforms: {
            localProbeTextureUUIDs: Array<string | null>
            localProbeTextureInfo: Array<{
              maxMip: number | null
              texelHeight: number | null
              texelWidth: number | null
            }>
            localProbeTextureBoundCount: number
            probeBlendMode: number | null
            probeBlendRadianceMode: number | null
          } | null
          scale: [number, number, number]
          visible: boolean
          worldQuaternion: [number, number, number, number]
          worldPosition: [number, number, number]
        } | null = null

        for (const root of getDebugRoots()) {
          root.traverse((object) => {
            if (
              match ||
              !(object instanceof Mesh) ||
              !matchesDebugRole(object, role, index)
            ) {
              return
            }

            const materials = (
              Array.isArray(object.material)
                ? object.material
                : [object.material]
            ) as Array<{
              emissive?: Color
              emissiveIntensity?: number
              emissiveMap?: Texture | null
              color?: Color
              envMap?: Texture | null
              envMapIntensity?: number
              lightMap?: Texture | null
              lightMapIntensity?: number
              map?: Texture | null
              userData?: {
                probeBlendDebug?: {
                  mode: 'constant' | 'disabled' | 'none' | 'world'
                  radianceMode: 'constant' | 'disabled' | 'none' | 'world'
                  probeTextureCount: number
                  region: {
                    minX: number
                    minZ: number
                    sizeX: number
                    sizeZ: number
                  } | null
                  weights: number[] | null
                } | null
                probeBlendShaderDebug?: {
                  fragmentHasGetIBLIrradianceOverride: boolean
                  fragmentHasGetIBLRadianceOverride: boolean
                  fragmentHasProbeRadianceMode: boolean
                  fragmentHasSampleProbeBlendEnvMapWithMode: boolean
                } | null
                probeBlendUniformDebug?: {
                  localProbeTextureUUIDs: Array<string | null>
                  localProbeTextureInfo: Array<{
                    maxMip: number | null
                    texelHeight: number | null
                    texelWidth: number | null
                  }>
                  localProbeTextureBoundCount: number
                  probeBlendMode: number | null
                  probeBlendRadianceMode: number | null
                } | null
              }
            }>
            const material =
              materials.find((candidate) => (
                candidate.lightMap ||
                candidate.map ||
                candidate.envMap ||
                candidate.emissiveMap
              )) ??
              materials[0]
            const lightMapMaterial = materials.find((candidate) => candidate.lightMap)
            const mapMaterial = materials.find((candidate) => candidate.map)
            const envMapMaterial = materials.find((candidate) => candidate.envMap)
            const emissiveMapMaterial = materials.find((candidate) => candidate.emissiveMap)

            match = {
              emissiveColor: material.emissive
                ? [
                    material.emissive.r,
                    material.emissive.g,
                    material.emissive.b
                  ]
                : null,
              emissiveIntensity:
                typeof material.emissiveIntensity === 'number'
                  ? material.emissiveIntensity
                  : null,
              emissiveMapChannel:
                typeof emissiveMapMaterial?.emissiveMap?.channel === 'number'
                  ? emissiveMapMaterial.emissiveMap.channel
                  : null,
              envMapIntensity:
                typeof envMapMaterial?.envMapIntensity === 'number'
                  ? envMapMaterial.envMapIntensity
                  : null,
              hasEmissiveMap: materials.some((candidate) => Boolean(candidate.emissiveMap)),
              hasEnvMap: materials.some((candidate) => Boolean(candidate.envMap)),
              hasLightMap: materials.some((candidate) => Boolean(candidate.lightMap)),
              hasMap: materials.some((candidate) => Boolean(candidate.map)),
              hasUv1: Boolean(object.geometry?.getAttribute?.('uv1')),
              hasUv2: Boolean(object.geometry?.getAttribute?.('uv2')),
              layerMask: object.layers.mask,
              lightMapChannel:
                typeof lightMapMaterial?.lightMap?.channel === 'number'
                  ? lightMapMaterial.lightMap.channel
                  : null,
              lightMapIntensity:
                typeof lightMapMaterial?.lightMapIntensity === 'number'
                  ? lightMapMaterial.lightMapIntensity
                  : null,
              mapChannel:
                typeof mapMaterial?.map?.channel === 'number'
                  ? mapMaterial.map.channel
                  : null,
              materialColor: material.color
                ? [
                    material.color.r,
                    material.color.g,
                    material.color.b
                  ]
                : null,
              probeBlend: material.userData?.probeBlendDebug ?? null,
              probeBlendShader: material.userData?.probeBlendShaderDebug ?? null,
              probeBlendUniforms: material.userData?.probeBlendUniformDebug ?? null,
              quaternion: [
                object.quaternion.x,
                object.quaternion.y,
                object.quaternion.z,
                object.quaternion.w
              ],
              scale: [object.scale.x, object.scale.y, object.scale.z],
              visible: object.visible,
              worldQuaternion: [
                object.getWorldQuaternion(worldQuaternion).x,
                worldQuaternion.y,
                worldQuaternion.z,
                worldQuaternion.w
              ],
              worldPosition: [
                object.getWorldPosition(worldPosition).x,
                worldPosition.y,
                worldPosition.z
              ]
            }
          })
        }

        return match
      },
      getDebugProgramUniformState: (role, index) => {
        let match: Mesh | null = null

        for (const root of getDebugRoots()) {
          root.traverse((object) => {
            if (
              match ||
              !(object instanceof Mesh) ||
              !matchesDebugRole(object, role, index)
            ) {
              return
            }

            match = object
          })
        }

        if (!match) {
          return null
        }

        const materials = Array.isArray(match.material)
          ? match.material
          : [match.material]
        const material = materials[0] as {
          envMap?: Texture | null
          userData?: {
            probeBlendUniformDebug?: {
              localProbeTextureUUIDs?: Array<string | null>
            }
          }
        }
        const materialProperties = gl.properties.get(material)
        const currentProgram = materialProperties.currentProgram
        const rawGl = gl.getContext()
        const uniformMap = currentProgram?.getUniforms?.().map ?? {}
        const uniformsListIds = (materialProperties.uniformsList ?? []).map(
          (entry: { id?: string }) => entry.id ?? null
        )
        const localProbeTextureUUIDs =
          material.userData?.probeBlendUniformDebug?.localProbeTextureUUIDs ?? []
        const textureUUIDByUniformName: Record<string, string | null> = {
          envMap: material.envMap?.uuid ?? null,
          localProbeEnvMap0: localProbeTextureUUIDs[0] ?? null,
          localProbeEnvMap1: localProbeTextureUUIDs[1] ?? null,
          localProbeEnvMap2: localProbeTextureUUIDs[2] ?? null,
          localProbeEnvMap3: localProbeTextureUUIDs[3] ?? null,
          probeBlendMode: null,
          probeBlendRadianceMode: null
        }

        const uniforms = Object.fromEntries(
          Object.keys(textureUUIDByUniformName).map((name) => {
            const uniform = uniformMap[name]
            const glValue =
              currentProgram?.program && uniform?.addr
                ? rawGl.getUniform(currentProgram.program, uniform.addr)
                : null

            return [
              name,
              {
                cacheValue:
                  Array.isArray(uniform?.cache) && uniform.cache.length > 0
                    ? uniform.cache[0]
                    : null,
                glValue: ArrayBuffer.isView(glValue)
                  ? Array.from(glValue as ArrayLike<number>)
                  : typeof glValue === 'number'
                    ? glValue
                    : null,
                textureUUID: textureUUIDByUniformName[name] ?? null
              }
            ]
          })
        ) as Record<string, {
          cacheValue: number | null
          glValue: number | number[] | null
          textureUUID: string | null
        }>

        return {
          materialEnvMapUUID: material.envMap?.uuid ?? null,
          materialUniformValues: {
            probeBlendMode:
              typeof materialProperties.uniforms?.probeBlendMode?.value === 'number'
                ? materialProperties.uniforms.probeBlendMode.value
                : null,
            probeBlendRadianceMode:
              typeof materialProperties.uniforms?.probeBlendRadianceMode?.value === 'number'
                ? materialProperties.uniforms.probeBlendRadianceMode.value
                : null
          },
          uniformsListIds,
          uniforms
        }
      },
      getReflectionProbeState: () => {
        return scene.userData.reflectionProbeState ?? null
      },
      setView: (cameraPosition, target) => {
        playerPosition.current.set(
          cameraPosition[0],
          cameraPosition[1] - PLAYER_EYE_HEIGHT,
          cameraPosition[2]
        )
        velocity.current.set(0, 0, 0)
        keys.current = {}
        camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2])
        camera.lookAt(target[0], target[1], target[2])
        cameraEuler.setFromQuaternion(camera.quaternion, 'YXZ')
        yaw.current = cameraEuler.y
        pitch.current = cameraEuler.x
        camera.updateMatrixWorld()
      }
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getDebugPosition
      delete globalWindow.__levelsjamDebug.getDebugMeshState
      delete globalWindow.__levelsjamDebug.getDebugProgramUniformState
      delete globalWindow.__levelsjamDebug.getReflectionProbeState
      delete globalWindow.__levelsjamDebug.setView
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [camera, gl, scene])

  useFrame((_, delta) => {
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.copy(defaultMoveDirection)
    }

    right.current.crossVectors(forward.current, up).normalize()
    const maxPhysicsStep =
      0.25 /
      Math.max(
        resolvedMovementSettings.maxHorizontalSpeed,
        resolvedMovementSettings.maxVerticalSpeed,
        resolvedMovementSettings.maxFallSpeed
      ) /
      3
    let deltaRemaining = Math.min(maxPhysicsStep * MAX_PHYSICS_SUBSTEPS, delta)

    while (deltaRemaining > 0) {
      const deltaStep = Math.min(deltaRemaining, maxPhysicsStep)
      deltaRemaining -= deltaStep

      keyboardLocal.current.set(
        Number(Boolean(keys.current.KeyD)) - Number(Boolean(keys.current.KeyA)),
        0,
        Number(Boolean(keys.current.KeyW)) - Number(Boolean(keys.current.KeyS))
      )
      if (keyboardLocal.current.lengthSq() > 1) {
        keyboardLocal.current.normalize()
      }

      decelLocal.current.set(
        velocity.current.dot(right.current),
        0,
        velocity.current.dot(forward.current)
      ).clampLength(0, 1)

      decelLocal.current.x = decelLocal.current.x > 0
        ? Math.max(0, decelLocal.current.x - Math.max(0, keyboardLocal.current.x))
        : Math.min(0, decelLocal.current.x - Math.min(0, keyboardLocal.current.x))
      decelLocal.current.z = decelLocal.current.z > 0
        ? Math.max(0, decelLocal.current.z - Math.max(0, keyboardLocal.current.z))
        : Math.min(0, decelLocal.current.z - Math.min(0, keyboardLocal.current.z))

      decelWorld.current
        .copy(right.current)
        .multiplyScalar(-decelLocal.current.x)
        .addScaledVector(forward.current, -decelLocal.current.z)

      accelWorld.current
        .copy(right.current)
        .multiplyScalar(keyboardLocal.current.x)
        .addScaledVector(forward.current, keyboardLocal.current.z)
      if (accelWorld.current.lengthSq() > 1) {
        accelWorld.current.normalize()
      }

      velocity.current.addScaledVector(
        decelWorld.current,
        deltaStep *
          (
            resolvedMovementSettings.maxHorizontalSpeed *
            resolvedMovementSettings.maxHorizontalSpeed /
            (2 * resolvedMovementSettings.horizontalDecelerationDistance)
          )
      )
      velocity.current.addScaledVector(
        accelWorld.current,
        deltaStep *
          (
            resolvedMovementSettings.maxHorizontalSpeed *
            resolvedMovementSettings.maxHorizontalSpeed /
            (2 * resolvedMovementSettings.horizontalAccelerationDistance)
          )
      )

      const horizontalSpeed = Math.hypot(velocity.current.x, velocity.current.z)
      if (horizontalSpeed > resolvedMovementSettings.maxHorizontalSpeed) {
        const scale = resolvedMovementSettings.maxHorizontalSpeed / horizontalSpeed
        velocity.current.x *= scale
        velocity.current.z *= scale
      }

      velocity.current.y = updateVerticalVelocity(
        velocity.current.y,
        grounded.current,
        Boolean(keys.current.Space),
        deltaStep,
        resolvedMovementSettings
      )

      intendedPosition.current
        .copy(playerPosition.current)
        .addScaledVector(velocity.current, deltaStep)

      const collision = resolvePlayerCollision(
        {
          x: playerPosition.current.x,
          y: playerPosition.current.y,
          z: playerPosition.current.z
        },
        {
          x: intendedPosition.current.x,
          y: intendedPosition.current.y,
          z: intendedPosition.current.z
        },
        { wallBounds }
      )

      if (collision.position.y !== intendedPosition.current.y) {
        velocity.current.y = 0
      }

      for (const normal of collision.collisions.wallNormals) {
        const dot =
          (velocity.current.x * normal.x) +
          (velocity.current.y * normal.y) +
          (velocity.current.z * normal.z)

        if (dot >= 0) {
          continue
        }

        velocity.current.addScaledVector(
          new Vector3(normal.x, normal.y, normal.z),
          -dot
        )
      }

      grounded.current = collision.grounded && !keys.current.Space
      playerPosition.current.set(
        collision.position.x,
        collision.position.y,
        collision.position.z
      )
    }

    const cameraPosition = getCameraPosition(playerPosition.current)

    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  }, -1)

  return null
}

function Scene({
  composerEnabled,
  controlsOpen,
  layout,
  onAssetsReady,
  visualSettings
}: {
  composerEnabled: boolean
  controlsOpen: boolean
  layout: MazeLayout
  onAssetsReady: () => void
  visualSettings: VisualSettings
}) {
  useEffect(() => {
    onAssetsReady()
  }, [onAssetsReady])

  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const [environmentTexture, setEnvironmentTexture] = useState<Texture | null>(null)
  const [environmentFogColor, setEnvironmentFogColor] = useState(() => DEFAULT_FOG_IBL_COLOR.clone())
  const [reflectionProbeAmbientColors, setReflectionProbeAmbientColors] = useState<Color[]>([])
  const [reflectionProbeRawTextures, setReflectionProbeRawTextures] = useState<Texture[]>([])
  const [reflectionProbeTextures, setReflectionProbeTextures] = useState<Texture[]>([])
  const environmentIntensity = useMemo(
    () => getHdrLightingIntensity(visualSettings.iblIntensity),
    [visualSettings.iblIntensity]
  )

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        clearDebugIsolation?: () => void
        getFogState?: () => {
          density: number | null
          environmentFogColor: [number, number, number] | null
          hasProbeAmbientTexture: boolean
          meshCount: number
          noiseFrequency: number | null
          probeAmbientBounds: [number, number, number, number] | null
          probeAmbientGrid: [number, number] | null
          useProbeAmbientTexture: number | null
        } | null
        setDebugVisible?: (
          role: string,
          index: number,
          visible: boolean
        ) => void
        isolateDebugRole?: (role: string, index: number) => void
        captureReflectionProbeAtlas?: (
          probeIndex: number,
          size?: number
        ) => string[] | null
        captureReflectionProbeProcessedAtlas?: (
          probeIndex: number,
          size?: number
        ) => string[] | null
        captureReflectionProbeGeometryAtlas?: (
          probeIndex: number,
          size?: number
        ) => string[] | null
        captureReflectionProbeWallMaterialContinuum?: (
          probeIndex: number,
          wallIndex: number,
          size?: number
        ) => Array<{
          atlasUrls: string[] | null
          key: WallMaterialContinuumStepKey
          label: string
        }> | null
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    const debugRoots = [scene]
    let restoreDebugIsolation = () => {}

    const setDebugVisible = (role: string, index: number, visible: boolean) => {
      for (const root of debugRoots) {
        root.traverse((object) => {
          if (matchesDebugRole(object, role, index)) {
            object.visible = visible
          }
        })
      }
    }

    const clearDebugIsolation = () => {
      restoreDebugIsolation()
      restoreDebugIsolation = () => {}
    }

    const getFogState = () => {
      let density: number | null = null
      let environmentFogColor: [number, number, number] | null = null
      let hasProbeAmbientTexture = false
      let meshCount = 0
      let noiseFrequency: number | null = null
      let probeAmbientBounds: [number, number, number, number] | null = null
      let probeAmbientGrid: [number, number] | null = null
      let useProbeAmbientTexture: number | null = null

      for (const root of debugRoots) {
        root.traverse((object) => {
          if (
            !(object instanceof Mesh) ||
            object.userData?.debugRole !== 'global-fog-volume'
          ) {
            return
          }

          meshCount += 1

          const material = object.material as {
            uniforms?: {
              density?: { value: number }
              environmentFogColor?: { value: Color }
              noiseFrequency?: { value: number }
              probeAmbientBounds?: { value: Vector4 }
              probeAmbientGrid?: { value: Vector2 }
              probeAmbientTexture?: { value: Texture | null }
              useProbeAmbientTexture?: { value: number }
            }
          }
          const uniforms = material.uniforms

          if (!uniforms || density !== null) {
            return
          }

          density =
            typeof uniforms.density?.value === 'number'
              ? uniforms.density.value
              : null
          environmentFogColor = uniforms.environmentFogColor?.value
            ? [
                uniforms.environmentFogColor.value.r,
                uniforms.environmentFogColor.value.g,
                uniforms.environmentFogColor.value.b
              ]
            : null
          hasProbeAmbientTexture = Boolean(uniforms.probeAmbientTexture?.value)
          noiseFrequency =
            typeof uniforms.noiseFrequency?.value === 'number'
              ? uniforms.noiseFrequency.value
              : null
          probeAmbientBounds = uniforms.probeAmbientBounds?.value
            ? [
                uniforms.probeAmbientBounds.value.x,
                uniforms.probeAmbientBounds.value.y,
                uniforms.probeAmbientBounds.value.z,
                uniforms.probeAmbientBounds.value.w
              ]
            : null
          probeAmbientGrid = uniforms.probeAmbientGrid?.value
            ? [
                uniforms.probeAmbientGrid.value.x,
                uniforms.probeAmbientGrid.value.y
              ]
            : null
          useProbeAmbientTexture =
            typeof uniforms.useProbeAmbientTexture?.value === 'number'
              ? uniforms.useProbeAmbientTexture.value
              : null
        })
      }

      return {
        density,
        environmentFogColor,
        hasProbeAmbientTexture,
        meshCount,
        noiseFrequency,
        probeAmbientBounds,
        probeAmbientGrid,
        useProbeAmbientTexture
      }
    }

    const isolateDebugRole = (role: string, index: number) => {
      clearDebugIsolation()
      const savedVisibility: Array<{ object: { visible: boolean }, visible: boolean }> = []
      const savedMeshes: Array<{
        castShadow: boolean
        mesh: Mesh
        receiveShadow: boolean
      }> = []
      const savedBackground = scene.background
      const savedEnvironment = scene.environment

      for (const root of debugRoots) {
        root.traverse((object) => {
          savedVisibility.push({ object, visible: object.visible })
          const match = matchesDebugRole(object, role, index)

          if (
            !match &&
            (object instanceof Mesh ||
              'isLight' in object)
          ) {
            object.visible = false
          }

          if (match && object instanceof Mesh) {
            savedMeshes.push({
              castShadow: object.castShadow,
              mesh: object,
              receiveShadow: object.receiveShadow
            })
            object.castShadow = false
            object.receiveShadow = false
          }
        })
      }

      scene.background = new Color('white')
      scene.environment = null
      scene.visible = true

      restoreDebugIsolation = () => {
        for (const entry of savedVisibility) {
          entry.object.visible = entry.visible
        }
        for (const entry of savedMeshes) {
          entry.mesh.castShadow = entry.castShadow
          entry.mesh.receiveShadow = entry.receiveShadow
        }
        scene.background = savedBackground
        scene.environment = savedEnvironment
      }
    }

    const captureReflectionProbeAtlas = (probeIndex: number, size = 128) => {
      const probeTexture = reflectionProbeRawTextures[probeIndex]

      if (!probeTexture || size <= 0) {
        return null
      }

      return captureCubeTextureAtlasDataUrls(gl, probeTexture, size)
    }

    const captureReflectionProbeProcessedAtlas = (probeIndex: number, size = 128) => {
      const probeTexture = reflectionProbeTextures[probeIndex]

      if (!probeTexture || size <= 0) {
        return null
      }

      return captureCubeUvTextureAtlasDataUrls(gl, probeTexture, size)
    }

    const getReflectionProbeTextureState = (probeIndex: number) => ({
      processedTextureUUID: reflectionProbeTextures[probeIndex]?.uuid ?? null,
      rawTextureUUID: reflectionProbeRawTextures[probeIndex]?.uuid ?? null
    })

    const captureReflectionProbeGeometryAtlas = (probeIndex: number, size = 128) => {
      const probe = layout.reflectionProbes[probeIndex]

      if (!probe || size <= 0) {
        return null
      }

      const hiddenObjects: Array<{ object: { visible: boolean }, visible: boolean }> = []
      const savedBackground = scene.background
      const savedEnvironment = scene.environment
      const savedOverrideMaterial = scene.overrideMaterial
      const geometryOverrideMaterial = new MeshBasicMaterial({
        color: 'white',
        side: DoubleSide
      })
      const geometryTarget = new WebGLCubeRenderTarget(size, {
        type: UnsignedByteType
      })
      const geometryCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, geometryTarget)

      scene.traverse((object) => {
        if (
          object.userData?.debugRole === 'torch-lens-flare' ||
          object.userData?.debugRole === 'global-fog-volume' ||
          object.userData?.debugRole === 'reflection-probe-visual' ||
          object.userData?.debugRole === 'torch-billboard'
        ) {
          hiddenObjects.push({ object, visible: object.visible })
          object.visible = false
        }
      })

      scene.background = new Color('black')
      scene.environment = null
      scene.overrideMaterial = geometryOverrideMaterial
      geometryCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )

      try {
        scene.add(geometryCamera)
        geometryCamera.update(gl, scene)
        scene.remove(geometryCamera)

        return captureCubeTextureAtlasDataUrls(gl, geometryTarget.texture, size, {
          toneMap: false
        })
      } finally {
        scene.background = savedBackground
        scene.environment = savedEnvironment
        scene.overrideMaterial = savedOverrideMaterial
        geometryOverrideMaterial.dispose()
        geometryTarget.dispose()
        scene.remove(geometryCamera)
        for (const entry of hiddenObjects) {
          entry.object.visible = entry.visible
        }
      }
    }

    const captureReflectionProbeWallMaterialContinuum = (
      probeIndex: number,
      wallIndex: number,
      size = 128
    ) => {
      const probe = layout.reflectionProbes[probeIndex]

      if (!probe || size <= 0 || !environmentTexture) {
        return null
      }

      let targetWall: Mesh | null = null
      scene.traverse((object) => {
        if (
          !targetWall &&
          object instanceof Mesh &&
          matchesDebugRole(object, 'maze-wall', wallIndex)
        ) {
          targetWall = object
        }
      })

      if (!targetWall) {
        return null
      }

      const sourceMaterials = (
        Array.isArray(targetWall.material)
          ? targetWall.material
          : [targetWall.material]
      )

      if (!sourceMaterials.every((material) => material instanceof ThreeMeshStandardMaterial)) {
        return null
      }

      const originalMaterials = [...sourceMaterials] as ThreeMeshStandardMaterial[]
      const savedVisibility: Array<{ object: { visible: boolean }, visible: boolean }> = []
      const savedBackground = scene.background
      const savedBackgroundIntensity = scene.backgroundIntensity
      const savedEnvironment = scene.environment
      const savedEnvironmentIntensity = scene.environmentIntensity
      const captureTarget = new WebGLCubeRenderTarget(size, { type: HalfFloatType })
      const captureCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, captureTarget)
      const continuumSteps = getWallMaterialContinuumSteps()
      const results: Array<{
        atlasUrls: string[] | null
        key: WallMaterialContinuumStepKey
        label: string
      }> = []

      captureCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )
      captureCamera.layers.enable(TORCH_BILLBOARD_LAYER)

      scene.traverse((object) => {
        savedVisibility.push({ object, visible: object.visible })
        if (object === targetWall) {
          return
        }
        if (
          object instanceof Mesh ||
          'isLight' in object
        ) {
          object.visible = false
        }
      })

      scene.background = new Color('black')
      scene.backgroundIntensity = 1
      scene.environment = environmentTexture
      scene.environmentIntensity = environmentIntensity

      try {
        for (const step of continuumSteps) {
          let replacementMaterials: Array<MeshBasicMaterial | ThreeMeshStandardMaterial> | null = null

          if (step.key !== 'runtime-original') {
            replacementMaterials = originalMaterials.map((material) =>
              createWallMaterialContinuumStepMaterial(material, step.key)
            )
            targetWall.material = replacementMaterials
          } else {
            targetWall.material = originalMaterials
          }

          scene.add(captureCamera)
          captureCamera.update(gl, scene)
          scene.remove(captureCamera)
          results.push({
            atlasUrls: captureCubeTextureAtlasDataUrls(gl, captureTarget.texture, size),
            key: step.key,
            label: step.label
          })

          if (replacementMaterials) {
            targetWall.material = originalMaterials
            for (const material of replacementMaterials) {
              material.dispose()
            }
          }
        }
      } finally {
        targetWall.material = originalMaterials
        scene.remove(captureCamera)
        captureTarget.dispose()
        scene.background = savedBackground
        scene.backgroundIntensity = savedBackgroundIntensity
        scene.environment = savedEnvironment
        scene.environmentIntensity = savedEnvironmentIntensity
        for (const entry of savedVisibility) {
          entry.object.visible = entry.visible
        }
      }

      return results
    }

    globalWindow.__levelsjamDebug = {
      ...existing,
      captureReflectionProbeAtlas,
      captureReflectionProbeProcessedAtlas,
      captureReflectionProbeGeometryAtlas,
      captureReflectionProbeWallMaterialContinuum,
      clearDebugIsolation,
      getFogState,
      getReflectionProbeTextureState,
      isolateDebugRole,
      setDebugVisible
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      clearDebugIsolation()
      delete globalWindow.__levelsjamDebug.captureReflectionProbeAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeProcessedAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeGeometryAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeWallMaterialContinuum
      delete globalWindow.__levelsjamDebug.clearDebugIsolation
      delete globalWindow.__levelsjamDebug.getFogState
      delete globalWindow.__levelsjamDebug.getReflectionProbeTextureState
      delete globalWindow.__levelsjamDebug.setDebugVisible
      delete globalWindow.__levelsjamDebug.isolateDebugRole
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [environmentIntensity, environmentTexture, gl, layout, reflectionProbeRawTextures, reflectionProbeTextures, scene])

  const ambientOcclusionActive = isAmbientOcclusionActive(visualSettings)
  const bloomActive = isEffectActive(visualSettings.bloom)
  const depthOfFieldActive = isDepthOfFieldActive(visualSettings.depthOfField)
  const lensFlareActive = isEffectActive(visualSettings.lensFlare)
  const ssrActive = isEffectActive(visualSettings.ssr)
  const vignetteActive = isEffectActive(visualSettings.vignette)

  return (
    <>
      <EnvironmentLighting
        iblIntensity={visualSettings.iblIntensity}
        layout={layout}
        onEnvironmentFogColorChange={setEnvironmentFogColor}
        onEnvironmentTextureChange={setEnvironmentTexture}
        onReflectionProbeAmbientColorsChange={setReflectionProbeAmbientColors}
        onReflectionProbeRawTexturesChange={setReflectionProbeRawTextures}
        onReflectionProbeTexturesChange={setReflectionProbeTextures}
      />
      <SceneGeometry
        bakedLightmapsEnabled={visualSettings.bakedLightmapsEnabled}
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        environmentFogColor={environmentFogColor}
        layout={layout}
        probeIblEnabled={visualSettings.probeIblEnabled}
        reflectionProbeAmbientColors={reflectionProbeAmbientColors}
        reflectionCapturesEnabled={visualSettings.reflectionCapturesEnabled}
        reflectionProbeTextures={reflectionProbeTextures}
        showReflectionProbes={visualSettings.showReflectionProbes}
        torchCandelaMultiplier={visualSettings.torchCandelaMultiplier}
        volumetricLighting={visualSettings.volumetricLighting}
        volumetricNoiseFrequency={visualSettings.volumetricNoiseFrequency}
      />
      <EffectComposer
        enableNormalPass
        multisampling={0}
        resolutionScale={0.5}
      >
        {ambientOcclusionActive && visualSettings.ambientOcclusionMode === 'n8ao' ? (
          <N8AO
            aoRadius={visualSettings.ambientOcclusionRadius}
            color="#000000"
            denoiseRadius={6}
            distanceFalloff={1}
            intensity={visualSettings.ambientOcclusionIntensity * 3}
            quality="medium"
          />
        ) : null}
        {ambientOcclusionActive && visualSettings.ambientOcclusionMode === 'ssao' ? (
          <SSAO
            key={`ssao-${visualSettings.ambientOcclusionIntensity}-${visualSettings.ambientOcclusionRadius}`}
            bias={0.025}
            depthAwareUpsampling
            distanceFalloff={0.03}
            distanceThreshold={0.97}
            intensity={visualSettings.ambientOcclusionIntensity * 4}
            luminanceInfluence={0.2}
            radius={Math.max(6, visualSettings.ambientOcclusionRadius * 24)}
            rangeFalloff={0.001}
            rangeThreshold={0.0005}
            resolutionScale={1}
            rings={6}
            samples={48}
          />
        ) : null}
        {ssrActive ? (
          <SSREffectPrimitive intensity={visualSettings.ssr.intensity} />
        ) : null}
        <BillboardCompositePass />
        {bloomActive ? (
          <BloomEffectPrimitive
            intensity={visualSettings.bloom.intensity}
            kernelSize={visualSettings.bloom.kernelSize}
          />
        ) : null}
        {depthOfFieldActive ? (
          <DepthOfField
            bokehScale={visualSettings.depthOfField.bokehScale}
            focalLength={visualSettings.depthOfField.focalLength}
            focusDistance={visualSettings.depthOfField.focusDistance}
            resolutionScale={0.25}
          />
        ) : null}
        {lensFlareActive ? (
          <TorchLensFlare
            intensity={visualSettings.lensFlare.intensity}
            layout={layout}
            torchCandelaMultiplier={visualSettings.torchCandelaMultiplier}
          />
        ) : null}
        {vignetteActive ? (
          <Vignette darkness={visualSettings.vignette.intensity} />
        ) : null}
        <ExposureEffectPrimitive
          exposure={getRendererExposure(visualSettings.exposureStops)}
        />
        <ToneMapping
          mode={TONE_MAPPING_MODES[visualSettings.toneMapping]}
          resolution={256}
        />
      </EffectComposer>
      <FlightRig
        controlsOpen={controlsOpen}
        movementSettings={visualSettings.movement}
        wallBounds={getWallBounds(layout)}
      />
      <PerformanceBenchmarkBridge />
      <StartupReporter />
    </>
  )
}

function ResettableLabel({
  children,
  onReset
}: {
  children: ReactNode
  onReset: () => void
}) {
  return (
    <span
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onReset()
      }}
      title="Double-click to reset"
    >
      {children}
    </span>
  )
}

function VisualControls({
  onAmbientOcclusionModeChange,
  onBooleanSettingChange,
  onBloomSettingChange,
  controlsOpen,
  onDepthOfFieldSettingChange,
  onEffectSettingChange,
  onResetAmbientOcclusionMode,
  onResetBloomSettings,
  onResetBooleanSetting,
  onResetDepthOfFieldSettings,
  onResetEffectSetting,
  onResetScalarSetting,
  onResetToneMapping,
  onScalarSettingChange,
  onToneMappingChange,
  visualSettings
}: {
  onAmbientOcclusionModeChange: (value: AmbientOcclusionMode) => void
  onBooleanSettingChange: (
    key: BooleanSettingKey,
    value: boolean
  ) => void
  onBloomSettingChange: (patch: Partial<BloomSettings>) => void
  controlsOpen: boolean
  onDepthOfFieldSettingChange: (patch: Partial<DepthOfFieldSettings>) => void
  onEffectSettingChange: (
    effect: GenericEffectSettingKey,
    patch: Partial<EffectSettings>
  ) => void
  onResetAmbientOcclusionMode: () => void
  onResetBloomSettings: () => void
  onResetBooleanSetting: (key: BooleanSettingKey) => void
  onResetDepthOfFieldSettings: () => void
  onResetEffectSetting: (effect: GenericEffectSettingKey) => void
  onResetScalarSetting: (key: ScalarSettingKey) => void
  onResetToneMapping: () => void
  onScalarSettingChange: (key: ScalarSettingKey, value: number) => void
  onToneMappingChange: (value: ToneMappingMode) => void
  visualSettings: VisualSettings
}) {
  if (!controlsOpen) {
    return null
  }

  const effectControls: Array<{
    key: GenericEffectSettingKey
    label: string
    max: number
    min: number
    step: number
  }> = [
    { key: 'lensFlare', label: 'Lens Flares', min: 0, max: 0.02, step: 0.0001 },
    { key: 'ssr', label: 'SSR', min: 0, max: 1, step: 0.01 },
    { key: 'volumetricLighting', label: 'Volumetric Fog', min: 0, max: 1, step: 0.01 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.05 }
  ]

  return (
    <aside
      className="visual-controls"
      data-testid="visual-controls"
    >
      <div className="visual-controls-header">
        <strong>Visual Controls</strong>
        <span>Press ` to close</span>
      </div>

      <label className="visual-control-row">
        <output>{visualSettings.exposureStops.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('exposureStops')}>
          Exposure
        </ResettableLabel>
        <input
          aria-label="Exposure"
          max={20}
          min={-20}
          onChange={(event) => {
            onScalarSettingChange('exposureStops', Number(event.target.value))
          }}
          step={0.25}
          type="range"
          value={visualSettings.exposureStops}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.iblIntensity.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('iblIntensity')}>
          IBL Intensity
        </ResettableLabel>
        <input
          aria-label="IBL Intensity"
          max={MAX_IBL_INTENSITY_MULTIPLIER}
          min={MIN_IBL_INTENSITY_MULTIPLIER}
          onChange={(event) => {
            onScalarSettingChange('iblIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.iblIntensity}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.torchCandelaMultiplier.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('torchCandelaMultiplier')}>
          Torch Candelas
        </ResettableLabel>
        <input
          aria-label="Torch Candelas"
          max={MAX_TORCH_CANDELA_MULTIPLIER}
          min={MIN_TORCH_CANDELA_MULTIPLIER}
          onChange={(event) => {
            onScalarSettingChange(
              'torchCandelaMultiplier',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.torchCandelaMultiplier}
        />
      </label>

      <label className="visual-control-row">
        <output>
          {TONE_MAPPING_OPTIONS.find(
            (option) => option.key === visualSettings.toneMapping
          )?.label ?? visualSettings.toneMapping}
        </output>
        <ResettableLabel onReset={onResetToneMapping}>
          Tone Mapper
        </ResettableLabel>
        <select
          aria-label="Tone Mapper"
          onChange={(event) => {
            onToneMappingChange(event.target.value as ToneMappingMode)
          }}
          value={visualSettings.toneMapping}
        >
          {TONE_MAPPING_OPTIONS.map((option) => (
            <option
              key={option.key}
              value={option.key}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="visual-control-row">
        <output>{visualSettings.bakedLightmapsEnabled ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('bakedLightmapsEnabled')}>
          Baked Lightmaps
        </ResettableLabel>
        <input
          aria-label="Baked Lightmaps"
          checked={visualSettings.bakedLightmapsEnabled}
          onChange={(event) => {
            onBooleanSettingChange('bakedLightmapsEnabled', event.target.checked)
          }}
          type="checkbox"
        />
      </div>

      <div className="visual-control-row">
        <output>{visualSettings.reflectionCapturesEnabled ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('reflectionCapturesEnabled')}>
          Reflection Captures
        </ResettableLabel>
        <input
          aria-label="Reflection Captures"
          checked={visualSettings.reflectionCapturesEnabled}
          onChange={(event) => {
            onBooleanSettingChange('reflectionCapturesEnabled', event.target.checked)
          }}
          type="checkbox"
        />
      </div>

      <div className="visual-control-row">
        <output>{visualSettings.probeIblEnabled ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('probeIblEnabled')}>
          Probe IBL
        </ResettableLabel>
        <input
          aria-label="Probe IBL"
          checked={visualSettings.probeIblEnabled}
          onChange={(event) => {
            onBooleanSettingChange('probeIblEnabled', event.target.checked)
          }}
          type="checkbox"
        />
      </div>

      <div className="visual-control-row">
        <output>{visualSettings.showReflectionProbes ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('showReflectionProbes')}>
          Show Reflection Probes
        </ResettableLabel>
        <input
          aria-label="Show Reflection Probes"
          checked={visualSettings.showReflectionProbes}
          onChange={(event) => {
            onBooleanSettingChange('showReflectionProbes', event.target.checked)
          }}
          type="checkbox"
        />
      </div>

      <label className="visual-control-row">
        <output>{visualSettings.movement.maxHorizontalSpeedMph.toFixed(1)}mph</output>
        <ResettableLabel onReset={() => onResetScalarSetting('movementMaxHorizontalSpeedMph')}>
          Move Speed
        </ResettableLabel>
        <input
          aria-label="Move Speed"
          max={40}
          min={1}
          onChange={(event) => {
            onScalarSettingChange(
              'movementMaxHorizontalSpeedMph',
              Number(event.target.value)
            )
          }}
          step={0.5}
          type="range"
          value={visualSettings.movement.maxHorizontalSpeedMph}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.movement.accelerationDistance.toFixed(2)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('movementAccelerationDistance')}>
          Accel Distance
        </ResettableLabel>
        <input
          aria-label="Accel Distance"
          max={12}
          min={0.25}
          onChange={(event) => {
            onScalarSettingChange(
              'movementAccelerationDistance',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.movement.accelerationDistance}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.movement.decelerationDistance.toFixed(2)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('movementDecelerationDistance')}>
          Decel Distance
        </ResettableLabel>
        <input
          aria-label="Decel Distance"
          max={4}
          min={0.1}
          onChange={(event) => {
            onScalarSettingChange(
              'movementDecelerationDistance',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.movement.decelerationDistance}
        />
      </label>

      <label className="visual-control-row">
        <output>
          {AMBIENT_OCCLUSION_OPTIONS.find(
            (option) => option.key === visualSettings.ambientOcclusionMode
          )?.label ?? visualSettings.ambientOcclusionMode}
        </output>
        <ResettableLabel onReset={onResetAmbientOcclusionMode}>
          Ambient Occlusion
        </ResettableLabel>
        <select
          aria-label="Ambient Occlusion"
          onChange={(event) => {
            onAmbientOcclusionModeChange(event.target.value as AmbientOcclusionMode)
          }}
          value={visualSettings.ambientOcclusionMode}
        >
          {AMBIENT_OCCLUSION_OPTIONS.map((option) => (
            <option
              key={option.key}
              value={option.key}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.ambientOcclusionIntensity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('ambientOcclusionIntensity')}>
          AO Intensity
        </ResettableLabel>
        <input
          aria-label="AO Intensity"
          max={5}
          min={0}
          onChange={(event) => {
            onScalarSettingChange(
              'ambientOcclusionIntensity',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.ambientOcclusionIntensity}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.ambientOcclusionRadius.toFixed(2)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('ambientOcclusionRadius')}>
          AO Radius
        </ResettableLabel>
        <input
          aria-label="AO Radius"
          max={4}
          min={0.1}
          onChange={(event) => {
            onScalarSettingChange(
              'ambientOcclusionRadius',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.ambientOcclusionRadius}
        />
      </label>

      <div className="visual-control-row">
        <output>
          {visualSettings.bloom.enabled ? visualSettings.bloom.intensity.toFixed(2) : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.bloom.enabled}
            onChange={(event) => {
              onBloomSettingChange({
                enabled: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={onResetBloomSettings}>
            Bloom
          </ResettableLabel>
        </label>
        <input
          aria-label="Bloom Intensity"
          disabled={!visualSettings.bloom.enabled}
          max={3}
          min={0}
          onChange={(event) => {
            onBloomSettingChange({
              intensity: Number(event.target.value)
            })
          }}
          step={0.05}
          type="range"
          value={visualSettings.bloom.intensity}
        />
      </div>

      <label className="visual-control-row">
        <output>
          {BLOOM_KERNEL_OPTIONS.find(
            (option) => option.key === visualSettings.bloom.kernelSize
          )?.label ?? visualSettings.bloom.kernelSize}
        </output>
        <ResettableLabel onReset={onResetBloomSettings}>
          Bloom Kernel
        </ResettableLabel>
        <select
          aria-label="Bloom Kernel"
          disabled={!visualSettings.bloom.enabled}
          onChange={(event) => {
            onBloomSettingChange({
              kernelSize: event.target.value as BloomKernelSizeKey
            })
          }}
          value={visualSettings.bloom.kernelSize}
        >
          {BLOOM_KERNEL_OPTIONS.map((option) => (
            <option
              key={option.key}
              value={option.key}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="visual-control-row">
        <output>
          {visualSettings.depthOfField.enabled
            ? visualSettings.depthOfField.bokehScale.toFixed(2)
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.depthOfField.enabled}
            onChange={(event) => {
              onDepthOfFieldSettingChange({
                enabled: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={onResetDepthOfFieldSettings}>
            Depth Of Field
          </ResettableLabel>
        </label>
        <input
          aria-label="Depth Of Field Bokeh Scale"
          disabled={!visualSettings.depthOfField.enabled}
          max={5}
          min={0}
          onChange={(event) => {
            onDepthOfFieldSettingChange({
              bokehScale: Number(event.target.value)
            })
          }}
          step={0.05}
          type="range"
          value={visualSettings.depthOfField.bokehScale}
        />
      </div>

      <label className="visual-control-row">
        <output>{visualSettings.depthOfField.focusDistance.toFixed(3)}</output>
        <ResettableLabel onReset={onResetDepthOfFieldSettings}>
          DOF Focus Distance (m)
        </ResettableLabel>
        <input
          aria-label="DOF Focus Distance"
          disabled={!visualSettings.depthOfField.enabled}
          max={8}
          min={0}
          onChange={(event) => {
            onDepthOfFieldSettingChange({
              focusDistance: Number(event.target.value)
            })
          }}
          step={0.001}
          type="range"
          value={visualSettings.depthOfField.focusDistance}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.depthOfField.focalLength.toFixed(3)}</output>
        <ResettableLabel onReset={onResetDepthOfFieldSettings}>
          DOF Focal Length / Range (m)
        </ResettableLabel>
        <input
          aria-label="DOF Focal Length"
          disabled={!visualSettings.depthOfField.enabled}
          max={0.2}
          min={0}
          onChange={(event) => {
            onDepthOfFieldSettingChange({
              focalLength: Number(event.target.value)
            })
          }}
          step={0.001}
          type="range"
          value={visualSettings.depthOfField.focalLength}
        />
      </label>

      <label className="visual-control-row">
        <output>{visualSettings.volumetricNoiseFrequency.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricNoiseFrequency')}>
          Fog Noise Frequency
        </ResettableLabel>
        <input
          aria-label="Fog Noise Frequency"
          max={8}
          min={0.25}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricNoiseFrequency',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.volumetricNoiseFrequency}
        />
      </label>

      {effectControls.map((effectControl) => {
        const effectSettings = visualSettings[effectControl.key]

        return (
          <div
            className="visual-control-row"
            key={effectControl.key}
          >
            <output>
              {effectSettings.enabled
                ? effectControl.key === 'lensFlare'
                  ? effectSettings.intensity.toFixed(3)
                  : effectSettings.intensity.toFixed(2)
                : 'off'}
            </output>
            <label className="visual-effect-label">
              <input
                checked={effectSettings.enabled}
                onChange={(event) => {
                  onEffectSettingChange(effectControl.key, {
                    enabled: event.target.checked
                  })
                }}
                type="checkbox"
              />
              <ResettableLabel onReset={() => onResetEffectSetting(effectControl.key)}>
                {effectControl.label}
              </ResettableLabel>
            </label>
            <input
              aria-label={`${effectControl.label} Intensity`}
              disabled={!effectSettings.enabled}
              max={effectControl.max}
              min={effectControl.min}
              onChange={(event) => {
                onEffectSettingChange(effectControl.key, {
                  intensity: Number(event.target.value)
                })
              }}
              step={effectControl.step}
              type="range"
              value={effectSettings.intensity}
            />
          </div>
        )
      })}
    </aside>
  )
}

export default function App() {
  const [controlsOpen, setControlsOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const requestedMazeId = useMemo(
    () => new URLSearchParams(window.location.search).get('maze'),
    []
  )
  const [mazeLayout, setMazeLayout] = useState<MazeLayout | null>(null)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [visualSettings, setVisualSettings] = useState(createDefaultVisualSettings)
  const composerEnabled = true

  useEffect(() => {
    let cancelled = false

    const loadLayout = async () => {
      setSceneLoaded(false)

      const debugLayout = requestedMazeId
        ? getDebugMazeLayoutById(requestedMazeId)
        : null

      if (debugLayout) {
        if (!cancelled) {
          setMazeLayout(debugLayout)
        }
        return
      }

      const nextLayout =
        (requestedMazeId
          ? await loadMazeLayoutById(requestedMazeId)
          : null) ??
        await loadRandomMazeLayout()

      if (!cancelled) {
        setMazeLayout(nextLayout)
      }
    }

    void loadLayout()

    return () => {
      cancelled = true
    }
  }, [requestedMazeId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === OVERLAY_TOGGLE_CODE) {
        event.preventDefault()
        setOverlayVisible((visible) => !visible)
        return
      }

      if (event.code !== BACKQUOTE_CODE) {
        return
      }

      event.preventDefault()
      setControlsOpen((open) => !open)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const onScalarSettingChange = (key: ScalarSettingKey, value: number) => {
    setVisualSettings((current) => {
      if (key === 'movementAccelerationDistance') {
        return {
          ...current,
          movement: {
            ...current.movement,
            accelerationDistance: value
          }
        }
      }

      if (key === 'movementDecelerationDistance') {
        return {
          ...current,
          movement: {
            ...current.movement,
            decelerationDistance: value
          }
        }
      }

      if (key === 'movementMaxHorizontalSpeedMph') {
        return {
          ...current,
          movement: {
            ...current.movement,
            maxHorizontalSpeedMph: value
          }
        }
      }

      return {
        ...current,
        [key]: value
      }
    })
  }

  const onEffectSettingChange = (
    effect: GenericEffectSettingKey,
    patch: Partial<EffectSettings>
  ) => {
    setVisualSettings((current) => ({
      ...current,
      [effect]: {
        ...current[effect],
        ...patch
      }
    }))
  }

  const onBloomSettingChange = (patch: Partial<BloomSettings>) => {
    setVisualSettings((current) => ({
      ...current,
      bloom: {
        ...current.bloom,
        ...patch
      }
    }))
  }

  const onDepthOfFieldSettingChange = (patch: Partial<DepthOfFieldSettings>) => {
    setVisualSettings((current) => ({
      ...current,
      depthOfField: {
        ...current.depthOfField,
        ...patch
      }
    }))
  }

  const onToneMappingChange = (value: ToneMappingMode) => {
    setVisualSettings((current) => ({
      ...current,
      toneMapping: value
    }))
  }

  const onAmbientOcclusionModeChange = (value: AmbientOcclusionMode) => {
    setVisualSettings((current) => ({
      ...current,
      ambientOcclusionMode: value
    }))
  }

  const onBooleanSettingChange = (
    key: BooleanSettingKey,
    value: boolean
  ) => {
    setVisualSettings((current) => ({
      ...current,
      [key]: value
    }))
  }

  const onResetScalarSetting = (key: ScalarSettingKey) => {
    const defaults = createDefaultVisualSettings()

    if (key === 'movementAccelerationDistance') {
      onScalarSettingChange(key, defaults.movement.accelerationDistance)
      return
    }

    if (key === 'movementDecelerationDistance') {
      onScalarSettingChange(key, defaults.movement.decelerationDistance)
      return
    }

    if (key === 'movementMaxHorizontalSpeedMph') {
      onScalarSettingChange(key, defaults.movement.maxHorizontalSpeedMph)
      return
    }

    onScalarSettingChange(key, defaults[key])
  }

  const onResetEffectSetting = (effect: GenericEffectSettingKey) => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      [effect]: {
        ...defaults[effect]
      }
    }))
  }

  const onResetBloomSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      bloom: {
        ...defaults.bloom
      }
    }))
  }

  const onResetDepthOfFieldSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      depthOfField: {
        ...defaults.depthOfField
      }
    }))
  }

  const onResetToneMapping = () => {
    const defaults = createDefaultVisualSettings()

    onToneMappingChange(defaults.toneMapping)
  }

  const onResetAmbientOcclusionMode = () => {
    const defaults = createDefaultVisualSettings()

    onAmbientOcclusionModeChange(defaults.ambientOcclusionMode)
  }

  const onResetBooleanSetting = (key: BooleanSettingKey) => {
    const defaults = createDefaultVisualSettings()

    onBooleanSettingChange(key, defaults[key])
  }

  const onAssetsReady = () => {
    setSceneLoaded(true)
  }

  if (!mazeLayout) {
    return (
      <div className="app-shell">
        <LoadingOverlay complete={false} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {overlayVisible ? (
        <div className="fps-counter">
          <div>{Math.round(fps)} FPS</div>
          <div>{mazeLayout.maze.id}</div>
          <div>{GIT_REVISION}</div>
          <div>{GIT_REVISION_TIMESTAMP}</div>
        </div>
      ) : null}
      <LoadingOverlay complete={sceneLoaded} />
      <VisualControls
        controlsOpen={controlsOpen}
        onAmbientOcclusionModeChange={onAmbientOcclusionModeChange}
        onBooleanSettingChange={onBooleanSettingChange}
        onBloomSettingChange={onBloomSettingChange}
        onDepthOfFieldSettingChange={onDepthOfFieldSettingChange}
        onEffectSettingChange={onEffectSettingChange}
        onResetAmbientOcclusionMode={onResetAmbientOcclusionMode}
        onResetBloomSettings={onResetBloomSettings}
        onResetBooleanSetting={onResetBooleanSetting}
        onResetDepthOfFieldSettings={onResetDepthOfFieldSettings}
        onResetEffectSetting={onResetEffectSetting}
        onResetScalarSetting={onResetScalarSetting}
        onResetToneMapping={onResetToneMapping}
        onScalarSettingChange={onScalarSettingChange}
        onToneMappingChange={onToneMappingChange}
        visualSettings={visualSettings}
      />
      <div
        className={`viewport-shell${sceneLoaded ? ' viewport-shell-ready' : ''}`}
        style={{ transitionDuration: `${LOADING_FADE_DURATION_MS}ms` }}
      >
        <Canvas
          camera={{
            far: 400,
            fov: 60,
            near: 0.1,
            position: [
              PLAYER_SPAWN_POSITION.x,
              PLAYER_SPAWN_POSITION.y + 1.5,
              PLAYER_SPAWN_POSITION.z
            ]
          }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace
            gl.toneMapping = NoToneMapping
            gl.toneMappingExposure = 1
            gl.shadowMap.enabled = true
            gl.shadowMap.type = BasicShadowMap
            gl.domElement.dataset.sceneReady = 'false'
          }}
          shadows
        >
          <RendererSettings
            composerEnabled={composerEnabled}
            exposureStops={visualSettings.exposureStops}
            toneMapping={visualSettings.toneMapping}
          />
          <Suspense fallback={null}>
            <Scene
              composerEnabled={composerEnabled}
              controlsOpen={controlsOpen}
              layout={mazeLayout}
              onAssetsReady={onAssetsReady}
              visualSettings={visualSettings}
            />
          </Suspense>
          <FpsReporter onSample={setFps} />
        </Canvas>
      </div>
    </div>
  )
}
