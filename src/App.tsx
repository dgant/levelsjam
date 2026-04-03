import {
  Bloom,
  DepthOfField,
  EffectComposer,
  SSAO,
  Vignette
} from '@react-three/postprocessing'
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
  AgXToneMapping,
  Color,
  Euler,
  Matrix4,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector3
} from 'three'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { BlendFunction, GodRaysEffect } from 'postprocessing'
import { LensFlareEffect } from '@react-three/postprocessing'
import {
  getCameraPosition,
  PLAYER_SPAWN_POSITION,
  resolvePlayerCollision
} from './lib/playerCollision.js'
import {
  updateHorizontalVelocity,
  updateVerticalVelocity
} from './lib/playerMotion.js'
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
const LOOK_SENSITIVITY = 0.003
const MAX_PITCH = Math.PI / 2 - 0.05
const INITIAL_PITCH = 0
const cameraEuler = new Euler(0, 0, 0, 'YXZ')
const INITIAL_LOOK_TARGET = new Vector3(0, 5, 0)
const SUN_DIRECTION = new Vector3(
  0,
  Math.sin(Math.PI / 6),
  -Math.cos(Math.PI / 6)
).normalize()
const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(6000)
const WATER_SUN_DIRECTION = SUN_DIRECTION.clone()
const POINTER_UNLOCK_CODES = new Set([
  'Escape',
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight'
])

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
  const isPointerLocked = useRef(false)
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
        Math.min(MAX_PITCH, pitch.current - event.movementY * LOOK_SENSITIVITY)
      )
      updateRotation()
    }

    const onPointerDown = () => {
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
      if (POINTER_UNLOCK_CODES.has(event.code) || event.key === 'Meta') {
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock()
        }
        keys.current[event.code] = false
        return
      }

      if (document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock()
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
  }, [canvas])

  useFrame((_, delta) => {
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() > 0) {
      forward.current.normalize()
    } else {
      forward.current.set(0, 0, -1)
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
      { x: velocity.current.x, z: velocity.current.z },
      { x: desiredDirection.x, z: desiredDirection.z },
      delta
    )

    velocity.current.x = horizontalVelocity.x
    velocity.current.z = horizontalVelocity.z
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
    surface.position.y = 9
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

function GodRaysPrimitive({
  sun
}: {
  sun: Mesh
}) {
  const camera = useThree((state) => state.camera)
  const effect = useMemo(
    () => new GodRaysEffect(camera, sun, {}),
    [camera, sun]
  )

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect} dispose={null} />
}

function LensFlarePrimitive() {
  const camera = useThree((state) => state.camera)
  const viewport = useThree((state) => state.viewport)
  const raycaster = useThree((state) => state.raycaster)
  const scene = useThree((state) => state.scene)
  const effect = useMemo(
    () =>
      new LensFlareEffect({
        blendFunction: BlendFunction.NORMAL,
        enabled: true,
        glareSize: 0.2,
        lensPosition: new Vector3(),
        screenRes: new Vector2(viewport.width, viewport.height),
        starPoints: 6,
        flareSize: 0.01,
        flareSpeed: 0.01,
        flareShape: 0.01,
        animated: true,
        anamorphic: false,
        colorGain: new Color(20, 20, 20),
        lensDirtTexture: null,
        haloScale: 0.5,
        secondaryGhosts: true,
        aditionalStreaks: true,
        ghostScale: 0,
        opacity: 1,
        starBurst: false
      }),
    [viewport.height, viewport.width]
  )
  const screenPosition = useMemo(() => new Vector2(), [])
  const projectedPosition = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const resolution = effect.uniforms.get('screenRes')
    if (resolution) {
      resolution.value.x = viewport.width
      resolution.value.y = viewport.height
    }
  }, [effect, viewport.height, viewport.width])

  useFrame((_, delta) => {
    const lensPosition = effect.uniforms.get('lensPosition')
    const opacity = effect.uniforms.get('opacity')

    if (!lensPosition || !opacity) {
      return
    }

    projectedPosition.copy(SUN_POSITION).project(camera)
    if (projectedPosition.z > 1) {
      return
    }

    lensPosition.value.x = projectedPosition.x
    lensPosition.value.y = projectedPosition.y
    screenPosition.set(projectedPosition.x, projectedPosition.y)
    raycaster.setFromCamera(screenPosition, camera)

    let nextOpacity = 1
    const intersections = raycaster.intersectObjects(scene.children, true)
    const hitObject = intersections[0]?.object

    if (hitObject?.userData?.lensflare === 'no-occlusion') {
      nextOpacity = 0
    } else if (hitObject instanceof Mesh) {
      const material = hitObject.material as {
        opacity?: number
        transparent?: boolean
        uniforms?: { _transmission?: { value: number } }
        _transmission?: number
      }

      if ((material.uniforms?._transmission?.value ?? material._transmission ?? 0) > 0.2) {
        nextOpacity = 0.2
      } else if (material.transparent) {
        nextOpacity = material.opacity ?? 1
      }
    }

    opacity.value += (nextOpacity - opacity.value) * Math.min(1, delta / 0.07)
  })

  useEffect(() => () => effect.dispose(), [effect])

  return <primitive object={effect} dispose={null} />
}

function FpsReporter({
  onSample
}: {
  onSample: (fps: number) => void
}) {
  const elapsed = useRef(0)
  const frames = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    frames.current += 1

    if (elapsed.current >= 0.25) {
      const fps = frames.current / elapsed.current

      startTransition(() => {
        onSample(fps)
      })

      elapsed.current = 0
      frames.current = 0
    }
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

      <WaterSurface />

      <mesh position={[0, 8, 0]} rotation-x={-Math.PI / 2} receiveShadow>
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
  const [sunMesh, setSunMesh] = useState<Mesh | null>(null)
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
      <group position={[SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]}>
        <SkyLight />
        <SunLight />
      </group>
      <mesh
        ref={(value) => {
          if (value && value !== sunMesh) {
            setSunMesh(value)
          }
        }}
        position={[SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]}
      >
        <sphereGeometry args={[220, 24, 24]} />
        <meshBasicMaterial color="#fff4c2" toneMapped={false} />
      </mesh>
      <Terrain />
      <EffectComposer enableNormalPass>
        <AerialPerspective />
        <Bloom />
        {sunMesh ? <GodRaysPrimitive sun={sunMesh} /> : null}
        <DepthOfField />
        <LensFlarePrimitive />
        <SSAO />
        <Vignette />
      </EffectComposer>
      <FlightRig />
    </Atmosphere>
  )
}

export default function App() {
  const [fps, setFps] = useState(0)

  return (
    <div className="app-shell">
      <div className="fps-counter">{Math.round(fps)} FPS</div>
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
          gl.toneMapping = AgXToneMapping
          gl.toneMappingExposure = 1.2
        }}
      >
        <Scene />
        <FpsReporter onSample={setFps} />
      </Canvas>
    </div>
  )
}
