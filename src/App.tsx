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
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3
} from 'three'
import { useEffect, useMemo, useRef } from 'react'
import {
  getCameraPosition,
  PLAYER_SPAWN_POSITION,
  resolvePlayerCollision
} from './lib/playerCollision.js'
import { Water } from 'three/addons/objects/Water.js'

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
const WATER_NORMALS_URL = `${assetBase}textures/waternormals.jpg`
const CUBE_TEXTURE_REPEAT = 10
const GROUND_TEXTURE_REPEAT = 5000
const GRAVITY = 16
const LOOK_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.05
const INITIAL_PITCH = 0
const cameraEuler = new Euler(0, 0, 0, 'YXZ')
const INITIAL_LOOK_TARGET = new Vector3(0, 5, 0)
const WATER_SUN_DIRECTION = new Vector3(0.70707, 0.70707, 0).normalize()

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
  const grounded = useRef(false)
  const playerPosition = useRef(
    new Vector3(
      PLAYER_SPAWN_POSITION.x,
      PLAYER_SPAWN_POSITION.y,
      PLAYER_SPAWN_POSITION.z
    )
  )
  const velocity = useRef(new Vector3())
  const forward = useRef(new Vector3())
  const right = useRef(new Vector3())
  const pointer = useRef<Vector2 | null>(null)
  const yaw = useRef(0)
  const pitch = useRef(INITIAL_PITCH)
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const intendedPosition = useRef(new Vector3())

  useEffect(() => {
    const initialCameraPosition = getCameraPosition(PLAYER_SPAWN_POSITION)

    camera.rotation.order = 'YXZ'
    camera.position.set(
      initialCameraPosition.x,
      initialCameraPosition.y,
      initialCameraPosition.z
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
    if (keys.current.Space) {
      velocity.current.y += GRAVITY * delta
      grounded.current = false
    } else if (!grounded.current) {
      velocity.current.y -= GRAVITY * delta
    } else {
      velocity.current.y = 0
    }

    const horizontalDamping = Math.exp(-4 * delta)
    const verticalDamping = Math.exp(-1.5 * delta)
    velocity.current.x *= horizontalDamping
    velocity.current.z *= horizontalDamping
    if (!grounded.current || keys.current.Space) {
      velocity.current.y *= verticalDamping
    }

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
      velocity.current.x = 0
    }
    if (collision.position.y !== intendedPosition.current.y) {
      velocity.current.y = 0
    }
    if (collision.position.z !== intendedPosition.current.z) {
      velocity.current.z = 0
    }
    if (collision.position.y !== intendedPosition.current.y && velocity.current.y < 0) {
      velocity.current.y = 0
    }

    grounded.current = collision.grounded && !keys.current.Space
    playerPosition.current.set(
      collision.position.x,
      collision.position.y,
      collision.position.z
    )
    const cameraPosition = getCameraPosition(playerPosition.current)

    camera.position.set(
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z
    )
  })

  return null
}

function WaterSurface() {
  const camera = useThree((state) => state.camera)
  const waterNormals = useLoader(TextureLoader, WATER_NORMALS_URL)
  const water = useMemo(() => {
    waterNormals.wrapS = RepeatWrapping
    waterNormals.wrapT = RepeatWrapping

    const surface = new Water(new PlaneGeometry(4000, 4000), {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals,
      sunDirection: WATER_SUN_DIRECTION.clone(),
      sunColor: 0xffffff,
      waterColor: 0x2d6f96,
      distortionScale: 3.7,
      fog: false
    })

    surface.rotation.x = -Math.PI / 2
    surface.position.y = -1
    surface.receiveShadow = true
    return surface
  }, [waterNormals])

  useFrame((_, delta) => {
    const material = water.material as ShaderMaterial
    const uniforms = material.uniforms as {
      time: { value: number }
      eye: { value: Vector3 }
    }

    uniforms.time.value += delta * 0.35
    uniforms.eye.value.copy(camera.position)
  })

  useEffect(
    () => () => {
      water.geometry.dispose()
      water.material.dispose()
    },
    [water]
  )

  return <primitive object={water} />
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

      <WaterSurface />

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
