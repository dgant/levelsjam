const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')
const jimp = require('jimp')

const Jimp = jimp.Jimp ?? jimp

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
  },
  {
    source: 'public/textures/metal_rust-1K/1K-metal_rust-diffuse.jpg',
    target: 'public/textures/runtime/metal-rust/metal_rust_basecolor-1K.png',
    type: 'raster'
  },
  {
    source: 'public/textures/metal_rust-1K/1K-metal_rust-normal.jpg',
    target: 'public/textures/runtime/metal-rust/metal_rust_normal-1K.png',
    type: 'raster'
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
  },
  {
    ao: 'public/textures/metal_rust-1K/1K-metal_rust-ao.jpg',
    metalness: 77,
    roughness: 220,
    target: 'public/textures/runtime/metal-rust/metal_rust_orm-1K.png'
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

async function readRaster(relativePath) {
  if (relativePath.endsWith('.png')) {
    return readPng(relativePath)
  }

  const image = await Jimp.read(path.join(rootDir, relativePath))
  const png = new PNG({
    width: image.bitmap.width,
    height: image.bitmap.height,
    colorType: 6
  })

  Buffer.from(image.bitmap.data).copy(png.data)
  return png
}

function assertSameDimensions(spec, channels) {
  const [first] = channels.filter((channel) => typeof channel !== 'number')

  if (!first) {
    throw new Error(`[build-runtime-textures] ${spec.target} has no image source channels`)
  }

  for (const channel of channels) {
    if (typeof channel === 'number') {
      continue
    }
    if (channel.width !== first.width || channel.height !== first.height) {
      throw new Error(
        `[build-runtime-textures] ${spec.target} source dimensions differ`
      )
    }
  }
}

function readSourceChannel(source, pixelIndex) {
  if (typeof source === 'number') {
    return Math.max(0, Math.min(255, Math.round(source)))
  }

  return source.data[pixelIndex * 4]
}

async function main() {
  let writtenCount = 0

  for (const spec of runtimeTextureSpecs) {
    const sourcePath = path.join(rootDir, spec.source)
    const targetPath = path.join(rootDir, spec.target)
    const sourceBytes = fs.readFileSync(sourcePath)
    const png = spec.type === 'raster'
      ? await readRaster(spec.source)
      : PNG.sync.read(sourceBytes)
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
    const ao = typeof spec.ao === 'string' ? await readRaster(spec.ao) : spec.ao
    const roughness = typeof spec.roughness === 'string'
      ? await readRaster(spec.roughness)
      : spec.roughness
    const metalness = typeof spec.metalness === 'string'
      ? await readRaster(spec.metalness)
      : spec.metalness
    const channels = metalness === null || metalness === undefined
      ? [ao, roughness]
      : [ao, roughness, metalness]
    assertSameDimensions(spec, channels)
    const imageSource = channels.find((channel) => typeof channel !== 'number')

    const orm = new PNG({
      width: imageSource.width,
      height: imageSource.height,
      colorType: 6
    })

    for (let pixelIndex = 0; pixelIndex < imageSource.width * imageSource.height; pixelIndex += 1) {
      const targetIndex = pixelIndex * 4
      orm.data[targetIndex] = readSourceChannel(ao, pixelIndex)
      orm.data[targetIndex + 1] = readSourceChannel(roughness, pixelIndex)
      orm.data[targetIndex + 2] =
        metalness === null || metalness === undefined
          ? 0
          : readSourceChannel(metalness, pixelIndex)
      orm.data[targetIndex + 3] = 255
    }

    const targetPath = path.join(rootDir, spec.target)
    const targetBytes = PNG.sync.write(orm, { colorType: 6 })
    const written = writeIfChanged(targetPath, targetBytes)
    writtenOrmCount += written ? 1 : 0
    console.log(
      `[build-runtime-textures] ${spec.target} ORM ${imageSource.width}x${imageSource.height} -> ${targetBytes.length}${written ? '' : ' (unchanged)'}`
    )
  }

  console.log(
    `[build-runtime-textures] wrote ${writtenOrmCount}/${runtimeOrmSpecs.length} runtime ORM textures`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
