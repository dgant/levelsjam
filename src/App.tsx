import {
  DepthOfField,
  EffectComposer,
  LensFlareEffect as PostLensFlareEffect,
  N8AO,
  SSAO,
  ToneMapping,
  Vignette
} from '@react-three/postprocessing'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  BasicShadowMap,
  Box3,
  BoxGeometry,
  Camera as ThreeCamera,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CubeCamera,
  CubeTexture,
  CubeTextureLoader,
  CubeUVReflectionMapping,
  DataTexture,
  DataUtils,
  DepthTexture,
  DoubleSide,
  EquirectangularReflectionMapping,
  Euler,
  FloatType,
  Float32BufferAttribute,
  FrontSide,
  Group,
  HalfFloatType,
  LinearFilter,
  Material,
  MathUtils,
  Matrix4,
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
  NoColorSpace,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  PointLight as ThreePointLight,
  Quaternion,
  RGBAFormat,
  RGBFormat,
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
  WebGLRenderer,
  WebGLCubeRenderTarget
} from 'three'
import {
  Suspense,
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type RefObject,
  type ReactNode,
  useRef,
  useState
} from 'react'
import {
  BlendFunction,
  Effect,
  EffectAttribute,
  EffectPass,
  Pass,
  ToneMappingMode as PostToneMappingMode
} from 'postprocessing'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { UnrealBloomPass as ThreeUnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SSRPass as ThreeSSRPass } from 'three/addons/postprocessing/SSRPass.js'
import {
  AUTHORED_LIGHTING_SOURCE_SCALE,
  DEFAULT_EXPOSURE_STOPS,
  getHdrLightingIntensity,
  getRendererExposure
} from './lib/lightingCalibration.js'
import { decodeRgbE8 } from './lib/probeSphericalHarmonics.js'
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
  getAvailableMazeIds,
  getLoadedMazeLayoutIds,
  getWallBounds,
  unloadMazeLayoutById,
  loadMazeLayoutById,
  loadRandomMazeLayout,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPAWN_POSITION,
  resolveMazeDataUrl,
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
import {
  applyTurnAction,
  createInitialTurnState,
  getOpenGateIds,
  resetTurnStateToCheckpoint,
  type CardinalDirection,
  type TurnAction,
  type TurnMonster,
  type TurnState
} from './lib/turnRules.js'
import { cloneCachedGltfRoot, getCachedGltfRootUrls } from './lib/gltfRuntimeCache'

declare const __GIT_REVISION__: string
declare const __GIT_REVISION_TIMESTAMP__: string

const assetBase = import.meta.env.BASE_URL
const ENVIRONMENT_URL = `${assetBase}textures/environment/overcast_soil_1k.hdr`
const FIRE_FLIPBOOK_URL =
  `${assetBase}textures/fire/CampFire_l_nosmoke_front_Loop_01_4K_6x6.png`
const MONSTER_MODEL_URLS = {
  minotaur: `${assetBase}models/minotaur-runtime/scene.gltf`,
  spider: `${assetBase}models/pbr_jumping_spider_monster/scene.gltf`,
  werewolf: `${assetBase}models/awil_werewolf_runtime/scene.gltf`
} as const
const GATE_MODEL_URL = `${assetBase}models/metal_gate_runtime/scene.gltf`
const SWORD_MODEL_URL = `${assetBase}models/bronze_sword_mycean/scene.gltf`
const TROPHY_MODEL_URL = `${assetBase}models/head_of_a_bull_runtime/scene.gltf`
const PUDDLE_TEXTURE_URLS = {
  color: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Diffuse.jpg`,
  gloss: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Gloss.jpg`,
  normal: `${assetBase}textures/puddle-ground/puddle_ground-1K/1K-puddle_Normal.jpg`
}
const WALL_TEXTURE_URLS = {
  color: `${assetBase}textures/runtime/stone-wall-29/stonewall_29_basecolor-1K.png`,
  normal: `${assetBase}textures/runtime/stone-wall-29/stonewall_29_normal-1K.png`,
  orm: `${assetBase}textures/runtime/stone-wall-29/stonewall_29_orm-1K.png`
}
const METAL_TEXTURE_URLS = {
  color: `${assetBase}textures/runtime/metal-13/metal_13_basecolor-1K.png`,
  normal: `${assetBase}textures/runtime/metal-13/metal_13_normal-1K.png`,
  orm: `${assetBase}textures/runtime/metal-13/metal_13_orm-1K.png`
}
const LOOK_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.05
const DEFAULT_CAMERA_PITCH = MathUtils.degToRad(-5)
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
const FIRE_COLOR = new Color('#ff7e00')
const FIRE_LIGHT_COLOR = FIRE_COLOR.clone().multiplyScalar(10)
const BLACK_COLOR = new Color(0, 0, 0)
const LIGHTMAP_AMBIENT_TINT = new Color(1, 1, 1)
const TORCH_LIGHTMAP_TINT = FIRE_LIGHT_COLOR.clone()
const FIRE_BILLBOARD_INTENSITY_SCALE =
  AUTHORED_LIGHTING_SOURCE_SCALE / TORCH_BASE_CANDELA
const LENS_FLARE_INTENSITY_SCALE = 4
const LENS_FLARE_COLOR_GAIN = 40000
const LENS_FLARE_OCCLUSION_MARGIN = 0.05
const TORCH_BILLBOARD_LAYER = 1
const FLOOR_LIGHTMAP_INTENSITY_SCALE = 1
const WALL_LIGHTMAP_INTENSITY_SCALE = 1
const BAKED_ENVIRONMENT_INTENSITY = getHdrLightingIntensity(
  AUTHORED_LIGHTING_SOURCE_SCALE
)
const DEFAULT_LIGHTMAP_CONTRIBUTION_INTENSITY = 1
const DEFAULT_PROBE_IBL_INTENSITY = 1
const DEFAULT_REFLECTION_INTENSITY = 1
const MAX_LIGHTING_CONTRIBUTION_INTENSITY = 4
const BLOCKED_MOVE_FRACTION = 0.25
const RUNTIME_RADIANCE_RESOLUTION = 256
const RUNTIME_RADIANCE_CASCADE_COUNT = 4
const RUNTIME_RADIANCE_BASE_RAY_COUNT = 16
const RUNTIME_RADIANCE_DIRECT_GAIN = 3
const RUNTIME_RADIANCE_FOG_SCATTER_GAIN = 24
const RUNTIME_RADIANCE_INDIRECT_GAIN = 0.8
const RUNTIME_RADIANCE_MAX_DISTANCE = 18
const RUNTIME_RADIANCE_OCCLUDER_PADDING = WALL_WIDTH * 0.35
const RUNTIME_RADIANCE_SOURCE_RADIUS = 0.45
const RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET = WALL_WIDTH * 0.75
const RUNTIME_TORCH_FLICKER_INTENSITY = 0.15
const RUNTIME_SHADOW_SLOT_COUNT = 2
const RUNTIME_SHADOW_INNER_RADIUS = 3.5
const RUNTIME_SHADOW_OUTER_RADIUS = 8
const RUNTIME_SHADOW_SWITCH_MARGIN = 0.15
const RUNTIME_SHADOW_FADE_IN_SECONDS = 0.25
const RUNTIME_SHADOW_FADE_OUT_SECONDS = 0.75
const RUNTIME_SHADOW_REFRESH_SECONDS = 0.5
const RUNTIME_SHADOW_TORCH_INTENSITY = 0.35
const RUNTIME_SHADOW_TORCH_DISTANCE = 7

function recordStartupMarker(name: string) {
  if (document.body.dataset[name] && document.body.dataset[name] !== 'pending') {
    return
  }

  document.body.dataset[name] = performance.now().toFixed(1)
}

const MATERIAL_TEXTURE_PROPERTY_NAMES = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'map',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'transmissionMap'
] as const
function collectSceneMaterialTextures(scene: ThreeScene) {
  const textures: Texture[] = []
  const seenTextureIds = new Set<string>()

  scene.traverse((object) => {
    const materialOrMaterials = (object as { material?: Material | Material[] }).material

    if (!materialOrMaterials) {
      return
    }

    const materials = Array.isArray(materialOrMaterials)
      ? materialOrMaterials
      : [materialOrMaterials]

    for (const material of materials) {
      const materialRecord = material as Material & Record<string, unknown>

      for (const propertyName of MATERIAL_TEXTURE_PROPERTY_NAMES) {
        const value = materialRecord[propertyName]

        if (value instanceof Texture && !seenTextureIds.has(value.uuid)) {
          seenTextureIds.add(value.uuid)
          textures.push(value)
        }
      }
    }
  })

  return textures
}

function waitForNextAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function warmSceneTextures(
  gl: WebGLRenderer,
  scene: ThreeScene,
  isCancelled: () => boolean
) {
  const textures = collectSceneMaterialTextures(scene)

  for (const texture of textures) {
    if (isCancelled()) {
      return
    }

    gl.initTexture(texture)
    await waitForNextAnimationFrame()
  }
}

const MAZE_GROUND_PATCH_OFFSET_Y = 0.002
const REFLECTION_PROBE_RENDER_SIZE = 32
const REFLECTION_PROBE_AMBIENT_RENDER_SIZE = 24
const REFLECTION_PROBE_FAR = 48
const REFLECTION_PROBE_LOAD_CONCURRENCY = 8
const REFLECTION_PROBE_BACKGROUND_LOAD_CONCURRENCY = 1
const REFLECTION_PROBE_PUBLISH_INTERVAL_MS = 250
const REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT = 64
const REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES = 768 * 1024 * 1024
const REFLECTION_PROBE_STARTUP_DELAY_MS = 5000
const REFLECTION_PROBE_STARTUP_CAPTURE_DELAY_MS = 250
const REFLECTION_PROBE_BACKGROUND_CAPTURE_DELAY_MS = 1000
const REFLECTION_PROBE_EMISSIVE_RADIUS = 0.16
const REFLECTION_PROBE_EMISSIVE_SCALE = 2
const STARTUP_VOLUMETRIC_PROBE_READY_RADIUS = 12
const FOG_VOLUME_HEIGHT = 6
const FOG_EXTINCTION_SCALE = 1
const DEFAULT_VOLUMETRIC_AMBIENT_HEX = '#8f949e'
const DEFAULT_VOLUMETRIC_FOG_DISTANCE = 12
const EFFECT_EPSILON = 0.0001
const MAX_PHYSICS_SUBSTEPS = 10
const MIN_LOADING_OVERLAY_MS = 0
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
const playerFadeEffectShader = `
uniform vec3 fadeColor;
uniform float fadeAlpha;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(mix(inputColor.rgb, fadeColor, clamp(fadeAlpha, 0.0, 1.0)), inputColor.a);
}
`
const anamorphicEffectShader = `
uniform vec3 colorGain;
uniform float intensity;
uniform int samples;
uniform float scale;
uniform float texelWidth;
uniform float threshold;

float sampleLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  int halfSamples = samples / 2;
  float halfSamplesFloat = max(float(halfSamples), 1.0);
  vec3 streak = vec3(0.0);

  for (int index = 0; index < 64; index += 1) {
    if (index >= samples) {
      break;
    }

    float offset = float(index - halfSamples);
    float softness = 1.0 - (abs(offset) / halfSamplesFloat);
    vec2 sampleUv = vec2(uv.x + (texelWidth * offset * scale), uv.y);
    vec3 sampleColor = texture2D(inputBuffer, sampleUv).rgb;
    float brightPass = max(sampleLuminance(sampleColor) - threshold, 0.0);

    streak += sampleColor * brightPass * softness;
  }

  outputColor = vec4(inputColor.rgb + (streak * colorGain * intensity), inputColor.a);
}
`
const ditherEffectShader = `
float interleavedGradientNoise(vec2 position) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(position, magic.xy)));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float noise = interleavedGradientNoise(gl_FragCoord.xy) - 0.5;
  outputColor = vec4(inputColor.rgb + (noise / 255.0), inputColor.a);
}
`
const fogVolumeEffectShader = `
uniform mat4 cameraProjectionMatrixInverse;
uniform mat4 cameraWorldMatrix;
uniform vec3 cameraWorldPosition;
uniform float density;
uniform vec3 environmentFogColor;
uniform float fogDistance;
uniform float groundHeight;
uniform float heightFalloff;
uniform float lightingStrength;
uniform float noiseFrequency;
uniform float noisePeriod;
uniform float noiseStrength;
uniform vec4 probeAmbientBounds;
uniform vec2 probeAmbientGrid;
uniform sampler2D probeCoeffTextureL0;
uniform sampler2D probeDepthAtlasPx;
uniform sampler2D probeDepthAtlasNx;
uniform sampler2D probeDepthAtlasPy;
uniform sampler2D probeDepthAtlasNy;
uniform sampler2D probeDepthAtlasPz;
uniform sampler2D probeDepthAtlasNz;
uniform float probeDepthAtlasFaceSize;
uniform float probeHeight;
uniform sampler2D probeAmbientTexture;
uniform float rayStepCount;
uniform vec4 runtimeRadianceBounds;
uniform float runtimeRadianceIntensity;
uniform sampler2D runtimeRadianceTexture;
uniform float time;
uniform float useProbeCoefficientTexture;
uniform float useProbeDepthAtlases;
uniform float useProbeAmbientTexture;
uniform float volumeHeight;

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

float fogProbeCellSize(float span, float gridCount) {
  return gridCount > 1.5 ? span / (gridCount - 1.0) : ${MAZE_CELL_SIZE.toFixed(1)};
}

vec2 fogClampProbeGridCell(vec2 cell) {
  return clamp(cell, vec2(0.0), max(probeAmbientGrid - vec2(1.0), vec2(0.0)));
}

vec2 fogProbeGridCellToUv(vec2 cell) {
  return (fogClampProbeGridCell(cell) + vec2(0.5)) / max(probeAmbientGrid, vec2(1.0));
}

vec2 fogProbeGridCellToWorld(vec2 cell) {
  return vec2(
    probeAmbientBounds.x + (cell.x * fogProbeCellSize(probeAmbientBounds.z, probeAmbientGrid.x)),
    probeAmbientBounds.y + (cell.y * fogProbeCellSize(probeAmbientBounds.w, probeAmbientGrid.y))
  );
}

vec3 fogDirectionToDepthAtlasFace(vec3 direction) {
  vec3 absDirection = abs(direction);
  vec2 uv = vec2(0.5);
  float faceIndex = 0.0;

  if (absDirection.x >= absDirection.y && absDirection.x >= absDirection.z) {
    float invAxis = 0.5 / max(absDirection.x, 0.0001);

    if (direction.x >= 0.0) {
      faceIndex = 0.0;
      uv = vec2(-direction.z, -direction.y) * invAxis + vec2(0.5);
    } else {
      faceIndex = 1.0;
      uv = vec2(direction.z, -direction.y) * invAxis + vec2(0.5);
    }
  } else if (absDirection.y >= absDirection.x && absDirection.y >= absDirection.z) {
    float invAxis = 0.5 / max(absDirection.y, 0.0001);

    if (direction.y >= 0.0) {
      faceIndex = 2.0;
      uv = vec2(direction.x, direction.z) * invAxis + vec2(0.5);
    } else {
      faceIndex = 3.0;
      uv = vec2(direction.x, -direction.z) * invAxis + vec2(0.5);
    }
  } else {
    float invAxis = 0.5 / max(absDirection.z, 0.0001);

    if (direction.z >= 0.0) {
      faceIndex = 4.0;
      uv = vec2(direction.x, -direction.y) * invAxis + vec2(0.5);
    } else {
      faceIndex = 5.0;
      uv = vec2(-direction.x, -direction.y) * invAxis + vec2(0.5);
    }
  }

  return vec3(clamp(uv, 0.0, 1.0), faceIndex);
}

vec4 sampleFogDepthAtlasFace(float faceIndex, vec2 uv) {
  if (faceIndex < 0.5) {
    return texture2D(probeDepthAtlasPx, uv);
  }
  if (faceIndex < 1.5) {
    return texture2D(probeDepthAtlasNx, uv);
  }
  if (faceIndex < 2.5) {
    return texture2D(probeDepthAtlasPy, uv);
  }
  if (faceIndex < 3.5) {
    return texture2D(probeDepthAtlasNy, uv);
  }
  if (faceIndex < 4.5) {
    return texture2D(probeDepthAtlasPz, uv);
  }

  return texture2D(probeDepthAtlasNz, uv);
}

float decodePackedDistance(vec4 packedDistance) {
  return dot(
    packedDistance,
    vec4(
      1.0,
      1.0 / 255.0,
      1.0 / 65025.0,
      1.0 / 16581375.0
    )
  ) * ${REFLECTION_PROBE_FAR.toFixed(1)};
}

float sampleFogProbeGridDepth(vec2 cell, vec3 direction) {
  if (useProbeDepthAtlases < 0.5 || probeDepthAtlasFaceSize < 0.5) {
    return ${REFLECTION_PROBE_FAR.toFixed(1)};
  }

  vec3 faceUv = fogDirectionToDepthAtlasFace(normalize(direction));
  vec2 atlasSize = max(probeAmbientGrid * probeDepthAtlasFaceSize, vec2(1.0));
  vec2 atlasPixel =
    (fogClampProbeGridCell(cell) * probeDepthAtlasFaceSize) +
    (faceUv.xy * max(probeDepthAtlasFaceSize - 1.0, 0.0)) +
    vec2(0.5);
  vec2 atlasUv = atlasPixel / atlasSize;

  return decodePackedDistance(sampleFogDepthAtlasFace(faceUv.z, atlasUv));
}

float sampleFogProbeGridVisibility(vec3 worldPosition, vec2 cell) {
  if (useProbeDepthAtlases < 0.5) {
    return 1.0;
  }

  vec2 clampedCell = fogClampProbeGridCell(cell);
  vec2 probeWorldXZ = fogProbeGridCellToWorld(clampedCell);
  vec3 probePosition = vec3(probeWorldXZ.x, probeHeight, probeWorldXZ.y);
  vec3 toPoint = worldPosition - probePosition;
  float pointDistance = length(toPoint);

  if (pointDistance <= 0.0001) {
    return 1.0;
  }

  float storedDistance = sampleFogProbeGridDepth(clampedCell, toPoint);
  float bias = 0.06;

  return 1.0 - smoothstep(
    storedDistance + bias,
    storedDistance + bias + 0.12,
    pointDistance
  );
}

vec4 sampleFogAmbientCandidate(vec3 worldPosition, vec2 cell) {
  vec2 clampedCell = fogClampProbeGridCell(cell);
  vec2 uv = fogProbeGridCellToUv(clampedCell);
  vec4 coeff0 = texture2D(probeCoeffTextureL0, uv);

  if (coeff0.a <= 0.0) {
    return vec4(0.0);
  }

  float visibility = sampleFogProbeGridVisibility(worldPosition, clampedCell);

  if (visibility <= 0.0001) {
    return vec4(0.0);
  }

  float weight = visibility;
  vec3 color = max(coeff0.rgb / 0.282095, vec3(0.0));

  return vec4(color * weight, weight);
}

float fogProbeKernelWeight(vec2 gridPosition, vec2 cell) {
  vec2 distanceToCell = abs(gridPosition - cell);
  vec2 axisWeight = vec2(
    1.0 - smoothstep(0.5, 1.5, distanceToCell.x),
    1.0 - smoothstep(0.5, 1.5, distanceToCell.y)
  );

  return axisWeight.x * axisWeight.y;
}

vec3 sampleFogAmbientColor(vec3 worldPosition) {
  if (runtimeRadianceIntensity <= 0.0) {
    return vec3(0.0);
  }

  vec2 runtimeRadianceUv = (
    worldPosition.xz - runtimeRadianceBounds.xy
  ) / max( runtimeRadianceBounds.zw, vec2( 0.0001 ) );

  if (
    runtimeRadianceUv.x < 0.0 ||
    runtimeRadianceUv.x > 1.0 ||
    runtimeRadianceUv.y < 0.0 ||
    runtimeRadianceUv.y > 1.0
  ) {
    return vec3(0.0);
  }

  return
    texture2D(runtimeRadianceTexture, runtimeRadianceUv).rgb *
    runtimeRadianceIntensity *
    ${RUNTIME_RADIANCE_FOG_SCATTER_GAIN.toFixed(1)};
}

vec3 reconstructWorldPosition(vec2 uv, float sceneDepth) {
  vec4 clipPosition = vec4((uv * 2.0) - 1.0, (sceneDepth * 2.0) - 1.0, 1.0);
  vec4 viewPosition = cameraProjectionMatrixInverse * clipPosition;
  viewPosition /= max(viewPosition.w, 0.0001);

  return (cameraWorldMatrix * viewPosition).xyz;
}

vec3 reconstructWorldDirection(vec2 uv) {
  vec4 clipPosition = vec4((uv * 2.0) - 1.0, 1.0, 1.0);
  vec4 viewPosition = cameraProjectionMatrixInverse * clipPosition;
  vec3 viewDirection = normalize(viewPosition.xyz / max(viewPosition.w, 0.0001));

  return normalize((cameraWorldMatrix * vec4(viewDirection, 0.0)).xyz);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 rayOrigin = cameraWorldPosition;
  vec3 rayDirection = reconstructWorldDirection(uv);
  float tNear = 0.0;
  float sceneDistance = 1.0e20;

  if (depth < 0.999999) {
    sceneDistance = length(reconstructWorldPosition(uv, depth) - rayOrigin);
  }

  float segmentEnd = min(sceneDistance, max(fogDistance, 0.0));

  if (segmentEnd <= tNear) {
    outputColor = inputColor;
    return;
  }

  float pathLength = segmentEnd - tNear;
  float clampedStepCount = clamp(rayStepCount, 1.0, 24.0);
  float stepLength = pathLength / clampedStepCount;
  float transmittance = 1.0;
  vec3 accumulatedScattering = vec3(0.0);
  float rayJitter = hash(vec3((uv * vec2(171.0, 137.0)) + 0.123, 0.37));

  for (int stepIndex = 0; stepIndex < 24; stepIndex += 1) {
    if (float(stepIndex) >= clampedStepCount) {
      break;
    }

    float sampleDistance = tNear + (stepLength * (float(stepIndex) + rayJitter));
    vec3 samplePosition = rayOrigin + (rayDirection * sampleDistance);
    float sampleHeight = samplePosition.y - groundHeight;

    if (sampleHeight < 0.0 || sampleHeight > volumeHeight) {
      continue;
    }

    vec3 ambientColor =
      sampleFogAmbientColor(samplePosition) *
      environmentFogColor *
      max(0.0, lightingStrength);
    float heightDensity = exp2(
      -sampleHeight / max(heightFalloff, 0.0001)
    );
    float densityNoise = 1.0;

    if (noiseFrequency > 0.0001) {
      float noisePhase = noisePeriod > 0.0001 ? time / noisePeriod : 0.0;
      vec3 noisePoint = vec3(
        samplePosition.x / noiseFrequency,
        samplePosition.y / noiseFrequency,
        (samplePosition.z / noiseFrequency) + noisePhase
      );
      densityNoise = mix(
        1.0,
        mix(0.45, 1.0, noise(noisePoint)),
        clamp(noiseStrength, 0.0, 1.0)
      );
    }
    float extinction = max(0.0, density) * heightDensity * densityNoise;
    float stepTransmittance = exp(-extinction * stepLength);
    float scattering = 1.0 - stepTransmittance;

    accumulatedScattering += ambientColor * scattering * transmittance;
    transmittance *= stepTransmittance;

    if (transmittance <= 0.01) {
      break;
    }
  }

  outputColor = vec4((inputColor.rgb * transmittance) + accumulatedScattering, inputColor.a);
}
`

type ToneMappingMode = keyof typeof TONE_MAPPING_MODES
type AmbientOcclusionMode = (typeof AMBIENT_OCCLUSION_OPTIONS)[number]['key']

type EffectSettings = {
  enabled: boolean
  intensity: number
}

type VignetteSettings = EffectSettings & {
  exposureNoiseIntensity: number
  noiseIntensity: number
  noisePeriod: number
}

type VisualControlTabKey =
  | 'core'
  | 'ao'
  | 'bloom'
  | 'dof'
  | 'flares'
  | 'ssr'
  | 'fog'
  | 'vignette'
  | 'anamorphic'
  | 'solution'

type LightingContributionSettings = {
  enabled: boolean
  intensity: number
}

type ProbeDebugMode =
  | 'none'
  | 'reflection'

type AnamorphicSettings = EffectSettings & {
  colorGain: number
  samples: number
  scale: number
  threshold: number
}

type SSRPassOutputMode =
  | 'default'
  | 'ssr'
  | 'beauty'
  | 'depth'
  | 'normal'
  | 'metalness'

type SSRSettings = EffectSettings & {
  blur: boolean
  bouncing: boolean
  distanceAttenuation: boolean
  fresnel: boolean
  infiniteThick: boolean
  maxDistance: number
  output: SSRPassOutputMode
  resolutionScale: number
  thickness: number
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
  resolutionScale: number
  smoothing: number
  threshold: number
}

type DepthOfFieldSettings = {
  bokehScale: number
  enabled: boolean
  focalLength: number
  focusDistance: number
  resolutionScale: number
}

type LensFlareSettings = EffectSettings & {
  aditionalStreaks: boolean
  animated: boolean
  anamorphic: boolean
  flareShape: number
  flareSize: number
  flareSpeed: number
  ghostScale: number
  glareSize: number
  haloScale: number
  opacity: number
  secondaryGhosts: boolean
  starBurst: boolean
  starPoints: number
}

type MovementSettings = {
  accelerationDistance: number
  decelerationDistance: number
  maxHorizontalSpeedMph: number
}

const BLOOM_UNREAL_RADII: Record<BloomKernelSizeKey, number> = {
  'very-small': 0.08,
  small: 0.16,
  medium: 0.28,
  large: 0.42,
  'very-large': 0.62,
  huge: 0.88
}

const BLOOM_RESOLUTION_SCALES: Record<BloomKernelSizeKey, number> = {
  'very-small': 1,
  small: 0.7,
  medium: 0.45,
  large: 0.28,
  'very-large': 0.18,
  huge: 0.1
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

const VISUAL_CONTROL_TABS: Array<{
  hotkey: string
  key: VisualControlTabKey
  label: string
}> = [
  { hotkey: '1', key: 'core', label: 'Core' },
  { hotkey: '2', key: 'ao', label: 'AO' },
  { hotkey: '3', key: 'bloom', label: 'Bloom' },
  { hotkey: '4', key: 'dof', label: 'DOF' },
  { hotkey: '5', key: 'flares', label: 'Flares' },
  { hotkey: '6', key: 'ssr', label: 'SSR' },
  { hotkey: '7', key: 'fog', label: 'Fog' },
  { hotkey: '8', key: 'vignette', label: 'Vignette' },
  { hotkey: '9', key: 'anamorphic', label: 'Anamorphic' },
  { hotkey: '0', key: 'solution', label: 'Solution' }
]

const DEFAULT_AO_RADIUS_METERS = 1
const DEFAULT_VOLUMETRIC_NOISE_FREQUENCY = 10
const DEFAULT_VOLUMETRIC_NOISE_PERIOD = 5
const DEFAULT_VOLUMETRIC_NOISE_STRENGTH = 1
const DEFAULT_VOLUMETRIC_HEIGHT_FALLOFF = 0.5
const DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH = 1
const DEFAULT_VOLUMETRIC_STEP_COUNT = 16
const MAX_SIMULTANEOUS_LENS_FLARES = 5
const MAX_BUFFERED_TURN_COMMANDS = 10
const GIT_REVISION = __GIT_REVISION__
const GIT_REVISION_TIMESTAMP = __GIT_REVISION_TIMESTAMP__
const PROBE_DEBUG_MODE_OPTIONS: Array<{ key: ProbeDebugMode, label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'reflection', label: 'Reflection' }
]
const SSR_OUTPUT_OPTIONS: Array<{ key: SSRPassOutputMode, label: string, value: number }> = [
  { key: 'default', label: 'Default', value: 0 },
  { key: 'ssr', label: 'SSR', value: 1 },
  { key: 'beauty', label: 'Beauty', value: 3 },
  { key: 'depth', label: 'Depth', value: 4 },
  { key: 'normal', label: 'Normal', value: 5 },
  { key: 'metalness', label: 'Metalness', value: 7 }
]

type VisualSettings = {
  anamorphic: AnamorphicSettings
  ambientOcclusionIntensity: number
  ambientOcclusionMode: AmbientOcclusionMode
  ambientOcclusionRadius: number
  exposureStops: number
  cameraFov: number
  iblContribution: LightingContributionSettings
  lightmapContribution: LightingContributionSettings
  lensFlare: LensFlareSettings
  probeDebugMode: ProbeDebugMode
  reflectionContribution: LightingContributionSettings
  staticVolumetricContribution: LightingContributionSettings
  toneMapping: ToneMappingMode
  bloom: BloomSettings
  depthOfField: DepthOfFieldSettings
  movement: MovementSettings
  ssr: SSRSettings
  volumetricAmbientHex: string
  volumetricDistance: number
  volumetricHeightFalloff: number
  volumetricLightingStrength: number
  volumetricLighting: EffectSettings
  volumetricNoiseFrequency: number
  volumetricNoisePeriod: number
  volumetricNoiseStrength: number
  volumetricShadowsEnabled: boolean
  volumetricStepCount: number
  vignette: VignetteSettings
}

type VisualSettingsPatch = Partial<{
  ambientOcclusionIntensity: number
  ambientOcclusionMode: AmbientOcclusionMode
  ambientOcclusionRadius: number
  anamorphic: Partial<AnamorphicSettings>
  bloom: Partial<BloomSettings>
  depthOfField: Partial<DepthOfFieldSettings>
  exposureStops: number
  cameraFov: number
  iblContribution: Partial<LightingContributionSettings>
  lensFlare: Partial<LensFlareSettings>
  lightmapContribution: Partial<LightingContributionSettings>
  movement: Partial<MovementSettings>
  probeDebugMode: ProbeDebugMode
  reflectionContribution: Partial<LightingContributionSettings>
  staticVolumetricContribution: Partial<LightingContributionSettings>
  ssr: Partial<SSRSettings>
  toneMapping: ToneMappingMode
  volumetricAmbientHex: string
  volumetricDistance: number
  volumetricHeightFalloff: number
  volumetricLighting: Partial<EffectSettings>
  volumetricLightingStrength: number
  volumetricNoiseFrequency: number
  volumetricNoisePeriod: number
  volumetricNoiseStrength: number
  volumetricShadowsEnabled: boolean
  volumetricStepCount: number
  vignette: Partial<VignetteSettings>
}>

type GenericEffectSettingKey =
  'vignette' |
  'volumetricLighting'
type BooleanSettingKey =
  | 'iblContributionEnabled'
  | 'lightmapContributionEnabled'
  | 'reflectionContributionEnabled'
  | 'staticVolumetricContributionEnabled'
  | 'volumetricShadowsEnabled'
type ScalarSettingKey =
  | 'ambientOcclusionIntensity'
  | 'ambientOcclusionRadius'
  | 'cameraFov'
  | 'exposureStops'
  | 'iblContributionIntensity'
  | 'lightmapContributionIntensity'
  | 'reflectionContributionIntensity'
  | 'staticVolumetricContributionIntensity'
  | 'volumetricDistance'
  | 'volumetricHeightFalloff'
  | 'volumetricLightingStrength'
  | 'volumetricNoiseFrequency'
  | 'volumetricNoisePeriod'
  | 'volumetricNoiseStrength'
  | 'volumetricStepCount'
  | 'vignetteExposureNoiseIntensity'
  | 'vignetteIntensity'
  | 'vignetteNoiseIntensity'
  | 'vignetteNoisePeriod'

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

type RuntimeProbeAssetManifest = {
  faceSize: number
  generatedAt: string
  mazeId: string
  probeCount: number
  probes: Array<{
    coefficients: number[][]
    depthFaces: string[]
    index: number
    processedCubeUvRgbE: string
    textureHeight: number
    textureWidth: number
  }>
}

type ProbeIrradianceCoefficients = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number]
]

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
type ProbeVlmMode = 'disabled' | 'cell5' | 'boundary8'

type ProbeTextureInfo = {
  maxMip: number
  texelHeight: number
  texelWidth: number
}

type ProbeDepthAtlasTextures = [
  Texture | null,
  Texture | null,
  Texture | null,
  Texture | null,
  Texture | null,
  Texture | null
]

const EMPTY_PROBE_DEPTH_ATLAS_TEXTURES: ProbeDepthAtlasTextures = [
  null,
  null,
  null,
  null,
  null,
  null
]
const EMPTY_PROBE_COEFFICIENT_TEXTURES = [
  null,
  null,
  null,
  null
] as unknown as [Texture, Texture, Texture, Texture]
const EMPTY_PROBE_COEFFICIENTS: Array<ProbeIrradianceCoefficients | null> = []

type ProbeBlendConfig = {
  diffuseIntensity?: number
  mode: ProbeBlendMode
  probeCellSize?: number
  probeCoefficients?: Array<ProbeIrradianceCoefficients | null>
  probeCoeffTextureL0?: Texture | null
  probeCoeffTextureL1?: Texture | null
  probeCoeffTextureL2?: Texture | null
  probeCoeffTextureL3?: Texture | null
  probeDepthAtlasTextures?: ProbeDepthAtlasTextures
  probeDepthTextures?: Array<CubeTexture | null>
  probeGridMin?: {
    x: number
    z: number
  }
  probeGridSize?: {
    x: number
    y: number
  }
  probeHeight?: number
  radianceIntensity?: number
  radianceMode?: ProbeBlendMode
  useProbeDepthAtlases?: boolean
  vlmBoundaryNormal?: {
    x: number
    z: number
  }
  vlmMode?: ProbeVlmMode
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
    localProbeDepthMap0?: Uniform<CubeTexture | null>
    localProbeDepthMap1?: Uniform<CubeTexture | null>
    localProbeDepthMap2?: Uniform<CubeTexture | null>
    localProbeDepthMap3?: Uniform<CubeTexture | null>
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
    localProbeCoeffL00?: Uniform<Vector3>
    localProbeCoeffL01?: Uniform<Vector3>
    localProbeCoeffL02?: Uniform<Vector3>
    localProbeCoeffL03?: Uniform<Vector3>
    localProbeCoeffL10?: Uniform<Vector3>
    localProbeCoeffL11?: Uniform<Vector3>
    localProbeCoeffL12?: Uniform<Vector3>
    localProbeCoeffL13?: Uniform<Vector3>
    localProbeCoeffL20?: Uniform<Vector3>
    localProbeCoeffL21?: Uniform<Vector3>
    localProbeCoeffL22?: Uniform<Vector3>
    localProbeCoeffL23?: Uniform<Vector3>
    localProbeCoeffL30?: Uniform<Vector3>
    localProbeCoeffL31?: Uniform<Vector3>
    localProbeCoeffL32?: Uniform<Vector3>
    localProbeCoeffL33?: Uniform<Vector3>
    localProbeCoeffTextureL0?: Uniform<Texture | null>
    localProbeCoeffTextureL1?: Uniform<Texture | null>
    localProbeCoeffTextureL2?: Uniform<Texture | null>
    localProbeCoeffTextureL3?: Uniform<Texture | null>
    localProbeDepthAtlasNx?: Uniform<Texture | null>
    localProbeDepthAtlasNy?: Uniform<Texture | null>
    localProbeDepthAtlasNz?: Uniform<Texture | null>
    localProbeDepthAtlasPx?: Uniform<Texture | null>
    localProbeDepthAtlasPy?: Uniform<Texture | null>
    localProbeDepthAtlasPz?: Uniform<Texture | null>
    probeBlendMode?: Uniform<number>
    probeBlendDiffuseIntensity?: Uniform<number>
    probeBoundaryNormal?: Uniform<Vector2>
    probeCellSize?: Uniform<number>
    probeDepthAtlasFaceSize?: Uniform<number>
    probeHeight?: Uniform<number>
    probeGridMin?: Uniform<Vector2>
    probeGridSize?: Uniform<Vector2>
    probeBlendRadianceMode?: Uniform<number>
    probeBlendRadianceIntensity?: Uniform<number>
    probeBlendRegion?: Uniform<Vector4>
    probeBlendWeights?: Uniform<Vector4>
  runtimeRadianceBounds?: Uniform<Vector4>
  runtimeRadianceIntensity?: Uniform<number>
  runtimeRadianceNormalOffset?: Uniform<number>
  runtimeRadianceTexture?: Uniform<Texture | null>
    useProbeDepthAtlases?: Uniform<number>
    probeVlmMode?: Uniform<number>
  }
}

type MaterialShaderPatchConfig = {
  lightMapEncoding?: LightmapTextureEncoding
  lightMapAmbientTint?: Color
  lightMapTorchTint?: Color
  runtimeRadianceBounds?: RuntimeRadianceBounds
  runtimeRadianceIntensity?: number
  runtimeRadianceNormalOffset?: number
  runtimeRadianceTexture?: Texture | null
}

type LightmapTextureEncoding = 'linear' | 'rgbe8'

type RuntimeRadianceBounds = {
  depth: number
  minX: number
  minZ: number
  width: number
}

type RuntimeRadianceSurface = {
  bounds: RuntimeRadianceBounds
  debug: RuntimeRadianceDebugState
  ready: boolean
  texture: Texture
}

type RuntimeRadianceDebugState = {
  bounds: RuntimeRadianceBounds
  cascadeCount: number
  cascadeHeight: number
  cascadeWidth: number
  emitterPixelCount: number
  emitterFlicker: Array<{
    lightId: string
    value: number
  }>
  generationMs: number
  gpuUpdateCount: number
  latestGpuUpdateMs: number
  lightCount: number
  occluderCount: number
  resolution: number
  sceneResolution: number
  shadowSlots?: RuntimeShadowSlotDebugState[]
}

type RuntimeShadowSlotDebugState = {
  flicker: number
  lightId: string | null
  targetWeight: number
  weight: number
}

const VolumetricShadowContext = createContext(true)

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
  orm?: string
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

class PlayerFadeEffectImpl extends Effect {
  constructor() {
    super('PlayerFadeEffect', playerFadeEffectShader, {
      uniforms: new Map([
        ['fadeAlpha', new Uniform(0)],
        ['fadeColor', new Uniform(new Color(0, 0, 0))]
      ])
    })
  }

  set fadeAlpha(value: number) {
    this.uniforms.get('fadeAlpha').value = MathUtils.clamp(value, 0, 1)
  }

  set fadeColor(value: Color) {
    this.uniforms.get('fadeColor').value.copy(value)
  }
}

class AnamorphicEffectImpl extends Effect {
  constructor() {
    super('AnamorphicEffect', anamorphicEffectShader, {
      uniforms: new Map([
        ['colorGain', new Uniform(FIRE_COLOR.clone())],
        ['intensity', new Uniform(0)],
        ['samples', new Uniform(32)],
        ['scale', new Uniform(3)],
        ['texelWidth', new Uniform(1)],
        ['threshold', new Uniform(0.9)]
      ])
    })
  }

  set colorGain(value: Color) {
    this.uniforms.get('colorGain').value.copy(value)
  }

  set intensity(value: number) {
    this.uniforms.get('intensity').value = value
  }

  set samples(value: number) {
    this.uniforms.get('samples').value = Math.max(1, Math.min(64, Math.round(value)))
  }

  set scale(value: number) {
    this.uniforms.get('scale').value = value
  }

  set texelWidth(value: number) {
    this.uniforms.get('texelWidth').value = value
  }

  set threshold(value: number) {
    this.uniforms.get('threshold').value = value
  }
}

class DitherEffectImpl extends Effect {
  constructor() {
    super('DitherEffect', ditherEffectShader)
  }
}

class FogVolumeEffectImpl extends Effect {
  constructor() {
    super('FogVolumeEffect', fogVolumeEffectShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['cameraProjectionMatrixInverse', new Uniform(new Matrix4())],
        ['cameraWorldMatrix', new Uniform(new Matrix4())],
        ['cameraWorldPosition', new Uniform(new Vector3())],
        ['density', new Uniform(0)],
        ['environmentFogColor', new Uniform(DEFAULT_FOG_IBL_COLOR.clone())],
        ['fogDistance', new Uniform(DEFAULT_VOLUMETRIC_FOG_DISTANCE)],
        ['groundHeight', new Uniform(GROUND_Y)],
        ['heightFalloff', new Uniform(DEFAULT_VOLUMETRIC_HEIGHT_FALLOFF)],
        ['lightingStrength', new Uniform(DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH)],
        ['noiseFrequency', new Uniform(DEFAULT_VOLUMETRIC_NOISE_FREQUENCY)],
        ['noisePeriod', new Uniform(5)],
        ['noiseStrength', new Uniform(DEFAULT_VOLUMETRIC_NOISE_STRENGTH)],
        ['probeAmbientBounds', new Uniform(new Vector4())],
        ['probeAmbientGrid', new Uniform(new Vector2())],
        ['probeCoeffTextureL0', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasPx', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasNx', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasPy', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasNy', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasPz', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasNz', new Uniform<Texture | null>(null)],
        ['probeDepthAtlasFaceSize', new Uniform(0)],
        ['probeHeight', new Uniform(1.25)],
        ['probeAmbientTexture', new Uniform<Texture | null>(null)],
        ['rayStepCount', new Uniform(DEFAULT_VOLUMETRIC_STEP_COUNT)],
        ['runtimeRadianceBounds', new Uniform(new Vector4(0, 0, 1, 1))],
        ['runtimeRadianceIntensity', new Uniform(0)],
        ['runtimeRadianceTexture', new Uniform<Texture | null>(null)],
        ['time', new Uniform(0)],
        ['useProbeCoefficientTexture', new Uniform(0)],
        ['useProbeDepthAtlases', new Uniform(0)],
        ['useProbeAmbientTexture', new Uniform(0)],
        ['volumeHeight', new Uniform(FOG_VOLUME_HEIGHT)]
      ])
    })
  }

  set cameraProjectionMatrixInverse(value: Matrix4) {
    this.uniforms.get('cameraProjectionMatrixInverse').value.copy(value)
  }

  set cameraWorldMatrix(value: Matrix4) {
    this.uniforms.get('cameraWorldMatrix').value.copy(value)
  }

  set cameraWorldPosition(value: Vector3) {
    this.uniforms.get('cameraWorldPosition').value.copy(value)
  }

  set density(value: number) {
    this.uniforms.get('density').value = value
  }

  set environmentFogColor(value: Color) {
    this.uniforms.get('environmentFogColor').value.copy(value)
  }

  set fogDistance(value: number) {
    this.uniforms.get('fogDistance').value = value
  }

  set groundHeight(value: number) {
    this.uniforms.get('groundHeight').value = value
  }

  set heightFalloff(value: number) {
    this.uniforms.get('heightFalloff').value = value
  }

  set lightingStrength(value: number) {
    this.uniforms.get('lightingStrength').value = value
  }

  set noiseFrequency(value: number) {
    this.uniforms.get('noiseFrequency').value = value
  }

  set noisePeriod(value: number) {
    this.uniforms.get('noisePeriod').value = value
  }

  set noiseStrength(value: number) {
    this.uniforms.get('noiseStrength').value = value
  }

  set probeAmbientBounds(value: Vector4) {
    this.uniforms.get('probeAmbientBounds').value.copy(value)
  }

  set probeAmbientGrid(value: Vector2) {
    this.uniforms.get('probeAmbientGrid').value.copy(value)
  }

  set probeCoeffTextureL0(value: Texture | null) {
    this.uniforms.get('probeCoeffTextureL0').value = value
  }

  set probeDepthAtlasTextures(value: ProbeDepthAtlasTextures) {
    this.uniforms.get('probeDepthAtlasPx').value = value[0]
    this.uniforms.get('probeDepthAtlasNx').value = value[1]
    this.uniforms.get('probeDepthAtlasPy').value = value[2]
    this.uniforms.get('probeDepthAtlasNy').value = value[3]
    this.uniforms.get('probeDepthAtlasPz').value = value[4]
    this.uniforms.get('probeDepthAtlasNz').value = value[5]
  }

  set probeDepthAtlasFaceSize(value: number) {
    this.uniforms.get('probeDepthAtlasFaceSize').value = value
  }

  set probeHeight(value: number) {
    this.uniforms.get('probeHeight').value = value
  }

  set probeAmbientTexture(value: Texture | null) {
    this.uniforms.get('probeAmbientTexture').value = value
  }

  set rayStepCount(value: number) {
    this.uniforms.get('rayStepCount').value = value
  }

  set runtimeRadianceBounds(value: RuntimeRadianceBounds) {
    this.uniforms.get('runtimeRadianceBounds').value.set(
      value.minX,
      value.minZ,
      value.width,
      value.depth
    )
  }

  set runtimeRadianceIntensity(value: number) {
    this.uniforms.get('runtimeRadianceIntensity').value = value
  }

  set runtimeRadianceTexture(value: Texture | null) {
    this.uniforms.get('runtimeRadianceTexture').value = value
  }

  set time(value: number) {
    this.uniforms.get('time').value = value
  }

  set useProbeCoefficientTexture(value: number) {
    this.uniforms.get('useProbeCoefficientTexture').value = value
  }

  set useProbeDepthAtlases(value: number) {
    this.uniforms.get('useProbeDepthAtlases').value = value
  }

  set useProbeAmbientTexture(value: number) {
    this.uniforms.get('useProbeAmbientTexture').value = value
  }

  set volumeHeight(value: number) {
    this.uniforms.get('volumeHeight').value = value
  }
}

function createDefaultVisualSettings(): VisualSettings {
  return {
    anamorphic: {
      colorGain: 1,
      enabled: false,
      intensity: 0.5,
      samples: 32,
      scale: 3,
      threshold: 0.9
    },
    ambientOcclusionIntensity: 1,
    ambientOcclusionRadius: DEFAULT_AO_RADIUS_METERS,
    ambientOcclusionMode: 'n8ao',
    cameraFov: 60,
    exposureStops: DEFAULT_EXPOSURE_STOPS,
    iblContribution: {
      enabled: true,
      intensity: DEFAULT_PROBE_IBL_INTENSITY
    },
    lightmapContribution: {
      enabled: true,
      intensity: DEFAULT_LIGHTMAP_CONTRIBUTION_INTENSITY
    },
    lensFlare: {
      aditionalStreaks: false,
      animated: false,
      anamorphic: true,
      enabled: false,
      flareShape: 0.03,
      flareSize: 0.01,
      flareSpeed: 0.01,
      ghostScale: 0,
      glareSize: 0,
      haloScale: 0.16,
      intensity: 0.1,
      opacity: 0.1,
      secondaryGhosts: false,
      starBurst: false,
      starPoints: 6
    },
    probeDebugMode: 'none',
    reflectionContribution: {
      enabled: true,
      intensity: DEFAULT_REFLECTION_INTENSITY
    },
    staticVolumetricContribution: {
      enabled: false,
      intensity: DEFAULT_PROBE_IBL_INTENSITY
    },
    toneMapping: 'agx',
    bloom: {
      enabled: false,
      intensity: 0.65,
      kernelSize: 'huge',
      resolutionScale: 0.25,
      smoothing: 0.5,
      threshold: 0.5
    },
    depthOfField: {
      bokehScale: 0,
      enabled: false,
      focalLength: 0.03,
      focusDistance: 0.02,
      resolutionScale: 0.25
    },
    movement: {
      accelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalAccelerationDistance,
      decelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalDecelerationDistance,
      maxHorizontalSpeedMph: DEFAULT_MOVEMENT_SETTINGS.maxHorizontalSpeedMph
    },
    ssr: {
      blur: true,
      bouncing: false,
      distanceAttenuation: true,
      enabled: false,
      fresnel: true,
      intensity: 0,
      infiniteThick: false,
      maxDistance: 18,
      output: 'default',
      resolutionScale: 0.75,
      thickness: 0.018
    },
    volumetricAmbientHex: DEFAULT_VOLUMETRIC_AMBIENT_HEX,
    volumetricDistance: DEFAULT_VOLUMETRIC_FOG_DISTANCE,
    volumetricHeightFalloff: 0.5,
    volumetricLightingStrength: DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH,
    volumetricLighting: { enabled: true, intensity: 1 },
    volumetricNoiseFrequency: DEFAULT_VOLUMETRIC_NOISE_FREQUENCY,
    volumetricNoisePeriod: DEFAULT_VOLUMETRIC_NOISE_PERIOD,
    volumetricNoiseStrength: DEFAULT_VOLUMETRIC_NOISE_STRENGTH,
    volumetricShadowsEnabled: true,
    volumetricStepCount: DEFAULT_VOLUMETRIC_STEP_COUNT,
    vignette: {
      enabled: true,
      exposureNoiseIntensity: 0,
      intensity: 0.6,
      noiseIntensity: 0,
      noisePeriod: 5
    }
  }
}

function isEffectActive(effect: EffectSettings) {
  return effect.enabled && effect.intensity > EFFECT_EPSILON
}

function getEnabledContributionIntensity(settings: LightingContributionSettings) {
  return settings.enabled ? settings.intensity : 0
}

function applyVisualSettingsPatch(
  settings: VisualSettings,
  patch: VisualSettingsPatch
) {
  return {
    ...settings,
    ...(patch.ambientOcclusionIntensity === undefined
      ? null
      : { ambientOcclusionIntensity: patch.ambientOcclusionIntensity }),
    ...(patch.ambientOcclusionMode === undefined
      ? null
      : { ambientOcclusionMode: patch.ambientOcclusionMode }),
    ...(patch.ambientOcclusionRadius === undefined
      ? null
      : { ambientOcclusionRadius: patch.ambientOcclusionRadius }),
    ...(patch.exposureStops === undefined
      ? null
      : { exposureStops: patch.exposureStops }),
    ...(patch.cameraFov === undefined
      ? null
      : { cameraFov: patch.cameraFov }),
    ...(patch.probeDebugMode === undefined
      ? null
      : { probeDebugMode: patch.probeDebugMode }),
    ...(patch.toneMapping === undefined
      ? null
      : { toneMapping: patch.toneMapping }),
    ...(patch.volumetricAmbientHex === undefined
      ? null
      : { volumetricAmbientHex: patch.volumetricAmbientHex }),
    ...(patch.volumetricDistance === undefined
      ? null
      : { volumetricDistance: patch.volumetricDistance }),
    ...(patch.volumetricHeightFalloff === undefined
      ? null
      : { volumetricHeightFalloff: patch.volumetricHeightFalloff }),
    ...(patch.volumetricLightingStrength === undefined
      ? null
      : { volumetricLightingStrength: patch.volumetricLightingStrength }),
    ...(patch.volumetricNoiseFrequency === undefined
      ? null
      : { volumetricNoiseFrequency: patch.volumetricNoiseFrequency }),
    ...(patch.volumetricNoisePeriod === undefined
      ? null
      : { volumetricNoisePeriod: patch.volumetricNoisePeriod }),
    ...(patch.volumetricNoiseStrength === undefined
      ? null
      : { volumetricNoiseStrength: patch.volumetricNoiseStrength }),
    ...(patch.volumetricShadowsEnabled === undefined
      ? null
      : { volumetricShadowsEnabled: patch.volumetricShadowsEnabled }),
    ...(patch.volumetricStepCount === undefined
      ? null
      : { volumetricStepCount: patch.volumetricStepCount }),
    anamorphic: patch.anamorphic
      ? {
          ...settings.anamorphic,
          ...patch.anamorphic
        }
      : settings.anamorphic,
    bloom: patch.bloom
      ? {
          ...settings.bloom,
          ...patch.bloom
        }
      : settings.bloom,
    depthOfField: patch.depthOfField
      ? {
          ...settings.depthOfField,
          ...patch.depthOfField
        }
      : settings.depthOfField,
    iblContribution: patch.iblContribution
      ? {
          ...settings.iblContribution,
          ...patch.iblContribution
        }
      : settings.iblContribution,
    lensFlare: patch.lensFlare
      ? {
          ...settings.lensFlare,
          ...patch.lensFlare
        }
      : settings.lensFlare,
    lightmapContribution: patch.lightmapContribution
      ? {
          ...settings.lightmapContribution,
          ...patch.lightmapContribution
        }
      : settings.lightmapContribution,
    movement: patch.movement
      ? {
          ...settings.movement,
          ...patch.movement
        }
      : settings.movement,
    reflectionContribution: patch.reflectionContribution
      ? {
          ...settings.reflectionContribution,
          ...patch.reflectionContribution
        }
      : settings.reflectionContribution,
    staticVolumetricContribution: patch.staticVolumetricContribution
      ? {
          ...settings.staticVolumetricContribution,
          ...patch.staticVolumetricContribution
        }
      : settings.staticVolumetricContribution,
    ssr: patch.ssr
      ? {
          ...settings.ssr,
          ...patch.ssr
        }
      : settings.ssr,
    volumetricLighting: patch.volumetricLighting
      ? {
          ...settings.volumetricLighting,
          ...patch.volumetricLighting
        }
      : settings.volumetricLighting,
    vignette: patch.vignette
      ? {
          ...settings.vignette,
          ...patch.vignette
        }
      : settings.vignette
  }
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

vec4 probeBlendBilinearCubeUV(
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
    return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) );
  #else
    return texture2D( envMap, uv );
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
  vec4 color0 = probeBlendBilinearCubeUV(
    envMap,
    sampleDir,
    mipInt,
    texelWidth,
    texelHeight,
    maxMip
  );

  if ( mipF == 0.0 ) {
    return color0;
  }

  vec4 color1 = probeBlendBilinearCubeUV(
    envMap,
    sampleDir,
    mipInt + 1.0,
    texelWidth,
    texelHeight,
    maxMip
  );

  return mix( color0, color1, mipF );
}
`

const PROBE_BLEND_SHADER_CHUNK = `

#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
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
#endif

uniform int probeBlendMode;
uniform int probeBlendRadianceMode;
uniform vec4 probeBlendWeights;
uniform vec4 probeBlendRegion;
#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
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
#endif

uniform vec3 localProbeCoeffL00;
uniform vec3 localProbeCoeffL01;
uniform vec3 localProbeCoeffL02;
uniform vec3 localProbeCoeffL03;
uniform vec3 localProbeCoeffL10;
uniform vec3 localProbeCoeffL11;
uniform vec3 localProbeCoeffL12;
uniform vec3 localProbeCoeffL13;
uniform vec3 localProbeCoeffL20;
uniform vec3 localProbeCoeffL21;
uniform vec3 localProbeCoeffL22;
uniform vec3 localProbeCoeffL23;
uniform vec3 localProbeCoeffL30;
uniform vec3 localProbeCoeffL31;
uniform vec3 localProbeCoeffL32;
uniform vec3 localProbeCoeffL33;
#if defined(PROBE_BLEND_ENABLE_VLM_TEXTURES)
uniform sampler2D localProbeCoeffTextureL0;
uniform sampler2D localProbeCoeffTextureL1;
uniform sampler2D localProbeCoeffTextureL2;
uniform sampler2D localProbeCoeffTextureL3;
uniform sampler2D localProbeDepthAtlasPx;
uniform sampler2D localProbeDepthAtlasNx;
uniform sampler2D localProbeDepthAtlasPy;
uniform sampler2D localProbeDepthAtlasNy;
uniform sampler2D localProbeDepthAtlasPz;
uniform sampler2D localProbeDepthAtlasNz;
#endif
uniform vec2 probeBoundaryNormal;
uniform float probeCellSize;
uniform float probeDepthAtlasFaceSize;
uniform float probeHeight;
uniform vec2 probeGridMin;
uniform vec2 probeGridSize;
uniform float useProbeDepthAtlases;
uniform int probeVlmMode;

${PROBE_CUBEUV_SAMPLING_GLSL}

vec3 decodeRGBE8( vec4 rgbe ) {
  if ( rgbe.a <= 0.0 ) {
    return vec3( 0.0 );
  }

  float exponent = ( rgbe.a * 255.0 ) - 128.0;
  return rgbe.rgb * exp2( exponent );
}

float decodePackedDistance( vec4 packedDistance ) {
  return dot(
    packedDistance,
    vec4(
      1.0,
      1.0 / 255.0,
      1.0 / 65025.0,
      1.0 / 16581375.0
    )
  ) * ${REFLECTION_PROBE_FAR.toFixed(1)};
}

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

#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
vec3 sampleProbeBlendTexture(
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

  return decodeRGBE8(
    probeBlendTextureCubeUV(
      probeMap,
      envMapRotation * projectedDirection,
      roughness,
      texelWidth,
      texelHeight,
      maxMip
    )
  );
}
#endif

vec3 reconstructProbeIrradiance(
  vec3 direction,
  vec3 coeffL0,
  vec3 coeffL1,
  vec3 coeffL2,
  vec3 coeffL3
) {
  vec3 normalizedDirection = normalize( direction );
  float basisL0 = 0.282095;
  float basisL1 = 0.488603 * normalizedDirection.x;
  float basisL2 = 0.488603 * normalizedDirection.y;
  float basisL3 = 0.488603 * normalizedDirection.z;
  float bandKernelL0 = 3.141592653589793;
  float bandKernelL1 = 2.09439510239;

  return max(
    vec3( 0.0 ),
    ( coeffL0 * basisL0 * bandKernelL0 ) +
    ( coeffL1 * basisL1 * bandKernelL1 ) +
    ( coeffL2 * basisL2 * bandKernelL1 ) +
    ( coeffL3 * basisL3 * bandKernelL1 )
  ) * 12.566370614359172;
}

vec3 sampleProbeBlendDiffuse(
  vec3 direction,
  vec3 coeffL0,
  vec3 coeffL1,
  vec3 coeffL2,
  vec3 coeffL3
) {
  return reconstructProbeIrradiance(
    direction,
    coeffL0,
    coeffL1,
    coeffL2,
    coeffL3
  );
}

#if defined(PROBE_BLEND_ENABLE_VLM_TEXTURES)
vec2 clampProbeGridCell( vec2 cell ) {
  return clamp( cell, vec2( 0.0 ), max( probeGridSize - vec2( 1.0 ), vec2( 0.0 ) ) );
}

vec2 worldToProbeGridCell( vec2 worldXZ ) {
  return clampProbeGridCell(
    floor( ( worldXZ - probeGridMin ) / max( probeCellSize, 0.0001 ) )
  );
}

vec2 probeGridCellToWorld( vec2 cell ) {
  return probeGridMin + ( cell * probeCellSize );
}

vec2 probeGridCellToUv( vec2 cell ) {
  return ( clampProbeGridCell( cell ) + vec2( 0.5 ) ) / max( probeGridSize, vec2( 1.0 ) );
}

vec3 directionToProbeDepthAtlasFace( vec3 direction ) {
  vec3 absDirection = abs( direction );
  vec2 uv = vec2( 0.5 );
  float faceIndex = 0.0;

  if ( absDirection.x >= absDirection.y && absDirection.x >= absDirection.z ) {
    float invAxis = 0.5 / max( absDirection.x, 0.0001 );

    if ( direction.x >= 0.0 ) {
      faceIndex = 0.0;
      uv = vec2( -direction.z, -direction.y ) * invAxis + vec2( 0.5 );
    } else {
      faceIndex = 1.0;
      uv = vec2( direction.z, -direction.y ) * invAxis + vec2( 0.5 );
    }
  } else if ( absDirection.y >= absDirection.x && absDirection.y >= absDirection.z ) {
    float invAxis = 0.5 / max( absDirection.y, 0.0001 );

    if ( direction.y >= 0.0 ) {
      faceIndex = 2.0;
      uv = vec2( direction.x, direction.z ) * invAxis + vec2( 0.5 );
    } else {
      faceIndex = 3.0;
      uv = vec2( direction.x, -direction.z ) * invAxis + vec2( 0.5 );
    }
  } else {
    float invAxis = 0.5 / max( absDirection.z, 0.0001 );

    if ( direction.z >= 0.0 ) {
      faceIndex = 4.0;
      uv = vec2( direction.x, -direction.y ) * invAxis + vec2( 0.5 );
    } else {
      faceIndex = 5.0;
      uv = vec2( -direction.x, -direction.y ) * invAxis + vec2( 0.5 );
    }
  }

  return vec3( clamp( uv, 0.0, 1.0 ), faceIndex );
}

vec4 sampleProbeDepthAtlasFace( float faceIndex, vec2 uv ) {
  if ( faceIndex < 0.5 ) {
    return texture2D( localProbeDepthAtlasPx, uv );
  }
  if ( faceIndex < 1.5 ) {
    return texture2D( localProbeDepthAtlasNx, uv );
  }
  if ( faceIndex < 2.5 ) {
    return texture2D( localProbeDepthAtlasPy, uv );
  }
  if ( faceIndex < 3.5 ) {
    return texture2D( localProbeDepthAtlasNy, uv );
  }
  if ( faceIndex < 4.5 ) {
    return texture2D( localProbeDepthAtlasPz, uv );
  }

  return texture2D( localProbeDepthAtlasNz, uv );
}

float sampleProbeGridDepth( vec2 cell, vec3 direction ) {
  if ( useProbeDepthAtlases < 0.5 || probeDepthAtlasFaceSize < 0.5 ) {
    return ${REFLECTION_PROBE_FAR.toFixed(1)};
  }

  vec3 faceUv = directionToProbeDepthAtlasFace( normalize( direction ) );
  vec2 atlasSize = max( probeGridSize * probeDepthAtlasFaceSize, vec2( 1.0 ) );
  vec2 atlasPixel =
    ( clampProbeGridCell( cell ) * probeDepthAtlasFaceSize ) +
    ( faceUv.xy * max( probeDepthAtlasFaceSize - 1.0, 0.0 ) ) +
    vec2( 0.5 );
  vec2 atlasUv = atlasPixel / atlasSize;

  return decodePackedDistance( sampleProbeDepthAtlasFace( faceUv.z, atlasUv ) );
}

float sampleProbeGridVisibility( vec3 worldPosition, vec2 cell ) {
  if ( useProbeDepthAtlases < 0.5 ) {
    return 1.0;
  }

  vec2 clampedCell = clampProbeGridCell( cell );
  vec2 probeWorldXZ = probeGridCellToWorld( clampedCell );
  vec3 probePosition = vec3( probeWorldXZ.x, probeHeight, probeWorldXZ.y );
  vec3 toPoint = worldPosition - probePosition;
  float pointDistance = length( toPoint );

  if ( pointDistance <= 0.0001 ) {
    return 1.0;
  }

  float storedDistance = sampleProbeGridDepth( clampedCell, toPoint );
  float bias = 0.06;

  return 1.0 - smoothstep(
    storedDistance + bias,
    storedDistance + bias + 0.12,
    pointDistance
  );
}

vec4 sampleProbeGridCandidate(
  vec3 worldPosition,
  vec3 direction,
  vec2 cell
) {
  vec2 clampedCell = clampProbeGridCell( cell );
  vec2 uv = probeGridCellToUv( clampedCell );
  vec4 coeff0 = texture2D( localProbeCoeffTextureL0, uv );

  if ( coeff0.a <= 0.0 ) {
    return vec4( 0.0 );
  }

  float visibility = sampleProbeGridVisibility( worldPosition, clampedCell );

  if ( visibility <= 0.0001 ) {
    return vec4( 0.0 );
  }

  vec4 coeff1 = texture2D( localProbeCoeffTextureL1, uv );
  vec4 coeff2 = texture2D( localProbeCoeffTextureL2, uv );
  vec4 coeff3 = texture2D( localProbeCoeffTextureL3, uv );
  float weight = visibility;
  vec3 color = sampleProbeBlendDiffuse(
    direction,
    coeff0.rgb,
    coeff1.rgb,
    coeff2.rgb,
    coeff3.rgb
  );

  return vec4( color * weight, weight );
}

float probeGridKernelWeight( vec2 gridPosition, vec2 cell ) {
  vec2 distanceToCell = abs( gridPosition - cell );
  vec2 axisWeight = vec2(
    1.0 - smoothstep( 0.5, 1.5, distanceToCell.x ),
    1.0 - smoothstep( 0.5, 1.5, distanceToCell.y )
  );

  return axisWeight.x * axisWeight.y;
}

vec3 sampleProbeGridDiffuseCell5(
  vec3 worldPosition,
  vec3 direction
) {
  vec2 gridPosition = ( worldPosition.xz - probeGridMin ) / max( probeCellSize, 0.0001 );
  vec2 nearestCell = floor( gridPosition + vec2( 0.5 ) );
  vec4 accumulated = vec4( 0.0 );

  for ( int x = -1; x <= 1; x += 1 ) {
    for ( int y = -1; y <= 1; y += 1 ) {
      vec2 cell = nearestCell + vec2( float( x ), float( y ) );
      float spatialWeight = probeGridKernelWeight( gridPosition, cell );

      if ( spatialWeight <= 0.0001 ) {
        continue;
      }

      accumulated += sampleProbeGridCandidate( worldPosition, direction, cell ) * spatialWeight;
    }
  }
  vec3 color = accumulated.rgb;
  float weight = accumulated.a;

  if ( weight <= 0.0001 ) {
    return vec3( 0.0 );
  }

  return color / weight;
}

vec3 sampleProbeGridDiffuseBoundary8(
  vec3 worldPosition,
  vec3 direction
) {
  return sampleProbeGridDiffuseCell5( worldPosition, direction );
}
#endif

vec4 getProbeBlendVisibleWeights(
  vec4 baseWeights
) {
  float visibleWeightSum =
    baseWeights.x +
    baseWeights.y +
    baseWeights.z +
    baseWeights.w;

  if ( visibleWeightSum <= 0.0001 ) {
    return baseWeights;
  }

  return baseWeights / visibleWeightSum;
}

#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
vec3 sampleProbeBlendLocalRadiance(
  vec3 worldPosition,
  vec3 direction,
  float roughness,
  vec4 weights,
  float intensity
) {
  vec4 visibleWeights = getProbeBlendVisibleWeights( weights );
  vec3 color0 = sampleProbeBlendTexture(
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
  vec3 color1 = sampleProbeBlendTexture(
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
  vec3 color2 = sampleProbeBlendTexture(
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
  vec3 color3 = sampleProbeBlendTexture(
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

  return (
    ( color0 * visibleWeights.x ) +
    ( color1 * visibleWeights.y ) +
    ( color2 * visibleWeights.z ) +
    ( color3 * visibleWeights.w )
  ) * intensity;
}
#endif

vec3 sampleProbeBlendLocalDiffuse(
  vec3 worldPosition,
  vec3 direction,
  vec4 weights,
  float intensity
) {
  vec4 visibleWeights = getProbeBlendVisibleWeights( weights );
  vec3 color0 = sampleProbeBlendDiffuse(
    direction,
    localProbeCoeffL00,
    localProbeCoeffL10,
    localProbeCoeffL20,
    localProbeCoeffL30
  );
  vec3 color1 = sampleProbeBlendDiffuse(
    direction,
    localProbeCoeffL01,
    localProbeCoeffL11,
    localProbeCoeffL21,
    localProbeCoeffL31
  );
  vec3 color2 = sampleProbeBlendDiffuse(
    direction,
    localProbeCoeffL02,
    localProbeCoeffL12,
    localProbeCoeffL22,
    localProbeCoeffL32
  );
  vec3 color3 = sampleProbeBlendDiffuse(
    direction,
    localProbeCoeffL03,
    localProbeCoeffL13,
    localProbeCoeffL23,
    localProbeCoeffL33
  );

  return (
    ( color0 * visibleWeights.x ) +
    ( color1 * visibleWeights.y ) +
    ( color2 * visibleWeights.z ) +
    ( color3 * visibleWeights.w )
  ) * intensity;
}

vec4 probeBlendGetWorldWeights() {
  float tx = probeBlendRegion.z > 0.0
    ? clamp( ( vProbeBlendWorldPosition.x - probeBlendRegion.x ) / probeBlendRegion.z, 0.0, 1.0 )
    : 0.0;
  float tz = probeBlendRegion.w > 0.0
    ? clamp( ( vProbeBlendWorldPosition.z - probeBlendRegion.y ) / probeBlendRegion.w, 0.0, 1.0 )
    : 0.0;

  return vec4(
    ( 1.0 - tx ) * ( 1.0 - tz ),
    tx * ( 1.0 - tz ),
    ( 1.0 - tx ) * tz,
    tx * tz
  );
}

vec3 sampleProbeBlendRadianceWithMode(
  vec3 direction,
  float roughness,
  int mode,
  float intensity
) {
#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
  if ( mode == 1 ) {
    return sampleProbeBlendLocalRadiance(
      vProbeBlendWorldPosition,
      direction,
      roughness,
      probeBlendGetWorldWeights(),
      intensity
    );
  }

  if ( mode == 2 ) {
    return sampleProbeBlendLocalRadiance(
      vProbeBlendWorldPosition,
      direction,
      roughness,
      probeBlendWeights,
      intensity
    );
  }
#endif

  if ( mode == 3 ) {
    return vec3( 0.0 );
  }

  return vec3( 0.0 );
}

vec3 sampleProbeBlendDiffuseWithMode(
  vec3 direction,
  int mode,
  float intensity
) {
#if defined(PROBE_BLEND_ENABLE_VLM_TEXTURES)
  if ( probeVlmMode == 1 ) {
    return sampleProbeGridDiffuseCell5(
      vProbeBlendWorldPosition,
      direction
    ) * intensity;
  }

  if ( probeVlmMode == 2 ) {
    return sampleProbeGridDiffuseBoundary8(
      vProbeBlendWorldPosition,
      direction
    ) * intensity;
  }
#endif

  if ( mode == 1 ) {
    return sampleProbeBlendLocalDiffuse(
      vProbeBlendWorldPosition,
      direction,
      probeBlendGetWorldWeights(),
      intensity
    );
  }

  if ( mode == 2 ) {
    return sampleProbeBlendLocalDiffuse(
      vProbeBlendWorldPosition,
      direction,
      probeBlendWeights,
      intensity
    );
  }

  if ( mode == 3 ) {
    return vec3( 0.0 );
  }

  return vec3( 0.0 );
}

vec3 getIBLIrradiance( const in vec3 normal ) {

    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
    vec3 envMapColor = sampleProbeBlendDiffuseWithMode(
      worldNormal,
      probeBlendMode,
      probeBlendDiffuseIntensity
    );

    return PI * envMapColor;

}

vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

  #if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)

    vec3 reflectVec = reflect( - viewDir, normal );
    reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

    return sampleProbeBlendRadianceWithMode(
      reflectVec,
      roughness,
      probeBlendRadianceMode,
      probeBlendRadianceIntensity
    );

  #else

    return vec3( 0.0 );

  #endif

}

  #if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ANISOTROPY)

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
`

const LEVELSJAM_LIGHTS_FRAGMENT_MAPS = `
#if defined( RE_IndirectDiffuse )

\t#ifdef LEVELSJAM_RUNTIME_RADIANCE

\t\tvec3 runtimeRadianceWorldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
\t\tvec2 runtimeRadianceNormalOffsetDirection = runtimeRadianceWorldNormal.xz;
\t\tfloat runtimeRadianceNormalOffsetLength = length( runtimeRadianceNormalOffsetDirection );
\t\tvec2 runtimeRadianceSamplePosition = vProbeBlendWorldPosition.xz;

\t\tif ( runtimeRadianceNormalOffsetLength > 0.0001 ) {
\t\t\truntimeRadianceSamplePosition += (
\t\t\t\truntimeRadianceNormalOffsetDirection /
\t\t\t\truntimeRadianceNormalOffsetLength
\t\t\t) * runtimeRadianceNormalOffset;
\t\t}

\t\tvec2 runtimeRadianceUv = (
\t\t\truntimeRadianceSamplePosition - runtimeRadianceBounds.xy
\t\t) / max( runtimeRadianceBounds.zw, vec2( 0.0001 ) );

\t\tif (
\t\t\truntimeRadianceUv.x >= 0.0 &&
\t\t\truntimeRadianceUv.x <= 1.0 &&
\t\t\truntimeRadianceUv.y >= 0.0 &&
\t\t\truntimeRadianceUv.y <= 1.0
\t\t) {
\t\t\tirradiance += texture2D( runtimeRadianceTexture, runtimeRadianceUv ).rgb * runtimeRadianceIntensity;
\t\t}

\t#endif

\t#ifdef USE_LIGHTMAP

\t\tvec4 lightMapTexel = texture2D( lightMap, vLightMapUv );

\t\t#ifdef LEVELSJAM_LIGHTMAP_RGBE8
\t\t\tfloat lightMapExponent = lightMapTexel.a * 255.0 - 128.0;
\t\t\tvec3 lightMapColor = lightMapTexel.a <= 0.0
\t\t\t\t? vec3( 0.0 )
\t\t\t\t: lightMapTexel.rgb * exp2( lightMapExponent );
\t\t#else
\t\t\tvec3 lightMapColor = lightMapTexel.rgb;
\t\t#endif

\t\tvec3 lightMapIrradiance = lightMapColor * lightMapIntensity;

\t\tirradiance += lightMapIrradiance;

\t#endif

\t#if defined( STANDARD )

\t\tiblIrradiance += getIBLIrradiance( geometryNormal );

\t#endif

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

\t#ifdef USE_ANISOTROPY

\t\tradiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );

\t#else

\t\tradiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );

\t#endif

\t#ifdef USE_CLEARCOAT

\t\tclearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );

\t#endif

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
  if (shader.uniforms.runtimeRadianceTexture) {
    shader.uniforms.runtimeRadianceTexture.value = patchConfig.runtimeRadianceTexture ?? null
  }
  if (shader.uniforms.runtimeRadianceBounds) {
    const bounds = patchConfig.runtimeRadianceBounds

    shader.uniforms.runtimeRadianceBounds.value.set(
      bounds?.minX ?? 0,
      bounds?.minZ ?? 0,
      bounds?.width ?? 1,
      bounds?.depth ?? 1
    )
  }
  if (shader.uniforms.runtimeRadianceIntensity) {
    shader.uniforms.runtimeRadianceIntensity.value = patchConfig.runtimeRadianceIntensity ?? 0
  }
  if (shader.uniforms.runtimeRadianceNormalOffset) {
    shader.uniforms.runtimeRadianceNormalOffset.value = patchConfig.runtimeRadianceNormalOffset ?? 0
  }

  const probePositions = probeBlend.probePositions ?? []
  const probeBoxes = probeBlend.probeBoxes ?? []
  const probeCoefficients = probeBlend.probeCoefficients ?? []
  const probeDepthTextures = probeBlend.probeDepthTextures ?? []
  const probeTextureInfos = probeBlend.probeTextureInfos ?? []
  const defaultProbePosition = DEFAULT_PROBE_POSITION
  const defaultProbeBoxMin = DEFAULT_PROBE_BOX_MIN
  const defaultProbeBoxMax = DEFAULT_PROBE_BOX_MAX
  const defaultProbeTextureInfo = DEFAULT_PROBE_TEXTURE_INFO
  const defaultProbeCoefficients: ProbeIrradianceCoefficients = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ]
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
  const applyProbeCoefficientUniforms = (
    index: number,
    l0Uniform: Uniform<Vector3> | undefined,
    l1Uniform: Uniform<Vector3> | undefined,
    l2Uniform: Uniform<Vector3> | undefined,
    l3Uniform: Uniform<Vector3> | undefined
  ) => {
    const coefficients = probeCoefficients[index] ?? defaultProbeCoefficients

    l0Uniform?.value.set(...coefficients[0])
    l1Uniform?.value.set(...coefficients[1])
    l2Uniform?.value.set(...coefficients[2])
    l3Uniform?.value.set(...coefficients[3])
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
  if (shader.uniforms.localProbeDepthMap0) {
    shader.uniforms.localProbeDepthMap0.value = probeDepthTextures[0] ?? null
  }
  if (shader.uniforms.localProbeDepthMap1) {
    shader.uniforms.localProbeDepthMap1.value = probeDepthTextures[1] ?? null
  }
  if (shader.uniforms.localProbeDepthMap2) {
    shader.uniforms.localProbeDepthMap2.value = probeDepthTextures[2] ?? null
  }
  if (shader.uniforms.localProbeDepthMap3) {
    shader.uniforms.localProbeDepthMap3.value = probeDepthTextures[3] ?? null
  }
  applyProbeCoefficientUniforms(
    0,
    shader.uniforms.localProbeCoeffL00,
    shader.uniforms.localProbeCoeffL10,
    shader.uniforms.localProbeCoeffL20,
    shader.uniforms.localProbeCoeffL30
  )
  applyProbeCoefficientUniforms(
    1,
    shader.uniforms.localProbeCoeffL01,
    shader.uniforms.localProbeCoeffL11,
    shader.uniforms.localProbeCoeffL21,
    shader.uniforms.localProbeCoeffL31
  )
  applyProbeCoefficientUniforms(
    2,
    shader.uniforms.localProbeCoeffL02,
    shader.uniforms.localProbeCoeffL12,
    shader.uniforms.localProbeCoeffL22,
    shader.uniforms.localProbeCoeffL32
  )
  applyProbeCoefficientUniforms(
    3,
    shader.uniforms.localProbeCoeffL03,
    shader.uniforms.localProbeCoeffL13,
    shader.uniforms.localProbeCoeffL23,
    shader.uniforms.localProbeCoeffL33
  )
  if (shader.uniforms.localProbeCoeffTextureL0) {
    shader.uniforms.localProbeCoeffTextureL0.value = probeBlend.probeCoeffTextureL0 ?? null
  }
  if (shader.uniforms.localProbeCoeffTextureL1) {
    shader.uniforms.localProbeCoeffTextureL1.value = probeBlend.probeCoeffTextureL1 ?? null
  }
  if (shader.uniforms.localProbeCoeffTextureL2) {
    shader.uniforms.localProbeCoeffTextureL2.value = probeBlend.probeCoeffTextureL2 ?? null
  }
  if (shader.uniforms.localProbeCoeffTextureL3) {
    shader.uniforms.localProbeCoeffTextureL3.value = probeBlend.probeCoeffTextureL3 ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasPx) {
    shader.uniforms.localProbeDepthAtlasPx.value = probeBlend.probeDepthAtlasTextures?.[0] ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasNx) {
    shader.uniforms.localProbeDepthAtlasNx.value = probeBlend.probeDepthAtlasTextures?.[1] ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasPy) {
    shader.uniforms.localProbeDepthAtlasPy.value = probeBlend.probeDepthAtlasTextures?.[2] ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasNy) {
    shader.uniforms.localProbeDepthAtlasNy.value = probeBlend.probeDepthAtlasTextures?.[3] ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasPz) {
    shader.uniforms.localProbeDepthAtlasPz.value = probeBlend.probeDepthAtlasTextures?.[4] ?? null
  }
  if (shader.uniforms.localProbeDepthAtlasNz) {
    shader.uniforms.localProbeDepthAtlasNz.value = probeBlend.probeDepthAtlasTextures?.[5] ?? null
  }
  if (shader.uniforms.probeCellSize) {
    shader.uniforms.probeCellSize.value = probeBlend.probeCellSize ?? MAZE_CELL_SIZE
  }
  if (shader.uniforms.probeDepthAtlasFaceSize) {
    const atlasImage = probeBlend.probeDepthAtlasTextures?.[0]?.image as {
      width?: number
    } | undefined
    shader.uniforms.probeDepthAtlasFaceSize.value =
      (atlasImage?.width ?? 0) / Math.max(probeBlend.probeGridSize?.x ?? 1, 1)
  }
  if (shader.uniforms.probeHeight) {
    shader.uniforms.probeHeight.value = probeBlend.probeHeight ?? 1.25
  }
  shader.uniforms.probeGridMin?.value.set(
    probeBlend.probeGridMin?.x ?? 0,
    probeBlend.probeGridMin?.z ?? 0
  )
  shader.uniforms.probeGridSize?.value.set(
    probeBlend.probeGridSize?.x ?? 1,
    probeBlend.probeGridSize?.y ?? 1
  )
  shader.uniforms.probeBoundaryNormal?.value.set(
    probeBlend.vlmBoundaryNormal?.x ?? 0,
    probeBlend.vlmBoundaryNormal?.z ?? 1
  )
  if (shader.uniforms.probeVlmMode) {
    shader.uniforms.probeVlmMode.value =
      probeBlend.vlmMode === 'cell5'
        ? 1
        : probeBlend.vlmMode === 'boundary8'
          ? 2
          : 0
  }
  if (shader.uniforms.useProbeDepthAtlases) {
    shader.uniforms.useProbeDepthAtlases.value =
      probeBlend.useProbeDepthAtlases !== false &&
      probeBlend.probeDepthAtlasTextures?.every(Boolean)
        ? 1
        : 0
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
  if (shader.uniforms.probeBlendDiffuseIntensity) {
    shader.uniforms.probeBlendDiffuseIntensity.value =
      probeBlend.diffuseIntensity ?? 1
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
  if (shader.uniforms.probeBlendRadianceIntensity) {
    shader.uniforms.probeBlendRadianceIntensity.value =
      probeBlend.radianceIntensity ?? 1
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
    lightMapEncoding: patchConfig.lightMapEncoding ?? 'linear',
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
    runtimeRadianceBounds: patchConfig.runtimeRadianceBounds
      ? [
          patchConfig.runtimeRadianceBounds.minX,
          patchConfig.runtimeRadianceBounds.minZ,
          patchConfig.runtimeRadianceBounds.width,
          patchConfig.runtimeRadianceBounds.depth
        ]
      : null,
    runtimeRadianceIntensity: patchConfig.runtimeRadianceIntensity ?? 0,
    runtimeRadianceNormalOffset: patchConfig.runtimeRadianceNormalOffset ?? 0,
    runtimeRadianceTextureUUID: patchConfig.runtimeRadianceTexture?.uuid ?? null,
    diffuseIntensity: probeBlend.diffuseIntensity ?? 1,
    mode: probeBlend.mode,
    probeCellSize: probeBlend.probeCellSize ?? MAZE_CELL_SIZE,
    probeBoxes: (probeBlend.probeBoxes ?? []).map((box) => box
      ? {
          max: [box.max.x, box.max.y, box.max.z],
          min: [box.min.x, box.min.y, box.min.z]
        }
      : null),
    probeCoeffTextureUUIDs: [
      probeBlend.probeCoeffTextureL0?.uuid ?? null,
      probeBlend.probeCoeffTextureL1?.uuid ?? null,
      probeBlend.probeCoeffTextureL2?.uuid ?? null,
      probeBlend.probeCoeffTextureL3?.uuid ?? null
    ],
    probeDepthAtlasTextureUUIDs: (probeBlend.probeDepthAtlasTextures ?? []).map(
      (texture) => texture?.uuid ?? null
    ),
    useProbeDepthAtlases: probeBlend.useProbeDepthAtlases !== false,
    probeGridMin: probeBlend.probeGridMin
      ? [probeBlend.probeGridMin.x, probeBlend.probeGridMin.z]
      : null,
    probeGridSize: probeBlend.probeGridSize
      ? [probeBlend.probeGridSize.x, probeBlend.probeGridSize.y]
      : null,
    probeHeight: probeBlend.probeHeight ?? null,
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
    radianceIntensity: probeBlend.radianceIntensity ?? 1,
    radianceMode: probeBlend.radianceMode ?? probeBlend.mode,
    region: probeBlend.region
      ? [
          probeBlend.region.minX,
          probeBlend.region.minZ,
          probeBlend.region.sizeX,
          probeBlend.region.sizeZ
        ]
      : null,
    vlmBoundaryNormal: probeBlend.vlmBoundaryNormal
      ? [probeBlend.vlmBoundaryNormal.x, probeBlend.vlmBoundaryNormal.z]
      : null,
    vlmMode: probeBlend.vlmMode ?? 'disabled',
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

function getProbeBlendProgramKey(
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig
) {
  const activeRadianceMode = probeBlend.radianceMode ?? probeBlend.mode
  const usesTintedLightMap =
    Boolean(patchConfig.lightMapAmbientTint) ||
    Boolean(patchConfig.lightMapTorchTint)
  const lightMapEncoding = patchConfig.lightMapEncoding ?? 'linear'
  const usesRuntimeRadiance = Boolean(patchConfig.runtimeRadianceTexture)

  return [
    'probe-blend-v5',
    usesTintedLightMap ? 'lightmap-tint' : 'plain',
    `lightmap-${lightMapEncoding}`,
    usesRuntimeRadiance ? 'runtime-radiance' : 'no-runtime-radiance',
    probeBlend.mode,
    activeRadianceMode,
    probeBlend.vlmMode ?? 'disabled'
  ].join('-')
}

function updateProbeBlendMaterialDebugState(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig = {}
) {
  if (!material) {
    return
  }

  material.userData.probeBlendDebug = {
    diffuseIntensity: probeBlend.diffuseIntensity ?? 1,
    mode: probeBlend.mode,
    probeDepthAtlasCount: (probeBlend.probeDepthAtlasTextures ?? []).filter(Boolean).length,
    radianceIntensity: probeBlend.radianceIntensity ?? 1,
    radianceMode: probeBlend.radianceMode ?? probeBlend.mode,
    runtimeRadianceBounds: patchConfig.runtimeRadianceBounds
      ? [
          patchConfig.runtimeRadianceBounds.minX,
          patchConfig.runtimeRadianceBounds.minZ,
          patchConfig.runtimeRadianceBounds.width,
          patchConfig.runtimeRadianceBounds.depth
        ]
      : null,
    runtimeRadianceIntensity: patchConfig.runtimeRadianceIntensity ?? 0,
    runtimeRadianceNormalOffset: patchConfig.runtimeRadianceNormalOffset ?? 0,
    runtimeRadianceTextureUUID: patchConfig.runtimeRadianceTexture?.uuid ?? null,
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
    probeBlendDiffuseIntensity: shader.uniforms.probeBlendDiffuseIntensity?.value ?? null,
    probeVlmMode: shader.uniforms.probeVlmMode?.value ?? null,
    probeBlendRadianceMode: shader.uniforms.probeBlendRadianceMode?.value ?? null,
    probeBlendRadianceIntensity: shader.uniforms.probeBlendRadianceIntensity?.value ?? null,
    runtimeRadianceBounds: shader.uniforms.runtimeRadianceBounds
      ? [
          shader.uniforms.runtimeRadianceBounds.value.x,
          shader.uniforms.runtimeRadianceBounds.value.y,
          shader.uniforms.runtimeRadianceBounds.value.z,
          shader.uniforms.runtimeRadianceBounds.value.w
        ]
      : null,
    runtimeRadianceIntensity: shader.uniforms.runtimeRadianceIntensity?.value ?? null,
    runtimeRadianceNormalOffset: shader.uniforms.runtimeRadianceNormalOffset?.value ?? null,
    runtimeRadianceTextureUUID: shader.uniforms.runtimeRadianceTexture?.value?.uuid ?? null
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
  const activeRadianceMode = currentProbeBlend.radianceMode ?? currentProbeBlend.mode
  const usesLocalRadiance =
    activeRadianceMode === 'world' ||
    activeRadianceMode === 'constant'
  const usesVlmTextures = currentProbeBlend.vlmMode !== undefined &&
    currentProbeBlend.vlmMode !== 'disabled'
  const shaderFeatureDefines = usesLocalRadiance
    ? '#define PROBE_BLEND_ENABLE_LOCAL_RADIANCE 1\n'
    : ''
  const vlmFeatureDefines = usesVlmTextures
    ? '#define PROBE_BLEND_ENABLE_VLM_TEXTURES 1\n'
    : ''
  const lightMapFeatureDefines =
    currentPatchConfig.lightMapEncoding === 'rgbe8'
      ? '#define LEVELSJAM_LIGHTMAP_RGBE8 1\n'
      : ''

  probeBlendShader.uniforms.lightMapAmbientTint = new Uniform(BLACK_COLOR.clone())
  probeBlendShader.uniforms.lightMapTorchTint = new Uniform(WHITE_COLOR.clone())
  probeBlendShader.uniforms.runtimeRadianceBounds = new Uniform(new Vector4(0, 0, 1, 1))
  probeBlendShader.uniforms.runtimeRadianceIntensity = new Uniform(0)
  probeBlendShader.uniforms.runtimeRadianceNormalOffset = new Uniform(0)
  probeBlendShader.uniforms.runtimeRadianceTexture = new Uniform<Texture | null>(null)
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
  probeBlendShader.uniforms.localProbeDepthMap0 = new Uniform<CubeTexture | null>(null)
  probeBlendShader.uniforms.localProbeDepthMap1 = new Uniform<CubeTexture | null>(null)
  probeBlendShader.uniforms.localProbeDepthMap2 = new Uniform<CubeTexture | null>(null)
  probeBlendShader.uniforms.localProbeDepthMap3 = new Uniform<CubeTexture | null>(null)
  probeBlendShader.uniforms.localProbeMaxMip0 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip1 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip2 = new Uniform(0)
  probeBlendShader.uniforms.localProbeMaxMip3 = new Uniform(0)
  probeBlendShader.uniforms.localProbeCoeffL00 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL01 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL02 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL03 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL10 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL11 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL12 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL13 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL20 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL21 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL22 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL23 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL30 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL31 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL32 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffL33 = new Uniform(new Vector3())
  probeBlendShader.uniforms.localProbeCoeffTextureL0 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeCoeffTextureL1 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeCoeffTextureL2 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeCoeffTextureL3 = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasPx = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasNx = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasPy = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasNy = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasPz = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.localProbeDepthAtlasNz = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.probeBlendMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendDiffuseIntensity = new Uniform(1)
  probeBlendShader.uniforms.probeBoundaryNormal = new Uniform(new Vector2(0, 1))
  probeBlendShader.uniforms.probeCellSize = new Uniform(MAZE_CELL_SIZE)
  probeBlendShader.uniforms.probeDepthAtlasFaceSize = new Uniform(0)
  probeBlendShader.uniforms.probeHeight = new Uniform(1.25)
  probeBlendShader.uniforms.probeGridMin = new Uniform(new Vector2(0, 0))
  probeBlendShader.uniforms.probeGridSize = new Uniform(new Vector2(1, 1))
  probeBlendShader.uniforms.probeBlendRadianceMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendRadianceIntensity = new Uniform(1)
  probeBlendShader.uniforms.probeBlendWeights = new Uniform(new Vector4(1, 0, 0, 0))
  probeBlendShader.uniforms.probeBlendRegion = new Uniform(new Vector4(0, 0, 0, 0))
  probeBlendShader.uniforms.useProbeDepthAtlases = new Uniform(0)
  probeBlendShader.uniforms.probeVlmMode = new Uniform(0)
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
    `${shaderFeatureDefines}${vlmFeatureDefines}${lightMapFeatureDefines}${currentPatchConfig.runtimeRadianceTexture ? '#define LEVELSJAM_RUNTIME_RADIANCE 1\n' : ''}uniform vec3 lightMapAmbientTint;\nuniform vec3 lightMapTorchTint;\nuniform sampler2D runtimeRadianceTexture;\nuniform vec4 runtimeRadianceBounds;\nuniform float runtimeRadianceIntensity;\nuniform float runtimeRadianceNormalOffset;\nuniform float probeBlendDiffuseIntensity;\nuniform float probeBlendRadianceIntensity;\nvarying vec3 vProbeBlendWorldPosition;\n${probeBlendShader.fragmentShader}`
      .replace(
        '#include <envmap_physical_pars_fragment>',
        PROBE_BLEND_SHADER_CHUNK
      )
      .replace(
        '#include <lights_fragment_maps>',
        LEVELSJAM_LIGHTS_FRAGMENT_MAPS
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

function hasCompleteProbeDepthTextures(textures: Array<CubeTexture | null | undefined>) {
  return textures.length > 0 && textures.every(Boolean)
}

function hasCompleteProbeCoefficients(
  coefficients: Array<ProbeIrradianceCoefficients | null | undefined>
) {
  return coefficients.length > 0 && coefficients.every(Boolean)
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

function normalizeHexColor(
  value: string,
  fallback = DEFAULT_VOLUMETRIC_AMBIENT_HEX
) {
  const trimmed = value.trim()
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`

  return /^#[0-9a-fA-F]{6}$/.test(prefixed)
    ? prefixed.toLowerCase()
    : fallback
}

function colorFromHex(
  value: string,
  fallback = DEFAULT_VOLUMETRIC_AMBIENT_HEX
) {
  return new Color(normalizeHexColor(value, fallback))
}

function getMazeCellWorldPosition(
  maze: MazeLayout['maze'],
  cell: { x: number; y: number },
  y = GROUND_Y
) {
  return new Vector3(
    -((maze.width * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.x * MAZE_CELL_SIZE),
    y,
    -((maze.height * MAZE_CELL_SIZE) / 2) + (MAZE_CELL_SIZE / 2) + (cell.y * MAZE_CELL_SIZE)
  )
}

function directionToYaw(direction: CardinalDirection) {
  switch (direction) {
    case 'east':
      return -Math.PI / 2
    case 'south':
      return Math.PI
    case 'west':
      return Math.PI / 2
    default:
      return 0
  }
}

function directionToWorldOffset(direction: CardinalDirection) {
  switch (direction) {
    case 'east':
      return { x: MAZE_CELL_SIZE, z: 0 }
    case 'south':
      return { x: 0, z: MAZE_CELL_SIZE }
    case 'west':
      return { x: -MAZE_CELL_SIZE, z: 0 }
    default:
      return { x: 0, z: -MAZE_CELL_SIZE }
  }
}

function yawTowardWorldPosition(from: Vector3, to: Vector3) {
  const deltaX = to.x - from.x
  const deltaZ = to.z - from.z

  if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaZ) < 0.0001) {
    return 0
  }

  return Math.atan2(-deltaX, -deltaZ)
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

let dummyProbeEnvMapTexture: Texture | null = null

function getDummyProbeEnvMapTexture() {
  if (dummyProbeEnvMapTexture) {
    return dummyProbeEnvMapTexture
  }

  const cubeSize = 16
  const texture = new DataTexture(
    new Uint8Array(cubeSize * 3 * cubeSize * 4 * 4),
    cubeSize * 3,
    cubeSize * 4,
    RGBAFormat,
    UnsignedByteType
  )

  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.mapping = CubeUVReflectionMapping
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  dummyProbeEnvMapTexture = texture
  return texture
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

function useProbeCoefficientTextures(
  layout: MazeLayout,
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
) {
  const textures = useMemo(() => {
    const coefficientArrays = Array.from(
      { length: 4 },
      () => new Float32Array(layout.maze.width * layout.maze.height * 4)
    )

    for (let probeIndex = 0; probeIndex < reflectionProbeCoefficients.length; probeIndex += 1) {
      const coefficients = reflectionProbeCoefficients[probeIndex]
      const pixelOffset = probeIndex * 4

      if (!coefficients) {
        continue
      }

      for (let bandIndex = 0; bandIndex < 4; bandIndex += 1) {
        const target = coefficientArrays[bandIndex]
        const coefficient = coefficients[bandIndex] ?? [0, 0, 0]

        target[pixelOffset] = coefficient[0]
        target[pixelOffset + 1] = coefficient[1]
        target[pixelOffset + 2] = coefficient[2]
        target[pixelOffset + 3] = 1
      }
    }

    return coefficientArrays.map((data) => {
      const texture = new DataTexture(
        data,
        layout.maze.width,
        layout.maze.height,
        RGBAFormat,
        FloatType
      )

      texture.colorSpace = NoColorSpace
      texture.flipY = false
      texture.generateMipmaps = false
      texture.magFilter = NearestFilter
      texture.minFilter = NearestFilter
      texture.wrapS = ClampToEdgeWrapping
      texture.wrapT = ClampToEdgeWrapping
      texture.needsUpdate = true
      return texture
    })
  }, [layout.maze.height, layout.maze.width, reflectionProbeCoefficients])

  useEffect(
    () => () => {
      for (const texture of textures) {
        texture.dispose()
      }
    },
    [textures]
  )

  return textures
}

function getDepthFaceImage(
  texture: CubeTexture | null | undefined,
  faceIndex: number
) {
  const images = texture?.image as
    | Array<
      | ImageBitmap
      | HTMLImageElement
      | HTMLCanvasElement
      | OffscreenCanvas
      | ImageData
      | null
      | undefined
    >
    | undefined

  return Array.isArray(images) ? images[faceIndex] ?? null : null
}

function readProbeDepthFacePixels(
  image:
    | ImageBitmap
    | HTMLImageElement
    | HTMLCanvasElement
    | OffscreenCanvas
    | ImageData
    | null
    | undefined
) {
  if (!image) {
    return null
  }

  if (typeof ImageData !== 'undefined' && image instanceof ImageData) {
    return {
      data: new Uint8ClampedArray(image.data),
      height: image.height,
      width: image.width
    }
  }

  const width =
    'width' in image && typeof image.width === 'number'
      ? image.width
      : 0
  const height =
    'height' in image && typeof image.height === 'number'
      ? image.height
      : 0

  if (width <= 0 || height <= 0) {
    return null
  }

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', {
    willReadFrequently: true
  })

  if (!context) {
    return null
  }

  context.clearRect(0, 0, width, height)
  context.drawImage(image as CanvasImageSource, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)

  return {
    data: imageData.data,
    height,
    width
  }
}

function useProbeDepthAtlasTextures(
  layout: MazeLayout,
  reflectionProbeDepthTextures: CubeTexture[]
) {
  const textures = useMemo(() => {
    let faceSize = 0

    for (const texture of reflectionProbeDepthTextures) {
      const faceImage = getDepthFaceImage(texture, 0)
      const width =
        faceImage && 'width' in faceImage && typeof faceImage.width === 'number'
          ? faceImage.width
          : 0

      if (width > 0) {
        faceSize = width
        break
      }
    }

    if (faceSize <= 0) {
      return [null, null, null, null, null, null] as ProbeDepthAtlasTextures
    }

    const atlasWidth = layout.maze.width * faceSize
    const atlasHeight = layout.maze.height * faceSize
    const faceAtlases = Array.from(
      { length: 6 },
      () => new Uint8Array(atlasWidth * atlasHeight * 4)
    )

    for (let probeIndex = 0; probeIndex < reflectionProbeDepthTextures.length; probeIndex += 1) {
      const atlasCellX = probeIndex % layout.maze.width
      const atlasCellY = Math.floor(probeIndex / layout.maze.width)

      if (atlasCellY >= layout.maze.height) {
        break
      }

      const texture = reflectionProbeDepthTextures[probeIndex]

      for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
        const facePixels = readProbeDepthFacePixels(
          getDepthFaceImage(texture, faceIndex)
        )

        if (!facePixels) {
          continue
        }

        const copyWidth = Math.min(faceSize, facePixels.width)
        const copyHeight = Math.min(faceSize, facePixels.height)
        const atlas = faceAtlases[faceIndex]

        for (let row = 0; row < copyHeight; row += 1) {
          const sourceOffset = row * facePixels.width * 4
          const targetOffset =
            ((((atlasCellY * faceSize) + row) * atlasWidth) + (atlasCellX * faceSize)) * 4

          atlas.set(
            facePixels.data.subarray(sourceOffset, sourceOffset + (copyWidth * 4)),
            targetOffset
          )
        }
      }
    }

    return faceAtlases.map((data) => {
      const texture = new DataTexture(
        data,
        atlasWidth,
        atlasHeight,
        RGBAFormat,
        UnsignedByteType
      )

      texture.colorSpace = NoColorSpace
      texture.flipY = false
      texture.generateMipmaps = false
      texture.magFilter = NearestFilter
      texture.minFilter = NearestFilter
      texture.wrapS = ClampToEdgeWrapping
      texture.wrapT = ClampToEdgeWrapping
      texture.needsUpdate = true

      return texture
    }) as ProbeDepthAtlasTextures
  }, [layout.maze.height, layout.maze.width, reflectionProbeDepthTextures])

  useEffect(
    () => () => {
      for (const texture of textures) {
        texture?.dispose()
      }
    },
    [textures]
  )

  return textures
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

function loadRuntimeProbeCubeUvTexture(url: string) {
  return new Promise<Texture>((resolve, reject) => {
    void fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load reflection probe texture ${url}: ${response.status}`)
        }

        const blob = await response.blob()
        return createImageBitmap(blob, {
          colorSpaceConversion: 'none',
          imageOrientation: 'flipY',
          premultiplyAlpha: 'none'
        })
      })
      .then((imageBitmap) => {
        const texture = new Texture(imageBitmap)

        texture.colorSpace = NoColorSpace
        texture.flipY = false
        texture.generateMipmaps = false
        texture.magFilter = LinearFilter
        texture.mapping = CubeUVReflectionMapping
        texture.minFilter = LinearFilter
        texture.premultiplyAlpha = false
        texture.needsUpdate = true
        resolve(texture)
      })
      .catch(reject)
  })
}

function loadRuntimeProbeDepthCubeTexture(urls: string[]) {
  const loader = new CubeTextureLoader()

  return new Promise<CubeTexture>((resolve, reject) => {
    loader.load(
      urls,
      (texture) => {
        texture.colorSpace = NoColorSpace
        texture.generateMipmaps = false
        texture.magFilter = LinearFilter
        texture.minFilter = LinearFilter
        texture.needsUpdate = true
        resolve(texture)
      },
      undefined,
      reject
    )
  })
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
  probeDepthTextures: Array<CubeTexture | null>,
  probeDepthAtlasTextures: ProbeDepthAtlasTextures,
  probeCoefficients: Array<ProbeIrradianceCoefficients | null>,
  mode: ProbeBlendMode,
  options: {
    diffuseIntensity?: number
    probeCoefficientTextures?: [Texture, Texture, Texture, Texture]
    radianceIntensity?: number
    radianceMode?: ProbeBlendMode
    region?: {
      minX: number
      minZ: number
      sizeX: number
      sizeZ: number
    }
    vlmBoundaryNormal?: {
      x: number
      z: number
    }
    vlmMode?: ProbeVlmMode
    weights?: [number, number, number, number]
    useProbeDepthAtlases?: boolean
  } = {}
) {
  return {
    diffuseIntensity: options.diffuseIntensity ?? 1,
    mode,
    probeCellSize: MAZE_CELL_SIZE,
    probeCoeffTextureL0: null,
    probeCoeffTextureL1: null,
    probeCoeffTextureL2: null,
    probeCoeffTextureL3: null,
    probeDepthAtlasTextures: EMPTY_PROBE_DEPTH_ATLAS_TEXTURES,
    radianceIntensity: options.radianceIntensity ?? 1,
    radianceMode: options.radianceMode ?? mode,
    probeHeight: layout.reflectionProbes[0]?.position.y ?? 1.25,
    probeBoxes: probeIndices.map((probeIndex) =>
      getProbeVolumeBounds(layout.reflectionProbes[probeIndex]?.position)
    ),
    probeCoefficients: [],
    probeDepthTextures,
    probeGridMin: {
      x: layout.reflectionProbes[0]?.position.x ?? 0,
      z: layout.reflectionProbes[0]?.position.z ?? 0
    },
    probeGridSize: {
      x: layout.maze.width,
      y: layout.maze.height
    },
    probePositions: probeIndices.map(
      (probeIndex) => layout.reflectionProbes[probeIndex]?.position ?? null
    ),
    probeTextureInfos: probeTextures.map((texture) => getCubeUvTextureInfo(texture)),
    probeTextures,
    region: options.region,
    useProbeDepthAtlases: false,
    vlmBoundaryNormal: undefined,
    vlmMode: 'disabled',
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
  const probeBlendUpdateKeyRef = useRef(getProbeBlendUpdateKey(probeBlend, patchConfig))
  const appliedProbeBlendUpdateKeyRef = useRef<string | null>(null)

  materialRef.current = material
  probeBlendRef.current = probeBlend
  patchConfigRef.current = patchConfig
  probeBlendUpdateKeyRef.current = getProbeBlendUpdateKey(probeBlend, patchConfig)

  const customProgramCacheKey = useMemo(
    () => () => {
      return getProbeBlendProgramKey(probeBlendRef.current, patchConfigRef.current)
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

      if (appliedProbeBlendUpdateKeyRef.current === probeBlendUpdateKeyRef.current) {
        return
      }

      updateProbeBlendMaterialDebugState(
        currentMaterial,
        probeBlendRef.current,
        patchConfigRef.current
      )
      updateProbeBlendShaderUniforms(shaderRef.current, probeBlendRef.current, patchConfigRef.current)
      updateProbeBlendUniformDebugState(currentMaterial, shaderRef.current)
      appliedProbeBlendUpdateKeyRef.current = probeBlendUpdateKeyRef.current
    },
    []
  )

  useEffect(() => {
    shaderRef.current = null
    appliedProbeBlendUpdateKeyRef.current = null
  }, [materialKey])

  useEffect(() => {
    updateProbeBlendMaterialDebugState(material, probeBlend, patchConfig)
    updateProbeBlendShaderUniforms(shaderRef.current, probeBlend, patchConfig)
    updateProbeBlendUniformDebugState(material, shaderRef.current)
    appliedProbeBlendUpdateKeyRef.current = probeBlendUpdateKeyRef.current
  }, [material, materialKey, patchConfig, probeBlend])

  return {
    customProgramCacheKey,
    onBeforeCompile,
    onBeforeRender
  }
}

function attachProbeBlendMaterialShader(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig = {},
  shaderRef: { current: ProbeBlendShader | null }
) {
  const materialRef = { current: material }
  const probeBlendRef = { current: probeBlend }
  const patchConfigRef = { current: patchConfig }
  const probeBlendUpdateKeyRef = { current: getProbeBlendUpdateKey(probeBlend, patchConfig) }
  const probeBlendProgramKeyRef = { current: getProbeBlendProgramKey(probeBlend, patchConfig) }
  const appliedProbeBlendUpdateKeyRef = { current: null as string | null }

  const customProgramCacheKey = () =>
    getProbeBlendProgramKey(probeBlendRef.current, patchConfigRef.current)

  material.customProgramCacheKey = customProgramCacheKey
  material.onBeforeCompile = (shader: Shader) => {
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
  }
  material.onBeforeRender = () => {
    const currentMaterial = materialRef.current

    if (appliedProbeBlendUpdateKeyRef.current === probeBlendUpdateKeyRef.current) {
      return
    }

    updateProbeBlendMaterialDebugState(
      currentMaterial,
      probeBlendRef.current,
      patchConfigRef.current
    )
    updateProbeBlendShaderUniforms(
      shaderRef.current,
      probeBlendRef.current,
      patchConfigRef.current
    )
    updateProbeBlendUniformDebugState(currentMaterial, shaderRef.current)
    appliedProbeBlendUpdateKeyRef.current = probeBlendUpdateKeyRef.current
  }
  material.needsUpdate = true
  updateProbeBlendMaterialDebugState(material, probeBlend, patchConfig)
  updateProbeBlendShaderUniforms(shaderRef.current, probeBlend, patchConfig)
  updateProbeBlendUniformDebugState(material, shaderRef.current)
  appliedProbeBlendUpdateKeyRef.current = probeBlendUpdateKeyRef.current

  return {
    set(nextProbeBlend: ProbeBlendConfig, nextPatchConfig: MaterialShaderPatchConfig = patchConfig) {
      const previousProgramKey = probeBlendProgramKeyRef.current
      const nextProgramKey = getProbeBlendProgramKey(nextProbeBlend, nextPatchConfig)

      probeBlendRef.current = nextProbeBlend
      patchConfigRef.current = nextPatchConfig
      probeBlendUpdateKeyRef.current = getProbeBlendUpdateKey(nextProbeBlend, nextPatchConfig)
      probeBlendProgramKeyRef.current = nextProgramKey
      appliedProbeBlendUpdateKeyRef.current = null
      updateProbeBlendMaterialDebugState(
        materialRef.current,
        nextProbeBlend,
        nextPatchConfig
      )
      updateProbeBlendShaderUniforms(shaderRef.current, nextProbeBlend, nextPatchConfig)
      updateProbeBlendUniformDebugState(materialRef.current, shaderRef.current)
      appliedProbeBlendUpdateKeyRef.current = probeBlendUpdateKeyRef.current

      if (previousProgramKey !== nextProgramKey) {
        materialRef.current.needsUpdate = true
      }
    }
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
    PUDDLE_TEXTURE_URLS.gloss
  ]) as [Texture, Texture, Texture]
  const textures = useMemo(
    () => sourceTextures.map((texture) => texture.clone()) as [Texture, Texture, Texture],
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
        ['color', urls.color],
        ['metallic', urls.metallic],
        ['normal', urls.normal],
        ['orm', urls.orm],
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
    map: keyedTextures.color!,
    metalnessMap: keyedTextures.orm ?? keyedTextures.metallic,
    normalMap: keyedTextures.normal,
    roughnessMap: keyedTextures.orm ?? keyedTextures.roughness
  } satisfies PbrMaps
}

function useFireFlipbookTexture() {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    let cancelled = false
    let loadedTexture: Texture | null = null

    const configureTexture = (nextTexture: Texture) => {
      if (cancelled) {
        nextTexture.dispose()
        return
      }

      loadedTexture = nextTexture
      nextTexture.colorSpace = SRGBColorSpace
      nextTexture.wrapS = RepeatWrapping
      nextTexture.wrapT = RepeatWrapping
      nextTexture.repeat.set(
        FIRE_FLIPBOOK_CROP_WIDTH / FIRE_FLIPBOOK_GRID,
        FIRE_FLIPBOOK_CROP_HEIGHT / FIRE_FLIPBOOK_GRID
      )
      nextTexture.offset.set(
        FIRE_FLIPBOOK_FRAME_CROP.minX / FIRE_FLIPBOOK_GRID,
        1 -
          ((1 + FIRE_FLIPBOOK_FRAME_CROP.maxY) / FIRE_FLIPBOOK_GRID)
      )
      nextTexture.anisotropy = Math.min(maxAnisotropy, 8)
      nextTexture.needsUpdate = true
      setTexture(nextTexture)
    }

    const startLoading = () => {
      if (cancelled) {
        return
      }

      new TextureLoader().load(FIRE_FLIPBOOK_URL, configureTexture)
    }

    startLoading()

    return () => {
      cancelled = true
      loadedTexture?.dispose()
      setTexture(null)
    }
  }, [maxAnisotropy])

  return texture
}

function usesProbeBlendLocalRadiance(probeBlend: ProbeBlendConfig) {
  const radianceMode = probeBlend.radianceMode ?? probeBlend.mode

  return (
    (radianceMode === 'world' || radianceMode === 'constant') &&
    (probeBlend.radianceIntensity ?? 1) > EFFECT_EPSILON
  )
}

function getProbeBlendEnvMap(probeBlend: ProbeBlendConfig) {
  return usesProbeBlendLocalRadiance(probeBlend)
    ? getDummyProbeEnvMapTexture()
    : null
}

type RuntimePropModelKind = 'gate' | 'monster' | 'sword' | 'trophy'

function createLitCloneMaterial(
  sourceMaterial: Material,
  kind: RuntimePropModelKind
) {
  const side = kind === 'monster' ? FrontSide : sourceMaterial.side

  if (
    sourceMaterial instanceof ThreeMeshStandardMaterial ||
    sourceMaterial instanceof ThreeMeshPhysicalMaterial
  ) {
    const clonedMaterial = sourceMaterial.clone()
    clonedMaterial.aoMap = null
    clonedMaterial.bumpMap = null
    clonedMaterial.side = side
    return clonedMaterial
  }

  const basicMaterial = sourceMaterial as MeshBasicMaterial & {
    alphaMap?: Texture | null
    map?: Texture | null
    normalMap?: Texture | null
    opacity?: number
  }
  const metalness =
    kind === 'gate'
      ? 0.75
      : kind === 'sword'
        ? 0.9
        : kind === 'trophy'
          ? 0.15
          : 0.2
  const roughness =
    kind === 'gate'
      ? 0.45
      : kind === 'sword'
        ? 0.3
        : kind === 'trophy'
          ? 0.72
          : 0.8

  return new ThreeMeshStandardMaterial({
    alphaMap: basicMaterial.alphaMap ?? null,
    color: 'color' in basicMaterial && basicMaterial.color instanceof Color
      ? basicMaterial.color.clone()
      : WHITE_COLOR.clone(),
    map: basicMaterial.map ?? null,
    metalness,
    normalMap: basicMaterial.normalMap ?? null,
    opacity: basicMaterial.opacity ?? 1,
    roughness,
    side,
    transparent: basicMaterial.transparent
  })
}

function disposeCloneMaterials(root: Group) {
  const disposedMaterials = new Set<Material>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (material instanceof Material && !disposedMaterials.has(material)) {
        disposedMaterials.add(material)
        material.dispose()
      }
    }
  })
}

function useClonedRuntimeModel(
  modelUrl: string,
  kind: RuntimePropModelKind,
  debugRole: string,
  debugIndex: number
) {
  const [model, setModel] = useState<Group | null>(null)

  useEffect(() => {
    let cancelled = false
    let clonedRoot: Group | null = null

    void cloneCachedGltfRoot(modelUrl)
      .then((clone) => {
        if (cancelled) {
          disposeCloneMaterials(clone)
          return
        }

        const clonedMaterials = new Map<Material, Material>()
        const getClonedMaterial = (sourceMaterial: Material) => {
          const cachedMaterial = clonedMaterials.get(sourceMaterial)

          if (cachedMaterial) {
            return cachedMaterial
          }

          const nextMaterial = createLitCloneMaterial(sourceMaterial, kind)
          clonedMaterials.set(sourceMaterial, nextMaterial)
          return nextMaterial
        }

        clone.traverse((object) => {
          if (!(object instanceof Mesh)) {
            return
          }

          if (Array.isArray(object.material)) {
            object.material = object.material.map((material) =>
              material instanceof Material
                ? getClonedMaterial(material)
                : material
            )
          } else if (object.material instanceof Material) {
            object.material = getClonedMaterial(object.material)
          }

          object.castShadow = true
          object.receiveShadow = true
          object.userData.debugIndex = debugIndex
          object.userData.debugRole = debugRole
          object.userData.runtimeModelKind = kind
        })

        clonedRoot = clone
        setModel(clone)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error)
        }
      })

    return () => {
      cancelled = true
      if (clonedRoot) {
        disposeCloneMaterials(clonedRoot)
      }
      setModel(null)
    }
  }, [debugIndex, debugRole, kind, modelUrl])

  return model
}

function useAttachProbeBlendToModel(
  model: Group | null,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig = {}
) {
  useEffect(() => {
    if (!model) {
      return
    }

    model.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      materials.forEach((material) => {
        if (
          !(material instanceof ThreeMeshStandardMaterial) &&
          !(material instanceof ThreeMeshPhysicalMaterial)
        ) {
          return
        }

        material.envMap = getProbeBlendEnvMap(probeBlend)
        material.envMapIntensity = 0
        const attachment = material.userData.probeBlendAttachment as
          | {
            set: (
              nextProbeBlend: ProbeBlendConfig,
              nextPatchConfig?: MaterialShaderPatchConfig
            ) => void
          }
          | undefined

        if (attachment) {
          attachment.set(probeBlend, patchConfig)
        } else {
          material.userData.probeBlendAttachment = attachProbeBlendMaterialShader(
            material,
            probeBlend,
            patchConfig,
            { current: null }
          )
        }
      })
    })
  }, [model, patchConfig, probeBlend])
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
  const [bytes, setBytes] = useState<Uint8Array>(() =>
    typeof lightmap.dataBase64 === 'string' && lightmap.dataBase64.length > 0
      ? decodeBase64Bytes(lightmap.dataBase64)
      : new Uint8Array()
  )

  useEffect(
    () => {
      if (typeof lightmap.dataBase64 === 'string' && lightmap.dataBase64.length > 0) {
        setBytes(decodeBase64Bytes(lightmap.dataBase64))
        return
      }

      if (!lightmap.atlasUrl) {
        setBytes(new Uint8Array())
        return
      }

      let cancelled = false

      void fetch(resolveMazeDataUrl(lightmap.atlasUrl))
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load surface lightmap bytes: ${response.status}`)
          }

          return new Uint8Array(await response.arrayBuffer())
        })
        .then((nextBytes) => {
          if (!cancelled) {
            setBytes(nextBytes)
          }
        })
        .catch((error) => {
          console.error(error)
          if (!cancelled) {
            setBytes(new Uint8Array())
          }
        })

      return () => {
        cancelled = true
      }
    },
    [lightmap]
  )

  return bytes
}

function useGroundLightmapTexture(
  lightmap: MazeLightmap,
  lightmapBytes: Uint8Array
) {
  const texture = useMemo(
    () =>
      createLightmapFaceTexture(
        lightmapBytes,
        lightmap.atlasWidth,
        lightmap.groundRect,
        lightmap.encoding ?? 'rgbe8'
      ),
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

function getLightmapBytesPerPixel(encoding: MazeLightmap['encoding'] = 'rgb16f') {
  if (encoding === 'rgb16f') {
    return 6
  }

  if (encoding === 'rgbe8') {
    return 4
  }

  return 3
}

function hasLightmapRectData(
  data: Uint8Array,
  atlasWidth: number,
  rect: LightmapRect,
  encoding: MazeLightmap['encoding'] = 'rgb16f'
) {
  if (rect.width <= 0 || rect.height <= 0 || atlasWidth <= 0) {
    return false
  }

  const bytesPerPixel = getLightmapBytesPerPixel(encoding)
  const lastPixelIndex =
    (((rect.y + rect.height - 1) * atlasWidth) + rect.x + rect.width - 1)
  return data.byteLength >= ((lastPixelIndex + 1) * bytesPerPixel)
}

function hasLightmapAtlasData(
  data: Uint8Array,
  atlasWidth: number,
  atlasHeight: number,
  encoding: MazeLightmap['encoding'] = 'rgb16f'
) {
  return (
    atlasWidth > 0 &&
    atlasHeight > 0 &&
    data.byteLength >= atlasWidth * atlasHeight * getLightmapBytesPerPixel(encoding)
  )
}

function createBlackLightmapTexture(options: {
  encoding?: LightmapTextureEncoding
  flipY?: boolean
} = {}) {
  const encoding = options.encoding ?? 'linear'
  const texture =
    encoding === 'rgbe8'
      ? new DataTexture(
        new Uint8Array([0, 0, 0, 0]),
        1,
        1,
        RGBAFormat,
        UnsignedByteType
      )
      : new DataTexture(
        new Uint16Array([
          0,
          0,
          0,
          DataUtils.toHalfFloat(1)
        ]),
        1,
        1,
        RGBAFormat,
        HalfFloatType
      )
  texture.colorSpace = NoColorSpace
  texture.flipY = options.flipY ?? false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function createLightmapAtlasTexture(
  data: Uint8Array,
  atlasWidth: number,
  atlasHeight: number,
  encoding: MazeLightmap['encoding'] = 'rgb16f'
) {
  if (!hasLightmapAtlasData(data, atlasWidth, atlasHeight, encoding)) {
    return createBlackLightmapTexture()
  }

  const pixelCount = atlasWidth * atlasHeight
  const outputData = new Uint16Array(pixelCount * 4)
  const alphaHalfFloat = DataUtils.toHalfFloat(1)

  if (encoding === 'rgb16f') {
    const sourceData = new Uint16Array(
      data.buffer,
      data.byteOffset,
      Math.floor(data.byteLength / 2)
    )

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const sourceOffset = pixelIndex * 3
      const destinationOffset = pixelIndex * 4

      outputData[destinationOffset] = sourceData[sourceOffset] ?? 0
      outputData[destinationOffset + 1] = sourceData[sourceOffset + 1] ?? 0
      outputData[destinationOffset + 2] = sourceData[sourceOffset + 2] ?? 0
      outputData[destinationOffset + 3] = alphaHalfFloat
    }
  } else {
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const destinationOffset = pixelIndex * 4
      const decoded =
        encoding === 'rgbe8'
          ? decodeRgbE8(
            data[pixelIndex * 4],
            data[(pixelIndex * 4) + 1],
            data[(pixelIndex * 4) + 2],
            data[(pixelIndex * 4) + 3]
          )
          : [
            (data[pixelIndex * 3] ?? 0) / 255,
            (data[(pixelIndex * 3) + 1] ?? 0) / 255,
            (data[(pixelIndex * 3) + 2] ?? 0) / 255
          ]

      outputData[destinationOffset] = DataUtils.toHalfFloat(decoded[0] ?? 0)
      outputData[destinationOffset + 1] = DataUtils.toHalfFloat(decoded[1] ?? 0)
      outputData[destinationOffset + 2] = DataUtils.toHalfFloat(decoded[2] ?? 0)
      outputData[destinationOffset + 3] = alphaHalfFloat
    }
  }

  const texture = new DataTexture(
    outputData,
    atlasWidth,
    atlasHeight,
    RGBAFormat,
    HalfFloatType
  )
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function useMazeLightmapAtlasTexture(
  lightmap: MazeLightmap,
  lightmapBytes: Uint8Array
) {
  const texture = useMemo(
    () =>
      createLightmapAtlasTexture(
        lightmapBytes,
        lightmap.atlasWidth,
        lightmap.atlasHeight,
        lightmap.encoding ?? 'rgbe8'
      ),
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

function getRuntimeSurfaceLightmapAtlasUrl(lightmap: MazeLightmap) {
  if (!lightmap.atlasUrl) {
    return null
  }

  if (
    lightmap.encoding === 'rgb16f' &&
    lightmap.atlasUrl.endsWith('/surface-lightmap.bin')
  ) {
    return lightmap.atlasUrl.replace(/surface-lightmap\.bin$/, 'surface-lightmap-rgbe.png')
  }

  if (
    lightmap.encoding === 'rgb16f' &&
    lightmap.atlasUrl.endsWith('surface-lightmap.bin')
  ) {
    return lightmap.atlasUrl.replace(/surface-lightmap\.bin$/, 'surface-lightmap-rgbe.png')
  }

  return lightmap.atlasUrl
}

function getRuntimeSurfaceLightmapEncoding(lightmap: MazeLightmap) {
  const imageUrl = getRuntimeSurfaceLightmapAtlasUrl(lightmap)

  return imageUrl?.endsWith('surface-lightmap-rgbe.png') || lightmap.encoding === 'rgbe8'
    ? 'rgbe8'
    : 'linear'
}

function configureLightmapTexture(texture: Texture) {
  texture.channel = 1
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

type RuntimeRadianceOccluder = {
  maxX: number
  maxZ: number
  minX: number
  minZ: number
}

type RuntimeRadianceEmitter = {
  blue: number
  green: number
  id: string
  index: number
  offsets: number[]
  red: number
}

type RuntimeRadianceSceneTextureState = {
  data: Uint16Array
  emitterOffsets: number[]
  emitters: RuntimeRadianceEmitter[]
  occluderCount: number
  texture: DataTexture
}

function getRuntimeRadianceBounds(layout: MazeLayout): RuntimeRadianceBounds {
  const groundBounds = layout.maze.lightmap.groundBounds

  if (
    Number.isFinite(groundBounds.minX) &&
    Number.isFinite(groundBounds.minZ) &&
    groundBounds.width > 0 &&
    groundBounds.depth > 0
  ) {
    return {
      depth: groundBounds.depth,
      minX: groundBounds.minX,
      minZ: groundBounds.minZ,
      width: groundBounds.width
    }
  }

  const width = layout.maze.width * MAZE_CELL_SIZE
  const depth = layout.maze.height * MAZE_CELL_SIZE
  return {
    depth: depth + MAZE_CELL_SIZE * 2,
    minX: -(width / 2) - MAZE_CELL_SIZE,
    minZ: -(depth / 2) - MAZE_CELL_SIZE,
    width: width + MAZE_CELL_SIZE * 2
  }
}

function getRuntimeRadianceLightDirection(side: MazeLayout['lights'][number]['side']) {
  switch (side) {
    case 'east':
      return { x: 1, z: 0 }
    case 'south':
      return { x: 0, z: 1 }
    case 'west':
      return { x: -1, z: 0 }
    default:
      return { x: 0, z: -1 }
  }
}

function pointInRuntimeRadianceOccluder2D(
  x: number,
  z: number,
  occluder: RuntimeRadianceOccluder
) {
  return (
    x >= occluder.minX &&
    x <= occluder.maxX &&
    z >= occluder.minZ &&
    z <= occluder.maxZ
  )
}

function padRuntimeRadianceOccluder(
  occluder: RuntimeRadianceOccluder
): RuntimeRadianceOccluder {
  return {
    maxX: occluder.maxX + RUNTIME_RADIANCE_OCCLUDER_PADDING,
    maxZ: occluder.maxZ + RUNTIME_RADIANCE_OCCLUDER_PADDING,
    minX: occluder.minX - RUNTIME_RADIANCE_OCCLUDER_PADDING,
    minZ: occluder.minZ - RUNTIME_RADIANCE_OCCLUDER_PADDING
  }
}

function getRuntimeTorchFlicker(lightIndex: number, elapsed: number) {
  const seed = (lightIndex + 1) * 12.9898
  const fast = Math.sin((elapsed * 11.7) + seed)
  const medium = Math.sin((elapsed * 6.1) + (seed * 1.7))
  const slow = Math.sin((elapsed * 2.4) + (seed * 2.9))
  const mixed = (fast * 0.55) + (medium * 0.3) + (slow * 0.15)

  return MathUtils.clamp(
    1 + (mixed * RUNTIME_TORCH_FLICKER_INTENSITY),
    1 - (RUNTIME_TORCH_FLICKER_INTENSITY * 1.35),
    1 + (RUNTIME_TORCH_FLICKER_INTENSITY * 1.35)
  )
}

function updateRuntimeRadianceEmitterTexture(
  sceneTextureState: RuntimeRadianceSceneTextureState,
  elapsed: number
) {
  for (const offset of sceneTextureState.emitterOffsets) {
    sceneTextureState.data[offset] = 0
    sceneTextureState.data[offset + 1] = 0
    sceneTextureState.data[offset + 2] = 0
  }

  for (const emitter of sceneTextureState.emitters) {
    const flicker = getRuntimeTorchFlicker(emitter.index, elapsed)
    const red = DataUtils.toHalfFloat(emitter.red * flicker)
    const green = DataUtils.toHalfFloat(emitter.green * flicker)
    const blue = DataUtils.toHalfFloat(emitter.blue * flicker)

    for (const offset of emitter.offsets) {
      sceneTextureState.data[offset] = red
      sceneTextureState.data[offset + 1] = green
      sceneTextureState.data[offset + 2] = blue
    }
  }

  sceneTextureState.texture.needsUpdate = true
}

function buildRuntimeRadianceOccluders(
  layout: MazeLayout,
  openGateIds: Set<string>
) {
  const wallOccluders = layout.walls.map((wall) => padRuntimeRadianceOccluder({
    maxX: wall.bounds.maxX,
    maxZ: wall.bounds.maxZ,
    minX: wall.bounds.minX,
    minZ: wall.bounds.minZ
  }))
  const gateOccluders = layout.gates
    .filter((gate) => !openGateIds.has(gate.id))
    .map((gate) => {
      const halfLength = MAZE_CELL_SIZE / 2
      const halfWidth = WALL_WIDTH / 2

      if (gate.axis === 'x') {
        return padRuntimeRadianceOccluder({
          maxX: gate.center.x + halfLength,
          maxZ: gate.center.z + halfWidth,
          minX: gate.center.x - halfLength,
          minZ: gate.center.z - halfWidth
        })
      }

      return padRuntimeRadianceOccluder({
        maxX: gate.center.x + halfWidth,
        maxZ: gate.center.z + halfLength,
        minX: gate.center.x - halfWidth,
        minZ: gate.center.z - halfLength
      })
    })

  return [...wallOccluders, ...gateOccluders]
}

const runtimeRadianceFullscreenVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const runtimeRadianceCascadeFragmentShader = `
precision highp float;

uniform sampler2D sceneMap;
uniform sampler2D higherCascade;
uniform vec4 radianceBounds;
uniform vec2 sceneMapSize;
uniform vec2 cascadeTextureSize;
uniform float baseRayCount;
uniform float baseProbeCount;
uniform float cascadeIndex;
uniform float cascadeCount;
uniform float directGain;
uniform float indirectGain;

const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

vec2 worldToSceneUv(vec2 worldPosition) {
  return (worldPosition - radianceBounds.xy) / max(radianceBounds.zw, vec2(0.0001));
}

vec4 sampleSceneMap(vec2 worldPosition) {
  vec2 uv = worldToSceneUv(worldPosition);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }

  return texture2D(sceneMap, uv);
}

vec2 cascadeTexelUv(float probeGridSize, float rayCount, vec2 probeCell, float rayIndex) {
  float probeIndex =
    floor(probeCell.y) * probeGridSize +
    floor(probeCell.x);
  float texelIndex = probeIndex * rayCount + rayIndex;
  float texelX = mod(texelIndex, cascadeTextureSize.x);
  float texelY = floor(texelIndex / cascadeTextureSize.x);

  return (vec2(texelX, texelY) + vec2(0.5)) / cascadeTextureSize;
}

vec3 sampleHigherCascade(vec2 worldPosition, float angle) {
  if (cascadeIndex >= cascadeCount - 1.0) {
    return vec3(0.0);
  }

  float nextCascade = cascadeIndex + 1.0;
  float nextProbeGridSize = max(1.0, floor(baseProbeCount / exp2(nextCascade) + 0.5));
  float nextRayCount = baseRayCount * pow(4.0, nextCascade);
  vec2 nextGridPosition =
    worldToSceneUv(worldPosition) * nextProbeGridSize - vec2(0.5);
  vec2 baseCell = floor(nextGridPosition);
  vec2 cellFract = fract(nextGridPosition);
  float rayPosition = fract(angle / TWO_PI) * nextRayCount - 0.5;
  float baseRay = floor(rayPosition);
  float rayFract = fract(rayPosition);
  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;

  for (int yOffset = 0; yOffset <= 1; yOffset += 1) {
    for (int xOffset = 0; xOffset <= 1; xOffset += 1) {
      vec2 probeCell = clamp(
        baseCell + vec2(float(xOffset), float(yOffset)),
        vec2(0.0),
        vec2(nextProbeGridSize - 1.0)
      );
      float probeWeight =
        (xOffset == 0 ? 1.0 - cellFract.x : cellFract.x) *
        (yOffset == 0 ? 1.0 - cellFract.y : cellFract.y);
      vec2 probeWorld =
        radianceBounds.xy +
        ((probeCell + vec2(0.5)) / nextProbeGridSize) * radianceBounds.zw;
      probeWeight *= sampleSceneMap(probeWorld).a > 0.5 ? 0.0 : 1.0;

      if (probeWeight > 0.0) {
        for (int rayOffset = 0; rayOffset <= 1; rayOffset += 1) {
          float rayIndex = mod(baseRay + float(rayOffset) + nextRayCount, nextRayCount);
          float rayWeight = rayOffset == 0 ? 1.0 - rayFract : rayFract;
          float weight = probeWeight * rayWeight;

          sumColor += texture2D(
            higherCascade,
            cascadeTexelUv(nextProbeGridSize, nextRayCount, probeCell, rayIndex)
          ).rgb * weight;
          sumWeight += weight;
        }
      }
    }
  }

  return sumWeight > 0.0 ? sumColor / sumWeight : vec3(0.0);
}

void main() {
  float texelIndex =
    floor(gl_FragCoord.y) * cascadeTextureSize.x +
    floor(gl_FragCoord.x);
  float probeGridSize = max(1.0, floor(baseProbeCount / exp2(cascadeIndex) + 0.5));
  float rayCount = baseRayCount * pow(4.0, cascadeIndex);
  float rayIndex = mod(texelIndex, rayCount);
  float probeIndex = floor(texelIndex / rayCount);

  if (probeIndex >= probeGridSize * probeGridSize) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 probeCell = vec2(
    mod(probeIndex, probeGridSize),
    floor(probeIndex / probeGridSize)
  );
  vec2 probeUv = (probeCell + vec2(0.5)) / probeGridSize;
  vec2 probeWorld = radianceBounds.xy + probeUv * radianceBounds.zw;
  float angle = (rayIndex + 0.5) / rayCount * TWO_PI;
  vec2 rayDirection = vec2(cos(angle), sin(angle));
  float baseInterval = max(max(radianceBounds.z, radianceBounds.w) / baseProbeCount, 0.0001);
  float intervalLength = baseInterval * pow(4.0, cascadeIndex);
  float intervalStart =
    cascadeIndex <= 0.5
      ? 0.0
      : baseInterval * (pow(4.0, cascadeIndex) - 1.0) / 3.0;
  float intervalEnd = intervalStart + intervalLength;
  float stepLength = max(baseInterval * 0.35, intervalLength / 96.0);
  vec3 radiance = vec3(0.0);
  float transmittance = 1.0;

  for (int stepIndex = 0; stepIndex < 160; stepIndex += 1) {
    float distance = intervalStart + (float(stepIndex) + 0.5) * stepLength;

    if (distance >= intervalEnd) {
      break;
    }

    vec2 sampleWorld = probeWorld + rayDirection * distance;
    vec4 sceneSample = sampleSceneMap(sampleWorld);

    if (sceneSample.a > 0.5) {
      transmittance = 0.0;
      break;
    }

    if (max(max(sceneSample.r, sceneSample.g), sceneSample.b) > 0.0001) {
      float falloff = 1.0 / max(
        distance * distance + ${RUNTIME_RADIANCE_SOURCE_RADIUS.toFixed(6)} * ${RUNTIME_RADIANCE_SOURCE_RADIUS.toFixed(6)},
        0.0001
      );
      radiance += sceneSample.rgb * falloff * directGain * transmittance;
      transmittance = 0.0;
      break;
    }
  }

  if (transmittance > 0.0) {
    vec2 mergeWorld = probeWorld + rayDirection * intervalEnd;
    radiance += sampleHigherCascade(mergeWorld, angle) * indirectGain * transmittance;
  }

  gl_FragColor = vec4(max(radiance, vec3(0.0)), 1.0);
}
`

const runtimeRadianceResolveFragmentShader = `
precision highp float;

uniform sampler2D cascadeTexture;
uniform vec2 cascadeTextureSize;
uniform float baseRayCount;
uniform float baseProbeCount;
varying vec2 vUv;

vec2 cascadeTexelUv(float probeGridSize, float rayCount, vec2 probeCell, float rayIndex) {
  float probeIndex =
    floor(probeCell.y) * probeGridSize +
    floor(probeCell.x);
  float texelIndex = probeIndex * rayCount + rayIndex;
  float texelX = mod(texelIndex, cascadeTextureSize.x);
  float texelY = floor(texelIndex / cascadeTextureSize.x);

  return (vec2(texelX, texelY) + vec2(0.5)) / cascadeTextureSize;
}

vec3 sampleCascade0(vec2 uv, float rayIndex) {
  float probeGridSize = baseProbeCount;
  float rayCount = baseRayCount;
  vec2 gridPosition = uv * probeGridSize - vec2(0.5);
  vec2 baseCell = floor(gridPosition);
  vec2 cellFract = fract(gridPosition);
  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;

  for (int yOffset = 0; yOffset <= 1; yOffset += 1) {
    for (int xOffset = 0; xOffset <= 1; xOffset += 1) {
      vec2 probeCell = clamp(
        baseCell + vec2(float(xOffset), float(yOffset)),
        vec2(0.0),
        vec2(probeGridSize - 1.0)
      );
      float weight =
        (xOffset == 0 ? 1.0 - cellFract.x : cellFract.x) *
        (yOffset == 0 ? 1.0 - cellFract.y : cellFract.y);

      sumColor += texture2D(
        cascadeTexture,
        cascadeTexelUv(probeGridSize, rayCount, probeCell, rayIndex)
      ).rgb * weight;
      sumWeight += weight;
    }
  }

  return sumWeight > 0.0 ? sumColor / sumWeight : vec3(0.0);
}

void main() {
  vec3 irradiance = vec3(0.0);

  for (int rayIndex = 0; rayIndex < ${RUNTIME_RADIANCE_BASE_RAY_COUNT}; rayIndex += 1) {
    irradiance += sampleCascade0(vUv, float(rayIndex));
  }

  gl_FragColor = vec4(irradiance / ${RUNTIME_RADIANCE_BASE_RAY_COUNT.toFixed(1)}, 1.0);
}
`

function createRuntimeRadianceRenderTarget(
  width: number,
  height: number,
  filter: typeof LinearFilter | typeof NearestFilter
) {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    generateMipmaps: false,
    magFilter: filter,
    minFilter: filter,
    stencilBuffer: false,
    type: HalfFloatType,
    format: RGBAFormat
  })

  target.texture.colorSpace = NoColorSpace
  target.texture.wrapS = ClampToEdgeWrapping
  target.texture.wrapT = ClampToEdgeWrapping
  target.texture.generateMipmaps = false

  return target
}

function createRuntimeRadianceSceneTexture(
  layout: MazeLayout,
  openGateIds: Set<string>,
  bounds: RuntimeRadianceBounds
): RuntimeRadianceSceneTextureState {
  const resolution = RUNTIME_RADIANCE_RESOLUTION
  const data = new Uint16Array(resolution * resolution * 4)
  const occluders = buildRuntimeRadianceOccluders(layout, openGateIds)
  const emitterOffsetSet = new Set<number>()
  const emitters: RuntimeRadianceEmitter[] = []
  const xByColumn = new Float32Array(resolution)
  const zByRow = new Float32Array(resolution)
  const opaqueHalf = DataUtils.toHalfFloat(1)

  for (let column = 0; column < resolution; column += 1) {
    xByColumn[column] = bounds.minX + ((column + 0.5) / resolution) * bounds.width
  }
  for (let row = 0; row < resolution; row += 1) {
    zByRow[row] = bounds.minZ + ((row + 0.5) / resolution) * bounds.depth
  }

  for (const occluder of occluders) {
    const minColumn = MathUtils.clamp(
      Math.floor(((occluder.minX - bounds.minX) / bounds.width) * resolution),
      0,
      resolution - 1
    )
    const maxColumn = MathUtils.clamp(
      Math.ceil(((occluder.maxX - bounds.minX) / bounds.width) * resolution),
      0,
      resolution - 1
    )
    const minRow = MathUtils.clamp(
      Math.floor(((occluder.minZ - bounds.minZ) / bounds.depth) * resolution),
      0,
      resolution - 1
    )
    const maxRow = MathUtils.clamp(
      Math.ceil(((occluder.maxZ - bounds.minZ) / bounds.depth) * resolution),
      0,
      resolution - 1
    )

    for (let row = minRow; row <= maxRow; row += 1) {
      const z = zByRow[row]

      for (let column = minColumn; column <= maxColumn; column += 1) {
        const x = xByColumn[column]

        if (pointInRuntimeRadianceOccluder2D(x, z, occluder)) {
          data[(((row * resolution) + column) * 4) + 3] = opaqueHalf
        }
      }
    }
  }

  for (const light of layout.lights) {
    const lightDirection = getRuntimeRadianceLightDirection(light.side)
    const sourceX =
      light.torchPosition.x +
      (lightDirection.x * RUNTIME_RADIANCE_OCCLUDER_PADDING)
    const sourceZ =
      light.torchPosition.z +
      (lightDirection.z * RUNTIME_RADIANCE_OCCLUDER_PADDING)
    const centerColumn = MathUtils.clamp(
      Math.floor(((sourceX - bounds.minX) / bounds.width) * resolution),
      0,
      resolution - 1
    )
    const centerRow = MathUtils.clamp(
      Math.floor(((sourceZ - bounds.minZ) / bounds.depth) * resolution),
      0,
      resolution - 1
    )
    const radiusPixels = Math.max(
      1,
      Math.ceil((RUNTIME_RADIANCE_SOURCE_RADIUS / Math.min(bounds.width, bounds.depth)) * resolution)
    )
    const emitterOffsets: number[] = []

    for (let row = centerRow - radiusPixels; row <= centerRow + radiusPixels; row += 1) {
      if (row < 0 || row >= resolution) {
        continue
      }

      for (
        let column = centerColumn - radiusPixels;
        column <= centerColumn + radiusPixels;
        column += 1
      ) {
        if (column < 0 || column >= resolution) {
          continue
        }

        const dx = column - centerColumn
        const dz = row - centerRow

        if ((dx * dx) + (dz * dz) > radiusPixels * radiusPixels) {
          continue
        }

        const x = xByColumn[column]
        const z = zByRow[row]
        const sourceSideDistance =
          ((x - sourceX) * lightDirection.x) +
          ((z - sourceZ) * lightDirection.z)

        if (sourceSideDistance < -RUNTIME_RADIANCE_SOURCE_RADIUS * 0.2) {
          continue
        }

        const offset = ((row * resolution) + column) * 4

        if (data[offset + 3] !== 0) {
          continue
        }

        emitterOffsetSet.add(offset)
        emitterOffsets.push(offset)
      }
    }

    emitters.push({
      blue: TORCH_LIGHTMAP_TINT.b,
      green: TORCH_LIGHTMAP_TINT.g,
      id: light.id,
      index: light.index,
      offsets: emitterOffsets,
      red: TORCH_LIGHTMAP_TINT.r
    })
  }

  const texture = new DataTexture(
    data,
    resolution,
    resolution,
    RGBAFormat,
    HalfFloatType
  )
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  const emitterOffsets = Array.from(emitterOffsetSet)

  updateRuntimeRadianceEmitterTexture(
    {
      data,
      emitterOffsets,
      emitters,
      occluderCount: occluders.length,
      texture
    },
    0
  )

  return {
    data,
    emitterOffsets,
    emitters,
    occluderCount: occluders.length,
    texture
  }
}

function useRuntimeRadianceCascadeSurface(
  layout: MazeLayout,
  openGateIds: Set<string>
) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const openGateKey = useMemo(
    () => Array.from(openGateIds).sort().join('|'),
    [openGateIds]
  )
  const bounds = useMemo(() => getRuntimeRadianceBounds(layout), [layout])
  const cascadeWidth = RUNTIME_RADIANCE_RESOLUTION * RUNTIME_RADIANCE_BASE_RAY_COUNT
  const cascadeHeight = RUNTIME_RADIANCE_RESOLUTION
  const sceneTextureState = useMemo(
    () => createRuntimeRadianceSceneTexture(layout, openGateIds, bounds),
    [bounds, layout, openGateKey]
  )
  const resources = useMemo(() => {
    const passScene = new ThreeScene()
    const passCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const passGeometry = new PlaneGeometry(2, 2)
    const emptyTexture = new DataTexture(
      new Uint16Array([0, 0, 0, DataUtils.toHalfFloat(1)]),
      1,
      1,
      RGBAFormat,
      HalfFloatType
    )
    emptyTexture.colorSpace = NoColorSpace
    emptyTexture.needsUpdate = true
    const cascadeTargets = Array.from(
      { length: RUNTIME_RADIANCE_CASCADE_COUNT },
      () => createRuntimeRadianceRenderTarget(cascadeWidth, cascadeHeight, NearestFilter)
    )
    const outputTarget = createRuntimeRadianceRenderTarget(
      RUNTIME_RADIANCE_RESOLUTION,
      RUNTIME_RADIANCE_RESOLUTION,
      LinearFilter
    )
    const cascadeMaterial = new ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: runtimeRadianceCascadeFragmentShader,
      toneMapped: false,
      uniforms: {
        baseProbeCount: new Uniform(RUNTIME_RADIANCE_RESOLUTION),
        baseRayCount: new Uniform(RUNTIME_RADIANCE_BASE_RAY_COUNT),
        cascadeCount: new Uniform(RUNTIME_RADIANCE_CASCADE_COUNT),
        cascadeIndex: new Uniform(0),
        cascadeTextureSize: new Uniform(new Vector2(cascadeWidth, cascadeHeight)),
        directGain: new Uniform(RUNTIME_RADIANCE_DIRECT_GAIN),
        higherCascade: new Uniform<Texture>(emptyTexture),
        indirectGain: new Uniform(RUNTIME_RADIANCE_INDIRECT_GAIN),
        radianceBounds: new Uniform(new Vector4()),
        sceneMap: new Uniform<Texture>(sceneTextureState.texture),
        sceneMapSize: new Uniform(new Vector2(RUNTIME_RADIANCE_RESOLUTION, RUNTIME_RADIANCE_RESOLUTION))
      },
      vertexShader: runtimeRadianceFullscreenVertexShader
    })
    const resolveMaterial = new ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: runtimeRadianceResolveFragmentShader,
      toneMapped: false,
      uniforms: {
        baseProbeCount: new Uniform(RUNTIME_RADIANCE_RESOLUTION),
        baseRayCount: new Uniform(RUNTIME_RADIANCE_BASE_RAY_COUNT),
        cascadeTexture: new Uniform<Texture>(cascadeTargets[0].texture),
        cascadeTextureSize: new Uniform(new Vector2(cascadeWidth, cascadeHeight))
      },
      vertexShader: runtimeRadianceFullscreenVertexShader
    })
    const passMesh = new Mesh(passGeometry, cascadeMaterial)

    passScene.add(passMesh)

    return {
      cascadeMaterial,
      cascadeTargets,
      debug: {
        bounds,
        cascadeCount: RUNTIME_RADIANCE_CASCADE_COUNT,
        cascadeHeight,
        cascadeWidth,
        emitterFlicker: sceneTextureState.emitters.map((emitter) => ({
          lightId: emitter.id,
          value: getRuntimeTorchFlicker(emitter.index, 0)
        })),
        emitterPixelCount: sceneTextureState.emitterOffsets.length,
        generationMs: 0,
        gpuUpdateCount: 0,
        latestGpuUpdateMs: 0,
        lightCount: layout.lights.length,
        occluderCount: sceneTextureState.occluderCount,
        resolution: RUNTIME_RADIANCE_RESOLUTION,
        sceneResolution: RUNTIME_RADIANCE_RESOLUTION
      } satisfies RuntimeRadianceDebugState,
      emptyTexture,
      outputTarget,
      passCamera,
      passMesh,
      passScene,
      resolveMaterial
    }
  }, [
    bounds,
    cascadeHeight,
    cascadeWidth,
    layout.lights.length,
    sceneTextureState.occluderCount,
    sceneTextureState.texture
  ])

  useEffect(() => {
    resources.cascadeMaterial.uniforms.sceneMap.value = sceneTextureState.texture
    resources.debug.bounds = bounds
    resources.debug.emitterFlicker = sceneTextureState.emitters.map((emitter) => ({
      lightId: emitter.id,
      value: getRuntimeTorchFlicker(emitter.index, 0)
    }))
    resources.debug.emitterPixelCount = sceneTextureState.emitterOffsets.length
    resources.debug.lightCount = layout.lights.length
    resources.debug.occluderCount = sceneTextureState.occluderCount
  }, [
    bounds,
    layout.lights.length,
    resources,
    sceneTextureState.emitterOffsets.length,
    sceneTextureState.emitters,
    sceneTextureState.occluderCount,
    sceneTextureState.texture
  ])

  useFrame((state) => {
    if (!Number.isFinite(Number(document.body.dataset.loadingOverlayCompleteAt))) {
      state.invalidate()
      return
    }

    const startedAt = performance.now()
    const elapsed = state.clock.getElapsedTime()
    const previousRenderTarget = gl.getRenderTarget()
    const previousAutoClear = gl.autoClear

    updateRuntimeRadianceEmitterTexture(sceneTextureState, elapsed)
    gl.autoClear = false
    resources.cascadeMaterial.uniforms.radianceBounds.value.set(
      bounds.minX,
      bounds.minZ,
      bounds.width,
      bounds.depth
    )

    resources.passMesh.material = resources.cascadeMaterial
    for (let cascadeIndex = RUNTIME_RADIANCE_CASCADE_COUNT - 1; cascadeIndex >= 0; cascadeIndex -= 1) {
      resources.cascadeMaterial.uniforms.cascadeIndex.value = cascadeIndex
      resources.cascadeMaterial.uniforms.higherCascade.value =
        cascadeIndex === RUNTIME_RADIANCE_CASCADE_COUNT - 1
          ? resources.emptyTexture
          : resources.cascadeTargets[cascadeIndex + 1].texture
      gl.setRenderTarget(resources.cascadeTargets[cascadeIndex])
      gl.render(resources.passScene, resources.passCamera)
    }

    resources.passMesh.material = resources.resolveMaterial
    resources.resolveMaterial.uniforms.cascadeTexture.value = resources.cascadeTargets[0].texture
    gl.setRenderTarget(resources.outputTarget)
    gl.render(resources.passScene, resources.passCamera)
    gl.setRenderTarget(previousRenderTarget)
    gl.autoClear = previousAutoClear

    const updateMs = performance.now() - startedAt
    resources.debug.generationMs = updateMs
    resources.debug.latestGpuUpdateMs = updateMs
    resources.debug.emitterFlicker = sceneTextureState.emitters.map((emitter) => ({
      lightId: emitter.id,
      value: getRuntimeTorchFlicker(emitter.index, elapsed)
    }))
    resources.debug.gpuUpdateCount += 1
    state.invalidate()
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      invalidate()
    }, 16)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [invalidate])

  useEffect(
    () => () => {
      sceneTextureState.texture.dispose()
    },
    [sceneTextureState.texture]
  )

  useEffect(
    () => () => {
      resources.cascadeMaterial.dispose()
      resources.resolveMaterial.dispose()
      resources.passMesh.geometry.dispose()
      resources.cascadeTargets.forEach((target) => target.dispose())
      resources.outputTarget.dispose()
      resources.emptyTexture.dispose()
    },
    [resources]
  )

  return {
    bounds,
    debug: resources.debug,
    ready: true,
    texture: resources.outputTarget.texture
  } satisfies RuntimeRadianceSurface
}

async function loadRgbEImageDataTexture(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load surface lightmap texture: ${response.status}`)
  }

  const blob = await response.blob()
  const image = await createImageBitmap(blob)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      willReadFrequently: true
    })

    if (!context) {
      throw new Error('Failed to create surface lightmap decode canvas')
    }

    context.drawImage(image, 0, 0)
    const imageData = context.getImageData(0, 0, image.width, image.height)
    const texture = new DataTexture(
      new Uint8Array(imageData.data),
      image.width,
      image.height,
      RGBAFormat,
      UnsignedByteType
    )

    return configureLightmapTexture(texture)
  } finally {
    image.close()
  }
}

function useSurfaceLightmapAtlasTexture(lightmap: MazeLightmap) {
  const initialEncoding = getRuntimeSurfaceLightmapEncoding(lightmap)
  const [state, setState] = useState<{
    encoding: LightmapTextureEncoding
    ready: boolean
    texture: Texture
  }>(() => ({
    encoding: initialEncoding,
    ready: false,
    texture: createBlackLightmapTexture({ encoding: initialEncoding })
  }))

  useEffect(
    () => {
      let cancelled = false
      const imageUrl = getRuntimeSurfaceLightmapAtlasUrl(lightmap)
      const imageEncoding = getRuntimeSurfaceLightmapEncoding(lightmap)

      setState((current) => ({
        encoding: imageEncoding,
        ready: false,
        texture: current.texture
      }))

      const load = async () => {
        if (typeof lightmap.dataBase64 === 'string' && lightmap.dataBase64.length > 0) {
          return {
            encoding: 'linear' as const,
            texture: createLightmapAtlasTexture(
              decodeBase64Bytes(lightmap.dataBase64),
              lightmap.atlasWidth,
              lightmap.atlasHeight,
              lightmap.encoding ?? 'rgbe8'
            )
          }
        }

        if (
          imageUrl &&
          (imageUrl.endsWith('surface-lightmap-rgbe.png') || lightmap.encoding === 'rgbe8')
        ) {
          return {
            encoding: 'rgbe8' as const,
            texture: await loadRgbEImageDataTexture(resolveMazeDataUrl(imageUrl))
          }
        }

        if (imageUrl) {
          const response = await fetch(resolveMazeDataUrl(imageUrl))

          if (!response.ok) {
            throw new Error(`Failed to load surface lightmap bytes: ${response.status}`)
          }

          return {
            encoding: 'linear' as const,
            texture: createLightmapAtlasTexture(
              new Uint8Array(await response.arrayBuffer()),
              lightmap.atlasWidth,
              lightmap.atlasHeight,
              lightmap.encoding ?? 'rgbe8'
            )
          }
        }

        return {
          encoding: imageEncoding,
          texture: createBlackLightmapTexture({ encoding: imageEncoding })
        }
      }

      void load()
        .then((nextState) => {
          if (cancelled) {
            nextState.texture.dispose()
            return
          }

          setState({
            encoding: nextState.encoding,
            ready: true,
            texture: nextState.texture
          })
        })
        .catch((error) => {
          console.error(error)
          if (!cancelled) {
            setState({
              encoding: imageEncoding,
              ready: false,
              texture: createBlackLightmapTexture({ encoding: imageEncoding })
            })
          }
        })

      return () => {
        cancelled = true
      }
    },
    [lightmap]
  )

  state.texture.channel = 1

  useEffect(
    () => () => {
      state.texture.dispose()
    },
    [state.texture]
  )

  return state
}

function createLightmapFaceTexture(
  data: Uint8Array,
  atlasWidth: number,
  rect: LightmapRect,
  encoding: MazeLightmap['encoding'] = 'rgb16f',
  options: {
    flipY?: boolean
    mirrorX?: boolean
  } = {}
) {
  if (!hasLightmapRectData(data, atlasWidth, rect, encoding)) {
    return createBlackLightmapTexture({ flipY: options.flipY ?? true })
  }

  if (encoding === 'rgb16f') {
    const sourceData = new Uint16Array(
      data.buffer,
      data.byteOffset,
      Math.floor(data.byteLength / 2)
    )
    const sourcePixelStride = 3
    const outputPixelStride = 4
    const outputData = new Uint16Array(rect.width * rect.height * outputPixelStride)
    const alphaHalfFloat = DataUtils.toHalfFloat(1)

    for (let row = 0; row < rect.height; row += 1) {
      const destinationRowOffset = row * rect.width * outputPixelStride

      if (options.mirrorX) {
        for (let column = 0; column < rect.width; column += 1) {
          const sourceColumn = rect.width - 1 - column
          const sourceOffset =
            ((((rect.y + row) * atlasWidth) + rect.x + sourceColumn) * sourcePixelStride)
          const destinationOffset = destinationRowOffset + (column * outputPixelStride)

          outputData[destinationOffset] = sourceData[sourceOffset] ?? 0
          outputData[destinationOffset + 1] = sourceData[sourceOffset + 1] ?? 0
          outputData[destinationOffset + 2] = sourceData[sourceOffset + 2] ?? 0
          outputData[destinationOffset + 3] = alphaHalfFloat
        }
      } else {
        for (let column = 0; column < rect.width; column += 1) {
          const sourceOffset =
            ((((rect.y + row) * atlasWidth) + rect.x + column) * sourcePixelStride)
          const destinationOffset = destinationRowOffset + (column * outputPixelStride)

          outputData[destinationOffset] = sourceData[sourceOffset] ?? 0
          outputData[destinationOffset + 1] = sourceData[sourceOffset + 1] ?? 0
          outputData[destinationOffset + 2] = sourceData[sourceOffset + 2] ?? 0
          outputData[destinationOffset + 3] = alphaHalfFloat
        }
      }
    }

    const texture = new DataTexture(
      outputData,
      rect.width,
      rect.height,
      RGBAFormat,
      HalfFloatType
    )
    texture.colorSpace = NoColorSpace
    texture.flipY = options.flipY ?? true
    texture.generateMipmaps = false
    texture.magFilter = LinearFilter
    texture.minFilter = LinearFilter
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }

  const decodedFaceData = new Uint16Array(rect.width * rect.height * 4)
  const byteView = new DataView(data.buffer, data.byteOffset, data.byteLength)

  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const sourceColumn = options.mirrorX
        ? (rect.width - 1 - column)
        : column
      const atlasPixelIndex =
        (((rect.y + row) * atlasWidth) + rect.x + sourceColumn)
      const pixelIndex = ((row * rect.width) + column) * 4
      const decoded =
        encoding === 'rgb16f' && ((atlasPixelIndex * 6) + 5) < data.byteLength
          ? [
              DataUtils.fromHalfFloat(byteView.getUint16((atlasPixelIndex * 6) + 0, true)),
              DataUtils.fromHalfFloat(byteView.getUint16((atlasPixelIndex * 6) + 2, true)),
              DataUtils.fromHalfFloat(byteView.getUint16((atlasPixelIndex * 6) + 4, true))
            ]
          : encoding === 'rgbe8' && ((atlasPixelIndex * 4) + 3) < data.byteLength
          ? decodeRgbE8(
              data[atlasPixelIndex * 4],
              data[(atlasPixelIndex * 4) + 1],
              data[(atlasPixelIndex * 4) + 2],
              data[(atlasPixelIndex * 4) + 3]
            )
          : ((atlasPixelIndex * 3) + 2) < data.byteLength
            ? [
              (data[atlasPixelIndex * 3] ?? 0) / 255,
              (data[(atlasPixelIndex * 3) + 1] ?? 0) / 255,
              (data[(atlasPixelIndex * 3) + 2] ?? 0) / 255
            ]
            : [0, 0, 0]

      decodedFaceData[pixelIndex] = DataUtils.toHalfFloat(decoded[0] ?? 0)
      decodedFaceData[pixelIndex + 1] = DataUtils.toHalfFloat(decoded[1] ?? 0)
      decodedFaceData[pixelIndex + 2] = DataUtils.toHalfFloat(decoded[2] ?? 0)
      decodedFaceData[pixelIndex + 3] = DataUtils.toHalfFloat(1)
    }
  }

  const texture = new DataTexture(
    decodedFaceData,
    rect.width,
    rect.height,
    RGBAFormat,
    HalfFloatType
  )
  texture.colorSpace = NoColorSpace
  texture.flipY = options.flipY ?? true
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function createGroundPatchGeometry(
  rect: GroundPatchRect,
  lightmap: MazeLightmap
) {
  const groundBounds = lightmap.groundBounds
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
    const localLightmapU = (worldX - groundBounds.minX) / groundBounds.width
    const localLightmapV = 1 - ((worldZ - groundBounds.minZ) / groundBounds.depth)
    const [lightmapU, lightmapV] = mapLightmapRectUvToAtlas(
      lightmap.groundRect,
      lightmap.atlasWidth,
      lightmap.atlasHeight,
      localLightmapU,
      localLightmapV
    )

    mapUvs.push(mapU, mapV)
    lightmapUvs.push(lightmapU, lightmapV)
  }

  geometry.setAttribute('uv', new Float32BufferAttribute(mapUvs, 2))
  geometry.setAttribute('uv1', new Float32BufferAttribute(lightmapUvs, 2))
  return geometry
}

function mapLightmapRectUvToAtlas(
  rect: LightmapRect,
  atlasWidth: number,
  atlasHeight: number,
  localU: number,
  localV: number,
  options: { mirrorX?: boolean } = {}
) {
  const rectU = options.mirrorX ? 1 - localU : localU
  const u = (rect.x + 0.5 + (rectU * Math.max(0, rect.width - 1))) / atlasWidth
  const v = (rect.y + 0.5 + (localV * Math.max(0, rect.height - 1))) / atlasHeight

  return [u, v] as const
}

function createWallGeometry(lightmap: MazeLightmap, wallId: string) {
  const geometry = new BoxGeometry(WALL_LENGTH, WALL_HEIGHT, WALL_WIDTH)
  const uv = geometry.getAttribute('uv')
  const uv1 = new Float32Array(uv.count * 2)
  const rects = lightmap.wallRects[wallId]

  for (const group of geometry.groups) {
    const materialIndex = group.materialIndex ?? 0
    const rect =
      materialIndex === 4
        ? rects?.pz ?? lightmap.neutralRect
        : materialIndex === 5
          ? rects?.nz ?? lightmap.neutralRect
          : lightmap.neutralRect
    const mirrorX = materialIndex === 5

    for (let index = group.start; index < group.start + group.count; index += 1) {
      const vertexIndex = geometry.index?.getX(index) ?? index
      const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
        rect,
        lightmap.atlasWidth,
        lightmap.atlasHeight,
        uv.getX(vertexIndex),
        uv.getY(vertexIndex),
        { mirrorX }
      )

      uv1[vertexIndex * 2] = atlasU
      uv1[(vertexIndex * 2) + 1] = atlasV
    }
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
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
        lightMapAmbientTint: LIGHTMAP_AMBIENT_TINT,
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
  const [minimumDisplayElapsed, setMinimumDisplayElapsed] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMinimumDisplayElapsed(true)
    }, MIN_LOADING_OVERLAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  const visiblyComplete = complete && minimumDisplayElapsed

  useEffect(() => {
    if (visiblyComplete) {
      recordStartupMarker('loadingOverlayCompleteAt')
      return
    }

    if (!document.body.dataset.loadingOverlayCompleteAt) {
      document.body.dataset.loadingOverlayCompleteAt = 'pending'
    }
  }, [visiblyComplete])

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
        ></span>
      </h2>
    </div>
  )
}

function RendererSettings({
  cameraFov,
  composerEnabled,
  exposureStops,
  toneMapping
}: {
  cameraFov: number
  composerEnabled: boolean
  exposureStops: number
  toneMapping: ToneMappingMode
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const exposure = getRendererExposure(exposureStops)
    const nextFov = MathUtils.clamp(cameraFov, 1, 120)

    if ('isPerspectiveCamera' in camera && camera.isPerspectiveCamera) {
      const perspectiveCamera = camera as ThreeCamera & {
        fov: number
        updateProjectionMatrix: () => void
      }

      if (Math.abs(perspectiveCamera.fov - nextFov) > 0.001) {
        perspectiveCamera.fov = nextFov
        perspectiveCamera.updateProjectionMatrix()
      }
    }

    gl.toneMapping = composerEnabled
      ? NoToneMapping
      : RENDERER_TONE_MAPPING_MODES[toneMapping]
    gl.toneMappingExposure = composerEnabled ? 1 : exposure
    gl.domElement.dataset.cameraFov = nextFov.toFixed(2)
    gl.domElement.dataset.rendererExposure = exposure.toFixed(6)
    gl.domElement.dataset.rendererExposureStops = exposureStops.toFixed(2)
    gl.domElement.dataset.toneMapping = toneMapping
  }, [camera, cameraFov, composerEnabled, exposureStops, gl, toneMapping])

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
  priorityPosition,
  volumetricLighting,
  onEnvironmentFogColorChange,
  onEnvironmentTextureChange,
  onReflectionProbeAmbientColorsChange,
  onReflectionProbeCoefficientsChange,
  onReflectionProbeDepthTexturesChange,
  onReflectionProbeRawTexturesChange,
  onReflectionProbeTexturesChange
}: {
  layout: MazeLayout
  priorityPosition: { x: number; z: number }
  volumetricLighting: EffectSettings
  onEnvironmentFogColorChange: (color: Color) => void
  onEnvironmentTextureChange: (texture: Texture | null) => void
  onReflectionProbeAmbientColorsChange: (colors: Color[]) => void
  onReflectionProbeCoefficientsChange: (coefficients: Array<ProbeIrradianceCoefficients | null>) => void
  onReflectionProbeDepthTexturesChange: (textures: CubeTexture[]) => void
  onReflectionProbeRawTexturesChange: (textures: Texture[]) => void
  onReflectionProbeTexturesChange: (textures: Texture[]) => void
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const hdrTexture = useLoader(HDRLoader, ENVIRONMENT_URL)
  const pmremGenerator = useMemo(() => new PMREMGenerator(gl), [gl])
  const environmentTarget = useRef<{ dispose: () => void; texture: Texture } | null>(null)
  const reflectionProbeDepthTargets = useRef<Array<{ dispose: () => void; texture: CubeTexture }>>([])
  const reflectionProbeRawTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const reflectionProbeTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const needsProbeAmbientCapture = isEffectActive(volumetricLighting)
  const needsProbeAmbientCaptureRef = useRef(needsProbeAmbientCapture)
  needsProbeAmbientCaptureRef.current = needsProbeAmbientCapture
  const priorityPositionRef = useRef(priorityPosition)
  priorityPositionRef.current = priorityPosition

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
    onEnvironmentFogColorChange(BLACK_COLOR.clone())
    onEnvironmentTextureChange(null)
    onReflectionProbeAmbientColorsChange([])
    onReflectionProbeCoefficientsChange([])
    onReflectionProbeDepthTexturesChange([])
    onReflectionProbeRawTexturesChange([])
    onReflectionProbeTexturesChange([])

    return () => {
      delete scene.userData.reflectionProbeState
      onEnvironmentFogColorChange(BLACK_COLOR.clone())
      onEnvironmentTextureChange(null)
      onReflectionProbeAmbientColorsChange([])
      onReflectionProbeCoefficientsChange([])
      onReflectionProbeDepthTexturesChange([])
      onReflectionProbeRawTexturesChange([])
      onReflectionProbeTexturesChange([])
    }
  }, [
    layout.reflectionProbes.length,
    onEnvironmentFogColorChange,
    onEnvironmentTextureChange,
    onReflectionProbeAmbientColorsChange,
    onReflectionProbeCoefficientsChange,
    onReflectionProbeDepthTexturesChange,
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
    scene.environment = null
    scene.backgroundIntensity = BAKED_ENVIRONMENT_INTENSITY
    scene.environmentIntensity = 0
    onEnvironmentFogColorChange(BLACK_COLOR.clone())
    onEnvironmentTextureChange(null)

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
      onEnvironmentFogColorChange(BLACK_COLOR.clone())
      onEnvironmentTextureChange(null)
    }
  }, [
    gl,
    hdrTexture,
    onEnvironmentFogColorChange,
    onEnvironmentTextureChange,
    pmremGenerator,
    scene
  ])

  useEffect(() => {
    scene.backgroundIntensity = BAKED_ENVIRONMENT_INTENSITY
  }, [scene])

  useEffect(() => {
    const baseEnvironment = environmentTarget.current

    if (!baseEnvironment) {
      return undefined
    }

    const probeCount = layout.reflectionProbes.length
    const getDistanceToPriorityPosition = (probeIndex: number) => {
      const probe = layout.reflectionProbes[probeIndex]

      if (!probe) {
        return Number.POSITIVE_INFINITY
      }

      return (
        ((probe.position.x - priorityPositionRef.current.x) ** 2) +
        ((probe.position.z - priorityPositionRef.current.z) ** 2)
      )
    }
    const startupProbeIndices = Array.from(
      new Set(
        (() => {
          const prioritizedProbeIndices = getReflectionProbeBlendForPosition(
            layout,
            {
              x: priorityPositionRef.current.x,
              z: priorityPositionRef.current.z
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
            const distanceSquared = getDistanceToPriorityPosition(probeIndex)

            if (distanceSquared < nearestProbeDistanceSquared) {
              nearestProbeDistanceSquared = distanceSquared
              nearestProbeIndex = probeIndex
            }
          })

          return [...prioritizedProbeIndices, nearestProbeIndex]
        })()
      )
    )
    const startupVolumetricProbeIndices: number[] = []

    if (!layout.maze.id.startsWith('debug-')) {
      const previousDepthTargets = reflectionProbeDepthTargets.current
      const previousTargets = reflectionProbeTargets.current
      const previousRawTargets = reflectionProbeRawTargets.current
      reflectionProbeDepthTargets.current = []
      reflectionProbeRawTargets.current = []
      reflectionProbeTargets.current = []
      const nextDepthTargets = new Array<{ dispose: () => void; texture: CubeTexture }>(probeCount)
      const nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
      const nextProbeAmbientColors = new Array<Color>(probeCount)
      let cancelled = false
      let loadHandle = 0
      let publishHandle = 0
      let latestCaptureSceneState = getReflectionCaptureSceneState(scene, layout)
      const startupProbeIndexSet = new Set(startupProbeIndices)
      const startupVolumetricProbeIndexSet = new Set<number>()

      const disposeProbeTargets = (
        targets: Array<{ dispose: () => void; texture: Texture }>
      ) => {
        for (const target of targets) {
          if (target) {
            target.dispose()
          }
        }
      }

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
          complete: loadedProbeCount >= Math.min(
            probeCount,
            Math.max(startupProbeIndices.length, REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT)
          ),
          loadedProbeCount,
          loadedVolumetricProbeCount: 0,
          priorityProbeIndices: [...startupProbeIndices],
          probeCaptureCounts: [],
          probeMetrics: [],
          probeRawMetrics: [],
          probeRawReadbackErrors: [],
          probeDepthTextureUUIDs: nextDepthTargets.map((target) => target?.texture.uuid ?? null),
          probeRawTextureSummaries: [],
          probeRawTextureUUIDs: [],
          probeTextureUUIDs: nextTargets.map((target) => target?.texture.uuid ?? null),
          probeCount,
          requestedResidentProbeIndices: nextTargets.reduce<number[]>(
            (probeIndices, target, probeIndex) => {
              if (target) {
                probeIndices.push(probeIndex)
              }

              return probeIndices
            },
            []
          ),
          residentProbeLimit: Math.min(
            probeCount,
            Math.max(startupProbeIndices.length, REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT)
          ),
          startupVolumetricProbeCount: 0,
          startupVolumetricProbeIndices: [],
          textureMemoryBudgetBytes: REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES,
          ready:
            startupProbeIndices.length > 0 &&
            startupProbeIndices.every((probeIndex) => Boolean(nextTargets[probeIndex]))
        }
      }

      const publishReflectionProbeState = () => {
        const publishedAmbientColors = new Array<Color>(probeCount)
        const publishedDepthTextures = new Array<CubeTexture>(probeCount)
        const publishedTextures = new Array<Texture>(probeCount)

        for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
          const ambientColor = nextProbeAmbientColors[probeIndex]
          const depthTarget = nextDepthTargets[probeIndex]
          const target = nextTargets[probeIndex]

          publishedAmbientColors[probeIndex] = (
            ambientColor ?? BLACK_COLOR
          ).clone()
          if (depthTarget) {
            publishedDepthTextures[probeIndex] = depthTarget.texture
          }
          if (target) {
            publishedTextures[probeIndex] = target.texture
          }
        }
        const loadedProbeCount = publishedTextures.reduce(
          (count, texture) => count + Number(Boolean(texture)),
          0
        )
        reflectionProbeDepthTargets.current = nextDepthTargets
        reflectionProbeTargets.current = nextTargets
        reflectionProbeRawTargets.current = []
        startTransition(() => {
          onReflectionProbeAmbientColorsChange(publishedAmbientColors)
          onReflectionProbeCoefficientsChange([])
          onReflectionProbeDepthTexturesChange(publishedDepthTextures)
          onReflectionProbeRawTexturesChange([])
          onReflectionProbeTexturesChange(publishedTextures)
        })
        latestCaptureSceneState = getReflectionCaptureSceneState(scene, layout)
        scene.userData.reflectionProbeState = buildReflectionProbeState(
          latestCaptureSceneState
        )
      }

      const schedulePublishedProbeState = (immediate = false) => {
        if (cancelled) {
          return
        }

        if (immediate) {
          if (publishHandle !== 0) {
            window.clearTimeout(publishHandle)
            publishHandle = 0
          }
          publishReflectionProbeState()
          return
        }

        if (publishHandle !== 0) {
          return
        }

        publishHandle = window.setTimeout(() => {
          publishHandle = 0
          publishReflectionProbeState()
        }, REFLECTION_PROBE_PUBLISH_INTERVAL_MS)
      }

      scene.userData.reflectionProbeState = buildReflectionProbeState(latestCaptureSceneState)
      startTransition(() => {
        onReflectionProbeAmbientColorsChange([])
        onReflectionProbeCoefficientsChange([])
        onReflectionProbeDepthTexturesChange([])
        onReflectionProbeRawTexturesChange([])
        onReflectionProbeTexturesChange([])
      })

      const loadProbeManifest = async () => {
        try {
          const response = await fetch(
            resolveMazeDataUrl(`${layout.maze.id}/probe-assets.json`)
          )

          if (!response.ok) {
            throw new Error(
              `Failed to load probe asset manifest for ${layout.maze.id}: ${response.status}`
            )
          }

          const manifest = await response.json() as RuntimeProbeAssetManifest
          const residentProbeLimit = Math.min(
            manifest.probes.length,
            Math.max(startupProbeIndices.length, REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT)
          )
          const sortedBackgroundProbeIndices = manifest.probes
            .map((probe) => probe.index)
            .filter((probeIndex) => !startupProbeIndexSet.has(probeIndex))
            .sort(
              (leftProbeIndex, rightProbeIndex) =>
                getDistanceToPriorityPosition(leftProbeIndex) -
                getDistanceToPriorityPosition(rightProbeIndex)
            )
          const requestedResidentProbeIndices = Array.from(
            new Set([
              ...startupProbeIndices,
              ...sortedBackgroundProbeIndices.slice(
                0,
                Math.max(0, residentProbeLimit - startupProbeIndices.length)
              )
            ])
          )
          const requestedResidentProbeIndexSet = new Set(requestedResidentProbeIndices)
          const pendingStartupProbeIndices = [...startupProbeIndices]
          const pendingBackgroundProbeIndices = manifest.probes
            .map((probe) => probe.index)
            .filter(
              (probeIndex) =>
                requestedResidentProbeIndexSet.has(probeIndex) &&
                !startupProbeIndexSet.has(probeIndex)
            )
          let activeProbeLoads = 0
          let finished = false

          const finishLoading = () => {
            if (finished) {
              return
            }

            finished = true
            disposeProbeTargets(previousDepthTargets)
            disposeProbeTargets(previousTargets)
            disposeProbeTargets(previousRawTargets)
            schedulePublishedProbeState(true)
          }

          const loadProbe = async (probeIndex: number) => {
            const manifestProbe = manifest.probes.find((probe) => probe.index === probeIndex)

            if (!manifestProbe) {
              schedulePublishedProbeState(startupProbeIndexSet.has(probeIndex))
              return
            }

            const shouldLoadReflectionTexture = requestedResidentProbeIndexSet.has(probeIndex)
            const [processedTexture, depthTexture] = await Promise.all([
              shouldLoadReflectionTexture
                ? loadRuntimeProbeCubeUvTexture(
                    resolveMazeDataUrl(manifestProbe.processedCubeUvRgbE)
                  )
                : Promise.resolve(null),
              loadRuntimeProbeDepthCubeTexture(
                manifestProbe.depthFaces.map((depthFace) => resolveMazeDataUrl(depthFace))
              )
            ])

            if (cancelled) {
              processedTexture?.dispose()
              depthTexture.dispose()
              return
            }

            nextDepthTargets[probeIndex] = {
              dispose: () => depthTexture.dispose(),
              texture: depthTexture
            }
            if (processedTexture) {
              nextTargets[probeIndex] = {
                dispose: () => processedTexture.dispose(),
                texture: processedTexture
              }
            }
            const l0 = manifestProbe.coefficients?.[0]
            nextProbeAmbientColors[probeIndex] = l0
              ? new Color(
                  l0[0] / 0.282095,
                  l0[1] / 0.282095,
                  l0[2] / 0.282095
                )
              : BLACK_COLOR.clone()

            scene.userData.reflectionProbeState = buildReflectionProbeState(latestCaptureSceneState)

            if (startupProbeIndexSet.has(probeIndex)) {
              schedulePublishedProbeState(true)
            } else {
              schedulePublishedProbeState(false)
            }
          }

          const scheduleProbeLoads = () => {
            if (cancelled) {
              return
            }

            pendingBackgroundProbeIndices.sort(
              (leftProbeIndex, rightProbeIndex) =>
                getDistanceToPriorityPosition(leftProbeIndex) -
                getDistanceToPriorityPosition(rightProbeIndex)
            )

            const getNextProbeIndex = () => {
              if (pendingStartupProbeIndices.length > 0) {
                return pendingStartupProbeIndices.shift()
              }

              return pendingBackgroundProbeIndices.shift()
            }

            const getLoadConcurrency = () => (
              pendingStartupProbeIndices.length > 0
                ? REFLECTION_PROBE_LOAD_CONCURRENCY
                : REFLECTION_PROBE_BACKGROUND_LOAD_CONCURRENCY
            )

            while (
              activeProbeLoads < getLoadConcurrency() &&
              (
                pendingStartupProbeIndices.length > 0 ||
                pendingBackgroundProbeIndices.length > 0
              )
            ) {
              const probeIndex = getNextProbeIndex()

              if (probeIndex === undefined) {
                continue
              }

              activeProbeLoads += 1
              void loadProbe(probeIndex)
                .catch((error) => {
                  console.error(error)
                })
                .finally(() => {
                  activeProbeLoads -= 1

                  if (cancelled) {
                    return
                  }

                  if (
                    pendingStartupProbeIndices.length === 0 &&
                    pendingBackgroundProbeIndices.length === 0 &&
                    activeProbeLoads === 0
                  ) {
                    finishLoading()
                    return
                  }

                  loadHandle = window.setTimeout(scheduleProbeLoads, 0)
                })
            }
          }

          scheduleProbeLoads()
        } catch (error) {
          console.error(error)
          scene.userData.reflectionProbeState = buildReflectionProbeState(
            latestCaptureSceneState
          )
        }
      }

      void loadProbeManifest()

      return () => {
        cancelled = true
        window.clearTimeout(loadHandle)
        window.clearTimeout(publishHandle)
        disposeProbeTargets(nextDepthTargets)
        disposeProbeTargets(previousDepthTargets)
        disposeProbeTargets(nextTargets)
        disposeProbeTargets(previousTargets)
        disposeProbeTargets(previousRawTargets)
        startTransition(() => {
          onReflectionProbeAmbientColorsChange([])
          onReflectionProbeCoefficientsChange([])
          onReflectionProbeDepthTexturesChange([])
          onReflectionProbeRawTexturesChange([])
          onReflectionProbeTexturesChange([])
        })
      }
    }

    const previousDepthTargets = reflectionProbeDepthTargets.current
    const previousTargets = reflectionProbeTargets.current
    const previousRawTargets = reflectionProbeRawTargets.current
    reflectionProbeDepthTargets.current = []
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
    scene.environmentIntensity = BAKED_ENVIRONMENT_INTENSITY
    onReflectionProbeAmbientColorsChange(emptyAmbientColorArray)
    onReflectionProbeCoefficientsChange([])
    onReflectionProbeDepthTexturesChange([])
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
      onReflectionProbeCoefficientsChange([])
      onReflectionProbeDepthTexturesChange([])
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
          object.userData?.debugRole === 'reflection-probe-visual' ||
          isOfflineBakeExcludedObject(object)
        ) {
          hiddenObjects.push({ object, visible: object.visible })
          object.visible = false
        }
      })

      scene.environment = baseEnvironment.texture
      scene.environmentIntensity = BAKED_ENVIRONMENT_INTENSITY

      const probeCaptureSize = getPmremCubeSize(baseEnvironment.texture)
      const probeCaptureOrder = [
        ...startupProbeIndices,
        ...layout.reflectionProbes
          .map((_, probeIndex) => probeIndex)
          .filter((probeIndex) => !startupProbeIndices.includes(probeIndex))
          .sort(
            (leftProbeIndex, rightProbeIndex) =>
              getDistanceToPriorityPosition(leftProbeIndex) -
              getDistanceToPriorityPosition(rightProbeIndex)
          )
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
        const ambientCubeRenderTarget = needsProbeAmbientCaptureRef.current
          ? new WebGLCubeRenderTarget(
              REFLECTION_PROBE_AMBIENT_RENDER_SIZE,
              { type: UnsignedByteType }
            )
          : null
        const cubeCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, cubeRenderTarget)
        const ambientCubeCamera = ambientCubeRenderTarget
          ? new CubeCamera(0.1, REFLECTION_PROBE_FAR, ambientCubeRenderTarget)
          : null
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
        ambientCubeCamera?.position.copy(cubeCamera.position)
        ambientCubeCamera?.layers.enable(TORCH_BILLBOARD_LAYER)
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
        if (ambientCubeCamera) {
          scene.add(ambientCubeCamera)
          ambientCubeCamera.update(gl, scene)
          scene.remove(ambientCubeCamera)
        }
        for (const entry of originalMeshCallbacks) {
          entry.mesh.onBeforeRender = entry.onBeforeRender
        }

        nextTargets[probeIndex] = pmremGenerator.fromCubemap(cubeRenderTarget.texture)
        nextRawTargets[probeIndex] = cubeRenderTarget
        nextProbeCaptureCounts[probeIndex] = { ...captureCounts }
        if (ambientCubeRenderTarget) {
          const probeDebugStats = computeCubeRenderTargetDebugStats(gl, ambientCubeRenderTarget)

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
        } else {
          nextProbeAmbientColors[probeIndex] = BLACK_COLOR.clone()
          nextProbeMetrics[probeIndex] = null
        }
        nextProbeRawMetrics[probeIndex] = null
        nextProbeRawReadbackErrors[probeIndex] = null
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
        ambientCubeRenderTarget?.dispose()
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
            ? REFLECTION_PROBE_BACKGROUND_CAPTURE_DELAY_MS
            : REFLECTION_PROBE_STARTUP_CAPTURE_DELAY_MS
        )
      }

      bakeNextProbe()
    }
    bakeHandle = window.setTimeout(attemptBake, REFLECTION_PROBE_STARTUP_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(bakeHandle)
      disposeProbeTargets(nextTargets)
      disposeProbeTargets(nextRawTargets)
      disposeProbeTargets(previousDepthTargets)
      disposeProbeTargets(previousRawTargets)
      disposeProbeTargets(previousTargets)
      onReflectionProbeAmbientColorsChange([])
      onReflectionProbeCoefficientsChange([])
      onReflectionProbeDepthTexturesChange([])
      onReflectionProbeRawTexturesChange([])
      onReflectionProbeTexturesChange([])
      scene.background = previousBackground
      scene.backgroundIntensity = previousBackgroundIntensity
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousEnvironmentIntensity
      if (scene.environment !== baseEnvironment.texture) {
        scene.environment = baseEnvironment.texture
      }
      scene.environmentIntensity = BAKED_ENVIRONMENT_INTENSITY
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
    onReflectionProbeCoefficientsChange,
    onReflectionProbeDepthTexturesChange,
    onReflectionProbeRawTexturesChange,
    onReflectionProbeTexturesChange,
    pmremGenerator,
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
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={getProbeBlendEnvMap(normalizedProbeBlend)}
      envMapIntensity={0}
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
  debugIndex,
  environmentTexture,
  environmentIntensity,
  groundLightmapTexture,
  lightmap,
  lightmapTextureEncoding,
  lightmapContributionIntensity,
  maps,
  probeBlend,
  rect,
  runtimeRadiance,
  surfaceLightmapsEnabled
}: {
  debugIndex: number
  environmentTexture: Texture | null
  environmentIntensity: number
  groundLightmapTexture: Texture
  lightmap: MazeLightmap
  lightmapTextureEncoding: LightmapTextureEncoding
  lightmapContributionIntensity: number
  maps: PbrMaps
  probeBlend: ProbeBlendConfig
  rect: GroundPatchRect
  runtimeRadiance: RuntimeRadianceSurface
  surfaceLightmapsEnabled: boolean
}) {
  const geometry = useMemo(
    () => createGroundPatchGeometry(rect, lightmap),
    [lightmap, rect]
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
        BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT,
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: surfaceLightmapsEnabled ? lightmapContributionIntensity : 0,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [
      lightmapContributionIntensity,
      lightmapTextureEncoding,
      runtimeRadiance.bounds,
      runtimeRadiance.texture,
      surfaceLightmapsEnabled
    ]
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
        lightMap={undefined}
        lightMapIntensity={0}
        maps={maps}
        patchConfig={patchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function getRuntimeShadowScore(
  light: MazeLayout['lights'][number],
  playerWorldPosition: Vector3
) {
  const distance = Math.hypot(
    light.torchPosition.x - playerWorldPosition.x,
    light.torchPosition.z - playerWorldPosition.z
  )

  return 1 - MathUtils.smoothstep(
    distance,
    RUNTIME_SHADOW_INNER_RADIUS,
    RUNTIME_SHADOW_OUTER_RADIUS
  )
}

function RuntimeShadowedTorchLights({
  layout,
  openGateIds,
  playerWorldPosition,
  visualIntensity
}: {
  layout: MazeLayout
  openGateIds: Set<string>
  playerWorldPosition: Vector3
  visualIntensity: number
}) {
  const lightRefs = useRef<Array<ThreePointLight | null>>([])
  const slotStates = useRef<RuntimeShadowSlotDebugState[]>(
    Array.from({ length: RUNTIME_SHADOW_SLOT_COUNT }, () => ({
      flicker: 1,
      lightId: null,
      targetWeight: 0,
      weight: 0
    }))
  )
  const lightById = useMemo(
    () => new Map(layout.lights.map((light) => [light.id, light])),
    [layout.lights]
  )
  const openGateKey = useMemo(
    () => Array.from(openGateIds).sort().join('|'),
    [openGateIds]
  )

  useEffect(() => {
    lightRefs.current.forEach((light) => {
      if (light) {
        light.shadow.needsUpdate = true
      }
    })
  }, [openGateKey])

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime()
    const candidates = layout.lights
      .map((light) => ({
        light,
        score: getRuntimeShadowScore(light, playerWorldPosition)
      }))
      .filter((candidate) => candidate.score > 0.001)
      .sort((a, b) => b.score - a.score)
    const claimedIds = new Set<string>()

    for (let slotIndex = 0; slotIndex < RUNTIME_SHADOW_SLOT_COUNT; slotIndex += 1) {
      const slot = slotStates.current[slotIndex]
      const previousLightId = slot.lightId
      const currentLight = slot.lightId ? lightById.get(slot.lightId) ?? null : null
      const currentScore = currentLight
        ? getRuntimeShadowScore(currentLight, playerWorldPosition)
        : 0
      const replacement = candidates.find((candidate) => !claimedIds.has(candidate.light.id))

      if (
        replacement &&
        (
          !currentLight ||
          slot.weight < 0.02 ||
          currentScore <= RUNTIME_SHADOW_SWITCH_MARGIN * 0.25
        )
      ) {
        slot.lightId = replacement.light.id
      }

      if (slot.lightId) {
        claimedIds.add(slot.lightId)
      }

      const selectedLight = slot.lightId ? lightById.get(slot.lightId) ?? null : null
      const slotLightChanged = previousLightId !== slot.lightId
      const targetWeight = selectedLight
        ? getRuntimeShadowScore(selectedLight, playerWorldPosition)
        : 0
      const flicker = selectedLight
        ? getRuntimeTorchFlicker(selectedLight.index, elapsed)
        : 1
      const tau = targetWeight > slot.weight
        ? RUNTIME_SHADOW_FADE_IN_SECONDS
        : RUNTIME_SHADOW_FADE_OUT_SECONDS
      const smoothing = 1 - Math.exp(-delta / Math.max(tau, 0.0001))

      slot.targetWeight = targetWeight
      slot.flicker = flicker
      slot.weight += (targetWeight - slot.weight) * smoothing

      if (slot.weight < 0.001 && targetWeight <= 0.001) {
        slot.lightId = null
      }

      const pointLight = lightRefs.current[slotIndex]

      if (!pointLight || !selectedLight) {
        if (pointLight) {
          pointLight.intensity = 0
        }
        continue
      }

      pointLight.position.set(
        selectedLight.torchPosition.x,
        selectedLight.torchPosition.y,
        selectedLight.torchPosition.z
      )
      pointLight.color.copy(FIRE_COLOR)
      pointLight.distance = RUNTIME_SHADOW_TORCH_DISTANCE
      pointLight.decay = 2
      pointLight.intensity =
        slot.weight * flicker * visualIntensity * RUNTIME_SHADOW_TORCH_INTENSITY
      if (
        slotLightChanged ||
        elapsed - ((pointLight.userData.lastRuntimeShadowRefreshAt as number | undefined) ?? -Infinity) >=
          RUNTIME_SHADOW_REFRESH_SECONDS
      ) {
        pointLight.shadow.needsUpdate = true
        pointLight.userData.lastRuntimeShadowRefreshAt = elapsed
      }
    }
  })

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        getRuntimeShadowedTorchState?: () => {
          slots: RuntimeShadowSlotDebugState[]
        }
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}

    globalWindow.__levelsjamDebug = {
      ...existing,
      getRuntimeShadowedTorchState: () => ({
        slots: slotStates.current.map((slot) => ({ ...slot }))
      })
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getRuntimeShadowedTorchState
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [])

  return (
    <>
      {Array.from({ length: RUNTIME_SHADOW_SLOT_COUNT }, (_, index) => (
        <pointLight
          castShadow
          distance={RUNTIME_SHADOW_TORCH_DISTANCE}
          intensity={0}
          key={`runtime-shadow-torch-${index}`}
          ref={(light) => {
            lightRefs.current[index] = light
            if (light) {
              light.shadow.bias = -0.0005
              light.shadow.autoUpdate = false
              light.shadow.mapSize.set(256, 256)
              light.shadow.camera.near = 0.05
              light.shadow.camera.far = RUNTIME_SHADOW_TORCH_DISTANCE
            }
          }}
        />
      ))}
    </>
  )
}

function Ground({
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  groundLightmapTexture,
  lightmapTextureEncoding,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  groundLightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const puddle = usePuddleTextures(PUDDLE_TEXTURE_REPEAT)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const groundPatchRects = useMemo(
    () => buildGroundReflectionProbeRects(layout) as GroundPatchRect[],
    [layout]
  )

  return (
    <>
      {groundPatchRects.map((rect, index) => (
        (() => {
          const probeTextures = rect.probeIndices.map(
            (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
          )
          const probeDepthTextures = rect.probeIndices.map(
            (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
          )
          const probeCoefficients = rect.probeIndices.map(
            (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
          )
          const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
          const hasProbeDepthTextures = hasCompleteProbeDepthTextures(probeDepthTextures)
          const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
          const surfaceLightmapsEnabled =
            lightmapContributionIntensity > EFFECT_EPSILON
          const probeIblActive =
            iblContributionIntensity > EFFECT_EPSILON &&
            hasProbeCoefficients
          const reflectionActive =
            reflectionContributionIntensity > EFFECT_EPSILON &&
            hasProbeDepthTextures &&
            hasProbeTextures

          return (
            <GroundPatchMesh
              debugIndex={index}
              environmentTexture={environmentTexture}
              environmentIntensity={environmentIntensity}
              groundLightmapTexture={groundLightmapTexture}
              key={rect.id}
              lightmap={layout.maze.lightmap}
              lightmapTextureEncoding={lightmapTextureEncoding}
              lightmapContributionIntensity={lightmapContributionIntensity}
              maps={puddle}
              probeBlend={buildProbeBlendConfig(
                layout,
                rect.probeIndices,
                probeTextures,
                probeDepthTextures,
                probeDepthAtlasTextures,
                probeCoefficients,
                'disabled',
                {
          diffuseIntensity: iblContributionIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode: probeIblActive
            ? 'disabled'
            : reflectionActive
              ? 'world'
              : 'disabled',
                  region: rect.region,
                  useProbeDepthAtlases: volumetricShadowsEnabled,
                  vlmMode: probeIblActive ? 'cell5' : 'disabled'
                }
              )}
              rect={rect}
              runtimeRadiance={runtimeRadiance}
              surfaceLightmapsEnabled={surfaceLightmapsEnabled}
            />
          )
        })()
      ))}
    </>
  )
}

function TorchBillboard({
  position,
  seed,
  texture
}: {
  position: [number, number, number]
  seed: number
  texture: Texture | null
}) {
  const camera = useThree((state) => state.camera)
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

    if (texture) {
      texture.offset.x =
        (column + FIRE_FLIPBOOK_FRAME_CROP.minX) / FIRE_FLIPBOOK_GRID
      texture.offset.y =
        1 -
        ((row + FIRE_FLIPBOOK_FRAME_CROP.maxY) / FIRE_FLIPBOOK_GRID)
    }

    if (material.current) {
      const billboardMaterial = material.current.material as {
        color: Color
      }
      const flicker = getRuntimeTorchFlicker(seed - 1, elapsed)

      billboardMaterial.color.copy(FIRE_COLOR).multiplyScalar(
        TORCH_BASE_CANDELA * FIRE_BILLBOARD_INTENSITY_SCALE * flicker
      )
    }
  })

  if (!texture) {
    return null
  }

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
          lensflare: 'ignore-occlusion'
        }}
      >
        <planeGeometry args={[TORCH_BILLBOARD_SIZE, TORCH_BILLBOARD_SIZE]} />
        <meshBasicMaterial
          alphaTest={0.03}
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
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  mazeLight,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance,
  torchTexture
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  mazeLight: MazeLayout['lights'][number]
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  torchTexture: Texture | null
}) {
  const metal = useStandardPbrTextures(METAL_TEXTURE_URLS, METAL_TEXTURE_REPEAT)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const [material, setMaterial] = useState<ThreeMeshStandardMaterial | null>(null)
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint: BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT,
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: lightmapContributionIntensity,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET * 0.5,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [
      lightmapContributionIntensity,
      runtimeRadiance.bounds,
      runtimeRadiance.texture
    ]
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
  const monsterRadianceProbeTextures = useMemo(
    () => [probeTextures[0] ?? null, null, null, null] as [Texture | null, Texture | null, Texture | null, Texture | null],
    [probeTextures]
  )
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const monsterRadianceProbeDepthTextures = useMemo(
    () => [probeDepthTextures[0] ?? null, null, null, null] as [CubeTexture | null, CubeTexture | null, CubeTexture | null, CubeTexture | null],
    [probeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = Boolean(monsterRadianceProbeTextures[0])
  const hasProbeDepthTextures = Boolean(monsterRadianceProbeDepthTextures[0])
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const diffuseProbeIntensity = iblContributionIntensity
  const diffuseProbeActive =
    diffuseProbeIntensity > EFFECT_EPSILON &&
    hasProbeCoefficients
  const reflectionActive =
    reflectionContributionIntensity > EFFECT_EPSILON &&
    hasProbeDepthTextures &&
    hasProbeTextures
  const probeBlend = useMemo(
    () => ({
      ...buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: diffuseProbeIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode: diffuseProbeActive
            ? 'disabled'
            : reflectionActive
              ? 'constant'
              : 'disabled',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            mazeLight.side === 'east'
              ? { x: 1, z: 0 }
              : mazeLight.side === 'west'
                ? { x: -1, z: 0 }
                : mazeLight.side === 'south'
                  ? { x: 0, z: 1 }
                  : { x: 0, z: -1 },
          vlmMode: diffuseProbeActive ? 'boundary8' : 'disabled',
          weights: reflectionProbeBlend.weights as [number, number, number, number]
        }
      )
    }),
    [
      diffuseProbeActive,
      diffuseProbeIntensity,
      hasProbeTextures,
      iblContributionIntensity,
      layout,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionActive,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights,
      volumetricShadowsEnabled
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
            color="white"
            customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
            envMap={getProbeBlendEnvMap(probeBlend)}
            envMapIntensity={0}
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
        texture={torchTexture}
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

  if (billboardColor.a <= 0.01) {
    gl_FragColor = baseColor;
    return;
  }

  float sceneDepth = texture2D(sceneDepthBuffer, vUv).r;
  float billboardDepth = texture2D(billboardDepthBuffer, vUv).r;

  if (billboardDepth >= 0.999999 || billboardDepth > sceneDepth + 0.000001) {
    gl_FragColor = baseColor;
    return;
  }

  vec3 billboardEmission = billboardColor.rgb * billboardColor.a;

  gl_FragColor = vec4(baseColor.rgb + billboardEmission, 1.0);
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
  ambientColor,
  fogDistance,
  heightFalloff,
  layout,
  lightingStrength,
  noiseFrequency,
  noisePeriod,
  noiseStrength,
  rayStepCount,
  runtimeRadiance,
  runtimeRadianceIntensity,
  visible,
  volumeIntensity
}: {
  ambientColor: Color
  fogDistance: number
  heightFalloff: number
  layout: MazeLayout
  lightingStrength: number
  noiseFrequency: number
  noisePeriod: number
  noiseStrength: number
  rayStepCount: number
  runtimeRadiance: RuntimeRadianceSurface
  runtimeRadianceIntensity: number
  visible: boolean
  volumeIntensity: number
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const effect = useMemo(() => new FogVolumeEffectImpl(), [])
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

  useEffect(() => {
    effect.density = visible ? volumeIntensity * FOG_EXTINCTION_SCALE : 0
    effect.environmentFogColor = ambientColor
    effect.fogDistance = fogDistance
    effect.groundHeight = GROUND_Y
    effect.heightFalloff = heightFalloff
    effect.lightingStrength = lightingStrength
    effect.noiseFrequency = noiseFrequency
    effect.noisePeriod = noisePeriod
    effect.noiseStrength = noiseStrength
    effect.probeAmbientBounds = probeBounds
    effect.probeAmbientGrid = probeGrid
    effect.probeCoeffTextureL0 = null
    effect.probeDepthAtlasTextures = EMPTY_PROBE_DEPTH_ATLAS_TEXTURES
    effect.probeDepthAtlasFaceSize = 0
    effect.probeHeight = layout.reflectionProbes[0]?.position.y ?? 1.25
    effect.probeAmbientTexture = null
    effect.rayStepCount = rayStepCount
    effect.runtimeRadianceBounds = runtimeRadiance.bounds
    effect.runtimeRadianceIntensity = runtimeRadianceIntensity
    effect.runtimeRadianceTexture = runtimeRadiance.texture
    effect.useProbeCoefficientTexture = 0
    effect.useProbeDepthAtlases = 0
    effect.useProbeAmbientTexture = 0
    effect.volumeHeight = FOG_VOLUME_HEIGHT
    scene.userData.fogEffectState = {
      density: visible ? volumeIntensity : 0,
      fogDistance,
      environmentFogColor: [
        ambientColor.r,
        ambientColor.g,
        ambientColor.b
      ],
      hasProbeAmbientTexture: false,
      heightFalloff,
      lightingStrength,
      meshCount: visible ? 1 : 0,
      noiseFrequency,
      noisePeriod,
      noiseStrength,
      probeAmbientBounds: [
        probeBounds.x,
        probeBounds.y,
        probeBounds.z,
        probeBounds.w
      ],
      probeAmbientGrid: [
        probeGrid.x,
        probeGrid.y
      ],
      rayStepCount,
      useProbeAmbientTexture: 0,
      runtimeRadianceIntensity,
      runtimeRadianceTextureUUID: runtimeRadiance.texture.uuid,
      useProbeCoefficientTexture: 0,
      useProbeDepthAtlases: 0
    }
  }, [
    ambientColor,
    effect,
    fogDistance,
    heightFalloff,
    lightingStrength,
    noiseFrequency,
    noisePeriod,
    noiseStrength,
    probeBounds,
    probeGrid,
    rayStepCount,
    runtimeRadiance.bounds,
    runtimeRadiance.texture,
    runtimeRadianceIntensity,
    scene,
    visible,
    volumeIntensity
  ])

  useEffect(() => {
    return () => {
      delete scene.userData.fogEffectState
    }
  }, [scene])

  useFrame((state) => {
    effect.cameraProjectionMatrixInverse = camera.projectionMatrixInverse
    effect.cameraWorldMatrix = camera.matrixWorld
    effect.cameraWorldPosition = camera.getWorldPosition(new Vector3())
    effect.time = state.clock.getElapsedTime()
  })

  useEffect(() => () => effect.dispose(), [effect])

  return visible ? <primitive object={effect as unknown as Effect} /> : null
}

function ReflectionProbeVisualization({
  mode,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  layout,
  reflectionProbeTextures,
  visible
}: {
  mode: ProbeDebugMode
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  if (!visible || mode === 'none') {
    return null
  }

  return (
    <>
      {layout.reflectionProbes.map((probe, index) => {
        let material: ReactNode = null

        if (mode === 'reflection') {
          const texture = reflectionProbeTextures[index]
          const textureInfo = getCubeUvTextureInfo(texture)

          if (!texture || !textureInfo) {
            return null
          }

          material = (
            <shaderMaterial
              key={`${probe.id}:${mode}:reflection`}
              depthTest
              depthWrite
              fragmentShader={createProcessedReflectionProbeSphereFragmentShader()
                .replaceAll('PROBE_CUBEUV_TEXEL_WIDTH', textureInfo.texelWidth.toFixed(12))
                .replaceAll('PROBE_CUBEUV_TEXEL_HEIGHT', textureInfo.texelHeight.toFixed(12))
                .replaceAll('PROBE_CUBEUV_MAX_MIP', textureInfo.maxMip.toFixed(1))}
              side={DoubleSide}
              toneMapped
              uniforms={{
                probeCubeUvMap: { value: texture }
              }}
              onUpdate={(material) => {
                material.depthTest = true
                material.depthWrite = true
                material.toneMapped = true
              }}
              vertexShader={`
                varying vec3 vProbeDirection;

                void main() {
                  vProbeDirection = position;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
            />
          )
        }

        return (
          <group
            key={`${probe.id}:${mode}`}
            position={[probe.position.x, probe.position.y, probe.position.z]}
          >
            <mesh
              renderOrder={1000}
              userData={{
                debugIndex: index,
                debugRole: 'reflection-probe-visual',
                probeDebugMode: mode
              }}
            >
              <sphereGeometry args={[0.34, 20, 20]} />
              {material}
            </mesh>
          </group>
        )
      })}
    </>
  )
}

function ReflectionProbeDebugOverlay({
  mode,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  layout,
  reflectionProbeTextures,
  visible
}: {
  mode: ProbeDebugMode
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
      getReflectionProbeVisualizationState?: (probeIndex: number) => {
        depthTest: boolean | null
        depthWrite: boolean | null
        mode: ProbeDebugMode | null
        toneMapped: boolean | null
        uniformTextureUUIDs: {
          coeffL0: string | null
          probeCubeUvMap: string | null
          probeDepthMap: string | null
        }
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
          depthTest: boolean | null
          depthWrite: boolean | null
          mode: ProbeDebugMode | null
          toneMapped: boolean | null
          uniformTextureUUIDs: {
            coeffL0: string | null
            probeCubeUvMap: string | null
            probeDepthMap: string | null
          }
          visible: boolean | null
        } | null = null

        scene.traverse((object) => {
          if (
            match ||
            !(object instanceof Mesh) ||
            !matchesDebugRole(object, 'reflection-probe-visual', probeIndex)
          ) {
            return
          }

          const material = object.material as {
            uniforms?: {
              coeffL0?: { value?: Vector3 | null }
              probeDepthMap?: { value?: Texture | null }
              probeCubeUvMap?: { value?: Texture | null }
            }
          }
          const currentMode = object.userData?.probeDebugMode as ProbeDebugMode | undefined

          match = {
            depthTest:
              typeof object.material?.depthTest === 'boolean'
                ? object.material.depthTest
                : null,
            depthWrite:
              typeof object.material?.depthWrite === 'boolean'
                ? object.material.depthWrite
                : null,
            mode: currentMode ?? null,
            toneMapped:
              typeof object.material?.toneMapped === 'boolean'
                ? object.material.toneMapped
                : null,
            uniformTextureUUIDs: {
              coeffL0: material.uniforms?.coeffL0?.value ? '__coefficients__' : null,
              probeCubeUvMap:
                material.uniforms?.probeCubeUvMap?.value?.uuid ?? null,
              probeDepthMap:
                material.uniforms?.probeDepthMap?.value?.uuid ?? null
            },
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

        scene.traverse((object) => {
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
  }, [gl, scene])

  return (
    <ReflectionProbeVisualization
      mode={mode}
      reflectionProbeCoefficients={reflectionProbeCoefficients}
      reflectionProbeDepthTextures={reflectionProbeDepthTextures}
      layout={layout}
      reflectionProbeTextures={reflectionProbeTextures}
      visible={visible}
    />
  )
}

const REFLECTION_PROBE_ATLAS_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

function createProcessedReflectionProbeFragmentShader() {
  return `
uniform int faceIndex;
uniform sampler2D probeCubeUvMap;

varying vec2 vUv;

${PROBE_CUBEUV_SAMPLING_GLSL}

vec3 decodeRGBE8( vec4 rgbe ) {
  if ( rgbe.a <= 0.0 ) {
    return vec3( 0.0 );
  }

  float exponent = ( rgbe.a * 255.0 ) - 128.0;
  return rgbe.rgb * exp2( exponent );
}

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
  gl_FragColor = vec4(decodeRGBE8(texel), 1.0);
  #include <colorspace_fragment>
}
`
}

function createProcessedReflectionProbeSphereFragmentShader() {
  return `
uniform sampler2D probeCubeUvMap;

varying vec3 vProbeDirection;

${PROBE_CUBEUV_SAMPLING_GLSL}

vec3 decodeRGBE8( vec4 rgbe ) {
  if ( rgbe.a <= 0.0 ) {
    return vec3( 0.0 );
  }

  float exponent = ( rgbe.a * 255.0 ) - 128.0;
  return rgbe.rgb * exp2( exponent );
}

void main() {
  vec4 texel = probeBlendTextureCubeUV(
    probeCubeUvMap,
    normalize(vProbeDirection),
    0.0,
    PROBE_CUBEUV_TEXEL_WIDTH,
    PROBE_CUBEUV_TEXEL_HEIGHT,
    PROBE_CUBEUV_MAX_MIP
  );
  gl_FragColor = vec4(decodeRGBE8(texel), 1.0);
  #include <colorspace_fragment>
}
`
}

function createVolumetricLightmapProbeSphereFragmentShader() {
  return `
uniform vec3 coeffL0;
uniform vec3 coeffL1;
uniform vec3 coeffL2;
uniform vec3 coeffL3;

varying vec3 vProbeDirection;

const float PI = 3.141592653589793;

vec3 reconstructProbeRadiance(
  vec3 direction,
  vec3 basisCoeffL0,
  vec3 basisCoeffL1,
  vec3 basisCoeffL2,
  vec3 basisCoeffL3
) {
  vec3 normalizedDirection = normalize( direction );
  float basisL0 = 0.282095;
  float basisL1 = 0.488603 * normalizedDirection.x;
  float basisL2 = 0.488603 * normalizedDirection.y;
  float basisL3 = 0.488603 * normalizedDirection.z;

  return max(
    vec3( 0.0 ),
    ( basisCoeffL0 * basisL0 ) +
    ( basisCoeffL1 * basisL1 ) +
    ( basisCoeffL2 * basisL2 ) +
    ( basisCoeffL3 * basisL3 )
  ) * ( 4.0 * PI );
}

void main() {
  gl_FragColor = vec4(
    reconstructProbeRadiance(
      vProbeDirection,
      coeffL0,
      coeffL1,
      coeffL2,
      coeffL3
    ),
    1.0
  );
  #include <colorspace_fragment>
}
`
}

function createShadowProbeSphereFragmentShader() {
  return `
uniform samplerCube probeDepthMap;

varying vec3 vProbeDirection;

float decodePackedDistance( vec4 packedDistance ) {
  return dot(
    packedDistance,
    vec4(
      1.0,
      1.0 / 255.0,
      1.0 / 65025.0,
      1.0 / 16581375.0
    )
  ) * ${REFLECTION_PROBE_FAR.toFixed(1)};
}

void main() {
  float distanceToSurface = decodePackedDistance(
    textureCube( probeDepthMap, normalize( vProbeDirection ) )
  );
  float visibleDistance = clamp( distanceToSurface / 10.0, 0.0, 1.0 );

  gl_FragColor = vec4( vec3( visibleDistance ), 1.0 );
  #include <colorspace_fragment>
}
`
}

const REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER = `
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

const REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER_RAW = `
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
}
`

const REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER_RGBE = `
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

vec4 encodeRGBE8(vec3 value) {
  float maxComponent = max(max(value.r, value.g), value.b);

  if (maxComponent <= 1e-6) {
    return vec4(0.0, 0.0, 0.0, 0.0);
  }

  float exponent = ceil(log2(maxComponent));
  vec3 mantissa = value / exp2(exponent);

  return vec4(mantissa, (exponent + 128.0) / 255.0);
}

void main() {
  vec4 texel = textureCube(probeCubeMap, getFaceDirection(faceIndex, vUv));
  gl_FragColor = encodeRGBE8(texel.rgb);
}
`

const TEXTURE_2D_CAPTURE_FRAGMENT_SHADER = `
uniform sampler2D sourceTexture;

varying vec2 vUv;

vec4 encodeRGBE8(vec3 value) {
  float maxComponent = max(max(value.r, value.g), value.b);

  if (maxComponent <= 1e-6) {
    return vec4(0.0, 0.0, 0.0, 0.0);
  }

  float exponent = ceil(log2(maxComponent));
  vec3 mantissa = value / exp2(exponent);

  return vec4(mantissa, (exponent + 128.0) / 255.0);
}

void main() {
  vec4 texel = texture2D(sourceTexture, vUv);
  gl_FragColor = encodeRGBE8(texel.rgb);
}
`

function captureCubeTextureAtlasDataUrls(
  gl: WebGLRenderer,
  probeTexture: Texture,
  size: number,
  options: {
    applyColorSpaceTransform?: boolean
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
    fragmentShader: options.applyColorSpaceTransform === false
      ? REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER_RAW
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

function captureCubeTextureEncodedAtlasDataUrls(
  gl: WebGLRenderer,
  probeTexture: Texture,
  size: number
) {
  if (size <= 0) {
    return null
  }

  const atlasScene = new ThreeScene()
  const atlasCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const atlasMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: REFLECTION_PROBE_ATLAS_FRAGMENT_SHADER_RGBE,
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

function captureTexture2DEncodedDataUrl(
  gl: WebGLRenderer,
  texture: Texture,
  width: number,
  height: number
) {
  if (width <= 0 || height <= 0) {
    return null
  }

  const captureScene = new ThreeScene()
  const captureCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const captureMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: TEXTURE_2D_CAPTURE_FRAGMENT_SHADER,
    uniforms: {
      sourceTexture: { value: texture }
    },
    vertexShader: REFLECTION_PROBE_ATLAS_VERTEX_SHADER
  })
  const captureMesh = new Mesh(new PlaneGeometry(2, 2), captureMaterial)
  const captureTarget = new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    stencilBuffer: false,
    type: UnsignedByteType
  })
  const savedAutoClear = gl.autoClear
  const savedTarget = gl.getRenderTarget()
  const pixelBuffer = new Uint8Array(width * height * 4)

  captureScene.add(captureMesh)
  gl.autoClear = true

  try {
    gl.setRenderTarget(captureTarget)
    gl.clear(true, true, true)
    gl.render(captureScene, captureCamera)
    gl.readRenderTargetPixels(captureTarget, 0, 0, width, height, pixelBuffer)

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    canvas.width = width
    canvas.height = height
    const imageData = context.createImageData(width, height)

    for (let row = 0; row < height; row += 1) {
      const sourceRow = height - 1 - row
      const sourceOffset = sourceRow * width * 4
      const targetOffset = row * width * 4

      imageData.data.set(
        pixelBuffer.subarray(sourceOffset, sourceOffset + (width * 4)),
        targetOffset
      )
    }

    context.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    gl.setRenderTarget(savedTarget)
    gl.autoClear = savedAutoClear
    captureMesh.geometry.dispose()
    captureMaterial.dispose()
    captureTarget.dispose()
  }
}

function captureCubeUvTextureAtlasDataUrls(
  gl: WebGLRenderer,
  probeTexture: Texture,
  size: number
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
    fragmentShader: createProcessedReflectionProbeFragmentShader()
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

function createLinearDistancePackingMaterial(far: number) {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    fragmentShader: `
      #include <packing>

      uniform float probeFar;
      varying vec3 vWorldPosition;

      void main() {
        float distanceToProbe = min(1.0, length(vWorldPosition - cameraPosition) / probeFar);
        gl_FragColor = packDepthToRGBA(distanceToProbe);
      }
    `,
    uniforms: {
      probeFar: { value: far }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `
  })
}

function MazeWalls({
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  lightmapTexture,
  lightmapTextureEncoding,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance,
  staticVolumetricContributionIntensity,
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  staticVolumetricContributionIntensity: number
}) {
  const wall = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT)
  const torchTexture = useFireFlipbookTexture()

  return (
    <>
      {layout.walls.map((mazeWall, wallIndex) => (
        <MazeWallMesh
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={mazeWall.id}
          lightmap={layout.maze.lightmap}
          lightmapTexture={lightmapTexture}
          lightmapTextureEncoding={lightmapTextureEncoding}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          mazeWall={mazeWall}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
          wallIndex={wallIndex}
          wallMaterialMaps={wall}
        />
      ))}
      {layout.lights.map((mazeLight) => (
        <WallSconce
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={iblContributionIntensity}
          key={mazeLight.id}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          mazeLight={mazeLight}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
          torchTexture={torchTexture}
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
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={getProbeBlendEnvMap(probeBlend)}
      envMapIntensity={0}
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
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  lightmap,
  lightmapTexture,
  lightmapTextureEncoding,
  layout,
  lightmapContributionIntensity,
  mazeWall,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance,
  wallIndex,
  wallMaterialMaps
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  lightmap: MazeLightmap
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  layout: MazeLayout
  lightmapContributionIntensity: number
  mazeWall: MazeLayout['walls'][number]
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  wallIndex: number
  wallMaterialMaps: PbrMaps
}) {
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const geometry = useMemo(
    () => createWallGeometry(lightmap, mazeWall.id),
    [lightmap, mazeWall.id]
  )
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
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const hasProbeDepthTextures = hasCompleteProbeDepthTextures(probeDepthTextures)
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const probeIblActive =
    iblContributionIntensity > EFFECT_EPSILON &&
    hasProbeCoefficients
  const reflectionActive =
    reflectionContributionIntensity > EFFECT_EPSILON &&
    hasProbeDepthTextures &&
    hasProbeTextures
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const faceMaterialPatchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT,
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: surfaceLightmapsEnabled ? lightmapContributionIntensity : 0,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [
      lightmapContributionIntensity,
      lightmapTextureEncoding,
      runtimeRadiance.bounds,
      runtimeRadiance.texture,
      surfaceLightmapsEnabled
    ]
  )
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: iblContributionIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode: 'disabled',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            mazeWall.axis === 'z'
              ? { x: 1, z: 0 }
              : { x: 0, z: 1 },
          vlmMode: probeIblActive ? 'boundary8' : 'disabled',
          weights: reflectionProbeBlend.weights as [number, number, number, number]
        }
      ),
    [
      iblContributionIntensity,
      layout,
      lightmapContributionIntensity,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      probeIblActive,
      reflectionActive,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights,
      volumetricShadowsEnabled
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
        attach="material"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={undefined}
        lightMapIntensity={0}
        materialKey={wallFaceMaterialBaseKey}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function SceneGeometry({
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  openGateIds,
  probeDebugMode,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionContributionIntensity,
  reflectionProbeTextures,
  runtimeRadiance,
  staticVolumetricContributionIntensity,
  surfaceLightmap,
  turnState
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  openGateIds: Set<string>
  probeDebugMode: ProbeDebugMode
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionContributionIntensity: number
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  staticVolumetricContributionIntensity: number
  surfaceLightmap: {
    encoding: LightmapTextureEncoding
    ready: boolean
    texture: Texture
  }
  turnState: TurnState
}) {
  return (
    <>
      <Ground
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={staticVolumetricContributionIntensity}
        layout={layout}
        lightmapContributionIntensity={lightmapContributionIntensity}
        groundLightmapTexture={surfaceLightmap.texture}
        lightmapTextureEncoding={surfaceLightmap.encoding}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        runtimeRadiance={runtimeRadiance}
      />
      <MazeWalls
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={iblContributionIntensity}
        layout={layout}
        lightmapContributionIntensity={lightmapContributionIntensity}
        lightmapTexture={surfaceLightmap.texture}
        lightmapTextureEncoding={surfaceLightmap.encoding}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        runtimeRadiance={runtimeRadiance}
        staticVolumetricContributionIntensity={staticVolumetricContributionIntensity}
      />
      <MazeGates
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={iblContributionIntensity}
        lightmapContributionIntensity={lightmapContributionIntensity}
        layout={layout}
        openGateIds={openGateIds}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        runtimeRadiance={runtimeRadiance}
      />
      <MazeItems
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={iblContributionIntensity}
        lightmapContributionIntensity={lightmapContributionIntensity}
        layout={layout}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        runtimeRadiance={runtimeRadiance}
        turnState={turnState}
      />
      <ReflectionProbeDebugOverlay
        mode={probeDebugMode}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        layout={layout}
        reflectionProbeTextures={reflectionProbeTextures}
        visible={probeDebugMode !== 'none'}
      />
    </>
  )
}

function GateActor({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  gate,
  iblContributionIntensity,
  lightmapContributionIntensity,
  isOpen,
  layout,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  gate: MazeLayout['gates'][number]
  iblContributionIntensity: number
  lightmapContributionIntensity: number
  isOpen: boolean
  layout: MazeLayout
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const group = useRef<Group>(null)
  const model = useClonedRuntimeModel(
    GATE_MODEL_URL,
    'gate',
    'maze-gate',
    debugIndex
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: gate.center.x,
        z: gate.center.z
      }),
    [gate.center.x, gate.center.z, layout]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const hasProbeDepthTextures = hasCompleteProbeDepthTextures(probeDepthTextures)
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: iblContributionIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode:
            reflectionContributionIntensity > EFFECT_EPSILON &&
            hasProbeDepthTextures &&
            hasProbeTextures
              ? 'constant'
              : 'disabled',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            gate.axis === 'z'
              ? { x: 1, z: 0 }
              : { x: 0, z: 1 },
          vlmMode:
            iblContributionIntensity > EFFECT_EPSILON && hasProbeCoefficients
              ? 'boundary8'
              : 'disabled',
          weights: reflectionProbeBlend.weights as [number, number, number, number]
        }
      ),
    [
      gate.axis,
      hasProbeCoefficients,
      hasProbeDepthTextures,
      hasProbeTextures,
      iblContributionIntensity,
      layout,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights,
      volumetricShadowsEnabled
    ]
  )
  const transform = useMemo(() => {
    if (!model) {
      return null
    }

    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const center = new Vector3()
    const size = new Vector3()

    bounds.getCenter(center)
    bounds.getSize(size)

    const scale = MAZE_CELL_SIZE / Math.max(size.x, size.y, 0.0001)
    const minRelativeY = (bounds.min.y - center.y) * scale
    const maxRelativeY = (bounds.max.y - center.y) * scale

    return {
      closedY: GROUND_Y - minRelativeY,
      modelOffset: new Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
      openY: GROUND_Y - maxRelativeY - 0.02,
      scale
    }
  }, [model])

  const patchConfig = useMemo(
    () => ({
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: lightmapContributionIntensity,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [lightmapContributionIntensity, runtimeRadiance.bounds, runtimeRadiance.texture]
  )

  useAttachProbeBlendToModel(model, probeBlend, patchConfig)

  useEffect(() => {
    if (!group.current || !transform) {
      return
    }

    if (group.current.userData.initialized) {
      return
    }

    group.current.position.set(
      gate.center.x,
      transform.closedY,
      gate.center.z
    )
    group.current.userData.initialized = true
  }, [gate.center.x, gate.center.z, transform])

  useFrame((_, delta) => {
    if (!group.current || !transform) {
      return
    }

    group.current.position.y = MathUtils.damp(
      group.current.position.y,
      isOpen ? transform.openY : transform.closedY,
      18,
      delta
    )
  })

  if (!model || !transform) {
    return null
  }

  return (
    <group
      ref={group}
      rotation-y={gate.yaw}
      userData={{
        debugIndex,
        debugRole: 'maze-gate',
        gateId: gate.id
      }}
    >
      <primitive
        object={model}
        position={[
          transform.modelOffset.x,
          transform.modelOffset.y,
          transform.modelOffset.z
        ]}
        rotation-z={Math.PI}
        scale={transform.scale}
      />
    </group>
  )
}

function MazeGates({
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  openGateIds,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  openGateIds: Set<string>
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  return (
    <>
      {layout.gates.map((gate, gateIndex) => (
        <GateActor
          debugIndex={gateIndex}
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          gate={gate}
          iblContributionIntensity={iblContributionIntensity}
          lightmapContributionIntensity={lightmapContributionIntensity}
          isOpen={openGateIds.has(gate.id)}
          key={gate.id}
          layout={layout}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
        />
      ))}
    </>
  )
}

function MazeItemGroundActor({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  item,
  layout,
  lightmapContributionIntensity,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  item: MazeLayout['items'][number]
  layout: MazeLayout
  lightmapContributionIntensity: number
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const model = useClonedRuntimeModel(
    item.type === 'sword' ? SWORD_MODEL_URL : TROPHY_MODEL_URL,
    item.type,
    `maze-${item.type}`,
    debugIndex
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: item.position.x,
        z: item.position.z
      }),
    [item.position.x, item.position.z, layout]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const hasProbeDepthTextures = hasCompleteProbeDepthTextures(probeDepthTextures)
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: iblContributionIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode:
            reflectionContributionIntensity > EFFECT_EPSILON &&
            hasProbeDepthTextures &&
            hasProbeTextures
              ? 'constant'
              : 'disabled',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmMode:
            iblContributionIntensity > EFFECT_EPSILON && hasProbeCoefficients
              ? 'cell5'
              : 'disabled'
        }
      ),
    [
      hasProbeCoefficients,
      hasProbeDepthTextures,
      hasProbeTextures,
      iblContributionIntensity,
      layout,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      volumetricShadowsEnabled
    ]
  )
  const transform = useMemo(() => {
    if (!model) {
      return null
    }

    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const center = new Vector3()
    const size = new Vector3()

    bounds.getCenter(center)
    bounds.getSize(size)

    if (item.type === 'sword') {
      const scale = 1 / Math.max(size.z, 0.0001)
      return {
        modelOffset: new Vector3(
          -center.x * scale,
          -center.y * scale,
          -center.z * scale
        ),
        rotationX: Math.PI / 2,
        rotationY: 0,
        scale,
        y: GROUND_Y + ((bounds.max.z - center.z) * scale) - 0.04
      }
    }

    const scale = 0.5 / Math.max(size.y, 0.0001)

    return {
      modelOffset: new Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
      rotationX: 0,
      rotationY: 0,
      scale,
      y: GROUND_Y + ((center.y - bounds.min.y) * scale)
    }
  }, [item.type, model])

  const patchConfig = useMemo(
    () => ({
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: lightmapContributionIntensity,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET * 0.5,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [lightmapContributionIntensity, runtimeRadiance.bounds, runtimeRadiance.texture]
  )

  useAttachProbeBlendToModel(model, probeBlend, patchConfig)

  if (!model || !transform) {
    return null
  }

  return (
    <group
      position={[item.position.x, transform.y, item.position.z]}
      userData={{
        debugIndex,
        debugRole: `maze-${item.type}`,
        itemId: item.id
      }}
    >
      <primitive
        object={model}
        position={[
          transform.modelOffset.x,
          transform.modelOffset.y,
          transform.modelOffset.z
        ]}
        rotation-x={transform.rotationX}
        rotation-y={transform.rotationY}
        scale={transform.scale}
      />
    </group>
  )
}

function HeldItemView({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  itemType,
  layout,
  lightmapContributionIntensity,
  playerCell,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  itemType: 'sword' | 'trophy'
  layout: MazeLayout
  lightmapContributionIntensity: number
  playerCell: { x: number; y: number }
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const group = useRef<Group>(null)
  const camera = useThree((state) => state.camera)
  const playerWorldPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, playerCell, GROUND_Y),
    [layout.maze, playerCell.x, playerCell.y]
  )
  const model = useClonedRuntimeModel(
    itemType === 'sword' ? SWORD_MODEL_URL : TROPHY_MODEL_URL,
    itemType,
    `held-${itemType}`,
    debugIndex
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: playerWorldPosition.x,
        z: playerWorldPosition.z
      }),
    [layout, playerWorldPosition.x, playerWorldPosition.z]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const hasProbeDepthTextures = hasCompleteProbeDepthTextures(probeDepthTextures)
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const diffuseIntensity = iblContributionIntensity
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode:
            diffuseIntensity <= EFFECT_EPSILON &&
            reflectionContributionIntensity > EFFECT_EPSILON &&
            hasProbeDepthTextures &&
            hasProbeTextures
              ? 'constant'
              : 'disabled',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmMode:
            diffuseIntensity > EFFECT_EPSILON && hasProbeCoefficients
              ? 'cell5'
              : 'disabled'
        }
      ),
    [
      diffuseIntensity,
      hasProbeCoefficients,
      hasProbeDepthTextures,
      hasProbeTextures,
      layout,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      volumetricShadowsEnabled
    ]
  )
  const transform = useMemo(() => {
    if (!model) {
      return null
    }

    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const center = new Vector3()
    const size = new Vector3()

    bounds.getCenter(center)
    bounds.getSize(size)

    if (itemType === 'sword') {
      const scale = 1 / Math.max(size.z, 0.0001)

      return {
        modelOffset: new Vector3(
          -center.x * scale,
          -center.y * scale,
          -(bounds.min.z * scale)
        ),
        rotationX: 0,
        rotationY: Math.PI,
        scale
      }
    }

    const scale = 0.5 / Math.max(size.y, 0.0001)

    return {
      modelOffset: new Vector3(
        -center.x * scale,
        -(bounds.min.y * scale),
        -center.z * scale
      ),
      rotationX: 0,
      rotationY: 0,
      scale
    }
  }, [itemType, model])

  const patchConfig = useMemo(
    () => ({
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: lightmapContributionIntensity,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET * 0.5,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [lightmapContributionIntensity, runtimeRadiance.bounds, runtimeRadiance.texture]
  )

  useAttachProbeBlendToModel(model, probeBlend, patchConfig)

  useFrame(() => {
    if (!group.current) {
      return
    }

    const cameraQuaternion = camera.quaternion

    if (itemType === 'sword') {
      const handleLocal = new Vector3(0.5, -1, 0.25)
      const targetLocal = new Vector3(0, 0, -2)
      const handleWorld = handleLocal.applyQuaternion(cameraQuaternion).add(camera.position)
      const targetWorld = targetLocal.applyQuaternion(cameraQuaternion).add(camera.position)

      group.current.position.copy(handleWorld)
      group.current.lookAt(targetWorld)
      return
    }

    const trophyLocal = new Vector3(-0.5, -1, 0.25)
    const trophyWorld = trophyLocal.applyQuaternion(cameraQuaternion).add(camera.position)

    group.current.position.copy(trophyWorld)
    group.current.quaternion.copy(cameraQuaternion)
  })

  if (!model || !transform) {
    return null
  }

  return (
    <group
      ref={group}
      userData={{
        debugIndex,
        debugRole: `held-${itemType}`
      }}
    >
      <primitive
        object={model}
        position={[
          transform.modelOffset.x,
          transform.modelOffset.y,
          transform.modelOffset.z
        ]}
        rotation-x={transform.rotationX}
        rotation-y={transform.rotationY}
        scale={transform.scale}
      />
    </group>
  )
}

function MazeItems({
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance,
  turnState
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  turnState: TurnState
}) {
  return (
    <>
      {layout.items
        .filter((item) => (
          (item.type === 'sword' && turnState.swordState === 'ground') ||
          (item.type === 'trophy' && turnState.trophyState === 'ground')
        ))
        .map((item, itemIndex) => (
          <MazeItemGroundActor
            debugIndex={itemIndex}
            environmentIntensity={environmentIntensity}
            environmentTexture={environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            lightmapContributionIntensity={lightmapContributionIntensity}
            item={item}
            key={item.id}
            layout={layout}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            runtimeRadiance={runtimeRadiance}
          />
        ))}
      {turnState.player.hasSword ? (
        <HeldItemView
          debugIndex={0}
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          iblContributionIntensity={iblContributionIntensity}
          lightmapContributionIntensity={lightmapContributionIntensity}
          itemType="sword"
          layout={layout}
          playerCell={turnState.player.cell}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
        />
      ) : null}
      {turnState.player.hasTrophy ? (
        <HeldItemView
          debugIndex={1}
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          iblContributionIntensity={iblContributionIntensity}
          lightmapContributionIntensity={lightmapContributionIntensity}
          itemType="trophy"
          layout={layout}
          playerCell={turnState.player.cell}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
        />
      ) : null}
    </>
  )
}

function MonsterModel({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  monster,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  monster: TurnMonster
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const model = useClonedRuntimeModel(
    MONSTER_MODEL_URLS[monster.type],
    'monster',
    'monster',
    debugIndex
  )
  const monsterCellPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, monster.cell, GROUND_Y),
    [layout.maze, monster.cell.x, monster.cell.y]
  )
  const reflectionProbeBlend = useMemo(
    () => getReflectionProbeBlendForPosition(layout, {
      x: monsterCellPosition.x,
      z: monsterCellPosition.z
    }),
    [layout, monsterCellPosition.x, monsterCellPosition.z]
  )
  const probeTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeTextures]
  )
  const probeDepthTextures = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeDepthTextures[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeDepthTextures]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const hasProbeTextures = hasCompleteProbeTextures(probeTextures)
  const hasProbeCoefficients = hasCompleteProbeCoefficients(probeCoefficients)
  const diffuseProbeIntensity = iblContributionIntensity
  const diffuseProbeActive =
    diffuseProbeIntensity > EFFECT_EPSILON &&
    hasProbeCoefficients
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        probeTextures,
        probeDepthTextures,
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: diffuseProbeIntensity,
          probeCoefficientTextures,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode: diffuseProbeActive ? 'disabled' : 'none',
          useProbeDepthAtlases: volumetricShadowsEnabled,
          vlmMode: diffuseProbeActive ? 'cell5' : 'disabled'
        }
      ),
    [
      diffuseProbeActive,
      diffuseProbeIntensity,
      layout,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      volumetricShadowsEnabled
    ]
  )

  const transform = useMemo(() => {
    if (!model) {
      return null
    }

    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const size = new Vector3()
    const center = new Vector3()

    bounds.getSize(size)
    bounds.getCenter(center)
    const targetSize =
      monster.type === 'minotaur'
        ? 2.7
        : monster.type === 'spider'
          ? 2.1
          : 1.6
    const maxDimension = Math.max(size.x, size.y, size.z, 0.0001)
    const scale = targetSize / maxDimension

    return {
      modelOffset: new Vector3(
        -center.x * scale,
        (-bounds.min.y * scale) +
          (monster.type === 'minotaur' ? -0.25 : monster.type === 'werewolf' ? 0.02 : 0),
        -center.z * scale
      ),
      modelRotationZ:
        monster.type === 'spider'
          ? (monster.hand === 'left' ? Math.PI / 4 : -Math.PI / 4)
          : 0,
      scaledSize: new Vector3(
        size.x * scale,
        size.y * scale,
        size.z * scale
      ),
      targetSize,
      scale
    }
  }, [model, monster.hand, monster.type])

  const patchConfig = useMemo(
    () => ({
      runtimeRadianceBounds: runtimeRadiance.bounds,
      runtimeRadianceIntensity: lightmapContributionIntensity,
      runtimeRadianceNormalOffset: RUNTIME_RADIANCE_SURFACE_NORMAL_OFFSET * 0.5,
      runtimeRadianceTexture: runtimeRadiance.texture
    }),
    [lightmapContributionIntensity, runtimeRadiance.bounds, runtimeRadiance.texture]
  )

  useAttachProbeBlendToModel(model, probeBlend, patchConfig)

  if (!model || !transform) {
    return null
  }

  model.userData.debugIndex = debugIndex
  model.userData.debugRole = 'monster'
  model.userData.monsterScaledSize = [
    transform.scaledSize.x,
    transform.scaledSize.y,
    transform.scaledSize.z
  ]
  model.userData.monsterTargetSize = transform.targetSize
  model.userData.monsterType = monster.type

  return (
    <primitive
      object={model}
      position={[
        transform.modelOffset.x,
        transform.modelOffset.y,
        transform.modelOffset.z
      ]}
      rotation-z={transform.modelRotationZ}
      scale={transform.scale}
    />
  )
}

function MonsterActor({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  monster,
  playerCell,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  monster: TurnMonster
  playerCell: { x: number; y: number }
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
}) {
  const group = useRef<Group>(null)
  const positionAnimation = useRef<{
    from: Vector3
    startedAt: number
    to: Vector3
  } | null>(null)
  const targetPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, monster.cell, GROUND_Y),
    [layout.maze, monster.cell.x, monster.cell.y]
  )
  const playerWorldPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, playerCell, GROUND_Y),
    [layout.maze, playerCell.x, playerCell.y]
  )
  const targetYaw =
    monster.awake && (monster.type === 'minotaur' || monster.type === 'werewolf')
      ? yawTowardWorldPosition(targetPosition, playerWorldPosition)
      : directionToYaw(monster.direction)

  useEffect(() => {
    if (!group.current) {
      return
    }

    if (group.current.userData.initialized) {
      if (!group.current.position.equals(targetPosition)) {
        positionAnimation.current = {
          from: group.current.position.clone(),
          startedAt: performance.now(),
          to: targetPosition.clone()
        }
      }
      return
    }

    group.current.position.copy(targetPosition)
    group.current.rotation.y = targetYaw
    group.current.userData.initialized = true
  }, [targetPosition, targetYaw])

  useFrame((_, delta) => {
    if (!group.current) {
      return
    }

    const activePositionAnimation = positionAnimation.current

    if (activePositionAnimation) {
      const alpha = Math.min(
        1,
        (performance.now() - activePositionAnimation.startedAt) / 250
      )

      group.current.position.lerpVectors(
        activePositionAnimation.from,
        activePositionAnimation.to,
        alpha
      )

      if (alpha >= 1) {
        positionAnimation.current = null
      }
    } else {
      group.current.position.copy(targetPosition)
    }

    group.current.rotation.y = MathUtils.damp(
      group.current.rotation.y,
      targetYaw,
      14,
      delta
    )
  })

  return (
    <group
      ref={group}
      userData={{
        debugIndex,
        debugRole: 'monster',
        monsterId: monster.id,
        monsterType: monster.type
      }}
    >
      <MonsterModel
        debugIndex={debugIndex}
        environmentIntensity={environmentIntensity}
        environmentTexture={environmentTexture}
        iblContributionIntensity={iblContributionIntensity}
        layout={layout}
        lightmapContributionIntensity={lightmapContributionIntensity}
        monster={monster}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        runtimeRadiance={runtimeRadiance}
      />
    </group>
  )
}

function MonsterActors({
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  runtimeRadiance,
  turnState
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  runtimeRadiance: RuntimeRadianceSurface
  turnState: TurnState
}) {
  return (
    <>
      {turnState.monsters.map((monster, index) => (
        <MonsterActor
          debugIndex={index}
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          iblContributionIntensity={iblContributionIntensity}
          key={monster.id}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          monster={monster}
          playerCell={turnState.player.cell}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
        />
      ))}
    </>
  )
}

class ThreeComposerCompatPass<TThreePass extends {
  dispose: () => void
  needsSwap?: boolean
  render: (
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime?: number,
    stencilTest?: boolean
  ) => void
  renderToScreen?: boolean
  setSize: (width: number, height: number) => void
}> extends Pass {
  inner: TThreePass

  constructor(name: string, inner: TThreePass) {
    super(name)
    this.inner = inner
    this.needsSwap = true
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget,
    deltaTime?: number,
    stencilTest?: boolean
  ) {
    this.inner.renderToScreen = this.renderToScreen
    this.inner.render(renderer, outputBuffer, inputBuffer, deltaTime, stencilTest)
  }

  override setSize(width: number, height: number) {
    this.inner.setSize(width, height)
  }

  override dispose() {
    this.inner.dispose()
  }
}

class ThreeBloomCompatPass<TThreePass extends {
  dispose: () => void
  render: (
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime?: number,
    stencilTest?: boolean
  ) => void
  renderToScreen?: boolean
  setSize: (width: number, height: number) => void
}> extends Pass {
  inner: TThreePass
  copyCamera: OrthographicCamera
  copyMaterial: ShaderMaterial
  copyScene: ThreeScene
  copyQuad: Mesh
  tempRenderTarget: WebGLRenderTarget

  constructor(name: string, inner: TThreePass) {
    super(name)
    this.inner = inner
    this.needsSwap = true
    this.copyCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.copyMaterial = new ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: `
uniform sampler2D inputBuffer;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(inputBuffer, vUv);
}
`,
      uniforms: {
        inputBuffer: new Uniform<Texture | null>(null)
      },
      vertexShader: `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
    })
    this.copyQuad = new Mesh(new PlaneGeometry(2, 2), this.copyMaterial)
    this.copyScene = new ThreeScene()
    this.copyScene.add(this.copyQuad)
    this.tempRenderTarget = new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      format: RGBAFormat,
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      type: HalfFloatType
    })
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget,
    deltaTime?: number,
    stencilTest?: boolean
  ) {
    const previousAutoClear = renderer.autoClear

    renderer.autoClear = false
    this.copyMaterial.uniforms.inputBuffer.value = inputBuffer.texture
    renderer.setRenderTarget(this.tempRenderTarget)
    renderer.render(this.copyScene, this.copyCamera)

    this.inner.renderToScreen = false
    this.inner.render(
      renderer,
      outputBuffer,
      this.tempRenderTarget,
      deltaTime,
      stencilTest
    )

    this.copyMaterial.uniforms.inputBuffer.value = this.tempRenderTarget.texture
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.copyScene, this.copyCamera)
    renderer.autoClear = previousAutoClear
  }

  override setSize(width: number, height: number) {
    this.inner.setSize(width, height)
    this.tempRenderTarget.setSize(width, height)
  }

  override dispose() {
    this.inner.dispose()
    this.copyMaterial.dispose()
    this.copyQuad.geometry.dispose()
    this.tempRenderTarget.dispose()
  }
}

function BloomEffectPrimitive({
  settings
}: {
  settings: BloomSettings
}) {
  const size = useThree((state) => state.size)
  const bloomPass = useMemo(
    () =>
      new ThreeUnrealBloomPass(
        new Vector2(
          Math.max(1, Math.round(size.width * settings.resolutionScale)),
          Math.max(1, Math.round(size.height * settings.resolutionScale))
        ),
        settings.intensity,
        BLOOM_UNREAL_RADII[settings.kernelSize],
        settings.threshold
      ),
    []
  )
  const wrappedPass = useMemo(
    () => new ThreeBloomCompatPass('UnrealBloomCompatPass', bloomPass),
    [bloomPass]
  )

  useEffect(() => {
    bloomPass.enabled = settings.enabled
    bloomPass.strength = settings.intensity
    bloomPass.radius = MathUtils.clamp(
      BLOOM_UNREAL_RADII[settings.kernelSize] + (settings.smoothing * 0.35),
      0,
      1
    )
    bloomPass.threshold = settings.threshold
    bloomPass.setSize(
      Math.max(1, Math.round(size.width * settings.resolutionScale)),
      Math.max(1, Math.round(size.height * settings.resolutionScale))
    )
  }, [
    bloomPass,
    settings.enabled,
    settings.intensity,
    settings.kernelSize,
    settings.resolutionScale,
    settings.smoothing,
    settings.threshold,
    size.height,
    size.width
  ])

  useEffect(() => () => wrappedPass.dispose(), [wrappedPass])

  return <primitive object={wrappedPass} />
}

function isSsrReflectiveMesh(object: Mesh) {
  const role = object.userData?.debugRole

  if (
    role === 'torch-billboard' ||
    role === 'reflection-probe-visual' ||
    role === 'global-fog-volume'
  ) {
    return false
  }

  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material]

  return materials.some((material) => {
    if (
      !(material instanceof ThreeMeshPhysicalMaterial) &&
      !(material instanceof ThreeMeshStandardMaterial)
    ) {
      return false
    }

    const hasReflectionSource = Boolean(material.envMap) || Boolean(material.userData?.probeBlendDebug)

    return hasReflectionSource
  })
}

function isOfflineBakeExcludedObject(object: Object3D) {
  const role = object.userData?.debugRole

  return (
    role === 'maze-gate' ||
    role === 'maze-sword' ||
    role === 'maze-trophy' ||
    role === 'held-sword' ||
    role === 'held-trophy' ||
    role === 'monster'
  )
}

function SSRPassPrimitive({
  settings
}: {
  settings: SSRSettings
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const pass = useMemo(
    () =>
      new ThreeSSRPass({
        camera,
        height: size.height,
        renderer: gl,
        scene,
        selects: [],
        width: size.width
      }),
    [camera, gl, scene]
  )
  const wrappedPass = useMemo(
    () => new ThreeComposerCompatPass('SsrComposerCompatPass', pass),
    [pass]
  )

  useEffect(() => {
    // The authored puddle floor relies on map-driven reflectivity, and the
    // selective list can under-select those surfaces enough to make SSR inert.
    // Use the pass-wide scene path here so SSR remains visibly active.
    pass.selects = null
    pass.blur = settings.blur
    pass.bouncing = settings.bouncing
    pass.distanceAttenuation = settings.distanceAttenuation
    pass.enabled = settings.enabled
    pass.fresnel = settings.fresnel
    pass.infiniteThick = settings.infiniteThick
    pass.opacity = MathUtils.clamp(settings.intensity, 0, 1) * 1.5
    pass.maxDistance = settings.maxDistance
    pass.output =
      SSR_OUTPUT_OPTIONS.find((option) => option.key === settings.output)?.value ??
      ThreeSSRPass.OUTPUT.Default
    pass.resolutionScale = settings.resolutionScale
    pass.thickness = settings.thickness
  }, [
    pass,
    settings.blur,
    settings.bouncing,
    settings.distanceAttenuation,
    settings.enabled,
    settings.fresnel,
    settings.infiniteThick,
    settings.intensity,
    settings.maxDistance,
    settings.output,
    settings.resolutionScale,
    settings.thickness
  ])

  useEffect(() => {
    pass.setSize(size.width, size.height)
  }, [pass, size.height, size.width])

  useEffect(() => () => wrappedPass.dispose(), [wrappedPass])

  return <primitive object={wrappedPass} />
}

function AnamorphicEffectPrimitive({
  settings
}: {
  settings: AnamorphicSettings
}) {
  const effect = useMemo(() => new AnamorphicEffectImpl(), [])
  const size = useThree((state) => state.size)

  useEffect(() => {
    effect.colorGain = FIRE_COLOR.clone().multiplyScalar(settings.colorGain)
    effect.intensity = settings.enabled ? settings.intensity : 0
    effect.samples = settings.samples
    effect.scale = settings.scale
    effect.texelWidth = 1 / Math.max(size.width, 1)
    effect.threshold = settings.threshold
  }, [
    effect,
    settings.colorGain,
    settings.enabled,
    settings.intensity,
    settings.samples,
    settings.scale,
    settings.threshold,
    size.width
  ])

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
  exposure,
  noiseIntensity,
  noisePeriod
}: {
  exposure: number
  noiseIntensity: number
  noisePeriod: number
}) {
  const effect = useMemo(() => new ExposureEffectImpl(exposure), [])

  useEffect(() => {
    effect.exposure = exposure
  }, [effect, exposure])

  useFrame((state) => {
    if (noiseIntensity <= 0) {
      effect.exposure = exposure
      return
    }

    const period = Math.max(noisePeriod, 0.0001)
    const phase = (state.clock.getElapsedTime() / period) * Math.PI * 2
    const flicker = 1 + (Math.sin(phase) * noiseIntensity)

    effect.exposure = exposure * Math.max(0, flicker)
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function PlayerFadeEffectPrimitive() {
  const effect = useMemo(() => new PlayerFadeEffectImpl(), [])
  const latestFadeState = useRef({
    alpha: 0,
    color: [0, 0, 0] as [number, number, number],
    name: ''
  })
  const stateRef = useRef<{ name: string, startedAt: number }>({
    name: '',
    startedAt: 0
  })
  const strikeColor = useMemo(() => new Color(0.5, 0, 0), [])
  const deathColor = useMemo(() => new Color(0, 0, 0), [])

  useFrame(() => {
    const name = document.body.dataset.playerEffect ?? ''
    const now = performance.now()
    const setFade = (color: Color, alpha: number) => {
      effect.fadeColor = color
      effect.fadeAlpha = alpha
      latestFadeState.current = {
        alpha: MathUtils.clamp(alpha, 0, 1),
        color: [color.r, color.g, color.b],
        name
      }
    }

    if (stateRef.current.name !== name) {
      stateRef.current = { name, startedAt: now }
    }

    const elapsed = now - stateRef.current.startedAt

    if (name === 'sword-strike') {
      setFade(strikeColor, elapsed / 125)
      return
    }

    if (name === 'sword-strike-out') {
      setFade(strikeColor, 1 - (elapsed / 375))
      return
    }

    if (name === 'death') {
      setFade(deathColor, elapsed / 125)
      return
    }

    if (name === 'death-out') {
      setFade(deathColor, 1 - (elapsed / 1000))
      return
    }

    setFade(deathColor, 0)
  })

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: Record<string, unknown>
    }

    globalWindow.__levelsjamDebug = globalWindow.__levelsjamDebug ?? {}
    globalWindow.__levelsjamDebug.getPlayerFadeState = () => latestFadeState.current

    return () => {
      effect.dispose()
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getPlayerFadeState
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [effect])

  return <primitive object={effect as unknown as Effect} />
}

function AnimatedVignette({ settings }: { settings: VignetteSettings }) {
  const [darkness, setDarkness] = useState(settings.intensity)

  useFrame((state) => {
    const period = Math.max(settings.noisePeriod, 0.0001)
    const phase = (state.clock.getElapsedTime() / period) * Math.PI * 2
    const noise = 0.5 + (0.5 * Math.sin(phase))
    const nextDarkness = settings.noiseIntensity > 0
      ? settings.intensity + (noise * settings.noiseIntensity)
      : settings.intensity

    setDarkness(MathUtils.clamp(nextDarkness, 0, 1))
  })

  return <Vignette darkness={darkness} />
}

function DitherEffectPrimitive() {
  const effect = useMemo(() => new DitherEffectImpl(), [])

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function TorchLensFlare({
  settings,
  layout
}: {
  settings: LensFlareSettings
  layout: MazeLayout
}) {
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const [visibleSlotCount, setVisibleSlotCount] = useState(0)
  const projectedPosition = useMemo(() => new Vector3(), [])
  const raycasterPosition = useMemo(() => new Vector2(), [])
  const occlusionMeshes = useRef<Mesh[]>([])
  const lensPositions = useMemo(
    () =>
      layout.lights.map(
        (mazeLight) =>
          new Vector3(
            mazeLight.torchPosition.x,
            mazeLight.torchPosition.y,
            mazeLight.torchPosition.z
          )
      ),
    [layout.lights]
  )
  const flareSlots = useMemo(
    () =>
      Array.from({ length: MAX_SIMULTANEOUS_LENS_FLARES }, (_, index) => {
        const effect = new PostLensFlareEffect({
          aditionalStreaks: settings.aditionalStreaks,
          animated: settings.animated,
          anamorphic: settings.anamorphic,
          blendFunction: BlendFunction.NORMAL,
          colorGain: FIRE_COLOR.clone().multiplyScalar(
            LENS_FLARE_COLOR_GAIN
          ),
          enabled: settings.enabled,
          flareShape: settings.flareShape,
          flareSize: settings.flareSize,
          flareSpeed: settings.flareSpeed,
          ghostScale: settings.ghostScale,
          glareSize: settings.glareSize,
          haloScale: settings.haloScale,
          lensDirtTexture: null,
          lensPosition: new Vector3(),
          opacity: 1,
          screenRes: new Vector2(size.width, size.height),
          secondaryGhosts: settings.secondaryGhosts,
          starBurst: settings.starBurst,
          starPoints: settings.starPoints
        })
        const pass = new EffectPass(camera as ThreeCamera, effect)

        return {
          effect,
          index,
          lensPositionUniform: effect.uniforms.get('lensPosition') as Uniform<Vector3> | undefined,
          occlusionOpacityUniform: effect.uniforms.get('opacity') as Uniform<number> | undefined,
          pass,
          screenResUniform: effect.uniforms.get('screenRes') as Uniform<Vector2> | undefined
        }
      }),
    [camera]
  )

  useEffect(() => {
    for (const slot of flareSlots) {
      const enabledUniform = slot.effect.uniforms.get('enabled')
      const glareSizeUniform = slot.effect.uniforms.get('glareSize')
      const flareSizeUniform = slot.effect.uniforms.get('flareSize')
      const flareSpeedUniform = slot.effect.uniforms.get('flareSpeed')
      const flareShapeUniform = slot.effect.uniforms.get('flareShape')
      const animatedUniform = slot.effect.uniforms.get('animated')
      const anamorphicUniform = slot.effect.uniforms.get('anamorphic')
      const haloScaleUniform = slot.effect.uniforms.get('haloScale')
      const secondaryGhostsUniform = slot.effect.uniforms.get('secondaryGhosts')
      const aditionalStreaksUniform = slot.effect.uniforms.get('aditionalStreaks')
      const ghostScaleUniform = slot.effect.uniforms.get('ghostScale')
      const starBurstUniform = slot.effect.uniforms.get('starBurst')
      const starPointsUniform = slot.effect.uniforms.get('starPoints')
      const colorGainUniform = slot.effect.uniforms.get('colorGain')

      slot.effect.blendMode.opacity.value = MathUtils.clamp(
        settings.intensity * LENS_FLARE_INTENSITY_SCALE,
        0,
        1
      )
      if (enabledUniform) enabledUniform.value = settings.enabled
      if (glareSizeUniform) glareSizeUniform.value = settings.glareSize
      if (flareSizeUniform) flareSizeUniform.value = settings.flareSize
      if (flareSpeedUniform) flareSpeedUniform.value = settings.flareSpeed
      if (flareShapeUniform) flareShapeUniform.value = settings.flareShape
      if (animatedUniform) animatedUniform.value = settings.animated
      if (anamorphicUniform) anamorphicUniform.value = settings.anamorphic
      if (haloScaleUniform) haloScaleUniform.value = settings.haloScale
      if (secondaryGhostsUniform) secondaryGhostsUniform.value = settings.secondaryGhosts
      if (aditionalStreaksUniform) aditionalStreaksUniform.value = settings.aditionalStreaks
      if (ghostScaleUniform) ghostScaleUniform.value = settings.ghostScale
      if (starBurstUniform) starBurstUniform.value = settings.starBurst
      if (starPointsUniform) starPointsUniform.value = settings.starPoints
      if (colorGainUniform) {
        colorGainUniform.value.copy(
          FIRE_COLOR.clone().multiplyScalar(LENS_FLARE_COLOR_GAIN)
        )
      }
    }
  }, [flareSlots, settings])

  useEffect(() => {
    const nextOcclusionMeshes: Mesh[] = []

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }

      const debugRoles = object.userData?.debugRoles
      const isMazeWall =
        object.userData?.debugRole === 'maze-wall' ||
        (Array.isArray(debugRoles) && debugRoles.includes('maze-wall'))
      const isMonster = object.userData?.debugRole === 'monster'

      if (isMazeWall || isMonster) {
        nextOcclusionMeshes.push(object)
      }
    })

    occlusionMeshes.current = nextOcclusionMeshes
  }, [layout.maze.id, scene])

  useEffect(() => {
    for (const slot of flareSlots) {
      if (!slot.screenResUniform) {
        continue
      }
      slot.screenResUniform.value.set(size.width, size.height)
    }
  }, [flareSlots, size.height, size.width])

  useFrame((_, delta) => {
    const visibleLensPositions: Array<{
      position: Vector3
      score: number
    }> = []

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

      raycasterPosition.set(projectedPosition.x, projectedPosition.y)
      raycaster.setFromCamera(raycasterPosition, camera)

      const intersections = raycaster.intersectObjects(occlusionMeshes.current, false)
      const distanceToLight = camera.position.distanceTo(lensPosition)
      let occluded = false

      for (const intersection of intersections) {
        if (intersection.distance >= distanceToLight - LENS_FLARE_OCCLUSION_MARGIN) {
          break
        }

        occluded = true
        break
      }

      if (occluded) {
        continue
      }

      visibleLensPositions.push({
        position: lensPosition,
        score: lensScore
      })
      visibleLensPositions.sort((left, right) => left.score - right.score)
      if (visibleLensPositions.length > MAX_SIMULTANEOUS_LENS_FLARES) {
        visibleLensPositions.length = MAX_SIMULTANEOUS_LENS_FLARES
      }
    }

    for (let slotIndex = 0; slotIndex < flareSlots.length; slotIndex += 1) {
      const slot = flareSlots[slotIndex]
      const visibleLens = visibleLensPositions[slotIndex]
      const nextHasVisibleLens = Boolean(visibleLens) && settings.enabled
      const visibilityTarget = nextHasVisibleLens ? 1 - settings.opacity : 1

      if (visibleLens && slot.lensPositionUniform) {
        projectedPosition.copy(visibleLens.position).project(camera)
        slot.lensPositionUniform.value.set(projectedPosition.x, projectedPosition.y, 0)
      }

      if (slot.occlusionOpacityUniform) {
        slot.occlusionOpacityUniform.value = MathUtils.damp(
          slot.occlusionOpacityUniform.value,
          visibilityTarget,
          12,
          delta
        )
      }
    }

    scene.userData.lensFlareState = {
      enabled: settings.enabled,
      intensity: settings.intensity,
      totalLensCount: lensPositions.length,
      visibleLensCount: visibleLensPositions.length,
      visibleLenses: visibleLensPositions.map((lens) => ({
        position: [lens.position.x, lens.position.y, lens.position.z],
        score: lens.score
      }))
    }

    setVisibleSlotCount((currentCount) =>
      currentCount === visibleLensPositions.length
        ? currentCount
        : visibleLensPositions.length
    )
  })

  useEffect(() => {
    return () => {
      for (const slot of flareSlots) {
        slot.pass.dispose()
        slot.effect.dispose()
      }
    }
  }, [flareSlots])

  return (
    <>
      {flareSlots.slice(0, visibleSlotCount).map((slot) => (
        <primitive
          key={`torch-lens-flare-${slot.index}`}
          object={slot.pass as unknown as Pass}
        />
      ))}
    </>
  )
}

function FlightRig({
  layout,
  movementSettings,
  onReplayActiveChange,
  replayRequestId,
  setDisplayedOpenGateIds,
  setTurnState,
  turnState,
  wallBounds
}: {
  layout: MazeLayout
  movementSettings: MovementSettings
  onReplayActiveChange: (active: boolean) => void
  replayRequestId: number
  setDisplayedOpenGateIds: (gateIds: string[]) => void
  setTurnState: (value: TurnState | ((current: TurnState) => TurnState)) => void
  turnState: TurnState
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
  const freeCamera = useRef(false)
  const inputQueue = useRef<TurnAction[]>([])
  const replayQueue = useRef<TurnAction[]>([])
  const replayActive = useRef(false)
  const turnStateRef = useRef(turnState)
  const cameraShake = useRef({ amplitude: 0, endsAt: 0 })
  const playerAnimation = useRef<{
    action: TurnAction
    blocked: boolean
    from: TurnState
    killed: boolean
    playerEffect: 'death' | 'escape' | 'sword-strike' | null
    startedAt: number
    to: TurnState
  } | null>(null)
  const playerEffectClearTimeout = useRef<number | null>(null)
  const isPointerLocked = useRef(false)
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const cameraShakeOffset = useRef(new Vector3())
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
    turnStateRef.current = turnState
  }, [turnState])

  useEffect(() => {
    if (replayRequestId <= 0) {
      return
    }

    const replayActions = Array.isArray(layout.maze.solution?.actions)
      ? [...layout.maze.solution.actions]
      : []
    const nextState = createInitialTurnState(layout.maze)

    replayQueue.current = replayActions
    inputQueue.current = []
    playerAnimation.current = null
    replayActive.current = replayActions.length > 0
    freeCamera.current = false
    setDisplayedOpenGateIds(getOpenGateIds(layout.maze, nextState))
    setTurnState(nextState)
    onReplayActiveChange(replayActive.current)
  }, [layout.maze, onReplayActiveChange, replayRequestId, setDisplayedOpenGateIds, setTurnState])

  useEffect(() => {
    const spawnPosition = getMazeCellWorldPosition(
      layout.maze,
      turnState.player.cell,
      GROUND_Y
    )
    const cameraPosition = new Vector3(
      spawnPosition.x,
      GROUND_Y + PLAYER_EYE_HEIGHT,
      spawnPosition.z
    )

    camera.rotation.order = 'YXZ'
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    yaw.current = directionToYaw(turnState.player.direction)
    camera.quaternion.setFromEuler(cameraEuler.set(DEFAULT_CAMERA_PITCH, yaw.current, 0, 'YXZ'))
    pitch.current = DEFAULT_CAMERA_PITCH
    playerPosition.current.copy(spawnPosition)
  }, [camera, layout.maze, turnState.player.cell, turnState.player.direction])

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
      if (!isPointerLocked.current || !freeCamera.current) {
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
      if (!freeCamera.current) {
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
  }, [camera, canvas])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === BACKQUOTE_CODE) {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        keys.current[event.code] = false
        return
      }

      if (event.code === 'F1') {
        event.preventDefault()
        freeCamera.current = !freeCamera.current
        keys.current = {}
        if (!freeCamera.current && document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        return
      }

      if (POINTER_UNLOCK_CODES.has(event.code) || event.key === 'Meta') {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        keys.current[event.code] = false
        return
      }

      if (!freeCamera.current && !replayActive.current) {
        const queuedAction =
          event.code === 'KeyW' || event.code === 'ArrowUp'
            ? 'move-forward'
            : event.code === 'KeyS' || event.code === 'ArrowDown'
              ? 'move-backward'
              : event.code === 'KeyA' || event.code === 'ArrowLeft'
                ? 'rotate-left'
                : event.code === 'KeyD' || event.code === 'ArrowRight'
                  ? 'rotate-right'
                  : null

        if (queuedAction) {
          event.preventDefault()
          if (!keys.current[event.code] && inputQueue.current.length < MAX_BUFFERED_TURN_COMMANDS) {
            inputQueue.current.push(queuedAction)
          }
          keys.current[event.code] = true
          return
        }
      }

      if (
        event.code === 'Space' ||
        event.code === 'KeyQ' ||
        event.code === 'KeyE' ||
        event.code === 'KeyW' ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown' ||
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight'
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
  }, [canvas])

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
            diffuseIntensity: number
            mode: 'constant' | 'disabled' | 'none' | 'world'
            radianceIntensity: number
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
            probeBlendDiffuseIntensity: number | null
            probeBlendMode: number | null
            probeBlendRadianceIntensity: number | null
            probeBlendRadianceMode: number | null
            probeVlmMode: number | null
          } | null
          scale: [number, number, number]
          visible: boolean
          worldQuaternion: [number, number, number, number]
          worldPosition: [number, number, number]
        } | null
        getMonsterRenderState?: (index: number) => {
          boundsSize: [number, number, number] | null
          doubleSidedMaterialCount: number
          hasLightMap: boolean
          meshCount: number
          targetSize: number | null
          type: 'minotaur' | 'spider' | 'werewolf' | null
          totalTriangleCount: number
          uniqueMaterialCount: number
          visible: boolean
        } | null
        getTurnStateSummary?: () => {
          dead: boolean
          escaped: boolean
          monsters: Array<{
            awake: boolean
            cell: { x: number; y: number }
            direction: CardinalDirection
            id: string
            type: 'minotaur' | 'spider' | 'werewolf'
          }>
          openGateIds: string[]
          player: {
            cell: { x: number; y: number }
            direction: CardinalDirection
            hasSword: boolean
            hasTrophy: boolean
          }
          replayActive: boolean
          swordState: 'consumed' | 'ground' | 'held'
          trophyState: 'ground' | 'held'
          turn: number
        }
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
          loadedVolumetricProbeCount?: number
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
          requestedResidentProbeIndices?: number[]
          residentProbeLimit?: number
          ready: boolean
          startupVolumetricProbeCount?: number
          startupVolumetricProbeIndices?: number[]
          textureMemoryBudgetBytes?: number
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
    const monsterBounds = new Box3()
    const monsterBoundsSize = new Vector3()
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
            diffuseIntensity: number
            mode: 'constant' | 'disabled' | 'none' | 'world'
            radianceIntensity: number
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
            probeVlmMode: number | null
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
                  diffuseIntensity: number
                  mode: 'constant' | 'disabled' | 'none' | 'world'
                  radianceIntensity: number
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
                  probeBlendDiffuseIntensity: number | null
                  probeBlendMode: number | null
                  probeBlendRadianceIntensity: number | null
                  probeBlendRadianceMode: number | null
                  probeVlmMode: number | null
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
          probeBlendDiffuseIntensity: null,
          probeBlendMode: null,
          probeBlendRadianceIntensity: null,
          probeBlendRadianceMode: null,
          probeVlmMode: null
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
      getMonsterRenderState: (index) => {
        let meshCount = 0
        let totalTriangleCount = 0
        let doubleSidedMaterialCount = 0
        let hasLightMap = false
        let visible = false
        let targetSize: number | null = null
        let monsterType: 'minotaur' | 'spider' | 'werewolf' | null = null
        const materialIds = new Set<string>()

        monsterBounds.makeEmpty()

        for (const root of getDebugRoots()) {
          root.traverse((object) => {
            if (
              !matchesDebugRole(object, 'monster', index)
            ) {
              return
            }

            visible = visible || object.visible
            monsterBounds.expandByObject(object)
            targetSize =
              typeof object.userData?.monsterTargetSize === 'number'
                ? object.userData.monsterTargetSize
                : targetSize
            monsterType =
              object.userData?.monsterType === 'minotaur' ||
                object.userData?.monsterType === 'spider' ||
                object.userData?.monsterType === 'werewolf'
                ? object.userData.monsterType
                : monsterType

            if (!(object instanceof Mesh)) {
              return
            }

            meshCount += 1
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material]

            for (const material of materials) {
              if (!(material instanceof Material)) {
                continue
              }

              materialIds.add(material.uuid)

              if (material.side === DoubleSide) {
                doubleSidedMaterialCount += 1
              }
            }

            hasLightMap = hasLightMap || materials.some(
              (material) => Boolean((material as { lightMap?: Texture | null }).lightMap)
            )

            const positionAttribute = object.geometry.getAttribute('position')
            totalTriangleCount += object.geometry.index
              ? Math.floor(object.geometry.index.count / 3)
              : Math.floor((positionAttribute?.count ?? 0) / 3)
          })
        }

        if (meshCount === 0) {
          return null
        }

        monsterBounds.getSize(monsterBoundsSize)

        return {
          boundsMax: [
            monsterBounds.max.x,
            monsterBounds.max.y,
            monsterBounds.max.z
          ],
          boundsMin: [
            monsterBounds.min.x,
            monsterBounds.min.y,
            monsterBounds.min.z
          ],
          boundsSize: [
            monsterBoundsSize.x,
            monsterBoundsSize.y,
            monsterBoundsSize.z
          ],
          doubleSidedMaterialCount,
          hasLightMap,
          meshCount,
          targetSize,
          type: monsterType,
          totalTriangleCount,
          uniqueMaterialCount: materialIds.size,
          visible
        }
      },
      getTurnStateSummary: () => ({
        dead: turnStateRef.current.dead,
        escaped: turnStateRef.current.escaped,
        monsters: turnStateRef.current.monsters.map((monster) => ({
          awake: monster.awake,
          cell: { ...monster.cell },
          direction: monster.direction,
          id: monster.id,
          type: monster.type
        })),
        openGateIds: getOpenGateIds(layout.maze, turnStateRef.current),
        player: {
          cell: { ...turnStateRef.current.player.cell },
          direction: turnStateRef.current.player.direction,
          hasSword: turnStateRef.current.player.hasSword,
          hasTrophy: turnStateRef.current.player.hasTrophy
        },
        replayActive: replayActive.current,
        swordState: turnStateRef.current.swordState,
        trophyState: turnStateRef.current.trophyState,
        turn: turnStateRef.current.turn
      }),
      getReflectionProbeState: () => {
        return scene.userData.reflectionProbeState ?? null
      },
      getLensFlareState: () => {
        return scene.userData.lensFlareState ?? null
      },
      setView: (cameraPosition, target) => {
        freeCamera.current = true
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
      delete globalWindow.__levelsjamDebug.getLensFlareState
      delete globalWindow.__levelsjamDebug.getMonsterRenderState
      delete globalWindow.__levelsjamDebug.getTurnStateSummary
      delete globalWindow.__levelsjamDebug.getDebugProgramUniformState
      delete globalWindow.__levelsjamDebug.getReflectionProbeState
      delete globalWindow.__levelsjamDebug.setView
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [camera, gl, scene])

  useFrame((_, delta) => {
    if (!freeCamera.current) {
      if (!playerAnimation.current) {
        const action = replayQueue.current.shift() ?? inputQueue.current.shift()

        if (action) {
          if (action === 'move-forward' || action === 'move-backward') {
            setDisplayedOpenGateIds(getOpenGateIds(layout.maze, turnStateRef.current))
          } else {
            setDisplayedOpenGateIds(getOpenGateIds(layout.maze, turnStateRef.current))
          }

          const result = applyTurnAction(layout.maze, turnStateRef.current, action)
          const previousMinotaur = result.previous.monsters.find(
            (monster) => monster.type === 'minotaur'
          )
          const nextMinotaur = result.state.monsters.find(
            (monster) => monster.type === 'minotaur'
          )

          if (
            previousMinotaur &&
            nextMinotaur &&
            (
              previousMinotaur.cell.x !== nextMinotaur.cell.x ||
              previousMinotaur.cell.y !== nextMinotaur.cell.y
            )
          ) {
            const distanceCells = Math.hypot(
              nextMinotaur.cell.x - result.state.player.cell.x,
              nextMinotaur.cell.y - result.state.player.cell.y
            )
            const amplitude = MathUtils.clamp(
              0.24 / Math.max(distanceCells + 0.5, 1),
              0.012,
              0.06
            )

            cameraShake.current = {
              amplitude,
              endsAt: performance.now() + 1000
            }
          }

          playerAnimation.current = {
            action,
            blocked: Boolean(result.blocked),
            from: result.previous,
            killed: result.killed,
            playerEffect: result.playerEffect,
            startedAt: performance.now(),
            to: result.state
          }
          if (result.playerEffect === 'death' || result.playerEffect === 'sword-strike') {
            if (playerEffectClearTimeout.current !== null) {
              window.clearTimeout(playerEffectClearTimeout.current)
              playerEffectClearTimeout.current = null
            }
            document.body.dataset.playerEffect = result.playerEffect
          }
        }
      }

      const activeAnimation = playerAnimation.current
      let displayState = turnStateRef.current
      let animationAlpha = 1

      if (activeAnimation) {
        animationAlpha = Math.min(
          1,
          (performance.now() - activeAnimation.startedAt) / 250
        )
        displayState = activeAnimation.to

        if (animationAlpha >= 1) {
          const finalState = activeAnimation.killed
            ? resetTurnStateToCheckpoint(layout.maze, activeAnimation.to)
            : activeAnimation.to

          turnStateRef.current = finalState
          setTurnState(finalState)
          playerAnimation.current = null
          setDisplayedOpenGateIds(getOpenGateIds(layout.maze, finalState))

          if (
            activeAnimation.playerEffect === 'death' ||
            activeAnimation.playerEffect === 'sword-strike'
          ) {
            if (playerEffectClearTimeout.current !== null) {
              window.clearTimeout(playerEffectClearTimeout.current)
              playerEffectClearTimeout.current = null
            }

            if (activeAnimation.playerEffect === 'sword-strike') {
              document.body.dataset.playerEffect = 'sword-strike-out'
              playerEffectClearTimeout.current = window.setTimeout(() => {
                if (document.body.dataset.playerEffect === 'sword-strike-out') {
                  delete document.body.dataset.playerEffect
                }
                playerEffectClearTimeout.current = null
              }, 375)
            } else {
              document.body.dataset.playerEffect = 'death-out'
              playerEffectClearTimeout.current = window.setTimeout(() => {
                if (document.body.dataset.playerEffect === 'death-out') {
                  delete document.body.dataset.playerEffect
                }
                playerEffectClearTimeout.current = null
              }, 1000)
            }
          }

          if (replayActive.current && replayQueue.current.length === 0) {
            replayActive.current = false
            onReplayActiveChange(false)
          }
        }
      }

      const fromCell =
        activeAnimation?.from.player.cell ?? displayState.player.cell
      const toCell = displayState.player.cell
      const fromPosition = getMazeCellWorldPosition(layout.maze, fromCell, GROUND_Y + PLAYER_EYE_HEIGHT)
      const toPosition = getMazeCellWorldPosition(layout.maze, toCell, GROUND_Y + PLAYER_EYE_HEIGHT)
      const fromYaw = directionToYaw(
        activeAnimation?.from.player.direction ?? displayState.player.direction
      )
      let toYaw = directionToYaw(displayState.player.direction)
      if (
        activeAnimation &&
        (activeAnimation.action === 'move-forward' || activeAnimation.action === 'move-backward') &&
        !replayActive.current
      ) {
        let queuedTurnSteps = 0

        for (const queuedAction of inputQueue.current) {
          if (queuedAction === 'move-forward' || queuedAction === 'move-backward') {
            break
          }

          queuedTurnSteps += queuedAction === 'rotate-left' ? 1 : -1
        }

        toYaw += queuedTurnSteps * (Math.PI / 2)
      }
      const yawDelta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw))
      if (activeAnimation?.blocked) {
        const moveDirection =
          activeAnimation.action === 'move-backward'
            ? (
                activeAnimation.from.player.direction === 'north'
                  ? 'south'
                  : activeAnimation.from.player.direction === 'south'
                    ? 'north'
                    : activeAnimation.from.player.direction === 'east'
                      ? 'west'
                      : 'east'
              )
            : activeAnimation.from.player.direction
        const bumpOffset = directionToWorldOffset(moveDirection)
        const bumpAlpha = Math.sin(animationAlpha * Math.PI) * BLOCKED_MOVE_FRACTION

        camera.position.set(
          fromPosition.x + (bumpOffset.x * bumpAlpha),
          fromPosition.y,
          fromPosition.z + (bumpOffset.z * bumpAlpha)
        )
      } else {
        camera.position.lerpVectors(fromPosition, toPosition, animationAlpha)
      }
      yaw.current = fromYaw + (yawDelta * animationAlpha)
      pitch.current = DEFAULT_CAMERA_PITCH
      camera.quaternion.setFromEuler(cameraEuler.set(DEFAULT_CAMERA_PITCH, yaw.current, 0, 'YXZ'))
      if (cameraShake.current.endsAt > performance.now()) {
        const remaining = Math.max(0, (cameraShake.current.endsAt - performance.now()) / 1000)
        const envelope = Math.min(1, remaining) * Math.min(1, remaining)
        const timeSeconds = performance.now() / 1000
        const lateral = Math.sin(timeSeconds * 31.3) * cameraShake.current.amplitude * envelope
        const vertical = Math.sin((timeSeconds * 24.7) + 1.3) * cameraShake.current.amplitude * 0.6 * envelope

        cameraShakeOffset.current.set(lateral, vertical, 0)
        cameraShakeOffset.current.applyQuaternion(camera.quaternion)
        camera.position.add(cameraShakeOffset.current)
      }
      camera.updateMatrixWorld()
      return
    }

    camera.getWorldDirection(forward.current)
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.copy(defaultMoveDirection)
    }
    right.current.crossVectors(forward.current, up).normalize()
    keyboardLocal.current.set(
      (Number(Boolean(keys.current.KeyD)) + Number(Boolean(keys.current.ArrowRight))) -
        (Number(Boolean(keys.current.KeyA)) + Number(Boolean(keys.current.ArrowLeft))),
      Number(Boolean(keys.current.KeyQ)) - Number(Boolean(keys.current.KeyE)),
      (Number(Boolean(keys.current.KeyW)) + Number(Boolean(keys.current.ArrowUp))) -
        (Number(Boolean(keys.current.KeyS)) + Number(Boolean(keys.current.ArrowDown)))
    )
    if (keyboardLocal.current.lengthSq() > 1) {
      keyboardLocal.current.normalize()
    }
    camera.position
      .addScaledVector(right.current, keyboardLocal.current.x * resolvedMovementSettings.maxHorizontalSpeed * delta)
      .addScaledVector(up, keyboardLocal.current.y * resolvedMovementSettings.maxHorizontalSpeed * delta)
      .addScaledVector(forward.current, keyboardLocal.current.z * resolvedMovementSettings.maxHorizontalSpeed * delta)
    camera.updateMatrixWorld()
  }, -1)

  useEffect(() => {
    return () => {
      if (playerEffectClearTimeout.current !== null) {
        window.clearTimeout(playerEffectClearTimeout.current)
        playerEffectClearTimeout.current = null
      }
      if (
        document.body.dataset.playerEffect === 'death' ||
        document.body.dataset.playerEffect === 'death-out' ||
        document.body.dataset.playerEffect === 'sword-strike' ||
        document.body.dataset.playerEffect === 'sword-strike-out'
      ) {
        delete document.body.dataset.playerEffect
      }
      onReplayActiveChange(false)
      setDisplayedOpenGateIds([])
    }
  }, [onReplayActiveChange, setDisplayedOpenGateIds])

  return null
}

function Scene({
  composerEnabled,
  controlsOpen,
  layout,
  onAssetsReady,
  onReplayActiveChange,
  replayRequestId,
  visualSettings
}: {
  composerEnabled: boolean
  controlsOpen: boolean
  layout: MazeLayout
  onAssetsReady: () => void
  onReplayActiveChange: (active: boolean) => void
  replayRequestId: number
  visualSettings: VisualSettings
}) {
  recordStartupMarker('sceneRenderStartedAt')
  const [turnState, setTurnState] = useState<TurnState>(() =>
    createInitialTurnState(layout.maze)
  )
  const [displayedOpenGateIds, setDisplayedOpenGateIds] = useState<string[]>([])
  const hasReportedBasicAssetsReady = useRef(false)

  useEffect(() => {
    const nextState = createInitialTurnState(layout.maze)

    setTurnState(nextState)
    setDisplayedOpenGateIds(getOpenGateIds(layout.maze, nextState))
  }, [layout.maze])
  useEffect(() => {
    hasReportedBasicAssetsReady.current = false
  }, [layout.maze.id])
  useEffect(() => {
    recordStartupMarker('sceneMountedAt')
  }, [])

  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const [environmentTexture, setEnvironmentTexture] = useState<Texture | null>(null)
  const [, setEnvironmentFogColor] = useState(() => DEFAULT_FOG_IBL_COLOR.clone())
  const [, setReflectionProbeAmbientColors] = useState<Color[]>([])
  const [reflectionProbeCoefficients, setReflectionProbeCoefficients] = useState<Array<ProbeIrradianceCoefficients | null>>([])
  const [reflectionProbeDepthTextures, setReflectionProbeDepthTextures] = useState<CubeTexture[]>([])
  const [reflectionProbeRawTextures, setReflectionProbeRawTextures] = useState<Texture[]>([])
  const [reflectionProbeTextures, setReflectionProbeTextures] = useState<Texture[]>([])
  const environmentIntensity = BAKED_ENVIRONMENT_INTENSITY
  const playerWorldPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, turnState.player.cell, GROUND_Y),
    [layout.maze, turnState.player.cell.x, turnState.player.cell.y]
  )
  const openGateIds = useMemo(
    () => new Set(displayedOpenGateIds),
    [displayedOpenGateIds]
  )
  const runtimeRadiance = useRuntimeRadianceCascadeSurface(layout, openGateIds)
  const disabledSurfaceLightmapTexture = useMemo(
    () => createBlackLightmapTexture({ encoding: 'linear' }),
    [layout.maze.id]
  )
  const surfaceLightmap = useMemo(
    () => ({
      encoding: 'linear' as const,
      ready: runtimeRadiance.ready,
      texture: disabledSurfaceLightmapTexture
    }),
    [disabledSurfaceLightmapTexture, runtimeRadiance.ready]
  )

  useEffect(
    () => () => {
      disabledSurfaceLightmapTexture.dispose()
    },
    [disabledSurfaceLightmapTexture]
  )

  useEffect(() => {
    let cancelled = false
    let rafId = 0

    const compileScene = async () => {
      recordStartupMarker('sceneTextureWarmStartedAt')
      await warmSceneTextures(gl, scene, () => cancelled)

      if (cancelled) {
        return
      }

      recordStartupMarker('sceneTextureWarmCompleteAt')
      recordStartupMarker('sceneCompileStartedAt')

      gl.compile(scene, camera)

      if (cancelled) {
        return
      }

      if (cancelled || hasReportedBasicAssetsReady.current) {
        return
      }

      recordStartupMarker('sceneCompileCompleteAt')
      hasReportedBasicAssetsReady.current = true
      onAssetsReady()

      if (cancelled) {
        return
      }

      recordStartupMarker('sceneRenderWarmCompleteAt')
    }

    const waitForSceneObjects = () => {
      if (cancelled || hasReportedBasicAssetsReady.current) {
        return
      }

      const probeState = scene.userData.reflectionProbeState as
        | { ready?: boolean }
        | undefined

      if (
        !surfaceLightmap.ready ||
        !getReflectionCaptureSceneState(scene, layout).ready ||
        !probeState?.ready
      ) {
        rafId = window.requestAnimationFrame(waitForSceneObjects)
        return
      }

      void compileScene()
    }

    rafId = window.requestAnimationFrame(waitForSceneObjects)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
    }
  }, [camera, gl, layout, onAssetsReady, scene, surfaceLightmap.ready])

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        clearDebugIsolation?: () => void
        getFogState?: () => {
          density: number | null
          environmentFogColor: [number, number, number] | null
          fogDistance: number | null
          hasProbeAmbientTexture: boolean
          heightFalloff: number | null
          lightingStrength: number | null
          meshCount: number
          noiseFrequency: number | null
          noiseStrength: number | null
          probeAmbientBounds: [number, number, number, number] | null
          probeAmbientGrid: [number, number] | null
          rayStepCount: number | null
          useProbeAmbientTexture: number | null
          useProbeCoefficientTexture?: number | null
          useProbeDepthAtlases?: number | null
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
        getReflectionCaptureSceneState?: () => ReturnType<typeof getReflectionCaptureSceneState>
        getRuntimeRadianceCascadeState?: () => RuntimeRadianceDebugState
        getRuntimeShadowedTorchState?: () => {
          slots: RuntimeShadowSlotDebugState[]
        }
        getRendererStats?: () => {
          calls: number
          frame: number
          lines: number
          points: number
          triangles: number
        }
        getRuntimeMemoryState?: () => {
          estimatedTextureBytes: number
          rendererGeometries: number
          rendererTextures: number
          textureBreakdown?: Array<{
            bytes: number
            height: number | null
            label: string
            uuid: string
            width: number | null
          }>
        }
        bakeReflectionProbeAssets?: (
          probeIndex: number,
          size?: number
        ) => {
          depthAtlas: string[] | null
          geometryAtlas: string[] | null
          processedAtlas: string[] | null
          processedCubeUvRgbE: {
            dataUrl: string | null
            height: number
            width: number
          } | null
          rawAtlas: string[] | null
          rawRgbEAtlas: string[] | null
        } | null
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    const debugRoots = [scene]
    let restoreDebugIsolation = () => {}
    const pmremFromCubemap = (renderer: WebGLRenderer, texture: Texture) => {
      const generator = new PMREMGenerator(renderer)

      try {
        generator.compileCubemapShader()
        return generator.fromCubemap(texture)
      } finally {
        generator.dispose()
      }
    }

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
      return scene.userData.fogEffectState ?? {
        density: null,
        environmentFogColor: null,
        fogDistance: null,
        hasProbeAmbientTexture: false,
        heightFalloff: null,
        lightingStrength: null,
        meshCount: 0,
        noiseFrequency: null,
        noisePeriod: null,
        noiseStrength: null,
        probeAmbientBounds: null,
        probeAmbientGrid: null,
        rayStepCount: null,
        useProbeAmbientTexture: null,
        useProbeCoefficientTexture: null,
        useProbeDepthAtlases: null
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

    const getReflectionCaptureSceneStateDebug = () =>
      getReflectionCaptureSceneState(scene, layout)

    const getTextureImageInfo = (texture: Texture | null | undefined) => {
      if (!texture) {
        return {
          bytes: 0,
          height: null,
          width: null
        }
      }

      const image = texture.image ?? (
        texture as Texture & {
          source?: {
            data?: {
              data?: ArrayBufferView
              height?: number
              width?: number
            }
          }
        }
      ).source?.data

      if (Array.isArray(image)) {
        let height: number | null = null
        let width: number | null = null
        const bytes = image.reduce((total, face) => {
          if (face?.data && 'byteLength' in face.data) {
            height = typeof face.height === 'number' ? face.height : height
            width = typeof face.width === 'number' ? face.width : width
            return total + face.data.byteLength
          }

          if (
            typeof face?.width === 'number' &&
            typeof face?.height === 'number'
          ) {
            height = face.height
            width = face.width
            return total + (face.width * face.height * 4)
          }

          return total
        }, 0)

        return { bytes, height, width }
      }

      if (image?.data && 'byteLength' in image.data) {
        return {
          bytes: image.data.byteLength,
          height: typeof image.height === 'number' ? image.height : null,
          width: typeof image.width === 'number' ? image.width : null
        }
      }

      if (
        typeof image?.width === 'number' &&
        typeof image?.height === 'number'
      ) {
        const baseBytes = image.width * image.height * 4
        return {
          bytes: texture.generateMipmaps
            ? Math.round(baseBytes * 1.33)
            : baseBytes,
          height: image.height,
          width: image.width
        }
      }

      return {
        bytes: 0,
        height: null,
        width: null
      }
    }

    const getRuntimeMemoryState = () => {
      const textures = new Map<string, { label: string, texture: Texture }>()
      const addTexture = (texture: Texture | null | undefined, label: string) => {
        if (texture) {
          textures.set(texture.uuid, { label, texture })
        }
      }

      scene.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return
        }

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]

        for (const material of materials) {
          if (!(material instanceof Material)) {
            continue
          }

          for (const [key, value] of Object.entries(material as Record<string, unknown>)) {
            if (value instanceof Texture) {
              const debugRole = typeof object.userData?.debugRole === 'string'
                ? object.userData.debugRole
                : 'mesh'
              addTexture(value, `${debugRole}.${key}`)
            }
          }
        }
      })

      addTexture(environmentTexture, 'environmentTexture')
      for (const [index, texture] of reflectionProbeRawTextures.entries()) {
        addTexture(texture, `reflectionProbeRawTextures.${index}`)
      }
      for (const [index, texture] of reflectionProbeTextures.entries()) {
        addTexture(texture, `reflectionProbeTextures.${index}`)
      }
      for (const [index, texture] of reflectionProbeDepthTextures.entries()) {
        addTexture(texture, `reflectionProbeDepthTextures.${index}`)
      }

      let estimatedTextureBytes = 0
      const textureBreakdown: Array<{
        bytes: number
        height: number | null
        label: string
        uuid: string
        width: number | null
      }> = []

      for (const { label, texture } of textures.values()) {
        const imageInfo = getTextureImageInfo(texture)
        estimatedTextureBytes += imageInfo.bytes
        textureBreakdown.push({
          bytes: imageInfo.bytes,
          height: imageInfo.height,
          label,
          uuid: texture.uuid,
          width: imageInfo.width
        })
      }

      return {
        estimatedTextureBytes,
        rendererGeometries: gl.info.memory.geometries,
        rendererTextures: gl.info.memory.textures,
        textureBreakdown: textureBreakdown
          .sort((left, right) => right.bytes - left.bytes)
          .slice(0, 40)
      }
    }

    const bakeReflectionProbeAssets = (probeIndex: number, size = 32) => {
      const probe = layout.reflectionProbes[probeIndex]
      const backgroundTexture = scene.background instanceof Texture
        ? scene.background
        : null
      const captureEnvironmentTexture = environmentTexture ?? backgroundTexture

      if (!probe || size <= 0 || !captureEnvironmentTexture) {
        return null
      }

      const captureSceneState = getReflectionCaptureSceneState(scene, layout)

      if (!captureSceneState.ready) {
        return null
      }

      const hiddenObjects: Array<{ object: { visible: boolean }, visible: boolean }> = []
      const savedBackground = scene.background
      const savedBackgroundIntensity = scene.backgroundIntensity
      const savedEnvironment = scene.environment
      const savedEnvironmentIntensity = scene.environmentIntensity
      const savedOverrideMaterial = scene.overrideMaterial
      const captureTarget = new WebGLCubeRenderTarget(size, {
        type: HalfFloatType
      })
      const captureCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, captureTarget)
      const depthTarget = new WebGLCubeRenderTarget(size, {
        type: UnsignedByteType
      })
      const depthCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, depthTarget)
      const depthMaterial = createLinearDistancePackingMaterial(REFLECTION_PROBE_FAR)
      let processedTarget: { dispose: () => void; texture: Texture } | null = null

      captureCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )
      captureCamera.layers.enable(TORCH_BILLBOARD_LAYER)
      depthCamera.position.copy(captureCamera.position)

      scene.traverse((object) => {
        if (
          object.userData?.debugRole === 'torch-lens-flare' ||
          object.userData?.debugRole === 'global-fog-volume' ||
          object.userData?.debugRole === 'reflection-probe-visual' ||
          object.userData?.debugRole === 'torch-billboard' ||
          isOfflineBakeExcludedObject(object)
        ) {
          hiddenObjects.push({ object, visible: object.visible })
          object.visible = false
        }
      })

      scene.background = savedBackground
      scene.backgroundIntensity = BAKED_ENVIRONMENT_INTENSITY
      scene.environment = captureEnvironmentTexture
      scene.environmentIntensity = environmentIntensity

      try {
        scene.add(captureCamera)
        captureCamera.update(gl, scene)
        scene.remove(captureCamera)

        processedTarget = pmremFromCubemap(gl, captureTarget.texture)
        const processedTextureInfo = getCubeUvTextureInfo(processedTarget.texture)
        const processedCubeUvRgbE = processedTextureInfo
          ? {
              dataUrl: captureTexture2DEncodedDataUrl(
                gl,
                processedTarget.texture,
                processedTarget.texture.image.width,
                processedTarget.texture.image.height
              ),
              height: processedTarget.texture.image.height,
              width: processedTarget.texture.image.width
            }
          : null

        scene.background = new Color('black')
        scene.backgroundIntensity = 1
        scene.environment = null
        scene.environmentIntensity = 1
        scene.overrideMaterial = depthMaterial
        scene.add(depthCamera)
        depthCamera.update(gl, scene)
        scene.remove(depthCamera)

        return {
          depthAtlas: captureCubeTextureAtlasDataUrls(gl, depthTarget.texture, size, {
            applyColorSpaceTransform: false
          }),
          geometryAtlas: captureReflectionProbeGeometryAtlas(probeIndex, size),
          processedAtlas: captureCubeUvTextureAtlasDataUrls(
            gl,
            processedTarget.texture,
            size
          ),
          processedCubeUvRgbE,
          rawAtlas: captureCubeTextureAtlasDataUrls(gl, captureTarget.texture, size, {
            applyColorSpaceTransform: false
          }),
          rawRgbEAtlas: captureCubeTextureEncodedAtlasDataUrls(
            gl,
            captureTarget.texture,
            size
          )
        }
      } finally {
        scene.background = savedBackground
        scene.backgroundIntensity = savedBackgroundIntensity
        scene.environment = savedEnvironment
        scene.environmentIntensity = savedEnvironmentIntensity
        scene.overrideMaterial = savedOverrideMaterial
        depthMaterial.dispose()
        depthTarget.dispose()
        captureTarget.dispose()
        processedTarget?.dispose()
        scene.remove(captureCamera)
        scene.remove(depthCamera)
        for (const entry of hiddenObjects) {
          entry.object.visible = entry.visible
        }
      }
    }

    const captureReflectionProbeAtlas = (probeIndex: number, size = 128) => {
      const probeTexture = reflectionProbeRawTextures[probeIndex]

      if (size <= 0) {
        return null
      }

      if (!probeTexture) {
        return bakeReflectionProbeAssets(probeIndex, size)?.rawAtlas ?? null
      }

      return captureCubeTextureAtlasDataUrls(gl, probeTexture, size)
    }

    const captureReflectionProbeProcessedAtlas = (probeIndex: number, size = 128) => {
      const probeTexture = reflectionProbeTextures[probeIndex]

      if (size <= 0) {
        return null
      }

      if (!probeTexture) {
        return bakeReflectionProbeAssets(probeIndex, size)?.processedAtlas ?? null
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
          object.userData?.debugRole === 'torch-billboard' ||
          isOfflineBakeExcludedObject(object)
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

        return captureCubeTextureAtlasDataUrls(gl, geometryTarget.texture, size)
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
      bakeReflectionProbeAssets,
      captureReflectionProbeAtlas,
      captureReflectionProbeProcessedAtlas,
      captureReflectionProbeGeometryAtlas,
      captureReflectionProbeWallMaterialContinuum,
      clearDebugIsolation,
      getFogState,
      getReflectionCaptureSceneState: getReflectionCaptureSceneStateDebug,
      getRuntimeRadianceCascadeState: () => ({
        ...runtimeRadiance.debug,
        shadowSlots:
          globalWindow.__levelsjamDebug?.getRuntimeShadowedTorchState?.().slots ?? []
      }),
      getRendererStats: () => ({
        calls: gl.info.render.calls,
        frame: gl.info.render.frame,
        lines: gl.info.render.lines,
        points: gl.info.render.points,
        triangles: gl.info.render.triangles
      }),
      getRuntimeMemoryState,
      getReflectionProbeTextureState,
      isolateDebugRole,
      setDebugVisible
    }

    return () => {
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      clearDebugIsolation()
      delete globalWindow.__levelsjamDebug.bakeReflectionProbeAssets
      delete globalWindow.__levelsjamDebug.captureReflectionProbeAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeProcessedAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeGeometryAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeWallMaterialContinuum
      delete globalWindow.__levelsjamDebug.clearDebugIsolation
      delete globalWindow.__levelsjamDebug.getFogState
      delete globalWindow.__levelsjamDebug.getReflectionCaptureSceneState
      delete globalWindow.__levelsjamDebug.getRuntimeRadianceCascadeState
      delete globalWindow.__levelsjamDebug.getRendererStats
      delete globalWindow.__levelsjamDebug.getRuntimeMemoryState
      delete globalWindow.__levelsjamDebug.getReflectionProbeTextureState
      delete globalWindow.__levelsjamDebug.setDebugVisible
      delete globalWindow.__levelsjamDebug.isolateDebugRole
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [environmentIntensity, environmentTexture, gl, layout, reflectionProbeDepthTextures, reflectionProbeRawTextures, reflectionProbeTextures, runtimeRadiance.debug, scene])

  const ambientOcclusionActive = isAmbientOcclusionActive(visualSettings)
  const bloomActive = isEffectActive(visualSettings.bloom)
  const depthOfFieldActive = isDepthOfFieldActive(visualSettings.depthOfField)
  const lensFlareActive = isEffectActive(visualSettings.lensFlare)
  const fogAmbientColor = useMemo(
    () => colorFromHex(visualSettings.volumetricAmbientHex),
    [visualSettings.volumetricAmbientHex]
  )
  const probeCoefficientTextures = EMPTY_PROBE_COEFFICIENT_TEXTURES
  const probeCoefficients = EMPTY_PROBE_COEFFICIENTS
  const probeDepthAtlasTextures = EMPTY_PROBE_DEPTH_ATLAS_TEXTURES
  const vignetteActive = isEffectActive(visualSettings.vignette)

  return (
    <>
      <EnvironmentLighting
        layout={layout}
        priorityPosition={{
          x: playerWorldPosition.x,
          z: playerWorldPosition.z
        }}
        volumetricLighting={visualSettings.volumetricLighting}
        onEnvironmentFogColorChange={setEnvironmentFogColor}
        onEnvironmentTextureChange={setEnvironmentTexture}
        onReflectionProbeAmbientColorsChange={setReflectionProbeAmbientColors}
        onReflectionProbeCoefficientsChange={setReflectionProbeCoefficients}
        onReflectionProbeDepthTexturesChange={setReflectionProbeDepthTextures}
        onReflectionProbeRawTexturesChange={setReflectionProbeRawTextures}
        onReflectionProbeTexturesChange={setReflectionProbeTextures}
      />
      <VolumetricShadowContext.Provider value={false}>
        <RuntimeShadowedTorchLights
          layout={layout}
          openGateIds={openGateIds}
          playerWorldPosition={playerWorldPosition}
          visualIntensity={getEnabledContributionIntensity(visualSettings.lightmapContribution)}
        />
        <SceneGeometry
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={0}
          layout={layout}
          lightmapContributionIntensity={getEnabledContributionIntensity(visualSettings.lightmapContribution)}
          openGateIds={openGateIds}
          probeDebugMode={visualSettings.probeDebugMode}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionProbeCoefficients={probeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionContributionIntensity={getEnabledContributionIntensity(visualSettings.reflectionContribution)}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
          staticVolumetricContributionIntensity={0}
          surfaceLightmap={surfaceLightmap}
          turnState={turnState}
        />
        <MonsterActors
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          iblContributionIntensity={0}
          layout={layout}
          lightmapContributionIntensity={getEnabledContributionIntensity(visualSettings.lightmapContribution)}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={getEnabledContributionIntensity(visualSettings.reflectionContribution)}
          reflectionProbeCoefficients={probeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          runtimeRadiance={runtimeRadiance}
          turnState={turnState}
        />
        {composerEnabled ? (
      <EffectComposer
        enableNormalPass
        multisampling={0}
        resolutionScale={0.5}
      >
        {visualSettings.ssr.enabled ? (
          <SSRPassPrimitive settings={visualSettings.ssr} />
        ) : null}
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
        {visualSettings.volumetricLighting.enabled ? (
          <FogVolume
            ambientColor={fogAmbientColor}
            fogDistance={visualSettings.volumetricDistance}
            heightFalloff={visualSettings.volumetricHeightFalloff}
            layout={layout}
            lightingStrength={visualSettings.volumetricLightingStrength}
            noiseFrequency={visualSettings.volumetricNoiseFrequency}
            noisePeriod={visualSettings.volumetricNoisePeriod}
            noiseStrength={visualSettings.volumetricNoiseStrength}
            rayStepCount={visualSettings.volumetricStepCount}
            runtimeRadiance={runtimeRadiance}
            runtimeRadianceIntensity={getEnabledContributionIntensity(visualSettings.lightmapContribution)}
            visible={visualSettings.volumetricLighting.enabled}
            volumeIntensity={visualSettings.volumetricLighting.intensity}
          />
        ) : null}
        <BillboardCompositePass />
        {depthOfFieldActive ? (
          <DepthOfField
            bokehScale={visualSettings.depthOfField.bokehScale}
            focalLength={visualSettings.depthOfField.focalLength}
            focusDistance={visualSettings.depthOfField.focusDistance}
            resolutionScale={visualSettings.depthOfField.resolutionScale}
          />
        ) : null}
        {bloomActive ? (
          <BloomEffectPrimitive settings={visualSettings.bloom} />
        ) : null}
        {visualSettings.anamorphic.enabled ? (
          <AnamorphicEffectPrimitive settings={visualSettings.anamorphic} />
        ) : null}
        {lensFlareActive ? (
          <TorchLensFlare
            settings={visualSettings.lensFlare}
            layout={layout}
          />
        ) : null}
        <PlayerFadeEffectPrimitive />
        {vignetteActive ? (
          <AnimatedVignette settings={visualSettings.vignette} />
        ) : null}
        <ExposureEffectPrimitive
          exposure={getRendererExposure(visualSettings.exposureStops)}
          noiseIntensity={visualSettings.vignette.exposureNoiseIntensity}
          noisePeriod={visualSettings.vignette.noisePeriod}
        />
        <ToneMapping
          mode={TONE_MAPPING_MODES[visualSettings.toneMapping]}
          resolution={256}
        />
        <DitherEffectPrimitive />
      </EffectComposer>
        ) : null}
        <FlightRig
          layout={layout}
          movementSettings={visualSettings.movement}
          onReplayActiveChange={onReplayActiveChange}
          replayRequestId={replayRequestId}
          setDisplayedOpenGateIds={setDisplayedOpenGateIds}
          setTurnState={setTurnState}
          turnState={turnState}
          wallBounds={getWallBounds(layout)}
        />
        <PerformanceBenchmarkBridge />
        <StartupReporter />
      </VolumetricShadowContext.Provider>
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

function FogAmbientColorControl({
  onChange,
  onReset,
  value
}: {
  onChange: (value: string) => void
  onReset: () => void
  value: string
}) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  const commitDraftValue = () => {
    const normalized = normalizeHexColor(draftValue, value)

    setDraftValue(normalized)
    onChange(normalized)
  }

  return (
    <div className="visual-control-row">
      <output>{value.toUpperCase()}</output>
      <ResettableLabel onReset={onReset}>
        Fog Ambient Color
      </ResettableLabel>
      <div className="visual-inline-controls">
        <input
          aria-label="Fog Ambient Color Hex"
          className="visual-color-text-input"
          onBlur={commitDraftValue}
          onChange={(event) => {
            setDraftValue(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraftValue()
            }
          }}
          spellCheck={false}
          type="text"
          value={draftValue}
        />
        <input
          aria-label="Fog Ambient Color Picker"
          onChange={(event) => {
            const normalized = normalizeHexColor(event.target.value, value)

            setDraftValue(normalized)
            onChange(normalized)
          }}
          type="color"
          value={normalizeHexColor(value)}
        />
      </div>
    </div>
  )
}

function VisualControls({
  onAnamorphicSettingChange,
  onAmbientOcclusionModeChange,
  onBooleanSettingChange,
  onBloomSettingChange,
  controlsOpen,
  onDepthOfFieldSettingChange,
  onEffectSettingChange,
  onFogAmbientHexChange,
  onLensFlareSettingChange,
  onProbeDebugModeChange,
  onResetAnamorphicSettings,
  onResetAmbientOcclusionMode,
  onResetBloomSettings,
  onResetBooleanSetting,
  onResetDepthOfFieldSettings,
  onResetEffectSetting,
  onResetFogAmbientHex,
  onResetLensFlareSettings,
  onResetProbeDebugMode,
  onResetScalarSetting,
  onResetSsrSettings,
  onResetToneMapping,
  onReplaySolution,
  onScalarSettingChange,
  onSsrSettingChange,
  onToneMappingChange,
  replayActive,
  replayAvailable,
  visualSettings
}: {
  onAnamorphicSettingChange: (patch: Partial<AnamorphicSettings>) => void
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
  onFogAmbientHexChange: (value: string) => void
  onLensFlareSettingChange: (patch: Partial<LensFlareSettings>) => void
  onProbeDebugModeChange: (value: ProbeDebugMode) => void
  onResetAnamorphicSettings: () => void
  onResetAmbientOcclusionMode: () => void
  onResetBloomSettings: () => void
  onResetBooleanSetting: (key: BooleanSettingKey) => void
  onResetDepthOfFieldSettings: () => void
  onResetEffectSetting: (effect: GenericEffectSettingKey) => void
  onResetFogAmbientHex: () => void
  onResetLensFlareSettings: () => void
  onResetProbeDebugMode: () => void
  onResetScalarSetting: (key: ScalarSettingKey) => void
  onResetSsrSettings: () => void
  onResetToneMapping: () => void
  onReplaySolution: () => void
  onScalarSettingChange: (key: ScalarSettingKey, value: number) => void
  onSsrSettingChange: (patch: Partial<SSRSettings>) => void
  onToneMappingChange: (value: ToneMappingMode) => void
  replayActive: boolean
  replayAvailable: boolean
  visualSettings: VisualSettings
}) {
  const [activeTab, setActiveTab] = useState<VisualControlTabKey>('core')

  useEffect(() => {
    if (!controlsOpen) {
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const tab = VISUAL_CONTROL_TABS.find((option) => option.hotkey === event.key)

      if (!tab) {
        return
      }

      event.preventDefault()
      setActiveTab(tab.key)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [controlsOpen])

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
    { key: 'volumetricLighting', label: 'Volumetric Fog', min: 0, max: 1, step: 0.01 }
  ]
  const renderEffectControl = (effectControl: (typeof effectControls)[number]) => {
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
  }

  return (
    <aside
      className="visual-controls"
      data-testid="visual-controls"
    >
      <div className="visual-controls-header">
        <strong>Visual Controls</strong>
        <span>Press ` to close</span>
      </div>
      <div className="visual-control-tabs">
        {VISUAL_CONTROL_TABS.map((tab) => (
          <button
            className={`visual-control-tab${activeTab === tab.key ? ' visual-control-tab-active' : ''}`}
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
            }}
            type="button"
          >
            {tab.hotkey}. {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'core' ? (
        <>
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
        <output>{visualSettings.cameraFov.toFixed(0)}°</output>
        <ResettableLabel onReset={() => onResetScalarSetting('cameraFov')}>
          Camera FOV
        </ResettableLabel>
        <input
          aria-label="Camera FOV"
          max={120}
          min={30}
          onChange={(event) => {
            onScalarSettingChange('cameraFov', Number(event.target.value))
          }}
          step={1}
          type="range"
          value={visualSettings.cameraFov}
        />
          </label>

          <div className="visual-control-row">
        <output>
          {visualSettings.lightmapContribution.enabled
            ? `${visualSettings.lightmapContribution.intensity.toFixed(2)}x`
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            aria-label="Runtime Radiance Enabled"
            checked={visualSettings.lightmapContribution.enabled}
            onChange={(event) => {
              onBooleanSettingChange('lightmapContributionEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetScalarSetting('lightmapContributionIntensity')}>
            Runtime Radiance
          </ResettableLabel>
        </label>
        <input
          aria-label="Runtime Radiance"
          disabled={!visualSettings.lightmapContribution.enabled}
          max={MAX_LIGHTING_CONTRIBUTION_INTENSITY}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('lightmapContributionIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.lightmapContribution.intensity}
        />
          </div>

          <div className="visual-control-row">
        <output>
          {visualSettings.reflectionContribution.enabled
            ? `${visualSettings.reflectionContribution.intensity.toFixed(2)}x`
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            aria-label="Reflection Intensity Enabled"
            checked={visualSettings.reflectionContribution.enabled}
            onChange={(event) => {
              onBooleanSettingChange('reflectionContributionEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetScalarSetting('reflectionContributionIntensity')}>
            Reflection Intensity
          </ResettableLabel>
        </label>
        <input
          aria-label="Reflection Intensity"
          disabled={!visualSettings.reflectionContribution.enabled}
          max={MAX_LIGHTING_CONTRIBUTION_INTENSITY}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('reflectionContributionIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.reflectionContribution.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>
          {PROBE_DEBUG_MODE_OPTIONS.find(
            (option) => option.key === visualSettings.probeDebugMode
          )?.label ?? visualSettings.probeDebugMode}
        </output>
        <ResettableLabel onReset={onResetProbeDebugMode}>
          Probe Debug
        </ResettableLabel>
        <select
          aria-label="Probe Debug"
          onChange={(event) => {
            onProbeDebugModeChange(event.target.value as ProbeDebugMode)
          }}
          value={visualSettings.probeDebugMode}
        >
          {PROBE_DEBUG_MODE_OPTIONS.map((option) => (
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
        </>
      ) : null}

      {activeTab === 'ao' ? (
        <>
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
        </>
      ) : null}

      {activeTab === 'bloom' ? (
        <>
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
          <ResettableLabel onReset={() => {
            onResetBloomSetting('enabled')
            onResetBloomSetting('intensity')
          }}>
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
        <ResettableLabel onReset={() => onResetBloomSetting('kernelSize')}>
          Bloom Kernel
        </ResettableLabel>
        <select
          aria-label="Bloom Kernel"
          disabled={!visualSettings.bloom.enabled}
          onChange={(event) => {
            const kernelSize = event.target.value as BloomKernelSizeKey
            onBloomSettingChange({
              kernelSize,
              resolutionScale: BLOOM_RESOLUTION_SCALES[kernelSize]
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

          <label className="visual-control-row">
        <output>{visualSettings.bloom.threshold.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetBloomSetting('threshold')}>
          Bloom Threshold
        </ResettableLabel>
        <input
          aria-label="Bloom Threshold"
          disabled={!visualSettings.bloom.enabled}
          max={2}
          min={0}
          onChange={(event) => {
            onBloomSettingChange({
              threshold: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.bloom.threshold}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.bloom.smoothing.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetBloomSetting('smoothing')}>
          Bloom Smoothing
        </ResettableLabel>
        <input
          aria-label="Bloom Smoothing"
          disabled={!visualSettings.bloom.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onBloomSettingChange({
              smoothing: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.bloom.smoothing}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.bloom.resolutionScale.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetBloomSetting('resolutionScale')}>
          Bloom Resolution
        </ResettableLabel>
        <input
          aria-label="Bloom Resolution"
          disabled={!visualSettings.bloom.enabled}
          max={1}
          min={0.1}
          onChange={(event) => {
            onBloomSettingChange({
              resolutionScale: Number(event.target.value)
            })
          }}
          step={0.05}
          type="range"
          value={visualSettings.bloom.resolutionScale}
        />
          </label>
        </>
      ) : null}

      {activeTab === 'dof' ? (
        <>
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
          <ResettableLabel onReset={() => {
            onResetDepthOfFieldSetting('enabled')
            onResetDepthOfFieldSetting('bokehScale')
          }}>
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
        <ResettableLabel onReset={() => onResetDepthOfFieldSetting('focusDistance')}>
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
        <ResettableLabel onReset={() => onResetDepthOfFieldSetting('focalLength')}>
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
        <output>{visualSettings.depthOfField.resolutionScale.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetDepthOfFieldSetting('resolutionScale')}>
          DOF Resolution
        </ResettableLabel>
        <input
          aria-label="DOF Resolution"
          disabled={!visualSettings.depthOfField.enabled}
          max={1}
          min={0.1}
          onChange={(event) => {
            onDepthOfFieldSettingChange({
              resolutionScale: Number(event.target.value)
            })
          }}
          step={0.05}
          type="range"
          value={visualSettings.depthOfField.resolutionScale}
        />
          </label>
        </>
      ) : null}

      {activeTab === 'fog' ? (
        <>
          {renderEffectControl(effectControls.find((effectControl) => effectControl.key === 'volumetricLighting')!)}
          <FogAmbientColorControl
            onChange={onFogAmbientHexChange}
            onReset={onResetFogAmbientHex}
            value={visualSettings.volumetricAmbientHex}
          />

          <label className="visual-control-row">
        <output>{visualSettings.volumetricDistance.toFixed(1)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricDistance')}>
          Fog Distance
        </ResettableLabel>
        <input
          aria-label="Fog Distance"
          max={40}
          min={0}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricDistance',
              Number(event.target.value)
            )
          }}
          step={0.5}
          type="range"
          value={visualSettings.volumetricDistance}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricNoiseFrequency.toFixed(2)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricNoiseFrequency')}>
          Fog Noise Frequency
        </ResettableLabel>
        <input
          aria-label="Fog Noise Frequency"
          max={10}
          min={0}
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

          <label className="visual-control-row">
        <output>{visualSettings.volumetricNoisePeriod.toFixed(2)}s</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricNoisePeriod')}>
          Fog Noise Period
        </ResettableLabel>
        <input
          aria-label="Fog Noise Period"
          max={10}
          min={0}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricNoisePeriod',
              Number(event.target.value)
            )
          }}
          step={0.05}
          type="range"
          value={visualSettings.volumetricNoisePeriod}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricNoiseStrength.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricNoiseStrength')}>
          Fog Noise Strength
        </ResettableLabel>
        <input
          aria-label="Fog Noise Strength"
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricNoiseStrength',
              Number(event.target.value)
            )
          }}
          step={0.01}
          type="range"
          value={visualSettings.volumetricNoiseStrength}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricHeightFalloff.toFixed(2)}m</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricHeightFalloff')}>
          Fog Height 50%
        </ResettableLabel>
        <input
          aria-label="Fog Height 50%"
          max={8}
          min={0.01}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricHeightFalloff',
              Number(event.target.value)
            )
          }}
          step={0.01}
          type="range"
          value={visualSettings.volumetricHeightFalloff}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricLightingStrength.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricLightingStrength')}>
          Fog Lighting Strength
        </ResettableLabel>
        <input
          aria-label="Fog Lighting Strength"
          max={2}
          min={0}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricLightingStrength',
              Number(event.target.value)
            )
          }}
          step={0.01}
          type="range"
          value={visualSettings.volumetricLightingStrength}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricStepCount.toFixed(0)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricStepCount')}>
          Fog Step Count
        </ResettableLabel>
        <input
          aria-label="Fog Step Count"
          max={24}
          min={1}
          onChange={(event) => {
            onScalarSettingChange(
              'volumetricStepCount',
              Number(event.target.value)
            )
          }}
          step={1}
          type="range"
          value={visualSettings.volumetricStepCount}
        />
          </label>
        </>
      ) : null}

      {activeTab === 'flares' ? (
        <>
          <div className="visual-control-row">
        <output>
          {visualSettings.lensFlare.enabled
            ? visualSettings.lensFlare.intensity.toFixed(3)
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.enabled}
            onChange={(event) => {
              onLensFlareSettingChange({
                enabled: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => {
            onResetLensFlareSetting('enabled')
            onResetLensFlareSetting('intensity')
          }}>
            Lens Flares
          </ResettableLabel>
        </label>
        <input
          aria-label="Lens Flares Intensity"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              intensity: Number(event.target.value)
            })
          }}
          step={0.0005}
          type="range"
          value={visualSettings.lensFlare.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.opacity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('opacity')}>
          Flare Opacity
        </ResettableLabel>
        <input
          aria-label="Flare Opacity"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              opacity: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.lensFlare.opacity}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.flareSize.toFixed(4)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('flareSize')}>
          Flare Size
        </ResettableLabel>
        <input
          aria-label="Flare Size"
          disabled={!visualSettings.lensFlare.enabled}
          max={0.05}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              flareSize: Number(event.target.value)
            })
          }}
          step={0.0005}
          type="range"
          value={visualSettings.lensFlare.flareSize}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.glareSize.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('glareSize')}>
          Glare Size
        </ResettableLabel>
        <input
          aria-label="Glare Size"
          disabled={!visualSettings.lensFlare.enabled}
          max={0.4}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              glareSize: Number(event.target.value)
            })
          }}
          step={0.005}
          type="range"
          value={visualSettings.lensFlare.glareSize}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.ghostScale.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('ghostScale')}>
          Ghost Scale
        </ResettableLabel>
        <input
          aria-label="Ghost Scale"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              ghostScale: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.lensFlare.ghostScale}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.haloScale.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('haloScale')}>
          Halo Scale
        </ResettableLabel>
        <input
          aria-label="Halo Scale"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              haloScale: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.lensFlare.haloScale}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.flareShape.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('flareShape')}>
          Flare Shape
        </ResettableLabel>
        <input
          aria-label="Flare Shape"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              flareShape: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.lensFlare.flareShape}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.flareSpeed.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('flareSpeed')}>
          Flare Speed
        </ResettableLabel>
        <input
          aria-label="Flare Speed"
          disabled={!visualSettings.lensFlare.enabled}
          max={0.1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              flareSpeed: Number(event.target.value)
            })
          }}
          step={0.001}
          type="range"
          value={visualSettings.lensFlare.flareSpeed}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.starPoints}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('starPoints')}>
          Star Points
        </ResettableLabel>
        <input
          aria-label="Star Points"
          disabled={!visualSettings.lensFlare.enabled}
          max={12}
          min={3}
          onChange={(event) => {
            onLensFlareSettingChange({
              starPoints: Number(event.target.value)
            })
          }}
          step={1}
          type="range"
          value={visualSettings.lensFlare.starPoints}
        />
          </label>

          <div className="visual-control-row">
        <output>{visualSettings.lensFlare.animated ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.animated}
            onChange={(event) => {
              onLensFlareSettingChange({
                animated: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetLensFlareSetting('animated')}>
            Animated
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.lensFlare.anamorphic ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.anamorphic}
            onChange={(event) => {
              onLensFlareSettingChange({
                anamorphic: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetLensFlareSetting('anamorphic')}>
            Flare Anamorphic
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.lensFlare.aditionalStreaks ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.aditionalStreaks}
            onChange={(event) => {
              onLensFlareSettingChange({
                aditionalStreaks: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetLensFlareSetting('aditionalStreaks')}>
            Extra Streaks
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.lensFlare.secondaryGhosts ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.secondaryGhosts}
            onChange={(event) => {
              onLensFlareSettingChange({
                secondaryGhosts: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetLensFlareSetting('secondaryGhosts')}>
            Secondary Ghosts
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.lensFlare.starBurst ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.lensFlare.starBurst}
            onChange={(event) => {
              onLensFlareSettingChange({
                starBurst: event.target.checked
              })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetLensFlareSetting('starBurst')}>
            Star Burst
          </ResettableLabel>
        </label>
          </div>
        </>
      ) : null}

      {activeTab === 'ssr' ? (
        <>
          <div className="visual-control-row">
        <output>
          {visualSettings.ssr.enabled ? visualSettings.ssr.intensity.toFixed(2) : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ enabled: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => {
            onResetSsrSetting('enabled')
            onResetSsrSetting('intensity')
          }}>
            SSR
          </ResettableLabel>
        </label>
        <input
          aria-label="SSR Intensity"
          disabled={!visualSettings.ssr.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onSsrSettingChange({ intensity: Number(event.target.value) })
          }}
          step={0.01}
          type="range"
          value={visualSettings.ssr.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.ssr.maxDistance.toFixed(1)}m</output>
        <ResettableLabel onReset={() => onResetSsrSetting('maxDistance')}>
          SSR Distance
        </ResettableLabel>
        <input
          aria-label="SSR Distance"
          disabled={!visualSettings.ssr.enabled}
          max={40}
          min={1}
          onChange={(event) => {
            onSsrSettingChange({ maxDistance: Number(event.target.value) })
          }}
          step={0.5}
          type="range"
          value={visualSettings.ssr.maxDistance}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.ssr.thickness.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetSsrSetting('thickness')}>
          SSR Thickness
        </ResettableLabel>
        <input
          aria-label="SSR Thickness"
          disabled={!visualSettings.ssr.enabled}
          max={4}
          min={0.01}
          onChange={(event) => {
            onSsrSettingChange({ thickness: Number(event.target.value) })
          }}
          step={0.01}
          type="range"
          value={visualSettings.ssr.thickness}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.ssr.resolutionScale.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetSsrSetting('resolutionScale')}>
          SSR Resolution
        </ResettableLabel>
        <input
          aria-label="SSR Resolution"
          disabled={!visualSettings.ssr.enabled}
          max={1}
          min={0.25}
          onChange={(event) => {
            onSsrSettingChange({ resolutionScale: Number(event.target.value) })
          }}
          step={0.05}
          type="range"
          value={visualSettings.ssr.resolutionScale}
        />
          </label>

          <label className="visual-control-row">
        <output>
          {SSR_OUTPUT_OPTIONS.find(
            (option) => option.key === visualSettings.ssr.output
          )?.label ?? visualSettings.ssr.output}
        </output>
        <ResettableLabel onReset={() => onResetSsrSetting('output')}>
          SSR Output
        </ResettableLabel>
        <select
          aria-label="SSR Output"
          disabled={!visualSettings.ssr.enabled}
          onChange={(event) => {
            onSsrSettingChange({
              output: event.target.value as SSRPassOutputMode
            })
          }}
          value={visualSettings.ssr.output}
        >
          {SSR_OUTPUT_OPTIONS.map((option) => (
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
        <output>{visualSettings.ssr.blur ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.blur}
            disabled={!visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ blur: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetSsrSetting('blur')}>
            SSR Blur
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.ssr.bouncing ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.bouncing}
            disabled={!visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ bouncing: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetSsrSetting('bouncing')}>
            SSR Bouncing
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.ssr.distanceAttenuation ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.distanceAttenuation}
            disabled={!visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ distanceAttenuation: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetSsrSetting('distanceAttenuation')}>
            SSR Distance Attenuation
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.ssr.fresnel ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.fresnel}
            disabled={!visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ fresnel: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetSsrSetting('fresnel')}>
            SSR Fresnel
          </ResettableLabel>
        </label>
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.ssr.infiniteThick ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.ssr.infiniteThick}
            disabled={!visualSettings.ssr.enabled}
            onChange={(event) => {
              onSsrSettingChange({ infiniteThick: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetSsrSetting('infiniteThick')}>
            SSR Infinite Thick
          </ResettableLabel>
        </label>
          </div>
        </>
      ) : null}

      {activeTab === 'vignette' ? (
        <>
          <div className="visual-control-row">
        <output>
          {visualSettings.vignette.enabled
            ? visualSettings.vignette.intensity.toFixed(2)
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.vignette.enabled}
            onChange={(event) => {
              onEffectSettingChange('vignette', { enabled: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => {
            onResetEffectSetting('vignette')
          }}>
            Vignette
          </ResettableLabel>
        </label>
        <input
          aria-label="Vignette Intensity"
          disabled={!visualSettings.vignette.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('vignetteIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.vignette.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.vignette.noisePeriod.toFixed(2)}s</output>
        <ResettableLabel onReset={() => onResetScalarSetting('vignetteNoisePeriod')}>
          Vignette Noise Period
        </ResettableLabel>
        <input
          aria-label="Vignette Noise Period"
          disabled={!visualSettings.vignette.enabled}
          max={10}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('vignetteNoisePeriod', Number(event.target.value))
          }}
          step={0.1}
          type="range"
          value={visualSettings.vignette.noisePeriod}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.vignette.noiseIntensity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('vignetteNoiseIntensity')}>
          Vignette Noise Intensity
        </ResettableLabel>
        <input
          aria-label="Vignette Noise Intensity"
          disabled={!visualSettings.vignette.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('vignetteNoiseIntensity', Number(event.target.value))
          }}
          step={0.01}
          type="range"
          value={visualSettings.vignette.noiseIntensity}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.vignette.exposureNoiseIntensity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('vignetteExposureNoiseIntensity')}>
          Exposure Noise Intensity
        </ResettableLabel>
        <input
          aria-label="Exposure Noise Intensity"
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('vignetteExposureNoiseIntensity', Number(event.target.value))
          }}
          step={0.01}
          type="range"
          value={visualSettings.vignette.exposureNoiseIntensity}
        />
          </label>
        </>
      ) : null}

      {activeTab === 'anamorphic' ? (
        <>
          <div className="visual-control-row">
        <output>
          {visualSettings.anamorphic.enabled
            ? visualSettings.anamorphic.intensity.toFixed(2)
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.anamorphic.enabled}
            onChange={(event) => {
              onAnamorphicSettingChange({ enabled: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => {
            onResetAnamorphicSetting('enabled')
            onResetAnamorphicSetting('intensity')
          }}>
            Anamorphic
          </ResettableLabel>
        </label>
        <input
          aria-label="Anamorphic Intensity"
          disabled={!visualSettings.anamorphic.enabled}
          max={2}
          min={0}
          onChange={(event) => {
            onAnamorphicSettingChange({ intensity: Number(event.target.value) })
          }}
          step={0.01}
          type="range"
          value={visualSettings.anamorphic.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.anamorphic.threshold.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetAnamorphicSetting('threshold')}>
          Anamorphic Threshold
        </ResettableLabel>
        <input
          aria-label="Anamorphic Threshold"
          disabled={!visualSettings.anamorphic.enabled}
          max={2}
          min={0}
          onChange={(event) => {
            onAnamorphicSettingChange({ threshold: Number(event.target.value) })
          }}
          step={0.01}
          type="range"
          value={visualSettings.anamorphic.threshold}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.anamorphic.scale.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetAnamorphicSetting('scale')}>
          Anamorphic Scale
        </ResettableLabel>
        <input
          aria-label="Anamorphic Scale"
          disabled={!visualSettings.anamorphic.enabled}
          max={8}
          min={0.5}
          onChange={(event) => {
            onAnamorphicSettingChange({ scale: Number(event.target.value) })
          }}
          step={0.1}
          type="range"
          value={visualSettings.anamorphic.scale}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.anamorphic.samples}</output>
        <ResettableLabel onReset={() => onResetAnamorphicSetting('samples')}>
          Anamorphic Samples
        </ResettableLabel>
        <input
          aria-label="Anamorphic Samples"
          disabled={!visualSettings.anamorphic.enabled}
          max={64}
          min={4}
          onChange={(event) => {
            onAnamorphicSettingChange({ samples: Number(event.target.value) })
          }}
          step={1}
          type="range"
          value={visualSettings.anamorphic.samples}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.anamorphic.colorGain.toFixed(2)}x</output>
        <ResettableLabel onReset={onResetAnamorphicSettings}>
          Anamorphic Color Gain
        </ResettableLabel>
        <input
          aria-label="Anamorphic Color Gain"
          disabled={!visualSettings.anamorphic.enabled}
          max={4}
          min={0}
          onChange={(event) => {
            onAnamorphicSettingChange({ colorGain: Number(event.target.value) })
          }}
          step={0.05}
          type="range"
          value={visualSettings.anamorphic.colorGain}
        />
          </label>
        </>
      ) : null}

      {activeTab === 'solution' ? (
        <div className="visual-control-row">
          <output>{replayActive ? 'running' : replayAvailable ? 'ready' : 'none'}</output>
          <ResettableLabel onReset={onReplaySolution}>
            Replay Solution
          </ResettableLabel>
          <button
            disabled={!replayAvailable || replayActive}
            onClick={onReplaySolution}
            type="button"
          >
            Replay solution
          </button>
        </div>
      ) : null}
    </aside>
  )
}

function CreditsModal({
  open
}: {
  open: boolean
}) {
  if (!open) {
    return null
  }

  return (
    <div className="credits-modal" role="dialog" aria-modal="true" aria-label="Credits">
      <div className="credits-panel">
        <h2>Credits</h2>
        <p>
          "Minotaur" (<a href="https://skfb.ly/6TK77">https://skfb.ly/6TK77</a>) by yanbelmont is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "PBR Jumping Spider Monster" (<a href="https://skfb.ly/6QVNq">https://skfb.ly/6QVNq</a>) by Toast is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "AWIL Werewolf" (<a href="https://skfb.ly/orBtB">https://skfb.ly/orBtB</a>) by Spinnee is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "Head of a Bull" (<a href="https://skfb.ly/6TOXX">https://skfb.ly/6TOXX</a>) by Kirk Hiatt is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "Metal Gate" (<a href="https://skfb.ly/oK7QR">https://skfb.ly/oK7QR</a>) by i bull your wife is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "Bronze Sword Mycean" (<a href="https://skfb.ly/6RZxG">https://skfb.ly/6RZxG</a>) by Ryoce is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <small>Press any key to close.</small>
      </div>
    </div>
  )
}

export default function App() {
  const [controlsOpen, setControlsOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const availableMazeIdsRef = useRef<string[]>([])
  const loadedMazeLayoutsRef = useRef(new Map<string, MazeLayout>())
  const memoryHighWaterRef = useRef({
    estimatedTextureBytes: 0,
    jsHeapBytes: 0,
    rendererGeometries: 0,
    rendererTextures: 0
  })
  const requestedMazeId = useMemo(
    () => new URLSearchParams(window.location.search).get('maze'),
    []
  )
  const [instantiatedMazeId, setInstantiatedMazeId] = useState<string | null>(null)
  const [mazeLayout, setMazeLayout] = useState<MazeLayout | null>(null)
  const [mazeLoadError, setMazeLoadError] = useState<string | null>(null)
  const [replayActive, setReplayActive] = useState(false)
  const [replayRequestId, setReplayRequestId] = useState(0)
  const [mazeSceneKey, setMazeSceneKey] = useState(0)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [renderLoopActive, setRenderLoopActive] = useState(false)
  const [visualSettings, setVisualSettings] = useState(createDefaultVisualSettings)
  const composerEnabled = true

  useEffect(() => {
    document.getElementById('bootstrap-loading-shell')?.remove()
  }, [])

  useEffect(() => {
    void getAvailableMazeIds()
      .then((mazeIds) => {
        availableMazeIdsRef.current = mazeIds
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  const instantiateLoadedMaze = (mazeId: string) => {
    const nextLayout = loadedMazeLayoutsRef.current.get(mazeId)

    if (!nextLayout) {
      throw new Error(`Maze data "${mazeId}" has not been loaded`)
    }

    setReplayActive(false)
    setSceneLoaded(false)
    setMazeLoadError(null)
    setInstantiatedMazeId(mazeId)
    setMazeSceneKey((current) => current + 1)
    setMazeLayout(nextLayout)
    document.body.dataset.loadedMazeId = mazeId
  }

  const uninstantiateMaze = () => {
    setReplayActive(false)
    setSceneLoaded(false)
    setInstantiatedMazeId(null)
    setMazeLayout(null)
  }

  const resetInstantiatedMaze = () => {
    if (!mazeLayout) {
      return
    }

    setReplayActive(false)
    setSceneLoaded(false)
    setMazeSceneKey((current) => current + 1)
  }

  useEffect(() => {
    let cancelled = false

    const loadLayout = async () => {
      setSceneLoaded(false)
      setMazeLoadError(null)
      document.body.dataset.mazeLayoutRequestedAt = performance.now().toFixed(1)
      document.body.dataset.requestedMazeId = requestedMazeId ?? 'random'

      try {
        const nextLayout = requestedMazeId
          ? await loadMazeLayoutById(requestedMazeId)
          : await loadRandomMazeLayout()

        if (requestedMazeId && !nextLayout) {
          throw new Error(`Requested maze "${requestedMazeId}" could not be loaded`)
        }
        if (!nextLayout) {
          throw new Error('No maze layout could be loaded')
        }

        if (!cancelled) {
          document.body.dataset.mazeLayoutLoadedAt = performance.now().toFixed(1)
          document.body.dataset.loadedMazeId = nextLayout.maze.id
          loadedMazeLayoutsRef.current.set(nextLayout.maze.id, nextLayout)
          setInstantiatedMazeId(nextLayout.maze.id)
          setReplayActive(false)
          setMazeLayout(nextLayout)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error)
          document.body.dataset.mazeLayoutLoadFailedAt = performance.now().toFixed(1)
          document.body.dataset.mazeLayoutLoadError = message
          setMazeLayout(null)
          setMazeLoadError(message)
        }
      }
    }

    void loadLayout()

    return () => {
      cancelled = true
      document.body.dataset.mazeLayoutCancelledAt = performance.now().toFixed(1)
    }
  }, [requestedMazeId])

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        getMazeLifecycleState?: () => {
          availableMazeIds: string[]
          cachedGltfRootUrls: string[]
          error: string | null
          instantiatedMazeId: string | null
          loadedMazeIds: string[]
          persistedLayoutCacheIds: string[]
          replayActive: boolean
          sceneLoaded: boolean
        }
        getRuntimeMemoryState?: () => {
          estimatedTextureBytes: number
          rendererGeometries: number
          rendererTextures: number
        } | null
        getRuntimeMemoryHighWater?: () => {
          current: {
            estimatedTextureBytes: number
            jsHeapBytes: number | null
            rendererGeometries: number
            rendererTextures: number
          }
          highWater: {
            estimatedTextureBytes: number
            jsHeapBytes: number
            rendererGeometries: number
            rendererTextures: number
          }
        }
        instantiateMaze?: (id: string) => boolean
        loadMazeData?: (id: string) => Promise<boolean>
        resetMaze?: () => boolean
        startSolutionReplay?: () => boolean
        uninstantiateMaze?: () => boolean
        unloadMazeData?: (id: string) => boolean
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}
    const readCurrentMemory = () => {
      const runtimeMemory = globalWindow.__levelsjamDebug?.getRuntimeMemoryState?.() ?? null
      const jsHeapBytes =
        'memory' in performance &&
        performance.memory &&
        typeof performance.memory.usedJSHeapSize === 'number'
          ? performance.memory.usedJSHeapSize
          : null
      const current = {
        estimatedTextureBytes: runtimeMemory?.estimatedTextureBytes ?? 0,
        jsHeapBytes,
        rendererGeometries: runtimeMemory?.rendererGeometries ?? 0,
        rendererTextures: runtimeMemory?.rendererTextures ?? 0
      }

      memoryHighWaterRef.current = {
        estimatedTextureBytes: Math.max(
          memoryHighWaterRef.current.estimatedTextureBytes,
          current.estimatedTextureBytes
        ),
        jsHeapBytes: Math.max(
          memoryHighWaterRef.current.jsHeapBytes,
          current.jsHeapBytes ?? 0
        ),
        rendererGeometries: Math.max(
          memoryHighWaterRef.current.rendererGeometries,
          current.rendererGeometries
        ),
        rendererTextures: Math.max(
          memoryHighWaterRef.current.rendererTextures,
          current.rendererTextures
        )
      }

      return current
    }
    const intervalId = window.setInterval(() => {
      readCurrentMemory()
    }, 2000)

    globalWindow.__levelsjamDebug = {
      ...existing,
      getMazeLifecycleState: () => ({
        availableMazeIds: [...availableMazeIdsRef.current],
        cachedGltfRootUrls: getCachedGltfRootUrls(),
        error: mazeLoadError,
        instantiatedMazeId,
        loadedMazeIds: Array.from(loadedMazeLayoutsRef.current.keys()).sort(),
        persistedLayoutCacheIds: getLoadedMazeLayoutIds(),
        replayActive,
        sceneLoaded
      }),
      getRuntimeMemoryHighWater: () => ({
        current: readCurrentMemory(),
        highWater: { ...memoryHighWaterRef.current }
      }),
      instantiateMaze: (id) => {
        instantiateLoadedMaze(id)
        return true
      },
      loadMazeData: async (id) => {
        const layout = await loadMazeLayoutById(id)

        if (!layout) {
          return false
        }

        loadedMazeLayoutsRef.current.set(id, layout)
        return true
      },
      resetMaze: () => {
        resetInstantiatedMaze()
        return true
      },
      startSolutionReplay: () => {
        if (!mazeLayout?.maze.solution?.actions?.length) {
          return false
        }

        setReplayRequestId((current) => current + 1)
        return true
      },
      uninstantiateMaze: () => {
        uninstantiateMaze()
        return true
      },
      unloadMazeData: (id) => {
        if (instantiatedMazeId === id) {
          uninstantiateMaze()
        }

        loadedMazeLayoutsRef.current.delete(id)
        unloadMazeLayoutById(id)
        return true
      }
    }

    return () => {
      window.clearInterval(intervalId)

      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getMazeLifecycleState
      delete globalWindow.__levelsjamDebug.getRuntimeMemoryHighWater
      delete globalWindow.__levelsjamDebug.instantiateMaze
      delete globalWindow.__levelsjamDebug.loadMazeData
      delete globalWindow.__levelsjamDebug.resetMaze
      delete globalWindow.__levelsjamDebug.startSolutionReplay
      delete globalWindow.__levelsjamDebug.uninstantiateMaze
      delete globalWindow.__levelsjamDebug.unloadMazeData
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [instantiatedMazeId, mazeLoadError, replayActive, sceneLoaded, mazeLayout])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (creditsOpen) {
        event.preventDefault()
        setCreditsOpen(false)
        return
      }

      if (event.code === OVERLAY_TOGGLE_CODE) {
        event.preventDefault()
        setOverlayVisible((visible) => !visible)
        return
      }

      if (event.code === 'KeyC') {
        event.preventDefault()
        setCreditsOpen(true)
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
  }, [creditsOpen])

  const onScalarSettingChange = (key: ScalarSettingKey, value: number) => {
    setVisualSettings((current) => {
      if (key === 'iblContributionIntensity') {
        return {
          ...current,
          iblContribution: {
            ...current.iblContribution,
            intensity: value
          }
        }
      }

      if (key === 'lightmapContributionIntensity') {
        return {
          ...current,
          lightmapContribution: {
            ...current.lightmapContribution,
            intensity: value
          }
        }
      }

      if (key === 'reflectionContributionIntensity') {
        return {
          ...current,
          reflectionContribution: {
            ...current.reflectionContribution,
            intensity: value
          }
        }
      }

      if (key === 'staticVolumetricContributionIntensity') {
        return {
          ...current,
          staticVolumetricContribution: {
            ...current.staticVolumetricContribution,
            intensity: value
          }
        }
      }

      if (key === 'vignetteIntensity') {
        return {
          ...current,
          vignette: {
            ...current.vignette,
            intensity: value
          }
        }
      }

      if (key === 'vignetteNoisePeriod') {
        return {
          ...current,
          vignette: {
            ...current.vignette,
            noisePeriod: value
          }
        }
      }

      if (key === 'vignetteNoiseIntensity') {
        return {
          ...current,
          vignette: {
            ...current.vignette,
            noiseIntensity: value
          }
        }
      }

      if (key === 'vignetteExposureNoiseIntensity') {
        return {
          ...current,
          vignette: {
            ...current.vignette,
            exposureNoiseIntensity: value
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

  const onAnamorphicSettingChange = (patch: Partial<AnamorphicSettings>) => {
    setVisualSettings((current) => ({
      ...current,
      anamorphic: {
        ...current.anamorphic,
        ...patch
      }
    }))
  }

  const onSsrSettingChange = (patch: Partial<SSRSettings>) => {
    setVisualSettings((current) => ({
      ...current,
      ssr: {
        ...current.ssr,
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

  const onLensFlareSettingChange = (patch: Partial<LensFlareSettings>) => {
    setVisualSettings((current) => ({
      ...current,
      lensFlare: {
        ...current.lensFlare,
        ...patch
      }
    }))
  }

  const onFogAmbientHexChange = (value: string) => {
    setVisualSettings((current) => ({
      ...current,
      volumetricAmbientHex: normalizeHexColor(value, current.volumetricAmbientHex)
    }))
  }

  const onProbeDebugModeChange = (value: ProbeDebugMode) => {
    setVisualSettings((current) => ({
      ...current,
      probeDebugMode: value
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
    setVisualSettings((current) => {
      if (key === 'iblContributionEnabled') {
        return {
          ...current,
          iblContribution: {
            ...current.iblContribution,
            enabled: value
          }
        }
      }

      if (key === 'lightmapContributionEnabled') {
        return {
          ...current,
          lightmapContribution: {
            ...current.lightmapContribution,
            enabled: value
          }
        }
      }

      if (key === 'reflectionContributionEnabled') {
        return {
          ...current,
          reflectionContribution: {
            ...current.reflectionContribution,
            enabled: value
          }
        }
      }

      if (key === 'staticVolumetricContributionEnabled') {
        return {
          ...current,
          staticVolumetricContribution: {
            ...current.staticVolumetricContribution,
            enabled: value
          }
        }
      }

      return {
        ...current,
        [key]: value
      }
    })
  }

  const onResetScalarSetting = (key: ScalarSettingKey) => {
    const defaults = createDefaultVisualSettings()

    if (key === 'iblContributionIntensity') {
      onScalarSettingChange(key, defaults.iblContribution.intensity)
      return
    }

    if (key === 'lightmapContributionIntensity') {
      onScalarSettingChange(key, defaults.lightmapContribution.intensity)
      return
    }

    if (key === 'reflectionContributionIntensity') {
      onScalarSettingChange(key, defaults.reflectionContribution.intensity)
      return
    }

    if (key === 'staticVolumetricContributionIntensity') {
      onScalarSettingChange(key, defaults.staticVolumetricContribution.intensity)
      return
    }

    if (key === 'vignetteIntensity') {
      onScalarSettingChange(key, defaults.vignette.intensity)
      return
    }

    if (key === 'vignetteNoisePeriod') {
      onScalarSettingChange(key, defaults.vignette.noisePeriod)
      return
    }

    if (key === 'vignetteNoiseIntensity') {
      onScalarSettingChange(key, defaults.vignette.noiseIntensity)
      return
    }

    if (key === 'vignetteExposureNoiseIntensity') {
      onScalarSettingChange(key, defaults.vignette.exposureNoiseIntensity)
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

  const onResetAnamorphicSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      anamorphic: {
        ...defaults.anamorphic
      }
    }))
  }

  const onResetBloomSetting = (key: keyof BloomSettings) => {
    const defaults = createDefaultVisualSettings()

    onBloomSettingChange({
      [key]: defaults.bloom[key]
    })
  }

  const onResetDepthOfFieldSetting = (key: keyof DepthOfFieldSettings) => {
    const defaults = createDefaultVisualSettings()

    onDepthOfFieldSettingChange({
      [key]: defaults.depthOfField[key]
    })
  }

  const onResetLensFlareSetting = (key: keyof LensFlareSettings) => {
    const defaults = createDefaultVisualSettings()

    onLensFlareSettingChange({
      [key]: defaults.lensFlare[key]
    })
  }

  const onResetSsrSetting = (key: keyof SSRSettings) => {
    const defaults = createDefaultVisualSettings()

    onSsrSettingChange({
      [key]: defaults.ssr[key]
    })
  }

  const onResetAnamorphicSetting = (key: keyof AnamorphicSettings) => {
    const defaults = createDefaultVisualSettings()

    onAnamorphicSettingChange({
      [key]: defaults.anamorphic[key]
    })
  }

  const onResetSsrSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      ssr: {
        ...defaults.ssr
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

  const onResetLensFlareSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      lensFlare: {
        ...defaults.lensFlare
      }
    }))
  }

  const onResetFogAmbientHex = () => {
    const defaults = createDefaultVisualSettings()

    onFogAmbientHexChange(defaults.volumetricAmbientHex)
  }

  const onResetProbeDebugMode = () => {
    const defaults = createDefaultVisualSettings()

    onProbeDebugModeChange(defaults.probeDebugMode)
  }

  const onResetBooleanSetting = (key: BooleanSettingKey) => {
    const defaults = createDefaultVisualSettings()

    if (key === 'iblContributionEnabled') {
      onBooleanSettingChange(key, defaults.iblContribution.enabled)
      return
    }

    if (key === 'lightmapContributionEnabled') {
      onBooleanSettingChange(key, defaults.lightmapContribution.enabled)
      return
    }

    if (key === 'reflectionContributionEnabled') {
      onBooleanSettingChange(key, defaults.reflectionContribution.enabled)
      return
    }

    if (key === 'staticVolumetricContributionEnabled') {
      onBooleanSettingChange(key, defaults.staticVolumetricContribution.enabled)
      return
    }

    onBooleanSettingChange(key, defaults[key])
  }

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamGetVisualSettings?: () => VisualSettings
      __levelsjamResetVisualSettings?: () => void
      __levelsjamSetVisualSettings?: (patch: VisualSettingsPatch) => void
      __levelsjamDebug?: {
        getVisualSettings?: () => VisualSettings
        resetVisualSettings?: () => void
        setVisualSettings?: (patch: VisualSettingsPatch) => void
      }
    }
    const existing = globalWindow.__levelsjamDebug ?? {}

    globalWindow.__levelsjamDebug = {
      ...existing,
      getVisualSettings: () => visualSettings,
      resetVisualSettings: () => {
        setVisualSettings(createDefaultVisualSettings())
      },
      setVisualSettings: (patch) => {
        setVisualSettings((current) => applyVisualSettingsPatch(current, patch))
      }
    }
    globalWindow.__levelsjamGetVisualSettings = () => visualSettings
    globalWindow.__levelsjamResetVisualSettings = () => {
      setVisualSettings(createDefaultVisualSettings())
    }
    globalWindow.__levelsjamSetVisualSettings = (patch) => {
      setVisualSettings((current) => applyVisualSettingsPatch(current, patch))
    }

    return () => {
      delete globalWindow.__levelsjamGetVisualSettings
      delete globalWindow.__levelsjamResetVisualSettings
      delete globalWindow.__levelsjamSetVisualSettings
      if (!globalWindow.__levelsjamDebug) {
        return
      }

      delete globalWindow.__levelsjamDebug.getVisualSettings
      delete globalWindow.__levelsjamDebug.resetVisualSettings
      delete globalWindow.__levelsjamDebug.setVisualSettings
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [visualSettings])

  const onAssetsReady = useCallback(() => {
    recordStartupMarker('sceneAssetsReadyAt')
    setSceneLoaded(true)
  }, [])

  useEffect(() => {
    if (!sceneLoaded) {
      setRenderLoopActive(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setRenderLoopActive(true)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [sceneLoaded])

  if (!mazeLayout) {
    return (
      <div className="app-shell">
        {mazeLoadError
          ? (
            <div className="loading-overlay visible">
              <div className="loading-panel">
                <div className="loading-title">MINOTAUR</div>
                <div className="loading-subtitle">Failed to load the labyrinth.</div>
                <small>{mazeLoadError}</small>
              </div>
            </div>
            )
          : <LoadingOverlay complete={false} />}
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
      <CreditsModal open={creditsOpen} />
      <VisualControls
        controlsOpen={controlsOpen}
        onAnamorphicSettingChange={onAnamorphicSettingChange}
        onAmbientOcclusionModeChange={onAmbientOcclusionModeChange}
        onBooleanSettingChange={onBooleanSettingChange}
        onBloomSettingChange={onBloomSettingChange}
        onDepthOfFieldSettingChange={onDepthOfFieldSettingChange}
        onEffectSettingChange={onEffectSettingChange}
        onFogAmbientHexChange={onFogAmbientHexChange}
        onLensFlareSettingChange={onLensFlareSettingChange}
        onProbeDebugModeChange={onProbeDebugModeChange}
        onResetAnamorphicSettings={onResetAnamorphicSettings}
        onResetAmbientOcclusionMode={onResetAmbientOcclusionMode}
        onResetBloomSettings={onResetBloomSettings}
        onResetBooleanSetting={onResetBooleanSetting}
        onResetDepthOfFieldSettings={onResetDepthOfFieldSettings}
        onResetEffectSetting={onResetEffectSetting}
        onResetFogAmbientHex={onResetFogAmbientHex}
        onResetLensFlareSettings={onResetLensFlareSettings}
        onResetProbeDebugMode={onResetProbeDebugMode}
        onResetScalarSetting={onResetScalarSetting}
        onResetSsrSettings={onResetSsrSettings}
        onResetToneMapping={onResetToneMapping}
        onReplaySolution={() => {
          if (mazeLayout?.maze.solution?.actions?.length) {
            setReplayRequestId((current) => current + 1)
          }
        }}
        onScalarSettingChange={onScalarSettingChange}
        onSsrSettingChange={onSsrSettingChange}
        onToneMappingChange={onToneMappingChange}
        replayActive={replayActive}
        replayAvailable={Boolean(mazeLayout.maze.solution?.actions?.length)}
        visualSettings={visualSettings}
      />
      <div
        className={`viewport-shell${sceneLoaded ? ' viewport-shell-ready' : ''}`}
        style={{ transitionDuration: `${LOADING_FADE_DURATION_MS}ms` }}
      >
        <Canvas
          camera={{
            far: 400,
            fov: visualSettings.cameraFov,
            near: 0.1,
            position: [
              PLAYER_SPAWN_POSITION.x,
              PLAYER_SPAWN_POSITION.y + 1.5,
              PLAYER_SPAWN_POSITION.z
            ]
          }}
          dpr={[1, 2]}
          frameloop={renderLoopActive ? 'always' : 'never'}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            recordStartupMarker('canvasCreatedAt')
            gl.debug.checkShaderErrors = false
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
            cameraFov={visualSettings.cameraFov}
            composerEnabled={composerEnabled}
            exposureStops={visualSettings.exposureStops}
            toneMapping={visualSettings.toneMapping}
          />
          <Suspense fallback={null}>
            <Scene
              composerEnabled={composerEnabled}
              controlsOpen={controlsOpen}
              key={`${mazeLayout.maze.id}:${mazeSceneKey}`}
              layout={mazeLayout}
              onAssetsReady={onAssetsReady}
              onReplayActiveChange={setReplayActive}
              replayRequestId={replayRequestId}
              visualSettings={visualSettings}
            />
          </Suspense>
          <FpsReporter onSample={setFps} />
        </Canvas>
      </div>
    </div>
  )
}
