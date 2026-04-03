import { EffectComposer } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AerialPerspective,
  Atmosphere,
  Sky,
  SkyLight,
  SunLight
} from '@takram/three-atmosphere/r3f'
import { PointerLockControls } from '@react-three/drei'
import {
  Color,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3
} from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib'

const GRASS_TEXTURE_URL = '/textures/grass_1.webp'
const GROUND_TEXTURE_URL = '/textures/ground_14.webp'

const waterColor = new Color('#4d95c7')
const groundColor = new Color('#8a7b68')

function useLoadedTexture(url: string) {
  const texture = useMemo(() => {
    const loader = new TextureLoader()
    const loaded = loader.load(url)
    loaded.colorSpace = SRGBColorSpace
    loaded.wrapS = RepeatWrapping
    loaded.wrapT = RepeatWrapping
    loaded.anisotropy = 8
    loaded.repeat.set(1, 1)
    return loaded
  }, [url])

  useEffect(() => () => texture.dispose(), [texture])

  return texture
}

function FlightRig() {
  const controls = useRef<PointerLockControlsImpl | null>(null)
  const keys = useRef<Record<string, boolean>>({})
  const velocity = useRef(new Vector3())
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const [locked, setLocked] = useState(false)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD') {
        event.preventDefault()
      }
      keys.current[event.code] = true
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!locked) {
      velocity.current.multiplyScalar(0.85)
      return
    }

    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.set(0, 0, -1)
    }
    right.current.crossVectors(forward.current, up).normalize()

    const accel = new Vector3()
    if (keys.current.KeyW) accel.add(forward.current)
    if (keys.current.KeyS) accel.addScaledVector(forward.current, -1)
    if (keys.current.KeyD) accel.add(right.current)
    if (keys.current.KeyA) accel.addScaledVector(right.current, -1)
    if (accel.lengthSq() > 0) {
      accel.normalize().multiplyScalar(18)
    }

    velocity.current.x += accel.x * delta
    velocity.current.z += accel.z * delta

    const jetpack = keys.current.Space ? 14 : -9.81
    velocity.current.y += jetpack * delta

    const horizontalDamping = Math.exp(-4 * delta)
    const verticalDamping = Math.exp(-1.5 * delta)
    velocity.current.x *= horizontalDamping
    velocity.current.z *= horizontalDamping
    velocity.current.y *= verticalDamping

    camera.position.addScaledVector(velocity.current, delta)
    camera.position.y = Math.max(camera.position.y, -8)
  })

  return (
    <>
      <PointerLockControls
        ref={controls}
        onLock={() => setLocked(true)}
        onUnlock={() => setLocked(false)}
      />
      {!locked ? (
        <button
          className="start-button"
          type="button"
          onClick={() => controls.current?.lock()}
        >
          Click to enter
        </button>
      ) : null}
    </>
  )
}

function Terrain() {
  const grass = useLoadedTexture(GRASS_TEXTURE_URL)
  const ground = useLoadedTexture(GROUND_TEXTURE_URL)

  useEffect(() => {
    grass.repeat.set(1, 1)
    ground.repeat.set(24, 24)
  }, [grass, ground])

  return (
    <>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial map={grass} roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[0, -1, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshPhysicalMaterial
          color={waterColor}
          transparent
          opacity={0.72}
          roughness={0.08}
          metalness={0.02}
          transmission={0.05}
          thickness={0.4}
          ior={1.333}
        />
      </mesh>

      <mesh position={[0, -2.5, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial map={ground} color={groundColor} roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

function Scene() {
  return (
    <Atmosphere>
      <Sky />
      <group position={[0, 0, 0]}>
        <SkyLight />
        <SunLight />
      </group>
      <color attach="background" args={['#9ed0ef']} />
      <fog attach="fog" args={['#9ed0ef', 80, 500]} />
      <Terrain />
      <EffectComposer enableNormalPass>
        <AerialPerspective />
      </EffectComposer>
      <FlightRig />
    </Atmosphere>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <div className="frame">
        <div className="copy">
          <p className="eyebrow">Cursor / levels.io jam</p>
          <h1>Atmospheric flight scaffold</h1>
          <p className="lede">
            WASD moves, the mouse looks, and space adds vertical thrust.
          </p>
        </div>
        <div className="status">
          <span>WebGL ready</span>
        </div>
      </div>
      <Scene />
    </div>
  )
}
