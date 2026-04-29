import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeModelGltfPaths = [
  'public/models/droop_cup_runtime/scene.gltf',
  'public/models/metal_gate_runtime/scene.gltf',
  'public/models/pbr_jumping_spider_monster/scene.gltf',
  'public/models/awil_werewolf_runtime/scene.gltf',
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

test('doors use generated Minoan-door ORM textures and baked dynamic lighting', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(appSource, /const DOOR_TEXTURE_URLS = \{/)
  assert.match(
    appSource,
    /textures\/runtime\/minoan-door\/minoan_door_left_orm\.png/,
    'left door leaf should bind its generated runtime ORM texture'
  )
  assert.match(
    appSource,
    /textures\/runtime\/minoan-door\/minoan_door_right_orm\.png/,
    'right door leaf should bind its generated runtime ORM texture'
  )
  assert.doesNotMatch(
    appSource,
    /1K-metal_rust-specular\.jpg|1K-metal_rust-roughness\.jpg/,
    'door material should not bind source specular or roughness images directly'
  )
  assert.match(
    appSource,
    /vlmMode: hasProbeCoefficients \? 'boundary8' : 'disabled'/,
    'doors should receive volumetric-lightmap diffuse lighting'
  )
  assert.match(
    appSource,
    /radianceMode: hasProbeTextures \? 'constant' : 'disabled'/,
    'doors should receive local reflection-probe radiance'
  )
  assert.match(
    appSource,
    /activePlayerWorldPosition/,
    'maze entrance doors should receive the active player world position'
  )
  assert.match(
    appSource,
    /activePlayerTurn > 0 &&\s*doorWorldPosition/,
    'maze entrance doors should open from world-space adjacency after gameplay movement without starting open'
  )
  assert.match(
    appSource,
    /isOpen=\{\s*\(isActive && isDoorOpenForTurnState\(door, layout\.maze, turnState\)\) \|\|\s*isAdjacentToActivePlayer\s*\}/,
    'maze entrance doors should be driven by active rules state or active world-space player adjacency'
  )
  assert.match(
    appSource,
    /const DOOR_HEIGHT = 1\.8/,
    'door leaves should be 1.8m high'
  )
})

test('door back faces keep handles toward the doorway center', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.match(
    appSource,
    /maps=\{leftDoorMaps\}\s+materialKey=\{`\$\{materialKey\}:left:front`\}[\s\S]*?maps=\{leftDoorMaps\}\s+materialKey=\{`\$\{materialKey\}:left:back`\}/,
    'left door leaf should use the left-handle-inward texture on both visible sides'
  )
  assert.match(
    appSource,
    /maps=\{rightDoorMaps\}\s+materialKey=\{`\$\{materialKey\}:right:front`\}[\s\S]*?maps=\{rightDoorMaps\}\s+materialKey=\{`\$\{materialKey\}:right:back`\}/,
    'right door leaf should use the right-handle-inward texture on both visible sides'
  )
})

test('lens flare controls do not use app-side giant multipliers', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')

  assert.doesNotMatch(appSource, /LENS_FLARE_COLOR_GAIN|LENS_FLARE_INTENSITY_SCALE/)
  assert.match(appSource, /Lens Flare Strength/)
  assert.match(appSource, /Star Burst Intensity/)
  assert.doesNotMatch(appSource, /Flare Opacity/)
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

test('altar cup runtime model is simplified to the requested triangle budget', () => {
  const appSource = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8')
  const gltf = readGltf('public/models/droop_cup_runtime/scene.gltf')

  assert.match(appSource, /models\/droop_cup_runtime\/scene\.gltf/)
  assert.ok(
    getGltfTriangleCount(gltf) <= 5_500,
    `runtime altar cup should stay close to 5k triangles, got ${getGltfTriangleCount(gltf)}`
  )
})
