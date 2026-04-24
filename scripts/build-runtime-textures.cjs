const fs = require('node:fs')
const path = require('node:path')
const { PNG } = require('pngjs')

const rootDir = path.resolve(__dirname, '..')

const runtimeTextureSpecs = [
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_ambientocclusion-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_ambientocclusion-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_basecolor-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_basecolor-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_height-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_height-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_normal-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_normal-1K.png'
  },
  {
    source: 'public/textures/stone-wall-29/stonewall_29-1K/stonewall_29_roughness-1K.png',
    target: 'public/textures/runtime/stone-wall-29/stonewall_29_roughness-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_ambientocclusion-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_ambientocclusion-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_basecolor-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_basecolor-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_height-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_height-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_normal-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_normal-1K.png'
  },
  {
    source: 'public/textures/metal-13/metal_13-1K/metal_13_roughness-1K.png',
    target: 'public/textures/runtime/metal-13/metal_13_roughness-1K.png'
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
