import {
  DepthOfField,
  EffectComposer,
  N8AO,
  SSAO,
  ToneMapping,
  Vignette
} from '@react-three/postprocessing'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { LensFlareEffect } from '@react-three/postprocessing'
import {
  BasicShadowMap,
  CanvasTexture,
  Color,
  CubeCamera,
  DoubleSide,
  EquirectangularReflectionMapping,
  Euler,
  HalfFloatType,
  LinearFilter,
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  NeutralToneMapping,
  PMREMGenerator,
  Quaternion,
  ReinhardToneMapping,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  Texture,
  TextureLoader,
  Uniform,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget
} from 'three'
import {
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  type ReactNode,
  useRef,
  useState
} from 'react'
import {
  BlendFunction,
  BloomEffect,
  Effect,
  KernelSize,
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
  MAZE_CELL_SIZE,
  GROUND_SIZE,
  GROUND_Y,
  getMazeLayoutById,
  getRandomMazeLayout,
  getWallBounds,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BASE_CANDELA,
  TORCH_BILLBOARD_SIZE,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_WIDTH
} from './lib/sceneLayout.js'
import { computeLocalBillboardQuaternion } from './lib/billboard.js'

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
const FIRE_BILLBOARD_INTENSITY_SCALE = 1 / TORCH_BASE_CANDELA
const FLOOR_LIGHTMAP_INTENSITY_SCALE = 1
const WALL_LIGHTMAP_INTENSITY_SCALE = 1
const MAZE_GROUND_PATCH_OFFSET_Y = 0.002
const REFLECTION_PROBE_RENDER_SIZE = 128
const REFLECTION_PROBE_FAR = 48
const REFLECTION_PROBE_EMISSIVE_RADIUS = 0.16
const REFLECTION_PROBE_EMISSIVE_SCALE = 3
const LENS_FLARE_COLOR_GAIN_SCALE = 0.35
const FOG_VOLUME_HEIGHT = 6
const FOG_VOLUME_SLICE_COUNT = 24
const EFFECT_EPSILON = 0.0001
const MAX_PHYSICS_SUBSTEPS = 10
const MIN_LOADING_OVERLAY_MS = 300
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
  exposureStops: number
  iblIntensity: number
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

type MazeLayout = ReturnType<typeof getRandomMazeLayout>

type LightmapRect = {
  height: number
  width: number
  x: number
  y: number
}

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
    exposureStops: DEFAULT_EXPOSURE_STOPS,
    iblIntensity: DEFAULT_IBL_INTENSITY_MULTIPLIER,
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
    volumetricLighting: { enabled: false, intensity: 0.35 },
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
  rect: LightmapRect
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
      const atlasIndex =
        ((((rect.y + row) * atlasWidth) + rect.x + column) * 3)
      const pixelIndex = ((row * rect.width) + column) * 4

      image.data[pixelIndex] = data[atlasIndex]
      image.data[pixelIndex + 1] = data[atlasIndex + 1]
      image.data[pixelIndex + 2] = data[atlasIndex + 2]
      image.data[pixelIndex + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.flipY = true
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function useWallLightmapFaceTextures(
  lightmap: MazeLightmap,
  lightmapBytes: Uint8Array,
  wallId: string
) {
  const textures = useMemo(() => {
    const rects = lightmap.wallRects[wallId]

    return {
      nz: createLightmapFaceTexture(lightmapBytes, lightmap.atlasWidth, rects.nz),
      pz: createLightmapFaceTexture(lightmapBytes, lightmap.atlasWidth, rects.pz)
    }
  }, [lightmap, lightmapBytes, wallId])

  useEffect(
    () => () => {
      textures.nz.dispose()
      textures.pz.dispose()
    },
    [textures]
  )

  return textures
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

function getReflectionProbeIndexForPosition(
  layout: MazeLayout,
  position: Vector3
) {
  const halfWidth = (layout.maze.width * MAZE_CELL_SIZE) / 2
  const halfDepth = (layout.maze.height * MAZE_CELL_SIZE) / 2
  const cellX = Math.max(
    0,
    Math.min(
      layout.maze.width - 1,
      Math.floor((position.x + halfWidth) / MAZE_CELL_SIZE)
    )
  )
  const cellY = Math.max(
    0,
    Math.min(
      layout.maze.height - 1,
      Math.floor((position.z + halfDepth) / MAZE_CELL_SIZE)
    )
  )

  return (cellY * layout.maze.width) + cellX
}

function EnvironmentLighting({
  layout,
  iblIntensity,
  onReflectionProbeTexturesChange
}: {
  layout: MazeLayout
  iblIntensity: number
  onReflectionProbeTexturesChange: (textures: Texture[]) => void
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const hdrTexture = useLoader(HDRLoader, ENVIRONMENT_URL)
  const pmremGenerator = useMemo(() => new PMREMGenerator(gl), [gl])
  const environmentTarget = useRef<{ dispose: () => void; texture: Texture } | null>(null)
  const reflectionProbeTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const calibratedIntensity = getHdrLightingIntensity(iblIntensity)
  const authoredProbeHdrIntensity = getHdrLightingIntensity(
    DEFAULT_IBL_INTENSITY_MULTIPLIER
  )

  useEffect(() => {
    scene.userData.reflectionProbeState = {
      activeProbeId: null,
      probeCount: layout.reflectionProbes.length,
      ready: false
    }
    onReflectionProbeTexturesChange([])

    return () => {
      delete scene.userData.reflectionProbeState
      onReflectionProbeTexturesChange([])
    }
  }, [layout.reflectionProbes.length, onReflectionProbeTexturesChange, scene])

  useEffect(() => {
    hdrTexture.mapping = EquirectangularReflectionMapping
    pmremGenerator.compileEquirectangularShader()
    const nextEnvironment = pmremGenerator.fromEquirectangular(hdrTexture)

    environmentTarget.current = nextEnvironment
    scene.background = hdrTexture
    scene.environment = nextEnvironment.texture
    scene.backgroundIntensity = calibratedIntensity
    scene.environmentIntensity = calibratedIntensity

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
      hdrTexture.dispose()
    }
  }, [gl, hdrTexture, pmremGenerator, scene])

  useEffect(() => {
    scene.backgroundIntensity = calibratedIntensity
  }, [calibratedIntensity, scene])

  useEffect(() => {
    const baseEnvironment = environmentTarget.current

    if (!baseEnvironment) {
      return undefined
    }

    const previousTargets = reflectionProbeTargets.current
    reflectionProbeTargets.current = []

    if (scene.environment !== baseEnvironment.texture) {
      scene.environment = baseEnvironment.texture
    }
    scene.environmentIntensity = calibratedIntensity
    scene.userData.reflectionProbeState = {
      activeProbeId: null,
      probeCount: layout.reflectionProbes.length,
      ready: false
    }

    const hiddenObjects: Array<{ object: { visible: boolean }; visible: boolean }> = []
    scene.traverse((object) => {
      if (
        object.userData?.debugRole === 'torch-billboard' ||
        object.userData?.debugRole === 'global-fog-volume'
      ) {
        hiddenObjects.push({ object, visible: object.visible })
        object.visible = false
      }
    })

    const emissiveGeometry = new SphereGeometry(REFLECTION_PROBE_EMISSIVE_RADIUS, 12, 12)
    const emissiveGroup = new Group()
    const emissiveMeshes: Mesh[] = []

    for (const mazeLight of layout.lights) {
      const emissiveMaterial = new MeshBasicMaterial({
        color: FIRE_COLOR.clone().multiplyScalar(
          REFLECTION_PROBE_EMISSIVE_SCALE
        )
      })
      const emissiveMesh = new Mesh(emissiveGeometry, emissiveMaterial)
      emissiveMesh.position.set(
        mazeLight.torchPosition.x,
        mazeLight.torchPosition.y,
        mazeLight.torchPosition.z
      )
      emissiveGroup.add(emissiveMesh)
      emissiveMeshes.push(emissiveMesh)
    }

    scene.add(emissiveGroup)
    scene.background = hdrTexture
    scene.backgroundIntensity = authoredProbeHdrIntensity
    scene.environment = baseEnvironment.texture
    scene.environmentIntensity = authoredProbeHdrIntensity

    const nextTargets = layout.reflectionProbes.map((probe) => {
      const cubeRenderTarget = new WebGLCubeRenderTarget(
        REFLECTION_PROBE_RENDER_SIZE,
        { type: HalfFloatType }
      )
      const cubeCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, cubeRenderTarget)

      cubeCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )
      scene.add(cubeCamera)
      cubeCamera.update(gl, scene)
      scene.remove(cubeCamera)

      const probeTarget = pmremGenerator.fromCubemap(cubeRenderTarget.texture)
      cubeRenderTarget.dispose()
      return probeTarget
    })

    scene.remove(emissiveGroup)
    emissiveGeometry.dispose()
    for (const emissiveMesh of emissiveMeshes) {
      ;(emissiveMesh.material as MeshBasicMaterial).dispose()
    }
    for (const entry of hiddenObjects) {
      entry.object.visible = entry.visible
    }

    previousTargets.forEach((target) => target.dispose())
    reflectionProbeTargets.current = nextTargets
    onReflectionProbeTexturesChange(nextTargets.map((target) => target.texture))
    scene.userData.reflectionProbeState = {
      activeProbeId: null,
      probeCount: layout.reflectionProbes.length,
      ready: nextTargets.length === layout.reflectionProbes.length
    }

    return () => {
      for (const target of nextTargets) {
        target.dispose()
      }
      onReflectionProbeTexturesChange([])
      if (scene.environment !== baseEnvironment.texture) {
        scene.environment = baseEnvironment.texture
      }
      scene.environmentIntensity = calibratedIntensity
      scene.userData.reflectionProbeState = {
        activeProbeId: null,
        probeCount: layout.reflectionProbes.length,
        ready: false
      }
    }
  }, [
    authoredProbeHdrIntensity,
    gl,
    hdrTexture,
    layout.lights,
    layout.reflectionProbes,
    onReflectionProbeTexturesChange,
    pmremGenerator,
    scene
  ])

  return null
}

function GroundSurfaceMaterial({
  lightMap,
  lightMapIntensity,
  repeat
}: {
  lightMap?: Texture
  lightMapIntensity?: number
  repeat: number
}) {
  const puddle = usePuddleTextures(repeat)

  return (
    <meshPhysicalMaterial
      {...puddle}
      bumpScale={0.08}
      clearcoat={1}
      clearcoatRoughness={0.1}
      lightMap={lightMap}
      lightMapIntensity={lightMapIntensity}
      metalness={0}
      roughness={0.45}
    />
  )
}

function Ground({
  layout,
  groundLightmapTexture,
  torchCandelaMultiplier
}: {
  layout: MazeLayout
  groundLightmapTexture: Texture
  torchCandelaMultiplier: number
}) {
  const {
    centerX,
    centerZ,
    depth,
    width
  } = layout.maze.lightmap.groundBounds
  const patchRepeat = PUDDLE_TEXTURE_REPEAT * (width / GROUND_SIZE)

  return (
    <>
      <mesh
        position={[0, GROUND_Y, 0]}
        receiveShadow
        rotation-x={-Math.PI / 2}
        userData={{ debugIndex: 0, debugRole: 'maze-ground-base' }}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <GroundSurfaceMaterial repeat={PUDDLE_TEXTURE_REPEAT} />
      </mesh>
      <mesh
        position={[centerX, GROUND_Y + MAZE_GROUND_PATCH_OFFSET_Y, centerZ]}
        receiveShadow
        rotation-x={-Math.PI / 2}
        userData={{ debugIndex: 0, debugRole: 'maze-ground-lightmap' }}
      >
        <planeGeometry args={[width, depth]} />
        <GroundSurfaceMaterial
          lightMap={groundLightmapTexture}
          lightMapIntensity={torchCandelaMultiplier * FLOOR_LIGHTMAP_INTENSITY_SCALE}
          repeat={patchRepeat}
        />
      </mesh>
    </>
  )
}

function getReflectionProbeTextureForPosition(
  layout: MazeLayout,
  reflectionProbeTextures: Texture[],
  position: Vector3
) {
  const probeIndex = getReflectionProbeIndexForPosition(layout, position)
  return reflectionProbeTextures[probeIndex] ?? null
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

      billboardMaterial.color.setScalar(
        brightness * FIRE_BILLBOARD_INTENSITY_SCALE
      )
    }
  })

  return (
    <group
      position={position}
      ref={group}
      userData={{ debugIndex: seed - 1, debugRole: 'torch-billboard' }}
    >
      <mesh
        ref={material}
        userData={{ lensflare: 'no-occlusion' }}
      >
        <planeGeometry args={[TORCH_BILLBOARD_SIZE, TORCH_BILLBOARD_SIZE]} />
        <meshBasicMaterial
          alphaTest={0.005}
          color={new Color(1, 1, 1)}
          depthWrite={false}
          map={texture}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </group>
  )
}

function WallSconce({
  layout,
  mazeLight,
  reflectionProbeTextures,
  torchCandelaMultiplier
}: {
  layout: MazeLayout
  mazeLight: MazeLayout['lights'][number]
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
}) {
  const metal = useStandardPbrTextures(METAL_TEXTURE_URLS, METAL_TEXTURE_REPEAT)
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
  const reflectionProbeTexture = useMemo(
    () =>
      getReflectionProbeTextureForPosition(
        layout,
        reflectionProbeTextures,
        new Vector3(
          mazeLight.sconcePosition.x,
          mazeLight.sconcePosition.y,
          mazeLight.sconcePosition.z
        )
      ),
    [layout, mazeLight.sconcePosition.x, mazeLight.sconcePosition.y, mazeLight.sconcePosition.z, reflectionProbeTextures]
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
            envMap={reflectionProbeTexture ?? undefined}
            envMapIntensity={1}
            map={metal.map}
            metalness={0.85}
            metalnessMap={metal.metalnessMap}
            normalMap={metal.normalMap}
            roughness={0.55}
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
  noiseFrequency,
  visible,
  volumeIntensity
}: {
  noiseFrequency: number
  visible: boolean
  volumeIntensity: number
}) {
  const materials = useRef<Array<{
    uniforms?: {
      density?: { value: number }
      layerHeight?: { value: number }
      noiseFrequency?: { value: number }
      time?: { value: number }
    }
  } | null>>([])
  const layerHeights = useMemo(
    () =>
      Array.from({ length: FOG_VOLUME_SLICE_COUNT }, (_, index) => {
        return ((index + 0.5) / FOG_VOLUME_SLICE_COUNT) * FOG_VOLUME_HEIGHT
      }),
    []
  )

  useFrame((state) => {
    for (const material of materials.current) {
      const uniforms = material?.uniforms
      if (!uniforms) {
        continue
      }

      uniforms.density.value = visible ? volumeIntensity : 0
      uniforms.noiseFrequency.value = noiseFrequency
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
        >
          <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
          <shaderMaterial
            depthTest={false}
            depthWrite={false}
            fragmentShader={`
              uniform float density;
              uniform float layerHeight;
              uniform float noiseFrequency;
              uniform float time;
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

              void main() {
                vec3 samplePoint = vec3(
                  vWorldPosition.x * 0.08 * noiseFrequency,
                  (layerHeight * 0.5 * noiseFrequency) - (time * 0.12),
                  vWorldPosition.z * 0.08 * noiseFrequency
                );
                float verticalFalloff = 1.0 - smoothstep(0.0, ${FOG_VOLUME_HEIGHT.toFixed(1)}, layerHeight);
                float baseNoise = mix(0.45, 1.0, noise(samplePoint));
                float horizontalFade = 1.0 - smoothstep(${(GROUND_SIZE * 0.33).toFixed(1)}, ${(GROUND_SIZE * 0.6).toFixed(1)}, length(vWorldPosition.xz));
                float alpha = clamp(density * verticalFalloff * horizontalFade * baseNoise * 0.24, 0.0, 0.16);
                if (alpha < 0.002) {
                  discard;
                }

                gl_FragColor = vec4(vec3(0.56, 0.58, 0.62), alpha);
              }
            `}
            ref={(material) => {
              materials.current[index] = material
            }}
            side={DoubleSide}
            transparent
            uniforms={{
              density: { value: visible ? volumeIntensity : 0 },
              layerHeight: { value: layerHeight },
              noiseFrequency: { value: noiseFrequency },
              time: { value: 0 }
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

function MazeWalls({
  layout,
  lightmapBytes,
  reflectionProbeTextures,
  torchCandelaMultiplier
}: {
  layout: MazeLayout
  lightmapBytes: Uint8Array
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
}) {
  const wall = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT)

  return (
    <>
      {layout.walls.map((mazeWall, wallIndex) => (
        <MazeWallMesh
          key={mazeWall.id}
          layout={layout}
          lightmap={layout.maze.lightmap}
          lightmapBytes={lightmapBytes}
          mazeWall={mazeWall}
          reflectionProbeTextures={reflectionProbeTextures}
          torchCandelaMultiplier={torchCandelaMultiplier}
          wallIndex={wallIndex}
          wallMaterialMaps={wall}
        />
      ))}
      {layout.lights.map((mazeLight) => (
        <WallSconce
          key={mazeLight.id}
          layout={layout}
          mazeLight={mazeLight}
          reflectionProbeTextures={reflectionProbeTextures}
          torchCandelaMultiplier={torchCandelaMultiplier}
        />
      ))}
    </>
  )
}

function MazeWallMesh({
  layout,
  lightmap,
  lightmapBytes,
  mazeWall,
  reflectionProbeTextures,
  torchCandelaMultiplier,
  wallIndex,
  wallMaterialMaps
}: {
  layout: MazeLayout
  lightmap: MazeLightmap
  lightmapBytes: Uint8Array
  mazeWall: MazeLayout['walls'][number]
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
  wallIndex: number
  wallMaterialMaps: PbrMaps
}) {
  const lightmapFaceTextures = useWallLightmapFaceTextures(
    lightmap,
    lightmapBytes,
    mazeWall.id
  )
  const reflectionProbeTexture = useMemo(
    () =>
      getReflectionProbeTextureForPosition(
        layout,
        reflectionProbeTextures,
        new Vector3(
          mazeWall.center.x,
          GROUND_Y + (WALL_HEIGHT / 2),
          mazeWall.center.z
        )
      ),
    [layout, mazeWall.center.x, mazeWall.center.z, reflectionProbeTextures]
  )

  return (
    <group
      position={[
        mazeWall.center.x,
        GROUND_Y + (WALL_HEIGHT / 2),
        mazeWall.center.z
      ]}
      rotation-y={mazeWall.yaw}
    >
      <mesh
        castShadow
        receiveShadow
        userData={{ debugIndex: wallIndex, debugRole: 'maze-wall' }}
      >
        <boxGeometry args={[WALL_LENGTH, WALL_HEIGHT, WALL_WIDTH]} />
        <meshStandardMaterial
          {...wallMaterialMaps}
          bumpScale={0.05}
          envMap={reflectionProbeTexture ?? undefined}
          envMapIntensity={1}
          metalness={0.02}
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[0, 0, (WALL_WIDTH / 2) + 0.002]}
        receiveShadow
        renderOrder={1}
        userData={{ debugIndex: wallIndex, debugRole: 'maze-wall-lightmap' }}
      >
        <planeGeometry args={[WALL_LENGTH, WALL_HEIGHT]} />
        <meshStandardMaterial
          {...wallMaterialMaps}
          bumpScale={0.05}
          envMap={reflectionProbeTexture ?? undefined}
          envMapIntensity={1}
          lightMap={lightmapFaceTextures.pz}
          lightMapIntensity={torchCandelaMultiplier * WALL_LIGHTMAP_INTENSITY_SCALE}
          metalness={0.02}
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[0, 0, -((WALL_WIDTH / 2) + 0.002)]}
        receiveShadow
        renderOrder={1}
        rotation-y={Math.PI}
        userData={{ debugIndex: wallIndex, debugRole: 'maze-wall-lightmap' }}
      >
        <planeGeometry args={[WALL_LENGTH, WALL_HEIGHT]} />
        <meshStandardMaterial
          {...wallMaterialMaps}
          bumpScale={0.05}
          envMap={reflectionProbeTexture ?? undefined}
          envMapIntensity={1}
          lightMap={lightmapFaceTextures.nz}
          lightMapIntensity={torchCandelaMultiplier * WALL_LIGHTMAP_INTENSITY_SCALE}
          metalness={0.02}
          roughness={0.92}
        />
      </mesh>
    </group>
  )
}

function SceneGeometry({
  layout,
  reflectionProbeTextures,
  torchCandelaMultiplier,
  volumetricLighting,
  volumetricNoiseFrequency
}: {
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  torchCandelaMultiplier: number
  volumetricLighting: EffectSettings
  volumetricNoiseFrequency: number
}) {
  const lightmapBytes = useMazeLightmapBytes(layout.maze.lightmap)
  const groundLightmapTexture = useGroundLightmapTexture(layout.maze.lightmap, lightmapBytes)

  return (
    <>
      <Ground
        layout={layout}
        groundLightmapTexture={groundLightmapTexture}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
      <MazeWalls
        layout={layout}
        lightmapBytes={lightmapBytes}
        reflectionProbeTextures={reflectionProbeTextures}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
      {volumetricLighting.enabled ? (
        <FogVolume
          noiseFrequency={volumetricNoiseFrequency}
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
  const effect = useMemo(
    () =>
      new SSREffect(scene, camera, {
        blend: 0.92,
        blur: 0.3,
        correction: 1,
        distance: 18,
        fade: 0.12,
        intensity,
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
    [camera, intensity, scene]
  )

  useEffect(() => {
    effect.intensity = intensity
  }, [effect, intensity])

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

function TorchLensFlareEffect({
  intensity,
  mazeLight,
  torchCandelaMultiplier
}: {
  intensity: number
  mazeLight: MazeLayout['lights'][number]
  torchCandelaMultiplier: number
}) {
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const effect = useMemo(
    () =>
      new LensFlareEffect({
        blendFunction: BlendFunction.NORMAL,
        enabled: true,
        glareSize: 0.08,
        lensPosition: new Vector3(),
        screenRes: new Vector2(size.width, size.height),
        starPoints: 6,
        flareSize: 0.006,
        flareSpeed: 0.01,
        flareShape: 0.12,
        animated: true,
        anamorphic: false,
        colorGain: FIRE_COLOR.clone().multiplyScalar(LENS_FLARE_COLOR_GAIN_SCALE),
        lensDirtTexture: null,
        haloScale: 0.18,
        secondaryGhosts: true,
        aditionalStreaks: true,
        ghostScale: 0.12,
        opacity: 1,
        starBurst: false
      }),
    [size.height, size.width]
  )
  const projectedPosition = useMemo(() => new Vector3(), [])
  const rayDirection = useMemo(() => new Vector3(), [])
  const targetPosition = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const resolution = effect.uniforms.get('screenRes')

    if (!resolution) {
      return
    }

    resolution.value.x = size.width
    resolution.value.y = size.height
  }, [effect, size.height, size.width])

  useFrame((state, delta) => {
    const lensPosition = effect.uniforms.get('lensPosition')
    const opacity = effect.uniforms.get('opacity')
    const colorGain = effect.uniforms.get('colorGain')

    if (!lensPosition || !opacity || !colorGain) {
      return
    }

    const brightness = torchCandelaMultiplier
    const visibleIntensity = Math.max(0, intensity)

    targetPosition.copy(mazeLight.torchPosition)
    projectedPosition.copy(targetPosition).project(camera)

    if (
      projectedPosition.z < -1 ||
      projectedPosition.z > 1 ||
      Math.abs(projectedPosition.x) > 1.2 ||
      Math.abs(projectedPosition.y) > 1.2
    ) {
      opacity.value += (1 - opacity.value) * Math.min(1, delta / 0.12)
      return
    }

    rayDirection.copy(targetPosition).sub(camera.position)
    const distanceToTorch = rayDirection.length()
    rayDirection.normalize()
    raycaster.set(camera.position, rayDirection)

    const hit = raycaster.intersectObjects(scene.children, true)[0]
    const visible =
      !hit ||
      hit.distance >= distanceToTorch - 0.05 ||
      hit.object.userData.lensflare === 'no-occlusion'

    if (!visible) {
      opacity.value += (1 - opacity.value) * Math.min(1, delta / 0.12)
      return
    }

    lensPosition.value.x = projectedPosition.x
    lensPosition.value.y = projectedPosition.y
    const flareStrength = Math.min(0.98, visibleIntensity * brightness * 0.02)
    const targetOpacity = 1 - flareStrength
    opacity.value += (targetOpacity - opacity.value) * Math.min(1, delta / 0.12)
    colorGain.value
      .copy(FIRE_COLOR)
      .multiplyScalar(brightness * visibleIntensity * LENS_FLARE_COLOR_GAIN_SCALE)
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
  return (
    <>
      {layout.lights.map((mazeLight) => (
        <TorchLensFlareEffect
          intensity={intensity}
          key={mazeLight.id}
          mazeLight={mazeLight}
          torchCandelaMultiplier={torchCandelaMultiplier}
        />
      ))}
    </>
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
          hasEmissiveMap: boolean
          hasLightMap: boolean
          hasMap: boolean
          hasUv1: boolean
          hasUv2: boolean
          lightMapIntensity: number | null
          mapChannel: number | null
          materialColor: [number, number, number] | null
        } | null
        getReflectionProbeState?: () => {
          activeProbeId: string | null
          probeCount: number
          ready: boolean
        } | null
        setView?: (
          cameraPosition: [number, number, number],
          target: [number, number, number]
        ) => void
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    const worldPosition = new Vector3()

    globalWindow.__levelsjamDebug = {
      ...existing,
      getDebugPosition: (role, index) => {
        let match: [number, number, number] | null = null

        scene.traverse((object) => {
          if (
            match ||
            object.userData?.debugRole !== role ||
            object.userData?.debugIndex !== index
          ) {
            return
          }

          object.getWorldPosition(worldPosition)
          match = [worldPosition.x, worldPosition.y, worldPosition.z]
        })

        return match
      },
      getDebugMeshState: (role, index) => {
        let match: {
          emissiveColor: [number, number, number] | null
          emissiveIntensity: number | null
          emissiveMapChannel: number | null
          hasEmissiveMap: boolean
          hasLightMap: boolean
          hasMap: boolean
          hasUv1: boolean
          hasUv2: boolean
          lightMapIntensity: number | null
          mapChannel: number | null
          materialColor: [number, number, number] | null
        } | null = null

        scene.traverse((object) => {
          if (
            match ||
            !(object instanceof Mesh) ||
            object.userData?.debugRole !== role ||
            object.userData?.debugIndex !== index
          ) {
            return
          }

          const material = object.material as {
            emissive?: Color
            emissiveIntensity?: number
            emissiveMap?: Texture | null
            color?: Color
            lightMap?: Texture | null
            lightMapIntensity?: number
            map?: Texture | null
          }

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
              typeof material.emissiveMap?.channel === 'number'
                ? material.emissiveMap.channel
                : null,
            hasEmissiveMap: Boolean(material.emissiveMap),
            hasLightMap: Boolean(material.lightMap),
            hasMap: Boolean(material.map),
            hasUv1: Boolean(object.geometry?.getAttribute?.('uv1')),
            hasUv2: Boolean(object.geometry?.getAttribute?.('uv2')),
            lightMapIntensity:
              typeof material.lightMapIntensity === 'number'
                ? material.lightMapIntensity
                : null,
            mapChannel:
              typeof material.map?.channel === 'number'
                ? material.map.channel
                : null,
            materialColor: material.color
              ? [
                  material.color.r,
                  material.color.g,
                  material.color.b
                ]
              : null
          }
        })

        return match
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
      delete globalWindow.__levelsjamDebug.getReflectionProbeState
      delete globalWindow.__levelsjamDebug.setView
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [camera, scene])

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

  const scene = useThree((state) => state.scene)
  const [reflectionProbeTextures, setReflectionProbeTextures] = useState<Texture[]>([])

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        clearDebugIsolation?: () => void
        setDebugVisible?: (
          role: string,
          index: number,
          visible: boolean
        ) => void
        isolateDebugRole?: (role: string, index: number) => void
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    let restoreDebugIsolation = () => {}

    const setDebugVisible = (role: string, index: number, visible: boolean) => {
      scene.traverse((object) => {
        if (
          object.userData?.debugRole === role &&
          object.userData?.debugIndex === index
        ) {
          object.visible = visible
        }
      })
    }

    const clearDebugIsolation = () => {
      restoreDebugIsolation()
      restoreDebugIsolation = () => {}
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

      scene.traverse((object) => {
        savedVisibility.push({ object, visible: object.visible })
        const match =
          object.userData?.debugRole === role &&
          object.userData?.debugIndex === index

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

    globalWindow.__levelsjamDebug = {
      ...existing,
      clearDebugIsolation,
      isolateDebugRole,
      setDebugVisible
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      clearDebugIsolation()
      delete globalWindow.__levelsjamDebug.clearDebugIsolation
      delete globalWindow.__levelsjamDebug.setDebugVisible
      delete globalWindow.__levelsjamDebug.isolateDebugRole
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [scene])

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
        onReflectionProbeTexturesChange={setReflectionProbeTextures}
      />
      <SceneGeometry
        layout={layout}
        reflectionProbeTextures={reflectionProbeTextures}
        torchCandelaMultiplier={visualSettings.torchCandelaMultiplier}
        volumetricLighting={visualSettings.volumetricLighting}
        volumetricNoiseFrequency={visualSettings.volumetricNoiseFrequency}
      />
      <EffectComposer enableNormalPass>
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
            bias={0.03}
            distanceFalloff={0.1}
            distanceThreshold={1}
            intensity={visualSettings.ambientOcclusionIntensity * 6}
            luminanceInfluence={0}
            radius={visualSettings.ambientOcclusionRadius}
            rangeFalloff={0.1}
            rangeThreshold={0.001}
            rings={6}
            samples={32}
          />
        ) : null}
        {ssrActive ? (
          <SSREffectPrimitive intensity={visualSettings.ssr.intensity} />
        ) : null}
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

function VisualControls({
  onAmbientOcclusionModeChange,
  onBloomSettingChange,
  controlsOpen,
  onDepthOfFieldSettingChange,
  onEffectSettingChange,
  onScalarSettingChange,
  onToneMappingChange,
  visualSettings
}: {
  onAmbientOcclusionModeChange: (value: AmbientOcclusionMode) => void
  onBloomSettingChange: (patch: Partial<BloomSettings>) => void
  controlsOpen: boolean
  onDepthOfFieldSettingChange: (patch: Partial<DepthOfFieldSettings>) => void
  onEffectSettingChange: (
    effect: GenericEffectSettingKey,
    patch: Partial<EffectSettings>
  ) => void
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
    { key: 'lensFlare', label: 'Lens Flares', min: 0, max: 0.2, step: 0.005 },
    { key: 'ssr', label: 'SSR', min: 0, max: 2, step: 0.05 },
    { key: 'volumetricLighting', label: 'Volumetric Fog', min: 0, max: 1, step: 0.05 },
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
        <span>Exposure</span>
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
        <span>IBL Intensity</span>
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
        <span>Torch Candelas</span>
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
        <span>Tone Mapper</span>
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

      <label className="visual-control-row">
        <output>{visualSettings.movement.maxHorizontalSpeedMph.toFixed(1)}mph</output>
        <span>Move Speed</span>
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
        <span>Accel Distance</span>
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
        <span>Decel Distance</span>
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
        <span>Ambient Occlusion</span>
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
        <span>AO Intensity</span>
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
        <span>AO Radius</span>
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
          <span>Bloom</span>
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
        <span>Bloom Kernel</span>
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
          <span>Depth Of Field</span>
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
        <span>DOF Focus Distance (m)</span>
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
        <span>DOF Focal Length / Range (m)</span>
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
        <span>Fog Noise Frequency</span>
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
              <span>{effectControl.label}</span>
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
  const [mazeLayout] = useState(() => {
    const mazeId = new URLSearchParams(window.location.search).get('maze')

    return (
      (mazeId ? getMazeLayoutById(mazeId) : null) ??
      getRandomMazeLayout()
    )
  })
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [visualSettings, setVisualSettings] = useState(createDefaultVisualSettings)
  const composerEnabled = true

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

  const onAssetsReady = () => {
    startTransition(() => {
      setSceneLoaded(true)
    })
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
        onBloomSettingChange={onBloomSettingChange}
        onDepthOfFieldSettingChange={onDepthOfFieldSettingChange}
        onEffectSettingChange={onEffectSettingChange}
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
