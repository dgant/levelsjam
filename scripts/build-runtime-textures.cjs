const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const rootDir = path.resolve(__dirname, '..')

const runtimeTextureSpecs = [
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_basecolor-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_basecolor-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_normal-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_normal-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_basecolor-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_basecolor-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_normal-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_normal-1K.png'
  }
]

const runtimeOrmSpecs = [
  {
    ao: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_ambientocclusion-1K.png',
    metalness: null,
    roughness: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_roughness-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_orm-1K.png'
  },
  {
    ao: 'public/textures/metal-13/metal_13-1K/metal_13_ambientocclusion-1K.png',
    metalness: 'public/textures/metal-13/metal_13-1K/metal_13_metallic-1K.png',
    roughness: 'public/textures/metal-13/metal_13-1K/metal_13_roughness-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_orm-1K.png'
  }
]

function writeIfChanged(filePath, bytes) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath)

    if (existing.length === bytes.length && existing.equals(bytes)) {
      return false
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, bytes)
  return true
}

function readPng(relativePath) {
  return PNG.sync.read(fs.readFileSync(path.join(rootDir, relativePath)))
}

function assertSameDimensions(spec, channels) {
  const [first] = channels

  for (const channel of channels) {
    if (channel.width !== first.width || channel.height !== first.height) {
      throw new Error(
        `[build-runtime-textures] ${spec.target} source dimensions differ`
      )
    }
  }
}

function readSourceChannel(png, pixelIndex) {
  return png.data[pixelIndex * 4]
}

let writtenCount = 0

for (const spec of runtimeTextureSpecs) {
  const sourcePath = path.join(rootDir, spec.source)
  const targetPath = path.join(rootDir, spec.target)
  const sourceBytes = fs.readFileSync(sourcePath)
  const png = PNG.sync.read(sourceBytes)
  const targetBytes = PNG.sync.write(png, {
    colorType: png.colorType === 0 ? 0 : 6
  })
  const written = writeIfChanged(targetPath, targetBytes)
  writtenCount += written ? 1 : 0
  console.log(
    `[build-runtime-textures] ${spec.target} ${sourceBytes.length} -> ${targetBytes.length}${written ? '' : ' (unchanged)'}`
  )
}

console.log(
  `[build-runtime-textures] wrote ${writtenCount}/${runtimeTextureSpecs.length} runtime textures`
)

let writtenOrmCount = 0

for (const spec of runtimeOrmSpecs) {
  const ao = readPng(spec.ao)
  const roughness = readPng(spec.roughness)
  const metalness = spec.metalness ? readPng(spec.metalness) : null
  const channels = metalness ? [ao, roughness, metalness] : [ao, roughness]
  assertSameDimensions(spec, channels)

  const orm = new PNG({
    width: ao.width,
    height: ao.height,
    colorType: 6
  })

  for (let pixelIndex = 0; pixelIndex < ao.width * ao.height; pixelIndex += 1) {
    const targetIndex = pixelIndex * 4
    orm.data[targetIndex] = readSourceChannel(ao, pixelIndex)
    orm.data[targetIndex + 1] = readSourceChannel(roughness, pixelIndex)
    orm.data[targetIndex + 2] = metalness ? readSourceChannel(metalness, pixelIndex) : 0
    orm.data[targetIndex + 3] = 255
  }

  const targetPath = path.join(rootDir, spec.target)
  const targetBytes = PNG.sync.write(orm, { colorType: 6 })
  const written = writeIfChanged(targetPath, targetBytes)
  writtenOrmCount += written ? 1 : 0
  console.log(
    `[build-runtime-textures] ${spec.target} ORM ${ao.width}x${ao.height} -> ${targetBytes.length}${written ? '' : ' (unchanged)'}`
  )
}

console.log(
  `[build-runtime-textures] wrote ${writtenOrmCount}/${runtimeOrmSpecs.length} runtime ORM textures`
)
