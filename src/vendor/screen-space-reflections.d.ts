import type { Camera, Scene } from 'three'
import type { Effect } from 'postprocessing'

export type SSROptions = {
  blend?: number
  blur?: number
  correction?: number
  distance?: number
  fade?: number
  intensity?: number
  ior?: number
  jitter?: number
  jitterRoughness?: number
  maxDepthDifference?: number
  maxRoughness?: number
  missedRays?: boolean
  refineSteps?: number
  resolutionScale?: number
  steps?: number
  thickness?: number
  useNormalMap?: boolean
  useRoughnessMap?: boolean
}

export declare class SSREffect extends Effect {
  constructor(scene: Scene, camera: Camera, options?: SSROptions)
  intensity: number
}
