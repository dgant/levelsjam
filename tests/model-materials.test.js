import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeModelGltfPaths = [
  'public/models/droop_cup_runtime/scene.gltf',
  'public/models/metal_gate_runtime/scene.gltf',
  'public/models/pbr_jumping_spider_monster_runtime/scene.gltf',
  'public/models/pale_dread_white_werewolf_runtime/scene.gltf',
  'public/models/bronze_sword_mycean/scene.gltf',
  'public/models/head_of_a_bull_runtime/scene.gltf',
  'public/models/minotaur-runtime/scene.gltf'
]

function readGltf(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'))
}

function getTextureImageUri(gltf, textureIndex) {
  const texture = gltf.textures?.[textureIndex]
  const image = typeof texture?.source === 'number'
    ? gltf.images?.[texture.source]
    : null

  return typeof image?.uri === 'string' ? image.uri : null
}

function getAccessorCount(gltf, accessorIndex) {
  return gltf.accessors?.[accessorIndex]?.count ?? 0
}

function getPrimitiveTriangleCount(gltf, primitive) {
  return typeof primitive.indices === 'number'
    ? Math.floor(getAccessorCount(gltf, primitive.indices) / 3)
    : Math.floor(getAccessorCount(gltf, primitive.attributes?.POSITION) / 3)
}

function getGltfTriangleCount(gltf) {
  return (gltf.meshes ?? [])
    .flatMap((mesh) => mesh.primitives ?? [])
    .reduce((sum, primitive) => sum + getPrimitiveTriangleCount(gltf, primitive), 0)
}

test('runtime imported model GLTFs use ORM material texture convention', () => {
  for (const relativePath of runtimeModelGltfPaths) {
    const gltf = readGltf(relativePath)

    assert.equal(
      gltf.extensionsUsed?.includes('KHR_materials_specular') ?? false,
      false,
      `${relativePath} should not require the specular material extension at runtime`
    )

    for (const image of gltf.images ?? []) {
      assert.doesNotMatch(
        image.uri,
        /metallicRoughness|metallic_roughness|metalroughness/i,
        `${relativePath} should name runtime packed material maps as ORM textures`
      )
    }

    for (const material of gltf.materials ?? []) {
      const metallicRoughnessTexture =
        material.pbrMetallicRoughness?.metallicRoughnessTexture

      assert.equal(
        Boolean(material.extensions?.KHR_materials_specular?.specularTexture),
        false,
        `${relativePath}:${material.name ?? '<unnamed>'} should not bind a specular texture`
      )

      if (!metallicRoughnessTexture) {
        continue
      }

      const ormUri = getTextureImageUri(gltf, metallicRoughnessTexture.index)

      assert.match(
        ormUri ?? '',
        /(^|[_-])orm\.(png|jpe?g|webp)$/i,
        `${relativePath}:${material.name ?? '<unnamed>'} should bind metallic/roughness through an ORM texture`
      )

      if (material.occlusionTexture) {
        assert.equal(
          material.occlusionTexture.index,
          metallicRoughnessTexture.index,
          `${relativePath}:${material.name ?? '<unnamed>'} should share one ORM texture for occlusion, roughness, and metalness`
        )
      }
    }
  }
})

test('gate dynamic volumetric material variant stays under the WebGL sampler budget', () => {
  const webglFragmentSamplerBudget = 16
  const gateRuntimeMaterialSamplers = 4
  const doorRuntimeMaterialSamplers = 5
  const localReflectionProbeSamplers = 4
  const dynamicVolumetricCoefficientSamplers = 4
  const dynamicVolumetricConnectivitySamplers = 1
  const estimatedGateSamplerCount =
    gateRuntimeMaterialSamplers +
    localReflectionProbeSamplers +
    dynamicVolumetricCoefficientSamplers +
    dynamicVolumetricConnectivitySamplers
  const estimatedDoorSamplerCount =
    doorRuntimeMaterialSamplers +
    localReflectionProbeSamplers +
    dynamicVolumetricCoefficientSamplers +
    dynamicVolumetricConnectivitySamplers
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.equal(
    appSource.includes('localProbeDepthAtlas'),
    false,
    'runtime surface materials should not compile per-face volumetric probe-depth atlas samplers'
  )
  assert.equal(
    appSource.includes('depthAtlas:'),
    false,
    'runtime reflection-probe artifact baking should not emit probe-depth atlases after switching VLM occlusion to maze connectivity'
  )
  assert.ok(
    estimatedGateSamplerCount <= webglFragmentSamplerBudget,
    `gate material should use no more than ${webglFragmentSamplerBudget} fragment samplers`
  )
  assert.ok(
    estimatedDoorSamplerCount <= webglFragmentSamplerBudget,
    `door material should use no more than ${webglFragmentSamplerBudget} fragment samplers`
  )
  assert.ok(
    estimatedGateSamplerCount + 6 > webglFragmentSamplerBudget,
    'the test should cover the previous six-sampler depth-atlas pressure that made gates disappear'
  )
})

test('loaded open gates render from the current rules state', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /useState<string\[\]>\(\s*\(\) => getOpenGateIds\(layout\.maze, turnState\)\s*\)/,
    'runtime scenes should seed displayed gate ids from the loaded post-entry turn state'
  )
  assert.match(
    appSource,
    /openProgress\.current = isOpen \? 1 : 0[\s\S]*?MathUtils\.lerp\(transform\.closedY, transform\.openY, openProgress\.current\)/,
    'gates that mount already open should start lowered instead of flashing closed'
  )
})

test('doors use generated Minoan-door ORM textures and baked dynamic lighting', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /const DOOR_TEXTURE_URLS = \{/)
  assert.match(
    appSource,
    /textures\/runtime\/minoan-door\/minoan_door_left_orm\.png/,
    'door leaves should bind the generated runtime left-leaf ORM texture'
  )
  assert.doesNotMatch(
    appSource,
    /minoan_door_right/,
    'right door leaves should mirror the left texture at runtime instead of binding duplicate right textures'
  )
  assert.doesNotMatch(
    appSource,
    /1K-metal_rust-specular\.jpg|1K-metal_rust-roughness\.jpg/,
    'door material should not bind source specular or roughness images directly'
  )
  assert.match(
    appSource,
    /vlmMode: 'boundary8'/,
    'doors should receive volumetric-lightmap diffuse lighting without changing shader shape when probes stream'
  )
  assert.match(
    appSource,
    /radianceMode: 'constant'/,
    'doors should receive local reflection-probe radiance without changing shader shape when probes stream'
  )
  assert.match(
    appSource,
    /activePlayerWorldPosition/,
    'maze entrance doors should receive the active player world position'
  )
  assert.match(
    appSource,
    /activePlayerTurn > 0 &&\s*!completedMazeLevelIds\.has\(layout\.maze\.id\) &&\s*doorWorldPosition/,
    'maze entrance doors should open from world-space adjacency after gameplay movement without starting open'
  )
  assert.match(
    appSource,
    /isOpen=\{\s*!isPermanentlyClosed &&[\s\S]*?\(isActive && isDoorOpenForTurnState\(door, layout\.maze, turnState\)\) \|\|\s*isAdjacentToActivePlayer/,
    'maze entrance doors should be driven by active rules state or active world-space player adjacency'
  )
  assert.match(
    appSource,
    /const DOOR_HEIGHT = 1\.8/,
    'door leaves should be 1.8m high'
  )
})

test('completed altar target mazes keep entrance doors closed after resume', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /const completedMazeLevelIds = useMemo/)
  assert.match(appSource, /altar\.targetLevelId && activatedAltarIds\.has\(altar\.id\)/)
  assert.match(appSource, /completedMazeLevelIds\.has\(layout\.maze\.id\)/)
  assert.match(appSource, /!isPermanentlyClosed &&[\s\S]*?isDoorOpenForTurnState/)
})

test('closed completed mazes reset when player is outside them', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /resetClosedMazeIdsRef/)
  assert.match(appSource, /resetGlobalTurnStateLevel\(next, targetLayout\)/)
  assert.match(appSource, /targetLevelId !== globalTurnStateRef\.current\?\.player\.levelId/)
})

test('door back faces keep handles toward the doorway center', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /geometry=\{leftDoorGeometry\}[\s\S]*?maps=\{doorMaps\}\s+materialKey=\{`\$\{materialKey\}:left`\}/,
    'left door leaf should use the shared left texture with one batched material path'
  )
  assert.match(
    appSource,
    /createDoorLeafGeometry\(\{ mirrored: true \}\)/,
    'right door leaf should mirror its UVs at runtime'
  )
  assert.match(
    appSource,
    /geometry=\{rightDoorGeometry\}[\s\S]*?materialKey=\{`\$\{materialKey\}:right`\}\s+mirroredNormal/,
    'right door leaf should invert its tangent-space normal X contribution at runtime while using one material'
  )
})

test('lens flare controls do not use app-side giant multipliers', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.doesNotMatch(appSource, /LENS_FLARE_COLOR_GAIN|LENS_FLARE_INTENSITY_SCALE/)
  assert.match(appSource, /Lens Flare Strength/)
  assert.match(appSource, /Star Burst Intensity/)
  assert.match(
    appSource,
    /starBurstIntensity <= 0\.0 \? vec3\(0\.0\) : starBurstSignal \* starBurstIntensity/
  )
  assert.doesNotMatch(
    appSource,
    /clamp\(\(lensMod\.rgb \* getStartBurst\(\)\.rgb \), 0\.01, 1\.0\) \* starBurstIntensity/
  )
  assert.doesNotMatch(appSource, /Flare Opacity/)
})

test('anamorphic lens flare shape controls streak definition', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /LensFlareEffect as PostLensFlareEffect/)
  assert.match(appSource, /new PostLensFlareEffect\(\{/)
  assert.match(appSource, /blendFunction: BlendFunction\.NORMAL/)
  assert.match(appSource, /new EffectPass\(camera as ThreeCamera, effect\)/)
  assert.match(appSource, /object=\{slot\.pass as unknown as Pass\}/)
  assert.doesNotMatch(appSource, /MAX_UPSTREAM_LENS_FLARE_EFFECTS/)
  assert.doesNotMatch(
    appSource,
    /torchMultiLensFlareEffectShader|TorchMultiLensFlareEffectImpl/,
    'lens flare shape should come from the upstream postprocessing effect, not a custom approximation'
  )
  assert.doesNotMatch(
    appSource,
    /flareSize \* 90\.0|float sharpLineContribution/,
    'flareSize should not be scaled into a broad custom blob before shape is applied'
  )
  assert.match(appSource, /colorGain: number/)
  assert.match(appSource, /colorGain: 1/)
})

test('lens flares apply per-source inverse-square camera distance falloff', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /distanceToLight <= 1\.5/)
  assert.match(appSource, /\(1\.5 \/ Math\.max\(distanceToLight, 0\.001\)\) \*\* 2/)
  assert.match(appSource, /candidates\.push\(\{\s*distanceToLight,\s*intensity: distanceAttenuation/)
  assert.match(appSource, /colorGain: 1/)
  assert.match(appSource, /multiplyScalar\(settings\.colorGain \* \(visibleLens\?\.intensity \?\? 0\)\)/)
})

test('lens flare occlusion raycasts against all opaque scene meshes', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /function isLensFlareOcclusionMaterial/)
  assert.match(appSource, /function isLensFlareOcclusionMesh/)
  assert.match(appSource, /!candidate\.transparent/)
  assert.match(appSource, /candidate\.opacity > 0\.999/)
  assert.match(appSource, /isLensFlareOcclusionMesh\(object\)[\s\S]*?nextOcclusionMeshes\.push\(object\)/)
  assert.doesNotMatch(
    appSource,
    /isMazeWall \|\| isMonster/,
    'lens flare occluders should not be limited to the old wall/monster whitelist'
  )
  assert.doesNotMatch(
    appSource,
    /debugRole === 'maze-door-leaf'[\s\S]{0,120}return false/,
    'door leaves must remain eligible lens-flare occluders'
  )
})

test('debug probes render only in detached free-camera mode', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /scene\.userData\.freeCameraActive === true/)
  assert.match(appSource, /document\.body\.dataset\.freeCameraActive = freeCamera\.current \? 'true' : 'false'/)
})

test('boundary volumetric-lightmap mode samples both sides of a boundary', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.doesNotMatch(
    appSource,
    /vec3 sampleProbeGridDiffuseBoundary8\([\s\S]{0,160}return sampleProbeGridDiffuseCell5/,
    'boundary8 should not alias to the ordinary cell5 sampler'
  )
  assert.match(appSource, /normalIndex = 0; normalIndex < 2/)
  assert.match(appSource, /tangentIndex = 0; tangentIndex < 4/)
})

test('mobile menu exposes compact graphics controls and swipe-safe touch zones', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const stylesSource = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8')

  assert.match(appSource, /level-menu-tabs/)
  assert.match(appSource, /onBooleanSettingChange\('unlitMode', !event\.target\.checked\)/)
  assert.match(appSource, /onEffectSettingChange\('volumetricLighting'/)
  assert.match(appSource, /onAmbientOcclusionModeChange\(event\.target\.checked \? 'n8ao' : 'off'\)/)
  assert.match(appSource, /aria-label="Close Menu"/)
  assert.match(appSource, /&#9776;/)
  assert.match(appSource, /swipeThreshold = 42/)
  assert.match(stylesSource, /-webkit-tap-highlight-color: transparent/)
  assert.match(stylesSource, /touch-action: none/)
})

test('minotaur runtime materials use the authored dark base tint', () => {
  const gltf = readGltf('public/models/minotaur-runtime/scene.gltf')
  const expectedTint = [
    0x2b / 255,
    0x21 / 255,
    0x30 / 255,
    1
  ]

  assert.ok(gltf.materials?.length > 0)

  for (const material of gltf.materials) {
    assert.deepEqual(
      material.pbrMetallicRoughness?.baseColorFactor,
      expectedTint,
      `${material.name ?? '<unnamed>'} should use #2b2130 as its base color factor`
    )
  }
})

test('minotaur runtime model stays within the runtime triangle budget', () => {
  const gltf = readGltf('public/models/minotaur-runtime/scene.gltf')

  assert.ok(
    getGltfTriangleCount(gltf) <= 30_000,
    `runtime minotaur should stay under 30k triangles, got ${getGltfTriangleCount(gltf)}`
  )
})

test('werewolf runtime model is simplified to the tall-monster triangle budget', () => {
  const gltf = readGltf('public/models/pale_dread_white_werewolf_runtime/scene.gltf')
  const simplifySource = fs.readFileSync(path.join(rootDir, 'scripts/simplify-werewolf.mjs'), 'utf8')

  assert.ok(
    getGltfTriangleCount(gltf) <= 10_000,
    `runtime werewolf should stay under 10k triangles, got ${getGltfTriangleCount(gltf)}`
  )
  assert.doesNotMatch(
    simplifySource,
    /simplifyDocument\(relaxedDocument,\s*RELAXED_SIMPLIFY_FLAGS,\s*false\)/,
    'werewolf fallback simplification must keep attribute-aware remapping instead of the hole-prone sloppy path'
  )
})

test('tall monsters render when visible or near the player', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /\(monster\.type === 'minotaur' \|\| monster\.type === 'werewolf'\) &&\s*playerDistance <= 5/,
    'minotaurs and werewolves should share the proximity render override'
  )
  assert.doesNotMatch(
    appSource,
    /monster\.type === 'minotaur' && playerDistance <= 5/,
    'the proximity render override should not remain minotaur-only'
  )
})

test('altar cup runtime model is simplified to the requested triangle budget', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const gltf = readGltf('public/models/droop_cup_runtime/scene.gltf')

  assert.match(appSource, /models\/droop_cup_runtime\/scene\.gltf/)
  assert.ok(
    getGltfTriangleCount(gltf) <= 5_500,
    `runtime altar cup should stay close to 5k triangles, got ${getGltfTriangleCount(gltf)}`
  )
})

test('debug visual defaults live in the editable source config', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const defaults = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'src/visual-settings.defaults.json'), 'utf8')
  )

  assert.match(appSource, /visual-settings\.defaults\.json/)
  assert.equal(defaults.reflectionContribution.intensity, 1)
  assert.equal(defaults.lightmapSaturation, 1)
  assert.equal(defaults.volumetricSaturation, 1)
  assert.equal(defaults.torchBillboardIntensity, 1)
  assert.equal(defaults.depthOfField.focusRange, 8)
  assert.equal(defaults.chromaticAberration.enabled, false)
  assert.match(appSource, /link\.download = 'visual-settings\.defaults\.json'/)
})

test('runtime skybox ownership stays global instead of per-level', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /<SceneEnvironmentBackground intensity=\{environmentIntensity\}/,
    'visible skybox brightness should use the calibrated environment intensity'
  )
  assert.doesNotMatch(appSource, /<EnvironmentLighting\b/)
  assert.match(appSource, /qwantani_moon_noon_puresky_2k\.exr/)
  assert.match(appSource, /useLoader\(EXRLoader, ENVIRONMENT_URL\)/)
})

test('N8AO preserves skybox pixels without scene depth', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /function patchN8AOCompositerSkyDepth/)
  assert.match(appSource, /if \(depth >= 0\.999999\) \{\s*gl_FragColor = sceneTexel;\s*return;/)
  assert.match(appSource, /patchN8AOCompositerSkyDepth\(pass\)/)
})

test('bloom prefilter uses depth to suppress skybox pixels', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /class ThreeBloomCompatPass/)
  assert.match(appSource, /this\.needsDepthTexture = true/)
  assert.match(appSource, /uniform sampler2D depthBuffer/)
  assert.match(appSource, /if \(depth >= 0\.999999\) \{\s*gl_FragColor = vec4\(0\.0\);\s*return;/)
  assert.match(appSource, /setDepthTexture\(depthTexture: Texture \| null\)/)
})

test('radial chromatic aberration uses seven tinted unit-sum samples', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /RadialChromaticAberrationEffect/)
  assert.match(appSource, /offset \* -3\.0/)
  assert.match(appSource, /offset \* 3\.0/)
  assert.match(appSource, /vec3\(0\.02, 0\.05, 0\.16\)/)
  assert.match(appSource, /vec3\(0\.16, 0\.05, 0\.02\)/)
  assert.doesNotMatch(appSource, /inputColor\.g,\s*texture2D\(inputBuffer, blueUv\)\.b/)
})

test('monster screen shake uses shortest passable path distance', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /function getScreenShakePathDistance/)
  assert.match(appSource, /createScreenShakeOpenEdgeSet/)
  assert.match(appSource, /maze\.playerOnlyOpenEdges/)
  assert.match(appSource, /for \(const gate of maze\.gates \?\? \[\]\)/)
  assert.match(appSource, /getScreenShakePathDistance\(\s*layout\.maze,\s*nextMonster\.cell,\s*result\.state\.player\.cell\s*\)/)
  assert.doesNotMatch(appSource, /const distanceCells = Math\.hypot\(\s*nextMonster\.cell\.x - result\.state\.player\.cell\.x/)
})

test('chromatic aberration can be driven by screen shake', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const defaults = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'src/visual-settings.defaults.json'), 'utf8')
  )

  assert.equal(defaults.chromaticAberration.screenShakeIntensity, 0)
  assert.match(appSource, /screenShakeIntensity: number/)
  assert.match(appSource, /document\.body\.dataset\.screenShakeAmount/)
  assert.match(appSource, /settings\.intensity \+\s*\(Math\.max\(0, shakeAmount\) \* settings\.screenShakeIntensity\)/)
  assert.match(appSource, /aria-label="Chromatic Screen Shake Intensity"/)
})

test('indoor ceiling patches use static surface lightmaps', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /function createCeilingPatchGeometry\(\s*maze: MazeLayout\['maze'\],\s*cell: \{ x: number; y: number \},\s*lightmap: MazeLightmap\s*\)/)
  assert.match(appSource, /mapGroundWorldToLightmapLocalUv\(lightmap\.groundBounds, worldX, worldZ\)/)
  assert.match(appSource, /createCeilingPatchGeometry\(layout\.maze, cell, layout\.maze\.lightmap\)/)
  assert.match(appSource, /function CeilingPatchMesh[\s\S]*?lightMap=\{lightmapTexture\}[\s\S]*?lightMapIntensity=\{lightMapIntensity\}/)
})

test('altar trophy placement consumes held trophy immediately and blue flame is raised', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /setGlobalTurnState\(\(current\) => \{[\s\S]*?hasTrophy: false[\s\S]*?trophyState: 'consumed'[\s\S]*?itemId\.endsWith\(':trophy'\)/)
  assert.match(appSource, /<TorchBillboard[\s\S]*?color=\{new Color\(0, 0, 1\)\}[\s\S]*?position=\{\[0, 1\.08 \+ 0\.15 \+ TORCH_BILLBOARD_SIZE, 0\]\}/)
  assert.match(appSource, /lensFlareTint: \[color\.r, color\.g, color\.b\]/)
  assert.match(appSource, /copy\(visibleLens\?\.tint \?\? FIRE_COLOR\)/)
})

test('loading subtitle spacing and height ratio use requested artwork layout', () => {
  const indexSource = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8')
  const cssSource = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8')

  for (const source of [indexSource, cssSource]) {
    assert.match(source, /gap: 0\.175rem;/)
    assert.match(source, /width: min\(59\.5vw, 595px\);/)
  }
})

test('settings menu exposes audio controls and continuous music crossfades', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /type AudioSettings/)
  assert.match(appSource, /function MusicManager/)
  assert.match(appSource, /Timebender\.ogg/)
  assert.match(appSource, /radakan - mist forest\.mp3/)
  assert.match(appSource, /Mystery Manor\.mp3/)
  assert.match(appSource, /stone_guardian_loop\.mp3/)
  assert.match(appSource, /const durationMs = isTarget \? 4000 : 8000/)
  assert.match(appSource, /enabled=\{sceneLoaded\}/)
  assert.match(appSource, /LOADING_FADE_DURATION_MS/)
  assert.match(appSource, /setLibraryReady\(true\)/)
  assert.match(appSource, /audio\.loop = true/)
  assert.match(appSource, /aria-label="Music Volume"/)
  assert.match(appSource, /aria-label="Sound Effects Volume"/)
})

test('page analytics records exact URL and ref query parameter', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /url: window\.location\.href/)
  assert.match(appSource, /ref: searchParams\.get\('ref'\) \?\? null/)
})

test('skybox rotation and moonlight angle are configured together', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const mazeSource = fs.readFileSync(path.join(rootDir, 'src/lib/maze.js'), 'utf8')

  assert.match(appSource, /SKYBOX_ROTATION_Y_RADIANS/)
  assert.match(appSource, /scene\.backgroundRotation\.set\(0, SKYBOX_ROTATION_Y_RADIANS, 0\)/)
  assert.match(mazeSource, /MAZE_MOONLIGHT_ELEVATION_RADIANS = 18 \* Math\.PI \/ 180/)
})

test('runtime spiders lean sixty degrees into their wall side', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /const spiderLeanRadians = MathUtils\.degToRad\(60\)/)
  assert.match(appSource, /spiderWallOffset/)
  assert.match(appSource, /spiderFloorLift/)
  assert.match(appSource, /modelRotationZ:[\s\S]*spiderLeanRadians \* spiderLeanSign/)
})

test('debug lighting and post controls are wired to live render settings', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /const MAX_REFLECTION_CONTRIBUTION_INTENSITY = 12/)
  assert.match(appSource, /aria-label="Surface-LM Saturation"/)
  assert.match(appSource, /aria-label="Volumetric-LM Saturation"/)
  assert.match(appSource, /aria-label="Torch Billboard Intensity"/)
  assert.match(appSource, /<RadialChromaticAberrationEffectPrimitive/)
  assert.match(appSource, /aria-label="Chromatic Aberration Intensity"/)
  assert.match(appSource, /aria-label="Chromatic Screen Shake Intensity"/)
  assert.match(appSource, /focusRange=\{visualSettings\.depthOfField\.focusRange\}/)
  assert.doesNotMatch(appSource, /focalLength=\{visualSettings\.depthOfField/)
})

test('monster eye controls accept the requested extended range', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /aria-label=\{label\}[\s\S]*?onMonsterEyeOffsetChange\(monsterType, eye, axis[\s\S]*?min=\{-4\}[\s\S]*?max=\{4\}/)
})

test('static detail meshes receive the static surface lighting path', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const mazeSource = fs.readFileSync(path.join(rootDir, 'src/lib/maze.js'), 'utf8')

  assert.match(mazeSource, /wallFaceKey/)
  assert.match(mazeSource, /wallId/)
  assert.match(appSource, /function createSconceGeometry/)
  assert.match(appSource, /lightMap=\{lightmapTexture\}/)
  assert.match(appSource, /applyRectLightmapUvsToModel\(cupModel/)
  assert.match(appSource, /material\.lightMap = lightmapTexture/)
  assert.match(appSource, /const STATIC_SURFACE_LIGHTMAP_PROBE_BLEND: ProbeBlendConfig = \{/)
  assert.match(appSource, /useAttachProbeBlendToModel\(cupModel, STATIC_SURFACE_LIGHTMAP_PROBE_BLEND, patchConfig\)/)
  assert.match(appSource, /probeBlend=\{STATIC_SURFACE_LIGHTMAP_PROBE_BLEND\}/)
  assert.match(appSource, /function WallSconce[\s\S]*?diffuseIntensity: 0,[\s\S]*?vlmMode: 'disabled'/)
  assert.doesNotMatch(appSource, /const cupProbeBlend =/)
  assert.doesNotMatch(appSource, /probeBlend=\{blockProbeBlend\}/)
})

test('mobile touch controls do not paint the whole tap region on press', () => {
  const cssSource = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8')

  assert.match(cssSource, /\.mobile-touch-zone:active\s*\{\s*background: transparent;/)
  assert.match(cssSource, /-webkit-tap-highlight-color: transparent/)
  assert.match(cssSource, /-webkit-touch-callout: none/)
})

test('gameplay camera writes are centralized through the camera rig helper', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const directWriteMatches = [
    ...appSource.matchAll(/camera\.(position|quaternion)\.(set|copy|lerpVectors|add|addScaledVector|setFromEuler)|camera\.lookAt|camera\.updateMatrixWorld/g)
  ].map((match) => {
    const line = appSource.slice(0, match.index).split('\n').length

    return { line, text: match[0] }
  })
  const allowedLines = new Set(
    appSource
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) =>
        line.includes('camera.position.copy(position)') ||
        line.includes('camera.quaternion.setFromEuler') ||
        line.includes('camera.position.add(cameraShakeOffset.current)') ||
        line.includes('camera.updateMatrixWorld()')
      )
      .map(({ number }) => number)
  )

  assert.ok(
    directWriteMatches.length > 0,
    'source test should detect the camera rig helper writes'
  )
  assert.deepEqual(
    directWriteMatches.filter((match) => !allowedLines.has(match.line)),
    [],
    'camera.position/quaternion writes should stay inside applyCameraRigPose'
  )
  assert.match(appSource, /fromWorldPosition: Vector3/)
  assert.match(appSource, /toWorldPosition: Vector3/)
})

test('save resume, level menu reset, and debug overlay visibility are wired', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const specSource = fs.readFileSync(path.join(rootDir, 'SPEC.md'), 'utf8')

  assert.match(appSource, /getLatestDirectedNonMazeLevelId\(startupSave\?\.enteredLevelIds/)
  assert.match(appSource, /StartupChoiceOverlay/)
  assert.match(appSource, /clearGameSave\(window\.localStorage\)/)
  assert.match(appSource, /enteredLevelIds/)
  assert.match(appSource, /<span>Reset<\/span>/)
  assert.match(appSource, /<span>Show Solution<\/span>/)
  assert.match(appSource, /controlsOpen && overlayVisible \? \(/)
  assert.match(specSource, /records the set of levels the player has entered/)
  assert.match(specSource, /New Game` and `Continue` choices/)
  assert.match(specSource, /top-right overlay is visible only while the debug menu is open/)
})

test('player death fade-in uses the requested longer duration', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const specSource = fs.readFileSync(path.join(rootDir, 'SPEC.md'), 'utf8')

  assert.match(appSource, /const PLAYER_DEATH_FADE_IN_MS = 6000/)
  assert.match(appSource, /elapsed \/ PLAYER_DEATH_FADE_IN_MS/)
  assert.match(specSource, /fades back in over `6s`/)
})

test('death reset clears transient camera shake before accepting post-resurrection movement', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /const finalState = activeAnimation\.killed[\s\S]*?resetTurnStateToCheckpoint\(layout\.maze, activeAnimation\.to\)[\s\S]*?if \(activeAnimation\.killed\) \{\s*cameraShake\.current = \{\s*amplitude: 0,\s*endsAt: 0\s*\}\s*inputQueue\.current = \[\]\s*\}[\s\S]*?turnStateRef\.current = finalState/,
    'camera shake and buffered inputs from the killing turn must be cleared when resurrection reset commits'
  )
  assert.match(
    appSource,
    /const previousMonster = result\.previous\.monsters\.find\(\s*\(monster\) => monster\.id === nextMonster\.id\s*\) \?\? result\.previous\.monsters\[monsterIndex\]/,
    'monster camera shake must compare matching monster identities instead of relying only on queue order'
  )
})
