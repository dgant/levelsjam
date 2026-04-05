import {
  Bloom,
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
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  Euler,
  Group,
  Mesh,
  NoToneMapping,
  PMREMGenerator,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
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
  useRef,
  useState
} from 'react'
import {
  BlendFunction,
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
  DEFAULT_TORCH_FLICKER_AMOUNT,
  MAX_IBL_INTENSITY_MULTIPLIER,
  MAX_TORCH_CANDELA_MULTIPLIER,
  MAX_TORCH_FLICKER_AMOUNT,
  MIN_IBL_INTENSITY_MULTIPLIER,
  MIN_TORCH_CANDELA_MULTIPLIER,
  MIN_TORCH_FLICKER_AMOUNT,
  getHdrLightingIntensity,
  getRendererExposure,
  getTorchFlickerFactor,
  scalePhotometricIntensity
} from './lib/lightingCalibration.js'
import {
  getCameraPosition,
  getPlayerSpawnPosition,
  resolvePlayerCollision
} from './lib/playerCollision.js'
import {
  updateHorizontalVelocity,
  updateVerticalVelocity
} from './lib/playerMotion.js'
import {
  GROUND_SIZE,
  GROUND_Y,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPAWN_POSITION,
  SCONCE_RADIUS,
  TORCH_BASE_CANDELA,
  TORCH_BILLBOARD_SIZE,
  WALL_HEIGHT,
  getWallAttachmentLocalLayout,
  WALL_LAYOUT,
  WALL_LENGTH,
  WALL_WIDTH
} from './lib/sceneLayout.js'
import { computeLocalBillboardQuaternion } from './lib/billboard.js'

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
const TORCH_FLICKER_SPEED = 2
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
const CUBE_BACKGROUND_RESOLUTION = 512
const TORCH_SHADOW_MAP_SIZE = 256
const TORCH_SHADOW_DISTANCE_SQ = 40 * 40
const LENS_FLARE_COLOR_GAIN_SCALE = 8
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

const BLOOM_KERNEL_SIZES: Record<BloomKernelSizeKey, KernelSize> = {
  'very-small': KernelSize.VERY_SMALL,
  small: KernelSize.SMALL,
  medium: KernelSize.MEDIUM,
  large: KernelSize.LARGE,
  'very-large': KernelSize.VERY_LARGE,
  huge: KernelSize.HUGE
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

type VisualSettings = {
  ambientOcclusionIntensity: number
  ambientOcclusionMode: AmbientOcclusionMode
  exposureStops: number
  iblIntensity: number
  torchCandelaMultiplier: number
  torchFlickerAmount: number
  toneMapping: ToneMappingMode
  bloom: BloomSettings
  depthOfField: DepthOfFieldSettings
  lensFlare: EffectSettings
  ssr: EffectSettings
  vignette: EffectSettings
}

type GenericEffectSettingKey = 'lensFlare' | 'ssr' | 'vignette'
type ScalarSettingKey =
  | 'ambientOcclusionIntensity'
  | 'exposureStops'
  | 'iblIntensity'
  | 'torchCandelaMultiplier'
  | 'torchFlickerAmount'

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

type TorchLightHandle = {
  castShadow: boolean
  distance: number
  intensity: number
  shadow: {
    autoUpdate: boolean
    needsUpdate: boolean
  }
}

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
    ambientOcclusionMode: 'n8ao',
    exposureStops: DEFAULT_EXPOSURE_STOPS,
    iblIntensity: DEFAULT_IBL_INTENSITY_MULTIPLIER,
    torchCandelaMultiplier: DEFAULT_TORCH_CANDELA_MULTIPLIER,
    torchFlickerAmount: DEFAULT_TORCH_FLICKER_AMOUNT,
    toneMapping: 'agx',
    bloom: { enabled: false, intensity: 0.7, kernelSize: 'large' },
    depthOfField: {
      bokehScale: 1,
      enabled: false,
      focalLength: 0.03,
      focusDistance: 0.02
    },
    lensFlare: { enabled: false, intensity: 1 },
    ssr: { enabled: false, intensity: 0.6 },
    vignette: { enabled: true, intensity: 0.4 }
  }
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
  const textures = useLoader(TextureLoader, [
    PUDDLE_TEXTURE_URLS.color,
    PUDDLE_TEXTURE_URLS.normal,
    PUDDLE_TEXTURE_URLS.gloss,
    PUDDLE_TEXTURE_URLS.displacement,
    PUDDLE_TEXTURE_URLS.ao
  ]) as [Texture, Texture, Texture, Texture, Texture]
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
      roughnessTexture.dispose()
    },
    [roughnessTexture]
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

function getTorchNoise(time: number, seed: number) {
  const scaledTime = time * TORCH_FLICKER_SPEED
  const oscillation =
    Math.sin((scaledTime * 7.3) + seed) * 0.45 +
    Math.sin((scaledTime * 12.1) + (seed * 1.7)) * 0.35 +
    Math.sin((scaledTime * 19.3) + (seed * 0.6)) * 0.2

  return Math.max(0, Math.min(1, (oscillation * 0.5) + 0.5))
}

function LoadingOverlay({
  complete
}: {
  complete: boolean
}) {
  const [dotCount, setDotCount] = useState(1)
  const dots = '.'.repeat(dotCount)

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

  return (
    <div
      aria-hidden={complete}
      className={`loading-overlay${complete ? ' loading-overlay-hidden' : ''}`}
      data-loading-complete={complete ? 'true' : 'false'}
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
  exposureStops,
  toneMapping
}: {
  exposureStops: number
  toneMapping: ToneMappingMode
}) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const exposure = getRendererExposure(exposureStops)

    gl.toneMappingExposure = 1
    gl.domElement.dataset.rendererExposure = exposure.toFixed(6)
    gl.domElement.dataset.rendererExposureStops = exposureStops.toFixed(2)
    gl.domElement.dataset.toneMapping = toneMapping
  }, [exposureStops, gl, toneMapping])

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
  iblIntensity
}: {
  iblIntensity: number
}) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const hdrTexture = useLoader(HDRLoader, ENVIRONMENT_URL)
  const pmremGenerator = useMemo(() => new PMREMGenerator(gl), [gl])
  const cubeRenderTarget = useMemo(
    () => new WebGLCubeRenderTarget(CUBE_BACKGROUND_RESOLUTION),
    []
  )
  const environmentTexture = useRef<Texture | null>(null)

  useEffect(() => {
    const calibratedIntensity = getHdrLightingIntensity(iblIntensity)

    hdrTexture.mapping = EquirectangularReflectionMapping
    pmremGenerator.compileEquirectangularShader()
    cubeRenderTarget.fromEquirectangularTexture(gl, hdrTexture)
    const nextEnvironment = pmremGenerator.fromCubemap(cubeRenderTarget.texture)

    environmentTexture.current = nextEnvironment.texture
    scene.background = cubeRenderTarget.texture
    scene.environment = nextEnvironment.texture
    scene.backgroundIntensity = calibratedIntensity
    scene.environmentIntensity = calibratedIntensity

    return () => {
      if (scene.background === cubeRenderTarget.texture) {
        scene.background = null
      }
      if (scene.environment === environmentTexture.current) {
        scene.environment = null
      }
      nextEnvironment.dispose()
      cubeRenderTarget.dispose()
      pmremGenerator.dispose()
      hdrTexture.dispose()
    }
  }, [cubeRenderTarget, gl, hdrTexture, iblIntensity, pmremGenerator, scene])

  useEffect(() => {
    const calibratedIntensity = getHdrLightingIntensity(iblIntensity)

    scene.backgroundIntensity = calibratedIntensity
    scene.environmentIntensity = calibratedIntensity
  }, [iblIntensity, scene])

  return null
}

function Ground() {
  const puddle = usePuddleTextures(PUDDLE_TEXTURE_REPEAT)

  return (
    <mesh
      position={[0, GROUND_Y, 0]}
      receiveShadow
      rotation-x={-Math.PI / 2}
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshPhysicalMaterial
        {...puddle}
        bumpScale={0.08}
        clearcoat={1}
        clearcoatRoughness={0.1}
        metalness={0}
        roughness={0.45}
      />
    </mesh>
  )
}

function TorchBillboard({
  flickerAmount,
  position,
  seed,
  torchCandelaMultiplier
}: {
  flickerAmount: number
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
      const noise = getTorchNoise(elapsed, seed)
      const brightness =
        TORCH_BASE_CANDELA *
        torchCandelaMultiplier *
        getTorchFlickerFactor(noise, flickerAmount)
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
          alphaTest={0.35}
          blending={AdditiveBlending}
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

function TorchLight({
  flickerAmount,
  lightHandle,
  seed,
  torchCandelaMultiplier,
  position
}: {
  flickerAmount: number
  lightHandle: { current: TorchLightHandle | null }
  seed: number
  torchCandelaMultiplier: number
  position: [number, number, number]
}) {
  const light = useRef<TorchLightHandle | null>(null)

  useFrame((state) => {
    const noise = getTorchNoise(state.clock.getElapsedTime(), seed)
    const lightRef = light.current

    if (!lightRef) {
      return
    }

    const brightness =
      TORCH_BASE_CANDELA *
      torchCandelaMultiplier *
      getTorchFlickerFactor(noise, flickerAmount)

    lightRef.intensity = scalePhotometricIntensity(brightness)
    lightRef.distance = 10
  })

  useEffect(() => {
    lightHandle.current = light.current

    return () => {
      if (lightHandle.current === light.current) {
        lightHandle.current = null
      }
    }
  }, [lightHandle])

  return (
    <pointLight
      color="#ffb56a"
      decay={2}
      distance={10}
      intensity={scalePhotometricIntensity(
        TORCH_BASE_CANDELA * torchCandelaMultiplier
      )}
      position={position}
      ref={light}
      userData={{ debugIndex: seed - 1, debugRole: 'torch-light' }}
      shadow-bias={-0.0005}
      shadow-mapSize-height={TORCH_SHADOW_MAP_SIZE}
      shadow-mapSize-width={TORCH_SHADOW_MAP_SIZE}
    />
  )
}

function WallSconce({
  flickerAmount,
  lightHandle,
  metal,
  torchCandelaMultiplier,
  wall
}: {
  flickerAmount: number
  lightHandle: { current: TorchLightHandle | null }
  metal: PbrMaps
  torchCandelaMultiplier: number
  wall: (typeof WALL_LAYOUT)[number]
}) {
  const localLayout = getWallAttachmentLocalLayout(wall)
  const position: [number, number, number] = [
    localLayout.sconcePosition.x,
    localLayout.sconcePosition.y,
    localLayout.sconcePosition.z
  ]
  const torchPosition: [number, number, number] = [
    localLayout.torchPosition.x,
    localLayout.torchPosition.y,
    localLayout.torchPosition.z
  ]
  const torchBillboardPosition: [number, number, number] = [
    torchPosition[0],
    torchPosition[1],
    torchPosition[2] + (wall.sconceDirection * 0.16)
  ]

  return (
    <>
      <group
        position={position}
        userData={{ debugIndex: wall.index, debugRole: 'sconce' }}
      >
        <mesh
          castShadow
          position={[0, 0, -wall.sconceDirection * (SCONCE_RADIUS - 0.025)]}
          receiveShadow
          rotation-x={Math.PI / 2}
          userData={{ debugIndex: wall.index, debugRole: 'sconce-body' }}
        >
          <cylinderGeometry args={[SCONCE_RADIUS * 0.82, SCONCE_RADIUS * 0.82, 0.05, 24]} />
          <meshStandardMaterial
            {...metal}
            bumpScale={0.02}
            metalness={0.85}
            roughness={0.55}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, -SCONCE_RADIUS * 0.06, -wall.sconceDirection * (SCONCE_RADIUS * 0.3)]}
          receiveShadow
          rotation-x={Math.PI / 2}
          userData={{ debugIndex: wall.index, debugRole: 'sconce-body' }}
        >
          <cylinderGeometry args={[SCONCE_RADIUS * 0.12, SCONCE_RADIUS * 0.12, SCONCE_RADIUS * 0.5, 18]} />
          <meshStandardMaterial
            {...metal}
            bumpScale={0.02}
            metalness={0.85}
            roughness={0.55}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, -SCONCE_RADIUS * 0.07, wall.sconceDirection * (SCONCE_RADIUS * 0.08)]}
          receiveShadow
          rotation-x={Math.PI / 2}
          userData={{ debugIndex: wall.index, debugRole: 'sconce-body' }}
        >
          <cylinderGeometry
            args={[
              SCONCE_RADIUS * 0.2,
              SCONCE_RADIUS * 0.62,
              SCONCE_RADIUS * 0.72,
              24
            ]}
          />
          <meshStandardMaterial
            {...metal}
            bumpScale={0.02}
            metalness={0.85}
            roughness={0.55}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <TorchBillboard
        flickerAmount={flickerAmount}
        position={torchBillboardPosition}
        seed={wall.index + 1}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
      <TorchLight
        flickerAmount={flickerAmount}
        lightHandle={lightHandle}
        position={torchPosition}
        seed={wall.index + 1}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
    </>
  )
}

function Walls({
  flickerAmount,
  torchCandelaMultiplier
}: {
  flickerAmount: number
  torchCandelaMultiplier: number
}) {
  const camera = useThree((state) => state.camera)
  const wall = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT)
  const metal = useStandardPbrTextures(METAL_TEXTURE_URLS, METAL_TEXTURE_REPEAT)
  const lightHandles = useRef(
    WALL_LAYOUT.map(() => ({ current: null as TorchLightHandle | null }))
  )
  const tempPosition = useMemo(() => new Vector3(), [])

  useFrame(() => {
    for (const wall of WALL_LAYOUT) {
      const light = lightHandles.current[wall.index]?.current

      if (!light) {
        continue
      }

      tempPosition.set(
        wall.torchPosition.x,
        wall.torchPosition.y,
        wall.torchPosition.z
      )
      const distanceSq = camera.position.distanceToSquared(tempPosition)
      const shouldCastShadow = distanceSq <= TORCH_SHADOW_DISTANCE_SQ

      if (light.castShadow === shouldCastShadow) {
        continue
      }

      light.castShadow = shouldCastShadow
      light.shadow.autoUpdate = false
      if (shouldCastShadow) {
        light.shadow.needsUpdate = true
      }
    }
  })

  return (
    <>
      {WALL_LAYOUT.map((layout) => (
        <group
          key={layout.id}
          position={[layout.position.x, layout.position.y, layout.position.z]}
          rotation-y={layout.yaw}
        >
          <mesh
            castShadow
            receiveShadow
          >
            <boxGeometry args={[WALL_LENGTH, WALL_HEIGHT, WALL_WIDTH]} />
            <meshStandardMaterial
              {...wall}
              bumpScale={0.05}
              metalness={0.02}
              roughness={0.92}
            />
          </mesh>
          <WallSconce
            flickerAmount={flickerAmount}
            lightHandle={lightHandles.current[layout.index]}
            metal={metal}
            torchCandelaMultiplier={torchCandelaMultiplier}
            wall={layout}
          />
        </group>
      ))}
    </>
  )
}

function SceneGeometry({
  flickerAmount,
  torchCandelaMultiplier
}: {
  flickerAmount: number
  torchCandelaMultiplier: number
}) {
  return (
    <>
      <Ground />
      <Walls
        flickerAmount={flickerAmount}
        torchCandelaMultiplier={torchCandelaMultiplier}
      />
    </>
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

function TorchLensFlare({
  intensity,
  torchCandelaMultiplier,
  torchFlickerAmount
}: {
  intensity: number
  torchCandelaMultiplier: number
  torchFlickerAmount: number
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
        glareSize: 0.16,
        lensPosition: new Vector3(),
        screenRes: new Vector2(size.width, size.height),
        starPoints: 6,
        flareSize: 0.012,
        flareSpeed: 0.01,
        flareShape: 0.12,
        animated: true,
        anamorphic: false,
        colorGain: FIRE_COLOR.clone().multiplyScalar(LENS_FLARE_COLOR_GAIN_SCALE),
        lensDirtTexture: null,
        haloScale: 0.35,
        secondaryGhosts: true,
        aditionalStreaks: true,
        ghostScale: 0.2,
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

    let bestBrightness = -1
    let bestScreenX = 0
    let bestScreenY = 0
    const visibleIntensity = Math.min(1, Math.max(0, intensity))

    WALL_LAYOUT.forEach((wall) => {
      const noise = getTorchNoise(state.clock.getElapsedTime(), wall.index + 1)
      const brightness =
        torchCandelaMultiplier *
        getTorchFlickerFactor(noise, torchFlickerAmount)

      targetPosition.copy(wall.torchPosition)
      projectedPosition.copy(targetPosition).project(camera)

      if (
        projectedPosition.z < -1 ||
        projectedPosition.z > 1 ||
        Math.abs(projectedPosition.x) > 1.2 ||
        Math.abs(projectedPosition.y) > 1.2
      ) {
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

      if (!visible || brightness <= bestBrightness) {
        return
      }

      bestBrightness = brightness
      bestScreenX = projectedPosition.x
      bestScreenY = projectedPosition.y
    })

    if (bestBrightness <= 0) {
      opacity.value += (1 - opacity.value) * Math.min(1, delta / 0.12)
      return
    }

    lensPosition.value.x = bestScreenX
    lensPosition.value.y = bestScreenY
    const targetOpacity = 1 - visibleIntensity
    opacity.value += (targetOpacity - opacity.value) * Math.min(1, delta / 0.12)
    colorGain.value
      .copy(FIRE_COLOR)
      .multiplyScalar(bestBrightness * LENS_FLARE_COLOR_GAIN_SCALE)
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function FlightRig({
  controlsOpen
}: {
  controlsOpen: boolean
}) {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
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
  const horizontalSpeed = useRef(0)
  const horizontalDirection = useRef(defaultMoveDirection.clone())
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const intendedPosition = useRef(new Vector3())
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isPointerLocked = useRef(false)
  const up = useMemo(() => new Vector3(0, 1, 0), [])

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
        setView?: (
          cameraPosition: [number, number, number],
          target: [number, number, number]
        ) => void
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}

    globalWindow.__levelsjamDebug = {
      ...existing,
      setView: (cameraPosition, target) => {
        playerPosition.current.set(
          cameraPosition[0],
          cameraPosition[1] - PLAYER_EYE_HEIGHT,
          cameraPosition[2]
        )
        velocity.current.set(0, 0, 0)
        horizontalSpeed.current = 0
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

      delete globalWindow.__levelsjamDebug.setView
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [camera])

  useFrame((_, delta) => {
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.copy(defaultMoveDirection)
    }

    right.current.crossVectors(forward.current, up).normalize()

    const desiredDirection = new Vector3()
    if (keys.current.KeyW) desiredDirection.add(forward.current)
    if (keys.current.KeyS) desiredDirection.addScaledVector(forward.current, -1)
    if (keys.current.KeyD) desiredDirection.add(right.current)
    if (keys.current.KeyA) desiredDirection.addScaledVector(right.current, -1)
    if (desiredDirection.lengthSq() > 0) {
      desiredDirection.normalize()
    }

    const horizontalVelocity = updateHorizontalVelocity(
      horizontalSpeed.current,
      {
        x: horizontalDirection.current.x,
        z: horizontalDirection.current.z
      },
      { x: desiredDirection.x, z: desiredDirection.z },
      delta
    )

    horizontalSpeed.current = horizontalVelocity.speed
    horizontalDirection.current.set(
      horizontalVelocity.direction.x,
      0,
      horizontalVelocity.direction.z
    )
    velocity.current.x = horizontalDirection.current.x * horizontalSpeed.current
    velocity.current.z = horizontalDirection.current.z * horizontalSpeed.current
    velocity.current.y = updateVerticalVelocity(
      velocity.current.y,
      grounded.current,
      Boolean(keys.current.Space),
      delta
    )

    intendedPosition.current
      .copy(playerPosition.current)
      .addScaledVector(velocity.current, delta)

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
      }
    )

    if (collision.position.x !== intendedPosition.current.x) {
      horizontalSpeed.current = 0
      velocity.current.x = 0
    }
    if (collision.position.y !== intendedPosition.current.y) {
      velocity.current.y = 0
    }
    if (collision.position.z !== intendedPosition.current.z) {
      horizontalSpeed.current = 0
      velocity.current.z = 0
    }

    grounded.current = collision.grounded && !keys.current.Space
    playerPosition.current.set(
      collision.position.x,
      collision.position.y,
      collision.position.z
    )

    const cameraPosition = getCameraPosition(playerPosition.current)

    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
  })

  return null
}

function Scene({
  controlsOpen,
  onAssetsReady,
  visualSettings
}: {
  controlsOpen: boolean
  onAssetsReady: () => void
  visualSettings: VisualSettings
}) {
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    onAssetsReady()
  }, [onAssetsReady])

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
        setSconceVisible?: (index: number, visible: boolean) => void
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
      setDebugVisible,
      setSconceVisible: (index, visible) => {
        setDebugVisible('sconce', index, visible)
      }
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      clearDebugIsolation()
      delete globalWindow.__levelsjamDebug.clearDebugIsolation
      delete globalWindow.__levelsjamDebug.setDebugVisible
      delete globalWindow.__levelsjamDebug.isolateDebugRole
      delete globalWindow.__levelsjamDebug.setSconceVisible
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [scene])

  return (
    <>
      <color
        args={['#0a0d12']}
        attach="background"
      />
      <EnvironmentLighting iblIntensity={visualSettings.iblIntensity} />
      <SceneGeometry
        flickerAmount={visualSettings.torchFlickerAmount}
        torchCandelaMultiplier={visualSettings.torchCandelaMultiplier}
      />
      <EffectComposer enableNormalPass>
        {visualSettings.ambientOcclusionMode === 'n8ao' ? (
          <N8AO
            aoRadius={28}
            color="#000000"
            denoiseRadius={8}
            distanceFalloff={0.2}
            halfRes
            intensity={visualSettings.ambientOcclusionIntensity}
            quality="medium"
            screenSpaceRadius
          />
        ) : null}
        {visualSettings.ambientOcclusionMode === 'ssao' ? (
          <SSAO
            bias={0.2}
            distanceFalloff={0.06}
            distanceThreshold={1}
            intensity={visualSettings.ambientOcclusionIntensity * 2}
            luminanceInfluence={0}
            radius={24}
            rangeFalloff={0.03}
            rangeThreshold={0.002}
            rings={4}
            samples={31}
          />
        ) : null}
        {visualSettings.ssr.enabled ? (
          <SSREffectPrimitive intensity={visualSettings.ssr.intensity} />
        ) : null}
        {visualSettings.bloom.enabled ? (
          <Bloom
            intensity={visualSettings.bloom.intensity}
            kernelSize={BLOOM_KERNEL_SIZES[visualSettings.bloom.kernelSize]}
            luminanceSmoothing={0.08}
            luminanceThreshold={0.6}
          />
        ) : null}
        {visualSettings.depthOfField.enabled ? (
          <DepthOfField
            bokehScale={visualSettings.depthOfField.bokehScale}
            focalLength={visualSettings.depthOfField.focalLength}
            focusDistance={visualSettings.depthOfField.focusDistance}
          />
        ) : null}
        {visualSettings.lensFlare.enabled ? (
          <TorchLensFlare
            intensity={visualSettings.lensFlare.intensity}
            torchCandelaMultiplier={visualSettings.torchCandelaMultiplier}
            torchFlickerAmount={visualSettings.torchFlickerAmount}
          />
        ) : null}
        {visualSettings.vignette.enabled ? (
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
      <FlightRig controlsOpen={controlsOpen} />
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
    { key: 'lensFlare', label: 'Lens Flares', min: 0, max: 1, step: 0.05 },
    { key: 'ssr', label: 'SSR', min: 0, max: 2, step: 0.05 },
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
        <output>{visualSettings.torchFlickerAmount.toFixed(2)}</output>
        <span>Torch Flicker</span>
        <input
          aria-label="Torch Flicker"
          max={MAX_TORCH_FLICKER_AMOUNT}
          min={MIN_TORCH_FLICKER_AMOUNT}
          onChange={(event) => {
            onScalarSettingChange('torchFlickerAmount', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.torchFlickerAmount}
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
        <span>DOF Focus Distance</span>
        <input
          aria-label="DOF Focus Distance"
          disabled={!visualSettings.depthOfField.enabled}
          max={1}
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
        <span>DOF Focal Length</span>
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

      {effectControls.map((effectControl) => {
        const effectSettings = visualSettings[effectControl.key]

        return (
          <div
            className="visual-control-row"
            key={effectControl.key}
          >
            <output>
              {effectSettings.enabled ? effectSettings.intensity.toFixed(2) : 'off'}
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
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [visualSettings, setVisualSettings] = useState(createDefaultVisualSettings)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
    setVisualSettings((current) => ({
      ...current,
      [key]: value
    }))
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
      <div className="fps-counter">{Math.round(fps)} FPS</div>
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
            gl.domElement.dataset.sceneReady = 'false'
          }}
          shadows
        >
          <RendererSettings
            exposureStops={visualSettings.exposureStops}
            toneMapping={visualSettings.toneMapping}
          />
          <Suspense fallback={null}>
            <Scene
              controlsOpen={controlsOpen}
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
