import { EffectComposer } from '@react-three/postprocessing'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { DEFAULT_PRECOMPUTED_TEXTURES_URL } from '@takram/three-atmosphere'
import type { AtmosphereApi } from '@takram/three-atmosphere/r3f'
import {
  AerialPerspective,
  Atmosphere,
  Sky,
  SkyLight,
  SunLight
} from '@takram/three-atmosphere/r3f'
import { Ellipsoid, Geodetic } from '@takram/three-geospatial'
import {
  ACESFilmicToneMapping,
  Euler,
  Matrix4,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3
} from 'three'
import { useEffect, useMemo, useRef } from 'react'
import {
  PLAYER_SPAWN_POSITION,
  resolvePlayerCollision
} from './lib/playerCollision.js'

const assetBase = import.meta.env.BASE_URL
const GRASS_TEXTURE_URLS = {
  color: `${assetBase}textures/grass_1/grass_1-1K/grass_1_basecolor-1K.png`,
  normal: `${assetBase}textures/grass_1/grass_1-1K/grass_1_normal-1K.png`,
  roughness: `${assetBase}textures/grass_1/grass_1-1K/grass_1_roughness-1K.png`,
  metalness: `${assetBase}textures/grass_1/grass_1-1K/grass_1_metallic-1K.png`,
  bump: `${assetBase}textures/grass_1/grass_1-1K/grass_1_height-1K.png`
}
const GROUND_TEXTURE_URLS = {
  color: `${assetBase}textures/ground_14/ground_14-1K/ground_14_Basecolor-1K.png`,
  normal: `${assetBase}textures/ground_14/ground_14-1K/ground_14_Normal-1K.png`,
  roughness: `${assetBase}textures/ground_14/ground_14-1K/ground_14_Roughness-1K.png`,
  metalness: `${assetBase}textures/ground_14/ground_14-1K/ground_14_Metallic-1K.png`,
  bump: `${assetBase}textures/ground_14/ground_14-1K/ground_14_Height-1K.png`
}
const ATMOSPHERE_DATE = new Date('2026-04-03T12:00:00Z')
const CUBE_TEXTURE_REPEAT = 10
const GROUND_TEXTURE_REPEAT = 5000
const LOOK_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.05
const INITIAL_PITCH = 0
const cameraEuler = new Euler(0, 0, 0, 'YXZ')
const INITIAL_LOOK_TARGET = new Vector3(0, 5, 0)

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
  texture.colorSpace = isColorMap ? SRGBColorSpace : texture.colorSpace
  texture.needsUpdate = true
}

function usePbrTextures(
  textureUrls: typeof GRASS_TEXTURE_URLS,
  repeat: number
) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())
  const textures = useLoader(TextureLoader, [
    textureUrls.color,
    textureUrls.normal,
    textureUrls.roughness,
    textureUrls.metalness,
    textureUrls.bump
  ]) as [Texture, Texture, Texture, Texture, Texture]

  useEffect(() => {
    const anisotropy = Math.min(maxAnisotropy, 8)
    configureRepeatedTexture(textures[0], repeat, anisotropy, true)
    configureRepeatedTexture(textures[1], repeat, anisotropy)
    configureRepeatedTexture(textures[2], repeat, anisotropy)
    configureRepeatedTexture(textures[3], repeat, anisotropy)
    configureRepeatedTexture(textures[4], repeat, anisotropy)
  }, [maxAnisotropy, repeat, textures])

  return {
    map: textures[0],
    normalMap: textures[1],
    roughnessMap: textures[2],
    metalnessMap: textures[3],
    bumpMap: textures[4]
  }
}

function FlightRig() {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const keys = useRef<Record<string, boolean>>({})
  const velocity = useRef(new Vector3())
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const pointer = useRef<Vector2 | null>(null)
  const yaw = useRef(0)
  const pitch = useRef(INITIAL_PITCH)
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const intendedPosition = useRef(new Vector3())

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    camera.position.set(
      PLAYER_SPAWN_POSITION.x,
      PLAYER_SPAWN_POSITION.y,
      PLAYER_SPAWN_POSITION.z
    )
    camera.lookAt(INITIAL_LOOK_TARGET)
    yaw.current = camera.rotation.y
    pitch.current = camera.rotation.x
  }, [camera])

  useEffect(() => {
    const updateRotation = () => {
      camera.quaternion.setFromEuler(
        cameraEuler.set(pitch.current, yaw.current, 0, 'YXZ')
      )
    }

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        pointer.current = null
        return
      }

      if (pointer.current == null) {
        pointer.current = new Vector2(event.clientX, event.clientY)
        return
      }

      const deltaX = event.clientX - pointer.current.x
      const deltaY = event.clientY - pointer.current.y

      pointer.current.set(event.clientX, event.clientY)
      yaw.current -= deltaX * LOOK_SENSITIVITY
      pitch.current = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, pitch.current - deltaY * LOOK_SENSITIVITY)
      )
      updateRotation()
    }

    const clearPointer = () => {
      pointer.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('blur', clearPointer)
    window.addEventListener('mouseleave', clearPointer)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('blur', clearPointer)
      window.removeEventListener('mouseleave', clearPointer)
    }
  }, [camera, canvas])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.set(0, 0, -1)
    }

    right.current.crossVectors(forward.current, up).normalize()

    const acceleration = new Vector3()
    if (keys.current.KeyW) acceleration.add(forward.current)
    if (keys.current.KeyS) acceleration.addScaledVector(forward.current, -1)
    if (keys.current.KeyD) acceleration.add(right.current)
    if (keys.current.KeyA) acceleration.addScaledVector(right.current, -1)
    if (acceleration.lengthSq() > 0) {
      acceleration.normalize().multiplyScalar(20)
    }

    velocity.current.x += acceleration.x * delta
    velocity.current.z += acceleration.z * delta
    velocity.current.y += (keys.current.Space ? 16 : -9.81) * delta

    const horizontalDamping = Math.exp(-4 * delta)
    const verticalDamping = Math.exp(-1.5 * delta)
    velocity.current.x *= horizontalDamping
    velocity.current.z *= horizontalDamping
    velocity.current.y *= verticalDamping

    intendedPosition.current
      .copy(camera.position)
      .addScaledVector(velocity.current, delta)

    const collision = resolvePlayerCollision(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      {
        x: intendedPosition.current.x,
        y: intendedPosition.current.y,
        z: intendedPosition.current.z
      }
    )

    if (collision.position.x !== intendedPosition.current.x) {
      velocity.current.x = 0
    }
    if (collision.position.y !== intendedPosition.current.y) {
      velocity.current.y = 0
    }
    if (collision.position.z !== intendedPosition.current.z) {
      velocity.current.z = 0
    }

    camera.position.set(
      collision.position.x,
      collision.position.y,
      collision.position.z
    )
  })

  return null
}

function Terrain() {
  const grass = usePbrTextures(GRASS_TEXTURE_URLS, CUBE_TEXTURE_REPEAT)
  const ground = usePbrTextures(GROUND_TEXTURE_URLS, GROUND_TEXTURE_REPEAT)

  return (
    <>
      <mesh position={[0, 5, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 10, 10]} />
        <meshStandardMaterial
          {...grass}
          bumpScale={0.15}
          roughness={1}
          metalness={0.04}
        />
      </mesh>

      <mesh position={[0, -1, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshPhysicalMaterial
          color="#4d95c7"
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
        <meshStandardMaterial
          {...ground}
          bumpScale={0.08}
          roughness={0.98}
          metalness={0.02}
        />
      </mesh>
    </>
  )
}

function Scene() {
  const atmosphere = useRef<AtmosphereApi | null>(null)
  const worldOrigin = useMemo(
    () => new Geodetic(0, 0, 5).toECEF(new Vector3()),
    []
  )

  useEffect(() => {
    if (!atmosphere.current) {
      return
    }

    atmosphere.current.worldToECEFMatrix.copy(
      Ellipsoid.WGS84.getNorthUpEastFrame(worldOrigin, new Matrix4())
    )
  }, [worldOrigin])

  return (
    <Atmosphere
      ref={atmosphere}
      date={ATMOSPHERE_DATE}
      ground={false}
      textures={DEFAULT_PRECOMPUTED_TEXTURES_URL}
    >
      <Sky />
      <group position={[0, 0, 0]}>
        <SkyLight />
        <SunLight />
      </group>
      <Terrain />
      <EffectComposer>
        <AerialPerspective />
      </EffectComposer>
      <FlightRig />
    </Atmosphere>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <Canvas
        camera={{
          position: [
            PLAYER_SPAWN_POSITION.x,
            PLAYER_SPAWN_POSITION.y,
            PLAYER_SPAWN_POSITION.z
          ],
          fov: 60,
          near: 0.1,
          far: 8000
        }}
        dpr={[1, 2]}
        onCreated={({ camera, gl }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.2
        }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
