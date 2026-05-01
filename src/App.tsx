import {
  DepthOfField,
  EffectComposer,
  LensFlareEffect as PostLensFlareEffect,
  N8AO,
  SSAO,
  ToneMapping
} from '@react-three/postprocessing'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import {
  BasicShadowMap,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Camera as ThreeCamera,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  CubeCamera,
  CubeTexture,
  CubeUVReflectionMapping,
  Data3DTexture,
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
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshPhysicalMaterial as ThreeMeshPhysicalMaterial,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  NoBlending,
  NoToneMapping,
  NeutralToneMapping,
  NoColorSpace,
  Object3D,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RedFormat,
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
  useLayoutEffect,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
  useRef,
  useState
} from 'react'
import {
  BlendFunction,
  Effect,
  EffectComposer as PostEffectComposer,
  EffectAttribute,
  EffectPass,
  Pass,
  ToneMappingMode as PostToneMappingMode,
  VignetteEffect
} from 'postprocessing'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { UnrealBloomPass as ThreeUnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SSRPass as ThreeSSRPass } from 'three/addons/postprocessing/SSRPass.js'
import {
  AUTHORED_LIGHTING_SOURCE_SCALE,
  DEFAULT_EXPOSURE_STOPS,
  getHdrLightingIntensity,
  getRendererExposure
} from './lib/lightingCalibration.js'
import {
  getAdjacentRuntimeLevelIds,
  getDefaultRuntimeLevelId,
  getLatestDirectedNonMazeLevelId,
  getRuntimeLevelWorldTransform,
  parseLevelSpec,
  resolveRuntimeMazeIdForLevel,
  type AuthoredLevel
} from './lib/levels.js'
import { getAdjacentLevelVisibleCellKeys } from './lib/levelVisibility.js'
import levelsMarkdown from '../LEVELS.md?raw'
import defaultVisualSettingsConfig from './visual-settings.defaults.json'
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
  getRuntimeLevelMenuEntries,
  getLoadedMazeLayoutIds,
  getWallBounds,
  unloadMazeLayoutById,
  loadMazeLayoutById,
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
import { mapGroundWorldToLightmapLocalUv } from './lib/groundLightmapUv.js'
import {
  buildGroundReflectionProbeRects,
  getReflectionProbeBlendForPosition
} from './lib/reflectionProbeBlending.js'
import {
  cellKey,
  createInitialTurnState,
  getNeighbor,
  getOpenDoorIds,
  getOpenGateIds,
  normalizeEdge,
  resetTurnStateToCheckpoint,
  type CardinalDirection,
  type MazeCell,
  type TurnAction,
  type TurnMonster,
  type TurnState
} from './lib/turnRules.js'
import {
  activateGlobalTurnStateLevel,
  applyGlobalTurnActionForLevel,
  createEnteredGlobalTurnState,
  createInitialGlobalTurnState,
  ensureGlobalTurnStateLevel,
  ensureGlobalTurnStateLevels,
  findIngressCellForGlobalTransition,
  getGlobalTurnStateForLevel,
  replaceGlobalTurnStateForLevel,
  resetGlobalTurnStateLevel,
  transitionGlobalTurnState,
  type GlobalTurnState
} from './lib/globalTurnRules.js'
import {
  clearGameSave,
  createGameSave,
  readGameSave,
  writeGameSave
} from './lib/saveGame.js'
import { cloneCachedGltfRoot, getCachedGltfRootUrls, loadCachedGltfRoot } from './lib/gltfRuntimeCache'

declare const __GIT_BRANCH__: string
declare const __GIT_REVISION__: string
declare const __GIT_REVISION_TIMESTAMP__: string

const assetBase = import.meta.env.BASE_URL
const ENVIRONMENT_URL = `${assetBase}textures/environment/qwantani_moon_noon_puresky_2k.exr`
const TITLE_IMAGE_URL = `${assetBase}textures/title.png`
const SUBTITLE_IMAGE_URL = `${assetBase}textures/subtitle.png`
const MUSIC_TRACK_URLS = {
  chamber: `${assetBase}music/Timebender.ogg`,
  hallway: `${assetBase}music/Mystery Manor.mp3`,
  maze: `${assetBase}music/radakan - mist forest.mp3`,
  throne: `${assetBase}music/stone_guardian_loop.mp3`
} as const
const SFX_URLS = {
  beastDie: `${assetBase}sfx/beast-die.mp3`,
  beastKillPlayer: `${assetBase}sfx/beast-kill-player.mp3`,
  beastProximityLoop: `${assetBase}sfx/beast-proximity-loop.mp3`,
  gateClose: `${assetBase}sfx/gate-close.mp3`,
  gateOpen: `${assetBase}sfx/gate-open.mp3`,
  monsterStomp: `${assetBase}sfx/monster-stomp.mp3`,
  spiderDie: `${assetBase}sfx/spider-die.mp3`,
  spiderKillPlayer: `${assetBase}sfx/spider-kill-player.mp3`,
  spiderProximityLoop: `${assetBase}sfx/spider-proximity-loop.mp3`,
  torchFireLoop: `${assetBase}sfx/torch-fire-loop.mp3`,
  wetFootsteps: `${assetBase}sfx/wet-footsteps.mp3`
} as const
const SFX_LABELS = {
  beastDie: 'Beast Death',
  beastKillPlayer: 'Beast Kills Player',
  beastProximityLoop: 'Beast Proximity Loop',
  gateClose: 'Gate Close',
  gateOpen: 'Gate Open',
  monsterStomp: 'Monster Stomp',
  spiderDie: 'Spider Death',
  spiderKillPlayer: 'Spider Kills Player',
  spiderProximityLoop: 'Spider Proximity Loop',
  torchFireLoop: 'Torch Fire Loop',
  wetFootsteps: 'Wet Footsteps'
} satisfies Record<keyof typeof SFX_URLS, string>
const FIRE_FLIPBOOK_URL =
  `${assetBase}textures/fire/CampFire_l_nosmoke_front_Loop_01_4K_6x6.png`
const MONSTER_MODEL_URLS = {
  minotaur: `${assetBase}models/minotaur-runtime/scene.gltf`,
  spider: `${assetBase}models/pbr_jumping_spider_monster_runtime/scene.gltf`,
  werewolf: `${assetBase}models/pale_dread_white_werewolf_runtime/scene.gltf`
} as const
const GATE_MODEL_URL = `${assetBase}models/metal_gate_runtime/scene.gltf`
const SWORD_MODEL_URL = `${assetBase}models/bronze_sword_mycean/scene.gltf`
const TROPHY_MODEL_URL = `${assetBase}models/head_of_a_bull_runtime/scene.gltf`
const DROOP_CUP_MODEL_URL = `${assetBase}models/droop_cup_runtime/scene.gltf`
const RUNTIME_MODEL_URLS = [
  GATE_MODEL_URL,
  SWORD_MODEL_URL,
  TROPHY_MODEL_URL,
  DROOP_CUP_MODEL_URL,
  MONSTER_MODEL_URLS.minotaur,
  MONSTER_MODEL_URLS.spider,
  MONSTER_MODEL_URLS.werewolf
] as const
const STARTUP_CRITICAL_RUNTIME_MODEL_URLS = [
  GATE_MODEL_URL,
  SWORD_MODEL_URL,
  TROPHY_MODEL_URL
] as const
const startupCriticalRuntimeModelPreloadPromise = Promise.all(
  STARTUP_CRITICAL_RUNTIME_MODEL_URLS.map((url) => loadCachedGltfRoot(url))
)
let backgroundRuntimeModelPreloadPromise: Promise<unknown[]> | null = null

function preloadBackgroundRuntimeModels() {
  if (!backgroundRuntimeModelPreloadPromise) {
    backgroundRuntimeModelPreloadPromise = Promise.all(
      RUNTIME_MODEL_URLS.map((url) => loadCachedGltfRoot(url))
    )
  }

  return backgroundRuntimeModelPreloadPromise
}

function preloadBackgroundRuntimeModelsAfterIntro() {
  return new Promise<unknown[]>((resolve, reject) => {
    onIntroFadeTriggered(() => {
      preloadBackgroundRuntimeModels().then(resolve, reject)
    })
  })
}

void startupCriticalRuntimeModelPreloadPromise.catch(() => {
  // Scene readiness reports the actual load error from the component effect.
})
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
const DOOR_TEXTURE_URLS = {
  ao: `${assetBase}textures/runtime/minoan-door/minoan_door_left_orm.png`,
  color: `${assetBase}textures/runtime/minoan-door/minoan_door_left_basecolor.png`,
  normal: `${assetBase}textures/runtime/minoan-door/minoan_door_left_normal.png`,
  orm: `${assetBase}textures/runtime/minoan-door/minoan_door_left_orm.png`
}
const FRESCO_DECAL_URLS = [
  `${assetBase}textures/decals/minoan-labyrinth-toss.png`,
  `${assetBase}textures/decals/minoan-cowering-minotaur.png`,
  `${assetBase}textures/decals/minoan-blue-flame-altar.png`,
  `${assetBase}textures/decals/minoan-slaying-minotaur.png`,
  `${assetBase}textures/decals/minoan-wolf-hunt.png`,
  `${assetBase}textures/decals/minoan-gated-minotaur.png`,
  `${assetBase}textures/decals/minoan-throne-skulls.png`
]
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
const DOOR_HEIGHT = 1.8
const DOOR_TEXTURE_REPEAT = 1
const LOADING_FADE_DURATION_MS = 2000
const PLAYER_DEATH_FADE_IN_MS = 6000
const FIRE_FLIPBOOK_GRID = 6
const FIRE_FLIPBOOK_FRAME_COUNT = FIRE_FLIPBOOK_GRID * FIRE_FLIPBOOK_GRID
const FIRE_FLIPBOOK_DURATION_SECONDS = 0.5
const TURN_ANIMATION_DURATION_MS = 250
const PLAYER_DEATH_FADE_TO_BLACK_MS = TURN_ANIMATION_DURATION_MS
const MONSTER_KILL_FADE_TO_RED_MS = 1000
const MONSTER_KILL_FADE_OUT_MS = 3000
let globalAnimationSpeedMultiplier = 1

const MONSTER_EYE_RADIUS = 0.0075
const MONSTER_EYE_TYPES = ['minotaur', 'spider', 'werewolf'] as const

function getScaledAnimationDuration(baseDurationMs: number) {
  return baseDurationMs / MathUtils.clamp(globalAnimationSpeedMultiplier, 0.01, 100)
}

function trackAnalyticsEvent(name: string, payload: Record<string, unknown> = {}) {
  const root = window as Window & {
    MINOTAUR_ANALYTICS_QUEUE?: Array<[string, Record<string, unknown>]>
    umami?: {
      track?: (name: string, payload?: Record<string, unknown>) => void
    }
  }
  const nextPayload = {
    game: 'minotaur',
    revision: GIT_REVISION,
    ...payload
  }

  root.MINOTAUR_ANALYTICS_QUEUE ??= []
  root.MINOTAUR_ANALYTICS_QUEUE.push([name, nextPayload])

  if (typeof root.umami?.track === 'function') {
    root.umami.track(name, nextPayload)
  }
}

function normalizeAngleRadians(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value))
}

const activeFrameProfile = {
  enabled: false,
  frameCount: 0,
  gpu: null as {
    activeQuery: WebGLQuery | null
    context: WebGL2RenderingContext
    extension: EXT_disjoint_timer_query_webgl2
    pending: Array<{ label: string; query: WebGLQuery }>
    steps: Map<string, { count: number; maxMs: number; totalMs: number }>
  } | null,
  renderStats: new Map<string, {
    count: number
    maxCalls: number
    maxTriangles: number
    totalCalls: number
    totalTriangles: number
  }>(),
  scopeStack: [] as string[],
  steps: new Map<string, { count: number; maxMs: number; totalMs: number }>()
}

function resetFrameProfileSteps() {
  activeFrameProfile.frameCount = 0
  activeFrameProfile.gpu?.steps.clear()
  activeFrameProfile.renderStats.clear()
  activeFrameProfile.steps.clear()
}

function recordFrameProfileFrame() {
  if (activeFrameProfile.enabled) {
    activeFrameProfile.frameCount += 1
  }
}

function beginFrameProfileStep() {
  return activeFrameProfile.enabled ? performance.now() : null
}

function getScopedFrameProfileLabel(label: string) {
  return activeFrameProfile.scopeStack.length > 0
    ? [...activeFrameProfile.scopeStack, label].join('/')
    : label
}

function endFrameProfileStep(label: string, startedAt: number | null) {
  if (!activeFrameProfile.enabled || startedAt === null) {
    return
  }

  const duration = performance.now() - startedAt
  const scopedLabel = getScopedFrameProfileLabel(label)
  const current = activeFrameProfile.steps.get(scopedLabel) ?? {
    count: 0,
    maxMs: 0,
    totalMs: 0
  }

  current.count += 1
  current.totalMs += duration
  current.maxMs = Math.max(current.maxMs, duration)
  activeFrameProfile.steps.set(scopedLabel, current)
}

function recordFrameProfileStep(
  target: Map<string, { count: number; maxMs: number; totalMs: number }>,
  label: string,
  duration: number
) {
  const current = target.get(label) ?? {
    count: 0,
    maxMs: 0,
    totalMs: 0
  }

  current.count += 1
  current.totalMs += duration
  current.maxMs = Math.max(current.maxMs, duration)
  target.set(label, current)
}

function recordRenderProfileStats(label: string, calls: number, triangles: number) {
  if (!activeFrameProfile.enabled) {
    return
  }

  const current = activeFrameProfile.renderStats.get(label) ?? {
    count: 0,
    maxCalls: 0,
    maxTriangles: 0,
    totalCalls: 0,
    totalTriangles: 0
  }

  current.count += 1
  current.totalCalls += Math.max(0, calls)
  current.totalTriangles += Math.max(0, triangles)
  current.maxCalls = Math.max(current.maxCalls, calls)
  current.maxTriangles = Math.max(current.maxTriangles, triangles)
  activeFrameProfile.renderStats.set(label, current)
}

function beginGpuFrameProfileStep(label: string) {
  const gpu = activeFrameProfile.gpu

  if (!activeFrameProfile.enabled || !gpu || gpu.activeQuery) {
    return null
  }

  const query = gpu.context.createQuery()

  if (!query) {
    return null
  }

  try {
    gpu.context.beginQuery(gpu.extension.TIME_ELAPSED_EXT, query)
    gpu.activeQuery = query
    return { label, query }
  } catch {
    gpu.context.deleteQuery(query)
    return null
  }
}

function endGpuFrameProfileStep(queryState: { label: string; query: WebGLQuery } | null) {
  const gpu = activeFrameProfile.gpu

  if (!gpu || !queryState || gpu.activeQuery !== queryState.query) {
    return
  }

  try {
    gpu.context.endQuery(gpu.extension.TIME_ELAPSED_EXT)
    gpu.pending.push(queryState)
  } catch {
    gpu.context.deleteQuery(queryState.query)
  } finally {
    gpu.activeQuery = null
  }
}

function withFrameProfileScope<T>(
  label: string,
  callback: () => T,
  options: { gpu?: boolean } = {}
) {
  if (!activeFrameProfile.enabled) {
    return callback()
  }

  const startedAt = performance.now()
  const scopedLabel = getScopedFrameProfileLabel(label)
  const gpuQuery = options.gpu
    ? beginGpuFrameProfileStep(scopedLabel)
    : null

  activeFrameProfile.scopeStack.push(label)
  try {
    return callback()
  } finally {
    activeFrameProfile.scopeStack.pop()
    endGpuFrameProfileStep(gpuQuery)
    recordFrameProfileStep(
      activeFrameProfile.steps,
      scopedLabel,
      performance.now() - startedAt
    )
  }
}

function configureGpuFrameProfiler(gl: WebGLRenderer) {
  const context = gl.getContext()

  if (!(context instanceof WebGL2RenderingContext)) {
    activeFrameProfile.gpu = null
    return false
  }

  const extension = context.getExtension('EXT_disjoint_timer_query_webgl2')

  if (!extension) {
    activeFrameProfile.gpu = null
    return false
  }

  activeFrameProfile.gpu = {
    activeQuery: null,
    context,
    extension,
    pending: [],
    steps: new Map()
  }

  return true
}

async function collectGpuFrameProfileSteps(timeoutMs = 2000) {
  const gpu = activeFrameProfile.gpu

  if (!gpu) {
    return []
  }

  const deadline = performance.now() + timeoutMs
  const poll = () => {
    for (let index = gpu.pending.length - 1; index >= 0; index -= 1) {
      const pending = gpu.pending[index]
      const available = gpu.context.getQueryParameter(
        pending.query,
        gpu.context.QUERY_RESULT_AVAILABLE
      ) as boolean
      const disjoint = gpu.context.getParameter(
        gpu.extension.GPU_DISJOINT_EXT
      ) as boolean

      if (!available || disjoint) {
        continue
      }

      const elapsedNanoseconds = gpu.context.getQueryParameter(
        pending.query,
        gpu.context.QUERY_RESULT
      ) as number

      recordFrameProfileStep(
        gpu.steps,
        pending.label,
        elapsedNanoseconds / 1_000_000
      )
      gpu.context.deleteQuery(pending.query)
      gpu.pending.splice(index, 1)
    }
  }

  while (gpu.pending.length > 0 && performance.now() < deadline) {
    poll()
    if (gpu.pending.length === 0) {
      break
    }
    await new Promise((resolve) => window.setTimeout(resolve, 16))
  }

  for (const pending of gpu.pending.splice(0)) {
    gpu.context.deleteQuery(pending.query)
  }

  return collectFrameProfileSteps(activeFrameProfile.frameCount, gpu.steps)
}

function collectFrameProfileSteps(
  frameCount = activeFrameProfile.frameCount,
  steps = activeFrameProfile.steps
): FrameProfileStep[] {
  const divisor = Math.max(1, frameCount)

  return Array.from(steps.entries())
    .map(([label, step]) => ({
      averageMs: step.totalMs / divisor,
      count: step.count,
      label,
      maxMs: step.maxMs,
      totalMs: step.totalMs
    }))
    .sort((left, right) => right.averageMs - left.averageMs)
}

function collectRenderProfileSteps(frameCount = activeFrameProfile.frameCount) {
  const divisor = Math.max(1, frameCount)

  return Array.from(activeFrameProfile.renderStats.entries())
    .map(([label, step]) => ({
      averageCalls: step.totalCalls / divisor,
      averageTriangles: step.totalTriangles / divisor,
      count: step.count,
      label,
      maxCalls: step.maxCalls,
      maxTriangles: step.maxTriangles,
      totalCalls: step.totalCalls,
      totalTriangles: step.totalTriangles
    }))
    .sort((left, right) => right.averageCalls - left.averageCalls)
}

const PROFILED_PASS_RENDER = Symbol('levelsjam.profiledPassRender')
const PROFILED_N8AO_PASS = Symbol('levelsjam.profiledN8AOPass')
const PROFILED_N8AO_QUAD_RENDER = Symbol('levelsjam.profiledN8AOQuadRender')
const PATCHED_N8AO_SKY_DEPTH = Symbol('levelsjam.patchedN8AOSkyDepth')
let postprocessingPassInstrumentationInstalled = false

function getPostprocessingPassProfileLabel(pass: Pass) {
  const constructorName = pass.constructor?.name || 'Pass'
  const passName = typeof pass.name === 'string' && pass.name.length > 0
    ? pass.name
    : constructorName
  const effects = (pass as { effects?: Iterable<Effect> }).effects

  if (effects) {
    const effectNames = Array.from(effects)
      .map((effect) => (
        (effect as { name?: string }).name ||
        effect.constructor?.name ||
        'Effect'
      ))
      .join('+')

    if (effectNames) {
      return `Composer/${passName}[${effectNames}]`
    }
  }

  return `Composer/${passName}`
}

function instrumentPostprocessingPass(pass: Pass) {
  const profiledPass = pass as Pass & {
    [PROFILED_PASS_RENDER]?: boolean
  }

  if (profiledPass[PROFILED_PASS_RENDER]) {
    return
  }

  const originalRender = pass.render.bind(pass)

  pass.render = ((...args: Parameters<Pass['render']>) => {
    const label = getPostprocessingPassProfileLabel(pass)

    return withFrameProfileScope(
      label,
      () => originalRender(...args),
      { gpu: true }
    )
  }) as Pass['render']
  profiledPass[PROFILED_PASS_RENDER] = true
}

function installPostprocessingPassInstrumentation() {
  if (postprocessingPassInstrumentationInstalled) {
    return
  }

  const composerPrototype = PostEffectComposer.prototype as typeof PostEffectComposer.prototype & {
    addPass?: (pass: Pass, index?: number) => void
  }
  const originalAddPass = composerPrototype.addPass

  if (!originalAddPass) {
    return
  }

  composerPrototype.addPass = function profiledAddPass(
    this: PostEffectComposer,
    pass: Pass,
    index?: number
  ) {
    instrumentPostprocessingPass(pass)
    return originalAddPass.call(this, pass, index)
  }

  postprocessingPassInstrumentationInstalled = true
}

installPostprocessingPassInstrumentation()

function instrumentN8AOQuadRender(
  pass: Record<string, unknown>,
  propertyName: string,
  label: string
) {
  const quad = pass[propertyName] as {
    [PROFILED_N8AO_QUAD_RENDER]?: boolean
    render?: (renderer: WebGLRenderer) => void
  } | null | undefined

  if (!quad?.render || quad[PROFILED_N8AO_QUAD_RENDER]) {
    return
  }

  const originalRender = quad.render.bind(quad)

  quad.render = ((renderer: WebGLRenderer) => withFrameProfileScope(
    label,
    () => originalRender(renderer),
    { gpu: true }
  )) as typeof quad.render
  quad[PROFILED_N8AO_QUAD_RENDER] = true
}

function instrumentN8AOPass(pass: Record<string | symbol, unknown>) {
  if (pass[PROFILED_N8AO_PASS]) {
    return
  }

  const originalDetectTransparency = pass.detectTransparency
  if (typeof originalDetectTransparency === 'function') {
    pass.detectTransparency = function profiledDetectTransparency(this: Record<string, unknown>) {
      return withFrameProfileScope(
        'N8AO internals/detect transparent scene objects',
        () => originalDetectTransparency.call(this)
      )
    }
  }

  const originalRenderTransparency = pass.renderTransparency
  if (typeof originalRenderTransparency === 'function') {
    pass.renderTransparency = function profiledRenderTransparency(
      this: Record<string, unknown>,
      renderer: WebGLRenderer
    ) {
      return withFrameProfileScope(
        'N8AO internals/render transparency-aware AO inputs',
        () => originalRenderTransparency.call(this, renderer),
        { gpu: true }
      )
    }
  }

  pass[PROFILED_N8AO_PASS] = true
}

function instrumentN8AOQuads(pass: Record<string, unknown>) {
  instrumentN8AOQuadRender(pass, 'depthDownsampleQuad', 'N8AO internals/fullscreen depth-normal downsample')
  instrumentN8AOQuadRender(pass, 'effectShaderQuad', 'N8AO internals/fullscreen AO sampling shader')
  instrumentN8AOQuadRender(pass, 'poissonBlurQuad', 'N8AO internals/fullscreen denoise blur')
  instrumentN8AOQuadRender(pass, 'accumulationQuad', 'N8AO internals/fullscreen temporal accumulation')
  instrumentN8AOQuadRender(pass, 'effectCompositerQuad', 'N8AO internals/fullscreen AO composite')
  instrumentN8AOQuadRender(pass, 'depthCopyPass', 'N8AO internals/transparency depth-copy fullscreen pass')
  patchN8AOCompositerSkyDepth(pass)
}

function patchN8AOCompositerSkyDepth(pass: Record<string, unknown>) {
  const quad = pass.effectCompositerQuad as {
    material?: ShaderMaterial & { [PATCHED_N8AO_SKY_DEPTH]?: boolean }
  } | null | undefined
  const material = quad?.material

  if (!material || material[PATCHED_N8AO_SKY_DEPTH]) {
    return
  }

  const depthBranchAnchor = `        #endif
        #ifdef HALFRES`

  if (!material.fragmentShader.includes(depthBranchAnchor)) {
    return
  }

  material.fragmentShader = material.fragmentShader.replace(
    depthBranchAnchor,
    `        #endif
        if (depth >= 0.999999) {
            gl_FragColor = sceneTexel;
            return;
        }
        #ifdef HALFRES`
  )
  material.needsUpdate = true
  material[PATCHED_N8AO_SKY_DEPTH] = true
}

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
const LENS_FLARE_OCCLUSION_MARGIN = 0.05
const LENS_FLARE_SOURCE_REFRESH_SECONDS = 0.1
const DEFAULT_HDRI_BRIGHTNESS = 1
const SKYBOX_ROTATION_Y_RADIANS = MathUtils.degToRad(128)
const DEFAULT_SFX_VOLUMES: SfxVolumeSettings = Object.freeze({
  beastDie: 1,
  beastKillPlayer: 1,
  beastProximityLoop: 1,
  gateClose: 1,
  gateOpen: 1,
  monsterStomp: 1,
  spiderDie: 1,
  spiderKillPlayer: 1,
  spiderProximityLoop: 1,
  torchFireLoop: 1,
  wetFootsteps: 1
})
const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  musicEnabled: true,
  musicVolume: 0.7,
  soundEnabled: true,
  soundVolume: 0.7,
  sfxVolumes: { ...DEFAULT_SFX_VOLUMES }
}
const DEFAULT_SATURATION = 1
const DEFAULT_MINOTAUR_ALBEDO_HEX = '#2b2130'
const DEFAULT_MONSTER_EYE_COLORS: MonsterEyeColorSettings = {
  minotaur: '#ff0000',
  spider: '#ff0000',
  werewolf: '#ff0000'
}
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
const MAX_REFLECTION_CONTRIBUTION_INTENSITY = 12
const HALF_FLOAT_MAX_VALUE = 65504
const BLOCKED_MOVE_FRACTION = 0.25
const STARTUP_MARKER_ORIGIN = performance.now()

function recordStartupMarker(name: string) {
  if (document.body.dataset[name] && document.body.dataset[name] !== 'pending') {
    return
  }

  document.body.dataset[name] = Math.max(
    0,
    performance.now() - STARTUP_MARKER_ORIGIN
  ).toFixed(1)
}

function hasIntroFadeTriggered() {
  const triggeredAt = document.body.dataset.introFadeTriggeredAt

  return Boolean(triggeredAt && triggeredAt !== 'pending')
}

function recordIntroFadeTriggered() {
  const alreadyTriggered = hasIntroFadeTriggered()

  recordStartupMarker('introFadeTriggeredAt')
  if (!alreadyTriggered && hasIntroFadeTriggered()) {
    window.dispatchEvent(new Event('levelsjam:intro-fade-triggered'))
  }
}

function onIntroFadeTriggered(callback: () => void) {
  if (hasIntroFadeTriggered()) {
    callback()
    return () => {}
  }

  let called = false
  let pollHandle = 0

  const runIfTriggered = () => {
    if (called || !hasIntroFadeTriggered()) {
      return
    }

    called = true
    window.clearTimeout(pollHandle)
    window.removeEventListener('levelsjam:intro-fade-triggered', listener)
    callback()
  }

  const listener = () => {
    runIfTriggered()
  }

  const poll = () => {
    runIfTriggered()
    if (!called) {
      pollHandle = window.setTimeout(poll, 250)
    }
  }

  window.addEventListener('levelsjam:intro-fade-triggered', listener, { once: true })
  pollHandle = window.setTimeout(poll, 250)

  return () => {
    called = true
    window.clearTimeout(pollHandle)
    window.removeEventListener('levelsjam:intro-fade-triggered', listener)
  }
}

function toClampedHalfFloat(value: number) {
  return DataUtils.toHalfFloat(
    MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, HALF_FLOAT_MAX_VALUE)
  )
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
const MATERIAL_SAMPLER_TEXTURE_PROPERTY_NAMES = [
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'emissiveMap',
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

  scene.traverseVisible((object) => {
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

let sharedFireFlipbookTexture: Texture | null = null
let sharedFireFlipbookPromise: Promise<Texture> | null = null
const sharedFrescoDecalTextures = new Map<number, Texture>()
const sharedFrescoDecalPromises = new Map<number, Promise<Texture>>()

function loadSharedFireFlipbookTexture(maxAnisotropy: number) {
  if (sharedFireFlipbookTexture) {
    return Promise.resolve(sharedFireFlipbookTexture)
  }

  if (!sharedFireFlipbookPromise) {
    sharedFireFlipbookPromise = new Promise((resolve, reject) => {
      new TextureLoader().load(
        FIRE_FLIPBOOK_URL,
        (nextTexture) => {
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
          sharedFireFlipbookTexture = nextTexture
          resolve(nextTexture)
        },
        undefined,
        reject
      )
    })
  }

  return sharedFireFlipbookPromise
}

function loadSharedFrescoDecalTexture(index: number, maxAnisotropy: number) {
  const normalizedIndex = ((index % FRESCO_DECAL_URLS.length) + FRESCO_DECAL_URLS.length) %
    FRESCO_DECAL_URLS.length
  const existingTexture = sharedFrescoDecalTextures.get(normalizedIndex)

  if (existingTexture) {
    return Promise.resolve(existingTexture)
  }

  const existingPromise = sharedFrescoDecalPromises.get(normalizedIndex)

  if (existingPromise) {
    return existingPromise
  }

  const promise = new Promise<Texture>((resolve, reject) => {
    new TextureLoader().load(
      FRESCO_DECAL_URLS[normalizedIndex],
      (texture) => {
        texture.anisotropy = Math.min(maxAnisotropy, 8)
        texture.colorSpace = SRGBColorSpace
        texture.flipY = false
        texture.generateMipmaps = true
        texture.magFilter = LinearFilter
        texture.minFilter = LinearFilter
        texture.wrapS = ClampToEdgeWrapping
        texture.wrapT = ClampToEdgeWrapping
        texture.needsUpdate = true
        sharedFrescoDecalTextures.set(normalizedIndex, texture)
        resolve(texture)
      },
      undefined,
      reject
    )
  })

  sharedFrescoDecalPromises.set(normalizedIndex, promise)
  return promise
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

  for (let index = 0; index < textures.length; index += 1) {
    if (isCancelled()) {
      return
    }

    gl.initTexture(textures[index])

    if ((index + 1) % 16 === 0) {
      await waitForNextAnimationFrame()
    }
  }

  await waitForNextAnimationFrame()
}

async function warmEffectComposer(
  composer: PostEffectComposer | null,
  isCancelled: () => boolean
) {
  if (!composer || isCancelled()) {
    return
  }

  composer.render(0)
  await waitForNextAnimationFrame()
}

async function warmScenePrograms(
  gl: WebGLRenderer,
  scene: ThreeScene,
  camera: ThreeCamera,
  isCancelled: () => boolean,
  allowSyncFallback = true,
  includeProbeBlendVariants = false,
  forceAllObjects = false
) {
  const hiddenObjects: Object3D[] = []
  const frustumCulledObjects: Array<{ frustumCulled: boolean; object: Object3D }> = []

  if (forceAllObjects) {
    scene.traverse((object) => {
      if (!object.visible) {
        hiddenObjects.push(object)
        object.visible = true
      }
      if (object.frustumCulled) {
        frustumCulledObjects.push({ frustumCulled: object.frustumCulled, object })
        object.frustumCulled = false
      }
    })
  }

  try {
    if (isCancelled()) {
      return
    }

    // In this app's full scene, Chromium/ANGLE's compileAsync path can stall
    // longer than a direct compile while still blocking visible progress.
    // A real render is also required: gl.compile can miss built-in material
    // variants that R3F/three later compile on their first visible draw.
    if (allowSyncFallback) {
      const previousRenderTarget = gl.getRenderTarget()
      const warmupTarget = new WebGLRenderTarget(1, 1)

      gl.compile(scene, camera)
      gl.setRenderTarget(warmupTarget)
      gl.render(scene, camera)
      if (includeProbeBlendVariants) {
        warmProbeBlendMaterialVariants(gl, scene, camera)
      }
      gl.setRenderTarget(previousRenderTarget)
      warmupTarget.dispose()
    }
  } finally {
    for (const object of hiddenObjects) {
      object.visible = false
    }
    for (const { frustumCulled, object } of frustumCulledObjects) {
      object.frustumCulled = frustumCulled
    }
  }

  await waitForNextAnimationFrame()
}

async function waitForRendererResourceStability(
  gl: WebGLRenderer,
  isCancelled: () => boolean,
  stableFrameTarget = 2,
  maxFrames = 45
) {
  let previousGeometries = -1
  let previousTextures = -1
  let stableFrames = 0

  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (isCancelled()) {
      return
    }

    await waitForNextAnimationFrame()

    const geometries = gl.info.memory.geometries
    const textures = gl.info.memory.textures

    if (geometries === previousGeometries && textures === previousTextures) {
      stableFrames += 1
      if (stableFrames >= stableFrameTarget) {
        return
      }
    } else {
      stableFrames = 0
      previousGeometries = geometries
      previousTextures = textures
    }
  }
}

async function waitForRuntimeProbeResidency(
  scene: ThreeScene,
  isCancelled: () => boolean,
  maxFrames = 180
) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (isCancelled()) {
      return
    }

    const probeState = scene.userData.reflectionProbeState as
      | RuntimeReflectionProbeState
      | undefined

    if (probeState?.ready && probeState.complete !== false) {
      return
    }

    await waitForNextAnimationFrame()
  }
}

const MAZE_GROUND_PATCH_OFFSET_Y = 0.002
const REFLECTION_PROBE_RENDER_SIZE = 32
const REFLECTION_PROBE_AMBIENT_RENDER_SIZE = 24
const REFLECTION_PROBE_FAR = 48
const REFLECTION_PROBE_LOAD_CONCURRENCY = 8
const REFLECTION_PROBE_BACKGROUND_LOAD_CONCURRENCY = 4
const REFLECTION_PROBE_PUBLISH_INTERVAL_MS = 250
const REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT = 32
const REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES = 768 * 1024 * 1024
const REFLECTION_PROBE_STARTUP_DELAY_MS = 0
const REFLECTION_PROBE_STARTUP_CAPTURE_DELAY_MS = 250
const REFLECTION_PROBE_BACKGROUND_CAPTURE_DELAY_MS = 1000
const REFLECTION_PROBE_EMISSIVE_RADIUS = 0.16
const REFLECTION_PROBE_EMISSIVE_SCALE = 2
const STARTUP_VOLUMETRIC_PROBE_READY_RADIUS = 6
const FOG_VOLUME_HEIGHT = 6
const FOG_EXTINCTION_SCALE = 1
const MAX_ACTIVE_FOG_VLM_ATLASES = 4
const DEFAULT_VOLUMETRIC_AMBIENT_HEX = '#2c2c68'
const DEFAULT_VOLUMETRIC_FOG_DISTANCE = 12
const EFFECT_EPSILON = 0.0001
const MAX_PHYSICS_SUBSTEPS = 10
const MIN_LOADING_OVERLAY_MS = 0
const DEFAULT_PROBE_BOX_MAX = new Vector3(0.5, WALL_HEIGHT, 0.5)
const DEFAULT_PROBE_BOX_MIN = new Vector3(-0.5, GROUND_Y, -0.5)
const DEFAULT_PROBE_POSITION = new Vector3(0, 1, 0)
const LEVEL_UP_VECTOR = new Vector3(0, 1, 0)
const DEFAULT_FOG_IBL_COLOR = new Color(DEFAULT_VOLUMETRIC_AMBIENT_HEX)
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
const saturationEffectShader = `
uniform float saturation;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float luminance = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(mix(vec3(luminance), inputColor.rgb, clamp(saturation, 0.0, 1.0)), inputColor.a);
}
`
const playerFadeEffectShader = `
uniform vec3 fadeColor;
uniform float fadeAlpha;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(mix(inputColor.rgb, fadeColor, clamp(fadeAlpha, 0.0, 1.0)), inputColor.a);
}
`
const radialChromaticAberrationEffectShader = `
uniform float exponent;
uniform float intensity;
uniform float maxOffset;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 centered = (uv * 2.0) - 1.0;
  float distanceFromCenter = length(centered);

  if (distanceFromCenter <= 0.000001 || intensity <= 0.0 || maxOffset <= 0.0) {
    outputColor = inputColor;
    return;
  }

  float powerValue = max(abs(exponent), 0.000001);
  float radialWeight = exponent >= 0.0
    ? pow(clamp(distanceFromCenter, 0.0, 1.41421356237), powerValue)
    : 1.0 - pow(clamp(1.41421356237 - distanceFromCenter, 0.0, 1.41421356237) / 1.41421356237, powerValue);
  vec2 direction = centered / distanceFromCenter;
  vec2 offset = direction * maxOffset * intensity * radialWeight;
  vec3 color = vec3(0.0);

  color += texture2D(inputBuffer, clamp(uv + (offset * -3.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.02, 0.05, 0.16);
  color += texture2D(inputBuffer, clamp(uv + (offset * -2.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.05, 0.10, 0.24);
  color += texture2D(inputBuffer, clamp(uv + (offset * -1.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.10, 0.18, 0.25);
  color += texture2D(inputBuffer, uv).rgb * vec3(0.18, 0.34, 0.18);
  color += texture2D(inputBuffer, clamp(uv + (offset * 1.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.25, 0.18, 0.10);
  color += texture2D(inputBuffer, clamp(uv + (offset * 2.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.24, 0.10, 0.05);
  color += texture2D(inputBuffer, clamp(uv + (offset * 3.0), vec2(0.0), vec2(1.0))).rgb * vec3(0.16, 0.05, 0.02);

  outputColor = vec4(color, inputColor.a);
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
uniform vec3 fallbackProbeAmbientColor;
uniform float fogDistance;
uniform float groundHeight;
uniform float heightFalloff;
uniform float lightingStrength;
uniform float probeSaturation;
uniform float noiseFrequency;
uniform float noisePeriod;
uniform float noiseStrength;
uniform sampler3D fogNoiseTexture;
uniform float activeProbeAtlasCount;
uniform vec4 probeAmbientBounds[${MAX_ACTIVE_FOG_VLM_ATLASES}];
uniform vec2 probeAmbientGrid[${MAX_ACTIVE_FOG_VLM_ATLASES}];
uniform vec2 probeWorldOrigin[${MAX_ACTIVE_FOG_VLM_ATLASES}];
uniform vec2 probeWorldRotation[${MAX_ACTIVE_FOG_VLM_ATLASES}];
uniform sampler2D probeCoeffTextureL0_0;
uniform sampler2D probeCoeffTextureL0_1;
uniform sampler2D probeCoeffTextureL0_2;
uniform sampler2D probeCoeffTextureL0_3;
uniform sampler2D probeConnectivityTexture_0;
uniform sampler2D probeConnectivityTexture_1;
uniform sampler2D probeConnectivityTexture_2;
uniform sampler2D probeConnectivityTexture_3;
uniform float probeHeight;
uniform float rayStepCount;
uniform float time;
uniform float useProbeCoefficientTexture;
uniform float useProbeConnectivity;
uniform float volumeHeight;

float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
  return texture(fogNoiseTexture, p).r;
}

float fogProbeCellSize(float span, float gridCount) {
  return gridCount > 1.5 ? span / (gridCount - 1.0) : ${MAZE_CELL_SIZE.toFixed(1)};
}

vec4 fogAtlasBounds(int atlasIndex) {
  if (atlasIndex == 0) { return probeAmbientBounds[0]; }
  if (atlasIndex == 1) { return probeAmbientBounds[1]; }
  if (atlasIndex == 2) { return probeAmbientBounds[2]; }
  return probeAmbientBounds[3];
}

vec2 fogAtlasGrid(int atlasIndex) {
  if (atlasIndex == 0) { return probeAmbientGrid[0]; }
  if (atlasIndex == 1) { return probeAmbientGrid[1]; }
  if (atlasIndex == 2) { return probeAmbientGrid[2]; }
  return probeAmbientGrid[3];
}

vec2 fogAtlasWorldOrigin(int atlasIndex) {
  if (atlasIndex == 0) { return probeWorldOrigin[0]; }
  if (atlasIndex == 1) { return probeWorldOrigin[1]; }
  if (atlasIndex == 2) { return probeWorldOrigin[2]; }
  return probeWorldOrigin[3];
}

vec2 fogAtlasWorldRotation(int atlasIndex) {
  if (atlasIndex == 0) { return probeWorldRotation[0]; }
  if (atlasIndex == 1) { return probeWorldRotation[1]; }
  if (atlasIndex == 2) { return probeWorldRotation[2]; }
  return probeWorldRotation[3];
}

vec4 fogSampleProbeCoeff(int atlasIndex, vec2 uv) {
  if (atlasIndex == 0) { return texture2D(probeCoeffTextureL0_0, uv); }
  if (atlasIndex == 1) { return texture2D(probeCoeffTextureL0_1, uv); }
  if (atlasIndex == 2) { return texture2D(probeCoeffTextureL0_2, uv); }
  return texture2D(probeCoeffTextureL0_3, uv);
}

vec4 fogSampleProbeConnectivity(int atlasIndex, vec2 uv) {
  if (atlasIndex == 0) { return texture2D(probeConnectivityTexture_0, uv); }
  if (atlasIndex == 1) { return texture2D(probeConnectivityTexture_1, uv); }
  if (atlasIndex == 2) { return texture2D(probeConnectivityTexture_2, uv); }
  return texture2D(probeConnectivityTexture_3, uv);
}

vec2 fogClampProbeGridCell(int atlasIndex, vec2 cell) {
  vec2 grid = fogAtlasGrid(atlasIndex);
  return clamp(cell, vec2(0.0), max(grid - vec2(1.0), vec2(0.0)));
}

vec2 fogProbeGridCellToUv(int atlasIndex, vec2 cell) {
  return (fogClampProbeGridCell(atlasIndex, cell) + vec2(0.5)) / max(fogAtlasGrid(atlasIndex), vec2(1.0));
}

vec2 fogWorldToProbeLocal(int atlasIndex, vec3 worldPosition) {
  vec2 delta = vec2(worldPosition.x, worldPosition.z) - fogAtlasWorldOrigin(atlasIndex);
  vec2 rotation = fogAtlasWorldRotation(atlasIndex);
  float c = rotation.x;
  float s = rotation.y;

  return vec2(
    (delta.x * c) - (delta.y * s),
    (delta.x * s) + (delta.y * c)
  );
}

vec2 fogWorldToProbeGrid(int atlasIndex, vec3 worldPosition) {
  vec4 bounds = fogAtlasBounds(atlasIndex);
  vec2 grid = fogAtlasGrid(atlasIndex);
  vec2 localPosition = fogWorldToProbeLocal(atlasIndex, worldPosition);

  return vec2(
    (localPosition.x - bounds.x) / max(fogProbeCellSize(bounds.z, grid.x), 0.0001),
    (localPosition.y - bounds.y) / max(fogProbeCellSize(bounds.w, grid.y), 0.0001)
  );
}

bool fogIsInsideProbeGrid(int atlasIndex, vec2 gridPosition) {
  vec2 grid = fogAtlasGrid(atlasIndex);

  return (
    gridPosition.x >= -0.5 &&
    gridPosition.y >= -0.5 &&
    gridPosition.x <= grid.x - 0.5 &&
    gridPosition.y <= grid.y - 0.5
  );
}

float sampleFogProbeConnectivity(int atlasIndex, vec2 originCell, vec2 candidateCell) {
  if (useProbeConnectivity < 0.5) {
    return 1.0;
  }

  vec2 fromCell = fogClampProbeGridCell(atlasIndex, originCell);
  vec2 toCell = fogClampProbeGridCell(atlasIndex, candidateCell);
  vec2 delta = toCell - fromCell;
  float manhattan = abs(delta.x) + abs(delta.y);

  if (manhattan <= 0.001) {
    return 1.0;
  }

  if (manhattan > 1.001) {
    return 0.0;
  }

  vec4 connectivity = fogSampleProbeConnectivity(atlasIndex, fogProbeGridCellToUv(atlasIndex, fromCell));

  if (delta.y < -0.5) {
    return connectivity.r;
  }
  if (delta.x > 0.5) {
    return connectivity.g;
  }
  if (delta.y > 0.5) {
    return connectivity.b;
  }
  if (delta.x < -0.5) {
    return connectivity.a;
  }

  return 0.0;
}

float fogProbeKernelWeight(vec2 gridPosition, vec2 cell) {
  vec2 distanceToCell = abs(gridPosition - cell);
  vec2 axisWeight = vec2(
    1.0 - smoothstep(0.5, 1.5, distanceToCell.x),
    1.0 - smoothstep(0.5, 1.5, distanceToCell.y)
  );

  return axisWeight.x * axisWeight.y;
}

float sampleFogProbeConnectivityBlended(int atlasIndex, vec2 gridPosition, vec2 candidateCell) {
  if (useProbeConnectivity < 0.5) {
    return 1.0;
  }

  vec2 nearestCell = floor(gridPosition + vec2(0.5));
  float accumulatedVisibility = 0.0;
  float accumulatedWeight = 0.0;

  for (int x = -1; x <= 1; x += 1) {
    for (int y = -1; y <= 1; y += 1) {
      vec2 originCell = nearestCell + vec2(float(x), float(y));
      float weight = fogProbeKernelWeight(gridPosition, originCell);

      if (weight <= 0.0001) {
        continue;
      }

      accumulatedVisibility += sampleFogProbeConnectivity(atlasIndex, originCell, candidateCell) * weight;
      accumulatedWeight += weight;
    }
  }

  if (accumulatedWeight <= 0.0001) {
    return 0.0;
  }

  return accumulatedVisibility / accumulatedWeight;
}

vec4 sampleFogAmbientCandidate(int atlasIndex, vec3 worldPosition, vec2 gridPosition, vec2 cell) {
  vec2 clampedCell = fogClampProbeGridCell(atlasIndex, cell);
  vec2 uv = fogProbeGridCellToUv(atlasIndex, clampedCell);
  vec4 coeff0 = fogSampleProbeCoeff(atlasIndex, uv);

  if (coeff0.a <= 0.0) {
    return vec4(fallbackProbeAmbientColor, 1.0);
  }

  float visibility = sampleFogProbeConnectivityBlended(atlasIndex, gridPosition, clampedCell);

  if (visibility <= 0.0001) {
    return vec4(0.0);
  }

  float weight = visibility;
  vec3 color = max(coeff0.rgb / 0.282095, vec3(0.0));

  return vec4(color * weight, weight);
}

vec3 applyFogSaturation(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luminance), color, clamp(saturation, 0.0, 1.0));
}

vec3 sampleFogAmbientColor(vec3 worldPosition) {
  if (useProbeCoefficientTexture < 0.5) {
    return fallbackProbeAmbientColor;
  }

  vec4 atlasAccumulated = vec4(0.0);

  for (int atlasIndex = 0; atlasIndex < ${MAX_ACTIVE_FOG_VLM_ATLASES}; atlasIndex += 1) {
    if (float(atlasIndex) >= activeProbeAtlasCount) {
      break;
    }

    vec2 worldGridPosition = fogWorldToProbeGrid(atlasIndex, worldPosition);

    if (!fogIsInsideProbeGrid(atlasIndex, worldGridPosition)) {
      continue;
    }

    vec2 nearestCell = floor(worldGridPosition + vec2(0.5));
    vec4 accumulated = vec4(0.0);

    for (int x = -1; x <= 1; x += 1) {
      for (int y = -1; y <= 1; y += 1) {
        vec2 cell = nearestCell + vec2(float(x), float(y));
        float spatialWeight = fogProbeKernelWeight(worldGridPosition, cell);

        if (spatialWeight <= 0.0001) {
          continue;
        }

        accumulated += sampleFogAmbientCandidate(atlasIndex, worldPosition, worldGridPosition, cell) * spatialWeight;
      }
    }

    if (accumulated.a > 0.0001) {
      atlasAccumulated += accumulated;
    }
  }
  vec3 color = atlasAccumulated.rgb;
  float weight = atlasAccumulated.a;

  if (weight <= 0.0001) {
    return fallbackProbeAmbientColor;
  }

  return applyFogSaturation(color / weight, probeSaturation);
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
  float lightingScale = max(0.0, lightingStrength);
  vec3 nearAmbientColor = vec3(0.0);
  vec3 farAmbientColor = vec3(0.0);
  vec3 nearSamplePosition = rayOrigin + (rayDirection * (tNear + (pathLength * 0.25)));
  vec3 farSamplePosition = rayOrigin + (rayDirection * (tNear + (pathLength * 0.75)));

  if (lightingScale > 0.0001 && useProbeCoefficientTexture > 0.5 && activeProbeAtlasCount > 0.5) {
    nearAmbientColor = sampleFogAmbientColor(nearSamplePosition) * environmentFogColor * lightingScale;
    farAmbientColor = sampleFogAmbientColor(farSamplePosition) * environmentFogColor * lightingScale;
  }

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

    float lightingT = clamp((float(stepIndex) + rayJitter) / clampedStepCount, 0.0, 1.0);
    vec3 ambientColor = mix(nearAmbientColor, farAmbientColor, lightingT);
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
  | 'eyes'
  | 'flares'
  | 'volume'
  | 'ssr'
  | 'fog'
  | 'vignette'
  | 'chromatic'
  | 'anamorphic'
  | 'performance'
  | 'solution'

type LightingContributionSettings = {
  enabled: boolean
  intensity: number
}

type MonsterType = (typeof MONSTER_EYE_TYPES)[number]
type MonsterEyeOffset = { x: number; y: number; z: number }
type MonsterEyeSettings = Record<MonsterType, {
  left: MonsterEyeOffset
  right: MonsterEyeOffset
}>

type MonsterEyeColorSettings = Record<MonsterType, string>

type ProbeDebugMode =
  | 'none'
  | 'reflection'
  | 'volumetric-lightmap'

type AnamorphicSettings = EffectSettings & {
  colorGain: number
  samples: number
  scale: number
  threshold: number
}

type ChromaticAberrationSettings = EffectSettings & {
  exponent: number
  modulationOffset: number
  offsetX: number
  offsetY: number
  radialModulation: boolean
  screenShakeIntensity: number
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
  focusDistance: number
  focusRange: number
  resolutionScale: number
}

type LensFlareSettings = EffectSettings & {
  aditionalStreaks: boolean
  animated: boolean
  anamorphic: boolean
  colorGain: number
  flareShape: number
  flareSize: number
  flareSpeed: number
  ghostScale: number
  glareSize: number
  haloScale: number
  opacity: number
  secondaryGhosts: boolean
  starBurst: boolean
  starBurstIntensity: number
  starPoints: number
}

type AudioSettings = {
  musicEnabled: boolean
  musicVolume: number
  soundEnabled: boolean
  soundVolume: number
  sfxVolumes: SfxVolumeSettings
}

type SfxKey = keyof typeof SFX_URLS
type SfxVolumeSettings = Record<SfxKey, number>

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
  key: VisualControlTabKey
  label: string
}> = [
  { key: 'core', label: 'Core' },
  { key: 'ao', label: 'AO' },
  { key: 'bloom', label: 'Bloom' },
  { key: 'dof', label: 'DOF' },
  { key: 'flares', label: 'Flares' },
  { key: 'volume', label: 'Volume' },
  { key: 'ssr', label: 'SSR' },
  { key: 'fog', label: 'Fog' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'chromatic', label: 'Chromatic' },
  { key: 'anamorphic', label: 'Anamorphic' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'performance', label: 'Performance' },
  { key: 'solution', label: 'Solution' }
]

const DEFAULT_AO_RADIUS_METERS = 1
const DEFAULT_VOLUMETRIC_INTENSITY = 0.75
const DEFAULT_VOLUMETRIC_NOISE_FREQUENCY = 0.25
const DEFAULT_VOLUMETRIC_NOISE_PERIOD = 0.75
const DEFAULT_VOLUMETRIC_NOISE_STRENGTH = 1
const DEFAULT_VOLUMETRIC_HEIGHT_FALLOFF = 0.4
const DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH = 1
const DEFAULT_VOLUMETRIC_STEP_COUNT = 6
const FOG_NOISE_TEXTURE_SIZE = 32
const FOG_NOISE_VOLUME_URL = `${assetBase}textures/runtime/fog/noise-volume-32-r8.bin`
const MAX_SIMULTANEOUS_LENS_FLARES = 5
const MAX_BUFFERED_TURN_COMMANDS = 10
const DEFAULT_MONSTER_EYES: MonsterEyeSettings = {
  minotaur: {
    left: { x: 0.16, y: 1.68, z: -0.54 },
    right: { x: -0.16, y: 1.68, z: -0.54 }
  },
  spider: {
    left: { x: -0.18, y: 0.35, z: -0.29 },
    right: { x: -0.27, y: 0.26, z: -0.29 }
  },
  werewolf: {
    left: { x: 0.11, y: 1.32, z: -0.36 },
    right: { x: -0.11, y: 1.32, z: -0.36 }
  }
}
const GIT_REVISION = `${__GIT_BRANCH__}@${__GIT_REVISION__}`
const GIT_REVISION_TIMESTAMP = __GIT_REVISION_TIMESTAMP__

function createFogNoiseTexture(data?: Uint8Array) {
  const size = FOG_NOISE_TEXTURE_SIZE
  const texture = new Data3DTexture(data ?? new Uint8Array(size * size * size).fill(128), size, size, size)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.wrapR = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.format = RedFormat
  texture.type = UnsignedByteType
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true

  return texture
}

const FOG_NOISE_TEXTURE = createFogNoiseTexture()
let fogNoiseTextureLoadPromise: Promise<Texture> | null = null

function useFogNoiseTexture() {
  const [texture, setTexture] = useState<Texture>(FOG_NOISE_TEXTURE)

  useEffect(() => {
    let cancelled = false

    fogNoiseTextureLoadPromise ??= fetch(FOG_NOISE_VOLUME_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load fog noise volume: ${response.status} ${response.statusText}`)
        }

        return response.arrayBuffer()
      })
      .then((buffer) => createFogNoiseTexture(new Uint8Array(buffer)))

    void fogNoiseTextureLoadPromise
      .then((loadedTexture) => {
        if (cancelled) {
          return
        }

        setTexture(loadedTexture)
      })
      .catch((error) => {
        console.error(error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return texture
}

const PROBE_DEBUG_MODE_OPTIONS: Array<{ key: ProbeDebugMode, label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'reflection', label: 'Reflection' },
  { key: 'volumetric-lightmap', label: 'Volumetric Lightmap' }
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
  n8aoDenoiseIterations: number
  n8aoDenoiseRadius: number
  n8aoDenoiseSamples: number
  n8aoSamples: number
  exposureStops: number
  cameraFov: number
  cameraTiltDegrees: number
  hdriBrightness: number
  iblContribution: LightingContributionSettings
  lightmapContribution: LightingContributionSettings
  lensFlare: LensFlareSettings
  minotaurAlbedoHex: string
  monsterEyeColors: MonsterEyeColorSettings
  probeDebugMode: ProbeDebugMode
  reflectionContribution: LightingContributionSettings
  saturation: number
  lightmapSaturation: number
  staticVolumetricContribution: LightingContributionSettings
  toneMapping: ToneMappingMode
  bloom: BloomSettings
  chromaticAberration: ChromaticAberrationSettings
  depthOfField: DepthOfFieldSettings
  movement: MovementSettings
  monsterEyes: MonsterEyeSettings
  precomputedVisibilityEnabled: boolean
  ssr: SSRSettings
  volumetricAmbientHex: string
  volumetricDistance: number
  volumetricHeightFalloff: number
  volumetricLightingStrength: number
  volumetricLighting: EffectSettings
  volumetricNoiseFrequency: number
  volumetricNoisePeriod: number
  volumetricNoiseStrength: number
  volumetricSaturation: number
  volumetricShadowsEnabled: boolean
  volumetricStepCount: number
  torchBillboardIntensity: number
  unlitMode: boolean
  vignette: VignetteSettings
}

type VisualSettingsPatch = Partial<{
  ambientOcclusionIntensity: number
  ambientOcclusionMode: AmbientOcclusionMode
  ambientOcclusionRadius: number
  n8aoDenoiseIterations: number
  n8aoDenoiseRadius: number
  n8aoDenoiseSamples: number
  n8aoSamples: number
  anamorphic: Partial<AnamorphicSettings>
  bloom: Partial<BloomSettings>
  chromaticAberration: Partial<ChromaticAberrationSettings>
  depthOfField: Partial<DepthOfFieldSettings>
  exposureStops: number
  cameraFov: number
  cameraTiltDegrees: number
  hdriBrightness: number
  iblContribution: Partial<LightingContributionSettings>
  lensFlare: Partial<LensFlareSettings>
  lightmapContribution: Partial<LightingContributionSettings>
  minotaurAlbedoHex: string
  monsterEyeColors: Partial<MonsterEyeColorSettings>
  movement: Partial<MovementSettings>
  monsterEyes: Partial<Record<MonsterType, Partial<{
    left: Partial<MonsterEyeOffset>
    right: Partial<MonsterEyeOffset>
  }>>>
  precomputedVisibilityEnabled: boolean
  probeDebugMode: ProbeDebugMode
  reflectionContribution: Partial<LightingContributionSettings>
  saturation: number
  lightmapSaturation: number
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
  volumetricSaturation: number
  volumetricShadowsEnabled: boolean
  volumetricStepCount: number
  torchBillboardIntensity: number
  unlitMode: boolean
  vignette: Partial<VignetteSettings>
}>

type GenericEffectSettingKey =
  'vignette' |
  'volumetricLighting'
type BooleanSettingKey =
  | 'iblContributionEnabled'
  | 'lightmapContributionEnabled'
  | 'precomputedVisibilityEnabled'
  | 'reflectionContributionEnabled'
  | 'staticVolumetricContributionEnabled'
  | 'unlitMode'
  | 'volumetricShadowsEnabled'
type ScalarSettingKey =
  | 'ambientOcclusionIntensity'
  | 'ambientOcclusionRadius'
  | 'cameraFov'
  | 'cameraTiltDegrees'
  | 'exposureStops'
  | 'hdriBrightness'
  | 'iblContributionIntensity'
  | 'lightmapContributionIntensity'
  | 'n8aoDenoiseIterations'
  | 'n8aoDenoiseRadius'
  | 'n8aoDenoiseSamples'
  | 'n8aoSamples'
  | 'reflectionContributionIntensity'
  | 'saturation'
  | 'lightmapSaturation'
  | 'staticVolumetricContributionIntensity'
  | 'torchBillboardIntensity'
  | 'volumetricDistance'
  | 'volumetricHeightFalloff'
  | 'volumetricLightingStrength'
  | 'volumetricNoiseFrequency'
  | 'volumetricNoisePeriod'
  | 'volumetricNoiseStrength'
  | 'volumetricSaturation'
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
  averageRenderCalls?: number
  averageTriangles?: number
  maxRenderCalls?: number
  maxTriangles?: number
  maxFrameMs: number
  minFrameMs: number
  samples: number
}

type PerformanceProfileStep = {
  benchmark: BenchmarkResult
  label: string
  renderLoops: Record<string, number>
  sceneStats: Record<string, unknown>
}

type FrameProfileStep = {
  averageMs: number
  count: number
  label: string
  maxMs: number
  totalMs: number
}

type PerformanceProfileResult = {
  capturedAt: string
  controlledSteps: PerformanceProfileStep[]
  deltas: Array<{
    from: string
    label: string
    ms: number
    to: string
  }>
  liveFrames: {
    averageFrameMs: number
    fps: number
    longFrames: Array<{
      frameMs: number
      loadedMazeId: string | null
      renderLoopDelta: Record<string, number>
      sceneProgramsReady: string | null
      fireFlipbookReady: string | null
      renderLoops: Record<string, number>
      t: number
    }>
    maxFrameMs: number
    minFrameMs: number
    samples: number
  }
  frameSteps: FrameProfileStep[]
  gpuFrameSteps: FrameProfileStep[]
  gpuTimerSupported: boolean
  markdown: string
  renderSteps: Array<{
    averageCalls: number
    averageTriangles: number
    count: number
    label: string
    maxCalls: number
    maxTriangles: number
    totalCalls: number
    totalTriangles: number
  }>
  renderer: string
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
  cell: {
    x: number
    y: number
  }
  cells?: Array<{
    x: number
    y: number
  }>
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

type RuntimeReflectionProbeState = {
  activeProbeId: string | null
  captureSceneState?: ReturnType<typeof getReflectionCaptureSceneState>
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
  probeCount: number
  probeMetrics?: Array<ProbeMetric | null>
  probeRawMetrics?: Array<ProbeMetric | null>
  probeRawReadbackErrors?: Array<string | null>
  probeRawTextureSummaries?: Array<ProbeTextureSummary | null>
  probeRawTextureUUIDs?: Array<string | null>
  probeTextureUUIDs?: Array<string | null>
  ready: boolean
  requestedResidentProbeIndices?: number[]
  residentProbeLimit?: number
  startupVolumetricProbeCount?: number
  startupVolumetricProbeIndices?: number[]
  textureMemoryBudgetBytes?: number
}

type WorldLightingRegistryEntry = {
  isActive: boolean
  layout: MazeLayout
  mazeId: string
  resources: RuntimeLevelLightingResources
  transform: LevelWorldTransform
}

type ProbeBlendConfig = {
  diffuseIntensity?: number
  mode: ProbeBlendMode
  probeCellSize?: number
  probeCoefficients?: Array<ProbeIrradianceCoefficients | null>
  probeCoeffTextureL0?: Texture | null
  probeCoeffTextureL1?: Texture | null
  probeCoeffTextureL2?: Texture | null
  probeCoeffTextureL3?: Texture | null
  probeConnectivityTexture?: Texture | null
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
  probeWorldOrigin?: {
    x: number
    z: number
  }
  probeWorldRotationY?: number
  probeHeight?: number
  radianceIntensity?: number
  radianceMode?: ProbeBlendMode
  useProbeConnectivity?: boolean
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

const STATIC_SURFACE_LIGHTMAP_PROBE_BLEND: ProbeBlendConfig = {
  diffuseIntensity: 0,
  mode: 'none',
  probeTextures: [],
  radianceIntensity: 0,
  radianceMode: 'none',
  vlmMode: 'disabled',
  weights: [1, 0, 0, 0]
}

type ProbeBlendShader = Shader & {
  uniforms: Shader['uniforms'] & {
    lightMapAmbientTint?: Uniform<Color>
    lightMapSaturation?: Uniform<number>
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
    localProbeConnectivityTexture?: Uniform<Texture | null>
    probeBlendMode?: Uniform<number>
    probeBlendDiffuseIntensity?: Uniform<number>
    probeBlendSaturation?: Uniform<number>
    probeBoundaryNormal?: Uniform<Vector2>
    probeCellSize?: Uniform<number>
    probeHeight?: Uniform<number>
    probeGridMin?: Uniform<Vector2>
    probeGridSize?: Uniform<Vector2>
    probeWorldOrigin?: Uniform<Vector2>
    probeWorldRotationY?: Uniform<number>
    probeBlendRadianceMode?: Uniform<number>
    probeBlendRadianceIntensity?: Uniform<number>
    probeBlendRegion?: Uniform<Vector4>
    probeBlendWeights?: Uniform<Vector4>
    useProbeConnectivity?: Uniform<number>
    probeVlmMode?: Uniform<number>
  }
}

type MaterialShaderPatchConfig = {
  lightMapEncoding?: LightmapTextureEncoding
  lightMapAmbientTint?: Color
  lightMapTorchTint?: Color
  lightMapSaturation?: number
  probeSaturation?: number
}

type LightmapTextureEncoding = 'linear' | 'rgbe8'

const VolumetricShadowContext = createContext(true)
const TorchBillboardIntensityContext = createContext(1)
const LightmapSaturationContext = createContext(1)
const VolumetricSaturationContext = createContext(1)
const EMPTY_MATERIAL_SHADER_PATCH_CONFIG: MaterialShaderPatchConfig = {}

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

class SaturationEffectImpl extends Effect {
  constructor(saturation: number) {
    super('SaturationEffect', saturationEffectShader, {
      uniforms: new Map([['saturation', new Uniform(saturation)]])
    })
  }

  set saturation(value: number) {
    this.uniforms.get('saturation').value = MathUtils.clamp(value, 0, 1)
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

class RadialChromaticAberrationEffectImpl extends Effect {
  constructor() {
    super('RadialChromaticAberrationEffect', radialChromaticAberrationEffectShader, {
      uniforms: new Map([
        ['exponent', new Uniform(1)],
        ['intensity', new Uniform(0)],
        ['maxOffset', new Uniform(0.001)]
      ])
    })
  }

  set exponent(value: number) {
    this.uniforms.get('exponent').value = MathUtils.clamp(value, -8, 8)
  }

  set intensity(value: number) {
    this.uniforms.get('intensity').value = Math.max(0, value)
  }

  set maxOffset(value: number) {
    this.uniforms.get('maxOffset').value = Math.max(0, value)
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
        ['fallbackProbeAmbientColor', new Uniform(new Color(1, 1, 1))],
        ['fogDistance', new Uniform(DEFAULT_VOLUMETRIC_FOG_DISTANCE)],
        ['groundHeight', new Uniform(GROUND_Y)],
        ['heightFalloff', new Uniform(DEFAULT_VOLUMETRIC_HEIGHT_FALLOFF)],
        ['lightingStrength', new Uniform(DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH)],
        ['probeSaturation', new Uniform(1)],
        ['noiseFrequency', new Uniform(DEFAULT_VOLUMETRIC_NOISE_FREQUENCY)],
        ['noisePeriod', new Uniform(DEFAULT_VOLUMETRIC_NOISE_PERIOD)],
        ['noiseStrength', new Uniform(DEFAULT_VOLUMETRIC_NOISE_STRENGTH)],
        ['fogNoiseTexture', new Uniform(FOG_NOISE_TEXTURE)],
        ['activeProbeAtlasCount', new Uniform(0)],
        ['probeAmbientBounds', new Uniform(Array.from({ length: MAX_ACTIVE_FOG_VLM_ATLASES }, () => new Vector4()))],
        ['probeAmbientGrid', new Uniform(Array.from({ length: MAX_ACTIVE_FOG_VLM_ATLASES }, () => new Vector2(1, 1)))],
        ['probeWorldOrigin', new Uniform(Array.from({ length: MAX_ACTIVE_FOG_VLM_ATLASES }, () => new Vector2()))],
        ['probeWorldRotation', new Uniform(Array.from({ length: MAX_ACTIVE_FOG_VLM_ATLASES }, () => new Vector2(1, 0)))],
        ['probeCoeffTextureL0_0', new Uniform<Texture | null>(null)],
        ['probeCoeffTextureL0_1', new Uniform<Texture | null>(null)],
        ['probeCoeffTextureL0_2', new Uniform<Texture | null>(null)],
        ['probeCoeffTextureL0_3', new Uniform<Texture | null>(null)],
        ['probeConnectivityTexture_0', new Uniform<Texture | null>(null)],
        ['probeConnectivityTexture_1', new Uniform<Texture | null>(null)],
        ['probeConnectivityTexture_2', new Uniform<Texture | null>(null)],
        ['probeConnectivityTexture_3', new Uniform<Texture | null>(null)],
        ['probeHeight', new Uniform(1.25)],
        ['rayStepCount', new Uniform(DEFAULT_VOLUMETRIC_STEP_COUNT)],
        ['time', new Uniform(0)],
        ['useProbeCoefficientTexture', new Uniform(0)],
        ['useProbeConnectivity', new Uniform(0)],
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

  set fallbackProbeAmbientColor(value: Color) {
    this.uniforms.get('fallbackProbeAmbientColor').value.copy(value)
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

  set probeSaturation(value: number) {
    this.uniforms.get('probeSaturation').value = MathUtils.clamp(value, 0, 1)
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

  set fogNoiseTexture(value: Texture | null) {
    this.uniforms.get('fogNoiseTexture').value = value ?? FOG_NOISE_TEXTURE
  }

  set activeProbeAtlasCount(value: number) {
    this.uniforms.get('activeProbeAtlasCount').value = value
  }

  set probeAmbientBounds(value: Vector4[]) {
    const targets = this.uniforms.get('probeAmbientBounds').value as Vector4[]
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      targets[index].copy(value[index] ?? new Vector4())
    }
  }

  set probeAmbientGrid(value: Vector2[]) {
    const targets = this.uniforms.get('probeAmbientGrid').value as Vector2[]
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      targets[index].copy(value[index] ?? new Vector2(1, 1))
    }
  }

  set probeWorldOrigin(value: Vector2[]) {
    const targets = this.uniforms.get('probeWorldOrigin').value as Vector2[]
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      targets[index].copy(value[index] ?? new Vector2())
    }
  }

  set probeWorldRotation(value: Vector2[]) {
    const targets = this.uniforms.get('probeWorldRotation').value as Vector2[]
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      targets[index].copy(value[index] ?? new Vector2(1, 0))
    }
  }

  set probeCoeffTextureL0(value: Array<Texture | null>) {
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      this.uniforms.get(`probeCoeffTextureL0_${index}`).value = value[index] ?? null
    }
  }

  set probeConnectivityTexture(value: Array<Texture | null>) {
    for (let index = 0; index < MAX_ACTIVE_FOG_VLM_ATLASES; index += 1) {
      this.uniforms.get(`probeConnectivityTexture_${index}`).value = value[index] ?? null
    }
  }

  set probeHeight(value: number) {
    this.uniforms.get('probeHeight').value = value
  }

  set rayStepCount(value: number) {
    this.uniforms.get('rayStepCount').value = value
  }

  set time(value: number) {
    this.uniforms.get('time').value = value
  }

  set useProbeCoefficientTexture(value: number) {
    this.uniforms.get('useProbeCoefficientTexture').value = value
  }

  set useProbeConnectivity(value: number) {
    this.uniforms.get('useProbeConnectivity').value = value
  }

  set volumeHeight(value: number) {
    this.uniforms.get('volumeHeight').value = value
  }
}

function createDefaultVisualSettings(): VisualSettings {
  return applyVisualSettingsPatch({
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
    n8aoDenoiseIterations: 1,
    n8aoDenoiseRadius: 6,
    n8aoDenoiseSamples: 2,
    n8aoSamples: 4,
    cameraFov: 80,
    cameraTiltDegrees: MathUtils.radToDeg(DEFAULT_CAMERA_PITCH),
    exposureStops: DEFAULT_EXPOSURE_STOPS,
    hdriBrightness: DEFAULT_HDRI_BRIGHTNESS,
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
      colorGain: 1,
      enabled: true,
      flareShape: 0.03,
      flareSize: 0.0015,
      flareSpeed: 0.01,
      ghostScale: 0,
      glareSize: 0,
      haloScale: 0.16,
      intensity: 0.01,
      opacity: 0.01,
      secondaryGhosts: true,
      starBurst: false,
      starBurstIntensity: 1,
      starPoints: 3
    },
    minotaurAlbedoHex: DEFAULT_MINOTAUR_ALBEDO_HEX,
    monsterEyeColors: { ...DEFAULT_MONSTER_EYE_COLORS },
    probeDebugMode: 'none',
    reflectionContribution: {
      enabled: true,
      intensity: DEFAULT_REFLECTION_INTENSITY
    },
    saturation: DEFAULT_SATURATION,
    lightmapSaturation: 1,
    staticVolumetricContribution: {
      enabled: false,
      intensity: DEFAULT_PROBE_IBL_INTENSITY
    },
    torchBillboardIntensity: 1,
    unlitMode: false,
    toneMapping: 'neutral',
    bloom: {
      enabled: false,
      intensity: 0.65,
      kernelSize: 'huge',
      resolutionScale: 0.25,
      smoothing: 0.5,
      threshold: 0.5
    },
    chromaticAberration: {
      enabled: false,
      exponent: 1,
      intensity: 0,
      modulationOffset: 0.15,
      offsetX: 0.001,
      offsetY: 0.001,
      radialModulation: false,
      screenShakeIntensity: 0
    },
    depthOfField: {
      bokehScale: 0,
      enabled: false,
      focusDistance: 0.02,
      focusRange: 0.03,
      resolutionScale: 0.25
    },
    movement: {
      accelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalAccelerationDistance,
      decelerationDistance:
        DEFAULT_MOVEMENT_SETTINGS.horizontalDecelerationDistance,
      maxHorizontalSpeedMph: DEFAULT_MOVEMENT_SETTINGS.maxHorizontalSpeedMph
    },
    monsterEyes: structuredClone(DEFAULT_MONSTER_EYES),
    precomputedVisibilityEnabled: true,
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
    volumetricHeightFalloff: DEFAULT_VOLUMETRIC_HEIGHT_FALLOFF,
    volumetricLightingStrength: DEFAULT_VOLUMETRIC_LIGHTING_STRENGTH,
    volumetricLighting: { enabled: true, intensity: DEFAULT_VOLUMETRIC_INTENSITY },
    volumetricNoiseFrequency: DEFAULT_VOLUMETRIC_NOISE_FREQUENCY,
    volumetricNoisePeriod: DEFAULT_VOLUMETRIC_NOISE_PERIOD,
    volumetricNoiseStrength: DEFAULT_VOLUMETRIC_NOISE_STRENGTH,
    volumetricSaturation: 1,
    volumetricShadowsEnabled: true,
    volumetricStepCount: DEFAULT_VOLUMETRIC_STEP_COUNT,
    vignette: {
      enabled: true,
      exposureNoiseIntensity: 0,
      intensity: 0.6,
      noiseIntensity: 0,
      noisePeriod: 5
    }
  }, defaultVisualSettingsConfig as VisualSettingsPatch)
}

function shouldUseMobileVisualDefaults() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(max-width: 760px)').matches
  )
}

function createInitialVisualSettings(): VisualSettings {
  const defaults = createDefaultVisualSettings()

  if (!shouldUseMobileVisualDefaults()) {
    return defaults
  }

  return applyVisualSettingsPatch(defaults, {
    ambientOcclusionMode: 'off',
    unlitMode: true,
    volumetricLighting: {
      enabled: false
    }
  })
}

function isEffectActive(effect: EffectSettings) {
  return effect.enabled && effect.intensity > EFFECT_EPSILON
}

function getEnabledContributionIntensity(settings: LightingContributionSettings) {
  return settings.enabled ? settings.intensity : 0
}

function applyLensFlareSettingsPatch(
  settings: LensFlareSettings,
  patch: Partial<LensFlareSettings>
) {
  const strength = patch.opacity ?? patch.intensity

  return {
    ...settings,
    ...patch,
    ...(strength === undefined
      ? null
      : {
          intensity: strength,
          opacity: strength
        })
  }
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
    ...(patch.n8aoDenoiseIterations === undefined
      ? null
      : { n8aoDenoiseIterations: patch.n8aoDenoiseIterations }),
    ...(patch.n8aoDenoiseRadius === undefined
      ? null
      : { n8aoDenoiseRadius: patch.n8aoDenoiseRadius }),
    ...(patch.n8aoDenoiseSamples === undefined
      ? null
      : { n8aoDenoiseSamples: patch.n8aoDenoiseSamples }),
    ...(patch.n8aoSamples === undefined
      ? null
      : { n8aoSamples: patch.n8aoSamples }),
    ...(patch.exposureStops === undefined
      ? null
      : { exposureStops: patch.exposureStops }),
    ...(patch.cameraFov === undefined
      ? null
      : { cameraFov: patch.cameraFov }),
    ...(patch.cameraTiltDegrees === undefined
      ? null
      : { cameraTiltDegrees: patch.cameraTiltDegrees }),
    ...(patch.hdriBrightness === undefined
      ? null
      : { hdriBrightness: patch.hdriBrightness }),
    ...(patch.minotaurAlbedoHex === undefined
      ? null
      : {
          minotaurAlbedoHex: normalizeHexColor(
            patch.minotaurAlbedoHex,
            settings.minotaurAlbedoHex
          )
        }),
    ...(patch.probeDebugMode === undefined
      ? null
      : { probeDebugMode: patch.probeDebugMode }),
    ...(patch.precomputedVisibilityEnabled === undefined
      ? null
      : { precomputedVisibilityEnabled: patch.precomputedVisibilityEnabled }),
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
    ...(patch.volumetricSaturation === undefined
      ? null
      : { volumetricSaturation: patch.volumetricSaturation }),
    ...(patch.volumetricShadowsEnabled === undefined
      ? null
      : { volumetricShadowsEnabled: patch.volumetricShadowsEnabled }),
    ...(patch.volumetricStepCount === undefined
      ? null
      : { volumetricStepCount: patch.volumetricStepCount }),
    ...(patch.torchBillboardIntensity === undefined
      ? null
      : { torchBillboardIntensity: patch.torchBillboardIntensity }),
    ...(patch.unlitMode === undefined
      ? null
      : { unlitMode: patch.unlitMode }),
    ...(patch.saturation === undefined
      ? null
      : { saturation: patch.saturation }),
    ...(patch.lightmapSaturation === undefined
      ? null
      : { lightmapSaturation: patch.lightmapSaturation }),
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
    chromaticAberration: patch.chromaticAberration
      ? {
          ...settings.chromaticAberration,
          ...patch.chromaticAberration
        }
      : settings.chromaticAberration,
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
      ? applyLensFlareSettingsPatch(settings.lensFlare, patch.lensFlare)
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
    monsterEyeColors: patch.monsterEyeColors
      ? {
          minotaur: normalizeHexColor(
            patch.monsterEyeColors.minotaur ?? settings.monsterEyeColors.minotaur,
            settings.monsterEyeColors.minotaur
          ),
          spider: normalizeHexColor(
            patch.monsterEyeColors.spider ?? settings.monsterEyeColors.spider,
            settings.monsterEyeColors.spider
          ),
          werewolf: normalizeHexColor(
            patch.monsterEyeColors.werewolf ?? settings.monsterEyeColors.werewolf,
            settings.monsterEyeColors.werewolf
          )
        }
      : settings.monsterEyeColors,
    monsterEyes: patch.monsterEyes
      ? {
          minotaur: {
            left: {
              ...settings.monsterEyes.minotaur.left,
              ...patch.monsterEyes.minotaur?.left
            },
            right: {
              ...settings.monsterEyes.minotaur.right,
              ...patch.monsterEyes.minotaur?.right
            }
          },
          spider: {
            left: {
              ...settings.monsterEyes.spider.left,
              ...patch.monsterEyes.spider?.left
            },
            right: {
              ...settings.monsterEyes.spider.right,
              ...patch.monsterEyes.spider?.right
            }
          },
          werewolf: {
            left: {
              ...settings.monsterEyes.werewolf.left,
              ...patch.monsterEyes.werewolf?.left
            },
            right: {
              ...settings.monsterEyes.werewolf.right,
              ...patch.monsterEyes.werewolf?.right
            }
          }
        }
      : settings.monsterEyes,
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

function isObjectEffectivelyVisible(object: Object3D) {
  let current: Object3D | null = object

  while (current) {
    if (!current.visible) {
      return false
    }
    current = current.parent
  }

  return true
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

// The SH coefficients store average incoming radiance. Three's PBR indirect
// diffuse hook expects irradiance, so the SH convolution below is calibrated to
// return pi * radiance for a constant environment.
const float LEVELSJAM_VLM_IRRADIANCE_TO_THREE_IBL_RADIANCE = 0.3183098861837907;

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
uniform sampler2D localProbeConnectivityTexture;
#endif
uniform vec2 probeBoundaryNormal;
uniform float probeCellSize;
uniform float probeHeight;
uniform vec2 probeGridMin;
uniform vec2 probeGridSize;
uniform vec2 probeWorldOrigin;
uniform float probeWorldRotationY;
uniform float useProbeConnectivity;
uniform int probeVlmMode;

${PROBE_CUBEUV_SAMPLING_GLSL}

vec3 decodeRGBE8( vec4 rgbe ) {
  if ( rgbe.a <= 0.0 ) {
    return vec3( 0.0 );
  }

  float exponent = ( rgbe.a * 255.0 ) - 128.0;
  return rgbe.rgb * exp2( exponent );
}

vec3 applyLevelsJamSaturation( vec3 color, float saturation ) {
  float luminance = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  return mix( vec3( luminance ), color, clamp( saturation, 0.0, 1.0 ) );
}

float probeBlendSafeComponent( float value ) {
  if ( abs( value ) < 0.0001 ) {
    return value < 0.0 ? -0.0001 : 0.0001;
  }

  return value;
}

vec3 probeBlendWorldToLocalPosition( vec3 worldPosition ) {
  vec2 translated = worldPosition.xz - probeWorldOrigin;
  float c = cos( probeWorldRotationY );
  float s = sin( probeWorldRotationY );

  return vec3(
    ( translated.x * c ) - ( translated.y * s ),
    worldPosition.y,
    ( translated.x * s ) + ( translated.y * c )
  );
}

vec3 probeBlendWorldToLocalDirection( vec3 worldDirection ) {
  float c = cos( probeWorldRotationY );
  float s = sin( probeWorldRotationY );

  return normalize( vec3(
    ( worldDirection.x * c ) - ( worldDirection.z * s ),
    worldDirection.y,
    ( worldDirection.x * s ) + ( worldDirection.z * c )
  ) );
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
  ) * 12.566370614359172 * LEVELSJAM_VLM_IRRADIANCE_TO_THREE_IBL_RADIANCE;
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

float sampleProbeGridConnectivity( vec2 originCell, vec2 candidateCell ) {
  if ( useProbeConnectivity < 0.5 ) {
    return 1.0;
  }

  vec2 fromCell = clampProbeGridCell( originCell );
  vec2 toCell = clampProbeGridCell( candidateCell );
  vec2 delta = toCell - fromCell;
  float manhattan = abs( delta.x ) + abs( delta.y );

  if ( manhattan <= 0.001 ) {
    return 1.0;
  }

  if ( manhattan > 1.001 ) {
    return 0.0;
  }

  vec4 connectivity = texture2D( localProbeConnectivityTexture, probeGridCellToUv( fromCell ) );

  if ( delta.y < -0.5 ) {
    return connectivity.r;
  }
  if ( delta.x > 0.5 ) {
    return connectivity.g;
  }
  if ( delta.y > 0.5 ) {
    return connectivity.b;
  }
  if ( delta.x < -0.5 ) {
    return connectivity.a;
  }

  return 0.0;
}

float probeGridKernelWeight( vec2 gridPosition, vec2 cell ) {
  vec2 distanceToCell = abs( gridPosition - cell );
  vec2 axisWeight = vec2(
    1.0 - smoothstep( 0.5, 1.5, distanceToCell.x ),
    1.0 - smoothstep( 0.5, 1.5, distanceToCell.y )
  );

  return axisWeight.x * axisWeight.y;
}

float sampleProbeGridConnectivityBlended( vec2 gridPosition, vec2 candidateCell ) {
  if ( useProbeConnectivity < 0.5 ) {
    return 1.0;
  }

  vec2 nearestCell = floor( gridPosition + vec2( 0.5 ) );
  float accumulatedVisibility = 0.0;
  float accumulatedWeight = 0.0;

  for ( int x = -1; x <= 1; x += 1 ) {
    for ( int y = -1; y <= 1; y += 1 ) {
      vec2 originCell = nearestCell + vec2( float( x ), float( y ) );
      float weight = probeGridKernelWeight( gridPosition, originCell );

      if ( weight <= 0.0001 ) {
        continue;
      }

      accumulatedVisibility += sampleProbeGridConnectivity( originCell, candidateCell ) * weight;
      accumulatedWeight += weight;
    }
  }

  if ( accumulatedWeight <= 0.0001 ) {
    return 0.0;
  }

  return accumulatedVisibility / accumulatedWeight;
}

vec4 sampleProbeGridCandidate(
  vec3 worldPosition,
  vec3 direction,
  vec2 gridPosition,
  vec2 cell
) {
  vec2 clampedCell = clampProbeGridCell( cell );
  vec2 uv = probeGridCellToUv( clampedCell );
  vec4 coeff0 = texture2D( localProbeCoeffTextureL0, uv );

  if ( coeff0.a <= 0.0 ) {
    return vec4( 0.0 );
  }

  float visibility = sampleProbeGridConnectivityBlended( gridPosition, clampedCell );

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

      accumulated += sampleProbeGridCandidate( worldPosition, direction, gridPosition, cell ) * spatialWeight;
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
  vec2 gridPosition = ( worldPosition.xz - probeGridMin ) / max( probeCellSize, 0.0001 );
  vec2 boundaryNormalInput = probeBoundaryNormal;

  if ( length( boundaryNormalInput ) <= 0.0001 ) {
    return sampleProbeGridDiffuseCell5( worldPosition, direction );
  }

  vec2 boundaryNormal = normalize( boundaryNormalInput );
  vec2 tangent = vec2( -boundaryNormal.y, boundaryNormal.x );
  vec4 accumulated = vec4( 0.0 );

  for ( int normalIndex = 0; normalIndex < 2; normalIndex += 1 ) {
    float normalOffset = normalIndex == 0 ? -0.5 : 0.5;

    for ( int tangentIndex = 0; tangentIndex < 4; tangentIndex += 1 ) {
      float tangentOffset = float( tangentIndex ) - 1.5;
      vec2 sampleGridPosition = gridPosition +
        ( boundaryNormal * normalOffset ) +
        ( tangent * tangentOffset * 0.5 );
      vec2 cell = floor( sampleGridPosition + vec2( 0.5 ) );
      float spatialWeight =
        ( 1.0 - smoothstep( 0.5, 1.5, abs( normalOffset ) ) ) *
        ( 1.0 - smoothstep( 0.75, 1.75, abs( tangentOffset * 0.5 ) ) );

      if ( spatialWeight <= 0.0001 ) {
        continue;
      }

      accumulated += sampleProbeGridCandidate(
        worldPosition,
        direction,
        gridPosition,
        cell
      ) * spatialWeight;
    }
  }

  if ( accumulated.a <= 0.0001 ) {
    return vec3( 0.0 );
  }

  return accumulated.rgb / accumulated.a;
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
  vec3 probeLocalPosition = probeBlendWorldToLocalPosition( vProbeBlendWorldPosition );
  float tx = probeBlendRegion.z > 0.0
    ? clamp( ( probeLocalPosition.x - probeBlendRegion.x ) / probeBlendRegion.z, 0.0, 1.0 )
    : 0.0;
  float tz = probeBlendRegion.w > 0.0
    ? clamp( ( probeLocalPosition.z - probeBlendRegion.y ) / probeBlendRegion.w, 0.0, 1.0 )
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
  vec3 probeLocalPosition = probeBlendWorldToLocalPosition( vProbeBlendWorldPosition );
  vec3 probeLocalDirection = probeBlendWorldToLocalDirection( direction );
#if defined(PROBE_BLEND_ENABLE_LOCAL_RADIANCE) && defined(USE_ENVMAP)
  if ( mode == 1 ) {
    return sampleProbeBlendLocalRadiance(
      probeLocalPosition,
      probeLocalDirection,
      roughness,
      probeBlendGetWorldWeights(),
      intensity
    );
  }

  if ( mode == 2 ) {
    return sampleProbeBlendLocalRadiance(
      probeLocalPosition,
      probeLocalDirection,
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
  vec3 probeLocalPosition = probeBlendWorldToLocalPosition( vProbeBlendWorldPosition );
  vec3 probeLocalDirection = probeBlendWorldToLocalDirection( direction );
#if defined(PROBE_BLEND_ENABLE_VLM_TEXTURES)
  if ( probeVlmMode == 1 ) {
    return sampleProbeGridDiffuseCell5(
      probeLocalPosition,
      probeLocalDirection
    ) * intensity;
  }

  if ( probeVlmMode == 2 ) {
    return sampleProbeGridDiffuseBoundary8(
      probeLocalPosition,
      probeLocalDirection
    ) * intensity;
  }
#endif

  if ( mode == 1 ) {
    return sampleProbeBlendLocalDiffuse(
      probeLocalPosition,
      probeLocalDirection,
      probeBlendGetWorldWeights(),
      intensity
    );
  }

  if ( mode == 2 ) {
    return sampleProbeBlendLocalDiffuse(
      probeLocalPosition,
      probeLocalDirection,
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
    envMapColor = applyLevelsJamSaturation( envMapColor, probeBlendSaturation );

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

\t\tfloat lightMapLuminance = dot( lightMapColor, vec3( 0.2126, 0.7152, 0.0722 ) );
\t\tvec3 saturatedLightMapColor = mix( vec3( lightMapLuminance ), lightMapColor, clamp( lightMapSaturation, 0.0, 1.0 ) );
\t\tvec3 lightMapIrradiance = saturatedLightMapColor * lightMapIntensity;

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
  if (shader.uniforms.lightMapSaturation) {
    shader.uniforms.lightMapSaturation.value = MathUtils.clamp(
      patchConfig.lightMapSaturation ?? 1,
      0,
      1
    )
  }
  shader.uniforms.lightMapTorchTint?.value.copy(
    patchConfig.lightMapTorchTint ?? WHITE_COLOR
  )
  if (shader.uniforms.probeBlendSaturation) {
    shader.uniforms.probeBlendSaturation.value = MathUtils.clamp(
      patchConfig.probeSaturation ?? 1,
      0,
      1
    )
  }

  const probePositions = probeBlend.probePositions ?? []
  const probeBoxes = probeBlend.probeBoxes ?? []
  const probeCoefficients = probeBlend.probeCoefficients ?? []
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
    shader.uniforms.localProbeEnvMap0.value = probeBlend.probeTextures[0] ?? getDummyProbeEnvMapTexture()
  }
  if (shader.uniforms.localProbeEnvMap1) {
    shader.uniforms.localProbeEnvMap1.value = probeBlend.probeTextures[1] ?? getDummyProbeEnvMapTexture()
  }
  if (shader.uniforms.localProbeEnvMap2) {
    shader.uniforms.localProbeEnvMap2.value = probeBlend.probeTextures[2] ?? getDummyProbeEnvMapTexture()
  }
  if (shader.uniforms.localProbeEnvMap3) {
    shader.uniforms.localProbeEnvMap3.value = probeBlend.probeTextures[3] ?? getDummyProbeEnvMapTexture()
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
  if (shader.uniforms.localProbeConnectivityTexture) {
    shader.uniforms.localProbeConnectivityTexture.value = probeBlend.probeConnectivityTexture ?? null
  }
  if (shader.uniforms.probeCellSize) {
    shader.uniforms.probeCellSize.value = probeBlend.probeCellSize ?? MAZE_CELL_SIZE
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
  shader.uniforms.probeWorldOrigin?.value.set(
    probeBlend.probeWorldOrigin?.x ?? 0,
    probeBlend.probeWorldOrigin?.z ?? 0
  )
  if (shader.uniforms.probeWorldRotationY) {
    shader.uniforms.probeWorldRotationY.value =
      probeBlend.probeWorldRotationY ?? 0
  }
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
  if (shader.uniforms.useProbeConnectivity) {
    shader.uniforms.useProbeConnectivity.value =
      probeBlend.useProbeConnectivity !== false &&
      Boolean(probeBlend.probeConnectivityTexture)
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
    lightMapSaturation: patchConfig.lightMapSaturation ?? 1,
    probeSaturation: patchConfig.probeSaturation ?? 1,
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
    probeConnectivityTextureUUID: probeBlend.probeConnectivityTexture?.uuid ?? null,
    useProbeConnectivity: probeBlend.useProbeConnectivity !== false,
    probeGridMin: probeBlend.probeGridMin
      ? [probeBlend.probeGridMin.x, probeBlend.probeGridMin.z]
      : null,
    probeGridSize: probeBlend.probeGridSize
      ? [probeBlend.probeGridSize.x, probeBlend.probeGridSize.y]
      : null,
    probeWorldOrigin: probeBlend.probeWorldOrigin
      ? [probeBlend.probeWorldOrigin.x, probeBlend.probeWorldOrigin.z]
      : null,
    probeWorldRotationY: probeBlend.probeWorldRotationY ?? 0,
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
  return `${role}:${getProbeBlendProgramKey(probeBlend, patchConfig)}`
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

  return [
    'probe-blend-v5',
    usesTintedLightMap ? 'lightmap-tint' : 'plain',
    `lightmap-${lightMapEncoding}`,
    probeBlend.mode,
    activeRadianceMode,
    probeBlend.vlmMode ?? 'disabled',
    probeBlend.useProbeConnectivity !== false ? 'vlm-connectivity' : 'vlm-unshadowed'
  ].join('-')
}

function estimateProbeBlendFragmentSamplerCount(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial,
  probeBlend: ProbeBlendConfig
) {
  const materialSamplerCount = MATERIAL_SAMPLER_TEXTURE_PROPERTY_NAMES.reduce(
    (count, propertyName) => (
      (material as unknown as Record<string, Texture | null | undefined>)[propertyName]
        ? count + 1
        : count
    ),
    0
  )
  const activeRadianceMode = probeBlend.radianceMode ?? probeBlend.mode
  const localRadianceSamplerCount =
    activeRadianceMode === 'world' || activeRadianceMode === 'constant'
      ? 4
      : 0
  const vlmCoefficientSamplerCount =
    probeBlend.vlmMode && probeBlend.vlmMode !== 'disabled'
      ? 4
      : 0
  const vlmConnectivitySamplerCount =
    probeBlend.vlmMode &&
    probeBlend.vlmMode !== 'disabled' &&
    probeBlend.useProbeConnectivity !== false
      ? 1
      : 0

  return (
    materialSamplerCount +
    localRadianceSamplerCount +
    vlmCoefficientSamplerCount +
    vlmConnectivitySamplerCount
  )
}

function updateProbeBlendMaterialDebugState(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  probeBlend: ProbeBlendConfig
) {
  if (!material) {
    return
  }

  material.userData.probeBlendDebug = {
    diffuseIntensity: probeBlend.diffuseIntensity ?? 1,
    mode: probeBlend.mode,
    probeConnectivity: Boolean(probeBlend.probeConnectivityTexture),
    estimatedFragmentSamplerCount: estimateProbeBlendFragmentSamplerCount(
      material,
      probeBlend
    ),
    radianceIntensity: probeBlend.radianceIntensity ?? 1,
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
    probeBlendDiffuseIntensity: shader.uniforms.probeBlendDiffuseIntensity?.value ?? null,
    probeVlmMode: shader.uniforms.probeVlmMode?.value ?? null,
    probeBlendRadianceMode: shader.uniforms.probeBlendRadianceMode?.value ?? null,
    probeBlendRadianceIntensity: shader.uniforms.probeBlendRadianceIntensity?.value ?? null,
    probeWorldOrigin: shader.uniforms.probeWorldOrigin
      ? [
          shader.uniforms.probeWorldOrigin.value.x,
          shader.uniforms.probeWorldOrigin.value.y
        ]
      : null,
    probeWorldRotationY: shader.uniforms.probeWorldRotationY?.value ?? null
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
  probeBlendShader.uniforms.lightMapSaturation = new Uniform(1)
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
  probeBlendShader.uniforms.localProbeConnectivityTexture = new Uniform<Texture | null>(null)
  probeBlendShader.uniforms.probeBlendMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendDiffuseIntensity = new Uniform(1)
  probeBlendShader.uniforms.probeBlendSaturation = new Uniform(1)
  probeBlendShader.uniforms.probeBoundaryNormal = new Uniform(new Vector2(0, 1))
  probeBlendShader.uniforms.probeCellSize = new Uniform(MAZE_CELL_SIZE)
  probeBlendShader.uniforms.probeHeight = new Uniform(1.25)
  probeBlendShader.uniforms.probeGridMin = new Uniform(new Vector2(0, 0))
  probeBlendShader.uniforms.probeGridSize = new Uniform(new Vector2(1, 1))
  probeBlendShader.uniforms.probeWorldOrigin = new Uniform(new Vector2(0, 0))
  probeBlendShader.uniforms.probeWorldRotationY = new Uniform(0)
  probeBlendShader.uniforms.probeBlendRadianceMode = new Uniform(0)
  probeBlendShader.uniforms.probeBlendRadianceIntensity = new Uniform(1)
  probeBlendShader.uniforms.probeBlendWeights = new Uniform(new Vector4(1, 0, 0, 0))
  probeBlendShader.uniforms.probeBlendRegion = new Uniform(new Vector4(0, 0, 0, 0))
  probeBlendShader.uniforms.useProbeConnectivity = new Uniform(0)
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
    `${shaderFeatureDefines}${vlmFeatureDefines}${lightMapFeatureDefines}uniform vec3 lightMapAmbientTint;\nuniform float lightMapSaturation;\nuniform vec3 lightMapTorchTint;\nuniform float probeBlendDiffuseIntensity;\nuniform float probeBlendSaturation;\nuniform float probeBlendRadianceIntensity;\nvarying vec3 vProbeBlendWorldPosition;\n${probeBlendShader.fragmentShader}`
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

type LevelWorldTransform = {
  rotationY: number
  x: number
  z: number
}

type SeamlessLevelTransitionRequest = {
  committedGlobalState?: GlobalTurnState
  sourcePreviousState?: TurnState
  sourceLevelId: string
  sourceState: TurnState
  targetLevelId: string
}

const IDENTITY_LEVEL_WORLD_TRANSFORM: LevelWorldTransform = {
  rotationY: 0,
  x: 0,
  z: 0
}

const LevelRenderTransformContext = createContext<LevelWorldTransform>(
  IDENTITY_LEVEL_WORLD_TRANSFORM
)

type PrecomputedVisibilityState = {
  enabled: boolean
  playerCell: { x: number; y: number }
  visibleCells: Set<string> | null
}

const DISABLED_PRECOMPUTED_VISIBILITY: PrecomputedVisibilityState = {
  enabled: false,
  playerCell: { x: 0, y: 0 },
  visibleCells: null
}

function getTransformedMazeCellWorldPosition(
  maze: MazeLayout['maze'],
  transform: LevelWorldTransform,
  cell: { x: number; y: number },
  y = GROUND_Y
) {
  const localPosition = getMazeCellWorldPosition(maze, cell, y)
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return new Vector3(
    transform.x + (localPosition.x * cos) + (localPosition.z * sin),
    localPosition.y,
    transform.z - (localPosition.x * sin) + (localPosition.z * cos)
  )
}

function transformLevelLocalPositionToWorld(
  position: { x: number; y?: number; z: number },
  transform: LevelWorldTransform,
  target = new Vector3()
) {
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return target.set(
    transform.x + (position.x * cos) + (position.z * sin),
    position.y ?? GROUND_Y,
    transform.z - (position.x * sin) + (position.z * cos)
  )
}

function transformWorldPositionToLevelLocal(
  position: Vector3,
  transform: LevelWorldTransform,
  target = new Vector3()
) {
  const dx = position.x - transform.x
  const dz = position.z - transform.z
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)

  return target.set(
    (dx * cos) - (dz * sin),
    position.y,
    (dx * sin) + (dz * cos)
  )
}

function transformWorldQuaternionToLevelLocal(
  quaternion: Quaternion,
  transform: LevelWorldTransform,
  target = new Quaternion()
) {
  return target
    .setFromAxisAngle(LEVEL_UP_VECTOR, -transform.rotationY)
    .multiply(quaternion)
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

function findIngressCellForTransition(
  targetMaze: MazeLayout['maze'],
  sourceLevelId: string
) {
  return findIngressCellForGlobalTransition(targetMaze, sourceLevelId)
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

function getMazeCellKey(cell: { x: number; y: number }) {
  return cellKey(cell)
}

function getMazeCellFromWorldXZ(maze: MazeLayout['maze'], x: number, z: number) {
  const originX = -((maze.width * MAZE_CELL_SIZE) / 2)
  const originZ = -((maze.height * MAZE_CELL_SIZE) / 2)

  return {
    x: MathUtils.clamp(Math.floor((x - originX) / MAZE_CELL_SIZE), 0, maze.width - 1),
    y: MathUtils.clamp(Math.floor((z - originZ) / MAZE_CELL_SIZE), 0, maze.height - 1)
  }
}

function parseMazeCellKey(value: string) {
  const [x, y] = value.split(',').map(Number)

  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null
}

function isCellVisible(
  visibility: PrecomputedVisibilityState,
  cell: { x: number; y: number } | null | undefined
) {
  return (
    !visibility.enabled ||
    !visibility.visibleCells ||
    !cell ||
    visibility.visibleCells.has(getMazeCellKey(cell))
  )
}

function getWallVisibilityCells(wallId: string) {
  if (wallId.includes('|')) {
    return wallId
      .split('|')
      .map(parseMazeCellKey)
      .filter((cell): cell is { x: number; y: number } => Boolean(cell))
  }

  const [cellPart] = wallId.split(':')
  const cell = parseMazeCellKey(cellPart)

  return cell ? [cell] : []
}

function isWallVisible(
  visibility: PrecomputedVisibilityState,
  wall: MazeLayout['walls'][number]
) {
  return getWallVisibilityCells(wall.id).some((cell) => isCellVisible(visibility, cell))
}

function isIndoorExteriorWallVisible(
  layout: MazeLayout,
  wall: MazeLayout['walls'][number]
) {
  return isIndoorLayout(layout) && wall.id.endsWith(':exterior')
}

function isMazeWallVisible(
  layout: MazeLayout,
  visibility: PrecomputedVisibilityState,
  wall: MazeLayout['walls'][number]
) {
  return isIndoorExteriorWallVisible(layout, wall) || isWallVisible(visibility, wall)
}

function isPositionCellVisible(
  layout: MazeLayout,
  visibility: PrecomputedVisibilityState,
  position: { x: number; z: number }
) {
  return isCellVisible(
    visibility,
    getMazeCellFromWorldXZ(layout.maze, position.x, position.z)
  )
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

let dummyTransparentTexture: Texture | null = null

function getDummyTransparentTexture() {
  if (dummyTransparentTexture) {
    return dummyTransparentTexture
  }

  const texture = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat, UnsignedByteType)

  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  dummyTransparentTexture = texture
  return texture
}

let dummyWhiteTexture: Texture | null = null

function getDummyWhiteTexture() {
  if (dummyWhiteTexture) {
    return dummyWhiteTexture
  }

  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType)

  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  dummyWhiteTexture = texture
  return texture
}

function createProbeBlendWarmupConfig(vlmMode: ProbeVlmMode): ProbeBlendConfig {
  const dummyProbeTexture = getDummyProbeEnvMapTexture()
  const dummyDataTexture = getDummyTransparentTexture()

  return {
    diffuseIntensity: 1,
    mode: 'disabled',
    probeBoxes: Array.from({ length: 4 }, () => ({
      max: DEFAULT_PROBE_BOX_MAX,
      min: DEFAULT_PROBE_BOX_MIN
    })),
    probeCellSize: MAZE_CELL_SIZE,
    probeCoeffTextureL0: dummyDataTexture,
    probeCoeffTextureL1: dummyDataTexture,
    probeCoeffTextureL2: dummyDataTexture,
    probeCoeffTextureL3: dummyDataTexture,
    probeConnectivityTexture: dummyDataTexture,
    probeGridMin: new Vector2(0, 0),
    probeGridSize: new Vector2(1, 1),
    probeHeight: 1.25,
    probePositions: Array.from({ length: 4 }, () => DEFAULT_PROBE_POSITION),
    probeTextureInfos: Array.from({ length: 4 }, () => DEFAULT_PROBE_TEXTURE_INFO),
    probeTextures: Array.from({ length: 4 }, () => dummyProbeTexture),
    probeWorldOrigin: new Vector2(0, 0),
    probeWorldRotationY: 0,
    radianceIntensity: 1,
    radianceMode: 'constant',
    useProbeConnectivity: true,
    vlmBoundaryNormal: vlmMode === 'boundary8'
      ? { x: 1, z: 0 }
      : undefined,
    vlmMode,
    weights: [1, 0, 0, 0]
  }
}

function createUvLessTriangleGeometry() {
  const geometry = new BufferGeometry()

  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([
      -0.4, 0, 0,
      0.4, 0, 0,
      0, 0.6, 0
    ], 3)
  )
  geometry.computeVertexNormals()
  return geometry
}

function createUvWarmupGeometry(includeLightmapUv: boolean) {
  const geometry = new PlaneGeometry(0.2, 0.2)

  if (includeLightmapUv) {
    const uv = geometry.getAttribute('uv')

    if (uv) {
      geometry.setAttribute('uv1', uv.clone())
    }
  }

  return geometry
}

function createProbeBlendWarmupMaterial({
  lightmapped,
  mapped,
  probeBlend
}: {
  lightmapped: boolean
  mapped: boolean
  probeBlend: ProbeBlendConfig
}) {
  const dummyTexture = getDummyWhiteTexture()
  const material = new ThreeMeshStandardMaterial({
    color: WHITE_COLOR.clone(),
    envMap: getProbeBlendEnvMap(probeBlend),
    envMapIntensity: 0,
    lightMap: lightmapped ? dummyTexture : null,
    lightMapIntensity: lightmapped ? 1 : 0,
    map: mapped ? dummyTexture : null,
    metalnessMap: mapped ? dummyTexture : null,
    normalMap: mapped ? dummyTexture : null,
    roughnessMap: mapped ? dummyTexture : null
  })
  const patchConfig: MaterialShaderPatchConfig = lightmapped
    ? {
        lightMapAmbientTint: LIGHTMAP_AMBIENT_TINT,
        lightMapEncoding: 'rgbe8',
        lightMapTorchTint: TORCH_LIGHTMAP_TINT
      }
    : {}

  attachProbeBlendMaterialShader(material, probeBlend, patchConfig, { current: null })
  return material
}

function warmProbeBlendMaterialVariants(
  gl: WebGLRenderer,
  scene: ThreeScene,
  camera: ThreeCamera
) {
  const renderWarmupGroup = (group: Group) => {
    const previousRenderTarget = gl.getRenderTarget()
    const warmupTarget = new WebGLRenderTarget(1, 1)
    const warmupScene = new ThreeScene()

    warmupScene.add(group)
    group.visible = true
    try {
      gl.compile(warmupScene, camera)
      gl.setRenderTarget(warmupTarget)
      gl.render(warmupScene, camera)
      gl.setRenderTarget(previousRenderTarget)
    } finally {
      warmupScene.remove(group)
      warmupTarget.dispose()
      group.visible = false
    }
  }
  const existingGroup = scene.userData.probeBlendWarmupGroup as Group | undefined

  if (existingGroup) {
    renderWarmupGroup(existingGroup)
    return
  }

  const group = new Group()
  const cell5ProbeBlend = createProbeBlendWarmupConfig('cell5')
  const boundary8ProbeBlend = createProbeBlendWarmupConfig('boundary8')
  const cases = [
    {
      geometry: createUvWarmupGeometry(false),
      material: createProbeBlendWarmupMaterial({
        lightmapped: false,
        mapped: true,
        probeBlend: cell5ProbeBlend
      })
    },
    {
      geometry: createUvLessTriangleGeometry(),
      material: createProbeBlendWarmupMaterial({
        lightmapped: false,
        mapped: false,
        probeBlend: cell5ProbeBlend
      })
    },
    {
      geometry: createUvWarmupGeometry(false),
      material: createProbeBlendWarmupMaterial({
        lightmapped: false,
        mapped: true,
        probeBlend: boundary8ProbeBlend
      })
    },
    {
      geometry: createUvWarmupGeometry(true),
      material: createProbeBlendWarmupMaterial({
        lightmapped: true,
        mapped: true,
        probeBlend: STATIC_SURFACE_LIGHTMAP_PROBE_BLEND
      })
    },
    {
      geometry: createUvWarmupGeometry(true),
      material: createProbeBlendWarmupMaterial({
        lightmapped: true,
        mapped: false,
        probeBlend: STATIC_SURFACE_LIGHTMAP_PROBE_BLEND
      })
    }
  ]

  cases.forEach(({ geometry, material }, index) => {
    const mesh = new Mesh(geometry, material)

    mesh.castShadow = true
    mesh.frustumCulled = false
    mesh.receiveShadow = true
    mesh.position.set(index * 0.3, 0.1, -2)
    group.add(mesh)
  })

  scene.add(group)
  scene.userData.probeBlendWarmupGroup = group
  renderWarmupGroup(group)
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

type MazeOpenEdge = {
  from: { x: number, y: number }
  to: { x: number, y: number }
}

const probeConnectivityTextureCache = new WeakMap<MazeLayout, Texture>()

function getProbeConnectivityTexture(layout: MazeLayout) {
  const cached = probeConnectivityTextureCache.get(layout)

  if (cached) {
    return cached
  }

  const width = Math.max(1, layout.maze.width)
  const height = Math.max(1, layout.maze.height)
  const data = new Uint8Array(width * height * 4)
  const setChannel = (x: number, y: number, channel: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return
    }

    data[((y * width + x) * 4) + channel] = 255
  }
  const setConnected = (from: MazeOpenEdge['from'], to: MazeOpenEdge['to']) => {
    const dx = to.x - from.x
    const dy = to.y - from.y

    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return
    }

    if (dy < 0) {
      setChannel(from.x, from.y, 0)
      setChannel(to.x, to.y, 2)
    } else if (dx > 0) {
      setChannel(from.x, from.y, 1)
      setChannel(to.x, to.y, 3)
    } else if (dy > 0) {
      setChannel(from.x, from.y, 2)
      setChannel(to.x, to.y, 0)
    } else if (dx < 0) {
      setChannel(from.x, from.y, 3)
      setChannel(to.x, to.y, 1)
    }
  }
  const mazeWithEdges = layout.maze as MazeLayout['maze'] & {
    openEdges?: MazeOpenEdge[]
  }

  for (const edge of mazeWithEdges.openEdges ?? []) {
    setConnected(edge.from, edge.to)
  }

  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType)

  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.generateMipmaps = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  probeConnectivityTextureCache.set(layout, texture)
  return texture
}

type FogLightingCandidate = {
  bounds: Vector4
  entry: WorldLightingRegistryEntry
}

function getFogProbeBounds(layout: MazeLayout) {
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
}

function isFogLightingEntryReady(entry: WorldLightingRegistryEntry) {
  return Boolean(
    entry.resources.probeCoefficientTextures[0]
  )
}

function createFogLightingCandidates(entries: WorldLightingRegistryEntry[]) {
  return entries
    .filter(isFogLightingEntryReady)
    .map((entry) => ({
      bounds: getFogProbeBounds(entry.layout),
      entry
    }))
}

function getFogLightingCandidateDistanceSquared(
  cameraWorldPosition: Vector3,
  candidate: FogLightingCandidate,
  localPosition: Vector3
) {
  const { bounds, entry } = candidate

  transformWorldPositionToLevelLocal(cameraWorldPosition, entry.transform, localPosition)

  const minX = bounds.x - (MAZE_CELL_SIZE / 2)
  const maxX = bounds.x + bounds.z + (MAZE_CELL_SIZE / 2)
  const minZ = bounds.y - (MAZE_CELL_SIZE / 2)
  const maxZ = bounds.y + bounds.w + (MAZE_CELL_SIZE / 2)
  const dx = localPosition.x < minX
    ? minX - localPosition.x
    : localPosition.x > maxX
      ? localPosition.x - maxX
      : 0
  const dz = localPosition.z < minZ
    ? minZ - localPosition.z
    : localPosition.z > maxZ
      ? localPosition.z - maxZ
      : 0

  return (dx * dx) + (dz * dz)
}

function compareFogLightingCandidates(
  a: FogLightingCandidate,
  aDistanceSquared: number,
  b: FogLightingCandidate,
  bDistanceSquared: number
) {
  if (aDistanceSquared !== bDistanceSquared) {
    return aDistanceSquared - bDistanceSquared
  }

  return a.entry.mazeId.localeCompare(b.entry.mazeId)
}

function chooseFogLightingEntries(
  cameraWorldPosition: Vector3,
  candidates: FogLightingCandidate[],
  localPosition: Vector3,
  maxCount: number
) {
  return candidates
    .map((candidate) => ({
      candidate,
      distanceSquared: getFogLightingCandidateDistanceSquared(
        cameraWorldPosition,
        candidate,
        localPosition
      )
    }))
    .sort((a, b) => compareFogLightingCandidates(
      a.candidate,
      a.distanceSquared,
      b.candidate,
      b.distanceSquared
    ))
    .slice(0, Math.max(0, maxCount))
    .map(({ candidate }) => candidate.entry)
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
      intensity: number
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
    useProbeConnectivity?: boolean
    worldTransform?: LevelWorldTransform
  } = {}
) {
  const worldTransform = options.worldTransform ?? IDENTITY_LEVEL_WORLD_TRANSFORM

  return {
    diffuseIntensity: options.diffuseIntensity ?? 1,
    mode,
    probeCellSize: MAZE_CELL_SIZE,
    probeCoeffTextureL0: options.probeCoefficientTextures?.[0] ?? null,
    probeCoeffTextureL1: options.probeCoefficientTextures?.[1] ?? null,
    probeCoeffTextureL2: options.probeCoefficientTextures?.[2] ?? null,
    probeCoeffTextureL3: options.probeCoefficientTextures?.[3] ?? null,
    probeDepthAtlasTextures,
    radianceIntensity: options.radianceIntensity ?? 1,
    radianceMode: options.radianceMode ?? mode,
    probeHeight: layout.reflectionProbes[0]?.position.y ?? 1.25,
    probeBoxes: probeIndices.map((probeIndex) =>
      getProbeVolumeBounds(layout.reflectionProbes[probeIndex]?.position)
    ),
    probeCoefficients,
    probeDepthTextures,
    probeGridMin: {
      x: layout.reflectionProbes[0]?.position.x ?? 0,
      z: layout.reflectionProbes[0]?.position.z ?? 0
    },
    probeGridSize: {
      x: layout.maze.width,
      y: layout.maze.height
    },
    probeWorldOrigin: {
      x: worldTransform.x,
      z: worldTransform.z
    },
    probeWorldRotationY: worldTransform.rotationY,
    probePositions: probeIndices.map(
      (probeIndex) => layout.reflectionProbes[probeIndex]?.position ?? null
    ),
    probeTextureInfos: probeTextures.map((texture) => getCubeUvTextureInfo(texture)),
    probeTextures,
    region: options.region,
    probeConnectivityTexture: getProbeConnectivityTexture(layout),
    useProbeConnectivity: options.useProbeConnectivity ?? true,
    vlmBoundaryNormal: options.vlmBoundaryNormal,
    vlmMode: options.vlmMode ?? 'disabled',
    weights: options.weights
  } satisfies ProbeBlendConfig
}

function useProbeBlendMaterialShader(
  material: ThreeMeshPhysicalMaterial | ThreeMeshStandardMaterial | null,
  probeBlend: ProbeBlendConfig,
  patchConfig: MaterialShaderPatchConfig = {},
  materialKey: string
) {
  const runtimeLightmapSaturation = useContext(LightmapSaturationContext)
  const runtimeVolumetricSaturation = useContext(VolumetricSaturationContext)
  const runtimePatchConfig = useMemo(
    () => ({
      ...patchConfig,
      lightMapSaturation: patchConfig.lightMapSaturation ?? runtimeLightmapSaturation,
      probeSaturation: patchConfig.probeSaturation ?? runtimeVolumetricSaturation
    }),
    [patchConfig, runtimeLightmapSaturation, runtimeVolumetricSaturation]
  )
  const shaderRef = useRef<ProbeBlendShader | null>(null)
  const materialRef = useRef(material)
  const probeBlendRef = useRef(probeBlend)
  const patchConfigRef = useRef(runtimePatchConfig)
  const probeBlendUpdateKeyRef = useRef(getProbeBlendUpdateKey(probeBlend, runtimePatchConfig))
  const appliedProbeBlendUpdateKeyRef = useRef<string | null>(null)

  materialRef.current = material
  probeBlendRef.current = probeBlend
  patchConfigRef.current = runtimePatchConfig
  probeBlendUpdateKeyRef.current = getProbeBlendUpdateKey(probeBlend, runtimePatchConfig)

  const customProgramCacheKey = useMemo(
    () => () => {
      const currentPatchConfig = patchConfigRef.current
      const currentProbeBlend = probeBlendRef.current
      const activeRadianceMode = currentProbeBlend.radianceMode ?? currentProbeBlend.mode
      const usesTintedLightMap =
        Boolean(currentPatchConfig.lightMapAmbientTint) ||
        Boolean(currentPatchConfig.lightMapTorchTint)
      const lightMapEncoding = currentPatchConfig.lightMapEncoding ?? 'linear'

      return [
        'probe-blend-v5',
        usesTintedLightMap ? 'lightmap-tint' : 'plain',
        `lightmap-${lightMapEncoding}`,
        currentProbeBlend.mode,
        activeRadianceMode,
        currentProbeBlend.vlmMode ?? 'disabled',
        currentProbeBlend.useProbeConnectivity !== false ? 'vlm-connectivity' : 'vlm-unshadowed'
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

      if (
        shaderRef.current &&
        appliedProbeBlendUpdateKeyRef.current === probeBlendUpdateKeyRef.current
      ) {
        return
      }

      updateProbeBlendMaterialDebugState(currentMaterial, probeBlendRef.current)
      updateProbeBlendShaderUniforms(shaderRef.current, probeBlendRef.current, patchConfigRef.current)
      updateProbeBlendUniformDebugState(currentMaterial, shaderRef.current)
      appliedProbeBlendUpdateKeyRef.current = shaderRef.current
        ? probeBlendUpdateKeyRef.current
        : null
    },
    []
  )

  useEffect(() => {
    shaderRef.current = null
    appliedProbeBlendUpdateKeyRef.current = null
  }, [materialKey])

  useEffect(() => {
    updateProbeBlendMaterialDebugState(material, probeBlend)
    updateProbeBlendShaderUniforms(shaderRef.current, probeBlend, runtimePatchConfig)
    updateProbeBlendUniformDebugState(material, shaderRef.current)
    appliedProbeBlendUpdateKeyRef.current = shaderRef.current
      ? probeBlendUpdateKeyRef.current
      : null
  }, [material, materialKey, runtimePatchConfig, probeBlend])

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

    if (
      shaderRef.current &&
      appliedProbeBlendUpdateKeyRef.current === probeBlendUpdateKeyRef.current
    ) {
      return
    }

    updateProbeBlendMaterialDebugState(currentMaterial, probeBlendRef.current)
    updateProbeBlendShaderUniforms(
      shaderRef.current,
      probeBlendRef.current,
      patchConfigRef.current
    )
    updateProbeBlendUniformDebugState(currentMaterial, shaderRef.current)
    appliedProbeBlendUpdateKeyRef.current = shaderRef.current
      ? probeBlendUpdateKeyRef.current
      : null
  }
  material.needsUpdate = true
  updateProbeBlendMaterialDebugState(material, probeBlend)
  updateProbeBlendShaderUniforms(shaderRef.current, probeBlend, patchConfig)
  updateProbeBlendUniformDebugState(material, shaderRef.current)
  appliedProbeBlendUpdateKeyRef.current = shaderRef.current
    ? probeBlendUpdateKeyRef.current
    : null

  return {
    set(nextProbeBlend: ProbeBlendConfig, nextPatchConfig: MaterialShaderPatchConfig = patchConfig) {
      const previousProgramKey = probeBlendProgramKeyRef.current
      const nextProgramKey = getProbeBlendProgramKey(nextProbeBlend, nextPatchConfig)

      probeBlendRef.current = nextProbeBlend
      patchConfigRef.current = nextPatchConfig
      probeBlendUpdateKeyRef.current = getProbeBlendUpdateKey(nextProbeBlend, nextPatchConfig)
      probeBlendProgramKeyRef.current = nextProgramKey
      appliedProbeBlendUpdateKeyRef.current = null
      updateProbeBlendMaterialDebugState(materialRef.current, nextProbeBlend)
      updateProbeBlendShaderUniforms(shaderRef.current, nextProbeBlend, nextPatchConfig)
      updateProbeBlendUniformDebugState(materialRef.current, shaderRef.current)
      appliedProbeBlendUpdateKeyRef.current = shaderRef.current
        ? probeBlendUpdateKeyRef.current
        : null

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

function hasReflectionCaptureExcludedAncestor(object: Object3D) {
  let current: Object3D | null = object

  while (current) {
    if (current.userData?.reflectionCaptureExcluded) {
      return true
    }
    current = current.parent
  }

  return false
}

type ReflectionCaptureSceneStateOptions = {
  requireTorchBillboards?: boolean
}

function getReflectionCaptureSceneState(
  scene: ThreeScene,
  layout: MazeLayout,
  options: ReflectionCaptureSceneStateOptions = {}
) {
  const expectedGroundPatchCount = buildGroundReflectionProbeRects(layout).length
  let groundPatchCount = 0
  let readyGroundPatchCount = 0
  let wallCount = 0
  let readyWallCount = 0
  let sconceCount = 0
  let readySconceCount = 0
  let torchBillboardCount = 0
  let readyTorchBillboardCount = 0

  scene.traverse((object) => {
    if (!(object instanceof Mesh) || hasReflectionCaptureExcludedAncestor(object)) {
      return
    }

    if (object.userData?.debugRole === 'maze-ground-lightmap') {
      groundPatchCount += 1
      if (isMeshMaterialReady(object, {
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
        map: true,
        metalnessMap: true,
        normalMap: true,
        roughnessMap: true
      })) {
        readySconceCount += 1
      }
      return
    }

    if (object.userData?.debugRole === 'torch-billboard') {
      torchBillboardCount += 1
      if (isMeshMaterialReady(object, { map: true })) {
        readyTorchBillboardCount += 1
      }
    }
  })

  return (
    {
      expectedGroundPatchCount,
      groundPatchCount,
      readyGroundPatchCount,
      ready:
        groundPatchCount > 0 &&
        wallCount > 0 &&
        readyGroundPatchCount === groundPatchCount &&
        readyWallCount === wallCount &&
        readySconceCount === sconceCount &&
        (
          !options.requireTorchBillboards ||
          readyTorchBillboardCount === torchBillboardCount
        ),
      readySconceCount,
      readyTorchBillboardCount,
      readyWallCount,
      sconceCount,
      torchBillboardCount,
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
        ['ao', urls.ao],
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
    aoMap: keyedTextures.ao,
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

    const configureTexture = (nextTexture: Texture) => {
      if (cancelled) {
        return
      }

      document.body.dataset.fireFlipbookReady = 'true'
      setTexture(nextTexture)
    }

    const startLoading = () => {
      if (cancelled) {
        return
      }

      void loadSharedFireFlipbookTexture(maxAnisotropy)
        .then(configureTexture)
        .catch(() => {
          if (!cancelled) {
            delete document.body.dataset.fireFlipbookReady
          }
        })
    }

    startLoading()

    return () => {
      cancelled = true
      if (!sharedFireFlipbookTexture) {
        delete document.body.dataset.fireFlipbookReady
      }
      setTexture(null)
    }
  }, [maxAnisotropy])

  return texture
}

function useFrescoDecalTextures() {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const [textures, setTextures] = useState<Array<Texture | null>>(() =>
    Array.from({ length: FRESCO_DECAL_URLS.length }, () => null)
  )

  useEffect(() => {
    let cancelled = false
    let loadDelayHandle = 0

    const publishCachedTextures = () => {
      if (cancelled) {
        return
      }

      setTextures(
        FRESCO_DECAL_URLS.map((_, index) => sharedFrescoDecalTextures.get(index) ?? null)
      )
    }

    const startLoading = () => {
      if (cancelled) {
        return
      }

      publishCachedTextures()
      FRESCO_DECAL_URLS.forEach((_, index) => {
        void loadSharedFrescoDecalTexture(index, maxAnisotropy)
          .then(publishCachedTextures)
          .catch((error) => {
            console.error(error)
          })
      })
    }

    const scheduleAfterIntro = () => {
      if (cancelled) {
        return
      }

      loadDelayHandle = window.setTimeout(startLoading, 1000)
    }

    const removeIntroListener = onIntroFadeTriggered(scheduleAfterIntro)

    return () => {
      cancelled = true
      window.clearTimeout(loadDelayHandle)
      removeIntroListener()
    }
  }, [maxAnisotropy])

  return textures
}

function usesProbeBlendLocalRadiance(probeBlend: ProbeBlendConfig) {
  const radianceMode = probeBlend.radianceMode ?? probeBlend.mode

  return radianceMode === 'world' || radianceMode === 'constant'
}

function getProbeBlendEnvMap(probeBlend: ProbeBlendConfig) {
  return usesProbeBlendLocalRadiance(probeBlend)
    ? getDummyProbeEnvMapTexture()
    : null
}

type RuntimePropModelKind = 'cup' | 'gate' | 'monster' | 'sword' | 'trophy'

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
    if ('specularColorMap' in clonedMaterial) {
      clonedMaterial.specularColorMap = null
    }
    if ('specularIntensityMap' in clonedMaterial) {
      clonedMaterial.specularIntensityMap = null
    }
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
  const disposedGeometries = new Set<Mesh['geometry']>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }

    if (
      object.userData.surfaceLightmapGeometryCloned &&
      object.geometry &&
      !disposedGeometries.has(object.geometry)
    ) {
      disposedGeometries.add(object.geometry)
      object.geometry.dispose()
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
  basePatchConfig: MaterialShaderPatchConfig = EMPTY_MATERIAL_SHADER_PATCH_CONFIG
) {
  const runtimeLightmapSaturation = useContext(LightmapSaturationContext)
  const runtimeVolumetricSaturation = useContext(VolumetricSaturationContext)
  const patchConfig = useMemo(
    () => ({
      ...basePatchConfig,
      lightMapSaturation: basePatchConfig.lightMapSaturation ?? runtimeLightmapSaturation,
      probeSaturation: basePatchConfig.probeSaturation ?? runtimeVolumetricSaturation
    }),
    [basePatchConfig, runtimeLightmapSaturation, runtimeVolumetricSaturation]
  )

  useLayoutEffect(() => {
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

      outputData[destinationOffset] = toClampedHalfFloat(decoded[0] ?? 0)
      outputData[destinationOffset + 1] = toClampedHalfFloat(decoded[1] ?? 0)
      outputData[destinationOffset + 2] = toClampedHalfFloat(decoded[2] ?? 0)
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

  if (lightmap.atlasUrl.endsWith('surface-lightmap-rgbe.rgbe')) {
    return lightmap.atlasUrl.replace(/surface-lightmap-rgbe\.rgbe$/, 'surface-lightmap-rgbe.png')
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

  return imageUrl?.endsWith('surface-lightmap-rgbe.png') ||
    imageUrl?.endsWith('surface-lightmap-rgbe.rgbe') ||
    lightmap.encoding === 'rgbe8'
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

async function loadRgbEImageDataTexture(url: string) {
  recordStartupMarker('surfaceLightmapFetchStartedAt')
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load surface lightmap texture: ${response.status}`)
  }

  recordStartupMarker('surfaceLightmapFetchCompleteAt')
  const blob = await response.blob()
  recordStartupMarker('surfaceLightmapBlobCompleteAt')
  const image = await createImageBitmap(blob, {
    colorSpaceConversion: 'none',
    imageOrientation: 'none',
    premultiplyAlpha: 'none'
  })
  recordStartupMarker('surfaceLightmapBitmapCompleteAt')
  const texture = new Texture(image)

  texture.addEventListener('dispose', () => {
    image.close()
  })

  return configureLightmapTexture(texture)
}

async function loadRgbEByteDataTexture(url: string, width: number, height: number) {
  recordStartupMarker('surfaceLightmapFetchStartedAt')
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load surface lightmap texture: ${response.status}`)
  }

  recordStartupMarker('surfaceLightmapFetchCompleteAt')
  const bytes = new Uint8Array(await response.arrayBuffer())
  recordStartupMarker('surfaceLightmapBytePayloadCompleteAt')
  const expectedByteLength = width * height * 4

  if (bytes.byteLength !== expectedByteLength) {
    throw new Error(
      `Invalid RGBE surface lightmap payload ${url}: expected ${expectedByteLength} bytes, got ${bytes.byteLength}`
    )
  }

  const texture = new DataTexture(bytes, width, height, RGBAFormat, UnsignedByteType)

  return configureLightmapTexture(texture)
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
          imageUrl.endsWith('surface-lightmap-rgbe.rgbe')
        ) {
          return {
            encoding: 'rgbe8' as const,
            texture: await loadRgbEByteDataTexture(
              resolveMazeDataUrl(imageUrl),
              lightmap.atlasWidth,
              lightmap.atlasHeight
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

type SurfaceLightmapAtlasTexture = ReturnType<typeof useSurfaceLightmapAtlasTexture>

type RuntimeLevelLightingResources = {
  environmentTexture: Texture | null
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeRawTextures: Texture[]
  reflectionProbeState: RuntimeReflectionProbeState
  reflectionProbeTextures: Texture[]
  surfaceLightmap: SurfaceLightmapAtlasTexture
}

function SceneEnvironmentBackground({
  intensity
}: {
  intensity: number
}) {
  const scene = useThree((state) => state.scene)
  const [hdrTexture, setHdrTexture] = useState<Texture | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadEnvironment = () => {
      if (cancelled) {
        return
      }

      const loader = new EXRLoader()

      loader.setDataType(FloatType)
      void loader.loadAsync(ENVIRONMENT_URL)
        .then((texture) => {
          if (cancelled) {
            texture.dispose()
            return
          }

          setHdrTexture(texture)
        })
        .catch((error) => {
          if (!cancelled) {
            console.error(error)
          }
        })
    }

    const removeIntroListener = onIntroFadeTriggered(loadEnvironment)

    return () => {
      cancelled = true
      removeIntroListener()
    }
  }, [])

  useEffect(() => {
    if (!hdrTexture) {
      scene.background = null
      scene.environment = null
      scene.environmentIntensity = 0
      return undefined
    }

    hdrTexture.mapping = EquirectangularReflectionMapping
    scene.background = hdrTexture
    scene.backgroundRotation.set(0, SKYBOX_ROTATION_Y_RADIANS, 0)
    scene.environment = null
    scene.backgroundIntensity = intensity
    scene.environmentIntensity = 0

    return () => {
      if (scene.background === hdrTexture) {
        scene.background = null
      }
      if (scene.environment === hdrTexture) {
        scene.environment = null
      }
    }
  }, [hdrTexture, intensity, scene])

  useEffect(() => {
    if (scene.background === hdrTexture) {
      scene.backgroundRotation.set(0, SKYBOX_ROTATION_Y_RADIANS, 0)
    }
    scene.backgroundIntensity = intensity
    scene.environmentIntensity = 0
  }, [hdrTexture, intensity, scene])

  return null
}

function createInitialRuntimeReflectionProbeState(
  scene: ThreeScene,
  layout: MazeLayout
): RuntimeReflectionProbeState {
  return {
    activeProbeId: null,
    captureSceneState: getReflectionCaptureSceneState(scene, layout),
    loadedProbeCount: 0,
    loadedVolumetricProbeCount: 0,
    priorityProbeIndices: [],
    probeCaptureCounts: [],
    probeCount: layout.reflectionProbes.length,
    probeMetrics: [],
    probeRawMetrics: [],
    probeRawReadbackErrors: [],
    probeRawTextureSummaries: [],
    probeRawTextureUUIDs: [],
    probeTextureUUIDs: [],
    ready: false,
    requestedResidentProbeIndices: [],
    residentProbeLimit: Math.min(
      layout.reflectionProbes.length,
      REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT
    ),
    startupVolumetricProbeCount: 0,
    startupVolumetricProbeIndices: [],
    textureMemoryBudgetBytes: REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES
  }
}

function createWorldReflectionProbeState(
  entries: WorldLightingRegistryEntry[]
): RuntimeReflectionProbeState {
  const trackedEntries = entries.filter((entry) => entry.resources)
  const readyEntries = trackedEntries.filter(
    (entry) =>
      entry.resources.surfaceLightmap.ready &&
      entry.resources.reflectionProbeState.ready
  )
  const activeEntry = readyEntries.find((entry) => entry.isActive) ?? readyEntries[0] ?? null

  return {
    activeProbeId: activeEntry?.mazeId ?? null,
    complete: readyEntries.length > 0 &&
      readyEntries.every((entry) => entry.resources.reflectionProbeState.complete !== false),
    loadedProbeCount: readyEntries.reduce(
      (count, entry) => count + (entry.resources.reflectionProbeState.loadedProbeCount ?? 0),
      0
    ),
    loadedVolumetricProbeCount: readyEntries.reduce(
      (count, entry) =>
        count + (entry.resources.reflectionProbeState.loadedVolumetricProbeCount ?? 0),
      0
    ),
    priorityProbeIndices: activeEntry?.resources.reflectionProbeState.priorityProbeIndices ?? [],
    probeCount: readyEntries.reduce(
      (count, entry) => count + entry.resources.reflectionProbeState.probeCount,
      0
    ),
    probeTextureUUIDs: readyEntries.flatMap(
      (entry) => entry.resources.reflectionProbeState.probeTextureUUIDs ?? []
    ),
    ready: readyEntries.length > 0 && Boolean(activeEntry),
    requestedResidentProbeIndices:
      activeEntry?.resources.reflectionProbeState.requestedResidentProbeIndices ?? [],
    residentProbeLimit: readyEntries.reduce(
      (count, entry) => count + (entry.resources.reflectionProbeState.residentProbeLimit ?? 0),
      0
    ),
    startupVolumetricProbeCount: readyEntries.reduce(
      (count, entry) =>
        count + (entry.resources.reflectionProbeState.startupVolumetricProbeCount ?? 0),
      0
    ),
    startupVolumetricProbeIndices:
      activeEntry?.resources.reflectionProbeState.startupVolumetricProbeIndices ?? [],
    textureMemoryBudgetBytes: readyEntries.reduce(
      (count, entry) =>
        count + (entry.resources.reflectionProbeState.textureMemoryBudgetBytes ?? 0),
      0
    )
  }
}

function useRuntimeLevelLightingResources(
  layout: MazeLayout,
  priorityPosition: { x: number; z: number },
  runtimeEnvironmentIntensity: number
): RuntimeLevelLightingResources {
  const scene = useThree((state) => state.scene)
  const surfaceLightmap = useSurfaceLightmapAtlasTexture(layout.maze.lightmap)
  const priorityPositionRef = useRef(priorityPosition)
  priorityPositionRef.current = priorityPosition
  const [reflectionProbeCoefficients, setReflectionProbeCoefficients] = useState<Array<ProbeIrradianceCoefficients | null>>([])
  const [reflectionProbeDepthTextures] = useState<CubeTexture[]>([])
  const [reflectionProbeRawTextures] = useState<Texture[]>([])
  const [reflectionProbeTextures, setReflectionProbeTextures] = useState<Texture[]>([])
  const [reflectionProbeState, setReflectionProbeState] = useState<RuntimeReflectionProbeState>(() =>
    createInitialRuntimeReflectionProbeState(scene, layout)
  )
  const reflectionProbeTargets = useRef<Array<{ dispose: () => void; texture: Texture }>>([])
  const probeCoefficientTextures = useProbeCoefficientTextures(
    layout,
    reflectionProbeCoefficients
  ) as [Texture, Texture, Texture, Texture]

  useEffect(() => {
    let cancelled = false
    let loadHandle = 0
    let publishHandle = 0
    let backgroundProbeReleaseHandle = 0
    const probeCount = layout.reflectionProbes.length
    const previousTargets = reflectionProbeTargets.current
    const nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
    const nextProbeCoefficients = new Array<ProbeIrradianceCoefficients | null>(probeCount).fill(null)

    reflectionProbeTargets.current = []

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

          layout.reflectionProbes.forEach((_, probeIndex) => {
            const distanceSquared = getDistanceToPriorityPosition(probeIndex)

            if (distanceSquared < nearestProbeDistanceSquared) {
              nearestProbeDistanceSquared = distanceSquared
              nearestProbeIndex = probeIndex
            }
          })

          return probeCount > 0 ? [...prioritizedProbeIndices, nearestProbeIndex] : []
        })()
      )
    )
    const startupVolumetricProbeIndices = Array.from(
      new Set([
        ...startupProbeIndices,
        ...layout.reflectionProbes
          .map((_, probeIndex) => probeIndex)
          .filter(
            (probeIndex) =>
              getDistanceToPriorityPosition(probeIndex) <=
              (STARTUP_VOLUMETRIC_PROBE_READY_RADIUS ** 2)
          )
          .sort(
            (leftProbeIndex, rightProbeIndex) =>
              getDistanceToPriorityPosition(leftProbeIndex) -
              getDistanceToPriorityPosition(rightProbeIndex)
          )
      ])
    )
    const startupProbeIndexSet = new Set(startupProbeIndices)
    const startupVolumetricProbeIndexSet = new Set(startupVolumetricProbeIndices)

    const disposeProbeTargets = (
      targets: Array<{ dispose: () => void; texture: Texture }>
    ) => {
      for (const target of targets) {
        target?.dispose()
      }
    }
    const buildReflectionProbeState = (
      readyOverride?: boolean
    ): RuntimeReflectionProbeState => {
      const loadedProbeCount = nextTargets.reduce(
        (count, target) => count + Number(Boolean(target)),
        0
      )
      const loadedVolumetricProbeCount = nextProbeCoefficients.reduce(
        (count, coefficients) => count + Number(Boolean(coefficients)),
        0
      )

      return {
        activeProbeId: null,
        captureSceneState: getReflectionCaptureSceneState(scene, layout),
        complete: loadedProbeCount >= Math.min(
          probeCount,
          Math.max(startupProbeIndices.length, REFLECTION_PROBE_RUNTIME_RESIDENT_LIMIT)
        ),
        loadedProbeCount,
        loadedVolumetricProbeCount,
        priorityProbeIndices: [...startupProbeIndices],
        probeCaptureCounts: [],
        probeCount,
        probeMetrics: [],
        probeRawMetrics: [],
        probeRawReadbackErrors: [],
        probeRawTextureSummaries: [],
        probeRawTextureUUIDs: [],
        probeTextureUUIDs: nextTargets.map((target) => target?.texture.uuid ?? null),
        ready:
          readyOverride ??
          startupVolumetricProbeIndices.every(
            (probeIndex) => Boolean(nextProbeCoefficients[probeIndex])
          ),
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
        startupVolumetricProbeCount: startupVolumetricProbeIndices.length,
        startupVolumetricProbeIndices: [...startupVolumetricProbeIndices],
        textureMemoryBudgetBytes: REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES
      }
    }
    const publishReflectionProbeState = (immediate = false, readyOverride?: boolean) => {
      const publishedCoefficients = new Array<ProbeIrradianceCoefficients | null>(probeCount)
      const publishedTextures = new Array<Texture>(probeCount)

      for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
        const coefficients = nextProbeCoefficients[probeIndex]
        const target = nextTargets[probeIndex]

        if (coefficients) {
          publishedCoefficients[probeIndex] = coefficients.map((coefficient) => (
            [...coefficient]
          )) as ProbeIrradianceCoefficients
        }
        if (target) {
          publishedTextures[probeIndex] = target.texture
        }
      }

      const publish = () => {
        reflectionProbeTargets.current = nextTargets
        const nextState = buildReflectionProbeState(readyOverride)
        startTransition(() => {
          setReflectionProbeCoefficients(publishedCoefficients)
          setReflectionProbeTextures(publishedTextures)
          setReflectionProbeState(nextState)
        })
      }

      if (immediate) {
        if (publishHandle !== 0) {
          window.clearTimeout(publishHandle)
          publishHandle = 0
        }
        publish()
        return
      }

      if (publishHandle !== 0) {
        return
      }

      publishHandle = window.setTimeout(() => {
        publishHandle = 0
        publish()
      }, REFLECTION_PROBE_PUBLISH_INTERVAL_MS)
    }
    const finishWithoutProbeAssets = () => {
      disposeProbeTargets(previousTargets)
      reflectionProbeTargets.current = []
      startTransition(() => {
        setReflectionProbeCoefficients([])
        setReflectionProbeTextures([])
        setReflectionProbeState(buildReflectionProbeState(true))
      })
    }

    setReflectionProbeState(buildReflectionProbeState(false))

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

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

        if (contentType.includes('text/html')) {
          throw new Error(
            `Probe asset manifest for ${layout.maze.id} resolved to HTML instead of JSON`
          )
        }

        const manifest = await response.json() as RuntimeProbeAssetManifest

        if (!Array.isArray(manifest.probes) || manifest.probes.length === 0) {
          finishWithoutProbeAssets()
          return
        }

        const storeProbeCoefficients = (manifestProbe: RuntimeProbeAssetManifest['probes'][number]) => {
          const probeIndex = manifestProbe.index

          nextProbeCoefficients[probeIndex] = (
            Array.isArray(manifestProbe.coefficients) &&
            manifestProbe.coefficients.length === 4
          )
            ? manifestProbe.coefficients as ProbeIrradianceCoefficients
            : null
        }

        for (const manifestProbe of manifest.probes) {
          storeProbeCoefficients(manifestProbe)
        }
        publishReflectionProbeState(true)

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
        const pendingStartupProbeIndices = [...startupVolumetricProbeIndices]
        const pendingBackgroundProbeIndices = manifest.probes
          .map((probe) => probe.index)
          .filter(
            (probeIndex) =>
              requestedResidentProbeIndexSet.has(probeIndex) &&
              !startupProbeIndexSet.has(probeIndex)
          )
        let activeProbeLoads = 0
        let backgroundProbeLoadingReleased = pendingStartupProbeIndices.length === 0
        let finished = false

        const finishLoading = () => {
          if (finished) {
            return
          }

          finished = true
          disposeProbeTargets(previousTargets)
          publishReflectionProbeState(true)
        }
        const loadProbe = async (probeIndex: number) => {
          const manifestProbe = manifest.probes.find((probe) => probe.index === probeIndex)

          if (!manifestProbe) {
            publishReflectionProbeState(startupProbeIndexSet.has(probeIndex))
            return
          }

          const shouldLoadProcessedTexture =
            startupProbeIndexSet.has(probeIndex) ||
            (backgroundProbeLoadingReleased && requestedResidentProbeIndexSet.has(probeIndex))
          const processedTexture = shouldLoadProcessedTexture
            ? await loadRuntimeProbeCubeUvTexture(
                resolveMazeDataUrl(manifestProbe.processedCubeUvRgbE)
              )
            : null

          if (cancelled) {
            processedTexture?.dispose()
            return
          }

          if (processedTexture) {
            nextTargets[probeIndex] = {
              dispose: () => processedTexture.dispose(),
              texture: processedTexture
            }
          }
          storeProbeCoefficients(manifestProbe)

          const startupVolumetricReady = startupVolumetricProbeIndices.every(
            (candidateProbeIndex) => Boolean(nextProbeCoefficients[candidateProbeIndex])
          )

          publishReflectionProbeState(
            startupProbeIndexSet.has(probeIndex) || startupVolumetricReady
          )
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
            if (!backgroundProbeLoadingReleased) {
              return undefined
            }

            return pendingBackgroundProbeIndices.shift()
          }
          const getLoadConcurrency = () => (
            pendingStartupProbeIndices.length > 0
              ? REFLECTION_PROBE_LOAD_CONCURRENCY
              : REFLECTION_PROBE_BACKGROUND_LOAD_CONCURRENCY
          )

          if (
            pendingStartupProbeIndices.length === 0 &&
            pendingBackgroundProbeIndices.length > 0 &&
            activeProbeLoads === 0 &&
            !backgroundProbeLoadingReleased
          ) {
            if (backgroundProbeReleaseHandle === 0) {
              backgroundProbeReleaseHandle = window.setTimeout(() => {
                backgroundProbeReleaseHandle = 0
                if (document.body.dataset.solutionReplayActive === 'true') {
                  scheduleProbeLoads()
                  return
                }
                backgroundProbeLoadingReleased = true
                scheduleProbeLoads()
              }, REFLECTION_PROBE_STARTUP_DELAY_MS)
            }
            return
          }

          while (
            activeProbeLoads < getLoadConcurrency() &&
            (
              pendingStartupProbeIndices.length > 0 ||
              (backgroundProbeLoadingReleased && pendingBackgroundProbeIndices.length > 0)
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
        finishWithoutProbeAssets()
      }
    }

    void loadProbeManifest()

    return () => {
      cancelled = true
      window.clearTimeout(loadHandle)
      window.clearTimeout(publishHandle)
      window.clearTimeout(backgroundProbeReleaseHandle)
      disposeProbeTargets(nextTargets)
      disposeProbeTargets(previousTargets)
      reflectionProbeTargets.current = []
    }
  }, [layout, scene])

  return useMemo(() => ({
    environmentTexture: null,
    probeCoefficientTextures,
    probeDepthAtlasTextures: EMPTY_PROBE_DEPTH_ATLAS_TEXTURES,
    reflectionProbeCoefficients,
    reflectionProbeDepthTextures,
    reflectionProbeRawTextures,
    reflectionProbeState,
    reflectionProbeTextures,
    surfaceLightmap
  }), [
    probeCoefficientTextures,
    reflectionProbeCoefficients,
    reflectionProbeDepthTextures,
    reflectionProbeRawTextures,
    reflectionProbeState,
    reflectionProbeTextures,
    surfaceLightmap
  ])
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

      decodedFaceData[pixelIndex] = toClampedHalfFloat(decoded[0] ?? 0)
      decodedFaceData[pixelIndex + 1] = toClampedHalfFloat(decoded[1] ?? 0)
      decodedFaceData[pixelIndex + 2] = toClampedHalfFloat(decoded[2] ?? 0)
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
    const { u: localLightmapU, v: localLightmapV } =
      mapGroundWorldToLightmapLocalUv(groundBounds, worldX, worldZ)
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

function createCeilingPatchGeometry(
  maze: MazeLayout['maze'],
  cell: { x: number; y: number },
  lightmap: MazeLightmap
) {
  const center = getMazeCellWorldPosition(maze, cell, GROUND_Y + (WALL_HEIGHT * 2))
  const geometry = new PlaneGeometry(MAZE_CELL_SIZE, MAZE_CELL_SIZE, 1, 1)
  const positions = geometry.getAttribute('position')
  const lightmapUvs: number[] = []

  for (let index = 0; index < positions.count; index += 1) {
    const localX = positions.getX(index)
    const localY = positions.getY(index)
    const worldX = center.x + localX
    const worldZ = center.z + localY
    const { u: localLightmapU, v: localLightmapV } =
      mapGroundWorldToLightmapLocalUv(lightmap.groundBounds, worldX, worldZ)
    const [lightmapU, lightmapV] = mapLightmapRectUvToAtlas(
      lightmap.groundRect,
      lightmap.atlasWidth,
      lightmap.atlasHeight,
      localLightmapU,
      localLightmapV
    )

    lightmapUvs.push(lightmapU, lightmapV)
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(lightmapUvs, 2))
  return geometry
}

function getLayoutCells(maze: MazeLayout['maze']) {
  if (Array.isArray(maze.cells) && maze.cells.length > 0) {
    return maze.cells
  }

  return Array.from({ length: maze.width * maze.height }, (_, index) => ({
    x: index % maze.width,
    y: Math.floor(index / maze.width)
  }))
}

const SCREEN_SHAKE_PATH_DIRECTIONS: CardinalDirection[] = ['north', 'east', 'south', 'west']

function createScreenShakeOpenEdgeSet(maze: MazeLayout['maze']) {
  const openEdges = new Set(
    (maze.openEdges ?? []).map((edge) => normalizeEdge(edge.from, edge.to))
  )

  for (const gate of maze.gates ?? []) {
    openEdges.add(normalizeEdge(gate.from, gate.to))
  }

  for (const edge of maze.playerOnlyOpenEdges ?? []) {
    openEdges.add(normalizeEdge(edge.from, edge.to))
  }

  return openEdges
}

function getScreenShakePathDistance(
  maze: MazeLayout['maze'],
  from: MazeCell,
  to: MazeCell
) {
  if (cellKey(from) === cellKey(to)) {
    return 0
  }

  const cellKeys = new Set(getLayoutCells(maze).map((cell) => cellKey(cell)))
  const openEdges = createScreenShakeOpenEdgeSet(maze)
  const queue: Array<{ cell: MazeCell; distance: number }> = [
    { cell: from, distance: 0 }
  ]
  const visited = new Set([cellKey(from)])

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex]

    for (const direction of SCREEN_SHAKE_PATH_DIRECTIONS) {
      const next = getNeighbor(current.cell, direction)
      const nextKey = cellKey(next)

      if (
        visited.has(nextKey) ||
        !cellKeys.has(nextKey) ||
        !openEdges.has(normalizeEdge(current.cell, next))
      ) {
        continue
      }

      const nextDistance =
        current.distance +
        Math.hypot(next.x - current.cell.x, next.y - current.cell.y)

      if (nextKey === cellKey(to)) {
        return nextDistance
      }

      visited.add(nextKey)
      queue.push({
        cell: next,
        distance: nextDistance
      })
    }
  }

  return Math.hypot(from.x - to.x, from.y - to.y)
}

function isIndoorLayout(layout: MazeLayout) {
  const levelName = layout.maze.levelName ?? layout.maze.id

  if (/^(entrance|chamber\b|chamber\s+\d+)/i.test(levelName)) {
    return false
  }

  return /^(maze|hallway|throne room)/i.test(levelName) || /^maze-/i.test(layout.maze.id)
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
  const shortSideUvScale = WALL_WIDTH / WALL_LENGTH

  for (const group of geometry.groups) {
    const materialIndex = group.materialIndex ?? 0
    const rect =
      materialIndex === 0
        ? rects?.px ?? lightmap.neutralRect
        : materialIndex === 1
          ? rects?.nx ?? lightmap.neutralRect
          : materialIndex === 4
            ? rects?.pz ?? lightmap.neutralRect
            : materialIndex === 5
              ? rects?.nz ?? lightmap.neutralRect
              : lightmap.neutralRect
    const mirrorX = materialIndex === 1 || materialIndex === 5

    for (let index = group.start; index < group.start + group.count; index += 1) {
      const vertexIndex = geometry.index?.getX(index) ?? index
      const localU = uv.getX(vertexIndex)
      const localV = uv.getY(vertexIndex)
      if (materialIndex === 0 || materialIndex === 1) {
        uv.setXY(
          vertexIndex,
          localU * shortSideUvScale,
          localV
        )
      }
      const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
        rect,
        lightmap.atlasWidth,
        lightmap.atlasHeight,
        localU,
        localV,
        { mirrorX }
      )

      uv1[vertexIndex * 2] = atlasU
      uv1[(vertexIndex * 2) + 1] = atlasV
    }
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
}

function getLightmapRectForSconce(
  lightmap: MazeLightmap,
  mazeLight: MazeLayout['lights'][number]
) {
  const wallId = mazeLight.wallId
  const faceKey = mazeLight.wallFaceKey ??
    (mazeLight.side === 'north' || mazeLight.side === 'west' ? 'pz' : 'nz')

  if (!wallId) {
    return lightmap.neutralRect
  }

  return lightmap.wallRects[wallId]?.[faceKey] ?? lightmap.neutralRect
}

function createSconceGeometry(
  lightmap: MazeLightmap,
  mazeLight: MazeLayout['lights'][number]
) {
  const geometry = new LatheGeometry(SCONCE_PROFILE_POINTS, 24)
  const position = geometry.getAttribute('position')
  const uv1 = new Float32Array(position.count * 2)
  const rect = getLightmapRectForSconce(lightmap, mazeLight)
  const axis = mazeLight.wallAxis ?? (mazeLight.side === 'east' || mazeLight.side === 'west' ? 'z' : 'x')
  const mirrorX = (mazeLight.wallFaceKey ??
    (mazeLight.side === 'north' || mazeLight.side === 'west' ? 'pz' : 'nz')) === 'nz'

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const localAlong = axis === 'x'
      ? position.getX(vertexIndex)
      : position.getZ(vertexIndex)
    const localU = MathUtils.clamp(
      0.5 + (localAlong / Math.max(WALL_LENGTH, 0.0001)),
      0,
      1
    )
    const localV = MathUtils.clamp(
      (mazeLight.sconcePosition.y + position.getY(vertexIndex) - GROUND_Y) / WALL_HEIGHT,
      0,
      1
    )
    const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
      rect,
      lightmap.atlasWidth,
      lightmap.atlasHeight,
      localU,
      localV,
      { mirrorX }
    )

    uv1[vertexIndex * 2] = atlasU
    uv1[(vertexIndex * 2) + 1] = atlasV
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
}

function applyRectLightmapUvsToModel(
  model: Group,
  lightmap: MazeLightmap,
  rect: MazeLightmap['neutralRect']
) {
  const key = `${lightmap.atlasWidth}:${lightmap.atlasHeight}:${rect.x}:${rect.y}:${rect.width}:${rect.height}`

  model.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }

    const sourceUv = object.geometry.getAttribute('uv')

    if (!sourceUv) {
      return
    }

    if (object.userData.surfaceLightmapUvKey !== key) {
      if (!object.userData.surfaceLightmapGeometryCloned) {
        object.geometry = object.geometry.clone()
        object.userData.surfaceLightmapGeometryCloned = true
      }

      const uv1 = new Float32Array(sourceUv.count * 2)

      for (let vertexIndex = 0; vertexIndex < sourceUv.count; vertexIndex += 1) {
        const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
          rect,
          lightmap.atlasWidth,
          lightmap.atlasHeight,
          sourceUv.getX(vertexIndex),
          sourceUv.getY(vertexIndex)
        )

        uv1[vertexIndex * 2] = atlasU
        uv1[(vertexIndex * 2) + 1] = atlasV
      }

      object.geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
      object.userData.surfaceLightmapUvKey = key
    }
  })
}

function getBoxFaceLightmapKey(normal: { x: number; y: number; z: number }) {
  if (normal.y > 0.5) {
    return 'py'
  }
  if (normal.x > 0.5) {
    return 'px'
  }
  if (normal.x < -0.5) {
    return 'nx'
  }
  if (normal.z > 0.5) {
    return 'pz'
  }
  if (normal.z < -0.5) {
    return 'nz'
  }
  return 'neutral'
}

function createAltarBlockGeometry(lightmap: MazeLightmap, altarId: string) {
  const geometry = new BoxGeometry(0.5, 1, 0.5)
  const uv = geometry.getAttribute('uv')
  const normal = geometry.getAttribute('normal')
  const uv1 = new Float32Array(uv.count * 2)
  const rects = lightmap.altarRects?.[altarId] ?? {}

  for (let vertexIndex = 0; vertexIndex < uv.count; vertexIndex += 1) {
    const faceKey = getBoxFaceLightmapKey({
      x: normal.getX(vertexIndex),
      y: normal.getY(vertexIndex),
      z: normal.getZ(vertexIndex)
    })
    const rect = faceKey === 'neutral'
      ? lightmap.neutralRect
      : rects[faceKey as keyof typeof rects] ?? lightmap.neutralRect
    const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
      rect,
      lightmap.atlasWidth,
      lightmap.atlasHeight,
      uv.getX(vertexIndex),
      uv.getY(vertexIndex)
    )

    uv1[vertexIndex * 2] = atlasU
    uv1[(vertexIndex * 2) + 1] = atlasV
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
}

function createDecalGeometry(lightmap: MazeLightmap, decal: MazeLayout['decals'][number]) {
  const decalSize = 1.55
  const geometry = new PlaneGeometry(decalSize, decalSize)
  const uv = geometry.getAttribute('uv')
  const uv1 = new Float32Array(uv.count * 2)
  const rects = lightmap.wallRects[decal.wallId]
  const rect = decal.faceKey === 'pz'
    ? rects?.pz ?? lightmap.neutralRect
    : rects?.nz ?? lightmap.neutralRect
  const mirrorX = decal.faceKey === 'nz'
  const wallUScale = decalSize / WALL_LENGTH
  const wallVScale = decalSize / WALL_HEIGHT

  for (let vertexIndex = 0; vertexIndex < uv.count; vertexIndex += 1) {
    const textureU = uv.getX(vertexIndex)
    const textureV = uv.getY(vertexIndex)
    const localU = 0.5 + ((uv.getX(vertexIndex) - 0.5) * wallUScale)
    const localV = 0.5 + ((uv.getY(vertexIndex) - 0.5) * wallVScale)
    const [atlasU, atlasV] = mapLightmapRectUvToAtlas(
      rect,
      lightmap.atlasWidth,
      lightmap.atlasHeight,
      localU,
      localV,
      { mirrorX }
    )

    uv1[vertexIndex * 2] = atlasU
    uv1[(vertexIndex * 2) + 1] = atlasV
    uv.setXY(vertexIndex, textureU, 1 - textureV)
  }

  geometry.setAttribute('uv1', new Float32BufferAttribute(uv1, 2))
  return geometry
}

function createCornerFillerGeometry() {
  const fillerSize = WALL_WIDTH / 2
  const geometry = new BoxGeometry(fillerSize, WALL_HEIGHT, fillerSize)
  const uv = geometry.getAttribute('uv')
  const scaledUvs: number[] = []

  for (let index = 0; index < uv.count; index += 1) {
    scaledUvs.push(uv.getX(index) * (fillerSize / WALL_LENGTH), uv.getY(index))
  }

  geometry.setAttribute('uv', new Float32BufferAttribute(scaledUvs, 2))
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
      recordIntroFadeTriggered()
      recordStartupMarker('loadingOverlayCompleteAt')
      return
    }

    if (!document.body.dataset.introFadeTriggeredAt) {
      document.body.dataset.introFadeTriggeredAt = 'pending'
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
      <img
        alt="MINOTAUR"
        className="loading-title-image"
        src={TITLE_IMAGE_URL}
      />
      <img
        alt="Entering the labyrinth"
        className="loading-subtitle-image"
        src={SUBTITLE_IMAGE_URL}
      />
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

function StartupReporter({
  ready
}: {
  ready: boolean
}) {
  const gl = useThree((state) => state.gl)
  const hasMarkedReady = useRef(false)

  useEffect(() => {
    gl.domElement.dataset.sceneReady = 'false'
    delete gl.domElement.dataset.sceneReadyAt
    hasMarkedReady.current = false
  }, [gl, ready])

  useFrame(() => {
    if (!ready || hasMarkedReady.current) {
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
  const scene = useThree((state) => state.scene)
  const hdrTexture = useLoader(EXRLoader, ENVIRONMENT_URL)
  const pmremGenerator = useMemo(() => new PMREMGenerator(gl), [gl])
  const environmentTarget = useRef<{ dispose: () => void; texture: Texture } | null>(null)
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
    const nextEnvironment = layout.maze.id.startsWith('debug-')
      ? (() => {
          pmremGenerator.compileEquirectangularShader()
          return pmremGenerator.fromEquirectangular(hdrTexture)
        })()
      : {
          dispose: () => {},
          texture: hdrTexture
        }

    environmentTarget.current = nextEnvironment
    onEnvironmentFogColorChange(BLACK_COLOR.clone())
    onEnvironmentTextureChange(null)

    return () => {
      nextEnvironment.dispose()
      environmentTarget.current = null
      pmremGenerator.dispose()
      onEnvironmentFogColorChange(BLACK_COLOR.clone())
      onEnvironmentTextureChange(null)
    }
  }, [
    hdrTexture,
    layout.maze.id,
    onEnvironmentFogColorChange,
    onEnvironmentTextureChange,
    pmremGenerator
  ])

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
    const startupVolumetricProbeIndices = Array.from(
      new Set([
        ...startupProbeIndices,
        ...layout.reflectionProbes
          .map((_, probeIndex) => probeIndex)
          .filter(
            (probeIndex) =>
              getDistanceToPriorityPosition(probeIndex) <=
              (STARTUP_VOLUMETRIC_PROBE_READY_RADIUS ** 2)
          )
          .sort(
            (leftProbeIndex, rightProbeIndex) =>
              getDistanceToPriorityPosition(leftProbeIndex) -
              getDistanceToPriorityPosition(rightProbeIndex)
          )
      ])
    )

    if (!layout.maze.id.startsWith('debug-')) {
      const previousTargets = reflectionProbeTargets.current
      const previousRawTargets = reflectionProbeRawTargets.current
      reflectionProbeRawTargets.current = []
      reflectionProbeTargets.current = []
      const nextTargets = new Array<{ dispose: () => void; texture: Texture }>(probeCount)
      const nextProbeAmbientColors = new Array<Color>(probeCount)
      const nextProbeCoefficients = new Array<ProbeIrradianceCoefficients | null>(probeCount).fill(null)
      let cancelled = false
      let loadHandle = 0
      let publishHandle = 0
      let backgroundProbeReleaseHandle = 0
      let latestCaptureSceneState = getReflectionCaptureSceneState(scene, layout)
      const startupProbeIndexSet = new Set(startupProbeIndices)
      const startupVolumetricProbeIndexSet = new Set(startupVolumetricProbeIndices)

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
        const loadedVolumetricProbeCount = nextProbeCoefficients.reduce(
          (count, coefficients) => count + Number(Boolean(coefficients)),
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
          loadedVolumetricProbeCount,
          priorityProbeIndices: [...startupProbeIndices],
          probeCaptureCounts: [],
          probeMetrics: [],
          probeRawMetrics: [],
          probeRawReadbackErrors: [],
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
          startupVolumetricProbeCount: startupVolumetricProbeIndices.length,
          startupVolumetricProbeIndices: [...startupVolumetricProbeIndices],
          textureMemoryBudgetBytes: REFLECTION_PROBE_RUNTIME_TEXTURE_MEMORY_BUDGET_BYTES,
          ready: startupVolumetricProbeIndices.every(
            (probeIndex) => Boolean(nextProbeCoefficients[probeIndex])
          )
        }
      }

      const publishReflectionProbeState = () => {
        const publishedAmbientColors = new Array<Color>(probeCount)
        const publishedCoefficients = new Array<ProbeIrradianceCoefficients | null>(probeCount)
        const publishedTextures = new Array<Texture>(probeCount)

        for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
          const ambientColor = nextProbeAmbientColors[probeIndex]
          const coefficients = nextProbeCoefficients[probeIndex]
          const target = nextTargets[probeIndex]

          publishedAmbientColors[probeIndex] = (
            ambientColor ?? BLACK_COLOR
          ).clone()
          if (coefficients) {
            publishedCoefficients[probeIndex] = coefficients.map((coefficient) => (
              [...coefficient]
            )) as ProbeIrradianceCoefficients
          }
          if (target) {
            publishedTextures[probeIndex] = target.texture
          }
        }
        const loadedProbeCount = publishedTextures.reduce(
          (count, texture) => count + Number(Boolean(texture)),
          0
        )
        reflectionProbeTargets.current = nextTargets
        reflectionProbeRawTargets.current = []
        startTransition(() => {
          onReflectionProbeAmbientColorsChange(publishedAmbientColors)
          onReflectionProbeCoefficientsChange(publishedCoefficients)
          onReflectionProbeDepthTexturesChange([])
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
        const finishWithoutProbeAssets = () => {
          disposeProbeTargets(previousTargets)
          disposeProbeTargets(previousRawTargets)
          reflectionProbeTargets.current = []
          reflectionProbeRawTargets.current = []
          startTransition(() => {
            onReflectionProbeAmbientColorsChange([])
            onReflectionProbeCoefficientsChange([])
            onReflectionProbeDepthTexturesChange([])
            onReflectionProbeRawTexturesChange([])
            onReflectionProbeTexturesChange([])
          })
          latestCaptureSceneState = getReflectionCaptureSceneState(scene, layout)
          scene.userData.reflectionProbeState = {
            ...buildReflectionProbeState(latestCaptureSceneState),
            ready: true
          }
        }

        try {
          const response = await fetch(
            resolveMazeDataUrl(`${layout.maze.id}/probe-assets.json`)
          )

          if (!response.ok) {
            throw new Error(
              `Failed to load probe asset manifest for ${layout.maze.id}: ${response.status}`
            )
          }

          const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

          if (contentType.includes('text/html')) {
            throw new Error(
              `Probe asset manifest for ${layout.maze.id} resolved to HTML instead of JSON`
            )
        }

        const manifest = await response.json() as RuntimeProbeAssetManifest

        if (!Array.isArray(manifest.probes) || manifest.probes.length === 0) {
          finishWithoutProbeAssets()
          return
        }

        const storeProbeCoefficients = (manifestProbe: RuntimeProbeAssetManifest['probes'][number]) => {
          const probeIndex = manifestProbe.index

            nextProbeCoefficients[probeIndex] = (
              Array.isArray(manifestProbe.coefficients) &&
              manifestProbe.coefficients.length === 4
            )
              ? manifestProbe.coefficients as ProbeIrradianceCoefficients
              : null
            const l0 = manifestProbe.coefficients?.[0]
            nextProbeAmbientColors[probeIndex] = l0
              ? new Color(
                  l0[0] / 0.282095,
                  l0[1] / 0.282095,
                  l0[2] / 0.282095
                )
              : BLACK_COLOR.clone()
          }

          for (const manifestProbe of manifest.probes) {
            storeProbeCoefficients(manifestProbe)
          }
          schedulePublishedProbeState(true)

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
          const pendingStartupProbeIndices = [...startupVolumetricProbeIndices]
          const pendingBackgroundProbeIndices = manifest.probes
            .map((probe) => probe.index)
          .filter(
            (probeIndex) =>
              requestedResidentProbeIndexSet.has(probeIndex) &&
                !startupProbeIndexSet.has(probeIndex)
          )
          let activeProbeLoads = 0
          let backgroundProbeLoadingReleased = pendingStartupProbeIndices.length === 0
          let finished = false

          const finishLoading = () => {
            if (finished) {
              return
            }

            finished = true
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

            const shouldLoadProcessedTexture =
              startupProbeIndexSet.has(probeIndex) ||
              (backgroundProbeLoadingReleased && requestedResidentProbeIndexSet.has(probeIndex))
            const processedTexture = shouldLoadProcessedTexture
              ? await loadRuntimeProbeCubeUvTexture(
                  resolveMazeDataUrl(manifestProbe.processedCubeUvRgbE)
                )
              : null

            if (cancelled) {
              processedTexture?.dispose()
              return
            }

            if (processedTexture) {
              nextTargets[probeIndex] = {
                dispose: () => processedTexture.dispose(),
                texture: processedTexture
              }
            }
            storeProbeCoefficients(manifestProbe)

            scene.userData.reflectionProbeState = buildReflectionProbeState(latestCaptureSceneState)

            const startupVolumetricReady = startupVolumetricProbeIndices.every(
              (candidateProbeIndex) => Boolean(nextProbeCoefficients[candidateProbeIndex])
            )

            if (startupProbeIndexSet.has(probeIndex) || startupVolumetricReady) {
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

              if (!backgroundProbeLoadingReleased) {
                return undefined
              }

              return pendingBackgroundProbeIndices.shift()
            }

            const getLoadConcurrency = () => (
              pendingStartupProbeIndices.length > 0
                ? REFLECTION_PROBE_LOAD_CONCURRENCY
                : REFLECTION_PROBE_BACKGROUND_LOAD_CONCURRENCY
            )

            if (
              pendingStartupProbeIndices.length === 0 &&
              pendingBackgroundProbeIndices.length > 0 &&
              activeProbeLoads === 0 &&
              !backgroundProbeLoadingReleased
            ) {
              if (backgroundProbeReleaseHandle === 0) {
                backgroundProbeReleaseHandle = window.setTimeout(() => {
                  backgroundProbeReleaseHandle = 0
                  if (document.body.dataset.solutionReplayActive === 'true') {
                    scheduleProbeLoads()
                    return
                  }
                  backgroundProbeLoadingReleased = true
                  scheduleProbeLoads()
                }, REFLECTION_PROBE_STARTUP_DELAY_MS)
              }
              return
            }

            while (
              activeProbeLoads < getLoadConcurrency() &&
              (
                pendingStartupProbeIndices.length > 0 ||
                (backgroundProbeLoadingReleased && pendingBackgroundProbeIndices.length > 0)
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

                  if (
                    pendingStartupProbeIndices.length === 0 &&
                    pendingBackgroundProbeIndices.length > 0 &&
                    !backgroundProbeLoadingReleased
                  ) {
                    scheduleProbeLoads()
                    return
                  }

                  loadHandle = window.setTimeout(scheduleProbeLoads, 0)
                })
            }
          }

          scheduleProbeLoads()
        } catch (error) {
          console.error(error)
          finishWithoutProbeAssets()
        }
      }

      void loadProbeManifest()

      return () => {
        cancelled = true
        window.clearTimeout(loadHandle)
        window.clearTimeout(publishHandle)
        window.clearTimeout(backgroundProbeReleaseHandle)
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

      const captureSceneState = getReflectionCaptureSceneState(scene, layout, {
        requireTorchBillboards: true
      })
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
  monsterEyes,
  maps,
  probeBlend,
  rect,
  surfaceLightmapsEnabled,
  visible = true
}: {
  debugIndex: number
  environmentTexture: Texture | null
  environmentIntensity: number
  groundLightmapTexture: Texture
  lightmap: MazeLightmap
  lightmapTextureEncoding: LightmapTextureEncoding
  lightmapContributionIntensity: number
  monsterEyes: MonsterEyeSettings
  maps: PbrMaps
  probeBlend: ProbeBlendConfig
  rect: GroundPatchRect
  surfaceLightmapsEnabled: boolean
  visible?: boolean
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
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
  )

  return (
    <mesh
      position={[rect.centerX, GROUND_Y + MAZE_GROUND_PATCH_OFFSET_Y, rect.centerZ]}
      receiveShadow
      rotation-x={-Math.PI / 2}
      userData={{ debugIndex, debugRole: 'maze-ground-lightmap' }}
      visible={visible}
    >
      <primitive
        attach="geometry"
        object={geometry}
      />
      <GroundSurfaceMaterial
        globalEnvMap={environmentTexture}
        globalEnvMapIntensity={environmentIntensity}
        lightMap={groundLightmapTexture}
        lightMapIntensity={
          surfaceLightmapsEnabled
            ? lightmapContributionIntensity * FLOOR_LIGHTMAP_INTENSITY_SCALE
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
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  mountAllGeometry,
  groundLightmapTexture,
  lightmapTextureEncoding,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  turnState,
  visibilityState
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  mountAllGeometry: boolean
  groundLightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  turnState: TurnState
  visibilityState: PrecomputedVisibilityState
}) {
  const puddle = usePuddleTextures(PUDDLE_TEXTURE_REPEAT)
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const groundPatchRects = useMemo(
    () => buildGroundReflectionProbeRects(layout) as GroundPatchRect[],
    [layout]
  )
  const mountedGroundPatchRects = groundPatchRects

  return (
    <>
      {mountedGroundPatchRects.map((rect, index) => (
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
          const surfaceLightmapsEnabled =
            lightmapContributionIntensity > EFFECT_EPSILON

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
          radianceMode: 'world',
                  region: rect.region,
                  useProbeConnectivity: volumetricShadowsEnabled,
                  vlmMode: 'cell5',
                  worldTransform: levelWorldTransform
                }
              )}
              rect={rect}
              surfaceLightmapsEnabled={surfaceLightmapsEnabled}
              visible={(rect.cells ?? [rect.cell]).some((cell) =>
                isCellVisible(visibilityState, cell)
              )}
            />
          )
        })()
      ))}
    </>
  )
}

function TorchBillboard({
  color = FIRE_COLOR,
  position,
  seed,
  size = TORCH_BILLBOARD_SIZE,
  texture
}: {
  color?: Color
  position: [number, number, number]
  seed: number
  size?: number
  texture: Texture | null
}) {
  const camera = useThree((state) => state.camera)
  const billboardIntensity = useContext(TorchBillboardIntensityContext)
  const group = useRef<Group>(null)
  const material = useRef<Mesh>(null)
  const parentWorldQuaternion = useMemo(() => new Quaternion(), [])
  const localBillboardQuaternion = useMemo(() => new Quaternion(), [])
  const billboardTexture = texture ?? getDummyTransparentTexture()

  useFrame((state) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
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
        billboardTexture.offset.x =
          (column + FIRE_FLIPBOOK_FRAME_CROP.minX) / FIRE_FLIPBOOK_GRID
        billboardTexture.offset.y =
          1 -
          ((row + FIRE_FLIPBOOK_FRAME_CROP.maxY) / FIRE_FLIPBOOK_GRID)
      }
    } finally {
      endFrameProfileStep('torch billboard animation', profileStartedAt)
    }

    if (material.current) {
      const billboardMaterial = material.current.material as {
        color: Color
      }

      billboardMaterial.color.copy(color).multiplyScalar(
        TORCH_BASE_CANDELA * FIRE_BILLBOARD_INTENSITY_SCALE * billboardIntensity
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
          lensFlareTint: [color.r, color.g, color.b],
          lensflare: 'ignore-occlusion'
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          alphaTest={0.03}
          color={new Color(1, 1, 1)}
          depthWrite
          map={billboardTexture}
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
  lightmapTexture,
  lightmapTextureEncoding,
  mazeLight,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  torchTexture,
  visible = true
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  mazeLight: MazeLayout['lights'][number]
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  torchTexture: Texture | null
  visible?: boolean
}) {
  const metal = useStandardPbrTextures(METAL_TEXTURE_URLS, METAL_TEXTURE_REPEAT)
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const [material, setMaterial] = useState<ThreeMeshStandardMaterial | null>(null)
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
  )
  const geometry = useMemo(
    () => createSconceGeometry(layout.maze.lightmap, mazeLight),
    [layout.maze.lightmap, mazeLight]
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
          diffuseIntensity: 0,
          radianceIntensity: reflectionContributionIntensity,
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          vlmMode: 'disabled',
          weights: reflectionProbeBlend.weights as [number, number, number, number],
          worldTransform: levelWorldTransform
        }
      )
    }),
    [
      layout,
      levelWorldTransform,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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

  useEffect(() => () => {
    geometry.dispose()
  }, [geometry])

  return (
    <>
      <SconceMesh
        debugIndex={mazeLight.index}
        debugRole="sconce-body"
        geometry={geometry}
        material={
          <meshStandardMaterial
            color="white"
            customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
            envMap={getProbeBlendEnvMap(probeBlend)}
            envMapIntensity={0}
            key={materialKey}
            lightMap={lightmapTexture}
            lightMapIntensity={lightMapIntensity}
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
        visible={visible}
      />
      {visible ? (
        <TorchBillboard
          position={torchPosition}
          seed={mazeLight.index + 1}
          texture={torchTexture}
        />
      ) : null}
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
  sceneDepthTexture: DepthTexture | Texture | null
  clearColor: Color
  opaqueScene: ThreeScene | null

  constructor(billboardCamera: ThreeCamera) {
    super('BillboardCompositePass')
    this.billboardCamera = billboardCamera
    this.clearColor = new Color()
    this.needsDepthTexture = true
    this.opaqueScene = null
    this.sceneDepthTexture = null
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

  getDepthTexture() {
    return this.sceneDepthTexture
  }

  setDepthTexture(depthTexture: DepthTexture | Texture | null) {
    this.sceneDepthTexture = depthTexture
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
    if (this.sceneDepthTexture) {
      const shaderMaterial = this.fullscreenMaterial as ShaderMaterial
      shaderMaterial.uniforms.sceneDepthBuffer.value = this.sceneDepthTexture
    } else if (this.opaqueScene) {
      withFrameProfileScope('scene depth prepass', () => {
        this.billboardCamera.layers.set(0)
        this.opaqueScene!.overrideMaterial = this.depthMaterial
        renderer.setRenderTarget(this.depthRenderTarget)
        renderer.setClearColor(0x000000, 0)
        renderer.clear(true, true, true)
        renderer.render(this.opaqueScene!, this.billboardCamera)
        this.opaqueScene!.overrideMaterial = previousOverrideMaterial
      })

      const shaderMaterial = this.fullscreenMaterial as ShaderMaterial
      shaderMaterial.uniforms.sceneDepthBuffer.value = this.depthRenderTarget.depthTexture
    }
    withFrameProfileScope('torch billboard color pass', () => {
      this.billboardCamera.layers.set(TORCH_BILLBOARD_LAYER)
      renderer.setRenderTarget(this.billboardRenderTarget)
      renderer.setClearColor(0x000000, 0)
      renderer.clear(true, true, true)
      if (this.opaqueScene) {
        this.opaqueScene.background = null
        renderer.render(this.opaqueScene, this.billboardCamera)
        this.opaqueScene.background = previousBackground
      }
    })

    const shaderMaterial = this.fullscreenMaterial as ShaderMaterial
    shaderMaterial.uniforms.inputBuffer.value = inputBuffer.texture

    withFrameProfileScope('additive fullscreen composite', () => {
      renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
      renderer.render(this.scene, this.camera)
    })

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
  geometry,
  material,
  position,
  visible = true
}: {
  debugIndex: number
  debugRole: string
  geometry: LatheGeometry
  material: ReactNode
  position: [number, number, number]
  visible?: boolean
}) {
  return (
    <mesh
      castShadow
      position={position}
      receiveShadow
      userData={{ debugIndex, debugRole }}
      visible={visible}
    >
      <primitive attach="geometry" object={geometry} />
      {material}
    </mesh>
  )
}

function FogVolume({
  ambientColor,
  fogDistance,
  heightFalloff,
  lightingStrength,
  lightingEntries,
  noiseFrequency,
  noisePeriod,
  noiseStrength,
  probeSaturation,
  rayStepCount,
  visible,
  volumeIntensity
}: {
  ambientColor: Color
  fogDistance: number
  heightFalloff: number
  lightingStrength: number
  lightingEntries: WorldLightingRegistryEntry[]
  noiseFrequency: number
  noisePeriod: number
  noiseStrength: number
  probeSaturation: number
  rayStepCount: number
  visible: boolean
  volumeIntensity: number
}) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const effect = useMemo(() => new FogVolumeEffectImpl(), [])
  const pass = useMemo(() => new EffectPass(camera, effect as unknown as Effect), [camera, effect])
  const fogNoiseTexture = useFogNoiseTexture()
  const fogLightingCandidates = useMemo(
    () => createFogLightingCandidates(lightingEntries),
    [lightingEntries]
  )
  const lightingEntriesRef = useRef(lightingEntries)
  const fogLightingCandidatesRef = useRef(fogLightingCandidates)
  const selectedEntriesRef = useRef<WorldLightingRegistryEntry[]>([])
  const cameraWorldPositionRef = useRef(new Vector3())
  const fogSelectionLocalPositionRef = useRef(new Vector3())

  const applySelectedEntries = useCallback((entries: WorldLightingRegistryEntry[]) => {
    const readyEntryCount = fogLightingCandidatesRef.current.length
    const selectedEntries = entries.slice(0, MAX_ACTIVE_FOG_VLM_ATLASES)
    const probeBounds = selectedEntries.map((entry) => getFogProbeBounds(entry.layout))
    const probeGrids = selectedEntries.map(
      (entry) => new Vector2(entry.layout.maze.width, entry.layout.maze.height)
    )
    const probeWorldOrigins = selectedEntries.map(
      (entry) => new Vector2(entry.transform.x, entry.transform.z)
    )
    const probeWorldRotations = selectedEntries.map(
      (entry) => new Vector2(
        Math.cos(entry.transform.rotationY),
        Math.sin(entry.transform.rotationY)
      )
    )
    const probeConnectivityTextures = selectedEntries.map(
      (entry) => getProbeConnectivityTexture(entry.layout)
    )
    const probeCoeffTextureL0s = selectedEntries.map(
      (entry) => entry.resources.probeCoefficientTextures[0] ?? null
    )
    const useProbeCoefficientTexture = probeCoeffTextureL0s.some(Boolean) ? 1 : 0
    const useProbeConnectivity =
      volumetricShadowsEnabled && probeConnectivityTextures.some(Boolean) ? 1 : 0
    const appliedDensity = visible
      ? volumeIntensity * FOG_EXTINCTION_SCALE
      : 0

    effect.density = appliedDensity
    effect.environmentFogColor = ambientColor
    effect.fallbackProbeAmbientColor = WHITE_COLOR
    effect.fogDistance = fogDistance
    effect.groundHeight = GROUND_Y
    effect.heightFalloff = heightFalloff
    effect.lightingStrength = lightingStrength
    effect.probeSaturation = probeSaturation
    effect.noiseFrequency = noiseFrequency
    effect.noisePeriod = noisePeriod
    effect.noiseStrength = noiseStrength
    effect.fogNoiseTexture = fogNoiseTexture
    effect.activeProbeAtlasCount = selectedEntries.length
    effect.probeAmbientBounds = probeBounds
    effect.probeAmbientGrid = probeGrids
    effect.probeWorldOrigin = probeWorldOrigins
    effect.probeWorldRotation = probeWorldRotations
    effect.probeCoeffTextureL0 = probeCoeffTextureL0s
    effect.probeConnectivityTexture = probeConnectivityTextures
    effect.probeHeight = selectedEntries[0]?.layout.reflectionProbes[0]?.position.y ?? 1.25
    effect.rayStepCount = rayStepCount
    effect.useProbeCoefficientTexture = useProbeCoefficientTexture
    effect.useProbeConnectivity = useProbeConnectivity
    effect.volumeHeight = FOG_VOLUME_HEIGHT
    scene.userData.fogEffectState = {
      availableAtlasCount: readyEntryCount,
      density: appliedDensity / FOG_EXTINCTION_SCALE,
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
      maxAtlasCount: MAX_ACTIVE_FOG_VLM_ATLASES,
      noiseFrequency,
      noisePeriod,
      noiseStrength,
      probeAmbientBounds: probeBounds[0] ? [
        probeBounds[0].x,
        probeBounds[0].y,
        probeBounds[0].z,
        probeBounds[0].w
      ] : null,
      probeAmbientGrid: probeGrids[0] ? [
        probeGrids[0].x,
        probeGrids[0].y
      ] : null,
      probeWorldOrigin: probeWorldOrigins[0] ? [
        probeWorldOrigins[0].x,
        probeWorldOrigins[0].y
      ] : null,
      probeWorldRotation: probeWorldRotations[0] ? [
        probeWorldRotations[0].x,
        probeWorldRotations[0].y
      ] : null,
      rayStepCount,
      selectedAtlasCount: selectedEntries.length,
      selectedMazeIds: selectedEntries.map((entry) => entry.mazeId),
      trackedMazeIds: lightingEntriesRef.current.map((candidate) => candidate.mazeId).sort(),
      useProbeAmbientTexture: 0,
      useProbeCoefficientTexture,
      useProbeConnectivity
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
    probeSaturation,
    fogNoiseTexture,
    rayStepCount,
    scene,
    visible,
    volumetricShadowsEnabled,
    volumeIntensity
  ])

  useEffect(() => {
    lightingEntriesRef.current = lightingEntries
    fogLightingCandidatesRef.current = fogLightingCandidates
    const nextEntries = chooseFogLightingEntries(
      camera.getWorldPosition(cameraWorldPositionRef.current),
      fogLightingCandidates,
      fogSelectionLocalPositionRef.current,
      MAX_ACTIVE_FOG_VLM_ATLASES
    )

    selectedEntriesRef.current = nextEntries
    applySelectedEntries(nextEntries)
  }, [applySelectedEntries, camera, fogLightingCandidates, lightingEntries])

  useEffect(() => {
    return () => {
      delete scene.userData.fogEffectState
    }
  }, [scene])

  useFrame((state) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      const cameraWorldPosition = camera.getWorldPosition(cameraWorldPositionRef.current)
      const nextEntries = chooseFogLightingEntries(
        cameraWorldPosition,
        fogLightingCandidatesRef.current,
        fogSelectionLocalPositionRef.current,
        MAX_ACTIVE_FOG_VLM_ATLASES
      )
      const previousIds = selectedEntriesRef.current.map((entry) => entry.mazeId).join('|')
      const nextIds = nextEntries.map((entry) => entry.mazeId).join('|')

      if (previousIds !== nextIds) {
        selectedEntriesRef.current = nextEntries
        applySelectedEntries(nextEntries)
      }
      effect.cameraProjectionMatrixInverse = camera.projectionMatrixInverse
      effect.cameraWorldMatrix = camera.matrixWorld
      effect.cameraWorldPosition = cameraWorldPosition
      effect.time = state.clock.getElapsedTime()
    } finally {
      endFrameProfileStep('volumetric fog uniforms', profileStartedAt)
    }
  })

  useEffect(() => () => pass.dispose(), [pass])

  return visible ? <primitive object={pass} /> : null
}

function ReflectionProbeVisualization({
  mode,
  reflectionProbeCoefficients,
  layout,
  reflectionProbeTextures,
  visible
}: {
  mode: ProbeDebugMode
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  layout: MazeLayout
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  const scene = useThree((state) => state.scene)
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = visible &&
        mode !== 'none' &&
        scene.userData.freeCameraActive === true
    }
  })

  if (!visible || mode === 'none') {
    return null
  }

  return (
    <group ref={groupRef}>
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
        } else if (mode === 'volumetric-lightmap') {
          const coefficients = reflectionProbeCoefficients[index]

          if (!coefficients) {
            return null
          }

          material = (
            <shaderMaterial
              key={`${probe.id}:${mode}:volumetric-lightmap`}
              depthTest
              depthWrite
              fragmentShader={createVolumetricLightmapProbeSphereFragmentShader()}
              side={DoubleSide}
              toneMapped
              uniforms={{
                coeffL0: { value: new Vector3(...coefficients[0]) },
                coeffL1: { value: new Vector3(...coefficients[1]) },
                coeffL2: { value: new Vector3(...coefficients[2]) },
                coeffL3: { value: new Vector3(...coefficients[3]) }
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
    </group>
  )
}

function ReflectionProbeDebugOverlay({
  mode,
  reflectionProbeCoefficients,
  layout,
  reflectionProbeTextures,
  visible
}: {
  mode: ProbeDebugMode
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
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
                material.uniforms?.probeCubeUvMap?.value?.uuid ?? null
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

vec3 reconstructProbeIrradiance(
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
  float bandKernelL0 = 3.141592653589793;
  float bandKernelL1 = 2.09439510239;

  return max(
    vec3( 0.0 ),
    ( basisCoeffL0 * basisL0 * bandKernelL0 ) +
    ( basisCoeffL1 * basisL1 * bandKernelL1 ) +
    ( basisCoeffL2 * basisL2 * bandKernelL1 ) +
    ( basisCoeffL3 * basisL3 * bandKernelL1 )
  ) * 12.566370614359172 * 0.3183098861837907;
}

void main() {
  gl_FragColor = vec4(
    reconstructProbeIrradiance(
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

function MazeWalls({
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  lightmapTexture,
  lightmapTextureEncoding,
  mountAllGeometry,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  staticVolumetricContributionIntensity,
  visibilityState
}: {
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  mountAllGeometry: boolean
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  staticVolumetricContributionIntensity: number
  visibilityState: PrecomputedVisibilityState
}) {
  const wall = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT)
  const torchTexture = useFireFlipbookTexture()
  const decalTextures = useFrescoDecalTextures()
  const visibleWalls = useMemo(
    () => layout.walls.filter((mazeWall) => isMazeWallVisible(layout, visibilityState, mazeWall)),
    [layout, layout.walls, visibilityState]
  )
  const visibleWallIds = useMemo(
    () => new Set(visibleWalls.map((mazeWall) => mazeWall.id)),
    [visibleWalls]
  )
  const mountedWalls = layout.walls
  const mountedDecals = layout.decals
  const mountedCornerFillers = layout.cornerFillers
  const indoorLayout = isIndoorLayout(layout)
  const mountedLights = useMemo(() => {
    if (!indoorLayout) {
      return layout.lights
    }

    const usedWallIds = new Set<string>()

    return layout.lights.filter((light) => {
      const wallKey = light.wallId ?? `${light.cell.x},${light.cell.y}:${light.side}`

      if (usedWallIds.has(wallKey)) {
        return false
      }

      usedWallIds.add(wallKey)
      return true
    })
  }, [indoorLayout, layout.lights])
  const mountedCeilingCells = useMemo(
    () => indoorLayout ? getLayoutCells(layout.maze) : [],
    [indoorLayout, layout.maze]
  )

  return (
    <>
      {mountedWalls.map((mazeWall, wallIndex) => (
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
          visible={isMazeWallVisible(layout, visibilityState, mazeWall)}
          wallIndex={wallIndex}
          wallMaterialMaps={wall}
        />
      ))}
      {indoorLayout ? mountedWalls.map((mazeWall, wallIndex) => (
        <MazeWallMesh
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={`${mazeWall.id}:upper`}
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
          verticalOffset={WALL_HEIGHT}
          visible={isMazeWallVisible(layout, visibilityState, mazeWall)}
          wallIndex={wallIndex}
          wallMaterialMaps={wall}
        />
      )) : null}
      {mountedCeilingCells.map((cell, cellIndex) => (
        <CeilingPatchMesh
          cell={cell}
          debugIndex={cellIndex}
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={`ceiling:${cell.x},${cell.y}`}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          lightmapTexture={lightmapTexture}
          lightmapTextureEncoding={lightmapTextureEncoding}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          visible={isCellVisible(visibilityState, cell)}
          wallMaterialMaps={wall}
        />
      ))}
      {mountedDecals.map((decal, decalIndex) => (
        <MazeWallDecal
          decal={decal}
          decalIndex={decalIndex}
          decalTexture={
            decalTextures[decal.textureIndex % decalTextures.length] ??
            getDummyTransparentTexture()
          }
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={decal.id}
          layout={layout}
          lightmap={layout.maze.lightmap}
          lightmapContributionIntensity={lightmapContributionIntensity}
          lightmapTexture={lightmapTexture}
          lightmapTextureEncoding={lightmapTextureEncoding}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          visible={visibleWallIds.has(decal.wallId)}
        />
      ))}
      {mountedCornerFillers.map((filler, fillerIndex) => (
        <WallDetailMesh
          center={filler.center}
          debugIndex={fillerIndex}
          debugRole="maze-corner-filler"
          environmentIntensity={environmentIntensity}
          environmentTexture={environmentTexture}
          geometryKind="corner-filler"
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={filler.id}
          layout={layout}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          visible={isPositionCellVisible(layout, visibilityState, filler.center)}
          wallMaterialMaps={wall}
        />
      ))}
      {mountedLights.map((mazeLight) => (
        <WallSconce
          environmentTexture={environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={staticVolumetricContributionIntensity}
          key={mazeLight.id}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          lightmapTexture={lightmapTexture}
          lightmapTextureEncoding={lightmapTextureEncoding}
          mazeLight={mazeLight}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          torchTexture={torchTexture}
          visible={isCellVisible(visibilityState, mazeLight.cell)}
        />
      ))}
    </>
  )
}

function WallDetailMesh({
  center,
  debugIndex,
  debugRole,
  environmentIntensity,
  environmentTexture,
  geometryKind,
  iblContributionIntensity,
  layout,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true,
  wallMaterialMaps
}: {
  center: { x: number; z: number }
  debugIndex: number
  debugRole: string
  environmentIntensity: number
  environmentTexture: Texture | null
  geometryKind: 'corner-filler'
  iblContributionIntensity: number
  layout: MazeLayout
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
  wallMaterialMaps: PbrMaps
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const geometry = useMemo(
    () => createCornerFillerGeometry(),
    [geometryKind]
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: center.x,
        z: center.z
      }),
    [center.x, center.z, layout]
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
      volumetricShadowsEnabled
    ]
  )
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint: BLACK_COLOR,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    []
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey(debugRole, probeBlend, patchConfig),
    [debugRole, patchConfig, probeBlend]
  )

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry]
  )

  return (
    <mesh
      castShadow
      position={[center.x, GROUND_Y + (WALL_HEIGHT / 2), center.z]}
      receiveShadow
      userData={{
        debugIndex,
        debugRole
      }}
      visible={visible}
    >
      <primitive attach="geometry" object={geometry} />
      <WallFaceMaterial
        attach="material"
        environmentIntensity={environmentIntensity}
        environmentTexture={environmentTexture}
        lightMapIntensity={0}
        materialKey={materialKey}
        maps={wallMaterialMaps}
        patchConfig={patchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
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

function LitDecalMaterial({
  alphaMap,
  lightMap,
  lightMapIntensity,
  materialKey,
  patchConfig,
  probeBlend
}: {
  alphaMap: Texture
  lightMap?: Texture
  lightMapIntensity: number
  materialKey: string
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
      alphaTest={0.04}
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      depthWrite={false}
      envMap={getProbeBlendEnvMap(probeBlend)}
      envMapIntensity={0}
      key={materialKey}
      lightMap={lightMap}
      lightMapIntensity={lightMapIntensity}
      map={alphaMap}
      metalness={0}
      onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
      onBeforeRender={probeBlendMaterialProps.onBeforeRender}
      ref={setMaterial}
      roughness={1}
      side={DoubleSide}
      toneMapped
      transparent
    />
  )
}

function MazeWallDecal({
  decal,
  decalIndex,
  decalTexture,
  iblContributionIntensity,
  layout,
  lightmap,
  lightmapContributionIntensity,
  lightmapTexture,
  lightmapTextureEncoding,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionProbeCoefficients,
  visible = true
}: {
  decal: MazeLayout['decals'][number]
  decalIndex: number
  decalTexture: Texture
  iblContributionIntensity: number
  layout: MazeLayout
  lightmap: MazeLightmap
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  visible?: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const geometry = useMemo(
    () => createDecalGeometry(lightmap, decal),
    [decal, lightmap]
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: decal.position.x,
        z: decal.position.z
      }),
    [decal.position.x, decal.position.z, layout]
  )
  const probeCoefficients = useMemo(
    () =>
      reflectionProbeBlend.probeIndices.map(
        (probeIndex) => reflectionProbeCoefficients[probeIndex] ?? null
      ),
    [reflectionProbeBlend.probeIndices, reflectionProbeCoefficients]
  )
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
  )
  const probeBlend = useMemo(
    () =>
      buildProbeBlendConfig(
        layout,
        reflectionProbeBlend.probeIndices,
        [],
        [],
        probeDepthAtlasTextures,
        probeCoefficients,
        'disabled',
        {
          diffuseIntensity: iblContributionIntensity,
          probeCoefficientTextures,
          radianceIntensity: 0,
          radianceMode: 'disabled',
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            Math.abs(decal.normal.x) > Math.abs(decal.normal.z)
              ? { x: 1, z: 0 }
              : { x: 0, z: 1 },
          vlmMode: 'boundary8',
          weights: reflectionProbeBlend.weights as [number, number, number, number],
          worldTransform: levelWorldTransform
        }
      ),
    [
      decal.normal.x,
      decal.normal.z,
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficients,
      probeCoefficientTextures,
      probeDepthAtlasTextures,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.weights,
      volumetricShadowsEnabled
    ]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('maze-wall-decal', probeBlend, patchConfig),
    [patchConfig, probeBlend]
  )

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry]
  )

  return (
    <mesh
      position={[
        decal.position.x,
        decal.position.y,
        decal.position.z
      ]}
      rotation-y={decal.yaw}
      userData={{
        debugIndex: decalIndex,
        debugRole: 'maze-wall-decal'
      }}
      visible={visible}
    >
      <primitive attach="geometry" object={geometry} />
      <LitDecalMaterial
        alphaMap={decalTexture}
        lightMap={lightmapTexture}
        lightMapIntensity={lightMapIntensity}
        materialKey={materialKey}
        patchConfig={patchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
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
  visible = true,
  verticalOffset = 0,
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
  visible?: boolean
  verticalOffset?: number
  wallIndex: number
  wallMaterialMaps: PbrMaps
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
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
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const faceMaterialPatchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            mazeWall.axis === 'z'
              ? { x: 1, z: 0 }
              : { x: 0, z: 1 },
          vlmMode: 'boundary8',
          weights: reflectionProbeBlend.weights as [number, number, number, number],
          worldTransform: levelWorldTransform
        }
      ),
    [
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      lightmapContributionIntensity,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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
        GROUND_Y + (WALL_HEIGHT / 2) + verticalOffset,
        mazeWall.center.z
      ]}
      receiveShadow
      rotation-y={mazeWall.yaw}
      userData={{
        debugIndex: wallIndex,
        debugRole: 'maze-wall',
        debugRoles: ['maze-wall', 'maze-wall-lightmap']
      }}
      visible={visible}
    >
      <primitive
        attach="geometry"
        object={geometry}
      />
      <WallFaceMaterial
        attach="material"
        environmentIntensity={envMapIntensity}
        environmentTexture={environmentTexture}
        lightMap={lightmapTexture}
        lightMapIntensity={lightMapIntensity}
        materialKey={wallFaceMaterialBaseKey}
        maps={wallMaterialMaps}
        patchConfig={faceMaterialPatchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function CeilingPatchMesh({
  cell,
  debugIndex,
  environmentIntensity,
  environmentTexture,
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
  visible = true,
  wallMaterialMaps
}: {
  cell: { x: number; y: number }
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
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
  visible?: boolean
  wallMaterialMaps: PbrMaps
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const geometry = useMemo(
    () => createCeilingPatchGeometry(layout.maze, cell, layout.maze.lightmap),
    [cell.x, cell.y, layout.maze]
  )
  const center = useMemo(
    () => getMazeCellWorldPosition(layout.maze, cell, GROUND_Y + (WALL_HEIGHT * 2)),
    [cell, layout.maze]
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: center.x,
        z: center.z
      }),
    [center.x, center.z, layout]
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
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * FLOOR_LIGHTMAP_INTENSITY_SCALE
      : 0
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
      volumetricShadowsEnabled
    ]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('indoor-ceiling', probeBlend, patchConfig),
    [patchConfig, probeBlend]
  )

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry]
  )

  return (
    <mesh
      position={[center.x, center.y, center.z]}
      receiveShadow
      rotation-x={Math.PI / 2}
      userData={{ debugIndex, debugRole: 'indoor-ceiling' }}
      visible={visible}
    >
      <primitive
        attach="geometry"
        object={geometry}
      />
      <WallFaceMaterial
        attach="material"
        environmentIntensity={environmentIntensity}
        environmentTexture={environmentTexture}
        lightMap={lightmapTexture}
        lightMapIntensity={lightMapIntensity}
        materialKey={materialKey}
        maps={wallMaterialMaps}
        patchConfig={patchConfig}
        probeBlend={probeBlend}
      />
    </mesh>
  )
}

function SceneGeometry({
  activatedAltarIds,
  activePlayerWorldPosition,
  activePlayerTurn,
  completedMazeLevelIds,
  environmentTexture,
  environmentIntensity,
  iblContributionIntensity,
  isActive,
  layout,
  lightmapContributionIntensity,
  mountAllGeometry,
  offeringAltarId,
  offeringStartedAt,
  openGateIds,
  probeDebugMode,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionContributionIntensity,
  reflectionProbeTextures,
  runtimeModelsEnabled,
  staticVolumetricContributionIntensity,
  surfaceLightmap,
  turnState,
  visibilityState = DISABLED_PRECOMPUTED_VISIBILITY
}: {
  activatedAltarIds: Set<string>
  activePlayerWorldPosition: Vector3
  activePlayerTurn: number
  completedMazeLevelIds: Set<string>
  environmentTexture: Texture | null
  environmentIntensity: number
  iblContributionIntensity: number
  isActive: boolean
  layout: MazeLayout
  lightmapContributionIntensity: number
  mountAllGeometry: boolean
  offeringAltarId: string | null
  offeringStartedAt: number | null
  openGateIds: Set<string>
  probeDebugMode: ProbeDebugMode
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionContributionIntensity: number
  reflectionProbeTextures: Texture[]
  runtimeModelsEnabled: boolean
  staticVolumetricContributionIntensity: number
  surfaceLightmap: {
    encoding: LightmapTextureEncoding
    ready: boolean
    texture: Texture
  }
  turnState: TurnState
  visibilityState?: PrecomputedVisibilityState
}) {
  return (
    <>
      <Ground
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={staticVolumetricContributionIntensity}
        layout={layout}
        lightmapContributionIntensity={lightmapContributionIntensity}
        mountAllGeometry={mountAllGeometry}
        groundLightmapTexture={surfaceLightmap.texture}
        lightmapTextureEncoding={surfaceLightmap.encoding}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        visibilityState={visibilityState}
      />
      <MazeWalls
        environmentTexture={environmentTexture}
        environmentIntensity={environmentIntensity}
        iblContributionIntensity={iblContributionIntensity}
        layout={layout}
        lightmapContributionIntensity={lightmapContributionIntensity}
        lightmapTexture={surfaceLightmap.texture}
        lightmapTextureEncoding={surfaceLightmap.encoding}
        mountAllGeometry={mountAllGeometry}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
        staticVolumetricContributionIntensity={staticVolumetricContributionIntensity}
        visibilityState={visibilityState}
      />
      {runtimeModelsEnabled ? (
        <>
          <MazeGates
            environmentTexture={environmentTexture}
            environmentIntensity={environmentIntensity}
            iblContributionIntensity={iblContributionIntensity}
            layout={layout}
            openGateIds={openGateIds}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visibilityState={visibilityState}
          />
          <MazeDoors
            activePlayerWorldPosition={activePlayerWorldPosition}
            activePlayerTurn={activePlayerTurn}
            completedMazeLevelIds={completedMazeLevelIds}
            iblContributionIntensity={iblContributionIntensity}
            isActive={isActive}
            layout={layout}
            lightmapContributionIntensity={lightmapContributionIntensity}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            turnState={turnState}
            visibilityState={visibilityState}
          />
          <MazeAltars
            activatedAltarIds={activatedAltarIds}
            iblContributionIntensity={iblContributionIntensity}
            layout={layout}
            lightmapContributionIntensity={lightmapContributionIntensity}
            lightmapTexture={surfaceLightmap.texture}
            lightmapTextureEncoding={surfaceLightmap.encoding}
            offeringAltarId={offeringAltarId}
            offeringStartedAt={offeringStartedAt}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visibilityState={visibilityState}
          />
          <MazeItems
            environmentTexture={environmentTexture}
            environmentIntensity={environmentIntensity}
            iblContributionIntensity={iblContributionIntensity}
            layout={layout}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            renderHeldItems={!offeringAltarId}
            turnState={turnState}
            visibilityState={visibilityState}
          />
        </>
      ) : null}
      <ReflectionProbeDebugOverlay
        mode={probeDebugMode}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
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
  isOpen,
  layout,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  gate: MazeLayout['gates'][number]
  iblContributionIntensity: number
  isOpen: boolean
  layout: MazeLayout
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
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
  const openProgress = useRef(0)
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmBoundaryNormal:
            gate.axis === 'z'
              ? { x: 1, z: 0 }
              : { x: 0, z: 1 },
          vlmMode: 'boundary8',
          weights: reflectionProbeBlend.weights as [number, number, number, number],
          worldTransform: levelWorldTransform
        }
      ),
    [
      gate.axis,
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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

    const gateTargetWidth = MAZE_CELL_SIZE - WALL_WIDTH
    const scale = gateTargetWidth / Math.max(size.x, size.y, 0.0001)
    const minRelativeY = (bounds.min.y - center.y) * scale
    const closedY = GROUND_Y - minRelativeY

    return {
      closedY,
      modelOffset: new Vector3(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      ),
      openY: closedY - 1.5,
      scale
    }
  }, [model])

  useAttachProbeBlendToModel(model, probeBlend)

  useEffect(() => {
    if (!group.current || !transform) {
      return
    }

    if (group.current.userData.initialized) {
      return
    }

    openProgress.current = isOpen ? 1 : 0
    group.current.position.set(
      gate.center.x,
      MathUtils.lerp(transform.closedY, transform.openY, openProgress.current),
      gate.center.z
    )
    group.current.userData.initialized = true
  }, [gate.center.x, gate.center.z, isOpen, transform])

  useFrame((_, delta) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      if (!group.current || !transform) {
        return
      }

      const target = isOpen ? 1 : 0
      const durationSeconds = getScaledAnimationDuration(TURN_ANIMATION_DURATION_MS) / 1000
      const step = durationSeconds > 0 ? delta / durationSeconds : 1

      openProgress.current = target > openProgress.current
        ? Math.min(target, openProgress.current + step)
        : Math.max(target, openProgress.current - step)
      group.current.position.y = MathUtils.lerp(
        transform.closedY,
        transform.openY,
        openProgress.current
      )
    } finally {
      endFrameProfileStep('gate animation', profileStartedAt)
    }
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
      visible={visible}
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
  openGateIds,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  turnState,
  visibilityState
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  openGateIds: Set<string>
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  turnState: TurnState
  visibilityState: PrecomputedVisibilityState
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
          isOpen={openGateIds.has(gate.id)}
          key={gate.id}
          layout={layout}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          visible={gate.cells.some((cell) => isCellVisible(visibilityState, cell))}
        />
      ))}
    </>
  )
}

type MazeRuntimeDoor = {
  cell: MazeCell
  center: { x: number, z: number }
  id: string
  side: CardinalDirection
  yaw: number
}

function getMazeDoorForBoundary(
  layout: MazeLayout,
  boundary: {
    cell: MazeCell
    side: CardinalDirection
    targetLevelId?: string
  },
  id: string
): MazeRuntimeDoor {
  const cellCenter = getMazeCellWorldPosition(layout.maze, boundary.cell, GROUND_Y)
  const center = {
    x: cellCenter.x,
    z: cellCenter.z
  }

  if (boundary.side === 'north') {
    center.z -= MAZE_CELL_SIZE / 2
  } else if (boundary.side === 'south') {
    center.z += MAZE_CELL_SIZE / 2
  } else if (boundary.side === 'east') {
    center.x += MAZE_CELL_SIZE / 2
  } else {
    center.x -= MAZE_CELL_SIZE / 2
  }

  return {
    cell: boundary.cell,
    center,
    id,
    side: boundary.side,
    yaw: boundary.side === 'east' || boundary.side === 'west'
      ? Math.PI / 2
      : 0
  }
}

function getMazeDoors(layout: MazeLayout): MazeRuntimeDoor[] {
  const doors: MazeRuntimeDoor[] = []
  const seenDoorKeys = new Set<string>()
  const addDoor = (
    boundary: {
      cell: MazeCell
      side: CardinalDirection
      targetLevelId?: string
    } | null | undefined,
    id: string
  ) => {
    if (!boundary) {
      return
    }

    const key = `${boundary.cell.x},${boundary.cell.y}:${boundary.side}`

    if (seenDoorKeys.has(key)) {
      return
    }

    seenDoorKeys.add(key)
    doors.push(getMazeDoorForBoundary(layout, boundary, id))
  }

  addDoor(layout.maze.opening, `${layout.maze.id}:entrance-door`)

  for (const exit of layout.maze.levelExits ?? []) {
    addDoor(
      exit,
      `${layout.maze.id}:door:${exit.cell.x},${exit.cell.y}:${exit.side}:${exit.targetLevelId ?? 'exit'}`
    )
  }

  return doors
}

function getDoorBoundaryNormal(side: CardinalDirection) {
  if (side === 'east') {
    return { x: 1, z: 0 }
  }
  if (side === 'west') {
    return { x: -1, z: 0 }
  }
  if (side === 'south') {
    return { x: 0, z: 1 }
  }

  return { x: 0, z: -1 }
}

function isDoorOpenForTurnState(
  door: MazeRuntimeDoor,
  maze: MazeLayout['maze'],
  turnState: TurnState
) {
  return getOpenDoorIds(maze, turnState).includes(door.id)
}

function DoorLeafMaterial({
  maps,
  materialKey,
  mirroredNormal = false,
  probeBlend
}: {
  maps: PbrMaps
  materialKey: string
  mirroredNormal?: boolean
  probeBlend: ProbeBlendConfig
}) {
  const [material, setMaterial] = useState<ThreeMeshStandardMaterial | null>(null)
  const normalScale = useMemo(
    () => new Vector2(mirroredNormal ? -1 : 1, 1),
    [mirroredNormal]
  )
  const probeBlendMaterialProps = useProbeBlendMaterialShader(
    material,
    probeBlend,
    {},
    materialKey
  )

  return (
    <meshStandardMaterial
      aoMap={maps.aoMap}
      color="white"
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={getProbeBlendEnvMap(probeBlend)}
      envMapIntensity={0}
      key={materialKey}
      map={maps.map}
      metalness={1}
      metalnessMap={maps.metalnessMap}
      normalMap={maps.normalMap}
      normalScale={normalScale}
      onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
      onBeforeRender={probeBlendMaterialProps.onBeforeRender}
      ref={setMaterial}
      roughness={1}
      roughnessMap={maps.roughnessMap}
    />
  )
}

function createDoorLeafGeometry({ mirrored = false }: { mirrored?: boolean } = {}) {
  const geometry = new BoxGeometry(1, DOOR_HEIGHT, WALL_WIDTH * 0.5)
  const uv = geometry.getAttribute('uv')
  const normal = geometry.getAttribute('normal')

  if (uv) {
    for (let vertexIndex = 0; vertexIndex < uv.count; vertexIndex += 1) {
      let nextU = uv.getX(vertexIndex)

      if (normal?.getZ(vertexIndex) < -0.5) {
        nextU = 1 - nextU
      }
      if (mirrored) {
        nextU = 1 - nextU
      }

      uv.setX(vertexIndex, nextU)
    }
    uv.needsUpdate = true
    geometry.setAttribute('uv2', uv.clone())
  }

  return geometry
}

function MazeDoorActor({
  door,
  iblContributionIntensity,
  isOpen,
  layout,
  lightmapContributionIntensity,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible
}: {
  door: MazeRuntimeDoor
  iblContributionIntensity: number
  isOpen: boolean
  layout: MazeLayout
  lightmapContributionIntensity: number
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const group = useRef<Group>(null)
  const leftLeaf = useRef<Mesh>(null)
  const rightLeaf = useRef<Mesh>(null)
  const doorMaps = useStandardPbrTextures(DOOR_TEXTURE_URLS, DOOR_TEXTURE_REPEAT)
  const leftDoorGeometry = useMemo(() => createDoorLeafGeometry(), [])
  const rightDoorGeometry = useMemo(() => createDoorLeafGeometry({ mirrored: true }), [])
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: door.center.x,
        z: door.center.z
      }),
    [door.center.x, door.center.z, layout]
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
  const diffuseProbeIntensity =
    iblContributionIntensity + lightmapContributionIntensity
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmBoundaryNormal: getDoorBoundaryNormal(door.side),
          vlmMode: 'boundary8',
          weights: reflectionProbeBlend.weights as [number, number, number, number],
          worldTransform: levelWorldTransform
        }
      ),
    [
      diffuseProbeIntensity,
      door.side,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
      reflectionProbeBlend.weights,
      volumetricShadowsEnabled
    ]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('maze-door', probeBlend, {}),
    [probeBlend]
  )
  const openProgress = useRef(0)

  useEffect(() => () => {
    leftDoorGeometry.dispose()
    rightDoorGeometry.dispose()
  }, [leftDoorGeometry, rightDoorGeometry])

  useFrame((_, delta) => {
    const target = isOpen ? 1 : 0
    const durationSeconds = getScaledAnimationDuration(TURN_ANIMATION_DURATION_MS) / 1000
    const step = durationSeconds > 0 ? delta / durationSeconds : 1

    openProgress.current = target > openProgress.current
      ? Math.min(target, openProgress.current + step)
      : Math.max(target, openProgress.current - step)

    const openOffset = openProgress.current * 0.75

    if (leftLeaf.current) {
      leftLeaf.current.position.x = -0.5 - openOffset
    }
    if (rightLeaf.current) {
      rightLeaf.current.position.x = 0.5 + openOffset
    }
  })

  return (
    <group
      ref={group}
      position={[door.center.x, GROUND_Y + (DOOR_HEIGHT / 2), door.center.z]}
      rotation-y={door.yaw}
      userData={{
        debugRole: 'maze-door',
        doorId: door.id
      }}
      visible={visible}
    >
      <mesh
        castShadow
        geometry={leftDoorGeometry}
        position-x={-0.5}
        receiveShadow
        ref={leftLeaf}
        userData={{ debugIndex: 0, debugRole: 'maze-door-leaf' }}
      >
        <DoorLeafMaterial
          maps={doorMaps}
          materialKey={`${materialKey}:left`}
          probeBlend={probeBlend}
        />
      </mesh>
      <mesh
        castShadow
        geometry={rightDoorGeometry}
        position-x={0.5}
        receiveShadow
        ref={rightLeaf}
        userData={{ debugIndex: 1, debugRole: 'maze-door-leaf' }}
      >
        <DoorLeafMaterial
          maps={doorMaps}
          materialKey={`${materialKey}:right`}
          mirroredNormal
          probeBlend={probeBlend}
        />
      </mesh>
    </group>
  )
}

function MazeDoors({
  activePlayerWorldPosition,
  activePlayerTurn,
  completedMazeLevelIds,
  iblContributionIntensity,
  isActive,
  layout,
  lightmapContributionIntensity,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  turnState,
  visibilityState
}: {
  activePlayerWorldPosition: Vector3
  activePlayerTurn: number
  completedMazeLevelIds: Set<string>
  iblContributionIntensity: number
  isActive: boolean
  layout: MazeLayout
  lightmapContributionIntensity: number
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  turnState: TurnState
  visibilityState: PrecomputedVisibilityState
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const doors = useMemo(() => getMazeDoors(layout), [layout])

  return (
    <>
      {doors.map((door) => {
        const doorWorldPosition = transformLevelLocalPositionToWorld({
          x: door.center.x,
          y: GROUND_Y,
          z: door.center.z
        }, levelWorldTransform)
        const isAdjacentToActivePlayer = Boolean(
          activePlayerTurn > 0 &&
          !completedMazeLevelIds.has(layout.maze.id) &&
          doorWorldPosition.distanceToSquared(activePlayerWorldPosition) <=
            ((MAZE_CELL_SIZE * 0.6) ** 2)
        )
        const isPermanentlyClosed = completedMazeLevelIds.has(layout.maze.id)

        return (
          <MazeDoorActor
            door={door}
            iblContributionIntensity={iblContributionIntensity}
            isOpen={
              !isPermanentlyClosed &&
              (
                (isActive && isDoorOpenForTurnState(door, layout.maze, turnState)) ||
                isAdjacentToActivePlayer
              )
            }
            key={door.id}
            layout={layout}
            lightmapContributionIntensity={lightmapContributionIntensity}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visible={isCellVisible(visibilityState, door.cell)}
          />
        )
      })}
    </>
  )
}

function AltarBlockMaterial({
  lightMap,
  lightMapIntensity,
  maps,
  patchConfig,
  materialKey,
  probeBlend
}: {
  lightMap: Texture
  lightMapIntensity: number
  maps: PbrMaps
  patchConfig: MaterialShaderPatchConfig
  materialKey: string
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
      aoMap={maps.aoMap}
      color="white"
      customProgramCacheKey={probeBlendMaterialProps.customProgramCacheKey}
      envMap={getProbeBlendEnvMap(probeBlend)}
      envMapIntensity={0}
      key={materialKey}
      lightMap={lightMap}
      lightMapIntensity={lightMapIntensity}
      map={maps.map}
      metalness={0}
      metalnessMap={maps.metalnessMap}
      normalMap={maps.normalMap}
      onBeforeCompile={probeBlendMaterialProps.onBeforeCompile}
      onBeforeRender={probeBlendMaterialProps.onBeforeRender}
      ref={setMaterial}
      roughness={0.9}
      roughnessMap={maps.roughnessMap}
    />
  )
}

function AltarOfferingTrophy({
  altarPosition,
  materialKey,
  probeBlend,
  startedAt
}: {
  altarPosition: { x: number, y: number, z: number }
  materialKey: string
  probeBlend: ProbeBlendConfig
  startedAt: number
}) {
  const group = useRef<Group>(null)
  const camera = useThree((state) => state.camera)
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const handWorldPosition = useRef(new Vector3())
  const handLevelPosition = useRef(new Vector3())
  const trophyModel = useClonedRuntimeModel(
    TROPHY_MODEL_URL,
    'trophy',
    'altar-offering-trophy',
    0
  )
  const transform = useMemo(() => {
    if (!trophyModel) {
      return null
    }

    trophyModel.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(trophyModel, true)
    const center = new Vector3()
    const size = new Vector3()

    bounds.getCenter(center)
    bounds.getSize(size)

    const scale = 0.5 / Math.max(size.y, 0.0001)

    return {
      modelOffset: new Vector3(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale
      ),
      scale
    }
  }, [trophyModel])

  useAttachProbeBlendToModel(trophyModel, probeBlend)

  useEffect(() => {
    if (!trophyModel) {
      return
    }

    trophyModel.traverse((object) => {
      if (object instanceof Mesh) {
        object.userData.debugRole = 'altar-offering-trophy'
      }
    })
  }, [trophyModel])

  useFrame(() => {
    if (!group.current) {
      return
    }

    const elapsed = performance.now() - startedAt
    const handToBowlAlpha = MathUtils.smoothstep(
      MathUtils.clamp((elapsed - 500) / 2500, 0, 1),
      0,
      1
    )
    handWorldPosition.current
      .set(-0.42, -0.52, -0.62)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
    transformWorldPositionToLevelLocal(
      handWorldPosition.current,
      levelWorldTransform,
      handLevelPosition.current
    )

    const startX = handLevelPosition.current.x - altarPosition.x
    const startY = handLevelPosition.current.y - GROUND_Y
    const startZ = handLevelPosition.current.z - altarPosition.z

    group.current.position.set(
      MathUtils.lerp(startX, 0, handToBowlAlpha),
      MathUtils.lerp(startY, 1.08, handToBowlAlpha),
      MathUtils.lerp(startZ, 0, handToBowlAlpha)
    )
  })

  if (!trophyModel || !transform) {
    return null
  }

  return (
    <group ref={group}>
      <primitive
        object={trophyModel}
        position={[
          transform.modelOffset.x,
          transform.modelOffset.y,
          transform.modelOffset.z
        ]}
        scale={transform.scale}
      userData={{
        debugRole: 'altar-offering-trophy',
        materialKey
      }}
      />
    </group>
  )
}

function MazeAltarActor({
  activated,
  altar,
  altarIndex,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  lightmapTexture,
  lightmapTextureEncoding,
  offering,
  offeringStartedAt,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  torchTexture,
  visible
}: {
  activated: boolean
  altar: MazeLayout['altars'][number]
  altarIndex: number
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  offering: boolean
  offeringStartedAt: number | null
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  torchTexture: Texture | null
  visible: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const blockGeometry = useMemo(
    () => createAltarBlockGeometry(layout.maze.lightmap, altar.id),
    [altar.id, layout.maze.lightmap]
  )
  const wallMaps = useStandardPbrTextures(WALL_TEXTURE_URLS, WALL_TEXTURE_REPEAT * 0.5)
  const cupModel = useClonedRuntimeModel(
    DROOP_CUP_MODEL_URL,
    'cup',
    'altar-cup',
    0
  )
  const reflectionProbeBlend = useMemo(
    () =>
      getReflectionProbeBlendForPosition(layout, {
        x: altar.position.x,
        z: altar.position.z
      }),
    [altar.position.x, altar.position.z, layout]
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
  const offeringProbeBlend = useMemo(
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
      volumetricShadowsEnabled
    ]
  )
  const surfaceLightmapsEnabled =
    lightmapContributionIntensity > EFFECT_EPSILON
  const lightMapIntensity =
    surfaceLightmapsEnabled
      ? lightmapContributionIntensity * WALL_LIGHTMAP_INTENSITY_SCALE
      : 0
  const patchConfig = useMemo(
    () => ({
      lightMapAmbientTint:
        surfaceLightmapsEnabled
          ? LIGHTMAP_AMBIENT_TINT.clone().multiplyScalar(lightmapContributionIntensity)
          : BLACK_COLOR,
      lightMapEncoding: lightmapTextureEncoding,
      lightMapTorchTint: TORCH_LIGHTMAP_TINT
    }),
    [lightmapContributionIntensity, lightmapTextureEncoding, surfaceLightmapsEnabled]
  )
  const materialKey = useMemo(
    () => getProbeBlendMaterialKey('maze-altar', STATIC_SURFACE_LIGHTMAP_PROBE_BLEND, patchConfig),
    [patchConfig]
  )
  const cupTransform = useMemo(() => {
    if (!cupModel) {
      return null
    }

    cupModel.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(cupModel, true)
    const center = new Vector3()
    const size = new Vector3()

    bounds.getCenter(center)
    bounds.getSize(size)

    const scale = 0.65 / Math.max(size.x, size.z, 0.0001)

    return {
      modelOffset: new Vector3(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale
      ),
      scale
    }
  }, [cupModel])

  const cupLightmapRect = useMemo(
    () => layout.maze.lightmap.altarRects?.[altar.id]?.py ?? layout.maze.lightmap.neutralRect,
    [altar.id, layout.maze.lightmap]
  )

  useAttachProbeBlendToModel(cupModel, STATIC_SURFACE_LIGHTMAP_PROBE_BLEND, patchConfig)

  useEffect(() => {
    if (!cupModel) {
      return
    }

    applyRectLightmapUvsToModel(cupModel, layout.maze.lightmap, cupLightmapRect)
    cupModel.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      materials.forEach((material) => {
        if (
          material instanceof ThreeMeshStandardMaterial ||
          material instanceof ThreeMeshPhysicalMaterial
        ) {
          material.lightMap = lightmapTexture
          material.lightMapIntensity = lightMapIntensity
          material.needsUpdate = true
        }
      })
    })
  }, [cupLightmapRect, cupModel, layout.maze.lightmap, lightMapIntensity, lightmapTexture])

  useEffect(() => () => {
    blockGeometry.dispose()
  }, [blockGeometry])

  return (
    <group
      position={[altar.position.x, GROUND_Y, altar.position.z]}
      userData={{
        altarId: altar.id,
        debugRole: 'maze-altar'
      }}
      visible={visible}
    >
      <mesh
        castShadow
        geometry={blockGeometry}
        position-y={0.5}
        receiveShadow
        userData={{ debugRole: 'maze-altar-block' }}
      >
        <AltarBlockMaterial
          lightMap={lightmapTexture}
          lightMapIntensity={lightMapIntensity}
          maps={wallMaps}
          materialKey={materialKey}
          patchConfig={patchConfig}
          probeBlend={STATIC_SURFACE_LIGHTMAP_PROBE_BLEND}
        />
      </mesh>
      {cupModel && cupTransform ? (
        <primitive
          object={cupModel}
          position={[
            cupTransform.modelOffset.x,
            1 + cupTransform.modelOffset.y,
            cupTransform.modelOffset.z
          ]}
          scale={cupTransform.scale}
          userData={{ debugRole: 'altar-cup' }}
        />
      ) : null}
      {offering && !activated ? (
        <AltarOfferingTrophy
          altarPosition={altar.position}
          materialKey={`${materialKey}:offering-trophy`}
          probeBlend={offeringProbeBlend}
          startedAt={offeringStartedAt ?? performance.now()}
        />
      ) : null}
      {activated ? (
        <TorchBillboard
          color={new Color(0, 0, 1)}
          position={[0, 1.08 + 0.15 + TORCH_BILLBOARD_SIZE, 0]}
          seed={10_000 + altarIndex}
          size={TORCH_BILLBOARD_SIZE * 2}
          texture={torchTexture}
        />
      ) : null}
    </group>
  )
}

function MazeAltars({
  activatedAltarIds,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  lightmapTexture,
  lightmapTextureEncoding,
  offeringAltarId,
  offeringStartedAt,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visibilityState
}: {
  activatedAltarIds: Set<string>
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  lightmapTexture: Texture
  lightmapTextureEncoding: LightmapTextureEncoding
  offeringAltarId: string | null
  offeringStartedAt: number | null
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visibilityState: PrecomputedVisibilityState
}) {
  const altars = layout.altars ?? []
  const torchTexture = useFireFlipbookTexture()

  if (altars.length === 0) {
    return null
  }

  return (
    <>
      {altars.map((altar, altarIndex) => (
        <MazeAltarActor
          activated={activatedAltarIds.has(altar.id)}
          altar={altar}
          altarIndex={altarIndex}
          iblContributionIntensity={iblContributionIntensity}
          key={altar.id}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          lightmapTexture={lightmapTexture}
          lightmapTextureEncoding={lightmapTextureEncoding}
          offering={offeringAltarId === altar.id}
          offeringStartedAt={offeringAltarId === altar.id ? offeringStartedAt : null}
          probeDepthAtlasTextures={probeDepthAtlasTextures}
          probeCoefficientTextures={probeCoefficientTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeCoefficients={reflectionProbeCoefficients}
          reflectionProbeDepthTextures={reflectionProbeDepthTextures}
          reflectionProbeTextures={reflectionProbeTextures}
          torchTexture={torchTexture}
          visible={isCellVisible(visibilityState, altar.cell)}
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
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  item: MazeLayout['items'][number]
  layout: MazeLayout
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      iblContributionIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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

  useAttachProbeBlendToModel(model, probeBlend)

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
      visible={visible}
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
  playerCell,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  itemType: 'sword' | 'trophy'
  layout: MazeLayout
  playerCell: { x: number; y: number }
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const group = useRef<Group>(null)
  const heldWorldPosition = useRef(new Vector3())
  const heldWorldTarget = useRef(new Vector3())
  const heldLocalPosition = useRef(new Vector3())
  const heldLocalQuaternion = useRef(new Quaternion())
  const heldWorldObject = useRef(new Object3D())
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      diffuseIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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
        rotationY: 0,
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

  useAttachProbeBlendToModel(model, probeBlend)

  useEffect(() => {
    if (!model) {
      return
    }

    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.frustumCulled = false
        object.renderOrder = 20
      }
    })
  }, [model])

  useFrame(() => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      if (!group.current) {
        return
      }

      const cameraQuaternion = camera.quaternion

      if (itemType === 'sword') {
        heldWorldPosition.current
          .set(0.53, -0.57, -0.07)
          .applyQuaternion(cameraQuaternion)
          .add(camera.position)
        heldWorldTarget.current
          .set(0.23, -0.33, -0.75)
          .applyQuaternion(cameraQuaternion)
          .add(camera.position)
        heldWorldObject.current.position.copy(heldWorldPosition.current)
        heldWorldObject.current.lookAt(heldWorldTarget.current)

        transformWorldPositionToLevelLocal(
          heldWorldPosition.current,
          levelWorldTransform,
          heldLocalPosition.current
        )
        transformWorldQuaternionToLevelLocal(
          heldWorldObject.current.quaternion,
          levelWorldTransform,
          heldLocalQuaternion.current
        )
        group.current.position.copy(heldLocalPosition.current)
        group.current.quaternion.copy(heldLocalQuaternion.current)
        return
      }

      heldWorldPosition.current
        .set(-0.42, -0.52, -0.62)
        .applyQuaternion(cameraQuaternion)
        .add(camera.position)
      transformWorldPositionToLevelLocal(
        heldWorldPosition.current,
        levelWorldTransform,
        heldLocalPosition.current
      )
      transformWorldQuaternionToLevelLocal(
        cameraQuaternion,
        levelWorldTransform,
        heldLocalQuaternion.current
      )

      group.current.position.copy(heldLocalPosition.current)
      group.current.quaternion.copy(heldLocalQuaternion.current)
    } finally {
      endFrameProfileStep('held item pose', profileStartedAt)
    }
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
      visible={visible}
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
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  renderHeldItems,
  turnState,
  visibilityState
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  renderHeldItems: boolean
  turnState: TurnState
  visibilityState: PrecomputedVisibilityState
}) {
  return (
    <>
      {layout.items
        .filter((item) => (
          item.id === 'maze-sword'
            ? turnState.swordState === 'ground'
            : item.id === 'maze-trophy'
              ? turnState.trophyState === 'ground'
              : (turnState.itemStates?.[item.id] ?? 'ground') === 'ground'
        ))
        .map((item, itemIndex) => (
          <MazeItemGroundActor
            debugIndex={itemIndex}
            environmentIntensity={environmentIntensity}
            environmentTexture={environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            item={item}
            key={item.id}
            layout={layout}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visible={isCellVisible(visibilityState, item.cell)}
          />
        ))}
      {renderHeldItems ? (
        <>
          <HeldItemView
            debugIndex={0}
            environmentIntensity={environmentIntensity}
            environmentTexture={environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            itemType="sword"
            layout={layout}
            playerCell={turnState.player.cell}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visible={turnState.player.hasSword}
          />
          <HeldItemView
            debugIndex={1}
            environmentIntensity={environmentIntensity}
            environmentTexture={environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            itemType="trophy"
            layout={layout}
            playerCell={turnState.player.cell}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visible={turnState.player.hasTrophy}
          />
        </>
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
  minotaurAlbedoHex,
  monster,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  minotaurAlbedoHex: string
  monster: TurnMonster
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
}) {
  const levelWorldTransform = useContext(LevelRenderTransformContext)
  const volumetricShadowsEnabled = useContext(VolumetricShadowContext)
  const model = useClonedRuntimeModel(
    MONSTER_MODEL_URLS[monster.type],
    'monster',
    'monster',
    debugIndex
  )
  const minotaurAlbedoColor = useMemo(
    () => colorFromHex(minotaurAlbedoHex, DEFAULT_MINOTAUR_ALBEDO_HEX),
    [minotaurAlbedoHex]
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
  const diffuseProbeIntensity = iblContributionIntensity
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
          radianceMode: 'world',
          region: reflectionProbeBlend.region,
          useProbeConnectivity: volumetricShadowsEnabled,
          vlmMode: 'cell5',
          worldTransform: levelWorldTransform
        }
      ),
    [
      diffuseProbeIntensity,
      layout,
      levelWorldTransform,
      probeCoefficientTextures,
      probeCoefficients,
      probeDepthAtlasTextures,
      probeDepthTextures,
      probeTextures,
      reflectionContributionIntensity,
      reflectionProbeBlend.probeIndices,
      reflectionProbeBlend.region,
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
          : 1.8
    const maxHorizontalDimension = Math.max(size.x, size.z, 0.0001)
    const maxDimension = Math.max(size.x, size.y, size.z, 0.0001)
    const scale = monster.type === 'werewolf'
      ? targetSize / maxHorizontalDimension
      : targetSize / maxDimension
    const spiderLeanRadians = MathUtils.degToRad(60)
    const spiderLeanSign = monster.hand === 'left' ? 1 : -1
    const spiderWallSign = monster.hand === 'left' ? -1 : 1
    const spiderHalfWidth = (size.x * scale) / 2
    const spiderHeight = size.y * scale
    const spiderCos = Math.cos(spiderLeanRadians)
    const spiderSin = Math.sin(spiderLeanRadians) * spiderLeanSign
    const spiderFloorLift = monster.type === 'spider'
      ? spiderHalfWidth * Math.abs(Math.sin(spiderLeanRadians))
      : 0
    const spiderSideExtent = monster.type === 'spider'
      ? (
          spiderWallSign < 0
            ? (-spiderHalfWidth * spiderCos) - (spiderHeight * Math.max(spiderSin, 0))
            : (spiderHalfWidth * spiderCos) - (spiderHeight * Math.min(spiderSin, 0))
        )
      : 0
    const spiderWallOffset = monster.type === 'spider'
      ? (spiderWallSign * ((MAZE_CELL_SIZE / 2) - 0.04)) - spiderSideExtent
      : 0

    return {
      modelOffset: new Vector3(
        (-center.x * scale) + (monster.type === 'spider' ? spiderWallOffset : 0),
        (-bounds.min.y * scale) +
          (monster.type === 'minotaur' ? -0.25 : 0) +
          spiderFloorLift,
        (-center.z * scale) + (monster.type === 'spider' ? 0.5 : 0)
      ),
      modelRotationY: monster.type === 'werewolf' ? Math.PI * 1.5 : 0,
      modelRotationZ:
        monster.type === 'spider'
          ? spiderLeanRadians * spiderLeanSign
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

  useAttachProbeBlendToModel(model, probeBlend)

  useEffect(() => {
    if (!model || monster.type !== 'minotaur') {
      return
    }

    model.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material]

      for (const material of materials) {
        if (
          material instanceof ThreeMeshStandardMaterial ||
          material instanceof ThreeMeshPhysicalMaterial
        ) {
          material.color.copy(minotaurAlbedoColor)
          material.needsUpdate = true
        }
      }
    })
  }, [minotaurAlbedoColor, model, monster.type])

  if (!model || !transform) {
    return null
  }

  model.userData.debugIndex = debugIndex
  model.userData.debugRole = 'monster'
  model.userData.monsterId = monster.id
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
      rotation-y={transform.modelRotationY}
      scale={transform.scale}
    />
  )
}

function MonsterEyes({
  awake,
  eyeColors,
  monsterId,
  monsterHand,
  monsterType,
  settings
}: {
  awake: boolean
  eyeColors: MonsterEyeColorSettings
  monsterId: string
  monsterHand?: 'left' | 'right'
  monsterType: MonsterType
  settings: MonsterEyeSettings
}) {
  const sphereGeometry = useMemo(() => new SphereGeometry(MONSTER_EYE_RADIUS, 12, 8), [])
  const material = useMemo(
    () => new MeshBasicMaterial({
      color: colorFromHex(eyeColors[monsterType], DEFAULT_MONSTER_EYE_COLORS[monsterType])
        .multiplyScalar(4),
      toneMapped: false
    }),
    [eyeColors, monsterType]
  )
  const authoredOffsets = settings[monsterType]
  const offsets = monsterType === 'spider' && monsterHand === 'right'
    ? {
        left: {
          x: -authoredOffsets.right.x,
          y: authoredOffsets.right.y,
          z: authoredOffsets.right.z
        },
        right: {
          x: -authoredOffsets.left.x,
          y: authoredOffsets.left.y,
          z: authoredOffsets.left.z
        }
      }
    : authoredOffsets

  useEffect(() => () => {
    sphereGeometry.dispose()
    material.dispose()
  }, [material, sphereGeometry])

  return (
    <>
      <mesh
        geometry={sphereGeometry}
        material={material}
        position={[offsets.left.x, offsets.left.y, offsets.left.z]}
        userData={{
          debugRole: 'monster-eye',
          lensFlareSource: true,
          monsterId,
          monsterType
        }}
        visible={awake}
      />
      <mesh
        geometry={sphereGeometry}
        material={material}
        position={[offsets.right.x, offsets.right.y, offsets.right.z]}
        userData={{
          debugRole: 'monster-eye',
          lensFlareSource: true,
          monsterId,
          monsterType
        }}
        visible={awake}
      />
    </>
  )
}

function MonsterActor({
  debugIndex,
  environmentIntensity,
  environmentTexture,
  iblContributionIntensity,
  layout,
  lightmapContributionIntensity,
  minotaurAlbedoHex,
  monster,
  monsterEyeColors,
  monsterEyes,
  playerCell,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  visible = true
}: {
  debugIndex: number
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  minotaurAlbedoHex: string
  monster: TurnMonster
  monsterEyeColors: MonsterEyeColorSettings
  monsterEyes: MonsterEyeSettings
  playerCell: { x: number; y: number }
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  visible?: boolean
}) {
  const group = useRef<Group>(null)
  const sequenceAnimation = useRef<{
    phases: Array<
      | {
          fromYaw: number
          toYaw: number
          type: 'turn'
        }
      | {
          from: Vector3
          settle?: Vector3
          to: Vector3
          type: 'move'
        }
    >
    startedAt: number
  } | null>(null)
  const initialized = useRef(false)
  const targetVisible = useRef(visible)
  const targetPosition = useMemo(
    () => getMazeCellWorldPosition(layout.maze, monster.cell, GROUND_Y),
    [layout.maze, monster.cell.x, monster.cell.y]
  )
  const targetYaw = directionToYaw(monster.direction)

  useLayoutEffect(() => {
    targetVisible.current = visible

    if (group.current && !sequenceAnimation.current) {
      group.current.visible = visible
      group.current.userData.targetVisible = visible
    }
  }, [visible])

  useEffect(() => {
    if (!group.current) {
      return
    }

    if (initialized.current) {
      const currentPosition = group.current.position.clone()
      const currentYaw = group.current.rotation.y
      const phases: NonNullable<typeof sequenceAnimation.current>['phases'] = []
      const moved = currentPosition.distanceToSquared(targetPosition) > 0.000001
      let yawAfterMoveTurn = currentYaw

      if (moved) {
        const moveYaw = yawTowardWorldPosition(currentPosition, targetPosition)
        const turnDelta = normalizeAngleRadians(moveYaw - currentYaw)

        if (Math.abs(turnDelta) > 0.001) {
          phases.push({
            fromYaw: currentYaw,
            toYaw: currentYaw + turnDelta,
            type: 'turn'
          })
        }

        phases.push({
          from: currentPosition,
          to: targetPosition.clone(),
          type: 'move'
        })
        yawAfterMoveTurn = moveYaw
      } else if (monster.failedMoveDirection) {
        const failedOffset = directionToWorldOffset(monster.failedMoveDirection)
        const failedTargetPosition = currentPosition.clone().add(
          new Vector3(
            failedOffset.x * BLOCKED_MOVE_FRACTION,
            0,
            failedOffset.z * BLOCKED_MOVE_FRACTION
          )
        )
        const failedYaw = directionToYaw(monster.failedMoveDirection)
        const turnDelta = normalizeAngleRadians(failedYaw - currentYaw)

        if (Math.abs(turnDelta) > 0.001) {
          phases.push({
            fromYaw: currentYaw,
            toYaw: currentYaw + turnDelta,
            type: 'turn'
          })
        }

        phases.push({
          from: currentPosition,
          settle: targetPosition.clone(),
          to: failedTargetPosition,
          type: 'move'
        })
        yawAfterMoveTurn = failedYaw
      }

      if (monster.awake || !moved) {
        const finalDelta = normalizeAngleRadians(targetYaw - yawAfterMoveTurn)

        if (Math.abs(finalDelta) > 0.001) {
          phases.push({
            fromYaw: yawAfterMoveTurn,
            toYaw: yawAfterMoveTurn + finalDelta,
            type: 'turn'
          })
        }
      }

      sequenceAnimation.current = phases.length > 0
        ? {
            phases,
            startedAt: performance.now()
          }
        : null
      group.current.visible = phases.length > 0
        ? Boolean(group.current.visible || targetVisible.current)
        : targetVisible.current
      group.current.userData.targetVisible = targetVisible.current

      if (phases.length === 0) {
        group.current.position.copy(targetPosition)
        group.current.rotation.y = targetYaw
        group.current.userData.animationActive = false
      }
      return
    }

    group.current.position.copy(targetPosition)
    group.current.rotation.y = targetYaw
    group.current.visible = targetVisible.current
    initialized.current = true
    group.current.userData.animationActive = false
    group.current.userData.targetVisible = targetVisible.current
  }, [targetPosition, targetYaw])

  useFrame(() => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      if (!group.current) {
        return
      }

      const activeSequenceAnimation = sequenceAnimation.current
      group.current.userData.animationActive = Boolean(activeSequenceAnimation)

      if (activeSequenceAnimation) {
        const phaseDuration = getScaledAnimationDuration(TURN_ANIMATION_DURATION_MS)
        const elapsed = performance.now() - activeSequenceAnimation.startedAt
        const phaseIndex = Math.min(
          activeSequenceAnimation.phases.length - 1,
          Math.floor(elapsed / phaseDuration)
        )
        const phaseAlpha = Math.min(1, (elapsed - (phaseIndex * phaseDuration)) / phaseDuration)
        const phase = activeSequenceAnimation.phases[phaseIndex]

        for (let index = 0; index < phaseIndex; index += 1) {
          const completedPhase = activeSequenceAnimation.phases[index]

          if (completedPhase.type === 'move') {
            group.current.position.copy(completedPhase.settle ?? completedPhase.to)
          } else {
            group.current.rotation.y = completedPhase.toYaw
          }
        }

        if (phase.type === 'move') {
          if (phase.settle) {
            const bumpAlpha = Math.sin(phaseAlpha * Math.PI)
            group.current.position.lerpVectors(phase.from, phase.to, bumpAlpha)
          } else {
            group.current.position.lerpVectors(phase.from, phase.to, phaseAlpha)
          }
        } else {
          group.current.rotation.y = phase.fromYaw + ((phase.toYaw - phase.fromYaw) * phaseAlpha)
        }

        if (elapsed >= activeSequenceAnimation.phases.length * phaseDuration) {
          sequenceAnimation.current = null
          group.current.position.copy(targetPosition)
          group.current.rotation.y = targetYaw
          group.current.visible = targetVisible.current
          group.current.userData.animationActive = false
          group.current.userData.targetVisible = targetVisible.current
        }
      }
    } finally {
      endFrameProfileStep('monster animation', profileStartedAt)
    }
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
        minotaurAlbedoHex={minotaurAlbedoHex}
        monster={monster}
        probeDepthAtlasTextures={probeDepthAtlasTextures}
        probeCoefficientTextures={probeCoefficientTextures}
        reflectionContributionIntensity={reflectionContributionIntensity}
        reflectionProbeCoefficients={reflectionProbeCoefficients}
        reflectionProbeDepthTextures={reflectionProbeDepthTextures}
        reflectionProbeTextures={reflectionProbeTextures}
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
  minotaurAlbedoHex,
  probeDepthAtlasTextures,
  probeCoefficientTextures,
  reflectionContributionIntensity,
  reflectionProbeCoefficients,
  reflectionProbeDepthTextures,
  reflectionProbeTextures,
  turnState,
  monsterEyeColors,
  monsterEyes,
  visibilityState = DISABLED_PRECOMPUTED_VISIBILITY
}: {
  environmentIntensity: number
  environmentTexture: Texture | null
  iblContributionIntensity: number
  layout: MazeLayout
  lightmapContributionIntensity: number
  minotaurAlbedoHex: string
  probeDepthAtlasTextures: ProbeDepthAtlasTextures
  probeCoefficientTextures: [Texture, Texture, Texture, Texture]
  reflectionContributionIntensity: number
  reflectionProbeCoefficients: Array<ProbeIrradianceCoefficients | null>
  reflectionProbeDepthTextures: CubeTexture[]
  reflectionProbeTextures: Texture[]
  turnState: TurnState
  monsterEyeColors: MonsterEyeColorSettings
  monsterEyes: MonsterEyeSettings
  visibilityState?: PrecomputedVisibilityState
}) {
  return (
    <>
      {turnState.monsters.map((monster, index) => {
        const playerDistance =
          Math.abs(monster.cell.x - turnState.player.cell.x) +
          Math.abs(monster.cell.y - turnState.player.cell.y)
        const visible =
          isCellVisible(visibilityState, monster.cell) ||
          (
            (monster.type === 'minotaur' || monster.type === 'werewolf') &&
            playerDistance <= 5
          )

        return (
          <MonsterActor
            debugIndex={index}
            environmentIntensity={environmentIntensity}
            environmentTexture={environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            key={monster.id}
            layout={layout}
            lightmapContributionIntensity={lightmapContributionIntensity}
            minotaurAlbedoHex={minotaurAlbedoHex}
            monster={monster}
            monsterEyeColors={monsterEyeColors}
            monsterEyes={monsterEyes}
            playerCell={turnState.player.cell}
            probeDepthAtlasTextures={probeDepthAtlasTextures}
            probeCoefficientTextures={probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={reflectionProbeCoefficients}
            reflectionProbeDepthTextures={reflectionProbeDepthTextures}
            reflectionProbeTextures={reflectionProbeTextures}
            visible={visible}
          />
        )
      })}
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
    this.needsDepthTexture = false
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
    withFrameProfileScope('copy input to bloom target', () => {
      renderer.setRenderTarget(this.tempRenderTarget)
      renderer.render(this.copyScene, this.copyCamera)
    })

    this.inner.renderToScreen = false
    withFrameProfileScope('unreal bloom inner pass', () => {
      this.inner.render(
        renderer,
        outputBuffer,
        this.tempRenderTarget,
        deltaTime,
        stencilTest
      )
    })

    this.copyMaterial.uniforms.inputBuffer.value = this.tempRenderTarget.texture
    withFrameProfileScope('copy bloom output', () => {
      renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
      renderer.render(this.copyScene, this.copyCamera)
    })
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

function TunedN8AO({
  aoRadius,
  denoiseIterations,
  denoiseRadius,
  denoiseSamples,
  aoSamples,
  intensity
}: {
  aoRadius: number
  denoiseIterations: number
  denoiseRadius: number
  denoiseSamples: number
  aoSamples: number
  intensity: number
}) {
  const passRef = useRef<{
    autoDetectTransparency?: boolean
    configuration?: {
      denoiseIterations?: number
      transparencyAware?: boolean
    }
    name?: string
  } | null>(null)

  useEffect(() => {
    if (passRef.current) {
      passRef.current.name = 'N8AO'
      passRef.current.autoDetectTransparency = false
      instrumentN8AOPass(passRef.current as unknown as Record<string | symbol, unknown>)
      instrumentN8AOQuads(passRef.current as unknown as Record<string, unknown>)
    }

    const configuration = passRef.current?.configuration

    if (!configuration) {
      return
    }

    configuration.denoiseIterations = denoiseIterations
    configuration.transparencyAware = false
    instrumentN8AOQuads(passRef.current as unknown as Record<string, unknown>)
  }, [denoiseIterations])

  return (
    <N8AO
      aoRadius={aoRadius}
      aoSamples={aoSamples}
      color="#000000"
      denoiseSamples={denoiseSamples}
      denoiseRadius={denoiseRadius}
      depthAwareUpsampling
      distanceFalloff={1}
      halfRes
      intensity={intensity}
      ref={passRef}
    />
  )
}

function PerformanceBenchmarkBridge() {
  const advance = useThree((state) => state.advance)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const get = useThree((state) => state.get)
  const invalidate = useThree((state) => state.invalidate)
  const scene = useThree((state) => state.scene)
  const setFrameloop = useThree((state) => state.setFrameloop)

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamBenchmark?: (samples?: number) => Promise<BenchmarkResult>
      __levelsjamCapturePerformanceProfile?: (
        options?: { liveDurationMs?: number; liveOnly?: boolean; samples?: number; traversalLabel?: string }
      ) => Promise<PerformanceProfileResult>
      __levelsjamGetVisualSettings?: () => VisualSettings
      __levelsjamSetVisualSettings?: (patch: VisualSettingsPatch) => void
      __levelsjamWarmPerformanceScene?: () => Promise<boolean>
    }
    const finish = gl.getContext().finish?.bind(gl.getContext())
    const originalRender = gl.render.bind(gl)
    const profiledGl = gl as typeof gl & {
      __levelsjamOriginalRender?: typeof gl.render
    }
    const gpuTimerSupported = configureGpuFrameProfiler(gl)

    if (!profiledGl.__levelsjamOriginalRender) {
      profiledGl.__levelsjamOriginalRender = originalRender
      gl.render = ((...args: Parameters<typeof gl.render>) => {
        const profileStartedAt = beginFrameProfileStep()
        const scopedRenderLabel = getScopedFrameProfileLabel(
          'Renderer/WebGLRenderer.render submission'
        )
        const beforeCalls = gl.info.render.calls
        const beforeTriangles = gl.info.render.triangles

        try {
          return profiledGl.__levelsjamOriginalRender?.(...args)
        } finally {
          const target = gl.getRenderTarget()
          const targetLabel = target
            ? `render target ${target.width}x${target.height}`
            : 'screen'

          recordRenderProfileStats(
            `${scopedRenderLabel}/${targetLabel}`,
            gl.info.render.calls - beforeCalls,
            gl.info.render.triangles - beforeTriangles
          )
          endFrameProfileStep(
            `Renderer/WebGLRenderer.render submission/${targetLabel}`,
            profileStartedAt
          )
        }
      }) as typeof gl.render
    }

    const waitForFrames = (frameCount: number) => new Promise<void>((resolve) => {
      let remaining = Math.max(1, frameCount)
      const step = () => {
        remaining -= 1
        if (remaining <= 0) {
          resolve()
          return
        }
        requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
    })

    const runBenchmark = async (samples = 90) => {
      const durations: number[] = []
      const renderCalls: number[] = []
      const triangles: number[] = []
      const initialTimestamp = performance.now()
      const originalFrameloop = get().frameloop
      const originalInfoAutoReset = gl.info.autoReset

      gl.info.autoReset = false
      setFrameloop('never')

      try {
        for (let index = 0; index < samples; index += 1) {
          const start = performance.now()

          gl.info.reset()
          advance(initialTimestamp + (index * (1000 / 120)), true)
          finish?.()

          durations.push(performance.now() - start)
          renderCalls.push(gl.info.render.calls)
          triangles.push(gl.info.render.triangles)
        }
      } finally {
        gl.info.autoReset = originalInfoAutoReset
        setFrameloop(originalFrameloop)
        invalidate()
      }

      const totalDuration = durations.reduce((sum, value) => sum + value, 0)
      const averageFrameMs = totalDuration / durations.length
      const averageRenderCalls =
        renderCalls.reduce((sum, value) => sum + value, 0) / renderCalls.length
      const averageTriangles =
        triangles.reduce((sum, value) => sum + value, 0) / triangles.length

      return {
        averageFrameMs,
        averageRenderCalls,
        averageTriangles,
        fps: 1000 / averageFrameMs,
        maxRenderCalls: Math.max(...renderCalls),
        maxTriangles: Math.max(...triangles),
        maxFrameMs: Math.max(...durations),
        minFrameMs: Math.min(...durations),
        samples
      }
    }
    const captureLiveFrames = async (durationMs: number) => new Promise<PerformanceProfileResult['liveFrames']>((resolve) => {
      const frames: number[] = []
      let previous = performance.now()
      const deadline = previous + Math.max(250, durationMs)
      const startedAt = previous
      const longFrames: PerformanceProfileResult['liveFrames']['longFrames'] = []
      let previousRenderLoops = collectRenderLoops()

      resetFrameProfileSteps()
      activeFrameProfile.enabled = true

      const step = (now: number) => {
        const delta = now - previous

        if (delta > 0) {
          const renderLoops = collectRenderLoops()
          recordFrameProfileFrame()
          frames.push(delta)
          if (delta >= 50) {
            const renderLoopDelta = Object.fromEntries(
              Object.entries(renderLoops).map(([key, value]) => [
                key,
                value - (previousRenderLoops[key] ?? 0)
              ])
            )
            longFrames.push({
              frameMs: delta,
              fireFlipbookReady: document.body.dataset.fireFlipbookReady ?? null,
              loadedMazeId: document.body.dataset.loadedMazeId ?? null,
              renderLoopDelta,
              renderLoops,
              sceneProgramsReady: document.body.dataset.sceneProgramsReady ?? null,
              t: now - startedAt
            })
          }
          previousRenderLoops = renderLoops
        }
        previous = now

        if (now >= deadline) {
          activeFrameProfile.enabled = false
          const total = frames.reduce((sum, value) => sum + value, 0)
          const averageFrameMs = total / Math.max(1, frames.length)

          resolve({
            averageFrameMs,
            fps: 1000 / averageFrameMs,
            longFrames: longFrames.slice(0, 20),
            maxFrameMs: Math.max(...frames),
            minFrameMs: Math.min(...frames),
            samples: frames.length
          })
          return
        }

        requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
    })
    const collectSceneStats = () => {
      const effectivelyVisible: Record<string, number> = {}
      const instancingCandidateMap = new Map<string, {
        count: number
        materialKey: string
        role: string
        trianglesPerMesh: number
        totalTriangles: number
      }>()
      const roleBatchingPotentialMap = new Map<string, {
        averageTrianglesPerMesh: number
        effectiveMeshes: number
        potentialSavedDraws: number
        role: string
        totalTriangles: number
      }>()
      const meshWorkloadByLevelAndRole = new Map<string, {
        effectivelyVisibleMeshes: number
        levelId: string
        mountedMeshes: number
        role: string
        totalTriangles: number
        visibleMeshes: number
      }>()
      const meshWorkloadByRole = new Map<string, {
        effectivelyVisibleMeshes: number
        instancingCandidateMeshes: number
        instancingCandidateSavedDraws: number
        mountedMeshes: number
        totalTriangles: number
        visibleMeshes: number
      }>()
      const mounted: Record<string, number> = {}
      const visible: Record<string, number> = {}
      let totalEffectivelyVisible = 0
      let totalMounted = 0
      let totalVisible = 0
      const getMeshTriangles = (geometry: BufferGeometry | undefined) => {
        if (!geometry) {
          return 0
        }

        if (geometry.index) {
          return geometry.index.count / 3
        }

        return (geometry.getAttribute('position')?.count ?? 0) / 3
      }
      const getMaterialKey = (material: Material | Material[] | undefined) => (
        (Array.isArray(material) ? material : [material])
          .filter((candidate): candidate is Material => Boolean(candidate))
          .map((candidate) => `${candidate.type}:${candidate.uuid}`)
          .join('+') || 'none'
      )
      const getMeshWorkload = (role: string) => {
        let workload = meshWorkloadByRole.get(role)

        if (!workload) {
          workload = {
            effectivelyVisibleMeshes: 0,
            instancingCandidateMeshes: 0,
            instancingCandidateSavedDraws: 0,
            mountedMeshes: 0,
            totalTriangles: 0,
            visibleMeshes: 0
          }
          meshWorkloadByRole.set(role, workload)
        }

        return workload
      }
      const getStreamedLevelId = (object: Object3D) => {
        let current: Object3D | null = object

        while (current) {
          const levelId = current.userData?.streamedLevelId

          if (typeof levelId === 'string') {
            return levelId
          }

          current = current.parent
        }

        return 'global'
      }
      const getLevelRoleWorkload = (levelId: string, role: string) => {
        const key = `${levelId}|${role}`
        let workload = meshWorkloadByLevelAndRole.get(key)

        if (!workload) {
          workload = {
            effectivelyVisibleMeshes: 0,
            levelId,
            mountedMeshes: 0,
            role,
            totalTriangles: 0,
            visibleMeshes: 0
          }
          meshWorkloadByLevelAndRole.set(key, workload)
        }

        return workload
      }

      scene.traverse((object) => {
        totalMounted += 1
        const role = typeof object.userData?.debugRole === 'string'
          ? object.userData.debugRole
          : (
            Array.isArray(object.userData?.debugRoles)
              ? object.userData.debugRoles[0]
              : object.type
          )

        mounted[role] = (mounted[role] ?? 0) + 1

        if (object.visible) {
          totalVisible += 1
          visible[role] = (visible[role] ?? 0) + 1
        }

        let effectiveVisible = object.visible
        let parent = object.parent

        while (effectiveVisible && parent) {
          effectiveVisible = parent.visible
          parent = parent.parent
        }

        if (effectiveVisible) {
          totalEffectivelyVisible += 1
          effectivelyVisible[role] = (effectivelyVisible[role] ?? 0) + 1
        }

        if (object instanceof Mesh) {
          const levelId = getStreamedLevelId(object)
          const workload = getMeshWorkload(role)
          const levelRoleWorkload = getLevelRoleWorkload(levelId, role)
          const triangleCount = getMeshTriangles(object.geometry)

          workload.mountedMeshes += 1
          levelRoleWorkload.mountedMeshes += 1

          if (object.visible) {
            workload.visibleMeshes += 1
            levelRoleWorkload.visibleMeshes += 1
          }

          if (effectiveVisible) {
            const materialKey = getMaterialKey(object.material)
            const instanceKey = `${role}|${object.geometry?.uuid ?? 'none'}|${materialKey}`

            workload.effectivelyVisibleMeshes += 1
            workload.totalTriangles += triangleCount
            levelRoleWorkload.effectivelyVisibleMeshes += 1
            levelRoleWorkload.totalTriangles += triangleCount

            const roleBatchingPotential = roleBatchingPotentialMap.get(role) ?? {
              averageTrianglesPerMesh: 0,
              effectiveMeshes: 0,
              potentialSavedDraws: 0,
              role,
              totalTriangles: 0
            }

            roleBatchingPotential.effectiveMeshes += 1
            roleBatchingPotential.totalTriangles += triangleCount
            roleBatchingPotential.potentialSavedDraws = Math.max(
              0,
              roleBatchingPotential.effectiveMeshes - 1
            )
            roleBatchingPotential.averageTrianglesPerMesh =
              roleBatchingPotential.totalTriangles /
              Math.max(1, roleBatchingPotential.effectiveMeshes)
            roleBatchingPotentialMap.set(role, roleBatchingPotential)

            const candidate = instancingCandidateMap.get(instanceKey) ?? {
              count: 0,
              materialKey,
              role,
              totalTriangles: 0,
              trianglesPerMesh: triangleCount
            }

            candidate.count += 1
            candidate.totalTriangles += triangleCount
            instancingCandidateMap.set(instanceKey, candidate)
          }
        }
      })

      const instancingCandidates = Array.from(instancingCandidateMap.values())
        .filter((candidate) => candidate.count >= 2)
        .map((candidate) => ({
          ...candidate,
          potentialSavedDraws: candidate.count - 1
        }))
        .sort((left, right) =>
          (right.potentialSavedDraws - left.potentialSavedDraws) ||
          (right.totalTriangles - left.totalTriangles)
        )
        .slice(0, 30)

      for (const candidate of instancingCandidates) {
        const workload = meshWorkloadByRole.get(candidate.role)

        if (workload) {
          workload.instancingCandidateMeshes += candidate.count
          workload.instancingCandidateSavedDraws += candidate.potentialSavedDraws
        }
      }

      return {
        effectivelyVisible,
        instancingCandidates,
        memory: {
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures
        },
        meshWorkloadByLevelAndRole: Object.fromEntries(
          Array.from(meshWorkloadByLevelAndRole.entries())
            .sort((left, right) => right[1].totalTriangles - left[1].totalTriangles)
        ),
        meshWorkloadByRole: Object.fromEntries(
          Array.from(meshWorkloadByRole.entries())
            .sort((left, right) => right[1].totalTriangles - left[1].totalTriangles)
        ),
        mounted,
        programs: gl.info.programs?.length ?? null,
        roleBatchingPotential: Array.from(roleBatchingPotentialMap.values())
          .filter((candidate) => candidate.effectiveMeshes >= 2)
          .sort((left, right) =>
            (right.potentialSavedDraws - left.potentialSavedDraws) ||
            (right.totalTriangles - left.totalTriangles)
          ),
        totalEffectivelyVisible,
        totalMounted,
        totalVisible,
        visible
      }
    }
    const collectRenderLoops = () => {
      const levelLightingStates = (scene.userData as {
        levelLightingStatesByLevel?: Record<string, {
          reflectionProbeState?: RuntimeReflectionProbeState
        }>
      }).levelLightingStatesByLevel ?? {}
      const reflectionProbeStates = Object.values(levelLightingStates)
        .map((state) => state.reflectionProbeState)
        .filter(Boolean) as RuntimeReflectionProbeState[]

      return {
        rendererGeometries: gl.info.memory.geometries,
        rendererPrograms: gl.info.programs?.length ?? 0,
        shaderProgramIncreaseCount: Number(document.body.dataset.shaderProgramIncreaseCount ?? '0'),
        rendererTextures: gl.info.memory.textures,
        mountedLevels: Object.keys(levelLightingStates).length,
        residentReflectionProbes: reflectionProbeStates.reduce(
          (sum, state) => sum + (state.loadedProbeCount ?? 0),
          0
        ),
        residentVolumetricProbes: reflectionProbeStates.reduce(
          (sum, state) => sum + (state.loadedVolumetricProbeCount ?? 0),
          0
        ),
        sceneChildren: scene.children.length
      }
    }
    const getRendererString = () => {
      const rawGl = gl.getContext()
      const extension = rawGl.getExtension('WEBGL_debug_renderer_info')

      if (!extension) {
        return rawGl.getParameter(rawGl.RENDERER)
      }

      return `${rawGl.getParameter(extension.UNMASKED_VENDOR_WEBGL)} ${rawGl.getParameter(extension.UNMASKED_RENDERER_WEBGL)}`
    }
    const formatNumber = (value: number) => Number.isFinite(value)
      ? value.toFixed(3)
      : 'n/a'
    const formatProfileMarkdown = (profile: Omit<PerformanceProfileResult, 'markdown'>) => {
      const frameStepLabelSet = new Set(profile.frameSteps.map((step) => step.label))
      const isTopLevelStep = (step: FrameProfileStep) => {
        const parts = step.label.split('/')

        for (let index = 1; index < parts.length; index += 1) {
          if (frameStepLabelSet.has(parts.slice(0, index).join('/'))) {
            return false
          }
        }

        return true
      }
      const appStepTotalMs = profile.frameSteps
        .filter(isTopLevelStep)
        .reduce((sum, step) => sum + step.averageMs, 0)
      const uninstrumentedMs = Math.max(0, profile.liveFrames.averageFrameMs - appStepTotalMs)
      type TreeNode = {
        children: Map<string, TreeNode>
        count: number
        exactAverageMs: number
        maxMs: number
        totalAverageMs: number
      }
      const rootNode: TreeNode = {
        children: new Map(),
        count: 0,
        exactAverageMs: 0,
        maxMs: 0,
        totalAverageMs: 0
      }
      const addTreeStep = (step: FrameProfileStep) => {
        const parts = step.label.split('/').filter(Boolean)
        let node = rootNode

        for (const part of parts) {
          let child = node.children.get(part)

          if (!child) {
            child = {
              children: new Map(),
              count: 0,
              exactAverageMs: 0,
              maxMs: 0,
              totalAverageMs: 0
            }
            node.children.set(part, child)
          }

          node = child
        }

        node.exactAverageMs += step.averageMs
        node.count += step.count
        node.maxMs = Math.max(node.maxMs, step.maxMs)
      }
      const finalizeTreeNode = (node: TreeNode): number => {
        const childTotal = Array.from(node.children.values())
          .reduce((sum, child) => sum + finalizeTreeNode(child), 0)

        node.totalAverageMs = Math.max(node.exactAverageMs, childTotal)

        return node.totalAverageMs
      }
      const formatTreeNode = (
        label: string,
        node: TreeNode,
        depth: number
      ): string[] => {
        if (node.totalAverageMs < 0.1) {
          return []
        }

        const indent = '  '.repeat(depth)
        const suffix = node.children.size === 0
          ? ` avg, ${formatNumber(node.maxMs)}ms max, ${node.count} calls`
          : ''
        const lines = [
          `${indent}- ${label}: ${formatNumber(node.totalAverageMs)}ms${suffix}`
        ]

        for (const [childLabel, childNode] of Array.from(node.children.entries())
          .sort((left, right) => right[1].totalAverageMs - left[1].totalAverageMs)) {
          lines.push(...formatTreeNode(childLabel, childNode, depth + 1))
        }

        if (node.children.size > 0) {
          const childTotal = Array.from(node.children.values())
            .reduce((sum, child) => sum + child.totalAverageMs, 0)
          const residual = Math.max(0, node.exactAverageMs - childTotal)

          if (residual >= 0.1) {
            lines.push(`${indent}  - self/uninstrumented child work: ${formatNumber(residual)}ms`)
          }
        }

        return lines
      }

      for (const step of profile.frameSteps) {
        addTreeStep(step)
      }
      finalizeTreeNode(rootNode)

      const instrumentedTreeLines = Array.from(rootNode.children.entries())
        .sort((left, right) => right[1].totalAverageMs - left[1].totalAverageMs)
        .flatMap(([label, node]) => formatTreeNode(label, node, 2))
      const longFrameResourceChanges = profile.liveFrames.longFrames
        .filter((frame) => Object.values(frame.renderLoopDelta).some((value) => value !== 0))
      const topCpuSteps = profile.frameSteps
        .filter((step) => step.averageMs >= 0.1)
        .sort((left, right) => right.averageMs - left.averageMs)
        .slice(0, 5)
      const topGpuSteps = profile.gpuFrameSteps
        .filter((step) => step.averageMs >= 0.1)
        .sort((left, right) => right.averageMs - left.averageMs)
        .slice(0, 5)
      const latestStep = profile.controlledSteps[0]
      const controlledDefaultRenderMs = latestStep?.benchmark.averageFrameMs ?? null
      const controlledDefaultFps = latestStep?.benchmark.fps ?? null
      const latestSceneStats = (latestStep?.sceneStats ?? {}) as {
        instancingCandidates?: Array<{
          count: number
          potentialSavedDraws: number
          role: string
          totalTriangles: number
          trianglesPerMesh: number
        }>
        meshWorkloadByLevelAndRole?: Record<string, {
          effectivelyVisibleMeshes: number
          levelId: string
          mountedMeshes: number
          role: string
          totalTriangles: number
          visibleMeshes: number
        }>
        meshWorkloadByRole?: Record<string, {
          effectivelyVisibleMeshes: number
          instancingCandidateMeshes: number
          instancingCandidateSavedDraws: number
          mountedMeshes: number
          totalTriangles: number
          visibleMeshes: number
        }>
        roleBatchingPotential?: Array<{
          averageTrianglesPerMesh: number
          effectiveMeshes: number
          potentialSavedDraws: number
          role: string
          totalTriangles: number
        }>
      }
      const meshWorkloadRows = Object.entries(latestSceneStats.meshWorkloadByRole ?? {})
        .filter(([, workload]) =>
          workload.effectivelyVisibleMeshes > 0 ||
          workload.totalTriangles > 0
        )
        .sort((left, right) => right[1].totalTriangles - left[1].totalTriangles)
      const meshWorkloadByLevelRows = Object.values(latestSceneStats.meshWorkloadByLevelAndRole ?? {})
        .filter((workload) =>
          workload.effectivelyVisibleMeshes > 0 ||
          workload.totalTriangles > 0
        )
        .sort((left, right) => right.totalTriangles - left.totalTriangles)
      const instancingCandidateRows = latestSceneStats.instancingCandidates ?? []
      const roleBatchingPotentialRows = latestSceneStats.roleBatchingPotential ?? []
      const frameTreeLines = [
        `- Live traversal frame: ${formatNumber(profile.liveFrames.averageFrameMs)}ms (${formatNumber(profile.liveFrames.fps)} FPS)`,
        ...(
          appStepTotalMs >= 0.1
            ? [`  - Instrumented frame work: ${formatNumber(appStepTotalMs)}ms`]
            : []
        ),
        ...instrumentedTreeLines,
        `  - Browser, GPU driver, GPU execution, compositor, vsync, and uninstrumented library work: ${formatNumber(uninstrumentedMs)}ms`,
        `    - App-owned CPU scopes stop here; compare against the controlled render benchmark, GPU timer-query table, and any appended Chrome trace.`
      ]
      const lines: string[] = [
        '# Performance Profile',
        '',
        `Captured: ${profile.capturedAt}`,
        `Renderer: ${profile.renderer}`,
        '',
        '## Live End-To-End Traversal',
        '',
        `- Average frame: ${formatNumber(profile.liveFrames.averageFrameMs)}ms (${formatNumber(profile.liveFrames.fps)} FPS)`,
        `- Min/max frame: ${formatNumber(profile.liveFrames.minFrameMs)}ms / ${formatNumber(profile.liveFrames.maxFrameMs)}ms`,
        `- Samples: ${profile.liveFrames.samples}`,
        `- Long frames over 50ms: ${profile.liveFrames.longFrames.length}`,
        '',
        '## Diagnosis',
        '',
        `- App-owned JavaScript/render scopes account for ${formatNumber(appStepTotalMs)}ms/frame of the ${formatNumber(profile.liveFrames.averageFrameMs)}ms average frame interval.`,
        ...(
          controlledDefaultRenderMs !== null && controlledDefaultFps !== null
            ? [`- A direct controlled render benchmark of the same scene takes ${formatNumber(controlledDefaultRenderMs)}ms/frame (${formatNumber(controlledDefaultFps)} FPS), so any live-frame time above that is frame scheduling, browser/compositor/GPU present work, input animation timing, or uninstrumented library work rather than scene draw submission alone.`]
            : []
        ),
        `- The remaining ${formatNumber(uninstrumentedMs)}ms/frame is browser frame cadence, compositor, GPU driver, vsync/idle, or library work outside the app-owned scopes; append a Chrome trace to split this bucket by browser thread.`,
        `- Long frames with changing render-loop resource counts: ${longFrameResourceChanges.length}/${profile.liveFrames.longFrames.length}.`,
        ...(
          longFrameResourceChanges.length > 0
            ? ['- The long-frame table includes per-frame resource deltas so streaming/probe residency churn is visible instead of hidden inside the frame average.']
            : ['- No long frame in this sample coincided with a tracked render-loop resource-count change.']
        ),
        ...(
          topCpuSteps.length > 0
            ? [`- Largest app CPU scopes: ${topCpuSteps.map((step) => `${step.label} ${formatNumber(step.averageMs)}ms`).join('; ')}.`]
            : []
        ),
        ...(
          profile.gpuTimerSupported && topGpuSteps.length > 0
            ? [`- Largest GPU timer-query scopes: ${topGpuSteps.map((step) => `${step.label} ${formatNumber(step.averageMs)}ms`).join('; ')}.`]
            : []
        ),
        '',
        '## Frame-Time Tree',
        '',
        ...frameTreeLines,
        '',
        '## Long Frames',
        '',
        ...(
          profile.liveFrames.longFrames.length > 0
            ? profile.liveFrames.longFrames.map((frame) => (
              `- ${formatNumber(frame.frameMs)}ms at +${formatNumber(frame.t)}ms; maze=${frame.loadedMazeId ?? 'n/a'}; programs=${frame.sceneProgramsReady ?? 'n/a'}; fire=${frame.fireFlipbookReady ?? 'n/a'}; delta=${JSON.stringify(frame.renderLoopDelta)}; loops=${JSON.stringify(frame.renderLoops)}`
            ))
            : ['- None over 50ms.']
        ),
        '',
        '## Controlled Render Cost',
        '',
        '| Step | Avg ms/frame | FPS | Max ms | Calls | Triangles | Samples |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...profile.controlledSteps.map((step) => (
          `| ${step.label} | ${formatNumber(step.benchmark.averageFrameMs)} | ${formatNumber(step.benchmark.fps)} | ${formatNumber(step.benchmark.maxFrameMs)} | ${formatNumber(step.benchmark.averageRenderCalls ?? 0)} | ${formatNumber(step.benchmark.averageTriangles ?? 0)} | ${step.benchmark.samples} |`
        )),
        '',
        '## GPU Timer Query Steps',
        '',
        profile.gpuTimerSupported
          ? '| Step | Avg GPU ms/frame | Max GPU ms | Calls |'
          : '- WebGL GPU timer queries are unavailable in this browser.',
        ...(profile.gpuTimerSupported ? ['| --- | ---: | ---: | ---: |'] : []),
        ...(
          profile.gpuTimerSupported
            ? profile.gpuFrameSteps
              .filter((step) => step.averageMs >= 0.1)
              .map((step) => (
                `| ${step.label} | ${formatNumber(step.averageMs)} | ${formatNumber(step.maxMs)} | ${step.count} |`
              ))
            : []
        ),
        '',
        '## Render Submission Workload',
        '',
        '| Step | Avg calls/frame | Avg triangles/frame | Max calls | Max triangles | Submissions |',
        '| --- | ---: | ---: | ---: | ---: | ---: |',
        ...profile.renderSteps
          .filter((step) => step.averageCalls >= 0.1 || step.averageTriangles >= 1)
          .map((step) => (
            `| ${step.label} | ${formatNumber(step.averageCalls)} | ${formatNumber(step.averageTriangles)} | ${step.maxCalls} | ${step.maxTriangles} | ${step.count} |`
          )),
        '',
        '## Expensive Computational Actions',
        '',
        '- Main RenderPass performs the forward scene render: frustum/object visibility evaluation inside three.js, material/program selection, uniform/texture binding, and WebGL draw submission for the calls and triangles listed above.',
        '- N8AO performs full-screen depth/normal preparation, screen-space ambient-occlusion sampling, denoise/accumulation, and AO composite at the composer render resolution; the runtime transparency-aware scene rerender path is disabled because torch billboards are composited after AO.',
        '- Volumetric fog is a full-screen shader pass that raymarches the depth buffer and samples nearby volumetric-lightmap atlases for fog lighting.',
        '- BillboardCompositePass renders torch billboards on their own layer after opaque scene lighting, sampling the flame flipbook and depth-testing against scene geometry.',
        '- Lens-flare source selection projects currently visible flare sources, tests occlusion rays against low-poly opaque meshes, and uses bounding boxes for high-poly opaque meshes to avoid per-triangle raycasts through monster assets.',
        '',
        '## Scene Mesh Workload By Role',
        '',
        '| Role | Effective meshes | Visible meshes | Mounted meshes | Triangles | Instancing-candidate meshes | Potential saved draws |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...meshWorkloadRows.map(([role, workload]) => (
          `| ${role} | ${workload.effectivelyVisibleMeshes} | ${workload.visibleMeshes} | ${workload.mountedMeshes} | ${formatNumber(workload.totalTriangles)} | ${workload.instancingCandidateMeshes} | ${workload.instancingCandidateSavedDraws} |`
        )),
        '',
        '## Scene Mesh Workload By Level And Role',
        '',
        '| Level | Role | Effective meshes | Visible meshes | Mounted meshes | Triangles |',
        '| --- | --- | ---: | ---: | ---: | ---: |',
        ...meshWorkloadByLevelRows.slice(0, 40).map((workload) => (
          `| ${workload.levelId} | ${workload.role} | ${workload.effectivelyVisibleMeshes} | ${workload.visibleMeshes} | ${workload.mountedMeshes} | ${formatNumber(workload.totalTriangles)} |`
        )),
        '',
        '## Repeated Geometry Batching Potential',
        '',
        'This groups by conceptual debug role, not identical geometry UUID. It estimates draw-call upside if repeated objects are rebuilt to share geometry/material variants or become instanced batches.',
        '',
        '| Role | Effective meshes | Avg triangles/mesh | Total triangles | Potential saved draws |',
        '| --- | ---: | ---: | ---: | ---: |',
        ...(
          roleBatchingPotentialRows.length > 0
            ? roleBatchingPotentialRows.map((candidate) => (
              `| ${candidate.role} | ${candidate.effectiveMeshes} | ${formatNumber(candidate.averageTrianglesPerMesh)} | ${formatNumber(candidate.totalTriangles)} | ${candidate.potentialSavedDraws} |`
            ))
            : ['| None | 0 | 0.000 | 0.000 | 0 |']
        ),
        '',
        '## Instancing Opportunities',
        '',
        'This stricter table only counts already-identical geometry+material instances that could be converted directly to `InstancedMesh` with minimal asset surgery.',
        '',
        '| Role | Identical meshes | Triangles/mesh | Total triangles | Potential saved draws |',
        '| --- | ---: | ---: | ---: | ---: |',
        ...(
          instancingCandidateRows.length > 0
            ? instancingCandidateRows.map((candidate) => (
              `| ${candidate.role} | ${candidate.count} | ${formatNumber(candidate.trianglesPerMesh)} | ${formatNumber(candidate.totalTriangles)} | ${candidate.potentialSavedDraws} |`
            ))
            : ['| None | 0 | 0.000 | 0.000 | 0 |']
        ),
        '',
        '## Hierarchical Deltas',
        '',
        ...profile.deltas
          .filter((delta) => Math.abs(delta.ms) >= 0.1)
          .map((delta) => `- ${delta.label}: ${formatNumber(delta.ms)}ms/frame (${delta.from} -> ${delta.to})`),
        '',
        '## Loop Populations',
        ''
      ]

      if (latestStep) {
        for (const [key, value] of Object.entries(latestStep.renderLoops)) {
          lines.push(`- ${key}: ${value}`)
        }
      }

      lines.push('', '## Scene Object Counts', '')

      if (latestStep) {
        lines.push('```json')
        lines.push(JSON.stringify(latestStep.sceneStats, null, 2))
        lines.push('```')
      }

      return lines.join('\n')
    }
    const makePostDisabledPatch = (): VisualSettingsPatch => ({
      ambientOcclusionMode: 'off',
      anamorphic: { enabled: false },
      bloom: { enabled: false },
      depthOfField: { enabled: false },
      lensFlare: { enabled: false },
      ssr: { enabled: false, intensity: 0 },
      volumetricLighting: { enabled: false, intensity: 0 },
      vignette: { enabled: false }
    })
    const makeLightingDisabledPatch = (): VisualSettingsPatch => ({
      iblContribution: { enabled: false, intensity: 0 },
      lightmapContribution: { enabled: false, intensity: 0 },
      reflectionContribution: { enabled: false, intensity: 0 },
      staticVolumetricContribution: { enabled: false, intensity: 0 }
    })
    const measureStep = async (
      label: string,
      patch: VisualSettingsPatch,
      samples: number
    ): Promise<PerformanceProfileStep> => {
      globalWindow.__levelsjamSetVisualSettings?.(patch)
      await waitForFrames(4)

      return {
        benchmark: await runBenchmark(samples),
        label,
        renderLoops: collectRenderLoops(),
        sceneStats: collectSceneStats()
      }
    }
    const cloneVisualSettings = (settings: VisualSettings): VisualSettings => (
      JSON.parse(JSON.stringify(settings)) as VisualSettings
    )
    const buildDeltas = (steps: PerformanceProfileStep[]) => {
      const stepByLabel = new Map(steps.map((step) => [step.label, step]))
      const makeDelta = (label: string, from: string, to: string) => ({
        from,
        label,
        ms:
          (stepByLabel.get(from)?.benchmark.averageFrameMs ?? 0) -
          (stepByLabel.get(to)?.benchmark.averageFrameMs ?? 0),
        to
      })

      return [
        makeDelta('All optional postprocessing', 'Default', 'Post disabled'),
        makeDelta('Local reflections', 'Post disabled', 'Post + reflections disabled'),
        makeDelta('Baked/probe lighting', 'Post + reflections disabled', 'Post + all local lighting disabled'),
        makeDelta('PBR/textured opaque over unlit', 'Post + all local lighting disabled', 'Unlit baseline')
      ]
    }

    globalWindow.__levelsjamBenchmark = runBenchmark
    globalWindow.__levelsjamWarmPerformanceScene = async () => {
      document.body.dataset.sceneProgramsReady = 'false'
      recordStartupMarker('performanceSceneWarmStartedAt')
      await loadSharedFireFlipbookTexture(gl.capabilities.getMaxAnisotropy())
      document.body.dataset.fireFlipbookReady = 'true'
      await waitForRuntimeProbeResidency(scene, () => false)
      await waitForRendererResourceStability(gl, () => false, 2, 60)
      await warmSceneTextures(gl, scene, () => false)
      await warmScenePrograms(gl, scene, camera, () => false, true, true, true)
      recordStartupMarker('performanceSceneWarmCompleteAt')
      document.body.dataset.sceneProgramsReady = 'true'

      return true
    }

    globalWindow.__levelsjamCapturePerformanceProfile = async (options = {}) => {
      const loadingOverlay = document.querySelector('.loading-overlay') as HTMLElement | null
      const loadingComplete = loadingOverlay?.dataset.loadingComplete === 'true'

      if (!loadingComplete) {
        throw new Error(
          'Performance profile requested before the loading overlay completed; wait for data-loading-complete="true" so overlay-only frames are not measured.'
        )
      }

      const samples = Math.max(4, Math.floor(options.samples ?? 24))
      const liveDurationMs = Math.max(250, options.liveDurationMs ?? 1000)
      const originalVisualSettings = globalWindow.__levelsjamGetVisualSettings?.()
      const originalPatch = originalVisualSettings
        ? cloneVisualSettings(originalVisualSettings)
        : null
      const liveFrames = await captureLiveFrames(liveDurationMs)
      const gpuFrameSteps = await collectGpuFrameProfileSteps()
      const frameSteps = collectFrameProfileSteps(liveFrames.samples)
      const renderSteps = collectRenderProfileSteps(liveFrames.samples)
      const steps: PerformanceProfileStep[] = []

      try {
        if (!options.liveOnly) {
          steps.push(await measureStep('Default', {}, samples))
          steps.push(await measureStep('Post disabled', makePostDisabledPatch(), samples))
          steps.push(await measureStep(
            'Post + reflections disabled',
            {
              ...makePostDisabledPatch(),
              reflectionContribution: { enabled: false, intensity: 0 }
            },
            samples
          ))
          steps.push(await measureStep(
            'Post + all local lighting disabled',
            {
              ...makePostDisabledPatch(),
              ...makeLightingDisabledPatch()
            },
            samples
          ))
          steps.push(await measureStep(
            'Unlit baseline',
            {
              ...makePostDisabledPatch(),
              ...makeLightingDisabledPatch(),
              unlitMode: true
            },
            samples
          ))
        }
      } finally {
        if (originalPatch) {
          globalWindow.__levelsjamSetVisualSettings?.(originalPatch)
          await waitForFrames(2)
        }
      }

      const profileWithoutMarkdown = {
        capturedAt: new Date().toISOString(),
        controlledSteps: steps,
        deltas: buildDeltas(steps),
        frameSteps,
        gpuFrameSteps,
        gpuTimerSupported,
        liveFrames,
        renderSteps,
        renderer: getRendererString()
      }
      const markdown = formatProfileMarkdown(profileWithoutMarkdown)

      return {
        ...profileWithoutMarkdown,
        markdown
      }
    }

    return () => {
      if (profiledGl.__levelsjamOriginalRender) {
        gl.render = profiledGl.__levelsjamOriginalRender
        delete profiledGl.__levelsjamOriginalRender
      }
      delete globalWindow.__levelsjamBenchmark
      delete globalWindow.__levelsjamCapturePerformanceProfile
      delete globalWindow.__levelsjamWarmPerformanceScene
      activeFrameProfile.gpu = null
    }
  }, [advance, camera, get, gl, invalidate, scene, setFrameloop])

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
    const profileStartedAt = beginFrameProfileStep()

    try {
      if (noiseIntensity <= 0) {
        effect.exposure = exposure
        return
      }

      const period = Math.max(noisePeriod, 0.0001)
      const phase = (state.clock.getElapsedTime() / period) * Math.PI * 2
      const flicker = 1 + (Math.sin(phase) * noiseIntensity)

      effect.exposure = exposure * Math.max(0, flicker)
    } finally {
      endFrameProfileStep('exposure effect uniforms', profileStartedAt)
    }
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function SaturationEffectPrimitive({
  saturation
}: {
  saturation: number
}) {
  const effect = useMemo(() => new SaturationEffectImpl(saturation), [])

  useEffect(() => {
    effect.saturation = saturation
  }, [effect, saturation])

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function hashContinuousUnitNoiseSeed(seed: number) {
  const hashed = Math.sin((seed * 127.1) + 311.7) * 43758.5453123

  return hashed - Math.floor(hashed)
}

function sampleContinuousUnitNoise(value: number) {
  const left = Math.floor(value)
  const fraction = value - left
  const smoothFraction = fraction * fraction * (3 - (2 * fraction))

  return MathUtils.lerp(
    hashContinuousUnitNoiseSeed(left),
    hashContinuousUnitNoiseSeed(left + 1),
    smoothFraction
  )
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
    const profileStartedAt = beginFrameProfileStep()

    try {
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
        setFade(strikeColor, elapsed / MONSTER_KILL_FADE_TO_RED_MS)
        return
      }

      if (name === 'sword-strike-out') {
        setFade(strikeColor, 1 - (elapsed / MONSTER_KILL_FADE_OUT_MS))
        return
      }

      if (name === 'death') {
        setFade(deathColor, elapsed / PLAYER_DEATH_FADE_TO_BLACK_MS)
        return
      }

      if (name === 'death-out') {
        setFade(deathColor, 1 - (elapsed / PLAYER_DEATH_FADE_IN_MS))
        return
      }

      setFade(deathColor, 0)
    } finally {
      endFrameProfileStep('player fade uniforms', profileStartedAt)
    }
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

function RadialChromaticAberrationEffectPrimitive({
  settings
}: {
  settings: ChromaticAberrationSettings
}) {
  const effect = useMemo(() => new RadialChromaticAberrationEffectImpl(), [])

  useFrame(() => {
    const shakeAmount = Number(document.body.dataset.screenShakeAmount ?? '0')

    effect.exponent = settings.exponent
    effect.intensity =
      settings.intensity +
      (Math.max(0, shakeAmount) * settings.screenShakeIntensity)
    effect.maxOffset = Math.hypot(settings.offsetX, settings.offsetY)
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function AnimatedVignette({ settings }: { settings: VignetteSettings }) {
  const effect = useMemo(
    () => new VignetteEffect({ darkness: settings.intensity }),
    []
  )

  useFrame((state) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      const period = Math.max(settings.noisePeriod, 0.0001)
      const noise = (sampleContinuousUnitNoise(state.clock.getElapsedTime() / period) * 2) - 1
      const nextDarkness = settings.noiseIntensity > 0
        ? settings.intensity + (noise * settings.noiseIntensity)
        : settings.intensity

      effect.darkness = MathUtils.clamp(nextDarkness, 0, 1)
    } finally {
      endFrameProfileStep('vignette uniforms', profileStartedAt)
    }
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

function DitherEffectPrimitive() {
  const effect = useMemo(() => new DitherEffectImpl(), [])

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect as unknown as Effect} />
}

type MutableLensFlareEffect = Effect & {
  getFragmentShader: () => string
  setFragmentShader: (fragmentShader: string) => void
}

function isLensFlareOcclusionMaterial(material: Material | Material[] | null | undefined) {
  const materials = Array.isArray(material) ? material : [material]

  return materials.some((candidate) => (
    candidate instanceof Material &&
    !candidate.transparent &&
    candidate.opacity > 0.999
  ))
}

function isLensFlareOcclusionMesh(object: Mesh) {
  if (object.userData?.lensflare === 'ignore-occlusion') {
    return false
  }

  const debugRole = object.userData?.debugRole

  if (
    debugRole === 'torch-billboard' ||
    debugRole === 'monster-eye' ||
    debugRole === 'reflection-probe-visual'
  ) {
    return false
  }

  return isLensFlareOcclusionMaterial(object.material)
}

function addLensFlareStarBurstIntensityUniform(effect: PostLensFlareEffect) {
  const mutableEffect = effect as unknown as MutableLensFlareEffect
  const starBurstUniform = effect.uniforms.get('starBurstIntensity')

  if (starBurstUniform) {
    return starBurstUniform as Uniform<number>
  }

  const fragmentShader = mutableEffect.getFragmentShader()
  const uniform = new Uniform(1)

  effect.uniforms.set('starBurstIntensity', uniform)
  mutableEffect.setFragmentShader(
    fragmentShader
      .replace(
        'uniform bool starBurst;',
        'uniform bool starBurst;\nuniform float starBurstIntensity;'
      )
      .replace(
        'finalColor += clamp((lensMod.rgb * getStartBurst().rgb ), 0.01, 1.0);',
        [
          'vec3 starBurstSignal = clamp((lensMod.rgb * getStartBurst().rgb ), 0.01, 1.0);',
          'finalColor += starBurstIntensity <= 0.0 ? vec3(0.0) : starBurstSignal * starBurstIntensity;'
        ].join('\n        ')
      )
  )

  return uniform
}

function getGeometryTriangleCount(geometry: BufferGeometry | undefined) {
  if (!geometry) {
    return 0
  }

  if (geometry.index) {
    return geometry.index.count / 3
  }

  return (geometry.getAttribute('position')?.count ?? 0) / 3
}

function shouldUseLensFlareOcclusionBounds(object: Mesh) {
  const role = typeof object.userData?.debugRole === 'string'
    ? object.userData.debugRole
    : ''

  return (
    role === 'monster' ||
    role === 'monster-eye' ||
    getGeometryTriangleCount(object.geometry) > 256
  )
}

function getObjectMonsterId(object: Object3D) {
  let current: Object3D | null = object

  while (current) {
    const monsterId = current.userData?.monsterId

    if (typeof monsterId === 'string') {
      return monsterId
    }

    current = current.parent
  }

  return undefined
}

function TorchLensFlare({
  settings
}: {
  settings: LensFlareSettings
}) {
  const camera = useThree((state) => state.camera)
  const raycaster = useThree((state) => state.raycaster)
  const scene = useThree((state) => state.scene)
  const size = useThree((state) => state.size)
  const [visibleSlotCount, setVisibleSlotCount] = useState(0)
  const projectedPosition = useMemo(() => new Vector3(), [])
  const raycasterPosition = useMemo(() => new Vector2(), [])
  const scratchWorldPosition = useMemo(() => new Vector3(), [])
  const scratchOcclusionPoint = useMemo(() => new Vector3(), [])
  const occlusionMeshes = useRef<Mesh[]>([])
  const highPolyOccluders = useRef<Array<{ bounds: Box3, mesh: Mesh }>>([])
  const raycastIntersections = useRef<ReturnType<Raycaster['intersectObjects']>>([])
  const lensSources = useRef<Array<{ monsterId?: string; object: Mesh }>>([])
  const lensSourceRefreshElapsed = useRef(Number.POSITIVE_INFINITY)
  const flareSlots = useMemo(
    () =>
      Array.from({ length: MAX_SIMULTANEOUS_LENS_FLARES }, (_, index) => {
        const effect = new PostLensFlareEffect({
          aditionalStreaks: settings.aditionalStreaks,
          animated: settings.animated,
          anamorphic: settings.anamorphic,
          blendFunction: BlendFunction.NORMAL,
          colorGain: FIRE_COLOR.clone(),
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
        const starBurstIntensityUniform = addLensFlareStarBurstIntensityUniform(effect)
        const pass = new EffectPass(camera as ThreeCamera, effect)
        pass.name = 'TorchLensFlarePass'

        return {
          effect,
          index,
          lensPositionUniform: effect.uniforms.get('lensPosition') as Uniform<Vector3> | undefined,
          occlusionOpacityUniform: effect.uniforms.get('opacity') as Uniform<number> | undefined,
          pass,
          screenResUniform: effect.uniforms.get('screenRes') as Uniform<Vector2> | undefined,
          starBurstIntensityUniform
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

      slot.effect.blendMode.opacity.value = MathUtils.clamp(settings.opacity, 0, 1)
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
        colorGainUniform.value.copy(FIRE_COLOR)
      }
      if (slot.starBurstIntensityUniform) {
        slot.starBurstIntensityUniform.value = settings.starBurstIntensity
      }
    }
  }, [flareSlots, settings])

  useFrame((_, delta) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      lensSourceRefreshElapsed.current += delta
      if (lensSourceRefreshElapsed.current >= LENS_FLARE_SOURCE_REFRESH_SECONDS) {
        withFrameProfileScope('lens flare source selection/refresh visible source and occluder lists', () => {
          const nextOcclusionMeshes: Mesh[] = []
          const nextHighPolyOccluders: Array<{ bounds: Box3, mesh: Mesh }> = []
          const nextLensSources: Array<{ monsterId?: string; object: Mesh }> = []

          scene.traverse((object) => {
            if (!(object instanceof Mesh)) {
              return
            }
            if (!isObjectEffectivelyVisible(object)) {
              return
            }

            if (isLensFlareOcclusionMesh(object)) {
              if (shouldUseLensFlareOcclusionBounds(object)) {
                nextHighPolyOccluders.push({
                  bounds: new Box3().setFromObject(object),
                  mesh: object
                })
              } else {
                nextOcclusionMeshes.push(object)
              }
            }

            if (
              object.userData?.debugRole === 'torch-billboard' ||
              object.userData?.debugRole === 'monster-eye'
            ) {
              nextLensSources.push({
                monsterId: typeof object.userData?.monsterId === 'string'
                  ? object.userData.monsterId
                  : undefined,
                object
              })
            }
          })

          occlusionMeshes.current = nextOcclusionMeshes
          highPolyOccluders.current = nextHighPolyOccluders
          lensSources.current = nextLensSources
          lensSourceRefreshElapsed.current = 0
        })
      }

      const projectedLensCandidates = withFrameProfileScope(
        'lens flare source selection/project visible source candidates',
        () => {
          const candidates: Array<{
            distanceToLight: number
            intensity: number
            monsterId?: string
            position: Vector3
            score: number
            screenX: number
            screenY: number
            tint: Color
          }> = []

          for (const lensSource of lensSources.current) {
            if (!isObjectEffectivelyVisible(lensSource.object)) {
              continue
            }

            const lensPosition = scratchWorldPosition
            lensSource.object.getWorldPosition(lensPosition)
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
            const distanceToLight = camera.position.distanceTo(lensPosition)
            const distanceAttenuation = distanceToLight <= 1.5
              ? 1
              : (1.5 / Math.max(distanceToLight, 0.001)) ** 2

            candidates.push({
              distanceToLight,
              intensity: distanceAttenuation,
              monsterId: lensSource.monsterId,
              position: lensPosition.clone(),
              score: lensScore,
              screenX: projectedPosition.x,
              screenY: projectedPosition.y,
              tint: Array.isArray(lensSource.object.userData?.lensFlareTint)
                ? new Color(
                    lensSource.object.userData.lensFlareTint[0] ?? FIRE_COLOR.r,
                    lensSource.object.userData.lensFlareTint[1] ?? FIRE_COLOR.g,
                    lensSource.object.userData.lensFlareTint[2] ?? FIRE_COLOR.b
                  )
                : FIRE_COLOR.clone()
            })
          }

          return candidates.sort((left, right) => left.score - right.score)
        }
      )

      const visibleLensPositions = withFrameProfileScope(
        'lens flare source selection/test occlusion rays',
        () => {
          const visible: Array<{
            intensity: number
            position: Vector3
            score: number
            tint: Color
          }> = []

          for (const lensCandidate of projectedLensCandidates) {
            raycasterPosition.set(lensCandidate.screenX, lensCandidate.screenY)
            raycaster.setFromCamera(raycasterPosition, camera)
            raycaster.near = 0
            raycaster.far = Math.max(
              0.001,
              lensCandidate.distanceToLight - LENS_FLARE_OCCLUSION_MARGIN
            )

            let occluded = false
            const candidateHighPolyMeshes: Mesh[] = []

            raycastIntersections.current.length = 0
            raycaster.intersectObjects(
              occlusionMeshes.current,
              false,
              raycastIntersections.current
            )

            for (const intersection of raycastIntersections.current) {
              if (
                lensCandidate.monsterId &&
                getObjectMonsterId(intersection.object) === lensCandidate.monsterId
              ) {
                continue
              }

              occluded = true
              break
            }

            if (!occluded) {
              for (const occluder of highPolyOccluders.current) {
                if (
                  lensCandidate.monsterId &&
                  getObjectMonsterId(occluder.mesh) === lensCandidate.monsterId
                ) {
                  continue
                }

                const intersection = raycaster.ray.intersectBox(
                  occluder.bounds,
                  scratchOcclusionPoint
                )

                if (
                  intersection &&
                  camera.position.distanceTo(intersection) <= raycaster.far
                ) {
                  candidateHighPolyMeshes.push(occluder.mesh)
                }
              }

              if (candidateHighPolyMeshes.length > 0) {
                raycastIntersections.current.length = 0
                raycaster.intersectObjects(
                  candidateHighPolyMeshes,
                  false,
                  raycastIntersections.current
                )

                for (const intersection of raycastIntersections.current) {
                  if (
                    lensCandidate.monsterId &&
                    getObjectMonsterId(intersection.object) === lensCandidate.monsterId
                  ) {
                    continue
                  }

                  occluded = true
                  break
                }
              }
            }

            raycaster.far = Infinity

            if (occluded) {
              continue
            }

            visible.push({
              intensity: lensCandidate.intensity,
              position: lensCandidate.position,
              score: lensCandidate.score,
              tint: lensCandidate.tint
            })
            if (visible.length >= MAX_SIMULTANEOUS_LENS_FLARES) {
              break
            }
          }

          return visible
        }
      )

      for (let slotIndex = 0; slotIndex < flareSlots.length; slotIndex += 1) {
        const slot = flareSlots[slotIndex]
        const visibleLens = visibleLensPositions[slotIndex]
        const nextHasVisibleLens = Boolean(visibleLens) && settings.enabled
        const visibilityTarget = nextHasVisibleLens ? 0 : 1

        if (visibleLens && slot.lensPositionUniform) {
          projectedPosition.copy(visibleLens.position).project(camera)
          slot.lensPositionUniform.value.set(projectedPosition.x, projectedPosition.y, 0)
        }

        const colorGainUniform = slot.effect.uniforms.get('colorGain') as Uniform<Color> | undefined
        if (colorGainUniform) {
          colorGainUniform.value
            .copy(visibleLens?.tint ?? FIRE_COLOR)
            .multiplyScalar(settings.colorGain * (visibleLens?.intensity ?? 0))
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
        intensity: settings.opacity,
        highPolyOccluderCount: highPolyOccluders.current.length,
        occlusionMeshCount: occlusionMeshes.current.length,
        projectedCandidateCount: projectedLensCandidates.length,
        totalLensCount: lensSources.current.length,
        visibleLensCount: visibleLensPositions.length,
        visibleLenses: visibleLensPositions.map((lens) => ({
          intensity: lens.intensity,
          position: [lens.position.x, lens.position.y, lens.position.z],
          score: lens.score
        }))
      }

      setVisibleSlotCount((currentCount) =>
        currentCount === visibleLensPositions.length
          ? currentCount
          : visibleLensPositions.length
      )
    } finally {
      endFrameProfileStep('lens flare source selection', profileStartedAt)
    }
  })

  useEffect(() => {
    for (const slot of flareSlots) {
      if (!slot.screenResUniform) {
        continue
      }
      slot.screenResUniform.value.set(size.width, size.height)
    }
  }, [flareSlots, size.height, size.width])

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
  applyTurnActionForLevel,
  altarCutsceneTarget,
  audioSettings,
  cameraTiltDegrees,
  commitGlobalTurnState,
  inputEnabled,
  isLevelLightingReady,
  layout,
  levelTransform,
  movementSettings,
  onLevelTransition,
  onReplayActiveChange,
  replayRequestId,
  replayRequestMazeId,
  setDisplayedOpenGateIds,
  setTurnState,
  turnState,
  wallBounds
}: {
  applyTurnActionForLevel: (
    levelId: string,
    action: TurnAction
  ) => {
    outcome: {
      blocked: boolean
      escaped: boolean
      killed: boolean
      levelTransition: { targetLevelId: string } | null
      pickedUpSword: boolean
      pickedUpTrophy: boolean
      playerEffect: 'death' | 'escape' | 'sword-strike' | null
      previous: TurnState
      state: TurnState
    }
    state: GlobalTurnState
  } | null
  altarCutsceneTarget: Vector3 | null
  audioSettings: AudioSettings
  cameraTiltDegrees: number
  commitGlobalTurnState: (state: GlobalTurnState) => void
  inputEnabled: boolean
  isLevelLightingReady: (mazeId: string) => boolean
  layout: MazeLayout
  levelTransform: LevelWorldTransform
  movementSettings: MovementSettings
  onLevelTransition: (request: SeamlessLevelTransitionRequest) => void
  onReplayActiveChange: (active: boolean) => void
  replayRequestId: number
  replayRequestMazeId: string | null
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
  const lastHandledReplayRequestId = useRef(0)
  const turnStateRef = useRef(turnState)
  const audioSettingsRef = useRef(audioSettings)
  const inputEnabledRef = useRef(inputEnabled)
  const inputEnabledAt = useRef(inputEnabled ? performance.now() : Number.POSITIVE_INFINITY)
  const isLevelLightingReadyRef = useRef(isLevelLightingReady)
  const levelTransitionCommitTarget = useRef<string | null>(null)
  const lastSyncedLayoutId = useRef(layout.maze.id)
  const hasInitializedPose = useRef(false)
  const cameraShake = useRef({ amplitude: 0, endsAt: 0 })
  const altarLookAnimation = useRef<{
    key: string
    startYaw: number
    targetYaw: number
  } | null>(null)
  const playerAnimation = useRef<{
    action: TurnAction
    blocked: boolean
    from: TurnState
    killed: boolean
    committedGlobalState: GlobalTurnState | null
    levelTransition: {
      targetLevelId: string
    } | null
    fromWorldPosition: Vector3
    toWorldPosition: Vector3
    fromYaw: number
    toYaw: number
    blockedWorldBumpOffset: Vector3 | null
    playerEffect: 'death' | 'escape' | 'sword-strike' | null
    startedAt: number
    to: TurnState
  } | null>(null)
  const playerEffectClearTimeout = useRef<number | null>(null)
  const isPointerLocked = useRef(false)
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const cameraShakeOffset = useRef(new Vector3())
  const cameraRigPosition = useRef(new Vector3())
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
    audioSettingsRef.current = audioSettings
  }, [audioSettings])
  const resolvedFreeCameraSettings = useMemo(
    () => createMovementSettings(DEFAULT_MOVEMENT_SETTINGS),
    []
  )
  const gameplayCameraPitch = useMemo(
    () => MathUtils.degToRad(MathUtils.clamp(cameraTiltDegrees, -20, 20)),
    [cameraTiltDegrees]
  )
  const applyCameraRigPose = useCallback((
    position: Vector3,
    nextYaw: number,
    nextPitch: number,
    includeShake = true
  ) => {
    yaw.current = nextYaw
    pitch.current = nextPitch
    camera.position.copy(position)
    camera.quaternion.setFromEuler(cameraEuler.set(nextPitch, nextYaw, 0, 'YXZ'))
    const now = performance.now()
    if (includeShake && cameraShake.current.endsAt > now) {
      const remaining = Math.max(0, (cameraShake.current.endsAt - now) / 1000)
      const envelope = Math.min(1, remaining) * Math.min(1, remaining)
      const timeSeconds = now / 1000
      const lateral = Math.sin(timeSeconds * 31.3) * cameraShake.current.amplitude * envelope
      const vertical = Math.sin((timeSeconds * 24.7) + 1.3) * cameraShake.current.amplitude * 0.6 * envelope

      document.body.dataset.screenShakeAmount = (
        cameraShake.current.amplitude * envelope
      ).toFixed(5)
      cameraShakeOffset.current.set(lateral, vertical, 0)
      cameraShakeOffset.current.applyQuaternion(camera.quaternion)
      camera.position.add(cameraShakeOffset.current)
    } else {
      document.body.dataset.screenShakeAmount = '0'
    }
    camera.updateMatrixWorld()
  }, [camera])

  useLayoutEffect(() => {
    if (levelTransitionCommitTarget.current === layout.maze.id) {
      levelTransitionCommitTarget.current = null
      delete document.body.dataset.committingLevelTransitionId
    }

    if (replayActive.current || playerAnimation.current) {
      return
    }

    const currentState = turnStateRef.current
    const layoutChanged = lastSyncedLayoutId.current !== layout.maze.id
    const propIsOlderTurn = turnState.turn < currentState.turn
    const propPlayerDiffersAtSameTurn =
      turnState.turn === currentState.turn &&
      (
        turnState.player.cell.x !== currentState.player.cell.x ||
        turnState.player.cell.y !== currentState.player.cell.y ||
        turnState.player.direction !== currentState.player.direction ||
        turnState.player.hasSword !== currentState.player.hasSword ||
        turnState.player.hasTrophy !== currentState.player.hasTrophy
      )
    const altarCutsceneSyncActive = document.body.dataset.altarCutsceneActive === 'true'

    if (
      !layoutChanged &&
      (propIsOlderTurn || (propPlayerDiffersAtSameTurn && !altarCutsceneSyncActive))
    ) {
      return
    }

    lastSyncedLayoutId.current = layout.maze.id
    turnStateRef.current = turnState
    if (layoutChanged) {
      startTransition(() => {
        setDisplayedOpenGateIds(getOpenGateIds(layout.maze, turnState))
      })
    }
  }, [layout.maze, layout.maze.id, setDisplayedOpenGateIds, turnState])

  useEffect(() => {
    inputEnabledRef.current = inputEnabled
    inputEnabledAt.current = inputEnabled
      ? performance.now()
      : Number.POSITIVE_INFINITY
    inputQueue.current = []
    keys.current = {}
  }, [inputEnabled])

  useEffect(() => {
    isLevelLightingReadyRef.current = isLevelLightingReady
  }, [isLevelLightingReady])

  useEffect(() => {
    if (
      replayRequestId <= 0 ||
      replayRequestMazeId !== layout.maze.id ||
      replayRequestId === lastHandledReplayRequestId.current
    ) {
      return
    }
    lastHandledReplayRequestId.current = replayRequestId

    const replayActions = Array.isArray(layout.maze.solution?.actions)
      ? [...layout.maze.solution.actions]
      : []
    const nextState = createInitialTurnState(layout.maze)

    replayQueue.current = replayActions
    inputQueue.current = []
    keys.current = {}
    velocity.current.set(0, 0, 0)
    playerAnimation.current = null
    replayActive.current = replayActions.length > 0
    freeCamera.current = false
    turnStateRef.current = nextState
    const spawnPosition = getTransformedMazeCellWorldPosition(
      layout.maze,
      levelTransform,
      nextState.player.cell,
      GROUND_Y
    )

    playerPosition.current.copy(spawnPosition)
    cameraRigPosition.current.set(
      spawnPosition.x,
      GROUND_Y + PLAYER_EYE_HEIGHT,
      spawnPosition.z
    )
    applyCameraRigPose(
      cameraRigPosition.current,
      directionToYaw(nextState.player.direction) + levelTransform.rotationY,
      gameplayCameraPitch,
      false
    )
    startTransition(() => {
      setDisplayedOpenGateIds([])
    })
    setTurnState(nextState)
    onReplayActiveChange(replayActive.current)
  }, [applyCameraRigPose, gameplayCameraPitch, layout.maze, levelTransform, onReplayActiveChange, replayRequestId, replayRequestMazeId, setDisplayedOpenGateIds, setTurnState])

  useEffect(() => {
    if (hasInitializedPose.current) {
      return
    }

    hasInitializedPose.current = true
    const spawnPosition = getTransformedMazeCellWorldPosition(
      layout.maze,
      levelTransform,
      turnState.player.cell,
      GROUND_Y
    )
    const cameraPosition = new Vector3(
      spawnPosition.x,
      GROUND_Y + PLAYER_EYE_HEIGHT,
      spawnPosition.z
    )

    camera.rotation.order = 'YXZ'
    applyCameraRigPose(
      cameraPosition,
      directionToYaw(turnState.player.direction) + levelTransform.rotationY,
      gameplayCameraPitch,
      false
    )
    playerPosition.current.copy(spawnPosition)
  }, [applyCameraRigPose, camera, gameplayCameraPitch, layout.maze, levelTransform, turnState.player.cell, turnState.player.direction])

  useEffect(() => {
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
    }

    const onPointerDown = (event: PointerEvent) => {
      if (document.body.dataset.levelMenuOpen === 'true') {
        return
      }

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
  }, [canvas])

  useEffect(() => {
    const queueTurnAction = (
      queuedAction: TurnAction,
      eventTimeStamp = performance.now()
    ) => {
      if (
        !inputEnabledRef.current ||
        eventTimeStamp < inputEnabledAt.current ||
        freeCamera.current ||
        replayActive.current ||
        document.body.dataset.playerEffect === 'death' ||
        document.body.dataset.playerEffect === 'death-out' ||
        document.body.dataset.playerEffect === 'sword-strike' ||
        document.body.dataset.playerEffect === 'sword-strike-out' ||
        inputQueue.current.length >= MAX_BUFFERED_TURN_COMMANDS
      ) {
        return false
      }

      inputQueue.current.push(queuedAction)
      document.body.dataset.playerMovedRecently = 'true'
      return true
    }

    const onTouchTurnAction = (event: Event) => {
      const action = (event as CustomEvent<TurnAction>).detail

      if (
        action === 'move-forward' ||
        action === 'move-backward' ||
        action === 'rotate-left' ||
        action === 'rotate-right'
      ) {
        queueTurnAction(action, event.timeStamp)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (document.body.dataset.levelMenuOpen === 'true') {
        keys.current[event.code] = false
        return
      }

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
          if (
            !inputEnabledRef.current ||
            event.timeStamp < inputEnabledAt.current
          ) {
            keys.current[event.code] = false
            return
          }
          if (!keys.current[event.code]) {
            queueTurnAction(queuedAction, event.timeStamp)
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
    window.addEventListener('levelsjam:turn-action', onTouchTurnAction)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('levelsjam:turn-action', onTouchTurnAction)
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
            estimatedFragmentSamplerCount: number
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
          animationActive: boolean
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
          trophyState: 'ground' | 'held' | 'consumed'
          turn: number
        }
        getReplayControllerState?: () => {
          cameraShakeAmplitude: number
          cameraShakeEndsAt: number
          freeCamera: boolean
          animationSpeedMultiplier: number
          playerAnimationAction: TurnAction | null
          replayActive: boolean
          replayQueueLength: number
        }
        setDebugMonsterCell?: (
          index: number,
          cell: { x: number; y: number },
          direction?: CardinalDirection
        ) => boolean
        getCameraState?: () => {
          pitch: number
          position: [number, number, number]
          yaw: number
        }
        setAnimationSpeedMultiplier?: (value: number) => number
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
    const isEffectivelyVisible = (object: Object3D) => {
      let current: Object3D | null = object

      while (current) {
        if (!current.visible) {
          return false
        }

        current = current.parent
      }

      return true
    }

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
            estimatedFragmentSamplerCount: number
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
                  estimatedFragmentSamplerCount: number
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
              hasLightMap: materials.some((candidate) =>
                Boolean(candidate.lightMap) &&
                (candidate.lightMapIntensity ?? 1) > EFFECT_EPSILON
              ),
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
        let animationActive = false
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

            visible = visible || isEffectivelyVisible(object)
            animationActive = animationActive || object.userData?.animationActive === true
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
          animationActive,
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
      getReplayControllerState: () => ({
        animationSpeedMultiplier: globalAnimationSpeedMultiplier,
        cameraShakeAmplitude: cameraShake.current.amplitude,
        cameraShakeEndsAt: cameraShake.current.endsAt,
        freeCamera: freeCamera.current,
        inputEnabled: inputEnabledRef.current,
        inputEnabledAt: inputEnabledAt.current,
        inputQueueLength: inputQueue.current.length,
        levelTransitionCommitTarget: levelTransitionCommitTarget.current,
        playerAnimationAction: playerAnimation.current?.action ?? null,
        replayActive: replayActive.current,
        replayQueueLength: replayQueue.current.length
      }),
      setDebugMonsterCell: (index, cell, direction) => {
        const monster = turnStateRef.current.monsters[index]

        if (!monster) {
          return false
        }

        const nextState: TurnState = {
          ...turnStateRef.current,
          checkpoint: {
            cell: { ...turnStateRef.current.checkpoint.cell },
            direction: turnStateRef.current.checkpoint.direction
          },
          monsters: turnStateRef.current.monsters.map((currentMonster, currentIndex) => ({
            ...currentMonster,
            cell: currentIndex === index
              ? { x: cell.x, y: cell.y }
              : { ...currentMonster.cell },
            direction:
              currentIndex === index && direction
                ? direction
                : currentMonster.direction,
            lastPath: [...(currentMonster.lastPath ?? [])]
          })),
          player: {
            ...turnStateRef.current.player,
            cell: { ...turnStateRef.current.player.cell }
          }
        }

        turnStateRef.current = nextState
        setTurnState(nextState)
        return true
      },
      getCameraState: () => ({
        pitch: pitch.current,
        position: [
          camera.position.x,
          camera.position.y,
          camera.position.z
        ],
        yaw: yaw.current
      }),
      setAnimationSpeedMultiplier: (value) => {
        globalAnimationSpeedMultiplier = MathUtils.clamp(
          Number.isFinite(value) ? value : 1,
          0.01,
          100
        )
        return globalAnimationSpeedMultiplier
      },
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
        const dx = target[0] - cameraPosition[0]
        const dy = target[1] - cameraPosition[1]
        const dz = target[2] - cameraPosition[2]
        const horizontalDistance = Math.hypot(dx, dz)

        cameraRigPosition.current.set(cameraPosition[0], cameraPosition[1], cameraPosition[2])
        applyCameraRigPose(
          cameraRigPosition.current,
          Math.atan2(-dx, -dz),
          Math.atan2(dy, Math.max(horizontalDistance, 0.0001)),
          false
        )
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
      delete globalWindow.__levelsjamDebug.getReplayControllerState
      delete globalWindow.__levelsjamDebug.setDebugMonsterCell
      delete globalWindow.__levelsjamDebug.getCameraState
      delete globalWindow.__levelsjamDebug.setAnimationSpeedMultiplier
      delete globalWindow.__levelsjamDebug.getDebugProgramUniformState
      delete globalWindow.__levelsjamDebug.getReflectionProbeState
      delete globalWindow.__levelsjamDebug.setView
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [applyCameraRigPose, camera, gl, scene])

  useFrame((_, delta) => {
    const profileStartedAt = beginFrameProfileStep()

    try {
      scene.userData.freeCameraActive = freeCamera.current
      document.body.dataset.freeCameraActive = freeCamera.current ? 'true' : 'false'
      const walkingAnimation = playerAnimation.current
      const walkingLoopActive =
        !freeCamera.current &&
        Boolean(
          walkingAnimation &&
          !walkingAnimation.blocked &&
          (
            walkingAnimation.action === 'move-forward' ||
            walkingAnimation.action === 'move-backward'
          )
        )

      setSfxLoop('wetFootsteps', audioSettingsRef.current, walkingLoopActive, {
        volume: 0.8
      })

      if (!freeCamera.current) {
      if (altarCutsceneTarget) {
        const currentState = turnStateRef.current
        const playerWorldPosition = getTransformedMazeCellWorldPosition(
          layout.maze,
          levelTransform,
          currentState.player.cell,
          GROUND_Y + PLAYER_EYE_HEIGHT
        )
        const dx = altarCutsceneTarget.x - playerWorldPosition.x
        const dz = altarCutsceneTarget.z - playerWorldPosition.z
        const targetYaw = Math.atan2(-dx, -dz)
        const animationKey = `${layout.maze.id}:${altarCutsceneTarget.x.toFixed(3)}:${altarCutsceneTarget.z.toFixed(3)}`

        if (altarLookAnimation.current?.key !== animationKey) {
          altarLookAnimation.current = {
            key: animationKey,
            startYaw: yaw.current,
            targetYaw
          }
        }

        const elapsed = Math.max(
          0,
          performance.now() - (document.body.dataset.altarCutsceneStartedAt
            ? Number(document.body.dataset.altarCutsceneStartedAt)
            : performance.now())
        )
        const turnAlpha = MathUtils.smoothstep(
          MathUtils.clamp((elapsed - 1000) / 1000, 0, 1),
          0,
          1
        )
        const startYaw = altarLookAnimation.current.startYaw
        const yawDelta = normalizeAngleRadians(altarLookAnimation.current.targetYaw - startYaw)

        applyCameraRigPose(
          playerWorldPosition,
          startYaw + (yawDelta * turnAlpha),
          gameplayCameraPitch
        )
        return
      }
      altarLookAnimation.current = null
      if (!playerAnimation.current) {
        const transitionCommitBlocked = levelTransitionCommitTarget.current !== null
        const playerEffectActive = (
          document.body.dataset.playerEffect === 'death' ||
          document.body.dataset.playerEffect === 'death-out' ||
          document.body.dataset.playerEffect === 'sword-strike' ||
          document.body.dataset.playerEffect === 'sword-strike-out'
        )
        const gameplayInputEnabled = inputEnabledRef.current &&
          !transitionCommitBlocked &&
          !playerEffectActive
        const replayAction = gameplayInputEnabled
          ? replayQueue.current.shift()
          : undefined
        const action = gameplayInputEnabled
          ? replayAction ?? inputQueue.current.shift()
          : undefined

        if (action) {
          if (!replayAction) {
            globalAnimationSpeedMultiplier = MathUtils.clamp(
              1 + (inputQueue.current.length * 0.5),
              1,
              100
            )
          }

          if (action === 'move-forward' || action === 'move-backward') {
            startTransition(() => {
              setDisplayedOpenGateIds(getOpenGateIds(layout.maze, turnStateRef.current))
            })
          }

          const globalResult = applyTurnActionForLevel(layout.maze.id, action)
          const result = globalResult?.outcome ?? {
            blocked: true,
            escaped: false,
            killed: false,
            levelTransition: null,
            pickedUpSword: false,
            pickedUpTrophy: false,
            playerEffect: null,
            previous: turnStateRef.current,
            state: turnStateRef.current
          }
          let strongestShakeAmplitude = 0
          let strongestMovedMonster: TurnMonster | null = null
          let strongestMovedMonsterVolume = 0

          for (let monsterIndex = 0; monsterIndex < result.state.monsters.length; monsterIndex += 1) {
            const nextMonster = result.state.monsters[monsterIndex]
            const previousMonster = result.previous.monsters.find(
              (monster) => monster.id === nextMonster.id
            ) ?? result.previous.monsters[monsterIndex]

            if (
              !previousMonster ||
              previousMonster.type !== nextMonster.type ||
              (
                previousMonster.cell.x === nextMonster.cell.x &&
                previousMonster.cell.y === nextMonster.cell.y
              )
            ) {
              continue
            }

            const distanceCells = getScreenShakePathDistance(
              layout.maze,
              nextMonster.cell,
              result.state.player.cell
            )
            const baseAmplitude = MathUtils.clamp(
              0.24 / Math.max(distanceCells + 0.5, 1),
              0.012,
              0.06
            )
            const monsterMultiplier =
              getMonsterShakeMultiplier(nextMonster.type)
            const shakeAmplitude = baseAmplitude * monsterMultiplier

            strongestShakeAmplitude = Math.max(
              strongestShakeAmplitude,
              shakeAmplitude
            )
            if (shakeAmplitude > strongestMovedMonsterVolume) {
              strongestMovedMonster = nextMonster
              strongestMovedMonsterVolume = shakeAmplitude
            }
          }

          if (strongestShakeAmplitude > 0) {
            cameraShake.current = {
              amplitude: strongestShakeAmplitude,
              endsAt: performance.now() + 1000
            }
          }
          if (strongestMovedMonster && strongestMovedMonsterVolume > 0) {
            const monsterWorldPosition = getTransformedMazeCellWorldPosition(
              layout.maze,
              levelTransform,
              strongestMovedMonster.cell,
              GROUND_Y + PLAYER_EYE_HEIGHT * 0.5
            )

            playSfx('monsterStomp', audioSettingsRef.current, {
              pan: getCameraRelativePan(camera, monsterWorldPosition),
              volume: MathUtils.clamp(strongestMovedMonsterVolume / 0.12, 0, 1)
            })
          }

          const previousOpenGateIds = new Set(getOpenGateIds(layout.maze, result.previous))
          const nextOpenGateIds = new Set(getOpenGateIds(layout.maze, result.state))
          for (const gate of layout.gates ?? []) {
            const wasOpen = previousOpenGateIds.has(gate.id)
            const isOpen = nextOpenGateIds.has(gate.id)

            if (wasOpen === isOpen) {
              continue
            }

            const gatePosition = transformLevelLocalPositionToWorld(
              {
                x: gate.center.x,
                y: PLAYER_EYE_HEIGHT * 0.5,
                z: gate.center.z
              },
              levelTransform
            )

            playSfx(isOpen ? 'gateOpen' : 'gateClose', audioSettingsRef.current, {
              pan: getCameraRelativePan(camera, gatePosition),
              volume: 0.7
            })
          }

          if (result.killed) {
            const killer = result.previous.monsters.find((monster) => (
              monster.cell.x === result.state.player.cell.x &&
              monster.cell.y === result.state.player.cell.y
            )) ?? result.state.monsters.find((monster) => (
              monster.cell.x === result.previous.player.cell.x &&
              monster.cell.y === result.previous.player.cell.y
            ))
            const killerPosition = killer
              ? getTransformedMazeCellWorldPosition(
                  layout.maze,
                  levelTransform,
                  killer.cell,
                  GROUND_Y + PLAYER_EYE_HEIGHT * 0.5
                )
              : camera.position

            playSfx(
              killer?.type === 'spider' ? 'spiderKillPlayer' : 'beastKillPlayer',
              audioSettingsRef.current,
              {
                pan: getCameraRelativePan(camera, killerPosition),
                volume: 1
              }
            )
          }

          const removedMonster = result.previous.monsters.find((previousMonster) => (
            !result.state.monsters.some((nextMonster) => nextMonster.id === previousMonster.id)
          ))

          if (removedMonster) {
            const removedPosition = getTransformedMazeCellWorldPosition(
              layout.maze,
              levelTransform,
              removedMonster.cell,
              GROUND_Y + PLAYER_EYE_HEIGHT * 0.5
            )

            playSfx(
              removedMonster.type === 'spider' ? 'spiderDie' : 'beastDie',
              audioSettingsRef.current,
              {
                pan: getCameraRelativePan(camera, removedPosition),
                volume: 1
              }
            )
          }

          const fromWorldPosition = getTransformedMazeCellWorldPosition(
            layout.maze,
            levelTransform,
            result.previous.player.cell,
            GROUND_Y + PLAYER_EYE_HEIGHT
          )
          const toWorldPosition = getTransformedMazeCellWorldPosition(
            layout.maze,
            levelTransform,
            result.state.player.cell,
            GROUND_Y + PLAYER_EYE_HEIGHT
          )
          const fromYaw =
            directionToYaw(result.previous.player.direction) + levelTransform.rotationY
          const toYaw =
            directionToYaw(result.state.player.direction) + levelTransform.rotationY
          let blockedWorldBumpOffset: Vector3 | null = null

          if (result.blocked && (action === 'move-forward' || action === 'move-backward')) {
            const moveDirection =
              action === 'move-backward'
                ? (
                    result.previous.player.direction === 'north'
                      ? 'south'
                      : result.previous.player.direction === 'south'
                        ? 'north'
                        : result.previous.player.direction === 'east'
                          ? 'west'
                          : 'east'
                  )
                : result.previous.player.direction
            const bumpOffset = directionToWorldOffset(moveDirection)
            const bumpCos = Math.cos(levelTransform.rotationY)
            const bumpSin = Math.sin(levelTransform.rotationY)

            blockedWorldBumpOffset = new Vector3(
              (bumpOffset.x * bumpCos) + (bumpOffset.z * bumpSin),
              0,
              -(bumpOffset.x * bumpSin) + (bumpOffset.z * bumpCos)
            )
          }

          playerAnimation.current = {
            action,
            blocked: Boolean(result.blocked),
            blockedWorldBumpOffset,
            committedGlobalState: globalResult?.state ?? null,
            from: result.previous,
            fromWorldPosition,
            fromYaw,
            killed: result.killed,
            levelTransition: result.levelTransition,
            playerEffect: result.playerEffect,
            startedAt: performance.now(),
            to: result.state,
            toWorldPosition,
            toYaw
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
          (performance.now() - activeAnimation.startedAt) /
            getScaledAnimationDuration(TURN_ANIMATION_DURATION_MS)
        )
        displayState = activeAnimation.to

        if (animationAlpha >= 1) {
          let waitingForLevelLighting = false

          if (activeAnimation.levelTransition) {
            const targetLevelId = activeAnimation.levelTransition.targetLevelId

            if (!isLevelLightingReadyRef.current(targetLevelId)) {
              waitingForLevelLighting = true
              document.body.dataset.pendingLevelTransitionId = targetLevelId
              document.body.dataset.pendingLevelTransitionSince ??= performance.now().toFixed(1)
            } else {
              delete document.body.dataset.pendingLevelTransitionId
              delete document.body.dataset.pendingLevelTransitionSince
              playerAnimation.current = null
              turnStateRef.current = activeAnimation.to
              applyCameraRigPose(
                activeAnimation.toWorldPosition,
                activeAnimation.toYaw,
                gameplayCameraPitch
              )
              levelTransitionCommitTarget.current = targetLevelId
              document.body.dataset.committingLevelTransitionId = targetLevelId
              replayQueue.current = []
              if (replayActive.current) {
                replayActive.current = false
                onReplayActiveChange(false)
              }
              onLevelTransition({
                committedGlobalState: activeAnimation.committedGlobalState ?? undefined,
                sourceLevelId: layout.maze.id,
                sourcePreviousState: activeAnimation.from,
                sourceState: activeAnimation.to,
                targetLevelId
              })
              return
            }
          }

          if (!waitingForLevelLighting) {
            const finalState = activeAnimation.killed
              ? resetTurnStateToCheckpoint(layout.maze, activeAnimation.to)
              : activeAnimation.to

            if (activeAnimation.killed) {
              cameraShake.current = {
                amplitude: 0,
                endsAt: 0
              }
              inputQueue.current = []
            }

            turnStateRef.current = finalState
            if (activeAnimation.committedGlobalState && !activeAnimation.killed) {
              commitGlobalTurnState(activeAnimation.committedGlobalState)
            } else {
              setTurnState(finalState)
            }
            playerAnimation.current = null
            if (
              activeAnimation.action === 'move-forward' ||
              activeAnimation.action === 'move-backward'
            ) {
              startTransition(() => {
                setDisplayedOpenGateIds(getOpenGateIds(layout.maze, finalState))
              })
            }

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
                }, MONSTER_KILL_FADE_OUT_MS)
              } else {
                document.body.dataset.playerEffect = 'death-out'
                playerEffectClearTimeout.current = window.setTimeout(() => {
                  if (document.body.dataset.playerEffect === 'death-out') {
                    delete document.body.dataset.playerEffect
                  }
                  playerEffectClearTimeout.current = null
                }, PLAYER_DEATH_FADE_IN_MS)
              }
            }

            if (replayActive.current && replayQueue.current.length === 0) {
              replayActive.current = false
              onReplayActiveChange(false)
            }
          }
        }
      }

      const fromPosition = activeAnimation?.fromWorldPosition ??
        getTransformedMazeCellWorldPosition(
          layout.maze,
          levelTransform,
          displayState.player.cell,
          GROUND_Y + PLAYER_EYE_HEIGHT
        )
      const toPosition = activeAnimation?.toWorldPosition ??
        getTransformedMazeCellWorldPosition(
          layout.maze,
          levelTransform,
          displayState.player.cell,
          GROUND_Y + PLAYER_EYE_HEIGHT
        )
      const fromYaw = activeAnimation?.fromYaw ??
        directionToYaw(displayState.player.direction) + levelTransform.rotationY
      const toYaw = activeAnimation?.toYaw ??
        directionToYaw(displayState.player.direction) + levelTransform.rotationY
      const yawDelta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw))
      if (activeAnimation?.blocked) {
        const bumpAlpha = Math.sin(animationAlpha * Math.PI) * BLOCKED_MOVE_FRACTION
        const bumpOffset = activeAnimation.blockedWorldBumpOffset ?? defaultMoveDirection

        cameraRigPosition.current.set(
          fromPosition.x + (bumpOffset.x * bumpAlpha),
          fromPosition.y,
          fromPosition.z + (bumpOffset.z * bumpAlpha)
        )
      } else {
        cameraRigPosition.current.lerpVectors(fromPosition, toPosition, animationAlpha)
      }
      applyCameraRigPose(
        cameraRigPosition.current,
        fromYaw + (yawDelta * animationAlpha),
        gameplayCameraPitch
      )
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
    cameraRigPosition.current.copy(camera.position)
      .addScaledVector(right.current, keyboardLocal.current.x * resolvedFreeCameraSettings.maxHorizontalSpeed * delta)
      .addScaledVector(up, keyboardLocal.current.y * resolvedFreeCameraSettings.maxHorizontalSpeed * delta)
      .addScaledVector(forward.current, keyboardLocal.current.z * resolvedFreeCameraSettings.maxHorizontalSpeed * delta)
    applyCameraRigPose(cameraRigPosition.current, yaw.current, pitch.current, false)
    } finally {
      endFrameProfileStep('player rules and camera', profileStartedAt)
    }
  }, -1)

  useEffect(() => {
    return () => {
      setSfxLoop('wetFootsteps', audioSettingsRef.current, false)
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
      delete document.body.dataset.pendingLevelTransitionId
      delete document.body.dataset.pendingLevelTransitionSince
      delete document.body.dataset.committingLevelTransitionId
      onReplayActiveChange(false)
      startTransition(() => {
        setDisplayedOpenGateIds([])
      })
    }
  }, [onReplayActiveChange, setDisplayedOpenGateIds])

  return null
}

function RuntimeLevelGeometry({
  activatedAltarIds,
  activePlayerWorldPosition,
  activePlayerTurn,
  completedMazeLevelIds,
  environmentIntensity,
  iblContributionIntensity,
  isActive,
  layout,
  lightmapContributionIntensity,
  minotaurAlbedoHex,
  monsterEyeColors,
  monsterEyes,
  mountAllGeometry = false,
  offeringAltarId,
  offeringStartedAt,
  onLightingResourcesChange,
  openGateIdsOverride = null,
  probeDebugMode,
  priorityPosition,
  reflectionContributionIntensity,
  runtimeModelsEnabled,
  staticVolumetricContributionIntensity,
  transform,
  turnState,
  visibilityState
}: {
  activatedAltarIds: Set<string>
  activePlayerWorldPosition: Vector3
  activePlayerTurn: number
  completedMazeLevelIds: Set<string>
  environmentIntensity: number
  iblContributionIntensity: number
  isActive: boolean
  layout: MazeLayout
  lightmapContributionIntensity: number
  minotaurAlbedoHex: string
  monsterEyeColors: MonsterEyeColorSettings
  monsterEyes: MonsterEyeSettings
  mountAllGeometry?: boolean
  offeringAltarId: string | null
  offeringStartedAt: number | null
  onLightingResourcesChange: (
    mazeId: string,
    resources: RuntimeLevelLightingResources | null,
    previousResources?: RuntimeLevelLightingResources | null
  ) => void
  openGateIdsOverride?: Set<string> | null
  probeDebugMode: ProbeDebugMode
  priorityPosition: { x: number; z: number }
  reflectionContributionIntensity: number
  runtimeModelsEnabled: boolean
  staticVolumetricContributionIntensity: number
  transform: LevelWorldTransform
  turnState: TurnState
  visibilityState: PrecomputedVisibilityState
}) {
  const scene = useThree((state) => state.scene)
  const lightingResources = useRuntimeLevelLightingResources(
    layout,
    priorityPosition,
    environmentIntensity
  )
  const lightingResourcesReady =
    lightingResources.surfaceLightmap.ready &&
    lightingResources.reflectionProbeState.ready
  const lastReadyLightingResources = useRef<RuntimeLevelLightingResources | null>(null)

  if (lightingResourcesReady) {
    lastReadyLightingResources.current = lightingResources
  }

  const stableLightingResources = lastReadyLightingResources.current ?? lightingResources
  const stableLightingResourcesReady =
    stableLightingResources.surfaceLightmap.ready &&
    stableLightingResources.reflectionProbeState.ready
  const computedOpenGateIds = useMemo(
    () => new Set(getOpenGateIds(layout.maze, turnState)),
    [layout.maze, turnState]
  )
  const openGateIds = openGateIdsOverride ?? computedOpenGateIds

  useEffect(() => {
    const userData = scene.userData as typeof scene.userData & {
      levelLightingStatesByLevel?: Record<string, {
        ready: boolean
        reflectionProbeState: RuntimeReflectionProbeState
        resources: RuntimeLevelLightingResources
        surfaceLightmapReady: boolean
      }>
    }

    userData.levelLightingStatesByLevel ??= {}
    userData.levelLightingStatesByLevel[layout.maze.id] = {
      ready:
        stableLightingResources.surfaceLightmap.ready &&
        stableLightingResources.reflectionProbeState.ready,
      reflectionProbeState: stableLightingResources.reflectionProbeState,
      resources: stableLightingResources,
      surfaceLightmapReady: stableLightingResources.surfaceLightmap.ready
    }

    onLightingResourcesChange(layout.maze.id, stableLightingResources)
  }, [
    layout.maze.id,
    onLightingResourcesChange,
    scene,
    stableLightingResources,
    stableLightingResources.reflectionProbeState,
    stableLightingResources.surfaceLightmap.ready
  ])

  useEffect(() => {
    return () => {
      const userData = scene.userData as typeof scene.userData & {
        levelLightingStatesByLevel?: Record<string, unknown>
      }
      const existingState = userData.levelLightingStatesByLevel?.[layout.maze.id] as
        | { resources?: RuntimeLevelLightingResources }
        | undefined

      if (
        userData.levelLightingStatesByLevel &&
        existingState?.resources === stableLightingResources
      ) {
        delete userData.levelLightingStatesByLevel[layout.maze.id]
      }
      onLightingResourcesChange(layout.maze.id, null, stableLightingResources)
    }
  }, [layout.maze.id, onLightingResourcesChange, scene, stableLightingResources])

  return (
    <LevelRenderTransformContext.Provider value={transform}>
      <group
        position={[transform.x, 0, transform.z]}
        rotation={[0, transform.rotationY, 0]}
        userData={{
          reflectionCaptureExcluded: !isActive,
          streamedLevelId: layout.maze.id
        }}
        visible={stableLightingResourcesReady}
      >
          <SceneGeometry
            activatedAltarIds={activatedAltarIds}
            activePlayerWorldPosition={activePlayerWorldPosition}
            activePlayerTurn={activePlayerTurn}
            completedMazeLevelIds={completedMazeLevelIds}
            environmentTexture={stableLightingResources.environmentTexture}
          environmentIntensity={environmentIntensity}
          iblContributionIntensity={iblContributionIntensity}
          isActive={isActive}
          layout={layout}
          lightmapContributionIntensity={lightmapContributionIntensity}
          mountAllGeometry={mountAllGeometry}
          offeringAltarId={offeringAltarId}
          offeringStartedAt={offeringStartedAt}
          openGateIds={openGateIds}
          probeDebugMode={probeDebugMode}
          probeDepthAtlasTextures={stableLightingResources.probeDepthAtlasTextures}
          probeCoefficientTextures={stableLightingResources.probeCoefficientTextures}
          reflectionProbeCoefficients={stableLightingResources.reflectionProbeCoefficients}
          reflectionProbeDepthTextures={stableLightingResources.reflectionProbeDepthTextures}
          reflectionContributionIntensity={reflectionContributionIntensity}
          reflectionProbeTextures={stableLightingResources.reflectionProbeTextures}
          runtimeModelsEnabled={runtimeModelsEnabled}
          staticVolumetricContributionIntensity={staticVolumetricContributionIntensity}
          surfaceLightmap={stableLightingResources.surfaceLightmap}
          turnState={turnState}
          visibilityState={visibilityState}
        />
        {runtimeModelsEnabled && isActive ? (
          <MonsterActors
            environmentIntensity={environmentIntensity}
            environmentTexture={stableLightingResources.environmentTexture}
            iblContributionIntensity={iblContributionIntensity}
            layout={layout}
            lightmapContributionIntensity={lightmapContributionIntensity}
            minotaurAlbedoHex={minotaurAlbedoHex}
            monsterEyeColors={monsterEyeColors}
            monsterEyes={monsterEyes}
            probeDepthAtlasTextures={stableLightingResources.probeDepthAtlasTextures}
            probeCoefficientTextures={stableLightingResources.probeCoefficientTextures}
            reflectionContributionIntensity={reflectionContributionIntensity}
            reflectionProbeCoefficients={stableLightingResources.reflectionProbeCoefficients}
            reflectionProbeDepthTextures={stableLightingResources.reflectionProbeDepthTextures}
            reflectionProbeTextures={stableLightingResources.reflectionProbeTextures}
            turnState={turnState}
            visibilityState={visibilityState}
          />
        ) : null}
      </group>
    </LevelRenderTransformContext.Provider>
  )
}

function Scene({
  activatedAltarIds,
  applyTurnActionForLevel,
  altarCutscene,
  audioSettings,
  composerEnabled,
  commitGlobalTurnState,
  controlsOpen,
  cutsceneActive,
  layout,
  levelTransform,
  renderedLayouts,
  getRenderedTurnState,
  onAssetsReady,
  onLevelTransition,
  onReplayActiveChange,
  onTurnStateChange,
  turnState,
  replayRequestId,
  replayRequestMazeId,
  visualSettings
}: {
  activatedAltarIds: Set<string>
  applyTurnActionForLevel: (
    levelId: string,
    action: TurnAction
  ) => {
    outcome: {
      blocked: boolean
      escaped: boolean
      killed: boolean
      levelTransition: { targetLevelId: string } | null
      pickedUpSword: boolean
      pickedUpTrophy: boolean
      playerEffect: 'death' | 'escape' | 'sword-strike' | null
      previous: TurnState
      state: TurnState
    }
    state: GlobalTurnState
  } | null
  altarCutscene: {
    altarId: string
    levelId: string
    startedAt: number
  } | null
  audioSettings: AudioSettings
  composerEnabled: boolean
  commitGlobalTurnState: (state: GlobalTurnState) => void
  controlsOpen: boolean
  cutsceneActive: boolean
  layout: MazeLayout
  levelTransform: LevelWorldTransform
  renderedLayouts: MazeLayout[]
  getRenderedTurnState: (layout: MazeLayout) => TurnState
  onAssetsReady: () => void
  onLevelTransition: (request: SeamlessLevelTransitionRequest) => void
  onReplayActiveChange: (active: boolean) => void
  onTurnStateChange: (
    mazeId: string,
    value: TurnState | ((current: TurnState) => TurnState)
  ) => void
  turnState: TurnState
  replayRequestId: number
  replayRequestMazeId: string | null
  visualSettings: VisualSettings
}) {
  recordStartupMarker('sceneRenderStartedAt')
  const [displayedOpenGateIds, setDisplayedOpenGateIds] = useState<string[]>(
    () => getOpenGateIds(layout.maze, turnState)
  )
  const setDisplayedOpenGateIdsIfChanged = useCallback((nextGateIds: string[]) => {
    setDisplayedOpenGateIds((currentGateIds) => {
      if (
        currentGateIds.length === nextGateIds.length &&
        currentGateIds.every((gateId, index) => gateId === nextGateIds[index])
      ) {
        return currentGateIds
      }

      return nextGateIds
    })
  }, [])
  const [runtimeModelsEnabled, setRuntimeModelsEnabled] = useState(false)
  const [runtimeModelAssetsReady, setRuntimeModelAssetsReady] = useState(false)
  const [startupGeometryExpanded, setStartupGeometryExpanded] = useState(false)
  const [startupSceneReady, setStartupSceneReady] = useState(false)
  const runtimeModelsEnabledRef = useRef(false)
  const startupGeometryExpandedRef = useRef(false)
  const hasReportedBasicAssetsReady = useRef(false)
  const setRuntimeModelsEnabledState = useCallback((enabled: boolean) => {
    runtimeModelsEnabledRef.current = enabled
    setRuntimeModelsEnabled(enabled)
  }, [])
  const setStartupGeometryExpandedState = useCallback((expanded: boolean) => {
    startupGeometryExpandedRef.current = expanded
    setStartupGeometryExpanded(expanded)
  }, [])
  const setTurnState = useCallback(
    (value: TurnState | ((current: TurnState) => TurnState)) => {
      onTurnStateChange(layout.maze.id, value)
    },
    [layout.maze.id, onTurnStateChange]
  )
  useEffect(() => {
    recordStartupMarker('sceneMountedAt')
    document.body.dataset.sceneMountCount = String(
      Number(document.body.dataset.sceneMountCount ?? '0') + 1
    )
  }, [])

  useEffect(() => {
    let cancelled = false

    setRuntimeModelAssetsReady(false)
    void startupCriticalRuntimeModelPreloadPromise
      .then(() => {
        if (!cancelled) {
          recordStartupMarker('startupRuntimeModelsReadyAt')
          setRuntimeModelAssetsReady(true)
          void preloadBackgroundRuntimeModelsAfterIntro().catch((error) => {
            if (!cancelled) {
              console.error(error)
            }
          })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const [levelLightingResources, setLevelLightingResources] = useState<Map<string, RuntimeLevelLightingResources>>(() => new Map())
  const composerRef = useRef<PostEffectComposer | null>(null)
  const environmentIntensity =
    BAKED_ENVIRONMENT_INTENSITY * visualSettings.hdriBrightness
  const fallbackProbeCoefficientTextures = useProbeCoefficientTextures(
    layout,
    []
  ) as [Texture, Texture, Texture, Texture]
  const activeLightingResources = levelLightingResources.get(layout.maze.id) ?? null
  const environmentTexture = activeLightingResources?.environmentTexture ?? null
  const reflectionProbeCoefficients = activeLightingResources?.reflectionProbeCoefficients ?? []
  const reflectionProbeDepthTextures = activeLightingResources?.reflectionProbeDepthTextures ?? []
  const reflectionProbeRawTextures = activeLightingResources?.reflectionProbeRawTextures ?? []
  const reflectionProbeTextures = activeLightingResources?.reflectionProbeTextures ?? []
  const probeCoefficientTextures =
    activeLightingResources?.probeCoefficientTextures ?? fallbackProbeCoefficientTextures
  const probeDepthAtlasTextures =
    activeLightingResources?.probeDepthAtlasTextures ?? EMPTY_PROBE_DEPTH_ATLAS_TEXTURES
  const postReadyProgramBaselineRef = useRef<number | null>(null)
  const postReadyProgramIncreaseCountRef = useRef(0)
  const postReadyProgramHistoryRef = useRef<Array<{
    atMs: number
    from: number
    loadedMazeId: string | null
    programs: string[]
    to: number
  }>>([])
  const postReadyProgramNamesRef = useRef<Set<string>>(new Set())
  const activeOpenGateIds = useMemo(
    () => new Set(displayedOpenGateIds),
    [displayedOpenGateIds]
  )

  useFrame(() => {
    const currentProgramCount = gl.info.programs?.length ?? 0
    const sceneProgramsReady = document.body.dataset.sceneProgramsReady === 'true'

    if (!sceneProgramsReady) {
      postReadyProgramBaselineRef.current = null
      postReadyProgramIncreaseCountRef.current = 0
      postReadyProgramHistoryRef.current = []
      postReadyProgramNamesRef.current = new Set()
      document.body.dataset.shaderProgramsAtReady = String(currentProgramCount)
      document.body.dataset.shaderProgramsAfterReady = String(currentProgramCount)
      document.body.dataset.shaderProgramIncreaseHistory = '[]'
      document.body.dataset.shaderProgramIncreaseCount = '0'
      return
    }

    if (postReadyProgramBaselineRef.current === null) {
      postReadyProgramBaselineRef.current = currentProgramCount
      postReadyProgramNamesRef.current = new Set(
        ((gl.info.programs ?? []) as Array<{ cacheKey?: string; id?: number | string; name?: string }>).map(
          (program, index) => program.cacheKey ?? program.name ?? String(program.id ?? index)
        )
      )
      document.body.dataset.shaderProgramsAtReady = String(currentProgramCount)
      document.body.dataset.shaderProgramsAfterReady = String(currentProgramCount)
      document.body.dataset.shaderProgramIncreaseHistory = '[]'
      document.body.dataset.shaderProgramIncreaseCount = '0'
      return
    }

    if (currentProgramCount > postReadyProgramBaselineRef.current) {
      const programNames = (
        (gl.info.programs ?? []) as Array<{ cacheKey?: string; id?: number | string; name?: string }>
      ).map((program, index) => program.cacheKey ?? program.name ?? String(program.id ?? index))
      const newPrograms = programNames.filter(
        (programName) => !postReadyProgramNamesRef.current.has(programName)
      )
      postReadyProgramNamesRef.current = new Set(programNames)
      if (newPrograms.length > 0) {
        postReadyProgramHistoryRef.current.push({
          atMs: Math.round(performance.now()),
          from: postReadyProgramBaselineRef.current,
          loadedMazeId: document.body.dataset.loadedMazeId ?? null,
          programs: newPrograms.slice(0, 20),
          to: currentProgramCount
        })
        postReadyProgramIncreaseCountRef.current += newPrograms.length
      }
      postReadyProgramBaselineRef.current = currentProgramCount
      document.body.dataset.shaderProgramsAfterReady = String(currentProgramCount)
      document.body.dataset.shaderProgramIncreaseHistory =
        JSON.stringify(postReadyProgramHistoryRef.current.slice(-20))
      document.body.dataset.shaderProgramIncreaseCount =
        String(postReadyProgramIncreaseCountRef.current)
    }
  })

  const closedGateIds = useMemo(() => new Set<string>(), [])
  const stagedRenderedLayouts = useMemo(
    () => renderedLayouts,
    [renderedLayouts]
  )
  const runtimeRenderedLayouts = useMemo(
    () => [
      layout,
      ...stagedRenderedLayouts.filter((renderedLayout) => renderedLayout.maze.id !== layout.maze.id)
    ],
    [layout, stagedRenderedLayouts]
  )
  const handleLevelLightingResourcesChange = useCallback((
    mazeId: string,
    resources: RuntimeLevelLightingResources | null,
    previousResources: RuntimeLevelLightingResources | null = null
  ) => {
    setLevelLightingResources((current) => {
      const existing = current.get(mazeId)

      if (resources === null) {
        if (!current.has(mazeId)) {
          return current
        }
        if (previousResources !== null && existing !== previousResources) {
          return current
        }
        const next = new Map(current)

        next.delete(mazeId)
        return next
      }

      if (existing === resources) {
        return current
      }

      const next = new Map(current)

      next.set(mazeId, resources)
      return next
    })
  }, [])
  const isLevelLightingReadyForTransition = useCallback(
    (mazeId: string) => {
      const resources = levelLightingResources.get(mazeId)

      return Boolean(
        resources?.surfaceLightmap.ready &&
        resources.reflectionProbeState.ready
      )
    },
    [levelLightingResources]
  )
  const worldLightingRegistry = useMemo<WorldLightingRegistryEntry[]>(
    () => runtimeRenderedLayouts
      .map((renderedLayout) => {
        const resources = levelLightingResources.get(renderedLayout.maze.id)

        if (!resources) {
          return null
        }

        return {
          isActive: renderedLayout.maze.id === layout.maze.id,
          layout: renderedLayout,
          mazeId: renderedLayout.maze.id,
          resources,
          transform: getRuntimeLevelWorldTransform(renderedLayout.maze.id)
        } satisfies WorldLightingRegistryEntry
      })
      .filter((entry): entry is WorldLightingRegistryEntry => Boolean(entry)),
    [layout.maze.id, levelLightingResources, runtimeRenderedLayouts]
  )

  useEffect(() => {
    scene.userData.worldLightingRegistry = worldLightingRegistry
    scene.userData.reflectionProbeState = createWorldReflectionProbeState(worldLightingRegistry)

    return () => {
      if (scene.userData.worldLightingRegistry === worldLightingRegistry) {
        delete scene.userData.worldLightingRegistry
        delete scene.userData.reflectionProbeState
      }
    }
  }, [scene, worldLightingRegistry])

  useEffect(() => {
    let cancelled = false
    let rafId = 0
    let geometryContractHandle = 0

    const compileScene = async () => {
      document.body.dataset.sceneProgramsReady = 'false'

      recordStartupMarker('sceneResourceStabilityStartedAt')
      recordStartupMarker('sceneResourceStabilityCompleteAt')
      recordStartupMarker('sceneTextureWarmStartedAt')
      recordStartupMarker('sceneTextureWarmCompleteAt')
      recordStartupMarker('sceneProgramWarmStartedAt')
      recordStartupMarker('sceneProgramWarmCompleteAt')
      recordStartupMarker('scenePostWarmStartedAt')
      recordStartupMarker('scenePostWarmCompleteAt')

      if (cancelled) {
        return
      }

      if (!hasReportedBasicAssetsReady.current) {
        hasReportedBasicAssetsReady.current = true
        setStartupSceneReady(true)
        onAssetsReady()
      }
      document.body.dataset.sceneProgramsReady = 'true'
      geometryContractHandle = window.setTimeout(() => {
        if (!cancelled) {
          setStartupGeometryExpandedState(false)
          setRuntimeModelsEnabledState(true)
        }
      }, 0)
    }

    const waitForSceneObjects = () => {
      if (cancelled || hasReportedBasicAssetsReady.current) {
        return
      }

      const levelLightingStates = scene.userData.levelLightingStatesByLevel as
        | Record<string, { ready?: boolean; surfaceLightmapReady?: boolean }>
        | undefined
      const expectedLightingLayouts = runtimeRenderedLayouts.length > 0
        ? runtimeRenderedLayouts
        : [layout]
      const renderedLightingReady = expectedLightingLayouts.every(
        (renderedLayout) => {
          const lightingState = levelLightingStates?.[renderedLayout.maze.id]

          return Boolean(
            lightingState?.ready &&
            lightingState.surfaceLightmapReady
          )
        }
      )

      const captureSceneState = getReflectionCaptureSceneState(scene, layout, {
        requireTorchBillboards: true
      })

      if (
        !captureSceneState.ready ||
        !renderedLightingReady
      ) {
        document.body.dataset.startupWaitState = JSON.stringify({
          captureReady: captureSceneState.ready,
          readyTorchBillboardCount: captureSceneState.readyTorchBillboardCount,
          renderedLightingReady,
          torchBillboardCount: captureSceneState.torchBillboardCount,
          runtimeModelAssetsReady
        })
        rafId = window.requestAnimationFrame(waitForSceneObjects)
        return
      }
      if (!runtimeModelAssetsReady) {
        document.body.dataset.startupWaitState = JSON.stringify({
          captureReady: true,
          renderedLightingReady: true,
          runtimeModelAssetsReady
        })
        rafId = window.requestAnimationFrame(waitForSceneObjects)
        return
      }
      document.body.dataset.startupWaitState = JSON.stringify({
        captureReady: true,
        expanded: startupGeometryExpandedRef.current,
        renderedLightingReady: true,
        runtimeModelAssetsReady: true,
        runtimeModelsEnabled: runtimeModelsEnabledRef.current
      })
      void compileScene()
    }

    rafId = window.requestAnimationFrame(waitForSceneObjects)

    return () => {
      cancelled = true
      if (!hasReportedBasicAssetsReady.current) {
        setStartupSceneReady(false)
      }
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(geometryContractHandle)
      if (!hasReportedBasicAssetsReady.current) {
        delete document.body.dataset.sceneProgramsReady
      }
    }
  }, [
    gl,
    layout,
    onAssetsReady,
    runtimeModelAssetsReady,
    runtimeRenderedLayouts,
    scene,
    setRuntimeModelsEnabledState,
    setStartupGeometryExpandedState
  ])

  useEffect(() => {
    const globalWindow = window as Window & {
      __levelsjamDebug?: {
        clearDebugIsolation?: () => void
        getFogState?: () => {
          availableAtlasCount?: number
          density: number | null
          environmentFogColor: [number, number, number] | null
          fogDistance: number | null
          hasProbeAmbientTexture: boolean
          heightFalloff: number | null
          lightingStrength: number | null
          maxAtlasCount?: number
          meshCount: number
          noiseFrequency: number | null
          noiseStrength: number | null
          probeAmbientBounds: [number, number, number, number] | null
          probeAmbientGrid: [number, number] | null
          probeWorldOrigin?: [number, number] | null
          probeWorldRotation?: [number, number] | null
          rayStepCount: number | null
          selectedAtlasCount?: number
          selectedMazeIds?: string[]
          trackedMazeIds?: string[]
          useProbeAmbientTexture: number | null
          useProbeCoefficientTexture?: number | null
          useProbeConnectivity?: number | null
        } | null
        getLevelLightingState?: () => Array<{
          loadedProbeCount: number | null
          loadedVolumetricProbeCount: number | null
          mazeId: string
          probeCount: number | null
          ready: boolean
          reflectionReady: boolean
          startupVolumetricProbeCount: number | null
          surfaceLightmapReady: boolean
        }>
        getActiveLightingResourceState?: () => {
          activeMazeId: string
          hasActiveResources: boolean
          reflectionReady: boolean
          surfaceLightmapReady: boolean
          trackedMazeIds: string[]
        }
        getWorldLightingState?: () => {
          activeMazeId: string
          ready: boolean
          renderedMazeIds: string[]
          trackedMazeIds: string[]
          totalLoadedProbeCount: number
          totalLoadedVolumetricProbeCount: number
          totalProbeCount: number
          visibleRenderedMazeIds: string[]
        }
        setDebugVisible?: (
          role: string,
          index: number,
          visible: boolean
        ) => void
        isolateDebugRole?: (role: string, index: number) => void
        resetShaderProgramMonitor?: () => {
          baseline: number
        }
        getShaderProgramKeys?: () => string[]
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
        captureReflectionProbeSkyboxOnlyAtlas?: (
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
        getReflectionCaptureSceneState?: (
          options?: ReflectionCaptureSceneStateOptions
        ) => ReturnType<typeof getReflectionCaptureSceneState>
        getRendererStats?: () => {
          calls: number
          frame: number
          lines: number
          points: number
          triangles: number
        }
        getSceneObjectStats?: () => {
          mounted: Record<string, number>
          effectivelyVisible: Record<string, number>
          visible: Record<string, number>
          totalEffectivelyVisible: number
          totalMounted: number
          totalVisible: number
        }
        getDrawCallBreakdown?: () => Promise<Array<{
          calls: number
          role: string
          triangles: number
        }>>
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
    const isEffectivelyVisible = (object: Object3D) => {
      let current: Object3D | null = object

      while (current) {
        if (!current.visible) {
          return false
        }

        current = current.parent
      }

      return true
    }
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
        availableAtlasCount: 0,
        density: null,
        environmentFogColor: null,
        fogDistance: null,
        hasProbeAmbientTexture: false,
        heightFalloff: null,
        lightingStrength: null,
        maxAtlasCount: MAX_ACTIVE_FOG_VLM_ATLASES,
        meshCount: 0,
        noiseFrequency: null,
        noisePeriod: null,
        noiseStrength: null,
        probeAmbientBounds: null,
        probeAmbientGrid: null,
        rayStepCount: null,
        selectedAtlasCount: 0,
        selectedMazeIds: [],
        trackedMazeIds: [],
        useProbeAmbientTexture: null,
        useProbeCoefficientTexture: null,
        useProbeConnectivity: null
      }
    }
    const getLevelLightingState = () => {
      const states = scene.userData.levelLightingStatesByLevel as
        | Record<string, {
          ready?: boolean
          reflectionProbeState?: RuntimeReflectionProbeState
          surfaceLightmapReady?: boolean
        }>
        | undefined

      return Object.entries(states ?? {})
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([mazeId, state]) => ({
          loadedProbeCount: state.reflectionProbeState?.loadedProbeCount ?? null,
          loadedVolumetricProbeCount: state.reflectionProbeState?.loadedVolumetricProbeCount ?? null,
          mazeId,
          probeCount: state.reflectionProbeState?.probeCount ?? null,
          ready: Boolean(state.ready),
          reflectionReady: Boolean(state.reflectionProbeState?.ready),
          startupVolumetricProbeCount: state.reflectionProbeState?.startupVolumetricProbeCount ?? null,
          surfaceLightmapReady: Boolean(state.surfaceLightmapReady)
        }))
    }
    const getActiveLightingResourceState = () => ({
      activeMazeId: layout.maze.id,
      hasActiveResources: Boolean(activeLightingResources),
      reflectionReady: Boolean(activeLightingResources?.reflectionProbeState.ready),
      surfaceLightmapReady: Boolean(activeLightingResources?.surfaceLightmap.ready),
      trackedMazeIds: Array.from(levelLightingResources.keys()).sort()
    })
    const getWorldLightingState = () => {
      const worldProbeState = createWorldReflectionProbeState(worldLightingRegistry)
      const visibleRenderedMazeIds = new Set<string>()

      scene.traverse((object) => {
        const streamedLevelId = object.userData?.streamedLevelId

        if (
          typeof streamedLevelId === 'string' &&
          isEffectivelyVisible(object)
        ) {
          visibleRenderedMazeIds.add(streamedLevelId)
        }
      })

      return {
        activeMazeId: layout.maze.id,
        ready: worldProbeState.ready,
        renderedMazeIds: runtimeRenderedLayouts.map((renderedLayout) => renderedLayout.maze.id),
        trackedMazeIds: worldLightingRegistry.map((entry) => entry.mazeId).sort(),
        totalLoadedProbeCount: worldProbeState.loadedProbeCount ?? 0,
        totalLoadedVolumetricProbeCount: worldProbeState.loadedVolumetricProbeCount ?? 0,
        totalProbeCount: worldProbeState.probeCount,
        visibleRenderedMazeIds: Array.from(visibleRenderedMazeIds).sort()
      }
    }
    const getSceneObjectStats = () => {
      const effectivelyVisible: Record<string, number> = {}
      const mounted: Record<string, number> = {}
      const visible: Record<string, number> = {}
      let totalEffectivelyVisible = 0
      let totalMounted = 0
      let totalVisible = 0

      scene.traverse((object) => {
        totalMounted += 1
        const role = typeof object.userData?.debugRole === 'string'
          ? object.userData.debugRole
          : (
            Array.isArray(object.userData?.debugRoles)
              ? object.userData.debugRoles[0]
              : object.type
          )

        mounted[role] = (mounted[role] ?? 0) + 1

        if (object.visible) {
          totalVisible += 1
          visible[role] = (visible[role] ?? 0) + 1
        }

        let effectiveVisible = object.visible
        let parent = object.parent

        while (effectiveVisible && parent) {
          effectiveVisible = parent.visible
          parent = parent.parent
        }

        if (effectiveVisible) {
          totalEffectivelyVisible += 1
          effectivelyVisible[role] = (effectivelyVisible[role] ?? 0) + 1
        }
      })

      return {
        effectivelyVisible,
        mounted,
        visible,
        totalEffectivelyVisible,
        totalMounted,
        totalVisible
      }
    }

    const getDrawCallBreakdown = async () => {
      const counts = new Map<string, { calls: number; triangles: number }>()
      const originals: Array<{
        mesh: Mesh
        onBeforeRender: Mesh['onBeforeRender']
      }> = []

      scene.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return
        }

        const original = object.onBeforeRender

        originals.push({ mesh: object, onBeforeRender: original })
        object.onBeforeRender = function (...args) {
          const role = typeof object.userData?.debugRole === 'string'
            ? object.userData.debugRole
            : (
              Array.isArray(object.userData?.debugRoles)
                ? object.userData.debugRoles[0]
                : object.type
            )
          const positionAttribute = object.geometry.getAttribute('position')
          const triangleCount = object.geometry.index
            ? Math.floor(object.geometry.index.count / 3)
            : Math.floor((positionAttribute?.count ?? 0) / 3)
          const entry = counts.get(role) ?? { calls: 0, triangles: 0 }

          entry.calls += 1
          entry.triangles += triangleCount
          counts.set(role, entry)
          original.apply(this, args)
        }
      })

      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      } finally {
        for (const entry of originals) {
          entry.mesh.onBeforeRender = entry.onBeforeRender
        }
      }

      return Array.from(counts.entries())
        .map(([role, entry]) => ({
          calls: entry.calls,
          role,
          triangles: entry.triangles
        }))
        .sort((left, right) => right.calls - left.calls)
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

    const getReflectionCaptureSceneStateDebug = (
      options: ReflectionCaptureSceneStateOptions = {}
    ) => getReflectionCaptureSceneState(scene, layout, options)

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
      let processedTarget: { dispose: () => void; texture: Texture } | null = null

      captureCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )
      captureCamera.layers.enable(TORCH_BILLBOARD_LAYER)

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

        return {
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
        captureTarget.dispose()
        processedTarget?.dispose()
        scene.remove(captureCamera)
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

    const captureReflectionProbeSkyboxOnlyAtlas = (probeIndex: number, size = 128) => {
      const probe = layout.reflectionProbes[probeIndex]
      const backgroundTexture = scene.background instanceof Texture
        ? scene.background
        : null
      const captureEnvironmentTexture = environmentTexture ?? backgroundTexture

      if (!probe || size <= 0 || !captureEnvironmentTexture) {
        return null
      }

      const hiddenObjects: Array<{ object: { visible: boolean }, visible: boolean }> = []
      const savedBackground = scene.background
      const savedBackgroundIntensity = scene.backgroundIntensity
      const savedEnvironment = scene.environment
      const savedEnvironmentIntensity = scene.environmentIntensity
      const skyboxTarget = new WebGLCubeRenderTarget(size, {
        type: HalfFloatType
      })
      const skyboxCamera = new CubeCamera(0.1, REFLECTION_PROBE_FAR, skyboxTarget)

      scene.traverse((object) => {
        if (object !== scene && object.visible) {
          hiddenObjects.push({ object, visible: object.visible })
          object.visible = false
        }
      })

      skyboxCamera.position.set(
        probe.position.x,
        probe.position.y,
        probe.position.z
      )
      scene.background = savedBackground
      scene.backgroundIntensity = BAKED_ENVIRONMENT_INTENSITY
      scene.environment = captureEnvironmentTexture
      scene.environmentIntensity = environmentIntensity

      try {
        scene.add(skyboxCamera)
        skyboxCamera.update(gl, scene)
        scene.remove(skyboxCamera)

        return captureCubeTextureAtlasDataUrls(gl, skyboxTarget.texture, size, {
          applyColorSpaceTransform: false
        })
      } finally {
        scene.background = savedBackground
        scene.backgroundIntensity = savedBackgroundIntensity
        scene.environment = savedEnvironment
        scene.environmentIntensity = savedEnvironmentIntensity
        skyboxTarget.dispose()
        scene.remove(skyboxCamera)
        for (const entry of hiddenObjects) {
          entry.object.visible = entry.visible
        }
      }
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
      captureReflectionProbeSkyboxOnlyAtlas,
      captureReflectionProbeWallMaterialContinuum,
      clearDebugIsolation,
      getFogState,
      getActiveLightingResourceState,
      getLevelLightingState,
      getWorldLightingState,
      getReflectionCaptureSceneState: getReflectionCaptureSceneStateDebug,
      getRendererStats: () => ({
        calls: gl.info.render.calls,
        frame: gl.info.render.frame,
        lines: gl.info.render.lines,
        points: gl.info.render.points,
        triangles: gl.info.render.triangles
      }),
      getShaderProgramKeys: () => (
        ((gl.info.programs ?? []) as Array<{ cacheKey?: string; id?: number | string; name?: string }>).map(
          (program, index) => program.cacheKey ?? program.name ?? String(program.id ?? index)
        )
      ),
      getSceneObjectStats,
      getDrawCallBreakdown,
      getRuntimeMemoryState,
      getReflectionProbeTextureState,
      isolateDebugRole,
      resetShaderProgramMonitor: () => {
        const currentProgramCount = gl.info.programs?.length ?? 0
        postReadyProgramBaselineRef.current = currentProgramCount
        postReadyProgramIncreaseCountRef.current = 0
        postReadyProgramHistoryRef.current = []
        postReadyProgramNamesRef.current = new Set(
          ((gl.info.programs ?? []) as Array<{ cacheKey?: string; id?: number | string; name?: string }>).map(
            (program, index) => program.cacheKey ?? program.name ?? String(program.id ?? index)
          )
        )
        document.body.dataset.shaderProgramsAtReady = String(currentProgramCount)
        document.body.dataset.shaderProgramsAfterReady = String(currentProgramCount)
        document.body.dataset.shaderProgramIncreaseHistory = '[]'
        document.body.dataset.shaderProgramIncreaseCount = '0'
        return { baseline: currentProgramCount }
      },
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
      delete globalWindow.__levelsjamDebug.captureReflectionProbeSkyboxOnlyAtlas
      delete globalWindow.__levelsjamDebug.captureReflectionProbeWallMaterialContinuum
      delete globalWindow.__levelsjamDebug.clearDebugIsolation
      delete globalWindow.__levelsjamDebug.getFogState
      delete globalWindow.__levelsjamDebug.getActiveLightingResourceState
      delete globalWindow.__levelsjamDebug.getLevelLightingState
      delete globalWindow.__levelsjamDebug.getWorldLightingState
      delete globalWindow.__levelsjamDebug.getReflectionCaptureSceneState
      delete globalWindow.__levelsjamDebug.getRendererStats
      delete globalWindow.__levelsjamDebug.getShaderProgramKeys
      delete globalWindow.__levelsjamDebug.getSceneObjectStats
      delete globalWindow.__levelsjamDebug.getDrawCallBreakdown
      delete globalWindow.__levelsjamDebug.getRuntimeMemoryState
      delete globalWindow.__levelsjamDebug.getReflectionProbeTextureState
      delete globalWindow.__levelsjamDebug.resetShaderProgramMonitor
      delete globalWindow.__levelsjamDebug.setDebugVisible
      delete globalWindow.__levelsjamDebug.isolateDebugRole
      if (Object.keys(globalWindow.__levelsjamDebug).length === 0) {
        delete globalWindow.__levelsjamDebug
      }
    }
  }, [
    activeLightingResources,
    environmentIntensity,
    environmentTexture,
    gl,
    layout,
    levelLightingResources,
    reflectionProbeDepthTextures,
    reflectionProbeRawTextures,
    reflectionProbeTextures,
    runtimeRenderedLayouts,
    scene,
    worldLightingRegistry
  ])

  const ambientOcclusionActive = isAmbientOcclusionActive(visualSettings)
  const bloomActive = isEffectActive(visualSettings.bloom)
  const depthOfFieldActive = isDepthOfFieldActive(visualSettings.depthOfField)
  const lensFlareActive =
    visualSettings.lensFlare.enabled &&
    visualSettings.lensFlare.opacity > EFFECT_EPSILON
  const fogAmbientColor = useMemo(
    () => colorFromHex(visualSettings.volumetricAmbientHex),
    [visualSettings.volumetricAmbientHex]
  )
  const vignetteActive = isEffectActive(visualSettings.vignette)
  const runtimeLightmapIntensity = visualSettings.unlitMode
    ? 0
    : getEnabledContributionIntensity(visualSettings.lightmapContribution)
  const runtimeDynamicVolumetricIntensity = visualSettings.unlitMode
    ? 0
    : getEnabledContributionIntensity(visualSettings.iblContribution)
  const runtimeStaticVolumetricIntensity = visualSettings.unlitMode
    ? 0
    : getEnabledContributionIntensity(visualSettings.staticVolumetricContribution)
  const runtimeReflectionIntensity = visualSettings.unlitMode
    ? 0
    : getEnabledContributionIntensity(visualSettings.reflectionContribution)
  const offlineReflectionBakeMode = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return new URLSearchParams(window.location.search).get('bake') === 'reflection-probes'
  }, [])
  const precomputedVisibilityState = useMemo<PrecomputedVisibilityState>(() => {
    const visibleCellKeys =
      layout.maze.visibility?.cells?.[getMazeCellKey(turnState.player.cell)]

    if (!visualSettings.precomputedVisibilityEnabled || !visibleCellKeys) {
      return DISABLED_PRECOMPUTED_VISIBILITY
    }

    return {
      enabled: true,
      playerCell: { ...turnState.player.cell },
      visibleCells: new Set(visibleCellKeys)
    }
  }, [
    layout.maze.visibility,
    turnState.player.cell.x,
    turnState.player.cell.y,
    visualSettings.precomputedVisibilityEnabled
  ])
  const effectiveVisibilityState = precomputedVisibilityState
  const adjacentLevelVisibilityStates = useMemo(() => {
    const states = new Map<string, PrecomputedVisibilityState>()

    for (const renderedLayout of stagedRenderedLayouts) {
      if (renderedLayout.maze.id === layout.maze.id) {
        continue
      }

      if (
        !effectiveVisibilityState.enabled ||
        !effectiveVisibilityState.visibleCells
      ) {
        states.set(renderedLayout.maze.id, DISABLED_PRECOMPUTED_VISIBILITY)
        continue
      }

      states.set(renderedLayout.maze.id, {
        enabled: true,
        playerCell: { ...effectiveVisibilityState.playerCell },
        visibleCells: new Set(
          getAdjacentLevelVisibleCellKeys(
            layout.maze,
            renderedLayout.maze,
            effectiveVisibilityState.visibleCells,
            {
              currentPlayerCell: effectiveVisibilityState.playerCell,
              maxPortalDistanceCells: 6
            }
          ) ?? []
        )
      })
    }

    return states
  }, [effectiveVisibilityState, layout.maze, stagedRenderedLayouts])
  const activePlayerWorldPosition = useMemo(
    () => getTransformedMazeCellWorldPosition(
      layout.maze,
      levelTransform,
      turnState.player.cell,
      GROUND_Y
    ),
    [layout.maze, levelTransform, turnState.player.cell]
  )
  const altarCutsceneTarget = useMemo(() => {
    if (!altarCutscene || altarCutscene.levelId !== layout.maze.id) {
      return null
    }

    const altar = layout.altars.find((candidate) => candidate.id === altarCutscene.altarId)

    return altar
      ? transformLevelLocalPositionToWorld(
          {
            x: altar.position.x,
            y: GROUND_Y + 1.05,
            z: altar.position.z
          },
          levelTransform,
          new Vector3()
        )
      : null
  }, [altarCutscene, layout.altars, layout.maze.id, levelTransform])
  const composerResolutionScale = ambientOcclusionActive &&
    visualSettings.ambientOcclusionMode === 'n8ao'
    ? 1
    : 0.5
  const completedMazeLevelIds = useMemo(() => {
    const completed = new Set<string>()

    for (const renderedLayout of runtimeRenderedLayouts) {
      for (const altar of renderedLayout.altars ?? []) {
        if (altar.targetLevelId && activatedAltarIds.has(altar.id)) {
          completed.add(altar.targetLevelId)
        }
      }
    }

    return completed
  }, [activatedAltarIds, runtimeRenderedLayouts])

  return (
    <>
      <ambientLight intensity={visualSettings.unlitMode ? 1 : 0} />
      <SceneEnvironmentBackground intensity={environmentIntensity} />
      <VolumetricShadowContext.Provider value={visualSettings.volumetricShadowsEnabled}>
      <TorchBillboardIntensityContext.Provider value={visualSettings.torchBillboardIntensity}>
      <LightmapSaturationContext.Provider value={visualSettings.lightmapSaturation}>
      <VolumetricSaturationContext.Provider value={visualSettings.volumetricSaturation}>
        <SceneSfxRuntime
          activatedAltarIds={activatedAltarIds}
          audioSettings={audioSettings}
          layout={layout}
          renderedLayouts={runtimeRenderedLayouts}
          turnState={turnState}
        />
        {runtimeRenderedLayouts.map((renderedLayout) => {
          const isActive = renderedLayout.maze.id === layout.maze.id
          const renderedTurnState = isActive
            ? turnState
            : getRenderedTurnState(renderedLayout)
          const priorityCell = isActive
            ? renderedTurnState.player.cell
            : findIngressCellForTransition(renderedLayout.maze, layout.maze.id)
          const priorityLocalPosition = getMazeCellWorldPosition(
            renderedLayout.maze,
            priorityCell,
            GROUND_Y
          )

          return (
            <RuntimeLevelGeometry
              activatedAltarIds={activatedAltarIds}
              activePlayerWorldPosition={activePlayerWorldPosition}
              activePlayerTurn={turnState.turn}
              completedMazeLevelIds={completedMazeLevelIds}
              environmentIntensity={environmentIntensity}
              iblContributionIntensity={runtimeDynamicVolumetricIntensity}
              isActive={isActive}
              key={`runtime-level-${renderedLayout.maze.id}`}
              layout={renderedLayout}
              lightmapContributionIntensity={runtimeLightmapIntensity}
              minotaurAlbedoHex={visualSettings.minotaurAlbedoHex}
              monsterEyeColors={visualSettings.monsterEyeColors}
              monsterEyes={visualSettings.monsterEyes}
              mountAllGeometry={startupGeometryExpanded || offlineReflectionBakeMode}
              offeringAltarId={
                altarCutscene?.levelId === renderedLayout.maze.id &&
                !activatedAltarIds.has(altarCutscene.altarId)
                  ? altarCutscene.altarId
                  : null
              }
              offeringStartedAt={
                altarCutscene?.levelId === renderedLayout.maze.id
                  ? altarCutscene.startedAt
                  : null
              }
              onLightingResourcesChange={handleLevelLightingResourcesChange}
              openGateIdsOverride={isActive ? activeOpenGateIds : closedGateIds}
              probeDebugMode={visualSettings.probeDebugMode}
              priorityPosition={{
                x: priorityLocalPosition.x,
                z: priorityLocalPosition.z
              }}
              reflectionContributionIntensity={runtimeReflectionIntensity}
              runtimeModelsEnabled={runtimeModelsEnabled}
              staticVolumetricContributionIntensity={runtimeStaticVolumetricIntensity}
              transform={getRuntimeLevelWorldTransform(renderedLayout.maze.id)}
              turnState={renderedTurnState}
              visibilityState={
                offlineReflectionBakeMode
                  ? DISABLED_PRECOMPUTED_VISIBILITY
                  : isActive
                  ? effectiveVisibilityState
                  : (
                    adjacentLevelVisibilityStates.get(renderedLayout.maze.id) ??
                    DISABLED_PRECOMPUTED_VISIBILITY
                  )
              }
            />
          )
        })}
        {composerEnabled ? (
      <EffectComposer
        enableNormalPass={ambientOcclusionActive && visualSettings.ambientOcclusionMode === 'ssao'}
        multisampling={0}
        ref={composerRef}
        resolutionScale={composerResolutionScale}
      >
        {visualSettings.ssr.enabled ? (
          <SSRPassPrimitive settings={visualSettings.ssr} />
        ) : null}
        {ambientOcclusionActive && visualSettings.ambientOcclusionMode === 'n8ao' ? (
          <TunedN8AO
            aoRadius={visualSettings.ambientOcclusionRadius}
            aoSamples={visualSettings.n8aoSamples}
            denoiseIterations={visualSettings.n8aoDenoiseIterations}
            denoiseRadius={visualSettings.n8aoDenoiseRadius}
            denoiseSamples={visualSettings.n8aoDenoiseSamples}
            intensity={visualSettings.ambientOcclusionIntensity * 3}
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
            lightingEntries={worldLightingRegistry}
            lightingStrength={visualSettings.volumetricLightingStrength}
            noiseFrequency={visualSettings.volumetricNoiseFrequency}
            noisePeriod={visualSettings.volumetricNoisePeriod}
            noiseStrength={visualSettings.volumetricNoiseStrength}
            probeSaturation={visualSettings.volumetricSaturation}
            rayStepCount={visualSettings.volumetricStepCount}
            visible={visualSettings.volumetricLighting.enabled}
            volumeIntensity={visualSettings.volumetricLighting.intensity}
          />
        ) : null}
        <BillboardCompositePass />
        {depthOfFieldActive ? (
          <DepthOfField
            bokehScale={visualSettings.depthOfField.bokehScale}
            focusDistance={visualSettings.depthOfField.focusDistance}
            focusRange={visualSettings.depthOfField.focusRange}
            resolutionScale={visualSettings.depthOfField.resolutionScale}
          />
        ) : null}
        {bloomActive ? (
          <BloomEffectPrimitive settings={visualSettings.bloom} />
        ) : null}
        {visualSettings.anamorphic.enabled ? (
          <AnamorphicEffectPrimitive settings={visualSettings.anamorphic} />
        ) : null}
        {visualSettings.chromaticAberration.enabled &&
        (
          visualSettings.chromaticAberration.intensity > EFFECT_EPSILON ||
          visualSettings.chromaticAberration.screenShakeIntensity > EFFECT_EPSILON
        ) ? (
          <RadialChromaticAberrationEffectPrimitive
            settings={visualSettings.chromaticAberration}
          />
        ) : null}
        {lensFlareActive ? (
          <TorchLensFlare
            settings={visualSettings.lensFlare}
          />
        ) : null}
        <PlayerFadeEffectPrimitive />
        {vignetteActive ? (
          <AnimatedVignette settings={visualSettings.vignette} />
        ) : null}
        <SaturationEffectPrimitive saturation={visualSettings.saturation} />
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
            applyTurnActionForLevel={applyTurnActionForLevel}
            altarCutsceneTarget={altarCutsceneTarget}
            audioSettings={audioSettings}
            cameraTiltDegrees={visualSettings.cameraTiltDegrees}
            commitGlobalTurnState={commitGlobalTurnState}
            inputEnabled={startupSceneReady && !cutsceneActive}
            isLevelLightingReady={isLevelLightingReadyForTransition}
            layout={layout}
            levelTransform={levelTransform}
            movementSettings={visualSettings.movement}
            onLevelTransition={onLevelTransition}
            onReplayActiveChange={onReplayActiveChange}
            replayRequestId={replayRequestId}
            replayRequestMazeId={replayRequestMazeId}
            setDisplayedOpenGateIds={setDisplayedOpenGateIdsIfChanged}
            setTurnState={setTurnState}
            turnState={turnState}
          wallBounds={getWallBounds(layout)}
        />
        <PerformanceBenchmarkBridge />
        <StartupReporter ready={startupSceneReady} />
      </VolumetricSaturationContext.Provider>
      </LightmapSaturationContext.Provider>
      </TorchBillboardIntensityContext.Provider>
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
  audioSettings,
  onBooleanSettingChange,
  onBloomSettingChange,
  controlsOpen,
  onAudioSettingChange,
  onChromaticAberrationSettingChange,
  onDepthOfFieldSettingChange,
  onEffectSettingChange,
  onFogAmbientHexChange,
  onLensFlareSettingChange,
  onMinotaurAlbedoHexChange,
  onMonsterEyeColorChange,
  onMonsterEyeOffsetChange,
  onProbeDebugModeChange,
  onResetAnamorphicSettings,
  onResetAmbientOcclusionMode,
  onResetBloomSettings,
  onResetBooleanSetting,
  onResetChromaticAberrationSettings,
  onResetChromaticAberrationSetting,
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
  audioSettings: AudioSettings
  onBooleanSettingChange: (
    key: BooleanSettingKey,
    value: boolean
  ) => void
  onAudioSettingChange: (patch: Partial<AudioSettings>) => void
  onBloomSettingChange: (patch: Partial<BloomSettings>) => void
  onChromaticAberrationSettingChange: (patch: Partial<ChromaticAberrationSettings>) => void
  controlsOpen: boolean
  onDepthOfFieldSettingChange: (patch: Partial<DepthOfFieldSettings>) => void
  onEffectSettingChange: (
    effect: GenericEffectSettingKey,
    patch: Partial<EffectSettings>
  ) => void
  onFogAmbientHexChange: (value: string) => void
  onLensFlareSettingChange: (patch: Partial<LensFlareSettings>) => void
  onMinotaurAlbedoHexChange: (value: string) => void
  onMonsterEyeColorChange: (monsterType: MonsterType, value: string) => void
  onMonsterEyeOffsetChange: (
    monsterType: MonsterType,
    eye: 'left' | 'right',
    axis: keyof MonsterEyeOffset,
    value: number
  ) => void
  onProbeDebugModeChange: (value: ProbeDebugMode) => void
  onResetAnamorphicSettings: () => void
  onResetAmbientOcclusionMode: () => void
  onResetBloomSettings: () => void
  onResetBooleanSetting: (key: BooleanSettingKey) => void
  onResetChromaticAberrationSettings: () => void
  onResetChromaticAberrationSetting: (key: keyof ChromaticAberrationSettings) => void
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
  const [performanceCapturePending, setPerformanceCapturePending] = useState(false)
  const [performanceReport, setPerformanceReport] = useState(
    'Press Capture to record the next second of live frames and controlled render-cost samples.'
  )

  const capturePerformanceReport = useCallback(async () => {
    const globalWindow = window as Window & {
      __levelsjamCapturePerformanceProfile?: (
        options?: { liveDurationMs?: number; samples?: number }
      ) => Promise<PerformanceProfileResult>
    }

    if (!globalWindow.__levelsjamCapturePerformanceProfile) {
      setPerformanceReport('Performance profiler is not ready yet.')
      return
    }

    setPerformanceCapturePending(true)
    setPerformanceReport('Capturing performance profile...')

    try {
      const profile = await globalWindow.__levelsjamCapturePerformanceProfile({
        liveDurationMs: 1000,
        samples: 24
      })

      setPerformanceReport(profile.markdown)
    } catch (error) {
      setPerformanceReport(
        `Performance capture failed: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setPerformanceCapturePending(false)
    }
  }, [])

  const exportVisualSettingsConfig = useCallback(() => {
    const blob = new Blob(
      [`${JSON.stringify(visualSettings, null, 2)}\n`],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'visual-settings.defaults.json'
    link.click()
    URL.revokeObjectURL(url)
  }, [visualSettings])

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
        <button
          onClick={exportVisualSettingsConfig}
          type="button"
        >
          Export Settings
        </button>
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
            {tab.label}
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
        <output>{visualSettings.hdriBrightness.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('hdriBrightness')}>
          HDRI Brightness
        </ResettableLabel>
        <input
          aria-label="HDRI Brightness"
          max={4}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('hdriBrightness', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.hdriBrightness}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.saturation.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('saturation')}>
          Saturation
        </ResettableLabel>
        <input
          aria-label="Saturation"
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('saturation', Number(event.target.value))
          }}
          step={0.01}
          type="range"
          value={visualSettings.saturation}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.lightmapSaturation.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('lightmapSaturation')}>
          Surface Lightmap Saturation
        </ResettableLabel>
        <input
          aria-label="Surface-LM Saturation"
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('lightmapSaturation', Number(event.target.value))
          }}
          step={0.01}
          type="range"
          value={visualSettings.lightmapSaturation}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.volumetricSaturation.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('volumetricSaturation')}>
          Volumetric Lightmap Saturation
        </ResettableLabel>
        <input
          aria-label="Volumetric-LM Saturation"
          max={1}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('volumetricSaturation', Number(event.target.value))
          }}
          step={0.01}
          type="range"
          value={visualSettings.volumetricSaturation}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.torchBillboardIntensity.toFixed(2)}x</output>
        <ResettableLabel onReset={() => onResetScalarSetting('torchBillboardIntensity')}>
          Torch Billboard Intensity
        </ResettableLabel>
        <input
          aria-label="Torch Billboard Intensity"
          max={8}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('torchBillboardIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.torchBillboardIntensity}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.cameraFov.toFixed(0)} deg</output>
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

          <label className="visual-control-row">
        <output>{visualSettings.cameraTiltDegrees.toFixed(1)} deg</output>
        <ResettableLabel onReset={() => onResetScalarSetting('cameraTiltDegrees')}>
          Camera Tilt
        </ResettableLabel>
        <input
          aria-label="Camera Tilt"
          max={20}
          min={-20}
          onChange={(event) => {
            onScalarSettingChange('cameraTiltDegrees', Number(event.target.value))
          }}
          step={0.5}
          type="range"
          value={visualSettings.cameraTiltDegrees}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.unlitMode ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('unlitMode')}>
          Unlit Mode
        </ResettableLabel>
        <input
          aria-label="Unlit Mode"
          checked={visualSettings.unlitMode}
          onChange={(event) => {
            onBooleanSettingChange('unlitMode', event.target.checked)
          }}
          type="checkbox"
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.precomputedVisibilityEnabled ? 'on' : 'off'}</output>
        <ResettableLabel onReset={() => onResetBooleanSetting('precomputedVisibilityEnabled')}>
          Precomputed Visibility
        </ResettableLabel>
        <input
          aria-label="Precomputed Visibility"
          checked={visualSettings.precomputedVisibilityEnabled}
          onChange={(event) => {
            onBooleanSettingChange('precomputedVisibilityEnabled', event.target.checked)
          }}
          type="checkbox"
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
            aria-label="Surface Lightmap Enabled"
            checked={visualSettings.lightmapContribution.enabled}
            onChange={(event) => {
              onBooleanSettingChange('lightmapContributionEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetScalarSetting('lightmapContributionIntensity')}>
            Surface Lightmap
          </ResettableLabel>
        </label>
        <input
          aria-label="Surface Lightmap"
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
          {visualSettings.iblContribution.enabled
            ? `${visualSettings.iblContribution.intensity.toFixed(2)}x`
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            aria-label="Dynamic Volumetric Enabled"
            checked={visualSettings.iblContribution.enabled}
            onChange={(event) => {
              onBooleanSettingChange('iblContributionEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetScalarSetting('iblContributionIntensity')}>
            Dynamic Volumetric
          </ResettableLabel>
        </label>
        <input
          aria-label="Dynamic Volumetric"
          disabled={!visualSettings.iblContribution.enabled}
          max={MAX_LIGHTING_CONTRIBUTION_INTENSITY}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('iblContributionIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.iblContribution.intensity}
        />
          </div>

          <div className="visual-control-row">
        <output>
          {visualSettings.staticVolumetricContribution.enabled
            ? `${visualSettings.staticVolumetricContribution.intensity.toFixed(2)}x`
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            aria-label="Static Volumetric Enabled"
            checked={visualSettings.staticVolumetricContribution.enabled}
            onChange={(event) => {
              onBooleanSettingChange('staticVolumetricContributionEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetScalarSetting('staticVolumetricContributionIntensity')}>
            Static Volumetric
          </ResettableLabel>
        </label>
        <input
          aria-label="Static Volumetric"
          disabled={!visualSettings.staticVolumetricContribution.enabled}
          max={MAX_LIGHTING_CONTRIBUTION_INTENSITY}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('staticVolumetricContributionIntensity', Number(event.target.value))
          }}
          step={0.05}
          type="range"
          value={visualSettings.staticVolumetricContribution.intensity}
        />
          </div>

          <div className="visual-control-row">
        <output>{visualSettings.volumetricShadowsEnabled ? 'on' : 'off'}</output>
        <label className="visual-effect-label">
          <input
            aria-label="Volumetric Occlusion Enabled"
            checked={visualSettings.volumetricShadowsEnabled}
            onChange={(event) => {
              onBooleanSettingChange('volumetricShadowsEnabled', event.target.checked)
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => onResetBooleanSetting('volumetricShadowsEnabled')}>
            Volumetric Occlusion
          </ResettableLabel>
        </label>
        <span aria-hidden="true" />
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
          max={MAX_REFLECTION_CONTRIBUTION_INTENSITY}
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

          <label className="visual-control-row">
        <output>{visualSettings.n8aoSamples.toFixed(0)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('n8aoSamples')}>
          N8AO Samples
        </ResettableLabel>
        <input
          aria-label="N8AO Samples"
          disabled={visualSettings.ambientOcclusionMode !== 'n8ao'}
          max={16}
          min={1}
          onChange={(event) => {
            onScalarSettingChange('n8aoSamples', Number(event.target.value))
          }}
          step={1}
          type="range"
          value={visualSettings.n8aoSamples}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.n8aoDenoiseSamples.toFixed(0)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('n8aoDenoiseSamples')}>
          N8AO Denoise Samples
        </ResettableLabel>
        <input
          aria-label="N8AO Denoise Samples"
          disabled={visualSettings.ambientOcclusionMode !== 'n8ao'}
          max={8}
          min={1}
          onChange={(event) => {
            onScalarSettingChange('n8aoDenoiseSamples', Number(event.target.value))
          }}
          step={1}
          type="range"
          value={visualSettings.n8aoDenoiseSamples}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.n8aoDenoiseRadius.toFixed(1)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('n8aoDenoiseRadius')}>
          N8AO Denoise Radius
        </ResettableLabel>
        <input
          aria-label="N8AO Denoise Radius"
          disabled={visualSettings.ambientOcclusionMode !== 'n8ao'}
          max={16}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('n8aoDenoiseRadius', Number(event.target.value))
          }}
          step={0.5}
          type="range"
          value={visualSettings.n8aoDenoiseRadius}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.n8aoDenoiseIterations.toFixed(0)}</output>
        <ResettableLabel onReset={() => onResetScalarSetting('n8aoDenoiseIterations')}>
          N8AO Denoise Iterations
        </ResettableLabel>
        <input
          aria-label="N8AO Denoise Iterations"
          disabled={visualSettings.ambientOcclusionMode !== 'n8ao'}
          max={4}
          min={0}
          onChange={(event) => {
            onScalarSettingChange('n8aoDenoiseIterations', Number(event.target.value))
          }}
          step={1}
          type="range"
          value={visualSettings.n8aoDenoiseIterations}
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
        <output>{visualSettings.depthOfField.focusRange.toFixed(3)}</output>
        <ResettableLabel onReset={() => onResetDepthOfFieldSetting('focusRange')}>
          DOF Focus Range (m)
        </ResettableLabel>
        <input
          aria-label="DOF Focus Range"
          disabled={!visualSettings.depthOfField.enabled}
          max={8}
          min={0.001}
          onChange={(event) => {
            onDepthOfFieldSettingChange({
              focusRange: Number(event.target.value)
            })
          }}
          step={0.001}
          type="range"
          value={visualSettings.depthOfField.focusRange}
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
            ? visualSettings.lensFlare.opacity.toFixed(4)
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
            onResetLensFlareSetting('opacity')
          }}>
            Lens Flares
          </ResettableLabel>
        </label>
        <input
          aria-label="Lens Flare Strength"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              opacity: Number(event.target.value)
            })
          }}
          step={0.0005}
          type="number"
          value={visualSettings.lensFlare.opacity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.flareSize.toFixed(4)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('flareSize')}>
          Flare Size
        </ResettableLabel>
        <input
          aria-label="Flare Size"
          disabled={!visualSettings.lensFlare.enabled}
          max={1}
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

          <label className="visual-control-row">
        <output>{visualSettings.lensFlare.starBurstIntensity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetLensFlareSetting('starBurstIntensity')}>
          Star Burst Intensity
        </ResettableLabel>
        <input
          aria-label="Star Burst Intensity"
          disabled={!visualSettings.lensFlare.enabled}
          max={2}
          min={0}
          onChange={(event) => {
            onLensFlareSettingChange({
              starBurstIntensity: Number(event.target.value)
            })
          }}
          step={0.01}
          type="range"
          value={visualSettings.lensFlare.starBurstIntensity}
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

      {activeTab === 'chromatic' ? (
        <>
          <div className="visual-control-row">
        <output>
          {visualSettings.chromaticAberration.enabled
            ? visualSettings.chromaticAberration.intensity.toFixed(2)
            : 'off'}
        </output>
        <label className="visual-effect-label">
          <input
            checked={visualSettings.chromaticAberration.enabled}
            onChange={(event) => {
              onChromaticAberrationSettingChange({ enabled: event.target.checked })
            }}
            type="checkbox"
          />
          <ResettableLabel onReset={() => {
            onResetChromaticAberrationSetting('enabled')
            onResetChromaticAberrationSetting('intensity')
          }}>
            Chromatic Aberration
          </ResettableLabel>
        </label>
        <input
          aria-label="Chromatic Aberration Intensity"
          disabled={!visualSettings.chromaticAberration.enabled}
          max={2}
          min={0}
          onChange={(event) => {
            onChromaticAberrationSettingChange({ intensity: Number(event.target.value) })
          }}
          step={0.01}
          type="range"
          value={visualSettings.chromaticAberration.intensity}
        />
          </div>

          <label className="visual-control-row">
        <output>{visualSettings.chromaticAberration.offsetX.toFixed(4)}</output>
        <ResettableLabel onReset={() => onResetChromaticAberrationSetting('offsetX')}>
          Chromatic Offset Radius X
        </ResettableLabel>
        <input
          aria-label="Chromatic Offset X"
          disabled={!visualSettings.chromaticAberration.enabled}
          max={0.02}
          min={-0.02}
          onChange={(event) => {
            onChromaticAberrationSettingChange({ offsetX: Number(event.target.value) })
          }}
          step={0.0005}
          type="range"
          value={visualSettings.chromaticAberration.offsetX}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.chromaticAberration.offsetY.toFixed(4)}</output>
        <ResettableLabel onReset={() => onResetChromaticAberrationSetting('offsetY')}>
          Chromatic Offset Radius Y
        </ResettableLabel>
        <input
          aria-label="Chromatic Offset Y"
          disabled={!visualSettings.chromaticAberration.enabled}
          max={0.02}
          min={-0.02}
          onChange={(event) => {
            onChromaticAberrationSettingChange({ offsetY: Number(event.target.value) })
          }}
          step={0.0005}
          type="range"
          value={visualSettings.chromaticAberration.offsetY}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.chromaticAberration.exponent.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetChromaticAberrationSetting('exponent')}>
          Chromatic Radial Exponent
        </ResettableLabel>
        <input
          aria-label="Chromatic Radial Exponent"
          disabled={!visualSettings.chromaticAberration.enabled}
          max={8}
          min={-8}
          onChange={(event) => {
            onChromaticAberrationSettingChange({ exponent: Number(event.target.value) })
          }}
          step={0.1}
          type="range"
          value={visualSettings.chromaticAberration.exponent}
        />
          </label>

          <label className="visual-control-row">
        <output>{visualSettings.chromaticAberration.screenShakeIntensity.toFixed(2)}</output>
        <ResettableLabel onReset={() => onResetChromaticAberrationSetting('screenShakeIntensity')}>
          Screen Shake Intensity
        </ResettableLabel>
        <input
          aria-label="Chromatic Screen Shake Intensity"
          disabled={!visualSettings.chromaticAberration.enabled}
          max={50}
          min={0}
          onChange={(event) => {
            onChromaticAberrationSettingChange({
              screenShakeIntensity: Number(event.target.value)
            })
          }}
          step={0.1}
          type="range"
          value={visualSettings.chromaticAberration.screenShakeIntensity}
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

      {activeTab === 'volume' ? (
        <>
          {(
            Object.keys(SFX_URLS) as SfxKey[]
          ).map((key) => (
            <label className="visual-control-row" key={key}>
              <output>{(audioSettings.sfxVolumes[key] ?? 1).toFixed(2)}x</output>
              <ResettableLabel onReset={() => {
                onAudioSettingChange({
                  sfxVolumes: {
                    ...audioSettings.sfxVolumes,
                    [key]: DEFAULT_SFX_VOLUMES[key]
                  }
                })
              }}>
                {SFX_LABELS[key]}
              </ResettableLabel>
              <input
                aria-label={`${SFX_LABELS[key]} Volume`}
                max={4}
                min={0}
                onChange={(event) => {
                  onAudioSettingChange({
                    sfxVolumes: {
                      ...audioSettings.sfxVolumes,
                      [key]: Number(event.target.value)
                    }
                  })
                }}
                step={0.01}
                type="range"
                value={audioSettings.sfxVolumes[key] ?? 1}
              />
            </label>
          ))}
        </>
      ) : null}

      {activeTab === 'eyes' ? (
        <>
          <label className="visual-control-row">
            <output aria-hidden="true">{normalizeHexColor(visualSettings.minotaurAlbedoHex, DEFAULT_MINOTAUR_ALBEDO_HEX)}</output>
            <ResettableLabel onReset={() => onMinotaurAlbedoHexChange(DEFAULT_MINOTAUR_ALBEDO_HEX)}>
              Minotaur Albedo
            </ResettableLabel>
            <input
              aria-label="Minotaur Albedo"
              onChange={(event) => {
                onMinotaurAlbedoHexChange(event.target.value)
              }}
              type="color"
              value={normalizeHexColor(visualSettings.minotaurAlbedoHex, DEFAULT_MINOTAUR_ALBEDO_HEX)}
            />
          </label>

          {MONSTER_EYE_TYPES.flatMap((monsterType) =>
            [
              <label className="visual-control-row" key={`${monsterType}-eye-color`}>
                <output aria-hidden="true">
                  {normalizeHexColor(
                    visualSettings.monsterEyeColors[monsterType],
                    DEFAULT_MONSTER_EYE_COLORS[monsterType]
                  )}
                </output>
                <ResettableLabel onReset={() => {
                  onMonsterEyeColorChange(monsterType, DEFAULT_MONSTER_EYE_COLORS[monsterType])
                }}>
                  {`${monsterType} eye color`}
                </ResettableLabel>
                <input
                  aria-label={`${monsterType} eye color`}
                  onChange={(event) => {
                    onMonsterEyeColorChange(monsterType, event.target.value)
                  }}
                  type="color"
                  value={normalizeHexColor(
                    visualSettings.monsterEyeColors[monsterType],
                    DEFAULT_MONSTER_EYE_COLORS[monsterType]
                  )}
                />
              </label>,
              ...(['left', 'right'] as const).flatMap((eye) =>
                (['x', 'y', 'z'] as const).map((axis) => {
                const value = visualSettings.monsterEyes[monsterType][eye][axis]
                const label = `${monsterType} ${eye} eye ${axis.toUpperCase()}`

                return (
                  <label className="visual-control-row" key={label}>
                    <output>{value.toFixed(2)}m</output>
                    <ResettableLabel onReset={() => {
                      onMonsterEyeOffsetChange(
                        monsterType,
                        eye,
                        axis,
                        DEFAULT_MONSTER_EYES[monsterType][eye][axis]
                      )
                    }}>
                      {label}
                    </ResettableLabel>
                    <input
                      aria-label={label}
                      onChange={(event) => {
                        onMonsterEyeOffsetChange(monsterType, eye, axis, Number(event.target.value))
                      }}
                      step={0.01}
                      min={-4}
                      max={4}
                      type="number"
                      value={value}
                    />
                  </label>
                )
                })
              )
            ]
          )}
        </>
      ) : null}

      {activeTab === 'performance' ? (
        <>
          <div className="visual-control-row">
            <output>{performanceCapturePending ? 'running' : 'ready'}</output>
            <span>Frame Profile</span>
            <button
              disabled={performanceCapturePending}
              onClick={capturePerformanceReport}
              type="button"
            >
              Capture
            </button>
          </div>
          <pre className="visual-performance-report">{performanceReport}</pre>
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

function getMusicTrackForLevelId(levelId: string | null) {
  if (!levelId) {
    return null
  }

  if (levelId === 'entrance' || levelId.startsWith('chamber-')) {
    return MUSIC_TRACK_URLS.chamber
  }

  if (levelId.startsWith('hallway-')) {
    return MUSIC_TRACK_URLS.hallway
  }

  if (levelId.startsWith('throne-')) {
    return MUSIC_TRACK_URLS.throne
  }

  return MUSIC_TRACK_URLS.maze
}

type SfxLoopHandle = {
  gain: GainNode
  panner: StereoPannerNode | null
  source: AudioBufferSourceNode
}

const sfxRuntime = {
  buffers: new Map<SfxKey, AudioBuffer>(),
  context: null as AudioContext | null,
  loading: new Map<SfxKey, Promise<AudioBuffer | null>>(),
  loops: new Map<SfxKey, SfxLoopHandle>()
}

function getSfxContext() {
  if (!sfxRuntime.context) {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextCtor) {
      return null
    }

    sfxRuntime.context = new AudioContextCtor()
  }

  return sfxRuntime.context
}

function ensureSfxBuffer(key: SfxKey) {
  const existing = sfxRuntime.buffers.get(key)

  if (existing) {
    return Promise.resolve(existing)
  }

  const pending = sfxRuntime.loading.get(key)

  if (pending) {
    return pending
  }

  const context = getSfxContext()

  if (!context) {
    return Promise.resolve(null)
  }

  const promise = fetch(SFX_URLS[key])
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
    .then((buffer) => {
      sfxRuntime.buffers.set(key, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => {
      sfxRuntime.loading.delete(key)
    })

  sfxRuntime.loading.set(key, promise)
  return promise
}

function getSfxVolume(settings: AudioSettings, key: SfxKey, baseVolume = 1) {
  if (!settings.soundEnabled) {
    return 0
  }

  return MathUtils.clamp(
    settings.soundVolume * (settings.sfxVolumes[key] ?? 1) * baseVolume,
    0,
    1
  )
}

function warmSfxLibrary() {
  for (const key of Object.keys(SFX_URLS) as SfxKey[]) {
    void ensureSfxBuffer(key)
  }
}

function playSfx(
  key: SfxKey,
  settings: AudioSettings,
  options: { pan?: number; volume?: number } = {}
) {
  const context = getSfxContext()
  const buffer = sfxRuntime.buffers.get(key)
  const volume = getSfxVolume(settings, key, options.volume ?? 1)

  if (!context || !buffer || volume <= 0) {
    void ensureSfxBuffer(key)
    return
  }

  if (context.state === 'suspended') {
    void context.resume()
  }

  const source = context.createBufferSource()
  const gain = context.createGain()
  const panner = typeof context.createStereoPanner === 'function'
    ? context.createStereoPanner()
    : null

  source.buffer = buffer
  gain.gain.value = volume
  if (panner) {
    panner.pan.value = MathUtils.clamp(options.pan ?? 0, -1, 1)
    source.connect(gain).connect(panner).connect(context.destination)
  } else {
    source.connect(gain).connect(context.destination)
  }
  source.start()
}

function setSfxLoop(
  key: SfxKey,
  settings: AudioSettings,
  active: boolean,
  options: { pan?: number; volume?: number } = {}
) {
  const context = getSfxContext()
  const current = sfxRuntime.loops.get(key)
  const targetVolume = active ? getSfxVolume(settings, key, options.volume ?? 1) : 0

  if (!context) {
    return
  }

  if (!active || targetVolume <= 0) {
    if (current) {
      current.gain.gain.cancelScheduledValues(context.currentTime)
      current.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.25)
      window.setTimeout(() => {
        try {
          current.source.stop()
        } catch {
          // Already stopped.
        }
      }, 260)
      sfxRuntime.loops.delete(key)
    }
    return
  }

  const buffer = sfxRuntime.buffers.get(key)

  if (!buffer) {
    void ensureSfxBuffer(key)
    return
  }

  if (context.state === 'suspended') {
    void context.resume()
  }

  const handle = current ?? (() => {
    const source = context.createBufferSource()
    const gain = context.createGain()
    const panner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null

    source.buffer = buffer
    source.loop = true
    gain.gain.value = 0
    if (panner) {
      source.connect(gain).connect(panner).connect(context.destination)
    } else {
      source.connect(gain).connect(context.destination)
    }
    source.start()

    const nextHandle = { gain, panner, source }
    sfxRuntime.loops.set(key, nextHandle)
    return nextHandle
  })()

  handle.gain.gain.cancelScheduledValues(context.currentTime)
  handle.gain.gain.linearRampToValueAtTime(targetVolume, context.currentTime + 0.25)
  if (handle.panner) {
    handle.panner.pan.value = MathUtils.clamp(options.pan ?? 0, -1, 1)
  }
}

function stopAllSfxLoops() {
  for (const [key, handle] of sfxRuntime.loops) {
    try {
      handle.source.stop()
    } catch {
      // Already stopped.
    }
    sfxRuntime.loops.delete(key)
  }
}

function getCameraRelativePan(camera: ThreeCamera, position: Vector3) {
  const local = position.clone().sub(camera.position)
  const inverse = camera.quaternion.clone().invert()

  local.applyQuaternion(inverse)
  return MathUtils.clamp(local.x / Math.max(1, Math.abs(local.z), local.length()), -1, 1)
}

function getMonsterShakeMultiplier(type: TurnMonster['type']) {
  return type === 'minotaur' ? 2 : type === 'werewolf' ? 1.5 : 1
}

function getShakeVolumeFromDistance(distanceCells: number, multiplier = 1) {
  const baseAmplitude = MathUtils.clamp(
    0.24 / Math.max(distanceCells + 0.5, 1),
    0.012,
    0.06
  )

  return MathUtils.clamp((baseAmplitude * multiplier) / 0.12, 0, 1)
}

function SceneSfxRuntime({
  activatedAltarIds,
  audioSettings,
  layout,
  renderedLayouts,
  turnState
}: {
  activatedAltarIds: Set<string>
  audioSettings: AudioSettings
  layout: MazeLayout
  renderedLayouts: MazeLayout[]
  turnState: TurnState
}) {
  const camera = useThree((state) => state.camera)
  const settingsRef = useRef(audioSettings)
  const probePosition = useMemo(() => new Vector3(), [])

  useEffect(() => {
    settingsRef.current = audioSettings
  }, [audioSettings])

  useFrame(() => {
    let bestBeastVolume = 0
    let bestBeastPan = 0
    let bestSpiderVolume = 0
    let bestSpiderPan = 0

    for (const monster of turnState.monsters) {
      const distanceCells = getScreenShakePathDistance(
        layout.maze,
        monster.cell,
        turnState.player.cell
      )
      const volume = getShakeVolumeFromDistance(
        distanceCells,
        getMonsterShakeMultiplier(monster.type)
      )

      if (volume <= 0) {
        continue
      }

      const monsterWorldPosition = getTransformedMazeCellWorldPosition(
        layout.maze,
        getRuntimeLevelWorldTransform(layout.maze.id),
        monster.cell,
        GROUND_Y + PLAYER_EYE_HEIGHT * 0.5
      )
      const pan = getCameraRelativePan(camera, monsterWorldPosition)

      if (monster.type === 'spider') {
        if (volume > bestSpiderVolume) {
          bestSpiderVolume = volume
          bestSpiderPan = pan
        }
      } else if (volume > bestBeastVolume) {
        bestBeastVolume = volume
        bestBeastPan = pan
      }
    }

    setSfxLoop('beastProximityLoop', settingsRef.current, bestBeastVolume > 0.01, {
      pan: bestBeastPan,
      volume: bestBeastVolume
    })
    setSfxLoop('spiderProximityLoop', settingsRef.current, bestSpiderVolume > 0.01, {
      pan: bestSpiderPan,
      volume: bestSpiderVolume
    })

    let bestFireVolume = 0
    let bestFirePan = 0

    for (const renderedLayout of renderedLayouts) {
      const transform = getRuntimeLevelWorldTransform(renderedLayout.maze.id)

      for (const light of renderedLayout.lights ?? []) {
        const lightPosition = transformLevelLocalPositionToWorld(
          light.torchPosition,
          transform,
          probePosition
        )
        const distanceCells = lightPosition.distanceTo(camera.position) / MAZE_CELL_SIZE
        const volume = MathUtils.clamp(1 / Math.max(1, distanceCells + 0.25), 0, 1)

        if (volume > bestFireVolume) {
          bestFireVolume = volume
          bestFirePan = getCameraRelativePan(camera, lightPosition)
        }
      }

      for (const altar of renderedLayout.altars ?? []) {
        if (!activatedAltarIds.has(altar.id)) {
          continue
        }

        const altarPosition = transformLevelLocalPositionToWorld(
          altar.position,
          transform,
          probePosition
        )
        const distanceCells = altarPosition.distanceTo(camera.position) / MAZE_CELL_SIZE
        const volume = MathUtils.clamp(2 / Math.max(1, distanceCells + 0.25), 0, 1)

        if (volume > bestFireVolume) {
          bestFireVolume = volume
          bestFirePan = getCameraRelativePan(camera, altarPosition)
        }
      }
    }

    setSfxLoop('torchFireLoop', settingsRef.current, bestFireVolume > 0.01, {
      pan: bestFirePan,
      volume: bestFireVolume
    })
  })

  useEffect(() => () => {
    setSfxLoop('beastProximityLoop', settingsRef.current, false)
    setSfxLoop('spiderProximityLoop', settingsRef.current, false)
    setSfxLoop('torchFireLoop', settingsRef.current, false)
  }, [])

  return null
}

function MusicManager({
  enabled,
  levelId,
  settings
}: {
  enabled: boolean
  levelId: string | null
  settings: AudioSettings
}) {
  const audioByUrl = useRef(new Map<string, HTMLAudioElement>())
  const fadeAnimationFrame = useRef(0)
  const pendingPlayback = useRef(new Set<HTMLAudioElement>())
  const [libraryReady, setLibraryReady] = useState(false)

  useEffect(() => {
    const tryResumePendingPlayback = () => {
      for (const audio of pendingPlayback.current) {
        void audio.play()
          .then(() => pendingPlayback.current.delete(audio))
          .catch(() => {
            // Autoplay may stay blocked until the next user gesture.
          })
      }
    }

    window.addEventListener('keydown', tryResumePendingPlayback)
    window.addEventListener('pointerdown', tryResumePendingPlayback)

    return () => {
      window.removeEventListener('keydown', tryResumePendingPlayback)
      window.removeEventListener('pointerdown', tryResumePendingPlayback)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !settings.musicEnabled || libraryReady) {
      return undefined
    }

    let cancelled = false
    const startHandle = window.setTimeout(() => {
      const loadTrack = (url: string) => new Promise<void>((resolve) => {
        let audio = audioByUrl.current.get(url)

        if (!audio) {
          audio = new Audio()
          audio.loop = true
          audio.preload = 'auto'
          audio.volume = 0
          audioByUrl.current.set(url, audio)
        }

        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          resolve()
          return
        }

        const finish = () => {
          audio?.removeEventListener('canplaythrough', finish)
          audio?.removeEventListener('error', finish)
          resolve()
        }

        audio.addEventListener('canplaythrough', finish, { once: true })
        audio.addEventListener('error', finish, { once: true })
        audio.src = url
        audio.load()
      })

      void Promise.all(Object.values(MUSIC_TRACK_URLS).map(loadTrack))
        .then(() => {
          if (!cancelled) {
            setLibraryReady(true)
          }
        })
    }, LOADING_FADE_DURATION_MS)

    return () => {
      cancelled = true
      window.clearTimeout(startHandle)
    }
  }, [enabled, libraryReady, settings.musicEnabled])

  useEffect(() => {
    if (!enabled || !libraryReady) {
      return undefined
    }

    const targetTrack = settings.musicEnabled
      ? getMusicTrackForLevelId(levelId)
      : null
    const allTrackUrls = Object.values(MUSIC_TRACK_URLS)
    const startedAt = performance.now()
    const fadePlans = allTrackUrls.map((url) => {
      let audio = audioByUrl.current.get(url)

      if (!audio) {
        return null
      }

      if (!audio.src) {
        return null
      }

      if (!audio.loop) {
        audio.loop = true
      }

      const isTarget = url === targetTrack
      const targetVolume = isTarget ? MathUtils.clamp(settings.musicVolume, 0, 1) : 0
      const durationMs = isTarget ? 4000 : 8000

      if (targetVolume > 0 && audio.paused) {
        void audio.play()
          .then(() => pendingPlayback.current.delete(audio))
          .catch(() => pendingPlayback.current.add(audio))
      }

      return {
        audio,
        durationMs,
        fromVolume: audio.volume,
        targetVolume
      }
    }).filter((plan): plan is {
      audio: HTMLAudioElement
      durationMs: number
      fromVolume: number
      targetVolume: number
    } => Boolean(plan))

    window.cancelAnimationFrame(fadeAnimationFrame.current)

    const animate = () => {
      const elapsed = performance.now() - startedAt
      let active = false

      for (const plan of fadePlans) {
        const progress = plan.durationMs <= 0
          ? 1
          : MathUtils.clamp(elapsed / plan.durationMs, 0, 1)
        const nextVolume = MathUtils.lerp(plan.fromVolume, plan.targetVolume, progress)

        plan.audio.volume = MathUtils.clamp(nextVolume, 0, 1)

        if (progress < 1) {
          active = true
        } else if (plan.targetVolume <= 0 && !plan.audio.paused) {
          plan.audio.pause()
        }
      }

      if (active) {
        fadeAnimationFrame.current = window.requestAnimationFrame(animate)
      }
    }

    animate()

    return () => {
      window.cancelAnimationFrame(fadeAnimationFrame.current)
    }
  }, [enabled, levelId, libraryReady, settings.musicEnabled, settings.musicVolume])

  useEffect(
    () => () => {
      window.cancelAnimationFrame(fadeAnimationFrame.current)
      for (const audio of audioByUrl.current.values()) {
        audio.pause()
      }
    },
    []
  )

  return null
}

function SfxLibraryManager({
  enabled,
  settings
}: {
  enabled: boolean
  settings: AudioSettings
}) {
  useEffect(() => {
    if (!enabled || !settings.soundEnabled) {
      stopAllSfxLoops()
      return undefined
    }

    const handle = window.setTimeout(warmSfxLibrary, LOADING_FADE_DURATION_MS)

    return () => {
      window.clearTimeout(handle)
    }
  }, [enabled, settings.soundEnabled])

  useEffect(() => {
    if (!settings.soundEnabled) {
      stopAllSfxLoops()
    }
  }, [settings.soundEnabled])

  return null
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
          "Pale Dread White Werewolf" (<a href="https://skfb.ly/pFroV">https://skfb.ly/pFroV</a>) by Pigcraft is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
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
        <p>
          "Priest's Throne" (<a href="https://skfb.ly/QH8R">https://skfb.ly/QH8R</a>) by cachgill is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "Droop cup 4th century BC" (<a href="https://skfb.ly/oyB9X">https://skfb.ly/oyB9X</a>) by The Hunt Museum is licensed under Creative Commons Attribution (<a href="http://creativecommons.org/licenses/by/4.0/">http://creativecommons.org/licenses/by/4.0/</a>).
        </p>
        <p>
          "Metal Rust" texture pack (<a href="https://www.sharetextures.com/textures/metal/metal-rust">https://www.sharetextures.com/textures/metal/metal-rust</a>) by ShareTextures is used under the ShareTextures license.
        </p>
        <p>
          "Qwantani Moon Noon Puresky" (<a href="https://polyhaven.com/a/qwantani_moon_noon_puresky">https://polyhaven.com/a/qwantani_moon_noon_puresky</a>) by Poly Haven is licensed under CC0.
        </p>
        <p>
          "Timebender (Creepy Ambient Space)" (<a href="https://opengameart.org/content/timebender-creepy-ambient-space">https://opengameart.org/content/timebender-creepy-ambient-space</a>) by MouthlessGames / Christian DeTamble is licensed under CC-BY 3.0.
        </p>
        <p>
          "Radakan - Mist Forest" (<a href="https://opengameart.org/content/radakan-mist-forest">https://opengameart.org/content/radakan-mist-forest</a>) by Janne Hanhisuanto for Radakan is licensed under CC-BY-SA 3.0.
        </p>
        <p>
          "Mystery Manor" (<a href="https://opengameart.org/content/mystery-manor">https://opengameart.org/content/mystery-manor</a>) by Alexandr Zhelanov is licensed under CC-BY 3.0.
        </p>
        <p>
          "(Dark) The Whispering Shadows Dungeon" (<a href="https://opengameart.org/content/dark-the-whispering-shadows-dungeon">https://opengameart.org/content/dark-the-whispering-shadows-dungeon</a>) by Clement Panchout is licensed under CC-BY 4.0.
        </p>
        <p>
          "Stone Guardian" (<a href="https://opengameart.org/content/stone-guardian">https://opengameart.org/content/stone-guardian</a>) by Ronhul Maggot is licensed under CC-BY 4.0.
        </p>
        <p>
          "Big Monster Stomp" (<a href="https://freesound.org/people/Yoyamen1212/sounds/812538/">https://freesound.org/people/Yoyamen1212/sounds/812538/</a>) by Yoyamen1212 is licensed under CC0.
        </p>
        <p>
          "WetFootsteps.wav" (<a href="https://freesound.org/people/sqeeeek/sounds/326543/">https://freesound.org/people/sqeeeek/sounds/326543/</a>) by sqeeeek is licensed under CC0.
        </p>
        <p>
          "Spider monster screech" (<a href="https://freesound.org/people/Patrick_Corra/sounds/540050/">https://freesound.org/people/Patrick_Corra/sounds/540050/</a>) by Patrick_Corra is licensed under Creative Commons Attribution-NonCommercial 4.0.
        </p>
        <p>
          "Beetle Squark5.wav" (<a href="https://freesound.org/people/warrenXG/sounds/502211/">https://freesound.org/people/warrenXG/sounds/502211/</a>) by warrenXG is licensed under CC0.
        </p>
        <p>
          "Jumpscare type roar.mp3" (<a href="https://freesound.org/people/Ritorex24/sounds/578958/">https://freesound.org/people/Ritorex24/sounds/578958/</a>) by Ritorex24 is licensed under CC0.
        </p>
        <p>
          "dyingBeast" (<a href="https://freesound.org/people/QuantumFellow/sounds/734841/">https://freesound.org/people/QuantumFellow/sounds/734841/</a>) by QuantumFellow is licensed under CC0.
        </p>
        <p>
          "SFX - Dragon Low Growls Breathing.wav" (<a href="https://freesound.org/people/Karma-Ron/sounds/486596/">https://freesound.org/people/Karma-Ron/sounds/486596/</a>) by Karma-Ron is licensed under CC0.
        </p>
        <p>
          "Insect in a tree" (<a href="https://freesound.org/people/jymdavis/sounds/197329/">https://freesound.org/people/jymdavis/sounds/197329/</a>) by jymdavis is licensed under CC0.
        </p>
        <p>
          "Staple release from paper" (<a href="https://freesound.org/people/redpanda69/sounds/686187/">https://freesound.org/people/redpanda69/sounds/686187/</a>) by redpanda69 is licensed under CC0.
        </p>
        <p>
          "fire_small_loop.wav" (<a href="https://freesound.org/people/PhreaKsAccount/sounds/46273/">https://freesound.org/people/PhreaKsAccount/sounds/46273/</a>) by PhreaKsAccount is licensed under Creative Commons Attribution 3.0.
        </p>
        <small>Press any key to close.</small>
      </div>
    </div>
  )
}

function LevelMenuModal({
  audioSettings,
  challengeLevels,
  levels,
  onAudioSettingChange,
  onAmbientOcclusionModeChange,
  onBooleanSettingChange,
  onClose,
  onEffectSettingChange,
  onOpenCredits,
  onReplaySolution,
  onResetLevel,
  onSelectLevel,
  open,
  replayAvailable,
  visualSettings
}: {
  audioSettings: AudioSettings
  challengeLevels: Array<AuthoredLevel & { runtimeLevelId: string }>
  levels: AuthoredLevel[]
  onAudioSettingChange: (patch: Partial<AudioSettings>) => void
  onAmbientOcclusionModeChange: (mode: AmbientOcclusionMode) => void
  onBooleanSettingChange: (key: BooleanSettingKey, value: boolean) => void
  onClose: () => void
  onEffectSettingChange: (
    key: GenericEffectSettingKey,
    patch: Partial<EffectSettings>
  ) => void
  onOpenCredits: () => void
  onReplaySolution: () => void
  onResetLevel: () => void
  onSelectLevel: (level: AuthoredLevel, index: number) => void
  open: boolean
  replayAvailable: boolean
  visualSettings: VisualSettings
}) {
  const [activeTab, setActiveTab] = useState<'graphics' | 'audio' | 'gameplay' | 'cheat'>('graphics')

  if (!open) {
    return null
  }

  return (
    <div className="level-menu-modal" role="dialog" aria-modal="true" aria-label="Level Menu">
      <div className="level-menu-panel">
        <div className="level-menu-header">
          <h2>Menu</h2>
          <button
            aria-label="Close Menu"
            className="level-menu-close"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="level-menu-tabs" role="tablist" aria-label="Menu sections">
          <button
            aria-selected={activeTab === 'graphics'}
            className={`level-menu-tab${activeTab === 'graphics' ? ' level-menu-tab-active' : ''}`}
            onClick={() => setActiveTab('graphics')}
            role="tab"
            type="button"
          >
            Graphics
          </button>
          <button
            aria-selected={activeTab === 'audio'}
            className={`level-menu-tab${activeTab === 'audio' ? ' level-menu-tab-active' : ''}`}
            onClick={() => setActiveTab('audio')}
            role="tab"
            type="button"
          >
            Audio
          </button>
          <button
            aria-selected={activeTab === 'gameplay'}
            className={`level-menu-tab${activeTab === 'gameplay' ? ' level-menu-tab-active' : ''}`}
            onClick={() => setActiveTab('gameplay')}
            role="tab"
            type="button"
          >
            Gameplay
          </button>
          <button
            aria-selected={activeTab === 'cheat'}
            className={`level-menu-tab${activeTab === 'cheat' ? ' level-menu-tab-active' : ''}`}
            onClick={() => setActiveTab('cheat')}
            role="tab"
            type="button"
          >
            Cheat
          </button>
          <button
            aria-selected={false}
            className="level-menu-tab"
            onClick={onOpenCredits}
            role="tab"
            type="button"
          >
            Credits
          </button>
        </div>
        {activeTab === 'graphics' ? (
          <div className="level-menu-settings" role="tabpanel">
            <label className="level-menu-setting">
              <span>Lighting</span>
              <input
                checked={!visualSettings.unlitMode}
                onChange={(event) => {
                  onBooleanSettingChange('unlitMode', !event.target.checked)
                }}
                type="checkbox"
              />
            </label>
            <label className="level-menu-setting">
              <span>Fog</span>
              <input
                checked={visualSettings.volumetricLighting.enabled}
                onChange={(event) => {
                  onEffectSettingChange('volumetricLighting', {
                    enabled: event.target.checked
                  })
                }}
                type="checkbox"
              />
            </label>
            <label className="level-menu-setting">
              <span>Ambient Occlusion</span>
              <input
                checked={visualSettings.ambientOcclusionMode !== 'off'}
                onChange={(event) => {
                  onAmbientOcclusionModeChange(event.target.checked ? 'n8ao' : 'off')
                }}
                type="checkbox"
              />
            </label>
          </div>
        ) : activeTab === 'audio' ? (
          <div className="level-menu-settings" role="tabpanel">
            <div className="level-menu-setting">
              <span>Music</span>
              <label>
                <input
                  checked={audioSettings.musicEnabled}
                  name="music-enabled"
                  onChange={() => onAudioSettingChange({ musicEnabled: true })}
                  type="radio"
                />
                On
              </label>
              <label>
                <input
                  checked={!audioSettings.musicEnabled}
                  name="music-enabled"
                  onChange={() => onAudioSettingChange({ musicEnabled: false })}
                  type="radio"
                />
                Off
              </label>
            </div>
            <label className="level-menu-setting">
              <span>Music Volume</span>
              <input
                aria-label="Music Volume"
                max={1}
                min={0}
                onChange={(event) => onAudioSettingChange({ musicVolume: Number(event.target.value) })}
                step={0.01}
                type="range"
                value={audioSettings.musicVolume}
              />
            </label>
            <div className="level-menu-setting">
              <span>Sound Effects</span>
              <label>
                <input
                  checked={audioSettings.soundEnabled}
                  name="sound-enabled"
                  onChange={() => onAudioSettingChange({ soundEnabled: true })}
                  type="radio"
                />
                On
              </label>
              <label>
                <input
                  checked={!audioSettings.soundEnabled}
                  name="sound-enabled"
                  onChange={() => onAudioSettingChange({ soundEnabled: false })}
                  type="radio"
                />
                Off
              </label>
            </div>
            <label className="level-menu-setting">
              <span>SFX Volume</span>
              <input
                aria-label="Sound Effects Volume"
                max={1}
                min={0}
                onChange={(event) => onAudioSettingChange({ soundVolume: Number(event.target.value) })}
                step={0.01}
                type="range"
                value={audioSettings.soundVolume}
              />
            </label>
          </div>
        ) : activeTab === 'gameplay' ? (
          <div className="level-menu-list" role="tabpanel">
            <div className="level-menu-actions">
              <button
                className="level-menu-button level-menu-action-button"
                onClick={onResetLevel}
                type="button"
              >
                <span>Reset</span>
                <small>Return this level to its starting state.</small>
              </button>
              {replayAvailable ? (
                <button
                  className="level-menu-button level-menu-action-button"
                  onClick={onReplaySolution}
                  type="button"
                >
                  <span>Show Solution</span>
                  <small>Replay the recorded solution for this level.</small>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="level-menu-list" role="tabpanel">
            {levels.map((level, index) => (
              <button
                className="level-menu-button"
                key={`${level.name}:${index}`}
                onClick={() => onSelectLevel(level, index)}
                type="button"
              >
                <span>{level.name}</span>
                {level.description ? <small>{level.description}</small> : null}
              </button>
            ))}
            {challengeLevels.length > 0 ? (
              <div className="level-menu-section-label">Challenge Mazes</div>
            ) : null}
            {challengeLevels.map((level, index) => (
              <button
                className="level-menu-button"
                key={level.runtimeLevelId}
                onClick={() => onSelectLevel(level, levels.length + index)}
                type="button"
              >
                <span>{level.name}</span>
                {level.description ? <small>{level.description}</small> : null}
              </button>
            ))}
          </div>
        )}
        <small>Press Escape to close.</small>
      </div>
    </div>
  )
}

function MobileTouchControls({
  onOpenMenu
}: {
  onOpenMenu: () => void
}) {
  const touchStart = useRef<{
    action: TurnAction
    pointerId: number
    x: number
    y: number
  } | null>(null)
  const dispatchAction = (action: TurnAction) => {
    window.dispatchEvent(new CustomEvent<TurnAction>('levelsjam:turn-action', {
      detail: action
    }))
  }
  const onControlPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    action: TurnAction
  ) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    touchStart.current = {
      action,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    }
  }
  const onControlPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = touchStart.current

    if (!start || start.pointerId !== event.pointerId) {
      return
    }

    touchStart.current = null
    event.preventDefault()

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const swipeThreshold = 42

    if (Math.max(absX, absY) >= swipeThreshold) {
      if (absY > absX && deltaY < 0) {
        dispatchAction('move-forward')
        return
      }

      if (absX > absY) {
        dispatchAction(deltaX < 0 ? 'rotate-left' : 'rotate-right')
        return
      }
    }

    dispatchAction(start.action)
  }
  const onControlPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (touchStart.current?.pointerId === event.pointerId) {
      touchStart.current = null
    }
  }

  return (
    <div className="mobile-touch-controls" aria-label="Touch Controls">
      <button
        aria-label="Open Menu"
        className="mobile-menu-button"
        onClick={onOpenMenu}
        type="button"
      >
        &#9776;
      </button>
      <button
        aria-label="Turn Left"
        className="mobile-touch-zone mobile-touch-left"
        onPointerCancel={onControlPointerCancel}
        onPointerDown={(event) => onControlPointerDown(event, 'rotate-left')}
        onPointerUp={onControlPointerUp}
        type="button"
      >
        &#8592;
      </button>
      <button
        aria-label="Move Forward"
        className="mobile-touch-zone mobile-touch-forward"
        onPointerCancel={onControlPointerCancel}
        onPointerDown={(event) => onControlPointerDown(event, 'move-forward')}
        onPointerUp={onControlPointerUp}
        type="button"
      >
        &#8593;
      </button>
      <button
        aria-label="Turn Right"
        className="mobile-touch-zone mobile-touch-right"
        onPointerCancel={onControlPointerCancel}
        onPointerDown={(event) => onControlPointerDown(event, 'rotate-right')}
        onPointerUp={onControlPointerUp}
        type="button"
      >
        &#8594;
      </button>
    </div>
  )
}

function StartupChoiceOverlay({
  onContinue,
  onNewGame,
  resumeLevelId
}: {
  onContinue: () => void
  onNewGame: () => void
  resumeLevelId: string
}) {
  return (
    <div className="loading-overlay visible">
      <div className="startup-choice-panel">
        <img
          alt="MINOTAUR"
          className="loading-title-image"
          draggable={false}
          src={TITLE_IMAGE_URL}
        />
        <div className="startup-choice-actions" role="group" aria-label="Saved game choices">
          <button
            className="startup-choice-button"
            onClick={onContinue}
            type="button"
          >
            Continue
          </button>
          <button
            className="startup-choice-button"
            onClick={onNewGame}
            type="button"
          >
            New Game
          </button>
        </div>
        <small>Continue from {resumeLevelId} or start over at the Entrance.</small>
      </div>
    </div>
  )
}

function areCellsCardinallyAdjacent(
  left: { x: number; y: number },
  right: { x: number; y: number }
) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1
}

function directionFromCellToCell(
  from: { x: number; y: number },
  to: { x: number; y: number }
): CardinalDirection | null {
  if (from.x === to.x) {
    if (to.y < from.y) {
      return 'north'
    }
    if (to.y > from.y) {
      return 'south'
    }
  }

  if (from.y === to.y) {
    if (to.x > from.x) {
      return 'east'
    }
    if (to.x < from.x) {
      return 'west'
    }
  }

  return null
}

function isChallengeRuntimeLevelId(id: string | null | undefined) {
  return typeof id === 'string' && id.startsWith('challenge-')
}

function AltarCutsceneOverlay({
  active
}: {
  active: boolean
}) {
  return (
    <div className={`altar-cutscene${active ? ' altar-cutscene-active' : ''}`}>
      <div className="altar-cutscene-bar altar-cutscene-bar-top" />
      <div className="altar-cutscene-bar altar-cutscene-bar-bottom" />
    </div>
  )
}

export default function App() {
  const [controlsOpen, setControlsOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [levelMenuOpen, setLevelMenuOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [canvasBootstrapReady, setCanvasBootstrapReady] = useState(false)
  const availableMazeIdsRef = useRef<string[]>([])
  const loadedMazeLayoutsRef = useRef(new Map<string, MazeLayout>())
  const globalTurnStateRef = useRef<GlobalTurnState | null>(null)
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
  const startupSave = useMemo(() => {
    if (requestedMazeId) {
      return null
    }

    try {
      const save = readGameSave(window.localStorage)
      const lastLevelId = save?.lastLevelId ?? null
      const savedLevelId = (() => {
        return isChallengeRuntimeLevelId(lastLevelId) ? null : lastLevelId
      })()

      return savedLevelId ? save : null
    } catch {
      return null
    }
  }, [requestedMazeId])
  const startupResumeLevelId = useMemo(
    () => getLatestDirectedNonMazeLevelId(startupSave?.enteredLevelIds ?? []),
    [startupSave]
  )
  const [startupChoice, setStartupChoice] = useState<'pending' | 'new' | 'continue'>(() => {
    if (
      !requestedMazeId &&
      startupSave?.enteredLevelIds?.some((id) => id !== getDefaultRuntimeLevelId())
    ) {
      return 'pending'
    }

    return startupSave ? 'continue' : 'new'
  })
  const [instantiatedMazeId, setInstantiatedMazeId] = useState<string | null>(null)
  const [mazeLayout, setMazeLayout] = useState<MazeLayout | null>(null)
  const [globalTurnState, setGlobalTurnStateRaw] = useState<GlobalTurnState | null>(null)
  const [renderedMazeLayouts, setRenderedMazeLayouts] = useState<MazeLayout[]>([])
  const [mazeLoadError, setMazeLoadError] = useState<string | null>(null)
  const [replayActive, setReplayActive] = useState(false)
  const [replayRequestId, setReplayRequestId] = useState(0)
  const [replayRequestMazeId, setReplayRequestMazeId] = useState<string | null>(null)
  const [mazeSceneKey, setMazeSceneKey] = useState(0)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [visualSettings, setVisualSettings] = useState(createInitialVisualSettings)
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS)
  const handleAudioSettingChange = useCallback((patch: Partial<AudioSettings>) => {
    setAudioSettings((current) => ({
      ...current,
      ...patch,
      sfxVolumes: patch.sfxVolumes
        ? {
            ...current.sfxVolumes,
            ...patch.sfxVolumes
          }
        : current.sfxVolumes
    }))
  }, [])
  const [activatedAltarIds, setActivatedAltarIds] = useState<Set<string>>(() => {
    try {
      const save = readGameSave(window.localStorage)

      return new Set(save?.litAltars ?? [])
    } catch {
      return new Set()
    }
  })
  const [enteredLevelIds, setEnteredLevelIds] = useState<Set<string>>(
    () => new Set(startupSave?.enteredLevelIds ?? [])
  )
  const resetClosedMazeIdsRef = useRef(new Set<string>())
  const [altarCutscene, setAltarCutscene] = useState<{
    altarId: string
    levelId: string
    startedAt: number
  } | null>(null)
  const composerEnabled = true
  const authoredLevels = useMemo(() => parseLevelSpec(levelsMarkdown), [])
  const [challengeLevelEntries, setChallengeLevelEntries] = useState<
    Array<AuthoredLevel & { runtimeLevelId: string }>
  >([])

  useEffect(() => {
    document.getElementById('bootstrap-loading-shell')?.remove()
  }, [])

  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setCanvasBootstrapReady(true)
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [])

  useEffect(() => {
    document.body.dataset.levelMenuOpen = levelMenuOpen ? 'true' : 'false'

    return () => {
      delete document.body.dataset.levelMenuOpen
    }
  }, [levelMenuOpen])

  useEffect(() => {
    document.body.dataset.solutionReplayActive = replayActive ? 'true' : 'false'

    return () => {
      delete document.body.dataset.solutionReplayActive
    }
  }, [replayActive])

  useEffect(() => {
    void getAvailableMazeIds()
      .then((mazeIds) => {
        availableMazeIdsRef.current = mazeIds
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  useEffect(() => {
    void getRuntimeLevelMenuEntries()
      .then((entries) => {
        setChallengeLevelEntries(entries)
      })
      .catch((error) => {
        console.error(error)
      })
  }, [])

  const setGlobalTurnState = useCallback((
    value: GlobalTurnState | null | ((current: GlobalTurnState | null) => GlobalTurnState | null),
    options: { transition?: boolean } = {}
  ) => {
    const next = typeof value === 'function'
      ? (value as (current: GlobalTurnState | null) => GlobalTurnState | null)(globalTurnStateRef.current)
      : value

    globalTurnStateRef.current = next
    if (options.transition === false) {
      setGlobalTurnStateRaw(next)
      return
    }

    startTransition(() => {
      setGlobalTurnStateRaw(next)
    })
  }, [])

  useEffect(() => {
    if (!globalTurnState) {
      return
    }

    setEnteredLevelIds((current) => {
      const levelId = globalTurnState.activeLevelId ?? globalTurnState.player?.levelId

      if (!levelId || current.has(levelId)) {
        return current
      }

      const next = new Set(current)

      next.add(levelId)
      return next
    })
  }, [globalTurnState])

  useEffect(() => {
    if (!globalTurnState) {
      return
    }

    if (isChallengeRuntimeLevelId(globalTurnState.activeLevelId)) {
      return
    }

    try {
      writeGameSave(
        window.localStorage,
        createGameSave(globalTurnState, {
          activatedAltarIds,
          enteredLevelIds
        })
      )
    } catch {
      // Storage can be unavailable in hardened browser modes; gameplay continues without autosave.
    }
  }, [activatedAltarIds, enteredLevelIds, globalTurnState])

  useEffect(() => {
    if (!globalTurnStateRef.current || activatedAltarIds.size === 0) {
      return
    }

    const targetMazeIds = new Set<string>()

    for (const layout of loadedMazeLayoutsRef.current.values()) {
      for (const altar of layout.altars ?? []) {
        if (altar.targetLevelId && activatedAltarIds.has(altar.id)) {
          targetMazeIds.add(altar.targetLevelId)
        }
      }
    }

    const resettableTargets = [...targetMazeIds].filter((targetLevelId) => (
      targetLevelId !== globalTurnStateRef.current?.player.levelId &&
      !resetClosedMazeIdsRef.current.has(targetLevelId) &&
      loadedMazeLayoutsRef.current.has(targetLevelId)
    ))

    if (resettableTargets.length === 0) {
      return
    }

    setGlobalTurnState((current) => {
      if (!current) {
        return current
      }

      let next = current

      for (const targetLevelId of resettableTargets) {
        const targetLayout = loadedMazeLayoutsRef.current.get(targetLevelId)

        if (!targetLayout || targetLevelId === next.player.levelId) {
          continue
        }

        next = resetGlobalTurnStateLevel(next, targetLayout)
        resetClosedMazeIdsRef.current.add(targetLevelId)
      }

      return next
    })
  }, [activatedAltarIds, setGlobalTurnState])

  const getRenderedTurnState = useCallback((layout: MazeLayout) => {
    const currentGlobalState = globalTurnStateRef.current

    return currentGlobalState
      ? getGlobalTurnStateForLevel(currentGlobalState, layout.maze.id, layout.maze)
      : createInitialTurnState(layout.maze)
  }, [])

  const updateRenderedMazeLayouts = useCallback((centerMazeId: string | null) => {
    if (!centerMazeId) {
      setRenderedMazeLayouts([])
      return
    }

    const renderedIds = new Set([
      centerMazeId,
      ...getAdjacentRuntimeLevelIds(centerMazeId)
    ])

    setRenderedMazeLayouts(
      Array.from(renderedIds)
        .map((id) => loadedMazeLayoutsRef.current.get(id) ?? null)
        .filter((layout): layout is MazeLayout => Boolean(layout))
    )
  }, [])

  const loadRuntimeLevelLayouts = useCallback(async (mazeIds: string[]) => {
    const desiredMazeIds = Array.from(new Set(mazeIds))
    const loadedLayouts = await Promise.all(
      desiredMazeIds.map(async (desiredMazeId) => ({
        id: desiredMazeId,
        layout:
          loadedMazeLayoutsRef.current.get(desiredMazeId) ??
          await loadMazeLayoutById(desiredMazeId)
      }))
    )

    for (const entry of loadedLayouts) {
      if (!entry.layout) {
        continue
      }

      loadedMazeLayoutsRef.current.set(entry.id, entry.layout)
    }

    setGlobalTurnState((current) => current
      ? ensureGlobalTurnStateLevels(
          current,
          loadedLayouts
            .map((entry) => entry.layout)
            .filter((layout): layout is MazeLayout => Boolean(layout))
        )
      : current
    )
  }, [setGlobalTurnState])

  const loadLevelNeighborhood = useCallback(async (
    mazeId: string,
    options: { updateRendered?: boolean } = {}
  ) => {
    await loadRuntimeLevelLayouts([
      mazeId,
      ...getAdjacentRuntimeLevelIds(mazeId)
    ])

    if (options.updateRendered !== false) {
      updateRenderedMazeLayouts(mazeId)
    }
  }, [loadRuntimeLevelLayouts, updateRenderedMazeLayouts])

  const preloadAdjacentTransitionNeighborhoods = useCallback(async (mazeId: string) => {
    const preloadIds = new Set<string>()

    for (const adjacentId of getAdjacentRuntimeLevelIds(mazeId)) {
      preloadIds.add(adjacentId)
      for (const nextAdjacentId of getAdjacentRuntimeLevelIds(adjacentId)) {
        preloadIds.add(nextAdjacentId)
      }
    }

    await loadRuntimeLevelLayouts([...preloadIds])
    updateRenderedMazeLayouts(mazeId)
  }, [loadRuntimeLevelLayouts, updateRenderedMazeLayouts])

  const getRuleWorldLayoutsForInstantiation = useCallback((layout: MazeLayout) => {
    if (isChallengeRuntimeLevelId(layout.maze.id)) {
      return [layout]
    }

    return Array.from(loadedMazeLayoutsRef.current.values())
      .filter((candidate) => !isChallengeRuntimeLevelId(candidate.maze.id))
  }, [])

  const instantiateLoadedMaze = (
    mazeId: string,
    options: { reset?: boolean } = {}
  ) => {
    const nextLayout = loadedMazeLayoutsRef.current.get(mazeId)

    if (!nextLayout) {
      throw new Error(`Maze data "${mazeId}" has not been loaded`)
    }

    setReplayActive(false)
    setSceneLoaded(false)
    setMazeLoadError(null)
    setInstantiatedMazeId(mazeId)
    setMazeSceneKey((current) => current + 1)
    setGlobalTurnState((current) => {
      const ruleWorldLayouts = getRuleWorldLayoutsForInstantiation(nextLayout)
      const resetRuleWorld =
        options.reset ||
        isChallengeRuntimeLevelId(mazeId) ||
        isChallengeRuntimeLevelId(current?.activeLevelId)

      if (resetRuleWorld) {
        return createEnteredGlobalTurnState(
          nextLayout,
          ruleWorldLayouts
        )
      }

      const nextState = current
        ? activateGlobalTurnStateLevel(current, nextLayout)
        : createInitialGlobalTurnState(nextLayout, ruleWorldLayouts)

      return nextState
    }, { transition: false })
    document.body.dataset.loadedMazeId = mazeId
    updateRenderedMazeLayouts(mazeId)
    setMazeLayout(nextLayout)
  }

  const uninstantiateMaze = () => {
    setReplayActive(false)
    setSceneLoaded(false)
    setInstantiatedMazeId(null)
    setMazeLayout(null)
    setGlobalTurnState(null)
    updateRenderedMazeLayouts(null)
  }

  const resetInstantiatedMaze = () => {
    if (!mazeLayout) {
      return
    }

    setReplayActive(false)
    setSceneLoaded(false)
    setGlobalTurnState(
      () => createEnteredGlobalTurnState(
        mazeLayout,
        getRuleWorldLayoutsForInstantiation(mazeLayout)
      ),
      { transition: false }
    )
    setMazeSceneKey((current) => current + 1)
  }

  const startCurrentSolutionReplay = () => {
    if (!mazeLayout?.maze.solution?.actions?.length) {
      return
    }

    setReplayRequestMazeId(mazeLayout.maze.id)
    setReplayRequestId((current) => current + 1)
  }

  const handleNewGameChoice = () => {
    try {
      clearGameSave(window.localStorage)
    } catch {
      // Storage can be unavailable in hardened browser modes; new game still starts in memory.
    }

    loadedMazeLayoutsRef.current.clear()
    setActivatedAltarIds(new Set())
    setEnteredLevelIds(new Set())
    setGlobalTurnState(null, { transition: false })
    setMazeLayout(null)
    setInstantiatedMazeId(null)
    setRenderedMazeLayouts([])
    setStartupChoice('new')
  }

  const handleContinueChoice = () => {
    setStartupChoice('continue')
  }

  const handleLevelTransition = useCallback(async (request: SeamlessLevelTransitionRequest) => {
    setReplayActive(false)
    setMazeLoadError(null)
    if (request.sourceState.player.hasTrophy) {
      trackAnalyticsEvent('maze_completed', {
        source_level_id: request.sourceLevelId,
        target_level_id: request.targetLevelId
      })
    }

    try {
      await loadLevelNeighborhood(request.targetLevelId, { updateRendered: false })
      const targetLayout =
        loadedMazeLayoutsRef.current.get(request.targetLevelId) ??
        await loadMazeLayoutById(request.targetLevelId)

      if (!targetLayout) {
        throw new Error(`Target level "${request.targetLevelId}" could not be loaded`)
      }

      loadedMazeLayoutsRef.current.set(request.targetLevelId, targetLayout)
      setGlobalTurnState((current) => {
        const committedState = request.committedGlobalState

        if (committedState) {
          return activateGlobalTurnStateLevel(
            ensureGlobalTurnStateLevel(committedState, targetLayout),
            targetLayout
          )
        }

        return transitionGlobalTurnState({
          sourceLevelId: request.sourceLevelId,
          sourceLayout: loadedMazeLayoutsRef.current.get(request.sourceLevelId),
          sourcePreviousState: request.sourcePreviousState,
          sourceState: request.sourceState,
          state: current ?? createInitialGlobalTurnState(targetLayout, Array.from(loadedMazeLayoutsRef.current.values())),
          targetLayout
        })
      })
      setInstantiatedMazeId(request.targetLevelId)
      setMazeLayout(targetLayout)
      document.body.dataset.loadedMazeId = request.targetLevelId
      updateRenderedMazeLayouts(request.targetLevelId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setMazeLoadError(message)
    }
  }, [loadLevelNeighborhood, setGlobalTurnState, updateRenderedMazeLayouts])

  useEffect(() => {
    if (!instantiatedMazeId) {
      return undefined
    }

    let cancelled = false
    const handle = window.setTimeout(() => {
      document.body.dataset.levelPreloadStartedAt = performance.now().toFixed(1)
      void preloadAdjacentTransitionNeighborhoods(instantiatedMazeId)
        .then(() => {
          if (!cancelled) {
            document.body.dataset.levelPreloadCompleteAt = performance.now().toFixed(1)
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error(error)
          }
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [instantiatedMazeId, preloadAdjacentTransitionNeighborhoods])

  const handleTurnStateChange = useCallback((
    mazeId: string,
    value: TurnState | ((current: TurnState) => TurnState)
  ) => {
    setGlobalTurnState((current) => {
      const layout = loadedMazeLayoutsRef.current.get(mazeId)

      if (!layout) {
        return current
      }

      const ensuredState = current
        ? ensureGlobalTurnStateLevel(current, layout)
        : createInitialGlobalTurnState(layout, Array.from(loadedMazeLayoutsRef.current.values()))
      const currentTurnState = getGlobalTurnStateForLevel(
        ensuredState,
        mazeId,
        layout.maze
      )
      const nextTurnState = typeof value === 'function'
        ? (value as (current: TurnState) => TurnState)(currentTurnState)
        : value

      return replaceGlobalTurnStateForLevel(ensuredState, mazeId, nextTurnState)
    })
  }, [setGlobalTurnState])

  const commitGlobalTurnState = useCallback((state: GlobalTurnState) => {
    setGlobalTurnState(state)
  }, [setGlobalTurnState])

  const handleTurnActionForLevel = useCallback((mazeId: string, action: TurnAction) => {
    const layout = loadedMazeLayoutsRef.current.get(mazeId)

    if (!layout) {
      return null
    }

    const currentState = globalTurnStateRef.current
    const ensuredState = currentState
      ? ensureGlobalTurnStateLevel(currentState, layout)
      : createInitialGlobalTurnState(layout, Array.from(loadedMazeLayoutsRef.current.values()))

    return applyGlobalTurnActionForLevel(ensuredState, mazeId, layout.maze, action)
  }, [])

  const loadAndActivateLevel = async (level: AuthoredLevel, index: number) => {
    const mazeIds = availableMazeIdsRef.current.length > 0
      ? availableMazeIdsRef.current
      : await getAvailableMazeIds()

    availableMazeIdsRef.current = mazeIds

    const explicitRuntimeLevelId =
      'runtimeLevelId' in level && typeof level.runtimeLevelId === 'string'
        ? level.runtimeLevelId
        : null
    const mazeId = explicitRuntimeLevelId ?? resolveRuntimeMazeIdForLevel(
      level.name,
      index,
      mazeIds,
      instantiatedMazeId ?? mazeLayout?.maze.id ?? null
    )

    if (!mazeId) {
      setMazeLoadError(`No runtime maze is available for level "${level.name}"`)
      return
    }

    setLevelMenuOpen(false)
    setReplayActive(false)
    setSceneLoaded(false)
    setMazeLoadError(null)
    document.body.dataset.selectedLevelName = level.name

    try {
      await loadLevelNeighborhood(mazeId)

      const nextLayout = loadedMazeLayoutsRef.current.get(mazeId)

      if (!nextLayout) {
        throw new Error(`Level "${level.name}" could not load runtime maze "${mazeId}"`)
      }

      loadedMazeLayoutsRef.current.set(mazeId, nextLayout)
      instantiateLoadedMaze(mazeId, { reset: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      setMazeLayout(null)
      setInstantiatedMazeId(null)
      setGlobalTurnState(null)
      setMazeLoadError(message)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadLayout = async () => {
      if (startupChoice === 'pending') {
        return
      }

      setSceneLoaded(false)
      setMazeLoadError(null)
      document.body.dataset.mazeLayoutRequestedAt = performance.now().toFixed(1)
      document.body.dataset.requestedMazeId = requestedMazeId ?? getDefaultRuntimeLevelId()

      try {
        const resumeLevelId = startupChoice === 'continue'
          ? startupResumeLevelId
          : getDefaultRuntimeLevelId()
        const defaultMazeId = requestedMazeId ?? resumeLevelId
        const nextLayout = requestedMazeId
          ? await loadMazeLayoutById(requestedMazeId)
          : await loadMazeLayoutById(defaultMazeId)

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
          await loadLevelNeighborhood(nextLayout.maze.id)
          setInstantiatedMazeId(nextLayout.maze.id)
          setReplayActive(false)
          setGlobalTurnState(
            requestedMazeId
              ? createEnteredGlobalTurnState(
                  nextLayout,
                  getRuleWorldLayoutsForInstantiation(nextLayout)
                )
              : createInitialGlobalTurnState(
                  nextLayout,
                  getRuleWorldLayoutsForInstantiation(nextLayout)
                )
          )
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
  }, [
    getRuleWorldLayoutsForInstantiation,
    loadLevelNeighborhood,
    requestedMazeId,
    setGlobalTurnState,
    startupChoice,
    startupResumeLevelId
  ])

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
          renderedMazeIds: string[]
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
        renderedMazeIds: renderedMazeLayouts.map((renderedLayout) => renderedLayout.maze.id).sort(),
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

        startCurrentSolutionReplay()
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
  }, [instantiatedMazeId, mazeLoadError, replayActive, renderedMazeLayouts, sceneLoaded, mazeLayout])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (creditsOpen) {
        event.preventDefault()
        setCreditsOpen(false)
        return
      }

      if (event.code === 'Escape') {
        event.preventDefault()
        if (document.pointerLockElement) {
          document.exitPointerLock()
        }
        setLevelMenuOpen((open) => !open)
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

  const onChromaticAberrationSettingChange = (
    patch: Partial<ChromaticAberrationSettings>
  ) => {
    setVisualSettings((current) => ({
      ...current,
      chromaticAberration: {
        ...current.chromaticAberration,
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
      lensFlare: applyLensFlareSettingsPatch(current.lensFlare, patch)
    }))
  }

  const onMinotaurAlbedoHexChange = (value: string) => {
    setVisualSettings((current) => ({
      ...current,
      minotaurAlbedoHex: normalizeHexColor(value, current.minotaurAlbedoHex)
    }))
  }

  const onMonsterEyeColorChange = (monsterType: MonsterType, value: string) => {
    setVisualSettings((current) => ({
      ...current,
      monsterEyeColors: {
        ...current.monsterEyeColors,
        [monsterType]: normalizeHexColor(
          value,
          current.monsterEyeColors[monsterType]
        )
      }
    }))
  }

  const onMonsterEyeOffsetChange = (
    monsterType: MonsterType,
    eye: 'left' | 'right',
    axis: keyof MonsterEyeOffset,
    value: number
  ) => {
    setVisualSettings((current) => ({
      ...current,
      monsterEyes: {
        ...current.monsterEyes,
        [monsterType]: {
          ...current.monsterEyes[monsterType],
          [eye]: {
            ...current.monsterEyes[monsterType][eye],
            [axis]: MathUtils.clamp(value, -2, 2)
          }
        }
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

  const onResetChromaticAberrationSettings = () => {
    const defaults = createDefaultVisualSettings()

    setVisualSettings((current) => ({
      ...current,
      chromaticAberration: {
        ...defaults.chromaticAberration
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

  const onResetChromaticAberrationSetting = (key: keyof ChromaticAberrationSettings) => {
    const defaults = createDefaultVisualSettings()

    onChromaticAberrationSettingChange({
      [key]: defaults.chromaticAberration[key]
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
        setVisualSettings(createInitialVisualSettings())
      },
      setVisualSettings: (patch) => {
        setVisualSettings((current) => applyVisualSettingsPatch(current, patch))
      }
    }
    globalWindow.__levelsjamGetVisualSettings = () => visualSettings
    globalWindow.__levelsjamResetVisualSettings = () => {
      setVisualSettings(createInitialVisualSettings())
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
    recordIntroFadeTriggered()
    setSceneLoaded(true)
  }, [])
  const activeGlobalTurnState = globalTurnStateRef.current ?? globalTurnState
  const activeTurnState = mazeLayout && activeGlobalTurnState
    ? getGlobalTurnStateForLevel(activeGlobalTurnState, mazeLayout.maze.id, mazeLayout.maze)
    : null
  const activeAltarCutscene = Boolean(altarCutscene)
  const activeMusicLevelId = mazeLayout?.maze.id ?? instantiatedMazeId
  const activeLevelTransform = useMemo(
    () => mazeLayout
      ? getRuntimeLevelWorldTransform(mazeLayout.maze.id)
      : IDENTITY_LEVEL_WORLD_TRANSFORM,
    [mazeLayout?.maze.id]
  )
  const analyticsLevelId = mazeLayout?.maze.id ?? null
  const analyticsLevelName = mazeLayout?.maze.levelName ?? analyticsLevelId

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)

    trackAnalyticsEvent('page_view', {
      path: window.location.pathname,
      query: window.location.search,
      ref: searchParams.get('ref') ?? null,
      url: window.location.href
    })
  }, [])

  useEffect(() => {
    if (
      !mazeLayout ||
      !activeTurnState?.player.hasTrophy ||
      altarCutscene ||
      (mazeLayout.altars ?? []).length === 0
    ) {
      return
    }

    const altar = mazeLayout.altars.find((candidate) =>
      !activatedAltarIds.has(candidate.id) &&
      areCellsCardinallyAdjacent(activeTurnState.player.cell, candidate.cell)
    )

    if (!altar) {
      return
    }

    const facingDirection = directionFromCellToCell(activeTurnState.player.cell, altar.cell)

    setGlobalTurnState((current) => {
      if (!current) {
        return current
      }

      const levelTurnState = getGlobalTurnStateForLevel(
        current,
        mazeLayout.maze.id,
        mazeLayout.maze
      )
      const nextGlobalState = replaceGlobalTurnStateForLevel(current, mazeLayout.maze.id, {
        ...levelTurnState,
        player: {
          ...levelTurnState.player,
          ...(facingDirection ? { direction: facingDirection } : {}),
          hasTrophy: false
        },
        trophyState: 'consumed'
      })
      const nextItemStates = { ...(nextGlobalState.worldTurnState.itemStates ?? {}) }

      for (const [itemId, itemState] of Object.entries(nextItemStates)) {
        if (itemState === 'held' && itemId.endsWith(':trophy')) {
          nextItemStates[itemId] = 'consumed'
        }
      }

      return {
        ...nextGlobalState,
        player: {
          ...nextGlobalState.player,
          hasTrophy: false
        },
        worldTurnState: {
          ...nextGlobalState.worldTurnState,
          itemStates: nextItemStates,
          player: {
            ...nextGlobalState.worldTurnState.player,
            hasTrophy: false
          }
        }
      }
    })

    document.body.dataset.altarCutsceneActive = 'true'
    document.body.dataset.altarCutsceneStartedAt = performance.now().toFixed(1)
    setAltarCutscene({
      altarId: altar.id,
      levelId: mazeLayout.maze.id,
      startedAt: Number(document.body.dataset.altarCutsceneStartedAt)
    })
  }, [
    activatedAltarIds,
    activeTurnState?.player.cell.x,
    activeTurnState?.player.cell.y,
    activeTurnState?.player.hasTrophy,
    altarCutscene,
    mazeLayout,
    setGlobalTurnState
  ])

  useEffect(() => {
    if (!altarCutscene) {
      delete document.body.dataset.altarCutsceneActive
      delete document.body.dataset.altarCutsceneStartedAt
      return undefined
    }

    const replaceWithFlameHandle = window.setTimeout(() => {
      const levelId = altarCutscene.levelId
      const layoutForCutscene = loadedMazeLayoutsRef.current.get(levelId)

      setActivatedAltarIds((current) => {
        const next = new Set(current)

        next.add(altarCutscene.altarId)
        return next
      })
      if (layoutForCutscene) {
        setGlobalTurnState((current) => {
          if (!current) {
            return current
          }

          const levelTurnState = getGlobalTurnStateForLevel(
            current,
            levelId,
            layoutForCutscene.maze
          )

          const nextGlobalState = replaceGlobalTurnStateForLevel(current, levelId, {
            ...levelTurnState,
            player: {
              ...levelTurnState.player,
              hasTrophy: false
            },
            trophyState: 'consumed'
          })
          const nextItemStates = { ...(nextGlobalState.worldTurnState.itemStates ?? {}) }

          for (const [itemId, itemState] of Object.entries(nextItemStates)) {
            if (itemState === 'held' && itemId.endsWith(':trophy')) {
              nextItemStates[itemId] = 'consumed'
            }
          }

          return {
            ...nextGlobalState,
            player: {
              ...nextGlobalState.player,
              hasTrophy: false
            },
            worldTurnState: {
              ...nextGlobalState.worldTurnState,
              itemStates: nextItemStates,
              player: {
                ...nextGlobalState.worldTurnState.player,
                hasTrophy: false
              }
            }
          }
        })
      }
    }, 3000)

    const restoreControlHandle = window.setTimeout(() => {
      setAltarCutscene(null)
      delete document.body.dataset.altarCutsceneActive
      delete document.body.dataset.altarCutsceneStartedAt
    }, 4000)

    return () => {
      window.clearTimeout(replaceWithFlameHandle)
      window.clearTimeout(restoreControlHandle)
    }
  }, [altarCutscene, setGlobalTurnState])

  useEffect(() => {
    if (!analyticsLevelId) {
      return
    }

    trackAnalyticsEvent('level_visit', {
      level_id: analyticsLevelId,
      level_name: analyticsLevelName
    })
  }, [analyticsLevelId, analyticsLevelName])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.body.dataset.playerMovedRecently !== 'true') {
        return
      }

      document.body.dataset.playerMovedRecently = 'false'
      trackAnalyticsEvent('time_spent_in_game', {
        seconds: 60,
        level_id: analyticsLevelId,
        level_name: analyticsLevelName
      })
    }, 60000)

    return () => window.clearInterval(interval)
  }, [analyticsLevelId, analyticsLevelName])

  if (startupChoice === 'pending') {
    return (
      <div className="app-shell">
        <StartupChoiceOverlay
          onContinue={handleContinueChoice}
          onNewGame={handleNewGameChoice}
          resumeLevelId={startupResumeLevelId}
        />
      </div>
    )
  }

  if (!mazeLayout || !activeTurnState) {
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

  const sceneRenderedLayouts = renderedMazeLayouts.length > 0
    ? renderedMazeLayouts
    : [mazeLayout]

  return (
    <div className="app-shell">
      {controlsOpen && overlayVisible ? (
        <div className="fps-counter">
          <div>{Math.round(fps)} FPS</div>
          <div>{mazeLayout.maze.id}</div>
          <div>{GIT_REVISION}</div>
          <div>{GIT_REVISION_TIMESTAMP}</div>
        </div>
      ) : null}
      <LoadingOverlay complete={sceneLoaded} />
      <AltarCutsceneOverlay active={activeAltarCutscene} />
          <CreditsModal open={creditsOpen} />
          <MusicManager
            enabled={sceneLoaded}
            levelId={activeMusicLevelId}
            settings={audioSettings}
          />
          <SfxLibraryManager
            enabled={sceneLoaded}
            settings={audioSettings}
          />
          <LevelMenuModal
            audioSettings={audioSettings}
            challengeLevels={challengeLevelEntries}
            levels={authoredLevels}
            onAudioSettingChange={handleAudioSettingChange}
            onAmbientOcclusionModeChange={onAmbientOcclusionModeChange}
            onBooleanSettingChange={onBooleanSettingChange}
            onClose={() => setLevelMenuOpen(false)}
            onEffectSettingChange={onEffectSettingChange}
            onOpenCredits={() => {
              setLevelMenuOpen(false)
              setCreditsOpen(true)
            }}
            onReplaySolution={() => {
              startCurrentSolutionReplay()
              setLevelMenuOpen(false)
            }}
            onResetLevel={() => {
              resetInstantiatedMaze()
              setLevelMenuOpen(false)
            }}
            onSelectLevel={(level, index) => {
              void loadAndActivateLevel(level, index)
            }}
            open={levelMenuOpen}
            replayAvailable={Boolean(mazeLayout.maze.solution?.actions?.length)}
            visualSettings={visualSettings}
          />
      <MobileTouchControls
        onOpenMenu={() => {
          setLevelMenuOpen(true)
        }}
      />
      <VisualControls
        audioSettings={audioSettings}
        controlsOpen={controlsOpen}
        onAnamorphicSettingChange={onAnamorphicSettingChange}
        onAudioSettingChange={handleAudioSettingChange}
        onAmbientOcclusionModeChange={onAmbientOcclusionModeChange}
        onBooleanSettingChange={onBooleanSettingChange}
        onBloomSettingChange={onBloomSettingChange}
        onChromaticAberrationSettingChange={onChromaticAberrationSettingChange}
        onDepthOfFieldSettingChange={onDepthOfFieldSettingChange}
        onEffectSettingChange={onEffectSettingChange}
        onFogAmbientHexChange={onFogAmbientHexChange}
        onLensFlareSettingChange={onLensFlareSettingChange}
        onMinotaurAlbedoHexChange={onMinotaurAlbedoHexChange}
        onMonsterEyeColorChange={onMonsterEyeColorChange}
        onMonsterEyeOffsetChange={onMonsterEyeOffsetChange}
        onProbeDebugModeChange={onProbeDebugModeChange}
        onResetAnamorphicSettings={onResetAnamorphicSettings}
        onResetAmbientOcclusionMode={onResetAmbientOcclusionMode}
        onResetBloomSettings={onResetBloomSettings}
        onResetBooleanSetting={onResetBooleanSetting}
        onResetChromaticAberrationSetting={onResetChromaticAberrationSetting}
        onResetChromaticAberrationSettings={onResetChromaticAberrationSettings}
        onResetDepthOfFieldSettings={onResetDepthOfFieldSettings}
        onResetEffectSetting={onResetEffectSetting}
        onResetFogAmbientHex={onResetFogAmbientHex}
        onResetLensFlareSettings={onResetLensFlareSettings}
        onResetProbeDebugMode={onResetProbeDebugMode}
        onResetScalarSetting={onResetScalarSetting}
        onResetSsrSettings={onResetSsrSettings}
        onResetToneMapping={onResetToneMapping}
        onReplaySolution={() => {
          startCurrentSolutionReplay()
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
        {canvasBootstrapReady ? (
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
            dpr={1}
            frameloop="always"
            gl={{ antialias: true }}
            onCreated={({ gl }) => {
              recordStartupMarker('canvasCreatedAt')
              gl.debug.checkShaderErrors =
                new URLSearchParams(window.location.search).has('debugShaderErrors')
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
                    activatedAltarIds={activatedAltarIds}
                    applyTurnActionForLevel={handleTurnActionForLevel}
                    altarCutscene={altarCutscene}
                    audioSettings={audioSettings}
                    composerEnabled={composerEnabled}
                commitGlobalTurnState={commitGlobalTurnState}
                controlsOpen={controlsOpen}
                cutsceneActive={activeAltarCutscene}
                key={`scene:${mazeSceneKey}`}
                layout={mazeLayout}
                levelTransform={activeLevelTransform}
                renderedLayouts={sceneRenderedLayouts}
                getRenderedTurnState={getRenderedTurnState}
                onAssetsReady={onAssetsReady}
                onLevelTransition={handleLevelTransition}
                onReplayActiveChange={setReplayActive}
                onTurnStateChange={handleTurnStateChange}
                replayRequestId={replayRequestId}
                replayRequestMazeId={replayRequestMazeId}
                turnState={activeTurnState}
                visualSettings={visualSettings}
              />
            </Suspense>
            <FpsReporter onSample={setFps} />
          </Canvas>
        ) : null}
      </div>
    </div>
  )
}
