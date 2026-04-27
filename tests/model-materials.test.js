import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeModelGltfPaths = [
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
  const localReflectionProbeSamplers = 4
  const dynamicVolumetricCoefficientSamplers = 4
  const dynamicVolumetricConnectivitySamplers = 1
  const estimatedGateSamplerCount =
    gateRuntimeMaterialSamplers +
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
    estimatedGateSamplerCount + 6 > webglFragmentSamplerBudget,
    'the test should cover the previous six-sampler depth-atlas pressure that made gates disappear'
  )
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
